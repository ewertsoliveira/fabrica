#!/usr/bin/env node
// O montar.js com --saida e --usar-marca (etapa 7, item 7.8) e o sinal aceitaMarca dos modelos. Rode:
//   node 08-FERRAMENTAS/tesseract/modelos/montar.test.js
// Não precisa do Tesseract: o montar.js roda de verdade, num processo próprio, com o Projeto do motor trocado por um falso
// (este mesmo arquivo, carregado com "node -r" e MONTAR_TESTE_MOTOR_FALSO=1), que grava o projeto como JSON das camadas e
// ações, um PNG mínimo por quadro e um "MP4" de mentira. Precisa do ffmpeg (folha de quadros do montar.js).
'use strict';
const fs = require('fs');
const path = require('path');

const MOTOR = path.join(__dirname, 'motor.js');

// ---------- modo motor falso (pré-carga do processo do montar.js) ----------
if (process.env.MONTAR_TESTE_MOTOR_FALSO === '1') {
  const real = require(MOTOR);
  // PNG 1x1 de verdade (o ffmpeg da folha de quadros precisa ler)
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const familia = (arq) => path.basename(arq).replace(/\.(ttf|otf)$/i, '').split('-')[0];
  const estiloDoNome = (arq) => {
    const s = (path.basename(arq).replace(/\.(ttf|otf)$/i, '').split('-')[1] || 'Regular').replace(/Italic$/, ' Italic').trim();
    return s === '' ? 'Italic' : s;
  };
  function ProjetoFalso(saida) {
    Object.assign(this, { saida: path.resolve(saida), W: 1080, H: 1920, camadas: [], acoes: [], id: 1, efeitoId: 5000, kfId: 0, fontes: {}, tamImg: {} });
  }
  ProjetoFalso.prototype = Object.create(real.Projeto.prototype);
  Object.assign(ProjetoFalso.prototype, {
    constructor: ProjetoFalso,
    importaVideo() { return 14500; },
    importaImagem(id, arq) {
      // com MONTAR_TESTE_IMAGENS=1, diz no log qual arquivo entrou em cada imagem (a cena do B-roll que o modelo recebeu)
      if (process.env.MONTAR_TESTE_IMAGENS === '1') console.log('imagem ' + id + ' ' + path.basename(arq || ''));
      this.tamImg[id] = this.tamImg[id] || [1080, 1920]; return this.tamImg[id];
    },
    fonte(arquivo) {
      if (this.fontes[arquivo]) return this.fontes[arquivo];
      const style = estiloDoNome(arquivo);
      this.fontes[arquivo] = { family: familia(arquivo), style, arquivo: path.isAbsolute(arquivo) ? arquivo : path.join(__dirname, 'fontes', arquivo),
        estilos: [style], italico: /italic/i.test(style) };
      return this.fontes[arquivo];
    },
    medir(textos, est) {
      const res = {};
      for (const tx of [...new Set(textos)].filter(Boolean)) {
        const w = Math.round(tx.length * est.size * 0.5);
        if (w > 1080 - 62) throw new Error('texto maior que a área de medição: ' + tx);
        res[tx] = { w, x0: 2, top: Math.round(est.size * 0.22), bottom: Math.round(est.size * 0.92) };
      }
      return res;
    },
    grava() {
      // caminhos absolutos (pasta temporária do teste) saem do JSON: a comparação é das camadas, não de onde o teste roda
      const txt = JSON.stringify({ c: this.camadas, a: this.acoes }).split(JSON.stringify(process.env.MONTAR_TESTE_BASE || '\0').slice(1, -1)).join('<base>');
      fs.writeFileSync(this.saida, txt);
      return { camadas: this.camadas.length, acoes: this.acoes.length };
    },
    quadro(t, png) { fs.writeFileSync(png, PNG); },
    exporta(mp4) { fs.writeFileSync(mp4, 'mp4 de mentira'); },
  });
  require.cache[require.resolve(MOTOR)].exports = { ...real, Projeto: ProjetoFalso };
  return;
}

