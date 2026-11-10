// Pré-edição do vídeo bruto (o que antes se fazia num editor manual): corta as pausas, corrige a cor, põe uma transição
// nas viradas de assunto e acelera a fala para 1.13 sem mudar o tom da voz.
// Uso: node pre-edicao.js "bruto.MOV" "saida.mp4" --viradas 9.0,35.4,50.0 [--transicao seco] [--cauda 1.2] [--velocidade 1.13] [--ate 13]
//   --viradas: segundos (no bruto) que caem dentro das pausas das viradas de assunto; nas outras pausas o corte é sempre seco.
//   --transicao: o que acontece nas viradas (veja TRANSICOES). --brilho é o nome antigo de --viradas.
//   --ate: processa só o bruto até esse segundo (para amostras).
const fs = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const marca = require('../../marca/marca'); // cor de acento do painel e padrões de velocidade e cor

const args = process.argv.slice(2);
const opc = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const [BRUTO, SAIDA] = args;
const VEL = Number(opc('velocidade', marca.pega('video.pre-edicao.velocidade', 1.13)));
const CAUDA = Number(opc('cauda', '1.2'));
const ATE = opc('ate', null) ? Number(opc('ate')) : null;
const VIRADAS = (opc('viradas', opc('brilho', '')) || '').split(',').filter(Boolean).map(Number);
const COR = opc('cor', marca.pega('video.pre-edicao.cor', 'eq=gamma=0.90:saturation=1.08')); // calibre pela luz da gravação (signalstats)
const ANTES = 0.10, DEPOIS = 0.12; // respiro mantido antes e depois da fala em cada corte

// cada transição: sobreposição entre os planos (fusão, em segundos do bruto) e o tipo de fusão do xfade, se houver
const TRANSICOES = {
  seco: { d: 0 },                       // corte seco
  zoom: { d: 0 },                       // corte seco + enquadramento alternado por seção (100% / 115%)
  flash: { d: 0 },                      // clarão branco curto no corte
  painel: { d: 0 },                     // painel na cor de acento sobe e cobre o corte (gesto de "deslizar para cima")
  glitch: { d: 0 },                     // separação RGB + ruído por 4 quadros
  impulso: { d: 0 },                    // zoom rápido com desfoque: a imagem avança, corta e o plano seguinte assenta
  desfoque: { d: 0.26, xfade: 'fade' }, // fusão com desfoque crescente no meio
  preto: { d: 0.4, xfade: 'fadeblack' },// mergulho rápido no preto
  brilho: { d: 0.2, xfade: 'fade' },    // clarão quente (clarão quente por baixo da fusão)
};
const TIPO = opc('transicao', 'brilho');
const TR = TRANSICOES[TIPO];
if (!TR) throw new Error('transição desconhecida: ' + TIPO + ' (opções: ' + Object.keys(TRANSICOES).join(', ') + ')');
const D = TR.d;

// 1. pausas reais (silêncio de pelo menos 0,25s)
const lim = ATE ? ['-t', String(ATE)] : [];
const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...lim, '-i', BRUTO, '-vn', '-af', 'highpass=f=80,silencedetect=n=-35dB:d=0.25', '-f', 'null', '-'], { encoding: 'utf8' });
const durTotal = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', BRUTO], { encoding: 'utf8' }));
const dur = ATE ? Math.min(ATE, durTotal) : durTotal;
const sil = []; let ini = null;
for (const l of r.stderr.split('\n')) {
  const a = l.match(/silence_start: ([\d.]+)/); if (a) ini = Number(a[1]);
  const z = l.match(/silence_end: ([\d.]+)/); if (z && ini !== null) { sil.push([ini, Number(z[1])]); ini = null; }
}
if (ini !== null) sil.push([ini, dur]);

// 2. trechos de fala com respiro; marca as pausas que são viradas de assunto
const seg = []; let cur = 0; const virada = [];
sil.forEach(([a, z]) => {
  if (z >= dur - 0.01) { seg.push([cur, Math.min(dur, a + CAUDA)]); cur = null; return; }
  const v = VIRADAS.some((t) => t >= a - 0.05 && t <= z + 0.05);
  const extra = v ? D / 2 : 0;
  seg.push([cur, a + DEPOIS + extra]);
  virada.push(v);
  cur = z - ANTES - extra;
});
if (cur !== null) seg.push([cur, dur]);

// seção de cada trecho (sobe a cada virada) — usada pelo "zoom" para alternar o enquadramento
const secao = [0]; for (let i = 1; i < seg.length; i++) secao.push(secao[i - 1] + (virada[i - 1] ? 1 : 0));

