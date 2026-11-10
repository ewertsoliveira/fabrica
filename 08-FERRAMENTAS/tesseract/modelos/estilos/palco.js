// Palco: layout dividido para vídeo explicado. Ilustração ou B-roll na metade de cima, o rosto num cartão de cantos arredondados
// embaixo e a legenda palavra por palavra abaixo do cartão (dentro dele, ela caía no queixo). O cartão sai pela base para uma
// frase de fechamento em tela cheia e volta depois. Fora do palco, o vídeo fica em tela cheia só com a legenda.
// Medidas seguem a regra V-04 (áreas seguras): cena em y 0-800, cartão em y 810-1510, legenda em y 1625 no palco (1390 fora
// dele), margens de 90 px.
//
// Pedido (além dos campos comuns de montar.js):
//   palco:        { ini, fim, foco?, fundo?, escalaCena? }  intervalo em que o layout dividido vale (padrão: do 1º ao último B-roll)
//                 foco = altura (px, 0-1920) do rosto no vídeo de origem, para o cartão enquadrá-lo (padrão 760)
//   palavraTela:  { texto, ini, fim }  frase de fechamento; use "|" para quebrar linhas; a última linha leva a cor de destaque
//   aviso:        texto pequeno fixo no alto ("Ilustração · ..."), do começo ao fim (regra V-05)
//
// Marca (ctx.marca, do tema-marca.js): o fundo claro do palco vira o claro da empresa (o palco.fundo do pedido continua
// valendo), a tinta da frase de fechamento e da legenda sobre o fundo claro o escuro, e a cor de destaque o acento. O branco
// da legenda sobre o vídeo, a luz que varre a tela e a tarja do aviso ficam (cores de sistema). Nenhum véu entra sobre o
// vídeo: a legenda branca se apoia na sombra, como no estilo. Letras: a principal na legenda, no destaque e na frase; a mono
// no aviso. Com a marca, os textos encolhem até caber; o texto sobre o fundo claro pede 3:1 e o destaque sobre o vídeo 4,5:1
// contra o escuro da marca, senão voltam à cor do estilo, com aviso no log. A frase da legenda que atravessa a entrada ou a
// saída da frase de fechamento muda de cor na troca. Com ou sem marca, durante o palco a legenda sai do cartão (onde caía
// no queixo) e vai para baixo dele (y 1625), na tinta escura sobre o fundo claro, sem sombra; o destaque dela fica no
// acento se ele contrasta 3:1 com o fundo, senão na tinta. A frase que atravessa a entrada ou a saída do palco é cortada
// ali. Só com a marca, o painel da cena do B-roll é liso, na cor do fundo do palco (o montar.js prepara a cena com o fundo
// que cenaLisa() diz), em vez do cinza claro: a imagem fica sobre o fundo da marca.
const { agrupa, EASE, retArredondado, hex } = require('../motor');
const { linhaProgressiva, ehDestaque, separaDestaques, desfoca, ancora, docLinha, comVar } = require('./_comum');
const temaMarca = require('../tema-marca');

const ANTECIPA = 130; // ms: o visual chega um pouco antes da palavra (regra V-03, ~4 quadros)
const CARTAO = { x: 90, w: 900, y: 810, h: 700, raio: 44 };
const CY_PALCO = 1625; // com a marca, a legenda durante o palco: abaixo do cartão (que vai até y 1510), longe do queixo

