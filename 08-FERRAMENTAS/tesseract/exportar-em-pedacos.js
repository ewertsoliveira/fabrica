// Exporta um Reels do Tesseract em pedaços paralelos e junta o resultado (versão genérica, 2026-10-13).
// Não altera nenhum script do modelo base nem a decupagem: tudo vai para --dir (padrão: <pasta do projeto>/export-pedacos).
//
// Uso (a partir de 08-FERRAMENTAS/tesseract-mirage/):
//   node exportar-em-pedacos.js --decupagem projetos/reelsNN/decupagem-v1.json [--projeto projetos/reelsNN] [--pedacos auto|3|4] [--dry-run]
//   node exportar-em-pedacos.js projetos/reelsNN/decupagem-v1.json            (a decupagem também vale como 1º argumento)
//
// O que decide sozinho:
//   --pedacos auto  (padrão)  RAM livre medida na hora: >= 6 GB livres -> 4 pedaços; >= 3 GB -> 3; < 3 GB -> avisa e usa 2.
//                  3 | 4 | 2  número fixo (avisa se a RAM livre estiver abaixo do medido como seguro).
//                  1 | inteiro  exporta o projeto inteiro (fallback documentado; 0,43 s por quadro).
//   Vídeo com menos de 20 s, blocos de motion sem janela, vídeo fora de 30 fps: exporta inteiro e diz por quê.
//   Cortes: só em início de frase (primeira palavra da frase menos 80 ms, como o montar-video.js), fora de qualquer bloco
//   de motion/headline/alerta/bloco da decupagem; escolhidos para equilibrar o número de quadros do maior pedaço.
//   Um início de frase que cai dentro de um bloco vale se o bloco acaba em até 0,5 s: o corte vai para o 1º quadro depois dele.
//
// Convenção de janelas dos blocos de motion (registrada no briefing da Linha de Produção de Reels):
//   decupagem.motion = {
//     desloca: 0,
//     blocos:  ["gancho", "oQueE", ...],                          // nomes que o script de motion executa (como antes)
//     janelas: [ {"id": "gancho", "inicio": 0, "fim": 3.7}, ... ], // início e fim, em segundos do vídeo inteiro, de cada nome
//     arquivos: ["mapa-europa.json"],                              // opcional: arquivos que o script de motion lê ao lado da decupagem
//     script: "motion-reelsNN.js"                                  // opcional: padrão = o primeiro motion-*.js ao lado da decupagem
//   }
//   janelas também aceita { "gancho": [0, 3.7] } ou o arquivo --janelas. A janela deve cobrir o bloco inteiro (entrada,
//   permanência e saída); em blocos que se emendam, o fim de um pode ser o início do próximo.
//
// Opções avançadas:
//   --cortes 21.95,37.6   cortes manuais, em segundos "de virada" (substitui a escolha automática; alinha à frase mais próxima)
//   --dry-run             só planeja: mostra pré-checagens, cortes e pedaços, sem criar arquivo nem rodar tsrct/ffmpeg de corte
//   --json                no fim do dry-run (ou do plano), imprime o plano em JSON de uma linha
//   --ram-livre-gb N      simula a RAM livre (teste do modo auto)
//   --min-seg S           pedaço mínimo (padrão 5 s)    --forcar-pedacos   divide mesmo com menos de 20 s
//   --sem-janelas         aceita bloco de motion sem janela (entra em todos os pedaços; pode sobrar 1 camada de 1 ms no quadro 0)
//   --cortes-fora-de-frase  deixa o corte cair em fronteira de bloco mesmo sem início de frase (último recurso; avisa)
//   --estrito             pré-checagem com aviso vira erro
//   --remontar            (modo inteiro) refaz montar-video.js + motion antes de exportar
//   --manter              não apaga as pastas dos pedaços (.tsrct embute o vídeo: ~700 MB por Reels) depois de juntar
//   --amostrar            grava CPU/memória a cada 2 s em amostras-export.csv (PowerShell)
//   --referencia v.mp4    compara com um export inteiro (PSNR/SSIM/áudio) em comparacao.json
//   --passos prepara,exporta,junta,compara   --reusa-cortes   --so N   --rotulo nome   --audio fonte|pedacos   --crf 4   --fps 30
// Saídas em --dir: junto-sem-trilha.mp4, decupagem-som-completa.json (entrada do mixar-audio.js), plano.json.
// Depois: node projetos/mixar-audio.js <dir>/decupagem-som-completa.json [--saida arquivo.mp4]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');

// ---------- argumentos ----------
const args = process.argv.slice(2);
const opc = (n, pad) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : pad; };
const flag = (n) => args.includes('--' + n);
const posicional = args[0] && !args[0].startsWith('--') ? args[0] : null;
const abs = (p) => path.resolve(p);
const vg = (x, d = 3) => Number(x).toFixed(d).replace('.', ',');
const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const sh = (cmd, a, o = {}) => { const r = spawnSync(cmd, a, { encoding: 'utf8', maxBuffer: 1 << 28, ...o }); if (r.status !== 0) throw new Error(`${cmd} ${a.slice(0, 6).join(' ')}… falhou:\n${(r.stderr || '').slice(-1500)}`); return r.stdout; };
const fim = (msg) => { console.error('ERRO: ' + msg); process.exit(1); };

if (flag('ajuda') || flag('help')) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }

