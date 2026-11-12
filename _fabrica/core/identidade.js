#!/usr/bin/env node
// O que a empresa já tem de identidade visual, em linguagem simples, para a Fábrica mostrar ANTES de perguntar se a
// peça vai usar essa identidade (regra L-01 do Núcleo). Junta, sem gravar nada:
//   - a marca (marca.yaml da empresa): as quatro cores, as letras (pelo nome do arquivo) e se tem logo;
//   - o estilo escolhido (estilo.json, pelo estilo-da-linha.js): nome e se tem modelo de Reels;
//   - o estilo de vídeo (estilo-de-video.md): se existe e se foi a edição rápida ou a entrevista;
//   - as peças já registradas no Laboratório (laboratorio.json): quantas e em quais estilos.
// E devolve uma recomendação: com marca, usar a identidade; sem marca e com estilo, usar o estilo (ou criar a marca a
// partir dele); sem nada, criar a identidade.
//
//   node _fabrica/core/identidade.js <codigo> [--json]
//   Saída 0 (com ou sem identidade), 1 recusa (empresa inválida ou arquivo da empresa quebrado), 2 uso.
'use strict';
const fs = require('fs');
const path = require('path');
const empresaMod = require('./empresa');
const estiloDaLinha = require('./estilo-da-linha');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');

const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const NOMES_COR = { escuro: 'cor escura', claro: 'cor clara', acento: 'cor de destaque', neutro: 'cor de apoio' };
const NOMES_LETRA = { principal: 'títulos e legendas', mono: 'rótulos pequenos', acento: 'destaques' };

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.lstatSync(p).isFile(); } catch { return false; } };
const recusa = (msg, code = 'ARQUIVO_QUEBRADO') => Object.assign(new Error(msg), { code });

// "MinhaLetra-Regular.ttf" -> "Minha Letra"; "Letra[wght].ttf" -> "Letra". Só o nome que a pessoa reconhece.
function nomeDaLetra(arquivo) {
  if (typeof arquivo !== 'string' || !arquivo.trim()) return null;
  let n = path.basename(arquivo.trim().replace(/\\/g, '/')).replace(/\.(ttf|otf|woff2?)$/i, '');
  n = n.replace(/\[[^\]]*\]/g, '').replace(/[-_](Regular|Variable|VariableFont.*|Italic|Bold|Medium|Light|SemiBold|Black)$/i, '');
  n = n.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  return n || null;
}

