// Cartilha: o estilo de carrossel aprovado (passo a passo com número em círculo) virando edição de Reels.
//   destaque em pílula amarela             -> a palavra falada ganha a pílula amarela
//   número grande em círculo em cada passo -> o B-roll entra como passo: número no círculo amarelo no canto da imagem
//   títulos redondos e pesados             -> Poppins pesada; tela azul-marinho com cartões de cantos redondos
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Cartilha',
  descricao: 'Títulos redondos e pesados, destaque em pílula amarela e B-roll como passo numerado, com a pessoa embaixo.',
  layout: 'dividir',
  cores: { escuro: '#102A43', claro: '#F4F7FB', acento: '#FFC93C', neutro: '#12A39A' },
  fontes: {
    titulo: { arquivo: 'Poppins-ExtraBold.ttf', size: 112, tracking: -10 },
    tituloDest: { arquivo: 'Poppins-ExtraBold.ttf', size: 112, tracking: -10 },
    leg: { arquivo: 'Poppins-Bold.ttf', size: 74 },
    legDest: { arquivo: 'Poppins-Bold.ttf', size: 74 },
    rot: { arquivo: 'JetBrainsMono-Bold.ttf', size: 30, tracking: 160, allCaps: true },
    numero: { arquivo: 'Poppins-ExtraBold.ttf', size: 84 },
  },
  destaque: 'pilula',
  quebra: 13,
  legChars: 19,
  rotulo: { cor: 'claro' },
  tela: { fundo: 'escuro', texto: 'claro' },
  raio: 28,
  moldura: { tipo: 'borda', cor: 'claro', largura: 8 },
  papeisFontes: { numero: 'principal' }, // com a marca, o número do passo vai na letra principal dela
  enfeiteImg: (H, a, z, j) => {
    const [num, circ] = H.par('escuro', 'acento', 'número do passo'); // com a marca sem contraste, volta ao par do estilo
    return [H.P.forma('passo-circulo', a + 150, z, H.elipse(j.x + 10, j.y + 10, 62, 62), { preenche: circ }),
      H.escreve('passo-numero', a + 150, z, [j.x + 10, j.y + 12], '1', 'numero', num)];
  },
  entrada: 'pop',
  barra: { cor: 'acento', trilho: 'claro' },
});
