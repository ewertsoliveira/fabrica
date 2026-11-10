#!/usr/bin/env node
// Registra uma peça (Laboratório de Design) ou um post (Cronograma) numa empresa da Fábrica.
// O painel nasce junto com o primeiro conteúdo: antes disso, nada dele existe na pasta da empresa.
//
//   node _fabrica/paineis/registrar.js peca <arquivo.json | -> [--empresa <codigo>]
//   node _fabrica/paineis/registrar.js post <arquivo.json | -> [--empresa <codigo>]     ("-" lê da entrada padrão)
//
// Sem --empresa vale a empresa ativa. Com várias empresas e nenhuma escolhida, a conta recusa e pede --empresa.
// Registrar nunca troca a empresa ativa.
//
// A peça guarda o estilo com que foi feita (campo `estilo`: { id, origem, nome }): o que ela disser (código ou { id, origem },
// só do catálogo ou dos estilos próprios desta empresa; `"estilo": null` = feita sem estilo, sem o selo), senão o escolhido
// pela empresa (estilo.json). Quando o pedido trocou o estilo, ou não usou nenhum, o agente põe na peça o estilo usado ou
// null. Peça já registrada nunca ganha um estilo que não tinha, e as outras peças da lista não mudam. O Laboratório mostra
// "Feita no estilo X".
//
// Saída (uma linha de JSON): {"ok":true,"empresa":"<codigo>","painel":"laboratorio"|"cronograma","primeiraVez":bool,"comoAcessar":"<caminho>"}
// (mais "estilo":"<nome>" quando a peça guardou um estilo e "aviso" quando o estilo não pôde ser lido) ou {"ok":false,"erros":[...]}. Código: 0 ok, 1 conteúdo inválido, empresa inválida ou arquivo da empresa com defeito, 2 uso errado.
'use strict';
const fs = require('fs');
const path = require('path');
const dados = require('./dados');
const empresa = require('../core/empresa');
const { instalar } = require('./instalar');
const estiloDaLinha = require('../core/estilo-da-linha');

const saida = (obj, codigo) => { process.stdout.write(JSON.stringify(obj) + '\n'); process.exit(codigo); };
const recusar = (...erros) => saida({ ok: false, erros }, 1);
const uso = () => {
  console.error('uso: node _fabrica/paineis/registrar.js peca|post <arquivo.json|-> [--empresa <codigo>]');
  process.exit(2);
};

// --empresa <codigo> pode vir em qualquer posição; o resto são o tipo e a origem.
const argumentos = process.argv.slice(2);
let pedida = null;
const posicionais = [];
for (let i = 0; i < argumentos.length; i++) {
  if (argumentos[i] === '--empresa') {
    if (i + 1 >= argumentos.length || pedida !== null) uso();
    pedida = argumentos[++i];
  } else posicionais.push(argumentos[i]);
}
const [tipo, origem] = posicionais;
if (posicionais.length !== 2 || !['peca', 'post'].includes(tipo) || !origem) uso();

const r = dados.raiz();

// A empresa vem da lista da pasta, nunca direto do texto digitado: "../x", vazio ou desconhecido recusa antes de
// qualquer caminho ser montado.
function escolherEmpresa() {
  try {
    const lista = empresa.listar(r);
    const codigos = lista.map((e) => e.codigo);
    if (pedida !== null) {
      if (!codigos.includes(pedida)) {
        recusar(`A empresa ${JSON.stringify(pedida)} não existe nesta pasta. Empresas: ${codigos.length ? codigos.join(', ') : 'nenhuma'}. Nada foi alterado.`);
      }
      return pedida;
    }
    return empresa.ativa(r);
  } catch (e) {
    if (e.code === 'EMPRESA_NAO_ESCOLHIDA') {
      const codigos = empresa.listar(r).map((x) => x.codigo).join(', ');
      recusar(`Há mais de uma empresa nesta pasta (${codigos}) e nenhuma está escolhida. Diga de qual é com --empresa <codigo>. Nada foi alterado.`);
    }
    if (['EMPRESA_DESCONHECIDA', 'JSON_INVALIDO'].includes(e.code)) recusar(e.message);
    throw e;
  }
}

let item;
try {
  item = JSON.parse(fs.readFileSync(origem === '-' ? 0 : origem, 'utf8').replace(/^﻿/, ''));
} catch (e) {
  recusar(`Não consegui ler o conteúdo a registrar (${origem === '-' ? 'entrada padrão' : origem}): ${e.message}`);
}

