// Terra e Sálvia: o estilo de carrossel aprovado (tons de terra, formas orgânicas) virando edição de Reels.
//   formas orgânicas cortadas pela borda -> na tela do B-roll, duas formas (sálvia e terracota) cortadas pela borda
//   serifa macia com itálico terracota   -> a palavra falada entra em itálico terracota
//   cantos redondos em tudo              -> imagem e pessoa em janelas de cantos redondos; a pessoa em miniatura
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Terra e Sálvia',
  descricao: 'Serifa macia com itálico terracota, formas orgânicas cortadas pela borda e janelas de cantos redondos.',
  layout: 'rosto-mini',
  cores: { escuro: '#2F3E33', claro: '#F5EDE2', acento: '#C0603F', neutro: '#A9B89D' },
  fontes: {
    titulo: { arquivo: 'DMSerifDisplay-Regular.ttf', size: 124 },
    tituloDest: { arquivo: 'DMSerifDisplay-Italic.ttf', size: 124 },
    leg: { arquivo: 'DMSerifDisplay-Regular.ttf', size: 82 },
    legDest: { arquivo: 'DMSerifDisplay-Italic.ttf', size: 82 },
    rot: { arquivo: 'DMMono-Medium.ttf', size: 30, tracking: 160, allCaps: true },
  },
  destaque: 'italico',
  destaqueVideo: 'fio',
  quebra: 13,
  rotulo: { cor: 'claro' },
  tela: {
    fundo: 'claro', texto: 'escuro',
    formas: (H, a, z) => [H.P.forma('forma-salvia', a, z, H.elipse(1010, 150, 330, 290), { preenche: H.C.neutro, opacidade: 70 }),
      H.P.forma('forma-terra', a, z, H.elipse(40, 1880, 300, 250), { preenche: H.C.acento, opacidade: 30 })],
  },
  raio: 44,
  moldura: { tipo: 'borda', cor: '#FFFFFF', largura: 10 },
  entrada: 'fade',
  barra: { cor: 'acento', trilho: 'neutro' },
});
