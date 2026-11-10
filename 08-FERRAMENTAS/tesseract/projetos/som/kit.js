// Kit sonoro da Fábrica: efeitos sintetizados (sem licença de terceiros) e utilidades de mixagem.
// Todos os sons saem mono, em Float32Array a 48 kHz, normalizados para pico de -1 dBFS (o volume final é dado na mixagem).
const SR = 48000;

const buf = (seg) => new Float32Array(Math.ceil(seg * SR));
const dbToG = (db) => Math.pow(10, db / 20);
let semente = 7;
const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
const ruido = () => rnd() * 2 - 1;

// filtro biquad (RBJ); os coeficientes podem mudar por amostra
function biquad() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, c = null;
  return {
    set(tipo, f, q) {
      const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
      let b0, b1, b2;
      if (tipo === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
      if (tipo === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
      if (tipo === 'bp') { b0 = al; b1 = 0; b2 = -al; }
      const a0 = 1 + al;
      c = [b0 / a0, b1 / a0, b2 / a0, (-2 * cs) / a0, (1 - al) / a0];
      return this;
    },
    run(x) {
      const y = c[0] * x + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y; return y;
    },
  };
}
const normaliza = (a, picoDb = -1) => { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); const g = dbToG(picoDb) / (m || 1); return a.map((v) => v * g); };
// soma um som mono num destino mono ou estéreo ([L, R]) a partir do segundo t
const poe = (alvo, som, t, ganhoDb = 0) => {
  const canais = Array.isArray(alvo) ? alvo : [alvo]; const i0 = Math.round(t * SR), g = dbToG(ganhoDb);
  for (const c of canais) for (let i = 0; i < som.length && i0 + i < c.length; i++) if (i0 + i >= 0) c[i0 + i] += som[i] * g;
};
// envelope de ganho por pontos [segundo, dB], em linha reta entre os pontos
const envelope = (n, pts) => {
  const e = new Float32Array(n); let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; while (k < pts.length - 2 && t > pts[k + 1][0]) k++;
    const [t0, d0] = pts[k], [t1, d1] = pts[Math.min(k + 1, pts.length - 1)];
    const p = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 1; e[i] = dbToG(d0 + (d1 - d0) * p);
  }
  return e;
};
// ducking: ganho que abaixa a trilha enquanto a voz fala (detector de envelope com ataque rápido e soltura lenta)
const ganhoDucking = (voz, reducaoDb, limiar = 0.05) => {
  let env = 0; const at = Math.exp(-1 / (0.02 * SR)), sol = Math.exp(-1 / (0.45 * SR)); const g = new Float32Array(voz.length);
  for (let i = 0; i < voz.length; i++) {
    const v = Math.abs(voz[i]); env = v > env ? at * env + (1 - at) * v : sol * env + (1 - sol) * v;
    g[i] = dbToG(-reducaoDb * Math.min(1, env / limiar));
  }
  return g;
};

