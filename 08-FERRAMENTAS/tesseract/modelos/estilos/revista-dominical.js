// Revista de Domingo: o estilo de carrossel aprovado (muito respiro, serifa elegante) virando edição de Reels.
//   destaque em itálico terracota  -> a palavra falada entra em itálico terracota
//   fios finos separando os blocos -> fio que se desenha acima do rótulo
//   visual com moldura leve        -> B-roll na tela clara, em moldura de fio fino; a pessoa embaixo (tela dividida)
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Revista de Domingo',
  descricao: 'Serifa elegante com destaque em itálico terracota, fio fino que se desenha e B-roll em moldura leve na tela clara.',
  layout: 'dividir',
  cores: { escuro: '#1E2A26', claro: '#F6F2EA', acento: '#A8472F', neutro: '#7B756B' },
  fontes: {
    titulo: { arquivo: 'Fraunces-Regular.ttf', size: 128 },
    tituloDest: { arquivo: 'Fraunces-Italic.ttf', size: 128 },
    leg: { arquivo: 'Fraunces-Regular.ttf', size: 84 },
    legDest: { arquivo: 'Fraunces-Italic.ttf', size: 84 },
    rot: { arquivo: 'DMMono-Medium.ttf', size: 30, tracking: 200, allCaps: true },
  },
  destaque: 'italico',
  destaqueVideo: 'fio',
  quebra: 13,
  rotulo: { cor: 'claro' },
  fio: 'claro',
  tela: { fundo: 'claro', texto: 'escuro' },
  moldura: { tipo: 'fio', cor: 'neutro', largura: 2, folga: 18 },
  entrada: 'fade',
  barra: { cor: 'acento', trilho: 'neutro' },
});
