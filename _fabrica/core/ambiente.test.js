#!/usr/bin/env node
// Testes de ambiente.js (conferência do computador da pessoa). Rode: node _fabrica/core/ambiente.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { conferir, versaoDe, maiorOuIgual } = require('./ambiente.js');

let n = 0;
const caso = (nome, f) => { f(); n++; console.log('ok   ' + nome); };

caso('lê a versão do Node, do git e do npm', () => {
  assert.deepStrictEqual(versaoDe('v20.11.1'), [20, 11, 1]);
  assert.deepStrictEqual(versaoDe('git version 2.45.0.windows.1'), [2, 45, 0]);
  assert.deepStrictEqual(versaoDe('10.2'), [10, 2, 0]);
  assert.strictEqual(versaoDe('sem número'), null);
  assert.strictEqual(versaoDe(null), null);
});

caso('compara versões: 20 passa de 20, 18 não', () => {
  assert.ok(maiorOuIgual([20, 0, 0], [20]));
  assert.ok(maiorOuIgual([22, 3, 0], [20]));
  assert.ok(!maiorOuIgual([18, 19, 0], [20]));
  assert.ok(!maiorOuIgual(null, [20]));
});

caso('numa pasta vazia, falta só a dependência (Node e git já rodam este teste)', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-amb-'));
  try {
    const itens = conferir(raiz);
    const por = Object.fromEntries(itens.map((i) => [i.id, i]));
    assert.ok(por.node.ok, 'node');
    assert.ok(!por.dependencias.ok, 'sem node_modules a dependência falta');
    assert.ok(por.dependencias.comoResolver.includes('npm install'));
    assert.ok(!por.whisper.ok, 'sem a pasta do whisper');
    for (const i of itens) assert.ok(['obrigatorio', 'imagens', 'video'].includes(i.grupo), i.id);
    for (const i of itens.filter((x) => !x.ok)) assert.ok(i.comoResolver, 'todo item que falta diz como resolver: ' + i.id);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

caso('com node_modules completo a dependência passa', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-amb-'));
  try {
    for (const d of ['playwright', 'pngjs', 'onnxruntime-node']) fs.mkdirSync(path.join(raiz, 'node_modules', d), { recursive: true });
    assert.ok(conferir(raiz).find((i) => i.id === 'dependencias').ok);
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

caso('a linha de comando: --json devolve JSON e a saída 1 quando falta o obrigatório', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-amb-'));
  try {
    const r = spawnSync(process.execPath, [path.join(__dirname, 'ambiente.js'), '--json', '--raiz', raiz], { encoding: 'utf8' });
    const j = JSON.parse(r.stdout);
    assert.strictEqual(typeof j.ok, 'boolean');
    assert.ok(Array.isArray(j.itens) && j.itens.length >= 8);
    assert.strictEqual(r.status, j.ok ? 0 : 1);
    assert.strictEqual(j.ok, false, 'a pasta vazia não tem as dependências');
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

caso('modelo do whisper ou da máscara pela metade (download interrompido) não passa como OK', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-amb-'));
  try {
    const w = path.join(raiz, '08-FERRAMENTAS', 'whisper-cpp');
    fs.mkdirSync(path.join(w, 'bin', 'Release'), { recursive: true });
    fs.mkdirSync(path.join(w, 'modelos'), { recursive: true });
    fs.writeFileSync(path.join(w, 'bin', 'Release', 'whisper-cli.exe'), 'x');
    fs.writeFileSync(path.join(w, 'modelos', 'ggml-large-v3-turbo-q5_0.bin'), Buffer.alloc(1000));
    fs.mkdirSync(path.join(raiz, '08-FERRAMENTAS', 'rvm'), { recursive: true });
    fs.writeFileSync(path.join(raiz, '08-FERRAMENTAS', 'rvm', 'rvm_mobilenetv3_fp32.onnx'), Buffer.alloc(1000));
    const por = Object.fromEntries(conferir(raiz).map((i) => [i.id, i]));
    assert.ok(!por.whisper.ok && /incompleto/.test(por.whisper.detalhe), por.whisper.detalhe);
    assert.ok(!por.rvm.ok && /incompleto/.test(por.rvm.detalhe), por.rvm.detalhe);
    assert.ok(!por.onnxruntime.ok && /npm install/.test(por.onnxruntime.comoResolver));
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

console.log(`\n${n}/${n} casos passaram.`);
