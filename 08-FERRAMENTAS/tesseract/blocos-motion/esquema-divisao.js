// Bloco `esquema-divisao`: uma barra (o pagamento) que se divide em duas partes, cada uma indo para o seu destino.
// Três estados no mesmo painel:
//   1. resumo   (kicker "O QUE É ...")  : a barra cresce, a parte destacada acende e vai para o destino destacado
//   2. hoje     (kicker "HOJE")         : a barra inteira cai no destino comum e a parte destacada é paga depois (seta tracejada)
//   3. divisão  (kicker "COM ...")      : a barra se abre e cada parte vai direto ao seu destino
// Só o texto, as cores, a proporção e os tempos mudam; o desenho é sempre o mesmo.
'use strict';
const { CLARO, ACENTO, ESCURO, FATOR_LARGURA, alfa, cor, MONO, EASE, K, retParcial, seta, escalaTempo } = require('./nucleo');

const tipo = 'esquema-divisao';
const DUR_ORIGINAL = 13.5;
// tempos de referência, em segundos absolutos do vídeo (inicio 8,45; fim 21,95). Os padrões de outro bloco são
// esses mesmos offsets, esticados ou encolhidos para a duração do bloco.
const TEMPOS_ORIGINAIS = {
  barra: 8.62,             // a barra começa a crescer
  destinoDestaque: 9.03,   // entra o destino da parte destacada
  destaque: 10.85,         // a parte destacada acende (estado 1)
  setaDestaque: 11.44,     // seta em L: parte destacada -> destino destacado (estado 1)
  cheioDestaque: 11.95,    // destino destacado recebe (pulso)
  hoje: 13.44,             // troca para o estado 2 (kicker "HOJE")
  destinoResto: 13.56,     // entra o destino comum (EMPRESA)
  setaResto: 14.41,        // seta barra -> destino comum (estado 2)
  cheioResto: 14.77,       // destino comum recebe tudo
  setaDepois: 15.97,       // seta tracejada destino comum -> destino destacado ("pago depois")
  divisao: 17.78,          // troca para o estado 3 (kicker "COM ...")
  destaque2: 18.02,        // a parte destacada acende de novo
  abre: 18.75,             // a barra se abre no corte
  setaDestaque2: 19.25,    // seta em L (estado 3)
  cheioDestaque2: 19.72,   // destino destacado recebe a sua parte
  setaResto2: 19.96,       // seta barra -> destino comum (estado 3)
  cheioResto2: 20.41,      // destino comum acende
  restante: 20.88,         // aparece o rótulo da parte restante e o destino comum pulsa
};
const INI_ORIGINAL = 8.45;

const BAR = { x: 130, y: 1070, h: 86, xFim: 550 };
const BL = { x: 652, w: 300, yEmp: 1070, yGov: 1200, h: 82 };

const estimaTam = (txt, larg, max, em = 0.7) => Math.max(14, Math.min(max, Math.floor(larg / (String(txt).length * em * FATOR_LARGURA))));

