// Aplica uma lista de blocos de motion a um projeto .tsrct (o que o montar-video.js gerou) e grava as janelas e os sons.
//
//   node aplicar.js <projeto.tsrct> <blocos.json> [--faixa 955,1305] [--desloca SEGUNDOS] [--refazer]
//                   [--janelas janelas.json] [--sons sons.json] [--simular]
//
// blocos.json: lista de blocos [{id, tipo, inicio, fim, textos, opcoes}] ou { blocos: [...], faixa, desloca }.
// Tempos em segundos do VÍDEO EDITADO INTEIRO; --desloca soma segundos a todos (0 no vídeo inteiro, -8.333 numa amostra que começa em 8,333).
// Roda DEPOIS do montar-video.js. Não é idempotente por natureza: aqui, cada camada se chama `<id>-papel`, o script recusa um id que
// já existe no projeto e --refazer apaga as camadas e os keyframes daquele id antes de aplicar de novo.
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./tsrct');
const { montar } = require('./index');
const { FAIXA_PADRAO } = require('./nucleo');
const fontes = require('../fontes');

function camadaImagem(d, idCamada) {
  const [w, h] = d.tamanho;
  return { id: d.id, blendMode: 'normal', effects: [], layerStyles: [], masks: [], type: 'Image', name: d.nome, activeRange: d.activeRange,
    transform: { anchorPoint: [w / 2, h / 2], position: d.pos, scale: [d.escala, d.escala], rotation: 0, opacity: d.opac },
    source: { assetId: d.asset, fit: 'contain' } };
}

function aplicar(proj, blocos, { faixa = FAIXA_PADRAO, desloca = 0, refazer = false, simular = false } = {}) {
  proj = path.resolve(proj);
  const doc = T.checkout(proj);
  const camadas = doc.composition.layers;
  const idsNovos = blocos.map((b) => b.id);
  const existentes = camadas.filter((l) => idsNovos.some((id) => (l.name || '').startsWith(id + '-')));
  let removidas = 0;
  if (existentes.length) {
    if (!refazer) {
      const ids = [...new Set(idsNovos.filter((id) => existentes.some((l) => l.name.startsWith(id + '-'))))];
      throw new Error(`o projeto já tem camadas dos blocos: ${ids.join(', ')}. Aplicar de novo duplicaria tudo; use --refazer para substituir.`);
    }
    const apagar = new Set(existentes.map((l) => l.id));
    doc.composition.layers = camadas.filter((l) => !apagar.has(l.id));
    if (doc.composition.dynamics && doc.composition.dynamics.entries) {
      doc.composition.dynamics.entries = doc.composition.dynamics.entries.filter((e) => !(e.target && apagar.has(e.target.layerId)));
    }
    removidas = apagar.size;
  }
  const maxId = Math.max(0, ...doc.composition.layers.map((l) => l.id));
  const idBase = Math.max(3000, maxId + 1);
  // as fontes do contrato de marca já estão no projeto (montar-video.js); importar de novo só devolve família e estilos
  const fam = { principal: fontes.importar(T.tsrct, proj, 'principal'), mono: fontes.importar(T.tsrct, proj, 'mono') };
  const r = montar(blocos, { idBase, desloca, faixa, fontes: fam });
  const fimMax = Math.max(...blocos.map((b) => b.fim)) + desloca;
  if (doc.duration && fimMax > doc.duration + 0.001) r.avisos.push(`o último bloco termina em ${fimMax.toFixed(2)} s, depois do fim do projeto (${doc.duration} s)`);
  const resumo = { projeto: path.basename(proj), blocos: r.blocos.map((b) => ({ id: b.id, tipo: b.tipo, camadas: b.camadas.length })), acoes: r.acoes.length,
    removidas, janelas: r.janelas, avisos: r.avisos };
  if (simular) return { ...resumo, simulado: true, sons: r.sons };

  if (r.documento.length) { // camadas de imagem só entram pelo documento
    for (const arq of new Map(r.documento.map((d) => [d.asset, d.arquivo])).entries()) {
      try { T.tsrct('project', 'import-asset', '-p', proj, '--file', arq[1], '--asset-id', arq[0], '--kind', 'image'); } catch (e) { /* asset já importado */ }
    }
    doc.composition.layers = [...r.documento.map(camadaImagem), ...doc.composition.layers];
  }
  if (r.documento.length || removidas) T.commit(proj, doc);
  const res = T.apply(proj, r.acoes);
  return { ...resumo, aplicadas: res.appliedActions, sons: r.sons };
}

function lerEntrada(arq) {
  const j = JSON.parse(fs.readFileSync(path.resolve(arq), 'utf8'));
  return Array.isArray(j) ? { blocos: j } : j;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const arg = (k) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : undefined; };
  const [proj, entrada] = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && a[i - 1].startsWith('--') && !['--refazer', '--simular'].includes(a[i - 1])));
  if (!proj || !entrada) { console.error('uso: node aplicar.js <projeto.tsrct> <blocos.json> [--faixa y0,y1] [--desloca s] [--refazer] [--janelas f.json] [--sons f.json] [--simular]'); process.exit(2); }
  try {
    const E = lerEntrada(entrada);
    const faixa = arg('faixa') ? arg('faixa').split(',').map(Number) : (E.faixa || FAIXA_PADRAO);
    const desloca = arg('desloca') !== undefined ? Number(arg('desloca')) : (E.desloca || 0);
    const r = aplicar(proj, E.blocos, { faixa, desloca, refazer: a.includes('--refazer'), simular: a.includes('--simular') });
    if (arg('janelas')) fs.writeFileSync(path.resolve(arg('janelas')), JSON.stringify({ janelas: r.janelas }, null, 2));
    if (arg('sons')) fs.writeFileSync(path.resolve(arg('sons')), JSON.stringify(r.sons, null, 2));
    const { sons, ...resto } = r;
    console.log(JSON.stringify(resto, null, 1));
  } catch (e) { console.error('erro: ' + e.message); process.exit(1); }
}
module.exports = { aplicar };
