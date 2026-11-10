// Fanzine: o estilo de carrossel aprovado (papel, fita e tarjas) virando edição de Reels.
//   título em tarjas, destaque em amarelo -> cada linha numa tarja preta; a palavra falada ganha a tarja amarela
//   mockup girado preso com fita vermelha -> a imagem entra pequena, girada, presa com fita, abaixo do queixo
//   anotação à mão                        -> uma anotação manuscrita (pedido.anotacao) junto da imagem
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Fanzine',
  descricao: 'Título e legenda em tarjas, destaque em tarja amarela, imagem girada presa com fita vermelha e anotação à mão.',
  layout: 'imagem-mini',
  // o cartão girado, com a fita, fica mais baixo e menor que o da base (longe da mandíbula); a legenda desce junto
  imagemMini: { img: { x: 690, y: 1140, w: 300, h: 300 }, leg: 1545 },
  cores: { escuro: '#171615', claro: '#EAE2D2', acento: '#FFD23F', neutro: '#5C564B' },
  fontes: {
    titulo: { arquivo: 'Oswald.ttf', style: 'Bold', size: 112 },
    tituloDest: { arquivo: 'Oswald.ttf', style: 'Bold', size: 112 },
    leg: { arquivo: 'Oswald.ttf', style: 'Bold', size: 76 },
    legDest: { arquivo: 'Oswald.ttf', style: 'Bold', size: 76 },
    rot: { arquivo: 'CourierPrime-Bold.ttf', size: 32, tracking: 40, allCaps: true },
    nota: { arquivo: 'Caveat.ttf', style: 'Bold', size: 84 },
  },
  caixaAlta: true,
  destaque: 'tarja',
  tarjaLinhas: 'escuro',
  quebra: 13,
  legChars: 18,
  rotulo: { cor: 'escuro', fundo: 'claro' },
  tela: { fundo: 'claro', texto: 'claro' },
  moldura: { tipo: 'borda', cor: 'claro', largura: 12 },
  rotImg: -3,
  corNota: 'acento',
  enfeiteImg: (H, a, z, j) => [H.P.imagem(H.textura('fita-vermelha'), a + 120, z, [j.x + j.w / 2, j.y - 4], { escala: 34, rot: -6 })],
  entrada: 'pop',
});
