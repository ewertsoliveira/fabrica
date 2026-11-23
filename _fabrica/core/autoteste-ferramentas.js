#!/usr/bin/env node
// Autoteste das ferramentas de vídeo: prova, no próprio computador, que o ffmpeg, o whisper e o Tesseract funcionam do
// jeito que a Fábrica usa. O ferramentas.js roda este teste com a versão nova ANTES de pô-la em uso; se ela falhar, a
// versão que já funcionava continua. Leva menos de 2 minutos e só roda quando alguma versão muda.
//
//   node _fabrica/core/autoteste-ferramentas.js [--so ffmpeg,whisper,tesseract] [--json] [--sem-referencia]
//
// O que confere:
//   ffmpeg     os codificadores e filtros que a Fábrica usa; gera um vídeo de 4 s com som e o ffprobe lê.
//   whisper    transcreve uma fala curta (08-FERRAMENTAS/autoteste/fala-jfk.wav, domínio público) com as opções do Reels.
//   tesseract  monta, com um modelo de edição da Fábrica (vitrine), um vídeo de 4 s; confere o MP4 e compara 4 quadros com
//              os quadros da última versão que passou neste computador (diferença grande = "mudou o jeito como o vídeo sai").
// Variáveis só para teste: FABRICA_AUTOTESTE_FORCAR_FALHA=<etapa> reprova a etapa; FABRICA_MODELO_WHISPER troca o modelo.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { caminho, RAIZ } = require('./programas');

const CODIFICADORES = ['libx264', 'aac', 'png', 'pcm_s16le', 'libwebp', 'libvpx-vp9'];
const FILTROS = ['ebur128', 'loudnorm', 'silencedetect', 'blackdetect', 'geq', 'scale', 'highpass', 'aresample', 'tile', 'vignette'];
// Limites da comparação de quadros. Medido em 22/11/2026 (Windows): 0.6.0, 0.7.0 e 0.8.0 e duas rodadas da 0.7.0 dão
// quadros idênticos (diferença 0). Os limites ficam acima de zero só para tolerar ruído de placa de vídeo; mudar o texto
// de lugar ou de letra passa disso com folga. Ver 08-FERRAMENTAS/autoteste/LEIA-ME.md.
const LIMITE_MEDIA = 2;
const LIMITE_FRACAO = 0.005;
const MODELO_PADRAO = 'vitrine';
const QUADROS = [0.5, 1.5, 2.5, 3.5]; // segundos do vídeo de teste em que os quadros são comparados

const PASTA_REFERENCIA = (raiz) => path.join(raiz, '08-FERRAMENTAS', '.autoteste', 'referencia');

// ---------- quadros ----------

function lerPng(arq) {
  const { PNG } = require('pngjs');
  return PNG.sync.read(fs.readFileSync(arq));
}
/** Diferença entre dois quadros: média (0 a 255) e fração dos pixels que mudaram mais de 32. */
function compararQuadros(a, b) {
  const A = lerPng(a), B = lerPng(b);
  if (A.width !== B.width || A.height !== B.height) return { media: 255, fracao: 1 };
  const n = A.width * A.height;
  let soma = 0, muda = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const d = (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2])) / 3;
    soma += d;
    if (d > 32) muda++;
  }
  return { media: soma / n, fracao: muda / n };
}
/** Quadro vazio (uma cor só, sem desenho nem texto): desvio padrão da luminância abaixo de 4. */
function quadroVazio(arq) {
  const P = lerPng(arq);
  const n = P.width * P.height;
  let s = 0, s2 = 0;
  for (let i = 0; i < P.data.length; i += 4) {
    const l = 0.299 * P.data[i] + 0.587 * P.data[i + 1] + 0.114 * P.data[i + 2];
    s += l; s2 += l * l;
  }
  return Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) < 4;
}

