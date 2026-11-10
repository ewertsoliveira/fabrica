#!/usr/bin/env node
// Guarda a chave gratuita da Hugging Face (fotos sem marca d'água) no arquivo .env, SEM a pessoa abrir arquivo nenhum e
// SEM a chave aparecer na conversa: a pessoa copia a chave no site (botão "Copy") e este programa lê da área de
// transferência (o que ela acabou de copiar), confere que parece uma chave e grava. A chave nunca é impressa.
//
//   node 08-FERRAMENTAS/imagem-ia/guardar-token.js
//
// Saída: 0 = guardada; 2 = o que está copiado não parece uma chave (a pessoa copia de novo); 1 = erro.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const ehTokenHF = (t) => typeof t === 'string' && /^hf_[A-Za-z0-9]{20,}$/.test(t.trim());

// Troca (ou acrescenta) CHAVE=valor no texto de um .env, mantendo as outras linhas e o fim de linha do arquivo.
function trocarNoEnv(texto, chave, valor) {
  const eol = /\r\n/.test(texto) ? '\r\n' : '\n';
  const linhas = texto === '' ? [] : texto.split(/\r?\n/);
  const re = new RegExp('^\\s*' + chave + '\\s*=');
  let achou = false;
  const saida = linhas.map((l) => { if (re.test(l)) { achou = true; return `${chave}=${valor}`; } return l; });
  while (saida.length && saida[saida.length - 1] === '') saida.pop();
  if (!achou) saida.push(`${chave}=${valor}`);
  return saida.join(eol) + eol;
}

function lerAreaDeTransferencia() {
  const por = process.platform;
  const r = por === 'win32' ? spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' })
    : por === 'darwin' ? spawnSync('pbpaste', [], { encoding: 'utf8' })
      : spawnSync('sh', ['-c', 'xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output'], { encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '').trim() : null;
}
function limparAreaDeTransferencia() {
  const por = process.platform;
  if (por === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', 'Set-Clipboard -Value " "'], { encoding: 'utf8' });
  else if (por === 'darwin') spawnSync('pbcopy', [], { input: '', encoding: 'utf8' });
}

function gravar(raiz, valor) {
  const env = path.join(raiz, '.env');
  const exemplo = path.join(raiz, '.env.example');
  const base = fs.existsSync(env) ? fs.readFileSync(env, 'utf8') : (fs.existsSync(exemplo) ? fs.readFileSync(exemplo, 'utf8') : '');
  fs.writeFileSync(env, trocarNoEnv(base, 'HF_TOKEN', valor.trim()));
}

module.exports = { ehTokenHF, trocarNoEnv, gravar };

if (require.main === module) {
  const copiado = lerAreaDeTransferencia();
  if (copiado === null) { console.log('ERRO: não consegui ler o que você copiou.'); process.exit(1); }
  if (!ehTokenHF(copiado)) { console.log('NAO-PARECE-CHAVE: o que está copiado não parece uma chave da Hugging Face (ela começa com "hf_"). Copie de novo, com o botão "Copy" ao lado da chave.'); process.exit(2); }
  gravar(RAIZ, copiado);
  limparAreaDeTransferencia();
  console.log('OK: a chave foi guardada neste computador e a área de cópia foi limpa.');
}
