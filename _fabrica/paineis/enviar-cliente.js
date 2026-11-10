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
// O arquivo do cliente traz só o que é do post: data, rede, tema, legenda (se houver) e se a arte já foi aprovada.
// Nada de código interno, caminho deste computador, link para o servidor local, script ou coisa de outra empresa.
// Cores: as da marca da empresa (as de exemplo se ela ainda não tem marca). Letras: as do sistema de quem abre (o
// arquivo de fonte da marca não vai junto, para o arquivo ficar leve e ser conferido por inteiro).
//
// Uso:  node _fabrica/paineis/enviar-cliente.js <codigo da empresa>      (vale FABRICA_RAIZ)
// Saída: uma linha de JSON, {"ok":true,"empresa","arquivo","endereco"} ou {"ok":false,"empresa","erro",...}.
// Código: 0 gerado, 1 não gerado (termo de outra empresa, nenhum post, arquivo da empresa com defeito), 2 uso errado.
//
// Módulo: enviar({ raiz, empresa, hoje?, pastaTemporaria?, validador?, remover? }) -> Promise<resultado>
//   pastaTemporaria, validador e remover existem para os testes (onde criar a pasta temporária, quem faz a conferência
//   e quem apaga a pasta temporária).
//   resultado ok:    { ok:true, empresa, arquivo (caminho completo), endereco (para o servidor dos painéis abrir), posts }
//   resultado falho: { ok:false, empresa, motivo: 'empresa'|'sem-posts'|'dados'|'vazamento'|'conferencia', erro, termo?, dona? }
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const dados = require('./dados');
const empresaMod = require('../core/empresa');
const { dadosEmpresa } = require('./servidor');
const { melhorContraste } = require('./empresa-seletor');

