// Mede a caixa real (largura, topo e base dos glifos) de palavras renderizadas pela própria Tesseract.
// Uso: node medir-palavras.js "palavra1|palavra2|..." [tamanho] [estilo] [larguraFonte] [tracking] [caixaAlta]
// Saída: JSON { palavra: { w, top, bottom } } com coordenadas relativas ao topo da caixa de texto.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { PNG } = require('pngjs');
const fontes = require('../fontes');

const T = path.join(process.env.LOCALAPPDATA, 'Tesseract', 'bin', 'tsrct.cmd');

const palavras = (process.argv[2] || '').split('|').filter(Boolean);
const tam = Number(process.argv[3] || 92);
const estilo = process.argv[4] || 'ExtraBold';
const wdth = process.argv[5] ? Number(process.argv[5]) : null;
const tracking = process.argv[6] ? Number(process.argv[6]) : -25;
const caixaAlta = process.argv[7] === '1';
const LINHA = Math.max(200, tam * 1.6); // altura de cada faixa de medição
const BOX_H = Math.max(140, Math.round(tam * 1.4));

const POR_QUADRO = Math.floor((1920 - 40 - BOX_H) / LINHA) + 1; // faixas que cabem num quadro de 1920px
const run = (...args) => execFileSync('cmd.exe', ['/c', T, ...args], { encoding: 'utf8' });
const res = {};

// mede em lotes: com muitas palavras, as últimas faixas cairiam fora do quadro e voltariam com largura negativa
for (let ini = 0; ini < palavras.length; ini += POR_QUADRO) {
  const lote = palavras.slice(ini, ini + POR_QUADRO);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsrct-medir-'));
  const proj = path.join(dir, 'm.tsrct');
  run('project', 'create', '-p', proj);
  const FAM = fontes.importar(run, proj, 'principal');

  const acoes = [{
    type: 'createFxRectLayer', compositionId: 'main', layerId: 1, name: 'fundo',
    activeRange: { start: 0, duration: 1000 },
    transform: { anchorPoint: [0, 0], position: [0, 0], scale: [100, 100], rotation: 0, opacity: 100 },
    rect: { position: [0, 0], size: [1080, 1920], fillColor: [0, 0, 0, 1] },
  }];
  lote.forEach((p, i) => acoes.push({
    type: 'createFxTextLayer', compositionId: 'main', layerId: 10 + i, name: 'p' + i, insertIndex: 0,
    activeRange: { start: 0, duration: 1000 },
    transform: { anchorPoint: [0, 0], position: [90, 40 + i * LINHA], scale: [100, 100], rotation: 0, opacity: 100 },
    sourceText: { text: p, fontFamily: FAM.familia, fontStyle: FAM.estilo(estilo), fontSize: tam,
      fillColor: [1, 1, 1, 1], strokeWidth: 0, justification: 'center', tracking, allCaps: caixaAlta,
      ...(wdth ? FAM.variacao(500 + i, wdth) : {}),
      boxText: true, boxPosition: [0, 0], boxSize: [900, BOX_H], verticalAlign: 'center' },
  }));
  fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(acoes));
  run('project', 'apply', '-p', proj, '--actions', path.join(dir, 'a.json'));
  const png = path.join(dir, 'm.png');
  run('preview', '-p', proj, '-t', '0', '-o', png);

  const img = PNG.sync.read(fs.readFileSync(png));
  lote.forEach((p, i) => {
    const y0 = 40 + i * LINHA;
    let x0 = 1e9, x1 = -1, t0 = 1e9, t1 = -1;
    for (let y = y0; y < y0 + BOX_H; y++) for (let x = 0; x < 1080; x++) {
      if (img.data[(y * img.width + x) * 4] > 128) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); t0 = Math.min(t0, y); t1 = Math.max(t1, y); }
    }
    if (x1 < 0) throw new Error('não foi possível medir: ' + p);
    res[p] = { w: x1 - x0 + 1, top: t0 - y0, bottom: t1 - y0 };
  });
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(JSON.stringify(res));
