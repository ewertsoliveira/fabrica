#!/usr/bin/env node
// Testes do gravador de marca (escrever.js): grava o marca.yaml trocando só as linhas pedidas, com a versão anterior no
// histórico e "Desfazer", e monta a marca que nasce de um estilo (letras copiadas para a pasta da empresa, com a
// licença). Rode: node 08-FERRAMENTAS/marca/escrever.test.js
// Cada caso monta uma pasta temporária com as empresas fictícias aurora e boreal; o leitor de marca (marca.js) roda num
// processo filho com FABRICA_RAIZ e FABRICA_EMPRESA dessa pasta. As cores são inventadas e as letras são as livres da
// pasta de letras do modelo.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;
delete process.env.FABRICA_MARCA;

const escrever = require('./escrever');
const empresaMod = require('../../_fabrica/core/empresa');
const { lerYaml } = require('./yaml');

const RAIZ_REAL = path.resolve(__dirname, '..', '..');
const LEITOR = path.join(__dirname, 'marca.js');
const SCRIPT = path.join(__dirname, 'escrever.js');
const FONTES = path.join(RAIZ_REAL, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const EXEMPLO = path.join(RAIZ_REAL, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml');
const LAB = '04-LABORATORIO-DE-DESIGN';
const BOM_INICIO = new RegExp('^' + String.fromCharCode(0xfeff));

let falhas = 0;
let contador = 0;
const pastas = [];
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function novaRaiz() {
  const r = path.resolve(path.join(os.tmpdir(), `Fábrica de Teste (EMPRESA)-mar-${process.pid}-${++contador}`));
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
const ler = (r, rel) => fs.readFileSync(path.join(r, ...rel.split('/')));
const existe = (r, rel) => fs.existsSync(path.join(r, ...rel.split('/')));
function fotografia(raiz, ignorar = () => false) {
  const mapa = {};
  const varrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const arq = path.join(dir, e.name);
      const rel = path.relative(raiz, arq).split(path.sep).join('/');
      if (ignorar(rel)) continue;
      if (e.isDirectory()) { mapa[rel + '/'] = 'pasta'; varrer(arq); } else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(raiz);
  return mapa;
}
const historico = (r, c) => (existe(r, `empresas/${c}/historico`) ? fs.readdirSync(path.join(r, 'empresas', c, 'historico')).sort() : []);
const hora = (s) => new Date(`2026-11-05T12:00:${String(s).padStart(2, '0')}.000Z`);
// Linhas com o fim de linha de cada uma (para comparar linha a linha sem perder o CRLF).
const linhas = (buf) => buf.toString('utf8').split(/(?<=\n)/);

// O leitor de marca de verdade, num processo filho, olhando para a pasta temporária.
function marcaJs(r, empresa, codigo = '(m)=>({nome:m.empresa.nome,handle:m.handle,cores:Object.fromEntries(m.PAPEIS.map((p)=>[p,m.hex(p)])),origem:m.dados.origem,fontes:Object.fromEntries(["principal","mono","acento"].map((p)=>{const a=m.pega("tipografia."+p+".arquivo","");const c=a?m.caminho(a):null;return [p,c&&require("fs").existsSync(c)?c:(a||null)];})),logo:m.dados.pecas&&m.dados.pecas.logo?m.caminho(m.dados.pecas.logo):null})') {
  const env = { ...process.env, FABRICA_RAIZ: r, FABRICA_SILENCIO_EXEMPLO: '1' };
  delete env.FABRICA_MARCA;
  if (empresa) env.FABRICA_EMPRESA = empresa; else delete env.FABRICA_EMPRESA;
  const x = spawnSync(process.execPath, ['-e', `const m=require(${JSON.stringify(LEITOR)});process.stdout.write(JSON.stringify((${codigo})(m)))`],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  assert.strictEqual(x.status, 0, 'o marca.js abriu sem erro: ' + x.stderr);
  return JSON.parse(x.stdout);
}

const CORES_A = { escuro: '#14213D', claro: '#F5EFE6', acento: '#E76F51', neutro: '#8A817C' };

function raizDuas() {
  const r = novaRaiz();
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  esc(r, 'empresas/aurora/fontes/Minha-Letra.ttf', 'letra de mentira da aurora');
  esc(r, 'empresas/aurora/logo/logo-1.png', Buffer.from('89504e470d0a1a0a', 'hex'));
  esc(r, 'empresas/boreal/fontes/Letra-Boreal.ttf', 'letra de mentira da boreal');
  esc(r, 'empresas/boreal/logo/logo-1.png', Buffer.from('89504e470d0a1a0a', 'hex'));
  return r;
}
const daAurora = (rel) => rel === 'empresas/aurora/marca.yaml' || rel.startsWith('empresas/aurora/historico');

// ---------- marca nova ----------

t('marca nova: parte do exemplo, com o nome da empresa e a conta vazia, e abre no marca.js', () => {
  const r = raizDuas();
  const antes = fotografia(r, daAurora);
  const res = escrever.gravarMarca(r, 'aurora', { cores: CORES_A }, { origem: 'pessoa', agora: hora(1) });
  assert.strictEqual(res.arquivo, path.join(r, 'empresas', 'aurora', 'marca.yaml'));
  assert.deepStrictEqual(historico(r, 'aurora'), ['marca-2026-11-05-120001Z-vazio.yaml']);
  assert.deepStrictEqual(fotografia(r, daAurora), antes, 'nada fora da marca de aurora mudou');
  const m = marcaJs(r, 'aurora');
  assert.strictEqual(m.nome, 'Aurora Nutrição', 'o nome é o da empresa');
  assert.strictEqual(m.handle, '', 'a conta de exemplo nunca vai para uma empresa');
  assert.deepStrictEqual(m.cores, CORES_A);
  assert.strictEqual(m.origem, 'pessoa');
  assert.ok(fs.existsSync(m.fontes.principal) && fs.existsSync(m.fontes.mono), 'as letras do exemplo continuam valendo: ' + JSON.stringify(m.fontes));
  // nenhuma identidade da empresa fictícia do exemplo fica na marca da empresa (nome, conta, correções de grafia)
  const texto = ler(r, 'empresas/aurora/marca.yaml').toString('utf8');
  const y = lerYaml(texto.replace(BOM_INICIO, ''));
  assert.deepStrictEqual(y.video['correcoes-transcricao'], {}, 'as correções de grafia do exemplo não vão para a empresa');
  assert.ok(!/empresa\s*exemplo|empresa\.exemplo/i.test(texto), 'nada da empresa do exemplo no arquivo');
  // linha a linha: igual ao exemplo, menos as linhas trocadas, a linha da origem e as correções do exemplo
  const novo = linhas(ler(r, 'empresas/aurora/marca.yaml'));
  const ex = linhas(fs.readFileSync(EXEMPLO)).filter((l) => !/^\s+empresaexemplo:/.test(l));
  const semOrigem = novo.filter((l) => !/^origem: /.test(l));
  assert.strictEqual(novo.length - semOrigem.length, 1, 'uma linha de origem');
  assert.strictEqual(semOrigem.length, ex.length);
  const mudadas = ex.map((l, i) => (l === semOrigem[i] ? null : i)).filter((i) => i !== null);
  const chaves = mudadas.map((i) => ex[i].trim().split(':')[0]);
  assert.deepStrictEqual(chaves.sort(), ['acento', 'claro', 'correcoes-transcricao', 'escuro', 'handle', 'neutro', 'nome'].sort(), 'só as linhas pedidas mudaram');
  for (const i of mudadas) assert.strictEqual(semOrigem[i].slice(-2) === '\r\n', ex[i].slice(-2) === '\r\n', 'o fim de linha ficou: ' + ex[i]);
  assert.ok(/#/.test(semOrigem[mudadas.find((i) => /escuro/.test(ex[i]))]), 'o comentário da linha ficou');
});

// ---------- marca existente ----------

const BOM = String.fromCharCode(0xfeff); // montado por código: nenhum caractere invisível no texto do teste
const MARCA_RICA = [
  '# Marca da Aurora (escrita à mão)',
  '',
  'empresa:',
  '  nome: "Aurora Antiga"   # nome curto',
  '  handle: "aurora.teste"',
  '',
  'cores:',
  '  escuro: "#000001"   # fundo',
  '  claro: "#FFFFFE"',
  '  acento: "#123456"',
  '  neutro: "#654321"',
  '',
  'tipografia:',
  '  principal:',
  '    arquivo: fontes/Velha.ttf',
  '    largura-titulo: 100',
  '  mono:',
  '    arquivo: fontes/Velha.ttf',
  '',
  'nota-livre: |',
  '  cores:',
  '    escuro: "#FFFFFF"',
  '  isto é só texto',
  'lista:',
  '  - escuro: "#ABCDEF"',
  '    claro: "#ABCDEF"',
  'video:',
  '  cta:',
  '    frase: "fale com a gente"',
  '',
].join('\r\n');

t('marca existente com comentários, blocos extras, BOM e CRLF: só as linhas pedidas mudam e o fim de linha fica', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/fontes/Velha.ttf', 'velha');
  esc(r, 'empresas/aurora/marca.yaml', BOM + MARCA_RICA);
  const original = ler(r, 'empresas/aurora/marca.yaml');
  escrever.gravarMarca(r, 'aurora', {
    nome: 'Aurora Nutrição',
    cores: { escuro: '#14213d', acento: '#E76F51' },
    fontes: { principal: path.join(r, 'empresas', 'aurora', 'fontes', 'Minha-Letra.ttf'), acento: path.join(FONTES, 'Anton-Regular.ttf') },
    logo: path.join(r, 'empresas', 'aurora', 'logo', 'logo-1.png'),
  }, { origem: 'logo', agora: hora(1) });
  const novo = ler(r, 'empresas/aurora/marca.yaml');
  assert.ok(novo.toString('utf8').startsWith(BOM + '# Marca'), 'o BOM ficou');
  assert.ok(ler(r, 'empresas/aurora/historico/marca-2026-11-05-120001Z.yaml').equals(original), 'a anterior foi para o histórico, byte a byte');
  const a = linhas(original);
  const b = linhas(novo);
  // as linhas antigas, uma a uma: iguais, menos as quatro trocadas
  const trocadas = { 3: '  nome: "Aurora Nutrição"   # nome curto\r\n', 7: '  escuro: "#14213D"   # fundo\r\n', 9: '  acento: "#E76F51"\r\n', 14: '    arquivo: "fontes/Minha-Letra.ttf"\r\n' };
  const acrescentadas = [];
  let j = 0;
  for (let i = 0; i < a.length; i++) {
    while (j < b.length && b[j] !== (trocadas[i] || a[i])) acrescentadas.push(b[j++]);
    assert.ok(j < b.length, `a linha ${i + 1} (${JSON.stringify(a[i])}) devia estar no arquivo novo`);
    j++;
  }
  acrescentadas.push(...b.slice(j));
  assert.deepStrictEqual(acrescentadas.map((l) => l.replace(/\r\n$/, '')), [
    'origem: "logo"',
    '  acento:', '    arquivo: "fontes/Anton-Regular.ttf"', // a letra da lista vai copiada para a pasta da empresa
    'pecas:', '  logo: "logo/logo-1.png"',
  ], 'o que faltava foi acrescentado, e nada mais: ' + JSON.stringify(acrescentadas));
  for (const l of acrescentadas) assert.ok(l.endsWith('\r\n'), 'linha nova com o fim de linha do arquivo: ' + JSON.stringify(l));
  // o resto do conteúdo continua o mesmo (o bloco de texto e a lista não foram tocados)
  const y = lerYaml(novo.toString('utf8').replace(BOM_INICIO, ''));
  assert.strictEqual(y['nota-livre'], 'cores:\nescuro: "#FFFFFF"\nisto é só texto');
  assert.deepStrictEqual(y.lista, [{ escuro: '#ABCDEF', claro: '#ABCDEF' }]);
  assert.strictEqual(y.empresa.handle, 'aurora.teste', 'a conta só muda se a pessoa pedir');
  assert.strictEqual(y.tipografia.mono.arquivo, 'fontes/Velha.ttf');
  const m = marcaJs(r, 'aurora');
  assert.deepStrictEqual(m.cores, { escuro: '#14213D', claro: '#FFFFFE', acento: '#E76F51', neutro: '#654321' });
  assert.strictEqual(m.fontes.principal, path.join(r, 'empresas', 'aurora', 'fontes', 'Minha-Letra.ttf'));
  assert.strictEqual(m.fontes.acento, path.join(r, 'empresas', 'aurora', 'fontes', 'Anton-Regular.ttf'), 'a letra da lista é a cópia da empresa');
  assert.strictEqual(m.logo, path.join(r, 'empresas', 'aurora', 'logo', 'logo-1.png'));
  assert.strictEqual(m.origem, 'logo');
});

t('marca existente só com LF e sem fim de linha no fim: continua LF', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "Aurora"\ncores:\n  escuro: "#000001"\n  claro: "#FFFFFE"\n  acento: "#123456"\n  neutro: "#654321"');
  escrever.gravarMarca(r, 'aurora', { cores: { neutro: '#8A817C' } }, { origem: 'pessoa', agora: hora(1) });
  const txt = ler(r, 'empresas/aurora/marca.yaml').toString('utf8');
  assert.ok(!txt.includes('\r'), 'nenhum CRLF entrou');
  assert.strictEqual(txt, 'origem: "pessoa"\nempresa:\n  nome: "Aurora"\ncores:\n  escuro: "#000001"\n  claro: "#FFFFFE"\n  acento: "#123456"\n  neutro: "#8A817C"');
});

// ---------- histórico e desfazer ----------

t('histórico: duas gravações no mesmo segundo não se sobrescrevem; desfazer volta byte a byte, um passo de cada vez', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', MARCA_RICA);
  const v0 = ler(r, 'empresas/aurora/marca.yaml');
  escrever.gravarMarca(r, 'aurora', { cores: { escuro: '#111111' } }, { origem: 'pessoa', agora: hora(1) });
  const v1 = ler(r, 'empresas/aurora/marca.yaml');
  escrever.gravarMarca(r, 'aurora', { cores: { escuro: '#222222' } }, { origem: 'pessoa', agora: hora(1) });
  assert.deepStrictEqual(historico(r, 'aurora'), ['marca-2026-11-05-120001Z-2.yaml', 'marca-2026-11-05-120001Z.yaml']);
  assert.ok(ler(r, 'empresas/aurora/historico/marca-2026-11-05-120001Z-2.yaml').equals(v1));
  const antesBoreal = fotografia(r, (rel) => rel.startsWith('empresas/aurora'));
  assert.deepStrictEqual(escrever.desfazerMarca(r, 'aurora', { agora: hora(2) }), { restaurado: true });
  assert.ok(ler(r, 'empresas/aurora/marca.yaml').equals(v1), 'voltou byte a byte');
  assert.deepStrictEqual(escrever.desfazerMarca(r, 'aurora', { agora: hora(3) }), { restaurado: true });
  assert.ok(ler(r, 'empresas/aurora/marca.yaml').equals(v0), 'voltou byte a byte');
  assert.throws(() => escrever.desfazerMarca(r, 'aurora', { agora: hora(4) }), (e) => e.recusaDoPedido === true && /nada para desfazer/i.test(e.message));
  assert.deepStrictEqual(fotografia(r, (rel) => rel.startsWith('empresas/aurora')), antesBoreal, 'nada de boreal mudou');
  const guardados = historico(r, 'aurora').map((n) => ler(r, `empresas/aurora/historico/${n}`));
  for (const v of [v1, ler(r, 'empresas/aurora/marca.yaml')]) assert.ok(guardados.some((g) => g.equals(v)), 'nada se perdeu');
});

t('desfazer a primeira marca volta para sem marca (a marca desfeita fica guardada no histórico)', () => {
  const r = raizDuas();
  escrever.gravarMarca(r, 'aurora', { cores: CORES_A }, { origem: 'pessoa', agora: hora(1) });
  const v1 = ler(r, 'empresas/aurora/marca.yaml');
  assert.deepStrictEqual(escrever.desfazerMarca(r, 'aurora', { agora: hora(2) }), { restaurado: false });
  assert.ok(!existe(r, 'empresas/aurora/marca.yaml'));
  assert.ok(historico(r, 'aurora').some((n) => ler(r, `empresas/aurora/historico/${n}`).equals(v1)));
});

// ---------- recusas ----------

t('recusas: cor inválida, letra ou logo fora da pasta da empresa, papel desconhecido e marca ilegível; nada gravado', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', MARCA_RICA);
  esc(r, 'empresas/aurora/fontes/nao-e-letra.png', 'x');
  esc(r, 'segredo/Letra.ttf', 'fora de tudo');
  const antes = fotografia(r);
  const recusado = (valores, opcoes, motivo, codigo = 'aurora') => assert.throws(() => escrever.gravarMarca(r, codigo, valores, { agora: hora(1), ...opcoes }),
    (e) => e.recusaDoPedido === true && e.status === 400 && e.message.length > 10, motivo);
  const aurora = (...p) => path.join(r, 'empresas', 'aurora', ...p);
  for (const cor of ['#12345', 'red', '#GGGGGG', 123, '', null, '#1234567', '14213D']) recusado({ cores: { escuro: cor } }, { origem: 'pessoa' }, 'cor ' + cor);
  recusado({ cores: { primaria: '#14213D' } }, { origem: 'pessoa' }, 'papel de cor desconhecido');
  recusado({ fontes: { titulo: aurora('fontes', 'Minha-Letra.ttf') } }, { origem: 'pessoa' }, 'papel de letra desconhecido');
  recusado({ fontes: { principal: path.join(r, 'empresas', 'boreal', 'fontes', 'Letra-Boreal.ttf') } }, { origem: 'pessoa' }, 'letra da outra empresa');
  recusado({ fontes: { principal: 'empresas/boreal/fontes/Letra-Boreal.ttf' } }, { origem: 'pessoa' }, 'letra da outra empresa, caminho relativo');
  recusado({ fontes: { principal: aurora('..', 'boreal', 'fontes', 'Letra-Boreal.ttf') } }, { origem: 'pessoa' }, 'letra com ../');
  recusado({ fontes: { principal: path.join(r, 'segredo', 'Letra.ttf') } }, { origem: 'pessoa' }, 'letra fora de tudo');
  recusado({ fontes: { principal: aurora('fontes', 'Nao-Existe.ttf') } }, { origem: 'pessoa' }, 'letra que não existe');
  recusado({ fontes: { principal: aurora('fontes', 'nao-e-letra.png') } }, { origem: 'pessoa' }, 'letra que não é .ttf nem .otf');
  recusado({ fontes: { principal: '' } }, { origem: 'pessoa' }, 'letra principal vazia');
  recusado({ fontes: { mono: 42 } }, { origem: 'pessoa' }, 'letra que não é texto');
  recusado({ logo: path.join(r, 'empresas', 'boreal', 'logo', 'logo-1.png') }, { origem: 'pessoa' }, 'logo de outra empresa');
  recusado({ logo: aurora('logo', 'nao-existe.png') }, { origem: 'pessoa' }, 'logo que não existe');
  recusado({ logo: aurora('fontes', 'Minha-Letra.ttf') }, { origem: 'pessoa' }, 'logo que não é imagem');
  recusado({ handle: 'outra' }, { origem: 'pessoa' }, 'campo desconhecido');
  recusado({ nome: '' }, { origem: 'pessoa' }, 'nome vazio');
  recusado({ nome: 'Aurora\norigem: "x"' }, { origem: 'pessoa' }, 'nome com quebra de linha');
  recusado({ cores: CORES_A }, {}, 'sem origem');
  for (const o of ['internet', 'estilo:../x', 'estilo:', 'estilo-proprio:a/b', 42]) recusado({ cores: CORES_A }, { origem: o }, 'origem ' + o);
  recusado(null, { origem: 'pessoa' }, 'valores nulos');
  recusado({ cores: CORES_A }, { origem: 'pessoa' }, 'empresa inexistente', 'nao-existe');
  recusado({ cores: CORES_A }, { origem: 'pessoa' }, 'empresa com ../', '../boreal');
  assert.deepStrictEqual(fotografia(r), antes, 'nada foi gravado, em lugar nenhum');
  // marca ilegível ou num formato que o gravador não troca sozinho (cores em linha): recusa, nada gravado
  for (const ruim of ['empresa:\n  nome: "A"\n    torto: x\n', 'empresa:\n  nome: "A"\ncores: { escuro: "#000001", claro: "#FFFFFE", acento: "#123456", neutro: "#654321" }\n']) {
    esc(r, 'empresas/aurora/marca.yaml', ruim);
    const fixo = fotografia(r);
    recusado({ cores: { escuro: '#14213D' } }, { origem: 'pessoa' }, 'marca: ' + ruim);
    assert.deepStrictEqual(fotografia(r), fixo);
  }
});

t('recusas em palavras da tela: sem o nome interno do papel nem nomes de formato de arquivo', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/fontes/nao-e-letra.png', 'x');
  const mensagem = (valores) => { try { escrever.gravarMarca(r, 'aurora', valores, { origem: 'pessoa', agora: hora(1) }); } catch (e) { return e.message; } return null; };
  const papel = mensagem({ fontes: { titulo: path.join(r, 'empresas', 'aurora', 'fontes', 'Minha-Letra.ttf') } });
  assert.ok(/letra principal, letra dos rótulos e destaque/.test(papel) && !/\bmono\b/.test(papel), papel);
  const letra = mensagem({ fontes: { mono: path.join(r, 'empresas', 'aurora', 'fontes', 'nao-e-letra.png') } });
  assert.ok(/arquivo de letra/.test(letra) && /letra dos rótulos/.test(letra) && !/ttf|otf|\bmono\b/i.test(letra), letra);
  const falta = mensagem({ fontes: { mono: path.join(r, 'empresas', 'aurora', 'fontes', 'Nao-Existe.ttf') } });
  assert.ok(/letra dos rótulos/.test(falta) && !/\bmono\b/.test(falta), falta);
  const logo = mensagem({ logo: path.join(r, 'empresas', 'aurora', 'fontes', 'Minha-Letra.ttf') });
  assert.ok(/imagem/.test(logo) && !/SVG|PNG|JPG|WebP/.test(logo), logo);
});

