// Bloco `ficha-documento`: papel claro recriado (cabeçalho, data, título, campos QUANDO/QUEM..., rodapé "recriação gráfica · fonte").
// Sem logo nem identidade visual do órgão: é sempre recriação gráfica.
'use strict';
const { ESCURO, CLARO, ACENTO, alfa, MONO, EASE } = require('./nucleo');

const tipo = 'ficha-documento';
const PAPEL = { x: 110, y: 960, w: 860, h: 340 };
const CAMPO_TOPO = 1104;     // topo do valor do 1º campo
const PASSO_LINHA = 42;      // entre linhas de valor do mesmo campo
const ALTURA_CAMPO = 56;     // um campo de 1 linha ocupa 56 px (valor 40 + respiro)
const RODAPE_Y = 1262;

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  if (!t.titulo) e.push('textos.titulo: texto');
  if (!t.cabecalho) e.push('textos.cabecalho: ex. "ÓRGÃO · COMUNICADO"');
  if (!t.fonte && !t.rodape) e.push('textos.fonte: de onde veio o documento (vira "RECRIAÇÃO GRÁFICA · FONTE: ...")');
  if (!Array.isArray(t.campos) || !t.campos.length) e.push('textos.campos: lista de {rotulo, valores:[texto...]}');
  else {
    let y = CAMPO_TOPO;
    t.campos.forEach((c, i) => {
      if (!c.rotulo) e.push(`textos.campos[${i}].rotulo: texto`);
      const v = Array.isArray(c.valores) ? c.valores : (c.valor ? [c.valor] : []);
      if (!v.length) e.push(`textos.campos[${i}].valores: ao menos 1 valor`);
      y += ALTURA_CAMPO + PASSO_LINHA * Math.max(0, v.length - 1);
    });
    if (y > RODAPE_Y - 4) e.push('campos demais para a ficha (até 2 campos, 3 linhas de valor no total)');
  }
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const S = o.sai ?? (Z - 0.16);            // começa a sair (fade) 0,16 s antes do fim
  const CAR = ESCURO;
  const papel = c.rect('papel', A0, Z, [PAPEL.x, PAPEL.y], [PAPEL.w, PAPEL.h], CLARO, { raio: 18 });
  c.kf(papel, 'positionY', [[A0, 1006], [A0 + 0.38, PAPEL.y]]);
  c.kf(papel, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.26, 100], [S, 100, EASE.hold], [Z, 0, EASE.suave]]);
  c.som('mockup', A0, 'ficha ' + bloco.id);
  const faixa2 = c.rect('faixa', A0, Z, [110, 982], [10, 296], ACENTO); // reta entre os cantos arredondados do papel
  c.kf(faixa2, 'positionY', [[A0, 1028], [A0 + 0.38, 982]]);
  c.kf(faixa2, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.26, 100], [S, 100, EASE.hold], [Z, 0, EASE.suave]]);
  // texto que sobe e acende em tt; todos saem com o papel
  const entra = (cam, tt, y) => {
    c.sobe(cam, tt, y, 16);
    c.kf(cam, 'opacity', [[A0, 0, EASE.hold], [tt, 0, EASE.hold], [tt + 0.22, 100], [S, 100, EASE.hold], [Z, 0, EASE.suave]]);
  };
  const MONOP = { fonte: MONO, estilo: 'Regular', just: 'left' };
  const VAL = { estilo: 'Bold', tam: 32, cor: CAR, caixaAlta: false, tracking: -10, vAlign: 'top', just: 'left' };
  const t0 = o.tempoBase ?? A0 + 0.06; // cabeçalho, título e fio entram quase junto com o papel
  const cab = c.texto('cabecalho', A0, Z, [150, 985], [560, 30], t.cabecalho, { ...MONOP, tam: 22, cor: alfa(CAR, 0.6), tracking: 160 });
  entra(cab, t0, 985);
  if (t.data) {
    const dat = c.texto('data', A0, Z, [710, 985], [230, 30], t.data, { ...MONOP, just: 'right', tam: 22, cor: CAR, tracking: 160 });
    entra(dat, t0, 985);
  }
  const tit = c.texto('titulo', A0, Z, [150, 1024], [790, 52], t.titulo, { estilo: 'ExtraBold', tam: 40, cor: CAR, caixaAlta: false, tracking: -20, vAlign: 'top', just: 'left' });
  const fio = c.rect('fio', A0, Z, [150, 1090], [790, 2], alfa(CAR, 0.15));
  entra(tit, t0, 1024); entra(fio, t0, 1090);

  // campos: rótulo mono + 1 ou mais linhas de valor (cada uma entra no seu instante, `entra`)
  let y = CAMPO_TOPO;
  const temposDef = o.entradas || [];
  let seq = 0;
  t.campos.forEach((campo, ci) => {
    const valores = (Array.isArray(campo.valores) ? campo.valores : [campo.valor]).map((v) => (typeof v === 'string' ? { texto: v } : v));
    const tCampo = valores[0].entra ?? temposDef[seq] ?? A0 + 0.30 + ci * 0.9;
    const rot = c.texto(`campo${ci + 1}-rotulo`, A0, Z, [150, y + 6], [150, 28], campo.rotulo, { ...MONOP, tam: 20, cor: alfa(CAR, 0.55), tracking: 160 });
    entra(rot, campo.entra ?? tCampo, y + 6);
    valores.forEach((v, vi) => {
      const ty = y + vi * PASSO_LINHA;
      const tv = v.entra ?? (vi === 0 ? tCampo : tCampo + vi * 0.9);
      const val = c.texto(`campo${ci + 1}-valor${vi + 1}`, A0, Z, [310, ty], [620, 40], v.texto, VAL);
      entra(val, tv, ty);
    });
    y += ALTURA_CAMPO + PASSO_LINHA * (valores.length - 1);
    seq += valores.length;
  });
  const rodape = t.rodape || `RECRIAÇÃO GRÁFICA · FONTE: ${t.fonte}`;
  const rod = c.texto('rodape', A0, Z, [150, RODAPE_Y], [790, 26], rodape, { ...MONOP, tam: 17, cor: alfa(CAR, 0.55), tracking: 60 });
  entra(rod, t0, RODAPE_Y);
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }] };
}

