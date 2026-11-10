#!/usr/bin/env node
// Atualização da Fábrica a partir do repositório-modelo, por ARQUIVO (não por git pull).
// Só toca no que pertence ao modelo (lista em _fabrica/propriedade.json). Nunca toca no que é da empresa
// (marca.yaml, empresa.md, decisões, linhas próprias, saídas, memória). Faz backup antes de sobrescrever e preserva
// o que a empresa personalizou.
//
//   node _fabrica/core/atualizar.js verificar [--origem <url-ou-pasta>] [--ramo <nome>] [--raiz <pasta>]
//   node _fabrica/core/atualizar.js aplicar   [--origem <url-ou-pasta>] [--raiz <pasta>] [--forcar]
//   node _fabrica/core/atualizar.js proteger  [--raiz <pasta>]   (desliga o envio de volta para o modelo)
//   node _fabrica/core/atualizar.js trava     [--raiz <pasta>]   (avisa se esta pasta pode escrever no modelo)
//
// Saída: verificar 0 = em dia, 10 = há atualização, 1 = erro. aplicar 0 = ok, 1 = erro. trava 0 = ok, 3 = pasta ligada
// ao modelo com envio habilitado. Sem dependências além do Node e do git.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const cmd = args[0];
const opc = (n, d = null) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const RAIZ = path.resolve(opc('raiz', path.join(__dirname, '..', '..')));
const TEXTO = new Set(['.md', '.js', '.json', '.yaml', '.yml', '.txt', '.html', '.css', '.csv']);

const rel = (p) => p.split(path.sep).join('/');
const git = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
const falha = (msg) => { console.error('ERRO  ' + msg); process.exit(1); };

function hash(arq) {
  let b = fs.readFileSync(arq);
  if (TEXTO.has(path.extname(arq).toLowerCase())) b = Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'));
  return crypto.createHash('sha256').update(b).digest('hex');
}
function lerJson(arq, padrao = null) { try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return padrao; } }
function lista(pasta, base = pasta, acc = []) {
  for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const c = path.join(pasta, e.name);
    if (e.isDirectory()) lista(c, base, acc); else acc.push(rel(path.relative(base, c)));
  }
  return acc;
}
const comecaCom = (p, pref) => (pref.endsWith('/') ? p.startsWith(pref) : p === pref);
const dentro = (p, prefs) => prefs.some((x) => comecaCom(p, x));

function config() {
  const c = lerJson(path.join(RAIZ, '_fabrica', 'modelo.json'), {});
  const origem = opc('origem') || c.repositorio;
  if (!origem) falha('não sei de onde atualizar: falta `_fabrica/modelo.json` (campo `repositorio`) ou a opção --origem.');
  return { origem, ramo: opc('ramo') || c.ramo || 'main' };
}

function baixarModelo(origem, ramo) {
  // pasta curta do sistema (caminho longo estoura o limite do Windows) e fora do projeto
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-atu-')), 'm');
  const r = git(RAIZ, '-c', 'core.longpaths=true', 'clone', '--quiet', '--depth', '1', '--branch', ramo, origem, tmp);
  if (r.status !== 0) {
    const t = (r.stderr || '').toLowerCase();
    let dica = 'Confira a internet e o endereço do modelo.';
    if (/authentication|denied|could not read username|repository not found|403|401/.test(t)) dica = 'Você precisa ter acesso ao repositório do modelo (ele é privado). Peça acesso a quem mantém a Fábrica.';
    const detalhe = (r.stderr || r.error?.message || '').trim().split(/\r?\n/).slice(-2).join(' | ');
    falha(`não consegui baixar o modelo (${origem}). ${dica} [detalhe técnico: ${detalhe}]`);
  }
  return tmp;
}
const limpar = (tmp) => fs.rmSync(path.dirname(tmp), { recursive: true, force: true });

