// Mixador de som dos Reels (Fábrica de Conteúdo).
// Lê a decupagem (blocos, headline, alerta e o bloco "som"), põe cada efeito do kit pelo tipo de bloco,
// mixa a trilha com ducking sobre a voz do MP4 já exportado e grava um MP4 novo (vídeo copiado, sem reexportar no Tesseract).
// Uso: node mixar-audio.js <pasta>/decupagem.json [--trilha arquivo.mp3] [--saida arquivo.mp4]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const K = require('./som/kit');
const { SR } = K;

const args = process.argv.slice(2);
const opc = (nome) => { const i = args.indexOf('--' + nome); return i >= 0 ? args[i + 1] : null; };
const decPath = path.resolve(args[0]);
const DEC = JSON.parse(fs.readFileSync(decPath, 'utf8'));
const BASE = path.dirname(decPath);
const SOM = DEC.som;
if (!SOM) throw new Error('a decupagem não tem o bloco "som"');
const VIDEO = path.resolve(BASE, SOM.videoBase);
const TRILHA = path.resolve(BASE, opc('trilha') || SOM.trilha);
const SAIDA = path.resolve(BASE, opc('saida') || SOM.saida);
const PALAVRAS = JSON.parse(fs.readFileSync(path.resolve(BASE, DEC.palavras), 'utf8'));

// níveis de cada efeito em dB, relativos ao pico de -1 dBFS do kit (a voz chega perto de 0 dBFS)
const NV = { pop: -17, tick: -20, tecla: -21, whoosh: -22, impacto: -11, swell: -22, assinatura: -15, drone: -19, ...(SOM.niveis || {}) };

const ff = (a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { maxBuffer: 1 << 30 });
const lerPcm = (arq, extra = [], filtro) => {
  const raw = execFileSync('ffmpeg', ['-v', 'error', ...extra, '-i', arq, '-vn', '-ac', '2', '-ar', String(SR), ...(filtro ? ['-af', filtro] : []), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const f = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4); const n = f.length / 2;
  const L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return [L, R];
};
const integrado = (arq) => {
  const r = require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', arq, '-vn', '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = r.stderr.match(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/); return Number(m[1]);
};
const gravaWav = (arq, [L, R]) => {
  const n = L.length; const pcm = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { pcm.writeFloatLE(L[i], i * 8); pcm.writeFloatLE(R[i], i * 8 + 4); }
  const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(arq, Buffer.concat([h, pcm]));
};
const rms = (a, i0, i1) => { let s = 0; for (let i = i0; i < i1; i++) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, i1 - i0)); };

// ---------- 1. voz ----------
const voz = lerPcm(VIDEO);
const N = voz[0].length, DUR = N / SR;
const vozMono = voz[0].map((v, i) => (v + voz[1][i]) / 2);
const vozLUFS = integrado(VIDEO);

// alerta: troca a voz pelo tratamento escolhido só dentro da janela, com transição curta, no mesmo volume
const FILTROS_VOZ = {
  radio: 'highpass=f=420,lowpass=f=3000,acompressor=threshold=0.1:ratio=4',
  eco: 'aecho=0.8:0.75:70|140:0.28|0.16,lowpass=f=5200',
  grave: 'rubberband=pitch=0.89:formant=preserved',
};
for (const al of DEC.alerta || []) {
  const filtro = FILTROS_VOZ[SOM.vozAlerta]; if (!filtro) continue;
  const molhado = lerPcm(VIDEO, [], filtro);
  const i0 = Math.round(al.ini * SR), i1 = Math.round(al.fim * SR);
  const ajuste = rms(voz[0], i0, i1) / (rms(molhado[0], i0, i1) || 1);
  const w = K.envelope(N, [[0, -120], [al.ini - 0.12, -120], [al.ini, 0], [al.fim - 0.1, 0], [al.fim + 0.1, -120], [DUR + 1, -120]]);
  for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) voz[c][i] = voz[c][i] * (1 - w[i]) + (molhado[c][i] || 0) * ajuste * w[i];
}

