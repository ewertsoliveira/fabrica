// Conferência por script do Reels pronto (alternativa 8 do plano de otimização, 2026-10-12).
// Mede o que é medível, para o Renato (passo 9) olhar quadros só no que o script não cobre (rosto, legibilidade, ritmo).
//
// Uso:
//   node conferir-reels.js <video-final.mp4> <decupagem.json> [--saida conferencia.md] [--motion script-de-motion.js] [--max-s 90]
//   node conferir-reels.js --autoteste        (calibra o script contra um caso feito para falhar e um que deve passar)
//
// Confere: duração (<= 90 s), áudio presente, loudness (-14 LUFS +-2) e pico (< -1 dBTP), travessão, vocabulário
// proibido, promessa numérica (aviso), "link na bio", quantidade de CTAs (exatamente 1), logo fora do cartão final,
// endereço da conta (marca.yaml) fora do cartão, y da headline (>= 250). Texto de tela = campos de texto da decupagem + legenda
// (palavras.json) + strings do script de motion do Reels (motion-*.js ao lado da decupagem, ou --motion).
// Com o pedido de um modelo de edição no lugar da decupagem (o vídeo feito com o modelo do estilo, que não tem cartão
// final de chamada), a contagem de CTAs vira AVISO; o resto da conferência vale igual.
// Sai com código 1 se houver qualquer FALHA. Não faz o que exige olhar: rosto coberto, encaixe, legibilidade, ritmo.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const marca = require('../marca/marca');
const HANDLE = marca.handle || '';
const args = process.argv.slice(2);
const opc = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

// ---------- listas ----------
// Base mínima, válida para qualquer empresa (promessa de resultado). O vocabulário da empresa vem do contrato de marca
// (video.vocabulario-vetado); opts.vetados acrescenta termos (usado na calibração).
const PROIBIDAS_BASE = ['fórmula mágica', 'resultados garantidos', 'resultado garantido', 'sem risco nenhum'];
function listaProibida(extras = []) {
  const doContrato = marca.pega('video.vocabulario-vetado', []) || [];
  return [...new Set([...PROIBIDAS_BASE, ...doContrato, ...extras].map((x) => String(x).toLowerCase().trim()).filter(Boolean))];
}
const CTA_PROIBIDO = ['link na bio', 'link da bio', 'clique no link', 'clica no link'];
const PROMESSA = [/\b\d+\s?x\b/i, /\btriplic/i, /\bgarantid/i, /\bdobr(e|ar)\b.*\b(faturamento|clientes|vendas)/i, /\b\d+\s?%/];

const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const achaTermo = (texto, termo) => {
  const t = norm(termo).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp('(^|[^a-z0-9])' + t + '[a-z]*', 'i').test(norm(texto));
};

// ---------- medições ----------
function sonda(video) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', video], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffprobe falhou em ' + video + ': ' + r.stderr);
  const j = JSON.parse(r.stdout);
  return { dur: Number(j.format.duration), audio: j.streams.some((s) => s.codec_type === 'audio') };
}
function loudness(video) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', video, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const i = [...r.stderr.matchAll(/Integrated loudness:\s*\n\s*I:\s*(-?[\d.]+) LUFS/g)].pop();
  const p = [...r.stderr.matchAll(/True peak:\s*\n\s*Peak:\s*(-?[\d.]+) dBFS/g)].pop();
  return { lufs: i ? Number(i[1]) : null, pico: p ? Number(p[1]) : null };
}

// ---------- texto de tela ----------
const CHAVES_TEXTO = new Set(['palavra', 't', 'kicker', 'frase', 'botao', 'rotulo', 'texto', 'legenda', 'selo', 'linhas', 'argumento']);
function coletarTextos(no, caminho, saida, ignoradas) {
  if (Array.isArray(no)) { no.forEach((x, i) => coletarTextos(x, `${caminho}[${i}]`, saida, ignoradas)); return; }
  if (no && typeof no === 'object') {
    for (const [k, v] of Object.entries(no)) {
      const c = caminho ? `${caminho}.${k}` : k;
      if (k === 'palavrasChave' && v && typeof v === 'object') { Object.entries(v).forEach(([f, w]) => saida.push({ onde: `palavrasChave.${f}`, texto: String(w) })); continue; }
      if (k === 'digitacao' && Array.isArray(v)) { v.forEach((d, i) => { if (Array.isArray(d) && typeof d[1] === 'string') saida.push({ onde: `${c}[${i}]`, texto: d[1] }); }); continue; }
      if (typeof v === 'string') {
        if (CHAVES_TEXTO.has(k)) saida.push({ onde: c, texto: v }); else ignoradas.add(k);
      } else coletarTextos(v, c, saida, ignoradas);
    }
  }
}
function stringsDoScript(arq) {
  const src = fs.readFileSync(arq, 'utf8');
  const out = [];
  const re = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(src))) { const s = m[1] ?? m[2] ?? m[3]; if (s && /[A-Za-zÀ-ú]/.test(s)) out.push({ onde: path.basename(arq), texto: s }); }
  return out;
}

