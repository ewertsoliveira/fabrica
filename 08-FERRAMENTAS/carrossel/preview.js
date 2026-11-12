// Prévia única do carrossel num simulador de Instagram: slider com setas e arraste, pontinhos, contador, área segura
// visível sob pedido e a legenda (L-03, L-08, F2). Um arquivo só, com as imagens embutidas (T-06): abre por duplo-clique.
'use strict';
const fs = require('fs');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dado = (arq) => `data:image/png;base64,${fs.readFileSync(arq).toString('base64')}`;
const iniciais = (n) => String(n || '?').replace(/[@._]/g, ' ').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const ICONES = {
  coracao: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  comentario: '<path d="M20.6 16.5A9 9 0 1 0 17 20l3.6 1-1-4.5z"/>',
  enviar: '<path d="M22 3 9.2 10.2M22 3l-6.5 18-3.3-7.7L3 10.6z"/>',
  salvar: '<path d="M19 21l-7-5.5L5 21V3h14z"/>',
};
const ic = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[k]}</svg>`;

// opcoes: { pngs, titulo, nome, conta, legenda, canvas: { largura, altura }, seg: { topo, base }, cor, tinta, conferencia, estilo }
function gerarPreview(o) {
  const { largura, altura } = o.canvas;
  const topoPct = ((o.seg.topo / altura) * 100).toFixed(2);
  const basePct = ((o.seg.base / altura) * 100).toFixed(2);
  const slides = o.pngs.map((p, i) => `<figure class="sl" data-n="${i + 1}"><img src="${dado(p)}" alt="Lâmina ${i + 1}" width="${largura}" height="${altura}"></figure>`).join('\n');
  const legenda = esc(o.legenda || '').replace(/\n/g, '<br>');
  const relatorio = o.conferencia ? `<details class="rel"${/^REPROVADO/.test(o.conferencia) ? ' open' : ''}><summary>${esc(o.conferencia.split('\n')[0])}</summary><pre>${esc(o.conferencia)}</pre></details>` : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.titulo || 'Prévia do carrossel')}</title>
<style>
:root{--bg:#F4F4F2;--fg:#151515;--sub:#6B6B6B;--linha:#DADAD6;--card:#FFFFFF;--acento:${esc(o.cor || '#3B5BDB')};--sobre:${esc(o.tinta || '#FFFFFF')}}
@media (prefers-color-scheme:dark){:root{--bg:#0B0B0C;--fg:#F2F2F2;--sub:#A3A3A3;--linha:#2A2A2C;--card:#000000}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding-block:24px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.app{width:min(470px,100%);margin:0 auto}
.topo{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;justify-content:space-between;margin:0 0 14px}
.topo h1{margin:0;font-size:16px;font-weight:600}
.topo small{color:var(--sub);font-size:13px}
button.chave{font:inherit;font-size:13px;padding:7px 14px;border-radius:20px;border:1px solid var(--linha);background:var(--card);color:var(--fg);cursor:pointer}
button.chave[aria-pressed="true"]{background:var(--acento);color:var(--sobre);border-color:var(--acento)}
.post{background:var(--card);border:1px solid var(--linha);border-radius:10px;overflow:hidden}
.cab{display:flex;align-items:center;gap:12px;padding:10px 14px}
.av{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:var(--acento);color:var(--sobre);font-weight:700;font-size:13px;flex:none}
.cab b{display:block;font-size:14px;font-weight:600;line-height:1.2}.cab span{font-size:12px;color:var(--sub)}
.vis{position:relative}
.faixa{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}
.faixa::-webkit-scrollbar{display:none}
.sl{flex:0 0 100%;margin:0;scroll-snap-align:center;position:relative;aspect-ratio:${largura}/${altura};background:#222}
.sl img{display:block;width:100%;height:100%;object-fit:cover}
.seg .sl::before,.seg .sl::after{content:"";position:absolute;left:0;right:0;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(255,60,60,.34) 0 8px,rgba(255,60,60,.12) 8px 16px);border:0 dashed #FF3C3C}
.seg .sl::before{top:0;height:${topoPct}%;border-bottom-width:2px}
.seg .sl::after{bottom:0;height:${basePct}%;border-top-width:2px}
.chip{position:absolute;top:12px;right:12px;padding:3px 10px;border-radius:14px;background:rgba(0,0,0,.62);color:#fff;font-size:12px;font-weight:600;z-index:2}
.seta{position:absolute;top:50%;width:34px;height:34px;margin-top:-17px;border-radius:50%;border:0;background:rgba(255,255,255,.88);color:#111;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 1px 6px rgba(0,0,0,.3);z-index:2}
.seta[hidden]{display:none}.seta.e{left:10px}.seta.d{right:10px}
.acoes{display:flex;align-items:center;gap:16px;padding:10px 14px 4px;position:relative}
.acoes svg{width:26px;height:26px}
.pontos{position:absolute;left:0;right:0;top:50%;margin-top:-3px;display:flex;justify-content:center;gap:5px;pointer-events:none}
.pontos i{width:6px;height:6px;border-radius:50%;background:var(--linha)}.pontos i.on{background:#0095F6}
.salvar{margin-left:auto}
.leg{padding:4px 14px 14px;font-size:14px}
.leg p{margin:0 0 4px}.leg .t{color:var(--sub);font-size:12px}
.rel{margin-top:14px;font-size:13px;border:1px solid var(--linha);border-radius:10px;background:var(--card);padding:10px 14px}
.rel summary{cursor:pointer;font-weight:600}.rel pre{white-space:pre-wrap;font:12px/1.5 ui-monospace,monospace;margin:10px 0 0}
.dica{margin:10px 2px 0;color:var(--sub);font-size:12px}
@media (prefers-reduced-motion:no-preference){.faixa{scroll-behavior:smooth}}
</style></head>
<body>
<main class="app">
<div class="topo"><div><h1>${esc(o.titulo || 'Prévia do carrossel')}</h1><small>${o.pngs.length === 1 ? '1 imagem' : o.pngs.length + ' lâminas'}${o.estilo ? ' · estilo ' + esc(o.estilo) : ''}</small></div><button class="chave" id="seg" type="button" aria-pressed="false">Mostrar área segura</button></div>
<article class="post">
<div class="cab"><span class="av">${esc(iniciais(o.nome || o.conta))}</span><div><b>${esc((o.conta || '').replace(/^@/, '') || o.nome || '')}</b><span>${esc(o.nome || '')}</span></div></div>
<div class="vis"><span class="chip" id="chip">1/${o.pngs.length}</span>
<button class="seta e" id="ant" type="button" aria-label="Lâmina anterior" hidden>‹</button><button class="seta d" id="prox" type="button" aria-label="Próxima lâmina">›</button>
<div class="faixa" id="faixa" tabindex="0" aria-label="Lâminas do carrossel">
${slides}
</div></div>
<div class="acoes">${ic('coracao')}${ic('comentario')}${ic('enviar')}<span class="pontos" id="pontos"></span><span class="salvar">${ic('salvar')}</span></div>
<div class="leg"><p><b>${esc((o.conta || '').replace(/^@/, ''))}</b> ${legenda || '<span class="t">(sem legenda)</span>'}</p><p class="t">Prévia: o contador e os pontinhos são os do Instagram, não da peça.</p></div>
</article>
${relatorio}
<p class="dica">Setas do teclado ou deslize para passar as lâminas. Área segura: as faixas em vermelho são reservadas à interface do aplicativo.</p>
</main>
<script>
(function () {
  var faixa = document.getElementById('faixa'), sls = faixa.querySelectorAll('.sl'), n = sls.length;
  var chip = document.getElementById('chip'), ant = document.getElementById('ant'), prox = document.getElementById('prox'), pontos = document.getElementById('pontos');
  for (var i = 0; i < n; i++) pontos.appendChild(document.createElement('i'));
  function atual() { return Math.max(0, Math.min(n - 1, Math.round(faixa.scrollLeft / faixa.clientWidth))); }
  function mostrar() {
    var a = atual(); chip.textContent = (a + 1) + '/' + n;
    ant.hidden = a === 0; prox.hidden = a === n - 1;
    var ps = pontos.children; for (var i = 0; i < ps.length; i++) ps[i].className = i === a ? 'on' : '';
  }
  function ir(i) { faixa.scrollTo({ left: Math.max(0, Math.min(n - 1, i)) * faixa.clientWidth }); }
  ant.onclick = function () { ir(atual() - 1); }; prox.onclick = function () { ir(atual() + 1); };
  faixa.addEventListener('scroll', mostrar, { passive: true });
  document.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') ir(atual() + 1); if (e.key === 'ArrowLeft') ir(atual() - 1); });
  window.addEventListener('resize', mostrar);
  var seg = document.getElementById('seg');
  seg.onclick = function () { var on = document.body.classList.toggle('seg'); seg.setAttribute('aria-pressed', on); seg.textContent = on ? 'Esconder área segura' : 'Mostrar área segura'; };
  mostrar();
})();
</script>
</body></html>`;
}