// --projeto: pasta do Reels (projetos/reelsNN) ou o .tsrct inteiro
let PROJ_DIR = null, PROJ_TSRCT = null;
if (opc('projeto')) {
  const p = abs(opc('projeto'));
  if (/\.tsrct$/i.test(p)) { PROJ_TSRCT = p; PROJ_DIR = path.dirname(p); }
  else if (fs.existsSync(p) && fs.statSync(p).isDirectory()) PROJ_DIR = p;
  else fim('--projeto não existe: ' + p);
}
let DEC_PATH = opc('decupagem') || posicional;
if (DEC_PATH) DEC_PATH = abs(DEC_PATH);
else if (PROJ_DIR) {
  const lista = fs.readdirSync(PROJ_DIR).filter((f) => /^decupagem.*\.json$/.test(f) && !/-som(-completa)?\.json$/.test(f))
    .map((f) => path.join(PROJ_DIR, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!lista.length) fim('nenhuma decupagem*.json em ' + PROJ_DIR);
  DEC_PATH = lista[0];
}
if (!DEC_PATH) fim('uso: node exportar-em-pedacos.js --decupagem <decupagem.json> [--projeto <pasta|.tsrct>] [--pedacos auto|3|4] [--dry-run]');
if (!fs.existsSync(DEC_PATH)) fim('decupagem não encontrada: ' + DEC_PATH);
const DEC = JSON.parse(fs.readFileSync(DEC_PATH, 'utf8'));
const BASE = path.dirname(DEC_PATH);
PROJ_DIR = PROJ_DIR || BASE;
const PROJ = PROJ_TSRCT || (DEC.saida ? path.resolve(BASE, DEC.saida) : null);

const DRY = flag('dry-run');
const FPS = Number(opc('fps', 30));
const CRF = opc('crf', '4');
const AUDIO = opc('audio', 'fonte');
const PASSOS = (opc('passos', 'prepara,exporta,junta,compara') || '').split(',');
const REF = opc('referencia', null) && abs(opc('referencia'));
const AMOSTRAR = flag('amostrar');
const MIN_SEG = Number(opc('min-seg', 5));
const PEDACOS_OPC = String(opc('pedacos', 'auto')).toLowerCase();
const CORTES_S = (opc('cortes', '') || '').split(',').filter(Boolean).map(Number).sort((a, b) => a - b);
const DIR = path.resolve(opc('dir', path.join(PROJ_DIR, 'export-pedacos')));
const MOT_DEC = DEC.motion || {};
const COPIAR = [...new Set([...(MOT_DEC.arquivos || []), ...(opc('copiar', '') || '').split(',').filter(Boolean)])];
const TSRCT = path.join(process.env.LOCALAPPDATA || '', 'Tesseract', 'bin', 'tsrct.cmd');
const FOLGA = 0.0002; // s: arredonda para baixo os tempos que caem exatamente num quadro (ver msP)
const LIMITE_INTEIRO_S = 20; // abaixo disto não vale dividir
const ATRASO_MAX_Q = 15;     // início de frase dentro de um bloco só vale se o bloco acaba em até 0,5 s
const S_POR_QUADRO = { inteiro: 0.43, pedaco: 0.25 }; // medido num teste de 63 s (Ryzen 7 5700U)

// montar-video.js / mixar-audio.js: sobe a partir da decupagem e deste arquivo até achar a pasta do motor
const achaMotor = (arq) => {
  for (const ini of [BASE, __dirname]) {
    let d = ini;
    for (let k = 0; k < 7; k++) {
      for (const sub of ['', 'projetos', '_motor']) { const f = path.join(d, sub, arq); if (fs.existsSync(f)) return f; }
      d = path.dirname(d);
    }
  }
  return null;
};
const MONTAR = achaMotor('montar-video.js');
const MIXAR = achaMotor('mixar-audio.js');
const NOMES_MOTION_PRE = () => (MOT_DEC.blocos || []).filter((b) => typeof b === 'string');
const MOTION_ARQ = opc('motion', null) || MOT_DEC.script;
const MOTION = MOTION_ARQ ? path.resolve(BASE, MOTION_ARQ)
  : (fs.readdirSync(BASE).filter((f) => /^motion-.*\.js$/.test(f)).map((f) => path.join(BASE, f))[0] || null);

// ---------- pré-checagens ----------
const AVISOS_PRE = [];
function preChecagens() {
  const info = { ram_livre_gb: null, ram_total_gb: Number((os.totalmem() / 2 ** 30).toFixed(1)), tsrct: 0, ffmpeg: 0, navegador_gb: 0 };
  info.ram_livre_gb = opc('ram-livre-gb') ? Number(opc('ram-livre-gb')) : Number((os.freemem() / 2 ** 30).toFixed(2));
  try {
    const linhas = sh('tasklist', ['/FO', 'CSV', '/NH']).split(/\r?\n/);
    let kb = 0;
    for (const l of linhas) {
      const m = l.match(/^"([^"]+)","\d+","[^"]*","\d+","([^"]*)"/); if (!m) continue;
      const nome = m[1].toLowerCase(); const mem = Number(m[2].replace(/\D/g, '')) || 0;
      if (nome === 'tsrct.exe') info.tsrct++;
      else if (nome === 'ffmpeg.exe') info.ffmpeg++;
      else if (/^(chrome|msedge|firefox|brave|opera)\.exe$/.test(nome)) kb += mem;
    }
    info.navegador_gb = Number((kb / 2 ** 20).toFixed(2));
  } catch (e) { AVISOS_PRE.push('não consegui listar os processos (tasklist): ' + String(e.message).slice(0, 80)); }
  if (info.tsrct) AVISOS_PRE.push(`há ${info.tsrct} processo(s) tsrct rodando (outro export ou editor): disputa memória e tempo com os pedaços`);
  if (info.ffmpeg) AVISOS_PRE.push(`há ${info.ffmpeg} processo(s) ffmpeg rodando: a medida de tempo e de memória fica menos confiável`);
  if (info.navegador_gb >= 1.5) AVISOS_PRE.push(`navegador pesado aberto (${vg(info.navegador_gb, 1)} GB): feche antes do export para sobrar memória`);
  for (const [bin, a] of [['ffmpeg', ['-version']], ['ffprobe', ['-version']]]) {
    const r = spawnSync(bin, a, { encoding: 'utf8' }); if (r.status !== 0) fim(`${bin} não encontrado no PATH`);
  }
  if (!fs.existsSync(TSRCT)) fim('tsrct não encontrado em ' + TSRCT);
  if (!MONTAR) fim('montar-video.js não encontrado perto da decupagem');
  return info;
}
const PRE = preChecagens();
if (NOMES_MOTION_PRE().length && !MOTION) fim('a decupagem lista blocos em motion.blocos mas não há motion-*.js ao lado dela: use motion.script na decupagem ou --motion');

// ---------- vídeo, palavras, intervalos protegidos ----------
const probe = (f, ent, extra = []) => sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', ...extra, '-show_entries', ent, '-of', 'csv=p=0', f]).trim();
const VIDEO = path.resolve(BASE, DEC.video);
if (!fs.existsSync(VIDEO)) fim('vídeo da decupagem não existe: ' + VIDEO);
const MATTE = DEC.matte ? path.resolve(BASE, DEC.matte) : null;
const contaQuadros = (f) => {
  const rapido = Number(probe(f, 'stream=nb_frames'));
  return rapido > 0 ? rapido : Number(probe(f, 'stream=nb_read_frames', ['-count_frames']));
};
const N = contaQuadros(VIDEO);
const FPS_FONTE = (() => { const [a, b] = probe(VIDEO, 'stream=r_frame_rate').split('/').map(Number); return b ? a / b : a; })();
const DUR_S = N / FPS;
const qd = (t) => Math.ceil(t * FPS - 1e-6); // primeiro quadro inteiro em ou depois do instante t

