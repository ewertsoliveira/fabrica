#!/usr/bin/env node
// Testes de estilo-da-linha.js: o estilo escolhido pela empresa (estilo.json) traduzido para as linhas (carrossel e Reels)
// e para a peça registrada no Laboratório. Rode: node _fabrica/core/estilo-da-linha.test.js
// Cada caso monta uma pasta temporária com as empresas fictícias aurora e boreal; o catálogo é o do modelo.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;
delete process.env.FABRICA_MARCA;

const linha = require('./estilo-da-linha');
const escolha = require('./escolha');
const empresaMod = require('./empresa');
const SCRIPT = path.join(__dirname, 'estilo-da-linha.js');
const CATALOGO = path.join(__dirname, '..', '..', '04-LABORATORIO-DE-DESIGN', 'estilos');

let falhas = 0;
let contador = 0;
const pastas = [];
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function novaRaiz() {
  const r = path.resolve(path.join(os.tmpdir(), `Fábrica de Teste (EMPRESA)-edl-${process.pid}-${++contador}`));
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
// A pasta do estilo do catálogo copiada como estilo próprio (o que o agente faz ao criar um estilo das referências).
function copiarComoProprio(base, id, pasta, mudarYaml = (y) => y) {
  const para = path.join(pasta, id);
  fs.cpSync(path.join(CATALOGO, base), para, { recursive: true });
  const y = fs.readFileSync(path.join(para, 'estilo.yaml'), 'utf8').replace(/^id:.*$/m, `id: ${id}`).replace(/^origem:.*$/m, 'origem: referencias');
  fs.writeFileSync(path.join(para, 'estilo.yaml'), mudarYaml(y));
  const css = path.join(para, 'estilo.css');
  if (fs.existsSync(css)) fs.writeFileSync(css, fs.readFileSync(css, 'utf8').split(`.est-${base}`).join(`.est-${id}`));
  return para;
}
// Um estilo.json escrito como o escolha.js grava (para o caso de outra empresa, escrito à mão).
const estiloJson = (estilo, origem = 'catalogo') => JSON.stringify({ versao: 1, estilo, origem, escolhido: '2026-11-05T12:00:00.000Z', personalizacoes: {}, historico: [] }, null, 2) + '\n';

function raizDuas() {
  const r = novaRaiz();
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  copiarComoProprio('terra-e-salvia', 'aurora-horta', path.join(r, 'empresas', 'aurora', 'estilos-proprios'), (y) => y.replace(/^nome:.*$/m, 'nome: Horta da Aurora'));
  return r;
}
function cli(r, ...args) {
  const res = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: r } });
  return { status: res.status, out: res.stdout, err: res.stderr };
}

// ---------- o estilo da empresa para as linhas ----------

t('sem estilo escolhido: null, e a linha segue como sempre', () => {
  const r = raizDuas();
  assert.strictEqual(linha.daEmpresa(r, 'aurora'), null);
  const res = cli(r, 'aurora');
  assert.strictEqual(res.status, 0, res.err);
  assert.ok(/Sem estilo escolhido/.test(res.out), res.out);
  assert.strictEqual(cli(r, 'aurora', '--json').out.trim(), 'null');
});

t('estilo do catálogo: o carrossel usa o estilo com as cores da marca e o Reels, o modelo do estilo com a marca', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/estilo.json', estiloJson('cartilha'));
  const e = linha.daEmpresa(r, 'aurora');
  assert.deepStrictEqual(e, {
    id: 'cartilha', origem: 'catalogo', nome: 'Cartilha',
    carrossel: { estilo: 'cartilha', cores: 'marca', pastaEstilos: null },
    reels: { modelo: 'cartilha', usarMarca: true },
  });
  const res = cli(r, 'aurora');
  assert.strictEqual(res.status, 0, res.err);
  for (const trecho of ['Cartilha', '--estilo cartilha --cores marca', 'modelo cartilha', 'usarMarca', 'FABRICA_EMPRESA=aurora']) assert.ok(res.out.includes(trecho), `${trecho}: ${res.out}`);
  assert.deepStrictEqual(JSON.parse(cli(r, 'aurora', '--json').out), e);
  // estilo só de capa de Reels: sem carrossel, o Reels continua
  esc(r, 'empresas/aurora/estilo.json', estiloJson('primeira-pagina'));
  const so = linha.daEmpresa(r, 'aurora');
  assert.strictEqual(so.carrossel, null);
  assert.deepStrictEqual(so.reels, { modelo: 'primeira-pagina', usarMarca: true });
});

