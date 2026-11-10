#!/usr/bin/env node
// Testes da mudança da pasta antiga para a pasta da empresa. Rode: node _fabrica/core/migrar.test.js
// Tudo em pastas temporárias, com empresas fictícias: a pasta antiga é da "Aurora Nutrição" (código principal) e a
// segunda empresa é a "Boreal Advocacia" (boreal). A linha de comando roda num processo filho com FABRICA_RAIZ.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// O ambiente de quem roda o teste não pode interferir nos casos.
delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;

const empresa = require('./empresa');
const migrar = require('./migrar');
const SCRIPT = path.join(__dirname, 'migrar.js');
const MATRIZ = path.resolve(__dirname, '..', '..');

let n = 0;
let pulados = 0;
// MIGRAR_TESTE_SO=<expressão> roda só os casos cujo nome combina (para depurar; a bateria roda todos).
const so = process.env.MIGRAR_TESTE_SO ? new RegExp(process.env.MIGRAR_TESTE_SO) : null;
const t = (nome, fn) => { if (so && !so.test(nome)) return; fn(); n++; console.log('ok   ' + nome); };

// ---------- auxiliares ----------
const temporarias = [];
function pastaTemp(prefixo = 'migrar-') {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
  temporarias.push(d);
  return d;
}
function escrever(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
const ler = (r, rel) => fs.readFileSync(path.join(r, ...rel.split('/')));
const existe = (r, rel) => fs.existsSync(path.join(r, ...rel.split('/')));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
// Bytes "binários" de verdade (com bytes que não são texto), sempre os mesmos para a mesma semente.
function binario(tamanho, semente) {
  const partes = [];
  let h = Buffer.from(semente);
  let total = 0;
  while (total < tamanho) { h = crypto.createHash('sha256').update(h).digest(); partes.push(h); total += h.length; }
  return Buffer.concat(partes).subarray(0, tamanho);
}
function lancaCom(codigo, fn) {
  let pego = null;
  try { fn(); } catch (e) { pego = e; }
  assert.ok(pego, `esperava a recusa ${codigo}, mas não lançou`);
  assert.strictEqual(pego.code, codigo, `esperava ${codigo}, veio ${pego.code}: ${pego.message}`);
  return pego;
}
function cli(r, args, env = {}) {
  const base = { ...process.env, FABRICA_RAIZ: r };
  delete base.FABRICA_EMPRESA;
  const x = spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...base, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}
const recusa = (inv, code) => inv.recusas.find((x) => x.code === code);
const codigos = (inv) => inv.recusas.map((x) => x.code);

// Retrato da pasta: cada arquivo com sha256, tamanho, data e modo (somente leitura ou não); cada pasta; atalhos sem
// seguir.
function retrato(r) {
  const arquivos = {};
  const pastas = [];
  const andar = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const c = path.join(dir, e.name);
      const relC = path.relative(r, c).split(path.sep).join('/');
      const st = fs.lstatSync(c);
      if (st.isSymbolicLink()) arquivos[relC] = { atalho: true };
      else if (st.isDirectory()) { pastas.push(relC); andar(c); }
      else arquivos[relC] = { sha256: sha(fs.readFileSync(c)), bytes: st.size, mtimeMs: st.mtimeMs, modo: st.mode };
    }
  };
  andar(r);
  return { arquivos, pastas: pastas.sort() };
}
// O retrato sem o que está dentro de _fabrica/_backup/ (e sem a própria pasta _fabrica/_backup).
function foraDoBackup(ret) {
  const fora = (p) => p !== '_fabrica/_backup' && !p.startsWith('_fabrica/_backup/');
  return {
    arquivos: Object.fromEntries(Object.entries(ret.arquivos).filter(([p]) => fora(p))),
    pastas: ret.pastas.filter(fora),
  };
}

// ---------- a pasta antiga fictícia ----------
const MARCA = '\uFEFFempresa:\r\n  nome: "Aurora Nutrição"\r\ntipografia:\r\n  principal:\r\n    arquivo: 06-MARCA-E-FOTOS/fontes/Principal.ttf\r\npecas:\r\n  logo: 06-MARCA-E-FOTOS/logo.png\r\n';
const PERFIL = '# Perfil da empresa\r\n\r\n**Nome:** Aurora Nutrição\r\n';
const PECAS = [
  {
    id: 'peca-1', name: 'Peça 1', tipo: 'carrossel',
    path: 'linhas/reels/saida/run-1/preview.html',
    pasta: '02-PUBLICACOES/2026-10/peca-1',
    desc: 'refeita a partir de 02-PUBLICACOES/2026-10/peca-1',
  },
  {
    id: 'peca-2', name: 'Peça 2', tipo: 'video',
    path: 'linhas/consultorio/saida/run-2/texto.md',
    video: 'linhas\\reels\\saida\\run-1\\video.mp4',
  },
];
const APROVACOES = { 'peca-1': { id: 'peca-1', postId: 'post-1', pasta: '02-PUBLICACOES/2026-10/peca-1', arquivos: ['lamina-1.png'] } };
const POSTS = [{
  id: 'post-1', date: '2026-10-20', platform: 'insta', title: 'Post 1',
  images: ['02-PUBLICACOES/2026-10/peca-1/lamina-1.png'],
  previewUrl: 'linhas/reels/saida/run-1/preview.html',
}];
const json = (v) => JSON.stringify(v, null, 2) + '\n';

function pastaAntiga({ comuns = true } = {}) {
  const r = pastaTemp();
  fs.mkdirSync(path.join(r, '_fabrica'), { recursive: true });
  fs.copyFileSync(path.join(MATRIZ, '_fabrica', 'propriedade.json'), path.join(r, '_fabrica', 'propriedade.json'));
  // marca
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA);
  escrever(r, '06-MARCA-E-FOTOS/fontes/Principal.ttf', binario(3000, 'letra'));
  escrever(r, '06-MARCA-E-FOTOS/logo.png', binario(900, 'logo'));
  escrever(r, '06-MARCA-E-FOTOS/fotos/retrato.jpg', binario(2500, 'retrato'));
  escrever(r, '06-MARCA-E-FOTOS/pecas/elemento.png', binario(700, 'elemento'));
  escrever(r, '06-MARCA-E-FOTOS/marca.exemplo.yaml', 'empresa:\n  nome: "Exemplo"\n');
  escrever(r, '06-MARCA-E-FOTOS/exemplo/fontes/Exemplo.ttf', binario(400, 'exemplo'));
  escrever(r, '06-MARCA-E-FOTOS/estilo-de-video.md', '# Estilo de vídeo\r\n\r\nLegendas grandes.\r\n');
  escrever(r, '06-MARCA-E-FOTOS/estilos-proprios/proprio-1/estilo.yaml', 'nome: Próprio 1\n');
  // memória
  escrever(r, '_fabrica/_memoria/empresa.md', PERFIL);
  escrever(r, '_fabrica/_memoria/preferencias.md', '# Preferências de quem usa\n');
  // Laboratório
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', json(PECAS));
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/aprovacoes.json', json(APROVACOES));
  escrever(r, '04-LABORATORIO-DE-DESIGN/referencias/ref-1.png', binario(1200, 'ref'));
  escrever(r, '04-LABORATORIO-DE-DESIGN/COMO-ACESSAR.md', '# Como acessar\n');
  escrever(r, '04-LABORATORIO-DE-DESIGN/estilos/estilo-x.md', '# Estilo do modelo\n');
  escrever(r, '04-LABORATORIO-DE-DESIGN/rascunho.md', 'anotação solta\n');
  // Cronograma
  escrever(r, '03-CRONOGRAMA/dados/posts.json', json(POSTS));
  escrever(r, '03-CRONOGRAMA/dados/config.json', json({ titulo: 'Cronograma' }));
  escrever(r, '03-CRONOGRAMA/COMO-ACESSAR.md', '# Como acessar o cronograma\n');
  // Peças aprovadas
  escrever(r, '02-PUBLICACOES/2026-10/peca-1/lamina-1.png', binario(1500, 'lamina'));
  // linha de Reels (do modelo, com dados da empresa)
  escrever(r, 'linhas/reels/linha.yaml', 'nome: reels\n');
  escrever(r, 'linhas/reels/passos/01.md', '# Passo 1\n');
  escrever(r, 'linhas/reels/dados/briefing.md', '# Briefing do modelo\n');
  escrever(r, 'linhas/reels/dados/preferencias-aprovadas.md', '# Preferências aprovadas\n');
  escrever(r, 'linhas/reels/saida/run-1/preview.html', '<p>prévia</p>\n');
  escrever(r, 'linhas/reels/saida/run-1/video.mp4', binario(6000, 'video'));
  escrever(r, 'linhas/reels/memoria/runs.md', '# Runs\n- run-1\n');
  escrever(r, 'linhas/reels/estado.json', json({ status: 'concluida' }));
  escrever(r, 'linhas/reels/_investigacoes/perfil-1/notas.md', 'notas da investigação\n');
  // linha própria
  escrever(r, 'linhas/consultorio/LEIA-ME.md', '# Consultório\n');
  escrever(r, 'linhas/consultorio/linha.yaml', 'nome: consultorio\n');
  escrever(r, 'linhas/consultorio/dados/receita.md', '# Receita\n');
  escrever(r, 'linhas/consultorio/saida/run-2/texto.md', 'texto do run 2\n');
  escrever(r, 'linhas/consultorio/memoria/memories.md', '# Memória\n');
  // comuns às duas disposições
  if (comuns) {
    escrever(r, 'empresas/principal/pedidos/2026-11-01-100000-usar-estilo.json', json({ estilo: 'bloco' }));
    escrever(r, 'empresas/principal/decisoes.md', '# Decisões\n');
  }
  return r;
}

// O que vai para onde (a tabela do inventário do plano), na pasta fictícia.
const ESPERADOS = [
  ['06-MARCA-E-FOTOS/marca.yaml', 'empresas/principal/marca.yaml', 'marca'],
  ['06-MARCA-E-FOTOS/fontes/Principal.ttf', 'empresas/principal/fontes/Principal.ttf', 'marcaArquivos'],
  ['06-MARCA-E-FOTOS/logo.png', 'empresas/principal/logo.png', 'marcaArquivos'],
  ['06-MARCA-E-FOTOS/fotos/retrato.jpg', 'empresas/principal/fotos/retrato.jpg', 'marcaArquivos'],
  ['06-MARCA-E-FOTOS/pecas/elemento.png', 'empresas/principal/pecas/elemento.png', 'marcaArquivos'],
  ['06-MARCA-E-FOTOS/estilo-de-video.md', 'empresas/principal/estilo-de-video.md', 'estiloDeVideo'],
  ['06-MARCA-E-FOTOS/estilos-proprios/proprio-1/estilo.yaml', 'empresas/principal/estilos-proprios/proprio-1/estilo.yaml', 'estilosProprios'],
  ['_fabrica/_memoria/empresa.md', 'empresas/principal/empresa.md', 'perfil'],
  ['04-LABORATORIO-DE-DESIGN/referencias/ref-1.png', 'empresas/principal/referencias/ref-1.png', 'referencias'],
  ['04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', 'empresas/principal/laboratorio/dados/laboratorio.json', 'laboratorio'],
  ['04-LABORATORIO-DE-DESIGN/dados/aprovacoes.json', 'empresas/principal/laboratorio/dados/aprovacoes.json', 'laboratorio'],
  ['04-LABORATORIO-DE-DESIGN/COMO-ACESSAR.md', 'empresas/principal/laboratorio/COMO-ACESSAR.md', 'laboratorio'],
  ['03-CRONOGRAMA/dados/posts.json', 'empresas/principal/cronograma/dados/posts.json', 'cronograma'],
  ['03-CRONOGRAMA/dados/config.json', 'empresas/principal/cronograma/dados/config.json', 'cronograma'],
  ['03-CRONOGRAMA/COMO-ACESSAR.md', 'empresas/principal/cronograma/COMO-ACESSAR.md', 'cronograma'],
  ['02-PUBLICACOES/2026-10/peca-1/lamina-1.png', 'empresas/principal/publicacoes/2026-10/peca-1/lamina-1.png', 'publicacoes'],
  ['linhas/reels/saida/run-1/preview.html', 'empresas/principal/saidas/reels/run-1/preview.html', 'saidas', 'reels'],
  ['linhas/reels/saida/run-1/video.mp4', 'empresas/principal/saidas/reels/run-1/video.mp4', 'saidas', 'reels'],
  ['linhas/reels/memoria/runs.md', 'empresas/principal/memoria/reels/runs.md', 'memoria', 'reels'],
  ['linhas/reels/dados/preferencias-aprovadas.md', 'empresas/principal/linhas/reels/dados/preferencias-aprovadas.md', 'dadosLinha', 'reels'],
  ['linhas/reels/estado.json', 'empresas/principal/estado/reels.json', 'estadoLinha', 'reels'],
  ['linhas/reels/_investigacoes/perfil-1/notas.md', 'empresas/principal/investigacoes/reels/perfil-1/notas.md', 'investigacoes', 'reels'],
  ['linhas/consultorio/saida/run-2/texto.md', 'empresas/principal/saidas/consultorio/run-2/texto.md', 'saidas', 'consultorio'],
  ['linhas/consultorio/memoria/memories.md', 'empresas/principal/memoria/consultorio/memories.md', 'memoria', 'consultorio'],
];
const PALAVRAS_PROIBIDAS = /gaveta|legado|[íi]ndice|manifesto|migra[çc][ãa]o|disposi[çc][ãa]o|\bsha/i;

// =====================================================================
// Tarefa 3: inventário e simulação (só leitura)
// =====================================================================

t('simular não grava nada', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const inv = migrar.simular(r);
  assert.strictEqual(inv.situacao, 'pasta-antiga');
  assert.deepStrictEqual(inv.recusas, [], JSON.stringify(inv.recusas));
  assert.deepStrictEqual(retrato(r), antes, 'a simulação mudou a pasta');
  // sem empresas/ na raiz: ela continua sem existir, nem vazia
  const s = pastaAntiga({ comuns: false });
  const antesS = retrato(s);
  migrar.simular(s);
  migrar.inventario(s);
  assert.strictEqual(fs.existsSync(path.join(s, 'empresas')), false, 'a simulação criou a pasta empresas/');
  assert.deepStrictEqual(retrato(s), antesS);
});

t('grupos e destinos', () => {
  const r = pastaAntiga();
  const inv = migrar.inventario(r);
  const achados = inv.itens.map((i) => [i.de, i.para, i.grupo, ...(i.linha ? [i.linha] : [])]);
  const ordena = (l) => [...l].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  assert.deepStrictEqual(ordena(achados), ordena(ESPERADOS));
  // cada item tem tamanho e sha256 do arquivo de verdade
  for (const i of inv.itens) {
    assert.strictEqual(i.sha256, sha(ler(r, i.de)), i.de);
    assert.strictEqual(i.bytes, ler(r, i.de).length, i.de);
  }
  assert.strictEqual(inv.bytes, inv.itens.reduce((s, i) => s + i.bytes, 0));
  // todo grupo tem rótulo ao usuário
  for (const i of inv.itens) assert.ok(typeof migrar.GRUPOS[i.grupo] === 'string', i.grupo);
  // caminhos relativos com barra normal
  for (const i of inv.itens) assert.ok(!i.de.includes('\\') && !i.para.includes('\\') && !path.isAbsolute(i.de), i.de);
  assert.strictEqual(inv.empresa, 'principal');
  assert.strictEqual(inv.nome, 'Aurora Nutrição');
});

t('modelo nunca entra', () => {
  const r = pastaAntiga();
  const inv = migrar.inventario(r);
  const proibidos = [/^06-MARCA-E-FOTOS\/marca\.exemplo\.yaml$/, /^06-MARCA-E-FOTOS\/exemplo\//, /^04-LABORATORIO-DE-DESIGN\/estilos\//,
    /^linhas\/reels\/dados\/briefing\.md$/, /^linhas\/[^/]+\/linha\.yaml$/, /\/passos\//, /^linhas\/consultorio\/dados\/receita\.md$/,
    /^linhas\/consultorio\/LEIA-ME\.md$/];
  for (const i of inv.itens) for (const p of proibidos) assert.ok(!p.test(i.de), `${i.de} é do modelo e entrou`);
  for (const f of inv.ficam) for (const p of proibidos) assert.ok(!p.test(f.caminho), `${f.caminho} é do modelo e entrou em ficam`);
  // os 9 do modelo da pasta fictícia: marca.exemplo.yaml, exemplo/, estilos/, e as receitas das duas linhas
  assert.strictEqual(inv.doModelo, 9);
});

t('de todas fica', () => {
  const r = pastaAntiga();
  const inv = migrar.inventario(r);
  assert.ok(!inv.itens.some((i) => i.de === '_fabrica/_memoria/preferencias.md'));
  assert.ok(!inv.ficam.some((f) => f.caminho === '_fabrica/_memoria/preferencias.md'));
});

t('sem lugar fica', () => {
  const r = pastaAntiga();
  escrever(r, '_fabrica/_memoria/outra-nota.md', 'nota\n');
  const inv = migrar.inventario(r);
  assert.deepStrictEqual(inv.ficam, [
    { caminho: '04-LABORATORIO-DE-DESIGN/rascunho.md', motivo: 'sem-lugar' },
    { caminho: '_fabrica/_memoria/outra-nota.md', motivo: 'sem-lugar' },
  ]);
});

t('comuns já no lugar', () => {
  const r = pastaAntiga();
  const inv = migrar.inventario(r);
  for (const i of inv.itens) {
    assert.ok(!i.para.startsWith('empresas/principal/pedidos/') && i.para !== 'empresas/principal/decisoes.md', i.para);
    assert.ok(!i.de.startsWith('empresas/'), i.de);
  }
  assert.deepStrictEqual(inv.jaNoLugar, []);
});

