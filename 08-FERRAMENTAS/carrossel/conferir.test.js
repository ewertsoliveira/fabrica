#!/usr/bin/env node
// Calibração do conferidor do carrossel (G-13): para cada regra, um caso feito para falhar que precisa reprovar e um caso
// bom que precisa passar. Parte 1: regras de copy e checagens sobre registros medidos (rápido, sem navegador).
// Parte 2: a peça renderizada de verdade no Chromium, com defeitos plantados no HTML.
// Rode: node 08-FERRAMENTAS/carrossel/conferir.test.js   (precisa do Chromium; veja navegador.js)
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const molde = require('./molde');
const c = require('./conferir');

let n = 0;
const t = (nome, fn) => { const r = fn(); n++; if (r && typeof r.then === 'function') return r.then(() => console.log('ok   ' + nome)); console.log('ok   ' + nome); };
const regras = (achados) => [...new Set(achados.map((a) => a.regra))].sort();
const cfg = c.cfgDaMarca();
const estilo = (id) => molde.lerEstilo(id);
const demo = (id) => JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, id, 'demo.json'), 'utf8'));

// ---------------------------------------------------------------- parte 1: copy
const EC = estilo('contraste');
const lam = (o = {}) => ({ titulo: 'Título curto', corpo: 'Um corpo com tamanho certo para caber no slide, dito em uma frase só, sem exagero nenhum aqui.', visual: { tipo: 'numero', valor: '1' }, ...o });
const copy = (conteudos, extra = {}) => c.conferirConteudo({ estilo: EC, conteudos, cfg, ...extra });
const VIS = [{ tipo: 'numero', valor: '1' }, { tipo: 'foto', arquivo: 'a.png' }, { tipo: 'mockup', componente: 'perfil' }, { tipo: 'mockup', componente: 'post' }, { tipo: 'numero', valor: '5' }];
const cinco = (f) => VIS.map((v, i) => lam({ visual: v, ...(i === 4 ? f : {}) }));