// Sem registro de atualização anterior, a referência do que "veio do modelo" é o próprio git da pasta: o arquivo como
// estava no último commit. Local igual a esse commit = versão antiga do modelo (pode trocar). Diferente, ou fora do
// commit (arquivo criado na empresa) = personalização (mantém).
const ehRepo = () => fs.existsSync(path.join(RAIZ, '.git'));
function hashBase(p) {
  if (!ehRepo()) return undefined;
  const r = spawnSync('git', ['show', 'HEAD:' + p], { cwd: RAIZ, encoding: 'buffer', maxBuffer: 1 << 28 });
  if (r.status !== 0) return null;
  let b = r.stdout;
  if (TEXTO.has(path.extname(p).toLowerCase())) b = Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'));
  return crypto.createHash('sha256').update(b).digest('hex');
}

function planejar(tmp) {
  const prop = lerJson(path.join(tmp, '_fabrica', 'propriedade.json'));
  if (!prop || !Array.isArray(prop.modelo)) falha('o modelo baixado não tem `_fabrica/propriedade.json`: não é uma versão que sabe atualizar.');
  const protegidos = prop.protegidos || [], mesclar = prop.mesclar || [];
  const estadoArq = path.join(RAIZ, '_fabrica', '_estado-modelo.json');
  const estado = lerJson(estadoArq, { versao: null, arquivos: {} });
  const doModelo = lista(tmp).filter((p) => dentro(p, prop.modelo) && !dentro(p, protegidos) && !mesclar.includes(p));
  const plano = { novos: [], atualizar: [], personalizados: [], iguais: [], removidos: [], mesclar: [], protegidosIgnorados: [] };

  for (const p of doModelo) {
    const novo = hash(path.join(tmp, p));
    const local = path.join(RAIZ, p);
    if (!fs.existsSync(local)) { plano.novos.push({ p, novo }); continue; }
    const atual = hash(local);
    if (atual === novo) { plano.iguais.push({ p, novo }); continue; }
    const registrado = estado.arquivos[p];
    if (registrado) {
      if (registrado !== atual) plano.personalizados.push({ p, novo, atual });
      else plano.atualizar.push({ p, novo, atual });
      continue;
    }
    const base = hashBase(p); // undefined = pasta sem git; null = arquivo fora do commit; senão, hash do commit
    if (base === undefined || base === atual) plano.atualizar.push({ p, novo, atual });
    else plano.personalizados.push({ p, novo, atual, origem: base === null ? 'criado na empresa' : 'alterado na empresa' });
  }
  const noModelo = new Set(doModelo);
  for (const p of Object.keys(estado.arquivos)) {
    if (noModelo.has(p) || dentro(p, protegidos)) continue;
    const local = path.join(RAIZ, p);
    if (!fs.existsSync(local)) continue;
    if (hash(local) === estado.arquivos[p]) plano.removidos.push({ p });
    else plano.personalizados.push({ p, removidoNoModelo: true });
  }
  for (const p of mesclar) {
    const f = path.join(tmp, p);
    if (!fs.existsSync(f)) continue;
    const doMod = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    const loc = fs.existsSync(path.join(RAIZ, p)) ? new Set(fs.readFileSync(path.join(RAIZ, p), 'utf8').split(/\r?\n/).map((x) => x.trim())) : new Set();
    const faltam = doMod.filter((l) => l.trim() && !l.trim().startsWith('#') && !loc.has(l.trim()));
    if (faltam.length) plano.mesclar.push({ p, linhas: faltam });
  }
  const verNova = (lerJson(path.join(tmp, '_fabrica', 'versao.json')) || {});
  return { plano, prop, estado, estadoArq, verNova, doModelo };
}

