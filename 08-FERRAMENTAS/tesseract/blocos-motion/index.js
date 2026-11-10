// Biblioteca de blocos de motion (Fábrica de Conteúdo): registro, validação e montagem.
//
// Contrato (JSON único por bloco):
//   { "id": "split-esquema", "tipo": "esquema-divisao", "inicio": 8.45, "fim": 21.95,
//     "textos": { ... }, "opcoes": { ... } }
// Cada bloco devolve: camadas (layerId + nome), acoes (lote para `tsrct project apply`), documento (camadas de imagem, se houver),
// sons (blocos-fantasma para o mixar-audio.js) e janelas: [{ id, inicio, fim }] em segundos (alimentam o export em pedaços).
'use strict';
const nucleo = require('./nucleo');

const MODULOS = [require('./placa'), require('./selo'), require('./esquema-divisao'), require('./mapa-pontos'),
  require('./ficha-documento'), require('./diagrama-caixas'), require('./cartao-cta'),
  require('./contador'), require('./lista-marcavel')];
const BLOCOS = Object.fromEntries(MODULOS.map((m) => [m.tipo, m]));
// altura que cada bloco ocupa a partir do topo da faixa (px); a faixa padrão tem 350 (y 955 a 1305)
const ALTURA = { placa: 350, selo: 215, 'esquema-divisao': 350, 'mapa-pontos': 350, 'ficha-documento': 345, 'diagrama-caixas': 350, 'cartao-cta': 0, contador: 350, 'lista-marcavel': 350 };

function validar(bloco, { faixa = nucleo.FAIXA_PADRAO } = {}) {
  const e = [];
  if (!bloco || typeof bloco !== 'object') return ['bloco: objeto JSON {id, tipo, inicio, fim, textos, opcoes}'];
  if (!bloco.id || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(bloco.id)) e.push('id: texto com letras, números, - ou _ (vira prefixo das camadas)');
  const m = BLOCOS[bloco.tipo];
  if (!m) { e.push(`tipo: "${bloco.tipo}" desconhecido (${Object.keys(BLOCOS).join(', ')})`); return e.map((x) => `[${bloco.id}] ${x}`); }
  if (typeof bloco.inicio !== 'number' || typeof bloco.fim !== 'number') e.push('inicio/fim: números em segundos');
  else if (!(bloco.fim > bloco.inicio)) e.push('fim deve ser maior que inicio');
  if (bloco.textos !== undefined && (typeof bloco.textos !== 'object' || Array.isArray(bloco.textos))) e.push('textos: objeto');
  if (bloco.opcoes !== undefined && (typeof bloco.opcoes !== 'object' || Array.isArray(bloco.opcoes))) e.push('opcoes: objeto');
  if (!e.length) e.push(...m.validar({ ...bloco, textos: bloco.textos || {}, opcoes: bloco.opcoes || {} }));
  if (faixa[1] - faixa[0] < (ALTURA[bloco.tipo] ?? 0) && bloco.tipo !== 'selo') e.push(`faixa ${faixa.join(',')} tem ${faixa[1] - faixa[0]} px; o bloco precisa de ${ALTURA[bloco.tipo]}`);
  if (faixa[1] > 1320 && bloco.tipo !== 'cartao-cta') e.push('faixa termina abaixo de y 1320, onde começa a legenda');
  return e.map((x) => `[${bloco.id}] ${x}`);
}

// monta uma lista de blocos num único lote.
// opts: { idBase (padrão 3000), desloca (s somados a todos os tempos), faixa [y0,y1] (padrão [955,1305]), fontes { principal, mono } }
function montar(blocos, opts = {}) {
  const faixa = opts.faixa || nucleo.FAIXA_PADRAO;
  const erros = [], avisos = [];
  const ids = new Set();
  blocos.forEach((b) => {
    erros.push(...validar(b, { faixa }));
    if (b && ids.has(b.id)) erros.push(`[${b.id}] id repetido`);
    if (b) ids.add(b.id);
  });
  if (erros.length) { const err = new Error('blocos inválidos:\n  ' + erros.join('\n  ')); err.erros = erros; throw err; }
  const ordenados = blocos.map((b, i) => ({ ...b, textos: b.textos || {}, opcoes: b.opcoes || {}, _ordem: i }));
  // sobreposição no tempo: avisa (duas placas na mesma faixa se cobrem)
  for (let i = 0; i < ordenados.length; i++) for (let j = i + 1; j < ordenados.length; j++) {
    const p = ordenados[i], q = ordenados[j];
    if (p.inicio < q.fim && q.inicio < p.fim) avisos.push(`[${p.id}] e [${q.id}] se sobrepõem no tempo (${Math.max(p.inicio, q.inicio).toFixed(2)} a ${Math.min(p.fim, q.fim).toFixed(2)} s)`);
  }
  const ctx = new nucleo.Contexto({ idBase: opts.idBase ?? 3000, desloca: opts.desloca || 0, faixa, prefixoKf: opts.prefixoKf || 'mb', fontes: opts.fontes || null });
  const saida = { blocos: [], acoes: [], camadas: [], documento: [], sons: [], janelas: [], avisos };
  for (const b of ordenados) {
    const m = BLOCOS[b.tipo];
    if (b.fim + (opts.desloca || 0) <= 0) { avisos.push(`[${b.id}] termina antes do início do trecho (fim ${b.fim} s, desloca ${opts.desloca}); ignorado`); continue; }
    ctx.bloco = b.id;
    const r = m.construir(b, ctx) || {};
    const f = ctx.fechaBloco();
    // as janelas saem em segundos da COMPOSIÇÃO (já somado o `desloca`), que é o tempo que o export em pedaços usa
    const d = opts.desloca || 0, r3 = (x) => Number(x.toFixed(3));
    const janelas = (r.janelas || [{ id: b.id, inicio: b.inicio, fim: b.fim }]).map(({ id, inicio, fim }) => ({ id, inicio: r3(Math.max(0, inicio + d)), fim: r3(fim + d) }));
    saida.blocos.push({ id: b.id, tipo: b.tipo, camadas: f.camadas, acoes: f.acoes.length, janelas, ocupaLegenda: !!m.ocupaLegenda, tempos: r.tempos });
    saida.acoes.push(...f.acoes); saida.camadas.push(...f.camadas); saida.documento.push(...f.documento);
    saida.sons.push(...f.sons); saida.janelas.push(...janelas);
    if (r.avisos) avisos.push(...r.avisos);
  }
  saida.proximoId = ctx.prox;
  return saida;
}

module.exports = { BLOCOS, MODULOS, validar, montar, nucleo, ALTURA };