const PAL = JSON.parse(fs.readFileSync(path.resolve(BASE, DEC.palavras), 'utf8'));
// 1ª palavra de cada frase (início da legenda = ini - 80 ms) e fim da frase
const FRASES = (() => {
  const m = new Map();
  PAL.forEach((w) => { const f = m.get(w.frase); if (!f) m.set(w.frase, { frase: w.frase, texto: w.w, ini: (w.ini - 80) / 1000, fim: w.fim / 1000 }); else f.fim = Math.max(f.fim, w.fim / 1000); });
  return [...m.values()].sort((a, b) => a.ini - b.ini);
})();

// janelas dos blocos de motion: --janelas arquivo > decupagem.motion.janelas
function lerJanelas(raw) {
  const m = new Map();
  if (!raw) return m;
  if (Array.isArray(raw)) raw.forEach((j) => { const id = j.id || j.nome; const a = j.inicio ?? j.ini, z = j.fim; if (id !== undefined && Number.isFinite(a) && Number.isFinite(z)) m.set(String(id), [a, z]); });
  else Object.entries(raw).forEach(([id, j]) => {
    if (Array.isArray(j) && j.length === 2) m.set(id, [Number(j[0]), Number(j[1])]);
    else if (j && typeof j === 'object') m.set(id, [Number(j.inicio ?? j.ini), Number(j.fim)]);
  });
  return m;
}
const JAN = lerJanelas(opc('janelas') ? JSON.parse(fs.readFileSync(abs(opc('janelas')), 'utf8')) : MOT_DEC.janelas);
const NOMES_MOTION = (MOT_DEC.blocos || []).filter((b) => typeof b === 'string');
const SEM_JANELA = NOMES_MOTION.filter((n) => !JAN.has(n));
const JAN_RUINS = [...JAN].filter(([, [a, z]]) => !(Number.isFinite(a) && Number.isFinite(z) && z > a && a >= 0));
if (JAN_RUINS.length) fim('janela inválida (início < fim, em segundos): ' + JAN_RUINS.map(([n, j]) => n + ' ' + JSON.stringify(j)).join('; '));

// intervalos (em segundos) que não podem ser partidos: janelas de motion, headline, alerta e blocos da decupagem
const INTERVALOS = [
  ...[...JAN].map(([nome, [a, z]]) => ({ nome, a, z, origem: 'motion' })),
  ...[['blocos', DEC.blocos], ['headline', DEC.headline], ['alerta', DEC.alerta]].flatMap(([origem, l]) => (l || []).map((o) => ({ nome: o.tipo || o.motivo || o.palavra || origem, a: o.ini, z: o.fim, origem }))),
].filter((o) => Number.isFinite(o.a) && Number.isFinite(o.z));
const INTERVALOS_Q = INTERVALOS.map((o) => ({ ...o, qa: qd(o.a), qz: qd(o.z) })).filter((o) => o.qz > o.qa);
// o corte no quadro c parte um intervalo se o intervalo tem quadros dos dois lados (qa < c < qz)
const parte = (c) => INTERVALOS_Q.some((o) => o.qa < c && c < o.qz);

// ---------- candidatos a corte e escolha ----------
function candidatos() {
  const m = new Map();
  const add = (c, tipo, f, fs) => { if (c > 0 && c < N && !m.has(c)) m.set(c, { quadro: c, seg: c / FPS, tipo, frase: f.texto, fraseSeg: f.ini, atrasoQ: c - fs }); };
  for (const f of FRASES) {
    const qf = qd(f.ini); // quadro em que a legenda da frase entra
    if (!parte(qf)) { add(qf, 'frase', f, qf); continue; }
    let q = qf; while (q < N && parte(q)) q++;
    if (q - qf <= ATRASO_MAX_Q) add(q, 'frase-apos-bloco', f, qf);
  }
  if (flag('cortes-fora-de-frase')) {
    // último recurso: fronteiras entre blocos (primeiro quadro livre depois do fim de cada intervalo)
    for (const o of INTERVALOS_Q) { if (!parte(o.qz)) { const f = FRASES.filter((x) => x.ini * FPS <= o.qz).pop() || FRASES[0]; add(o.qz, 'fronteira-de-bloco', f, o.qz); } }
  }
  const minQ = Math.round(MIN_SEG * FPS);
  return [...m.values()].filter((c) => c.quadro >= minQ && N - c.quadro >= minQ).sort((a, b) => a.quadro - b.quadro);
}
// escolhe k-1 cortes que minimizam o maior pedaço (em quadros); empate: menos cortes após bloco, depois menor soma de quadrados
function escolheCortes(cands, k) {
  const minQ = Math.round(MIN_SEG * FPS);
  let melhor = null;
  const rec = (ini, prev, esc) => {
    if (esc.length === k - 1) {
      const bordas = [0, ...esc.map((c) => c.quadro), N];
      const tam = bordas.slice(1).map((q, i) => q - bordas[i]);
      if (N - esc[esc.length - 1].quadro < minQ) return;
      const nota = [Math.max(...tam) + 15 * esc.filter((c) => c.tipo !== 'frase').length, tam.reduce((s, x) => s + x * x, 0)];
      if (!melhor || nota[0] < melhor.nota[0] || (nota[0] === melhor.nota[0] && nota[1] < melhor.nota[1])) melhor = { cortes: esc.slice(), nota };
      return;
    }
    for (let i = ini; i < cands.length; i++) {
      if (cands[i].quadro - prev < minQ) continue;
      rec(i + 1, cands[i].quadro, [...esc, cands[i]]);
    }
  };
  rec(0, 0, []);
  return melhor && melhor.cortes;
}
// corte manual (--cortes, em segundos de virada): vai ao 1º quadro livre se cair dentro de um bloco (até 0,5 s) e alinha
// ao início da frase a menos de 0,6 s, se isso não partir um bloco
const alinhaManual = (t) => {
  let c0 = qd(t);
  for (let q = c0; q - c0 <= ATRASO_MAX_Q && parte(c0); q++) { if (!parte(q)) { c0 = q; break; } }
  const perto = FRASES.map((f) => [Math.abs(f.ini - t), f]).sort((p, q) => p[0] - q[0])[0];
  const mk = (c, tipo, f) => ({ quadro: c, seg: c / FPS, tipo, frase: f ? f.texto : '', fraseSeg: f ? f.ini : t, atrasoQ: f ? Math.max(0, c - qd(f.ini)) : 0 });
  if (!perto || perto[0] > 0.6) return mk(c0, 'manual', null);
  const c1 = qd(perto[1].ini);
  if (c1 !== c0 && !parte(c1)) return mk(c1, 'manual-frase', perto[1]);
  return mk(c0, 'manual', perto[1]);
};

