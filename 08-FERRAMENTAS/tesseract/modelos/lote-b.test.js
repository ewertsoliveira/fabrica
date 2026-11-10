#!/usr/bin/env node
// Testes da marca no segundo lote dos modelos antigos (Bloco, Adesivo, Círculo, Retrô, Faixa e Palco).
// Rode: node 08-FERRAMENTAS/tesseract/modelos/lote-b.test.js
// Como o inverso.test.js, não precisa do Tesseract: o projeto é o do motor de verdade, com a importação de letras e a medição
// de texto trocadas por versões falsas e determinísticas (a largura sai do número de letras e de um fator por arquivo).
// Prova que, sem marca, cada modelo gera exatamente as mesmas camadas de antes (impressão digital tirada de cae885b, antes
// do item 6.4) e que, com marca, as cores, as letras e o tingimento das texturas chegam às camadas, com contraste e
// encolhimento. As marcas são de mentira: "aurora" (quente) e "boreal" (fria).
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { Projeto, hex } = require('./motor');
// com --digitais, só imprime as impressões digitais de agora (sem o tema: serve também na base de antes)
const temaMarca = process.argv.includes('--digitais') ? null : require('./tema-marca');

let n = 0;
let falhas = 0;
const t = (nome, fn) => {
  try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + e.message.split('\n')[0]); }
};
const FONTES = path.join(__dirname, 'fontes');
const MODELOS = ['bloco', 'adesivo', 'circulo', 'retro', 'faixa', 'palco'];

// largura relativa de cada letra (fração do corpo por caractere), para a medição falsa
const LARGURA = { Poppins: 0.66, DMSerifDisplay: 0.5, JetBrainsMono: 0.6, SpaceMono: 0.6, Fraunces: 0.52, InstrumentSerif: 0.4,
  Oswald: 0.42, BebasNeue: 0.38, KaushanScript: 0.5, Inter: 0.55, CormorantGaramond: 0.42 };
const familia = (arq) => path.basename(arq).replace(/\.(ttf|otf)$/i, '').split('-')[0];
const estiloDoNome = (arq) => {
  const s = (path.basename(arq).replace(/\.(ttf|otf)$/i, '').split('-')[1] || 'Regular').replace(/Italic$/, ' Italic').trim();
  return s === '' ? 'Italic' : s;
};

// projeto do motor sem o Tesseract: nada é gravado, e a letra e a medida saem do nome do arquivo
function projetoFalso() {
  const P = Object.create(Projeto.prototype);
  Object.assign(P, { saida: null, W: 1080, H: 1920, camadas: [], acoes: [], id: 1, efeitoId: 5000, kfId: 0, fontes: {}, tamImg: {}, medidas: [] });
  P.fonte = function (arquivo) {
    if (this.fontes[arquivo]) return this.fontes[arquivo];
    const style = estiloDoNome(arquivo);
    this.fontes[arquivo] = { family: familia(arquivo), style, arquivo: path.isAbsolute(arquivo) ? arquivo : path.join(FONTES, arquivo),
      estilos: [style], italico: /italic/i.test(style) };
    return this.fontes[arquivo];
  };
  P.medir = function (textos, est) {
    const res = {};
    const k = LARGURA[familia(est.arquivo)] || 0.55;
    for (const tx of [...new Set(textos)].filter(Boolean)) {
      const w = Math.round(tx.length * est.size * k + (est.tracking || 0) / 1000 * est.size * tx.length);
      // como na medição de verdade: o texto é desenhado a partir de x = 60 numa tela de 1080 px
      if (w > 1080 - 62) throw new Error('texto maior que a área de medição: ' + tx);
      res[tx] = { w, x0: 2, top: Math.round(est.size * 0.22), bottom: Math.round(est.size * 0.92) };
      this.medidas.push({ texto: tx, size: est.size, arquivo: est.arquivo, w });
    }
    return res;
  };
  P.importaImagem = function (id) { this.tamImg[id] = this.tamImg[id] || [1080, 1920]; return this.tamImg[id]; };
  P.importaVideo = () => 14500;
  return P;
}

// palavras e pedido parecidos com o da demonstração (vídeo de 14,5 s; B-roll de 5,3 a 10,1 s)
const FALA = 'Ordem na semana começa bem cedo eu planejo três tarefas por dia e deixo o resto para depois sem culpa nenhuma ' +
  'assim a semana anda e eu organizo o que importa';
const palavras = FALA.split(' ').map((w, i) => ({ w, ini: 3300 + i * 330, fim: 3300 + i * 330 + 280 }));
const pedidoBase = () => ({
  chamada: { texto: 'Ordem na semana', palavra: 'Ordem', ini: 0.5, fim: 3.2 },
  destaques: ['planejo'],
  palavraTela: { texto: 'ORGANIZE', ini: 12.9, fim: 14.5 },
  rosto: { y: 820 },
  anotacao: 'três por dia',
});
// o Palco só mostra a frase de fechamento e o aviso quando o pedido pede: um pedido próprio, com o palco até o fim
const pedidoPalco = () => ({ ...pedidoBase(), palco: { ini: 4.0, fim: 14.5 }, palavraTela: { texto: 'Menos correria|mais tempo', ini: 11.0, fim: 13.6 },
  aviso: 'Ilustração · simulação' });

// monta um modelo e devolve o projeto; ctx.marca é o tema (ou null)
function monta(nome, { marca = null, acento = null, pedido = pedidoBase(), fala = palavras } = {}) {
  const P = projetoFalso();
  const cenas = [{ img: 'x.png', ini: 5.3, fim: 10.1, cena: 'x.png', id: 'cena-0' }];
  cenas.forEach((c) => P.importaImagem(c.id));
  const modelo = require('./estilos/' + nome);
  modelo.montar({ P, DUR: 14500, palavras: fala.map((p) => ({ ...p })), temMatte: false, arquivoMatte: null, pedido, cenas, acento, marca });
  return P;
}
const digital = (P) => crypto.createHash('sha256').update(JSON.stringify({ c: P.camadas, a: P.acoes })).digest('hex').slice(0, 16);
const CASOS = [...MODELOS.map((m) => [m, m, pedidoBase]), ['palco/fechamento', 'palco', pedidoPalco]];

