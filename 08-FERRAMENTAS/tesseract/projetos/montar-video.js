// Montador de Reels no Tesseract (Fábrica de Conteúdo). Cores, fontes e conta vêm do contrato de marca.
// Lê a transcrição palavra por palavra (palavras.json, gerada por palavras.js) e a decupagem do vídeo,
// e monta o projeto inteiro: vídeo em cor natural, legenda em rajada, caixa de destaque, blocos de motion e alerta duotone.
// Uso: node montar-video.js <pasta-do-video>/decupagem.json
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const marca = require('../../marca/marca');
const fontes = require('../fontes');
const { tamanhoDaImagem } = require('../blocos-motion/cartao-cta');

const T = path.join(process.env.LOCALAPPDATA, 'Tesseract', 'bin', 'tsrct.cmd');
// Peças de imagem (tiles de terceiros, mockups, fundos): a pasta da empresa vence a da ferramenta.
const PASTAS_PECAS = [path.join(marca.PASTA, 'pecas'), path.join(__dirname, '..', 'assets')];
const tsrct = (...a) => execFileSync('cmd.exe', ['/c', T, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const decPath = path.resolve(process.argv[2]);
const DEC = JSON.parse(fs.readFileSync(decPath, 'utf8'));
const BASE = path.dirname(decPath);
const PALAVRAS = JSON.parse(fs.readFileSync(path.resolve(BASE, DEC.palavras), 'utf8'));
const PROJ = path.resolve(BASE, DEC.saida);

// ---------- identidade ----------
const ESCURO = marca.cor('escuro').slice(0, 3);
const CLARO = marca.cor('claro');
const ACENTO = marca.cor('acento');
const COMP = 'main';
let FAM = null, MONO = null; // fontes do contrato, importadas no passo 1
const EST = (s) => FAM.estilo(s);
const LEG = { tam: 92, estilo: 'ExtraBold', boxY: 1320, boxH: 140, padX: 34, maxChars: 18, maxPalavras: 3 };

const s2ms = (s) => Math.round(s * 1000);
const tf = (pos, anchor = [0, 0], scale = 100, opacity = 100) =>
  ({ anchorPoint: anchor, position: pos, scale: [scale, scale], rotation: 0, opacity });
const limpa = (w) => w.replace(/[.,!?;:…]+$/u, '');
const norm = (w) => limpa(w).toLowerCase();

// ---------- 1. projeto e assets ----------
if (fs.existsSync(PROJ)) fs.rmSync(PROJ);
tsrct('project', 'create', '-p', PROJ);
const vid = JSON.parse(tsrct('project', 'import-video', '-p', PROJ, '--file', path.resolve(BASE, DEC.video), '--asset-id', 'footage'));
const DUR = vid.durationMs;
FAM = fontes.importar(tsrct, PROJ, 'principal');
MONO = fontes.importar(tsrct, PROJ, 'mono');
const LARGURA = FAM.temLargura ? marca.pega('tipografia.principal.largura-titulo', 100) : '';
if (DEC.matte) tsrct('project', 'import-video', '-p', PROJ, '--file', path.resolve(BASE, DEC.matte), '--asset-id', 'matte');
// Elemento da identidade atrás da pessoa (pecas.elemento-fundo do contrato); sem ele, nada é desenhado.
const PECA_MARCA = { 'elemento-fundo': marca.pega('pecas.elemento-fundo', ''), logo: marca.pega('pecas.logo', '') };
const ELEM = PECA_MARCA['elemento-fundo']
  ? { nome: 'elemento-fundo', ...{ pos: [907, 367], escala: 108, opacidade: 11 }, ...(DEC.elemento || {}) } : null;
const imagens = new Set(ELEM ? ['elemento-fundo'] : []);
if (PECA_MARCA.logo && DEC.blocos.some((b) => b.tipo === 'cta')) imagens.add('logo');
DEC.blocos.forEach((b) => {
  if (b.img) imagens.add(b.img);
  if (b.tile) imagens.add(b.tile);
  if (b.fundo) imagens.add(b.fundo);
  if (b.tipo === 'busca') imagens.add('busca-google');
});
const ARQ = (nome) => (PECA_MARCA[nome] ? marca.caminho(PECA_MARCA[nome])
  : PASTAS_PECAS.flatMap((p) => [path.join(p, nome + '.png')]).find((f) => fs.existsSync(f)));
const TAMANHO_IMG = {};
for (const nome of imagens) {
  const f = ARQ(nome);
  if (!f) throw new Error('imagem não encontrada: ' + nome + ' (procurada em ' + PASTAS_PECAS.join(' e ') + ')');
  tsrct('project', 'import-asset', '-p', PROJ, '--file', f, '--asset-id', nome, '--kind', 'image');
  // largura/altura pelo tipo do arquivo (PNG, JPG, WebP ou SVG: o logo e o elemento de fundo da marca podem ser qualquer um)
  // a mensagem cita a imagem (pode ser um mockup ou o elemento de fundo, não só o logo)
  try { TAMANHO_IMG[nome] = tamanhoDaImagem(fs.readFileSync(f)); } catch (e) { throw new Error('imagem ' + nome + ': ' + String(e.message).replace(/^logo: /, '')); }
}

// ---------- 2. legenda em rajada ----------
const esconde = [];
DEC.blocos.forEach((b) => {
  if (b.escondeLegenda) esconde.push(b.escondeLegenda.map(s2ms));
  else if (['cartao', 'cta'].includes(b.tipo)) esconde.push([s2ms(b.ini), s2ms(b.fim)]);
});

const frases = [];
PALAVRAS.forEach((p) => { (frases[p.frase] = frases[p.frase] || []).push(p); });
const blocos = [];
frases.forEach((ws, fi) => {
  if (!ws) return;
  const chave = DEC.palavrasChave[String(fi)];
  let cur = [];
  const fecha = () => { if (cur.length) blocos.push({ ws: cur, kw: false, frase: fi }); cur = []; };
  ws.forEach((w, i) => {
    const ehChave = chave && norm(w.w) === chave.toLowerCase();
    if (ehChave) { fecha(); blocos.push({ ws: [w], kw: true, frase: fi }); return; }
    const txt = cur.map((c) => limpa(c.w)).join(' ');
    const gap = cur.length ? w.ini - cur[cur.length - 1].fim : 0;
    if (cur.length && (cur.length >= LEG.maxPalavras || txt.length + 1 + limpa(w.w).length > LEG.maxChars || gap > 300)) fecha();
    cur.push(w);
    if (/[.,!?;:]$/.test(w.w)) fecha();
  });
  fecha();
});
blocos.forEach((b, i) => {
  const primeiro = i === 0 || blocos[i - 1].frase !== b.frase;
  b.ini = b.ws[0].ini - (primeiro ? 80 : 0);
  b.texto = b.ws.map((w) => limpa(w.w)).join(' ');
});
// tempo mínimo de tela: o whisper às vezes dá 40ms a uma palavra e a legenda sumia.
// Se faltar tempo, a legenda seguinte começa um pouco depois, em cascata, até a folga absorver o atraso.
// A palavra-chave nunca é atrasada: ela entra no tempo da fala.
const MIN_TELA = { kw: 350, normal: 250 };
blocos.forEach((b, i) => {
  const prox = blocos[i + 1];
  const minFim = b.ini + (b.kw ? MIN_TELA.kw : MIN_TELA.normal);
  if (prox && !prox.kw && prox.ini < minFim) prox.ini = minFim;
});
blocos.forEach((b, i) => {
  const fimFala = b.ws[b.ws.length - 1].fim;
  const prox = blocos[i + 1];
  b.fim = prox && prox.ini - fimFala < 700 ? prox.ini : fimFala + 300;
  if (b.fim <= b.ini) b.fim = b.ini + 200;
});
// recorta pelos trechos onde um bloco de motion ocupa a área da legenda
const legendas = [];
for (const b of blocos) {
  let pedacos = [[b.ini, b.fim]];
  for (const [e0, e1] of esconde) {
    pedacos = pedacos.flatMap(([a, z]) => (z <= e0 || a >= e1 ? [[a, z]] : [[a, Math.min(z, e0)], [Math.max(a, e1), z]].filter(([x, y]) => y - x > 0)));
  }
  pedacos.filter(([a, z]) => z - a >= 150).forEach(([a, z]) => legendas.push({ ...b, ini: a, fim: z }));
}

// ---------- 3. medir textos que precisam de caixa ----------
const medir = (lista, tam, estilo, wdth = '', tracking = '', caixaAlta = false) => (lista.length
  ? JSON.parse(execFileSync('node', [path.join(__dirname, 'medir-palavras.js'), lista.join('|'), String(tam), estilo, String(wdth), String(tracking), caixaAlta ? '1' : '0'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop()) : {});
const MED = medir([...new Set(legendas.filter((l) => l.kw).map((l) => l.texto))], LEG.tam, LEG.estilo);
const ctas = DEC.blocos.filter((b) => b.tipo === 'cta');
const MED_BOTAO = medir(ctas.map((c) => c.botao), 40, 'Bold');

// ---------- 4. camadas (de baixo para cima; a lista final é invertida) ----------
const L = [];
let id = 1;
const A = []; // ações: efeitos, presets de entrada/saída, keyframes
// Tesseract 0.3.1: Video/Audio não aceitam activeRange; a janela vira playback "windowed" com mapeamento linear 1:1.
const comPlayback = (camada) => {
  if ((camada.type !== 'Video' && camada.type !== 'Audio') || !camada.activeRange) return camada;
  const { activeRange: r, ...resto } = camada;
  return { ...resto, playback: { type: 'windowed', inputRange: r, mapping: { type: 'linear', input: { ...r }, output: { ...r } }, inputOffsetMs: 0 } };
};
const novo = (camada) => { const c = { id: id++, blendMode: 'normal', effects: [], layerStyles: [], masks: [], ...comPlayback(camada) }; L.push(c); return c; };
const faixa = (a, z) => ({ start: a, duration: Math.max(1, z - a) });
const fade = (c, entrada, saida) => A.push({ type: 'animatorSetLayerFade', compositionId: COMP, layerId: c.id, fadeInType: entrada, fadeOutType: saida });
const imagem = (nome, a, z, pos, escala = 100, op = 100) => {
  const [w, h] = TAMANHO_IMG[nome];
  return novo({ type: 'Image', name: nome, activeRange: faixa(a, z), transform: tf(pos, [w / 2, h / 2], escala, op), source: { assetId: nome, fit: 'contain' } });
};
const texto = (nome, a, z, pos, doc, anchor = [0, 0]) =>
  novo({ type: 'Text', name: nome, activeRange: faixa(a, z), transform: tf(pos, anchor), sourceText: { strokeWidth: 0, ...doc } });
const ret = (nome, a, z, pos, size, cor, anchor = [0, 0], paint) =>
  novo({ type: 'Rect', name: nome, activeRange: faixa(a, z), transform: tf(pos, anchor), rect: { position: [0, 0], size, fillColor: cor, ...(paint ? { fillPaint: paint } : {}) } });
const grad = (h, stops) => ({ type: 'gradient', gradientType: 'linear', start: [0, 0], end: [0, h], stops: stops.map(([o, a]) => ({ offset: o, color: [...ESCURO, a] })) });

// vídeo em cor natural (com áudio). Com máscara, ele vira o fundo e uma cópia recortada da pessoa vai por cima.
novo({ type: 'Video', name: 'video', volume: 1, activeRange: faixa(0, DUR), sourceRange: faixa(0, DUR), sourceIntrinsicDuration: DUR,
  transform: tf([540, 960], [540, 960]), source: { assetId: 'footage', fit: 'cover' } });

const sombraTexto = { color: [...ESCURO, 0.45], blurRadius: 18, spreadRadius: 0, blendMode: 'normal', offset: [0, 4] };
if (DEC.matte) {
  // entre o fundo e a pessoa: elemento de fundo e headline.
  // "enquadramento" são os trechos em que a pré-edição aproximou a imagem (corte com zoom). Elemento e headline fazem parte do
  // cenário atrás da pessoa, então aproximam junto: mesma escala e mesmo deslocamento do recorte (centro em x, 35% em y).
  const ENQ = (DEC.enquadramento || []).map((e) => ({ a: s2ms(e.ini), z: s2ms(e.fim), k: e.zoom,
    dx: (1080 * e.zoom - 1080) / 2, dy: (1920 * e.zoom - 1920) * (e.altura ?? 0.35) }));
  const zoomEm = (t) => ENQ.find((e) => t >= e.a && t < e.z);
  const naCena = ([x, y], e) => (e ? [Math.round(x * e.k - e.dx), Math.round(y * e.k - e.dy)] : [x, y]);
  const marcos = [...new Set([0, DUR, ...ENQ.flatMap((e) => [e.a, Math.min(e.z, DUR)])])].sort((p, q) => p - q);
    for (let k = 0; k < marcos.length - 1; k++) {
      const e = zoomEm(marcos[k]);
      if (ELEM) imagem('elemento-fundo', marcos[k], marcos[k + 1], naCena(ELEM.pos, e), Math.round(ELEM.escala * (e ? e.k : 1)), ELEM.opacidade);
    }
  }
  
  let varId = 900;
  const H = { fontFamily: FAM.familia, fontStyle: EST('Black'), tracking: -50, allCaps: true };
  const corDe = (c) => ({ acento: ACENTO, escuro: [...ESCURO, 1], claro: CLARO })[c];
  for (const h of DEC.headline || []) {
    // If we have a matte, we might have enquadramento (zoom)
    const e = DEC.matte && DEC.enquadramento ? 
        DEC.enquadramento.find((eq) => s2ms((h.ini + h.fim) / 2) >= s2ms(eq.ini) && s2ms((h.ini + h.fim) / 2) < s2ms(eq.fim)) : null;
    const dx = e ? (1080 * e.zoom - 1080) / 2 : 0;
    const dy = e ? (1920 * e.zoom - 1920) * (e.altura ?? 0.35) : 0;
    const k = e ? e.zoom : 1;
    const naCena = (x, y) => [Math.round(x * k - dx), Math.round(y * k - dy)];

    const a = s2ms(h.ini), z = s2ms(h.fim), y = naCena(0, h.y ?? 250)[1], tam = Math.round((h.tamanho || 160) * k);
    const entrada = h.entrada || 'softRise', saida = h.saida || 'fade';
    if (h.palavra) {
      fade(texto('headline-' + h.palavra, a, z, [0, y], { ...H, text: h.palavra, fontSize: tam,
        ...FAM.variacao(varId++, LARGURA), fillColor: corDe(h.cor) || CLARO, justification: 'center',
        boxText: true, boxPosition: [0, 0], boxSize: [1080, 260], verticalAlign: 'top' }), entrada, saida);
      continue;
    }
    const med = medir(h.partes.map((p) => p.t), tam, 'Black', LARGURA, -50, true);
    const gap = Math.round(tam * 0.28);
    const total = h.partes.reduce((s, p) => s + med[p.t].w, 0) + gap * (h.partes.length - 1);
    let x = Math.round(540 - total / 2);
    h.partes.forEach((p) => {
      const w = med[p.t].w;
      fade(texto('headline-' + p.t, a, z, [x - 40, y], { ...H, text: p.t, fontSize: tam,
        ...FAM.variacao(varId++, LARGURA), fillColor: corDe(p.cor) || corDe(h.cor) || CLARO, justification: 'center',
        boxText: true, boxPosition: [0, 0], boxSize: [w + 80, Math.round(tam * 1.6)], verticalAlign: 'top' }), entrada, saida);
      x += w + gap;
    });
  }

  if (DEC.matte) {
  const pessoa = novo({ type: 'Video', name: 'pessoa', volume: 0, activeRange: faixa(0, DUR), sourceRange: faixa(0, DUR), sourceIntrinsicDuration: DUR,
    transform: tf([540, 960], [540, 960]), source: { assetId: 'footage', fit: 'cover' } });
  const matte = novo({ type: 'Video', name: 'matte', volume: 0, activeRange: faixa(0, DUR), sourceRange: faixa(0, DUR), sourceIntrinsicDuration: DUR,
    transform: tf([540, 960], [540, 960]), source: { assetId: 'matte', fit: 'cover' } });
  pessoa.trackMatte = { layer: matte.id, mode: 'luma' };
}

// alerta: o mesmo trecho em duotone leve por cima, sem áudio, + véus escuros em degradê + trilho na cor de acento.
// Receita calibrada em teste real (duotone leve; os valores vêm de video.alerta no contrato): saturação -45, brilho -10, contraste +6,
// véu de base (0 → 58% → 95%) e véu de topo (62% → 28% → 0). A tinta chapada no quadro todo deixava a imagem escura demais.
const ALERTA = marca.pega('video.alerta', { saturacao: -45, brilho: -10, contraste: 6 });
for (const al of DEC.alerta || []) {
  const a = s2ms(al.ini), z = s2ms(al.fim);
  const v = novo({ type: 'Video', name: 'alerta-duotone', volume: 0, activeRange: faixa(a, z), sourceRange: faixa(a, z), sourceIntrinsicDuration: DUR,
    transform: tf([540, 960], [540, 960]), source: { assetId: 'footage', fit: 'cover' } });
  A.push({ type: 'addFxLayerEffect', compositionId: COMP, layerId: v.id, effectId: 100 + v.id,
    effect: { type: 'hueSaturation', hue: 0, saturation: ALERTA.saturacao, lightness: 0 } });
  A.push({ type: 'addFxLayerEffect', compositionId: COMP, layerId: v.id, effectId: 200 + v.id,
    effect: { type: 'brightnessContrast', brightness: ALERTA.brilho, contrast: ALERTA.contraste } });
  fade(v, 'fade', 'fade');
  fade(ret('alerta-veu-base', a, z, [0, 1050], [1080, 870], [...ESCURO, 0.6], [0, 0], grad(870, [[0, 0], [0.4, 0.58], [1, 0.95]])), 'fade', 'fade');
  fade(ret('alerta-veu-topo', a, z, [0, 0], [1080, 500], [...ESCURO, 0.3], [0, 0], grad(500, [[0, 0.62], [0.55, 0.28], [1, 0]])), 'fade', 'fade');
  fade(ret('alerta-trilho', a, z, [52, 250], [12, 1100], ACENTO), 'slideUp', 'fade');
}

// véus leves: topo (leitura do kicker) e faixa suave atrás da legenda
ret('veu-base', 0, DUR, [0, 1150], [1080, 770], [...ESCURO, 0.3], [0, 0], grad(770, [[0, 0], [0.45, 0.42], [1, 0.62]]));
if (!DEC.matte) {
  // sem máscara: elemento discreto por cima e kicker mono no topo
  ret('veu-topo', 0, DUR, [0, 0], [1080, 420], [...ESCURO, 0.2], [0, 0], grad(420, [[0, 0.45], [1, 0]]));
  if (ELEM) imagem('elemento-fundo', 0, DUR, ELEM.pos, ELEM.escala, ELEM.opacidade);
  if (DEC.kicker) {
    texto('kicker', 0, DUR, [90, 330], { text: DEC.kicker, fontFamily: MONO.familia, fontStyle: MONO.estilo('Regular'), fontSize: 40,
      fillColor: [CLARO[0], CLARO[1], CLARO[2], 0.74], justification: 'left', tracking: 280, allCaps: true });
  }
}

// blocos de motion
const LADO = { esq: 190, dir: 890 };
for (const b of DEC.blocos) {
  const a = s2ms(b.ini), z = s2ms(b.fim);
  if (b.tipo === 'tile') {
    fade(imagem(b.img, a, z, [LADO[b.lado], 640], 85), 'pop', 'fade');
    if (b.rotulo) {
      const r = texto('rotulo-' + b.rotulo, a + 150, z, [LADO[b.lado] - 180, 742], { text: b.rotulo, fontFamily: FAM.familia, fontStyle: EST('Black'), fontSize: 50,
        fillColor: CLARO, justification: 'center', tracking: -20, allCaps: true, boxText: true, boxPosition: [0, 0], boxSize: [360, 70], verticalAlign: 'center' });
      r.dropShadow = sombraTexto;
      fade(r, 'softRise', 'fade');
    }
  }
  if (b.tipo === 'busca') {
    // centroY opcional (padrão 1130, modelo original): permite respeitar a regra de queixo (y>=1190 de topo)
    // quando o cenário tem rosto na mesma altura.
    const cyBusca = b.centroY ?? 1130;
    fade(imagem('busca-google', a, z, [540, cyBusca]), 'slideUp', 'fade');
    const t0 = s2ms(b.digitacao[0][0]);
    const camada = texto('busca-texto', t0, z, [200, cyBusca + 13], { text: b.digitacao[0][1], fontFamily: FAM.familia, fontStyle: EST('Regular'), fontSize: 36,
      fillColor: [...ESCURO, 1], justification: 'left', tracking: 0 });
    fade(camada, 'none', 'fade');
    A.push({ type: 'setFxPropertyKeyframes', compositionId: COMP, property: { layerId: camada.id, propertyType: 'textContent' },
      keyframes: b.digitacao.map(([t, txt], k) => ({ id: `dig-${k}`, layerTime: s2ms(t) - t0, value: { type: 'string', value: txt }, easing: { type: 'hold' } })) });
  }
  if (b.tipo === 'mockup') {
    fade(imagem(b.img, a, z, [540, b.centroY]), b.entrada || 'slideUp', 'fade');
  }
  if (b.tipo === 'cartao') {
    if (b.fundo) imagem(b.fundo, a, z, [540, 960]);
    else ret('cartao-fundo', a, z, [0, 0], [1080, 1920], [...ESCURO, 1]);
    fade(texto('cartao-kicker', a, z, [90, 820], { text: b.kicker, fontFamily: MONO.familia, fontStyle: MONO.estilo('Regular'), fontSize: 44,
      fillColor: [CLARO[0], CLARO[1], CLARO[2], 0.74], justification: 'left', tracking: 280, allCaps: true }), 'softRise', 'none');
    fade(texto('cartao-palavra', a, z, [90, 990], { text: b.palavra, fontFamily: FAM.familia, fontStyle: EST('ExtraBold'), fontSize: 210,
      fillColor: ACENTO, justification: 'left', tracking: -40, boxText: true, boxPosition: [0, 0], boxSize: [960, 280], verticalAlign: 'top' }, [0, 140]), 'zoom', 'none');
    if (b.tile) fade(imagem(b.tile, a + 200, z, [186, 1300], 100), 'pop', 'none');
  }
  if (b.tipo === 'cta') {
    // centroY opcional (padrão 1310): desce o cartão inteiro quando o trecho final está fechado e o rosto fica maior.
    const dy = (b.centroY ?? 1310) - 1310;
    // cartão desenhado pelo próprio montador (retângulo na cor clara, logo opcional e endereço da conta do contrato)
    const cartao = novo({ type: 'Rect', name: 'cta-cartao', activeRange: faixa(a, z), transform: tf([80, 1060 + dy]),
      rect: { position: [0, 0], size: [920, 500], fillColor: CLARO, roundness: 26 } });
    fade(cartao, 'slideUp', 'none');
    const temLogo = imagens.has('logo');
    if (temLogo) {
      const [lw, lh] = TAMANHO_IMG.logo;
      fade(imagem('logo', a + 200, z, [136 + 32, 1110 + 32 + dy], Math.round((64 / Math.max(lw, lh)) * 100)), 'pop', 'none');
    }
    if (marca.handle) {
      fade(texto('cta-conta', a + 200, z, [temLogo ? 216 : 136, 1112 + dy], { text: marca.handle, fontFamily: FAM.familia, fontStyle: EST('SemiBold'),
        fontSize: 28, fillColor: [...ESCURO, 1], justification: 'left', tracking: -10 }), 'softRise', 'none');
    }
    fade(texto('cta-frase', a + 200, z, [136, 1200 + dy], { text: b.frase, fontFamily: FAM.familia, fontStyle: EST('ExtraBold'), fontSize: 50,
      fillColor: [...ESCURO, 1], justification: 'left', tracking: -25, leading: 56, boxText: true, boxPosition: [0, 0], boxSize: [800, 130], verticalAlign: 'top' }), 'softRise', 'none');
    const bw = MED_BOTAO[b.botao].w + 120, bh = 104, cy = 1442 + dy;
    fade(ret('cta-botao', a + 450, z, [540, cy], [bw, bh], ACENTO, [bw / 2, bh / 2]), 'pop', 'none');
    fade(texto('cta-botao-texto', a + 450, z, [540, cy], { text: b.botao, fontFamily: FAM.familia, fontStyle: EST('Bold'), fontSize: 40,
      fillColor: [...ESCURO, 1], justification: 'center', tracking: -10, boxText: true, boxPosition: [0, 0], boxSize: [bw, bh], verticalAlign: 'center' }, [bw / 2, bh / 2]), 'pop', 'none');
  }
}

// legendas por cima de tudo, exceto dos cartões de tela cheia (que são recortados da legenda)
for (const l of legendas) {
  const cy = LEG.boxY + LEG.boxH / 2;
  if (l.kw) {
    const m = MED[l.texto];
    const capTop = LEG.boxY + m.top, base = LEG.boxY + Math.min(m.bottom, 92);
    const w = m.w + LEG.padX * 2, h = 112, cyCaixa = Math.round((capTop + base) / 2);
    fade(ret('caixa-' + l.texto, l.ini, l.fim, [540, cyCaixa], [w, h], ACENTO, [w / 2, h / 2]), 'pop', 'none');
  }
  const c = texto('leg-' + l.texto, l.ini, l.fim, [540, cy], { text: l.texto, fontFamily: FAM.familia, fontStyle: EST(LEG.estilo), fontSize: LEG.tam,
    fillColor: l.kw ? [...ESCURO, 1] : CLARO, justification: 'center', tracking: -25,
    boxText: true, boxPosition: [0, 0], boxSize: [900, LEG.boxH], verticalAlign: 'center' }, [450, LEG.boxH / 2]);
  if (l.kw) fade(c, 'pop', 'none');
}

// ---------- 5. documento e gravação ----------
const doc = {
  $schema: 'https://jerboa.dev/schemas/fx-composition/editable/v1/document.schema.json',
  formatVersion: 1, dimensions: { width: 1080, height: 1920 }, duration: DUR / 1000,
  composition: { id: COMP, name: 'Main', layers: [...L].reverse() },
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'montar-'));
fs.writeFileSync(path.join(tmp, 'doc.json'), JSON.stringify(doc));
fs.writeFileSync(path.join(tmp, 'acoes.json'), JSON.stringify(A));
tsrct('project', 'commit', '-p', PROJ, '--file', path.join(tmp, 'doc.json'));
const res = JSON.parse(tsrct('project', 'apply', '-p', PROJ, '--actions', path.join(tmp, 'acoes.json')));
fs.rmSync(tmp, { recursive: true, force: true });

// decupagem legível ao lado do projeto, para revisão
const linhas = [`# Decupagem — ${DEC.titulo}`, '', '| tempo | legenda | destaque |', '|---|---|---|'];
legendas.forEach((l) => linhas.push(`| ${(l.ini / 1000).toFixed(2)}–${(l.fim / 1000).toFixed(2)} | ${l.texto} | ${l.kw ? 'caixa de destaque' : ''} |`));
linhas.push('', '| tempo | bloco |', '|---|---|');
DEC.blocos.forEach((b) => linhas.push(`| ${b.ini.toFixed(2)}–${b.fim.toFixed(2)} | ${b.tipo}${b.img ? ' ' + b.img : ''}${b.palavra ? ' "' + b.palavra + '"' : ''}${b.rotulo ? ' (' + b.rotulo + ')' : ''} |`));
(DEC.alerta || []).forEach((al) => linhas.push(`| ${al.ini.toFixed(2)}–${al.fim.toFixed(2)} | alerta duotone: ${al.motivo} |`));
fs.writeFileSync(path.join(BASE, 'decupagem-gerada.md'), linhas.join('\n'));
console.log(JSON.stringify({ projeto: PROJ, camadas: L.length, legendas: legendas.length, acoes: res.appliedActions }));