t('referências', () => {
  const r = pastaAntiga();
  const inv = migrar.inventario(r);
  const LAB = '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json';
  const APR = '04-LABORATORIO-DE-DESIGN/dados/aprovacoes.json';
  const POS = '03-CRONOGRAMA/dados/posts.json';
  assert.deepStrictEqual(inv.referencias, [
    { arquivo: APR, campo: '["peca-1"].pasta', de: '02-PUBLICACOES/2026-10/peca-1', para: 'empresas/principal/publicacoes/2026-10/peca-1' },
    { arquivo: LAB, campo: '[0].path', de: 'linhas/reels/saida/run-1/preview.html', para: 'empresas/principal/saidas/reels/run-1/preview.html' },
    { arquivo: LAB, campo: '[0].pasta', de: '02-PUBLICACOES/2026-10/peca-1', para: 'empresas/principal/publicacoes/2026-10/peca-1' },
    { arquivo: LAB, campo: '[1].path', de: 'linhas/consultorio/saida/run-2/texto.md', para: 'empresas/principal/saidas/consultorio/run-2/texto.md' },
    { arquivo: LAB, campo: '[1].video', de: 'linhas\\reels\\saida\\run-1\\video.mp4', para: 'empresas/principal/saidas/reels/run-1\\video.mp4' },
    { arquivo: POS, campo: '[0].images[0]', de: '02-PUBLICACOES/2026-10/peca-1/lamina-1.png', para: 'empresas/principal/publicacoes/2026-10/peca-1/lamina-1.png' },
    { arquivo: POS, campo: '[0].previewUrl', de: 'linhas/reels/saida/run-1/preview.html', para: 'empresas/principal/saidas/reels/run-1/preview.html' },
  ]);
  // os três JSON com referência são traduzidos na cópia; o config.json, sem referência, vai byte a byte
  const traduzir = Object.fromEntries(inv.itens.filter((i) => i.traduzir).map((i) => [i.de, i.traduzir]));
  assert.deepStrictEqual(traduzir, { [LAB]: 'laboratorio', [APR]: 'aprovacoes', [POS]: 'posts' });
  // o "desc" com texto antigo fica como está e vira aviso
  const aviso = inv.avisos.find((a) => a.tipo === 'referencia-nao-traduzida');
  assert.ok(aviso, JSON.stringify(inv.avisos));
  assert.deepStrictEqual(aviso.arquivos, [LAB]);
});

t('conflito recusa', () => {
  const r = pastaAntiga();
  escrever(r, 'empresas/principal/marca.yaml', 'empresa:\n  nome: "Outra coisa"\n');
  const antes = retrato(r);
  const inv = migrar.simular(r);
  const c = recusa(inv, 'CONFLITO_NO_DESTINO');
  assert.ok(c, JSON.stringify(inv.recusas));
  assert.deepStrictEqual(c.arquivos, ['empresas/principal/marca.yaml']);
  assert.deepStrictEqual(retrato(r), antes);
  // igual: vai para jaNoLugar e não é item
  const s = pastaAntiga();
  escrever(s, 'empresas/principal/marca.yaml', MARCA);
  const inv2 = migrar.simular(s);
  assert.deepStrictEqual(inv2.recusas, []);
  assert.deepStrictEqual(inv2.jaNoLugar, ['empresas/principal/marca.yaml']);
  assert.ok(!inv2.itens.some((i) => i.de === '06-MARCA-E-FOTOS/marca.yaml'));
  // um arquivo da marca numa pasta com nome que a pasta da empresa usa para outra coisa (aqui, publicacoes/) recusa:
  // ele iria parar no meio das peças aprovadas (ou por cima de uma delas)
  const d = pastaAntiga();
  escrever(d, '06-MARCA-E-FOTOS/publicacoes/2026-10/peca-1/lamina-1.png', binario(10, 'outra'));
  const inv3 = migrar.simular(d);
  assert.ok(inv3.recusas.some((x) => x.code === 'CONFLITO_NO_DESTINO' && x.arquivos.includes('06-MARCA-E-FOTOS/publicacoes/2026-10/peca-1/lamina-1.png')), JSON.stringify(inv3.recusas));
  assert.ok(!inv3.itens.some((i) => i.de.startsWith('06-MARCA-E-FOTOS/publicacoes/')));
  // o destino é um atalho: recusa (nunca grava através de atalho)
  const j = pastaAntiga();
  const fora = pastaTemp('migrar-fora-');
  try {
    fs.symlinkSync(fora, path.join(j, 'empresas', 'principal', 'saidas'), 'junction');
  } catch (e) {
    console.log('     (atalho no destino: o sistema não deixou criar a junção; parte pulada)');
    pulados++;
    return;
  }
  const inv4 = migrar.simular(j);
  const c4 = recusa(inv4, 'CONFLITO_NO_DESTINO');
  assert.ok(c4 && c4.arquivos.some((a) => a.startsWith('empresas/principal/saidas/')), JSON.stringify(inv4.recusas));
});

