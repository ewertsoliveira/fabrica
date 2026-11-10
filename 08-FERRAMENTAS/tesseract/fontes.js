// Importa as fontes do contrato de marca num projeto Tesseract e traduz o peso pedido pelo código
// ("ExtraBold", "Black"...) para o estilo que a fonte realmente tem.
//
// Uso:
//   const fontes = require('./fontes');
//   const FAM = fontes.importar((...a) => tsrct(...a), PROJ, 'principal');   // papéis: principal, mono
//   FAM.familia            nome da família que o Tesseract usa em sourceText.fontFamily
//   FAM.estilo('Black')    estilo mais próximo entre os que a fonte tem
//   FAM.temLargura         true se a fonte tem o eixo wdth
//   FAM.variacao(id, w)    { fontVariations: { id, axes: { wdth: w } } } ou {} se a fonte não tem o eixo
//   FAM.compensacao        fração do corpo somada em y em texto centralizado na vertical (padrão 0,38)
'use strict';
const marca = require('../marca/marca');

const PESOS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };

function importar(tsrct, proj, papel) {
  const cfg = marca.pega(`tipografia.${papel}`, null);
  if (!cfg || !cfg.arquivo) throw new Error(`marca: tipografia.${papel}.arquivo ausente em ${marca.ARQUIVO}`);
  const arquivo = marca.caminho(cfg.arquivo);
  const r = JSON.parse(tsrct('project', 'import-font', '-p', proj, '--file', arquivo));
  const face = (r.faces && r.faces[0]) || {};
  const familia = r.fontFamily || face.familyName;
  const estilos = (face.selectionNames || []).map((s) => s.split('/').pop()).filter((s) => !/italic/i.test(s));
  const eixos = (face.variationAxes || []).map((a) => a.tag);
  const temLargura = eixos.includes('wdth');

  const estilo = (pedido) => {
    if (estilos.includes(pedido)) return pedido;
    const alvo = PESOS[pedido] ?? 400;
    const candidatos = estilos.filter((s) => PESOS[s] !== undefined);
    if (!candidatos.length) return estilos[0] || r.fontStyle || 'Regular';
    candidatos.sort((a, b) => Math.abs(PESOS[a] - alvo) - Math.abs(PESOS[b] - alvo) || PESOS[b] - PESOS[a]);
    return candidatos[0];
  };
  const variacao = (id, largura) => (temLargura ? { fontVariations: { id, axes: { wdth: largura ?? cfg['largura-titulo'] ?? 100 } } } : {});
  return { familia, estilos, estilo, temLargura, variacao, arquivo, compensacao: cfg['compensacao-vertical'] ?? 0.38 };
}

module.exports = { importar, PESOS };