// ---------- decisão: quantos pedaços e onde ----------
function decide() {
  const motivos = [];  // por que não dividiu (ou por que reduziu)
  const avisos = [...AVISOS_PRE];
  const ram = PRE.ram_livre_gb;
  let k, origemK;
  if (CORTES_S.length) { k = CORTES_S.length + 1; origemK = '--cortes manual'; }
  else if (['1', 'inteiro'].includes(PEDACOS_OPC)) { k = 1; origemK = '--pedacos ' + PEDACOS_OPC; }
  else if (PEDACOS_OPC === 'auto') {
    if (ram >= 6) k = 4; else if (ram >= 3) k = 3; else { k = 2; avisos.push(`RAM livre ${vg(ram, 1)} GB (< 3 GB): 2 pedaços; feche programas ou use --pedacos 1 se travar`); }
    origemK = `auto (RAM livre ${vg(ram, 1)} GB)`;
  } else {
    k = Number(PEDACOS_OPC);
    if (![2, 3, 4].includes(k)) fim('--pedacos aceita auto, 2, 3, 4 ou inteiro');
    origemK = '--pedacos ' + k;
    const minimo = { 2: 2, 3: 3, 4: 6 }[k];
    if (ram < minimo) avisos.push(`${k} pedaços pedem ~${minimo} GB livres e há ${vg(ram, 1)} GB: risco de paginação (no teste de 4 pedaços sobraram 322 MB)`);
  }
  if (k > 1 && !flag('forcar-pedacos') && DUR_S < LIMITE_INTEIRO_S) { motivos.push(`vídeo com ${vg(DUR_S, 1)} s (< ${LIMITE_INTEIRO_S} s): dividir não compensa`); k = 1; }
  if (k > 1 && Math.abs(FPS_FONTE - FPS) > 0.01) { motivos.push(`o vídeo tem ${vg(FPS_FONTE)} fps e o export é a ${FPS}: o corte por quadro não vale`); k = 1; }
  if (k > 1 && SEM_JANELA.length && !flag('sem-janelas')) {
    motivos.push(`bloco(s) de motion sem janela em decupagem.motion.janelas: ${SEM_JANELA.join(', ')} (preencha ou use --sem-janelas)`); k = 1;
  }
  let cortes = [];
  if (k > 1) {
    if (CORTES_S.length) cortes = CORTES_S.map(alinhaManual);
    else {
      const cands = candidatos();
      let kk = k, esc = null;
      while (kk > 1 && !(esc = escolheCortes(cands, kk))) kk--;
      if (kk === 1) { motivos.push(`nenhum corte válido (início de frase fora de bloco, pedaços >= ${MIN_SEG} s): ${cands.length} candidato(s)`); k = 1; }
      else { if (kk < k) avisos.push(`só há cortes válidos para ${kk} pedaços (pedidos ${k})`); k = kk; cortes = esc; }
    }
  }
  const bordas = [0, ...cortes.map((c) => c.quadro), N];
  const pedacos = [];
  for (let i = 0; i < bordas.length - 1; i++) {
    if (bordas[i + 1] <= bordas[i]) fim('cortes fora de ordem ou além do fim do vídeo');
    pedacos.push({ i: i + 1, ini: bordas[i], fim: bordas[i + 1], n: bordas[i + 1] - bordas[i], dir: path.join(DIR, 'pedaco-' + (i + 1)) });
  }
  // avisos de plano (puros, sem arquivo)
  const veQ = (a, z, p) => { const k0 = Math.max(p.ini, qd(a)); return k0 < p.fim && k0 / FPS < z - 1e-9; };
  cortes.forEach((c) => {
    if (c.atrasoQ > 0) avisos.push(`corte em ${c.quadro} (${vg(c.seg)} s): a legenda da frase "${c.frase}" começa ${c.atrasoQ} quadro(s) antes (bloco ainda na tela); pode entrar ${c.atrasoQ} quadro(s) tarde`);
    if (c.tipo === 'fronteira-de-bloco') avisos.push(`corte em ${c.quadro} (${vg(c.seg)} s) não é início de frase: as legendas do trecho podem divergir`);
    const fr = FRASES.find((f) => f.ini * FPS < c.quadro - 1.5 && c.quadro < f.fim * FPS);
    if (fr && !c.atrasoQ && c.tipo !== 'fronteira-de-bloco') avisos.push(`corte em ${c.quadro} (${vg(c.seg)} s) cai no meio da frase "${fr.texto}…"; as legendas do trecho podem divergir`);
    INTERVALOS_Q.filter((o) => o.qa < c.quadro && c.quadro < o.qz).forEach((o) => avisos.push(`o item ${o.nome} (${o.a}–${o.z} s) atravessa o corte ${c.quadro} e foi recortado`));
  });
  return { k, origemK, motivos, avisos: [...new Set(avisos)], cortes, pedacos, veQ };
}
const PLANO = decide();
const PEDACOS = PLANO.pedacos;
const MODO = PLANO.k > 1 ? 'pedacos' : 'inteiro';

// segundo do vídeo inteiro → ms do pedaço. O -0.2 ms faz um tempo que cai exatamente num quadro (múltiplos de 100 ms)
// arredondar para baixo, e não para cima, depois do deslocamento de 1/30 s fracionário: sem isso o bloco entraria um quadro tarde.
const msP = (ms, p) => Math.round(ms - (p.ini * 1000) / FPS - 0.2);
const sP = (s, p) => Number((s - p.ini / FPS - FOLGA).toFixed(5));
const durMs = (p) => (p.n * 1000) / FPS;
const durS = (p) => p.n / FPS;
const veQuadro = PLANO.veQ;
const cruza = (a, z, p) => { const qa = qd(a), qz = qd(z); return qz > qa && veQuadro(a, z, p) && ((qa < p.ini && qz > p.ini) || (qa < p.fim && qz > p.fim)); };

