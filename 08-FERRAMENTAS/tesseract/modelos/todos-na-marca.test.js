#!/usr/bin/env node
// Os 27 modelos de Reels na marca, de uma vez só (item 6.5). Rode: node 08-FERRAMENTAS/tesseract/modelos/todos-na-marca.test.js
// Como o inverso.test.js, não precisa do Tesseract: o projeto é o do motor de verdade, com a importação de letras e a
// medição de texto trocadas por versões falsas e determinísticas (a largura sai do número de letras e de um fator por
// arquivo; o texto mais largo que a tela de medição estoura, como na medição de verdade).
// Prova, para cada um dos 27 modelos, com a marca "aurora" (quente) e com a "boreal" (fria), as duas de mentira:
//   - nenhum falha ao montar (com e sem a máscara da pessoa);
//   - sem marca, as camadas e ações são as mesmas de antes (impressão digital tirada do commit 5357797, antes deste item);
//   - a marca chega a cada modelo (a letra principal e alguma cor da marca nas camadas);
//   - o log de contraste ("[marca] ...") não acusa texto ilegível, a não ser nos casos CONHECIDOS listados abaixo, cada um
//     com o motivo (são as pendências visuais da etapa 6, para o responsável decidir olhando a página de prova).
// Com --avisos, imprime os avisos de cada modelo e marca (para conferir a lista); com --digitais, as impressões digitais.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Projeto, hex } = require('./motor');
// com --digitais, só imprime as impressões digitais de agora (sem o tema: serve também na base de antes)
const temaMarca = process.argv.includes('--digitais') ? null : require('./tema-marca');

let n = 0;
let falhas = 0;
const t = (nome, fn) => {
  try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + e.message.split('\n').join('\n       ')); }
};
const FONTES = path.join(__dirname, 'fontes');

// a mesma ordem da lista do montar.js (o primeiro caso confere que as duas listas e a pasta estilos/ batem)
const MODELOS = ['vitrine', 'recorte', 'neon', 'cinema', 'impacto', 'caderno', 'visor', 'bloco', 'adesivo', 'circulo', 'retro',
  'faixa', 'palco', 'concreto-acido', 'luz-de-vela', 'revista-dominical', 'protagonista', 'fanzine', 'terra-e-salvia', 'cartilha',
  'circuito-neon', 'gravura', 'primeira-pagina', 'contraste', 'papelaria', 'colagem', 'editorial'];
const VARIANTES = ['', 'matte'];

// largura relativa de cada letra (fração do corpo por caractere), para a medição falsa; as condensadas mais estreitas
const LARGURA = { Poppins: 0.66, DMSerifDisplay: 0.5, JetBrainsMono: 0.6, SpaceMono: 0.6, Fraunces: 0.52, InstrumentSerif: 0.4,
  Inter: 0.55, BebasNeue: 0.38, KaushanScript: 0.5, GreatVibes: 0.45, Caveat: 0.4, CourierPrime: 0.6, Oswald: 0.42,
  CormorantGaramond: 0.42, Anton: 0.4 };
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

// palavras e pedido parecidos com o da demonstração (vídeo de 14,5 s, B-roll de 5,3 a 10,1 s, rosto em y 820)
const FALA = 'Ordem na semana começa bem cedo eu planejo três tarefas por dia e deixo o resto para depois sem culpa nenhuma ' +
  'assim a semana anda e eu organizo o que importa';
const palavras = FALA.split(' ').map((w, i) => ({ w, ini: 3300 + i * 330, fim: 3300 + i * 330 + 280 }));
const pedidoBase = () => ({
  chamada: { texto: 'Ordem na semana', palavra: 'Ordem', ini: 0.5, fim: 3.2 },
  // um destaque no B-roll (planejo, 5,6 s) e outro sobre o vídeo (organizo, 12,2 s)
  destaques: ['planejo', 'organizo'],
  palavraTela: { texto: 'ORGANIZE', ini: 12.9, fim: 14.5 },
  rosto: { y: 820 },
  anotacao: 'três por dia',
});

// monta um modelo e devolve o projeto; ctx.marca é o tema (ou null), ctx.acento a cor de acento do tema (como no montar.js)
function monta(nome, { marca = null, variante = '' } = {}) {
  const P = projetoFalso();
  const cenas = [{ img: 'x.png', ini: 5.3, fim: 10.1, cena: 'x.png', id: 'cena-0' }];
  cenas.forEach((c) => P.importaImagem(c.id));
  const modelo = require('./estilos/' + nome);
  const acento = marca && marca.cores.acento ? hex(marca.cores.acento) : null;
  modelo.montar({ P, DUR: 14500, palavras: palavras.map((p) => ({ ...p })), temMatte: variante === 'matte', arquivoMatte: null,
    pedido: pedidoBase(), cenas, acento, marca });
  return P;
}
const digital = (P) => crypto.createHash('sha256').update(JSON.stringify({ c: P.camadas, a: P.acoes })).digest('hex').slice(0, 16);
const chave = (m, v) => m + (v ? '/' + v : '');

