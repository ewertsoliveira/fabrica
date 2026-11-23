#!/usr/bin/env node
// O plano do mês no Cronograma: quais posts planejados ainda esperam a arte, e o registro de um plano inteiro.
//
//   node _fabrica/core/plano-do-mes.js planejados [--empresa <codigo>] [--tipos carrossel,post] [--json]
//       os posts do calendário com data de hoje em diante, do tipo pedido (padrão: carrossel e post) e ainda sem arte,
//       em ordem de data. Arte é o que a tela do calendário mostra como arte: imagens, vídeo ou prévia no próprio post,
//       ou uma peça do Laboratório ligada a ele (pelo postId da peça ou da aprovação).
//   node _fabrica/core/plano-do-mes.js registrar <arquivo.json> [--empresa <codigo>] [--json]
//       registra a lista de posts do arquivo no calendário, um por um, pelo registrar.js de sempre. Antes de gravar
//       qualquer coisa, confere todos: cada post precisa ser válido para o calendário, ter tipo reels, carrossel ou post,
//       roteiro (script) e legenda (caption), e um código (id) que não exista no calendário nem se repita no plano.
//       Se um registro falhar no meio, o calendário volta a ser o que era: ou entra o plano inteiro, ou nada.
//   node _fabrica/core/plano-do-mes.js conferir <arquivo.json> [--empresa <codigo>] [--json]
//       a mesma conferência do registrar, sem gravar nada: a proposta do plano roda antes de mostrar o plano à pessoa.
//
// Sem --empresa vale a empresa ativa. Os caminhos vêm do dados.caminhos dos painéis (formato antigo e pastas próprias).
// Saída: 0 deu certo, 1 recusado (com os motivos; nada gravado), 2 uso errado. Com --json, a lista (planejados),
// {"ok":true,"registrados":N}, {"ok":true,"posts":N} (conferir) ou {"ok":false,"erros":[...]}.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const dados = require('../paineis/dados');
const { tipoDoPost, TIPOS_ESCOLHIDOS } = require('../paineis/tipos-de-post');

const REGISTRAR = path.join(__dirname, '..', 'paineis', 'registrar.js');
const TIPOS_DO_PLANO = ['reels', 'carrossel', 'post'];