t('nome: barra invertida e aspas voltam iguais na leitura; no fim do nome, ou com caractere invisível, recusa com a mensagem certa', () => {
  const r = raizDuas();
  const B = String.fromCharCode(92);
  const c = String.fromCharCode;
  esc(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "X"   # comentario\ncores:\n  escuro: "#000001"\n');
  let s = 1;
  for (const nome of ['A' + B + 'b', 'A' + B + '"b', 'A"b # c', 'C:' + B + 'pasta' + B + 'x', "D'Ávila & Cia: 100%"]) {
    escrever.gravarMarca(r, 'aurora', { nome }, { origem: 'pessoa', agora: hora(s++) });
    const texto = ler(r, 'empresas/aurora/marca.yaml').toString('utf8');
    assert.strictEqual(lerYaml(texto).empresa.nome, nome, 'leitura e gravação iguais: ' + JSON.stringify(nome));
    assert.ok(/  nome: .*   # comentario/.test(texto), 'o comentário da linha ficou: ' + JSON.stringify(nome));
  }
  const antes = fotografia(r);
  const casos = [['A' + B, /barra invertida/], ['x' + c(0x2028) + 'y', /invisíve|controle/], ['x' + c(0x85) + 'y', /invisíve|controle/],
    ['x' + c(0x9b) + '31m', /invisíve|controle/], ['x' + c(0x202e) + 'Y', /invisíve|controle/], ['x' + c(0x200b) + 'y', /invisíve|controle/], ['x' + c(0x1b) + '[2J', /invisíve|controle/]];
  for (const [nome, motivo] of casos) {
    assert.throws(() => escrever.gravarMarca(r, 'aurora', { nome }, { origem: 'pessoa', agora: hora(30) }),
      (e) => e.recusaDoPedido === true && motivo.test(e.message) && !/formato que eu não consigo/.test(e.message), JSON.stringify(nome));
  }
  assert.deepStrictEqual(fotografia(r), antes, 'recusado: nada gravado');
});

// Troca de nome que falha (arquivo preso por outro programa): a marca fica como estava e a cópia de histórico
// recém-criada não gasta um passo do "Desfazer".
function comTrocaDeNomeFalhando(alvo, fn) {
  const original = fs.renameSync;
  fs.renameSync = (de, para) => {
    if (path.resolve(para) === path.resolve(alvo)) throw Object.assign(new Error('arquivo preso'), { code: 'EPERM' });
    return original(de, para);
  };
  try { return fn(); } finally { fs.renameSync = original; }
}

t('troca de nome que falha: a marca fica igual, nenhum temporário sobra e o "Desfazer" não perde um passo', () => {
  const r = raizDuas();
  const arq = path.join(r, 'empresas', 'aurora', 'marca.yaml');
  assert.throws(() => comTrocaDeNomeFalhando(arq, () => escrever.gravarMarca(r, 'aurora', { cores: CORES_A }, { origem: 'pessoa', agora: hora(1) })), (e) => e.code === 'EPERM');
  assert.ok(!existe(r, 'empresas/aurora/marca.yaml'));
  assert.throws(() => escrever.desfazerMarca(r, 'aurora', { agora: hora(2) }), (e) => e.recusaDoPedido === true && /nada para desfazer/i.test(e.message));
  esc(r, 'empresas/aurora/marca.yaml', MARCA_RICA);
  const v0 = ler(r, 'empresas/aurora/marca.yaml');
  assert.throws(() => comTrocaDeNomeFalhando(arq, () => escrever.gravarMarca(r, 'aurora', { cores: { escuro: '#111111' } }, { origem: 'pessoa', agora: hora(3) })), (e) => e.code === 'EPERM');
  assert.ok(ler(r, 'empresas/aurora/marca.yaml').equals(v0), 'a marca ficou como estava');
  assert.ok(!fs.readdirSync(path.join(r, 'empresas', 'aurora')).some((n) => n.endsWith('.tmp')), 'nenhum temporário sobrou');
  assert.throws(() => escrever.desfazerMarca(r, 'aurora', { agora: hora(4) }), (e) => e.recusaDoPedido === true && /nada para desfazer/i.test(e.message));
});

// ---------- pasta antiga ----------

t('pasta antiga: caminho relativo à raiz, histórico em empresas/principal/ e nada mais muda', () => {
  const r = novaRaiz();
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', 'empresa:\n  nome: "Padaria de Mentira"\ncores:\n  escuro: "#000001"\n  claro: "#FFFFFE"\n  acento: "#123456"\n  neutro: "#654321"\ntipografia:\n  principal:\n    arquivo: 06-MARCA-E-FOTOS/fontes/Velha.ttf\n  mono:\n    arquivo: 06-MARCA-E-FOTOS/fontes/Velha.ttf\n');
  esc(r, '06-MARCA-E-FOTOS/fontes/Velha.ttf', 'velha');
  esc(r, '06-MARCA-E-FOTOS/fontes/Nova.ttf', 'nova');
  esc(r, `${LAB}/dados/laboratorio.json`, '[{"id":"p1"}]');
  const antes = fotografia(r);
  escrever.gravarMarca(r, 'principal', { fontes: { principal: path.join(r, '06-MARCA-E-FOTOS', 'fontes', 'Nova.ttf'), mono: path.join(FONTES, 'DMMono-Medium.ttf') } }, { origem: 'pessoa', agora: hora(1) });
  const depois = fotografia(r);
  const novos = Object.keys(depois).filter((k) => !(k in antes) && !k.endsWith('/'));
  assert.deepStrictEqual(novos, ['06-MARCA-E-FOTOS/fontes/DMMono-Medium.ttf', '06-MARCA-E-FOTOS/fontes/DMMono-OFL.txt',
    'empresas/principal/historico/marca-2026-11-05-120001Z.copias.json', 'empresas/principal/historico/marca-2026-11-05-120001Z.yaml'], 'a letra da lista vai copiada, com a licença');
  const mudados = Object.keys(antes).filter((k) => depois[k] !== antes[k]);
  assert.deepStrictEqual(mudados, ['06-MARCA-E-FOTOS/marca.yaml']);
  const y = lerYaml(ler(r, '06-MARCA-E-FOTOS/marca.yaml').toString('utf8'));
  assert.strictEqual(y.tipografia.principal.arquivo, '06-MARCA-E-FOTOS/fontes/Nova.ttf', 'relativo à raiz');
  const m = marcaJs(r, null);
  assert.strictEqual(m.fontes.principal, path.join(r, '06-MARCA-E-FOTOS', 'fontes', 'Nova.ttf'));
  assert.strictEqual(y.tipografia.mono.arquivo, '06-MARCA-E-FOTOS/fontes/DMMono-Medium.ttf', 'a cópia, relativa à raiz');
  assert.strictEqual(m.fontes.mono, path.join(r, '06-MARCA-E-FOTOS', 'fontes', 'DMMono-Medium.ttf'));
});

// ---------- a marca que nasce de um estilo ----------

function estiloDeMentira(r, id, tipografia) {
  esc(r, `${LAB}/estilos/${id}/estilo.yaml`, [`id: ${id}`, `nome: Estilo ${id}`, 'sugestao:',
    '  cores: { escuro: "#1B1B2F", claro: "#FAF7F0", acento: "#E43F6F", neutro: "#7D7C84" }', `  tipografia: ${tipografia}`, ''].join('\n'));
}

t('letrasDoEstilo: as famílias do estilo viram arquivos da pasta de letras do modelo; o que não existe fica em "faltando"', () => {
  const r = novaRaiz();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  estiloDeMentira(r, 'teste-dois', '{ principal: "Letra Inventada", mono: "DM Mono", acento: "Outra Inventada" }');
  assert.deepStrictEqual(escrever.letrasDoEstilo('teste-um', { r }), { principal: path.join(FONTES, 'Anton-Regular.ttf'), mono: path.join(FONTES, 'DMMono-Medium.ttf'), acento: null, faltando: [] });
  const dois = escrever.letrasDoEstilo('teste-dois', { r });
  assert.deepStrictEqual([dois.principal, dois.acento, dois.faltando], [null, null, ['Letra Inventada', 'Outra Inventada']]);
  assert.throws(() => escrever.letrasDoEstilo('../x', { r }), (e) => e.recusaDoPedido === true);
  assert.throws(() => escrever.letrasDoEstilo('nao-existe', { r }), (e) => e.recusaDoPedido === true);
});

t('marcaDoEstilo: copia as letras e a licença para a pasta da empresa; rodar de novo não duplica; a marca abre no marca.js', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  const antesBoreal = fotografia(r, (rel) => rel.startsWith('empresas/aurora'));
  const v = escrever.marcaDoEstilo(r, 'aurora', 'teste-um');
  const dest = (n) => path.join(r, 'empresas', 'aurora', 'fontes', n);
  assert.deepStrictEqual(v, {
    cores: { escuro: '#1B1B2F', claro: '#FAF7F0', acento: '#E43F6F', neutro: '#7D7C84' },
    fontes: { principal: dest('Anton-Regular.ttf'), mono: dest('DMMono-Medium.ttf'), acento: '' },
    origem: 'estilo:teste-um',
  });
  for (const [n, orig] of [['Anton-Regular.ttf', 'Anton-Regular.ttf'], ['Anton-OFL.txt', 'Anton-OFL.txt'], ['DMMono-Medium.ttf', 'DMMono-Medium.ttf'], ['DMMono-OFL.txt', 'DMMono-OFL.txt']]) {
    assert.ok(fs.readFileSync(dest(n)).equals(fs.readFileSync(path.join(FONTES, orig))), 'cópia fiel: ' + n);
  }
  const depoisDaPrimeira = fotografia(r);
  assert.deepStrictEqual(escrever.marcaDoEstilo(r, 'aurora', 'teste-um'), v);
  assert.deepStrictEqual(fotografia(r), depoisDaPrimeira, 'rodar de novo não copia nada');
  escrever.gravarMarca(r, 'aurora', v, { agora: hora(1) });
  const m = marcaJs(r, 'aurora');
  assert.deepStrictEqual(m.cores, v.cores);
  assert.strictEqual(m.origem, 'estilo:teste-um');
  assert.strictEqual(m.fontes.principal, dest('Anton-Regular.ttf'), 'a letra da marca é a cópia da empresa');
  assert.strictEqual(m.fontes.acento, null, 'o estilo sem terceira voz deixa a marca com duas');
  assert.deepStrictEqual(fotografia(r, (rel) => rel.startsWith('empresas/aurora')), antesBoreal, 'nada fora de aurora mudou');
});

t('marcaDoEstilo: arquivo diferente com o mesmo nome nunca é sobrescrito; família que falta recusa sem copiar nada', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  estiloDeMentira(r, 'teste-dois', '{ principal: "Letra Inventada", mono: "DM Mono", acento: "" }');
  esc(r, 'empresas/aurora/fontes/Anton-Regular.ttf', 'outra letra com o mesmo nome');
  const v = escrever.marcaDoEstilo(r, 'aurora', 'teste-um');
  assert.strictEqual(v.fontes.principal, path.join(r, 'empresas', 'aurora', 'fontes', 'Anton-Regular-2.ttf'));
  assert.strictEqual(ler(r, 'empresas/aurora/fontes/Anton-Regular.ttf').toString(), 'outra letra com o mesmo nome');
  const antes = fotografia(r);
  assert.throws(() => escrever.marcaDoEstilo(r, 'boreal', 'teste-dois'), (e) => e.recusaDoPedido === true && /Letra Inventada/.test(e.message));
  assert.throws(() => escrever.marcaDoEstilo(r, 'boreal', '../teste-um'), (e) => e.recusaDoPedido === true);
  assert.deepStrictEqual(fotografia(r), antes);
});

