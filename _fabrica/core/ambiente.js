#!/usr/bin/env node
// Confere o que a Fábrica precisa neste computador. SÓ LÊ: não instala nem altera nada.
//
//   node _fabrica/core/ambiente.js [--json] [--raiz <pasta>]
//
// Três grupos:
//   obrigatorio  Node 20+, git, npm e as dependências da Fábrica (npm install). Sem isso nada roda.
//   imagens      navegador para montar carrossel, posts e capas (Chromium do Playwright, Chrome ou Edge).
//   video        o que o Reels precisa (ffmpeg, ffprobe, Tesseract, whisper), no Windows e no Mac. No Mac também confere o
//                macOS (o Tesseract exige o 14 ou mais novo) e as ferramentas da Apple (montam a transcrição).
// Saída: 0 = o obrigatório está completo; 1 = falta algo obrigatório. O que falta de imagens e vídeo é só informado.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { caminho, sistema } = require('./programas');

const args = process.argv.slice(2);
const opc = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const RAIZ = path.resolve(opc('raiz', path.join(__dirname, '..', '..')));

function versaoDe(texto) {
  const m = String(texto || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}
const maiorOuIgual = (v, min) => !!v && [0, 1, 2].reduce((r, i) => (r !== 0 ? r : Math.sign(v[i] - (min[i] || 0))), 0) >= 0;

function roda(cmd, a = []) {
  // o npm no Windows é um .cmd e precisa do shell; os outros programas rodam direto
  const r = cmd === 'npm' ? spawnSync('npm ' + a.join(" "), { encoding: 'utf8', shell: true, timeout: 15000 }) : spawnSync(cmd, a, { encoding: 'utf8', timeout: 15000 });
  return r.status === 0 ? String(r.stdout || r.stderr || "").trim() : null;
}
const existe = (...p) => fs.existsSync(path.join(...p));
const tamanho = (...p) => { try { return fs.statSync(path.join(...p)).size; } catch { return null; } };

function achaNavegador() {
  if (process.env.FABRICA_CHROMIUM && fs.existsSync(process.env.FABRICA_CHROMIUM)) return 'FABRICA_CHROMIUM';
  try {
    const { chromium } = require(require.resolve('playwright', { paths: [RAIZ] }));
    const exe = chromium.executablePath();
    if (exe && fs.existsSync(exe)) return 'Chromium do Playwright';
  } catch { /* sem playwright: cai para o navegador do sistema */ }
  const candidatos = process.platform === 'win32'
    ? [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)
      .flatMap((b) => [path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(b, 'Microsoft', 'Edge', 'Application', 'msedge.exe')])
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const achou = candidatos.find((c) => fs.existsSync(c));
  return achou ? 'navegador do sistema (defina FABRICA_CHROMIUM com este caminho: ' + achou + ')' : null;
}

/** A peça da máscara carrega de verdade? (a pasta existir não basta: no Mac Intel a versão errada não traz o programa) */
function carregaOnnx(raiz) {
  try { require(require.resolve('onnxruntime-node', { paths: [raiz] })); return { ok: true }; } catch (e) { return { ok: false, detalhe: String(e.message).split(/\r?\n/)[0].slice(0, 160) }; }
}

/** `opc.sistema` e `opc.home` trocam o sistema e a pasta pessoal conferidos (só para teste). */
function conferir(raiz = RAIZ, opc = {}) {
  const sis = opc.sistema || sistema();
  const doSistema = { raiz, plataforma: sis.plataforma };
  const itens = [];
  const add = (grupo, id, nome, ok, detalhe, comoResolver) => itens.push({ grupo, id, nome, ok: !!ok, detalhe: detalhe || '', comoResolver: ok ? '' : comoResolver });

  const node = versaoDe(process.version);
  add('obrigatorio', 'node', 'Node.js 20 ou mais novo', maiorOuIgual(node, [20]), process.version, 'Instalar o Node.js (versão LTS) em https://nodejs.org');
  const git = roda('git', ['--version']);
  add('obrigatorio', 'git', 'Git', git, git || '', 'Instalar o Git em https://git-scm.com/downloads');
  const npm = roda('npm', ['--version']);
  add('obrigatorio', 'npm', 'npm (vem com o Node.js)', npm, npm ? 'versão ' + npm : '', 'Reinstalar o Node.js: o npm vem junto');
  const deps = ['playwright', 'pngjs', 'onnxruntime-node'].filter((d) => !existe(raiz, 'node_modules', d));
  add('obrigatorio', 'dependencias', 'Dependências da Fábrica (npm install)', deps.length === 0, deps.length ? 'faltam: ' + deps.join(', ') : '', 'Rodar, na pasta da Fábrica: npm install');

  const nav = achaNavegador();
  add('imagens', 'navegador', 'Navegador para montar carrossel e posts', nav, nav || '', 'Rodar: npx playwright install chromium');

  // o whisper do Windows não abre arquivo em pasta com acento; no Mac isso não acontece
  if (sis.plataforma === 'win32') add('video', 'caminho', 'Pasta da Fábrica sem acento no nome (o vídeo precisa)', /^[ -~]*$/.test(raiz), '', 'Mover a Fábrica para uma pasta sem acento, por exemplo C:\\Fabrica-de-Conteudo');
  if (sis.plataforma === 'darwin') {
    const versaoMac = sis.macos ? sis.macos.join('.') : 'desconhecida';
    // o Tesseract exige o macOS 14 e o navegador dos carrosséis (Playwright) também pede o 14
    add('video', 'macos', 'macOS 14 ou mais novo (os vídeos exigem; os carrosséis também pedem)', !!sis.macos && maiorOuIgual(sis.macos, [14]), 'este Mac: macOS ' + versaoMac,
      `Este Mac está no macOS ${versaoMac}. Para fazer vídeos e desenhar carrosséis, atualize para o macOS 14 ou mais novo (menu da maçã, Ajustes do Sistema, Geral, Atualização de Software).`);
    const apple = spawnSync('xcode-select', ['-p'], { encoding: 'utf8', timeout: 15000 }).status === 0;
    add('video', 'apple', 'Ferramentas da Apple (para montar a transcrição)', apple, '', 'Rodar: xcode-select --install (o Mac abre uma janela; clique em Instalar)');
  }
  const ffmpeg = roda(caminho('ffmpeg', doSistema), ['-version']);
  add('video', 'ffmpeg', 'ffmpeg', ffmpeg, ffmpeg ? ffmpeg.split(/\r?\n/)[0] : '', 'Rodar: node _fabrica/core/ferramentas.js (instala o ffmpeg: no Windows pelo winget, no Mac na pasta da Fábrica)');
  const ffprobe = roda(caminho('ffprobe', doSistema), ['-version']);
  add('video', 'ffprobe', 'ffprobe (vem com o ffmpeg)', ffprobe, '', 'Vem junto com o ffmpeg');
  const caminhoTsrct = caminho('tsrct', { plataforma: sis.plataforma, ...(opc.home ? { home: opc.home } : {}) });
  const tsrct = fs.existsSync(caminhoTsrct);
  add('video', 'tesseract', 'Tesseract (montagem de vídeo)', tsrct, tsrct ? '' : 'não achei em ' + caminhoTsrct, 'Rodar: node _fabrica/core/ferramentas.js (instala o Tesseract na versão mais nova)');
  // os modelos são arquivos grandes: um download que parou no meio deixa o arquivo com o nome certo e pela metade, então
  // vale o tamanho mínimo (o mesmo do ferramentas.js), não só existir
  const exeWhisper = fs.existsSync(caminho('whisper', doSistema));
  const mWhisper = tamanho(raiz, '08-FERRAMENTAS', 'whisper-cpp', 'modelos', 'ggml-large-v3-turbo-q5_0.bin');
  const whisper = exeWhisper && mWhisper >= 500e6;
  add('video', 'whisper', 'whisper (transcrição da fala)', whisper,
    !exeWhisper ? 'falta o programa' : mWhisper === null ? 'falta o modelo' : mWhisper < 500e6 ? `modelo incompleto (${Math.round(mWhisper / 1e6)} MB de ~570 MB)` : '',
    'Rodar: node _fabrica/core/ferramentas.js (instala o whisper.cpp e o modelo na versão mais nova)');
  const mRvm = tamanho(raiz, '08-FERRAMENTAS', 'rvm', 'rvm_mobilenetv3_fp32.onnx');
  add('video', 'rvm', 'Modelo da máscara da pessoa (RVM; só para texto atrás do corpo)', mRvm !== null && mRvm >= 10e6,
    mRvm !== null && mRvm < 10e6 ? `incompleto (${(mRvm / 1e6).toFixed(1)} MB de ~15 MB)` : '', 'Rodar: node _fabrica/core/ferramentas.js');
  // a máscara roda o modelo pelo onnxruntime-node (também entre as dependências obrigatórias; aqui, para o vídeo dizer o que falta)
  const onnx = existe(raiz, 'node_modules', 'onnxruntime-node') ? carregaOnnx(raiz) : { ok: false, detalhe: 'não instalado' };
  add('video', 'onnxruntime', 'onnxruntime-node (roda o modelo da máscara)', onnx.ok, onnx.detalhe, 'Rodar, na pasta da Fábrica: npm install');
  return itens;
}

module.exports = { conferir, versaoDe, maiorOuIgual };

if (require.main === module) {
  const itens = conferir();
  const faltaObrig = itens.filter((i) => i.grupo === 'obrigatorio' && !i.ok);
  if (args.includes('--json')) {
    console.log(JSON.stringify({ ok: faltaObrig.length === 0, sistema: process.platform, itens }, null, 2));
  } else {
    const nomes = { obrigatorio: 'Obrigatório', imagens: 'Para carrossel, posts e capas', video: 'Para Reels (vídeo)' };
    for (const g of Object.keys(nomes)) {
      console.log('\n' + nomes[g]);
      for (const i of itens.filter((x) => x.grupo === g)) console.log(`  ${i.ok ? 'OK    ' : 'FALTA '} ${i.nome}${i.detalhe ? ' (' + i.detalhe + ')' : ''}${i.ok ? '' : '  -> ' + i.comoResolver}`);
    }
    console.log(faltaObrig.length ? '\nRESULTADO: falta algo obrigatório.' : '\nRESULTADO: o obrigatório está completo.');
  }
  process.exit(faltaObrig.length ? 1 : 0);
}
