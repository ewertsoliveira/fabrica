#!/usr/bin/env node
// Ponta a ponta das prévias na marca (etapa 7, item 7.9). Rode:
//   node 08-FERRAMENTAS/biblioteca/ponta-a-ponta.test.js   (precisa do Chromium e do ffmpeg; leva alguns minutos)
// Numa raiz temporária com a pasta antiga (principal), aurora (quente) e boreal (fria), com dois estilos de verdade
// (protagonista e primeira-pagina): o painel (servidor neste processo) abre a biblioteca, pede as prévias da aurora, troca
// para a boreal no meio da geração e pede as dela também, muda a marca da aurora no meio, mata o trabalhador (com os
// processos filhos) e pede de novo. O trabalhador é o de verdade (fila-marca.js rodar, com o gerar-previas.js de verdade);
// só o montar.js do vídeo é trocado por um MP4 sintético da cor do acento da empresa (o vídeo real fica fora do teste).
// Este arquivo é também a pré-carga (node -r) do trabalhador lançado pelo teste: com PONTA_A_PONTA_PEDIDO no ambiente, ele
// só troca o montar.js e o pedido de demonstração do vídeo na marca, e não roda teste nenhum.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const RAIZ_CODIGO = path.join(__dirname, '..', '..');
const LAB = '04-LABORATORIO-DE-DESIGN';
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
const ffmpeg = (args) => { const x = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' }); if (x.status !== 0) throw new Error('ffmpeg: ' + x.stderr); };

// ---------- modo pré-carga do trabalhador ----------
// O montar.js de teste: grava <saida>/<modelo>.mp4 da cor do acento da marca de hoje da empresa (lida como a assinatura a
// lê) e fala como o de verdade (a linha "marca-usada"). Espera um pouco, para o vídeo ter um "meio".
function prepararTrabalhador() {
  const pm = require('./previas-marca');
  const empresaMod = require('../../_fabrica/core/empresa');
  const vm = require('./video-marca');
  const original = vm.gerarVideoNaMarca;
  const montarFalso = async (args, { env }) => {
    const c = env.FABRICA_EMPRESA;
    const r = env.FABRICA_RAIZ;
    const saida = args[args.indexOf('--saida') + 1];
    const modelo = args[1];
    const inst = pm.instantaneoDaMarca(r, c);
    const cores = inst.dados.cores;
    await dormir(1500);
    fs.mkdirSync(saida, { recursive: true });
    ffmpeg(['-f', 'lavfi', '-i', `color=c=0x${String(cores.acento).replace('#', '')}:s=540x960:d=14.5:r=30`, '-c:v', 'libx264', '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p', path.join(saida, modelo + '.mp4')]);
    const marca = { arquivo: empresaMod.caminhos(c, r).marca, exemplo: false, empresa: c, cores,
      fontes: Object.fromEntries(['principal', 'mono', 'acento'].map((p) => [p, inst.letras[p].arquivo])), principalItalico: false };
    return { status: 0, tempoEsgotado: false, stdout: `marca-usada ${JSON.stringify(marca)}\n`, stderr: '' };
  };
  vm.gerarVideoNaMarca = (op) => original({ ...op, pedidoDemo: process.env.PONTA_A_PONTA_PEDIDO, rodarMontar: montarFalso });
}

// só como pré-carga (node -r): rodado direto, é sempre o teste, mesmo com PONTA_A_PONTA_PEDIDO no ambiente
if (process.env.PONTA_A_PONTA_PEDIDO && require.main !== module) prepararTrabalhador();
else principal().catch((e) => { console.error(e); process.exitCode = 1; });

// ---------- o teste ----------
async function principal() {
  process.env.FABRICA_SILENCIO_EXEMPLO = '1';
  for (const v of ['FABRICA_EMPRESA', 'FABRICA_MARCA', 'FABRICA_RAIZ', 'FABRICA_FILA_VEZ', 'FABRICA_PEDIDO_DEMONSTRACAO']) delete process.env[v];
  const empresaMod = require('../../_fabrica/core/empresa');
  const pm = require('./previas-marca');
  const fila = require('./fila-marca');
  const { criarServidor } = require('../../_fabrica/paineis/servidor');

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ponta-a-ponta-'));
  const R = path.join(TMP, 'raiz');
  const FONTES = path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
  const IDS = ['primeira-pagina', 'protagonista'];
  const hx = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  // cores montadas em código (o validador não aceita hex solto fora de teste isento); acentos bem longe uns dos outros
  const ACENTO_AURORA = [200, 30, 110];
  // o acento novo da aurora é um verde: a foto da capa do Protagonista tem um livro de cor quente (um acento novo quente
  // daria pixels "da aurora" na capa da boreal vindos da foto, visto: ~990 pixels), e nenhum verde
  const ACENTO_AURORA_NOVO = [40, 170, 60];
  const ACENTO_BOREAL = [0, 150, 230];
  const MARCAS = {
    aurora: { nome: 'Aurora Nutrição', conta: 'aurora.nutricao', cores: { escuro: hx(58, 30, 20), claro: hx(255, 243, 228), acento: hx(...ACENTO_AURORA), neutro: hx(176, 125, 98) }, letras: { principal: 'DMSerifDisplay-Regular.ttf', mono: 'DMMono-Medium.ttf' } },
    boreal: { nome: 'Boreal Finanças', conta: 'boreal.financas', cores: { escuro: hx(14, 42, 59), claro: hx(234, 246, 248), acento: hx(...ACENTO_BOREAL), neutro: hx(94, 124, 140) }, letras: { principal: 'DMSans-Medium.ttf', mono: 'JetBrainsMono-Bold.ttf' } },
  };
  const yamlDaMarca = (m) => ['empresa:', `  nome: "${m.nome}"`, `  handle: "${m.conta}"`, 'cores:', ...Object.entries(m.cores).map(([p, v]) => `  ${p}: "${v}"`), 'tipografia:',
    ...['principal', 'mono', 'acento'].flatMap((p) => [`  ${p}:`, `    arquivo: "${m.letras[p] ? 'fontes/' + p + '.ttf' : ''}"`]), ''].join('\n');
  function colocarMarca(codigo, m, dir = path.join(R, 'empresas', codigo)) {
    fs.mkdirSync(path.join(dir, 'fontes'), { recursive: true });
    for (const [p, f] of Object.entries(m.letras)) fs.copyFileSync(path.join(FONTES, f), path.join(dir, 'fontes', p + '.ttf'));
    fs.writeFileSync(path.join(dir, 'marca.yaml'), yamlDaMarca(m));
  }
  const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
  function foto(dir, { fora = [] } = {}) {
    const mapa = {};
    if (!fs.existsSync(dir)) return mapa;
    const varrer = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const a = path.join(d, e.name);
        const rel = path.relative(dir, a).split(path.sep).join('/');
        if (fora.some((f) => rel === f || rel.startsWith(f + '/'))) continue;
        if (e.isDirectory()) varrer(a); else mapa[rel] = sha(fs.readFileSync(a));
      }
    };
    varrer(dir);
    return mapa;
  }
  const copiarPasta = (de, para) => fs.cpSync(de, para, { recursive: true });

  // ---- a raiz: pasta antiga (principal), aurora e boreal, dois estilos de verdade com as prévias base ----
  fs.mkdirSync(path.join(R, '06-MARCA-E-FOTOS', 'fontes'), { recursive: true });
  fs.writeFileSync(path.join(R, '06-MARCA-E-FOTOS', 'marca.yaml'), yamlDaMarca({ ...MARCAS.boreal, nome: 'Empresa Antiga', conta: 'empresa.antiga' }).replace(/fontes\//g, '06-MARCA-E-FOTOS/fontes/'));
  for (const [p, f] of Object.entries(MARCAS.boreal.letras)) fs.copyFileSync(path.join(FONTES, f), path.join(R, '06-MARCA-E-FOTOS', 'fontes', p + '.ttf'));
  fs.mkdirSync(path.join(R, LAB, 'laboratorio'), { recursive: true });
  fs.writeFileSync(path.join(R, LAB, 'laboratorio', 'peca-antiga.html'), '<p>peça da pasta antiga</p>\n');
  for (const id of IDS) {
    copiarPasta(path.join(RAIZ_CODIGO, LAB, 'estilos', id), path.join(R, LAB, 'estilos', id));
    copiarPasta(path.join(RAIZ_CODIGO, LAB, 'biblioteca', 'previas', id), path.join(R, LAB, 'biblioteca', 'previas', id));
  }
  fs.copyFileSync(path.join(RAIZ_CODIGO, LAB, 'biblioteca', 'vocabulario.json'), path.join(R, LAB, 'biblioteca', 'vocabulario.json'));
  empresaMod.criar('aurora', MARCAS.aurora.nome, R);
  empresaMod.criar('boreal', MARCAS.boreal.nome, R);
  colocarMarca('aurora', MARCAS.aurora);
  colocarMarca('boreal', MARCAS.boreal);
  empresaMod.ativar('boreal', R); // a empresa ativa do agente: o painel e o trabalhador nunca a trocam

  // vídeo de demonstração de mentira (o trabalhador só o usa pelo pedido; o montar.js é o falso)
  const DEMO = path.join(TMP, 'demo');
  fs.mkdirSync(DEMO, { recursive: true });
  ffmpeg(['-f', 'lavfi', '-i', 'testsrc=s=320x568:d=15:r=30', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', path.join(DEMO, 'video.mp4')]);
  fs.copyFileSync(path.join(DEMO, 'video.mp4'), path.join(DEMO, 'matte.mp4'));
  fs.writeFileSync(path.join(DEMO, 'palavras.json'), '[]');
  fs.copyFileSync(path.join(RAIZ_CODIGO, LAB, 'estilos', '_demo', 'fotos', 'xicara.jpg'), path.join(DEMO, 'xicara.jpg'));
  const PEDIDO = path.join(DEMO, 'pedido-demonstracao.json');
  fs.writeFileSync(PEDIDO, JSON.stringify({ liberado: true, video: 'video.mp4', matte: 'matte.mp4', palavras: 'palavras.json', trecho: { ini: 0, fim: 14.5 },
    chamada: { texto: 'Ordem na semana', palavra: 'Ordem', ini: 0.5, fim: 3.2 }, broll: [{ img: 'xicara.jpg', ini: 5.3, fim: 10.1 }] }, null, 2));

  // fotos do que nunca pode mudar
  const PREVIAS_BASE_CODIGO = path.join(RAIZ_CODIGO, LAB, 'biblioteca', 'previas');
  const baseCodigo = foto(PREVIAS_BASE_CODIGO);
  const DA_EMPRESA = ['empresas/aurora/previas', 'empresas/boreal/previas', 'empresas/.fila-previas.json', 'empresas/.fila-previas-presas.json'];
  const raizAntes = foto(R, { fora: DA_EMPRESA });
  assert.ok(Object.keys(raizAntes).some((k) => k.startsWith(`${LAB}/biblioteca/previas/protagonista/`)), 'a raiz precisa das prévias base');
  assert.ok(Object.keys(raizAntes).includes('06-MARCA-E-FOTOS/marca.yaml'), 'a raiz precisa da pasta antiga');
  assert.ok(empresaMod.listar(R).some((e) => e.codigo === 'principal'), 'a pasta antiga é uma empresa da lista');

  // ---- o trabalhador de verdade, lançado pelo painel com esta pré-carga ----
  const lancados = [];
  const lancar = ({ raiz, args, env }) => {
    const log = fs.openSync(path.join(TMP, `trabalhador-${lancados.length + 1}.log`), 'a');
    const filho = spawn(process.execPath, ['-r', __filename, ...args], { cwd: raiz, env: { ...env, PONTA_A_PONTA_PEDIDO: PEDIDO }, stdio: ['ignore', log, log], windowsHide: true });
    filho.saiu = new Promise((ok) => filho.once('exit', ok));
    lancados.push(filho);
    return filho.pid;
  };
  const matarArvore = async (filho) => {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(filho.pid), '/T', '/F'], { encoding: 'utf8' });
    else try { process.kill(filho.pid, 'SIGKILL'); } catch { /* já saiu */ }
    await Promise.race([filho.saiu, dormir(15000)]);
  };
  const srv = criarServidor(R, { lancarTrabalhador: lancar });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const porta = srv.address().port;
  const pedir = (metodo, caminho, corpo) => new Promise((resolve, reject) => {
    const dados = corpo === undefined ? null : Buffer.from(JSON.stringify(corpo));
    const req = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: dados ? { 'Content-Type': 'application/json', 'Content-Length': dados.length } : {} }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => {
        const corpoBruto = Buffer.concat(partes);
        let json = null;
        try { json = JSON.parse(corpoBruto.toString('utf8')); } catch { /* imagem */ }
        resolve({ status: res.statusCode, headers: res.headers, texto: corpoBruto.toString('latin1'), json, bruto: corpoBruto });
      });
    });
    req.on('error', reject);
    if (dados) req.write(dados);
    req.end();
  });
  const biblioteca = async (c) => { const x = await pedir('GET', `/api/biblioteca?empresa=${c}`); assert.strictEqual(x.status, 200, x.texto); return x; };
  const estado = async (c) => { const x = await pedir('GET', `/api/previas-marca?empresa=${c}`); assert.strictEqual(x.status, 200, x.texto); return x.json; };
  const acao = async (c, a) => { const x = await pedir('POST', '/api/previas-marca', { acao: a, empresa: c }); assert.strictEqual(x.status, 200, x.texto); return x.json; };
  const lerFila = (c) => { try { return JSON.parse(fs.readFileSync(path.join(R, 'empresas', c, 'previas', 'fila.json'), 'utf8')); } catch { return null; } };
  const manifesto = (c, id) => { try { return JSON.parse(fs.readFileSync(path.join(R, 'empresas', c, 'previas', id, 'previas.json'), 'utf8')); } catch { return null; } };
  const logs = () => fs.readdirSync(TMP).filter((f) => f.endsWith('.log')).map((f) => `--- ${f}\n` + fs.readFileSync(path.join(TMP, f), 'utf8').slice(-3000)).join('\n');
  async function esperar(cond, limiteMs, oQue) {
    const fim = Date.now() + limiteMs;
    for (;;) {
      const v = await cond();
      if (v) return v;
      if (Date.now() > fim) throw new Error(`Esperei demais por: ${oQue}\n${JSON.stringify({ aurora: lerFila('aurora'), boreal: lerFila('boreal') }, null, 1).slice(0, 4000)}\n${logs()}`);
      await dormir(500);
    }
  }
  // Nenhuma prévia de outra marca como "Na sua marca": todo estilo com previasMarca tem o manifesto da marca de hoje e da
  // empresa, e todo endereço é da pasta da empresa.
  function conferirCatalogo(c, corpo, hoje) {
    const outra = c === 'aurora' ? 'boreal' : 'aurora';
    assert.strictEqual(corpo.json.empresa, c);
    assert.ok(!new RegExp(outra, 'i').test(corpo.texto), `o catálogo da ${c} cita a ${outra}`);
    for (const e of corpo.json.estilos) {
      if (e.previasMarca === null) continue;
      const m = manifesto(c, e.id);
      assert.ok(m && m.cores === 'marca' && m.empresa === c && m.assinatura === hoje, `${c}/${e.id}: "na sua marca" com uma prévia que não é da marca de hoje: ${JSON.stringify(m && { cores: m.cores, empresa: m.empresa, assinatura: m.assinatura })}`);
      const enderecos = JSON.stringify(e.previasMarca).match(/"\/[^"]*"/g) || [];
      assert.ok(enderecos.length > 0);
      for (const u of enderecos) assert.ok(u.startsWith(`"/empresas/${c}/previas/${e.id}/`), `${c}/${e.id}: endereço de fora da pasta da empresa: ${u}`);
      if (e.videoMarca === 'pronto') assert.strictEqual(m.videoAssinatura, hoje, `${c}/${e.id}: vídeo de outra marca como pronto`);
    }
  }

  let ok = false;
  try {
    // 1. Abrir a biblioteca da aurora: marca definida, nada na marca ainda.
    const ass1 = pm.assinaturaDaMarca(R, 'aurora').assinatura;
    let b = await biblioteca('aurora');
    assert.deepStrictEqual([b.json.marca.definida, b.json.marca.naMarca, b.json.marca.progresso.estado], [true, false, 'nada']);
    assert.deepStrictEqual(b.json.estilos.map((e) => e.id).sort(), IDS);
    assert.ok(b.json.estilos.every((e) => e.previasMarca === null));
    console.log('  ok  1. biblioteca da aurora aberta: marca definida, nada na marca');

    // 2. Pedir as prévias da aurora: um trabalhador lançado.
    let e = await acao('aurora', 'gerar');
    assert.strictEqual(e.empresa, 'aurora');
    assert.strictEqual(lancados.length, 1, 'gerar lança o trabalhador');
    await esperar(async () => ['imagens', 'videos'].includes((await estado('aurora')).estado), 60000, 'a aurora começar');
    console.log('  ok  2. prévias da aurora pedidas; trabalhador lançado');

    // 3. Trocar de empresa no meio da geração: a boreal não vê nada da aurora e pede as dela; nenhum segundo trabalhador.
    const bb = await biblioteca('boreal');
    conferirCatalogo('boreal', bb, pm.assinaturaDaMarca(R, 'boreal').assinatura);
    assert.deepStrictEqual([bb.json.marca.naMarca, bb.json.marca.progresso.estado], [false, 'nada']);
    const eb = await estado('boreal');
    assert.strictEqual(eb.trabalhador, false, 'o estado da boreal não revela que a aurora está gerando');
    assert.ok(!/aurora/i.test(JSON.stringify(eb)));
    e = await acao('boreal', 'gerar');
    assert.strictEqual(lancados.length, 1, 'com o trabalhador vivo, o pedido da boreal não lança outro');
    console.log('  ok  3. troca para a boreal no meio: nada da aurora, pedido da boreal sem segundo trabalhador');

    // 4. A primeira prévia da aurora fica pronta na marca de hoje; então a marca da aurora muda.
    await esperar(async () => { const f = lerFila('aurora'); return f && f.imagens.feitos >= 1 && IDS.some((id) => manifesto('aurora', id)); }, 10 * 60000, 'a primeira prévia da aurora');
    b = await biblioteca('aurora');
    conferirCatalogo('aurora', b, ass1);
    assert.strictEqual(b.json.marca.naMarca, true, 'a primeira prévia da aurora já vale na marca de hoje');
    colocarMarca('aurora', { ...MARCAS.aurora, cores: { ...MARCAS.aurora.cores, acento: hx(...ACENTO_AURORA_NOVO) } });
    const ass2 = pm.assinaturaDaMarca(R, 'aurora').assinatura;
    assert.notStrictEqual(ass2, ass1);
    b = await biblioteca('aurora');
    conferirCatalogo('aurora', b, ass2);
    assert.ok(b.json.estilos.every((x) => x.previasMarca === null), 'marca mudada: nenhuma prévia velha como "Na sua marca"');
    assert.deepStrictEqual([b.json.marca.naMarca, b.json.marca.desatualizada], [false, true]);
    console.log('  ok  4. marca da aurora mudada no meio: nenhuma prévia velha vale');

    // 5. O trabalhador recomeça a aurora com a marca nova; ele morre no meio das imagens (com os processos filhos).
    await esperar(() => { const f = lerFila('aurora'); return f && f.assinatura === ass2 && f.imagens.estado === 'fazendo'; }, 10 * 60000, 'a aurora recomeçar com a marca nova');
    await dormir(4000);
    const morto = lancados[0];
    await matarArvore(morto);
    assert.ok(morto.exitCode !== null || morto.signalCode !== null, 'o trabalhador devia ter morrido');
    assert.strictEqual(fila.trabalhadorVivo(R), false);
    const presa = lerFila('aurora');
    assert.strictEqual(presa.imagens.estado, 'fazendo', 'quem morreu no meio deixa o item "fazendo"');
    e = await estado('aurora');
    assert.strictEqual(e.trabalhador, false);
    b = await biblioteca('aurora');
    conferirCatalogo('aurora', b, ass2);
    console.log('  ok  5. trabalhador morto no meio das imagens da marca nova');

    // 6. Pedir de novo: um trabalhador novo toma o lugar do morto (um só, mesmo com dois pedidos seguidos) e termina tudo.
    await acao('aurora', 'gerar');
    assert.strictEqual(lancados.length, 2, 'o pedido depois da morte lança outro trabalhador');
    await acao('boreal', 'gerar');
    await acao('aurora', 'gerar');
    assert.strictEqual(lancados.length, 2, 'dois pedidos seguidos não sobem dois trabalhadores');
    await esperar(async () => (await estado('aurora')).estado === 'pronto' && (await estado('boreal')).estado === 'pronto' && !fs.existsSync(path.join(R, 'empresas', '.fila-previas.json')),
      25 * 60000, 'as duas empresas prontas e o trabalhador terminado');
    await Promise.race([lancados[1].saiu, dormir(20000)]);
    assert.strictEqual(lancados[1].exitCode, 0, 'o trabalhador termina sozinho\n' + logs());
    // "Tentar de novo" (o que a tela oferece), só para falha de ambiente: o processo das imagens inteiro caiu (navegador que
    // fechou, tempo esgotado ou saída sem resumo, com a máquina carregada), sem nenhum estilo com erro próprio. Qualquer outro
    // erro falha na hora. Uma vez só: erro de novo é falha do teste.
    // "sem-permissao" entra: o ffmpeg ou o Windows negam o acesso a um arquivo (EPERM/EBUSY) por instantes, sob carga.
    const AMBIENTE = ['navegador-fechou', 'tempo-esgotado', 'sem-permissao', 'outro'];
    const comErro = ['aurora', 'boreal'].filter((c) => lerFila(c).imagens.estado === 'erro');
    for (const c of comErro) {
      const im = lerFila(c).imagens;
      assert.ok((!Array.isArray(im.falhas) || im.falhas.length === 0) && AMBIENTE.includes(im.detalhe),
        `${c}: as imagens deram erro que não é de ambiente (detalhe: ${im.detalhe}, falhas: ${JSON.stringify(im.falhas)})\n${logs()}`);
      conferirCatalogo(c, await biblioteca(c), pm.assinaturaDaMarca(R, c).assinatura); // no erro, nada de prévia falsa
    }
    if (comErro.length) {
      console.log(`  (imagens com erro de ambiente em ${comErro.join(', ')}: "Tentar de novo" uma vez)\n${logs()}`);
      for (const c of comErro) await acao(c, 'gerar');
      await esperar(async () => (await estado('aurora')).estado === 'pronto' && (await estado('boreal')).estado === 'pronto' && !fs.existsSync(path.join(R, 'empresas', '.fila-previas.json')),
        15 * 60000, 'o "Tentar de novo" terminar');
      const ultimo = lancados[lancados.length - 1];
      await Promise.race([ultimo.saiu, dormir(20000)]);
      assert.strictEqual(ultimo.exitCode, 0, 'o trabalhador do "Tentar de novo" termina sozinho\n' + logs());
    }
    console.log('  ok  6. pedido de novo: um trabalhador novo terminou as duas empresas e saiu sozinho');

    // 7. Conferências finais.
    for (const c of ['aurora', 'boreal']) {
      const hoje = pm.assinaturaDaMarca(R, c).assinatura;
      const f = lerFila(c);
      assert.strictEqual(f.assinatura, hoje);
      assert.strictEqual(f.imagens.estado, 'pronto');
      assert.deepStrictEqual(f.videos.map((v) => v.estado), IDS.map(() => 'pronto'), `${c}: ${JSON.stringify(f.videos)}`);
      const corpo = await biblioteca(c);
      conferirCatalogo(c, corpo, hoje);
      assert.deepStrictEqual([corpo.json.marca.naMarca, corpo.json.marca.desatualizada, corpo.json.marca.semConferir], [true, false, 0], c);
      for (const x of corpo.json.estilos) {
        assert.ok(x.previasMarca && x.previasMarca.capa && x.previasMarca.video, `${c}/${x.id}: falta prévia na marca`);
        assert.strictEqual(x.videoMarca, 'pronto');
        const capa = await pedir('GET', x.previasMarca.capa);
        assert.strictEqual(capa.status, 200);
        assert.strictEqual(capa.headers['content-type'], 'image/webp');
      }
      // nenhuma sobra de preparo, de trabalho ou de temporário
      const restos = Object.keys(foto(path.join(R, 'empresas', c, 'previas'))).filter((k) => /(^|\/)\.(novo|trabalho)|\.tmp/.test(k));
      assert.deepStrictEqual(restos, [], `${c}: sobras`);
    }
    console.log('  ok  7a. as duas empresas com as prévias da marca de hoje, imagens e vídeos');

    // amostragem de pixels: cada empresa só com as cores dela (e a aurora só com a marca nova)
    const pastaDe = (c, id) => path.join(R, 'empresas', c, 'previas', id);
    const capaProt = (c) => path.join(pastaDe(c, 'protagonista'), 'carrossel-01.webp');
    const naAurora = await pixelsPerto(capaProt('aurora'), [ACENTO_AURORA_NOVO, ACENTO_AURORA, ACENTO_BOREAL]);
    assert.ok(naAurora[0].perto40 > 1000, `o acento novo da aurora não aparece na capa: ${JSON.stringify(naAurora)}`);
    assert.strictEqual(naAurora[1].perto60, 0, 'há pixel do acento velho da aurora na capa');
    assert.strictEqual(naAurora[2].perto60, 0, 'há pixel do acento da boreal na capa da aurora');
    const naBoreal = await pixelsPerto(capaProt('boreal'), [ACENTO_BOREAL, ACENTO_AURORA, ACENTO_AURORA_NOVO]);
    assert.ok(naBoreal[0].perto40 > 1000, `o acento da boreal não aparece na capa: ${JSON.stringify(naBoreal)}`);
    assert.strictEqual(naBoreal[1].perto60 + naBoreal[2].perto60, 0, 'há pixel de um acento da aurora na capa da boreal');
    for (const id of IDS) {
      const ca = await pixelsPerto(path.join(pastaDe('aurora', id), 'video-capa.webp'), [ACENTO_AURORA_NOVO, ACENTO_AURORA, ACENTO_BOREAL]);
      assert.ok(ca[0].perto40 > 0.9 * ca[0].total && ca[1].perto60 === 0 && ca[2].perto60 === 0, `aurora/${id}: o vídeo não é da marca nova: ${JSON.stringify(ca)}`);
      const cb = await pixelsPerto(path.join(pastaDe('boreal', id), 'video-capa.webp'), [ACENTO_BOREAL, ACENTO_AURORA_NOVO, ACENTO_AURORA]);
      assert.ok(cb[0].perto40 > 0.9 * cb[0].total && cb[1].perto60 === 0 && cb[2].perto60 === 0, `boreal/${id}: o vídeo não é da boreal: ${JSON.stringify(cb)}`);
    }
    // e nenhum arquivo de uma cita a outra
    for (const [c, outra] of [['aurora', 'boreal'], ['boreal', 'aurora']]) {
      const dir = path.join(R, 'empresas', c, 'previas');
      for (const rel of Object.keys(foto(dir))) assert.ok(!new RegExp(outra, 'i').test(rel + fs.readFileSync(path.join(dir, rel), 'latin1')), `${c}/${rel} cita a ${outra}`);
    }
    console.log('  ok  7b. amostragem de pixels: nenhuma cor da boreal na aurora, nenhuma cor da aurora na boreal');

    // conferência entre empresas: limpa; um termo da boreal plantado num arquivo de teste da pasta da aurora faz sair 1
    const VALIDAR = path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');
    const validar = (...args) => spawnSync(process.execPath, [VALIDAR, '--empresa', ...args, '--raiz', R], { encoding: 'utf8', timeout: 120000 });
    let v = validar('aurora');
    assert.strictEqual(v.status, 0, v.stdout + v.stderr);
    assert.ok(/Arquivos lidos: [1-9]/.test(v.stdout), v.stdout);
    v = validar('aurora', path.join(R, 'empresas', 'aurora'));
    assert.strictEqual(v.status, 0, v.stdout + v.stderr);
    assert.strictEqual(validar('boreal').status, 0);
    const plantado = path.join(R, 'empresas', 'aurora', 'previas', 'protagonista', 'teste-plantado.md');
    fs.writeFileSync(plantado, `Arquivo de teste: ${MARCAS.boreal.nome} não pode aparecer aqui.\n`);
    v = validar('aurora');
    assert.strictEqual(v.status, 1, 'o termo da boreal plantado na pasta da aurora devia ser achado\n' + v.stdout + v.stderr);
    assert.ok(v.stdout.includes('teste-plantado.md'), v.stdout);
    assert.strictEqual(validar('aurora', path.join(R, 'empresas', 'aurora')).status, 1);
    fs.unlinkSync(plantado);
    assert.strictEqual(validar('aurora').status, 0);
    console.log('  ok  7c. validar.js --empresa aurora sai 0; com um termo da boreal plantado, sai 1');

    // prévias base (da raiz e do código), pasta antiga, índice e empresa ativa idênticos; nada novo fora das pastas das empresas
    // (o marca.yaml da aurora foi trocado pelo próprio teste no passo 4)
    const semMarcaAurora = (f) => { const { 'empresas/aurora/marca.yaml': _m, ...resto } = f; return resto; };
    assert.deepStrictEqual(semMarcaAurora(foto(R, { fora: DA_EMPRESA })), semMarcaAurora(raizAntes), 'algo mudou fora das prévias das empresas (prévias base, pasta antiga, índice, empresa ativa)');
    assert.deepStrictEqual(foto(PREVIAS_BASE_CODIGO), baseCodigo, 'as prévias base do código mudaram');
    assert.ok(!fs.existsSync(path.join(R, 'empresas', 'principal')), 'nada foi criado para a pasta antiga');
    assert.strictEqual(empresaMod.ativa(R), 'boreal', 'a empresa ativa do agente não muda');
    console.log('  ok  7d. prévias base e pasta antiga idênticas byte a byte; empresa ativa intacta');

    // o que foi gravado é da empresa (a atualização nunca toca) e fica fora do git
    const prop = JSON.parse(fs.readFileSync(path.join(RAIZ_CODIGO, '_fabrica', 'propriedade.json'), 'utf8'));
    const cobre = (lista, rel) => lista.some((p) => (p.endsWith('/') ? rel.startsWith(p) : rel === p));
    const gravados = Object.keys(foto(R)).filter((k) => !Object.prototype.hasOwnProperty.call(raizAntes, k));
    assert.ok(gravados.length > 0);
    const ignorados = spawnSync('git', ['check-ignore', '--no-index', '--stdin'], { cwd: RAIZ_CODIGO, input: gravados.join('\n'), encoding: 'utf8' });
    const ignoradosSet = new Set(ignorados.stdout.split(/\r?\n/).filter(Boolean));
    for (const rel of gravados) {
      assert.ok(cobre(prop.protegidos, rel) && !cobre(prop.modelo, rel), `${rel}: devia ser da empresa no propriedade.json`);
      if (ignorados.status !== 128) assert.ok(ignoradosSet.has(rel), `${rel}: devia ficar fora do git`);
    }
    console.log(`  ok  7e. os ${gravados.length} arquivos gravados são da empresa e ficam fora do git`);
    ok = true;
  } finally {
    for (const filho of lancados) if (filho.exitCode === null && filho.signalCode === null) await matarArvore(filho);
    srv.closeAllConnections();
    await new Promise((fim) => srv.close(fim));
    if (ok) fs.rmSync(TMP, { recursive: true, force: true });
    else console.error(`(a raiz do teste ficou em ${TMP} para olhar)`);
  }
  console.log('\nponta a ponta: tudo certo');
}

// Pixels de uma imagem perto de cada cor (decodificada pelo ffmpeg): [{ perto40, perto60, total }].
async function pixelsPerto(arq, cores) {
  const dim = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', arq], { encoding: 'utf8' });
  assert.strictEqual(dim.status, 0, dim.stderr);
  const [l, a] = dim.stdout.trim().split(',').map(Number);
  const x = spawnSync('ffmpeg', ['-v', 'error', '-i', arq, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: l * a * 3 + 1024 });
  assert.strictEqual(x.status, 0, String(x.stderr));
  const d = x.stdout;
  assert.strictEqual(d.length, l * a * 3, `${arq}: decodificação incompleta`);
  return cores.map(([r, g, b]) => {
    let perto40 = 0;
    let perto60 = 0;
    for (let i = 0; i < d.length; i += 3) {
      const dist = Math.hypot(d[i] - r, d[i + 1] - g, d[i + 2] - b);
      if (dist < 40) perto40++;
      if (dist < 60) perto60++;
    }
    return { perto40, perto60, total: l * a };
  });
}