t('copy: o caso bom passa sem nenhum achado', () => assert.deepStrictEqual(copy(cinco({})), []));
t('C-22: corpo curto, corpo longo e três frases reprovam', () => {
  assert.ok(regras(copy(cinco({ corpo: 'Curto demais.' }))).includes('C-22'));
  assert.ok(regras(copy(cinco({ corpo: 'x'.repeat(140) }))).includes('C-22'));
  assert.ok(copy(cinco({ corpo: 'Primeira frase com tamanho bom. Segunda frase também. Terceira frase que não cabe no slide.' }))
    .some((a) => a.regra === 'C-22' && /frases/.test(a.mensagem)));
});
t('C-22: a marcação *destaque* não conta nos caracteres', () => {
  const corpo = 'a'.repeat(76) + ' **bb**'; // 76 + 1 + 2 = 79 visíveis com a marcação fora
  assert.ok(copy(cinco({ corpo })).some((a) => a.regra === 'C-22'));
  assert.deepStrictEqual(copy(cinco({ corpo: 'a'.repeat(76) + ' **bbbb**' })).filter((a) => a.regra === 'C-22'), []);
});
t('C-09: exclamação reprova quando a marca veta, e passa quando permite', () => {
  assert.ok(regras(copy(cinco({ titulo: 'Olha só!' }))).includes('C-09'));
  assert.deepStrictEqual(copy(cinco({ titulo: 'Olha só!' }), { cfg: { ...cfg, exclamacao: 'permitida' } }).filter((a) => a.regra === 'C-09'), []);
});
t('C-10: travessão reprova, hífen passa', () => {
  assert.ok(regras(copy(cinco({ titulo: 'A conta — e o resto' }))).includes('C-10'));
  assert.deepStrictEqual(copy(cinco({ titulo: 'Guarda-chuva e pré-venda' })).filter((a) => a.regra === 'C-10'), []);
});
t('C-11: emoji no slide reprova', () => assert.ok(regras(copy(cinco({ titulo: 'Dinheiro 💰 some' }))).includes('C-11')));
t('C-02: termo vetado reprova mesmo sem acento ou com maiúscula', () => {
  const v = { ...cfg, vetados: ['alavancar', 'game changer'] };
  assert.ok(copy(cinco({ titulo: 'Vamos ALAVANCAR o caixa' }), { cfg: v }).some((a) => a.regra === 'C-02'));
  assert.ok(copy(cinco({ titulo: 'Um Game Changer no caixa' }), { cfg: v }).some((a) => a.regra === 'C-02'));
  assert.deepStrictEqual(copy(cinco({ titulo: 'Vamos organizar o caixa' }), { cfg: v }).filter((a) => a.regra === 'C-02'), []);
});
t('C-19: chamada de intenção web num carrossel reprova', () => assert.ok(regras(copy(cinco({ corpo: 'Para ver o método completo, clique no link da bio e baixe o material gratuito agora.' }))).includes('C-19')));
t('C-18: duas chamadas no último slide reprovam; uma só passa', () => {
  assert.ok(copy(cinco({ subtitulo: 'Salve este carrossel e comente a sua dúvida.' })).some((a) => a.regra === 'C-18'));
  assert.deepStrictEqual(copy(cinco({ subtitulo: 'Salve este carrossel para a próxima revisão.' })).filter((a) => a.regra === 'C-18'), []);
  assert.ok(copy(cinco({}), { legenda: 'Siga o perfil e compartilhe com um amigo.' }).some((a) => a.regra === 'C-18' && a.lamina === 0));
});
t('A-05 e A-09: fórmula de guru e palavra corporativa reprovam', () => {
  assert.ok(regras(copy(cinco({ titulo: 'Mas a verdade é que o caixa some' }))).includes('A-05'));
  assert.ok(regras(copy(cinco({ titulo: 'Pare de gastar e comece a guardar' }))).includes('A-05'));
  assert.ok(regras(copy(cinco({ titulo: 'Potencializar o caixa' }))).includes('A-09'));
});
t('DG-10: o mesmo elemento visual em duas lâminas seguidas reprova', () => {
  const l = cinco({}); l[3] = { ...l[3], visual: l[2].visual };
  assert.ok(regras(copy(l)).includes('DG-10'));
});
t('ESTILO: número de lâminas fora da faixa do estilo reprova', () => assert.ok(regras(copy(cinco({}).slice(0, 3))).includes('ESTILO')));
t('copy: as lâminas de demonstração de cada estilo passam (carrossel, fixados e capa de Reels)', () => {
  const ler = (id, n) => JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, id, n), 'utf8'));
  for (const id of molde.listarEstilos()) {
    const e = estilo(id);
    if (!e.soReels) assert.deepStrictEqual(c.conferirConteudo({ estilo: e, conteudos: demo(id), cfg }), [], id);
    if (!e.soReels) assert.deepStrictEqual(c.conferirConteudo({ estilo: e, conteudos: ler(id, 'demo-fixados.json'), cfg, formato: 'fixados' }), [], id + ' fixados');
    assert.deepStrictEqual(c.conferirConteudo({ estilo: e, conteudos: ler(id, 'demo-reels.json'), cfg, formato: 'reels' }), [], id + ' reels');
  }
});
t('calibração: fixados com 2 lâminas reprovam; capa de Reels não segue a faixa de lâminas do carrossel', () => {
  const e = estilo('contraste');
  assert.ok(regras(c.conferirConteudo({ estilo: e, conteudos: cinco({}).slice(0, 2), cfg, formato: 'fixados' })).includes('ESTILO'));
  assert.ok(!regras(c.conferirConteudo({ estilo: e, conteudos: cinco({}).slice(0, 1), cfg, formato: 'reels' })).includes('ESTILO'));
});

