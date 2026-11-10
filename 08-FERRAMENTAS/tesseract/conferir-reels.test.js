#!/usr/bin/env node
// Teste do conferir-reels.js: roda a calibração do próprio script (--autoteste), que gera vídeos sintéticos com o ffmpeg e
// confere que o caso limpo passa, o caso feito para falhar reprova em todos os itens esperados e o cartão de chamada vale:
// AVISO só para o pedido de um modelo (o vídeo feito com o modelo do estilo), FALHA para a decupagem sem cartão, com 2
// cartões e para o arquivo que só parece um pedido de modelo.
// Rode: node 08-FERRAMENTAS/tesseract/conferir-reels.test.js   (precisa do ffmpeg e do ffprobe no PATH)
'use strict';
const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'conferir-reels.js');
const x = spawnSync(process.execPath, [SCRIPT, '--autoteste'], { encoding: 'utf8', timeout: 5 * 60000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'pipe'] });
const saida = (x.stdout || '') + (x.stderr || '');
assert.strictEqual(x.status, 0, 'a calibração do conferir-reels.js falhou:\n' + saida);
assert.ok(/Resultado da calibração:\*\* o script reprovou o caso feito para falhar/.test(saida), saida);
assert.ok(!/\(ERRO\)/.test(saida), 'algum caso saiu diferente do esperado:\n' + saida);
for (const caso of ['Caso 3', 'Caso 4', 'Caso 5', 'Caso 6']) assert.ok(saida.includes(`| ${caso}`), `a tabela do cartão de chamada não traz o ${caso}:\n${saida}`);
console.log('ok   conferir-reels.js --autoteste: caso limpo passa, caso ruim reprova, cartão de chamada (modelo = aviso; o resto = falha)');
