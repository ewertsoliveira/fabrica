// Faixa: esportivo. Moldura fina na cor de acento, título em itálico pesado no topo, transição de faixas diagonais,
// legenda com o destaque em itálico pesado e o resto fino, B-roll no painel de baixo sobre a palavra repetida em contorno
// e uma tela final clara com a palavra repetida.
// Marca (ctx.marca, do tema-marca.js): o azul (moldura, painel e faixas diagonais) é o acento; o amarelo do título (a cor
// viva que salta sobre a parede clara do vídeo) também vira o acento; a tela final clara, o claro; e a legenda escura dela,
// o escuro. O branco da
// legenda sobre o vídeo, o contorno branco do painel e o contorno cinza da tela final ficam (cores de sistema). Letras: a
// principal na legenda fina; o título, o destaque e a palavra repetida são itálico pesado: vão para a principal só se ela
// tiver itálico, senão para a letra de acento da marca, senão fica a itálica do estilo. Com a marca, os textos encolhem até
// caber; o título pede 4,5:1 sobre o vídeo e a legenda da tela final 3:1, senão voltam ao estilo, com aviso no log.
// Sem marca, nada muda.
const { agrupa, EASE, retArredondado, hex } = require('../motor');
const { linhaMista, ehDestaque, ancora, docLinha, comVar } = require('./_comum');
const { limpa } = require('../motor');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Faixa',
  descricao: 'Esportivo: moldura fina, título itálico, faixas diagonais na transição, legenda com destaque pesado e B-roll em painel.',
  quadros: [0.25, 1.2, 2.6, 4.9, 7.3, 8.5, 13.3],
  capa: 1.4,
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const est = { fino: { arquivo: 'Inter.ttf', style: 'Light', size: 62, tracking: -10 },
      forte: { arquivo: 'Inter-Italic.ttf', style: 'Black Italic', size: 74, tracking: -20 },
      titulo: { arquivo: 'Inter-Italic.ttf', style: 'Black Italic', size: 150, tracking: -20, allCaps: true },
      repete: { arquivo: 'Inter-Italic.ttf', style: 'Black Italic', size: 170, tracking: -10, allCaps: true } };
    const sans = P.fonte(est.fino.arquivo), italico = P.fonte(est.forte.arquivo);
    // letra de cada texto: a da marca no papel, ou a do estilo. O itálico pesado vai para a principal só se ela tiver
    // itálico; senão, para a letra de acento da marca (sem ela, fica a itálica do estilo)
    const F = { fino: sans, forte: italico, titulo: italico, repete: italico };
    if (marca) {
      const temIt = temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
      const papelIt = temIt ? 'principal' : 'acento';
      const papel = { fino: 'principal', forte: papelIt, titulo: papelIt, repete: papelIt };
      for (const k of Object.keys(est)) {
        const m = temaMarca.letra(P, marca, papel[k], est[k]);
        if (m) { F[k] = m.fonte; est[k] = m.est; }
      }
    }
    // C0: a paleta do estilo (azul, amarelo do título, tela final clara e legenda escura); C: a paleta em uso, com a marca
    const C0 = { acento: [0.16, 0.42, 0.93, 1], titulo: [0.97, 0.84, 0.23, 1], claro: [0.94, 0.94, 0.93, 1], escuro: [0.1, 0.1, 0.1, 1] };
    const C = { ...C0, acento: acento || C0.acento };
    if (marca) for (const [k, papel] of [['acento', 'acento'], ['titulo', 'acento'], ['claro', 'claro'], ['escuro', 'escuro']]) if (marca.cores[papel]) C[k] = hex(marca.cores[papel]);
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const mudou = (k) => !C[k].every((v, i) => v === C0[k][i]);
    // título sobre o vídeo: 4,5:1 contra o escuro da marca, senão o amarelo do estilo
    let AMARELO = C.titulo;
    if (marca && mudou('titulo') && !temaMarca.contrasteOk(C.titulo, C.escuro, 4.5)) {
      avisa('título sobre o vídeo: "acento" fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
      AMARELO = C0.titulo;
    }
    // tela final: escuro sobre o claro, 3:1, senão a tela inteira volta ao par do estilo
    let [corFinal, fundoFinal] = [C.escuro, C.claro];
    if (marca && (mudou('escuro') || mudou('claro')) && !temaMarca.contrasteOk(C.escuro, C.claro, 3)) {
      avisa('tela final: "escuro" sobre "claro" fica sem contraste (abaixo de 3:1) com as cores da marca; usando o par original do estilo.');
      [corFinal, fundoFinal] = [C0.escuro, C0.claro];
    }
    const ACENTO = C.acento, BRANCO = [1, 1, 1, 1];
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
    const sombra = { color: [0, 0, 0, 0.5], blurRadius: 16, spreadRadius: 0, blendMode: 'normal', offset: [0, 4] };
    const ch = pedido.chamada;
    const palavraCh = ((ch && (ch.palavra || ch.texto.split(' ')[0])) || 'foco').toUpperCase();

    const video = P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // palavra repetida em contorno, em linhas que deslizam (fundo do painel e da tela final)
    const repetida = (a, z, y0, linhas, cor, texto) => {
      const linha = (texto + '  ').repeat(3); // cabe na caixa de 3240 px sem quebrar
      // com a letra da marca (mais larga), a palavra encolhe até 960 px, para a linha de três (com os espaços) caber na
      // caixa sem quebrar (a medição só vê uma tela de largura, então mede a palavra, não a linha). Com a itálica do estilo
      // (pedido só com cores), a palavra fica como antes: só encolhe se nem couber na medição (1018 px)
      const { r: [{ e: estR, m: mR }] } = cabe([{ textos: [texto], e: est.repete }], F.repete === italico ? 1018 : 960);
      const m = mR[texto];
      for (let k = 0; k < linhas; k++) {
        const y = y0 + k * 180;
        const t = P.texto('repete', a, z, [540, y], comVar({ ...docLinha(F.repete, estR), text: linha, fillColor: [0, 0, 0, 0], applyFill: false,
          applyStroke: true, strokeWidth: 3, strokeColor: cor }), [m.w * 1.5, (m.top + m.bottom) / 2]);
        P.kfPos(t, [[0, [540 + (k % 2 ? 160 : -160), y]], [z - a, [540 + (k % 2 ? -160 : 160), y], EASE.linear]]);
      }
    };

    // B-roll em painel: metade de baixo na cor de acento, a palavra repetida e a imagem num cartão
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000;
      // o apresentador continua em cena: o vídeo sobe junto com o painel, e o rosto inteiro fica acima da legenda e do painel
      P.kfPos(video, [[0, [540, 960]], [a, [540, 960], EASE.hold], [a + 380, [540, 700], EASE.saida], [z - 300, [540, 700], EASE.linear], [z, [540, 960], EASE.entrada]]);
      const fundo = P.ret('painel-fundo', a, z, [0, 1150], [1080, 770], ACENTO);
      P.kfPos(fundo, [[0, [0, 1920]], [380, [0, 1150], EASE.saida], [z - a - 300, [0, 1150], EASE.linear], [z - a, [0, 1920], EASE.entrada]]);
      repetida(a + 200, z - 200, 1260, 4, [1, 1, 1, 0.35], palavraCh);
      const img = P.imagem(b.id, a + 150, z - 150, [540, 1530], { escala: 80, fit: 'cover' });
      P.mascara(img, retArredondado(540 - 500, 960 - 330, 1000, 660, 20));
      P.fade(img, 'slideUp', 'fade');
    }

    // tela final clara com a palavra repetida
    const tela = pedido.palavraTela;
    let jT = null;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000);
      jT = [a, z];
      P.ret('final-fundo', a, z, [0, 0], [1080, 1920], fundoFinal);
      repetida(a, z, 150, 10, [0.75, 0.75, 0.74, 1], tela.texto.toUpperCase());
    }

    // moldura fina na cor de acento
    const M = 22, G = 6;
    [[M, M, 1080 - 2 * M, G], [M, 1920 - M - G, 1080 - 2 * M, G], [M, M, G, 1920 - 2 * M], [1080 - M - G, M, G, 1920 - 2 * M]]
      .forEach(([x, y, w, h]) => P.ret('moldura', 0, DUR, [x, y], [w, h], ACENTO));

    // título em itálico pesado no topo
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      // com a letra da marca, o título encolhe até caber entre a margem de 80 px e a da direita (920 px)
      const { r: [{ e: estT, m: mT }] } = cabe([{ textos: [palavraCh], e: est.titulo }], 920);
      const m = mT[palavraCh];
      const t = P.texto('titulo', a + 250, z, [80 + m.w / 2, 190], comVar({ ...docLinha(F.titulo, estT), text: palavraCh, fillColor: AMARELO }), ancora(m));
      t.dropShadow = sombra;
      P.fade(t, 'lateralSlideRight', 'fade');
    }

    // faixas diagonais: entram pela direita, cobrem e saem pela esquerda
    const faixas = (t) => {
      for (let i = 0; i < 7; i++) {
        const atraso = i * 35;
        const r = P.ret('faixa', t - 380, t + 380, [0, 0], [240, 2800], ACENTO, { anchor: [120, 1400], rot: -18 });
        const x = -300 + i * 230;
        P.kfPos(r, [[0, [x + 1700, 960]], [atraso, [x + 1700, 960], EASE.hold], [380, [x + 40, 960], EASE.saida], [380 + atraso, [x + 40, 960], EASE.hold], [760, [x - 1700, 960], EASE.entrada]]);
      }
    };
    faixas(Math.max(380, ch ? ch.ini * 1000 : 380));
    for (const b of cenas.slice(0, 1)) faixas(b.ini * 1000);
    if (jT) faixas(jT[0]);

    // legenda: destaque em itálico pesado, o resto fino
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
    // com a letra da marca, todas as frases encolhem juntas até a mais larga (trechos e espaços de 16 px) caber em 936 px
    const largura = ([{ m: mf }, { m: mp }]) => trechos.map((tr) => ({ w: tr.reduce((s, x) => s + (x.it ? mp : mf)[x.texto].w, 0) + 16 * (tr.length - 1),
      texto: tr.map((x) => x.texto).join(' ') })).reduce((p, q) => (q.w > p.w ? q : p), { w: 0, texto: '' });
    const { r: [{ e: estF, m: medF }, { e: estP, m: medP }] } = cabe([{ textos: trechos.flat().filter((x) => !x.it).map((x) => x.texto), e: est.fino },
      { textos: trechos.flat().filter((x) => x.it).map((x) => x.texto), e: est.forte }], 936, { largura });
    const emB = (g) => cenas.slice(0, 1).some((b) => g.ini < b.fim * 1000 && g.fim > b.ini * 1000);
    const linha = (g, i, final, a, z) => {
      const cor = final ? corFinal : BRANCO;
      const partes = trechos[i].map((x) => ({ texto: x.texto, fonte: x.it ? F.forte : F.fino, estilo: x.it ? estP : estF,
        m: (x.it ? medP : medF)[x.texto], cor, sombra: final ? null : sombra }));
      linhaMista(P, partes, { cy: final ? 960 : emB(g) ? 1090 : 1300, a, z, espaco: 16, nome: 'leg' }).forEach((c) => P.fade(c, 'fade', 'none'));
    };
    grupos.forEach((g, i) => {
      // com a marca, a frase que começa no vídeo e entra na tela final clara é cortada ali: o branco não lê sobre o claro
      if (marca && jT && g.ini < jT[0] && g.fim > jT[0]) { linha(g, i, false, g.ini, jT[0]); linha(g, i, true, jT[0], g.fim); return; }
      linha(g, i, jT && g.ini >= jT[0], g.ini, g.fim);
    });
  },
};
