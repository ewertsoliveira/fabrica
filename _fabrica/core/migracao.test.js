#!/usr/bin/env node
// Prova de ponta a ponta da mudança da pasta antiga para a pasta da empresa, com as ferramentas de verdade. Rode:
// node _fabrica/core/migracao.test.js
// Cada ferramenta roda num processo filho com FABRICA_RAIZ (como no isolamento.test.js): o leitor de empresas, a
// mudança (simular, aplicar, retirar e desfazer), o leitor de marca, o tema de marca dos vídeos, o servidor dos painéis,
// o registro de peças, a conferência entre empresas e a atualização. Tudo em pastas temporárias, com empresas
// fictícias: a pasta antiga é da "Aurora Nutrição" (código principal) e a segunda empresa é a "Boreal Advocacia".
// Cada caso foi calibrado para reprovar (G-13): sem a regra da letra vinda da pasta antiga no marca.js, "marca igual"
// falha depois da retirada; sem a tradução do path das peças, "painéis iguais" falha.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// O ambiente de quem roda o teste não pode interferir nos casos.
for (const v of ['FABRICA_EMPRESA', 'FABRICA_RAIZ', 'FABRICA_MARCA']) delete process.env[v];

const CODIGO = path.resolve(__dirname, '..', '..');
const MIGRAR_JS = path.join(CODIGO, '_fabrica', 'core', 'migrar.js');
const EMPRESA_JS = path.join(CODIGO, '_fabrica', 'core', 'empresa.js');
const ATUALIZAR_JS = path.join(CODIGO, '_fabrica', 'core', 'atualizar.js');
const MARCA_JS = path.join(CODIGO, '08-FERRAMENTAS', 'marca', 'marca.js');
const TEMA_JS = path.join(CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'tema-marca.js');
const LETRAS_DO_MODELO = path.join(CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const VALIDAR_JS = path.join(CODIGO, '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');
const SERVIDOR_JS = path.join(CODIGO, '_fabrica', 'paineis', 'servidor.js');
const REGISTRAR_JS = path.join(CODIGO, '_fabrica', 'paineis', 'registrar.js');

let n = 0;
let pulados = 0;
const t = async (nome, fn) => { await fn(); n++; console.log('ok   ' + nome); };

// ---------- auxiliares ----------
const temporarias = [];
function pastaTemp(prefixo = 'migracao-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
  temporarias.push(d);
  return d;
}
const abs = (r, rel) => path.join(r, ...rel.split('/'));
function escrever(r, rel, conteudo) {
  const arq = abs(r, rel);
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const shaDe = (arq) => sha(fs.readFileSync(arq));
function binario(tamanho, semente) {
  const partes = [];
  let h = Buffer.from(semente);
  let total = 0;
  while (total < tamanho) { h = crypto.createHash('sha256').update(h).digest(); partes.push(h); total += h.length; }
  return Buffer.concat(partes).subarray(0, tamanho);
}
const relDe = (r, a) => path.relative(r, a).split(path.sep).join('/');
const dentroDe = (base, a) => { const x = path.relative(base, a); return x !== '' && x.split(path.sep)[0] !== '..' && !path.isAbsolute(x); };

function env(r) {
  const e = { ...process.env, FABRICA_RAIZ: r, FABRICA_SILENCIO_EXEMPLO: '1' };
  for (const v of ['FABRICA_EMPRESA', 'FABRICA_MARCA']) delete e[v];
  return e;
}
function rodar(r, args) {
  const x = spawnSync(process.execPath, args, { env: env(r), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
  return { status: x.status, saida: x.stdout || '', erro: x.stderr || '' };
}
// Roda um trecho de código num processo filho (com FABRICA_RAIZ) e devolve o JSON que ele imprimiu.
function noFilho(r, codigo) {
  const x = rodar(r, ['-e', codigo]);
  assert.strictEqual(x.status, 0, `o processo filho falhou: ${x.saida}${x.erro}`);
  return { valor: JSON.parse(x.saida), erro: x.erro };
}
const migrar = (r, ...args) => rodar(r, [MIGRAR_JS, ...args]);
const empresaJs = (r, ...args) => rodar(r, [EMPRESA_JS, ...args]);
const ok = (x, rotulo) => { assert.strictEqual(x.status, 0, `${rotulo}: saída ${x.status}\n${x.saida}${x.erro}`); return x; };

// Retrato: cada arquivo (sha256), cada pasta.
function retrato(r) {
  const arquivos = {};
  const pastas = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const c = path.join(dir, e.name);
      const relC = relDe(r, c);
      if (e.isDirectory()) { pastas.push(relC); andar(c); } else arquivos[relC] = shaDe(c);
    }
  };
  andar(r);
  return { arquivos, pastas: pastas.sort() };
}
const daBoreal = (r) => Object.fromEntries(Object.entries(retrato(r).arquivos).filter(([p]) => p.startsWith('empresas/boreal/')));

// ---------- a pasta antiga fictícia (a da Tarefa 3, com marca de verdade e a segunda empresa) ----------
// A letra da Aurora é uma das letras livres (OFL) do modelo, copiada para a pasta antiga: o tema de marca dos vídeos
// lê o arquivo de verdade.
const [LETRA, LETRA_MONO] = fs.readdirSync(LETRAS_DO_MODELO).filter((x) => /\.ttf$/i.test(x)).sort();
// Marca da pasta antiga com BOM, um comentário na primeira linha e CRLF: vai byte a byte, sem edição.
const MARCA = String.fromCharCode(0xFEFF) + '# Marca fictícia, só para teste\r\nempresa:\r\n  nome: "Aurora Nutrição"\r\ncores:\r\n  escuro: "#1F3A33"\r\n  claro: "#F4F1EA"\r\n  acento: "#2FB59A"\r\n  neutro: "#8A8F87"\r\ntipografia:\r\n  principal:\r\n    arquivo: 06-MARCA-E-FOTOS/fontes/Principal.ttf\r\n  mono:\r\n    arquivo: 06-MARCA-E-FOTOS/fontes/Mono.ttf\r\npecas:\r\n  logo: 06-MARCA-E-FOTOS/logo.png\r\n';
const MARCA_BOREAL = 'empresa:\n  nome: "Boreal Advocacia"\ncores:\n  escuro: "#14213D"\n  claro: "#F5F5F0"\n  acento: "#C9A227"\n  neutro: "#7D7F7C"\n';
const json = (v) => JSON.stringify(v, null, 2) + '\n';
const PECAS = [
  { id: 'peca-1', name: 'Peça 1', tipo: 'carrossel', path: 'linhas/reels/saida/run-1/preview.html', pasta: '02-PUBLICACOES/2026-10/peca-1' },
  { id: 'peca-2', name: 'Peça 2', tipo: 'video', path: 'linhas/consultorio/saida/run-2/texto.md', video: 'linhas\\reels\\saida\\run-1\\video.mp4' },
];
const APROVACOES = { 'peca-1': { id: 'peca-1', postId: 'post-1', pasta: '02-PUBLICACOES/2026-10/peca-1', arquivos: ['lamina-1.png'] } };
const POSTS = [{
  id: 'post-1', date: '2026-10-20', platform: 'insta', title: 'Post 1',
  images: ['02-PUBLICACOES/2026-10/peca-1/lamina-1.png'], previewUrl: 'linhas/reels/saida/run-1/preview.html',
}];

function pastaAntiga() {
  const r = pastaTemp();
  fs.mkdirSync(path.join(r, '_fabrica'), { recursive: true });
  fs.copyFileSync(path.join(CODIGO, '_fabrica', 'propriedade.json'), path.join(r, '_fabrica', 'propriedade.json'));
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA);
  escrever(r, '06-MARCA-E-FOTOS/fontes/Principal.ttf', fs.readFileSync(path.join(LETRAS_DO_MODELO, LETRA)));
  escrever(r, '06-MARCA-E-FOTOS/fontes/Mono.ttf', fs.readFileSync(path.join(LETRAS_DO_MODELO, LETRA_MONO)));
  escrever(r, '06-MARCA-E-FOTOS/logo.png', binario(900, 'logo'));
  escrever(r, '06-MARCA-E-FOTOS/fotos/retrato.jpg', binario(2500, 'retrato'));
  escrever(r, '06-MARCA-E-FOTOS/pecas/elemento.png', binario(700, 'elemento'));
  escrever(r, '06-MARCA-E-FOTOS/estilo-de-video.md', '# Estilo de vídeo\r\n\r\nLegendas grandes.\r\n');
  escrever(r, '06-MARCA-E-FOTOS/estilos-proprios/proprio-1/estilo.yaml', 'nome: Próprio 1\n');
  escrever(r, '06-MARCA-E-FOTOS/exemplo/LEIA-ME.md', '# Exemplo do modelo\n');
  escrever(r, '_fabrica/_memoria/empresa.md', '# Perfil da empresa\r\n\r\n**Nome:** Aurora Nutrição\r\n');
  escrever(r, '_fabrica/_memoria/preferencias.md', '# Preferências de quem usa\n');
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', json(PECAS));
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/aprovacoes.json', json(APROVACOES));
  escrever(r, '04-LABORATORIO-DE-DESIGN/referencias/ref-1.png', binario(1200, 'ref'));
  escrever(r, '04-LABORATORIO-DE-DESIGN/COMO-ACESSAR.md', '# Como acessar\n');
  escrever(r, '04-LABORATORIO-DE-DESIGN/rascunho.md', 'anotação solta\n');
  escrever(r, '03-CRONOGRAMA/dados/posts.json', json(POSTS));
  escrever(r, '03-CRONOGRAMA/dados/config.json', json({ titulo: 'Cronograma' }));
  escrever(r, '03-CRONOGRAMA/COMO-ACESSAR.md', '# Como acessar o cronograma\n');
  escrever(r, '02-PUBLICACOES/2026-10/peca-1/lamina-1.png', binario(1500, 'lamina'));
  escrever(r, 'linhas/reels/linha.yaml', 'nome: reels\n');
  escrever(r, 'linhas/reels/passos/01.md', '# Passo 1\n');
  escrever(r, 'linhas/reels/dados/briefing.md', '# Briefing do modelo\n');
  escrever(r, 'linhas/reels/dados/preferencias-aprovadas.md', '# Preferências aprovadas\n');
  escrever(r, 'linhas/reels/saida/run-1/preview.html', '<p>prévia</p>\n');
  escrever(r, 'linhas/reels/saida/run-1/video.mp4', binario(6000, 'video'));
  escrever(r, 'linhas/reels/memoria/runs.md', '# Runs\n- run-1\n');
  escrever(r, 'linhas/reels/estado.json', json({ status: 'concluida' }));
  escrever(r, 'linhas/reels/_investigacoes/perfil-1/notas.md', 'notas da investigação\n');
  escrever(r, 'linhas/consultorio/LEIA-ME.md', '# Consultório\n');
  escrever(r, 'linhas/consultorio/linha.yaml', 'nome: consultorio\n');
  escrever(r, 'linhas/consultorio/dados/receita.md', '# Receita\n');
  escrever(r, 'linhas/consultorio/saida/run-2/texto.md', 'texto do run 2\n');
  escrever(r, 'linhas/consultorio/memoria/memories.md', '# Memória\n');
  escrever(r, 'empresas/principal/pedidos/2026-11-01-100000-usar-estilo.json', json({ estilo: 'bloco' }));
  escrever(r, 'empresas/principal/decisoes.md', '# Decisões\n');
  // a segunda empresa, com pasta própria, marca e uma saída; a principal é a escolhida
  ok(empresaJs(r, 'criar', 'boreal', 'Boreal Advocacia'), 'criar boreal');
  escrever(r, 'empresas/boreal/marca.yaml', MARCA_BOREAL);
  escrever(r, 'empresas/boreal/saidas/reels/run-b/texto.md', 'texto da Boreal\n');
  ok(empresaJs(r, 'ativar', 'principal'), 'ativar principal');
  return r;
}

// Organiza a pasta pela linha de comando, como o agente faria: simula, confere e aplica com o código mostrado.
function organizar(r) {
  const s = migrar(r, 'simular', '--json');
  ok(s, 'simular');
  const inv = JSON.parse(s.saida);
  assert.deepStrictEqual(inv.recusas, []);
  ok(migrar(r, 'aplicar', '--confirmar', inv.codigoSimulacao), 'aplicar');
  return inv;
}
function registroDa(r) {
  const e = JSON.parse(ok(migrar(r, 'estado', '--json'), 'estado').saida);
  return JSON.parse(fs.readFileSync(abs(r, `_fabrica/_backup/migracao-${e.ultima.carimbo}/manifesto.json`), 'utf8'));
}

// ---------- o que cada chave do leitor tem, pelos dois caminhos ----------
const LINHAS = ['reels', 'consultorio'];
// Os caminhos da principal, calculados pelo leitor de empresas num processo filho (as chaves por linha, para cada linha).
function caminhosDaPrincipal(r) {
  return noFilho(r, `const e = require(${JSON.stringify(EMPRESA_JS)});
const c = e.caminhos('principal', process.env.FABRICA_RAIZ);
const o = {};
for (const k of e.CHAVES_DE_CAMINHO) o[k] = typeof c[k] === 'function' ? Object.fromEntries(${JSON.stringify(LINHAS)}.map((l) => [l, c[k](l)])) : c[k];
process.stdout.write(JSON.stringify({ c: o, disposicao: e.listar(process.env.FABRICA_RAIZ).find((x) => x.codigo === 'principal').disposicao }));`).valor;
}
const PROPRIEDADE = JSON.parse(fs.readFileSync(path.join(CODIGO, '_fabrica', 'propriedade.json'), 'utf8'));
const comecaCom = (p, pref) => (pref.endsWith('/') ? p.startsWith(pref) : p === pref);
const naLista = (p, l) => l.some((x) => comecaCom(p, x));
const doModelo = (rel) => naLista(rel, PROPRIEDADE.modelo) && !naLista(rel, PROPRIEDADE.protegidos);
const TRADUZIDOS = new Set(['laboratorio.json', 'aprovacoes.json', 'posts.json']);
const CLASSIFICACAO = require('./migrar').CLASSIFICACAO;

// Para cada chave que muda de lugar (e cada linha), os arquivos dela, relativos ao lugar da chave, com o sha256. Ficam
// de fora: o que é de outra chave mais funda (por exemplo, o contrato da marca dentro da pasta da marca); na pasta
// antiga, o que é do modelo (fora das linhas) e, nos dados da linha, o que não é da empresa (fora dos protegidos); na
// pasta própria, os nomes que a pasta da empresa usa para outra coisa (peças aprovadas, saídas, pedidos...). Os três
// JSON dos painéis, traduzidos na cópia, entram só pelo nome.
function dadosPorChave(r) {
  const { c, disposicao } = caminhosDaPrincipal(r);
  const lugar = (k, v) => (typeof v === 'string' ? [{ k, v }] : v ? Object.entries(v).map(([l, x]) => ({ k: `${k}(${l})`, v: x, linha: true })) : []);
  const todos = Object.entries(c).filter(([k]) => k !== 'gaveta' && k !== 'pastaMarca').flatMap(([k, v]) => lugar(k, v));
  const lugares = Object.entries(c).filter(([k]) => CLASSIFICACAO[k] === 'migra').flatMap(([k, v]) => lugar(k, v));
  const G = c.gaveta;
  const reservados = new Set(todos.filter((x) => dentroDe(G, x.v)).map((x) => path.relative(G, x.v).split(path.sep)[0]));
  const resultado = {};
  for (const { k, v, linha } of lugares) {
    const maisFundas = todos.map((x) => x.v).filter((o) => dentroDe(v, o));
    const mapa = {};
    const st = fs.existsSync(v) ? fs.statSync(v) : null;
    if (st && st.isFile()) mapa['.'] = TRADUZIDOS.has(path.basename(v)) ? 'traduzido' : shaDe(v);
    else if (st) {
      const andar = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const a = path.join(dir, e.name);
          if (maisFundas.some((o) => o === a || dentroDe(o, a))) continue;
          const rel = relDe(v, a);
          if (disposicao === 'gaveta' && k === 'pastaMarca' && reservados.has(rel.split('/')[0])) continue;
          if (disposicao === 'legado' && !linha && doModelo(relDe(r, a))) continue;
          if (e.isDirectory()) { andar(a); continue; }
          if (disposicao === 'legado' && k.startsWith('dadosLinha') && !naLista(relDe(r, a), PROPRIEDADE.protegidos)) continue;
          mapa[rel] = TRADUZIDOS.has(e.name) ? 'traduzido' : shaDe(a);
        }
      };
      andar(v);
    }
    resultado[k] = mapa;
  }
  return resultado;
}

