// Bloco `placa`: kicker mono (opcional) + headline em placa escura.
//   gancho   : sem kicker, 1ª linha grande na cor de acento, corte seco (entrada 'corte')
//   antes    : sem kicker, entrada 'sobe' escalonada (placa, linha 1, linha 2)
//   pergunta : kicker + régua de acento, linhas que entram na fala (campo `entra` por linha)
'use strict';
const { CLARO, ACENTO, ESCURO, FATOR_LARGURA, alfa, cor, MONO, EASE, HL, PAINEL } = require('./nucleo');

const tipo = 'placa';
const LARGURA_TEXTO = 840;       // largura útil da caixa de texto na placa
const EM = 0.67 * FATOR_LARGURA; // largura média de um glifo de título em caixa alta, em corpos (calibrado numa grotesca larga; ajuste com tipografia.principal.fator-largura)
const PADRAO_CORES = ['acento', 'claro'];

function normaliza(bloco) {
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  const kicker = t.kicker ? String(t.kicker) : null;
  const linhas = (t.linhas || []).map((l, i) => {
    const d = typeof l === 'string' ? { texto: l } : { ...l };
    const corNome = d.cor ?? o.cores?.[i] ?? (i === 0 ? PADRAO_CORES[0] : PADRAO_CORES[1]);
    const grande = !kicker && i === 0 && (t.linhas.length > 1);
    const tam = d.tam ?? o.tamanhos?.[i] ?? (grande ? 130 : 60);
    return { texto: String(d.texto), cor: cor(corNome), tam, y: d.y, entra: d.entra };
  });
  return { kicker, linhas, o };
}

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {};
  if (!Array.isArray(t.linhas) || t.linhas.length < 1) e.push('textos.linhas: lista com ao menos 1 linha');
  else if (t.linhas.length > 3) e.push('textos.linhas: no máximo 3 linhas (a placa tem 350 px)');
  else t.linhas.forEach((l, i) => { if (!(typeof l === 'string' ? l : l && l.texto)) e.push(`textos.linhas[${i}]: texto vazio`); });
  if (t.kicker !== undefined && typeof t.kicker !== 'string') e.push('textos.kicker: texto');
  const o = bloco.opcoes || {};
  if (o.entrada && !['corte', 'sobe'].includes(o.entrada)) e.push('opcoes.entrada: corte | sobe');
  if (o.saida && !['corte', 'fade'].includes(o.saida)) e.push('opcoes.saida: corte | fade');
  return e;
}

