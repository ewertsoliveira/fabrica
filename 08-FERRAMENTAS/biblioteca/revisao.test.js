#!/usr/bin/env node
// Teste da página de revisão da biblioteca: monta uma pasta temporária com dois estilos fictícios (um com vídeo local) e
// confere o que a pessoa vê. Rode: node 08-FERRAMENTAS/biblioteca/revisao.test.js   (a conferência de 400 px usa o Chromium)
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const revisao = require('./revisao');
const navegador = require('../carrossel/navegador');

const RAIZ = path.join(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'revisao-teste-'));
const lista = [];
const t = (nome, fn) => lista.push([nome, fn]);

// vocabulário fictício: o código e o rótulo são diferentes, para provar que a página mostra o rótulo
const VOC = {
  'combina-com': { 'cod-alfa': 'Rótulo do negócio Alfa', 'cod-beta': 'Rótulo do negócio Beta' },
  tom: { 'cod-calmo': 'Rótulo Calmo', 'cod-forte': 'Rótulo Forte' },
  precisa: { 'cod-sem-foto': 'Rótulo sem foto', 'cod-pessoa': 'Rótulo foto de pessoa' },
};
const pastas = { previas: path.join(TMP, 'lab', 'biblioteca', 'previas'), locais: path.join(TMP, 'lab', 'biblioteca', 'previas-locais'), estilos: path.join(TMP, 'lab', 'estilos') };
const saida = path.join(TMP, 'lab', 'biblioteca', 'revisao.html');
const vocabulario = path.join(TMP, 'lab', 'biblioteca', 'vocabulario.json');

function webpMinimo(destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=gray:s=108x135:d=1', '-frames:v', '1', destino], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, String(r.stderr));
}
function estilo(id, nome, linha, campos) {
  const dir = path.join(pastas.estilos, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'estilo.yaml'), `id: ${id}\nnome: ${nome}\nlinha: ${linha}\ncombina-com: [${campos[0]}]\ntom: [${campos[1]}]\nprecisa: [${campos[2]}]\n`);
}
function previas(pasta, id, extra) {
  const dir = path.join(pasta, id);
  const m = { estilo: id, gerado: '2026-01-01T00:00:00.000Z', cores: 'sugestao', capa: 'carrossel-01.webp', carrossel: ['carrossel-01.webp', 'carrossel-02.webp'],
    fixados: { apresentacao: 'fixado-apresentacao.webp', metodo: 'fixado-metodo.webp', contratar: 'fixado-contratar.webp' }, reelsCapa: 'reels-capa.webp', video: null, videoCapa: null, bytes: 500000, ...extra };
  for (const f of [...m.carrossel, ...Object.values(m.fixados || {}), m.reelsCapa].filter(Boolean)) webpMinimo(path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'previas.json'), JSON.stringify(m));
  return m;
}
const secao = (html, id) => (html.match(new RegExp(`<section class="estilo" id="${id}">[\\s\\S]*?</section>`)) || [''])[0];

function montar() {
  fs.mkdirSync(path.dirname(vocabulario), { recursive: true });
  fs.writeFileSync(vocabulario, JSON.stringify(VOC));
  estilo('alfa', 'Estilo Alfa', 'A linha do estilo Alfa.', ['cod-alfa', 'cod-calmo', 'cod-sem-foto']);
  estilo('beta', 'Estilo Beta', 'A linha do estilo Beta.', ['cod-beta', 'cod-forte', 'cod-pessoa']);
  estilo('gama', 'Estilo Gama', 'Sem prévias ainda.', ['cod-alfa', 'cod-calmo', 'cod-sem-foto']);
  previas(pastas.previas, 'alfa', { bytes: 1200000 }); // acima de 1 MB
  previas(pastas.previas, 'beta', { bytes: 500000 });
  // vídeo que ainda não foi liberado: só no manifesto local do Beta
  const loc = path.join(pastas.locais, 'beta');
  fs.mkdirSync(loc, { recursive: true });
  fs.writeFileSync(path.join(loc, 'video.webm'), 'x'); webpMinimo(path.join(loc, 'video-capa.webp'));
  fs.writeFileSync(path.join(loc, 'previas.json'), JSON.stringify({ estilo: 'beta', local: true, video: 'video.webm', videoCapa: 'video-capa.webp', bytes: 1 }));
  return revisao.gerarRevisao({ ...pastas, vocabulario, saida });
}

