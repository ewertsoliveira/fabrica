#!/usr/bin/env node
// Testes da marca no primeiro lote dos modelos antigos (item 6.3): Vitrine, Recorte, Neon, Cinema, Impacto, Caderno e Visor.
// Rode: node 08-FERRAMENTAS/tesseract/modelos/lote-a.test.js
// Como o inverso.test.js, não precisa do Tesseract: o projeto é o do motor de verdade, com a importação de letras e a
// medição de texto trocadas por versões falsas e determinísticas (a largura sai do número de letras e de um fator por
// arquivo). Prova que, sem marca, cada modelo gera exatamente as mesmas camadas de antes (impressão digital guardada
// abaixo, tirada do commit cae885b, antes deste item) e que, com marca, as cores e letras chegam às camadas, o texto
// sem contraste volta ao par do estilo e o texto largo encolhe até caber.
// As marcas são de mentira: "aurora" (quente) e "boreal" (fria).
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { Projeto, hex } = require('./motor');
// com --digitais, só imprime as impressões digitais de agora (o tema não é preciso: serve também na base de antes)
const temaMarca = process.argv.includes('--digitais') ? null : require('./tema-marca');

let n = 0;
let falhas = 0;
const t = (nome, fn) => {
  try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + e.message.split('\n')[0]); }
};
const FONTES = path.join(__dirname, 'fontes');

const LOTE = ['vitrine', 'recorte', 'neon', 'cinema', 'impacto', 'caderno', 'visor'];
// variantes do pedido para a impressão digital: a da demonstração, com dois B-rolls (Vitrine, Recorte e Visor usam o
// segundo) e com a máscara da pessoa (o Neon recorta a pessoa na abertura)
const VARIANTES = ['', 'duas-cenas', 'matte'];

// largura relativa de cada letra (fração do corpo por caractere), para a medição falsa
const LARGURA = { Poppins: 0.66, DMSerifDisplay: 0.5, JetBrainsMono: 0.6, SpaceMono: 0.6, Fraunces: 0.52, InstrumentSerif: 0.4,
  Inter: 0.55, BebasNeue: 0.38, KaushanScript: 0.5, GreatVibes: 0.45, Caveat: 0.4, CourierPrime: 0.6 };
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
      if (w > 3240 - 60) throw new Error('texto maior que a área de medição: ' + tx);
      res[tx] = { w, x0: 2, top: Math.round(est.size * 0.22), bottom: Math.round(est.size * 0.92) };
      this.medidas.push({ texto: tx, size: est.size, arquivo: est.arquivo, w });
    }
    return res;
  };
  P.importaImagem = function (id) { this.tamImg[id] = this.tamImg[id] || [1080, 1920]; return this.tamImg[id]; };
  P.importaVideo = () => 14500;
  return P;
}

// palavras e pedido parecidos com o da demonstração (vídeo de 14,5 s, B-roll de 5,3 a 10,1 s)
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

// monta um modelo e devolve o projeto; ctx.marca é o tema (ou null)
function monta(nome, { marca = null, acento = null, pedido = pedidoBase(), variante = '', fala = palavras } = {}) {
  const P = projetoFalso();
  const cenas = [{ img: 'x.png', ini: 5.3, fim: 10.1, cena: 'x.png', id: 'cena-0' }];
  if (variante === 'duas-cenas') cenas.push({ img: 'y.png', ini: 10.6, fim: 12.4, cena: 'y.png', id: 'cena-1' });
  cenas.forEach((c) => P.importaImagem(c.id));
  const matte = variante === 'matte';
  const modelo = require('./estilos/' + nome);
  modelo.montar({ P, DUR: 14500, palavras: fala.map((p) => ({ ...p })), temMatte: matte, arquivoMatte: null, pedido, cenas, acento, marca });
  return P;
}
const digital = (P) => crypto.createHash('sha256').update(JSON.stringify({ c: P.camadas, a: P.acoes })).digest('hex').slice(0, 16);

// impressão digital das camadas de cada modelo sem marca, tirada do commit cae885b (item 6.2, antes deste item).
// Mudou? Então o vídeo sem marca mudou: a regra é que ele fique igual, valor por valor. Mudaram DE PROPÓSITO no item 6.6B
// (decisão D7 C do responsável, que corrige também o vídeo sem marca): Vitrine e Cinema (a frase e o destaque que
// atravessam a borda do B-roll trocam de cor na borda) e Caderno (o mesmo corte na borda da folha, e o título com o laço
// desce de y 1300 para 1385, longe do queixo). Valores tirados do código do item 6.6B com --digitais.
const ANTES = {
  vitrine: '1a7ef821d10d9261',
  'vitrine/duas-cenas': '7c6fb7ce8b4a5eb1',
  'vitrine/matte': '1a7ef821d10d9261',
  recorte: '7e570561bf1ea96a',
  'recorte/duas-cenas': '22b6b63dcec9f758',
  'recorte/matte': '7e570561bf1ea96a',
  neon: '2ffe569d678aed4e',
  'neon/duas-cenas': '2ffe569d678aed4e',
  'neon/matte': 'a6d1064ebae56933',
  cinema: 'fe04a9dd00094e58',
  'cinema/duas-cenas': 'fe04a9dd00094e58',
  'cinema/matte': 'fe04a9dd00094e58',
  impacto: '142a32ef3d6e921a',
  'impacto/duas-cenas': '66f0934a8401eb43',
  'impacto/matte': '142a32ef3d6e921a',
  caderno: '88a0e1b96e4268de',
  'caderno/duas-cenas': '88a0e1b96e4268de',
  'caderno/matte': '88a0e1b96e4268de',
  visor: 'a58c83a7a179a373',
  'visor/duas-cenas': 'd02f0fd688d24a3d',
  'visor/matte': 'a58c83a7a179a373',
};
if (process.argv.includes('--digitais')) {
  for (const m of LOTE) for (const v of VARIANTES) console.log(`  '${m}${v ? '/' + v : ''}': '${digital(monta(m, { variante: v }))}',`);
  process.exit(0);
}

