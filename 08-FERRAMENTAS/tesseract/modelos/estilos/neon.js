// Neon: noturno e tecnológico. Moldura neon que se desenha atrás da pessoa, palavra manuscrita brilhante,
// legenda que acende sobre o texto apagado, destaque manuscrito, zoom radial na virada e tela final com a palavra repetida.
// Marca (ctx.marca, do tema-marca.js): o neon vira o acento da empresa (o miolo claro do tubo é o acento clareado na direção
// do branco) e o fundo escuro do painel e da tela, o escuro; o branco da legenda fica. A legenda e a tela final usam a letra
// principal; a manuscrita (título e destaque) fica a do estilo, com qualquer marca (é o jeito do estilo: só as cores mudam).
// Com a letra da marca, os textos encolhem até caber; neon sem contraste volta ao par do estilo, com aviso no log. Sem marca,
// nada muda.
const { agrupa, EASE, hex, retangulo, retArredondado } = require('../motor');
const { linhaProgressiva, ehDestaque, separaDestaques, desfoca, pessoaRecortada, ancora, docLinha, comVar, pessoaRedonda } = require('./_comum');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Neon',
  descricao: 'Moldura neon que se desenha atrás da pessoa, palavra manuscrita brilhante, zoom radial e tela final com a palavra repetida.',
  quadros: [0.3, 1.3, 2.6, 6.75, 7.6, 12.0, 13.4],
  capa: 1.4, // segundo usado como capa na galeria
  montar({ P, DUR, palavras, pedido, cenas, temMatte, acento, marca = null }) {
    const est = { leg: { arquivo: 'Inter.ttf', style: 'ExtraBold', size: 62, tracking: -15 },
      script: { arquivo: 'KaushanScript-Regular.ttf', style: 'Regular', size: 120 },
      titulo: { arquivo: 'KaushanScript-Regular.ttf', style: 'Regular', size: 200 },
      tela: { arquivo: 'Inter.ttf', style: 'Black', size: 230, tracking: -20, allCaps: true } };
    const sans = P.fonte(est.leg.arquivo), kaushan = P.fonte(est.script.arquivo);
    // letra de cada texto: a principal da marca na legenda e na tela, ou a do estilo; a manuscrita fica sempre a do estilo
    const F = { leg: sans, script: kaushan, titulo: kaushan, tela: sans };
    if (marca) for (const [k, papel] of [['leg', 'principal'], ['tela', 'principal']]) {
      const m = temaMarca.letra(P, marca, papel, est[k]);
      if (m) { F[k] = m.fonte; est[k] = m.est; }
    }
    // C0: a paleta do estilo (neon ciano e o escuro do painel); C: a paleta em uso, com a marca. O miolo claro do tubo
    // (MIOLO0) é um tom do neon: com a marca, é o acento dela clareado na direção do branco
    const C0 = { acento: [0.45, 0.96, 1, 1], escuro: [0.035, 0.07, 0.085, 1] };
    const MIOLO0 = { titulo: [0.85, 1, 1, 1], destaque: [0.88, 1, 1, 1] };
    const C = { acento: acento || C0.acento, escuro: C0.escuro };
    if (marca) for (const k of ['acento', 'escuro']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    const BRANCO = [1, 1, 1, 1], APAGADO = [1, 1, 1, 0.38];
    const igual = (p, q) => p.every((v, i) => v === q[i]);
    const mudou = (k) => !igual(C[k], C0[k]);
    const clareia = (c, t) => [0, 1, 2].map((i) => c[i] + (1 - c[i]) * t).concat(1);
    const MIOLO = marca && mudou('acento') ? { titulo: clareia(C.acento, 0.73), destaque: clareia(C.acento, 0.78) } : MIOLO0;
    // contraste com a marca (um aviso por caso no log). Painel e tela final: a legenda branca pede 3:1 sobre o escuro da
    // marca (senão, o escuro do estilo); a palavra acesa da tela, 3:1 sobre esse fundo (senão, a tela inteira volta ao par
    // do estilo). Sobre o vídeo, o miolo pede 4,5:1 e o brilho 3:1 contra o escuro da marca (senão, o neon do estilo)
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    let ESCURO = C.escuro;
    if (marca && mudou('escuro') && !temaMarca.contrasteOk(BRANCO, C.escuro, 3)) {
      avisa('painel e tela final: a legenda branca fica sem contraste (abaixo de 3:1) sobre o escuro da marca; usando o escuro original do estilo.');
      ESCURO = C0.escuro;
    }
    let NEON_TELA = C.acento, ESCURO_TELA = ESCURO;
    if (marca && (mudou('acento') || !igual(ESCURO, C0.escuro)) && !temaMarca.contrasteOk(C.acento, ESCURO, 3)) {
      avisa('tela final: o neon fica sem contraste (abaixo de 3:1) sobre o escuro; usando o par original do estilo.');
      NEON_TELA = C0.acento; ESCURO_TELA = C0.escuro;
    }
    // [brilho, miolo] de um neon sobre o vídeo
    const neonNoVideo = (k, onde) => {
      if (!marca || (!mudou('acento') && !mudou('escuro'))) return [C.acento, MIOLO[k]];
      if (temaMarca.contrasteOk(MIOLO[k], C.escuro, 4.5) && temaMarca.contrasteOk(C.acento, C.escuro, 3)) return [C.acento, MIOLO[k]];
      avisa(`${onde}: o neon sobre o vídeo fica sem contraste (miolo abaixo de 4,5:1 ou brilho abaixo de 3:1) com as cores da marca; usando o neon original do estilo.`);
      return [C0.acento, MIOLO0[k]];
    };
    const NEON = C.acento; // moldura, borda do painel e anel da pessoa (enfeites)
    // com a letra da marca, os estilos de uma lista encolhem juntos, 15% por vez, até o texto mais largo caber no limite
    // (piso: 40% do corpo, no mínimo 16 px, ou o piso pedido). Devolve o fator e, para cada estilo, { e, m }. Sem marca,
    // só mede, como sempre
    const maisLargo = (r) => Math.max(0, ...r.flatMap(({ m }) => Object.values(m).map((x) => x.w)));
    const cabe = (lista, limite, { largura = maisLargo, piso = Math.max(16, lista[0].e.size * 0.4) } = {}) => {
      const mede = (f) => lista.map(({ textos, e }) => { const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) }; return { e: ef, m: P.medir(textos, ef) }; });
      if (!marca) return { f: 1, r: mede(1) };
      for (let f = 1; ; f *= 0.85) {
        let r = null;
        try { r = mede(f); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        if (r && largura(r) <= limite) return { f, r };
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
    const sombra = { color: [0, 0, 0, 0.55], blurRadius: 18, spreadRadius: 0, blendMode: 'normal', offset: [0, 4] };
    // brilho do neon: cópia desfocada e mais grossa por baixo do traço
    const brilho = (c, raio = 22) => { P.efeito(c, { type: 'gaussianBlur', blurriness: raio, repeatEdgePixels: false }); return c; };

    const video = P.video('video', 0, DUR, { volume: 1, durFonte: DUR });
    desfoca(P, video, [[0, 45], [450, 0, EASE.saida]]);

    // abertura: moldura e palavra manuscrita atrás da pessoa
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      const mold = retangulo(150, 230, 780, 1180);
      for (const [larg, desf] of [[22, true], [7, false]]) {
        const f = P.forma('moldura', a, z, mold, { traco: NEON, largura: larg, trim: 0, opacidade: desf ? 70 : 100, cap: 'square' });
        P.kf(f, 'trimEnd', [[0, 0], [750, 100, EASE.suave]]);
        if (desf) brilho(f, 16);
        P.fade(f, 'none', 'fade');
      }
      const palavra = ch.palavra || ch.texto.split(' ')[0];
      const { r: [{ e: estT, m: mT }] } = cabe([{ textos: [palavra], e: est.titulo }], 888);
      const m = mT[palavra];
      const [brilhoT, mioloT] = neonNoVideo('titulo', 'título');
      for (const desf of [true, false]) {
        const t = P.texto('titulo-neon', a + 250, z, [520, 300], comVar({ ...docLinha(F.titulo, estT), text: palavra, fillColor: desf ? brilhoT : mioloT }), ancora(m), { rot: -6 });
        if (desf) brilho(t, 20);
        P.fade(t, 'zoom', 'fade');
      }
      if (temMatte) pessoaRecortada(P, a, z, DUR);
    }

    // B-roll em painel com borda neon sobre fundo escuro; entrada com zoom radial
    const radiais = [];
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000;
      P.ret('painel-fundo', a, z, [0, 0], [1080, 1920], ESCURO);
      const img = P.imagem(b.id, a, z, [540, 980], { escala: 74, fit: 'cover' });
      P.mascara(img, retArredondado(0, 0, 1080, 1920, 40));
      P.kfPos(img, [[0, [540, 1080]], [450, [540, 980], EASE.saida]]);
      for (const [larg, desf] of [[20, true], [5, false]]) {
        const f = P.forma('painel-borda', a, z, retArredondado(540 - 400, 980 - 710, 800, 1420, 28), { traco: NEON, largura: larg, opacidade: desf ? 65 : 100 });
        if (desf) brilho(f, 14);
        P.kfPos(f, [[0, [0, 100]], [450, [0, 0], EASE.saida]]);
      }
      // o apresentador continua em cena: num círculo grande com anel neon, no alto, acima da imagem
      const rosto = pedido.rosto || {};
      pessoaRedonda(P, a + 500, z, { cx: 540, cy: 395, r: 230 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { cor: NEON, largura: 8 } }).forEach((c) => P.fade(c, 'fade', 'none'));
      radiais.push(a, z);
    }

    // tela final: palavra repetida em contorno, com a linha do meio acesa
    const tela = pedido.palavraTela;
    let ini = Infinity;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000);
      ini = a;
      P.ret('tela-fundo', a, z, [0, 0], [1080, 1920], ESCURO_TELA);
      const pal = tela.texto.toUpperCase();
      // palavra larga demais para a tela: a letra diminui até caber (as que já cabiam ficam iguais); com a letra da marca,
      // até a linha acesa caber em 936 px. A palavra é enorme (230 px): o piso é o corpo da legenda, não 40% do dela
      let estTela = est.tela, m;
      if (marca) ({ r: [{ e: estTela, m: { [pal]: m } }] } = cabe([{ textos: [pal], e: est.tela }], 936, { piso: est.leg.size }));
      else for (;;) {
        try { m = P.medir([pal], estTela)[pal]; break; } catch (e) {
          if (!/maior que a área/.test(e.message) || estTela.size < 80) throw e;
          estTela = { ...estTela, size: Math.round(estTela.size * 0.85) };
        }
      }
      const NEON = NEON_TELA;
      const doc = comVar({ ...docLinha(F.tela, estTela), text: pal });
      for (let k = -4; k <= 4; k++) {
        const y = 960 + k * 215;
        const acesa = k === 0;
        const t = P.texto('tela-' + k, a, z, [540, y], { ...doc, fillColor: acesa ? NEON : [0, 0, 0, 0], applyFill: acesa,
          applyStroke: !acesa, strokeWidth: 2.5, strokeColor: [NEON[0], NEON[1], NEON[2], 0.45] }, ancora(m));
        // linhas alternadas deslizam em sentidos opostos
        const d = acesa ? 0 : (k % 2 ? 90 : -90);
        if (d) P.kfPos(t, [[0, [540 - d, y]], [z - a, [540 + d, y], EASE.linear]]);
        if (acesa) { P.kfEscala(t, [[0, 80], [350, 100, EASE.saida]]); brilho(P.texto('tela-brilho', a, z, [540, y], { ...doc, fillColor: NEON }, ancora(m)), 24); }
      }
      radiais.push(a);
    }

    // legendas: texto apagado e palavras acendendo; destaque em manuscrito neon
    const destaque = ehDestaque(pedido);
    const grupos = separaDestaques(agrupa(palavras.map((p) => ({ ...p, w: p.w.toLowerCase() })), { maxPalavras: 3, maxChars: 18 }), destaque);
    // com a letra da marca, todas as frases (e o destaque, na mesma proporção) encolhem juntas até a mais larga caber
    const { r: [{ e: estL, m: med }, { e: estS, m: medS }] } = cabe([
      { textos: grupos.filter((g) => !g.destaque).map((g) => g.texto), e: est.leg },
      { textos: grupos.filter((g) => g.destaque).map((g) => g.texto), e: est.script }], 936);
    const [brilhoD, mioloD] = neonNoVideo('destaque', 'destaque da legenda');
    // destaque na tela final: o brilho da tela e o miolo do mesmo neon (o acento da marca clareado, mesmo quando o fundo
    // voltou ao escuro do estilo), que pede 4,5:1 sobre o fundo da tela; senão, brilho e miolo voltam juntos ao estilo
    let destaqueNaTela = [NEON_TELA, igual(NEON_TELA, C0.acento) ? MIOLO0.destaque : MIOLO.destaque];
    if (marca && !igual(NEON_TELA, C0.acento) && !temaMarca.contrasteOk(destaqueNaTela[1], ESCURO_TELA, 4.5)) {
      avisa('destaque na tela final: o miolo do neon fica sem contraste (abaixo de 4,5:1) sobre o fundo; usando o neon original do estilo.');
      destaqueNaTela = [C0.acento, MIOLO0.destaque];
    }
    for (const g of grupos) {
      const noBroll = cenas.slice(0, 1).some((b) => g.ini < b.fim * 1000 && g.fim > b.ini * 1000);
      const cy = g.ini >= ini ? 1420 : noBroll ? 1400 : 1250;
      if (!g.destaque) {
        linhaProgressiva(P, g, { fonte: F.leg, estilo: estL, medida: med, cy, cor: BRANCO, corApagada: APAGADO, sombra, nome: 'leg' });
        continue;
      }
      // na tela final, o destaque segue o par da tela; no resto, o do vídeo
      const [bD, mD] = g.ini >= ini ? destaqueNaTela : [brilhoD, mioloD];
      for (const desf of [true, false]) {
        const t = P.texto('destaque-' + g.texto, g.ini, g.fim, [540, cy], comVar({ ...docLinha(F.script, estS), text: g.texto, fillColor: desf ? bD : mD }), ancora(medS[g.texto]), { rot: -3 });
        if (desf) brilho(t, 14);
        P.fade(t, 'scale', 'none');
      }
    }

    // zoom radial nas viradas, por cima de tudo
    if (radiais.length) {
      const aj = P.ajuste('zoom-radial', 0, DUR);
      const rid = P.efeito(aj, { type: 'radialBlur', centerX: 0.5, centerY: 0.45, amount: 0 });
      const keys = [[0, 0]];
      radiais.forEach((t) => keys.push([t - 220, 0, EASE.linear], [t, 30, EASE.entrada], [t + 260, 0, EASE.saida]));
      P.kfEfeito(aj, rid, 'amount', keys);
    }
  },
};
