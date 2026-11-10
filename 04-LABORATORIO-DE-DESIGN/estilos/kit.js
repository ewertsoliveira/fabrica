#!/usr/bin/env node
// Kit de identidade de cada estilo do catálogo: paleta (com o contraste dos pares de uso), tipografia em amostra,
// tratamentos, texturas e objetos próprios, regras de uso, a tabela "o que mexia no vídeo vira o quê na peça parada"
// (estilos vindos dos modelos de Reels) e três exemplos renderizados (capa do carrossel, fixado de apresentação e capa
// de Reels), com o demo da empresa fictícia.
// Uso: node 04-LABORATORIO-DE-DESIGN/estilos/kit.js [--marca] [id ...]   ->   04-LABORATORIO-DE-DESIGN/estilos/kit.html
// Com --marca, a paleta e as fontes são as do marca.yaml (o kit mostra o estilo vestido pela empresa).
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
  foto: (abs) => path.relative(AQUI, abs).split(path.sep).join('/'),
};
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rel = (abs) => path.relative(AQUI, abs).split(path.sep).join('/');
const PAPEL = { escuro: 'fundo escuro e texto sobre o claro', claro: 'fundo claro e texto sobre o escuro', acento: 'destaque, botão e fundo de acento', neutro: 'apoio: rótulos, linhas e gráficos' };
const PARES = [['claro', 'escuro', 'texto claro no fundo escuro'], ['acento', 'escuro', 'acento no fundo escuro'], ['acento', 'claro', 'acento no fundo claro']];
const ler = (e, n) => (fs.existsSync(path.join(e.dir, n)) ? JSON.parse(fs.readFileSync(path.join(e.dir, n), 'utf8')) : null);