// ---------- os testes ----------
const assert = require('assert');
const crypto = require('crypto');
const os = require('os');
const { spawnSync } = require('child_process');
const empresaMod = require('../../../_fabrica/core/empresa');

const MONTAR = path.join(__dirname, 'montar.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'montar-teste-'));
let n = 0;
let falhas = 0;
const t = (nome, fn) => {
  try { fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + e.message.split('\n').join('\n       ')); }
};
const sha = (arq) => crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex').slice(0, 16);
const hx = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const rgb01 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// pedido parecido com o da demonstração (vídeo de 14,5 s, B-roll de 5,3 a 10,1 s), sem vídeo de verdade: a cena do B-roll
// já está no .cache (o montar.js não abre o navegador) e o Projeto falso não lê o vídeo
function pastaDoPedido(nome, extra = {}) {
  const dir = path.join(TMP, nome);
  fs.mkdirSync(path.join(dir, '.cache'), { recursive: true });
  const fala = 'Ordem na semana começa bem cedo eu planejo três tarefas por dia e deixo o resto para depois sem culpa assim a semana anda';
  fs.writeFileSync(path.join(dir, 'palavras.json'), JSON.stringify(fala.split(' ').map((w, i) => ({ w, ini: 3300 + i * 330, fim: 3300 + i * 330 + 280 }))));
  fs.writeFileSync(path.join(dir, '.cache', 'cena-0-xicara.png'), 'cena pronta');
  const pedido = { video: 'video.mp4', palavras: 'palavras.json', chamada: { texto: 'Ordem na semana', palavra: 'Ordem', ini: 0.5, fim: 3.2 },
    destaques: ['planejo'], broll: [{ img: 'xicara.png', ini: 5.3, fim: 10.1 }], palavraTela: { texto: 'ORGANIZE', ini: 12.9, fim: 14.5 },
    rosto: { y: 820 }, anotacao: 'três por dia', ...extra };
  fs.writeFileSync(path.join(dir, 'pedido.json'), JSON.stringify(pedido, null, 2));
  return dir;
}
function roda(args, env = {}) {
  const e = { ...process.env, MONTAR_TESTE_MOTOR_FALSO: '1', MONTAR_TESTE_BASE: TMP, ...env };
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete e[k];
  return spawnSync(process.execPath, ['-r', __filename, MONTAR, ...args], { encoding: 'utf8', timeout: 120000, env: e });
}
const arquivos = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []);

// Impressão digital (sha256, 16 caracteres) do projeto que o montar.js do commit e9dc7b8 (antes deste item) grava com este
// motor falso e este pedido, sem opções novas: "sem as opções, tudo igual a hoje". As duas mudaram DE PROPÓSITO pela decisão
// D7 C do responsável (a frase que atravessa a borda do B-roll é cortada/troca de cor na borda, também sem marca): a da
// Vitrine no item 6.6B (era a5259bcee64406a9) e a do Protagonista no item 6.6A (era 453c3e295baf6bbe; na correção do 6.6A,
// era 1b886910cc223a25: o trecho que sobra do corte com menos de 150 ms sai e o destaque já dito não cresce de novo depois
// da borda). As opções do montar.js não mudaram.
const DIGITAIS_ANTES = { protagonista: '63966a7f635a63f7', vitrine: '8208e103b24ea946' };