const AURORA = { cores: { escuro: '#3A1F14', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' },
  fontes: { principal: 'Poppins-Bold.ttf', mono: 'JetBrainsMono-Bold.ttf' } };
const BOREAL = { cores: { escuro: '#0E2235', claro: '#E6F1F5', acento: '#3FA7C9', neutro: '#7D96A8' },
  fontes: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'SpaceMono-Bold.ttf', acento: 'Fraunces-SemiBoldItalic.ttf' } };
const RUIM = { cores: { escuro: '#D8E4EA', claro: '#E6F1F5', acento: '#E0EAF0', neutro: '#DDE7ED' } }; // claro ≈ escuro ≈ acento
const tema = (m) => temaMarca.resolver({ marca: m });

const textos = (P, re) => P.camadas.filter((c) => c.type === 'Text' && re.test(c.name));
const camada = (P, nome) => P.camadas.find((c) => c.name === nome);
const igualCor = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
const rgb = (c) => c.slice(0, 3);
const mesmaCor = (a, b) => igualCor(rgb(a), rgb(b));
const json = (P) => JSON.stringify(P.camadas);
const temCor = (P, h) => json(P).includes(JSON.stringify(rgb(hex(h))).slice(1, -1));
const temLit = (P, c) => json(P).includes(c.join(','));
const corForma = (c) => (c.shape.fills[0] || c.shape.strokes[0]).paint.color;
const corTraco = (c) => c.shape.strokes[0].paint.color;
// silencia (e guarda) os avisos do log durante um trecho
function comAvisos(fn) {
  const avisos = [], orig = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try { return { r: fn(), avisos }; } finally { console.warn = orig; }
}
// texto inteiro de uma camada: o último valor do texto animado (legenda progressiva, datilografado) ou o próprio texto
function textoCheio(P, c) {
  const kf = P.acoes.filter((a) => a.type === 'setFxPropertyKeyframes' && a.property.layerId === c.id && a.property.propertyType === 'textContent').pop();
  return kf ? kf.keyframes[kf.keyframes.length - 1].value.value : c.sourceText.text;
}
const normaliza = (s) => s.toUpperCase().replace(/[.,!?;:…]+/gu, '').replace(/\s+/g, ' ').trim();
// extensão horizontal da tinta de um texto na tela: a camada fica em position, com a âncora em anchorPoint, e a tinta
// começa em x0 da caixa (a medida do mesmo texto, no mesmo corpo)
function extensao(P, c) {
  // a legenda progressiva tem o nome "<prefixo>-<frase inteira>" (um trecho dela pode mostrar só parte da frase)
  const alvo = normaliza(/^(fina|leg|mao|pil)-\D/.test(c.name) && !/-apagada$/.test(c.name) ? c.name.replace(/^[a-z]+-/, '') : textoCheio(P, c));
  const m = P.medidas.filter((x) => normaliza(x.texto) === alvo && x.size === c.sourceText.fontSize).pop();
  assert.ok(m, `sem medida para ${c.name} "${alvo}" no corpo ${c.sourceText.fontSize}`);
  const x0 = c.transform.position[0] - c.transform.anchorPoint[0] + 2;
  return [x0, x0 + m.w];
}
// textos que precisam caber (as linhas em contorno da tela do Neon e os textos laterais e de exposição do Visor são
// enfeites que correm para fora da tela de propósito)
const QUE_CABEM = /^(fina-|destaque-|pil-|fita-|leg-|titulo|tela-0$|tela-brilho|grande-|mao-)/;

t('sem marca, os 7 modelos geram as mesmas camadas de antes (cae885b), nas três variantes do pedido', () => {
  for (const m of LOTE) for (const v of VARIANTES) {
    const k = m + (v ? '/' + v : '');
    assert.strictEqual(digital(monta(m, { variante: v })), ANTES[k], `o modelo ${k} mudou sem marca`);
  }
});