function relatorio(r, origem) {
  const { plano, verNova, estado } = r;
  const mudou = plano.novos.length + plano.atualizar.length + plano.removidos.length + plano.mesclar.length;
  console.log(`Fábrica instalada: ${estado.versao || 'versão desconhecida (primeira atualização)'}`);
  console.log(`Versão disponível: ${verNova.versao || 'sem número'}${verNova.data ? ' (' + verNova.data + ')' : ''}   [origem: ${origem}]`);
  if (Array.isArray(verNova.novidades) && verNova.novidades.length) {
    console.log('\nNovidades:');
    verNova.novidades.forEach((n) => console.log('  - ' + n));
  }
  console.log(`\nArquivos: ${plano.novos.length} novo(s), ${plano.atualizar.length} a atualizar, ${plano.removidos.length} a remover, ` +
    `${plano.iguais.length} já iguais, ${plano.personalizados.length} personalizado(s) por você (serão mantidos).`);
  const mostra = (t, l, f) => { if (l.length) { console.log('\n' + t); l.slice(0, 40).forEach((x) => console.log('  ' + f(x))); if (l.length > 40) console.log(`  ... e mais ${l.length - 40}`); } };
  mostra('Novos:', plano.novos, (x) => x.p);
  mostra('A atualizar:', plano.atualizar, (x) => x.p);
  mostra('A remover (não existem mais no modelo):', plano.removidos, (x) => x.p);
  mostra('Personalizados por você (mantidos; a versão nova fica em _fabrica/_atualizacao/pendentes/):', plano.personalizados, (x) => x.p + (x.removidoNoModelo ? '  [saiu do modelo]' : x.origem ? '  [' + x.origem + ']' : ''));
  mostra('Linhas a acrescentar:', plano.mesclar, (x) => `${x.p}: +${x.linhas.length} linha(s)`);
  return mudou;
}

function cmdVerificar() {
  const { origem, ramo } = config();
  const tmp = baixarModelo(origem, ramo);
  const r = planejar(tmp);
  const mudou = relatorio(r, origem);
  const mesmaVersao = r.estado.versao && r.verNova.versao && r.estado.versao === r.verNova.versao;
  limpar(tmp);
  const emDia = mudou === 0 && r.plano.personalizados.length === 0;
  console.log(emDia || (mudou === 0 && mesmaVersao) ? '\nRESULTADO: a Fábrica está em dia.' : `\nRESULTADO: há atualização (${mudou} arquivo(s) a mudar).`);
  process.exit(mudou === 0 ? 0 : 10);
}

function cmdAplicar() {
  const forcar = args.includes('--forcar');
  const { origem, ramo } = config();
  const tmp = baixarModelo(origem, ramo);
  const r = planejar(tmp);
  relatorio(r, origem);
  const { plano } = r;
  const carimbo = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');
  const backup = path.join(RAIZ, '_fabrica', '_backup', carimbo);
  const salvaBackup = (p) => { const d = path.join(backup, p); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(RAIZ, p), d); };
  const copia = (p) => { const d = path.join(RAIZ, p); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(tmp, p), d); };
  const arquivos = { ...r.estado.arquivos };
  const pendentes = path.join(RAIZ, '_fabrica', '_atualizacao', 'pendentes');
  fs.rmSync(pendentes, { recursive: true, force: true });
  let feitos = 0;

  for (const x of plano.novos) { copia(x.p); arquivos[x.p] = x.novo; feitos++; }
  for (const x of plano.atualizar) { salvaBackup(x.p); copia(x.p); arquivos[x.p] = x.novo; feitos++; }
  for (const x of plano.iguais) arquivos[x.p] = x.novo;
  for (const x of plano.removidos) { salvaBackup(x.p); fs.rmSync(path.join(RAIZ, x.p)); delete arquivos[x.p]; feitos++; }
  for (const x of plano.personalizados) {
    if (x.removidoNoModelo) continue;
    if (forcar) { salvaBackup(x.p); copia(x.p); arquivos[x.p] = x.novo; feitos++; continue; }
    const pend = path.join(RAIZ, '_fabrica', '_atualizacao', 'pendentes', x.p);
    fs.mkdirSync(path.dirname(pend), { recursive: true });
    fs.copyFileSync(path.join(tmp, x.p), pend);
  }
  for (const m of plano.mesclar) {
    const f = path.join(RAIZ, m.p);
    if (fs.existsSync(f)) salvaBackup(m.p);
    fs.appendFileSync(f, '\n# Acrescentado pela atualização da Fábrica\n' + m.linhas.join('\n') + '\n');
    feitos++;
  }
  const temPend = fs.existsSync(pendentes) && fs.readdirSync(pendentes).length > 0;
  limpar(tmp);

  fs.mkdirSync(path.join(RAIZ, '_fabrica'), { recursive: true });
  fs.writeFileSync(r.estadoArq, JSON.stringify({ versao: r.verNova.versao || r.estado.versao, atualizadoEm: new Date().toISOString(), arquivos }, null, 1) + '\n');
  console.log(`\nRESULTADO: ${feitos} alteração(ões) aplicada(s). Versão agora: ${r.verNova.versao || '(sem número)'}.`);
  if (fs.existsSync(backup)) console.log('Backup do que foi trocado: ' + rel(path.relative(RAIZ, backup)));
  if (temPend) console.log('Arquivos que você personalizou foram mantidos; a versão nova de cada um está em _fabrica/_atualizacao/pendentes/.');
  console.log('IMPORTANTE: feche e abra a sessão do Claude Code para os comandos novos valerem.');
  process.exit(0);
}

