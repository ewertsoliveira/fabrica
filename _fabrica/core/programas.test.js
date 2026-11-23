#!/usr/bin/env node
// Testes de programas.js (onde fica e como roda cada programa de vídeo, no Windows e no Mac).
// Rode: node _fabrica/core/programas.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { sistema, prefixoTesseract, caminho, linhaCmd, rodarTsrct, tsrctSync, prepararPath, argsTsrct } = require('./programas.js');

let n = 0;
const caso = (nome, f) => { f(); n++; console.log('ok   ' + nome); };
const tmp = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), nome + '-'));

caso('tsrct no Windows fica em %LOCALAPPDATA%\\Tesseract\\bin\\tsrct.cmd', () => {
  const t = caminho('tsrct', { plataforma: 'win32', env: { LOCALAPPDATA: 'C:\\L' } });
  assert.ok(t.startsWith('C:\\L'), t);
  assert.ok(t.endsWith('Tesseract\\bin\\tsrct.cmd'), t);
});

caso('tsrct no Mac fica em Application Support', () => {
  assert.strictEqual(caminho('tsrct', { plataforma: 'darwin', home: '/Users/x', env: {} }),
    '/Users/x/Library/Application Support/Tesseract/bin/tsrct');
  assert.strictEqual(prefixoTesseract({ plataforma: 'darwin', home: '/Users/x', env: {} }), '/Users/x/Library/Application Support/Tesseract');
});

caso('whisper: Release/whisper-cli.exe no Windows e bin/whisper-cli no Mac', () => {
  assert.strictEqual(caminho('whisper', { plataforma: 'win32', raiz: 'C:\\f', env: {} }), 'C:\\f\\08-FERRAMENTAS\\whisper-cpp\\bin\\Release\\whisper-cli.exe');
  assert.strictEqual(caminho('whisper', { plataforma: 'darwin', raiz: '/f', env: {} }), '/f/08-FERRAMENTAS/whisper-cpp/bin/whisper-cli');
});

