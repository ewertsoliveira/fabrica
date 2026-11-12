#!/usr/bin/env node
// Testes de identidade.js: o resumo da identidade visual que a empresa já tem, mostrado antes de perguntar se a peça vai
// usá-la (regra L-01). Rode: node _fabrica/core/identidade.test.js
// Cada caso monta uma pasta temporária com as empresas fictícias aurora e boreal.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;
delete process.env.FABRICA_MARCA;

const identidade = require('./identidade');
const empresaMod = require('./empresa');
const SCRIPT = path.join(__dirname, 'identidade.js');

let falhas = 0;
let contador = 0;
const pastas = [];
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function novaRaiz() {
  const r = path.resolve(path.join(os.tmpdir(), `Fábrica de Teste (EMPRESA)-idt-${process.pid}-${++contador}`));
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
}
function raizDuas() {
  const r = novaRaiz();
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  return r;
}
function cli(r, ...args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: r } });
  return { status: res.status, out: res.stdout, err: res.stderr };
}
const MARCA_AURORA = [
  'origem: do-zero',
  'empresa:',
  '  nome: "Aurora Nutrição"',
  'cores:',
  '  escuro: "#1e2b3a"',
  '  claro: "#F3EEE3"',
  '  acento: "#2FB59A"',
  '  neutro: "#8C8478"',
  'tipografia:',
  '  principal:',
  '    arquivo: fontes/Fraunces[SOFT,WONK,opsz,wght].ttf',
  '  mono:',
  '    arquivo: fontes/SpaceMono-Regular.ttf',
  '  acento:',
  '    arquivo: ""',
  'pecas:',
  '  logo: "logo.svg"',
  '',
].join('\n');
const estiloJson = (estilo) => JSON.stringify({ versao: 1, estilo, origem: 'catalogo', escolhido: '2026-11-05T12:00:00.000Z', personalizacoes: {}, historico: [] }, null, 2) + '\n';

t('sem nada: recomenda criar a identidade, e o texto diz o que falta sem termo técnico', () => {
  const r = raizDuas();
  const i = identidade.daEmpresa(r, 'aurora');
  assert.strictEqual(i.marca, null);
  assert.strictEqual(i.estilo, null);
  assert.strictEqual(i.estiloDeVideo, null);
  assert.deepStrictEqual(i.pecas, { total: 0, porEstilo: {} });
  assert.strictEqual(i.recomendacao, 'criar-identidade');
  const res = cli(r, 'aurora');
  assert.strictEqual(res.status, 0, res.err);
  assert.ok(res.out.startsWith('O que Aurora Nutrição já tem de identidade visual:'), res.out);
  assert.ok(/Cores e letras: ainda não definidas/.test(res.out), res.out);
  assert.ok(/criar a identidade agora/.test(res.out), res.out);
});

t('com marca, estilo, peças e estilo de vídeo: tudo no resumo, e a recomendação é usar a identidade', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', MARCA_AURORA);
  esc(r, 'empresas/aurora/estilo.json', estiloJson('cartilha'));
  esc(r, 'empresas/aurora/estilo-de-video.md', '# Estilo de vídeo\n\nPadrão rápido, sem entrevista, em 2026-11-12.\n');
  esc(r, 'empresas/aurora/laboratorio/dados/laboratorio.json', JSON.stringify([
    { id: 'p1', estilo: { id: 'cartilha', origem: 'catalogo', nome: 'Cartilha' } },
    { id: 'p2', estilo: { id: 'cartilha', origem: 'catalogo', nome: 'Cartilha' } },
    { id: 'p3' },
  ]));
  const i = identidade.daEmpresa(r, 'aurora');
  assert.deepStrictEqual(i.marca, {
    nome: 'Aurora Nutrição',
    cores: { escuro: '#1E2B3A', claro: '#F3EEE3', acento: '#2FB59A', neutro: '#8C8478' },
    letras: { principal: 'Fraunces', mono: 'Space Mono' },
    logo: true,
    origem: 'do-zero',
  });
  assert.deepStrictEqual(i.estilo, { id: 'cartilha', nome: 'Cartilha', origem: 'catalogo', temReels: true });
  assert.deepStrictEqual(i.estiloDeVideo, { tipo: 'rapido' });
  assert.deepStrictEqual(i.pecas, { total: 3, porEstilo: { Cartilha: 2 } });
  assert.strictEqual(i.recomendacao, 'usar-identidade');
  const res = cli(r, 'aurora');
  assert.strictEqual(res.status, 0, res.err);
  for (const trecho of ['#1E2B3A (cor escura)', 'Fraunces (títulos e legendas)', 'Space Mono (rótulos pequenos)', 'Logo: tem',
    'Estilo escolhido: Cartilha', 'Peças já feitas: 3 (2 no estilo Cartilha)', 'pela edição rápida', 'usar essa identidade']) {
    assert.ok(res.out.includes(trecho), `${trecho}: ${res.out}`);
  }
  assert.deepStrictEqual(JSON.parse(cli(r, 'aurora', '--json').out), i);
});