t('marca do estilo recusada na gravação: as letras copiadas agora saem, e o que já estava na pasta fica', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  esc(r, 'empresas/aurora/fontes/DMMono-Medium.ttf', fs.readFileSync(path.join(FONTES, 'DMMono-Medium.ttf'))); // igual: já estava
  esc(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "A"\n    torto: x\n'); // ilegível: a gravação vai recusar
  const antes = fotografia(r);
  assert.throws(() => escrever.gravarDoEstilo(r, 'aurora', 'teste-um', { agora: hora(1) }), (e) => e.recusaDoPedido === true);
  assert.deepStrictEqual(fotografia(r), antes, 'as cópias novas saíram e a letra que já estava ficou');
  const x = cli(r, ['do-estilo', 'aurora', 'teste-um']);
  assert.strictEqual(x.status, 1, x.erro);
  assert.deepStrictEqual(fotografia(r), antes, 'pela linha de comando também');
  // aceita a gravação, as letras ficam
  fs.rmSync(path.join(r, 'empresas', 'aurora', 'marca.yaml'));
  escrever.gravarDoEstilo(r, 'aurora', 'teste-um', { agora: hora(2) });
  for (const n of ['Anton-Regular.ttf', 'Anton-OFL.txt', 'DMMono-Medium.ttf', 'DMMono-OFL.txt']) assert.ok(existe(r, `empresas/aurora/fontes/${n}`), n);
  assert.strictEqual(marcaJs(r, 'aurora').origem, 'estilo:teste-um');
});