function resolveTempos(bloco) {
  const ex = (bloco.opcoes && bloco.opcoes.tempos) || {};
  const f = escalaTempo(bloco.inicio, bloco.fim, DUR_ORIGINAL);
  const T = {};
  for (const [k, v] of Object.entries(TEMPOS_ORIGINAIS)) T[k] = ex[k] ?? Number(f(v - INI_ORIGINAL).toFixed(3));
  return T;
}

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  for (const k of ['kicker', 'rotuloOrigem', 'parteDestaque', 'parteResto', 'destinoDestaque', 'destinoResto', 'rotuloDepois', 'rotuloNaHora']) {
    if (!t[k] && !(k === 'kicker')) e.push(`textos.${k}: texto obrigatório`);
  }
  if (!t.kicker || !(Array.isArray(t.kicker) ? t.kicker.length === 3 : typeof t.kicker === 'string')) e.push('textos.kicker: lista com 3 textos (resumo, hoje, divisão)');
  if (o.proporcao !== undefined && !(o.proporcao > 0.2 && o.proporcao < 0.8)) e.push('opcoes.proporcao: entre 0,2 e 0,8');
  if (o.tempos) {
    for (const k of Object.keys(o.tempos)) {
      if (!(k in TEMPOS_ORIGINAIS)) e.push(`opcoes.tempos.${k}: nome desconhecido (${Object.keys(TEMPOS_ORIGINAIS).join(', ')})`);
      else if (!(o.tempos[k] >= bloco.inicio && o.tempos[k] <= bloco.fim)) e.push(`opcoes.tempos.${k}: fora de [inicio, fim]`);
    }
  }
  if (bloco.fim - bloco.inicio < 6) e.push('o esquema precisa de pelo menos 6 s para os três estados');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const T = resolveTempos(bloco);
  const DEST = cor(o.corDestaque, ACENTO);
  const prop = o.proporcao ?? (305 - BAR.x) / (BAR.xFim - BAR.x);
  const xCorte = Math.round(BAR.x + prop * (BAR.xFim - BAR.x));
  const kick = Array.isArray(t.kicker) ? t.kicker : [t.kicker, t.kicker, t.kicker];
  const P = { x: 90, y: 955, w: 900, h: 350 };
  const yA1 = BAR.y + BAR.h / 2, yA3 = BL.yGov + BL.h / 2;
  const K1 = K;

  // painel e cabeçalho
  const painel = c.rect('painel', A0, Z, [P.x, P.y], [P.w, P.h], alfa(ESCURO, 0.93), { raio: 30, traco: alfa(CLARO, 0.10), larguraTraco: 2 });
  c.kf(painel, 'positionY', [[A0, P.y + 46], [A0 + 0.38, P.y]]);
  c.kf(painel, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.26, 100]]);
  c.som('mockup', A0, 'painel ' + bloco.id);
  const regua = c.rect('regua', A0, Z, [130, 997], [34, 6], ACENTO); // régua de acento
  c.janelas(regua, [[A0 + 0.15]]);
  const k = c.texto('kicker', A0, Z, [180, 979], [700, 42], kick[0], { fonte: MONO, estilo: 'Regular', tam: 30, cor: alfa(CLARO, 0.78), just: 'left', tracking: 220 });
  c.kf(k, 'textContent', [[A0, kick[0]], [T.hoje, kick[1]], [T.divisao, kick[2]]]);
  c.kf(k, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.15, 0, EASE.hold], [A0 + 0.4, 100], [T.hoje - 0.12, 100, EASE.hold], [T.hoje, 0, EASE.linear], [T.hoje + 0.2, 100],
    [T.divisao - 0.12, 100, EASE.hold], [T.divisao, 0, EASE.linear], [T.divisao + 0.2, 100]]);
  const rotPag = c.texto('rotulo-origem', A0, Z, [130, 1030], [480, 32], t.rotuloOrigem, { fonte: MONO, estilo: 'Regular', tam: 23, cor: alfa(CLARO, 0.62), just: 'left', tracking: 140 });
  c.kf(rotPag, 'opacity', [[A0, 0, EASE.hold], [T.barra, 0, EASE.hold], [T.barra + 0.28, 100]]);

  // barra: fatia destacada (esquerda) + restante (direita), juntas parecem uma barra só; crescem da esquerda
  const piv = [BAR.x, BAR.y + BAR.h / 2];
  const wFatia = xCorte - BAR.x, wResto = BAR.xFim - xCorte;
  const fatiaG = c.forma('fatia-clara', A0, Z, retParcial(BAR.x, BAR.y, wFatia, BAR.h, 16, true, false), { preenche: CLARO, pivo: piv });
  const fatiaL = c.forma('fatia-destaque', A0, Z, retParcial(BAR.x, BAR.y, wFatia, BAR.h, 16, true, false), { preenche: DEST, pivo: piv });
  const txtImp = c.texto('texto-destaque', A0, Z, [BAR.x, BAR.y], [wFatia, BAR.h], t.parteDestaque, { tam: estimaTam(t.parteDestaque, wFatia - 14, 31, 0.72), cor: ESCURO, tracking: -5 });
  const rest = c.forma('restante', A0, Z, retParcial(xCorte - 1, BAR.y, wResto + 1, BAR.h, 16, false, true), { preenche: CLARO, pivo: piv });
  const txtRest = c.texto('texto-restante', A0, Z, [xCorte, BAR.y], [wResto, BAR.h], t.parteResto, { tam: estimaTam(t.parteResto, wResto - 14, 31, 0.72), cor: ESCURO, tracking: -5 });
  const cresce = [[A0, 0, EASE.hold], [T.barra, 0, EASE.hold], [T.barra + 0.45, 100]];
  [fatiaG, rest].forEach((cam) => c.kf(cam, 'scaleX', cresce));
  // a fatia destacada só existe no estado 1 (do destaque até a troca para "hoje") e no 3
  c.janelas(fatiaL, [[T.destaque, T.hoje], [T.destaque2]]);
  c.janelas(txtImp, [[T.destaque + 0.10, T.hoje], [T.destaque2 + 0.08]]);
  c.janelas(txtRest, [[T.restante]]);
  // "se abre" (T.abre): a fatia vai 16 px para a esquerda e o restante 16 px para a direita
  const abre = (dx) => [[A0, piv[0], EASE.hold], [T.abre, piv[0], EASE.hold], [T.abre + 0.35, piv[0] + dx, EASE.saida]];
  [fatiaG, fatiaL].forEach((cam) => c.kf(cam, 'positionX', abre(-16)));
  c.kf(txtImp, 'positionX', [[A0, BAR.x, EASE.hold], [T.abre, BAR.x, EASE.hold], [T.abre + 0.35, BAR.x - 16]]);
  c.kf(rest, 'positionX', abre(16));
  c.kf(txtRest, 'positionX', [[A0, xCorte, EASE.hold], [T.abre, xCorte, EASE.hold], [T.abre + 0.35, xCorte + 16]]);
  c.som('tile', T.abre, 'barra se divide ' + bloco.id);

  // blocos de destino: contorno (sempre) + preenchimento que acende quando recebe
  const bloco_ = (papel, y, texto, entra, corCheia, janelasCheia) => {
    const contorno = c.rect(`${papel}-contorno`, A0, Z, [BL.x, y], [BL.w, BL.h], null, { raio: 16, traco: alfa(CLARO, 0.42), larguraTraco: 3 });
    const cheio = c.rect(`${papel}-cheio`, A0, Z, [BL.x + BL.w / 2, y + BL.h / 2], [BL.w, BL.h], corCheia, { raio: 16, anchor: [BL.w / 2, BL.h / 2] });
    const tam = estimaTam(texto, BL.w - 24, 40);
    const tClaro = c.texto(`${papel}-texto`, A0, Z, [BL.x, y], [BL.w, BL.h], texto, { tam, cor: CLARO, tracking: -10 });
    const tEscuro = c.texto(`${papel}-texto-cheio`, A0, Z, [BL.x, y], [BL.w, BL.h], texto, { tam, cor: ESCURO, tracking: -10 });
    [contorno, tClaro].forEach((cam) => c.kf(cam, 'opacity', [[A0, 0, EASE.hold], [entra, 0, EASE.hold], [entra + 0.25, 100]]));
    c.janelas(cheio, janelasCheia, 0.18);
    c.janelas(tEscuro, janelasCheia, 0.18);
    return { contorno, cheio, tClaro };
  };
  const gov = bloco_('destino-destaque', BL.yGov, t.destinoDestaque, T.destinoDestaque, DEST, [[T.cheioDestaque, T.hoje], [T.cheioDestaque2]]);
  const emp = bloco_('destino-resto', BL.yEmp, t.destinoResto, T.destinoResto, CLARO, [[T.cheioResto, T.divisao], [T.cheioResto2]]);
  c.escala(gov.contorno, [[A0, 92, EASE.hold], [T.destinoDestaque, 92, EASE.hold], [T.destinoDestaque + 0.30, 100]]);
  c.escala(emp.contorno, [[A0, 92, EASE.hold], [T.destinoResto, 92, EASE.hold], [T.destinoResto + 0.30, 100]]);
  // pulso de chegada: destino destacado recebe a parte (estados 1 e 3); destino comum recebe tudo (2) e o restante (3)
  const pulso = (cam, ts) => c.escala(cam, [[A0, 100, EASE.hold], ...ts.flatMap((s) => [[s, 100, EASE.hold], [s + 0.15, 106], [s + 0.40, 100]])]);
  pulso(gov.cheio, [T.cheioDestaque, T.cheioDestaque2]);
  pulso(emp.cheio, [T.cheioResto, T.restante]);
  c.som('tile', T.destinoDestaque, 'destino destacado ' + bloco.id);
  c.som('tile', T.destinoResto, 'destino comum ' + bloco.id);
  c.som('tile', T.restante, 'recebe o restante ' + bloco.id);

  // A1: barra -> destino comum (linha 1). Desenha nos estados 2 e 3
  const a1 = c.forma('seta1', A0, Z, [{ type: 'moveTo', x: 574, y: yA1 }, { type: 'lineTo', x: 628, y: yA1 }], { traco: alfa(CLARO, 0.85), largura: 5, trim: 0 });
  const a1p = c.forma('seta1-ponta', A0, Z, seta(642, yA1, 'dir'), { preenche: alfa(CLARO, 0.85) });
  c.kf(a1, 'trimEnd', [[A0, 0, EASE.hold], [T.setaResto, 0, EASE.hold], [T.setaResto + 0.34, 100], [T.divisao, 100, EASE.hold], [T.divisao + 0.01, 0, EASE.hold],
    [T.setaResto2, 0, EASE.hold], [T.setaResto2 + 0.34, 100]]);
  c.janelas(a1p, [[T.setaResto + 0.25, T.divisao], [T.setaResto2 + 0.25]], 0.12);
  c.janelas(a1, [[T.setaResto, T.divisao], [T.setaResto2]], 0.05);

  // A2 (só no estado 2): destino comum -> destino destacado, tracejada ("pagar depois")
  const xA2 = BL.x + BL.w / 2;
  const a2 = c.forma('seta2', A0, Z, [{ type: 'moveTo', x: xA2, y: BL.yEmp + BL.h + 6 }, { type: 'lineTo', x: xA2, y: BL.yGov - 16 }], { traco: DEST, largura: 5, tracejado: [9, 7], trim: 0 });
  const a2p = c.forma('seta2-ponta', A0, Z, seta(xA2, BL.yGov - 3, 'baixo', 11), { preenche: DEST });
  c.kf(a2, 'trimEnd', [[A0, 0, EASE.hold], [T.setaDepois, 0, EASE.hold], [T.setaDepois + 0.33, 100]]);
  c.janelas(a2, [[T.setaDepois, T.divisao]], 0.05);
  c.janelas(a2p, [[T.setaDepois + 0.25, T.divisao]], 0.1);
  const rotDepois = c.texto('rotulo-depois', A0, Z, [130, BL.yGov + 4], [490, BL.h - 8], t.rotuloDepois, { fonte: MONO, estilo: 'Regular', tam: 27, cor: DEST, just: 'left', tracking: 120 });
  c.janelas(rotDepois, [[T.setaDepois + 0.40, T.divisao]]);

  // A3: parte destacada -> destino destacado, em L (desce e vira à direita). Estados 1 e 3
  const xA3 = (BAR.x + xCorte) / 2 - 16, r = 22;
  const a3 = c.forma('seta3', A0, Z, [{ type: 'moveTo', x: xA3, y: BAR.y + BAR.h + 8 }, { type: 'lineTo', x: xA3, y: yA3 - r },
    { type: 'cubicTo', c1x: xA3, c1y: yA3 - r + r * K1, c2x: xA3 + r - r * K1, c2y: yA3, x: xA3 + r, y: yA3 }, { type: 'lineTo', x: 628, y: yA3 }],
  { traco: DEST, largura: 5, trim: 0 });
  const a3p = c.forma('seta3-ponta', A0, Z, seta(642, yA3, 'dir'), { preenche: DEST });
  c.kf(a3, 'trimEnd', [[A0, 0, EASE.hold], [T.setaDestaque, 0, EASE.hold], [T.setaDestaque + 0.46, 100], [T.hoje, 100, EASE.hold], [T.hoje + 0.01, 0, EASE.hold],
    [T.setaDestaque2, 0, EASE.hold], [T.setaDestaque2 + 0.46, 100]]);
  c.janelas(a3, [[T.setaDestaque, T.hoje], [T.setaDestaque2]], 0.05);
  c.janelas(a3p, [[T.setaDestaque + 0.38, T.hoje], [T.setaDestaque2 + 0.38]], 0.1);
  const rotHora = c.texto('rotulo-na-hora', A0, Z, [xA3 + 30, BAR.y + BAR.h + 12], [440, 34], t.rotuloNaHora, { fonte: MONO, estilo: 'Regular', tam: 23, cor: alfa(CLARO, 0.8), just: 'left', tracking: 120 });
  c.janelas(rotHora, [[T.setaDestaque + 0.16, T.hoje], [T.setaDestaque2 + 0.15]]);

  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }], tempos: T };
}

