#!/usr/bin/env node
// O vídeo de cada estilo na marca da empresa (etapa 7, item 7.8): video-marca.js. Rode:
//   node 08-FERRAMENTAS/biblioteca/video-marca.test.js
// Precisa do ffmpeg. O montar.js é trocado por uma versão de teste (rodarMontar) que grava um MP4 sintético da cor do acento
// da empresa e fala como o montar.js de verdade (linha "marca-usada" e avisos "[marca]"); o corte do trecho é o de verdade.
// Com FABRICA_TESTE_VIDEO=1 e o vídeo de demonstração neste computador, um teste longo monta um modelo de verdade na aurora.
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const vm = require('./video-marca');
const pm = require('./previas-marca');
const empresaMod = require('../../_fabrica/core/empresa');

const RAIZ_CODIGO = path.join(__dirname, '..', '..');
const FONTES = path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'video-marca-teste-'));
let n = 0;
const lista = [];
const t = (nome, fn) => lista.push([nome, fn]);
const hx = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const ACENTO = { aurora: [200, 30, 110], boreal: [0, 150, 230], principal: [40, 160, 60] };
const MARCAS = {
  aurora: { nome: 'Aurora Teste', cores: { escuro: hx(58, 30, 20), claro: hx(255, 243, 228), acento: hx(...ACENTO.aurora), neutro: hx(176, 125, 98) }, letras: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'DMMono-Medium.ttf' } },
  boreal: { nome: 'Boreal Teste', cores: { escuro: hx(14, 42, 59), claro: hx(234, 246, 248), acento: hx(...ACENTO.boreal), neutro: hx(94, 124, 140) }, letras: { principal: 'DMSans-Medium.ttf', mono: 'JetBrainsMono-Bold.ttf' } },
  principal: { nome: 'Empresa Antiga', cores: { escuro: hx(20, 40, 20), claro: hx(240, 250, 240), acento: hx(...ACENTO.principal), neutro: hx(100, 130, 100) }, letras: { principal: 'DMSans-Medium.ttf', mono: 'DMMono-Medium.ttf' } },
};
const yamlDe = (m, pasta = 'fontes/') => ['empresa:', `  nome: "${m.nome}"`, 'cores:', ...Object.entries(m.cores).map(([k, v]) => `  ${k}: "${v}"`), 'tipografia:',
  ...Object.keys(m.letras).flatMap((p) => [`  ${p}:`, `    arquivo: "${pasta}${p}.ttf"`]), ''].join('\n');

// raiz: a pasta antiga (principal), aurora, boreal e cinza (sem marca)
const R = path.join(TMP, 'raiz');
fs.mkdirSync(path.join(R, '06-MARCA-E-FOTOS', 'fontes'), { recursive: true });
fs.writeFileSync(path.join(R, '06-MARCA-E-FOTOS', 'marca.yaml'), yamlDe(MARCAS.principal, '06-MARCA-E-FOTOS/fontes/'));
for (const [p, f] of Object.entries(MARCAS.principal.letras)) fs.copyFileSync(path.join(FONTES, f), path.join(R, '06-MARCA-E-FOTOS', 'fontes', p + '.ttf'));
for (const [c, nome] of [['aurora', 'Aurora Teste'], ['boreal', 'Boreal Teste'], ['cinza', 'Cinza Sem Marca']]) empresaMod.criar(c, nome, R);
function colocarMarca(c, m = MARCAS[c]) {
  const dir = path.join(R, 'empresas', c);
  fs.mkdirSync(path.join(dir, 'fontes'), { recursive: true });
  for (const [p, f] of Object.entries(m.letras)) fs.copyFileSync(path.join(FONTES, f), path.join(dir, 'fontes', p + '.ttf'));
  fs.writeFileSync(path.join(dir, 'marca.yaml'), yamlDe(m));
}
colocarMarca('aurora'); colocarMarca('boreal');
const previasDe = (c) => pm.pastaDaEmpresa(R, c);
const pastaEstilo = (c, id) => path.join(previasDe(c), id);
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function foto(dir, { fora = [] } = {}) {
  const mapa = {};
  if (!fs.existsSync(dir)) return mapa;
  const varrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const a = path.join(d, e.name);
      if (fora.some((f) => a === f || a.startsWith(f + path.sep))) continue;
      if (e.isDirectory()) varrer(a); else mapa[path.relative(dir, a)] = sha(fs.readFileSync(a));
    }
  };
  varrer(dir);
  return mapa;
}
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' }); assert.strictEqual(r.status, 0, r.stderr); };
function sonda(arq) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height:format=duration,format_name', '-of', 'json', arq], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
// cor média de uma imagem (o ffmpeg reduz a 1 pixel)
function corMedia(arq) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', arq, '-vf', 'scale=1:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 20 });
  assert.strictEqual(r.status, 0, String(r.stderr));
  return [...r.stdout.slice(0, 3)];
}
const perto = (a, b, d = 30) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < d;

