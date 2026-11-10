#!/usr/bin/env node
// Testes de apos-marca.js: o ponto único que o servidor dos painéis chama depois de toda gravação de marca feita pelo
// painel (gravar, desfazer, marca nascida de um estilo). O gatilho de hoje pede as prévias na marca de hoje
// (08-FERRAMENTAS/biblioteca/fila-marca.js, pedir) quando a marca da empresa está definida, e não pede nada quando ela
// foi desfeita (sem marca); nunca lança erro para quem chamou, mesmo quando o próprio gatilho falha.
// Rode: node _fabrica/paineis/testes/apos-marca.test.js   (só Node: nada de Chromium nem montar.js)
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O ambiente de quem roda o teste não pode escolher empresa, marca, pasta ou vez da fila por conta própria.
delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;
delete process.env.FABRICA_RAIZ;
delete process.env.FABRICA_FILA_VEZ;

const apos = require(path.join(__dirname, '..', 'apos-marca.js'));
const empresaMod = require(path.join(__dirname, '..', '..', 'core', 'empresa.js'));
const filaMarca = require(path.join(__dirname, '..', '..', '..', '08-FERRAMENTAS', 'biblioteca', 'fila-marca.js'));

const LAB = '04-LABORATORIO-DE-DESIGN';
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });
const pastas = [];
let contador = 0;
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