t('JSON quebrado recusa', () => {
  const r = pastaAntiga();
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', '[{');
  const antes = ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json');
  const inv = migrar.simular(r);
  const c = recusa(inv, 'JSON_INVALIDO');
  assert.ok(c, JSON.stringify(inv.recusas));
  assert.deepStrictEqual(c.arquivos, ['04-LABORATORIO-DE-DESIGN/dados/laboratorio.json']);
  assert.ok(ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json').equals(antes));
  // forma errada (objeto no lugar da lista) também recusa
  const s = pastaAntiga();
  escrever(s, '03-CRONOGRAMA/dados/posts.json', json({ posts: [] }));
  assert.ok(recusa(migrar.simular(s), 'JSON_INVALIDO'));
});

t('run executando recusa', () => {
  const r = pastaAntiga();
  escrever(r, 'linhas/reels/estado.json', json({ status: 'executando' }));
  const inv = migrar.simular(r);
  const c = recusa(inv, 'RUN_EM_ANDAMENTO');
  assert.ok(c, JSON.stringify(inv.recusas));
  assert.ok(c.arquivos.includes('linhas/reels/estado.json'));
  const conf = migrar.simular(r, { runParadoConfirmado: ['reels'] });
  assert.deepStrictEqual(conf.recusas, []);
  assert.ok(conf.avisos.some((a) => a.tipo === 'run-parado'), JSON.stringify(conf.avisos));
  // confirmar outra linha não vale para esta
  assert.ok(recusa(migrar.simular(r, { runParadoConfirmado: ['consultorio'] }), 'RUN_EM_ANDAMENTO'));
  // pela linha de comando
  assert.strictEqual(cli(r, ['simular']).status, 1);
  const x = cli(r, ['simular', '--run-parado-confirmado', 'reels']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
});

t('run parado avisa', () => {
  for (const status of ['aguardando-responsavel', 'parada']) {
    const r = pastaAntiga();
    escrever(r, 'linhas/consultorio/estado.json', json({ status }));
    const inv = migrar.simular(r);
    assert.deepStrictEqual(inv.recusas, [], status);
    const a = inv.avisos.find((x) => x.tipo === 'run-parado');
    assert.ok(a, status);
    assert.ok(/conversa nova/.test(a.mensagem), a.mensagem);
  }
});

t('espaço', () => {
  const r = pastaAntiga();
  const inv = migrar.inventario(r, { espacoLivre: 10 });
  assert.ok(recusa(inv, 'ESPACO_INSUFICIENTE'), JSON.stringify(inv.recusas));
  assert.strictEqual(inv.espacoLivre, 10);
  // com espaço sobrando, não recusa; sem a opção, vale o disco de verdade
  assert.ok(!recusa(migrar.inventario(r, { espacoLivre: inv.bytes * 2 }), 'ESPACO_INSUFICIENTE'));
  const real = migrar.inventario(r);
  assert.ok(typeof real.espacoLivre === 'number' && real.espacoLivre > 0, String(real.espacoLivre));
});

t('atalho não seguido', () => {
  const r = pastaAntiga();
  const fora = pastaTemp('migrar-fora-');
  escrever(fora, 'segredo.png', binario(50, 'fora'));
  try {
    fs.symlinkSync(fora, path.join(r, '04-LABORATORIO-DE-DESIGN', 'referencias', 'fora'), 'junction');
  } catch (e) {
    console.log(`     (atalho não seguido: o sistema não deixou criar a junção (${e.code}); caso pulado)`);
    pulados++;
    return;
  }
  const inv = migrar.inventario(r);
  assert.ok(inv.ficam.some((f) => f.caminho === '04-LABORATORIO-DE-DESIGN/referencias/fora' && f.motivo === 'atalho'), JSON.stringify(inv.ficam));
  assert.ok(!inv.itens.some((i) => i.de.startsWith('04-LABORATORIO-DE-DESIGN/referencias/fora')), 'entrou no atalho');
  assert.ok(inv.itens.some((i) => i.de === '04-LABORATORIO-DE-DESIGN/referencias/ref-1.png'));
});

t('código da simulação estável', () => {
  const r = pastaAntiga();
  const a = migrar.simular(r).codigoSimulacao;
  const b = migrar.simular(r).codigoSimulacao;
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.strictEqual(a, b);
  const arq = path.join(r, 'linhas', 'reels', 'memoria', 'runs.md');
  const buf = fs.readFileSync(arq);
  buf[buf.length - 2] = buf[buf.length - 2] === 0x31 ? 0x32 : 0x31;
  fs.writeFileSync(arq, buf);
  assert.notStrictEqual(migrar.simular(r).codigoSimulacao, a);
});

t('pasta nova e já organizada', () => {
  const vazia = pastaTemp();
  const inv = migrar.simular(vazia);
  assert.strictEqual(inv.situacao, 'nada-a-mudar');
  assert.deepStrictEqual(inv.itens, []);
  assert.deepStrictEqual(inv.recusas, []);
  assert.deepStrictEqual(fs.readdirSync(vazia), []);
  const x = cli(vazia, ['simular']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.match(x.saida, /Nada a mudar/);
  // índice com a principal já na pasta própria
  const g = pastaTemp();
  escrever(g, 'empresas/indice.json', json({ empresas: [{ codigo: 'principal', nome: 'Aurora Nutrição', disposicao: 'gaveta' }] }));
  escrever(g, '06-MARCA-E-FOTOS/marca.yaml', MARCA);
  const invG = migrar.simular(g);
  assert.strictEqual(invG.situacao, 'ja-organizada');
  assert.deepStrictEqual(invG.itens, []);
  assert.match(cli(g, ['simular']).saida, /Nada a mudar/);
  // outra empresa não é pasta antiga
  const r = pastaAntiga();
  empresa.criar('boreal', 'Boreal Advocacia', r);
  const invB = migrar.simular(r, { codigo: 'boreal' });
  assert.ok(recusa(invB, 'CODIGO_NAO_E_PASTA_ANTIGA'), JSON.stringify(invB.recusas));
  assert.deepStrictEqual(invB.itens, []);
  assert.strictEqual(cli(r, ['simular', 'boreal']).status, 1);
  // índice quebrado: recusa sem tocar nele
  const q = pastaAntiga();
  escrever(q, 'empresas/indice.json', '{ "empresas": [');
  assert.ok(recusa(migrar.simular(q), 'INDICE_INVALIDO'));
});

t('guarda das chaves', () => {
  const guarda = (lista) => assert.deepStrictEqual(migrar.chavesSemClassificacao(lista), [], 'chave sem classificação na mudança de pasta');
  guarda(empresa.CHAVES_DE_CAMINHO);
  const r = pastaAntiga();
  guarda(Object.keys(empresa.caminhosDe('principal', 'legado', r)));
  guarda(Object.keys(empresa.caminhosDe('principal', 'gaveta', r)));
  for (const k of empresa.CHAVES_DE_CAMINHO) assert.ok(['migra', 'comum', 'derivada'].includes(migrar.CLASSIFICACAO[k]), k);
  // uma chave inventada faz a guarda reprovar
  assert.throws(() => guarda([...empresa.CHAVES_DE_CAMINHO, 'inventada']), /inventada/);
  // e, se o leitor devolver uma chave nova, a simulação recusa em vez de esquecer o lugar
  const original = empresa.caminhosDe;
  empresa.caminhosDe = (...a) => ({ ...original(...a), inventada: path.join(r, 'inventada') });
  try {
    assert.ok(recusa(migrar.simular(r), 'CHAVE_SEM_CLASSIFICACAO'));
  } finally {
    empresa.caminhosDe = original;
  }
  assert.deepStrictEqual(migrar.simular(r).recusas, []);
});

t('CLI', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const x = cli(r, ['simular']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(x.saida), 'palavra técnica no texto:\n' + x.saida);
  assert.ok(!x.saida.includes(r), 'caminho completo no texto');
  assert.ok(!/node |migrar\.js/.test(x.saida), 'comando no texto ao usuário (só no --json, para o agente):\n' + x.saida);
  const inv = migrar.simular(r);
  assert.ok(x.saida.includes(inv.codigoSimulacao), x.saida);
  assert.ok(x.saida.includes(migrar.GRUPOS.marca), x.saida);
  const j = cli(r, ['simular', 'principal', '--json']);
  assert.strictEqual(j.status, 0, j.erro);
  const doJson = JSON.parse(j.saida);
  assert.strictEqual(doJson.codigoSimulacao, inv.codigoSimulacao);
  assert.strictEqual(doJson.itens.length, ESPERADOS.length);
  assert.deepStrictEqual(retrato(r), antes, 'a linha de comando gravou algo');
  assert.strictEqual(cli(r, ['inventar']).status, 2);
  assert.strictEqual(cli(r, []).status, 2);
  assert.strictEqual(cli(r, ['simular', '--opcao-que-nao-existe']).status, 2);
  // com recusa, sai 1 e o texto continua sem palavra técnica
  escrever(r, 'empresas/principal/marca.yaml', 'diferente\n');
  const y = cli(r, ['simular']);
  assert.strictEqual(y.status, 1, y.saida + y.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(y.saida + y.erro), y.saida + y.erro);
  // pelo atalho do empresa.js, a mesma saída
  const z = spawnSync(process.execPath, [path.join(__dirname, 'empresa.js'), 'migrar', 'simular', '--json'], { env: { ...process.env, FABRICA_RAIZ: r }, encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(z.status, 1, z.stdout + z.stderr);
  assert.ok(recusa(JSON.parse(z.stdout), 'CONFLITO_NO_DESTINO'));
});

// ---------- Tarefa 3, rodada de correção (sondas da revisão: p2 C, p6, p10) ----------

// Um pid que nunca existe no Windows (os pids são múltiplos de 4) nem costuma existir em outros sistemas.
const PID_MORTO = 999999;
const travaMorta = (r, acao = 'aplicar') => escrever(r, 'empresas/.migracao.lock', JSON.stringify({ pid: PID_MORTO, acao, inicio: new Date().toISOString() }));
function juncao(alvo, onde) {
  try {
    fs.symlinkSync(alvo, onde, 'junction');
    return true;
  } catch (e) {
    console.log(`     (junção: o sistema não deixou criar (${e.code}); parte pulada)`);
    pulados++;
    return false;
  }
}

t('junção na raiz recusa', () => {
  // p10: a pasta de saídas de uma linha e a das peças aprovadas são junções para outro lugar
  const r = pastaAntiga();
  const foraSaidas = pastaTemp('migrar-fora-');
  escrever(foraSaidas, 'run-7/video.mp4', binario(300, 'v7'));
  fs.rmSync(path.join(r, 'linhas', 'reels', 'saida'), { recursive: true });
  if (!juncao(foraSaidas, path.join(r, 'linhas', 'reels', 'saida'))) return;
  const foraPub = pastaTemp('migrar-fora-');
  escrever(foraPub, 'x.png', binario(100, 'x'));
  fs.rmSync(path.join(r, '02-PUBLICACOES'), { recursive: true });
  juncao(foraPub, path.join(r, '02-PUBLICACOES'));
  const antes = retrato(r);
  const inv = migrar.simular(r);
  const j = recusa(inv, 'JUNCAO_NA_RAIZ');
  assert.ok(j, JSON.stringify(inv.recusas));
  assert.deepStrictEqual(j.arquivos, ['02-PUBLICACOES', 'linhas/reels/saida']);
  assert.ok(!PALAVRAS_PROIBIDAS.test(j.mensagem) && !j.mensagem.includes(r), j.mensagem);
  assert.deepStrictEqual(retrato(r), antes);
  // a linha inteira, a memória e as investigações também
  for (const rel of ['linhas/consultorio', 'linhas/reels/memoria', 'linhas/reels/_investigacoes', 'linhas/reels/dados']) {
    const s = pastaAntiga();
    const fora = pastaTemp('migrar-fora-');
    escrever(fora, 'a.md', 'a\n');
    fs.rmSync(path.join(s, ...rel.split('/')), { recursive: true });
    if (!juncao(fora, path.join(s, ...rel.split('/')))) return;
    const js = recusa(migrar.simular(s), 'JUNCAO_NA_RAIZ');
    assert.ok(js && js.arquivos.includes(rel), rel + ' ' + JSON.stringify(migrar.simular(s).recusas));
  }
  // junção mais funda (dentro da pasta) continua só "fica no mesmo lugar", sem recusa
  const p = pastaAntiga();
  if (!juncao(pastaTemp('migrar-fora-'), path.join(p, 'linhas', 'reels', 'saida', 'run-1', 'atalho'))) return;
  const invP = migrar.simular(p);
  assert.ok(!recusa(invP, 'JUNCAO_NA_RAIZ'), JSON.stringify(invP.recusas));
  assert.ok(invP.ficam.some((f) => f.caminho === 'linhas/reels/saida/run-1/atalho' && f.motivo === 'atalho'));
});

t('linha com nome fora do padrão aparece', () => {
  // p6: linhas/Minha-Linha/ não é uma linha da Fábrica, mas o que está nela não pode sumir do inventário
  const r = pastaAntiga();
  escrever(r, 'linhas/Minha-Linha/saida/run/x.md', 'x\n');
  const inv = migrar.simular(r);
  assert.ok(inv.ficam.some((f) => f.caminho === 'linhas/Minha-Linha/saida/run/x.md' && f.motivo === 'sem-lugar'), JSON.stringify(inv.ficam));
  const a = inv.avisos.find((x) => x.tipo === 'linha-fora-do-padrao');
  assert.ok(a && a.arquivos.includes('linhas/Minha-Linha'), JSON.stringify(inv.avisos));
  assert.ok(!inv.itens.some((i) => i.de.startsWith('linhas/Minha-Linha/')));
});

t('referência em minúsculas avisa', () => {
  // p6: "02-publicacoes/..." não é traduzida (o prefixo é exato), mas não pode passar calada
  const r = pastaAntiga();
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', json([{ id: 'd', name: 'D', tipo: 'post', path: 'linhas/reels/saida/run-1/preview.html', pasta: '02-publicacoes/minusc' }]));
  const inv = migrar.simular(r);
  const a = inv.avisos.find((x) => x.tipo === 'referencia-nao-traduzida');
  assert.ok(a, JSON.stringify(inv.avisos));
  assert.ok(a.campos[0].campos.includes('[0].pasta'), JSON.stringify(a.campos));
});

t('trava abandonada na simulação', () => {
  // p2 C: uma organização morreu antes de gravar qualquer coisa (só a trava ficou)
  const r = pastaAntiga();
  travaMorta(r);
  const antes = retrato(r);
  const inv = migrar.simular(r);
  assert.strictEqual(inv.situacao, 'pasta-antiga');
  assert.deepStrictEqual(inv.recusas, [], JSON.stringify(inv.recusas));
  const a = inv.avisos.find((x) => x.tipo === 'trava-abandonada');
  assert.ok(a && /nada foi alterado/i.test(a.mensagem), JSON.stringify(inv.avisos));
  assert.deepStrictEqual(retrato(r), antes, 'a simulação não grava nada, nem tira a trava');
  // morte entre criar a pasta da mudança e gravar o registro: a mudança nunca começou
  const s = pastaAntiga();
  travaMorta(s);
  fs.mkdirSync(path.join(s, '_fabrica', '_backup', 'migracao-20260101-101010'), { recursive: true });
  const invS = migrar.simular(s);
  assert.strictEqual(invS.situacao, 'pasta-antiga');
  assert.deepStrictEqual(invS.recusas, []);
  // trava de processo vivo continua recusando
  const v = pastaAntiga();
  escrever(v, 'empresas/.migracao.lock', JSON.stringify({ pid: process.pid, acao: 'aplicar' }));
  assert.ok(recusa(migrar.simular(v), 'MIGRACAO_EM_ANDAMENTO'));
});

// =====================================================================
// Tarefa 4: aplicar (copiar, conferir, traduzir e virar o índice)
// =====================================================================

const BACKUP = '_fabrica/_backup/';
// Simula e aplica com o código da simulação (o que a pessoa confirmaria).
function aplicarComCodigo(r, opcoes = {}) {
  const inv = migrar.simular(r, opcoes);
  return { inv, res: migrar.aplicar(r, { ...opcoes, confirmar: inv.codigoSimulacao }) };
}
const manifestoDe = (r, carimbo) => JSON.parse(ler(r, `${BACKUP}migracao-${carimbo}/manifesto.json`).toString('utf8'));
const semTrava = (r) => assert.strictEqual(existe(r, 'empresas/.migracao.lock'), false, 'a trava ficou');

t('antigos intactos', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const { res } = aplicarComCodigo(r);
  const depois = retrato(r);
  for (const [p, v] of Object.entries(antes.arquivos)) {
    if (p === 'empresas/indice.json') continue;
    assert.deepStrictEqual(depois.arquivos[p], v, `${p} mudou ou sumiu`);
  }
  for (const p of antes.pastas) assert.ok(depois.pastas.includes(p), `a pasta ${p} sumiu`);
  // sem índice antes: nada em controle/indice.json
  assert.strictEqual(existe(r, `${BACKUP}migracao-${res.carimbo}/controle/indice.json`), false);
  semTrava(r);
});

t('só o esperado nasceu', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const { inv, res } = aplicarComCodigo(r);
  const depois = retrato(r);
  const novos = Object.keys(depois.arquivos).filter((p) => !(p in antes.arquivos));
  const relatorio = `empresas/principal/historico/migracao-${res.carimbo}.md`;
  // o relatório em texto e em página (Tarefa 9)
  const esperados = new Set([...inv.itens.map((i) => i.para), 'empresas/indice.json', relatorio, relatorio.replace(/\.md$/, '.html')]);
  const pastaDaMudanca = `${BACKUP}migracao-${res.carimbo}/`;
  for (const p of novos) assert.ok(esperados.has(p) || p.startsWith(pastaDaMudanca), `nasceu o que não devia: ${p}`);
  for (const p of esperados) assert.ok(p in depois.arquivos, `não nasceu: ${p}`);
  assert.ok(`${pastaDaMudanca}manifesto.json` in depois.arquivos);
  assert.strictEqual(res.pastaBackup, `${BACKUP}migracao-${res.carimbo}`);
  assert.match(res.carimbo, /^\d{8}-\d{6}(-\d+)?$/);
  assert.ok(!novos.some((p) => p.startsWith('empresas/boreal/')));
  assert.ok(!novos.some((p) => p.endsWith('.tmp')), 'sobrou arquivo temporário');
  assert.strictEqual(res.copiados, inv.itens.length);
  assert.strictEqual(res.traduzidos, 3);
  const m = manifestoDe(r, res.carimbo);
  assert.strictEqual(m.status, 'aplicada');
  assert.strictEqual(m.versao, 1);
  assert.strictEqual(m.codigoSimulacao, inv.codigoSimulacao);
  assert.strictEqual(m.itens.length, inv.itens.length);
  assert.ok(m.fim && m.inicio);
  semTrava(r);
});

t('cópia byte a byte', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  const pares = [
    ['06-MARCA-E-FOTOS/marca.yaml', 'empresas/principal/marca.yaml'],
    ['_fabrica/_memoria/empresa.md', 'empresas/principal/empresa.md'],
    ['06-MARCA-E-FOTOS/estilo-de-video.md', 'empresas/principal/estilo-de-video.md'],
    ['linhas/reels/saida/run-1/video.mp4', 'empresas/principal/saidas/reels/run-1/video.mp4'],
    ['linhas/reels/memoria/runs.md', 'empresas/principal/memoria/reels/runs.md'],
    ['linhas/reels/estado.json', 'empresas/principal/estado/reels.json'],
    ['06-MARCA-E-FOTOS/fontes/Principal.ttf', 'empresas/principal/fontes/Principal.ttf'],
    ['03-CRONOGRAMA/dados/config.json', 'empresas/principal/cronograma/dados/config.json'],
  ];
  for (const [de, para] of pares) {
    const a = ler(r, de);
    const b = ler(r, para);
    assert.ok(a.equals(b), `${para} não é igual byte a byte a ${de}`);
    const sa = fs.statSync(path.join(r, de));
    const sb = fs.statSync(path.join(r, para));
    assert.strictEqual(Math.floor(sb.mtimeMs / 1000), Math.floor(sa.mtimeMs / 1000), `${para}: data de modificação`);
  }
  const marca = ler(r, 'empresas/principal/marca.yaml');
  assert.deepStrictEqual([...marca.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'o BOM do marca.yaml sumiu');
  assert.ok(marca.toString('utf8').includes('\r\n'), 'o CRLF do marca.yaml sumiu');
});

t('receitas não copiadas', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  for (const p of ['empresas/principal/linhas/reels/passos', 'empresas/principal/linhas/reels/linha.yaml',
    'empresas/principal/linhas/reels/dados/briefing.md', 'empresas/principal/linhas/consultorio/dados/receita.md',
    'empresas/principal/linhas/consultorio/LEIA-ME.md', 'empresas/principal/exemplo', 'empresas/principal/marca.exemplo.yaml',
    'empresas/principal/preferencias.md']) {
    assert.strictEqual(existe(r, p), false, `${p} não devia existir`);
  }
  assert.ok(existe(r, 'empresas/principal/linhas/reels/dados/preferencias-aprovadas.md'));
});

t('referências traduzidas na cópia', () => {
  const r = pastaAntiga();
  const antigo = ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json');
  const { inv } = aplicarComCodigo(r);
  const texto = ler(r, 'empresas/principal/laboratorio/dados/laboratorio.json').toString('utf8');
  const pecas = JSON.parse(texto);
  assert.strictEqual(pecas[0].path, 'empresas/principal/saidas/reels/run-1/preview.html');
  assert.strictEqual(pecas[0].pasta, 'empresas/principal/publicacoes/2026-10/peca-1');
  assert.strictEqual(pecas[0].desc, PECAS[0].desc, 'o texto livre não muda');
  assert.strictEqual(pecas[1].video, 'empresas/principal/saidas/reels/run-1\\video.mp4');
  assert.strictEqual(texto, JSON.stringify(pecas, null, 2) + '\n', 'o formato é o do gravarJson dos painéis');
  assert.ok(inv.avisos.some((a) => a.tipo === 'referencia-nao-traduzida'));
  assert.ok(ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json').equals(antigo), 'o laboratorio.json antigo mudou');
  const aprov = JSON.parse(ler(r, 'empresas/principal/laboratorio/dados/aprovacoes.json').toString('utf8'));
  assert.strictEqual(aprov['peca-1'].pasta, 'empresas/principal/publicacoes/2026-10/peca-1');
  const posts = JSON.parse(ler(r, 'empresas/principal/cronograma/dados/posts.json').toString('utf8'));
  assert.deepStrictEqual(posts[0].images, ['empresas/principal/publicacoes/2026-10/peca-1/lamina-1.png']);
  assert.strictEqual(posts[0].previewUrl, 'empresas/principal/saidas/reels/run-1/preview.html');
  // os endereços traduzidos apontam para arquivos que existem na pasta da empresa
  for (const p of [pecas[0].path, posts[0].images[0], posts[0].previewUrl]) assert.ok(existe(r, p), p);
});

t('índice virou', () => {
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  const lista = empresa.listar(r);
  assert.strictEqual(lista.length, 1);
  assert.strictEqual(lista[0].codigo, 'principal');
  assert.strictEqual(lista[0].disposicao, 'gaveta');
  assert.strictEqual(lista[0].nome, 'Aurora Nutrição');
  assert.strictEqual(lista[0].virtual, undefined);
  assert.strictEqual(lista[0].migrada.carimbo, res.carimbo);
  assert.match(lista[0].migrada.em, /^\d{4}-\d{2}-\d{2}$/);
  const c = empresa.caminhos('principal', r);
  assert.strictEqual(c.marca, path.join(r, 'empresas', 'principal', 'marca.yaml'));
  assert.ok(fs.existsSync(c.marca));
  assert.ok(fs.existsSync(path.join(c.saidas('reels'), 'run-1', 'video.mp4')));
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas', 'ativa.json')), false, 'o ativa.json não muda');
});

t('relatório', () => {
  const r = pastaAntiga();
  const { inv, res } = aplicarComCodigo(r);
  const rel = `empresas/principal/historico/migracao-${res.carimbo}.md`;
  assert.strictEqual(res.relatorio, rel);
  const texto = ler(r, rel).toString('utf8');
  const rotulos = new Set(inv.itens.map((i) => migrar.GRUPOS[i.grupo].replace('<l>', i.linha || '')));
  for (const rot of rotulos) assert.ok(texto.split(/\r?\n/).some((l) => /^#{2,4} /.test(l) && l.replace(/^#+ /, '') === rot), `sem título para "${rot}"`);
  assert.ok(texto.includes(migrar.FRASE_DESFAZER), 'sem a frase de como desfazer');
  assert.ok(!PALAVRAS_PROIBIDAS.test(texto), 'palavra técnica no relatório:\n' + texto);
  assert.ok(!texto.includes(r), 'caminho completo no relatório');
  assert.ok(/conversa nova/.test(texto));
});

t('simulação velha recusa', () => {
  const r = pastaAntiga();
  const inv = migrar.simular(r);
  const arq = path.join(r, 'linhas', 'reels', 'memoria', 'runs.md');
  fs.appendFileSync(arq, '- run-2\n');
  const antes = retrato(r);
  const e = lancaCom('SIMULACAO_DESATUALIZADA', () => migrar.aplicar(r, { confirmar: inv.codigoSimulacao }));
  assert.match(e.message, /Nada mudou/);
  assert.deepStrictEqual(retrato(r), antes, 'gravou algo');
  // sem o código, recusa como erro de uso, sem gravar
  lancaCom('USO', () => migrar.aplicar(r, {}));
  assert.deepStrictEqual(retrato(r), antes);
  // com recusa na simulação, o aplicar recusa igual, sem gravar
  escrever(r, 'empresas/principal/marca.yaml', 'diferente\n');
  const antes2 = retrato(r);
  const e2 = lancaCom('CONFLITO_NO_DESTINO', () => migrar.aplicar(r, { confirmar: migrar.simular(r).codigoSimulacao }));
  assert.ok(Array.isArray(e2.recusas) && e2.recusas.length >= 1);
  assert.deepStrictEqual(retrato(r), antes2);
});

t('falha no meio volta atrás', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const inv = migrar.simular(r);
  const e = lancaCom('FALHA_NA_COPIA', () => migrar.aplicar(r, {
    confirmar: inv.codigoSimulacao,
    aoCopiar: (i) => { if (i === 4) throw new Error('falha de teste no quinto item'); },
  }));
  assert.match(e.message, /Nada mudou: a Fábrica continua usando os lugares de sempre\./);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), 'sobrou algo fora da cópia de segurança');
  const m = manifestoDe(r, e.carimbo);
  assert.strictEqual(m.status, 'desfeita-por-erro');
  assert.match(m.motivo, /falha de teste/);
  assert.deepStrictEqual(empresa.listar(r).map((x) => [x.codigo, x.disposicao, !!x.virtual]), [['principal', 'legado', true]]);
  semTrava(r);
  // e dá para tentar de novo depois
  const { res } = aplicarComCodigo(r);
  assert.strictEqual(empresa.listar(r)[0].migrada.carimbo, res.carimbo);
});

t('origem mudou durante a cópia', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const inv = migrar.simular(r);
  const arq = path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json');
  const novo = json([{ ...POSTS[0], title: 'Post 1 editado no painel' }]);
  const e = lancaCom('ORIGEM_MUDOU', () => migrar.aplicar(r, {
    confirmar: inv.codigoSimulacao,
    aoCopiar: (i) => { if (i === 2) fs.writeFileSync(arq, novo); },
  }));
  assert.ok(e.arquivos.includes('03-CRONOGRAMA/dados/posts.json'), JSON.stringify(e.arquivos));
  assert.match(e.message, /Nada mudou/);
  // a alteração feita no arquivo antigo é mantida; o resto é como antes
  assert.strictEqual(fs.readFileSync(arq, 'utf8'), novo);
  const agora = foraDoBackup(retrato(r));
  const esperado = foraDoBackup(antes);
  delete agora.arquivos['03-CRONOGRAMA/dados/posts.json'];
  delete esperado.arquivos['03-CRONOGRAMA/dados/posts.json'];
  assert.deepStrictEqual(agora, esperado);
  assert.strictEqual(manifestoDe(r, e.carimbo).status, 'desfeita-por-erro');
  assert.strictEqual(empresa.listar(r)[0].disposicao, 'legado');
  semTrava(r);
});

t('trava', () => {
  const r = pastaAntiga();
  const inv = migrar.simular(r);
  escrever(r, 'empresas/.migracao.lock', json({ pid: process.pid, acao: 'aplicar' }));
  const antes = retrato(r);
  lancaCom('MIGRACAO_EM_ANDAMENTO', () => migrar.aplicar(r, { confirmar: inv.codigoSimulacao }));
  assert.deepStrictEqual(retrato(r), antes);
  // com a trava, a simulação diz que a mudança ficou pela metade
  const s = migrar.simular(r);
  assert.strictEqual(s.situacao, 'interrompida');
  assert.ok(recusa(s, 'MIGRACAO_EM_ANDAMENTO'));
  // a trava não vai para o git
  const ignorados = fs.readFileSync(path.join(MATRIZ, '.gitignore'), 'utf8').split(/\r?\n/).map((l) => l.trim());
  assert.ok(ignorados.includes('empresas/.migracao.lock'), 'falta empresas/.migracao.lock no .gitignore');
});

t('segunda vez', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  const antes = retrato(r);
  const inv = migrar.simular(r);
  assert.strictEqual(inv.situacao, 'ja-organizada');
  const res = migrar.aplicar(r, { confirmar: inv.codigoSimulacao });
  assert.strictEqual(res.situacao, 'ja-organizada');
  assert.strictEqual(res.copiados, 0);
  assert.deepStrictEqual(retrato(r), antes);
});

t('outra empresa intocada', () => {
  const r = pastaAntiga();
  empresa.criar('boreal', 'Boreal Advocacia', r);
  escrever(r, 'empresas/boreal/marca.yaml', 'empresa:\n  nome: "Boreal Advocacia"\n');
  escrever(r, 'empresas/boreal/saidas/reels/run-b/texto.md', 'texto da Boreal\n');
  empresa.ativar('boreal', r);
  const indiceAntes = ler(r, 'empresas/indice.json');
  const ativaAntes = ler(r, 'empresas/ativa.json');
  const antes = retrato(r);
  const { res } = aplicarComCodigo(r);
  const depois = retrato(r);
  for (const [p, v] of Object.entries(antes.arquivos)) {
    if (p.startsWith('empresas/boreal/') || p === 'empresas/ativa.json') assert.deepStrictEqual(depois.arquivos[p], v, p);
  }
  assert.ok(!Object.keys(depois.arquivos).some((p) => p.startsWith('empresas/boreal/') && !(p in antes.arquivos)));
  const indice = JSON.parse(ler(r, 'empresas/indice.json').toString('utf8'));
  const boreal = JSON.parse(indiceAntes.toString('utf8')).empresas.find((e) => e.codigo === 'boreal');
  assert.deepStrictEqual(indice.empresas.find((e) => e.codigo === 'boreal'), boreal);
  assert.deepStrictEqual(indice.empresas.map((e) => [e.codigo, e.disposicao]), [['principal', 'gaveta'], ['boreal', 'gaveta']]);
  // os dois arquivos de controle, como estavam, na cópia de segurança
  assert.ok(ler(r, `${BACKUP}migracao-${res.carimbo}/controle/indice.json`).equals(indiceAntes));
  assert.ok(ler(r, `${BACKUP}migracao-${res.carimbo}/controle/ativa.json`).equals(ativaAntes));
  assert.ok(ler(r, 'empresas/ativa.json').equals(ativaAntes));
});

t('CLI do aplicar', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const x = cli(r, ['aplicar']);
  assert.strictEqual(x.status, 2, x.saida + x.erro);
  assert.match(x.erro, /simul/i);
  assert.deepStrictEqual(retrato(r), antes);
  assert.strictEqual(cli(r, ['aplicar', '--confirmar']).status, 2);
  assert.strictEqual(cli(r, ['aplicar', '--confirmar', 'abcdefabcdef']).status, 1);
  assert.deepStrictEqual(retrato(r), antes);
  const codigo = migrar.simular(r).codigoSimulacao;
  const y = cli(r, ['aplicar', '--confirmar', codigo]);
  assert.strictEqual(y.status, 0, y.saida + y.erro);
  assert.ok(y.saida.includes(migrar.FRASE_DESFAZER), y.saida);
  assert.ok(!/node |migrar\.js/.test(y.saida), 'comando no texto ao usuário:\n' + y.saida);
  // o fim curto (Tarefa 9): quantos arquivos foram copiados e conferidos; a lista por grupo fica na página
  assert.ok(y.saida.includes(`${migrar.simular(pastaAntiga()).itens.length} arquivos`), y.saida);
  assert.match(y.saida, /conversa nova/);
  assert.ok(!PALAVRAS_PROIBIDAS.test(y.saida), y.saida);
  assert.strictEqual(empresa.listar(r)[0].disposicao, 'gaveta');
  // de novo: nada a mudar, saída 0
  const z = cli(r, ['aplicar', '--confirmar', codigo]);
  assert.strictEqual(z.status, 0, z.saida + z.erro);
  assert.match(z.saida, /Nada a mudar/);
});

