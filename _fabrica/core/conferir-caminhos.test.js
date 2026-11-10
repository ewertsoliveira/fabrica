#!/usr/bin/env node
// Testes da conferência de caminhos de empresa escritos à mão. Rode: node _fabrica/core/conferir-caminhos.test.js
// Os casos montam raízes temporárias; o último confere a matriz real.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { conferir } = require('./conferir-caminhos');
const SCRIPT = path.join(__dirname, 'conferir-caminhos.js');
const RAIZ_REAL = path.resolve(__dirname, '..', '..');

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

const pastaTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'conferir-'));
function escrever(r, rel, texto) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto, 'utf8');
}
function cli(args) {
  const x = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}

t('linha comum com marca.yaml: 1 achado, com arquivo, linha e caminho', () => {
  const r = pastaTemp();
  escrever(r, '.claude/skills/fabrica/SKILL.md', '# Skill\n\nLeia 06-MARCA-E-FOTOS/marca.yaml antes de começar.\n');
  assert.deepStrictEqual(conferir(r), [
    { arquivo: '.claude/skills/fabrica/SKILL.md', linha: 3, caminho: '06-MARCA-E-FOTOS/marca.yaml' },
  ]);
});

t('linha que cita "pasta antiga" ou "legado": 0 achados', () => {
  const r = pastaTemp();
  escrever(r, '.claude/skills/fabrica/SKILL.md',
    '# Skill\n\nNa pasta antiga, `06-MARCA-E-FOTOS/marca.yaml`.\nNo Legado: `linhas/reels/saida/`.\n');
  assert.deepStrictEqual(conferir(r), []);
});

t('linhas/x/passos/a.md com linhas/x/saida/: 1 achado', () => {
  const r = pastaTemp();
  escrever(r, 'linhas/x/passos/a.md', 'Grave em linhas/x/saida/ o resultado.\n');
  const a = conferir(r);
  assert.strictEqual(a.length, 1);
  assert.strictEqual(a[0].arquivo, 'linhas/x/passos/a.md');
  assert.strictEqual(a[0].linha, 1);
  assert.strictEqual(a[0].caminho, 'linhas/x/saida');
});

t('todos os padrões são achados', () => {
  const r = pastaTemp();
  const caminhos = [
    '06-MARCA-E-FOTOS/marca.yaml', '06-MARCA-E-FOTOS/estilo-de-video.md', '06-MARCA-E-FOTOS/estilos-proprios/',
    '_fabrica/_memoria/empresa.md', 'linhas/<linha>/saida', 'linhas/reels/memoria', 'linhas/reels/estado.json',
    'linhas/reels/_investigacoes', '03-CRONOGRAMA/dados', '04-LABORATORIO-DE-DESIGN/dados', '04-LABORATORIO-DE-DESIGN/referencias',
  ];
  escrever(r, '_fabrica/core/prompts/p.md', caminhos.map((c) => `Veja ${c} agora.`).join('\n') + '\n');
  assert.deepStrictEqual(conferir(r).map((a) => a.caminho), caminhos.map((c) => c.replace(/\/$/, '')));
});

t('arquivos do modelo (.exemplo) não casam', () => {
  const r = pastaTemp();
  escrever(r, '08-FERRAMENTAS/marca/LEIA-ME.md',
    'Copie 06-MARCA-E-FOTOS/marca.exemplo.yaml e 06-MARCA-E-FOTOS/estilo-de-video.exemplo.md; veja 06-MARCA-E-FOTOS/exemplo/a.png.\n');
  assert.deepStrictEqual(conferir(r), []);
});

t('CORE.md: permitido só dentro da subseção "Empresas"', () => {
  const r = pastaTemp();
  escrever(r, 'CORE.md',
    '# CORE\n\n## 3. Estrutura\n\nUsa 06-MARCA-E-FOTOS/marca.yaml aqui.\n\n### Empresas\n\nA marca é 06-MARCA-E-FOTOS/marca.yaml.\n\n#### Detalhe\n\nTambém linhas/reels/saida.\n\n### Outra\n\nVolta _fabrica/_memoria/empresa.md.\n');
  assert.deepStrictEqual(conferir(r).map((a) => a.linha), [5, 17]);
});

t('só varre .md e .yaml das pastas indicadas e ignora node_modules/docs', () => {
  const r = pastaTemp();
  escrever(r, '_fabrica/core/x.js', '// 06-MARCA-E-FOTOS/marca.yaml\n');
  escrever(r, '_fabrica/core/x.yaml', 'a: 06-MARCA-E-FOTOS/marca.yaml\n');
  escrever(r, 'docs/x.md', '06-MARCA-E-FOTOS/marca.yaml\n');
  escrever(r, '08-FERRAMENTAS/node_modules/p/LEIA.md', '06-MARCA-E-FOTOS/marca.yaml\n');
  escrever(r, 'README.md', '06-MARCA-E-FOTOS/marca.yaml\n');
  assert.deepStrictEqual(conferir(r).map((a) => a.arquivo), ['_fabrica/core/x.yaml']);
});

