// Downloads das ferramentas da Fábrica: consulta JSON, download com andamento e conferência por SHA-256.
// Usado pelo ferramentas.js e pelo compilar-whisper.js (fica num arquivo próprio para os dois não dependerem um do outro).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CAB = { 'User-Agent': 'fabrica-de-conteudo', Accept: 'application/vnd.github+json' };

/** A mensagem do erro com a causa (o "fetch failed" do Node esconde o motivo em e.cause: ECONNRESET, ETIMEDOUT...). */
function descreverErro(e) {
  const c = e && e.cause;
  const det = c ? [c.code, c.message, c.cause && (c.cause.code || c.cause.message)].filter(Boolean).join(': ') : '';
  return det && !String(e.message).includes(det) ? `${e.message} (${det})` : String(e && e.message);
}
/** Falha de internet (vale tentar de novo), e não resposta do servidor como "HTTP 404". */
const erroDeRede = (e) => /fetch failed|terminated|download incompleto|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR|socket/i
  .test(descreverErro(e)) && !/HTTP \d{3}/.test(String(e && e.message));
/** Roda `fn` e, se a internet falhar, tenta de novo (espera um pouco mais a cada vez). */
async function comTentativas(fn, { tentativas = 3, espera = 3000, rotulo = '', log = console.log } = {}) {
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      if (!erroDeRede(e)) throw e;
      if (i >= tentativas) throw new Error(descreverErro(e));
      log(`  a internet falhou${rotulo ? ' em ' + rotulo : ''} (${descreverErro(e)}); tentando de novo (${i + 1} de ${tentativas})`);
      await new Promise((ok) => setTimeout(ok, espera * i));
    }
  }
}

/** Cabeçalhos da consulta: com GITHUB_TOKEN (ou GH_TOKEN) no ambiente, a chave vai, e só para a consulta do GitHub
 *  (sem chave, o GitHub limita a 60 consultas por hora por endereço de internet). */
function cabecalhos(url, env = process.env) {
  const chave = env.GITHUB_TOKEN || env.GH_TOKEN;
  let host = '';
  try { host = new URL(url).host; } catch { /* endereço inválido: sem chave */ }
  return host === 'api.github.com' && chave ? { ...CAB, Authorization: 'Bearer ' + chave } : { ...CAB };
}

async function json(url) {
  return comTentativas(async () => {
    const r = await fetch(url, { headers: cabecalhos(url) });
    if (!r.ok) throw new Error(`não consegui consultar ${url} (HTTP ${r.status})`);
    return r.json();
  }, { rotulo: 'a consulta de versões' });
}

async function texto(url) {
  return comTentativas(async () => {
    const r = await fetch(url, { headers: { 'User-Agent': CAB['User-Agent'] }, redirect: 'follow' });
    if (!r.ok) throw new Error(`não consegui ler ${url} (HTTP ${r.status})`);
    return r.text();
  }, { rotulo: 'a conferência do download' });
}

async function baixar(url, destino, rotulo) {
  return comTentativas(() => baixarUmaVez(url, destino, rotulo), { rotulo: rotulo || path.basename(destino) });
}

async function baixarUmaVez(url, destino, rotulo) {
  const r = await fetch(url, { headers: { 'User-Agent': CAB['User-Agent'] }, redirect: 'follow' });
  if (!r.ok) throw new Error(`não consegui baixar ${rotulo || url} (HTTP ${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = destino + '.parte';
  const out = fs.createWriteStream(tmp);
  let lido = 0, marco = 0;
  const t0 = Date.now();
  try {
    for await (const pedaco of r.body) {
      lido += pedaco.length;
      if (!out.write(pedaco)) await new Promise((ok) => out.once('drain', ok));
      if (total && lido / total >= marco + 0.25) { marco = Math.floor((lido / total) * 4) / 4; console.log(`  ${rotulo || path.basename(destino)}: ${Math.round(marco * 100)}%`); }
    }
    await new Promise((ok, erro) => out.end((e) => (e ? erro(e) : ok())));
  } catch (e) { out.destroy(); fs.rmSync(tmp, { force: true }); throw e; }
  if (total && lido !== total) { fs.rmSync(tmp, { force: true }); throw new Error(`download incompleto de ${rotulo || url} (${lido} de ${total} bytes)`); }
  fs.renameSync(tmp, destino);
  console.log(`  ${rotulo || path.basename(destino)}: baixado (${Math.round(lido / 1048576)} MB em ${Math.round((Date.now() - t0) / 1000)} s)`);
}

/** Conteúdo de um .sha256 ("<hash>  <arquivo>" ou só o hash) -> hash em minúsculas, ou null. */
function lerSha(conteudo) {
  const m = String(conteudo || '').trim().match(/^([0-9a-fA-F]{64})\b/);
  return m ? m[1].toLowerCase() : null;
}
/** Numa lista de várias linhas "<hash>  <arquivo>", o hash do arquivo pedido (ou null). */
function shaDaLista(conteudo, nome) {
  for (const l of String(conteudo || '').split(/\r?\n/)) {
    const m = l.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (m && m[2].trim() === nome) return m[1].toLowerCase();
  }
  return null;
}
const sha256Arquivo = (arq) => crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');

/** Baixa e confere: o arquivo só fica se o SHA-256 bater com o esperado. */
async function baixarConferido(url, destino, esperado, rotulo) {
  await baixar(url, destino, rotulo);
  if (!esperado || sha256Arquivo(destino) !== esperado) {
    fs.rmSync(destino, { force: true });
    throw new Error(`o arquivo baixado (${rotulo || path.basename(destino)}) não confere com a conferência oficial; baixe de novo`);
  }
}

module.exports = { CAB, json, texto, baixar, baixarConferido, lerSha, shaDaLista, sha256Arquivo, comTentativas, descreverErro, cabecalhos };
