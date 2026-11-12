// Motor dos modelos de edição (Fábrica de Conteúdo). Sem identidade de marca: cores e fontes vêm do modelo ou do pedido.
// Monta um documento do Tesseract em memória (camadas de baixo para cima) e aplica efeitos, presets e keyframes por ações.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TSRCT = path.join(process.env.LOCALAPPDATA || '', 'Tesseract', 'bin', 'tsrct.cmd');
const tsrct = (...a) => execFileSync('cmd.exe', ['/c', TSRCT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20 });
const FONTES = path.join(__dirname, 'fontes');
const COMP = 'main';

// ---------- utilitários ----------
const s2ms = (s) => Math.round(s * 1000);
const hex = (h, a = 1) => {
  const n = h.replace('#', '');
  return [parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255, a];
};
const comAlfa = (c, a) => [c[0], c[1], c[2], a];
const tf = (pos, anchor = [0, 0], escala = 100, opacidade = 100, rot = 0) =>
  ({ anchorPoint: anchor, position: pos, scale: Array.isArray(escala) ? escala : [escala, escala], rotation: rot, opacity: opacidade });
const faixa = (a, z) => ({ start: Math.round(a), duration: Math.max(1, Math.round(z - a)) });
const EASE = {
  linear: { type: 'linear' },
  hold: { type: 'hold' },
  saida: { type: 'cubicBezier', x1: 0.16, y1: 1, x2: 0.3, y2: 1 }, // chega rápido e assenta
  suave: { type: 'cubicBezier', x1: 0.65, y1: 0, x2: 0.35, y2: 1 },
  entrada: { type: 'cubicBezier', x1: 0.7, y1: 0, x2: 0.84, y2: 0 }, // acelera para sair
  mola: { type: 'cubicBezier', x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 }, // passa um pouco e volta
};
const limpa = (w) => w.replace(/[.,!?;:…"]+$/u, '').replace(/^["“]+/u, '');
const norm = (w) => limpa(w).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ---------- caminhos de forma ----------
// elipse como 4 curvas (centro cx,cy; raios rx,ry), para máscara ou traço
const K = 0.5523;
const elipse = (cx, cy, rx, ry) => ({ commands: [
  { type: 'moveTo', x: cx + rx, y: cy },
  { type: 'cubicTo', c1x: cx + rx, c1y: cy + ry * K, c2x: cx + rx * K, c2y: cy + ry, x: cx, y: cy + ry },
  { type: 'cubicTo', c1x: cx - rx * K, c1y: cy + ry, c2x: cx - rx, c2y: cy + ry * K, x: cx - rx, y: cy },
  { type: 'cubicTo', c1x: cx - rx, c1y: cy - ry * K, c2x: cx - rx * K, c2y: cy - ry, x: cx, y: cy - ry },
  { type: 'cubicTo', c1x: cx + rx * K, c1y: cy - ry, c2x: cx + rx, c2y: cy - ry * K, x: cx + rx, y: cy },
  { type: 'close' }] });
const retangulo = (x, y, w, h) => ({ commands: [
  { type: 'moveTo', x, y }, { type: 'lineTo', x: x + w, y }, { type: 'lineTo', x: x + w, y: y + h },
  { type: 'lineTo', x, y: y + h }, { type: 'close' }] });
const retArredondado = (x, y, w, h, r) => ({ commands: [
  { type: 'moveTo', x: x + r, y }, { type: 'lineTo', x: x + w - r, y },
  { type: 'cubicTo', c1x: x + w - r + r * K, c1y: y, c2x: x + w, c2y: y + r - r * K, x: x + w, y: y + r },
  { type: 'lineTo', x: x + w, y: y + h - r },
  { type: 'cubicTo', c1x: x + w, c1y: y + h - r + r * K, c2x: x + w - r + r * K, c2y: y + h, x: x + w - r, y: y + h },
  { type: 'lineTo', x: x + r, y: y + h },
  { type: 'cubicTo', c1x: x + r - r * K, c1y: y + h, c2x: x, c2y: y + h - r + r * K, x, y: y + h - r },
  { type: 'lineTo', x, y: y + r },
  { type: 'cubicTo', c1x: x, c1y: y + r - r * K, c2x: x + r - r * K, c2y: y, x: x + r, y },
  { type: 'close' }] });
