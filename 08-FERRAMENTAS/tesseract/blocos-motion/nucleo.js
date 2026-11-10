// Núcleo da biblioteca de blocos de motion (Tesseract 0.3.1), Fábrica de Conteúdo.
// Mesmas funções rect/texto/forma/kf/janelas, com as
// armadilhas do Tesseract tratadas aqui UMA vez, para que nenhum bloco precise lembrar delas:
//
//  1. Dois keyframes no mesmo track repetem o instante 0 e o lote inteiro é recusado -> kf() junta tudo por
//     (camada, propriedade), deduplica por instante (o último vence), força t >= 0 e emite UMA ação por track.
//  2. Texto centralizado na vertical sai ~0,38 do corpo acima do centro -> texto() compensa sozinho.
//  3. Formas ignoram alfa e opacidade fracionária -> forma() descarta o alfa da cor (o que o Tesseract faria de
//     qualquer jeito, então o visual se mantém) e oferece mistura() para pré-misturar à cor escura.
//  4. Retângulo criado por ação não aceita sombra -> nenhum bloco usa sombra em retângulo; o que precisa de sombra
//     (cartão final) usa a imagem pronta card-cta.png como camada de documento.
//  5. `motion` roda depois do montar-video.js e não é idempotente -> aplicar.js nomeia as camadas `<id>-papel`,
//     recusa aplicar duas vezes o mesmo id e oferece --refazer (remove as camadas daquele id antes).
//
// Coordenadas dos blocos: escritas na faixa padrão (topo em y 955). O núcleo desloca tudo em y pelo
// (faixa[0] - 955), então `--faixa y0,y1` move o bloco inteiro sem tocar no código dele.
'use strict';

