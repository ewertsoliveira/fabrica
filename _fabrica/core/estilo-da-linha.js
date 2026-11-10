#!/usr/bin/env node
// O estilo escolhido pela empresa (estilo.json, gravado por escolha.js) traduzido para as linhas e para a peça registrada.
//
// - Carrossel: o estilo do carrossel passa a ser o da empresa, com as cores da marca (`--estilo <id> --cores marca`); a
//   pessoa ainda pode pedir outro. Estilo próprio: lido da pasta de estilos próprios DESTA empresa (`pastaEstilos`).
// - Reels: o modelo do estilo (`formatos.reels.modelo` do estilo.yaml), com `usarMarca: true` e FABRICA_EMPRESA=<codigo>.
//   O estilo próprio é a cópia da pasta inteira de um estilo do catálogo: o modelo dele é o do estilo em que se baseia.
// - Peça: o estilo com que a peça foi feita ({ id, origem, nome }), só do catálogo ou dos estilos próprios desta empresa.
// Sem estilo escolhido (ou com o estilo escolhido que não existe mais), tudo como antes: null.
//
// O catálogo e os modelos de vídeo são do modelo da Fábrica (a pasta deste código); os estilos próprios e o estilo.json
// são da empresa (a raiz dos dados). Só lê; nada é gravado.
//
//   node _fabrica/core/estilo-da-linha.js <codigo> [--json]
//   Saída 0 (com ou sem estilo), 1 recusa (empresa inválida, estilo.json quebrado), 2 uso.
'use strict';
const fs = require('fs');
const path = require('path');
const empresaMod = require('./empresa');
const escolha = require('./escolha');
const estilosProprios = require('./estilos-proprios');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');

const RAIZ_CODIGO = path.resolve(__dirname, '..', '..');
const CATALOGO = path.join(RAIZ_CODIGO, '04-LABORATORIO-DE-DESIGN', 'estilos');
const MODELOS = path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'estilos');
const CODIGO = /^[a-z0-9][a-z0-9-]{0,63}$/; // estilo do catálogo e modelo de vídeo: nunca caminho, nunca "_demo"/"_inverso"
const ORIGENS = ['catalogo', 'proprio'];

const car = (n) => String.fromCharCode(n);
const BOM_INICIO = new RegExp('^' + car(0xfeff));
const SEQUENCIAS = new RegExp(`(?:${car(0x1b)}\\[|${car(0x9b)})[0-9;?]*[ -/]*[@-~]|${car(0x1b)}[@-_]?`, 'g');
const QUEBRAS = new RegExp(`[${car(9)}${car(10)}${car(11)}${car(12)}${car(13)}${car(0x85)}${car(0x2028)}${car(0x2029)}]`, 'g');
const INVISIVEIS = new RegExp('[\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}\\p{Cs}\\u{FE00}-\\u{FE0F}\\u{E0000}-\\u{E01EF}\\u{034F}\\u{061C}\\u{00AD}\\u{180E}\\u{3164}\\u{115F}\\u{1160}\\u{FFA0}\\u{2800}\\u{17B4}\\u{17B5}]', 'gu');
// O nome de um estilo (o próprio veio de referências de fora): uma linha, sem controles nem invisíveis, até 80.
function limparNome(v) {
  if (typeof v !== 'string') return '';
  const s = v.replace(SEQUENCIAS, '').replace(QUEBRAS, ' ').replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim();
  const letras = [...s];
  return letras.length > 80 ? letras.slice(0, 79).join('') + '…' : s;
}

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.lstatSync(p).isFile(); } catch { return false; } };
const recusaDaPeca = (msg) => Object.assign(new Error(msg), { code: 'ESTILO_DA_PECA' });

// O estilo.yaml de um estilo do catálogo (objeto) ou null.
function doCatalogo(id) {
  if (typeof id !== 'string' || !CODIGO.test(id)) return null;
  const arq = path.join(CATALOGO, id, 'estilo.yaml');
  if (!ehArquivo(arq)) return null;
  try {
    const y = lerYaml(fs.readFileSync(arq, 'utf8').replace(BOM_INICIO, ''));
    return ehObjeto(y) ? y : null;
  } catch { return null; }
}
// O estilo.yaml de um estilo próprio DESTA empresa (a regra única de estilos-proprios.js) ou null.
function doProprio(c, id) {
  try { return estilosProprios.lerEstilo(c.estilosProprios, id).y; } catch { return null; }
}
function lerEstilo(c, id, origem) {
  return origem === 'proprio' ? doProprio(c, id) : doCatalogo(id);
}

// O modelo de Reels do estilo, se ele existe na pasta dos modelos (nome simples, nunca a base "_inverso" nem caminho).
function modeloDeReels(y) {
  const f = ehObjeto(y.formatos) ? y.formatos : {};
  const m = ehObjeto(f.reels) ? f.reels.modelo : undefined;
  if (typeof m !== 'string' || !CODIGO.test(m) || !ehArquivo(path.join(MODELOS, m + '.js'))) return null;
  return m;
}

