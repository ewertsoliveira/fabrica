// Bloco `diagrama-caixas`: dois blocos de contorno + seta (de duas pontas) + moldura tracejada com etiqueta + selos.

'use strict';
const { CLARO, ACENTO, ESCURO, alfa, MONO, EASE, seta, retArredondado, escalaTempo } = require('./nucleo');
const { construirSelo } = require('./selo');

const tipo = 'diagrama-caixas';
const DUR_ORIGINAL = 6.863, INI_ORIGINAL = 42.72;
const TEMPOS_ORIGINAIS = { caixas: 42.72, seta: 42.80, pontas: 42.95, moldura: 43.04, etiqueta: 43.29 };
const CY = 1115;           // centro vertical das caixas e da seta
const TOPO_SELOS = 1196;   // topo dos selos (centro = topo + altura / 2)

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  if (!t.esquerda) e.push('textos.esquerda: texto da caixa da esquerda (use \\n para 2 linhas)');
  if (!t.direita) e.push('textos.direita: texto da caixa da direita');
  if (!t.kicker) e.push('textos.kicker: texto mono do topo');
  const selos = t.selos || [];
  if (selos.length > 2) e.push('textos.selos: no máximo 2');
  selos.forEach((s, i) => {
    if (!s.linha) e.push(`textos.selos[${i}].linha: texto`);
    if (!(s.pop >= bloco.inicio && s.pop < bloco.fim)) e.push(`textos.selos[${i}].pop: instante dentro do bloco`);
  });
  if (o.seta && !['dupla', 'direita', 'esquerda'].includes(o.seta)) e.push('opcoes.seta: dupla | direita | esquerda');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const f = escalaTempo(A0, Z, DUR_ORIGINAL);
  const ex = o.tempos || {};
  const T = {};
  for (const [k, v] of Object.entries(TEMPOS_ORIGINAIS)) T[k] = ex[k] ?? Number(f(v - INI_ORIGINAL).toFixed(3));
  const entrada = o.entrada || 'corte';

  // placa: por padrão sem entrada (continuação de outra placa, como a ficha de documento)
  c.painel('painel', A0, Z, 350, { entrada });
  const regua = c.rect('regua', A0, Z, [130, 997], [34, 6], ACENTO);
  const kick = c.texto('kicker', A0, Z, [180, 979], [700, 42], t.kicker, { fonte: MONO, estilo: 'Regular', tam: 30, cor: alfa(CLARO, 0.78), just: 'left', tracking: 220 });
  if (entrada === 'sobe') { c.janelas(regua, [[A0 + 0.15]]); c.janelas(kick, [[A0 + 0.15]]); c.som('mockup', A0, 'diagrama ' + bloco.id); }

  // blocos
  const caixa = (nome, x, txt) => {
    const cx = x + 150, cy = CY;
    const contorno = c.rect(`${nome}-contorno`, A0, Z, [cx, cy], [300, 90], null, { raio: 16, traco: alfa(CLARO, 0.42), larguraTraco: 3, anchor: [150, 45] });
    const tx = c.texto(`${nome}-texto`, A0, Z, [x, 1070], [300, 90], txt, { tam: 30, cor: CLARO, tracking: -10, pivo: [cx, cy] });
    for (const cam of [contorno, tx]) {
      c.kf(cam, 'opacity', [[A0, 0, EASE.hold], [T.caixas + 0.25, 100]]);
      c.escala(cam, [[A0, 92], [T.caixas + 0.25, 100]]);
    }
  };
  caixa('esq', 140, t.esquerda);
  caixa('dir', 640, t.direita);

  // seta: linha que se desenha + pontas
  const modo = o.seta || 'dupla';
  const linha = c.forma('seta', A0, Z, [{ type: 'moveTo', x: 458, y: CY }, { type: 'lineTo', x: 622, y: CY }], { traco: alfa(CLARO, 0.85), largura: 5, trim: 0 });
  c.kf(linha, 'trimEnd', [[A0, 0, EASE.hold], [T.seta, 0, EASE.hold], [T.seta + 0.30, 100]]);
  if (modo !== 'esquerda') { const pd = c.forma('seta-dir', A0, Z, seta(636, CY, 'dir'), { preenche: alfa(CLARO, 0.85) }); c.janelas(pd, [[T.pontas]], 0.12); }
  if (modo !== 'direita') { const pe = c.forma('seta-esq', A0, Z, seta(444, CY, 'esq'), { preenche: alfa(CLARO, 0.85) }); c.janelas(pe, [[T.pontas]], 0.12); }

  // moldura tracejada + etiqueta (opcional)
  if (t.moldura !== undefined ? t.moldura : true) {
    const mold = c.forma('moldura', A0, Z, retArredondado(115, 1048, 850, 134, 22), { traco: ACENTO, largura: 4, tracejado: [14, 10], trim: 0 });
    c.kf(mold, 'trimEnd', [[A0, 0, EASE.hold], [T.moldura, 0, EASE.hold], [T.moldura + 0.60, 100]]);
  }
  if (t.etiqueta) {
    const fundo = c.rect('etiqueta-fundo', A0, Z, [140, 1034], [330, 30], alfa(ESCURO, 0.93));
    const etq = c.texto('etiqueta', A0, Z, [150, 1034], [320, 30], t.etiqueta, { fonte: MONO, estilo: 'Regular', tam: 22, cor: ACENTO, just: 'left', tracking: 160 });
    c.janelas(fundo, [[T.etiqueta]]); c.janelas(etq, [[T.etiqueta]]);
  }

  // selos (até 2): o primeiro pode sair (`fim`), o último fica até o fim do bloco
  (t.selos || []).forEach((s, i) => {
    const formato = s.formato || (s.sub ? 'compacto-sub' : 'compacto');
    const h = formato === 'compacto-sub' ? 100 : 80;
    const a = s.inicio ?? Number((s.pop - 0.07).toFixed(3));
    const z = s.fim ?? Z;
    construirSelo(c, { prefixo: `selo${i + 1}-`, a, z, E: s.pop, cy: TOPO_SELOS + h / 2, formato, linha: s.linha, sub: s.sub, subEntra: s.subEntra,
      sai: s.fim !== undefined, fadeSai: 0.15 });
    c.som('tile', s.pop, `selo ${i + 1} ${bloco.id}`, i === 1 ? -3 : undefined);
  });
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }], tempos: T };
}