// estrela de 4 pontas (brilho)
const estrela = (cx, cy, r) => {
  const i = r * 0.16, c = [];
  [[0, -r], [i, -i], [r, 0], [i, i], [0, r], [-i, i], [-r, 0], [-i, -i]].forEach(([dx, dy], k) => c.push({ type: k ? 'lineTo' : 'moveTo', x: cx + dx, y: cy + dy }));
  c.push({ type: 'close' });
  return { commands: c };
};
// arco: retângulo com topo em semicírculo
const arco = (x, y, w, h) => {
  const r = w / 2, cx = x + r;
  return { commands: [
    { type: 'moveTo', x, y: y + h }, { type: 'lineTo', x, y: y + r },
    { type: 'cubicTo', c1x: x, c1y: y + r - r * K, c2x: cx - r * K, c2y: y, x: cx, y },
    { type: 'cubicTo', c1x: cx + r * K, c1y: y, c2x: x + w, c2y: y + r - r * K, x: x + w, y: y + r },
    { type: 'lineTo', x: x + w, y: y + h }, { type: 'close' }] };
};
// laço desenhado à mão: elipse que passa do ponto inicial e não fecha, com leve tremor determinístico
const laco = (cx, cy, rx, ry, voltas = 1.12, seed = 3) => {
  const n = 40, cmds = [];
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 - 0.5; };
  for (let i = 0; i <= n * voltas; i++) {
    const t = (i / n) * Math.PI * 2 - 2.6;
    const k = 1 + rnd() * 0.035 + (i / (n * voltas)) * 0.06; // abre um pouco no fim, como traço de caneta
    const x = cx + Math.cos(t) * rx * k, y = cy + Math.sin(t) * ry * k + rnd() * 3;
    cmds.push(i === 0 ? { type: 'moveTo', x, y } : { type: 'lineTo', x, y });
  }
  return { commands: cmds };
};

// ---------- texturas ----------
// As texturas dos modelos (papel, fita, luz dourada...) são desenhadas pelo gerar-texturas.js e ficam fora do git. Numa
// instalação nova a pasta texturas/ não existe; sem isto, os modelos que usam textura (Luz de Vela, Adesivo, Caderno,
// Recorte, Retrô, Visor e os do caminho inverso) paravam com um erro do Tesseract sem explicação. Gera todas uma vez só.
const PASTA_TEXTURAS = path.join(__dirname, 'texturas');
const GERAR_TEXTURAS = path.join(__dirname, 'gerar-texturas.js');
function garantirTextura(arquivo, { programa = GERAR_TEXTURAS, pasta = PASTA_TEXTURAS } = {}) {
  const abs = path.resolve(arquivo);
  if (fs.existsSync(abs) || path.dirname(abs) !== path.resolve(pasta)) return false;
  execFileSync(process.execPath, [programa], { stdio: ['ignore', 'ignore', 'inherit'], timeout: 5 * 60 * 1000, windowsHide: true });
  if (!fs.existsSync(abs)) throw new Error(`a textura ${path.basename(abs)} não existe e o gerar-texturas.js não a desenha`);
  return true;
}

// ---------- projeto ----------
class Projeto {
  constructor(saida, { largura = 1080, altura = 1920 } = {}) {
    this.saida = path.resolve(saida);
    this.W = largura; this.H = altura;
    this.camadas = []; this.acoes = []; this.id = 1; this.efeitoId = 5000; this.kfId = 0;
    this.fontes = {}; this.tamImg = {};
    if (fs.existsSync(this.saida)) fs.rmSync(this.saida);
    tsrct('project', 'create', '-p', this.saida);
  }

