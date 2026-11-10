// Recorte: colagem de papel. Faixa de papel rasgado no topo com o título datilografado em fitas,
// legenda em pílula clara que acende palavra por palavra, imagem colada como recorte e transição de jornal rasgado.
// Marca (ctx.marca, do tema-marca.js): a tinta vira o escuro da empresa e o papel da pílula (e da borda da pessoa), o claro;
// o texto apagado da pílula é um tom entre os dois. As texturas (papel azul, fitas e jornal) são do estilo e ficam. A
// pílula usa a letra principal e a fita datilografada, a mono. Com a letra da marca, os textos encolhem até caber; texto sem
// contraste volta ao par do estilo, com aviso no log. Sem marca, nada muda.
const path = require('path');
const { agrupa, EASE, hex } = require('../motor');
const { linhaProgressiva, desfoca, pessoaRedonda } = require('./_comum');
const temaMarca = require('../tema-marca');

const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');
// cor do meio das texturas das fitas (amostrada dos PNG gerados por gerar-texturas.js), para conferir o contraste do texto
const FITA_ESCURA = [28 / 255, 28 / 255, 28 / 255, 1], FITA_CLARA = [236 / 255, 234 / 255, 225 / 255, 1];

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Recorte',
  descricao: 'Colagem de papel: título datilografado em fitas, legenda em pílula, recorte colado e transição de jornal rasgado.',
  quadros: [0.25, 1.4, 3.2, 5.2, 6.8, 7.6, 12.0],
  capa: 1.4, // segundo usado como capa na galeria
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { pilula: { arquivo: 'Inter.ttf', style: 'Bold', size: 50, tracking: -10 },
      fita: { arquivo: 'CourierPrime-Bold.ttf', style: 'Bold', size: 46, tracking: 180, allCaps: true } };
    let sans = P.fonte(est.pilula.arquivo), courier = P.fonte(est.fita.arquivo);
    // letra de cada texto: a pílula na principal e a fita na mono da marca, ou a do estilo
    if (marca) {
      const p = temaMarca.letra(P, marca, 'principal', est.pilula), m = temaMarca.letra(P, marca, 'mono', est.fita);
      if (p) { sans = p.fonte; est.pilula = p.est; }
      if (m) { courier = m.fonte; est.fita = m.est; }
    }
    ['papel-azul', 'fita-escura', 'fita-clara', 'papel-jornal'].forEach((n) => P.importaImagem(n, TEX(n)));
    // C0: a paleta do estilo (tinta e papel; a apagada é um tom entre os dois); C: com a marca
    const C0 = { escuro: [0.08, 0.08, 0.09, 1], claro: [0.95, 0.94, 0.9, 1] }, APAGADA0 = [0.62, 0.62, 0.64, 1];
    const C = { ...C0 };
    if (marca) for (const k of ['escuro', 'claro']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    const igual = (p, q) => p.every((v, i) => v === q[i]);
    const mudou = (k) => !igual(C[k], C0[k]);
    const mistura = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t).concat(1);
    // contraste com a marca (um aviso por caso no log): tinta sobre o papel da pílula pede 3:1 (senão, a pílula volta ao
    // par do estilo); o texto das fitas, 3:1 sobre a textura da fita (senão, a cor do estilo)
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    let [TINTA, PAPEL] = [C.escuro, C.claro];
    if (marca && (mudou('escuro') || mudou('claro')) && !temaMarca.contrasteOk(C.escuro, C.claro, 3)) {
      avisa('pílula da legenda: "escuro" sobre "claro" fica sem contraste (abaixo de 3:1) com as cores da marca; usando o par original do estilo.');
      [TINTA, PAPEL] = [C0.escuro, C0.claro];
    }
    const APAGADA = marca && (!igual(TINTA, C0.escuro) || !igual(PAPEL, C0.claro)) ? mistura(TINTA, PAPEL, 0.62) : APAGADA0;
    const naFita = (k, fundo, onde) => {
      if (!marca || !mudou(k) || temaMarca.contrasteOk(C[k], fundo, 3)) return C[k];
      avisa(`${onde}: "${k}" sobre a fita fica sem contraste (abaixo de 3:1) com as cores da marca; usando a cor original do estilo.`);
      return C0[k];
    };
    const corFita = [naFita('claro', FITA_ESCURA, 'fita escura'), naFita('escuro', FITA_CLARA, 'fita clara')];
    // com a letra da marca, os textos de uma lista encolhem juntos, 15% por vez, até caber (largura(m) <= 0 quer dizer
    // que coube; piso: 40% do corpo, no mínimo 16 px). Sem marca, só mede, como sempre
    const avisaPiso = (tx) => avisa(`o texto "${tx}" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.`);
    const cabe = (textos, e, largura) => {
      if (!marca) return { e, m: P.medir(textos, e) };
      const piso = Math.max(16, e.size * 0.4);
      for (let f = 1; ; f *= 0.85) {
        const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) };
        let m = null;
        try { m = P.medir(textos, ef); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        if (m && largura(m) <= 0) return { e: ef, m };
        if (e.size * f * 0.85 < piso) {
          if (m) { // no piso: fica o menor corpo medido, mesmo sem caber, e o log diz qual texto sai da tela
            avisaPiso(Object.entries(m).sort((p, q) => q[1].w - p[1].w)[0][0]);
            return { e: ef, m };
          }
          throw new Error(`marca: o texto "${[...textos].sort((p, q) => q.length - p.length)[0]}" não cabe na tela nem com 40% do corpo da letra.`);
        }
      }
    };

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // B-roll: o de tela cheia entra e sai com a folha de jornal varrendo a tela; o outro vira recorte colado
    const [cheia, colado] = cenas;
    const varre = (t, sentido) => {
      // folha entra pelo canto inferior esquerdo, cobre a tela e sai pelo superior direito (o corte acontece no meio)
      const j = P.imagem('papel-jornal', t - 260, t + 300, [540, 960], { rot: -12 });
      P.kfPos(j, [[0, sentido > 0 ? [-900, 2900] : [1980, -1000]], [260, [540, 960], EASE.suave], [560, sentido > 0 ? [1980, -1000] : [-900, 2900], EASE.entrada]]);
    };
    if (cheia) {
      const a = cheia.ini * 1000, z = cheia.fim * 1000;
      P.imagem(cheia.id, a, z, [540, 1070], { fit: 'cover', escala: 112 });
      // o apresentador continua em cena: num círculo de papel (borda branca) no alto; as folhas de jornal passam por cima
      const rosto = pedido.rosto || {};
      pessoaRedonda(P, a + 500, z - 400, { cx: 540, cy: 400, r: 240 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { cor: PAPEL, largura: 14 } }).forEach((c) => P.fade(c, 'fade', 'fade'));
      varre(a, 1);
      varre(z, -1);
    }
    if (colado) {
      const a = colado.ini * 1000, z = colado.fim * 1000;
      const img = P.imagem(colado.id, a, z, [200, 780], { escala: 29, rot: -7, fit: 'cover' });
      P.efeito(img, { type: 'stroke', enabled: true, color: [1, 1, 1, 1], width: 18, position: 'outside', blendMode: 'normal', opacity: 100 });
      img.dropShadow = { color: [0, 0, 0, 0.35], blurRadius: 30, spreadRadius: 0, blendMode: 'normal', offset: [8, 14] };
      P.fade(img, 'pop', 'pop');
    }

    // topo: papel azul desce e o título entra datilografado em duas fitas
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      const papel = P.imagem('papel-azul', a, z, [540, 280]);
      P.kfPos(papel, [[0, [540, -300]], [320, [540, 160], EASE.saida], [z - a - 280, [540, 160], EASE.linear], [z - a, [540, -320], EASE.entrada]]);
      const palavrasCh = ch.texto.split(' ');
      const meio = Math.ceil(palavrasCh.length / 2);
      const linhas = [palavrasCh.slice(0, meio).join(' '), palavrasCh.slice(meio).join(' ')].filter(Boolean);
      // com a letra da marca, as duas linhas encolhem juntas até cada fita (texto + 90 px) caber na tela em volta do seu
      // centro (430 px na primeira, 600 na segunda)
      const folga = (m) => Math.max(...linhas.map((l, k) => m[l.toUpperCase()].w + 90 - 2 * Math.min((k === 0 ? 430 : 600) - 40, 1040 - (k === 0 ? 430 : 600))));
      const { e: estFita, m: med } = cabe(linhas.map((l) => l.toUpperCase()), est.fita, folga);
      linhas.forEach((l, k) => {
        const t0 = a + 250 + k * 380;
        const m = med[l.toUpperCase()];
        const escura = k === 0;
        const larg = m.w + 90;
        const y = 95 + k * 115, x = k === 0 ? 430 : 600, rot = k === 0 ? -4 : 3;
        const fita = P.imagem(escura ? 'fita-escura' : 'fita-clara', t0, z - 120, [x, y], { rot });
        fita.transform.scale = [larg / 760 * 100, 100];
        P.fade(fita, 'pop', 'fade');
        // texto datilografado: uma letra a cada 45 ms
        const doc = { text: '', fontFamily: courier.family, fontStyle: estFita.style, fontSize: estFita.size, tracking: estFita.tracking, allCaps: true,
          fillColor: corFita[escura ? 0 : 1], justification: 'left', boxText: true, boxPosition: [0, 0], boxSize: [1600, 90], verticalAlign: 'top' };
        const txt = P.texto('fita-' + l, t0 + 120, z - 120, [x, y], { ...doc, text: l[0] }, [m.x0 + m.w / 2, (m.top + m.bottom) / 2], { rot });
        P.kf(txt, 'textContent', [...l].map((_, i) => [i * 45, l.slice(0, i + 1)]));
        P.fade(txt, 'none', 'fade');
      });
    }

    // legenda em pílula: texto inteiro apagado e as palavras faladas em tinta escura
    const grupos = agrupa(palavras, { maxPalavras: 3, maxChars: 20 });
    // com a letra da marca, as frases encolhem juntas até a pílula (texto + 56 px) caber em 936 px
    const { e: estPil, m: med } = cabe(grupos.map((g) => g.texto), est.pilula, (m) => Math.max(0, ...Object.values(m).map((x) => x.w)) - 880);
    const CY = 1380;
    grupos.forEach((g, i) => {
      const m = med[g.texto];
      const w = m.w + 56, h = 84;
      const pil = P.ret('pilula', g.ini, g.fim, [540, CY], [w, h], PAPEL, { anchor: [w / 2, h / 2], raio: 1 });
      pil.dropShadow = { color: [0, 0, 0, 0.25], blurRadius: 18, spreadRadius: 0, blendMode: 'normal', offset: [0, 6] };
      const anterior = grupos[i - 1];
      if (!anterior || g.ini - anterior.fim > 150) P.fade(pil, 'pop', 'none');
      linhaProgressiva(P, g, { fonte: sans, estilo: estPil, medida: med, cy: CY, cor: TINTA, corApagada: APAGADA, nome: 'pil' });
    });
  },
};