function construir(bloco, c) {
  const { kicker, linhas, o } = normaliza(bloco);
  const A0 = bloco.inicio, Z = bloco.fim;
  const entrada = o.entrada || (kicker ? 'sobe' : 'corte');
  const saida = o.saida || (entrada === 'corte' ? 'corte' : 'fade');
  const avisos = [];

  // layout vertical (coordenadas da faixa padrão): sem kicker o texto começa 7 px abaixo do topo; com kicker, 81 px
  let cursor = kicker ? 81 : 7;
  const ys = linhas.map((l) => {
    let tam = l.tam;
    const larg = l.texto.length * tam * EM;
    if (o.ajustar !== false && larg > LARGURA_TEXTO) {
      const novo = Math.floor(LARGURA_TEXTO / (l.texto.length * EM));
      avisos.push(`placa ${bloco.id}: "${l.texto}" não cabia em ${tam}px; reduzida para ${novo}px`);
      l.tam = tam = novo;
    }
    const y = l.y !== undefined ? PAINEL.y + l.y : PAINEL.y + cursor;
    // passo entre linhas: justo nas linhas grandes (gancho), um pouco mais solto nas pequenas
    cursor = (l.y !== undefined ? l.y : cursor) + Math.round(tam * (tam >= 100 ? 1.04 : 1.1));
    return y;
  });
  const alturaAuto = Math.round(Math.min(350, Math.max(...linhas.map((l, i) => ys[i] - PAINEL.y + Math.round(l.tam * 1.12)), 0) + 34));
  const altura = o.altura ?? alturaAuto;

  const p = c.painel('painel', A0, Z, altura, { entrada: 'corte' });
  const itens = [p];
  let regua, k;
  if (kicker) {
    regua = c.rect('regua', A0, Z, [130, 997], [34, 6], ACENTO);
    k = c.texto('kicker', A0, Z, [180, 979], [700, 42], kicker, { fonte: MONO, estilo: 'Regular', tam: 30, cor: alfa(CLARO, 0.78), just: 'left', tracking: 220 });
  }
  const ts = linhas.map((l, i) => c.texto(`linha${i + 1}`, A0, Z, [i === 0 && !kicker ? 128 : (kicker ? 130 : 132), ys[i]], [i === 0 && !kicker ? 840 : 860, Math.round(l.tam * 1.14)],
    l.texto, { ...HL, tam: l.tam, cor: l.cor }));

  if (entrada === 'sobe') {
    // placa, depois cada linha; `entra` (s) de cada linha acompanha a fala, senão escalona 0,08 s
    const quando = linhas.map((l, i) => l.entra ?? (kicker ? A0 + 0.09 + i * 0.5 : A0 + 0.08 * (i + 1)));
    c.sobe(p, A0, PAINEL.y);
    if (kicker) { c.sobe(regua, A0 + 0.09, 997, 24); c.sobe(k, A0 + 0.09, 979, 24); }
    ts.forEach((t, i) => c.sobe(t, quando[i], ys[i], kicker ? 24 : 40));
    const entradas = [[p, A0], ...(kicker ? [[regua, A0 + 0.09], [k, A0 + 0.09]] : []), ...ts.map((t, i) => [t, quando[i]])];
    for (const [camada, t] of entradas) {
      const fim = saida === 'fade' ? [[Z - (kicker ? 0.12 : 0.18), 100, EASE.hold], [Z, 0, EASE.suave]] : [];
      c.kf(camada, 'opacity', [[A0, 0, EASE.hold], [t, 0, EASE.hold], [t + 0.22, 100], ...fim]);
    }
    c.som('mockup', A0, 'placa ' + bloco.id);
  } else if (saida === 'fade') {
    for (const camada of [p, ...(kicker ? [regua, k] : []), ...ts]) c.kf(camada, 'opacity', [[A0, 100, EASE.hold], [Z - 0.18, 100, EASE.hold], [Z, 0, EASE.suave]]);
  }
  if (o.som === 'cartao') c.som('cartao', A0, 'placa ' + bloco.id);
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }], avisos };
}

const exemplo = {
  id: 'regra-x', tipo: 'placa', inicio: 4.0, fim: 8.0,
  textos: { kicker: 'SEU NEGÓCIO', linhas: ['JÁ SE PREPAROU', 'PARA A REGRA X?'] },
  opcoes: { cores: ['acento', 'claro'], entrada: 'sobe' },
};
const campos = {
  'textos.kicker': 'texto mono em caixa alta (opcional); com kicker aparece a régua de acento',
  'textos.linhas': 'até 3 linhas; cada item é texto ou {texto, cor, tam, y, entra}',
  'opcoes.cores': 'cor por linha: acento | claro | escuro | neutro | #RRGGBB (padrão acento na 1ª linha, claro nas demais)',
  'opcoes.tamanhos': 'corpo por linha (padrão 130 na 1ª linha sem kicker, 60 nas demais); encolhe sozinho se não couber em 840 px',
  'opcoes.entrada': "'corte' (padrão sem kicker, como o gancho) | 'sobe' (placa sobe 40 px e acende)",
  'opcoes.saida': "'corte' | 'fade' (padrão fade quando a entrada é 'sobe')",
  'opcoes.altura': 'altura da placa em px (padrão automática, até 350)',
  'opcoes.som': "'cartao' liga o impacto do mixar-audio no início",
};
module.exports = { tipo, descricao: 'Kicker mono + headline em placa escura (gancho, "antes", pergunta do CTA).', validar, construir, exemplo, campos };