// ---------- Tarefa 4, rodada de correção (sondas da revisão: p2 C, p3 F) ----------

t('trava abandonada no aplicar', () => {
  // p2 C: a organização anterior morreu durante a simulação (só a trava ficou); o aplicar assume e segue
  const r = pastaAntiga();
  travaMorta(r);
  const antes = retrato(r);
  const inv = migrar.simular(r);
  const res = migrar.aplicar(r, { confirmar: inv.codigoSimulacao });
  assert.strictEqual(res.situacao, 'organizada');
  assert.ok(res.avisos.some((a) => a.tipo === 'trava-abandonada'), JSON.stringify(res.avisos));
  semTrava(r);
  for (const [p, v] of Object.entries(antes.arquivos)) {
    if (p === 'empresas/.migracao.lock') continue;
    assert.deepStrictEqual(retrato(r).arquivos[p], v, p);
  }
  // morte entre criar a pasta da mudança e gravar o registro: nunca começou, o aplicar segue
  const s = pastaAntiga();
  travaMorta(s);
  fs.mkdirSync(path.join(s, '_fabrica', '_backup', 'migracao-20260101-101010'), { recursive: true });
  const resS = migrar.aplicar(s, { confirmar: migrar.simular(s).codigoSimulacao });
  assert.strictEqual(resS.situacao, 'organizada');
  assert.strictEqual(empresa.listar(s)[0].migrada.carimbo, resS.carimbo);
  semTrava(s);
  // trava de processo vivo continua recusando, sem gravar
  const v = pastaAntiga();
  const codigo = migrar.simular(v).codigoSimulacao;
  escrever(v, 'empresas/.migracao.lock', JSON.stringify({ pid: process.pid, acao: 'aplicar' }));
  const antesV = retrato(v);
  lancaCom('MIGRACAO_EM_ANDAMENTO', () => migrar.aplicar(v, { confirmar: codigo }));
  assert.deepStrictEqual(retrato(v), antesV);
});

t('fotos originais fora do git', () => {
  // As fotos originais (pessoas reais) da pasta da empresa ficam fora do git, como as da pasta antiga.
  for (const p of ['empresas/principal/originais/retrato.jpg', 'empresas/boreal/originais/sub/bruto.png', 'empresas/.migracao.lock', '06-MARCA-E-FOTOS/originais/a.jpg']) {
    const x = spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: MATRIZ, encoding: 'utf8' });
    assert.strictEqual(x.status, 0, `${p} devia ser ignorado pelo git (${x.stderr})`);
  }
  const y = spawnSync('git', ['check-ignore', '-q', '--no-index', 'empresas/principal/marca.yaml'], { cwd: MATRIZ, encoding: 'utf8' });
  assert.strictEqual(y.status, 1, 'o marca.yaml da empresa não pode ser ignorado');
});

// ---------- Tarefa 4, rodada de correção 2 (sondas da revisão: p11, p12 T/P/Q, p13) ----------

// Roda migrar.aplicar ou migrar.desfazer num processo filho que morre (process.exit(9)) quando o gancho aoGravar chega
// na fase e na vez pedidas: a morte no meio de uma gravação, sem depender de tempo.
function morreAoGravar(r, funcao, opcoes, fase, vez = 1) {
  const roteiro = `const m = require(${JSON.stringify(path.join(__dirname, 'migrar.js'))});
let n = 0;
const op = JSON.parse(process.env.OP_TESTE);
op.aoGravar = (f) => { if (f === process.env.FASE_TESTE && ++n === Number(process.env.VEZ_TESTE)) process.exit(9); };
if (process.env.F_TESTE === 'aplicar') m.aplicar(process.env.R_TESTE, op);
else if (process.env.F_TESTE === 'retirar') m.retirar(process.env.R_TESTE, undefined, op);
else m.desfazer(process.env.R_TESTE, undefined, op);`;
  const x = spawnSync(process.execPath, ['-e', roteiro], {
    env: { ...process.env, R_TESTE: r, F_TESTE: funcao, OP_TESTE: JSON.stringify(opcoes), FASE_TESTE: fase, VEZ_TESTE: String(vez) },
    encoding: 'utf8', timeout: 240000,
  });
  assert.strictEqual(x.status, 9, 'o filho devia morrer no meio da gravação: ' + x.stdout + x.stderr);
}
const temporarios = (r) => Object.keys(retrato(r).arquivos).filter((p) => p.endsWith('.migracao-tmp'));
const temporarioDe = (rel) => path.posix.join(path.posix.dirname(rel), `.${path.posix.basename(rel)}.migracao-tmp`);

t('cópia do aplicar por temporário', () => {
  // Uma cópia só ganha o nome final inteira e conferida: morte no meio deixa só o temporário, nunca um final pela metade.
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const inv = migrar.simular(r);
  morreAoGravar(r, 'aplicar', { confirmar: inv.codigoSimulacao }, 'temporario-pronto', 4);
  const quarto = inv.itens[3];
  assert.strictEqual(existe(r, quarto.para), false, 'o nome final apareceu antes da cópia terminar');
  assert.deepStrictEqual(temporarios(r), [temporarioDe(quarto.para)]);
  assert.strictEqual(migrar.estado(r).situacao, 'interrompida');
  migrar.desfazer(r, undefined, { confirmar: true });
  assert.deepStrictEqual(foraDoBackup(retrato(r)), antes, 'sobrou temporário ou cópia');
  // a aplicação normal não deixa temporário nenhum
  aplicarComCodigo(r);
  assert.deepStrictEqual(temporarios(r), []);
});

t('tomada órfã', () => {
  // p12 T: um processo morreu segurando a tomada da trava; a trava também é de processo morto
  const r = pastaAntiga();
  travaMorta(r);
  escrever(r, 'empresas/.migracao.lock.tomada', JSON.stringify({ pid: PID_MORTO - 4, acao: 'aplicar' }));
  const res = migrar.aplicar(r, { confirmar: migrar.simular(r).codigoSimulacao });
  assert.strictEqual(res.situacao, 'organizada');
  assert.strictEqual(existe(r, 'empresas/.migracao.lock.tomada'), false, 'a tomada órfã ficou');
  semTrava(r);
  assert.deepStrictEqual(fs.readdirSync(path.join(r, 'empresas')).filter((n) => n.startsWith('.migracao')), []);
});

t('trava vazia recém-criada é viva', () => {
  // p12 Q: a trava existe, mas o conteúdo (o pid) ainda não foi escrito: é de alguém que acabou de começar
  const r = pastaAntiga();
  escrever(r, 'empresas/.migracao.lock', '');
  assert.ok(recusa(migrar.simular(r), 'MIGRACAO_EM_ANDAMENTO'));
  assert.strictEqual(migrar.estado(r).situacao, 'interrompida');
  // velha (mais de um minuto) e vazia: abandonada
  const velha = new Date(Date.now() - 120000);
  fs.utimesSync(path.join(r, 'empresas', '.migracao.lock'), velha, velha);
  assert.deepStrictEqual(migrar.simular(r).recusas, []);
  assert.ok(migrar.estado(r).pendencias.some((p) => p.tipo === 'trava-abandonada'));
});

t('pid reaproveitado', () => {
  // p12 P: a trava tem mais de um dia e o pid dela é hoje de outro processo, que começou depois da trava
  const vivo = require('child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
  try {
    const r = pastaAntiga();
    escrever(r, 'empresas/.migracao.lock', JSON.stringify({ pid: vivo.pid, acao: 'aplicar', inicio: '2026-01-01T00:00:00.000Z' }));
    const inv = migrar.simular(r);
    assert.deepStrictEqual(inv.recusas, [], JSON.stringify(inv.recusas));
    assert.ok(inv.avisos.some((a) => a.tipo === 'trava-abandonada'));
    // a mesma trava, recente: o processo pode ser o dono, então ela é viva
    escrever(r, 'empresas/.migracao.lock', JSON.stringify({ pid: vivo.pid, acao: 'aplicar', inicio: new Date().toISOString() }));
    assert.ok(recusa(migrar.simular(r), 'MIGRACAO_EM_ANDAMENTO'));
  } finally {
    vivo.kill();
  }
});

t('travas e temporários fora do git', () => {
  for (const p of ['empresas/.migracao.lock.tomada', 'empresas/principal/saidas/reels/run-1/.video.mp4.migracao-tmp', 'linhas/reels/saida/run-9/.plano.md.migracao-tmp']) {
    const x = spawnSync('git', ['check-ignore', '-q', '--no-index', p], { cwd: MATRIZ, encoding: 'utf8' });
    assert.strictEqual(x.status, 0, `${p} devia ser ignorado pelo git`);
  }
});

// =====================================================================
// Tarefa 5: desfazer (antes da retirada) e estado
// =====================================================================

const desfazer = (r, opcoes = {}, carimbo) => migrar.desfazer(r, carimbo, { confirmar: true, ...opcoes });
const legadoVirtual = (r) => assert.deepStrictEqual(empresa.listar(r).map((x) => [x.codigo, x.disposicao, !!x.virtual]), [['principal', 'legado', true]]);

t('volta exatamente como era', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const { res } = aplicarComCodigo(r);
  const d = desfazer(r);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), 'a pasta não voltou a ser como era');
  legadoVirtual(r);
  const m = manifestoDe(r, res.carimbo);
  assert.strictEqual(m.status, 'desfeita');
  assert.ok(d.movidosParaBackup > 0);
  assert.deepStrictEqual(d.levadosDeVolta, []);
  // as cópias e o relatório (com a linha do desfazer) ficam na cópia de segurança, nunca apagados
  const desfeito = `${BACKUP}migracao-${res.carimbo}/desfeito/`;
  assert.ok(ler(r, desfeito + 'empresas/principal/marca.yaml').equals(ler(r, '06-MARCA-E-FOTOS/marca.yaml')));
  assert.match(ler(r, `${desfeito}empresas/principal/historico/migracao-${res.carimbo}.md`).toString('utf8'), /Desfeita em /);
  assert.ok(existe(r, `${desfeito}empresas/indice.json`), 'o índice criado pela mudança vai para a cópia de segurança');
  semTrava(r);
  // com índice de verdade antes (principal e boreal), ele volta byte a byte
  const s = pastaAntiga();
  empresa.criar('boreal', 'Boreal Advocacia', s);
  const antesS = retrato(s);
  aplicarComCodigo(s);
  desfazer(s);
  assert.deepStrictEqual(foraDoBackup(retrato(s)), foraDoBackup(antesS));
  // e dá para organizar de novo depois
  aplicarComCodigo(s);
  assert.strictEqual(empresa.listar(s)[0].disposicao, 'gaveta');
});

t('novo na pasta nova recusa', () => {
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'plano feito depois\n');
  fs.appendFileSync(path.join(r, 'empresas', 'principal', 'memoria', 'reels', 'runs.md'), '- run-9\n');
  const antes = retrato(r);
  const e = lancaCom('NOVOS_NA_PASTA_DA_EMPRESA', () => desfazer(r));
  assert.deepStrictEqual([...e.arquivos].sort(), ['empresas/principal/memoria/reels/runs.md', 'empresas/principal/saidas/reels/run-9/plano.md']);
  assert.deepStrictEqual(retrato(r), antes, 'mudou algo');
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'aplicada');
  assert.strictEqual(empresa.listar(r)[0].disposicao, 'gaveta');
  semTrava(r);
});

t('levar novos', () => {
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'plano feito depois\n');
  const runsNovo = Buffer.concat([ler(r, 'empresas/principal/memoria/reels/runs.md'), Buffer.from('- run-9\n')]);
  escrever(r, 'empresas/principal/memoria/reels/runs.md', runsNovo);
  const runsOriginal = ler(r, 'linhas/reels/memoria/runs.md');
  const d = desfazer(r, { levarNovos: true });
  assert.strictEqual(ler(r, 'linhas/reels/saida/run-9/plano.md').toString('utf8'), 'plano feito depois\n');
  assert.ok(ler(r, 'linhas/reels/memoria/runs.md').equals(runsNovo), 'a memória editada depois não voltou');
  const base = `${BACKUP}migracao-${res.carimbo}/`;
  assert.ok(ler(r, base + 'substituidos/linhas/reels/memoria/runs.md').equals(runsOriginal), 'o original não foi guardado');
  assert.ok(existe(r, base + 'desfeito/empresas/principal/saidas/reels/run-9/plano.md'));
  assert.strictEqual(existe(r, 'empresas/principal/saidas'), false);
  assert.deepStrictEqual([...d.levadosDeVolta].sort(), ['linhas/reels/memoria/runs.md', 'linhas/reels/saida/run-9/plano.md']);
  legadoVirtual(r);
  semTrava(r);
});

t('peça nova volta traduzida ao contrário', () => {
  const r = pastaAntiga();
  const original = ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json');
  const { res } = aplicarComCodigo(r);
  const arq = path.join(r, 'empresas', 'principal', 'laboratorio', 'dados', 'laboratorio.json');
  const pecas = JSON.parse(fs.readFileSync(arq, 'utf8'));
  pecas.push({ id: 'peca-9', name: 'Peça 9', tipo: 'carrossel', path: 'empresas/principal/saidas/reels/run-9/preview.html', pasta: 'empresas/principal/publicacoes/2026-11/peca-9' });
  fs.writeFileSync(arq, json(pecas));
  escrever(r, 'empresas/principal/saidas/reels/run-9/preview.html', '<p>peça 9</p>\n');
  desfazer(r, { levarNovos: true });
  const volta = JSON.parse(ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json').toString('utf8'));
  const p9 = volta.find((p) => p.id === 'peca-9');
  assert.strictEqual(p9.path, 'linhas/reels/saida/run-9/preview.html');
  assert.strictEqual(p9.pasta, '02-PUBLICACOES/2026-11/peca-9');
  assert.strictEqual(volta.find((p) => p.id === 'peca-1').path, 'linhas/reels/saida/run-1/preview.html');
  assert.ok(existe(r, p9.path));
  assert.ok(ler(r, `${BACKUP}migracao-${res.carimbo}/substituidos/04-LABORATORIO-DE-DESIGN/dados/laboratorio.json`).equals(original));
});

t('conflito ao levar', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'feito na pasta nova\n');
  escrever(r, 'linhas/reels/saida/run-9/plano.md', 'feito no lugar antigo, por outra conversa\n');
  const antes = retrato(r);
  const e = lancaCom('CONFLITO_AO_LEVAR', () => desfazer(r, { levarNovos: true }));
  assert.ok(e.arquivos.includes('linhas/reels/saida/run-9/plano.md'), JSON.stringify(e.arquivos));
  assert.deepStrictEqual(retrato(r), antes, 'copiou ou moveu algo');
  // editado nos dois lugares também é conflito
  const s = pastaAntiga();
  aplicarComCodigo(s);
  fs.appendFileSync(path.join(s, 'empresas', 'principal', 'memoria', 'reels', 'runs.md'), '- da pasta nova\n');
  fs.appendFileSync(path.join(s, 'linhas', 'reels', 'memoria', 'runs.md'), '- do lugar antigo\n');
  const antesS = retrato(s);
  const e2 = lancaCom('CONFLITO_AO_LEVAR', () => desfazer(s, { levarNovos: true }));
  assert.ok(e2.arquivos.includes('linhas/reels/memoria/runs.md'), JSON.stringify(e2.arquivos));
  assert.deepStrictEqual(retrato(s), antesS);
  semTrava(s);
});

t('empresa criada depois continua', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  empresa.criar('boreal', 'Boreal Advocacia', r);
  escrever(r, 'empresas/boreal/marca.yaml', 'empresa:\n  nome: "Boreal Advocacia"\n');
  const boreal = Object.fromEntries(Object.entries(retrato(r).arquivos).filter(([p]) => p.startsWith('empresas/boreal/')));
  desfazer(r);
  const indice = JSON.parse(ler(r, 'empresas/indice.json').toString('utf8'));
  assert.deepStrictEqual(indice.empresas.map((e) => [e.codigo, e.disposicao]), [['principal', 'legado'], ['boreal', 'gaveta']]);
  assert.strictEqual(indice.empresas[0].migrada, undefined);
  const agora = Object.fromEntries(Object.entries(retrato(r).arquivos).filter(([p]) => p.startsWith('empresas/boreal/')));
  assert.deepStrictEqual(agora, boreal);
  assert.strictEqual(empresa.caminhos('principal', r).marca, path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'));
});

t('interrompida', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const codigo = migrar.simular(r).codigoSimulacao;
  const roteiro = `const m = require(${JSON.stringify(path.join(__dirname, 'migrar.js'))});
m.aplicar(process.env.R_TESTE, { confirmar: process.env.C_TESTE, aoCopiar: (i) => { if (i === 3) process.exit(9); } });`;
  const x = spawnSync(process.execPath, ['-e', roteiro], { env: { ...process.env, R_TESTE: r, C_TESTE: codigo }, encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(x.status, 9, x.stdout + x.stderr);
  assert.ok(existe(r, 'empresas/.migracao.lock'), 'o processo morto devia deixar a trava');
  const est = migrar.estado(r);
  assert.strictEqual(est.situacao, 'interrompida');
  assert.ok(est.pendencias.length >= 1);
  legadoVirtual(r);
  assert.strictEqual(migrar.simular(r).situacao, 'interrompida');
  const d = desfazer(r);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), 'sobrou cópia pela metade');
  semTrava(r);
  assert.strictEqual(manifestoDe(r, est.ultima.carimbo).status, 'desfeita-por-erro');
  assert.ok(d.movidosParaBackup >= 0);
  assert.strictEqual(migrar.estado(r).situacao, 'pasta-antiga');
  // depois de limpar, dá para organizar de novo
  aplicarComCodigo(r);
  assert.strictEqual(empresa.listar(r)[0].disposicao, 'gaveta');
});

