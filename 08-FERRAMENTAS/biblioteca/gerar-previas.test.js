#!/usr/bin/env node
// Teste das prévias base da biblioteca: roda o gerador de verdade (Chromium + ffmpeg) em pastas temporárias.
// Rode: node 08-FERRAMENTAS/biblioteca/gerar-previas.test.js   (precisa do Chromium; veja carrossel/navegador.js)
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const previas = require('./gerar-previas');
const navegador = require('../carrossel/navegador');

const SCRIPT = path.join(__dirname, 'gerar-previas.js');
const RAIZ = path.join(__dirname, '..', '..');
const ESTILOS = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'estilos');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'previas-teste-'));
let n = 0;
const lista = [];
const t = (nome, fn) => lista.push([nome, fn]);
const demo = (id, arq) => JSON.parse(fs.readFileSync(path.join(ESTILOS, id, arq), 'utf8'));
const existe = (...p) => fs.existsSync(path.join(...p));
const manifesto = (saida, id) => JSON.parse(fs.readFileSync(path.join(saida, id, 'previas.json'), 'utf8'));

// Largura e altura de um .webp lidas do cabeçalho (VP8 com perda, VP8L sem perda ou VP8X estendido).
function medidasWebp(arq) {
  const b = fs.readFileSync(arq);
  assert.strictEqual(b.slice(0, 4).toString(), 'RIFF', `${arq} não é RIFF`);
  assert.strictEqual(b.slice(8, 12).toString(), 'WEBP', `${arq} não é webp de verdade`);
  const tipo = b.slice(12, 16).toString();
  if (tipo === 'VP8 ') return { l: b.readUInt16LE(26) & 0x3fff, a: b.readUInt16LE(28) & 0x3fff };
  if (tipo === 'VP8L') { const v = b.readUInt32LE(21); return { l: (v & 0x3fff) + 1, a: ((v >> 14) & 0x3fff) + 1 }; }
  if (tipo === 'VP8X') return { l: 1 + b.readUIntLE(24, 3), a: 1 + b.readUIntLE(27, 3) };
  throw new Error('tipo de webp desconhecido: ' + tipo);
}

// Conta os pixels de uma imagem que estão perto de uma cor (no próprio Chromium, que decodifica o webp).
async function pixelsPerto(arq, [r, g, b], distancia = 90) {
  const nav = await navegador.abrir();
  try {
    const pag = await nav.newPage();
    const dado = 'data:image/webp;base64,' + fs.readFileSync(arq).toString('base64');
    return await pag.evaluate(async ([src, alvo, dist]) => {
      const img = new Image();
      await new Promise((ok, falha) => { img.onload = ok; img.onerror = () => falha(new Error('imagem não carregou')); img.src = src; });
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let achados = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.hypot(d[i] - alvo[0], d[i + 1] - alvo[1], d[i + 2] - alvo[2]) < dist) achados++;
      return achados;
    }, [dado, [r, g, b], distancia]);
  } finally { await nav.close(); }
}

const saidaA = path.join(TMP, 'a');

// ---------- o que sai de cada estilo ----------
t('protagonista: carrossel, 3 fixados, capa de Reels e capa do cartão, todos com 1080 px de largura', async () => {
  const m = await previas.gerarImagens('protagonista', { saida: saidaA });
  const total = demo('protagonista', 'demo.json').length;
  assert.deepStrictEqual(m.carrossel, Array.from({ length: total }, (_, i) => `carrossel-${String(i + 1).padStart(2, '0')}.webp`));
  assert.deepStrictEqual(m.fixados, { apresentacao: 'fixado-apresentacao.webp', metodo: 'fixado-metodo.webp', contratar: 'fixado-contratar.webp' });
  assert.strictEqual(m.reelsCapa, 'reels-capa.webp');
  assert.strictEqual(m.capa, 'carrossel-01.webp', 'a capa é o nome de um arquivo que já existe, sem cópia');
  assert.strictEqual(m.cores, 'sugestao');
  assert.strictEqual(m.video, null); assert.strictEqual(m.videoCapa, null);
  assert.ok(!Number.isNaN(Date.parse(m.gerado)), 'gerado deve ser uma data ISO');
  const todos = [...m.carrossel, ...Object.values(m.fixados), m.reelsCapa];
  for (const f of todos) {
    assert.ok(!path.isAbsolute(f) && !f.includes('/') && !f.includes('\\'), `${f}: o manifesto guarda só o nome do arquivo`);
    assert.ok(existe(saidaA, 'protagonista', f), `falta ${f}`);
    assert.strictEqual(medidasWebp(path.join(saidaA, 'protagonista', f)).l, 1080, `${f}: largura`);
  }
  // proporções: carrossel 4:5, fixados 3:4, capa de Reels 9:16
  assert.strictEqual(medidasWebp(path.join(saidaA, 'protagonista', 'carrossel-01.webp')).a, 1350);
  assert.strictEqual(medidasWebp(path.join(saidaA, 'protagonista', 'fixado-metodo.webp')).a, 1440);
  assert.strictEqual(medidasWebp(path.join(saidaA, 'protagonista', 'reels-capa.webp')).a, 1920);
  // não existe mais a cópia capa.webp, e o peso não conta a capa duas vezes
  assert.ok(!existe(saidaA, 'protagonista', 'capa.webp'), 'capa.webp não deve ser gravada');
  assert.ok(existe(saidaA, 'protagonista', m.capa));
  // o campo bytes é a soma dos arquivos listados, e o arquivo em disco é o mesmo manifesto
  assert.strictEqual(m.bytes, todos.reduce((s, f) => s + fs.statSync(path.join(saidaA, 'protagonista', f)).size, 0));
  assert.deepStrictEqual(manifesto(saidaA, 'protagonista'), m);
  assert.ok(m.bytes < previas.LIMITE_ESTILO, `protagonista pesa ${m.bytes} bytes`);
  console.log(`     (protagonista: ${Math.round(m.bytes / 1000)} KB)`);
});
t('primeira-pagina (só capa de Reels): só reels-capa, que também é a capa; carrossel vazio, fixados nulo', async () => {
  const dir = path.join(saidaA, 'primeira-pagina');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'capa.webp'), 'sobra de uma rodada antiga'); // a cópia antiga some
  const m = await previas.gerarImagens('primeira-pagina', { saida: saidaA });
  assert.deepStrictEqual(m.carrossel, []);
  assert.strictEqual(m.fixados, null);
  assert.strictEqual(m.reelsCapa, 'reels-capa.webp');
  assert.strictEqual(m.capa, 'reels-capa.webp');
  const arquivos = fs.readdirSync(dir).sort();
  assert.deepStrictEqual(arquivos, ['previas.json', 'reels-capa.webp']);
  assert.deepStrictEqual(medidasWebp(path.join(dir, m.capa)), { l: 1080, a: 1920 });
  assert.strictEqual(m.bytes, fs.statSync(path.join(dir, 'reels-capa.webp')).size, 'a capa não conta duas vezes');
  console.log(`     (primeira-pagina: ${Math.round(m.bytes / 1000)} KB)`);
});
t('cartilha: estilo do catálogo com tudo, dentro do peso', async () => {
  const m = await previas.gerarImagens('cartilha', { saida: saidaA });
  assert.strictEqual(m.carrossel.length, demo('cartilha', 'demo.json').length);
  assert.ok(m.fixados && m.reelsCapa);
  assert.ok(m.bytes < previas.LIMITE_ESTILO, `cartilha pesa ${m.bytes} bytes`);
  console.log(`     (cartilha: ${Math.round(m.bytes / 1000)} KB)`);
});

