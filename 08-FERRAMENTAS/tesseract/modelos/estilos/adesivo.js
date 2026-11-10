// Adesivo: colagem pop. Faixa de título com contorno, adesivos que pulam em volta da pessoa, legenda em pílula branca
// com contorno e destaque em itálico, a pessoa numa moldura em arco sobre o fundo rosa, B-roll como foto colada no papel
// quadriculado e um selo estourado com a palavra final.
// Marca (ctx.marca, do tema-marca.js): o rosa é o acento. A faixa do título fica no acento da empresa e as texturas rosa (o
// fundo de bolinhas e xadrez, as linhas do papel quadriculado e o selo estourado) giram o matiz até o do acento, mantendo
// a claridade de cada tom: o texto escuro continua legível sobre elas. O preto do contorno (o mesmo dos adesivos prontos) e
// o branco da pílula ficam (cores de sistema); os adesivos coloridos (estrela, raio, flor, seta, rabisco) são de várias cores
// e ficam como estão. Letras: a principal no título, na legenda e no selo; o destaque em itálico vai para a principal só se
// ela tiver itálico, senão para a letra de acento da marca, senão fica a itálica do estilo. Com a marca, os textos encolhem
// até caber. Sem marca, nada muda.
const path = require('path');
const { agrupa, EASE, arco, hex } = require('../motor');
const { linhaMista, ehDestaque, ancora, docLinha, comVar, pessoaRedonda } = require('./_comum');
const { limpa } = require('../motor');
const temaMarca = require('../tema-marca');
const { giroDeMatiz, gira } = require('./_matiz');

