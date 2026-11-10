// Bloco `mapa-pontos`: mapa de pontos (grade de 10 px) com países destacados, coluna de rótulos e, no último país, "cancelado"/risco.
// O mapa vem de mapas/<regiao>.json (gerar-mapa.js).
'use strict';
const fs = require('fs');
const { CLARO, ACENTO, ESCURO, FATOR_LARGURA, alfa, mistura, cor, MONO, EASE, elipse, escalaTempo } = require('./nucleo');
const { carregaMapa } = require('./gerar-mapa');

const tipo = 'mapa-pontos';
const DUR_ORIGINAL = 15.597, INI_ORIGINAL = 22.02;
// tempos de referência em segundos absolutos (22,02 a 37,617)
const TEMPOS_ORIGINAIS = {
  terra: 22.10, kicker: 23.32,
  paises: [25.17, 25.65, 26.19],      // cada país acende no mapa (anel) e o nome sobe
  rotulos: [29.21, 29.57, 30.64],     // rótulo mono de cada país
  escurece: 32.66,                    // os países anteriores escurecem (35%) quando o último entra em foco
  rotuloApaga: 34.20,                 // o rótulo do país em foco sai
  risco: 33.70, cancelado: 34.29, nota: 35.39,
};
const LINHAS_TOPO = [1010, 1100, 1190];
const TERRA = mistura(CLARO, 0.22);           // claro a 22% já misturado à cor escura da placa (forma ignora alfa)
const ACENTO35 = mistura(ACENTO, 0.35);       // acento a 35% sobre a cor escura da placa
const EM_NOME = 0.696 * FATOR_LARGURA;        // largura de uma letra do nome (fonte principal ExtraBold 40, tracking -10), em corpos; calibrada numa grotesca larga

