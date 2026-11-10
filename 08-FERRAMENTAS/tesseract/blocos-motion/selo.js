// Bloco `selo`: pílula clara (texto escuro) com pop. `construirSelo` também é usado pelo bloco diagrama-caixas.
'use strict';
const { CLARO, ESCURO, alfa, MONO, EASE } = require('./nucleo');

const tipo = 'selo';
// formatos (medidas em px do quadro 1080x1920)
const FORMATOS = {
  grande:   { w: 800, h: 150, tam: 42, caixaH: 56, caixaDy: -62, subTam: 24, subDy: 10, subH: 36, subAlfa: 0.7, subVAlign: 'top',   pilulaRaio: 75 },
  compacto: { w: 660, h: 80,  tam: 30, caixaH: 52, caixaDy: -26, caixaW: 600, pilulaRaio: 40 },
  'compacto-sub': { w: 600, h: 100, tam: 30, caixaH: 44, caixaDy: -34, caixaW: 600, subTam: 20, subDy: 14, subH: 26, subAlfa: 0.65, subVAlign: 'center', pilulaRaio: 40 },
};

// Desenha um selo. p: { prefixo, a, z, E (pop), cx, cy, formato, linha, sub, subEntra?, sai (true|false), fadeSai }
function construirSelo(c, p) {
  const F = { ...FORMATOS[p.formato || (p.sub ? 'grande' : 'compacto')], ...(p.medidas || {}) };
  const { a, z, E } = p;
  const cx = p.cx ?? 540, cy = p.cy;
  const caixaW = F.caixaW ?? F.w;
  const pil = c.rect(`${p.prefixo}pilula`, a, z, [cx, cy], [F.w, F.h], CLARO, { raio: F.pilulaRaio, anchor: [F.w / 2, F.h / 2] });
  const t = c.texto(`${p.prefixo}texto`, a, z, [cx - caixaW / 2, cy + F.caixaDy], [caixaW, F.caixaH], p.linha,
    { tam: F.tam, cor: ESCURO, tracking: -10, pivo: [cx, cy] });
  const grupo = [pil, t];
  let sub = null;
  if (p.sub) {
    if (F.subVAlign === 'top') {
      // sub-linha presa ao pop do selo (mesmo pivô)
      sub = c.texto(`${p.prefixo}sub`, a, z, [cx - caixaW / 2, cy + F.subDy], [caixaW, F.subH], p.sub,
        { fonte: MONO, estilo: 'Regular', tam: F.subTam, cor: alfa(ESCURO, F.subAlfa), tracking: 200, vAlign: 'top', pivo: [cx, cy] });
      grupo.push(sub);
    } else {
      // sub-linha que entra depois, parada (sem pop), até o fim do selo
      const se = p.subEntra ?? E + 1.5;
      sub = c.texto(`${p.prefixo}sub`, se, z, [cx - caixaW / 2, cy + F.subDy], [caixaW, F.subH], p.sub,
        { fonte: MONO, estilo: 'Regular', tam: F.subTam, cor: alfa(ESCURO, F.subAlfa), just: 'center', tracking: 200 });
      c.kf(sub, 'opacity', [[se, 0, EASE.hold], [se + 0.08, 0, EASE.hold], [se + 0.30, 100]]);
    }
  }
  for (const g of grupo) {
    c.pop(g, E);
    if (p.sai === false) c.kf(g, 'opacity', [[g.a, 0, EASE.hold], [E, 0, EASE.hold], [E + 0.22, 100]]);
    else c.kf(g, 'opacity', [[g.a, 0, EASE.hold], [E, 0, EASE.hold], [E + 0.22, 100], [z - (p.fadeSai ?? 0.18), 100, EASE.hold], [z, 0, EASE.suave]]);
  }
  return { pil, t, sub };
}

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  if (!t.linha || typeof t.linha !== 'string') e.push('textos.linha: texto do selo');
  if (t.sub !== undefined && typeof t.sub !== 'string') e.push('textos.sub: texto');
  if (o.formato && !FORMATOS[o.formato]) e.push('opcoes.formato: ' + Object.keys(FORMATOS).join(' | '));
  if (o.pop !== undefined && !(o.pop >= bloco.inicio && o.pop < bloco.fim)) e.push('opcoes.pop: instante dentro de [inicio, fim)');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const formato = o.formato || (t.sub ? 'grande' : 'compacto');
  const E = o.pop ?? bloco.inicio + 0.24;
  const yRel = o.y ?? 107; // centro da pílula, em px abaixo do topo da faixa (107 = y 1062 na faixa padrão)
  construirSelo(c, { prefixo: '', a: bloco.inicio, z: bloco.fim, E, cy: 955 + yRel, formato, linha: t.linha, sub: t.sub,
    medidas: { ...(o.largura ? { w: o.largura } : {}), ...(o.altura ? { h: o.altura } : {}), ...(o.tam ? { tam: o.tam } : {}) }, fadeSai: o.fadeSai });
  c.som('tile', E, 'selo ' + bloco.id);
  return { janelas: [{ id: bloco.id, inicio: bloco.inicio, fim: bloco.fim }] };
}

const exemplo = {
  id: 'selo-regra', tipo: 'selo', inicio: 10.0, fim: 12.5,
  textos: { linha: 'NÃO MUDA O SEU DIA', sub: 'POR ENQUANTO, SÓ NO TESTE' },
  opcoes: { pop: 10.24 },
};
const campos = {
  'textos.linha': 'frase principal, caixa alta (cabe ~26 caracteres no formato grande)',
  'textos.sub': 'sub-linha mono (opcional); com ela o formato padrão é "grande"',
  'opcoes.pop': 'instante do pop (padrão inicio + 0,24); amarre na palavra falada',
  'opcoes.formato': 'grande (800x150) | compacto (660x80) | compacto-sub (600x100)',
  'opcoes.y': 'centro da pílula em px abaixo do topo da faixa (padrão 107)',
  'opcoes.largura / altura / tam': 'sobrescrevem as medidas do formato',
};
module.exports = { tipo, descricao: 'Pílula clara com texto escuro e pop (selo "não muda nada", "por enquanto").', validar, construir, construirSelo, exemplo, campos, FORMATOS };
