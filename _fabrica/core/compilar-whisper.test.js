#!/usr/bin/env node
// Testes das partes de compilar-whisper.js que não dependem do Mac nem da rede.
// Rode: node _fabrica/core/compilar-whisper.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { argumentosCmake, prefixoArquitetura, escolherCmakeMac, cmakeDaUltima, temFerramentasApple, compilarWhisper } = require('./compilar-whisper.js');

const casos = [];
const caso = (nome, f) => casos.push([nome, f]);

caso('CMake: argumentos fixos e arquitetura do sistema', () => {
  const arm = argumentosCmake({ arq: 'arm64' });
  for (const a of ['-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_EXAMPLES=ON', '-DCMAKE_OSX_ARCHITECTURES=arm64']) {
    assert.ok(arm.includes(a), 'falta ' + a);
  }
  assert.ok(!arm.includes('-DGGML_METAL=OFF'), 'no chip Apple a placa de vídeo (Metal) fica ligada');
  const intel = argumentosCmake({ arq: 'x64' });
  assert.ok(intel.includes('-DCMAKE_OSX_ARCHITECTURES=x86_64'));
  assert.ok(intel.includes('-DGGML_METAL=OFF'), 'no Intel a transcrição roda no processador');
});

caso('sob Rosetta o build roda com arch -arm64', () => {
  assert.deepStrictEqual(prefixoArquitetura({ rosetta: true, arq: 'arm64' }), ['arch', '-arm64']);
  assert.deepStrictEqual(prefixoArquitetura({ rosetta: false, arq: 'arm64' }), []);
  assert.deepStrictEqual(prefixoArquitetura({ rosetta: false, arq: 'x64' }), []);
});

caso('escolhe o CMake universal do Mac e o arquivo de conferência', () => {
  const nomes = ['cmake-4.5.1-macos-universal.dmg', 'cmake-4.5.1-macos-universal.tar.gz', 'cmake-4.5.1-macos10.10-universal.tar.gz',
    'cmake-4.5.1-SHA-256.txt', 'cmake-4.5.1-SHA-256.txt.asc', 'cmake-4.5.1-windows-x86_64.zip'];
  const r = escolherCmakeMac({ tag_name: 'v4.5.1', assets: nomes.map((name) => ({ name, browser_download_url: 'x/' + name })) });
  assert.strictEqual(r.tarball.name, 'cmake-4.5.1-macos-universal.tar.gz');
  assert.strictEqual(r.sha.name, 'cmake-4.5.1-SHA-256.txt');
  assert.strictEqual(escolherCmakeMac({ assets: [{ name: 'cmake-4.5.1-windows-x86_64.zip' }] }), null);
});

caso('CMake pela página pública de "última versão" (sem a consulta limitada do GitHub)', () => {
  // a consulta de versões do GitHub sem login tem limite (HTTP 403 em internet compartilhada); o endereço público não
  const r = cmakeDaUltima('github.com/Kitware/CMake/releases/tag/v4.5.1');
  assert.strictEqual(r.tarball.name, 'cmake-4.5.1-macos-universal.tar.gz');
  assert.strictEqual(r.sha.name, 'cmake-4.5.1-SHA-256.txt');
  assert.match(r.tarball.browser_download_url, /^https:\/\/github\.com\/Kitware\/CMake\/releases\/download\/v4\.5\.1\/cmake-4\.5\.1-macos-universal\.tar\.gz$/);
  assert.match(r.sha.browser_download_url, /\/releases\/download\/v4\.5\.1\/cmake-4\.5\.1-SHA-256\.txt$/);
  assert.strictEqual(cmakeDaUltima('github.com/Kitware/CMake/releases'), null);
});

caso('sem as ferramentas da Apple, avisa em palavras simples', async () => {
  const semApple = (cmd) => ({ status: cmd === 'xcode-select' ? 2 : 0, stdout: '', stderr: '' });
  assert.strictEqual(temFerramentasApple(semApple), false);
  assert.strictEqual(temFerramentasApple(() => ({ status: 0, stdout: '/Library/Developer/CommandLineTools\n' })), true);
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-cw-'));
  try {
    await assert.rejects(compilarWhisper({ etiqueta: 'b5907', destino, sis: { plataforma: 'darwin', arq: 'arm64', rosetta: false }, rodar: semApple, log: () => {} }),
      /ferramentas gratuitas da Apple/);
  } finally { fs.rmSync(destino, { recursive: true, force: true }); }
});

(async () => {
  let n = 0;
  for (const [nome, f] of casos) { await f(); n++; console.log('ok   ' + nome); }
  console.log(`\n${n}/${casos.length} casos passaram.`);
})().catch((e) => { console.error(e); process.exit(1); });
