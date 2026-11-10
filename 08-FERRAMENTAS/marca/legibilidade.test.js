// Testes de legibilidade.js: quando uma cor da marca fica difícil de ler sobre um fundo, até 3 cores que passam no
// contraste e combinam com a marca (primeiro as da própria marca, depois o tom mais perto da cor com problema).
// Cores fictícias, montadas de rgb (nenhum código de cor escrito à mão).
'use strict';
const assert = require('assert');
const path = require('path');
const legibilidade = require('./legibilidade');

let falhas = 0;
function t(nome, fn) {
  try { fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
}

const hx = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const rgbDe = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function luminancia(h) {
  return rgbDe(h).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
function matiz(h) {
  const [r, g, b] = rgbDe(h).map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const d = max - min;
  if (!d) return null;
  const m = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return m * 60;
}
const difMatiz = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

const MARCA = { escuro: hx([22, 30, 52]), claro: hx([246, 240, 228]), acento: hx([120, 24, 36]), neutro: hx([128, 124, 118]) };

// A regra do tom da marca: nem quase preto nem quase branco (luz HSL entre 0,03 e 0,97, exclusive) e, se a cor original
// tem matiz (croma de 0,04 ou mais), o tom também tem e fica a até 10 graus dele.
const croma = (h) => { const v = rgbDe(h); return (Math.max(...v) - Math.min(...v)) / 255; };
const luzHsl = (h) => { const v = rgbDe(h); return (Math.max(...v) + Math.min(...v)) / 510; };
function tomFiel(tom, original) {
  if (luzHsl(tom) <= 0.03 || luzHsl(tom) >= 0.97) return false;
  if (croma(original) < 0.04) return true;
  return croma(tom) > 0 && difMatiz(matiz(tom), matiz(original)) <= 10;
}
const ORDEM = ['da-marca', 'tom-da-marca', 'neutro'];

function conferirSaida(lista, { papel, fundos, minimo = 4.5, original }) {
  assert.ok(Array.isArray(lista) && lista.length <= 3, 'até 3 sugestões');
  const vistos = new Set();
  let etapa = 0;
  for (const s of lista) {
    assert.strictEqual(s.papel, papel);
    assert.ok(/^#[0-9A-F]{6}$/.test(s.cor), s.cor);
    assert.ok(!vistos.has(s.cor), 'sem cor repetida'); vistos.add(s.cor);
    assert.ok(ORDEM.includes(s.origem), s.origem);
    assert.ok(ORDEM.indexOf(s.origem) >= etapa, 'da marca, depois tons, depois branco ou preto'); etapa = ORDEM.indexOf(s.origem);
    if (s.origem === 'tom-da-marca' && original) assert.ok(tomFiel(s.cor, original), `tom ${s.cor} de ${original} fora da regra (quase preto, quase branco ou matiz perdido)`);
    if (s.origem === 'neutro') assert.ok(['Branco', 'Preto'].includes(s.rotulo) && [hx([255, 255, 255]), hx([0, 0, 0])].includes(s.cor), JSON.stringify(s));
    const pior = Math.min(...fundos.map((f) => contraste(s.cor, f)));
    assert.ok(pior >= minimo, `${s.cor} com ${pior.toFixed(2)} não passa no mínimo ${minimo}`);
    assert.ok(typeof s.contraste === 'number' && s.contraste <= pior + 1e-9 && pior - s.contraste < 0.011, 'contraste é o pior entre as amostras');
    assert.ok(typeof s.rotulo === 'string' && s.rotulo.length > 0 && !/hex|#/i.test(s.rotulo), 'rótulo em português simples: ' + s.rotulo);
  }
}

t('acento escuro sobre fundo escuro: primeiro o claro da marca, depois tons mais claros do próprio acento', () => {
  const lista = legibilidade.sugerir({ papel: 'acento', cores: MARCA, fundo: MARCA.escuro });
  conferirSaida(lista, { papel: 'acento', fundos: [MARCA.escuro], original: MARCA.acento });
  assert.strictEqual(lista[0].origem, 'da-marca');
  assert.strictEqual(lista[0].cor, MARCA.claro);
  const tons = lista.filter((s) => s.origem === 'tom-da-marca');
  assert.ok(tons.length >= 1, JSON.stringify(lista));
  for (const s of tons) {
    assert.ok(difMatiz(matiz(s.cor), matiz(MARCA.acento)) <= 4, `o tom ${s.cor} mantém o matiz do acento`);
    assert.ok(luminancia(s.cor) > luminancia(MARCA.acento), 'sobre fundo escuro, o tom fica mais claro');
  }
  assert.ok(!lista.some((s) => s.cor === MARCA.acento), 'a cor com problema não é sugerida');
});

t('a menor mudança: o primeiro tom passa por pouco (um passo a menos não passaria)', () => {
  const [tom] = legibilidade.sugerir({ papel: 'acento', cores: { acento: MARCA.acento }, fundo: MARCA.escuro });
  assert.strictEqual(tom.origem, 'tom-da-marca');
  assert.ok(tom.contraste < 5.2, `mudança maior que o necessário (${tom.contraste})`);
});

t('neutro médio sobre degradê: vale o pior contraste entre as amostras do fundo', () => {
  const amostras = [hx([10, 10, 16]), hx([60, 70, 100]), hx([96, 104, 140])];
  const lista = legibilidade.sugerir({ papel: 'neutro', cores: MARCA, fundo: { amostras } });
  conferirSaida(lista, { papel: 'neutro', fundos: amostras });
  assert.ok(lista.length >= 2, JSON.stringify(lista));
  assert.ok(!lista.some((s) => s.cor === MARCA.neutro), 'o neutro atual não passa no pedaço mais claro do degradê');
  // com a amostra mais escura só, a mesma cor passaria: a conta usa a pior
  assert.ok(contraste(MARCA.neutro, amostras[0]) >= 4.5 && contraste(MARCA.neutro, amostras[2]) < 4.5);
});

t('marca em que nenhuma cor passa: só tons da marca, todos passando', () => {
  const morna = { escuro: hx([96, 90, 84]), claro: hx([150, 146, 140]), acento: hx([170, 90, 60]), neutro: hx([128, 128, 128]) };
  const fundo = hx([200, 200, 198]);
  const lista = legibilidade.sugerir({ papel: 'acento', cores: morna, fundo });
  assert.ok(lista.length >= 1);
  assert.ok(lista.every((s) => s.origem === 'tom-da-marca'), JSON.stringify(lista));
  conferirSaida(lista, { papel: 'acento', fundos: [fundo], original: morna.acento });
  for (const s of lista) assert.ok(difMatiz(matiz(s.cor), matiz(morna.acento)) <= 4, 'mantém o matiz');
});

t('mínimo pedido (3 para letra grande) e impossível (21 sobre cinza): nunca devolve o que não passa', () => {
  const tres = legibilidade.sugerir({ papel: 'acento', cores: MARCA, fundo: MARCA.escuro, minimo: 3 });
  conferirSaida(tres, { papel: 'acento', fundos: [MARCA.escuro], minimo: 3 });
  assert.deepStrictEqual(legibilidade.sugerir({ papel: 'neutro', cores: MARCA, fundo: hx([128, 128, 128]), minimo: 21 }), []);
});

t('verde médio sobre cinza médio: nenhum tom fiel passa, então vêm branco e preto como neutros, nunca um quase preto', () => {
  const acento = hx([60, 180, 90]);
  const fundo = hx([118, 118, 118]);
  const lista = legibilidade.sugerir({ papel: 'acento', cores: { acento }, fundo });
  conferirSaida(lista, { papel: 'acento', fundos: [fundo], original: acento });
  assert.ok(!lista.some((s) => s.origem === 'tom-da-marca'), JSON.stringify(lista));
  assert.deepStrictEqual(lista.map((s) => s.rotulo).sort(), ['Branco', 'Preto']);
  assert.ok(lista.every((s) => s.origem === 'neutro'));
});

t('varredura (semente fixa, 3000 casos): nenhum tom da marca fora da regra e nenhuma opção abaixo do mínimo', () => {
  let semente = 1;
  const sorteio = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  const cor = () => hx([0, 0, 0].map(() => Math.floor(sorteio() * 256)));
  let tons = 0;
  for (let i = 0; i < 3000; i++) {
    const acento = cor(); const fundo = cor(); const minimo = [3, 4.5, 7][i % 3];
    const lista = legibilidade.sugerir({ papel: 'acento', cores: { acento, escuro: hx([15, 15, 20]), claro: hx([240, 240, 235]) }, fundo, minimo });
    for (const s of lista) {
      assert.ok(contraste(s.cor, fundo) >= minimo, `caso ${i}: ${s.cor} abaixo do mínimo ${minimo} sobre ${fundo}`);
      if (s.origem === 'tom-da-marca') { tons++; assert.ok(tomFiel(s.cor, acento), `caso ${i}: tom ${s.cor} de ${acento} sobre ${fundo}`); }
    }
  }
  assert.ok(tons > 500, 'a varredura chega a testar tons: ' + tons);
});

t('no navegador sem cores-do-logo.js carregado: erro em português', () => {
  const vm = require('vm');
  const codigo = require('fs').readFileSync(path.join(__dirname, 'legibilidade.js'), 'utf8');
  assert.throws(() => vm.runInNewContext(codigo, { window: {} }), /cores-do-logo\.js.*antes/);
});

t('mesma entrada, mesma saída', () => {
  const pedido = { papel: 'neutro', cores: MARCA, fundo: { amostras: [hx([20, 24, 40]), hx([96, 104, 140])] } };
  assert.deepStrictEqual(legibilidade.sugerir(pedido), legibilidade.sugerir(pedido));
});

t('entrada inválida: erro em português', () => {
  const erro = (pedido, re) => assert.throws(() => legibilidade.sugerir(pedido), (e) => re.test(e.message) && /[ãçéêíóú]|cor|papel|fundo|mínimo/i.test(e.message), JSON.stringify(pedido));
  erro({ papel: 'fundo', cores: MARCA, fundo: MARCA.escuro }, /papel/i);
  erro({ papel: 'acento', cores: { ...MARCA, acento: 'azul' }, fundo: MARCA.escuro }, /código da cor/i);
  erro({ papel: 'acento', cores: { escuro: MARCA.escuro }, fundo: MARCA.escuro }, /acento/i);
  erro({ papel: 'acento', cores: MARCA, fundo: 'escuro' }, /fundo/i);
  erro({ papel: 'acento', cores: MARCA, fundo: { amostras: [] } }, /fundo/i);
  erro({ papel: 'acento', cores: MARCA, fundo: MARCA.escuro, minimo: 30 }, /mínimo/i);
  erro({ papel: 'acento', cores: { ...MARCA, fundo: MARCA.escuro }, fundo: MARCA.escuro }, /papel/i);
  assert.throws(() => legibilidade.sugerir(), /papel/i);
});

t('a conta de contraste e o ajuste de tom são os mesmos das cores do logo', () => {
  const CoresDoLogo = require(path.join(__dirname, '..', '..', '_fabrica', 'paineis', 'cores-do-logo.js'));
  assert.strictEqual(legibilidade.contraste, CoresDoLogo.contraste);
  assert.strictEqual(legibilidade.tomQuePassa, CoresDoLogo.tomQuePassa);
});

if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
