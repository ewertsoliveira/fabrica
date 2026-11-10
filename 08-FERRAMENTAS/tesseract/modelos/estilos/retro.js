// Retrô: anos 2000. Fundo creme com janelas de sistema antigo que pulam em cascata mostrando o vídeo,
// título manuscrito ácido, legenda amarelo-limão, dissolução em pixels nas viradas e o B-roll em janelas empilhadas.
// Marca (ctx.marca, do tema-marca.js): o creme (fundo e pixels) vira o claro da empresa, o limão (título e legenda sobre o
// vídeo) o acento e a tinta (legenda sobre o creme e contorno do título) o escuro. A janela de sistema antigo é cinza de
// sistema com os três botões coloridos e fica como está; a sombra dura também. Letras: a principal no título e na legenda;
// com ela, os textos encolhem até caber. A legenda sobre o creme pede 3:1 (senão creme e tinta voltam ao par do estilo) e a
// do vídeo 4,5:1 contra o escuro da marca (senão volta ao limão); o título tem contorno, como no estilo. Com ou sem marca:
// a frase que atravessa a troca entre o creme e o vídeo muda de cor e de altura na troca (a tinta nunca fica sobre o vídeo),
// e o título fica em y 1465, longe do queixo da última janela, com a legenda da abertura em 1690.
const path = require('path');
const { agrupa, EASE, retangulo, hex } = require('../motor');
const { linhaProgressiva, ancora, docLinha, comVar } = require('./_comum');
const temaMarca = require('../tema-marca');