function lerMarca(c) {
  if (!ehArquivo(c.marca)) return null;
  let y;
  try {
    y = lerYaml(fs.readFileSync(c.marca, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw recusa(`O arquivo da marca (${c.marca}) está com um erro de formato (${e.message}). Nada foi alterado.`);
  }
  if (!ehObjeto(y)) throw recusa(`O arquivo da marca (${c.marca}) está vazio ou fora do formato. Nada foi alterado.`);
  const cores = {};
  const cy = ehObjeto(y.cores) ? y.cores : {};
  for (const p of PAPEIS_COR) if (typeof cy[p] === 'string' && HEX.test(cy[p].trim())) cores[p] = cy[p].trim().toUpperCase();
  const letras = {};
  const ty = ehObjeto(y.tipografia) ? y.tipografia : {};
  for (const p of Object.keys(NOMES_LETRA)) {
    const n = ehObjeto(ty[p]) ? nomeDaLetra(ty[p].arquivo) : null;
    if (n) letras[p] = n;
  }
  const pecas = ehObjeto(y.pecas) ? y.pecas : {};
  const nome = ehObjeto(y.empresa) && typeof y.empresa.nome === 'string' ? y.empresa.nome.trim() : '';
  return {
    nome: nome || null,
    cores,
    letras,
    logo: typeof pecas.logo === 'string' && pecas.logo.trim() !== '',
    origem: typeof y.origem === 'string' ? y.origem : null,
  };
}

function lerEstiloDeVideo(c) {
  if (!ehArquivo(c.estiloDeVideo)) return null;
  const t = fs.readFileSync(c.estiloDeVideo, 'utf8');
  return { tipo: /Padrão rápido, sem entrevista/i.test(t) ? 'rapido' : 'personalizado' };
}

// As peças do Laboratório: quantas e quantas por estilo (pelo nome guardado na peça).
function lerPecas(c) {
  const arq = path.join(c.laboratorio, 'laboratorio.json');
  if (!ehArquivo(arq)) return { total: 0, porEstilo: {} };
  let j;
  try {
    j = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw recusa(`O arquivo das peças (${arq}) está com um erro de formato (${e.message}). Nada foi alterado.`, 'JSON_INVALIDO');
  }
  const lista = Array.isArray(j) ? j : (ehObjeto(j) && Array.isArray(j.pecas) ? j.pecas : []);
  const porEstilo = {};
  for (const p of lista) {
    const n = ehObjeto(p) && ehObjeto(p.estilo) && typeof p.estilo.nome === 'string' ? estiloDaLinha.limparNome(p.estilo.nome) : '';
    if (n) porEstilo[n] = (porEstilo[n] || 0) + 1;
  }
  return { total: lista.length, porEstilo };
}

// Recomendação: 'usar-identidade' (tem marca), 'usar-estilo' (sem marca, com estilo escolhido), 'criar-identidade'.
function recomendar(marca, estilo) {
  if (marca && Object.keys(marca.cores).length > 0) return 'usar-identidade';
  if (estilo) return 'usar-estilo';
  return 'criar-identidade';
}

function daEmpresa(r, codigo) {
  const c = empresaMod.caminhos(codigo, r);
  const marca = lerMarca(c);
  const e = estiloDaLinha.daEmpresa(r, codigo);
  const estilo = e ? { id: e.id, nome: e.nome, origem: e.origem, temReels: Boolean(e.reels) } : null;
  return {
    codigo,
    marca,
    estilo,
    estiloDeVideo: lerEstiloDeVideo(c),
    pecas: lerPecas(c),
    recomendacao: recomendar(marca, estilo),
  };
}

// O resumo para a pessoa: sem código, sem nome de arquivo, sem termo técnico.
function texto(nomeEmpresa, i) {
  const l = [`O que ${nomeEmpresa} já tem de identidade visual:`];
  if (i.marca && Object.keys(i.marca.cores).length > 0) {
    l.push('- Cores: ' + PAPEIS_COR.filter((p) => i.marca.cores[p]).map((p) => `${i.marca.cores[p]} (${NOMES_COR[p]})`).join(', ') + '.');
    const ls = Object.keys(NOMES_LETRA).filter((p) => i.marca.letras[p]);
    l.push(ls.length ? '- Letras: ' + ls.map((p) => `${i.marca.letras[p]} (${NOMES_LETRA[p]})`).join(', ') + '.' : '- Letras: ainda não escolhidas.');
    l.push(i.marca.logo ? '- Logo: tem.' : '- Logo: ainda não tem.');
  } else {
    l.push('- Cores e letras: ainda não definidas.');
  }
  if (i.estilo) l.push(`- Estilo escolhido: ${i.estilo.nome}${i.estilo.temReels ? ' (tem um jeito próprio de montar vídeo)' : ''}.`);
  else l.push('- Estilo escolhido: nenhum ainda.');
  if (i.pecas.total > 0) {
    const est = Object.entries(i.pecas.porEstilo).sort((a, b) => b[1] - a[1]).map(([n, q]) => `${q} no estilo ${n}`);
    l.push(`- Peças já feitas: ${i.pecas.total}${est.length ? ` (${est.join(', ')})` : ''}.`);
  } else {
    l.push('- Peças já feitas: nenhuma registrada ainda.');
  }
  if (i.estiloDeVideo) l.push(`- Jeito dos vídeos: já definido (${i.estiloDeVideo.tipo === 'rapido' ? 'pela edição rápida' : 'pelas perguntas de estilo'}).`);
  else l.push('- Jeito dos vídeos: ainda não definido.');
  const rec = {
    'usar-identidade': i.pecas.total > 0
      ? 'Recomendação: usar essa identidade, para este conteúdo ficar com a mesma cara das suas outras peças.'
      : 'Recomendação: usar essa identidade, para todos os seus conteúdos saírem com a mesma cara.',
    'usar-estilo': `Recomendação: usar o estilo ${i.estilo ? i.estilo.nome : ''} com as cores dele, ou criar a identidade a partir dele.`,
    'criar-identidade': 'Recomendação: criar a identidade agora (uns 5 minutos, escolhendo pelo que você vê), para todas as peças saírem com a mesma cara.',
  }[i.recomendacao];
  l.push(rec);
  return l.join('\n');
}

function principal(args) {
  const pos = args.filter((a) => !a.startsWith('--'));
  const opcoes = args.filter((a) => a.startsWith('--'));
  if (pos.length !== 1 || opcoes.some((o) => o !== '--json') || opcoes.length > 1) {
    console.error('Uso: node _fabrica/core/identidade.js <codigo> [--json]');
    return 2;
  }
  const r = empresaMod.raiz();
  const codigo = pos[0];
  let i;
  let nome = codigo;
  try {
    i = daEmpresa(r, codigo);
    const entrada = empresaMod.listar(r).find((e) => e.codigo === codigo);
    nome = (i.marca && i.marca.nome) || (entrada && entrada.nome) || codigo;
  } catch (err) {
    if (err.recusaDoPedido || ['JSON_INVALIDO', 'EMPRESA_DESCONHECIDA', 'CODIGO_INVALIDO', 'ARQUIVO_QUEBRADO'].includes(err.code)) {
      console.error('RECUSADO  ' + err.message);
      return 1;
    }
    throw err;
  }
  if (opcoes.includes('--json')) { console.log(JSON.stringify(i, null, 2)); return 0; }
  console.log(texto(nome, i));
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

module.exports = { daEmpresa, texto, nomeDaLetra, recomendar };