const exemplo = {
  id: 'regra-diagrama', tipo: 'diagrama-caixas', inicio: 20.0, fim: 26.9,
  textos: {
    kicker: 'COMO VAI FUNCIONAR', esquerda: 'SEU\nNEGÓCIO', direita: 'SISTEMA\nDO PARCEIRO', etiqueta: 'AMBIENTE DE TESTE',
    selos: [
      { linha: 'SEM CUSTO EXTRA', pop: 21.7, fim: 24.2 },
      { linha: 'NADA MUDA NA ROTINA', sub: 'POR ENQUANTO', pop: 24.4, subEntra: 25.9 },
    ],
  },
  opcoes: { seta: 'dupla' },
};
const campos = {
  'textos.kicker': 'texto mono do topo da placa',
  'textos.esquerda / direita': 'texto das duas caixas (2 linhas com \\n, ~12 letras por linha)',
  'textos.etiqueta': 'etiqueta mono na cor de acento sobre a moldura (opcional)',
  'textos.moldura': 'false remove a moldura tracejada (padrão true)',
  'textos.selos': 'até 2: {linha, sub?, pop, inicio?, fim?, subEntra?}; sem `fim` o selo fica até o fim do bloco',
  'opcoes.seta': 'dupla | direita | esquerda',
  'opcoes.entrada': "'corte' (padrão, continuação de outra placa) | 'sobe'",
  'opcoes.tempos': 'caixas, seta, pontas, moldura, etiqueta (segundos absolutos)',
};
module.exports = { tipo, descricao: 'Dois blocos com seta de duas pontas, moldura tracejada com etiqueta e selos.', validar, construir, exemplo, campos, TEMPOS_ORIGINAIS };
