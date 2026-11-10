// Peças compartilhadas pelos modelos: legenda que acende palavra por palavra, linha com estilos mistos,
// pessoa recortada pela máscara, entrada com desfoque e B-roll.
const { EASE, s2ms, limpa, norm, elipse, retangulo, retArredondado } = require('../motor');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// texto em caixa larga alinhado à esquerda: é a mesma configuração do medidor, então a medida vale para o render
const docLinha = (fonte, estilo, extra = {}) => ({
  fontFamily: fonte.family, fontStyle: estilo.style, fontSize: estilo.size, tracking: estilo.tracking || 0, allCaps: !!estilo.allCaps,
  justification: 'left', boxText: true, boxPosition: [0, 0], boxSize: [3240, Math.max(160, Math.round(estilo.size * 1.7))], verticalAlign: 'top',
  ...(estilo.wdth ? { fontVariations: { id: 0, axes: { wdth: estilo.wdth } } } : {}), ...extra,
});
let varId = 3000; // ids de variação de fonte precisam ser únicos
const comVar = (doc) => (doc.fontVariations ? { ...doc, fontVariations: { ...doc.fontVariations, id: varId++ } } : doc);

// âncora no centro da tinta medida: a camada fica em (cx, cy) e os presets (pop, zoom) escalam em torno do centro
const ancora = (m) => [Math.round(m.x0 + m.w / 2), Math.round((m.top + m.bottom) / 2)];

// legenda progressiva: as palavras acendem no tempo da fala. Uma camada com o texto inteiro apagado (opcional)
// e outra, por cima, que mostra o prefixo já falado. As duas começam no mesmo ponto, então o prefixo cobre o texto exato.
function linhaProgressiva(P, g, { fonte, estilo, medida, cx = 540, cy, cor, corApagada, a = g.ini, z = g.fim, nome = 'leg', sombra, entrada }) {
  const m = medida[g.texto];
  const pos = [Math.round(cx), Math.round(cy)];
  const anc = ancora(m);
  const base = docLinha(fonte, estilo);
  const camadas = [];
  if (corApagada) camadas.push(P.texto(nome + '-apagada', a, z, pos, comVar({ ...base, text: g.texto, fillColor: corApagada }), anc));
  const viva = P.texto(nome + '-' + g.texto, a, z, pos, comVar({ ...base, text: limpa(g.palavras[0].w), fillColor: cor }), anc);
  if (sombra) viva.dropShadow = sombra;
  const keys = g.palavras.map((p, i) => [Math.max(0, p.ini - a), g.palavras.slice(0, i + 1).map((q) => limpa(q.w)).join(' ')]);
  if (keys.length > 1) P.kf(viva, 'textContent', keys);
  camadas.push(viva);
  if (entrada) camadas.forEach((c) => P.fade(c, entrada, 'none'));
  return { camadas, pos, m };
}

// linha com estilos diferentes por trecho (ex.: palavra de destaque em itálico), centralizada pela soma das larguras
function linhaMista(P, trechos, { cx = 540, cy, a, z, espaco, nome = 'mista' }) {
  const total = trechos.reduce((s, t) => s + t.m.w, 0) + espaco * (trechos.length - 1);
  let x = cx - total / 2;
  return trechos.map((t, k) => {
    const pos = [Math.round(x + t.m.w / 2), Math.round(cy + (t.dy || 0))];
    x += t.m.w + espaco;
    const c = P.texto(`${nome}-${k}`, (t.a ?? a), z, pos, comVar({ ...docLinha(t.fonte, t.estilo), text: t.texto, fillColor: t.cor }), ancora(t.m));
    if (t.sombra) c.dropShadow = t.sombra;
    return c;
  });
}

// pessoa recortada pela máscara (track matte em luma): o que for criado antes fica atrás do corpo
function pessoaRecortada(P, a, z, durFonte) {
  const pessoa = P.video('pessoa', a, z, { durFonte, src0: a });
  const matte = P.video('matte', a, z, { assetId: 'matte', durFonte, src0: a });
  P.matte(pessoa, matte);
  return pessoa;
}

