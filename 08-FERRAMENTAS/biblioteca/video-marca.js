#!/usr/bin/env node
// Vídeo de cada estilo na marca da empresa (etapa 7, item 7.8): o modelo de Reels do estilo montado pelo montar.js com a
// marca da empresa, sobre o vídeo de demonstração deste computador, cortado no trecho de 12 s das prévias.
//
//   node 08-FERRAMENTAS/biblioteca/video-marca.js <empresa> <estilo> [--pedido <pedido.json>] [--json]
//
// Para outros módulos (a fila das prévias na marca liga este passo):
//   const { gerarVideoNaMarca } = require('./video-marca');
//   const r = await gerarVideoNaMarca({ raiz, empresa, estilo, pedidoDemo?, assinatura?, limiteMs? });
//   r.estado: 'pronto' | 'sem-modelo' | 'sem-fonte' | 'sem-marca' | 'refazer' | 'erro' (veja o contrato em gerarVideoNaMarca)
//
// Integração com a fila (ESTADOS, abaixo, diz o mesmo em código). Quatro estados são finais para o estilo e entram na fila
// com o mesmo nome: pronto, sem-modelo, sem-fonte e erro. Os outros dois NÃO são estado de estilo e não podem virar "erro":
//   - refazer   -> recomeçar a empresa (a marca mudou: imagens e vídeos de novo, com a assinatura nova);
//   - sem-marca -> parar a empresa (ela ficou sem marca.yaml; nada mais é gerado até a marca voltar).
//
// Regras:
// - só o modelo que declara aceitaMarca: true (troca a paleta inteira pelo ctx.marca) faz vídeo na marca; os outros ficam
//   no vídeo base ("sem-modelo");
// - sem o pedido de demonstração ou sem o vídeo que ele cita (o vídeo mostra uma pessoa real e nunca vai ao git), o vídeo
//   fica no base, com o aviso ("sem-fonte", decisão B1: "sempre no base, com aviso");
// - o montar.js roda num processo filho, com FABRICA_EMPRESA=<empresa>, FABRICA_RAIZ e sem FABRICA_MARCA, com --saida na
//   pasta de trabalho da empresa (empresas/<c>/previas/.trabalho/<modelo>/, com ponto: o servidor não a entrega) e
//   --usar-marca; a linha "marca-usada" dele precisa bater com a marca que a assinatura descreve (mesmo marca.yaml, mesmas
//   cores, mesmas letras), senão nada é gravado;
// - a assinatura da marca é lida antes e conferida de novo antes de gravar: mudou no meio, "refazer" e nada é gravado;
// - o trecho vai para o previas.json do estilo com videoAssinatura: primeiro o previas.json deixa de citar o vídeo antigo,
//   depois os arquivos entram por troca de nome, e o previas.json novo (temporário + troca de nome) é o último. Uma falha ou
//   um processo morto no meio dessas trocas deixa o manifesto sem vídeo (nunca prévia falsa), e os arquivos podem ficar
//   misturados até a próxima rodada, que os refaz.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const empresaMod = require('../../_fabrica/core/empresa');
const pm = require('./previas-marca');
const { lerYaml } = require('../marca/yaml');

const RAIZ_CODIGO = path.resolve(__dirname, '..', '..');
const DIR_MODELOS = path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos');
const MONTAR = path.join(DIR_MODELOS, 'montar.js');
const PASTA_ESTILOS = path.join(RAIZ_CODIGO, '04-LABORATORIO-DE-DESIGN', 'estilos');
const PASTA_MODELOS = path.join(DIR_MODELOS, 'estilos');
const PEDIDO_PADRAO = path.join(DIR_MODELOS, 'amostra', 'pedido-demonstracao.json');
const LIMITE_MS = 20 * 60 * 1000;
const ID = /^[a-z0-9][a-z0-9-]*$/;
const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const PAPEIS_LETRA = ['principal', 'mono', 'acento'];

