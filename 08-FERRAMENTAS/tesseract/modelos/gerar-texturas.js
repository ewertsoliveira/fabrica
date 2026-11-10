// Gera as texturas dos modelos (papel rasgado, fita, jornal, pincel, caderno) como PNG transparente, desenhadas em SVG.
// Sem fotos nem arte de terceiros. Uso: node gerar-texturas.js  (saída em texturas/)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SAIDA = path.join(__dirname, 'texturas');
fs.mkdirSync(SAIDA, { recursive: true });

// borda rasgada: polígono com serrilhado irregular e determinístico
let semente = 7;
const rnd = () => { semente = (semente * 9301 + 49297) % 233280; return semente / 233280; };
const rasgo = (x0, x1, y, amp, passo) => {
  const pts = [];
  for (let x = x0; x <= x1; x += passo * (0.5 + rnd())) pts.push([x, y + (rnd() - 0.5) * amp + (rnd() < 0.15 ? amp * 0.8 : 0)]);
  pts.push([x1, y]);
  return pts;
};
const poli = (pts) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const fibra = (id, freq, op) => `<filter id="${id}" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="4" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${op} 0" result="g"/>
  <feComposite in="g" in2="SourceGraphic" operator="in" result="gg"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gg"/></feMerge></filter>`;

const PECAS = {
  // faixa de papel azul no topo, com a borda de baixo rasgada e uma "aba" branca do verso aparecendo
  'papel-azul': [1080, 560, () => {
    const baixo = rasgo(0, 1080, 470, 34, 18);
    const verso = baixo.map(([x, y]) => [x, y + 10 + rnd() * 14]);
    return `<defs>${fibra('f', 0.9, 0.18)}</defs>
      <polygon points="0,0 1080,0 ${poli([...verso].reverse())}" fill="#EDEBE4"/>
      <polygon points="0,0 1080,0 ${poli([...baixo].reverse())}" fill="#2F64D6" filter="url(#f)"/>`;
  }],
  // fita escura e fita clara com pontas serrilhadas (o texto entra nativo por cima)
  'fita-escura': [760, 120, () => fita('#1C1C1C', 0.12)],
  'fita-clara': [760, 120, () => fita('#F2EFE6', 0.1)],
  // folha de jornal envelhecido para a transição de rasgo: colunas de "texto" em barras cinza, sem palavras reais
  'papel-jornal': [1400, 2400, () => {
    const topo = rasgo(0, 1400, 120, 60, 26);
    let barras = '';
    for (let col = 0; col < 3; col++) for (let l = 0; l < 95; l++) {
      if (rnd() < 0.08) continue;
      const w = 360 * (0.55 + rnd() * 0.45);
      barras += `<rect x="${110 + col * 410}" y="${260 + l * 22}" width="${w.toFixed(0)}" height="9" fill="#5B564C" opacity="${(0.35 + rnd() * 0.35).toFixed(2)}"/>`;
    }
    return `<defs>${fibra('f', 0.6, 0.22)}</defs>
      <g filter="url(#f)"><polygon points="${poli(topo)} 1400,2400 0,2400" fill="#E8E0CC"/></g>
      <clipPath id="c"><polygon points="${poli(topo)} 1400,2400 0,2400"/></clipPath>
      <g clip-path="url(#c)"><rect x="110" y="170" width="1180" height="60" fill="#3E3A33" opacity="0.8"/>${barras}</g>`;
  }],
  // pincelada escura atrás da legenda
  'pincel': [1000, 200, () => `<defs><filter id="p" x="-5%" y="-20%" width="110%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035 0.6" numOctaves="2" seed="9" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="26"/></filter></defs>
      <rect x="20" y="40" width="960" height="120" rx="8" fill="#161616" opacity="0.92" filter="url(#p)"/>`],
  // clarão de luz (transição do Visor): manchas quentes desfocadas, em tela
  'luz': [1080, 1920, () => `<defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="90"/></filter></defs>
      <g filter="url(#b)"><ellipse cx="300" cy="1500" rx="420" ry="260" fill="#FF7A1A" opacity="0.9"/>
      <ellipse cx="760" cy="1250" rx="300" ry="420" fill="#FF3D7F" opacity="0.7"/><ellipse cx="560" cy="1650" rx="520" ry="160" fill="#FFD36B" opacity="0.8"/></g>`],
  // foco de luz dourada cortado pela borda de cima à direita (Luz de Vela): brilho suave, sem contorno
  'luz-dourada': [1080, 1920, () => `<defs><radialGradient id="g" cx="1080" cy="0" r="760" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#F2C76E" stop-opacity="0.85"/><stop offset="0.45" stop-color="#E2B455" stop-opacity="0.35"/>
      <stop offset="1" stop-color="#E2B455" stop-opacity="0"/></radialGradient></defs><rect width="1080" height="1920" fill="url(#g)"/>`],
  // adesivos com contorno preto (Adesivo)
  'adesivo-estrela': [300, 300, () => `<path d="M150 20 L178 122 L280 150 L178 178 L150 280 L122 178 L20 150 L122 122 Z" fill="#FFD43B" stroke="#111" stroke-width="10" stroke-linejoin="round"/>`],
  'adesivo-explosao': [760, 760, () => {
    let d = '';
    for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 250 : 360; d += `${i ? 'L' : 'M'}${(380 + Math.cos(a) * r).toFixed(1)} ${(380 + Math.sin(a) * r).toFixed(1)} `; }
    return `<path d="${d}Z" fill="#E9A6DB" stroke="#111" stroke-width="12" stroke-linejoin="round"/>`;
  }],
  'adesivo-raio': [260, 420, () => `<path d="M150 15 L30 230 L120 230 L80 405 L235 160 L140 160 L200 15 Z" fill="#FFD43B" stroke="#111" stroke-width="10" stroke-linejoin="round"/>`],
  'adesivo-flor': [320, 320, () => {
    let p = '';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 360; p += `<ellipse cx="160" cy="80" rx="42" ry="70" transform="rotate(${a} 160 160)" fill="#F08FD0" stroke="#111" stroke-width="8"/>`; }
    return p + '<circle cx="160" cy="160" r="46" fill="#E23D3D" stroke="#111" stroke-width="8"/>';
  }],
  'adesivo-seta': [300, 300, () => `<path d="M40 250 L170 120 L120 120 L250 40 L200 170 L180 130 L60 270 Z" fill="#2DBE7E" stroke="#111" stroke-width="10" stroke-linejoin="round"/>`],
  'adesivo-rabisco': [520, 200, () => `<path d="M30 140 C 90 20, 140 20, 170 110 S 260 200, 300 90 S 400 10, 490 80" fill="none" stroke="#79D9B4" stroke-width="34" stroke-linecap="round"/>`],
  // fundo rosa com xadrez (Adesivo)
  'xadrez-rosa': [1080, 1920, () => {
    let q = '';
    for (let j = 0; 1280 + j * 90 < 1920; j++) for (let i = 0; i * 90 < 1080; i++) if ((i + j) % 2 === 0) q += `<rect x="${i * 90}" y="${1280 + j * 90}" width="90" height="90" fill="#D98CC8"/>`;
    let pontos = '';
    for (let y = 30; y < 1280; y += 34) for (let x = (y / 34) % 2 ? 17 : 0; x < 1080; x += 34) pontos += `<circle cx="${x}" cy="${y}" r="5" fill="#E7A9D9"/>`;
    return `<rect width="1080" height="1920" fill="#F1BFE4"/>${pontos}<rect y="1280" width="1080" height="640" fill="#EBB1DD"/>${q}`;
  }],
  // papel quadriculado (Adesivo, B-roll)
  'papel-grade': [1080, 1920, () => {
    let l = '';
    for (let x = 0; x <= 1080; x += 60) l += `<line x1="${x}" y1="0" x2="${x}" y2="1920" stroke="#F2B6D8" stroke-width="2"/>`;
    for (let y = 0; y <= 1920; y += 60) l += `<line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="#F2B6D8" stroke-width="2"/>`;
    return `<rect width="1080" height="1920" fill="#FBF8FA"/>${l}`;
  }],
  // janela de sistema antigo, com a área de conteúdo vazada (Retrô)
  'janela-retro': [860, 720, () => `<defs><mask id="m"><rect width="860" height="720" fill="#fff"/><rect x="18" y="58" width="824" height="644" fill="#000"/></mask></defs>
      <g mask="url(#m)"><rect x="2" y="2" width="856" height="716" rx="10" fill="#DADADA" stroke="#8F8F8F" stroke-width="3"/>
      <rect x="2" y="2" width="856" height="46" rx="10" fill="#EFEFEF"/></g>
      <circle cx="34" cy="26" r="9" fill="#FF5F57"/><circle cx="62" cy="26" r="9" fill="#FEBC2E"/><circle cx="90" cy="26" r="9" fill="#28C840"/>
      <rect x="18" y="58" width="824" height="644" fill="none" stroke="#9A9A9A" stroke-width="3"/>`],
  // folha de caderno pautada (fundo do B-roll)
  'papel-caderno': [1080, 1920, () => {
    let linhas = '';
    for (let y = 180; y < 1920; y += 64) linhas += `<line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="#9DB7D6" stroke-width="2" opacity="0.55"/>`;
    return `<defs>${fibra('f', 0.8, 0.08)}</defs><rect width="1080" height="1920" fill="#F7F5EF" filter="url(#f)"/>${linhas}
      <line x1="150" y1="0" x2="150" y2="1920" stroke="#E07A7A" stroke-width="3" opacity="0.6"/>`;
  }],
  // fita vermelha que prende o mockup (Fanzine)
  'fita-vermelha': [760, 120, () => fita('#D9533F', 0.12)],
  // grade técnica fina, só para as telas escuras (Circuito Néon)
  'grade-neon': [1080, 1920, () => {
    let l = '';
    for (let x = 0; x <= 1080; x += 72) l += `<line x1="${x}" y1="0" x2="${x}" y2="1920" stroke="#3CFFB0" stroke-width="1.5" opacity="0.13"/>`;
    for (let y = 0; y <= 1920; y += 72) l += `<line x1="0" y1="${y}" x2="1080" y2="${y}" stroke="#3CFFB0" stroke-width="1.5" opacity="0.13"/>`;
    return l;
  }],
  // degradê suave só na parte de baixo, atrás do texto; transparente até abaixo do queixo (Editorial)
  'degrade-editorial': [1080, 1920, () => `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.5" stop-color="#4F3127" stop-opacity="0"/>
      <stop offset="0.78" stop-color="#4F3127" stop-opacity="0.45"/><stop offset="1" stop-color="#4F3127" stop-opacity="0.7"/></linearGradient></defs>
      <rect width="1080" height="1920" fill="url(#g)"/>`],
};

function fita(cor, ruido) {
  const esq = [], dir = [];
  for (let y = 0; y <= 120; y += 10) { esq.push([8 + rnd() * 14, y]); dir.push([752 - rnd() * 14, y]); }
  return `<defs>${fibra('f', 1.2, ruido)}</defs><polygon points="${poli(esq)} ${poli(dir.reverse())}" fill="${cor}" filter="url(#f)"/>`;
}

(async () => {
  // FABRICA_CHROMIUM: o mesmo Chromium ou Chrome que o carrossel usa, quando o Playwright não instalou o dele
  const navegador = await chromium.launch(process.env.FABRICA_CHROMIUM ? { executablePath: process.env.FABRICA_CHROMIUM } : {});
  const pagina = await navegador.newPage();
  for (const [nome, [w, h, svg]] of Object.entries(PECAS)) {
    await pagina.setViewportSize({ width: w, height: h });
    await pagina.setContent(`<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${svg()}</svg></body></html>`);
    await pagina.screenshot({ path: path.join(SAIDA, nome + '.png'), omitBackground: true });
    console.log(nome, w + 'x' + h);
  }
  await navegador.close();
})();