// null, ou { id, origem, nome, carrossel: { estilo, cores: 'marca', pastaEstilos } | null, reels: { modelo, usarMarca } | null }.
// estilo.json quebrado: erro JSON_INVALIDO (do escolha.js; nada é regravado). Empresa inválida: a recusa do escolha.js.
function daEmpresa(r, codigo) {
  const atual = escolha.ler(r, codigo);
  if (!atual) return null;
  const c = empresaMod.caminhos(codigo, r);
  const y = lerEstilo(c, atual.estilo, atual.origem);
  if (!y) return null;
  const proprio = atual.origem === 'proprio';
  const f = ehObjeto(y.formatos) ? y.formatos : {};
  const modelo = modeloDeReels(y);
  return {
    id: atual.estilo,
    origem: atual.origem,
    nome: limparNome(y.nome) || atual.estilo,
    carrossel: f.carrossel ? { estilo: atual.estilo, cores: 'marca', pastaEstilos: proprio ? c.estilosProprios : null } : null,
    // o arranjo da imagem escolhido em "Personalizar" (escolha.js, lista fechada igual à de rosto.layout dos modelos)
    reels: modelo ? { modelo, usarMarca: true, ...(atual.personalizacoes.arranjoImagem ? { layout: atual.personalizacoes.arranjoImagem } : {}) } : null,
  };
}

// O estilo que a peça diz ter (código, ou { id, origem }), conferido: { id, origem, nome }. Sem origem, o catálogo primeiro
// e depois os estilos próprios desta empresa. Fora disso, recusa (código ESTILO_DA_PECA): estilo de outra empresa nunca.
function daPeca(r, codigo, valor) {
  const pedido = typeof valor === 'string' ? { id: valor } : valor;
  const id = ehObjeto(pedido) ? pedido.id : undefined;
  const origem = ehObjeto(pedido) ? pedido.origem : undefined;
  const mostrar = JSON.stringify(typeof id === 'string' ? id.slice(0, 60) : (typeof valor === 'string' ? valor.slice(0, 60) : valor === undefined ? null : String(typeof valor)));
  const recusa = () => recusaDaPeca(`estilo: ${mostrar} não é um estilo do catálogo nem um estilo próprio desta empresa. Nada foi alterado.`);
  if (typeof id !== 'string' || (origem !== undefined && !ORIGENS.includes(origem))) throw recusa();
  // codigo null: pasta ainda sem nenhuma empresa (só o catálogo vale)
  const c = codigo === null ? null : empresaMod.caminhos(codigo, r);
  const ordem = (origem ? [origem] : ORIGENS).filter((o) => c || o === 'catalogo');
  for (const o of ordem) {
    const y = lerEstilo(c, id, o);
    if (y) return { id, origem: o, nome: limparNome(y.nome) || id };
  }
  throw recusa();
}

// ---------- linha de comando (para o agente) ----------

function texto(codigo, e) {
  if (!e) return 'Sem estilo escolhido (ou o estilo escolhido não existe mais): a linha segue como sempre.';
  const linhas = [`Estilo da empresa: ${e.nome} (${e.id}, ${e.origem === 'proprio' ? 'estilo próprio da empresa' : 'do catálogo'}).`];
  linhas.push(e.carrossel
    ? `Carrossel: --estilo ${e.id} --cores marca${e.origem === 'proprio' ? ' (o gerador lê o estilo da pasta de estilos próprios da empresa)' : ''}.`
    : 'Carrossel: este estilo não tem carrossel; use o estilo da linha.');
  linhas.push(e.reels
    ? `Reels: modelo ${e.reels.modelo}, pedido com "usarMarca": true${e.reels.layout ? ` e "rosto": { "layout": "${e.reels.layout}" }` : ''}, comando com FABRICA_EMPRESA=${codigo}.`
    : 'Reels: este estilo não tem modelo de vídeo; use o modelo da linha.');
  return linhas.join('\n');
}

function principal(args) {
  const pos = args.filter((a) => !a.startsWith('--'));
  const opcoes = args.filter((a) => a.startsWith('--'));
  if (pos.length !== 1 || opcoes.some((o) => o !== '--json') || opcoes.length > 1) {
    console.error('Uso: node _fabrica/core/estilo-da-linha.js <codigo> [--json]');
    return 2;
  }
  const r = empresaMod.raiz();
  const codigo = pos[0];
  let e;
  try {
    e = daEmpresa(r, codigo);
  } catch (err) {
    if (err.recusaDoPedido || ['JSON_INVALIDO', 'EMPRESA_DESCONHECIDA', 'CODIGO_INVALIDO'].includes(err.code)) {
      console.error('RECUSADO  ' + err.message);
      return 1;
    }
    throw err;
  }
  if (opcoes.includes('--json')) { console.log(JSON.stringify(e, null, 2)); return 0; }
  let semEstilo = '';
  if (!e) { try { if (escolha.ler(r, codigo)) semEstilo = ' O estilo escolhido não existe mais no catálogo nem nos estilos próprios da empresa.'; } catch { /* já tratado acima */ } }
  console.log(texto(codigo, e) + semEstilo);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (err) {
    console.error('ERRO  inesperado: ' + err.message);
    process.exitCode = 2;
  }
}

module.exports = { daEmpresa, daPeca, limparNome, CATALOGO, MODELOS };