let links = '';
let css = molde.cssBase() + '\n' + mk.css();
const secoes = ids.map((id) => {
  const e = molde.lerEstilo(id);
  const t = molde.tema(e, opcoes);
  links += t.link;
  molde.garantirTexturas(e);
  css += '\n' + t.css + '\n' + molde.cssDoEstilo(e, opcoes);
  const d = e.dados;
  const kit = d.kit || {};
  // paleta e contraste
  const cores = t.cores;
  const paleta = ['escuro', 'claro', 'acento', 'neutro'].map((p) => `<div class="cor"><span class="amostra" style="background:${cores[p]}"></span><b>${p}</b><code>${cores[p]}</code><small>${PAPEL[p]}</small></div>`).join('');
  const pares = PARES.map(([a, b, rot]) => { const r = molde.contraste(cores[a], cores[b]); return `<li><span class="par" style="background:${cores[b]};color:${cores[a]}">Aa</span>${rot}: <b>${r.toFixed(1)}:1</b>${r < 3 ? ' (só para elementos grandes ou decorativos)' : ''}</li>`; }).join('');
  // tipografia
  const tip = daMarca ? {} : (d.sugestao.tipografia || {});
  const fontes = [['principal', 'var(--fonte-principal)', 'texto e títulos'], ['mono', 'var(--fonte-mono)', 'rótulos e dados'], ['acento', 'var(--fonte-acento)', 'destaque e títulos especiais']]
    .map(([p, v, uso]) => `<div class="fonte est-${id}"><span style="font-family:${v}">Comer bem sem terrorismo</span><small>${p}${tip[p] ? `: ${esc(tip[p])}` : ''} · ${uso}</small></div>`).join('');
  // tratamentos, texturas e objetos
  const trat = Object.entries(d.tratamentos || {}).map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(String(v).replace(/\+/g, ' + ').replace(/-/g, ' '))}</li>`).join('');
  const texturas = molde.texturasDoEstilo(e).map((n) => `<figure><img src="${rel(path.join(molde.PASTA_TEXTURAS, n + '.png'))}" alt=""><figcaption>${esc(n)}</figcaption></figure>`).join('');
  const dirIl = path.join(e.dir, 'objetos', 'ilustracao');
  const ilus = fs.existsSync(dirIl) ? fs.readdirSync(dirIl).filter((f) => f.endsWith('.svg')).map((f) => `<figure class="ilu est-${id}">${fs.readFileSync(path.join(dirIl, f), 'utf8')}<figcaption>${esc(f.replace('.svg', ''))}</figcaption></figure>`).join('') : '';
  const objetos = fs.existsSync(path.join(e.dir, 'objetos')) ? fs.readdirSync(path.join(e.dir, 'objetos')).filter((f) => f.endsWith('.html')).map((f) => f.replace('.html', '')) : [];
  // regras e movimento
  const regras = (kit.regras || []).map((r) => `<li>${esc(r)}</li>`).join('');
  const mov = (kit.movimento || []).map((m) => `<tr><td>${esc(m.video)}</td><td>→</td><td>${esc(m.peca)}</td></tr>`).join('');
  // exemplos
  const ex = [];
  const dc = !e.soReels && ler(e, 'demo.json');
  if (dc) ex.push(['Capa do carrossel', molde.laminas(e, dc, opcoes)[0], 'carrossel']);
  const df = !e.soReels && ler(e, 'demo-fixados.json');
  if (df) ex.push(['Fixado de apresentação', molde.laminas(e, df, { ...opcoes, formato: 'fixados' })[0], 'fixados']);
  const dr = ler(e, 'demo-reels.json');
  if (dr) ex.push(['Capa de Reels', molde.laminas(e, dr, { ...opcoes, formato: 'reels' })[0], 'reels']);
  const exemplos = ex.map(([rot, h, f]) => `<figure class="ex ex-${f}"><div class="mold">${h}</div><figcaption>${rot}</figcaption></figure>`).join('');
  return `<section class="kit" id="${id}"><header><h2>${esc(d.nome)}</h2><p>${esc(d.linha)}</p></header>
<div class="col"><div><h3>Paleta</h3><div class="paleta">${paleta}</div><ul class="pares">${pares}</ul>
<h3>Tipografia</h3>${fontes}
<h3>Tratamentos</h3><ul class="trat">${trat}</ul>
${texturas || ilus || objetos.length ? `<h3>Texturas e objetos</h3><div class="tex">${texturas}${ilus}</div>${objetos.length ? `<p class="obj">Objetos próprios: ${objetos.map(esc).join(', ')}</p>` : ''}` : ''}
<h3>Regras de uso</h3><ul class="regras">${regras || '<li>(sem regras no estilo.yaml)</li>'}</ul>
${mov ? `<h3>O que mexia no vídeo vira o quê na peça parada</h3><table class="mov">${mov}</table>` : ''}</div>
<div><h3>Exemplos</h3><div class="exemplos">${exemplos}</div></div></div></section>`;
}).join('\n');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kit de identidade dos estilos</title>${links}
<style>${css}
body{margin:0;background:#EDECE8;color:#1B1B1B;font:15px/1.5 system-ui,sans-serif;padding:24px max(16px,env(safe-area-inset-left,0px))}
h1{margin:0 0 6px;font-size:26px}.intro{max-width:900px;color:#555;margin:0 0 12px}
.indice{display:flex;flex-wrap:wrap;gap:4px 12px;margin:0 0 20px}.indice a{color:#B4532A;text-decoration:none;font-weight:600;font-size:14px}
.kit{background:#fff;border:1px solid #D9D5CE;border-radius:12px;padding:18px;margin:0 0 20px}
.kit header h2{margin:0;font-size:22px}.kit header p{margin:2px 0 8px;color:#555;max-width:900px}
.kit h3{margin:16px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777}
.col{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,auto);gap:24px}
@media (max-width:1000px){.col{grid-template-columns:1fr}}
.paleta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.cor{display:flex;flex-direction:column;gap:2px;font-size:13px}.cor .amostra{display:block;height:64px;border-radius:8px;border:1px solid #0002;background-image:none !important}.cor code{font-size:13px}.cor small{color:#666}
.pares{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:4px;font-size:13px}.par{display:inline-grid;place-items:center;width:34px;height:24px;border-radius:4px;margin-right:8px;font-weight:700}
.fonte{display:flex;flex-direction:column;padding:6px 0;border-bottom:1px solid #eee}.fonte span{font-size:30px;line-height:1.2}.fonte small{color:#666}
.trat,.regras{margin:0;padding-left:18px}.trat li,.regras li{margin:2px 0}
.tex{display:flex;flex-wrap:wrap;gap:8px}.tex figure{margin:0;width:96px;font-size:11px;color:#666;text-align:center}
.tex img{width:96px;height:96px;object-fit:cover;border-radius:6px;background:#ddd;border:1px solid #0001}
.ilu svg{width:96px;height:96px;color:#3B2A1E;--f:#F2ECE1;background:#F2ECE1;border-radius:6px}.obj{font-size:13px;color:#555}
.mov{border-collapse:collapse;font-size:14px;max-width:640px}.mov td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}.mov td:nth-child(2){color:#B4532A}
.exemplos{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}.ex{margin:0;font-size:12px;color:#666}
.ex .mold{overflow:hidden;border-radius:6px;box-shadow:0 2px 8px #0003}.ex .lamina{zoom:.2}
.ex-carrossel .mold{width:216px;height:270px}.ex-fixados .mold{width:216px;height:288px}.ex-reels .mold{width:216px;height:384px}
</style></head><body>
<h1>Kit de identidade dos estilos</h1>
<p class="intro">${daMarca ? 'Cada estilo vestido com a paleta e as fontes do marca.yaml da empresa.' : 'Cada estilo nas cores e fontes originais aprovadas; na produção, a empresa pode trocar pela paleta e fontes do marca.yaml.'} Paleta com o contraste dos pares de uso, tipografia, tratamentos, texturas e objetos, regras de uso e, nos estilos vindos dos modelos de Reels, o que mexia no vídeo e virou elemento fixo na peça.</p>
<nav class="indice">${ids.map((id) => `<a href="#${id}">${esc(molde.lerEstilo(id).dados.nome)}</a>`).join('')}</nav>
${secoes}
</body></html>`;
fs.writeFileSync(path.join(AQUI, 'kit.html'), html);
console.log('kit: ' + path.join(AQUI, 'kit.html'));