const VALIDAR = path.join(__dirname, '..', '..', '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');
const ARQ_HTML = 'cronograma.html';
const ARQ_TEXTO = 'conferencia.txt';
const PLATAFORMAS = { insta: 'Instagram', yt: 'YouTube', linkedin: 'LinkedIn', blog: 'Blog' };
// Cores de reserva (papel sem cor na marca), as mesmas das telas.
const CORES_PADRAO = { escuro: 'rgb(30, 32, 36)', claro: 'rgb(246, 244, 239)', acento: 'rgb(38, 102, 168)', neutro: 'rgb(132, 128, 120)' };
const LETRA_TITULO = '"Iowan Old Style", "Palatino Linotype", Palatino, ui-serif, serif';
const LETRA_TEXTO = 'system-ui, -apple-system, "Segoe UI", sans-serif';

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
function prepararPosts(posts, pecas, aprovacoes) {
  const aprovados = new Set();
  for (const [id, reg] of Object.entries(aprovacoes)) {
    if (!objeto(reg)) continue;
    const peca = pecas.find((p) => objeto(p) && p.id === id);
    const postId = typeof reg.postId === 'string' && reg.postId ? reg.postId : (peca && typeof peca.postId === 'string' ? peca.postId : null);
    if (postId) aprovados.add(postId);
  }
  return posts.filter(objeto).map((p, ordem) => ({
    data: partesData(p.date),
    rede: texto(p.platformLabel) || PLATAFORMAS[p.platform] || texto(p.platform) || 'Rede a definir',
    titulo: texto(p.title) || 'Post sem título',
    legenda: typeof p.caption === 'string' ? p.caption.trim() : '',
    aprovado: typeof p.id === 'string' && aprovados.has(p.id),
    ordem,
  })).sort((a, b) => {
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
    '.capa > div, main, footer { max-width: 760px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }',
    '.sobretitulo { margin: 0 0 10px; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--acento); }',
    'h1 { margin: 0; font: 600 clamp(30px, 6vw, 44px)/1.08 var(--letra-titulo); letter-spacing: -0.01em; overflow-wrap: anywhere; }',
    '.resumo { margin: 14px 0 0; opacity: 0.8; font-size: 15px; }',
    'main { padding-top: 12px; padding-bottom: 8px; }',
    '.mes { margin-top: 32px; }',
    '.mes h2 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 0 6px; padding-bottom: 10px;',
    '  border-bottom: 2px solid var(--escuro); font: 600 24px/1.2 var(--letra-titulo); }',
    '.mes h2 span { font: 500 14px/1 var(--letra-texto); color: var(--texto-2); }',
    '.posts { list-style: none; margin: 0; padding: 0; }',
    '.post { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 18px; padding: 20px 0; border-bottom: 1px solid var(--linha); break-inside: avoid; }',
    '.dia { text-align: center; padding-top: 2px; }',
    '.dia b { display: block; font: 600 32px/1 var(--letra-titulo); }',
    '.dia span { display: block; margin-top: 4px; font-size: 13px; color: var(--texto-2); text-transform: capitalize; }',
    '.dia.sem-data b { font-size: 20px; }',
    '.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 13px; }',
    '.rede { font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--escuro); }',
    '.estado { padding: 2px 10px; border-radius: 999px; border: 1px solid var(--linha); color: var(--texto-2); font-weight: 600; }',
    '.estado.aprovado { background: var(--acento); border-color: var(--acento); color: var(--sobre-acento); }',
    '.post h3 { margin: 0; font: 600 20px/1.3 var(--letra-titulo); overflow-wrap: anywhere; }',
    '.legenda { margin: 10px 0 0; padding: 12px 14px; border-radius: 10px; background: var(--fundo-2); overflow-wrap: anywhere; }',
    'footer { padding-top: 24px; padding-bottom: 48px; font-size: 14px; color: var(--texto-2); }',
    'footer p { margin: 0 0 6px; }',
    '@media (max-width: 480px) { .capa { padding: 36px 0 30px; } .capa > div, main, footer { padding-left: 16px; padding-right: 16px; }',
    '  .post { grid-template-columns: 48px minmax(0, 1fr); gap: 12px; } .dia b { font-size: 26px; } }',
    '@media print { .capa { padding: 28px 0; } .mes { break-inside: auto; } }',
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

  // Um grupo por mês; posts sem data no fim.
  const grupos = [];
  for (const p of posts) {
    const chave = p.data ? p.data.ano + '-' + p.data.mes : 'sem-data';
    let g = grupos.find((x) => x.chave === chave);
    if (!g) { g = { chave, titulo: p.data ? nomeDoMes(p.data) : 'Data a definir', posts: [] }; grupos.push(g); }
    g.posts.push(p);
  }
  for (const g of grupos) {
    linha('<section class="mes">');
    linha(`<h2>${escapar(g.titulo)} <span>${g.posts.length === 1 ? '1 post' : g.posts.length + ' posts'}</span></h2>`);
    linha('<ol class="posts">');
    for (const p of g.posts) {
      const quem = { tipo: 'post', post: p };
      const dia = p.data
        ? `<div class="dia"><b>${Number(p.data.dia)}</b><span>${escapar(diaDaSemana(p.data))}</span></div>`
        : '<div class="dia sem-data"><b>—</b><span>a definir</span></div>';
      const legenda = p.legenda ? `<p class="legenda">${p.legenda.split(/\r?\n/).map(escapar).join('<br>')}</p>` : '';
      linha(`<li class="post">${dia}<div><p class="meta"><span class="rede">${escapar(p.rede)}</span>`
        + `<span class="estado${p.aprovado ? ' aprovado' : ''}">${p.aprovado ? 'Arte aprovada' : 'Em produção'}</span></p>`
        + `<h3>${escapar(p.titulo)}</h3>${legenda}</div></li>`, quem);
      paraConferir(p.rede, quem);
      paraConferir(p.titulo, quem);
      paraConferir(p.legenda, quem);
    }
    linha('</ol>');
    linha('</section>');
  }
  linha('</main>');
  linha('<footer>');
  linha('<p><b>Arte aprovada:</b> a arte do post já está pronta. <b>Em produção:</b> a arte ainda está sendo feita.</p>');
  linha('<p>Datas e textos podem mudar até a publicação.</p>');
  linha('</footer>');
  linha('</body>');
  linha('</html>');
  return { html: html.join('\n') + '\n', quemHtml, conferencia: conferencia.join('\n') + '\n', quemTexto };
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
    posts = prepararPosts(brutos, pecas, aprovacoes);
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
    // Liberado: copia para a pasta de envios da empresa sem nunca sobrescrever (mesmo dia: -2, -3...).
    const pasta = empresaMod.caminhos(codigo, r).envios;
    fs.mkdirSync(pasta, { recursive: true });
    const prefixo = `cronograma-${codigo}-${hoje}`;
    for (let n = 1; n < 1000; n++) {
      const destino = path.join(pasta, n === 1 ? prefixo + '.html' : `${prefixo}-${n}.html`);
      try {
        fs.copyFileSync(path.join(tmp, ARQ_HTML), destino, fs.constants.COPYFILE_EXCL);
      } catch (e) {
        if (e.code === 'EEXIST') continue;
        throw e;
      }
      const endereco = '/' + path.relative(r, destino).split(path.sep).map(encodeURIComponent).join('/');
      return { ok: true, empresa: codigo, arquivo: destino, endereco, posts: posts.length };
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
