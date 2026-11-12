#!/usr/bin/env node
// Instala (ou atualiza) as ferramentas de vídeo da Fábrica SEMPRE na versão mais nova publicada:
// ffmpeg, Tesseract CLI, whisper.cpp (+ modelo de transcrição) e o modelo da máscara da pessoa (RVM).
// Nada aqui pede login nem cadastro: são todos downloads públicos. Roda de novo à vontade (o que já está na versão
// mais nova é pulado).
//
//   node _fabrica/core/ferramentas.js              instala/atualiza tudo
//   node _fabrica/core/ferramentas.js --verificar  só compara o instalado com o mais novo (saída 1 se algo estiver velho)
//   node _fabrica/core/ferramentas.js --simular    mostra o que faria, sem baixar nada
//   --so tesseract,whisper                         limita a algumas ferramentas (ffmpeg, tesseract, whisper, modelo, rvm)
//   --prefixo <pasta>                              instala o Tesseract em outra pasta (testes; padrão %LOCALAPPDATA%\Tesseract)
//
// Só Windows por enquanto (o resto da linha de vídeo também). Em outro sistema, avisa e sai sem erro.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const WHISPER_DIR = path.join(RAIZ, '08-FERRAMENTAS', 'whisper-cpp');
const RVM_DIR = path.join(RAIZ, '08-FERRAMENTAS', 'rvm');
const MODELO_WHISPER = 'ggml-large-v3-turbo-q5_0.bin';
const URL_MODELO_WHISPER = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/' + MODELO_WHISPER;
const MODELO_RVM = 'rvm_mobilenetv3_fp32.onnx';
const URL_MODELO_RVM = 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/' + MODELO_RVM;

// ---------- funções puras (testadas em ferramentas.test.js) ----------

