#!/usr/bin/env node
// Testes da biblioteca de mockups. Rode: node 08-FERRAMENTAS/mockups/mockups.test.js
// Cada checagem é calibrada contra um caso feito para falhar (G-13): o caso ruim precisa reprovar antes de valer.
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const path = require('path');
const mk = require('./mockups');
const marca = require(path.join(__dirname, '..', 'marca', 'marca'));

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

// ---------- conferidores (os mesmos que o conferidor do carrossel vai usar) ----------
const textoVisivel = (html) => html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
// M-07: termos de interface em inglês que não podem vazar num público de língua portuguesa. Ficam de fora os que
// também são português (Jan, Data, No).
const INGLES = ['Follow', 'Following', 'Followers', 'Message', 'Posts', 'Liked by', 'View all', 'comments', 'Search', 'Send message', 'Active now', 'ago', 'Today', 'Share', 'Edit', 'Insert', 'File', 'Reply', 'Yes', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Feb', 'Apr', 'May', 'Aug', 'Sep', 'Oct', 'Dec'];
const ingles = (html) => { const txt = textoVisivel(html); return INGLES.filter((p) => new RegExp(`(^|[^\\p{L}])${p}([^\\p{L}]|$)`, 'u').test(txt)); };
// M-04: todo font-size em px fica entre o piso de interface e o piso de corpo da peça.
const tamanhos = (css) => [...css.matchAll(/font(?:-size)?\s*:[^;}]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));
const pisoUi = marca.pega('canvas.pisos-ui').corpo;
const tetoCorpo = marca.pega('canvas.pisos').corpo;
const foraDaEscala = (css) => tamanhos(css).filter((v) => v < pisoUi || v > tetoCorpo);
// M-02: caixa vazia ou cinza no lugar do conteúdo.
const caixaVazia = (html) => /class="[^"]*(placeholder|imagem-aqui|wireframe)[^"]*"/.test(html) || /background:\s*#?(ccc|cccccc|ddd|dddddd|808080|999999)\b/i.test(html);

// ---------- calibração: cada conferidor reprova o caso feito para falhar ----------
t('calibração M-07: "Follow" e "Liked by" reprovam', () => {
  assert.deepStrictEqual(ingles('<span>Follow</span><p>Liked by ana</p>'), ['Follow', 'Liked by']);
  assert.deepStrictEqual(ingles('<span>Seguir</span><span>seguidores</span>'), []);
});
t('calibração M-04: 12px e 60px reprovam', () => {
  assert.deepStrictEqual(foraDaEscala(`.a{font-size:12px}.b{font:700 60px/1 x}.c{font-size:${pisoUi}px}`), [12, 60]);
});
t('calibração M-02: caixa cinza reprova', () => {
  assert.ok(caixaVazia('<div class="mk-img" style="background:#cccccc"></div>'));
  assert.ok(caixaVazia('<div class="placeholder"></div>'));
});

// ---------- a biblioteca ----------
const MODOS = ['claro', 'escuro'];
for (const [nome, fn] of Object.entries(mk.COMPONENTES)) {
  t(`${nome}: renderiza nos dois modos, sem valor quebrado, sem caixa vazia e sem inglês`, () => {
    for (const modo of MODOS) {
      const html = fn({ modo });
      assert.ok(html.length > 200, 'saída curta demais');
      assert.ok(!/undefined|NaN|\[object Object\]/.test(html), 'valor quebrado no HTML');
      assert.ok(!caixaVazia(html), 'caixa vazia ou cinza (M-02)');
      assert.deepStrictEqual(ingles(html), [], 'termo de interface em inglês (M-07)');
    }
  });
}
t('M-04: todo texto do CSS fica entre o piso de interface e o piso de corpo', () => {
  assert.deepStrictEqual(foraDaEscala(mk.css()), []);
});
t('M-04: os estilos em linha dos componentes também respeitam a escala', () => {
  for (const fn of Object.values(mk.COMPONENTES)) {
    const emLinha = [...fn({}).matchAll(/style="([^"]*)"/g)].map((m) => m[1]).join(';');
    assert.deepStrictEqual(foraDaEscala(emLinha), []);
  }
});
t('M-06: sobre o fundo escuro da marca, o mockup é claro', () => {
  assert.strictEqual(mk.temaSobre('escuro'), 'claro');
  assert.strictEqual(mk.temaSobre('#101010'), 'claro');
  assert.notStrictEqual(mk.temaSobre('#FAFAFA'), 'claro');
});
t('M-03: o perfil tem o aro de stories, os números e os botões nativos', () => {
  const h = mk.perfil({});
  assert.ok(/mk-anel/.test(h) && /seguidores/.test(h) && /Seguir/.test(h) && /Mensagem/.test(h));
});
t('M-08: marcadores numerados saem na cor de acento, na posição pedida', () => {
  const h = mk.comMarcadores('<div class="mk"></div>', [{ n: 1, x: 10, y: 20 }, { n: 2, x: 50, y: 60 }]);
  assert.strictEqual((h.match(/mk-marcador/g) || []).length, 2);
  assert.ok(h.includes('left:10%;top:20%') && h.includes(marca.hex('acento')));
});
t('conteúdo pintado pela marca: a cor de acento aparece nos componentes de aplicativo', () => {
  for (const k of ['cartaoApp', 'checklist', 'antesDepois', 'navegador']) assert.ok(mk.COMPONENTES[k]({}).includes(marca.hex('acento')), k);
});
t('texto no tom do acento passa em AA mesmo com acento claro (pílula do cartão de app)', () => {
  assert.ok(mk.contraste('#E0EBF5', '#FFFFFF') < 3, 'calibração: o azul-claro puro sobre branco reprova');
  for (const ac of ['#E0EBF5', '#5CE6F2', '#F59E38', '#2EC4F2', '#1F3358']) {
    assert.ok(mk.contraste(mk.legivel(ac, '#FFFFFF'), '#FFFFFF') >= 4.5, ac + ' sobre branco');
    assert.ok(mk.contraste(mk.legivel(ac, '#000000'), '#000000') >= 4.5, ac + ' sobre preto');
  }
  mk.usarCores({ escuro: '#141419', claro: '#F1F3F4', acento: '#E0EBF5', neutro: '#5F6670' });
  const cor = mk.COMPONENTES.cartaoApp({}).match(/mk-pilula" style="[^"]*color:(#[0-9A-F]{6})/)[1];
  mk.usarCores(null);
  assert.ok(mk.contraste(cor, '#FFFFFF') >= 4.5, `pílula ${cor}`);
});
t('foto real substitui o monograma e a miniatura tipográfica', () => {
  const h = mk.post({ foto: 'fotos/x.jpg' });
  assert.ok(h.includes('src="fotos/x.jpg"'));
});

console.log(`\n${n} testes passaram.`);
