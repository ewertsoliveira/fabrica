#!/usr/bin/env node
// Testes de fila-marca.js: a lista de prévias na marca de cada empresa (fila.json, com trava), o trabalhador em segundo
// plano (registro com batida de vida, pausar, retomar, cancelar, passar para a frente, retomada depois de morrer no meio) e
// a linha de comando.
// Rode: node 08-FERRAMENTAS/biblioteca/fila-marca.test.js   (só Node: nada de Chromium nem montar.js)
// Cada teste usa uma raiz temporária com um catálogo de mentira (três estilos), as empresas fictícias aurora (quente) e boreal
// (fria), com marca, e cinza, sem marca. As imagens e o vídeo são trocados por versões rápidas de teste, que gravam arquivos
// pequenos e esperam alguns milissegundos. Processos filhos de verdade fazem o papel de quem morre no meio e de quem disputa
// a trava.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

// O ambiente de quem roda o teste não escolhe empresa, marca ou pasta.
delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;
delete process.env.FABRICA_RAIZ;
delete process.env.FABRICA_FILA_VEZ;

const MODULO = path.join(__dirname, 'fila-marca.js');
const fila = require(MODULO);
const pm = require('./previas-marca');
const empresaMod = require('../../_fabrica/core/empresa');

const LAB = '04-LABORATORIO-DE-DESIGN';
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });
const pastas = [];
const filhos = [];
let contador = 0;
const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

