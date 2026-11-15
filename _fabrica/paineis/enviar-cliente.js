#!/usr/bin/env node
// Envio ao cliente: gera UM arquivo HTML, que abre sozinho em qualquer navegador, com o cronograma de UMA empresa.
//
// O arquivo é montado a partir da lista de posts da própria empresa (posts.json, config.json e as aprovações dela),
// nunca filtrando uma página que tenha todas as empresas. Antes de existir, ele passa pela conferência entre empresas
// (08-FERRAMENTAS/validador-anti-vazamento/validar.js --empresa): o arquivo é escrito numa pasta temporária nova,
// junto com uma cópia em texto puro de tudo o que veio dos posts (assim um termo com "&", ou quebrado em duas linhas
// da legenda, também é pego), e só com a conferência limpa ele é copiado para a pasta de envios da empresa.
// Com termo de outra empresa, nada é gerado e a resposta diz qual post, qual termo e de quem ele é.
// A pasta temporária fica dentro da pasta da própria empresa, com nome de ponto (.envio-tmp-...), e é sempre apagada
// (se o Windows não deixar apagar na hora, o envio já feito continua valendo). Um envio anterior nunca é sobrescrito: no mesmo dia vira -2, -3...
//
// O arquivo do cliente traz só o que é do post: data, rede, tema, legenda (se houver), se a arte já foi aprovada e a
// própria arte (imagens e vídeo dentro do arquivo, em base64, para ver em tamanho grande e baixar; ver montarArtes).
// Como a tela do Cronograma, abre no calendário de cada mês, com a legenda dos tipos no topo e um cartão por post na cor
// do tipo (tipos-de-post.js); clicar no cartão abre a janela do post (o visualizador, cliente-visor.js). "Lista" mostra os
// posts um embaixo do outro. Sem o visualizador (navegador que bloqueia), o calendário e a lista aparecem juntos e o
// cartão leva ao post na lista.
// Nada de código interno, roteiro, caminho deste computador, link para o servidor local ou coisa de outra empresa. O
// único script é o visualizador fixo da Fábrica (zip-simples.js + cliente-visor.js), sem dado nenhum e sem buscar nada.
// Os únicos links para fora são os de responder (post com arte para aprovar): "Aprovar" e "Pedir ajuste" abrem o
// WhatsApp (api.whatsapp.com/send) com a mensagem pronta, e a pessoa escolhe para quem manda.
// Cores: as da marca da empresa (as de exemplo se ela ainda não tem marca). Letras: as do sistema de quem abre (o
// arquivo de fonte da marca não vai junto, para o arquivo ficar leve e ser conferido por inteiro).
//
// Uso:  node _fabrica/paineis/enviar-cliente.js <codigo da empresa>      (vale FABRICA_RAIZ)
// Saída: uma linha de JSON, {"ok":true,"empresa","arquivo","endereco"} ou {"ok":false,"empresa","erro",...}.
// Código: 0 gerado, 1 não gerado (termo de outra empresa, nenhum post, arquivo da empresa com defeito), 2 uso errado.
//
// Módulo: enviar({ raiz, empresa, hoje?, pastaTemporaria?, validador?, remover? }) -> Promise<resultado>
//   pastaTemporaria, validador, remover e limiteVideo existem para os testes (onde criar a pasta temporária, quem faz a
//   conferência, quem apaga a pasta temporária e a partir de quantos bytes o vídeo vai à parte).
//   resultado ok:    { ok:true, empresa, arquivo (caminho completo), endereco (para o servidor dos painéis abrir), posts,
//                      comArte (posts com a arte dentro), anexos (vídeos à parte, caminhos completos), megas (tamanho) }
//   resultado falho: { ok:false, empresa, motivo: 'empresa'|'sem-posts'|'dados'|'vazamento'|'conferencia', erro, termo?, dona? }
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const dados = require('./dados');
const empresaMod = require('../core/empresa');
const { dadosEmpresa } = require('./servidor');
const { melhorContraste } = require('./empresa-seletor');
const { midiasDosPosts } = require('./midias');
const Tipos = require('./tipos-de-post');

const VALIDAR = path.join(__dirname, '..', '..', '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');
const ARQ_HTML = 'cronograma.html';
const ARQ_TEXTO = 'conferencia.txt';
const PLATAFORMAS = { insta: 'Instagram', yt: 'YouTube', linkedin: 'LinkedIn', blog: 'Blog', whats: 'WhatsApp', ads: 'Anúncio' };
// Cores de reserva (papel sem cor na marca), as mesmas das telas.
const CORES_PADRAO = { escuro: 'rgb(30, 32, 36)', claro: 'rgb(246, 244, 239)', acento: 'rgb(38, 102, 168)', neutro: 'rgb(132, 128, 120)' };
const LETRA_TITULO = '"Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, serif';
const LETRA_TEXTO = 'system-ui, -apple-system, "Segoe UI", sans-serif';
// O lugar da arte de cada post no arquivo conferido. Só a marca é conferida (o texto dos posts já está todo no
// arquivo); as imagens e os vídeos, em base64, entram no lugar dela depois da conferência, junto com o visualizador.
const MARCA_ARTE = (ordem) => `<!--arte-${ordem}-->`;
// Quanto da arte vai dentro do arquivo: vídeo de até 80 MB cada (maior vai como arquivo à parte, na mesma pasta do
// envio) e, no total, até 250 MB. Arte de post de mais de 7 dias atrás não vai (o post já foi publicado).
const LIMITE_VIDEO = 80e6;
const LIMITE_TOTAL = 250e6;
const DIAS_PARA_TRAS = 7;
const TIPOS_DADOS = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime' };
// O visualizador e o montador de .zip, sempre os mesmos, sem nenhum dado: vão dentro do arquivo do cliente.
const SCRIPT_CLIENTE = () => ['zip-simples.js', 'cliente-visor.js']
  .map((n) => fs.readFileSync(path.join(__dirname, n), 'utf8').replace(/<\/script/gi, '<\\/script')).join('\n');

// ---- utilidades ----

