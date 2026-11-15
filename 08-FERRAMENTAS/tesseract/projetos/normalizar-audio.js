// Leva o som de um MP4 já pronto a -14 LUFS (regra V-06), com o mesmo loudnorm do mixar-audio.js: duas passadas,
// pico verdadeiro -1,5 dBTP, LRA 11, linear. O vídeo é copiado, sem recodificar.
// É o caminho do modelo do estilo (montar.js): ali não há decupagem nem trilha, e o som é o do próprio vídeo, que no
// celular costuma vir bem abaixo do alvo (num caso real, -26 LUFS).
// Uso: node normalizar-audio.js <entrada.mp4> [--saida saida.mp4] [--alvo -14]
//      (sem --saida, troca o próprio arquivo, por um temporário que só vira o arquivo no fim)
//      node mixar-audio.js <entrada.mp4> [...] faz o mesmo.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const integrado = (arq) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', arq, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = String(r.stderr).match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/);
  return m ? Number(m[1]) : null;
};

/** Normaliza o som de `entrada` em `saida` (pode ser o mesmo arquivo). Devolve { antes, depois } em LUFS. */
function normalizar(entrada, saida = entrada, { alvo = -14 } = {}) {
  entrada = path.resolve(entrada); saida = path.resolve(saida);
  const r1 = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', entrada, '-vn', '-af', `loudnorm=I=${alvo}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
  const bloco = String(r1.stderr).match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!bloco) throw new Error('não consegui medir o som de ' + path.basename(entrada) + ' (o arquivo tem áudio?)');
  const m = JSON.parse(bloco[0]);
  const ln = `loudnorm=I=${alvo}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const tmp = saida.replace(/(\.\w+)?$/, `.normalizando-${process.pid}.mp4`);
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', entrada, '-map', '0:v', '-map', '0:a', '-c:v', 'copy', '-af', ln + ',aresample=48000',
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', tmp], { maxBuffer: 1 << 30 });
    fs.renameSync(tmp, saida);
  } finally { fs.rmSync(tmp, { force: true }); }
  return { antes: Number(m.input_i), depois: integrado(saida) };
}

module.exports = { normalizar, integrado };

if (require.main === module) {
  const args = process.argv.slice(2);
  const opc = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  if (!args[0] || !fs.existsSync(args[0])) { console.error('uso: node normalizar-audio.js <entrada.mp4> [--saida saida.mp4] [--alvo -14]'); process.exit(1); }
  const r = normalizar(args[0], opc('saida') || args[0], { alvo: Number(opc('alvo') || -14) });
  console.log(JSON.stringify({ saida: path.basename(opc('saida') || args[0]), antesLUFS: r.antes, depoisLUFS: r.depois }));
}