// ---------------------------------------------------------------- parte 1b: checagens sobre registros medidos
const reg = (o = {}) => ({ indice: 1, layout: 'conteudo-visual-abaixo', fundo: 'claro', papel: 'miolo', ancora: 'visual', total: null, textos: [], dst: [], visuais: 1, vazios: [], imgsQuebradas: 0, caixaCinza: [], cv: false, veu: false, nav: { barra: false, arraste: false, contador: false, barraLargura: 0 }, logos: 0, logosCortadas: 0, mockupsDuplicados: 0, ...o });
const tx = (o = {}) => ({ texto: 'Exemplo', role: 'corpo', fs: 44, peso: '400', x: 100, y: 300, w: 400, h: 60, cor: [0, 0, 0, 1], opac: 1, vital: true, naMarca: false, decorativo: false, cortado: false, cobertoPor: '', ...o });
const so = (fn, ...a) => regras(fn(...a));

t('DG-01: título abaixo de 72, corpo abaixo de 44 e micro abaixo de 32 reprovam; no piso passa', () => {
  assert.deepStrictEqual(so(c.checarPisos, reg({ textos: [tx({ role: 'titulo', fs: 60 })] }), cfg), ['DG-01']);
  assert.deepStrictEqual(so(c.checarPisos, reg({ textos: [tx({ role: 'corpo', fs: 40 })] }), cfg), ['DG-01']);
  assert.deepStrictEqual(so(c.checarPisos, reg({ textos: [tx({ role: 'micro', fs: 28 })] }), cfg), ['DG-01']);
  assert.deepStrictEqual(c.checarPisos(reg({ textos: [tx({ role: 'titulo', fs: 72 }), tx({ role: 'corpo', fs: 44 }), tx({ role: 'micro', fs: 32 })] }), cfg), []);
});
t('M-04: texto de mockup abaixo do piso de interface ou acima do corpo reprova', () => {
  assert.deepStrictEqual(so(c.checarPisos, reg({ textos: [tx({ role: 'ui', fs: 20, naMarca: true })] }), cfg), ['M-04']);
  assert.deepStrictEqual(so(c.checarPisos, reg({ textos: [tx({ role: 'ui', fs: 60, naMarca: true })] }), cfg), ['M-04']);
  assert.deepStrictEqual(c.checarPisos(reg({ textos: [tx({ role: 'ui', fs: 28, naMarca: true }), tx({ role: 'ui', fs: 44, naMarca: true })] }), cfg), []);
});
t('DG-04: destaque com outro tamanho ou outro peso reprova', () => {
  assert.deepStrictEqual(so(c.checarDestaque, reg({ dst: [{ texto: 'x', fs: 130, fsPai: 100, peso: '800', pesoPai: '800' }] })), ['DG-04']);
  assert.deepStrictEqual(so(c.checarDestaque, reg({ dst: [{ texto: 'x', fs: 100, fsPai: 100, peso: '400', pesoPai: '800' }] })), ['DG-04']);
  assert.deepStrictEqual(c.checarDestaque(reg({ dst: [{ texto: 'x', fs: 100, fsPai: 100, peso: '800', pesoPai: '800' }] })), []);
});
t('DG-04: estilo que declara fonte ou peso pode trocar o peso do destaque, nunca o tamanho', () => {
  const outroPeso = reg({ dst: [{ texto: 'x', fs: 100, fsPai: 100, peso: '900', pesoPai: '300' }] });
  assert.deepStrictEqual(c.checarDestaque(outroPeso, ['cor', 'fonte']), []);
  assert.deepStrictEqual(c.checarDestaque(outroPeso, ['peso']), []);
  assert.deepStrictEqual(so(c.checarDestaque, outroPeso, ['cor']), ['DG-04']);
  assert.deepStrictEqual(so(c.checarDestaque, reg({ dst: [{ texto: 'x', fs: 130, fsPai: 100, peso: '900', pesoPai: '300' }] }), ['fonte']), ['DG-04']);
});
t('DG-08: texto vital nas faixas reservadas reprova; texto não vital e fora das faixas passa', () => {
  assert.deepStrictEqual(so(c.checarAreaSegura, reg({ textos: [tx({ y: 40 })] }), cfg), ['DG-08']);
  assert.deepStrictEqual(so(c.checarAreaSegura, reg({ textos: [tx({ y: 1180, h: 60 })] }), cfg), ['DG-08']);
  assert.deepStrictEqual(c.checarAreaSegura(reg({ textos: [tx({ y: 95 }), tx({ y: 1100 }), tx({ y: 40, vital: false })] }), cfg), []);
});
t('DG-02: texto que passa da borda da lâmina reprova', () => {
  assert.deepStrictEqual(so(c.checarForaDoCanvas, reg({ textos: [tx({ x: 900, w: 400 })] }), cfg), ['DG-02']);
  assert.deepStrictEqual(c.checarForaDoCanvas(reg({ textos: [tx({ x: 900, w: 150 }), tx({ x: 1500, w: 100, naMarca: true })] }), cfg), []);
});
t('DG-23: texto coberto por outro elemento reprova', () => {
  assert.deepStrictEqual(so(c.checarCobertura, reg({ textos: [tx({ cobertoPor: 'pilula' })] })), ['DG-23']);
  assert.deepStrictEqual(c.checarCobertura(reg({ textos: [tx()] })), []);
});
t('M-03: texto de mockup cortado pela metade reprova', () => {
  assert.deepStrictEqual(so(c.checarMockupCortado, reg({ textos: [tx({ cortado: true, naMarca: true })] })), ['M-03']);
  assert.deepStrictEqual(c.checarMockupCortado(reg({ textos: [tx({ naMarca: true })] })), []);
});
t('DG-09, M-02, I-15: sem elemento visual, caixa vazia, caixa cinza e imagem quebrada reprovam', () => {
  assert.deepStrictEqual(so(c.checarVisual, reg({ visuais: 0 })), ['DG-09']);
  assert.deepStrictEqual(c.checarVisual(reg({ visuais: 0, ancora: 'propria' })), []);
  assert.deepStrictEqual(so(c.checarVisual, reg({ vazios: ['vis'] })), ['M-02']);
  assert.deepStrictEqual(so(c.checarVisual, reg({ caixaCinza: ['placeholder'] })), ['M-02']);
  assert.deepStrictEqual(so(c.checarVisual, reg({ imgsQuebradas: 1 })), ['I-15']);
  assert.deepStrictEqual(c.checarVisual(reg()), []);
});
t('C-21: campo do conteúdo que o layout não desenha (texto perdido) reprova; texto em partes e em caixa alta passa', () => {
  const r = (...ts) => reg({ layout: 'conteudo-visual-abaixo', textos: ts.map((x) => tx({ texto: x })) });
  const cont = { kicker: 'Por que acontece', titulo: 'Água *suja*, haste fechada', corpo: 'Um corpo com texto.', itens: [{ titulo: 'Corte a haste', texto: 'Em diagonal.' }] };
  assert.deepStrictEqual(c.checarTextoPerdido(r('POR QUE ACONTECE', 'Água ', 'suja', ', haste fechada', 'Um corpo com texto.', 'Corte a haste', 'Em diagonal.'), cont), []);
  const perdido = c.checarTextoPerdido(r('POR QUE ACONTECE', 'Água ', 'suja', ', haste fechada', 'Um corpo com texto.'), cont);
  assert.deepStrictEqual(perdido.map((a) => a.regra), ['C-21', 'C-21']);
  assert.ok(/Corte a haste/.test(perdido[0].mensagem) && /conteudo-visual-abaixo/.test(perdido[0].mensagem));
});
t('DG-09: no miolo, uma lâmina só tipográfica passa e a segunda reprova', () => {
  const tip = (i, papel = 'miolo', visuais = 0) => ({ ...reg({ visuais, ancora: 'propria', papel }), indice: i });
  assert.deepStrictEqual(c.checarSoTipografica([tip(0, 'capa', 1), tip(1), tip(2, 'miolo', 1), tip(3, 'fecho')]), []);
  const dois = c.checarSoTipografica([tip(0, 'capa', 1), tip(1), tip(2), tip(3, 'miolo', 1)]);
  assert.deepStrictEqual(dois.map((a) => a.regra), ['DG-09']);
  assert.strictEqual(c.checarSoTipografica([tip(1), tip(2), tip(3)]).length, 2);
});
t('DG-10 e DG-15: rodízio repetido, miolo fixo com dois layouts e fundo fora da sequência reprovam', () => {
  const rod = (l, f = 'claro', p = 'miolo') => reg({ layout: l, fundo: f, papel: p });
  const seq = (...ls) => ls.map((l, i) => ({ ...rod(l, i % 2 ? 'claro' : 'escuro'), indice: i }));
  assert.ok(so(c.checarSequencia, seq('a', 'a'), EC).includes('DG-10'));
  assert.deepStrictEqual(c.checarSequencia(seq('a', 'b', 'a'), EC), []);
  const fixo = estilo('papelaria');
  const fx = (...ls) => ls.map((l, i) => ({ ...rod(l, ['acento', 'claro', 'escuro'][i % 3]), indice: i }));
  assert.ok(so(c.checarSequencia, fx('miolo-objeto', 'outro'), fixo).includes('DG-10'));
  assert.deepStrictEqual(c.checarSequencia(fx('miolo-objeto', 'miolo-objeto', 'miolo-objeto'), fixo), []);
  assert.ok(so(c.checarSequencia, [{ ...rod('a', 'roxo'), indice: 0 }], EC).includes('DG-15'));
  assert.ok(so(c.checarSequencia, [{ ...rod('a', 'escuro'), indice: 0 }, { ...rod('b', 'escuro'), indice: 1 }], EC).includes('DG-15'));
});
t('F-26 a F-29 e F-53: navegação só como o estilo declara, sem arraste no último e barra cheia no fim', () => {
  const sem = estilo('contraste');
  const com = { ...sem, car: { ...sem.car, navegacao: { barra: true, arraste: true, contador: true } } };
  const nav = (o) => ({ barra: false, arraste: false, contador: false, barraLargura: 0, ...o });
  const duas = (a, b) => [reg({ indice: 0, nav: nav(a) }), reg({ indice: 1, nav: nav(b) })];
  assert.deepStrictEqual(c.checarNavegacao(duas({}, {}), sem), []);
  assert.deepStrictEqual(so(c.checarNavegacao, duas({ barra: true, barraLargura: 0.5 }, {}), sem), ['F-26']);
  assert.deepStrictEqual(so(c.checarNavegacao, duas({ contador: true }, {}), sem), ['F-53']);
  assert.deepStrictEqual(so(c.checarNavegacao, duas({ arraste: true }, {}), sem), ['F-27']);
  assert.ok(so(c.checarNavegacao, duas({}, {}), com).includes('F-27'));
  const certa = duas({ barra: true, contador: true, arraste: true, barraLargura: 0.5 }, { barra: true, contador: true, barraLargura: 1 });
  assert.deepStrictEqual(c.checarNavegacao(certa, com), []);
  assert.ok(so(c.checarNavegacao, duas({ barra: true, contador: true, arraste: true, barraLargura: 0.5 }, { barra: true, contador: true, arraste: true, barraLargura: 1 }), com).includes('F-29'));
  assert.ok(so(c.checarNavegacao, duas({ barra: true, contador: true, arraste: true, barraLargura: 0.5 }, { barra: true, contador: true, barraLargura: 0.8 }), com).includes('F-29'));
});
t('I-13, I-14, DG-16, T-12 e T-13: foto fora da capa, capa sem véu, logo fora dos pontos, contagem e mockup duplicado', () => {
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ cv: true })], cfg, 1), ['I-13']);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ cv: true, papel: 'capa' })], cfg, 1), ['I-14']);
  assert.deepStrictEqual(c.checarFotoLogoEstrutura([reg({ cv: true, papel: 'capa', veu: true })], cfg, 1), []);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ logos: 1 })], cfg, 1), ['DG-16']);
  assert.deepStrictEqual(c.checarFotoLogoEstrutura([reg({ logos: 1, papel: 'capa' })], cfg, 1), []);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ logos: 2, papel: 'capa' })], cfg, 1), ['DG-16']);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ logosCortadas: 1, logos: 1, papel: 'capa' })], cfg, 1), ['DG-16']);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ total: 5 })], cfg, 1), ['T-12']);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ total: 1 })], cfg, 4, 1), ['T-12']);
  assert.deepStrictEqual(so(c.checarFotoLogoEstrutura, [reg({ mockupsDuplicados: 1 })], cfg, 1), ['T-13']);
});