// 3. filtro: cada trecho é cortado do bruto; junta com corte seco ou com fusão
const f = [];
f.push(`[0:v]fps=30,${COR},setsar=1,format=yuv420p,split=${seg.length}${seg.map((_, i) => `[v${i}]`).join('')}`);
// o iPhone grava o áudio começando alguns décimos depois do vídeo (start_time); first_pts=0 preenche esse início com silêncio
// para os cortes de áudio e vídeo usarem a mesma linha do tempo
f.push(`[0:a]aresample=48000:async=1:first_pts=0,asplit=${seg.length}${seg.map((_, i) => `[a${i}]`).join('')}`);
seg.forEach(([a, z], i) => {
  // zoom: seções ímpares a 115%, recortadas um pouco acima do centro para manter o rosto no terço de cima
  const enq = TIPO === 'zoom' && secao[i] % 2 === 1 ? ',scale=1242:2208,crop=1080:1920:81:(ih-1920)*0.35,setsar=1' : '';
  f.push(`[v${i}]trim=${a.toFixed(3)}:${z.toFixed(3)},setpts=PTS-STARTPTS${enq},settb=1/30[sv${i}]`);
  f.push(`[a${i}]atrim=${a.toFixed(3)}:${z.toFixed(3)},asetpts=PTS-STARTPTS[sa${i}]`);
});
let vAtual = 'sv0', aAtual = 'sa0', durAtual = seg[0][1] - seg[0][0]; const pontos = [];
for (let i = 1; i < seg.length; i++) {
  const d = seg[i][1] - seg[i][0];
  if (virada[i - 1] && D > 0) {
    const off = durAtual - D;
    f.push(`[${vAtual}][sv${i}]xfade=transition=${TR.xfade}:duration=${D}:offset=${off.toFixed(3)}[xv${i}]`);
    f.push(`[${aAtual}][sa${i}]acrossfade=d=${D}[xa${i}]`);
    pontos.push(off + D / 2); durAtual = durAtual + d - D;
  } else {
    if (virada[i - 1]) pontos.push(durAtual);
    f.push(`[${vAtual}][${aAtual}][sv${i}][sa${i}]concat=n=2:v=1:a=1[cv${i}][xa${i}]`);
    f.push(`[cv${i}]settb=1/30[xv${i}]`);
    durAtual += d;
  }
  vAtual = `xv${i}`; aAtual = `xa${i}`;
}

