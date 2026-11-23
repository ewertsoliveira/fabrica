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
const { sistema } = require('./programas');
const { macosSuportado } = require('./ferramentas');

const RAIZ = path.resolve(__dirname, '..', '..');
const simular = process.argv.includes('--simular');
// uns 800 MB de programas de vídeo (e, no Mac, a montagem do whisper): com internet lenta, passa fácil de 40 minutos
const LIMITE_VIDEO_MS = 90 * 60 * 1000;

/** A parte de vídeo roda no Windows e no Mac (macOS 14 ou mais novo, exigência do Tesseract). */
function videoNesteSistema(sis = sistema()) {
  if (sis.plataforma === 'win32') return { roda: true };
  if (sis.plataforma === 'darwin') {
    return macosSuportado(sis.macos) ? { roda: true }
      : { roda: false, nota: `este Mac está no macOS ${sis.macos ? sis.macos.join('.') : '(versão desconhecida)'}; os vídeos exigem o macOS 14 ou mais novo, e o desenho dos carrosséis também pede o 14` };
  }
  return { roda: false, nota: 'a parte de vídeo da Fábrica funciona no Windows e no Mac; neste computador, nada a instalar' };
}
/** A conferência final: o que falta de verdade e o que é só aviso (acento na pasta, Mac antigo para vídeo). */
function conclusaoFinal(itens, sis = sistema()) {
  const v = videoNesteSistema(sis);
  // onde o vídeo roda, ele também é obrigatório: é o que deixou uma linha parada no meio por falta de programa
  const grupos = v.roda ? ['obrigatorio', 'imagens', 'video'] : ['obrigatorio', 'imagens'];
  const avisos = [];
  // o acento no endereço da pasta foi escolha da pessoa no Passo 2 (INSTALAR.md): vira aviso, não falha
  if (itens.some((i) => i.id === 'caminho' && !i.ok)) avisos.push('o endereço da pasta tem acento ou espaço; os vídeos podem não funcionar');
  if (!v.roda && sis.plataforma === 'darwin') avisos.push(v.nota);
  const faltam = itens.filter((i) => grupos.includes(i.grupo) && i.id !== 'caminho' && i.id !== 'macos' && !i.ok).map((i) => i.nome);
  if (faltam.length) return { ok: false, erro: 'ainda falta: ' + faltam.join(', ') };
  return avisos.length ? { ok: true, nota: 'aviso: ' + avisos.join('; ') } : { ok: true };
}

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
      const v = videoNesteSistema();
      if (!v.roda) return { ok: true, nota: v.nota };
      // no Mac, além de baixar, o whisper é montado na própria máquina (alguns minutos a mais)
      const r = spawnSync(process.execPath, [path.join(RAIZ, '_fabrica', 'core', 'ferramentas.js')], { cwd: RAIZ, encoding: 'utf8', timeout: LIMITE_VIDEO_MS, maxBuffer: 1 << 26 });
      // o detalhe técnico vai junto para o assistente (que nunca o mostra à pessoa) saber o que resolver
      const linhas = String(r.stdout || '').split(/\r?\n/).filter((l) => /^(FERRAMENTA|FEITO|PROBLEMA|\s+\(detalhe técnico)/.test(l));
      linhas.forEach((l) => console.log('  ' + l.trim()));
      const ultimoProblema = linhas.filter((l) => /^PROBLEMA:/.test(l)).pop();
      return { ok: r.status === 0, erro: ultimoProblema ? ultimoProblema.replace(/^PROBLEMA:\s*/, '') : ultimas(r) };
    },
  },
  {
    // Esconde as pastas técnicas e libera espaço (só a peça de recorte deste computador; do Tesseract, a versão em uso e
    // a anterior). Vem antes da conferência, que testa de novo se a peça de recorte carrega. Nunca derruba a instalação.
    texto: 'Arrumando a pasta para você ver só o que é seu (e liberando espaço)',
    obrigatorio: true,
    roda: () => {
      const r = nodo(path.join(RAIZ, '_fabrica', 'core', 'arrumar.js'), '--json');
      let j = null;
      try { j = JSON.parse(r.stdout); } catch { /* saída ilegível */ }
      if (!j) return { ok: true, nota: 'não consegui arrumar a pasta agora; a Fábrica funciona do mesmo jeito' };
      return j.frase ? { ok: true, nota: j.frase } : { ok: true };
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
      return conclusaoFinal(j.itens);
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

module.exports = { PASSOS, videoNesteSistema, conclusaoFinal, LIMITE_VIDEO_MS };
if (require.main === module) process.exit(main());
