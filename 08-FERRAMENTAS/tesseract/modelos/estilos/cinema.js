// Cinema: delicado e cinematográfico. Granulação de filme e tom quente, título manuscrito com brilho saindo do desfoque,
// legenda serifada em frases com a palavra de destaque em itálico e B-roll que sobe pela metade de baixo com uma estrela na emenda.
// Marca (ctx.marca, do tema-marca.js): o creme do subtítulo e da legenda vira o claro da empresa (só com a cor de acento no
// pedido, o acento, como já era); o branco do título e das estrelas e a tinta escura sobre a imagem são cores fixas e ficam. A serifa vira a letra
// principal; o itálico do destaque, a principal só se ela tiver itálico (senão, a letra de acento da marca ou a itálica do
// estilo); a manuscrita do título fica a do estilo, com qualquer marca (é o jeito do estilo: só as cores mudam). Com a letra
// da marca, os textos encolhem até caber; texto sem contraste sobre o vídeo volta à cor do estilo, com aviso no log. Com ou
// sem marca, a frase que atravessa a borda da meia tela da imagem troca de cor na borda (a tinta nunca fica sobre o vídeo).
const { agrupa, EASE, hex, retangulo, estrela } = require('../motor');
const { linhaMista, ehDestaque, desfoca, ancora, docLinha, comVar } = require('./_comum');
const { limpa } = require('../motor');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Cinema',
  descricao: 'Filme: granulação e tom quente, título manuscrito com brilho, legenda serifada com itálico e B-roll em meia tela.',
  quadros: [0.3, 1.2, 2.6, 4.9, 7.0, 8.2, 13.2],
  capa: 1.4, // segundo usado como capa na galeria
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { reg: { arquivo: 'InstrumentSerif-Regular.ttf', style: 'Regular', size: 84 },
      ita: { arquivo: 'InstrumentSerif-Italic.ttf', style: 'Italic', size: 84 },
      script: { arquivo: 'GreatVibes-Regular.ttf', style: 'Regular', size: 190 },
      sub: { arquivo: 'InstrumentSerif-Regular.ttf', style: 'Regular', size: 56, tracking: 20 } };
    const reg0 = P.fonte(est.reg.arquivo), ita0 = P.fonte(est.ita.arquivo), vibes = P.fonte(est.script.arquivo);
    // letra de cada texto: a da marca no papel, ou a do estilo. A manuscrita do título (script) fica sempre a do estilo
    const F = { reg: reg0, ita: ita0, script: vibes, sub: reg0 };
    if (marca) {
      const italico = temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
      const papel = { reg: 'principal', sub: 'principal', ita: italico ? 'principal' : 'acento' };
      for (const k of Object.keys(papel)) {
        const m = temaMarca.letra(P, marca, papel[k], est[k]);
        if (m) { F[k] = m.fonte; est[k] = m.est; }
      }
    }
    const reg = F.reg, ita = F.ita;
    // C0: o creme do estilo; com a marca, o claro dela (o creme é o claro do estilo; um acento de tom médio fica fraco no
    // texto fino sobre a camiseta escura). Pedido só com a cor de acento (o antigo marca.acento): o acento, como já era
    // com a cor de acento do pedido. Sobre o vídeo, pede 4,5:1 contra o escuro da marca (sem escuro na marca, contra a tinta escura fixa); senão, volta ao creme do estilo
    const CREME0 = [0.98, 0.95, 0.9, 1], TINTA = [0.1, 0.09, 0.08, 1];
    let CREME = acento || CREME0;
    const papelCreme = marca && marca.cores.claro ? 'claro' : 'acento';
    if (marca && marca.cores[papelCreme]) CREME = hex(marca.cores[papelCreme]);
    const refEscuro = marca && marca.cores.escuro ? hex(marca.cores.escuro) : TINTA;
    if (marca && !CREME.every((v, i) => v === CREME0[i]) && !temaMarca.contrasteOk(CREME, refEscuro, 4.5)) {
      console.warn(`[marca] subtítulo e legenda: o "${papelCreme}" sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.`);
      CREME = CREME0;
    }
    // com a letra da marca, os estilos de uma lista encolhem juntos, 15% por vez, até a linha mais larga (largura(r), por
    // padrão o texto mais largo) caber no limite; piso de 40% do corpo, no mínimo 16 px. Sem marca, só mede, como sempre
    const maisLargo = (r) => Math.max(0, ...r.flatMap(({ m }) => Object.values(m).map((x) => x.w)));
    const noPiso = new Set();
    const cabe = (lista, limite, largura = maisLargo) => {
      const mede = (f) => lista.map(({ textos, e }) => { const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) }; return { e: ef, m: P.medir(textos, ef) }; });
      if (!marca) return { f: 1, r: mede(1) };
      const piso = Math.max(16, lista[0].e.size * 0.4);
      for (let f = 1; ; f *= 0.85) {
        let r = null;
        try { r = mede(f); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        if (r && largura(r) <= limite) return { f, r };
        if (lista[0].e.size * f * 0.85 < piso) {
          if (r) { // no piso: fica o menor corpo medido, mesmo sem caber, e o log diz qual texto sai da tela
            const tx = r.flatMap(({ m }) => Object.entries(m)).sort((p, q) => q[1].w - p[1].w)[0][0];
            if (!noPiso.has(tx)) { noPiso.add(tx); console.warn(`[marca] o texto "${tx}" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.`); }
            return { f, r };
          }
          throw new Error(`marca: o texto "${lista.flatMap((x) => x.textos).sort((p, q) => q.length - p.length)[0]}" não cabe na tela nem com 40% do corpo da letra.`);
        }
      }
    };
    const sombra = { color: [0, 0, 0, 0.5], blurRadius: 20, spreadRadius: 0, blendMode: 'normal', offset: [0, 3] };

    const video = P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // B-roll em meia tela: sobe pela metade de baixo, com uma estrela na emenda. O apresentador continua em cena: o vídeo
    // sobe junto, para o rosto inteiro ficar acima da imagem (o espaço que sobra embaixo é coberto por ela)
    const janelas = [];
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000;
      janelas.push([a, z]);
      P.kfPos(video, [[0, [540, 960]], [a, [540, 960], EASE.hold], [a + 520, [540, 700], EASE.saida], [z - 420, [540, 700], EASE.linear], [z, [540, 960], EASE.entrada]]);
      const img = P.imagem(b.id, a, z, [540, 1460], { fit: 'cover' });
      P.mascara(img, retangulo(0, 500, 1080, 920)); // no quadro: de y=1000 até o fim
      P.kfPos(img, [[0, [540, 2380]], [520, [540, 1460], EASE.saida], [z - a - 420, [540, 1460], EASE.linear], [z - a, [540, 2380], EASE.entrada]]);
      const s = P.forma('estrela', a, z, estrela(540, 1000, 34), { preenche: [1, 1, 1, 1] });
      P.kfPos(s, [[0, [0, 920]], [520, [0, 0], EASE.saida], [z - a - 420, [0, 0], EASE.linear], [z - a, [0, 920], EASE.entrada]]);
      P.efeito(s, { type: 'outerGlow', enabled: true, color: [1, 1, 1, 1], size: 26, spread: 0, range: 50, blendMode: 'screen' });
    }

    // título: palavra manuscrita grande com brilho, subtítulo serifado e estrela
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      const palavra = ch.palavra || ch.texto.split(' ')[0];
      // com a letra da marca, a palavra encolhe até ela e a estrela do lado (10 + 22 px) caberem em 936 px; o subtítulo,
      // até caber em 936 px
      const { r: [{ e: estT, m: mTs }] } = cabe([{ textos: [palavra], e: est.script }], 872);
      const mT = mTs[palavra];
      const sub = ch.texto;
      const { r: [{ e: estS, m: mSs }] } = cabe([{ textos: [sub], e: est.sub }], 936);
      const mS = mSs[sub];
      const t = P.texto('titulo', a, z, [540, 1290], comVar({ ...docLinha(F.script, estT), text: palavra, fillColor: [1, 1, 1, 1] }), ancora(mT));
      P.efeito(t, { type: 'outerGlow', enabled: true, color: [1, 1, 1, 0.8], size: 22, spread: 0, range: 50, blendMode: 'screen' });
      desfoca(P, t, [[0, 26], [650, 0, EASE.saida], [z - a - 350, 0, EASE.linear], [z - a, 20, EASE.entrada]]);
      P.fade(t, 'fade', 'fade');
      const s = P.texto('titulo-sub', a + 300, z, [540, 1405], comVar({ ...docLinha(F.sub, estS), text: sub, fillColor: CREME }), ancora(mS));
      s.dropShadow = sombra;
      P.fade(s, 'softRise', 'fade');
      const e = P.forma('titulo-estrela', a + 450, z, estrela(540 + mT.w / 2 + 10, 1220, 22), { preenche: [1, 1, 1, 1] });
      P.fade(e, 'scale', 'fade');
    }

    // legenda em frases, serifada; o destaque vira itálico dentro da própria frase
    const destaque = ehDestaque(pedido);
    // enquanto o título está na tela (abaixo do queixo), a legenda espera: as duas não cabem juntas
    const fimTitulo = pedido.chamada ? pedido.chamada.fim * 1000 : 0;
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 24, pausa: 400 }).filter((g) => g.ini >= fimTitulo);
    // cada frase vira trechos: regular, itálico, regular
    const trechos = grupos.map((g) => {
      const out = [];
      g.palavras.forEach((p) => {
        const it = destaque(p.w);
        const ult = out[out.length - 1];
        if (ult && ult.it === it) ult.texto += ' ' + limpa(p.w); else out.push({ it, texto: limpa(p.w) });
      });
      return out;
    });
    // com a letra da marca, todas as frases encolhem juntas até a mais larga (trechos e espaços de 20 px) caber em 936 px
    const largura = ([{ m: mr }, { m: mi }]) => Math.max(0, ...grupos.map((g, i) => (g.fim - g.ini < 150 ? 0
      : trechos[i].reduce((s, t) => s + (t.it ? mi : mr)[t.texto].w, 0) + 20 * (trechos[i].length - 1))));
    const { r: [{ e: estR, m: medR }, { e: estI, m: medI }] } = cabe([{ textos: trechos.flat().filter((t) => !t.it).map((t) => t.texto), e: est.reg },
      { textos: trechos.flat().filter((t) => t.it).map((t) => t.texto), e: est.ita }], 936, largura);
    grupos.forEach((g, i) => {
      const a = g.ini;
      if (g.fim - a < 150) return;
      const naMeia = janelas.some(([x, y]) => a < y && g.fim > x);
      const linha = (a1, z1, escura) => linhaMista(P, trechos[i].map((t) => ({ texto: t.texto, fonte: t.it ? ita : reg, estilo: t.it ? estI : estR,
        m: (t.it ? medI : medR)[t.texto], cor: escura ? TINTA : CREME, sombra: escura ? null : sombra })), { cy: naMeia ? 1720 : 1480, a: a1, z: z1, espaco: 20, nome: 'leg' });
      const [x, y] = janelas.find(([p, q]) => a < q && g.fim > p) || [];
      if (!naMeia || (a >= x && g.fim <= y)) {
        linha(a, g.fim, naMeia).forEach((c) => P.fade(c, 'fade', 'none'));
        return;
      }
      // a frase que atravessa a borda da meia tela da imagem troca de cor na borda (tinta escura sobre a imagem, a cor
      // clara com sombra sobre o vídeo), para nunca ficar escura sobre o vídeo (com ou sem marca)
      let primeira = true;
      for (const [a1, z1, escura] of [[a, x, false], [x, y, true], [y, g.fim, false]]) {
        const [p, q] = [Math.max(a1, a), Math.min(z1, g.fim)];
        if (q - p < 1) continue;
        const camadas = linha(p, q, escura);
        if (primeira) camadas.forEach((c) => P.fade(c, 'fade', 'none'));
        primeira = false;
      }
    });

    // película: granulação, vinheta e tom levemente quente por cima de tudo
    const filme = P.ajuste('pelicula', 0, DUR);
    P.efeito(filme, { type: 'temperatureTint', temperature: 28, tint: 4 });
    P.efeito(filme, { type: 'vignette', amount: 0.7, radius: 0.75, feather: 0.7 });
    P.efeito(filme, { type: 'grain', amount: 0.4, size: 1.6, softness: 0.3, seed: 7 });
  },
};
