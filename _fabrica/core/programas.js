#!/usr/bin/env node
// Onde fica e como roda cada programa de vídeo da Fábrica (tsrct, whisper-cli, ffmpeg, ffprobe), no Windows e no Mac.
// É o único lugar que sabe esses caminhos: os scripts de vídeo pedem aqui em vez de fixar o endereço do Windows.
//
//   Windows: tsrct em %LOCALAPPDATA%\Tesseract\bin\tsrct.cmd (roda pelo cmd.exe), whisper em
//            08-FERRAMENTAS/whisper-cpp/bin/Release/whisper-cli.exe, ffmpeg e ffprobe do PATH (winget).
//   Mac:     tsrct em ~/Library/Application Support/Tesseract/bin/tsrct, whisper em 08-FERRAMENTAS/whisper-cpp/bin/whisper-cli,
//            ffmpeg e ffprobe em 08-FERRAMENTAS/ffmpeg/bin/ (cuidados pela Fábrica; sem eles, os do PATH).
//
// Variáveis que trocam o endereço (o autoteste usa para testar uma versão nova antes de pô-la em uso):
//   FABRICA_TSRCT, FABRICA_WHISPER (caminho do programa), FABRICA_FFMPEG_DIR (pasta com ffmpeg e ffprobe),
//   FABRICA_TESSERACT_PREFIXO (pasta de instalação do Tesseract).
// Ao ser carregado, põe a pasta do ffmpeg da Fábrica no começo do PATH deste processo (e dos filhos).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync, spawn } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');

function versaoDe(texto) {
  const m = String(texto || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

function rodarSimples(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 10000 });
  return r.status === 0 ? String(r.stdout || '').trim() : null;
}

let sistemaDesteComputador = null;
/** Sistema e arquitetura. No Mac, um Node x64 rodando sob Rosetta num chip Apple conta como arm64. */
function sistema(opc = {}) {
  const padrao = !opc.plataforma && !opc.arq && !opc.rodar;
  if (padrao && sistemaDesteComputador) return sistemaDesteComputador;
  const plataforma = opc.plataforma || process.platform;
  let arq = opc.arq || process.arch;
  const rodar = opc.rodar || rodarSimples;
  let rosetta = false, macos = null;
  if (plataforma === 'darwin') {
    rosetta = rodar('sysctl', ['-in', 'sysctl.proc_translated']) === '1';
    if (rosetta) arq = 'arm64';
    macos = versaoDe(rodar('sw_vers', ['-productVersion']));
  }
  const s = { plataforma, arq, rosetta, macos };
  if (padrao) sistemaDesteComputador = s;
  return s;
}

const caminhoDe = (plataforma) => (plataforma === 'win32' ? path.win32 : path.posix);
const contexto = (opc = {}) => {
  const plataforma = opc.plataforma || process.platform;
  return { plataforma, P: caminhoDe(plataforma), env: opc.env || process.env, home: opc.home || os.homedir(), raiz: opc.raiz || RAIZ };
};

/** Pasta onde o Tesseract é instalado neste sistema. */
function prefixoTesseract(opc = {}) {
  const { plataforma, P, env, home } = contexto(opc);
  if (env.FABRICA_TESSERACT_PREFIXO) return env.FABRICA_TESSERACT_PREFIXO;
  if (opc.prefixo) return opc.prefixo;
  if (plataforma === 'win32') return P.join(env.LOCALAPPDATA || P.join(home, 'AppData', 'Local'), 'Tesseract');
  if (plataforma === 'darwin') return P.join(home, 'Library', 'Application Support', 'Tesseract');
  return P.join(env.XDG_DATA_HOME || P.join(home, '.local', 'share'), 'Tesseract');
}

/** Caminho do programa: absoluto quando a Fábrica sabe onde ele está; só o nome quando vale o PATH. */
function caminho(nome, opc = {}) {
  const { plataforma, P, env, raiz } = contexto(opc);
  const win = plataforma === 'win32';
  if (nome === 'tsrct') return env.FABRICA_TSRCT || P.join(prefixoTesseract(opc), 'bin', win ? 'tsrct.cmd' : 'tsrct');
  if (nome === 'whisper') {
    if (env.FABRICA_WHISPER) return env.FABRICA_WHISPER;
    return win ? P.join(raiz, '08-FERRAMENTAS', 'whisper-cpp', 'bin', 'Release', 'whisper-cli.exe')
      : P.join(raiz, '08-FERRAMENTAS', 'whisper-cpp', 'bin', 'whisper-cli');
  }
  if (nome === 'ffmpeg' || nome === 'ffprobe') {
    const exe = nome + (win ? '.exe' : '');
    if (env.FABRICA_FFMPEG_DIR) return P.join(env.FABRICA_FFMPEG_DIR, exe);
    if (!win) {
      const daFabrica = P.join(raiz, '08-FERRAMENTAS', 'ffmpeg', 'bin', exe);
      if (fs.existsSync(daFabrica)) return daFabrica;
    }
    return nome;
  }
  throw new Error('programa desconhecido: ' + nome);
}

