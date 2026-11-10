// Estação de preparo da Linha de Produção de Reels, sem agente: prepara o material de um Reels encadeando os scripts que já existem.
//   silencedetect (como o pre-edicao.js) -> whisper local -> palavras.js -> [cortes decididos] -> pre-edicao.js ->
//   whisper no editado -> palavras.js -> conferências -> quadros de capa (+ máscara das poses) -> [máscara RVM] -> material.md
//
// REGRA: se houver ambiguidade (início da fala, instrução falada, poses, tomada repetida) o script PARA, imprime a
// pergunta com as opções prontas e sai com código 3. Nunca adivinha em silêncio. Quem responde é o responsável (o runner
// pergunta por AskUserQuestion) e o script roda de novo com --decisao chave=valor; o que já foi feito fica em cache.
//
// Uso:
//   node preparar-material.js "<video>" --estado cru|pre-editado [--reels reelsNN] [--relatorio caminho/material.md]
//        [--viradas 9.75,27.45] [--transicao zoom|seco|...] [--sem-viradas] [--mascara] [--mascara-larg 360]
//        [--decisao inicio=cortar-ate:10.633 --decisao poses=4.40-10.03 --decisao repetida-77.4=manter-ultima]
//        [--so-analise] [--retranscrever "Split Payment,Comissão Europeia"] [--quadros 24] [--refazer]
//        [--sem-mascara-poses] [--transcricao-bruto arq.json] [--transcricao-editado arq.json] [--projetos-dir pasta]
// Linhas de tempo: --viradas e os tempos do relatório de viradas são do vídeo PREPARADO (bruto já sem os cortes
// decididos), que é a entrada do pre-edicao.js. Os tempos das decisões (inicio, poses, repetida) são do vídeo bruto.
// Perguntas possíveis (ids de --decisao): inicio=cortar-ate:T|manter  poses=A-B|nenhuma  repetida-T=manter-ultima|manter-primeira|manter-ambas
//   sem-fala=parar|continuar (vídeo sem fala: o whisper achou menos de 5 palavras ou menos de 0,4 palavra por segundo de som).
// Fala fantasma: pausa longa coberta por palavras do whisper = tomada repetida que o whisper fundiu; o trecho é transcrito
//   de novo em separado (2 passagens extras do whisper) para a comparação de texto enxergar as duas tomadas.
// Mudar viradas: basta --viradas t1,t2 (refaz o pre-edicao.js e a máscara se houver; a transcrição continua valendo).
//   --refazer ignora todo o cache (inclui whisper e máscara). --sem-capa pula quadros e máscara das poses.
// Tempos de cada fase ficam em preparar-tempos.json e numa seção do material.md.
// Códigos de saída: 0 pronto | 1 erro ou responsável mandou parar | 3 precisa de decisão do responsável | 4 re-transcrição negada (limite de 1).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

process.on('uncaughtException', (e) => { console.error('ERRO: ' + (e && e.message ? e.message : e)); process.exit(1); });
const RAIZ = __dirname;
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opc = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const opcs = (n) => args.reduce((a, x, i) => (x === '--' + n && args[i + 1] ? [...a, args[i + 1]] : a), []);
const VALORES = new Set(['estado', 'reels', 'relatorio', 'viradas', 'transicao', 'mascara-larg', 'decisao', 'retranscrever', 'quadros',
  'transcricao-bruto', 'transcricao-editado', 'projetos-dir', 'mascara-poses-larg']);
const posicionais = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALORES.has(args[i - 1].replace(/^--/, '')) && args[i - 1].startsWith('--')));

const PROJ = path.resolve(opc('projetos-dir', path.join(RAIZ, 'projetos')));
const SCRIPTS = path.join(RAIZ, 'projetos'); // pre-edicao.js e palavras.js do modelo base
const WHISPER = path.resolve(RAIZ, '..', 'whisper-cpp', 'bin', 'Release', 'whisper-cli.exe');
const MODELO = path.resolve(RAIZ, '..', 'whisper-cpp', 'modelos', 'ggml-large-v3-turbo-q5_0.bin');
const MATTE = path.resolve(RAIZ, '..', 'rvm', 'matte.js');
const TSRCT = path.join(process.env.LOCALAPPDATA || '', 'Tesseract', 'bin', 'tsrct.cmd');

const fmt = (t) => (t === null || t === undefined ? 'n/d' : Number(t).toFixed(2).replace('.', ','));
const log = (...a) => console.error('[preparar-material]', ...a);
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const run = (cmd, a, o = {}) => spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28, ...o });
// cronômetro por fase: soma o tempo (s) gasto em cada trecho pesado e grava em preparar-tempos.json / seção do relatório
const T0 = Date.now(); const TEMPOS = {};
const cron = (nome, fn) => { const t = Date.now(); try { return fn(); } finally { TEMPOS[nome] = Number(((TEMPOS[nome] || 0) + (Date.now() - t) / 1000).toFixed(1)); } };
const ffmpeg = (a) => { const r = run('ffmpeg', ['-v', 'error', '-y', ...a]); if (r.status !== 0) throw new Error('ffmpeg falhou: ' + r.stderr.slice(-400)); return r; };
const duracao = (f) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }));

// ---------- entrada ----------
const entrada = posicionais[0];
const ESTADO_ORIG = opc('estado');
let estado = ESTADO_ORIG;
if (!entrada || !['cru', 'pre-editado'].includes(estado)) {
  console.error('uso: node preparar-material.js "<video>" --estado cru|pre-editado [--reels reelsNN] [--relatorio material.md] [opções]');
  process.exit(1);
}
let VIDEO = path.resolve(entrada);
if (!fs.existsSync(VIDEO)) VIDEO = path.resolve(RAIZ, 'assets-fonte', 'videos', entrada);
if (!fs.existsSync(VIDEO)) { console.error('arquivo não encontrado: ' + entrada); process.exit(1); }

function proximoReels() {
  const usados = fs.existsSync(PROJ) ? fs.readdirSync(PROJ).map((d) => (d.match(/^reels(\d+)$/) || [])[1]).filter(Boolean).map(Number) : [];
  return 'reels' + String((usados.length ? Math.max(...usados) : 0) + 1).padStart(2, '0');
}
const REELS = opc('reels') || proximoReels();
const DIR = path.join(PROJ, REELS);
const CONF = path.join(DIR, 'conf');
fs.mkdirSync(CONF, { recursive: true });
const P = (n) => path.join(DIR, n);
const RELATORIO = path.resolve(opc('relatorio', P('material.md')));

// ---------- estado e decisões (persistem entre as execuções) ----------
const EST_ARQ = P('preparar-estado.json');
const EST = fs.existsSync(EST_ARQ) ? JSON.parse(fs.readFileSync(EST_ARQ, 'utf8')) : { decisoes: {}, retranscricoes: 0 };
for (const d of opcs('decisao')) { const i = d.indexOf('='); if (i > 0) EST.decisoes[d.slice(0, i)] = d.slice(i + 1); }
const TEMPOS_ARQ = P('preparar-tempos.json');
const salvaTempos = () => { let ant = {}; try { ant = JSON.parse(fs.readFileSync(TEMPOS_ARQ, 'utf8')); } catch { /* primeira execução */ }
  const todos = { ...ant, ...TEMPOS }; fs.writeFileSync(TEMPOS_ARQ, JSON.stringify(todos, null, 1)); return todos; };
const salvaEstado = () => fs.writeFileSync(EST_ARQ, JSON.stringify(EST, null, 1));
salvaEstado();
const REFAZER = flag('refazer');
const cache = (arq) => !REFAZER && fs.existsSync(arq) && fs.statSync(arq).size > 0;

// ---------- 1. sondagem ----------
let versaoTsrct = 'n/d';
try { versaoTsrct = execFileSync('cmd.exe', ['/c', TSRCT, '--version'], { encoding: 'utf8' }).trim().split('\n').pop(); } catch { /* registrado como n/d */ }
const sonda = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,start_time', '-of', 'json', VIDEO], { encoding: 'utf8' }));
const DUR_BRUTO = Number(sonda.format.duration);
const vs = sonda.streams.find((s) => s.codec_type === 'video') || {};
const as = sonda.streams.find((s) => s.codec_type === 'audio') || {};
if (!as.codec_type) { console.error('o vídeo não tem áudio'); process.exit(1); }
const FICHA = `${path.extname(VIDEO).slice(1).toUpperCase()} ${vs.codec_name || ''} ${vs.width}x${vs.height} ${vs.r_frame_rate}, ${fmt(DUR_BRUTO)} s, áudio start_time ${as.start_time}`;
fs.writeFileSync(P('origem.txt'), `Fonte (${ESTADO_ORIG}): ${VIDEO}\nFicha: ${FICHA}\nRun: preparar-material.js, ${new Date().toISOString().slice(0, 10)}\n`);