if (process.argv.includes('--digitais')) {
  for (const [k, m, ped] of CASOS) console.log(`  '${k}': '${digital(monta(m, { pedido: ped() }))}',`);
  process.exit(0);
}

// impressão digital das camadas e ações de cada modelo sem marca, tirada de cae885b (antes do item 6.4) com --digitais.
// Mudou? Então o vídeo sem marca mudou: a regra é que ele fique igual, valor por valor. Mudaram DE PROPÓSITO no item 6.6B
// (decisão D7 C do responsável, que corrige também o vídeo sem marca): Bloco (a frase que atravessa a troca de fundo é
// cortada na troca) e Retrô (o mesmo corte; o título desce de y 1380 para 1465 e a legenda da abertura de 1590 para 1690).
// O Círculo também muda sem marca (a caixa alta da tela espera o círculo cobrir o rosto e a última frase fica até o fim da
// tela), mas este pedido não tem frase na tela: o caso do Círculo, mais abaixo, confere. Valores do item 6.6B (--digitais).
const ANTES = {
  bloco: '65df3fc1ebae3b34',
  adesivo: '3ff869ca90d9c34e',
  circulo: '2e34254de7d3c4fe',
  retro: 'f1625dcf03bfcfa4',
  faixa: 'e983d598db34c8b0',
  // correção do item 6.6B (D6 B e D7 C, de propósito): sem marca, a legenda do palco vai para baixo do cartão (no
  // cartão ela caía no queixo), na tinta do estilo, e a frase que atravessa a entrada ou a saída do palco é cortada ali
  palco: '3e129930c53963e9',
  'palco/fechamento': '081fb1efb50b5fbb',
};

const AURORA = { cores: { escuro: '#3A1F14', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' },
  fontes: { principal: 'Poppins-Bold.ttf', mono: 'JetBrainsMono-Bold.ttf' } };
const BOREAL = { cores: { escuro: '#0E2235', claro: '#E6F1F5', acento: '#3FA7C9', neutro: '#7D96A8' },
  fontes: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'SpaceMono-Bold.ttf', acento: 'Fraunces-SemiBoldItalic.ttf' } };
const RUIM = { cores: { escuro: '#D8E4EA', claro: '#E6F1F5', acento: '#E0EAF0', neutro: '#DDE7ED' } };
const tema = (m) => temaMarca.resolver({ marca: m });

const textos = (P, re) => P.camadas.filter((c) => c.type === 'Text' && re.test(c.name));
const camada = (P, nome) => P.camadas.find((c) => c.name === nome);
const camadas = (P, nome) => P.camadas.filter((c) => c.name === nome);
const corForma = (c) => (c.shape.fills[0] || c.shape.strokes[0]).paint.color;
const igualCor = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const temCor = (P, h) => JSON.stringify(P.camadas).includes(JSON.stringify(hex(h)).slice(1, -1));
// silencia (e guarda) os avisos do log durante um trecho
function comAvisos(fn) {
  const avisos = [], orig = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try { return { r: fn(), avisos }; } finally { console.warn = orig; }
}
// ativo no instante x (ms)?
const ativo = (c, x) => c.activeRange && c.activeRange.start <= x && x < c.activeRange.start + c.activeRange.duration;
// extensão horizontal de um texto, pela âncora (centro da tinta) e pela largura medida. A legenda progressiva tem o nome
// "<prefixo>-<frase>" e começa só com a primeira palavra: a largura é a da frase inteira
function extensao(P, c) {
  const doNome = c.name.replace(/^[a-z]+-/, '');
  const achar = (tx) => P.medidas.filter((x) => x.texto === tx && x.size === c.sourceText.fontSize).pop();
  const m = achar(doNome) || achar(c.sourceText.text);
  const esc = (c.transform.scale ? c.transform.scale[0] : 100) / 100;
  const cx = c.transform.position[0];
  return [cx - m.w * esc / 2, cx + m.w * esc / 2];
}
const familias = (cs) => [...new Set(cs.map((c) => c.sourceText.fontFamily))].sort();

t('sem marca, os 6 modelos geram as mesmas camadas de antes (e o Palco com a frase de fechamento e o aviso)', () => {
  for (const [k, m, ped] of CASOS) assert.strictEqual(digital(monta(m, { pedido: ped() })), ANTES[k], `o modelo ${k} mudou sem marca`);
});

// com um acento que tem contraste no modelo (um acento sem contraste agora volta ao estilo, ver os casos de contraste)
// camadas sem as da legenda e sem ids (com qualquer marca, a frase que atravessa a troca de fundo é cortada na troca; na
// Faixa, o título amarelo também segue o acento)
// (no Palco com a marca, durante o palco a legenda e o destaque vão para baixo do cartão: ficam de fora também)
const semLegenda = (P) => JSON.stringify(P.camadas.filter((c) => !/^(leg|destaque)-/.test(c.name)).map((c) => ({ ...c, id: 0,
  ...(c.name === 'titulo' && c.sourceText ? { sourceText: { ...c.sourceText, fillColor: null } } : {}) })));
t('o antigo marca.acento (só a cor de acento) gera o mesmo que o ctx.acento de antes (menos o tingimento do Adesivo, o corte da legenda e a legenda do Palco)', () => {
  for (const [k, m, ped] of CASOS) {
    if (m === 'adesivo') continue;
    // no Palco, o destaque precisa de 4,5:1 sobre o vídeo e 3:1 na frase de fechamento, sobre o fundo claro
    const h = { circulo: '#C0603F', palco: '#D9622B' }[m] || '#F2994A';
    const antigo = monta(m, { acento: hex(h), pedido: ped() });
    const novo = monta(m, { acento: hex(h), pedido: ped(), marca: temaMarca.resolver({ marca: { acento: h } }) });
    // sem frase atravessando troca de fundo (Círculo): igual, valor por valor
    if (k === 'circulo') assert.strictEqual(digital(novo), digital(antigo), k);
    else assert.strictEqual(semLegenda(novo), semLegenda(antigo), k);
  }
  // no Adesivo, as texturas rosa agora seguem o acento: tirando o giro de matiz e a cor da sombra da foto, é o mesmo de antes
  const antigo = monta('adesivo', { acento: hex('#F2994A') });
  const novo = monta('adesivo', { acento: hex('#F2994A'), marca: temaMarca.resolver({ marca: { acento: '#F2994A' } }) });
  const giros = novo.camadas.flatMap((c) => c.effects.filter((e) => e.effect.type === 'hueSaturation'));
  assert.ok(giros.length >= 4, 'esperava o giro de matiz nas texturas');
  // (os ids de efeito e de máscara andam um a cada giro: ficam de fora)
  const semGiro = (P) => JSON.stringify(P.camadas.map((c) => ({ ...c, id: 0, effects: c.effects.filter((e) => e.effect.type !== 'hueSaturation').map((e) => e.effect),
    masks: c.masks.map(({ id, ...m }) => m),
    ...(c.dropShadow ? { dropShadow: { ...c.dropShadow, color: null } } : {}) })));
  assert.strictEqual(semGiro(novo), semGiro(antigo));
});

