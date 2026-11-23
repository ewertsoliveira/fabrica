// Monta (compila) o whisper.cpp no próprio Mac, porque o projeto não publica programa pronto para Mac.
// Usa as Ferramentas de Linha de Comando da Apple (gratuitas; a pessoa instala com um clique em "Instalar", no Passo 1 do
// INSTALAR.md) e o CMake portátil oficial da Kitware, baixado e conferido aqui, sem instalar nada no sistema.
// Compila a mesma etiqueta que o Windows usa. No chip Apple a transcrição usa a placa de vídeo (Metal); no Intel, o processador.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { json, texto, baixar, baixarConferido, shaDaLista } = require('./rede');

const rodarPadrao = (cmd, args, opc = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 20 * 60 * 1000, ...opc });
const ultimas = (r) => String((r.stderr || '') + (r.stdout || '')).trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');

/** Argumentos do CMake: programa autossuficiente (sem bibliotecas à parte), na arquitetura deste Mac. */
function argumentosCmake(sis) {
  const arm = sis.arq === 'arm64';
  return ['-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_EXAMPLES=ON',
    `-DCMAKE_OSX_ARCHITECTURES=${arm ? 'arm64' : 'x86_64'}`, ...(arm ? [] : ['-DGGML_METAL=OFF'])];
}
/** Sob Rosetta (Node x64 num chip Apple) a montagem roda em arm64, para o programa sair nativo. */
const prefixoArquitetura = (sis) => (sis.rosetta ? ['arch', '-arm64'] : []);

/** Na release da Kitware, o CMake universal do Mac (tar.gz) e a lista de conferência SHA-256. */
function escolherCmakeMac(release) {
  const assets = (release && release.assets) || [];
  const tarball = assets.find((a) => /^cmake-\d+\.\d+\.\d+-macos-universal\.tar\.gz$/.test(a.name));
  const sha = assets.find((a) => /^cmake-\d+\.\d+\.\d+-SHA-256\.txt$/.test(a.name));
  return tarball && sha ? { tarball, sha } : null;
}

const temFerramentasApple = (rodar = rodarPadrao) => rodar('xcode-select', ['-p']).status === 0;

/** Pelo endereço para onde a página "releases/latest" redireciona (.../releases/tag/v4.5.1), os dois arquivos do Mac. */
function cmakeDaUltima(local) {
  const m = String(local || '').match(/\/releases\/tag\/v(\d+\.\d+\.\d+)$/);
  if (!m) return null;
  const v = m[1];
  const base = `https://github.com/Kitware/CMake/releases/download/v${v}/`;
  const arq = (name) => ({ name, browser_download_url: base + name });
  return { tarball: arq(`cmake-${v}-macos-universal.tar.gz`), sha: arq(`cmake-${v}-SHA-256.txt`) };
}
/** A versão mais nova do CMake: pela página pública (sem limite de consultas); se ela falhar, pela consulta do GitHub. */
async function ultimaCmake() {
  try {
    const r = await fetch('https://github.com/Kitware/CMake/releases/latest', { headers: { 'User-Agent': 'fabrica-de-conteudo' }, redirect: 'manual' });
    const par = cmakeDaUltima(r.headers.get('location'));
    if (par) return par;
  } catch { /* cai para a consulta */ }
  return escolherCmakeMac(await json('https://api.github.com/repos/Kitware/CMake/releases/latest'));
}