// ---------- identidade: vem do contrato de marca (06-MARCA-E-FOTOS/marca.yaml), por papel ----------
const marca = require('../../marca/marca');
const ESCURO = marca.cor('escuro');
const CLARO = marca.cor('claro');
const ACENTO = marca.cor('acento');
const NEUTRO = marca.cor('neutro');
const CORES = { escuro: ESCURO, claro: CLARO, acento: ACENTO, neutro: NEUTRO };
// Fator de largura da fonte principal em relação à calibrada nos blocos (grotesca larga). Fonte mais larga: > 1.
// Entra nas estimativas de quebra e de encolhimento de texto (placa, esquema, mapa).
const FATOR_LARGURA = marca.pega('tipografia.principal.fator-largura', 1);
const alfa = (c, a) => [c[0], c[1], c[2], a];
const mistura = (c, a, fundo = ESCURO) => [0, 1, 2].map((i) => Number((fundo[i] + a * (c[i] - fundo[i])).toFixed(3))).concat(1);
// Papéis de fonte: o nome real da família é resolvido por montagem (Contexto.fontes), a partir do contrato de marca.
const PRINCIPAL = 'principal';
const MONO = 'mono';
const EASE = {
  saida: { type: 'cubicBezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 }, // chega rápido e assenta
  suave: { type: 'cubicBezier', x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  linear: { type: 'linear' },
  hold: { type: 'hold' },
};
const FAIXA_PADRAO = [955, 1305];
const PAINEL = { x: 90, y: 955, w: 900 };
const HL = { fonte: PRINCIPAL, estilo: 'Black', tracking: -50, wdth: true, just: 'left', vAlign: 'top' }; // headline
const K = 0.5523; // constante do arco de Bézier

// cor por papel ('acento'), hex ('#RRGGBB') ou [r,g,b,a] 0..1
function cor(c, padrao) {
  if (c === undefined || c === null) return padrao;
  if (Array.isArray(c)) return c.length === 3 ? [...c, 1] : c;
  if (typeof c === 'string') {
    const n = c.toLowerCase();
    if (CORES[n]) return CORES[n];
    const m = /^#?([0-9a-f]{6})$/i.exec(c);
    if (m) { const v = parseInt(m[1], 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255, 1].map((x, i) => (i < 3 ? Number(x.toFixed(4)) : x)); }
  }
  throw new Error(`cor inválida: ${JSON.stringify(c)} (use escuro, claro, acento, neutro, "#RRGGBB" ou [r,g,b,a])`);
}

// ---------- caminhos ----------
const retParcial = (x, y, w, h, r, esq, dir) => { // retângulo com cantos arredondados só à esquerda e/ou à direita
  const rl = esq ? r : 0, rr = dir ? r : 0;
  const c = [{ type: 'moveTo', x: x + rl, y }, { type: 'lineTo', x: x + w - rr, y }];
  if (rr) c.push({ type: 'cubicTo', c1x: x + w - rr + rr * K, c1y: y, c2x: x + w, c2y: y + rr - rr * K, x: x + w, y: y + rr });
  c.push({ type: 'lineTo', x: x + w, y: y + h - rr });
  if (rr) c.push({ type: 'cubicTo', c1x: x + w, c1y: y + h - rr + rr * K, c2x: x + w - rr + rr * K, c2y: y + h, x: x + w - rr, y: y + h });
  c.push({ type: 'lineTo', x: x + rl, y: y + h });
  if (rl) c.push({ type: 'cubicTo', c1x: x + rl - rl * K, c1y: y + h, c2x: x, c2y: y + h - rl + rl * K, x, y: y + h - rl });
  c.push({ type: 'lineTo', x, y: y + rl });
  if (rl) c.push({ type: 'cubicTo', c1x: x, c1y: y + rl - rl * K, c2x: x + rl - rl * K, c2y: y, x: x + rl, y });
  c.push({ type: 'close' });
  return c;
};
const retArredondado = (x, y, w, h, r) => retParcial(x, y, w, h, r, true, true);
const seta = (x, y, dir, t = 13) => { // ponta triangular
  const p = { dir: [[x, y], [x - t * 1.3, y - t], [x - t * 1.3, y + t]], esq: [[x, y], [x + t * 1.3, y - t], [x + t * 1.3, y + t]], baixo: [[x, y], [x - t, y - t * 1.3], [x + t, y - t * 1.3]] }[dir];
  return [{ type: 'moveTo', x: p[0][0], y: p[0][1] }, { type: 'lineTo', x: p[1][0], y: p[1][1] }, { type: 'lineTo', x: p[2][0], y: p[2][1] }, { type: 'close' }];
};
const elipse = (cx, cy, rx, ry) => [
  { type: 'moveTo', x: cx + rx, y: cy },
  { type: 'cubicTo', c1x: cx + rx, c1y: cy + ry * K, c2x: cx + rx * K, c2y: cy + ry, x: cx, y: cy + ry },
  { type: 'cubicTo', c1x: cx - rx * K, c1y: cy + ry, c2x: cx - rx, c2y: cy + ry * K, x: cx - rx, y: cy },
  { type: 'cubicTo', c1x: cx - rx, c1y: cy - ry * K, c2x: cx - rx * K, c2y: cy - ry, x: cx, y: cy - ry },
  { type: 'cubicTo', c1x: cx + rx * K, c1y: cy - ry, c2x: cx + rx, c2y: cy - ry * K, x: cx + rx, y: cy },
  { type: 'close' }];

// desloca y de todos os comandos de um caminho
const shiftCaminho = (cmds, dy) => (!dy ? cmds : cmds.map((c) => {
  const o = { ...c };
  for (const k of ['y', 'c1y', 'c2y']) if (typeof o[k] === 'number') o[k] += dy;
  return o;
}));

// ---------- contexto de construção (um por montagem; cada bloco usa o mesmo, com o seu prefixo) ----------
class Contexto {
  // fontes: { principal, mono } devolvidos por tesseract/fontes.js (importar); sem elas, nomes e estilos passam como estão
  constructor({ idBase = 3000, desloca = 0, faixa = FAIXA_PADRAO, comp = 'main', prefixoKf = 'mb', fontes = null } = {}) {
    this.comp = comp;
    this.fontes = fontes;
    this.prox = idBase;      // próximo id de camada
    this.desloca = desloca;  // segundos somados a todos os tempos
    this.faixa = faixa;
    this.dy = faixa[0] - FAIXA_PADRAO[0];
    this.prefixoKf = prefixoKf;
    this.kfn = 0;
    this.acoes = [];         // criações, na ordem (de trás para a frente)
    this.tracks = new Map(); // `${layerId}|${prop}` -> { layerId, prop, mapa: Map(tms -> [t, v, easing]) }
    this.camadas = [];       // { layerId, nome } do bloco corrente
    this.sons = [];
    this.documento = [];     // camadas de imagem (só entram pelo documento)
    this.bloco = '';
  }
  ms(s) { return Math.round((s + this.desloca) * 1000); }
  faixaMs(a, z) { const ini = Math.max(0, this.ms(a)); return { start: ini, duration: Math.max(1, this.ms(z) - ini) }; }
  y(v) { return v + this.dy; }
  nome(papel) { return this.bloco ? `${this.bloco}-${papel}` : papel; }
  novoId() { return this.prox++; }
  tf(pos, anchor = [0, 0], escala = 100, opac = 100) {
    return { anchorPoint: anchor, position: [pos[0], this.y(pos[1])], scale: [escala, escala], rotation: 0, opacity: opac };
  }

  // cada criação entra na frente (insertIndex 0): crie de trás para a frente
  rect(papel, a, z, pos, size, cor_, { raio = 0, traco, larguraTraco = 3, tracejado, anchor = [0, 0], opac = 100 } = {}) {
    const id = this.novoId(), nome = this.nome(papel);
    this.acoes.push({ type: 'createFxRectLayer', compositionId: this.comp, layerId: id, name: nome, insertIndex: 0, activeRange: this.faixaMs(a, z),
      transform: this.tf(pos, anchor, 100, opac),
      rect: { position: [0, 0], size, fillColor: cor_ || [0, 0, 0, 0], fillEnabled: !!cor_, roundness: raio,
        ...(traco ? { strokeEnabled: true, strokeColor: traco, strokeWidth: larguraTraco, ...(tracejado ? { strokeDashes: tracejado } : {}) } : {}) } });
    this.camadas.push({ layerId: id, nome });
    return { id, a, z, nome };
  }
  texto(papel, a, z, pos, size, txt, { fonte = PRINCIPAL, estilo = 'ExtraBold', tam = 34, cor: cor_ = CLARO, just = 'center', tracking = -10, caixaAlta = true,
    vAlign = 'center', opac = 100, anchor = [0, 0], wdth, pivo, semCompensacao = false, extra = {} } = {}) {
    const id = this.novoId(), nome = this.nome(papel);
    const fam = this.fontes && this.fontes[fonte === MONO ? 'mono' : 'principal'];
    // convenção 2: em caixa com verticalAlign center o Tesseract assenta as maiúsculas ~0,38 do corpo acima do centro
    // (valor configurável por fonte: tipografia.principal.compensacao-vertical)
    if (vAlign === 'center' && fonte !== MONO && !semCompensacao) pos = [pos[0], pos[1] + Math.round(tam * (fam ? fam.compensacao : 0.38))];
    // pivo: ponto do quadro em torno do qual a escala acontece (o texto continua no mesmo lugar)
    if (pivo) { anchor = [pivo[0] - pos[0], pivo[1] - pos[1]]; pos = pivo; }
    this.acoes.push({ type: 'createFxTextLayer', compositionId: this.comp, layerId: id, name: nome, insertIndex: 0, activeRange: this.faixaMs(a, z),
      transform: this.tf(pos, anchor, 100, opac),
      sourceText: { text: txt, fontFamily: fam ? fam.familia : fonte, fontStyle: fam ? fam.estilo(estilo) : estilo, fontSize: tam, fillColor: cor_, strokeWidth: 0, justification: just,
        tracking, allCaps: caixaAlta, boxText: true, boxPosition: [0, 0], boxSize: size, verticalAlign: vAlign,
        ...(wdth ? (fam ? fam.variacao(7000 + id, typeof wdth === 'number' ? wdth : undefined) : { fontVariations: { id: 7000 + id, axes: { wdth: typeof wdth === 'number' ? wdth : 100 } } }) : {}), ...extra } });
    this.camadas.push({ layerId: id, nome });
    return { id, a, z, nome };
  }
  // caminho em coordenadas do quadro; anchor/position iguais deixam o desenho no lugar e definem o pivô da escala
  forma(papel, a, z, comandos, { preenche, traco, largura = 5, tracejado, trim, pivo = [0, 0], opac = 100, opacPreenche = 100 } = {}) {
    const id = this.novoId(), nome = this.nome(papel);
    const opaca = (c) => [c[0], c[1], c[2], 1]; // convenção 3: forma ignora alfa; aqui fica explícito
    // o caminho fica em coordenadas da faixa padrão; a camada inteira desce dy (position = anchor + dy), então o pivô da escala acompanha
    const shape = { path: { commands: comandos }, fills: [], strokes: [] };
    if (preenche) shape.fills.push({ paint: { type: 'solid', color: opaca(preenche) }, opacity: opacPreenche, blendMode: 'normal', fillRule: 'nonZeroWinding' });
    if (traco) shape.strokes.push({ paint: { type: 'solid', color: opaca(traco) }, width: largura, cap: tracejado ? 'butt' : 'round', join: 'round', miterLimit: 4,
      blendMode: 'normal', opacity: 100, ...(tracejado ? { dashes: tracejado } : {}) });
    if (trim !== undefined) shape.trim = { start: 0, end: trim, offset: 0, mode: 'simultaneously' };
    this.acoes.push({ type: 'createFxShapeLayer', compositionId: this.comp, layerId: id, name: nome, insertIndex: 0, activeRange: this.faixaMs(a, z),
      transform: this.tf(pivo, pivo, 100, opac), shape });
    this.camadas.push({ layerId: id, nome });
    return { id, a, z, nome };
  }
  // camada de imagem: só entra pelo documento (project commit). aplicar.js importa o asset e grava a camada.
  imagem(papel, a, z, { asset, arquivo, pos, tamanho, escala = 100, opac = 100 }) {
    const id = this.novoId(), nome = this.nome(papel);
    this.documento.push({ id, nome, asset, arquivo, pos: [pos[0], this.y(pos[1])], tamanho, escala, opac, activeRange: this.faixaMs(a, z) });
    this.camadas.push({ layerId: id, nome });
    return { id, a, z, nome, documento: true };
  }

  // keyframes: [[segundoDoVideo, valor, easing?]]; layerTime relativo ao início da camada.
  // Convenção 1: um único track por (camada, propriedade); instantes repetidos viram um só (o último vence).
  kf(camada, prop, chaves) {
    const t0 = Math.max(0, this.ms(camada.a));
    const chave = `${camada.id}|${prop}`;
    if (!this.tracks.has(chave)) this.tracks.set(chave, { layerId: camada.id, prop, mapa: new Map() });
    const tr = this.tracks.get(chave);
    chaves.forEach(([s, v, e]) => {
      const t = Math.max(0, this.ms(s) - t0);
      if (prop === 'positionY' && typeof v === 'number') v += this.dy; // y absoluto acompanha a faixa
      tr.mapa.set(t, [t, v, e]);
    });
  }
  // preset de entrada/saída do Tesseract (animatorSetLayerFade): fade, pop, zoom, slideUp, softRise... ou 'none'
  preset(camada, entrada, saida = 'none') {
    this.acoes.push({ type: 'animatorSetLayerFade', compositionId: this.comp, layerId: camada.id, fadeInType: entrada, fadeOutType: saida });
  }
  escala(c, chaves) { this.kf(c, 'scaleX', chaves); this.kf(c, 'scaleY', chaves); }
  // liga/desliga a opacidade em janelas: [[liga, desliga?], ...] com rampa curta
  janelas(c, lista, rampa = 0.22) {
    const ch = [[c.a, 0, EASE.hold]];
    lista.forEach(([on, off]) => {
      ch.push([on, 0, EASE.hold], [on + rampa, 100, EASE.saida]);
      if (off !== undefined) ch.push([off, 100, EASE.hold], [off + rampa * 0.8, 0, EASE.suave]);
    });
    this.kf(c, 'opacity', ch);
  }
  // entrada própria "softRise": sobe dy px e acende em 350 ms (o preset do Tesseract não aceita atraso entre camadas)
  sobe(c, t, y, dy = 40) { this.kf(c, 'positionY', [[c.a, y + dy, EASE.hold], [t, y + dy, EASE.hold], [t + 0.35, y]]); }
  saiFade(c, t, entra) { this.kf(c, 'opacity', [[c.a, 0, EASE.hold], [entra, 0, EASE.hold], [entra + 0.22, 100], [t - 0.18, 100, EASE.hold], [t, 0, EASE.suave]]); }
  // pop: encolhido (80%) até E, passa de 100 para 104 e assenta
  pop(c, E) { this.escala(c, [[c.a, 80, EASE.hold], [E, 80, EASE.hold], [E + 0.14, 104], [E + 0.24, 100]]); }
  // painel de placa escura (0,93) com contorno claro 10%; entra subindo 46 px quando `entrada` é 'sobe'
  painel(papel, a, z, h, { entrada = 'corte', fim = null } = {}) {
    const p = this.rect(papel, a, z, [PAINEL.x, PAINEL.y], [PAINEL.w, h], alfa(ESCURO, 0.93), { raio: 30, traco: alfa(CLARO, 0.10), larguraTraco: 2 });
    if (entrada === 'sobe') {
      this.kf(p, 'positionY', [[a, PAINEL.y + 46], [a + 0.38, PAINEL.y]]);
      this.kf(p, 'opacity', [[a, 0, EASE.hold], [a + 0.26, 100]]);
    }
    return p;
  }
  som(tipo, s, rotulo, ganhoDb) {
    this.sons.push({ tipo, ini: Number((s + this.desloca).toFixed(3)), fim: Number((s + this.desloca + 0.5).toFixed(3)), img: rotulo, ...(ganhoDb ? { som: { ganhoDb } } : {}) });
  }

  // vira as ações de keyframe (uma por track) e devolve criações + keyframes
  emite() {
    const valor = (v) => (typeof v === 'string' ? { type: 'string', value: v } : Array.isArray(v) && v.length === 4 ? { type: 'color', value: v }
      : Array.isArray(v) ? { type: 'vector2', value: v } : { type: 'float', value: v });
    const kfs = [];
    for (const tr of this.tracks.values()) {
      const lista = [...tr.mapa.values()].sort((p, q) => p[0] - q[0]);
      kfs.push({ type: 'setFxPropertyKeyframes', compositionId: this.comp, property: { layerId: tr.layerId, propertyType: tr.prop },
        keyframes: lista.map(([t, v, e]) => ({ id: `${this.prefixoKf}-${this.bloco || 'x'}-${this.kfn++}`, layerTime: t, value: valor(v),
          easing: e || (tr.prop === 'textContent' ? EASE.hold : EASE.saida) })) });
    }
    return [...this.acoes, ...kfs];
  }
  // zera o que é do bloco (mantém ids e contador de keyframes) para o próximo bloco
  fechaBloco() {
    const r = { acoes: this.emite(), camadas: this.camadas, sons: this.sons, documento: this.documento };
    this.acoes = []; this.tracks = new Map(); this.camadas = []; this.sons = []; this.documento = [];
    return r;
  }
}

// escala os tempos de um bloco: offsets originais (em s desde o início do bloco original) -> bloco de outra duração
const escalaTempo = (inicio, fim, durOriginal) => (off) => inicio + off * ((fim - inicio) / durOriginal);

module.exports = { ESCURO, CLARO, ACENTO, NEUTRO, CORES, FATOR_LARGURA, alfa, mistura, cor, PRINCIPAL, MONO, EASE, FAIXA_PADRAO, PAINEL, HL, K,
  retParcial, retArredondado, seta, elipse, shiftCaminho, Contexto, escalaTempo };
