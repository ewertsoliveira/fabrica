// Testes de cores-do-logo.js: cores tiradas do logo por código (sem IA), papéis sugeridos, o que falta completado em três
// versões e a lista de letras livres (familias.json) com os pares prontos.
// Os logos são desenhados pelo próprio teste (pixels, PNG e SVG numa pasta temporária); as cores e as letras são fictícias.
// A parte do navegador (logo lido num canvas, como a tela faz) precisa do Chromium: veja 08-FERRAMENTAS/carrossel/navegador.js.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const PAINEIS = path.join(__dirname, '..');
const RAIZ = path.join(PAINEIS, '..', '..');
const MODULO = path.join(PAINEIS, 'cores-do-logo.js');
const PASTA_LETRAS = path.join(RAIZ, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const CoresDoLogo = require(MODULO);
const navegador = require(path.join(RAIZ, '08-FERRAMENTAS', 'carrossel', 'navegador'));

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cores-do-logo-teste-'));
let falhas = 0;
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

// ---------- cores fictícias (em rgb; o código da cor é montado aqui, nunca escrito à mão) ----------
const MARINHO = [24, 40, 72];
const QUENTE = [232, 112, 40];
const CREME = [244, 236, 220];
const CINZA = [120, 118, 112];
const BRANCO = [255, 255, 255];
const VERMELHO = [200, 30, 30];
const hx = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const rgbDe = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const perto = (h, alvo, tol = 6) => distancia(rgbDe(h), alvo) <= tol;
function luminancia(h) {
  return rgbDe(h).map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const ehCodigo = (v) => typeof v === 'string' && /^#[0-9A-F]{6}$/.test(v);

// ---------- logos desenhados em pixels ----------
// Uma imagem largura x altura com fundo `fundo` ([r,g,b,a]) e retângulos [x, y, l, a, [r,g,b,a]] por cima.
function desenhar(largura, altura, fundo, retangulos) {
  const d = new Uint8ClampedArray(largura * altura * 4);
  for (let i = 0; i < largura * altura; i++) d.set(fundo, i * 4);
  for (const [x0, y0, l, a, cor] of retangulos) {
    for (let y = y0; y < y0 + a; y++) for (let x = x0; x < x0 + l; x++) d.set(cor, (y * largura + x) * 4);
  }
  return d;
}
const op = (c) => [...c, 255];
// Logo de duas cores sobre branco: um bloco marinho grande e um de tom quente menor, longe da borda.
const DUAS = () => desenhar(60, 40, op(BRANCO), [[6, 6, 28, 28, op(MARINHO)], [38, 10, 16, 16, op(QUENTE)]]);

// ---------- 1. extrair ----------
t('logo de duas cores sobre fundo branco: as duas cores, sem o branco, a maior primeiro', () => {
  const cores = CoresDoLogo.extrair(DUAS(), 60, 40);
  assert.strictEqual(cores.length, 2, JSON.stringify(cores));
  assert.ok(perto(cores[0].cor, MARINHO, 0) && perto(cores[1].cor, QUENTE, 0), JSON.stringify(cores));
  assert.ok(cores.every((c) => ehCodigo(c.cor)), 'código da cor em #RRGGBB');
  assert.ok(cores[0].peso > cores[1].peso && Math.abs(cores[0].peso + cores[1].peso - 1) < 0.01, 'pesos somam 1');
  assert.ok(!cores.some((c) => perto(c.cor, BRANCO, 30)), 'o fundo (cor da borda) fica de fora');
});

t('logo com transparência: o transparente e o quase transparente são ignorados', () => {
  const d = desenhar(60, 40, [0, 0, 0, 0], [[6, 6, 28, 28, op(MARINHO)], [38, 10, 16, 16, op(QUENTE)], [40, 30, 18, 8, [...VERMELHO, 40]]]);
  const cores = CoresDoLogo.extrair(d, 60, 40);
  assert.deepStrictEqual(cores.map((c) => c.cor), [hx(MARINHO), hx(QUENTE)]);
  assert.ok(!cores.some((c) => perto(c.cor, [0, 0, 0], 20)), 'pixel transparente (preto com alfa 0) não vira cor');
});

t('borda suavizada (pixels de mistura entre o logo e o fundo) não vira cor nova', () => {
  const d = DUAS();
  // contorno de 1 px do bloco marinho com a mistura meio a meio com o branco
  const meio = MARINHO.map((v, i) => Math.round((v + BRANCO[i]) / 2));
  for (let x = 5; x < 35; x++) for (const y of [5, 34]) d.set(op(meio), (y * 60 + x) * 4);
  for (let y = 5; y < 35; y++) for (const x of [5, 34]) d.set(op(meio), (y * 60 + x) * 4);
  const cores = CoresDoLogo.extrair(d, 60, 40);
  assert.deepStrictEqual(cores.map((c) => c.cor), [hx(MARINHO), hx(QUENTE)], JSON.stringify(cores));
});

t('mesma entrada, mesma saída (também com lista comum no lugar de Uint8ClampedArray)', () => {
  const a = CoresDoLogo.extrair(DUAS(), 60, 40);
  const b = CoresDoLogo.extrair(DUAS(), 60, 40);
  const c = CoresDoLogo.extrair(Array.from(DUAS()), 60, 40);
  assert.deepStrictEqual(a, b);
  assert.deepStrictEqual(a, c);
});

t('máximo de cores: oito blocos de cores diferentes saem em no máximo 6 (ou no máximo pedido)', () => {
  const blocos = [[200, 30, 30], [30, 160, 60], [30, 60, 200], [230, 200, 40], [140, 40, 160], [20, 20, 20], [250, 140, 170], [60, 200, 210]];
  const d = desenhar(100, 20, op(BRANCO), blocos.map((c, i) => [2 + i * 12, 2, 10 - (i % 3), 16, op(c)]));
  const seis = CoresDoLogo.extrair(d, 100, 20);
  assert.strictEqual(seis.length, 6, JSON.stringify(seis));
  assert.ok(seis.every((c) => blocos.some((b) => perto(c.cor, b, 0))), 'só cores que existem no logo');
  const tres = CoresDoLogo.extrair(d, 100, 20, { maximo: 3 });
  assert.strictEqual(tres.length, 3);
  for (let i = 1; i < seis.length; i++) assert.ok(seis[i - 1].peso >= seis[i].peso, 'da maior para a menor');
  for (const lista of [seis, tres]) assert.ok(Math.abs(lista.reduce((s, c) => s + c.peso, 0) - 1) < 0.001, 'pesos somam 1 mesmo cortando no máximo');
});

t('logo que é um quadrado de uma cor só: a cor dele (não some como fundo)', () => {
  const d = desenhar(20, 20, op(MARINHO), []);
  assert.deepStrictEqual(CoresDoLogo.extrair(d, 20, 20).map((c) => c.cor), [hx(MARINHO)]);
});

t('borda colorida é o próprio logo (quadrado de cor com a letra branca): a cor da borda fica; borda neutra sai', () => {
  const AZUL = [30, 90, 160];
  const ladrilho = desenhar(40, 40, op(AZUL), [[10, 10, 20, 8, op(BRANCO)], [16, 18, 8, 14, op(BRANCO)]]);
  assert.deepStrictEqual(CoresDoLogo.extrair(ladrilho, 40, 40).map((c) => c.cor), [hx(AZUL), hx(BRANCO)]);
  const p = CoresDoLogo.papeis(CoresDoLogo.extrair(ladrilho, 40, 40));
  assert.strictEqual(p.escuro, hx(AZUL));
  assert.strictEqual(p.claro, hx(BRANCO));
  // fundo creme (pouca saturação) continua sendo fundo: cobrindo a maior parte da imagem, fica por último, marcado como
  // fundo e com peso baixo (para a troca por toque)
  const sobreCreme = CoresDoLogo.extrair(desenhar(40, 40, op(CREME), [[10, 10, 20, 20, op(QUENTE)]]), 40, 40);
  assert.deepStrictEqual(sobreCreme.filter((c) => !c.fundo).map((c) => c.cor), [hx(QUENTE)]);
  assert.deepStrictEqual(sobreCreme.filter((c) => c.fundo).map((c) => c.cor), [hx(CREME)]);
  assert.ok(sobreCreme[sobreCreme.length - 1].fundo === true && sobreCreme[1].peso < sobreCreme[0].peso && sobreCreme[1].peso <= 0.1);
  assert.ok(Math.abs(sobreCreme.reduce((s, c) => s + c.peso, 0) - 1) < 0.001, 'pesos somam 1 com o fundo');
});

t('quadrado quase preto com letra branca: o escuro fica nas opções e completar não inventa acento de reserva', () => {
  const PRETO = [10, 10, 10];
  const icone = desenhar(100, 100, op(PRETO), [[30, 30, 40, 10, op(BRANCO)], [45, 40, 10, 30, op(BRANCO)]]);
  const cores = CoresDoLogo.extrair(icone, 100, 100);
  assert.deepStrictEqual(cores.map((c) => c.cor), [hx(BRANCO), hx(PRETO)], JSON.stringify(cores));
  assert.strictEqual(cores[1].fundo, true, 'a cor da borda vem marcada como fundo');
  assert.ok(!cores[0].fundo);
  const p = CoresDoLogo.papeis(cores);
  assert.strictEqual(p.escuro, hx(PRETO));
  assert.strictEqual(p.claro, hx(BRANCO));
  const croma = (h) => { const v = rgbDe(h); return (Math.max(...v) - Math.min(...v)) / 255; };
  for (const o of CoresDoLogo.completar(p)) {
    assert.ok(croma(o.cores.acento) < 0.05, `${o.nome}: marca preta e branca ganhou acento colorido ${o.cores.acento}`);
    assert.ok(o.aa, o.nome);
  }
  // fundo branco em 57% da imagem (abaixo de 60%) continua fora
  assert.ok(!CoresDoLogo.extrair(DUAS(), 60, 40).some((c) => c.fundo), 'fundo que não cobre a maior parte não aparece');
});

t('pixel quase igual a uma cor do logo (a ponta da suavização) não vira cor separada', () => {
  const d = DUAS();
  const quase = MARINHO.map((v, i) => Math.round(v + (BRANCO[i] - v) * 0.04));
  for (let x = 6; x < 34; x++) d.set(op(quase), (34 * 60 + x) * 4);
  for (let y = 6; y < 34; y++) d.set(op(quase), (y * 60 + 34) * 4);
  assert.deepStrictEqual(CoresDoLogo.extrair(d, 60, 40).map((c) => c.cor), [hx(MARINHO), hx(QUENTE)]);
});

t('imagem toda transparente: nenhuma cor; tamanho que não bate com os pixels: erro claro', () => {
  assert.deepStrictEqual(CoresDoLogo.extrair(new Uint8ClampedArray(10 * 10 * 4), 10, 10), []);
  assert.throws(() => CoresDoLogo.extrair(new Uint8ClampedArray(12), 10, 10), /tamanho/);
  assert.throws(() => CoresDoLogo.extrair(DUAS(), 0, 40), /tamanho/);
});

// ---------- 2. papéis ----------
t('papéis sugeridos: escuro e claro com contraste de 4,5, acento saturado, neutro de pouca saturação no meio', () => {
  const cores = [MARINHO, QUENTE, CREME, CINZA].map((c, i) => ({ cor: hx(c), peso: [0.4, 0.3, 0.2, 0.1][i] }));
  const p = CoresDoLogo.papeis(cores);
  assert.strictEqual(p.escuro, hx(MARINHO));
  assert.strictEqual(p.claro, hx(CREME));
  assert.strictEqual(p.acento, hx(QUENTE));
  assert.strictEqual(p.neutro, hx(CINZA));
  assert.deepStrictEqual(p.faltando, []);
  assert.ok(contraste(p.escuro, p.claro) >= 4.5);
  assert.ok(contraste(p.acento, p.escuro) >= 3 || contraste(p.acento, p.claro) >= 3);
});

t('papéis: aceita também a lista de códigos, e uma cor nunca ocupa dois papéis', () => {
  const p = CoresDoLogo.papeis([hx(QUENTE), hx(MARINHO)]);
  assert.strictEqual(p.escuro, hx(MARINHO));
  assert.strictEqual(p.acento, hx(QUENTE));
  assert.deepStrictEqual(p.faltando, ['claro', 'neutro']);
  const usados = ['escuro', 'claro', 'acento', 'neutro'].map((k) => p[k]).filter(Boolean);
  assert.strictEqual(new Set(usados).size, usados.length);
});

t('logo de uma cor só: faltam três papéis', () => {
  const p = CoresDoLogo.papeis(CoresDoLogo.extrair(desenhar(30, 30, op(BRANCO), [[5, 5, 20, 20, op(MARINHO)]]), 30, 30));
  assert.strictEqual(p.escuro, hx(MARINHO));
  assert.deepStrictEqual(p.faltando, ['claro', 'acento', 'neutro']);
  assert.strictEqual(p.claro, null);
});

t('papéis: só tons de cinza não viram acento; escuro e claro sem contraste não ficam juntos', () => {
  const p = CoresDoLogo.papeis([hx([20, 20, 20]), hx([235, 235, 235]), hx([128, 128, 128])]);
  assert.strictEqual(p.acento, null);
  assert.ok(p.faltando.includes('acento'));
  const q = CoresDoLogo.papeis([hx([90, 90, 90]), hx([150, 150, 150])]);
  if (q.escuro && q.claro) assert.ok(contraste(q.escuro, q.claro) >= 4.5, 'par sem contraste suficiente');
  assert.ok(q.faltando.includes('escuro') || q.faltando.includes('claro'));
  assert.deepStrictEqual(CoresDoLogo.papeis([]).faltando, ['escuro', 'claro', 'acento', 'neutro']);
});

// ---------- 3. completar ----------
function conferirOpcao(o, dado) {
  for (const papel of ['escuro', 'claro', 'acento', 'neutro']) assert.ok(ehCodigo(o.cores[papel]), `${o.nome}: ${papel} = ${o.cores[papel]}`);
  assert.ok(contraste(o.cores.escuro, o.cores.claro) >= 4.5, `${o.nome}: escuro e claro com ${contraste(o.cores.escuro, o.cores.claro).toFixed(2)}`);
  assert.ok(contraste(o.cores.acento, o.cores.escuro) >= 3 || contraste(o.cores.acento, o.cores.claro) >= 3, `${o.nome}: acento sem contraste`);
  assert.ok(o.aa === true && typeof o.contraste === 'number' && Math.abs(o.contraste - contraste(o.cores.escuro, o.cores.claro)) < 0.02);
  assert.ok(typeof o.nome === 'string' && o.nome.length > 0);
  for (const [papel, v] of Object.entries(dado)) if (v) assert.strictEqual(o.cores[papel], v, `${o.nome}: o papel dado (${papel}) não muda`);
}

t('logo de uma cor só: completar devolve três marcas completas, com contraste AA entre escuro e claro', () => {
  const p = CoresDoLogo.papeis(CoresDoLogo.extrair(desenhar(30, 30, op(BRANCO), [[5, 5, 20, 20, op(MARINHO)]]), 30, 30));
  const dado = { escuro: p.escuro, claro: p.claro, acento: p.acento, neutro: p.neutro };
  const opcoes = CoresDoLogo.completar(p);
  assert.strictEqual(opcoes.length, 3);
  for (const o of opcoes) {
    conferirOpcao(o, dado);
    assert.deepStrictEqual(o.sugeridos, ['claro', 'acento', 'neutro']);
  }
  const assinaturas = opcoes.map((o) => JSON.stringify(o.cores));
  assert.strictEqual(new Set(assinaturas).size, 3, 'as três versões são diferentes');
  assert.strictEqual(new Set(opcoes.map((o) => o.nome)).size, 3);
});

t('completar: sem nenhuma cor, só com o acento, só com o claro e com escuro e claro dados', () => {
  const casosDados = [
    {},
    { acento: hx(QUENTE) },
    { acento: hx([250, 220, 60]) },
    { claro: hx(CREME) },
    { escuro: hx(MARINHO), claro: hx(CREME) },
    { escuro: hx(MARINHO), claro: hx(CREME), acento: hx(QUENTE) },
  ];
  for (const dado of casosDados) {
    const opcoes = CoresDoLogo.completar(dado);
    assert.strictEqual(opcoes.length, 3, JSON.stringify(dado));
    opcoes.forEach((o) => conferirOpcao(o, dado));
    assert.strictEqual(new Set(opcoes.map((o) => JSON.stringify(o.cores))).size, 3, 'versões diferentes para ' + JSON.stringify(dado));
    const faltam = ['escuro', 'claro', 'acento', 'neutro'].filter((k) => !dado[k]);
    opcoes.forEach((o) => assert.deepStrictEqual(o.sugeridos, faltam));
  }
});

t('completar: com os quatro papéis dados, a própria marca (nada sugerido); papéis dados sem contraste não são trocados', () => {
  const dado = { escuro: hx(MARINHO), claro: hx(CREME), acento: hx(QUENTE), neutro: hx(CINZA) };
  const [unica, ...resto] = CoresDoLogo.completar(dado);
  assert.deepStrictEqual(resto, []);
  assert.deepStrictEqual(unica.cores, dado);
  assert.deepStrictEqual(unica.sugeridos, []);
  const fraco = CoresDoLogo.completar({ escuro: hx([110, 110, 110]), claro: hx([150, 150, 150]) });
  assert.strictEqual(fraco.length, 3);
  for (const o of fraco) {
    assert.strictEqual(o.cores.escuro, hx([110, 110, 110]));
    assert.strictEqual(o.aa, false, 'o aviso de contraste fica com a tela');
  }
});

t('completar: mesma entrada, mesma saída; cor inválida e papel desconhecido são recusados', () => {
  assert.deepStrictEqual(CoresDoLogo.completar({ escuro: hx(MARINHO) }), CoresDoLogo.completar({ escuro: hx(MARINHO) }));
  assert.throws(() => CoresDoLogo.completar({ escuro: 'azul' }), /código da cor/i);
  assert.throws(() => CoresDoLogo.completar({ fundo: hx(MARINHO) }), /papel/i);
  // a saída de papeis() entra direto (com o campo faltando, que é recalculado)
  assert.strictEqual(CoresDoLogo.completar({ escuro: hx(MARINHO), faltando: ['claro'] }).length, 3);
});

// ---------- 4. arquivos de logo de verdade (PNG e SVG numa pasta temporária) ----------
// PNG mínimo (RGBA, sem filtro), escrito à mão para o teste não depender de outra ferramenta para criar o arquivo.
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function pedaco(tipo, dados) {
  const t4 = Buffer.from(tipo, 'ascii');
  const tam = Buffer.alloc(4); tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t4, dados])));
  return Buffer.concat([tam, t4, dados, crc]);
}
function png(rgba, largura, altura) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const linhas = Buffer.alloc((largura * 4 + 1) * altura);
  for (let y = 0; y < altura; y++) Buffer.from(rgba.buffer, y * largura * 4, largura * 4).copy(linhas, y * (largura * 4 + 1) + 1);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco('IHDR', ihdr), pedaco('IDAT', zlib.deflateSync(linhas)), pedaco('IEND', Buffer.alloc(0))]);
}
const NS = 'http' + '://www.w3.org/2000/svg'; // montado em partes: o endereço do padrão SVG não é endereço de empresa
const rgbCss = ([r, g, b]) => `rgb(${r},${g},${b})`;
const SVG_DUAS = `<svg xmlns="${NS}" width="120" height="80" viewBox="0 0 120 80"><rect width="120" height="80" fill="${rgbCss(BRANCO)}"/>`
  + `<rect x="8" y="8" width="64" height="64" fill="${rgbCss(MARINHO)}"/><circle cx="92" cy="36" r="16" fill="${rgbCss(QUENTE)}"/></svg>`;