// ---------- pedido de modelo no lugar da decupagem ----------
// O passo 6 da linha de Reels, com o modelo do estilo da empresa, passa o pedido do modelo (o arquivo que
// modelos/montar.js lê) no lugar da decupagem. O pedido não tem "blocos" (é onde a decupagem guarda o cartão de chamada)
// e traz os campos que só o montador dos modelos lê: o trecho do vídeo ({ ini, fim }, que o montador sempre lê) e pelo menos
// um entre chamada, destaques, broll ou palavraTela. A decupagem tem "headline" (e "blocos"): quem tem um deles nunca é pedido
// de modelo, mesmo com um campo do modelo perdido no meio. Na dúvida vale o rigor: sem o sinal inteiro, a falta do cartão de
// chamada continua sendo FALHA.
const CAMPOS_DO_PEDIDO = ['chamada', 'destaques', 'broll', 'palavraTela'];
function ehPedidoDeModelo(dec) {
  if (!dec || typeof dec !== 'object' || Array.isArray(dec)) return false;
  if ('blocos' in dec || 'headline' in dec) return false;
  const t = dec.trecho;
  const temTrecho = !!t && typeof t === 'object' && Number.isFinite(t.ini) && Number.isFinite(t.fim) && t.fim > t.ini;
  return temTrecho && CAMPOS_DO_PEDIDO.some((k) => k in dec);
}

