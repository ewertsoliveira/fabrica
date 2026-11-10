#!/usr/bin/env node
// Testes da base do caminho inverso (estilos/_inverso.js) com a marca. Rode: node 08-FERRAMENTAS/tesseract/modelos/inverso.test.js
// Não precisa do Tesseract: o projeto é o do motor de verdade, com a importação de letras e a medição de texto trocadas por
// versões falsas e determinísticas (a largura sai do número de letras e de um fator por arquivo). Assim as camadas são as
// que o motor monta, e dá para provar que, sem marca, cada modelo gera exatamente as mesmas camadas de antes (impressão
// digital guardada abaixo, tirada da base antes da marca) e que, com marca, as cores e letras chegam às camadas.
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

const INVERSOS = ['revista-dominical', 'protagonista', 'fanzine', 'terra-e-salvia', 'cartilha', 'circuito-neon', 'gravura',
  'primeira-pagina', 'contraste', 'papelaria', 'colagem', 'editorial'];

// largura relativa de cada letra (fração do corpo por caractere), para a medição falsa; as condensadas mais estreitas
const LARGURA = { Poppins: 0.66, DMSerifDisplay: 0.5, JetBrainsMono: 0.6, SpaceMono: 0.6, Fraunces: 0.52, InstrumentSerif: 0.4,
  Oswald: 0.42, CormorantGaramond: 0.42, Anton: 0.4 };
// modelos próprios (sem a base _inverso) que também leem a marca, e os arranjos do B-roll (null = o arranjo do modelo)
const PROPRIOS = ['concreto-acido', 'luz-de-vela'];
const ARRANJOS = [null, 'imagem-mini', 'rosto-mini', 'dividir', 'lado-a-lado', 'recorte'];
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

// palavras e pedido parecidos com o da demonstração (vídeo de 14,5 s)
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
function monta(nome, { marca = null, acento = null, pedido = pedidoBase(), fala = palavras } = {}) {
  const P = projetoFalso();
  const cenas = [{ img: 'x.png', ini: 5.3, fim: 10.1, cena: 'x.png', id: 'cena-0' }];
  cenas.forEach((c) => P.importaImagem(c.id));
  const modelo = require('./estilos/' + nome);
  modelo.montar({ P, DUR: 14500, palavras: fala.map((p) => ({ ...p })), temMatte: false, arquivoMatte: null, pedido, cenas, acento, marca });
  return P;
}
// a fala deslocada no tempo: com algum deslocamento, uma frase começa ou termina poucos ms antes da borda do B-roll (no
// vídeo de demonstração, "tudo antes" começa 80 ms antes da imagem)
const deslocada = (d) => palavras.map((p) => ({ ...p, ini: p.ini + d, fim: p.fim + d }));
const digital = (P) => crypto.createHash('sha256').update(JSON.stringify({ c: P.camadas, a: P.acoes })).digest('hex').slice(0, 16);
const textos = (P, re) => P.camadas.filter((c) => c.type === 'Text' && re.test(c.name));
const igualCor = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
// silencia (e guarda) os avisos do log durante um trecho
function comAvisos(fn) {
  const avisos = [], orig = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try { return { r: fn(), avisos }; } finally { console.warn = orig; }
}

// impressão digital das camadas de cada modelo sem marca. Mudou? Então o vídeo sem marca mudou: a regra é que ele fique
// igual, valor por valor. Tirada da base de antes da marca (item 6.1) e trocada de propósito uma vez, no item 6.6A, pelas
// correções que o responsável autorizou também sem marca (decisão D7): a frase da legenda que atravessa a borda da tela do
// B-roll passa a ser cortada na borda (os 10 modelos com a tela do B-roll; Fanzine e Editorial, na imagem pequena, não têm
// essa borda) e o cartão da imagem do Fanzine desce e encolhe (x 690, y 1140, 300 px; legenda em 1545). O Editorial não
// mudou. Antes do 6.6A: revista-dominical 2d158e4ebe090d27, protagonista ec6135bf9b4de93a, fanzine bbe609b6adbdae60,
// terra-e-salvia e3ff83c9af2e2780, cartilha 6a18ae1a9507046c, circuito-neon 223435600fd8734b, gravura 3ee4732642150cf6,
// primeira-pagina 00106599c99e694c, contraste 2c74c0830b8e99b6, papelaria cfe40f419301b1c7, colagem 86ecac255054ca99.
// Na correção do 6.6A mudaram de novo 9 delas (não a Cartilha, o Fanzine e o Editorial): o trecho que sobra do corte com
// menos de 150 ms sai, em vez de piscar, e o destaque já dito aparece cheio no trecho depois da borda.
const ANTES = {
  'revista-dominical': '2658e2bdfab425ee',
  protagonista: 'c10e3c86358ff21b',
  fanzine: '87f5ad4fc40cb539',
  'terra-e-salvia': 'ee259be3da414525',
  cartilha: '41bfb8cdb9baa8a1',
  'circuito-neon': '0f2e20a095627d4d',
  gravura: 'ff4096beebc1d0c4',
  'primeira-pagina': 'cf2cb3012e34f569',
  contraste: 'b847bfe0e39eccb0',
  papelaria: 'b1d21539e20e22ff',
  colagem: '385b2bcf7715ee1e',
  editorial: '25ec577ac5f59d6c',
};
// os dois modelos próprios, em cada arranjo, tirada do commit b9263a5 (item 6.1, antes do 6.2)
const pedidoArranjo = (layout) => (layout ? { ...pedidoBase(), rosto: { y: 820, layout } } : pedidoBase());
const ANTES_PROPRIOS = {
  'concreto-acido': '32c41c3309f8e9a2',
  'concreto-acido/imagem-mini': '08c16da7b1ed7d2f',
  'concreto-acido/rosto-mini': 'f76c56958c4ff593',
  'concreto-acido/dividir': 'f0ec1dcc187140a2',
  'concreto-acido/lado-a-lado': 'e7b3d537045d67da',
  'concreto-acido/recorte': '32c41c3309f8e9a2',
  'luz-de-vela': '0ca20b15ec2952fc',
  'luz-de-vela/imagem-mini': '3fa81eb4cdbd716c',
  'luz-de-vela/rosto-mini': '0ca20b15ec2952fc',
  'luz-de-vela/dividir': '6585bf3962f79da6',
  'luz-de-vela/lado-a-lado': '81725a3d0d8f95a9',
  'luz-de-vela/recorte': '068d629763444da7',
};
if (process.argv.includes('--digitais')) {
  for (const m of INVERSOS) console.log(`  '${m}': '${digital(monta(m))}',`);
  for (const m of PROPRIOS) for (const l of ARRANJOS) console.log(`  '${m}${l ? '/' + l : ''}': '${digital(monta(m, { pedido: pedidoArranjo(l) }))}',`);
  process.exit(0);
}

