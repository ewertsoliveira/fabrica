// Abre o Chromium do Playwright para renderizar e medir as lâminas. Renderização por navegador controlado por script
// não tem a limitação do file:// (T-05).
// Numa máquina em que o Playwright não instalou o próprio Chromium, aponte FABRICA_CHROMIUM para um Chromium ou Chrome.
'use strict';

async function abrir() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch {
    throw new Error('Playwright não está instalado. Na raiz da Fábrica, rode: npm install  e depois  npx playwright install chromium');
  }
  const executablePath = process.env.FABRICA_CHROMIUM || undefined;
  try {
    return await chromium.launch(executablePath ? { executablePath } : {});
  } catch (e) {
    throw new Error(`Não consegui abrir o Chromium (${String(e.message).split('\n')[0]}). Rode: npx playwright install chromium, ou defina FABRICA_CHROMIUM com o caminho de um Chromium ou Chrome.`);
  }
}

module.exports = { abrir };