// ---------- conferência ----------
function conferir(video, decPath, { maxS = marca.pega('video.duracao-maxima', 90), motion = null, vetados = [] } = {}) {
  const linhas = []; // {item, estado: OK|FALHA|AVISO, detalhe}
  const add = (item, estado, detalhe) => linhas.push({ item, estado, detalhe });
  const DEC = JSON.parse(fs.readFileSync(decPath, 'utf8'));
  const base = path.dirname(decPath);

  // técnico
  const s = sonda(video);
  add('Duração', s.dur <= maxS ? 'OK' : 'FALHA', `${s.dur.toFixed(2)} s (limite ${maxS} s)`);
  add('Áudio presente', s.audio ? 'OK' : 'FALHA', s.audio ? 'faixa de áudio encontrada' : 'MP4 sem áudio');
  if (s.audio) {
    const l = loudness(video);
    if (l.lufs === null) add('Loudness', 'FALHA', 'ebur128 não devolveu medida');
    else add('Loudness (alvo -14 LUFS +-2)', Math.abs(l.lufs + 14) <= 2 ? 'OK' : 'FALHA', `${l.lufs.toFixed(1)} LUFS`);
    if (l.pico === null) add('Pico', 'FALHA', 'ebur128 não devolveu pico');
    else add('Pico real (< -1 dBTP)', l.pico < -1 ? 'OK' : 'FALHA', `${l.pico.toFixed(1)} dBTP`);
  } else { add('Loudness', 'FALHA', 'sem áudio'); add('Pico', 'FALHA', 'sem áudio'); }

  // texto de tela
  const textos = []; const ignoradas = new Set();
  coletarTextos(DEC, '', textos, ignoradas);
  let fontes = ['decupagem'];
  try {
    const pal = JSON.parse(fs.readFileSync(path.resolve(base, DEC.palavras || 'palavras.json'), 'utf8'));
    const leg = pal.map((p) => p.w).join(' ');
    textos.push({ onde: 'legenda (palavras.json)', texto: leg }); fontes.push(`legenda (${pal.length} palavras)`);
  } catch { add('Legenda', 'AVISO', 'palavras.json não encontrado; legenda não varrida'); }
  let mot = motion;
  if (!mot && DEC.motion) {
    const cand = fs.readdirSync(base).filter((f) => /^motion-.*\.js$/.test(f));
    if (cand.length) mot = path.join(base, cand[0]);
  }
  if (mot && fs.existsSync(mot)) { stringsDoScript(mot).forEach((x) => textos.push(x)); fontes.push('motion ' + path.basename(mot)); }
  else if (DEC.motion) add('Texto do motion', 'AVISO', 'a decupagem tem bloco "motion" mas nenhum motion-*.js foi achado; textos desenhados pelo script não foram varridos (use --motion)');

  const tr = textos.filter((t) => /\u2014/.test(t.texto));
  add('Travessão (—)', tr.length ? 'FALHA' : 'OK', tr.length ? tr.map((t) => `${t.onde}: "${t.texto.slice(0, 60)}"`).join(' | ') : `0 em ${textos.length} textos (${fontes.join(', ')})`);
  const ten = textos.filter((t) => /\u2013|\s-\s/.test(t.texto) && !/\u2014/.test(t.texto));
  if (ten.length) add('Meia-risca ou hífen com espaços', 'AVISO', ten.map((t) => `${t.onde}: "${t.texto.slice(0, 50)}"`).join(' | ') + ' (pode ser intervalo numérico; conferir)');

  const prib = listaProibida(vetados); const achados = [];
  for (const t of textos) for (const p of prib) if (achaTermo(t.texto, p)) achados.push(`${t.onde}: "${p}"`);
  for (const t of textos) for (const p of CTA_PROIBIDO) if (achaTermo(t.texto, p)) achados.push(`${t.onde}: "${p}" (CTA que não funciona em vídeo)`);
  add('Vocabulário proibido', achados.length ? 'FALHA' : 'OK', achados.length ? achados.join(' | ') : `${prib.length} termos conferidos, nenhum encontrado`);

  const prom = [];
  for (const t of textos) if (!/legenda/.test(t.onde)) for (const re of PROMESSA) if (re.test(t.texto)) prom.push(`${t.onde}: "${t.texto.slice(0, 50)}"`);
  add('Promessa numérica ou de resultado', prom.length ? 'AVISO' : 'OK', prom.length ? prom.join(' | ') + ' (avaliar contra a regra setorial ativa, se houver)' : 'nenhum padrão encontrado (a fala da legenda não entra)');

  // CTAs. O vídeo feito com o modelo do estilo (o pedido do modelo no lugar da decupagem) não tem cartão final de chamada:
  // aí a contagem vira AVISO. Com a decupagem, continua exigindo exatamente 1.
  const blocos = DEC.blocos || [];
  const ctas = blocos.filter((b) => b.tipo === 'cta');
  const botoes = new Set(ctas.map((b) => (b.botao || '').trim().toLowerCase()).filter(Boolean));
  const detalheCta = `${ctas.length} bloco(s) cta, ${botoes.size} botão(ões) distinto(s)${ctas.length === 1 ? `: "${ctas[0].botao}"` : ''}`;
  if (ctas.length === 1 && botoes.size === 1) add('CTAs (exatamente 1)', 'OK', detalheCta);
  else if (ehPedidoDeModelo(DEC)) add('CTAs (exatamente 1)', 'AVISO', 'o vídeo feito com o modelo do estilo não tem cartão final de chamada; se quiser uma chamada, ela vai na legenda do post');
  else add('CTAs (exatamente 1)', 'FALHA', detalheCta);
  if (ctas.length === 1 && s.dur) {
    const fim = ctas[0].fim; const folga = s.dur - fim;
    add('Cartão final no fim do vídeo', folga <= 2 ? 'OK' : 'AVISO', `cartão termina em ${fim.toFixed(2)} s; vídeo em ${s.dur.toFixed(2)} s`);
  }

  // logo e @ só no cartão final
  const ehLogo = (v) => typeof v === 'string' && /(^|[-_/])(logo)([-_.]|$)/i.test(v) && !/tile-/.test(v);
  const fora = [];
  blocos.forEach((b, i) => { if (b.tipo !== 'cta') for (const k of ['img', 'tile', 'logo']) if (ehLogo(b[k])) fora.push(`blocos[${i}] (${b.tipo}, ${b.ini}-${b.fim} s) usa "${b[k]}"`); });
  const arroba = textos.filter((t) => HANDLE && t.texto.toLowerCase().includes(HANDLE.toLowerCase()) && !/cta|frase|botao/.test(t.onde));
  arroba.forEach((t) => fora.push(`${t.onde}: "${t.texto.slice(0, 40)}" (@ fora do cartão)`));
  add('Logo e endereço da conta só no cartão final', fora.length ? 'FALHA' : 'OK', fora.length ? fora.join(' | ') : 'nenhuma camada de logo fora do bloco cta');

  // faixa do perfil
  const hs = (DEC.headline || []).filter((h) => typeof h.y === 'number' && h.y < 250);
  add('Headline abaixo da faixa do perfil (y >= 250)', hs.length ? 'FALHA' : 'OK', hs.length ? hs.map((h) => `${h.ini}-${h.fim} s em y=${h.y}`).join(' | ') : `${(DEC.headline || []).length} headline(s) conferida(s)`);
  const longas = (DEC.headline || []).filter((h) => h.fim - h.ini > 5.05);
  if (longas.length) add('Headline temporária (3 a 5 s)', 'AVISO', longas.map((h) => `${h.ini}-${h.fim} s`).join(' | '));

  return { linhas, ignoradas: [...ignoradas].sort(), dur: s.dur, fontes };
}