// ---------- a marca da empresa não vaza ----------
t('com FABRICA_MARCA de acento verde puro, nenhum pixel da capa fica perto do verde, e o manifesto diz sugestao', async () => {
  const exemplo = fs.readFileSync(path.join(RAIZ, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml'), 'utf8');
  const hex = (r, g, b) => '"#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase() + '"';
  const VERDE_PURO = hex(0, 255, 0);
  const paleta = { escuro: hex(0, 51, 0), claro: hex(204, 255, 204), acento: VERDE_PURO, neutro: hex(102, 170, 102) };
  let verde = exemplo;
  for (const [papel, cor] of Object.entries(paleta)) verde = verde.replace(new RegExp(papel + ': "#[0-9A-Fa-f]{6}"'), papel + ': ' + cor);
  assert.ok(verde.includes('acento: ' + VERDE_PURO), 'a marca fictícia precisa ter o acento verde puro');
  const arqMarca = path.join(TMP, 'marca-verde.yaml');
  fs.writeFileSync(arqMarca, verde);
  const saida = path.join(TMP, 'vazamento');
  const r = spawnSync(process.execPath, [SCRIPT, 'protagonista', '--saida', saida], { encoding: 'utf8', timeout: 240000,
    env: { ...process.env, FABRICA_MARCA: arqMarca, FABRICA_EMPRESA: 'empresa-que-nao-existe' } });
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.strictEqual(manifesto(saida, 'protagonista').cores, 'sugestao');
  const capa = path.join(saida, 'protagonista', manifesto(saida, 'protagonista').capa);
  // calibração: o contador acha o verde quando ele existe
  const sintetico = path.join(TMP, 'verde.webp');
  const fonte = path.join(TMP, 'verde.png');
  assert.strictEqual(spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x00FF00:s=64x64', '-frames:v', '1', fonte]).status, 0);
  previas.pngParaWebp(fonte, sintetico, { largura: 64, qualidade: 80 });
  assert.ok(await pixelsPerto(sintetico, [0, 255, 0]) > 4000, 'o contador não achou o verde de calibração');
  assert.strictEqual(await pixelsPerto(capa, [0, 255, 0]), 0, 'há pixel perto do verde da marca fictícia: a marca vazou');
  // e o acento do próprio estilo (rgb 255, 107, 53) está lá, e não outro
  assert.ok(await pixelsPerto(capa, [255, 107, 53], 40) > 1000, 'o acento original do estilo não aparece na capa');
});

// ---------- importar o módulo não mexe no ambiente de quem importa (R3 só vale quando roda como comando) ----------
t('importado como módulo: o ambiente de quem chama fica como estava e a marca da empresa nunca é usada', async () => {
  const exemplo = fs.readFileSync(path.join(RAIZ, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml'), 'utf8');
  const arqMarca = path.join(TMP, 'marca-da-empresa.yaml');
  const verde = '#' + (0x00ff00).toString(16).padStart(6, '0'); // montado em código: o validador não aceita hex solto fora de estilo
  fs.writeFileSync(arqMarca, exemplo.replace(/acento: "#[0-9A-Fa-f]{6}"/, `acento: "${verde}"`));
  const saida = path.join(TMP, 'importado');
  const script = path.join(TMP, 'importa.js');
  const marcaJs = path.join(RAIZ, '08-FERRAMENTAS', 'marca', 'marca');
  fs.writeFileSync(script, [
    "const assert = require('assert');",
    'const antes = { m: process.env.FABRICA_MARCA, e: process.env.FABRICA_EMPRESA };',
    `const marca = require(${JSON.stringify(marcaJs)}); // quem chama já tem a marca da empresa carregada`,
    "assert.ok(marca.ARQUIVO.endsWith('marca-da-empresa.yaml'), marca.ARQUIVO);",
    `const previas = require(${JSON.stringify(SCRIPT)});`,
    "assert.strictEqual(process.env.FABRICA_MARCA, antes.m, 'importar não pode trocar FABRICA_MARCA');",
    "assert.strictEqual(process.env.FABRICA_EMPRESA, antes.e, 'importar não pode apagar FABRICA_EMPRESA');",
    `previas.gerarImagens('primeira-pagina', { saida: ${JSON.stringify(saida)} }).then(() => {`,
    "  assert.strictEqual(process.env.FABRICA_MARCA, antes.m, 'gerar não pode deixar FABRICA_MARCA trocada');",
    "  assert.strictEqual(process.env.FABRICA_EMPRESA, antes.e, 'gerar não pode deixar FABRICA_EMPRESA apagada');",
    "  assert.ok(previas.arquivoDaMarca().endsWith('marca.exemplo.yaml'), 'a geração usou ' + previas.arquivoDaMarca());",
    "  assert.ok(marca.ARQUIVO.endsWith('marca-da-empresa.yaml'), 'a marca de quem chamou continua a dele');",
    '}).catch((e) => { console.error(e.stack || e); process.exit(1); });',
  ].join('\n'));
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 240000, env: { ...process.env, FABRICA_MARCA: arqMarca, FABRICA_EMPRESA: 'empresa-que-nao-existe' } });
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.strictEqual(manifesto(saida, 'primeira-pagina').cores, 'sugestao');
});

// ---------- rodar de novo depois de o estilo mudar ----------
t('com um demo menor, as lâminas antigas somem; arquivo estranho e vídeo ficam', async () => {
  const dir = path.join(saidaA, 'protagonista');
  assert.ok(existe(dir, 'carrossel-05.webp') && existe(dir, 'carrossel-06.webp'), 'a primeira rodada devia ter 6 lâminas');
  fs.writeFileSync(path.join(dir, 'minha-nota.txt'), 'não apague');
  fs.writeFileSync(path.join(dir, 'video.webm'), 'x');
  fs.writeFileSync(path.join(dir, 'video-capa.webp'), 'x');
  fs.mkdirSync(path.join(dir, 'carrossel-09.webp')); // pasta com nome de lâmina: não é arquivo do script
  const curto = demo('protagonista', 'demo.json').slice(0, 4);
  const m = await previas.gerarImagens('protagonista', { saida: saidaA, demo: { carrossel: curto } });
  assert.strictEqual(m.carrossel.length, 4);
  assert.ok(!existe(dir, 'carrossel-05.webp') && !existe(dir, 'carrossel-06.webp'), 'as lâminas 5 e 6 antigas deviam sumir');
  assert.ok(existe(dir, 'carrossel-04.webp'));
  assert.ok(existe(dir, 'minha-nota.txt'), 'arquivo que o script não criou foi apagado');
  assert.ok(existe(dir, 'video.webm') && existe(dir, 'video-capa.webp'), 'arquivo de vídeo foi apagado');
  assert.ok(fs.statSync(path.join(dir, 'carrossel-09.webp')).isDirectory());
  assert.deepStrictEqual(manifesto(saidaA, 'protagonista').carrossel.length, 4);
});
t('limparAntigos apaga só os nomes que o script cria e que o manifesto novo não lista', () => {
  const dir = path.join(TMP, 'limpeza');
  fs.mkdirSync(dir);
  const nomes = ['carrossel-01.webp', 'carrossel-02.webp', 'carrossel-03.webp', 'fixado-apresentacao.webp', 'fixado-metodo.webp', 'fixado-contratar.webp',
    'reels-capa.webp', 'capa.webp', 'previas.json', 'minha-nota.txt', 'carrossel-1.webp', 'foto.webp', 'fixado-extra.png', 'fixado-extra.webp', 'fixado-meu.webp',
    'video.webm', 'video-capa.webp', 'outro.png'];
  for (const f of nomes) fs.writeFileSync(path.join(dir, f), 'x');
  const apagados = previas.limparAntigos(dir, { capa: 'carrossel-01.webp', carrossel: ['carrossel-01.webp'], fixados: null, reelsCapa: null });
  // capa.webp (a cópia antiga) também some; fixado só com os 3 nomes que o script cria; vídeo nunca
  assert.deepStrictEqual(apagados.sort(), ['capa.webp', 'carrossel-02.webp', 'carrossel-03.webp', 'fixado-apresentacao.webp', 'fixado-contratar.webp', 'fixado-metodo.webp', 'reels-capa.webp']);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['carrossel-01.webp', 'carrossel-1.webp', 'fixado-extra.png', 'fixado-extra.webp', 'fixado-meu.webp', 'foto.webp', 'minha-nota.txt', 'outro.png', 'previas.json', 'video-capa.webp', 'video.webm']);
  // mesmo que o manifesto não liste o vídeo, ele não é apagado
  assert.deepStrictEqual(previas.limparAntigos(dir, { capa: null, carrossel: [], fixados: null, reelsCapa: null, video: null, videoCapa: null }).sort(), ['carrossel-01.webp']);
  assert.ok(existe(dir, 'video.webm') && existe(dir, 'video-capa.webp'));
  assert.deepStrictEqual(previas.limparAntigos(path.join(TMP, 'nao-existe'), { capa: null, carrossel: [] }), []);
});

// ---------- peso ----------
t('conferirPeso: manifesto de 1,2 MB é devolvido em acima; o total soma os estilos', () => {
  const r = previas.conferirPeso([{ estilo: 'leve', bytes: 400_000 }, { estilo: 'pesado', bytes: 1_200_000 }]);
  assert.deepStrictEqual(r.acima, ['pesado']);
  assert.strictEqual(r.total, 1_600_000);
  assert.deepStrictEqual(r.porEstilo, { leve: 400_000, pesado: 1_200_000 });
  assert.deepStrictEqual(previas.conferirPeso([{ estilo: 'no-limite', bytes: previas.LIMITE_ESTILO }]).acima, []);
  assert.strictEqual(previas.LIMITE_ESTILO, 1_000_000); assert.strictEqual(previas.LIMITE_TOTAL, 30_000_000);
});
t('estilo acima do limite: o comando diz qual, sai com 1 e deixa os arquivos gravados', () => {
  const saida = path.join(TMP, 'pesado');
  const r = spawnSync(process.execPath, [SCRIPT, 'primeira-pagina', '--saida', saida, '--limite-estilo', '1000'], { encoding: 'utf8', timeout: 240000, env: process.env });
  assert.strictEqual(r.status, 1, (r.stdout || '') + (r.stderr || ''));
  assert.match(r.stderr, /primeira-pagina/);
  assert.match(r.stderr, /acima de 1 KB/);
  assert.ok(existe(saida, 'primeira-pagina', 'reels-capa.webp') && existe(saida, 'primeira-pagina', 'previas.json'), 'os arquivos deviam ficar gravados');
});
t('estilo acima do limite: baixa só a qualidade (e a largura continua 1080)', async () => {
  const leve = await previas.gerarImagens('primeira-pagina', { saida: path.join(TMP, 'q1'), qualidades: [80] });
  const menor = await previas.gerarImagens('primeira-pagina', { saida: path.join(TMP, 'q2'), qualidades: [80, 30], limiteEstilo: 1 });
  assert.ok(menor.bytes < leve.bytes, `${menor.bytes} deveria ser menor que ${leve.bytes}`);
  assert.strictEqual(medidasWebp(path.join(TMP, 'q2', 'primeira-pagina', menor.capa)).l, 1080);
});
t('estilo desconhecido: o comando diz quais existem e sai com 1, sem gravar nada', () => {
  const saida = path.join(TMP, 'nada');
  const r = spawnSync(process.execPath, [SCRIPT, 'nao-existe', '--saida', saida], { encoding: 'utf8', timeout: 60000, env: process.env });
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /estilo desconhecido: nao-existe.*protagonista/);
  assert.ok(!fs.existsSync(saida));
});

// ---------- prévia em vídeo (--video) ----------
// MP4 sintético: 1080x1920, 16 s, testsrc com áudio. Uma faixa no alto fica vermelha até 5 s e azul depois: assim dá para
// provar que o trecho de 12 s pega a troca de quadro (5 s) com um tempo de vídeo antes dela. Sem rodar o montar.js (--reusar).
const mp4Pastas = path.join(TMP, 'mp4');
const modeloDe = (id) => require('../carrossel/molde').lerEstilo(id).dados.formatos.reels.modelo;
function criarMp4(destino, duracao = 16) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const faixa = (cor, cond) => `drawbox=x=0:y=0:w=iw:h=200:color=${cor}:t=fill:enable='${cond}'`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `testsrc=size=1080x1920:rate=30:duration=${duracao}`,
    '-f', 'lavfi', '-i', `sine=frequency=440:duration=${duracao}`,
    '-vf', `${faixa('red', 'lt(t,5)')},${faixa('blue', 'gte(t,5)')}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', destino], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, String(r.stderr));
}
const sonda = (arq, args) => {
  const r = spawnSync('ffprobe', ['-v', 'error', ...args, '-of', 'json', arq], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, String(r.stderr));
  return JSON.parse(r.stdout);
};
// cor (r,g,b) do pixel (x,y) do quadro em `em` segundos (padrão: o primeiro) de um vídeo ou imagem
function pixel(arq, x, y, em = 0) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(em), '-i', arq, '-vf', `format=rgb24,crop=1:1:${x}:${y}`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: 'buffer' });
  assert.strictEqual(r.status, 0, String(r.stderr));
  return [...r.stdout.slice(0, 3)];
}
const ehAzul = ([r, g, b]) => r < 110 && b > 140;
const pedidoVideo = (nome, extra = {}) => {
  const arq = path.join(TMP, nome + '.json');
  fs.writeFileSync(arq, JSON.stringify({ titulo: 'teste', video: 'x.mp4', palavras: 'palavras.json', trecho: { ini: 0, fim: 16 }, broll: [{ img: 'x.png', ini: 5, fim: 9.5 }], ...extra }));
  return arq;
};
const roda = (args, extra = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 240000, env: process.env, ...extra });

t('--video sem "liberado": nada em previas/, tudo em previas-locais/, trecho de 12 s, 540x960, sem áudio, VP9', () => {
  criarMp4(path.join(mp4Pastas, modeloDe('protagonista') + '.mp4'));
  const base = path.join(TMP, 'v1');
  const saida = path.join(base, 'previas');
  const r = roda(['protagonista', '--video', pedidoVideo('ped-local'), '--reusar', mp4Pastas, '--saida', saida, '--saida-local', path.join(base, 'previas-locais')]);
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.ok(!fs.existsSync(saida), 'nada pode ser gravado em previas/ sem "liberado": true');
  const dir = path.join(base, 'previas-locais', 'protagonista');
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['previas.json', 'video-capa.webp', 'video.webm']);
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'previas.json'), 'utf8'));
  assert.strictEqual(m.local, true);
  assert.strictEqual(m.estilo, 'protagonista');
  assert.strictEqual(m.video, 'video.webm'); assert.strictEqual(m.videoCapa, 'video-capa.webp');
  const webm = path.join(dir, 'video.webm');
  const info = sonda(webm, ['-show_entries', 'format=duration:stream=codec_type,codec_name,width,height']);
  assert.ok(Math.abs(Number(info.format.duration) - 12) <= 0.2, `duração ${info.format.duration}`);
  const video = info.streams.filter((s) => s.codec_type === 'video');
  assert.strictEqual(video.length, 1); assert.strictEqual(video[0].codec_name, 'vp9');
  assert.strictEqual(video[0].width, 540); assert.strictEqual(video[0].height, 960);
  assert.strictEqual(info.streams.filter((s) => s.codec_type === 'audio').length, 0, 'o trecho não pode ter áudio');
  // o trecho começa 4,5 s antes da troca de quadro (5 s do vídeo): a faixa é vermelha no primeiro quadro, já é azul depois de
  // 4,7 s do trecho, e a capa (quadro do meio, 6 s do trecho) é azul
  assert.ok(!ehAzul(pixel(webm, 50, 25)), 'o trecho devia começar antes da troca de quadro (faixa vermelha)');
  assert.ok(ehAzul(pixel(webm, 50, 25, 4.7)), 'a troca de quadro devia estar dentro do trecho (faixa azul depois de 4,7 s)');
  assert.deepStrictEqual(medidasWebp(path.join(dir, 'video-capa.webp')), { l: 540, a: 960 });
  assert.ok(ehAzul(pixel(path.join(dir, 'video-capa.webp'), 50, 25)), 'a capa devia ser um quadro do trecho');
  assert.strictEqual(m.bytes, fs.statSync(webm).size + fs.statSync(path.join(dir, 'video-capa.webp')).size);
  assert.match(r.stdout, /previas-locais/);
});
t('--video com "liberado": true: video.webm e video-capa.webp entram em previas/<id>/ e no manifesto', () => {
  const base = path.join(TMP, 'v2');
  const saida = path.join(base, 'previas');
  const r = roda(['protagonista', '--video', pedidoVideo('ped-liberado', { liberado: true }), '--reusar', mp4Pastas, '--saida', saida]);
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  assert.ok(!fs.existsSync(path.join(base, 'previas-locais')), 'liberado não grava em previas-locais');
  const dir = path.join(saida, 'protagonista');
  assert.ok(existe(dir, 'video.webm') && existe(dir, 'video-capa.webp'));
  const m = manifesto(saida, 'protagonista');
  assert.strictEqual(m.video, 'video.webm'); assert.strictEqual(m.videoCapa, 'video-capa.webp');
  assert.ok(!('local' in m) || m.local === false);
  assert.strictEqual(m.bytes, fs.statSync(path.join(dir, 'video.webm')).size + fs.statSync(path.join(dir, 'video-capa.webp')).size);
});
t('"liberado" só vale com true de verdade: "true", 1, false e ausente vão para previas-locais', () => {
  for (const [i, valor] of [['textotrue', 'true'], ['um', 1], ['falso', false], ['sim', 'sim']]) {
    const base = path.join(TMP, 'v3-' + i);
    const saida = path.join(base, 'previas');
    const r = roda(['protagonista', '--video', pedidoVideo('ped-' + i, { liberado: valor }), '--reusar', mp4Pastas, '--saida', saida, '--saida-local', path.join(base, 'previas-locais')]);
    assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
    assert.ok(!fs.existsSync(saida), `liberado=${i}: não pode gravar em previas/`);
    assert.ok(existe(base, 'previas-locais', 'protagonista', 'video.webm'));
  }
});
// R7 (privacidade): o vídeo que ainda não foi liberado nunca vai para uma pasta que o git não ignora. A pasta local é sempre
// previas-locais/ (ignorada), qualquer que seja o --saida; só um --saida-local explícito (os testes usam) a troca.
t('R7: a pasta local padrão não depende do --saida e é a pasta ignorada pelo git', () => {
  const ignorada = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'biblioteca', 'previas-locais');
  assert.strictEqual(previas.PASTA_LOCAL_PADRAO, ignorada);
  assert.strictEqual(previas.pastaLocal(), ignorada);
  assert.strictEqual(previas.pastaLocal(path.join(TMP, 'qualquer', 'previas')), ignorada, 'um --saida diferente não muda a pasta local');
  assert.strictEqual(previas.pastaLocal(path.join(RAIZ, 'outra-pasta-do-repositorio')), ignorada);
  assert.strictEqual(previas.pastaLocal(path.join(TMP, 'x'), path.join(TMP, 'y')), path.join(TMP, 'y'), '--saida-local explícito vale');
  assert.ok(spawnSync('git', ['check-ignore', '-q', path.join(ignorada, 'protagonista', 'video.webm')], { cwd: RAIZ }).status === 0, 'a pasta padrão precisa estar no .gitignore');
});
t('R7: --video sem liberado e com --saida personalizado e sem --saida-local grava em previas-locais/ do repositório, não ao lado da saída', () => {
  const alvo = path.join(previas.PASTA_LOCAL_PADRAO, 'protagonista');
  if (fs.existsSync(alvo)) return; // já tem vídeo local de verdade do responsável: não mexer; o teste unitário acima cobre a regra
  const criou = !fs.existsSync(previas.PASTA_LOCAL_PADRAO);
  const base = path.join(TMP, 'r7');
  try {
    const r = roda(['protagonista', '--video', pedidoVideo('ped-r7'), '--reusar', mp4Pastas, '--saida', path.join(base, 'previas')]);
    assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
    assert.ok(!fs.existsSync(base), 'nada ao lado do --saida personalizado');
    assert.ok(existe(alvo, 'video.webm'), 'o vídeo não liberado vai para a pasta local padrão (ignorada)');
  } finally {
    fs.rmSync(alvo, { recursive: true, force: true });
    if (criou) fs.rmSync(previas.PASTA_LOCAL_PADRAO, { recursive: true, force: true });
  }
});
t('--video com broll vazio (ou ausente): erro claro, sai 1 e não grava nada', () => {
  for (const [nome, extra] of [['vazio', { broll: [], liberado: true }], ['ausente', { broll: undefined, liberado: true }]]) {
    const base = path.join(TMP, 'v4-' + nome);
    const r = roda(['protagonista', '--video', pedidoVideo('ped-broll-' + nome, extra), '--reusar', mp4Pastas, '--saida', path.join(base, 'previas')]);
    assert.strictEqual(r.status, 1, (r.stdout || '') + (r.stderr || ''));
    assert.match(r.stderr, /o pedido não tem B-roll; o trecho começa na troca de quadro/);
    assert.ok(!fs.existsSync(base), 'nada deveria ser gravado');
  }
});
t('--video: MP4 que falta na pasta do --reusar, MP4 curto demais e pedido que não existe dão erro claro e sair 1', () => {
  const pedido = pedidoVideo('ped-erros', { liberado: true });
  const vazia = path.join(TMP, 'mp4-vazia'); fs.mkdirSync(vazia);
  let r = roda(['protagonista', '--video', pedido, '--reusar', vazia, '--saida', path.join(TMP, 'v5', 'previas')]);
  assert.strictEqual(r.status, 1); assert.match(r.stderr, /protagonista\.mp4/);
  // vídeo de 8 s: de 5 s em diante só restam 3 s
  const curto = path.join(TMP, 'mp4-curto'); criarMp4(path.join(curto, modeloDe('protagonista') + '.mp4'), 8);
  r = roda(['protagonista', '--video', pedido, '--reusar', curto, '--saida', path.join(TMP, 'v5', 'previas')]);
  assert.strictEqual(r.status, 1); assert.match(r.stderr, /curto demais|só tem 8/);
  r = roda(['protagonista', '--video', path.join(TMP, 'nao-existe.json'), '--reusar', mp4Pastas, '--saida', path.join(TMP, 'v5', 'previas')]);
  assert.strictEqual(r.status, 1); assert.match(r.stderr, /pedido/);
  r = roda(['protagonista', '--reusar', mp4Pastas]);
  assert.strictEqual(r.status, 1); assert.match(r.stderr, /--reusar.*--video/);
  assert.ok(!fs.existsSync(path.join(TMP, 'v5')), 'nada deveria ser gravado');
});
t('cortarTrecho: corta o intervalo pedido (ini e duração) e grava o webm e a capa', () => {
  const mp4 = path.join(mp4Pastas, modeloDe('protagonista') + '.mp4');
  const dir = path.join(TMP, 'corte'); fs.mkdirSync(dir);
  previas.cortarTrecho(mp4, path.join(dir, 'a.webm'), path.join(dir, 'a.webp'), { ini: 5, duracao: 3 });
  const d = Number(sonda(path.join(dir, 'a.webm'), ['-show_entries', 'format=duration']).format.duration);
  assert.ok(Math.abs(d - 3) <= 0.2, `duração ${d}`);
  assert.strictEqual(previas.DURACAO_TRECHO, 12);
  // antes da troca de quadro a faixa é vermelha: um corte em 1 s não pode ser azul
  previas.cortarTrecho(mp4, path.join(dir, 'b.webm'), path.join(dir, 'b.webp'), { ini: 1 });
  assert.ok(!ehAzul(pixel(path.join(dir, 'b.webm'), 50, 25)));
  assert.throws(() => previas.cortarTrecho(mp4, path.join(dir, 'c.webm'), path.join(dir, 'c.webp'), { ini: 10 }), /curto demais/);
  assert.throws(() => previas.cortarTrecho(path.join(dir, 'nao.mp4'), path.join(dir, 'd.webm'), path.join(dir, 'd.webp'), { ini: 1 }), /nao\.mp4/);
});
t('peso do vídeo: conta no estilo só quando vai para previas/ (liberado); em previas-locais não estoura o limite', () => {
  const pedLocal = pedidoVideo('ped-peso-local');
  let r = roda(['protagonista', '--video', pedLocal, '--reusar', mp4Pastas, '--saida', path.join(TMP, 'v6', 'previas'), '--saida-local', path.join(TMP, 'v6', 'previas-locais'), '--limite-estilo', '1000']);
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  // o vídeo liberado não conta na meta de peso (decisão do responsável): só as imagens contam
  r = roda(['protagonista', '--video', pedidoVideo('ped-peso-lib', { liberado: true }), '--reusar', mp4Pastas, '--saida', path.join(TMP, 'v7', 'previas'), '--limite-estilo', '1000']);
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  const mv = JSON.parse(fs.readFileSync(path.join(TMP, 'v7', 'previas', 'protagonista', 'previas.json'), 'utf8'));
  assert.ok(mv.bytes > 1000 && mv.bytesImagens === 0, 'bytes é o total com o vídeo; bytesImagens só as imagens');
  // conferirPeso olha as imagens
  assert.deepStrictEqual(previas.conferirPeso([{ estilo: 'x', bytes: 5_000_000, bytesImagens: 400_000 }]).acima, []);
});
t('as imagens rodando de novo preservam video e videoCapa quando os arquivos existem; sem os arquivos, voltam a null', async () => {
  const saida = path.join(TMP, 'v8', 'previas');
  fs.copyFileSync(path.join(mp4Pastas, modeloDe('protagonista') + '.mp4'), path.join(mp4Pastas, modeloDe('primeira-pagina') + '.mp4'));
  const r = roda(['primeira-pagina', '--video', pedidoVideo('ped-preserva', { liberado: true }), '--reusar', mp4Pastas, '--saida', saida]);
  assert.strictEqual(r.status, 0, (r.stdout || '') + (r.stderr || ''));
  const dir = path.join(saida, 'primeira-pagina');
  const antes = fs.readFileSync(path.join(dir, 'video.webm'));
  const m = await previas.gerarImagens('primeira-pagina', { saida });
  assert.strictEqual(m.video, 'video.webm'); assert.strictEqual(m.videoCapa, 'video-capa.webp');
  assert.ok(fs.readFileSync(path.join(dir, 'video.webm')).equals(antes), 'o vídeo não pode ser tocado pelo passo das imagens');
  assert.deepStrictEqual(manifesto(saida, 'primeira-pagina'), m);
  assert.strictEqual(m.bytes, ['reels-capa.webp', 'video.webm', 'video-capa.webp'].reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0), 'o vídeo conta no peso');
  // o vídeo sumiu do disco: o manifesto não pode apontar para arquivo que não existe
  fs.rmSync(path.join(dir, 'video.webm'));
  const m2 = await previas.gerarImagens('primeira-pagina', { saida });
  assert.strictEqual(m2.video, null); assert.strictEqual(m2.videoCapa, null);
  assert.ok(existe(dir, 'video-capa.webp'), 'a capa do vídeo (arquivo do passo de vídeo) não é apagada pelas imagens');
});
t('pedido-demonstracao.exemplo.json: NÃO liberado (o rosto só entra depois de assistido), tempos coerentes com o roteiro e fotos de _demo que existem', () => {
  const arq = path.join(RAIZ, '08-FERRAMENTAS', 'tesseract', 'modelos', 'amostra', 'pedido-demonstracao.exemplo.json');
  const p = JSON.parse(fs.readFileSync(arq, 'utf8'));
  assert.strictEqual(p.liberado, false, 'o exemplo copiado não pode mandar o rosto do responsável para o repositório antes de ele assistir');
  assert.ok(p.chamada.fim - p.chamada.ini <= 3, 'a chamada tem até 3 s');
  assert.ok(p.chamada.texto.includes(p.chamada.palavra));
  assert.strictEqual(p.destaques.length, 1);
  assert.ok(p.broll.length >= 1 && Math.abs(p.broll[0].ini - 5) <= 1, 'o B-roll entra por volta de 5 s');
  assert.ok(p.broll[0].fim - p.broll[0].ini >= 4.5, 'o B-roll dura pelo menos 4,5 s');
  assert.ok(p.palavraTela.fim - p.palavraTela.ini <= 1, 'a palavra final tem até 1 s');
  assert.ok(p.trecho.fim <= 16 && p.palavraTela.fim <= p.trecho.fim);
  assert.ok(p.trecho.fim >= previas.DURACAO_TRECHO + 0.5, 'o vídeo tem o trecho de 12 s inteiro');
  for (const b of p.broll) {
    const foto = path.resolve(path.dirname(arq), b.img);
    assert.ok(foto.startsWith(path.join(ESTILOS, '_demo', 'fotos')), 'as imagens vêm de _demo/fotos');
    assert.ok(fs.existsSync(foto), `falta ${foto}`);
  }
  // o trecho de 12 s começa 4,5 s antes da troca de quadro (ou antes, se o vídeo acabar cedo) e cabe no vídeo
  const ini = previas.lerPedidoVideo(arq).ini;
  assert.strictEqual(ini, Math.max(0, Math.min(p.broll[0].ini - 4.5, p.trecho.fim - 12)));
  assert.ok(ini <= p.broll[0].ini && ini + previas.DURACAO_TRECHO <= p.trecho.fim && ini + previas.DURACAO_TRECHO > p.broll[0].fim, 'o trecho inclui o B-roll inteiro');
  const roteiro = fs.readFileSync(path.join(__dirname, 'roteiro-video-demonstracao.md'), 'utf8');
  assert.ok(roteiro.includes(p.destaques[0]) && roteiro.includes('pedido-demonstracao'));
  // o passo a passo: gera (só neste computador) -> assiste na página de revisão -> só se aprovou, troca para true e usa --reusar
  assert.match(roteiro, /Só neste computador/);
  assert.match(roteiro, /revisao\.js/);
  assert.match(roteiro, /"liberado": true/);
  assert.ok(roteiro.indexOf('Só neste computador') < roteiro.indexOf('"liberado": true'), 'primeiro assistir, depois liberar');
  assert.ok(roteiro.includes('--reusar 08-FERRAMENTAS/tesseract/modelos/amostra/saida'), 'a pasta do --reusar precisa estar escrita por inteiro');
  assert.match(roteiro, /peça ao Claude para fazer os passos de transcrição e do pedido/);
  assert.ok(!roteiro.includes('diz que **você autoriza este vídeo a entrar no repositório**. Se não quiser'), 'o texto antigo mandava deixar true na cópia');
});
t('o .gitignore cobre previas-locais/ e não cobre previas/', () => {
  const ignora = (p) => spawnSync('git', ['check-ignore', '-q', p], { cwd: RAIZ, encoding: 'utf8' }).status === 0;
  // os arquivos de trabalho que o roteiro cria (fala da pessoa e pedido com os tempos dela) também ficam fora do repositório
  const amostra = '08-FERRAMENTAS/tesseract/modelos/amostra/';
  const roteiro = fs.readFileSync(path.join(__dirname, 'roteiro-video-demonstracao.md'), 'utf8');
  for (const nome of ['palavras-demonstracao.json', 'pedido-demonstracao.json', 'transcricao.json']) {
    assert.ok(ignora(amostra + nome), nome + ' deve estar no .gitignore');
    assert.ok(roteiro.includes(amostra + nome), nome + ' deve aparecer no roteiro com o caminho completo');
  }
  assert.ok(!ignora(amostra + 'pedido-demonstracao.exemplo.json'), 'o exemplo continua no repositório');
  assert.ok(ignora('04-LABORATORIO-DE-DESIGN/biblioteca/previas-locais/protagonista/video.webm'));
  assert.ok(ignora('04-LABORATORIO-DE-DESIGN/biblioteca/previas-locais/protagonista/previas.json'));
  assert.ok(!ignora('04-LABORATORIO-DE-DESIGN/biblioteca/previas/protagonista/previas.json'));
  assert.ok(!ignora('04-LABORATORIO-DE-DESIGN/biblioteca/previas/protagonista/video.webm'));
});

// ---------- prévias na marca (--marca, --marca-arquivo) ----------
// Raiz temporária com a pasta antiga (principal), aurora (acento quente saturado), boreal (acento frio saturado), apagada
// (claro e escuro quase iguais) e cinza (sem marca). Cores montadas em código; letras OFL de tesseract/modelos/fontes/.
const pm = require('./previas-marca');
const empresaMod = require('../../_fabrica/core/empresa');
const FONTES = path.join(RAIZ, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const hx = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const ACENTO_AURORA = [200, 30, 110];
const ACENTO_BOREAL = [0, 150, 230];
const MARCAS = {
  aurora: { nome: 'Aurora Nutrição', conta: 'aurora.nutricao', cores: { escuro: hx(58, 30, 20), claro: hx(255, 243, 228), acento: hx(...ACENTO_AURORA), neutro: hx(176, 125, 98) }, letras: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'DMMono-Medium.ttf' } },
  boreal: { nome: 'Boreal Finanças', conta: 'boreal.financas', cores: { escuro: hx(14, 42, 59), claro: hx(234, 246, 248), acento: hx(...ACENTO_BOREAL), neutro: hx(94, 124, 140) }, letras: { principal: 'DMSans-Medium.ttf', mono: 'JetBrainsMono-Bold.ttf', acento: 'SpaceGrotesk-Bold.ttf' } },
  // brasa: as cores e a letra da prancha, para o caso do Concreto Ácido (o validador isenta este arquivo de "fonte": letra OFL do modelo)
  brasa: { nome: 'Brasa Teste', conta: 'brasa.teste', cores: { escuro: hx(58, 30, 36), claro: hx(255, 243, 228), acento: hx(228, 87, 46), neutro: hx(176, 125, 98) }, letras: { principal: 'Fraunces-SemiBold.ttf', mono: 'DMMono-Medium.ttf' } },
  apagada: { nome: 'Apagada Teste', conta: 'apagada.teste', cores: { escuro: hx(128, 128, 128), claro: hx(140, 140, 140), acento: hx(134, 134, 134), neutro: hx(131, 131, 131) }, letras: { principal: 'DMSans-Medium.ttf', mono: 'DMMono-Medium.ttf' } },
};
function yamlDaMarca(m, letras = m.letras) {
  return ['empresa:', `  nome: "${m.nome}"`, `  handle: "${m.conta}"`, 'cores:', ...Object.entries(m.cores).map(([p, v]) => `  ${p}: "${v}"`), 'tipografia:',
    ...['principal', 'mono', 'acento'].flatMap((p) => [`  ${p}:`, `    arquivo: "${letras[p] ? 'fontes/' + p + '.ttf' : ''}"`]), ''].join('\n');
}
function colocarMarca(r, codigo, m, dir = path.join(r, 'empresas', codigo)) {
  fs.mkdirSync(path.join(dir, 'fontes'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'marca.yaml'), yamlDaMarca(m));
  for (const [p, f] of Object.entries(m.letras)) fs.copyFileSync(path.join(FONTES, f), path.join(dir, 'fontes', p + '.ttf'));
}
let raizM = null;
function raizDasMarcas() {
  if (raizM) return raizM;
  raizM = path.join(TMP, 'raiz-marcas');
  fs.mkdirSync(raizM, { recursive: true });
  // pasta antiga: a marca dela mora em 06-MARCA-E-FOTOS (as letras também, com o caminho a partir da raiz)
  fs.mkdirSync(path.join(raizM, '06-MARCA-E-FOTOS', 'fontes'), { recursive: true });
  fs.writeFileSync(path.join(raizM, '06-MARCA-E-FOTOS', 'marca.yaml'), yamlDaMarca({ ...MARCAS.boreal, nome: 'Empresa Antiga', conta: 'empresa.antiga' }).replace(/fontes\//g, '06-MARCA-E-FOTOS/fontes/'));
  for (const [p, f] of Object.entries(MARCAS.boreal.letras)) fs.copyFileSync(path.join(FONTES, f), path.join(raizM, '06-MARCA-E-FOTOS', 'fontes', p + '.ttf'));
  for (const [c, nome] of [['aurora', 'Aurora Nutrição'], ['boreal', 'Boreal Finanças'], ['apagada', 'Apagada Teste'], ['brasa', 'Brasa Teste'], ['cinza', 'Cinza Sem Marca']]) empresaMod.criar(c, nome, raizM);
  for (const c of ['aurora', 'boreal', 'apagada', 'brasa']) colocarMarca(raizM, c, MARCAS[c]);
  return raizM;
}
// Foto de uma pasta (caminho relativo -> sha256), para conferir que nada mudou.
function fotoDaPasta(dir) {
  const mapa = {};
  if (!fs.existsSync(dir)) return mapa;
  const varrer = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const a = path.join(d, e.name); if (e.isDirectory()) varrer(a); else mapa[path.relative(dir, a)] = require('crypto').createHash('sha256').update(fs.readFileSync(a)).digest('hex'); } };
  varrer(dir);
  return mapa;
}
const envDaRaiz = (r, extra = {}) => { const e = { ...process.env, FABRICA_RAIZ: r, ...extra }; if (!('FABRICA_MARCA' in extra)) delete e.FABRICA_MARCA; if (!('FABRICA_EMPRESA' in extra)) delete e.FABRICA_EMPRESA; return e; };
const rodaNaRaiz = (r, args, extra = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: 900000, env: envDaRaiz(r, extra) });
const pastaMarca = (r, c, id) => path.join(r, 'empresas', c, 'previas', id);
const BASE_ANTES = fotoDaPasta(previas.PASTA_PADRAO);

t('na marca: a identidade de exemplo da demonstração vira a da empresa em todos os estilos (D1)', () => {
  const { molde } = { molde: require('../carrossel/molde') };
  const ident = { nome: MARCAS.aurora.nome, conta: '@' + MARCAS.aurora.conta };
  for (const id of molde.listarEstilos()) {
    const estilo = molde.lerEstilo(id);
    for (const [arq, formato] of [['demo.json', 'carrossel'], ['demo-fixados.json', 'fixados'], ['demo-reels.json', 'reels']]) {
      if (!existe(estilo.dir, arq) || (formato !== 'reels' && !estilo.car)) continue;
      const conteudo = previas.comIdentidade(demo(id, arq), ident);
      const texto = JSON.stringify(conteudo);
      assert.ok(!/Lia Exemplo|lia\.exemplo|"Lia"/.test(texto), `${id}/${arq}: sobrou a identidade de exemplo`);
      const html = molde.pagina(estilo, formato === 'reels' ? conteudo.slice(0, 1) : conteudo, { cores: 'sugestao', identidade: ident, logo: '', formato, foto: () => '' });
      assert.ok(!/Lia Exemplo|lia\.exemplo/.test(html), `${id}/${formato}: a peça ainda mostra a identidade de exemplo`);
      // empresa sem conta: nenhum "@" solto na peça
      const semConta = { nome: MARCAS.aurora.nome, conta: '' };
      const htmlSem = molde.pagina(estilo, previas.comIdentidade(formato === 'reels' ? demo(id, arq).slice(0, 1) : demo(id, arq), semConta), { cores: 'sugestao', identidade: semConta, logo: '', formato, foto: () => '' });
      const visivel = htmlSem.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ');
      assert.ok(!visivel.includes('@'), `${id}/${formato}: "@" solto sem a conta da empresa: ${(/.{0,30}@.{0,30}/.exec(visivel) || [''])[0]}`);
    }
  }
  assert.ok(JSON.stringify(previas.comIdentidade(demo('protagonista', 'demo.json'), ident)).includes(MARCAS.aurora.nome), 'a conversa do mockup leva o nome da empresa');
  // sem nada para trocar, nada muda
  assert.deepStrictEqual(previas.comIdentidade({ a: ['Lia Exemplos', 'x'], b: 2, c: null }, ident), { a: ['Lia Exemplos', 'x'], b: 2, c: null });
});
t('na marca: empresa sem marca.yaml sai 1 com a mensagem e não cria pasta nenhuma; código inválido também', () => {
  const r = raizDasMarcas();
  let x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'cinza']);
  assert.strictEqual(x.status, 1, (x.stdout || '') + (x.stderr || ''));
  assert.match(x.stderr, /A empresa Cinza Sem Marca ainda não tem marca definida; as prévias na marca precisam dela\./);
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'cinza', 'previas')), 'nada pode ser criado');
  for (const ruim of ['../aurora', 'nao-existe', '', 'AURORA']) {
    x = rodaNaRaiz(r, ['primeira-pagina', '--marca', ruim]);
    assert.strictEqual(x.status, 1, `--marca ${JSON.stringify(ruim)}: ` + (x.stdout || '') + (x.stderr || ''));
    assert.match(x.stderr, /não existe nesta pasta/);
  }
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'aurora', 'previas')));
  // combinações recusadas
  for (const args of [['--marca', 'aurora', '--saida', path.join(TMP, 'x')], ['--marca', 'aurora', '--video', 'p.json'], ['--marca', 'aurora', '--identidade', 'outra'], ['--identidade', 'empresa'], ['--marca', 'aurora', '--marca-arquivo', 'a.yaml']]) {
    x = rodaNaRaiz(r, ['primeira-pagina', ...args]);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + (x.stdout || '') + (x.stderr || ''));
  }
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'aurora', 'previas')) && !fs.existsSync(path.join(TMP, 'x')));
});
t('--marca aurora (com ambiente sujo apontando para a boreal): arquivos na pasta da aurora, assinatura, cores e avisos certos', async () => {
  const r = raizDasMarcas();
  const antiga = fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS'));
  empresaMod.ativar('boreal', r); // empresa ativa do agente: a boreal
  const x = rodaNaRaiz(r, ['protagonista', 'primeira-pagina', 'editorial', 'faixa', 'caderno', '--marca', 'aurora'], { FABRICA_MARCA: path.join(r, 'empresas', 'boreal', 'marca.yaml'), FABRICA_EMPRESA: 'boreal' });
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  assert.match(x.stdout, /^estilos: 5$/m);
  assert.match(x.stdout, /^feitos: 5\/5$/m);
  const assinatura = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  for (const id of ['protagonista', 'primeira-pagina', 'editorial']) {
    const m = manifesto(path.join(r, 'empresas', 'aurora', 'previas'), id);
    assert.strictEqual(m.cores, 'marca'); assert.strictEqual(m.empresa, 'aurora'); assert.strictEqual(m.assinatura, assinatura);
    assert.strictEqual(m.identidade, 'empresa'); assert.ok(Array.isArray(m.avisos));
    for (const f of arquivosDe(m)) assert.strictEqual(medidasWebp(path.join(pastaMarca(r, 'aurora', id), f)).l, 1080, `${id}/${f}`);
    assert.ok(pm.previasValidas(r, 'aurora', id, assinatura), `${id}: a prévia devia valer`);
  }
  // primeira-pagina: só a capa de Reels, como na base
  const pp = manifesto(path.join(r, 'empresas', 'aurora', 'previas'), 'primeira-pagina');
  assert.deepStrictEqual([pp.carrossel, pp.fixados, pp.capa], [[], null, 'reels-capa.webp']);
  assert.deepStrictEqual(fs.readdirSync(pastaMarca(r, 'aurora', 'primeira-pagina')).sort(), ['previas.json', 'reels-capa.webp']);
  // cores: a capa tem o acento da aurora e nenhum pixel do acento da boreal
  const capa = path.join(pastaMarca(r, 'aurora', 'protagonista'), 'carrossel-01.webp');
  assert.ok(await pixelsPerto(capa, ACENTO_AURORA, 40) > 1000, 'o acento da aurora não aparece na capa');
  assert.strictEqual(await pixelsPerto(capa, ACENTO_BOREAL, 60), 0, 'há pixel do acento da boreal na capa da aurora');
  // achado da prancha: no Editorial, o neutro da aurora (cor média) deixa o título da capa sobre a foto quase ilegível
  const ed = manifesto(path.join(r, 'empresas', 'aurora', 'previas'), 'editorial');
  assert.ok(ed.avisos.includes('Com as suas cores, o texto da capa de Reels fica difícil de ler.'), JSON.stringify(ed.avisos));
  assert.ok(ed.avisos.every((a) => !/webp|previas|assinatura|manifesto/.test(a)), 'aviso em português simples');
  // os dados para sugerir cores melhores (legibilidade.sugerir, etapa 8) e o aceite do Editorial
  aceiteDoEditorial(ed, MARCAS.aurora.cores);
  // correção 2: a etiqueta "Finanças sem susto" sobre a foto piorou muito com a marca (a base já era fraca): volta a avisar
  const kicker = ed.legibilidade.textos.find((x) => x.formato === 'carrossel' && x.lamina === 1 && /Finanças sem susto/i.test(x.texto));
  assert.ok(kicker && kicker.piorou && kicker.contrasteBase > kicker.contraste + 0.5, JSON.stringify(kicker));
  assert.ok(kicker.daMarca || ed.avisos.includes('Com a sua marca, este estilo deixa o texto da lâmina 1 difícil de ler; que tal outro estilo?'), JSON.stringify(ed.avisos));
  // Faixa: rótulos sobre o acento a 1,5:1 contra 3,37 na base: culpa da marca, uma cor resolve
  const faixa = manifesto(path.join(r, 'empresas', 'aurora', 'previas'), 'faixa');
  conferirLegibilidade(faixa, MARCAS.aurora.cores);
  for (const [formato, lamina, texto] of [['carrossel', 3, '2 de 3 · rótulo'], ['carrossel', 3, '3/6'], ['carrossel', 3, '“fit”'], ['carrossel', 5, 'Na prática'], ['carrossel', 5, '5/6'], ['fixados', 3, 'Consultas']]) {
    const x = faixa.legibilidade.textos.find((y) => y.formato === formato && y.lamina === lamina && y.texto === texto);
    assert.ok(x && x.tipo === 'contraste' && x.daMarca && x.contrasteBase > x.contraste + 0.5, `${texto}: ${JSON.stringify(x)}`);
  }
  // Caderno: a pincelada escura atravessa a etiqueta clara; nenhuma cor resolve: é o estilo (sem "Com as suas cores")
  const caderno = manifesto(path.join(r, 'empresas', 'aurora', 'previas'), 'caderno');
  conferirLegibilidade(caderno, MARCAS.aurora.cores);
  const pincel = caderno.legibilidade.textos.find((y) => y.formato === 'carrossel' && y.lamina === 6 && y.texto === 'Sua vez');
  assert.ok(pincel && pincel.tipo === 'estilo' && pincel.piorou && pincel.sobreImagem && !pincel.daMarca, JSON.stringify(pincel));
  assert.ok(caderno.avisos.includes('Com a sua marca, este estilo deixa o texto da lâmina 6 difícil de ler; que tal outro estilo?'));
  assert.ok(!caderno.avisos.includes('Com as suas cores, o texto da lâmina 3 fica difícil de ler.'), 'a etiqueta da lâmina 3 é do estilo, não das cores');
  conferirLegibilidade(manifesto(path.join(r, 'empresas', 'aurora', 'previas'), 'protagonista'), MARCAS.aurora.cores);
  // escrita por inteiro: nenhuma pasta de preparo nem manifesto temporário sobrando
  for (const id of ['protagonista', 'primeira-pagina', 'editorial', 'faixa', 'caderno']) {
    assert.deepStrictEqual(fs.readdirSync(pastaMarca(r, 'aurora', id)).filter((f) => f.startsWith('.') || f.endsWith('.tmp')), [], id);
  }
  // nada fora da pasta da aurora, nada da boreal, a pasta antiga e as prévias base intactas, a empresa ativa continua a boreal
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'boreal', 'previas')) && !fs.existsSync(path.join(r, 'empresas', 'principal', 'previas')));
  assert.deepStrictEqual(fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS')), antiga);
  assert.deepStrictEqual(fotoDaPasta(previas.PASTA_PADRAO), BASE_ANTES, 'as prévias base mudaram');
  assert.strictEqual(empresaMod.ativa(r), 'boreal');
});
t('--marca boreal logo depois (pela função dos outros módulos): o contrário, e nada da boreal na pasta da aurora', async () => {
  const r = raizDasMarcas();
  const daAurora = fotoDaPasta(path.join(r, 'empresas', 'aurora', 'previas'));
  const avancos = [];
  const antes = { m: process.env.FABRICA_MARCA, e: process.env.FABRICA_EMPRESA };
  const res = await previas.gerarImagensNaMarca(r, 'boreal', { ids: ['protagonista', 'editorial'], aoAvancar: (a) => avancos.push(a) });
  assert.deepStrictEqual(res, { feitos: 2, total: 2, falhas: [], refazer: [] });
  assert.deepStrictEqual(avancos.map((a) => [a.id, a.ok, a.feitos]), [['protagonista', true, 1], ['editorial', true, 2]]);
  aceiteDoEditorial(manifesto(path.join(r, 'empresas', 'boreal', 'previas'), 'editorial'), MARCAS.boreal.cores);
  assert.deepStrictEqual({ m: process.env.FABRICA_MARCA, e: process.env.FABRICA_EMPRESA }, antes, 'o ambiente de quem chama não muda');
  const capa = path.join(pastaMarca(r, 'boreal', 'protagonista'), 'carrossel-01.webp');
  assert.ok(await pixelsPerto(capa, ACENTO_BOREAL, 40) > 1000, 'o acento da boreal não aparece na capa');
  assert.strictEqual(await pixelsPerto(capa, ACENTO_AURORA, 60), 0, 'há pixel do acento da aurora na capa da boreal');
  assert.strictEqual(manifesto(path.join(r, 'empresas', 'boreal', 'previas'), 'protagonista').empresa, 'boreal');
  assert.deepStrictEqual(fotoDaPasta(path.join(r, 'empresas', 'aurora', 'previas')), daAurora, 'a geração da boreal mexeu na pasta da aurora');
  const textoAurora = Object.keys(daAurora).map((f) => f + fs.readFileSync(path.join(r, 'empresas', 'aurora', 'previas', f), 'latin1')).join('');
  assert.ok(!/boreal/i.test(textoAurora), 'algo da boreal na pasta da aurora');
  // empresa sem marca pela função: recusa com a mensagem
  await assert.rejects(previas.gerarImagensNaMarca(r, 'cinza', { ids: ['primeira-pagina'] }), /ainda não tem marca definida/);
  await assert.rejects(previas.gerarImagensNaMarca(r, 'aurora', { ids: ['--saida'] }), /estilo inválido/);
});
// Um processo filho preso não segura o trabalhador para sempre (revisão final, Importante 2). Sem Chromium: o filho é um
// programa de mentira que nunca termina e anota o próprio número de processo.
const vivo = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
async function esperarMorrer(pid, ms = 10000) {
  const fim = Date.now() + ms;
  while (vivo(pid) && Date.now() < fim) await new Promise((ok) => setTimeout(ok, 100));
  return !vivo(pid);
}
function programaPreso(nome, { estilos = 2, umPronto = false } = {}) {
  const dir = fs.mkdtempSync(path.join(TMP, 'preso-'));
  const arq = path.join(dir, nome + '.js');
  fs.writeFileSync(arq, [
    `require('fs').writeFileSync(${JSON.stringify(path.join(dir, 'pid'))}, String(process.pid));`,
    `process.stdout.write('estilos: ${estilos}\\n');`,
    umPronto ? "process.stdout.write('ok   protagonista: 4 imagens, 300 KB\\n');" : '',
    'setInterval(() => {}, 1000);',
  ].join('\n'));
  return { arq, dir, pid: () => Number(fs.readFileSync(path.join(dir, 'pid'), 'utf8')) };
}
async function esperarArquivo(arq, ms = 10000) {
  const fim = Date.now() + ms;
  while (!fs.existsSync(arq) && Date.now() < fim) await new Promise((ok) => setTimeout(ok, 50));
}
t('rodarComLimite (o ffmpeg e o ffprobe): programa que não termina vira "tempo esgotado" dentro do limite', () => {
  const t0 = Date.now();
  assert.throws(() => previas.rodarComLimite(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], 500, 'programa de mentira'),
    (e) => e.code === 'ETIMEDOUT' && /tempo esgotado/.test(e.message) && /programa de mentira/.test(e.message));
  assert.ok(Date.now() - t0 < 15000, 'demorou demais: ' + (Date.now() - t0));
  const ok = previas.rodarComLimite(process.execPath, ['-e', 'process.stdout.write("oi")'], 30000, 'node');
  assert.strictEqual(ok.stdout, 'oi');
  assert.ok(previas.LIMITE_FFMPEG_MS >= 60000 && previas.LIMITE_FFPROBE_MS >= 30000 && previas.LIMITE_SEM_AVANCO_MS >= 3 * 60000, 'limites folgados para a máquina lenta');
});
t('na marca, pela função: um filho que nunca termina vira "tempo esgotado" dentro do limite e é encerrado', async () => {
  const preso = programaPreso('nunca-termina', { umPronto: true });
  const avancos = [];
  const t0 = Date.now();
  await assert.rejects(previas.gerarImagensNaMarca(preso.dir, 'aurora', { ids: ['protagonista', 'editorial'], programa: preso.arq, limiteSemAvancoMs: 800, aoAvancar: (a) => avancos.push(a.id) }),
    (e) => e.code === 'ETIMEDOUT' && /tempo esgotado/.test(e.message));
  assert.ok(Date.now() - t0 < 20000, 'demorou demais: ' + (Date.now() - t0));
  assert.deepStrictEqual(avancos, ['protagonista'], 'o estilo que terminou antes foi avisado');
  assert.ok(await esperarMorrer(preso.pid()), 'o filho preso foi encerrado');
});
t('na marca, pela função: o sinal de parar (Pausar ou Cancelar) encerra o filho em andamento e rejeita', async () => {
  const preso = programaPreso('parado-pelo-sinal');
  const parar = new AbortController();
  const promessa = previas.gerarImagensNaMarca(preso.dir, 'aurora', { ids: ['protagonista'], programa: preso.arq, sinal: parar.signal });
  await esperarArquivo(path.join(preso.dir, 'pid'));
  parar.abort();
  await assert.rejects(promessa, (e) => e.code === 'ABORTADO');
  assert.ok(await esperarMorrer(preso.pid()), 'o filho foi encerrado');
  // sinal já dado: nem começa
  const ja = new AbortController();
  ja.abort();
  await assert.rejects(previas.gerarImagensNaMarca(preso.dir, 'aurora', { ids: ['protagonista'], programa: preso.arq, sinal: ja.signal }), (e) => e.code === 'ABORTADO');
});
t('a marca muda no meio da rodada: o estilo seguinte não é gravado e fica para refazer', async () => {
  const r = raizDasMarcas();
  const antes = fotoDaPasta(pastaMarca(r, 'aurora', 'protagonista'));
  const avancos = [];
  const res = await previas.gerarImagensNaMarca(r, 'aurora', { ids: ['primeira-pagina', 'protagonista'], aoAvancar: (a) => {
    avancos.push([a.id, a.ok, !!a.refazer]);
    // assim que o primeiro estilo fica pronto, a pessoa grava outra cor (o segundo estilo já está sendo montado)
    if (a.id === 'primeira-pagina') colocarMarca(r, 'aurora', { ...MARCAS.aurora, cores: { ...MARCAS.aurora.cores, escuro: hx(60, 30, 20) } });
  } });
  assert.deepStrictEqual(res, { feitos: 1, total: 2, falhas: [], refazer: ['protagonista'] });
  assert.deepStrictEqual(avancos, [['primeira-pagina', true, false], ['protagonista', false, true]]);
  assert.deepStrictEqual(fotoDaPasta(pastaMarca(r, 'aurora', 'protagonista')), antes, 'o estilo da marca velha não pode ser gravado por cima');
  colocarMarca(r, 'aurora', MARCAS.aurora); // volta à marca de antes
  assert.ok(pm.previasValidas(r, 'aurora', 'protagonista', pm.assinaturaDaMarca(r, 'aurora').assinatura));
});
t('Concreto Ácido nas cores da prancha: o texto claro de "arraste para o lado" passa sobre o prato claro; é o estilo, não as cores', () => {
  const r = raizDasMarcas();
  const x = rodaNaRaiz(r, ['concreto-acido', '--marca', 'brasa']);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const m = manifesto(path.join(r, 'empresas', 'brasa', 'previas'), 'concreto-acido');
  conferirLegibilidade(m, MARCAS.brasa.cores);
  const prato = m.legibilidade.textos.find((y) => y.formato === 'carrossel' && y.lamina === 1 && /arraste para o lado/.test(y.texto));
  assert.ok(prato && prato.tipo === 'estilo' && prato.piorou && prato.sobreImagem && prato.semOpcao && !prato.daMarca, JSON.stringify(prato));
  assert.ok(m.avisos.includes('Com a sua marca, este estilo deixa o texto da lâmina 1 difícil de ler; que tal outro estilo?'), JSON.stringify(m.avisos));
  assert.ok(!m.avisos.includes('Com as suas cores, o texto da lâmina 1 fica difícil de ler.'), 'nenhuma cor resolve: não culpar as cores');
});
t('marca com claro e escuro quase iguais: a prévia sai e os avisos não ficam vazios', () => {
  const r = raizDasMarcas();
  const x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'apagada']);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const m = manifesto(path.join(r, 'empresas', 'apagada', 'previas'), 'primeira-pagina');
  assert.ok(existe(pastaMarca(r, 'apagada', 'primeira-pagina'), 'reels-capa.webp'));
  assert.ok(m.avisos.length > 0 && m.avisos.every((a) => /difícil de ler|passa da borda/.test(a)), JSON.stringify(m.avisos));
  assert.match(x.stdout, /aviso/);
  conferirLegibilidade(m, MARCAS.apagada.cores, { algumLegivel: false }); // claro e escuro quase iguais: nada se lê
  assert.ok(m.legibilidade.textos.length > 0 && m.legibilidade.textos.every((t) => t.formato === 'reels'));
  assert.ok(m.legibilidade.textos.some((t) => ['escuro', 'claro', 'acento', 'neutro'].includes(t.papel)), 'a cor do texto é uma das da marca');
});
t('letra da marca que falta: a prévia sai com a letra padrão e um aviso', () => {
  const r = raizDasMarcas();
  fs.rmSync(path.join(r, 'empresas', 'apagada', 'fontes', 'mono.ttf'));
  const x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'apagada']);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const m = manifesto(path.join(r, 'empresas', 'apagada', 'previas'), 'primeira-pagina');
  assert.ok(m.avisos.includes('A letra dos rótulos da sua marca não foi encontrada; a prévia usa a letra padrão.'), JSON.stringify(m.avisos));
  assert.strictEqual(m.assinatura, pm.assinaturaDaMarca(r, 'apagada').assinatura);
});
t('pasta antiga: --marca principal grava em empresas/principal/previas/ e a 06-MARCA-E-FOTOS fica idêntica', () => {
  const r = raizDasMarcas();
  const antiga = fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS'));
  const x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'principal']);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const m = manifesto(path.join(r, 'empresas', 'principal', 'previas'), 'primeira-pagina');
  assert.strictEqual(m.empresa, 'principal');
  assert.strictEqual(m.assinatura, pm.assinaturaDaMarca(r, 'principal').assinatura);
  assert.deepStrictEqual(fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS')), antiga);
});
t('rodar de novo: o vídeo da marca de hoje continua; com a marca mudada, a assinatura troca e o vídeo antigo sai do manifesto', () => {
  const r = raizDasMarcas();
  const dir = pastaMarca(r, 'aurora', 'primeira-pagina');
  const arq = path.join(dir, 'previas.json');
  const ass1 = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  fs.writeFileSync(path.join(dir, 'video.webm'), 'x'); fs.writeFileSync(path.join(dir, 'video-capa.webp'), 'x');
  // os avisos do vídeo (video-marca.js) continuam junto com ele quando as imagens são refeitas
  const AVISO_VIDEO = 'No vídeo, com as suas letras, um texto não coube inteiro na tela.';
  fs.writeFileSync(arq, JSON.stringify({ ...JSON.parse(fs.readFileSync(arq, 'utf8')), video: 'video.webm', videoCapa: 'video-capa.webp', videoAssinatura: ass1,
    videoModelo: 'primeira-pagina', videoAvisos: [AVISO_VIDEO], videoDetalhes: ['[marca] o texto "x" não cabe'] }));
  // sobra de uma rodada que caiu no meio: a pasta de preparo antiga é limpa na rodada seguinte
  fs.mkdirSync(path.join(dir, '.novo-velho')); fs.writeFileSync(path.join(dir, '.novo-velho', 'reels-capa.webp'), 'x');
  let x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'aurora']);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  assert.ok(!existe(dir, '.novo-velho'), 'a pasta de preparo de uma rodada que caiu devia ser limpa');
  let m = JSON.parse(fs.readFileSync(arq, 'utf8'));
  assert.deepStrictEqual([m.video, m.videoCapa, m.videoAssinatura, m.assinatura], ['video.webm', 'video-capa.webp', ass1, ass1]);
  assert.deepStrictEqual([m.videoModelo, m.videoAvisos, m.videoDetalhes], ['primeira-pagina', [AVISO_VIDEO], ['[marca] o texto "x" não cabe']]);
  assert.ok(m.avisos.includes(AVISO_VIDEO), 'o aviso do vídeo devia continuar entre os avisos do estilo');
  // a marca muda (outra cor de fundo claro)
  colocarMarca(r, 'aurora', { ...MARCAS.aurora, cores: { ...MARCAS.aurora.cores, claro: hx(255, 236, 214) } });
  const ass2 = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  assert.notStrictEqual(ass2, ass1);
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'protagonista', ass2), null, 'a prévia da marca antiga deixou de valer');
  x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'aurora']);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  m = JSON.parse(fs.readFileSync(arq, 'utf8'));
  assert.strictEqual(m.assinatura, ass2);
  assert.strictEqual(m.video, null); assert.strictEqual(m.videoCapa, null); assert.ok(!('videoAssinatura' in m));
  assert.ok(!('videoAvisos' in m) && !m.avisos.includes(AVISO_VIDEO), 'o aviso do vídeo da marca antiga sai junto com ele');
  assert.ok(existe(dir, 'video.webm'), 'o arquivo do vídeo não é apagado (só sai do manifesto)');
  assert.strictEqual(pm.previasValidas(r, 'aurora', 'primeira-pagina', ass2).video, null);
});
t('--marca-arquivo: sem --saida ou com --saida dentro das prévias base é recusado; com --saida, grava sem assinatura de empresa', () => {
  const r = raizDasMarcas();
  const yaml = path.join(r, 'empresas', 'boreal', 'marca.yaml');
  for (const args of [['--marca-arquivo', yaml], ['--marca-arquivo', yaml, '--saida', previas.PASTA_PADRAO], ['--marca-arquivo', yaml, '--saida', path.join(previas.PASTA_PADRAO, 'primeira-pagina')], ['--marca-arquivo', path.join(TMP, 'nao-existe.yaml'), '--saida', path.join(TMP, 'ma')]]) {
    const x = rodaNaRaiz(r, ['primeira-pagina', ...args]);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + (x.stdout || '') + (x.stderr || ''));
  }
  assert.ok(!fs.existsSync(path.join(TMP, 'ma')));
  const saida = path.join(TMP, 'marca-nova');
  const x = rodaNaRaiz(r, ['primeira-pagina', '--marca-arquivo', yaml, '--saida', saida], { FABRICA_EMPRESA: 'aurora' });
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const m = manifesto(saida, 'primeira-pagina');
  assert.strictEqual(m.cores, 'marca');
  assert.ok(!('empresa' in m) && !('assinatura' in m), 'marca ainda não gravada não tem assinatura de empresa');
  assert.deepStrictEqual(fotoDaPasta(previas.PASTA_PADRAO), BASE_ANTES, 'as prévias base mudaram');
});
t('--marca-arquivo --empresa: as letras vêm da pasta da empresa; --saida na pasta de outra empresa é recusada', () => {
  const r = raizDasMarcas();
  const candidata = path.join(TMP, 'candidata.yaml'); // marca nova, fora da pasta da empresa, com as letras citadas como na boreal
  fs.copyFileSync(path.join(r, 'empresas', 'boreal', 'marca.yaml'), candidata);
  for (const args of [['--empresa', 'aurora', '--saida', path.join(r, 'empresas', 'boreal', 'candidata')], ['--saida', path.join(r, 'empresas', 'aurora', 'candidata')],
    ['--empresa', 'nao-existe', '--saida', path.join(TMP, 'c0')], ['--empresa', '../boreal', '--saida', path.join(TMP, 'c0')],
    // correção 2: nem nas prévias da própria empresa (lá só entra a marca gravada, com a assinatura dela)
    ['--empresa', 'boreal', '--saida', path.join(r, 'empresas', 'boreal', 'previas')], ['--empresa', 'boreal', '--saida', path.join(r, 'empresas', 'boreal', 'previas', 'x')]]) {
    const x = rodaNaRaiz(r, ['primeira-pagina', '--marca-arquivo', candidata, ...args]);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + (x.stdout || '') + (x.stderr || ''));
  }
  let x = rodaNaRaiz(r, ['primeira-pagina', '--marca', 'boreal', '--empresa', 'boreal']);
  assert.strictEqual(x.status, 1, '--empresa só vale com --marca-arquivo');
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'boreal', 'candidata')) && !fs.existsSync(path.join(r, 'empresas', 'aurora', 'candidata')) && !fs.existsSync(path.join(TMP, 'c0')));
  x = rodaNaRaiz(r, ['primeira-pagina', '--marca-arquivo', candidata, '--empresa', 'boreal', '--saida', path.join(TMP, 'c1')]);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  assert.ok(!manifesto(path.join(TMP, 'c1'), 'primeira-pagina').avisos.some((a) => /não foi encontrada/.test(a)), 'as letras da boreal deviam ser achadas');
  x = rodaNaRaiz(r, ['primeira-pagina', '--marca-arquivo', candidata, '--saida', path.join(TMP, 'c2')]);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  assert.ok(manifesto(path.join(TMP, 'c2'), 'primeira-pagina').avisos.includes('A letra principal da sua marca não foi encontrada; a prévia usa a letra padrão.'), 'sem --empresa, a letra relativa à pasta da empresa não existe');
  // correção 2: sem --empresa, letra por caminho absoluto ou da pasta antiga (06-MARCA-E-FOTOS) não é lida
  const absoluta = path.join(TMP, 'candidata-abs.yaml');
  fs.writeFileSync(absoluta, fs.readFileSync(candidata, 'utf8').replace(/arquivo: "fontes\/principal\.ttf"/, `arquivo: "${path.join(FONTES, 'DMSans-Medium.ttf').split(path.sep).join('/')}"`)
    .replace(/arquivo: "fontes\/mono\.ttf"/, 'arquivo: "06-MARCA-E-FOTOS/fontes/mono.ttf"'));
  x = rodaNaRaiz(r, ['primeira-pagina', '--marca-arquivo', absoluta, '--saida', path.join(TMP, 'c3')]);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const av = manifesto(path.join(TMP, 'c3'), 'primeira-pagina').avisos;
  assert.ok(av.includes('A letra principal da sua marca não foi encontrada; a prévia usa a letra padrão.') && av.includes('A letra dos rótulos da sua marca não foi encontrada; a prévia usa a letra padrão.'), JSON.stringify(av));
});
t('o .gitignore deixa as prévias da empresa e o registro da fila fora do repositório', () => {
  const ignora = (p) => spawnSync('git', ['check-ignore', '-q', p], { cwd: RAIZ, encoding: 'utf8' }).status === 0;
  assert.ok(ignora('empresas/aurora/previas/protagonista/carrossel-01.webp'));
  assert.ok(ignora('empresas/principal/previas/protagonista/previas.json'));
  assert.ok(ignora('empresas/aurora/previas/fila.json'));
  assert.ok(ignora('empresas/.fila-previas.json'));
  assert.ok(ignora('04-LABORATORIO-DE-DESIGN/biblioteca/previas/protagonista/.novo-abc123/carrossel-01.webp'), 'a pasta de preparo das prévias base');
  assert.ok(!ignora('empresas/aurora/marca.yaml'), 'a marca da empresa não é ignorada por esta regra');
  assert.ok(!ignora('empresas/indice.json'));
});

// ---------- estilos próprios da empresa (--estilos) ----------
// Raiz temporária com a pasta antiga (principal), aurora, boreal e cinza. Cada estilo próprio é a cópia de um estilo do
// catálogo com o código trocado, origem "referencias" e o CSS preso ao código novo. A Primeira Página (só capa de Reels) deixa
// a geração curta.
let raizP = null;
function copiarComoProprio(base, id, pasta, mudar = null) {
  const para = path.join(pasta, id);
  fs.cpSync(path.join(ESTILOS, base), para, { recursive: true });
  const y = path.join(para, 'estilo.yaml');
  fs.writeFileSync(y, fs.readFileSync(y, 'utf8').replace(/^id:.*$/m, `id: ${id}`).replace(/^origem:.*$/m, 'origem: referencias'));
  const css = path.join(para, 'estilo.css');
  if (fs.existsSync(css)) fs.writeFileSync(css, fs.readFileSync(css, 'utf8').split(`.est-${base}`).join(`.est-${id}`));
  if (mudar) mudar(para);
  return para;
}
function raizDosProprios() {
  if (raizP) return raizP;
  raizP = path.join(TMP, 'raiz-proprios');
  fs.mkdirSync(path.join(raizP, '06-MARCA-E-FOTOS'), { recursive: true });
  fs.writeFileSync(path.join(raizP, '06-MARCA-E-FOTOS', 'marca.yaml'), yamlDaMarca({ ...MARCAS.boreal, nome: 'Empresa Antiga', conta: 'empresa.antiga', letras: {} }));
  for (const [c, nome] of [['aurora', 'Aurora Nutrição'], ['boreal', 'Boreal Finanças'], ['cinza', 'Cinza Sem Marca']]) empresaMod.criar(c, nome, raizP);
  copiarComoProprio('primeira-pagina', 'aurora-jornal', empresaMod.caminhos('aurora', raizP).estilosProprios);
  copiarComoProprio('primeira-pagina', 'boreal-neve', empresaMod.caminhos('boreal', raizP).estilosProprios);
  copiarComoProprio('primeira-pagina', 'antigo-forno', empresaMod.caminhos('principal', raizP).estilosProprios);
  fs.mkdirSync(path.join(raizP, 'empresas', 'boreal', 'referencias'), { recursive: true });
  return raizP;
}
const proprias = (r, c) => path.join(empresaMod.caminhos(c, r).previas, 'proprios');
const estilosDe = (r, c) => empresaMod.caminhos(c, r).estilosProprios;

t('estilo próprio: --estilos da aurora grava as prévias base em previas/proprios da aurora; nada nas prévias base nem na boreal', () => {
  const r = raizDosProprios();
  const boreal = fotoDaPasta(path.join(r, 'empresas', 'boreal'));
  const antiga = fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS'));
  const x = rodaNaRaiz(r, ['aurora-jornal', '--estilos', estilosDe(r, 'aurora'), '--saida', proprias(r, 'aurora')], { FABRICA_EMPRESA: 'boreal' });
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  const m = manifesto(proprias(r, 'aurora'), 'aurora-jornal');
  assert.deepStrictEqual([m.estilo, m.cores, m.capa, m.reelsCapa, m.proprio], ['aurora-jornal', 'sugestao', 'reels-capa.webp', 'reels-capa.webp', true]);
  assert.ok(!('empresa' in m) && !('assinatura' in m), 'prévia base: sem marca de empresa');
  assert.deepStrictEqual(medidasWebp(path.join(proprias(r, 'aurora'), 'aurora-jornal', 'reels-capa.webp')), { l: 1080, a: 1920 });
  assert.deepStrictEqual(fotoDaPasta(previas.PASTA_PADRAO), BASE_ANTES, 'as prévias base mudaram');
  assert.deepStrictEqual(fotoDaPasta(path.join(r, 'empresas', 'boreal')), boreal, 'a pasta da boreal mudou');
  assert.deepStrictEqual(fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS')), antiga);
  assert.deepStrictEqual(fs.readdirSync(proprias(r, 'aurora')), ['aurora-jornal']);
});
t('estilo próprio: pasta antiga (principal) lê de 06-MARCA-E-FOTOS/estilos-proprios e grava em empresas/principal/previas/proprios', () => {
  const r = raizDosProprios();
  const antiga = fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS'));
  const x = rodaNaRaiz(r, ['--estilos', estilosDe(r, 'principal'), '--saida', proprias(r, 'principal')]);
  assert.strictEqual(x.status, 0, (x.stdout || '') + (x.stderr || ''));
  assert.match(x.stdout, /ok +antigo-forno:/);
  assert.strictEqual(manifesto(path.join(r, 'empresas', 'principal', 'previas', 'proprios'), 'antigo-forno').estilo, 'antigo-forno');
  assert.deepStrictEqual(fotoDaPasta(path.join(r, '06-MARCA-E-FOTOS')), antiga, 'a pasta antiga mudou');
});
t('estilo próprio: --saida fora do lugar, mistura de empresas e combinações recusadas, sem gravar nada', () => {
  const r = raizDosProprios();
  const antes = fotoDaPasta(r);
  const eA = estilosDe(r, 'aurora');
  const casos = [
    [['aurora-jornal', '--estilos', eA], /pede --saida/],
    [['aurora-jornal', '--estilos', eA, '--saida', previas.PASTA_PADRAO], /prévias base/],
    [['aurora-jornal', '--estilos', eA, '--saida', path.join(previas.PASTA_PADRAO, 'x')], /prévias base/],
    [['aurora-jornal', '--estilos', eA, '--saida', previas.PASTA_LOCAL_PADRAO], /prévias base/],
    [['aurora-jornal', '--estilos', eA, '--saida', proprias(r, 'boreal')], /previas\/proprios/],
    [['aurora-jornal', '--estilos', eA, '--saida', empresaMod.caminhos('aurora', r).previas], /previas\/proprios/],
    [['aurora-jornal', '--estilos', eA, '--saida', path.join(proprias(r, 'aurora'), 'x')], /previas\/proprios/],
    [['aurora-jornal', '--estilos', eA, '--saida', path.join(TMP, 'solta-1')], /previas\/proprios/],
    [['boreal-neve', '--estilos', path.join(r, 'empresas', 'boreal', 'referencias'), '--saida', path.join(TMP, 'solta-2')], /estilos próprios de uma empresa/],
    [['boreal-neve', '--estilos', path.join(r, 'empresas', 'boreal'), '--saida', path.join(TMP, 'solta-2')], /estilos próprios de uma empresa/],
    [['aurora-jornal', '--estilos', path.join(TMP, 'qualquer'), '--saida', proprias(r, 'aurora')], /pasta de uma empresa/],
    [['aurora-jornal', '--estilos', eA, '--saida', proprias(r, 'aurora'), '--marca', 'aurora'], /--estilos/],
    [['aurora-jornal', '--estilos', eA, '--saida', proprias(r, 'aurora'), '--marca-arquivo', path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml')], /--estilos/],
    [['aurora-jornal', '--estilos', eA, '--saida', proprias(r, 'aurora'), '--video', 'p.json'], /--estilos/],
    [['../aurora-jornal', '--estilos', eA, '--saida', proprias(r, 'aurora')], /código do estilo próprio|estilo desconhecido/],
    [['nao-existe', '--estilos', eA, '--saida', proprias(r, 'aurora')], /estilo desconhecido/],
    [['boreal-neve', '--estilos', eA, '--saida', proprias(r, 'aurora')], /estilo desconhecido/],
  ];
  fs.mkdirSync(path.join(TMP, 'qualquer'), { recursive: true });
  copiarComoProprio('primeira-pagina', 'aurora-jornal', path.join(TMP, 'qualquer'));
  for (const [args, motivo] of casos) {
    const x = rodaNaRaiz(r, args);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + (x.stdout || '') + (x.stderr || ''));
    assert.match(x.stderr + x.stdout, motivo, args.join(' '));
  }
  assert.deepStrictEqual(fotoDaPasta(r), antes, 'algo foi gravado');
  assert.deepStrictEqual(fotoDaPasta(previas.PASTA_PADRAO), BASE_ANTES);
  assert.ok(!fs.existsSync(path.join(TMP, 'solta-1')) && !fs.existsSync(path.join(TMP, 'solta-2')));
});
t('estilo próprio: pela função (sem o comando), as prévias base do catálogo também são recusadas', async () => {
  const pasta = path.join(TMP, 'pela-funcao');
  copiarComoProprio('primeira-pagina', 'aurora-jornal', pasta);
  // pastas novas, só deste teste, dentro das prévias base e das locais: nunca a pasta de um estilo de verdade
  const novas = [path.join(previas.PASTA_PADRAO, `_teste-proprio-${process.pid}`), path.join(previas.PASTA_LOCAL_PADRAO, `_teste-proprio-${process.pid}`)];
  const existiam = novas.map((p) => fs.existsSync(p));
  try {
    for (const saida of novas) await assert.rejects(previas.gerarImagens('aurora-jornal', { saida, estilos: pasta }), /prévias base/);
    for (const saida of novas) assert.ok(!fs.existsSync(saida), `${saida} foi criada`);
  } finally {
    novas.forEach((p, i) => { if (!existiam[i]) fs.rmSync(p, { recursive: true, force: true }); }); // só o que o teste criou
  }
  assert.deepStrictEqual(fotoDaPasta(previas.PASTA_PADRAO), BASE_ANTES);
});
t('estilo próprio: com --estilos fora das empresas, a --saida também fica fora da raiz da Fábrica', () => {
  const r = raizDosProprios();
  const solta = path.join(TMP, 'estilos-soltos');
  if (!fs.existsSync(path.join(solta, 'aurora-jornal'))) copiarComoProprio('primeira-pagina', 'aurora-jornal', solta);
  const antes = fotoDaPasta(r);
  for (const saida of [path.join(r, 'qualquer-pasta'), path.join(r, '04-LABORATORIO-DE-DESIGN', 'outra'), path.join(RAIZ, '_teste-saida-' + process.pid)]) {
    const x = rodaNaRaiz(r, ['aurora-jornal', '--estilos', solta, '--saida', saida]);
    assert.strictEqual(x.status, 1, saida + ': ' + (x.stdout || '') + (x.stderr || ''));
    assert.match(x.stderr, /fora da raiz da Fábrica/);
    assert.ok(!fs.existsSync(saida), `${saida} foi criada`);
  }
  assert.deepStrictEqual(fotoDaPasta(r), antes);
});
t('estilo próprio: o navegador das prévias abre com a rede fechada; nenhuma forma da sonda chega a pedir nada (nem ao 127.0.0.1)', async () => {
  // as formas que passavam pela conferência do texto (sonda filtro.js e nav.js), direto no HTML, sem conferência nenhuma
  const http = require('http');
  const pedidos = [];
  const srv = http.createServer((q, s) => { pedidos.push(q.url); s.end('x'); }).listen(0, '127.0.0.1');
  await new Promise((ok) => srv.on('listening', ok));
  const B = String.fromCharCode(92);
  const H = (n) => `ht${'tp:'}//127.0.0.1:${srv.address().port}/${n}`;
  const { pathToFileURL } = require('url');
  const arquivo = pathToFileURL(path.join(ESTILOS, '_demo', 'fotos', 'retrato-sentada.jpg')).href;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@i${B}mport "${H('importa')}";
.esc{width:9px;height:9px;background:${B}u${B}r${B}l(${H('escape')})}
.css{width:9px;height:9px;background:url(${H('css')})}
.lamina{width:100px;height:100px}
</style></head><body><div class="lamina">
<img src="${H('img')}"><div class="css"></div><div class="esc"></div>
<div style="width:9px;height:9px;background:url&lpar;${H('lpar')})"></div>
<table background="${H('tabela')}"><tr><td>x</td></tr></table>
<img/src="${H('barra')}"><img src="${H('chave')}">
<svg width="9" height="9"><image width="9" height="9"><set attributeName="href" to="${H('smil')}" begin="0s"/></image></svg>
<div style="background:url(${H('fundo')})">x</div><img id="arq" src="${arquivo}">
<link rel="stylesheet" href="${H('link')}"><script src="${H('script')}"></script><iframe src="${H('quadro')}"></iframe>
</div></body></html>`;
  const render = require('../carrossel/render');
  try {
    // calibração: sem a opção, o navegador pede ao servidor
    let pg = await render.abrirPagina(html, { largura: 200, altura: 200 });
    await pg.pagina.waitForTimeout(500); await pg.fechar();
    assert.ok(pedidos.length >= 5, 'a calibração devia pedir ao servidor: ' + JSON.stringify(pedidos));
    pedidos.length = 0;
    pg = await render.abrirPagina(html, { largura: 200, altura: 200 }, { bloquearRede: true });
    await pg.pagina.waitForTimeout(800);
    const largura = await pg.pagina.evaluate(() => document.getElementById('arq').naturalWidth);
    await pg.fechar();
    assert.deepStrictEqual(pedidos, [], 'com a rede fechada, nada pode chegar ao servidor');
    assert.strictEqual(largura, 0, 'arquivo do disco também não carrega');
    // e o gerar-previas liga a opção em todo estilo próprio (e só nele)
    assert.deepStrictEqual(previas.opcoesDoRender({ proprio: true }), { bloquearRede: true });
    assert.deepStrictEqual(previas.opcoesDoRender({ id: 'bloco' }), {});
  } finally { srv.close(); }
});
t('estilo próprio: a demonstração inteira é conferida (endereço no meio do texto, < >, barra invertida, fundo e svg)', () => {
  const r = raizDosProprios();
  const H = 'ht' + 'tp:' + '//127.0.0.1:8890/x.png';
  const mudancas = [
    ['aurora-texto-1', (d) => { d[0].titulo = `Veja ${H} agora`; }],
    ['aurora-texto-2', (d) => { d[0].fundo = `escuro" style="background:url(${H})`; }],
    ['aurora-texto-3', (d) => { d[0].kicker = '<img src=x>'; }],
    ['aurora-texto-4', (d) => { d[0].titulo = 'a' + String.fromCharCode(92) + 'b'; }],
    ['aurora-texto-5', (d) => { d[0].visual = { tipo: 'selo', svg: '<svg></svg>' }; }],
  ];
  for (const [id, mudar] of mudancas) {
    copiarComoProprio('primeira-pagina', id, estilosDe(r, 'aurora'), (dir) => {
      const arq = path.join(dir, 'demo-reels.json');
      const d = JSON.parse(fs.readFileSync(arq, 'utf8'));
      mudar(d);
      fs.writeFileSync(arq, JSON.stringify(d));
    });
    const x = rodaNaRaiz(r, [id, '--estilos', estilosDe(r, 'aurora'), '--saida', proprias(r, 'aurora')]);
    assert.strictEqual(x.status, 1, `${id}: ` + (x.stdout || '') + (x.stderr || ''));
    assert.match(x.stderr + x.stdout, /demonstração/, id);
    assert.ok(!fs.existsSync(path.join(proprias(r, 'aurora'), id)), `${id}: algo foi gravado`);
    fs.rmSync(path.join(estilosDe(r, 'aurora'), id), { recursive: true, force: true });
  }
});
t('estilo próprio: atalho para a outra empresa (no estilo, na pasta de estilos ou na saída) é recusado e a boreal fica igual', () => {
  const r = raizDosProprios();
  const boreal = fotoDaPasta(path.join(r, 'empresas', 'boreal'));
  const juncao = (alvo, onde) => { fs.mkdirSync(path.dirname(onde), { recursive: true }); fs.symlinkSync(alvo, onde, 'junction'); };
  // 1) o estilo da aurora é um atalho para o estilo da boreal
  juncao(path.join(estilosDe(r, 'boreal'), 'boreal-neve'), path.join(estilosDe(r, 'aurora'), 'boreal-neve'));
  let x = rodaNaRaiz(r, ['boreal-neve', '--estilos', estilosDe(r, 'aurora'), '--saida', proprias(r, 'aurora')]);
  assert.strictEqual(x.status, 1, (x.stdout || '') + (x.stderr || ''));
  assert.ok(!fs.existsSync(path.join(proprias(r, 'aurora'), 'boreal-neve')));
  fs.rmSync(path.join(estilosDe(r, 'aurora'), 'boreal-neve'), { recursive: true, force: true });
  // 2) a pasta de estilos próprios da cinza é um atalho para a da boreal
  juncao(estilosDe(r, 'boreal'), estilosDe(r, 'cinza'));
  x = rodaNaRaiz(r, ['boreal-neve', '--estilos', estilosDe(r, 'cinza'), '--saida', proprias(r, 'cinza')]);
  assert.strictEqual(x.status, 1, (x.stdout || '') + (x.stderr || ''));
  assert.match(x.stderr, /estilos próprios de uma empresa/);
  assert.ok(!fs.existsSync(proprias(r, 'cinza')));
  // 3) a pasta das prévias do estilo na saída é um atalho para a pasta das prévias da boreal
  fs.mkdirSync(path.join(proprias(r, 'boreal'), 'alvo'), { recursive: true });
  const borealComAlvo = fotoDaPasta(path.join(r, 'empresas', 'boreal'));
  juncao(path.join(proprias(r, 'boreal'), 'alvo'), path.join(proprias(r, 'aurora'), 'aurora-jornal-2'));
  copiarComoProprio('primeira-pagina', 'aurora-jornal-2', estilosDe(r, 'aurora'));
  x = rodaNaRaiz(r, ['aurora-jornal-2', '--estilos', estilosDe(r, 'aurora'), '--saida', proprias(r, 'aurora')]);
  assert.strictEqual(x.status, 1, (x.stdout || '') + (x.stderr || ''));
  assert.match(x.stderr + x.stdout, /atalho/);
  assert.deepStrictEqual(fotoDaPasta(path.join(r, 'empresas', 'boreal')), borealComAlvo, 'algo foi gravado na boreal');
  fs.rmSync(path.join(proprias(r, 'aurora'), 'aurora-jornal-2'), { recursive: true, force: true });
  fs.rmSync(path.join(estilosDe(r, 'aurora'), 'aurora-jornal-2'), { recursive: true, force: true });
  fs.rmSync(estilosDe(r, 'cinza'), { recursive: true, force: true });
  fs.rmSync(path.join(proprias(r, 'boreal'), 'alvo'), { recursive: true, force: true });
  assert.deepStrictEqual(fotoDaPasta(path.join(r, 'empresas', 'boreal')), boreal);
});
t('estilo próprio: a demonstração só usa as fotos fictícias do catálogo (nunca foto da empresa, caminho absoluto ou endereço)', () => {
  const r = raizDosProprios();
  const foto = path.join(r, 'empresas', 'boreal', 'foto.jpg');
  fs.copyFileSync(path.join(ESTILOS, '_demo', 'fotos', 'retrato-sentada.jpg'), foto);
  const endereco = 'ht' + 'tps:' + '//exemplo.invalid/foto.jpg'; // montado em partes: não é endereço de verdade
  const trocas = [['aurora-foto-1', foto], ['aurora-foto-2', 'empresas/boreal/foto.jpg'], ['aurora-foto-3', endereco], ['aurora-foto-4', 'file:///' + foto.split(path.sep).join('/')]];
  for (const [id, caminho] of trocas) {
    copiarComoProprio('primeira-pagina', id, estilosDe(r, 'aurora'), (dir) => {
      const arq = path.join(dir, 'demo-reels.json');
      const d = JSON.parse(fs.readFileSync(arq, 'utf8'));
      d[0].foto = caminho;
      fs.writeFileSync(arq, JSON.stringify(d));
    });
    const x = rodaNaRaiz(r, [id, '--estilos', estilosDe(r, 'aurora'), '--saida', proprias(r, 'aurora')]);
    assert.strictEqual(x.status, 1, `${id}: ` + (x.stdout || '') + (x.stderr || ''));
    assert.match(x.stderr + x.stdout, /fotos de demonstração/, id);
    assert.ok(!fs.existsSync(path.join(proprias(r, 'aurora'), id)), `${id}: algo foi gravado`);
    fs.rmSync(path.join(estilosDe(r, 'aurora'), id), { recursive: true, force: true });
  }
});

// Forma dos dados de legibilidade de uma prévia na marca (contrato com legibilidade.sugerir da etapa 8).
// Texto grande (56 px ou mais na peça de 1080) pede 3:1; o resto, 4,5:1; o mesmo número na detecção e no `minimo`.
// Só vira aviso o que é da marca (daMarca: a base passa naquele texto); texto coberto é achado à parte, sem cor.
function conferirLegibilidade(m, cores, { algumLegivel = true } = {}) {
  const HEX = /^#[0-9A-F]{6}$/;
  assert.ok(m.legibilidade && typeof m.legibilidade === 'object', 'falta legibilidade no previas.json');
  assert.deepStrictEqual(m.legibilidade.cores, cores, 'as cores da marca');
  assert.ok(Array.isArray(m.legibilidade.textos));
  // TODOS os textos medidos, compactos e sem corte (os que se leem também): a conta "esta cor estraga outro texto?"
  const todos = m.legibilidade.todos;
  assert.ok(Array.isArray(todos) && todos.length >= m.legibilidade.textos.filter((x) => x.tipo !== 'coberto').length, 'falta legibilidade.todos');
  if (algumLegivel) assert.ok(todos.some((x) => x.ct >= x.m), 'os textos que hoje se leem também ficam guardados');
  const pmod = require(path.join(RAIZ, '08-FERRAMENTAS', 'biblioteca', 'previas-marca.js'));
  for (const x of todos) {
    assert.ok(['carrossel', 'fixados', 'reels'].includes(x.f) && Number.isInteger(x.l) && Number.isInteger(x.k), JSON.stringify(x));
    assert.ok(x.p === null || ['escuro', 'claro', 'acento', 'neutro'].includes(x.p), JSON.stringify(x));
    assert.ok(HEX.test(x.c) && HEX.test(x.md) && Array.isArray(x.q) && x.q.length === 3 && x.q.every((h) => HEX.test(h)), JSON.stringify(x));
    assert.ok([3, 4.5].includes(x.m) && typeof x.ct === 'number' && typeof x.al === 'number', JSON.stringify(x));
    assert.ok(Math.abs(pmod.contrasteGuardado(x) - x.ct) < 0.2, `a conta guardada refaz o contraste medido: ${pmod.contrasteGuardado(x)} x ${x.ct}`);
  }
  for (const x of m.legibilidade.textos) {
    assert.ok(['carrossel', 'fixados', 'reels'].includes(x.formato) && Number.isInteger(x.lamina) && x.lamina >= 1, JSON.stringify(x));
    assert.ok(typeof x.texto === 'string' && x.texto.length > 0 && x.texto.length <= 40);
    assert.ok(['contraste', 'coberto', 'estilo'].includes(x.tipo), JSON.stringify(x));
    assert.strictEqual(typeof x.daMarca, 'boolean');
    if (x.tipo === 'coberto') { assert.ok(!('papel' in x) && !('fundo' in x), 'coberto não tem sugestão de cor'); continue; }
    assert.ok(['escuro', 'claro', 'acento', 'neutro'].includes(x.papel), 'o papel nunca fica vazio: ' + JSON.stringify(x));
    assert.strictEqual(typeof x.papelAproximado, 'boolean');
    assert.match(x.cor, HEX);
    assert.strictEqual(x.minimo, x.tamanho >= 56 ? 3 : 4.5, JSON.stringify(x));
    assert.ok(x.contraste < x.minimo, JSON.stringify(x));
    assert.ok(x.contrasteBase === null || typeof x.contrasteBase === 'number');
    assert.strictEqual(typeof x.piorou, 'boolean');
    assert.strictEqual(typeof x.sobreFoto, 'boolean');
    assert.strictEqual(typeof x.sobreImagem, 'boolean');
    assert.strictEqual(x.semOpcao, x.tipo === 'estilo', 'estilo é exatamente o que nenhuma cor resolve: ' + JSON.stringify(x));
    assert.strictEqual(x.daMarca, x.tipo === 'contraste' && x.piorou, JSON.stringify(x));
    assert.ok(Array.isArray(x.fundo.amostras) && x.fundo.amostras.length >= 1 && x.fundo.amostras.every((a) => HEX.test(a)), JSON.stringify(x.fundo));
    if (x.daMarca) assert.ok(m.avisos.includes(`Com as suas cores, o texto ${x.onde} fica difícil de ler.`), 'texto da marca sem o aviso dele');
    if (x.tipo === 'estilo' && x.piorou) assert.ok(m.avisos.includes(`Com a sua marca, este estilo deixa o texto ${x.onde} difícil de ler; que tal outro estilo?`), 'estilo sem o aviso dele');
  }
  for (const a of m.avisos.filter((v) => /^Com as suas cores/.test(v))) {
    assert.ok(m.legibilidade.textos.some((x) => x.tipo === 'contraste' && x.daMarca && a.includes(x.onde)), 'aviso de cor sem texto que uma cor resolve: ' + a);
  }
  for (const a of m.avisos.filter((v) => /outro estilo/.test(v))) {
    assert.ok(m.legibilidade.textos.some((x) => x.tipo === 'estilo' && x.piorou && a.includes(x.onde)), 'aviso de estilo sem texto: ' + a);
  }
  if (SUGERIR) {
    for (const x of m.legibilidade.textos.filter((y) => y.tipo !== 'coberto')) {
      const opcoes = SUGERIR.sugerir({ papel: x.papel, cores: m.legibilidade.cores, fundo: { amostras: x.fundo.amostras }, minimo: x.minimo });
      assert.strictEqual(x.semOpcao, opcoes.length === 0, 'semOpcao bate com a sugestão: ' + JSON.stringify(x));
    }
  }
}
// O módulo de sugestão de cores é da etapa 8 (08-FERRAMENTAS/marca/legibilidade.js). Enquanto ele não entra neste ramo, o teste
// usa o arquivo apontado por FABRICA_LEGIBILIDADE (o gerador usa o mesmo); sem ele, o aceite da sugestão não roda.
const SUGERIR = (() => {
  for (const arq of [path.join(RAIZ, '08-FERRAMENTAS', 'marca', 'legibilidade.js'), process.env.FABRICA_LEGIBILIDADE].filter(Boolean)) {
    if (fs.existsSync(arq)) return require(arq);
  }
  console.log('     (sem legibilidade.js nem FABRICA_LEGIBILIDADE: o aceite da sugestão de cores não roda)');
  return null;
})();
// Aceite do Editorial (correção do D5): o título sobre a foto avisa com menos de 3:1, e a sugestão tem ao menos uma cor que
// passa contra TODAS as amostras do fundo.
function aceiteDoEditorial(ed, cores) {
  conferirLegibilidade(ed, cores);
  const titulo = ed.legibilidade.textos.find((x) => x.tipo === 'contraste' && x.formato === 'carrossel' && x.lamina === 1 && /imposto/i.test(x.texto));
  assert.ok(titulo, 'o título da capa do Editorial devia estar nos dados: ' + JSON.stringify(ed.legibilidade.textos.slice(0, 3)));
  assert.deepStrictEqual([titulo.papel, titulo.daMarca, titulo.minimo, titulo.sobreFoto, titulo.semOpcao], ['neutro', true, 3, true, false], JSON.stringify(titulo));
  assert.ok(titulo.contraste < 3);
  assert.ok(ed.avisos.includes('Com as suas cores, o texto da lâmina 1 fica difícil de ler.'), JSON.stringify(ed.avisos));
  if (!SUGERIR) return;
  const opcoes = SUGERIR.sugerir({ papel: titulo.papel, cores: ed.legibilidade.cores, fundo: { amostras: titulo.fundo.amostras }, minimo: titulo.minimo });
  assert.ok(opcoes.length >= 1, 'a sugestão devia ter ao menos uma cor');
  for (const o of opcoes) for (const f of titulo.fundo.amostras) assert.ok(SUGERIR.contraste(o.cor, f) >= titulo.minimo, `${o.cor} contra ${f}`);
  console.log(`     (Editorial: título ${titulo.contraste}:1; sugestões ${opcoes.map((o) => `${o.cor} ${o.contraste}:1 ${o.origem}`).join(', ')})`);
}

t('achadosDaMarca: mínimo pelo tamanho, culpa só da marca, coberto à parte, papel aproximado e sem opção', () => {
  const cores = { escuro: hx(20, 20, 20), claro: hx(250, 250, 250), acento: hx(200, 30, 110), neutro: hx(150, 110, 90) };
  const txt = (k, extra) => ({ k, texto: 'texto ' + k, tamanho: 80, coberto: false, contraste: 10, cor: [20, 20, 20], efetiva: [20, 20, 20], alfa: 1, sobreFoto: false, amostras: [hx(240, 240, 240)], ...extra });
  const marca = [{ lamina: 1, foraDaBorda: true, textos: [
    txt(0, { contraste: 2, cor: [150, 110, 90], efetiva: [150, 110, 90], sobreFoto: true }), // título da marca: 2 < 3
    txt(1, { tamanho: 30, contraste: 4 }), // pequeno: 4 < 4,5, mas a base também falha
    txt(2, { coberto: true }),
    txt(3, { tamanho: 30, contraste: 3.2, cor: [148, 112, 92], efetiva: [148, 112, 92] }), // cor misturada, perto do neutro
    txt(4, { tamanho: 60, contraste: 3.5 }), // grande e passa: nada
  ] }, { lamina: 2, foraDaBorda: true, textos: [] }];
  const base = [{ lamina: 1, foraDaBorda: false, textos: [txt(0, { contraste: 5 }), txt(1, { tamanho: 30, contraste: 3.9 }), txt(2, {}), txt(3, { tamanho: 30, contraste: 6 }), txt(4, {})] },
    { lamina: 2, foraDaBorda: true, textos: [] }];
  // correção 2: a base também falha, mas a marca piorou muito (1,04 contra 3,37): volta a ser culpa da marca
  marca[0].textos.push(txt(5, { tamanho: 32, contraste: 1.04 }));
  base[0].textos.push(txt(5, { tamanho: 32, contraste: 3.37 }));
  const r = previas.achadosDaMarca({ formato: 'carrossel', marca, base, cores, sugerir: (p) => (p.minimo === 3 ? [] : [{ cor: hx(0, 0, 0) }]) });
  const [t0, t1, t2, t3, t5] = r.textos;
  assert.strictEqual(r.textos.length, 5, JSON.stringify(r.textos));
  // nenhuma cor resolve o título: é o estilo, não as cores (sem "Com as suas cores")
  assert.deepStrictEqual([t0.tipo, t0.daMarca, t0.piorou, t0.minimo, t0.papel, t0.papelAproximado, t0.semOpcao, t0.sobreFoto, t0.contrasteBase], ['estilo', false, true, 3, 'neutro', false, true, true, 5]);
  assert.deepStrictEqual([t1.tipo, t1.daMarca, t1.piorou, t1.minimo, t1.contrasteBase], ['contraste', false, false, 4.5, 3.9], 'a base também falha e quase igual: não é culpa da marca');
  assert.deepStrictEqual([t2.tipo, t2.daMarca, 'papel' in t2, 'fundo' in t2], ['coberto', true, false, false]);
  assert.deepStrictEqual([t3.papel, t3.papelAproximado, t3.semOpcao], ['neutro', true, false]);
  assert.deepStrictEqual([t5.tipo, t5.daMarca, t5.piorou, t5.contrasteBase], ['contraste', true, true, 3.37], 'a marca piorou muito um texto que a base já tinha fraco');
  assert.deepStrictEqual(r.avisos, ['Com a sua marca, este estilo deixa o texto da lâmina 1 difícil de ler; que tal outro estilo?', 'Com as suas letras, o texto da lâmina 1 fica coberto por outra parte da peça.',
    'Com as suas cores, o texto da lâmina 1 fica difícil de ler.', 'Com as suas letras, o texto da lâmina 1 passa da borda.']);
  // a regra da piora: menos 0,5 E menos de 80% do contraste da base
  const piora = (cm, cb) => previas.achadosDaMarca({ formato: 'reels', marca: [{ lamina: 1, foraDaBorda: false, textos: [txt(0, { tamanho: 30, contraste: cm })] }], base: [{ lamina: 1, foraDaBorda: false, textos: [txt(0, { tamanho: 30, contraste: cb })] }], cores, sugerir: () => [{}] }).textos[0].daMarca;
  assert.deepStrictEqual([piora(3, 4), piora(3.4, 4), piora(3.1, 4), piora(1.5, 1.9)], [true, false, true, false]);
  // sem o módulo de sugestão: sem opção só quando nenhuma cor passaria (fundo de preto, cinza e branco, texto pequeno)
  const sem = previas.achadosDaMarca({ formato: 'reels', marca: [{ lamina: 1, foraDaBorda: false, textos: [txt(0, { tamanho: 30, contraste: 1, amostras: [hx(0, 0, 0), hx(119, 119, 119), hx(255, 255, 255)] }), txt(1, { tamanho: 30, contraste: 1 })] }], base: null, cores, sugerir: null });
  assert.deepStrictEqual(sem.textos.map((x) => [x.tipo, x.daMarca, x.semOpcao]), [['estilo', false, true], ['contraste', true, false]]);
  assert.deepStrictEqual(sem.avisos, ['Com a sua marca, este estilo deixa o texto da capa de Reels difícil de ler; que tal outro estilo?', 'Com as suas cores, o texto da capa de Reels fica difícil de ler.']);
});
t('medirLegibilidade: texto sobre a foto conta como sobre foto; texto numa caixa opaca por cima da foto, não', async () => {
  const foto = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ESTILOS, '_demo', 'fotos', 'retrato-blazer.jpg')).toString('base64');
  const png = path.join(TMP, 'desenho.png');
  assert.strictEqual(spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0xF0F0F0:s=200x40', '-frames:v', '1', png]).status, 0);
  const desenho = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
  const html = `<!doctype html><html><head><style>body{margin:0}.lamina{position:relative;width:1080px;height:1350px;background:rgb(255,255,255);overflow:hidden}
img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}h1,p{margin:0;position:absolute;left:80px}</style></head><body>
<div class="lamina"><img src="${foto}"><h1 class="titulo" style="top:100px;font-size:80px;color:rgb(255,255,255)">Sobre a foto</h1>
<div style="position:absolute;top:900px;left:60px;width:700px;height:160px;background:rgb(30,30,30)"></div><p class="corpo" style="top:940px;font-size:44px;color:rgb(235,235,235)">Na caixa</p>
<img src="${desenho}" style="inset:auto;left:60px;top:1150px;width:700px;height:120px"><p class="corpo" style="top:1180px;font-size:44px;color:rgb(250,250,250)">Sobre o desenho</p></div></body></html>`;
  const [lam] = await previas.medirLegibilidade(html, { largura: 1080, altura: 1350 });
  const por = Object.fromEntries(lam.textos.map((x) => [x.texto, x]));
  assert.strictEqual(por['Sobre a foto'].sobreFoto, true);
  assert.strictEqual(por['Na caixa'].sobreFoto, false, 'a caixa opaca esconde a foto');
  // um desenho (PNG) debaixo do texto não é foto, mas é imagem (o prato do Concreto Ácido, o pincel do Caderno)
  assert.deepStrictEqual([por['Sobre o desenho'].sobreFoto, por['Sobre o desenho'].sobreImagem, por['Sobre a foto'].sobreImagem, por['Na caixa'].sobreImagem], [false, true, false, false]);
  assert.strictEqual(por['Sobre a foto'].tamanho, 80);
  assert.ok(por['Na caixa'].contraste > 4.5 && por['Sobre a foto'].amostras.length >= 1);
});
const arquivosDe = (m) => [...new Set([m.capa, ...(m.carrossel || []), ...Object.values(m.fixados || {}), m.reelsCapa].filter(Boolean))];

(async () => {
  try {
    // TESTE_FILTRO=<trecho do nome> roda só os testes que o contêm (para repetir um caso sem esperar a bateria inteira)
    for (const [nome, fn] of lista) {
      if (process.env.TESTE_FILTRO && !nome.includes(process.env.TESTE_FILTRO)) continue;
      await fn(); n++; console.log('ok   ' + nome);
    }
  } catch (e) {
    console.error('FALHOU: ' + (e && e.stack || e));
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(1);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${n} testes passaram.`);
})();
