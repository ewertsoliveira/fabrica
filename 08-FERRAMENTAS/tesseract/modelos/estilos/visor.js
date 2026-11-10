// Visor: visor de câmera. O vídeo fica numa moldura azul-marinho com cantoneiras e dados de exposição,
// o título é datilografado no topo, a legenda é mono em caixa alta sobre uma barra preta, o clarão de luz marca as viradas
// e o B-roll entra em tela dividida (pessoa em cima, imagem embaixo) com texto vertical correndo nas laterais.
// Marca (ctx.marca, do tema-marca.js): a moldura azul-marinho vira o escuro da empresa e o título, a exposição e os textos
// laterais, o acento; a legenda branca na barra preta e as cantoneiras brancas são cores fixas e ficam. O título usa a letra
// principal; a legenda, a exposição e as laterais, a mono. Com a letra da marca, o título e a legenda encolhem até caber na
// moldura; o acento sem contraste sobre o vídeo volta à cor do estilo, com aviso no log. Sem marca, nada muda.
const path = require('path');
const { agrupa, EASE, hex, retArredondado } = require('../motor');
const { ancora, docLinha, comVar } = require('./_comum');
const temaMarca = require('../tema-marca');

const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Visor',
  descricao: 'Visor de câmera: moldura com dados de exposição, título datilografado, legenda mono em barra preta, clarão de luz e tela dividida.',
  quadros: [0.15, 1.2, 2.9, 4.9, 7.3, 8.3, 12.5],
  capa: 1.3,
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { leg: { arquivo: 'SpaceMono-Bold.ttf', style: 'Bold', size: 40, tracking: 20, allCaps: true },
      titulo: { arquivo: 'Inter.ttf', style: 'Black', size: 130, tracking: -30 },
      hud: { arquivo: 'SpaceMono-Bold.ttf', style: 'Bold', size: 26, tracking: 60, allCaps: true } };
    let mono = P.fonte(est.leg.arquivo), sans = P.fonte(est.titulo.arquivo);
    // letra de cada texto: o título na principal e os textos mono (legenda, exposição, laterais) na mono da marca, ou a do estilo
    if (marca) {
      const tt = temaMarca.letra(P, marca, 'principal', est.titulo);
      if (tt) { sans = tt.fonte; est.titulo = tt.est; }
      for (const k of ['leg', 'hud']) {
        const m = temaMarca.letra(P, marca, 'mono', est[k]);
        if (m) { mono = m.fonte; est[k] = m.est; }
      }
    }
    P.importaImagem('luz', TEX('luz'));
    // C0: a paleta do estilo (marinho e o acento quente); com a marca, o escuro e o acento dela. O acento sobre o vídeo (título e
    // exposição) pede 4,5:1 contra o escuro da marca (sem escuro na marca, contra o marinho); senão, volta à cor do estilo
    const C0 = { escuro: [0.11, 0.16, 0.29, 1], acento: [0.96, 0.62, 0.22, 1] };
    const C = { escuro: C0.escuro, acento: acento || C0.acento };
    if (marca) for (const k of ['escuro', 'acento']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    let ACENTO = C.acento;
    if (marca && !ACENTO.every((v, i) => v === C0.acento[i]) && !temaMarca.contrasteOk(ACENTO, C.escuro, 4.5)) {
      console.warn('[marca] título e exposição: o acento sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
      ACENTO = C0.acento;
    }
    const MARINHO = C.escuro, BRANCO = [1, 1, 1, 1];
    // com a letra da marca, os textos de uma lista encolhem juntos, 15% por vez, até o mais largo caber no limite (piso:
    // 40% do corpo, no mínimo 16 px). Sem marca não mede nada a mais
    const noPiso = new Set();
    const avisaPiso = (tx) => { if (!noPiso.has(tx)) { noPiso.add(tx); console.warn(`[marca] o texto "${tx}" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.`); } };
    const cabe = (textos, e, limite) => {
      const piso = Math.max(16, e.size * 0.4);
      for (let f = 1; ; f *= 0.85) {
        const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) };
        let m = null;
        try { m = P.medir(textos, ef); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        if (m && Math.max(0, ...Object.values(m).map((x) => x.w)) <= limite) return { e: ef, m };
        if (e.size * f * 0.85 < piso) {
          if (m) { // no piso: fica o menor corpo medido, mesmo sem caber, e o log diz qual texto sai da tela
            avisaPiso(Object.entries(m).sort((p, q) => q[1].w - p[1].w)[0][0]);
            return { e: ef, m };
          }
          throw new Error(`marca: o texto "${[...textos].sort((p, q) => q.length - p.length)[0]}" não cabe na tela nem com 40% do corpo da letra.`);
        }
      }
    };
    const ESC = 88; // escala do vídeo dentro da moldura
    const [principal, secundaria] = cenas;
    const janelaDividida = principal ? [principal.ini * 1000, principal.fim * 1000] : null;

    // moldura: fundo marinho e o vídeo reduzido, que abre de um quadro pequeno
    P.ret('fundo', 0, DUR, [0, 0], [1080, 1920], MARINHO);
    const trechosVideo = janelaDividida ? [[0, janelaDividida[0]], [janelaDividida[1], DUR]] : [[0, DUR]];
    trechosVideo.forEach(([a, z], k) => {
      const v = P.video('video', a, z, { volume: 1, durFonte: DUR, src0: a, escala: ESC });
      P.mascara(v, retArredondado(0, 0, 1080, 1920, 36));
      if (k === 0) P.kfEscala(v, [[0, 18], [420, ESC, EASE.saida]]);
    });
    // B-roll secundário: imagem dentro da moldura, no lugar do vídeo
    if (secundaria) {
      const img = P.imagem(secundaria.id, secundaria.ini * 1000, secundaria.fim * 1000, [540, 960], { escala: ESC, fit: 'cover' });
      P.mascara(img, retArredondado(0, 0, 1080, 1920, 36));
    }

    // tela dividida: pessoa no painel de cima, imagem no de baixo, texto vertical nas laterais
    if (janelaDividida) {
      const [a, z] = janelaDividida;
      const s = 0.85;
      // painel de cima mostra a região do rosto, com a cabeça inteira no centro (rostoY = centro da cabeça no vídeo de origem)
      const rostoY = (pedido.rosto && pedido.rosto.y) ?? 620;
      const v = P.video('video-painel', a, z, { volume: 1, durFonte: DUR, src0: a, escala: s * 100, pos: [540, 560 - (rostoY - 960) * s] });
      P.mascara(v, retArredondado(540 - 529, rostoY - 364, 1059, 729, 26));
      const img = P.imagem(principal.id, a, z, [540, 1230], { escala: s * 100, fit: 'cover' });
      P.mascara(img, retArredondado(540 - 529, 960 - 364, 1059, 729, 26));
      P.kfPos(img, [[0, [540, 1330]], [380, [540, 1230], EASE.saida]]);
      const faixa = ((pedido.chamada && pedido.chamada.texto) || 'em foco').toUpperCase() + '  ·  ';
      [[50, -90, 1], [1030, 90, -1]].forEach(([x, rot, dir]) => {
        const t = P.texto('lateral', a, z, [x, 960], { text: faixa.repeat(4), fontFamily: mono.family, fontStyle: est.hud.style, fontSize: 26, tracking: 120,
          fillColor: [ACENTO[0], ACENTO[1], ACENTO[2], 0.7], justification: 'center', boxText: true, boxPosition: [0, 0], boxSize: [3000, 40], verticalAlign: 'center' },
        [1500, 20], { rot });
        P.kfPos(t, [[0, [x, 960 - 200 * dir]], [z - a, [x, 960 + 200 * dir], EASE.linear]]);
      });
    }

    // cantoneiras do visor e dados de exposição
    const L = 70, E = 5, x0 = 540 - 540 * ESC / 100 + 40, x1 = 540 + 540 * ESC / 100 - 40, y0 = 960 - 960 * ESC / 100 + 40, y1 = 960 + 960 * ESC / 100 - 40;
    // fora da tela dividida (antes e depois dela)
    trechosVideo.forEach(([ta, tz]) => [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, dx, dy]) => {
      P.forma('cantoneira', ta, tz, { commands: [{ type: 'moveTo', x, y: y + L * dy }, { type: 'lineTo', x, y }, { type: 'lineTo', x: x + L * dx, y }] },
        { traco: [1, 1, 1, 0.85], largura: E, cap: 'square' });
    }));
    trechosVideo.forEach(([ta, tz]) => P.texto('hud', ta, tz, [540, y1 + 24], { text: '1/60     f2.8     ISO 400     ● REC', fontFamily: mono.family, fontStyle: est.hud.style, fontSize: est.hud.size,
      tracking: est.hud.tracking, fillColor: [ACENTO[0], ACENTO[1], ACENTO[2], 1], justification: 'center', boxText: true, boxPosition: [0, 0], boxSize: [1000, 40], verticalAlign: 'top' }, [500, 0]));

    // título datilografado no topo
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      const palavra = ch.palavra || ch.texto.split(' ')[0];
      // com a letra da marca, o título encolhe até caber na moldura (de x0 + 30 até a cantoneira da direita)
      const estT = marca ? cabe([palavra], est.titulo, Math.round(x1 - x0 - 30)).e : est.titulo;
      const t = P.texto('titulo', a, z, [x0 + 30, y0 + 50], { text: palavra[0], fontFamily: sans.family, fontStyle: estT.style, fontSize: estT.size, tracking: estT.tracking,
        fillColor: ACENTO, justification: 'left', boxText: true, boxPosition: [0, 0], boxSize: [1000, 200], verticalAlign: 'top' });
      t.dropShadow = { color: [0, 0, 0, 0.45], blurRadius: 20, spreadRadius: 0, blendMode: 'normal', offset: [0, 6] };
      P.kf(t, 'textContent', [...palavra].map((_, i) => [i * 70, palavra.slice(0, i + 1)]));
      P.fade(t, 'none', 'fade');
    }

    // legenda: barra preta do tamanho da frase inteira; as palavras aparecem conforme a fala
    const grupos = agrupa(palavras, { maxPalavras: 3, maxChars: 20 });
    // com a letra da marca, todas as frases encolhem juntas até a barra (texto + 36 px) caber na moldura, a partir de x0 + 40
    const textosLeg = grupos.map((g) => g.texto.toUpperCase());
    const { e: estL, m: med } = marca ? cabe(textosLeg, est.leg, Math.round(x1 + 40 - (x0 + 40) - 36)) : { e: est.leg, m: P.medir(textosLeg, est.leg) };
    for (const g of grupos) {
      const dividida = janelaDividida && g.ini < janelaDividida[1] && g.fim > janelaDividida[0];
      const m = med[g.texto.toUpperCase()];
      const x = dividida ? 540 - (m.w + 36) / 2 : x0 + 40, y = dividida ? 1660 : 1300;
      P.ret('barra', g.ini, g.fim, [x, y], [m.w + 36, 64], [0.03, 0.03, 0.04, 0.92]);
      const t = P.texto('leg-' + g.texto, g.ini, g.fim, [x + 18 - m.x0, y + 32 - (m.top + m.bottom) / 2],
        comVar({ ...docLinha(mono, estL), text: g.palavras[0].w.replace(/[.,!?;:]+$/, ''), fillColor: BRANCO }));
      const keys = g.palavras.map((p, i) => [p.ini - g.ini, g.palavras.slice(0, i + 1).map((q) => q.w.replace(/[.,!?;:…]+$/u, '')).join(' ')]);
      if (keys.length > 1) P.kf(t, 'textContent', keys);
    }

    // clarão de luz nas viradas
    const viradas = cenas.flatMap((b) => [b.ini * 1000, b.fim * 1000]);
    viradas.push(240);
    for (const t of viradas) {
      const l = P.imagem('luz', Math.max(0, t - 300), Math.min(DUR, t + 380), [540, 960], { fit: 'cover' });
      l.blendMode = 'screen';
      P.kf(l, 'opacity', [[0, 0], [260, 100, EASE.saida], [680, 0, EASE.suave]]);
      P.kfPos(l, [[0, [380, 1060]], [680, [700, 860], EASE.linear]]);
    }
  },
};