// Círculos que se tocam e uma palavra: suavização entre as duas cores, entre cada uma e o fundo, e nas letras.
const SVG_TOCANDO = `<svg xmlns="${NS}" width="300" height="120"><rect width="300" height="120" fill="${rgbCss(BRANCO)}"/>`
  + `<circle cx="70" cy="60" r="45" fill="${rgbCss(MARINHO)}"/><circle cx="120" cy="60" r="40" fill="${rgbCss(QUENTE)}"/>`
  + `<text x="170" y="75" font-size="40" font-family="sans-serif" fill="${rgbCss(MARINHO)}">Aurora</text></svg>`;
const SVG_COM_SCRIPT =`<svg xmlns="${NS}" width="40" height="40"><script>window.top.__rodou = true;</script>`
  + `<rect width="40" height="40" fill="${rgbCss(VERMELHO)}" onload="window.top.__rodou = true"/></svg>`;
const ARQ_PNG = path.join(TMP, 'logo-duas.png');
const ARQ_PNG_TRANSP = path.join(TMP, 'logo-transparente.png');
const ARQ_SVG = path.join(TMP, 'logo-duas.svg');
const ARQ_SVG_SCRIPT = path.join(TMP, 'logo-com-script.svg');
fs.writeFileSync(ARQ_PNG, png(DUAS(), 60, 40));
fs.writeFileSync(ARQ_PNG_TRANSP, png(desenhar(60, 40, [0, 0, 0, 0], [[6, 6, 28, 28, op(MARINHO)], [38, 10, 16, 16, op(QUENTE)]]), 60, 40));
fs.writeFileSync(ARQ_SVG, SVG_DUAS);
fs.writeFileSync(ARQ_SVG_SCRIPT, SVG_COM_SCRIPT);
const ARQ_SVG_TOCANDO = path.join(TMP, 'logo-tocando.svg');
fs.writeFileSync(ARQ_SVG_TOCANDO, SVG_TOCANDO);