// ---------- efeitos ----------
// pop: seno que cai de 900 para 420 Hz (logos surgindo)
const pop = () => { const a = buf(0.2); for (let i = 0; i < a.length; i++) { const t = i / SR; const fase = 2 * Math.PI * (420 * t + (480 / 40) * (1 - Math.exp(-40 * t))); a[i] = Math.sin(fase) * Math.exp(-t * 28) * Math.min(1, t * 2000); } return normaliza(a); };
// clique seco (botão)
const tick = () => { const a = buf(0.06); const f = biquad().set('hp', 1500, 0.7); for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = (0.6 * Math.sin(2 * Math.PI * 2300 * t) + 0.4 * f.run(ruido())) * Math.exp(-t * 150); } return normaliza(a); };
// tecla de teclado; cada chamada sai um pouco diferente, a barra de espaço é mais grave
const tecla = (espaco = false) => {
  const a = buf(0.08); const f = biquad().set('bp', 2200 + rnd() * 1600, 1.4); const g = biquad().set('lp', 260, 0.8);
  for (let i = 0; i < a.length; i++) { const t = i / SR; const n = ruido(); a[i] = f.run(n) * Math.exp(-t * (espaco ? 120 : 190)) * 1.4 + g.run(n) * Math.exp(-t * 70) * (espaco ? 1.6 : 0.8); }
  return normaliza(a, espaco ? -1 : -3 - rnd() * 3);
};
// whoosh: ruído com banda que sobe e desce (interfaces entrando)
const whoosh = (dur = 0.5, f0 = 300, f1 = 2600) => {
  const a = buf(dur); const f = biquad(), f2 = biquad();
  for (let i = 0; i < a.length; i++) {
    const p = i / a.length; const fc = f0 + (f1 - f0) * Math.sin(Math.PI * Math.min(1, p * 1.3));
    if (i % 32 === 0) { f.set('bp', fc, 0.9); f2.set('bp', fc * 1.5, 0.9); }
    const n = ruido(); a[i] = (f.run(n) + 0.5 * f2.run(n)) * Math.pow(Math.sin(Math.PI * p), 1.6);
  }
  return normaliza(a);
};
// impacto grave curto (abertura e cartões de tela cheia)
const impacto = () => { const a = buf(1.4); const f = biquad().set('lp', 220, 0.7); for (let i = 0; i < a.length; i++) { const t = i / SR; const fase = 2 * Math.PI * (44 * t + (30 / 6) * (1 - Math.exp(-6 * t))); a[i] = (Math.tanh(1.6 * Math.sin(fase) * Math.exp(-t * 3.2)) * 0.9 + f.run(ruido()) * Math.exp(-t * 22) * 2.2) * Math.min(1, t * 800); } return normaliza(a); };
// swell: "prato ao contrário" que cresce e corta (headline subindo)
const swell = (d = 0.7) => { const a = buf(d); const f = biquad(); for (let i = 0; i < a.length; i++) { const p = i / a.length; if (i % 32 === 0) f.set('bp', 1200 + 5000 * p, 0.8); a[i] = f.run(ruido()) * Math.pow(p, 3) * (p > 0.97 ? (1 - p) / 0.03 : 1); } return normaliza(a); };
// piano elétrico (base da assinatura)
const rhodes = (f, dur, vel = 1) => { const a = buf(dur); for (let i = 0; i < a.length; i++) { const t = i / SR; const env = Math.min(1, t * 120) * Math.exp(-t * 1.6); const trem = 1 + 0.12 * Math.sin(2 * Math.PI * 4.6 * t); a[i] = vel * env * trem * (Math.sin(2 * Math.PI * f * t) + 0.28 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t * 6) + 0.08 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t * 9)); } return a; };
// assinatura sonora: três notas subindo (Dó, Mi, Si), com eco curto; opcional por vídeo (som.assinatura)
const assinatura = () => { const a = buf(2.4); [[523.25, 0], [659.25, 0.15], [987.77, 0.3]].forEach(([f, t], k) => { poe(a, rhodes(f, 1.9, k === 2 ? 1 : 0.8), t); poe(a, rhodes(f, 1.6, 0.25), t + 0.24); }); return normaliza(a); };
// drone grave (fundo do alerta)
const drone = (dur) => { const a = buf(dur); const f = biquad().set('lp', 140, 0.7); for (let i = 0; i < a.length; i++) { const t = i / SR; const env = Math.min(1, t / 0.35, (dur - t) / 0.35); a[i] = env * (0.7 * Math.sin(2 * Math.PI * 49 * t) + 0.3 * Math.sin(2 * Math.PI * 98.4 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.8 * t)) + 1.5 * f.run(ruido())); } return normaliza(a); };

// digitação em ritmo humano (~9 teclas/s), independente da velocidade do texto na tela.
// Recebe os quadros [segundo, texto] da barra e devolve os instantes das teclas: o som começa um pouco antes do 1º quadro,
// segue até o último e faz uma pausa curta quando a busca é apagada e trocada por outra.
const ritmoDigitacao = (quadros) => {
  const teclas = []; const ini = quadros[0][0] - 0.3, fim = quadros[quadros.length - 1][0] + 0.15;
  const pausas = []; let ant = '';
  for (const [t, txt] of quadros) { if (ant && !txt.startsWith(ant)) pausas.push(t); ant = txt; }
  const texto = quadros.map((q) => q[1]).join(' '); let c = 0, t = ini;
  while (t < fim) {
    const pausa = pausas.find((p) => t >= p - 0.32 && t < p - 0.08);
    if (pausa) { t = pausa - 0.06; continue; }
    const ch = texto[c++ % texto.length]; teclas.push({ t, espaco: ch === ' ' });
    t += 0.085 + rnd() * 0.05 + (ch === ' ' ? 0.04 : 0);
  }
  return teclas;
};

module.exports = { SR, buf, dbToG, rnd, biquad, normaliza, poe, envelope, ganhoDucking, pop, tick, tecla, whoosh, impacto, swell, rhodes, assinatura, drone, ritmoDigitacao };
