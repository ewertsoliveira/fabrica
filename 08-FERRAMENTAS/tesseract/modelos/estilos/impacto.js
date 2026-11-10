// Impacto: direto e energético. Caixa alta condensada na cor de acento, destaque enorme em branco,
// abertura saindo do desfoque, falha cromática nos cortes e uma tela de grade deformada para a palavra final.
// Marca (ctx.marca, do tema-marca.js): a legenda e o anel da pessoa viram o acento da empresa; o branco do destaque, o
// preto e a grade branca da tela final e o véu são cores fixas e ficam. As duas letras viram a principal, sempre em caixa
// alta (a condensada do estilo só tem maiúsculas; a força do estilo é a caixa alta). Com a letra da marca (que pode ser bem
// mais larga que a condensada do estilo), a legenda e o destaque encolhem juntos até caber; a
// legenda sem contraste volta à cor do estilo, com aviso no log. Sem marca, nada muda.
const { agrupa, EASE, hex } = require('../motor');
const { linhaProgressiva, ehDestaque, separaDestaques, desfoca, ancora, docLinha, comVar, pessoaRedonda } = require('./_comum');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Impacto',
  descricao: 'Caixa alta condensada, destaque gigante, falha cromática nos cortes e tela de grade para a palavra final.',
  quadros: [0.2, 1.2, 2.55, 4.85, 7.0, 8.4, 13.3],
  capa: 2.7, // segundo usado como capa na galeria
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { normal: { arquivo: 'BebasNeue-Regular.ttf', style: 'Regular', size: 108, tracking: 20 },
      grande: { arquivo: 'BebasNeue-Regular.ttf', style: 'Regular', size: 200, tracking: 10 } };
    const bebas = P.fonte(est.normal.arquivo);
    // letra de cada texto: a principal da marca, em caixa alta (como a condensada do estilo), ou a condensada do estilo
    const F = { normal: bebas, grande: bebas };
    if (marca) for (const k of ['normal', 'grande']) {
      const m = temaMarca.letra(P, marca, 'principal', est[k]);
      if (m) { F[k] = m.fonte; est[k] = { ...m.est, allCaps: true }; }
    }
    // C0: o acento do estilo; com a marca, o dela. A legenda no acento pede 4,5:1 sobre o vídeo, contra o escuro da marca
    // (sem escuro na marca, contra o preto), e 3:1 sobre o preto da tela final; senão, volta à cor do estilo, com aviso
    const ACENTO0 = [0.18, 0.77, 0.95, 1], PRETO = [0, 0, 0, 1];
    let ACENTO = acento || ACENTO0;
    if (marca && marca.cores.acento) ACENTO = hex(marca.cores.acento);
    const mudou = !ACENTO.every((v, i) => v === ACENTO0[i]);
    const refEscuro = marca && marca.cores.escuro ? hex(marca.cores.escuro) : PRETO;
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const corNoVideo = !marca || !mudou || temaMarca.contrasteOk(ACENTO, refEscuro, 4.5) ? ACENTO
      : (avisa('legenda: o acento sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.'), ACENTO0);
    const corNaTela = !marca || !mudou || temaMarca.contrasteOk(ACENTO, PRETO, 3) ? ACENTO
      : (avisa('legenda na tela final: o acento sobre o preto fica sem contraste (abaixo de 3:1) com as cores da marca; usando a cor original do estilo.'), ACENTO0);
    // com a letra da marca, os estilos de uma lista encolhem juntos, 15% por vez, até o texto mais largo caber no limite
    // (piso: 40% do corpo, no mínimo 16 px, ou o piso pedido). Sem marca, só mede, como sempre
    const cabe = (lista, limite, piso = Math.max(16, lista[0].e.size * 0.4)) => {
      const mede = (f) => lista.map(({ textos, e }) => { const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) }; return { e: ef, m: P.medir(textos, ef) }; });
      if (!marca) return { f: 1, r: mede(1) };
      for (let f = 1; ; f *= 0.85) {
        let r = null;
        try { r = mede(f); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        if (r && Math.max(0, ...r.flatMap(({ m }) => Object.values(m).map((x) => x.w))) <= limite) return { f, r };
        if (lista[0].e.size * f * 0.85 < piso) {
          if (r) { // no piso: fica o menor corpo medido, mesmo sem caber, e o log diz qual texto sai da tela
            const tx = r.flatMap(({ m }) => Object.entries(m)).sort((p, q) => q[1].w - p[1].w)[0][0];
            avisa(`o texto "${tx}" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.`);
            return { f, r };
          }
          throw new Error(`marca: o texto "${lista.flatMap((x) => x.textos).sort((p, q) => q.length - p.length)[0]}" não cabe na tela nem com 40% do corpo da letra.`);
        }
      }
    };
    const BRANCO = [1, 1, 1, 1];
    const sombra = { color: [0, 0, 0, 0.6], blurRadius: 16, spreadRadius: 0, blendMode: 'normal', offset: [0, 5] };
    const falhas = []; // instantes (ms) com pico de aberração cromática

    // abertura: sai do desfoque
    const video = P.video('video', 0, DUR, { volume: 1, durFonte: DUR });
    desfoca(P, video, [[0, 60], [550, 0, EASE.saida]]);

    // B-roll em tela cheia, corte seco marcado pela falha
    for (const b of cenas) {
      const a = b.ini * 1000, z = b.fim * 1000;
      P.imagem(b.id, a, z, [540, 1070], { fit: 'cover', escala: 112 });
      // véu escuro: a legenda clara precisa de contraste sobre cenas claras
      P.ret('broll-veu', a, z, [0, 0], [1080, 1920], [0, 0, 0, 0.42]);
      // o apresentador continua em cena, num círculo com borda de acento, no alto (o véu não passa por cima dele)
      const rosto = pedido.rosto || {};
      pessoaRedonda(P, a + 200, z, { cx: 540, cy: 400, r: 240 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { cor: ACENTO, largura: 8 } }).forEach((c) => P.fade(c, 'fade', 'none'));
      falhas.push(a, z);
    }

    // tela da palavra final: fundo preto, grade branca deformada por lente
    const tela = pedido.palavraTela;
    let jTela = null;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000);
      jTela = [a, z];
      P.ret('grade-fundo', a, z, [0, 0], [1080, 1920], [0, 0, 0, 1]);
      for (let x = 0; x <= 1080; x += 120) P.ret('grade-v', a, z, [x - 1, 0], [3, 1920], [1, 1, 1, 0.42]);
      for (let y = 0; y <= 1920; y += 120) P.ret('grade-h', a, z, [0, y - 1], [1080, 3], [1, 1, 1, 0.42]);
      const lente = P.ajuste('grade-lente', a, z);
      const bid = P.efeito(lente, { type: 'bulge', centerX: 0.5, centerY: 0.5, horizontalRadius: 0.5, verticalRadius: 0.5, bulgeHeight: 0.2 });
      P.kfEfeito(lente, bid, 'bulgeHeight', [[0, 0.2], [z - a, 1.1, EASE.suave]]);
      falhas.push(a);
    }

    // legendas: destaque sozinho e maior
    const destaque = ehDestaque(pedido);
    const grupos = separaDestaques(agrupa(palavras, { maxPalavras: 3, maxChars: 16 }), destaque);
    // com a letra da marca, todas as frases encolhem juntas até a mais larga caber em 936 px; o destaque gigante (sempre
    // sozinho na tela) encolhe à parte, e pode descer até o piso da legenda
    const { r: [{ e: estN, m: med }] } = cabe([{ textos: grupos.filter((g) => !g.destaque).map((g) => g.texto), e: est.normal }], 936);
    const { r: [{ e: estG, m: medG }] } = cabe([{ textos: grupos.filter((g) => g.destaque).map((g) => g.texto), e: est.grande }], 936,
      Math.max(16, est.normal.size * 0.4));
    const naTela = (g) => jTela && g.ini >= jTela[0];
    for (const g of grupos) {
      const noBroll = cenas.some((b) => g.ini < b.fim * 1000 && g.fim > b.ini * 1000);
      const cy = naTela(g) ? 960 : noBroll ? 1340 : 1200;
      if (!g.destaque) {
        const { camadas } = linhaProgressiva(P, g, { fonte: F.normal, estilo: estN, medida: med, cy, cor: naTela(g) ? corNaTela : corNoVideo, sombra, nome: 'leg' });
        camadas.forEach((c) => { P.kf(c, 'opacity', [[0, 0], [90, 100, EASE.linear]]); P.kfEscala(c, [[0, 108], [180, 100, EASE.saida]]); });
        continue;
      }
      const c = P.texto('grande-' + g.texto, g.ini, g.fim, [540, cy], comVar({ ...docLinha(F.grande, estG), text: g.texto, fillColor: BRANCO }), ancora(medG[g.texto]));
      c.dropShadow = sombra;
      P.kfEscala(c, [[0, 140], [200, 100, EASE.saida]]);
      P.kf(c, 'opacity', [[0, 0], [80, 100, EASE.linear]]);
      falhas.push(g.ini);
    }

    // falha cromática por cima de tudo: picos curtos
    const aj = P.ajuste('falha', 0, DUR);
    const cid = P.efeito(aj, { type: 'chromaticAberration', amount: 0, direction: 0 });
    const keys = [[0, 0]];
    [...new Set(falhas)].sort((p, q) => p - q).forEach((t) => keys.push([t - 60, 0, EASE.linear], [t, 1.4, EASE.linear], [t + 140, 0, EASE.saida]));
    P.kfEfeito(aj, cid, 'amount', keys);
  },
};
