// Círculo: sereno e editorial. Título condensado atrás da pessoa, legenda serifada numa pílula azul (destaque em itálico),
// B-roll que entra e sai por um círculo que cresce com borda fina, e uma tela azul com anéis e o texto em caixa alta acendendo.
// Marca (ctx.marca, do tema-marca.js): o azul é o acento (bordas, pílula e tela). O texto branco e os anéis brancos ficam
// (cor de sistema). Se o branco ficar sem contraste (abaixo de 3:1) sobre o acento da empresa, a pílula e a tela continuam
// no acento e o texto delas vira o escuro da marca (contraste calculado, 3:1); só se o escuro também falhar (ou a marca não
// tiver escuro), a pílula e a tela voltam ao azul do estilo com o branco, com aviso no log. As bordas finas seguem o acento.
// Letras: a principal no título, na legenda e na caixa alta; o destaque em itálico vai para a principal só se ela tiver
// itálico, senão para a letra de acento da marca, senão fica a itálica do estilo. Com a marca, os textos encolhem até caber.
// Com ou sem marca, a caixa alta da tela só entra depois que o círculo cobriu o rosto, e a última frase dela fica até o fim
// da tela (a palavra dita antes disso aparece assim mesmo).
const { agrupa, EASE, elipse, hex } = require('../motor');
const { linhaMista, linhaProgressiva, ehDestaque, pessoaRecortada, ancora, docLinha, comVar, pessoaRedonda } = require('./_comum');
const { limpa } = require('../motor');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Círculo',
  descricao: 'Sereno: título condensado atrás da pessoa, pílula azul serifada, B-roll que entra por um círculo e tela azul com anéis.',
  quadros: [0.8, 2.6, 6.95, 7.6, 8.95, 12.9, 13.6],
  capa: 1.6,
  montar({ P, DUR, palavras, pedido, cenas, temMatte, acento, marca = null }) {
    const est = { reg: { arquivo: 'InstrumentSerif-Regular.ttf', style: 'Regular', size: 56 },
      ita: { arquivo: 'InstrumentSerif-Italic.ttf', style: 'Italic', size: 56 },
      titulo: { arquivo: 'BebasNeue-Regular.ttf', style: 'Regular', size: 300, tracking: 0 },
      caixa: { arquivo: 'BebasNeue-Regular.ttf', style: 'Regular', size: 110, tracking: 10 } };
    const reg = P.fonte(est.reg.arquivo), ita = P.fonte(est.ita.arquivo), bebas = P.fonte(est.titulo.arquivo);
    // letra de cada texto: a da marca no papel, ou a do estilo. O destaque em itálico vai para a principal só se ela tiver
    // itálico; senão, para a letra de acento da marca (sem ela, fica a itálica do estilo)
    const F = { reg, ita, titulo: bebas, caixa: bebas };
    if (marca) {
      const temIt = temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
      const papel = { reg: 'principal', titulo: 'principal', caixa: 'principal', ita: temIt ? 'principal' : 'acento' };
      for (const k of Object.keys(est)) {
        const m = temaMarca.letra(P, marca, papel[k], est[k]);
        if (m) { F[k] = m.fonte; est[k] = m.est; }
      }
      // a Bebas só tem maiúsculas: a palavra que acende sobre a caixa alta apagada vem como foi falada. Com a letra da marca
      // (que tem minúsculas), a caixa alta passa a ser do estilo do texto, senão a palavra acesa não cobre a apagada
      if (marca.fontes.principal) est.caixa = { ...est.caixa, allCaps: true };
    }
    const AZUL0 = [0.12, 0.31, 0.6, 1];
    const AZUL = (marca && marca.cores.acento ? hex(marca.cores.acento) : acento) || AZUL0, BRANCO = [1, 1, 1, 1];
    // fundo e texto da pílula e da tela: o acento com o branco, se o branco contrasta 3:1 com ele; senão, o acento com o
    // escuro da marca (se ele contrasta 3:1); senão, o azul do estilo com o branco
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    let FUNDO = AZUL, TEXTO = BRANCO;
    if (marca && !AZUL.every((v, i) => v === AZUL0[i]) && !temaMarca.contrasteOk(BRANCO, AZUL, 3)) {
      const escuro = marca.cores.escuro ? hex(marca.cores.escuro) : null;
      if (escuro && temaMarca.contrasteOk(escuro, AZUL, 3)) TEXTO = escuro;
      else {
        avisa('pílula e tela: nem o texto branco nem o escuro da marca têm contraste (3:1) sobre o acento da marca; usando o azul original do estilo.');
        FUNDO = AZUL0;
      }
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
    // linha mais larga de uma legenda em trechos (somando os espaços entre eles), com o texto dela, para o aviso
    const linhaMaisLarga = (linhas, mr, mi, espaco) => linhas.map((tr) => ({ w: tr.reduce((s, x) => s + (x.it ? mi : mr)[x.texto].w, 0) + espaco * (tr.length - 1),
      texto: tr.map((x) => x.texto).join(' ') })).reduce((p, q) => (q.w > p.w ? q : p), { w: 0, texto: '' });

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // título atrás da pessoa
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      const palavra = (ch.palavra || ch.texto.split(' ')[0]).toUpperCase();
      // com a letra da marca (mais larga que a condensada), o título encolhe até caber em 936 px, no mesmo centro; por ser
      // gigante, pode ir abaixo dos 40% do corpo (até 60 px)
      const { r: [{ e: estT, m: mT }] } = cabe([{ textos: [palavra], e: est.titulo }], 936, { minimo: 60 });
      const m = mT[palavra];
      const t = P.texto('titulo', a, z, [540, 210], comVar({ ...docLinha(F.titulo, estT), text: palavra, fillColor: [1, 1, 1, 0.93] }), ancora(m));
      P.kfPos(t, [[0, [540, 120]], [550, [540, 210], EASE.saida]]);
      P.fade(t, 'fade', 'fade');
      if (temMatte) pessoaRecortada(P, a, z, DUR);
    }

    // círculo que cresce: a forma é a máscara (alfa) da imagem, e uma cópia em traço fino faz a borda
    // (na tela, a borda tem a cor do fundo que ela abre)
    const circulo = (a, z, conteudo, cx, cy, sai = true, cor = AZUL) => {
      const R = 1500;
      const mascara = P.forma('circulo-mascara', a, z, elipse(cx, cy, R, R), { preenche: [1, 1, 1, 1], pos: [cx, cy], anchor: [cx, cy] });
      const borda = P.forma('circulo-borda', a, z, elipse(cx, cy, R, R), { traco: cor, largura: 6, pos: [cx, cy], anchor: [cx, cy] });
      const keys = [[0, 0], [650, 100, EASE.suave], ...(sai ? [[z - a - 600, 100, EASE.linear], [z - a, 0, EASE.suave]] : [])];
      [mascara, borda].forEach((f) => P.kfEscala(f, keys));
      P.matte(conteudo, mascara, 'alpha');
      return borda;
    };
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000 - 300, z = b.fim * 1000 + 300;
      const img = P.imagem(b.id, a, z, [540, 1070], { fit: 'cover', escala: 112 });
      circulo(a, z, img, 900, 1100);
      // o apresentador continua em cena: num círculo com borda azul, no alto, depois que a imagem já abriu
      const rosto = pedido.rosto || {};
      pessoaRedonda(P, a + 850, z - 500, { cx: 540, cy: 400, r: 240 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { cor: AZUL, largura: 8 } }).forEach((c) => P.fade(c, 'fade', 'fade'));
    }

    // tela azul com anéis
    const tela = pedido.palavraTela;
    let jT = null;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000);
      jT = [a, z];
      const fundo = P.ret('tela-azul', a, z, [0, 0], [1080, 1920], FUNDO);
      circulo(a, z, fundo, 180, 1600, false, FUNDO);
      [[150, 120, 160], [820, 330, 120], [960, 1560, 200], [120, 1780, 140]].forEach(([x, y, r], k) => {
        const f = P.forma('anel', a, z, elipse(x, y, r, r), { traco: [1, 1, 1, 0.55], largura: 3 });
        P.kfPos(f, [[0, [0, 0]], [z - a, [k % 2 ? 40 : -40, k % 2 ? -30 : 30], EASE.linear]]);
      });
    }

    // legenda: pílula azul serifada; na tela azul, caixa alta que acende
    const destaque = ehDestaque(pedido);
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 22 });
    const naTela = (g) => jT && g.ini >= jT[0];
    const trechos = grupos.map((g) => {
      const out = [];
      g.palavras.forEach((p) => {
        const it = destaque(p.w), ult = out[out.length - 1];
        if (ult && ult.it === it) ult.texto += ' ' + limpa(p.w); else out.push({ it, texto: limpa(p.w) });
      });
      return out;
    });
    const normais = grupos.map((g, i) => (naTela(g) ? [] : trechos[i])).flat();
    // com a letra da marca, as frases da pílula encolhem juntas até a mais larga (trechos e espaços de 14 px) caber na
    // pílula de até 936 px (64 px de folga); a caixa alta da tela, até 936 px
    const fora = grupos.map((g, i) => (naTela(g) ? null : trechos[i])).filter(Boolean);
    const largura = ([{ m: mr }, { m: mi }]) => linhaMaisLarga(fora, mr, mi, 14);
    const { r: [{ e: estR, m: medR }, { e: estI, m: medI }] } = cabe([{ textos: normais.filter((x) => !x.it).map((x) => x.texto), e: est.reg },
      { textos: normais.filter((x) => x.it).map((x) => x.texto), e: est.ita }], 872, { largura });
    const { r: [{ e: estC, m: medC }] } = cabe([{ textos: grupos.filter(naTela).map((g) => g.texto.toUpperCase()), e: est.caixa }], 936);
    const ultimaNaTela = grupos.filter(naTela).pop();
    grupos.forEach((g, i) => {
      if (naTela(g)) {
        // a caixa alta só entra depois que o círculo cobriu a tela (650 ms): antes disso, ela cairia sobre o rosto, que
        // ainda aparece. A última frase da tela fica até a tela acabar: dita antes de o círculo cobrir o rosto, ela
        // aparece assim mesmo (antes, cortada inteira pela entrada atrasada, a palavra nunca aparecia)
        const a = Math.max(g.ini, jT[0] + 650);
        const z = g === ultimaNaTela ? Math.max(g.fim, jT[1]) : g.fim;
        if (a >= z) return;
        linhaProgressiva(P, { ...g, texto: g.texto.toUpperCase() }, { fonte: F.caixa, estilo: estC, medida: medC, cy: 960, cor: TEXTO,
          corApagada: [TEXTO[0], TEXTO[1], TEXTO[2], 0.35], a, z, nome: 'caixa' });
        return;
      }
      const noBroll = cenas.slice(0, 1).some((b) => g.ini < b.fim * 1000 && g.fim > b.ini * 1000);
      const cy = noBroll ? 1380 : 1300;
      const partes = trechos[i].map((x) => ({ texto: x.texto, fonte: x.it ? F.ita : F.reg, estilo: x.it ? estI : estR, m: (x.it ? medI : medR)[x.texto], cor: TEXTO }));
      const larg = partes.reduce((s, p) => s + p.m.w, 0) + 14 * (partes.length - 1) + 64;
      const pil = P.ret('pilula', g.ini, g.fim, [540, cy], [larg, 80], FUNDO, { anchor: [larg / 2, 40], raio: 1 });
      pil.rect.strokeEnabled = true; pil.rect.strokeWidth = 3; pil.rect.strokeColor = [1, 1, 1, 0.9];
      P.fade(pil, 'fade', 'none');
      linhaMista(P, partes, { cy, a: g.ini, z: g.fim, espaco: 14, nome: 'leg' }).forEach((c) => P.fade(c, 'fade', 'none'));
    });
  },
};
