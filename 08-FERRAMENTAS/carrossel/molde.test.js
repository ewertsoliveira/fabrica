#!/usr/bin/env node
// Testes do montador de lâminas e do catálogo de estilos. Rode: node 08-FERRAMENTAS/carrossel/molde.test.js
// Cada checagem é calibrada contra um caso feito para falhar (G-13).
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const molde = require('./molde');

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

const ESTILOS = molde.listarEstilos();
const demo = (id) => JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, id, 'demo.json'), 'utf8'));
const atributos = (html, nome) => [...html.matchAll(new RegExp(`data-${nome}="([^"]+)"`, 'g'))].map((m) => m[1]);
const pxDeTexto = (css) => [...css.matchAll(/font(?:-size)?\s*:[^;}]*?(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]));

// ---------- calibração ----------
const BOM = {
  id: 'x', nome: 'X', linha: 'x', origem: 'catalogo',
  'combina-com': ['saude', 'nutricao'], tom: ['acolhedor'], precisa: ['funciona-sem-foto'],
  sugestao: { cores: { escuro: '#111111', claro: '#EEEEEE', acento: '#CC3300', neutro: '#777777' } },
  formatos: { carrossel: { capa: ['capa'], miolo: ['citacao', 'formula'], fecho: ['fecho-cartao'], molde_do_miolo: 'rodizio', alinhamento: 'esquerda',
    navegacao: { barra: false, arraste: false, contador: false }, fundos: ['escuro', 'claro'], laminas: { min: 5, max: 10 } } },
};
const variante = (f) => { const e = JSON.parse(JSON.stringify(BOM)); f(e.formatos.carrossel, e); return e; };
t('calibração: o estilo de referência passa na validação', () => {
  assert.deepStrictEqual(molde.validarEstilo(BOM, molde.PASTA_LAYOUTS), []);
});
t('calibração: estilos quebrados reprovam, cada um com o motivo', () => {
  const casos = [
    [variante((c) => { c.molde_do_miolo = 'fixo'; }), /miolo fixo tem um layout só/],
    [variante((c) => { c.miolo = ['citacao']; }), /rodízio precisa de pelo menos dois/],
    [variante((c) => { c.alinhamento = 'direita'; }), /alinhamento/],
    [variante((c) => { c.fundos = ['roxo']; }), /fundos/],
    [variante((c) => { delete c.navegacao.contador; }), /navegacao/],
    [variante((c) => { c.capa = ['nao-existe']; }), /não existe/],
    [variante((c, e) => { e.sugestao.cores.acento = 'roxo'; }), /sugestao\.cores/],
  ];
  for (const [e, msg] of casos) assert.ok(molde.validarEstilo(e, molde.PASTA_LAYOUTS).some((m) => msg.test(m)), String(msg));
});
// ---------- campos da biblioteca (combina-com, tom, precisa) ----------
const errosDe = (f, opcoes) => { const e = JSON.parse(JSON.stringify(BOM)); f(e); return molde.validarEstilo(e, molde.PASTA_LAYOUTS, opcoes); };
const CONFERE_BIBLIOTECA = { biblioteca: true }; // a conferência do catálogo: aí os três campos são obrigatórios
t('calibração: estilo de catálogo sem tom é recusado, com o estilo e o campo na mensagem', () => {
  const erros = errosDe((e) => { delete e.tom; }, CONFERE_BIBLIOTECA);
  assert.ok(erros.some((m) => /\btom\b/.test(m) && /\bx\b/.test(m)), erros.join(' | '));
  assert.deepStrictEqual(errosDe((e) => { delete e.tom; }), [], 'fora da conferência do catálogo, campo que falta não é erro');
});
t('calibração: código fora do vocabulário é recusado, e a mensagem cita estilo, campo e código', () => {
  const erros = errosDe((e) => { e.tom = ['meloso']; });
  assert.ok(erros.some((m) => m.includes('meloso') && /\btom\b/.test(m) && /\bx\b/.test(m)), erros.join(' | '));
  assert.ok(errosDe((e) => { e['combina-com'] = ['saude', 'astrologia']; }).some((m) => m.includes('astrologia') && m.includes('combina-com')));
  assert.ok(errosDe((e) => { e.precisa = ['drone']; }).some((m) => m.includes('drone') && m.includes('precisa')));
});
t('calibração: quantidade fora do limite é recusada (combina-com 2 a 5, tom 1 a 3, precisa pelo menos 1)', () => {
  assert.ok(errosDe((e) => { e['combina-com'] = ['saude', 'nutricao', 'psicologia', 'direito', 'moda', 'financas']; }).some((m) => m.includes('combina-com')));
  assert.ok(errosDe((e) => { e['combina-com'] = ['saude']; }).some((m) => m.includes('combina-com')));
  assert.ok(errosDe((e) => { e.tom = []; }).some((m) => /\btom\b/.test(m)));
  assert.ok(errosDe((e) => { e.tom = ['sobrio', 'elegante', 'acolhedor', 'tecnico']; }).some((m) => /\btom\b/.test(m)));
  assert.ok(errosDe((e) => { e.precisa = []; }).some((m) => m.includes('precisa')));
  assert.ok(errosDe((e) => { e.tom = 'sobrio'; }).some((m) => /\btom\b/.test(m)), 'texto solto no lugar da lista');
  assert.ok(errosDe((e) => { e.tom = ['sobrio', 'sobrio']; }).some((m) => /\btom\b/.test(m) && m.includes('sobrio')), 'código repetido');
});
t('calibração: funciona-sem-foto junto de foto-fundo-liso ou de foto-de-pessoa é recusado', () => {
  assert.ok(errosDe((e) => { e.precisa = ['funciona-sem-foto', 'foto-fundo-liso']; }).some((m) => m.includes('funciona-sem-foto') && m.includes('foto-fundo-liso')));
  assert.ok(errosDe((e) => { e.precisa = ['funciona-sem-foto', 'foto-de-pessoa']; }).some((m) => m.includes('funciona-sem-foto') && m.includes('foto-de-pessoa')));
  assert.deepStrictEqual(errosDe((e) => { e.precisa = ['funciona-sem-foto', 'fotos-do-assunto']; }), []);
});
t('estilo de referências sem os campos passa; se vierem, também são conferidos', () => {
  assert.deepStrictEqual(errosDe((e) => { e.origem = 'referencias'; delete e['combina-com']; delete e.tom; delete e.precisa; }), []);
  assert.ok(errosDe((e) => { e.origem = 'referencias'; e.tom = ['meloso']; }).some((m) => m.includes('meloso')));
});
t('sem o arquivo do vocabulário: estilo sem os campos passa; com os campos, um erro claro em português (R5)', () => {
  const ausente = path.join(require('os').tmpdir(), 'nao-existe-' + process.pid, 'vocabulario.json');
  molde.usarVocabulario(ausente);
  try {
    assert.deepStrictEqual(errosDe((e) => { e.origem = 'referencias'; delete e['combina-com']; delete e.tom; delete e.precisa; }), []);
    const erros = errosDe((e) => { e.origem = 'referencias'; });
    assert.strictEqual(erros.length, 1, erros.join(' | '));
    assert.match(erros[0], /faltou o arquivo vocabulario\.json da biblioteca; atualize a Fábrica/);
    assert.doesNotMatch(erros[0], /ENOENT/);
    // estilo do catálogo sem os campos continua dizendo qual campo falta
    assert.ok(errosDe((e) => { delete e.tom; }, CONFERE_BIBLIOTECA).some((m) => /falta o campo tom/.test(m)));
  } finally { molde.usarVocabulario(null); }
  assert.deepStrictEqual(errosDe(() => {}), []);
});
t('calibração: estilo só de capa de Reels também confere os campos (R1)', () => {
  const soCapa = (f) => errosDe((e) => { delete e.formatos.carrossel; e.formatos.reels = { capa: 'capa', fundos: ['claro'] }; f(e); });
  assert.deepStrictEqual(soCapa(() => {}), []);
  assert.ok(errosDe((e) => { delete e.formatos.carrossel; e.formatos.reels = { capa: 'capa', fundos: ['claro'] }; delete e.precisa; }, CONFERE_BIBLIOTECA).some((m) => m.includes('precisa')));
  assert.ok(soCapa((e) => { e.precisa = ['drone']; }).some((m) => m.includes('drone')), 'código errado continua erro mesmo sem a conferência do catálogo');
});
t('o vocabulário da biblioteca tem os códigos combinados, cada um com rótulo', () => {
  const voc = JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, '..', 'biblioteca', 'vocabulario.json'), 'utf8'));
  assert.deepStrictEqual(Object.keys(voc), ['combina-com', 'tom', 'precisa']);
  assert.deepStrictEqual(Object.keys(voc['combina-com']), ['saude', 'nutricao', 'psicologia', 'estetica-e-beleza', 'direito', 'financas', 'educacao', 'arquitetura-e-casa', 'tecnologia', 'gastronomia', 'moda', 'bem-estar', 'negocios-e-servicos']);
  assert.deepStrictEqual(Object.keys(voc.tom), ['sobrio', 'elegante', 'acolhedor', 'vibrante', 'divertido', 'tecnico', 'ousado']);
  assert.deepStrictEqual(Object.keys(voc.precisa), ['funciona-sem-foto', 'foto-de-pessoa', 'foto-fundo-liso', 'fotos-do-assunto']);
  for (const grupo of Object.values(voc)) for (const rotulo of Object.values(grupo)) assert.ok(typeof rotulo === 'string' && rotulo.trim(), 'rótulo vazio');
  assert.strictEqual(voc.precisa['foto-fundo-liso'], 'Foto com fundo liso');
  assert.strictEqual(voc.precisa['funciona-sem-foto'], 'Carrossel funciona sem foto', 'o rótulo diz que é o carrossel que dispensa foto (o fixado e a capa de Reels usam retrato)');
});
t('todo estilo do catálogo tem combina-com, tom e precisa; a Protagonista pede foto com fundo liso', () => {
  for (const id of ESTILOS) {
    const { dados: d, dir } = molde.lerEstilo(id);
    for (const k of ['combina-com', 'tom', 'precisa']) assert.ok(Array.isArray(d[k]) && d[k].length, `${id}: ${k}`);
    assert.deepStrictEqual(molde.validarEstilo(d, dir, CONFERE_BIBLIOTECA), [], id);
  }
  assert.ok(molde.lerEstilo('protagonista').dados.precisa.includes('foto-fundo-liso'));
});
t('estilo do catálogo personalizado, sem os campos novos, carrega pelo lerEstilo; a conferência do catálogo acusa (depois do /atualizar)', () => {
  const id = '_teste-sem-tom-' + process.pid;
  const dir = path.join(molde.PASTA_ESTILOS, id);
  const original = fs.readFileSync(path.join(molde.PASTA_ESTILOS, 'contraste', 'estilo.yaml'), 'utf8');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'estilo.yaml'), original.split(/\r?\n/).filter((l) => !/^(tom|combina-com|precisa):/.test(l)).join('\n'));
    const e = molde.lerEstilo(id); // não pode parar a produção
    assert.strictEqual(e.dados.tom, undefined);
    const erros = molde.validarEstilo(e.dados, e.dir, CONFERE_BIBLIOTECA);
    assert.ok(erros.some((m) => /falta o campo tom/.test(m)), erros.join(' | '));
    // código errado continua sendo erro na leitura comum
    fs.writeFileSync(path.join(dir, 'estilo.yaml'), original.replace(/^tom:.*$/m, 'tom: [meloso]'));
    assert.throws(() => molde.lerEstilo(id), /meloso/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
t('o leitor de YAML aceita a chave com hífen e a lista em linha (R2)', () => {
  const { lerYaml } = require('../marca/yaml');
  assert.deepStrictEqual(lerYaml('id: x\ncombina-com: [saude, direito]\ntom: [sobrio]\n'), { id: 'x', 'combina-com': ['saude', 'direito'], tom: ['sobrio'] });
});
t('calibração: preencher repete listas, esconde campo vazio e escapa texto', () => {
  assert.strictEqual(molde.preencher('{{#a}}[{{n}}:{{.}}]{{/a}}{{^b}}sem b{{/b}}', { a: ['x', 'y'] }), '[01:x][02:y]sem b');
  assert.strictEqual(molde.preencher('{{t}}', { t: '<b>*oi*</b>' }), '&lt;b&gt;<em class="dst">oi</em>&lt;/b&gt;');
});

// ---------- texturas e recorte ----------
t('textura no CSS e no atributo vira endereço; na peça entregue, vira dado embutido', () => {
  const nome = path.basename(fs.readdirSync(molde.PASTA_TEXTURAS).find((f) => f.endsWith('.png')) || 'x.png', '.png');
  const css = `.est-x .a{background:textura(${nome}) center/cover}`;
  assert.match(molde.texturas(css), new RegExp(`url\\("file:///[^"]+/${nome}\\.png"\\)`));
  assert.match(molde.texturas(css, { embutir: true }), /url\("data:image\/png;base64,/);
  assert.match(molde.texturas(`<img src="textura:${nome}">`, { foto: () => 'rel/x.png' }), /<img src="rel\/x\.png">/);
  assert.strictEqual(molde.texturas('textura sem parênteses fica como está'), 'textura sem parênteses fica como está');
});
t('calibração: textura que não existe para com o nome dela e o comando que gera', () => {
  assert.throws(() => molde.texturas('.a{background:textura(nao-existe-mesmo)}'), /textura "nao-existe-mesmo" não existe.*gerar-texturas\.js/);
});
t('texturasDoEstilo acha o nome no CSS e nos objetos do estilo', () => {
  const e = { css: '.est-x{background:textura(papel-grade)}', dir: path.join(molde.PASTA_ESTILOS, '__nao_existe__') };
  assert.deepStrictEqual(molde.texturasDoEstilo(e), ['papel-grade']);
});
t('garantirTexturas: o gerador de texturas preso vira "tempo esgotado" dentro do limite (não segura as prévias para sempre)', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'texturas-presas-'));
  const preso = path.join(dir, 'preso.js');
  fs.writeFileSync(preso, 'setInterval(() => {}, 1000);');
  const e = { id: 'x', css: '.est-x{background:textura(nao-existe-preso)}', dir: path.join(dir, '__nao_existe__') };
  const t0 = Date.now();
  assert.throws(() => molde.garantirTexturas(e, { programa: preso, limiteMs: 500 }), (x) => x.code === 'ETIMEDOUT' && /tempo esgotado/.test(x.message));
  assert.ok(Date.now() - t0 < 15000, 'demorou demais: ' + (Date.now() - t0));
  assert.ok(molde.LIMITE_TEXTURAS_MS >= 60000, 'limite folgado para a máquina lenta');
  fs.rmSync(dir, { recursive: true, force: true });
});
t('a ilustração do estilo entra embutida pelo nome; nome desconhecido ou com caminho não entra', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'estilo-'));
  fs.mkdirSync(path.join(dir, 'layouts')); fs.mkdirSync(path.join(dir, 'objetos', 'ilustracao'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'layouts', 'painel.html'), '{{#ilustracaoSvg}}<div class="painel">{{{ilustracaoSvg}}}</div>{{/ilustracaoSvg}}<h2>{{titulo}}</h2>');
  fs.writeFileSync(path.join(dir, 'objetos', 'ilustracao', 'ovo.svg'), '<svg class="gravura"><circle r="4"/></svg>');
  const e = { id: 'x', dir, car: { ...BOM.formatos.carrossel, miolo: ['painel', 'painel'] } };
  const ctx = { indice: 1, total: 5, papel: 'miolo', indiceNoPapel: 0 };
  assert.match(molde.lamina(e, { titulo: 'x', ilustracao: 'ovo' }, ctx, { logo: '' }), /<div class="painel"><svg class="gravura"><circle r="4"\/><\/svg><\/div>/);
  assert.doesNotMatch(molde.lamina(e, { titulo: 'x', ilustracao: 'pera' }, ctx, { logo: '' }), /class="painel"/);
  assert.doesNotMatch(molde.lamina(e, { titulo: 'x', ilustracao: '../../segredo' }, ctx, { logo: '' }), /class="painel"/);
  fs.rmSync(dir, { recursive: true, force: true });
});
t('o recorte da pessoa entra na lâmina como recorteSrc, e a falta dele é acusada', () => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'estilo-'));
  fs.mkdirSync(path.join(dir, 'layouts'));
  fs.writeFileSync(path.join(dir, 'layouts', 'pessoa.html'), '<img class="f" src="{{fotoSrc}}">{{#recorteSrc}}<img class="r" src="{{recorteSrc}}">{{/recorteSrc}}');
  const e = { id: 'x', dir, car: { ...BOM.formatos.carrossel, capa: ['pessoa'] } };
  const foto = '04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/xicara.jpg';
  const ctx = { indice: 0, total: 5, papel: 'capa', indiceNoPapel: 0 };
  assert.match(molde.lamina(e, { foto, recorte: foto }, ctx, { logo: '' }), /class="r" src="file:\/\/\/[^"]+xicara\.jpg"/);
  assert.doesNotMatch(molde.lamina(e, { foto }, ctx, { logo: '' }), /class="r"/);
  fs.rmSync(dir, { recursive: true, force: true });
  assert.deepStrictEqual(molde.arquivosDe({ recorte: 'nao/existe.png' }).map((a) => [a.onde, a.existe]), [['recorte', false]]);
});

