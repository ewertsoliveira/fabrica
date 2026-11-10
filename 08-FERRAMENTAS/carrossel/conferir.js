#!/usr/bin/env node
// Conferidor do carrossel. Reprova o que as regras do Núcleo deixam para conferência automática:
//   copy      C-02 C-09 C-10 C-11 C-18 C-19 C-22 A-05 A-09 (sobre o conteúdo das lâminas e a legenda)
//   peça      DG-01 M-04 DG-04 DG-08 DG-09/I-15 M-02 DG-10 DG-15 DG-16 I-13 I-14 F-26 a F-29 F-53 T-12 T-13,
//             contraste AA e texto fora do canvas (medidos no navegador, na peça renderizada de verdade)
// Cada checagem é calibrada contra um caso feito para falhar em conferir.test.js (G-13).
// Uso: node 08-FERRAMENTAS/carrossel/conferir.js <conteudo.json> [--estilo id] [--cores marca|sugestao] [--formato carrossel|fixados|reels]
'use strict';
const fs = require('fs');
const path = require('path');
const marca = require(path.join(__dirname, '..', 'marca', 'marca'));
const molde = require('./molde');
const { abrirPagina } = require('./render');

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const limpa = (s) => String(s).replace(/\*\*?/g, '');
const trecho = (s, n = 60) => { const t = limpa(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

// ---------------------------------------------------------------- configuração vinda do marca.yaml
function cfgDaMarca() {
  const feed = marca.pega('canvas.feed', { largura: 1080, altura: 1350 });
  return {
    exclamacao: marca.pega('copy.exclamacao', 'vetada'),
    vetados: marca.pega('vocabulario.vetado', []) || [],
    emoji: marca.pega('copy.emoji', { formatos: ['stories'], maximo: 2 }),
    pisos: marca.pega('canvas.pisos', { titulo: 72, corpo: 44, micro: 32 }),
    pisosUi: marca.pega('canvas.pisos-ui', { titulo: 40, corpo: 28 }),
    seg: marca.pega('canvas.area-segura', { topo: 90, base: 140 }),
    canvas: feed,
    logoAparece: marca.pega('pecas.logo-aparece-em', ['capa', 'fecho']),
  };
}
// A mesma configuração com o canvas e a área segura do formato (post fixado 3:4, capa de Reels 9:16).
function cfgDoFormato(cfg, formato = 'carrossel') {
  const { canvas, seg } = molde.canvasDoFormato(formato, cfg.canvas, cfg.seg);
  return { ...cfg, canvas, seg, formato };
}
const achado = (regra, lamina, mensagem) => ({ regra, lamina, mensagem });

// ---------------------------------------------------------------- 1. copy (conteúdo das lâminas e legenda)
const FORA = new Set(['tipo', 'componente', 'modo', 'layout', 'fundo', 'posicao', 'posicao_foto', 'inclinar', 'marcadores', 'numeral', 'op', 'veu']);
function textosDe(obj, prefixo = '', saida = []) {
  if (obj === null || obj === undefined) return saida;
  if (typeof obj === 'string') {
    if (!/\.(png|jpe?g|webp|svg|gif)$/i.test(obj) && !/^(https?:|data:)/.test(obj)) saida.push({ campo: prefixo, texto: obj });
    return saida;
  }
  if (Array.isArray(obj)) { obj.forEach((x, i) => textosDe(x, `${prefixo}[${i}]`, saida)); return saida; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (FORA.has(k) || /^foto/.test(k) || k === 'retrato' || k === 'arquivo' || k === 'descricao' || k === 'alternativa') continue;
      if (k === 'nome' && obj.tipo) continue; // nome do desenho (adesivo), não texto
      textosDe(v, prefixo ? `${prefixo}.${k}` : k, saida);
    }
  }
  return saida;
}

const A05 = [/a parte que ninguem ve/, /mas a verdade e que/, /e e ai que esta o problema/, /pare de .{1,40} e comece a /, /nao e sobre .{1,40}[.:;] e sobre /];
const A09 = ['potencializar', 'jornada do cliente', 'ecossistema', 'sinergia'];
const WEB = ['clique no link', 'clique aqui', 'clica no link', 'toque no link', 'acesse o site', 'acesse o link', 'visite o site', 'saiba mais'];
// Pedidos feitos ao leitor, por tipo de ação (C-18: uma chamada só).
const CHAMADAS = {
  comentar: /\b(comente|comenta|comentem|me conte|me conta|responda|responde)\b/,
  salvar: /\b(salve|salva|salvem|guarde|guarda)\b/,
  compartilhar: /\b(compartilhe|compartilha|encaminhe|marque|marca)\b/,
  seguir: /\b(siga|segue|seguir)\b/,
  curtir: /\b(curta|curte|curtir)\b/,
  direct: /\b(mande|manda|envie|chame|chama|fale com)\b/,
  link: /\b(clique|acesse)\b/,
};
const frases = (s) => limpa(s).split(/[.!?…]+(?:\s|$)/).map((x) => x.trim()).filter(Boolean);
const assinatura = (v) => (v ? `${v.tipo || ''}:${v.componente || v.nome || ''}` : '');

function conferirConteudo({ estilo, conteudos, legenda = '', cfg = cfgDaMarca(), formato = cfg.formato || 'carrossel' }) {
  const out = [];
  const car = estilo.car;
  if (formato === 'fixados' && conteudos.length !== 3) out.push(achado('ESTILO', 0, `os fixados são 3 (apresentação, método, contratar) e o conteúdo tem ${conteudos.length}`));
  if (formato === 'carrossel' && (conteudos.length < car.laminas.min || conteudos.length > car.laminas.max)) {
    out.push(achado('ESTILO', 0, `o estilo ${estilo.id} pede de ${car.laminas.min} a ${car.laminas.max} lâminas e o conteúdo tem ${conteudos.length}`));
  }
  const todos = [];
  conteudos.forEach((c, i) => { for (const t of textosDe({ ...c, visual: c.visual }, '')) todos.push({ ...t, lamina: i + 1, slide: true }); });
  if (legenda) todos.push({ campo: 'legenda', texto: legenda, lamina: 0, slide: false });
  const vetados = (cfg.vetados || []).map(norm).filter(Boolean);
  const emojiOk = (cfg.emoji?.formatos || []).includes('carrossel');
  for (const t of todos) {
    const n = norm(limpa(t.texto));
    if (cfg.exclamacao === 'vetada' && /!/.test(t.texto)) out.push(achado('C-09', t.lamina, `ponto de exclamação em "${trecho(t.texto)}" (${t.campo}); a marca veta exclamação`));
    if (/[—–]/.test(t.texto)) out.push(achado('C-10', t.lamina, `travessão em "${trecho(t.texto)}" (${t.campo}); troque por vírgula, ponto ou dois-pontos`));
    for (const v of vetados) if (new RegExp(`(^|[^a-z0-9])${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(n)) out.push(achado('C-02', t.lamina, `termo vetado "${v}" em "${trecho(t.texto)}" (${t.campo}); rejeição automática`));
    if (t.slide && !emojiOk && /\p{Extended_Pictographic}/u.test(t.texto)) out.push(achado('C-11', t.lamina, `emoji em "${trecho(t.texto)}" (${t.campo}); carrossel não usa emoji`));
    if (A05.some((r) => r.test(n))) out.push(achado('A-05', t.lamina, `abertura de fórmula de guru em "${trecho(t.texto)}"`));
    for (const w of A09) if (n.includes(w)) out.push(achado('A-09', t.lamina, `"${w}" é palavra corporativa; use a simples (${trecho(t.texto)})`));
    if (t.slide) for (const w of WEB) if (n.includes(w)) out.push(achado('C-19', t.lamina, `chamada de intenção web "${w}" num carrossel, que não clica`));
  }
  conteudos.forEach((c, i) => {
    const lam = i + 1;
    if (typeof c.corpo === 'string') {
      const len = limpa(c.corpo).length;
      const nf = frases(c.corpo).length;
      if (len < 80 || len > 130) out.push(achado('C-22', lam, `corpo com ${len} caracteres (faixa de 80 a 130): "${trecho(c.corpo)}"`));
      if (nf > 2) out.push(achado('C-22', lam, `corpo com ${nf} frases (no máximo duas): "${trecho(c.corpo)}"`));
    }
    if (typeof c.subtitulo === 'string' && limpa(c.subtitulo).length > 130) out.push(achado('C-22', lam, `subtítulo com ${limpa(c.subtitulo).length} caracteres (passa de 130): "${trecho(c.subtitulo)}"`));
    if (i > 0) {
      const ant = assinatura(conteudos[i - 1].visual);
      const atual = assinatura(c.visual);
      if (atual && atual === ant) out.push(achado('DG-10', lam, `o mesmo elemento visual (${atual}) aparece em duas lâminas seguidas`));
    }
  });
  // C-18: uma chamada só, no último slide e na legenda.
  const ultimo = conteudos.length ? textosDe(conteudos[conteudos.length - 1]).map((t) => t.texto).join(' . ') : '';
  for (const [onde, texto, lam] of [['último slide', ultimo, conteudos.length], ['legenda', legenda, 0]]) {
    if (!texto) continue;
    const n = norm(limpa(texto));
    const tipos = Object.entries(CHAMADAS).filter(([, r]) => r.test(n)).map(([k]) => k);
    if (tipos.length > 1) out.push(achado('C-18', lam, `mais de uma chamada no ${onde} (${tipos.join(' + ')}); deixe um destino e uma ação`));
  }
  return out;
}

// ---------------------------------------------------------------- 2. medição no navegador
// Roda dentro da página: devolve um registro por lâmina, com o texto, o tamanho calculado, a caixa e a cor de cada trecho.
function medirNaPagina(opcoes) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lams = [...document.querySelectorAll('.lamina')];
  return lams.map((lam, indice) => {
    if (opcoes.apenas && !opcoes.apenas.includes(indice)) return { indice, ignorada: true };
    lam.scrollIntoView({ block: 'start', inline: 'start' }); // elementFromPoint só enxerga o que está na janela
    const L = lam.getBoundingClientRect();
    const textos = [];
    const dst = [];
    const vistos = new Set();
    const walker = document.createTreeWalker(lam, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('style,script')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      let opac = 1; for (let a = el; a && a !== lam.parentElement; a = a.parentElement) opac *= parseFloat(getComputedStyle(a).opacity);
      const naMarca = !!el.closest('.mk');
      const role = naMarca ? 'ui' : el.closest('.titulo,.frase') ? 'titulo' : el.closest('.corpo') ? 'corpo' : 'micro';
      const decorativo = !!el.closest('[aria-hidden="true"]');
      const vital = !naMarca && !decorativo && !el.closest('.conta,.nav-barra,.nav-arraste,.nav-contador,.logo-marca,.selo,[data-nao-vital]');
      let cobertoPor = ''; let cobertos = 0; // DG-23: o que está por cima de cinco pontos do texto
      for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
        const px = r.left + r.width * fx; const py = r.top + r.height * fy;
        if (px < 0 || py < 0 || px > innerWidth || py > innerHeight) continue;
        const topo = document.elementFromPoint(px, py);
        if (topo && !el.contains(topo) && !topo.contains(el)) { cobertos++; cobertoPor = String(topo.className || topo.tagName).split(' ')[0]; }
      }
      const cont = el.closest('.vis-mockup'); const C = cont ? cont.getBoundingClientRect() : null;
      const cortado = !!C && r.top < C.bottom - 1 && r.bottom > C.bottom + 1; // meio texto escondido pela borda do mockup
      // as caixas de cada linha: o contraste se mede nelas, não na caixa que soma as linhas (que pega o fundo ao lado)
      const linhas = [...rg.getClientRects()].filter((q) => q.width && q.height).map((q) => ({ x: q.left - L.left, y: q.top - L.top, w: q.width, h: q.height }));
      textos.push({ texto: n.textContent.trim(), cobertoPor: cobertos >= 3 ? cobertoPor : '', cortado, role, fs: parseFloat(cs.fontSize), peso: cs.fontWeight, x: r.left - L.left, y: r.top - L.top, w: r.width, h: r.height, linhas, cor: rgba(cs.color), opac, vital, naMarca, decorativo });
      if (el.classList.contains('dst') && !vistos.has(el)) {
        vistos.add(el);
        const pai = getComputedStyle(el.parentElement);
        dst.push({ texto: el.textContent.trim(), fs: parseFloat(cs.fontSize), fsPai: parseFloat(pai.fontSize), peso: cs.fontWeight, pesoPai: pai.fontWeight });
      }
    }
    const visuais = lam.querySelectorAll('.vis,.vis-objeto,.adesivo,.cv img,.mk,.pol img').length;
    const vazios = [...lam.querySelectorAll('.vis,.vis-objeto,.ob,.adesivo')].filter((e) => !e.querySelector('img,svg,canvas,.mk,[class*="vis"]') && !e.textContent.trim()).map((e) => e.className);
    const imgsQuebradas = [...lam.querySelectorAll('img')].filter((i) => !i.complete || i.naturalWidth === 0).length;
    const caixaCinza = [...lam.querySelectorAll('*')].filter((e) => {
      if (e.children.length || e.textContent.trim() || /^(IMG|SVG|PATH|CIRCLE|RECT|G)$/i.test(e.tagName)) return false;
      const c = getComputedStyle(e); const b = e.getBoundingClientRect();
      if (b.width * b.height < 60000 || c.backgroundImage !== 'none') return false;
      const m = c.backgroundColor.match(/[\d.]+/g); if (!m) return false;
      const [r, g, bl, al = 1] = m.map(Number); return al > 0.9 && Math.max(r, g, bl) - Math.min(r, g, bl) <= 6 && r > 120 && r < 240;
    }).map((e) => e.className || e.tagName);
    const placeholders = [...lam.querySelectorAll('[class*="placeholder"],[class*="imagem-aqui"],[class*="wireframe"]')].map((e) => e.className);
    const barra = lam.querySelector('.nav-barra');
    const mks = [...lam.querySelectorAll('.mk')].map((e) => e.outerHTML);
    return {
      indice, formato: lam.dataset.formato || 'carrossel', layout: lam.dataset.layout, fundo: lam.dataset.fundo, papel: lam.dataset.papel, ancora: lam.dataset.ancora, total: Number(lam.dataset.total) || null,
      textos, dst, visuais, vazios, imgsQuebradas, caixaCinza: [...caixaCinza, ...placeholders],
      cv: !!lam.querySelector('.cv'), veu: !!lam.querySelector('.vela,.veu'),
      nav: { barra: !!barra, arraste: !!lam.querySelector('.nav-arraste'), contador: !!lam.querySelector('.nav-contador'), barraLargura: barra ? (barra.querySelector('i').getBoundingClientRect().width / barra.getBoundingClientRect().width) : 0 },
      logos: lam.querySelectorAll('.logo-marca').length,
      logosCortadas: [...lam.querySelectorAll('.logo-marca')].filter((e) => { const b = e.getBoundingClientRect(); return b.left < L.left || b.top < L.top || b.right > L.right || b.bottom > L.bottom || e.naturalWidth === 0; }).length,
      mockupsDuplicados: mks.length - new Set(mks).size,
    };
  });
}

// ---------------------------------------------------------------- 3. checagens sobre a medição (uma função por regra)
const bloco = { titulo: 'título', corpo: 'corpo', micro: 'microtexto', ui: 'interface' };
function pisoDe(role, cfg) { return { titulo: cfg.pisos.titulo, corpo: cfg.pisos.corpo, micro: cfg.pisos.micro, ui: cfg.pisosUi.corpo }[role]; }

function checarPisos(reg, cfg) { // DG-01 e M-04
  const out = [];
  for (const t of reg.textos) {
    if (t.decorativo) continue;
    const piso = pisoDe(t.role, cfg);
    if (t.fs + 0.01 < piso) out.push(achado(t.role === 'ui' ? 'M-04' : 'DG-01', reg.indice + 1, `"${trecho(t.texto, 40)}" com ${t.fs}px, abaixo do piso de ${piso}px da escala de ${bloco[t.role]}`));
    if (t.role === 'ui' && t.fs > cfg.pisos.corpo + 0.01) out.push(achado('M-04', reg.indice + 1, `"${trecho(t.texto, 40)}" dentro do mockup com ${t.fs}px, acima do corpo da peça (${cfg.pisos.corpo}px)`));
  }
  return out;
}
// Tratamentos de destaque que o estilo declara (`cor+fonte` vira ['cor', 'fonte']).
const tratamentosDoDestaque = (estilo) => String(estilo?.dados?.tratamentos?.destaque || '').split(/[+,\s]+/).filter(Boolean);
function checarDestaque(reg, tratamentos = []) { // DG-04; com `fonte` ou `peso` declarado, só o tamanho é conferido
  const pesoLivre = tratamentos.includes('fonte') || tratamentos.includes('peso');
  return reg.dst.filter((d) => Math.abs(d.fs - d.fsPai) > 0.5 || (!pesoLivre && d.peso !== d.pesoPai))
    .map((d) => achado('DG-04', reg.indice + 1, `o destaque "${trecho(d.texto, 30)}" tem ${d.fs}px/peso ${d.peso} e a frase tem ${d.fsPai}px/peso ${d.pesoPai}; a ênfase não muda ${pesoLivre ? 'o tamanho' : 'tamanho nem peso'}`));
}
function checarAreaSegura(reg, cfg) { // DG-08
  const topo = cfg.seg.topo; const base = cfg.canvas.altura - cfg.seg.base;
  return reg.textos.filter((t) => t.vital && (t.y < topo - 0.5 || t.y + t.h > base + 0.5))
    .map((t) => achado('DG-08', reg.indice + 1, `"${trecho(t.texto, 40)}" ocupa ${Math.round(t.y)} a ${Math.round(t.y + t.h)}px, dentro da faixa reservada (livre de ${topo} a ${base}px)`));
}
function checarCobertura(reg) { // DG-23
  return reg.textos.filter((t) => t.cobertoPor && !t.decorativo)
    .map((t) => achado('DG-23', reg.indice + 1, `"${trecho(t.texto, 40)}" fica coberto por outro elemento (${t.cobertoPor}); o texto nunca é o que perde o espaço`));
}
function checarMockupCortado(reg) { // M-03: texto de interface pela metade não é interface real
  return reg.textos.filter((t) => t.cortado).map((t) => achado('M-03', reg.indice + 1, `"${trecho(t.texto, 40)}" fica cortado pela metade na borda do mockup; use um mockup menor ou menos itens`));
}
function checarForaDoCanvas(reg, cfg) { // DG-02: texto que não coube vaza
  return reg.textos.filter((t) => !t.naMarca && !t.decorativo && (t.x < -4 || t.y < -4 || t.x + t.w > cfg.canvas.largura + 4 || t.y + t.h > cfg.canvas.altura + 4))
    .map((t) => achado('DG-02', reg.indice + 1, `"${trecho(t.texto, 40)}" passa da borda da lâmina; o texto não coube e a fonte não pode encolher`));
}
// C-21: o layout é escolhido pela posição no rodízio. Se o conteúdo tem um campo que esse layout não desenha, o texto da
// copy some da lâmina sem aviso. Todo campo de texto do conteúdo precisa aparecer na lâmina renderizada.
const plano = (s) => norm(limpa(s)).replace(/\s+/g, ''); // sem espaços: o título pode quebrar com <br> ou vir em partes
function checarTextoPerdido(reg, conteudo) {
  if (!conteudo) return [];
  const na = plano(reg.textos.map((t) => t.texto).join(''));
  const esperados = [];
  for (const k of ['kicker', 'titulo', 'subtitulo', 'corpo', 'nota', 'botao']) if (conteudo[k]) esperados.push([k, conteudo[k]]);
  for (const it of conteudo.itens || []) for (const k of ['titulo', 'texto']) if (it[k]) esperados.push(['itens', it[k]]);
  return esperados.filter(([, t]) => !na.includes(plano(t)))
    .map(([k, t]) => achado('C-21', reg.indice + 1, `o texto "${trecho(t, 40)}" (${k}) da copy não aparece na lâmina: o layout "${reg.layout}" não tem lugar para esse campo. Troque o layout (campo \`layout\` da lâmina) ou o campo`));
}
function checarVisual(reg) { // DG-09, I-15, M-02 (D4)
  const out = [];
  const n = reg.indice + 1;
  if (!reg.visuais && reg.ancora !== 'propria') out.push(achado('DG-09', n, 'lâmina sem elemento visual ligado ao texto (mockup, foto ou objeto desenhado)'));
  if (reg.vazios.length) out.push(achado('M-02', n, `caixa vazia no lugar do elemento visual (${reg.vazios.join(', ')})`));
  if (reg.caixaCinza.length) out.push(achado('M-02', n, `caixa cinza chapada ou "imagem aqui" no lugar do elemento visual (${reg.caixaCinza.join(', ')})`));
  if (reg.imgsQuebradas) out.push(achado('I-15', n, `${reg.imgsQuebradas} imagem(ns) sem arquivo ou que não carregou`));
  return out;
}
// DG-09: lista, fórmula, fluxo, grade e citação só têm diagrama ou número, sem mockup, foto nem objeto desenhado. Uma lâmina
// assim no miolo é aceita (o ritmo pede); da segunda em diante o carrossel está se tornando template tipográfico.
function checarSoTipografica(regs) {
  return regs.filter((r) => r.papel === 'miolo' && !r.visuais).slice(1)
    .map((r) => achado('DG-09', r.indice + 1, `lâmina só tipográfica (layout "${r.layout}"): o miolo admite uma; as outras levam mockup, foto ou objeto desenhado ligado ao texto`));
}
function checarSequencia(regs, estilo) { // DG-10 e DG-15, só sobre o que o estilo declara
  const out = [];
  const car = estilo.car;
  const miolo = regs.filter((r) => r.papel === 'miolo');
  if (car.molde_do_miolo === 'fixo') {
    const distintos = [...new Set(miolo.map((r) => r.layout))];
    if (distintos.length > 1) out.push(achado('DG-10', 0, `o estilo declara miolo fixo, mas o miolo usa ${distintos.length} layouts (${distintos.join(', ')})`));
  } else {
    for (let i = 1; i < regs.length; i++) {
      if (regs[i].papel === 'miolo' && regs[i - 1].papel === 'miolo' && regs[i].layout === regs[i - 1].layout) out.push(achado('DG-10', regs[i].indice + 1, `o layout "${regs[i].layout}" repete o da lâmina anterior; no rodízio, dois seguidos nunca repetem`));
    }
  }
  const usados = [...new Set(regs.map((r) => r.fundo))];
  for (const r of regs) if (!car.fundos.includes(r.fundo)) out.push(achado('DG-15', r.indice + 1, `fundo "${r.fundo}" fora da sequência declarada pelo estilo (${car.fundos.join(', ')})`));
  if (car.fundos.length > 1 && regs.length > 1 && usados.length < 2) out.push(achado('DG-15', 0, `o estilo declara fundos alternados (${car.fundos.join(', ')}) e a peça inteira usa só "${usados[0]}"`));
  return out;
}
function checarNavegacao(regs, estilo) { // F-26 a F-29 e F-53, só se o estilo declarar
  const nav = estilo.car.navegacao; const out = [];
  regs.forEach((r, i) => {
    const ultimo = i === regs.length - 1; const n = r.indice + 1;
    if (nav.barra !== r.nav.barra) out.push(achado('F-26', n, nav.barra ? 'falta a barra de progresso que o estilo declara' : 'barra de progresso que o estilo não declara'));
    if (nav.contador !== r.nav.contador) out.push(achado('F-53', n, nav.contador ? 'falta o contador de posição que o estilo declara' : 'contador de posição que o estilo não declara'));
    if (nav.arraste && !ultimo && !r.nav.arraste) out.push(achado('F-27', n, 'falta o indicador de arraste'));
    if (!nav.arraste && r.nav.arraste) out.push(achado('F-27', n, 'indicador de arraste que o estilo não declara'));
    if (ultimo && r.nav.arraste) out.push(achado('F-29', n, 'o último slide não leva indicador de arraste'));
    if (ultimo && nav.barra && r.nav.barra && r.nav.barraLargura < 0.995) out.push(achado('F-29', n, `no último slide a barra deve estar em 100% (está em ${Math.round(r.nav.barraLargura * 100)}%)`));
  });
  return out;
}
function checarFotoLogoEstrutura(regs, cfg, esperadas, naPagina = regs.length) { // I-13, I-14, DG-16, T-12, T-13
  const out = [];
  if (naPagina !== esperadas) out.push(achado('T-12', 0, `a página tem ${naPagina} lâminas e o conteúdo tem ${esperadas}`));
  for (const r of regs) {
    const n = r.indice + 1;
    if (r.total && r.total !== naPagina) out.push(achado('T-12', n, `a lâmina declara ${r.total} no total, mas a peça tem ${naPagina}`));
    // o post fixado é peça isolada: foto em tela cheia vale em qualquer um dos três, sempre com véu
    const isolado = r.papel === 'capa' || r.formato === 'fixados';
    if (r.cv && !isolado) out.push(achado('I-13', n, 'foto em tela cheia fora da capa; nos slides internos o fundo é o da marca'));
    if (r.cv && isolado && !r.veu) out.push(achado('I-14', n, 'capa com foto de fundo sem véu de gradiente para proteger o texto'));
    if (r.logos && !cfg.logoAparece.includes(r.papel)) out.push(achado('DG-16', n, `logo na lâmina de papel "${r.papel}"; só aparece em ${cfg.logoAparece.join(' e ')}`));
    if (r.logos > 1) out.push(achado('DG-16', n, `${r.logos} logos na mesma lâmina`));
    if (r.logosCortadas) out.push(achado('DG-16', n, 'logo cortada ou que não carregou; ela vem sempre completa'));
    if (r.mockupsDuplicados) out.push(achado('T-13', n, `${r.mockupsDuplicados} mockup(s) duplicado(s) na lâmina`));
  }
  return out;
}

// ---------------------------------------------------------------- 4. contraste AA, medido nos pixels da peça renderizada
const lumRgb = ([r, g, b]) => [r, g, b].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const razao = (a, b) => { const [x, y] = [a, b].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
async function checarContraste(pagina, regs, cfg) {
  let PNG;
  try { ({ PNG } = require('pngjs')); } catch { return { achados: [], aviso: 'contraste não conferido: pngjs não está instalado (npm install)' }; }
  await pagina.addStyleTag({ content: '.lamina *{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important}' });
  const lams = await pagina.$$('.lamina');
  const out = [];
  for (const reg of regs) {
    const img = PNG.sync.read(await lams[reg.indice].screenshot({ type: 'png', animations: 'disabled' }));
    for (const t of reg.textos) {
      if (t.decorativo) continue;
      const lums = []; const soma = [0, 0, 0]; let q = 0;
      for (const c of (t.linhas && t.linhas.length ? t.linhas : [t])) {
        const x0 = Math.max(0, Math.floor(c.x)); const y0 = Math.max(0, Math.floor(c.y));
        const x1 = Math.min(img.width, Math.ceil(c.x + c.w)); const y1 = Math.min(img.height, Math.ceil(c.y + c.h));
        for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) {
          const i = (y * img.width + x) * 4; const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
          lums.push(lumRgb(px)); soma[0] += px[0]; soma[1] += px[1]; soma[2] += px[2]; q++;
        }
      }
      if (!q) continue;
      lums.sort((a, b) => a - b);
      const media = soma.map((s) => s / q);
      const a = t.cor[3] * t.opac;
      const fg = [0, 1, 2].map((k) => a * t.cor[k] + (1 - a) * media[k]);
      const lf = lumRgb(fg);
      const pior = Math.min(...[0.25, 0.5, 0.75].map((p) => razao(lf, lums[Math.min(lums.length - 1, Math.floor(p * lums.length))])));
      const minimo = t.fs >= 24 ? 3 : 4.5; // AA: 3:1 para texto grande (24px ou mais), 4,5:1 para o resto
      if (pior < minimo) out.push(achado('AA', reg.indice + 1, `"${trecho(t.texto, 40)}" com contraste ${pior.toFixed(2)}:1 sobre o fundo (mínimo AA ${minimo}:1)`));
    }
  }
  return { achados: out, aviso: null };
}

// ---------------------------------------------------------------- 5. conferência completa
async function conferirRender({ estilo, conteudos, html, cfg = cfgDaMarca(), apenas, formato = cfg.formato || 'carrossel' }) {
  // estilo próprio de empresa (escrito a partir de referências de fora): a página é aberta com a rede fechada, como no render
  const { pagina, fechar } = await abrirPagina(html, cfg.canvas, { bloquearRede: !!(estilo && estilo.proprio) });
  const out = [];
  let aviso = null;
  try {
    const todos = await pagina.evaluate(medirNaPagina, { apenas: apenas || null });
    const regs = todos.filter((r) => !r.ignorada);
    out.push(...checarFotoLogoEstrutura(regs, cfg, conteudos.length, todos.length));
    for (const r of regs) out.push(...checarPisos(r, cfg), ...checarDestaque(r, tratamentosDoDestaque(estilo)),...checarAreaSegura(r, cfg), ...checarMockupCortado(r), ...checarCobertura(r), ...checarForaDoCanvas(r, cfg), ...checarVisual(r), ...checarTextoPerdido(r, conteudos[r.indice]));
    // sequência de layouts e fundos, respiro só tipográfico e navegação são regras do carrossel (várias lâminas seguidas)
    if (!apenas && formato === 'carrossel') { out.push(...checarSequencia(regs, estilo), ...checarSoTipografica(regs), ...checarNavegacao(regs, estilo)); }
    const c = await checarContraste(pagina, regs, cfg);
    out.push(...c.achados); aviso = c.aviso;
  } finally { await fechar(); }
  return { achados: out, aviso };
}

async function conferir({ estilo, conteudos, legenda = '', html, cfg = cfgDaMarca(), apenas, formato = cfg.formato || 'carrossel' }) {
  const copy = conferirConteudo({ estilo, conteudos, legenda, cfg, formato });
  const render = await conferirRender({ estilo, conteudos, html, cfg, apenas, formato });
  const filtra = (l) => (apenas ? l.filter((a) => a.lamina === 0 || apenas.includes(a.lamina - 1)) : l);
  return { achados: [...filtra(copy), ...render.achados], aviso: render.aviso };
}

function relatorio(achados, aviso) {
  if (!achados.length) return `APROVADO pelo conferidor automático.${aviso ? `\nAviso: ${aviso}` : ''}`;
  const por = new Map();
  for (const a of achados) { const k = `${a.regra}|${a.lamina}`; if (!por.has(k)) por.set(k, []); por.get(k).push(a.mensagem); }
  const linhas = [`REPROVADO: ${achados.length} achado(s).`];
  for (const [k, msgs] of [...por].sort((a, b) => a[0].localeCompare(b[0], 'pt', { numeric: true }))) {
    const [regra, lam] = k.split('|');
    for (const m of msgs) linhas.push(`  ✗ ${regra} · ${Number(lam) ? `lâmina ${lam}` : 'peça'} · ${m}`);
  }
  if (aviso) linhas.push(`Aviso: ${aviso}`);
  return linhas.join('\n');
}

module.exports = { conferir, conferirConteudo, conferirRender, relatorio, cfgDaMarca, cfgDoFormato, textosDe, medirNaPagina, checarPisos, checarDestaque, checarAreaSegura, checarMockupCortado, checarCobertura, checarForaDoCanvas, checarVisual, checarTextoPerdido, checarSoTipografica, checarSequencia, checarNavegacao, checarFotoLogoEstrutura, checarContraste };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const val = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
    const arq = args.find((a) => !a.startsWith('--') && a !== val('--estilo') && a !== val('--cores') && a !== val('--formato'));
    if (!arq) { console.error('uso: node conferir.js <conteudo.json> [--estilo id] [--cores marca|sugestao] [--formato carrossel|fixados|reels]'); process.exit(2); }
    const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
    const conteudos = Array.isArray(j) ? j : j.laminas;
    const estilo = molde.lerEstilo(val('--estilo') || j.estilo);
    const formato = val('--formato') || j.formato || 'carrossel';
    const opcoes = { cores: val('--cores') || 'marca', embutir: true, formato };
    const html = molde.pagina(estilo, conteudos, opcoes);
    const r = await conferir({ estilo, conteudos, legenda: j.legenda || '', html, cfg: cfgDoFormato(cfgDaMarca(), formato) });
    console.log(relatorio(r.achados, r.aviso));
    process.exit(r.achados.length ? 1 : 0);
  })().catch((e) => { console.error(e.message); process.exit(2); });
}