const codigo = escolherEmpresa();
const c = dados.caminhos(r, codigo);
const ehPeca = tipo === 'peca';
const painel = ehPeca ? 'laboratorio' : 'cronograma';
const arqLista = ehPeca ? c.pecas : c.posts;

const erros = ehPeca ? dados.validarPeca(item, c.codigo, r) : dados.validarPost(item);
if (erros.length) recusar(...erros);

if (ehPeca) {
  const alvo = path.resolve(r, item.path);
  if (!fs.existsSync(alvo)) recusar(`O arquivo da peça não existe: ${item.path}. Gere o preview.html antes de registrar.`);
}

// Lê a lista ANTES de instalar ou gravar qualquer coisa: arquivo da empresa com defeito nunca é sobrescrito.
let lista;
try {
  lista = dados.lerJson(arqLista, []);
} catch (e) {
  if (e.code === 'JSON_INVALIDO') recusar(e.message + ' Nada foi alterado. Corrija o arquivo (ou peça ajuda ao agente) e registre de novo.');
  throw e;
}
if (!Array.isArray(lista)) recusar(`O arquivo ${arqLista} precisa ser uma lista. Nada foi alterado.`);
if (lista.some((x) => x === null || typeof x !== 'object' || Array.isArray(x))) {
  recusar(`O arquivo ${arqLista} tem um item que não é ${ehPeca ? 'uma peça' : 'um post'}. Nada foi alterado. Corrija o arquivo (ou peça ajuda ao agente) e registre de novo.`);
}

const i = lista.findIndex((x) => x && x.id === item.id);

// A peça guarda o estilo com que foi de fato feita ({ id, origem, nome }): o que ela diz (só do catálogo ou dos estilos
// próprios desta empresa; estilo de outra empresa nunca; `null` = feita sem estilo, e aí nem o da empresa entra), senão o
// que ela já tinha (a mesma peça registrada de novo nunca ganha um estilo que não tinha), senão o escolhido pela empresa
// agora (estilo.json), porque as linhas usam o estilo da empresa por padrão. Sem estilo, a peça entra como sempre, sem o
// campo. As outras peças da lista nunca são mexidas.
let aviso;
if (ehPeca) {
  if (item.estilo === null) {
    item = { ...item };
    delete item.estilo;
  } else if (item.estilo !== undefined) {
    try {
      item = { ...item, estilo: estiloDaLinha.daPeca(r, c.codigo, item.estilo) };
    } catch (e) {
      if (e.code === 'ESTILO_DA_PECA') recusar(e.message);
      throw e;
    }
  } else if (i >= 0) {
    // o nome guardado (o arquivo pode ter sido editado à mão) passa pela mesma limpeza do nome do estilo
    const antigo = lista[i].estilo;
    if (antigo !== undefined) {
      item = { ...item, estilo: antigo !== null && typeof antigo === 'object' && typeof antigo.nome === 'string' ? { ...antigo, nome: estiloDaLinha.limparNome(antigo.nome) } : antigo };
    }
  } else if (c.codigo !== null) {
    try {
      const e = estiloDaLinha.daEmpresa(r, c.codigo);
      if (e) item = { ...item, estilo: { id: e.id, origem: e.origem, nome: e.nome } };
    } catch (e) {
      if (e.code !== 'JSON_INVALIDO') throw e;
      aviso = 'A peça entrou sem o estilo: o arquivo do estilo escolhido desta empresa não está num formato válido (nada foi alterado nele).';
    }
  }
}

const primeiraVez = !fs.existsSync(arqLista);
instalar(painel, r, c.codigo);

if (ehPeca) {
  if (i >= 0) lista[i] = item; else lista.unshift(item); // regra L-04: peça nova entra no topo
} else {
  if (i >= 0) lista[i] = item; else lista.push(item);
  lista = lista.map((x, n) => ({ x, n })).sort((a, b) => String(a.x.date).localeCompare(String(b.x.date)) || a.n - b.n).map((o) => o.x);
}
dados.gravarJson(arqLista, lista);

const resposta = { ok: true, empresa: c.codigo, painel, primeiraVez, comoAcessar: path.join(ehPeca ? c.pastaLaboratorio : c.pastaCronograma, 'COMO-ACESSAR.md') };
if (ehPeca && item.estilo) resposta.estilo = item.estilo.nome;
if (aviso) resposta.aviso = aviso;
saida(resposta, 0);