const AURORA = { cores: { escuro: '#3A1F14', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' },
  fontes: { principal: 'Poppins-Bold.ttf', mono: 'JetBrainsMono-Bold.ttf' } };
const BOREAL = { cores: { escuro: '#0E2235', claro: '#E6F1F5', acento: '#3FA7C9', neutro: '#7D96A8' },
  fontes: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'SpaceMono-Bold.ttf', acento: 'Fraunces-SemiBoldItalic.ttf' } };
const tema = (m) => temaMarca.resolver({ marca: m });

t('sem marca, os 12 modelos geram as mesmas camadas de antes', () => {
  for (const m of INVERSOS) assert.strictEqual(digital(monta(m)), ANTES[m], `o modelo ${m} mudou sem marca`);
});

// (com um acento que tem contraste no modelo: um acento sem contraste agora volta ao par do estilo, ver os casos de contraste;
// no Protagonista o acento é texto sobre o vídeo, na Papelaria é o fundo da tela com texto claro). Desde o item 6.6A o corte
// da legenda na borda do B-roll vale também sem marca, então o vídeo inteiro é igual, legenda inclusive.
t('o antigo marca.acento (só a cor de acento) gera o mesmo que o ctx.acento de antes', () => {
  for (const [m, h] of [['protagonista', '#F2994A'], ['gravura', '#F2994A'], ['papelaria', '#C0603F']]) {
    const antigo = monta(m, { acento: hex(h) });
    const novo = monta(m, { acento: hex(h), marca: temaMarca.resolver({ marca: { acento: h } }) });
    assert.strictEqual(digital(novo), digital(antigo), m);
  }
});

t('com e sem marca, a frase que atravessa a borda da tela do B-roll é cortada na borda: na tela, a cor da tela; no vídeo, a cor do vídeo', () => {
  const fimJanela = 10100;
  // nos quatro, a tela do B-roll é clara com o texto no escuro (da marca ou do estilo): a frase cortada tem, antes da borda,
  // o escuro da tela e, depois dela, uma cor que lê 4,5:1 contra esse escuro sobre o vídeo. A fala vai 120 ms mais tarde
  // para a frase seguir mais de 150 ms depois da borda (o trecho mais curto sai, ver a rodada de correção)
  for (const m of ['revista-dominical', 'terra-e-salvia', 'primeira-pagina', 'protagonista']) {
    for (const [mc, nome] of [[AURORA, 'aurora'], [null, 'sem marca']]) {
      const { r: P } = comAvisos(() => monta(m, { marca: mc ? tema(mc) : null, fala: deslocada(120) }));
      const leg = textos(P, /^leg-/);
      // nenhuma camada da legenda atravessa a borda
      leg.forEach((c) => assert.ok(!(c.activeRange.start < fimJanela && c.activeRange.start + c.activeRange.duration > fimJanela),
        `${m} (${nome}): ${c.name} "${c.sourceText.text}" atravessa a borda do B-roll`));
      const antes = leg.filter((c) => c.activeRange.start < fimJanela && c.activeRange.start + c.activeRange.duration === fimJanela);
      const depois = leg.filter((c) => c.activeRange.start === fimJanela);
      assert.ok(antes.length && depois.length, `${m} (${nome}): nenhuma frase cortada na borda do B-roll`);
      const escuro = antes[0].sourceText.fillColor;
      if (mc) assert.ok(igualCor(escuro, hex(mc.cores.escuro)), `${m} (${nome}): o trecho na tela devia estar no escuro da marca`);
      depois.forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, escuro, 4.5), `${m} (${nome}): ${c.name} sem contraste sobre o vídeo`));
    }
  }
});