t('marca nascida do estilo: o Desfazer tira as letras que ela copiou; as que já estavam na pasta ficam', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  esc(r, 'empresas/aurora/fontes/DMMono-Medium.ttf', fs.readFileSync(path.join(FONTES, 'DMMono-Medium.ttf'))); // igual: já estava
  const letras = () => (existe(r, 'empresas/aurora/fontes') ? fs.readdirSync(path.join(r, 'empresas', 'aurora', 'fontes')).sort() : []);
  const antes = fotografia(r);
  const jaEstavam = letras();
  assert.deepStrictEqual(jaEstavam, ['DMMono-Medium.ttf', 'Minha-Letra.ttf']);
  const { criados } = escrever.gravarDoEstilo(r, 'aurora', 'teste-um', { agora: hora(1) });
  assert.deepStrictEqual(letras(), ['Anton-OFL.txt', 'Anton-Regular.ttf', 'DMMono-Medium.ttf', 'DMMono-OFL.txt', 'Minha-Letra.ttf']);
  assert.ok(criados.arquivos.length === 3, 'quem chama continua recebendo a lista do que foi copiado (para voltar atrás depois)');
  escrever.desfazerMarca(r, 'aurora', { agora: hora(2) });
  assert.ok(!existe(r, 'empresas/aurora/marca.yaml'), 'voltou a ficar sem marca');
  assert.deepStrictEqual(letras(), jaEstavam, 'saíram só as cópias novas (a letra que já estava ficou)');
  const depois = fotografia(r);
  assert.deepStrictEqual(Object.keys(depois).filter((k) => !(k in antes) && !k.startsWith('empresas/aurora/historico')), [], 'nada mais sobrou fora do histórico');
  // pela linha de comando (o agente) também
  const x = cli(r, ['do-estilo', 'aurora', 'teste-um']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.ok(existe(r, 'empresas/aurora/fontes/Anton-Regular.ttf'));
  const y = cli(r, ['desfazer', 'aurora']);
  assert.strictEqual(y.status, 0, y.erro);
  assert.deepStrictEqual(letras(), jaEstavam);
});