// ---------- sem as opções novas: igual a hoje ----------
for (const modelo of ['protagonista', 'vitrine']) {
  t(`${modelo}, sem --saida nem --usar-marca: tudo em saida/ ao lado do pedido, projeto igual ao de antes`, () => {
    const dir = pastaDoPedido('sem-opcoes-' + modelo);
    const r = roda([modelo, path.join(dir, 'pedido.json'), '--exportar']);
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
    assert.deepStrictEqual(arquivos(path.join(dir, 'saida')), [`${modelo}-quadros.png`, `${modelo}.mp4`, `${modelo}.tsrct`]);
    assert.ok(!/marca-usada/.test(r.stdout), 'sem --usar-marca o montar.js não fala da marca');
    const digital = sha(path.join(dir, 'saida', modelo + '.tsrct'));
    if (process.argv.includes('--digitais')) console.log(`     ${modelo}: '${digital}'`);
    assert.strictEqual(digital, DIGITAIS_ANTES[modelo], 'o projeto sem as opções novas mudou');
  });
}

// ---------- cena lisa do Palco (item 6.6B, decisão D6 B) ----------
t('Palco com marca: a cena do B-roll vem do arquivo de fundo liso no claro da marca; sem marca e nos outros modelos, a de sempre', () => {
  const dir = pastaDoPedido('cena-lisa', { marca: { cores: { escuro: hx(58, 31, 20), claro: hx(255, 241, 224), acento: hx(242, 153, 74) } } });
  // a cena lisa já pronta no .cache (o montar.js não abre o navegador): o nome leva a cor
  fs.writeFileSync(path.join(dir, '.cache', 'cena-0-xicara-fff1e0.png'), 'cena lisa pronta');
  const env = { MONTAR_TESTE_IMAGENS: '1' };
  const r = roda(['palco', path.join(dir, 'pedido.json')], env);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(/imagem cena-0 cena-0-xicara-fff1e0\.png/.test(r.stdout), r.stdout);
  const v = roda(['vitrine', path.join(dir, 'pedido.json')], env);
  assert.ok(/imagem cena-0 cena-0-xicara\.png/.test(v.stdout), v.stdout);
  const sem = pastaDoPedido('cena-lisa-sem-marca');
  const s = roda(['palco', path.join(sem, 'pedido.json')], env);
  assert.ok(/imagem cena-0 cena-0-xicara\.png/.test(s.stdout), s.stdout);
});