function novaRaiz() {
  const r = path.join(os.tmpdir(), `apos-marca-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
const existeFila = (r, c) => fs.existsSync(path.join(r, 'empresas', c, 'previas', 'fila.json'));

// Cores montadas em código (o validador não aceita hex solto fora de teste isento).
const hex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const AURORA = { nome: 'Aurora Nutrição', cores: { escuro: hex(58, 30, 36), claro: hex(255, 243, 228), acento: hex(228, 87, 46), neutro: hex(176, 125, 98) } };
const yamlMarca = (m) => ['empresa:', `  nome: "${m.nome}"`, '', 'cores:', ...Object.entries(m.cores).map(([p, v]) => `  ${p}: "${v}"`), ''].join('\n');
const yamlEstilo = (id) => [`id: ${id}`, `nome: Estilo ${id}`, 'linha: Frase.', 'origem: catalogo', ''].join('\n');

// aurora com marca definida; boreal sem marca (nunca teve, como depois de um "Desfazer" até sobrar nenhuma).
function raiz() {
  const r = novaRaiz();
  esc(r, `${LAB}/estilos/cartaz/estilo.yaml`, yamlEstilo('cartaz'));
  esc(r, `${LAB}/biblioteca/vocabulario.json`, '{}');
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Finanças', r);
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
  return r;
}

// Lançador de mentira: anota o pedido e devolve o pid deste processo (nunca sobe um `fila-marca.js rodar` de verdade).
const falso = () => { const lancados = []; return { lancados, lancar: (p) => { lancados.push(p); return process.pid; } }; };

t('gatilho de verdade: com marca definida, pede as prévias (a fila nasce depois da resposta) e lança o trabalhador uma vez', async () => {
  const r = raiz();
  const { lancados, lancar } = falso();
  const chamou = apos.depoisDaMarca(r, 'aurora', { lancar });
  assert.strictEqual(chamou, true, 'havia gatilho');
  assert.ok(!existeFila(r, 'aurora'), 'nada ainda: o gatilho roda depois (setImmediate), não na hora');
  await dormir(200);
  assert.ok(existeFila(r, 'aurora'), 'a fila da aurora nasceu');
  assert.strictEqual(lancados.length, 1, 'o trabalhador foi lançado uma vez');
  assert.strictEqual(lancados[0].raiz, path.resolve(r));
  assert.strictEqual(lancados[0].args[1], 'rodar');
  const e = filaMarca.estado(r, 'aurora');
  assert.notStrictEqual(e.estado, 'sem-marca');
  assert.strictEqual(e.trabalhador, true, 'a faixa não fica "parada"');
});

t('gatilho de verdade: sem marca definida (desfeita), não pede nada, não lança ninguém e não lança SEM_MARCA', async () => {
  const r = raiz();
  const { lancados, lancar } = falso();
  assert.strictEqual(apos.depoisDaMarca(r, 'boreal', { lancar }), true);
  await dormir(200);
  assert.ok(!existeFila(r, 'boreal'), 'nada pedido para quem não tem marca');
  assert.strictEqual(lancados.length, 0);
  assert.strictEqual(filaMarca.estado(r, 'boreal').estado, 'sem-marca');
});

t('gatilho de verdade: pedir para a aurora nunca pede nada para a boreal', async () => {
  const r = raiz();
  const { lancados, lancar } = falso();
  apos.depoisDaMarca(r, 'aurora', { lancar });
  await dormir(200);
  assert.ok(existeFila(r, 'aurora'));
  assert.ok(!existeFila(r, 'boreal'), 'a boreal nunca foi chamada: nada pedido para ela');
  assert.strictEqual(lancados.length, 1);
});

t('gatilho de verdade: uma segunda gravação com o trabalhador vivo não duplica a fila nem lança de novo', async () => {
  const r = raiz();
  const { lancados, lancar } = falso();
  apos.depoisDaMarca(r, 'aurora', { lancar });
  await dormir(200);
  const arq = path.join(r, 'empresas', 'aurora', 'previas', 'fila.json');
  const antes = JSON.parse(fs.readFileSync(arq, 'utf8'));
  apos.depoisDaMarca(r, 'aurora', { lancar });
  await dormir(200);
  const depois = JSON.parse(fs.readFileSync(arq, 'utf8'));
  assert.strictEqual(depois.assinatura, antes.assinatura, 'a marca não mudou: a mesma assinatura');
  assert.strictEqual(depois.videos.length, antes.videos.length);
  assert.strictEqual(depois.pedidoEm, antes.pedidoEm);
  assert.strictEqual(lancados.length, 1, 'o trabalhador já estava vivo: nada lançado de novo');
});

t('gatilho de verdade: um lançador que lança erro não escapa e a lista continua gravada', async () => {
  const r = raiz();
  const chamou = apos.depoisDaMarca(r, 'aurora', { lancar: () => { throw new Error('lançador de mentira falhou'); } });
  assert.strictEqual(chamou, true);
  await dormir(200);
  assert.ok(existeFila(r, 'aurora'), 'a lista ficou gravada');
});

t('depoisDaMarca: um gatilho (de mentira) que lança na hora não escapa para quem chamou nem derruba o processo', () => {
  const r = raiz();
  let chamou;
  assert.doesNotThrow(() => {
    chamou = apos.depoisDaMarca(r, 'aurora', { gatilho: () => { throw new Error('gatilho de mentira falhou de propósito'); } });
  });
  assert.strictEqual(chamou, true);
});

t('depoisDaMarca: um gatilho (de mentira) assíncrono que rejeita também não escapa para quem chamou', async () => {
  const r = raiz();
  const chamou = apos.depoisDaMarca(r, 'aurora', { gatilho: async () => { throw new Error('rejeitada de propósito'); } });
  assert.strictEqual(chamou, true);
  await dormir(50); // a rejeição só vai para o console (registrada por console.error), nunca para quem chamou
});

t('depoisDaMarca: o gatilho recebe exatamente a raiz e o código pedidos, nunca de outra empresa', async () => {
  const r = raiz();
  const recebido = [];
  apos.depoisDaMarca(r, 'aurora', { gatilho: (raiz, codigo) => { recebido.push([raiz, codigo]); } });
  await dormir(50);
  assert.deepStrictEqual(recebido, [[r, 'aurora']]);
});

(async () => {
  let ok = 0;
  let falhas = 0;
  for (const { nome, fn } of casos) {
    try { await fn(); ok++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + (e && e.stack || e)); }
  }
  for (const p of pastas) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* o sistema limpa depois */ } }
  console.log(`\n${ok} testes passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})();