function relatorio(video, decPath, r) {
  const falhas = r.linhas.filter((x) => x.estado === 'FALHA').length;
  const avisos = r.linhas.filter((x) => x.estado === 'AVISO').length;
  const o = [];
  o.push(`# Conferência por script`);
  o.push('');
  o.push(`**Vídeo:** ${video}`);
  o.push(`**Decupagem:** ${decPath}`);
  o.push(`**Resultado:** ${falhas ? `REPROVADO, ${falhas} FALHA(s)` : 'sem FALHA'}${avisos ? `, ${avisos} aviso(s)` : ''}`);
  o.push('');
  o.push('| Item | Resultado | Detalhe |');
  o.push('|---|---|---|');
  r.linhas.forEach((x) => o.push(`| ${x.item} | ${x.estado} | ${x.detalhe.replace(/\|/g, '/')} |`));
  o.push('');
  o.push('**Não coberto pelo script (olhar quadro):** rosto coberto ou encostado, legibilidade e tamanho do texto, encaixe de mockup no queixo, ritmo (trecho sem evento), sincronia da legenda, qualidade do recorte, texto dentro dos PNG de mockup e de logo de terceiros (só os nomes de arquivo são conferidos).');
  o.push(`**Chaves da decupagem não varridas como texto:** ${r.ignoradas.join(', ') || 'nenhuma'}`);
  return { texto: o.join('\n') + '\n', falhas };
}