t('com a aurora, as cores e as letras da marca chegam às camadas (Protagonista)', () => {
  const P = monta('protagonista', { marca: tema(AURORA) });
  const tit = textos(P, /^titulo-/);
  assert.ok(tit.length >= 2);
  tit.forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'Poppins', c.name));
  tit.forEach((c) => assert.strictEqual(c.sourceText.fontStyle, 'Bold', c.name)); // o peso pedido (Black) vira o que o arquivo tem
  tit.forEach((c) => assert.ok(igualCor(c.sourceText.fillColor, hex('#FFF1E0')), c.name)); // corTexto = claro da marca
  const leg = textos(P, /^leg-/);
  assert.ok(leg.length > 3);
  leg.forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'Poppins', c.name));
  const rot = textos(P, /^rot$/)[0];
  assert.strictEqual(rot.sourceText.fontFamily, 'JetBrainsMono');
  assert.ok(igualCor(rot.sourceText.fillColor, hex('#F2994A'))); // rótulo na cor de acento
  const fundo = P.camadas.find((c) => c.name === 'tela-fundo');
  assert.ok(igualCor(fundo.rect.fillColor, hex('#FFF1E0'))); // tela final no claro
  const barra = P.camadas.find((c) => c.name === 'barra');
  assert.ok(igualCor(barra.rect.fillColor, hex('#F2994A')));
  // nenhuma cor do estilo original sobra nos papéis trocados
  const usadas = JSON.stringify(P.camadas);
  for (const h of ['#16213A', '#ECE5D8', '#FF6B35', '#5B6478']) assert.ok(!usadas.includes(JSON.stringify(hex(h)).slice(1, -1)), h);
});

t('com a boreal, o itálico de destaque vai para a letra de acento da marca (Gravura)', () => {
  const P = monta('gravura', { marca: tema(BOREAL) });
  const tit = textos(P, /^titulo-/);
  const familias = new Set(tit.map((c) => c.sourceText.fontFamily));
  assert.deepStrictEqual([...familias].sort(), ['DMSerifDisplay', 'Fraunces']);
  const destaque = tit.find((c) => c.sourceText.text === 'Ordem');
  assert.strictEqual(destaque.sourceText.fontFamily, 'Fraunces');
  assert.strictEqual(destaque.sourceText.fontStyle, 'SemiBold Italic');
  const tela = textos(P, /^tela-/)[0];
  assert.strictEqual(tela.sourceText.fontFamily, 'Fraunces');
  assert.strictEqual(textos(P, /^rot$/)[0].sourceText.fontFamily, 'SpaceMono');
  assert.ok(igualCor(P.camadas.find((c) => c.name === 'tela-fundo').rect.fillColor, hex('#0E2235')));
});

t('marca sem itálico e sem letra de acento: o destaque em itálico fica na letra do estilo (Gravura com a aurora)', () => {
  const P = monta('gravura', { marca: tema(AURORA) });
  const destaque = textos(P, /^titulo-/).find((c) => c.sourceText.text === 'Ordem');
  assert.strictEqual(destaque.sourceText.fontFamily, 'PlayfairDisplay');
  const base = textos(P, /^titulo-/).find((c) => c.sourceText.text !== 'Ordem');
  assert.strictEqual(base.sourceText.fontFamily, 'Poppins');
});

t('destaque que não é itálico usa a letra principal da marca (Papelaria é itálico; Protagonista, sublinhado)', () => {
  const P = monta('protagonista', { marca: tema(BOREAL) });
  const d = textos(P, /^titulo-/).find((c) => c.sourceText.text === 'ORDEM');
  assert.strictEqual(d.sourceText.fontFamily, 'DMSerifDisplay');
  const Q = monta('papelaria', { marca: tema(BOREAL) });
  assert.strictEqual(textos(Q, /^titulo-/).find((c) => c.sourceText.text === 'Ordem').sourceText.fontFamily, 'Fraunces');
});

t('paleta com claro e escuro quase iguais: o texto volta ao par original do estilo e avisa no log', () => {
  const ruim = { cores: { escuro: '#D8E4EA', claro: '#E6F1F5', acento: '#E0EAF0', neutro: '#DDE7ED' } };
  const { r: P, avisos } = comAvisos(() => monta('protagonista', { marca: tema(ruim) }));
  assert.ok(avisos.length >= 1, 'esperava um aviso');
  assert.ok(avisos.every((a) => /contraste/.test(a)), avisos.join('\n'));
  // tela final: texto escuro sobre o claro, os dois do estilo
  const fundo = P.camadas.find((c) => c.name === 'tela-fundo').rect.fillColor;
  const texto = textos(P, /^tela-/)[0].sourceText.fillColor;
  assert.ok(temaMarca.contrasteOk(fundo, texto), 'a tela final ficou sem contraste');
  // título sobre o vídeo: o claro do estilo, que contrasta com o escuro
  textos(P, /^titulo-/).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, hex('#16213A')), c.name));
});

// decisão D2: o neutro da marca é um tom médio; o texto no papel neutro vai para outra cor da marca que lê 4,5:1 sobre o
// fundo real (no destaque, fora a cor do texto de base)
t('destaque no tom médio (Gravura): vai para o acento da marca, sobre o vídeo e na tela final, sem aviso (aurora e boreal)', () => {
  for (const mc of [AURORA, BOREAL]) {
    const { r: P, avisos } = comAvisos(() => monta('gravura', { marca: tema(mc) }));
    const d = textos(P, /^titulo-/).find((c) => c.sourceText.text === 'Ordem');
    assert.ok(igualCor(d.sourceText.fillColor, hex(mc.cores.acento)), 'o destaque do título devia ir para o acento da marca');
    assert.ok(igualCor(textos(P, /^tela-/)[0].sourceText.fillColor, hex(mc.cores.acento)), 'a palavra final devia ir para o acento da marca');
    // o texto de base continua no claro (o destaque segue distinto dele)
    assert.ok(igualCor(textos(P, /^titulo-/).find((c) => c.sourceText.text !== 'Ordem').sourceText.fillColor, hex(mc.cores.claro)));
    assert.deepStrictEqual(avisos, []);
  }
  // o neutro e os fios (formas) continuam no neutro da marca
  assert.ok(igualCor(monta('gravura', { marca: tema(AURORA) }).camadas.find((c) => c.name === 'painel-fio').rect.fillColor, hex(AURORA.cores.neutro)));
});