const exemplo = {
  id: 'ficha-regra', tipo: 'ficha-documento', inicio: 12.0, fim: 16.3,
  textos: {
    cabecalho: 'ÓRGÃO PÚBLICO · COMUNICADO', data: '01/11/2026',
    titulo: 'Regra X começa em novembro',
    campos: [
      { rotulo: 'QUANDO', valores: [{ texto: 'a partir de 01/11', entra: 12.3 }] },
      { rotulo: 'QUEM', valores: [{ texto: 'empresas cadastradas', entra: 13.4 }, { texto: 'e profissionais autônomos', entra: 14.6 }] },
    ],
    fonte: 'ÓRGÃO PÚBLICO, COMUNICADO DE 01/11/2026',
  },
  opcoes: {},
};
const campos = {
  'textos.cabecalho': 'linha mono do topo (órgão · tipo do documento). Sem logo nem identidade do órgão',
  'textos.data': 'data à direita do cabeçalho (opcional)',
  'textos.titulo': 'título em ExtraBold 40 da fonte principal, caixa mista',
  'textos.campos': 'até 2 campos {rotulo, valores:[{texto, entra}]}; 3 linhas de valor no total',
  'textos.fonte': 'vira o rodapé "RECRIAÇÃO GRÁFICA · FONTE: <fonte>" (obrigatório; ou passe textos.rodape inteiro)',
  'opcoes.sai': 'instante em que começa o fade-out (padrão fim - 0,16 s)',
  'opcoes.entradas': 'instantes de entrada de cada linha de valor, em ordem (alternativa a valores[].entra)',
};
module.exports = { tipo, descricao: 'Papel claro recriado com cabeçalho, título, campos e rodapé "recriação gráfica · fonte".', validar, construir, exemplo, campos };