t('estilo próprio: o carrossel lê da pasta da empresa e o Reels usa o modelo do estilo em que ele se baseia', () => {
  const r = raizDuas();
  escolha.usar(r, 'aurora', 'aurora-horta', { origem: 'proprio' });
  const e = linha.daEmpresa(r, 'aurora');
  assert.strictEqual(e.id, 'aurora-horta');
  assert.strictEqual(e.origem, 'proprio');
  assert.strictEqual(e.nome, 'Horta da Aurora');
  assert.deepStrictEqual(e.carrossel, { estilo: 'aurora-horta', cores: 'marca', pastaEstilos: path.join(r, 'empresas', 'aurora', 'estilos-proprios') });
  assert.deepStrictEqual(e.reels, { modelo: 'terra-e-salvia', usarMarca: true });
  // o arranjo da imagem escolhido em "Personalizar" vai para o pedido do modelo (rosto.layout)
  escolha.personalizar(r, 'aurora', { arranjoImagem: 'dividir' });
  assert.deepStrictEqual(linha.daEmpresa(r, 'aurora').reels, { modelo: 'terra-e-salvia', usarMarca: true, layout: 'dividir' });
  assert.ok(cli(r, 'aurora').out.includes('"layout": "dividir"'));
});

t('estilo de outra empresa nunca: estilo.json à mão apontando para o estilo próprio da aurora não vale na boreal', () => {
  const r = raizDuas();
  esc(r, 'empresas/boreal/estilo.json', estiloJson('aurora-horta', 'proprio'));
  assert.strictEqual(linha.daEmpresa(r, 'boreal'), null);
  assert.throws(() => linha.daPeca(r, 'boreal', 'aurora-horta'), /não é um estilo do catálogo nem um estilo próprio desta empresa/);
  assert.throws(() => linha.daPeca(r, 'boreal', { id: 'aurora-horta', origem: 'proprio' }), /desta empresa/);
  // junção da pasta de estilos da boreal para a da aurora: também não vale
  fs.mkdirSync(path.join(r, 'empresas', 'boreal'), { recursive: true });
  fs.symlinkSync(path.join(r, 'empresas', 'aurora', 'estilos-proprios'), path.join(r, 'empresas', 'boreal', 'estilos-proprios'), 'junction');
  assert.strictEqual(linha.daEmpresa(r, 'boreal'), null);
  assert.throws(() => linha.daPeca(r, 'boreal', 'aurora-horta'), /desta empresa/);
});

t('estilo da peça: código do catálogo ou próprio da empresa; o resto é recusado', () => {
  const r = raizDuas();
  assert.deepStrictEqual(linha.daPeca(r, 'aurora', 'cartilha'), { id: 'cartilha', origem: 'catalogo', nome: 'Cartilha' });
  assert.deepStrictEqual(linha.daPeca(r, 'aurora', 'aurora-horta'), { id: 'aurora-horta', origem: 'proprio', nome: 'Horta da Aurora' });
  assert.deepStrictEqual(linha.daPeca(r, 'aurora', { id: 'aurora-horta', origem: 'proprio', nome: 'Nome inventado' }), { id: 'aurora-horta', origem: 'proprio', nome: 'Horta da Aurora' });
  assert.deepStrictEqual(linha.daPeca(r, 'aurora', { id: 'cartilha' }), { id: 'cartilha', origem: 'catalogo', nome: 'Cartilha' });
  for (const ruim of ['', '../cartilha', '_demo', 'nao-existe', 'Cartilha', 'cartilha/../bloco', 42, null, [], { id: 'cartilha', origem: 'outra' }, { id: 'aurora-horta', origem: 'catalogo' }, { origem: 'proprio' }]) {
    assert.throws(() => linha.daPeca(r, 'aurora', ruim), (e) => e.code === 'ESTILO_DA_PECA' && /estilo/.test(e.message), JSON.stringify(ruim));
  }
});

