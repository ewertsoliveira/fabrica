#!/usr/bin/env node
// Testes de rede.js (sem internet: as falhas são simuladas). Rode: node _fabrica/core/rede.test.js
'use strict';
const assert = require('assert');
const { comTentativas, descreverErro, lerSha, shaDaLista, cabecalhos } = require('./rede.js');

const casos = [];
const caso = (nome, f) => casos.push([nome, f]);
const falhaDeRede = (codigo) => { const e = new TypeError('fetch failed'); e.cause = { code: codigo, message: 'socket hang up' }; return e; };

caso('a mensagem de erro traz a causa da falha de rede', () => {
  assert.strictEqual(descreverErro(falhaDeRede('ECONNRESET')), 'fetch failed (ECONNRESET: socket hang up)');
  assert.strictEqual(descreverErro(new Error('não consegui baixar x (HTTP 404)')), 'não consegui baixar x (HTTP 404)');
});

caso('falha de rede tenta de novo e, na terceira, passa', async () => {
  let n = 0;
  const r = await comTentativas(async () => { n++; if (n < 3) throw falhaDeRede('ETIMEDOUT'); return 'ok'; }, { espera: 0, log: () => {} });
  assert.strictEqual(r, 'ok');
  assert.strictEqual(n, 3);
});

caso('erro que não é de rede (HTTP 404) não tenta de novo', async () => {
  let n = 0;
  await assert.rejects(comTentativas(async () => { n++; throw new Error('não consegui baixar x (HTTP 404)'); }, { espera: 0, log: () => {} }), /HTTP 404/);
  assert.strictEqual(n, 1);
});

caso('depois da última tentativa, o erro sai com a causa', async () => {
  await assert.rejects(comTentativas(async () => { throw falhaDeRede('UND_ERR_CONNECT_TIMEOUT'); }, { tentativas: 2, espera: 0, log: () => {} }),
    /fetch failed \(UND_ERR_CONNECT_TIMEOUT/);
});

caso('a chave do GitHub (quando existe no ambiente) só vai para a consulta do GitHub', () => {
  const env = { GITHUB_TOKEN: 'segredo' };
  assert.strictEqual(cabecalhos('https://api.github.com/repos/a/b/releases', env).Authorization, 'Bearer segredo');
  assert.strictEqual(cabecalhos('https://huggingface.co/x', env).Authorization, undefined);
  assert.strictEqual(cabecalhos('https://api.github.com.outro.site/x', env).Authorization, undefined);
  assert.strictEqual(cabecalhos('https://api.github.com/repos/a/b/releases', {}).Authorization, undefined);
});

caso('conferência: lê o hash de um .sha256 e de uma lista com vários arquivos', () => {
  const h = 'b'.repeat(64);
  assert.strictEqual(lerSha(h + '  a.zip'), h);
  assert.strictEqual(shaDaLista(`${'a'.repeat(64)}  outro.tar.gz\n${h}  cmake-4.5.1-macos-universal.tar.gz\n`, 'cmake-4.5.1-macos-universal.tar.gz'), h);
  assert.strictEqual(shaDaLista('lixo', 'x'), null);
});

(async () => {
  let n = 0;
  for (const [nome, f] of casos) { await f(); n++; console.log('ok   ' + nome); }
  console.log(`\n${n}/${casos.length} casos passaram.`);
})().catch((e) => { console.error(e); process.exit(1); });
