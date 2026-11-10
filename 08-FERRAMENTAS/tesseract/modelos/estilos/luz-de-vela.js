// Luz de Vela: o estilo de carrossel aprovado (escuro com luz dourada) virando edição de Reels. Clima de autoridade:
// tom quente e escuro, serifa clássica, dourado só no destaque. O que era parado na lâmina passa a mexer:
//   foco de luz dourada cortado pela borda -> luz que respira devagar no canto de cima
//   fio dourado acima da chamada           -> fio que se desenha antes do título
//   destaque em itálico dourado            -> a palavra falada acende em itálico dourado na legenda
//   mockup claro com fio dourado           -> B-roll num cartão com fio dourado, que entra devagar e nunca cobre o rosto
// Marca (ctx.marca, do tema-marca.js): o escuro, o creme e o dourado viram o escuro, o claro e o acento da empresa; a serifa
// vira a principal e o rótulo a mono. O destaque em itálico usa a principal só se ela tiver itálico; senão, a letra de acento
// da marca ou a itálica do estilo. Com a letra da marca, título, legenda e palavra final encolhem até caber; texto sem
// contraste volta à cor do estilo, com aviso no log. O brilho (textura dourada) é tingido com o acento da marca (giro de
// matiz, a claridade de cada tom fica) e a grade de cor acompanha a marca: o toque quente vira frio com um acento frio, na
// mesma medida leve. Sem marca, nada muda.
const path = require('path');
const { agrupa, EASE, hex, elipse } = require('../motor');
const { linhaMista, ehDestaque, ancora, docLinha, comVar, desfoca, pessoaEmJanela, cenaEmJanela, pessoaRecortadaReduzida, enquadre } = require('./_comum');
const { limpa } = require('../motor');
const temaMarca = require('../tema-marca');
const { giroDeMatiz } = require('./_matiz');
const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Luz de Vela',
  descricao: 'Escuro com luz dourada que respira, serifa clássica, destaque em itálico dourado, fio que se desenha e B-roll em cartão com fio dourado.',
  quadros: [0.3, 1.4, 2.8, 4.9, 6.2, 8.4, 12.8],
  capa: 1.6,
  montar({ P, DUR, palavras, pedido, cenas, acento, arquivoMatte, marca = null }) {
    const est = { reg: { arquivo: 'CormorantGaramond-SemiBold.ttf', style: 'SemiBold', size: 92 },
      ita: { arquivo: 'CormorantGaramond-SemiBoldItalic.ttf', style: 'SemiBold Italic', size: 92 },
      titulo: { arquivo: 'CormorantGaramond-SemiBold.ttf', style: 'SemiBold', size: 150 },
      tituloIta: { arquivo: 'CormorantGaramond-SemiBoldItalic.ttf', style: 'SemiBold Italic', size: 150 },
      rot: { arquivo: 'Inter.ttf', style: 'Medium', size: 32, tracking: 320, allCaps: true } };
    const reg = P.fonte(est.reg.arquivo), ita = P.fonte(est.ita.arquivo), inter = P.fonte(est.rot.arquivo);
    // a Cormorant estática vem com o nome de estilo que o Tesseract registrou na importação
    est.reg.style = est.titulo.style = reg.style; est.ita.style = est.tituloIta.style = ita.style;
    // letra de cada texto: a da marca no papel, ou a do estilo. O itálico do destaque vai para a principal só se ela tiver
    // itálico; senão, para a letra de acento da marca (sem ela, fica a itálica do estilo)
    const F = { reg, ita, titulo: reg, tituloIta: ita, rot: inter };
    if (marca) {
      const italico = temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
      const papel = { reg: 'principal', titulo: 'principal', ita: italico ? 'principal' : 'acento', tituloIta: italico ? 'principal' : 'acento', rot: 'mono' };
      for (const k of Object.keys(est)) {
        const m = temaMarca.letra(P, marca, papel[k], est[k]);
        if (m) { F[k] = m.fonte; est[k] = m.est; }
      }
    }
    // C0: a paleta do estilo (escuro, creme e dourado); C: a paleta em uso, com a marca
    const C0 = { escuro: hex('#0B0A09'), claro: hex('#F3EBDD'), acento: hex('#E2B455') };
    const C = { ...C0, acento: acento || C0.acento };
    if (marca) for (const k of ['escuro', 'claro', 'acento']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    const OURO = C.acento; // fios, cartão e anel; os textos passam pelo contraste abaixo
    // contraste com a marca. Telas lisas (B-roll e palavra final): o fundo é o escuro da marca se o creme dela contrasta 3:1
    // com ele (senão, o escuro do estilo); o texto pede 3:1 contra esse fundo, ou volta à cor do estilo (e, se nem ela, ao
    // creme ou ao escuro do estilo, o que contrastar mais). Sobre o vídeo, 4,5:1 contra o escuro da marca, ou a cor do estilo
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const igual = (p, q) => p.every((v, i) => v === q[i]);
    const mudou = (k) => !igual(C[k], C0[k]);
    const telaDoEstilo = !!marca && (mudou('claro') || mudou('escuro')) && !temaMarca.contrasteOk(C.claro, C.escuro, 3);
    if (telaDoEstilo) avisa('tela escura: o creme da marca fica sem contraste (abaixo de 3:1) sobre o escuro da marca; usando o escuro original do estilo.');
    const ESCURO = telaDoEstilo ? C0.escuro : C.escuro;
    const naTela = (kt, onde) => {
      if (!marca || (!mudou(kt) && igual(ESCURO, C0.escuro)) || temaMarca.contrasteOk(C[kt], ESCURO, 3)) return C[kt];
      avisa(`${onde}: "${kt}" sobre a tela escura fica sem contraste (abaixo de 3:1) com as cores da marca; usando a cor original do estilo.`);
      if (temaMarca.contrasteOk(C0[kt], ESCURO, 3)) return C0[kt];
      return [C0.claro, C0.escuro].sort((p, q) => temaMarca.contraste(q, ESCURO) - temaMarca.contraste(p, ESCURO))[0];
    };
    const noVideo = (kt, onde) => {
      const kf = kt === 'escuro' ? 'claro' : 'escuro';
      if (!marca || !mudou(kt) || temaMarca.contrasteOk(C[kt], C[kf], 4.5)) return C[kt];
      avisa(`${onde}: "${kt}" sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.`);
      return C0[kt];
    };
    // com a letra da marca, os estilos de uma lista encolhem juntos, 15% por vez, até a linha mais larga (largura(r), por
    // padrão o texto mais largo) caber no limite; piso de 40% do corpo, no mínimo 16 px. Devolve o fator e, para cada
    // estilo, { e, m } (estilo e medidas). Sem marca, só mede, como sempre
    const maisLargo = (r) => Math.max(0, ...r.flatMap(({ m }) => Object.values(m).map((x) => x.w)));
    const cabe = (lista, limite, largura = maisLargo) => {
      const mede = (f) => lista.map(({ textos, e }) => { const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) }; return { e: ef, m: P.medir(textos, ef) }; });
      if (!marca) return { f: 1, r: mede(1) };
      const piso = Math.max(16, lista[0].e.size * 0.4);
      for (let f = 1; ; f *= 0.85) {
        let r = null;
        try { r = mede(f); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        const w = r ? largura(r) : Infinity;
        if (w <= limite) return { f, r };
        if (lista[0].e.size * f * 0.85 < piso) return { f, r: r || mede(f) };
      }
    };
    const sombra = { color: [0, 0, 0, 0.6], blurRadius: 22, spreadRadius: 0, blendMode: 'normal', offset: [0, 3] };

    // com o acento da marca, o brilho dourado gira o matiz até o acento (e a saturação na proporção da dele); a grade de cor
    // acompanha: a temperatura do estilo (+8, quente) vai junto com o giro (cosseno do giro, na proporção da saturação),
    // então um acento quente fica +8 e um frio, negativo, sempre leve
    const giro = marca && marca.cores.acento && mudou('acento') ? giroDeMatiz(C0.acento, C.acento) : null;
    const tinge = (c) => { if (giro) P.efeito(c, { type: 'hueSaturation', hue: giro.hue, saturation: giro.saturation, lightness: 0 }); return c; };
    const temperatura = giro ? Math.round(8 * Math.cos(giro.hue * Math.PI / 180) * Math.min(1, 1 + giro.saturation / 100)) : 8;

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });
    // grade leve: um toque quente e uma vinheta suave só nas bordas; a pessoa fica perto do vídeo original
    const tom = P.ajuste('tom', 0, DUR);
    P.efeito(tom, { type: 'temperatureTint', temperature: temperatura, tint: 1 });
    P.efeito(tom, { type: 'vignette', amount: 0.3, radius: 0.85, feather: 0.8 });
    // sem véu em faixas: a pessoa fica limpa; a legenda se apoia na vinheta e na sombra do texto
    // o foco de luz dourada, cortado pela borda de cima à direita, respirando devagar; é um brilho suave (textura
    // luz-dourada), fraco o bastante para nunca apagar o rosto
    P.importaImagem('luz-dourada', TEX('luz-dourada'));
    const luz = tinge(P.imagem('luz-dourada', 0, DUR, [540, 960], { fit: 'cover', opacidade: 55 }));
    const resp = []; for (let t = 0; t <= DUR; t += 2600) resp.push([t, (t / 2600) % 2 ? 38 : 55, EASE.suave]);
    P.kf(luz, 'opacity', resp);

    // abertura: rótulo espaçado dourado, fio que se desenha e título serifado com o destaque em itálico dourado
    const ch = pedido.chamada;
    let fimChamada = 0;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000; fimChamada = z;
      const pal = ch.palavra || ch.texto.split(' ')[0];
      const resto = ch.texto.replace(pal, '').trim();
      const rot = 'NUTRIÇÃO';
      const x0 = 96, y0 = 1060;
      // com a letra da marca, o rótulo e o título encolhem até caber entre as margens de 96 px; a primeira linha do título
      // fica onde está e as outras sobem junto com o corpo, então o título nunca sobe para o rosto
      const { r: [{ e: estR, m: mRs }] } = cabe([{ textos: [rot], e: est.rot }], 888);
      const mR = mRs[rot];
      P.texto('rot', a, z, [x0 + mR.w / 2, y0], comVar({ ...docLinha(F.rot, estR), text: rot, fillColor: noVideo('acento', 'rótulo') }), ancora(mR));
      const fio = P.forma('fio', a + 150, z, { commands: [{ type: 'moveTo', x: x0, y: y0 - 56 }, { type: 'lineTo', x: x0 + 140, y: y0 - 56 }] }, { traco: OURO, largura: 3, trim: 0, cap: 'butt' });
      P.kf(fio, 'trimEnd', [[0, 0], [600, 100, EASE.saida]]);
      const linhas = quebra(resto, 12);
      const { f: fT, r: [{ e: estT, m: mA }, { e: estTI, m: mIs }] } = cabe([{ textos: linhas, e: est.titulo }, { textos: [pal], e: est.tituloIta }], 888);
      const mI = mIs[pal];
      const t1 = P.texto('titulo-1', a + 250, z, [x0 + mI.w / 2, y0 + 140], comVar({ ...docLinha(F.tituloIta, estTI), text: pal, fillColor: noVideo('acento', 'título') }), ancora(mI));
      const corT = noVideo('claro', 'título');
      const ts = [t1, ...linhas.map((l, k) => P.texto('titulo-' + (k + 2), a + 450 + k * 120, z, [x0 + mA[l].w / 2, y0 + 140 + (150 + k * 150) * fT], comVar({ ...docLinha(F.titulo, estT), text: l, fillColor: corT }), ancora(mA[l])))];
      ts.forEach((t) => { t.dropShadow = sombra; P.fade(t, 'softRise', 'fade'); });
    }

    // B-roll em cartão com fio dourado, entrando devagar, sem nunca cobrir o rosto. Arranjos (pedido.rosto.layout):
    //   imagem-mini: o vídeo segue inteiro e a imagem entra pequena, abaixo do queixo, à direita
    //   rosto-mini:  a imagem ocupa a tela escura e a pessoa vai para um círculo com fio dourado
    //   dividir:     a imagem em cima e a pessoa num cartão embaixo
    //   lado-a-lado: a pessoa num cartão alto à esquerda e a imagem à direita
    //   recorte:     a pessoa recortada do fundo, pequena, ao lado da imagem
    // A pessoa nunca sai de cena quando a imagem de destaque entra. O rosto em miniatura só entra quando a imagem já está
    // na tela.
    // pedido.rosto.y: altura do rosto no vídeo de origem (px, 0-1920), para as janelas enquadrarem a pessoa
    const rosto = pedido.rosto || {}, layout = rosto.layout || 'rosto-mini', rostoY = rosto.y ?? 600;
    const cartao = (nome, a, z, j) => { const f = P.ret(nome + '-fio', a, z, [j.x - 3, j.y - 3], [j.w + 6, j.h + 6], OURO); P.fade(f, 'fade', 'fade'); return f; };
    const janelas = [];
    let cyLegCartao = 1460;
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000; janelas.push([a, z]);
      if (layout !== 'imagem-mini') {
        const f = P.ret('broll-fundo', a, z, [0, 0], [1080, 1920], ESCURO); P.fade(f, 'fade', 'fade');
        const l = tinge(P.imagem('luz-dourada', a, z, [540, 960], { fit: 'cover', opacidade: 70 })); P.fade(l, 'fade', 'fade');
      }
      const [jImg, sImg] = { 'imagem-mini': [{ x: 624, y: 1000, w: 360, h: 360 }, 47],
        'rosto-mini': [{ x: 190, y: 240, w: 700, h: 900 }, 68],
        dividir: [{ x: 190, y: 250, w: 700, h: 550 }, 70],
        'lado-a-lado': [{ x: 560, y: 300, w: 480, h: 1000 }, 52],
        recorte: [{ x: 84, y: 250, w: 516, h: 650 }, 62] }[layout];
      cartao('broll', a, z, jImg);
      const img = cenaEmJanela(P, b.id, a, z, jImg, { escala: sImg });
      P.fade(img, 'fade', 'fade');
      if (layout === 'rosto-mini') {
        const j = { cx: 810, cy: 1180, r: 160 };
        // cabeça acima do centro e queixo longe do fio: sobram pescoço e ombros dentro do círculo
        const v = pessoaEmJanela(P, a, z, j, { ...enquadre(j, rostoY, { cabeca: rosto.cabeca }), durFonte: DUR });
        const anel = P.forma('pessoa-anel', a, z, elipse(j.cx, j.cy, j.r + 5, j.r + 5), { traco: OURO, largura: 4 });
        for (const c of [v, anel]) P.fade(c, 'fade', 'fade');
      } else if (layout === 'dividir') {
        const j = { x: 108, y: 860, w: 864, h: 560 };
        cartao('pessoa', a, z, j);
        P.fade(pessoaEmJanela(P, a, z, j, { escala: 80, rostoY, durFonte: DUR }), 'fade', 'fade');
        cyLegCartao = 1510;
      } else if (layout === 'lado-a-lado') {
        const j = { x: 40, y: 300, w: 480, h: 1000 };
        cartao('pessoa', a, z, j);
        P.fade(pessoaEmJanela(P, a, z, j, { escala: 90, rostoY, durFonte: DUR }), 'fade', 'fade');
        cyLegCartao = 1440;
      } else if (layout === 'recorte') {
        const p = pessoaRecortadaReduzida(P, a, z, { escala: 45, cx: 830, yBase: 1500, desvanece: 170, durFonte: DUR, arquivoMatte });
        if (p) P.fade(p, 'fade', 'fade');
      }
    }

    // tela da palavra final: escuro, a luz forte e a palavra em itálico dourado sob o fio
    const tela = pedido.palavraTela;
    let jTela = null;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000); jTela = [a, z];
      P.ret('tela-fundo', a, z, [0, 0], [1080, 1920], ESCURO);
      tinge(P.imagem('luz-dourada', a, z, [540, 960], { fit: 'cover', opacidade: 90 }));
      const pal = limpa(tela.texto.toLowerCase());
      const { r: [{ e: estP, m: mP }] } = cabe([{ textos: [pal], e: est.tituloIta }], 936);
      const m = mP[pal];
      const f = P.forma('tela-fio', a, z, { commands: [{ type: 'moveTo', x: 470, y: 850 }, { type: 'lineTo', x: 610, y: 850 }] }, { traco: OURO, largura: 3, trim: 0, cap: 'butt' });
      P.kf(f, 'trimEnd', [[0, 0], [500, 100, EASE.saida]]);
      const t = P.texto('tela-palavra', a + 200, z, [540, 960], comVar({ ...docLinha(F.tituloIta, estP), text: pal, fillColor: naTela('acento', 'palavra final') }), ancora(m));
      desfoca(P, t, [[0, 18], [700, 0, EASE.saida]]);
      P.fade(t, 'fade', 'none');
    }

    // legenda em frases, serifada creme; a palavra de destaque acende em itálico dourado dentro da frase
    const destaque = ehDestaque(pedido);
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 22, pausa: 400 }).filter((g) => g.ini >= fimChamada && !(jTela && g.ini >= jTela[0]));
    const trechos = grupos.map((g) => {
      const out = [];
      g.palavras.forEach((p) => {
        const it = destaque(p.w); const ult = out[out.length - 1];
        if (ult && ult.it === it) ult.texto += ' ' + limpa(p.w); else out.push({ it, texto: limpa(p.w), ini: p.ini });
      });
      return out;
    });
    // com a letra da marca, todas as frases encolhem juntas até a mais larga (trechos e espaços de 22 px) caber em 936 px
    const largura = ([{ m: mr }, { m: mi }]) => Math.max(0, ...grupos.map((g, i) => (g.fim - g.ini < 150 ? 0
      : trechos[i].reduce((s, t) => s + (t.it ? mi : mr)[t.texto].w, 0) + 22 * (trechos[i].length - 1))));
    const { r: [{ e: estL, m: medR }, { e: estLI, m: medI }] } = cabe([{ textos: trechos.flat().filter((t) => !t.it).map((t) => t.texto), e: est.reg },
      { textos: trechos.flat().filter((t) => t.it).map((t) => t.texto), e: est.ita }], 936, largura);
    // no B-roll (menos na imagem-mini), a legenda fica na tela escura; fora dele, sobre o vídeo
    grupos.forEach((g, i) => {
      if (g.fim - g.ini < 150) return;
      const noCartao = janelas.some(([x, y]) => g.ini < y && g.fim > x);
      const sobre = noCartao && layout !== 'imagem-mini' ? naTela : noVideo;
      const cBase = sobre('claro', 'legenda'), cDest = sobre('acento', 'destaque da legenda');
      const camadas = linhaMista(P, trechos[i].map((t) => ({ texto: t.texto, fonte: t.it ? F.ita : F.reg, estilo: t.it ? estLI : estL, m: (t.it ? medI : medR)[t.texto],
        cor: t.it ? cDest : cBase, sombra, a: t.it ? t.ini : g.ini })), { cy: noCartao ? cyLegCartao : 1420, a: g.ini, z: g.fim, espaco: 22, nome: 'leg' });
      camadas.forEach((c) => P.fade(c, 'fade', 'none'));
    });
  },
};

function comAlfa(c, a) { return [c[0], c[1], c[2], a]; }
// quebra um texto em linhas de até n caracteres, sem cortar palavra
function quebra(texto, n) {
  const out = []; let cur = '';
  for (const w of texto.split(/\s+/).filter(Boolean)) { if ((cur + ' ' + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) out.push(cur);
  return out;
}