// ---------- catálogo ----------
t('o catálogo tem todos os estilos aprovados', () => {
  for (const id of ['contraste', 'papelaria', 'colagem', 'editorial', 'vitrine', 'neon', 'cinema', 'impacto', 'visor', 'recorte', 'caderno', 'adesivo', 'retro', 'bloco', 'circulo', 'faixa', 'palco', 'concreto-acido', 'revista-dominical', 'protagonista', 'luz-de-vela', 'fanzine', 'terra-e-salvia', 'cartilha', 'circuito-neon', 'gravura', 'primeira-pagina']) assert.ok(ESTILOS.includes(id), id);
});
// ---------- kit de identidade ----------
const DOS_REELS = ['vitrine', 'recorte', 'neon', 'cinema', 'impacto', 'caderno', 'visor', 'bloco', 'adesivo', 'circulo', 'retro', 'faixa', 'palco'];
t('todo estilo do catálogo tem kit com regras; os vindos dos Reels têm a tabela vídeo → peça', () => {
  for (const id of ESTILOS) {
    const k = molde.lerEstilo(id).dados.kit;
    assert.ok(k && k.regras.length >= 3, id + ': regras');
    if (DOS_REELS.includes(id)) assert.ok(k.movimento && k.movimento.length >= 3, id + ': movimento');
  }
});
t('calibração: kit com regra vazia ou movimento sem a peça reprova', () => {
  const e = JSON.parse(JSON.stringify(BOM));
  e.kit = { regras: [''] };
  assert.ok(molde.validarEstilo(e, molde.PASTA_LAYOUTS).some((m) => /kit.regras/.test(m)));
  e.kit = { regras: ['x'], movimento: [{ video: 'y' }] };
  assert.ok(molde.validarEstilo(e, molde.PASTA_LAYOUTS).some((m) => /kit.movimento/.test(m)));
});
// ---------- fixados e capa de Reels ----------
const demoDe = (id, f) => JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, id, `demo-${f}.json`), 'utf8'));
for (const id of ESTILOS) {
  const e = molde.lerEstilo(id);
  t(`${id}: capa de Reels monta com o layout de reels.capa, sem navegação, no formato 9:16`, () => {
    const html = molde.laminas(e, demoDe(id, 'reels'), { cores: 'sugestao', formato: 'reels' }).join('\n');
    assert.ok(!/undefined|NaN|\[object Object\]|src=""/.test(html), 'valor quebrado');
    assert.deepStrictEqual([...new Set(atributos(html, 'layout'))], [e.dados.formatos.reels.capa]);
    assert.deepStrictEqual([...new Set(atributos(html, 'formato'))], ['reels']);
    assert.ok(!/nav-(barra|arraste|contador)/.test(html), 'navegação numa peça de uma lâmina só');
  });
  if (e.soReels) {
    t(`${id}: estilo só de capa recusa carrossel e fixados`, () => assert.throws(() => molde.laminas(e, [{ titulo: 'x' }], {}), /só de capa de Reels/));
    continue;
  }
  t(`${id}: os 3 fixados usam apresentação, método e contratar, sem navegação, no formato 3:4`, () => {
    const html = molde.laminas(e, demoDe(id, 'fixados'), { cores: 'sugestao', formato: 'fixados' }).join('\n');
    const fx = e.dados.formatos.fixados;
    assert.deepStrictEqual(atributos(html, 'layout'), [fx.apresentacao, fx.metodo, fx.contratar]);
    assert.deepStrictEqual(atributos(html, 'papel'), ['capa', 'miolo', 'fecho']);
    assert.ok(!/nav-(barra|arraste|contador)/.test(html) && !/undefined|src=""/.test(html));
  });
}
// ---------- post estático de feed (uma imagem) ----------
for (const id of ESTILOS) {
  const e = molde.lerEstilo(id);
  if (e.soReels) { t(`${id}: estilo só de capa de Reels recusa o post estático`, () => assert.throws(() => molde.laminas(e, [{ titulo: 'x' }], { formato: 'post' }), /só de capa de Reels/)); continue; }
  t(`${id}: post estático é uma lâmina só, com o layout de capa e sem navegação`, () => {
    const html = molde.laminas(e, [demo(id)[0]], { cores: 'sugestao', formato: 'post' }).join('\n');
    assert.ok(!/undefined|NaN|\[object Object\]|src=""/.test(html), 'valor quebrado');
    assert.deepStrictEqual(atributos(html, 'layout'), [((e.dados.formatos.post || {}).layout) || e.car.capa[0]]);
    assert.deepStrictEqual(atributos(html, 'formato'), ['post']);
    assert.deepStrictEqual(atributos(html, 'papel'), ['capa']);
    assert.deepStrictEqual(atributos(html, 'total'), ['1']);
    assert.ok(!/nav-(barra|arraste|contador)/.test(html), 'navegação numa peça de uma lâmina só');
  });
}
t('calibração: o post estático recusa mais de uma lâmina e usa o canvas do feed da marca', () => {
  const e = molde.lerEstilo('contraste');
  assert.throws(() => molde.laminas(e, demo('contraste').slice(0, 2), { formato: 'post' }), /post estático é uma imagem só/);
  assert.deepStrictEqual(molde.canvasDoFormato('post', { largura: 1080, altura: 1350 }, { topo: 90, base: 140 }), { canvas: { largura: 1080, altura: 1350 }, seg: { topo: 90, base: 140 } });
});
t('calibração: formatos.post.layout inexistente é apontado pelo validador', () => {
  const e = molde.lerEstilo('contraste');
  const dados = JSON.parse(JSON.stringify(e.dados));
  dados.formatos.post = { layout: 'layout-que-nao-existe' };
  assert.ok(molde.validarEstilo(dados, e.dir).some((m) => /post\.layout/.test(m)));
});
t('calibração: fixados com outra quantidade que 3 e formato desconhecido são recusados', () => {
  const e = molde.lerEstilo('contraste');
  assert.throws(() => molde.laminas(e, demoDe('contraste', 'fixados').slice(0, 2), { formato: 'fixados' }), /fixados são 3/);
  assert.throws(() => molde.laminas(e, demo('contraste'), { formato: 'story' }), /formato desconhecido/);
  assert.deepStrictEqual(molde.canvasDoFormato('reels', { largura: 1080, altura: 1350 }, { topo: 90, base: 140 }), { canvas: { largura: 1080, altura: 1920 }, seg: { topo: 250, base: 400 } });
});
for (const id of ESTILOS) {
  const e = molde.lerEstilo(id);
  if (e.soReels) continue;
  const conteudos = demo(id);
  const lams = molde.laminas(e, conteudos, { cores: 'sugestao' });
  const html = lams.join('\n');
  t(`${id}: monta o demo inteiro sem valor quebrado nem foto vazia`, () => {
    assert.strictEqual(lams.length, conteudos.length);
    assert.ok(!/undefined|NaN|\[object Object\]/.test(html), 'valor quebrado');
    assert.ok(!/src=""/.test(html), 'imagem sem endereço');
    assert.ok(conteudos.length >= e.car.laminas.min && conteudos.length <= e.car.laminas.max, 'número de lâminas fora do declarado');
  });
  t(`${id}: miolo segue o molde declarado (DG-10)`, () => {
    const miolo = atributos(html, 'layout').slice(1, -1);
    if (e.car.molde_do_miolo === 'fixo') assert.strictEqual(new Set(miolo).size, 1);
    else for (let i = 1; i < miolo.length; i++) assert.notStrictEqual(miolo[i], miolo[i - 1], `layout repetido na lâmina ${i + 2}`);
  });
  t(`${id}: fundos dentro da sequência declarada (DG-15)`, () => {
    const usados = new Set(atributos(html, 'fundo'));
    for (const f of usados) assert.ok(e.car.fundos.includes(f), `fundo ${f} fora de ${e.car.fundos}`);
    if (e.car.fundos.length > 1) assert.ok(usados.size > 1, 'a sequência declara alternância, mas só um fundo aparece');
  });
  t(`${id}: navegação só aparece se declarada (F-26)`, () => {
    for (const k of ['barra', 'arraste', 'contador']) assert.strictEqual(html.includes(`nav-${k}`), e.car.navegacao[k], k);
  });
  t(`${id}: o miolo tem elemento visual em toda lâmina de molde fixo (DG-09)`, () => {
    if (e.car.molde_do_miolo !== 'fixo') return;
    lams.slice(1).forEach((l, i) => assert.ok(/class="vis|class="[^"]*vis-objeto|class="adesivo/.test(l), `lâmina ${i + 2} sem elemento visual`));
  });
  t(`${id}: CSS só com papéis e texto acima do piso micro (DG-01)`, () => {
    const piso = 32;
    assert.deepStrictEqual(pxDeTexto(e.css).filter((v) => v < piso), [], 'texto abaixo do piso');
    for (const regra of e.css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').filter((r) => r.includes('{'))) {
      const sel = regra.split('{')[0].trim();
      if (sel) assert.ok(sel.split(',').every((s) => s.includes(`.est-${id}`)), `regra fora de .est-${id}: ${sel}`);
    }
  });
}
t('navegação declarada aparece, e o arraste some no último slide (F-27, F-29)', () => {
  const e = molde.lerEstilo('contraste');
  const com = { ...e, car: { ...e.car, navegacao: { barra: true, arraste: true, contador: true } } };
  const lams = molde.laminas(com, demo('contraste'), { cores: 'sugestao' });
  assert.ok(lams.slice(0, -1).every((l) => l.includes('nav-arraste')));
  assert.ok(!lams[lams.length - 1].includes('nav-arraste'));
  assert.ok(lams[lams.length - 1].includes('width:100%'));
});
t('a base de layouts não traz cor nem fonte de empresa', () => {
  const css = molde.cssBase();
  assert.ok(!/#[0-9a-f]{6}\b/i.test(css), 'hexadecimal na base');
  assert.deepStrictEqual(pxDeTexto(css).filter((v) => v < 32), []);
});

// ---------- estilos próprios da empresa (de outra pasta de estilos) ----------
// Pastas temporárias com as empresas fictícias aurora e boreal; cada estilo próprio é a cópia de um estilo do catálogo, com o
// código trocado, origem "referencias" e o CSS preso ao código novo (o que o agente faz ao criar um estilo das referências).
const TMP_P = fs.mkdtempSync(path.join(require('os').tmpdir(), 'molde-proprios-'));
const pastaDe = (empresa) => path.join(TMP_P, 'empresas', empresa, 'estilos-proprios');
function copiarComoProprio(base, id, pasta, mudarYaml = (y) => y) {
  const para = path.join(pasta, id);
  fs.cpSync(path.join(molde.PASTA_ESTILOS, base), para, { recursive: true });
  const y = fs.readFileSync(path.join(para, 'estilo.yaml'), 'utf8').replace(/^id:.*$/m, `id: ${id}`).replace(/^origem:.*$/m, 'origem: referencias');
  fs.writeFileSync(path.join(para, 'estilo.yaml'), mudarYaml(y));
  const css = path.join(para, 'estilo.css');
  if (fs.existsSync(css)) fs.writeFileSync(css, fs.readFileSync(css, 'utf8').split(`.est-${base}`).join(`.est-${id}`));
  return para;
}
const juncao = (alvo, onde) => fs.symlinkSync(alvo, onde, 'junction');
const ENDERECO = 'ht' + 'tps:' + '//exemplo.invalid/a.png'; // montado em partes: não é endereço de verdade

t('estilo próprio: lerEstilo lê da pasta da empresa; sem pasta continua o catálogo', () => {
  const pasta = pastaDe('aurora');
  const dir = copiarComoProprio('bloco', 'aurora-jornal', pasta, (y) => y.replace(/^nome:.*$/m, 'nome: Jornal da Aurora'));
  const e = molde.lerEstilo('aurora-jornal', { pasta });
  assert.strictEqual(e.dir, dir);
  assert.strictEqual(e.proprio, true);
  assert.strictEqual(e.dados.origem, 'referencias');
  assert.strictEqual(e.dados.nome, 'Jornal da Aurora');
  const html = molde.laminas(e, demo('bloco'), { cores: 'sugestao', logo: '' }).join('\n');
  assert.ok(html.includes('est-aurora-jornal') && !html.includes('est-bloco'), 'a lâmina leva o código do estilo próprio');
  assert.ok(molde.cssDoEstilo(e).includes('.est-aurora-jornal'));
  // o padrão continua o catálogo, e o estilo próprio não existe nele
  assert.strictEqual(molde.lerEstilo('bloco').dir, path.join(molde.PASTA_ESTILOS, 'bloco'));
  assert.strictEqual(molde.lerEstilo('bloco').proprio, undefined);
  assert.throws(() => molde.lerEstilo('aurora-jornal'), /estilo não encontrado/);
  assert.deepStrictEqual(molde.listarEstilos(), ESTILOS, 'a lista do catálogo não muda');
});
t('estilo próprio: todo estilo do catálogo copiado para a pasta da empresa carrega e monta', () => {
  const pasta = path.join(TMP_P, 'copias');
  for (const id of ESTILOS) {
    copiarComoProprio(id, `${id}-meu`, pasta);
    const e = molde.lerEstilo(`${id}-meu`, { pasta });
    const html = molde.laminas(e, demoDe(id, 'reels').slice(0, 1), { cores: 'sugestao', formato: 'reels', logo: '' }).join('\n');
    assert.ok(html.includes(`est-${id}-meu`), id);
  }
  assert.deepStrictEqual(molde.listarEstilos({ pasta }), ESTILOS.map((id) => `${id}-meu`).sort());
});
t('estilo próprio: código fora da regra é recusado antes de ler qualquer arquivo', () => {
  const pasta = pastaDe('aurora');
  copiarComoProprio('bloco', 'aurora-jornal', path.join(TMP_P, 'fora')); // um estilo de verdade fora da pasta pedida
  for (const ruim of ['../fora/aurora-jornal', '..', '.', '', 'Aurora', 'a b', 'a/b', 'a\\b', path.join(TMP_P, 'fora', 'aurora-jornal'), 'C:x', '.oculto', 'a.b', '-a', 'x'.repeat(65), 42, null, undefined]) {
    assert.throws(() => molde.lerEstilo(ruim, { pasta }), /código do estilo próprio/, String(ruim));
  }
});
t('estilo próprio: atalho (junção) para o estilo ou para os layouts de outra empresa é recusado', () => {
  const aurora = pastaDe('aurora');
  const boreal = pastaDe('boreal');
  copiarComoProprio('bloco', 'boreal-neve', boreal);
  juncao(path.join(boreal, 'boreal-neve'), path.join(aurora, 'boreal-neve'));
  assert.throws(() => molde.lerEstilo('boreal-neve', { pasta: aurora }), /atalho/);
  const dir = copiarComoProprio('bloco', 'aurora-atalho', aurora);
  fs.rmSync(path.join(dir, 'layouts'), { recursive: true, force: true });
  juncao(path.join(boreal, 'boreal-neve', 'layouts'), path.join(dir, 'layouts'));
  assert.throws(() => molde.lerEstilo('aurora-atalho', { pasta: aurora }), /atalho/);
  assert.ok(!molde.listarEstilos({ pasta: aurora }).includes('boreal-neve'), 'o atalho não aparece na lista');
  // a pasta de outra empresa, lida pela pasta dela, continua valendo
  assert.strictEqual(molde.lerEstilo('boreal-neve', { pasta: boreal }).dados.id, 'boreal-neve');
  // a pasta de estilos próprios inteira como atalho para a da boreal: recusada (a mesma regra do catálogo e da escolha)
  const cinza = pastaDe('cinza');
  fs.mkdirSync(path.dirname(cinza), { recursive: true });
  juncao(boreal, cinza);
  assert.throws(() => molde.lerEstilo('boreal-neve', { pasta: cinza }), /atalho/);
  assert.deepStrictEqual(molde.listarEstilos({ pasta: cinza }), []);
});
t('estilo próprio: origem diferente de referencias é recusada', () => {
  const pasta = pastaDe('aurora');
  copiarComoProprio('bloco', 'aurora-catalogo', pasta, (y) => y.replace(/^origem:.*$/m, 'origem: catalogo'));
  assert.throws(() => molde.lerEstilo('aurora-catalogo', { pasta }), /origem: referencias/);
});
t('estilo próprio: recurso de fora no CSS, num layout ou num objeto é recusado', () => {
  const pasta = path.join(TMP_P, 'recursos');
  const casos = [
    ['estilo.css', (s) => s + '\n@import "outro.css";', /@import/],
    ['estilo.css', (s) => s + `\n.est-ID .x{background:url("${ENDERECO}")}`, /url\(/],
    ['estilo.css', (s) => s + '\n.est-ID .x{background:url(file:///C:/empresas/boreal/logo.png)}', /url\(/],
    ['estilo.css', (s) => s + '\n.est-ID .x{background:url(//servidor/logo.png)}', /url\(/],
    ['estilo.css', (s) => s + '\n.est-ID .x{background:url(../../boreal/logo.png)}', /url\(/],
    ['estilo.css', (s) => s + '\n.est-ID .x{background:\\75 rl(x.png)}', /barra invertida/],
    ['estilo.css', (s) => s + `\n.est-ID .x{background-image:image-set("${ENDERECO}" 1x)}`, /image-set/],
    ['layouts/capa-bloco.html', (s) => s + '<img src="{{fotoSrc}}" srcset="{{fotoSrc}} 1x, /segredo.png 2x">', /srcset/],
    ['layouts/capa-bloco.html', (s) => s + '<frame>', /<frame>/],
    ['layouts/capa-bloco.html', (s) => s + '<script>fetch("x")</script>', /<script/],
    ['layouts/capa-bloco.html', (s) => s + '<img src="x.png" onerror="alert(1)">', /on\w*=|src=/],
    ['layouts/capa-bloco.html', (s) => s + '<img src="file:///C:/empresas/boreal/foto.jpg">', /src=/],
    ['layouts/capa-bloco.html', (s) => s + `<img src="${ENDERECO}">`, /src=/],
    ['layouts/capa-bloco.html', (s) => s + '<iframe></iframe>', /<iframe/],
    ['layouts/capa-bloco.html', (s) => s + '<a href="&#104;ttp://x">x</a>', /&#|href=/],
    ['layouts/capa-bloco.html', (s) => s + '<div style="background:url(/segredo.png)"></div>', /url\(/],
    ['layouts/capa-bloco.html', (s) => s + '<link rel="stylesheet" href="x.css">', /<link|href=/],
    ['objetos/selo.svg', () => '<svg><script>alert(1)</script></svg>', /<script/],
    ['objetos/selo.svg', () => `<svg><image xlink:href="${ENDERECO}"/></svg>`, /href=/],
    ['objetos/selo.svg', () => '<svg><foreignObject><div></div></foreignObject></svg>', /foreignObject/],
    // correção da revisão: as formas da sonda filtro.js (o endereço do painel, 127.0.0.1, em especial)
    ...((B, H) => [
      ['estilo.css', (s) => s + `\n.est-ID .x{background:${B}u${B}r${B}l(${H})}`, /barra invertida/],
      ['estilo.css', (s) => s + `\n@i${B}mport "${H}";`, /barra invertida/],
      ['layouts/capa-bloco.html', (s) => s + `<style>.x{background:${B}75 rl(${H})}</style>`, /<style>|barra invertida/],
      ['layouts/capa-bloco.html', (s) => s + `<div style="background:url&lpar;${H})"></div>`, /entidade/],
      ['layouts/capa-bloco.html', (s) => s + `<img/src="${H}">`, /src=/],
      ['layouts/capa-bloco.html', (s) => s + `<img\nsrc="${H}">`, /src=/],
      ['layouts/capa-bloco.html', (s) => s + `<table background="${H}"><tr><td></td></tr></table>`, /background=/],
      ['layouts/capa-bloco.html', (s) => s + `<img src="{{nadaaqui}}${H}">`, /src=/],
      ['layouts/capa-bloco.html', (s) => s + `<img src="textura:fita-clara${H}">`, /src=/],
      ['layouts/capa-bloco.html', (s) => s + `<div style="background:url({{nadaaqui}}${H})"></div>`, /url\(/],
      ['layouts/capa-bloco.html', (s) => s + `<svg><image><set attributeName="href" to="${H}"/></image></svg>`, /<set>|<animate>/],
      ['layouts/capa-bloco.html', (s) => s + `<svg><image><animate attributeName="href" values="${H}"/></image></svg>`, /<set>|<animate>/],
      ['layouts/capa-bloco.html', (s) => s + '<div>{{{rodape}}}</div>', /\{\{\{rodape\}\}\}/],
      ['layouts/capa-bloco.html', (s) => s + `<img src="${H}">`, /src=/],
    ])(String.fromCharCode(92), 'ht' + 'tp:' + '//127.0.0.1:8890/empresas/boreal/marca/logo/logo.png'),
  ];
  casos.forEach(([arq, mudar, motivo], i) => {
    const id = `aurora-r${i}`;
    const dir = copiarComoProprio('bloco', id, pasta);
    const alvo = path.join(dir, ...arq.split('/'));
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    const antes = fs.existsSync(alvo) ? fs.readFileSync(alvo, 'utf8') : '';
    fs.writeFileSync(alvo, mudar(antes).split('.est-ID').join(`.est-${id}`));
    assert.throws(() => molde.lerEstilo(id, { pasta }), (e) => motivo.test(e.message) && /não pode/.test(e.message), `${arq} (${motivo}) foi aceito`);
  });
  // o que os estilos do catálogo usam continua valendo: textura, desenho embutido, marcador do molde e âncora
  const id = 'aurora-ok';
  const dir = copiarComoProprio('bloco', id, pasta);
  fs.appendFileSync(path.join(dir, 'layouts', 'capa-bloco.html'), '<img src="textura:fita-clara"><img src="{{fotoSrc}}"><svg><use href="#a"/><rect fill="url(#g)"/></svg>');
  fs.appendFileSync(path.join(dir, 'estilo.css'), `\n.est-${id} .y{background:url("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")}`);
  assert.strictEqual(molde.lerEstilo(id, { pasta }).id, id);
});
t('estilo próprio: letra e parâmetro de letras da prévia só com caracteres simples', () => {
  const pasta = path.join(TMP_P, 'letras');
  copiarComoProprio('bloco', 'aurora-letra', pasta, (y) => y.replace(/^ {2}tipografia: .*$/m, '  tipografia:\n    principal: "Fonte;}body{x"\n    mono: "Fonte Dois"'));
  assert.throws(() => molde.lerEstilo('aurora-letra', { pasta }), /tipografia/);
  copiarComoProprio('bloco', 'aurora-google', pasta, (y) => y.replace(/^( *)google:.*$/m, '$1google: "family=A\\"><b>x"'));
  assert.throws(() => molde.lerEstilo('aurora-google', { pasta }), /google/);
});
t('estilo próprio: listarEstilos da pasta só mostra estilo com código válido, com estilo.yaml e sem atalho', () => {
  const pasta = path.join(TMP_P, 'lista');
  copiarComoProprio('bloco', 'aurora-um', pasta);
  copiarComoProprio('bloco', 'aurora-dois', pasta);
  copiarComoProprio('bloco', 'Aurora_Tres', pasta);
  fs.mkdirSync(path.join(pasta, 'sem-yaml'));
  fs.mkdirSync(path.join(pasta, '_rascunho'));
  fs.writeFileSync(path.join(pasta, '_rascunho', 'estilo.yaml'), 'id: _rascunho');
  juncao(path.join(pasta, 'aurora-um'), path.join(pasta, 'aurora-atalho'));
  assert.deepStrictEqual(molde.listarEstilos({ pasta }), ['aurora-dois', 'aurora-um']);
  assert.deepStrictEqual(molde.listarEstilos({ pasta: path.join(TMP_P, 'nao-existe') }), []);
});
t('o fundo da lâmina só é escuro, claro ou acento (sonda fundo.js): nada entra no atributo', () => {
  const e = molde.lerEstilo('bloco');
  const H = 'ht' + 'tp:' + '//127.0.0.1:8890/x.png';
  for (const ruim of [`escuro" style="background:url(${H})`, 'roxo', 42, ['escuro'], { a: 1 }]) {
    assert.throws(() => molde.laminas(e, [{ titulo: 'x', fundo: ruim }], { cores: 'sugestao', logo: '', embutir: true }), /fundo/, String(ruim));
  }
  for (const bom of ['escuro', 'claro', 'acento']) assert.ok(molde.laminas(e, [{ titulo: 'x', fundo: bom }], { cores: 'sugestao', logo: '' })[0].includes(`data-fundo="${bom}"`));
});
t('nome de layout ou de objeto com caminho nunca sai da pasta do estilo', () => {
  const pasta = path.join(TMP_P, 'nomes');
  copiarComoProprio('bloco', 'aurora-nome', pasta, (y) => y.replace(/capa: \[[^\]]*\]/, 'capa: [../../../fora/capa-bloco]'));
  assert.throws(() => molde.lerEstilo('aurora-nome', { pasta }), /não existe/);
  const e = molde.lerEstilo('bloco');
  const ctx = { indice: 0, total: 5, papel: 'capa', indiceNoPapel: 0 };
  assert.throws(() => molde.lamina(e, { titulo: 'x', layout: '../layouts/capa' }, ctx, { logo: '' }), /layout não encontrado/);
  assert.throws(() => molde.lamina(e, { titulo: 'x', visual: { tipo: '../../papelaria/objetos/caneta' } }, ctx, { logo: '' }), /não tem o objeto/);
});
fs.rmSync(TMP_P, { recursive: true, force: true });

console.log(`\n${n} testes passaram.`);