t('texto no tom médio (Editorial, o neutro é o texto claro): título, legenda, rótulo e palavra final vão para o claro da marca', () => {
  for (const mc of [AURORA, BOREAL]) {
    const { r: P, avisos } = comAvisos(() => monta('editorial', { marca: tema(mc) }));
    const tx = textos(P, /^(titulo-|leg-|rot$|tela-)/);
    assert.ok(tx.length > 5);
    tx.forEach((c) => assert.ok(igualCor(c.sourceText.fillColor, hex(mc.cores.claro)), `${c.name} "${c.sourceText.text}"`));
    assert.deepStrictEqual(avisos, []);
  }
});

t('texto no tom médio sem outra cor da marca que leia 4,5:1: fica o neutro e a regra de contraste de sempre (Gravura)', () => {
  // claro (3,5:1) e acento perto do escuro: nenhum chega a 4,5:1; o neutro da marca (claro o bastante) fica
  const fraca = { cores: { escuro: '#1A1A1A', claro: '#707070', acento: '#404040', neutro: '#E8E0D0' } };
  const { r: P } = comAvisos(() => monta('gravura', { marca: tema(fraca) }));
  assert.ok(igualCor(textos(P, /^tela-/)[0].sourceText.fillColor, hex('#E8E0D0')));
  // o pedido antigo só com o acento não tem neutro da marca: nada muda no texto do Editorial
  const antigo = monta('editorial', { acento: hex('#F2994A'), marca: temaMarca.resolver({ marca: { acento: '#F2994A' } }) });
  textos(antigo, /^titulo-/).forEach((c) => assert.ok(igualCor(c.sourceText.fillColor, hex('#F6ECE4')), c.name));
});

t('acento igual ao fundo da tela: a palavra final continua legível (Papelaria, tela no acento com destaque claro)', () => {
  const ruim = { cores: { escuro: '#0E2235', claro: '#3FA7C9', acento: '#3FA7C9', neutro: '#7D96A8' } };
  const { r: P } = comAvisos(() => monta('papelaria', { marca: tema(ruim) }));
  const fundo = P.camadas.find((c) => c.name === 'tela-fundo').rect.fillColor;
  textos(P, /^tela-/).forEach((c) => assert.ok(temaMarca.contrasteOk(fundo, c.sourceText.fillColor), c.name));
});

// extensão horizontal de um texto, pela âncora (centro da tinta) e pela largura medida
function extensao(P, c) {
  const m = P.medidas.filter((x) => x.texto === c.sourceText.text && x.size === c.sourceText.fontSize).pop();
  const cx = c.transform.position[0];
  return [cx - m.w / 2, cx + m.w / 2];
}

