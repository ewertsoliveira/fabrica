#!/usr/bin/env node
// Testes do tema da marca dos modelos de Reels. Rode: node 08-FERRAMENTAS/tesseract/modelos/tema-marca.test.js
// Não precisa do Tesseract: o leitor de marca entra por injeção (marcaMod) ou num processo separado (FABRICA_MARCA).
// As marcas são de mentira: "aurora" (quente) e "boreal" (fria); as letras são as OFL de modelos/fontes/.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const temaMarca = require('./tema-marca');

let n = 0;
let falhas = 0;
const t = (nome, fn) => {
  try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + e.message.split('\n')[0]); }
};
const FONTES = path.join(__dirname, 'fontes');
const F = (a) => path.join(FONTES, a);

const AURORA = { cores: { escuro: '#3A1F14', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' },
  fontes: { principal: 'Poppins-Bold.ttf', mono: 'JetBrainsMono-Bold.ttf' } };
const BOREAL = { cores: { escuro: '#0E2235', claro: '#E6F1F5', acento: '#3FA7C9', neutro: '#7D96A8' },
  fontes: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'SpaceMono-Bold.ttf', acento: 'Fraunces-SemiBoldItalic.ttf' } };

// leitor de marca falso: o mesmo formato do marca.js (hex por papel, pega por rota, caminho)
const marcaFalsa = (cores, tipografia) => ({
  hex: (p) => cores[p],
  pega: (rota, padrao) => rota.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), { tipografia }) ?? padrao,
  caminho: (r) => (r ? (path.isAbsolute(r) ? r : F(r)) : null),
});
const erroPt = (fn, re) => assert.throws(fn, (e) => re.test(e.message), 'esperava erro em português ' + re);

t('sem marca nem usarMarca devolve null', () => {
  assert.strictEqual(temaMarca.resolver({}), null);
  assert.strictEqual(temaMarca.resolver({ usarMarca: false }), null);
  assert.strictEqual(temaMarca.resolver({ marca: {} }), null);
});