function resolveTempos(bloco, n) {
  const ex = (bloco.opcoes && bloco.opcoes.tempos) || {};
  const f = escalaTempo(bloco.inicio, bloco.fim, DUR_ORIGINAL);
  const T = {};
  for (const [k, v] of Object.entries(TEMPOS_ORIGINAIS)) {
    if (Array.isArray(v)) T[k] = (ex[k] || v.slice(0, n).map((x) => f(x - INI_ORIGINAL))).map((x) => Number(x.toFixed(3)));
    else T[k] = ex[k] ?? Number(f(v - INI_ORIGINAL).toFixed(3));
  }
  return T;
}

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  if (!Array.isArray(t.paises) || t.paises.length < 1 || t.paises.length > 3) e.push('textos.paises: de 1 a 3 países (a coluna tem 3 linhas)');
  else {
    t.paises.forEach((p, i) => {
      if (!p.nome) e.push(`textos.paises[${i}].nome: texto`);
      if (!p.chave) e.push(`textos.paises[${i}].chave: nome do país no Natural Earth, em inglês (Italy, Poland...)`);
      if (!p.rotulo) e.push(`textos.paises[${i}].rotulo: texto`);
      if ((p.cancelado || p.nota) && i !== t.paises.length - 1) e.push(`textos.paises[${i}]: "cancelado"/"nota" só no último país (as linhas abaixo ficam sem espaço)`);
    });
  }
  if (t.kicker !== undefined && typeof t.kicker !== 'string') e.push('textos.kicker: texto');
  // o kicker (mono 30, tracking 220: ~24,6 px por letra a partir de x 180) precisa terminar antes da coluna dos países, que começa em x 500
  else if (t.kicker && t.kicker.length > 13) e.push(`textos.kicker: até 13 caracteres (tem ${t.kicker.length}); acima disso invade a coluna dos países`);
  if (o.tempos && o.tempos.paises && t.paises && o.tempos.paises.length !== t.paises.length) e.push('opcoes.tempos.paises: um instante por país');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const paises = t.paises;
  const regiao = o.mapa || 'europa';
  const MAPA = carregaMapa(regiao, paises.map((p) => p.chave));
  const T = resolveTempos(bloco, paises.length);
  const ultimo = paises[paises.length - 1];
  const emFoco = ultimo.cancelado || ultimo.nota ? paises.length - 1 : -1;   // país que fica em destaque no fim
  const escurece = emFoco >= 0 || o.tempos?.escurece !== undefined;
  const pontos = (lista) => lista.flatMap(([x, y]) => elipse(x, y, 3, 3));
  const centro = (lista) => [lista.reduce((s, p) => s + p[0], 0) / lista.length, lista.reduce((s, p) => s + p[1], 0) / lista.length];
  const DEST = cor(o.corDestaque, ACENTO);
  const DEST35 = o.corDestaque ? mistura(DEST, 0.35) : ACENTO35;

  // painel (entrada subindo, como no esquema)
  const p = c.painel('painel', A0, Z, 350, { entrada: 'sobe' });
  c.som('mockup', A0, 'painel ' + bloco.id);

  // mapa: terra em claro 22% (surge em T.terra) e uma camada por país
  const terra = c.forma('terra', A0, Z, pontos(MAPA.terra), { preenche: TERRA });
  c.kf(terra, 'opacity', [[A0, 0, EASE.hold], [T.terra, 0, EASE.hold], [T.terra + 0.04, 100, EASE.hold]]);
  const PA = paises.map((pais, i) => ({ ...pais, t: T.paises[i], tRot: T.rotulos[i], topo: LINHAS_TOPO[i], c: centro(MAPA[pais.chave]), foco: i === emFoco }));
  for (const [i, P] of PA.entries()) {
    P.cam = c.forma(`pais${i + 1}-pontos`, A0, Z, pontos(MAPA[P.chave]), { preenche: DEST });
    const apaga = P.foco ? [[T.risco, 100, EASE.hold], [T.risco + 0.02, 0, EASE.hold]]
      : escurece ? [[T.escurece, 100, EASE.hold], [T.escurece + 0.02, 0, EASE.hold]] : [];
    c.kf(P.cam, 'opacity', [[A0, 0, EASE.hold], [P.t, 0, EASE.hold], [P.t + 0.04, 100, EASE.hold], ...apaga]);
    if (!P.foco && escurece) { // os países anteriores escurecem a 35% quando o último entra em foco
      const d = c.forma(`pais${i + 1}-pontos-35`, A0, Z, pontos(MAPA[P.chave]), { preenche: DEST35 });
      c.kf(d, 'opacity', [[A0, 0, EASE.hold], [T.escurece, 0, EASE.hold], [T.escurece + 0.02, 100, EASE.hold]]);
    }
  }
  // anel de pulso em cada país
  for (const [i, P] of PA.entries()) {
    const anel = c.forma(`pais${i + 1}-anel`, P.t, P.t + 0.7, elipse(P.c[0], P.c[1], 12, 12), { traco: DEST, largura: 4, pivo: P.c });
    c.kf(anel, 'strokeWidth', [[P.t, 5, EASE.hold], [P.t + 0.6, 0.4, EASE.linear]]);
    c.escala(anel, [[P.t, 100], [P.t + 0.6, 280]]);
  }
  c.som('tile', PA[0].t, 'pais ' + bloco.id);

  // kicker
  const regua = c.rect('regua', A0, Z, [130, 997], [34, 6], ACENTO);
  c.janelas(regua, [[T.kicker]]);
  const kick = c.texto('kicker', A0, Z, [180, 979], [700, 42], t.kicker || 'PAÍSES', { fonte: MONO, estilo: 'Regular', tam: 30, cor: alfa(CLARO, 0.78), just: 'left', tracking: 220 });
  c.janelas(kick, [[T.kicker]]);

  // coluna dos países
  for (const [i, P] of PA.entries()) {
    const apaga = P.foco ? [] : escurece ? [[T.escurece, 100, EASE.hold], [T.escurece + 0.30, 35]] : [];
    const nome = c.texto(`pais${i + 1}-nome`, A0, Z, [500, P.topo], [440, 46], P.nome, { tam: 40, cor: CLARO, just: 'left', vAlign: 'top', tracking: -10 });
    c.sobe(nome, P.t, P.topo, 24);
    c.kf(nome, 'opacity', [[A0, 0, EASE.hold], [P.t, 0, EASE.hold], [P.t + 0.22, 100], ...apaga]);
    const rot = c.texto(`pais${i + 1}-rotulo`, A0, Z, [500, P.topo + 50], [450, 28], P.rotulo, { fonte: MONO, estilo: 'Regular', tam: 20, cor: alfa(CLARO, 0.72), just: 'left', tracking: 60 });
    c.sobe(rot, P.tRot, P.topo + 50, 16);
    if (P.foco && P.cancelado) c.kf(rot, 'opacity', [[A0, 0, EASE.hold], [P.tRot, 0, EASE.hold], [P.tRot + 0.22, 100], [T.rotuloApaga, 100, EASE.hold], [T.rotuloApaga + 0.09, 0, EASE.linear]]);
    else c.kf(rot, 'opacity', [[A0, 0, EASE.hold], [P.tRot, 0, EASE.hold], [P.tRot + 0.22, 100], ...apaga]);
  }
  // país em foco: risco sobre o nome ("cancelado"), rótulo novo e nota
  if (emFoco >= 0) {
    const P = PA[emFoco];
    if (P.cancelado) {
      const larg = o.larguraNome ?? Math.round(P.nome.length * 40 * EM_NOME);
      const risco = c.forma('pais-risco', T.risco, Z, [{ type: 'moveTo', x: 496, y: P.topo + 20 }, { type: 'lineTo', x: 500 + larg + 8, y: P.topo + 20 }], { traco: DEST, largura: 6, trim: 0 });
      c.kf(risco, 'trimEnd', [[T.risco, 0, EASE.hold], [T.risco + 0.30, 100]]);
      c.som('tile', T.risco, 'cancelado ' + bloco.id, -4);
      const canc = c.texto('pais-cancelado', T.cancelado, Z, [500, P.topo + 50], [450, 28], P.cancelado, { fonte: MONO, estilo: 'Regular', tam: 20, cor: DEST, just: 'left', tracking: 60 });
      c.kf(canc, 'opacity', [[T.cancelado, 0, EASE.hold], [T.cancelado + 0.22, 100]]);
    }
    if (P.nota) {
      const nota = c.texto('pais-nota', T.nota, Z, [500, P.topo + 78], [450, 28], P.nota, { fonte: MONO, estilo: 'Regular', tam: 20, cor: alfa(CLARO, 0.72), just: 'left', tracking: 60 });
      c.sobe(nota, T.nota, P.topo + 78, 16);
      c.kf(nota, 'opacity', [[T.nota, 0, EASE.hold], [T.nota + 0.22, 100]]);
    }
  }
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }], tempos: T };
}