// vídeo de demonstração de mentira (com som, para conferir que o trecho sai mudo) e o pedido dele
const DEMO = path.join(TMP, 'demo');
fs.mkdirSync(DEMO, { recursive: true });
ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=320x568:d=15:r=30', '-f', 'lavfi', '-i', 'sine=d=15', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(DEMO, 'video.mp4')]);
fs.copyFileSync(path.join(DEMO, 'video.mp4'), path.join(DEMO, 'matte.mp4'));
fs.writeFileSync(path.join(DEMO, 'palavras.json'), '[]');
fs.copyFileSync(path.join(RAIZ_CODIGO, '04-LABORATORIO-DE-DESIGN', 'estilos', '_demo', 'fotos', 'xicara.jpg'), path.join(DEMO, 'xicara.jpg'));
const PEDIDO = { liberado: true, video: 'video.mp4', matte: 'matte.mp4', palavras: 'palavras.json', trecho: { ini: 0, fim: 14.5 },
  chamada: { texto: 'Ordem na semana', palavra: 'Ordem', ini: 0.5, fim: 3.2 }, broll: [{ img: 'xicara.jpg', ini: 5.3, fim: 10.1 }] };
const pedidoDemo = path.join(DEMO, 'pedido-demonstracao.json');
fs.writeFileSync(pedidoDemo, JSON.stringify(PEDIDO, null, 2));
const FOTO_DEMO = foto(DEMO);

