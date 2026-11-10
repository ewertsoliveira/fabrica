// Tema da marca para os modelos de Reels: as quatro cores por papel e as letras da empresa, vindas do pedido ou do
// contrato de marca (marca.yaml). Cada modelo troca só a paleta do estilo (os papéis escuro, claro, acento e neutro) e
// as suas letras; branco, preto e cinzas fixos continuam como estão. Sem marca no pedido, o tema é null e o modelo fica
// exatamente como é hoje.
//
// Uso:
//   const temaMarca = require('./tema-marca');
//   const tema = temaMarca.resolver(pedido, { base })   // null | { cores, fontes, principalItalico, origem }
//   temaMarca.cor(tema, 'acento', '#RRGGBB')           // a cor da marca nesse papel, ou o padrão do modelo
//   temaMarca.fonte(tema, 'principal', 'Arquivo.ttf')  // a letra da marca nesse papel, ou o padrão do modelo
//   temaMarca.letra(P, tema, 'principal', entrada)     // { fonte, est } para uma entrada de fonte do modelo, ou null
//   temaMarca.contrasteOk(a, b, 3)                     // razão de contraste WCAG >= mínimo (hex ou cor do Tesseract)
//
// O módulo não guarda estado entre pedidos: cada chamada devolve um tema novo, e o leitor de marca (marca.js) só é
// carregado quando o pedido diz "usarMarca": true (injetável por opção, para teste).
'use strict';
const fs = require('fs');
const path = require('path');

const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const PAPEIS_FONTE = ['principal', 'mono', 'acento'];
const FONTES = path.join(__dirname, 'fontes');
// pesos por nome de estilo (a mesma tabela do fontes.js, que não é carregado aqui porque lê a marca ao ser carregado)
const PESOS = { Thin: 100, ExtraLight: 200, Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800, Black: 900 };

const erro = (msg) => new Error('marca: ' + msg);

function confereCor(papel) {
  if (!PAPEIS_COR.includes(papel)) throw erro(`papel de cor desconhecido "${papel}" (papéis: ${PAPEIS_COR.join(', ')})`);
}
function confereFonte(papel) {
  if (!PAPEIS_FONTE.includes(papel)) throw erro(`papel de letra desconhecido "${papel}" (papéis: ${PAPEIS_FONTE.join(', ')})`);
}

// '#rrggbb' ou 'rrggbb' -> '#RRGGBB'; outro valor -> erro citando o campo
function normalizaHex(v, campo) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(v ?? ''));
  if (!m) throw erro(`${campo} inválida (${JSON.stringify(v)}): use "#RRGGBB"`);
  return '#' + m[1].toUpperCase();
}

// arquivo de letra: absoluto, ou relativo à pasta do pedido (base) e depois a modelos/fontes/
function achaLetra(v, campo, base) {
  if (typeof v !== 'string' || !v.trim()) throw erro(`${campo} vazio: informe o arquivo .ttf ou .otf`);
  if (!/\.(ttf|otf)$/i.test(v)) throw erro(`${campo} precisa ser um arquivo .ttf ou .otf (veio ${JSON.stringify(v)})`);
  const candidatos = path.isAbsolute(v) ? [v] : [base && path.resolve(base, v), path.join(FONTES, v)].filter(Boolean);
  const achado = candidatos.find((c) => fs.existsSync(c));
  if (!achado) throw erro(`${campo}: arquivo de letra não encontrado (${v})`);
  return path.resolve(achado);
}

const informado = (v) => v !== undefined && v !== null && v !== '';
const vazio = () => ({ cores: { escuro: null, claro: null, acento: null, neutro: null }, fontes: { principal: null, mono: null, acento: null }, principalItalico: false });

