#!/usr/bin/env node
// Testes do bloco cartao-cta: o tamanho do logo é lido conforme o tipo do arquivo (PNG, JPG, WebP ou SVG, os que o painel
// aceita como logo), pelo conteúdo e não pela extensão; o logo entra no cartão com 64 px no lado maior.
// Rode: node 08-FERRAMENTAS/tesseract/blocos-motion/cartao-cta.test.js   (sem Tesseract: o cartão é montado num quadro de mentira)
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const cta = require('./cartao-cta');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cartao-cta-'));
const RAIZ = path.join(__dirname, '..', '..', '..');
let n = 0;
let falhas = 0;
const t = (nome, fn) => { try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); } };

// ---------- cabeçalhos montados à mão (só o que o leitor precisa, com medidas conhecidas) ----------
function png(l, a) {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12, 'latin1'); b.writeUInt32BE(l, 16); b.writeUInt32BE(a, 20);
  return b;
}
// JPEG: SOI, um APP0 e um APP1 antes do quadro (como as câmeras gravam), depois o SOF pedido (C0 comum, C2 progressivo).
function jpeg(l, a, sof = 0xc0) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x08]), Buffer.from('Exif\0\0', 'latin1')]);
  const sofSeg = Buffer.from([0xff, sof, 0x00, 0x11, 0x08, a >> 8, a & 0xff, l >> 8, l & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, app1, sofSeg, Buffer.from([0xff, 0xd9])]);
}
const riff = (pedaco) => { const h = Buffer.alloc(12); h.write('RIFF', 0, 'latin1'); h.writeUInt32LE(4 + pedaco.length, 4); h.write('WEBP', 8, 'latin1'); return Buffer.concat([h, pedaco]); };
const chunk = (nome, dados) => { const h = Buffer.alloc(8); h.write(nome, 0, 'latin1'); h.writeUInt32LE(dados.length, 4); return Buffer.concat([h, dados]); };
function webpVP8(l, a) {
  const d = Buffer.alloc(10);
  d[0] = 0x90; d[1] = 0xd0; d[2] = 0x05; d[3] = 0x9d; d[4] = 0x01; d[5] = 0x2a; d.writeUInt16LE(l & 0x3fff, 6); d.writeUInt16LE(a & 0x3fff, 8);
  return riff(chunk('VP8 ', d));
}
function webpVP8L(l, a) {
  const d = Buffer.alloc(5);
  d[0] = 0x2f;
  const v = ((l - 1) & 0x3fff) | (((a - 1) & 0x3fff) << 14);
  d.writeUInt32LE(v >>> 0, 1);
  return riff(chunk('VP8L', d));
}
function webpVP8X(l, a) {
  const d = Buffer.alloc(10);
  d[0] = 0x10; // com transparência
  d.writeUIntLE(l - 1, 4, 3); d.writeUIntLE(a - 1, 7, 3);
  return riff(chunk('VP8X', d));
}
const XMLNS = ['ht', 'tp:', '//www.w3.org/2000/svg'].join(''); // montado em partes: sem endereço solto no teste
const svg = (atributos) => Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n<svg xmlns="${XMLNS}" ${atributos}><rect width="10" height="10"/></svg>\n`, 'utf8');

const CASOS = [
  ['PNG', png(512, 256), [512, 256]],
  ['JPG comum', jpeg(800, 600), [800, 600]],
  ['JPG progressivo', jpeg(300, 1200, 0xc2), [300, 1200]],
  ['WebP com perdas (VP8)', webpVP8(640, 480), [640, 480]],
  ['WebP sem perdas (VP8L)', webpVP8L(1000, 250), [1000, 250]],
  ['WebP estendido (VP8X)', webpVP8X(900, 900), [900, 900]],
  ['SVG com largura e altura', svg('width="240" height="80"'), [240, 80]],
  ['SVG com px e decimais', svg('width="120.5px" height="60px" viewBox="0 0 10 5"'), [121, 60]],
  ['SVG só com viewBox', svg('viewBox="0 0 300 100"'), [300, 100]],
  ['SVG com largura em % (vale o viewBox)', svg('width="100%" height="100%" viewBox="0 0 50 200"'), [50, 200]],
];

t('tamanhoDaImagem lê o tamanho de PNG, JPG, WebP e SVG pelo conteúdo', () => {
  for (const [nome, buf, esperado] of CASOS) assert.deepStrictEqual(cta.tamanhoDaImagem(buf), esperado, nome);
});

t('a extensão não decide: um JPG chamado de .png é lido como JPG', () => {
  const arq = path.join(TMP, 'logo-que-mente.png');
  fs.writeFileSync(arq, jpeg(400, 100));
  assert.deepStrictEqual(cta.tamanhoDaImagem(fs.readFileSync(arq)), [400, 100]);
});

t('arquivo que não é imagem (ou SVG sem medida nenhuma) dá erro claro, nunca um tamanho inventado', () => {
  for (const ruim of [Buffer.from('%PDF-1.7 qualquer coisa'), Buffer.alloc(0), Buffer.from('RIFF\0\0\0\0WAVEfmt '), svg('')]) {
    assert.throws(() => cta.tamanhoDaImagem(ruim), /logo/, ruim.slice(0, 8).toString('latin1'));
  }
});

t('lado zero ou absurdo (mais de 20000 px) dá o mesmo erro claro, nunca escala infinita ou zero', () => {
  for (const ruim of [png(0, 0), png(0, 100), png(100, 0), png(20001, 100), png(100, 4292935688), jpeg(0, 50), jpeg(50, 0)]) {
    assert.throws(() => cta.tamanhoDaImagem(ruim), /^Error: logo: /, ruim.slice(0, 4).toString('latin1'));
  }
  assert.deepStrictEqual(cta.tamanhoDaImagem(png(20000, 1)), [20000, 1], 'o limite ainda vale');
});

t('montar-video.js: imagem do montador que não abre diz qual é (não "logo")', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'projetos', 'montar-video.js'), 'utf8');
  assert.ok(/'imagem ' \+ nome \+ ': '/.test(src), 'a mensagem cita o nome da imagem');
});

// Quadro de mentira do aplicar.js: guarda as camadas pedidas.
function quadro() {
  const camadas = [];
  const add = (tipo) => (papel, a, z, ...resto) => { const c = { tipo, papel, a, z, resto }; camadas.push(c); return c; };
  return { camadas, dy: 0, desloca: 0, sons: [], rect: add('rect'), texto: add('texto'), imagem: add('imagem'), preset: () => {} };
}
const bloco = (logo) => ({ id: 'cta', tipo: 'cartao-cta', inicio: 10, fim: 14.5, textos: { frase: 'Fale com a gente', botao: 'Mande uma mensagem' }, opcoes: { logo, larguraBotao: 300, conta: 'conta.ficticia' } });

t('o cartão final põe o logo de cada tipo com o tamanho certo e 64 px no lado maior', () => {
  for (const [nome, buf, esperado] of CASOS) {
    const ext = { PNG: 'png', JPG: 'jpg', WebP: 'webp', SVG: 'svg' }[nome.split(' ')[0]];
    const arq = path.join(TMP, `logo-${n}-${CASOS.findIndex((c) => c[0] === nome)}.${ext}`);
    fs.writeFileSync(arq, buf);
    assert.deepStrictEqual(cta.validar(bloco(arq)), [], nome);
    const c = quadro();
    cta.construir(bloco(arq), c);
    const img = c.camadas.find((x) => x.tipo === 'imagem');
    assert.ok(img, nome + ': sem camada de logo');
    const op = img.resto[0];
    assert.deepStrictEqual(op.tamanho, esperado, nome);
    assert.strictEqual(op.escala, Math.round((64 / Math.max(...esperado)) * 100), nome);
    assert.strictEqual(op.arquivo, path.resolve(arq));
  }
});

t('logo ilegível: o cartão recusa na validação, antes de montar', () => {
  const arq = path.join(TMP, 'logo.png');
  fs.writeFileSync(arq, Buffer.from('não é imagem'));
  const e = cta.validar(bloco(arq));
  assert.ok(e.some((x) => /opcoes\.logo/.test(x)), e.join(' | '));
});

// ---------- arquivos de verdade do modelo, conferidos com o ffprobe (quando há ffprobe nesta máquina) ----------
const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
const reais = [
  '04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/xicara.jpg',
  '04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/retrato-sentada-recorte.webp',
  '04-LABORATORIO-DE-DESIGN/biblioteca/previas/adesivo/carrossel-01.webp',
];
if (ffprobe.status === 0) {
  t('arquivos reais (JPG, WebP estendido e WebP com perdas): o mesmo tamanho que o ffprobe lê', () => {
    for (const rel of reais) {
      const arq = path.join(RAIZ, ...rel.split('/'));
      const p = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', arq], { encoding: 'utf8' });
      const [l, a] = p.stdout.trim().split(',').map(Number);
      assert.deepStrictEqual(cta.tamanhoDaImagem(fs.readFileSync(arq)), [l, a], rel);
    }
  });
} else console.log('aviso: sem ffprobe nesta máquina; a conferência com arquivos reais ficou de fora');

t('SVG real do modelo: medida do viewBox ou dos atributos', () => {
  const arq = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'estilos', 'colagem', 'objetos', 'adesivo', 'estrela.svg');
  const [l, a] = cta.tamanhoDaImagem(fs.readFileSync(arq));
  assert.ok(l > 0 && a > 0 && Number.isInteger(l) && Number.isInteger(a), `${l}x${a}`);
});

t('o montador do modelo base (cartão "cta" e elemento de fundo da marca) lê o tamanho pela mesma função, nunca só o cabeçalho PNG', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'projetos', 'montar-video.js'), 'utf8');
  assert.ok(/tamanhoDaImagem\(/.test(src), 'montar-video.js não usa tamanhoDaImagem');
  assert.ok(!/readUInt32BE\(16\)/.test(src), 'montar-video.js ainda lê a largura como PNG');
});

fs.rmSync(TMP, { recursive: true, force: true });
if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log(`\n${n} testes passaram.`);