const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const umaLinha = (s) => String(s).replace(/\s+/g, ' ').trim();
const maiuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function hojeLocal() {
  const d = new Date();
  const dois = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

function partesData(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return null;
  const quando = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(quando);
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
  return { ano: m[1], mes: m[2], dia: m[3], quando };
}
const formato = (op) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...op });
const nomeDoMes = (p) => maiuscula(formato({ month: 'long', year: 'numeric' }).format(p.quando));
const diaDaSemana = (p) => formato({ weekday: 'short' }).format(p.quando).replace(/\.$/, '');
const dataPorExtenso = (p) => formato({ day: 'numeric', month: 'long', year: 'numeric' }).format(p.quando);
const diaPorExtenso = (p) => maiuscula(formato({ weekday: 'long', day: 'numeric', month: 'long' }).format(p.quando));
// Arte de post de mais de DIAS_PARA_TRAS dias antes de hoje não vai no arquivo (o post já foi publicado).
const limiteDaArte = (hoje) => (partesData(hoje) ? partesData(hoje).quando - DIAS_PARA_TRAS * 864e5 : -Infinity);

// Cor em [r, g, b] a partir de #RRGGBB ou rgb(r, g, b); e a mistura de duas cores (t = quanto da primeira).
function rgb(cor) {
  let m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor);
  if (m) return [1, 2, 3].map((i) => parseInt(m[i], 16));
  m = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(cor);
  return m ? [1, 2, 3].map((i) => Number(m[i])) : [128, 128, 128];
}
function misturar(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(', ')})`;
}

// Lê a lista ou o objeto de um arquivo da empresa; formato errado conta como arquivo com defeito (nunca é regravado).
function lerDaEmpresa(arq, padrao, tipo) {
  const v = dados.lerJson(arq, padrao);
  if (tipo === 'lista' ? !Array.isArray(v) : !objeto(v)) {
    throw Object.assign(new Error('formato'), { code: 'JSON_INVALIDO', arquivo: arq });
  }
  return v;
}

// ---- o conteúdo ----

// Posts da empresa com o que o cliente vê. "Arte aprovada" quando alguma peça aprovada está ligada ao post (pela
// aprovação ou, sem ela, pela própria peça, como no Laboratório).
function prepararPosts(posts, pecas, aprovacoes, midias = {}) {
  const aprovados = new Set();
  for (const [id, reg] of Object.entries(aprovacoes)) {
    if (!objeto(reg)) continue;
    const peca = pecas.find((p) => objeto(p) && p.id === id);
    const postId = typeof reg.postId === 'string' && reg.postId ? reg.postId : (peca && typeof peca.postId === 'string' ? peca.postId : null);
    if (postId) aprovados.add(postId);
  }
  return posts.filter(objeto).map((p, ordem) => {
    // as artes com imagem ou vídeo (a prévia em página não vai: ela só abre neste computador)
    const grupos = (typeof p.id === 'string' && Array.isArray(midias[p.id]) ? midias[p.id] : []).filter((g) => g.imagens.length || g.video);
    return {
      data: partesData(p.date),
      tipo: Tipos.tipoDoPost(p), // a cor, o ícone e o nome do cartão no calendário
      rede: texto(p.platformLabel) || PLATAFORMAS[p.platform] || texto(p.platform) || 'Rede a definir',
      titulo: texto(p.title) || 'Post sem título',
      legenda: typeof p.caption === 'string' ? p.caption.trim() : '',
      aprovado: typeof p.id === 'string' && aprovados.has(p.id),
      grupos,
      ordem,
    };
  }).sort((a, b) => {
    if (a.data && b.data) return a.data.quando - b.data.quando || a.ordem - b.ordem;
    if (a.data || b.data) return a.data ? -1 : 1;
    return a.ordem - b.ordem;
  });
}

function coresDaMarca(marca) {
  const c = { ...CORES_PADRAO };
  for (const papel of Object.keys(CORES_PADRAO)) {
    const v = marca.cores && marca.cores[papel];
    if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) c[papel] = v;
  }
  return {
    ...c,
    sobreAcento: melhorContraste(c.acento, c.escuro, c.claro),
    texto2: misturar(c.escuro, c.claro, 0.68),
    linha: misturar(c.neutro, c.claro, 0.35),
    fundo2: misturar(c.acento, c.claro, 0.08),
  };
}

// ---- o calendário (o mesmo da tela do Cronograma) ----

const NOTA_DA_LEGENDA = '✓ arte aprovada · ⬇️ arte pronta para baixar · clique no post para abrir';

// O cartão do post: borda e fundo na cor do tipo, o nome do tipo, o título e as marcas ("✓ aprovada", "⬇️ arte pronta"
// quando a arte vai dentro do arquivo). É um link para o post na lista: com o visualizador, abre a janela do post.
function cartaoDoPost(p, limite) {
  const pronta = p.grupos.length > 0 && !(p.data && p.data.quando < limite);
  const marcas = [p.aprovado ? '✓ aprovada' : '', pronta ? '⬇️ arte pronta' : ''].filter(Boolean).join(' · ');
  return `<a class="cartao-post tipo-${p.tipo.chave}" href="#post-${p.ordem}" data-post="${p.ordem}">`
    + `<span class="cartao-tipo"><span aria-hidden="true">${p.tipo.icone}</span> ${escapar(p.tipo.nome)}</span>`
    + `<span class="cartao-titulo">${escapar(p.titulo)}</span>${marcas ? `<span class="cartao-marcas">${marcas}</span>` : ''}</a>`;
}

// A legenda no topo do calendário de um mês: cada tipo que existe no cronograma, com quantos posts há no mês.
function legendaDoMes(postsDoMes, existentes) {
  return '<div class="legenda-tipos"><ul class="legenda-lista">' + existentes.map((t) => {
    const n = postsDoMes.filter((p) => p.tipo.chave === t.chave).length;
    return `<li class="legenda-tipo tipo-${t.chave}${n ? '' : ' sem-post'}"><i aria-hidden="true"></i><span aria-hidden="true">${t.icone}</span>${escapar(t.nome)} · ${n}</li>`;
  }).join('') + `</ul><p class="legenda-nota">${NOTA_DA_LEGENDA}</p></div>`;
}

// As linhas do calendário de um mês (uma linha por semana, começando pelo primeiro dia da semana), como pares [html, quem]: cada cartão
// fica numa linha só, de quem é o post (para a conferência citar o post certo).
function calendarioDoMes(g, existentes, limite) {
  const [a, m] = g.chave.split('-').map(Number);
  const inicio = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const total = Math.ceil((inicio + diasNoMes) / 7) * 7;
  const linhas = [['<div class="calendario">'], [legendaDoMes(g.posts, existentes)]];
  linhas.push(['<div class="semana-cab" aria-hidden="true">' + Array.from({ length: 7 }, (_, i) => `<span>${escapar(diaDaSemana({ quando: Date.UTC(2023, 0, 1 + i) }))}</span>`).join('') + '</div>']);
  linhas.push(['<div class="dias">']);
  for (let i = 0; i < total; i++) {
    const quando = Date.UTC(a, m - 1, 1 + i - inicio);
    const d = new Date(quando);
    const fora = d.getUTCMonth() !== m - 1;
    const doDia = fora ? [] : g.posts.filter((p) => p.data.quando === quando);
    const num = `<span class="dia-num"><b>${d.getUTCDate()}</b><span class="dia-semana">${escapar(diaDaSemana({ quando }))}</span></span>`;
    if (!doDia.length) { linhas.push([`<div class="dia ${fora ? 'fora' : 'livre'}">${num}</div>`]); continue; }
    linhas.push([`<div class="dia">${num}<div class="dia-posts">`]);
    for (const p of doDia) linhas.push([cartaoDoPost(p, limite), { tipo: 'post', post: p }]);
    linhas.push(['</div></div>']);
  }
  linhas.push(['</div>'], ['</div>']);
  return linhas;
}

// Monta o HTML (e a cópia em texto puro para a conferência). Cada post ocupa UMA linha do HTML e uma linha por campo
// no texto: `quemHtml[i]` / `quemTexto[i]` dizem de quem é a linha i+1, para a mensagem citar o post certo.
function montar({ empresa, marca, periodo, posts, hoje }) {
  const cores = coresDaMarca(marca);
  const html = [];
  const quemHtml = [];
  const linha = (s, quem = null) => { html.push(s); quemHtml.push(quem); };
  const conferencia = [];
  const quemTexto = [];
  // Na cópia em texto puro, caracteres invisíveis (hífen suave, espaço de largura zero, marcas de direção: categoria Cf)
  // saem, para que "Bo<invisível>real" seja lido como "Boreal", do mesmo jeito que o cliente enxerga.
  const paraConferir = (s, quem) => { if (s) { conferencia.push(umaLinha(String(s).replace(/\p{Cf}/gu, ''))); quemTexto.push(quem); } };

  const cabecalho = { tipo: 'cabecalho' };
  const hojeP = partesData(hoje);
  const resumo = [periodo, posts.length === 1 ? '1 post' : `${posts.length} posts`, hojeP ? 'atualizado em ' + dataPorExtenso(hojeP) : '']
    .filter(Boolean).map(escapar).join(' · ');
  paraConferir(empresa, cabecalho);
  paraConferir(periodo, cabecalho);

  linha('<!doctype html>');
  linha('<html lang="pt-BR">');
  linha('<head>');
  linha('<meta charset="utf-8">');
  linha('<meta name="viewport" content="width=device-width, initial-scale=1">');
  linha(`<title>Cronograma de conteúdo — ${escapar(empresa)}</title>`, cabecalho);
  linha('<style>');
  [
    `:root { --escuro: ${cores.escuro}; --claro: ${cores.claro}; --acento: ${cores.acento}; --neutro: ${cores.neutro};`,
    `  --sobre-acento: ${cores.sobreAcento}; --texto-2: ${cores.texto2}; --linha: ${cores.linha}; --fundo-2: ${cores.fundo2};`,
    `  --letra-titulo: ${LETRA_TITULO}; --letra-texto: ${LETRA_TEXTO}; }`,
    '* { box-sizing: border-box; }',
    'html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'body { margin: 0; background: var(--claro); color: var(--escuro); font: 16px/1.55 var(--letra-texto); }',
    '.capa { background: var(--escuro); color: var(--claro); padding: 48px 0 40px; }',
    // largo para o calendário; a lista continua estreita, como sempre foi
    '.capa > div, main, footer { max-width: 1120px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }',
    'body.vista-lista main { max-width: 808px; }',
    '.sobretitulo { margin: 0 0 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--acento); }',
    'h1 { margin: 0; font: 600 clamp(30px, 6vw, 44px)/1.08 var(--letra-titulo); letter-spacing: -0.01em; overflow-wrap: anywhere; }',
    '.resumo { margin: 14px 0 0; opacity: 0.8; font-size: 15px; }',
    'main { padding-top: 12px; padding-bottom: 8px; }',
    '.mes { margin-top: 32px; }',
    '.mes h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 6px; padding-bottom: 10px;',
    '  border-bottom: 2px solid var(--escuro); font: 600 24px/1.2 var(--letra-titulo); }',
    '.mes h2 span { font: 500 14px/1 var(--letra-texto); color: var(--texto-2); }',
    '.posts { list-style: none; margin: 0; padding: 0; max-width: 760px; }',
    '.post { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 18px; padding: 20px 0; border-bottom: 1px solid var(--linha); break-inside: avoid; }',
    '.post-data { text-align: center; padding-top: 2px; }',
    '.post-data b { display: block; font: 600 32px/1 var(--letra-titulo); }',
    '.post-data span { display: block; margin-top: 4px; font-size: 13px; color: var(--texto-2); text-transform: capitalize; }',
    '.post-data.sem-data b { font-size: 20px; }',
    '.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 13px; }',
    '.rede { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--escuro); }',
    '.estado { padding: 2px 10px; border-radius: 999px; border: 1px solid var(--linha); color: var(--texto-2); font-weight: 600; }',
    '.estado.aprovado { background: var(--acento); border-color: var(--acento); color: var(--sobre-acento); }',
    '.post h3 { margin: 0; font: 600 20px/1.3 var(--letra-titulo); overflow-wrap: anywhere; }',
    '.legenda { margin: 10px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--fundo-2); overflow-wrap: anywhere; }',
    'footer { padding-top: 24px; padding-bottom: 48px; font-size: 14px; color: var(--texto-2); }',
    'footer p { margin: 0 0 6px; }',
    '@media (max-width: 480px) { .capa { padding: 36px 0 30px; } .capa > div, main, footer { padding-left: 16px; padding-right: 16px; }',
    '  .post { grid-template-columns: 48px minmax(0, 1fr); gap: 12px; } .post-data b { font-size: 26px; } }',
    '@media print { .capa { padding: 28px 0; } .mes { break-inside: auto; } .arte-acoes, .copiar-legenda, .vistas { display: none !important; }',
    '  body.vista-calendario .posts, body.vista-lista .calendario, body.vista-lista .cartoes-lista { display: block !important; } }',
    // os tipos de post: cor, ícone e nome fixos, iguais para toda empresa (não seguem a marca), os mesmos da tela
    ...Tipos.cssDosTipos(),
    '.etiqueta-tipo { display: inline-flex; align-items: center; gap: 4px; padding: 1px 9px 1px 7px; border-radius: 999px;',
    '  background: var(--tipo-fundo); color: var(--tipo-tinta); box-shadow: inset 3px 0 0 var(--tipo-cor); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }',
    // Calendário | Lista (os botões só aparecem com o visualizador funcionando)
    '.vistas { display: inline-flex; margin: 24px 0 0; padding: 3px; border: 1px solid var(--linha); border-radius: 999px; background: var(--fundo-2); }',
    '.vistas button { border: 0; border-radius: 999px; background: transparent; padding: 7px 18px; font: 600 14px/1.2 var(--letra-texto); color: var(--texto-2); cursor: pointer; }',
    '.vistas button[aria-pressed="true"] { background: var(--claro); color: var(--escuro); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18); }',
    'body.vista-calendario .posts, body.vista-lista .calendario, body.vista-lista .cartoes-lista { display: none; }',
    // o calendário de cada mês: uma linha por semana, começando pelo primeiro dia da semana; dia sem post apagado
    '.calendario { margin-top: 12px; border: 1px solid var(--linha); border-radius: 14px; overflow: hidden; background: var(--claro); }',
    '.legenda-tipos { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 24px; padding: 12px 14px; border-bottom: 1px solid var(--linha); }',
    '.legenda-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 18px; }',
    '.legenda-tipo { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; white-space: nowrap; }',
    '.legenda-tipo i { flex: none; width: 14px; height: 14px; border-radius: 4px; background: var(--tipo-cor); }',
    '.legenda-tipo.sem-post { font-weight: 500; color: var(--texto-2); } .legenda-tipo.sem-post i { opacity: 0.4; }',
    '.legenda-nota { margin: 0; font-size: 13px; color: var(--texto-2); }',
    '.semana-cab, .dias { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }',
    '.semana-cab span { padding: 8px 8px 7px; font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--texto-2); background: var(--fundo-2); }',
    '.dia { min-height: 120px; min-width: 0; padding: 6px; border-top: 1px solid var(--linha); border-left: 1px solid var(--linha); display: flex; flex-direction: column; gap: 6px; }',
    '.dia:nth-child(7n + 1) { border-left: 0; }',
    `.dia.livre, .dia.fora { background: ${misturar(cores.neutro, cores.claro, 0.07)}; }`,
    '.dia.livre .dia-num { opacity: 0.5; } .dia.fora .dia-num { opacity: 0.28; }',
    '.dia-num { display: flex; align-items: center; gap: 6px; padding: 2px 4px; font-size: 13px; font-weight: 600; }',
    '.dia-semana { display: none; font-weight: 400; font-size: 12px; color: var(--texto-2); text-transform: capitalize; }',
    '.dia-posts { display: flex; flex-direction: column; gap: 5px; min-width: 0; }',
    // o cartão do post: borda esquerda e fundo suave na cor do tipo
    '.cartao-post { display: flex; flex-direction: column; gap: 2px; min-width: 0; text-decoration: none; border-left: 4px solid var(--tipo-cor); border-radius: 6px;',
    '  background: var(--tipo-fundo); color: var(--tipo-texto); padding: 5px 7px 6px 8px; font-size: 12.5px; line-height: 1.3; }',
    '.cartao-post:hover { box-shadow: inset 0 0 0 1px var(--tipo-cor); }',
    '.cartao-tipo { font-size: 10.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--tipo-tinta); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
    '.cartao-titulo { font-weight: 600; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }',
    '.cartao-marcas { font-size: 11px; opacity: 0.78; }',
    '.cartoes-lista { display: grid; gap: 8px; max-width: 680px; margin-top: 12px; } .cartoes-lista .cartao-post { padding: 9px 12px 10px; font-size: 15px; } .cartoes-lista .cartao-tipo { font-size: 11px; }',
    // a janela do post (clique no cartão): tudo do post, com a barra de baixar fixa no alto
    '.detalhe { width: min(820px, calc(100vw - 24px)); max-width: none; max-height: min(92vh, 1100px); padding: 0; border: 0; border-radius: 16px; overflow: hidden;',
    '  background: var(--claro); color: var(--escuro); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); }',
    '.detalhe::backdrop { background: rgba(12, 12, 14, 0.55); }',
    '.detalhe-caixa { max-height: min(92vh, 1100px); overflow: auto; overscroll-behavior: contain; }',
    '.detalhe-barra { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 10px 18px;',
    '  padding: 14px 20px; background: var(--claro); border-top: 6px solid var(--tipo-cor); border-bottom: 1px solid var(--linha); }',
    '.detalhe-cabeca { flex: 1 1 260px; min-width: 0; }',
    '.detalhe-quando { margin: 0 0 4px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: var(--texto-2); }',
    '.detalhe-cabeca h2 { margin: 0; font: 600 21px/1.25 var(--letra-titulo); overflow-wrap: anywhere; }',
    '.detalhe-acoes { display: flex; flex-wrap: wrap; gap: 8px; }',
    '.detalhe-corpo { padding: 0 20px 6px; } .detalhe-corpo .post { display: block; max-width: none; border-bottom: 0; padding: 14px 0; }',
    '.detalhe-corpo .post-data, .detalhe-corpo .post h3, .detalhe-corpo .meta .etiqueta-tipo { display: none; }',
    // tela estreita: o calendário vira agenda, só com os dias que têm post, um embaixo do outro
    '@media (max-width: 760px) { .legenda-tipos { padding: 10px 12px; border-bottom: 0; } .semana-cab { display: none; } .dias { display: block; }',
    '  .dia.livre, .dia.fora { display: none; } .dia { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; min-height: 0; padding: 10px 12px; border-left: 0; }',
    '  .dia-num { flex-direction: column; gap: 0; padding: 0; font-size: 17px; } .dia-semana { display: block; } .cartao-post { padding: 8px 10px 9px; font-size: 15px; } .cartao-tipo { font-size: 11px; }',
    '  .detalhe { width: 100vw; max-height: 100dvh; border-radius: 0; } .detalhe-caixa { max-height: 100dvh; } .detalhe-barra { padding: 12px 16px; } .detalhe-corpo { padding: 0 16px 6px; } }',
    // as artes: miniaturas que abrem o visualizador, o vídeo e os botões de baixar
    '[hidden] { display: none !important; }',
    '.arte { margin: 12px 0 0; padding: 12px; border-radius: 12px; background: var(--fundo-2); }',
    '.arte-cabeca { margin: 0 0 8px; font-size: 13px; color: var(--texto-2); }',
    '.miniaturas { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }',
    '.miniatura { flex: none; height: 168px; padding: 0; border: 1px solid var(--linha); border-radius: 6px; overflow: hidden; background: var(--claro); cursor: zoom-in; }',
    '.miniatura img { display: block; height: 100%; width: auto; max-width: 220px; object-fit: cover; }',
    '.video { display: block; width: 100%; max-width: 300px; aspect-ratio: 9 / 16; border-radius: 10px; background: #000; }',
    '.arte-acoes, .visor-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }',
    '.nota { margin: 10px 0 0; font-size: 14px; color: var(--texto-2); }',
    '.botao { border: 1px solid var(--linha); background: var(--claro); color: var(--escuro); border-radius: 999px; padding: 8px 16px; font: 600 14px/1.2 var(--letra-texto); cursor: pointer; }',
    '.botao.principal { background: var(--acento); border-color: var(--acento); color: var(--sobre-acento); }',
    '.copiar-legenda { margin-top: 8px; }',
    '.responder { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 0; padding-top: 12px; border-top: 1px dashed var(--linha); }',
    '.responder a { padding: 10px 20px; border-radius: 999px; font-weight: 700; font-size: 15px; text-decoration: none; }',
    '.responder .aprovar { background: var(--acento); color: var(--sobre-acento); }',
    '.responder .ajuste { border: 2px solid var(--escuro); color: var(--escuro); }',
    '@media print { .responder { display: none; } }',
    'body.visor-aberto { overflow: hidden; }',
    // o visualizador também é uma janela, aberta por cima da janela do post
    '.visor { position: fixed; inset: 0; z-index: 10; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0;',
    '  display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background: rgba(12, 12, 14, 0.97); color: #fff; }',
    '.visor:not([open]) { display: none; }',
    '.visor::backdrop { background: transparent; }',
    '.visor-cabeca { display: flex; align-items: center; gap: 12px; padding: 12px 14px 8px 18px; }',
    '.visor-titulo { flex: 1; min-width: 0; display: flex; flex-direction: column; }',
    '.visor-titulo span { font-size: 13px; opacity: 0.75; }',
    '.visor-fechar { width: 40px; height: 40px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.35); background: transparent; color: #fff; font-size: 22px; cursor: pointer; }',
    '.visor-palco { position: relative; display: flex; align-items: center; justify-content: center; min-height: 0; overflow: hidden; padding: 0 60px; }',
    '.visor-palco img { display: block; max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 6px; }',
    '.visor-seta { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.16); color: #fff; font-size: 24px; cursor: pointer; }',
    '.visor-seta[disabled] { opacity: 0.25; cursor: default; }',
    '.visor-seta.antes { left: 10px; } .visor-seta.depois { right: 10px; }',
    '.visor-rodape { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px 14px; }',
    '.visor-trilho { display: flex; gap: 6px; overflow-x: auto; min-width: 0; flex: 1 1 220px; }',
    '.visor-trilho button { flex: none; height: 52px; padding: 0; border: 2px solid transparent; border-radius: 5px; overflow: hidden; background: #000; opacity: 0.6; cursor: pointer; }',
    '.visor-trilho button[aria-current="true"] { border-color: var(--acento); opacity: 1; }',
    '.visor-trilho img { display: block; height: 100%; width: auto; }',
    '.visor .botao { background: transparent; color: #fff; border-color: rgba(255,255,255,0.4); }',
    '.visor .botao.principal { background: var(--acento); border-color: var(--acento); color: var(--sobre-acento); }',
    '.aviso-cliente { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 20; max-width: calc(100vw - 32px); padding: 12px 18px; border-radius: 12px; background: var(--escuro); color: var(--claro); }',
    '@media (max-width: 480px) { .visor-palco { padding: 0 4px; } .visor-seta { width: 36px; height: 36px; } .visor-seta.antes { left: 4px; } .visor-seta.depois { right: 4px; } .miniatura { height: 140px; } }',
  ].forEach((l) => linha(l));
  linha('</style>');
  linha('</head>');
  linha('<body>');
  linha('<header class="capa"><div>');
  linha('<p class="sobretitulo">Cronograma de conteúdo</p>');
  linha(`<h1>${escapar(empresa)}</h1>`, cabecalho);
  linha(`<p class="resumo">${resumo}</p>`, cabecalho);
  linha('</div></header>');
  linha('<main>');

  // "Calendário | Lista": os botões ficam escondidos até o visualizador ligá-los (sem ele, o calendário e a lista
  // aparecem um embaixo do outro).
  linha('<div class="vistas" role="group" aria-label="Como ver os posts" hidden><button type="button" data-vista="calendario" aria-pressed="true">Calendário</button>'
    + '<button type="button" data-vista="lista" aria-pressed="false">Lista</button></div>');

  // Um grupo por mês; posts sem data no fim. Cada mês abre com o calendário (a legenda traz os tipos que existem no
  // cronograma inteiro) e depois a lista; os posts sem data ganham os cartões em lista, no lugar do calendário.
  const grupos = [];
  for (const p of posts) {
    const chave = p.data ? p.data.ano + '-' + p.data.mes : 'sem-data';
    let g = grupos.find((x) => x.chave === chave);
    if (!g) { g = { chave, titulo: p.data ? nomeDoMes(p.data) : 'Data a definir', posts: [] }; grupos.push(g); }
    g.posts.push(p);
  }
  const existentes = Tipos.TIPOS.filter((t) => posts.some((p) => p.tipo.chave === t.chave));
  const limite = limiteDaArte(hoje);
  for (const g of grupos) {
    linha('<section class="mes">');
    linha(`<h2>${escapar(g.titulo)} <span>${g.posts.length === 1 ? '1 post' : g.posts.length + ' posts'}</span></h2>`);
    if (g.chave === 'sem-data') {
      linha('<div class="cartoes-lista">');
      for (const p of g.posts) linha(cartaoDoPost(p, limite), { tipo: 'post', post: p });
      linha('</div>');
    } else {
      for (const [html, quem] of calendarioDoMes(g, existentes, limite)) linha(html, quem || null);
    }
    linha('<ol class="posts">');
    for (const p of g.posts) {
      const quem = { tipo: 'post', post: p };
      const dia = p.data
        ? `<div class="post-data"><b>${Number(p.data.dia)}</b><span>${escapar(diaDaSemana(p.data))}</span></div>`
        : '<div class="post-data sem-data"><b>—</b><span>a definir</span></div>';
      const etiqueta = `<span class="etiqueta-tipo"><span aria-hidden="true">${p.tipo.icone}</span> ${escapar(p.tipo.nome)}</span>`;
      const legenda = p.legenda ? `<p class="legenda">${p.legenda.split(/\r?\n/).map(escapar).join('<br>')}</p>` : '';
      const paraAprovar = !p.aprovado && p.grupos && p.grupos.length > 0;
      const estado = p.aprovado ? 'Arte aprovada' : paraAprovar ? 'Arte para aprovar' : 'Em produção';
      // Aprovar ou pedir ajuste: abre o WhatsApp com a mensagem pronta (a pessoa escolhe para quem manda). O texto da
      // mensagem é o título e a data do post, que a conferência já lê.
      const qual = (p.data ? `post de ${p.data.dia}/${p.data.mes}` : `post “${p.titulo}”`) + ` (${p.rede}): ${p.titulo}`;
      const zap = (msg) => 'https://api.whatsapp.com/send?text=' + encodeURIComponent(msg.trim());
      const responder = paraAprovar
        ? `<p class="responder"><a class="aprovar" href="${escapar(zap(`Aprovo o ${qual}.`))}" target="_blank" rel="noopener">Aprovar</a>`
          + `<a class="ajuste" href="${escapar(zap(`Quero um ajuste no ${qual}. Ajuste que eu quero:`))}" target="_blank" rel="noopener">Pedir ajuste</a></p>`
        : '';
      // MARCA_ARTE: o lugar da arte do post. A conferência lê o arquivo com a marca; as imagens entram depois dela.
      const quando = p.data ? diaPorExtenso(p.data) : 'Data a definir';
      linha(`<li class="post tipo-${p.tipo.chave}" id="post-${p.ordem}" data-quando="${escapar(quando)}">${dia}<div><p class="meta">${etiqueta}<span class="rede">${escapar(p.rede)}</span>`
        + `<span class="estado${p.aprovado ? ' aprovado' : ''}">${estado}</span></p>`
        + `<h3>${escapar(p.titulo)}</h3>${MARCA_ARTE(p.ordem)}${legenda}${responder}</div></li>`, quem);
      paraConferir(p.rede, quem);
      paraConferir(p.titulo, quem);
      paraConferir(p.legenda, quem);
    }
    linha('</ol>');
    linha('</section>');
  }
  linha('</main>');
  linha('<footer>');
  linha('<p>Cada post tem a cor e o ícone do seu tipo (Reels, Carrossel, Stories, WhatsApp, Anúncio...). Clique num post do calendário para abrir tudo dele: a arte, os botões para baixar e a legenda para copiar. Em “Lista”, os posts aparecem um embaixo do outro.</p>');
  linha('<p><b>Arte para aprovar:</b> a arte está pronta para você ver e aprovar. <b>Arte aprovada:</b> a arte já foi aprovada. <b>Em produção:</b> a arte ainda está sendo feita.</p>');
  linha('<p>Toque numa imagem para ver em tamanho grande. Cada arte tem os botões para baixar as imagens e o vídeo. Para responder, use “Aprovar” ou “Pedir ajuste”: abre o WhatsApp com a mensagem pronta para enviar.</p>');
  linha('<p>Datas e textos podem mudar até a publicação.</p>');
  linha('</footer>');
  linha('</body>');
  linha('</html>');
  return { html: html.join('\n') + '\n', quemHtml, conferencia: conferencia.join('\n') + '\n', quemTexto };
}

// ---- a arte dentro do arquivo ----

const dois = (v) => String(v).padStart(2, '0');
// O nome do arquivo baixado pelo cliente: "13-11 A lei nova do MEI - 02.png" (data, título e ordem), sem caminho.
function nomeParaBaixar(p, nomeOriginal, i, total) {
  const ext = (/\.[a-z0-9]+$/i.exec(nomeOriginal) || ['.png'])[0].toLowerCase();
  const dia = p.data ? `${p.data.dia}-${p.data.mes} ` : '';
  const titulo = p.titulo.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return dia + titulo + (total > 1 ? ' - ' + dois(i + 1) : '') + ext;
}

// O HTML das artes de cada post (posição no arquivo = marca do post), com as imagens e o vídeo em base64.
// `anexos`: os vídeos grandes demais, que vão como arquivo à parte (o nome vem de `nomeAnexo(n)`).
function montarArtes(r, posts, hoje, nomeAnexo, limiteVideo = LIMITE_VIDEO) {
  const limiteData = limiteDaArte(hoje);
  const blocos = new Map();
  const anexos = [];
  let total = 0;
  let cortado = false;
  const dataUrl = (a) => `data:${TIPOS_DADOS[path.extname(a.nome).toLowerCase()] || 'application/octet-stream'};base64,`
    + fs.readFileSync(path.join(r, ...a.caminho.split('/'))).toString('base64');
  for (const p of posts) {
    if (!p.grupos || !p.grupos.length) { blocos.set(p.ordem, ''); continue; }
    if (p.data && p.data.quando < limiteData) {
      blocos.set(p.ordem, '<p class="nota">Post de mais de uma semana atrás: a arte não vai neste arquivo.</p>');
      continue;
    }
    const partes = [];
    const base = nomeParaBaixar(p, 'arte.zip', 0, 1).replace(/\.zip$/, '');
    // Post com mais de uma arte: cada uma ganha o seu número ("Arte 2"), que o botão de baixar da janela do post repete.
    // O nome da peça não vai: ele não passou pela conferência entre empresas.
    const varias = p.grupos.length > 1;
    for (const [k, g] of p.grupos.entries()) {
      const itens = [];
      let video = '';
      if (g.video) {
        if (g.video.bytes > limiteVideo || total + g.video.bytes > LIMITE_TOTAL) {
          const nome = nomeAnexo(anexos.length + 1, path.extname(g.video.nome).toLowerCase());
          anexos.push({ origem: path.join(r, ...g.video.caminho.split('/')), nome });
          video = `<p class="nota">O vídeo deste post vai junto, num arquivo separado: <b>${escapar(nome)}</b>.</p>`;
        } else {
          total += g.video.bytes;
          video = `<video class="video" controls playsinline preload="metadata" data-nome="${escapar(nomeParaBaixar(p, g.video.nome, 0, 1))}" src="${dataUrl(g.video)}"></video>`;
        }
      }
      const imagens = [];
      for (const [i, img] of g.imagens.entries()) {
        if (total + img.bytes > LIMITE_TOTAL) { cortado = true; break; }
        total += img.bytes;
        imagens.push(`<button type="button" class="miniatura" aria-label="Ver a imagem ${i + 1} em tamanho grande"><img src="${dataUrl(img)}" alt="${escapar(p.titulo)}, imagem ${i + 1}" data-nome="${escapar(nomeParaBaixar(p, img.nome, i, g.imagens.length))}"></button>`);
      }
      if (imagens.length) itens.push(`<div class="miniaturas">${imagens.join('')}</div>`);
      if (imagens.length < g.imagens.length) itens.push('<p class="nota">Algumas imagens desta arte não couberam neste arquivo. Peça para recebê-las à parte.</p>');
      const resumo = [g.video ? 'vídeo' : '', imagens.length ? (imagens.length === 1 ? '1 imagem' : `${imagens.length} imagens`) : ''].filter(Boolean).join(' e ');
      partes.push(`<section class="arte" data-titulo="${escapar(p.titulo)}" data-base="${escapar(base + (varias ? ' - arte ' + (k + 1) : ''))}">`
        + `<p class="arte-cabeca">${varias ? `Arte ${k + 1} · ` : ''}${escapar(varias ? resumo : maiuscula(resumo))}${g.aprovada ? ' · aprovada' : ' · para aprovar'}</p>`
        + video + itens.join('') + '<div class="arte-acoes" hidden></div></section>');
    }
    blocos.set(p.ordem, partes.join(''));
  }
  return { blocos, anexos, cortado };
}

// ---- a conferência entre empresas ----

function rodarValidador(codigo, pasta, r) {
  return new Promise((resolve) => {
    execFile(process.execPath, [VALIDAR, '--empresa', codigo, pasta, '--raiz', r], {
      encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 20 * 1024 * 1024,
    }, (erro, stdout, stderr) => {
      const status = erro ? (typeof erro.code === 'number' ? erro.code : -1) : 0;
      resolve({ status, stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}

// As linhas de achado do validador: `<arquivo>:<linha>  "<achado>"  é termo de <Nome> (<codigo>), ...`.
function lerAchados(saida) {
  const achados = [];
  for (const l of saida.split(/\r?\n/)) {
    const m = /^(.+?)(?::(\d+))?  "(.*)"  é termo de (.+)$/.exec(l);
    if (!m) continue;
    const donas = [...m[4].matchAll(/(.+?) \(([a-z0-9][a-z0-9-]*)\)(?:, |$)/g)].map((x) => x[1]);
    achados.push({ arquivo: path.basename(m[1].replace(/\\/g, '/')), linha: m[2] ? Number(m[2]) : 0, termo: m[3], dona: donas.length ? donas.join(' e ') : '' });
  }
  return achados;
}

const comparavel = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function mensagem(quem, termo, dona) {
  const deQuem = dona && comparavel(dona) !== comparavel(termo) ? `, que é de outra empresa (${dona})` : ', que é de outra empresa';
  if (quem && quem.tipo === 'post') {
    const p = quem.post;
    const qual = p.data ? `O post de ${p.data.dia}/${p.data.mes}` : `O post “${p.titulo}”`;
    return `${qual} cita “${termo}”${deQuem}. Corrija o post e tente de novo.`;
  }
  if (quem && quem.tipo === 'cabecalho') return `O nome ou o período do cronograma cita “${termo}”${deQuem}. Corrija e tente de novo.`;
  return `O cronograma cita “${termo}”${deQuem}. Corrija e tente de novo.`;
}

// Apaga a pasta temporária sem nunca trocar o resultado do envio por um erro: no Windows o antivírus ou o indexador
// podem segurar o arquivo por um instante (EBUSY/EPERM). Se mesmo assim não sair, a pasta (de ponto) fica para trás.
function apagarPasta(pasta) {
  fs.rmSync(pasta, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

// Cria a pasta (e as que faltarem acima dela). Devolve a mais alta que foi criada agora, ou undefined se já existia.
function criarPasta(pasta) {
  return fs.mkdirSync(pasta, { recursive: true });
}

// Tira da pasta temporária as pastas vazias que este envio criou só para ela (uma recusa não deixa pasta nova para trás).
function limparCriadas(base, maisAlta) {
  if (!maisAlta) return;
  try {
    for (let p = base; ; p = path.dirname(p)) {
      fs.rmdirSync(p);
      if (p === maisAlta) break;
    }
  } catch { /* não está vazia (tem o envio) ou o sistema ainda segura: fica como está */ }
}

// ---- o envio ----

async function enviar(opcoes = {}) {
  const r = path.resolve(opcoes.raiz || dados.raiz());
  const pedida = opcoes.empresa;
  let lista;
  try {
    lista = empresaMod.listar(r);
  } catch (e) {
    if (e.code === 'JSON_INVALIDO') return { ok: false, empresa: null, motivo: 'dados', erro: `A lista de empresas não está em um formato válido. Nada foi gerado: confira o arquivo ${e.arquivo}.` };
    throw e;
  }
  // A empresa vem da lista da pasta: o texto pedido nunca vira caminho sem passar por aqui.
  if (typeof pedida !== 'string' || !lista.some((e) => e.codigo === pedida)) {
    const codigos = lista.map((e) => e.codigo).join(', ') || 'nenhuma';
    return { ok: false, empresa: null, motivo: 'empresa', erro: `A empresa ${JSON.stringify(String(pedida)).slice(0, 60)} não existe nesta pasta (empresas: ${codigos}). Nada foi gerado.` };
  }
  const codigo = pedida;
  const falha = (motivo, erro, extra = {}) => ({ ok: false, empresa: codigo, motivo, erro, ...extra });
  const hoje = typeof opcoes.hoje === 'string' && partesData(opcoes.hoje) ? opcoes.hoje : hojeLocal();

  // Só os arquivos desta empresa.
  const c = dados.caminhos(r, codigo);
  let posts;
  let config;
  try {
    const brutos = lerDaEmpresa(c.posts, [], 'lista');
    const pecas = lerDaEmpresa(c.pecas, [], 'lista');
    const aprovacoes = lerDaEmpresa(c.aprovacoes, {}, 'objeto');
    config = lerDaEmpresa(c.config, {}, 'objeto');
    // as artes de cada post: só arquivos desta empresa que existem (as mesmas que o Cronograma mostra)
    const midias = midiasDosPosts(r, codigo, { posts: brutos, pecas, aprovacoes });
    posts = prepararPosts(brutos, pecas, aprovacoes, midias);
  } catch (e) {
    if (e.code === 'JSON_INVALIDO') return falha('dados', `O arquivo ${e.arquivo} não está em um formato válido. Nada foi gerado: corrija o arquivo (ou peça ajuda ao agente) e tente de novo.`);
    throw e;
  }
  if (!posts.length) return falha('sem-posts', 'Ainda não há posts no cronograma desta empresa. Nada foi gerado.');

  const marca = dadosEmpresa(r, codigo);
  const conteudo = montar({ empresa: marca.nome, marca, periodo: texto(config.periodo), posts, hoje });

  // Dentro da pasta da empresa (e não na pasta temporária do sistema): o caminho que o validador vê é curto, relativo à
  // Fábrica, e nunca leva o nome de quem usa o computador, mesmo com a Fábrica em outro disco.
  const base = path.resolve(opcoes.pastaTemporaria || path.dirname(empresaMod.caminhos(codigo, r).envios));
  const maisAlta = criarPasta(base);
  const tmp = fs.mkdtempSync(path.join(base, '.envio-tmp-'));
  const validar = typeof opcoes.validador === 'function' ? opcoes.validador : rodarValidador;
  const remover = typeof opcoes.remover === 'function' ? opcoes.remover : apagarPasta;
  try {
    fs.writeFileSync(path.join(tmp, ARQ_HTML), conteudo.html, 'utf8');
    fs.writeFileSync(path.join(tmp, ARQ_TEXTO), conteudo.conferencia, 'utf8');
    const v = await validar(codigo, tmp, r);
    if (v.status === 1) {
      const achados = lerAchados(v.stdout);
      // O validador sempre fecha com a linha "RESULTADO:". Sem ela e sem nenhum achado, ele não terminou: não é vazamento.
      if (!achados.length && !/^RESULTADO:/m.test(v.stdout)) return falha('conferencia', 'A conferência não terminou. Nenhum arquivo foi criado. Tente de novo.');
      if (!achados.length) return falha('vazamento', 'O cronograma cita o nome de outra empresa. Nada foi gerado. Peça ao agente para conferir os posts.');
      // Um achado por post e termo (o mesmo trecho aparece no HTML e no texto puro).
      const vistos = new Map();
      for (const a of achados) {
        const quem = (a.arquivo === ARQ_HTML ? conteudo.quemHtml : a.arquivo === ARQ_TEXTO ? conteudo.quemTexto : [])[a.linha - 1] || null;
        const chave = (quem && quem.tipo === 'post' ? 'post' + quem.post.ordem : quem ? quem.tipo : '-') + '|' + comparavel(a.termo);
        if (!vistos.has(chave)) vistos.set(chave, { ...a, quem });
      }
      const [primeiro, ...outros] = [...vistos.values()];
      const mais = outros.length ? ` Há mais ${outros.length} ${outros.length === 1 ? 'trecho' : 'trechos'} com nome de outra empresa.` : '';
      return falha('vazamento', mensagem(primeiro.quem, primeiro.termo, primeiro.dona) + mais, { termo: primeiro.termo, dona: primeiro.dona });
    }
    // Saída 0 só vale se o validador leu os dois arquivos (ou se não há outra empresa com que cruzar).
    const lidos = /Arquivos lidos: (\d+)/.exec(v.stdout);
    const conferido = v.status === 0 && (/Só há uma empresa/.test(v.stdout) || (lidos && Number(lidos[1]) === 2));
    if (!conferido) {
      const motivo = umaLinha(v.stderr).slice(0, 200);
      return falha('conferencia', 'Não consegui conferir o cronograma antes de enviar, então nada foi gerado.' + (motivo ? ` (${motivo})` : ''));
    }
    // Liberado: grava na pasta de envios da empresa sem nunca sobrescrever (mesmo dia: -2, -3...), já com as artes
    // no lugar das marcas e o visualizador. Vídeo grande demais vai ao lado, com o nome do envio.
    const pasta = empresaMod.caminhos(codigo, r).envios;
    fs.mkdirSync(pasta, { recursive: true });
    const prefixo = `cronograma-${codigo}-${hoje}`;
    for (let n = 1; n < 1000; n++) {
      const nomeBase = n === 1 ? prefixo : `${prefixo}-${n}`;
      const destino = path.join(pasta, nomeBase + '.html');
      if (fs.existsSync(destino)) continue;
      const artes = montarArtes(r, posts, hoje, (k, ext) => `${nomeBase}-video-${k}${ext}`, Number(opcoes.limiteVideo) > 0 ? Number(opcoes.limiteVideo) : LIMITE_VIDEO);
      let html = conteudo.html;
      for (const p of posts) html = html.replace(MARCA_ARTE(p.ordem), () => artes.blocos.get(p.ordem) || '');
      html = html.replace('</body>', () => `<script>\n${SCRIPT_CLIENTE()}\n</script>\n</body>`);
      try {
        fs.writeFileSync(destino, html, { encoding: 'utf8', flag: 'wx' });
      } catch (e) {
        if (e.code === 'EEXIST') continue;
        throw e;
      }
      const anexos = [];
      for (const a of artes.anexos) {
        const alvo = path.join(pasta, a.nome);
        fs.copyFileSync(a.origem, alvo, fs.constants.COPYFILE_EXCL);
        anexos.push(alvo);
      }
      const endereco = '/' + path.relative(r, destino).split(path.sep).map(encodeURIComponent).join('/');
      const comArte = posts.filter((p) => artes.blocos.get(p.ordem)).length;
      return { ok: true, empresa: codigo, arquivo: destino, endereco, posts: posts.length, comArte, anexos, megas: Math.round(fs.statSync(destino).size / 1e5) / 10 };
    }
    return falha('conferencia', 'Já há envios demais com a data de hoje na pasta de envios. Nada foi gerado.');
  } finally {
    try { remover(tmp); } catch { /* o envio já está decidido; a pasta de ponto sobra e some na próxima limpeza */ }
    limparCriadas(base, maisAlta);
  }
}

module.exports = { enviar };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args[0].startsWith('-')) {
    console.error('uso: node _fabrica/paineis/enviar-cliente.js <codigo da empresa>');
    process.exit(2);
  }
  enviar({ raiz: dados.raiz(), empresa: args[0] }).then((res) => {
    process.stdout.write(JSON.stringify(res) + '\n');
    process.exit(res.ok ? 0 : res.motivo === 'empresa' ? 2 : 1);
  }).catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}