// janela que nunca cobre o rosto: a pessoa (ou a cena do B-roll) reduzida e recortada numa janela da tela.
// janela, em pixels da tela: { x, y, w, h, raio? } (cartão) ou { cx, cy, r } (círculo).
// pessoaEmJanela: o rosto (rostoY = altura do rosto no vídeo de origem) cai no centro da janela.
function pessoaEmJanela(P, a, z, janela, { escala, rostoY = 600, durFonte, nome = 'pessoa' }) {
  const { pos, recorte } = emJanela(janela, escala, [540, rostoY], [540, 960]);
  const v = P.video(nome, a, z, { durFonte, src0: a, escala, pos });
  P.mascara(v, recorte);
  return v;
}
// cenaEmJanela: o centro da cena do B-roll (1080x1920) cai no centro da janela
function cenaEmJanela(P, id, a, z, janela, { escala }) {
  const { pos, recorte } = emJanela(janela, escala, [540, 960], [540, 960]);
  const img = P.imagem(id, a, z, pos, { fit: 'cover', escala });
  P.mascara(img, recorte);
  return img;
}
// enquadramento da pessoa numa janela: a cabeça (cabelo incluso, `cabeca` px no vídeo de origem) ocupa `tamanho` da altura
// da janela e fica um pouco acima do centro (`topo`), para sobrar pescoço e ombros e o queixo nunca encostar na borda.
// rostoY é o centro da cabeça no vídeo de origem (pedido.rosto.y). Devolve { escala, rostoY } para pessoaEmJanela.
function enquadre(janela, rostoY = 600, { cabeca = 600, tamanho = 0.68, topo = 0.44 } = {}) {
  const alt = janela.r !== undefined ? janela.r * 2 : janela.h;
  const escala = Math.round(tamanho * alt / cabeca * 100);
  return { escala, rostoY: Math.round(rostoY + (0.5 - topo) * alt / (escala / 100)) };
}
// pessoa numa janela redonda sobre o B-roll, com borda: o interlocutor nunca sai de cena. borda: { cor, largura, fundo? }
function pessoaRedonda(P, a, z, { cx, cy, r }, { rostoY = 600, durFonte, borda, nome = 'pessoa-broll', cabeca }) {
  const camadas = [];
  const j = { cx, cy, r }, lg = (borda && borda.largura) || 0;
  if (borda && borda.fundo) camadas.push(P.forma(nome + '-fundo', a, z, elipse(cx, cy, r + lg, r + lg), { preenche: borda.fundo }));
  if (borda && borda.cor) camadas.push(P.forma(nome + '-anel', a, z, elipse(cx, cy, r + lg / 2, r + lg / 2), { traco: borda.cor, largura: lg || 6 }));
  camadas.push(pessoaEmJanela(P, a, z, j, { ...enquadre(j, rostoY, { cabeca }), durFonte, nome }));
  return camadas;
}
// pessoa recortada do fundo (pela máscara) e reduzida: a base do vídeo de origem cai em (cx, yBase) na tela.
// O track matte do Tesseract lê a máscara no quadro inteiro, sem a escala da camada; por isso a máscara reduzida e
// posicionada é gerada à parte (ffmpeg, ao lado do arquivo da máscara) e entra em tela cheia. Sem máscara, devolve null.
// forma: { cx, cy, r } põe o corpo DENTRO do círculo (a cabeça pode passar da borda de cima, o resto é cortado pelo arco);
// desvanece: px de dissolução na base, para o corpo não terminar numa linha reta.
function pessoaRecortadaReduzida(P, a, z, { escala, cx, yBase, durFonte, arquivoMatte, forma, desvanece = 0 }) {
  if (!arquivoMatte) return null;
  const s = escala / 100, w = Math.round(1080 * s / 2) * 2, h = Math.round(1920 * s / 2) * 2;
  const x = Math.round(cx - w / 2), y = Math.round(yBase - h);
  const marca = (forma ? `-c${forma.cx}-${forma.cy}-${forma.r}` : '') + (desvanece ? `-d${desvanece}` : '');
  const id = `matte-${escala}-${x}-${y}${marca}`;
  const dst = path.join(path.dirname(arquivoMatte), id + '.mp4');
  if (!fs.existsSync(dst)) {
    if (!forma && !desvanece) {
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', arquivoMatte, '-vf', `scale=${w}:${h},pad=1080:1920:${x}:${y}:black`,
        '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', dst]);
    } else {
      // máscara de corte multiplicada pela máscara da pessoa: círculo (com tudo acima do centro liberado) e/ou dissolução na base
      const termos = [];
      // dentro do círculo, ou acima de uma linha alta (45% do raio acima do centro), onde só há cabeça e pescoço
      if (forma) termos.push(`clip(max(${forma.r}-hypot(X-${forma.cx},Y-${forma.cy})+0.5,${Math.round(forma.cy - 0.45 * forma.r)}-Y+0.5),0,1)`);
      if (desvanece) termos.push(`clip((${yBase}-Y)/${desvanece},0,1)`);
      const expr = '255*' + termos.join('*');
      // a máscara de corte é a mesma em todos os quadros: calculada uma vez (um quadro só) e repetida
      const corte = dst.replace(/\.mp4$/, '-corte.png');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=black:s=1080x1920,format=gray,geq=lum='${expr}'`, '-frames:v', '1', corte]);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', arquivoMatte, '-loop', '1', '-framerate', '30', '-i', corte,
        '-filter_complex', `[0:v]scale=${w}:${h},pad=1080:1920:${x}:${y}:black,format=gray[m];[1:v]format=gray[k];[m][k]blend=all_mode=multiply:shortest=1,format=yuv420p[o]`,
        '-map', '[o]', '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', dst]);
      fs.rmSync(corte, { force: true });
    }
  }
  P.importaVideo(dst, id);
  const pessoa = P.video('pessoa', a, z, { durFonte, src0: a, escala, pos: [cx, yBase - 960 * s] });
  const matte = P.video('matte', a, z, { assetId: id, durFonte, src0: a });
  P.matte(pessoa, matte);
  return pessoa;
}
// posição da camada e recorte (no espaço da própria camada) para o ponto foco cair no centro da janela
function emJanela(j, escala, foco, ancoraCamada) {
  const s = escala / 100, circ = j.r !== undefined;
  const cx = circ ? j.cx : j.x + j.w / 2, cy = circ ? j.cy : j.y + j.h / 2;
  const pos = [cx - (foco[0] - ancoraCamada[0]) * s, cy - (foco[1] - ancoraCamada[1]) * s];
  const recorte = circ ? elipse(foco[0], foco[1], j.r / s, j.r / s)
    : j.raio ? retArredondado(foco[0] - j.w / 2 / s, foco[1] - j.h / 2 / s, j.w / s, j.h / s, j.raio / s)
      : retangulo(foco[0] - j.w / 2 / s, foco[1] - j.h / 2 / s, j.w / s, j.h / s);
  return { pos, recorte };
}

// desfoque que abre (entrada) ou fecha (saída) uma camada
function desfoca(P, camada, keys) {
  const id = P.efeito(camada, { type: 'gaussianBlur', blurriness: keys[0][1], repeatEdgePixels: true });
  P.kfEfeito(camada, id, 'blurriness', keys);
  return id;
}

const ehDestaque = (pedido) => {
  const set = new Set((pedido.destaques || []).map(norm));
  return (w) => set.has(norm(w));
};

// grupos de legenda em que a palavra de destaque fica sozinha
function separaDestaques(grupos, destaque) {
  const out = [];
  for (const g of grupos) {
    let cur = [];
    const fecha = () => { if (cur.length) out.push({ palavras: cur, texto: cur.map((p) => limpa(p.w)).join(' '), ini: cur[0].ini }); cur = []; };
    for (const p of g.palavras) {
      if (destaque(p.w)) { fecha(); out.push({ palavras: [p], texto: limpa(p.w), ini: p.ini, destaque: true }); } else cur.push(p);
    }
    fecha();
  }
  // tempo mínimo de 200 ms; se invadir o grupo seguinte, ele começa um pouco depois (em cascata), nunca sobreposto
  out.forEach((g, i) => {
    const prox = out[i + 1];
    g.fim = prox ? Math.max(g.ini + 200, prox.ini) : g.palavras[g.palavras.length - 1].fim + 300;
    if (prox && prox.ini < g.fim) prox.ini = g.fim;
  });
  return out;
}

const dentro = (t, janelas) => janelas.some(([a, z]) => t >= a && t < z);

module.exports = { docLinha, comVar, ancora, linhaProgressiva, linhaMista, pessoaRecortada, pessoaEmJanela, cenaEmJanela, pessoaRecortadaReduzida, enquadre, pessoaRedonda, desfoca, ehDestaque, separaDestaques, dentro, EASE, s2ms };