// Prévia dos fixados e da capa de Reels como aparecem na grade do perfil (quadros 3:4). Os fixados entram inteiros, com o
// alfinete; a capa de Reels aparece recortada no centro (o que a grade mostra) e, ao lado, inteira, com as faixas que a
// interface do aplicativo cobre (V-04) e o recorte da grade tracejado.
// opcoes: as mesmas de gerarPreview, mais formato: 'fixados' | 'reels'
function gerarPreviewGrade(o) {
  const { largura, altura } = o.canvas;
  const reels = o.formato === 'reels';
  const pct = (v) => ((v / altura) * 100).toFixed(2);
  const alfinete = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z" fill="currentColor"/></svg>';
  const quadros = o.pngs.map((p, i) => `<figure class="q${reels ? ' r' : ''}"><img src="${dado(p)}" alt="${reels ? 'Capa' : 'Fixado'} ${i + 1} na grade">${reels ? '' : `<i class="pin">${alfinete}</i>`}</figure>`).join('');
  const vazios = Array.from({ length: Math.max(0, 6 - o.pngs.length) }, () => '<figure class="q vazio" aria-hidden="true"></figure>').join('');
  const recorte = pct((altura - largura * 4 / 3) / 2);
  const inteiras = reels ? `<h2>Capa inteira (9:16)</h2><p class="ajuda">Faixas escuras: o que a interface do aplicativo cobre. Tracejado: o recorte 3:4 que a grade do perfil mostra.</p>
<div class="inteiras">${o.pngs.map((p, i) => `<figure class="cheia"><img src="${dado(p)}" alt="Capa ${i + 1} inteira" width="${largura}" height="${altura}"><i class="faixa topo" style="height:${pct(o.seg.topo)}%"></i><i class="faixa base" style="height:${pct(o.seg.base)}%"></i><i class="faixa lado"></i><i class="grade" style="top:${recorte}%;bottom:${recorte}%"></i></figure>`).join('')}</div>` : '';
  const relatorio = o.conferencia ? `<details class="rel"${/^REPROVADO/.test(o.conferencia) ? ' open' : ''}><summary>${esc(o.conferencia.split('\n')[0])}</summary><pre>${esc(o.conferencia)}</pre></details>` : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.titulo || 'Prévia')}</title>
