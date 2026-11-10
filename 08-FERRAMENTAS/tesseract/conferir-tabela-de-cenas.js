// Confere a tabela de cenas de um plano de vídeo (regra V-08, com V-02 e V-03).
// Uso: node conferir-tabela-de-cenas.js <arquivo.md>     (lê a primeira tabela com a coluna "Formato do rosto")
//      node conferir-tabela-de-cenas.js --autoteste      (calibra: um caso bom tem que passar e cada caso ruim tem que reprovar, G-13)
// Saída: 0 = confere, 1 = reprova (lista os problemas), 2 = erro de uso.
// A tabela tem as colunas: Tempo | Fala | Formato do rosto | O que aparece | Como se move.
'use strict';
const fs = require('fs');

const COLUNAS = ['tempo', 'fala', 'formato do rosto', 'o que aparece', 'como se move'];
// termos aceitos em "Formato do rosto" (os do glossário de linhas/reels/dados/entrevista-de-estilo.md)
const FORMATOS = [/tela cheia/i, /cart[aã]o/i, /faixa/i, /s[oó] (o )?(desenho|ilustra[cç][aã]o)/i];
const LIMITE_SEM_EVENTO = 3.5; // s (V-02: um elemento novo a cada 2 a 3 s; aviso, não reprovação)
const QUADRO_MINIMO = 4; // s (V-02: quadro de destaque, fora da tela cheia, fica na tela tempo bastante para assimilar)

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function lerTabela(texto) {
  const linhas = texto.split(/\r?\n/);
  const i = linhas.findIndex((l) => l.includes('|') && /formato do rosto/i.test(l));
  if (i < 0) return null;
  const celulas = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const cab = celulas(linhas[i]).map(norm);
  const dados = [];
  for (let j = i + 1; j < linhas.length; j++) {
    const l = linhas[j];
    if (!l.includes('|')) break;
    if (/^\s*\|?\s*:?-{2,}/.test(l)) continue;
    dados.push(celulas(l));
  }
  return { cab, dados };
}

// "0:03–0:08", "3-8 s", "12,5 a 14 s"
function lerTempo(t) {
  const n = t.replace(',', '.').match(/(\d+:)?\d+(\.\d+)?/g);
  if (!n || n.length < 2) return null;
  const s = (x) => x.includes(':') ? Number(x.split(':')[0]) * 60 + Number(x.split(':')[1]) : Number(x);
  return [s(n[0]), s(n[1])];
}

