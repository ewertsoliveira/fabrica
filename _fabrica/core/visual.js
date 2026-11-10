#!/usr/bin/env node
// Gera a prévia visual de uma decisão de design: uma página HTML que MOSTRA as opções (cores, tipografia, peça de exemplo),
// para o responsável olhar e escolher. Regra do Núcleo (regras/12-decisao-visual.md): decisão visual nunca vai só em texto.
//
//   node _fabrica/core/visual.js paletas     <opcoes.json> [--saida arq.html] [--titulo "..."]
//   node _fabrica/core/visual.js tipografias <opcoes.json> [--saida arq.html] [--titulo "..."]
//   node _fabrica/core/visual.js quadro      <marca.json>  [--saida arq.html] [--titulo "..."]
//
// Entradas (JSON):
//   paletas:     [{ "nome": "Mar e areia", "descricao": "…", "cores": { "escuro": "#1E2B3A", "claro": "#F3EEE3", "acento": "#2FB59A", "neutro": "#8C8478" } }, …]
//   tipografias: [{ "nome": "Editorial", "descricao": "…", "titulo": "Fraunces", "texto": "Inter", "mono": "Space Mono" }, …]
//   quadro:      { "nome": "Empresa", "handle": "@empresa", "frase": "…", "cores": {…}, "tipografia": { "titulo": "…", "texto": "…", "mono": "…" } }
//
// Saída padrão: _fabrica/_visual/<tipo>-<AAAA-MM-DD-HHmmss>.html (pasta ignorada pelo Git). Imprime o caminho absoluto e
// o endereço file:// para abrir no navegador. Sai com 0 = ok, 1 = entrada inválida, 2 = uso.
'use strict';
const fs = require('fs');
const path = require('path');
// A raiz da Fábrica, sem carregar a marca: a prévia não depende da empresa ativa.
const RAIZ = path.resolve(__dirname, '..', '..');