/** Um argumento com as aspas que o Windows entende (barras antes de aspas dobram). */
function aspas(a) {
  const s = String(a);
  if (s === '') return '""';
  if (!/[\s&|<>^%"]/.test(s)) return s;
  return '"' + s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}
/** A linha inteira para `cmd.exe /d /s /c` (com windowsVerbatimArguments): o cmd tira as aspas de fora e roda o resto. */
const linhaCmd = (args) => '"' + args.map(aspas).join(' ') + '"';

/**
 * Argumentos finais do tsrct. No Mac, o `export` grava o vídeo com o ffmpeg da Fábrica (que tem o libx264): o codificador
 * interno do Tesseract usa o da placa de vídeo da Apple, que nem todo Mac tem ("No usable H.264 encoder"). No Windows
 * (codificador do próprio Windows) nada muda; quem já escolheu o codificador também manda.
 */
function argsTsrct(args, opc = {}) {
  const plataforma = opc.plataforma || process.platform;
  if (plataforma === 'win32' || args[0] !== 'export' || args.includes('--encoder-backend')) return args;
  const ff = caminho('ffmpeg', { ...opc, plataforma });
  return ff === 'ffmpeg' ? args : [...args, '--encoder-backend', 'external-ffmpeg-command', '--ffmpeg-path', ff];
}

function comandoTsrct(args, opcoes = {}) {
  const env = opcoes.env || process.env;
  const t = caminho('tsrct', { env });
  const a = argsTsrct(args, { env });
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(t)) {
    return { cmd: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', linhaCmd([t, ...a])], extra: { windowsVerbatimArguments: true } };
  }
  return { cmd: t, args: a, extra: {} };
}
/** Roda o tsrct e devolve o resultado do spawnSync (status, stdout, stderr). */
function rodarTsrct(args, opcoes = {}) {
  const c = comandoTsrct(args, opcoes);
  return spawnSync(c.cmd, c.args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opcoes, ...c.extra });
}
/** Roda o tsrct e devolve a saída (lança erro, com .stderr, se ele falhar), como o execFileSync. */
function tsrctSync(args, opcoes = {}) {
  const c = comandoTsrct(args, opcoes);
  return execFileSync(c.cmd, c.args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opcoes, ...c.extra });
}
/** Abre o tsrct como processo filho (para acompanhar um export longo). */
function tsrctSpawn(args, opcoes = {}) {
  const c = comandoTsrct(args, opcoes);
  return spawn(c.cmd, c.args, { ...opcoes, ...c.extra });
}

/** Põe a pasta do ffmpeg da Fábrica no começo do PATH (uma vez só). Devolve true se pôs. */
function prepararPath(opc = {}) {
  const env = opc.env || process.env;
  const ff = caminho('ffmpeg', { ...opc, env });
  if (ff === 'ffmpeg') return false;
  const dir = path.dirname(ff);
  if (!fs.existsSync(dir)) return false;
  const sep = opc.plataforma ? (opc.plataforma === 'win32' ? ';' : ':') : path.delimiter;
  const atual = env.PATH || '';
  if (atual.split(sep).includes(dir)) return false;
  env.PATH = atual ? dir + sep + atual : dir;
  return true;
}

prepararPath();

module.exports = { RAIZ, sistema, prefixoTesseract, caminho, linhaCmd, argsTsrct, rodarTsrct, tsrctSync, tsrctSpawn, prepararPath, versaoDe };

if (require.main === module) {
  const nome = process.argv[2];
  if (!nome) { console.log(JSON.stringify({ sistema: sistema(), tsrct: caminho('tsrct'), whisper: caminho('whisper'), ffmpeg: caminho('ffmpeg'), ffprobe: caminho('ffprobe') }, null, 2)); }
  else console.log(caminho(nome));
}