// (menos o miolo do Neon, que deriva do acento, e a Vitrine, o Cinema e o Caderno, em que a frase que atravessa a borda do
// B-roll troca de cor na borda com qualquer marca: casos próprios abaixo)
t('o antigo marca.acento (só a cor de acento) gera o mesmo que o ctx.acento de antes (Recorte, Impacto e Visor)', () => {
  for (const m of LOTE.filter((x) => !['neon', 'vitrine', 'cinema', 'caderno'].includes(x))) for (const v of VARIANTES) {
    const antigo = monta(m, { acento: hex('#F2994A'), variante: v });
    const novo = monta(m, { acento: hex('#F2994A'), variante: v, marca: temaMarca.resolver({ marca: { acento: '#F2994A' } }) });
    assert.strictEqual(digital(novo), digital(antigo), `${m}/${v}`);
  }
});

t('Neon: o brilho e o miolo do tubo derivam do acento da marca; o fundo, do escuro', () => {
  const P = monta('neon', { marca: tema(AURORA) });
  const tit = textos(P, /^titulo-neon$/);
  assert.strictEqual(tit.length, 2);
  assert.ok(mesmaCor(tit[0].sourceText.fillColor, hex('#F2994A')), 'brilho do título no acento');
  const miolo = tit[1].sourceText.fillColor;
  assert.ok(!mesmaCor(miolo, [0.85, 1, 1, 1]), 'o miolo continua ciano');
  // miolo: o acento clareado na direção do branco (mais claro que o acento, no mesmo tom)
  assert.ok(miolo[0] > hex('#F2994A')[0] - 1e-9 && miolo[2] > hex('#F2994A')[2] && miolo[0] > miolo[2], 'o miolo não é o acento clareado');
  for (const nome of ['tela-fundo', 'painel-fundo']) assert.ok(mesmaCor(camada(P, nome).rect.fillColor, hex('#3A1F14')), nome);
  assert.ok(mesmaCor(camada(P, 'tela-0').sourceText.fillColor, hex('#F2994A')));
  assert.ok(textos(P, /^destaque-/).some((c) => mesmaCor(c.sourceText.fillColor, hex('#F2994A'))));
  assert.ok(mesmaCor(corTraco(P.camadas.find((c) => c.name === 'moldura')), hex('#F2994A')));
  assert.ok(!temLit(P, [0.45, 0.96, 1]), 'sobrou o ciano do estilo');
  // letras: legenda e tela na principal; a manuscrita (sem letra de acento na aurora) fica a do estilo
  textos(P, /^(leg-|tela-)/).forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'Poppins', c.name));
  textos(P, /^(titulo-neon|destaque-)/).forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'KaushanScript', c.name));
  // com a boreal (que tem letra de acento), a manuscrita continua a do estilo (decisão D4 B: só as cores mudam)
  const B = monta('neon', { marca: tema(BOREAL) });
  textos(B, /^(titulo-neon|destaque-)/).forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'KaushanScript', c.name));
  textos(B, /^(leg-|tela-)/).forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'DMSerifDisplay', c.name));
});

t('Vitrine: legenda na principal, destaque no acento; sem itálico na marca, o destaque fica na itálica do estilo', () => {
  // destaque antes do B-roll de tela cheia (sobre a imagem clara, o destaque vai na tinta escura fixa)
  const pedido = { ...pedidoBase(), destaques: ['começa'] };
  const A = monta('vitrine', { marca: tema(AURORA), pedido });
  textos(A, /^fina-/).forEach((c) => { assert.strictEqual(c.sourceText.fontFamily, 'Poppins', c.name); assert.strictEqual(c.sourceText.fontStyle, 'Bold', c.name); });
  const d = textos(A, /^destaque-/)[0];
  assert.strictEqual(d.sourceText.fontFamily, 'Inter');
  assert.strictEqual(d.sourceText.fontStyle, 'Black Italic');
  assert.ok(mesmaCor(d.sourceText.fillColor, hex('#F2994A')));
  const B = monta('vitrine', { marca: tema(BOREAL), pedido });
  const db = textos(B, /^destaque-/)[0];
  assert.strictEqual(db.sourceText.fontFamily, 'Fraunces');
  assert.strictEqual(db.sourceText.fontStyle, 'SemiBold Italic');
  textos(B, /^fina-/).forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'DMSerifDisplay', c.name));
});

t('Vitrine com marca: a frase que atravessa a borda do B-roll de tela cheia nunca fica escura sobre o vídeo', () => {
  for (const marca of [tema(AURORA), tema(BOREAL)]) {
    const P = monta('vitrine', { marca });
    const escuras = textos(P, /^fina-/).filter((c) => mesmaCor(c.sourceText.fillColor, [0.08, 0.08, 0.1, 1]));
    assert.ok(escuras.length > 1);
    escuras.forEach((c) => assert.ok(c.activeRange.start >= 5300 && c.activeRange.start + c.activeRange.duration <= 10100,
      `${c.name} escura fora do B-roll (${c.activeRange.start} a ${c.activeRange.start + c.activeRange.duration})`));
    // e a frase continua inteira depois da borda, em branco
    const depois = textos(P, /^fina-/).filter((c) => c.activeRange.start === 10100);
    assert.ok(depois.length === 1 && mesmaCor(depois[0].sourceText.fillColor, [1, 1, 1, 1]), 'faltou a continuação em branco');
  }
});