function origemGit() {
  const r = git(RAIZ, 'remote', 'get-url', 'origin');
  return r.status === 0 ? r.stdout.trim() : null;
}
const norm = (u) => String(u || '').toLowerCase().replace(/\.git$/, '').replace(/\/+$/, '');

function cmdTrava() {
  const c = lerJson(path.join(RAIZ, '_fabrica', 'modelo.json'), {});
  const o = origemGit();
  const marcador = path.join(RAIZ, '.git', 'fabrica-copia');
  if (o && c.repositorio && norm(o) === norm(c.repositorio) && !fs.existsSync(marcador)) {
    console.log('ATENÇÃO: esta pasta está ligada ao repositório-MODELO com envio habilitado. Gravar aqui e enviar alteraria o modelo.');
    console.log('Rode: node _fabrica/core/atualizar.js proteger');
    process.exit(3);
  }
  console.log('OK: esta pasta não pode escrever no modelo.');
  process.exit(0);
}

function cmdProteger() {
  const c = lerJson(path.join(RAIZ, '_fabrica', 'modelo.json'), {});
  const o = origemGit();
  if (!fs.existsSync(path.join(RAIZ, '.git'))) falha('esta pasta não é um repositório git.');
  if (o && c.repositorio && norm(o) === norm(c.repositorio)) {
    let r = git(RAIZ, 'remote', 'rename', 'origin', 'modelo');
    if (r.status !== 0) falha('não consegui renomear o remoto: ' + r.stderr);
    r = git(RAIZ, 'remote', 'set-url', '--push', 'modelo', 'DESABILITADO');
    if (r.status !== 0) falha('não consegui desligar o envio: ' + r.stderr);
    console.log('Pronto: o remoto "origin" virou "modelo" e o envio está desligado. Esta pasta continua recebendo atualizações.');
  } else {
    console.log('Nada a proteger: esta pasta não está ligada ao repositório-modelo.');
  }
  fs.writeFileSync(path.join(RAIZ, '.git', 'fabrica-copia'), new Date().toISOString() + '\n');
  process.exit(0);
}

if (cmd === 'verificar') cmdVerificar();
else if (cmd === 'aplicar') cmdAplicar();
else if (cmd === 'proteger') cmdProteger();
else if (cmd === 'trava') cmdTrava();
else {
  console.error('uso: node _fabrica/core/atualizar.js verificar | aplicar [--forcar] | proteger | trava  [--origem <url>] [--raiz <pasta>]');
  process.exit(2);
}
