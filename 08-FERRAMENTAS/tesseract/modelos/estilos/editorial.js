// Editorial: o estilo de carrossel aprovado (foto de revista, degradê suave, serifa fina) virando edição de Reels.
//   foto de revista com degradê suave -> degradê só na parte de baixo, atrás do texto; nunca escurece o rosto
//   serifa fina com itálico           -> título e legenda centralizados em Cormorant; destaque em itálico
//   foto em círculo                   -> no B-roll, o vídeo segue inteiro e a imagem entra num círculo pequeno, abaixo
//                                        do queixo, com aro claro
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Editorial',
  descricao: 'Serifa fina centralizada com itálico, degradê suave só atrás do texto e a imagem num círculo pequeno sobre o vídeo.',
  layout: 'imagem-mini',
  imagemCirculo: true,
  // sobre o vídeo e no escuro, o texto vai no creme mais claro da paleta (neutro), como na capa com foto
  cores: { escuro: '#4F3127', claro: '#E3C6B4', acento: '#A86F55', neutro: '#F6ECE4' },
  corTexto: 'neutro',
  fontes: {
    titulo: { arquivo: 'CormorantGaramond-Medium.ttf', size: 136 },
    tituloDest: { arquivo: 'CormorantGaramond-MediumItalic.ttf', size: 136 },
    leg: { arquivo: 'CormorantGaramond-Medium.ttf', size: 92 },
    legDest: { arquivo: 'CormorantGaramond-MediumItalic.ttf', size: 92 },
    rot: { arquivo: 'Montserrat-SemiBold.ttf', size: 28, tracking: 240, allCaps: true },
  },
  destaque: 'italico',
  corDestaque: 'texto',
  alinhar: 'centro',
  quebra: 15,
  rotulo: { cor: 'neutro' },
  fio: 'neutro',
  tela: { fundo: 'escuro', texto: 'neutro' },
  moldura: { tipo: 'borda', cor: 'neutro', largura: 8 },
  sobreVideo: (H, DUR) => { H.P.imagem(H.textura('degrade-editorial'), 0, DUR, [540, 960], { fit: 'cover' }); },
  entrada: 'fade',
});