// ---------- 2. trilha ----------
const trilhaLUFS = integrado(TRILHA);
const trilha = lerPcm(TRILHA, ['-ss', String(SOM.trilhaInicio || 0)]);
const ganhoTrilha = (vozLUFS + SOM.trilhaLU) - trilhaLUFS;
const cartoes = DEC.blocos.filter((b) => b.tipo === 'cartao');
const fimFala = PALAVRAS[PALAVRAS.length - 1].fim / 1000;
const entrada = (DEC.headline && DEC.headline[0] && DEC.headline[0].ini < 1.5) ? DEC.headline[0].ini : 0;
const pts = [[0, -80], [entrada, -80], [entrada + 0.4, 0]];
const cortes = [...cartoes.map((c) => [c.ini, c.fim, 0.6]), ...(DEC.alerta || []).map((a) => [a.ini - 0.3, a.fim, 0.5])].sort((a, b) => a[0] - b[0]);
for (const [a, z, volta] of cortes) pts.push([a - 0.05, 0], [a, -80], [z, -80], [z + volta, 0]);
pts.push([fimFala, 0], [fimFala + 0.3, SOM.trilhaFinalDb ?? 6], [DUR - 0.6, SOM.trilhaFinalDb ?? 6], [DUR, -80]);
const envT = K.envelope(N, pts);
const duck = K.ganhoDucking(vozMono, SOM.ducking ?? 6);
const g = K.dbToG(ganhoTrilha);
const trilhaMix = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) trilhaMix[c][i] = (trilha[c][i] || 0) * g * envT[i] * duck[i];

// ---------- 3. efeitos ----------
const sfx = [new Float32Array(N), new Float32Array(N)];
const cues = [];
const poe = (som, t, nivel, nome) => { K.poe(sfx, som, t, nivel); cues.push([t, nome]); };
const ligado = (b) => !(b.som === false);
const ajusteDb = (b) => (b.som && b.som.ganhoDb) || 0;

// headline: a primeira (abertura) ganha swell + impacto; as outras, só o swell
const vistas = new Set();
(DEC.headline || []).forEach((h, k) => {
  if (vistas.has(h.ini)) return; vistas.add(h.ini);
  const s = K.swell(0.7);
  if (k === 0 && h.ini < 1.5) { poe(K.swell(h.ini > 0.2 ? h.ini : 0.4), 0, NV.swell + 2, 'swell abertura'); poe(K.impacto(), h.ini, NV.impacto, 'impacto abertura'); }
  else poe(s, h.ini - 0.65, NV.swell, 'swell ' + (h.palavra || 'headline'));
});
for (const b of DEC.blocos) {
  if (!ligado(b)) continue; const d = ajusteDb(b);
  if (b.tipo === 'tile') poe(K.pop(), b.ini, NV.pop + d, 'pop ' + b.img);
  if (b.tipo === 'mockup') poe(K.whoosh(0.5, 250, 2200), b.ini - 0.1, NV.whoosh + d, 'whoosh ' + b.img);
  if (b.tipo === 'cartao') poe(K.impacto(), b.ini, NV.impacto + d, 'impacto ' + b.palavra);
  if (b.tipo === 'busca') {
    poe(K.whoosh(), b.ini - 0.08, NV.whoosh + d, 'whoosh barra');
    const teclas = K.ritmoDigitacao(b.digitacao);
    teclas.forEach((x) => K.poe(sfx, K.tecla(x.espaco), x.t, NV.tecla + d));
    cues.push([teclas[0].t, `digitação: ${teclas.length} teclas até ${teclas[teclas.length - 1].t.toFixed(2)}s (${(teclas.length / (teclas[teclas.length - 1].t - teclas[0].t)).toFixed(1)} teclas/s)`]);
  }
  if (b.tipo === 'cta') {
    if (SOM.assinatura) poe(K.assinatura(), b.ini, NV.assinatura + d, 'assinatura');
    poe(K.tick(), b.ini + 0.45, NV.tick + d, 'clique botão');
  }
}
for (const al of DEC.alerta || []) poe(K.drone(al.fim - al.ini + 0.4), al.ini - 0.15, NV.drone, 'drone alerta');

// ---------- 4. mix, loudness e gravação ----------
const mix = [new Float32Array(N), new Float32Array(N)];
for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) mix[c][i] = voz[c][i] + trilhaMix[c][i] + sfx[c][i];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mixar-'));
const wav = path.join(tmp, 'mix.wav'); gravaWav(wav, mix);
// trilha isolada, para medir quanto ela fica abaixo da voz
const wT = path.join(tmp, 'trilha.wav'); gravaWav(wT, trilhaMix);
const alvo = SOM.alvoLUFS ?? -14;
const r1 = require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', wav, '-af', `loudnorm=I=${alvo}:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
const m = JSON.parse(r1.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]);
const ln = `loudnorm=I=${alvo}:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
ff(['-i', VIDEO, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', ln + ',aresample=48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', SAIDA]);
const trilhaLU = integrado(wT) - vozLUFS;
fs.rmSync(tmp, { recursive: true, force: true });

console.log(JSON.stringify({ saida: path.basename(SAIDA), trilha: path.basename(TRILHA), vozLUFS, trilhaVsVozLU: Number(trilhaLU.toFixed(1)), saidaLUFS: integrado(SAIDA) }));
cues.sort((a, b) => a[0] - b[0]).forEach(([t, n]) => console.log(t.toFixed(2).padStart(6), n));