if (process.argv.includes('--digitais')) {
  for (const m of MODELOS) for (const v of VARIANTES) console.log(`  '${chave(m, v)}': '${digital(monta(m, { variante: v }))}',`);
  process.exit(0);
}

// impressão digital das camadas e ações de cada modelo sem marca, tirada do commit 5357797 (antes deste item) com
// --digitais numa cópia feita por git archive. Mudou? Então o vídeo sem marca mudou: a regra é que ele fique igual.
const ANTES = {
  // item 6.6B (D7 C, de propósito): a frase e o destaque que atravessam a borda do B-roll trocam de cor na borda
  vitrine: '0b2769483bdc93f1',
  'vitrine/matte': '0b2769483bdc93f1',
  recorte: '7e570561bf1ea96a',
  'recorte/matte': '7e570561bf1ea96a',
  neon: '106658f770514e06',
  'neon/matte': '947742f15e0cbff4',
  // item 6.6B (D7 C): o mesmo corte na borda da meia tela
  cinema: 'aad2b42f4e8b6194',
  'cinema/matte': 'aad2b42f4e8b6194',
  impacto: 'd21e7a43605477ca',
  'impacto/matte': 'd21e7a43605477ca',
  // item 6.6B (D7 C): o corte na borda da folha e o título com o laço em y 1385 (antes 1300, no queixo)
  caderno: '531e76b955052020',
  'caderno/matte': '531e76b955052020',
  visor: 'a58c83a7a179a373',
  'visor/matte': 'a58c83a7a179a373',
  // item 6.6B (D7 C): a frase que atravessa a troca de fundo é cortada na troca
  bloco: '65df3fc1ebae3b34',
  'bloco/matte': '2f0181ada78f2bf9',
  adesivo: 'af066fda347f81f7',
  'adesivo/matte': 'af066fda347f81f7',
  circulo: '6d862a47937e4732',
  'circulo/matte': 'ca23d55c9a809868',
  // item 6.6B (D7 C): o mesmo corte; título em y 1465 (antes 1380) e legenda da abertura em 1690 (antes 1590)
  retro: 'f1625dcf03bfcfa4',
  'retro/matte': 'f1625dcf03bfcfa4',
  faixa: '0070e375946c6d2b',
  'faixa/matte': '0070e375946c6d2b',
  // correção do item 6.6B (D6 B e D7 C): sem marca, a legenda do palco vai para baixo do cartão (no cartão, no queixo)
  palco: 'c1f4adc24dd362a2',
  'palco/matte': 'c1f4adc24dd362a2',
  'concreto-acido': '9fb35d22dd5b1f95',
  'concreto-acido/matte': '9fb35d22dd5b1f95',
  'luz-de-vela': 'dc02d7cb74b573c2',
  'luz-de-vela/matte': 'dc02d7cb74b573c2',
  // caminho inverso: trocadas de propósito no item 6.6A (decisão D7, autorizada pelo responsável também sem marca): a frase
  // da legenda que atravessa a borda da tela do B-roll é cortada na borda (os 10 com a tela do B-roll) e o cartão da imagem
  // do Fanzine desce e encolhe. O Editorial não mudou. Valores de antes do 6.6A: revista-dominical 28e2080049333400,
  // protagonista 824410377626a433, fanzine 0fa69f9d267d83fc, terra-e-salvia 92c4e7a62fc3c61f, cartilha f2955b250d0ca6aa,
  // circuito-neon 39961cd25eb20253, gravura d179f9e28b1df0e3, primeira-pagina 4618074bf2bc0b31, contraste e36e35119453bf1e,
  // papelaria c98e7003b75d6866, colagem 75b084a377eb9be6 (iguais com e sem a máscara). Na correção do 6.6A mudaram de novo
  // 9 delas (não a Cartilha, o Fanzine e o Editorial): o trecho que sobra do corte com menos de 150 ms sai, em vez de piscar.
  'revista-dominical': 'f65aa54a6a747b7c',
  'revista-dominical/matte': 'f65aa54a6a747b7c',
  protagonista: '39120e972c88b730',
  'protagonista/matte': '39120e972c88b730',
  fanzine: '460b4f8fcb181f35',
  'fanzine/matte': '460b4f8fcb181f35',
  'terra-e-salvia': '35441873e899eb6c',
  'terra-e-salvia/matte': '35441873e899eb6c',
  cartilha: '5ab4e261ecc598e9',
  'cartilha/matte': '5ab4e261ecc598e9',
  'circuito-neon': '9bc791385ada9b76',
  'circuito-neon/matte': '9bc791385ada9b76',
  gravura: '25667bd1972d5c60',
  'gravura/matte': '25667bd1972d5c60',
  'primeira-pagina': '2bea33f4b9fb7da0',
  'primeira-pagina/matte': '2bea33f4b9fb7da0',
  contraste: '90bdd44c4aff0398',
  'contraste/matte': '90bdd44c4aff0398',
  papelaria: 'e1ef660a9d3179cf',
  'papelaria/matte': 'e1ef660a9d3179cf',
  colagem: '4e27b9cafed7b53f',
  'colagem/matte': '4e27b9cafed7b53f',
  editorial: '695835d77e82c130',
  'editorial/matte': '695835d77e82c130',
};