// ---------- marca e vídeo, por processo filho ----------
// O sha256 do arquivo que a ferramenta achou, lido na hora (null se ele não existe).
const SHA_NO_FILHO = `const shaDe = (a) => { try { return require('crypto').createHash('sha256').update(require('fs').readFileSync(a)).digest('hex'); } catch { return null; } };`;
function marcaPorFilho(r) {
  return noFilho(r, `${SHA_NO_FILHO}
const m = require(${JSON.stringify(MARCA_JS)});
const letra = m.caminho(m.pega('tipografia.principal.arquivo'));
const logo = m.caminho(m.pega('pecas.logo'));
process.stdout.write(JSON.stringify({ acento: m.hex('acento'), escuro: m.hex('escuro'), arquivo: m.ARQUIVO, letra, letraSha: shaDe(letra), logo, logoSha: shaDe(logo), exemplo: m.EXEMPLO }));`).valor;
}
function temaPorFilho(r) {
  return noFilho(r, `${SHA_NO_FILHO}
const tema = require(${JSON.stringify(TEMA_JS)});
const marcaMod = require(${JSON.stringify(MARCA_JS)});
const x = tema.resolver({ usarMarca: true }, { marcaMod });
process.stdout.write(JSON.stringify({ origem: x.origem, principal: x.fontes.principal, principalSha: shaDe(x.fontes.principal), mono: x.fontes.mono, acento: x.cores.acento }));`);
}

