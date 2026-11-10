#!/usr/bin/env node
// Gera a prévia do catálogo de estilos: o carrossel de demonstração de cada estilo (estilos/<id>/demo.json), com as
// cores e fontes sugeridas pelo próprio estilo e a identidade fictícia da matriz.
// Uso: node 04-LABORATORIO-DE-DESIGN/estilos/previa.js [--marca] [id ...]   ->   04-LABORATORIO-DE-DESIGN/estilos/catalogo.html
// Com --marca, a mesma demonstração sai nas cores e fontes do marca.yaml da empresa (decisão visual mostrada em uso, D-01).
'use strict';
const fs = require('fs');
const path = require('path');
const molde = require('../../08-FERRAMENTAS/carrossel/molde');
const mk = require('../../08-FERRAMENTAS/mockups/mockups');

const AQUI = __dirname;
const args = process.argv.slice(2);
const daMarca = args.includes('--marca');
const pedidos = args.filter((x) => x !== '--marca');
const ids = pedidos.length ? pedidos : molde.listarEstilos();
const opcoes = {
  cores: daMarca ? 'marca' : 'sugestao',
  ...(daMarca ? {} : { identidade: { nome: 'Lia Exemplo', conta: '@lia.exemplo' } }),
  retrato: '04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/retrato-blazer.jpg',
  foto: (abs) => path.relative(AQUI, abs).split(path.sep).join('/'),
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
let links = '';
let css = molde.cssBase() + '\n' + mk.css();
const secoes = ids.map((id) => {
  const e = molde.lerEstilo(id);
  const t = molde.tema(e, opcoes);
  links += t.link;
  molde.garantirTexturas(e);
  css += '\n' + t.css + '\n' + molde.cssDoEstilo(e, opcoes);
  // carrossel (demo.json), os 3 fixados (demo-fixados.json) e a capa de Reels (demo-reels.json), o que o estilo tiver
  const ler = (n) => (fs.existsSync(path.join(e.dir, n)) ? JSON.parse(fs.readFileSync(path.join(e.dir, n), 'utf8')) : null);
  const fila = (titulo, conteudos, formato) => (conteudos ? `<h3>${titulo}</h3><div class="pv-fila">${molde.laminas(e, conteudos, { ...opcoes, formato }).map((h) => `<div class="pv-mold pv-${formato}">${h}</div>`).join('')}</div>` : '');
  const car = e.car;
  const ficha = car ? `miolo ${car.molde_do_miolo === 'fixo' ? 'fixo' : 'em rodízio'} · alinhamento ${car.alinhamento} · fundos ${car.fundos.join(', ')} · navegação ${Object.entries(car.navegacao).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nenhuma'}` : 'só capa de Reels';
  return `<section class="pv-est" id="${id}"><h2>${esc(e.dados.nome)}</h2><p>${esc(e.dados.linha)}</p>
<p class="pv-ficha">${ficha}</p>
${car ? fila('Carrossel', ler('demo.json'), 'carrossel') : ''}${car ? fila('Posts fixados', ler('demo-fixados.json'), 'fixados') : ''}${fila('Capa de Reels', ler('demo-reels.json'), 'reels')}</section>`;
}).join('\n');
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catálogo de estilos</title>${links}
<style>${css}
body{margin:0;background:#EDECE8;color:#1B1B1B;font:16px/1.5 system-ui,sans-serif;padding:24px max(16px,env(safe-area-inset-left,0px))}
h1{margin:0 0 6px;font-size:26px}.pv-est{margin:0 0 40px}.pv-est > h2{margin:0;font-size:20px}.pv-est > p{margin:2px 0;max-width:900px;color:#444}
.pv-est > .pv-ficha{font:13px ui-monospace,monospace;color:#666}
.pv-fila{display:flex;gap:12px;overflow-x:auto;padding:12px 0}
.pv-mold{flex:none;width:270px;height:337.5px;border-radius:8px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.pv-mold .lamina{zoom:.25}
.pv-mold.pv-fixados{height:360px}.pv-mold.pv-reels{height:480px}
.pv-est > h3{margin:10px 0 0;font-size:13px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.06em}
</style></head><body>
<h1>Catálogo de estilos</h1>
<p>${daMarca ? 'Cada estilo com o carrossel de demonstração nas cores e fontes do marca.yaml da empresa. O texto e as fotos são de exemplo.' : 'Cada estilo com o carrossel de demonstração da empresa fictícia, nas cores e fontes que ele sugere. Na produção, valem as do marca.yaml.'}</p>
${secoes}
</body></html>`;
fs.writeFileSync(path.join(AQUI, 'catalogo.html'), html);
console.log('catálogo: ' + path.join(AQUI, 'catalogo.html'));