t('trava de outro processo vivo', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  escrever(r, 'empresas/.migracao.lock', json({ pid: process.pid, acao: 'aplicar' }));
  const antes = retrato(r);
  lancaCom('MIGRACAO_EM_ANDAMENTO', () => desfazer(r));
  assert.deepStrictEqual(retrato(r), antes);
});

t('estado', () => {
  const r = pastaAntiga();
  assert.strictEqual(migrar.estado(r).situacao, 'pasta-antiga');
  assert.strictEqual(migrar.estado(r).ultima, null);
  const { res } = aplicarComCodigo(r);
  const e1 = migrar.estado(r);
  assert.strictEqual(e1.situacao, 'organizada-com-antigos');
  assert.strictEqual(e1.ultima.carimbo, res.carimbo);
  assert.strictEqual(e1.ultima.status, 'aplicada');
  assert.match(e1.ultima.em, /^\d{4}-\d{2}-\d{2}$/);
  desfazer(r);
  const e2 = migrar.estado(r);
  assert.strictEqual(e2.situacao, 'pasta-antiga');
  assert.strictEqual(e2.ultima.status, 'desfeita');
  // pasta nova (sem nada do formato antigo) e empresa já com pasta própria: organizada
  assert.strictEqual(migrar.estado(pastaTemp()).situacao, 'organizada');
  const g = pastaTemp();
  empresa.criar('aurora', 'Aurora Nutrição', g);
  assert.strictEqual(migrar.estado(g).situacao, 'organizada');
  // nada para desfazer
  lancaCom('NADA_A_DESFAZER', () => desfazer(pastaAntiga()));
  // desfazer de novo a mesma mudança recusa
  lancaCom('NADA_A_DESFAZER', () => desfazer(r, {}, res.carimbo));
});

t('CLI do desfazer e do estado', () => {
  const r = pastaAntiga();
  const est = cli(r, ['estado', '--json']);
  assert.strictEqual(est.status, 0, est.erro);
  assert.strictEqual(JSON.parse(est.saida).situacao, 'pasta-antiga');
  const txt = cli(r, ['estado']);
  assert.strictEqual(txt.status, 0, txt.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(txt.saida), txt.saida);
  const codigo = migrar.simular(r).codigoSimulacao;
  assert.strictEqual(cli(r, ['aplicar', '--confirmar', codigo]).status, 0);
  const antes = retrato(r);
  const x = cli(r, ['desfazer']);
  assert.strictEqual(x.status, 2, x.saida + x.erro);
  assert.deepStrictEqual(retrato(r), antes);
  const y = cli(r, ['desfazer', '20000101-000000', '--confirmar']);
  assert.strictEqual(y.status, 1, y.saida + y.erro);
  assert.match(y.erro + y.saida, /CARIMBO_DESCONHECIDO|não existe/);
  assert.deepStrictEqual(retrato(r), antes);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'novo\n');
  const z = cli(r, ['desfazer', '--confirmar', '--json']);
  assert.strictEqual(z.status, 1, z.saida + z.erro);
  assert.ok(JSON.parse(z.saida).arquivos.includes('empresas/principal/saidas/reels/run-9/plano.md'));
  const w = cli(r, ['desfazer', '--levar-novos', '--confirmar']);
  assert.strictEqual(w.status, 0, w.saida + w.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(w.saida), w.saida);
  assert.strictEqual(empresa.listar(r)[0].disposicao, 'legado');
  assert.ok(existe(r, 'linhas/reels/saida/run-9/plano.md'));
});

// ---------- Tarefa 5, rodada de correção (sondas da revisão: p2 B/C/D, p5, p7, p9) ----------

// Compara o retrato fora do backup sem a data dos arquivos listados (restaurados: o conteúdo é o que importa).
function semDatas(ret, lista) {
  const a = JSON.parse(JSON.stringify(ret));
  for (const p of lista) if (a.arquivos[p]) delete a.arquivos[p].mtimeMs;
  return a;
}