t('com a aurora, as cores e as letras da marca chegam às camadas (os 6 modelos)', () => {
  const tx = (P, re) => { const cs = textos(P, re); assert.ok(cs.length, re); return cs; };
  // Bloco: título, palavra final e legenda na principal; blocos no acento, tela final no claro, título final no escuro
  let P = monta('bloco', { marca: tema(AURORA) });
  assert.deepStrictEqual(familias(tx(P, /^(titulo|final-titulo|leg-)/)), ['Poppins']);
  assert.ok(igualCor(camada(P, 'final-fundo').rect.fillColor, hex('#FFF1E0')));
  assert.ok(igualCor(camada(P, 'final-titulo').sourceText.fillColor, hex('#3A1F14')));
  assert.ok(camadas(P, 'degrau').some((c) => igualCor(c.rect.fillColor, hex('#F2994A'))), 'blocos no acento');
  assert.ok(igualCor(corForma(camada(P, 'pessoa-broll-anel')), hex('#3A1F14')), 'anel da pessoa no escuro');
  // Adesivo: faixa no acento, letras da principal; o destaque em itálico fica na itálica do estilo (aurora não tem itálico)
  P = monta('adesivo', { marca: tema(AURORA) });
  assert.ok(igualCor(camada(P, 'faixa').rect.fillColor, hex('#F2994A')));
  assert.strictEqual(camada(P, 'titulo').sourceText.fontFamily, 'Poppins');
  assert.strictEqual(camada(P, 'selo-texto').sourceText.fontFamily, 'Poppins');
  const legA = tx(P, /^leg-/);
  assert.ok(legA.some((c) => c.sourceText.fontFamily === 'Poppins') && legA.some((c) => c.sourceText.fontFamily === 'Inter'), 'destaque na Inter itálica');
  // Círculo: bordas no acento; o branco não lê sobre o acento da aurora (2,3:1), então pílula e tela ficam no acento com o
  // texto no escuro da marca (decisão D1 B; ver contraste)
  P = comAvisos(() => monta('circulo', { marca: tema(AURORA) })).r;
  assert.ok(igualCor(corForma(camadas(P, 'circulo-borda')[0]), hex('#F2994A')));
  assert.ok(camadas(P, 'pilula').every((c) => igualCor(c.rect.fillColor, hex('#F2994A'))), 'pílula no acento');
  assert.ok(textos(P, /^leg-/).every((c) => igualCor(c.sourceText.fillColor, hex('#3A1F14'))), 'texto da pílula no escuro');
  assert.deepStrictEqual(familias(tx(P, /^titulo/)), ['Poppins']);
  // a palavra que acende vem como foi falada: com uma letra que tem minúsculas, a caixa alta é do estilo do texto
  // (a tela começa mais cedo, para ter frases da legenda nela)
  const P2 = comAvisos(() => monta('circulo', { marca: tema(AURORA), pedido: { ...pedidoBase(), palavraTela: { texto: 'ORGANIZE', ini: 12.5, fim: 14.5 } } })).r;
  assert.deepStrictEqual(familias(tx(P2, /^caixa-/)), ['Poppins']);
  assert.ok(tx(P2, /^caixa-/).every((c) => c.sourceText.allCaps), 'caixa alta na tela');
  // e só entra depois que o círculo cobriu a tela (antes, cairia sobre o rosto)
  assert.ok(tx(P2, /^caixa-/).every((c) => c.activeRange.start >= 12500 + 650), 'caixa alta antes do círculo cobrir o rosto');
  // Retrô: creme no claro, tinta no escuro, limão no acento
  P = monta('retro', { marca: tema(AURORA) });
  assert.ok(igualCor(camadas(P, 'creme')[0].rect.fillColor, hex('#FFF1E0')));
  assert.ok(camadas(P, 'pixel').every((c) => igualCor(c.rect.fillColor, hex('#FFF1E0'))));
  assert.ok(igualCor(camada(P, 'titulo').sourceText.fillColor, hex('#F2994A')));
  assert.ok(igualCor(camada(P, 'titulo').sourceText.strokeColor, hex('#3A1F14')));
  assert.deepStrictEqual(familias(tx(P, /^(titulo|leg-)/)), ['Poppins']);
  const legR = tx(P, /^leg-[^a]/);
  assert.ok(legR.some((c) => igualCor(c.sourceText.fillColor, hex('#3A1F14'))) && legR.some((c) => igualCor(c.sourceText.fillColor, hex('#F2994A'))));
  // Faixa: moldura, painel, faixas e título no acento; tela final no claro com a legenda escura
  P = monta('faixa', { marca: tema(AURORA) });
  for (const n of ['moldura', 'painel-fundo', 'faixa']) assert.ok(igualCor(camadas(P, n)[0].rect.fillColor, hex('#F2994A')), n);
  assert.ok(igualCor(camada(P, 'titulo').sourceText.fillColor, hex('#F2994A')));
  assert.ok(igualCor(camada(P, 'final-fundo').rect.fillColor, hex('#FFF1E0')));
  assert.ok(tx(P, /^leg-/).some((c) => igualCor(c.sourceText.fillColor, hex('#3A1F14')) && ativo(c, 13000)), 'legenda da tela final no escuro');
  assert.ok(tx(P, /^leg-/).filter((c) => ativo(c, 13000)).every((c) => !igualCor(c.sourceText.fillColor, [1, 1, 1, 1])), 'nada branco sobre a tela clara');
  assert.ok(tx(P, /^leg-/).some((c) => c.sourceText.fontFamily === 'Poppins'));
  // Palco: fundo claro, frase no escuro (a última linha da frase, no claro, volta ao azul: ver contraste); o destaque da
  // legenda sobre o vídeo fica no acento; no palco, sobre o fundo claro, o acento da aurora não chega a 3:1 e ele vai na tinta
  P = comAvisos(() => monta('palco', { marca: tema(AURORA), pedido: pedidoPalco() })).r;
  assert.ok(igualCor(camada(P, 'palco-fundo').rect.fillColor, hex('#FFF1E0')));
  assert.ok(igualCor(camada(P, 'frase-0').sourceText.fillColor, hex('#3A1F14')));
  assert.ok(igualCor(tx(P, /^destaque-/)[0].sourceText.fillColor, hex('#3A1F14')));
  const Pv = comAvisos(() => monta('palco', { marca: tema(AURORA), pedido: { ...pedidoPalco(), palco: { ini: 6.0, fim: 10.1 } } })).r;
  assert.ok(igualCor(tx(Pv, /^destaque-/)[0].sourceText.fillColor, hex('#F2994A')), 'destaque sobre o vídeo no acento');
  assert.deepStrictEqual(familias(tx(P, /^(leg-|destaque-|frase-)/)), ['Poppins']);
  assert.strictEqual(camada(P, 'aviso').sourceText.fontFamily, 'JetBrainsMono');
});

