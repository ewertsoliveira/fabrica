#!/usr/bin/env node
// Página de revisão da biblioteca de estilos: para cada estilo, as prévias (capa, lâminas do carrossel, posts fixados,
// capa de Reels e vídeo, quando houver) e os três campos da biblioteca (Combina com, Tom, O que precisa) com os RÓTULOS do
// vocabulário, para a pessoa conferir os campos olhando as imagens. No topo: o peso total contra a meta e os estilos
// acima de 1 MB em vermelho.
//
//   node 08-FERRAMENTAS/biblioteca/revisao.js [--saida <arquivo.html>]
//
// Lê previas/<estilo>/previas.json e previas-locais/<estilo>/previas.json (vídeo que ainda não foi liberado), os
// estilo.yaml e o vocabulario.json. Grava 04-LABORATORIO-DE-DESIGN/biblioteca/revisao.html, que o git ignora (pode mostrar
// vídeo local). Sem dependência externa: os caminhos das imagens são relativos ao arquivo gerado.
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = process.env.FABRICA_SILENCIO_EXEMPLO || '1'; // só lemos RAIZ e o leitor de YAML: o aviso da marca de exemplo não interessa aqui
const fs = require('fs');
const path = require('path');
const marca = require('../marca/marca');

const RAIZ = marca.RAIZ;
const LAB = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN');
const PADRAO = {
  previas: path.join(LAB, 'biblioteca', 'previas'),
  locais: path.join(LAB, 'biblioteca', 'previas-locais'),
  estilos: path.join(LAB, 'estilos'),
  vocabulario: path.join(LAB, 'biblioteca', 'vocabulario.json'),
  saida: path.join(LAB, 'biblioteca', 'revisao.html'),
};
const LIMITE_ESTILO = 1_000_000;
const LIMITE_TOTAL = 30_000_000;

const CAMPOS = [
  ['combina-com', 'Combina com'],
  ['tom', 'Tom'],
  ['precisa', 'O que precisa'],
];

