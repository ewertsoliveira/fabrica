// Dados dos painéis (Laboratório de Design e Cronograma): onde ficam os arquivos, como ler e gravar com segurança
// e como conferir uma peça ou um post antes de guardar. Só usa o Node.
'use strict';
const fs = require('fs');
const path = require('path');
const empresa = require('../core/empresa');

const TIPOS = ['capa', 'carrossel', 'post', 'card', 'thumb', 'video', 'outro'];
const PLATAFORMAS = ['insta', 'yt', 'linkedin', 'blog'];

// A pasta da empresa. FABRICA_RAIZ existe para os testes e para rodar fora do lugar de sempre.
function raiz() {
  return process.env.FABRICA_RAIZ || path.resolve(__dirname, '..', '..');
}

// Onde ficam os arquivos dos painéis de UMA empresa. Os caminhos vêm do leitor de empresas (_fabrica/core/empresa.js):
// na pasta antiga (empresa "principal") são os de sempre (04-LABORATORIO-DE-DESIGN/dados e 03-CRONOGRAMA/dados); numa
// empresa nova ficam dentro da pasta dela. Sem código vale a empresa ativa (recusa com EMPRESA_NAO_ESCOLHIDA se houver
// várias e nenhuma escolhida). Código vazio, com "../" ou que não existe recusa com EMPRESA_DESCONHECIDA antes de
// montar qualquer caminho. Só calcula: não cria pasta nenhuma.
// Pasta ainda sem nenhuma empresa (nem marca): valem os caminhos de sempre, para o primeiro painel poder nascer.
function caminhos(r, codigo) {
  const escolhido = codigo === undefined || codigo === null ? empresa.ativa(r) : codigo;
  let lab;
  let cro;
  let publicacoes;
  let saidasRaiz;
  let saidas;
  if (escolhido === null) {
    lab = path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados');
    cro = path.join(r, '03-CRONOGRAMA', 'dados');
    publicacoes = path.join(r, '02-PUBLICACOES');
    saidasRaiz = null;
    saidas = (linha) => path.join(r, 'linhas', linha, 'saida');
  } else {
    ({ laboratorio: lab, cronograma: cro, publicacoes, saidasRaiz, saidas } = empresa.caminhos(escolhido, r));
  }
  return {
    codigo: escolhido,
    publicacoes,
    saidasRaiz, // null na pasta antiga: lá as saídas ficam em linhas/<linha>/saida
    saidas,
    pecas: path.join(lab, 'laboratorio.json'),
    aprovacoes: path.join(lab, 'aprovacoes.json'),
    posts: path.join(cro, 'posts.json'),
    config: path.join(cro, 'config.json'),
    // As pastas dos painéis (um nível acima de dados/): o COMO-ACESSAR.md de cada painel fica nelas.
    pastaLaboratorio: path.dirname(lab),
    pastaCronograma: path.dirname(cro),
  };
}

// Arquivo ausente devolve o padrão. JSON quebrado (vírgula sobrando, editado à mão) lança erro com código
// JSON_INVALIDO: quem chama avisa a pessoa e NÃO grava por cima.
function lerJson(arq, padrao) {
  let texto;
  try {
    texto = fs.readFileSync(arq, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return padrao;
    throw e;
  }
  try {
    return JSON.parse(texto.replace(/^﻿/, ''));
  } catch (e) {
    const erro = new Error(`O arquivo ${arq} não está em um formato válido (${e.message}).`);
    erro.code = 'JSON_INVALIDO';
    erro.arquivo = arq;
    throw erro;
  }
}

// Grava num arquivo temporário e troca de nome: se der problema no meio, o arquivo antigo continua inteiro.
function gravarJson(arq, valor) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arq);
}

const texto = (v) => typeof v === 'string' && v.trim() !== '';
const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Caminho relativo à pasta da Fábrica, sem subir de pasta e sem ser absoluto.
function caminhoRelativoSeguro(p) {
  if (!texto(p)) return false;
  if (path.isAbsolute(p) || path.win32.isAbsolute(p) || /^[A-Za-z]:/.test(p) || p.startsWith('/') || p.startsWith('\\')) return false;
  return !p.split(/[\\/]+/).includes('..');
}

