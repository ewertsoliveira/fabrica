// As artes de cada post do Cronograma: as imagens (lâminas, capa, post), o vídeo e a prévia que a pessoa vê e baixa.
// Usado pelo servidor dos painéis (rota /api/dados, campo `midias`) e pelo envio ao cliente. Só lê o disco.
//
// De onde vem a arte de um post, nesta ordem:
//   1. a peça do Laboratório ligada ao post (pela aprovação ou pelo `postId` da peça):
//      aprovada  -> as imagens guardadas na pasta da publicação (aprovacoes.json: `pasta` + `arquivos`);
//      sem aprovação -> as imagens da pasta de entrega da peça (`pasta`) ou, sem ela, da pasta da prévia (`path`):
//        as de `nomesArquivos`, se a peça listar, senão todas as imagens da pasta (menos as miniaturas);
//      o vídeo da peça (`video`, ou o próprio `path` quando ele é um vídeo) e a prévia (`path`, quando é uma página);
//   2. o próprio post (`images`, `video`, `previewUrl`), quando nenhuma peça trouxe imagem ou vídeo.
// Só entra arquivo que existe, com caminho relativo à pasta da Fábrica, sem "..", sem pasta de ponto e da própria
// empresa (dados.pertenceAEmpresa): um post nunca mostra arquivo de outra empresa nem de fora da Fábrica.
//
// midiasDosPosts(r, codigo, { posts, pecas, aprovacoes }) -> { [postId]: [grupo] }
//   grupo = { id, nome, tipo, aprovada, aprovadaEm, imagens: [arquivo], video: arquivo | null, previa: url | null }
//   arquivo = { nome, url, caminho (relativo à Fábrica, com "/"), bytes }
'use strict';
const fs = require('fs');
const path = require('path');
const dados = require('./dados');

const IMAGENS = ['.png', '.jpg', '.jpeg', '.webp'];
const VIDEOS = ['.mp4', '.webm', '.mov'];
const MAX_IMAGENS = 30; // uma peça com mais que isso não é um post: fica nas primeiras 30
const RE_MINIATURA = /miniatura|100px|thumb/i;

const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const texto = (v) => typeof v === 'string' && v.trim() !== '';
const extensao = (n) => path.extname(String(n)).toLowerCase();
const comBarra = (p) => String(p).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

// Ordem natural: lamina-2 antes de lamina-10.
const naturais = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

// O endereço do arquivo no servidor dos painéis (servido a partir da pasta da Fábrica), com a data da última mudança
// para o navegador não mostrar uma versão velha.
function endereco(rel, st) {
  return '/' + rel.split('/').map(encodeURIComponent).join('/') + '?v=' + Math.round(st.mtimeMs);
}

// Caminho relativo seguro desta empresa? (sem "..", sem absoluto, sem pasta de ponto, da própria empresa)
function caminhoDaEmpresa(rel, codigo, r) {
  if (!dados.caminhoRelativoSeguro(rel)) return false;
  if (rel.split('/').some((s) => s.startsWith('.') || s.includes(':'))) return false;
  return dados.pertenceAEmpresa(rel, codigo, r);
}

// Um arquivo (imagem ou vídeo) desta empresa que existe; null se não serve.
function arquivo(r, codigo, rel, tipos) {
  if (!texto(rel)) return null;
  const limpo = comBarra(rel);
  if (!tipos.includes(extensao(limpo)) || !caminhoDaEmpresa(limpo, codigo, r)) return null;
  let st;
  try { st = fs.statSync(path.join(r, ...limpo.split('/'))); } catch { return null; }
  if (!st.isFile()) return null;
  return { nome: path.posix.basename(limpo), url: endereco(limpo, st), caminho: limpo, bytes: st.size };
}

// As imagens de uma pasta desta empresa: as `nomes` pedidos (as imagens entre eles), ou todas menos as miniaturas.
function imagensDaPasta(r, codigo, pasta, nomes) {
  if (!texto(pasta)) return [];
  const limpa = comBarra(pasta);
  if (!caminhoDaEmpresa(limpa, codigo, r)) return [];
  let lista;
  const pedidos = Array.isArray(nomes) ? nomes.filter((n) => texto(n) && !/[\\/]/.test(n) && IMAGENS.includes(extensao(n))) : [];
  if (pedidos.length) lista = pedidos;
  else {
    try { lista = fs.readdirSync(path.join(r, ...limpa.split('/'))); } catch { return []; }
    lista = lista.filter((n) => IMAGENS.includes(extensao(n)) && !RE_MINIATURA.test(n) && !n.startsWith('.'));
  }
  return [...new Set(lista)].sort(naturais.compare).slice(0, MAX_IMAGENS)
    .map((n) => arquivo(r, codigo, limpa + '/' + n, IMAGENS)).filter(Boolean);
}

function previaDe(r, codigo, rel) {
  if (!texto(rel) || !/\.html?$/i.test(rel)) return null;
  const limpo = comBarra(rel);
  if (!caminhoDaEmpresa(limpo, codigo, r)) return null;
  try {
    const st = fs.statSync(path.join(r, ...limpo.split('/')));
    return st.isFile() ? endereco(limpo, st) : null;
  } catch { return null; }
}