t('com a boreal, o itálico de destaque vai para a letra de acento da marca (Adesivo, Círculo e Faixa)', () => {
  const A = monta('adesivo', { marca: tema(BOREAL) });
  assert.deepStrictEqual(familias(textos(A, /^leg-/)), ['DMSerifDisplay', 'Fraunces']);
  assert.ok(textos(A, /^leg-/).filter((c) => c.sourceText.fontFamily === 'Fraunces').every((c) => c.sourceText.fontStyle === 'SemiBold Italic'));
  const C = monta('circulo', { marca: tema(BOREAL) });
  assert.deepStrictEqual(familias(textos(C, /^leg-/)), ['DMSerifDisplay', 'Fraunces']);
  const F = monta('faixa', { marca: tema(BOREAL) });
  assert.strictEqual(camada(F, 'titulo').sourceText.fontFamily, 'Fraunces');
  assert.ok(camadas(F, 'repete').every((c) => c.sourceText.fontFamily === 'Fraunces'));
  assert.deepStrictEqual(familias(textos(F, /^leg-/)), ['DMSerifDisplay', 'Fraunces']);
  // sem itálico nem letra de acento (aurora), o itálico pesado da Faixa fica na Inter itálica do estilo
  const FA = monta('faixa', { marca: tema(AURORA) });
  assert.strictEqual(camada(FA, 'titulo').sourceText.fontFamily, 'Inter');
  assert.strictEqual(camada(FA, 'titulo').sourceText.fontStyle, 'Black Italic');
  const CA = monta('circulo', { marca: tema(AURORA) });
  assert.ok(textos(CA, /^leg-/).some((c) => c.sourceText.fontFamily === 'InstrumentSerif'), 'itálico da Instrument Serif');
});

t('Adesivo: as texturas rosa giram até o matiz do acento; os adesivos coloridos ficam; sem marca, nenhum giro', () => {
  const giros = (P) => P.camadas.filter((c) => c.effects.some((e) => e.effect.type === 'hueSaturation'));
  const sem = monta('adesivo');
  assert.strictEqual(giros(sem).length, 0);
  for (const [m, hue] of [[AURORA, 77], [BOREAL, -117]]) {
    const P = monta('adesivo', { marca: tema(m) });
    const nomes = [...new Set(giros(P).map((c) => c.name))].sort();
    assert.deepStrictEqual(nomes, ['adesivo-explosao', 'papel-grade', 'xadrez-rosa']);
    giros(P).forEach((c) => { const e = c.effects.find((x) => x.effect.type === 'hueSaturation').effect; assert.ok(Math.abs(e.hue - hue) <= 1, `${c.name}: ${e.hue}`); assert.strictEqual(e.lightness, 0); });
    assert.ok(!giros(P).some((c) => /estrela|flor|raio|seta|rabisco/.test(c.name)));
  }
  // acento apagado (quase cinza): o giro também tira saturação
  const P = monta('adesivo', { marca: tema({ cores: { acento: '#8A8F94' } }) });
  assert.ok(giros(P)[0].effects.find((x) => x.effect.type === 'hueSaturation').effect.saturation < -50);
});

t('paleta com claro e escuro quase iguais: os textos ficam legíveis (par do estilo) e avisam no log', () => {
  for (const [m, ped] of [['bloco', pedidoBase], ['circulo', pedidoBase], ['retro', pedidoBase], ['faixa', pedidoBase], ['palco', pedidoPalco]]) {
    const { r: P, avisos } = comAvisos(() => monta(m, { marca: tema(RUIM), pedido: ped() }));
    assert.ok(avisos.length && avisos.every((a) => /^\[marca\] .*contraste/.test(a)), `${m}: ${avisos.join(' | ')}`);
    if (m === 'bloco') {
      const f = camada(P, 'final-fundo').rect.fillColor;
      assert.ok(temaMarca.contrasteOk(camada(P, 'final-titulo').sourceText.fillColor, f));
      textos(P, /^leg-/).filter((c) => c.activeRange.start >= 12900).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, f), c.name));
    }
    if (m === 'circulo') {
      camadas(P, 'pilula').forEach((c) => assert.ok(temaMarca.contrasteOk([1, 1, 1, 1], c.rect.fillColor), 'pílula'));
      assert.ok(temaMarca.contrasteOk([1, 1, 1, 1], camada(P, 'tela-azul').rect.fillColor), 'tela');
    }
    if (m === 'retro') {
      const f = camadas(P, 'creme')[0].rect.fillColor;
      textos(P, /^leg-/).filter((c) => !c.dropShadow).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, f), c.name));
      textos(P, /^leg-/).filter((c) => c.dropShadow).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, hex('#1F1F1A'), 4.5), c.name));
    }
    if (m === 'faixa') {
      const f = camada(P, 'final-fundo').rect.fillColor;
      textos(P, /^leg-/).filter((c) => c.activeRange.start >= 12900).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, f), c.name));
      assert.ok(temaMarca.contrasteOk(camada(P, 'titulo').sourceText.fillColor, hex('#1A1A1A'), 4.5), 'título sobre o vídeo');
    }
    if (m === 'palco') {
      const f = camada(P, 'palco-fundo').rect.fillColor;
      textos(P, /^frase-/).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, f), c.name));
      textos(P, /^(leg-|destaque-)/).filter((c) => !c.dropShadow).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, f), c.name));
    }
  }
});