const MSG = {
  semFonte: 'O vídeo de demonstração não está neste computador, então o vídeo deste estilo fica no modelo base. As imagens na sua marca não dependem dele.',
  semModelo: 'O vídeo deste estilo ainda não troca as cores pelas da sua marca; ele fica no modelo base.',
  semMarca: (nome) => `A empresa ${nome} ainda não tem marca definida; as prévias na marca precisam dela.`,
  mudouAntes: 'A sua marca mudou; este vídeo precisa ser refeito com a marca nova.',
  mudouNoMeio: 'A sua marca mudou enquanto o vídeo era feito; ele precisa ser refeito com a marca nova.',
  montar: 'Não consegui montar o vídeo deste estilo.',
  tempo: 'Não consegui montar o vídeo deste estilo: passou de 20 minutos.',
  outraMarca: 'O vídeo não usou a sua marca (as cores ou as letras não são as de hoje); nada foi gravado.',
  letraFora: (papel) => `O vídeo não usou a sua marca; a letra ${{ principal: 'principal', mono: 'dos rótulos', acento: 'de destaque' }[papel] || papel} da sua marca precisa estar na pasta da sua marca para entrar no vídeo. Nada foi gravado.`,
  cortar: 'Não consegui cortar o trecho do vídeo deste estilo.',
  gravar: 'Não consegui guardar o vídeo deste estilo; tente de novo.',
  pedidoRuim: 'O pedido do vídeo de demonstração está com defeito; o vídeo deste estilo fica no modelo base.',
};
// avisos do log do montar.js ("[marca] ..." dos modelos, "marca: ..." do tema-marca.js) em português simples
const AVISOS = [
  [/não tem face itálica/, 'No vídeo, a sua letra principal não tem itálico; o destaque usa outra letra.'],
  [/sem contraste/, 'No vídeo, com as suas cores, um texto ficaria difícil de ler; nesse ponto ele usa as cores do estilo.'],
  [/não cabe/, 'No vídeo, com as suas letras, um texto não coube inteiro na tela.'],
  [/^marca: .*(tipografia|letra)/, 'No vídeo, uma letra da sua marca não foi encontrada; nesse lugar ele usa a letra do estilo.'],
  [/^\[marca\] /, 'No vídeo, um texto precisou de um ajuste para ficar legível com a sua marca.'],
];

function avisosDoLog(texto) {
  const linhas = String(texto || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => /^\[marca\] |^marca: /.test(l));
  const avisos = [];
  for (const l of linhas) {
    const achado = AVISOS.find(([re]) => re.test(l));
    if (achado && !avisos.includes(achado[1])) avisos.push(achado[1]);
  }
  return { avisos, detalhes: [...new Set(linhas)].slice(0, 20).map((l) => l.slice(0, 300)) };
}

const erroCom = (msg, code) => Object.assign(new Error(msg), { code });
const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const mesmoCaminho = (a, b) => {
  const x = path.resolve(String(a || '')), y = path.resolve(String(b || ''));
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
};
const ultimas = (txt, n = 3) => String(txt || '').trim().split(/\r?\n/).filter(Boolean).slice(-n).join(' / ').slice(0, 600);

// O pedido do vídeo de demonstração: o pedido dado, FABRICA_PEDIDO_DEMONSTRACAO ou o da pasta amostra/ dos modelos.
function pedidoDeDemonstracao({ pedidoDemo } = {}) {
  if (pedidoDemo) return path.resolve(pedidoDemo);
  if (process.env.FABRICA_PEDIDO_DEMONSTRACAO) return path.resolve(process.env.FABRICA_PEDIDO_DEMONSTRACAO);
  return PEDIDO_PADRAO;
}

