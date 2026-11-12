#!/usr/bin/env node
// Testes das partes puras de ferramentas.js (sem rede). Rode: node _fabrica/core/ferramentas.test.js
'use strict';
const assert = require('assert');
const { versaoDe, comparar, escolherRelease, lerSha } = require('./ferramentas.js');

let n = 0;
const caso = (nome, f) => { f(); n++; console.log('ok   ' + nome); };

caso('lê versões de etiquetas e de saídas de programas', () => {
  assert.deepStrictEqual(versaoDe('v0.6.0'), [0, 6, 0]);
  assert.deepStrictEqual(versaoDe('tsrct 0.3.1 (abc123)'), [0, 3, 1]);
  assert.deepStrictEqual(versaoDe('b5454'), null);
  assert.strictEqual(versaoDe(''), null);
});

caso('compara versões número a número (0.10 é maior que 0.6)', () => {
  assert.strictEqual(comparar([0, 6, 0], [0, 3, 1]), 1);
  assert.strictEqual(comparar([0, 3, 1], [0, 3, 1]), 0);
  assert.strictEqual(comparar([0, 10, 0], [0, 6, 0]), 1);
  assert.strictEqual(comparar(null, [0, 1, 0]), -1);
  assert.strictEqual(comparar(null, null), 0);
});

caso('escolhe a release mais nova QUE TRAZ o programa (a mais nova sem o arquivo é pulada)', () => {
  const lista = [
    { tag_name: 'v1.9.5', assets: [] },
    { tag_name: 'b5454', assets: [{ name: 'whisper-bin-win-cpu-arm64.zip' }] },
    { tag_name: 'v1.9.0-rc', prerelease: true, assets: [{ name: 'whisper-bin-x64.zip' }] },
    { tag_name: 'v1.8.2', assets: [{ name: 'whisper-bin-x64.zip' }, { name: 'whisper-bin-Win32.zip' }] },
    { tag_name: 'v1.8.0', assets: [{ name: 'whisper-bin-x64.zip' }] },
  ];
  const r = escolherRelease(lista, /^whisper-bin-x64\.zip$/);
  assert.strictEqual(r.tag, 'v1.8.2');
  assert.deepStrictEqual(r.versao, [1, 8, 2]);
  assert.strictEqual(escolherRelease(lista, /^nao-existe\.zip$/), null);
  assert.strictEqual(escolherRelease(null, /x/), null);
});

caso('lê o checksum de um .sha256 com ou sem nome do arquivo', () => {
  const h = 'a'.repeat(64);
  assert.strictEqual(lerSha(h + '  tesseract.zip\n'), h);
  assert.strictEqual(lerSha(h.toUpperCase()), h);
  assert.strictEqual(lerSha('lixo'), null);
  assert.strictEqual(lerSha(''), null);
});

console.log(`\n${n} testes passaram.`);