<style>
:root{--bg:#F4F4F2;--fg:#151515;--sub:#6B6B6B;--linha:#DADAD6;--card:#FFFFFF;--acento:${esc(o.cor || '#3B5BDB')};--sobre:${esc(o.tinta || '#FFFFFF')}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px max(16px,env(safe-area-inset-left,0px)) 40px}
h1{margin:0 0 4px;font-size:20px}h2{margin:28px 0 4px;font-size:16px}.ajuda{margin:0 0 10px;color:var(--sub);max-width:640px}
.perfil{max-width:480px;background:var(--card);border:1px solid var(--linha);border-radius:14px;overflow:hidden;margin-top:14px}
.cab{display:flex;gap:14px;align-items:center;padding:16px}.av{width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:var(--acento);color:var(--sobre);font-weight:700;font-size:22px}
.cab b{display:block}.cab span{color:var(--sub)}
.grade3{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;background:var(--linha)}
.q{margin:0;position:relative;aspect-ratio:3/4;overflow:hidden;background:var(--card)}.q img{width:100%;height:100%;object-fit:cover;display:block}
.q.vazio{background:repeating-linear-gradient(135deg,#ECECE8 0 8px,#F4F4F1 8px 16px)}
.pin{position:absolute;top:6px;right:6px;width:20px;height:20px;color:#fff;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.inteiras{display:flex;gap:14px;flex-wrap:wrap}.cheia{margin:0;position:relative;width:min(300px,80vw)}.cheia img{width:100%;height:auto;display:block;border-radius:8px}
.faixa{position:absolute;left:0;right:0;background:rgba(0,0,0,.45);pointer-events:none}.faixa.topo{top:0;border-radius:8px 8px 0 0}.faixa.base{bottom:0;border-radius:0 0 8px 8px}
.faixa.lado{top:0;bottom:0;left:auto;right:0;width:12%;background:rgba(0,0,0,.25)}
.grade{position:absolute;left:0;right:0;border:3px dashed #fff;outline:1px solid rgba(0,0,0,.4);pointer-events:none}
.rel{margin-top:24px;max-width:720px}.rel summary{cursor:pointer;font-weight:600}.rel pre{white-space:pre-wrap;font-size:13px}
</style></head><body>
<h1>${esc(o.titulo || 'Prévia')}</h1>
<p class="ajuda">${reels ? 'A capa de Reels na grade do perfil (o recorte 3:4 do centro).' : 'Os três posts fixados no topo da grade do perfil, inteiros (3:4).'}</p>
<div class="perfil"><div class="cab"><span class="av">${esc(iniciais(o.conta || o.nome))}</span><div><b>${esc(o.nome || '')}</b><span>${esc(o.conta || '')}</span></div></div>
<div class="grade3">${quadros}${vazios}</div></div>
${inteiras}
${relatorio}
</body></html>`;
}

module.exports = { gerarPreview, gerarPreviewGrade };