const AURORA = { cores: { escuro: '#3A1F14', claro: '#FFF1E0', acento: '#F2994A', neutro: '#C46A3C' },
  fontes: { principal: 'Poppins-Bold.ttf', mono: 'JetBrainsMono-Bold.ttf' } };
const BOREAL = { cores: { escuro: '#0E2235', claro: '#E6F1F5', acento: '#3FA7C9', neutro: '#7D96A8' },
  fontes: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'SpaceMono-Bold.ttf', acento: 'Fraunces-SemiBoldItalic.ttf' } };
const MARCAS = { aurora: AURORA, boreal: BOREAL };
const PRINCIPAL = { aurora: 'Poppins', boreal: 'DMSerifDisplay' };

// avisos de contraste CONHECIDOS com as duas marcas: o modelo já cai no par do estilo (o texto fica legível), mas a marca
// sai daquela parte da tela. São pendências visuais da etapa 6, para o responsável decidir olhando. Qualquer outro aviso
// "[marca]" (contraste novo, texto que não cabe) faz o teste falhar; um conhecido que deixa de sair também, para a lista
// não ficar velha. Saíram no item 6.6A, resolvidos pelas decisões do responsável no caminho inverso: Papelaria,
// revista-dominical, Terra e Sálvia, Primeira Página (tela) e Contraste (pílula do rótulo) ficam na cor da marca com o texto no
// escuro dela (D1); Gravura e Editorial levam o texto do tom médio para outra cor da marca que lê 4,5:1 (D2).
// O do Círculo (pílula e tela com texto branco sobre acento claro) saiu no item 6.6B: o texto vai para o escuro da marca (D1).
const CONHECIDOS = [];

// silencia (e guarda) os avisos do log durante um trecho
function comAvisos(fn) {
  const avisos = [], orig = console.warn;
  console.warn = (...a) => avisos.push(a.join(' '));
  try { return { r: fn(), avisos }; } finally { console.warn = orig; }
}
const textos = (P) => P.camadas.filter((c) => c.type === 'Text');
const json = (P) => JSON.stringify(P.camadas);
const temCor = (P, h) => json(P).includes(JSON.stringify(hex(h).slice(0, 3)).slice(1, -1));

// cada modelo com cada marca e variante, montado uma vez só: { 'aurora:vitrine/matte': { P, avisos, erro } }
const montados = {};
if (process.argv.includes('--avisos')) {
  for (const [nm, mc] of Object.entries(MARCAS)) for (const m of MODELOS) {
    const { avisos } = comAvisos(() => monta(m, { marca: temaMarca.resolver({ marca: mc }), variante: 'matte' }));
    for (const a of new Set(avisos)) console.log(`${nm} ${m}: ${a}`);
  }
  process.exit(0);
}
for (const [nm, mc] of Object.entries(MARCAS)) for (const m of MODELOS) for (const v of VARIANTES) {
  const k = `${nm}:${chave(m, v)}`;
  try {
    const { r, avisos } = comAvisos(() => monta(m, { marca: temaMarca.resolver({ marca: mc }), variante: v }));
    montados[k] = { P: r, avisos };
  } catch (e) {
    montados[k] = { erro: e };
  }
}