// ---------- o servidor dos painéis, num processo filho, numa porta livre ----------
function subirServidor(r) {
  return new Promise((resolve, reject) => {
    const filho = spawn(process.execPath, [SERVIDOR_JS, '--sem-navegador', '--porta', '0'], { env: env(r), stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '';
    const limite = setTimeout(() => { filho.kill(); reject(new Error('o servidor não subiu: ' + saida)); }, 60000);
    filho.stdout.on('data', (d) => {
      saida += d;
      const m = /rodando em \S+:(\d+)/.exec(saida);
      if (m) { clearTimeout(limite); resolve({ filho, porta: Number(m[1]) }); }
    });
    filho.stderr.on('data', (d) => { saida += d; });
    filho.on('exit', (s) => { clearTimeout(limite); reject(new Error(`o servidor saiu (${s}): ${saida}`)); });
  });
}
function pararServidor(s, r) {
  return new Promise((resolve) => {
    s.filho.removeAllListeners('exit');
    s.filho.on('exit', () => {
      // O registro do servidor (o endereço) é do próprio servidor que o teste subiu; no Windows ele morre sem limpar.
      try { fs.unlinkSync(abs(r, 'empresas/.servidor.json')); } catch { /* já saiu */ }
      resolve();
    });
    s.filho.kill();
  });
}
function pedir(porta, caminho) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: porta, path: caminho, headers: { Host: `localhost:${porta}` }, timeout: 30000 }, (res) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => resolve({ status: res.statusCode, corpo: Buffer.concat(partes) }));
    });
    req.on('timeout', () => req.destroy(new Error('sem resposta: ' + caminho)));
    req.on('error', reject);
  });
}
const endereco = (rel) => '/' + String(rel).split(/[\\/]+/).map(encodeURIComponent).join('/');
// O que os dois painéis mostram da principal: as peças e os posts (ids), o estado de cada arquivo apontado (a peça, o
// vídeo, as imagens e a prévia do post) e a letra da marca (endereço e estado).
async function painel(r) {
  const s = await subirServidor(r);
  try {
    const d = await pedir(s.porta, '/api/dados?empresa=principal');
    assert.strictEqual(d.status, 200, d.corpo.toString());
    const dados = JSON.parse(d.corpo.toString('utf8'));
    const e = await pedir(s.porta, '/api/empresa?empresa=principal');
    assert.strictEqual(e.status, 200, e.corpo.toString());
    const emp = JSON.parse(e.corpo.toString('utf8'));
    const arquivos = [];
    for (const p of dados.pecas) for (const campo of ['path', 'video']) if (p[campo]) arquivos.push({ de: `${p.id}.${campo}`, rel: p[campo] });
    for (const p of dados.posts) {
      (p.images || []).forEach((img, i) => arquivos.push({ de: `${p.id}.images[${i}]`, rel: img }));
      if (p.previewUrl) arquivos.push({ de: `${p.id}.previewUrl`, rel: p.previewUrl });
    }
    const estados = {};
    for (const a of arquivos) estados[a.de] = { rel: a.rel, status: (await pedir(s.porta, endereco(a.rel))).status };
    const letra = emp.fontes.principal;
    return {
      pecas: dados.pecas.map((p) => p.id), posts: dados.posts.map((p) => p.id), aprovacoes: Object.keys(dados.aprovacoes),
      estados, nome: emp.nome, acento: emp.cores.acento, letra, letraStatus: letra ? (await pedir(s.porta, letra)).status : null,
    };
  } finally {
    await pararServidor(s, r);
  }
}
const todosAbrem = (p, rotulo) => {
  for (const [k, v] of Object.entries(p.estados)) assert.strictEqual(v.status, 200, `${rotulo}: ${k} (${v.rel}) não abre: ${v.status}`);
  assert.strictEqual(p.letraStatus, 200, `${rotulo}: a letra ${p.letra} não abre`);
};