// ---------- --saida ----------
t('--saida: projeto, MP4 e folha de quadros na pasta pedida; nada em saida/ ao lado do pedido; o .cache continua ao lado do pedido', () => {
  const dir = pastaDoPedido('com-saida');
  const fora = path.join(TMP, 'trabalho', 'protagonista');
  const r = roda(['protagonista', path.join(dir, 'pedido.json'), '--exportar', '--saida', fora]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(!fs.existsSync(path.join(dir, 'saida')), 'saida/ ao lado do pedido não devia nem ser criada');
  assert.deepStrictEqual(arquivos(fora), ['protagonista-quadros.png', 'protagonista.mp4', 'protagonista.tsrct']);
  assert.deepStrictEqual(arquivos(path.join(dir, '.cache')), ['cena-0-xicara.png']);
  assert.strictEqual(sha(path.join(fora, 'protagonista.tsrct')), DIGITAIS_ANTES.protagonista, 'mudar a pasta não muda o projeto');
});
t('--saida sem pasta, ou seguido de outra opção: recusado com o uso, nada gravado', () => {
  const dir = pastaDoPedido('saida-vazia');
  for (const args of [['--saida'], ['--saida', '--exportar']]) {
    const r = roda(['protagonista', path.join(dir, 'pedido.json'), ...args]);
    assert.strictEqual(r.status, 1, r.stdout + r.stderr);
    assert.ok(/uso: node montar\.js/.test(r.stderr), r.stderr);
  }
  assert.ok(!fs.existsSync(path.join(dir, 'saida')));
});

// ---------- --usar-marca ----------
// raiz temporária com duas empresas fictícias (cores montadas aqui; letras OFL de fontes/)
const ACENTO_AURORA = hx(200, 30, 110);
const ACENTO_BOREAL = hx(0, 150, 230);
const MARCAS = {
  aurora: { cores: { escuro: hx(58, 30, 20), claro: hx(255, 243, 228), acento: ACENTO_AURORA, neutro: hx(176, 125, 98) }, principal: 'DMSerifDisplay-Regular.ttf', mono: 'DMMono-Medium.ttf' },
  boreal: { cores: { escuro: hx(14, 42, 59), claro: hx(234, 246, 248), acento: ACENTO_BOREAL, neutro: hx(94, 124, 140) }, principal: 'DMSans-Medium.ttf', mono: 'JetBrainsMono-Bold.ttf' },
};
const RAIZ = path.join(TMP, 'raiz');
fs.mkdirSync(RAIZ, { recursive: true });
for (const [c, nome] of [['aurora', 'Aurora Teste'], ['boreal', 'Boreal Teste']]) {
  empresaMod.criar(c, nome, RAIZ);
  const m = MARCAS[c];
  const dir = path.join(RAIZ, 'empresas', c);
  fs.mkdirSync(path.join(dir, 'fontes'), { recursive: true });
  for (const p of ['principal', 'mono']) fs.copyFileSync(path.join(__dirname, 'fontes', m[p]), path.join(dir, 'fontes', p + '.ttf'));
  fs.writeFileSync(path.join(dir, 'marca.yaml'), ['empresa:', `  nome: "${nome}"`, 'cores:', ...Object.entries(m.cores).map(([k, v]) => `  ${k}: "${v}"`),
    'tipografia:', '  principal:', '    arquivo: "fontes/principal.ttf"', '  mono:', '    arquivo: "fontes/mono.ttf"', ''].join('\n'));
}
const envDa = (c) => ({ FABRICA_RAIZ: RAIZ, FABRICA_EMPRESA: c, FABRICA_MARCA: undefined, FABRICA_SILENCIO_EXEMPLO: '1' });
const temCor = (txt, h) => { const [r, g, b] = rgb01(h); return txt.includes(JSON.stringify([r, g, b, 1]).slice(0, -3)); };
const marcaUsada = (stdout) => {
  const l = stdout.split(/\r?\n/).find((x) => x.startsWith('marca-usada '));
  return l ? JSON.parse(l.slice('marca-usada '.length)) : null;
};

t('--usar-marca: a marca da empresa do ambiente, sem mexer no pedido; linha "marca-usada" com o arquivo, as cores e as letras', () => {
  const dir = pastaDoPedido('usar-marca');
  const pedido = path.join(dir, 'pedido.json');
  const antes = fs.readFileSync(pedido);
  const fora = path.join(TMP, 'trabalho-aurora');
  const r = roda(['protagonista', pedido, '--saida', fora, '--usar-marca'], envDa('aurora'));
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.ok(fs.readFileSync(pedido).equals(antes), 'o pedido não pode ser mexido');
  const u = marcaUsada(r.stdout);
  assert.ok(u, 'faltou a linha marca-usada:\n' + r.stdout);
  assert.strictEqual(path.resolve(u.arquivo).toLowerCase(), path.join(RAIZ, 'empresas', 'aurora', 'marca.yaml').toLowerCase());
  assert.strictEqual(u.exemplo, false);
  assert.deepStrictEqual(u.cores, MARCAS.aurora.cores);
  assert.strictEqual(path.resolve(u.fontes.principal).toLowerCase(), path.join(RAIZ, 'empresas', 'aurora', 'fontes', 'principal.ttf').toLowerCase());
  assert.strictEqual(u.fontes.acento, null);
  const proj = fs.readFileSync(path.join(fora, 'protagonista.tsrct'), 'utf8');
  assert.ok(temCor(proj, ACENTO_AURORA), 'o acento da aurora não chegou ao projeto');
  assert.ok(!temCor(proj, ACENTO_BOREAL), 'cor da boreal no projeto da aurora');
  assert.notStrictEqual(sha(path.join(fora, 'protagonista.tsrct')), DIGITAIS_ANTES.protagonista);
});
t('--usar-marca vence a marca escrita no pedido (a do pedido seria de outra empresa)', () => {
  const dir = pastaDoPedido('usar-marca-vence', { marca: { cores: { acento: ACENTO_BOREAL } } });
  const fora = path.join(TMP, 'trabalho-vence');
  const r = roda(['protagonista', path.join(dir, 'pedido.json'), '--saida', fora, '--usar-marca'], envDa('aurora'));
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(marcaUsada(r.stdout).cores, MARCAS.aurora.cores);
  const proj = fs.readFileSync(path.join(fora, 'protagonista.tsrct'), 'utf8');
  assert.ok(temCor(proj, ACENTO_AURORA) && !temCor(proj, ACENTO_BOREAL));
});
t('--usar-marca com a boreal no ambiente: as cores da boreal, nenhuma da aurora', () => {
  const dir = pastaDoPedido('usar-marca-boreal');
  const fora = path.join(TMP, 'trabalho-boreal');
  const r = roda(['protagonista', path.join(dir, 'pedido.json'), '--saida', fora, '--usar-marca'], envDa('boreal'));
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  assert.deepStrictEqual(marcaUsada(r.stdout).cores, MARCAS.boreal.cores);
  const proj = fs.readFileSync(path.join(fora, 'protagonista.tsrct'), 'utf8');
  assert.ok(temCor(proj, ACENTO_BOREAL) && !temCor(proj, ACENTO_AURORA));
});

// ---------- o corte do trecho no .cache (motor.preparaTrecho) ----------
// correção: numa instalação nova a pasta texturas/ não existe (fica fora do git) e o Luz de Vela parava com um erro do
// Tesseract. O motor gera as texturas que faltam uma vez só, e não mexe em imagens de fora da pasta de texturas.
t('garantirTextura: textura que falta é gerada uma vez; existente ou de fora da pasta não roda o gerador', () => {
  const { garantirTextura } = require(MOTOR);
  const pasta = path.join(TMP, 'texturas');
  const cont = path.join(TMP, 'gerador-rodou.txt');
  const programa = path.join(TMP, 'gerador-falso.js');
  fs.writeFileSync(programa, `const fs=require('fs');fs.mkdirSync(${JSON.stringify(pasta)},{recursive:true});` +
    `fs.writeFileSync(${JSON.stringify(path.join(pasta, 'luz-dourada.png'))},'x');fs.appendFileSync(${JSON.stringify(cont)},'1');`);
  const opc = { programa, pasta };
  assert.strictEqual(garantirTextura(path.join(pasta, 'luz-dourada.png'), opc), true);
  assert.strictEqual(garantirTextura(path.join(pasta, 'luz-dourada.png'), opc), false);
  assert.strictEqual(garantirTextura(path.join(TMP, 'outra', 'cena.png'), opc), false);
  assert.strictEqual(fs.readFileSync(cont, 'utf8'), '1', 'o gerador deveria rodar uma vez só');
  assert.throws(() => garantirTextura(path.join(pasta, 'nao-existe.png'), opc), /não a desenha/);
});

// correção: o corte vai para um temporário e troca de nome no fim; processo morto no meio não deixa um MP4 pela metade com
// o nome final (que seria reaproveitado para sempre), e temporário de processo que já morreu é apagado na rodada seguinte
t('preparaTrecho: processo morto no meio do corte não deixa o MP4 final; a rodada seguinte corta de novo e limpa a sobra', () => {
  const dir = path.join(TMP, 'corte');
  fs.mkdirSync(dir, { recursive: true });
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=s=1080x1920:d=40:r=30', '-f', 'lavfi', '-i', 'sine=d=40',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'fonte.mp4')], { encoding: 'utf8' });
  assert.strictEqual(ff.status, 0, ff.stderr);
  fs.writeFileSync(path.join(dir, 'palavras.json'), '[]');
  const pedido = { video: 'fonte.mp4', palavras: 'palavras.json', trecho: { ini: 0, fim: 38 } };
  const cache = path.join(dir, '.cache');
  const final = path.join(cache, 'video-0-38.mp4');
  // um processo que corta e é morto logo depois de começar (o ffmpeg com crf 16 em 1080x1920 leva alguns segundos)
  const codigo = `require(${JSON.stringify(MOTOR)}).preparaTrecho(${JSON.stringify(pedido)}, ${JSON.stringify(dir)})`;
  const filho = require('child_process').spawn(process.execPath, ['-e', codigo], { stdio: 'ignore', windowsHide: true });
  const espera = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(()=>{},${ms})`]);
  const t0 = Date.now();
  while (Date.now() - t0 < 20000 && !(fs.existsSync(cache) && fs.readdirSync(cache).length)) espera(200);
  espera(800);
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(filho.pid), '/T', '/F'], { stdio: 'ignore' }); else filho.kill('SIGKILL');
  espera(800);
  const sobras = fs.readdirSync(cache);
  assert.ok(!fs.existsSync(final), 'o MP4 final não pode existir depois de o corte morrer no meio: ' + sobras.join(','));
  assert.ok(sobras.some((f) => /\.tmp-\d+\.mp4$/.test(f)), 'devia sobrar só o temporário: ' + sobras.join(','));
  // a rodada seguinte corta de novo, inteiro, e apaga o temporário do processo morto
  const tr = require(MOTOR).preparaTrecho(pedido, dir);
  assert.strictEqual(path.resolve(tr.video), final);
  const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', final], { encoding: 'utf8' }).stdout);
  assert.ok(Math.abs(dur - 38) < 0.2, 'duração ' + dur);
  assert.deepStrictEqual(fs.readdirSync(cache), ['video-0-38.mp4']);
  // um corte que já existe é reaproveitado (o mesmo arquivo, sem cortar de novo)
  const antes = fs.statSync(final).mtimeMs;
  require(MOTOR).preparaTrecho(pedido, dir);
  assert.strictEqual(fs.statSync(final).mtimeMs, antes);
});

// ---------- aceitaMarca ----------
const MODELOS = JSON.parse(('[' + /const MODELOS = \[([\s\S]*?)\];/.exec(fs.readFileSync(MONTAR, 'utf8'))[1] + ']')
  .replace(/\/\/[^\n]*/g, '').replace(/'/g, '"'));
t('aceitaMarca: true nos 27 modelos, e todo modelo com aceitaMarca lê a marca (ctx.marca, direto ou pela base _inverso)', () => {
  assert.strictEqual(MODELOS.length, 27);
  const inverso = fs.readFileSync(path.join(__dirname, 'estilos', '_inverso.js'), 'utf8');
  assert.ok(/marca = null/.test(inverso) && /aceitaMarca: true/.test(inverso), 'a base _inverso lê a marca e declara aceitaMarca');
  for (const nome of MODELOS) {
    const m = require('./estilos/' + nome);
    assert.strictEqual(m.aceitaMarca, true, `${nome}: falta aceitaMarca: true`);
    const fonte = fs.readFileSync(path.join(__dirname, 'estilos', nome + '.js'), 'utf8');
    const leMarca = /criaModelo\(/.test(fonte) ? true : /marca = null/.test(fonte) && /temaMarca\./.test(fonte);
    assert.ok(leMarca, `${nome}: declara aceitaMarca mas não lê ctx.marca`);
  }
  // o sinal não muda o que o modelo monta (as impressões digitais dos testes inverso, lote-a, lote-b e todos-na-marca)
  assert.deepStrictEqual(Object.keys(require('./estilos/_inverso.js')({ nome: 'x', fontes: {}, cores: {} })).sort(), ['aceitaMarca', 'capa', 'descricao', 'montar', 'nome', 'quadros']);
});

console.log(`\n${n} ok, ${falhas} falha(s)`);
for (const f of fs.readdirSync(TMP)) fs.rmSync(path.join(TMP, f), { recursive: true, force: true });
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(falhas ? 1 : 0);
