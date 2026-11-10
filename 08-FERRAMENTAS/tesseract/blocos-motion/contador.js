// Bloco `contador`: número que sobe de um valor a outro na duração de uma frase (regra V-03: o número sobe durante a frase e
// para no valor final quando a frase termina). O Tesseract não anima o conteúdo de um texto por valor, então o número é uma
// sequência de camadas de texto, cada uma ativa por um passo de ~0,05 s. Placa escura com rótulo mono e legenda opcional.
'use strict';
const { CLARO, ACENTO, alfa, cor, PRINCIPAL, MONO, EASE, HL } = require('./nucleo');

const tipo = 'contador';
const PASSO = 0.05;      // s entre dois números
const MAX_PASSOS = 60;

const formata = (v, casas) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  if (typeof o.de !== 'number' || typeof o.ate !== 'number') e.push('opcoes.de e opcoes.ate: números (valor inicial e final)');
  else if (o.de === o.ate) e.push('opcoes.de e opcoes.ate não podem ser iguais');
  if (t.rotulo !== undefined && typeof t.rotulo !== 'string') e.push('textos.rotulo: texto');
  if (t.legenda !== undefined && typeof t.legenda !== 'string') e.push('textos.legenda: texto');
  if (o.casas !== undefined && !(Number.isInteger(o.casas) && o.casas >= 0 && o.casas <= 3)) e.push('opcoes.casas: inteiro de 0 a 3');
  const a = o.contaDe ?? bloco.inicio + 0.3, z = o.contaAte ?? bloco.fim - 0.6;
  if (!(z > a)) e.push('a contagem precisa de tempo: contaDe < contaAte (o bloco é curto demais)');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const casas = o.casas ?? 0, pre = o.prefixo ?? '', suf = o.sufixo ?? '';
  const corNum = cor(o.cor, ACENTO);
  const ca = o.contaDe ?? A0 + 0.3, cz = o.contaAte ?? Z - 0.6;
  const avisos = [];

  const p = c.painel('painel', A0, Z, o.altura ?? 350, { entrada: 'corte' });
  const apoio = [];
  if (t.rotulo) {
    apoio.push(c.texto('rotulo', A0, Z, [130, 979], [820, 42], t.rotulo, { fonte: MONO, estilo: 'Regular', tam: 30, cor: alfa(CLARO, 0.78), just: 'left', tracking: 220 }));
  }

  // número: de ca a cz com saída suave (rápido no começo, assenta no fim); depois fica parado no valor final até Z
  const n = Math.max(2, Math.min(MAX_PASSOS, Math.round((cz - ca) / PASSO)));
  if ((cz - ca) / PASSO > MAX_PASSOS) avisos.push(`contador ${bloco.id}: contagem longa; usando ${MAX_PASSOS} passos de ${((cz - ca) / MAX_PASSOS).toFixed(2)} s`);
  const tam = o.tam ?? 150, yNum = 1020;
  const caixa = [860, Math.round(tam * 1.14)];
  const nums = [];
  for (let i = 0; i <= n; i++) {
    const p_ = i / n, v = o.de + (o.ate - o.de) * (1 - Math.pow(1 - p_, 3));
    const ini = i === 0 ? A0 : ca + (cz - ca) * (i / n);
    const fim = i === n ? Z : ca + (cz - ca) * ((i + 1) / n);
    nums.push(c.texto(`n${i}`, ini, fim, [130, yNum], caixa, pre + formata(i === n ? o.ate : v, casas) + suf, { ...HL, tam, cor: corNum, caixaAlta: false }));
  }
  if (t.legenda) {
    apoio.push(c.texto('legenda', A0, Z, [130, 1215], [860, 60], t.legenda, { fonte: PRINCIPAL, estilo: 'SemiBold', tam: 36, cor: CLARO, just: 'left', tracking: -10, caixaAlta: false, vAlign: 'center' }));
  }

  // painel e apoio acendem juntos; o primeiro número acende com eles; os demais entram direto no passo
  c.kf(p, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.26, 100], [Z - 0.18, 100, EASE.hold], [Z, 0, EASE.suave]]);
  for (const x of [...apoio, nums[0]]) {
    c.kf(x, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.1, 0, EASE.hold], [A0 + 0.3, 100], [Z - 0.18, 100, EASE.hold], [Z, 0, EASE.suave]]);
  }
  nums.slice(1).forEach((x) => c.kf(x, 'opacity', [[x.a, 100, EASE.hold], [Math.max(x.a + 0.01, Z - 0.18), 100, EASE.hold], [Z, 0, EASE.suave]]));
  c.som('tile', A0, 'contador ' + bloco.id);
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }], avisos, tempos: { contaDe: ca, contaAte: cz } };
}

const exemplo = {
  id: 'contador-metragem', tipo: 'contador', inicio: 20.0, fim: 24.0,
  textos: { rotulo: 'ÁREA ÚTIL', legenda: 'metros quadrados, medidos na planta' },
  opcoes: { de: 0, ate: 72, sufixo: ' m²', contaDe: 20.4, contaAte: 22.6 },
};
const campos = {
  'textos.rotulo': 'rótulo mono acima do número (opcional)',
  'textos.legenda': 'frase pequena sob o número (opcional)',
  'opcoes.de / ate': 'valor inicial e final (obrigatórios)',
  'opcoes.casas': 'casas decimais (0 a 3; padrão 0)',
  'opcoes.prefixo / sufixo': 'ex.: "R$ " ou " m²"',
  'opcoes.contaDe / contaAte': 'início e fim da contagem, em segundos; amarre na frase (padrão: inicio+0,3 e fim-0,6)',
  'opcoes.cor / tam': 'cor do número (papel ou #RRGGBB; padrão acento) e corpo (padrão 150)',
};
module.exports = { tipo, descricao: 'Número que sobe de um valor a outro durante a frase e para no valor final.', validar, construir, exemplo, campos };