t('antigos apagados voltam', () => {
  // p2 B: depois da mudança, a pessoa apaga as peças aprovadas antigas e o contrato da marca (achou que eram cópia)
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  aplicarComCodigo(r);
  fs.rmSync(path.join(r, '02-PUBLICACOES'), { recursive: true });
  fs.unlinkSync(path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'));
  const d = desfazer(r);
  const voltaram = ['02-PUBLICACOES/2026-10/peca-1/lamina-1.png', '06-MARCA-E-FOTOS/marca.yaml'];
  assert.deepStrictEqual([...d.restaurados].sort(), voltaram);
  assert.deepStrictEqual(semDatas(foraDoBackup(retrato(r)), voltaram), semDatas(antes, voltaram), 'não voltou tudo');
  for (const p of voltaram) assert.strictEqual(Math.floor(fs.statSync(path.join(r, ...p.split('/'))).mtimeMs / 1000), Math.floor(antes.arquivos[p].mtimeMs / 1000), p);
  legadoVirtual(r);
  assert.ok(fs.existsSync(empresa.caminhos('principal', r).marca));
  // o mesmo com um JSON traduzido apagado: volta pela tradução ao contrário, com o conteúdo de antes
  const s = pastaAntiga();
  const lab = ler(s, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json');
  aplicarComCodigo(s);
  fs.unlinkSync(path.join(s, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'));
  desfazer(s);
  assert.deepStrictEqual(JSON.parse(ler(s, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json').toString('utf8')), JSON.parse(lab.toString('utf8')));
});

t('antigo editado fica com a pessoa', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  const editado = Buffer.from('# Runs\n- run-1\n- anotação feita no lugar antigo\n');
  fs.writeFileSync(path.join(r, 'linhas', 'reels', 'memoria', 'runs.md'), editado);
  const d = desfazer(r);
  assert.ok(ler(r, 'linhas/reels/memoria/runs.md').equals(editado), 'a versão da pessoa foi sobrescrita');
  assert.ok(d.mantidos.includes('linhas/reels/memoria/runs.md'), JSON.stringify(d.mantidos));
  legadoVirtual(r);
});

t('desfazer pela metade continua', () => {
  // p5: um arquivo da pasta da empresa preso por outro programa no meio do desfazer
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { res } = aplicarComCodigo(r);
  let movidos = 0;
  const e = lancaCom('ARQUIVO_PRESO', () => migrar.desfazer(r, undefined, {
    confirmar: true,
    aoMover: () => { if (++movidos === 3) { const x = new Error('EBUSY: resource busy or locked, rename'); x.code = 'EBUSY'; throw x; } },
  }));
  assert.ok(!/EBUSY|resource|rename/.test(e.message) && !e.message.includes(r), 'mensagem técnica ou em inglês: ' + e.message);
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'desfazendo');
  // a Fábrica já usa os lugares de sempre, que estão inteiros
  legadoVirtual(r);
  assert.ok(fs.existsSync(empresa.caminhos('principal', r).marca));
  const est = migrar.estado(r);
  assert.strictEqual(est.situacao, 'interrompida');
  assert.ok(est.pendencias.some((p) => p.tipo === 'desfazer-pela-metade' && /de novo/.test(p.mensagem)), JSON.stringify(est));
  assert.ok(recusa(migrar.simular(r), 'MIGRACAO_EM_ANDAMENTO'), 'não pode organizar de novo com o desfazer pela metade');
  semTrava(r);
  // de novo: continua de onde parou
  desfazer(r);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), antes);
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'desfeita');
  assert.strictEqual(migrar.estado(r).situacao, 'pasta-antiga');
  // com um arquivo preso de verdade (Windows): a linha de comando recusa em português, saída 1
  if (process.platform !== 'win32') return;
  const s = pastaAntiga();
  aplicarComCodigo(s);
  const preso = path.join(s, 'empresas', 'principal', 'saidas', 'reels', 'run-1', 'video.mp4');
  const marcador = path.join(pastaTemp('migrar-preso-'), 'pronto');
  const ps = require('child_process').spawn('powershell.exe', ['-NoProfile', '-Command',
    `$f=[System.IO.File]::Open('${preso.replace(/'/g, "''")}','Open','Read','Read'); Set-Content -Path '${marcador.replace(/'/g, "''")}' -Value 1; Start-Sleep 20; $f.Close()`], { stdio: 'ignore' });
  for (let i = 0; i < 400 && !fs.existsSync(marcador); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
  try {
    assert.ok(fs.existsSync(marcador), 'o arquivo não foi preso a tempo');
    const x = cli(s, ['desfazer', '--confirmar']);
    assert.strictEqual(x.status, 1, x.saida + x.erro);
    assert.ok(!/EBUSY|resource|rename|inesperado/.test(x.saida + x.erro) && !(x.saida + x.erro).includes(s), x.saida + x.erro);
    // a recusa sai na saída padrão (Tarefa 9: a conversa mostra essa saída)
    assert.ok(/feche/i.test(x.saida), x.saida + x.erro);
    assert.strictEqual(migrar.estado(s).situacao, 'interrompida');
  } finally {
    ps.kill();
  }
  let ok = false;
  for (let i = 0; i < 100 && !ok; i++) {
    try { desfazer(s); ok = true; } catch (err) {
      if (err.code !== 'ARQUIVO_PRESO') throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
  assert.ok(ok, 'o desfazer não terminou depois de soltar o arquivo');
  legadoVirtual(s);
});

t('trava abandonada no desfazer e no estado', () => {
  // p2 C: só a trava, nenhuma mudança
  const r = pastaAntiga();
  travaMorta(r);
  const est = migrar.estado(r);
  assert.strictEqual(est.situacao, 'pasta-antiga');
  assert.ok(est.pendencias.some((p) => p.tipo === 'trava-abandonada'), JSON.stringify(est));
  const e = lancaCom('NADA_A_DESFAZER', () => desfazer(r));
  assert.match(e.message, /nada foi alterado/i);
  semTrava(r);
  // p2 D: mudança anterior já desfeita
  const s = pastaAntiga();
  aplicarComCodigo(s);
  desfazer(s);
  travaMorta(s, 'aplicar');
  assert.strictEqual(migrar.estado(s).situacao, 'pasta-antiga');
  lancaCom('NADA_A_DESFAZER', () => desfazer(s));
  semTrava(s);
  // morte entre criar a pasta da mudança e gravar o registro (sem manifesto): nunca começou
  const p = pastaAntiga();
  travaMorta(p);
  fs.mkdirSync(path.join(p, '_fabrica', '_backup', 'migracao-20260101-101010'), { recursive: true });
  assert.strictEqual(migrar.estado(p).situacao, 'pasta-antiga');
  lancaCom('NADA_A_DESFAZER', () => desfazer(p));
  semTrava(p);
  // pela linha de comando: estado sai 0 e diz a verdade
  const q = pastaAntiga();
  travaMorta(q);
  const x = cli(q, ['estado']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.match(x.saida, /interrompida antes de gravar/);
});

t('estado com a virada feita e sem fechamento', () => {
  // p9: processo morto entre a virada do índice e o fechamento
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { res } = aplicarComCodigo(r);
  const arqM = path.join(r, ...res.pastaBackup.split('/'), 'manifesto.json');
  const m = JSON.parse(fs.readFileSync(arqM, 'utf8'));
  m.status = 'copiando';
  delete m.indiceDepois;
  m.fim = null;
  fs.writeFileSync(arqM, JSON.stringify(m, null, 2));
  fs.unlinkSync(path.join(r, ...res.relatorio.split('/')));
  travaMorta(r);
  const est = migrar.estado(r);
  assert.strictEqual(est.situacao, 'interrompida');
  const texto = est.pendencias.map((p) => p.mensagem).join(' ');
  assert.ok(!/lugares de sempre/.test(texto), 'a Fábrica já usa a pasta da empresa: ' + texto);
  assert.match(texto, /pasta da empresa/);
  desfazer(r);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), antes);
});

t('dois desfazer ao mesmo tempo', () => {
  // p7: dois pedidos de desfazer em processos separados, com uma trava abandonada no caminho
  const r = pastaAntiga();
  for (let i = 0; i < 60; i++) escrever(r, `02-PUBLICACOES/lote/p${i}.png`, binario(800, 'p' + i));
  const antes = foraDoBackup(retrato(r));
  aplicarComCodigo(r);
  travaMorta(r, 'desfazer');
  const roteiro = `const { spawn } = require('child_process');
const corre = () => new Promise((ok) => { const c = spawn(process.execPath, [${JSON.stringify(SCRIPT)}, 'desfazer', '--confirmar', '--json'], { env: { ...process.env, FABRICA_RAIZ: process.env.R_TESTE } }); let o = ''; c.stdout.on('data', (d) => (o += d)); c.on('exit', (s) => ok({ s, o })); });
Promise.all([corre(), corre()]).then((x) => console.log(JSON.stringify(x)));`;
  const x = spawnSync(process.execPath, ['-e', roteiro], { env: { ...process.env, R_TESTE: r }, encoding: 'utf8', timeout: 240000 });
  const saidas = JSON.parse(x.stdout);
  assert.deepStrictEqual(saidas.map((s) => s.s).sort(), [0, 1], x.stdout + x.stderr);
  const recusado = JSON.parse(saidas.find((s) => s.s === 1).o);
  assert.ok(['MIGRACAO_EM_ANDAMENTO', 'NADA_A_DESFAZER'].includes(recusado.code), recusado.code);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), antes);
  legadoVirtual(r);
  semTrava(r);
});

// ---------- Tarefa 5, rodada de correção 2 (sondas da revisão: p11, p13 V) ----------

t('morte no meio da restauração', () => {
  // p11: a pessoa apagou antigos depois da mudança; o desfazer morre no meio da cópia que os traz de volta
  for (const fase of ['temporario-pronto', 'final-pronto']) {
    const r = pastaAntiga();
    const antes = foraDoBackup(retrato(r));
    aplicarComCodigo(r);
    fs.rmSync(path.join(r, '02-PUBLICACOES'), { recursive: true });
    fs.unlinkSync(path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'));
    morreAoGravar(r, 'desfazer', { confirmar: true }, fase, 1);
    // nunca um arquivo final pela metade
    for (const p of ['02-PUBLICACOES/2026-10/peca-1/lamina-1.png', '06-MARCA-E-FOTOS/marca.yaml']) {
      if (existe(r, p)) assert.strictEqual(sha(ler(r, p)), antes.arquivos[p].sha256, `${fase}: ${p} ficou pela metade`);
    }
    // o índice ainda não voltou: o estado diz a verdade
    assert.strictEqual(empresa.listar(r)[0].disposicao, 'gaveta');
    const est = migrar.estado(r);
    assert.strictEqual(est.situacao, 'interrompida');
    const texto = est.pendencias.map((p) => p.mensagem).join(' ');
    assert.ok(/ainda usa a pasta da empresa/.test(texto) && !/lugares de sempre/.test(texto), fase + ': ' + texto);
    // repetir: continua, e a pasta fica igual à de antes (sem temporário e sem "editado pela pessoa")
    const d = desfazer(r);
    assert.deepStrictEqual(d.mantidos, [], fase + ': ' + JSON.stringify(d.mantidos));
    const voltaram = ['02-PUBLICACOES/2026-10/peca-1/lamina-1.png', '06-MARCA-E-FOTOS/marca.yaml'];
    // No Windows a cópia leva a data exata do arquivo (até a fração do milissegundo): o retrato é idêntico, com datas.
    if (process.platform === 'win32') assert.deepStrictEqual(foraDoBackup(retrato(r)), antes, fase + ': datas');
    assert.deepStrictEqual(semDatas(foraDoBackup(retrato(r)), voltaram), semDatas(antes, voltaram), fase);
    assert.deepStrictEqual(temporarios(r), []);
    legadoVirtual(r);
  }
});

t('morte no meio do levar', () => {
  // p13 V: o desfazer --levar-novos morre no meio da cópia de um arquivo novo para o lugar antigo
  for (const fase of ['temporario-pronto', 'final-pronto']) {
    const r = pastaAntiga();
    const antes = foraDoBackup(retrato(r));
    aplicarComCodigo(r);
    const novo = binario(5000, 'novo-' + fase);
    escrever(r, 'empresas/principal/saidas/reels/run-9/novo.mp4', novo);
    morreAoGravar(r, 'desfazer', { confirmar: true, levarNovos: true }, fase, 1);
    if (existe(r, 'linhas/reels/saida/run-9/novo.mp4')) assert.ok(ler(r, 'linhas/reels/saida/run-9/novo.mp4').equals(novo), fase + ': final pela metade');
    // repetir não dá conflito eterno: termina, e o novo está no lugar antigo, inteiro
    const d = desfazer(r, { levarNovos: true });
    assert.deepStrictEqual(d.mantidos, [], fase);
    assert.ok(ler(r, 'linhas/reels/saida/run-9/novo.mp4').equals(novo), fase);
    const agora = foraDoBackup(retrato(r));
    delete agora.arquivos['linhas/reels/saida/run-9/novo.mp4'];
    agora.pastas = agora.pastas.filter((p) => p !== 'linhas/reels/saida/run-9');
    assert.deepStrictEqual(agora, antes, fase);
    assert.deepStrictEqual(temporarios(r), []);
    legadoVirtual(r);
  }
});

t('restauração traduzida interrompida não vira "editado"', () => {
  // O JSON dos painéis apagado volta pela tradução ao contrário, com bytes diferentes do original (aqui, CRLF). Se o
  // desfazer morre logo depois de dar o nome final, quem repetir reconhece o arquivo pelo sha256 registrado.
  const r = pastaAntiga();
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', JSON.stringify(PECAS, null, 2).replace(/\n/g, '\r\n') + '\r\n');
  aplicarComCodigo(r);
  fs.unlinkSync(path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'));
  morreAoGravar(r, 'desfazer', { confirmar: true }, 'final-pronto', 1);
  assert.ok(existe(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json'));
  const d = desfazer(r);
  assert.deepStrictEqual(d.mantidos, [], JSON.stringify(d.mantidos));
  assert.deepStrictEqual(JSON.parse(ler(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json').toString('utf8')), PECAS);
  assert.deepStrictEqual(temporarios(r), []);
  legadoVirtual(r);
});

// =====================================================================
// Tarefa 6: retirar os antigos (opcional) e desfazer depois da retirada
// (e dois menores das revisões: temporário fora do inventário e cópia sem link nunca por cima)
// =====================================================================

const retirar = (r, opcoes = {}, carimbo) => migrar.retirar(r, carimbo, { confirmar: true, ...opcoes });
const guardadosEm = (carimbo) => `${BACKUP}migracao-${carimbo}/antigos/`;
const logoSomenteLeitura = (r) => fs.chmodSync(path.join(r, '06-MARCA-E-FOTOS', 'logo.png'), 0o444);
// Cada antigo está no lugar de antes ou guardado (ou nos dois, o mesmo arquivo), inteiro, com data e modo de antes.
function nadaSePerdeu(r, inv, carimbo, antes, rotulo = '') {
  const agora = retrato(r);
  for (const i of inv.itens) {
    const noLugar = agora.arquivos[i.de];
    const guardado = agora.arquivos[guardadosEm(carimbo) + i.de];
    assert.ok(noLugar || guardado, `${rotulo}${i.de} sumiu`);
    for (const x of [noLugar, guardado]) if (x) assert.deepStrictEqual(x, antes.arquivos[i.de], `${rotulo}${i.de} não está inteiro`);
  }
}
const naoTemporario = (r) => assert.deepStrictEqual(temporarios(r), [], 'sobrou arquivo temporário');

t('temporário da Fábrica fora do inventário', () => {
  // Um temporário que sobrou de uma gravação interrompida nunca vai para a pasta da empresa nem para a lista.
  const r = pastaAntiga();
  escrever(r, 'linhas/reels/saida/run-1/.video.mp4.migracao-tmp', binario(100, 'tmp'));
  escrever(r, '06-MARCA-E-FOTOS/fotos/.retrato.jpg.migracao-tmp', binario(50, 'tmp2'));
  const inv = migrar.simular(r);
  assert.deepStrictEqual(inv.recusas, [], JSON.stringify(inv.recusas));
  assert.ok(!inv.itens.some((i) => i.de.endsWith('.migracao-tmp')), JSON.stringify(inv.itens.map((i) => i.de)));
  assert.ok(!inv.ficam.some((f) => f.caminho.endsWith('.migracao-tmp')), JSON.stringify(inv.ficam));
  assert.strictEqual(inv.itens.length, ESPERADOS.length);
  aplicarComCodigo(r);
  assert.strictEqual(existe(r, 'empresas/principal/saidas/reels/run-1/.video.mp4.migracao-tmp'), false);
});

t('cópia sem link nunca grava por cima', () => {
  // Disco sem link (o nome final não nasce com exclusividade): um arquivo que aparece no destino logo depois de qualquer
  // conferência nunca é substituído pela cópia.
  const r = pastaAntiga();
  const inv = migrar.simular(r);
  const alvo = inv.itens[2];
  const finalAbs = path.join(r, ...alvo.para.split('/'));
  const intruso = Buffer.from('gravado por outro programa\n');
  const antes = foraDoBackup(retrato(r));
  const original = { link: fs.linkSync, existe: fs.existsSync };
  fs.linkSync = () => { const e = new Error('EPERM: operation not permitted, link'); e.code = 'EPERM'; throw e; };
  // quem perguntar se o destino existe ouve "não": é o arquivo que aparece logo depois da pergunta
  fs.existsSync = (p) => (typeof p === 'string' && path.resolve(p) === finalAbs ? false : original.existe(p));
  try {
    const e = lancaCom('FALHA_NA_COPIA', () => migrar.aplicar(r, {
      confirmar: inv.codigoSimulacao,
      aoGravar: (fase, final) => { if (fase === 'temporario-pronto' && final === finalAbs) fs.writeFileSync(finalAbs, intruso, { flag: 'wx' }); },
    }));
    assert.match(e.message, /Nada mudou/);
  } finally {
    fs.linkSync = original.link;
    fs.existsSync = original.existe;
  }
  assert.ok(ler(r, alvo.para).equals(intruso), 'o arquivo de outro programa foi substituído pela cópia');
  const agora = foraDoBackup(retrato(r));
  delete agora.arquivos[alvo.para];
  assert.deepStrictEqual(agora.arquivos, antes.arquivos, 'sobrou cópia ou mudou um antigo');
  for (const p of agora.pastas) if (!antes.pastas.includes(p)) assert.ok(alvo.para.startsWith(p + '/'), `sobrou a pasta ${p}`);
  naoTemporario(r);
  semTrava(r);
  legadoVirtual(r);
  // sem link e sem intruso, a cópia exclusiva funciona e não deixa temporário
  const s = pastaAntiga();
  fs.linkSync = () => { const e = new Error('EPERM: operation not permitted, link'); e.code = 'EPERM'; throw e; };
  try {
    aplicarComCodigo(s);
  } finally {
    fs.linkSync = original.link;
  }
  for (const i of inv.itens) if (!i.traduzir) assert.ok(ler(s, i.para).equals(ler(s, i.de)), i.para);
  naoTemporario(s);
});

t('retirar move, não apaga', () => {
  const r = pastaAntiga();
  logoSomenteLeitura(r);
  const antes = retrato(r);
  const { inv, res } = aplicarComCodigo(r);
  const copias = retrato(r);
  const x = retirar(r);
  const depois = retrato(r);
  assert.strictEqual(x.movidos, inv.itens.length);
  for (const i of inv.itens) {
    assert.ok(!(i.de in depois.arquivos), `${i.de} continua no lugar antigo`);
    assert.deepStrictEqual(depois.arquivos[guardadosEm(res.carimbo) + i.de], antes.arquivos[i.de], `${i.de}: o guardado não é o antigo (conteúdo, data ou modo)`);
    assert.deepStrictEqual(depois.arquivos[i.para], copias.arquivos[i.para], `${i.para}: a cópia da pasta da empresa mudou`);
  }
  // o resto (modelo, receitas, o que não tem lugar, as preferências e o que é comum) continua igual, no lugar
  const deItens = new Set(inv.itens.map((i) => i.de));
  for (const [p, v] of Object.entries(antes.arquivos)) if (!deItens.has(p)) assert.deepStrictEqual(depois.arquivos[p], v, p);
  assert.ok(depois.pastas.includes('06-MARCA-E-FOTOS'), 'a pasta da marca tem o exemplo e continua');
  for (const p of ['linhas/reels/passos/01.md', 'linhas/reels/dados/briefing.md', 'linhas/consultorio/dados/receita.md', '06-MARCA-E-FOTOS/exemplo/fontes/Exemplo.ttf', '04-LABORATORIO-DE-DESIGN/rascunho.md', '_fabrica/_memoria/preferencias.md']) {
    assert.ok(existe(r, p), p);
  }
  // as pastas que ficaram vazias dentro dos lugares saem e ficam registradas; a raiz de cada lugar fica
  const m = manifestoDe(r, res.carimbo);
  assert.strictEqual(m.status, 'retirada');
  for (const p of ['06-MARCA-E-FOTOS/fontes', '02-PUBLICACOES/2026-10', 'linhas/reels/saida/run-1', 'linhas/reels/_investigacoes/perfil-1']) {
    assert.ok(!depois.pastas.includes(p), `a pasta vazia ${p} ficou`);
    assert.ok(m.pastasRetiradas.includes(p), `${p} não foi registrada`);
  }
  for (const p of ['02-PUBLICACOES', 'linhas/reels/saida', 'linhas/reels/memoria', '03-CRONOGRAMA', '04-LABORATORIO-DE-DESIGN/dados', 'linhas/consultorio']) {
    assert.ok(depois.pastas.includes(p), `a raiz ${p} saiu`);
  }
  assert.deepStrictEqual([...x.pastasVazias].sort(), [...m.pastasRetiradas].sort());
  assert.match(ler(r, res.relatorio).toString('utf8'), /Guardados na cópia de segurança em /);
  semTrava(r);
  naoTemporario(r);
});

t('Fábrica funciona sem os antigos', () => {
  const r = pastaAntiga();
  const valor = (c, k) => (typeof c[k] === 'function' ? c[k]('reels') : c[k]);
  const L = empresa.caminhos('principal', r);
  const tinham = empresa.CHAVES_DE_CAMINHO.filter((k) => typeof valor(L, k) === 'string' && fs.existsSync(valor(L, k)));
  assert.ok(tinham.length >= 12, tinham.join(', '));
  aplicarComCodigo(r);
  retirar(r);
  const G = empresa.caminhos('principal', r);
  for (const k of tinham) assert.ok(fs.existsSync(valor(G, k)), `${k}: ${valor(G, k)} não existe`);
  for (const k of ['marca', 'perfil', 'estiloDeVideo']) assert.strictEqual(fs.existsSync(valor(L, k)), false, `${k}: o antigo continua`);
  assert.ok(fs.existsSync(path.join(G.saidas('consultorio'), 'run-2', 'texto.md')));
  assert.strictEqual(migrar.estado(r).situacao, 'organizada-antigos-retirados');
});

t('antigo mudou recusa tudo', () => {
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  fs.appendFileSync(path.join(r, 'linhas', 'reels', 'memoria', 'runs.md'), '- anotação de outra conversa\n');
  fs.unlinkSync(path.join(r, '06-MARCA-E-FOTOS', 'pecas', 'elemento.png'));
  const antes = retrato(r);
  const e = lancaCom('ANTIGOS_MUDARAM', () => retirar(r));
  assert.ok(e.arquivos.includes('linhas/reels/memoria/runs.md'), JSON.stringify(e.arquivos));
  assert.ok(e.arquivos.includes('06-MARCA-E-FOTOS/pecas/elemento.png'), JSON.stringify(e.arquivos));
  assert.ok(!PALAVRAS_PROIBIDAS.test(e.message) && !e.message.includes(r), e.message);
  assert.deepStrictEqual(retrato(r), antes, 'algo foi movido');
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'aplicada');
  semTrava(r);
});

t('novo no lugar antigo recusa', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  escrever(r, '02-PUBLICACOES/2026-11/nova.png', binario(300, 'nova'));
  const antes = retrato(r);
  const e = lancaCom('ANTIGOS_MUDARAM', () => retirar(r));
  assert.deepStrictEqual(e.arquivos, ['02-PUBLICACOES/2026-11/nova.png']);
  assert.deepStrictEqual(retrato(r), antes, 'algo foi movido');
  semTrava(r);
});

t('cópia ausente recusa', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  fs.unlinkSync(path.join(r, 'empresas', 'principal', 'fotos', 'retrato.jpg'));
  const antes = retrato(r);
  const e = lancaCom('COPIA_AUSENTE', () => retirar(r));
  assert.deepStrictEqual(e.arquivos, ['empresas/principal/fotos/retrato.jpg']);
  assert.deepStrictEqual(retrato(r), antes);
  semTrava(r);
});

t('desfazer depois de retirar', () => {
  const r = pastaAntiga();
  logoSomenteLeitura(r);
  const antes = retrato(r);
  const { res } = aplicarComCodigo(r);
  retirar(r);
  const d = desfazer(r);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), 'a pasta não voltou a ser como era (conteúdo, data, modo ou pastas)');
  legadoVirtual(r);
  assert.ok(d.trazidosDaCopia.length > 0);
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'desfeita');
  assert.strictEqual(migrar.estado(r).situacao, 'pasta-antiga');
  // nada ficou para trás na cópia de segurança dos antigos
  const sobrou = Object.keys(retrato(r).arquivos).filter((p) => p.startsWith(guardadosEm(res.carimbo)));
  assert.deepStrictEqual(sobrou, []);
  semTrava(r);
  // um arquivo que já estava na pasta da empresa, igual, também é guardado e volta
  const s = pastaAntiga();
  escrever(s, 'empresas/principal/marca.yaml', MARCA);
  fs.utimesSync(path.join(s, 'empresas', 'principal', 'marca.yaml'), new Date(), new Date(2020, 0, 1));
  const antesS = retrato(s);
  const { res: resS } = aplicarComCodigo(s);
  retirar(s);
  assert.strictEqual(existe(s, '06-MARCA-E-FOTOS/marca.yaml'), false, 'o antigo igual ao da pasta da empresa ficou');
  assert.ok(existe(s, guardadosEm(resS.carimbo) + '06-MARCA-E-FOTOS/marca.yaml'));
  desfazer(s);
  assert.deepStrictEqual(foraDoBackup(retrato(s)), foraDoBackup(antesS));
});

t('retirar duas vezes', () => {
  const r = pastaAntiga();
  lancaCom('NAO_HA_O_QUE_RETIRAR', () => retirar(r));
  aplicarComCodigo(r);
  retirar(r);
  const antes = retrato(r);
  const e = lancaCom('NAO_HA_O_QUE_RETIRAR', () => retirar(r));
  assert.match(e.message, /cópia de segurança/);
  assert.deepStrictEqual(retrato(r), antes);
  desfazer(r);
  lancaCom('NAO_HA_O_QUE_RETIRAR', () => retirar(r));
  lancaCom('USO', () => migrar.retirar(r, undefined, {}));
  semTrava(r);
});

t('retirar com trava viva', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  escrever(r, 'empresas/.migracao.lock', json({ pid: process.pid, acao: 'aplicar' }));
  const antes = retrato(r);
  lancaCom('MIGRACAO_EM_ANDAMENTO', () => retirar(r));
  assert.deepStrictEqual(retrato(r), antes);
});

t('morte no meio da retirada', () => {
  for (const fase of ['ligado', 'movido']) {
    const r = pastaAntiga();
    logoSomenteLeitura(r);
    const antes = retrato(r);
    const { inv, res } = aplicarComCodigo(r);
    morreAoGravar(r, 'retirar', { confirmar: true }, fase, 3);
    nadaSePerdeu(r, inv, res.carimbo, antes, fase + ': ');
    // o estado diz a verdade, e a Fábrica usa a pasta da empresa, completa
    const est = migrar.estado(r);
    assert.strictEqual(est.situacao, 'interrompida', fase);
    assert.ok(est.pendencias.some((p) => p.tipo === 'retirada-pela-metade' && /de novo/.test(p.mensagem) && /pasta da empresa/.test(p.mensagem)), JSON.stringify(est));
    assert.ok(!PALAVRAS_PROIBIDAS.test(cli(r, ['estado']).saida));
    assert.strictEqual(empresa.listar(r)[0].disposicao, 'gaveta');
    for (const i of inv.itens) assert.ok(existe(r, i.para), i.para);
    assert.strictEqual(migrar.simular(r).situacao, 'interrompida');
    // repetir continua de onde parou
    const x = retirar(r);
    assert.strictEqual(x.movidos, inv.itens.length);
    const depois = retrato(r);
    for (const i of inv.itens) {
      assert.ok(!(i.de in depois.arquivos), `${fase}: ${i.de} ficou`);
      assert.deepStrictEqual(depois.arquivos[guardadosEm(res.carimbo) + i.de], antes.arquivos[i.de], `${fase}: ${i.de}`);
    }
    assert.strictEqual(manifestoDe(r, res.carimbo).status, 'retirada');
    assert.strictEqual(migrar.estado(r).situacao, 'organizada-antigos-retirados');
    semTrava(r);
    // e desfazer traz tudo de volta
    desfazer(r);
    assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), fase);
    naoTemporario(r);
  }
});

t('arquivo preso na retirada', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const { inv, res } = aplicarComCodigo(r);
  let k = 0;
  const preso = () => { if (++k === 3) { const x = new Error('EBUSY: resource busy or locked, unlink'); x.code = 'EBUSY'; throw x; } };
  const e = lancaCom('ARQUIVO_PRESO', () => retirar(r, { aoMover: preso }));
  assert.ok(!/EBUSY|resource|unlink/.test(e.message) && !e.message.includes(r), 'mensagem técnica ou em inglês: ' + e.message);
  assert.match(e.message, /de novo/);
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'retirando');
  semTrava(r);
  nadaSePerdeu(r, inv, res.carimbo, antes);
  assert.strictEqual(migrar.estado(r).situacao, 'interrompida');
  // dá para desfazer a qualquer momento, mesmo com a retirada pela metade
  desfazer(r);
  assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes));
  legadoVirtual(r);
  // ou, em outra pasta, pedir de novo e terminar
  const s = pastaAntiga();
  aplicarComCodigo(s);
  k = 0;
  lancaCom('ARQUIVO_PRESO', () => retirar(s, { aoMover: preso }));
  retirar(s);
  assert.strictEqual(migrar.estado(s).situacao, 'organizada-antigos-retirados');
});

t('desfazer depois de retirar leva o que foi feito depois', () => {
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { res } = aplicarComCodigo(r);
  retirar(r);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'plano feito depois\n');
  const runsNovo = Buffer.concat([ler(r, 'empresas/principal/memoria/reels/runs.md'), Buffer.from('- run-9\n')]);
  escrever(r, 'empresas/principal/memoria/reels/runs.md', runsNovo);
  const meio = retrato(r);
  const e = lancaCom('NOVOS_NA_PASTA_DA_EMPRESA', () => desfazer(r));
  assert.deepStrictEqual([...e.arquivos].sort(), ['empresas/principal/memoria/reels/runs.md', 'empresas/principal/saidas/reels/run-9/plano.md']);
  assert.deepStrictEqual(retrato(r), meio, 'mudou algo');
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'retirada');
  const d = desfazer(r, { levarNovos: true });
  assert.deepStrictEqual([...d.levadosDeVolta].sort(), ['linhas/reels/memoria/runs.md', 'linhas/reels/saida/run-9/plano.md']);
  assert.strictEqual(ler(r, 'linhas/reels/saida/run-9/plano.md').toString('utf8'), 'plano feito depois\n');
  assert.ok(ler(r, 'linhas/reels/memoria/runs.md').equals(runsNovo), 'a memória editada depois não voltou');
  assert.strictEqual(sha(ler(r, `${BACKUP}migracao-${res.carimbo}/substituidos/linhas/reels/memoria/runs.md`)), antes.arquivos['linhas/reels/memoria/runs.md'].sha256, 'o original não foi guardado');
  const agora = foraDoBackup(retrato(r));
  for (const p of ['linhas/reels/memoria/runs.md', 'linhas/reels/saida/run-9/plano.md']) delete agora.arquivos[p];
  agora.pastas = agora.pastas.filter((p) => p !== 'linhas/reels/saida/run-9');
  const esperado = JSON.parse(JSON.stringify(antes));
  delete esperado.arquivos['linhas/reels/memoria/runs.md'];
  assert.deepStrictEqual(agora, esperado);
  legadoVirtual(r);
  semTrava(r);
});