const exemplo = {
  id: 'regra-esquema', tipo: 'esquema-divisao', inicio: 6.0, fim: 19.5,
  textos: {
    kicker: ['O QUE É A REGRA X', 'HOJE', 'COM A REGRA X'],
    rotuloOrigem: 'VENDA DO CLIENTE',
    parteDestaque: 'TAXA', parteResto: 'RESTANTE',
    destinoDestaque: 'PARCEIRO', destinoResto: 'EMPRESA',
    rotuloDepois: 'TAXA PAGA DEPOIS', rotuloNaHora: 'NA HORA DA VENDA',
  },
  opcoes: { corDestaque: 'acento', proporcao: 0.4167 },
};
const campos = {
  'textos.kicker': 'lista de 3: estado 1 (resumo), estado 2 (hoje), estado 3 (depois da mudança)',
  'textos.rotuloOrigem': 'rótulo mono sobre a barra',
  'textos.parteDestaque / parteResto': 'texto dentro das duas partes da barra',
  'textos.destinoDestaque / destinoResto': 'destino da parte destacada (linha de baixo) e destino comum (linha de cima); até ~10 letras',
  'textos.rotuloDepois': 'rótulo na cor de destaque da seta tracejada do estado 2',
  'textos.rotuloNaHora': 'rótulo da seta em L (estados 1 e 3)',
  'opcoes.corDestaque': 'cor da parte destacada, da seta em L e do destino destacado (padrão acento)',
  'opcoes.proporcao': 'fração da barra que é a parte destacada, 0,2 a 0,8 (padrão 0,4167)',
  'opcoes.tempos': 'instantes absolutos (s) de cada passo: ' + Object.keys(TEMPOS_ORIGINAIS).join(', ') + '. O que faltar vira o ritmo de referência esticado para a duração do bloco',
};
module.exports = { tipo, descricao: 'Barra que se divide em duas partes, cada uma para o seu destino (3 estados: resumo, hoje, depois).', validar, construir, exemplo, campos, TEMPOS_ORIGINAIS };
