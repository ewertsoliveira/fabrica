#!/usr/bin/env node
// Prévias "na minha marca" em segundo plano: a lista do que falta fazer de cada empresa e quem faz.
//
// Estado por empresa em empresas/<codigo>/previas/fila.json (na pasta antiga, empresas/principal/previas/):
//   { versao: 1, empresa, assinatura, pedidoEm, pausada, imagens: { estado, feitos, total, erro, ... },
//     videos: [{ estilo, modelo, estado, erro, inicio, fim, ... }] }
// imagens.estado: esperando | fazendo | pronto | erro | cancelado; videos[].estado: esperando | fazendo | pronto | erro |
// sem-fonte | sem-modelo. A ordem dos vídeos é a da grade (biblioteca.catalogo da empresa, que segue a intenção dela).
// Toda alteração passa por alterarFila: trava de arquivo (empresas/<codigo>/previas/.fila.trava, criação exclusiva; trava
// de processo morto ou com mais de 30 s é abandonada), lê, aplica e grava por inteiro (temporário + troca de nome).
//
// O trabalhador (rodar) é um só por Fábrica: registro em empresas/.fila-previas.json ({ pid, raiz, inicio, batida, vez }),
// criado com exclusividade, com batida de vida a cada 10 s. Registro vivo = processo existe e batida com menos de 2 min
// (número de processo reaproveitado pelo sistema deixa de bater e cai em 2 min); o de processo morto é tomado. Ele faz
// primeiro as imagens (gerar-previas.js --marca, num processo filho) e depois um vídeo por vez, sempre a empresa com o pedido
// mais antigo; antes de cada passo confere a marca (mudou: recomeça a empresa) e a pausa; termina sozinho quando não há
// mais nada e apaga o próprio registro. Nunca grava empresas/ativa.json: a empresa vai para cada processo filho pelo ambiente.
// O passo das imagens tem limite de tempo (preso: vira erro "tempo-esgotado" e o trabalhador segue) e para na hora com
// Pausar e Cancelar (o processo filho é encerrado); o vídeo tem o limite dele (video-marca.js) e termina antes de parar.
//
// O passo de vídeo é trocável (renderizarVideo). O padrão é o vídeo na marca (video-marca.gerarVideoNaMarca): pronto,
// sem-fonte, sem-modelo e erro são o estado final do estilo; "refazer" recomeça a empresa (como marca nova) e "sem-marca"
// para a empresa (o estilo volta a esperar); nenhum dos dois vira erro.
//
//   node 08-FERRAMENTAS/biblioteca/fila-marca.js estado <codigo> [--json]
//   node 08-FERRAMENTAS/biblioteca/fila-marca.js pedir <codigo> [--sem-trabalhador]
//   node 08-FERRAMENTAS/biblioteca/fila-marca.js priorizar <codigo> <estilo> [--sem-trabalhador]
//   node 08-FERRAMENTAS/biblioteca/fila-marca.js pausar <codigo> | retomar <codigo> [--sem-trabalhador] | cancelar <codigo>
//   node 08-FERRAMENTAS/biblioteca/fila-marca.js rodar
// Saída: 0 = deu certo, 1 = recusa (empresa desconhecida, sem marca, estilo fora da biblioteca, ocupado), 2 = uso errado.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const empresaMod = require('../../_fabrica/core/empresa');
const pm = require('./previas-marca');
const { lerYaml } = require('../marca/yaml');

const VERSAO_FILA = 1;
const BATIDA_MS = 10000; // a batida de vida do trabalhador
const VIVO_MS = 2 * 60000; // sem batida há mais disto, o trabalhador é dado como morto
const RESERVA_MS = 30000; // registro ainda sem processo (acabou de ser lançado) vale por isto
const TRAVA_MS = 30000; // trava mais velha que isto é abandonada
const ESPERA_TRAVA_MS = 10000; // quanto alterarFila espera por uma trava viva antes de desistir
const MAX_REFAZER = 3; // recomeços seguidos pedidos pelo vídeo antes de a empresa parar naquela rodada
const LAB_ESTILOS = ['04-LABORATORIO-DE-DESIGN', 'estilos'];
const ESTADOS_IMAGENS = ['esperando', 'fazendo', 'pronto', 'erro', 'cancelado'];
const ESTADOS_VIDEO = ['esperando', 'fazendo', 'pronto', 'erro', 'sem-fonte', 'sem-modelo'];
const FINAIS = ['pronto', 'erro', 'sem-fonte', 'sem-modelo'];
const PENDENTES = ['esperando', 'fazendo'];
const ESTILO = /^[a-z0-9][a-z0-9-]*$/;
const MSG = {
  semMarca: 'Defina a sua marca antes de ver os estilos nela.',
  estilo: 'Este estilo não está na biblioteca.',
  ocupada: 'As prévias desta empresa estão sendo atualizadas agora; tente de novo em instantes.',
  imagens: 'Não deu para preparar as imagens na sua marca.',
  video: 'Não deu para fazer o vídeo deste estilo.',
};

const erro = (code, mensagem) => Object.assign(new Error(mensagem), { code });
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const iso = (ms) => new Date(ms).toISOString();
const novaVez = () => crypto.randomBytes(8).toString('hex');
const esperarSync = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const inteiro = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
const vezDe = (o) => (ehObjeto(o) && typeof o.vez === 'string' ? o.vez : null);
const mesmaRaiz = (a, b) => (process.platform === 'win32'
  ? path.resolve(String(a)).toLowerCase() === path.resolve(String(b)).toLowerCase()
  : path.resolve(String(a)) === path.resolve(String(b)));

// Texto vindo de fora (mensagem de erro de outro programa, nome digitado): sem caracteres de controle nem invisíveis
// (marcas de direção, espaço de largura zero), espaços juntados, cortado. Vazio vira null.
function limparTexto(v, max = 300) {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return s || null;
}

// ---- Arquivos: leitura e gravação seguras ----

