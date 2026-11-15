#!/usr/bin/env node
// Versão compacta dos blocos de motion e do cartão final, para quem grava perto da câmera (queixo perto de y 1200, onde a
// faixa padrão y 955 a 1305 e o cartão de 500 px cobririam o rosto). Sem Tesseract: confere as ações geradas.
// Rode: node 08-FERRAMENTAS/tesseract/blocos-motion/compacto.test.js
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const { montar, MODULOS, ALTURA } = require('./index');

let n = 0, falhas = 0;
const t = (nome, fn) => { try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + e.message.split('\n')[0]); } };
const exemplo = (m) => {
  const ex = JSON.parse(JSON.stringify(m.exemplo));
  if (m.tipo === 'cartao-cta') ex.opcoes = { ...ex.opcoes, larguraBotao: 300, conta: '@x' };
  return ex;
};
const criacoes = (r) => r.acoes.filter((a) => /^createFx(Rect|Text|Shape)Layer$/.test(a.type));
// alto e pé de uma camada de retângulo (posição menos âncora, vezes a escala)
const vertical = (a) => {
  const s = a.transform.scale[1] / 100, top = a.transform.position[1] - a.transform.anchorPoint[1] * s;
  return [top, top + a.rect.size[1] * s];
};

t('faixa padrão: nenhuma camada encolhe (escala 100) e nenhum aviso de compacto', () => {
  for (const m of MODULOS) {
    const r = montar([exemplo(m)]);
    for (const a of criacoes(r)) assert.deepStrictEqual(a.transform.scale, [100, 100], `${m.tipo}: ${a.name}`);
    assert.ok(!r.avisos.some((x) => /compacto/.test(x)), m.tipo);
  }
});

t('faixa de 200 px acima da cabeça (y 260 a 460): cada bloco encolhe e os retângulos cabem na faixa', () => {
  const faixa = [260, 460];
  for (const m of MODULOS.filter((x) => x.tipo !== 'cartao-cta' && x.tipo !== 'selo')) {
    const r = montar([exemplo(m)], { faixa });
    const s = Math.min(1, 200 / ALTURA[m.tipo]);
    assert.ok(r.avisos.some((x) => /compacto/.test(x)), `${m.tipo}: sem aviso de compacto`);
    for (const a of criacoes(r)) {
      assert.ok(Math.abs(a.transform.scale[0] - 100 * s) < 1e-9, `${m.tipo}: ${a.name} na escala ${a.transform.scale[0]}`);
      if (a.type === 'createFxRectLayer') {
        const [y0, y1] = vertical(a);
        assert.ok(y0 >= faixa[0] - 6 && y1 <= faixa[1] + 6, `${m.tipo}: ${a.name} de ${Math.round(y0)} a ${Math.round(y1)}`);
      }
    }
  }
});

t('faixa baixa demais (menos da metade do bloco), acima de y 250 ou sobre a legenda: recusada', () => {
  const placa = exemplo(MODULOS.find((m) => m.tipo === 'placa'));
  assert.throws(() => montar([placa], { faixa: [1250, 1320] }), /no mínimo 175/);
  assert.throws(() => montar([placa], { faixa: [200, 450] }), /acima de y 250/);
  assert.throws(() => montar([placa], { faixa: [1100, 1400] }), /legenda/);
});

t('cartão final compacto (escala 0.68, centro 1425): fica de y 1255 a 1595, entre o queixo em 1200 e a barra do app', () => {
  const cta = exemplo(MODULOS.find((m) => m.tipo === 'cartao-cta'));
  cta.opcoes = { ...cta.opcoes, escala: 0.68, centroY: 1425 };
  const r = montar([cta]);
  const cartao = criacoes(r).find((a) => /-cartao$/.test(a.name));
  const [y0, y1] = vertical(cartao);
  assert.ok(Math.abs(y0 - 1255) < 1 && Math.abs(y1 - 1595) < 1, `cartão de ${y0} a ${y1}`);
  for (const a of criacoes(r).filter((x) => x.type === 'createFxRectLayer')) {
    const [p, q] = vertical(a);
    assert.ok(p >= y0 - 1 && q <= y1 + 1, `${a.name} sai do cartão (${p} a ${q})`);
  }
  // sem escala, o cartão de sempre (920 x 500 em y 1060)
  const normal = criacoes(montar([exemplo(MODULOS.find((m) => m.tipo === 'cartao-cta'))])).find((a) => /-cartao$/.test(a.name));
  assert.deepStrictEqual(vertical(normal), [1060, 1560]);
});

t('cartão final: escala fora de 0.5 a 1, ou cartão fora de y 250 a 1640, é recusado', () => {
  const base = exemplo(MODULOS.find((m) => m.tipo === 'cartao-cta'));
  assert.throws(() => montar([{ ...base, opcoes: { ...base.opcoes, escala: 0.3 } }]), /escala/);
  assert.throws(() => montar([{ ...base, opcoes: { ...base.opcoes, centroY: 1500 } }]), /sai da área/);
});

console.log(`\n${n} testes passaram${falhas ? `, ${falhas} falharam` : ''}.`);
if (falhas) process.exit(1);