// ---------- calibração (G-13) ----------
function autoteste() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conferir-reels-'));
  const ff = (a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], { maxBuffer: 1 << 28 });
  const gera = (nome, dur, vol, clip) => {
    ff(['-f', 'lavfi', '-i', `color=c=black:s=270x480:r=10:d=${dur}`, '-f', 'lavfi', '-i', `sine=f=220:d=${dur}:sample_rate=48000`,
      '-af', `volume=${vol}${clip ? ',alimiter=limit=1:level=false' : ''}`, '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', path.join(tmp, nome)]);
  };
  // caso que deve passar: 20 s, ~-14 LUFS, texto limpo, 1 CTA, logo só no cartão
  gera('bom.mp4', 20, 2.5, false);
  fs.writeFileSync(path.join(tmp, 'palavras-bom.json'), JSON.stringify([{ w: 'Olá,', ini: 100, fim: 500 }, { w: 'teste', ini: 600, fim: 900 }]));
  fs.writeFileSync(path.join(tmp, 'bom.json'), JSON.stringify({
    palavras: 'palavras-bom.json', palavrasChave: { 0: 'teste' }, headline: [{ ini: 0.5, fim: 4.5, palavra: 'TESTE DE 2 MINUTOS', y: 250 }],
    blocos: [{ tipo: 'tile', img: 'tile-google', ini: 2, fim: 6, lado: 'esq' }, { tipo: 'cta', ini: 16, fim: 19.8, frase: 'um diagnóstico completo para o seu negócio', botao: 'Fale conosco no direct' }] }));
  // caso feito para falhar: 95 s, som estourado, travessão, termo proibido, "link da bio", 2 CTAs, logo em mockup, headline em y=85
  gera('ruim.mp4', 95, 8, true);
  fs.writeFileSync(path.join(tmp, 'palavras-ruim.json'), JSON.stringify([{ w: 'Olá,', ini: 100, fim: 500 }]));
  fs.writeFileSync(path.join(tmp, 'ruim.json'), JSON.stringify({
    palavras: 'palavras-ruim.json', palavrasChave: { 0: 'segredo' },
    headline: [{ ini: 0.5, fim: 4.5, palavra: 'O SEGREDO — DO NEGÓCIO', y: 85 }],
    blocos: [{ tipo: 'mockup', img: 'logo-marca', ini: 5, fim: 8, centroY: 1300 },
      { tipo: 'cartao', kicker: 'sem fórmula mágica', palavra: 'foguete', ini: 10, fim: 12 },
      { tipo: 'cta', ini: 80, fim: 85, frase: 'resultados garantidos', botao: 'Clique no link da bio' },
      { tipo: 'cta', ini: 88, fim: 94, frase: 'segunda chamada', botao: 'Fale conosco no direct' }] }));
  // caso 3: o pedido de um modelo de edição no lugar da decupagem (o vídeo feito com o modelo do estilo), sem cartão de
  // chamada; caso 4: a decupagem limpa do caso 1, só que sem o bloco cta
  fs.writeFileSync(path.join(tmp, 'pedido-modelo.json'), JSON.stringify({
    titulo: 'Teste do modelo', video: 'bom.mp4', palavras: 'palavras-bom.json', trecho: { ini: 0, fim: 20 },
    chamada: { texto: 'Um teste rápido', palavra: 'teste', ini: 0.2, fim: 3.0 }, destaques: ['teste'],
    broll: [{ img: 'tile-google.png', ini: 5, fim: 9.8 }], palavraTela: { texto: 'TESTE', ini: 18, fim: 20 }, usarMarca: true }));
  const semCta = JSON.parse(fs.readFileSync(path.join(tmp, 'bom.json'), 'utf8'));
  semCta.blocos = semCta.blocos.filter((b) => b.tipo !== 'cta');
  fs.writeFileSync(path.join(tmp, 'sem-cta.json'), JSON.stringify(semCta));
  // casos 5 e 6: o que NÃO é pedido de modelo. 5 = decupagem que perdeu todos os blocos e ficou com um campo "broll" perdido
  // (continua decupagem: tem headline); 6 = um arquivo sem blocos nem headline, com um campo do modelo mas sem o trecho
  // (o montador dos modelos não leria): nenhum dos dois ganha o aviso, os dois seguem reprovando a falta do cartão.
  const semBlocos = JSON.parse(fs.readFileSync(path.join(tmp, 'bom.json'), 'utf8'));
  delete semBlocos.blocos;
  semBlocos.broll = [{ img: 'tile-google.png', ini: 5, fim: 9.8 }];
  fs.writeFileSync(path.join(tmp, 'sem-blocos.json'), JSON.stringify(semBlocos));
  fs.writeFileSync(path.join(tmp, 'sem-trecho.json'), JSON.stringify({ video: 'bom.mp4', palavras: 'palavras-bom.json', chamada: { texto: 'Um teste', palavra: 'teste', ini: 0.2, fim: 3.0 } }));
  const bom = conferir(path.join(tmp, 'bom.mp4'), path.join(tmp, 'bom.json'));
  const ruim = conferir(path.join(tmp, 'ruim.mp4'), path.join(tmp, 'ruim.json'), { vetados: ['segredo', 'foguete'] });
  const modelo = conferir(path.join(tmp, 'bom.mp4'), path.join(tmp, 'pedido-modelo.json'));
  const decSemCta = conferir(path.join(tmp, 'bom.mp4'), path.join(tmp, 'sem-cta.json'));
  const decSemBlocos = conferir(path.join(tmp, 'bom.mp4'), path.join(tmp, 'sem-blocos.json'));
  const semTrecho = conferir(path.join(tmp, 'bom.mp4'), path.join(tmp, 'sem-trecho.json'));
  const out = [];
  out.push('# Calibração do conferir-reels.js (princípio G-13)');
  out.push('');
  out.push('Caso 1, deve passar: MP4 sintético de 20 s a ~-14 LUFS, texto limpo, 1 CTA, logo só no cartão.');
  out.push('Caso 2, feito para falhar: 95 s, som estourado, travessão, "segredo", "fórmula mágica", "foguete", "resultados garantidos", "link da bio", 2 CTAs, logo em mockup, headline em y=85.');
  out.push('Caso 3: o vídeo do caso 1 com o pedido de um modelo de edição no lugar da decupagem (sem cartão de chamada). Caso 4: a decupagem do caso 1 sem o bloco cta.');
  out.push('Caso 5: a decupagem do caso 1 sem os blocos e com um campo "broll" perdido. Caso 6: um arquivo com o campo "chamada" do modelo, mas sem o trecho.');
  out.push('');
  out.push('| Item | Esperado no caso 2 | Obtido no caso 2 | Caso 1 (esperado OK) |');
  out.push('|---|---|---|---|');
  const esperadoFalha = ['Duração', 'Loudness (alvo -14 LUFS +-2)', 'Pico real (< -1 dBTP)', 'Travessão (—)', 'Vocabulário proibido', 'CTAs (exatamente 1)', 'Logo e endereço da conta só no cartão final', 'Headline abaixo da faixa do perfil (y >= 250)'];
  let ok = true;
  for (const item of esperadoFalha) {
    const a = ruim.linhas.find((x) => x.item === item); const b = bom.linhas.find((x) => x.item === item);
    const aOk = a && a.estado === 'FALHA'; const bOk = b && b.estado === 'OK';
    if (!aOk || !bOk) ok = false;
    out.push(`| ${item} | FALHA | ${a ? a.estado : 'ausente'} ${aOk ? '' : '(ERRO)'} | ${b ? b.estado : 'ausente'} ${bOk ? '' : '(ERRO)'} |`);
  }
  const bomFalhas = bom.linhas.filter((x) => x.estado === 'FALHA');
  if (bomFalhas.length) { ok = false; out.push(''); out.push('Falsos positivos no caso 1: ' + bomFalhas.map((x) => x.item).join(', ')); }
  // o cartão de chamada: AVISO só no pedido de modelo; a decupagem segue exigindo exatamente 1
  const ctaDe = (r) => r.linhas.find((x) => x.item === 'CTAs (exatamente 1)');
  const casosCta = [
    ['Caso 3, pedido de modelo sem cartão de chamada', ctaDe(modelo), 'AVISO'],
    ['Caso 4, decupagem sem cartão de chamada', ctaDe(decSemCta), 'FALHA'],
    ['Caso 2, decupagem com 2 cartões de chamada', ctaDe(ruim), 'FALHA'],
    ['Caso 5, decupagem sem blocos e com um campo "broll" perdido', ctaDe(decSemBlocos), 'FALHA'],
    ['Caso 6, arquivo com campo do modelo mas sem o trecho', ctaDe(semTrecho), 'FALHA'],
  ];
  out.push('');
  out.push('| Cartão de chamada | Esperado | Obtido |');
  out.push('|---|---|---|');
  for (const [nome, linha, esperado] of casosCta) {
    const certo = linha && linha.estado === esperado;
    if (!certo) ok = false;
    out.push(`| ${nome} | ${esperado} | ${linha ? linha.estado : 'ausente'} ${certo ? '' : '(ERRO)'} |`);
  }
  const avisoModelo = ctaDe(modelo);
  if (!avisoModelo || !/legenda do post/.test(avisoModelo.detalhe)) { ok = false; out.push('O aviso do caso 3 não diz que a chamada vai na legenda do post: ' + (avisoModelo ? avisoModelo.detalhe : 'n/d')); }
  const modeloFalhas = modelo.linhas.filter((x) => x.estado === 'FALHA');
  if (modeloFalhas.length) { ok = false; out.push('O caso 3 (mesmo vídeo limpo do caso 1) saiu REPROVADO por: ' + modeloFalhas.map((x) => x.item).join(', ')); }
  const vocab = ruim.linhas.find((x) => x.item === 'Vocabulário proibido');
  out.push('');
  out.push('Detalhe do vocabulário no caso 2: ' + (vocab ? vocab.detalhe : 'n/d'));
  out.push('');
  out.push(`**Resultado da calibração:** ${ok ? 'o script reprovou o caso feito para falhar em todos os itens esperados e não reprovou o caso limpo' : 'CALIBRAÇÃO FALHOU, o script não vale até corrigir'}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out.join('\n'));
  return ok ? 0 : 1;
}

// ---------- main ----------
if (args.includes('--autoteste')) process.exit(autoteste());
const [video, decupagem] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!video || !decupagem) { console.error('uso: node conferir-reels.js <video.mp4> <decupagem.json> [--saida arq.md] [--motion arq.js] [--max-s 90]\n     node conferir-reels.js --autoteste'); process.exit(2); }
const r = conferir(path.resolve(video), path.resolve(decupagem), { maxS: Number(opc('max-s', 90)), motion: opc('motion') ? path.resolve(opc('motion')) : null });
const rel = relatorio(video, decupagem, r);
if (opc('saida')) fs.writeFileSync(path.resolve(opc('saida')), rel.texto);
console.log(rel.texto);
process.exit(rel.falhas ? 1 : 0);