t('Recorte: tinta no escuro, papel no claro, apagada entre os dois; pílula na principal e fita na mono', () => {
  const P = monta('recorte', { marca: tema(AURORA) });
  const pil = P.camadas.filter((c) => c.name === 'pilula');
  pil.forEach((c) => assert.ok(mesmaCor(c.rect.fillColor, hex('#FFF1E0')), 'pílula no claro'));
  textos(P, /^pil-(?!apagada)/).forEach((c) => { assert.ok(mesmaCor(c.sourceText.fillColor, hex('#3A1F14')), c.name); assert.strictEqual(c.sourceText.fontFamily, 'Poppins'); });
  const ap = textos(P, /^pil-apagada$/)[0].sourceText.fillColor;
  const e = hex('#3A1F14'), cl = hex('#FFF1E0');
  for (let i = 0; i < 3; i++) assert.ok(ap[i] > Math.min(e[i], cl[i]) - 1e-9 && ap[i] < Math.max(e[i], cl[i]) + 1e-9, 'apagada fora do intervalo');
  const fitas = textos(P, /^fita-/);
  assert.strictEqual(fitas.length, 2);
  fitas.forEach((c) => { assert.strictEqual(c.sourceText.fontFamily, 'JetBrainsMono', c.name); assert.strictEqual(c.sourceText.fontStyle, 'Bold'); });
  assert.ok(mesmaCor(fitas[0].sourceText.fillColor, hex('#FFF1E0')), 'fita escura com texto claro');
  assert.ok(mesmaCor(fitas[1].sourceText.fillColor, hex('#3A1F14')), 'fita clara com texto escuro');
  for (const c of [[0.08, 0.08, 0.09], [0.95, 0.94, 0.9], [0.62, 0.62, 0.64]]) assert.ok(!temLit(P, c), `sobrou a cor do estilo ${c}`);
});

t('Cinema: subtítulo e legenda no claro; itálico do destaque na letra de acento da boreal; a manuscrita fica a do estilo', () => {
  const pedido = { ...pedidoBase(), destaques: ['tarefas'] }; // destaque depois do título (a legenda espera o título sair)
  const A = monta('cinema', { marca: tema(AURORA), pedido });
  assert.ok(mesmaCor(camada(A, 'titulo-sub').sourceText.fillColor, hex('#FFF1E0')));
  // só com a cor de acento no pedido (o antigo marca.acento), o creme segue o acento, como antes
  const S = monta('cinema', { marca: tema({ cores: { acento: '#F2994A' } }), pedido });
  assert.ok(mesmaCor(camada(S, 'titulo-sub').sourceText.fillColor, hex('#F2994A')));
  assert.strictEqual(camada(A, 'titulo-sub').sourceText.fontFamily, 'Poppins');
  assert.strictEqual(camada(A, 'titulo').sourceText.fontFamily, 'GreatVibes');
  const legA = textos(A, /^leg-/);
  assert.ok(legA.some((c) => c.sourceText.fontFamily === 'InstrumentSerif' && /Italic/.test(c.sourceText.fontStyle)), 'itálico do estilo');
  assert.ok(legA.some((c) => c.sourceText.fontFamily === 'Poppins'));
  const B = monta('cinema', { marca: tema(BOREAL), pedido });
  assert.strictEqual(camada(B, 'titulo').sourceText.fontFamily, 'GreatVibes', 'a manuscrita do título fica a do estilo (D4 B)');
  const legB = textos(B, /^leg-/);
  assert.ok(legB.some((c) => c.sourceText.fontFamily === 'Fraunces') && legB.some((c) => c.sourceText.fontFamily === 'DMSerifDisplay'));
  // sobre o vídeo, no claro da marca; sobre a meia tela da imagem, a tinta escura fixa do estilo
  assert.ok(legB.some((c) => mesmaCor(c.sourceText.fillColor, hex('#E6F1F5'))));
});

t('Cinema com marca: a frase que atravessa a borda da meia tela da imagem nunca fica escura sobre o vídeo', () => {
  for (const marca of [tema(AURORA), tema(BOREAL)]) {
    const P = monta('cinema', { marca });
    const escuras = textos(P, /^leg-/).filter((c) => mesmaCor(c.sourceText.fillColor, [0.1, 0.09, 0.08, 1]));
    assert.ok(escuras.length > 1);
    escuras.forEach((c) => assert.ok(c.activeRange.start >= 5300 && c.activeRange.start + c.activeRange.duration <= 10100,
      `${c.name} escura fora da meia tela (${c.activeRange.start} a ${c.activeRange.start + c.activeRange.duration})`));
    assert.ok(textos(P, /^leg-/).some((c) => c.activeRange.start === 10100), 'faltou a continuação depois da borda');
  }
});

