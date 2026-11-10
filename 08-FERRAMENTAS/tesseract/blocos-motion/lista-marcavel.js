// Bloco `lista-marcavel`: lista de até 4 itens marcados com ✓ na palavra que os nomeia (o documento-checklist dos vídeos
// explicativos). Cada item pode ter `destaque`: antes de marcar, ganha um contorno na cor de acento ("a mais importante").
'use strict';
const { CLARO, ACENTO, ESCURO, alfa, cor, MONO, EASE, HL } = require('./nucleo');

const tipo = 'lista-marcavel';
const LINHA = 66, Y0 = 1042, CAIXA = 40;

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {};
  if (!Array.isArray(t.itens) || t.itens.length < 1) e.push('textos.itens: lista com 1 a 4 itens');
  else if (t.itens.length > 4) e.push('textos.itens: no máximo 4 itens (a placa tem 350 px)');
  else t.itens.forEach((it, i) => {
    if (!it || typeof it.texto !== 'string' || !it.texto) e.push(`textos.itens[${i}].texto: texto`);
    else if (it.texto.length > 30) e.push(`textos.itens[${i}].texto: no máximo 30 caracteres`);
    if (!it || typeof it.marca !== 'number') e.push(`textos.itens[${i}].marca: segundo em que o ✓ aparece`);
    else if (!(it.marca > bloco.inicio && it.marca < bloco.fim)) e.push(`textos.itens[${i}].marca: dentro do bloco`);
  });
  if (t.kicker !== undefined && typeof t.kicker !== 'string') e.push('textos.kicker: texto');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const corMarca = cor(o.cor, ACENTO);
  const fimFade = [[Z - 0.18, 100, EASE.hold], [Z, 0, EASE.suave]];
  const p = c.painel('painel', A0, Z, 350, { entrada: 'corte' });
  c.kf(p, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.26, 100], ...fimFade]);
  if (t.kicker) {
    const k = c.texto('kicker', A0, Z, [130, 979], [820, 42], t.kicker, { fonte: MONO, estilo: 'Regular', tam: 30, cor: alfa(CLARO, 0.78), just: 'left', tracking: 220 });
    c.kf(k, 'opacity', [[A0, 0, EASE.hold], [A0 + 0.1, 0, EASE.hold], [A0 + 0.3, 100], ...fimFade]);
  }

  t.itens.forEach((it, i) => {
    const y = Y0 + i * LINHA;
    const entra = it.entra ?? A0 + 0.15 + i * 0.12;
    const caixa = c.rect(`caixa${i + 1}`, A0, Z, [130, y], [CAIXA, CAIXA], null, { raio: 8, traco: CLARO, larguraTraco: 3 });
    const texto = c.texto(`item${i + 1}`, A0, Z, [196, y - 6], [740, 52], it.texto, { ...HL, tam: 38, cor: CLARO, just: 'left', caixaAlta: false });
    for (const x of [caixa, texto]) c.kf(x, 'opacity', [[A0, 0, EASE.hold], [entra, 0, EASE.hold], [entra + 0.22, 100], ...fimFade]);
    if (it.destaque) {
      // contorno antes de marcar: "esta é a mais importante"
      const d0 = Math.max(entra, it.marca - (o.antecedeDestaque ?? 1.6));
      const dest = c.rect(`destaque${i + 1}`, d0, Z, [118, y - 12], [844, CAIXA + 24], null, { raio: 14, traco: corMarca, larguraTraco: 4 });
      c.kf(dest, 'opacity', [[d0, 0, EASE.hold], [d0 + 0.2, 100], ...fimFade]);
    }
    // preenchimento da caixa + ✓ entram na palavra
    const cheia = c.rect(`marca${i + 1}`, it.marca, Z, [130, y], [CAIXA, CAIXA], corMarca, { raio: 8 });
    const tique = c.forma(`tique${i + 1}`, it.marca, Z,
      [{ type: 'moveTo', x: 139, y: y + 21 }, { type: 'lineTo', x: 148, y: y + 30 }, { type: 'lineTo', x: 162, y: y + 11 }],
      { traco: ESCURO, largura: 6, pivo: [150, y + 20] });
    for (const m of [cheia, tique]) {
      c.kf(m, 'opacity', [[it.marca, 0, EASE.hold], [it.marca + 0.01, 100], ...fimFade]);
      c.escala(m, [[it.marca, 70, EASE.hold], [it.marca + 0.14, 108], [it.marca + 0.24, 100]]);
    }
    c.som('tile', it.marca, `marca ${i + 1}`);
  });
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }] };
}

const exemplo = {
  id: 'lista-tres-itens', tipo: 'lista-marcavel', inicio: 4.0, fim: 14.0,
  textos: { kicker: 'CHECAGEM', itens: [
    { texto: 'Documento conferido', marca: 6.0 },
    { texto: 'Prazo combinado', marca: 8.6 },
    { texto: 'Valor por escrito', marca: 11.4, destaque: true },
  ] },
  opcoes: {},
};
const campos = {
  'textos.kicker': 'rótulo mono acima da lista (opcional)',
  'textos.itens[].texto': 'texto do item (até 30 caracteres)',
  'textos.itens[].marca': 'segundo em que o ✓ aparece (amarre na palavra que nomeia o item)',
  'textos.itens[].destaque': 'true: contorno de destaque antes de marcar ("a mais importante")',
  'textos.itens[].entra': 'segundo em que o item aparece (padrão: escalonado a partir do início)',
  'opcoes.cor': 'cor do ✓ e do destaque (papel ou #RRGGBB; padrão acento)',
};
module.exports = { tipo, descricao: 'Lista de até 4 itens marcados com ✓ na palavra que os nomeia, com item em destaque opcional.', validar, construir, exemplo, campos };