  // ----- recursos -----
  importaVideo(arquivo, assetId = 'footage') {
    const r = JSON.parse(tsrct('project', 'import-video', '-p', this.saida, '--file', path.resolve(arquivo), '--asset-id', assetId));
    return r.durationMs;
  }
  // devolve { family, style } pelo nome do arquivo da pasta fontes/ (ou caminho absoluto, como a letra da marca); o estilo
  // do documento é escolhido depois (ex.: "Black Italic"). estilos: os estilos que o arquivo tem; italico: a face é itálica
  fonte(arquivo) {
    if (this.fontes[arquivo]) return this.fontes[arquivo];
    const f = path.isAbsolute(arquivo) ? arquivo : path.join(FONTES, arquivo);
    const r = JSON.parse(tsrct('project', 'import-font', '-p', this.saida, '--file', f).split('\n').filter((l) => l.startsWith('{')).pop());
    const face = (r.faces && r.faces[0]) || {};
    this.fontes[arquivo] = { family: r.fontFamily, style: r.fontStyle, arquivo: f,
      estilos: (face.selectionNames || []).map((s) => s.split('/').pop()), italico: !!face.italic };
    return this.fontes[arquivo];
  }
  importaImagem(assetId, arquivo) {
    if (this.tamImg[assetId]) return this.tamImg[assetId];
    garantirTextura(arquivo);
    tsrct('project', 'import-asset', '-p', this.saida, '--file', path.resolve(arquivo), '--asset-id', assetId, '--kind', 'image');
    const buf = fs.readFileSync(arquivo);
    this.tamImg[assetId] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    return this.tamImg[assetId];
  }

  // ----- camadas -----
  novo(c) {
    let camada = { id: this.id++, blendMode: 'normal', effects: [], layerStyles: [], masks: [], ...c };
    if ((camada.type === 'Video' || camada.type === 'Audio') && camada.activeRange) {
      const { activeRange: r, ...resto } = camada; // Tesseract 0.3.1: Video/Audio usam playback "windowed"
      camada = { ...resto, playback: { type: 'windowed', inputRange: r, mapping: { type: 'linear', input: { ...r }, output: { ...r } }, inputOffsetMs: 0 } };
    }
    this.camadas.push(camada);
    return camada;
  }
  // trecho do vídeo: [a,z] na edição, começando em src0 na fonte
  video(nome, a, z, { assetId = 'footage', src0 = a, volume = 0, pos = [this.W / 2, this.H / 2], escala = 100, durFonte } = {}) {
    const c = this.novo({ type: 'Video', name: nome, volume, activeRange: faixa(a, z), sourceRange: faixa(src0, src0 + (z - a)),
      sourceIntrinsicDuration: durFonte, transform: tf(pos, [this.W / 2, this.H / 2], escala), source: { assetId, fit: 'cover' } });
    if (src0 !== a) {
      // a janela de playback mapeia tempo da edição para tempo da fonte
      c.playback.mapping = { type: 'linear', input: faixa(a, z), output: faixa(src0, src0 + (z - a)) };
    }
    return c;
  }
  imagem(nome, a, z, pos, { escala = 100, opacidade = 100, rot = 0, fit = 'contain' } = {}) {
    const [w, h] = this.tamImg[nome];
    return this.novo({ type: 'Image', name: nome, activeRange: faixa(a, z), transform: tf(pos, [w / 2, h / 2], escala, opacidade, rot), source: { assetId: nome, fit } });
  }
  texto(nome, a, z, pos, doc, anchor = [0, 0], extra = {}) {
    return this.novo({ type: 'Text', name: nome, activeRange: faixa(a, z), transform: tf(pos, anchor, extra.escala ?? 100, extra.opacidade ?? 100, extra.rot ?? 0),
      sourceText: { strokeWidth: 0, tracking: 0, ...doc } });
  }
  ret(nome, a, z, pos, size, cor, { anchor = [0, 0], paint, raio, rot = 0, opacidade = 100 } = {}) {
    const c = this.novo({ type: 'Rect', name: nome, activeRange: faixa(a, z), transform: tf(pos, anchor, 100, opacidade, rot),
      // raio de 0 a 1 (1 = pílula), convertido em pixels; o arredondamento por ação só vale para camadas de mídia
      rect: { position: [0, 0], size, fillColor: cor, ...(paint ? { fillPaint: paint } : {}), ...(raio ? { roundness: raio * Math.min(size[0], size[1]) / 2 } : {}) } });
    return c;
  }
  // forma vetorial: traço e/ou preenchimento; trim permite "desenhar" o traço
  forma(nome, a, z, caminho, { traco, largura = 8, preenche, trim, pos = [0, 0], anchor = [0, 0], opacidade = 100, cap = 'round' } = {}) {
    const shape = { path: caminho, fills: [], strokes: [] };
    if (preenche) shape.fills.push({ paint: { type: 'solid', color: preenche }, opacity: 100, blendMode: 'normal', fillRule: 'nonZeroWinding' });
    if (traco) shape.strokes.push({ paint: { type: 'solid', color: traco }, width: largura, cap, join: 'round', miterLimit: 4, blendMode: 'normal', opacity: 100 });
    if (trim) shape.trim = { start: 0, end: trim, offset: 0, mode: 'simultaneously' };
    return this.novo({ type: 'Shape', name: nome, activeRange: faixa(a, z), transform: tf(pos, anchor, 100, opacidade), shape });
  }
  ajuste(nome, a, z) {
    return this.novo({ type: 'Adjustment', name: nome, activeRange: faixa(a, z), transform: tf([0, 0]) });
  }
  // efeito no documento; devolve o id para animar parâmetros
  efeito(camada, efeito) {
    const id = this.efeitoId++;
    camada.effects.push({ id, enabled: true, effect: efeito });
    return id;
  }
  mascara(camada, caminho, { feather = 0, inverted = false } = {}) {
    camada.masks.push({ id: this.efeitoId++, mode: 'add', path: caminho, feather: [feather, feather], expansion: 0, inverted, opacity: 100 });
  }
  matte(camada, matteCamada, mode = 'luma') { camada.trackMatte = { layer: matteCamada.id, mode }; }