t('letra larga e palavra longa: título, legenda e palavra final encolhem até caber na tela', () => {
  const larga = { cores: AURORA.cores, fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf'), mono: 'JetBrainsMono-Bold.ttf' } };
  const pedido = { ...pedidoBase(), chamada: { texto: 'Organização extraordinária semanal', palavra: 'extraordinária', ini: 0.5, fim: 3.2 },
    palavraTela: { texto: 'DESORGANIZADAMENTE', ini: 12.9, fim: 14.5 } };
  for (const m of ['protagonista', 'gravura', 'cartilha']) {
    const P = monta(m, { marca: tema(larga), pedido });
    for (const c of textos(P, /^(titulo-|tela-|leg-)/)) {
      const [x0, x1] = extensao(P, c);
      assert.ok(x0 >= 40 && x1 <= 1040, `${m}: ${c.name} "${c.sourceText.text}" sai da tela (${Math.round(x0)} a ${Math.round(x1)})`);
    }
    // a última linha do título continua na mesma altura (abaixo do queixo), e a primeira não sobe acima da de antes
    const sem = monta(m, { pedido: { ...pedido, palavraTela: pedidoBase().palavraTela } });
    const topo = (Q) => Math.min(...textos(Q, /^titulo-/).map((c) => c.transform.position[1]));
    assert.ok(topo(P) >= topo(sem) - 1, `${m}: o título subiu na direção do rosto`);
  }
});

t('sem marca, a palavra longa fica como hoje (nenhum encolhimento novo)', () => {
  const pedido = { ...pedidoBase(), palavraTela: { texto: 'DESORGANIZADAMENTE', ini: 12.9, fim: 14.5 } };
  const P = monta('protagonista', { pedido });
  assert.strictEqual(textos(P, /^tela-/)[0].sourceText.fontSize, 118);
});

t('duas empresas em seguida: a marca de uma não aparece no vídeo da outra', () => {
  const a = monta('protagonista', { marca: tema(AURORA) });
  const b = monta('protagonista', { marca: tema(BOREAL) });
  const c = monta('protagonista');
  const sb = JSON.stringify(b.camadas);
  assert.ok(!sb.includes('Poppins') && !sb.includes(JSON.stringify(hex('#F2994A')).slice(1, -1)));
  assert.strictEqual(digital(c), ANTES.protagonista);
  assert.ok(JSON.stringify(a.camadas).includes('Poppins'));
});

// ---------- rodada de correção ----------
const camada = (P, nome) => P.camadas.find((c) => c.name === nome);
const corForma = (c) => c.shape.fills[0].paint.color;

t('anotação sobre a tela cheia: acento escuro da marca sobre a tela escura volta ao par do estilo e avisa (Contraste)', () => {
  const { r: P, avisos } = comAvisos(() => monta('contraste', { marca: tema({ cores: { acento: '#1B2340' } }) }));
  const nota = camada(P, 'nota'), fundo = camada(P, 'broll-fundo');
  assert.ok(temaMarca.contrasteOk(nota.sourceText.fillColor, fundo.rect.fillColor), 'a anotação ficou sem contraste sobre a tela');
  assert.ok(avisos.some((a) => /contraste/.test(a)), avisos.join('\n'));
});

t('anotação sobre a tela clara: acento claro da marca volta ao par do estilo (Fanzine em tela dividida)', () => {
  const pedido = { ...pedidoBase(), rosto: { y: 820, layout: 'dividir' } };
  const { r: P } = comAvisos(() => monta('fanzine', { pedido, marca: tema({ cores: { acento: '#EFE6D6' } }) }));
  const nota = camada(P, 'nota'), fundo = camada(P, 'broll-fundo');
  assert.ok(temaMarca.contrasteOk(nota.sourceText.fillColor, fundo.rect.fillColor), 'a anotação ficou sem contraste sobre a tela');
});

t('número do passo da Cartilha: escuro sobre o círculo de acento confere o contraste; letra principal da marca', () => {
  const { r: P, avisos } = comAvisos(() => monta('cartilha', { marca: tema({ cores: { acento: '#1A2E4A' } }) }));
  const num = camada(P, 'passo-numero'), circ = camada(P, 'passo-circulo');
  assert.ok(temaMarca.contrasteOk(num.sourceText.fillColor, corForma(circ)), 'o número ficou sem contraste sobre o círculo');
  assert.ok(avisos.some((a) => /contraste/.test(a)), avisos.join('\n'));
  const B = monta('cartilha', { marca: tema(BOREAL) });
  assert.strictEqual(camada(B, 'passo-numero').sourceText.fontFamily, 'DMSerifDisplay');
});

t('rótulo e anotação longos com marca encolhem até caber', () => {
  const pedido = { ...pedidoBase(), rotulo: 'UM RÓTULO COMPRIDO DEMAIS PARA CABER NUMA LINHA SÓ DA TELA',
    anotacao: 'três por dia, sem falta' };
  for (const m of ['protagonista', 'contraste']) {
    const { r: P } = comAvisos(() => monta(m, { pedido, marca: tema(AURORA) }));
    for (const c of textos(P, /^(rot|nota)$/)) {
      const [x0, x1] = extensao(P, c);
      assert.ok(x0 >= 40 && x1 <= 1040, `${m}: ${c.name} "${c.sourceText.text}" sai da tela (${Math.round(x0)} a ${Math.round(x1)})`);
    }
  }
});

// ---------- decisões do responsável (item 6.6A) ----------
// D1: a cor da marca deixa o texto claro (ou o acento) sem contraste num fundo liso: o fundo fica na cor da marca e o texto
// vai para o escuro da marca; só se nem o escuro lê ali, volta ao par do estilo com aviso
t('D1: tela na cor da marca e texto no escuro da marca (Papelaria, revista-dominical, Terra e Sálvia, Primeira Página)', () => {
  for (const mc of [AURORA, BOREAL]) {
    for (const [m, fundo] of [['papelaria', 'acento'], ['revista-dominical', 'claro'], ['terra-e-salvia', 'claro'], ['primeira-pagina', 'claro']]) {
      const { r: P, avisos } = comAvisos(() => monta(m, { marca: tema(mc) }));
      assert.deepStrictEqual(avisos, [], m);
      for (const f of ['broll-fundo', 'tela-fundo']) assert.ok(igualCor(camada(P, f).rect.fillColor, hex(mc.cores[fundo])), `${m}: ${f} devia ficar no ${fundo} da marca`);
      const palavra = textos(P, /^tela-/)[0].sourceText.fillColor;
      assert.ok(igualCor(palavra, hex(mc.cores.escuro)), `${m}: a palavra final devia ir para o escuro da marca`);
      assert.ok(temaMarca.contrasteOk(palavra, hex(mc.cores[fundo]), 3), m);
      // a legenda na tela do B-roll também lê sobre a cor da marca
      textos(P, /^leg-/).filter((c) => c.activeRange.start >= 5300 && c.activeRange.start < 10100)
        .forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, hex(mc.cores[fundo]), 3), `${m}: ${c.name} "${c.sourceText.text}"`));
    }
  }
});

t('D1: a pílula pequena do rótulo do Contraste fica no acento da marca, com o texto no escuro da marca', () => {
  for (const mc of [AURORA, BOREAL]) {
    const { r: P, avisos } = comAvisos(() => monta('contraste', { marca: tema(mc) }));
    assert.deepStrictEqual(avisos, []);
    assert.ok(igualCor(camada(P, 'rot-fundo').rect.fillColor, hex(mc.cores.acento)));
    assert.ok(igualCor(camada(P, 'rot').sourceText.fillColor, hex(mc.cores.escuro)));
  }
});