function conferir(texto) {
  const erros = [], avisos = [];
  const tab = lerTabela(texto);
  if (!tab) return { erros: ['tabela de cenas não encontrada (precisa da coluna "Formato do rosto")'], avisos };
  const idx = {};
  for (const c of COLUNAS) {
    idx[c] = tab.cab.findIndex((h) => h === c);
    if (idx[c] < 0) erros.push(`coluna faltando: "${c}"`);
  }
  if (erros.length) return { erros, avisos };
  if (!tab.dados.length) return { erros: ['a tabela não tem nenhuma cena'], avisos };
  let fimAnterior = 0;
  tab.dados.forEach((l, k) => {
    const n = k + 1;
    const t = lerTempo(l[idx.tempo] || '');
    if (!t) { erros.push(`cena ${n}: tempo ilegível ("${l[idx.tempo] || ''}")`); return; }
    if (!(t[1] > t[0])) erros.push(`cena ${n}: o fim (${t[1]} s) não vem depois do início (${t[0]} s)`);
    if (t[0] + 0.001 < fimAnterior) erros.push(`cena ${n}: começa em ${t[0]} s, antes do fim da anterior (${fimAnterior} s)`);
    if (t[1] - t[0] > LIMITE_SEM_EVENTO && !/\+|;/.test(l[idx['o que aparece']] || '')) {
      avisos.push(`cena ${n}: ${(t[1] - t[0]).toFixed(1)} s com um evento só (V-02 pede um elemento novo a cada 2 a 3 s)`);
    }
    fimAnterior = Math.max(fimAnterior, t[1]);
    if (!(l[idx.fala] || '').trim()) erros.push(`cena ${n}: fala vazia`);
    if (!FORMATOS.some((r) => r.test(l[idx['formato do rosto']] || ''))) erros.push(`cena ${n}: formato do rosto fora do glossário ("${l[idx['formato do rosto']] || ''}")`);
    const aparece = l[idx['o que aparece']] || '';
    if (!aparece.trim()) erros.push(`cena ${n}: "o que aparece" vazio`);
    else if (!/["“”']|palavra|quando|na fala/i.test(aparece)) erros.push(`cena ${n}: "o que aparece" sem a palavra que o dispara (V-03)`);
    if (!(l[idx['como se move']] || '').trim()) erros.push(`cena ${n}: "como se move" vazio`);
  });
  // quadros: cenas seguidas com o mesmo formato do rosto formam um quadro; fora da tela cheia, ele dura o mínimo
  const quadros = [];
  tab.dados.forEach((l, k) => {
    const t = lerTempo(l[idx.tempo] || ''); if (!t) return;
    const f = norm(l[idx['formato do rosto']] || ''), u = quadros[quadros.length - 1];
    if (u && u.formato === f) { u.fim = t[1]; u.ate = k + 1; } else quadros.push({ formato: f, ini: t[0], fim: t[1], de: k + 1, ate: k + 1 });
  });
  for (const q of quadros) {
    if (/tela cheia/.test(q.formato) || q.fim - q.ini >= QUADRO_MINIMO - 0.001) continue;
    const cenas = q.de === q.ate ? `cena ${q.de}` : `cenas ${q.de} a ${q.ate}`;
    erros.push(`${cenas}: o quadro "${q.formato}" fica só ${(q.fim - q.ini).toFixed(1)} s; troca de quadro com destaque fica pelo menos ${QUADRO_MINIMO} s (V-02)`);
  }
  return { erros, avisos };
}

const BOA = `
| Tempo | Fala | Formato do rosto | O que aparece | Como se move |
|---|---|---|---|---|
| 0:00–0:03 | "Vai doar a casa?" | Você num cartão | Casa 3D, na palavra "casa" | Entra de baixo e assenta |
| 0:03–0:06 | "Espera." | Você num cartão | Chave ganha pausa, na palavra "Espera" | Estala e para |
| 0:06–0:10 | "Doar é amor." | Só o desenho | Frase, quando ele diz "amor" | Palavra a palavra |
`;
const RUINS = {
  'quadro de destaque curto': BOA.replace('0:06–0:10', '0:06–0:08'),
  'coluna faltando': BOA.replace('| Como se move |', '| Movimento |'),
  'tempo fora de ordem': BOA.replace('0:03–0:06', '0:02–0:06'),
  'formato fora do glossário': BOA.replace('Você num cartão | Chave', 'Janelinha | Chave'),
  'sem a palavra de gatilho': BOA.replace('Casa 3D, na palavra "casa"', 'Casa 3D'),
};

function autoteste() {
  let ok = true;
  const b = conferir(BOA);
  if (b.erros.length) { ok = false; console.log('FALHOU: o caso bom foi reprovado:', b.erros); } else console.log('ok: caso bom passa');
  for (const [nome, t] of Object.entries(RUINS)) {
    const r = conferir(t);
    if (!r.erros.length) { ok = false; console.log(`FALHOU: caso ruim "${nome}" não foi reprovado`); } else console.log(`ok: reprova "${nome}"`);
  }
  return ok ? 0 : 1;
}

const arg = process.argv[2];
if (arg === '--autoteste') process.exit(autoteste());
if (!arg || !fs.existsSync(arg)) { console.error('uso: node conferir-tabela-de-cenas.js <arquivo.md> | --autoteste'); process.exit(2); }
const r = conferir(fs.readFileSync(arg, 'utf8'));
r.avisos.forEach((a) => console.log('aviso: ' + a));
if (r.erros.length) { r.erros.forEach((e) => console.log('REPROVA: ' + e)); process.exit(1); }
console.log('tabela de cenas confere.');