t('acento claro com texto branco (Círculo) e acento igual ao fundo (Palco): pílula, tela e frase continuam legíveis', () => {
  // D1 B: o acento claro fica na pílula e na tela, com o texto no escuro da marca (contraste calculado), sem aviso
  for (const m of [AURORA, BOREAL]) {
    const pedido = { ...pedidoBase(), palavraTela: { texto: 'ORGANIZE', ini: 12.5, fim: 14.5 } };
    const { r: C, avisos } = comAvisos(() => monta('circulo', { marca: tema(m), pedido }));
    assert.deepStrictEqual(avisos, []);
    const fundo = hex(m.cores.acento), texto = hex(m.cores.escuro);
    camadas(C, 'pilula').forEach((c) => assert.ok(igualCor(c.rect.fillColor, fundo), 'pílula no acento'));
    assert.ok(igualCor(camada(C, 'tela-azul').rect.fillColor, fundo), 'tela no acento');
    assert.ok(textos(C, /^(leg-|caixa-)/).length > 3, 'faltam textos na pílula e na tela');
    textos(C, /^(leg-|caixa-)/).filter((c) => !/apagada/.test(c.name)).forEach((c) => {
      assert.ok(igualCor(c.sourceText.fillColor, texto), c.name);
      assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, fundo, 3), c.name);
    });
    assert.ok(textos(C, /^caixa-apagada$/).every((c) => igualCor(c.sourceText.fillColor.slice(0, 3), texto.slice(0, 3))), 'caixa apagada no escuro');
  }
  // acento claro e escuro da marca também claro: nem o branco nem o escuro leem; pílula e tela voltam ao azul, com aviso
  const { r: C, avisos } = comAvisos(() => monta('circulo', { marca: tema({ cores: { acento: '#F2994A', escuro: '#E0C0A0' } }) }));
  assert.ok(avisos.some((a) => /pílula e tela/.test(a)), avisos.join('\n'));
  camadas(C, 'pilula').forEach((c) => assert.ok(temaMarca.contrasteOk([1, 1, 1, 1], c.rect.fillColor), 'pílula do recuo'));
  assert.ok(temaMarca.contrasteOk([1, 1, 1, 1], camada(C, 'tela-azul').rect.fillColor), 'tela do recuo');
  // sem escuro na marca: o mesmo recuo
  assert.ok(comAvisos(() => monta('circulo', { marca: tema({ cores: { acento: '#F2994A' } }) })).avisos.some((a) => /pílula e tela/.test(a)));
  // acento escuro com branco: a pílula fica na marca
  const D = monta('circulo', { marca: tema({ cores: { acento: '#1F3A5F' } }) });
  assert.ok(igualCor(camadas(D, 'pilula')[0].rect.fillColor, hex('#1F3A5F')));
  const { r: P } = comAvisos(() => monta('palco', { marca: tema({ cores: { claro: '#E6F1F5', acento: '#E6F1F5' } }), pedido: pedidoPalco() }));
  const f = camada(P, 'palco-fundo').rect.fillColor;
  textos(P, /^frase-/).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, f), c.name));
  // sem a frase de fechamento no palco, nada vai sobre o fundo claro: nenhum aviso de contraste dele
  assert.deepStrictEqual(comAvisos(() => monta('palco', { marca: tema(AURORA) })).avisos, []);
  // destaque sobre o vídeo (antes do palco: com a marca, o destaque dentro do palco fica sobre o fundo claro), acento quase
  // igual ao escuro: volta ao azul do estilo
  const { r: Q, avisos: av } = comAvisos(() => monta('palco', { marca: tema({ cores: { escuro: '#14213D', acento: '#1B2A4A' } }),
    pedido: { ...pedidoBase(), destaques: ['começa'] } }));
  assert.ok(av.some((a) => /sobre o vídeo/.test(a)), av.join('\n'));
  assert.ok(igualCor(textos(Q, /^destaque-/)[0].sourceText.fillColor, [0.2, 0.42, 0.95, 1]));
});