t('Impacto: legenda no acento, destaque branco fixo, letras na principal', () => {
  const P = monta('impacto', { marca: tema(BOREAL) });
  textos(P, /^leg-/).forEach((c) => { assert.ok(mesmaCor(c.sourceText.fillColor, hex('#3FA7C9')), c.name); assert.strictEqual(c.sourceText.fontFamily, 'DMSerifDisplay'); });
  textos(P, /^grande-/).forEach((c) => { assert.ok(mesmaCor(c.sourceText.fillColor, [1, 1, 1, 1]), c.name); assert.strictEqual(c.sourceText.fontFamily, 'DMSerifDisplay'); });
  assert.ok(mesmaCor(camada(P, 'grade-fundo').rect.fillColor, [0, 0, 0, 1]), 'a grade continua preta (cor fixa)');
  assert.ok(!temLit(P, [0.18, 0.77, 0.95]), 'sobrou o acento do estilo');
});

t('Caderno: título e laço no acento, legenda no claro, tinta no escuro; título na principal e a letra de mão a do estilo', () => {
  const A = monta('caderno', { marca: tema(AURORA) });
  const tit = camada(A, 'titulo');
  assert.strictEqual(tit.sourceText.fontFamily, 'Poppins');
  assert.ok(mesmaCor(tit.sourceText.fillColor, hex('#F2994A')));
  assert.ok(mesmaCor(corTraco(camada(A, 'titulo-laco')), hex('#F2994A')));
  assert.ok(mesmaCor(corTraco(camada(A, 'circulo-anel')), hex('#3A1F14')), 'laço da pessoa na tinta da marca');
  const mao = textos(A, /^mao-/);
  assert.ok(mao.every((c) => c.sourceText.fontFamily === 'Caveat'));
  assert.ok(mao.some((c) => mesmaCor(c.sourceText.fillColor, hex('#3A1F14'))) && mao.some((c) => mesmaCor(c.sourceText.fillColor, hex('#FFF1E0'))));
  // só com a cor de acento no pedido (o antigo marca.acento), a legenda segue o acento, como antes
  const S = monta('caderno', { marca: tema({ cores: { acento: '#F2994A' } }) });
  assert.ok(textos(S, /^mao-/).some((c) => mesmaCor(c.sourceText.fillColor, hex('#F2994A'))));
  // com a boreal (que tem letra de acento), a letra de mão continua a do estilo (decisão D4 B: só as cores mudam)
  const B = monta('caderno', { marca: tema(BOREAL) });
  textos(B, /^mao-/).forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'Caveat', c.name));
});

t('Caderno com marca: a frase que atravessa a borda da folha nunca fica na tinta escura sobre o vídeo', () => {
  for (const marca of [tema(AURORA), tema(BOREAL)]) {
    const P = monta('caderno', { marca });
    const tinta = hex(marca.cores.escuro);
    const escuras = textos(P, /^mao-/).filter((c) => mesmaCor(c.sourceText.fillColor, tinta));
    assert.ok(escuras.length > 1);
    escuras.forEach((c) => assert.ok(c.activeRange.start >= 5300 && c.activeRange.start + c.activeRange.duration <= 10100,
      `${c.name} na tinta fora da folha (${c.activeRange.start} a ${c.activeRange.start + c.activeRange.duration})`));
    assert.ok(textos(P, /^mao-/).some((c) => c.activeRange.start === 10100), 'faltou a continuação depois da borda');
  }
});

t('Visor: moldura no escuro, título e exposição no acento, legenda e exposição na mono', () => {
  const P = monta('visor', { marca: tema(AURORA) });
  assert.ok(mesmaCor(camada(P, 'fundo').rect.fillColor, hex('#3A1F14')));
  const tit = camada(P, 'titulo');
  assert.strictEqual(tit.sourceText.fontFamily, 'Poppins');
  assert.strictEqual(tit.sourceText.fontStyle, 'Bold');
  assert.ok(mesmaCor(tit.sourceText.fillColor, hex('#F2994A')));
  textos(P, /^(leg-|hud|lateral)/).forEach((c) => { assert.strictEqual(c.sourceText.fontFamily, 'JetBrainsMono', c.name); assert.strictEqual(c.sourceText.fontStyle, 'Bold', c.name); });
  textos(P, /^hud$/).forEach((c) => assert.ok(mesmaCor(c.sourceText.fillColor, hex('#F2994A'))));
  textos(P, /^leg-/).forEach((c) => assert.ok(mesmaCor(c.sourceText.fillColor, [1, 1, 1, 1]), 'a legenda continua branca (cor fixa)'));
  for (const c of [[0.11, 0.16, 0.29], [0.96, 0.62, 0.22]]) assert.ok(!temLit(P, c), `sobrou a cor do estilo ${c}`);
});