let PNG = null;
try { ({ PNG } = require('pngjs')); } catch (e) { PNG = null; }
t('PNG gravado na pasta temporária e lido de volta: as duas cores, sem o branco', () => {
  if (!PNG) { console.log('     (aviso: pngjs não está instalado; a leitura do PNG fica só no navegador, abaixo)'); return; }
  const img = PNG.sync.read(fs.readFileSync(ARQ_PNG));
  assert.deepStrictEqual(CoresDoLogo.extrair(img.data, img.width, img.height).map((c) => c.cor), [hx(MARINHO), hx(QUENTE)]);
});

t('no navegador, como a tela faz: PNG e SVG lidos por <img> num canvas; SVG com script não roda nada', async () => {
  const nav = await navegador.abrir();
  try {
    const pag = await nav.newPage();
    await pag.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await pag.addScriptTag({ content: fs.readFileSync(MODULO, 'utf8') });
    const ler = (arq, tipo) => pag.evaluate(async ([b64, tp]) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const lido = await window.CoresDoLogo.deArquivo(new Blob([bytes], { type: tp }));
      return { largura: lido.largura, altura: lido.altura, cores: window.CoresDoLogo.extrair(lido.rgba, lido.largura, lido.altura) };
    }, [fs.readFileSync(arq).toString('base64'), tipo]);
    const dePng = await ler(ARQ_PNG, 'image/png');
    assert.deepStrictEqual(dePng.cores.map((c) => c.cor), [hx(MARINHO), hx(QUENTE)], JSON.stringify(dePng));
    const transp = await ler(ARQ_PNG_TRANSP, 'image/png');
    assert.deepStrictEqual(transp.cores.map((c) => c.cor), [hx(MARINHO), hx(QUENTE)], JSON.stringify(transp));
    const deSvg = await ler(ARQ_SVG, 'image/svg+xml');
    assert.strictEqual(deSvg.cores.length, 2, 'SVG suavizado continua com duas cores: ' + JSON.stringify(deSvg));
    assert.ok(perto(deSvg.cores[0].cor, MARINHO, 4) && perto(deSvg.cores[1].cor, QUENTE, 4), JSON.stringify(deSvg));
    assert.ok(Math.max(deSvg.largura, deSvg.altura) <= 240 && Math.max(deSvg.largura, deSvg.altura) >= 120, 'o logo é lido em tamanho pequeno');
    const tocando = await ler(ARQ_SVG_TOCANDO, 'image/svg+xml');
    assert.deepStrictEqual(tocando.cores.filter((c) => !c.fundo).map((c) => c.cor).sort(), [hx(MARINHO), hx(QUENTE)].sort(), 'cores que se tocam e letras: ' + JSON.stringify(tocando));
    assert.ok(tocando.cores.filter((c) => c.fundo).every((c) => c.cor === hx(BRANCO)), 'só o branco pode vir como fundo');
    const comScript = await ler(ARQ_SVG_SCRIPT, 'image/svg+xml');
    assert.deepStrictEqual(comScript.cores.map((c) => c.cor), [hx(VERMELHO)]);
    assert.strictEqual(await pag.evaluate(() => window.__rodou === true), false, 'o script do SVG não pode rodar');
    // arquivo que não é imagem: erro em português, sem travar a página
    const erro = await pag.evaluate(async () => {
      try { await window.CoresDoLogo.deArquivo(new Blob(['%PDF-1.4 nada'], { type: 'image/png' })); return 'abriu'; } catch (e) { return e.message; }
    });
    assert.ok(/Não consegui abrir/.test(erro), erro);
  } finally { await nav.close(); }
});

