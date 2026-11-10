#!/usr/bin/env node
// Conferência de caminhos de empresa escritos à mão nas instruções (skills, runner, prompts, linhas, documentação).
// Desde a etapa 2, todo caminho de marca, perfil, saída, memória etc. vem do leitor de empresas
// (`node _fabrica/core/empresa.js caminhos`). Este conferidor reprova instrução que volte a escrever o caminho fixo.
//
// Uso:  node _fabrica/core/conferir-caminhos.js [--raiz <pasta>]
// Saída: 0 limpo, 1 achou algo (arquivo:linha  caminho), 2 uso errado.
// Módulo: conferir(raiz) -> [{ arquivo, linha, caminho }]
'use strict';
const fs = require('fs');
const path = require('path');

// Pastas varridas (recursivamente) e arquivos soltos. Só .md e .yaml. Em linhas/<l>/ ver INSTRUCOES_DA_LINHA.
const PASTAS = ['.claude/skills', '_fabrica/core', '08-FERRAMENTAS', '05-ESTRATEGIA/nucleo-de-conteudo/regras'];
const ARQUIVOS = ['CORE.md'];
const INSTRUCOES_DA_LINHA = { arquivos: ['LEIA-ME.md', 'linha.yaml'], pastas: ['passos', 'estacoes', 'dados'] };
// Ignoradas pelo nome em qualquer nível. `docs` e `_backup` só no topo (e `_fabrica/_backup`): mais fundo, uma pasta
// com esse nome dentro de uma ferramenta ou de uma linha é instrução como as outras.
const IGNORADAS = new Set(['node_modules', '.git', '.superpowers']);
const IGNORADAS_NO_TOPO = new Set(['docs', '_backup', '_fabrica/_backup']);
const EXTENSOES = new Set(['.md', '.yaml']);

// Fim do caminho: não pode continuar numa palavra (assim `marca.exemplo.yaml` e `saidas` não casam).
const FIM = '(?![A-Za-z0-9_-])';
// Nos padrões, "@" é o separador do caminho: barra normal ou invertida.
const PADROES = [
  '06-MARCA-E-FOTOS@marca[.]yaml',
  '06-MARCA-E-FOTOS@estilo-de-video[.]md',
  '06-MARCA-E-FOTOS@estilos-proprios',
  '_fabrica@_memoria@empresa[.]md',
  'linhas@[^/\\\\\\s`\'"]+@(?:saida|memoria|estado[.]json|_investigacoes)',
  '03-CRONOGRAMA@dados',
  '04-LABORATORIO-DE-DESIGN@dados',
  '04-LABORATORIO-DE-DESIGN@referencias',
].map((p) => p.replace(/@/g, '[/\\\\]') + FIM);
const RE_CAMINHO = new RegExp(PADROES.join('|'), 'g');

const normalizar = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cita = (linha) => /pasta antiga|\blegado\b/.test(normalizar(linha));

function arquivosDe(raiz) {
  const achados = [];
  const andar = (dir) => {
    let itens;
    try { itens = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of itens) {
      if (IGNORADAS.has(e.name)) continue;
      const c = path.join(dir, e.name);
      if (e.isDirectory() && IGNORADAS_NO_TOPO.has(path.relative(raiz, c).split(path.sep).join('/'))) continue;
      if (e.isDirectory()) andar(c);
      else if (EXTENSOES.has(path.extname(e.name).toLowerCase())) achados.push(c);
    }
  };
  for (const p of PASTAS) andar(path.join(raiz, ...p.split('/')));
  // linhas/<l>/: só as instruções. saida/, memoria/, _investigacoes/, _construcao/ e estado.json são dados
  // gravados por agentes ou conteúdo de terceiros e podem citar qualquer caminho.
  const linhas = path.join(raiz, 'linhas');
  let donas = [];
  try { donas = fs.readdirSync(linhas, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { /* sem linhas */ }
  for (const d of donas) {
    const base = path.join(linhas, d.name);
    for (const f of INSTRUCOES_DA_LINHA.arquivos) {
      const c = path.join(base, f);
      if (fs.existsSync(c) && fs.statSync(c).isFile()) achados.push(c);
    }
    for (const p of INSTRUCOES_DA_LINHA.pastas) andar(path.join(base, p));
  }
  for (const a of ARQUIVOS) { const c = path.join(raiz, a); if (fs.existsSync(c)) achados.push(c); }
  return [...new Set(achados)];
}

// Para o CORE.md: números (1-based) das linhas dentro da subseção "Empresas",
// do título até o próximo título do mesmo nível ou superior.
function linhasDeEmpresas(linhas) {
  const dentro = new Set();
  let nivel = 0;
  linhas.forEach((l, i) => {
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(l);
    if (m) {
      if (nivel && m[1].length <= nivel) nivel = 0;
      if (!nivel && normalizar(m[2]) === 'empresas') nivel = m[1].length;
    }
    if (nivel) dentro.add(i + 1);
  });
  return dentro;
}

function conferir(raiz) {
  const resultado = [];
  for (const abs of arquivosDe(raiz)) {
    const rel = path.relative(raiz, abs).split(path.sep).join('/');
    const linhas = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    const empresas = rel === 'CORE.md' ? linhasDeEmpresas(linhas) : null;
    linhas.forEach((texto, i) => {
      if (cita(texto) || (empresas && empresas.has(i + 1))) return;
      for (const m of texto.matchAll(RE_CAMINHO)) resultado.push({ arquivo: rel, linha: i + 1, caminho: m[0] });
    });
  }
  return resultado.sort((a, b) => (a.arquivo < b.arquivo ? -1 : a.arquivo > b.arquivo ? 1 : a.linha - b.linha));
}

function main(argv) {
  let raiz = path.resolve(__dirname, '..', '..');
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--raiz' && argv[i + 1]) raiz = path.resolve(argv[++i]);
    else { console.error('Uso: node _fabrica/core/conferir-caminhos.js [--raiz <pasta>]'); return 2; }
  }
  if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) { console.error(`Pasta não encontrada: ${raiz}`); return 2; }
  const achados = conferir(raiz);
  for (const a of achados) console.log(`${a.arquivo}:${a.linha}  ${a.caminho}`);
  if (achados.length) {
    console.log(`\n${achados.length} caminho(s) de empresa escrito(s) à mão. Use os caminhos do leitor: node _fabrica/core/empresa.js caminhos`);
    return 1;
  }
  console.log('Conferência de caminhos: limpo.');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { conferir };