/** Devolve o caminho do cmake (baixa a versão mais nova da Kitware para o cache, se ainda não estiver lá). */
async function garantirCmake({ cache, rodar, log }) {
  const par = await ultimaCmake();
  if (!par) throw new Error('não achei o CMake para Mac na versão mais nova da Kitware');
  const pasta = path.join(cache, par.tarball.name.replace(/\.tar\.gz$/, ''));
  const cmake = path.join(pasta, 'CMake.app', 'Contents', 'bin', 'cmake');
  if (fs.existsSync(cmake)) return cmake;
  fs.mkdirSync(cache, { recursive: true });
  const tgz = path.join(cache, par.tarball.name);
  const esperado = shaDaLista(await texto(par.sha.browser_download_url), par.tarball.name);
  log('  baixando o CMake (ferramenta que organiza a montagem do whisper)');
  await baixarConferido(par.tarball.browser_download_url, tgz, esperado, 'CMake ' + par.tarball.name);
  const r = rodar('tar', ['-xzf', tgz, '-C', cache]);
  fs.rmSync(tgz, { force: true });
  if (r.status !== 0 || !fs.existsSync(cmake)) throw new Error('não consegui abrir o CMake baixado: ' + ultimas(r));
  return cmake;
}

/**
 * Compila a etiqueta pedida do whisper.cpp e põe o programa em <destino>/bin/whisper-cli. Devolve esse caminho.
 * `rodar` e `cache` existem para teste; o padrão do cache é 08-FERRAMENTAS/.cache-ferramentas/.
 */
async function compilarWhisper({ etiqueta, destino, sis, cache, log = console.log, rodar = rodarPadrao }) {
  if (!temFerramentasApple(rodar)) throw new Error('faltam as ferramentas gratuitas da Apple (xcode-select --install)');
  const pastaCache = cache || path.join(__dirname, '..', '..', '08-FERRAMENTAS', '.cache-ferramentas');
  const cmake = await garantirCmake({ cache: pastaCache, rodar, log });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-whisper-src-'));
  try {
    const tgz = path.join(tmp, 'whisper.tar.gz');
    await baixar(`https://github.com/ggml-org/whisper.cpp/archive/refs/tags/${etiqueta}.tar.gz`, tgz, 'código do whisper.cpp ' + etiqueta);
    const fontes = path.join(tmp, 'fontes');
    fs.mkdirSync(fontes);
    let r = rodar('tar', ['-xzf', tgz, '-C', fontes]);
    if (r.status !== 0) throw new Error('não consegui abrir o código do whisper.cpp: ' + ultimas(r));
    const src = fs.readdirSync(fontes).map((n) => path.join(fontes, n)).find((d) => fs.existsSync(path.join(d, 'CMakeLists.txt')));
    if (!src) throw new Error('o código do whisper.cpp veio sem o CMakeLists.txt');
    const build = path.join(tmp, 'build');
    const pre = prefixoArquitetura(sis);
    const roda = (args) => (pre.length ? rodar(pre[0], [...pre.slice(1), cmake, ...args]) : rodar(cmake, args));
    log('  montando o whisper neste Mac (leva alguns minutos)');
    r = roda(['-S', src, '-B', build, ...argumentosCmake(sis)]);
    if (r.status !== 0) throw new Error('não consegui preparar a montagem do whisper: ' + ultimas(r));
    r = roda(['--build', build, '--config', 'Release', '-j', String(Math.max(1, os.cpus().length)), '--target', 'whisper-cli']);
    if (r.status !== 0) throw new Error('a montagem do whisper falhou: ' + ultimas(r));
    const pronto = path.join(build, 'bin', 'whisper-cli');
    if (!fs.existsSync(pronto)) throw new Error('a montagem terminou sem o whisper-cli');
    const exe = path.join(destino, 'bin', 'whisper-cli');
    fs.mkdirSync(path.dirname(exe), { recursive: true });
    fs.copyFileSync(pronto, exe);
    fs.chmodSync(exe, 0o755);
    const teste = rodar(exe, ['--help']);
    if (teste.status !== 0 && !/usage/i.test(String(teste.stdout) + String(teste.stderr))) throw new Error('o whisper montado não abriu: ' + ultimas(teste));
    return exe;
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

module.exports = { argumentosCmake, prefixoArquitetura, escolherCmakeMac, cmakeDaUltima, temFerramentasApple, compilarWhisper };