const texto = (v) => typeof v === 'string' && v.trim() !== '';
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function hojeLocal() {
  const d = new Date();
  const dois = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

function erro(code, mensagem, extra) {
  return Object.assign(new Error(mensagem), { code }, extra);
}

// A lista do calendário (posts.json). Arquivo que não é lista recusa, como no registrar.js.
function lerPosts(arq) {
  const lista = dados.lerJson(arq, []);
  if (!Array.isArray(lista)) throw erro('JSON_INVALIDO', `O arquivo ${arq} precisa ser uma lista de posts. Corrija o arquivo; nada foi alterado.`);
  return lista;
}

// Os códigos dos posts que já têm uma peça ligada, pela mesma regra da tela do calendário: a peça vale para o post da
// aprovação dela, se houver, ou para o post que ela mesma indica; aprovação de peça que saiu do Laboratório também conta.
function postsComPeca(c) {
  const pecas = dados.lerJson(c.pecas, []);
  const lista = Array.isArray(pecas) ? pecas.filter(objeto) : [];
  const aprov = dados.lerJson(c.aprovacoes, {});
  const porPeca = objeto(aprov) ? aprov : {};
  const ligados = new Set();
  const ligar = (id) => { if (texto(id)) ligados.add(id); };
  for (const pc of lista) {
    const reg = porPeca[pc.id];
    ligar(objeto(reg) && texto(reg.postId) ? reg.postId : pc.postId);
  }
  for (const [id, reg] of Object.entries(porPeca)) {
    if (objeto(reg) && !lista.some((pc) => pc.id === id)) ligar(reg.postId);
  }
  return ligados;
}

function planejados(raiz, codigo, { tipos = ['carrossel', 'post'], hoje = hojeLocal() } = {}) {
  const c = dados.caminhos(raiz, codigo);
  const lista = lerPosts(c.posts);
  const ligados = postsComPeca(c);
  const temArte = (p) => (Array.isArray(p.images) && p.images.length > 0) || texto(p.video) || texto(p.previewUrl) || ligados.has(p.id);
  return lista
    .map((p, ordem) => ({ p, ordem }))
    .filter(({ p }) => objeto(p) && texto(p.id) && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date >= hoje)
    .filter(({ p }) => tipos.includes(tipoDoPost(p).chave) && !temArte(p))
    .sort((a, b) => a.p.date.localeCompare(b.p.date) || a.ordem - b.ordem)
    .map(({ p }) => ({ id: p.id, date: p.date, tipo: tipoDoPost(p).chave, title: texto(p.title) ? p.title.trim() : 'Post sem título' }));
}

const rotulo = (post, i) => `post ${i + 1} (${objeto(post) && texto(post.title) ? post.title.trim() : 'sem título'})`;

function conferirPlano(raiz, codigo, posts) {
  if (!Array.isArray(posts)) return ['o plano precisa ser uma lista de posts'];
  if (!posts.length) return ['o plano não tem nenhum post'];
  const c = dados.caminhos(raiz, codigo);
  const existentes = new Set(lerPosts(c.posts).filter(objeto).map((x) => x.id));
  const vistos = new Set();
  const erros = [];
  posts.forEach((post, i) => {
    // o tipo é conferido aqui, com a lista do plano (menor que a do calendário)
    const motivos = dados.validarPost(post).filter((m) => !m.startsWith('tipo:'));
    if (objeto(post)) {
      if (!TIPOS_DO_PLANO.includes(post.tipo)) motivos.push(`tipo: obrigatório no plano, um destes: ${TIPOS_DO_PLANO.join(', ')}`);
      if (!texto(post.script)) motivos.push('script: falta o roteiro do post');
      if (!texto(post.caption)) motivos.push('caption: falta a legenda do post');
      if (texto(post.id)) {
        if (existentes.has(post.id)) motivos.push(`id: o código ${post.id} já existe no calendário (o plano nunca regrava um post que já está lá)`);
        else if (vistos.has(post.id)) motivos.push(`id: o código ${post.id} se repete no plano`);
        vistos.add(post.id);
      }
    }
    for (const m of motivos) erros.push(`${rotulo(post, i)}: ${m}`);
  });
  return erros;
}

const recusa = (erros) => erro('PLANO_RECUSADO', ['O plano não foi gravado; nada mudou no calendário.', ...erros.map((e) => '- ' + e)].join('\n'), { erros });

// Um post pelo registrar.js de sempre (valida, instala o calendário na primeira vez e põe o post em ordem de data).
function registrarUmPorScript(raiz, codigo, post) {
  const args = [REGISTRAR, 'post', '-'];
  if (codigo !== null && codigo !== undefined) args.push('--empresa', codigo);
  const res = spawnSync(process.execPath, args, { input: JSON.stringify(post), encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: raiz } });
  let saida = null;
  try { saida = JSON.parse(res.stdout); } catch { /* saída que não é JSON: vale o texto */ }
  if (res.status !== 0 || !saida || saida.ok !== true) {
    throw new Error(saida && Array.isArray(saida.erros) ? saida.erros.join('; ') : (String(res.stderr || res.stdout || '').trim() || `o registro saiu com ${res.status}`));
  }
}

// Põe o calendário de volta como estava antes do plano (o arquivo inteiro, ou nenhum se ele ainda não existia).
function voltar(arq, antes) {
  if (antes === null) { fs.rmSync(arq, { force: true }); return; }
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, antes);
  fs.renameSync(tmp, arq);
}

