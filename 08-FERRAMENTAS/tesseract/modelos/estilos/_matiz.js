// Matiz: o giro que leva uma cor do estilo (a das texturas, a do brilho) até a cor da marca, mantendo a claridade de cada
// tom. Usado pelo efeito hueSaturation do Tesseract nas texturas de um matiz só (Adesivo) e no brilho do Luz de Vela.

function hsl([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
function rgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
// giro de matiz (graus, -180 a 180) e ajuste de saturação (-100 a 100, na proporção entre as duas saturações) que levam a
// cor `de` até o matiz e a intensidade de `para`; a claridade de cada tom fica
function giroDeMatiz(de, para) {
  const [h0, s0] = hsl(de), [h1, s1] = hsl(para);
  const hue = Math.round(((h1 - h0 + 540) % 360) - 180);
  const saturation = Math.max(-100, Math.min(100, Math.round((s1 / s0 - 1) * 100)));
  return { hue, saturation };
}
// a mesma conta numa cor que não é textura (ex.: a sombra da foto do Adesivo): mesmo giro e mesmo ajuste de saturação
function gira(cor, { hue, saturation }) {
  const [h, s, l] = hsl(cor);
  return rgb([(h + hue + 360) % 360, Math.min(1, s * (1 + saturation / 100)), l]).map((v) => Math.round(v * 1000) / 1000);
}

module.exports = { hsl, rgb, giroDeMatiz, gira };