(async () => {
  // =====================================================================
  // A pasta principal: antes, depois de organizar, depois de retirar os antigos e depois de desfazer
  // =====================================================================
  const r = pastaAntiga();
  const original = retrato(r);
  const borealOriginal = daBoreal(r);
  const letraOriginal = shaDe(abs(r, '06-MARCA-E-FOTOS/fontes/Principal.ttf'));
  const antes = {
    dados: dadosPorChave(r), marca: marcaPorFilho(r), tema: temaPorFilho(r), painel: await painel(r),
  };
  const inv = organizar(r);
  const aplicada = { dados: dadosPorChave(r), marca: marcaPorFilho(r), tema: temaPorFilho(r), painel: await painel(r) };
  const borealAplicada = daBoreal(r);
  ok(migrar(r, 'retirar', '--confirmar'), 'retirar');
  const manifesto = registroDa(r);
  assert.strictEqual(manifesto.status, 'retirada');
  const retirada = { dados: dadosPorChave(r), marca: marcaPorFilho(r), tema: temaPorFilho(r), painel: await painel(r) };
  const borealRetirada = daBoreal(r);
  // O que a retirada guardou, lido logo depois dela: cada antigo, com o sha256 de antes, na cópia de segurança.
  const guardadosEm = `_fabrica/_backup/migracao-${manifesto.carimbo}/antigos/`;
  const guardadosNaRetirada = Object.fromEntries(manifesto.itens.map((i) => {
    const g = abs(r, guardadosEm + i.de);
    return [i.de, fs.existsSync(g) ? shaDe(g) : null];
  }));

  await t('mesmos dados pelos dois caminhos', () => {
    assert.ok(Object.keys(antes.dados).length >= 19, Object.keys(antes.dados).join(', '));
    const comArquivos = Object.entries(antes.dados).filter(([, v]) => Object.keys(v).length).map(([k]) => k);
    assert.ok(comArquivos.length >= 14, comArquivos.join(', '));
    assert.deepStrictEqual(aplicada.dados, antes.dados, 'depois de organizar, alguma chave mostra outros arquivos');
    assert.deepStrictEqual(retirada.dados, antes.dados, 'depois de retirar os antigos, alguma chave mostra outros arquivos');
    // e eles vêm mesmo da pasta da empresa: os lugares de antes estão vazios de dados da empresa
    for (const i of inv.itens) assert.strictEqual(fs.existsSync(abs(r, i.de)), false, `${i.de} continua no lugar de antes`);
  });

  await t('marca igual', () => {
    assert.strictEqual(antes.marca.exemplo, false);
    assert.strictEqual(antes.marca.letra, abs(r, '06-MARCA-E-FOTOS/fontes/Principal.ttf'));
    assert.strictEqual(antes.marca.letraSha, letraOriginal);
    assert.ok(antes.marca.logoSha, 'o logo não foi achado antes');
    for (const [rotulo, x] of [['depois de organizar', aplicada.marca], ['depois de retirar', retirada.marca]]) {
      assert.strictEqual(x.exemplo, false, rotulo);
      assert.strictEqual(x.acento, antes.marca.acento, `${rotulo}: a cor mudou`);
      assert.strictEqual(x.escuro, antes.marca.escuro, `${rotulo}: a cor mudou`);
      assert.strictEqual(x.arquivo, abs(r, 'empresas/principal/marca.yaml'), rotulo);
      for (const campo of ['letra', 'logo']) {
        assert.ok(dentroDe(abs(r, 'empresas/principal'), x[campo]), `${rotulo}: ${campo} fora da pasta da empresa: ${x[campo]}`);
        assert.strictEqual(x[campo + 'Sha'], antes.marca[campo + 'Sha'], `${rotulo}: ${campo} não existe ou não é o da marca: ${x[campo]}`);
      }
    }
    assert.ok(fs.readFileSync(abs(r, 'empresas/principal/marca.yaml')).equals(Buffer.from(MARCA)), 'o contrato da marca não foi copiado byte a byte');
  });

  await t('vídeo na marca', () => {
    for (const [rotulo, x] of [['antes', antes.tema], ['depois de organizar', aplicada.tema], ['depois de retirar', retirada.tema]]) {
      assert.ok(!/marca:/.test(x.erro), `${rotulo}: o tema de marca reclamou: ${x.erro}`);
      assert.strictEqual(x.valor.origem, 'marca', rotulo);
      assert.strictEqual(x.valor.acento, antes.marca.acento, rotulo);
      assert.strictEqual(x.valor.principalSha, letraOriginal, `${rotulo}: a letra do vídeo não existe ou não é a da marca: ${x.valor.principal}`);
      assert.ok(x.valor.mono, `${rotulo}: sem a letra mono`);
    }
    assert.ok(dentroDe(abs(r, 'empresas/principal'), retirada.tema.valor.principal), `depois de retirar, a letra do vídeo está fora da pasta da empresa: ${retirada.tema.valor.principal}`);
  });

  await t('painéis iguais', () => {
    todosAbrem(antes.painel, 'antes');
    for (const [rotulo, p] of [['depois de organizar', aplicada.painel], ['depois de retirar', retirada.painel]]) {
      assert.deepStrictEqual([p.pecas, p.posts, p.aprovacoes], [antes.painel.pecas, antes.painel.posts, antes.painel.aprovacoes], `${rotulo}: peças ou posts diferentes`);
      assert.deepStrictEqual(Object.keys(p.estados).sort(), Object.keys(antes.painel.estados).sort(), rotulo);
      todosAbrem(p, rotulo);
      for (const v of Object.values(p.estados)) assert.ok(v.rel.startsWith('empresas/principal/'), `${rotulo}: ${v.rel} aponta para o lugar de antes`);
      assert.ok(p.letra.startsWith('/empresas/principal/'), `${rotulo}: a letra vem de ${p.letra}`);
      assert.strictEqual(p.nome, antes.painel.nome);
      assert.strictEqual(p.acento, antes.painel.acento);
    }
  });

  // Alcance deste caso: ele roda a atualização de verdade contra o modelo já gravado no ramo atual (o propriedade.json
  // de lá). Protege contra uma mudança no atualizar.js que passe a mexer na pasta da empresa, na cópia de segurança ou
  // nos lugares de antes; NÃO protege contra uma mudança ainda não gravada no propriedade.json (a atualização lê o do
  // ramo), e não dá para calibrar por sabotagem sem um commit.
  await t('atualização não toca', () => {
    const ramo = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: CODIGO, encoding: 'utf8' });
    const nome = (ramo.stdout || '').trim();
    if (ramo.status !== 0 || !nome || nome === 'HEAD') {
      console.log('     (atualização: esta cópia do código não é um repositório git com ramo; caso pulado)');
      pulados++;
      return;
    }
    const antesDe = retrato(r);
    const x = rodar(r, [ATUALIZAR_JS, 'verificar', '--origem', CODIGO, '--ramo', nome, '--raiz', r]);
    assert.ok([0, 10].includes(x.status), `a atualização falhou: ${x.saida}${x.erro}`);
    // as listas de troca e de remoção vêm inteiras (a ferramenta corta depois de 40)
    const m = /(\d+) novo\(s\), (\d+) a atualizar, (\d+) a remover/.exec(x.saida);
    assert.ok(m, x.saida);
    assert.ok(Number(m[2]) <= 40 && Number(m[3]) <= 40, 'lista de troca ou de remoção cortada: ' + m[0]);
    const proibidos = new Set([...manifesto.itens.map((i) => i.de), ...manifesto.itens.map((i) => i.para)]);
    let secao = null;
    let vistas = 0;
    for (const linha of x.saida.split(/\r?\n/)) {
      if (/^\S.*:$/.test(linha)) { secao = linha; continue; }
      if (!secao || !/^ {2}\S/.test(linha) || /^ {2}\.\.\. e mais/.test(linha)) continue;
      const p = linha.trim().split('  [')[0];
      vistas++;
      assert.ok(!p.startsWith('empresas/') && !p.startsWith('_fabrica/_backup/') && !proibidos.has(p), `a atualização mexeria em ${p} (${secao})`);
    }
    assert.ok(vistas > 0, 'a atualização não listou nada: ' + x.saida);
    assert.deepStrictEqual(retrato(r), antesDe, 'conferir a atualização gravou algo na pasta');
  });

  // Depois de desfazer (com os antigos retirados), a pasta volta a ser como era.
  const desfeitoRes = JSON.parse(ok(migrar(r, 'desfazer', '--confirmar', '--json'), 'desfazer').saida);
  const desfeita = { marca: marcaPorFilho(r), painel: await painel(r) };

  await t('conservação', () => {
    // a retirada só moveu: cada antigo estava na cópia de segurança, inteiro (sem isso, o desfazer o refaria da cópia
    // da pasta da empresa, e a falta passaria despercebida)
    for (const i of manifesto.itens) assert.strictEqual(guardadosNaRetirada[i.de], original.arquivos[i.de], `${i.de} não foi guardado inteiro na cópia de segurança`);
    // e o desfazer os trouxe de lá (nenhum refeito de outra cópia, nenhum perdido)
    assert.deepStrictEqual([...desfeitoRes.trazidosDaCopia].sort(), manifesto.itens.map((i) => i.de).sort());
    assert.deepStrictEqual([desfeitoRes.restaurados, desfeitoRes.perdidos], [[], []]);
    for (const i of manifesto.itens) assert.strictEqual(fs.existsSync(abs(r, guardadosEm + i.de)), false, `${i.de} ficou na cópia de segurança`);
    // todo caminho -> sha256 do retrato original está igual no lugar de antes, e toda pasta voltou
    const agora = retrato(r);
    for (const [p, h] of Object.entries(original.arquivos)) assert.strictEqual(agora.arquivos[p], h, `${p} não está igual no lugar de antes`);
    for (const p of original.pastas) assert.ok(agora.pastas.includes(p), `a pasta ${p} sumiu`);
    // e a Fábrica volta a usar os lugares de sempre, com os mesmos painéis e a mesma marca
    assert.deepStrictEqual(desfeita.marca, antes.marca);
    assert.deepStrictEqual(desfeita.painel, antes.painel);
    assert.strictEqual(JSON.parse(ok(migrar(r, 'estado', '--json'), 'estado').saida).situacao, 'pasta-antiga');
  });

  await t('boreal intocada', () => {
    assert.ok(Object.keys(borealOriginal).length >= 2, JSON.stringify(borealOriginal));
    assert.deepStrictEqual(borealAplicada, borealOriginal, 'depois de organizar');
    assert.deepStrictEqual(borealRetirada, borealOriginal, 'depois de retirar');
    assert.deepStrictEqual(daBoreal(r), borealOriginal, 'depois de desfazer');
    const lista = JSON.parse(fs.readFileSync(abs(r, 'empresas/indice.json'), 'utf8')).empresas;
    assert.deepStrictEqual(lista.map((e) => [e.codigo, e.disposicao]), [['principal', 'legado'], ['boreal', 'gaveta']]);
  });

  // =====================================================================
  // Outras pastas: registrar depois de organizar e a conferência entre empresas
  // =====================================================================
  await t('registrar depois', () => {
    const s = pastaAntiga();
    organizar(s);
    const labAntigo = shaDe(abs(s, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json'));
    escrever(s, 'empresas/principal/saidas/reels/run-3/preview.html', '<p>peça 3</p>\n');
    const fora = pastaTemp('migracao-pedido-');
    const peca = escrever(fora, 'peca.json', JSON.stringify({ id: 'peca-3', name: 'Peça 3', tipo: 'carrossel', path: 'empresas/principal/saidas/reels/run-3/preview.html' }));
    const x = rodar(s, [REGISTRAR_JS, 'peca', peca, '--empresa', 'principal']);
    assert.strictEqual(x.status, 0, x.saida + x.erro);
    assert.strictEqual(JSON.parse(x.saida).ok, true);
    const pecas = JSON.parse(fs.readFileSync(abs(s, 'empresas/principal/laboratorio/dados/laboratorio.json'), 'utf8'));
    assert.deepStrictEqual(pecas.map((p) => p.id), ['peca-3', 'peca-1', 'peca-2']);
    assert.strictEqual(shaDe(abs(s, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json')), labAntigo, 'o registro foi para o lugar de antes');
    // e o painel mostra a peça nova, que abre
    const pecas2 = JSON.parse(fs.readFileSync(abs(s, 'empresas/principal/laboratorio/dados/laboratorio.json'), 'utf8'));
    assert.ok(fs.existsSync(abs(s, pecas2[0].path)));
  });

  await t('isolamento continua', () => {
    const s = pastaAntiga();
    const validar = (codigo) => rodar(s, [VALIDAR_JS, '--empresa', codigo, '--raiz', s]);
    const BOREAL_SAIDA = 'empresas/boreal/saidas/reels/run-b/citacao.md';
    // a saída da Boreal cita a Aurora: achado; sem a citação: limpo. A saída da principal cita a Boreal: achado.
    const conferir = (rotulo, saidaPrincipal) => {
      escrever(s, BOREAL_SAIDA, 'Uma dica que a Aurora Nutrição deu.\n');
      assert.strictEqual(validar('boreal').status, 1, `${rotulo}: a citação da Aurora na Boreal passou`);
      fs.unlinkSync(abs(s, BOREAL_SAIDA));
      const limpaB = validar('boreal');
      assert.strictEqual(limpaB.status, 0, `${rotulo}: ${limpaB.saida}${limpaB.erro}`);
      escrever(s, saidaPrincipal, 'Como a Boreal Advocacia faz.\n');
      assert.strictEqual(validar('principal').status, 1, `${rotulo}: a citação da Boreal na principal passou`);
      fs.unlinkSync(abs(s, saidaPrincipal));
      const limpaP = validar('principal');
      assert.strictEqual(limpaP.status, 0, `${rotulo}: ${limpaP.saida}${limpaP.erro}`);
    };
    conferir('antes', 'linhas/reels/saida/run-1/citacao.md');
    organizar(s);
    conferir('depois de organizar', 'empresas/principal/saidas/reels/run-1/citacao.md');
    ok(migrar(s, 'retirar', '--confirmar'), 'retirar');
    conferir('depois de retirar', 'empresas/principal/saidas/reels/run-1/citacao.md');
  });

  console.log(`\n${n} casos ok${pulados ? ` (${pulados} pulado(s))` : ''}`);
  for (const d of temporarias) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* pasta temporária presa: o sistema limpa depois */ }
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
