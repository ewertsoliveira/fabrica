// Contraste: o estilo de carrossel aprovado (fundos em sequência, mockup inclinado, três vozes) virando edição de Reels.
//   três vozes: título pesado, rótulo mono e nota manuscrita -> título pesado, rótulo mono em pílula azul e uma nota à
//                                                              mão (pedido.anotacao) junto da imagem
//   mockup inclinado sobre a faixa diagonal                -> no B-roll, a imagem inclinada num cartão claro sobre a
//                                                              faixa azul diagonal; a pessoa embaixo (tela dividida)
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Contraste',
  descricao: 'Título pesado com destaque azul, rótulo mono em pílula, nota à mão e B-roll inclinado sobre a faixa diagonal.',
  layout: 'dividir',
  cores: { escuro: '#16171A', claro: '#F2F1EC', acento: '#4A68E8', neutro: '#8A8A90' },
  fontes: {
    titulo: { arquivo: 'InterTight-ExtraBold.ttf', size: 116, tracking: -20 },
    tituloDest: { arquivo: 'InterTight-ExtraBold.ttf', size: 116, tracking: -20 },
    leg: { arquivo: 'InterTight-ExtraBold.ttf', size: 78, tracking: -10 },
    legDest: { arquivo: 'InterTight-ExtraBold.ttf', size: 78, tracking: -10 },
    rot: { arquivo: 'JetBrainsMono-Bold.ttf', size: 28, tracking: 60 },
    nota: { arquivo: 'Caveat.ttf', style: 'Bold', size: 80 },
  },
  destaque: 'cor',
  destaqueVideo: 'fio',
  quebra: 13,
  rotulo: { cor: 'claro', fundo: 'acento', pilula: true },
  tela: { fundo: 'escuro', texto: 'claro' },
  moldura: { tipo: 'borda', cor: 'claro', largura: 16 },
  molduraPessoa: { tipo: 'borda', cor: 'claro', largura: 8 },
  rotImg: -3,
  raio: 16,
  corNota: 'acento',
  antesImg: (H, a, z, j) => [H.P.ret('faixa-diagonal', a, z, [540, j.y + j.h / 2 + 40], [1500, 230], H.C.acento, { anchor: [750, 115], rot: -12 })],
  entrada: 'pop',
});