  // ----- animação -----
  fade(camada, entrada = 'fade', saida = 'fade') {
    this.acoes.push({ type: 'animatorSetLayerFade', compositionId: COMP, layerId: camada.id, fadeInType: entrada, fadeOutType: saida });
  }
  // keys: [[tempoLocalMs, valor, easing?]]; valor número → float, [x,y] → vector2, string → texto, [r,g,b,a] → cor
  kf(camada, prop, keys) {
    this.acoes.push({ type: 'setFxPropertyKeyframes', compositionId: COMP, property: { layerId: camada.id, propertyType: prop },
      keyframes: ordena(keys).map(([t, v, e]) => ({ id: `k${this.kfId++}`, layerTime: t, value: valor(v, prop), easing: e || (prop === 'textContent' ? EASE.hold : EASE.saida) })) });
  }
  kfEfeito(camada, efeitoId, param, keys) {
    this.acoes.push({ type: 'setFxLayerEffectParamAnimator', compositionId: COMP, layerId: camada.id, effectId: efeitoId, paramName: param, dependencies: [],
      animator: { type: 'keyframes', enabled: true, keyframes: ordena(keys).map(([t, v, e]) => ({ id: `k${this.kfId++}`, layerTime: t, value: valor(v), easing: e || EASE.saida })) } });
  }
  // escala uniforme
  kfEscala(camada, keys) { this.kf(camada, 'scaleX', keys); this.kf(camada, 'scaleY', keys); }
  kfPos(camada, keys) {
    this.kf(camada, 'positionX', keys.map(([t, [x], e]) => [t, x, e]));
    this.kf(camada, 'positionY', keys.map(([t, [, y], e]) => [t, y, e]));
  }

