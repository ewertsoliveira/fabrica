#!/usr/bin/env node
// Testes do validador anti-vazamento. Rode: node 08-FERRAMENTAS/validador-anti-vazamento/validar.test.js
// Cada caso monta uma pasta temporária com empresas fictícias e roda o validador num processo filho.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// O ambiente de quem roda o teste não pode interferir nos casos.
delete process.env.FABRICA_TERMOS;
delete process.env.FABRICA_RAIZ;
delete process.env.FABRICA_EMPRESA;

const SCRIPT = path.join(__dirname, 'validar.js');

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

const pastaTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'validar-'));
function escrever(r, rel, texto) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto, 'utf8');
}
function rodar(args) {
  const x = spawnSync(process.execPath, [SCRIPT, ...args], { env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}

const LAMINA = 'empresas/aurora/saidas/carrossel/lamina-1.html';

// Duas empresas em gaveta: Aurora (com uma lâmina de carrossel só sobre ela) e Boreal.
function montar({ soAurora = false } = {}) {
  const r = pastaTemp();
  const empresas = [{ codigo: 'aurora', nome: 'Aurora Nutrição', disposicao: 'gaveta', criada: '2026-10-30' }];
  if (!soAurora) empresas.push({ codigo: 'boreal', nome: 'Boreal Advocacia', disposicao: 'gaveta', criada: '2026-10-30' });
  escrever(r, 'empresas/indice.json', JSON.stringify({ empresas }));
  escrever(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "Aurora Nutrição"\n  handle: "@aurora.nutri"\n');
  escrever(r, LAMINA, '<p>Aurora Nutrição ensina a comer bem.</p>\n');
  if (!soAurora) {
    escrever(r, 'empresas/boreal/marca.yaml', 'empresa:\n  nome: "Boreal Advocacia"\n');
    escrever(r, 'empresas/boreal/termos.txt', '// cidade da empresa\nFlorianópolis\n');
  }
  return r;
}

t('limpo: a lâmina fala só de Aurora', () => {
  const r = montar();
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.ok(x.saida.includes('CONFERÊNCIA ENTRE EMPRESAS · Aurora Nutrição (aurora)'), x.saida);
  assert.ok(x.saida.includes('RESULTADO: nada de outra empresa.'), x.saida);
});

t('termo de outra empresa reprova e diz de quem é', () => {
  const r = montar();
  escrever(r, LAMINA, '<p>Fale com a Boreal Advocacia.</p>\n');
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.ok(x.saida.includes('Boreal Advocacia'), x.saida);
  assert.ok(x.saida.includes('boreal'), x.saida);
  assert.ok(x.saida.includes(LAMINA + ':1'), x.saida);
  assert.ok(x.saida.includes('RESULTADO: 1 termo(s) de outra empresa. Não entregue.'), x.saida);
});

t('caractere invisível no meio do termo não escapa (hífen suave, espaço de largura zero)', () => {
  for (const [rotulo, invisivel] of [['hífen suave', '\u00AD'], ['espaço de largura zero', '\u200B'], ['junção de largura zero', '\u200D']]) {
    const r = montar();
    escrever(r, LAMINA, `<p>Fale com a Bo${invisivel}real Advocacia.</p>\n`);
    const x = rodar(['--empresa', 'aurora', '--raiz', r]);
    assert.strictEqual(x.status, 1, rotulo + '\n' + x.saida + x.erro);
    assert.ok(x.saida.includes('é termo de Boreal Advocacia (boreal)'), rotulo + '\n' + x.saida);
  }
});

t('checagens genéricas desligadas: cor e fonte não reprovam', () => {
  const r = montar();
  escrever(r, LAMINA, '<p style="color:#2FB59A;font-family:Fraunces">Aurora Nutrição</p>\n');
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
});

t('termo compartilhado não reprova (e reprova sem o arquivo)', () => {
  const r = montar();
  escrever(r, LAMINA, '<p>Atendemos em Florianopolis.</p>\n');
  const sem = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(sem.status, 1, sem.saida + sem.erro);
  assert.ok(sem.saida.includes('Florianopolis'), sem.saida);
  escrever(r, 'empresas/aurora/termos-compartilhados.txt', '// cidade que as duas atendem\nFLORIANÓPOLIS\n');
  const com = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(com.status, 0, com.saida + com.erro);
});

t('pasta específica confere só ela', () => {
  const r = montar();
  escrever(r, 'empresas/aurora/saidas/reels/roteiro.md', 'Boreal Advocacia\n');
  const limpa = rodar(['--empresa', 'aurora', path.join(r, 'empresas', 'aurora', 'saidas', 'carrossel'), '--raiz', r]);
  assert.strictEqual(limpa.status, 0, limpa.saida + limpa.erro);
  const suja = rodar(['--empresa', 'aurora', path.join(r, 'empresas', 'aurora', 'saidas', 'reels'), '--raiz', r]);
  assert.strictEqual(suja.status, 1, suja.saida + suja.erro);
});

t('sem pasta: confere saídas de qualquer linha, laboratório, cronograma, pedidos e perfil', () => {
  for (const rel of ['saidas/reels/a.md', 'laboratorio/dados/b.json', 'cronograma/dados/c.json', 'pedidos/d.md', 'empresa.md']) {
    const r = montar();
    escrever(r, 'empresas/aurora/' + rel, 'Boreal Advocacia\n');
    const x = rodar(['--empresa', 'aurora', '--raiz', r]);
    assert.strictEqual(x.status, 1, rel + '\n' + x.saida + x.erro);
    assert.ok(x.saida.includes('empresas/aurora/' + rel), rel + '\n' + x.saida);
  }
});

t('memória da linha na gaveta reprova (o caso da revisão)', () => {
  const r = montar();
  escrever(r, 'empresas/aurora/memoria/reels/m.md', 'Boreal Advocacia\n');
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.ok(x.saida.includes('empresas/aurora/memoria/reels/m.md:1'), x.saida);
});

t('sem pasta: confere memória, dados, estado e investigações das linhas, decisões, estilos, prévias, histórico e intenção', () => {
  const casos = [
    'memoria/carrossel/aprendizados.md', 'memoria/geral.md', 'linhas/reels/dados/pauta.json', 'estado/reels.json',
    'investigacoes/reels/perfil.md', 'decisoes.md', 'estilo-de-video.md', 'estilos-proprios/meu/estilo.yaml',
    'previas/opcoes.html', 'historico/2026-10.md', 'estilo.json', 'intencao.json',
  ];
  for (const rel of casos) {
    const r = montar();
    // a linha "reels" existe nas saídas; a "carrossel", só na memória
    escrever(r, 'empresas/aurora/saidas/reels/roteiro.md', 'Aurora Nutrição\n');
    escrever(r, 'empresas/aurora/' + rel, 'Boreal Advocacia\n');
    const x = rodar(['--empresa', 'aurora', '--raiz', r]);
    assert.strictEqual(x.status, 1, rel + '\n' + x.saida + x.erro);
    assert.ok(x.saida.includes('empresas/aurora/' + rel), rel + '\n' + x.saida);
  }
});

t('empresa legado (principal): confere memória, dados, estado e investigações de linhas/<linha>/ e as decisões', () => {
  const casos = ['linhas/reels/memoria/m.md', 'linhas/reels/dados/d.json', 'linhas/reels/estado.json', 'linhas/reels/_investigacoes/i.md',
    '06-MARCA-E-FOTOS/estilo-de-video.md', 'empresas/principal/decisoes.md'];
  for (const rel of casos) {
    const r = pastaTemp();
    escrever(r, 'empresas/indice.json', JSON.stringify({ empresas: [
      { codigo: 'principal', nome: 'Aurora Nutrição', disposicao: 'legado' },
      { codigo: 'boreal', nome: 'Boreal Advocacia', disposicao: 'gaveta' },
    ] }));
    escrever(r, 'empresas/boreal/marca.yaml', 'empresa:\n  nome: "Boreal Advocacia"\n');
    escrever(r, 'linhas/reels/linha.yaml', 'linha: reels\n');
    escrever(r, rel, 'Boreal Advocacia\n');
    const x = rodar(['--empresa', 'principal', '--raiz', r]);
    assert.strictEqual(x.status, 1, rel + '\n' + x.saida + x.erro);
    assert.ok(x.saida.includes(rel + ':1'), rel + '\n' + x.saida);
  }
});

t('empresa legado (principal): confere linhas/<linha>/saida', () => {
  const r = pastaTemp();
  escrever(r, 'empresas/indice.json', JSON.stringify({ empresas: [
    { codigo: 'principal', nome: 'Aurora Nutrição', disposicao: 'legado' },
    { codigo: 'boreal', nome: 'Boreal Advocacia', disposicao: 'gaveta' },
  ] }));
  escrever(r, 'empresas/boreal/marca.yaml', 'empresa:\n  nome: "Boreal Advocacia"\n');
  escrever(r, 'linhas/reels/saida/roteiro.md', 'Boreal Advocacia\n');
  const x = rodar(['--empresa', 'principal', '--raiz', r]);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.ok(x.saida.includes('linhas/reels/saida/roteiro.md:1'), x.saida);
});

t('empresa recém-criada, sem marca nem perfil: o nome do índice já é termo', () => {
  const r = montar();
  fs.rmSync(path.join(r, 'empresas', 'boreal'), { recursive: true });
  escrever(r, LAMINA, '<p>Fale com a Boreal Advocacia.</p>\n');
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.ok(x.saida.includes('Boreal Advocacia (boreal)'), x.saida);
});

t('outra empresa sem nenhum termo: aviso, sem mudar a saída', () => {
  const r = pastaTemp();
  escrever(r, 'empresas/indice.json', JSON.stringify({ empresas: [
    { codigo: 'principal', nome: 'Sua empresa', disposicao: 'legado' },
    { codigo: 'aurora', nome: 'Aurora Nutrição', disposicao: 'gaveta' },
  ] }));
  escrever(r, LAMINA, '<p>Aurora Nutrição ensina a comer bem.</p>\n');
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.ok((x.saida + x.erro).includes('AVISO: a empresa Sua empresa (principal) não tem nenhum termo'), x.saida + x.erro);
  const sem = rodar(['--empresa', 'aurora', '--raiz', montar()]);
  assert.ok(!(sem.saida + sem.erro).includes('AVISO'), sem.saida + sem.erro);
});

t('uma empresa só: nada a cruzar', () => {
  const r = montar({ soAurora: true });
  escrever(r, LAMINA, '<p>Boreal Advocacia</p>\n');
  const x = rodar(['--empresa', 'aurora', '--raiz', r]);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  assert.ok((x.saida + x.erro).includes('Só há uma empresa: nada a cruzar.'), x.saida + x.erro);
});

t('empresa desconhecida: sai 2', () => {
  const r = montar();
  const x = rodar(['--empresa', 'xyz', '--raiz', r]);
  assert.strictEqual(x.status, 2, x.saida + x.erro);
  assert.ok(x.erro.includes('xyz'), x.erro);
});

t('erro de uso: --empresa sem código, --raiz sem --empresa, --termos com --empresa', () => {
  const r = montar();
  const casos = [
    [['--empresa'], '--empresa precisa do código'],
    [['--raiz', r], '--raiz só vale com --empresa'],
    [['--empresa', 'aurora', '--raiz', r, '--termos', path.join(r, 'lista.txt')], '--termos não vale com --empresa'],
  ];
  for (const [args, mensagem] of casos) {
    const x = rodar(args);
    assert.strictEqual(x.status, 2, args.join(' ') + '\n' + x.saida + x.erro);
    assert.ok(x.erro.includes(mensagem), x.erro);
  }
});

t('modo de sempre intacto: sem --empresa, a cor ainda reprova', () => {
  const pasta = pastaTemp();
  escrever(pasta, 'a.css', 'a { color: #123456; }\n');
  const x = rodar([pasta]);
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.ok(x.saida.includes('[hex]'), x.saida);
});

t('pasta .superpowers é ignorada', () => {
  const pasta = pastaTemp();
  escrever(pasta, '.superpowers/rascunho.css', 'a { color: #123456; }\n');
  const x = rodar([pasta]);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
});

t('módulo exporta as funções e não roda o main ao ser carregado', () => {
  const v = require('./validar');
  assert.strictEqual(typeof v.verificarArquivo, 'function');
  assert.strictEqual(typeof v.listarArquivos, 'function');
  assert.strictEqual(v.compilarTermo('// comentário'), null);
  assert.strictEqual(v.compilarTermo('   '), null);
  assert.strictEqual(v.compilarTermo('cs:'), null);
  const sensivel = v.compilarTermo('cs: Zeca');
  assert.strictEqual(sensivel.texto, 'Zeca');
  assert.strictEqual(sensivel.regex.test('Zeca'), true);
  sensivel.regex.lastIndex = 0;
  assert.strictEqual(sensivel.regex.test('zeca'), false);
  const pasta = pastaTemp();
  escrever(pasta, 'a.css', 'a { color: #123456; } Boreal\n');
  const arq = path.join(pasta, 'a.css');
  const comTudo = v.verificarArquivo(arq, pasta, [v.compilarTermo('boreal')], {});
  assert.deepStrictEqual(comTudo.map((a) => a.categoria).sort(), ['hex', 'termo-privado']);
  const soTermos = v.verificarArquivo(arq, pasta, [v.compilarTermo('boreal')], { 'a.css': ['*'] }, { soTermos: true });
  assert.deepStrictEqual(soTermos.map((a) => a.categoria), ['termo-privado']);
});

console.log(`\n${n} casos, todos ok.`);