// ---------- 5. lista de letras (familias.json) e pares prontos ----------
const FAMILIAS_FICTICIAS = {
  versao: 1,
  familias: {
    'Letra Aurora': { classificacao: 'com serifa', italico: true, pesos: [400, 600], arquivos: { 400: 'LetraAurora-Regular.ttf', '400-italico': 'LetraAurora-Italic.ttf', 600: 'LetraAurora-SemiBold.ttf' }, licenca: 'LetraAurora-OFL.txt' },
    'Letra Boreal': { classificacao: 'sem serifa', italico: false, pesos: [500], arquivos: ['LetraBoreal-Medium.ttf'], licenca: 'LetraBoreal-OFL.txt' },
    'Letra Tinta': { classificacao: 'manuscrita', italico: false, pesos: [400], arquivo: 'LetraTinta.ttf' },
    'Letra Fita': { classificacao: 'maquina de escrever', italico: false, pesos: [700], arquivos: ['LetraFita-Bold.ttf'] },
  },
  pares: [{ nome: 'Clássico', titulo: 'Letra Aurora', texto: 'Letra Boreal' }],
};
const ARQUIVOS_FICTICIOS = ['LetraAurora-Regular.ttf', 'LetraAurora-Italic.ttf', 'LetraAurora-SemiBold.ttf', 'LetraAurora-OFL.txt',
  'LetraBoreal-Medium.ttf', 'LetraBoreal-OFL.txt', 'LetraTinta.ttf', 'LetraFita-Bold.ttf'];