t('resolve as cores e as letras do pedido (caminho absoluto)', () => {
  const tm = temaMarca.resolver({ marca: AURORA });
  assert.strictEqual(tm.origem, 'pedido');
  assert.deepStrictEqual(tm.cores, { escuro: '#3A1F14', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' });
  assert.strictEqual(tm.fontes.principal, F('Poppins-Bold.ttf'));
  assert.strictEqual(tm.fontes.mono, F('JetBrainsMono-Bold.ttf'));
  assert.strictEqual(tm.fontes.acento, null);
  assert.ok(path.isAbsolute(tm.fontes.principal));
});

t('o que falta fica vazio e o modelo completa com o papel original dele', () => {
  const tm = temaMarca.resolver({ marca: { cores: { acento: '#F2994A' } } });
  assert.strictEqual(tm.cores.acento, '#F2994A');
  assert.strictEqual(tm.cores.escuro, null);
  assert.strictEqual(tm.fontes.principal, null);
  assert.strictEqual(temaMarca.cor(tm, 'escuro', '#16213A'), '#16213A');
  assert.strictEqual(temaMarca.cor(tm, 'acento', '#FF6B35'), '#F2994A');
  assert.strictEqual(temaMarca.fonte(tm, 'principal', 'InterTight-Black.ttf'), 'InterTight-Black.ttf');
  assert.strictEqual(temaMarca.cor(null, 'acento', '#FF6B35'), '#FF6B35');
  assert.strictEqual(temaMarca.fonte(null, 'mono', 'DMMono-Medium.ttf'), 'DMMono-Medium.ttf');
});

t('o antigo marca.acento continua valendo como cores.acento', () => {
  const tm = temaMarca.resolver({ marca: { acento: '#3fa7c9' } });
  assert.strictEqual(tm.cores.acento, '#3FA7C9');
  assert.strictEqual(tm.fontes.principal, null);
});

t('letra relativa vale ao lado do pedido e depois em modelos/fontes', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tema-marca-'));
  fs.copyFileSync(F('SpaceMono-Bold.ttf'), path.join(dir, 'minha-mono.ttf'));
  const tm = temaMarca.resolver({ marca: { fontes: { mono: 'minha-mono.ttf', principal: 'DMSerifDisplay-Regular.ttf' } } }, { base: dir });
  assert.strictEqual(tm.fontes.mono, path.join(dir, 'minha-mono.ttf'));
  assert.strictEqual(tm.fontes.principal, F('DMSerifDisplay-Regular.ttf'));
  fs.rmSync(path.join(dir, 'minha-mono.ttf')); fs.rmdirSync(dir);
});

t('usarMarca lê a marca pelo leitor (injetado), com as três letras', () => {
  const m = marcaFalsa(BOREAL.cores, { principal: { arquivo: BOREAL.fontes.principal }, mono: { arquivo: BOREAL.fontes.mono }, acento: { arquivo: BOREAL.fontes.acento } });
  const tm = temaMarca.resolver({ usarMarca: true }, { marcaMod: m });
  assert.strictEqual(tm.origem, 'marca');
  assert.deepStrictEqual(tm.cores, BOREAL.cores);
  assert.strictEqual(tm.fontes.principal, F('DMSerifDisplay-Regular.ttf'));
  assert.strictEqual(tm.fontes.acento, F('Fraunces-SemiBoldItalic.ttf'));
});

t('usarMarca com tipografia.acento vazia deixa a letra de acento de fora', () => {
  const m = marcaFalsa(AURORA.cores, { principal: { arquivo: AURORA.fontes.principal }, mono: { arquivo: AURORA.fontes.mono }, acento: { arquivo: '' } });
  const tm = temaMarca.resolver({ usarMarca: true }, { marcaMod: m });
  assert.strictEqual(tm.fontes.acento, null);
});

t('o pedido com marca vence o usarMarca e não lê o marca.yaml', () => {
  const m = { hex: () => { throw new Error('não devia ler a marca'); }, pega: () => { throw new Error('não devia ler a marca'); }, caminho: (r) => r };
  const tm = temaMarca.resolver({ usarMarca: true, marca: { cores: { acento: '#F2994A' } } }, { marcaMod: m });
  assert.strictEqual(tm.origem, 'pedido');
});

t('usarMarca lê um marca.yaml temporário fictício pelo marca.js de verdade', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tema-marca-yaml-'));
  const arq = path.join(dir, 'marca.yaml');
  const barra = (p) => p.replace(/\\/g, '/');
  fs.writeFileSync(arq, ['empresa:', '  nome: "Aurora"', 'cores:',
    ...Object.entries(AURORA.cores).map(([k, v]) => `  ${k}: "${v}"`), 'tipografia:',
    '  principal:', `    arquivo: ${barra(F(AURORA.fontes.principal))}`, '  mono:', `    arquivo: ${barra(F(AURORA.fontes.mono))}`, ''].join('\n'));
  const r = spawnSync(process.execPath, ['-e', `const tm=require(${JSON.stringify(path.join(__dirname, 'tema-marca.js'))}).resolver({usarMarca:true});process.stdout.write(JSON.stringify(tm))`],
    { env: { ...process.env, FABRICA_MARCA: arq, FABRICA_SILENCIO_EXEMPLO: '1' }, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  const tm = JSON.parse(r.stdout);
  assert.strictEqual(tm.origem, 'marca');
  assert.strictEqual(tm.cores.acento, '#F2994A');
  assert.strictEqual(path.normalize(tm.fontes.principal), F('Poppins-Bold.ttf'));
  fs.rmSync(arq); fs.rmdirSync(dir);
});

t('usarMarca sem marca.yaml da empresa cai na marca de exemplo e avisa, sem quebrar', () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'tema-marca-raiz-'));
  const env = { ...process.env, FABRICA_RAIZ: raiz };
  delete env.FABRICA_MARCA; delete env.FABRICA_EMPRESA; delete env.FABRICA_SILENCIO_EXEMPLO;
  const r = spawnSync(process.execPath, ['-e', `const tm=require(${JSON.stringify(path.join(__dirname, 'tema-marca.js'))}).resolver({usarMarca:true});process.stdout.write(JSON.stringify(tm))`],
    { env, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.match(r.stderr, /EXEMPLO/);
  const tm = JSON.parse(r.stdout);
  assert.strictEqual(tm.origem, 'marca');
  assert.ok(fs.existsSync(tm.fontes.principal));
  fs.rmdirSync(raiz);
});

t('hex inválido dá erro em português citando o papel', () => {
  erroPt(() => temaMarca.resolver({ marca: { cores: { claro: 'creme' } } }), /cores\.claro.*inválid/);
  erroPt(() => temaMarca.resolver({ marca: { cores: { escuro: '#12345' } } }), /cores\.escuro.*inválid/);
  erroPt(() => temaMarca.resolver({ marca: { acento: 'cor-errada' } }), /acento.*inválid/);
  const m = marcaFalsa({ ...AURORA.cores, neutro: 'cinza' }, { principal: { arquivo: AURORA.fontes.principal }, mono: { arquivo: AURORA.fontes.mono } });
  erroPt(() => temaMarca.resolver({ usarMarca: true }, { marcaMod: m }), /cores\.neutro.*inválid/);
});

t('arquivo de letra inexistente dá erro em português citando o papel', () => {
  erroPt(() => temaMarca.resolver({ marca: { fontes: { principal: 'NaoExiste-Bold.ttf' } } }), /fontes\.principal.*não encontrad/);
  erroPt(() => temaMarca.resolver({ marca: { fontes: { mono: F('Inter-OFL.txt') } } }), /fontes\.mono.*\.ttf/);
});

// silencia (e guarda) os avisos do log durante um trecho
function comAvisos(fn) {
  const avisos = [], orig = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try { return { r: fn(), avisos }; } finally { console.warn = orig; }
}

t('usarMarca tolerante: letra ausente, inválida ou fora da pasta da empresa vira UM aviso, o papel fica null e as cores valem', () => {
  const fora = Object.assign(new Error('O caminho "../x.ttf" sai da pasta da empresa (empresas/aurora).'), { code: 'CAMINHO_FORA_DA_EMPRESA' });
  const m = {
    ...marcaFalsa(AURORA.cores, { principal: { arquivo: 'sumiu.ttf' }, mono: { arquivo: 'letra.woff2' }, acento: { arquivo: '../x.ttf' } }),
    caminho: (r) => { if (r.startsWith('..')) throw fora; return F(r); },
  };
  const { r: tm, avisos } = comAvisos(() => temaMarca.resolver({ usarMarca: true }, { marcaMod: m }));
  assert.deepStrictEqual(tm.fontes, { principal: null, mono: null, acento: null });
  assert.strictEqual(tm.cores.acento, '#F2994A');
  assert.strictEqual(avisos.length, 1, avisos.join('\n'));
  assert.match(avisos[0], /^marca: /);
  assert.match(avisos[0], /principal.*não encontrad/);
  assert.match(avisos[0], /mono.*\.ttf/);
  assert.match(avisos[0], /acento.*sai da pasta da empresa/);
  // letra ausente no marca.yaml também só avisa
  const sem = marcaFalsa(AURORA.cores, {});
  const r2 = comAvisos(() => temaMarca.resolver({ usarMarca: true }, { marcaMod: sem }));
  assert.strictEqual(r2.r.fontes.principal, null);
  assert.strictEqual(r2.avisos.length, 1);
});

t('erro do leitor de marca no usarMarca sai com "marca: " (nunca a pilha crua)', () => {
  const m = { hex: () => { throw new Error('Há mais de uma empresa nesta Fábrica e nenhuma está escolhida'); }, pega: () => '', caminho: (r) => r };
  erroPt(() => temaMarca.resolver({ usarMarca: true }, { marcaMod: m }), /^marca: Há mais de uma empresa/);
});

t('usarMarca vale para qualquer valor verdadeiro, como antes', () => {
  const m = marcaFalsa(BOREAL.cores, { principal: { arquivo: BOREAL.fontes.principal }, mono: { arquivo: BOREAL.fontes.mono } });
  assert.strictEqual(temaMarca.resolver({ usarMarca: 'true' }, { marcaMod: m }).origem, 'marca');
  assert.strictEqual(temaMarca.resolver({ usarMarca: 1 }, { marcaMod: m }).origem, 'marca');
  assert.strictEqual(temaMarca.resolver({ usarMarca: 0 }, { marcaMod: m }), null);
});

t('aviso de itálico na principal é ignorado (com aviso) quando o arquivo não tem face itálica', () => {
  const tm = temaMarca.resolver({ marca: { fontes: { principal: 'Poppins-Bold.ttf', principalItalico: true } } });
  const { r, avisos } = comAvisos(() => temaMarca.temItalico(tm, { style: 'Bold', estilos: ['Bold'], italico: false }));
  assert.strictEqual(r, false);
  assert.ok(avisos.some((a) => /^marca: .*itálic/.test(a)), avisos.join('\n'));
  // sem saber da face (letra não importada), vale o aviso do pedido
  assert.strictEqual(temaMarca.temItalico(tm, null), true);
});

t('papel desconhecido dá erro em português', () => {
  erroPt(() => temaMarca.resolver({ marca: { cores: { primaria: '#F2994A' } } }), /papel.*desconhecido.*primaria/);
  erroPt(() => temaMarca.resolver({ marca: { fontes: { titulo: 'Poppins-Bold.ttf' } } }), /papel.*desconhecido.*titulo/);
  erroPt(() => temaMarca.cor(null, 'roxo', '#000000'), /papel.*desconhecido.*roxo/);
  erroPt(() => temaMarca.fonte(null, 'legenda', 'x.ttf'), /papel.*desconhecido.*legenda/);
});

t('contrasteOk com pares conhecidos (WCAG)', () => {
  assert.ok(Math.abs(temaMarca.contraste('#000000', '#FFFFFF') - 21) < 0.01);
  assert.ok(Math.abs(temaMarca.contraste('#777777', '#FFFFFF') - 4.48) < 0.01);
  assert.strictEqual(temaMarca.contraste('#3FA7C9', '#3FA7C9'), 1);
  assert.strictEqual(temaMarca.contrasteOk('#000000', '#FFFFFF'), true);
  assert.strictEqual(temaMarca.contrasteOk('#777777', '#FFFFFF'), true); // 4,48 >= 3
  assert.strictEqual(temaMarca.contrasteOk('#777777', '#FFFFFF', 4.5), false);
  assert.strictEqual(temaMarca.contrasteOk('#E6F1F5', '#D8E4EA'), false); // claro e "escuro" quase iguais
  assert.strictEqual(temaMarca.contrasteOk([0, 0, 0, 1], [1, 1, 1, 1]), true); // aceita a cor do Tesseract
});

t('duas chamadas seguidas com marcas diferentes não vazam uma na outra', () => {
  const a = temaMarca.resolver({ marca: AURORA });
  const b = temaMarca.resolver({ marca: BOREAL });
  const c = temaMarca.resolver({ marca: { cores: { acento: '#F2994A' } } });
  const d = temaMarca.resolver({});
  assert.strictEqual(a.cores.escuro, '#3A1F14');
  assert.strictEqual(b.cores.escuro, '#0E2235');
  assert.strictEqual(b.fontes.acento, F('Fraunces-SemiBoldItalic.ttf'));
  assert.strictEqual(c.cores.escuro, null);
  assert.strictEqual(c.fontes.principal, null);
  assert.strictEqual(d, null);
  // o tema devolvido é um objeto novo: mexer nele não muda o próximo
  a.cores.acento = '#000000';
  assert.strictEqual(temaMarca.resolver({ marca: AURORA }).cores.acento, '#F2994A');
  // dois leitores de marca diferentes em seguida
  const ma = marcaFalsa(AURORA.cores, { principal: { arquivo: AURORA.fontes.principal }, mono: { arquivo: AURORA.fontes.mono } });
  const mb = marcaFalsa(BOREAL.cores, { principal: { arquivo: BOREAL.fontes.principal }, mono: { arquivo: BOREAL.fontes.mono } });
  assert.strictEqual(temaMarca.resolver({ usarMarca: true }, { marcaMod: ma }).cores.acento, '#F2994A');
  assert.strictEqual(temaMarca.resolver({ usarMarca: true }, { marcaMod: mb }).cores.acento, '#3FA7C9');
  assert.strictEqual(temaMarca.resolver({ usarMarca: true }, { marcaMod: mb }).fontes.acento, null);
});

t('peso pedido vira o estilo mais próximo que a letra tem', () => {
  assert.strictEqual(temaMarca.pesoDoArquivo('InterTight-Black.ttf'), 900);
  assert.strictEqual(temaMarca.pesoDoArquivo('PlayfairDisplay-MediumItalic.ttf'), 500);
  assert.strictEqual(temaMarca.pesoDoArquivo('InterTight-ExtraBold.ttf'), 800);
  assert.strictEqual(temaMarca.pesoDoArquivo('Oswald.ttf'), 400);
  // letra de um peso só: o próprio
  assert.strictEqual(temaMarca.estiloMaisProximo(900, { style: 'Bold', estilos: ['Bold'] }), 'Bold');
  assert.strictEqual(temaMarca.estiloMaisProximo(900, { style: 'Regular' }), 'Regular');
  // letra variável: o mais próximo, sem itálico quando não é pedido
  const inter = { style: 'Regular', estilos: ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black', 'Italic', 'Bold Italic'] };
  assert.strictEqual(temaMarca.estiloMaisProximo(900, inter), 'Black');
  assert.strictEqual(temaMarca.estiloMaisProximo(650, inter), 'Bold');
  assert.strictEqual(temaMarca.estiloMaisProximo(700, inter, { italico: true }), 'Bold Italic');
  assert.strictEqual(temaMarca.estiloMaisProximo('ExtraBold', inter), 'ExtraBold');
  // o arquivo de destaque é só itálico: vale o itálico que ele tem
  assert.strictEqual(temaMarca.estiloMaisProximo(400, { style: 'Italic', estilos: ['Italic'] }, { italico: true }), 'Italic');
});

t('letra da marca para uma entrada do modelo (P.fonte injetado)', () => {
  const chamadas = [];
  const P = { fonte: (a) => { chamadas.push(a); return { family: path.basename(a, '.ttf'), style: 'Bold', estilos: ['Bold'], arquivo: a }; } };
  const tm = temaMarca.resolver({ marca: AURORA });
  const e = { arquivo: 'InterTight-Black.ttf', size: 118, tracking: -20, wdth: 90 };
  const r = temaMarca.letra(P, tm, 'principal', e);
  assert.deepStrictEqual(chamadas, [F('Poppins-Bold.ttf')]);
  assert.strictEqual(r.est.arquivo, F('Poppins-Bold.ttf'));
  assert.strictEqual(r.est.style, 'Bold');
  assert.strictEqual(r.est.size, 118);
  assert.strictEqual(r.est.tracking, -20);
  assert.strictEqual(r.est.wdth, undefined); // o eixo de largura é da letra do modelo, não da marca
  assert.strictEqual(temaMarca.letra(P, tm, 'acento', e), null); // a marca não tem letra de acento
  assert.strictEqual(temaMarca.letra(P, null, 'principal', e), null);
});

t('itálico da letra principal: pelo nome do arquivo, pela face ou pelo aviso do pedido', () => {
  assert.strictEqual(temaMarca.temItalico(temaMarca.resolver({ marca: AURORA }), { style: 'Bold' }), false);
  assert.strictEqual(temaMarca.temItalico(temaMarca.resolver({ marca: { fontes: { principal: 'Fraunces-SemiBoldItalic.ttf' } } }), { style: 'Italic' }), true);
  assert.strictEqual(temaMarca.temItalico(temaMarca.resolver({ marca: { fontes: { principal: 'Inter.ttf', principalItalico: true } } }), { style: 'Regular' }), true);
  assert.strictEqual(temaMarca.temItalico(temaMarca.resolver({ marca: AURORA }), { style: 'Bold', italico: true }), true);
});

console.log(`\n${n} casos ok, ${falhas} falharam`);
if (falhas) process.exit(1);