/** Os quadros da última versão do Tesseract que passou neste computador, ou null. */
function lerReferencia(raiz = RAIZ) {
  try {
    const pasta = PASTA_REFERENCIA(raiz);
    const r = JSON.parse(fs.readFileSync(path.join(pasta, 'referencia.json'), 'utf8'));
    const quadros = r.quadros.map((q) => path.join(pasta, q));
    return quadros.every((q) => fs.existsSync(q)) ? { versao: r.versao, quadros } : null;
  } catch { return null; }
}
function gravarReferencia(raiz, quadros, versao) {
  const pasta = PASTA_REFERENCIA(raiz);
  fs.rmSync(pasta, { recursive: true, force: true });
  fs.mkdirSync(pasta, { recursive: true });
  const nomes = quadros.map((q, i) => { const nome = `quadro-${i + 1}.png`; fs.copyFileSync(q, path.join(pasta, nome)); return nome; });
  fs.writeFileSync(path.join(pasta, 'referencia.json'), JSON.stringify({ versao, quadros: nomes, gravadaEm: new Date().toISOString() }, null, 2));
}

// ---------- etapas ----------

const roda = (cmd, args, opc) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 10 * 60 * 1000, windowsHide: true, ...opc });
const motivo = (r) => (r.error ? r.error.message : String(r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-2).join(' | ')) || 'saída ' + r.status;

