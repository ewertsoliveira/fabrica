// Caderno: anotado à mão. Título com um laço que se desenha em volta, legenda manuscrita que acende palavra por palavra,
// pincelada escura atrás das frases com destaque e, no B-roll, a imagem colada numa folha pautada com o apresentador em círculo.
// Marca (ctx.marca, do tema-marca.js): o giz do título e do laço segue o acento, como já fazia a cor de acento do pedido; a
// legenda de mão sobre o vídeo vai no claro da empresa (só com a cor de acento no pedido, no acento, como já era); a tinta
// azul da folha vira o escuro. A folha e a pincelada são texturas do estilo e ficam.
// O título usa a letra principal; a letra de mão fica a do estilo, com qualquer marca (é o jeito do estilo: só as cores
// mudam). Com a letra da marca, os textos encolhem até caber; texto sem contraste volta à cor do estilo, com aviso no log.
// Com ou sem marca: a frase que atravessa a borda da folha troca de cor na borda (a tinta nunca fica sobre o vídeo), e o
// título fica em y 1385, com o laço longe do queixo.
const path = require('path');
const { agrupa, EASE, hex, limpa, laco, elipse } = require('../motor');
const { linhaProgressiva, ehDestaque, ancora, docLinha, comVar, pessoaEmJanela, enquadre } = require('./_comum');
const temaMarca = require('../tema-marca');

