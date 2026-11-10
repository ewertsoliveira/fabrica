#!/usr/bin/env node
// Testes de previas-marca.js: a assinatura da marca de cada empresa e a leitura das prévias na marca que ainda valem.
// Rode: node 08-FERRAMENTAS/biblioteca/previas-marca.test.js   (só Node; nada de Chromium)
// Cada teste usa uma raiz temporária com as empresas fictícias aurora (quente) e boreal (fria), cada uma com o seu
// marca.yaml e uma letra OFL copiada de tesseract/modelos/fontes/, a pasta antiga (empresa "principal") e a cinza, sem marca.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// O ambiente de quem roda o teste não escolhe empresa, marca ou pasta.
delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;
delete process.env.FABRICA_RAIZ;

const pm = require('./previas-marca');
const empresaMod = require('../../_fabrica/core/empresa');

const FONTES = path.join(__dirname, '..', 'tesseract', 'modelos', 'fontes');
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });
const pastas = [];
let contador = 0;

function novaRaiz() {
  const r = path.join(os.tmpdir(), `previas-marca-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
const copiar = (r, rel, fonte) => { const arq = path.join(r, ...rel.split('/')); fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.copyFileSync(path.join(FONTES, fonte), arq); return arq; };

// marca.yaml fictício. As cores são montadas em código (o validador não aceita hex solto fora de teste isento).
const hex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const AURORA = { nome: 'Aurora Nutrição', conta: 'aurora.nutricao', cores: { escuro: hex(58, 30, 20), claro: hex(255, 243, 228), acento: hex(232, 90, 20), neutro: hex(176, 125, 98) } };
const BOREAL = { nome: 'Boreal Finanças', conta: 'boreal.financas', cores: { escuro: hex(14, 42, 59), claro: hex(234, 246, 248), acento: hex(20, 160, 220), neutro: hex(94, 124, 140) } };
function yaml(m, { principal = 'fontes/principal.ttf', mono = 'fontes/mono.ttf', acento = '', logo = '' } = {}) {
  return [
    'empresa:', `  nome: "${m.nome}"`, `  handle: "${m.conta}"`, '',
    'cores:', ...Object.entries(m.cores).map(([p, v]) => `  ${p}: "${v}"`), '',
    'tipografia:', '  principal:', `    arquivo: "${principal}"`, '  mono:', `    arquivo: "${mono}"`, '  acento:', `    arquivo: "${acento}"`, '',
    'pecas:', `  logo: "${logo}"`, '',
  ].join('\n');
}

// Raiz com a pasta antiga (principal, marca em 06-MARCA-E-FOTOS), aurora e boreal com marca própria e cinza sem marca.
function raizCompleta() {
  const r = novaRaiz();
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', yaml({ nome: 'Empresa Antiga', conta: 'empresa.antiga', cores: AURORA.cores }, { principal: '06-MARCA-E-FOTOS/fontes/antiga.ttf', mono: '' }));
  copiar(r, '06-MARCA-E-FOTOS/fontes/antiga.ttf', 'DMSans-Medium.ttf');
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Finanças', r);
  empresaMod.criar('cinza', 'Cinza Sem Marca', r);
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA));
  copiar(r, 'empresas/aurora/fontes/principal.ttf', 'DMSerifDisplay-Regular.ttf');
  copiar(r, 'empresas/aurora/fontes/mono.ttf', 'DMMono-Medium.ttf');
  esc(r, 'empresas/boreal/marca.yaml', yaml(BOREAL, { acento: 'fontes/acento.ttf' }));
  copiar(r, 'empresas/boreal/fontes/principal.ttf', 'DMSans-Medium.ttf');
  copiar(r, 'empresas/boreal/fontes/mono.ttf', 'JetBrainsMono-Bold.ttf');
  copiar(r, 'empresas/boreal/fontes/acento.ttf', 'SpaceGrotesk-Bold.ttf');
  return r;
}

// Foto de uma pasta: caminho relativo -> hash do conteúdo.
function fotografia(dir) {
  const mapa = {};
  const varrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const arq = path.join(d, e.name);
      const rel = path.relative(dir, arq).split(path.sep).join('/');
      if (e.isDirectory()) { mapa[rel + '/'] = 'pasta'; varrer(arq); } else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(dir);
  return mapa;
}

// Prévias na marca de um estilo (arquivos pequenos de mentira) e o previas.json delas.
function previasDe(r, codigo, id, extra = {}, arquivos = ['carrossel-01.webp', 'carrossel-02.webp', 'fixado-apresentacao.webp', 'fixado-metodo.webp', 'fixado-contratar.webp', 'reels-capa.webp', 'video.webm', 'video-capa.webp']) {
  const base = `empresas/${codigo}/previas/${id}`;
  for (const f of arquivos) esc(r, `${base}/${f}`, 'x');
  const m = {
    estilo: id, cores: 'marca', empresa: codigo, assinatura: pm.assinaturaDaMarca(r, codigo).assinatura, identidade: 'empresa',
    avisos: ['Com as suas cores, o texto da lâmina 1 fica difícil de ler.'],
    capa: 'carrossel-01.webp', carrossel: ['carrossel-01.webp', 'carrossel-02.webp'],
    fixados: { apresentacao: 'fixado-apresentacao.webp', metodo: 'fixado-metodo.webp', contratar: 'fixado-contratar.webp' },
    reelsCapa: 'reels-capa.webp', video: 'video.webm', videoCapa: 'video-capa.webp', ...extra,
  };
  if (!('videoAssinatura' in extra)) m.videoAssinatura = m.assinatura;
  esc(r, `${base}/previas.json`, JSON.stringify(m, null, 2));
  return m;
}

// ---------- assinatura ----------
t('mesma marca, mesma assinatura; aurora e boreal diferentes; VERSAO entra na conta', () => {
  const r = raizCompleta();
  const a1 = pm.assinaturaDaMarca(r, 'aurora');
  const a2 = pm.assinaturaDaMarca(r, 'aurora');
  assert.strictEqual(a1.definida, true);
  assert.match(a1.assinatura, /^[0-9a-f]{16}$/);
  assert.strictEqual(a1.assinatura, a2.assinatura);
  assert.notStrictEqual(pm.assinaturaDaMarca(r, 'boreal').assinatura, a1.assinatura);
  assert.strictEqual(pm.VERSAO, 5);
});
// ---------- correção da Tarefa 8: o itálico da letra principal muda o vídeo (letra do destaque) ----------
t('tipografia.principal.italico: true muda a assinatura; false e ausente são a mesma coisa; o vídeo velho deixa de valer', () => {
  const r = raizCompleta();
  const arq = 'empresas/aurora/marca.yaml';
  const texto = yaml(AURORA);
  previasDe(r, 'aurora', 'protagonista');
  const antes = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  assert.ok(pm.previasValidas(r, 'aurora', 'protagonista', antes).video);
  const comItalico = (v) => texto.replace('  principal:\n    arquivo: "fontes/principal.ttf"', `  principal:\n    arquivo: "fontes/principal.ttf"\n    italico: ${v}`);
  esc(r, arq, comItalico('false'));
  assert.strictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, 'italico: false é o mesmo que não dizer');
  esc(r, arq, comItalico('true'));
  const depois = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  assert.notStrictEqual(depois, antes, 'italico: true devia mudar a assinatura');
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', depois), null, 'a prévia (e o vídeo) da marca de antes deixa de valer');
});
// ---------- correção: só o que muda a peça entra na assinatura ----------
t('CRLF, BOM, ordem das chaves, espaços, comentários, maiúsculas do hex e campos que não vão à peça não mudam a assinatura', () => {
  const r = raizCompleta();
  const arq = 'empresas/aurora/marca.yaml';
  const antes = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const texto = yaml(AURORA);
  const variantes = {
    crlf: texto.replace(/\n/g, '\r\n'),
    bom: '﻿' + texto,
    ordem: texto.split('\n\n').reverse().join('\n\n') + '\n',
    espacos: texto.replace(/: "/g, ':    "').replace(/\n/g, '   \n'),
    comentarios: '# marca da aurora\n' + texto.replace(/^(cores:)$/m, '$1   # as quatro cores'),
    minusculas: texto.replace(/"#([0-9A-F]{6})"/g, (_, h) => `"#${h.toLowerCase()}"`),
    arroba: texto.replace(`handle: "${AURORA.conta}"`, `handle: "@${AURORA.conta}"`),
    vozEPublico: texto + 'voz:\n  tom: "acolhedor"\npublico: "mulheres de 30 a 50"\ncopy:\n  exclamacao: permitida\nvocabulario:\n  vetado: [dieta]\nvideo:\n  duracao-maxima: 60\n',
    caminhoDaLetra: texto, // mesmo conteúdo da letra noutro caminho (abaixo)
  };
  for (const [nome, v] of Object.entries(variantes)) {
    if (nome === 'caminhoDaLetra') {
      copiar(r, 'empresas/aurora/outras/principal.ttf', 'DMSerifDisplay-Regular.ttf');
      esc(r, arq, yaml(AURORA, { principal: 'outras/principal.ttf' }));
    } else esc(r, arq, v);
    assert.strictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, `${nome} não devia mudar a assinatura`);
  }
});
t('o que vai à peça muda a assinatura: nome, conta, uma cor, a tela e os tamanhos mínimos', () => {
  const r = raizCompleta();
  const arq = 'empresas/aurora/marca.yaml';
  const antes = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const texto = yaml(AURORA);
  for (const [nome, v] of Object.entries({
    nome: texto.replace(AURORA.nome, 'Aurora Nutrição Clínica'),
    conta: texto.replace(`handle: "${AURORA.conta}"`, 'handle: "aurora.clinica"'),
    cor: texto.replace(AURORA.cores.neutro, hex(170, 125, 98)),
    tela: texto + 'canvas:\n  feed: { largura: 1080, altura: 1440 }\n',
    pisos: texto + 'canvas:\n  pisos: { titulo: 80, corpo: 44, micro: 32 }\n',
  })) {
    esc(r, arq, v);
    assert.notStrictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, `${nome} devia mudar a assinatura`);
  }
});
// ---------- correção 2: valores efetivos (o que falta no marca.yaml vem do marca.exemplo.yaml, como no marca.js) ----------
t('valores efetivos: escrever o mesmo valor que viria do exemplo não muda a assinatura; outro valor muda', () => {
  const r = raizCompleta();
  const arq = 'empresas/aurora/marca.yaml';
  const { lerYaml } = require('../marca/yaml');
  const exemplo = lerYaml(fs.readFileSync(path.join(__dirname, '..', '..', '06-MARCA-E-FOTOS', 'marca.exemplo.yaml'), 'utf8'));
  const linha = (o) => `{ ${Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(', ')} }`;
  const canvas = ['canvas:', ...['feed', 'area-segura', 'pisos', 'pisos-ui'].map((k) => `  ${k}: ${linha(exemplo.canvas[k])}`), ''].join('\n');
  const antes = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  esc(r, arq, yaml(AURORA) + canvas);
  assert.strictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, 'o canvas escrito igual ao do exemplo é o mesmo canvas efetivo');
  esc(r, arq, yaml(AURORA).replace('  acento:\n    arquivo: ""\n', '  acento:\n'));
  assert.strictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, 'acento sem arquivo herda o do exemplo (vazio)');
  esc(r, arq, yaml(AURORA) + canvas.replace(`pisos: ${linha(exemplo.canvas.pisos)}`, 'pisos: { titulo: 60, corpo: 40, micro: 30 }'));
  assert.notStrictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes);
  // a letra de destaque herdada do exemplo seria resolvida como as outras (caminho do modelo, na raiz do código)
  const d = pm.dadosEfetivos({ tipografia: { principal: { arquivo: 'x.ttf' } } });
  assert.deepStrictEqual(d.tipografia.acento, exemplo.tipografia.acento);
  assert.deepStrictEqual(d.canvas.pisos, exemplo.canvas.pisos);
  assert.strictEqual(pm.dadosEfetivos({ canvas: { pisos: { titulo: 1 } } }).canvas.pisos.titulo, 1, 'o que a marca tem vale');
});
t('instantâneo: as letras lidas e a assinatura saem do mesmo conteúdo', () => {
  const r = raizCompleta();
  const i = pm.instantaneoDaMarca(r, 'aurora');
  assert.strictEqual(i.assinatura, pm.assinaturaDaMarca(r, 'aurora').assinatura);
  assert.ok(Buffer.isBuffer(i.letras.principal.bytes) && i.letras.principal.bytes.equals(fs.readFileSync(path.join(FONTES, 'DMSerifDisplay-Regular.ttf'))));
  assert.strictEqual(i.letras.acento.citada, false);
  assert.strictEqual(i.dados.empresa.nome, AURORA.nome);
  // a assinatura de dados já lidos (o que o marca.js carregou) bate com a do arquivo
  assert.strictEqual(pm.assinaturaDosDados(r, 'aurora', i.dados, i.letras), i.assinatura);
  const outros = JSON.parse(JSON.stringify(i.dados)); outros.cores.claro = hex(1, 2, 3);
  assert.notStrictEqual(pm.assinaturaDosDados(r, 'aurora', outros, i.letras), i.assinatura);
  assert.deepStrictEqual(pm.instantaneoDaMarca(r, 'cinza'), { marca: null, definida: false, assinatura: null, dados: null, letras: null, logo: null });
});
t('raiz do código diferente da raiz dos dados: empresas/<outra>/ e a pasta antiga do código não valem; o que é do modelo vale', () => {
  const r = raizCompleta();
  const codigo = novaRaiz(); // faz o papel da raiz do código
  copiar(codigo, 'empresas/boreal/fontes/x.ttf', 'DMSans-Medium.ttf');
  copiar(codigo, '06-MARCA-E-FOTOS/fontes/y.ttf', 'DMSans-Medium.ttf');
  copiar(codigo, '08-FERRAMENTAS/fontes/z.ttf', 'DMSans-Medium.ttf');
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA, { principal: 'empresas/boreal/fontes/x.ttf', mono: '08-FERRAMENTAS/fontes/z.ttf' }));
  const a = pm.arquivosDaMarca(r, 'aurora', { raizCodigo: codigo });
  assert.strictEqual(a.letras.principal, null, 'letra de outra empresa na raiz do código');
  assert.strictEqual(a.letras.mono, path.join(codigo, '08-FERRAMENTAS', 'fontes', 'z.ttf'));
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', yaml({ nome: 'Empresa Antiga', conta: 'empresa.antiga', cores: AURORA.cores }, { principal: '06-MARCA-E-FOTOS/fontes/y.ttf', mono: '' }));
  assert.strictEqual(pm.arquivosDaMarca(r, 'principal', { raizCodigo: codigo }).letras.principal, null, 'a pasta antiga da raiz do código é de outra Fábrica');
});
t('previasValidas confere a identidade (padrão: a da empresa)', () => {
  const r = raizCompleta();
  const m = previasDe(r, 'aurora', 'protagonista', { identidade: 'exemplo' });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'prévia com a identidade de exemplo não vale como da empresa');
  assert.ok(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura, { identidade: 'exemplo' }));
  previasDe(r, 'aurora', 'protagonista', { identidade: undefined });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'sem identidade');
});
t('trocar uma cor ou o arquivo de uma letra muda a assinatura; voltar ao que era volta a assinatura', () => {
  const r = raizCompleta();
  const antes = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  esc(r, 'empresas/aurora/marca.yaml', yaml({ ...AURORA, cores: { ...AURORA.cores, acento: hex(232, 90, 21) } }));
  const outraCor = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  assert.notStrictEqual(outraCor, antes, 'a cor mudou');
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA));
  assert.strictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, 'o mesmo conteúdo dá a mesma assinatura');
  copiar(r, 'empresas/aurora/fontes/principal.ttf', 'DMSans-Bold.ttf'); // mesmo nome, outra letra
  assert.notStrictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, antes, 'a letra mudou (mesmo caminho, outro conteúdo)');
});
t('mover a pasta da Fábrica sem mudar o conteúdo não muda a assinatura', () => {
  const r = raizCompleta();
  const antes = { a: pm.assinaturaDaMarca(r, 'aurora').assinatura, b: pm.assinaturaDaMarca(r, 'boreal').assinatura, p: pm.assinaturaDaMarca(r, 'principal').assinatura };
  const outra = novaRaiz();
  fs.cpSync(r, outra, { recursive: true });
  assert.deepStrictEqual({ a: pm.assinaturaDaMarca(outra, 'aurora').assinatura, b: pm.assinaturaDaMarca(outra, 'boreal').assinatura, p: pm.assinaturaDaMarca(outra, 'principal').assinatura }, antes);
});
t('empresa sem marca.yaml: definida falso e assinatura nula', () => {
  const r = raizCompleta();
  assert.deepStrictEqual(pm.assinaturaDaMarca(r, 'cinza'), { assinatura: null, definida: false });
  assert.strictEqual(pm.arquivosDaMarca(r, 'cinza').marca, null);
});
t('letra que falta entra como ausente (a assinatura muda) e o arquivo vira null', () => {
  const r = raizCompleta();
  const antes = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  fs.rmSync(path.join(r, 'empresas', 'aurora', 'fontes', 'mono.ttf'));
  const arqs = pm.arquivosDaMarca(r, 'aurora');
  assert.strictEqual(arqs.letras.mono, null);
  assert.strictEqual(arqs.letras.principal, path.join(r, 'empresas', 'aurora', 'fontes', 'principal.ttf'));
  const depois = pm.assinaturaDaMarca(r, 'aurora');
  assert.strictEqual(depois.definida, true);
  assert.notStrictEqual(depois.assinatura, antes);
});
t('arquivosDaMarca: pasta da empresa primeiro; "..", absoluto, letra de outra empresa e letra antiga numa gaveta viram null', () => {
  const r = raizCompleta();
  const a = pm.arquivosDaMarca(r, 'aurora');
  assert.strictEqual(a.marca, path.join(r, 'empresas', 'aurora', 'marca.yaml'));
  assert.strictEqual(a.letras.acento, null, 'sem letra de destaque citada');
  assert.strictEqual(a.logo, null);
  const ruins = ['../boreal/fontes/principal.ttf', path.join(r, 'empresas', 'boreal', 'fontes', 'principal.ttf'), 'C:/x/y.ttf', '/x/y.ttf',
    'empresas/boreal/fontes/principal.ttf', '06-MARCA-E-FOTOS/fontes/antiga.ttf', 'fontes/../../boreal/fontes/principal.ttf'];
  for (const ruim of ruins) {
    esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA, { principal: ruim.replace(/\\/g, '/') }));
    assert.strictEqual(pm.arquivosDaMarca(r, 'aurora').letras.principal, null, `devia recusar ${ruim}`);
  }
  // o que é do modelo (raiz do código) vale para a gaveta: a letra de exemplo da Fábrica
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA, { principal: '08-FERRAMENTAS/tesseract/modelos/fontes/DMSans-Medium.ttf' }));
  assert.strictEqual(pm.arquivosDaMarca(r, 'aurora').letras.principal, path.join(FONTES, 'DMSans-Medium.ttf'));
  // na pasta antiga, a letra da 06-MARCA-E-FOTOS é dela
  assert.strictEqual(pm.arquivosDaMarca(r, 'principal').letras.principal, path.join(r, '06-MARCA-E-FOTOS', 'fontes', 'antiga.ttf'));
});
t('logo só entra na assinatura com comLogo', () => {
  const r = raizCompleta();
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA, { logo: 'logo.svg' }));
  esc(r, 'empresas/aurora/logo.svg', '<svg/>'); // o conteúdo só precisa mudar entre uma e outra
  const sem = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const com = pm.assinaturaDaMarca(r, 'aurora', { comLogo: true }).assinatura;
  assert.notStrictEqual(sem, com);
  assert.strictEqual(pm.arquivosDaMarca(r, 'aurora').logo, path.join(r, 'empresas', 'aurora', 'logo.svg'));
  esc(r, 'empresas/aurora/logo.svg', '<svg><rect/></svg>');
  assert.strictEqual(pm.assinaturaDaMarca(r, 'aurora').assinatura, sem, 'sem comLogo, trocar o logo não muda nada');
  assert.notStrictEqual(pm.assinaturaDaMarca(r, 'aurora', { comLogo: true }).assinatura, com);
});
t('código inválido ou inexistente: erro claro, nada lido', () => {
  const r = raizCompleta();
  for (const ruim of ['../x', '..', '', 'nao-existe', 'aurora/../boreal', 'AURORA', undefined, null, 42]) {
    for (const fn of [() => pm.pastaDaEmpresa(r, ruim), () => pm.arquivosDaMarca(r, ruim), () => pm.assinaturaDaMarca(r, ruim), () => pm.previasValidas(r, ruim, 'protagonista', 'abc')]) {
      assert.throws(fn, (e) => e.code === 'EMPRESA_DESCONHECIDA' && /empresa/i.test(e.message), `devia recusar ${JSON.stringify(ruim)}`);
    }
  }
});

// ---------- leitura das prévias que valem ----------
t('previasValidas: endereços só da pasta da empresa, com tudo o que existe', () => {
  const r = raizCompleta();
  const m = previasDe(r, 'aurora', 'protagonista');
  const p = pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura);
  const u = (f) => `/empresas/aurora/previas/protagonista/${f}`;
  assert.deepStrictEqual(p, {
    capa: u('carrossel-01.webp'), carrossel: [u('carrossel-01.webp'), u('carrossel-02.webp')],
    fixados: { apresentacao: u('fixado-apresentacao.webp'), metodo: u('fixado-metodo.webp'), contratar: u('fixado-contratar.webp') },
    reelsCapa: u('reels-capa.webp'), video: u('video.webm'), videoCapa: u('video-capa.webp'),
    avisos: ['Com as suas cores, o texto da lâmina 1 fica difícil de ler.'], leitura: [],
  });
});
t('previasValidas recusa: assinatura velha, cores de sugestão, outra empresa, outro estilo, sem assinatura', () => {
  const r = raizCompleta();
  const m = previasDe(r, 'aurora', 'protagonista');
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', 'ffffffffffffffff'), null, 'assinatura de outra marca');
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', null), null, 'sem assinatura de hoje');
  previasDe(r, 'aurora', 'protagonista', { cores: 'sugestao' });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'cores de sugestão não são da marca');
  previasDe(r, 'aurora', 'protagonista', { empresa: 'boreal' });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'previas.json da boreal copiado para a aurora');
  previasDe(r, 'aurora', 'protagonista', { estilo: 'cartilha' });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'previas.json de outro estilo');
  previasDe(r, 'aurora', 'protagonista', { assinatura: undefined });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'previas.json sem assinatura');
  esc(r, 'empresas/aurora/previas/protagonista/previas.json', '{ quebrado');
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'previas.json ilegível');
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'cartilha', m.assinatura), null, 'estilo sem prévias na marca');
  // a marca mudou depois da geração: a assinatura de hoje não é mais a do previas.json
  previasDe(r, 'aurora', 'protagonista');
  esc(r, 'empresas/aurora/marca.yaml', yaml({ ...AURORA, cores: { ...AURORA.cores, claro: hex(250, 240, 230) } }));
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', pm.assinaturaDaMarca(r, 'aurora').assinatura), null, 'marca mudou');
});
t('previasValidas: arquivo citado que não existe, nome com ".." ou barra ficam de fora; sem capa, nada vale', () => {
  const r = raizCompleta();
  const m = previasDe(r, 'aurora', 'protagonista', { carrossel: ['carrossel-01.webp', 'carrossel-09.webp', '../boreal/x.webp', 'a/b.webp', 'a\\b.webp', '.oculto.webp'], fixados: { apresentacao: '../../boreal/previas/x/fixado.webp', metodo: 'nao-existe.webp', contratar: 'c/d.webp' }, reelsCapa: '..' });
  const p = pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura);
  assert.deepStrictEqual(p.carrossel, ['/empresas/aurora/previas/protagonista/carrossel-01.webp']);
  assert.strictEqual(p.fixados, null);
  assert.strictEqual(p.reelsCapa, null);
  previasDe(r, 'aurora', 'protagonista', { capa: 'carrossel-09.webp' });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura), null, 'sem a capa o cartão não tem o que mostrar');
  for (const id of ['../boreal', 'a/b', '..', '']) assert.strictEqual(pm.previasValidas(r, 'aurora', id, m.assinatura), null, `estilo ${JSON.stringify(id)}`);
});
t('o vídeo só vem com videoAssinatura igual à de hoje e com os dois arquivos', () => {
  const r = raizCompleta();
  let m = previasDe(r, 'aurora', 'protagonista', { videoAssinatura: 'ffffffffffffffff' });
  let p = pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura);
  assert.strictEqual(p.video, null); assert.strictEqual(p.videoCapa, null);
  assert.ok(p.capa, 'as imagens continuam valendo');
  m = previasDe(r, 'aurora', 'protagonista', { videoAssinatura: undefined });
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura).video, null, 'sem videoAssinatura');
  m = previasDe(r, 'aurora', 'protagonista');
  fs.rmSync(path.join(r, 'empresas', 'aurora', 'previas', 'protagonista', 'video-capa.webp'));
  p = pm.previasValidas(r, 'aurora', 'protagonista', m.assinatura);
  assert.strictEqual(p.video, null, 'sem a capa do vídeo, o vídeo não entra');
});
t('aurora e boreal com prévias: nenhum endereço da aurora cita a boreal (e o contrário)', () => {
  const r = raizCompleta();
  for (const id of ['protagonista', 'cartilha']) { previasDe(r, 'aurora', id); previasDe(r, 'boreal', id); }
  const assA = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const assB = pm.assinaturaDaMarca(r, 'boreal').assinatura;
  const textoA = JSON.stringify(['protagonista', 'cartilha'].map((id) => pm.previasValidas(r, 'aurora', id, assA)));
  const textoB = JSON.stringify(['protagonista', 'cartilha'].map((id) => pm.previasValidas(r, 'boreal', id, assB)));
  assert.ok(!textoA.includes('boreal') && textoA.includes('/empresas/aurora/previas/'), textoA);
  assert.ok(!textoB.includes('aurora') && textoB.includes('/empresas/boreal/previas/'), textoB);
  // a assinatura da boreal não abre as prévias da aurora
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', assB), null);
});
t('pasta antiga: as prévias ficam em empresas/principal/previas/ e 06-MARCA-E-FOTOS fica idêntica', () => {
  const r = raizCompleta();
  const antes = fotografia(path.join(r, '06-MARCA-E-FOTOS'));
  assert.strictEqual(pm.pastaDaEmpresa(r, 'principal'), path.join(r, 'empresas', 'principal', 'previas'));
  assert.strictEqual(pm.pastaDaEmpresa(r, 'aurora'), path.join(r, 'empresas', 'aurora', 'previas'));
  const a = pm.assinaturaDaMarca(r, 'principal');
  assert.strictEqual(a.definida, true);
  const m = previasDe(r, 'principal', 'protagonista');
  assert.strictEqual(pm.previasValidas(r, 'principal', 'protagonista', a.assinatura).capa, '/empresas/principal/previas/protagonista/carrossel-01.webp');
  assert.strictEqual(m.assinatura, a.assinatura);
  assert.deepStrictEqual(fotografia(path.join(r, '06-MARCA-E-FOTOS')), antes);
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'aurora', 'previas')), 'ler e assinar não cria pasta nenhuma');
});
// ---------- leitura difícil: o que a marca piorou, com as cores que resolvem ----------
// Um texto de legibilidade como o gerar-previas.js grava (cores e fundos montados em código).
const textoLeg = (extra = {}) => ({ tipo: 'contraste', daMarca: true, piorou: true, formato: 'carrossel', lamina: 1, onde: 'da lâmina 1', texto: 'O imposto', papel: 'neutro',
  papelAproximado: false, cor: AURORA.cores.neutro, alfa: 1, tamanho: 80, contraste: 1.6, contrasteBase: 4.1, minimo: 3, sobreFoto: true, sobreImagem: false, semOpcao: false,
  fundo: { amostras: [hex(120, 70, 50), hex(140, 85, 60), hex(160, 100, 75)] }, ...extra });
const comLeitura = (textos) => ({ legibilidade: { cores: AURORA.cores, textos } });

t('leitura: só o que a marca piorou, por papel, com até 3 cores que passam em todos os textos do papel (a de hoje nunca)', () => {
  const r = raizCompleta();
  const { assinatura } = pm.assinaturaDaMarca(r, 'aurora');
  previasDe(r, 'aurora', 'editorial', comLeitura([
    textoLeg(),
    textoLeg({ texto: 'não é surpresa', fundo: { amostras: [hex(120, 70, 50), hex(140, 80, 60)] } }),
    textoLeg({ formato: 'reels', lamina: 1, onde: 'da capa de Reels', texto: 'O imposto' }),
    textoLeg({ piorou: false, daMarca: false, texto: 'já era fraco na base', papel: 'acento', onde: 'da lâmina 4', lamina: 4 }), // não foi a marca
    { tipo: 'coberto', formato: 'carrossel', lamina: 2, onde: 'da lâmina 2', texto: 'x', daMarca: true }, // sem cor a sugerir
  ]));
  const p = pm.previasValidas(r, 'aurora', 'editorial', assinatura);
  assert.strictEqual(p.leitura.length, 1, JSON.stringify(p.leitura));
  const g = p.leitura[0];
  assert.strictEqual(g.tipo, 'cor');
  assert.strictEqual(g.papel, 'neutro');
  assert.deepStrictEqual(g.onde, ['da lâmina 1', 'da capa de Reels']);
  assert.deepStrictEqual(g.textos, ['O imposto', 'não é surpresa']);
  assert.deepStrictEqual(g.peca, { formato: 'carrossel', lamina: 1 });
  assert.deepStrictEqual(g.itens.map((x) => [x.formato, x.lamina, x.texto]), [['carrossel', 1, 'O imposto'], ['carrossel', 1, 'não é surpresa'], ['reels', 1, 'O imposto']]);
  assert.ok(g.sugestoes.length >= 1 && g.sugestoes.length <= 3, JSON.stringify(g.sugestoes));
  const { contraste } = require('../../_fabrica/paineis/cores-do-logo.js');
  const todas = [hex(120, 70, 50), hex(140, 85, 60), hex(160, 100, 75), hex(140, 80, 60)];
  for (const s of g.sugestoes) {
    assert.ok(/^#[0-9A-F]{6}$/.test(s.cor) && s.cor !== AURORA.cores.neutro, s.cor);
    assert.ok(Math.min(...todas.map((f) => contraste(s.cor, f))) >= 3, `${s.cor} passa em todos os fundos do papel`);
    assert.ok(typeof s.rotulo === 'string' && s.rotulo, 'rótulo em português');
  }
  assert.strictEqual(g.sugestoes[0].origem, 'da-marca', 'primeiro uma cor da própria marca');
  assert.ok(!JSON.stringify(p.leitura).includes('lâmina 4'), 'o que a base já tinha fraco não entra');
});
t('leitura: nenhuma cor resolve (fundo do escuro ao claro) ou tipo "estilo": um grupo "estilo", sem sugestão; sem dados, lista vazia', () => {
  const r = raizCompleta();
  const { assinatura } = pm.assinaturaDaMarca(r, 'aurora');
  previasDe(r, 'aurora', 'caderno', comLeitura([
    textoLeg({ papel: 'claro', cor: AURORA.cores.claro, minimo: 4.5, fundo: { amostras: [hex(10, 10, 10), hex(245, 245, 245)] }, onde: 'da lâmina 2', lamina: 2, texto: 'Na prática' }),
    textoLeg({ tipo: 'estilo', semOpcao: true, daMarca: false, onde: 'da lâmina 3', lamina: 3, texto: 'Sua vez' }),
  ]));
  const p = pm.previasValidas(r, 'aurora', 'caderno', assinatura);
  assert.deepStrictEqual(p.leitura.map((g) => g.tipo), ['estilo']);
  // o mesmo papel em peças de fundos que brigam (foto escura numa, fundo claro na outra): sem cor para as duas juntas, a
  // cor que resolve o maior grupo de peças (empate: a ordem das peças) e o resto vai para "estilo"; nunca duas sugestões
  // que se contradizem para o mesmo papel
  previasDe(r, 'aurora', 'editorial', comLeitura([
    textoLeg({ onde: 'da lâmina 1', lamina: 1, texto: 'Título', fundo: { amostras: [hex(60, 40, 30), hex(80, 55, 40)] } }),
    textoLeg({ formato: 'fixados', onde: 'do post fixado de apresentação', lamina: 1, texto: 'Rótulo', minimo: 4.5, fundo: { amostras: [hex(250, 245, 240), hex(255, 255, 255)] } }),
  ]));
  const ed = pm.previasValidas(r, 'aurora', 'editorial', assinatura).leitura;
  assert.deepStrictEqual(ed.map((g) => [g.tipo, g.onde]), [['cor', ['da lâmina 1']], ['estilo', ['do post fixado de apresentação']]], JSON.stringify(ed));
  assert.deepStrictEqual(ed[0].pecas, [{ formato: 'carrossel', lamina: 1 }]);
  assert.ok(ed[0].sugestoes.length > 0);
  assert.deepStrictEqual([...p.leitura[0].onde].sort(), ['da lâmina 2', 'da lâmina 3']);
  assert.ok(!('sugestoes' in p.leitura[0]));
  previasDe(r, 'aurora', 'bloco', {});
  assert.deepStrictEqual(pm.previasValidas(r, 'aurora', 'bloco', assinatura).leitura, []);
  previasDe(r, 'aurora', 'faixa', { legibilidade: 'quebrado' });
  assert.deepStrictEqual(pm.previasValidas(r, 'aurora', 'faixa', assinatura).leitura, []);
});
t('leitura: texto do arquivo sai limpo (sem controle nem invisível) e cortado; formato, lâmina, papel e fundo fora do formato ficam de fora', () => {
  const r = raizCompleta();
  const { assinatura } = pm.assinaturaDaMarca(r, 'aurora');
  const sujo = 'da lâmina 1' + String.fromCharCode(27, 91, 51, 49, 109, 0x200b, 0x202e, 10) + ' e mais';
  previasDe(r, 'aurora', 'editorial', comLeitura([
    textoLeg({ onde: sujo, texto: 'Título' + String.fromCharCode(0x2066) + 'x'.repeat(200) }),
    textoLeg({ formato: 'outro', onde: 'da lâmina 9' }),
    textoLeg({ lamina: '1', onde: 'da lâmina 8' }),
    textoLeg({ papel: 'roxo', onde: 'da lâmina 7' }),
    textoLeg({ fundo: { amostras: ['vermelho', 5] }, onde: 'da lâmina 6' }),
  ]));
  const p = pm.previasValidas(r, 'aurora', 'editorial', assinatura);
  const tudo = JSON.stringify(p.leitura);
  const escritos = p.leitura.flatMap((g) => [...g.onde, ...g.textos, ...g.itens.map((x) => x.texto)]).join('|');
  assert.ok(![...escritos].some((ch) => ch.codePointAt(0) < 32 || [0x200b, 0x202e, 0x2066].includes(ch.codePointAt(0))), tudo);
  assert.ok(!/lâmina [6-9]/.test(tudo), 'formato, lâmina, papel ou fundo fora do formato: fora (' + tudo + ')');
  assert.deepStrictEqual(p.leitura.map((g) => g.tipo), ['cor'], 'texto de cor malformado não vira "estilo"');
  assert.ok(p.leitura[0].onde[0].startsWith('da lâmina 1') && p.leitura[0].onde[0].length <= 60);
  assert.ok(p.leitura[0].textos[0].length <= 40);
});

t('leitura: a cor de um papel vale para TODAS as peças dele quando existe; senão a do maior grupo de peças, e o resto vai para "estilo"; peça com texto sem cor possível fica só em "estilo"', () => {
  const r = raizCompleta();
  const { assinatura } = pm.assinaturaDaMarca(r, 'aurora');
  const { contraste } = require('../../_fabrica/paineis/cores-do-logo.js');
  const ESCURO = [hex(60, 40, 30), hex(80, 55, 40)];
  const CLARO = [hex(250, 245, 240), hex(255, 255, 255)];
  // três peças do neutro: duas escuras e uma clara (nenhuma cor serve às três): a cor das duas escuras, a clara em "estilo"
  previasDe(r, 'aurora', 'faixa', comLeitura([
    textoLeg({ formato: 'fixados', lamina: 2, onde: 'do post fixado de método', texto: 'Claro', minimo: 4.5, fundo: { amostras: CLARO } }),
    textoLeg({ lamina: 3, onde: 'da lâmina 3', texto: 'A', fundo: { amostras: ESCURO } }),
    textoLeg({ lamina: 5, onde: 'da lâmina 5', texto: 'B', fundo: { amostras: ESCURO } }),
  ]));
  let l = pm.previasValidas(r, 'aurora', 'faixa', assinatura).leitura;
  assert.deepStrictEqual(l.map((g) => [g.tipo, g.onde]), [['cor', ['da lâmina 3', 'da lâmina 5']], ['estilo', ['do post fixado de método']]], JSON.stringify(l));
  for (const s of l[0].sugestoes) assert.ok(ESCURO.every((f) => contraste(s.cor, f) >= 3), `${s.cor} vale para as duas peças`);
  // sempre o mesmo resultado (determinístico)
  assert.deepStrictEqual(pm.previasValidas(r, 'aurora', 'faixa', assinatura).leitura, l);
  // quando existe cor para todas as peças do papel, uma sugestão só, para todas
  previasDe(r, 'aurora', 'retro', comLeitura([
    textoLeg({ lamina: 1, onde: 'da lâmina 1', fundo: { amostras: ESCURO } }),
    textoLeg({ formato: 'reels', lamina: 1, onde: 'da capa de Reels', fundo: { amostras: [hex(70, 45, 35)] } }),
  ]));
  l = pm.previasValidas(r, 'aurora', 'retro', assinatura).leitura;
  assert.deepStrictEqual(l.map((g) => [g.tipo, g.pecas]), [['cor', [{ formato: 'carrossel', lamina: 1 }, { formato: 'reels', lamina: 1 }]]]);
  // a peça com um texto que nenhuma cor resolve (tipo "estilo") fica só em "estilo": nunca também num grupo de cor
  previasDe(r, 'aurora', 'editorial', comLeitura([
    textoLeg({ tipo: 'estilo', semOpcao: true, lamina: 1, onde: 'da lâmina 1', texto: 'Finanças sem susto' }),
    textoLeg({ lamina: 1, onde: 'da lâmina 1', texto: 'O imposto', fundo: { amostras: ESCURO } }),
    textoLeg({ formato: 'reels', lamina: 1, onde: 'da capa de Reels', texto: 'O imposto', fundo: { amostras: ESCURO } }),
  ]));
  l = pm.previasValidas(r, 'aurora', 'editorial', assinatura).leitura;
  assert.deepStrictEqual(l.map((g) => [g.tipo, g.onde]), [['cor', ['da capa de Reels']], ['estilo', ['da lâmina 1']]], JSON.stringify(l));
  const chave = (p) => p.formato + ':' + p.lamina;
  const emCor = l.filter((g) => g.tipo === 'cor').flatMap((g) => g.pecas.map(chave));
  const emEstilo = l.filter((g) => g.tipo === 'estilo').flatMap((g) => g.pecas.map(chave));
  assert.ok(!emCor.some((k) => emEstilo.includes(k)), 'nenhuma peça nos dois');
});

t('leitura: a cor sugerida não estraga o que hoje se lê (o caso "BF" da boreal: nada de preto no lugar do claro, que é o texto sobre o escuro; o acento que leva o escuro por cima não vira o escuro)', () => {
  const r = raizCompleta();
  // boreal: as iniciais "BF" no claro sobre o acento (abaixo de 4,5); o "Preto" resolveria ali, mas o claro é o texto sobre
  // o escuro em outra lâmina (guardado, hoje se lê; preto no escuro: ~1,4:1). Não é oferecido: a peça vai para "estilo".
  const a = pm.assinaturaDaMarca(r, 'boreal').assinatura;
  const E = BOREAL.cores.escuro;
  previasDe(r, 'boreal', 'protagonista', { legibilidade: { cores: BOREAL.cores, textos: [
    textoLeg({ papel: 'claro', cor: BOREAL.cores.claro, texto: 'BF', lamina: 1, onde: 'da lâmina 1', minimo: 4.5, contraste: 3, fundo: { amostras: [BOREAL.cores.acento] } }),
  ], todos: [guardado('carrossel', 2, 0, 'claro', BOREAL.cores.claro, [E, E, E], 3, 'Título claro sobre o escuro')] } });
  const l = pm.previasValidas(r, 'boreal', 'protagonista', a).leitura;
  assert.ok(!JSON.stringify(l).includes(hex(0, 0, 0)), 'nada de preto no lugar do claro: ' + JSON.stringify(l));
  assert.deepStrictEqual(l.map((g) => [g.tipo, g.onde]), [['estilo', ['da lâmina 1']]]);
  // aurora: o acento que hoje leva o escuro por cima (guardado: texto escuro sobre o acento) nunca vira o próprio escuro
  const b = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const A = AURORA.cores.acento;
  const rotulo = textoLeg({ papel: 'acento', cor: A, texto: 'Rótulo', lamina: 6, onde: 'da lâmina 6', minimo: 4.5, fundo: { amostras: [hex(250, 240, 230), hex(255, 250, 245)] } });
  previasDe(r, 'aurora', 'faixa', { ...comLeitura([rotulo]), legibilidade: { ...comLeitura([rotulo]).legibilidade, todos: [guardado('carrossel', 2, 0, 'escuro', AURORA.cores.escuro, [A, A, A], 3, 'Sobre o acento')] } });
  const f = pm.previasValidas(r, 'aurora', 'faixa', b).leitura;
  assert.ok(!f.some((g) => g.tipo === 'cor' && g.sugestoes.some((s) => s.cor === AURORA.cores.escuro.toUpperCase())), 'o acento não vira o escuro: ' + JSON.stringify(f));
  // o mesmo acento só como cor de texto (nenhum texto guardado sobre ele): o escuro pode ser sugerido
  previasDe(r, 'aurora', 'faixa', comLeitura([rotulo]));
  const soTexto = pm.previasValidas(r, 'aurora', 'faixa', b).leitura.filter((g) => g.tipo === 'cor');
  assert.ok(soTexto.some((g) => g.sugestoes.some((s) => s.cor === AURORA.cores.escuro.toUpperCase())), JSON.stringify(soTexto));
});
t('leitura: o neutro só de texto (o título do Editorial da boreal sobre a foto) ganha sugestão clara; com um texto claro guardado sobre o neutro, a cor clara não serve', () => {
  const r = raizCompleta();
  const { contraste } = require('../../_fabrica/paineis/cores-do-logo.js');
  const a = pm.assinaturaDaMarca(r, 'boreal').assinatura;
  const titulo = textoLeg({ papel: 'neutro', cor: BOREAL.cores.neutro, texto: 'O imposto', lamina: 1, onde: 'da lâmina 1', minimo: 3, fundo: { amostras: [hex(20, 30, 40), hex(40, 50, 60)] } });
  previasDe(r, 'boreal', 'editorial', { legibilidade: { cores: BOREAL.cores, textos: [titulo] } });
  let l = pm.previasValidas(r, 'boreal', 'editorial', a).leitura;
  assert.deepStrictEqual(l.map((g) => [g.tipo, g.papel]), [['cor', 'neutro']], JSON.stringify(l));
  assert.ok(l[0].sugestoes.some((s) => contraste(s.cor, BOREAL.cores.claro) < 3), 'uma cor clara serve ao título');
  const N = BOREAL.cores.neutro;
  previasDe(r, 'boreal', 'editorial', { legibilidade: { cores: BOREAL.cores, textos: [titulo], todos: [guardado('carrossel', 4, 2, 'claro', BOREAL.cores.claro, [N, N, N], 3, 'Selo')] } });
  l = pm.previasValidas(r, 'boreal', 'editorial', a).leitura;
  for (const g of l.filter((x) => x.tipo === 'cor')) for (const s of g.sugestoes) assert.ok(contraste(s.cor, BOREAL.cores.claro) >= 3, `${s.cor} estragaria o claro sobre o neutro`);
});
t('leitura: dois papéis na mesma peça nunca recebem a mesma cor', () => {
  const r = raizCompleta();
  const a = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const FOTO = [hex(60, 40, 30), hex(80, 55, 40)];
  previasDe(r, 'aurora', 'concreto-acido', comLeitura([
    textoLeg({ papel: 'neutro', texto: 'Um', lamina: 6, onde: 'da lâmina 6', fundo: { amostras: FOTO } }),
    textoLeg({ papel: 'acento', cor: AURORA.cores.acento, texto: 'Dois', lamina: 6, onde: 'da lâmina 6', fundo: { amostras: FOTO } }),
  ]));
  const l = pm.previasValidas(r, 'aurora', 'concreto-acido', a).leitura.filter((g) => g.tipo === 'cor');
  const usadas = new Map();
  for (const g of l) for (const p of g.pecas) for (const s of g.sugestoes) {
    const k = p.formato + p.lamina + s.cor;
    assert.ok(!usadas.has(k) || usadas.get(k) === g.papel, `${s.cor} sugerida para dois papéis na mesma peça`);
    usadas.set(k, g.papel);
  }
});

// ---------- todos os textos da empresa: a cor sugerida não estraga nenhum texto que hoje se lê, em nenhum estilo ----------
// Um texto guardado como o gerador grava (legibilidade.todos): peça, id, papel da cor do texto (ou null), cor, alfa, fundo
// médio, amostras do fundo nos quantis 25/50/75, mínimo e o contraste medido (aqui, a própria conta).
function guardado(f, l, k, p, c, q, m = 3, t = 'texto ' + k) {
  const x = { f, l, k, t, p, c, al: 1, md: q[1], q, m, ct: 0 };
  x.ct = pm.contrasteGuardado(x);
  return x;
}
t('textos da empresa: a cor sugerida para um papel não deixa difícil nenhum texto que hoje se lê, em nenhum estilo (texto e fundo); a Papelaria da boreal não sugere o escuro para o acento por causa da Cartilha', () => {
  const r = raizCompleta();
  const a = pm.assinaturaDaMarca(r, 'boreal').assinatura;
  const C = BOREAL.cores;
  const claroFundo = [hex(245, 245, 245), hex(250, 250, 250), hex(255, 255, 255)];
  // Papelaria: o acento (texto) sobre fundo claro está difícil; o escuro da marca resolveria ali
  const papelaria = { legibilidade: { cores: C, textos: [textoLeg({ papel: 'acento', cor: C.acento, texto: 'não', lamina: 1, onde: 'da lâmina 1', minimo: 4.5, fundo: { amostras: claroFundo } })],
    todos: [guardado('carrossel', 1, 0, 'acento', C.acento, claroFundo, 4.5)] } };
  previasDe(r, 'boreal', 'papelaria', papelaria);
  const sugeridas = () => pm.previasValidas(r, 'boreal', 'papelaria', a).leitura.filter((g) => g.tipo === 'cor').flatMap((g) => g.sugestoes.map((s) => s.cor));
  assert.ok(sugeridas().includes(C.escuro), 'sem outro estilo, o escuro serve: ' + sugeridas());
  // Cartilha: "café" é letra escura sobre a pílula de acento (hoje se lê). Com o acento trocado pelo escuro: 1:1
  previasDe(r, 'boreal', 'cartilha', { legibilidade: { cores: C, textos: [], todos: [guardado('carrossel', 1, 3, 'escuro', C.escuro, [C.acento, C.acento, C.acento], 3, 'café')] } });
  assert.ok(!sugeridas().includes(C.escuro), 'o escuro deixaria "café" da Cartilha invisível: ' + sugeridas());
  const estraga = pm.textosQueEstraga(r, 'boreal', 'acento', C.escuro);
  assert.deepStrictEqual(estraga.map((x) => [x.estilo, x.f, x.l, x.t]), [['cartilha', 'carrossel', 1, 'café']]);
  // prévia de outra marca (assinatura velha) ou de outra empresa não conta
  previasDe(r, 'aurora', 'cartilha', { legibilidade: { cores: AURORA.cores, textos: [], todos: [guardado('carrossel', 1, 3, 'escuro', C.escuro, [C.acento, C.acento, C.acento])] } });
  assert.deepStrictEqual(pm.textosQueEstraga(r, 'boreal', 'acento', C.escuro).length, 1);
});
t('textos da empresa: a conta é texto a texto, de todos os textos guardados (sondas A, B e C: peça sem texto difícil, peça que já tinha um, depois de 40)', () => {
  const r = raizCompleta();
  const a = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const C = AURORA.cores;
  const claro = [hex(240, 236, 230), hex(245, 240, 235), hex(250, 245, 240)];
  const escuro = [hex(60, 40, 30), hex(70, 48, 36), hex(80, 55, 40)];
  const todos = [
    guardado('carrossel', 2, 0, 'neutro', C.neutro, claro, 3, 'A: título da lâmina 2'),
    guardado('carrossel', 1, 1, 'neutro', C.neutro, claro, 3, 'B: outro título da lâmina 1'),
    ...Array.from({ length: 44 }, (_, i) => guardado('carrossel', 3, 10 + i, 'escuro', C.escuro, claro, 3, 'pequeno ' + i)),
    guardado('carrossel', 4, 99, 'neutro', C.neutro, claro, 3, 'C: depois de 40'),
  ];
  previasDe(r, 'aurora', 'editorial', { legibilidade: { cores: C, textos: [textoLeg({ lamina: 1, onde: 'da lâmina 1', fundo: { amostras: escuro } })], todos } });
  const branco = hex(255, 255, 255);
  assert.deepStrictEqual(pm.textosQueEstraga(r, 'aurora', 'neutro', branco).map((x) => x.t).sort(), ['A: título da lâmina 2', 'B: outro título da lâmina 1', 'C: depois de 40']);
  // e por isso o branco não é sugerido para o neutro
  const l = pm.previasValidas(r, 'aurora', 'editorial', a).leitura;
  assert.ok(!l.some((g) => g.tipo === 'cor' && g.sugestoes.some((s) => s.cor === branco)), JSON.stringify(l));
});
t('leitura: o estilo cujos únicos textos difíceis são pequenos e a menos de 0,5 do mínimo vira "detalhe" (sem mandar trocar de estilo)', () => {
  const r = raizCompleta();
  const a = pm.assinaturaDaMarca(r, 'boreal').assinatura;
  const perto = textoLeg({ tipo: 'estilo', semOpcao: true, papel: 'claro', cor: BOREAL.cores.claro, texto: 'BF', lamina: 6, onde: 'da lâmina 6', minimo: 4.5, contraste: 4.02 });
  previasDe(r, 'boreal', 'retro', { legibilidade: { cores: BOREAL.cores, textos: [perto] } });
  assert.deepStrictEqual(pm.previasValidas(r, 'boreal', 'retro', a).leitura.map((g) => g.tipo), ['detalhe']);
  previasDe(r, 'boreal', 'retro', { legibilidade: { cores: BOREAL.cores, textos: [{ ...perto, contraste: 3.4 }] } });
  assert.deepStrictEqual(pm.previasValidas(r, 'boreal', 'retro', a).leitura.map((g) => g.tipo), ['estilo'], 'longe do mínimo: estilo');
  previasDe(r, 'boreal', 'retro', { legibilidade: { cores: BOREAL.cores, textos: [{ ...perto, minimo: 3, tamanho: 80 }] } });
  assert.deepStrictEqual(pm.previasValidas(r, 'boreal', 'retro', a).leitura.map((g) => g.tipo), ['estilo'], 'texto grande: estilo');
  // só para poucos textos: no máximo 2, numa peça só, e nunca texto corrido (longo, cortado)
  const tipoCom = (textos) => { previasDe(r, 'boreal', 'retro', { legibilidade: { cores: BOREAL.cores, textos } }); return pm.previasValidas(r, 'boreal', 'retro', a).leitura.map((g) => g.tipo); };
  assert.deepStrictEqual(tipoCom([perto, { ...perto, texto: 'Selo' }]), ['detalhe'], 'dois textos na mesma peça');
  assert.deepStrictEqual(tipoCom([perto, { ...perto, texto: 'Selo' }, { ...perto, texto: 'Outro' }]), ['estilo'], 'três textos');
  assert.deepStrictEqual(tipoCom([perto, { ...perto, lamina: 2, onde: 'da lâmina 2' }]), ['estilo'], 'duas peças');
  assert.deepStrictEqual(tipoCom([{ ...perto, texto: 'Eles travam o emagrecimento e trazem a fome de volta antes do almoço' }]), ['estilo'], 'texto corrido');
});
t('textos da empresa: guardados enquanto a marca e os previas.json da empresa não mudam (a grade não recalcula a cada leitura)', () => {
  const r = raizCompleta();
  const a = pm.assinaturaDaMarca(r, 'boreal').assinatura;
  previasDe(r, 'boreal', 'cartilha', { legibilidade: { cores: BOREAL.cores, textos: [], todos: [guardado('carrossel', 1, 3, 'escuro', BOREAL.cores.escuro, [BOREAL.cores.acento, BOREAL.cores.acento, BOREAL.cores.acento], 3, 'café')] } });
  const c1 = pm.contextoDaEmpresa(r, 'boreal', a);
  assert.strictEqual(pm.contextoDaEmpresa(r, 'boreal', a), c1, 'o mesmo, sem reler');
  assert.strictEqual(c1.todos.length, 1);
  // um previas.json muda (tamanho): relê
  previasDe(r, 'boreal', 'cartilha', { legibilidade: { cores: BOREAL.cores, textos: [], todos: [] } });
  const c2 = pm.contextoDaEmpresa(r, 'boreal', a);
  assert.notStrictEqual(c2, c1);
  assert.strictEqual(c2.todos.length, 0);
  // estilo novo com prévia: relê
  previasDe(r, 'boreal', 'faixa', { legibilidade: { cores: BOREAL.cores, textos: [], todos: [guardado('carrossel', 2, 1, 'claro', BOREAL.cores.claro, [BOREAL.cores.escuro, BOREAL.cores.escuro, BOREAL.cores.escuro])] } });
  assert.strictEqual(pm.contextoDaEmpresa(r, 'boreal', a).todos.length, 1);
  // outra assinatura (marca nova): outro contexto
  assert.notStrictEqual(pm.contextoDaEmpresa(r, 'boreal', 'outra'), pm.contextoDaEmpresa(r, 'boreal', a));
});

// ---------- a nota da letra de destaque ----------
t('notaDestaque: estilo que destaca em itálico e letra principal da marca sem itálico; com itálico (nome ou aviso) ou estilo sem itálico, nada', () => {
  const r = raizCompleta();
  const estilo = (id, destaque) => esc(r, `04-LABORATORIO-DE-DESIGN/estilos/${id}/estilo.yaml`, `id: ${id}\nnome: ${id}\ntratamentos: { destaque: ${destaque}, foto: recorte }\n`);
  estilo('editorial', 'italico+cor');
  estilo('cartilha', 'cor+peso');
  const NOTA = 'No destaque, este estilo usa a letra itálica dele, porque a sua letra principal não tem itálico.';
  assert.strictEqual(pm.notaDestaque(r, 'aurora', 'editorial'), NOTA);
  assert.strictEqual(pm.notaDestaque(r, 'aurora', 'cartilha'), null, 'o estilo não destaca em itálico');
  // itálico no nome do arquivo da letra principal
  copiar(r, 'empresas/aurora/fontes/Principal-Italic.ttf', 'DMSerifDisplay-Italic.ttf');
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA, { principal: 'fontes/Principal-Italic.ttf' }));
  assert.strictEqual(pm.notaDestaque(r, 'aurora', 'editorial'), null);
  // o aviso tipografia.principal.italico: true (como o tema-marca.js)
  esc(r, 'empresas/aurora/marca.yaml', yaml(AURORA).replace('    arquivo: "fontes/principal.ttf"', '    arquivo: "fontes/principal.ttf"\n    italico: true'));
  assert.strictEqual(pm.notaDestaque(r, 'aurora', 'editorial'), null);
  // sem marca, sem letra principal citada, estilo que não existe ou id torto: nada; empresa torta: erro
  assert.strictEqual(pm.notaDestaque(r, 'cinza', 'editorial'), null);
  esc(r, 'empresas/boreal/marca.yaml', yaml(BOREAL, { principal: '' }));
  assert.strictEqual(pm.notaDestaque(r, 'boreal', 'editorial'), null);
  assert.strictEqual(pm.notaDestaque(r, 'aurora', 'nao-existe'), null);
  assert.strictEqual(pm.notaDestaque(r, 'aurora', '../x'), null);
  assert.throws(() => pm.notaDestaque(r, '../x', 'editorial'), (e) => e.code === 'EMPRESA_DESCONHECIDA');
});

t('o módulo não carrega o marca.js (que fixaria a marca da empresa ativa)', () => {
  const carregados = Object.keys(require.cache).map((k) => k.split(path.sep).join('/'));
  assert.ok(!carregados.some((k) => k.endsWith('/08-FERRAMENTAS/marca/marca.js')), 'marca.js foi carregado');
});

let ok = 0;
let falhas = 0;
for (const { nome, fn } of casos) {
  try { fn(); ok++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + (e && e.stack || e)); }
}
for (const p of pastas) fs.rmSync(p, { recursive: true, force: true });
console.log(`\n${ok} testes passaram, ${falhas} falharam.`);
process.exit(falhas ? 1 : 0);