  // ----- medição: largura real dos textos, renderizados pelo próprio Tesseract -----
  // estilo: { arquivo, style, size, tracking, allCaps, wdth }; devolve { texto: { w, x0, top, bottom } } relativo à origem da caixa
  medir(textos, estilo) {
    const lista = [...new Set(textos)].filter(Boolean);
    const res = {};
    const LINHA = Math.max(160, Math.round(estilo.size * 1.7));
    const POR = Math.max(1, Math.floor((this.H - 40) / LINHA));
    for (let i = 0; i < lista.length; i += POR) {
      const lote = lista.slice(i, i + POR);
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modelos-medir-'));
      const proj = path.join(dir, 'm.tsrct');
      tsrct('project', 'create', '-p', proj);
      const arq = path.isAbsolute(estilo.arquivo) ? estilo.arquivo : path.join(FONTES, estilo.arquivo); // a letra da marca vem com caminho absoluto
      const f = JSON.parse(tsrct('project', 'import-font', '-p', proj, '--file', arq).split('\n').filter((l) => l.startsWith('{')).pop());
      const acoes = [{ type: 'createFxRectLayer', compositionId: COMP, layerId: 1, name: 'fundo', activeRange: faixa(0, 1000),
        transform: tf([0, 0]), rect: { position: [0, 0], size: [this.W, this.H], fillColor: [0, 0, 0, 1] } }];
      lote.forEach((t, k) => acoes.push({ type: 'createFxTextLayer', compositionId: COMP, layerId: 10 + k, name: 'm' + k, insertIndex: 0,
        activeRange: faixa(0, 1000), transform: tf([60, 20 + k * LINHA]),
        sourceText: { text: t, fontFamily: f.fontFamily, fontStyle: estilo.style || f.fontStyle, fontSize: estilo.size, fillColor: [1, 1, 1, 1],
          strokeWidth: 0, justification: 'left', tracking: estilo.tracking || 0, allCaps: !!estilo.allCaps,
          ...(estilo.wdth ? { fontVariations: { id: 700 + k, axes: { wdth: estilo.wdth } } } : {}),
          boxText: true, boxPosition: [0, 0], boxSize: [this.W * 3, LINHA], verticalAlign: 'top' } }));
      fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(acoes));
      tsrct('project', 'apply', '-p', proj, '--actions', path.join(dir, 'a.json'));
      const png = path.join(dir, 'm.png');
      tsrct('preview', '-p', proj, '-t', '0', '-o', png);
      const { PNG } = require('pngjs');
      const img = PNG.sync.read(fs.readFileSync(png));
      lote.forEach((t, k) => {
        const y0 = 20 + k * LINHA;
        let x0 = 1e9, x1 = -1, t0 = 1e9, t1 = -1;
        for (let y = y0; y < Math.min(img.height, y0 + LINHA); y++) for (let x = 0; x < img.width; x++) {
          if (img.data[(y * img.width + x) * 4] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < t0) t0 = y; if (y > t1) t1 = y; }
        }
        if (x1 < 0) throw new Error('não foi possível medir: ' + t);
        if (x1 >= img.width - 2) throw new Error('texto maior que a área de medição: ' + t);
        res[t] = { w: x1 - x0 + 1, x0: x0 - 60, top: t0 - y0, bottom: t1 - y0 };
      });
      fs.rmSync(dir, { recursive: true, force: true });
    }
    return res;
  }

  // ----- gravação e render -----
  grava(duracaoMs) {
    const doc = { $schema: 'https://jerboa.dev/schemas/fx-composition/editable/v1/document.schema.json', formatVersion: 1,
      dimensions: { width: this.W, height: this.H }, duration: duracaoMs / 1000,
      composition: { id: COMP, name: 'Main', layers: [...this.camadas].reverse() } };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'modelos-'));
    fs.writeFileSync(path.join(dir, 'doc.json'), JSON.stringify(doc));
    tsrct('project', 'commit', '-p', this.saida, '--file', path.join(dir, 'doc.json'));
    let aplicadas = 0;
    if (this.acoes.length) {
      fs.writeFileSync(path.join(dir, 'acoes.json'), JSON.stringify(this.acoes));
      aplicadas = JSON.parse(tsrct('project', 'apply', '-p', this.saida, '--actions', path.join(dir, 'acoes.json'))).appliedActions;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return { camadas: this.camadas.length, acoes: aplicadas };
  }
  quadro(tSeg, png) { tsrct('preview', '-p', this.saida, '-t', String(tSeg), '-o', path.resolve(png)); }
  exporta(mp4, fps = 30) { return tsrct('export', '-p', this.saida, '-o', path.resolve(mp4), '--fps', String(fps)); }
}

// tempos inteiros, estritamente crescentes e não negativos: no mesmo instante vale a última chave
function ordena(keys) {
  const m = new Map();
  keys.forEach(([t, v, e]) => m.set(Math.max(0, Math.round(t)), [Math.max(0, Math.round(t)), v, e]));
  return [...m.values()].sort((p, q) => p[0] - q[0]);
}

function valor(v, prop) {
  if (prop === 'textContent' || typeof v === 'string') return { type: 'string', value: v };
  if (Array.isArray(v) && v.length === 4) return { type: 'color', value: v };
  if (Array.isArray(v)) return { type: 'vector2', value: v };
  return { type: 'float', value: v };
}

