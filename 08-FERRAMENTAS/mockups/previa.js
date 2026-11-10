#!/usr/bin/env node
// Gera a prévia da biblioteca de mockups, pintada pelo marca.yaml atual: cada componente sobre o fundo escuro da marca
// (interface clara, M-06) e sobre o fundo claro (interface escura). No fim, um exemplo com marcadores numerados (M-08).
// Uso: node 08-FERRAMENTAS/mockups/previa.js   ->   08-FERRAMENTAS/mockups/previa.html
'use strict';
const fs = require('fs');
const path = require('path');
const mk = require('./mockups');
const marca = require(path.join(__dirname, '..', 'marca', 'marca'));

const NOMES = {
  perfil: 'Perfil de Instagram', busca: 'Resultado de busca', post: 'Post com engajamento', story: 'Story com enquete',
  conversa: 'Conversa no direct', notificacao: 'Notificação', navegador: 'Janela de navegador', planilha: 'Planilha',
  documento: 'Documento', cartaoApp: 'Cartão de aplicativo', checklist: 'Checklist', antesDepois: 'Antes e depois',
};
const painel = (fundo, html, legenda) => `<figure class="pv-painel" style="background:${marca.hex(fundo)};color:${mk.textoSobre(marca.hex(fundo))}"><div class="pv-palco">${html}</div><figcaption>${legenda}</figcaption></figure>`;

const blocos = Object.entries(mk.COMPONENTES).map(([k, fn]) => {
  const escuroOk = k !== 'story' && k !== 'notificacao';
  return `<section class="pv-comp" id="${k}"><h2>${NOMES[k]}</h2><div class="pv-fila">
${painel('escuro', fn({ modo: 'claro' }), 'Interface clara sobre fundo escuro (M-06)')}
${escuroOk ? painel('claro', fn({ modo: 'escuro' }), 'Interface no modo escuro, sobre fundo claro') : painel('claro', fn({ modo: 'claro' }), 'Sobre fundo claro')}
</div></section>`;
}).join('\n');

const marcadores = painel('acento', mk.comMarcadores(mk.perfil({ modo: 'claro' }), [{ n: 1, x: 25, y: 6 }, { n: 2, x: 41, y: 27.5 }, { n: 3, x: 17, y: 57 }]), 'Marcadores numerados sobre as partes citadas no texto (M-08)');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Biblioteca de mockups</title>
<style>
body{margin:0;background:#F4F4F2;color:#1A1A1A;font:16px/1.5 system-ui,sans-serif;padding:24px max(16px,env(safe-area-inset-left))}
h1{margin:0 0 4px;font-size:26px}.pv-int{max-width:760px;margin:0 0 24px;color:#555}
.pv-comp{margin:0 0 36px}.pv-comp h2{margin:0 0 10px;font-size:18px}
.pv-fila{display:flex;flex-wrap:wrap;gap:16px}
.pv-painel{margin:0;padding:36px;border-radius:14px;display:flex;flex-direction:column;align-items:center;gap:14px}
.pv-palco{zoom:.42}
.pv-painel figcaption{font-size:13px;opacity:.85;max-width:380px;text-align:center}
nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 24px}nav a{padding:4px 10px;border-radius:20px;background:#fff;color:inherit;text-decoration:none;font-size:13px;border:1px solid #ddd}
${mk.css()}
</style></head><body>
<h1>Biblioteca de mockups</h1>
<p class="pv-int">Doze componentes de interface e os marcadores numerados, pintados pelo contrato de marca atual${marca.EXEMPLO ? ' (marca de exemplo, fictícia)' : ''}. O cromo imita cada plataforma; o conteúdo de dentro usa as cores da marca. Texto de interface entre ${mk.ESCALA.rotulo} e ${mk.ESCALA.destaque} px no tamanho real da peça.</p>
<nav>${Object.keys(mk.COMPONENTES).map((k) => `<a href="#${k}">${NOMES[k]}</a>`).join('')}<a href="#marcadores">Marcadores</a></nav>
${blocos}
<section class="pv-comp" id="marcadores"><h2>Marcadores numerados</h2><div class="pv-fila">${marcadores}</div></section>
</body></html>`;
const saida = path.join(__dirname, 'previa.html');
fs.writeFileSync(saida, html);
console.log('prévia: ' + saida);
