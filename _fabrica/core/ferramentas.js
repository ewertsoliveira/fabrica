#!/usr/bin/env node
// Instala (ou atualiza) as ferramentas de vídeo da Fábrica SEMPRE na versão mais nova publicada, no Windows e no Mac:
// ffmpeg, modelo de transcrição, whisper.cpp, Tesseract CLI e o modelo da máscara da pessoa (RVM).
// Nada aqui pede login nem cadastro: são todos downloads públicos. Roda de novo à vontade (o que já está na versão
// mais nova é pulado).
//
//   node _fabrica/core/ferramentas.js              instala/atualiza tudo
//   node _fabrica/core/ferramentas.js --verificar  só compara o instalado com o mais novo (saída 1 se algo estiver velho)
//   node _fabrica/core/ferramentas.js --simular    mostra o que faria, sem baixar nada
//   --so tesseract,whisper                         limita a algumas ferramentas (ffmpeg, modelo, whisper, tesseract, rvm)
//   --prefixo <pasta>                              instala o Tesseract em outra pasta (testes)
//
// De onde vem cada uma:
//   Windows: ffmpeg pelo winget; Tesseract (pacote windows-x86_64) e whisper.cpp (whisper-bin-x64.zip) do GitHub.
//   Mac:     ffmpeg assinado do ffmpeg.martin-riedl.de (chip Apple ou Intel), na pasta 08-FERRAMENTAS/ffmpeg; Tesseract
//            oficial (darwin-arm64 ou darwin-x86_64, macOS 14 ou mais novo); whisper.cpp compilado na própria máquina
//            (compilar-whisper.js), da mesma etiqueta do Windows.
// Linux: a parte de vídeo não está disponível; avisa e sai sem erro.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { caminho, sistema, linhaCmd } = require('./programas');
const { json, texto, baixar, baixarConferido, lerSha } = require('./rede');
const { compilarWhisper } = require('./compilar-whisper');

const RAIZ = path.resolve(__dirname, '..', '..');
const WHISPER_DIR = path.join(RAIZ, '08-FERRAMENTAS', 'whisper-cpp');
const FFMPEG_DIR = path.join(RAIZ, '08-FERRAMENTAS', 'ffmpeg');
const RVM_DIR = path.join(RAIZ, '08-FERRAMENTAS', 'rvm');
const MODELO_WHISPER = 'ggml-large-v3-turbo-q5_0.bin';
const URL_MODELO_WHISPER = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/' + MODELO_WHISPER;
const MODELO_RVM = 'rvm_mobilenetv3_fp32.onnx';
const URL_MODELO_RVM = 'https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/' + MODELO_RVM;

/** O que o versao.json do whisper registra ({ versao: etiqueta, publicadoEm, instaladoEm }), ou null. */
function registroWhisper(dir = WHISPER_DIR) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'versao.json'), 'utf8')); } catch { return null; }
}

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
/** Primeira release (a lista vem da mais nova para a mais antiga) que não é rascunho (nem pré-lançamento, salvo com
 *  `aceitarPre`) e traz um arquivo que bate com `regex`. */
function escolherRelease(releases, regex, { aceitarPre = false } = {}) {
  for (const r of releases || []) {
    if (r.draft || (r.prerelease && !aceitarPre)) continue;
    const asset = (r.assets || []).find((a) => regex.test(a.name));
    if (asset) return { tag: r.tag_name, versao: versaoDe(r.tag_name), asset };
  }
  return null;
}
/** whisper.cpp: a release publicada por último que traz o programa pronto do Windows (as versões numeradas bNNNN vêm
 *  marcadas como pré-lançamento e as etiquetas v1.9.x saem sem arquivos). O Mac compila a mesma etiqueta. */
