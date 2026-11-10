#!/usr/bin/env node
// Recorta a pessoa de uma foto de fundo liso: o fundo é preenchido a partir do topo e das laterais de cima, com tolerância
// de cor e uma referência que acompanha devagar o degradê do fundo; a borda sai suavizada. O PNG transparente vai no
// campo `recorte` da capa, ao lado de `foto`, para o estilo que põe algo entre o fundo e a pessoa (moldura, palavra).
// Sem serviço de imagem por IA (I-16). Só serve para foto de fundo liso e diferente da pele e da roupa: confira o PNG.
//
//   node 08-FERRAMENTAS/carrossel/recortar.js <foto.jpg> <saida.png> [tolerancia=30]
'use strict';
const fs = require('fs');
const navegador = require('./navegador');

async function recortar(foto, saida, tolerancia = 30) {
  const nav = await navegador.abrir();
  try {
    const pagina = await nav.newPage();
    const tipo = /\.png$/i.test(foto) ? 'image/png' : 'image/jpeg';
    const dado = await pagina.evaluate(async ({ src, tol }) => {
      const img = new Image(); img.src = src; await img.decode();
      const W = img.naturalWidth, H = img.naturalHeight;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H); const px = d.data;
      const fundo = new Uint8Array(W * H);
      const cor = (i) => [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      // sementes só no topo e nas laterais até 45% da altura: embaixo costuma haver roupa, mesa ou objeto, que não são fundo
      const pilha = [];
      for (let x = 0; x < W; x++) pilha.push([x, 0, cor(x)]);
      for (let y = 0; y < H * 0.45; y++) { pilha.push([0, y, cor(y * W)]); pilha.push([W - 1, y, cor(y * W + W - 1)]); }
      while (pilha.length) {
        const [x, y, ref] = pilha.pop();
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = y * W + x; if (fundo[i]) continue;
        const c0 = cor(i); if (dist(c0, ref) > tol) continue;
        fundo[i] = 1;
        const r1 = ref.map((v, k) => v * 0.99 + c0[k] * 0.01); // deriva devagar com o degradê, sem seguir a borda do corpo
        pilha.push([x + 1, y, r1], [x - 1, y, r1], [x, y + 1, r1], [x, y - 1, r1]);
      }
      const R = 2; // borda suave: média 5x5 da máscara
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let s = 0, n = 0;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          s += fundo[yy * W + xx]; n++;
        }
        px[(y * W + x) * 4 + 3] = Math.round(255 * (1 - s / n));
      }
      g.putImageData(d, 0, 0);
      return c.toDataURL('image/png');
    }, { src: `data:${tipo};base64,${fs.readFileSync(foto).toString('base64')}`, tol: Number(tolerancia) });
    fs.writeFileSync(saida, Buffer.from(dado.split(',')[1], 'base64'));
  } finally { await nav.close(); }
  return saida;
}

module.exports = { recortar };
if (require.main === module) {
  const [, , foto, saida, tol] = process.argv;
  if (!foto || !saida) { console.error('uso: node 08-FERRAMENTAS/carrossel/recortar.js <foto.jpg> <saida.png> [tolerancia=30]'); process.exit(2); }
  recortar(foto, saida, tol).then((s) => console.log(`recorte: ${s}\nConfira o PNG: o recorte só funciona com fundo liso e diferente da pessoa.`), (e) => { console.error('Erro: ' + e.message); process.exit(2); });
}
