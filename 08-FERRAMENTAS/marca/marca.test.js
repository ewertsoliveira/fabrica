#!/usr/bin/env node
// Testes do leitor do contrato de marca. Rode: node 08-FERRAMENTAS/marca/marca.test.js
// Cada caso foi calibrado para reprovar (G-13): herança aberta demais faria o caso "identidade nunca herda" falhar.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const empresa = require('../../_fabrica/core/empresa');

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };
const LEITOR = path.join(__dirname, 'marca.js');

// Roda um trecho num processo separado, com o contrato apontado por FABRICA_MARCA (o leitor carrega uma vez por processo).
function comMarca(yaml, codigo) {
  const env = { ...process.env, FABRICA_SILENCIO_EXEMPLO: '1' };
  if (yaml !== null) {
    const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'marca-')), 'marca.yaml');
    fs.writeFileSync(arq, yaml);
    env.FABRICA_MARCA = arq;
  } else delete env.FABRICA_MARCA;
  return JSON.parse(execFileSync(process.execPath, ['-e',
    `const m=require(${JSON.stringify(LEITOR)});process.stdout.write(JSON.stringify((${codigo})(m)))`], { env }).toString());
}

// comRaiz roda um trecho com uma raiz de dados temporária (FABRICA_RAIZ), sem FABRICA_MARCA nem FABRICA_EMPRESA.
// `montar(raiz)` cria o que o caso precisa (empresas/, 06-MARCA-E-FOTOS/). O código continua sendo o da matriz.
// Com `extraEnv`, acrescenta variáveis ao processo filho. Devolve o resultado JSON do trecho.
function preparaRaiz(montar) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'marca-raiz-'));
  montar(raiz);
  return raiz;
}
function envDaRaiz(raiz, extraEnv = {}) {
  const env = { ...process.env, FABRICA_SILENCIO_EXEMPLO: '1', FABRICA_RAIZ: raiz, ...extraEnv };
  delete env.FABRICA_EMPRESA;
  if (!('FABRICA_MARCA' in extraEnv)) delete env.FABRICA_MARCA;
  return env;
}
function comRaiz(montar, codigo, extraEnv = {}) {
  const raiz = preparaRaiz(montar);
  return JSON.parse(execFileSync(process.execPath, ['-e',
    `const m=require(${JSON.stringify(LEITOR)});process.stdout.write(JSON.stringify((${codigo})(m)))`],
  { env: envDaRaiz(raiz, extraEnv) }).toString());
}
// Igual a comRaiz, mas espera o processo falhar e devolve { status, erro }.
function comRaizFalha(montar, codigo = '(m)=>m.EMPRESA') {
  const raiz = preparaRaiz(montar);
  const x = spawnSync(process.execPath, ['-e',
    `const m=require(${JSON.stringify(LEITOR)});process.stdout.write(JSON.stringify((${codigo})(m)))`],
  { env: envDaRaiz(raiz), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, erro: x.stderr };
}
// Roda o leitor com o aviso do exemplo ligado (sem FABRICA_SILENCIO_EXEMPLO) e devolve o stderr.
function avisoDaRaiz(montar) {
  const raiz = preparaRaiz(montar);
  const env = envDaRaiz(raiz);
  delete env.FABRICA_SILENCIO_EXEMPLO; // o processo deste teste já a definiu ao carregar o leitor; o filho precisa avisar
  const x = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(LEITOR)})`],
    { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  assert.strictEqual(x.status, 0, x.stderr);
  return x.stderr;
}
function escrever(raiz, rel, texto) {
  const arq = path.join(raiz, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto, 'utf8');
}
const marcaComAcento = (nome, acento) => `empresa:\n  nome: "${nome}"\ncores:\n  escuro: "#111111"\n  claro: "#EEEEEE"\n  acento: "${acento}"\n  neutro: "#777777"\n`;
// Raiz com a Aurora (gaveta) criada pelo leitor de empresas; `ativar` escolhe a empresa ativa.
function comAurora(raiz, { ativar = true, legado = false } = {}) {
  if (legado) escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300'));
  empresa.criar('aurora', 'Aurora', raiz);
  escrever(raiz, 'empresas/aurora/marca.yaml', marcaComAcento('Aurora', '#2FB59A'));
  if (ativar) empresa.ativar('aurora', raiz);
}

const ANTIGA = `empresa:\n  nome: "Antiga"\ncores:\n  escuro: "#111111"\n  claro: "#EEEEEE"\n  acento: "#CC3300"\n  neutro: "#777777"\n` +
  `tipografia:\n  principal:\n    arquivo: x.ttf\n  mono:\n    arquivo: y.ttf\n`;

const { lerYaml } = require(LEITOR);

t('mapa em linha, com lista e mapa aninhados e vírgula entre aspas', () => {
  assert.deepStrictEqual(lerYaml('a: { b: [1, 2], c: { d: "x, y" } }').a, { b: [1, 2], c: { d: 'x, y' } });
});
t('item de mapa em linha sem dois-pontos reprova', () => {
  assert.throws(() => lerYaml('a: { b }'), /chave: valor/);
});
t('o exemplo traz o padrão de primeiro uso', () => {
  const r = comMarca(null, `(m)=>[m.pega('canvas.feed'),m.pega('pecas.logo-aparece-em'),m.herdados()]`);
  assert.deepStrictEqual(r, [{ largura: 1080, altura: 1350 }, ['capa', 'fecho'], []]);
});
t('marca antiga herda os campos novos e registra quais', () => {
  const r = comMarca(ANTIGA, `(m)=>[m.pega('canvas.pisos.corpo'),m.pega('cta.instagram'),m.herdados().sort()]`);
  assert.deepStrictEqual(r, [44, 'fale com a gente no direct', ['canvas.pisos.corpo', 'cta.instagram']]);
});
t('identidade nunca herda do exemplo (conta, logo, vídeo, fonte principal)', () => {
  const r = comMarca(ANTIGA, `(m)=>[m.handle,m.pega('pecas.logo')??null,m.pega('video.cta.botao')??null,` +
    `m.pega('tipografia.principal.largura-titulo')??null,m.herdados()]`);
  assert.deepStrictEqual(r, ['', null, null, null, []]);
});
t('valor da própria marca vence o padrão', () => {
  const r = comMarca(ANTIGA + 'canvas:\n  pisos: { corpo: 50 }\n', `(m)=>[m.pega('canvas.pisos.corpo'),m.herdados()]`);
  assert.deepStrictEqual(r, [50, []]);
});

// ---------- a marca vem da empresa ativa ----------
t('marca da gaveta ativa', () => {
  const r = comRaiz((raiz) => comAurora(raiz), `(m)=>[m.hex('acento'),m.EMPRESA,m.PASTA.split('\\\\').join('/')]`);
  assert.strictEqual(r[0], '#2FB59A');
  assert.strictEqual(r[1], 'aurora');
  assert.ok(r[2].endsWith('empresas/aurora'), r[2]);
});
t('uma empresa só, sem ativa.json: a única é a ativa', () => {
  const r = comRaiz((raiz) => comAurora(raiz, { ativar: false }), `(m)=>[m.hex('acento'),m.EMPRESA]`);
  assert.deepStrictEqual(r, ['#2FB59A', 'aurora']);
});
t('legado continua', () => {
  const r = comRaiz((raiz) => escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300')),
    `(m)=>[m.hex('acento'),m.EMPRESA,m.PASTA.split('\\\\').join('/')]`);
  assert.strictEqual(r[0], '#CC3300');
  assert.strictEqual(r[1], 'principal');
  assert.ok(r[2].endsWith('06-MARCA-E-FOTOS'), r[2]);
});
t('legado com segunda empresa criada e ativa principal: continua a marca antiga', () => {
  const r = comRaiz((raiz) => { comAurora(raiz, { legado: true, ativar: false }); empresa.ativar('principal', raiz); },
    `(m)=>[m.hex('acento'),m.EMPRESA]`);
  assert.deepStrictEqual(r, ['#CC3300', 'principal']);
});
t('sem nada: marca de exemplo, sem empresa', () => {
  const r = comRaiz(() => {}, `(m)=>[m.EXEMPLO,m.EMPRESA,m.PASTA.split('\\\\').join('/')]`);
  assert.strictEqual(r[0], true);
  assert.strictEqual(r[1], null);
  assert.ok(r[2].endsWith('06-MARCA-E-FOTOS'), r[2]);
});
t('legado sem marca.yaml (só o perfil configurado): segue para o exemplo', () => {
  const r = comRaiz((raiz) => escrever(raiz, '_fabrica/_memoria/empresa.md', '# Perfil\n\n**Nome:** Empresa Antiga\n'),
    `(m)=>[m.EXEMPLO,m.EMPRESA]`);
  assert.deepStrictEqual(r, [true, null]);
});
t('duas sem escolha para', () => {
  const x = comRaizFalha((raiz) => comAurora(raiz, { legado: true, ativar: false }));
  assert.notStrictEqual(x.status, 0);
  assert.match(x.erro, /nenhuma está escolhida/);
  assert.match(x.erro, /empresa\.js ativar <codigo>/);
});
t('empresa ativa que não existe: para, sem cair em outra', () => {
  const x = comRaizFalha((raiz) => { comAurora(raiz, { legado: true }); escrever(raiz, 'empresas/ativa.json', '{ "empresa": "aurroa" }'); });
  assert.notStrictEqual(x.status, 0);
  assert.match(x.erro, /aurroa/);
  assert.match(x.erro, /não existe/);
});
t('índice de empresas quebrado: para com a mensagem do arquivo, sem cair no exemplo', () => {
  const x = comRaizFalha((raiz) => escrever(raiz, 'empresas/indice.json', '{ "empresas": [ , ] '));
  assert.notStrictEqual(x.status, 0);
  assert.match(x.erro, /indice\.json/);
});
t('índice com entrada inválida (aurora sem disposição): para com a mensagem do arquivo, sem cair na marca antiga', () => {
  const x = comRaizFalha((raiz) => {
    comAurora(raiz, { legado: true });
    const arq = path.join(raiz, 'empresas', 'indice.json');
    const indice = JSON.parse(fs.readFileSync(arq, 'utf8'));
    delete indice.empresas.find((e) => e.codigo === 'aurora').disposicao;
    fs.writeFileSync(arq, JSON.stringify(indice));
  }, `(m)=>m.hex('acento')`);
  assert.notStrictEqual(x.status, 0, 'o marca.js devia parar; carregou a marca de outra empresa');
  assert.match(x.erro, /indice\.json/);
  assert.match(x.erro, /aurora/);
});
t('caminho relativo à gaveta', () => {
  const r = comRaiz((raiz) => { comAurora(raiz); escrever(raiz, 'empresas/aurora/fontes/x.ttf', 'x'); },
    `(m)=>[m.caminho('fontes/x.ttf'),m.caminho('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf'),m.caminho('fontes/nao-existe.ttf'),m.caminho(${JSON.stringify(__filename)}),m.RAIZ]`);
  const barras = (p) => p.split('\\').join('/');
  assert.ok(barras(r[0]).endsWith('empresas/aurora/fontes/x.ttf'), r[0]);
  assert.strictEqual(r[1], path.join(r[4], '06-MARCA-E-FOTOS', 'exemplo', 'fontes', 'Fraunces.ttf'));
  assert.ok(barras(r[2]).endsWith('empresas/aurora/fontes/nao-existe.ttf'), r[2]);
  assert.strictEqual(r[3], __filename);
});
t('caminho relativo na gaveta: arquivo só na raiz dos dados não vale, vale o caminho da gaveta', () => {
  const r = comRaiz((raiz) => { comAurora(raiz); escrever(raiz, 'pecas/y.png', 'y'); },
    `(m)=>m.caminho('pecas/y.png')`);
  assert.ok(r.split('\\').join('/').endsWith('empresas/aurora/pecas/y.png'), r);
});
t('caminho 06-MARCA-E-FOTOS/... na gaveta nunca devolve o arquivo da empresa antiga; o exemplo cai na raiz do código', () => {
  const r = comRaiz((raiz) => {
    comAurora(raiz, { legado: true });
    escrever(raiz, '06-MARCA-E-FOTOS/fontes/x.ttf', 'da empresa antiga');
    escrever(raiz, '06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf', 'copia na raiz dos dados');
  }, `(m)=>[m.caminho('06-MARCA-E-FOTOS/fontes/x.ttf'),m.caminho('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf'),m.RAIZ]`);
  assert.ok(r[0].split('\\').join('/').endsWith('empresas/aurora/06-MARCA-E-FOTOS/fontes/x.ttf'), r[0]);
  assert.strictEqual(r[1], path.join(r[2], '06-MARCA-E-FOTOS', 'exemplo', 'fontes', 'Fraunces.ttf'));
});
t('caminho na gaveta: 06-MARCA-E-FOTOS sem barra, em outra caixa ou com ".." nunca vira o do modelo', () => {
  const r = comRaiz((raiz) => comAurora(raiz, { legado: true }),
    `(m)=>[m.caminho('06-MARCA-E-FOTOS'),m.caminho('06-marca-e-fotos/marca.exemplo.yaml'),` +
    `m.caminho('06-MARCA-E-FOTOS/exemplo/../marca.exemplo.yaml'),m.caminho('06-MARCA-E-FOTOS\\\\exemplo\\\\fontes\\\\Fraunces.ttf'),` +
    `m.caminho('./06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf'),m.RAIZ]`);
  const barras = (p) => p.split('\\').join('/');
  assert.ok(barras(r[0]).endsWith('empresas/aurora/06-MARCA-E-FOTOS'), r[0]);
  assert.ok(barras(r[1]).endsWith('empresas/aurora/06-marca-e-fotos/marca.exemplo.yaml'), r[1]);
  assert.ok(barras(r[2]).endsWith('empresas/aurora/06-MARCA-E-FOTOS/marca.exemplo.yaml'), r[2]);
  // o que é do modelo continua indo para a raiz do código, com barra invertida ou "./" na frente
  assert.strictEqual(r[3], path.join(r[5], '06-MARCA-E-FOTOS', 'exemplo', 'fontes', 'Fraunces.ttf'));
  assert.strictEqual(r[4], path.join(r[5], '06-MARCA-E-FOTOS', 'exemplo', 'fontes', 'Fraunces.ttf'));
});
t('caminho relativo no legado: raiz dos dados, depois raiz do código', () => {
  const r = comRaiz((raiz) => escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300')),
    `(m)=>[m.caminho('06-MARCA-E-FOTOS/marca.yaml'),m.caminho('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf'),m.RAIZ]`);
  assert.ok(r[0].includes('marca-raiz-'), r[0]);
  assert.strictEqual(r[1], path.join(r[2], '06-MARCA-E-FOTOS', 'exemplo', 'fontes', 'Fraunces.ttf'));
});
t('FABRICA_MARCA manda', () => {
  const outro = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'marca-')), 'outra.yaml');
  fs.writeFileSync(outro, marcaComAcento('Outra', '#123456'));
  const r = comRaiz((raiz) => comAurora(raiz), `(m)=>[m.hex('acento'),m.EMPRESA]`, { FABRICA_MARCA: outro });
  assert.deepStrictEqual(r, ['#123456', null]);
});
t('FABRICA_MARCA manda mesmo quando a escolha da empresa está pendente', () => {
  const outro = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'marca-')), 'outra.yaml');
  fs.writeFileSync(outro, marcaComAcento('Outra', '#123456'));
  const r = comRaiz((raiz) => comAurora(raiz, { legado: true, ativar: false }), `(m)=>m.hex('acento')`, { FABRICA_MARCA: outro });
  assert.strictEqual(r, '#123456');
});
t('gaveta ativa sem marca.yaml: usa o exemplo, nunca a marca antiga de outra empresa', () => {
  const r = comRaiz((raiz) => {
    escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300'));
    empresa.criar('aurora', 'Aurora', raiz); empresa.ativar('aurora', raiz);
  }, `(m)=>[m.EXEMPLO,m.hex('acento'),m.EMPRESA,m.PASTA.split('\\\\').join('/'),m.ARQUIVO.split('\\\\').join('/')]`);
  assert.strictEqual(r[0], true);
  assert.notStrictEqual(r[1], '#CC3300');
  assert.strictEqual(r[2], 'aurora');
  // As cores vêm do exemplo, mas a pasta-base é a gaveta: os arquivos (peças, fotos) nunca são os da empresa antiga.
  assert.ok(r[3].endsWith('empresas/aurora'), r[3]);
  assert.ok(r[4].endsWith('06-MARCA-E-FOTOS/marca.exemplo.yaml'), r[4]);
});
t('gaveta ativa sem marca.yaml numa pasta antiga: PASTA e caminho() nunca dão os arquivos da empresa antiga', () => {
  const r = comRaiz((raiz) => {
    escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300'));
    escrever(raiz, '06-MARCA-E-FOTOS/fotos/rosto.jpg', 'foto da empresa antiga');
    escrever(raiz, '06-MARCA-E-FOTOS/pecas/elemento-fundo.png', 'peça da empresa antiga');
    empresa.criar('aurora', 'Aurora', raiz); empresa.ativar('aurora', raiz);
  }, `(m)=>[m.EXEMPLO,m.PASTA,m.caminho('06-MARCA-E-FOTOS/fotos/rosto.jpg'),m.caminho('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf'),m.RAIZ,process.env.FABRICA_RAIZ]`);
  const [exemplo, pasta, foto, fonte, codigo, dados] = r;
  const barras = (p) => p.split('\\').join('/');
  assert.strictEqual(exemplo, true);
  assert.ok(barras(pasta).endsWith('empresas/aurora'), pasta);
  assert.notStrictEqual(foto, path.join(dados, '06-MARCA-E-FOTOS', 'fotos', 'rosto.jpg'), 'devolveu a foto da empresa antiga');
  assert.ok(barras(foto).endsWith('empresas/aurora/06-MARCA-E-FOTOS/fotos/rosto.jpg'), foto);
  assert.ok(!fs.existsSync(path.join(pasta, 'pecas', 'elemento-fundo.png')), 'a pasta de peças da gaveta não pode ser a da empresa antiga');
  assert.strictEqual(fonte, path.join(codigo, '06-MARCA-E-FOTOS', 'exemplo', 'fontes', 'Fraunces.ttf'));
});
t('aviso do exemplo: gaveta sem marca.yaml manda criar o da gaveta', () => {
  const erro = avisoDaRaiz((raiz) => { empresa.criar('aurora', 'Aurora', raiz); empresa.ativar('aurora', raiz); });
  assert.match(erro, /EXEMPLO/);
  assert.ok(erro.includes('empresas/aurora/marca.yaml'), erro);
  assert.ok(!erro.includes('Crie 06-MARCA-E-FOTOS/marca.yaml'), erro);
});
t('aviso do exemplo: sem empresa nenhuma manda criar o 06-MARCA-E-FOTOS/marca.yaml', () => {
  const erro = avisoDaRaiz(() => {});
  assert.match(erro, /EXEMPLO/);
  assert.ok(erro.includes('06-MARCA-E-FOTOS/marca.yaml'), erro);
  assert.ok(!erro.includes('empresas/'), erro);
});

// ---------- caminho preso à pasta da empresa ----------
const MARCA_FONTE_FORA = marcaComAcento('Aurora', '#2FB59A') + 'tipografia:\n  principal:\n    arquivo: ../../06-MARCA-E-FOTOS/fontes/x.ttf\n';
const montaAuroraComFonteFora = (raiz) => {
  escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300'));
  empresa.criar('aurora', 'Aurora', raiz);
  escrever(raiz, 'empresas/aurora/marca.yaml', MARCA_FONTE_FORA);
  empresa.ativar('aurora', raiz);
};
// Roda caminho(<expressão>) numa raiz com a Aurora ativa e devolve { valor, raiz } ou { code, message }.
function caminhoDaAurora(expressao) {
  return comRaiz(montaAuroraComFonteFora,
    `(m)=>{try{return {valor:m.caminho(${expressao}).split('\\\\').join('/'),raiz:m.RAIZ.split('\\\\').join('/')}}catch(e){return {code:e.code,message:e.message}}}`);
}
t('caminho fora da empresa: o ../ do marca.yaml que sai da pasta da empresa é recusado com CAMINHO_FORA_DA_EMPRESA', () => {
  const lido = caminhoDaAurora('m.dados.tipografia.principal.arquivo');
  assert.strictEqual(lido.code, 'CAMINHO_FORA_DA_EMPRESA', JSON.stringify(lido));
  assert.ok(lido.message.includes('../../06-MARCA-E-FOTOS/fontes/x.ttf'), 'a mensagem devia citar o caminho: ' + lido.message);
  assert.ok(lido.message.includes('marca.yaml'), 'a mensagem devia mandar corrigir o marca.yaml: ' + lido.message);
  for (const rel of ['../x.ttf', '../outra/marca.yaml', 'fontes/../../x.ttf', '..\\..\\06-MARCA-E-FOTOS\\fontes\\x.ttf']) {
    const r = caminhoDaAurora(JSON.stringify(rel));
    assert.strictEqual(r.code, 'CAMINHO_FORA_DA_EMPRESA', rel + ' => ' + JSON.stringify(r));
  }
});
t('caminho fora da empresa: o que fica dentro da pasta da empresa continua valendo, mesmo com ../ no meio', () => {
  const r = caminhoDaAurora(JSON.stringify('fontes/../pecas/logo.png'));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.ok(r.valor.endsWith('empresas/aurora/pecas/logo.png'), r.valor);
});
t('caminho fora da empresa: o exemplo do modelo continua indo para a raiz do código', () => {
  const r = caminhoDaAurora(JSON.stringify('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf'));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.strictEqual(r.valor, r.raiz + '/06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf');
  // O resto de 06-MARCA-E-FOTOS/ é da empresa e fica na pasta dela.
  const dela = caminhoDaAurora(JSON.stringify('06-MARCA-E-FOTOS/fontes/x.ttf'));
  assert.strictEqual(dela.code, undefined, JSON.stringify(dela));
  assert.ok(dela.valor.endsWith('empresas/aurora/06-MARCA-E-FOTOS/fontes/x.ttf'), dela.valor);
});
t('caminho fora da empresa: ../ para o exemplo do modelo é aceito e devolvido sob a raiz do código (FABRICA_RAIZ separada)', () => {
  const r = caminhoDaAurora(JSON.stringify('../../06-MARCA-E-FOTOS/exemplo/fontes/x.ttf'));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.strictEqual(r.valor, r.raiz + '/06-MARCA-E-FOTOS/exemplo/fontes/x.ttf');
  // Sair do exemplo por dentro dele continua recusado.
  const fora = caminhoDaAurora(JSON.stringify('../../06-MARCA-E-FOTOS/exemplo/../marca.yaml'));
  assert.strictEqual(fora.code, 'CAMINHO_FORA_DA_EMPRESA', JSON.stringify(fora));
});
t('caminho fora da empresa: na pasta antiga o ../ continua como hoje', () => {
  const r = comRaiz((raiz) => {
    escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300'));
  }, `(m)=>{try{return {valor:m.caminho('../algo').split('\\\\').join('/')}}catch(e){return {code:e.code,message:e.message}}}`);
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.ok(r.valor.endsWith('/algo'), r.valor);
});

// ---------- marca vinda da pasta antiga, já dentro da pasta da empresa (etapa 9) ----------
// O marca.yaml copiado da pasta antiga continua apontando as letras e o logo por 06-MARCA-E-FOTOS/...; na pasta da
// empresa, esses arquivos moram em <pasta da empresa>/<resto>.
const MARCA_LETRA_ANTIGA = marcaComAcento('Aurora', '#2FB59A') +
  'tipografia:\n  principal:\n    arquivo: 06-MARCA-E-FOTOS/fontes/Principal.ttf\npecas:\n  logo: 06-MARCA-E-FOTOS/logo.png\n';
// Raiz com a Aurora (pasta própria, ativa) cujo marca.yaml veio da pasta antiga; `extra(raiz)` põe os arquivos do caso.
const auroraComMarcaAntiga = (extra) => (raiz) => {
  empresa.criar('aurora', 'Aurora', raiz);
  escrever(raiz, 'empresas/aurora/marca.yaml', MARCA_LETRA_ANTIGA);
  empresa.ativar('aurora', raiz);
  extra(raiz);
};
// Devolve { valor, dados, codigo } com barras normais, ou { code, message } se caminho() recusar.
const caminhosLidos = (exprs) => `(m)=>{const b=(p)=>p.split('\\\\').join('/');try{return {valores:[${exprs.join(',')}].map(b),dados:b(process.env.FABRICA_RAIZ),codigo:b(m.RAIZ)}}catch(e){return {code:e.code,message:e.message}}}`;
const LETRA_E_LOGO = ['m.caminho(m.dados.tipografia.principal.arquivo)', "m.caminho(m.pega('pecas.logo'))"];

t('letra da pasta antiga dentro da pasta nova', () => {
  const r = comRaiz(auroraComMarcaAntiga((raiz) => {
    escrever(raiz, 'empresas/aurora/fontes/Principal.ttf', 'letra');
    escrever(raiz, 'empresas/aurora/logo.png', 'logo');
  }), caminhosLidos([...LETRA_E_LOGO, "m.caminho('06-MARCA-E-FOTOS\\\\fontes\\\\Principal.ttf')", "m.caminho('./06-MARCA-E-FOTOS/fontes/Principal.ttf')"]));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  const [letra, logo, barraInvertida, ponto] = r.valores;
  assert.strictEqual(letra, r.dados + '/empresas/aurora/fontes/Principal.ttf');
  assert.strictEqual(logo, r.dados + '/empresas/aurora/logo.png');
  assert.strictEqual(barraInvertida, r.dados + '/empresas/aurora/fontes/Principal.ttf');
  assert.strictEqual(ponto, r.dados + '/empresas/aurora/fontes/Principal.ttf');
});
t('espelho continua vencendo', () => {
  const r = comRaiz(auroraComMarcaAntiga((raiz) => {
    escrever(raiz, 'empresas/aurora/fontes/Principal.ttf', 'letra');
    escrever(raiz, 'empresas/aurora/06-MARCA-E-FOTOS/fontes/Principal.ttf', 'letra no espelho');
  }), caminhosLidos(LETRA_E_LOGO));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.strictEqual(r.valores[0], r.dados + '/empresas/aurora/06-MARCA-E-FOTOS/fontes/Principal.ttf');
  // nenhum dos dois existe (o logo): o caminho de sempre, o espelho, como antes
  assert.strictEqual(r.valores[1], r.dados + '/empresas/aurora/06-MARCA-E-FOTOS/logo.png');
});
t('nunca a pasta antiga', () => {
  const r = comRaiz(auroraComMarcaAntiga((raiz) => {
    // a letra só existe na raiz (da empresa antiga) e na pasta de outra empresa: nenhuma das duas serve
    escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaComAcento('Empresa Antiga', '#CC3300'));
    escrever(raiz, '06-MARCA-E-FOTOS/fontes/Principal.ttf', 'letra da empresa antiga');
    empresa.criar('boreal', 'Boreal', raiz);
    escrever(raiz, 'empresas/boreal/fontes/Principal.ttf', 'letra da boreal');
    // o exemplo do modelo continua indo para a raiz do código, mesmo com um "exemplo/" na pasta da empresa
    escrever(raiz, 'empresas/aurora/exemplo/fontes/Fraunces.ttf', 'copia');
  }), caminhosLidos([...LETRA_E_LOGO, "m.caminho('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf')"]));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.notStrictEqual(r.valores[0], r.dados + '/06-MARCA-E-FOTOS/fontes/Principal.ttf', 'devolveu a letra da pasta antiga');
  assert.strictEqual(r.valores[0], r.dados + '/empresas/aurora/06-MARCA-E-FOTOS/fontes/Principal.ttf');
  assert.ok(!r.valores[0].includes('/boreal/'), r.valores[0]);
  assert.strictEqual(r.valores[2], r.codigo + '/06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf');
});
t('sobe pasta recusa', () => {
  for (const rel of ['06-MARCA-E-FOTOS/../../boreal/marca.yaml', '06-MARCA-E-FOTOS/../../../06-MARCA-E-FOTOS/fontes/Principal.ttf', '06-MARCA-E-FOTOS\\..\\..\\boreal\\marca.yaml']) {
    const r = comRaiz(auroraComMarcaAntiga((raiz) => {
      empresa.criar('boreal', 'Boreal', raiz);
      escrever(raiz, 'empresas/boreal/marca.yaml', marcaComAcento('Boreal', '#123456'));
      escrever(raiz, '06-MARCA-E-FOTOS/fontes/Principal.ttf', 'letra da empresa antiga');
    }), caminhosLidos([`m.caminho(${JSON.stringify(rel)})`]));
    assert.strictEqual(r.code, 'CAMINHO_FORA_DA_EMPRESA', rel + ' => ' + JSON.stringify(r));
  }
});
t('pasta antiga igual', () => {
  const r = comRaiz((raiz) => {
    escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', MARCA_LETRA_ANTIGA);
    escrever(raiz, '06-MARCA-E-FOTOS/fontes/Principal.ttf', 'letra');
    // na pasta antiga a regra nova não vale: um arquivo em empresas/principal/<resto> nunca é procurado
    escrever(raiz, 'empresas/principal/logo.png', 'logo fora do lugar');
  }, caminhosLidos(LETRA_E_LOGO));
  assert.strictEqual(r.code, undefined, JSON.stringify(r));
  assert.strictEqual(r.valores[0], r.dados + '/06-MARCA-E-FOTOS/fontes/Principal.ttf');
  // como hoje: sem o arquivo na raiz dos dados, a raiz do código
  assert.strictEqual(r.valores[1], r.codigo + '/06-MARCA-E-FOTOS/logo.png');
});

console.log(`\n${n} testes passaram`);