// ---------- a letra escolhida da lista de letras ----------

const igualAoModelo = (r, rel, nome) => ler(r, rel).equals(fs.readFileSync(path.join(FONTES, nome)));

t('letra da lista: copiada para a pasta da empresa com a licença; a marca aponta para a cópia, não para o modelo', () => {
  const r = raizDuas();
  const foraDeAurora = fotografia(r, (rel) => rel.startsWith('empresas/aurora'));
  escrever.gravarMarca(r, 'aurora', { cores: CORES_A, fontes: { principal: path.join(FONTES, 'Anton-Regular.ttf'), mono: path.join(FONTES, 'DMMono-Medium.ttf') } }, { origem: 'pessoa', agora: hora(1) });
  for (const n of ['Anton-Regular.ttf', 'Anton-OFL.txt', 'DMMono-Medium.ttf', 'DMMono-OFL.txt']) assert.ok(igualAoModelo(r, `empresas/aurora/fontes/${n}`, n), 'cópia fiel: ' + n);
  const y = lerYaml(ler(r, 'empresas/aurora/marca.yaml').toString('utf8').replace(BOM_INICIO, ''));
  assert.deepStrictEqual([y.tipografia.principal.arquivo, y.tipografia.mono.arquivo], ['fontes/Anton-Regular.ttf', 'fontes/DMMono-Medium.ttf']);
  // a marca não depende do arquivo do modelo: o marca.js acha a cópia da empresa (o modelo pode trocar ou tirar a dele)
  const m = marcaJs(r, 'aurora');
  assert.strictEqual(m.fontes.principal, path.join(r, 'empresas', 'aurora', 'fontes', 'Anton-Regular.ttf'));
  assert.strictEqual(m.fontes.mono, path.join(r, 'empresas', 'aurora', 'fontes', 'DMMono-Medium.ttf'));
  assert.deepStrictEqual(fotografia(r, (rel) => rel.startsWith('empresas/aurora')), foraDeAurora, 'nada fora de aurora mudou');
  // a família com vários arquivos: o arquivo escolhido e a licença da família
  escrever.gravarMarca(r, 'aurora', { fontes: { acento: path.join(FONTES, 'CormorantGaramond-MediumItalic.ttf') } }, { origem: 'pessoa', agora: hora(2) });
  for (const n of ['CormorantGaramond-MediumItalic.ttf', 'CormorantGaramond-OFL.txt']) assert.ok(igualAoModelo(r, `empresas/aurora/fontes/${n}`, n), n);
  assert.ok(!existe(r, 'empresas/aurora/fontes/CormorantGaramond-Medium.ttf'), 'só o arquivo escolhido');
});