function etiquetaWhisper(releases) {
  const comPrograma = (releases || []).filter((r) => !r.draft && (r.assets || []).some((a) => a.name === 'whisper-bin-x64.zip'));
  comPrograma.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
  const r = comPrograma[0];
  return r ? { tag: r.tag_name, publicado: r.published_at || null, asset: r.assets.find((a) => a.name === 'whisper-bin-x64.zip') } : null;
}
/** Precisa trocar o whisper? Pela etiqueta e pela data de publicação (bNNNN não tem x.y.z para comparar). */
function whisperPrecisa(registro, nova) {
  if (!registro || !registro.versao) return true;
  if (registro.versao === nova.tag) return false;
  if (!registro.publicadoEm || !nova.publicado) return true;
  return Date.parse(nova.publicado) > Date.parse(registro.publicadoEm);
}
/** Nome do pacote do Tesseract para este sistema (no Windows só existe o x86_64), ou null se não houver. */
function pacoteTesseract(sis) {
  if (sis.plataforma === 'win32') return /^tesseract-\d+\.\d+\.\d+-windows-x86_64\.zip$/;
  if (sis.plataforma === 'darwin') return sis.arq === 'arm64' ? /^tesseract-\d+\.\d+\.\d+-darwin-arm64\.zip$/ : /^tesseract-\d+\.\d+\.\d+-darwin-x86_64\.zip$/;
  return null;
}
/** Link fixo da última versão estável do ffmpeg (ou ffprobe) para Mac, na arquitetura deste computador. */
const urlFfmpegMac = (sis, nome) => `https://ffmpeg.martin-riedl.de/redirect/latest/macos/${sis.arq === 'arm64' ? 'arm64' : 'amd64'}/release/${nome}.zip`;
/** A versão que vem no caminho para onde o link fixo redireciona (/download/macos/<arq>/<carimbo>_<versão>/ffmpeg.zip). */
function versaoDoCaminhoFfmpeg(local) {
  const m = String(local || '').match(/\/download\/macos\/[^/]+\/\d+_(\d+(?:\.\d+){1,2})\//);
  return m ? versaoDe(m[1]) : null;
}
/** O Tesseract exige macOS 14 ou mais novo (nas duas arquiteturas). */
const macosSuportado = (macos) => !!macos && comparar(macos, [14, 0, 0]) >= 0;
/** "v0.8.0" e "0.8.0", "9.1" e "9.1.0" são a mesma versão; etiquetas sem número (b5907) comparam pelo texto. */
function mesmaVersao(a, b) {
  const va = versaoDe(a), vb = versaoDe(b);
  return va && vb ? comparar(va, vb) === 0 : String(a) === String(b);
}
/**
 * O que fazer com uma ferramenta que precisa de atenção:
 *   manter          a consulta falhou (ou não há o que instalar) e fica o que está;
 *   usar-testada    nada instalado e a mais nova não serve (sem consulta, ou já recusada): instala a versão da lista de testadas;
 *   pular-recusada  a mais nova já foi recusada no teste neste computador;
 *   testar-nova     instala a mais nova à parte e testa.
 */
function decidir({ instalada, nova, recusadas = [], testada = null }) {
  if (!nova) return !instalada && testada ? 'usar-testada' : 'manter';
  if (recusadas.some((v) => mesmaVersao(v, nova.rotulo))) {
    return !instalada && testada && !mesmaVersao(testada.rotulo, nova.rotulo) ? 'usar-testada' : 'pular-recusada';
  }
  return 'testar-nova';
}
/** Frases para a pessoa (regra L-01: sem nome interno). `n` é o nome simples do programa. */
const FRASES = {
  passou: (n) => `Atualizei o ${n} e fiz um teste rápido: está tudo certo.`,
  instalou: (n) => `Instalei o ${n} e fiz um teste rápido: está tudo certo.`,
  falhou: (n) => `Saiu uma versão nova do ${n}, mas ela não passou no meu teste. Continuo com a versão que já funcionava; para você, nada muda.`,
  semInternet: 'Não consegui ver se há versão nova agora. Sigo com a que já está instalada e funcionando.',
  falhouPrimeira: (n) => `A versão mais nova do ${n} não passou no meu teste neste computador. Vou instalar a última versão que a Fábrica já testou.`,
  semReserva: (n) => `O ${n} não passou no meu teste neste computador, e não há outra versão testada para instalar. Essa parte ficou faltando.`,
  instalouTestada: (n) => `Instalei o ${n} na versão que a Fábrica já testou e fiz um teste rápido: está tudo certo.`,
  recusada: (n, v) => `A versão ${v} do ${n} não passou no meu teste antes; continuo com a que funciona.`,
};

// ---------- arquivos e programas ----------

const ps = (comando) => spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', comando], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
/** Abre um .zip numa pasta: PowerShell no Windows, ditto no Mac (preserva a assinatura dos programas), unzip no Linux. */
function descompactar(zip, pasta, sis = sistema()) {
  fs.mkdirSync(pasta, { recursive: true });
  const r = sis.plataforma === 'win32'
    ? ps(`Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${pasta.replace(/'/g, "''")}' -Force`)
    : sis.plataforma === 'darwin'
      ? spawnSync('ditto', ['-x', '-k', zip, pasta], { encoding: 'utf8', timeout: 10 * 60 * 1000 })
      : spawnSync('unzip', ['-q', '-o', zip, '-d', pasta], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  if (r.status !== 0) throw new Error('não consegui abrir o arquivo baixado: ' + String(r.stderr || r.stdout || (r.error && r.error.message) || '').trim().split(/\r?\n/)[0]);
}
const pastaTemp = (nome) => fs.mkdtempSync(path.join(os.tmpdir(), nome + '-'));
const ultimasLinhas = (r) => String(r.stderr || r.stdout || '').trim().split(/\r?\n/).slice(-2).join(' | ');
/** Primeiro arquivo com esse nome dentro da pasta (procura nas subpastas). */
function acharArquivo(pasta, nome) {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    const p = path.join(pasta, e.name);
    if (e.isFile() && e.name === nome) return p;
    if (e.isDirectory()) { const achou = acharArquivo(p, nome); if (achou) return achou; }
  }
  return null;
}

function rodaVersao(cmd, args = ['--version']) {
  // .cmd precisa do cmd.exe, com aspas (a pasta pode ter espaço)
  const r = /\.cmd$/i.test(cmd)
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', linhaCmd([cmd, ...args])], { encoding: 'utf8', timeout: 20000, windowsVerbatimArguments: true })
    : spawnSync(cmd, args, { encoding: 'utf8', timeout: 20000 });
  return r.status === 0 ? versaoDe(String(r.stdout || r.stderr)) : null;
}
/** Pasta pedida para o Tesseract (a variável dos testes isolados vence, como no programas.js); null = a padrão. */
const prefixoPedido = (opc = {}) => process.env.FABRICA_TESSERACT_PREFIXO || opc.prefixo || null;
const tsrctDe = (opc = {}) => caminho('tsrct', { prefixo: opc.prefixo });

function atualizaPathDoSistema() {
  // Depois de um winget install o PATH desta janela fica velho; relê o do Windows para achar o programa novo sem reabrir nada.
  const r = ps("[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')");
  if (r.status === 0 && r.stdout.trim()) process.env.PATH = r.stdout.trim() + ';' + process.env.PATH;
}

/** Id do pacote do ffmpeg que o winget já instalou ("Gyan.FFmpeg", "Gyan.FFmpeg.Essentials"...) na tabela do
 *  "winget list"; null se nenhum. O "Essentials" vem primeiro: é o mesmo programa, e muita máquina já tem esse. */
function pacoteNaLista(saida) {
  const s = String(saida || '');
  // a tabela do winget corta id comprido numa janela estreita ("Gyan.FFmpeg.Ess…"): vale o começo do sufixo
  if (/\bGyan\.FFmpeg\.E/.test(s)) return 'Gyan.FFmpeg.Essentials';
  if (/\bGyan\.FFmpeg\.S/.test(s)) return 'Gyan.FFmpeg.Shared';
  return /\bGyan\.FFmpeg(?![.\w])/.test(s) ? 'Gyan.FFmpeg' : null;
}
function pacoteFfmpeg() {
  const r = spawnSync('winget', ['list', '--id', 'Gyan.FFmpeg', '--accept-source-agreements'], { encoding: 'utf8', timeout: 120000 });
  return pacoteNaLista(r.stdout);
}
/** Consulta se o winget tem versão nova do pacote SEM instalar ("winget upgrade --id" instala de verdade). */
const argsConsultaFfmpeg = (id) => ['list', '--id', id, '-e', '--upgrade-available', '--accept-source-agreements'];

// ---------- instaladores (cada um põe o programa no destino pedido; o fluxo com autoteste decide qual destino) ----------

/** Baixa e confere o pacote do Tesseract numa pasta temporária `tmp` e roda o instalador oficial com o prefixo pedido.
 *  Não apaga a pasta extraída: quem chama apaga (o fluxo com autoteste reaproveita a mesma pasta para pôr em uso). */
async function instalarTesseract({ release, lista, prefixo, sis = sistema(), tmp }) {
  const rel = (lista || []).find((r) => r.tag_name === release.tag) || { assets: [] };
  const shaAsset = (rel.assets || []).find((a) => a.name === release.asset.name + '.sha256');
  if (!shaAsset) throw new Error('a versão ' + release.tag + ' veio sem o arquivo de conferência (.sha256); não vou instalar sem conferir');
  const zip = path.join(tmp, release.asset.name);
  await baixarConferido(release.asset.browser_download_url, zip, lerSha(await texto(shaAsset.browser_download_url)), 'Tesseract ' + release.tag);
  const pastaExtraida = path.join(tmp, 'extraido');
  descompactar(zip, pastaExtraida, sis);
  fs.rmSync(zip, { force: true });
  rodarInstaladorTesseract(pastaExtraida, prefixo, sis);
  return { pastaExtraida };
}
/** Roda o instalador oficial que vem no pacote (install.ps1 no Windows, install.sh no Mac). */
function rodarInstaladorTesseract(pastaExtraida, prefixo, sis = sistema()) {
  const nome = sis.plataforma === 'win32' ? 'install.ps1' : 'install.sh';
  const instalador = [pastaExtraida, ...fs.readdirSync(pastaExtraida).map((n) => path.join(pastaExtraida, n))]
    .map((d) => path.join(d, nome)).find((f) => fs.existsSync(f));
  if (!instalador) throw new Error(`o pacote do Tesseract veio sem o instalador (${nome})`);
  const r = sis.plataforma === 'win32'
    ? spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', instalador, ...(prefixo ? ['-Prefix', prefixo] : [])], { encoding: 'utf8', timeout: 10 * 60 * 1000 })
    : spawnSync('bash', [instalador, ...(prefixo ? [prefixo] : [])], { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  if (r.status !== 0) throw new Error('o instalador do Tesseract falhou: ' + ultimasLinhas(r));
}

/** A versão estável mais nova do ffmpeg para Mac e os endereços de download (do redirecionamento do link fixo). */
async function ultimaFfmpegMac(sis = sistema()) {
  const urls = {};
  let versao = null;
  for (const nome of ['ffmpeg', 'ffprobe']) {
    const fixo = urlFfmpegMac(sis, nome);
    const r = await fetch(fixo, { headers: { 'User-Agent': 'fabrica-de-conteudo' }, redirect: 'manual' });
    const local = r.headers.get('location');
    if (!local) throw new Error(`não consegui ver a versão mais nova do ${nome} para Mac (HTTP ${r.status})`);
    urls[nome] = new URL(local, fixo).href;
    if (nome === 'ffmpeg') versao = versaoDoCaminhoFfmpeg(urls[nome]);
  }
  if (!versao) throw new Error('não consegui ler a versão mais nova do ffmpeg para Mac');
  return { versao, rotulo: versao.join('.'), urls };
}
/** Baixa e confere ffmpeg e ffprobe para <destino>/bin (Mac). */
async function instalarFfmpegMac({ destino, sis = sistema(), ultima }) {
  const u = ultima || await ultimaFfmpegMac(sis);
  const tmp = pastaTemp('fabrica-ffmpeg');
  try {
    fs.mkdirSync(path.join(destino, 'bin'), { recursive: true });
    for (const nome of ['ffmpeg', 'ffprobe']) {
      const zip = path.join(tmp, nome + '.zip');
      await baixarConferido(u.urls[nome], zip, lerSha(await texto(u.urls[nome] + '.sha256')), `${nome} ${u.rotulo}`);
      descompactar(zip, path.join(tmp, nome), sis);
      const exe = acharArquivo(path.join(tmp, nome), nome);
      if (!exe) throw new Error(`o pacote do ${nome} veio sem o programa`);
      fs.copyFileSync(exe, path.join(destino, 'bin', nome));
      fs.chmodSync(path.join(destino, 'bin', nome), 0o755);
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const v = rodaVersao(path.join(destino, 'bin', 'ffmpeg'), ['-version']);
  if (!v) throw new Error('o ffmpeg baixado não abriu neste Mac');
  fs.writeFileSync(path.join(destino, 'versao.json'), JSON.stringify({ versao: u.rotulo, instaladoEm: new Date().toISOString() }, null, 2));
  return { versao: v };
}

/** Baixa o whisper.cpp pronto do Windows para <destino>/bin/Release. */
async function instalarWhisperWindows({ release, destino }) {
  const tmp = pastaTemp('fabrica-whisper');
  try {
    const zip = path.join(tmp, 'whisper.zip');
    await baixar(release.asset.browser_download_url, zip, 'whisper.cpp ' + release.tag);
    const dest = path.join(tmp, 'extraido');
    descompactar(zip, dest);
    const origem = path.join(dest, 'Release');
    if (!fs.existsSync(path.join(origem, 'whisper-cli.exe'))) throw new Error('o pacote do whisper.cpp veio sem o whisper-cli.exe');
    const alvo = path.join(destino, 'bin', 'Release');
    fs.rmSync(alvo, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.cpSync(origem, alvo, { recursive: true });
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
/** Põe o whisper da etiqueta pedida em <destino> (Windows: pronto; Mac: compilado) e grava o versao.json. */
async function instalarWhisper({ release, destino, sis = sistema() }) {
  if (sis.plataforma === 'darwin') await compilarWhisper({ etiqueta: release.tag, destino, sis });
  else await instalarWhisperWindows({ release, destino });
  fs.writeFileSync(path.join(destino, 'versao.json'), JSON.stringify({ versao: release.tag, publicadoEm: release.publicado, instaladoEm: new Date().toISOString() }, null, 2));
}

function modeloCompleto(arq, minimo) {
  try { return fs.statSync(arq).size >= minimo; } catch { return false; }
}

/** Renomeia tentando de novo quando a pasta está presa por um instante (no Windows, o antivírus lê o programa recém-baixado). */
function renomearComCalma(de, para, renomear, esperas) {
  let ultimo;
  for (const ms of esperas) {
    if (ms) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    try { renomear(de, para); return; } catch (e) { ultimo = e; if (!/^(EBUSY|EPERM|EACCES)$/.test(e.code || '')) throw e; }
  }
  throw ultimo;
}
/** Põe a candidata em uso: `dir/bin` vai para `dir/anterior/bin` (a anterior da vez passada sai) e `candidata/bin` entra.
 *  Se a candidata não conseguir entrar, a versão em uso volta para o lugar (nunca fica sem nenhuma). */
function trocarPasta(dir, cand, { renomear = fs.renameSync, esperas = [0, 300, 1500, 4000] } = {}) {
  const anterior = path.join(dir, 'anterior');
  fs.rmSync(anterior, { recursive: true, force: true });
  const tinha = fs.existsSync(path.join(dir, 'bin'));
  if (tinha) {
    fs.mkdirSync(anterior, { recursive: true });
    renomearComCalma(path.join(dir, 'bin'), path.join(anterior, 'bin'), renomear, esperas);
    if (fs.existsSync(path.join(dir, 'versao.json'))) fs.copyFileSync(path.join(dir, 'versao.json'), path.join(anterior, 'versao.json'));
  }
  try { renomearComCalma(path.join(cand, 'bin'), path.join(dir, 'bin'), renomear, esperas); } catch (e) {
    if (tinha) renomearComCalma(path.join(anterior, 'bin'), path.join(dir, 'bin'), renomear, esperas);
    throw e;
  }
  if (fs.existsSync(path.join(cand, 'versao.json'))) fs.copyFileSync(path.join(cand, 'versao.json'), path.join(dir, 'versao.json'));
  fs.rmSync(cand, { recursive: true, force: true });
}

// ---------- registro local e versões testadas ----------

const ARQ_ESTADO = (raiz) => path.join(raiz, '08-FERRAMENTAS', '.estado-ferramentas.json');
/** Registro deste computador: { ferramentas: { <id>: { emUso, ultimoTeste: { data, ok, detalhe }, recusadas: [] } } }. */
function lerEstado(raiz = RAIZ) {
  try { const e = JSON.parse(fs.readFileSync(ARQ_ESTADO(raiz), 'utf8')); return e && e.ferramentas ? e : { ferramentas: {} }; } catch { return { ferramentas: {} }; }
}
function gravarEstado(raiz, estado) {
  fs.mkdirSync(path.dirname(ARQ_ESTADO(raiz)), { recursive: true });
  fs.writeFileSync(ARQ_ESTADO(raiz), JSON.stringify(estado, null, 2));
}
/** A lista de versões testadas por quem mantém a Fábrica (_fabrica/core/versoes-testadas.json). */
function lerTestadas(raiz = RAIZ) {
  try { return JSON.parse(fs.readFileSync(path.join(raiz, '_fabrica', 'core', 'versoes-testadas.json'), 'utf8')); } catch { return {}; }
}
/** A versão testada de uma ferramenta, pronta para instalar sem consultar o GitHub: { rotulo, nova } ou null. */
function versaoTestada(id, testadas = lerTestadas(), sis = sistema()) {
  if (id === 'tesseract' && testadas.tesseract && pacoteTesseract(sis)) {
    const v = testadas.tesseract.versao;
    const plat = sis.plataforma === 'win32' ? 'windows-x86_64' : sis.arq === 'arm64' ? 'darwin-arm64' : 'darwin-x86_64';
    const nome = `tesseract-${v}-${plat}.zip`;
    const url = `https://github.com/mirage-hq/Tesseract/releases/download/v${v}/${nome}`;
    const release = { tag: 'v' + v, versao: versaoDe(v), asset: { name: nome, browser_download_url: url } };
    return { rotulo: 'v' + v, nova: { versao: versaoDe(v), rotulo: 'v' + v, release, lista: [{ tag_name: 'v' + v, assets: [{ name: nome + '.sha256', browser_download_url: url + '.sha256' }] }] } };
  }
  if (id === 'whisper' && testadas.whisper) {
    const tag = testadas.whisper.etiqueta;
    const release = { tag, publicado: testadas.whisper.publicado || null, asset: { browser_download_url: `https://github.com/ggml-org/whisper.cpp/releases/download/${tag}/whisper-bin-x64.zip` } };
    return { rotulo: tag, nova: { versao: null, rotulo: tag, release } };
  }
  if (id === 'ffmpeg' && sis.plataforma === 'darwin' && testadas['ffmpeg-mac']) {
    const t = testadas['ffmpeg-mac'];
    const a = t[sis.arq === 'arm64' ? 'arm64' : 'amd64'];
    if (!a) return null;
    const base = 'https://ffmpeg.martin-riedl.de';
    const versao = versaoDe(t.versao);
    return { rotulo: t.versao, nova: { versao, rotulo: versao.join('.'), urls: { ffmpeg: base + a.ffmpeg, ffprobe: base + a.ffprobe } } };
  }
  return null;
}

// ---------- ferramentas ----------
// Cada uma tem: id, nome, atual() -> {versao|null, ok}, maisNova() -> {versao, rotulo}, instalar(opc).
// A ordem conta: o autoteste do whisper usa o modelo, e o do Tesseract usa um vídeo feito pelo ffmpeg.

const FERRAMENTAS = [
  {
    id: 'ffmpeg',
    nome: 'ffmpeg (áudio e vídeo)',
    nomeSimples: 'programa que trata o áudio e o vídeo',
    testes: ['ffmpeg'],
    // no Windows o winget atualiza no lugar (não dá para instalar à parte): atualiza, testa e, se falhar, volta pelo winget
    semCandidata: () => sistema().plataforma === 'win32',
    prepararCandidata: async (opc, nova) => {
      const cand = path.join(FFMPEG_DIR, 'candidata');
      fs.rmSync(cand, { recursive: true, force: true });
      try { await instalarFfmpegMac({ destino: cand, ultima: nova }); } catch (e) { fs.rmSync(cand, { recursive: true, force: true }); throw e; }
      return { env: { FABRICA_FFMPEG_DIR: path.join(cand, 'bin') }, porEmUso: async () => trocarPasta(FFMPEG_DIR, cand), descartar: () => fs.rmSync(cand, { recursive: true, force: true }) };
    },
    atual: () => {
      if (sistema().plataforma === 'darwin') {
        // no Mac vale a cópia da Fábrica (com os codificadores que ela usa), não um ffmpeg que esteja no PATH
        const ff = path.join(FFMPEG_DIR, 'bin', 'ffmpeg');
        const v = fs.existsSync(ff) ? rodaVersao(ff, ['-version']) : null;
        return { versao: v, ok: !!v && fs.existsSync(path.join(FFMPEG_DIR, 'bin', 'ffprobe')) };
      }
      return { versao: rodaVersao('ffmpeg', ['-version']), ok: !!rodaVersao('ffmpeg', ['-version']) && !!rodaVersao('ffprobe', ['-version']) };
    },
    maisNova: async () => {
      if (sistema().plataforma === 'darwin') return ultimaFfmpegMac();
      // O winget sempre instala a mais nova do ffmpeg; consultar o site do ffmpeg é frágil. Pergunta ao winget, só
      // consultando, se há versão nova do pacote que já está instalado (Gyan.FFmpeg ou Gyan.FFmpeg.Essentials: o mesmo
      // programa com outro nome)
      const id = pacoteFfmpeg() || 'Gyan.FFmpeg';
      const r = spawnSync('winget', argsConsultaFfmpeg(id), { encoding: 'utf8', timeout: 120000 });
      const saida = String(r.stdout || '');
      const tem = saida.includes(id) && /\d+\.\d+/.test(saida.split(id)[1] || '');
      return { versao: null, rotulo: tem ? 'há versão nova' : 'já é a mais nova', desatualizado: tem };
    },
    instalar: async (opc, ultima) => {
      if (sistema().plataforma === 'darwin') { await instalarFfmpegMac({ destino: FFMPEG_DIR, ultima }); return; }
      const instalado = !!rodaVersao('ffmpeg', ['-version']);
      const id = pacoteFfmpeg();
      // ffmpeg que veio de outro lugar (outro pacote do winget, instalação à mão): não instala um segundo no PATH
      if (instalado && !id) {
        console.log('  o ffmpeg deste computador não veio do winget (Gyan.FFmpeg); mantido como está. Para atualizar, use o mesmo caminho por onde ele foi instalado.');
        return;
      }
      const args = instalado
        ? ['upgrade', '-e', '--id', id, '--accept-package-agreements', '--accept-source-agreements', '--silent']
        : ['install', '-e', '--id', 'Gyan.FFmpeg', '--accept-package-agreements', '--accept-source-agreements', '--silent'];
      const r = spawnSync('winget', args, { encoding: 'utf8', timeout: 20 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
      // winget devolve código diferente de 0 quando "já está na versão mais nova"; o que vale é o programa rodar depois
      atualizaPathDoSistema();
      if (!rodaVersao('ffmpeg', ['-version'])) throw new Error('o ffmpeg não ficou disponível depois da instalação' + (r.error ? ': ' + r.error.message : ''));
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
    id: 'whisper',
    nome: 'whisper.cpp (transcrição da fala)',
    nomeSimples: 'programa que transcreve a fala',
    testes: ['whisper'],
    precisaDe: ['modelo'],
    prepararCandidata: async (opc, nova) => {
      const cand = path.join(WHISPER_DIR, 'candidata');
      fs.rmSync(cand, { recursive: true, force: true });
      try { await instalarWhisper({ release: nova.release, destino: cand }); } catch (e) { fs.rmSync(cand, { recursive: true, force: true }); throw e; }
      const exe = sistema().plataforma === 'win32' ? path.join(cand, 'bin', 'Release', 'whisper-cli.exe') : path.join(cand, 'bin', 'whisper-cli');
      return { env: { FABRICA_WHISPER: exe }, porEmUso: async () => trocarPasta(WHISPER_DIR, cand), descartar: () => fs.rmSync(cand, { recursive: true, force: true }) };
    },
    atual: () => {
      const registro = registroWhisper();
      return { versao: null, ok: fs.existsSync(caminho('whisper')), registrada: registro ? registro.versao : null };
    },
    maisNova: async () => {
      // Os programas prontos saem nas versões numeradas bNNNN (marcadas como pré-lançamento); as etiquetas v1.9.x saem sem
      // arquivos. Vale a publicada por último que traz o programa, e a troca é decidida pela etiqueta e pela data.
      const lista = await json('https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=40');
      const rel = etiquetaWhisper(lista);
      if (!rel) throw new Error('não achei o whisper.cpp nas versões publicadas');
      const registro = registroWhisper();
      const desatualizado = whisperPrecisa(registro, rel);
      return { versao: null, rotulo: rel.tag, release: rel, desatualizado, motivo: registro ? `está na ${registro.versao}, a mais nova é a ${rel.tag}` : 'não está instalado' };
    },
    instalar: async (opc, ultima) => instalarWhisper({ release: ultima.release, destino: WHISPER_DIR }),
  },
  {
    id: 'tesseract',
    nome: 'Tesseract CLI (montagem de vídeo)',
    nomeSimples: 'programa que monta os vídeos',
    testes: ['tesseract'],
    precisaDe: ['ffmpeg'],
    prepararCandidata: async (opc, nova) => {
      // a candidata vai para uma pasta temporária com o instalador oficial; a mesma pasta extraída serve para pôr em uso
      const tmp = pastaTemp('fabrica-tsrct-candidata');
      try {
        const prefixoCand = path.join(tmp, 'prefixo');
        const { pastaExtraida } = await instalarTesseract({ release: nova.release, lista: nova.lista, prefixo: prefixoCand, tmp });
        const exe = path.join(prefixoCand, 'bin', sistema().plataforma === 'win32' ? 'tsrct.cmd' : 'tsrct');
        const v = rodaVersao(exe);
        if (comparar(v, nova.release.versao) !== 0) throw new Error(`a versão instalada à parte saiu ${v ? v.join('.') : 'desconhecida'}; esperado ${nova.release.tag}`);
        return {
          env: { FABRICA_TSRCT: exe },
          porEmUso: async () => {
            try {
              rodarInstaladorTesseract(pastaExtraida, prefixoPedido(opc));
              const emUso = rodaVersao(tsrctDe(opc));
              if (comparar(emUso, nova.release.versao) < 0) throw new Error(`o Tesseract continua na ${emUso ? emUso.join('.') : 'versão desconhecida'}; esperado ${nova.release.tag}`);
            } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
          },
          descartar: () => fs.rmSync(tmp, { recursive: true, force: true }),
        };
      } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
    },
    atual: (opc) => { const t = tsrctDe(opc); const v = fs.existsSync(t) ? rodaVersao(t) : null; return { versao: v, ok: !!v }; },
    maisNova: async () => {
      const padrao = pacoteTesseract(sistema());
      if (!padrao) throw new Error('o Tesseract não tem versão para este computador');
      const lista = await json('https://api.github.com/repos/mirage-hq/Tesseract/releases?per_page=15');
      const rel = escolherRelease(lista, padrao);
      if (!rel) throw new Error('não achei o Tesseract para este computador nas versões publicadas');
      return { versao: rel.versao, rotulo: rel.tag, release: rel, lista };
    },
    instalar: async (opc, ultima) => {
      const tmp = pastaTemp('fabrica-tsrct');
      try { await instalarTesseract({ release: ultima.release, lista: ultima.lista, prefixo: prefixoPedido(opc), tmp }); }
      finally { fs.rmSync(tmp, { recursive: true, force: true }); }
      const v = rodaVersao(tsrctDe(opc));
      if (comparar(v, ultima.release.versao) < 0) throw new Error(`o Tesseract continua na ${v ? v.join('.') : 'versão desconhecida'}; esperado ${ultima.release.tag}`);
    },
  },
  {
    id: 'rvm',
    nome: 'Modelo da máscara da pessoa (' + MODELO_RVM + ', ~15 MB)',
    atual: () => ({ versao: null, ok: modeloCompleto(path.join(RVM_DIR, MODELO_RVM), 10e6) }),
    maisNova: async () => ({ versao: null, rotulo: 'arquivo único, não tem versões' }),
    instalar: async () => baixar(URL_MODELO_RVM, path.join(RVM_DIR, MODELO_RVM), 'modelo da máscara'),
  },
];

// ---------- orquestração ----------

/** Compara cada ferramenta com a versão mais nova. Devolve [{id, nome, instalada, maisNova, precisa, motivo}].
 *  Versão nova que já foi recusada no autoteste deste computador não conta como "precisa" (o pré-voo não pede de novo). */
async function verificar(opc = {}, ids = FERRAMENTAS.map((f) => f.id), { ferramentas = FERRAMENTAS, estado = lerEstado() } = {}) {
  const saida = [];
  for (const f of ferramentas.filter((x) => ids.includes(x.id))) {
    const atual = f.atual(opc);
    let nova = null, erro = '';
    try { nova = await f.maisNova(); } catch (e) { erro = e.message; }
    let precisa, motivo;
    if (!atual.ok) { precisa = true; motivo = 'não está instalado'; }
    else if (nova && nova.versao && comparar(atual.versao || versaoDe(atual.registrada), nova.versao) < 0) { precisa = true; motivo = `está na ${(atual.versao || versaoDe(atual.registrada) || ['?']).join('.')}, a mais nova é a ${nova.rotulo}`; }
    else if (nova && nova.desatualizado) { precisa = true; motivo = nova.motivo || nova.rotulo; }
    else { precisa = false; motivo = 'já está na versão mais nova'; }
    const recusadas = ((estado.ferramentas || {})[f.id] || {}).recusadas || [];
    if (precisa && atual.ok && nova && recusadas.some((v) => mesmaVersao(v, nova.rotulo))) {
      precisa = false; motivo = `a versão ${nova.rotulo} foi recusada no teste deste computador; continuo com a que funciona`;
    }
    const versaoInstalada = atual.versao ? atual.versao.join('.') : (atual.registrada || null);
    saida.push({ id: f.id, nome: f.nome, instalada: atual.ok, versaoInstalada, maisNova: nova ? nova.rotulo : null, precisa, motivo, erroConsulta: erro, _nova: nova });
  }
  return saida;
}

/** O que o atualizarComTeste usa de fora (troca-se nos testes): o autoteste, a referência dos quadros, o registro e a lista. */
function depPadrao(raiz = RAIZ) {
  const at = require('./autoteste-ferramentas');
  const testadas = lerTestadas(raiz);
  return { raiz, autotestar: at.autotestar, lerReferencia: at.lerReferencia, gravarReferencia: at.gravarReferencia,
    estado: lerEstado(raiz), versaoTestada: (id) => versaoTestada(id, testadas) };
}
const rotuloDe = (atual) => (atual.versao ? atual.versao.join('.') : atual.registrada || 'em uso');

/**
 * Instala a versão `nova` à parte, roda o autoteste com ela e só então a põe em uso.
 * Devolve { resultado: 'passou' | 'falhou' | 'problema', frase, detalhe }. Só o teste reprovado recusa a versão;
 * falha ao baixar ou montar é "problema" (tenta de novo na próxima vez).
 */
async function atualizarComTeste(f, nova, opc = {}, dep = depPadrao()) {
  const raiz = dep.raiz || RAIZ;
  const est = (dep.estado.ferramentas[f.id] = dep.estado.ferramentas[f.id] || {});
  est.recusadas = est.recusadas || [];
  const testada = dep.versaoTestada ? dep.versaoTestada(f.id) : null;
  const visualLivre = !!(testada && mesmaVersao(testada.rotulo, nova.rotulo));
  const jaTinha = f.atual(opc).ok;
  const agora = new Date().toISOString();
  // o teste do whisper usa o modelo e o do Tesseract usa o ffmpeg: sem eles, o problema não é da versão nova
  for (const id of f.precisaDe || []) {
    const outra = FERRAMENTAS.find((x) => x.id === id);
    if (outra && !outra.atual(opc).ok) return { resultado: 'problema', frase: `Antes do ${f.nomeSimples}, falta terminar: ${outra.nome}.`, detalhe: 'falta ' + id };
  }
  let referencia = null;
  if (f.id === 'tesseract' && !visualLivre) {
    referencia = dep.lerReferencia(raiz);
    const atual = f.atual(opc);
    if (!referencia && atual.ok) {
      const base = await dep.autotestar({ so: f.testes, raiz });
      if (base.ok) { dep.gravarReferencia(raiz, base.quadros, rotuloDe(atual)); referencia = dep.lerReferencia(raiz); }
    }
  }
  let cand;
  try { cand = await f.prepararCandidata(opc, nova); }
  catch (e) { return { resultado: 'problema', frase: `Não consegui preparar a versão nova do ${f.nomeSimples}. Vou tentar de novo na próxima vez.`, detalhe: e.message }; }
  let r;
  try { r = await dep.autotestar({ so: f.testes, env: cand.env, referencia, visualLivre, raiz }); }
  catch (e) { r = { ok: false, etapas: [{ id: f.id, ok: false, detalhe: e.message }], quadros: [] }; }
  const detalhe = ((r.etapas || []).find((e) => !e.ok) || (r.etapas || [])[r.etapas.length - 1] || {}).detalhe || '';
  if (r.ok) {
    try { await cand.porEmUso(); }
    catch (e) { cand.descartar(); return { resultado: 'problema', frase: `A versão nova do ${f.nomeSimples} passou no teste, mas não consegui pô-la em uso. Vou tentar de novo na próxima vez.`, detalhe: e.message }; }
    if (f.id === 'tesseract' && (r.quadros || []).length) dep.gravarReferencia(raiz, r.quadros, nova.rotulo);
    est.emUso = nova.rotulo;
    est.ultimoTeste = { data: agora, ok: true, detalhe };
    return { resultado: 'passou', frase: jaTinha ? FRASES.passou(f.nomeSimples) : FRASES.instalou(f.nomeSimples), detalhe };
  }
  cand.descartar();
  if (!est.recusadas.some((v) => mesmaVersao(v, nova.rotulo))) est.recusadas.push(nova.rotulo);
  est.ultimoTeste = { data: agora, ok: false, detalhe };
  return { resultado: 'falhou', frase: FRASES.falhou(f.nomeSimples), detalhe };
}

/** Decide e faz, para uma ferramenta que precisa de atenção (item do verificar). Devolve a lista de resultados. */
async function processarFerramenta(f, item, opc = {}, dep = depPadrao()) {
  const est = dep.estado.ferramentas[f.id] || {};
  const testada = dep.versaoTestada ? dep.versaoTestada(f.id) : null;
  const d = decidir({ instalada: item.instalada, nova: item._nova, recusadas: est.recusadas || [], testada });
  if (d === 'manter') {
    return [item.instalada ? { resultado: 'manteve', frase: FRASES.semInternet, detalhe: item.erroConsulta }
      : { resultado: 'problema', frase: `Não consegui baixar o ${f.nomeSimples} agora. Confira a internet e tente de novo.`, detalhe: item.erroConsulta }];
  }
  if (d === 'pular-recusada') return [{ resultado: 'manteve', frase: FRASES.recusada(f.nomeSimples, item._nova.rotulo) }];
  if (d === 'usar-testada') {
    const r = await atualizarComTeste(f, testada.nova, opc, dep);
    if (r.resultado === 'passou') r.frase = FRASES.instalouTestada(f.nomeSimples);
    return [r];
  }
  const r = await atualizarComTeste(f, item._nova, opc, dep);
  if (r.resultado === 'falhou' && !item.instalada) {
    if (testada && !mesmaVersao(testada.rotulo, item._nova.rotulo)) {
      r.frase = FRASES.falhouPrimeira(f.nomeSimples);
      const r2 = await atualizarComTeste(f, testada.nova, opc, dep);
      if (r2.resultado === 'passou') r2.frase = FRASES.instalouTestada(f.nomeSimples);
      return [r, r2];
    }
    // primeira instalação, sem versão anterior nem outra testada: não há "a que já funcionava"
    r.frase = FRASES.semReserva(f.nomeSimples);
  }
  return [r];
}

/** ffmpeg do Windows: o winget atualiza no lugar; testa depois e, se falhar, volta à versão anterior pelo winget. */
async function atualizarFfmpegWindows(f, opc = {}, dep = depPadrao()) {
  const antes = rodaVersao('ffmpeg', ['-version']);
  await f.instalar(opc, null);
  const depois = rodaVersao('ffmpeg', ['-version']);
  if (antes && depois && comparar(antes, depois) === 0) return { resultado: 'manteve', frase: `O ${f.nomeSimples} já estava na versão mais nova.` };
  const r = await dep.autotestar({ so: f.testes, raiz: dep.raiz || RAIZ });
  const detalhe = ((r.etapas || []).find((e) => !e.ok) || {}).detalhe || '';
  if (r.ok) return { resultado: 'passou', frase: antes ? FRASES.passou(f.nomeSimples) : `Instalei o ${f.nomeSimples} e fiz um teste rápido: está tudo certo.`, detalhe };
  const id = pacoteFfmpeg();
  if (antes && id) {
    spawnSync('winget', ['install', '-e', '--id', id, '--version', antes.join('.'), '--force', '--silent', '--accept-package-agreements', '--accept-source-agreements'],
      { encoding: 'utf8', timeout: 20 * 60 * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
    atualizaPathDoSistema();
  }
  const voltou = antes && comparar(rodaVersao('ffmpeg', ['-version']), antes) === 0;
  return { resultado: voltou ? 'falhou' : 'problema', detalhe,
    frase: voltou ? FRASES.falhou(f.nomeSimples) : `A versão nova do ${f.nomeSimples} não passou no meu teste e não consegui voltar sozinho para a anterior.` };
}

/** Frase para quando a parte de vídeo não roda neste computador (null quando roda). */
function semVideoNeste(sis = sistema()) {
  if (sis.plataforma !== 'win32' && sis.plataforma !== 'darwin') return 'A parte de vídeo da Fábrica funciona no Windows e no Mac. Neste computador, nada a instalar.';
  if (sis.plataforma === 'darwin' && !macosSuportado(sis.macos)) {
    return `Este Mac está no macOS ${sis.macos ? sis.macos.join('.') : '(versão desconhecida)'}; o programa que monta os vídeos exige o macOS 14 ou mais novo (e o desenho dos carrosséis também pede o 14). Nada a instalar para vídeo neste Mac.`;
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const tem = (n) => args.includes('--' + n);
  const val = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
  const opc = { prefixo: val('prefixo') };
  const ids = val('so') ? val('so').split(',') : FERRAMENTAS.map((f) => f.id);

  const aviso = semVideoNeste();
  if (aviso) { console.log(aviso); return 0; }
  const estado = await verificar(opc, ids);
  if (tem('verificar') || tem('simular')) {
    for (const e of estado) console.log(`${e.precisa ? 'PRECISA ' : 'OK      '} ${e.nome}: ${e.motivo}${e.erroConsulta ? ' (aviso: ' + e.erroConsulta + ')' : ''}`);
    return tem('verificar') && estado.some((e) => e.precisa) ? 1 : 0;
  }
  let falhou = false;
  const fazer = estado.filter((e) => e.precisa);
  console.log(fazer.length ? `Vou instalar ou atualizar ${fazer.length} ferramenta(s) de vídeo.` : 'Todas as ferramentas de vídeo já estão na versão mais nova.');
  const dep = depPadrao();
  let i = 0;
  for (const e of fazer) {
    i++;
    const f = FERRAMENTAS.find((x) => x.id === e.id);
    console.log(`FERRAMENTA ${i} de ${fazer.length}: ${e.nome} (${e.motivo})`);
    let resultados;
    try {
      if (f.semCandidata && f.semCandidata()) resultados = [await atualizarFfmpegWindows(f, opc, dep)];
      else if (f.prepararCandidata) resultados = await processarFerramenta(f, e, opc, dep);
      else {
        // os modelos são arquivos únicos, sem versões: só baixa
        if (!e._nova && e.erroConsulta) throw new Error('não consegui consultar a versão mais nova: ' + e.erroConsulta);
        await f.instalar(opc, e._nova);
        resultados = [{ resultado: 'passou', frase: 'pronto' }];
      }
    } catch (erro) { resultados = [{ resultado: 'problema', frase: erro.message }]; }
    gravarEstado(dep.raiz, dep.estado);
    // vale como pronto se, no fim, a ferramenta funciona (uma versão nova recusada não atrapalha quem já tinha uma boa)
    const pronta = f.atual(opc).ok;
    for (const r of resultados) {
      console.log(`${r.resultado === 'problema' || (!pronta && r === resultados[resultados.length - 1]) ? 'PROBLEMA' : 'FEITO'}: ${r.frase}`);
      if (r.detalhe && r.resultado !== 'passou') console.log(`  (detalhe técnico: ${r.detalhe})`);
    }
    if (!pronta) falhou = true;
  }
  console.log(falhou ? 'RESULTADO: faltou terminar alguma ferramenta. Rode de novo: o que já está pronto é pulado.' : 'RESULTADO: ferramentas de vídeo prontas.');
  return falhou ? 1 : 0;
}

module.exports = { versaoDe, comparar, escolherRelease, lerSha, verificar, FERRAMENTAS, pacoteNaLista,
  etiquetaWhisper, whisperPrecisa, pacoteTesseract, urlFfmpegMac, versaoDoCaminhoFfmpeg, macosSuportado,
  descompactar, instalarTesseract, rodarInstaladorTesseract, ultimaFfmpegMac, instalarFfmpegMac, instalarWhisper,
  registroWhisper, semVideoNeste, rodaVersao, WHISPER_DIR, FFMPEG_DIR, RVM_DIR, MODELO_WHISPER,
  mesmaVersao, decidir, FRASES, atualizarComTeste, processarFerramenta, atualizarFfmpegWindows, lerEstado, gravarEstado,
  lerTestadas, versaoTestada, argsConsultaFfmpeg, trocarPasta };
if (require.main === module) main().then((c) => process.exit(c), (e) => { console.log('PROBLEMA: ' + e.message); process.exit(1); });
