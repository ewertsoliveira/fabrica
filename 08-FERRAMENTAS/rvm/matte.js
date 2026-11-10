// Gera a máscara de pessoa (branco = pessoa, preto = fundo) de um vídeo inteiro com o Robust Video Matting.
// Uso: node matte.js entrada.mp4 saida-matte.mp4 [segundos|''] [larguraProcessamento=360]
// Processa numa resolução reduzida (padrão 360px de largura; 12 quadros/s nesta máquina) e devolve a máscara no tamanho original.
const path = require('path');
const { spawn } = require('child_process');
const ort = require('onnxruntime-node');

const [, , entrada, saida, limite, larg = '360'] = process.argv;
const W = Number(larg), H = Math.round(W * 16 / 9);
const MODELO = path.join(__dirname, 'rvm_mobilenetv3_fp32.onnx');

(async () => {
  const sess = await ort.InferenceSession.create(MODELO, { intraOpNumThreads: 12, graphOptimizationLevel: 'all' });
  const dec = spawn('ffmpeg', ['-loglevel', 'error', ...(limite ? ['-t', limite] : []), '-i', entrada,
    '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  const enc = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'gray', '-s', `${W}x${H}`, '-r', '30', '-i', '-',
    '-vf', 'scale=1080:1920:flags=bicubic', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '14', saida]);
  enc.stderr.pipe(process.stderr);

  const tamQuadro = W * H * 3;
  let buf = Buffer.alloc(0);
  const zero = () => new ort.Tensor('float32', new Float32Array(1), [1, 1, 1, 1]);
  let rec = [zero(), zero(), zero(), zero()];
  const ratio = new ort.Tensor('float32', new Float32Array([0.5]), [1]);
  const src = new Float32Array(3 * W * H);
  let n = 0;
  const t0 = Date.now();

  const processar = async (q) => {
    for (let i = 0, p = 0; i < W * H; i++, p += 3) {
      src[i] = q[p] / 255; src[W * H + i] = q[p + 1] / 255; src[2 * W * H + i] = q[p + 2] / 255;
    }
    const out = await sess.run({ src: new ort.Tensor('float32', src, [1, 3, H, W]),
      r1i: rec[0], r2i: rec[1], r3i: rec[2], r4i: rec[3], downsample_ratio: ratio });
    rec = [out.r1o, out.r2o, out.r3o, out.r4o];
    const pha = out.pha.data;
    const g = Buffer.alloc(W * H);
    for (let i = 0; i < W * H; i++) g[i] = Math.max(0, Math.min(255, Math.round(pha[i] * 255)));
    if (!enc.stdin.write(g)) await new Promise((r) => enc.stdin.once('drain', r));
    n++;
    if (n % 150 === 0) process.stdout.write(`${n} quadros, ${(n / ((Date.now() - t0) / 1000)).toFixed(1)} q/s\n`);
  };

  dec.stdout.pause();
  let fila = Promise.resolve();
  dec.stdout.on('data', (d) => {
    buf = Buffer.concat([buf, d]);
    dec.stdout.pause();
    fila = fila.then(async () => {
      while (buf.length >= tamQuadro) { const q = buf.subarray(0, tamQuadro); buf = buf.subarray(tamQuadro); await processar(q); }
      dec.stdout.resume();
    });
  });
  dec.stdout.resume();
  dec.on('close', async () => {
    await fila;
    enc.stdin.end();
    enc.on('close', () => console.log(`pronto: ${n} quadros em ${((Date.now() - t0) / 1000).toFixed(1)}s (${(n / ((Date.now() - t0) / 1000)).toFixed(1)} q/s)`));
  });
})();
