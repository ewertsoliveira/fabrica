// Protagonista: o estilo de carrossel aprovado (a profissional recortada no centro) virando edição de Reels.
//   profissional recortada sobre círculo de acento -> no B-roll, a pessoa recortada do fundo sobre um grande círculo
//                                                   de acento cortado pela borda, ao lado da imagem
//   título monumental com destaque sublinhado     -> caixa alta pesada; o sublinhado grosso cresce sob a palavra falada
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Protagonista',
  descricao: 'Caixa alta pesada com sublinhado de acento que cresce e pessoa recortada sobre um grande círculo de acento no B-roll.',
  layout: 'recorte',
  cores: { escuro: '#16213A', claro: '#ECE5D8', acento: '#FF6B35', neutro: '#5B6478' },
  fontes: {
    titulo: { arquivo: 'InterTight-Black.ttf', size: 118, tracking: -20 },
    tituloDest: { arquivo: 'InterTight-Black.ttf', size: 118, tracking: -20 },
    leg: { arquivo: 'InterTight-ExtraBold.ttf', size: 78 },
    legDest: { arquivo: 'InterTight-ExtraBold.ttf', size: 78 },
    rot: { arquivo: 'JetBrainsMono-Bold.ttf', size: 30, tracking: 160, allCaps: true },
  },
  caixaAlta: true,
  destaque: 'sublinhado',
  corDestaque: 'texto',
  quebra: 12,
  legChars: 16,
  rotulo: { cor: 'acento' },
  tela: { fundo: 'claro', texto: 'escuro' },
  moldura: { tipo: 'borda', cor: 'escuro', largura: 0, dx: 14, dy: 14 },
  raio: 18,
  // o corpo recortado fica dentro do círculo: só a cabeça passa da borda de cima
  recorteForma: { cx: 830, cy: 1110, r: 330 },
  fundoRecorte: (H, a, z) => [H.P.forma('circulo-acento', a, z, H.elipse(830, 1110, 330, 330), { preenche: H.C.acento })],
  entrada: 'pop',
  barra: { cor: 'acento', trilho: 'neutro' },
});
