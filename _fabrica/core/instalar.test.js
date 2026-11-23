#!/usr/bin/env node
// Testes de instalar.js (instalação guiada). Rode: node _fabrica/core/instalar.test.js
// Só testa o modo --simular e a forma das mensagens; a instalação de verdade (npm, navegador) é conferida à mão.
'use strict';
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { PASSOS, videoNesteSistema, conclusaoFinal, LIMITE_VIDEO_MS } = require('./instalar.js');

let n = 0;
const caso = (nome, f) => { f(); n++; console.log('ok   ' + nome); };

caso('--simular mostra todos os passos, numerados, sem instalar nada e sai 0', () => {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'instalar.js'), '--simular'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const linhas = r.stdout.split(/\r?\n/);
  const passos = linhas.filter((l) => /^PASSO \d+ de \d+:/.test(l));
  assert.strictEqual(passos.length, PASSOS.length);
  PASSOS.forEach((_, i) => assert.ok(passos[i].startsWith(`PASSO ${i + 1} de ${PASSOS.length}:`)));
  assert.strictEqual(linhas.filter((l) => l === 'SIMULADO').length, PASSOS.length);
  assert.ok(linhas.includes('RESULTADO: tudo pronto.'));
});

caso('as frases dos passos não usam jargão que a pessoa leiga não entende', () => {
  const proibidas = /reposit[óo]rio|clone|depend[êe]ncia|terminal|\bcomando\b|\btoken\b|\bnpm\b|\bgit\b/i;
  for (const p of PASSOS) assert.ok(!proibidas.test(p.texto), 'jargão em: ' + p.texto);
});

caso('todo passo é obrigatório e tem como rodar', () => {
  for (const p of PASSOS) { assert.strictEqual(typeof p.roda, 'function'); assert.strictEqual(p.obrigatorio, true); }
});

caso('o passo do vídeo espera o bastante para internet lenta (uns 800 MB)', () => {
  assert.ok(LIMITE_VIDEO_MS >= 90 * 60 * 1000, 'limite ' + LIMITE_VIDEO_MS);
});

caso('o passo do vídeo roda no Windows e no Mac, não no Linux', () => {
  assert.strictEqual(videoNesteSistema({ plataforma: 'win32', macos: null }).roda, true);
  assert.strictEqual(videoNesteSistema({ plataforma: 'darwin', macos: [14, 6, 0] }).roda, true);
  const linux = videoNesteSistema({ plataforma: 'linux', macos: null });
  assert.strictEqual(linux.roda, false);
  assert.ok(linux.nota);
  const velho = videoNesteSistema({ plataforma: 'darwin', macos: [13, 6, 0] });
  assert.strictEqual(velho.roda, false);
  assert.match(velho.nota, /macOS 14/);
});

caso('macOS 13: o vídeo vira aviso, e o resto da instalação segue', () => {
  const itens = [
    { grupo: 'obrigatorio', id: 'node', nome: 'Node.js', ok: true },
    { grupo: 'imagens', id: 'navegador', nome: 'Navegador', ok: true },
    { grupo: 'video', id: 'macos', nome: 'macOS 14 ou mais novo', ok: false },
    { grupo: 'video', id: 'tesseract', nome: 'Tesseract', ok: false },
  ];
  const r = conclusaoFinal(itens, { plataforma: 'darwin', macos: [13, 6, 0] });
  assert.strictEqual(r.ok, true);
  assert.match(r.nota, /macOS/);
  const noMacNovo = conclusaoFinal(itens.map((i) => (i.id === 'macos' ? { ...i, ok: true } : i)), { plataforma: 'darwin', macos: [14, 6, 0] });
  assert.strictEqual(noMacNovo.ok, false, 'no macOS 14 o vídeo é obrigatório');
  assert.match(noMacNovo.erro, /Tesseract/);
});

console.log(`\n${n}/${n} casos passaram.`);
