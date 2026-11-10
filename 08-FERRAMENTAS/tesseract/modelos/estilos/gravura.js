// Gravura: o estilo de carrossel aprovado (traço de gravura, serifa refinada, muito respiro) virando edição de Reels.
//   serifa refinada com itálico         -> a palavra falada entra em itálico dourado
//   painel lateral com a gravura         -> no B-roll, a imagem num quadro de fio duplo dourado, com um painel de fio ao
//                                           lado, e a pessoa num segundo quadro igual embaixo (nunca sai de cena)
//   traço numa cor só                    -> todo traço em dourado sobre o escuro
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Gravura',
  descricao: 'Serifa refinada com itálico dourado, muito respiro e B-roll e pessoa em quadros de fio duplo dourado na tela escura.',
  layout: 'dividir',
  cores: { escuro: '#12100E', claro: '#F2ECE1', acento: '#6E1F2A', neutro: '#D9B26A' },
  fontes: {
    titulo: { arquivo: 'PlayfairDisplay-Medium.ttf', size: 120 },
    tituloDest: { arquivo: 'PlayfairDisplay-MediumItalic.ttf', size: 120 },
    leg: { arquivo: 'PlayfairDisplay-Medium.ttf', size: 80 },
    legDest: { arquivo: 'PlayfairDisplay-MediumItalic.ttf', size: 80 },
    rot: { arquivo: 'DMMono-Medium.ttf', size: 30, tracking: 200, allCaps: true },
  },
  // no escuro, o traço e o destaque são dourados (neutro), como nas lâminas escuras; o vinho fica para o fundo claro
  destaque: 'italico',
  corDestaque: 'neutro',
  quebra: 14,
  rotulo: { cor: 'claro' }, // pequeno sobre o vídeo, o dourado some; o creme lê
  tela: { fundo: 'escuro', texto: 'claro' },
  moldura: [{ tipo: 'fio', cor: 'neutro', largura: 2, folga: 14 }, { tipo: 'fio', cor: 'neutro', largura: 1, folga: 26 }],
  antesImg: (H, a, z, j) => [H.P.ret('painel-fio', a, z, [j.x - 60, j.y + 80], [2, j.h - 160], H.C.neutro),
    H.P.ret('painel-fio', a, z, [j.x + j.w + 58, j.y + 80], [2, j.h - 160], H.C.neutro)],
  entrada: 'fade',
  barra: { cor: 'neutro', trilho: 'claro' },
});