t('conflito ao trazer de volta', () => {
  // depois da retirada, outra conversa (com os lugares antigos guardados) grava num lugar de antes
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  retirar(r);
  escrever(r, 'linhas/reels/memoria/runs.md', 'escrito por outra conversa\n');
  const antes = retrato(r);
  const e = lancaCom('CONFLITO_AO_LEVAR', () => desfazer(r, { levarNovos: true }));
  assert.deepStrictEqual(e.arquivos, ['linhas/reels/memoria/runs.md']);
  assert.deepStrictEqual(retrato(r), antes, 'copiou ou moveu algo');
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'retirada');
  lancaCom('CONFLITO_AO_LEVAR', () => desfazer(r));
  assert.deepStrictEqual(retrato(r), antes);
  semTrava(r);
});

t('trazer de volta nunca grava por cima', () => {
  // outra conversa grava no lugar de antes exatamente quando o guardado ia voltar para lá
  const r = pastaAntiga();
  const antes = retrato(r);
  const { inv, res } = aplicarComCodigo(r);
  retirar(r);
  const alvo = 'linhas/reels/memoria/runs.md';
  const intruso = Buffer.from('gravado por outra conversa agora\n');
  const e = lancaCom('CONFLITO_AO_LEVAR', () => desfazer(r, { aoMover: (rel) => { if (rel === alvo) escrever(r, alvo, intruso); } }));
  assert.deepStrictEqual(e.arquivos, [alvo]);
  assert.ok(ler(r, alvo).equals(intruso), 'o arquivo da outra conversa foi substituído');
  assert.deepStrictEqual(retrato(r).arquivos[guardadosEm(res.carimbo) + alvo], antes.arquivos[alvo], 'o guardado se perdeu');
  // os outros antigos estão inteiros (no lugar ou guardados), e o estado diz que o desfazer ficou pela metade
  nadaSePerdeu(r, { itens: inv.itens.filter((i) => i.de !== alvo) }, res.carimbo, antes);
  assert.strictEqual(migrar.estado(r).situacao, 'interrompida');
  semTrava(r);
});

t('morte no meio do desfazer depois da retirada', () => {
  for (const fase of ['ligado', 'movido']) {
    const r = pastaAntiga();
    const antes = retrato(r);
    const { inv, res } = aplicarComCodigo(r);
    retirar(r);
    morreAoGravar(r, 'desfazer', { confirmar: true }, fase, 2);
    nadaSePerdeu(r, inv, res.carimbo, antes, fase + ': ');
    const est = migrar.estado(r);
    assert.strictEqual(est.situacao, 'interrompida', fase);
    assert.ok(est.pendencias.some((p) => p.tipo === 'desfazer-pela-metade'), JSON.stringify(est));
    desfazer(r);
    assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), fase);
    naoTemporario(r);
    legadoVirtual(r);
  }
});

t('retirar e desfazer sem link no disco', () => {
  // a cópia de segurança em outro disco (ou um disco sem link): copia, confere e só então tira o de origem
  const r = pastaAntiga();
  logoSomenteLeitura(r);
  const antes = retrato(r);
  const { inv, res } = aplicarComCodigo(r);
  const original = fs.linkSync;
  fs.linkSync = () => { const e = new Error('EXDEV: cross-device link not permitted, link'); e.code = 'EXDEV'; throw e; };
  try {
    retirar(r);
    const agora = retrato(r);
    for (const i of inv.itens) {
      assert.ok(!(i.de in agora.arquivos), i.de);
      const g = agora.arquivos[guardadosEm(res.carimbo) + i.de];
      const a = antes.arquivos[i.de];
      assert.deepStrictEqual([g.sha256, g.bytes, g.modo, Math.floor(g.mtimeMs)], [a.sha256, a.bytes, a.modo, Math.floor(a.mtimeMs)], i.de);
    }
    naoTemporario(r);
    desfazer(r);
  } finally {
    fs.linkSync = original;
  }
  const semMs = (ret) => JSON.parse(JSON.stringify(ret, (k, v) => (k === 'mtimeMs' ? Math.floor(v) : v)));
  assert.deepStrictEqual(semMs(foraDoBackup(retrato(r))), semMs(foraDoBackup(antes)));
  if (process.platform === 'win32') assert.deepStrictEqual(foraDoBackup(retrato(r)), foraDoBackup(antes), 'datas');
  naoTemporario(r);
});

t('CLI do retirar', () => {
  const r = pastaAntiga();
  const nada = cli(r, ['retirar', '--confirmar', '--json']);
  assert.strictEqual(nada.status, 1, nada.saida + nada.erro);
  assert.strictEqual(JSON.parse(nada.saida).code, 'NAO_HA_O_QUE_RETIRAR');
  const inv = migrar.simular(r);
  assert.strictEqual(cli(r, ['aplicar', '--confirmar', inv.codigoSimulacao]).status, 0);
  const antes = retrato(r);
  const x = cli(r, ['retirar']);
  assert.strictEqual(x.status, 2, x.saida + x.erro);
  assert.deepStrictEqual(retrato(r), antes);
  // ver antes, sem gravar nada
  const v = cli(r, ['retirar', '--simular']);
  assert.strictEqual(v.status, 0, v.saida + v.erro);
  assert.ok(v.saida.includes(`${inv.itens.length} arquivos`), v.saida);
  assert.ok(!PALAVRAS_PROIBIDAS.test(v.saida) && !v.saida.includes(r) && !/node |migrar\.js/.test(v.saida), v.saida);
  const vj = JSON.parse(cli(r, ['retirar', '--simular', '--json']).saida);
  assert.strictEqual(vj.arquivos, inv.itens.length);
  assert.strictEqual(vj.bytes, inv.bytes);
  assert.deepStrictEqual(vj.recusas, []);
  assert.deepStrictEqual(retrato(r), antes, 'ver antes gravou algo');
  const c = cli(r, ['retirar', '20000101-000000', '--confirmar']);
  assert.strictEqual(c.status, 1, c.saida + c.erro);
  assert.match(c.erro + c.saida, /não existe/);
  // com recusa, sai 1 e diz por quê, sem termo técnico
  fs.appendFileSync(path.join(r, 'linhas', 'reels', 'memoria', 'runs.md'), '- outra conversa\n');
  const rv = cli(r, ['retirar', '--simular']);
  assert.strictEqual(rv.status, 1, rv.saida + rv.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(rv.saida + rv.erro), rv.saida + rv.erro);
  const rc = cli(r, ['retirar', '--confirmar']);
  assert.strictEqual(rc.status, 1, rc.saida + rc.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(rc.saida + rc.erro) && !(rc.saida + rc.erro).includes(r), rc.saida + rc.erro);
  fs.writeFileSync(path.join(r, 'linhas', 'reels', 'memoria', 'runs.md'), '# Runs\n- run-1\n');
  const st = fs.statSync(path.join(r, 'empresas', 'principal', 'memoria', 'reels', 'runs.md'));
  fs.utimesSync(path.join(r, 'linhas', 'reels', 'memoria', 'runs.md'), st.atime, st.mtime);
  const y = cli(r, ['retirar', '--confirmar']);
  assert.strictEqual(y.status, 0, y.saida + y.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(y.saida) && !y.saida.includes(r) && !/node |migrar\.js/.test(y.saida), y.saida);
  assert.match(y.saida, /cópia de segurança/);
  assert.ok(y.saida.includes(migrar.FRASE_DESFAZER), y.saida);
  const z = cli(r, ['retirar', '--confirmar', '--json']);
  assert.strictEqual(z.status, 1, z.saida + z.erro);
  assert.strictEqual(JSON.parse(z.saida).code, 'NAO_HA_O_QUE_RETIRAR');
  const est = cli(r, ['estado']);
  assert.match(est.saida, /guardados na cópia de segurança/);
  assert.ok(!PALAVRAS_PROIBIDAS.test(est.saida), est.saida);
  const d = cli(r, ['desfazer', '--confirmar']);
  assert.strictEqual(d.status, 0, d.saida + d.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(d.saida), d.saida);
  legadoVirtual(r);
});

// ---------- Tarefa 6, rodada de correção (sondas da revisão: p16 DR, p18) ----------

// Roda desfazer ou retirar num processo filho, num disco sem link, e mata o filho no meio da última cópia (do
// temporário para o nome final), deixando metade do final escrita. `alvo` é um pedaço do caminho do final.
// Com `zeros`, o resto do final fica com zeros até o tamanho cheio (o Windows reserva o tamanho antes de copiar).
function morreNaCopiaSemLink(r, funcao, alvo, { zeros = false } = {}) {
  const roteiro = `const fs = require('fs');
fs.linkSync = () => { const e = new Error('EPERM: operation not permitted, link'); e.code = 'EPERM'; throw e; };
const original = fs.copyFileSync;
fs.copyFileSync = (a, b, f) => {
  if (String(a).endsWith('.migracao-tmp') && String(b).split(require('path').sep).join('/').includes(process.env.ALVO_TESTE)) {
    const buf = fs.readFileSync(a);
    const metade = buf.subarray(0, Math.floor(buf.length / 2));
    fs.writeFileSync(b, process.env.ZEROS_TESTE === '1' ? Buffer.concat([metade, Buffer.alloc(buf.length - metade.length)]) : metade, { flag: 'wx' });
    process.exit(9);
  }
  return original(a, b, f);
};
const m = require(${JSON.stringify(path.join(__dirname, 'migrar.js'))});
if (process.env.F_TESTE === 'retirar') m.retirar(process.env.R_TESTE, undefined, { confirmar: true });
else m.desfazer(process.env.R_TESTE, undefined, { confirmar: true });`;
  const x = spawnSync(process.execPath, ['-e', roteiro], { env: { ...process.env, R_TESTE: r, F_TESTE: funcao, ALVO_TESTE: alvo, ZEROS_TESTE: zeros ? '1' : '0' }, encoding: 'utf8', timeout: 240000 });
  assert.strictEqual(x.status, 9, 'o filho devia morrer no meio da cópia: ' + x.stdout + x.stderr);
}
const incompletos = (r, carimbo) => Object.keys(retrato(r).arquivos).filter((p) => p.startsWith(`${BACKUP}migracao-${carimbo}/incompletos/`));
// Sem link, a data volta com a precisão do milissegundo (limite do utimes do Node).
const ateMs = (ret) => JSON.parse(JSON.stringify(ret, (k, v) => (k === 'mtimeMs' ? Math.floor(v) : v)));

t('cópia sem link pela metade: restaurar um antigo apagado', () => {
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { res } = aplicarComCodigo(r);
  fs.unlinkSync(path.join(r, 'linhas', 'reels', 'saida', 'run-1', 'video.mp4'));
  morreNaCopiaSemLink(r, 'desfazer', 'linhas/reels/saida/run-1/video.mp4');
  const d = desfazer(r);
  assert.deepStrictEqual(d.mantidos, [], 'a cópia pela metade virou "editado pela pessoa": ' + JSON.stringify(d.mantidos));
  assert.deepStrictEqual(ateMs(foraDoBackup(retrato(r))), ateMs(antes));
  assert.deepStrictEqual(incompletos(r, res.carimbo), [`${BACKUP}migracao-${res.carimbo}/incompletos/linhas/reels/saida/run-1/video.mp4`], 'o pedaço não foi guardado');
  naoTemporario(r);
  legadoVirtual(r);
});

t('cópia sem link pela metade: trazer um guardado de volta', () => {
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { res } = aplicarComCodigo(r);
  retirar(r);
  morreNaCopiaSemLink(r, 'desfazer', 'linhas/reels/saida/run-1/video.mp4');
  desfazer(r);
  assert.deepStrictEqual(ateMs(foraDoBackup(retrato(r))), ateMs(antes));
  assert.strictEqual(incompletos(r, res.carimbo).length, 1, 'o pedaço não foi guardado');
  naoTemporario(r);
  legadoVirtual(r);
});

t('cópia sem link pela metade: guardar na cópia de segurança', () => {
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { inv, res } = aplicarComCodigo(r);
  morreNaCopiaSemLink(r, 'retirar', 'antigos/linhas/reels/saida/run-1/video.mp4');
  const x = retirar(r);
  assert.strictEqual(x.movidos, inv.itens.length);
  assert.strictEqual(manifestoDe(r, res.carimbo).status, 'retirada');
  const g = ler(r, guardadosEm(res.carimbo) + 'linhas/reels/saida/run-1/video.mp4');
  assert.strictEqual(sha(g), antes.arquivos['linhas/reels/saida/run-1/video.mp4'].sha256, 'o guardado ficou pela metade');
  assert.strictEqual(incompletos(r, res.carimbo).length, 1, 'o pedaço não foi guardado');
  desfazer(r);
  assert.deepStrictEqual(ateMs(foraDoBackup(retrato(r))), ateMs(antes));
  naoTemporario(r);
});

t('temporário da volta sem link não sobra', () => {
  // p16 DR: sem link, o desfazer depois da retirada morre com o temporário da volta pronto; repetir não deixa sobra
  for (const fase of ['temporario-pronto', 'final-pronto']) {
    const r = pastaAntiga();
    const antes = foraDoBackup(retrato(r));
    aplicarComCodigo(r);
    retirar(r);
    const roteiro = `const fs = require('fs');
fs.linkSync = () => { const e = new Error('EPERM: operation not permitted, link'); e.code = 'EPERM'; throw e; };
const m = require(${JSON.stringify(path.join(__dirname, 'migrar.js'))});
m.desfazer(process.env.R_TESTE, undefined, { confirmar: true, aoGravar: (f) => { if (f === process.env.FASE_TESTE) process.exit(9); } });`;
    const x = spawnSync(process.execPath, ['-e', roteiro], { env: { ...process.env, R_TESTE: r, FASE_TESTE: fase }, encoding: 'utf8', timeout: 240000 });
    assert.strictEqual(x.status, 9, x.stdout + x.stderr);
    desfazer(r);
    naoTemporario(r);
    assert.deepStrictEqual(ateMs(foraDoBackup(retrato(r))), ateMs(antes), fase);
  }
});

// ---------- Tarefa 6, rodada de correção 2 (sonda da re-revisão: p20) ----------