function videoDeTeste(ff, destino, env) {
  const r = roda(ff, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=4',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', destino], { env });
  if (r.status !== 0 || !fs.existsSync(destino)) throw new Error('o ffmpeg não gerou o vídeo de teste: ' + motivo(r));
}
function sondar(fp, arq, env) {
  const r = roda(fp, ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', arq], { env });
  if (r.status !== 0) throw new Error('o ffprobe não leu ' + path.basename(arq) + ': ' + motivo(r));
  const j = JSON.parse(r.stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  return { duracao: Number(j.format && j.format.duration), audio: (j.streams || []).some((s) => s.codec_type === 'audio'), largura: v.width, altura: v.height };
}

function etapaFfmpeg({ env, raiz, trabalho }) {
  const ff = caminho('ffmpeg', { env, raiz }), fp = caminho('ffprobe', { env, raiz });
  const enc = roda(ff, ['-hide_banner', '-encoders'], { env });
  if (enc.status !== 0) throw new Error('o ffmpeg não abriu: ' + motivo(enc));
  const fil = roda(ff, ['-hide_banner', '-filters'], { env });
  const faltaEnc = CODIFICADORES.filter((c) => !new RegExp(`\\s${c}\\s`).test(enc.stdout));
  const faltaFil = FILTROS.filter((f) => !new RegExp(`\\s${f}\\s`).test(fil.stdout));
  if (faltaEnc.length || faltaFil.length) throw new Error('este ffmpeg não tem o que a Fábrica usa: ' + [...faltaEnc, ...faltaFil].join(', '));
  const mp4 = path.join(trabalho, 'teste.mp4');
  videoDeTeste(ff, mp4, env);
  const s = sondar(fp, mp4, env);
  if (!(s.duracao >= 3.8 && s.duracao <= 4.2) || !s.audio) throw new Error(`o vídeo de teste saiu errado (duração ${s.duracao} s, som: ${s.audio ? 'sim' : 'não'})`);
  return `vídeo de teste com ${s.duracao.toFixed(1)} s e som`;
}

function etapaWhisper({ env, raiz, trabalho }) {
  const whisper = caminho('whisper', { env, raiz });
  if (!fs.existsSync(whisper)) throw new Error('o whisper não está instalado: ' + whisper);
  const modelo = env.FABRICA_MODELO_WHISPER || path.join(raiz, '08-FERRAMENTAS', 'whisper-cpp', 'modelos', 'ggml-large-v3-turbo-q5_0.bin');
  if (!fs.existsSync(modelo)) throw new Error('falta o modelo de transcrição: ' + modelo);
  // a fala vai para a pasta de trabalho: o whisper do Windows falha com acento no endereço da pasta da Fábrica
  const fala = path.join(trabalho, 'fala.wav');
  fs.copyFileSync(path.join(raiz, '08-FERRAMENTAS', 'autoteste', 'fala-jfk.wav'), fala);
  const saida = path.join(trabalho, 'fala');
  const r = roda(whisper, ['-m', modelo, '-f', fala, '-l', 'en', '-t', '4', '-ojf', '-of', saida], { env, timeout: 5 * 60 * 1000 });
  if (r.status !== 0 || !fs.existsSync(saida + '.json')) throw new Error('o whisper não transcreveu: ' + motivo(r));
  const j = JSON.parse(fs.readFileSync(saida + '.json', 'utf8'));
  const segs = j.transcription || [];
  const texto = segs.map((s) => s.text).join(' ');
  if (!/country/i.test(texto)) throw new Error('a transcrição saiu errada: "' + texto.trim().slice(0, 80) + '"');
  const tempos = segs.map((s) => s.offsets && s.offsets.from);
  if (tempos.some((t, i) => typeof t !== 'number' || (i && t < tempos[i - 1]))) throw new Error('os tempos da transcrição saíram fora de ordem');
  return `transcreveu ${texto.trim().split(/\s+/).length} palavras`;
}

function etapaTesseract({ env, raiz, trabalho, referencia, visualLivre }) {
  const tsrct = caminho('tsrct', { env, raiz });
  if (!fs.existsSync(tsrct)) throw new Error('o Tesseract não está instalado: ' + tsrct);
  const mp4 = path.join(trabalho, 'teste.mp4');
  if (!fs.existsSync(mp4)) videoDeTeste(caminho('ffmpeg', { env, raiz }), mp4, env);
  const palavras = [['Teste', 300, 700], ['da', 700, 900], ['Fábrica', 900, 1500], ['funcionando', 1600, 2400], ['agora', 2500, 3200]]
    .map(([w, ini, fim]) => ({ w, ini, fim }));
  fs.writeFileSync(path.join(trabalho, 'palavras.json'), JSON.stringify(palavras));
  const pedido = path.join(trabalho, 'pedido.json');
  fs.writeFileSync(pedido, JSON.stringify({ video: 'teste.mp4', palavras: 'palavras.json', chamada: { texto: 'Teste da Fábrica', palavra: 'fabrica', ini: 0.2, fim: 2.2 } }, null, 2));
  const saida = path.join(trabalho, 'saida');
  const montar = path.join(raiz, '08-FERRAMENTAS', 'tesseract', 'modelos', 'montar.js');
  // 4 quadros: com menos de 4, o montar.js redistribui sozinho em 6
  const r = roda(process.execPath, [montar, MODELO_PADRAO, pedido, '--exportar', '--quadros', QUADROS.join(','), '--saida', saida, '--manter-quadros', '--sem-normalizar'], { env, cwd: trabalho });
  const video = path.join(saida, MODELO_PADRAO + '.mp4');
  if (r.status !== 0 || !fs.existsSync(video)) throw new Error('o Tesseract não montou o vídeo de teste: ' + motivo(r));
  const s = sondar(caminho('ffprobe', { env, raiz }), video, env);
  if (s.largura !== 1080 || s.altura !== 1920 || !(s.duracao >= 3.7 && s.duracao <= 4.3) || !s.audio) {
    throw new Error(`o vídeo montado saiu errado (${s.largura}x${s.altura}, ${s.duracao} s, som: ${s.audio ? 'sim' : 'não'})`);
  }
  const quadros = fs.readdirSync(saida).filter((f) => new RegExp(`^${MODELO_PADRAO}-quadro-\\d+-.*\\.png$`).test(f)).sort().map((f) => path.join(saida, f));
  if (quadros.length !== QUADROS.length) throw new Error(`faltaram os quadros de conferência (${quadros.length} de ${QUADROS.length})`);
  if (quadros.some(quadroVazio)) throw new Error('um quadro do vídeo de teste saiu vazio');
  let detalhe = 'vídeo montado e conferido';
  if (referencia && !visualLivre) {
    const difs = quadros.map((q, i) => compararQuadros(q, referencia.quadros[i]));
    const pior = difs.reduce((a, d) => (d.fracao > a.fracao ? d : a), { media: 0, fracao: 0 });
    if (difs.some((d) => d.media > LIMITE_MEDIA || d.fracao > LIMITE_FRACAO)) {
      throw new Error(`mudou o jeito como o vídeo sai (diferença média ${pior.media.toFixed(1)}, ${(pior.fracao * 100).toFixed(1)}% dos pontos; referência da versão ${referencia.versao})`);
    }
    detalhe += `; igual à referência da versão ${referencia.versao} (diferença ${(pior.fracao * 100).toFixed(2)}%)`;
  }
  return { detalhe, quadros };
}

/**
 * Roda as etapas pedidas, em ordem, e para na primeira que falhar.
 * `env` aponta os programas para uma versão candidata (FABRICA_TSRCT, FABRICA_WHISPER, FABRICA_FFMPEG_DIR) e vai para os
 * processos filhos. `referencia` = { versao, quadros } para comparar; `visualLivre` dispensa a comparação.
 */
async function autotestar(opc = {}) {
  const so = opc.so || ['ffmpeg', 'whisper', 'tesseract'];
  const env = { ...process.env, ...(opc.env || {}) };
  const raiz = opc.raiz || RAIZ;
  const proprio = !opc.trabalho;
  const trabalho = opc.trabalho || fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-autoteste-'));
  const etapas = [];
  let quadros = [];
  try {
    for (const id of ['ffmpeg', 'whisper', 'tesseract'].filter((x) => so.includes(x))) {
      const t0 = Date.now();
      let ok = true, detalhe;
      try {
        if (env.FABRICA_AUTOTESTE_FORCAR_FALHA === id) throw new Error('falha forçada para teste');
        if (id === 'ffmpeg') detalhe = etapaFfmpeg({ env, raiz, trabalho });
        else if (id === 'whisper') detalhe = etapaWhisper({ env, raiz, trabalho });
        else {
          const r = etapaTesseract({ env, raiz, trabalho, referencia: opc.referencia || null, visualLivre: !!opc.visualLivre });
          detalhe = r.detalhe;
          // os quadros saem da pasta de trabalho (que é apagada) para uma pasta que fica até quem chamou decidir
          const guarda = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-quadros-'));
          quadros = r.quadros.map((q, i) => { const d = path.join(guarda, `quadro-${i + 1}.png`); fs.copyFileSync(q, d); return d; });
        }
      } catch (e) { ok = false; detalhe = e.message; }
      etapas.push({ id, ok, detalhe, ms: Date.now() - t0 });
      if (!ok) break;
    }
  } finally { if (proprio) fs.rmSync(trabalho, { recursive: true, force: true }); }
  return { ok: etapas.length > 0 && etapas.every((e) => e.ok), etapas, quadros };
}

module.exports = { autotestar, compararQuadros, quadroVazio, lerReferencia, gravarReferencia, CODIFICADORES, FILTROS, LIMITE_MEDIA, LIMITE_FRACAO };

if (require.main === module) {
  const args = process.argv.slice(2);
  const val = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  const so = val('so') ? val('so').split(',') : undefined;
  const referencia = args.includes('--sem-referencia') ? null : lerReferencia();
  autotestar({ so, referencia }).then((r) => {
    if (args.includes('--json')) console.log(JSON.stringify(r, null, 2));
    else for (const e of r.etapas) console.log(`${e.ok ? 'OK      ' : 'FALHOU  '} ${e.id}: ${e.detalhe} (${Math.round(e.ms / 1000)} s)`);
    const falha = r.etapas.find((e) => !e.ok);
    console.log(falha ? `AUTOTESTE: falhou em ${falha.id}: ${falha.detalhe}` : 'AUTOTESTE: passou');
    process.exit(r.ok ? 0 : 1);
  }, (e) => { console.log('AUTOTESTE: falhou: ' + e.message); process.exit(1); });
}