t('paleta com claro, escuro e acento quase iguais: cada texto volta ao par do estilo e o log avisa', () => {
  const C = temaMarca.contrasteOk;
  for (const m of LOTE) {
    const { r: P, avisos } = comAvisos(() => monta(m, { marca: tema(RUIM) }));
    assert.ok(avisos.length >= 1, `${m}: esperava um aviso`);
    assert.ok(avisos.every((a) => /^\[marca\] .*contraste/.test(a)), `${m}: ${avisos.join(' | ')}`);
    // nenhuma cor da paleta ruim sobra em texto sobre o vídeo ou sobre as telas lisas da marca (são claras demais para o
    // vídeo e iguais entre si). De fora, só texto claro sobre fundo escuro fixo do estilo: as fitas do Recorte (conferidas
    // abaixo) e a tela final do Neon, que volta ao escuro do estilo
    textos(P, /./).filter((c) => !/^fita-/.test(c.name) && !(m === 'neon' && /^tela-/.test(c.name))).forEach((c) => { for (const h of Object.values(RUIM.cores)) assert.ok(!mesmaCor(c.sourceText.fillColor, hex(h)), `${m}: ${c.name} ficou em ${h}`); });
  }
  // pares lisos conferidos
  const R = comAvisos(() => monta('recorte', { marca: tema(RUIM) })).r;
  R.camadas.filter((c) => c.name === 'pilula').forEach((p) => assert.ok(C(textos(R, /^pil-(?!apagada)/)[0].sourceText.fillColor, p.rect.fillColor), 'pílula'));
  const N = comAvisos(() => monta('neon', { marca: tema(RUIM) })).r;
  assert.ok(C(camada(N, 'tela-0').sourceText.fillColor, camada(N, 'tela-fundo').rect.fillColor), 'tela do Neon');
  assert.ok(C([1, 1, 1, 1], camada(N, 'tela-fundo').rect.fillColor), 'legenda branca na tela do Neon');
});

t('acento escuro (igual ao escuro da marca): o texto no acento volta à cor do estilo sobre o vídeo e na tela', () => {
  const escuro = { cores: { escuro: '#14213D', acento: '#1B2A4A' } };
  for (const m of LOTE) {
    const { r: P, avisos } = comAvisos(() => monta(m, { marca: tema(escuro) }));
    textos(P, /./).forEach((c) => assert.ok(!mesmaCor(c.sourceText.fillColor, hex('#1B2A4A')), `${m}: ${c.name} ficou no acento escuro`));
    if (m !== 'recorte') assert.ok(avisos.some((a) => /contraste/.test(a)), `${m}: ${avisos.join(' | ')}`);
  }
  const N = comAvisos(() => monta('neon', { marca: tema(escuro) })).r;
  assert.ok(temaMarca.contrasteOk(camada(N, 'tela-0').sourceText.fillColor, camada(N, 'tela-fundo').rect.fillColor), 'tela do Neon');
});

