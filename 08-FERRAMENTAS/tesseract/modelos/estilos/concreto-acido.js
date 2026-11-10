// Concreto Ácido: o estilo de carrossel aprovado (brutalismo tipográfico) virando edição de Reels. Letras monumentais em
// caixa alta, preto e papel, um único acento ácido. O que era parado na lâmina passa a mexer:
//   faixa ácida atrás do destaque  -> faixa que corre atrás da palavra quando ela é falada
//   colunas finas no fundo          -> colunas só nas telas pretas (nunca por cima da pessoa)
//   mockup de borda dura            -> B-roll num cartão de borda grossa com sombra dura, entrando seco, sem cobrir o rosto
//   barra de progresso da lâmina    -> barra ácida no rodapé, que enche até o fim do vídeo
// O vídeo da pessoa fica limpo: sem véu, sem colunas, sem nada por cima do rosto.
// Marca (ctx.marca, do tema-marca.js): o preto vira o escuro da empresa, o papel o claro e o ácido o acento; as letras
// monumentais viram a principal e o rótulo a mono. Com a letra da marca, título, legenda e palavra final encolhem até caber;
// texto que fica sem contraste volta ao par do estilo, com aviso no log. Sem marca, nada muda.
const { agrupa, EASE, hex } = require('../motor');
const { linhaProgressiva, ehDestaque, separaDestaques, ancora, docLinha, comVar, pessoaEmJanela, cenaEmJanela, pessoaRecortadaReduzida, enquadre } = require('./_comum');
const temaMarca = require('../tema-marca');

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Concreto Ácido',
  descricao: 'Letras monumentais, preto e papel, faixa ácida que corre atrás do destaque, B-roll em cartão de borda dura e barra de progresso.',
  quadros: [0.3, 1.2, 2.6, 4.9, 6.2, 8.4, 12.8],
  capa: 1.4,
  montar({ P, DUR, palavras, pedido, cenas, acento, arquivoMatte, marca = null }) {
    const est = { leg: { arquivo: 'Anton-Regular.ttf', style: 'Regular', size: 104, tracking: 10, allCaps: true },
      dst: { arquivo: 'Anton-Regular.ttf', style: 'Regular', size: 150, tracking: 10, allCaps: true },
      titulo: { arquivo: 'Anton-Regular.ttf', style: 'Regular', size: 160, tracking: 0, allCaps: true },
      rot: { arquivo: 'SpaceMono-Bold.ttf', style: 'Bold', size: 34, tracking: 60, allCaps: true } };
    const anton = P.fonte(est.leg.arquivo), mono = P.fonte(est.rot.arquivo);
    // letra de cada texto: a da marca no papel (principal para as monumentais, mono para o rótulo), ou a do estilo
    const F = {};
    for (const [k, e] of Object.entries(est)) {
      const m = marca ? temaMarca.letra(P, marca, k === 'rot' ? 'mono' : 'principal', e) : null;
      F[k] = m ? m.fonte : k === 'rot' ? mono : anton;
      if (m) est[k] = m.est;
    }
    // C0: a paleta do estilo (preto, papel e ácido); C: a paleta em uso, com a marca
    const C0 = { escuro: hex('#0B0B0B'), claro: hex('#F2F0E8'), acento: hex('#D4FF3A') };
    const C = { ...C0, acento: acento || C0.acento };
    if (marca) for (const k of ['escuro', 'claro', 'acento']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
    const ACIDO = C.acento, PRETO = C.escuro, PAPEL = C.claro;
    // contraste com a marca: texto sobre forma lisa do estilo pede 3:1 (senão o par volta ao estilo); texto sobre o vídeo,
    // 4,5:1 contra o escuro da marca (senão o texto volta à cor do estilo). Um aviso por caso no log
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const mudou = (k) => !C[k].every((v, i) => v === C0[k][i]);
    const par = (kt, kf, onde) => {
      if (!marca || (!mudou(kt) && !mudou(kf)) || temaMarca.contrasteOk(C[kt], C[kf], 3)) return [C[kt], C[kf]];
      avisa(`${onde}: "${kt}" sobre "${kf}" fica sem contraste (abaixo de 3:1) com as cores da marca; usando o par original do estilo.`);
      return [C0[kt], C0[kf]];
    };
    const noVideo = (kt, onde) => {
      const kf = kt === 'escuro' ? 'claro' : 'escuro';
      if (!marca || !mudou(kt) || temaMarca.contrasteOk(C[kt], C[kf], 4.5)) return C[kt];
      avisa(`${onde}: "${kt}" sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.`);
      return C0[kt];
    };
    const [corFaixaTexto, corFaixa] = par('escuro', 'acento', 'faixa do destaque');
    const [corRot, corRotFundo] = par('escuro', 'claro', 'rótulo');
    const [corTelaTexto, corTela] = par('claro', 'escuro', 'tela preta');
    const corVideo = noVideo('claro', 'título e legenda');
    // com a letra da marca (que pode ser bem mais larga que a condensada do estilo), os estilos de uma lista encolhem juntos,
    // 15% por vez, até o texto mais largo caber no limite (piso: 40% do corpo, no mínimo 16 px). Devolve o fator e, para
    // cada estilo, { e, m } (estilo e medidas). Sem marca, só mede, como sempre
    const cabe = (lista, limite) => {
      const mede = (f) => lista.map(({ textos, e }) => { const ef = f === 1 ? e : { ...e, size: Math.round(e.size * f) }; return { e: ef, m: P.medir(textos, ef) }; });
      if (!marca) return { f: 1, r: mede(1) };
      const piso = Math.max(16, lista[0].e.size * 0.4);
      for (let f = 1; ; f *= 0.85) {
        let r = null;
        try { r = mede(f); } catch (err) { if (!/maior que a área/.test(err.message)) throw err; }
        const w = r ? Math.max(0, ...r.flatMap(({ m }) => Object.values(m).map((x) => x.w))) : Infinity;
        if (w <= limite) return { f, r };
        if (lista[0].e.size * f * 0.85 < piso) return { f, r: r || mede(f) };
      }
    };
    // sem véu sobre o vídeo, a legenda clara se apoia numa sombra mais firme
    const sombra = { color: [0, 0, 0, 0.75], blurRadius: 18, spreadRadius: 0, blendMode: 'normal', offset: [0, 4] };

    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // faixa ácida que corre da esquerda para a direita atrás de um texto medido
    const faixaAtras = (nome, a, z, cx, cy, m, alturaExtra = 0) => {
      const w = m.w + 40, h = (m.bottom - m.top) + 26 + alturaExtra;
      const f = P.ret(nome, a, z, [cx - w / 2, cy - h / 2], [w, h], corFaixa);
      P.kf(f, 'scaleX', [[0, 0], [160, 100, EASE.saida]]);
      return f;
    };

    // nada cobre o rosto. Arranjos (pedido.rosto.layout), na abertura e no B-roll:
    //   imagem-mini: o vídeo segue inteiro; o título desce para baixo do queixo e a imagem entra pequena, à direita
    //   rosto-mini:  título abaixo do queixo; no B-roll, a imagem grande na tela preta e a pessoa num quadrado pequeno
    //   dividir:     título (ou imagem) em cima e a pessoa num cartão embaixo
    //   lado-a-lado: a pessoa num cartão alto à esquerda e o título (ou a imagem) à direita
    //   recorte:     título abaixo do queixo; no B-roll, a pessoa recortada do fundo, pequena, ao lado da imagem
    //                (sem a máscara da pessoa, ela vai para um quadrado pequeno, como no rosto-mini)
    // A pessoa nunca sai de cena quando a imagem de destaque entra. O rosto em miniatura só entra quando a imagem já está
    // na tela, nunca com o título sozinho.
    // pedido.rosto.y: altura do rosto no vídeo de origem (px, 0-1920), para as janelas enquadrarem a pessoa
    const rosto = pedido.rosto || {}, layout = rosto.layout || 'recorte', rostoY = rosto.y ?? 600;
    const sobreOVideo = layout === 'imagem-mini' || layout === 'recorte' || layout === 'rosto-mini';
    const telaPreta = (nome, a, z) => {
      P.ret(nome + '-fundo', a, z, [0, 0], [1080, 1920], corTela);
      for (let x = 216; x < 1080; x += 216) P.ret(nome + '-coluna', a, z, [x - 1, 0], [3, 1920], comAlfa(corTelaTexto, 0.14));
    };
    // cartão de borda grossa com sombra dura ácida; a borda é papel sobre a tela preta e preta sobre o vídeo
    const cartaoDuro = (nome, a, z, j, borda) => {
      P.ret(nome + '-sombra', a, z, [j.x + 18, j.y + 18], [j.w, j.h], ACIDO);
      P.ret(nome + '-borda', a, z, [j.x - 8, j.y - 8], [j.w + 16, j.h + 16], borda);
    };
    const pessoa = (a, z, j, escala) => {
      cartaoDuro('pessoa', a, z, j, corTelaTexto);
      // janela pequena: cabeça acima do centro e queixo longe da borda
      const enq = Math.min(j.w, j.h) <= 360 ? enquadre(j, rostoY, { cabeca: rosto.cabeca }) : { escala, rostoY };
      const v = pessoaEmJanela(P, a, z, j, { ...enq, durFonte: DUR });
      P.kf(v, 'opacity', [[0, 0], [90, 100, EASE.linear]]);
    };

    // abertura: rótulo mono em tarja, título monumental empilhado, o destaque com a faixa
    const ch = pedido.chamada;
    let fimChamada = 0;
    if (ch) {
      const a = ch.ini * 1000, z = ch.fim * 1000; fimChamada = z;
      const cfg = sobreOVideo ? { rotY: 1010, y1: 1130, passo: 150, size: 140 } : {
        dividir: { rotY: 280, y1: 390, passo: 142, size: 136 },
        'lado-a-lado': { rotY: 420, y1: 560, passo: 128, size: 116, x0: 580, quebra: 7 } }[layout];
      if (!sobreOVideo) telaPreta('abertura', a, z);
      if (layout === 'dividir') pessoa(a, z, { x: 84, y: 800, w: 912, h: 680 }, 85);
      if (layout === 'lado-a-lado') pessoa(a, z, { x: 40, y: 300, w: 480, h: 1000 }, 90);
      const pal = (ch.palavra || ch.texto.split(' ')[0]).toUpperCase();
      const resto = ch.texto.toUpperCase().replace(pal, '').trim();
      const linhas = [pal, ...quebra(resto, cfg.quebra || 10)];
      const x0 = cfg.x0 || 84;
      // com a letra da marca, o título encolhe até caber (a margem da direita é a da esquerda; no lado a lado, a da imagem);
      // a primeira linha fica onde está e as outras sobem junto com o corpo, então o título nunca sobe para o rosto
      const limite = (layout === 'lado-a-lado' ? 1040 : 996) - x0;
      const { f: fT, r: [{ e: estT, m: mT }] } = cabe([{ textos: linhas, e: { ...est.titulo, size: cfg.size } }], limite);
      const passo = cfg.passo * fT;
      const rot = 'NUTRIÇÃO · REELS';
      const { r: [{ e: estR, m: mRs }] } = cabe([{ textos: [rot], e: est.rot }], limite - 24);
      const mR = mRs[rot];
      P.ret('rot-fundo', a, z, [x0 - 12, cfg.rotY - 30], [mR.w + 24, 60], corRotFundo);
      P.texto('rot', a, z, [x0 + mR.w / 2, cfg.rotY], comVar({ ...docLinha(F.rot, estR), text: rot, fillColor: corRot }), ancora(mR));
      linhas.forEach((l, k) => {
        const m = mT[l]; const cy = cfg.y1 + k * passo; const cx = x0 + m.w / 2;
        if (k === 0) faixaAtras('titulo-faixa', a + 120, z, cx, cy, m);
        const t = P.texto('titulo-' + k, a + k * 90, z, [cx, cy], comVar({ ...docLinha(F.titulo, estT), text: l,
          fillColor: k === 0 ? corFaixaTexto : sobreOVideo ? corVideo : corTelaTexto }), ancora(m));
        if (k) t.dropShadow = sombra;
        P.kf(t, 'positionX', [[0, cx - 60], [180, cx, EASE.saida]]);
        P.kf(t, 'opacity', [[0, 0], [90, 100, EASE.linear]]);
      });
    }

    // B-roll num cartão de borda grossa com sombra dura ácida, entrando seco (sem desfoque)
    const janelas = [];
    let cyLegCartao = 1480;
    for (const b of cenas.slice(0, 1)) {
      const a = b.ini * 1000, z = b.fim * 1000; janelas.push([a, z]);
      if (layout !== 'imagem-mini') telaPreta('broll', a, z);
      const [j, s] = { 'imagem-mini': [{ x: 624, y: 1000, w: 360, h: 360 }, 47],
        'rosto-mini': [{ x: 150, y: 250, w: 780, h: 950 }, 72],
        dividir: [{ x: 190, y: 250, w: 700, h: 550 }, 70],
        'lado-a-lado': [{ x: 560, y: 300, w: 480, h: 1000 }, 52],
        recorte: [{ x: 84, y: 250, w: 516, h: 650 }, 62] }[layout];
      cartaoDuro('cartao', a, z, j, layout === 'imagem-mini' ? PRETO : corTelaTexto);
      const img = cenaEmJanela(P, b.id, a, z, j, { escala: s });
      P.kfEscala(img, [[0, s * 1.08], [140, s, EASE.saida]]);
      if (layout === 'rosto-mini') pessoa(a, z, { x: 700, y: 1080, w: 300, h: 300 }, 42);
      if (layout === 'dividir') { pessoa(a, z, { x: 108, y: 870, w: 864, h: 560 }, 80); cyLegCartao = 1520; }
      if (layout === 'lado-a-lado') { pessoa(a, z, { x: 40, y: 300, w: 480, h: 1000 }, 90); cyLegCartao = 1440; }
      if (layout === 'recorte' && !pessoaRecortadaReduzida(P, a, z, { escala: 45, cx: 830, yBase: 1500, desvanece: 170, durFonte: DUR, arquivoMatte }))
        pessoa(a, z, { x: 680, y: 1000, w: 320, h: 320 }, 44);
    }

    // tela da palavra final: fundo preto, palavra monumental sobre a faixa ácida
    const tela = pedido.palavraTela;
    let jTela = null;
    if (tela) {
      const a = tela.ini * 1000, z = Math.min(DUR, tela.fim * 1000); jTela = [a, z];
      telaPreta('tela', a, z);
      const pal = tela.texto.toUpperCase();
      // com a letra da marca, a palavra encolhe até a faixa (40 px mais larga) caber em 936 px
      const { r: [{ e: estP, m: mPs }] } = cabe([{ textos: [pal], e: est.titulo }], 896);
      const mP = mPs[pal];
      faixaAtras('tela-faixa', a + 100, z, 540, 960, mP);
      const t = P.texto('tela-palavra', a, z, [540, 960], comVar({ ...docLinha(F.titulo, estP), text: pal, fillColor: corFaixaTexto }), ancora(mP));
      P.kfEscala(t, [[0, 130], [200, 100, EASE.saida]]);
    }

    // legenda: caixa alta monumental; o destaque fica sozinho, preto sobre a faixa ácida
    const destaque = ehDestaque(pedido);
    const grupos = separaDestaques(agrupa(palavras, { maxPalavras: 3, maxChars: 16 }), destaque).filter((g) => g.ini >= fimChamada && !(jTela && g.ini >= jTela[0]));
    // com a letra da marca, todas as frases (e o destaque, na mesma proporção) encolhem juntas até a mais larga caber
    const { r: [{ e: estL, m: med }, { e: estD, m: medD }] } = cabe([
      { textos: grupos.filter((g) => !g.destaque).map((g) => g.texto.toUpperCase()), e: est.leg },
      { textos: grupos.filter((g) => g.destaque).map((g) => g.texto.toUpperCase()), e: est.dst }], 936);
    for (const g of grupos) {
      const noCartao = janelas.some(([x, y]) => g.ini < y && g.fim > x);
      const cy = noCartao ? cyLegCartao : 1360;
      const G = { ...g, texto: g.texto.toUpperCase(), palavras: g.palavras.map((p) => ({ ...p, w: p.w.toUpperCase() })) };
      if (!g.destaque) {
        // no B-roll (menos na imagem-mini), a legenda fica na tela preta; fora dele, sobre o vídeo
        const cor = noCartao && layout !== 'imagem-mini' ? corTelaTexto : corVideo;
        const { camadas } = linhaProgressiva(P, G, { fonte: F.leg, estilo: estL, medida: med, cy, cor, sombra, nome: 'leg' });
        camadas.forEach((c) => P.kf(c, 'opacity', [[0, 0], [70, 100, EASE.linear]]));
        continue;
      }
      const m = medD[G.texto];
      faixaAtras('dst-faixa', g.ini, g.fim, 540, cy, m);
      const c = P.texto('dst-' + G.texto, g.ini, g.fim, [540, cy], comVar({ ...docLinha(F.dst, estD), text: G.texto, fillColor: corFaixaTexto }), ancora(m));
      P.kfEscala(c, [[0, 112], [160, 100, EASE.saida]]);
    }

    // barra de progresso ácida no rodapé, como a da lâmina
    P.ret('barra-trilho', 0, DUR, [84, 1820], [912, 8], comAlfa(PAPEL, 0.22));
    const barra = P.ret('barra', 0, DUR, [84, 1820], [912, 8], ACIDO);
    P.kf(barra, 'scaleX', [[0, 0], [DUR, 100, EASE.linear]]);
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