// ---------- relatório do plano ----------
function relatorio() {
  const L = [];
  const f1 = (x) => vg(x, 3);
  L.push(`Decupagem: ${path.relative(process.cwd(), DEC_PATH) || DEC_PATH}`);
  L.push(`Vídeo: ${N} quadros a ${vg(FPS_FONTE, 2)} fps = ${f1(DUR_S)} s | RAM livre ${vg(PRE.ram_livre_gb, 1)} GB de ${vg(PRE.ram_total_gb, 1)} GB | tsrct ${PRE.tsrct}, ffmpeg ${PRE.ffmpeg}, navegador ${vg(PRE.navegador_gb, 1)} GB`);
  L.push(`Janelas de motion: ${JAN.size} (${NOMES_MOTION.length} bloco(s) listados em motion.blocos; ${SEM_JANELA.length} sem janela)`);
  if (MODO === 'inteiro') {
    L.push(`Plano: EXPORT INTEIRO (${PLANO.origemK})${PLANO.motivos.length ? ' | motivo: ' + PLANO.motivos.join('; ') : ''}`);
    L.push(`  estimativa de export: ~${Math.round(N * S_POR_QUADRO.inteiro)} s (0,43 s por quadro)`);
  } else {
    const maior = Math.max(...PEDACOS.map((p) => p.n));
    L.push(`Plano: ${PLANO.k} PEDAÇOS em paralelo (${PLANO.origemK}) | maior pedaço ${maior} quadros | estimativa de export ~${Math.round(maior * S_POR_QUADRO.pedaco)} s + preparo 1 a 2 min (inteiro: ~${Math.round(N * S_POR_QUADRO.inteiro)} s)`);
    PEDACOS.forEach((p) => L.push(`  pedaço ${p.i}: quadros ${p.ini}–${p.fim - 1} (${f1(p.ini / FPS)} a ${f1(p.fim / FPS)} s, ${p.n} quadros)`));
    PLANO.cortes.forEach((c) => L.push(`  corte no quadro ${c.quadro} = ${f1(c.seg)} s | ${c.tipo}${c.frase ? (c.tipo === 'fronteira-de-bloco' ? ` (frase em andamento: "${c.frase}", começou em ${f1(c.fraseSeg)} s)` : ` "${c.frase}" (legenda em ${f1(c.fraseSeg)} s)`) : ''}`));
  }
  PLANO.avisos.forEach((a) => L.push('  AVISO ' + a));
  return L.join('\n');
}
const planoJson = () => ({ modo: MODO, k: PLANO.k, origem: PLANO.origemK, motivos: PLANO.motivos, fps: FPS, quadros: N, duracaoSeg: DUR_S, ram: PRE, avisos: PLANO.avisos,
  cortes: PLANO.cortes.map((c) => ({ quadro: c.quadro, seg: Number(c.seg.toFixed(3)), tipo: c.tipo, frase: c.frase })),
  pedacos: PEDACOS.map(({ i, ini, fim, n }) => ({ i, ini, fim, n, iniSeg: Number((ini / FPS).toFixed(3)), fimSeg: Number((fim / FPS).toFixed(3)) })) });

