// Colagem: o estilo de carrossel aprovado (folha de caderno colada, adesivo, etiquetas e polaroide) virando edição.
//   serifa gorda com itálico, texto centralizado -> título e legenda centralizados; destaque em itálico na cor de acento
//   etiquetas em pílula                          -> rótulo em pílula na cor de acento
//   folha de caderno colada e adesivo no topo    -> no B-roll, a imagem colada numa folha pautada, levemente girada,
//                                                   com um adesivo de estrela no topo, sobre o fundo verde
//   polaroide                                    -> a pessoa numa polaroide pequena, no canto
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Colagem',
  descricao: 'Serifa gorda centralizada com itálico na cor de acento, rótulo em pílula e B-roll colado em folha pautada, com a pessoa em polaroide.',
  layout: 'rosto-mini',
  cores: { escuro: '#234F34', claro: '#FBF5E6', acento: '#FF9433', neutro: '#8C9B3A', papel: '#FFFFFF' },
  fontes: {
    titulo: { arquivo: 'DMSerifDisplay-Regular.ttf', size: 122 },
    tituloDest: { arquivo: 'DMSerifDisplay-Italic.ttf', size: 122 },
    leg: { arquivo: 'DMSerifDisplay-Regular.ttf', size: 84 },
    legDest: { arquivo: 'DMSerifDisplay-Italic.ttf', size: 84 },
    rot: { arquivo: 'Poppins-SemiBold.ttf', size: 28, tracking: 80, allCaps: true },
  },
  destaque: 'italico',
  alinhar: 'centro',
  quebra: 15,
  rotulo: { cor: 'escuro', fundo: 'acento', pilula: true },
  tela: { fundo: 'escuro', texto: 'claro' },
  moldura: { tipo: 'borda', cor: 'claro', largura: 34 },
  molduraPessoa: { tipo: 'polaroide', cor: 'papel', largura: 14, base: 54 },
  rotImg: 2,
  enfeiteImg: (H, a, z, j) => [H.P.forma('adesivo', a + 150, z, H.estrela(j.x + j.w / 2, j.y - 30, 78), { preenche: H.C.acento })],
  entrada: 'pop',
});