t('letra da lista: desfazer a gravação tira as cópias que ela fez; a letra que a marca de volta usa e a que já estava ficam', () => {
  const r = raizDuas();
  const minha = path.join(r, 'empresas', 'aurora', 'fontes', 'Minha-Letra.ttf');
  escrever.gravarMarca(r, 'aurora', { cores: CORES_A, fontes: { principal: path.join(FONTES, 'Anton-Regular.ttf'), mono: minha } }, { origem: 'pessoa', agora: hora(1) });
  escrever.gravarMarca(r, 'aurora', { fontes: { mono: path.join(FONTES, 'DMMono-Medium.ttf') } }, { origem: 'pessoa', agora: hora(2) });
  // a mesma letra da lista de novo: a cópia que já está é reaproveitada (nada novo a tirar no desfazer)
  escrever.gravarMarca(r, 'aurora', { fontes: { principal: path.join(FONTES, 'Anton-Regular.ttf') }, cores: { escuro: '#111111' } }, { origem: 'pessoa', agora: hora(3) });
  const letras = () => fs.readdirSync(path.join(r, 'empresas', 'aurora', 'fontes')).sort();
  const todas = ['Anton-OFL.txt', 'Anton-Regular.ttf', 'DMMono-Medium.ttf', 'DMMono-OFL.txt', 'Minha-Letra.ttf'];
  assert.deepStrictEqual(letras(), todas);
  escrever.desfazerMarca(r, 'aurora', { agora: hora(4) });
  assert.deepStrictEqual(letras(), todas, 'a terceira gravação não copiou nada');
  escrever.desfazerMarca(r, 'aurora', { agora: hora(5) });
  assert.deepStrictEqual(letras(), ['Anton-OFL.txt', 'Anton-Regular.ttf', 'Minha-Letra.ttf'], 'a cópia da segunda gravação saiu');
  assert.strictEqual(marcaJs(r, 'aurora').fontes.principal, path.join(r, 'empresas', 'aurora', 'fontes', 'Anton-Regular.ttf'), 'a marca de volta acha a letra dela');
  escrever.desfazerMarca(r, 'aurora', { agora: hora(6) });
  assert.ok(!existe(r, 'empresas/aurora/marca.yaml'));
  assert.deepStrictEqual(letras(), ['Minha-Letra.ttf'], 'a letra que já estava na pasta fica');
  assert.ok(historico(r, 'aurora').filter((n) => n.endsWith('.yaml')).length >= 6, 'o histórico não perde nada');
});

