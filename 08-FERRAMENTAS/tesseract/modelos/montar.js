// Aplica um modelo de edição a um vídeo falado e gera o projeto do Tesseract (e, com --exportar, o MP4).
// Uso: node montar.js <modelo|todos> <pedido.json> [--exportar] [--quadros 0.5,2,6] [--saida <pasta>] [--usar-marca]
// O pedido descreve o vídeo, as palavras com tempo, os destaques, a chamada, o B-roll e, opcionalmente, a marca
// (cores e letras da empresa: pedido.marca, ou pedido.usarMarca para ler o marca.yaml; ver tema-marca.js).
// --saida: o projeto, o MP4 e a folha de quadros vão para essa pasta, e não para saida/ ao lado do pedido (o .cache das
// cenas continua ao lado do pedido). --usar-marca: vale como "usarMarca": true sem mexer no arquivo do pedido, e a marca da
// empresa vence a marca escrita no pedido; uma linha "marca-usada {...}" diz qual marca.yaml, cores e letras foram usados.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Projeto, preparaTrecho, hex } = require('./motor');
const temaMarca = require('./tema-marca');

const MODELOS = ['vitrine', 'recorte', 'neon', 'cinema', 'impacto', 'caderno', 'visor', 'bloco', 'adesivo', 'circulo', 'retro', 'faixa', 'palco',
  // caminho inverso: estilos de carrossel aprovados que viraram modelos de Reels
  'concreto-acido', 'luz-de-vela', 'revista-dominical', 'protagonista', 'fanzine', 'terra-e-salvia', 'cartilha', 'circuito-neon',
  'gravura', 'primeira-pagina', 'contraste', 'papelaria', 'colagem', 'editorial'];
const args = process.argv.slice(2);
const qual = args[0];
const pedidoPath = path.resolve(args[1] || '');
const exportar = args.includes('--exportar');
const iq = args.indexOf('--quadros');
const quadros = iq > -1 ? args[iq + 1].split(',').map(Number) : null;
const usarMarca = args.includes('--usar-marca');
const is = args.indexOf('--saida');
const saidaPedida = is > -1 ? args[is + 1] : null;
if (!qual || !fs.existsSync(pedidoPath) || (is > -1 && (!saidaPedida || saidaPedida.startsWith('--')))) {
  console.error('uso: node montar.js <' + MODELOS.join('|') + '|todos> <pedido.json> [--exportar] [--quadros 0.5,2] [--saida <pasta>] [--usar-marca]');
  process.exit(1);
}
const BASE = path.dirname(pedidoPath);
const pedido = JSON.parse(fs.readFileSync(pedidoPath, 'utf8'));
if (usarMarca) { delete pedido.marca; pedido.usarMarca = true; } // só na memória: o arquivo do pedido não muda
const SAIDA = saidaPedida ? path.resolve(saidaPedida) : path.join(BASE, 'saida');
fs.mkdirSync(SAIDA, { recursive: true });

// troca de quadro com o elemento de destaque (V-02): o B-roll fica na tela tempo bastante para a audiência assimilar a
// informação nova. Mais curto que o mínimo (pedido.brollMin, padrão 4,5 s), ele se estende até o mínimo, sem invadir o
// próximo B-roll, a tela da palavra final nem o fim do trecho.
function fimComTempoMinimo(b, i) {
  const min = pedido.brollMin ?? 4.5;
  const limites = [pedido.broll[i + 1]?.ini, pedido.palavraTela?.ini, pedido.trecho && pedido.trecho.fim - (pedido.trecho.ini || 0)]
    .filter((x) => typeof x === 'number');
  return Math.max(b.fim, Math.min(b.ini + min, ...limites));
}