// ---------- 1. prepara (pedaços) ----------
function prepara() {
  const palavras = PAL;
  const CORTES_FF = [];
  const ffCut = (src, saida, p, comAudio, pixFmt) => {
    const f = ['-v', 'error', '-y', '-i', src, '-vf', `trim=start_frame=${p.ini}:end_frame=${p.fim},setpts=PTS-STARTPTS`, '-r', String(FPS),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', CRF, '-pix_fmt', pixFmt, '-g', '30'];
    if (comAudio) f.push('-af', `atrim=start=${(p.ini / FPS).toFixed(6)}:end=${(p.fim / FPS).toFixed(6)},asetpts=PTS-STARTPTS`, '-c:a', 'aac', '-b:a', '256k');
    else f.push('-an');
    CORTES_FF.push(['ffmpeg', [...f, saida]]);
  };
  const roda = ([cmd, a]) => new Promise((res, rej) => { const c = spawn(cmd, a, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; c.stderr.on('data', (x) => (e += x)); c.on('close', (k) => (k === 0 ? res() : rej(new Error(cmd + ' falhou: ' + e.slice(-800))))); });
  const pixFmt = (f) => sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt', '-of', 'csv=p=0', f]).trim();
  const pfV = pixFmt(VIDEO), pfM = MATTE ? pixFmt(MATTE) : null;
  const avisos = [...PLANO.avisos];

  PEDACOS.forEach((p) => {
    const reusa = flag('reusa-cortes') && fs.existsSync(path.join(p.dir, 'video.mp4')) && (!MATTE || fs.existsSync(path.join(p.dir, 'matte.mp4')));
    if (reusa) fs.readdirSync(p.dir).filter((f) => !/^(video|matte).mp4$/.test(f)).forEach((f) => fs.rmSync(path.join(p.dir, f), { recursive: true, force: true }));
    else { fs.rmSync(p.dir, { recursive: true, force: true }); fs.mkdirSync(p.dir, { recursive: true }); }
    // palavras: frases que tocam o pedaço + a primeira da frase seguinte (para o fim da última legenda sair igual)
    const ws = palavras.map((w) => ({ ...w, ini: msP(w.ini, p), fim: msP(w.fim, p) }));
    const D = durMs(p);
    const primeiraDaFrase = new Map();
    ws.forEach((w, k) => { if (!primeiraDaFrase.has(w.frase)) primeiraDaFrase.set(w.frase, k); });
    // frases inteiras (o agrupamento das legendas depende da frase toda): entra a frase que tem alguma legenda dentro do pedaço
    const iniFrase = (f) => ws[primeiraDaFrase.get(f)].ini - 80;
    const fimFrase = new Map(); ws.forEach((w) => fimFrase.set(w.frase, Math.max(fimFrase.get(w.frase) || -1e9, w.fim)));
    const inclui = ws.filter((w) => fimFrase.get(w.frase) > 0 && iniFrase(w.frase) < D);
    const out = inclui.map((w, k) => {
      const primeira = k === 0 || inclui[k - 1].frase !== w.frase;
      return { ...w, ini: Math.max(w.ini, primeira ? 80 : 0), fim: Math.max(w.fim, 1) };
    });
    // se a legenda seguinte (cortada fora) fosse emendar na última, a última tem que durar até o fim do pedaço
    const ultimo = out[out.length - 1];
    const proxima = ws[ws.indexOf(inclui[inclui.length - 1]) + 1];
    if (ultimo && proxima) {
      const iniProx = proxima.ini - (proxima.frase !== inclui[inclui.length - 1].frase ? 80 : 0);
      if (iniProx - ultimo.fim < 700) ultimo.fim = Math.max(ultimo.fim, Math.round(D - 300 + 1));
    }
    fs.writeFileSync(path.join(p.dir, 'palavras.json'), JSON.stringify(out, null, 1));

    COPIAR.forEach((f) => fs.copyFileSync(path.resolve(BASE, f), path.join(p.dir, path.basename(f))));
    if (!reusa) {
      ffCut(VIDEO, path.join(p.dir, 'video.mp4'), p, true, pfV);
      if (MATTE) ffCut(MATTE, path.join(p.dir, 'matte.mp4'), p, false, pfM);
    }

    // decupagem do pedaço
    const d = JSON.parse(JSON.stringify(DEC));
    d.titulo = `${DEC.titulo || 'Reels'} — pedaço ${p.i}/${PEDACOS.length}`;
    d.video = 'video.mp4'; d.palavras = 'palavras.json'; d.saida = `pedaco-${p.i}.tsrct`;
    if (MATTE) d.matte = 'matte.mp4';
    const faixa = (o) => ({ ...o, ini: Math.max(0, sP(o.ini, p)), fim: Math.min(durS(p), sP(o.fim, p)) });
    const sobrepoe = (o) => veQuadro(o.ini, o.fim, p);
    d.enquadramento = (DEC.enquadramento || []).filter(sobrepoe).map(faixa); // ms negativo é recusado pelo Tesseract
    d.alerta = (DEC.alerta || []).filter(sobrepoe).map(faixa);
    d.headline = (DEC.headline || []).filter(sobrepoe).map(faixa);
    d.blocos = (DEC.blocos || []).filter(sobrepoe).map((b) => {
      const x = faixa(b);
      if (b.escondeLegenda) x.escondeLegenda = b.escondeLegenda.map((t) => Math.min(durS(p), Math.max(0, sP(t, p))));
      if (b.digitacao) x.digitacao = b.digitacao.map(([t, s]) => [sP(t, p), s]);
      return x;
    });
    for (const o of [...(DEC.alerta || []), ...(DEC.headline || []), ...(DEC.blocos || [])]) {
      if (cruza(o.ini, o.fim, p)) avisos.push(`pedaço ${p.i}: o item ${o.tipo || o.palavra || o.motivo || ''} (${o.ini}–${o.fim}s) atravessa um corte e foi recortado`);
    }
    const mot = { ...MOT_DEC };
    delete mot.janelas; delete mot.arquivos; delete mot.script;
    if (mot.blocos) {
      mot.blocos = mot.blocos.filter((nome) => {
        const j = JAN.get(nome);
        if (!j) { avisos.push(`bloco de motion "${nome}" sem janela: incluído em todos os pedaços`); return true; }
        if (cruza(j[0], j[1], p)) avisos.push(`pedaço ${p.i}: o bloco "${nome}" (${j[0]}–${j[1]}s) atravessa um corte`);
        return veQuadro(j[0], j[1], p);
      });
    }
    mot.desloca = Number((-(p.ini / FPS) - FOLGA + (MOT_DEC.desloca || 0)).toFixed(5)); // motion*.js soma "desloca" a todos os tempos (em segundos do vídeo inteiro)
    d.motion = mot;
    delete d.som;
    p.dec = path.join(p.dir, 'decupagem.json');
    fs.writeFileSync(p.dec, JSON.stringify(d, null, 2));
  });

  return Promise.all(CORTES_FF.map(roda)).then(async () => {
    // monta o projeto e aplica o motion, em paralelo entre pedaços (cada um em sequência)
    await Promise.all(PEDACOS.map((p) => {
      const run = (script) => new Promise((r2, j2) => {
        const c = spawn('node', [script, p.dec], { stdio: ['ignore', 'pipe', 'pipe'] });
        let o = '', e = ''; c.stdout.on('data', (x) => (o += x)); c.stderr.on('data', (x) => (e += x));
        c.on('close', (k) => (k === 0 ? r2(o) : j2(new Error(`${path.basename(script)} pedaço ${p.i}: ${e.slice(-1200)}`))));
      });
      return run(MONTAR).then((o) => { log(`pedaço ${p.i} montado`, o.trim().slice(0, 160)); return MOTION && (MOT_DEC.blocos || []).length ? run(MOTION) : ''; })
        .then((o) => { if (o) log(`pedaço ${p.i} motion`, o.trim().slice(0, 160)); });
    }));
    [...new Set(avisos)].forEach((a) => log('AVISO', a));
    fs.writeFileSync(path.join(DIR, 'plano.json'), JSON.stringify({ ...planoJson(), avisos: [...new Set(avisos)] }, null, 2));
  });
}

// ---------- 2. exporta (paralelo) ----------
const AMOSTRADOR_PS1 = `
param([string]$Saida, [int]$Intervalo = 2)
$ErrorActionPreference = 'SilentlyContinue'
Set-Content -Path $Saida -Value 'epoch_ms,cpu_total_pct,mem_livre_mb,ws_tsrct_mb,ws_ffmpeg_mb,n_tsrct'
while ($true) {
  $c = (Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter "Name='_Total'").PercentProcessorTime
  $m = [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1024)
  $t = @(Get-Process -Name tsrct); $f = @(Get-Process -Name ffmpeg)
  $wt = [math]::Round((($t | Measure-Object WorkingSet64 -Sum).Sum) / 1MB)
  $wf = [math]::Round((($f | Measure-Object WorkingSet64 -Sum).Sum) / 1MB)
  $ms = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
  Add-Content -Path $Saida -Value "$ms,$c,$m,$wt,$wf,$($t.Count)"
  Start-Sleep -Seconds $Intervalo
}`;

// exporta um projeto .tsrct com o tsrct; resolve { codigo, segundos, ultima linha }
function exportaUm(tsrctArq, mp4, rotuloLog) {
  return new Promise((res) => {
    const ini = Date.now();
    const c = spawn('cmd.exe', ['/c', TSRCT, 'export', '-p', tsrctArq, '-o', mp4, '--fps', String(FPS)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let ult = '', logTxt = '';
    const onData = (x) => { const s = String(x); logTxt += s; const l = s.trim().split(/\r?\n/).pop(); if (l) ult = l; };
    c.stdout.on('data', onData); c.stderr.on('data', onData);
    c.on('close', (k) => { fs.writeFileSync(rotuloLog, logTxt); res({ codigo: k, segundos: (Date.now() - ini) / 1000, ultima: ult, ok: k === 0 && fs.existsSync(mp4) && fs.statSync(mp4).size > 0 }); });
  });
}

async function exporta(rotulo = 'export') {
  const SO = opc('so', null);
  const ALVO = SO ? PEDACOS.filter((p) => p.i === Number(SO)) : PEDACOS;
  let amostrador = null;
  if (AMOSTRAR) {
    const ps1 = path.join(DIR, 'amostrador.ps1'); fs.writeFileSync(ps1, AMOSTRADOR_PS1);
    amostrador = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1, path.join(DIR, `amostras-${rotulo}.csv`), '2'], { stdio: 'ignore' });
  }
  const t0 = Date.now();
  const doPedaco = (p) => {
    p.mp4 = path.join(p.dir, `pedaco-${p.i}-sem-trilha.mp4`);
    return exportaUm(path.join(p.dir, `pedaco-${p.i}.tsrct`), p.mp4, path.join(p.dir, `export-${rotulo}.log`))
      .then((r) => { log(`pedaço ${p.i} export código ${r.codigo} em ${r.segundos.toFixed(1)} s | ${r.ultima}`); return { i: p.i, quadros: p.n, codigo: r.codigo, segundos: r.segundos, ok: r.ok }; });
  };
  let r = await Promise.all(ALVO.map(doPedaco));
  // resiliência: pedaço que falhou (memória, por exemplo) é refeito uma vez, sozinho, depois dos outros
  for (const falho of r.filter((x) => !x.ok)) {
    log(`pedaço ${falho.i} falhou (código ${falho.codigo}); tentando de novo, sozinho`);
    const novo = await doPedaco(ALVO.find((p) => p.i === falho.i));
    r = r.map((x) => (x.i === falho.i ? { ...novo, repetido: true } : x));
  }
  if (amostrador) spawnSync('taskkill', ['/PID', String(amostrador.pid), '/T', '/F']);
  const total = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(DIR, `tempos-${rotulo}.json`), JSON.stringify({ rotulo, pedacos: r, total_s: total, inicio_epoch_ms: t0, fim_epoch_ms: Date.now() }, null, 2));
  log(`export em paralelo de ${r.length} pedaço(s): ${total.toFixed(1)} s`);
  const ruins = r.filter((x) => !x.ok);
  if (ruins.length) throw new Error(`export falhou no(s) pedaço(s) ${ruins.map((x) => x.i).join(', ')} (veja pedaco-N/export-${rotulo}.log). Alternativa: --pedacos 1 (export inteiro) ou --pedacos 2/3 com a máquina mais livre.`);
}

// ---------- 3. junta ----------
const temAudio = (f) => sh('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f]).trim() === 'audio';
function junta() {
  const lista = path.join(DIR, 'lista.txt');
  fs.writeFileSync(lista, PEDACOS.map((p) => `file '${path.join(p.dir, `pedaco-${p.i}-sem-trilha.mp4`).replace(/\\/g, '/')}'`).join('\n'));
  const saida = path.join(DIR, 'junto-sem-trilha.mp4');
  // 1) só o vídeo, em stream copy. -avoid_negative_ts make_zero é obrigatório: sem ele o concat sai com start_time 0,064 s
  //    e qualquer comparação por timestamp (psnr/ssim) desalinha 2 quadros.
  const soVideo = path.join(DIR, 'junto-video.mp4');
  sh('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-an', '-avoid_negative_ts', 'make_zero', soVideo]);
  if (AUDIO === 'fonte' && temAudio(VIDEO)) {
    // 2a) áudio copiado do vídeo original (a voz que o mixar-audio.js vai usar), cortado no fim do vídeo.
    //     Sem make_zero aqui: ele deslocaria o áudio 1024 amostras (priming do AAC).
    sh('ffmpeg', ['-v', 'error', '-y', '-i', soVideo, '-i', VIDEO, '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-shortest', '-movflags', '+faststart', saida]);
  } else if (AUDIO === 'fonte') {
    sh('ffmpeg', ['-v', 'error', '-y', '-i', soVideo, '-map', '0:v:0', '-c', 'copy', '-an', '-movflags', '+faststart', saida]);
  } else {
    // 2b) áudio dos pedaços (não recomendado: sai 51 a 63 ms mais curto por pedaço): decodifica, concatena em PCM, codifica uma vez
    const wav = path.join(DIR, 'audio-pedacos.wav');
    sh('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', wav]);
    sh('ffmpeg', ['-v', 'error', '-y', '-i', soVideo, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
      '-avoid_negative_ts', 'make_zero', '-movflags', '+faststart', saida]);
  }
  somCompleta(saida, true);
  log('junto:', saida, sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,nb_frames', '-of', 'compact', saida]).trim().replace(/\n/g, ' '));
  return saida;
}

// ---------- 3b. decupagem de som do vídeo inteiro ----------
// O motion*.js grava <decupagem>-som.json com os blocos-fantasma de som (pop, whoosh...) em tempo do PEDAÇO (ou do vídeo
// inteiro, no modo inteiro). Aqui eles voltam para o tempo do vídeo inteiro, numa decupagem que o mixar-audio.js lê sem mudar:
//   node mixar-audio.js <dir>/decupagem-som-completa.json [--saida arquivo.mp4]
function somCompleta(videoBase, porPedacos) {
  const sons = [];
  if (porPedacos) {
    for (const p of PEDACOS) {
      const f = path.join(p.dir, 'decupagem-som.json');
      if (!fs.existsSync(f)) continue;
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      const qtd = (JSON.parse(fs.readFileSync(path.join(p.dir, 'decupagem.json'), 'utf8')).blocos || []).length;
      d.blocos.slice(qtd).forEach((b) => sons.push({ ...b, ini: Number((b.ini + p.ini / FPS + FOLGA).toFixed(3)), fim: Number((b.fim + p.ini / FPS + FOLGA).toFixed(3)) }));
    }
  } else {
    const f = DEC_PATH.replace(/\.json$/, '-som.json');
    if (fs.existsSync(f)) {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      d.blocos.slice((DEC.blocos || []).length).forEach((b) => sons.push(b));
    }
  }
  const absB = (f) => (f ? path.resolve(BASE, f) : f);
  const out = { ...DEC, palavras: absB(DEC.palavras), video: absB(DEC.video), blocos: [...(DEC.blocos || []), ...sons.sort((x, y) => x.ini - y.ini)] };
  if (DEC.matte) out.matte = absB(DEC.matte);
  out.som = { ...(DEC.som || {}), videoBase, trilha: absB((DEC.som || {}).trilha), saida: DEC.som && DEC.som.saida ? absB(DEC.som.saida) : path.join(DIR, 'reels-com-trilha.mp4') };
  const arq = path.join(DIR, 'decupagem-som-completa.json');
  fs.writeFileSync(arq, JSON.stringify(out, null, 2));
  log(`decupagem de som do vídeo inteiro: ${arq} (${sons.length} blocos de som)`);
  log(`próximo: node ${MIXAR ? path.relative(process.cwd(), MIXAR) || MIXAR : 'mixar-audio.js'} ${path.relative(process.cwd(), arq) || arq}  (saída: ${out.som.saida})`);
}

// ---------- modo inteiro (fallback) ----------
async function inteiro() {
  fs.mkdirSync(DIR, { recursive: true });
  if (!PROJ) throw new Error('modo inteiro precisa do projeto: use --projeto <arquivo.tsrct> ou "saida" na decupagem');
  const somArq = DEC_PATH.replace(/\.json$/, '-som.json');
  const mt = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);
  const precisaMotion = (MOT_DEC.blocos || []).length > 0 && MOTION;
  const fresco = mt(PROJ) > 0 && mt(PROJ) >= mt(DEC_PATH) && mt(PROJ) >= mt(path.resolve(BASE, DEC.palavras)) && (!precisaMotion || mt(somArq) > 0);
  if (!fresco || flag('remontar')) {
    log(`modo inteiro: remontando o projeto (${flag('remontar') ? '--remontar' : 'projeto ausente ou mais antigo que a decupagem'})`);
    log('montar', sh('node', [MONTAR, DEC_PATH]).trim().slice(0, 160));
    if (precisaMotion) log('motion', sh('node', [MOTION, DEC_PATH]).trim().slice(0, 160));
  } else log('modo inteiro: usando o projeto montado', path.relative(process.cwd(), PROJ) || PROJ);
  const saida = path.join(DIR, 'junto-sem-trilha.mp4');
  const r = await exportaUm(PROJ, saida, path.join(DIR, 'export-inteiro.log'));
  log(`export inteiro código ${r.codigo} em ${r.segundos.toFixed(1)} s | ${r.ultima}`);
  if (!r.ok) throw new Error('export inteiro falhou; veja ' + path.join(DIR, 'export-inteiro.log'));
  somCompleta(saida, false);
  fs.writeFileSync(path.join(DIR, 'plano.json'), JSON.stringify({ ...planoJson(), export_s: r.segundos }, null, 2));
  return saida;
}