t('letra da lista com a gravação recusada (ou a troca de nome falhando): a cópia sai e nada muda', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', MARCA_RICA);
  const antes = fotografia(r);
  const lista = { principal: path.join(FONTES, 'Anton-Regular.ttf') };
  assert.throws(() => escrever.gravarMarca(r, 'aurora', { fontes: lista, logo: path.join(r, 'empresas', 'boreal', 'logo', 'logo-1.png') }, { origem: 'pessoa', agora: hora(1) }), (e) => e.recusaDoPedido === true);
  assert.throws(() => escrever.gravarMarca(r, 'aurora', { fontes: lista }, { origem: 'internet', agora: hora(1) }), (e) => e.recusaDoPedido === true);
  assert.deepStrictEqual(fotografia(r), antes, 'recusado: nenhuma cópia ficou');
  const arq = path.join(r, 'empresas', 'aurora', 'marca.yaml');
  assert.throws(() => comTrocaDeNomeFalhando(arq, () => escrever.gravarMarca(r, 'aurora', { fontes: lista }, { origem: 'pessoa', agora: hora(2) })), (e) => e.code === 'EPERM');
  const depois = fotografia(r);
  assert.deepStrictEqual(Object.keys(depois).filter((k) => !(k in antes) && !k.startsWith('empresas/aurora/historico')), [], 'a troca de nome falhou: nenhuma cópia ficou');
  // pela linha de comando (o agente), a letra da lista também é copiada
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ fontes: { mono: path.join(FONTES, 'DMMono-Medium.ttf') } }));
  const x = cli(r, ['gravar', 'aurora', valores, '--origem', 'do-zero']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.ok(igualAoModelo(r, 'empresas/aurora/fontes/DMMono-Medium.ttf', 'DMMono-Medium.ttf'));
  assert.strictEqual(lerYaml(ler(r, 'empresas/aurora/marca.yaml').toString('utf8').replace(BOM_INICIO, '')).tipografia.mono.arquivo, 'fontes/DMMono-Medium.ttf');
});

// ---------- o catálogo de verdade e a lista de letras ----------

t('catálogo real: nos 27 estilos, principal e mono resolvem para um arquivo que existe', () => {
  const dir = path.join(RAIZ_REAL, LAB, 'estilos');
  const ids = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'estilo.yaml'))).map((e) => e.name);
  assert.strictEqual(ids.length, 27);
  const faltando = new Set();
  for (const id of ids) {
    const l = escrever.letrasDoEstilo(id);
    for (const f of l.faltando) faltando.add(f);
    for (const p of ['principal', 'mono']) assert.ok(l[p] && fs.existsSync(l[p]), `${id}: ${p}`);
    const y = lerYaml(fs.readFileSync(path.join(dir, id, 'estilo.yaml'), 'utf8'));
    if (y.sugestao.tipografia.acento) assert.ok(l.acento && fs.existsSync(l.acento), `${id}: acento`);
    else assert.strictEqual(l.acento, null, `${id}: sem acento`);
  }
  assert.deepStrictEqual([...faltando], [], 'famílias que faltam na pasta de letras do modelo');
});

t('familias.json: cita só arquivos que existem, toda letra da pasta tem entrada e toda família tem a licença', () => {
  const j = JSON.parse(fs.readFileSync(path.join(FONTES, 'familias.json'), 'utf8'));
  assert.ok(Array.isArray(j.familias) && j.familias.length > 0);
  const citados = new Set();
  for (const f of j.familias) {
    assert.ok(typeof f.familia === 'string' && f.familia, JSON.stringify(f));
    assert.ok(f.arquivos.includes(f.arquivo), f.familia);
    for (const a of [...f.arquivos, f.licenca]) assert.ok(fs.existsSync(path.join(FONTES, a)), `${f.familia}: ${a}`);
    for (const a of f.arquivos) { assert.ok(!citados.has(a), 'arquivo em duas famílias: ' + a); citados.add(a); }
    assert.ok(['com serifa', 'sem serifa', 'máquina de escrever', 'manuscrita'].includes(f.classificacao), f.familia);
    assert.strictEqual(typeof f.italico, 'boolean');
    assert.ok(Array.isArray(f.pesos) && f.pesos.length && f.pesos.every((p) => Number.isInteger(p) && p >= 100 && p <= 900), f.familia);
    assert.ok(/Open Font License/.test(fs.readFileSync(path.join(FONTES, f.licenca), 'utf8')), f.familia + ': licença OFL');
  }
  const naPasta = fs.readdirSync(FONTES).filter((n) => /\.(ttf|otf)$/i.test(n));
  assert.deepStrictEqual(naPasta.filter((n) => !citados.has(n)), [], 'letras da pasta sem entrada');
});

// ---------- linha de comando (o agente) ----------

// O teste nunca sobe um trabalhador de verdade: gravar, desfazer e do-estilo vão sempre com --sem-trabalhador (só a lista das
// prévias é pedida). A opção é da linha de comando, visível em cada chamada; nenhuma variável de ambiente desliga o trabalhador.
const COMANDOS_COM_PREVIAS = ['gravar', 'desfazer', 'do-estilo'];
function cli(r, args) {
  const env = { ...process.env, FABRICA_RAIZ: r, FABRICA_SILENCIO_EXEMPLO: '1' };
  delete env.FABRICA_EMPRESA;
  delete env.FABRICA_MARCA;
  delete env.FABRICA_SEM_TRABALHADOR;
  const comOpcao = COMANDOS_COM_PREVIAS.includes(args[0]) ? [...args, '--sem-trabalhador'] : args;
  const x = spawnSync(process.execPath, [SCRIPT, ...comOpcao], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}

t('linha de comando: gravar, desfazer e do-estilo; 0 = ok, 1 = recusa, 2 = uso', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ cores: CORES_A }));
  let x = cli(r, ['gravar', 'aurora', valores, '--origem', 'do-zero']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.strictEqual(marcaJs(r, 'aurora').origem, 'do-zero');
  x = cli(r, ['do-estilo', 'boreal', 'teste-um']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.strictEqual(marcaJs(r, 'boreal').origem, 'estilo:teste-um');
  x = cli(r, ['desfazer', 'aurora']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.ok(!existe(r, 'empresas/aurora/marca.yaml'));
  const antes = fotografia(r);
  const ruim = esc(r, 'trabalho/ruim.json', JSON.stringify({ cores: { escuro: 'azul' } }));
  const quebrado = esc(r, 'trabalho/quebrado.json', '{ cores');
  for (const args of [['gravar', 'aurora', ruim, '--origem', 'pessoa'], ['desfazer', 'aurora'], ['do-estilo', 'aurora', 'nao-existe'], ['gravar', 'nao-existe', valores, '--origem', 'pessoa'], ['gravar', 'aurora', quebrado, '--origem', 'pessoa']]) {
    x = cli(r, args);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + x.erro);
    assert.ok(x.erro.length > 10 && !/at .*\.js:\d+/.test(x.erro), 'mensagem sem pilha: ' + x.erro);
  }
  for (const args of [[], ['inventado'], ['gravar', 'aurora'], ['gravar', 'aurora', valores], ['gravar', 'aurora', valores, '--origem'], ['desfazer'], ['do-estilo', 'aurora'], ['desfazer', 'aurora', 'sobra']]) {
    x = cli(r, args);
    assert.strictEqual(x.status, 2, args.join(' ') + ': ' + x.erro);
  }
  const depois = fotografia(r);
  for (const k of Object.keys(antes)) assert.strictEqual(depois[k], antes[k], 'nada gravado: ' + k);
});