t('D1: se nem o escuro da marca lê sobre a cor da tela, a tela volta ao par do estilo e avisa (Papelaria)', () => {
  const media = { cores: { escuro: '#9A5A30', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' } };
  const { r: P, avisos } = comAvisos(() => monta('papelaria', { marca: tema(media) }));
  assert.ok(avisos.some((a) => /tela cheia: .*nem no escuro dela; usando o par original do estilo/.test(a)), avisos.join('\n'));
  assert.ok(igualCor(camada(P, 'tela-fundo').rect.fillColor, hex('#CF4F20')), 'a tela devia voltar ao acento do estilo');
  assert.ok(temaMarca.contrasteOk(textos(P, /^tela-/)[0].sourceText.fillColor, hex('#CF4F20')));
});

t('D1 não vale sobre o vídeo nem para o texto que já é o escuro: o número da Cartilha (escuro sobre o acento) volta ao estilo', () => {
  const { r: P, avisos } = comAvisos(() => monta('cartilha', { marca: tema({ cores: { escuro: '#0E2235', acento: '#1A2E4A' } }) }));
  assert.ok(avisos.some((a) => /"escuro" sobre "acento" fica sem contraste .* da marca; usando o par original do estilo/.test(a)), avisos.join('\n'));
  assert.ok(temaMarca.contrasteOk(camada(P, 'passo-numero').sourceText.fillColor, corForma(camada(P, 'passo-circulo'))));
});

// D4: a anotação é a letra de mão do estilo; com qualquer marca ela fica, e só a cor muda
t('D4: a anotação fica na letra de mão do estilo também com a letra de acento da marca (Fanzine e Contraste)', () => {
  for (const m of ['fanzine', 'contraste']) {
    const P = monta(m, { marca: tema(BOREAL) });
    assert.strictEqual(camada(P, 'nota').sourceText.fontFamily, 'Caveat', m);
    assert.ok(igualCor(camada(P, 'nota').sourceText.fillColor, hex(BOREAL.cores.acento)), m);
  }
});

// D7: o cartão da imagem do Fanzine desce e encolhe (longe da mandíbula), com e sem marca; a legenda da imagem desce junto
t('D7: no Fanzine, o cartão da imagem fica em x 690, y 1140, 300 px, e a legenda da imagem em 1545 (com e sem marca)', () => {
  for (const mc of [null, AURORA]) {
    const { r: P } = comAvisos(() => monta('fanzine', { marca: mc ? tema(mc) : null }));
    assert.deepStrictEqual(camada(P, 'cena-0').transform.position.map(Math.round), [840, 1290]);
    assert.deepStrictEqual(camada(P, 'img-borda').rect.size.map(Math.round), [324, 324]);
    const naImagem = textos(P, /^leg-/).filter((c) => c.activeRange.start >= 5300 && c.activeRange.start < 10100);
    assert.ok(naImagem.length && naImagem.every((c) => Math.round(c.transform.position[1]) === 1545), 'legenda da imagem em 1545');
    // em outro arranjo, nada disso vale
    const D = monta('fanzine', { pedido: { ...pedidoBase(), rosto: { y: 820, layout: 'dividir' } } });
    assert.ok(Math.round(camada(D, 'cena-0').transform.position[1]) !== 1290);
  }
});

// ---------- rodada de correção do item 6.6A ----------
const COM_TELA = INVERSOS.filter((m) => !['fanzine', 'editorial'].includes(m));

t('o corte na borda do B-roll não deixa trecho de legenda piscando: nenhuma camada leg-* com menos de 150 ms', () => {
  const curtas = [];
  for (const m of COM_TELA) for (const mc of [null, AURORA]) for (let d = -360; d <= 360; d += 20) {
    const { r: P } = comAvisos(() => monta(m, { marca: mc ? tema(mc) : null, fala: deslocada(d) }));
    for (const c of P.camadas.filter((x) => /^leg-/.test(x.name) && x.activeRange && x.activeRange.duration < 150))
      curtas.push(`${m}${mc ? ' (aurora)' : ''} d=${d}: ${c.name} ${c.activeRange.start}+${c.activeRange.duration} ms`);
  }
  assert.deepStrictEqual(curtas.slice(0, 5), [], `${curtas.length} camadas curtas: ${curtas.slice(0, 5).join("; ")}`);
});

t('o trecho curto descartado não leva a frase: o resto dela continua do outro lado da borda', () => {
  // deslocamento em que uma frase começa pouco antes do B-roll (5300 ms): ela aparece só sobre a tela, desde a borda
  for (const m of COM_TELA) for (let d = -360; d <= 360; d += 20) {
    const P = monta(m, { fala: deslocada(d) });
    const leg = P.camadas.filter((x) => /^leg-\d/.test(x.name));
    const naBorda = leg.filter((c) => c.activeRange.start === 5300);
    for (const c of naBorda) assert.ok(c.activeRange.duration >= 150, `${m} d=${d}`);
  }
});

t('no trecho depois do corte, o destaque já dito aparece cheio (o sublinhado, a tarja ou a pílula não crescem de novo)', () => {
  // "planejo" (destaque) dito antes da borda de 5300 ms, na frase que atravessa a borda
  const fala = palavras.map((p) => ({ ...p }));
  const i = fala.findIndex((p) => p.w === 'planejo');
  const desl = 5180 - fala[i].ini; // planejo em 5180 ms: 120 ms antes da imagem
  const f2 = fala.map((p) => ({ ...p, ini: p.ini + desl, fim: p.fim + desl }));
  let vistos = 0;
  for (const m of ['protagonista', 'cartilha', 'circuito-neon', 'revista-dominical']) {
    const P = monta(m, { fala: f2 });
    const kfs = new Map(P.acoes.filter((a) => a.type === 'setFxPropertyKeyframes').map((a) => [`${a.property.layerId}|${a.property.propertyType}`, a]));
    const formas = P.camadas.filter((c) => /^leg-(dst|fio)\d/.test(c.name));
    for (const c of formas) {
      const cresce = kfs.has(`${c.id}|scaleX`);
      const depoisDaBorda = c.activeRange.start === 5300;
      if (depoisDaBorda) { vistos++; assert.ok(!cresce, `${m}: ${c.name} cresce de novo depois da borda`); }
      else if (c.activeRange.start > 5000 && c.activeRange.start < 5300) assert.ok(cresce, `${m}: ${c.name} devia crescer quando a palavra é dita`);
    }
  }
  assert.ok(vistos >= 2, 'o caso não montou um destaque depois da borda');
});

// ---------- modelos próprios: Concreto Ácido e Luz de Vela (item 6.2) ----------
const cores = (P) => JSON.stringify(P.camadas);
const temCor = (P, h) => cores(P).includes(JSON.stringify(hex(h)).slice(1, -1));
// extensão de um texto; a legenda progressiva do Concreto tem o nome "leg-<frase>" e começa só com a primeira palavra
function extensaoTexto(P, c) {
  const texto = /^leg-\D/.test(c.name) ? c.name.slice(4) : c.sourceText.text;
  const m = P.medidas.filter((x) => x.texto === texto && x.size === c.sourceText.fontSize).pop();
  const cx = c.transform.position[0];
  return [cx - m.w / 2, cx + m.w / 2];
}

t('sem marca, Concreto Ácido e Luz de Vela geram as mesmas camadas de antes, em todos os arranjos', () => {
  for (const m of PROPRIOS) for (const l of ARRANJOS) {
    const k = m + (l ? '/' + l : '');
    assert.strictEqual(digital(monta(m, { pedido: pedidoArranjo(l) })), ANTES_PROPRIOS[k], `o modelo ${k} mudou sem marca`);
  }
});

t('o antigo marca.acento gera o mesmo que o ctx.acento de antes (Concreto Ácido e Luz de Vela)', () => {
  // (no Luz de Vela, com a marca o brilho gira o matiz até o acento, item 6.6B, decisão D5 B: tirando o giro, é o mesmo)
  // (os ids de efeito e de máscara andam um a cada giro: ficam de fora)
  const semId = (k, v) => (k === 'effectId' || (k === 'id' && typeof v === 'number' && v >= 5000) ? undefined : v);
  const semGiro = (P) => JSON.stringify({ c: P.camadas.map((c) => ({ ...c, effects: c.effects.filter((e) => e.effect.type !== 'hueSaturation').map((e) => e.effect) })), a: P.acoes }, semId);
  for (const m of PROPRIOS) {
    const antigo = monta(m, { acento: hex('#F2994A') });
    const novo = monta(m, { acento: hex('#F2994A'), marca: temaMarca.resolver({ marca: { acento: '#F2994A' } }) });
    if (m === 'luz-de-vela') assert.strictEqual(semGiro(novo), semGiro(antigo), m);
    else assert.strictEqual(digital(novo), digital(antigo), m);
  }
});

t('com a aurora, as cores e as letras da marca chegam às camadas (Concreto Ácido)', () => {
  for (const l of ARRANJOS) {
    const P = monta('concreto-acido', { marca: tema(AURORA), pedido: pedidoArranjo(l) });
    const tx = textos(P, /^(titulo-|leg-|dst-|tela-)/);
    assert.ok(tx.length > 5, l);
    tx.forEach((c) => assert.strictEqual(c.sourceText.fontFamily, 'Poppins', `${l}: ${c.name}`));
    tx.forEach((c) => assert.strictEqual(c.sourceText.fontStyle, 'Bold', `${l}: ${c.name}`));
    assert.strictEqual(textos(P, /^rot$/)[0].sourceText.fontFamily, 'JetBrainsMono');
    assert.ok(igualCor(camada(P, 'tela-fundo').rect.fillColor, hex('#3A1F14')), 'tela no escuro da marca');
    assert.ok(igualCor(camada(P, 'tela-faixa').rect.fillColor, hex('#F2994A')), 'faixa no acento da marca');
    assert.ok(igualCor(camada(P, 'barra').rect.fillColor, hex('#F2994A')));
    assert.ok(igualCor(camada(P, 'tela-palavra').sourceText.fillColor, hex('#3A1F14')), 'palavra no escuro sobre a faixa');
    assert.ok(igualCor(camada(P, 'titulo-1').sourceText.fillColor, hex('#FFF1E0')), 'título no claro da marca');
    for (const h of ['#0B0B0B', '#F2F0E8', '#D4FF3A']) assert.ok(!temCor(P, h), `${l}: sobrou a cor do estilo ${h}`);
  }
});

t('Luz de Vela: o itálico de destaque vai para a letra de acento da boreal; sem itálico nem acento (aurora), fica a do estilo', () => {
  const B = monta('luz-de-vela', { marca: tema(BOREAL) });
  assert.strictEqual(camada(B, 'titulo-1').sourceText.fontFamily, 'Fraunces');
  assert.strictEqual(camada(B, 'titulo-1').sourceText.fontStyle, 'SemiBold Italic');
  assert.strictEqual(camada(B, 'titulo-2').sourceText.fontFamily, 'DMSerifDisplay');
  assert.strictEqual(camada(B, 'tela-palavra').sourceText.fontFamily, 'Fraunces');
  assert.strictEqual(camada(B, 'rot').sourceText.fontFamily, 'SpaceMono');
  const leg = textos(B, /^leg-/);
  assert.ok(leg.some((c) => c.sourceText.fontFamily === 'Fraunces') && leg.some((c) => c.sourceText.fontFamily === 'DMSerifDisplay'));
  assert.ok(igualCor(camada(B, 'tela-fundo').rect.fillColor, hex('#0E2235')));
  assert.ok(igualCor(camada(B, 'tela-palavra').sourceText.fillColor, hex('#3FA7C9')));
  for (const h of ['#0B0A09', '#F3EBDD', '#E2B455']) assert.ok(!temCor(B, h), `sobrou a cor do estilo ${h}`);
  const A = monta('luz-de-vela', { marca: tema(AURORA) });
  assert.strictEqual(camada(A, 'titulo-1').sourceText.fontFamily, 'CormorantGaramond');
  assert.strictEqual(camada(A, 'titulo-2').sourceText.fontFamily, 'Poppins');
  assert.strictEqual(camada(A, 'rot').sourceText.fontFamily, 'JetBrainsMono');
});

t('paleta com claro e escuro quase iguais: Concreto Ácido e Luz de Vela voltam ao par do estilo e avisam', () => {
  const ruim = { cores: { escuro: '#D8E4EA', claro: '#E6F1F5', acento: '#E0EAF0', neutro: '#DDE7ED' } };
  for (const l of [null, 'dividir']) {
    const { r: C, avisos } = comAvisos(() => monta('concreto-acido', { marca: tema(ruim), pedido: pedidoArranjo(l) }));
    assert.ok(avisos.length && avisos.every((a) => /^\[marca\] .*contraste/.test(a)), avisos.join('\n'));
    const fundo = camada(C, 'broll-fundo').rect.fillColor;
    textos(C, /^leg-/).filter((c) => c.activeRange && c.activeRange.start >= 5300 && c.activeRange.start < 10100)
      .forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, fundo), `${l}: ${c.name} sem contraste na tela`));
    assert.ok(temaMarca.contrasteOk(camada(C, 'tela-palavra').sourceText.fillColor, camada(C, 'tela-faixa').rect.fillColor), 'palavra sobre a faixa');
    assert.ok(temaMarca.contrasteOk(camada(C, 'rot').sourceText.fillColor, camada(C, 'rot-fundo').rect.fillColor), 'rótulo');
    textos(C, /^titulo-[1-9]/).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, hex('#0B0B0B'), 4.5), c.name));
  }
  const { r: L, avisos } = comAvisos(() => monta('luz-de-vela', { marca: tema(ruim) }));
  assert.ok(avisos.length && avisos.every((a) => /^\[marca\] .*contraste/.test(a)), avisos.join('\n'));
  const fundo = camada(L, 'tela-fundo').rect.fillColor;
  assert.ok(temaMarca.contrasteOk(camada(L, 'tela-palavra').sourceText.fillColor, fundo), 'palavra final sem contraste');
  const fb = camada(L, 'broll-fundo').rect.fillColor;
  textos(L, /^leg-/).filter((c) => c.activeRange && c.activeRange.start >= 5300 && c.activeRange.start < 10100)
    .forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, fb), `${c.name} sem contraste na tela`));
  textos(L, /^(titulo-|rot$)/).forEach((c) => assert.ok(temaMarca.contrasteOk(c.sourceText.fillColor, hex('#0B0A09'), 4.5), c.name));
});