t('letra larga e palavra longa: título, legenda, destaque e palavra final encolhem até caber; o título não sobe', () => {
  const larga = { cores: AURORA.cores, fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf'), mono: 'JetBrainsMono-Bold.ttf', acento: 'Poppins-Bold.ttf' } };
  const pedido = { ...pedidoBase(), chamada: { texto: 'Organização extraordinária semanal', palavra: 'Extraordinária', ini: 0.5, fim: 3.2 },
    destaques: ['desorganizadamente'], palavraTela: { texto: 'DESORGANIZADAMENTE', ini: 12.9, fim: 14.5 } };
  const fala = palavras.map((p, i) => (i === 8 ? { ...p, w: 'desorganizadamente' } : i === 12 ? { ...p, w: 'extraordinariamente' } : p));
  for (const m of LOTE) for (const v of ['', 'duas-cenas']) {
    const { r: P } = comAvisos(() => monta(m, { marca: tema(larga), pedido, fala, variante: v }));
    const tx = textos(P, QUE_CABEM);
    assert.ok(tx.length > 3, m);
    for (const c of tx) {
      const [x0, x1] = extensao(P, c);
      assert.ok(x0 >= 40 && x1 <= 1040, `${m}/${v}: ${c.name} "${textoCheio(P, c)}" sai da tela (${Math.round(x0)} a ${Math.round(x1)})`);
    }
    const sem = monta(m, { pedido: { ...pedidoBase(), chamada: pedido.chamada }, variante: v });
    const topo = (Q) => Math.min(...textos(Q, /^titulo/).map((c) => c.transform.position[1] - c.transform.anchorPoint[1]));
    if (textos(sem, /^titulo/).length) assert.ok(topo(P) >= topo(sem) - 1, `${m}: o título subiu na direção do rosto`);
  }
});

t('limites próprios: o laço do Caderno, a estrela do Cinema, as fitas do Recorte e a barra do Visor ficam na tela', () => {
  const larga = { fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf'), mono: 'JetBrainsMono-Bold.ttf', acento: 'Poppins-Bold.ttf' } };
  const pedido = { ...pedidoBase(), chamada: { texto: 'Organização extraordinária semanal', palavra: 'Extraordinária', ini: 0.5, fim: 3.2 } };
  const { r: K } = comAvisos(() => monta('caderno', { marca: tema(larga), pedido }));
  const laco = camada(K, 'titulo-laco'), tit = camada(K, 'titulo');
  const mt = K.medidas.filter((x) => x.texto === tit.sourceText.text && x.size === tit.sourceText.fontSize).pop();
  assert.ok(540 + mt.w / 2 + 70 <= 1040, `o laço do Caderno sai da tela (${540 + mt.w / 2 + 70})`);
  assert.ok(laco);
  const { r: Ci } = comAvisos(() => monta('cinema', { marca: tema(larga), pedido }));
  const tc = camada(Ci, 'titulo');
  const mc = Ci.medidas.filter((x) => x.texto === tc.sourceText.text && x.size === tc.sourceText.fontSize).pop();
  assert.ok(540 + mc.w / 2 + 10 + 22 <= 1040, 'a estrela do Cinema sai da tela');
  const { r: R } = comAvisos(() => monta('recorte', { marca: tema(larga), pedido: { ...pedido, chamada: { ...pedido.chamada, texto: 'Organização extraordinária semanal sem culpa' } } }));
  textos(R, /^fita-/).forEach((c) => {
    const [x0, x1] = extensao(R, c);
    assert.ok(x0 - 45 >= 40 && x1 + 45 <= 1040, `fita ${textoCheio(R, c)} sai da tela (${Math.round(x0 - 45)} a ${Math.round(x1 + 45)})`);
  });
  const { r: V } = comAvisos(() => monta('visor', { marca: tema(larga), fala: palavras.map((p, i) => (i === 12 ? { ...p, w: 'extraordinariamente' } : p)) }));
  V.camadas.filter((c) => c.name === 'barra').forEach((b) => assert.ok(b.transform.position[0] >= 40 && b.transform.position[0] + b.rect.size[0] <= 1016, 'a barra do Visor sai da moldura'));
  const tv = camada(V, 'titulo');
  const [vx0, vx1] = extensao(V, tv);
  assert.ok(vx0 >= 40 && vx1 <= 1016, 'o título do Visor sai da moldura');
});

t('piso do encolher: texto que não cabe nem com 40% do corpo não lança o erro cru da medição', () => {
  const larga = { fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf') } };
  const enorme = 'A'.repeat(90);
  for (const m of LOTE) {
    const pedido = { ...pedidoBase(), palavraTela: { texto: enorme, ini: 12.9, fim: 14.5 }, chamada: { texto: enorme + ' semana', palavra: enorme, ini: 0.5, fim: 3.2 } };
    try { comAvisos(() => monta(m, { marca: tema(larga), pedido })); } catch (e) {
      assert.ok(!/maior que a área de medição/.test(e.message), `${m}: ${e.message}`);
      assert.ok(/^marca: /.test(e.message), `${m}: ${e.message}`);
    }
  }
});

// ---------- rodada de correção (revisão do item 6.3) ----------
t('piso do encolher: texto que ainda não cabe no piso avisa no log qual texto sai da tela (uma vez por texto)', () => {
  const larga = { fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf'), mono: 'JetBrainsMono-Bold.ttf', acento: 'Poppins-Bold.ttf' } };
  // 90 letras: no piso ainda dá para medir em todos os modelos (com 100, a legenda do Impacto nem mede no último corpo e
  // sai o erro em português do caso de baixo), e não cabe em nenhum
  const longa = 'a'.repeat(90);
  const fala = palavras.map((p, i) => (i === 12 ? { ...p, w: longa } : p));
  for (const m of LOTE) {
    const { avisos } = comAvisos(() => monta(m, { marca: tema(larga), fala }));
    const doPiso = avisos.filter((a) => /^\[marca\] .*sai da tela/.test(a));
    assert.ok(doPiso.some((a) => a.toLowerCase().includes(longa)), `${m}: esperava o aviso do piso com o texto (${avisos.join(' | ')})`);
    assert.strictEqual(new Set(doPiso).size, doPiso.length, `${m}: aviso repetido`);
  }
});

t('Neon: com o escuro da marca claro (fundo volta ao do estilo), o destaque na tela final segue o brilho da marca no miolo', () => {
  const marca = tema({ cores: { escuro: '#D8E4EA', acento: '#F2994A' } });
  const pedido = { ...pedidoBase(), destaques: ['importa'], palavraTela: { texto: 'ORGANIZE', ini: 11.0, fim: 14.5 } };
  const { r: P } = comAvisos(() => monta('neon', { marca, pedido }));
  const d = textos(P, /^destaque-importa/);
  assert.strictEqual(d.length, 2);
  assert.ok(mesmaCor(d[0].sourceText.fillColor, hex('#F2994A')), 'brilho do destaque no acento da marca');
  const miolo = d[1].sourceText.fillColor;
  assert.ok(!mesmaCor(miolo, [0.88, 1, 1, 1]), 'o miolo voltou ao ciano do estilo com o brilho da marca');
  assert.ok(miolo[0] > miolo[2], 'o miolo não é o acento clareado');
  assert.ok(temaMarca.contrasteOk(miolo, camada(P, 'tela-fundo').rect.fillColor, 4.5));
  // brilho sem contraste na tela: brilho e miolo voltam juntos ao par do estilo
  const ruim = tema({ cores: { escuro: '#D8E4EA', acento: '#0A1A20' } });
  const { r: Q } = comAvisos(() => monta('neon', { marca: ruim, pedido }));
  const q = textos(Q, /^destaque-importa/);
  assert.ok(mesmaCor(q[0].sourceText.fillColor, [0.45, 0.96, 1, 1]) && mesmaCor(q[1].sourceText.fillColor, [0.88, 1, 1, 1]), 'devia voltar ao par do estilo');
});

t('Vitrine com marca: o destaque que atravessa a borda do B-roll de tela cheia troca de cor na borda', () => {
  const pedido = { ...pedidoBase(), destaques: ['nenhuma'] }; // 9,9 a 10,18 s: começa na imagem e termina sobre o vídeo
  for (const marca of [tema(AURORA), tema(BOREAL)]) {
    const P = monta('vitrine', { marca, pedido });
    const d = textos(P, /^destaque-nenhuma/);
    assert.ok(d.length >= 2, 'o destaque devia ter um trecho de cada lado da borda');
    d.filter((c) => mesmaCor(c.sourceText.fillColor, [0.08, 0.08, 0.1, 1])).forEach((c) =>
      assert.ok(c.activeRange.start + c.activeRange.duration <= 10100, `${c.name} escuro depois da borda`));
    const depois = d.filter((c) => c.activeRange.start === 10100);
    assert.ok(depois.length === 1 && mesmaCor(depois[0].sourceText.fillColor, hex(marca.cores.acento)), 'faltou o destaque no acento depois da borda');
  }
  // sem marca, também (decisão D7 C): depois da borda, o destaque na cor do estilo, com sombra
  const S = textos(monta('vitrine', { pedido }), /^destaque-nenhuma/);
  assert.strictEqual(S.length, 2);
  const sd = S.find((c) => c.activeRange.start === 10100);
  assert.ok(sd && mesmaCor(sd.sourceText.fillColor, [0.88, 0.92, 0.96, 1]) && sd.dropShadow, 'sem marca, o destaque depois da borda');
});

// ---------- item 6.6B: decisões do responsável (D3 B, D4 B, D7 C) ----------
t('sem marca também (D7 C): a frase escura nunca fica sobre o vídeo depois do B-roll (Vitrine, Cinema e Caderno)', () => {
  const casos = [['vitrine', /^fina-/, [0.08, 0.08, 0.1, 1]], ['cinema', /^leg-/, [0.1, 0.09, 0.08, 1]], ['caderno', /^mao-/, [0.11, 0.13, 0.2, 1]]];
  for (const [m, re, tinta] of casos) {
    const P = monta(m);
    const escuras = textos(P, re).filter((c) => !/apagada/.test(c.name) && mesmaCor(c.sourceText.fillColor, tinta));
    assert.ok(escuras.length > 1, m);
    escuras.forEach((c) => assert.ok(c.activeRange.start >= 5300 && c.activeRange.start + c.activeRange.duration <= 10100,
      `${m}: ${c.name} escura fora do B-roll (${c.activeRange.start} a ${c.activeRange.start + c.activeRange.duration})`));
    assert.ok(textos(P, re).some((c) => c.activeRange.start === 10100), `${m}: faltou a continuação depois da borda`);
  }
});

t('Caderno (D7 C): o título com o laço fica em y 1385, com ou sem marca (longe do queixo)', () => {
  for (const marca of [null, tema(AURORA), tema(BOREAL)]) {
    const P = monta('caderno', { marca });
    assert.strictEqual(camada(P, 'titulo').transform.position[1], 1385);
  }
});

t('Impacto (D3 B): com a letra da marca, legenda e destaque em caixa alta; sem marca, como era', () => {
  for (const m of [AURORA, BOREAL]) {
    const P = monta('impacto', { marca: tema(m) });
    const tx = textos(P, /^(leg-|grande-)/);
    assert.ok(tx.length > 3 && tx.every((c) => c.sourceText.allCaps), 'caixa alta');
  }
  // pedido só com a cor (a letra continua a condensada do estilo, que só tem maiúsculas): nada muda
  const S = monta('impacto', { marca: tema({ cores: { acento: '#F2994A' } }) });
  assert.ok(textos(S, /^(leg-|grande-)/).every((c) => !c.sourceText.allCaps));
});

t('duas empresas em seguida: a marca de uma não aparece no vídeo da outra', () => {
  for (const m of LOTE) {
    monta(m, { marca: tema(AURORA) });
    const b = monta(m, { marca: tema(BOREAL) });
    assert.ok(!json(b).includes('Poppins') && !temCor(b, '#F2994A') && !temCor(b, '#3A1F14'), m);
    assert.strictEqual(digital(monta(m)), ANTES[m]);
  }
});

console.log(`\n${n} casos ok, ${falhas} falharam`);
if (falhas) process.exit(1);