const PAPEIS = ['escuro', 'claro', 'acento', 'neutro'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ehHex = (h) => /^#[0-9a-fA-F]{6}$/.test(String(h || ''));
const fonteOk = (f) => /^[\p{L}\p{N} \-]{1,40}$/u.test(String(f || ''));
const letra = (i) => String.fromCharCode(65 + i);

function luminancia(hex) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const selo = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA grande' : 'baixo');

function validaCores(c, onde) {
  const e = [];
  for (const p of PAPEIS) if (!ehHex(c && c[p])) e.push(`${onde}: cores.${p} ausente ou inválida (use "#RRGGBB")`);
  return e;
}

function familias(...nomes) {
  const uniq = [...new Set(nomes.filter(Boolean))];
  if (!uniq.length) return '';
  const q = uniq.map((n) => 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':ital,wght@0,400;0,700;0,900;1,400').join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?${q}&display=swap" rel="stylesheet">`;
}

const BASE_CSS = `
:root{--bg:#f6f6f4;--ink:#17171a;--mut:#6b6b70;--card:#fff;--ln:#dcdcd8}
@media (prefers-color-scheme:dark){:root{--bg:#121214;--ink:#f1f1ee;--mut:#9a9aa0;--card:#1c1c20;--ln:#34343a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.5rem;margin:.2em 0 .1em}p.sub{color:var(--mut);margin:0 0 20px}
.grade{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:18px}
.opcao{background:var(--card);border:1px solid var(--ln);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px}
.cab{display:flex;align-items:center;gap:10px}.letra{width:34px;height:34px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;font-weight:700}
.nome{font-weight:700}.desc{color:var(--mut);font-size:.9rem}
.sw{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.sw div{border-radius:10px;height:64px;padding:6px;font:600 11px/1.2 ui-monospace,monospace;display:flex;align-items:flex-end;border:1px solid rgba(128,128,128,.25)}
.peca{aspect-ratio:4/5;border-radius:12px;padding:7% 8%;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
.kicker{font-size:.7rem;letter-spacing:.2em;text-transform:uppercase}.tit{font-size:clamp(1.3rem,3.2vw,1.9rem);line-height:1.08;font-weight:900}
.btn{display:inline-block;padding:.55em 1em;border-radius:8px;font-weight:700;font-size:.9rem}.handle{font-size:.75rem;opacity:.8}
.cont{font-size:.8rem;color:var(--mut)}.cont b{color:var(--ink)}
.esp{background:var(--card);border:1px solid var(--ln);border-radius:14px;padding:20px}
.esp .g{font-size:2.4rem;line-height:1.1;font-weight:900}.esp .p{font-size:1.05rem;margin:.6em 0}.esp .m{font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:var(--mut)}
footer{margin-top:28px;color:var(--mut);font-size:.85rem}
`;

function pagina(titulo, sub, corpo, fontes) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titulo)}</title>${fontes}<style>${BASE_CSS}</style></head><body><main>
<h1>${esc(titulo)}</h1><p class="sub">${esc(sub)}</p>${corpo}
<footer>Prévia gerada pela Fábrica de Conteúdo. Escolha pela letra; ainda não foi gravado nada no contrato de marca.</footer></main></body></html>`;
}

function pecaExemplo(c, f, frase, handle) {
  return `<div class="peca" style="background:${c.escuro};color:${c.claro}">
    <div class="kicker" style="color:${c.acento};font-family:'${esc(f.mono)}',monospace">Exemplo de peça</div>
    <div class="tit" style="font-family:'${esc(f.titulo)}',serif">${esc(frase)}</div>
    <div><div class="btn" style="background:${c.acento};color:${c.escuro};font-family:'${esc(f.texto)}',sans-serif">Fale com a gente</div>
    <div class="handle" style="margin-top:.8em;font-family:'${esc(f.mono)}',monospace;color:${c.neutro}">${esc(handle)}</div></div></div>`;
}

const FONTES_PADRAO = { titulo: 'Fraunces', texto: 'Inter', mono: 'Space Mono' };

function gerarPaletas(opcoes, titulo) {
  const erros = [];
  if (!Array.isArray(opcoes) || !opcoes.length) return { erros: ['paletas: lista de opções vazia'] };
  opcoes.forEach((o, i) => { if (!o.nome) erros.push(`opção ${letra(i)}: sem nome`); erros.push(...validaCores(o.cores, 'opção ' + letra(i))); });
  if (erros.length) return { erros };
  const corpo = '<div class="grade">' + opcoes.map((o, i) => {
    const c = o.cores;
    const r1 = contraste(c.claro, c.escuro), r2 = contraste(c.escuro, c.acento);
    return `<section class="opcao"><div class="cab"><div class="letra">${letra(i)}</div><div><div class="nome">${esc(o.nome)}</div><div class="desc">${esc(o.descricao || '')}</div></div></div>
      <div class="sw">${PAPEIS.map((p) => `<div style="background:${c[p]};color:${luminancia(c[p]) > 0.4 ? '#111' : '#fff'}">${p}<br>${c[p].toUpperCase()}</div>`).join('')}</div>
      ${pecaExemplo(c, FONTES_PADRAO, 'Uma frase de abertura para a sua peça', '@sua.conta')}
      <div class="cont">Texto claro sobre escuro: <b>${r1.toFixed(1)}:1</b> (${selo(r1)}) · Botão (escuro sobre acento): <b>${r2.toFixed(1)}:1</b> (${selo(r2)})</div></section>`;
  }).join('') + '</div>';
  return { html: pagina(titulo || 'Opções de paleta', 'Cada opção mostra as quatro cores e como elas ficam numa peça de verdade.', corpo, familias(...Object.values(FONTES_PADRAO))) };
}

function gerarTipografias(opcoes, titulo) {
  const erros = [];
  if (!Array.isArray(opcoes) || !opcoes.length) return { erros: ['tipografias: lista de opções vazia'] };
  opcoes.forEach((o, i) => {
    if (!o.nome) erros.push(`opção ${letra(i)}: sem nome`);
    for (const k of ['titulo', 'texto', 'mono']) if (!fonteOk(o[k])) erros.push(`opção ${letra(i)}: fonte "${k}" ausente ou com caracteres inválidos`);
  });
  if (erros.length) return { erros };
  const corpo = '<div class="grade">' + opcoes.map((o, i) => `<section class="opcao"><div class="cab"><div class="letra">${letra(i)}</div><div><div class="nome">${esc(o.nome)}</div><div class="desc">${esc(o.descricao || '')}</div></div></div>
    <div class="esp"><div class="m" style="font-family:'${esc(o.mono)}',monospace">${esc(o.mono)} · rótulo</div>
    <div class="g" style="font-family:'${esc(o.titulo)}',serif">Título que chama a atenção</div>
    <div class="p" style="font-family:'${esc(o.texto)}',sans-serif">${esc(o.texto)}: texto corrido para explicar uma ideia com clareza. 0123456789 R$ 1.250,00</div>
    <div class="m" style="font-family:'${esc(o.mono)}',monospace">Título: ${esc(o.titulo)}</div></div></section>`).join('') + '</div>';
  return { html: pagina(titulo || 'Opções de tipografia', 'Cada opção mostra título, texto e rótulo, do jeito que aparecem nas peças.', corpo,
    familias(...opcoes.flatMap((o) => [o.titulo, o.texto, o.mono]))) };
}

function gerarQuadro(m, titulo) {
  const erros = [...validaCores(m && m.cores, 'quadro')];
  const f = { ...FONTES_PADRAO, ...(m && m.tipografia) };
  for (const k of ['titulo', 'texto', 'mono']) if (!fonteOk(f[k])) erros.push(`quadro: fonte "${k}" com caracteres inválidos`);
  if (erros.length) return { erros };
  const c = m.cores;
  const frase = m.frase || 'Uma frase de abertura para a sua peça';
  const sw = `<div class="sw">${PAPEIS.map((p) => `<div style="background:${c[p]};color:${luminancia(c[p]) > 0.4 ? '#111' : '#fff'}">${p}<br>${c[p].toUpperCase()}</div>`).join('')}</div>`;
  const claro = `<div class="peca" style="background:${c.claro};color:${c.escuro}">
    <div class="kicker" style="color:${c.neutro};font-family:'${esc(f.mono)}',monospace">Versão clara</div>
    <div class="tit" style="font-family:'${esc(f.titulo)}',serif">${esc(frase)}</div>
    <div><span class="btn" style="background:${c.acento};color:${c.escuro};font-family:'${esc(f.texto)}',sans-serif">Mande uma mensagem</span></div></div>`;
  const corpo = `<div class="grade">
    <section class="opcao"><div class="nome">Cores</div>${sw}</section>
    <section class="opcao"><div class="nome">Peça escura</div>${pecaExemplo(c, f, frase, m.handle || '@sua.conta')}</section>
    <section class="opcao"><div class="nome">Peça clara</div>${claro}</section>
    <section class="opcao"><div class="nome">Tipografia</div><div class="esp"><div class="m" style="font-family:'${esc(f.mono)}',monospace">${esc(f.mono)}</div>
      <div class="g" style="font-family:'${esc(f.titulo)}',serif">${esc(m.nome || 'Sua marca')}</div>
      <div class="p" style="font-family:'${esc(f.texto)}',sans-serif">${esc(f.texto)}: texto corrido para explicar uma ideia com clareza.</div></div></section></div>`;
  return { html: pagina(titulo || `Quadro de marca: ${m.nome || ''}`, 'A marca inteira numa página: cores, peça escura, peça clara e tipografia.', corpo, familias(f.titulo, f.texto, f.mono)) };
}

function main() {
  const a = process.argv.slice(2);
  const op = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : d; };
  const [tipo, entrada] = a;
  if (!['paletas', 'tipografias', 'quadro'].includes(tipo) || !entrada) {
    console.error('uso: node _fabrica/core/visual.js paletas|tipografias|quadro <entrada.json> [--saida arq.html] [--titulo "..."]');
    process.exit(2);
  }
  let dados;
  try { dados = JSON.parse(fs.readFileSync(path.resolve(entrada), 'utf8')); } catch (e) { console.error('entrada ilegível: ' + e.message); process.exit(1); }
  const r = { paletas: gerarPaletas, tipografias: gerarTipografias, quadro: gerarQuadro }[tipo](dados, op('titulo'));
  if (r.erros) { r.erros.forEach((e) => console.error('ERRO  ' + e)); process.exit(1); }
  const carimbo = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');
  const saida = path.resolve(op('saida', path.join(RAIZ, '_fabrica', '_visual', `${tipo}-${carimbo}.html`)));
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, r.html);
  console.log(saida);
  console.log('file:///' + saida.replace(/\\/g, '/').replace(/ /g, '%20'));
}
if (require.main === module) main();
module.exports = { gerarPaletas, gerarTipografias, gerarQuadro, contraste };