// ---------- 4. compara ----------
function lerStats(arq) {
  const v = [];
  fs.readFileSync(arq, 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^n:(\d+) .*?\b(?:psnr_avg|All):(inf|[\d.]+)/);
    if (m) v[Number(m[1]) - 1] = m[2] === 'inf' ? 100 : Number(m[2]);
  });
  return v;
}
async function compara() {
  if (!REF) { log('sem --referencia: comparação pulada'); return null; }
  const junto = path.join(DIR, 'junto-sem-trilha.mp4');
  const psnrLog = path.join(DIR, 'psnr.log'), ssimLog = path.join(DIR, 'ssim.log');
  const run = (filtro, logf) => new Promise((res, rej) => {
    const c = spawn('ffmpeg', ['-v', 'error', '-y', '-i', junto, '-i', REF, '-lavfi', `[0:v][1:v]${filtro}=stats_file=${path.basename(logf)}`, '-f', 'null', '-'], { cwd: DIR });
    let e = ''; c.stderr.on('data', (x) => (e += x)); c.on('close', (k) => (k === 0 ? res() : rej(new Error(e.slice(-800)))));
  });
  await Promise.all([run('psnr', psnrLog), run('ssim', ssimLog)]);
  const ps = lerStats(psnrLog), ss = lerStats(ssimLog);
  const media = (a, i, z) => { const s = a.slice(i, z); return s.reduce((x, y) => x + y, 0) / Math.max(1, s.length); };
  const trechos = PEDACOS.map((p) => ({ pedaco: p.i, quadros: [p.ini, p.fim - 1], psnr_medio: media(ps, p.ini, p.fim), psnr_min: Math.min(...ps.slice(p.ini, p.fim)),
    ssim_medio: media(ss, p.ini, p.fim), ssim_min: Math.min(...ss.slice(p.ini, p.fim)) }));
  const emendas = PEDACOS.slice(1).map((p) => ({ quadro_inicio_do_pedaco: p.ini, seg: p.ini / FPS,
    psnr_em_volta: ps.slice(p.ini - 3, p.ini + 3).map((x) => Number(x.toFixed(2))), ssim_em_volta: ss.slice(p.ini - 3, p.ini + 3).map((x) => Number(x.toFixed(4))) }));
  const piores = ps.map((v, i) => [i, v]).sort((a, b) => a[1] - b[1]).slice(0, 12).map(([i, v]) => ({ quadro: i, seg: Number((i / FPS).toFixed(3)), psnr: Number(v.toFixed(2)), ssim: Number((ss[i] || 0).toFixed(4)) }));
  const out = { quadros_comparados: ps.length, psnr_medio: media(ps, 0, ps.length), ssim_medio: media(ss, 0, ss.length), trechos, emendas, piores };
  try { // áudio: alinhamento (correlação cruzada em 1 s, ±50 ms) do áudio do vídeo junto contra o do export inteiro
    const pcm = (f) => { const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }); return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4); };
    const A = pcm(REF), B = pcm(junto);
    out.audio = { amostras_ref: A.length, amostras_junto: B.length, pontos: [] };
    for (const seg of [5, ...PEDACOS.slice(1).flatMap((p) => [p.ini / FPS - 1, p.ini / FPS + 1]), Math.max(5, DUR_S - 3)]) {
      const ini = Math.round(seg * 48000); let best = -Infinity, lag = 0;
      for (let l = -2400; l <= 2400; l++) { let sum = 0; for (let i = ini; i < ini + 48000; i += 7) sum += A[i] * (B[i + l] || 0); if (sum > best) { best = sum; lag = l; } }
      let d = 0, e = 0; for (let i = ini; i < ini + 48000; i++) { const y = B[i + lag] || 0; d += (A[i] - y) ** 2; e += A[i] * A[i]; }
      out.audio.pontos.push({ seg: Number(seg.toFixed(2)), lag_amostras: lag, snr_db: Number((10 * Math.log10(e / d)).toFixed(1)) });
    }
  } catch (e) { out.audio = { erro: String(e.message).slice(0, 200) }; }
  fs.writeFileSync(path.join(DIR, 'comparacao.json'), JSON.stringify(out, null, 2));
  log('comparação:', JSON.stringify({ psnr_medio: out.psnr_medio.toFixed(2), ssim_medio: out.ssim_medio.toFixed(4) }));
  return out;
}

