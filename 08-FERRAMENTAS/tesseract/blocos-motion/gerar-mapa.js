// Gera a grade de pontos (10 px) de uma região, com os países pedidos marcados. 
// mapas/europa.json foi gerado com a região "europa" e os países Italy, Poland, Romania.
//
// Uso:  node gerar-mapa.js --regiao europa --paises Italy,Poland,Romania [--saida mapas/europa.json] [--bbox lonMin,lonMax,latMin,latMax]
//       node gerar-mapa.js --regiao brasil --paises Brazil,Argentina
// Fonte: Natural Earth 110m, domínio público (mapas/fonte/ne_110m_admin_0_countries.geojson; baixa uma vez se faltar).
// Nomes de país: o campo ADMIN do Natural Earth, em inglês (Italy, Poland, Romania, Brazil, Germany...).
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

const URL_GEO = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson';
const GEO = path.join(__dirname, 'mapas', 'fonte', 'ne_110m_admin_0_countries.geojson');
const CAIXA = { x0: 135, x1: 445, y0: 1020, y1: 1285 }; // área do mapa na placa (faixa padrão), 310 x 265 px
const PASSO = 10;

// Projeção: x = xRef + (lon - lonRef) * kx ; y = yRef - (lat - latRef) * ky
const REGIOES = {
  europa: { lonRef: 2, latRef: 36, xRef: 130, yRef: 1290, kx: 9.7, ky: 13.75 }, // lon 2 a 32, lat 36 a 56
  brasil: { bbox: [-74, -34, -34, 6] },
  'america-do-sul': { bbox: [-82, -34, -56, 13] },
  mundo: { bbox: [-170, 180, -58, 80] },
};

// região por caixa lon/lat: encaixa na CAIXA com cos(lat média), centralizada
function projecaoPorBbox([lonMin, lonMax, latMin, latMax]) {
  const cosM = Math.cos(((latMin + latMax) / 2) * Math.PI / 180);
  const ky = Math.min((CAIXA.x1 - CAIXA.x0) / ((lonMax - lonMin) * cosM), (CAIXA.y1 - CAIXA.y0) / (latMax - latMin));
  const kx = ky * cosM;
  const larg = (lonMax - lonMin) * kx, alt = (latMax - latMin) * ky;
  const xRef = CAIXA.x0 + ((CAIXA.x1 - CAIXA.x0) - larg) / 2;
  const yRef = CAIXA.y1 - ((CAIXA.y1 - CAIXA.y0) - alt) / 2;
  return { lonRef: lonMin, latRef: latMin, xRef, yRef, kx, ky };
}

const baixa = (u, dest) => new Promise((ok, erro) => https.get(u, (r) => {
  if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return baixa(r.headers.location, dest).then(ok, erro);
  if (r.statusCode !== 200) return erro(new Error('HTTP ' + r.statusCode));
  const f = fs.createWriteStream(dest); r.pipe(f); f.on('finish', () => f.close(ok));
}).on('error', erro));

const dentro = (lon, lat, anel) => { // ray casting
  let d = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
};
const noPoligono = (lon, lat, poly) => dentro(lon, lat, poly[0]) && !poly.slice(1).some((b) => dentro(lon, lat, b));

let _paises = null;
function paisesGeo() {
  if (_paises) return _paises;
  if (!fs.existsSync(GEO) || fs.statSync(GEO).size < 1e5) throw new Error(`falta ${GEO}; rode "node gerar-mapa.js --baixar" uma vez`);
  const feats = JSON.parse(fs.readFileSync(GEO, 'utf8')).features;
  _paises = feats.map((f) => ({ nome: f.properties.ADMIN, polys: f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates }));
  return _paises;
}
const nomesDisponiveis = () => paisesGeo().map((p) => p.nome).sort();

function projecaoDe(regiao, bbox) {
  if (bbox) return projecaoPorBbox(bbox);
  const r = REGIOES[regiao];
  if (!r) throw new Error(`região desconhecida: ${regiao} (${Object.keys(REGIOES).join(', ')}; ou passe --bbox)`);
  return r.bbox ? projecaoPorBbox(r.bbox) : r;
}

// devolve { terra: [[x,y]...], <País>: [[x,y]...] }
function gerar({ regiao = 'europa', paises = [], bbox } = {}) {
  const P = projecaoDe(regiao, bbox);
  const geo = paisesGeo();
  const nomes = new Set(geo.map((g) => g.nome));
  for (const n of paises) if (!nomes.has(n)) throw new Error(`país "${n}" não existe no Natural Earth (campo ADMIN, em inglês). Exemplos: Italy, Poland, Brazil, Germany`);
  const out = { terra: [] };
  paises.forEach((n) => { out[n] = []; });
  for (let x = CAIXA.x0; x <= CAIXA.x1; x += PASSO) for (let y = CAIXA.y0; y <= CAIXA.y1; y += PASSO) {
    const lon = P.lonRef + (x - P.xRef) / P.kx, lat = P.latRef + (P.yRef - y) / P.ky;
    const p = geo.find((cc) => cc.polys.some((poly) => noPoligono(lon, lat, poly)));
    if (!p) continue;
    out.terra.push([x, y]);
    if (out[p.nome]) out[p.nome].push([x, y]);
  }
  return out;
}

// cache por região+países para o bloco (gera na hora se o arquivo não tiver o país)
function carregaMapa(regiao, paises) {
  const arq = path.join(__dirname, 'mapas', regiao + '.json');
  let mapa = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq, 'utf8')) : null;
  const falta = mapa ? paises.filter((n) => !mapa[n]) : paises;
  if (!mapa || falta.length) {
    const novo = gerar({ regiao, paises: [...new Set([...(mapa ? Object.keys(mapa).filter((k) => k !== 'terra') : []), ...paises])] });
    fs.mkdirSync(path.dirname(arq), { recursive: true });
    fs.writeFileSync(arq, JSON.stringify(novo));
    mapa = novo;
  }
  return mapa;
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const arg = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
  (async () => {
    if (a.includes('--baixar')) { fs.mkdirSync(path.dirname(GEO), { recursive: true }); await baixa(URL_GEO, GEO); console.log('ok', GEO); return; }
    if (a.includes('--listar')) { console.log(nomesDisponiveis().join('\n')); return; }
    const regiao = arg('regiao', 'europa');
    const paises = (arg('paises', 'Italy,Poland,Romania') || '').split(',').filter(Boolean);
    const bbox = arg('bbox') ? arg('bbox').split(',').map(Number) : undefined;
    const out = gerar({ regiao, paises, bbox });
    const saida = path.resolve(arg('saida', path.join(__dirname, 'mapas', regiao + '.json')));
    fs.mkdirSync(path.dirname(saida), { recursive: true });
    fs.writeFileSync(saida, JSON.stringify(out));
    console.log(saida, Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length])));
    // pré-visualização em texto
    const P = projecaoDe(regiao, bbox);
    const L = [];
    for (let y = CAIXA.y0; y <= CAIXA.y1; y += PASSO) {
      let l = '';
      for (let x = CAIXA.x0; x <= CAIXA.x1; x += PASSO) {
        const tem = (arr) => arr.some(([px, py]) => px === x && py === y);
        const ch = paises.findIndex((n) => tem(out[n]));
        l += ch >= 0 ? 'ABCDEFGH'[ch] : tem(out.terra) ? '.' : ' ';
      }
      L.push(l);
    }
    console.log(L.join('\n'));
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
module.exports = { gerar, carregaMapa, nomesDisponiveis, REGIOES, CAIXA };