// ---------- legendas: grupos de palavras com tempo por palavra ----------
// palavras: [{ w, ini, fim (ms) }]; devolve [{ palavras, texto, ini, fim }] com fim emendado no próximo grupo quando a pausa é curta
function agrupa(palavras, { maxPalavras = 3, maxChars = 18, pausa = 350, quebraPontuacao = true, minTela = 250 } = {}) {
  const grupos = [];
  let cur = [];
  const fecha = () => { if (cur.length) grupos.push({ palavras: cur }); cur = []; };
  palavras.forEach((p) => {
    const txt = cur.map((c) => limpa(c.w)).join(' ');
    const gap = cur.length ? p.ini - cur[cur.length - 1].fim : 0;
    if (cur.length && (cur.length >= maxPalavras || txt.length + 1 + limpa(p.w).length > maxChars || gap > pausa)) fecha();
    cur.push(p);
    if (quebraPontuacao && /[.,!?;:]$/.test(p.w)) fecha();
  });
  fecha();
  grupos.forEach((g, i) => {
    g.texto = g.palavras.map((p) => limpa(p.w)).join(' ');
    g.ini = g.palavras[0].ini;
    const fimFala = g.palavras[g.palavras.length - 1].fim;
    const prox = grupos[i + 1];
    g.fim = prox && prox.palavras[0].ini - fimFala < 700 ? prox.palavras[0].ini : fimFala + 300;
    if (g.fim - g.ini < minTela) g.fim = g.ini + minTela;
    if (prox && g.fim > prox.palavras[0].ini) prox.palavras[0].ini = g.fim; // sem sobreposição
  });
  grupos.forEach((g) => { g.ini = g.palavras[0].ini; });
  return grupos;
}

// recorta o vídeo (e a máscara) no trecho pedido e desloca as palavras; cache ao lado do pedido
function preparaTrecho(pedido, base) {
  const r = (f) => (f ? path.resolve(base, f) : null);
  const palavras = JSON.parse(fs.readFileSync(r(pedido.palavras), 'utf8'));
  if (!pedido.trecho) return { video: r(pedido.video), matte: r(pedido.matte), palavras };
  const { ini, fim } = pedido.trecho;
  const cache = path.join(base, '.cache');
  fs.mkdirSync(cache, { recursive: true });
  // o corte vai para <nome>.tmp-<pid>.mp4 e troca de nome no fim: um processo morto no meio nunca deixa um MP4 pela metade
  // com o nome final (que seria reaproveitado para sempre); temporário de um processo que já morreu é apagado
  const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  const corta = (src, nome, audio) => {
    const dst = path.join(cache, `${nome}-${ini}-${fim}.mp4`);
    if (!fs.existsSync(dst)) {
      const prefixo = path.basename(dst, '.mp4') + '.tmp-';
      for (const f of fs.readdirSync(cache)) {
        const m = f.startsWith(prefixo) && /^(\d+)\.mp4$/.exec(f.slice(prefixo.length));
        if (m && Number(m[1]) !== process.pid && !vivo(Number(m[1]))) fs.rmSync(path.join(cache, f), { force: true });
      }
      const tmp = path.join(cache, `${prefixo}${process.pid}.mp4`);
      try {
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(ini), '-t', String(fim - ini), '-i', src,
          '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac', '-b:a', '192k'] : ['-an']), tmp]);
        fs.renameSync(tmp, dst);
      } finally { fs.rmSync(tmp, { force: true }); }
    }
    return dst;
  };
  const a = s2ms(ini), z = s2ms(fim);
  return {
    video: corta(r(pedido.video), 'video', true),
    matte: pedido.matte ? corta(r(pedido.matte), 'matte', false) : null,
    palavras: palavras.filter((p) => p.ini >= a - 50 && p.fim <= z + 50).map((p) => ({ ...p, ini: Math.max(0, p.ini - a), fim: Math.min(z - a, p.fim - a) })),
  };
}

module.exports = { Projeto, garantirTextura, agrupa, preparaTrecho, EASE, hex, comAlfa, tf, faixa, s2ms, limpa, norm, elipse, retangulo, retArredondado, estrela, arco, laco, COMP };