/** "v0.6.0", "tsrct 0.6.0 (abc)", "ffmpeg version 8.1.1-essentials" -> [0, 6, 0]; sem número -> null. */
function versaoDe(texto) {
  const m = String(texto || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}
/** -1, 0 ou 1. Versão ausente (null) é sempre menor. */
function comparar(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  return 0;
}
/** Primeira release (a lista vem da mais nova para a mais antiga) que não é rascunho/pré-lançamento e traz um arquivo que bate com `regex`. */
function escolherRelease(releases, regex) {
  for (const r of releases || []) {
    if (r.draft || r.prerelease) continue;
    const asset = (r.assets || []).find((a) => regex.test(a.name));
    if (asset) return { tag: r.tag_name, versao: versaoDe(r.tag_name), asset };
  }
  return null;
}
/** Conteúdo de um .sha256 ("<hash>  <arquivo>" ou só o hash) -> hash em minúsculas, ou null. */
function lerSha(texto) {
  const m = String(texto || '').trim().match(/^([0-9a-fA-F]{64})\b/);
  return m ? m[1].toLowerCase() : null;
}
const sha256Arquivo = (arq) => crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');

// ---------- rede ----------

const CAB = { 'User-Agent': 'fabrica-de-conteudo', Accept: 'application/vnd.github+json' };

async function json(url) {
  const r = await fetch(url, { headers: CAB });
  if (!r.ok) throw new Error(`não consegui consultar ${url} (HTTP ${r.status})`);
  return r.json();
}

async function baixar(url, destino, rotulo) {
  const r = await fetch(url, { headers: { 'User-Agent': CAB['User-Agent'] }, redirect: 'follow' });
  if (!r.ok) throw new Error(`não consegui baixar ${rotulo || url} (HTTP ${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = destino + '.parte';
  const out = fs.createWriteStream(tmp);
  let lido = 0, marco = 0;
  const t0 = Date.now();
  try {
    for await (const pedaco of r.body) {
      lido += pedaco.length;
      if (!out.write(pedaco)) await new Promise((ok) => out.once('drain', ok));
      if (total && lido / total >= marco + 0.25) { marco = Math.floor((lido / total) * 4) / 4; console.log(`  ${rotulo || path.basename(destino)}: ${Math.round(marco * 100)}%`); }
    }
    await new Promise((ok, erro) => out.end((e) => (e ? erro(e) : ok())));
  } catch (e) { out.destroy(); fs.rmSync(tmp, { force: true }); throw e; }
  if (total && lido !== total) { fs.rmSync(tmp, { force: true }); throw new Error(`download incompleto de ${rotulo || url} (${lido} de ${total} bytes)`); }
  fs.renameSync(tmp, destino);
  console.log(`  ${rotulo || path.basename(destino)}: baixado (${Math.round(lido / 1048576)} MB em ${Math.round((Date.now() - t0) / 1000)} s)`);
}

const ps = (comando) => spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', comando], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
const descompactar = (zip, pasta) => {
  const r = ps(`Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${pasta.replace(/'/g, "''")}' -Force`);
  if (r.status !== 0) throw new Error('não consegui abrir o arquivo baixado: ' + String(r.stderr || r.stdout).trim().split(/\r?\n/)[0]);
};
const pastaTemp = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), nome + '-'));

// ---------- estado instalado ----------

function rodaVersao(cmd, args = ['--version']) {
  // .cmd precisa do cmd.exe; o texto vai entre aspas porque a pasta pode ter espaço
  const r = /\.cmd$/i.test(cmd)
    ? spawnSync('cmd', ['/d', '/s', '/c', '"' + '"' + cmd + '" ' + args.join(' ') + '"'], { encoding: 'utf8', timeout: 20000, windowsVerbatimArguments: true })
    : spawnSync(cmd, args, { encoding: 'utf8', timeout: 20000 });
  return r.status === 0 ? versaoDe(String(r.stdout || r.stderr)) : null;
}
const prefixoTesseract = (opc) => opc.prefixo || path.join(process.env.LOCALAPPDATA || os.homedir(), 'Tesseract');
const tsrctCmd = (opc) => path.join(prefixoTesseract(opc), 'bin', 'tsrct.cmd');

function atualizaPathDoSistema() {
  // Depois de um winget install o PATH desta janela fica velho; relê o do Windows para achar o programa novo sem reabrir nada.
  const r = ps("[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')");
  if (r.status === 0 && r.stdout.trim()) process.env.PATH = r.stdout.trim() + ';' + process.env.PATH;
}

// ---------- ferramentas ----------
// Cada uma tem: id, nome, atual() -> {versao|null, ok}, maisNova() -> {versao, rotulo}, instalar(opc).

const FERRAMENTAS = [
  {
    id: 'ffmpeg',
    nome: 'ffmpeg (áudio e vídeo)',
    atual: () => ({ versao: rodaVersao('ffmpeg', ['-version']), ok: !!rodaVersao('ffmpeg', ['-version']) && !!rodaVersao('ffprobe', ['-version']) }),
    maisNova: async () => {
      // O winget sempre instala a mais nova do ffmpeg; consultar o site do ffmpeg é frágil. Compara pelo "winget upgrade".
      const r = spawnSync('winget', ['upgrade', '--id', 'Gyan.FFmpeg', '--accept-source-agreements'], { encoding: 'utf8', timeout: 120000 });
      const saida = String(r.stdout || '');
      const tem = /Gyan\.FFmpeg/i.test(saida) && /\d+\.\d+/.test(saida.split(/Gyan\.FFmpeg/i)[1] || '');
      return { versao: null, rotulo: tem ? 'há versão nova' : 'já é a mais nova', desatualizado: tem };
    },
    instalar: () => {
      const instalado = !!rodaVersao('ffmpeg', ['-version']);
      const args = instalado
        ? ['upgrade', '-e', '--id', 'Gyan.FFmpeg', '--accept-package-agreements', '--accept-source-agreements', '--silent']
        : ['install', '-e', '--id', 'Gyan.FFmpeg', '--accept-package-agreements', '--accept-source-agreements', '--silent'];
      const r = spawnSync('winget', args, { encoding: 'utf8', timeout: 20 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
      // winget devolve código diferente de 0 quando "já está na versão mais nova"; o que vale é o programa rodar depois
      atualizaPathDoSistema();
      if (!rodaVersao('ffmpeg', ['-version'])) throw new Error('o ffmpeg não ficou disponível depois da instalação' + (r.error ? ': ' + r.error.message : ''));
    },
  },
  {
    id: 'tesseract',
    nome: 'Tesseract CLI (montagem de vídeo)',
    atual: (opc) => { const v = fs.existsSync(tsrctCmd(opc)) ? rodaVersao(tsrctCmd(opc)) : null; return { versao: v, ok: !!v }; },
    maisNova: async () => {
      const lista = await json('https://api.github.com/repos/mirage-hq/Tesseract/releases?per_page=15');
      const rel = escolherRelease(lista, /^tesseract-\d+\.\d+\.\d+-windows-x86_64\.zip$/);
      if (!rel) throw new Error('não achei o Tesseract para Windows nas versões publicadas');
      return { versao: rel.versao, rotulo: rel.tag, release: rel, lista };
    },
    instalar: async (opc, ultima) => {
      const rel = ultima.release;
      const zipUrl = rel.asset.browser_download_url;
      const shaAsset = (ultima.lista.find((r) => r.tag_name === rel.tag).assets || []).find((a) => a.name === rel.asset.name + '.sha256');
      if (!shaAsset) throw new Error('a versão ' + rel.tag + ' veio sem o arquivo de conferência (.sha256); não vou instalar sem conferir');
      const tmp = pastaTemp('fabrica-tsrct');
      try {
        const zip = path.join(tmp, rel.asset.name);
        await baixar(zipUrl, zip, 'Tesseract ' + rel.tag);
        const esperado = lerSha(await (await fetch(shaAsset.browser_download_url, { headers: { 'User-Agent': CAB['User-Agent'] } })).text());
        if (!esperado || sha256Arquivo(zip) !== esperado) throw new Error('o arquivo do Tesseract baixado não confere com o checksum; baixe de novo');
        const dest = path.join(tmp, 'extraido');
        descompactar(zip, dest);
        const instalador = [dest, ...fs.readdirSync(dest).map((n) => path.join(dest, n))].map((d) => path.join(d, 'install.ps1')).find((f) => fs.existsSync(f));
        if (!instalador) throw new Error('o pacote do Tesseract veio sem o instalador (install.ps1)');
        const args = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', instalador];
        if (opc.prefixo) args.push('-Prefix', opc.prefixo);
        const r = spawnSync('powershell', args, { encoding: 'utf8', timeout: 10 * 60 * 1000 });
        if (r.status !== 0) throw new Error('o instalador do Tesseract falhou: ' + String(r.stderr || r.stdout).trim().split(/\r?\n/).slice(-2).join(' | '));
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
      const v = rodaVersao(tsrctCmd(opc));
      if (comparar(v, rel.versao) < 0) throw new Error(`o Tesseract continua na ${v ? v.join('.') : 'versão desconhecida'}; esperado ${rel.tag}`);
    },
  },
  {
    id: 'whisper',
    nome: 'whisper.cpp (transcrição da fala)',
    atual: () => {
      const exe = path.join(WHISPER_DIR, 'bin', 'Release', 'whisper-cli.exe');
      let versao = null;
      try { versao = JSON.parse(fs.readFileSync(path.join(WHISPER_DIR, 'versao.json'), 'utf8')).versao; } catch { /* sem registro */ }
      return { versao: versao ? versaoDe(versao) : null, ok: fs.existsSync(exe), registrada: versao };
    },
    maisNova: async () => {
      // As versões marcadas (v1.9.x) às vezes saem sem os programas prontos para Windows: pega a mais nova que TRAZ o programa.
      const lista = await json('https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=40');
      const rel = escolherRelease(lista, /^whisper-bin-x64\.zip$/);
      if (!rel) throw new Error('não achei o whisper.cpp para Windows nas versões publicadas');
      return { versao: rel.versao, rotulo: rel.tag, release: rel };
    },
    instalar: async (opc, ultima) => {
      const rel = ultima.release;
      const tmp = pastaTemp('fabrica-whisper');
      try {
        const zip = path.join(tmp, 'whisper.zip');
        await baixar(rel.asset.browser_download_url, zip, 'whisper.cpp ' + rel.tag);
        const dest = path.join(tmp, 'extraido');
        descompactar(zip, dest);
        const origem = path.join(dest, 'Release');
        if (!fs.existsSync(path.join(origem, 'whisper-cli.exe'))) throw new Error('o pacote do whisper.cpp veio sem o whisper-cli.exe');
        const alvo = path.join(WHISPER_DIR, 'bin', 'Release');
        fs.rmSync(alvo, { recursive: true, force: true });
        fs.mkdirSync(path.dirname(alvo), { recursive: true });
        fs.cpSync(origem, alvo, { recursive: true });
        fs.writeFileSync(path.join(WHISPER_DIR, 'versao.json'), JSON.stringify({ versao: rel.tag, instaladoEm: new Date().toISOString() }, null, 2));
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    },
  },
  {
    id: 'modelo',
    nome: 'Modelo de transcrição do whisper (' + MODELO_WHISPER + ', ~570 MB)',
    atual: () => ({ versao: null, ok: modeloCompleto(path.join(WHISPER_DIR, 'modelos', MODELO_WHISPER), 500e6) }),
    maisNova: async () => ({ versao: null, rotulo: 'arquivo único, não tem versões' }),
    instalar: async () => baixar(URL_MODELO_WHISPER, path.join(WHISPER_DIR, 'modelos', MODELO_WHISPER), 'modelo de transcrição (grande, pode demorar)'),
  },
  {
    id: 'rvm',
    nome: 'Modelo da máscara da pessoa (' + MODELO_RVM + ', ~15 MB)',
    atual: () => ({ versao: null, ok: modeloCompleto(path.join(RVM_DIR, MODELO_RVM), 10e6) }),
    maisNova: async () => ({ versao: null, rotulo: 'arquivo único, não tem versões' }),
    instalar: async () => baixar(URL_MODELO_RVM, path.join(RVM_DIR, MODELO_RVM), 'modelo da máscara'),
  },
];

function modeloCompleto(arq, minimo) {
  try { return fs.statSync(arq).size >= minimo; } catch { return false; }
}

// ---------- orquestração ----------

/** Compara cada ferramenta com a versão mais nova. Devolve [{id, nome, instalada, maisNova, precisa, motivo}]. */
async function verificar(opc = {}, ids = FERRAMENTAS.map((f) => f.id)) {
  const saida = [];
  for (const f of FERRAMENTAS.filter((x) => ids.includes(x.id))) {
    const atual = f.atual(opc);
    let nova = null, erro = '';
    try { nova = await f.maisNova(); } catch (e) { erro = e.message; }
    let precisa, motivo;
    if (!atual.ok) { precisa = true; motivo = 'não está instalado'; }
    else if (nova && nova.versao && comparar(atual.versao || versaoDe(atual.registrada), nova.versao) < 0) { precisa = true; motivo = `está na ${(atual.versao || versaoDe(atual.registrada) || ['?']).join('.')}, a mais nova é a ${nova.rotulo}`; }
    else if (nova && nova.desatualizado) { precisa = true; motivo = nova.rotulo; }
    else { precisa = false; motivo = 'já está na versão mais nova'; }
    saida.push({ id: f.id, nome: f.nome, instalada: atual.ok, versaoInstalada: (atual.versao || versaoDe(atual.registrada) || []).join('.') || null, maisNova: nova ? nova.rotulo : null, precisa, motivo, erroConsulta: erro, _nova: nova });
  }
  return saida;
}

async function main() {
  const args = process.argv.slice(2);
  const tem = (n) => args.includes('--' + n);
  const val = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  const opc = { prefixo: val('prefixo') };
  const ids = val('so') ? val('so').split(',') : FERRAMENTAS.map((f) => f.id);

  if (process.platform !== 'win32') {
    console.log('A parte de vídeo da Fábrica só funciona no Windows por enquanto. Nada a instalar aqui.');
    return 0;
  }
  const estado = await verificar(opc, ids);
  if (tem('verificar') || tem('simular')) {
    for (const e of estado) console.log(`${e.precisa ? 'PRECISA ' : 'OK      '} ${e.nome}: ${e.motivo}${e.erroConsulta ? ' (aviso: ' + e.erroConsulta + ')' : ''}`);
    return tem('verificar') && estado.some((e) => e.precisa) ? 1 : 0;
  }
  let falhou = false;
  const fazer = estado.filter((e) => e.precisa);
  console.log(fazer.length ? `Vou instalar ou atualizar ${fazer.length} ferramenta(s) de vídeo.` : 'Todas as ferramentas de vídeo já estão na versão mais nova.');
  let i = 0;
  for (const e of fazer) {
    i++;
    console.log(`FERRAMENTA ${i} de ${fazer.length}: ${e.nome} (${e.motivo})`);
    try {
      await FERRAMENTAS.find((f) => f.id === e.id).instalar(opc, e._nova);
      console.log('FEITO');
    } catch (erro) { falhou = true; console.log('PROBLEMA: ' + erro.message); }
  }
  console.log(falhou ? 'RESULTADO: faltou terminar alguma ferramenta. Rode de novo: o que já está pronto é pulado.' : 'RESULTADO: ferramentas de vídeo prontas.');
  return falhou ? 1 : 0;
}

module.exports = { versaoDe, comparar, escolherRelease, lerSha, verificar, FERRAMENTAS };
if (require.main === module) main().then((c) => process.exit(c), (e) => { console.log('PROBLEMA: ' + e.message); process.exit(1); });