// O modelo de Reels do estilo (formatos.reels.modelo do estilo.yaml), ou null. Estilo fora da biblioteca: erro.
function modeloDoEstilo(estilo, pastaEstilos = PASTA_ESTILOS) {
  const arq = path.join(pastaEstilos, String(estilo), 'estilo.yaml');
  if (typeof estilo !== 'string' || !ID.test(estilo) || !ehArquivo(arq)) {
    throw erroCom(`O estilo ${JSON.stringify(String(estilo).slice(0, 60))} não está na biblioteca.`, 'ESTILO_DESCONHECIDO');
  }
  let y = null;
  try { y = lerYaml(fs.readFileSync(arq, 'utf8')); } catch { return null; }
  const m = y && y.formatos && y.formatos.reels && y.formatos.reels.modelo;
  return typeof m === 'string' && ID.test(m) ? m : null;
}

// O modelo declara aceitaMarca: true? (só o sinal exato vale; modelo que não existe ou não carrega: não)
function aceitaMarca(modelo, pastaModelos = PASTA_MODELOS) {
  if (!modelo || !ID.test(modelo)) return false;
  const arq = path.join(pastaModelos, modelo + '.js');
  if (!ehArquivo(arq)) return false;
  try { return require(arq).aceitaMarca === true; } catch { return false; }
}

// O pedido de demonstração e tudo o que ele cita existem? { ok, pedido, ini } ou { ok: false, estado, motivo }
function conferirFonte(arq) {
  if (!ehArquivo(arq)) return { ok: false, estado: 'sem-fonte', motivo: `não achei ${arq}` };
  let pedido;
  try { pedido = JSON.parse(fs.readFileSync(arq, 'utf8')); } catch (e) { return { ok: false, estado: 'erro', motivo: `pedido ilegível: ${e.message}` }; }
  const base = path.dirname(arq);
  const citados = [pedido.video, pedido.palavras, pedido.matte, ...(Array.isArray(pedido.broll) ? pedido.broll.map((b) => b && b.img) : [])];
  if (!pedido.video || !pedido.palavras) return { ok: false, estado: 'sem-fonte', motivo: 'o pedido não cita o vídeo e as palavras' };
  for (const c of citados) if (c && !ehArquivo(path.resolve(base, String(c)))) return { ok: false, estado: 'sem-fonte', motivo: `não achei ${c}` };
  try {
    const { lerPedidoVideo } = require('./gerar-previas');
    return { ok: true, pedido, ini: lerPedidoVideo(arq).ini };
  } catch (e) { return { ok: false, estado: 'erro', motivo: e.message }; }
}