const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Adesivo',
  descricao: 'Colagem pop: faixa de título, adesivos que pulam, pílula com contorno, moldura em arco, foto colada e selo final.',
  quadros: [0.6, 2.0, 4.6, 6.0, 7.6, 10.5, 13.2],
  capa: 1.6,
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { reg: { arquivo: 'Inter.ttf', style: 'Medium', size: 48 },
      ita: { arquivo: 'Inter-Italic.ttf', style: 'Black Italic', size: 48 },
      titulo: { arquivo: 'Inter.ttf', style: 'Black', size: 120, tracking: -20, allCaps: true } };
    const sans = P.fonte(est.reg.arquivo), italico = P.fonte(est.ita.arquivo);
    // letra de cada texto: a da marca no papel, ou a do estilo. O destaque em itálico vai para a principal só se ela tiver
    // itálico; senão, para a letra de acento da marca (sem ela, fica a itálica do estilo)
    const F = { reg: sans, ita: italico, titulo: sans };
    if (marca) {
      const temIt = temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
      const papel = { reg: 'principal', titulo: 'principal', ita: temIt ? 'principal' : 'acento' };
      for (const k of Object.keys(est)) {
        const m = temaMarca.letra(P, marca, papel[k], est[k]);
        if (m) { F[k] = m.fonte; est[k] = m.est; }
      }
    }
    const NOMES = ['xadrez-rosa', 'papel-grade', 'adesivo-estrela', 'adesivo-explosao', 'adesivo-raio', 'adesivo-flor', 'adesivo-seta', 'adesivo-rabisco'];
    NOMES.forEach((n) => P.importaImagem(n, TEX(n)));
    const ROSA0 = [0.91, 0.65, 0.86, 1];
    const ROSA = (marca && marca.cores.acento ? hex(marca.cores.acento) : acento) || ROSA0, TINTA = [0.07, 0.07, 0.07, 1], BRANCO = [1, 1, 1, 1];
    // texturas no acento da marca: giro de matiz do rosa do estilo até o acento (e a saturação na proporção da do acento:
    // mais viva ou mais apagada); a claridade de cada tom fica, então o texto escuro sobre o selo continua legível
    const giro = marca && marca.cores.acento ? giroDeMatiz(ROSA0, ROSA) : null;
    const tinge = (c) => { if (giro) P.efeito(c, { type: 'hueSaturation', hue: giro.hue, saturation: giro.saturation, lightness: 0 }); return c; };
    const sombraFoto = giro ? [...gira([0.6, 0.25, 0.55], giro), 0.5] : [0.6, 0.25, 0.55, 0.5];
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    // com a letra da marca, os estilos de uma lista encolhem juntos, 15% por vez, até a linha mais larga (largura(r):
    // { w, texto }; por padrão, o texto mais largo) caber no limite; piso de 40% do corpo, no mínimo 16 px (ou `minimo`). No
    // piso, o texto que ainda não cabe fica no último corpo medido, com aviso no log. Sem marca, só mede, como sempre
    const maisLargo = (r) => r.flatMap(({ m }) => Object.entries(m).map(([texto, x]) => ({ w: x.w, texto }))).reduce((p, q) => (q.w > p.w ? q : p), { w: 0, texto: '' });
    const cabe = (lista, limite, { largura = maisLargo, minimo } = {}) => {
      const mede = (f) => lista.map(({ textos, e }) => { const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) }; return { e: ef, m: P.medir(textos, ef) }; });
      if (!marca) return { f: 1, r: mede(1) };
      const piso = minimo || Math.max(16, lista[0].e.size * 0.4);
      for (let f = 1; ; f *= 0.85) {
        let r = null, falhou = '';
        try { r = mede(f); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; falhou = err.message.replace(/^.*?: /, ''); }
        const l = r ? largura(r) : { w: Infinity, texto: falhou };
        if (l.w <= limite) return { f, r };
        if (lista[0].e.size * f * 0.85 < piso) {
          if (!r) throw new Error(`marca: o texto "${l.texto}" não cabe na tela nem no piso de ${Math.round(piso)} px; encurte o texto.`);
          avisa(`o texto "${l.texto}" não cabe em ${limite} px nem no piso de ${Math.round(piso)} px e sai da tela; encurte o texto.`);
          return { f, r };
        }
      }
    };
    // linha mais larga de uma legenda em trechos (somando os espaços entre eles), com o texto dela, para o aviso
    const linhaMaisLarga = (linhas, mr, mi, espaco) => linhas.map((tr) => ({ w: tr.reduce((s, x) => s + (x.it ? mi : mr)[x.texto].w, 0) + espaco * (tr.length - 1),
      texto: tr.map((x) => x.texto).join(' ') })).reduce((p, q) => (q.w > p.w ? q : p), { w: 0, texto: '' });
    const ch = pedido.chamada;
    const fimAbertura = ch ? ch.fim * 1000 : 0;
    const [broll] = cenas;
    const jB = broll ? [broll.ini * 1000, broll.fim * 1000] : null;
    const tela = pedido.palavraTela;
    const jT = tela ? [tela.ini * 1000, Math.min(DUR, tela.fim * 1000)] : null;
    // o arco vai do fim da abertura até o B-roll; o resto é vídeo cheio
    const jArco = ch && jB ? [fimAbertura, jB[0]] : null;

    // adesivo que pula e balança de leve
    let n = 0;
    const adesivo = (nome, a, z, pos, escala, rot) => {
      const c = P.imagem(nome, a, z, pos, { escala, rot });
      if (nome === 'adesivo-explosao') tinge(c);
      P.fade(c, 'pop', 'pop');
      const s = (n++ % 2 ? 1 : -1) * 5;
      P.kf(c, 'rotation', [[0, rot], [400, rot + s, EASE.suave], [800, rot, EASE.suave], [1200, rot + s, EASE.suave], [1600, rot, EASE.suave]]);
      return c;
    };

    // vídeo cheio fora do arco, do B-roll e da tela final
    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });
    if (jArco) {
      const [a, z] = jArco;
      tinge(P.imagem('xadrez-rosa', a, z, [540, 960]));
      const v = P.video('arco', a, z, { durFonte: DUR, src0: a, escala: 80, pos: [540, 900] });
      P.mascara(v, arco(110, 120, 860, 1700));
      P.forma('arco-borda', a, z, arco(540 - 344, 900 - 768 + 96, 688, 1360), { traco: TINTA, largura: 8 });
      P.fade(v, 'scale', 'none');
      adesivo('adesivo-estrela', a + 150, z, [190, 480], 70, -8);
      adesivo('adesivo-flor', a + 300, z, [900, 1260], 70, 10);
      adesivo('adesivo-seta', a + 450, z, [180, 1420], 80, 0);
      adesivo('adesivo-estrela', a + 200, z, [930, 640], 45, 12);
    }
    if (broll) {
      const [a, z] = jB;
      tinge(P.imagem('papel-grade', a, z, [540, 960]));
      const img = P.imagem(broll.id, a, z, [540, 990], { escala: 70, rot: -4, fit: 'cover' });
      P.efeito(img, { type: 'stroke', enabled: true, color: [1, 1, 1, 1], width: 16, position: 'outside', blendMode: 'normal', opacity: 100 });
      img.dropShadow = { color: sombraFoto, blurRadius: 0, spreadRadius: 0, blendMode: 'normal', offset: [18, 18] };
      P.fade(img, 'pop', 'none');
      adesivo('adesivo-estrela', a + 200, z, [150, 620], 60, -6);
      adesivo('adesivo-estrela', a + 320, z, [880, 1360], 75, 8);
      // o apresentador continua em cena: num círculo com contorno de adesivo, no alto, acima da foto colada
      const rosto = pedido.rosto || {};
      pessoaRedonda(P, a + 250, z, { cx: 540, cy: 410, r: 235 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { fundo: BRANCO, cor: TINTA, largura: 12 } }).forEach((c) => P.fade(c, 'pop', 'none'));
    }
    if (jT) {
      const [a, z] = jT;
      tinge(P.imagem('papel-grade', a, z, [540, 960]));
      adesivo('adesivo-rabisco', a + 100, z, [300, 300], 90, -10);
      adesivo('adesivo-raio', a + 180, z, [880, 1450], 80, 12);
      adesivo('adesivo-flor', a + 240, z, [180, 1600], 60, 0);
      const selo = tinge(P.imagem('adesivo-explosao', a, z, [540, 900], { escala: 110 }));
      P.fade(selo, 'pop', 'none');
      const pal = tela.texto.toUpperCase();
      // com a letra da marca, a palavra encolhe até caber no selo (sem passar das pontas: 700 px)
      const { r: [{ e: estS, m: mS }] } = cabe([{ textos: [pal], e: est.titulo }], 700);
      const m = mS[pal];
      const t = P.texto('selo-texto', a + 120, z, [540, 900], comVar({ ...docLinha(F.titulo, estS), text: pal, fillColor: TINTA }), ancora(m), { rot: -6 });
      P.fade(t, 'pop', 'none');
    }

    // abertura: faixa de título e adesivos em volta
    if (ch) {
      const a = ch.ini * 1000, z = fimAbertura;
      const titulo = (ch.palavra || ch.texto.split(' ')[0]).toUpperCase();
      // com a letra da marca, o título encolhe até a faixa (90 px mais larga) caber em 936 px
      const { r: [{ e: estT, m: mT }] } = cabe([{ textos: [titulo], e: est.titulo }], 846);
      const m = mT[titulo];
      const w = m.w + 90, h = 170;
      const faixa = P.ret('faixa', a, z, [540, 210], [w, h], ROSA, { anchor: [w / 2, h / 2], rot: -3 });
      faixa.rect.strokeEnabled = true; faixa.rect.strokeWidth = 8; faixa.rect.strokeColor = TINTA;
      P.fade(faixa, 'pop', 'none');
      // branco com contorno preto: lê sobre qualquer acento (o contorno faz o contraste, como no estilo)
      const t = P.texto('titulo', a + 80, z, [540, 210], comVar({ ...docLinha(F.titulo, estT), text: titulo, fillColor: BRANCO,
        applyStroke: true, strokeWidth: 7, strokeColor: TINTA, strokeOverFill: false }), ancora(m), { rot: -3 });
      P.fade(t, 'pop', 'none');
      adesivo('adesivo-raio', a + 200, z, [930, 520], 70, 14);
      adesivo('adesivo-flor', a + 320, z, [150, 600], 55, 0);
      adesivo('adesivo-estrela', a + 420, z, [140, 1180], 60, -10);
      adesivo('adesivo-explosao', a + 520, z, [960, 1150], 22, 0);
      adesivo('adesivo-seta', a + 600, z, [880, 1500], 60, 10);
    }

    // legenda em pílula branca com contorno; destaque em itálico pesado
    const destaque = ehDestaque(pedido);
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 22 });
    const trechos = grupos.map((g) => {
      const out = [];
      g.palavras.forEach((p) => {
        const it = destaque(p.w), ult = out[out.length - 1];
        if (ult && ult.it === it) ult.texto += ' ' + limpa(p.w); else out.push({ it, texto: limpa(p.w) });
      });
      return out;
    });
    // com a letra da marca, todas as frases encolhem juntas até a mais larga (trechos e espaços de 14 px) caber na pílula
    // de até 936 px (64 px de folga)
    const largura = ([{ m: mr }, { m: mi }]) => linhaMaisLarga(trechos, mr, mi, 14);
    const { r: [{ e: estR, m: medR }, { e: estI, m: medI }] } = cabe([{ textos: trechos.flat().filter((x) => !x.it).map((x) => x.texto), e: est.reg },
      { textos: trechos.flat().filter((x) => x.it).map((x) => x.texto), e: est.ita }], 872, { largura });
    grupos.forEach((g, i) => {
      const partes = trechos[i].map((x) => ({ texto: x.texto, fonte: x.it ? F.ita : F.reg, estilo: x.it ? estI : estR, m: (x.it ? medI : medR)[x.texto], cor: TINTA }));
      const larg = partes.reduce((s, p) => s + p.m.w, 0) + 14 * (partes.length - 1) + 64;
      const noBroll = jB && g.ini < jB[1] && g.fim > jB[0];
      const cy = jT && g.ini >= jT[0] ? 1560 : noBroll ? 1400 : 1330;
      const pil = P.ret('pilula', g.ini, g.fim, [540, cy], [larg, 82], BRANCO, { anchor: [larg / 2, 41], raio: 1 });
      pil.rect.strokeEnabled = true; pil.rect.strokeWidth = 5; pil.rect.strokeColor = TINTA;
      linhaMista(P, partes, { cy, a: g.ini, z: g.fim, espaco: 14, nome: 'leg' });
    });
  },
};
