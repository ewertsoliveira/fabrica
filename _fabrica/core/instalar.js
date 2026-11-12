#!/usr/bin/env node
// Instalação da Fábrica numa pasta recém-baixada, em passos curtos e com frases que uma pessoa leiga entende.
// É o que o assistente de IA roda no Passo 3 do INSTALAR.md. Pode rodar de novo à vontade: o que já está pronto é pulado.
//
//   node _fabrica/core/instalar.js            roda os passos
//   node _fabrica/core/instalar.js --simular  só mostra os passos, sem instalar nada
//
// Cada passo imprime: "PASSO n de N: <o que está fazendo>", depois "FEITO" ou "PROBLEMA: <o que houve, em palavras simples>".
// Saída: 0 = tudo pronto; 1 = algum passo obrigatório falhou (o assistente tenta de novo ou pede ajuda).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const simular = process.argv.includes('--simular');

// O npm e o npx no Windows são arquivos .cmd: precisam do shell, com o texto do comando inteiro (sem lista de argumentos).
const roda = (linha, cwd = RAIZ) => spawnSync(linha, { cwd, encoding: 'utf8', shell: true, timeout: 20 * 60 * 1000, maxBuffer: 1 << 26 });
const nodo = (...a) => spawnSync(process.execPath, a, { cwd: RAIZ, encoding: 'utf8', timeout: 5 * 60 * 1000 });
const ultimas = (r) => String((r.stderr || '') + (r.stdout || '')).trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' | ');

const PASSOS = [
  {
    texto: 'Deixando esta pasta só sua (o que você criar aqui não volta para o modelo da Fábrica)',
    obrigatorio: true,
    roda: () => {
      if (!fs.existsSync(path.join(RAIZ, '.git'))) return { ok: true, nota: 'esta pasta não veio do GitHub; nada a fazer' };
      const r = nodo(path.join(RAIZ, '_fabrica', 'core', 'atualizar.js'), 'proteger');
      return { ok: r.status === 0, erro: ultimas(r) };
    },
  },
  {
    texto: 'Instalando os programas de apoio da Fábrica (pode levar alguns minutos)',
    obrigatorio: true,
    roda: () => {
      const r = roda('npm install --no-audit --no-fund');
      return { ok: r.status === 0, erro: ultimas(r) };
    },
  },
  {
    texto: 'Baixando o navegador que a Fábrica usa para desenhar os carrosséis e posts (pode levar alguns minutos)',
    obrigatorio: true,
    roda: () => {
      const r = roda('npx playwright install chromium');
      return { ok: r.status === 0, erro: ultimas(r) };
    },
  },
  {
    // Tudo do vídeo entra AQUI, na instalação, sempre na versão mais nova (ffmpeg, Tesseract, whisper, modelos).
    // Assim nenhuma linha de produção para no meio por falta de programa. Nenhum destes downloads pede login.
    texto: 'Instalando as ferramentas de vídeo na versão mais nova: ffmpeg, Tesseract e transcrição da fala (são ~800 MB; pode levar de 5 a 15 minutos)',
    obrigatorio: true,
    roda: () => {
      if (process.platform !== 'win32') return { ok: true, nota: 'o vídeo da Fábrica só funciona no Windows por enquanto; nada a instalar neste computador' };
      const r = spawnSync(process.execPath, [path.join(RAIZ, '_fabrica', 'core', 'ferramentas.js')], { cwd: RAIZ, encoding: 'utf8', timeout: 30 * 60 * 1000, maxBuffer: 1 << 26 });
      const linhas = String(r.stdout || '').split(/\r?\n/).filter((l) => /^(FERRAMENTA|PROBLEMA)/.test(l));
      linhas.forEach((l) => console.log('  ' + l));
      return { ok: r.status === 0, erro: ultimas(r) };
    },
  },
  {
    texto: 'Conferindo se está tudo no lugar',
    obrigatorio: true,
    roda: () => {
      const r = nodo(path.join(RAIZ, '_fabrica', 'core', 'ambiente.js'), '--json');
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* saída ilegível */ }
      if (!j) return { ok: false, erro: ultimas(r) };
      // No Windows o vídeo também é obrigatório: é o que deixou uma linha parada no meio por falta de programa.
      const grupos = process.platform === 'win32' ? ['obrigatorio', 'imagens', 'video'] : ['obrigatorio', 'imagens'];
      // O acento no endereço da pasta foi escolha da pessoa no Passo 2 (INSTALAR.md): vira aviso, não falha.
      const avisoCaminho = j.itens.some((i) => i.id === 'caminho' && !i.ok);
      const faltam = j.itens.filter((i) => grupos.includes(i.grupo) && i.id !== 'caminho' && !i.ok).map((i) => i.nome);
      if (!faltam.length && avisoCaminho) return { ok: true, nota: 'aviso: o endereço da pasta tem acento ou espaço; os vídeos podem não funcionar' };
      return { ok: faltam.length === 0, erro: faltam.length ? 'ainda falta: ' + faltam.join(', ') : '' };
    },
  },
];

function main() {
  let falhou = false;
  PASSOS.forEach((p, i) => {
    console.log(`PASSO ${i + 1} de ${PASSOS.length}: ${p.texto}`);
    if (simular) { console.log('SIMULADO'); return; }
    const t0 = Date.now();
    const r = p.roda();
    const seg = Math.round((Date.now() - t0) / 1000);
    if (r.ok) console.log(`FEITO (${seg} s)${r.nota ? ': ' + r.nota : ''}`);
    else { console.log(`PROBLEMA: ${r.erro || 'não consegui terminar este passo'}`); if (p.obrigatorio) falhou = true; }
  });
  console.log(falhou ? 'RESULTADO: faltou terminar algum passo. Rode de novo: o que já está pronto é pulado.' : 'RESULTADO: tudo pronto.');
  return falhou ? 1 : 0;
}

module.exports = { PASSOS };
if (require.main === module) process.exit(main());