// A linha de comando (o agente) também pede as prévias na marca, pelo mesmo gatilho do painel, e lança o trabalhador (de mentira aqui).
const arqFilaDe = (r, c) => path.join(r, 'empresas', c, 'previas', 'fila.json');
function principalCom(r, args, lancar) {
  const antes = process.env.FABRICA_RAIZ;
  const log = console.log;
  const err = console.error;
  const saida = [];
  process.env.FABRICA_RAIZ = r;
  console.log = (...a) => { saida.push(a.join(' ')); };
  console.error = () => {};
  try { return { codigo: escrever.principal(args, { lancar }), saida }; } finally {
    console.log = log; console.error = err;
    if (antes === undefined) delete process.env.FABRICA_RAIZ; else process.env.FABRICA_RAIZ = antes;
  }
}
t('linha de comando: gravar pede as prévias e lança o trabalhador uma vez; desfazer que deixa sem marca não pede nada; nunca a outra empresa', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }'); // com estilos na grade há o que fazer
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ cores: CORES_A }));
  const lancados = [];
  const lancar = (p) => { lancados.push(p); return process.pid; };
  let x = principalCom(r, ['gravar', 'aurora', valores, '--origem', 'do-zero'], lancar);
  assert.strictEqual(x.codigo, 0);
  assert.ok(fs.existsSync(arqFilaDe(r, 'aurora')), 'a lista das prévias nasceu');
  assert.ok(!fs.existsSync(arqFilaDe(r, 'boreal')), 'nada para a outra empresa');
  assert.strictEqual(lancados.length, 1, 'o trabalhador foi lançado uma vez');
  assert.strictEqual(lancados[0].raiz, path.resolve(r));
  assert.strictEqual(lancados[0].args[1], 'rodar');
  x = principalCom(r, ['desfazer', 'aurora'], lancar);
  assert.strictEqual(x.codigo, 0);
  assert.ok(!existe(r, 'empresas/aurora/marca.yaml'));
  assert.strictEqual(lancados.length, 1, 'sem marca: nada lançado de novo');
});
t('linha de comando: falha ao pedir as prévias não muda a saída nem desfaz a marca, e avisa em português simples', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ cores: CORES_A }));
  const x = principalCom(r, ['gravar', 'aurora', valores, '--origem', 'do-zero'], () => { throw new Error('lançador de mentira falhou'); });
  assert.strictEqual(x.codigo, 0, 'a saída de gravar é a de sempre');
  assert.ok(existe(r, 'empresas/aurora/marca.yaml'), 'a marca ficou gravada');
  assert.ok(x.saida.includes('As prévias na sua marca vão demorar um pouco mais.'), x.saida.join('|'));
});
const DEMORA = 'As prévias na sua marca vão demorar um pouco mais.';
t('linha de comando: --sem-trabalhador só pede a lista, sem lançar ninguém, e avisa que as prévias vão demorar', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }'); // com estilos na grade, sem a opção, haveria lançamento
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ cores: CORES_A }));
  const lancados = [];
  const lancar = (p) => { lancados.push(p); return process.pid; };
  for (const args of [['gravar', 'aurora', valores, '--origem', 'do-zero', '--sem-trabalhador'], ['do-estilo', 'boreal', 'teste-um', '--sem-trabalhador']]) {
    const x = principalCom(r, args, lancar);
    assert.strictEqual(x.codigo, 0, args.join(' '));
    assert.ok(x.saida.includes(DEMORA), 'avisa: ' + x.saida.join('|'));
  }
  assert.ok(fs.existsSync(arqFilaDe(r, 'aurora')) && fs.existsSync(arqFilaDe(r, 'boreal')), 'as listas das prévias nasceram');
  assert.strictEqual(lancados.length, 0, 'ninguém foi lançado');
  // sem a opção, o mesmo pedido lança (a opção é que segura)
  const x = principalCom(r, ['gravar', 'aurora', valores, '--origem', 'pessoa'], lancar);
  assert.strictEqual(x.codigo, 0);
  assert.strictEqual(lancados.length, 1, 'sem a opção, lança');
  assert.ok(!x.saida.includes(DEMORA), 'sem a opção, nenhum aviso de demora');
});
t('linha de comando: a variável de ambiente antiga não desliga mais o trabalhador em silêncio', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }');
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ cores: CORES_A }));
  const lancados = [];
  const antes = process.env.FABRICA_SEM_TRABALHADOR;
  process.env.FABRICA_SEM_TRABALHADOR = '1';
  try {
    const x = principalCom(r, ['gravar', 'aurora', valores, '--origem', 'do-zero'], (p) => { lancados.push(p); return process.pid; });
    assert.strictEqual(x.codigo, 0);
  } finally { if (antes === undefined) delete process.env.FABRICA_SEM_TRABALHADOR; else process.env.FABRICA_SEM_TRABALHADOR = antes; }
  assert.strictEqual(lancados.length, 1, 'a variável não tem efeito');
});
t('linha de comando, de verdade (processo filho, com um estilo de mentira): --sem-trabalhador só pede a lista, sem lançar ninguém', () => {
  const r = raizDuas();
  estiloDeMentira(r, 'teste-um', '{ principal: "Anton", mono: "DM Mono", acento: "" }'); // sem a opção, um trabalhador nasceria
  const valores = esc(r, 'trabalho/valores.json', JSON.stringify({ cores: CORES_A }));
  const x = cli(r, ['gravar', 'aurora', valores, '--origem', 'do-zero']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.ok(fs.existsSync(arqFilaDe(r, 'aurora')));
  const fila = JSON.parse(fs.readFileSync(arqFilaDe(r, 'aurora'), 'utf8'));
  assert.ok(JSON.stringify(fila).includes('teste-um'), 'a lista tem o estilo de mentira (havia trabalho a fazer)');
  assert.ok(!existe(r, 'empresas/.fila-previas.json'), 'nenhum trabalhador registrado');
  assert.ok(x.saida.includes(DEMORA), 'avisa que as prévias vão demorar: ' + x.saida);
  // a opção repetida é uso errado, e nada é desfeito (o cli() já acrescenta uma)
  const repetida = cli(r, ['desfazer', 'aurora', '--sem-trabalhador']);
  assert.strictEqual(repetida.status, 2, repetida.erro);
  assert.ok(/mais de uma vez/.test(repetida.erro), repetida.erro);
  assert.ok(existe(r, 'empresas/aurora/marca.yaml'), 'a marca continua gravada');
});

// ---------- execução ----------

(async () => {
  for (const c of casos) {
    try { await c.fn(); console.log('ok   ' + c.nome); } catch (e) { falhas++; console.log('FALHOU ' + c.nome + '\n     ' + (e.stack || e)); }
  }
  for (const r of pastas) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch { /* o sistema limpa a pasta temporária depois */ }
  }
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log(`\n${casos.length} testes passaram`);
  process.exit(0);
})();