t('sem marca e com estilo: recomenda o estilo', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/estilo.json', estiloJson('cartilha'));
  assert.strictEqual(identidade.daEmpresa(r, 'aurora').recomendacao, 'usar-estilo');
  assert.ok(/usar o estilo Cartilha/.test(cli(r, 'aurora').out));
});

t('marca sem nenhuma cor válida não conta como identidade (caso feito para falhar a recomendação)', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "Aurora Nutrição"\ncores:\n  acento: "verde"\n');
  const i = identidade.daEmpresa(r, 'aurora');
  assert.deepStrictEqual(i.marca.cores, {});
  assert.notStrictEqual(i.recomendacao, 'usar-identidade');
});

t('cada empresa lê só o que é dela: a marca da aurora nunca aparece na boreal', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/marca.yaml', MARCA_AURORA);
  const b = identidade.daEmpresa(r, 'boreal');
  assert.strictEqual(b.marca, null);
  assert.ok(!cli(r, 'boreal').out.includes('#1E2B3A'));
  assert.ok(cli(r, 'boreal').out.startsWith('O que Boreal Estúdio'));
});

t('pasta antiga (principal): a marca em 06-MARCA-E-FOTOS conta', () => {
  const r = novaRaiz();
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_AURORA.replace('Aurora Nutrição', 'Clínica Teste'));
  const i = identidade.daEmpresa(r, 'principal');
  assert.strictEqual(i.recomendacao, 'usar-identidade');
  assert.ok(cli(r, 'principal').out.startsWith('O que Clínica Teste'));
});

t('recusas: empresa que não existe e arquivo das peças quebrado saem com 1; uso errado sai com 2', () => {
  const r = raizDuas();
  const nao = cli(r, 'nao-existe');
  assert.strictEqual(nao.status, 1, nao.out + nao.err);
  assert.ok(/RECUSADO/.test(nao.err));
  esc(r, 'empresas/aurora/laboratorio/dados/laboratorio.json', '[{');
  const q = cli(r, 'aurora');
  assert.strictEqual(q.status, 1, q.out + q.err);
  assert.ok(/erro de formato/.test(q.err), q.err);
  assert.strictEqual(fs.readFileSync(path.join(r, 'empresas', 'aurora', 'laboratorio', 'dados', 'laboratorio.json'), 'utf8'), '[{');
  assert.strictEqual(cli(r).status, 2);
  assert.strictEqual(cli(r, 'aurora', '--foo').status, 2);
});

t('nome da letra: o que a pessoa reconhece, sem extensão, peso nem eixos', () => {
  assert.strictEqual(identidade.nomeDaLetra('fontes/SpaceMono-Regular.ttf'), 'Space Mono');
  assert.strictEqual(identidade.nomeDaLetra('C:\\x\\Fraunces[SOFT,WONK,opsz,wght].ttf'), 'Fraunces');
  assert.strictEqual(identidade.nomeDaLetra('DM_Serif_Display-Italic.otf'), 'DM Serif Display');
  assert.strictEqual(identidade.nomeDaLetra(''), null);
  assert.strictEqual(identidade.nomeDaLetra(undefined), null);
});

(async () => {
  for (const { nome, fn } of casos) {
    try { await fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
  }
  for (const r of pastas) fs.rmSync(r, { recursive: true, force: true });
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log('\ntodos os testes passaram');
})();
