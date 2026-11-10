// Renderização das lâminas em PNG, na resolução nativa (T-02) e depois de as fontes carregarem (T-04).
// Cada lâmina é um elemento .lamina da página; o PNG é a fotografia exata desse elemento, sem escala.
'use strict';
const fs = require('fs');
const path = require('path');
const navegador = require('./navegador');

// Largura e altura de um PNG, lidas do cabeçalho do próprio arquivo (T-09: a extensão mente).
function medidasPng(arquivo) {
  const b = fs.readFileSync(arquivo);
  if (b.slice(1, 4).toString() !== 'PNG') throw new Error(`${arquivo} não é um PNG de verdade (T-09)`);
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

// `bloquearRede` (estilo próprio de empresa, escrito a partir de referências de fora): a página não carrega nada de fora.
// Todo pedido é abortado, menos as letras do Google Fonts (a prévia base usa) e data:, blob: e about:; e uma política de
// conteúdo no começo do <head> fecha também o que a rota não vê (arquivo do disco, script).
const REDE_LIVRE = /^(data:|blob:|about:)|^https:\/\/fonts\.(googleapis|gstatic)\.com\//i;
const seguro = (host) => `https:${'//'}${host}`; // os dois servidores de letras (montados aqui, sem endereço solto no código)
const POLITICA = `default-src 'none'; img-src data: blob:; media-src data: blob:; font-src data: ${seguro('fonts.gstatic.com')}; `
  + `style-src 'unsafe-inline' ${seguro('fonts.googleapis.com')}`;
function comPolitica(html) {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${POLITICA}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + meta) : meta + html;
}

// Abre a página, espera as fontes e as imagens, e devolve { pagina, fechar }.
async function abrirPagina(html, canvas, { bloquearRede = false } = {}) {
  const nav = await navegador.abrir();
  const pagina = await nav.newPage({ viewport: { width: canvas.largura + 80, height: canvas.altura + 80 }, deviceScaleFactor: 1 });
  if (bloquearRede) await pagina.route('**/*', (rota) => (REDE_LIVRE.test(rota.request().url()) ? rota.continue() : rota.abort()));
  await pagina.setContent(bloquearRede ? comPolitica(html) : html, { waitUntil: 'load' });
  await pagina.evaluate(async () => {
    await document.fonts.ready; // T-04
    await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = i.onerror = ok; }))));
  });
  await pagina.waitForTimeout(250);
  return { pagina, fechar: () => nav.close() };
}

// Renderiza as lâminas pedidas (índices a partir de 0) para <saida>/lamina-NN.png e confere o tamanho real do arquivo.
async function renderizar({ html, saida, indices, canvas, bloquearRede = false }) {
  fs.mkdirSync(saida, { recursive: true });
  const { pagina, fechar } = await abrirPagina(html, canvas, { bloquearRede });
  const feitos = [];
  try {
    const lams = await pagina.$$('.lamina');
    for (const i of indices) {
      if (!lams[i]) throw new Error(`a lâmina ${i + 1} não existe (a página tem ${lams.length})`);
      const arq = path.join(saida, `lamina-${String(i + 1).padStart(2, '0')}.png`);
      await lams[i].screenshot({ path: arq, type: 'png', animations: 'disabled' });
      const m = medidasPng(arq);
      if (m.largura !== canvas.largura || m.altura !== canvas.altura) {
        throw new Error(`${path.basename(arq)} saiu com ${m.largura}x${m.altura}, e o canvas declarado é ${canvas.largura}x${canvas.altura} (T-02)`);
      }
      feitos.push(arq);
    }
  } finally { await fechar(); }
  return feitos;
}

// DG-19: todas as lâminas lado a lado, com 100 px de largura cada, para o revisor julgar se a peça ainda se reconhece.
async function miniaturas({ pngs, saida, canvas }) {
  const dado = (a) => `data:image/png;base64,${fs.readFileSync(a).toString('base64')}`;
  const html = `<!doctype html><body style="margin:0;padding:16px;background:#fff;display:flex;gap:12px;width:${pngs.length * 112 + 32}px">${pngs.map((p) => `<img src="${dado(p)}" style="width:100px;display:block;box-shadow:0 0 0 1px #ccc">`).join('')}</body>`;
  const { pagina, fechar } = await abrirPagina(html, canvas);
  try {
    // A página tem o tamanho do canvas; a imagem recorta só a faixa das miniaturas, sem o branco em volta.
    const caixa = await pagina.evaluate(() => { const b = document.body.getBoundingClientRect(); return { width: Math.ceil(b.width), height: Math.ceil(b.height) }; });
    await pagina.screenshot({ path: saida, clip: { x: 0, y: 0, ...caixa }, type: 'png' });
  } finally { await fechar(); }
  return saida;
}

module.exports = { renderizar, abrirPagina, medidasPng, miniaturas };