t('a lista de modelos do teste é a do montar.js e a da pasta estilos/ (27 modelos)', () => {
  assert.strictEqual(MODELOS.length, 27);
  const src = fs.readFileSync(path.join(__dirname, 'montar.js'), 'utf8');
  const doMontar = [...src.slice(src.indexOf('const MODELOS'), src.indexOf('];', src.indexOf('const MODELOS'))).matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
  assert.deepStrictEqual(doMontar, MODELOS);
  const daPasta = fs.readdirSync(path.join(__dirname, 'estilos')).filter((f) => /^[a-z].*\.js$/.test(f)).map((f) => f.slice(0, -3)).sort();
  assert.deepStrictEqual(daPasta, [...MODELOS].sort());
});

t('sem marca, os 27 modelos geram as mesmas camadas de antes (com e sem a máscara da pessoa)', () => {
  const mudaram = [];
  for (const m of MODELOS) for (const v of VARIANTES) {
    const d = digital(monta(m, { variante: v }));
    if (d !== ANTES[chave(m, v)]) mudaram.push(`${chave(m, v)} (${d} em vez de ${ANTES[chave(m, v)]})`);
  }
  assert.deepStrictEqual(mudaram, [], 'mudaram sem marca: ' + mudaram.join(', '));
});

t('com a aurora e com a boreal, nenhum dos 27 modelos falha ao montar', () => {
  const erros = Object.entries(montados).filter(([, x]) => x.erro).map(([k, x]) => `${k}: ${x.erro.message.split('\n')[0]}`);
  assert.deepStrictEqual(erros, [], erros.join('\n'));
});

t('a marca chega a cada modelo: a letra principal e alguma cor da marca nas camadas', () => {
  const faltam = [];
  for (const [nm, mc] of Object.entries(MARCAS)) for (const m of MODELOS) {
    const x = montados[`${nm}:${m}`];
    if (!x.P) continue; // o caso anterior já acusa
    if (!textos(x.P).some((c) => c.sourceText.fontFamily === PRINCIPAL[nm])) faltam.push(`${nm}:${m} sem a letra principal`);
    if (!Object.values(mc.cores).some((h) => temCor(x.P, h))) faltam.push(`${nm}:${m} sem nenhuma cor da marca`);
  }
  assert.deepStrictEqual(faltam, [], faltam.join('\n'));
});

t('o log de contraste não acusa texto ilegível com a aurora nem com a boreal, fora os casos conhecidos (cada um com o motivo)', () => {
  const novos = [], vistos = new Set();
  for (const [k, x] of Object.entries(montados)) {
    if (!x.avisos) continue;
    const [nm, mv] = k.split(':');
    const m = mv.split('/')[0];
    for (const a of x.avisos.filter((s) => /^\[marca\]/.test(s))) {
      const i = CONHECIDOS.findIndex((c) => c.modelo === m && c.marcas.includes(nm) && c.aviso.test(a));
      if (i < 0) novos.push(`${k}: ${a}`); else vistos.add(i);
    }
  }
  const sumiram = CONHECIDOS.map((c, i) => [c, i]).filter(([, i]) => !vistos.has(i)).map(([c]) => `${c.modelo} (${c.marcas.join(', ')}): ${c.aviso}`);
  assert.deepStrictEqual(novos, [], 'aviso novo no log:\n' + [...new Set(novos)].join('\n'));
  assert.deepStrictEqual(sumiram, [], 'caso conhecido que não saiu mais (tire da lista):\n' + sumiram.join('\n'));
});

t('nos casos conhecidos, o texto que voltou ao par do estilo é legível: cada aviso diz que usa o par original', () => {
  for (const x of Object.values(montados)) for (const a of (x.avisos || []).filter((s) => /^\[marca\].*contraste/.test(s)))
    assert.ok(/original do estilo|cor do estilo|do estilo/.test(a), a);
});

t('duas empresas em seguida: a marca de uma não aparece no vídeo da outra (os 27 modelos)', () => {
  const vazou = [];
  for (const m of MODELOS) {
    const sem = monta(m);
    const b = montados[`boreal:${m}`].P;
    if (!b) continue;
    // a cor de acento da aurora e a letra principal dela, quando o modelo sem marca não as usa
    if (temCor(b, AURORA.cores.acento) && !temCor(sem, AURORA.cores.acento)) vazou.push(`${m}: cor da aurora na boreal`);
    if (textos(b).some((c) => c.sourceText.fontFamily === 'Poppins') && !textos(sem).some((c) => c.sourceText.fontFamily === 'Poppins'))
      vazou.push(`${m}: letra da aurora na boreal`);
    assert.strictEqual(digital(monta(m)), ANTES[m], `${m} sem marca mudou depois das duas marcas`);
  }
  assert.deepStrictEqual(vazou, [], vazou.join('\n'));
});

console.log(`\n${n} casos ok, ${falhas} falharam`);
if (falhas) process.exit(1);