const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Retrô',
  descricao: 'Anos 2000: janelas antigas em cascata com o vídeo, título manuscrito ácido, legenda limão e dissolução em pixels.',
  quadros: [0.5, 1.6, 3.3, 4.2, 7.3, 8.5, 12.5],
  capa: 1.7,
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { leg: { arquivo: 'Inter.ttf', style: 'SemiBold', size: 60, tracking: -10 },
      titulo: { arquivo: 'KaushanScript-Regular.ttf', style: 'Regular', size: 190 } };
    const sans = P.fonte(est.leg.arquivo), kaushan = P.fonte(est.titulo.arquivo);
    // letra de cada texto: a principal da marca (peso mais próximo), ou a do estilo
    const F = { leg: sans, titulo: kaushan };
    if (marca) for (const k of Object.keys(est)) {
      const m = temaMarca.letra(P, marca, 'principal', est[k]);
      if (m) { F[k] = m.fonte; est[k] = m.est; }
    }
    const letraDaMarca = F.titulo !== kaushan;
    P.importaImagem('janela-retro', TEX('janela-retro'));
    // C0: a paleta do estilo (creme, limão e tinta); C: a paleta em uso, com a marca
    const C0 = { claro: [0.95, 0.95, 0.85, 1], acento: [0.9, 0.96, 0.2, 1], escuro: [0.12, 0.12, 0.1, 1] };
    const C = { ...C0, acento: acento || C0.acento };
    if (marca) for (const k of ['acento', 'claro', 'escuro']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const mudou = (k) => !C[k].every((v, i) => v === C0[k][i]);
    // tela creme: a tinta sobre o creme pede 3:1, senão o creme e a tinta voltam ao par do estilo
    let [CREME, TINTA] = [C.claro, C.escuro];
    if (marca && (mudou('claro') || mudou('escuro')) && !temaMarca.contrasteOk(C.escuro, C.claro, 3)) {
      avisa('fundo creme: "escuro" sobre "claro" fica sem contraste (abaixo de 3:1) com as cores da marca; usando o par original do estilo.');
      [CREME, TINTA] = [C0.claro, C0.escuro];
    }
    // limão sobre o vídeo: 4,5:1 contra o escuro da marca, senão volta ao limão do estilo
    let LIMAO = C.acento;
    if (marca && mudou('acento') && !temaMarca.contrasteOk(C.acento, C.escuro, 4.5)) {
      avisa('legenda sobre o vídeo: "acento" fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
      LIMAO = C0.acento;
    }
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
    const sombra = { color: [0.1, 0.1, 0.05, 0.75], blurRadius: 6, spreadRadius: 0, blendMode: 'normal', offset: [3, 4] };

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // janela antiga com conteúdo: a janela tem 860x720 e a área útil 824x644 a partir de (18, 58)
    const janela = (a, z, cx, cy, esc, conteudo) => {
      const k = esc / 100;
      if (conteudo === 'video') {
        // mostra a região do rosto (centro da cabeça no vídeo de origem: rostoY) recortada no formato da área útil
        const rostoY = (pedido.rosto && pedido.rosto.y) ?? 640;
        const v = 0.42 * k / 0.5;
        const w = 824 * k / v, h = 644 * k / v;
        const c = P.video('janela-video', a, z, { durFonte: DUR, src0: a, escala: v * 100, pos: [cx, cy + 20 * k - (rostoY - 960) * v] });
        P.mascara(c, retangulo(540 - w / 2, rostoY - h / 2, w, h));
        P.fade(c, 'pop', 'none');
      } else {
        const v = k * 824 / 1080;
        const c = P.imagem(conteudo, a, z, [cx, cy + 20 * k], { escala: v * 100, fit: 'cover' });
        P.mascara(c, retangulo(0, 960 - 322 / v * k, 1080, 644 / v * k));
        P.fade(c, 'pop', 'none');
      }
      const f = P.imagem('janela-retro', a, z, [cx, cy], { escala: esc });
      P.fade(f, 'pop', 'none');
    };

    // pixels: quadrados creme que aparecem e somem em ordem embaralhada, cobrindo a virada
    const pixels = (t) => {
      const L = 135;
      for (let c = 0; c < 8; c++) for (let l = 0; l < 15; l++) {
        const ordem = (c * 37 + l * 71) % 23;
        const r = P.ret('pixel', t - 300, t + 300, [c * L, l * L], [L + 1, L + 1], CREME);
        P.kf(r, 'opacity', [[0, 0], [ordem * 12, 0, EASE.hold], [ordem * 12 + 1, 100, EASE.hold], [300 + ordem * 12, 100, EASE.hold], [300 + ordem * 12 + 1, 0, EASE.hold]]);
      }
    };

    // abertura: fundo creme e janelas com o vídeo pulando em cascata, título manuscrito por cima
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      P.ret('creme', a, z, [0, 0], [1080, 1920], CREME);
      [[290, 300, 62], [790, 470, 58], [300, 760, 60], [790, 1000, 62], [420, 1190, 54]].forEach(([x, y, e], i) => janela(a + i * 140, z, x, y, e, 'video'));
      const palavra = ch.palavra || ch.texto.split(' ')[0];
      // o título fica em y 1465 (antes 1380, quando a manuscrita encostava no queixo da última janela, que acaba em y 1384),
      // com ou sem marca; a legenda da abertura desce junto, para 1690. Com a letra da marca (mais alta e mais larga que a
      // manuscrita do estilo), o título encolhe até 560 px, perto da largura da manuscrita, para não subir sobre o queixo
      // nem descer sobre a legenda (girado 8°, a ponta da esquerda fica mais baixa); com a letra do estilo (sem marca, ou
      // pedido só com cores), vale a largura da tela, como nos outros textos
      const { r: [{ e: estT, m: mT }] } = cabe([{ textos: [palavra], e: est.titulo }], letraDaMarca ? 560 : 936);
      const m = mT[palavra];
      const yT = 1465;
      // limão com contorno de tinta: lê sobre o creme pelo contorno, como no estilo
      const t = P.texto('titulo', a + 700, z, [560, yT], comVar({ ...docLinha(F.titulo, estT), text: palavra, fillColor: C.acento,
        applyStroke: true, strokeWidth: 6, strokeColor: TINTA, strokeOverFill: false }), ancora(m), { rot: -8 });
      P.fade(t, 'scale', 'none');
      pixels(z);
    }

    // B-roll: janelas empilhadas, a última com a imagem; o vídeo segue numa janela pequena no canto
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000;
      pixels(a);
      P.ret('creme', a, z, [0, 0], [1080, 1920], CREME);
      [0, 1, 2].forEach((i) => janela(a + i * 90, z, 470 + i * 30, 980 + i * 30, 112, b.id));
      janela(a + 400, z, 790, 360, 52, 'video');
      pixels(z);
    }

    // legenda limão com sombra dura
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 22 });
    const { r: [{ e: estL, m: med }] } = cabe([{ textos: grupos.map((g) => g.texto), e: est.leg }], 936);
    // sobre o fundo creme (abertura e B-roll) a legenda é tinta escura, mais baixa; sobre o vídeo, limão com sombra dura
    const cremes = [...(ch ? [[ch.ini * 1000, ch.fim * 1000]] : []), ...cenas.slice(0, 1).map((b) => [b.ini * 1000, b.fim * 1000])];
    // a frase que atravessa a troca entre o creme e o vídeo é cortada na troca: cada trecho com a cor e a altura do seu fundo
    // (a tinta sobre o vídeo não lê), com ou sem marca. Na abertura, com o título em 1465, a legenda do creme desce para 1690
    const trocas = cremes.flat();
    const emCreme = (x) => cremes.some(([a, z]) => x >= a && x < z);
    const naAbertura = (x) => !!ch && x >= ch.ini * 1000 && x < ch.fim * 1000;
    for (const g of grupos) {
      for (const [a, z] of cortes(g.ini, g.fim, trocas, emCreme)) {
        const meio = (a + z) / 2, c = emCreme(meio);
        linhaProgressiva(P, g, { fonte: F.leg, estilo: estL, medida: med, cy: c ? (naAbertura(meio) ? 1690 : 1590) : 1300, cor: c ? TINTA : LIMAO,
          sombra: c ? null : sombra, a, z, nome: 'leg' });
      }
    }
  },
};

// corta [a, z] nas trocas de fundo que caem dentro dele; trechos vizinhos no mesmo lugar ficam juntos
function cortes(a, z, trocas, lugar) {
  const pontos = [a, ...trocas.filter((x) => x > a && x < z).sort((p, q) => p - q), z];
  const out = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const [p, q] = [pontos[i], pontos[i + 1]];
    const ult = out[out.length - 1];
    if (ult && lugar((ult[0] + ult[1]) / 2) === lugar((p + q) / 2)) ult[1] = q; else out.push([p, q]);
  }
  return out;
}
