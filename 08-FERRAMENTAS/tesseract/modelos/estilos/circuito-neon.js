// Circuito Néon: o estilo de carrossel aprovado (grade técnica, colchetes, um acento néon) virando edição de Reels.
//   grade técnica no fundo           -> grade só na tela escura do B-roll (nunca por cima da pessoa)
//   colchetes nos cantos e no rótulo -> rótulo entre colchetes; colchetes néon nos cantos da imagem
//   néon só no destaque sublinhado   -> a palavra falada acende em néon e ganha o sublinhado
//   mockup claro com contorno néon   -> imagem com contorno néon; a pessoa ao lado, em cartão alto
const criaModelo = require('./_inverso');

module.exports = criaModelo({
  nome: 'Circuito Néon',
  descricao: 'Grotesca técnica, destaque néon sublinhado, rótulo entre colchetes e B-roll com contorno néon na grade escura.',
  layout: 'lado-a-lado',
  cores: { escuro: '#0A0F14', claro: '#E9F0F1', acento: '#3CFFB0', neutro: '#4D6168' },
  fontes: {
    titulo: { arquivo: 'SpaceGrotesk-Bold.ttf', size: 118, tracking: -10 },
    tituloDest: { arquivo: 'SpaceGrotesk-Bold.ttf', size: 118, tracking: -10 },
    leg: { arquivo: 'SpaceGrotesk-Bold.ttf', size: 78 },
    legDest: { arquivo: 'SpaceGrotesk-Bold.ttf', size: 78 },
    rot: { arquivo: 'JetBrainsMono-Bold.ttf', size: 30, tracking: 160, allCaps: true },
  },
  destaque: 'sublinhado',
  quebra: 13,
  rotulo: { cor: 'claro', colchetes: true },
  tela: { fundo: 'escuro', texto: 'claro', textura: 'grade-neon' },
  moldura: { tipo: 'fio', cor: 'acento', largura: 4, folga: 4 },
  molduraPessoa: { tipo: 'fio', cor: 'neutro', largura: 3, folga: 4 },
  enfeiteImg: (H, a, z, j) => {
    const L = 46, d = 26, c = [];
    for (const [x, y, sx, sy] of [[j.x - d, j.y - d, 1, 1], [j.x + j.w + d, j.y + j.h + d, -1, -1]]) {
      c.push(H.P.forma('colchete', a + 120, z, { commands: [{ type: 'moveTo', x, y: y + sy * L }, { type: 'lineTo', x, y }, { type: 'lineTo', x: x + sx * L, y }] },
        { traco: H.C.acento, largura: 4, cap: 'butt' }));
    }
    return c;
  },
  entrada: 'fade',
  barra: { cor: 'acento', trilho: 'neutro' },
});