(async () => {
  console.log(relatorio());
  if (DRY) {
    console.log('(--dry-run: nada foi criado nem exportado)');
    if (flag('json')) console.log(JSON.stringify(planoJson()));
    return;
  }
  if (flag('estrito') && PLANO.avisos.length) fim('--estrito: há avisos (veja acima)');
  fs.mkdirSync(DIR, { recursive: true });
  if (MODO === 'inteiro') { await inteiro(); return; }
  log(`${PEDACOS.length} pedaço(s):`, PEDACOS.map((p) => `${p.i}: quadros ${p.ini}–${p.fim - 1} (${(p.ini / FPS).toFixed(3)}–${(p.fim / FPS).toFixed(3)} s)`).join(' | '));
  if (PASSOS.includes('prepara')) await prepara();
  else PEDACOS.forEach((p) => { p.dec = path.join(p.dir, 'decupagem.json'); }); // reaproveita o preparo anterior
  if (PASSOS.includes('exporta')) await exporta(opc('rotulo', 'export'));
  if (PASSOS.includes('junta')) junta();
  if (PASSOS.includes('compara')) await compara();
  if (PASSOS.includes('junta') && !flag('manter') && !flag('so')) {
    PEDACOS.forEach((p) => fs.rmSync(p.dir, { recursive: true, force: true }));
    log('pastas dos pedaços apagadas (use --manter para guardar)');
  }
})().catch((e) => { console.error(e); process.exit(1); });