// No Windows, um arquivo que outro processo está trocando pode dar "acesso negado" por um instante: tenta de novo.
const TRANSITORIOS = new Set(['EPERM', 'EACCES', 'EBUSY']);
function comRepeticao(fn) {
  for (let i = 0; ; i++) {
    try { return fn(); } catch (e) {
      if (!TRANSITORIOS.has(e.code) || i >= 40) throw e;
      esperarSync(5 + i);
    }
  }
}
// Um arquivo irmão, escondido (começa por ponto: o servidor estático não o entrega), com a mesma extensão.
function irmao(arq, tipo) {
  const base = path.basename(arq).replace(/^\./, '');
  const ext = path.extname(base);
  return path.join(path.dirname(arq), `.${base.slice(0, base.length - ext.length)}.${tipo}-${process.pid}-${novaVez()}${ext}`);
}
function lerTexto(arq) {
  try { return comRepeticao(() => fs.readFileSync(arq, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
// Grava por inteiro: temporário próprio (criação exclusiva) e troca de nome. Quem lê nunca vê o arquivo pela metade.
function gravarAtomico(arq, texto) {
  const tmp = irmao(arq, 'tmp');
  fs.writeFileSync(tmp, texto, { flag: 'wx' });
  try { comRepeticao(() => fs.renameSync(tmp, arq)); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* já saiu */ } throw e; }
}
// Cria `arq` já com o conteúdo, com exclusividade (o nome final nasce por link, que falha se ele já existe). Sem link no
// disco: criação exclusiva e escrita logo em seguida (e o arquivo vazio recente conta como vivo). false = já existia.
function criarComConteudo(arq, texto) {
  const tmp = irmao(arq, 'novo');
  fs.writeFileSync(tmp, texto, { flag: 'wx' });
  try {
    try { fs.linkSync(tmp, arq); return true; } catch (e) { if (e.code === 'EEXIST') return false; }
    let fd;
    try { fd = fs.openSync(arq, 'wx'); } catch (e) { if (e.code === 'EEXIST') return false; throw e; }
    try { fs.writeSync(fd, texto); } finally { fs.closeSync(fd); }
    return true;
  } finally { try { fs.unlinkSync(tmp); } catch { /* já saiu */ } }
}
// { dados (objeto ou null se ilegível), mtime } ou null se não existe.
function lerControle(arq) {
  let texto;
  let st;
  try { st = comRepeticao(() => fs.statSync(arq)); texto = lerTexto(arq); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  if (texto === null) return null;
  let dados = null;
  try { const x = JSON.parse(texto); if (ehObjeto(x)) dados = x; } catch { /* vazio ou pela metade */ }
  return { dados, mtime: st.mtimeMs };
}
// Tira `arq` só se ele ainda é o mesmo que foi lido (pela `vez`). O dono é conferido logo antes; o arquivo sai por troca
// de nome para um nome único (só um processo consegue) e o conteúdo tirado é conferido de novo; se não era o esperado (outro
// pôs um novo no lugar entre a conferência e a troca), ele volta, mas só se o nome original continua livre (link, que
// falha se já existe). Limite que sobra: entre a troca e a volta (microssegundos), um terceiro pode criar um arquivo
// novo no nome livre; aí o que foi tirado por engano se perde (o dono dele percebe na próxima conferência da `vez`).
function tirarSeAinda(arq, vezLida) {
  const antes = lerControle(arq);
  if (!antes || vezDe(antes.dados) !== vezLida) return false;
  const velha = irmao(arq, 'velha');
  try { comRepeticao(() => fs.renameSync(arq, velha)); } catch (e) { if (e.code === 'ENOENT') return false; throw e; }
  const conferido = lerControle(velha);
  const mesmo = vezDe(conferido && conferido.dados) === vezLida;
  if (!mesmo) { try { fs.linkSync(velha, arq); } catch { /* o nome já tem outro dono: não sobrescreve */ } }
  try { fs.unlinkSync(velha); } catch { /* já saiu */ }
  return mesmo;
}
function processoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// ---- A trava da lista de cada empresa ----

function travaViva({ dados, mtime }) {
  const criada = (dados && Date.parse(dados.inicio)) || mtime;
  if (Date.now() - criada > TRAVA_MS) return false;
  if (!dados || !Number.isInteger(dados.pid)) return true; // acabou de nascer (sem link no disco): ainda escrevendo
  return processoVivo(dados.pid);
}
function pegarTrava(pasta, limite) {
  const arq = path.join(pasta, '.fila.trava');
  const vez = novaVez();
  const fim = Date.now() + limite;
  for (;;) {
    if (criarComConteudo(arq, JSON.stringify({ pid: process.pid, inicio: iso(Date.now()), vez }))) break;
    const lida = lerControle(arq);
    if (lida === null) continue; // saiu entre as duas chamadas
    if (!travaViva(lida)) { tirarSeAinda(arq, vezDe(lida.dados)); continue; }
    if (Date.now() >= fim) throw erro('FILA_OCUPADA', MSG.ocupada);
    esperarSync(8 + Math.floor(Math.random() * 12));
  }
  return () => { tirarSeAinda(arq, vez); }; // só a própria (conferida antes e depois de tirar)
}

// ---- A lista (fila.json) ----

const pastaDe = (r, codigo) => pm.pastaDaEmpresa(r, codigo); // confere a empresa pela lista (EMPRESA_DESCONHECIDA)
const arqFilaDe = (pasta) => path.join(pasta, 'fila.json');

function normalizarVideo(v) {
  if (!ehObjeto(v) || typeof v.estilo !== 'string' || !ESTILO.test(v.estilo) || !ESTADOS_VIDEO.includes(v.estado)) return null;
  const item = {
    estilo: v.estilo, modelo: typeof v.modelo === 'string' && ESTILO.test(v.modelo) ? v.modelo : null, estado: v.estado,
    erro: limparTexto(v.erro), inicio: typeof v.inicio === 'string' ? v.inicio : null, fim: typeof v.fim === 'string' ? v.fim : null,
  };
  const detalhe = limparTexto(v.detalhe);
  if (detalhe) item.detalhe = detalhe;
  if (Array.isArray(v.avisos)) item.avisos = v.avisos.map((a) => limparTexto(a)).filter(Boolean).slice(0, 20);
  if (vezDe(v)) item.vez = v.vez;
  return item;
}
// A lista lida, com a forma conferida; qualquer coisa fora dela (ou de outra empresa) é como se não houvesse lista.
function normalizar(f, codigo) {
  if (!ehObjeto(f) || f.versao !== VERSAO_FILA || f.empresa !== codigo || !ehObjeto(f.imagens) || !Array.isArray(f.videos)) return null;
  const im = f.imagens;
  const ids = (l) => (Array.isArray(l) ? [...new Set(l.filter((x) => typeof x === 'string' && ESTILO.test(x)))] : null);
  const imagens = {
    estado: ESTADOS_IMAGENS.includes(im.estado) ? im.estado : 'esperando', feitos: inteiro(im.feitos), total: inteiro(im.total),
    erro: limparTexto(im.erro), detalhe: limparTexto(im.detalhe, 600), ids: ids(im.ids), falhas: ids(im.falhas) || [],
  };
  if (vezDe(im)) imagens.vez = im.vez;
  const vistos = new Set();
  const videos = [];
  for (const v of f.videos.map(normalizarVideo)) if (v && !vistos.has(v.estilo)) { vistos.add(v.estilo); videos.push(v); }
  return {
    versao: VERSAO_FILA, empresa: codigo, assinatura: typeof f.assinatura === 'string' ? f.assinatura : null,
    pedidoEm: typeof f.pedidoEm === 'string' ? f.pedidoEm : null, pausada: f.pausada === true, imagens, videos,
  };
}
function lerFilaDe(pasta, codigo) {
  const texto = lerTexto(arqFilaDe(pasta));
  if (texto === null) return null;
  try { return normalizar(JSON.parse(texto), codigo); } catch { return null; }
}
function lerFila(r, codigo) { return lerFilaDe(pastaDe(r, codigo), codigo); }

// Toda alteração: segura a trava, lê, aplica `fn(lista atual ou null)` e grava o que ela devolver (nada = não grava).
function alterarFila(r, codigo, fn, { limite = ESPERA_TRAVA_MS } = {}) {
  const pasta = pastaDe(r, codigo);
  fs.mkdirSync(pasta, { recursive: true });
  const soltar = pegarTrava(pasta, limite);
  try {
    const atual = lerFilaDe(pasta, codigo);
    const nova = fn(atual);
    if (nova === undefined) return atual;
    const final = normalizar(ehObjeto(nova) ? { ...nova, versao: VERSAO_FILA, empresa: codigo } : nova, codigo);
    if (!final) throw new Error('alterarFila: a função devolve a lista inteira (ou nada, para não mudar)');
    gravarAtomico(arqFilaDe(pasta), JSON.stringify(final, null, 2) + '\n');
    return final;
  } finally { soltar(); }
}

const temPendente = (f) => PENDENTES.includes(f.imagens.estado) || f.videos.some((v) => PENDENTES.includes(v.estado));
const temTrabalho = (f) => !!f && !f.pausada && temPendente(f);
const novoVideo = (g) => ({ estilo: g.estilo, modelo: g.modelo, estado: 'esperando', erro: null, inicio: null, fim: null });
function recomecar(f, assinatura, grade, pedidoEm, codigo) {
  return {
    versao: VERSAO_FILA, empresa: codigo, assinatura, pedidoEm, pausada: !!(f && f.pausada),
    // grade vazia (nenhum estilo na raiz de dados): nada a fazer; as imagens nunca são pedidas sem estilos
    imagens: { estado: grade.length ? 'esperando' : 'pronto', feitos: 0, total: grade.length, erro: null, detalhe: null, ids: null, falhas: [] },
    videos: grade.map(novoVideo),
  };
}

// ---- A grade da empresa ----

function modeloDoEstilo(r, id) {
  try {
    const y = lerYaml(fs.readFileSync(path.join(r, ...LAB_ESTILOS, id, 'estilo.yaml'), 'utf8'));
    const m = ehObjeto(y) && ehObjeto(y.formatos) && ehObjeto(y.formatos.reels) ? y.formatos.reels.modelo : null;
    return typeof m === 'string' && ESTILO.test(m.trim()) ? m.trim() : null;
  } catch { return null; }
}
// Os estilos na ordem em que a grade da empresa os mostra (a intenção dela vem primeiro), com o modelo de Reels de cada um.
function gradeDaEmpresa(r, codigo) {
  const biblioteca = require('../../_fabrica/paineis/biblioteca'); // aqui dentro: a biblioteca também lê este módulo
  return biblioteca.catalogo(r, codigo).estilos.filter((e) => ESTILO.test(e.id)).map((e) => ({ estilo: e.id, modelo: modeloDoEstilo(r, e.id) }));
}

// ---- Ações ----

// Pede as prévias na marca de hoje. Sem marca: recusa (nada gravado). Mesma marca: refaz só o que deu erro, foi cancelado
// ou ainda não estava na lista (tudo pronto: nada muda). Marca nova: recomeça imagens e vídeos (as prévias velhas ficam no
// disco, mas já não valem). Partindo de nada pendente, a pausa é desligada (quem pede quer ver andar). Devolve o estado.
function pedir(r, codigo, { agora = Date.now } = {}) {
  pastaDe(r, codigo);
  const { assinatura: hoje, definida } = pm.assinaturaDaMarca(r, codigo);
  if (!definida) throw erro('SEM_MARCA', MSG.semMarca);
  const grade = gradeDaEmpresa(r, codigo);
  alterarFila(r, codigo, (f) => {
    if (!f || f.assinatura !== hoje) {
      const pendente = !!f && temPendente(f);
      const nova = recomecar(f, hoje, grade, pendente ? f.pedidoEm : iso(agora()), codigo);
      if (!pendente) nova.pausada = false;
      return nova;
    }
    const jaPendente = temPendente(f);
    let mudou = false;
    const im = f.imagens;
    if (im.estado === 'erro' || im.estado === 'cancelado') { im.estado = 'esperando'; im.erro = null; im.detalhe = null; mudou = true; }
    for (const v of f.videos) {
      if (v.estado === 'erro') { Object.assign(v, { estado: 'esperando', erro: null, inicio: null, fim: null }); delete v.detalhe; mudou = true; }
    }
    const tem = new Set(f.videos.map((v) => v.estilo));
    for (const g of grade) if (!tem.has(g.estilo)) { f.videos.push(novoVideo(g)); mudou = true; }
    if (!mudou) return undefined;
    if (!jaPendente) { f.pedidoEm = iso(agora()); f.pausada = false; }
    return f;
  });
  soltarPresa(r, codigo); // pediu de novo: o próximo trabalhador volta a tentar esta empresa
  return estado(r, codigo);
}
const existeFila = (pasta) => fs.existsSync(arqFilaDe(pasta));
// Põe o vídeo do estilo na frente dos que esperam (logo depois do que está rodando). Estilo fora da biblioteca: recusa.
function priorizar(r, codigo, id) {
  const pasta = pastaDe(r, codigo);
  if (typeof id !== 'string' || !ESTILO.test(id) || !gradeDaEmpresa(r, codigo).some((g) => g.estilo === id)) throw erro('ESTILO_DESCONHECIDO', MSG.estilo);
  if (existeFila(pasta)) {
    alterarFila(r, codigo, (f) => {
      if (!f) return undefined;
      const i = f.videos.findIndex((v) => v.estilo === id && v.estado === 'esperando');
      const primeiro = f.videos.findIndex((v) => v.estado === 'esperando');
      if (i < 0 || i === primeiro) return undefined;
      const [v] = f.videos.splice(i, 1);
      f.videos.splice(primeiro, 0, v);
      return f;
    });
  }
  return estado(r, codigo);
}
function mudarSeExiste(r, codigo, fn) {
  const pasta = pastaDe(r, codigo);
  if (existeFila(pasta)) alterarFila(r, codigo, (f) => (f ? fn(f) : undefined));
  return estado(r, codigo);
}
// Pausar segura o próximo passo; as imagens e o vídeo em andamento param logo (o trabalhador confere a lista a cada batida e
// encerra o processo; os estilos que faltam voltam a esperar, sem erro). Retomar solta.
const pausar = (r, codigo) => mudarSeExiste(r, codigo, (f) => (f.pausada ? undefined : Object.assign(f, { pausada: true })));
const retomar = (r, codigo) => mudarSeExiste(r, codigo, (f) => (f.pausada ? Object.assign(f, { pausada: false }) : undefined));
// Cancelar tira o que espera e o que está em andamento, imagens e vídeo (o trabalhador vê que sumiu e encerra o processo) e
// desliga a pausa (senão o próximo "gerar" ficaria parado sem mostrar por quê); nenhuma prévia pronta é apagada.
const cancelar = (r, codigo) => mudarSeExiste(r, codigo, (f) => {
  let mudou = false;
  if (f.pausada) { f.pausada = false; mudou = true; }
  if (f.imagens.estado === 'esperando' || f.imagens.estado === 'fazendo') { f.imagens.estado = 'cancelado'; delete f.imagens.vez; mudou = true; }
  const antes = f.videos.length;
  f.videos = f.videos.filter((v) => v.estado !== 'esperando' && v.estado !== 'fazendo');
  return mudou || f.videos.length !== antes ? f : undefined;
});

// ---- O estado (para o painel e para o agente) ----

// A lista que vale para a marca de hoje: a própria; ou, se a marca mudou e havia trabalho pela metade, o recomeço que o
// trabalhador vai fazer; ou nada.
function filaEfetiva(f, hoje) {
  if (!f) return null;
  if (f.assinatura === hoje) return f;
  return temPendente(f) ? recomecar(f, hoje, f.videos.map((v) => ({ estilo: v.estilo, modelo: v.modelo })), f.pedidoEm, f.empresa) : null;
}
// Há prévias na marca de outra marca (não a de hoje) na pasta da empresa?
function temPreviasVelhas(pasta, codigo, hoje) {
  let entradas;
  try { entradas = fs.readdirSync(pasta, { withFileTypes: true }); } catch { return false; }
  for (const e of entradas) {
    if (!e.isDirectory() || !ESTILO.test(e.name)) continue;
    const texto = lerTexto(path.join(pasta, e.name, 'previas.json'));
    let m = null;
    try { m = JSON.parse(texto); } catch { continue; }
    if (ehObjeto(m) && m.cores === 'marca' && m.empresa === codigo && m.estilo === e.name && typeof m.assinatura === 'string' && m.assinatura !== hoje) return true;
  }
  return false;
}
const VIDEOS_VAZIO = () => ({ feitos: 0, total: 0, atual: null, prontos: 0, semFonte: 0, semModelo: 0, erros: 0 });
// { estado, porEstilo }: o estado da empresa e o estado do vídeo de cada estilo (da lista que vale hoje).
function calcular(r, codigo) {
  const pasta = pastaDe(r, codigo);
  const { assinatura: hoje, definida } = pm.assinaturaDaMarca(r, codigo);
  // `trabalhador` fala só desta empresa: alguém vivo E trabalho desta empresa pela frente (nunca revela que outra está gerando)
  const vazio = (nome, extra = {}) => ({
    estado: { estado: nome, imagens: { estado: null, feitos: 0, total: 0, erro: null }, videos: VIDEOS_VAZIO(), desatualizada: false, pausada: false, trabalhador: false, ...extra },
    porEstilo: {},
  });
  if (!definida) return vazio('sem-marca');
  const desatualizada = temPreviasVelhas(pasta, codigo, hoje);
  const f = filaEfetiva(lerFilaDe(pasta, codigo), hoje);
  if (!f) return vazio('nada', { desatualizada });
  const im = f.imagens;
  const vs = f.videos;
  const conta = (estado) => vs.filter((v) => v.estado === estado).length;
  const pendImg = PENDENTES.includes(im.estado);
  const pendVid = vs.some((v) => PENDENTES.includes(v.estado));
  let nome;
  if (pendImg || pendVid) nome = f.pausada ? 'pausado' : pendImg ? 'imagens' : 'videos';
  else if (im.estado === 'cancelado' && !vs.length) nome = 'nada';
  else nome = 'pronto';
  const atual = vs.find((v) => v.estado === 'fazendo');
  const trabalhador = (pendImg || pendVid) && trabalhadorVivo(r);
  return {
    estado: {
      estado: nome,
      imagens: { estado: im.estado, feitos: Math.min(im.feitos, im.total), total: im.total, erro: im.erro },
      videos: {
        feitos: vs.filter((v) => FINAIS.includes(v.estado)).length, total: vs.length, atual: atual ? atual.estilo : null,
        prontos: conta('pronto'), semFonte: conta('sem-fonte'), semModelo: conta('sem-modelo'), erros: conta('erro'),
      },
      desatualizada, pausada: f.pausada, trabalhador,
    },
    porEstilo: Object.fromEntries(vs.map((v) => [v.estilo, v.estado])),
  };
}
// { estado: 'nada' | 'imagens' | 'videos' | 'pausado' | 'pronto' | 'sem-marca', imagens, videos: { feitos, total, atual,
//   prontos, semFonte, semModelo, erros }, desatualizada, pausada, trabalhador }. Só lê.
function estado(r, codigo) { return calcular(r, codigo).estado; }
// O mesmo estado e, por estilo, o estado do vídeo na marca (para o catálogo).
function estadoComVideos(r, codigo) { return calcular(r, codigo); }

// ---- O registro do trabalhador ----

const arqRegistro = (r) => path.join(r, 'empresas', '.fila-previas.json');
function registroVivo(lido, r, agora) {
  if (!lido.dados) return agora - lido.mtime < RESERVA_MS; // acabou de nascer (sem link no disco)
  const d = lido.dados;
  if (typeof d.raiz === 'string' && !mesmaRaiz(d.raiz, r)) return false; // registro trazido de outra pasta
  const batida = Date.parse(d.batida) || lido.mtime;
  if (!Number.isInteger(d.pid)) return agora - batida < RESERVA_MS; // lançado, mas o processo ainda não se apresentou
  return processoVivo(d.pid) && agora - batida < VIVO_MS;
}
function trabalhadorVivo(r, agora = Date.now()) {
  const lido = lerControle(arqRegistro(path.resolve(r)));
  return !!lido && registroVivo(lido, path.resolve(r), agora);
}
// O registro ainda é deste processo (pela `vez`)?
const registroEhMeu = (r, vez) => { const lido = lerControle(arqRegistro(r)); return !!lido && vezDe(lido.dados) === vez; };
// Regrava o registro só se ainda é deste processo: o temporário é preparado antes e o dono é conferido de novo logo antes
// da troca de nome (a janela que sobra é a da própria troca).
// `assumir`: o processo lançado assume a reserva (o campo `reservada` sai).
function regravarSeMeu(r, vez, mudar, { assumir = false } = {}) {
  const arq = arqRegistro(r);
  const lido = lerControle(arq);
  if (!lido || vezDe(lido.dados) !== vez) return false;
  const novo = { ...lido.dados, ...mudar };
  if (assumir) delete novo.reservada;
  const tmp = irmao(arq, 'tmp');
  fs.writeFileSync(tmp, JSON.stringify(novo), { flag: 'wx' });
  try {
    if (!registroEhMeu(r, vez)) return false;
    comRepeticao(() => fs.renameSync(tmp, arq));
    return true;
  } finally { try { fs.unlinkSync(tmp); } catch { /* já virou o registro */ } }
}
// Apaga o registro só se ainda é deste processo (conferido antes e depois de tirar: tirarSeAinda).
function soltarRegistro(r, vez) { tirarSeAinda(arqRegistro(r), vez); }
// Toma o registro para este processo. Só a RESERVA ainda não assumida com a mesma `vez` (deixada por garantirTrabalhador
// para o processo que ele lançou) pode ser assumida; um registro já assumido com a mesma `vez` é de outro processo vivo.
// Registro vivo de outro: false. Registro morto: é tirado e criado de novo, com exclusividade.
function registrar(r, vez, agora) {
  const arq = arqRegistro(r);
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  for (let i = 0; i < 20; i++) {
    const lido = lerControle(arq);
    const conteudo = { pid: process.pid, raiz: r, inicio: iso(agora()), batida: iso(agora()), vez };
    if (lido && vezDe(lido.dados) === vez && lido.dados.reservada === true) {
      return regravarSeMeu(r, vez, conteudo, { assumir: true });
    }
    if (lido && registroVivo(lido, r, agora())) return false;
    if (lido) { tirarSeAinda(arq, vezDe(lido.dados)); continue; }
    if (criarComConteudo(arq, JSON.stringify(conteudo))) return true;
  }
  return false;
}

// ---- Empresas presas ----
// Uma empresa cujo passo falha 3 vezes seguidas por um motivo que não é dela resolver na hora (lista só leitura, disco
// cheio...) fica "presa" por PRESA_MS em empresas/.fila-previas-presas.json ({ <codigo>: <desde> }, fora do git, sem nada
// além do código e da hora). Presa não conta como trabalho: o trabalhador segue com as outras e um trabalhador novo (lançado
// por um pedido de outra empresa) nem tenta. Sai da lista quando a própria empresa pede de novo, quando um passo dela dá
// certo ou quando o prazo acaba. Gravação por temporário + troca de nome, sem trava (perder uma marcação só faz a empresa
// ser tentada de novo).
const PRESA_MS = 10 * 60000;
const arqPresas = (r) => path.join(r, 'empresas', '.fila-previas-presas.json');
function lerPresas(r) {
  try { const x = JSON.parse(lerTexto(arqPresas(r))); return ehObjeto(x) ? x : {}; } catch { return {}; }
}
function presasAgora(r, agora = Date.now()) {
  const p = lerPresas(r);
  return new Set(Object.keys(p).filter((c) => agora - (Date.parse(p[c]) || 0) < PRESA_MS));
}
function marcarPresa(r, codigo, agora = Date.now()) {
  try { fs.mkdirSync(path.join(r, 'empresas'), { recursive: true }); gravarAtomico(arqPresas(r), JSON.stringify({ ...lerPresas(r), [codigo]: iso(agora) })); } catch { /* sem como marcar: ela só é tentada de novo */ }
}
function soltarPresa(r, codigo) {
  const p = lerPresas(path.resolve(r));
  if (!Object.prototype.hasOwnProperty.call(p, codigo)) return;
  delete p[codigo];
  try { gravarAtomico(arqPresas(path.resolve(r)), JSON.stringify(p)); } catch { /* fica até o prazo acabar */ }
}

// As empresas (com marca, sem pausa e não presas) com trabalho por fazer, do pedido mais antigo para o mais novo.
function empresasComTrabalho(r, fora = new Set()) {
  const lista = [];
  const presas = presasAgora(r);
  empresaMod.listar(r).forEach((e, ordem) => {
    if (fora.has(e.codigo) || presas.has(e.codigo)) return;
    let f;
    try {
      const pasta = pastaDe(r, e.codigo);
      if (!fs.existsSync(empresaMod.caminhos(e.codigo, r).marca)) return;
      f = lerFilaDe(pasta, e.codigo);
    } catch { return; }
    if (temTrabalho(f)) lista.push({ codigo: e.codigo, pedidoEm: f.pedidoEm || '9999', ordem });
  });
  return lista.sort((a, b) => (a.pedidoEm < b.pedidoEm ? -1 : a.pedidoEm > b.pedidoEm ? 1 : a.ordem - b.ordem));
}
const algumaTemTrabalho = (r) => empresasComTrabalho(r).length > 0;

// Lança o trabalhador se há trabalho e nenhum está vivo. Devolve true se lançou. A reserva do registro (com a `vez` que o
// processo lançado vai assumir) é criada com exclusividade ANTES do lançamento: dois pedidos ao mesmo tempo lançam um só.
// `lancar({ raiz, args, env, vez }) -> pid` é trocável nos testes.
function garantirTrabalhador(r, { lancar = lancarDeVerdade, agora = Date.now } = {}) {
  r = path.resolve(r);
  if (!algumaTemTrabalho(r)) return false;
  const arq = arqRegistro(r);
  for (let i = 0; i < 20; i++) {
    const lido = lerControle(arq);
    if (lido && registroVivo(lido, r, agora())) return false;
    if (lido) { tirarSeAinda(arq, vezDe(lido.dados)); continue; }
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    const vez = novaVez();
    if (!criarComConteudo(arq, JSON.stringify({ pid: null, raiz: r, inicio: iso(agora()), batida: iso(agora()), vez, reservada: true }))) continue;
    const env = { ...process.env, FABRICA_RAIZ: r, FABRICA_FILA_VEZ: vez };
    delete env.FABRICA_EMPRESA;
    delete env.FABRICA_MARCA;
    let pid;
    try { pid = lancar({ raiz: r, args: [__filename, 'rodar'], env, vez }); } catch (e) { soltarRegistro(r, vez); throw e; }
    if (Number.isInteger(pid) && pid > 0) regravarSeMeu(r, vez, { pid });
    return true;
  }
  return false;
}
function lancarDeVerdade({ raiz, args, env }) {
  const { spawn } = require('child_process');
  const filho = spawn(process.execPath, args, { cwd: raiz, env, detached: true, stdio: 'ignore', windowsHide: true });
  filho.on('error', () => { /* não subiu: o registro sem batida cai sozinho */ });
  filho.unref();
  return filho.pid;
}

// ---- O trabalhador ----

// Os passos padrão. As imagens: gerar-previas.js --marca num processo filho. O vídeo: o vídeo na marca
// (video-marca.gerarVideoNaMarca, que monta o modelo de Reels num processo filho), com a marca de hoje (mudou no meio: ele
// diz "refazer") e a pasta dos estilos da raiz dos dados (a mesma da grade). Ele é chamado pelo objeto do módulo (os testes
// o trocam por uma função falsa).
// Lista vazia é recusada: no gerar-previas.js, sem ids quer dizer "todos os estilos do código".
async function gerarImagensPadrao(r, codigo, opcoes) {
  if (!opcoes || !Array.isArray(opcoes.ids) || !opcoes.ids.length) throw new Error('nenhum estilo para preparar');
  return require('./gerar-previas').gerarImagensNaMarca(r, codigo, opcoes);
}
async function renderizarVideoPadrao(r, codigo, estilo, { assinatura, sinal } = {}) {
  return require('./video-marca').gerarVideoNaMarca({ raiz: r, empresa: codigo, estilo, assinatura, sinal, pastaEstilos: path.join(r, ...LAB_ESTILOS) });
}

// Temporários que um processo morto no meio (o computador desligado) deixou: as pastas de trabalho das prévias na pasta
// temporária do sistema (previas-XXXXXX e previas-letras-XXXXXX, o nome exato do mkdtemp do gerar-previas.js) e os
// temporários da marca e do estilo na pasta de cada empresa (marca.yaml.<pid>-<hora>.tmp, estilo.json.<pid>-<hora>.tmp,
// que o servidor de arquivos entregaria). Só os que não mudam há 6 horas: nada que alguém ainda esteja usando.
const ABANDONADO_MS = 6 * 3600 * 1000;
const TMP_PREVIAS = /^previas-(letras-)?[A-Za-z0-9]{6}$/;
const TMP_DA_EMPRESA = /^(marca\.yaml|estilo\.json)\.\d+-\d+\.tmp$/;
function velho(p, agora) { try { return agora - fs.lstatSync(p).mtimeMs > ABANDONADO_MS; } catch { return false; } }
function limparAbandonados(r, agora = Date.now()) {
  const os = require('os');
  let nomes = [];
  try { nomes = fs.readdirSync(os.tmpdir()); } catch { /* sem pasta temporária: nada a tirar */ }
  for (const n of nomes) {
    const p = path.join(os.tmpdir(), n);
    if (!TMP_PREVIAS.test(n) || !velho(p, agora)) continue;
    try { if (fs.lstatSync(p).isDirectory()) fs.rmSync(p, { recursive: true, force: true }); } catch { /* outro já tirou */ }
  }
  let empresas = [];
  try { empresas = empresaMod.listar(r); } catch { return; }
  for (const e of empresas) {
    let c;
    try { c = empresaMod.caminhos(e.codigo, r); } catch { continue; }
    for (const dir of new Set([path.dirname(c.marca), path.dirname(c.estilo)])) {
      let arqs = [];
      try { arqs = fs.readdirSync(dir); } catch { continue; }
      for (const n of arqs) {
        const p = path.join(dir, n);
        if (!TMP_DA_EMPRESA.test(n) || !velho(p, agora)) continue;
        try { if (fs.lstatSync(p).isFile()) fs.unlinkSync(p); } catch { /* fica */ }
      }
    }
  }
}

// Todo item "fazendo" de qualquer empresa volta para "esperando": quem o fazia morreu no meio.
function voltarFazendo(r) {
  for (const e of empresaMod.listar(r)) {
    try {
      if (!existeFila(pastaDe(r, e.codigo))) continue;
      alterarFila(r, e.codigo, (f) => {
        if (!f) return undefined;
        let mudou = false;
        if (f.imagens.estado === 'fazendo') { f.imagens.estado = 'esperando'; delete f.imagens.vez; mudou = true; }
        for (const v of f.videos) if (v.estado === 'fazendo') { v.estado = 'esperando'; v.inicio = null; delete v.vez; mudou = true; }
        return mudou ? f : undefined;
      });
    } catch (x) { console.error(`Não consegui conferir as prévias de ${e.codigo}: ${x.message}`); }
  }
}

// O `detalhe` técnico de um erro guardado no fila.json (que o servidor de arquivos entrega) é só um código curto: nunca o
// texto do outro programa, que pode trazer caminho absoluto ou o nome de outra empresa. O texto inteiro vai para o console.
function codigoDoErro(e) {
  const m = String((e && e.message) || e || '');
  const c = e && typeof e.code === 'string' ? e.code : '';
  if (/target[^]*closed|browser has been closed|context[^]*closed|navegador fechou/i.test(m)) return 'navegador-fechou';
  if (/timeout|timed out|tempo esgotado/i.test(m) || c === 'ETIMEDOUT') return 'tempo-esgotado';
  if (c === 'ENOSPC' || /ENOSPC/.test(m)) return 'disco-cheio';
  if (['EPERM', 'EACCES', 'EBUSY'].includes(c) || /EPERM|EACCES|EBUSY/.test(m)) return 'sem-permissao';
  if (c === 'ENOENT' || /ENOENT/.test(m)) return 'arquivo-faltando';
  if (/nenhum estilo/.test(m)) return 'sem-estilos';
  return 'outro';
}
function registrarErro(codigo, onde, e) { console.error(`Prévias de ${codigo} (${onde}): ${String((e && e.message) || e).slice(0, 2000)}`); }

// O passo das imagens tem limite de tempo: um processo filho preso (um ffmpeg ou um Chromium parado) não segura o
// trabalhador único, que atende todas as empresas. 5 min por estilo pedido, folgado (um estilo leva menos de 1 min mesmo
// com a máquina lenta sob carga); o gerar-previas.js também desiste sozinho depois de 5 min sem nenhum estilo pronto.
const LIMITE_IMAGENS_POR_ESTILO_MS = 5 * 60000;
// Durante as imagens, o trabalhador confere a lista a cada `vigiaMs` (a mesma batida do registro): cancelada, recomeçada
// (marca nova) ou pausada, o processo das imagens é encerrado na hora (o sinal chega ao gerarImagens).
async function passoImagens(r, codigo, hoje, vez, fns, { limiteImagensMs = null, vigiaMs = BATIDA_MS } = {}) {
  const grade = gradeDaEmpresa(r, codigo);
  let ids = null;
  const marcada = alterarFila(r, codigo, (f) => {
    if (!f || f.assinatura !== hoje || f.pausada || f.imagens.estado !== 'esperando') return undefined;
    ids = f.imagens.ids && f.imagens.ids.length ? f.imagens.ids.slice() : grade.map((g) => g.estilo);
    if (!ids.length) { Object.assign(f.imagens, { estado: 'pronto', feitos: 0, total: 0, erro: null, detalhe: null, ids: null, falhas: [] }); return f; } // grade vazia: nada a fazer
    const total = f.imagens.ids && f.imagens.ids.length ? Math.max(f.imagens.total, ids.length) : grade.length;
    f.imagens = { ...f.imagens, estado: 'fazendo', feitos: Math.max(0, total - ids.length), total, erro: null, detalhe: null, vez };
    return f;
  });
  if (marcada && ids && !ids.length) return true;
  if (!marcada || marcada.imagens.vez !== vez) return false;
  const base = marcada.imagens.feitos;
  const prontos = new Set(); // os estilos que ficaram prontos neste passo (para a pausa saber o que falta)
  let parou = null; // 'tempo' | 'cancelado' | 'pausa': por que o passo foi interrompido
  let motivoDoFim = null; // o erro da interrupção (vale mais que a rejeição do processo encerrado, que pode chegar antes)
  const aoAvancar = (p) => {
    if (!p || parou) return;
    if (p.ok && typeof p.id === 'string') prontos.add(p.id);
    if (!Number.isInteger(p.feitos)) return;
    try {
      alterarFila(r, codigo, (f) => {
        if (!f || f.imagens.vez !== vez) return undefined;
        f.imagens.feitos = Math.min(f.imagens.total, base + p.feitos);
        return f;
      });
    } catch { /* a contagem atrasa um pouco; o fim do passo acerta */ }
  };
  const parar = new AbortController();
  const limite = Number.isFinite(limiteImagensMs) && limiteImagensMs > 0 ? limiteImagensMs : ids.length * LIMITE_IMAGENS_POR_ESTILO_MS;
  let relogio = null;
  let vigia = null;
  const interrompido = new Promise((_, recusar) => {
    const pararCom = (motivo, mensagem, code) => {
      if (parou) return;
      parou = motivo;
      motivoDoFim = Object.assign(new Error(mensagem), { code });
      parar.abort(); // o gerarImagens encerra o processo filho
      recusar(motivoDoFim);
    };
    relogio = setTimeout(() => pararCom('tempo', `tempo esgotado: as imagens não terminaram em ${Math.round(limite / 1000)} s`, 'ETIMEDOUT'), limite);
    vigia = setInterval(() => {
      let f;
      try { f = lerFila(r, codigo); } catch { return; } // não deu para ler agora: confere na próxima
      if (!f || f.imagens.vez !== vez) pararCom('cancelado', 'as imagens foram canceladas', 'ABORTADO');
      else if (f.pausada) pararCom('pausa', 'as imagens foram pausadas', 'ABORTADO');
    }, vigiaMs);
  });
  interrompido.catch(() => { /* tratado na corrida abaixo */ });
  let res = null;
  let falhou = null;
  const trabalho = Promise.resolve().then(() => fns.gerarImagens(r, codigo, { ids, identidade: 'empresa', aoAvancar, sinal: parar.signal }));
  trabalho.catch(() => { /* interrompido: o fim do processo encerrado não importa mais */ });
  try { res = await Promise.race([trabalho, interrompido]); } catch (e) {
    falhou = motivoDoFim || e;
    if (parou !== 'pausa' && parou !== 'cancelado') registrarErro(codigo, 'imagens', e);
  } finally { clearTimeout(relogio); clearInterval(vigia); }
  if (res && !falhou) parou = null; // terminou antes de a interrupção valer: vale o resultado
  alterarFila(r, codigo, (f) => {
    if (!f || f.imagens.vez !== vez) return undefined; // cancelada ou recomeçada no meio (marca nova): o resultado não vale
    const im = f.imagens;
    delete im.vez;
    if (parou === 'pausa') {
      // pausada no meio: os estilos que faltam voltam a esperar (o retomar faz só eles)
      const faltam = ids.filter((id) => !prontos.has(id));
      if (!faltam.length) return Object.assign(im, { estado: 'pronto', feitos: im.total, erro: null, detalhe: null, ids: null, falhas: [] }) && f;
      return Object.assign(im, { estado: 'esperando', feitos: Math.min(im.total, base + prontos.size), erro: null, detalhe: null, ids: faltam }) && f;
    }
    if (falhou) return Object.assign(im, { estado: 'erro', erro: MSG.imagens, detalhe: codigoDoErro(falhou), ids }) && f;
    const dos = (l) => (Array.isArray(l) ? l : []).map((x) => (ehObjeto(x) ? x.id : x)).filter((x) => typeof x === 'string' && ids.includes(x));
    const falhas = [...new Set(dos(res && res.falhas))];
    const refazer = [...new Set(dos(res && res.refazer))];
    const naoFeitos = [...new Set([...refazer, ...falhas])];
    im.feitos = Math.max(0, im.total - naoFeitos.length);
    if (refazer.length) Object.assign(im, { estado: 'esperando', erro: null, detalhe: null, ids: naoFeitos }); // a marca mudou no meio
    else if (falhas.length) {
      (res.falhas || []).filter(ehObjeto).forEach((x) => registrarErro(codigo, `imagens de ${x.id}`, x.erro));
      // detalhe: só os ids dos estilos que falharam (os mesmos nomes de pasta da grade)
      Object.assign(im, { estado: 'erro', erro: `Não deu para preparar as imagens de ${falhas.length} estilo${falhas.length > 1 ? 's' : ''}.`, detalhe: falhas.join(' '), ids: falhas, falhas });
    } else Object.assign(im, { estado: 'pronto', erro: null, detalhe: null, ids: null, falhas: [] });
    return f;
  });
  return true;
}

async function passoVideo(r, codigo, hoje, vez, fns, agora) {
  let item = null;
  alterarFila(r, codigo, (f) => {
    if (!f || f.assinatura !== hoje || f.pausada || PENDENTES.includes(f.imagens.estado)) return undefined;
    const v = f.videos.find((x) => x.estado === 'esperando');
    if (!v) return undefined;
    Object.assign(v, { estado: 'fazendo', erro: null, inicio: iso(agora()), fim: null, vez });
    delete v.detalhe;
    item = { ...v };
    return f;
  });
  if (!item) return false;
  // Durante o vídeo, o trabalhador confere a lista a cada batida (como nas imagens): o estilo sumiu (cancelada ou recomeçada
  // com marca nova) ou a lista foi pausada -> o processo do vídeo é encerrado na hora (o sinal chega ao video-marca).
  const parar = new AbortController();
  let parou = null; // 'cancelado' | 'pausa'
  const vigiaMs = (fns.opcoesImagens && fns.opcoesImagens.vigiaMs) || BATIDA_MS;
  const vigia = setInterval(() => {
    if (parou) return;
    let f;
    try { f = lerFila(r, codigo); } catch { return; } // não deu para ler agora: confere na próxima
    const v = f && f.assinatura === hoje ? f.videos.find((x) => x.estilo === item.estilo && x.vez === vez) : null;
    if (!v) parou = 'cancelado';
    else if (f.pausada) parou = 'pausa';
    if (parou) parar.abort();
  }, vigiaMs);
  let res;
  let excecao = null;
  try {
    res = item.modelo ? await fns.renderizarVideo(r, codigo, item.estilo, { modelo: item.modelo, assinatura: hoje, sinal: parar.signal }) : { estado: 'sem-modelo' };
  } catch (e) { excecao = e; } finally { clearInterval(vigia); }
  // parado por pausa ou cancelamento: o que sobrou do processo encerrado não vale como erro do estilo. Se o vídeo terminou
  // antes de a parada valer (pronto), vale o resultado.
  const cortado = !!parou && (excecao !== null || (ehObjeto(res) && res.estado === 'erro'));
  if (cortado) {
    alterarFila(r, codigo, (f) => {
      const v = f && f.videos.find((x) => x.estilo === item.estilo && x.vez === vez);
      if (!v) return undefined; // cancelada ou recomeçada: o estilo já saiu da lista
      Object.assign(v, { estado: 'esperando', erro: null, inicio: null, fim: null });
      delete v.vez;
      delete v.detalhe;
      return f;
    });
    return 'video';
  }
  if (excecao) { registrarErro(codigo, `vídeo de ${item.estilo}`, excecao); res = { estado: 'erro', detalhe: codigoDoErro(excecao) }; }
  else if (ehObjeto(res) && res.estado === 'erro') res = { ...res, detalhe: codigoDoErro({ message: [res.detalhe, res.erro].filter((x) => typeof x === 'string').join(' ') }) };
  // "refazer" e "sem-marca" não são estado do estilo (nunca viram "erro"): são da empresa
  if (ehObjeto(res) && (res.estado === 'refazer' || res.estado === 'sem-marca')) return empresaDoVideo(r, codigo, item, vez, res.estado);
  if (!ehObjeto(res) || !FINAIS.includes(res.estado)) res = { estado: 'erro', detalhe: 'outro' };
  alterarFila(r, codigo, (f) => {
    const v = f && f.videos.find((x) => x.estilo === item.estilo && x.vez === vez);
    if (!v) return undefined; // recomeçou ou saiu da lista no meio: o resultado não vale
    Object.assign(v, { estado: res.estado, erro: res.estado === 'erro' ? MSG.video : null, fim: iso(agora()) });
    delete v.vez;
    const detalhe = res.estado === 'erro' ? limparTexto(res.detalhe || res.erro, 600) : null;
    if (detalhe) v.detalhe = detalhe;
    if (Array.isArray(res.avisos)) v.avisos = res.avisos;
    return f;
  });
  return 'video';
}

// O vídeo disse que o problema é da empresa, não do estilo:
// - "refazer" (a marca mudou): a empresa recomeça como marca nova, imagens e vídeos, com a marca de hoje -> 'refazer';
// - "sem-marca" (a empresa ficou sem marca): o estilo volta a esperar, sem erro, e a empresa para -> 'parar'. Ela não conta
//   como trabalho enquanto não tiver marca; com a marca de volta, o que esperava é feito.
// Se a lista recomeçou no meio (a `vez` do item sumiu), nada muda. A marca que some no recomeço também para a empresa.
function empresaDoVideo(r, codigo, item, vez, estadoDoVideo) {
  const deVolta = (f) => {
    const v = f && f.videos.find((x) => x.estilo === item.estilo && x.vez === vez);
    if (!v) return null;
    Object.assign(v, { estado: 'esperando', erro: null, inicio: null, fim: null });
    delete v.vez;
    delete v.detalhe;
    return f;
  };
  if (estadoDoVideo === 'refazer') {
    const { assinatura: hoje, definida } = pm.assinaturaDaMarca(r, codigo);
    if (definida) {
      const grade = gradeDaEmpresa(r, codigo);
      // a marca de hoje é a mesma da lista (mudou e voltou, ou o vídeo se enganou): só este estilo volta a esperar
      alterarFila(r, codigo, (f) => (!deVolta(f) ? undefined : f.assinatura === hoje ? f : recomecar(f, hoje, grade, f.pedidoEm, codigo)));
      return 'refazer';
    }
  }
  alterarFila(r, codigo, (f) => deVolta(f) || undefined);
  return 'parar';
}

// Um passo: escolhe a empresa (pedido mais antigo), confere a marca e faz as imagens ou um vídeo. false = nada a fazer
// naquela empresa agora (ela fica de fora até o próximo passo que fizer algo); 'video' = um vídeo terminou; 'refazer' = o
// vídeo pediu o recomeço da empresa; 'parar' = a empresa para nesta rodada (ficou sem marca); true = outro passo.
async function umPasso(r, codigo, vez, fns, agora) {
  const pasta = pastaDe(r, codigo);
  const { assinatura: hoje, definida } = pm.assinaturaDaMarca(r, codigo);
  if (!definida) return false;
  const f = lerFilaDe(pasta, codigo);
  if (!temTrabalho(f)) return false;
  if (f.assinatura !== hoje) {
    const grade = gradeDaEmpresa(r, codigo);
    const nova = alterarFila(r, codigo, (x) => (x && temPendente(x) && x.assinatura !== hoje ? recomecar(x, hoje, grade, x.pedidoEm, codigo) : undefined));
    return !!nova && nova.assinatura === hoje;
  }
  if (f.imagens.estado === 'esperando') return passoImagens(r, codigo, hoje, vez, fns, fns.opcoesImagens);
  return passoVideo(r, codigo, hoje, vez, fns, agora);
}

// O trabalhador: rodar(r, { gerarImagens, renderizarVideo, agora, batida, vez, limiteImagensMs, vigiaMs }) -> { rodou, passos }.
// Com outro vivo, sai sem fazer nada ({ rodou: false }). Termina quando nenhuma empresa tem trabalho (ou só sobram empresas
// presas) e apaga o próprio registro. Antes de cada passo confere que o registro ainda é dele; se outro assumiu, para ali.
// A `vez` vem do ambiente (FABRICA_FILA_VEZ, posta por garantirTrabalhador) e é apagada ao ser lida: não vai para os filhos.
// limiteImagensMs (o limite do passo das imagens; padrão: 5 min por estilo) e vigiaMs (de quanto em quanto tempo o passo
// das imagens confere pausa e cancelamento; padrão: a batida de 10 s) existem para os testes.
async function rodar(r, { gerarImagens = gerarImagensPadrao, renderizarVideo = renderizarVideoPadrao, agora = Date.now, batida = BATIDA_MS, vez,
  limiteImagensMs = null, vigiaMs = BATIDA_MS } = {}) {
  r = path.resolve(r);
  const doAmbiente = process.env.FABRICA_FILA_VEZ || null;
  delete process.env.FABRICA_FILA_VEZ;
  if (vez === undefined) vez = doAmbiente;
  const minha = typeof vez === 'string' && vez ? vez : novaVez();
  if (!registrar(r, minha, agora)) return { rodou: false, passos: 0 };
  try { limparAbandonados(r); } catch (e) { console.error('Não consegui tirar os temporários abandonados:', e.message); }
  let perdeu = false;
  const relogio = setInterval(() => {
    try { if (!regravarSeMeu(r, minha, { pid: process.pid, batida: iso(agora()) })) perdeu = true; } catch { /* tenta na próxima */ }
  }, batida);
  const fns = { gerarImagens, renderizarVideo, opcoesImagens: { limiteImagensMs, vigiaMs } };
  let passos = 0;
  const presasAqui = new Set(); // presas por este trabalhador (valem até ele sair, mesmo se a marcação no disco falhar)
  const refazeres = new Map(); // recomeços pedidos pelo vídeo, seguidos, de cada empresa (zera quando um vídeo termina)
  try {
    for (;;) {
      voltarFazendo(r);
      const fora = new Set(presasAqui); // sem nada a fazer agora (volta quando outra empresa anda), e as presas
      const falhas = new Map(); // erros seguidos de cada empresa
      while (!perdeu) {
        const proxima = empresasComTrabalho(r, fora)[0];
        if (!proxima) break;
        if (!registroEhMeu(r, minha)) { perdeu = true; break; } // outro assumiu: não começa passo nenhum
        const c = proxima.codigo;
        let fez;
        try { fez = await umPasso(r, c, minha, fns, agora); falhas.delete(c); } catch (e) {
          registrarErro(c, 'passo', e);
          const n = (falhas.get(c) || 0) + 1;
          falhas.set(c, n);
          if (n >= 3) { marcarPresa(r, c); presasAqui.add(c); fora.add(c); } // as outras seguem; o próximo trabalhador nem tenta
          else await dormir(200);
          continue;
        }
        if (fez === 'refazer') refazeres.set(c, (refazeres.get(c) || 0) + 1);
        else if (fez === 'video') refazeres.delete(c);
        // A empresa para nesta rodada (só na memória deste trabalhador; nada vira erro): ficou sem marca, ou o vídeo pediu
        // o recomeço 3 vezes seguidas sem nenhum vídeo terminar (sem laço infinito de imagens e vídeos).
        if (fez === 'parar' || (refazeres.get(c) || 0) >= MAX_REFAZER) { presasAqui.add(c); fora.add(c); continue; }
        if (fez) { passos++; soltarPresa(r, c); for (const x of [...fora]) if (!presasAqui.has(x)) fora.delete(x); } else fora.add(c);
      }
      if (perdeu) break;
      // Sai, e só então confere de novo: um pedido que chegou entre o último passo e a saída não fica sem ninguém.
      soltarRegistro(r, minha);
      if (!empresasComTrabalho(r, presasAqui).length || !registrar(r, minha, agora)) break;
    }
  } finally {
    clearInterval(relogio);
    try { soltarRegistro(r, minha); } catch { /* o registro sem batida cai sozinho */ }
  }
  return { rodou: true, passos };
}

// ---- Linha de comando ----

const USO = [
  'Uso:',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js estado <codigo> [--json]     como estão as prévias na marca da empresa',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js pedir <codigo>               pede as prévias na marca de hoje',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js priorizar <codigo> <estilo>  o vídeo deste estilo passa para a frente',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js pausar <codigo>              segura o próximo passo',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js retomar <codigo>             continua',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js cancelar <codigo>            tira o que ainda não começou (nada pronto é apagado)',
  '  node 08-FERRAMENTAS/biblioteca/fila-marca.js rodar                        faz o que falta, de todas as empresas, e termina',
  '  pedir, priorizar e retomar começam a preparação em segundo plano; --sem-trabalhador só anota o pedido.',
].join('\n');
const OPCOES = { estado: ['--json'], pedir: ['--sem-trabalhador'], priorizar: ['--sem-trabalhador'], retomar: ['--sem-trabalhador'], pausar: [], cancelar: [], rodar: [] };
const POSICIONAIS = { estado: 1, pedir: 1, priorizar: 2, retomar: 1, pausar: 1, cancelar: 1, rodar: 0 };
const RECUSAS = new Set(['SEM_MARCA', 'ESTILO_DESCONHECIDO', 'EMPRESA_DESCONHECIDA', 'FILA_OCUPADA']);

function textoDoEstado(nome, e) {
  const l = [`Prévias na marca de ${nome}:`];
  if (e.estado === 'sem-marca') { l.push('  A marca desta empresa ainda não foi definida. Defina a marca para ver os estilos nela.'); return l.join('\n'); }
  if (e.estado === 'nada') {
    l.push('  Nada pedido ainda.');
    if (e.desatualizada) l.push('  A marca mudou: as prévias antigas não valem mais. Peça de novo para refazer.');
    return l.join('\n');
  }
  l.push(`  Imagens: ${e.imagens.feitos} de ${e.imagens.total}${e.imagens.erro ? ` (${e.imagens.erro})` : ''}`);
  const v = e.videos;
  const extras = [];
  if (v.atual) extras.push(`agora: ${v.atual}`);
  if (v.semModelo) extras.push(`${v.semModelo} ainda sem vídeo na marca (fica o vídeo base)`);
  if (v.semFonte) extras.push(`${v.semFonte} precisam do vídeo de demonstração neste computador`);
  if (v.erros) extras.push(`${v.erros} com erro`);
  l.push(`  Vídeos: ${v.feitos} de ${v.total}${extras.length ? ` (${extras.join('; ')})` : ''}`);
  if (e.estado === 'pausado') l.push('  Em pausa.');
  else if (e.estado === 'pronto') l.push('  Tudo pronto.');
  else l.push(e.trabalhador ? '  Sendo preparadas agora.' : '  Esperando para começar.');
  return l.join('\n');
}

async function principal(argv) {
  const [cmd, ...resto] = argv;
  const uso = (msg) => { console.error((msg ? msg + '\n' : '') + USO); return 2; };
  if (!Object.prototype.hasOwnProperty.call(OPCOES, cmd || '')) return uso(cmd ? `Comando desconhecido: ${cmd}` : '');
  const opcoes = resto.filter((a) => a.startsWith('--'));
  const pos = resto.filter((a) => !a.startsWith('--'));
  const estranha = opcoes.find((o) => !OPCOES[cmd].includes(o));
  if (estranha) return uso(`Opção desconhecida: ${estranha}`);
  if (pos.length !== POSICIONAIS[cmd]) return uso('Faltou ou sobrou argumento.');
  const r = path.resolve(empresaMod.raiz());
  if (cmd === 'rodar') { await rodar(r); return 0; }
  const [codigo, id] = pos;
  try {
    pastaDe(r, codigo);
    const nome = limparTexto(empresaMod.listar(r).find((e) => e.codigo === codigo).nome, 80) || codigo;
    const comTrabalhador = !opcoes.includes('--sem-trabalhador');
    let e;
    if (cmd === 'estado') e = estado(r, codigo);
    else if (cmd === 'pedir') e = pedir(r, codigo);
    else if (cmd === 'priorizar') e = priorizar(r, codigo, id);
    else if (cmd === 'pausar') e = pausar(r, codigo);
    else if (cmd === 'retomar') e = retomar(r, codigo);
    else e = cancelar(r, codigo);
    if (['pedir', 'priorizar', 'retomar'].includes(cmd) && comTrabalhador) {
      if (garantirTrabalhador(r)) e = { ...e, trabalhador: true };
    }
    if (opcoes.includes('--json')) console.log(JSON.stringify(e));
    else console.log(textoDoEstado(nome, e));
    return 0;
  } catch (x) {
    if (RECUSAS.has(x.code)) { console.error(x.message); return 1; }
    throw x;
  }
}

module.exports = {
  VERSAO_FILA, alterarFila, lerFila, pedir, priorizar, pausar, retomar, cancelar, estado, estadoComVideos,
  rodar, garantirTrabalhador, trabalhadorVivo, limparTexto, principal,
  passosPadrao: { gerarImagens: gerarImagensPadrao, renderizarVideo: renderizarVideoPadrao },
};

if (require.main === module) {
  principal(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error('Erro inesperado: ' + (e && e.message)); process.exitCode = 2; });
}
