// Mede a largura real (render do Tesseract) de um texto, usando projetos/medir-palavras.js (só leitura), com cache em
// .work/medidas.json. Sem Tesseract ou em caso de erro, cai numa estimativa por letra e avisa em stderr.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SCRIPT = path.join(__dirname, '..', 'projetos', 'medir-palavras.js');
const CACHE = path.join(__dirname, '.work', 'medidas.json');
const EM_ESTIMADO = { Bold: 0.58, ExtraBold: 0.62, Black: 0.67, Regular: 0.54 };

function medirLargura(texto, tam, estilo = 'Bold') {
  const chave = `${texto}|${tam}|${estilo}`;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { /* sem cache ainda */ }
  if (cache[chave]) return cache[chave];
  let w;
  try {
    const out = execFileSync('node', [SCRIPT, texto, String(tam), estilo, '', '', '0'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop();
    w = JSON.parse(out)[texto].w;
  } catch (err) {
    w = Math.round(texto.length * tam * (EM_ESTIMADO[estilo] || 0.6));
    console.error(`aviso: não consegui medir "${texto}" no Tesseract; usando estimativa de ${w}px (${err.message.split('\n')[0]})`);
    return w;
  }
  try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); cache[chave] = w; fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1)); } catch { /* cache é opcional */ }
  return w;
}
module.exports = { medirLargura };
