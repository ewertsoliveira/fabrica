#!/usr/bin/env node
// Apoio verificável do motor de skills da Fábrica (a parte que não depende de raciocínio).
//
//   node _fabrica/core/skills.js listar                 skills instaladas e as do catálogo, com estado das variáveis
//   node _fabrica/core/skills.js validar <pasta-da-skill>   confere o SKILL.md contra o formato
//   node _fabrica/core/skills.js usos <nome>            linhas que declaram a skill
//   node _fabrica/core/skills.js resolver <linha>       confere se as skills de uma linha estão prontas (fail fast)
//
// Opção comum: --raiz <pasta> (raiz da Fábrica; padrão: a deste repositório). Sai com 0 = ok, 1 = problema, 2 = uso.
// Nunca imprime valor de variável de ambiente: só "configurada" ou "ausente".
'use strict';
const fs = require('fs');
const path = require('path');
// Só o leitor de YAML: as skills não usam a marca, então não dependem da empresa ativa.
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');
const RAIZ = path.resolve(__dirname, '..', '..');

const NATIVAS = ['busca-web', 'leitura-web']; // não precisam de instalação
const TIPOS = ['mcp', 'script', 'hybrid', 'prompt'];

function lerSkill(arq) {
  const t = fs.readFileSync(arq, 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) return { erro: 'sem cabeçalho entre "---"', meta: null, corpo: t };
  try { return { meta: lerYaml(m[1]), corpo: m[2], erro: null }; } catch (e) { return { erro: 'cabeçalho ilegível: ' + e.message, meta: null, corpo: m[2] }; }
}

function validarMeta(meta) {
  const e = [];
  if (!meta) return ['cabeçalho ausente'];
  if (!meta.name || typeof meta.name !== 'string') e.push('`name` ausente');
  else if (!/^[a-z0-9][a-z0-9-]*$/.test(meta.name)) e.push('`name` deve ser um slug em minúsculas (letras, números, hífen)');
  if (!meta.description || typeof meta.description !== 'string') e.push('`description` ausente');
  if (!TIPOS.includes(meta.type)) e.push(`\`type\` deve ser ${TIPOS.join(' | ')} (veio ${JSON.stringify(meta.type)})`);
  if (!/^\d+\.\d+\.\d+$/.test(String(meta.version || ''))) e.push('`version` deve ser semver (ex.: 1.0.0)');
  if (meta.type === 'mcp' || meta.type === 'hybrid') {
    if (!meta.mcp || !meta.mcp.server_name) e.push('tipo mcp/hybrid exige `mcp.server_name`');
    else if ((meta.mcp.transport || 'stdio') === 'http' ? !meta.mcp.url : !meta.mcp.command) {
      e.push((meta.mcp.transport || 'stdio') === 'http' ? 'transporte http exige `mcp.url`' : 'transporte stdio exige `mcp.command`');
    }
  }
  if (meta.type === 'script' || meta.type === 'hybrid') {
    if (!meta.script || !meta.script.path) e.push('tipo script/hybrid exige `script.path`');
    else if (!['node', 'python', 'bash'].includes(meta.script.runtime)) e.push('`script.runtime` deve ser node | python | bash');
  }
  if (meta.env !== undefined && !Array.isArray(meta.env)) e.push('`env` deve ser uma lista');
  if (meta.categories !== undefined && !Array.isArray(meta.categories)) e.push('`categories` deve ser uma lista');
  return e;
}