const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');
// cor do meio da folha pautada (amostrada do PNG gerado por gerar-texturas.js), para conferir o contraste da tinta
const FOLHA = [243 / 255, 241 / 255, 235 / 255, 1];

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Caderno',
  descricao: 'Anotado à mão: título com laço desenhado, legenda manuscrita, pincelada e apresentador em círculo sobre a folha.',
  quadros: [0.35, 0.9, 2.6, 4.9, 7.2, 8.4, 13.2],
  capa: 1.0, // segundo usado como capa na galeria
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { mao: { arquivo: 'Caveat.ttf', style: 'Bold', size: 92 },
      titulo: { arquivo: 'Inter.ttf', style: 'Black', size: 150, tracking: -40, allCaps: true } };
    const caveat = P.fonte(est.mao.arquivo);
    let sans = P.fonte(est.titulo.arquivo);
    // letra de cada texto: o título na principal da marca, ou a do estilo; a letra de mão fica sempre a do estilo
    if (marca) {
      const tt = temaMarca.letra(P, marca, 'principal', est.titulo);
      if (tt) { sans = tt.fonte; est.titulo = tt.est; }
    }
    ['pincel', 'papel-caderno'].forEach((n) => P.importaImagem(n, TEX(n)));
    // C0: a paleta do estilo (giz branco e tinta azul); C: com a marca. O giz sobre o vídeo pede 4,5:1 contra o escuro da
    // marca (sem escuro na marca, contra a tinta); a tinta sobre a folha, 3:1. Senão, a cor do estilo, com aviso no log
    const C0 = { acento: [1, 1, 1, 1], escuro: [0.11, 0.13, 0.2, 1] };
    const C = { acento: acento || C0.acento, escuro: C0.escuro };
    if (marca) for (const k of ['acento', 'escuro']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    const mudou = (k) => !C[k].every((v, i) => v === C0[k][i]);
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    let GIZ = C.acento, TINTA = C.escuro;
    if (marca && mudou('acento') && !temaMarca.contrasteOk(GIZ, C.escuro, 4.5)) {
      avisa('título e legenda: o acento sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
      GIZ = C0.acento;
    }
    // a legenda de mão sobre o vídeo (texto fino) vai no claro da marca, quando ela tem; o acento fica no título e no laço
    let GIZ_LEG = GIZ;
    if (marca && marca.cores.claro) {
      GIZ_LEG = hex(marca.cores.claro);
      if (!temaMarca.contrasteOk(GIZ_LEG, C.escuro, 4.5)) {
        avisa('legenda: o "claro" sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
        GIZ_LEG = C0.acento;
      }
    }
    if (marca && mudou('escuro') && !temaMarca.contrasteOk(TINTA, FOLHA, 3)) {
      avisa('folha do B-roll: "escuro" sobre a folha fica sem contraste (abaixo de 3:1) com as cores da marca; usando a cor original do estilo.');
      TINTA = C0.escuro;
    }
    // com a letra da marca, os textos de uma lista encolhem juntos, 15% por vez, até o mais largo caber no limite (piso:
    // 40% do corpo, no mínimo 16 px). Sem marca, só mede, como sempre
    const avisaPiso = (tx) => avisa(`o texto "${tx}" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.`);
    const cabe = (textos, e, limite) => {
      if (!marca) return { e, m: P.medir(textos, e) };
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
    const sombra = { color: [0, 0, 0, 0.55], blurRadius: 16, spreadRadius: 0, blendMode: 'normal', offset: [0, 4] };

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // B-roll: folha pautada, imagem colada levemente torta e o apresentador num círculo no canto
    const janelas = [];
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000;
      janelas.push([a, z]);
      P.imagem('papel-caderno', a, z, [540, 960]);
      const img = P.imagem(b.id, a, z, [540, 1110], { escala: 78, rot: -3, fit: 'cover' });
      img.dropShadow = { color: [0, 0, 0, 0.2], blurRadius: 30, spreadRadius: 0, blendMode: 'normal', offset: [6, 12] };
      P.fade(img, 'softRise', 'none');
      // apresentador em círculo: o mesmo vídeo, reduzido e mascarado. A cabeça fica acima do centro, com folga em cima, e
      // o queixo longe da borda; sobram pescoço e ombros dentro do círculo
      const cx = 710, cy = 420, r = 250;
      const rosto = pedido.rosto || {};
      const enq = enquadre({ cx, cy, r }, rosto.y ?? 600, { cabeca: rosto.cabeca });
      const circ = pessoaEmJanela(P, a, z, { cx, cy, r }, { ...enq, durFonte: DUR, nome: 'circulo' });
      P.kfEscala(circ, [[0, 0], [380, enq.escala, EASE.mola]]);
      const anel = P.forma('circulo-anel', a + 200, z, laco(cx, cy, r + 14, r + 10, 1.05, 11), { traco: TINTA, largura: 6, trim: 0 });
      P.kf(anel, 'trimEnd', [[0, 0], [500, 100, EASE.suave]]);
    }

    // título com laço desenhado em volta. Fica em y 1385 (antes 1300, quando o alto do laço encostava no queixo): a legenda
    // espera o título sair, então ela não precisa descer junto
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = Math.min(ch.fim * 1000, 2400);
      const Y = 1385;
      const palavra = (ch.palavra || ch.texto.split(' ')[0]).toUpperCase() + '?';
      // com a letra da marca, o título encolhe até ele e o laço (70 px de cada lado) caberem em 1000 px
      const { e: estT, m: mTs } = cabe([palavra], est.titulo, 860);
      const m = mTs[palavra];
      const t = P.texto('titulo', a, z, [540, Y], comVar({ ...docLinha(sans, estT), text: palavra, fillColor: GIZ }), ancora(m));
      t.dropShadow = sombra;
      P.fade(t, 'pop', 'fade');
      const l = P.forma('titulo-laco', a + 150, z, laco(540, Y, m.w / 2 + 70, (m.bottom - m.top) / 2 + 55, 1.12, 5), { traco: GIZ, largura: 7, trim: 0 });
      l.dropShadow = sombra;
      P.kf(l, 'trimEnd', [[0, 0], [520, 100, EASE.suave]]);
      P.fade(l, 'none', 'fade');
    }

    // legenda manuscrita; pincelada atrás das frases que têm destaque
    const destaque = ehDestaque(pedido);
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 22 });
    // com a letra da marca, todas as frases encolhem juntas até a mais larga caber em 936 px
    const { e: estM, m: med } = cabe(grupos.map((g) => g.texto), est.mao, 936);
    const fimTitulo = ch ? Math.min(ch.fim * 1000, 2400) : 0;
    for (const g of grupos) {
      if (g.fim <= fimTitulo + 80) continue; // durante o título a fala aparece no próprio título
      const a = Math.max(g.ini, fimTitulo);
      const naFolha = janelas.some(([x, y]) => a < y && g.fim > x);
      const cy = naFolha ? 1560 : 1330;
      if (!naFolha && g.palavras.some((p) => destaque(p.w))) {
        const m = med[g.texto];
        const p = P.imagem('pincel', a, g.fim, [540, cy + 6]);
        p.transform.scale = [Math.min(110, (m.w + 120) / 1000 * 100), 100];
        p.transform.anchorPoint = [20, 100];
        p.transform.position = [540 - (m.w + 120) / 2, cy + 6];
        P.kf(p, 'scaleX', [[0, 0], [220, Math.min(110, (m.w + 120) / 1000 * 100), EASE.saida]]);
      }
      const [x, y] = janelas.find(([p, q]) => a < q && g.fim > p) || [];
      if (!naFolha || (a >= x && g.fim <= y)) {
        linhaProgressiva(P, { ...g, ini: a }, { fonte: caveat, estilo: estM, medida: med, cy, cor: naFolha ? TINTA : GIZ_LEG, sombra: naFolha ? null : sombra, nome: 'mao' });
        continue;
      }
      // a frase que atravessa a borda da folha troca de cor na borda (tinta sobre a folha, a cor clara com sombra sobre o
      // vídeo), para nunca ficar escura sobre o vídeo (com ou sem marca)
      for (const [a0, z0, folha] of [[a, x, false], [x, y, true], [y, g.fim, false]]) {
        const [a1, z1] = [Math.max(a0, a), Math.min(z0, g.fim)];
        if (z1 - a1 < 1) continue;
        const ditas = g.palavras.filter((p) => p.ini < a1), resto = g.palavras.filter((p) => p.ini >= a1 && p.ini < z1);
        const pals = ditas.length ? [{ w: ditas.map((p) => limpa(p.w)).join(' '), ini: a1 }, ...resto] : resto;
        if (!pals.length) continue;
        linhaProgressiva(P, { ...g, ini: a1, palavras: pals }, { fonte: caveat, estilo: estM, medida: med, cy, a: a1, z: z1,
          cor: folha ? TINTA : GIZ_LEG, sombra: folha ? null : sombra, nome: 'mao' });
      }
    }
  },
};
