// Bloco: arquitetônico e claro. Título condensado gigante atrás da pessoa, legenda serifada que acende palavra por palavra,
// transição em blocos que sobem em degraus e cobrem a tela, e uma tela final clara com o vídeo esmaecido e o título escuro.
// Marca (ctx.marca, do tema-marca.js): os blocos da transição seguem o acento (como o antigo ctx.acento), a tela final clara
// vira o claro da empresa e o escuro (título final, legenda sobre a imagem e anel da pessoa) o escuro dela; o branco do título
// e da legenda sobre o vídeo fica (cor de sistema). Título, palavra final e legenda usam a letra principal e, com ela, encolhem
// até caber. Texto sem contraste volta ao par do estilo, com aviso no log. Com ou sem marca, a frase da legenda que
// atravessa a troca de fundo (vídeo, imagem, tela final) muda de cor e de altura na troca.
const { agrupa, EASE, hex } = require('../motor');
const { linhaProgressiva, pessoaRecortada, ancora, docLinha, comVar, pessoaRedonda } = require('./_comum');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Bloco',
  descricao: 'Arquitetônico: título condensado atrás da pessoa, legenda serifada que acende, transição em blocos e tela final clara.',
  quadros: [0.6, 2.0, 6.62, 6.9, 7.8, 8.95, 13.2],
  capa: 1.6,
  montar({ P, DUR, palavras, pedido, cenas, temMatte, acento, marca = null }) {
    const est = { leg: { arquivo: 'InstrumentSerif-Regular.ttf', style: 'Regular', size: 80 },
      titulo: { arquivo: 'Oswald.ttf', style: 'Bold', size: 330, tracking: -10, allCaps: true },
      final: { arquivo: 'Oswald.ttf', style: 'Bold', size: 150, tracking: 0, allCaps: true } };
    const serif = P.fonte(est.leg.arquivo), oswald = P.fonte(est.titulo.arquivo);
    // letra de cada texto: a principal da marca (peso mais próximo), ou a do estilo
    const F = { leg: serif, titulo: oswald, final: oswald };
    if (marca) for (const k of Object.keys(est)) {
      const m = temaMarca.letra(P, marca, 'principal', est[k]);
      if (m) { F[k] = m.fonte; est[k] = m.est; }
    }
    // C0: a paleta do estilo (os blocos claros, a tela final e o escuro); C: a paleta em uso, com a marca
    const C0 = { acento: [0.88, 0.88, 0.86, 1], claro: [0.89, 0.89, 0.87, 1], escuro: [0.1, 0.1, 0.11, 1] };
    const C = { ...C0, acento: acento || C0.acento };
    if (marca) for (const k of ['acento', 'claro', 'escuro']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    // contraste com a marca: a tela final (escuro sobre o claro) pede 3:1, senão a tela inteira volta ao par do estilo; o
    // escuro sobre a imagem do B-roll (clara) pede 4,5:1 contra o claro da marca, senão volta ao escuro do estilo
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const mudou = (k) => !C[k].every((v, i) => v === C0[k][i]);
    let [corFinal, fundoFinal] = [C.escuro, C.claro];
    if (marca && (mudou('escuro') || mudou('claro')) && !temaMarca.contrasteOk(C.escuro, C.claro, 3)) {
      avisa('tela final: "escuro" sobre "claro" fica sem contraste (abaixo de 3:1) com as cores da marca; usando o par original do estilo.');
      [corFinal, fundoFinal] = [C0.escuro, C0.claro];
    }
    let corImagem = C.escuro;
    if (marca && mudou('escuro') && !temaMarca.contrasteOk(C.escuro, C.claro, 4.5)) {
      avisa('legenda sobre a imagem: "escuro" fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.');
      corImagem = C0.escuro;
    }
    const CLARO = C.acento; // os blocos da transição
    const ESCURO = C.escuro;
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
    const sombra = { color: [0, 0, 0, 0.45], blurRadius: 18, spreadRadius: 0, blendMode: 'normal', offset: [0, 3] };

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // título condensado atrás da pessoa
    const ch = pedido.chamada;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000;
      const palavra = (ch.palavra || ch.texto.split(' ')[0]).toUpperCase();
      // com a letra da marca (mais larga que a condensada), o título encolhe até caber em 936 px, no mesmo centro; por ser
      // gigante, pode ir abaixo dos 40% do corpo (até 60 px)
      const { r: [{ e: estT, m: mT }] } = cabe([{ textos: [palavra], e: est.titulo }], 936, { minimo: 60 });
      const m = mT[palavra];
      const t = P.texto('titulo', a, z, [540, 310], comVar({ ...docLinha(F.titulo, estT), text: palavra, fillColor: [1, 1, 1, 0.9] }), ancora(m));
      P.kf(t, 'opacity', [[0, 0], [300, 100, EASE.saida], [z - a - 300, 100, EASE.linear], [z - a, 0, EASE.suave]]);
      P.kfPos(t, [[0, [540, 380]], [500, [540, 310], EASE.saida]]);
      if (temMatte) pessoaRecortada(P, a, z, DUR);
    }

    // B-roll em tela cheia; o apresentador continua em cena, num círculo no alto, acima da imagem
    const rosto = pedido.rosto || {};
    for (const b of cenas.slice(0, 1)) {
      P.imagem(b.id, b.ini * 1000, b.fim * 1000, [540, 1070], { fit: 'cover', escala: 112 });
      pessoaRedonda(P, b.ini * 1000 + 700, b.fim * 1000, { cx: 540, cy: 400, r: 240 }, { rostoY: rosto.y ?? 600, cabeca: rosto.cabeca, durFonte: DUR,
        borda: { cor: ESCURO, largura: 8 } }).forEach((c) => P.fade(c, 'fade', 'none'));
    }

    // tela final clara: fundo claro, o vídeo esmaecido por cima e o título escuro
    const tela = pedido.palavraTela;
    let jTela = null;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000);
      jTela = [a, z];
      P.ret('final-fundo', a, z, [0, 0], [1080, 1920], fundoFinal);
      const v = P.video('final-video', a, z, { durFonte: DUR, src0: a });
      v.transform.opacity = 22;
      const pal = tela.texto.toUpperCase();
      const { r: [{ e: estF, m: mF }] } = cabe([{ textos: [pal], e: est.final }], 936);
      const m = mF[pal];
      const t = P.texto('final-titulo', a, z, [540, 760], comVar({ ...docLinha(F.final, estF), text: pal, fillColor: corFinal }), ancora(m));
      P.fade(t, 'softRise', 'none');
    }

    // transição em degraus: blocos sobem de baixo para cima e cobrem a tela; no meio troca a imagem; depois somem de cima para baixo
    const LADO = 180, COLS = 6, LINHAS = 11;
    const degraus = (t) => {
      for (let c = 0; c < COLS; c++) for (let l = 0; l < LINHAS; l++) {
        const atraso = (LINHAS - 1 - l) * 28 + ((c * 7) % 5) * 22; // de baixo para cima, colunas em alturas diferentes
        const saida = l * 28 + ((c * 3) % 5) * 22;
        const a = t - 420, z = t + 420;
        const k = 1 - ((c + l) % 3) * 0.035; // três tons do mesmo claro, para os blocos aparecerem
        const r = P.ret('degrau', a, z, [c * LADO, l * LADO], [LADO + 1, LADO + 1], [CLARO[0] * k, CLARO[1] * k, CLARO[2] * k, 1]);
        P.kf(r, 'opacity', [[0, 0], [atraso, 0, EASE.hold], [atraso + 60, 100, EASE.linear], [420 + saida, 100, EASE.hold], [420 + saida + 60, 0, EASE.linear]]);
      }
    };
    for (const b of cenas.slice(0, 1)) { degraus(b.ini * 1000); degraus(b.fim * 1000); }
    if (jTela) degraus(jTela[0]);

    // legenda serifada que acende sobre o texto apagado
    const grupos = agrupa(palavras, { maxPalavras: 4, maxChars: 22 });
    const { r: [{ e: estL, m: med }] } = cabe([{ textos: grupos.map((g) => g.texto), e: est.leg }], 936);
    // a frase que atravessa a troca de fundo é cortada na troca, com ou sem marca: cada trecho com a cor e a altura do seu
    // fundo (o escuro sobre o vídeo não lê; o branco sobre a imagem clara e a tela final, também não)
    const trocas = [...cenas.slice(0, 1).flatMap((b) => [b.ini * 1000, b.fim * 1000]), ...(jTela ? [jTela[0]] : [])];
    const lugar = (x) => (jTela && x >= jTela[0] ? 'final' : cenas.slice(0, 1).some((b) => x >= b.ini * 1000 && x < b.fim * 1000) ? 'imagem' : 'video');
    const ESTILO = { final: { cy: 960, cor: corFinal, apagada: [...corFinal.slice(0, 3), 0.35] },
      imagem: { cy: 1380, cor: corImagem, apagada: [...corImagem.slice(0, 3), 0.35] },
      video: { cy: 1300, cor: [1, 1, 1, 1], apagada: [1, 1, 1, 0.42], sombra } };
    for (const g of grupos) {
      for (const [a, z] of cortes(g.ini, g.fim, trocas, lugar)) {
        const s = ESTILO[lugar((a + z) / 2)];
        linhaProgressiva(P, g, { fonte: F.leg, estilo: estL, medida: med, cy: s.cy, cor: s.cor, corApagada: s.apagada, sombra: s.sombra || null, a, z, nome: 'leg' });
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
