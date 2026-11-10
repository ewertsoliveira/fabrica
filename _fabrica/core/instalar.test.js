#!/usr/bin/env node
// Testes de instalar.js (instalação guiada). Rode: node _fabrica/core/instalar.test.js
// Só testa o modo --simular e a forma das mensagens; a instalação de verdade (npm, navegador) é conferida à mão.
'use strict';
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { PASSOS } = require('./instalar.js');

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

console.log(`\n${n}/${n} casos passaram.`);
