#!/usr/bin/env node
// Valida a definição de uma Linha de Produção antes de executá-la (o runner roda isto na inicialização).
//   node _fabrica/core/validar-linha.js <nome-da-linha>        (ex.: reels)
//   node _fabrica/core/validar-linha.js --caminho linhas/reels
// Saída: 0 = linha válida (pode haver avisos), 1 = erros, 2 = erro de uso. Sem dependências além do Node.
//
// O que confere:
//   - linha.yaml existe, tem `linha`, `nome` e a lista `passos` com `passo` numerado sem repetição;
//   - cada passo tem `id`, `tipo` (checkpoint | estacao | script) e `arquivo` existente;
//   - passo do tipo `estacao` aponta uma estação que existe em estacoes/ (e as `lentes`, se houver);
//   - `ao_reprovar` aponta um passo que existe e vem antes do passo que reprova;
//   - `checkpoints` lista passos que existem e são do tipo checkpoint;
//   - o `entrada` de cada passo é a `saida` de um passo anterior (ou aviso, quando é produzida fora da linha);
//   - estação que declara `**Papel do Núcleo:**` aponta um arquivo que existe;
//   - linha de carrossel de feed (Portão 2d): ver validar-carrossel.js.
'use strict';
const fs = require('fs');
const path = require('path');
// Só o leitor de YAML: a validação de linha não usa a marca, então não depende da empresa ativa.
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');
const RAIZ = path.resolve(__dirname, '..', '..');
const { validarCarrossel, ehLinhaDeCarrossel, papelDaEstacao } = require('./validar-carrossel');

function validar(pasta) {
  const erros = [], avisos = [];
  const arq = path.join(pasta, 'linha.yaml');
  if (!fs.existsSync(arq)) return { erros: [`linha.yaml não encontrado em ${pasta}`], avisos, passos: 0 };
  let L;
  try { L = lerYaml(fs.readFileSync(arq, 'utf8')); } catch (e) { return { erros: ['linha.yaml ilegível: ' + e.message], avisos, passos: 0 }; }
  if (!L.linha) erros.push('linha.yaml: campo `linha` ausente');
  if (!L.nome) erros.push('linha.yaml: campo `nome` ausente');
  const passos = Array.isArray(L.passos) ? L.passos : [];
  if (!passos.length) { erros.push('linha.yaml: lista `passos` ausente ou vazia'); return { erros, avisos, passos: 0 }; }

  const existe = (rel) => fs.existsSync(path.join(pasta, rel));
  const numeros = new Set();
  const porNumero = new Map();
  const saidas = new Map(); // caminho -> número do passo que produz
  passos.forEach((p, i) => {
    const rot = `passo ${p.passo ?? '#' + (i + 1)}`;
    if (typeof p.passo !== 'number') erros.push(`${rot}: campo \`passo\` numérico ausente`);
    else { if (numeros.has(p.passo)) erros.push(`${rot}: número repetido`); numeros.add(p.passo); porNumero.set(p.passo, p); }
    if (!p.id) erros.push(`${rot}: campo \`id\` ausente`);
    if (!['checkpoint', 'estacao', 'script'].includes(p.tipo)) erros.push(`${rot}: \`tipo\` deve ser checkpoint, estacao ou script (veio ${JSON.stringify(p.tipo)})`);
    if (!p.arquivo) erros.push(`${rot}: campo \`arquivo\` ausente`);
    else if (!existe(p.arquivo)) erros.push(`${rot}: arquivo não encontrado: ${p.arquivo}`);
    if (p.tipo === 'estacao') {
      if (!p.estacao) erros.push(`${rot}: tipo estacao exige \`estacao\``);
      else if (!existe(`estacoes/${p.estacao}.md`)) erros.push(`${rot}: estação não encontrada: estacoes/${p.estacao}.md`);
      for (const l of p.lentes || []) if (!existe(`estacoes/${l}.md`)) erros.push(`${rot}: lente não encontrada: estacoes/${l}.md`);
      if (!p.execucao) avisos.push(`${rot}: sem \`execucao\` (subagente ou inline); o runner assumirá subagente`);
    }
    if (p.tipo === 'script' && p.estacao) avisos.push(`${rot}: passo de script não deve ter \`estacao\``);
    if (p.entrada && !saidas.has(p.entrada)) {
      avisos.push(`${rot}: entrada \`${p.entrada}\` não é saída de passo anterior (vale se vier de fora da linha)`);
    }
    if (p.saida) saidas.set(p.saida, p.passo);
  });

  for (const p of passos) {
    if (p.ao_reprovar !== undefined) {
      const alvo = porNumero.get(p.ao_reprovar);
      if (!alvo) erros.push(`passo ${p.passo}: ao_reprovar aponta passo inexistente (${p.ao_reprovar})`);
      else if (alvo.passo >= p.passo) erros.push(`passo ${p.passo}: ao_reprovar deve apontar um passo anterior`);
    }
  }
  for (const c of L.checkpoints || []) {
    const alvo = porNumero.get(c);
    if (!alvo) erros.push(`checkpoints: passo ${c} não existe`);
    else if (alvo.tipo !== 'checkpoint') erros.push(`checkpoints: passo ${c} não é do tipo checkpoint`);
  }
  const marcados = new Set(L.checkpoints || []);
  for (const p of passos) if (p.tipo === 'checkpoint' && !marcados.has(p.passo) && Array.isArray(L.checkpoints)) {
    avisos.push(`passo ${p.passo}: é checkpoint mas não está em \`checkpoints\``);
  }

  // Estação que adota um papel do Núcleo: o arquivo do papel precisa existir (ele é a fonte dos princípios).
  const pastaEstacoes = path.join(pasta, 'estacoes');
  for (const nome of fs.existsSync(pastaEstacoes) ? fs.readdirSync(pastaEstacoes).filter((n) => n.endsWith('.md')) : []) {
    const alvo = papelDaEstacao(fs.readFileSync(path.join(pastaEstacoes, nome), 'utf8'));
    if (alvo && !fs.existsSync(path.join(RAIZ, alvo))) erros.push(`estacoes/${nome}: o Papel do Núcleo não existe: ${alvo}`);
  }
  if (ehLinhaDeCarrossel(pasta, L, passos)) erros.push(...validarCarrossel({ pasta, L, passos, raiz: RAIZ }));
  return { erros, avisos, passos: passos.length };
}

function main() {
  const a = process.argv.slice(2);
  let pasta;
  if (a[0] === '--caminho' && a[1]) pasta = path.resolve(a[1]);
  else if (a[0]) pasta = path.join(RAIZ, 'linhas', a[0]);
  else { console.error('uso: node _fabrica/core/validar-linha.js <nome-da-linha> | --caminho <pasta>'); process.exit(2); }
  const r = validar(pasta);
  console.log(`Linha: ${pasta}`);
  console.log(`Passos: ${r.passos}`);
  r.avisos.forEach((x) => console.log('AVISO  ' + x));
  r.erros.forEach((x) => console.log('ERRO   ' + x));
  console.log(r.erros.length ? `\nRESULTADO: ${r.erros.length} erro(s). A linha não pode ser executada.` : '\nRESULTADO: linha válida.');
  process.exit(r.erros.length ? 1 : 0);
}
if (require.main === module) main();
module.exports = { validar };