const exemplo = {
  id: 'regra-mapa', tipo: 'mapa-pontos', inicio: 5.0, fim: 20.6,
  textos: {
    kicker: 'ONDE EXISTE',
    paises: [
      { nome: 'ALEMANHA', chave: 'Germany', rotulo: 'REGRA EM TESTE' },
      { nome: 'POLÔNIA', chave: 'Poland', rotulo: 'REGRA EM VIGOR' },
      { nome: 'GRÉCIA', chave: 'Greece', rotulo: 'REGRA EM ESTUDO', cancelado: 'SUSPENSA EM 2024', nota: 'SEM DATA NOVA' },
    ],
  },
  opcoes: { mapa: 'europa' },
};
const campos = {
  'textos.kicker': 'texto mono do topo da placa, até 13 caracteres (a coluna dos países começa em x 500)',
  'textos.paises': 'de 1 a 3: {nome, chave (Natural Earth, em inglês), rotulo, cancelado?, nota?}; cancelado e nota só no último',
  'opcoes.mapa': 'região em mapas/<regiao>.json (europa | brasil | america-do-sul | mundo; veja gerar-mapa.js). País que falta no arquivo é gerado na hora',
  'opcoes.corDestaque': 'cor dos países marcados (padrão acento)',
  'opcoes.larguraNome': 'largura em px do risco sobre o nome (padrão estimada: 0,696 x 40 px por letra)',
  'opcoes.tempos': 'terra, kicker, paises[], rotulos[], escurece, risco, cancelado, rotuloApaga, nota (segundos absolutos)',
};
module.exports = { tipo, descricao: 'Mapa de pontos com países destacados, rótulos e risco/"cancelado" no último.', validar, construir, exemplo, campos, TEMPOS_ORIGINAIS };