// Encerra o processo e os filhos dele (o montar.js chama o tsrct e o ffmpeg).
function encerrar(filho) {
  if (!filho.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  else { try { process.kill(-filho.pid, 'SIGKILL'); } catch { try { filho.kill('SIGKILL'); } catch { /* já saiu */ } } }
}

// Roda `node <args...>` num processo filho assíncrono, sem janela: { status, stdout, stderr, tempoEsgotado }.
// Com `sinal` (AbortSignal), quem chama pode mandar parar: o processo e os filhos são encerrados na hora e volta
// `abortado: true` (sinal que já veio parado: o processo nem começa).
function rodarProcesso(args, { env = process.env, limiteMs = LIMITE_MS, sinal = null } = {}) {
  return new Promise((resolve) => {
    if (sinal && sinal.aborted) { resolve({ status: null, stdout: '', stderr: '', tempoEsgotado: false, abortado: true }); return; }
    const filho = spawn(process.execPath, args, { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const out = [], err = [];
    let tam = 0;
    const junta = (lista) => (b) => { if (tam < 16 << 20) { lista.push(b); tam += b.length; } };
    filho.stdout.on('data', junta(out));
    filho.stderr.on('data', junta(err));
    let tempoEsgotado = false;
    let abortado = false;
    const relogio = setTimeout(() => { tempoEsgotado = true; encerrar(filho); }, limiteMs);
    const aoParar = () => { if (feito) return; abortado = true; encerrar(filho); };
    if (sinal) sinal.addEventListener('abort', aoParar, { once: true });
    let feito = false;
    const fim = (status, extra = '') => {
      if (feito) return; feito = true; clearTimeout(relogio);
      if (sinal) sinal.removeEventListener('abort', aoParar);
      resolve({ status, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') + extra, tempoEsgotado, abortado });
    };
    filho.on('error', (e) => fim(null, `\n${e.message}`));
    filho.on('close', (code) => fim(code));
  });
}

// O trecho de 12 s (cortarTrecho do gerar-previas.js), num processo filho para não travar quem chama.
async function cortar(mp4, webm, capa, ini, sinal = null) {
  const r = await rodarProcesso([__filename, '--cortar', mp4, webm, capa, String(ini)], { limiteMs: 5 * 60 * 1000, sinal });
  if (r.abortado) throw Object.assign(new Error('abortado'), { code: 'ABORTADO' });
  if (r.status !== 0) throw new Error(ultimas(r.stderr || r.stdout) || 'o corte do trecho não terminou');
}

// A marca que o montar.js diz ter usado bate com o instantâneo da marca (o que a assinatura descreve)? null ou
// { detalhe, mensagem? }. O detalhe vai para a fila da empresa: nunca leva caminho, nome de arquivo nem cor de outra marca.
function conferirMarcaUsada(u, inst, arquivoMarca) {
  if (!u || typeof u !== 'object') return { detalhe: 'o montar.js não disse qual marca usou' };
  if (u.exemplo) return { detalhe: 'o montar.js usou a marca de exemplo' };
  if (!mesmoCaminho(u.arquivo, arquivoMarca)) return { detalhe: 'o montar.js leu a marca de outro lugar, não a desta empresa' };
  const hexDe = (v) => String(v == null ? '' : v).trim().replace(/^#/, '').toUpperCase();
  const cores = (inst.dados && inst.dados.cores) || {};
  for (const p of PAPEIS_COR) if (hexDe(u.cores && u.cores[p]) !== hexDe(cores[p])) return { detalhe: `a cor ${p} do vídeo não é a da marca` };
  // o itálico da letra principal muda a letra do destaque (e está na assinatura)
  const tipografia = (inst.dados && inst.dados.tipografia) || {};
  const italico = !!(tipografia.principal && tipografia.principal.italico === true);
  if ((u.principalItalico === true) !== italico) return { detalhe: 'o itálico da letra principal no vídeo não é o da marca' };
  for (const p of PAPEIS_LETRA) {
    const usada = u.fontes && u.fontes[p];
    if (!usada) continue; // a marca não entrou nesse papel: o vídeo usa a letra do estilo (e o log já avisa)
    const snap = (inst.letras && inst.letras[p]) || {};
    // letra citada que a assinatura não aceita (caminho absoluto ou fora da pasta da marca) e o montar.js usou mesmo assim
    if (snap.citada && !snap.arquivo) return { detalhe: `a letra ${p} da marca está fora da pasta da marca da empresa`, mensagem: MSG.letraFora(p) };
    let bytes = null;
    try { bytes = fs.readFileSync(usada); } catch { /* sumiu */ }
    if (!bytes || !snap.bytes || !bytes.equals(snap.bytes)) return { detalhe: `a letra ${p} do vídeo não é a da marca` };
  }
  return null;
}

const lerManifesto = (dir) => { try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'previas.json'), 'utf8')); return m && typeof m === 'object' && !Array.isArray(m) ? m : null; } catch { return null; } };
function gravarManifesto(dir, m) {
  const tmp = path.join(dir, 'previas.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(m, null, 2) + '\n');
  fs.renameSync(tmp, path.join(dir, 'previas.json'));
}
const apagar = (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* fica para a próxima rodada */ } };
function limparTrabalho(previas, trabalho) {
  apagar(trabalho);
  const dir = path.join(previas, '.trabalho');
  try { if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir); } catch { /* não existe */ }
}

// Contrato:
//   gerarVideoNaMarca({ raiz, empresa, estilo, pedidoDemo?, assinatura?, limiteMs?, rodarMontar?, pastaEstilos?, pastaModelos? })
//     -> Promise<{ estado, empresa, estilo, modelo, mensagem, detalhe, avisos, video, videoCapa, videoAssinatura, segundos }>
//   - raiz: raiz dos dados (padrão FABRICA_RAIZ ou a do código); empresa: código da lista de empresas; estilo: id da biblioteca.
//   - REJEITA (erro com code) só para entrada inválida, antes de ler ou gravar: EMPRESA_DESCONHECIDA, ESTILO_DESCONHECIDO.
//   - Fora isso sempre RESOLVE com `estado`:
//       pronto      video.webm e video-capa.webp gravados na pasta do estilo, previas.json com video, videoCapa,
//                   videoAssinatura (= assinatura de hoje), videoModelo, videoGerado, videoAvisos, videoDetalhes;
//       sem-modelo  o modelo do estilo não declara aceitaMarca (ou o estilo não tem modelo de Reels): nada gravado;
//       sem-fonte   sem o pedido de demonstração ou sem um arquivo que ele cita (decisão B1): nada gravado;
//       sem-marca   a empresa não tem marca.yaml próprio: nada gravado. Para a fila: PARAR A EMPRESA (não é "erro");
//       refazer     a assinatura pedida não é a de hoje, ou a marca mudou durante a montagem: nada gravado. Para a fila:
//                   RECOMEÇAR A EMPRESA (não é "erro");
//       erro        o montar.js falhou, passou do tempo-limite, usou outra marca (ou uma letra fora da pasta da marca), ou o
//                   corte falhou: nada gravado, o vídeo anterior e o previas.json ficam como estavam. Se a falha é na
//                   gravação (troca de nomes no meio, ex.: arquivo preso), o previas.json já deixou de citar o vídeo:
//                   fica sem vídeo (nunca prévia falsa), e os arquivos podem ficar misturados até a próxima rodada,
//                   que os refaz.
//     `mensagem` é o texto em português para a pessoa (null no pronto); `detalhe`, o técnico (motivo ou fim do log; sem
//     caminho nem cor de outra marca).
//   - Opções de teste: rodarMontar(args, { env, limiteMs }) -> Promise<{ status, stdout, stderr, tempoEsgotado }> no lugar do
//     processo do montar.js; pastaEstilos e pastaModelos no lugar das pastas do código.
//   - `sinal` (AbortSignal, opcional): quem chama manda parar (Pausar ou Cancelar da fila). O montar.js e o corte são
//     encerrados na hora e o resultado é `erro` com detalhe `abortado`, sem gravar nada (quem chama sabe que foi ele que
//     pediu e não conta isso como falha do estilo).
async function gerarVideoNaMarca({ raiz = empresaMod.raiz(), empresa, estilo, pedidoDemo = null, assinatura = null, limiteMs = LIMITE_MS,
  rodarMontar = rodarProcesso, pastaEstilos = PASTA_ESTILOS, pastaModelos = PASTA_MODELOS, sinal = null } = {}) {
  const t0 = Date.now();
  const previas = pm.pastaDaEmpresa(raiz, empresa); // empresa pela lista de empresas (erro EMPRESA_DESCONHECIDA)
  const modelo = modeloDoEstilo(estilo, pastaEstilos);
  const r = (estado, extra = {}) => ({ estado, empresa, estilo, modelo, mensagem: null, detalhe: null, avisos: [], video: null, videoCapa: null,
    videoAssinatura: null, ...extra, segundos: Math.round((Date.now() - t0) / 1000) });
  if (!aceitaMarca(modelo, pastaModelos)) return r('sem-modelo', { mensagem: MSG.semModelo, detalhe: modelo ? `o modelo ${modelo} não declara aceitaMarca` : 'o estilo não tem modelo de Reels' });

  const pedidoArq = pedidoDeDemonstracao({ pedidoDemo });
  const fonte = conferirFonte(pedidoArq);
  if (!fonte.ok) return r(fonte.estado, { mensagem: fonte.estado === 'sem-fonte' ? MSG.semFonte : MSG.pedidoRuim, detalhe: fonte.motivo });

  const inst = pm.instantaneoDaMarca(raiz, empresa);
  if (!inst.definida) {
    const nome = (empresaMod.listar(raiz).find((e) => e.codigo === empresa) || {}).nome || empresa;
    return r('sem-marca', { mensagem: MSG.semMarca(nome) });
  }
  if (assinatura && assinatura !== inst.assinatura) return r('refazer', { mensagem: MSG.mudouAntes, detalhe: 'assinatura pedida diferente da de hoje' });

  const trabalho = path.join(previas, '.trabalho', modelo);
  const dirEstilo = path.join(previas, estilo);
  apagar(trabalho); // sobra de uma rodada que morreu no meio
  try { for (const f of fs.readdirSync(dirEstilo)) if (/^\.novo-video/.test(f)) apagar(path.join(dirEstilo, f)); } catch { /* pasta ainda não existe */ }
  try {
    fs.mkdirSync(trabalho, { recursive: true });
    const env = { ...process.env, FABRICA_EMPRESA: empresa, FABRICA_RAIZ: raiz };
    delete env.FABRICA_MARCA;
    const x = await rodarMontar([MONTAR, modelo, pedidoArq, '--exportar', '--saida', trabalho, '--usar-marca'], { env, limiteMs, sinal });
    if (x.abortado || (sinal && sinal.aborted)) return r('erro', { mensagem: MSG.montar, detalhe: 'abortado' });
    if (x.tempoEsgotado) return r('erro', { mensagem: MSG.tempo, detalhe: ultimas(x.stderr) });
    const mp4 = path.join(trabalho, modelo + '.mp4');
    if (x.status !== 0 || !ehArquivo(mp4)) return r('erro', { mensagem: MSG.montar, detalhe: ultimas(x.stderr || x.stdout) || `saiu com ${x.status}` });
    const linha = String(x.stdout || '').split(/\r?\n/).find((l) => l.startsWith('marca-usada '));
    let usada = null;
    try { usada = linha ? JSON.parse(linha.slice('marca-usada '.length)) : null; } catch { /* linha torta: conta como sem marca */ }
    const diferenca = conferirMarcaUsada(usada, inst, empresaMod.caminhos(empresa, raiz).marca);
    if (diferenca) return r('erro', { mensagem: diferenca.mensagem || MSG.outraMarca, detalhe: diferenca.detalhe });
    const { avisos, detalhes } = avisosDoLog(`${x.stdout}\n${x.stderr}`);

    const webm = path.join(trabalho, 'trecho.webm');
    const capa = path.join(trabalho, 'trecho-capa.webp');
    try { await cortar(mp4, webm, capa, fonte.ini, sinal); } catch (e) { return r('erro', { mensagem: MSG.cortar, detalhe: e.code === 'ABORTADO' ? 'abortado' : e.message }); }
    if (sinal && sinal.aborted) return r('erro', { mensagem: MSG.cortar, detalhe: 'abortado' }); // parou depois do corte, antes de gravar

    // a marca mudou enquanto o vídeo era montado: não grava
    if (pm.assinaturaDaMarca(raiz, empresa).assinatura !== inst.assinatura) return r('refazer', { mensagem: MSG.mudouNoMeio });

    try {
      fs.mkdirSync(dirEstilo, { recursive: true });
      const antes = lerManifesto(dirEstilo);
      const vale = antes && antes.cores === 'marca' && antes.empresa === empresa && antes.estilo === estilo && antes.assinatura === inst.assinatura;
      // imagens de outra marca (ou de nenhuma) não entram: o manifesto novo fica só com o vídeo, e as imagens velhas nunca
      // viram "na sua marca"
      const m = vale ? { ...antes } : { estilo, gerado: new Date().toISOString(), cores: 'marca', empresa, assinatura: inst.assinatura,
        capa: null, carrossel: [], fixados: null, reelsCapa: null, video: null, videoCapa: null, avisos: [] };
      const velhos = vale && Array.isArray(antes.videoAvisos) ? antes.videoAvisos : [];
      const avisosImagens = (Array.isArray(m.avisos) ? m.avisos : []).filter((a) => !velhos.includes(a));
      // 1) o manifesto deixa de citar o vídeo antigo; 2) os arquivos novos entram; 3) o manifesto novo, por último
      if (antes && (antes.video || antes.videoCapa)) gravarManifesto(dirEstilo, { ...antes, video: null, videoCapa: null, videoAssinatura: null });
      fs.renameSync(webm, path.join(dirEstilo, 'video.webm'));
      fs.renameSync(capa, path.join(dirEstilo, 'video-capa.webp'));
      Object.assign(m, { video: 'video.webm', videoCapa: 'video-capa.webp', videoAssinatura: inst.assinatura, videoModelo: modelo,
        videoGerado: new Date().toISOString(), videoAvisos: avisos, videoDetalhes: detalhes, avisos: [...new Set([...avisosImagens, ...avisos])] });
      gravarManifesto(dirEstilo, m);
    } catch (e) { return r('erro', { mensagem: MSG.gravar, detalhe: e.message }); }
    return r('pronto', { avisos, video: 'video.webm', videoCapa: 'video-capa.webp', videoAssinatura: inst.assinatura });
  } finally {
    limparTrabalho(previas, trabalho);
  }
}

// O nome do plano (renderizarVideo padrão da fila): renderizarVideoNaMarca(r, codigo, id, opcoes).
const renderizarVideoNaMarca = (raiz, empresa, estilo, opcoes = {}) => gerarVideoNaMarca({ ...opcoes, raiz, empresa, estilo });

// O que a fila faz com cada estado (veja o cabeçalho): os quatro primeiros são o estado final do estilo; refazer e sem-marca
// são da empresa.
const ESTADOS = Object.freeze({ pronto: 'pronto', 'sem-modelo': 'sem-modelo', 'sem-fonte': 'sem-fonte', erro: 'erro',
  refazer: 'recomeçar a empresa', 'sem-marca': 'parar a empresa' });

module.exports = { gerarVideoNaMarca, renderizarVideoNaMarca, rodarProcesso, encerrar, pedidoDeDemonstracao, avisosDoLog, aceitaMarca, modeloDoEstilo, ESTADOS, LIMITE_MS, MSG };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--cortar') {
    // uso interno (processo filho do corte): --cortar <mp4> <webm> <capa> <ini>
    try { require('./gerar-previas').cortarTrecho(argv[1], argv[2], argv[3], { ini: Number(argv[4]) }); } catch (e) { console.error(e.message); process.exit(1); }
    process.exit(0);
  }
  const json = argv.includes('--json');
  const ip = argv.indexOf('--pedido');
  const pedidoDemo = ip > -1 ? argv[ip + 1] : null;
  const [empresa, estilo] = argv.filter((a, i) => !a.startsWith('--') && (ip < 0 || i !== ip + 1));
  if (!empresa || !estilo) {
    console.error('uso: node 08-FERRAMENTAS/biblioteca/video-marca.js <empresa> <estilo> [--pedido <pedido.json>] [--json]');
    process.exit(1);
  }
  gerarVideoNaMarca({ empresa, estilo, pedidoDemo }).then((r) => {
    if (json) console.log(JSON.stringify(r));
    else if (r.estado === 'pronto') console.log(`pronto: o vídeo de ${estilo} na marca de ${empresa} ficou pronto (${r.segundos} s).${r.avisos.length ? '\n' + r.avisos.join('\n') : ''}`);
    else console.log(`${r.estado}: ${r.mensagem}${r.detalhe ? `\n(detalhe: ${r.detalhe})` : ''}`);
    process.exit(r.estado === 'pronto' ? 0 : 1);
  }).catch((e) => { console.error('Erro: ' + e.message); process.exit(1); });
}