// ---------- 2. utilitários de análise ----------
function silenciosCrus(arq, para) {
  const r = run('ffmpeg', ['-hide_banner', '-nostats', '-i', arq, '-vn', '-af', 'highpass=f=80,silencedetect=n=-35dB:d=0.25', '-f', 'null', '-']);
  const sil = []; let ini = null;
  for (const l of r.stderr.split('\n')) {
    const a = l.match(/silence_start: ([\d.]+)/); if (a) ini = Number(a[1]);
    const z = l.match(/silence_end: ([\d.]+)/); if (z && ini !== null) { sil.push([ini, Number(z[1])]); ini = null; }
  }
  if (ini !== null) sil.push([ini, para]);
  return sil;
}
// o silencedetect parte um silêncio em dois quando há um ruído curto; juntar os que distam menos de 0,1 s
function juntaSilencios(sil) {
  const j = [];
  for (const s of sil) { if (j.length && s[0] - j[j.length - 1][1] < 0.1) j[j.length - 1][1] = s[1]; else j.push([...s]); }
  return j;
}
const silencios = (arq, para) => juntaSilencios(silenciosCrus(arq, para));
function paraWav(video, wav) {
  ffmpeg(['-i', video, '-vn', '-af', 'aresample=16000:async=1:first_pts=0', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
}
function whisper(wav, prefixo, prompt) {
  const a = ['-m', MODELO, '-f', wav, '-l', 'pt', '-t', '12', '-ojf', '-of', prefixo];
  if (prompt) a.push('--prompt', prompt);
  log('whisper em ' + path.basename(wav));
  const naoAscii = (x) => /[^\x00-\x7F]/.test(x);
  let tmp = null; let wavUsado = wav, prefUsado = prefixo;
  if (naoAscii(wav) || naoAscii(prefixo) || naoAscii(MODELO)) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wsp-'));
    if (naoAscii(tmp)) throw new Error('caminho com acento e pasta temporária também com acento: usar --projetos-dir em pasta só com ASCII');
    wavUsado = path.join(tmp, 'a.wav'); prefUsado = path.join(tmp, 'saida');
    fs.copyFileSync(wav, wavUsado);
    if (naoAscii(MODELO)) throw new Error('o modelo do whisper está em caminho com acento: ' + MODELO);
  }
  a[a.indexOf('-f') + 1] = wavUsado; a[a.indexOf('-of') + 1] = prefUsado;
  const r = run(WHISPER, a);
  fs.writeFileSync(prefixo + '.log', (r.stdout || '') + (r.stderr || ''));
  if (tmp) { if (fs.existsSync(prefUsado + '.json')) fs.copyFileSync(prefUsado + '.json', prefixo + '.json'); fs.rmSync(tmp, { recursive: true, force: true }); }
  if (r.status !== 0 || !fs.existsSync(prefixo + '.json')) throw new Error('whisper falhou, veja ' + prefixo + '.log');
}
function palavrasDe(transcricaoJson, saida) {
  const r = run('node', [path.join(SCRIPTS, 'palavras.js'), transcricaoJson, saida]);
  if (r.status !== 0) throw new Error('palavras.js falhou: ' + r.stderr);
  return JSON.parse(fs.readFileSync(saida, 'utf8'));
}
// probabilidade mínima por palavra, na mesma ordem que o palavras.js produz
function probabilidades(transcricaoJson) {
  const j = JSON.parse(fs.readFileSync(transcricaoJson, 'utf8')); const out = [];
  j.transcription.forEach((seg) => {
    let atual = null;
    for (const t of seg.tokens) {
      if (t.text.startsWith('[_')) continue;
      if (t.text.startsWith(' ') || !atual) { if (atual) out.push(atual); atual = { p: t.p ?? 1 }; } else atual.p = Math.min(atual.p, t.p ?? 1);
    }
    if (atual) out.push(atual);
  });
  return out;
}
const frasesDe = (pal) => {
  const m = new Map();
  pal.forEach((p, i) => { if (!m.has(p.frase)) m.set(p.frase, { frase: p.frase, ini: p.ini / 1000, fim: p.fim / 1000, a: i, z: i, texto: [] });
    const f = m.get(p.frase); f.fim = Math.max(f.fim, p.fim / 1000); f.z = i; f.texto.push(p.w); });
  return [...m.values()].map((f) => ({ ...f, texto: f.texto.join(' ') }));
};

// ---------- 3. análise do bruto ----------
const SIL_BRUTO_ARQ = P('silencedetect-bruto.txt');
let silBrutoCru;
if (cache(SIL_BRUTO_ARQ)) silBrutoCru = JSON.parse(fs.readFileSync(SIL_BRUTO_ARQ, 'utf8'));
else { silBrutoCru = cron('silencedetect do bruto', () => silenciosCrus(VIDEO, DUR_BRUTO)); fs.writeFileSync(SIL_BRUTO_ARQ, JSON.stringify(silBrutoCru)); }
const silBruto = juntaSilencios(silBrutoCru.map((x) => [...x]));

const TRANSC_BRUTO = P('transcricao-bruto.json');
const PAL_BRUTO = P('palavras-bruto.json');
if (!cache(TRANSC_BRUTO)) {
  if (opc('transcricao-bruto')) fs.copyFileSync(path.resolve(opc('transcricao-bruto')), TRANSC_BRUTO);
  else { const wav = P('audio16k-bruto.wav'); cron('áudio 16 kHz do bruto', () => paraWav(VIDEO, wav)); cron('whisper no bruto', () => whisper(wav, TRANSC_BRUTO.replace(/\.json$/, '')));
    fs.rmSync(wav, { force: true }); }
}
const palBrutoCru = cache(PAL_BRUTO) ? JSON.parse(fs.readFileSync(PAL_BRUTO, 'utf8')) : cron('palavras.js (bruto)', () => palavrasDe(TRANSC_BRUTO, PAL_BRUTO));
// Fala fantasma: o whisper não repete texto. Quando o responsável grava a mesma frase duas vezes seguidas, ele escreve uma só e espalha as
// palavras por cima da pausa entre as tomadas (teste real: "como" e "esse" dentro de uma pausa de 1,95 s), então a comparação de texto
// nunca veria a repetição. Pausa longa (>= 0,9 s) coberta por palavras do whisper em mais de metade do tempo = transcrição incompleta
// ali; o script transcreve de novo, em separado, o trecho antes e o trecho depois da pausa e emenda as palavras no lugar.
const fantasmas = [];
const palBrutoWhisper = (() => {
  const cobre = ([a, z]) => palBrutoCru.reduce((t, p) => {
    if (p.fim - p.ini < 100) return t;
    const i = Math.max(p.ini / 1000, a), fim = Math.min(p.fim / 1000, z); return fim > i ? t + fim - i : t; }, 0) / (z - a);
  const suspeitas = silBruto.filter(([a, z]) => z - a >= 0.9 && a > 0.5 && z < DUR_BRUTO - 0.5 && cobre([a, z]) >= 0.5);
  if (!suspeitas.length) return palBrutoCru;
  const longos = silBruto.filter(([a, z]) => z - a >= 0.8);
  let pal = palBrutoCru.map((p) => ({ ...p, _o: 'r' + p.frase }));
  suspeitas.forEach(([a, z], k) => {
    const esq = longos.filter(([, y]) => y <= a - 0.01).pop(); const dir = longos.find(([x]) => x >= z + 0.01);
    const trechos = [['esq', esq ? esq[1] : 0, a], ['dir', z, dir ? dir[0] : DUR_BRUTO]];
    const novas = [];
    trechos.forEach(([lado, t0, t1]) => {
      const base = P(`transcricao-bruto-trecho${k + 1}-${lado}`);
      if (!cache(base + '.json')) {
        const wav = base + '.wav';
        cron('whisper nos trechos fantasma', () => {
          ffmpeg(['-ss', t0.toFixed(3), '-t', (t1 - t0).toFixed(3), '-i', VIDEO, '-vn', '-af', 'aresample=16000:async=1:first_pts=0', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
          whisper(wav, base);
        });
        fs.rmSync(wav, { force: true });
      }
      const r = run('node', [path.join(SCRIPTS, 'palavras.js'), base + '.json', base + '-palavras.json']);
      if (r.status !== 0) throw new Error('palavras.js falhou no trecho: ' + r.stderr);
      JSON.parse(fs.readFileSync(base + '-palavras.json', 'utf8')).forEach((p) => novas.push({ ...p, ini: p.ini + Math.round(t0 * 1000), fim: p.fim + Math.round(t0 * 1000), _o: `c${k}${lado}${p.frase}` }));
    });
    const t0 = trechos[0][1], t1 = trechos[1][2];
    pal = pal.filter((p) => !(p.ini / 1000 >= t0 - 0.05 && p.fim / 1000 <= t1 + 0.05)).concat(novas).sort((p, q) => p.ini - q.ini);
    fantasmas.push({ pausa: [a, z], trecho: [t0, t1], palavrasTrocadas: novas.length });
  });
  // frases em ordem de aparição
  const ids = new Map(); pal.forEach((p) => { if (!ids.has(p._o)) ids.set(p._o, ids.size); p.frase = ids.get(p._o); delete p._o; });
  return pal;
})();
// O whisper carimba errado a primeira palavra depois de uma pausa longa (em teste real: 7 palavras todas em 10,16 s, com a fala real
// começando em 10,73 s) e dá fim cedo à última palavra antes dela (4,00 s contra 4,40 s). O silencedetect é a verdade para a borda
// da fala: início que cai dentro de uma pausa vai para o fim da pausa; fim que antecede o começo de uma pausa em até 0,6 s vai para ele.
const palBruto = palBrutoWhisper.map((p) => {
  let ini = p.ini, fim = p.fim;
  const dentro = silBruto.find(([a, z]) => ini / 1000 > a - 0.05 && ini / 1000 < z - 0.05);
  if (dentro) ini = Math.round(dentro[1] * 1000);
  const antes = silBruto.find(([a]) => a * 1000 >= fim - 100 && a * 1000 <= fim + 600);
  if (antes) fim = Math.round(antes[0] * 1000);
  if (fim < ini + 40) fim = ini + 40;
  return { ...p, ini, fim };
});
const frBruto = frasesDe(palBruto);

// quadros pretos nos primeiros 20 s (emenda de duas gravações no iPhone)
const pretos = [];
{ const r = cron('blackdetect (20 s)', () => run('ffmpeg', ['-hide_banner', '-nostats', '-t', '20', '-i', VIDEO, '-an', '-vf', 'blackdetect=d=0.03:pix_th=0.10', '-f', 'null', '-']));
  for (const m of r.stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) pretos.push([Number(m[1]), Number(m[2])]); }

// ---------- 4. ambiguidades ----------
const META = [/\bpose\b/i, /\bvou (come[cç]ar|gravar|fazer|tentar)\b/i, /\bv[ií]deo da pose\b/i, /\bpara (o|a) corte\b/i, /\bde novo\b/i, /\best[aá] gravando\b/i,
  /\bpode (cortar|come[cç]ar|gravar)\b/i, /\bvamos l[aá]\b/i, /\bvou refazer\b/i, /\bgravar (de novo|outra)\b/i];
const ehMeta = (t) => META.some((re) => re.test(t));
const resumo = (t) => (t.length > 120 ? t.slice(0, 65) + ' [...] ' + t.slice(-50) : t);
const perguntas = []; const dec = EST.decisoes;
const tSilencioBruto = silBruto.reduce((t, [a, z]) => t + (z - a), 0);
const tSomBruto = Math.max(0, DUR_BRUTO - tSilencioBruto);
const semFala = palBruto.length < 5 || palBruto.length / Math.max(1, tSomBruto) < 0.4;
if (semFala) {
  if (dec['sem-fala'] === 'parar') { console.error('Interrompido: o responsável mandou parar (vídeo sem fala). Nada foi gerado além da análise.'); process.exit(1); }
  if (dec['sem-fala'] === 'continuar') estado = 'pre-editado';
  else {
    const texto = palBruto.map((p) => p.w).join(' ');
    perguntas.push({ id: 'sem-fala', pergunta: `O whisper achou só ${palBruto.length} palavra(s) em ${fmt(DUR_BRUTO)} s de vídeo (${fmt(tSomBruto)} s fora de silêncio)${texto ? `: "${texto.slice(0, 80)}"` : ''}. Parece vídeo sem fala (poses, B-roll, ruído de ambiente) ou áudio que o whisper não entendeu.`,
      opcoes: [
        { rotulo: 'Parar: o arquivo certo é outro', decisao: ['sem-fala=parar'] },
        { rotulo: 'Continuar sem fala: só quadros de capa, sem legenda, sem cortes e sem viradas', decisao: ['sem-fala=continuar'] },
      ] });
  }
}
// pontos de corte dentro das pausas: o respiro de 0,12 s do pre-edicao.js fica de cada lado da emenda
const silAntes = (t) => silBruto.filter(([a, z]) => z <= t + 0.05 && z >= t - 1.5).sort((p, q) => q[1] - p[1])[0];
const cutIniAntes = (t) => { const s = silAntes(t); return s ? Number(Math.min(s[0] + 0.12, s[1] - 0.05).toFixed(3)) : Math.max(0, Number((t - 0.4).toFixed(3))); };
const cutFimAntes = (t) => { const s = silAntes(t); return s ? Number(Math.max(s[1] - 0.10, s[0] + 0.05).toFixed(3)) : Math.max(0, Number((t - 0.10).toFixed(3))); };
const cutFimDepois = (t) => { const s = silBruto.filter(([a]) => a >= t - 0.1).sort((p, q) => p[0] - q[0])[0];
  return !s || s[1] >= DUR_BRUTO - 0.3 ? DUR_BRUTO : Number(Math.max(s[1] - 0.10, s[0] + 0.05).toFixed(3)); };

// 4a. início da fala, instrução falada e poses
const iniFala = semFala ? null : (() => {
  const f = frBruto.find((x) => !ehMeta(x.texto) && x.texto.split(' ').length >= 3);
  return f || frBruto[0];
})();
const metaIni = frBruto.filter((f) => f.ini < (iniFala ? iniFala.ini : 0) && ehMeta(f.texto));
const primeiraPalavra = palBruto.length ? palBruto[0].ini / 1000 : 0;
const inicioSuspeito = metaIni.length > 0 || primeiraPalavra > 2.0 || (iniFala && iniFala.ini > 2.0);
let inicioInfo = { ambiguo: false, corteAte: null, poses: null, texto: '' };
if (iniFala) {
  const corteAte = cutFimAntes(iniFala.ini);
  const fimMeta = metaIni.length ? Math.max(...metaIni.map((f) => f.fim)) : 0;
  const posesIni = Number((fimMeta + 0.1).toFixed(2));
  const posesFim = Number((Math.min(...[...pretos.map((p) => p[0]), corteAte]) - 0.03).toFixed(2));
  const temPoses = posesFim - posesIni >= 1.5;
  inicioInfo = { ambiguo: inicioSuspeito, corteAte, poses: temPoses ? [posesIni, posesFim] : null };
  if (inicioSuspeito) {
    const partes = [];
    if (metaIni.length) partes.push(`De 0,00 a ${fmt(fimMeta)} s há fala que parece instrução de gravação: "${metaIni.map((f) => f.texto).join(' ')}".`);
    if (temPoses) partes.push(`De ${fmt(posesIni)} a ${fmt(posesFim)} s não há fala (${fmt(posesFim - posesIni)} s): provavelmente poses para a capa.`);
    else if (iniFala.ini > 2.0 && !metaIni.length) partes.push(`A primeira fala de verdade só começa em ${fmt(iniFala.ini)} s e não há trecho longo o bastante para ser pose.`);
    if (pretos.length) partes.push(`Quadro preto em ${pretos.map((p) => fmt(p[0])).join(', ')} s (emenda de duas gravações).`);
    partes.push(`A fala começa em ${fmt(iniFala.ini)} s: "${iniFala.texto.slice(0, 70)}".`);
    const A = ['inicio=cortar-ate:' + corteAte.toFixed(3)];
    const opcoes = [];
    if (temPoses) opcoes.push({ rotulo: `Cortar até ${fmt(corteAte)} s e usar ${fmt(posesIni)} a ${fmt(posesFim)} s como poses da capa`, decisao: [...A, `poses=${posesIni}-${posesFim}`] });
    opcoes.push({ rotulo: `Cortar até ${fmt(corteAte)} s, sem poses de capa`, decisao: [...A, 'poses=nenhuma'] });
    opcoes.push({ rotulo: 'Manter o início como está (sem cortar)', decisao: ['inicio=manter', 'poses=nenhuma'] });
    inicioInfo.texto = partes.join(' ');
    if (!dec.inicio) perguntas.push({ id: 'inicio', pergunta: 'O arquivo começa com trecho que não é fala do vídeo. ' + partes.join(' '), opcoes });
  }
}

// 4b. tomada repetida (texto parecido em dois pontos do vídeo, por runs de 4-gramas)
function tomadasRepetidas() {
  const w = palBruto.map((p) => norm(p.w)).map((x) => x.replace(/\s+/g, ''));
  const idx = new Map();
  for (let i = 0; i + 4 <= w.length; i++) { const k = w.slice(i, i + 4).join(' '); if (w.slice(i, i + 4).some((x) => !x)) continue; (idx.get(k) || idx.set(k, []).get(k)).push(i); }
  const pares = new Map(); // "p|q" -> true quando o 4-grama de p repete em q
  for (const pos of idx.values()) for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
    if (pos[b] - pos[a] >= 4 && (palBruto[pos[b]].ini - palBruto[pos[a]].fim) / 1000 >= 1.0) pares.set(pos[a] + '|' + pos[b], true);
  }
  const achados = []; const usados = new Set();
  for (const k of [...pares.keys()].map((x) => x.split('|').map(Number)).sort((x, y) => x[0] - y[0])) {
    if (usados.has(k[0] + '|' + k[1])) continue;
    let n = 0; while (pares.has((k[0] + n) + '|' + (k[1] + n))) { usados.add((k[0] + n) + '|' + (k[1] + n)); n++; }
    const palavrasIguais = n + 3;
    if (palavrasIguais >= 7) achados.push({ p0: k[0], q0: k[1], n: palavrasIguais });
  }
  return achados.map((r) => {
    const fA = frBruto.find((f) => f.a <= r.p0 && f.z >= r.p0); const fB = frBruto.find((f) => f.a <= r.q0 && f.z >= r.q0);
    const fAz = frBruto.find((f) => f.a <= r.p0 + r.n - 1 && f.z >= r.p0 + r.n - 1);
    const fBz = frBruto.find((f) => f.a <= r.q0 + r.n - 1 && f.z >= r.q0 + r.n - 1);
    const blocoIni = (t) => { const z = silBruto.filter(([a, y]) => y <= t + 0.05 && y >= t - 1.2).sort((p, q) => q[1] - p[1])[0]; return z ? z[1] : t; };
    const A = { ini: blocoIni(palBruto[r.p0].ini / 1000), fim: (fAz || fA).fim, texto: frBruto.filter((f) => f.frase >= fA.frase && f.frase <= (fAz || fA).frase).map((f) => f.texto).join(' ') };
    const B = { ini: blocoIni(palBruto[r.q0].ini / 1000), fim: (fBz || fB).fim, texto: frBruto.filter((f) => f.frase >= fB.frase && f.frase <= (fBz || fB).frase).map((f) => f.texto).join(' ') };
    return { id: 'repetida-' + A.ini.toFixed(1), A, B, palavras: r.n };
  }).filter((r) => r.B.ini > r.A.fim - 0.5); // sobreposição = mesma frase, não é nova tomada
}
const repetidas = tomadasRepetidas();
for (const r of repetidas) {
  const cA = cutIniAntes(r.A.ini), cB = cutFimAntes(r.B.ini), cB0 = cutIniAntes(r.B.ini), cBfim = cutFimDepois(r.B.fim);
  r.cortes = { ultima: [cA, cB], primeira: [cB0, cBfim] };
  if (!dec[r.id]) {
    const entre = palBruto.filter((p) => p.ini / 1000 >= r.A.fim && p.ini / 1000 < r.B.ini - 0.05).map((p) => p.w).join(' ');
    perguntas.push({
      id: r.id,
      pergunta: `Duas tomadas parecidas (${r.palavras} palavras iguais em sequência). 1ª: ${fmt(r.A.ini)} a ${fmt(r.A.fim)} s, "${resumo(r.A.texto)}". 2ª: ${fmt(r.B.ini)} a ${fmt(r.B.fim)} s, "${resumo(r.B.texto)}".` +
        (entre ? ` Entre as duas há fala: "${entre.slice(0, 80)}".` : ''),
      opcoes: [
        { rotulo: `Manter a última tomada (cortar ${fmt(cA)} a ${fmt(cB)} s); recomendado quando a última é a corrigida`, decisao: [`${r.id}=manter-ultima`] },
        { rotulo: `Manter a primeira tomada (cortar ${fmt(cB0)} a ${fmt(cBfim)} s)`, decisao: [`${r.id}=manter-primeira`] },
        { rotulo: 'Manter as duas (não cortar)', decisao: [`${r.id}=manter-ambas`] },
      ] });
  }
}

fs.writeFileSync(P('preparar-pendencias.json'), JSON.stringify(perguntas, null, 1));
if (perguntas.length) {
  console.log('PRECISA DE DECISÃO DO RESPONSÁVEL (o script não adivinha). Reels: ' + REELS);
  perguntas.forEach((q, i) => {
    console.log(`\nPERGUNTA ${i + 1} [${q.id}]: ${q.pergunta}`);
    q.opcoes.forEach((o, k) => console.log(`  ${String.fromCharCode(65 + k)}) ${o.rotulo}\n     -> ${o.decisao.map((d) => '--decisao ' + d).join(' ')}`));
  });
  salvaTempos();
  console.log('\nRode de novo o mesmo comando acrescentando as flags da opção escolhida. Transcrição e silêncios ficam em cache.');
  process.exit(3);
}
if (flag('so-analise')) {
  console.log(`Análise do bruto de ${REELS}: sem ambiguidade pendente. Fala começa em ${fmt(iniFala ? iniFala.ini : null)} s; ${repetidas.length} tomada(s) repetida(s); ${pretos.length} quadro(s) preto(s) nos 20 s iniciais.`);
  console.log('Decisões registradas: ' + JSON.stringify(EST.decisoes));
  process.exit(0);
}

// ---------- 5. cortes decididos e vídeo preparado ----------
const cortes = [];
let posesBruto = null;
if (dec.inicio && dec.inicio.startsWith('cortar-ate:')) cortes.push([0, Number(dec.inicio.split(':')[1])]);
if (dec.poses && /^[\d.]+-[\d.]+$/.test(dec.poses)) posesBruto = dec.poses.split('-').map(Number);
for (const r of repetidas) {
  if (dec[r.id] === 'manter-ultima') cortes.push(r.cortes.ultima);
  if (dec[r.id] === 'manter-primeira') cortes.push(r.cortes.primeira);
}
cortes.sort((a, b) => a[0] - b[0]);
const mantem = []; { let c = 0; for (const [a, z] of cortes) { if (a > c) mantem.push([c, a]); c = Math.max(c, z); } if (c < DUR_BRUTO) mantem.push([c, DUR_BRUTO]); }
const removido = (t) => cortes.reduce((s, [a, z]) => s + (z <= t ? z - a : 0), 0);
const mapa = (t) => (cortes.some(([a, z]) => t > a && t < z) ? null : t - removido(t));

const chaveCortes = JSON.stringify(cortes);
const CH_ARQ = P('chave-cortes.json');
if (fs.existsSync(CH_ARQ) && fs.readFileSync(CH_ARQ, 'utf8') !== chaveCortes) {
  log('decisões de corte mudaram: descartando preparado, editado, transcrição e quadros anteriores');
  for (const f of ['bruto-preparado.mov', 'video-editado.mp4', 'pre-edicao.json', 'transcricao.json', 'palavras.json', 'palavras-whisper-original.json', 'audio16k.wav', 'capa.json', 'matte.mp4', 'matte-poses.mp4', 'poses.mov'])
    fs.rmSync(P(f), { force: true });
}
fs.writeFileSync(CH_ARQ, chaveCortes);
let PREPARADO = VIDEO;
if (cortes.length) {
  PREPARADO = P('bruto-preparado.mov');
  if (!cache(PREPARADO)) {
    const f = [];
    f.push(`[0:v]split=${mantem.length}${mantem.map((_, i) => `[v${i}]`).join('')}`);
    f.push(`[0:a]aresample=48000:async=1:first_pts=0,asplit=${mantem.length}${mantem.map((_, i) => `[a${i}]`).join('')}`);
    mantem.forEach(([a, z], i) => {
      f.push(`[v${i}]trim=${a.toFixed(3)}:${z.toFixed(3)},setpts=PTS-STARTPTS[sv${i}]`);
      f.push(`[a${i}]atrim=${a.toFixed(3)}:${z.toFixed(3)},asetpts=PTS-STARTPTS[sa${i}]`);
    });
    f.push(mantem.map((_, i) => `[sv${i}][sa${i}]`).join('') + `concat=n=${mantem.length}:v=1:a=1[v][a]`);
    const script = P('cortes.filtro.txt'); fs.writeFileSync(script, f.join(';\n'));
    log('cortando ' + cortes.length + ' trecho(s) do bruto');
    cron('cortes decididos (ffmpeg)', () => ffmpeg(['-i', VIDEO, '-filter_complex_script', script, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '12', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le', PREPARADO]));
    fs.rmSync(script, { force: true });
  }
}
const DUR_PREP = duracao(PREPARADO);

// ---------- 6. viradas (propostas por heurística; sempre mostradas no relatório) ----------
const SIL_PREP_CRU = PREPARADO === VIDEO ? silBrutoCru : cron('silencedetect do preparado', () => silenciosCrus(PREPARADO, DUR_PREP));
const SIL_PREP = juntaSilencios(SIL_PREP_CRU.map((x) => [...x]));
const palPrep = palBruto.map((p) => ({ w: p.w, ini: mapa(p.ini / 1000), fim: mapa(p.fim / 1000) })).filter((p) => p.ini !== null && p.fim !== null);
const MARCADORES = /^(ent[aã]o|agora|mas|por isso|sobre|outro|outra|primeiro|segundo|terceiro|por fim|quer|se n[aã]o|ou seja|vamos|passo)\b/i;
function propoeViradas() {
  const max = Math.max(1, Math.min(5, Math.round(DUR_PREP / 15)));
  const cands = [];
  for (const [a, z] of SIL_PREP) {
    if (a < 6 || z > DUR_PREP - 6 || z - a < 0.3) continue;
    const antes = palPrep.filter((p) => p.fim <= a + 0.1).slice(-15), depois = palPrep.filter((p) => p.ini >= z - 0.1).slice(0, 15);
    if (!antes.length || !depois.length) continue;
    const conj = (L) => new Set(L.map((p) => norm(p.w)).filter((x) => x.length >= 5));
    const A = conj(antes), B = conj(depois); const inter = [...A].filter((x) => B.has(x)).length; const uni = new Set([...A, ...B]).size || 1;
    const shift = 1 - inter / uni;
    const marc = MARCADORES.test(depois.slice(0, 3).map((p) => p.w).join(' ')) ? 1 : 0;
    const score = 0.5 * shift + 0.3 * Math.min(1, (z - a) / 0.8) + 0.4 * marc;
    const crus = SIL_PREP_CRU.filter(([x, y]) => x >= a - 0.01 && y <= z + 0.01).sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    const maior = crus[0] || [a, z];
    cands.push({ t: Number(((maior[0] + maior[1]) / 2).toFixed(2)), a, z, score, antes: antes.slice(-5).map((p) => p.w).join(' '), depois: depois.slice(0, 5).map((p) => p.w).join(' ') });
  }
  const esc = [];
  for (const c of cands.sort((x, y) => y.score - x.score)) if (c.score >= 0.45 && esc.length < max && esc.every((e) => Math.abs(e.t - c.t) >= 6.8)) esc.push(c);
  return esc.sort((x, y) => x.t - y.t);
}
let viradas = [];
const TRANS = flag('sem-viradas') ? 'seco' : opc('transicao', 'zoom');
if (!flag('sem-viradas')) {
  if (opc('viradas')) viradas = opc('viradas').split(',').map(Number).map((t) => ({ t, antes: '(informada)', depois: '', score: null }));
  else if (estado === 'cru') viradas = propoeViradas();
}

// ---------- 7. vídeo editado ----------
let EDITADO = PREPARADO; let saidaPre = null;
if (estado === 'cru') {
  EDITADO = P('video-editado.mp4');
  const stamp = P('pre-edicao.json');
  if (!cache(EDITADO) || !cache(stamp) || JSON.parse(fs.readFileSync(stamp, 'utf8')).chave !== viradas.map((v) => v.t).join(',') + '|' + TRANS) {
    const a = [path.join(SCRIPTS, 'pre-edicao.js'), PREPARADO, EDITADO, '--transicao', viradas.length ? TRANS : 'seco'];
    if (viradas.length) a.push('--viradas', viradas.map((v) => v.t).join(','));
    log('pre-edicao.js ' + a.slice(1).join(' '));
    const r = cron('pre-edicao.js', () => run('node', a));
    if (r.status !== 0) { console.error('pre-edicao.js falhou:\n' + r.stderr); process.exit(1); }
    const ultima = r.stdout.trim().split('\n').pop();
    try { saidaPre = JSON.parse(ultima); } catch { console.error('saída inesperada do pre-edicao.js: ' + ultima); process.exit(1); }
    // transições com fusão (xfade) mudam o tempo do vídeo: a transcrição anterior deixa de valer
    const FUSAO = ['brilho', 'desfoque', 'preto'];
    const antes = fs.existsSync(stamp) ? JSON.parse(fs.readFileSync(stamp, 'utf8')) : null;
    if (antes && (FUSAO.includes(TRANS) || FUSAO.includes(String(antes.chave).split('|')[1]))) for (const f of ['transcricao.json', 'palavras.json', 'audio16k.wav']) fs.rmSync(P(f), { force: true });
    fs.writeFileSync(stamp, JSON.stringify({ chave: viradas.map((v) => v.t).join(',') + '|' + TRANS, saida: saidaPre }));
  } else saidaPre = JSON.parse(fs.readFileSync(stamp, 'utf8')).saida;
}
const DUR_ED = duracao(EDITADO);

// ---------- 8. transcrição do editado ----------
const TRANSC = P('transcricao.json'); const PALAVRAS = P('palavras.json');
const reaproveita = estado === 'pre-editado' && !cortes.length; // o editado é o próprio arquivo já transcrito
if (!cache(PALAVRAS)) {
  if (opc('transcricao-editado')) fs.copyFileSync(path.resolve(opc('transcricao-editado')), TRANSC);
  else if (reaproveita) fs.copyFileSync(TRANSC_BRUTO, TRANSC);
  else { const wav = P('audio16k.wav'); cron('áudio 16 kHz do editado', () => paraWav(EDITADO, wav)); cron('whisper no editado', () => whisper(wav, TRANSC.replace(/\.json$/, ''))); }
  const pal = cron('palavras.js (editado)', () => palavrasDe(TRANSC, PALAVRAS));
  fs.copyFileSync(PALAVRAS, P('palavras-whisper-original.json'));
  // vídeo sem fala: o que o whisper devolve é alucinação ("E aí", "Obrigado.") e viraria legenda; palavras.json fica vazio
  if (semFala && dec['sem-fala'] === 'continuar') fs.writeFileSync(PALAVRAS, '[]');
  void pal;
}
// uma única re-transcrição, só para termo técnico, data ou nome próprio, e só quando pedida
if (opc('retranscrever') && EST.retranscricoes >= 1 && EST.retranscreverTermos === opc('retranscrever')) log('re-transcrição com os mesmos termos já feita; reaproveitada (não conta de novo)');
else if (opc('retranscrever')) {
  if (EST.retranscricoes >= 1) { console.error('RE-TRANSCRIÇÃO NEGADA: o limite é 1 por vídeo (regra de 2026-10-12). Cortar clipe de ~2 s e pôr nas pendências.'); process.exit(4); }
  const wav = P('audio16k.wav'); if (!fs.existsSync(wav)) paraWav(EDITADO, wav);
  fs.copyFileSync(TRANSC, P('transcricao-1a-passada.json'));
  cron('whisper (re-transcrição)', () => whisper(wav, TRANSC.replace(/\.json$/, ''), opc('retranscrever')));
  palavrasDe(TRANSC, PALAVRAS); fs.copyFileSync(PALAVRAS, P('palavras-whisper-original.json'));
  if (semFala && dec['sem-fala'] === 'continuar') fs.writeFileSync(PALAVRAS, '[]');
  EST.retranscricoes += 1; EST.retranscreverTermos = opc('retranscrever'); salvaEstado();
}
const pal = JSON.parse(fs.readFileSync(PALAVRAS, 'utf8'));
const frases = frasesDe(pal);

// ---------- 9. conferências ----------
// 9a. palavras duvidosas: nunca geram nova transcrição; viram clipe de ~2 s para o responsável ouvir
const probs = probabilidades(TRANSC);
const duvidas = [];
pal.forEach((p, i) => {
  const pr = probs[i] ? probs[i].p : 1; const w = p.w.replace(/[.,!?;:]+$/, '');
  const fato = /\d/.test(w) || (/^[A-ZÀ-Ú]/.test(w) && i > 0 && !/[.!?]$/.test(pal[i - 1].w));
  const curta = w.length <= 3;
  if (pr < 0.5 || (curta && pr < 0.7)) duvidas.push({ i, w: p.w, t: p.ini / 1000, p: pr, tipo: fato ? 'nome, número ou termo' : (curta ? 'palavra curta' : 'palavra') });
});
duvidas.sort((a, b) => a.p - b.p);
const duvidasMostradas = duvidas.slice(0, 8).sort((a, b) => a.t - b.t);
duvidasMostradas.forEach((d, k) => {
  const arq = path.join(CONF, `duvida-${String(k + 1).padStart(2, '0')}.mp4`);
  if (!cache(arq)) ffmpeg(['-ss', String(Math.max(0, d.t - 0.8)), '-t', '2', '-i', EDITADO, '-vf', 'scale=360:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', arq]);
  d.clipe = path.relative(DIR, arq).replace(/\\/g, '/');
});

// 9b. sincronia em 5 pontos (envelope de 10 ms sobre o áudio 16 k do editado)
function sincronia() {
  const wav = P('audio16k.wav'); if (!fs.existsSync(wav)) paraWav(EDITADO, wav);
  const buf = fs.readFileSync(wav); const d = buf.indexOf(Buffer.from('data')) + 8;
  const n = Math.floor((buf.length - d) / 2); const J = 160; const env = [];
  for (let i = 0; i + J <= n; i += J) { let s = 0; for (let k = 0; k < J; k++) { const v = buf.readInt16LE(d + (i + k) * 2); s += v * v; } env.push(Math.sqrt(s / J)); }
  const ord = [...env].sort((a, b) => a - b); const piso = ord[Math.floor(ord.length * 0.1)]; const pico = ord[Math.floor(ord.length * 0.95)];
  const lim = Math.max(piso * 4, pico * 0.06);
  // Só dá para medir início de fala onde há um trecho calado antes (palavra colada na anterior não tem subida de energia).
  // Janela fixa de 0,4 s para trás pegava o fim da palavra anterior e dava -400 ms em todos os pontos (teste de 2026-10-13).
  const calado = (w) => w >= 0 && w < env.length && env[w] <= lim;
  const subida = (w) => env[w] > lim && calado(w - 1) && calado(w - 2) && calado(w - 3) && calado(w - 4);
  const cand = pal.map((p, i) => ({ ...p, i })).filter((p, k) => k === 0 || (p.ini - pal[k - 1].fim) / 1000 >= 0.15);
  const medidos = [];
  for (const p of cand) {
    p.iniFrase = p.i === 0 || pal[p.i - 1].frase !== p.frase;
    const t0 = p.ini / 1000; const w0 = Math.round(t0 * 100);
    let on = null;
    for (let w = Math.max(4, w0 - 35); w <= Math.min(env.length - 1, w0 + 35); w++) if (subida(w) && (on === null || Math.abs(w - w0) < Math.abs(on - w0))) on = w;
    if (on !== null) { medidos.push({ palavra: p.w, whisper: t0, fala: on / 100, dif: Math.round((on - w0) * 10), iniFrase: p.iniFrase }); continue; }
    // sem subida: só é falha quando há trecho calado na janela (a fala não está onde o whisper diz); sem calado, não dá para medir
    let temCalado = false;
    for (let w = Math.max(0, w0 - 35); w < Math.min(env.length - 4, w0 + 35) && !temCalado; w++) temCalado = calado(w) && calado(w + 1) && calado(w + 2) && calado(w + 3);
    if (temCalado) medidos.push({ palavra: p.w, whisper: t0, fala: null, dif: null, iniFrase: p.iniFrase });
  }
  // início de frase = subida de energia inequívoca depois de pausa real; preencher com as outras palavras só se faltar
  const base = [...medidos.filter((m) => m.iniFrase), ...medidos.filter((m) => !m.iniFrase)].slice(0, Math.max(medidos.filter((m) => m.iniFrase).length, 5));
  const ord2 = base.sort((a, b) => a.whisper - b.whisper);
  const passo = Math.max(1, Math.floor(ord2.length / 5)); const pontos = [];
  for (let k = 0; k < ord2.length && pontos.length < 5; k += passo) pontos.push(ord2[k]);
  const valid = medidos.filter((m) => m.dif !== null).map((m) => Math.abs(m.dif)).sort((a, b) => a - b);
  pontos.estat = { medidas: medidos.length, comDif: valid.length, mediana: valid.length ? valid[Math.floor(valid.length / 2)] : null, max: valid.length ? valid[valid.length - 1] : null,
    fora150: valid.filter((v) => v > 150).length };
  return pontos;
}
const sync = cron('sincronia (5 pontos)', sincronia);
const syncRuim = sync.filter((s) => s.dif === null || Math.abs(s.dif) > 150);

// 9c. clipes curtos de conferência das emendas (cortes decididos e viradas)
const emendas = [];
const clipe = (video, t, nome, rot) => {
  const arq = path.join(CONF, nome);
  if (!cache(arq)) ffmpeg(['-ss', String(Math.max(0, t - 1.5)), '-t', '3', '-i', video, '-vf', 'scale=360:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', arq]);
  emendas.push({ rot, t, arq: path.relative(DIR, arq).replace(/\\/g, '/') });
};
if (cortes.length) {
  let acum = 0; cortes.forEach(([a, z], k) => { const t = a - acum; acum += z - a; if (t > 0.2) clipe(PREPARADO, t, `emenda-${String(k + 1).padStart(2, '0')}.mp4`, `corte decidido ${fmt(a)} a ${fmt(z)} s do bruto`); });
}
const viradasEd = (saidaPre && saidaPre.viradas) || [];
const syncClipes = [];
syncRuim.forEach((x, k) => {
  const arq = path.join(CONF, `sincronia-${String(k + 1).padStart(2, '0')}.mp4`);
  if (!cache(arq)) ffmpeg(['-ss', String(Math.max(0, x.whisper - 0.8)), '-t', '2', '-i', EDITADO, '-vf', 'scale=360:-2', '-c:v', 'libx264', '-crf', '30', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', arq]);
  x.clipe = path.relative(DIR, arq).replace(/\\/g, '/'); syncClipes.push(x);
});
viradasEd.slice(0, 6).forEach((t, k) => clipe(EDITADO, t, `virada-${String(k + 1).padStart(2, '0')}.mp4`, `virada ${k + 1} (${TRANS})`));

// ---------- 10. quadros de capa (miniaturas 1080x1920) e máscara das poses ----------
const NQ = Number(opc('quadros', 24));
function quadrosDeCapa() {
  // janela: poses decididas (tempo do bruto) ou pausas do editado em trecho aberto
  let janelas = [];
  let origem = VIDEO; let desloca = 0;
  if (posesBruto) janelas = [posesBruto];
  else {
    origem = EDITADO;
    const abertos = []; const vs2 = [0, ...viradasEd, DUR_ED];
    for (let i = 0; i + 1 < vs2.length; i++) if (i % 2 === 0 || estado !== 'cru' || !viradasEd.length) abertos.push([vs2[i], vs2[i + 1]]);
    const sil = silencios(EDITADO, DUR_ED).filter(([a, z]) => z - a >= 0.1);
    janelas = sil.map(([a, z]) => [a + 0.03, z - 0.03]).filter(([a, z]) => z > a && abertos.some(([x, y]) => a >= x && z <= y));
    // sem pausas, a janela é o primeiro trecho aberto
    if (!janelas.length && abertos.length) janelas = [abertos[0]];
  }
  if (!janelas.length) return { origem, quadros: [], janelas };
  // gray 270x480 a 30 fps só dos trechos candidatos
  const cand = [];
  for (const [a, z] of janelas) {
    const r = run('ffmpeg', ['-v', 'error', '-ss', String(a), '-t', String(z - a), '-i', origem, '-an', '-vf', 'fps=30,scale=270:480,format=gray', '-f', 'rawvideo', '-'], { encoding: 'buffer' });
    const b = r.stdout; const T = 270 * 480; const nq = Math.floor(b.length / T);
    let ant = null;
    for (let q = 0; q < nq; q++) {
      const f = b.subarray(q * T, (q + 1) * T);
      let mov = 0, nit = 0;
      if (ant) for (let i = 0; i < T; i += 3) mov += Math.abs(f[i] - ant[i]);
      // nitidez: gradiente médio na região do rosto (x 25 a 75%, y 12 a 48%)
      for (let y = Math.floor(480 * 0.12); y < Math.floor(480 * 0.48); y += 2) for (let x = Math.floor(270 * 0.25); x < Math.floor(270 * 0.75); x += 2) nit += Math.abs(f[y * 270 + x] - f[y * 270 + x + 1]) + Math.abs(f[y * 270 + x] - f[(y + 1) * 270 + x]);
      cand.push({ t: a + q / 30, mov: ant ? mov / (T / 3) : null, nit: nit / (((480 * 0.36) / 2) * ((270 * 0.5) / 2)) });
      ant = Buffer.from(f);
    }
  }
  const validos = cand.filter((c) => c.mov !== null);
  if (!validos.length) return { origem, quadros: [], janelas };
  const maxN = Math.max(...validos.map((c) => c.nit)) || 1; const maxM = Math.max(...validos.map((c) => c.mov)) || 1;
  validos.forEach((c) => { c.score = c.nit / maxN - 0.8 * (c.mov / maxM); });
  const esc = [];
  for (const c of validos.sort((a, b) => b.score - a.score)) if (esc.length < NQ && esc.every((e) => Math.abs(e.t - c.t) >= 0.1)) esc.push(c);
  return { origem, quadros: esc.sort((a, b) => a.t - b.t), janelas };
}
const QDIR = P('capa-quadros');
let capa = { quadros: [], origem: null, janelas: [], prancha: null, mascaraPoses: null };
if (!flag('sem-capa')) {
  fs.mkdirSync(QDIR, { recursive: true });
  const chaveCapa = JSON.stringify({ posesBruto, viradasEd, NQ, DUR_ED });
  const CAPA_ARQ = P('capa.json');
  const guardada = fs.existsSync(CAPA_ARQ) && !REFAZER ? JSON.parse(fs.readFileSync(CAPA_ARQ, 'utf8')) : null;
  const cq = guardada && guardada.chave === chaveCapa && fs.existsSync(path.join(QDIR, 'prancha.png')) ? guardada.cq : null;
  if (cq) capa = { ...capa, ...cq };
  else {
    const novo = cron('quadros de capa (escolha)', quadrosDeCapa);
    fs.readdirSync(QDIR).filter((f) => /^q\d+_t.*\.jpg$/.test(f)).forEach((f) => fs.rmSync(path.join(QDIR, f)));
    cron('quadros de capa (JPG + prancha)', () => novo.quadros.forEach((q, k) => {
      q.arq = `q${String(k + 1).padStart(2, '0')}_t${q.t.toFixed(2)}.jpg`;
      ffmpeg(['-ss', q.t.toFixed(3), '-i', novo.origem, '-frames:v', '1', '-vf', 'scale=1080:1920', '-q:v', '2', path.join(QDIR, q.arq)]);
    }));
    capa = { ...capa, ...novo };
  }
  if (!cq && capa.quadros.length) { // prancha de contato 7 colunas, com o tempo em cada quadro quando a fonte existir
    const prancha = path.join(QDIR, 'prancha.png');
    const fonte = 'C\\:/Windows/Fonts/arial.ttf';
    const lista = path.join(QDIR, 'lista.txt');
    fs.writeFileSync(lista, capa.quadros.map((q) => `file '${q.arq}'\nduration 1`).join('\n') + '\n');
    const linhas = Math.ceil(capa.quadros.length / 7);
    const vf = `scale=270:480,drawtext=fontfile='${fonte}':text='%{frame_num}':start_number=1:x=6:y=6:fontsize=28:fontcolor=white:box=1:boxcolor=black${'@'}0.6,tile=7x${linhas}`;
    let r = run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-vf', vf, '-frames:v', '1', prancha], { cwd: QDIR });
    if (r.status !== 0) run('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-vf', `scale=270:480,tile=7x${linhas}`, '-frames:v', '1', prancha], { cwd: QDIR });
    fs.rmSync(lista, { force: true });
    if (fs.existsSync(prancha)) capa.prancha = path.relative(DIR, prancha).replace(/\\/g, '/');
  }
  if (!cq) fs.writeFileSync(CAPA_ARQ, JSON.stringify({ chave: chaveCapa, cq: { origem: capa.origem, quadros: capa.quadros, janelas: capa.janelas, prancha: capa.prancha } }));
  // máscara só das poses (recorte da capa); a do vídeo inteiro é a flag --mascara
  if (posesBruto && !flag('sem-mascara-poses')) {
    const clip = P('poses.mov'); const mp = P('matte-poses.mp4');
    if (!cache(mp)) {
      ffmpeg(['-ss', String(posesBruto[0]), '-t', String(posesBruto[1] - posesBruto[0]), '-i', VIDEO, '-an', '-c:v', 'libx264', '-crf', '12', '-pix_fmt', 'yuv420p', clip]);
      log('máscara das poses (RVM) em segundo plano do script');
      const r = cron('máscara das poses (RVM)', () => run('node', [MATTE, clip, mp, '', opc('mascara-poses-larg', '720')]));
      if (r.status !== 0) log('matte das poses falhou: ' + (r.stderr || '').slice(-300));
    }
    if (fs.existsSync(mp)) capa.mascaraPoses = { arq: path.relative(DIR, mp).replace(/\\/g, '/'), iniBruto: posesBruto[0] };
  }
}

// ---------- 11. máscara do vídeo (só com --mascara) ----------
let mascara = null;
if (flag('mascara')) {
  const mp = P('matte.mp4'); const MCH = P('matte.chave');
  // com transição zoom o enquadramento (100%/115%) faz parte dos quadros do editado: mudar as viradas invalida a máscara antiga
  const chaveMatte = JSON.stringify({ viradas: viradas.map((v) => v.t), TRANS: viradas.length ? TRANS : 'seco', cortes, DUR_ED });
  if (fs.existsSync(mp) && (!fs.existsSync(MCH) || fs.readFileSync(MCH, 'utf8') !== chaveMatte)) { log('máscara existente não corresponde ao enquadramento atual: refazendo'); fs.rmSync(mp, { force: true }); }
  if (!cache(mp)) { log('máscara RVM do vídeo inteiro (~3,5 min por 90 s)'); const r = cron('máscara do vídeo (RVM)', () => run('node', [MATTE, EDITADO, mp, '', opc('mascara-larg', '360')])); if (r.status !== 0) { console.error('matte.js falhou: ' + (r.stderr || '').slice(-400)); process.exit(1); } fs.writeFileSync(MCH, chaveMatte); }
  const nq = (arq) => { const o = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=nb_frames,duration,r_frame_rate', '-of', 'json', arq], { encoding: 'utf8' })).streams[0];
    return /^\d+$/.test(o.nb_frames || '') ? Number(o.nb_frames) : Math.round(Number(o.duration) * 30); };
  const q = nq(mp), qv = nq(EDITADO);
  mascara = { arq: path.relative(DIR, mp).replace(/\\/g, '/'), quadros: q, quadrosVideo: qv };
}

// ---------- 12. relatório ----------
const rel = [];
const cortesSecos = saidaPre ? saidaPre.cortesSecos : null;
rel.push('# Material preparado', '');
rel.push(`**Reels:** ${REELS}`);
rel.push(`**Vídeo editado:** ${path.relative(path.resolve(RAIZ, '..', '..'), EDITADO).replace(/\\/g, '/')}`);
rel.push(`**Estado original:** ${ESTADO_ORIG} (${FICHA})${estado !== ESTADO_ORIG ? ' (tratado como pré-editado: sem fala, nada a cortar)' : ''}`);
rel.push(`**Versão do Tesseract:** ${versaoTsrct}`);
rel.push(`**Duração:** ${fmt(DUR_ED)} s${DUR_ED > 90 ? ' (ACIMA de 90 s: cortar conteúdo)' : ' (abaixo de 90 s)'}`);
rel.push(`**Pausas cortadas:** ${estado === 'cru' ? `${saidaPre ? saidaPre.trechos - 1 : 'n/d'} (${cortesSecos} cortes secos + ${viradasEd.length} viradas com ${TRANS})` : 'n/a (vídeo pré-editado)'}`);
rel.push(`**Palavras:** ${pal.length} em ${frases.length} frases (${path.relative(path.resolve(RAIZ, '..', '..'), PALAVRAS).replace(/\\/g, '/')})`);
rel.push(`**Máscara:** ${mascara ? `${mascara.quadros} quadros para ${mascara.quadrosVideo} do vídeo${mascara.quadros === mascara.quadrosVideo ? ' (igual)' : ' (DIFERENTE: refazer)'} (${mascara.arq})` : 'não gerada (sem --mascara)'}`);
rel.push(`**Re-transcrições:** ${EST.retranscricoes} de 1 permitida`);
rel.push('');
rel.push('## Início, poses e tomadas');
if (semFala) rel.push(`- Sem fala (decisão do responsável: continuar). O whisper devolveu ${palBruto.length} palavra(s) (${palBruto.map((p) => p.w).join(' ') || 'nenhuma'}), descartadas: palavras.json está vazio.`);
else rel.push(`- Fala ${estado === 'cru' ? 'do bruto ' : ''}começa em ${fmt(iniFala ? iniFala.ini : null)} s${inicioInfo.ambiguo ? ` (decisão: ${dec.inicio || 'n/d'}; poses: ${dec.poses || 'n/d'})` : ' (sem instrução falada nem poses no início)'}.`);
if (posesBruto) rel.push(`- Poses de capa: ${fmt(posesBruto[0])} a ${fmt(posesBruto[1])} s do bruto; tudo antes de ${fmt(cortes.length ? cortes[0][1] : 0)} s está fora do vídeo editado.`);
if (pretos.length) rel.push(`- Quadro preto (emenda de gravações) em ${pretos.map((p) => fmt(p[0])).join(', ')} s do bruto.`);
repetidas.forEach((r) => rel.push(`- Tomada repetida ${r.id}: ${fmt(r.A.ini)}–${fmt(r.A.fim)} s e ${fmt(r.B.ini)}–${fmt(r.B.fim)} s do bruto; decisão: ${dec[r.id] || 'n/d'}.`));
if (!repetidas.length) rel.push('- Nenhuma tomada repetida encontrada por similaridade de texto.');
rel.push('');
rel.push('## Viradas');
if (estado === 'pre-editado') rel.push('Vídeo pré-editado: nenhuma virada aplicada aqui. Cortes e velocidade já vêm do arquivo.');
else if (!viradas.length) rel.push('Nenhuma virada proposta (transição seca). Se o plano quiser zoom, rodar de novo com `--viradas t1,t2` (tempos do vídeo preparado).');
else {
  rel.push(`Transição **${TRANS}**. Propostas por heurística (pausa longa + troca de vocabulário + palavra de abertura), tempos do vídeo preparado. Para mudar: \`--viradas t1,t2\` (refaz só o pre-edicao.js, ~1,5 min; transcrição em cache, a máscara é refeita se existir; \`--refazer\` refaz TUDO, inclusive whisper e máscara).`);
  rel.push('', '| virada | preparado (s) | editado (s) | antes → depois |', '|---|---|---|---|');
  const alinhadas = viradasEd.length === viradas.length;
  viradas.forEach((v, k) => rel.push(`| ${k + 1} | ${fmt(v.t)} | ${alinhadas ? fmt(viradasEd[k]) : 'n/d'} | "${v.antes}" → "${v.depois}" |`));
  if (!alinhadas && viradasEd.length) rel.push('', `**Atenção:** o pre-edicao.js aplicou ${viradasEd.length} viradas para ${viradas.length} pedidas (uma pausa partida em dois silêncios pelo silencedetect). Tempos do editado: ${viradasEd.map(fmt).join(', ')}. Refazer com --viradas apontando para o meio da pausa mais longa.`);
  if (viradasEd.length) rel.push('', `Enquadramento para copiar na decupagem: \`${JSON.stringify(viradasEd.map((t, k) => ({ ini: t, fim: viradasEd[k + 1] !== undefined && k % 2 === 0 ? viradasEd[k + 1] : DUR_ED, zoom: 1.15 })).filter((_, k) => k % 2 === 0))}\` (trechos fechados; os demais ficam abertos).`);
}
rel.push('');
rel.push('## Frases');
rel.push('| frase | início (s) | texto |', '|---|---|---|');
frases.forEach((f) => rel.push(`| ${f.frase} | ${fmt(f.ini)} | ${f.texto.replace(/\|/g, '/')} |`));
rel.push('');
rel.push('## Sincronia (palavra do whisper × início da fala no envelope)');
rel.push('| palavra | whisper (s) | fala (s) | diferença |', '|---|---|---|---|');
sync.forEach((s) => rel.push(`| ${s.palavra} | ${fmt(s.whisper)} | ${fmt(s.fala)} | ${s.dif === null ? 'sem energia na janela' : s.dif + ' ms'} |`));
if (sync.estat && sync.estat.comDif) rel.push('', `Conferência ampliada: ${sync.estat.medidas} palavras após pausa medidas; mediana ${sync.estat.mediana} ms, máximo ${sync.estat.max} ms, ${sync.estat.fora150} acima de 150 ms (palavra no meio da frase tem tempo menos exato no whisper; só os inícios de frase acima valem como critério).`);
rel.push(!sync.length ? 'Sem palavras para conferir.' : syncRuim.length ? `\n**Atenção:** ${syncRuim.length} ponto(s) fora de 150 ms. Conferir no clipe antes de ancorar a decupagem.` : '\nTodos dentro de 150 ms.');
rel.push('');
rel.push('## Capa');
if (capa.quadros.length) {
  rel.push(`- ${capa.quadros.length} quadros candidatos (miniaturas 1080x1920 JPG) em \`projetos/${REELS}/capa-quadros/\`, de ${posesBruto ? 'poses do bruto' : 'pausas em trecho aberto do editado'}. Prancha: ${capa.prancha || 'n/d'}.`);
  rel.push(`- Critério: menor movimento entre quadros e maior nitidez na região do rosto. **Boca fechada, mão na frente do corpo e olhar só o olho confirma**; o recorte em 2160x3840 sai só do quadro escolhido.`);
  rel.push(`- Tempos (s${posesBruto ? ', do bruto' : ', do editado'}): ${capa.quadros.map((q, k) => `${k + 1}=${q.t.toFixed(2).replace('.', ',')}`).join(' · ')}`);
  if (capa.mascaraPoses) rel.push(`- Máscara das poses: \`${capa.mascaraPoses.arq}\` (o quadro de tempo t do bruto está no instante t − ${fmt(capa.mascaraPoses.iniBruto)} s da máscara).`);
} else rel.push('- Nenhum quadro candidato (sem poses decididas e sem pausa em trecho aberto). Decidir com o responsável.');
rel.push('');
rel.push('## Dúvidas e pendências');
const pend = [];
if (DUR_ED > 90) pend.push('Duração acima de 90 s: perguntar ao responsável o que cortar.');
syncRuim.forEach((x) => pend.push(`Sincronia fora do limite em "${x.palavra}" (${fmt(x.whisper)} s, ${x.dif === null ? 'sem subida de energia perto' : x.dif + ' ms'}): ouvir \`${x.clipe}\`.`));
if (semFala && estado === 'pre-editado' && ESTADO_ORIG === 'cru') pend.push('Vídeo sem fala (decisão do responsável): sem legenda, sem cortes, sem viradas e sem palavras.js útil.');
duvidasMostradas.forEach((d) => pend.push(`Ouvir "${d.w}" aos ${fmt(d.t)} s do editado (${d.tipo}, confiança ${d.p.toFixed(2)}): \`${d.clipe}\`${d.tipo === 'nome, número ou termo' ? '; se estiver errado, 1 re-transcrição com `--retranscrever` é permitida' : '; não gera nova transcrição'}.`));
if (!pend.length) pend.push('Nenhuma.');
pend.forEach((p) => rel.push('- ' + p));
if (emendas.length) {
  rel.push('', '## Clipes de conferência das emendas (3 s cada, em `conf/`)');
  emendas.forEach((e) => rel.push(`- \`${e.arq}\`: ${e.rot} em ${fmt(e.t)} s`));
}
const tempos = salvaTempos();
const totalFases = Object.values(tempos).reduce((a, b) => a + b, 0);
rel.push('', '## Tempos por fase (s; fases em cache mantêm o tempo da execução que as fez)');
rel.push('| fase | s |', '|---|---|');
Object.entries(tempos).forEach(([k, v]) => rel.push(`| ${k} | ${v.toFixed(1).replace('.', ',')} |`));
rel.push(`| **soma das fases** | **${totalFases.toFixed(1).replace('.', ',')}** |`);
rel.push('', '## Observações');
rel.push('- Transcrição feita sobre o vídeo editado (áudio alinhado com `first_pts=0`). Nenhum script do modelo base foi alterado.');
rel.push(`- Arquivos em \`projetos/${REELS}/\`: origem.txt, silencedetect-bruto.txt, transcricao-bruto.json, palavras-bruto.json, ${cortes.length ? 'bruto-preparado.mov, ' : ''}${estado === 'cru' ? 'video-editado.mp4, ' : ''}transcricao.json, palavras.json, palavras-whisper-original.json, conf/, capa-quadros/, preparar-estado.json.`);
fs.mkdirSync(path.dirname(RELATORIO), { recursive: true });
fs.writeFileSync(RELATORIO, rel.join('\n') + '\n');
fs.writeFileSync(P('material.json'), JSON.stringify({ reels: REELS, estado: ESTADO_ORIG, video: VIDEO, preparado: PREPARADO, editado: EDITADO, duracao: DUR_ED, palavras: PALAVRAS,
  viradas: viradasEd, transicao: TRANS, mascara, posesBruto, cortes, capa: { quadros: capa.quadros.length, pasta: QDIR }, relatorio: RELATORIO }, null, 1));
console.log(`pronto: ${REELS}, ${fmt(DUR_ED)} s, ${pal.length} palavras, ${frases.length} frases, ${viradasEd.length} viradas, ${capa.quadros.length} quadros de capa, ${duvidasMostradas.length} dúvida(s).`);
console.log('relatório: ' + RELATORIO);
process.exit(0);