// do pedido: { cores?, fontes?, acento? (antigo, vale como cores.acento) }; o que faltar fica null (o modelo completa)
function doPedido(m, base) {
  const tema = vazio();
  const cores = { ...(m.cores || {}) };
  if (informado(m.acento) && !informado(cores.acento)) cores.acento = m.acento;
  // vazio ou null = não informado (fica o papel do modelo); o papel é conferido mesmo assim
  for (const [k, v] of Object.entries(cores)) { confereCor(k); if (informado(v)) tema.cores[k] = normalizaHex(v, `cores.${k}`); }
  for (const [k, v] of Object.entries(m.fontes || {})) {
    if (k === 'principalItalico') { tema.principalItalico = v === true; continue; }
    confereFonte(k);
    if (informado(v)) tema.fontes[k] = achaLetra(v, `fontes.${k}`, base);
  }
  return tema;
}

// do contrato de marca: as quatro cores e as letras principal, mono e (se houver) acento. Com usarMarca, letra ausente,
// inválida ou fora da pasta da empresa não aborta o vídeo (antes, usarMarca só trocava a cor): o papel fica null (o modelo
// usa a letra dele) e sai UM aviso no log com todos os problemas; as cores continuam valendo.
function daMarca(marcaMod) {
  const tema = vazio();
  for (const k of PAPEIS_COR) tema.cores[k] = normalizaHex(marcaMod.hex(k), `cores.${k}`);
  const problemas = [];
  for (const k of PAPEIS_FONTE) {
    try {
      const rel = marcaMod.pega(`tipografia.${k}.arquivo`, '');
      if (!rel) {
        if (k !== 'acento') problemas.push(`tipografia.${k}.arquivo ausente no marca.yaml`);
        continue;
      }
      const abs = marcaMod.caminho(rel);
      if (!abs || !fs.existsSync(abs)) { problemas.push(`tipografia.${k}: arquivo de letra não encontrado (${rel})`); continue; }
      if (!/\.(ttf|otf)$/i.test(abs)) { problemas.push(`tipografia.${k} precisa ser um arquivo .ttf ou .otf (veio ${JSON.stringify(rel)})`); continue; }
      tema.fontes[k] = path.resolve(abs);
    } catch (e) {
      problemas.push(`tipografia.${k}: ${e.message}`); // ex.: CAMINHO_FORA_DA_EMPRESA do marca.caminho
    }
  }
  if (problemas.length) console.warn(`marca: ${problemas.join('; ')}. Nesses papéis, o modelo usa as letras dele.`);
  tema.principalItalico = marcaMod.pega('tipografia.principal.italico', false) === true;
  return tema;
}

function resolver(pedido, { marcaMod, base } = {}) {
  const m = pedido && pedido.marca;
  const temAlgo = m && typeof m === 'object' && (m.cores || m.fontes || informado(m.acento));
  if (temAlgo) {
    const tema = doPedido(m, base);
    const vazioTudo = Object.values(tema.cores).every((v) => !v) && Object.values(tema.fontes).every((v) => !v);
    if (!vazioTudo) return { ...tema, origem: 'pedido' }; // { cores: {} } não traz nada: é o mesmo que sem marca no pedido
  }
  if (pedido && pedido.usarMarca) { // qualquer valor verdadeiro, como antes
    try {
      const mod = marcaMod || require('../../marca/marca'); // só agora: sem usarMarca, a marca da empresa nem é lida
      return { ...daMarca(mod), origem: 'marca' };
    } catch (e) {
      // o erro do leitor de marca (empresa não escolhida, caminho fora da empresa...) sai como uma linha "marca: ...", sem pilha
      if (/^marca: /.test(e.message)) throw e;
      throw Object.assign(erro(e.message), { code: e.code });
    }
  }
  return null;
}

const cor = (tema, papel, padrao) => { confereCor(papel); return (tema && tema.cores[papel]) || padrao; };
const fonte = (tema, papel, padrao) => { confereFonte(papel); return (tema && tema.fontes[papel]) || padrao; };

