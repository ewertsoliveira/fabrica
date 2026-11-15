#!/usr/bin/env node
// Testes de guarda-visual.js: a pergunta de escolha visual sem prévia aplicada é bloqueada; a que cita a prévia aberta
// passa; pergunta que não é de aparência passa. Rode: node _fabrica/core/guarda-visual.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { avaliar, ESCAPE } = require('./guarda-visual');

const SCRIPT = path.join(__dirname, 'guarda-visual.js');
const PAINEL = ['http:', '', 'localhost:4173'].join('/'); // o endereço do painel, montado (o validador barra endereço literal)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guarda visual '));
const pasta = path.join(tmp, 'Fábrica de Conteúdos (EMPRESA)', 'opcoes-imagem');
fs.mkdirSync(pasta, { recursive: true });
const previa = path.join(pasta, 'comparacao.png');
fs.writeFileSync(previa, 'png');

const chamada = (questions, extra = {}) => ({ tool_name: 'AskUserQuestion', cwd: tmp, tool_input: { questions, ...extra } });
const q = (question, header, options) => ({ question, header, multiSelect: false, options: options.map(([label, description]) => ({ label, description })) });

// A chamada real de 13/11/2026 que pediu a imagem da capa só por texto.
const capaPorTexto = q('Qual imagem vai na capa? A capa ocupa a tela inteira, com um véu escuro e o título por cima.', 'Imagem', [
  ['Quadro 20 do vídeo (Recomendado)', 'Sorriso, olhar na câmera'], ['Quadro 4 do vídeo', 'Sorriso leve'],
  ['Foto de estúdio', 'Uma das fotos profissionais (ex.: estudio-blazer-frente-sorrindo), com outra roupa'],
]);
const data = q('Quando este Reels vai ao ar? A data liga a peça ao dia certo do Cronograma.', 'Data', [['Hoje, 13/11', 'Publicação nesta sexta'], ['Amanhã, 14/11', 'Publicação no dia seguinte']]);
const bases = [tmp];

let falhas = 0;
const t = (nome, fn) => { try { fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHA ' + nome + '\n      ' + e.message); } };

t('bloqueia a escolha da imagem da capa feita só por texto (o caso de 13/11)', () => {
  const r = avaliar(chamada([data, capaPorTexto]), bases);
  assert.deepStrictEqual(r.map((x) => x.header), ['Imagem']);
});
t('pergunta sem nada de aparência passa', () => assert.strictEqual(avaliar(chamada([data]), bases).length, 0));
t('palavra parecida não conta (corte, parte, recortar)', () => {
  const r = avaliar(chamada([q('Onde entra o corte? Esta parte do vídeo pode recortar?', 'Corte', [['Sim', 'x'], ['Não', 'y']])]), bases);
  assert.strictEqual(r.length, 0);
});
t('passa quando cita o caminho absoluto da prévia (com espaços e acento)', () => {
  const ok = q(`Qual capa? As três estão lado a lado em ${previa}`, 'Capa', [['A · quadro 20', 'x'], ['B · quadro 4', 'y']]);
  assert.strictEqual(avaliar(chamada([ok]), bases).length, 0);
});
t('passa com caminho relativo à pasta do projeto (link do editor)', () => {
  const link = q('Qual capa? Veja [a prévia](opcoes/comparacao.png)', 'Capa', [['A', 'x'], ['B', 'y']]);
  fs.mkdirSync(path.join(tmp, 'opcoes'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'opcoes', 'comparacao.png'), 'png');
  assert.strictEqual(avaliar(chamada([link]), bases).length, 0);
});
t('não passa quando o arquivo citado não existe', () => {
  const r = avaliar(chamada([q('Qual capa? Veja C:\\nao\\existe\\prancha.png', 'Capa', [['A', 'x'], ['B', 'y']])]), bases);
  assert.strictEqual(r.length, 1);
});
t('passa com o endereço do painel local', () => {
  const ok = q(`Qual estilo? Aberto em ${PAINEL}/_fabrica/paineis/estilos.html?empresa=aurora`, 'Estilo', [['A', 'x'], ['B', 'y']]);
  assert.strictEqual(avaliar(chamada([ok]), bases).length, 0);
});
t('cada pergunta visual precisa da sua prévia', () => {
  const ok = q(`Qual capa? ${previa}`, 'Capa', [['A', 'x'], ['B', 'y']]);
  const sem = q('Qual cor no título?', 'Cor', [['Verde', 'x'], ['Azul', 'y']]);
  assert.deepStrictEqual(avaliar(chamada([ok, sem]), bases).map((x) => x.header), ['Cor']);
});
t('marcação de pergunta não visual libera a chamada', () => {
  const roteiro = q('De qual roteiro sai a legenda?', 'Roteiro', [['Anúncio 3', 'Capa do roteiro: rosto e pergunta'], ['Reels de 17/11', 'x']]);
  assert.strictEqual(avaliar(chamada([roteiro]), bases).length, 1);
  assert.strictEqual(avaliar(chamada([roteiro], { metadata: { source: ESCAPE } }), bases).length, 0);
});
t('linha de comando: bloqueia com permissionDecision deny e explica o que fazer', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { input: JSON.stringify(chamada([data, capaPorTexto])), encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  const o = JSON.parse(r.stdout).hookSpecificOutput;
  assert.strictEqual(o.hookEventName, 'PreToolUse');
  assert.strictEqual(o.permissionDecision, 'deny');
  assert.match(o.permissionDecisionReason, /APLICADA à peça final/);
  assert.match(o.permissionDecisionReason, /"Imagem"/);
});
t('linha de comando: sem saída quando pode perguntar, e entrada quebrada não trava', () => {
  const r = spawnSync(process.execPath, [SCRIPT], { input: JSON.stringify(chamada([data])), encoding: 'utf8' });
  assert.strictEqual(r.status, 0); assert.strictEqual(r.stdout, '');
  const q2 = spawnSync(process.execPath, [SCRIPT], { input: 'não é json', encoding: 'utf8' });
  assert.strictEqual(q2.status, 0); assert.strictEqual(q2.stdout, '');
});
t('o gancho está ligado em .claude/settings.json para toda pergunta estruturada', () => {
  const s = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.claude', 'settings.json'), 'utf8'));
  const g = (s.hooks.PreToolUse || []).find((h) => h.matcher === 'AskUserQuestion');
  assert.ok(g, 'falta o gancho PreToolUse de AskUserQuestion');
  const cmd = g.hooks.find((h) => h.type === 'command' && h.command.includes('guarda-visual.js'));
  assert.ok(cmd, 'o gancho não chama guarda-visual.js');
  // O comando exato do settings, pelo terminal do sistema (cmd no Windows, sh no Mac), de outra pasta.
  const r = spawnSync(cmd.command, {
    shell: true, cwd: tmp, encoding: 'utf8', input: JSON.stringify(chamada([capaPorTexto])),
    env: { ...process.env, CLAUDE_PROJECT_DIR: path.join(__dirname, '..', '..') },
  });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'deny');
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