caso('ffmpeg no Mac: a cópia da Fábrica quando existe, senão o do PATH', () => {
  const raiz = tmp('fabrica-prog');
  try {
    assert.strictEqual(caminho('ffmpeg', { plataforma: 'darwin', raiz, env: {} }), 'ffmpeg');
    const bin = path.join(raiz, '08-FERRAMENTAS', 'ffmpeg', 'bin');
    fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(path.join(bin, 'ffmpeg'), 'x');
    assert.strictEqual(caminho('ffmpeg', { plataforma: 'darwin', raiz, env: {} }), path.posix.join(raiz, '08-FERRAMENTAS', 'ffmpeg', 'bin', 'ffmpeg'));
    assert.strictEqual(caminho('ffprobe', { plataforma: 'darwin', raiz, env: {} }), 'ffprobe', 'ffprobe ainda não está lá');
    assert.strictEqual(caminho('ffmpeg', { plataforma: 'win32', raiz, env: {} }), 'ffmpeg', 'no Windows vale o PATH (winget)');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

caso('as variáveis FABRICA_TSRCT, FABRICA_WHISPER e FABRICA_FFMPEG_DIR vencem', () => {
  const env = { FABRICA_TSRCT: '/c/tsrct', FABRICA_WHISPER: '/c/whisper-cli', FABRICA_FFMPEG_DIR: '/c/ff', LOCALAPPDATA: 'C:\\L' };
  assert.strictEqual(caminho('tsrct', { plataforma: 'darwin', env }), '/c/tsrct');
  assert.strictEqual(caminho('whisper', { plataforma: 'darwin', env }), '/c/whisper-cli');
  assert.strictEqual(caminho('ffprobe', { plataforma: 'darwin', env }), '/c/ff/ffprobe');
  assert.strictEqual(caminho('ffprobe', { plataforma: 'win32', env: { FABRICA_FFMPEG_DIR: 'C:\\ff' } }), 'C:\\ff\\ffprobe.exe');
  assert.strictEqual(prefixoTesseract({ plataforma: 'win32', env: { FABRICA_TESSERACT_PREFIXO: 'D:\\T', LOCALAPPDATA: 'C:\\L' } }), 'D:\\T');
});

caso('sob Rosetta o sistema é arm64; no Windows não há macOS nem Rosetta', () => {
  assert.deepStrictEqual(sistema({ plataforma: 'darwin', arq: 'x64', rodar: (c) => (c === 'sysctl' ? '1' : '14.6.1') }),
    { plataforma: 'darwin', arq: 'arm64', rosetta: true, macos: [14, 6, 1] });
  assert.deepStrictEqual(sistema({ plataforma: 'darwin', arq: 'x64', rodar: (c) => (c === 'sysctl' ? '0' : '13.6') }),
    { plataforma: 'darwin', arq: 'x64', rosetta: false, macos: [13, 6, 0] });
  assert.deepStrictEqual(sistema({ plataforma: 'win32', arq: 'x64', rodar: () => { throw new Error('não deveria rodar nada'); } }),
    { plataforma: 'win32', arq: 'x64', rosetta: false, macos: null });
});

caso('linhaCmd põe aspas só onde precisa', () => {
  assert.strictEqual(linhaCmd(['C:\\a b\\tsrct.cmd', 'export', '-p', 'C:\\x\\p.tsrct']), '""C:\\a b\\tsrct.cmd" export -p C:\\x\\p.tsrct"');
  assert.strictEqual(linhaCmd(['t.cmd', '', 'a&b']), '"t.cmd "" "a&b""');
  assert.strictEqual(linhaCmd(['t.cmd', 'C:\\pasta com espaço\\']), '"t.cmd "C:\\pasta com espaço\\\\""', 'barra no fim dobra antes da aspa');
});

if (process.platform === 'win32') {
  caso('tsrct.cmd numa pasta com espaço recebe os argumentos inteiros', () => {
    const dir = path.join(tmp('fabrica-prog'), 'com espaço');
    fs.mkdirSync(dir, { recursive: true });
    const cmd = path.join(dir, 'tsrct.cmd');
    fs.writeFileSync(cmd, 'echo %*> "%~dp0args.txt"\r\n'); // sem o "echo off": o validador lê a arroba como conta de rede social
    try {
      const r = rodarTsrct(['project', '-p', 'C:\\a b\\p.tsrct'], { env: { ...process.env, FABRICA_TSRCT: cmd } });
      assert.strictEqual(r.status, 0, String(r.stderr));
      assert.strictEqual(fs.readFileSync(path.join(dir, 'args.txt'), 'utf8').trim(), 'project -p "C:\\a b\\p.tsrct"');
    } finally { fs.rmSync(path.dirname(dir), { recursive: true, force: true }); }
  });
}

caso('export no Mac grava o vídeo com o ffmpeg da Fábrica; no Windows, como sempre', () => {
  // no Mac o Tesseract grava pelo codificador da placa de vídeo da Apple, que nem todo Mac tem (Mac da nuvem: "No usable
  // H.264 encoder"); o ffmpeg da Fábrica tem o libx264, que funciona em qualquer Mac
  const env = { FABRICA_FFMPEG_DIR: '/f/08-FERRAMENTAS/ffmpeg/bin' };
  assert.deepStrictEqual(argsTsrct(['export', '-p', 'a.tsrct', '-o', 'a.mp4'], { plataforma: 'darwin', env }),
    ['export', '-p', 'a.tsrct', '-o', 'a.mp4', '--encoder-backend', 'external-ffmpeg-command', '--ffmpeg-path', '/f/08-FERRAMENTAS/ffmpeg/bin/ffmpeg']);
  assert.deepStrictEqual(argsTsrct(['export', '-p', 'a.tsrct'], { plataforma: 'win32', env }), ['export', '-p', 'a.tsrct']);
  assert.deepStrictEqual(argsTsrct(['preview', '-p', 'a.tsrct'], { plataforma: 'darwin', env }), ['preview', '-p', 'a.tsrct']);
  const ja = ['export', '-p', 'a.tsrct', '--encoder-backend', 'in-process-ffmpeg'];
  assert.deepStrictEqual(argsTsrct(ja, { plataforma: 'darwin', env }), ja, 'quem já escolheu o codificador manda');
  assert.deepStrictEqual(argsTsrct(['export', '-p', 'a.tsrct'], { plataforma: 'darwin', env: {}, raiz: '/sem-ffmpeg' }), ['export', '-p', 'a.tsrct'],
    'sem um ffmpeg com endereço conhecido, fica o do próprio Tesseract');
});

caso('prepararPath põe a pasta do ffmpeg da Fábrica na frente uma vez só', () => {
  const dir = tmp('fabrica-ff');
  try {
    const env = { PATH: 'outra', FABRICA_FFMPEG_DIR: dir };
    assert.strictEqual(prepararPath({ env }), true);
    assert.strictEqual(env.PATH, dir + path.delimiter + 'outra');
    assert.strictEqual(prepararPath({ env }), false, 'na segunda vez já está lá');
    assert.strictEqual(env.PATH.split(path.delimiter).filter((p) => p === dir).length, 1);
    const semFf = { PATH: 'outra' };
    assert.strictEqual(prepararPath({ env: semFf, plataforma: 'win32' }), false, 'no Windows sem variável não mexe');
    assert.strictEqual(semFf.PATH, 'outra');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

caso('nenhum script de vídeo fixa caminho de programa do Windows', () => {
  const raiz = path.resolve(__dirname, '..', '..');
  const ls = require('child_process').spawnSync('git', ['ls-files', '08-FERRAMENTAS/tesseract', '08-FERRAMENTAS/rvm', '08-FERRAMENTAS/biblioteca',
    '_fabrica/core/ambiente.js', '_fabrica/core/instalar.js'], { cwd: raiz, encoding: 'utf8' });
  if (ls.status !== 0) { console.log('pula (sem git nesta pasta)'); return; }
  // o LOCALAPPDATA sozinho continua valendo (a busca do Chrome e do Edge no Windows); o do Tesseract não
  const proibido = /tsrct\.cmd|whisper-cli\.exe|LOCALAPPDATA.{0,60}Tesseract|['"]cmd\.exe['"]/;
  const achados = [];
  for (const arq of ls.stdout.split(/\r?\n/).filter((f) => f.endsWith('.js'))) {
    fs.readFileSync(path.join(raiz, arq), 'utf8').split(/\r?\n/).forEach((l, i) => { if (proibido.test(l)) achados.push(`${arq}:${i + 1}`); });
  }
  assert.deepStrictEqual(achados, [], 'use o programas.js em vez do caminho do Windows:\n  ' + achados.join('\n  '));
});

caso('tsrctSync roda --version neste computador', () => {
  if (!fs.existsSync(caminho('tsrct'))) { console.log('pula (Tesseract não instalado neste computador): ' + caminho('tsrct')); return; }
  assert.match(tsrctSync(['--version']), /tsrct \d+\.\d+\.\d+/);
});

console.log(`\n${n}/${n} casos passaram.`);