// ---------- contraste (WCAG 2) ----------
function rgb(c) {
  if (Array.isArray(c)) return c.slice(0, 3);
  const h = normalizaHex(c, 'cor');
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}
const luminancia = (c) => {
  const [r, g, b] = rgb(c).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const contrasteOk = (a, b, minimo = 3) => contraste(a, b) >= minimo;

// ---------- peso e itálico ----------
// peso de um nome de estilo ("ExtraBold", "SemiBold Italic", "Italic" = 400)
function pesoDoEstilo(nome) {
  const s = String(nome || '').replace(/italic/i, '').replace(/\s+/g, '');
  if (!s) return 400;
  const k = Object.keys(PESOS).find((p) => p.toLowerCase() === s.toLowerCase());
  return k ? PESOS[k] : 400;
}
// peso pelo nome do arquivo de letra: "Familia-Black.ttf" = 900; sem peso no nome (letra variável) = 400
function pesoDoArquivo(arquivo) {
  const sufixo = path.basename(String(arquivo)).replace(/\.(ttf|otf)$/i, '').split('-').slice(1).join('');
  return pesoDoEstilo(sufixo);
}
// estilo mais próximo do peso pedido (número ou nome) entre os que a letra importada tem (fonte.estilos, ou só fonte.style).
// Com { italico: true }, prefere os estilos itálicos; sem, os retos; se a letra não tem do tipo pedido, vale qualquer um.
function estiloMaisProximo(pedido, fonteImp, { italico = false } = {}) {
  const todos = (fonteImp.estilos && fonteImp.estilos.length ? fonteImp.estilos : [fonteImp.style]).filter(Boolean);
  if (!todos.length) return fonteImp.style || 'Regular';
  const doTipo = todos.filter((s) => /italic/i.test(s) === italico);
  const lista = doTipo.length ? doTipo : todos;
  const alvo = typeof pedido === 'number' ? pedido : pesoDoEstilo(pedido);
  return [...lista].sort((a, b) => Math.abs(pesoDoEstilo(a) - alvo) - Math.abs(pesoDoEstilo(b) - alvo) || pesoDoEstilo(b) - pesoDoEstilo(a))[0];
}
// a letra principal da marca tem itálico? pelo nome do arquivo, pela face importada ou pelo aviso do pedido/marca. O aviso
// (principalItalico / tipografia.principal.italico) é ignorado, com aviso no log, quando a letra importada mostra que o
// arquivo não tem face itálica: o destaque em itálico cai então na letra de acento da marca ou na do estilo
function temItalico(tema, fonteImp) {
  if (!tema) return false;
  if (tema.fontes.principal && /italic/i.test(path.basename(tema.fontes.principal))) return true;
  if (fonteImp && (fonteImp.italico || (fonteImp.estilos || []).some((s) => /italic/i.test(s)))) return true;
  if (!tema.principalItalico) return false;
  if (fonteImp && fonteImp.italico === false) {
    console.warn(`marca: a letra principal (${path.basename(tema.fontes.principal || '')}) não tem face itálica; o aviso de itálico foi ignorado e o destaque em itálico usa a letra de acento ou a do estilo.`);
    return false;
  }
  return true;
}

// letra da marca no papel pedido para uma entrada de fonte do modelo ({ arquivo, style?, size, tracking?, allCaps?, wdth? }):
// o arquivo vira o da marca e o estilo, o mais próximo do peso que o modelo pedia (para uma letra de um peso só, o próprio).
// O eixo de largura (wdth) é da letra do modelo e sai. Sem letra da marca nesse papel, devolve null (fica a do modelo).
function letra(P, tema, papel, e, { italico } = {}) {
  confereFonte(papel);
  const arq = tema && tema.fontes[papel];
  if (!arq) return null;
  const f = P.fonte(arq);
  const peso = e.style ? pesoDoEstilo(e.style) : pesoDoArquivo(e.arquivo);
  const querItalico = italico ?? (e.style ? /italic/i.test(e.style) : /italic/i.test(path.basename(e.arquivo)));
  const { wdth, ...resto } = e;
  return { fonte: f, est: { ...resto, arquivo: arq, style: estiloMaisProximo(peso, f, { italico: querItalico }) }, daMarca: true };
}

module.exports = { PAPEIS_COR, PAPEIS_FONTE, PESOS, resolver, cor, fonte, letra, contraste, contrasteOk, pesoDoEstilo, pesoDoArquivo,
  estiloMaisProximo, temItalico };