// 4. velocidade e o efeito de cada transição, já no tempo final (pontos = meio de cada virada)
const c2 = pontos.map((c) => c / VEL);
const janela = (antes, depois) => c2.map((c) => `between(t,${(c - antes).toFixed(3)},${(c + depois).toFixed(3)})`).join('+') || '0';
const soma = (larg, exp, pico) => (c2.length ? c2.map((c) => `${pico}*pow(max(0,1-abs(T-${c.toFixed(3)})/${larg}),${exp})`).join('+') : '0');
f.push(`[${vAtual}]setpts=PTS/${VEL},fps=30[rapido]`);
if (TIPO === 'brilho') {
  // a imagem esquenta para tom quente (~0,36s), explode em amarelo-claro no meio (~0,2s) e a fusão acontece por baixo do pico
  f.push(`[rapido]format=gbrp[rg]`);
  f.push(`color=c=black:s=1080x1920:r=30:d=0.04,format=gbrp[tinta]`);
  f.push(`color=c=black:s=1080x1920:r=30:d=0.04,format=gbrp,geq=r='255':g='222+30*(1-Y/H)':b='150+80*(1-Y/H)'[luz]`);
  // tinta: ganho por canal (gbrp = c0 verde, c1 azul, c2 vermelho), mantém o contraste e satura em tom quente
  const et = soma(0.2, 0.8, 1.0);
  f.push(`[rg][tinta]blend=c0_expr='A*(1-0.32*(${et}))':c1_expr='A*(1-0.6*(${et}))':c2_expr='min(255,A*(1+0.22*(${et})))':enable='${janela(0.2, 0.2)}'[quente]`);
  f.push(`[quente][luz]blend=all_expr='A+(${soma(0.11, 1.2, 1.0)})*(255-A)*B/255':enable='${janela(0.2, 0.2)}',format=yuv420p[vout]`);
} else if (TIPO === 'flash') {
  // sobe em 2 quadros, desce em 5: clarão seco, sem cor
  const e = c2.length ? c2.map((c) => `if(lt(T,${c.toFixed(3)}),max(0,1-(${c.toFixed(3)}-T)/0.07),max(0,1-(T-${c.toFixed(3)})/0.18))`).join('+') : '0';
  f.push(`[rapido]format=gbrp[rg]`);
  f.push(`color=c=white:s=1080x1920:r=30:d=0.04,format=gbrp[branco]`);
  f.push(`[rg][branco]blend=all_expr='A+0.92*(${e})*(B-A)':enable='${janela(0.08, 0.2)}',format=yuv420p[vout]`);
} else if (TIPO === 'painel') {
  // painel na cor de acento, mais alto que a tela, sobe de baixo para cima em 0,4s; cobre a tela inteira por ~2 quadros no corte
  const H = 2600, viagem = 1920 + H, durW = 0.4;
  // topo do painel vai de y=1920 (abaixo da tela) a y=-H (acima); fora da janela o overlay está desligado
  const y = c2.length ? c2.map((c) => { const t0 = (c - durW / 2).toFixed(3); return `between(t,${t0},${(c + durW / 2).toFixed(3)})*(1920-(t-${t0})/${durW}*${viagem})`; }).join('+') : '9999';
  f.push(`color=c=0x${marca.hex('acento').slice(1)}:s=1080x${H}:r=30[painel]`);
  f.push(`[rapido][painel]overlay=x=0:y='${y}':enable='${janela(durW / 2, durW / 2)}':shortest=1,format=yuv420p[vout]`);
} else if (TIPO === 'glitch') {
  f.push(`[rapido]rgbashift=rh=-26:bh=26:gv=6:enable='${janela(0.05, 0.09)}',noise=alls=28:allf=t:enable='${janela(0.05, 0.09)}',format=yuv420p[vout]`);
} else if (TIPO === 'impulso') {
  // escala sobe até 135% em ~0,16s antes do corte e volta em ~0,16s depois, com desfoque no pico
  const z = c2.length ? c2.map((c) => `0.35*pow(max(0\,1-abs(t-${c.toFixed(3)})/0.17)\,1.6)`).join('+') : '0';
  f.push(`[rapido]scale=w='trunc(1080*(1+${z})/2)*2':h='trunc(1920*(1+${z})/2)*2':eval=frame,crop=1080:1920:(iw-1080)/2:(ih-1920)*0.4,setsar=1,gblur=sigma=6:enable='${janela(0.07, 0.07)}',format=yuv420p[vout]`);
} else if (TIPO === 'desfoque') {
  // desfoque em degraus (leve, médio, forte no meio) por cima da fusão
  f.push(`[rapido]gblur=sigma=4:enable='${janela(0.13, 0.13)}',gblur=sigma=9:enable='${janela(0.08, 0.08)}',gblur=sigma=16:enable='${janela(0.04, 0.04)}',format=yuv420p[vout]`);
} else {
  f.push(`[rapido]format=yuv420p[vout]`);
}
f.push(`[${aAtual}]atempo=${VEL}[aout]`);

const tmp = SAIDA + '.filtro.txt';
fs.writeFileSync(tmp, f.join(';\n'));
execFileSync('ffmpeg', ['-v', 'error', '-y', ...lim, '-i', BRUTO, '-filter_complex_script', tmp, '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', SAIDA], { stdio: 'inherit' });
fs.rmSync(tmp);
// tempo exato de cada virada no vídeo final: o quadro de maior mudança perto do ponto previsto (o arredondamento
// dos trechos em quadros desloca o corte em até 1 quadro). Devolve meio quadro antes do corte, que é o valor para usar
// em "enquadramento" na decupagem.
const rc = spawnSync('ffmpeg', ['-v', 'error', '-i', SAIDA, '-vf', "scale=108:192,select='gte(scene,0)',metadata=print:file=-", '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const cenas = [...(rc.stdout + rc.stderr).matchAll(/pts_time:([\d.]+)[\s\S]*?scene_score=([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const exatas = c2.map((c) => {
  const melhor = cenas.filter(([t]) => Math.abs(t - c) <= 0.15).sort((p, q) => q[1] - p[1])[0];
  return melhor ? Number((Math.round(melhor[0] * 30) / 30 - 1 / 60).toFixed(3)) : Number(c.toFixed(3));
});
const durSaida = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SAIDA], { encoding: 'utf8' }));
console.log(JSON.stringify({ transicao: TIPO, bruto: Number(dur.toFixed(2)), trechos: seg.length, cortesSecos: virada.filter((x) => !x).length, viradas: exatas, saida: Number(durSaida.toFixed(2)) }));