// Estilos em que o campo "O que precisa" merece uma segunda olhada da pessoa (ela decide aqui na revisão; nada foi mudado no estilo).
const PARA_DECIDIR = {
  contraste: 'o estilo prevê recorte de pessoa, mas o carrossel de demonstração não usa foto.',
  'concreto-acido': 'o vídeo de Reels recorta a pessoa, mas o carrossel não usa foto.',
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const milhar = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
// a meta de peso vale para as imagens; o vídeo fica de fora (decisão do responsável)
const pesoImagens = (m) => m.bytesImagens ?? m.bytes;
const kb = (bytes) => `${milhar(bytes / 1000)} KB`;
const mb = (bytes) => `${(bytes / 1e6).toFixed(2).replace('.', ',')} MB`;

function lerJson(arq) {
  if (!fs.existsSync(arq)) return null;
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
}

// Estilos = pastas com estilo.yaml (as que começam com _ são de apoio). Lê só os campos que a página mostra.
function lerEstilos(pasta, vocabulario) {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(pasta, e.name, 'estilo.yaml')))
    .map((e) => {
      const dados = marca.lerYaml(fs.readFileSync(path.join(pasta, e.name, 'estilo.yaml'), 'utf8'));
      const campos = CAMPOS.map(([chave, titulo]) => {
        const codigos = Array.isArray(dados[chave]) ? dados[chave] : [];
        const rotulos = codigos.map((c) => (vocabulario[chave] && vocabulario[chave][c]) || `(não está no vocabulário: ${c})`);
        return { titulo, rotulos };
      });
      return { id: e.name, nome: dados.nome || e.name, linha: dados.linha || '', campos };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Caminho relativo ao arquivo da página, com barras e sem caracteres que quebrem a URL.
function relativo(deArquivo, para) {
  return path.relative(path.dirname(deArquivo), para).split(path.sep).map(encodeURIComponent).join('/');
}

const CSS = `
:root{--fundo:rgb(246,245,242);--papel:#fff;--texto:rgb(31,36,48);--suave:rgb(95,102,117);--linha:rgb(227,224,216);--acento:rgb(43,95,217);--chip:rgb(238,241,251);--alerta:rgb(192,39,27);--alerta-fundo:rgb(253,236,234);--ok:rgb(29,122,70);--selo:rgb(255,243,214);--selo-borda:rgb(231,195,106)}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--fundo);color:var(--texto);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
.pagina{max-width:1180px;margin:0 auto;padding:20px 16px 64px}
h1{font-size:1.6rem;line-height:1.2;margin:0 0 6px}
h2{font-size:1.25rem;line-height:1.25;margin:0}
h3{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--suave);margin:18px 0 8px;font-weight:700}
p{margin:0}
.intro{color:var(--suave);max-width:60ch}
.resumo{background:var(--papel);border:1px solid var(--linha);border-radius:12px;padding:16px;margin:18px 0}
.resumo .total{font-size:1.1rem}
.barra{height:10px;background:rgb(232,230,223);border-radius:6px;overflow:hidden;margin:10px 0 4px}
.barra>i{display:block;height:100%;background:var(--ok)}
.barra.estourou>i{background:var(--alerta)}
.meta{color:var(--suave);font-size:.9rem}
.avisos{margin-top:12px;padding:12px 14px;border-radius:10px;background:var(--alerta-fundo);border:1px solid rgb(242,184,178);color:var(--alerta)}
.avisos ul{margin:6px 0 0;padding-left:20px}
.avisos.limpo{background:rgb(233,246,238);border-color:rgb(181,223,196);color:var(--ok)}
.indice{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 22px;padding:0;list-style:none}
.indice a{display:block;padding:4px 10px;border-radius:999px;background:var(--papel);border:1px solid var(--linha);color:var(--texto);text-decoration:none;font-size:.88rem}
.indice a.pesado{border-color:var(--alerta);color:var(--alerta)}
.estilo{background:var(--papel);border:1px solid var(--linha);border-radius:14px;padding:16px;margin:0 0 22px;scroll-margin-top:12px}
.estilo-topo{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 12px}
.peso{font-size:.95rem;color:var(--suave);white-space:nowrap}
.peso.alto{color:var(--alerta);font-weight:700}
.linha{color:var(--suave);margin-top:4px}
.campos{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding:12px;background:rgb(250,249,246);border:1px solid var(--linha);border-left:4px solid var(--acento);border-radius:10px}
.campo b{display:block;font-size:.78rem;letter-spacing:.05em;text-transform:uppercase;color:var(--suave);margin-bottom:5px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{background:var(--chip);color:#223;border-radius:999px;padding:2px 10px;font-size:.9rem}
.vazio{color:var(--suave);font-style:italic}
.faixa{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;-webkit-overflow-scrolling:touch}
.faixa figure{margin:0;flex:0 0 auto}
.faixa img,.faixa video{display:block;height:230px;width:auto;border-radius:8px;border:1px solid var(--linha);background:rgb(236,234,228)}
.faixa .reels{height:300px}
figcaption{font-size:.8rem;color:var(--suave);margin-top:3px}
.fileira{display:flex;gap:6px 28px;flex:1 1 100%;min-width:0}
.fileira>.capa{flex:0 0 auto}
.fileira>.carrossel{flex:1 1 0;min-width:0}
.sem-previa{padding:14px;border:1px dashed var(--linha);border-radius:10px;color:var(--suave);margin-top:14px}
.nota-precisa{margin:14px 0 0;padding:10px 14px;border-radius:10px;background:var(--chip);border:1px solid var(--linha);color:var(--texto);max-width:80ch;font-size:.95rem}
.decidir{margin-top:10px;padding:8px 12px;border-radius:8px;background:var(--selo);border:1px solid var(--selo-borda);color:rgb(107,75,0);font-size:.92rem}
.nota-video{padding:10px 12px;border:1px dashed var(--linha);border-radius:8px;color:var(--suave);font-size:.92rem}
.selo{display:inline-block;margin-bottom:6px;padding:2px 10px;border-radius:999px;background:var(--selo);border:1px solid var(--selo-borda);color:rgb(107,75,0);font-size:.82rem;font-weight:700}
.midia{display:flex;flex-wrap:wrap;gap:6px 28px}
.midia>div{min-width:0;max-width:100%}
@media (max-width:760px){.campos{grid-template-columns:1fr}.faixa img,.faixa video{height:200px}.faixa .reels{height:260px}.fileira{flex-wrap:wrap}.fileira>.carrossel{flex:1 1 100%}}
@media (max-width:420px){.pagina{padding:14px 12px 48px}h1{font-size:1.35rem}.estilo{padding:12px}}
`;

function figura(src, legenda, { largura, altura, classe = '' } = {}) {
  return `<figure><img${classe ? ` class="${classe}"` : ''} src="${src}" width="${largura}" height="${altura}" loading="lazy" alt="${esc(legenda)}"><figcaption>${esc(legenda)}</figcaption></figure>`;
}

function cartaoDoEstilo(e, ctx) {
  const m = e.manifesto;
  const url = (arq) => relativo(ctx.saida, path.join(m ? m.pasta : '', arq)); // só é chamada quando há manifesto
  const peso = m ? pesoImagens(m) : 0;
  const alto = m && peso > ctx.limiteEstilo;
  const campos = e.campos.map((c) => `<div class="campo"><b>${esc(c.titulo)}</b><div class="chips">${
    c.rotulos.length ? c.rotulos.map((r) => `<span class="chip">${esc(r)}</span>`).join('') : '<span class="vazio">não preenchido</span>'}</div></div>`).join('');
  let html = `<section class="estilo" id="${esc(e.id)}"><div class="estilo-topo"><h2>${esc(e.nome)}</h2>`
    + (m ? `<span class="peso${alto ? ' alto' : ''}">Peso: ${kb(peso)}${alto ? ' (acima de 1 MB)' : ''}</span>` : '<span class="peso">Peso: sem prévias ainda</span>')
    + `</div><p class="linha">${esc(e.linha)}</p><div class="campos">${campos}</div>`;
  const decidir = PARA_DECIDIR[e.id] ? `<p class="decidir"><b>Para você decidir:</b> ${esc(PARA_DECIDIR[e.id])}</p>` : '';
  html += decidir;
  if (!m) {
    // sem prévias de imagem, mas com vídeo (só local): o vídeo aparece mesmo assim
    const video = videoDoEstilo(e, ctx, { semNota: true });
    return html + '<p class="sem-previa">Este estilo ainda não tem prévias geradas.</p>' + (video ? `<div class="midia"><div><h3>Vídeo</h3>${video}</div></div>` : '') + '</section>';
  }

  const capaUrl = m.capa ? url(m.capa) : null;
  const blocos = [];
  const fileira = [];
  if (capaUrl) fileira.push(`<div class="capa"><h3>${m.capa === m.reelsCapa ? 'Capa de Reels' : 'Capa'}</h3><div class="faixa">${figura(capaUrl, m.capa === m.reelsCapa ? 'Capa de Reels' : 'Capa', { largura: 1080, altura: m.capa.startsWith('reels') ? 1920 : 1350 })}</div></div>`);
  if (m.carrossel.length) {
    fileira.push(`<div class="carrossel"><h3>Carrossel (${m.carrossel.length} lâminas)</h3><div class="faixa">${
      m.carrossel.map((f, i) => figura(url(f), `Lâmina ${i + 1}`, { largura: 1080, altura: 1350 })).join('')}</div></div>`);
  }
  if (fileira.length) blocos.push(`<div class="fileira">${fileira.join('')}</div>`);
  if (m.fixados) {
    const nomes = { apresentacao: 'Apresentação', metodo: 'Método', contratar: 'Contratar' };
    blocos.push(`<div><h3>Os três posts fixados</h3><div class="faixa">${
      Object.entries(m.fixados).map(([k, f]) => figura(url(f), nomes[k] || k, { largura: 1080, altura: 1440 })).join('')}</div></div>`);
  }
  // estilo só de Reels: a capa é a própria capa de Reels, então ela não aparece duas vezes
  if (m.reelsCapa && m.reelsCapa !== m.capa) blocos.push(`<div><h3>Capa de Reels</h3><div class="faixa">${figura(url(m.reelsCapa), 'Capa de Reels', { largura: 1080, altura: 1920, classe: 'reels' })}</div></div>`);
  blocos.push(`<div><h3>Vídeo</h3>${videoDoEstilo(e, ctx)}</div>`);
  return html + `<div class="midia">${blocos.join('')}</div></section>`;
}

// O vídeo liberado fica em previas/; o que ainda não foi liberado fica em previas-locais/ e ganha o selo. Se os dois existem,
// aparece o local (é o que está em revisão) e uma frase diz que já existe um liberado. `semNota`: sem vídeo, devolve '' em vez do aviso.
function videoDoEstilo(e, ctx, { semNota = false } = {}) {
  const temVideo = (m) => m && typeof m.video === 'string' && fs.existsSync(path.join(m.pasta, m.video));
  const local = temVideo(e.manifestoLocal) ? e.manifestoLocal : null;
  const liberado = temVideo(e.manifesto) ? e.manifesto : null;
  const m = local || liberado;
  if (!m) return semNota ? '' : '<p class="nota-video">Vídeo: chega com o vídeo de demonstração</p>';
  const aviso = local && liberado ? '<p class="nota-video">Já existe um vídeo liberado deste estilo no repositório; o que aparece aqui é o novo, que ainda está em revisão.</p>' : '';
  const poster = m.videoCapa && fs.existsSync(path.join(m.pasta, m.videoCapa)) ? ` poster="${relativo(ctx.saida, path.join(m.pasta, m.videoCapa))}"` : '';
  return `${local ? '<span class="selo">Só neste computador</span>' : ''}${aviso}<div class="faixa"><figure><video class="reels" controls preload="none" playsinline width="540" height="960"${poster} src="${relativo(ctx.saida, path.join(m.pasta, m.video))}"></video><figcaption>Vídeo de 12 segundos</figcaption></figure></div>`;
}

// Monta o HTML. `estilos` já vem lido (ver lerTudo); `saida` é o caminho do arquivo, para os caminhos relativos.
function montarHtml(estilos, { saida, limiteEstilo = LIMITE_ESTILO, limiteTotal = LIMITE_TOTAL, pastaLocais }) {
  const ctx = { saida, limiteEstilo, pastaLocais };
  const comPrevia = estilos.filter((e) => e.manifesto);
  const total = comPrevia.reduce((s, e) => s + pesoImagens(e.manifesto), 0);
  const acima = comPrevia.filter((e) => pesoImagens(e.manifesto) > limiteEstilo);
  const pct = Math.min(100, Math.round((total / limiteTotal) * 100));
  const estourou = total > limiteTotal;
  const semPrevia = estilos.length - comPrevia.length;

  const avisos = acima.length
    ? `<div class="avisos" id="avisos"><b>${acima.length === 1 ? 'Um estilo está' : `${acima.length} estilos estão`} acima de 1 MB:</b><ul>${
      acima.map((e) => `<li><a href="#${esc(e.id)}" style="color:inherit"><b>${esc(e.nome)}</b></a>: ${kb(pesoImagens(e.manifesto))}</li>`).join('')}</ul></div>`
    : '<div class="avisos limpo" id="avisos">Nenhum estilo passa de 1 MB.</div>';

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Revisão da biblioteca de estilos</title><style>${CSS}</style></head><body><main class="pagina">
<h1>Revisão da biblioteca de estilos</h1>
<p class="intro">Olhe as prévias de cada estilo e confira os três campos no quadro cinza: <b>Combina com</b>, <b>Tom</b> e <b>O que precisa</b>. Se algum estiver errado, anote o nome do estilo e o que mudar.</p>
<p class="nota-precisa"><b>Sobre “O que precisa”:</b> esse campo fala do <b>carrossel</b>, isto é, do que ele precisa para ficar como na prévia. O <b>post fixado de apresentação</b> e a <b>capa de Reels</b> usam sempre um <b>retrato</b> da pessoa, mesmo nos estilos que dizem “Carrossel funciona sem foto”.</p>
<div class="resumo" id="resumo">
<p class="total"><b>${mb(total)}</b> de ${mb(limiteTotal).replace(',00', '')} (meta do total) em ${comPrevia.length} ${comPrevia.length === 1 ? 'estilo' : 'estilos'}</p>
<div class="barra${estourou ? ' estourou' : ''}"><i style="width:${pct}%"></i></div>
<p class="meta">Meta: menos de ${mb(limiteTotal).replace(',00', '')} no total e menos de 1 MB por estilo.${estourou ? ' <b style="color:var(--alerta)">O total passou da meta.</b>' : ''}${semPrevia ? ` ${semPrevia} ${semPrevia === 1 ? 'estilo ainda não tem' : 'estilos ainda não têm'} prévias.` : ''}</p>
${avisos}
</div>
<ul class="indice">${estilos.map((e) => `<li><a href="#${esc(e.id)}"${e.manifesto && pesoImagens(e.manifesto) > limiteEstilo ? ' class="pesado"' : ''}>${esc(e.nome)}</a></li>`).join('')}</ul>
${estilos.map((e) => cartaoDoEstilo(e, ctx)).join('\n')}
</main></body></html>
`;
}

// Lê tudo o que a página precisa e grava o HTML. Todas as pastas podem ser trocadas (testes).
function gerarRevisao(op = {}) {
  const o = { ...PADRAO, ...op };
  const vocabulario = lerJson(o.vocabulario);
  if (!vocabulario) throw new Error(`não achei o vocabulário da biblioteca (${o.vocabulario}); atualize a Fábrica`);
  const estilos = lerEstilos(o.estilos, vocabulario);
  for (const e of estilos) {
    const principal = lerJson(path.join(o.previas, e.id, 'previas.json'));
    const local = lerJson(path.join(o.locais, e.id, 'previas.json'));
    e.manifesto = principal ? { ...principal, pasta: path.join(o.previas, e.id) } : null;
    e.manifestoLocal = local ? { ...local, pasta: path.join(o.locais, e.id) } : null;
    // um estilo só com vídeo local ainda não tem prévia em imagem: a ficha dele diz isso, e o vídeo local aparece mesmo assim
  }
  const html = montarHtml(estilos, { saida: o.saida, limiteEstilo: o.limiteEstilo, limiteTotal: o.limiteTotal, pastaLocais: (id) => path.join(o.locais, id) });
  fs.mkdirSync(path.dirname(o.saida), { recursive: true });
  fs.writeFileSync(o.saida, html);
  return { saida: o.saida, estilos: estilos.length, comPrevia: estilos.filter((e) => e.manifesto).length };
}

module.exports = { gerarRevisao, montarHtml, lerEstilos, PADRAO, LIMITE_ESTILO, LIMITE_TOTAL };

if (require.main === module) {
  try {
    const i = process.argv.indexOf('--saida');
    const r = gerarRevisao(i >= 0 ? { saida: path.resolve(process.argv[i + 1] || '') } : {});
    console.log(`Página gravada: ${r.saida} (${r.comPrevia} de ${r.estilos} estilos com prévias)`);
  } catch (e) { console.error('Erro: ' + e.message); process.exit(1); }
}