t('a página cita os rótulos do vocabulário e nunca os códigos', () => {
  const r = montar();
  assert.strictEqual(r.saida, saida);
  const html = fs.readFileSync(saida, 'utf8');
  for (const rot of ['Rótulo do negócio Alfa', 'Rótulo Calmo', 'Rótulo sem foto', 'Rótulo do negócio Beta', 'Rótulo Forte', 'Rótulo foto de pessoa']) assert.ok(html.includes(rot), `falta o rótulo ${rot}`);
  for (const cod of ['cod-alfa', 'cod-beta', 'cod-calmo', 'cod-forte', 'cod-sem-foto', 'cod-pessoa']) assert.ok(!html.includes(cod), `o código ${cod} não pode aparecer`);
  for (const titulo of ['Combina com', 'Tom', 'O que precisa']) assert.ok(html.includes(titulo));
  // os campos ficam agrupados dentro do estilo certo
  assert.ok(secao(html, 'alfa').includes('Rótulo do negócio Alfa') && !secao(html, 'alfa').includes('Rótulo Forte'));
  assert.ok(secao(html, 'beta').includes('Rótulo Forte') && secao(html, 'beta').includes('A linha do estilo Beta.'));
});
t('o selo "Só neste computador" aparece só no vídeo local; o estilo sem vídeo diz que o vídeo chega depois', () => {
  const html = fs.readFileSync(saida, 'utf8');
  assert.strictEqual((html.match(/Só neste computador/g) || []).length, 1, 'o selo aparece uma vez só');
  assert.ok(secao(html, 'beta').includes('Só neste computador'));
  assert.ok(/<video[^>]+src="[^"]*previas-locais\/beta\/video\.webm"/.test(secao(html, 'beta')), 'o vídeo local é mostrado');
  assert.ok(!secao(html, 'alfa').includes('Só neste computador') && !secao(html, 'alfa').includes('<video'));
  assert.ok(secao(html, 'alfa').includes('Vídeo: chega com o vídeo de demonstração'));
  assert.ok(!secao(html, 'beta').includes('chega com o vídeo de demonstração'));
});
t('vídeo liberado (em previas/) aparece sem o selo', () => {
  const liberado = path.join(TMP, 'liberado');
  const m = previas(path.join(liberado, 'previas'), 'alfa', { video: 'video.webm', videoCapa: 'video-capa.webp', bytes: 600000 });
  fs.writeFileSync(path.join(liberado, 'previas', 'alfa', m.video), 'x'); webpMinimo(path.join(liberado, 'previas', 'alfa', m.videoCapa));
  const arq = path.join(liberado, 'revisao.html');
  revisao.gerarRevisao({ ...pastas, previas: path.join(liberado, 'previas'), locais: path.join(liberado, 'nao-existe'), vocabulario, saida: arq });
  const html = fs.readFileSync(arq, 'utf8');
  assert.ok(secao(html, 'alfa').includes('<video'));
  assert.ok(!html.includes('Só neste computador'));
});
t('o vídeo local aparece mesmo quando o estilo só tem vídeo local (sem prévias de imagem)', () => {
  const base = path.join(TMP, 'so-local');
  const loc = path.join(base, 'locais', 'gama'); fs.mkdirSync(loc, { recursive: true });
  fs.writeFileSync(path.join(loc, 'video.webm'), 'x'); webpMinimo(path.join(loc, 'video-capa.webp'));
  fs.writeFileSync(path.join(loc, 'previas.json'), JSON.stringify({ estilo: 'gama', local: true, video: 'video.webm', videoCapa: 'video-capa.webp', bytes: 1 }));
  const arq = path.join(base, 'revisao.html');
  revisao.gerarRevisao({ ...pastas, previas: path.join(base, 'previas'), locais: path.join(base, 'locais'), vocabulario, saida: arq });
  const gama = secao(fs.readFileSync(arq, 'utf8'), 'gama');
  assert.ok(gama.includes('ainda não tem prévias'), 'a ficha continua dizendo que faltam as imagens');
  assert.ok(/<video[^>]+src="[^"]*locais\/gama\/video\.webm"/.test(gama), 'o vídeo local é mostrado');
  assert.ok(gama.includes('Só neste computador'));
});
t('com vídeo liberado e vídeo local do mesmo estilo, aparece o local (o que está em revisão) com o selo e a menção ao liberado', () => {
  const base = path.join(TMP, 'os-dois');
  const m = previas(path.join(base, 'previas'), 'alfa', { video: 'video.webm', videoCapa: 'video-capa.webp', bytes: 600000 });
  fs.writeFileSync(path.join(base, 'previas', 'alfa', m.video), 'x'); webpMinimo(path.join(base, 'previas', 'alfa', m.videoCapa));
  const loc = path.join(base, 'locais', 'alfa'); fs.mkdirSync(loc, { recursive: true });
  fs.writeFileSync(path.join(loc, 'video.webm'), 'y'); webpMinimo(path.join(loc, 'video-capa.webp'));
  fs.writeFileSync(path.join(loc, 'previas.json'), JSON.stringify({ estilo: 'alfa', local: true, video: 'video.webm', videoCapa: 'video-capa.webp', bytes: 1 }));
  const arq = path.join(base, 'revisao.html');
  revisao.gerarRevisao({ ...pastas, previas: path.join(base, 'previas'), locais: path.join(base, 'locais'), vocabulario, saida: arq });
  const alfa = secao(fs.readFileSync(arq, 'utf8'), 'alfa');
  const videos = [...alfa.matchAll(/<video[^>]+src="([^"]+)"/g)].map((x) => x[1]);
  assert.strictEqual(videos.length, 1, 'um vídeo só na ficha');
  assert.ok(videos[0].includes('locais/alfa/video.webm'), 'o local, que está em revisão: ' + videos[0]);
  assert.ok(alfa.includes('Só neste computador'));
  assert.ok(alfa.includes('Já existe um vídeo liberado deste estilo'), 'diz que há um liberado');
});
t('no topo, uma nota explica que "O que precisa" fala do carrossel e que o fixado de apresentação e a capa de Reels sempre usam retrato', () => {
  const html = fs.readFileSync(saida, 'utf8');
  const nota = (html.match(/<p class="nota-precisa">[\s\S]*?<\/p>/) || [''])[0];
  assert.ok(nota, 'falta a nota');
  assert.ok(nota.includes('O que precisa') && nota.includes('carrossel'));
  assert.ok(nota.includes('post fixado de apresentação') && nota.includes('capa de Reels') && nota.includes('retrato'));
  assert.ok(html.indexOf('nota-precisa">') < html.indexOf('id="resumo"'), 'a nota fica no topo, antes do resumo');
});
t('"Para você decidir" aparece só em Contraste e Concreto Ácido, cada um com a sua frase', () => {
  assert.ok(!fs.readFileSync(saida, 'utf8').includes('Para você decidir'), 'estilos comuns não têm a marca');
  const base = path.join(TMP, 'decidir');
  const p = path.join(base, 'previas');
  for (const [id, nome] of [['contraste', 'Contraste'], ['concreto-acido', 'Concreto Ácido'], ['alfa', 'Estilo Alfa']]) {
    estilo(id, nome, 'x', ['cod-alfa', 'cod-calmo', 'cod-sem-foto']); previas(p, id, {});
  }
  const arq = path.join(base, 'revisao.html');
  revisao.gerarRevisao({ ...pastas, previas: p, locais: path.join(base, 'locais'), vocabulario, saida: arq });
  const html = fs.readFileSync(arq, 'utf8');
  const c = secao(html, 'contraste'); const a = secao(html, 'concreto-acido');
  assert.ok(c.includes('Para você decidir') && c.includes('o estilo prevê recorte de pessoa, mas o carrossel de demonstração não usa foto'));
  assert.ok(a.includes('Para você decidir') && a.includes('o vídeo de Reels recorta a pessoa, mas o carrossel não usa foto'));
  assert.ok(!secao(html, 'alfa').includes('Para você decidir'));
  assert.strictEqual((html.match(/Para você decidir/g) || []).length, 2);
});
t('topo: total contra a meta de 30 MB e aviso só para o estilo acima de 1 MB', () => {
  const html = fs.readFileSync(saida, 'utf8');
  const resumo = html.match(/<div class="resumo"[\s\S]*?<ul class="indice">/)[0];
  assert.ok(resumo.includes('1,70 MB') && resumo.includes('30 MB'), 'total (1,2 + 0,5 MB) e meta');
  const avisos = html.match(/<div class="avisos"[^>]*>[\s\S]*?<\/div>/)[0];
  assert.ok(avisos.includes('Estilo Alfa') && avisos.includes('1.200 KB'), 'o estilo pesado está no aviso');
  assert.ok(!avisos.includes('Estilo Beta') && !avisos.includes('Estilo Gama'), 'só o pesado aparece no aviso');
  assert.ok(secao(html, 'alfa').includes('class="peso alto"') && !secao(html, 'beta').includes('peso alto'));
  assert.ok(secao(html, 'beta').includes('500 KB'));
  assert.ok(html.includes('--alerta:rgb(192,39,27)') && /\.avisos\{[^}]*var\(--alerta\)/.test(html), 'o aviso é vermelho');
});
t('estilo sem prévias aparece com uma frase clara, sem imagem', () => {
  const html = fs.readFileSync(saida, 'utf8');
  assert.ok(secao(html, 'gama').includes('ainda não tem prévias'));
  assert.ok(!secao(html, 'gama').includes('<img'));
});
t('sem nenhum estilo acima do limite, o topo diz isso (sem aviso vermelho)', () => {
  const arq = path.join(TMP, 'leve', 'revisao.html');
  const p = path.join(TMP, 'leve', 'previas'); previas(p, 'alfa', { bytes: 100000 });
  revisao.gerarRevisao({ ...pastas, previas: p, locais: path.join(TMP, 'leve', 'locais'), vocabulario, saida: arq });
  const html = fs.readFileSync(arq, 'utf8');
  assert.ok(html.includes('Nenhum estilo passa de 1 MB') && html.includes('class="avisos limpo"'));
});
t('imagens: carregamento preguiçoso, caminhos relativos que existem e nenhuma dependência externa', () => {
  const html = fs.readFileSync(saida, 'utf8');
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(imgs.length >= 14, `esperava as imagens dos dois estilos, vi ${imgs.length}`);
  for (const img of imgs) assert.ok(/loading="lazy"/.test(img), `sem lazy: ${img}`);
  for (const [, src] of html.matchAll(/(?:src|poster)="([^"]+)"/g)) {
    assert.ok(!/^(?:[a-z]+:)?\/\//i.test(src) && !path.isAbsolute(src) && !/^[A-Za-z]:/.test(src), `caminho não relativo: ${src}`);
    assert.ok(fs.existsSync(path.join(path.dirname(saida), decodeURIComponent(src))), `o arquivo não existe: ${src}`);
  }
  assert.ok(!/https?:\/\//.test(html), 'a página não pode chamar nada de fora');
  assert.ok(!/<script/.test(html) && !/<link/.test(html));
  assert.ok(html.includes('name="viewport"'));
});
t('o vocabulário que falta dá um erro claro', () => {
  assert.throws(() => revisao.gerarRevisao({ ...pastas, vocabulario: path.join(TMP, 'nao-tem.json'), saida: path.join(TMP, 'x.html') }), /vocabulário/);
});
t('em 400 px a página não ganha rolagem para o lado e o estilo pesado aparece em vermelho', async () => {
  const nav = await navegador.abrir();
  try {
    const pag = await nav.newPage({ viewport: { width: 400, height: 800 } });
    await pag.goto('file:///' + saida.replace(/\\/g, '/'));
    const m = await pag.evaluate(() => ({
      rolagem: document.documentElement.scrollWidth, largura: document.documentElement.clientWidth,
      peso: getComputedStyle(document.querySelector('#alfa .peso')).color,
      aviso: getComputedStyle(document.querySelector('#avisos')).color,
    }));
    assert.ok(m.rolagem <= m.largura, `a página rola para o lado: ${m.rolagem} > ${m.largura}`);
    assert.strictEqual(m.peso, 'rgb(192, 39, 27)'); assert.strictEqual(m.aviso, 'rgb(192, 39, 27)');
  } finally { await nav.close(); }
});
t('o revisao.html (que pode mostrar vídeo local) está no .gitignore', () => {
  const ignora = (p) => spawnSync('git', ['check-ignore', '-q', p], { cwd: RAIZ }).status === 0;
  assert.ok(ignora('04-LABORATORIO-DE-DESIGN/biblioteca/revisao.html'));
  assert.ok(!ignora('04-LABORATORIO-DE-DESIGN/biblioteca/vocabulario.json'));
});

(async () => {
  let n = 0;
  try {
    for (const [nome, fn] of lista) { await fn(); n++; console.log('ok   ' + nome); }
  } catch (e) {
    console.error('FALHOU: ' + (e && e.stack || e));
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${n} testes passaram.`);
})();