function novaRaiz() {
  const r = path.join(os.tmpdir(), `fila-marca-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
const existe = (r, rel) => fs.existsSync(path.join(r, ...rel.split('/')));
const arqFila = (r, c) => path.join(r, 'empresas', c, 'previas', 'fila.json');
const lerFilaCrua = (r, c) => JSON.parse(fs.readFileSync(arqFila(r, c), 'utf8'));
const arqRegistro = (r) => path.join(r, 'empresas', '.fila-previas.json');

function fotografia(dir) {
  const mapa = {};
  if (!fs.existsSync(dir)) return mapa;
  const varrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const arq = path.join(d, e.name);
      const rel = path.relative(dir, arq).split(path.sep).join('/');
      if (e.isDirectory()) { mapa[rel + '/'] = 'pasta'; varrer(arq); } else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(dir);
  return mapa;
}

// Cores montadas em código (o validador não aceita hex solto fora de teste isento).
const hex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const AURORA = { nome: 'Aurora Nutrição', conta: 'aurora.nutricao', cores: { escuro: hex(58, 30, 36), claro: hex(255, 243, 228), acento: hex(228, 87, 46), neutro: hex(176, 125, 98) } };
const BOREAL = { nome: 'Boreal Finanças', conta: 'boreal.financas', cores: { escuro: hex(14, 42, 59), claro: hex(234, 246, 248), acento: hex(39, 196, 217), neutro: hex(94, 124, 140) } };
const yamlMarca = (m) => ['empresa:', `  nome: "${m.nome}"`, `  handle: "${m.conta}"`, '', 'cores:', ...Object.entries(m.cores).map(([p, v]) => `  ${p}: "${v}"`), ''].join('\n');
const yamlEstilo = (id, modelo) => [`id: ${id}`, `nome: Estilo ${id}`, 'linha: Frase.', 'origem: catalogo', 'formatos:', `  reels: { modelo: ${modelo}, capa: capa-${id} }`, ''].join('\n');

// Catálogo de mentira (adesivo, bloco e cartaz; só o cartaz tem vídeo base), aurora e boreal com marca e cinza sem marca.
function raizCompleta({ antiga = false } = {}) {
  const r = novaRaiz();
  if (antiga) esc(r, '06-MARCA-E-FOTOS/marca.yaml', yamlMarca({ nome: 'Empresa Antiga', conta: 'empresa.antiga', cores: AURORA.cores }));
  for (const id of ['adesivo', 'bloco', 'cartaz']) esc(r, `${LAB}/estilos/${id}/estilo.yaml`, yamlEstilo(id, `modelo-${id}`));
  esc(r, `${LAB}/biblioteca/previas/cartaz/video.webm`, 'v');
  esc(r, `${LAB}/biblioteca/previas/cartaz/previas.json`, JSON.stringify({ capa: null, carrossel: [], video: 'video.webm' }));
  esc(r, `${LAB}/biblioteca/vocabulario.json`, '{}');
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Finanças', r);
  empresaMod.criar('cinza', 'Cinza Sem Marca', r);
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
  esc(r, 'empresas/boreal/marca.yaml', yamlMarca(BOREAL));
  return r;
}

// As versões rápidas das duas funções do trabalhador. `log` guarda a ordem dos passos; `aoVideo(c, id)` roda no começo de
// cada vídeo (para pausar, cancelar, trocar a marca... no meio).
function falsos({ log = [], aoVideo = null, aoImagens = null, estadoDoVideo = () => 'pronto', espera = 5 } = {}) {
  return {
    log,
    async gerarImagens(r, c, { ids, aoAvancar }) {
      log.push(`imagens:${c}`);
      if (aoImagens) await aoImagens(c, ids);
      const { assinatura } = pm.assinaturaDaMarca(r, c);
      let feitos = 0;
      for (const id of ids) {
        const dir = path.join(pm.pastaDaEmpresa(r, c), id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'capa.webp'), `capa ${c} ${id}`);
        fs.writeFileSync(path.join(dir, 'previas.json'), JSON.stringify({ estilo: id, cores: 'marca', empresa: c, assinatura, identidade: 'empresa', capa: 'capa.webp', carrossel: ['capa.webp'] }));
        await dormir(espera);
        feitos++;
        if (aoAvancar) aoAvancar({ id, ok: true, feitos, total: ids.length });
      }
      return { feitos, total: ids.length, falhas: [], refazer: [] };
    },
    async renderizarVideo(r, c, id, opcoes) {
      log.push(`video:${c}:${id}`);
      assert.ok(opcoes && opcoes.modelo === `modelo-${id}`, 'o vídeo recebe o modelo do estilo');
      if (aoVideo) await aoVideo(c, id);
      await dormir(espera);
      return { estado: estadoDoVideo(c, id) };
    },
  };
}

// Um processo que já terminou: o número dele não é de ninguém vivo.
const pidMorto = () => spawnSync(process.execPath, ['-e', '0']).pid;
const agoraIso = () => new Date().toISOString();

// Script ajudante dos processos filhos (fica na raiz temporária, fora do repositório).
const AJUDANTE = `
'use strict';
const fs = require('fs');
const path = require('path');
const [modulo, modo, r, extra] = process.argv.slice(2);
const fila = require(modulo);
const pm = require(path.join(path.dirname(modulo), 'previas-marca.js'));
if (modo === 'alterar') {
  for (let i = 0; i < 50; i++) {
    fila.alterarFila(r, 'aurora', (f) => { f.videos.push({ estilo: extra + '-' + i, modelo: null, estado: 'esperando', erro: null, inicio: null, fim: null }); return f; });
  }
  process.exit(0);
}
if (modo === 'garantir') {
  fila.garantirTrabalhador(r, { lancar: () => { fs.appendFileSync(path.join(r, 'lancamentos.txt'), process.pid + '\\n'); return process.ppid; } });
  process.exit(0);
}
if (modo === 'rodar-e-travar') {
  setInterval(() => {}, 1000);
  fila.rodar(r, {
    batida: 50,
    async gerarImagens(raiz, c, { ids, aoAvancar }) {
      const { assinatura } = pm.assinaturaDaMarca(raiz, c);
      let feitos = 0;
      for (const id of ids) {
        const dir = path.join(pm.pastaDaEmpresa(raiz, c), id);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'capa.webp'), 'capa');
        fs.writeFileSync(path.join(dir, 'previas.json'), JSON.stringify({ estilo: id, cores: 'marca', empresa: c, assinatura, identidade: 'empresa', capa: 'capa.webp', carrossel: ['capa.webp'] }));
        feitos++;
        aoAvancar({ id, ok: true, feitos, total: ids.length });
      }
      return { feitos, total: ids.length, falhas: [], refazer: [] };
    },
    renderizarVideo: () => new Promise(() => {}), // nunca termina: o processo morre no meio do vídeo
  });
}
`;
function ajudante(r) {
  const arq = path.join(r, 'ajudante.js');
  if (!fs.existsSync(arq)) fs.writeFileSync(arq, AJUDANTE);
  return arq;
}
function filho(r, modo, extra = '') {
  const p = spawn(process.execPath, [ajudante(r), MODULO, modo, r, extra], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  filhos.push(p);
  let saida = '';
  p.stdout.on('data', (d) => { saida += d; });
  p.stderr.on('data', (d) => { saida += d; });
  p.terminou = new Promise((ok) => p.on('exit', (cod) => ok({ cod, saida })));
  return p;
}
async function esperarAte(condicao, limite = 20000, msg = 'condição') {
  const fim = Date.now() + limite;
  while (Date.now() < fim) { if (condicao()) return; await dormir(20); }
  throw new Error('tempo esgotado esperando: ' + msg);
}

// ---------- pedir ----------
t('pedir sem marca: recusado com mensagem em português e nada gravado', () => {
  const r = raizCompleta();
  const antes = fotografia(r);
  assert.throws(() => fila.pedir(r, 'cinza'), (e) => e.code === 'SEM_MARCA' && e.message === 'Defina a sua marca antes de ver os estilos nela.');
  assert.deepStrictEqual(fotografia(r), antes);
  assert.ok(!existe(r, 'empresas/cinza/previas'));
  assert.strictEqual(fila.estado(r, 'cinza').estado, 'sem-marca');
  assert.deepStrictEqual(fotografia(r), antes, 'ler o estado não grava nada');
});
t('empresa inválida, vazia ou inexistente: recusada antes de ler ou gravar qualquer coisa', () => {
  const r = raizCompleta();
  const antes = fotografia(r);
  for (const ruim of ['', '../x', '..', 'nao-existe', 'AURORA', 'aurora/../boreal', undefined, 5]) {
    for (const f of [() => fila.pedir(r, ruim), () => fila.estado(r, ruim), () => fila.pausar(r, ruim), () => fila.alterarFila(r, ruim, (x) => x)]) {
      assert.throws(f, (e) => e.code === 'EMPRESA_DESCONHECIDA', String(ruim));
    }
  }
  assert.deepStrictEqual(fotografia(r), antes);
});
t('pedir cria a lista: imagens primeiro, vídeos na ordem da grade (com a intenção da empresa) e com o modelo de cada estilo', () => {
  const r = raizCompleta();
  esc(r, 'empresas/aurora/intencao.json', JSON.stringify({ quer: ['video'] })); // o cartaz (único com vídeo) vem primeiro
  const e = fila.pedir(r, 'aurora', { agora: () => Date.parse('2026-11-05T10:00:00Z') });
  assert.strictEqual(e.estado, 'imagens');
  const f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.versao, 1);
  assert.strictEqual(f.empresa, 'aurora');
  assert.strictEqual(f.assinatura, pm.assinaturaDaMarca(r, 'aurora').assinatura);
  assert.strictEqual(f.pedidoEm, '2026-11-05T10:00:00.000Z');
  assert.strictEqual(f.pausada, false);
  assert.deepStrictEqual({ estado: f.imagens.estado, feitos: f.imagens.feitos, total: f.imagens.total, erro: f.imagens.erro }, { estado: 'esperando', feitos: 0, total: 3, erro: null });
  assert.deepStrictEqual(f.videos.map((v) => [v.estilo, v.modelo, v.estado]), [['cartaz', 'modelo-cartaz', 'esperando'], ['adesivo', 'modelo-adesivo', 'esperando'], ['bloco', 'modelo-bloco', 'esperando']]);
  assert.ok(!existe(r, 'empresas/boreal/previas'), 'nada na pasta de outra empresa');
});
t('pedir duas vezes com a mesma marca e tudo pronto: nada muda (o arquivo fica igual byte a byte)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos();
  await fila.rodar(r, ff);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto');
  const antes = fs.readFileSync(arqFila(r, 'aurora'));
  const e = fila.pedir(r, 'aurora');
  assert.strictEqual(e.estado, 'pronto');
  assert.deepStrictEqual(fs.readFileSync(arqFila(r, 'aurora')), antes);
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar: () => { throw new Error('não devia lançar'); } }), false, 'sem trabalho, ninguém é lançado');
});

// ---------- o trabalhador: ordem, prioridade, pausa, cancelamento ----------
t('rodar: imagens primeiro, depois um vídeo por vez na ordem da grade; termina sozinho e apaga o registro', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos({ estadoDoVideo: (c, id) => (id === 'bloco' ? 'sem-modelo' : 'pronto') });
  const res = await fila.rodar(r, ff);
  assert.strictEqual(res.rodou, true);
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'video:aurora:adesivo', 'video:aurora:bloco', 'video:aurora:cartaz']);
  const f = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual(f.imagens.estado, 'pronto');
  assert.strictEqual(f.imagens.feitos, 3);
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['pronto', 'sem-modelo', 'pronto']);
  for (const v of f.videos) assert.ok(v.inicio && v.fim, 'início e fim de cada vídeo');
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.estado, 'pronto');
  assert.deepStrictEqual(e.videos, { feitos: 3, total: 3, atual: null, prontos: 2, semFonte: 0, semModelo: 1, erros: 0 });
  assert.strictEqual(e.trabalhador, false);
  assert.ok(!fs.existsSync(arqRegistro(r)), 'o registro sai no fim');
  assert.ok(pm.previasValidas(r, 'aurora', 'adesivo', pm.assinaturaDaMarca(r, 'aurora').assinatura), 'as prévias das imagens valem');
});
// ---------- o passo de vídeo padrão: o vídeo na marca (video-marca.gerarVideoNaMarca), trocado aqui por uma função falsa ----------
// `estados(args, n)` devolve o resultado da n-ésima chamada; `log` guarda os argumentos. A troca é no objeto do módulo (o
// passo padrão o chama por ele) e volta ao original no fim.
const videoMarca = require('./video-marca');
async function comVideoFalso(estados, fn) {
  const original = videoMarca.gerarVideoNaMarca;
  const log = [];
  videoMarca.gerarVideoNaMarca = async (args) => {
    log.push({ ...args });
    const res = await estados(args, log.length);
    return { empresa: args.empresa, estilo: args.estilo, modelo: null, mensagem: null, detalhe: null, avisos: [], video: null, videoCapa: null, videoAssinatura: null, segundos: 0, ...res };
  };
  try { return await fn(log); } finally { videoMarca.gerarVideoNaMarca = original; }
}
const semErroNenhum = (r, c) => assert.ok(lerFilaCrua(r, c).videos.every((v) => v.estado !== 'erro' && v.erro === null), JSON.stringify(lerFilaCrua(r, c).videos));

t('o passo de vídeo padrão chama o vídeo na marca com a empresa, o estilo, a marca de hoje e a pasta dos estilos dos dados; pronto, sem-fonte, sem-modelo e erro são o fim do estilo', async () => {
  const r = raizCompleta();
  esc(r, `${LAB}/estilos/dobra/estilo.yaml`, yamlEstilo('dobra', 'modelo-dobra'));
  fila.pedir(r, 'aurora');
  const hoje = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const { gerarImagens } = falsos();
  const FIM = { adesivo: { estado: 'pronto', avisos: ['No vídeo, um aviso.'] }, bloco: { estado: 'sem-fonte', mensagem: 'sem o vídeo' }, cartaz: { estado: 'sem-modelo' }, dobra: { estado: 'erro', mensagem: 'Não consegui montar o vídeo deste estilo.', detalhe: 'Target closed em ' + path.join(r, 'empresas', 'boreal') } };
  await comVideoFalso((a) => FIM[a.estilo], async (log) => {
    await fila.rodar(r, { gerarImagens });
    assert.deepStrictEqual(log.map((a) => a.estilo), ['adesivo', 'bloco', 'cartaz', 'dobra']);
    for (const a of log) {
      assert.strictEqual(a.raiz, path.resolve(r));
      assert.strictEqual(a.empresa, 'aurora');
      assert.strictEqual(a.assinatura, hoje, 'a marca de hoje vai junto (mudou no meio: o vídeo diz "refazer")');
      assert.strictEqual(path.resolve(a.pastaEstilos), path.join(path.resolve(r), LAB, 'estilos'), 'o estilo é o da grade da empresa');
    }
  });
  const f = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual(f.videos.map((v) => [v.estilo, v.estado]), [['adesivo', 'pronto'], ['bloco', 'sem-fonte'], ['cartaz', 'sem-modelo'], ['dobra', 'erro']]);
  assert.deepStrictEqual(f.videos[0].avisos, ['No vídeo, um aviso.']);
  assert.strictEqual(f.videos[3].erro, 'Não deu para fazer o vídeo deste estilo.');
  assert.strictEqual(f.videos[3].detalhe, 'navegador-fechou', 'detalhe só em código curto');
  assert.ok(!/boreal/i.test(fs.readFileSync(arqFila(r, 'aurora'), 'utf8')));
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.estado, 'pronto');
  assert.deepStrictEqual(e.videos, { feitos: 4, total: 4, atual: null, prontos: 1, semFonte: 1, semModelo: 1, erros: 1 });
});
t('o passo de vídeo padrão, "refazer": a empresa recomeça como marca nova (imagens e vídeos de novo), sem erro em estilo nenhum', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos();
  let nova = null;
  await comVideoFalso((a, n) => {
    if (n !== 1) return { estado: 'pronto' };
    // a marca mudou enquanto o vídeo era montado
    esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, cores: { ...AURORA.cores, neutro: hex(120, 90, 70) } }));
    nova = pm.assinaturaDaMarca(r, 'aurora').assinatura;
    return { estado: 'refazer', mensagem: 'A sua marca mudou enquanto o vídeo era feito.' };
  }, async (log) => {
    await fila.rodar(r, { gerarImagens: ff.gerarImagens });
    assert.deepStrictEqual(log.map((a) => a.estilo), ['adesivo', 'adesivo', 'bloco', 'cartaz']);
    assert.deepStrictEqual(log.slice(1).map((a) => a.assinatura), [nova, nova, nova], 'depois do recomeço, com a marca nova');
  });
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'imagens:aurora'], 'as imagens foram refeitas com a marca nova');
  const f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.assinatura, nova);
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['pronto', 'pronto', 'pronto']);
  semErroNenhum(r, 'aurora');
});
t('o passo de vídeo padrão, "refazer" com a mesma marca: só o estilo volta a esperar (nada é recomeçado); repetido sem fim, a empresa para nesta rodada (sem laço, sem erro)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos();
  await comVideoFalso(() => ({ estado: 'refazer' }), async (log) => {
    const res = await fila.rodar(r, { gerarImagens: ff.gerarImagens });
    assert.strictEqual(res.rodou, true);
    assert.deepStrictEqual(log.map((a) => a.estilo), ['adesivo', 'adesivo', 'adesivo'], 'o mesmo vídeo, três vezes, e para');
  });
  assert.deepStrictEqual(ff.log, ['imagens:aurora'], 'as imagens não são refeitas');
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['esperando', 'esperando', 'esperando']);
  semErroNenhum(r, 'aurora');
  assert.ok(!fs.existsSync(arqRegistro(r)), 'o trabalhador terminou e saiu');
});
t('o passo de vídeo padrão, "refazer" quando a marca mudou e já voltou à de antes: só o estilo volta a esperar; os prontos e as imagens ficam (sonda refazer-volta)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos();
  await comVideoFalso((a, n) => {
    if (n !== 2) return { estado: 'pronto' };
    esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, cores: { ...AURORA.cores, neutro: hex(120, 90, 70) } }));
    esc(r, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
    return { estado: 'refazer' };
  }, async (log) => {
    await fila.rodar(r, { gerarImagens: ff.gerarImagens });
    assert.deepStrictEqual(log.map((a) => a.estilo), ['adesivo', 'bloco', 'bloco', 'cartaz'], 'só o bloco é refeito');
  });
  assert.deepStrictEqual(ff.log, ['imagens:aurora'], 'as imagens não são refeitas');
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['pronto', 'pronto', 'pronto']);
});
t('o passo de vídeo padrão, "sem-marca": a empresa para (o estilo volta a esperar, sem erro) e as outras seguem', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora', { agora: () => Date.parse('2026-11-05T10:00:00Z') });
  fila.pedir(r, 'boreal', { agora: () => Date.parse('2026-11-05T10:05:00Z') });
  const ff = falsos();
  await comVideoFalso((a) => {
    if (a.empresa !== 'aurora') return { estado: 'pronto' };
    fs.rmSync(path.join(r, 'empresas', 'aurora', 'marca.yaml')); // a marca da aurora sumiu no meio
    return { estado: 'sem-marca', mensagem: 'A empresa Aurora Nutrição ainda não tem marca definida.' };
  }, async (log) => {
    await fila.rodar(r, { gerarImagens: ff.gerarImagens });
    assert.deepStrictEqual(log.filter((a) => a.empresa === 'aurora').map((a) => a.estilo), ['adesivo'], 'a aurora parou no primeiro vídeo');
    assert.deepStrictEqual(log.filter((a) => a.empresa === 'boreal').map((a) => a.estilo), ['adesivo', 'bloco', 'cartaz'], 'a boreal seguiu');
  });
  const f = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['esperando', 'esperando', 'esperando']);
  semErroNenhum(r, 'aurora');
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'sem-marca');
  assert.deepStrictEqual(lerFilaCrua(r, 'boreal').videos.map((v) => v.estado), ['pronto', 'pronto', 'pronto']);
  // a marca volta (a mesma): o que esperava é feito, sem refazer as imagens
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
  await comVideoFalso(() => ({ estado: 'pronto' }), async (log) => {
    await fila.rodar(r, { gerarImagens: ff.gerarImagens });
    assert.deepStrictEqual(log.map((a) => a.estilo), ['adesivo', 'bloco', 'cartaz']);
  });
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['pronto', 'pronto', 'pronto']);
});
t('o passo de vídeo padrão, "sem-marca" com o arquivo da marca ainda lá: a empresa para nesta rodada (sem laço infinito, sem erro)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const { gerarImagens } = falsos();
  await comVideoFalso(() => ({ estado: 'sem-marca' }), async (log) => {
    await fila.rodar(r, { gerarImagens });
    assert.strictEqual(log.length, 1, 'uma tentativa só');
  });
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['esperando', 'esperando', 'esperando']);
  semErroNenhum(r, 'aurora');
  assert.ok(!fs.existsSync(arqRegistro(r)));
});
t('o passo de vídeo padrão: estado desconhecido ou o vídeo na marca que lança erro viram "erro" do estilo (os outros seguem)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const { gerarImagens } = falsos();
  await comVideoFalso((a) => {
    if (a.estilo === 'adesivo') return { estado: 'inventado' };
    if (a.estilo === 'bloco') throw Object.assign(new Error('O estilo "bloco" não está na biblioteca.'), { code: 'ESTILO_DESCONHECIDO' });
    return { estado: 'pronto' };
  }, async () => { await fila.rodar(r, { gerarImagens }); });
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['erro', 'erro', 'pronto']);
});
t('priorizar no meio: o estilo passa logo depois do que está rodando; estilo fora do catálogo é recusado', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  assert.throws(() => fila.priorizar(r, 'aurora', 'nao-existe'), (e) => e.code === 'ESTILO_DESCONHECIDO' && e.message === 'Este estilo não está na biblioteca.');
  assert.throws(() => fila.priorizar(r, 'aurora', '../boreal'), (e) => e.code === 'ESTILO_DESCONHECIDO');
  let uma = false;
  const ff = falsos({ aoVideo: (c, id) => { if (!uma) { uma = true; assert.strictEqual(id, 'adesivo'); fila.priorizar(r, 'aurora', 'cartaz'); } } });
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'video:aurora:adesivo', 'video:aurora:cartaz', 'video:aurora:bloco']);
});
t('pausar com um vídeo em andamento: ele termina e o próximo não começa; retomar continua', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos({ aoVideo: (c, id) => { if (id === 'adesivo') fila.pausar(r, 'aurora'); } });
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'video:aurora:adesivo']);
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['pronto', 'esperando', 'esperando']);
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.estado, 'pausado');
  assert.strictEqual(e.pausada, true);
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar: () => { throw new Error('em pausa não lança'); } }), false);
  fila.retomar(r, 'aurora');
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'videos');
  const ff2 = falsos();
  await fila.rodar(r, ff2);
  assert.deepStrictEqual(ff2.log, ['video:aurora:bloco', 'video:aurora:cartaz']);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto');
});
t('pausar antes das imagens também segura as imagens', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  fila.pausar(r, 'aurora');
  const ff = falsos();
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log, []);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pausado');
});
t('cancelar tira os que esperam e mantém os prontos (nenhuma prévia pronta é apagada); pedir de novo põe de volta', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  let antesDoCancelar = null;
  const ff = falsos({ aoVideo: (c, id) => { if (id === 'adesivo') { antesDoCancelar = fotografia(path.join(r, 'empresas', 'aurora', 'previas')); fila.cancelar(r, 'aurora'); } } });
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'video:aurora:adesivo']);
  const f = lerFilaCrua(r, 'aurora');
  // o vídeo em andamento termina sozinho (aqui ele acaba antes da batida de conferência), mas o resultado dele já não vale: a
  // lista foi cancelada, então ele sai dela; nenhuma prévia pronta é apagada
  assert.deepStrictEqual(f.videos.map((v) => [v.estilo, v.estado]), []);
  const depois = fotografia(path.join(r, 'empresas', 'aurora', 'previas'));
  for (const k of Object.keys(antesDoCancelar).filter((x) => x !== 'fila.json')) assert.strictEqual(depois[k], antesDoCancelar[k], 'prévia pronta ficou: ' + k);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto');
  fila.pedir(r, 'aurora');
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => [v.estilo, v.estado]), [['adesivo', 'esperando'], ['bloco', 'esperando'], ['cartaz', 'esperando']]);
});
// O vídeo de mentira que nunca termina (o montar.js preso) e só para pelo sinal; `antes(c, id)` roda no começo (para pausar,
// cancelar...). Guarda os sinais recebidos.
function videoPreso(ff, { so = null, antes = null } = {}) {
  const sinais = [];
  return {
    ...ff,
    sinais,
    async renderizarVideo(r, c, id, op) {
      if (so && id !== so) return ff.renderizarVideo(r, c, id, op);
      ff.log.push(`video-preso:${c}:${id}`);
      sinais.push(op.sinal);
      if (antes) await antes(c, id);
      return new Promise((_, recusar) => {
        if (op.sinal) op.sinal.addEventListener('abort', () => recusar(Object.assign(new Error('parado'), { code: 'ABORTADO' })), { once: true });
      });
    },
  };
}
t('pausar com o vídeo em andamento: o processo do vídeo é encerrado na hora e o estilo volta a esperar, sem erro; retomar refaz só dele em diante', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = videoPreso(falsos(), { so: 'adesivo', antes: () => fila.pausar(r, 'aurora') });
  const t0 = Date.now();
  await fila.rodar(r, { ...ff, vigiaMs: 50 });
  assert.ok(Date.now() - t0 < 30000, 'o pausar não alcançou o vídeo: ' + (Date.now() - t0));
  assert.ok(ff.sinais[0] && ff.sinais[0].aborted, 'o vídeo em andamento foi mandado parar');
  const f = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual(f.videos.map((v) => [v.estilo, v.estado, v.erro || null]), [['adesivo', 'esperando', null], ['bloco', 'esperando', null], ['cartaz', 'esperando', null]]);
  assert.ok(f.videos.every((v) => !v.vez && !v.detalhe), 'sem marca de trabalho nem detalhe de erro');
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pausado');
  assert.ok(!fs.existsSync(arqRegistro(r)), 'o trabalhador saiu');
  fila.retomar(r, 'aurora');
  const ff2 = falsos();
  await fila.rodar(r, ff2);
  assert.deepStrictEqual(ff2.log, ['video:aurora:adesivo', 'video:aurora:bloco', 'video:aurora:cartaz']);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto');
});
t('cancelar com o vídeo em andamento: o processo do vídeo é encerrado na hora e o estilo sai da lista', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = videoPreso(falsos(), { so: 'adesivo', antes: () => fila.cancelar(r, 'aurora') });
  const t0 = Date.now();
  await fila.rodar(r, { ...ff, vigiaMs: 50 });
  assert.ok(Date.now() - t0 < 30000, 'o cancelar não alcançou o vídeo: ' + (Date.now() - t0));
  assert.ok(ff.sinais[0] && ff.sinais[0].aborted, 'o vídeo em andamento foi mandado parar');
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos, []);
  assert.ok(!fs.existsSync(arqRegistro(r)));
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto', 'as imagens já estavam prontas e ficam');
});
t('vídeo que passa do limite sem ninguém pausar nem cancelar continua dando erro de verdade (o sinal só vale para pausa e cancelamento)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos({ estadoDoVideo: (c, id) => (id === 'adesivo' ? 'erro' : 'pronto') });
  await fila.rodar(r, { ...ff, vigiaMs: 50 });
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((v) => v.estado), ['erro', 'pronto', 'pronto']);
});
t('cancelar antes das imagens: nada fica esperando e o estado volta a "nada"', () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  fila.cancelar(r, 'aurora');
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.estado, 'nada');
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar: () => { throw new Error('sem trabalho'); } }), false);
});
// ---------- passo das imagens preso (revisão final, Importante 2) ----------

// As imagens de mentira que nunca terminam (um processo filho preso) e só param pelo sinal; `antes(c, ids, aoAvancar)` roda
// no começo (para deixar um estilo pronto, pausar ou cancelar).
function imagensPresas(ff, { so = null, antes = null } = {}) {
  const sinais = [];
  return {
    ...ff,
    sinais,
    async gerarImagens(r, c, op) {
      if (so && c !== so) return ff.gerarImagens(r, c, op);
      ff.log.push(`imagens-presas:${c}`);
      sinais.push(op.sinal);
      if (antes) await antes(c, op.ids, op.aoAvancar);
      return new Promise((_, recusar) => {
        if (op.sinal) op.sinal.addEventListener('abort', () => recusar(Object.assign(new Error('parado'), { code: 'ABORTADO' })), { once: true });
      });
    },
  };
}
t('imagens presas: viram erro "tempo-esgotado" dentro do limite, o filho é mandado parar e o trabalhador segue (próxima empresa e vídeos)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  fila.pedir(r, 'boreal');
  const ff = imagensPresas(falsos(), { so: 'aurora' });
  const t0 = Date.now();
  const res = await fila.rodar(r, { ...ff, limiteImagensMs: 400, vigiaMs: 50 });
  assert.ok(Date.now() - t0 < 30000, 'o trabalhador ficou preso: ' + (Date.now() - t0));
  assert.strictEqual(res.rodou, true);
  const a = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual([a.imagens.estado, a.imagens.detalhe, a.imagens.erro], ['erro', 'tempo-esgotado', 'Não deu para preparar as imagens na sua marca.']);
  assert.ok(ff.sinais[0] && ff.sinais[0].aborted, 'o passo preso foi mandado parar (o filho é encerrado)');
  assert.ok(a.videos.every((v) => ['pronto', 'sem-modelo'].includes(v.estado)), 'os vídeos da aurora andaram: ' + JSON.stringify(a.videos.map((v) => v.estado)));
  assert.strictEqual(lerFilaCrua(r, 'boreal').imagens.estado, 'pronto', 'a outra empresa foi feita');
  assert.ok(!fs.existsSync(arqRegistro(r)), 'o registro do trabalhador foi solto');
  assert.strictEqual(fila.estado(r, 'aurora').trabalhador, false);
  // "Tentar de novo": pedir de novo põe as imagens para esperar
  fila.pedir(r, 'aurora');
  assert.strictEqual(lerFilaCrua(r, 'aurora').imagens.estado, 'esperando');
});
t('cancelar com as imagens em andamento: o passo para na hora (o filho é encerrado) e o que já ficou pronto fica', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = imagensPresas(falsos(), { antes: (c, ids, aoAvancar) => { aoAvancar({ id: ids[0], ok: true, feitos: 1, total: ids.length }); fila.cancelar(r, 'aurora'); } });
  const t0 = Date.now();
  await fila.rodar(r, { ...ff, vigiaMs: 50 });
  assert.ok(Date.now() - t0 < 30000, 'o cancelar não alcançou o passo: ' + (Date.now() - t0));
  assert.ok(ff.sinais[0].aborted, 'o filho foi mandado parar');
  const f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.imagens.estado, 'cancelado');
  assert.deepStrictEqual(f.videos, [], 'os vídeos que esperavam saíram');
  assert.ok(!fs.existsSync(arqRegistro(r)));
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'nada');
});
t('pausar com as imagens em andamento: o passo para, os estilos que faltam voltam a esperar; retomar faz só eles', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = imagensPresas(falsos(), { antes: (c, ids, aoAvancar) => { aoAvancar({ id: ids[0], ok: true, feitos: 1, total: ids.length }); fila.pausar(r, 'aurora'); } });
  await fila.rodar(r, { ...ff, vigiaMs: 50 });
  assert.ok(ff.sinais[0].aborted, 'o filho foi mandado parar');
  const f = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual([f.imagens.estado, f.imagens.ids, f.imagens.feitos, f.pausada], ['esperando', ['bloco', 'cartaz'], 1, true]);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pausado');
  assert.ok(!fs.existsSync(arqRegistro(r)));
  fila.retomar(r, 'aurora');
  const ff2 = falsos();
  const vistos = [];
  await fila.rodar(r, { ...ff2, gerarImagens: (rr, c, op) => { vistos.push(op.ids); return ff2.gerarImagens(rr, c, op); } });
  assert.deepStrictEqual(vistos, [['bloco', 'cartaz']], 'retomar faz só os estilos que faltavam');
  const g = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual([g.imagens.estado, g.imagens.feitos, g.imagens.total], ['pronto', 3, 3]);
});
t('rodar: tira os temporários abandonados das prévias (pasta temporária do sistema) e da marca e do estilo (pasta da empresa), só os velhos e só pelo nome exato', async () => {
  const r = raizCompleta();
  const tmp = os.tmpdir();
  const velho = (Date.now() - 7 * 3600 * 1000) / 1000;
  const sufixo = crypto.randomBytes(3).toString('hex');
  const pastaTmp = (nome, antiga) => { const p = path.join(tmp, nome); fs.mkdirSync(p, { recursive: true }); fs.writeFileSync(path.join(p, 'x.png'), 'x'); if (antiga) fs.utimesSync(p, velho, velho); pastas.push(p); return p; };
  const abandonadas = [pastaTmp(`previas-${sufixo}`, true), pastaTmp(`previas-letras-${sufixo}`, true)];
  const ficam = [pastaTmp(`previas-${crypto.randomBytes(3).toString('hex')}`, false), pastaTmp(`previas-teste-${sufixo}`, true), pastaTmp(`previas-${sufixo}x`, true)];
  const arq = (rel, antigo) => { const p = esc(r, rel, 'meio gravado'); if (antigo) fs.utimesSync(p, velho, velho); return p; };
  const tmpsVelhos = [arq('empresas/aurora/marca.yaml.1234-1700000000000.tmp', true), arq('empresas/boreal/estilo.json.99-1700000000001.tmp', true)];
  const tmpsFicam = [arq('empresas/aurora/marca.yaml.1234-1700000000002.tmp', false), arq('empresas/aurora/outro.tmp', true), path.join(r, 'empresas', 'aurora', 'marca.yaml')];
  await fila.rodar(r, falsos());
  for (const p of [...abandonadas, ...tmpsVelhos]) assert.ok(!fs.existsSync(p), 'devia sair: ' + p);
  for (const p of [...ficam, ...tmpsFicam]) assert.ok(fs.existsSync(p), 'devia ficar: ' + p);
});
t('pausar, retomar, cancelar e priorizar sem nada pedido: não criam pasta nem arquivo', () => {
  const r = raizCompleta();
  const antes = fotografia(r);
  fila.pausar(r, 'aurora');
  fila.retomar(r, 'aurora');
  fila.cancelar(r, 'aurora');
  fila.priorizar(r, 'aurora', 'bloco');
  assert.deepStrictEqual(fotografia(r), antes);
});

// ---------- a marca muda no meio ----------
t('marca trocada no meio: o trabalhador recomeça a empresa com a marca nova e as prévias velhas deixam de valer', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const velha = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  let trocou = false;
  let nova = null;
  const ff = falsos({
    aoVideo: (c, id) => {
      if (trocou) return;
      trocou = true;
      esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, cores: { ...AURORA.cores, acento: hex(200, 40, 90) } }));
      nova = pm.assinaturaDaMarca(r, 'aurora').assinatura;
      assert.notStrictEqual(nova, velha);
      assert.strictEqual(pm.previasValidas(r, 'aurora', 'adesivo', nova), null, 'a prévia da marca velha não vale mais');
      assert.strictEqual(fila.estado(r, 'aurora').desatualizada, true);
    },
  });
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'video:aurora:adesivo', 'imagens:aurora', 'video:aurora:adesivo', 'video:aurora:bloco', 'video:aurora:cartaz']);
  const f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.assinatura, nova);
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['pronto', 'pronto', 'pronto']);
  assert.ok(pm.previasValidas(r, 'aurora', 'bloco', nova), 'refeitas na marca nova');
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.desatualizada, false);
  assert.strictEqual(e.estado, 'pronto');
});
t('pedir com a marca nova recomeça imagens e vídeos e mantém as prévias velhas no disco', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  await fila.rodar(r, falsos());
  const antes = fotografia(path.join(r, 'empresas', 'aurora', 'previas'));
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, nome: 'Aurora Nutrição Clínica' }));
  assert.strictEqual(fila.estado(r, 'aurora').desatualizada, true);
  const e = fila.pedir(r, 'aurora');
  assert.strictEqual(e.estado, 'imagens');
  const f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.imagens.estado, 'esperando');
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['esperando', 'esperando', 'esperando']);
  const depois = fotografia(path.join(r, 'empresas', 'aurora', 'previas'));
  for (const k of Object.keys(antes).filter((x) => x !== 'fila.json')) assert.strictEqual(depois[k], antes[k], 'prévia velha ficou no disco: ' + k);
});

// ---------- registro do trabalhador, morte no meio e retomada ----------
t('registro vivo (processo existe e batida recente): rodar sai sem fazer nada', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  esc(r, 'empresas/.fila-previas.json', JSON.stringify({ pid: process.pid, raiz: r, inicio: agoraIso(), batida: agoraIso(), vez: 'outro' }));
  const ff = falsos();
  const res = await fila.rodar(r, ff);
  assert.strictEqual(res.rodou, false);
  assert.deepStrictEqual(ff.log, []);
  assert.strictEqual(fila.estado(r, 'aurora').trabalhador, true);
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar: () => { throw new Error('já tem um vivo'); } }), false);
});
t('registro de processo morto, ou de processo vivo sem batida há mais de 2 min: é tomado', async () => {
  for (const reg of [
    { pid: pidMorto(), raiz: null, inicio: agoraIso(), batida: agoraIso(), vez: 'morto' },
    { pid: process.pid, raiz: null, inicio: agoraIso(), batida: new Date(Date.now() - 3 * 60000).toISOString(), vez: 'parado' },
  ]) {
    const r = raizCompleta();
    fila.pedir(r, 'aurora');
    esc(r, 'empresas/.fila-previas.json', JSON.stringify({ ...reg, raiz: r }));
    assert.strictEqual(fila.estado(r, 'aurora').trabalhador, false);
    const ff = falsos();
    const res = await fila.rodar(r, ff);
    assert.strictEqual(res.rodou, true);
    assert.strictEqual(ff.log.length, 4);
    assert.ok(!fs.existsSync(arqRegistro(r)));
  }
});
t('item "fazendo" de qualquer empresa volta para "esperando" quando o trabalhador começa (o anterior morreu no meio)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  fila.pedir(r, 'boreal');
  fila.alterarFila(r, 'aurora', (f) => { f.imagens.estado = 'fazendo'; return f; });
  fila.alterarFila(r, 'boreal', (f) => { f.imagens.estado = 'pronto'; f.imagens.feitos = 3; f.videos[0].estado = 'fazendo'; f.videos[0].inicio = agoraIso(); return f; });
  const ff = falsos();
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log.filter((x) => x.includes('boreal')), ['video:boreal:adesivo', 'video:boreal:bloco', 'video:boreal:cartaz']);
  assert.ok(ff.log.includes('imagens:aurora'));
  for (const c of ['aurora', 'boreal']) assert.strictEqual(fila.estado(r, c).estado, 'pronto');
});
t('trabalhador de verdade morre no meio de um vídeo: o registro fica morto, o próximo pedido lança outro e ele termina o que faltava', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const p = filho(r, 'rodar-e-travar');
  await esperarAte(() => { try { return lerFilaCrua(r, 'aurora').videos.some((v) => v.estado === 'fazendo'); } catch { return false; } }, 20000, 'um vídeo em andamento');
  const reg = JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8'));
  assert.strictEqual(reg.pid, p.pid);
  assert.strictEqual(reg.raiz, r);
  assert.ok(reg.inicio && reg.batida);
  assert.strictEqual(fila.estado(r, 'aurora').trabalhador, true);
  assert.strictEqual(fila.estado(r, 'aurora').videos.atual, 'adesivo');
  // a batida anda enquanto o vídeo roda (o passo longo não segura o processo)
  const b1 = reg.batida;
  await esperarAte(() => JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8')).batida !== b1, 5000, 'a batida mudar');
  p.kill();
  await p.terminou;
  assert.strictEqual(fila.estado(r, 'aurora').trabalhador, false, 'processo morto: ninguém trabalhando');
  // dois pedidos seguidos lançam um só
  let lancados = 0;
  const lancar = () => { lancados++; return undefined; };
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar }), true);
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar }), false);
  assert.strictEqual(lancados, 1);
  // o lançado assume a reserva e faz o que faltava; o vídeo pela metade volta para "esperando" e é feito de novo
  const reserva = JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8'));
  const ff = falsos();
  const res = await fila.rodar(r, { ...ff, vez: reserva.vez });
  assert.strictEqual(res.rodou, true);
  assert.deepStrictEqual(ff.log, ['video:aurora:adesivo', 'video:aurora:bloco', 'video:aurora:cartaz']);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto');
  assert.ok(!fs.existsSync(arqRegistro(r)));
});
t('garantirTrabalhador: dois processos ao mesmo tempo lançam um só', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const a = filho(r, 'garantir');
  const b = filho(r, 'garantir');
  const [ra, rb] = await Promise.all([a.terminou, b.terminou]);
  assert.strictEqual(ra.cod, 0, ra.saida);
  assert.strictEqual(rb.cod, 0, rb.saida);
  const linhas = fs.readFileSync(path.join(r, 'lancamentos.txt'), 'utf8').trim().split('\n');
  assert.strictEqual(linhas.length, 1, linhas.join(','));
  const reg = JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8'));
  assert.strictEqual(reg.pid, process.pid, 'o registro guarda o processo lançado');
  assert.strictEqual(reg.raiz, r);
});
t('garantirTrabalhador lança destacado com FABRICA_RAIZ e sem a marca nem a empresa de quem chamou', () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  let pedido = null;
  process.env.FABRICA_EMPRESA = 'boreal';
  process.env.FABRICA_MARCA = path.join(r, 'empresas', 'boreal', 'marca.yaml');
  try {
    assert.strictEqual(fila.garantirTrabalhador(r, { lancar: (p) => { pedido = p; return process.pid; } }), true);
  } finally { delete process.env.FABRICA_EMPRESA; delete process.env.FABRICA_MARCA; }
  assert.strictEqual(pedido.raiz, r);
  assert.ok(pedido.args.includes('rodar'));
  assert.strictEqual(pedido.env.FABRICA_RAIZ, r);
  assert.strictEqual(pedido.env.FABRICA_EMPRESA, undefined);
  assert.strictEqual(pedido.env.FABRICA_MARCA, undefined);
  assert.strictEqual(pedido.env.FABRICA_FILA_VEZ, JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8')).vez);
  assert.ok(!existe(r, 'empresas/ativa.json'), 'ninguém grava a empresa ativa');
});
t('a batida de vida anda a cada intervalo enquanto um passo longo roda', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const batidas = [];
  const ff = falsos({ aoVideo: async (c, id) => { if (id !== 'adesivo') return; for (let i = 0; i < 6; i++) { batidas.push(JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8')).batida); await dormir(25); } } });
  await fila.rodar(r, { ...ff, batida: 20 });
  assert.ok(new Set(batidas).size >= 2, 'batidas: ' + batidas.join(', '));
});

// ---------- duas empresas ----------
t('duas empresas com trabalho: as duas terminam, uma por vez (o pedido mais antigo primeiro), cada uma só com os próprios arquivos', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'boreal', { agora: () => Date.parse('2026-11-05T09:00:00Z') });
  fila.pedir(r, 'aurora', { agora: () => Date.parse('2026-11-05T10:00:00Z') });
  const ff = falsos();
  await fila.rodar(r, ff);
  assert.deepStrictEqual(ff.log, ['imagens:boreal', 'video:boreal:adesivo', 'video:boreal:bloco', 'video:boreal:cartaz', 'imagens:aurora', 'video:aurora:adesivo', 'video:aurora:bloco', 'video:aurora:cartaz']);
  for (const [c, outra] of [['aurora', 'boreal'], ['boreal', 'aurora']]) {
    assert.strictEqual(fila.estado(r, c).estado, 'pronto');
    const fotos = fotografia(path.join(r, 'empresas', c, 'previas'));
    for (const rel of Object.keys(fotos).filter((k) => !k.endsWith('/'))) {
      const texto = fs.readFileSync(path.join(r, 'empresas', c, 'previas', ...rel.split('/')), 'utf8');
      assert.ok(!texto.includes(outra), `${c}/${rel} cita ${outra}`);
    }
    assert.strictEqual(lerFilaCrua(r, c).empresa, c);
  }
});
t('fila.json de outra empresa copiado para a pasta: não vale (estado "nada") e não vira trabalho', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'boreal');
  fs.mkdirSync(path.join(r, 'empresas', 'aurora', 'previas'), { recursive: true });
  fs.copyFileSync(arqFila(r, 'boreal'), arqFila(r, 'aurora'));
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'nada');
  const ff = falsos();
  await fila.rodar(r, ff);
  assert.ok(ff.log.every((x) => !x.includes('aurora')), ff.log.join(','));
});

// ---------- trava ----------
t('alterarFila concorrente (dois processos alterando 50 vezes cada): nenhuma alteração perdida e fila.json sempre legível', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const a = filho(r, 'alterar', 'a');
  const b = filho(r, 'alterar', 'b');
  let vivos = 2;
  a.terminou.then(() => vivos--);
  b.terminou.then(() => vivos--);
  let leituras = 0;
  while (vivos > 0) {
    let texto;
    try { texto = fs.readFileSync(arqFila(r, 'aurora'), 'utf8'); } catch (e) { if (['EPERM', 'EACCES', 'EBUSY'].includes(e.code)) { await dormir(1); continue; } throw e; }
    JSON.parse(texto); // nunca pela metade
    leituras++;
    await dormir(1);
  }
  const [ra, rb] = await Promise.all([a.terminou, b.terminou]);
  assert.strictEqual(ra.cod, 0, ra.saida);
  assert.strictEqual(rb.cod, 0, rb.saida);
  const f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.videos.length, 3 + 100);
  for (const tag of ['a', 'b']) for (let i = 0; i < 50; i++) assert.ok(f.videos.some((v) => v.estilo === `${tag}-${i}`), `${tag}-${i}`);
  assert.ok(leituras > 0);
  const sobras = fs.readdirSync(path.dirname(arqFila(r, 'aurora'))).filter((n) => n !== 'fila.json');
  assert.deepStrictEqual(sobras, [], 'nenhum temporário nem trava sobrando');
});
t('trava de processo morto, ou com mais de 30 s, é considerada abandonada; trava viva recente segura', () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const trava = path.join(r, 'empresas', 'aurora', 'previas', '.fila.trava');
  fs.writeFileSync(trava, JSON.stringify({ pid: pidMorto(), inicio: agoraIso(), vez: 'm' }));
  fila.alterarFila(r, 'aurora', (f) => { f.pausada = true; return f; });
  assert.strictEqual(lerFilaCrua(r, 'aurora').pausada, true);
  assert.ok(!fs.existsSync(trava));
  fs.writeFileSync(trava, JSON.stringify({ pid: process.pid, inicio: new Date(Date.now() - 40000).toISOString(), vez: 'v' }));
  fila.alterarFila(r, 'aurora', (f) => { f.pausada = false; return f; });
  assert.strictEqual(lerFilaCrua(r, 'aurora').pausada, false);
  fs.writeFileSync(trava, JSON.stringify({ pid: process.pid, inicio: agoraIso(), vez: 'v2' }));
  let chamou = false;
  assert.throws(() => fila.alterarFila(r, 'aurora', (f) => { chamou = true; return f; }, { limite: 150 }), (e) => e.code === 'FILA_OCUPADA' && /tente de novo/i.test(e.message));
  assert.strictEqual(chamou, false);
  assert.ok(fs.existsSync(trava), 'a trava viva de outro não é tirada');
  fs.unlinkSync(trava);
});
t('alterarFila: a função que não devolve nada não grava; erro na função não grava e solta a trava', () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const antes = fs.readFileSync(arqFila(r, 'aurora'));
  fila.alterarFila(r, 'aurora', () => undefined);
  assert.throws(() => fila.alterarFila(r, 'aurora', (f) => { f.pausada = true; throw new Error('pela metade'); }), /pela metade/);
  assert.deepStrictEqual(fs.readFileSync(arqFila(r, 'aurora')), antes);
  assert.ok(!fs.existsSync(path.join(r, 'empresas', 'aurora', 'previas', '.fila.trava')));
});

// ---------- erros ----------
t('erro num estilo não para os outros e fica com a mensagem em português, sem caracteres de controle', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos();
  const renderizarVideo = async (raiz, c, id, o) => {
    if (id === 'bloco') throw new Error('Target closed' + String.fromCharCode(27, 91, 51, 49, 109, 0x200b, 0x202e) + ' no meio' + String.fromCharCode(13, 10) + 'linha 2 em ' + path.join(r, 'empresas', 'boreal', 'marca.yaml') + ' da Boreal Finanças');
    return ff.renderizarVideo(raiz, c, id, o);
  };
  await fila.rodar(r, { gerarImagens: ff.gerarImagens, renderizarVideo });
  const f = lerFilaCrua(r, 'aurora');
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['pronto', 'erro', 'pronto']);
  const v = f.videos[1];
  assert.strictEqual(v.erro, 'Não deu para fazer o vídeo deste estilo.');
  // o detalhe (o fila.json é servido pelo servidor de arquivos) é só um código curto: nada de caminho nem de texto de outra empresa
  assert.strictEqual(v.detalhe, 'navegador-fechou');
  const texto = fs.readFileSync(arqFila(r, 'aurora'), 'utf8');
  assert.ok(!/boreal|Users|[A-Za-z]:\\\\/i.test(texto), texto);
  assert.strictEqual(fila.estado(r, 'aurora').videos.erros, 1);
  // pedir de novo refaz só o que deu erro
  fila.pedir(r, 'aurora');
  assert.deepStrictEqual(lerFilaCrua(r, 'aurora').videos.map((x) => x.estado), ['pronto', 'esperando', 'pronto']);
});
t('erro nas imagens: imagens com erro em português e os vídeos seguem; falha de um estilo nas imagens é refeita no próximo pedido', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos();
  await fila.rodar(r, { gerarImagens: async () => { throw new Error('o navegador fechou\u0007'); }, renderizarVideo: ff.renderizarVideo });
  let f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.imagens.estado, 'erro');
  assert.strictEqual(f.imagens.erro, 'Não deu para preparar as imagens na sua marca.');
  assert.strictEqual(f.imagens.detalhe, 'navegador-fechou');
  assert.deepStrictEqual(f.videos.map((v) => v.estado), ['pronto', 'pronto', 'pronto']);
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.imagens.erro, 'Não deu para preparar as imagens na sua marca.');
  // uma falha só de um estilo: o próximo pedido refaz só ele
  fila.pedir(r, 'aurora');
  const pedidos = [];
  await fila.rodar(r, {
    gerarImagens: async (raiz, c, o) => { pedidos.push(o.ids.slice()); if (pedidos.length === 1) { const x = await ff.gerarImagens(raiz, c, { ...o, ids: o.ids.filter((id) => id !== 'bloco') }); return { ...x, total: 3, falhas: [{ id: 'bloco', erro: 'quebrou' }] }; } return ff.gerarImagens(raiz, c, o); },
    renderizarVideo: ff.renderizarVideo,
  });
  f = lerFilaCrua(r, 'aurora');
  assert.strictEqual(f.imagens.estado, 'erro');
  assert.ok(/1 estilo/.test(f.imagens.erro), f.imagens.erro);
  fila.pedir(r, 'aurora');
  await fila.rodar(r, { gerarImagens: async (raiz, c, o) => { pedidos.push(o.ids.slice()); return ff.gerarImagens(raiz, c, o); }, renderizarVideo: ff.renderizarVideo });
  assert.deepStrictEqual(pedidos, [['adesivo', 'bloco', 'cartaz'], ['bloco']]);
  assert.strictEqual(lerFilaCrua(r, 'aurora').imagens.estado, 'pronto');
});

// ---------- estado ----------
t('estado: forma da resposta durante as imagens e durante os vídeos, sem nada de outra empresa', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const vistos = [];
  const ff = falsos({
    aoImagens: () => { vistos.push(fila.estado(r, 'aurora')); },
    aoVideo: (c, id) => { if (id === 'bloco') vistos.push(fila.estado(r, 'aurora')); },
  });
  await fila.rodar(r, ff);
  const [img, vid] = vistos;
  assert.deepStrictEqual(Object.keys(img), ['estado', 'imagens', 'videos', 'desatualizada', 'pausada', 'trabalhador']);
  assert.strictEqual(img.estado, 'imagens');
  assert.deepStrictEqual(img.imagens, { estado: 'fazendo', feitos: 0, total: 3, erro: null });
  assert.strictEqual(img.trabalhador, true);
  assert.strictEqual(vid.estado, 'videos');
  assert.deepStrictEqual(vid.videos, { feitos: 1, total: 3, atual: 'bloco', prontos: 1, semFonte: 0, semModelo: 0, erros: 0 });
  assert.ok(!JSON.stringify(vistos).includes('boreal'));
  assert.deepStrictEqual(fila.estado(r, 'boreal'), { estado: 'nada', imagens: { estado: null, feitos: 0, total: 0, erro: null }, videos: { feitos: 0, total: 0, atual: null, prontos: 0, semFonte: 0, semModelo: 0, erros: 0 }, desatualizada: false, pausada: false, trabalhador: false });
});
t('estado: marca mudada com trabalho pela metade conta como recomeço (a contagem velha não aparece)', () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  fila.alterarFila(r, 'aurora', (f) => { f.imagens.estado = 'pronto'; f.imagens.feitos = 3; f.videos[0].estado = 'pronto'; return f; });
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, conta: 'aurora.nova' }));
  const e = fila.estado(r, 'aurora');
  assert.strictEqual(e.estado, 'imagens');
  assert.deepStrictEqual(e.imagens, { estado: 'esperando', feitos: 0, total: 3, erro: null });
  assert.strictEqual(e.videos.feitos, 0);
});

// ---------- pasta antiga ----------
t('pasta antiga (principal): a lista cai em empresas/principal/previas/ e 06-MARCA-E-FOTOS fica idêntica', async () => {
  const r = novaRaiz();
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', yamlMarca({ nome: 'Empresa Antiga', conta: 'empresa.antiga', cores: AURORA.cores }));
  for (const id of ['adesivo', 'bloco']) esc(r, `${LAB}/estilos/${id}/estilo.yaml`, yamlEstilo(id, `modelo-${id}`));
  const antes = fotografia(path.join(r, '06-MARCA-E-FOTOS'));
  fila.pedir(r, 'principal');
  assert.ok(fs.existsSync(arqFila(r, 'principal')));
  await fila.rodar(r, falsos());
  assert.strictEqual(fila.estado(r, 'principal').estado, 'pronto');
  assert.deepStrictEqual(fotografia(path.join(r, '06-MARCA-E-FOTOS')), antes);
  assert.ok(!existe(r, 'empresas/ativa.json'));
});

// ---------- rodada de correção (sondas da revisão) ----------
function semConsole(fn) {
  const antes = console.error;
  const erros = [];
  console.error = (...a) => erros.push(a.join(' '));
  return Promise.resolve().then(fn).finally(() => { console.error = antes; }).then((res) => ({ res, erros }));
}
t('A1: erro persistente de disco numa empresa (lista só leitura) não impede a outra; o próximo trabalhador nem tenta a presa', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora', { agora: () => Date.parse('2026-01-01T00:00:00Z') });
  fila.pedir(r, 'boreal', { agora: () => Date.parse('2026-01-02T00:00:00Z') });
  const arq = arqFila(r, 'aurora');
  fs.chmodSync(arq, 0o444);
  try {
    const ff = falsos();
    const { res, erros } = await semConsole(() => fila.rodar(r, ff));
    assert.strictEqual(res.rodou, true);
    assert.deepStrictEqual(ff.log, ['imagens:boreal', 'video:boreal:adesivo', 'video:boreal:bloco', 'video:boreal:cartaz']);
    assert.strictEqual(fila.estado(r, 'boreal').estado, 'pronto');
    assert.ok(erros.some((e) => e.includes('aurora')), 'o erro da aurora vai para o console');
    assert.ok(!fs.existsSync(arqRegistro(r)), 'terminou e saiu (não fica tentando a aurora para sempre)');
    // um novo pedido da boreal lança outro trabalhador: ele não cai de novo na aurora presa
    esc(r, 'empresas/boreal/marca.yaml', yamlMarca({ ...BOREAL, nome: 'Boreal Finanças Pessoais' }));
    fila.pedir(r, 'boreal');
    const ff2 = falsos();
    const t0 = Date.now();
    const segunda = await semConsole(() => fila.rodar(r, ff2));
    assert.deepStrictEqual(ff2.log, ['imagens:boreal', 'video:boreal:adesivo', 'video:boreal:bloco', 'video:boreal:cartaz']);
    assert.ok(!segunda.erros.some((e) => e.includes('aurora')), segunda.erros.join(' | '));
    assert.ok(Date.now() - t0 < 2500, 'sem as tentativas na aurora');
  } finally { fs.chmodSync(arq, 0o666); }
  // consertado o disco, pedir de novo a aurora tira a marca de presa e ela é atendida
  fila.pedir(r, 'aurora');
  const ff3 = falsos();
  await fila.rodar(r, ff3);
  assert.ok(ff3.log.includes('imagens:aurora'), ff3.log.join(','));
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'pronto');
});
t('A2: cancelar desliga a pausa, e pedir partindo de "nada" também (o clique em gerar depois de cancelar anda)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  fila.pausar(r, 'aurora');
  assert.strictEqual(fila.cancelar(r, 'aurora').pausada, false);
  const p = fila.pedir(r, 'aurora');
  assert.strictEqual(p.estado, 'imagens');
  assert.strictEqual(p.pausada, false);
  // tudo pronto, pausa ligada, marca nova: pedir parte de nada pendente e não fica pausado
  await fila.rodar(r, falsos());
  fila.pausar(r, 'aurora');
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, conta: 'aurora.outra' }));
  const q = fila.pedir(r, 'aurora');
  assert.strictEqual(q.estado, 'imagens');
  assert.strictEqual(q.pausada, false);
});
t('A4: "trabalhador" no estado vale só para a própria empresa (a boreal não fica sabendo que a aurora está gerando)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  let estB = null;
  let estA = null;
  const ff = falsos({ aoVideo: () => { if (!estB) { estB = fila.estado(r, 'boreal'); estA = fila.estado(r, 'aurora'); } } });
  await fila.rodar(r, ff);
  assert.strictEqual(estB.trabalhador, false);
  assert.strictEqual(estA.trabalhador, true);
});
t('A5: grade vazia na raiz de dados é "nada a fazer": as imagens nunca são pedidas sem estilos (o comando faria todos)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  for (const id of ['adesivo', 'bloco', 'cartaz']) fs.rmSync(path.join(r, LAB, 'estilos', id), { recursive: true, force: true });
  let chamou = false;
  await fila.rodar(r, { ...falsos(), async gerarImagens() { chamou = true; return { feitos: 0, total: 0, falhas: [], refazer: [] }; } });
  assert.strictEqual(chamou, false);
  assert.strictEqual(lerFilaCrua(r, 'aurora').imagens.estado, 'pronto');
  const r2 = novaRaiz();
  empresaMod.criar('aurora', 'Aurora Nutrição', r2);
  esc(r2, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
  const e = fila.pedir(r2, 'aurora');
  assert.strictEqual(e.estado, 'pronto', 'sem estilo nenhum, nada fica esperando');
  assert.strictEqual(fila.garantirTrabalhador(r2, { lancar: () => { throw new Error('nada a fazer'); } }), false);
  // o passo padrão recusa lista vazia (no gerar-previas.js, sem ids quer dizer "todos os estilos")
  await assert.rejects(() => fila.passosPadrao.gerarImagens(r2, 'aurora', { ids: [] }), /nenhum estilo/);
  assert.strictEqual(fila.passosPadrao.gerarImagens.length >= 0, true);
});
t('A6: a mesma "vez" de um trabalhador que já assumiu não toma o registro dele (só a reserva ainda não assumida vale)', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  esc(r, 'empresas/.fila-previas.json', JSON.stringify({ pid: process.pid, raiz: r, inicio: agoraIso(), batida: agoraIso(), vez: 'vezdooutro' }));
  const res = await fila.rodar(r, { ...falsos(), vez: 'vezdooutro' });
  assert.strictEqual(res.rodou, false);
  assert.strictEqual(JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8')).vez, 'vezdooutro');
});
t('a vez do ambiente (FABRICA_FILA_VEZ) é apagada ao ser lida e não vai para os processos filhos', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  assert.strictEqual(fila.garantirTrabalhador(r, { lancar: () => undefined }), true);
  process.env.FABRICA_FILA_VEZ = JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8')).vez;
  let noFilho = 'nao-vista';
  const ff = falsos({ aoImagens: () => { noFilho = process.env.FABRICA_FILA_VEZ; } });
  const res = await fila.rodar(r, ff);
  assert.strictEqual(res.rodou, true, 'assumiu a reserva pela vez do ambiente');
  assert.strictEqual(noFilho, undefined);
  assert.strictEqual(process.env.FABRICA_FILA_VEZ, undefined);
});
t('trabalhador que perdeu o registro (outro assumiu) para antes do próximo passo e não apaga o registro do outro', async () => {
  const r = raizCompleta();
  fila.pedir(r, 'aurora');
  const ff = falsos({ aoVideo: (c, id) => { if (id === 'adesivo') fs.writeFileSync(arqRegistro(r), JSON.stringify({ pid: process.pid, raiz: r, inicio: agoraIso(), batida: agoraIso(), vez: 'novo-dono' })); } });
  const res = await fila.rodar(r, ff);
  assert.strictEqual(res.rodou, true);
  assert.deepStrictEqual(ff.log, ['imagens:aurora', 'video:aurora:adesivo']);
  assert.strictEqual(JSON.parse(fs.readFileSync(arqRegistro(r), 'utf8')).vez, 'novo-dono');
});

// ---------- linha de comando ----------
function comando(r, ...args) {
  const env = { ...process.env, FABRICA_RAIZ: r };
  delete env.FABRICA_EMPRESA;
  delete env.FABRICA_MARCA;
  const x = spawnSync(process.execPath, [MODULO, ...args], { env, encoding: 'utf8', timeout: 30000, windowsHide: true });
  return { cod: x.status, saida: (x.stdout || '') + (x.stderr || '') };
}
t('linha de comando: estado, pedir, priorizar, pausar, retomar e cancelar em português; recusas saem 1 e uso errado sai 2', () => {
  const r = raizCompleta();
  let x = comando(r, 'pedir', 'cinza', '--sem-trabalhador');
  assert.strictEqual(x.cod, 1, x.saida);
  assert.ok(x.saida.includes('Defina a sua marca antes de ver os estilos nela.'), x.saida);
  x = comando(r, 'pedir', 'aurora', '--sem-trabalhador');
  assert.strictEqual(x.cod, 0, x.saida);
  assert.ok(fs.existsSync(arqFila(r, 'aurora')));
  assert.ok(!fs.existsSync(arqRegistro(r)), '--sem-trabalhador não lança ninguém');
  x = comando(r, 'estado', 'aurora', '--json');
  assert.strictEqual(x.cod, 0, x.saida);
  assert.strictEqual(JSON.parse(x.saida).estado, 'imagens');
  x = comando(r, 'estado', 'aurora');
  assert.strictEqual(x.cod, 0, x.saida);
  assert.ok(/Aurora Nutrição/.test(x.saida) && /0 de 3/.test(x.saida), x.saida);
  assert.ok(!/fila|trabalhador|assinatura|webp|manifesto/i.test(x.saida), 'sem palavra técnica: ' + x.saida);
  x = comando(r, 'priorizar', 'aurora', 'nao-existe', '--sem-trabalhador');
  assert.strictEqual(x.cod, 1, x.saida);
  assert.ok(x.saida.includes('Este estilo não está na biblioteca.'));
  assert.strictEqual(comando(r, 'priorizar', 'aurora', 'cartaz', '--sem-trabalhador').cod, 0);
  assert.strictEqual(lerFilaCrua(r, 'aurora').videos[0].estilo, 'cartaz');
  assert.strictEqual(comando(r, 'pausar', 'aurora').cod, 0);
  assert.strictEqual(lerFilaCrua(r, 'aurora').pausada, true);
  assert.ok(/pausa/i.test(comando(r, 'estado', 'aurora').saida));
  assert.strictEqual(comando(r, 'retomar', 'aurora', '--sem-trabalhador').cod, 0);
  assert.strictEqual(lerFilaCrua(r, 'aurora').pausada, false);
  assert.strictEqual(comando(r, 'cancelar', 'aurora').cod, 0);
  assert.strictEqual(fila.estado(r, 'aurora').estado, 'nada');
  for (const ruim of [['estado', '../x'], ['pedir', 'nao-existe', '--sem-trabalhador']]) assert.strictEqual(comando(r, ...ruim).cod, 1, ruim.join(' '));
  for (const ruim of [[], ['inventado'], ['estado'], ['priorizar', 'aurora'], ['pedir', 'aurora', '--opcao-estranha']]) assert.strictEqual(comando(r, ...ruim).cod, 2, ruim.join(' '));
  assert.ok(!fs.existsSync(arqRegistro(r)));
  assert.ok(!existe(r, 'empresas/boreal/previas'));
});

(async () => {
  let ok = 0;
  let falhas = 0;
  for (const { nome, fn } of casos) {
    try { await fn(); ok++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + (e && e.stack || e)); }
  }
  for (const p of filhos) { try { p.kill(); } catch { /* já saiu */ } }
  await dormir(200);
  for (const p of pastas) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* o sistema limpa depois */ } }
  console.log(`\n${ok} testes passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})();