t('em linhas/<l>/ só as instruções são varridas; saída, memória, investigações e construção são dados', () => {
  const r = pastaTemp();
  const texto = 'Veja 06-MARCA-E-FOTOS/marca.yaml aqui.\n';
  for (const rel of ['saida/r.md', 'memoria/m.md', '_investigacoes/i.md', '_construcao/c.md', 'saida/2026-01-01/p.yaml', 'estado.md']) {
    escrever(r, 'linhas/x/' + rel, texto);
  }
  assert.deepStrictEqual(conferir(r), []);
  for (const rel of ['passos/a.md', 'estacoes/e.md', 'dados/d.md', 'LEIA-ME.md', 'linha.yaml']) escrever(r, 'linhas/x/' + rel, texto);
  assert.deepStrictEqual(conferir(r).map((a) => a.arquivo).sort(),
    ['linhas/x/LEIA-ME.md', 'linhas/x/dados/d.md', 'linhas/x/estacoes/e.md', 'linhas/x/linha.yaml', 'linhas/x/passos/a.md']);
});

t('barra invertida entre as partes do caminho também é achada', () => {
  const r = pastaTemp();
  escrever(r, '_fabrica/core/p.md', 'a 06-MARCA-E-FOTOS\\marca.yaml\nb linhas\\x\\saida\nc _fabrica\\_memoria\\empresa.md\nd 06-MARCA-E-FOTOS\\marca.exemplo.yaml\n');
  assert.deepStrictEqual(conferir(r).map((a) => a.linha), [1, 2, 3]);
});

t('parecidos que não são caminho de empresa não casam', () => {
  const r = pastaTemp();
  escrever(r, '_fabrica/core/p.md',
    'a linhas/x/saidas/r.md\nb _fabrica/_memoria/preferencias.md\nc 03-CRONOGRAMA/dados-x/a.md\nd linhas/x/memorias\n');
  assert.deepStrictEqual(conferir(r), []);
});

t('docs e _backup só são ignorados no topo (e em _fabrica/_backup); mais fundo são varridos', () => {
  const r = pastaTemp();
  const texto = 'Veja 06-MARCA-E-FOTOS/marca.yaml aqui.\n';
  escrever(r, '08-FERRAMENTAS/x/docs/a.md', texto);
  escrever(r, '_fabrica/core/_backup/b.md', texto);
  escrever(r, 'linhas/x/passos/docs/c.md', texto);
  escrever(r, '.claude/skills/s/_backup/d.md', texto);
  assert.deepStrictEqual(conferir(r).map((a) => a.arquivo).sort(),
    ['.claude/skills/s/_backup/d.md', '08-FERRAMENTAS/x/docs/a.md', '_fabrica/core/_backup/b.md', 'linhas/x/passos/docs/c.md']);
  // Os do topo continuam fora.
  const r2 = pastaTemp();
  escrever(r2, 'docs/a.md', texto);
  escrever(r2, '_backup/b.md', texto);
  escrever(r2, '_fabrica/_backup/core/c.md', texto);
  assert.deepStrictEqual(conferir(r2), []);
});

t('CRLF não atrapalha a numeração', () => {
  const r = pastaTemp();
  escrever(r, 'linhas/x/LEIA-ME.md', 'a\r\nb\r\nlinhas/x/estado.json\r\n');
  assert.strictEqual(conferir(r)[0].linha, 3);
});

t('linha de comando: 1 com achado, 0 limpo, 2 em uso errado', () => {
  const r = pastaTemp();
  escrever(r, 'linhas/x/LEIA-ME.md', 'veja linhas/x/saida\n');
  const sujo = cli(['--raiz', r]);
  assert.strictEqual(sujo.status, 1);
  assert.ok(sujo.saida.includes('linhas/x/LEIA-ME.md:1'), sujo.saida);
  assert.ok(sujo.saida.includes('linhas/x/saida'), sujo.saida);
  assert.strictEqual(cli(['--raiz', pastaTemp()]).status, 0);
  assert.strictEqual(cli(['--bobagem']).status, 2);
  assert.strictEqual(cli(['--raiz', path.join(r, 'nao-existe')]).status, 2);
});

t('a matriz real está limpa', () => {
  assert.deepStrictEqual(conferir(RAIZ_REAL), []);
});

console.log(`\n${n} casos ok`);
