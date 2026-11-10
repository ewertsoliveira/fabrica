// Prévias da galeria do painel: WebM leve (540x960, sem áudio) e capa JPG de cada modelo, a partir dos MP4 exportados.
// Uso: node gerar-previas.js [pasta-dos-mp4]   (padrão: amostra/saida)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ORIGEM = path.resolve(process.argv[2] || path.join(__dirname, 'amostra', 'saida'));
const DESTINO = path.join(__dirname, 'previews');
fs.mkdirSync(DESTINO, { recursive: true });
const modelos = fs.readdirSync(path.join(__dirname, 'estilos')).filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.replace('.js', ''));

for (const id of modelos) {
  const mp4 = path.join(ORIGEM, id + '.mp4');
  if (!fs.existsSync(mp4)) { console.log(id, '— sem MP4, pulei'); continue; }
  const capaEm = require('./estilos/' + id).capa ?? 1.2;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', mp4, '-an', '-vf', 'scale=540:960', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1', path.join(DESTINO, id + '.webm')]);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(capaEm), '-i', mp4, '-frames:v', '1', '-vf', 'scale=540:960', '-q:v', '4', path.join(DESTINO, id + '.jpg')]);
  const kb = (f) => Math.round(fs.statSync(path.join(DESTINO, f)).size / 1024);
  console.log(id, `webm ${kb(id + '.webm')} KB, jpg ${kb(id + '.jpg')} KB`);
}