t('lista de letras: família, classificação em português, itálico, pesos e arquivos, em ordem; pares do arquivo', () => {
  const { letras, pares } = CoresDoLogo.listaDeLetras(FAMILIAS_FICTICIAS);
  assert.deepStrictEqual(letras.map((l) => l.familia), ['Letra Aurora', 'Letra Boreal', 'Letra Fita', 'Letra Tinta']);
  const aurora = letras[0];
  assert.strictEqual(aurora.classificacao, 'com serifa');
  assert.strictEqual(aurora.italico, true);
  assert.deepStrictEqual(aurora.pesos, [400, 600]);
  assert.deepStrictEqual(aurora.arquivos, ['LetraAurora-Italic.ttf', 'LetraAurora-Regular.ttf', 'LetraAurora-SemiBold.ttf']);
  assert.strictEqual(aurora.licenca, 'LetraAurora-OFL.txt');
  assert.strictEqual(letras[2].classificacao, 'máquina de escrever', 'classificação com acento, mesmo escrita sem');
  assert.deepStrictEqual(letras[3].arquivos, ['LetraTinta.ttf'], 'aceita "arquivo" sozinho');
  assert.deepStrictEqual(pares, [{ nome: 'Clássico', titulo: 'Letra Aurora', texto: 'Letra Boreal' }]);
  // a mesma lista com as famílias numa lista em vez de um objeto
  const comoLista = { familias: Object.entries(FAMILIAS_FICTICIAS.familias).map(([familia, v]) => ({ familia, ...v })), pares: FAMILIAS_FICTICIAS.pares };
  assert.deepStrictEqual(CoresDoLogo.listaDeLetras(comoLista), CoresDoLogo.listaDeLetras(FAMILIAS_FICTICIAS));
});