// A arte de uma peça do Laboratório.
function grupoDaPeca(r, codigo, p, reg) {
  const aprovada = objeto(reg);
  let imagens = [];
  if (aprovada && texto(reg.pasta) && Array.isArray(reg.arquivos)) {
    imagens = imagensDaPasta(r, codigo, reg.pasta, reg.arquivos.length ? reg.arquivos : null);
  }
  if (!imagens.length && texto(p.pasta)) imagens = imagensDaPasta(r, codigo, p.pasta, p.nomesArquivos);
  if (!imagens.length && texto(p.path)) imagens = imagensDaPasta(r, codigo, path.posix.dirname(comBarra(p.path)), p.nomesArquivos);
  const video = arquivo(r, codigo, p.video, VIDEOS) || arquivo(r, codigo, p.path, VIDEOS);
  return {
    id: p.id,
    nome: texto(p.name) ? p.name.trim() : 'Arte',
    tipo: typeof p.tipo === 'string' ? p.tipo : 'outro',
    aprovada,
    aprovadaEm: aprovada && typeof reg.aprovadoEm === 'string' ? reg.aprovadoEm : null,
    imagens: video && p.tipo === 'video' ? [] : imagens,
    video,
    previa: previaDe(r, codigo, p.path),
  };
}

function midiasDosPosts(r, codigo, { posts, pecas, aprovacoes }) {
  const lista = Array.isArray(posts) ? posts.filter((p) => objeto(p) && texto(p.id)) : [];
  const ps = Array.isArray(pecas) ? pecas.filter((p) => objeto(p) && texto(p.id)) : [];
  const aprov = objeto(aprovacoes) ? aprovacoes : {};
  const ids = new Set(lista.map((p) => p.id));
  const saida = {};
  for (const p of ps) {
    const reg = objeto(aprov[p.id]) ? aprov[p.id] : null;
    const postId = reg && texto(reg.postId) ? reg.postId : p.postId;
    if (!texto(postId) || !ids.has(postId)) continue;
    (saida[postId] = saida[postId] || []).push(grupoDaPeca(r, codigo, p, reg));
  }
  // O post sem arte de peça: a que ele mesmo aponta (images, video, previewUrl).
  for (const post of lista) {
    const grupos = saida[post.id] || [];
    const temImagem = grupos.some((g) => g.imagens.length);
    const temVideo = grupos.some((g) => g.video);
    const imagens = temImagem ? [] : (Array.isArray(post.images) ? post.images : []).slice(0, MAX_IMAGENS).map((x) => arquivo(r, codigo, x, IMAGENS)).filter(Boolean);
    const video = temVideo ? null : arquivo(r, codigo, post.video, VIDEOS);
    if (!imagens.length && !video) continue;
    const previa = grupos.some((g) => g.previa) ? null : previaDe(r, codigo, post.previewUrl);
    grupos.push({ id: 'post:' + post.id, nome: 'Arte do post', tipo: 'outro', aprovada: false, aprovadaEm: null, imagens, video, previa });
    saida[post.id] = grupos;
  }
  return saida;
}

// O nome de um arquivo baixado: "13-11 A lei nova do MEI - 02.png" (dia e mês, título e ordem), sem caractere proibido.
function nomeParaBaixar(post, nomeOriginal, i, total) {
  const ext = (/\.[a-z0-9]+$/i.exec(String(nomeOriginal)) || ['.png'])[0].toLowerCase();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String((post && post.date) || ''));
  const dia = m ? `${m[3]}-${m[2]} ` : '';
  const titulo = String((post && post.title) || 'Post').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return dia + titulo + (total > 1 ? ' - ' + String(i + 1).padStart(2, '0') : '') + ext;
}

// O .zip com as imagens de uma arte de um post (e a legenda do post, em legenda.txt), montado na memória.
// Devolve { nome, dados } ou null quando o post ou a arte não existem nesta empresa.
function zipDaArte(r, codigo, listas, postId, grupoId) {
  const post = (Array.isArray(listas.posts) ? listas.posts : []).find((p) => objeto(p) && p.id === postId);
  if (!post) return null;
  const grupo = (midiasDosPosts(r, codigo, listas)[postId] || []).find((g) => g.id === grupoId);
  if (!grupo || !grupo.imagens.length) return null;
  const arquivos = grupo.imagens.map((img, i) => ({
    nome: nomeParaBaixar(post, img.nome, i, grupo.imagens.length),
    dados: fs.readFileSync(path.join(r, ...img.caminho.split('/'))),
  }));
  if (texto(post.caption)) arquivos.push({ nome: 'legenda.txt', dados: Buffer.from(post.caption.trim().replace(/\r?\n/g, '\r\n') + '\r\n', 'utf8') });
  return { nome: nomeParaBaixar(post, 'artes.zip', 0, 1), dados: Buffer.from(require('./zip-simples').montar(arquivos)) };
}

module.exports = { midiasDosPosts, zipDaArte, nomeParaBaixar, IMAGENS, VIDEOS };