// O caminho pertence a esta empresa? Numa empresa com pasta própria, só vale o que está em empresas/<codigo>/. Na pasta
// antiga (empresa "principal", ou pasta ainda sem empresa, codigo null), vale tudo o que não esteja em empresas/ ou o que
// esteja em empresas/principal/: pasta de outra empresa nunca. Compara sem diferença de maiúsculas e sem ponto ou espaço
// no fim de cada nome de pasta, porque o Windows trata "Boreal." e "boreal" como a mesma pasta.
// Com `r` (a raiz da Fábrica), a principal que já foi organizada (pasta própria, empresas/principal/) passa a valer como
// as outras: só o que está em empresas/principal/. Sem `r`, ou na pasta antiga, a regra é a de sempre.
function pertenceAEmpresa(p, codigo, r) {
  if (!texto(p)) return false;
  const partes = p.split(/[\\/]+/).map((x) => x.replace(/[. ]+$/, '').toLowerCase()).filter(Boolean);
  const meu = codigo === null || codigo === undefined ? 'principal' : String(codigo).toLowerCase();
  if (partes[0] === 'empresas') return partes.length > 1 && partes[1] === meu;
  return meu === 'principal' && !principalOrganizada(r);
}
// A principal está na pasta própria dela? Lista de empresas ilegível: a regra de sempre (o registro recusa por ela).
function principalOrganizada(r) {
  if (!r) return false;
  try {
    const e = empresa.listar(r).find((x) => x.codigo === 'principal');
    return !!(e && e.disposicao === 'gaveta');
  } catch {
    return false;
  }
}

const foraDaEmpresa = (campo, valor, codigo, r) => {
  const principal = codigo === null || codigo === undefined || codigo === 'principal';
  const onde = principal && !principalOrganizada(r) ? ', e não em empresas/<outra empresa>/' : ` (empresas/${principal ? 'principal' : codigo}/)`;
  return `${campo}: este caminho é de outra empresa ou de outro lugar (${valor}). Ele precisa estar nos arquivos desta empresa${onde}.`;
};

// `r` (opcional): a raiz, para a regra da principal organizada (ver pertenceAEmpresa).
function validarPeca(p, codigo, r) {
  if (!objeto(p)) return ['a peça precisa ser um objeto com id, name, path e tipo'];
  const erros = [];
  if (!texto(p.id)) erros.push('id: obrigatório (texto)');
  if (!texto(p.name)) erros.push('name: obrigatório (texto)');
  if (!texto(p.path)) erros.push('path: obrigatório (caminho do preview.html)');
  else if (!caminhoRelativoSeguro(p.path)) erros.push('path: precisa ser relativo à pasta da Fábrica e sem ".."');
  else if (codigo !== undefined && !pertenceAEmpresa(p.path, codigo, r)) erros.push(foraDaEmpresa('path', p.path, codigo, r));
  if (!TIPOS.includes(p.tipo)) erros.push(`tipo: obrigatório, um destes: ${TIPOS.join(', ')}`);
  if (p.desc !== undefined && typeof p.desc !== 'string') erros.push('desc: precisa ser texto');
  if (p.postId !== undefined && typeof p.postId !== 'string') erros.push('postId: precisa ser texto');
  if (p.video !== undefined && typeof p.video !== 'string') erros.push('video: precisa ser texto');
  if (p.pasta !== undefined && !caminhoRelativoSeguro(p.pasta)) erros.push('pasta: precisa ser relativa à pasta da Fábrica e sem ".."');
  else if (p.pasta !== undefined && codigo !== undefined && !pertenceAEmpresa(p.pasta, codigo, r)) erros.push(foraDaEmpresa('pasta', p.pasta, codigo, r));
  if (p.nomesArquivos !== undefined && (!Array.isArray(p.nomesArquivos) || p.nomesArquivos.some((n) => typeof n !== 'string'))) {
    erros.push('nomesArquivos: precisa ser uma lista de textos');
  }
  return erros;
}

function dataValida(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function validarPost(p) {
  if (!objeto(p)) return ['o post precisa ser um objeto com id, date, platform e title'];
  const erros = [];
  if (!texto(p.id)) erros.push('id: obrigatório (texto)');
  if (!texto(p.date) || !dataValida(p.date)) erros.push('date: obrigatória, no formato AAAA-MM-DD (por exemplo 2026-10-16)');
  if (!PLATAFORMAS.includes(p.platform)) erros.push(`platform: obrigatória, uma destas: ${PLATAFORMAS.join(', ')}`);
  if (!texto(p.title)) erros.push('title: obrigatório (texto)');
  for (const campo of ['week', 'dateLabel', 'platformLabel', 'cta', 'hook', 'previewUrl', 'script', 'caption', 'tips', 'presenter', 'video', 'cabecalho', 'geral']) {
    if (p[campo] !== undefined && typeof p[campo] !== 'string') erros.push(`${campo}: precisa ser texto`);
  }
  if (p.images !== undefined && (!Array.isArray(p.images) || p.images.some((n) => typeof n !== 'string'))) erros.push('images: precisa ser uma lista de textos');
  if (p.cenas !== undefined && !Array.isArray(p.cenas)) erros.push('cenas: precisa ser uma lista');
  return erros;
}

module.exports = { raiz, caminhos, lerJson, gravarJson, TIPOS, PLATAFORMAS, validarPeca, validarPost, pertenceAEmpresa, caminhoRelativoSeguro };