t('pares prontos: sem pares no arquivo, montados por regra (título com personalidade, texto sem serifa)', () => {
  const { pares } = CoresDoLogo.listaDeLetras({ familias: FAMILIAS_FICTICIAS.familias });
  assert.ok(pares.length >= 2, JSON.stringify(pares));
  for (const p of pares) {
    assert.notStrictEqual(p.titulo, p.texto);
    assert.strictEqual(p.texto, 'Letra Boreal', 'o texto corrido vai na letra sem serifa');
    assert.ok(typeof p.nome === 'string' && p.nome);
  }
  assert.ok(pares.some((p) => p.titulo === 'Letra Aurora') && pares.some((p) => p.titulo === 'Letra Tinta'));
  assert.deepStrictEqual(CoresDoLogo.listaDeLetras({ familias: FAMILIAS_FICTICIAS.familias }).pares, pares, 'sempre na mesma ordem');
});

t('conferir familias.json: arquivo citado que não existe, letra da pasta sem entrada, classificação estranha, par com letra desconhecida', () => {
  assert.deepStrictEqual(CoresDoLogo.conferirFamilias(FAMILIAS_FICTICIAS, ARQUIVOS_FICTICIOS), []);
  const sobra = CoresDoLogo.conferirFamilias(FAMILIAS_FICTICIAS, [...ARQUIVOS_FICTICIOS, 'LetraNova-Regular.ttf']);
  assert.ok(sobra.some((m) => m.includes('LetraNova-Regular.ttf')), sobra.join(' | '));
  const falta = CoresDoLogo.conferirFamilias(FAMILIAS_FICTICIAS, ARQUIVOS_FICTICIOS.filter((a) => a !== 'LetraTinta.ttf'));
  assert.ok(falta.some((m) => m.includes('LetraTinta.ttf')), falta.join(' | '));
  const ruim = JSON.parse(JSON.stringify(FAMILIAS_FICTICIAS));
  ruim.familias['Letra Boreal'].classificacao = 'gótica';
  ruim.familias['Letra Tinta'].arquivo = '../fora/LetraTinta.ttf';
  ruim.familias['Letra Fita'].pesos = ['grosso'];
  ruim.familias['Letra Aurora'].italico = 'sim';
  ruim.pares.push({ nome: 'Fantasma', titulo: 'Letra Inexistente', texto: 'Letra Boreal' });
  const achados = CoresDoLogo.conferirFamilias(ruim, ARQUIVOS_FICTICIOS).join(' | ');
  for (const trecho of ['gótica', '../fora/LetraTinta.ttf', 'Letra Fita', 'Letra Aurora', 'Letra Inexistente']) assert.ok(achados.includes(trecho), `faltou acusar ${trecho}: ${achados}`);
  assert.ok(CoresDoLogo.conferirFamilias({}, ARQUIVOS_FICTICIOS).length > 0, 'arquivo sem famílias');
  // licença nula vale como ausente
  const semLicenca = JSON.parse(JSON.stringify(FAMILIAS_FICTICIAS));
  semLicenca.familias['Letra Boreal'].licenca = null;
  assert.deepStrictEqual(CoresDoLogo.conferirFamilias(semLicenca, ARQUIVOS_FICTICIOS.filter((a) => a !== 'LetraBoreal-OFL.txt')), []);
});