// C0: a paleta do estilo (tinta, destaque e fundo claro do palco); C: a paleta em uso, com a marca
const C0 = { escuro: [0.09, 0.1, 0.13, 1], acento: [0.2, 0.42, 0.95, 1], claro: [0.945, 0.953, 0.96, 1] };
function paleta(marca, acento) {
  const C = { ...C0, acento: acento || C0.acento };
  if (marca) for (const k of ['acento', 'escuro', 'claro']) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
  return C;
}
// fundo do palco: o do pedido; senão o claro da marca, se o escuro dela contrasta 3:1 com ele; senão o do estilo
function fundoDoPalco(C, marca, cfg) {
  const mudou = (k) => !C[k].every((v, i) => v === C0[k][i]);
  const doEstilo = !cfg.fundo && !!marca && (mudou('claro') || mudou('escuro')) && !temaMarca.contrasteOk(C.escuro, C.claro, 3);
  return { FUNDO: cfg.fundo ? cfg.fundo : doEstilo ? C0.claro : C.claro, doEstilo };
}
const paraHex = (c) => (typeof c === 'string' ? (/^#[0-9a-f]{6}$/i.test(c) ? c.toUpperCase() : null)
  : '#' + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase());

module.exports = {
  aceitaMarca: true, // lê ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
  nome: 'Palco',
  descricao: 'Layout dividido: ilustração em cima, rosto em cartão arredondado embaixo, legenda palavra a palavra; o cartão sai para a frase de fechamento.',
  quadros: [0.5, 3.0, 6.0, 9.0, 11.5, 13.0],
  capa: 3.0,
  // com a marca, a cena do B-roll vem com o fundo liso na cor do fundo do palco ('#RRGGBB'), sem o painel cinza claro; sem
  // marca, null (a cena de sempre). Lido pelo montar.js antes de importar as cenas
  cenaLisa({ marca = null, pedido = {} } = {}) {
    if (!marca) return null;
    return paraHex(fundoDoPalco(paleta(marca, null), marca, pedido.palco || {}).FUNDO);
  },
  montar({ P, DUR, palavras, pedido, cenas, acento, marca = null }) {
    const arq = {
      leg: { arquivo: 'Inter.ttf', style: 'Bold', size: 58, tracking: -10 },
      forte: { arquivo: 'Inter.ttf', style: 'Black', size: 76, tracking: -20 },
      frase: { arquivo: 'Inter.ttf', style: 'Black', size: 112, tracking: -30 },
      aviso: { arquivo: 'Inter.ttf', style: 'Bold', size: 26, tracking: 10 },
    };
    const fonte = P.fonte(arq.leg.arquivo);
    // letra de cada texto: a da marca no papel (principal; mono no aviso), ou a do estilo
    const F = { leg: fonte, forte: fonte, frase: fonte, aviso: fonte };
    if (marca) for (const k of Object.keys(arq)) {
      const m = temaMarca.letra(P, marca, k === 'aviso' ? 'mono' : 'principal', arq[k]);
      if (m) { F[k] = m.fonte; arq[k] = m.est; }
    }
    const BRANCO = [1, 1, 1, 1];
    const C = paleta(marca, acento);
    const avisos = new Set();
    const avisa = (msg) => { if (!avisos.has(msg)) { avisos.add(msg); console.warn('[marca] ' + msg); } };
    const igual = (p, q) => p.every((v, i) => v === q[i]);
    const mudou = (k) => !igual(C[k], C0[k]);
    const cfg = pedido.palco || {};
    const { FUNDO, doEstilo: fundoDoEstilo } = fundoDoPalco(C, marca, cfg);
    if (fundoDoEstilo) avisa('fundo do palco: "escuro" sobre "claro" fica sem contraste (abaixo de 3:1) com as cores da marca; usando o fundo original do estilo.');
    // texto sobre o fundo claro: 3:1, senão a cor do estilo (e, se nem ela, a tinta ou o fundo do estilo, o que contrastar mais)
    const naTela = (kt, onde) => {
      if (!marca || (!mudou(kt) && igual(FUNDO, C0.claro)) || temaMarca.contrasteOk(C[kt], FUNDO, 3)) return C[kt];
      avisa(`${onde}: "${kt}" sobre o fundo claro fica sem contraste (abaixo de 3:1) com as cores da marca; usando a cor original do estilo.`);
      if (temaMarca.contrasteOk(C0[kt], FUNDO, 3)) return C0[kt];
      return [C0.escuro, C0.claro].sort((p, q) => temaMarca.contraste(q, FUNDO) - temaMarca.contraste(p, FUNDO))[0];
    };
    // destaque sobre o vídeo: 4,5:1 contra o escuro da marca, senão a cor do estilo
    const noVideo = (kt, onde) => {
      if (!marca || !mudou(kt) || temaMarca.contrasteOk(C[kt], C.escuro, 4.5)) return C[kt];
      avisa(`${onde}: "${kt}" sobre o vídeo fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.`);
      return C0[kt];
    };
    // (conferidos só quando o texto existe: sem a frase de fechamento no palco, nada sobre o fundo claro, nenhum aviso)
    const tinta = () => naTela('escuro', 'frase e legenda');
    const destaqueClaro = () => naTela('acento', 'destaque da frase');
    const corDestaque = () => noVideo('acento', 'destaque');
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
    const sombra = { color: [0, 0, 0, 0.55], blurRadius: 16, spreadRadius: 0, blendMode: 'normal', offset: [0, 3] };

    // vídeo base em tela cheia: carrega o áudio e é o formato fora do palco
    P.video('video', 0, DUR, { volume: 1, durFonte: DUR });

    // intervalo do palco
    const cenasMs = cenas.map((b) => [b.ini * 1000, b.fim * 1000]);
    const palco = cfg.ini !== undefined
      ? [cfg.ini * 1000, Math.min(DUR, cfg.fim * 1000)]
      : cenasMs.length ? [Math.max(0, Math.min(...cenasMs.map((c) => c[0])) - ANTECIPA), Math.min(DUR, Math.max(...cenasMs.map((c) => c[1])))] : null;
    const tela = pedido.palavraTela && palco && pedido.palavraTela.ini * 1000 >= palco[0] && pedido.palavraTela.fim * 1000 <= palco[1] + 1 ? pedido.palavraTela : null;

    if (palco) {
      const [a, z] = palco;
      const bg = P.ret('palco-fundo', a, z, [0, 0], [1080, 1920], FUNDO);
      P.fade(bg, 'fade', 'fade');

      // ilustrações da metade de cima: entram um pouco antes da palavra e saem em fade
      const escalaCena = cfg.escalaCena || 68;
      cenas.forEach((b) => {
        const ca = Math.max(a, b.ini * 1000 - ANTECIPA), cz = Math.min(z, b.fim * 1000);
        if (cz <= ca) return;
        const img = P.imagem(b.id, ca, cz, [540, 960 - 400], { escala: escalaCena, fit: 'cover' });
        P.fade(img, 'softRise', 'fade');
      });

      // cartão do rosto: uma camada por trecho em que o cartão está visível (o trecho da frase de fechamento fica de fora)
      const trechos = tela ? [[a, tela.ini * 1000], [tela.fim * 1000, z]] : [[a, z]];
      const S = CARTAO.w / 1080;                       // escala do vídeo dentro do cartão
      const hLocal = CARTAO.h / S;                      // altura da janela, em pixels do vídeo de origem
      const foco = cfg.foco ?? 760;
      const y0 = Math.max(0, Math.min(1920 - hLocal, foco - hLocal * 0.45));
      const centroY = CARTAO.y + (960 - y0) * S;        // centro da camada para a janela cair no topo do cartão
      for (const [ta, tz] of trechos) {
        if (tz - ta < 400) continue;
        const v = P.video('cartao', ta, tz, { durFonte: DUR, src0: ta, pos: [540, centroY], escala: S * 100 });
        P.mascara(v, retArredondado(0, y0, 1080, hLocal, CARTAO.raio / S));
        v.dropShadow = { color: [0, 0, 0, 0.35], blurRadius: 40, spreadRadius: 0, blendMode: 'normal', offset: [0, 16] };
        const d = tz - ta;
        P.kfPos(v, [[0, [540, centroY + 1500]], [440, [540, centroY], EASE.saida], [d - 400, [540, centroY], EASE.linear], [d, [540, centroY + 1500], EASE.entrada]]);
      }

      // faixa de luz que varre a tela na entrada e na saída do palco (marca a troca de layout)
      for (const t of [a, z - 380]) {
        const l = P.ret('luz', Math.max(0, t), t + 380, [0, 0], [1080, 8], [1, 1, 1, 0.85]);
        P.kfPos(l, [[0, [0, 0]], [380, [0, 1912], EASE.saida]]);
        P.kf(l, 'opacity', [[0, 0], [60, 100], [300, 100], [380, 0]]);
      }

      // frase de fechamento: o cartão saiu; as linhas entram uma a uma
      if (tela) {
        const linhas = tela.texto.split('|').map((s) => s.trim()).filter(Boolean);
        // com a letra da marca, as linhas encolhem até caber em 900 px (sem marca, a escala da camada já faz isso)
        const { r: [{ e: estF, m: med }] } = cabe([{ textos: linhas, e: arq.frase }], 900);
        const cy0 = 600 - ((linhas.length - 1) * 70);
        linhas.forEach((ln, i) => {
          const entra = tela.ini * 1000 + 150 + i * 380;
          const m = med[ln];
          const c = P.texto('frase-' + i, entra, tela.fim * 1000 - 120, [540, cy0 + i * 140],
            comVar({ ...docLinha(F.frase, estF), text: ln, fillColor: i === linhas.length - 1 ? destaqueClaro() : tinta() }), ancora(m),
            { escala: Math.min(100, Math.floor(900 / m.w * 100)) });
          P.fade(c, 'softRise', 'fade');
        });
      }
    }

    // aviso fixo no alto (V-05): ilustração ou simulação diz que é
    if (pedido.aviso) {
      const { r: [{ e: estA, m: mA }] } = cabe([{ textos: [pedido.aviso], e: arq.aviso }], 876);
      const m = mA[pedido.aviso];
      const w = Math.round(m.w + 60);
      P.ret('aviso-fundo', 0, DUR, [540, 110], [w, 52], [0, 0, 0, 0.5], { anchor: [w / 2, 26], raio: 1 });
      P.texto('aviso', 0, DUR, [540, 110], comVar({ ...docLinha(F.aviso, estA), text: pedido.aviso, fillColor: BRANCO }), ancora(m));
    }

    // legenda palavra a palavra; a palavra de destaque fica sozinha, maior e na cor de destaque
    const destaque = ehDestaque(pedido);
    const grupos = separaDestaques(agrupa(palavras, { maxPalavras: 3, maxChars: 22 }), destaque);
    const finas = grupos.filter((g) => !g.destaque);
    const { r: [{ e: estL, m: medFina }] } = cabe([{ textos: finas.map((g) => g.texto), e: arq.leg }], 936);
    const { r: [{ e: estD, m: medForte }] } = cabe([{ textos: grupos.filter((g) => g.destaque).map((g) => g.texto), e: arq.forte }], 936);
    const CY = 1390;
    const sobreClaro = (g) => tela && g.fim > tela.ini * 1000 + 150 && g.ini < tela.fim * 1000;
    // com ou sem marca, a frase que atravessa a entrada ou a saída da frase de fechamento é cortada ali (a tinta sobre o
    // vídeo não lê), e durante o palco a legenda vai para baixo do cartão (CY_PALCO; no cartão ela caía no queixo), na tinta
    // sobre o fundo claro: a frase que atravessa a entrada ou a saída do palco também é cortada ali
    const noPalco = (x) => !!palco && x >= palco[0] && x < palco[1];
    const trocas = [...(tela ? [tela.ini * 1000 + 150, tela.fim * 1000] : []), ...(palco || [])];
    const claroEm = (x) => !!tela && x >= tela.ini * 1000 + 150 && x < tela.fim * 1000;
    const lugar = (x) => (claroEm(x) ? 1 : 0) + (noPalco(x) ? 2 : 0);
    // destaque da legenda no palco (fora da frase de fechamento): o acento, se contrasta 3:1 com o fundo; senão a tinta
    const destaqueNoPalco = () => (temaMarca.contrasteOk(C.acento, FUNDO, 3) ? C.acento : tinta());
    for (const g of grupos) {
      if (!g.destaque) {
        for (const [a, z] of cortes(g.ini, g.fim, trocas, lugar)) {
          const meio = (a + z) / 2, cl = claroEm(meio) || noPalco(meio);
          linhaProgressiva(P, g, { fonte: F.leg, estilo: estL, medida: medFina, cy: noPalco(meio) ? CY_PALCO : CY, cor: cl ? tinta() : BRANCO,
            sombra: cl ? null : sombra, a, z, nome: 'leg' });
        }
        continue;
      }
      const m = medForte[g.texto];
      const meio = (g.ini + g.fim) / 2;
      const cl = sobreClaro(g) || noPalco(meio);
      const cor = sobreClaro(g) ? destaqueClaro() : noPalco(meio) ? destaqueNoPalco() : corDestaque();
      const c = P.texto('destaque-' + g.texto, g.ini, g.fim, [540, noPalco(meio) ? CY_PALCO : CY], comVar({ ...docLinha(F.forte, estD), text: g.texto, fillColor: cor }), ancora(m));
      if (!cl) c.dropShadow = sombra;
      P.kfEscala(c, [[0, 112], [220, 100, EASE.saida]]);
      P.kf(c, 'opacity', [[0, 0], [140, 100, EASE.saida]]);
      desfoca(P, c, [[0, 10], [220, 0, EASE.saida]]);
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