t('letra larga e palavra longa: título, legenda, selo e palavra final cabem na tela; o título não sobe', () => {
  const larga = { cores: AURORA.cores, fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf'), mono: 'JetBrainsMono-Bold.ttf' } };
  const pedido = (m) => ({ ...(m === 'palco' ? pedidoPalco() : pedidoBase()), chamada: { texto: 'Extraordinária organização semanal', palavra: 'Extraordinária', ini: 0.5, fim: 3.2 },
    ...(m === 'palco' ? {} : { palavraTela: { texto: 'DESORGANIZADAMENTE', ini: 12.9, fim: 14.5 } }) });
  for (const m of MODELOS) {
    const { r: P } = comAvisos(() => monta(m, { marca: tema(larga), pedido: pedido(m) }));
    for (const c of textos(P, /^(titulo|final-titulo|selo-texto|leg-|caixa-|destaque-|frase-|aviso)/)) {
      const [x0, x1] = extensao(P, c);
      assert.ok(x0 >= 40 && x1 <= 1040, `${m}: ${c.name} "${c.sourceText.text}" sai da tela (${Math.round(x0)} a ${Math.round(x1)})`);
    }
    // a palavra repetida da Faixa não quebra a caixa de 3240 px
    // (aqui a palavra repetida fica na itálica do estilo, porque a marca não tem itálico: só encolhe até caber na medição)
    camadas(P, 'repete').forEach((c) => assert.ok(P.medidas.some((x) => (x.texto + '  ').repeat(3) === c.sourceText.text && x.size === c.sourceText.fontSize && x.w <= 1018), 'linha repetida'));
    // a faixa do Adesivo cabe na tela
    if (m === 'adesivo') assert.ok(camada(P, 'faixa').rect.size[0] <= 936);
    const sem = monta(m, { pedido: { ...pedido(m), chamada: pedidoBase().chamada, palavraTela: (m === 'palco' ? pedidoPalco() : pedidoBase()).palavraTela } });
    const topo = (Q) => Math.min(...textos(Q, /^titulo/).map((c) => c.transform.position[1]));
    if (textos(P, /^titulo/).length) assert.ok(topo(P) >= topo(sem) - 1, `${m}: o título subiu na direção do rosto`);
  }
});

t('no piso de 40%, texto que não cabe nem assim dá erro em português (não o erro cru da medição), com o piso de verdade', () => {
  const pedido = { ...pedidoBase(), palavraTela: { texto: 'A'.repeat(400), ini: 12.9, fim: 14.5 } };
  assert.throws(() => monta('bloco', { marca: tema(AURORA), pedido }), (e) => /^marca: o texto "A+" não cabe na tela nem no piso de 60 px/.test(e.message));
});

// ---------- rodada de correção (revisão do item 6.4) ----------
const fala = (texto) => texto.split(' ').map((w, i) => ({ w, ini: 3300 + i * 330, fim: 3300 + i * 330 + 280 }));

t('no piso, o texto que ainda sai da tela avisa no log (uma vez), com o piso real e o texto que não coube', () => {
  // título gigante do Bloco: piso de 60 px, não de 40% do corpo; 23 letras largas medem, mas não cabem em 936 px
  const longo = 'A'.repeat(23);
  const { avisos } = comAvisos(() => monta('bloco', { marca: tema(AURORA), pedido: { ...pedidoBase(), chamada: { texto: longo, palavra: longo, ini: 0.5, fim: 3.2 } } }));
  const doTitulo = avisos.filter((a) => a.includes(`"${longo}"`));
  assert.strictEqual(doTitulo.length, 1, avisos.join('\n'));
  assert.ok(/^\[marca\] .*piso de 60 px.*sai da tela/.test(doTitulo[0]), doTitulo[0]);
  // legenda: o aviso cita a frase que não coube, não a primeira da lista
  const palavrao = 'Inconstitucionalissimamente'.repeat(2).slice(0, 42);
  const { avisos: av2 } = comAvisos(() => monta('bloco', { marca: tema(AURORA), fala: fala(`Ordem na semana começa bem cedo ${palavrao} eu planejo três tarefas`) }));
  const daLegenda = av2.filter((a) => /sai da tela/.test(a));
  assert.ok(daLegenda.length === 1 && daLegenda[0].includes(palavrao) && !daLegenda[0].includes('"Ordem'), av2.join('\n'));
  // Círculo: o mesmo piso de 60 px no título
  const { avisos: av3 } = comAvisos(() => monta('circulo', { marca: tema(AURORA), pedido: { ...pedidoBase(), chamada: { texto: 'A'.repeat(21), palavra: 'A'.repeat(21), ini: 0.5, fim: 3.2 } } }));
  assert.ok(av3.some((a) => /piso de 60 px.*sai da tela/.test(a)), av3.join('\n'));
});

t('limites estreitos só com a letra da marca: com a letra do estilo (pedido só com o acento), título do Retrô e palavra repetida da Faixa como antes', () => {
  const antigo = (h) => temaMarca.resolver({ marca: { acento: h } });
  // Retrô, chamada "Semanal": na manuscrita do estilo, 190 px como antes (o limite de 560 px é só para a letra da marca)
  const pedido = { ...pedidoBase(), chamada: { texto: 'Semanal sem pressa', palavra: 'Semanal', ini: 0.5, fim: 3.2 } };
  const antes = monta('retro', { acento: hex('#F2994A'), pedido });
  const R = monta('retro', { acento: hex('#F2994A'), pedido, marca: antigo('#F2994A') });
  assert.strictEqual(camada(R, 'titulo').sourceText.fontSize, 190);
  assert.deepStrictEqual(camada(R, 'titulo').transform.position, camada(antes, 'titulo').transform.position);
  // com a letra da marca, continua limitado a 560 px
  const B = comAvisos(() => monta('retro', { marca: tema(AURORA), pedido })).r;
  assert.ok(larguraDe(B, camada(B, 'titulo')) <= 560, 'título da marca até 560 px');
  // Faixa: palavra de 960 a 1018 px na itálica do estilo não encolhe; com a letra larga da marca, encolhe
  const pf = { ...pedidoBase(), palavraTela: { texto: 'ORGANIZANDO', ini: 12.9, fim: 14.5 } };
  const F = monta('faixa', { acento: hex('#F2994A'), pedido: pf, marca: antigo('#F2994A') });
  const tela = camadas(F, 'repete').filter((c) => /ORGANIZANDO/.test(c.sourceText.text));
  assert.ok(tela.length && tela.every((c) => c.sourceText.fontSize === 170), 'a palavra da itálica do estilo encolheu');
  const w = F.medidas.find((x) => x.texto === 'ORGANIZANDO' && x.size === 170).w;
  assert.ok(w > 960 && w <= 1018, `largura da palavra no teste: ${w}`);
  // (marca de mentira com uma letra de acento larga, que vira a do itálico pesado)
  const larga = { cores: BOREAL.cores, fontes: { principal: 'DMSerifDisplay-Regular.ttf', acento: 'Poppins-Bold.ttf' } };
  const FB = comAvisos(() => monta('faixa', { pedido: pf, marca: tema(larga) })).r;
  assert.ok(camadas(FB, 'repete').filter((c) => /ORGANIZANDO/.test(c.sourceText.text)).every((c) => c.sourceText.fontSize < 170), 'a letra da marca devia encolher');
});
// largura medida de uma camada de texto
function larguraDe(P, c) { return P.medidas.filter((x) => x.texto === c.sourceText.text && x.size === c.sourceText.fontSize).pop().w; }

t('Círculo (D7 C): com ou sem marca, a caixa alta só entra depois que o círculo cobre o rosto, e a última frase fica até o fim da tela', () => {
  const pedido = { ...pedidoBase(), palavraTela: { texto: 'ORGANIZE', ini: 12.5, fim: 14.5 } }; // frase em 12,54 s
  for (const marca of [null, temaMarca.resolver({ marca: { acento: '#C0603F' } }), tema(AURORA)]) {
    const P = comAvisos(() => monta('circulo', { acento: marca ? hex(marca.cores.acento) : null, pedido, marca })).r;
    const cx = textos(P, /^caixa-/);
    assert.ok(cx.length && cx.every((c) => c.activeRange.start >= 12500 + 650), 'caixa alta antes do círculo cobrir o rosto');
    assert.ok(cx.some((c) => c.activeRange.start + c.activeRange.duration === 14500), 'a última frase devia ficar até o fim da tela');
  }
  // a palavra dita toda antes de o círculo cobrir o rosto (antes, cortada inteira pela entrada atrasada) aparece assim mesmo,
  // inteira, do fim da entrada até o fim da tela
  // (uma palavra só, dita de 3,30 a 3,58 s, numa tela de 3,2 a 4,6 s: o círculo cobre o rosto em 3,85 s)
  const P = monta('circulo', { pedido: { ...pedidoBase(), palavraTela: { texto: 'ORGANIZE', ini: 3.2, fim: 4.6 } }, fala: fala('organize') });
  const cx = textos(P, /^caixa-(?!apagada)/);
  assert.strictEqual(cx.length, 1, 'a palavra da tela sumiu');
  assert.strictEqual(cx[0].name, 'caixa-ORGANIZE');
  assert.strictEqual(cx[0].activeRange.start, 3200 + 650);
  assert.strictEqual(cx[0].activeRange.start + cx[0].activeRange.duration, 4600);
});

t('corte da legenda na troca de fundo: no trecho depois do corte, as palavras já ditas entram no tempo 0 e a última chave é a frase inteira', () => {
  // chaves de texto (textContent) de uma camada, já ordenadas pelo motor (ordena: no mesmo tempo, a última chave vale)
  const chaves = (P, c) => (P.acoes.find((a) => a.property && a.property.layerId === c.id && a.property.propertyType === 'textContent') || { keyframes: [] }).keyframes;
  const casos = [['bloco', pedidoBase(), [10100]], ['retro', pedidoBase(), [10100]], ['palco', pedidoPalco(), [11150, 13600]]];
  let multi = 0;
  for (const [m, pedido, cortes] of casos) {
    const P = comAvisos(() => monta(m, { marca: tema(AURORA), pedido })).r;
    const depois = P.camadas.filter((c) => c.type === 'Text' && /^leg-/.test(c.name) && !/apagada/.test(c.name) && cortes.includes(c.activeRange.start));
    assert.ok(depois.length, `${m}: nenhum trecho começa no corte ${cortes}`);
    for (const c of depois) {
      const corte = c.activeRange.start;
      const frase = c.name.slice(4).split(' ');
      // frase de uma palavra só: não tem chaves, a camada já mostra a palavra
      if (frase.length === 1) { assert.strictEqual(c.sourceText.text, frase[0]); continue; }
      multi++;
      // palavras da frase já ditas no corte (a frase começou antes dele, então pelo menos uma)
      const i0 = palavras.findIndex((p, i) => frase.every((w, k) => palavras[i + k] && palavras[i + k].w === w));
      const ditas = frase.filter((w, k) => palavras[i0 + k].ini <= corte).length;
      const ks = chaves(P, c);
      assert.ok(i0 >= 0 && ditas >= 1 && ks.length, `${m}: o trecho depois do corte não acende palavra por palavra`);
      assert.strictEqual(ks[0].layerTime, 0, `${m}: primeira chave fora do tempo 0`);
      assert.strictEqual(ks[0].value.value, frase.slice(0, ditas).join(' '), `${m}: no tempo 0 deviam estar as palavras já ditas`);
      assert.ok(ks.every((k, i) => !i || k.layerTime > ks[i - 1].layerTime), `${m}: chaves fora de ordem ou repetidas`);
      assert.strictEqual(ks[ks.length - 1].value.value, frase.join(' '), `${m}: a última chave não é a frase inteira`);
    }
  }
  assert.ok(multi >= 2, 'o teste precisa de frases de mais de uma palavra cortadas');
  // Faixa: a linha mista não acende palavra por palavra; o trecho depois do corte mostra a frase inteira, na cor da tela
  const F = monta('faixa', { marca: tema(AURORA), pedido: { ...pedidoBase(), palavraTela: { texto: 'ORGANIZE', ini: 12.7, fim: 14.5 } } });
  const fd = textos(F, /^leg-/).filter((c) => c.activeRange.start === 12700);
  assert.ok(fd.length && fd.every((c) => igualCor(c.sourceText.fillColor, hex('#3A1F14'))), 'Faixa: trecho depois do corte');
});

t('com a marca, a frase da legenda que atravessa a troca de fundo muda de cor na troca (Bloco, Retrô e Palco)', () => {
  // a frase "sem culpa nenhuma assim" vai de ~9,9 s a ~11,0 s: começa na imagem do B-roll (até 10,1 s) e termina no vídeo
  const P = monta('bloco', { marca: tema(AURORA) });
  const depois = textos(P, /^leg-[^a]/).filter((c) => ativo(c, 10200));
  assert.ok(depois.length && depois.every((c) => igualCor(c.sourceText.fillColor, [1, 1, 1, 1]) && c.dropShadow), 'depois do B-roll, branco com sombra');
  assert.ok(textos(P, /^leg-[^a]/).filter((c) => ativo(c, 10000)).every((c) => igualCor(c.sourceText.fillColor, hex('#3A1F14'))), 'na imagem, escuro');
  const R = monta('retro', { marca: tema(AURORA) });
  assert.ok(textos(R, /^leg-[^a]/).filter((c) => ativo(c, 10200)).every((c) => c.dropShadow && c.transform.position[1] === 1300), 'Retrô: depois do creme, sobre o vídeo');
  // Palco (D6 B): antes do palco, branco com sombra sobre o vídeo, no cartão de sempre (y 1390); durante o palco (de 4,0 s
  // ao fim), a legenda vai para baixo do cartão (y 1625), na tinta sobre o fundo claro, sem sombra
  const Q = comAvisos(() => monta('palco', { marca: tema(AURORA), pedido: pedidoPalco() })).r;
  const antes = textos(Q, /^leg-/).filter((c) => ativo(c, 3800));
  assert.ok(antes.length && antes.every((c) => igualCor(c.sourceText.fillColor, [1, 1, 1, 1]) && c.dropShadow && c.transform.position[1] === 1390), 'Palco: branco antes do palco');
  for (const x of [4100, 6000, 10900, 12000, 13700]) {
    const no = textos(Q, /^leg-/).filter((c) => ativo(c, x));
    assert.ok(no.length && no.every((c) => igualCor(c.sourceText.fillColor, hex('#3A1F14')) && !c.dropShadow && c.transform.position[1] === 1625), `Palco: tinta abaixo do cartão em ${x}`);
  }
  // a frase que atravessa a entrada do palco (4,0 s) é cortada ali
  assert.ok(textos(Q, /^leg-/).some((c) => c.activeRange.start === 4000), 'Palco: faltou o corte na entrada do palco');
});

t('Palco (D6 B e D7 C): sem marca, a legenda do palco também sai do queixo; só com a marca a cena do B-roll é lisa', () => {
  // sem marca (correção do item 6.6B): antes do palco, branco com sombra em 1390; no palco, abaixo do cartão (1625), na
  // tinta do estilo sobre o fundo do estilo, sem sombra; o destaque no azul do estilo (3:1 sobre o fundo)
  const sem = monta('palco', { pedido: pedidoPalco() });
  const fundo = camada(sem, 'palco-fundo').rect.fillColor;
  const antes = textos(sem, /^leg-/).filter((c) => ativo(c, 3800));
  assert.ok(antes.length && antes.every((c) => c.transform.position[1] === 1390 && c.dropShadow), 'sem marca: antes do palco');
  for (const x of [4100, 6000, 10900, 12000, 13700]) {
    const no = textos(sem, /^leg-/).filter((c) => ativo(c, x));
    assert.ok(no.length && no.every((c) => c.transform.position[1] === 1625 && !c.dropShadow && igualCor(c.sourceText.fillColor, [0.09, 0.1, 0.13, 1])),
      `sem marca: legenda no queixo ou fora da tinta em ${x}`);
  }
  const d = textos(sem, /^destaque-/)[0];
  assert.strictEqual(d.transform.position[1], 1625);
  assert.ok(igualCor(d.sourceText.fillColor, [0.2, 0.42, 0.95, 1]) && temaMarca.contrasteOk(d.sourceText.fillColor, fundo, 3), 'sem marca: destaque');
  assert.ok(!d.dropShadow);
  const palco = require('./estilos/palco');
  assert.strictEqual(palco.cenaLisa({ marca: null, pedido: pedidoPalco() }), null);
  assert.strictEqual(palco.cenaLisa({ marca: tema(AURORA), pedido: pedidoPalco() }), '#FFF1E0');
  assert.strictEqual(palco.cenaLisa({ marca: tema(BOREAL), pedido: {} }), '#E6F1F5');
  // fundo do palco do pedido vence; marca com claro sem contraste com o escuro: o fundo do estilo
  assert.strictEqual(palco.cenaLisa({ marca: tema(AURORA), pedido: { palco: { fundo: [1, 1, 1, 1] } } }), '#FFFFFF');
  assert.strictEqual(comAvisos(() => palco.cenaLisa({ marca: tema(RUIM), pedido: {} })).r, '#F1F3F5');
  // destaque da legenda no palco: o acento, se ele contrasta 3:1 com o fundo; senão a tinta (sem aviso)
  const esc = { cores: { escuro: '#14213D', claro: '#FFF8EE', acento: '#1F6F5C' } };
  const { r: E, avisos } = comAvisos(() => monta('palco', { marca: tema(esc), pedido: pedidoPalco() }));
  assert.ok(igualCor(textos(E, /^destaque-/)[0].sourceText.fillColor, hex('#1F6F5C')));
  assert.strictEqual(textos(E, /^destaque-/)[0].transform.position[1], 1625);
  assert.ok(!avisos.some((a) => /destaque/.test(a)), avisos.join('\n'));
});

t('Luz de Vela (D5 B): com a marca, o brilho gira até o acento e a grade de cor acompanha; sem marca, nada muda', () => {
  const giros = (P) => P.camadas.filter((c) => c.name === 'luz-dourada').map((c) => (c.effects.find((e) => e.effect.type === 'hueSaturation') || {}).effect);
  const temp = (P) => P.camadas.find((c) => c.name === 'tom').effects.find((e) => e.effect.type === 'temperatureTint').effect.temperature;
  const sem = monta('luz-de-vela');
  assert.ok(giros(sem).length === 3 && giros(sem).every((e) => !e), 'sem marca, nenhum giro');
  assert.strictEqual(temp(sem), 8);
  const B = monta('luz-de-vela', { marca: tema(BOREAL) });
  assert.ok(giros(B).length === 3 && giros(B).every((e) => e && e.hue > 140 && e.lightness === 0), 'brilho da boreal no azul');
  assert.ok(temp(B) < 0, 'com o acento frio, a grade fica fria');
  const A = monta('luz-de-vela', { marca: tema(AURORA) });
  assert.ok(giros(A).every((e) => e && Math.abs(e.hue) < 30), 'aurora: giro pequeno, quente');
  assert.strictEqual(temp(A), 8, 'com o acento quente, a grade fica a do estilo');
});

t('Palco: nenhum véu nem degradê entra sobre o vídeo com a marca (só o fundo do palco e a tarja do aviso)', () => {
  for (const m of [AURORA, BOREAL]) {
    const P = comAvisos(() => monta('palco', { marca: tema(m), pedido: pedidoPalco() })).r;
    const sem = monta('palco', { pedido: pedidoPalco() });
    const formas = (Q) => Q.camadas.filter((c) => c.type === 'Rect' || c.type === 'Shape' || c.type === 'Image').map((c) => c.name).sort();
    assert.deepStrictEqual(formas(P), formas(sem));
  }
});

t('duas empresas em seguida: a marca de uma não aparece no vídeo da outra', () => {
  for (const [m, ped] of [...MODELOS.map((x) => [x, pedidoBase]), ['palco', pedidoPalco]]) {
    comAvisos(() => monta(m, { marca: tema(AURORA), pedido: ped() }));
    const b = comAvisos(() => monta(m, { marca: tema(BOREAL), pedido: ped() })).r;
    const sb = JSON.stringify(b.camadas);
    assert.ok(!sb.includes('Poppins') && !temCor(b, '#F2994A') && !temCor(b, '#3A1F14'), m);
    assert.strictEqual(digital(monta(m, { pedido: ped() })), ANTES[m === 'palco' && ped === pedidoPalco ? 'palco/fechamento' : m]);
  }
});

console.log(`\n${n} casos ok, ${falhas} falharam`);
if (falhas) process.exit(1);