// o montar.js de teste: confere o comando e o ambiente, grava <saida>/<modelo>.mp4 da cor do acento e fala como o de verdade
const chamadas = [];
function montarFalso({ cor = null, duracao = 14.5, falha = null, antes = null, usada = null } = {}) {
  return async (args, { env, limiteMs }) => {
    chamadas.push({ args, env, limiteMs });
    if (antes) antes();
    if (falha) return { status: 1, stdout: '', stderr: falha, tempoEsgotado: false };
    const c = env.FABRICA_EMPRESA;
    const saida = args[args.indexOf('--saida') + 1];
    const modelo = args[1];
    const acento = cor || ACENTO[c];
    fs.mkdirSync(saida, { recursive: true });
    ffmpeg(['-f', 'lavfi', '-i', `color=c=0x${acento.map((x) => x.toString(16).padStart(2, '0')).join('')}:s=540x960:d=${duracao}:r=30`,
      '-f', 'lavfi', '-i', `sine=d=${duracao}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(saida, modelo + '.mp4')]);
    fs.writeFileSync(path.join(saida, modelo + '.tsrct'), 'projeto');
    const i = pm.instantaneoDaMarca(R, c);
    const marca = usada || { arquivo: empresaMod.caminhos(c, R).marca, exemplo: false, empresa: c, cores: MARCAS[c].cores,
      fontes: Object.fromEntries(['principal', 'mono', 'acento'].map((p) => [p, i.letras[p].arquivo])), principalItalico: false };
    return {
      status: 0, tempoEsgotado: false,
      stdout: `marca-usada ${JSON.stringify(marca)}\n${JSON.stringify({ modelo, camadas: 30, acoes: 20, segundos: 1 })}\n`,
      stderr: [
        '[marca] legenda sobre o vídeo: "acento" fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.',
        '[marca] título sobre o vídeo: "acento" fica sem contraste (abaixo de 4,5:1) com as cores da marca; usando a cor original do estilo.',
        '[marca] o texto "ORGANIZE" não cabe na tela nem com 40% do corpo da letra: ele sai da tela.',
        'marca: tipografia.acento: arquivo de letra não encontrado (fontes/x.ttf). Nesses papéis, o modelo usa as letras dele.',
      ].join('\n') + '\n',
    };
  };
}
const opcoes = (extra = {}) => ({ raiz: R, pedidoDemo, ...extra });
// manifesto das imagens na marca de hoje (como o gerar-previas.js --marca grava), com uma imagem de mentira
function imagensDeHoje(c, id, avisos = ['Com as suas cores, o texto da lâmina 1 fica difícil de ler.']) {
  const dir = pastaEstilo(c, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'carrossel-01.webp'), 'imagem');
  const m = { estilo: id, cores: 'marca', identidade: 'empresa', empresa: c, assinatura: pm.assinaturaDaMarca(R, c).assinatura, capa: 'carrossel-01.webp',
    carrossel: ['carrossel-01.webp'], fixados: null, reelsCapa: null, video: null, videoCapa: null, avisos };
  fs.writeFileSync(path.join(dir, 'previas.json'), JSON.stringify(m, null, 2));
  return m;
}
const manifesto = (c, id) => JSON.parse(fs.readFileSync(path.join(pastaEstilo(c, id), 'previas.json'), 'utf8'));
const PALAVRAS_PROIBIDAS = /gaveta|disposi|índice|legado|manifesto|assinatura|fila|webp|webm|trabalhador|\.json|\.ya?ml|\.ttf|\.mp4|\[marca\]|marca:/i;

// ---------- sem fonte, sem modelo, sem marca ----------
t('sem o pedido de demonstração: "sem-fonte" com mensagem em português, nada gravado e o montar.js nem é chamado', async () => {
  const antes = chamadas.length;
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', pedidoDemo: path.join(TMP, 'nao-existe.json'), rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'sem-fonte');
  assert.ok(/vídeo de demonstração/.test(r.mensagem) && /neste computador/.test(r.mensagem) && /modelo base/.test(r.mensagem), r.mensagem);
  assert.ok(!PALAVRAS_PROIBIDAS.test(r.mensagem), r.mensagem);
  assert.strictEqual(chamadas.length, antes);
  assert.ok(!fs.existsSync(previasDe('aurora')), 'nenhuma pasta devia ser criada');
});
t('pedido presente, mas sem o vídeo (ou a máscara, ou a imagem) que ele cita: "sem-fonte"', async () => {
  for (const falta of ['video', 'matte', 'img']) {
    const dir = path.join(TMP, 'demo-sem-' + falta);
    fs.mkdirSync(dir, { recursive: true });
    const p = JSON.parse(JSON.stringify(PEDIDO));
    for (const k of ['video', 'matte', 'palavras']) p[k] = path.join(DEMO, p[k]);
    p.broll[0].img = path.join(DEMO, 'xicara.jpg');
    if (falta === 'img') p.broll[0].img = 'nao-tem.jpg'; else p[falta] = 'nao-tem.mp4';
    fs.writeFileSync(path.join(dir, 'pedido.json'), JSON.stringify(p));
    const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', pedidoDemo: path.join(dir, 'pedido.json'), rodarMontar: montarFalso() }));
    assert.strictEqual(r.estado, 'sem-fonte', falta);
  }
  assert.ok(!fs.existsSync(previasDe('aurora')));
});
t('sem pedidoDemo, vale FABRICA_PEDIDO_DEMONSTRACAO; sem ela, o pedido da pasta amostra/ do modelo', () => {
  const antes = process.env.FABRICA_PEDIDO_DEMONSTRACAO;
  try {
    process.env.FABRICA_PEDIDO_DEMONSTRACAO = pedidoDemo;
    assert.strictEqual(vm.pedidoDeDemonstracao(), path.resolve(pedidoDemo));
    assert.strictEqual(vm.pedidoDeDemonstracao({ pedidoDemo: 'x.json' }), path.resolve('x.json'));
    delete process.env.FABRICA_PEDIDO_DEMONSTRACAO;
    assert.strictEqual(vm.pedidoDeDemonstracao(), path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'amostra', 'pedido-demonstracao.json'));
  } finally { if (antes === undefined) delete process.env.FABRICA_PEDIDO_DEMONSTRACAO; else process.env.FABRICA_PEDIDO_DEMONSTRACAO = antes; }
});
t('modelo sem aceitaMarca, estilo sem modelo de Reels ou modelo que não existe: "sem-modelo", nada gravado', async () => {
  const estilos = path.join(TMP, 'estilos');
  const modelos = path.join(TMP, 'modelos');
  fs.mkdirSync(modelos, { recursive: true });
  fs.writeFileSync(path.join(modelos, 'velho.js'), 'module.exports = { nome: "Velho", montar() {} };\n');
  fs.writeFileSync(path.join(modelos, 'novo.js'), 'module.exports = { nome: "Novo", aceitaMarca: "sim", montar() {} };\n');
  const casos = { velho: 'formatos:\n  reels: { modelo: velho, capa: capa }\n', novo: 'formatos:\n  reels: { modelo: novo }\n',
    semreels: 'formatos:\n  carrossel: { lâminas: 6 }\n', sumido: 'formatos:\n  reels: { modelo: nao-tem }\n', torto: 'formatos:\n  reels: { modelo: "../velho" }\n' };
  for (const [id, y] of Object.entries(casos)) { fs.mkdirSync(path.join(estilos, id), { recursive: true }); fs.writeFileSync(path.join(estilos, id, 'estilo.yaml'), 'nome: X\n' + y); }
  const antes = chamadas.length;
  for (const id of Object.keys(casos)) {
    const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: id, pastaEstilos: estilos, pastaModelos: modelos, rodarMontar: montarFalso() }));
    assert.strictEqual(r.estado, 'sem-modelo', id);
    assert.ok(/modelo base/.test(r.mensagem) && !PALAVRAS_PROIBIDAS.test(r.mensagem), r.mensagem);
  }
  assert.strictEqual(chamadas.length, antes);
  assert.ok(!fs.existsSync(previasDe('aurora')));
});
t('empresa sem marca própria: "sem-marca", nada gravado', async () => {
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'cinza', estilo: 'protagonista', rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'sem-marca');
  assert.ok(/ainda não tem marca definida/.test(r.mensagem), r.mensagem);
  assert.ok(!fs.existsSync(previasDe('cinza')));
});
t('empresa ../x, vazia ou inexistente, e estilo com caminho ou fora da biblioteca: erro claro antes de ler ou gravar qualquer coisa', async () => {
  for (const empresa of ['../aurora', '', 'nao-existe', 'AURORA', undefined]) {
    await assert.rejects(vm.gerarVideoNaMarca(opcoes({ empresa, estilo: 'protagonista', rodarMontar: montarFalso() })), (e) => e.code === 'EMPRESA_DESCONHECIDA' && /não existe nesta pasta/.test(e.message));
  }
  for (const estilo of ['../protagonista', 'nao-existe', '', 'Protagonista', '.trabalho']) {
    await assert.rejects(vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo, rodarMontar: montarFalso() })), (e) => e.code === 'ESTILO_DESCONHECIDO' && /não está na biblioteca/.test(e.message), estilo);
  }
  assert.ok(!fs.existsSync(previasDe('aurora')));
});

// ---------- o vídeo pronto ----------
let fotoAuroraPronta = null;
t('aurora, protagonista: montar.js com --saida na pasta de trabalho e --usar-marca, ambiente só da aurora; trecho de 12 s mudo, capa, manifesto e nada fora da pasta', async () => {
  imagensDeHoje('aurora', 'protagonista');
  // sobras de uma rodada que morreu no meio: saem antes
  const trabalho = path.join(previasDe('aurora'), '.trabalho', 'protagonista');
  fs.mkdirSync(trabalho, { recursive: true }); fs.writeFileSync(path.join(trabalho, 'protagonista.mp4'), 'pela metade');
  fs.writeFileSync(path.join(pastaEstilo('aurora', 'protagonista'), '.novo-video-velho.webm'), 'pela metade');
  const fotoRaiz = foto(R, { fora: [previasDe('aurora')] });
  const sujo = { FABRICA_MARCA: path.join(R, 'empresas', 'boreal', 'marca.yaml'), FABRICA_EMPRESA: 'boreal' };
  const guardado = { FABRICA_MARCA: process.env.FABRICA_MARCA, FABRICA_EMPRESA: process.env.FABRICA_EMPRESA };
  Object.assign(process.env, sujo);
  let r;
  try { r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso() })); } finally {
    for (const [k, v] of Object.entries(guardado)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  assert.strictEqual(r.estado, 'pronto', JSON.stringify(r));
  const ch = chamadas[chamadas.length - 1];
  assert.strictEqual(path.resolve(ch.args[0]), path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'montar.js'));
  assert.deepStrictEqual(ch.args.slice(1), ['protagonista', path.resolve(pedidoDemo), '--exportar', '--saida', trabalho, '--usar-marca']);
  assert.strictEqual(ch.env.FABRICA_EMPRESA, 'aurora'); assert.strictEqual(ch.env.FABRICA_RAIZ, R); assert.ok(!('FABRICA_MARCA' in ch.env));
  assert.strictEqual(ch.limiteMs, 20 * 60 * 1000);
  const dir = pastaEstilo('aurora', 'protagonista');
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['carrossel-01.webp', 'previas.json', 'video-capa.webp', 'video.webm']);
  assert.ok(!fs.existsSync(path.join(previasDe('aurora'), '.trabalho')), 'a pasta de trabalho devia sair');
  const s = sonda(path.join(dir, 'video.webm'));
  assert.ok(/webm/.test(s.format.format_name));
  assert.deepStrictEqual(s.streams.map((x) => [x.codec_type, x.codec_name, x.width, x.height]), [['video', 'vp9', 540, 960]], 'só vídeo, sem som');
  assert.ok(Math.abs(Number(s.format.duration) - 12) < 0.3, 'duração ' + s.format.duration);
  assert.ok(perto(corMedia(path.join(dir, 'video-capa.webp')), ACENTO.aurora), 'a capa do vídeo não tem a cor da aurora: ' + corMedia(path.join(dir, 'video-capa.webp')));
  const m = manifesto('aurora', 'protagonista');
  const ass = pm.assinaturaDaMarca(R, 'aurora').assinatura;
  assert.deepStrictEqual([m.video, m.videoCapa, m.videoAssinatura, m.assinatura, m.capa, m.empresa, m.cores], ['video.webm', 'video-capa.webp', ass, ass, 'carrossel-01.webp', 'aurora', 'marca']);
  assert.strictEqual(m.videoModelo, 'protagonista');
  assert.deepStrictEqual(m.videoAvisos, [
    'No vídeo, com as suas cores, um texto ficaria difícil de ler; nesse ponto ele usa as cores do estilo.',
    'No vídeo, com as suas letras, um texto não coube inteiro na tela.',
    'No vídeo, uma letra da sua marca não foi encontrada; nesse lugar ele usa a letra do estilo.',
  ]);
  assert.deepStrictEqual(m.avisos, ['Com as suas cores, o texto da lâmina 1 fica difícil de ler.', ...m.videoAvisos]);
  for (const a of m.videoAvisos) assert.ok(!PALAVRAS_PROIBIDAS.test(a), a);
  assert.ok(m.videoDetalhes.some((l) => /não cabe na tela/.test(l)) && m.videoDetalhes.length <= 20);
  assert.deepStrictEqual(r.avisos, m.videoAvisos);
  assert.strictEqual(r.videoAssinatura, ass);
  const v = pm.previasValidas(R, 'aurora', 'protagonista', ass);
  assert.strictEqual(v.video, '/empresas/aurora/previas/protagonista/video.webm');
  assert.strictEqual(v.videoCapa, '/empresas/aurora/previas/protagonista/video-capa.webp');
  assert.deepStrictEqual(foto(R, { fora: [previasDe('aurora')] }), fotoRaiz, 'algo fora da pasta da aurora mudou');
  assert.deepStrictEqual(foto(DEMO), FOTO_DEMO, 'o pedido e o vídeo de demonstração não podem mudar');
  fotoAuroraPronta = foto(previasDe('aurora'));
});
t('boreal logo depois: cores da boreal, e a pasta da aurora fica idêntica; nenhum arquivo da boreal cita a aurora', async () => {
  imagensDeHoje('boreal', 'protagonista', []);
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'boreal', estilo: 'protagonista', rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'pronto', JSON.stringify(r));
  assert.strictEqual(chamadas[chamadas.length - 1].env.FABRICA_EMPRESA, 'boreal');
  const capa = path.join(pastaEstilo('boreal', 'protagonista'), 'video-capa.webp');
  assert.ok(perto(corMedia(capa), ACENTO.boreal) && !perto(corMedia(capa), ACENTO.aurora, 120));
  assert.deepStrictEqual(foto(previasDe('aurora')), fotoAuroraPronta);
  const m = manifesto('boreal', 'protagonista');
  assert.ok(!/aurora/i.test(JSON.stringify(m)));
  assert.deepStrictEqual(m.avisos, m.videoAvisos, 'sem aviso das imagens, ficam só os do vídeo');
});
t('pasta antiga (principal): o vídeo cai em empresas/principal/previas/, e o 06-MARCA-E-FOTOS fica idêntico', async () => {
  const antiga = foto(path.join(R, '06-MARCA-E-FOTOS'));
  imagensDeHoje('principal', 'protagonista', []);
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'principal', estilo: 'protagonista', rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'pronto', JSON.stringify(r));
  assert.strictEqual(previasDe('principal'), path.join(R, 'empresas', 'principal', 'previas'));
  assert.ok(fs.existsSync(path.join(R, 'empresas', 'principal', 'previas', 'protagonista', 'video.webm')));
  assert.deepStrictEqual(foto(path.join(R, '06-MARCA-E-FOTOS')), antiga);
});
t('imagens de uma marca antiga na pasta: o vídeo entra num manifesto SEM as imagens velhas (nunca viram "na sua marca")', async () => {
  const dir = pastaEstilo('aurora', 'cartilha');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'carrossel-01.webp'), 'imagem velha');
  fs.writeFileSync(path.join(dir, 'previas.json'), JSON.stringify({ estilo: 'cartilha', cores: 'marca', identidade: 'empresa', empresa: 'aurora', assinatura: 'marca-de-ontem',
    capa: 'carrossel-01.webp', carrossel: ['carrossel-01.webp'], fixados: null, reelsCapa: null, avisos: ['aviso velho'] }));
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'cartilha', rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'pronto', JSON.stringify(r));
  const m = manifesto('aurora', 'cartilha');
  const ass = pm.assinaturaDaMarca(R, 'aurora').assinatura;
  assert.strictEqual(m.assinatura, ass); assert.strictEqual(m.videoAssinatura, ass);
  assert.deepStrictEqual([m.capa, m.carrossel, m.fixados, m.reelsCapa], [null, [], null, null]);
  assert.ok(!m.avisos.includes('aviso velho'));
  assert.strictEqual(pm.previasValidas(R, 'aurora', 'cartilha', ass), null, 'sem as imagens de hoje não há prévia na marca');
  assert.ok(fs.existsSync(path.join(dir, 'carrossel-01.webp')), 'o arquivo velho fica (o gerador das imagens cuida dele)');
});

// ---------- marca que muda, marca que não confere, falhas ----------
t('marca da aurora muda enquanto o vídeo é montado: "refazer", e a pasta do estilo fica idêntica byte a byte', async () => {
  const antes = foto(previasDe('aurora'));
  const original = fs.readFileSync(path.join(R, 'empresas', 'aurora', 'marca.yaml'));
  try {
    const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista',
      rodarMontar: montarFalso({ antes: () => colocarMarca('aurora', { ...MARCAS.aurora, cores: { ...MARCAS.aurora.cores, claro: hx(255, 236, 214) } }) }) }));
    assert.strictEqual(r.estado, 'refazer', JSON.stringify(r));
    assert.ok(/marca mudou/.test(r.mensagem) && !PALAVRAS_PROIBIDAS.test(r.mensagem), r.mensagem);
  } finally { fs.writeFileSync(path.join(R, 'empresas', 'aurora', 'marca.yaml'), original); }
  assert.deepStrictEqual(foto(previasDe('aurora')), antes);
});
t('assinatura pedida que já não é a de hoje: "refazer" sem montar nada', async () => {
  const antes = chamadas.length;
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', assinatura: 'outra', rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'refazer');
  assert.strictEqual(chamadas.length, antes);
});
t('o montar.js leu outra marca (cores da boreal, marca de exemplo ou letra diferente): "erro", nada gravado', async () => {
  const antes = foto(previasDe('aurora'));
  const i = pm.instantaneoDaMarca(R, 'aurora');
  const certa = { arquivo: empresaMod.caminhos('aurora', R).marca, exemplo: false, empresa: 'aurora', cores: MARCAS.aurora.cores,
    fontes: { principal: i.letras.principal.arquivo, mono: i.letras.mono.arquivo, acento: null }, principalItalico: false };
  const erradas = [
    { ...certa, cores: MARCAS.boreal.cores },
    { ...certa, arquivo: path.join(R, 'empresas', 'boreal', 'marca.yaml') },
    { ...certa, exemplo: true },
    { ...certa, fontes: { ...certa.fontes, principal: path.join(R, 'empresas', 'boreal', 'fontes', 'principal.ttf') } },
    { ...certa, fontes: { ...certa.fontes, acento: path.join(FONTES, 'SpaceMono-Bold.ttf') } },
    // correção: o itálico da letra principal muda a letra do destaque, e a aurora não diz que tem itálico
    { ...certa, principalItalico: true },
    null,
  ];
  for (const usada of erradas) {
    const montar = montarFalso({ usada });
    const semLinha = async (a, o) => { const x = await montar(a, o); return { ...x, stdout: x.stdout.split('\n').filter((l) => !l.startsWith('marca-usada')).join('\n') }; };
    const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: usada ? montar : semLinha }));
    assert.strictEqual(r.estado, 'erro', JSON.stringify(usada));
    assert.ok(/não é a da sua marca|não usou a sua marca/.test(r.mensagem), r.mensagem);
    // correção: o detalhe (que a fila guarda na pasta da aurora) não leva caminho nem nome de arquivo, nem de outra empresa
    assert.ok(!/[\\/]|boreal|\.ya?ml|\.ttf/i.test(r.detalhe || ''), r.detalhe);
  }
  assert.deepStrictEqual(foto(previasDe('aurora')), antes);
});
t('letra da marca por caminho absoluto (a assinatura não a conhece): "erro" com o motivo verdadeiro, em português e sem caminho', async () => {
  const antes = foto(previasDe('aurora'));
  const arq = path.join(R, 'empresas', 'aurora', 'marca.yaml');
  const original = fs.readFileSync(arq);
  const absoluta = path.join(FONTES, 'DMSerifDisplay-Regular.ttf');
  try {
    fs.writeFileSync(arq, String(original).replace('"fontes/principal.ttf"', JSON.stringify(absoluta)));
    const i = pm.instantaneoDaMarca(R, 'aurora');
    assert.ok(i.letras.principal.citada && !i.letras.principal.arquivo, 'a assinatura não lê letra por caminho absoluto');
    const usada = { arquivo: arq, exemplo: false, empresa: 'aurora', cores: MARCAS.aurora.cores,
      fontes: { principal: absoluta, mono: i.letras.mono.arquivo, acento: null }, principalItalico: false };
    const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso({ usada }) }));
    assert.strictEqual(r.estado, 'erro');
    assert.ok(/letra principal da sua marca precisa estar na pasta da sua marca/.test(r.mensagem), r.mensagem);
    assert.ok(!/[\\/:]|\.ttf/.test(r.mensagem) && !PALAVRAS_PROIBIDAS.test(r.mensagem), r.mensagem);
  } finally { fs.writeFileSync(arq, original); }
  assert.deepStrictEqual(foto(previasDe('aurora')), antes);
});
t('falha no meio da troca de nomes (capa presa): "erro", o manifesto fica sem vídeo (nunca prévia falsa); a rodada seguinte refaz', async () => {
  const ass = pm.assinaturaDaMarca(R, 'aurora').assinatura;
  assert.ok(pm.previasValidas(R, 'aurora', 'protagonista', ass).video, 'antes: vídeo valendo');
  const original = fs.renameSync;
  fs.renameSync = function (a, b) {
    if (/video-capa\.webp$/.test(String(b))) throw Object.assign(new Error('EBUSY simulado'), { code: 'EBUSY' });
    return original.apply(this, arguments);
  };
  let r;
  try { r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso() })); } finally { fs.renameSync = original; }
  assert.strictEqual(r.estado, 'erro');
  assert.ok(/tente de novo/.test(r.mensagem), r.mensagem);
  const m = manifesto('aurora', 'protagonista');
  assert.deepStrictEqual([m.video, m.videoCapa, m.videoAssinatura], [null, null, null], 'o manifesto não pode citar um vídeo misturado');
  assert.strictEqual(pm.previasValidas(R, 'aurora', 'protagonista', ass).video, null);
  assert.ok(pm.previasValidas(R, 'aurora', 'protagonista', ass).capa, 'as imagens continuam valendo');
  assert.ok(!fs.existsSync(path.join(previasDe('aurora'), '.trabalho')));
  const de = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso() }));
  assert.strictEqual(de.estado, 'pronto');
  assert.strictEqual(pm.previasValidas(R, 'aurora', 'protagonista', ass).video, '/empresas/aurora/previas/protagonista/video.webm');
});
t('contrato para a fila: ESTADOS lista os seis, e o que a fila faz com cada um', () => {
  assert.deepStrictEqual(vm.ESTADOS, { pronto: 'pronto', 'sem-modelo': 'sem-modelo', 'sem-fonte': 'sem-fonte', erro: 'erro',
    refazer: 'recomeçar a empresa', 'sem-marca': 'parar a empresa' });
  const fonte = fs.readFileSync(path.join(__dirname, 'video-marca.js'), 'utf8');
  assert.ok(/refazer[^\n]*recomeçar a empresa/.test(fonte) && /sem-marca[^\n]*parar a empresa/.test(fonte), 'o cabeçalho diz o que a fila faz');
  assert.ok(/os arquivos podem ficar misturados até a próxima rodada/.test(fonte), 'o contrato diz a verdade sobre a falha no meio');
  assert.ok(!/nada gravado\s*\/\/\s*\(o vídeo anterior e o previas\.json ficam como estavam\)/.test(fonte), 'texto antigo, que não valia na falha da gravação');
});
t('montar.js que falha, ou MP4 curto demais para o trecho: "erro" em português; o vídeo anterior e o manifesto ficam como estavam', async () => {
  const antes = foto(previasDe('aurora'));
  let r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso({ falha: 'Error: algo quebrou\n    at x (y.js:1)\nmarca: cores.acento inválida' }) }));
  assert.strictEqual(r.estado, 'erro');
  assert.ok(/^Não consegui montar o vídeo deste estilo/.test(r.mensagem) && /cores\.acento inválida/.test(r.detalhe), JSON.stringify(r));
  r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso({ duracao: 5 }) }));
  assert.strictEqual(r.estado, 'erro');
  assert.ok(/curto demais/.test(r.detalhe), JSON.stringify(r));
  assert.deepStrictEqual(foto(previasDe('aurora')), antes);
  assert.ok(!fs.existsSync(path.join(previasDe('aurora'), '.trabalho')));
});
t('rodar de novo com a mesma marca: refaz o vídeo e os avisos do vídeo não se repetem', async () => {
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', rodarMontar: montarFalso() }));
  assert.strictEqual(r.estado, 'pronto');
  const m = manifesto('aurora', 'protagonista');
  assert.strictEqual(m.avisos.length, 4);
  assert.deepStrictEqual(fs.readdirSync(pastaEstilo('aurora', 'protagonista')).sort(), ['carrossel-01.webp', 'previas.json', 'video-capa.webp', 'video.webm']);
});
t('rodarProcesso: processo que passa do tempo-limite é encerrado (com os filhos) e volta "tempoEsgotado"', async () => {
  const t0 = Date.now();
  const r = await vm.rodarProcesso(['-e', 'require("child_process").spawn(process.execPath, ["-e", "setTimeout(()=>{}, 60000)"], { stdio: "ignore" }); setTimeout(() => {}, 60000)'], { env: process.env, limiteMs: 800 });
  assert.strictEqual(r.tempoEsgotado, true);
  assert.ok(Date.now() - t0 < 15000, 'demorou ' + (Date.now() - t0) + ' ms');
  const ok = await vm.rodarProcesso(['-e', 'console.log("oi"); console.error("ei")'], { env: process.env, limiteMs: 10000 });
  assert.deepStrictEqual([ok.status, ok.stdout.trim(), ok.stderr.trim(), ok.tempoEsgotado], [0, 'oi', 'ei', false]);
});
t('rodarProcesso: o sinal de parada encerra o processo e os filhos na hora e volta "abortado"', async () => {
  const parar = new AbortController();
  setTimeout(() => parar.abort(), 500);
  const t0 = Date.now();
  const r = await vm.rodarProcesso(['-e', 'require("child_process").spawn(process.execPath, ["-e", "setTimeout(()=>{}, 60000)"], { stdio: "ignore" }); setTimeout(() => {}, 60000)'], { env: process.env, limiteMs: 60000, sinal: parar.signal });
  assert.deepStrictEqual([r.abortado, r.tempoEsgotado], [true, false]);
  assert.ok(Date.now() - t0 < 15000, 'demorou ' + (Date.now() - t0) + ' ms');
  const ja = new AbortController();
  ja.abort();
  const antes = await vm.rodarProcesso(['-e', 'setTimeout(() => {}, 60000)'], { env: process.env, limiteMs: 60000, sinal: ja.signal });
  assert.strictEqual(antes.abortado, true, 'sinal que já veio parado: nem começa');
});
t('vídeo parado pelo sinal (pausar ou cancelar): "erro" com detalhe "abortado", nada gravado e o vídeo antigo fica', async () => {
  imagensDeHoje('aurora', 'protagonista');
  const antes = foto(pastaEstilo('aurora', 'protagonista'));
  const parar = new AbortController();
  const montar = async (args, op) => { parar.abort(); return { status: null, stdout: '', stderr: '', tempoEsgotado: false, abortado: true }; };
  const r = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', sinal: parar.signal, rodarMontar: montar }));
  assert.deepStrictEqual([r.estado, r.detalhe], ['erro', 'abortado']);
  assert.deepStrictEqual(foto(pastaEstilo('aurora', 'protagonista')), antes, 'nada mudou na pasta do estilo');
  // o sinal que para depois da montagem, antes de gravar, também não grava
  const tarde = new AbortController();
  const r2 = await vm.gerarVideoNaMarca(opcoes({ empresa: 'aurora', estilo: 'protagonista', sinal: tarde.signal,
    rodarMontar: async (a, o) => { const x = await montarFalso()(a, o); tarde.abort(); return x; } }));
  assert.deepStrictEqual([r2.estado, r2.detalhe], ['erro', 'abortado']);
  assert.deepStrictEqual(foto(pastaEstilo('aurora', 'protagonista')), antes, 'nada mudou depois da montagem');
});
t('pelo terminal: sem o vídeo de demonstração, sai 1 com a mensagem em português', () => {
  const x = spawnSync(process.execPath, [path.join(__dirname, 'video-marca.js'), 'aurora', 'protagonista', '--pedido', path.join(TMP, 'nao-tem.json')],
    { encoding: 'utf8', timeout: 60000, env: { ...process.env, FABRICA_RAIZ: R } });
  assert.strictEqual(x.status, 1, x.stdout + x.stderr);
  assert.ok(/vídeo de demonstração/.test(x.stdout + x.stderr), x.stdout + x.stderr);
});

// ---------- teste longo: o montar.js de verdade ----------
t('(longo, FABRICA_TESTE_VIDEO=1) aurora, luz-de-vela, com o montar.js de verdade sobre o vídeo de demonstração', async () => {
  if (process.env.FABRICA_TESTE_VIDEO !== '1') { console.log('     (pulado: sem FABRICA_TESTE_VIDEO=1)'); return; }
  const original = vm.pedidoDeDemonstracao();
  if (!fs.existsSync(original)) { console.log('     (pulado: o vídeo de demonstração não está neste computador)'); return; }
  // cópia do pedido com caminhos absolutos: o .cache do montar.js fica na pasta temporária, não ao lado do pedido original
  const p = JSON.parse(fs.readFileSync(original, 'utf8'));
  const base = path.dirname(original);
  for (const k of ['video', 'matte', 'palavras']) if (p[k]) p[k] = path.resolve(base, p[k]);
  for (const b of p.broll || []) b.img = path.resolve(base, b.img);
  const dir = path.join(TMP, 'demo-real');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'pedido.json'), JSON.stringify(p, null, 2));
  imagensDeHoje('aurora', 'luz-de-vela', []);
  const r = await vm.gerarVideoNaMarca({ raiz: R, empresa: 'aurora', estilo: 'luz-de-vela', pedidoDemo: path.join(dir, 'pedido.json') });
  assert.strictEqual(r.estado, 'pronto', JSON.stringify(r));
  const s = sonda(path.join(pastaEstilo('aurora', 'luz-de-vela'), 'video.webm'));
  assert.deepStrictEqual(s.streams.map((x) => x.codec_type), ['video']);
  assert.ok(Math.abs(Number(s.format.duration) - 12) < 0.3);
  const v = pm.previasValidas(R, 'aurora', 'luz-de-vela', pm.assinaturaDaMarca(R, 'aurora').assinatura);
  assert.ok(v.video, 'o vídeo da marca devia valer');
  if (process.env.FABRICA_TESTE_VIDEO_GUARDAR) {
    fs.copyFileSync(path.join(pastaEstilo('aurora', 'luz-de-vela'), 'video.webm'), process.env.FABRICA_TESTE_VIDEO_GUARDAR);
    console.log('     (vídeo guardado em ' + process.env.FABRICA_TESTE_VIDEO_GUARDAR + ')');
  }
});

(async () => {
  let falhas = 0;
  for (const [nome, fn] of lista) {
    try { await fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n       ')); }
  }
  console.log(`\n${n} ok, ${falhas} falha(s)`);
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(falhas ? 1 : 0);
})();