function registrarPlano(raiz, codigo, posts, { registrarUm = registrarUmPorScript } = {}) {
  const erros = conferirPlano(raiz, codigo, posts);
  if (erros.length) throw recusa(erros);
  const c = dados.caminhos(raiz, codigo);
  const antes = fs.existsSync(c.posts) ? fs.readFileSync(c.posts) : null;
  let feitos = 0;
  try {
    for (const post of posts) { registrarUm(raiz, c.codigo, post); feitos++; }
  } catch (e) {
    voltar(c.posts, antes);
    throw recusa([`${rotulo(posts[feitos], feitos)}: não entrou no calendário (${e.message})`]);
  }
  return { registrados: feitos };
}

// ---------- linha de comando ----------
const USO = [
  'Uso:',
  '  node _fabrica/core/plano-do-mes.js planejados [--empresa <codigo>] [--tipos carrossel,post] [--json]',
  '  node _fabrica/core/plano-do-mes.js registrar <arquivo.json> [--empresa <codigo>] [--json]',
  '  node _fabrica/core/plano-do-mes.js conferir <arquivo.json> [--empresa <codigo>] [--json]',
].join('\n');

function lerPlano(arquivo) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw recusa([`não consegui ler o plano (${arquivo}): ${e.message}`]);
  }
}

function principal(args) {
  const [cmd, ...resto] = args;
  const uso = (msg) => { console.error((msg ? msg + '\n' : '') + USO); return 2; };
  if (!['planejados', 'registrar', 'conferir'].includes(cmd)) return uso(cmd ? `Comando desconhecido: ${cmd}` : '');
  const comArquivo = cmd !== 'planejados';
  let codigo = null;
  let json = false;
  let tipos;
  let arquivo;
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i];
    if (a === '--json') json = true;
    else if (a === '--empresa') {
      if (codigo !== null || i + 1 >= resto.length || resto[i + 1].startsWith('--')) return uso('Faltou o código da empresa depois de --empresa.');
      codigo = resto[++i];
    } else if (a === '--tipos' && cmd === 'planejados') {
      if (tipos || i + 1 >= resto.length) return uso('Faltou a lista de tipos depois de --tipos.');
      tipos = resto[++i].split(',').map((t) => t.trim()).filter(Boolean);
      const fora = tipos.filter((t) => !TIPOS_ESCOLHIDOS.includes(t));
      if (!tipos.length || fora.length) return uso(`Tipo desconhecido: ${fora.join(', ') || '(vazio)'}. Use: ${TIPOS_ESCOLHIDOS.join(', ')}.`);
    } else if (a.startsWith('--')) return uso(`Opção desconhecida: ${a}`);
    else if (comArquivo && arquivo === undefined) arquivo = a;
    else return uso('Sobrou argumento.');
  }
  if (comArquivo && arquivo === undefined) return uso('Faltou o arquivo do plano.');

  const raiz = dados.raiz();
  try {
    if (cmd === 'planejados') {
      const lista = planejados(raiz, codigo, tipos ? { tipos } : {});
      if (json) console.log(JSON.stringify(lista));
      else if (!lista.length) console.log('Nenhum post planejado sem arte de hoje em diante.');
      else for (const x of lista) console.log(`${x.date}  ${x.title}  (${x.tipo}, código ${x.id})`);
      return 0;
    }
    const plano = lerPlano(arquivo);
    if (cmd === 'conferir') {
      const erros = conferirPlano(raiz, codigo, plano);
      if (erros.length) throw recusa(erros);
      console.log(json ? JSON.stringify({ ok: true, posts: plano.length }) : `Plano conferido: ${plano.length} posts, prontos para o calendário (nada foi gravado).`);
      return 0;
    }
    const r = registrarPlano(raiz, codigo, plano);
    console.log(json ? JSON.stringify({ ok: true, registrados: r.registrados }) : `Plano registrado: ${r.registrados} posts no calendário.`);
    return 0;
  } catch (e) {
    const erros = Array.isArray(e.erros) ? e.erros : [e.message];
    if (json) console.log(JSON.stringify({ ok: false, erros }));
    else console.error(e.message);
    return 1;
  }
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { planejados, conferirPlano, registrarPlano, TIPOS_DO_PLANO };