// ---------------------------------------------------------------- parte 2: a peça renderizada de verdade
const SVG = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" fill="#555"/></svg>').toString('base64');
const montar = (id, conteudos = demo(id), opcoes = {}, css = '') => {
  const html = molde.pagina(estilo(id), conteudos, { cores: 'sugestao', embutir: true, ...opcoes });
  return css ? html.replace('</head>', `<style>${css}</style></head>`) : html;
};
const render = async (id, html, conteudos = demo(id), extra = {}) => (await c.conferirRender({ estilo: extra.estilo || estilo(id), conteudos, html, cfg, ...extra })).achados;
const comRegra = (achados, regra) => achados.filter((a) => a.regra === regra);

(async () => {
  for (const id of molde.listarEstilos()) {
    if (estilo(id).soReels) continue; // estilo só de capa de Reels: conferido pelo gerar.test.js no formato reels
    await t(`renderizado: o demo do estilo ${id} passa em todas as checagens`, async () => assert.deepStrictEqual(await render(id, montar(id)), []));
  }
  await t('DG-01 renderizado: título com 30px reprova', async () => assert.ok(comRegra(await render('contraste', montar('contraste', demo('contraste'), {}, '.est-contraste .titulo{font-size:30px !important}')), 'DG-01').length));
  await t('M-04 renderizado: texto de mockup com 16px reprova', async () => assert.ok(comRegra(await render('contraste', montar('contraste', demo('contraste'), {}, '.est-contraste .mk-sub{font-size:16px !important}')), 'M-04').length));
  await t('DG-04 renderizado: destaque maior que a frase reprova', async () => assert.ok(comRegra(await render('contraste', montar('contraste', demo('contraste'), {}, '.est-contraste .titulo .dst{font-size:150% !important}')), 'DG-04').length));
  await t('DG-08 renderizado: título colado no topo reprova', async () => assert.ok(comRegra(await render('contraste', montar('contraste', demo('contraste'), {}, '.est-contraste .titulo{position:absolute !important;top:10px !important;left:88px}')), 'DG-08').length));
  await t('DG-23 renderizado: pílula em cima do mockup reprova', async () => assert.ok(comRegra(await render('contraste', montar('contraste', demo('contraste'), {}, '.est-contraste .pilula{position:absolute !important;left:250px;top:480px;z-index:9}')), 'DG-23').length));
  await t('AA renderizado: texto cinza-claro sobre fundo claro reprova', async () => assert.ok(comRegra(await render('contraste', montar('contraste', demo('contraste'), {}, '.est-contraste.fundo-claro .corpo{color:#CFCFCF !important}')), 'AA').length));
  await t('AA renderizado: o contraste é medido nos pixels, inclusive sobre foto', async () => {
    const e = demo('editorial'); // capa com foto e véu: o texto claro sobre o véu escuro passa; sem o véu, reprova
    const sem = montar('editorial', e, {}, '.est-editorial .vela{display:none !important}');
    assert.ok(comRegra(await render('editorial', sem, e), 'AA').length);
  });
  await t('AA renderizado: frase em duas linhas é medida linha a linha, sem pegar o fundo ao lado', async () => {
    // no fecho do Recorte, "Quer um plano para a" quebra ao lado da fita clara do destaque
    const doTitulo = (a) => comRegra(a, 'AA').filter((x) => x.lamina === 6 && /Quer um plano/.test(x.mensagem));
    assert.strictEqual(doTitulo(await render('recorte', montar('recorte'))).length, 0, 'texto claro na fita preta passa');
    assert.ok(doTitulo(await render('recorte', montar('recorte', demo('recorte'), {}, '.est-recorte .titulo .fita{color:#2A2A2A !important}'))).length, 'calibração: texto escuro na fita preta reprova');
  });
  await t('DG-09 renderizado: lâmina sem elemento visual reprova', async () => {
    const l = demo('contraste'); delete l[1].visual;
    assert.ok(comRegra(await render('contraste', montar('contraste', l), l), 'DG-09').length);
  });
  await t('M-02 renderizado: caixa cinza chapada no lugar do visual reprova', async () => {
    const html = montar('contraste').replace(/(<div class="lamina[^>]*data-posicao="2"[^>]*><div class="grao"><\/div>)/, '$1<div class="vis" style="position:relative;width:600px;height:300px;background:#cccccc"></div>');
    assert.ok(comRegra(await render('contraste', html), 'M-02').length);
  });
  await t('I-15 renderizado: imagem sem arquivo reprova', async () => {
    const html = montar('papelaria').replace(/src="data:image\/jpeg;base64,[^"]{20,}"/, 'src="nao-existe.jpg"');
    assert.ok(comRegra(await render('papelaria', html), 'I-15').length);
  });
  await t('DG-15 renderizado: a peça inteira num fundo só reprova', async () => {
    const l = demo('contraste').map((x) => ({ ...x, fundo: 'escuro' }));
    assert.ok(comRegra(await render('contraste', montar('contraste', l), l), 'DG-15').length);
  });
  await t('DG-10 renderizado: o mesmo layout em duas lâminas do rodízio reprova', async () => {
    const l = demo('contraste'); l[2] = { ...l[2], layout: 'formula' }; l[3] = { ...l[3], layout: 'formula' };
    assert.ok(comRegra(await render('contraste', montar('contraste', l), l), 'DG-10').length);
  });
  await t('DG-10 renderizado: miolo fixo que usa dois layouts reprova', async () => {
    const l = demo('papelaria'); l[2] = { ...l[2], layout: 'capa-foto', foto: l[0].foto };
    assert.ok(comRegra(await render('papelaria', montar('papelaria', l), l), 'DG-10').length);
  });
  await t('DG-16 renderizado: logo no miolo reprova; na capa e no fecho passa', async () => {
    const dentro = await render('contraste', montar('contraste', demo('contraste'), { logo: SVG, logoAparece: ['capa', 'fecho'] }));
    assert.deepStrictEqual(comRegra(dentro, 'DG-16'), []);
    const fora = await render('contraste', montar('contraste', demo('contraste'), { logo: SVG, logoAparece: ['capa', 'miolo', 'fecho'] }));
    assert.ok(comRegra(fora, 'DG-16').length);
  });
  await t('I-13 renderizado: foto em tela cheia numa lâmina interna reprova', async () => {
    const html = montar('contraste').replace(/(<div class="lamina[^>]*data-posicao="2"[^>]*><div class="grao"><\/div>)/, '$1<div class="cv"><img src="' + SVG + '" alt=""></div>');
    assert.ok(comRegra(await render('contraste', html), 'I-13').length);
  });
  await t('I-14 renderizado: capa com foto e sem véu reprova', async () => {
    const html = montar('editorial').replace('<i class="vela"></i>', '');
    assert.ok(comRegra(await render('editorial', html), 'I-14').length);
  });
  await t('T-12 renderizado: a página com uma lâmina a menos reprova', async () => {
    const l = demo('contraste');
    assert.ok(comRegra(await render('contraste', montar('contraste', l.slice(0, 5)), l), 'T-12').length);
  });
  await t('F-26 renderizado: navegação na peça que o estilo não declara reprova', async () => {
    const base = estilo('contraste');
    const comNav = { ...base, car: { ...base.car, navegacao: { barra: true, arraste: true, contador: true } } };
    const html = molde.pagina(comNav, demo('contraste'), { cores: 'sugestao', embutir: true });
    const r = await render('contraste', html);
    assert.ok(['F-26', 'F-27', 'F-53'].every((x) => comRegra(r, x).length));
  });
  await t('apenas: a conferência de uma lâmina só devolve achados dela', async () => {
    const html = montar('contraste', demo('contraste'), {}, '.est-contraste .titulo{font-size:30px !important}');
    const r = await render('contraste', html, demo('contraste'), { apenas: [0] });
    assert.ok(r.length && r.every((a) => a.lamina === 0 || a.lamina === 1));
  });
  console.log(`\n${n} testes passaram.`);
})().catch((e) => { console.error('\nFALHOU:', e.message); process.exit(1); });