// cena de B-roll: a imagem centralizada sobre um fundo liso, em 1080x1920, para entrar como uma camada só. Com `lisa`
// ('#RRGGBB', pedido pelo modelo com a marca: ver cenaLisa no Palco), o fundo é essa cor chapada, num arquivo à parte
async function preparaCenas(lisa = null) {
  const cache = path.join(BASE, '.cache');
  fs.mkdirSync(cache, { recursive: true });
  const faltam = [];
  const cenas = (pedido.broll || []).map((b, i) => {
    const arq = path.join(cache, `cena-${i}-${path.basename(b.img, '.png')}${lisa ? '-' + lisa.slice(1).toLowerCase() : ''}.png`);
    if (!fs.existsSync(arq)) faltam.push({ b, arq });
    return { ...b, fim: fimComTempoMinimo(b, i), cena: arq, id: 'cena-' + i };
  });
  if (faltam.length) {
    const { chromium } = require('playwright');
    const nav = await chromium.launch();
    const pg = await nav.newPage({ viewport: { width: 1080, height: 1920 } });
    for (const { b, arq } of faltam) {
      const src = 'data:image/png;base64,' + fs.readFileSync(path.resolve(BASE, b.img)).toString('base64');
      const fundo = lisa || `radial-gradient(circle at 50% 40%, #ffffff 0%, ${b.fundo || '#EEF0F2'} 70%)`;
      await pg.setContent(`<html><body style="margin:0;width:1080px;height:1920px;display:flex;align-items:center;justify-content:center;
        background:${fundo}">
        <img src="${src}" style="width:${b.largura || 900}px;filter:drop-shadow(0 30px 60px rgba(0,0,0,.18))"></body></html>`);
      // grava num arquivo temporário (com o pid) e só no fim troca o nome: um processo morto no meio não deixa uma cena
      // parcial no .cache, que a rodada seguinte reaproveitaria
      const parcial = arq.replace(/\.png$/, `.${process.pid}.parcial.png`);
      await pg.screenshot({ path: parcial });
      fs.renameSync(parcial, arq);
    }
    await nav.close();
  }
  return cenas;
}

(async () => {
  // tema da marca: resolvido uma vez por pedido, antes de qualquer trabalho (erro de cor ou de letra para logo aqui)
  const tema = temaMarca.resolver(pedido, { base: BASE });
  if (usarMarca) {
    // quem pediu a marca da empresa confere que foi ela mesma (a prévia na marca compara com a marca que ela assinou)
    const m = require('../../marca/marca');
    console.log('marca-usada ' + JSON.stringify({ arquivo: m.ARQUIVO, exemplo: m.EXEMPLO, empresa: m.EMPRESA, cores: tema.cores, fontes: tema.fontes, principalItalico: tema.principalItalico }));
  }
  const tr = preparaTrecho(pedido, BASE);
  const cenas = await preparaCenas();
  const lista = qual === 'todos' ? MODELOS : [qual];
  for (const nome of lista) {
    const t0 = Date.now();
    const modelo = require('./estilos/' + nome);
    // o modelo pode pedir, com a marca, a cena do B-roll com o fundo liso numa cor (o painel na cor da marca)
    const lisa = typeof modelo.cenaLisa === 'function' ? modelo.cenaLisa({ marca: tema, pedido }) : null;
    const cenasDoModelo = lisa ? await preparaCenas(lisa) : cenas;
    const P = new Projeto(path.join(SAIDA, nome + '.tsrct'));
    const DUR = P.importaVideo(tr.video);
    if (tr.matte) P.importaVideo(tr.matte, 'matte');
    cenasDoModelo.forEach((c) => P.importaImagem(c.id, c.cena));
    const ctx = { P, DUR, palavras: tr.palavras, temMatte: !!tr.matte, arquivoMatte: tr.matte, pedido, cenas: cenasDoModelo,
      // marca: o tema (cores e letras por papel) ou null, e aí o modelo fica como é; acento: a cor de acento do tema, para
      // os modelos que só trocam a cor de destaque
      marca: tema, acento: tema && tema.cores.acento ? hex(tema.cores.acento) : null };
    modelo.montar(ctx);
    const r = P.grava(DUR);
    // quadros de conferência dentro do vídeo; num vídeo mais curto que a amostra, redistribui pela duração
    let ts = (quadros || modelo.quadros || [0.5, 2, 4, 6, 7.5, 10, 13]).filter((t) => t < DUR / 1000);
    if (ts.length < 4) ts = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92].map((f) => +(f * DUR / 1000).toFixed(2));
    const pngs = ts.map((t, i) => { const f = path.join(SAIDA, `.q-${nome}-${i}.png`); P.quadro(t, f); return f; });
    // folha de contato: quadros lado a lado em 360x640
    const ins = pngs.flatMap((f) => ['-i', f]);
    const fil = pngs.map((_, i) => `[${i}]scale=360:640[v${i}]`).join(';') + ';' + pngs.map((_, i) => `[v${i}]`).join('') + `hstack=${pngs.length}`;
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', fil, path.join(SAIDA, `${nome}-quadros.png`)]);
    pngs.forEach((f) => fs.rmSync(f));
    if (exportar) P.exporta(path.join(SAIDA, nome + '.mp4'));
    console.log(JSON.stringify({ modelo: nome, ...r, segundos: Math.round((Date.now() - t0) / 1000) }));
  }
})().catch((e) => { console.error(e.stderr || (/^marca: /.test(e.message) ? e.message : e)); process.exit(1); });
