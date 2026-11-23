#!/usr/bin/env node
// Testes do autoteste das ferramentas de vídeo. Rode: node _fabrica/core/autoteste-ferramentas.test.js
// O caso "de verdade" roda ffmpeg, whisper e Tesseract deste computador (pula com aviso se faltar algum).
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PNG } = require('pngjs');
const { autotestar, compararQuadros, quadroVazio, lerReferencia, gravarReferencia } = require('./autoteste-ferramentas.js');
const { caminho } = require('./programas');

const casos = [];
const caso = (nome, f) => casos.push([nome, f]);
const tmp = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), nome + '-'));

/** PNG 100x100 de uma cor, com um retângulo de outra cor (opcional) ou listras. */
function png(arq, { cor = [40, 40, 40], ret = null, listras = false } = {}) {
  const p = new PNG({ width: 100, height: 100 });
  for (let y = 0; y < 100; y++) for (let x = 0; x < 100; x++) {
    const i = (y * 100 + x) * 4;
    let c = cor;
    if (listras && Math.floor(x / 10) % 2) c = [230, 230, 230];
    if (ret && x >= ret.x && x < ret.x + ret.l && y >= ret.y && y < ret.y + ret.a) c = ret.cor;
    p.data[i] = c[0]; p.data[i + 1] = c[1]; p.data[i + 2] = c[2]; p.data[i + 3] = 255;
  }
  fs.writeFileSync(arq, PNG.sync.write(p));
  return arq;
}

caso('compararQuadros: iguais dão 0; um retângulo trocado dá a fração da área', () => {
  const d = tmp('fabrica-at');
  try {
    const a = png(path.join(d, 'a.png'));
    const b = png(path.join(d, 'b.png'), { ret: { x: 5, y: 5, l: 10, a: 10, cor: [250, 250, 250] } });
    assert.deepStrictEqual(compararQuadros(a, a), { media: 0, fracao: 0 });
    const r = compararQuadros(a, b);
    assert.strictEqual(r.fracao, 0.01);
    assert.ok(r.media > 0 && r.media < 3, 'média ' + r.media);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

caso('quadroVazio: imagem lisa é vazia; com listras não', () => {
  const d = tmp('fabrica-at');
  try {
    assert.strictEqual(quadroVazio(png(path.join(d, 'liso.png'))), true);
    assert.strictEqual(quadroVazio(png(path.join(d, 'listras.png'), { listras: true })), false);
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

caso('referência: grava os quadros da versão que passou e lê de volta', () => {
  const raiz = tmp('fabrica-at');
  try {
    assert.strictEqual(lerReferencia(raiz), null);
    const q = [png(path.join(raiz, 'q1.png')), png(path.join(raiz, 'q2.png'), { listras: true })];
    gravarReferencia(raiz, q, '0.8.0');
    const r = lerReferencia(raiz);
    assert.strictEqual(r.versao, '0.8.0');
    assert.strictEqual(r.quadros.length, 2);
    assert.deepStrictEqual(compararQuadros(r.quadros[1], q[1]), { media: 0, fracao: 0 });
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

caso('uma etapa reprovada reprova o autoteste e diz qual', async () => {
  const vazia = tmp('fabrica-at');
  try {
    const r = await autotestar({ so: ['ffmpeg'], env: { FABRICA_FFMPEG_DIR: vazia } });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.etapas[0].id, 'ffmpeg');
    assert.strictEqual(r.etapas[0].ok, false);
  } finally { fs.rmSync(vazia, { recursive: true, force: true }); }
});

caso('a falha forçada para teste reprova só a etapa pedida', async () => {
  const r = await autotestar({ so: ['ffmpeg'], env: { FABRICA_AUTOTESTE_FORCAR_FALHA: 'ffmpeg' } });
  assert.strictEqual(r.ok, false);
  assert.match(r.etapas[0].detalhe, /falha forçada/);
});

caso('autoteste de verdade neste computador passa', async () => {
  const raiz = path.resolve(__dirname, '..', '..');
  const modelo = process.env.FABRICA_MODELO_WHISPER || path.join(raiz, '08-FERRAMENTAS', 'whisper-cpp', 'modelos', 'ggml-large-v3-turbo-q5_0.bin');
  const falta = [['tsrct', caminho('tsrct')], ['whisper', caminho('whisper')], ['modelo do whisper', modelo]].filter(([, p]) => !fs.existsSync(p));
  if (falta.length) { console.log('pula (falta neste computador: ' + falta.map(([n]) => n).join(', ') + ')'); return; }
  const r = await autotestar({});
  assert.strictEqual(r.ok, true, JSON.stringify(r.etapas, null, 1));
  assert.deepStrictEqual(r.etapas.map((e) => e.id), ['ffmpeg', 'whisper', 'tesseract']);
  assert.strictEqual(r.quadros.length, 4);
  for (const q of r.quadros) assert.strictEqual(quadroVazio(q), false);
});

(async () => {
  let n = 0;
  for (const [nome, f] of casos) { await f(); n++; console.log('ok   ' + nome); }
  console.log(`\n${n}/${casos.length} casos passaram.`);
})().catch((e) => { console.error(e); process.exit(1); });