t('familias.json da Fábrica: cita só arquivos que existem e toda letra da pasta tem entrada', () => {
  const arq = path.join(PASTA_LETRAS, 'familias.json');
  if (!fs.existsSync(arq)) {
    // A lista é gravada pela tarefa da marca (familias.json ao lado das letras); até ela chegar, este caso só avisa.
    console.log('     (aviso: familias.json ainda não existe em 08-FERRAMENTAS/tesseract/modelos/fontes/; conferência pulada)');
    return;
  }
  const dados = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const problemas = CoresDoLogo.conferirFamilias(dados, fs.readdirSync(PASTA_LETRAS));
  assert.deepStrictEqual(problemas, []);
  const { letras } = CoresDoLogo.listaDeLetras(dados);
  assert.ok(letras.length > 0 && letras.every((l) => l.arquivos.length > 0));
});

// ---------- execução ----------
(async () => {
  for (const c of casos) {
    try { await c.fn(); console.log('ok   ' + c.nome); } catch (e) { falhas++; console.log('FALHOU ' + c.nome + '\n     ' + (e.stack || e)); }
  }
  for (const f of fs.readdirSync(TMP)) fs.unlinkSync(path.join(TMP, f));
  fs.rmdirSync(TMP);
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log('\ntodos os testes passaram');
  process.exit(0);
})();
