// Papelaria: o estilo de carrossel aprovado (serifa condensada, um objeto de escritório por lâmina) virando edição.
//   serifa condensada com itálico colorido -> título e legenda em Instrument Serif; a palavra falada em itálico na cor de acento
//   um objeto de escritório por lâmina     -> no B-roll, a imagem é um cartão preso por um prendedor, sobre o círculo
//                                             azul na tela de acento; a pessoa num quadro pequeno, no canto
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Papelaria',
  descricao: 'Serifa condensada com itálico na cor de acento e B-roll como cartão preso por prendedor sobre o círculo azul, na tela de acento.',
  layout: 'rosto-mini',
  cores: { escuro: '#1F3358', claro: '#EFEBE3', acento: '#CF4F20', neutro: '#8C8478', papel: '#FFFFFF' },
  fontes: {
    titulo: { arquivo: 'InstrumentSerif-Regular.ttf', size: 150 },
    tituloDest: { arquivo: 'InstrumentSerif-Italic.ttf', size: 150 },
    leg: { arquivo: 'InstrumentSerif-Regular.ttf', size: 100 },
    legDest: { arquivo: 'InstrumentSerif-Italic.ttf', size: 100 },
    rot: { arquivo: 'InterTight-SemiBold.ttf', size: 30, tracking: 160, allCaps: true },
  },
  destaque: 'italico',
  destaqueVideo: 'fio',
  corDestaque: 'acento',
  quebra: 14,
  rotulo: { cor: 'claro' },
  tela: { fundo: 'acento', texto: 'claro', destaque: 'claro' },
  moldura: { tipo: 'borda', cor: 'papel', largura: 14 },
  molduraPessoa: { tipo: 'borda', cor: 'papel', largura: 10 },
  antesImg: (H, a, z, j) => [H.P.forma('circulo-azul', a, z, H.elipse(j.x + j.w * 0.62, j.y + j.h * 0.5, 430, 430), { preenche: H.C.escuro })],
  enfeiteImg: (H, a, z, j) => {
    const cx = j.x + j.w / 2, y = j.y - 14;
    return [H.P.forma('prendedor-alca', a + 120, z, { commands: [{ type: 'moveTo', x: cx - 26, y: y - 6 }, { type: 'lineTo', x: cx - 18, y: y - 60 },
      { type: 'lineTo', x: cx + 18, y: y - 60 }, { type: 'lineTo', x: cx + 26, y: y - 6 }] }, { traco: H.C.escuro, largura: 6 }),
    H.P.ret('prendedor', a + 120, z, [cx - 46, y - 10], [92, 44], H.C.escuro, { raio: 0.2 })];
  },
  entrada: 'fade',
});
