// Vitrine: editorial e limpo. Legenda fina que acende palavra por palavra; a palavra de destaque entra grande,
// em itálico pesado, saindo do desfoque. B-roll em tela cheia com chicote lateral e em cartão sobre o fundo desfocado.
// Marca (ctx.marca, do tema-marca.js): o destaque vira o acento da empresa; o branco da legenda e a tinta escura sobre a
// imagem clara são cores fixas e ficam. A legenda fina usa a letra principal; o destaque em itálico, a principal só se ela
// tiver itálico (senão, a letra de acento da marca ou a itálica do estilo). Com a letra da marca, os textos encolhem até
// caber; o destaque sem contraste sobre o vídeo volta à cor do estilo, com aviso no log. Com ou sem marca, a frase (e o
// destaque) que atravessa a borda do B-roll de tela cheia troca de cor na borda: a tinta escura nunca fica sobre o vídeo.
const { agrupa, EASE, hex, limpa, retArredondado } = require('../motor');
const { linhaProgressiva, ehDestaque, separaDestaques, desfoca, ancora, docLinha, comVar, pessoaRedonda } = require('./_comum');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Vitrine',
  descricao: 'Editorial: legenda fina palavra por palavra, destaque em itálico pesado, fundo que desfoca e B-roll em cartão.',
  quadros: [1.0, 2.6, 3.3, 4.9, 6.95, 7.8, 13.3],
  capa: 4.95, // segundo usado como capa na galeria
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const arq = { fino: { arquivo: 'Inter.ttf', style: 'Light', size: 66, tracking: -10 },
      forte: { arquivo: 'Inter-Italic.ttf', style: 'Black Italic', size: 150, tracking: -30 } };
    let fonteFina = P.fonte(arq.fino.arquivo), fonteForte = P.fonte(arq.forte.arquivo);
    // letra de cada texto: a fina vira a principal; o destaque (itálico) vai para a principal só se ela tiver itálico,
    // senão para a letra de acento da marca (sem ela, fica a itálica do estilo)
    if (marca) {
      const italico = temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
      const fina = temaMarca.letra(P, marca, 'principal', arq.fino);
      if (fina) { fonteFina = fina.fonte; arq.fino = fina.est; }
      const forte = temaMarca.letra(P, marca, italico ? 'principal' : 'acento', arq.forte);
      if (forte) { fonteForte = forte.fonte; arq.forte = forte.est; }
    }
    const BRANCO = [1, 1, 1, 1];
    // sobre o B-roll de tela cheia (fundo claro) a legenda fica escura e sem sombra (cor fixa, como o branco)
    const ESCURO = [0.08, 0.08, 0.1, 1];
    // C0: o destaque do estilo; com a marca, o acento dela. Sobre o vídeo, o destaque pede 4,5:1 contra o escuro da marca
    // (sem escuro na marca, contra a tinta escura fixa); senão, volta à cor do estilo, com aviso no log
    const DESTAQUE0 = [0.88, 0.92, 0.96, 1];
    let DESTAQUE = acento || DESTAQUE0;
    if (marca && marca.cores.acento) DESTAQUE = hex(marca.cores.acento);
    const refEscuro = marca && marca.cores.escuro ? hex(marca.cores.escuro) : ESCURO;
    if (marca && !DESTAQUE.every((v, i) => v === DESTAQUE0[i]) && !temaMarca.contrasteOk(DESTAQUE, refEscuro, 4.5)) {
      console.warn('[marca] destaque: o acento sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
      DESTAQUE = DESTAQUE0;
    }
    // com a letra da marca, as frases de uma lista encolhem juntas, 15% por vez, até a mais larga caber no limite (piso:
    // 40% do corpo, no mínimo 16 px). Sem marca, só mede, como sempre
    const noPiso = new Set();
    const avisaPiso = (tx) => { if (!noPiso.has(tx)) { noPiso.add(tx); console.warn(`[marca] o texto "${tx}" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.`); } };
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
    const sombra = { color: [0, 0, 0, 0.45], blurRadius: 24, spreadRadius: 0, blendMode: 'normal', offset: [0, 4] };

    // fundo
    const video = P.video('video', 0, DUR, { volume: 1, durFonte: DUR });
    const blurId = P.efeito(video, { type: 'gaussianBlur', blurriness: 0, repeatEdgePixels: true });
    const blurKeys = [[0, 0]];
    const desfocaFundo = (a, z) => blurKeys.push([a, 0, EASE.linear], [a + 220, 38, EASE.saida], [z - 200, 38, EASE.linear], [z, 0, EASE.suave]);

    // B-roll: o primeiro em tela cheia (chicote), o segundo em cartão
    const [cheia, cartao] = cenas;
    if (cheia) {
      const a = cheia.ini * 1000, z = cheia.fim * 1000;
      const img = P.imagem(cheia.id, a, z, [540, 1070], { fit: 'cover', escala: 112 });
      P.kfPos(img, [[0, [1620, 1070]], [260, [540, 1070], EASE.saida], [z - a - 260, [540, 1070], EASE.linear], [z - a, [-540, 1070], EASE.entrada]]);
      const db = P.efeito(img, { type: 'directionalBlur', direction: 90, blurLength: 90 });
      P.kfEfeito(img, db, 'blurLength', [[0, 90], [260, 0, EASE.saida], [z - a - 260, 0, EASE.linear], [z - a, 90, EASE.entrada]]);
      // o apresentador continua em cena: num círculo no alto, que entra quando a imagem assenta e sai antes do chicote
      const rosto = pedido.rosto || {};
      pessoaRedonda(P, a + 450, z - 300, { cx: 540, cy: 400, r: 240 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { cor: [1, 1, 1, 1], largura: 8 } }).forEach((c) => P.fade(c, 'fade', 'fade'));
    }
    if (cartao) {
      const a = cartao.ini * 1000, z = cartao.fim * 1000;
      desfocaFundo(a, z);
      const img = P.imagem(cartao.id, a, z, [540, 720], { escala: 50, fit: 'cover' });
      P.mascara(img, retArredondado(0, 0, 1080, 1920, 70));
      img.dropShadow = { color: [0, 0, 0, 0.35], blurRadius: 60, spreadRadius: 0, blendMode: 'normal', offset: [0, 24] };
      P.kfPos(img, [[0, [540, 2500]], [480, [540, 720], EASE.saida]]);
      P.fade(img, 'none', 'fade');
    }

    // legendas
    const destaque = ehDestaque(pedido);
    const grupos = separaDestaques(agrupa(palavras, { maxPalavras: 3, maxChars: 20 }), destaque);
    // destaque logo depois de uma linha fina: as duas ficam juntas (fina em cima, destaque embaixo)
    grupos.forEach((g, i) => {
      const prev = grupos[i - 1];
      if (g.destaque && prev && !prev.destaque && g.ini - prev.palavras[prev.palavras.length - 1].fim < 450) {
        prev.fim = g.fim; prev.cy = 1150; g.cy = 1290;
      }
    });
    const finas = grupos.filter((g) => !g.destaque);
    // com a letra da marca, a fina e o destaque encolhem cada um até caber em 936 px
    const { e: estFina, m: medFina } = cabe(finas.map((g) => g.texto), arq.fino, 936);
    const { e: estForte, m: medForte } = cabe(grupos.filter((g) => g.destaque).map((g) => g.texto), arq.forte, 936);
    const sobreCheia = (g) => cheia && g.ini < cheia.fim * 1000 && g.fim > cheia.ini * 1000;
    let nDestaque = 0;
    for (const g of grupos) {
      const cy = (g.cy || 1265) + (sobreCheia(g) ? 105 : 0);
      if (!g.destaque) {
        const ini = cheia && cheia.ini * 1000, fim = cheia && cheia.fim * 1000;
        if (!sobreCheia(g) || (g.ini >= ini && g.fim <= fim)) {
          linhaProgressiva(P, g, { fonte: fonteFina, estilo: estFina, medida: medFina, cy, cor: sobreCheia(g) ? ESCURO : BRANCO, sombra: sobreCheia(g) ? null : sombra, nome: 'fina' });
          continue;
        }
        // a frase que atravessa a borda do B-roll de tela cheia troca de cor na borda (tinta escura sobre a imagem, branco
        // com sombra sobre o vídeo), para nunca ficar escura sobre o vídeo (com ou sem marca)
        for (const [a, z, naImagem] of [[g.ini, ini, false], [ini, fim, true], [fim, g.fim, false]]) {
          const [a1, z1] = [Math.max(a, g.ini), Math.min(z, g.fim)];
          if (z1 - a1 < 1) continue;
          const ditas = g.palavras.filter((p) => p.ini < a1), resto = g.palavras.filter((p) => p.ini >= a1 && p.ini < z1);
          const pals = ditas.length ? [{ w: ditas.map((p) => limpa(p.w)).join(' '), ini: a1 }, ...resto] : resto;
          if (!pals.length) continue;
          linhaProgressiva(P, { ...g, palavras: pals }, { fonte: fonteFina, estilo: estFina, medida: medFina, cy, a: a1, z: z1,
            cor: naImagem ? ESCURO : BRANCO, sombra: naImagem ? null : sombra, nome: 'fina' });
        }
        continue;
      }
      // destaque: entra a 125% e desfocado, assenta em 100%
      const m = medForte[g.texto];
      // o destaque que atravessa a borda do B-roll de tela cheia troca de cor na borda, como as frases finas (tinta escura
      // sobre a imagem, o destaque com sombra sobre o vídeo); a entrada animada fica só no primeiro trecho
      const ini = cheia && cheia.ini * 1000, fim = cheia && cheia.fim * 1000;
      const trechos = !sobreCheia(g) || (g.ini >= ini && g.fim <= fim) ? [[g.ini, g.fim, sobreCheia(g)]]
        : [[g.ini, ini, false], [ini, fim, true], [fim, g.fim, false]]
          .map(([a, z, naImagem]) => [Math.max(a, g.ini), Math.min(z, g.fim), naImagem]).filter(([a, z]) => z - a >= 1);
      trechos.forEach(([a, z, naImagem], k) => {
        const c = P.texto('destaque-' + g.texto, a, z, [540, cy],
          comVar({ ...docLinha(fonteForte, estForte), text: g.texto, fillColor: naImagem ? ESCURO : DESTAQUE }), ancora(m));
        if (!naImagem) c.dropShadow = sombra;
        if (k) return;
        P.kfEscala(c, [[0, 125], [260, 100, EASE.saida]]);
        P.kf(c, 'opacity', [[0, 0], [160, 100, EASE.saida]]);
        desfoca(P, c, [[0, 16], [260, 0, EASE.saida]]);
      });
      // o fundo desfoca em um destaque sim, outro não, fora dos B-rolls
      const livre = !cenas.some((b) => g.ini < b.fim * 1000 && g.fim > b.ini * 1000);
      if (livre && nDestaque++ % 2 === 0) desfocaFundo(g.ini, Math.max(g.fim, g.ini + 700));
    }
    blurKeys.sort((p, q) => p[0] - q[0]);
    P.kfEfeito(video, blurId, 'blurriness', blurKeys.filter((k, i) => i === 0 || k[0] > blurKeys[i - 1][0]));
  },
};
