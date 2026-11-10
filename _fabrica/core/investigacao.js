#!/usr/bin/env node
// Apoio verificável da investigação de perfis (a parte determinística).
//
//   node _fabrica/core/investigacao.js plataforma <url>     detecta plataforma, tipo (perfil ou post) e usuário
//   node _fabrica/core/investigacao.js validar <linha>      confere as saídas das investigações da empresa ativa
//                                                           (na pasta antiga: linhas/<linha>/_investigacoes/)
//
// Saída: 0 = ok, 1 = problema, 2 = uso. Sem dependências além do Node.
'use strict';
const fs = require('fs');
const path = require('path');
// Só o leitor de empresas (nunca a marca): os caminhos vêm dele, que respeita FABRICA_RAIZ.
const empresas = require('./empresa.js');
// Recusas conhecidas do leitor de empresas (saem 1, como na linha de comando dele).
const RECUSAS = new Set(['JSON_INVALIDO', 'EMPRESA_NAO_ESCOLHIDA', 'EMPRESA_DESCONHECIDA', 'LINHA_INVALIDA']);

function plataforma(entrada) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(entrada) ? entrada : 'https://' + entrada); } catch { return { erro: 'endereço inválido' }; }
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  const seg = u.pathname.split('/').filter(Boolean);

  if (host === 'instagram.com') {
    if (['p', 'reel', 'reels', 'tv'].includes(seg[0]) && seg[1]) return { plataforma: 'instagram', tipo: 'post', id: seg[1], usuario: null, modos: ['post_unico', 'perfil_3'], modoPadrao: 'post_unico' };
    if (seg[0] && !['explore', 'accounts', 'direct', 'stories'].includes(seg[0])) return { plataforma: 'instagram', tipo: 'perfil', usuario: seg[0], modos: ['perfil_1', 'perfil_3'], modoPadrao: 'perfil_3' };
    return { erro: 'endereço do Instagram sem perfil ou post' };
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    if (host === 'youtu.be' && seg[0]) return { plataforma: 'youtube', tipo: 'video', id: seg[0], usuario: null, modoPadrao: 'quantidade' };
    if (seg[0] === 'watch' && u.searchParams.get('v')) return { plataforma: 'youtube', tipo: 'video', id: u.searchParams.get('v'), usuario: null, modoPadrao: 'quantidade' };
    if (seg[0] === 'shorts' && seg[1]) return { plataforma: 'youtube', tipo: 'video', id: seg[1], usuario: null, modoPadrao: 'quantidade' };
    if (seg[0] && seg[0].startsWith('@')) return { plataforma: 'youtube', tipo: 'canal', usuario: seg[0].slice(1), modoPadrao: 'quantidade' };
    if (['channel', 'c', 'user'].includes(seg[0]) && seg[1]) return { plataforma: 'youtube', tipo: 'canal', usuario: seg[1], modoPadrao: 'quantidade' };
    return { erro: 'endereço do YouTube sem canal ou vídeo' };
  }
  if (host === 'x.com' || host === 'twitter.com') {
    if (seg[0] && seg[1] === 'status' && seg[2]) return { plataforma: 'twitter', tipo: 'post', usuario: seg[0], id: seg[2], modoPadrao: 'quantidade' };
    if (seg[0] && !['home', 'explore', 'search', 'i', 'intent'].includes(seg[0])) return { plataforma: 'twitter', tipo: 'perfil', usuario: seg[0], modoPadrao: 'quantidade' };
    return { erro: 'endereço do X sem perfil ou post' };
  }
  if (host === 'linkedin.com') {
    if (seg[0] === 'in' && seg[1]) return { plataforma: 'linkedin', tipo: 'perfil', usuario: seg[1], modoPadrao: 'quantidade' };
    if (['posts', 'pulse'].includes(seg[0]) && seg[1]) return { plataforma: 'linkedin', tipo: 'post', usuario: null, id: seg[1], modoPadrao: 'quantidade' };
    return { erro: 'endereço do LinkedIn sem perfil ou post (só perfis pessoais /in/)' };
  }
  return { erro: 'plataforma não reconhecida (suportadas: Instagram, YouTube, X/Twitter, LinkedIn)' };
}

// Onde ficam as investigações da linha: as da empresa ativa. Sem nenhuma empresa na pasta, a pasta antiga de sempre.
// Com mais de uma empresa e nenhuma escolhida o leitor de empresas recusa (EMPRESA_NAO_ESCOLHIDA).
function pastaDasInvestigacoes(linha) {
  const codigo = empresas.ativa();
  if (codigo === null) return path.join(empresas.raiz(), 'linhas', linha, '_investigacoes');
  return empresas.caminhos(codigo).investigacoes(linha);
}

function validar(linha) {
  const base = pastaDasInvestigacoes(linha);
  const erros = [], avisos = [];
  if (!fs.existsSync(base)) { console.log('Nenhuma investigação em ' + base); return 0; }
  const pastas = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of pastas) {
    const dir = path.join(base, d.name);
    const bruto = path.join(dir, 'conteudo-bruto.md'), erro = path.join(dir, 'erro.md'), padroes = path.join(dir, 'analise-de-padroes.md');
    if (!fs.existsSync(bruto) && !fs.existsSync(erro)) { erros.push(`${d.name}: nem conteudo-bruto.md nem erro.md (uma das duas saídas é obrigatória)`); continue; }
    if (fs.existsSync(erro) && !fs.existsSync(bruto)) { avisos.push(`${d.name}: investigação falhou (erro.md)`); continue; }
    const t = fs.readFileSync(bruto, 'utf8');
    if (!/^# Conteúdo bruto:/m.test(t)) erros.push(`${d.name}: conteudo-bruto.md sem o título "# Conteúdo bruto:"`);
    const n = /Total de conteúdos analisados:\s*(\d+)/.exec(t);
    if (!n) erros.push(`${d.name}: conteudo-bruto.md sem "Total de conteúdos analisados"`);
    else if (Number(n[1]) === 0) erros.push(`${d.name}: total de conteúdos igual a zero (nunca declarar sucesso sobre resultado vazio)`);
    const blocos = (t.match(/^## Conteúdo \d+:/gm) || []).length;
    if (n && Number(n[1]) !== blocos) erros.push(`${d.name}: declara ${n[1]} conteúdos mas tem ${blocos} blocos "## Conteúdo N:"`);
    if (!fs.existsSync(padroes)) avisos.push(`${d.name}: falta analise-de-padroes.md`);
  }
  console.log(`Linha: ${linha}  |  perfis investigados: ${pastas.length}`);
  avisos.forEach((x) => console.log('AVISO  ' + x));
  erros.forEach((x) => console.log('ERRO   ' + x));
  console.log(erros.length ? `\nRESULTADO: ${erros.length} erro(s).` : '\nRESULTADO: saídas da investigação consistentes.');
  return erros.length ? 1 : 0;
}

function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === 'plataforma' && arg) { const r = plataforma(arg); console.log(JSON.stringify(r)); process.exit(r.erro ? 1 : 0); }
  if (cmd === 'validar' && arg) {
    try {
      process.exit(validar(arg));
    } catch (e) {
      // Recusa conhecida sai 1; qualquer outro erro sai 2, só com a mensagem.
      console.error('ERRO  ' + (RECUSAS.has(e.code) ? e.message : `inesperado: ${e.message}`));
      process.exit(RECUSAS.has(e.code) ? 1 : 2);
    }
  }
  console.error('uso: node _fabrica/core/investigacao.js plataforma <url> | validar <linha>');
  process.exit(2);
}
if (require.main === module) main();
module.exports = { plataforma, validar };