t('cópia sem link pela metade, com zeros no fim', () => {
  // o Windows reserva o tamanho cheio antes de copiar: o pedaço é o começo do temporário seguido de zeros
  const r = pastaAntiga();
  const antes = foraDoBackup(retrato(r));
  const { res } = aplicarComCodigo(r);
  fs.unlinkSync(path.join(r, 'linhas', 'reels', 'saida', 'run-1', 'video.mp4'));
  morreNaCopiaSemLink(r, 'desfazer', 'linhas/reels/saida/run-1/video.mp4', { zeros: true });
  const x = cli(r, ['desfazer', '--confirmar']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.match(x.saida, /1 cópia que ficou pela metade foi guardada à parte/);
  assert.ok(!PALAVRAS_PROIBIDAS.test(x.saida) && !x.saida.includes(r), x.saida);
  assert.deepStrictEqual(ateMs(foraDoBackup(retrato(r))), ateMs(antes));
  assert.strictEqual(incompletos(r, res.carimbo).length, 1);
  assert.strictEqual(manifestoDe(r, res.carimbo).desfazer.incompletos, 1);
  naoTemporario(r);
});

// p20: o desfazer, num disco sem link, morre durante a gravação de um antigo; depois a pessoa (ou uma conversa antiga)
// grava o próprio arquivo naquele lugar de antes. Repetir nunca toma o arquivo dela por uma cópia nossa pela metade.
function morreAoGravarSemLink(r, fase, fim) {
  const roteiro = `const fs = require('fs');
fs.linkSync = () => { const e = new Error('EPERM: operation not permitted, link'); e.code = 'EPERM'; throw e; };
const m = require(${JSON.stringify(path.join(__dirname, 'migrar.js'))});
m.desfazer(process.env.R_TESTE, undefined, { confirmar: true, aoGravar: (f, final) => { if (f === process.env.FASE_TESTE && String(final).split(require('path').sep).join('/').endsWith(process.env.FIM_TESTE)) process.exit(9); } });`;
  const x = spawnSync(process.execPath, ['-e', roteiro], { env: { ...process.env, R_TESTE: r, FASE_TESTE: fase, FIM_TESTE: fim }, encoding: 'utf8', timeout: 240000 });
  assert.strictEqual(x.status, 9, 'o filho devia morrer na gravação: ' + x.stdout + x.stderr);
}

t('o arquivo da pessoa nunca vira cópia pela metade', () => {
  const alvo = 'linhas/reels/memoria/runs.md';
  const daPessoa = Buffer.from('# Runs\n- run-1\n- trabalho novo da pessoa, depois da parada\n');
  for (const [cenario, fase] of [['restaurar', 'temporario-pronto'], ['restaurar', 'final-pronto'], ['trazer', 'temporario-pronto']]) {
    const rotulo = `${cenario}/${fase}: `;
    const r = pastaAntiga();
    const { res } = aplicarComCodigo(r);
    if (cenario === 'restaurar') fs.unlinkSync(path.join(r, ...alvo.split('/')));
    else retirar(r);
    morreAoGravarSemLink(r, fase, alvo);
    escrever(r, alvo, daPessoa);
    if (cenario === 'trazer') {
      const e = lancaCom('CONFLITO_AO_LEVAR', () => desfazer(r));
      assert.deepStrictEqual(e.arquivos, [alvo], rotulo + JSON.stringify(e.arquivos));
    } else {
      const d = desfazer(r);
      assert.ok(d.mantidos.includes(alvo), rotulo + 'o arquivo da pessoa não ficou como ela deixou: ' + JSON.stringify(d.mantidos));
      assert.strictEqual(d.incompletos, 0, rotulo);
    }
    assert.ok(ler(r, alvo).equals(daPessoa), rotulo + 'o arquivo da pessoa foi trocado');
    assert.deepStrictEqual(incompletos(r, res.carimbo), [], rotulo + 'o arquivo da pessoa foi guardado como pedaço');
  }
});

// =====================================================================
// Tarefa 9: os textos ao usuário, a prévia em página e o relatório em página
// =====================================================================

// Todas as mensagens que a pessoa pode ver num inventário (avisos e recusas).
const mensagensDe = (inv) => [...inv.avisos, ...inv.recusas].map((x) => x.mensagem);
const PARENTESES_DE_PLURAL = /\((?:s|m|ns|es)\)/;

t('textos: concordância, sem formas com parênteses', () => {
  // um de cada: 1 conflito, 1 texto que cita lugar antigo, 1 referência fora dos campos, 1 linha em andamento
  const r = pastaAntiga();
  escrever(r, 'empresas/principal/marca.yaml', 'diferente\n');
  escrever(r, 'linhas/reels/memoria/runs.md', '# Runs\n- veja 02-PUBLICACOES/2026-10/peca-1\n');
  escrever(r, 'linhas/reels/estado.json', json({ status: 'executando' }));
  const um = migrar.simular(r);
  for (const m of mensagensDe(um)) assert.ok(!PARENTESES_DE_PLURAL.test(m), 'forma com parênteses: ' + m);
  const conflito = recusa(um, 'CONFLITO_NO_DESTINO').mensagem;
  assert.match(conflito, /já existe 1 arquivo diferente/, conflito);
  assert.match(um.avisos.find((a) => a.tipo === 'texto-cita-lugar-antigo').mensagem, /^1 texto cita lugares antigos\./);
  assert.match(um.avisos.find((a) => a.tipo === 'referencia-nao-traduzida').mensagem, /^1 referência antiga nos dados dos painéis fica como está/);
  assert.match(recusa(um, 'RUN_EM_ANDAMENTO').mensagem, /^Há um trabalho em andamento na linha reels\./);
  // dois de cada: plural certo
  escrever(r, 'empresas/principal/logo.png', 'outro\n');
  escrever(r, 'linhas/consultorio/memoria/memories.md', '# Memória\n- 03-CRONOGRAMA/dados/posts.json\n');
  escrever(r, 'linhas/consultorio/estado.json', json({ status: 'executando' }));
  const dois = migrar.simular(r);
  for (const m of mensagensDe(dois)) assert.ok(!PARENTESES_DE_PLURAL.test(m), 'forma com parênteses: ' + m);
  assert.match(recusa(dois, 'CONFLITO_NO_DESTINO').mensagem, /já existem 2 arquivos diferentes/);
  assert.match(dois.avisos.find((a) => a.tipo === 'texto-cita-lugar-antigo').mensagem, /^2 textos citam lugares antigos\./);
  assert.match(recusa(dois, 'RUN_EM_ANDAMENTO').mensagem, /^Há trabalho em andamento nas linhas consultorio e reels\./);
});

t('textos: rótulos sem dois-pontos duplos e a linha pelo nome dela', () => {
  const r = pastaAntiga();
  escrever(r, 'linhas/reels/linha.yaml', 'linha: reels\nnome: "Reels falado"\n');
  const inv = migrar.simular(r);
  for (const v of Object.values(migrar.GRUPOS)) assert.ok(!v.includes(':'), 'rótulo com dois-pontos: ' + v);
  const x = cli(r, ['simular']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.ok(x.saida.includes('Reels falado'), 'a linha devia aparecer pelo nome:\n' + x.saida);
  assert.ok(!/linha reels\b/.test(x.saida), 'a linha apareceu pelo código:\n' + x.saida);
  for (const l of x.saida.split(/\r?\n/)) assert.ok(!/:.*:\s*\d/.test(l), 'dois-pontos duplos: ' + l);
  // a linha sem nome no linha.yaml aparece pelo código (o caso da linha própria do teste)
  assert.ok(x.saida.includes('consultorio'), x.saida);
  // o nome da linha é texto de quem escreveu a linha: sem caractere de controle e com tamanho limitado no resumo
  escrever(r, 'linhas/reels/linha.yaml', 'nome: "Reels' + String.fromCharCode(7, 27) + '[31m falado ' + 'x'.repeat(200) + '"\n');
  const y = cli(r, ['simular']);
  assert.ok(![...y.saida].some((c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\r'), 'caractere de controle no resumo:\n' + JSON.stringify(y.saida));
  assert.ok(!y.saida.includes('x'.repeat(100)), 'nome de linha comprido demais no resumo');
  assert.strictEqual(inv.codigoSimulacao, migrar.simular(r).codigoSimulacao, 'o nome da linha não muda o que é feito');
});

t('textos: tamanho só quando faz diferença', () => {
  const r = pastaAntiga();
  const x = cli(r, ['simular']);
  assert.ok(!/\bbytes\b|\bKB\b/.test(x.saida), 'tamanho pequeno demais para importar:\n' + x.saida);
  assert.match(x.saida, /Total: \d+ arquivos, menos de 1 MB/, x.saida);
  escrever(r, 'linhas/reels/saida/run-1/grande.mp4', binario(3 * 1024 * 1024, 'grande'));
  const y = cli(r, ['simular']);
  assert.match(y.saida, /saídas da linha reels: \d+ arquivos, 3,0 MB/i, y.saida);
});

t('textos: o fim da simulação serve a quem não é técnico', () => {
  const r = pastaAntiga();
  const x = cli(r, ['simular']);
  assert.ok(!/confirme com este código/i.test(x.saida), x.saida);
  assert.match(x.saida, /diga que sim/i, x.saida);
});

t('textos: estado depois de organizar sem repetir a frase', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  const x = cli(r, ['estado']);
  const linhas = x.saida.split(/\r?\n/).filter(Boolean);
  assert.strictEqual(new Set(linhas).size, linhas.length, 'frase repetida:\n' + x.saida);
  assert.ok(!linhas.some((l, i) => linhas.some((o, j) => i !== j && o.includes(l))), 'uma linha repete a outra:\n' + x.saida);
});

t('textos: desfazer com o que foi feito depois, concordância', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'novo\n');
  const e = lancaCom('NOVOS_NA_PASTA_DA_EMPRESA', () => desfazer(r));
  assert.match(e.message, /^Há 1 arquivo feito ou mudado na pasta da empresa/, e.message);
  assert.match(e.message, /levá-lo de volta/, e.message);
  const x = cli(r, ['desfazer', '--levar-novos', '--confirmar']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.match(x.saida, /1 arquivo feito depois da organização voltou para os lugares de sempre\./, x.saida);
  // dois
  const s = pastaAntiga();
  aplicarComCodigo(s);
  escrever(s, 'empresas/principal/saidas/reels/run-9/plano.md', 'novo\n');
  escrever(s, 'empresas/principal/saidas/reels/run-9/roteiro.md', 'novo\n');
  assert.match(lancaCom('NOVOS_NA_PASTA_DA_EMPRESA', () => desfazer(s)).message, /^Há 2 arquivos feitos ou mudados .*levá-los de volta/);
});

t('textos: a recusa aparece na saída que a conversa mostra', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  escrever(r, 'empresas/principal/saidas/reels/run-9/plano.md', 'novo\n');
  const x = cli(r, ['desfazer', '--confirmar']);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.match(x.saida, /Há 1 arquivo feito ou mudado/, 'a recusa ficou só no erro:\n' + x.saida + '\n---\n' + x.erro);
  assert.ok(!PALAVRAS_PROIBIDAS.test(x.saida) && !x.saida.includes(r), x.saida);
  assert.ok(!/node |migrar\.js/.test(x.saida), x.saida);
});

t('textos: a frase de desfazer cita o comando da /fabrica', () => {
  assert.ok(migrar.FRASE_DESFAZER.includes('/fabrica organizar-pasta desfazer'), migrar.FRASE_DESFAZER);
  assert.ok(migrar.FRASE_DESFAZER.includes('desfazer a organização da pasta'), migrar.FRASE_DESFAZER);
  assert.ok(!PALAVRAS_PROIBIDAS.test(migrar.FRASE_DESFAZER));
});

// A prévia em página: numa pasta temporária FORA da Fábrica (a simulação não grava nada na Fábrica).
function previa(r, args = []) {
  const fora = pastaTemp('migrar-previa-');
  const x = cli(r, ['previa', '--pasta', fora, ...args]);
  return { x, fora, j: x.saida ? JSON.parse(x.saida) : null };
}

t('prévia: página fora da Fábrica, resumo curto e nada gravado na Fábrica', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const { x, fora, j } = previa(r);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.deepStrictEqual(retrato(r), antes, 'a prévia gravou algo na Fábrica');
  const inv = migrar.simular(r);
  assert.strictEqual(j.situacao, 'pasta-antiga');
  assert.strictEqual(j.codigoSimulacao, inv.codigoSimulacao);
  assert.strictEqual(j.podeOrganizar, true);
  assert.ok(Array.isArray(j.resumo) && j.resumo.length >= 3 && j.resumo.length <= 5, JSON.stringify(j.resumo));
  const resumo = j.resumo.join('\n');
  assert.ok(resumo.includes(`${inv.itens.length} arquivos`), resumo);
  assert.match(resumo, /Nada é apagado/);
  assert.ok(!PALAVRAS_PROIBIDAS.test(resumo) && !/node |migrar\.js/.test(resumo) && !resumo.includes(r), resumo);
  assert.ok(path.isAbsolute(j.pagina) && j.pagina.startsWith(fora + path.sep), j.pagina);
  assert.ok(!path.relative(r, j.pagina).split(path.sep).every((p) => p !== '..'), 'a página ficou dentro da Fábrica');
  assert.ok(fs.existsSync(j.pagina), 'a página não nasceu');
  assert.ok(j.endereco.startsWith('file:'), j.endereco);
  assert.ok(!fs.readdirSync(path.dirname(j.pagina)).some((n) => n.endsWith('.tmp') || n.endsWith('.migracao-tmp')), 'sobrou temporário');
  // duas prévias seguidas: duas páginas, uma não grava por cima da outra
  const outra = previa(r).j;
  assert.notStrictEqual(outra.pagina, j.pagina);
  // sem --pasta: a pasta temporária do sistema, nunca a Fábrica
  const y = cli(r, ['previa']);
  assert.strictEqual(y.status, 0, y.erro);
  const jy = JSON.parse(y.saida);
  temporarias.push(path.dirname(jy.pagina));
  assert.ok(path.relative(r, jy.pagina).startsWith('..'), jy.pagina);
  assert.deepStrictEqual(retrato(r), antes);
});

t('prévia: pasta dentro da Fábrica recusa sem gravar', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  for (const dentro of [r, path.join(r, 'empresas', 'principal', 'historico'), path.join(r, 'nova-pasta')]) {
    const x = cli(r, ['previa', '--pasta', dentro]);
    assert.strictEqual(x.status, 2, dentro + ': ' + x.saida + x.erro);
    assert.deepStrictEqual(retrato(r), antes, 'gravou algo com a pasta ' + dentro);
  }
  assert.strictEqual(cli(r, ['previa', '--pasta']).status, 2);
});

t('prévia: com recusa, o motivo no resumo e a página com o aviso', () => {
  const r = pastaAntiga();
  escrever(r, 'linhas/reels/estado.json', json({ status: 'executando' }));
  const { x, j } = previa(r);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.strictEqual(j.podeOrganizar, false);
  assert.ok(recusa(j, 'RUN_EM_ANDAMENTO').linhas.includes('reels'));
  assert.ok(j.resumo.join(' ').includes('Ainda não dá'), j.resumo.join('\n'));
  assert.ok(fs.readFileSync(j.pagina, 'utf8').includes('Ainda não dá'));
  // com a confirmação de que o trabalho está parado
  const z = previa(r, ['--run-parado-confirmado', 'reels']);
  assert.strictEqual(z.x.status, 0, z.x.saida + z.x.erro);
  assert.strictEqual(z.j.podeOrganizar, true);
  // pasta já organizada: sem página, só a frase
  const s = pastaAntiga();
  aplicarComCodigo(s);
  const w = previa(s).j;
  assert.strictEqual(w.situacao, 'ja-organizada');
  assert.strictEqual(w.pagina, null);
  assert.strictEqual(w.podeOrganizar, false);
});

t('aplicar: o fim curto na conversa e o relatório também em página', () => {
  const r = pastaAntiga();
  const inv = migrar.simular(r);
  const x = cli(r, ['aplicar', '--confirmar', inv.codigoSimulacao, '--json']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  const j = JSON.parse(x.saida);
  const html = `empresas/principal/historico/migracao-${j.carimbo}.html`;
  assert.strictEqual(j.relatorioPagina, html);
  assert.ok(existe(r, html), 'a página do relatório não nasceu');
  assert.ok(j.relatorioEndereco.startsWith('file:'), j.relatorioEndereco);
  assert.ok(Array.isArray(j.resumo) && j.resumo.length <= 6, JSON.stringify(j.resumo));
  const resumo = j.resumo.join('\n');
  assert.ok(resumo.includes(`${inv.itens.length} arquivos`) && /conferidos/.test(resumo), resumo);
  assert.match(resumo, /conversa nova/);
  assert.ok(resumo.includes(migrar.FRASE_DESFAZER), resumo);
  assert.ok(!resumo.includes(migrar.GRUPOS.publicacoes), 'a lista de grupos vai para a página, não para a conversa:\n' + resumo);
  assert.ok(!PALAVRAS_PROIBIDAS.test(resumo), resumo);
  const m = manifestoDe(r, j.carimbo);
  assert.strictEqual(m.pagina.arquivo, html);
  assert.strictEqual(m.pagina.sha256, sha(ler(r, html)));
});

t('desfazer leva a página junto, marcada como desfeita', () => {
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  const html = `empresas/principal/historico/migracao-${res.carimbo}.html`;
  const d = desfazer(r);
  assert.ok(!existe(r, html), 'a página ficou na pasta da empresa');
  const guardada = `${BACKUP}migracao-${res.carimbo}/desfeito/${html}`;
  assert.strictEqual(d.relatorioPagina, guardada);
  assert.match(ler(r, guardada).toString('utf8'), /Desfeita em/);
  // a página editada por alguém não é regravada: só vai junto, como está
  const s = pastaAntiga();
  const b = aplicarComCodigo(s).res;
  const htmlS = `empresas/principal/historico/migracao-${b.carimbo}.html`;
  escrever(s, htmlS, '<p>editada</p>\n');
  desfazer(s);
  assert.strictEqual(ler(s, `${BACKUP}migracao-${b.carimbo}/desfeito/${htmlS}`).toString('utf8'), '<p>editada</p>\n');
});

t('retirar marca a página do relatório', () => {
  const r = pastaAntiga();
  const { res } = aplicarComCodigo(r);
  retirar(r);
  const html = ler(r, `empresas/principal/historico/migracao-${res.carimbo}.html`).toString('utf8');
  assert.match(html, /guardados na cópia de segurança/);
  const m = manifestoDe(r, res.carimbo);
  assert.strictEqual(m.pagina.sha256, sha(Buffer.from(html, 'utf8')));
});

// Rodada de correção da Tarefa 9: o nome da empresa é texto de terceiros, limpo como o nome da linha.
const INVISIVEIS = (s) => [...s].filter((c) => { const k = c.codePointAt(0); return (k < 32 && c !== '\n' && c !== '\r') || (k >= 0x7f && k <= 0x9f) || (k >= 0x200b && k <= 0x200f) || (k >= 0x2028 && k <= 0x202e) || (k >= 0x2066 && k <= 0x2069); });
t('textos: o nome da empresa sai limpo no resumo, na conversa e nas páginas', () => {
  const r = pastaAntiga();
  const sujo = 'Aurora' + String.fromCharCode(0x202e) + 'oãçirtuN' + String.fromCharCode(7, 0x200b, 0x2066) + ' ' + 'y'.repeat(200);
  escrever(r, 'empresas/indice.json', json({ empresas: [{ codigo: 'principal', nome: sujo, disposicao: 'legado', criada: '2026-10-01' }] }));
  const inv = migrar.simular(r);
  assert.deepStrictEqual(INVISIVEIS(inv.nome), [], 'o nome do inventário tem caractere invisível');
  assert.ok(inv.nome.length <= 60, 'o nome passou de 60 letras: ' + inv.nome.length);
  const x = cli(r, ['simular']);
  assert.deepStrictEqual(INVISIVEIS(x.saida), [], 'caractere invisível no resumo');
  assert.ok(!x.saida.includes('y'.repeat(80)), 'nome comprido demais no resumo');
  const { j } = previa(r);
  assert.deepStrictEqual(INVISIVEIS(j.resumo.join('\n') + j.nome), [], 'caractere invisível na prévia');
  assert.deepStrictEqual(INVISIVEIS(fs.readFileSync(j.pagina, 'utf8')), [], 'caractere invisível na página da prévia');
  const a = JSON.parse(cli(r, ['aplicar', '--confirmar', j.codigoSimulacao, '--json']).saida);
  assert.deepStrictEqual(INVISIVEIS(a.resumo.join('\n')), [], 'caractere invisível no fim');
  assert.deepStrictEqual(INVISIVEIS(ler(r, a.relatorioPagina).toString('utf8') + ler(r, a.relatorio).toString('utf8')), [], 'caractere invisível no relatório');
});

t('textos: guardar os de antes mostra o tamanho só a partir de 1 MB', () => {
  const r = pastaAntiga();
  aplicarComCodigo(r);
  const p = cli(r, ['retirar', '--simular']);
  assert.ok(!/\bbytes\b|\bKB\b/.test(p.saida), p.saida);
  const x = cli(r, ['retirar', '--confirmar']);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.ok(!/\bbytes\b|\bKB\b/.test(x.saida), x.saida);
});

t('estado: a oferta ao criar a segunda empresa, sem gravar nada', () => {
  const r = pastaAntiga();
  const antes = retrato(r);
  const e0 = migrar.estado(r);
  assert.strictEqual(e0.empresas, 1);
  assert.strictEqual(e0.oferecer, false, 'uma empresa só: sem oferta');
  assert.deepStrictEqual(retrato(r), antes, 'o estado gravou algo');
  empresa.criar('boreal', 'Boreal Advocacia', r);
  const e1 = migrar.estado(r);
  assert.strictEqual(e1.empresas, 2);
  assert.strictEqual(e1.oferecer, true, 'a segunda empresa nasceu e a pasta antiga continua: oferta');
  const antes2 = retrato(r);
  migrar.estado(r);
  assert.deepStrictEqual(retrato(r), antes2, 'o estado gravou uma marca de "já ofereci"');
  empresa.criar('terceira', 'Terceira Empresa', r);
  assert.strictEqual(migrar.estado(r).oferecer, false, 'terceira empresa: sem oferta');
  // já organizada: sem oferta
  const s = pastaAntiga();
  empresa.criar('boreal', 'Boreal Advocacia', s);
  aplicarComCodigo(s);
  assert.strictEqual(migrar.estado(s).oferecer, false);
  const j = JSON.parse(cli(s, ['estado', '--json']).saida);
  assert.strictEqual(j.oferecer, false);
  assert.strictEqual(j.empresas, 2);
});

// ---------- fim ----------
console.log(`\n${n} testes passaram${pulados ? ` (${pulados} parte(s) pulada(s): o sistema não deixou criar atalho)` : ''}`);
for (const d of temporarias) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* pasta temporária presa: o sistema limpa depois */ }
}
