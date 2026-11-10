#!/usr/bin/env node
// Testes de guardar-token.js (a parte que não depende da área de transferência). Rode: node guardar-token.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ehTokenHF, trocarNoEnv, gravar } = require('./guardar-token.js');

let n = 0;
const caso = (nome, f) => { f(); n++; console.log('ok   ' + nome); };

caso('reconhece uma chave da Hugging Face e rejeita o resto', () => {
  assert.ok(ehTokenHF('hf_' + 'a'.repeat(34)));
  assert.ok(ehTokenHF('  hf_' + 'Ab1'.repeat(10) + '\r\n'));
  assert.ok(!ehTokenHF('hf_curta'));
  assert.ok(!ehTokenHF('uma frase qualquer que a pessoa copiou'));
  assert.ok(!ehTokenHF(''));
  assert.ok(!ehTokenHF(null));
});

caso('troca só a linha da chave e mantém o resto, com o fim de linha do arquivo', () => {
  const antes = '# comentário\r\nHF_TOKEN=\r\nCF_ACCOUNT_ID=abc\r\n';
  assert.strictEqual(trocarNoEnv(antes, 'HF_TOKEN', 'hf_novo'), '# comentário\r\nHF_TOKEN=hf_novo\r\nCF_ACCOUNT_ID=abc\r\n');
  assert.strictEqual(trocarNoEnv('A=1\n', 'HF_TOKEN', 'x'), 'A=1\nHF_TOKEN=x\n');
  assert.strictEqual(trocarNoEnv('', 'HF_TOKEN', 'x'), 'HF_TOKEN=x\n');
});

caso('gravar cria o .env a partir do exemplo e depois atualiza sem duplicar', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-tok-'));
  try {
    fs.writeFileSync(path.join(raiz, '.env.example'), '# exemplo\nHF_TOKEN=\nCF_API_TOKEN=\n');
    gravar(raiz, 'hf_primeira');
    let t = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
    assert.ok(t.includes('# exemplo') && t.includes('CF_API_TOKEN='));
    assert.strictEqual((t.match(/HF_TOKEN=/g) || []).length, 1);
    gravar(raiz, 'hf_segunda');
    t = fs.readFileSync(path.join(raiz, '.env'), 'utf8');
    assert.strictEqual((t.match(/HF_TOKEN=/g) || []).length, 1);
    assert.ok(t.includes('HF_TOKEN=hf_segunda') && !t.includes('hf_primeira'));
  } finally { fs.rmSync(raiz, { recursive: true, force: true }); }
});

console.log(`\n${n}/${n} casos passaram.`);