t('acento igual ao escuro: o destaque do Concreto Ácido (escuro sobre a faixa) volta ao par do estilo', () => {
  const ruim = { cores: { escuro: '#14213D', acento: '#1B2A4A' } };
  const { r: P, avisos } = comAvisos(() => monta('concreto-acido', { marca: tema(ruim) }));
  assert.ok(avisos.some((a) => /faixa/.test(a)), avisos.join('\n'));
  for (const [t1, f] of [['tela-palavra', 'tela-faixa'], ['titulo-0', 'titulo-faixa']])
    assert.ok(temaMarca.contrasteOk(camada(P, t1).sourceText.fillColor, camada(P, f).rect.fillColor), t1);
});

t('letra larga e palavra longa: no Concreto Ácido e na Luz de Vela, título, legenda e palavra final cabem e o título não sobe', () => {
  const larga = { cores: AURORA.cores, fontes: { principal: path.join(FONTES, 'Poppins-Bold.ttf'), mono: 'JetBrainsMono-Bold.ttf' } };
  // no lado a lado do Concreto, o título vai numa coluna de 460 px: a palavra de 14 letras não cabe nem na letra condensada
  // do estilo; ali vale a chamada da demonstração, que a letra larga da marca estoura sem encolher
  const longa = { texto: 'Extraordinária organização semanal', palavra: 'Extraordinária', ini: 0.5, fim: 3.2 };
  for (const m of PROPRIOS) for (const l of [null, 'dividir', 'lado-a-lado']) {
    const chamada = m === 'concreto-acido' && l === 'lado-a-lado' ? pedidoBase().chamada : longa;
    const pedido = { ...pedidoArranjo(l), chamada, palavraTela: { texto: 'DESORGANIZADAMENTE', ini: 12.9, fim: 14.5 } };
    const P = monta(m, { marca: tema(larga), pedido });
    for (const c of textos(P, /^(titulo-|tela-|leg-|dst-|rot$)/)) {
      const [x0, x1] = extensaoTexto(P, c);
      assert.ok(x0 >= 40 && x1 <= 1040, `${m}${l ? '/' + l : ''}: ${c.name} "${c.sourceText.text}" sai da tela (${Math.round(x0)} a ${Math.round(x1)})`);
    }
    const sem = monta(m, { pedido: { ...pedido, palavraTela: pedidoBase().palavraTela } });
    const topo = (Q) => Math.min(...textos(Q, /^titulo-/).map((c) => c.transform.position[1]));
    assert.ok(topo(P) >= topo(sem) - 1, `${m}: o título subiu na direção do rosto`);
  }
});

t('duas empresas em seguida nos modelos próprios: a marca de uma não aparece na outra', () => {
  for (const m of PROPRIOS) {
    monta(m, { marca: tema(AURORA) });
    const b = monta(m, { marca: tema(BOREAL) });
    assert.ok(!cores(b).includes('Poppins') && !temCor(b, '#F2994A'), m);
    assert.strictEqual(digital(monta(m)), ANTES_PROPRIOS[m]);
  }
});

console.log(`\n${n} casos ok, ${falhas} falharam`);
if (falhas) process.exit(1);