t('nome de estilo próprio chega limpo: uma linha, sem controles nem invisíveis, com limite', () => {
  const r = raizDuas();
  const sujo = 'Horta' + String.fromCharCode(27) + '[31m da' + String.fromCharCode(0x200b) + ' Aurora ' + 'x'.repeat(200);
  copiarComoProprio('terra-e-salvia', 'aurora-suja', path.join(r, 'empresas', 'aurora', 'estilos-proprios'), (y) => y.replace(/^nome:.*$/m, `nome: "${sujo}"`));
  const p = linha.daPeca(r, 'aurora', 'aurora-suja');
  assert.ok(p.nome.startsWith('Horta da Aurora x'), p.nome);
  assert.ok([...p.nome].length <= 80, p.nome.length);
  assert.ok(!/[\u0000-\u001f\u007f​]/.test(p.nome), JSON.stringify(p.nome));
});

t('modelo de Reels que não existe (ou que é caminho) no estilo próprio: Reels como hoje, carrossel continua', () => {
  const r = raizDuas();
  for (const [id, modelo] of [['aurora-sem-modelo', 'nao-existe'], ['aurora-caminho', '../montar'], ['aurora-base', '_inverso']]) {
    copiarComoProprio('terra-e-salvia', id, path.join(r, 'empresas', 'aurora', 'estilos-proprios'), (y) => y.replace('modelo: terra-e-salvia', `modelo: ${modelo}`));
    escolha.usar(r, 'aurora', id, { origem: 'proprio' });
    const e = linha.daEmpresa(r, 'aurora');
    assert.strictEqual(e.reels, null, id);
    assert.strictEqual(e.carrossel.estilo, id);
  }
});

t('estilo escolhido que sumiu do catálogo: como sem estilo (null)', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/estilo.json', estiloJson('estilo-que-sumiu'));
  assert.strictEqual(linha.daEmpresa(r, 'aurora'), null);
  const res = cli(r, 'aurora');
  assert.strictEqual(res.status, 0);
  assert.ok(/não existe mais/.test(res.out), res.out);
});

t('estilo.json quebrado: erro claro, nada regravado; empresa inválida recusa', () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/estilo.json', '{"versao":1,');
  const antes = fs.readFileSync(path.join(r, 'empresas', 'aurora', 'estilo.json'));
  assert.throws(() => linha.daEmpresa(r, 'aurora'), (e) => e.code === 'JSON_INVALIDO');
  const res = cli(r, 'aurora');
  assert.strictEqual(res.status, 1);
  assert.ok(/RECUSADO/.test(res.err), res.err);
  assert.ok(Buffer.compare(antes, fs.readFileSync(path.join(r, 'empresas', 'aurora', 'estilo.json'))) === 0);
  for (const ruim of ['../boreal', '', 'nao-existe']) assert.strictEqual(cli(r, ruim).status, 1, ruim);
  assert.strictEqual(cli(r).status, 2);
  assert.strictEqual(cli(r, 'aurora', '--foo').status, 2);
});

t('pasta antiga (principal): estilos próprios em 06-MARCA-E-FOTOS/estilos-proprios', () => {
  const r = novaRaiz();
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', 'empresa:\n  nome: "Clínica Teste"\n');
  copiarComoProprio('bloco', 'clinica-bloco', path.join(r, '06-MARCA-E-FOTOS', 'estilos-proprios'));
  escolha.usar(r, 'principal', 'clinica-bloco', { origem: 'proprio' });
  const e = linha.daEmpresa(r, 'principal');
  assert.strictEqual(e.carrossel.pastaEstilos, path.join(r, '06-MARCA-E-FOTOS', 'estilos-proprios'));
  assert.deepStrictEqual(e.reels, { modelo: 'bloco', usarMarca: true });
});

(async () => {
  for (const { nome, fn } of casos) {
    try { await fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
  }
  for (const r of pastas) {
    // a junção sai antes da pasta (rmSync não segue a junção, mas tiramos ela à parte por clareza)
    try { fs.rmSync(path.join(r, 'empresas', 'boreal', 'estilos-proprios'), { force: true }); } catch { /* não era junção */ }
    fs.rmSync(r, { recursive: true, force: true });
  }
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log('\ntodos os testes passaram');
})();
