// Primeira Página: o estilo de capa de Reels aprovado (serifa grande, itálico azul, um único elemento) virando edição.
//   serifa grande com itálico azul e peso -> título e destaque em itálico azul, mais pesado que o resto
//   um único elemento: a pessoa ou um objeto -> no B-roll, a imagem e a pessoa recortada do fundo, sem moldura,
//                                               sobre o papel claro; nada além disso na tela
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Primeira Página',
  descricao: 'Serifa grande com destaque em itálico azul mais pesado e B-roll limpo no papel claro, com a pessoa recortada.',
  layout: 'recorte',
  cores: { escuro: '#141414', claro: '#EFEBE4', acento: '#2B4BFF', neutro: '#6B665E' },
  fontes: {
    titulo: { arquivo: 'Fraunces-Regular.ttf', size: 132 },
    tituloDest: { arquivo: 'Fraunces-SemiBoldItalic.ttf', size: 132 },
    leg: { arquivo: 'Fraunces-Regular.ttf', size: 86 },
    legDest: { arquivo: 'Fraunces-SemiBoldItalic.ttf', size: 86 },
    rot: { arquivo: 'DMMono-Medium.ttf', size: 30, tracking: 200, allCaps: true },
  },
  destaque: 'italico',
  quebra: 12,
  rotulo: { cor: 'claro' },
  tela: { fundo: 'claro', texto: 'escuro' },
  entrada: 'fade',
});
