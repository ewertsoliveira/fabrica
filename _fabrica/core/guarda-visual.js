#!/usr/bin/env node
// Guarda da regra D-01 (05-ESTRATEGIA/nucleo-de-conteudo/regras/12-decisao-visual.md): nenhuma escolha visual é pedida
// sem a prévia aplicada à peça. Roda como gancho (hook) do Claude Code antes de cada pergunta estruturada
// (AskUserQuestion), configurado em .claude/settings.json. Recebe a chamada em JSON pela entrada padrão.
//
// Uma pergunta é visual quando o texto dela (pergunta, rótulo ou descrição das opções) fala de aparência: capa, imagem,
// foto, quadro do vídeo, cor, letra, logo, layout, lâmina, arte, estilo, identidade visual... Pergunta visual só passa
// se citar a prévia que a pessoa está vendo: o caminho de um arquivo que existe (imagem, página, vídeo ou PDF) ou um
// endereço do painel local (localhost), file:// ou artifact do claude.ai.
//
// Pergunta sem escolha de aparência que caiu aqui por uma palavra (ex.: a data de publicação de "a capa do roteiro"):
// refazer a chamada com metadata.source = "fabrica:nao-visual". Nunca vale para escolher imagem, capa, cor ou estilo.
//
//   echo '<json do gancho>' | node _fabrica/core/guarda-visual.js
//   Sai sempre com 0. Bloqueio = JSON com permissionDecision "deny" na saída padrão; sem saída = pode perguntar.
'use strict';
const fs = require('fs');
const path = require('path');

const ESCAPE = 'fabrica:nao-visual';
const L = '[\\p{L}\\p{N}]';
const TERMOS = [
  'capa', 'capas', 'imagem', 'imagens', 'foto', 'fotos', 'fotografia', 'fotografias', 'quadro', 'quadros', 'cor', 'cores',
  'paleta', 'paletas', 'tipografia', 'letra', 'letras', 'fonte da letra', 'logo', 'logos', 'logotipo', 'layout', 'layouts',
  'lâmina', 'lâminas', 'lamina', 'laminas', 'arte', 'artes', 'visual', 'visuais', 'aparência', 'enquadramento', 'miniatura',
  'thumbnail', 'ilustração', 'ilustrações', 'mockup', 'mockups', 'cenário', 'fundo', 'ícone', 'ícones', 'estilo', 'estilos',
  'design', 'identidade', 'prévia', 'prévias', 'selo', 'cartão', 'legenda na tela', 'texto na tela', 'título na tela',
];
const VISUAL = new RegExp(`(?<!${L})(${TERMOS.map((t) => t.replace(/ /g, '\\s+')).join('|')})(?!${L})`, 'iu');

const EXT = '(?:png|jpe?g|webp|gif|svg|html?|mp4|mov|webm|pdf)';
const URL_PREVIA = /\b(?:file:\/\/\S+|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/\S*|https:\/\/claude\.ai\/\S*artifact\S*)/i;
const CAMINHOS = [
  new RegExp(`[A-Za-z]:[\\\\/][^\\n"'\`<>|*?]*?\\.${EXT}(?![\\p{L}\\p{N}])`, 'giu'), // C:\...\prancha.png (com espaços)
  new RegExp(`(?:^|[\\s("'\`\\[])(/[^\\n"'\`<>|*?]*?\\.${EXT})(?![\\p{L}\\p{N}])`, 'giu'), // /c/Users/.../a.png
  new RegExp(`(?:^|[\\s("'\`\\[])((?:\\.{1,2}[\\\\/])?[^\\s"'\`<>|*?():]+\\.${EXT})(?![\\p{L}\\p{N}])`, 'giu'), // empresas/x/a.png
];

const textoDa = (q) => [q.question, q.header, ...(q.options || []).flatMap((o) => [o.label, o.description])]
  .filter((s) => typeof s === 'string').join('\n');

function existe(p, bases) {
  let c = p.trim();
  try { c = decodeURI(c); } catch { /* fica como está */ }
  const tenta = (x) => { try { return fs.statSync(x).isFile(); } catch { return false; } };
  if (/^\/[a-z]\//i.test(c) && process.platform === 'win32') c = `${c[1]}:${c.slice(2)}`; // /c/Users -> c:/Users
  if (path.isAbsolute(c) || /^[A-Za-z]:[\\/]/.test(c)) return tenta(c);
  return bases.some((b) => tenta(path.resolve(b, c)));
}

function citaPrevia(texto, bases) {
  if (URL_PREVIA.test(texto)) return true;
  for (const re of CAMINHOS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(texto))) if (existe(m[1] || m[0], bases)) return true;
  }
  return false;
}

// Devolve a lista de perguntas visuais sem prévia citada (vazia = pode perguntar).
function avaliar(entrada, bases) {
  const inp = (entrada && entrada.tool_input) || {};
  if (inp.metadata && inp.metadata.source === ESCAPE) return [];
  const qs = Array.isArray(inp.questions) ? inp.questions : [];
  return qs.filter((q) => { const t = textoDa(q); return VISUAL.test(t) && !citaPrevia(t, bases); });
}

function mensagem(faltando) {
  const nomes = faltando.map((q) => `"${q.header || q.question}"`).join(', ');
  return [
    `Pergunta bloqueada pela regra D-01 da Fábrica: decisão visual só com a prévia aplicada à peça, nunca por texto. ` +
      `${faltando.length > 1 ? 'As perguntas' : 'A pergunta'} ${nomes} ${faltando.length > 1 ? 'pedem' : 'pede'} uma escolha de aparência sem citar a prévia.`,
    'Antes de perguntar:',
    '1. Gere cada opção JÁ APLICADA à peça final (a capa montada com cada imagem, a lâmina com cada cor, o vídeo com cada jeito). ' +
      'Matéria-prima solta não vale: prancha de quadros, lista de fotos, nome de arquivo ou descrição.',
    '2. Junte as opções lado a lado, com as letras A, B, C escritas na imagem ou na página. Toda opção tem a sua versão pronta (nenhuma opção só descrita).',
    '3. Abra a prévia no navegador da pessoa (Start-Process / open) e ponha o caminho do arquivo (ou o endereço do painel) no texto da pergunta.',
    '4. Faça a pergunta visual numa chamada própria, com as opções pelas mesmas letras da prévia ("A · quadro 20 do vídeo").',
    `Se esta pergunta não escolhe nada de aparência (ex.: a data de publicação), refaça a chamada com metadata.source = "${ESCAPE}". ` +
      'Isso nunca vale para escolher imagem, foto, capa, cor, letra, layout, estilo ou identidade.',
  ].join('\n');
}

// O gancho chama main() por `node -e`, para achar este arquivo pelo CLAUDE_PROJECT_DIR em qualquer terminal (Git Bash,
// cmd, PowerShell, macOS) sem depender de como o terminal expande variáveis.
function main() {
  let bruto = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { bruto += c; });
  process.stdin.on('end', () => {
    let entrada;
    try { entrada = JSON.parse(bruto); } catch { process.exit(0); }
    const bases = [entrada.cwd, process.env.CLAUDE_PROJECT_DIR, process.cwd(), path.resolve(__dirname, '..', '..')].filter(Boolean);
    const faltando = avaliar(entrada, bases);
    if (faltando.length) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: mensagem(faltando) },
      }));
    }
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { avaliar, citaPrevia, main, VISUAL, ESCAPE };