function variaveisDefinidas(raiz) {
  const def = new Set();
  const arq = path.join(raiz, '.env');
  if (fs.existsSync(arq)) {
    for (const l of fs.readFileSync(arq, 'utf8').split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*$/.exec(l);
      if (m && m[2] && !/^["']{2}$/.test(m[2])) def.add(m[1]);
    }
  }
  return def;
}

function servidoresMcp(raiz) {
  const arq = path.join(raiz, '.claude', 'settings.local.json');
  if (!fs.existsSync(arq)) return new Set();
  try { return new Set(Object.keys(JSON.parse(fs.readFileSync(arq, 'utf8')).mcpServers || {})); } catch { return new Set(); }
}

function listarPasta(pasta) {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_') && fs.existsSync(path.join(pasta, d.name, 'SKILL.md')))
    .map((d) => ({ pasta: d.name, ...lerSkill(path.join(pasta, d.name, 'SKILL.md')) }));
}

function linhasQueUsam(raiz, nome) {
  const dir = path.join(raiz, 'linhas');
  if (!fs.existsSync(dir)) return [];
  const achadas = [];
  for (const l of fs.readdirSync(dir, { withFileTypes: true })) {
    const arq = path.join(dir, l.name, 'linha.yaml');
    if (!l.isDirectory() || !fs.existsSync(arq)) continue;
    try {
      const y = lerYaml(fs.readFileSync(arq, 'utf8'));
      if (Array.isArray(y.skills) && y.skills.includes(nome)) achadas.push(l.name);
    } catch { /* linha ilegível: o validar-linha cuida */ }
  }
  return achadas;
}

function cmdListar(raiz) {
  const env = variaveisDefinidas(raiz);
  const imprime = (titulo, lista) => {
    console.log(`\n${titulo} (${lista.length})`);
    if (!lista.length) { console.log('  nenhuma'); return; }
    for (const s of lista) {
      if (s.erro) { console.log(`  ! ${s.pasta}: ${s.erro}`); continue; }
      const m = s.meta;
      const falt = (m.env || []).filter((v) => !env.has(v) && !process.env[v]);
      console.log(`  ${m.name} v${m.version} (${m.type}): ${m.description}`);
      if ((m.env || []).length) console.log(`     variáveis: ${(m.env).map((v) => `${v} ${falt.includes(v) ? 'AUSENTE' : 'configurada'}`).join(', ')}`);
    }
  };
  imprime('Instaladas (_fabrica/skills)', listarPasta(path.join(raiz, '_fabrica', 'skills')));
  imprime('Catálogo da Fábrica (_fabrica/catalogo-de-skills)', listarPasta(path.join(raiz, '_fabrica', 'catalogo-de-skills')));
  console.log('\nNativas (sem instalação): ' + NATIVAS.join(', '));
  return 0;
}

function cmdValidar(pasta) {
  const arq = path.join(path.resolve(pasta), 'SKILL.md');
  if (!fs.existsSync(arq)) { console.log('ERRO  SKILL.md não encontrado em ' + pasta); return 1; }
  const s = lerSkill(arq);
  const erros = s.erro ? [s.erro] : validarMeta(s.meta);
  if (!erros.length) {
    if (!s.corpo.trim()) erros.push('corpo de instruções vazio');
    if (s.meta.type === 'script' || s.meta.type === 'hybrid') {
      const sc = path.join(path.dirname(arq), s.meta.script.path);
      if (!fs.existsSync(sc)) erros.push(`script não encontrado: ${s.meta.script.path}`);
    }
  }
  erros.forEach((x) => console.log('ERRO  ' + x));
  console.log(erros.length ? `\nRESULTADO: ${erros.length} erro(s).` : `RESULTADO: skill válida (${s.meta.name} v${s.meta.version}, ${s.meta.type}).`);
  return erros.length ? 1 : 0;
}

function cmdUsos(raiz, nome) {
  const l = linhasQueUsam(raiz, nome);
  console.log(l.length ? `A skill "${nome}" é usada por: ${l.join(', ')}` : `Nenhuma linha usa a skill "${nome}".`);
  return 0;
}

function cmdResolver(raiz, linha) {
  const arq = path.join(raiz, 'linhas', linha, 'linha.yaml');
  if (!fs.existsSync(arq)) { console.log('ERRO  linha não encontrada: ' + linha); return 1; }
  const y = lerYaml(fs.readFileSync(arq, 'utf8'));
  const pedidas = (Array.isArray(y.skills) ? y.skills : []).filter((s) => !NATIVAS.includes(s));
  const env = variaveisDefinidas(raiz), mcp = servidoresMcp(raiz);
  const erros = [], avisos = [];
  for (const nome of pedidas) {
    const arqSkill = path.join(raiz, '_fabrica', 'skills', nome, 'SKILL.md');
    if (!fs.existsSync(arqSkill)) { erros.push(`skill "${nome}" não está instalada (_fabrica/skills/${nome}/SKILL.md)`); continue; }
    const s = lerSkill(arqSkill);
    const ev = s.erro ? [s.erro] : validarMeta(s.meta);
    if (ev.length) { erros.push(`skill "${nome}" inválida: ${ev.join('; ')}`); continue; }
    if ((s.meta.type === 'mcp' || s.meta.type === 'hybrid') && !mcp.has(s.meta.mcp.server_name)) {
      erros.push(`skill "${nome}": servidor MCP "${s.meta.mcp.server_name}" não configurado em .claude/settings.local.json`);
    }
    const falt = (s.meta.env || []).filter((v) => !env.has(v) && !process.env[v]);
    if (falt.length) avisos.push(`skill "${nome}": variável(is) ausente(s): ${falt.join(', ')} (pode não funcionar direito)`);
  }
  console.log(`Linha: ${linha}  |  skills pedidas (não nativas): ${pedidas.length}`);
  avisos.forEach((x) => console.log('AVISO  ' + x));
  erros.forEach((x) => console.log('ERRO   ' + x));
  console.log(erros.length ? `\nRESULTADO: ${erros.length} problema(s). A linha não deve rodar.` : '\nRESULTADO: skills resolvidas.');
  return erros.length ? 1 : 0;
}

function main() {
  const a = process.argv.slice(2);
  const i = a.indexOf('--raiz');
  const raiz = i >= 0 ? path.resolve(a.splice(i, 2)[1]) : RAIZ;
  const [cmd, arg] = a;
  let code = 2;
  if (cmd === 'listar') code = cmdListar(raiz);
  else if (cmd === 'validar' && arg) code = cmdValidar(arg);
  else if (cmd === 'usos' && arg) code = cmdUsos(raiz, arg);
  else if (cmd === 'resolver' && arg) code = cmdResolver(raiz, arg);
  else console.error('uso: node _fabrica/core/skills.js listar | validar <pasta> | usos <nome> | resolver <linha> [--raiz <pasta>]');
  process.exit(code);
}
if (require.main === module) main();
module.exports = { lerSkill, validarMeta, NATIVAS, TIPOS };
