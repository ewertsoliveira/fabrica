#!/usr/bin/env node
// Contrato das páginas da organização da pasta (prévia e relatório). Rode: node _fabrica/core/migrar-pagina.test.js
// Pasta temporária com a pasta antiga fictícia da "Aurora Nutrição" (principal) e a "Boreal Advocacia" (boreal). Os
// nomes da empresa e das linhas vêm com marcação de página de propósito (texto de terceiros): a página só os mostra.
// Com FABRICA_CHROMIUM (ou o Chromium do Playwright), confere também que a página cabe em 400 px sem rolar de lado.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;

const MATRIZ = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(__dirname, 'migrar.js');
const pagina = require('./migrar-pagina');
const migrar = require('./migrar');

const temporarias = [];
const casos = [];
const t = (nome, fn) => casos.push([nome, fn]);
const pastaTemp = (p = 'migrar-pagina-') => { const d = fs.mkdtempSync(path.join(os.tmpdir(), p)); temporarias.push(d); return d; };
function escrever(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
}
const NOME = 'Aurora <script>alert(1)</script> & "Nutrição"';
const LINHA = 'Reels <img src=x onerror=alert(2)>';
function pastaAntiga() {
  const r = pastaTemp();
  fs.mkdirSync(path.join(r, '_fabrica'), { recursive: true });
  fs.copyFileSync(path.join(MATRIZ, '_fabrica', 'propriedade.json'), path.join(r, '_fabrica', 'propriedade.json'));
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', `empresa:\n  nome: '${NOME}'\n`);
  escrever(r, '06-MARCA-E-FOTOS/fotos/retrato.jpg', Buffer.alloc(2 * 1024 * 1024, 7));
  escrever(r, '_fabrica/_memoria/empresa.md', '# Perfil\n');
  escrever(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', JSON.stringify([{ id: 'p', name: 'P', tipo: 'post', path: 'linhas/reels/saida/r1/preview.html', desc: 'de 02-PUBLICACOES/x' }], null, 2) + '\n');
  escrever(r, '04-LABORATORIO-DE-DESIGN/rascunho.md', 'solto\n');
  escrever(r, '02-PUBLICACOES/2026-10/p/lamina.png', Buffer.alloc(900, 3));
  escrever(r, 'linhas/reels/linha.yaml', `nome: "${LINHA}"\n`);
  escrever(r, 'linhas/reels/saida/r1/preview.html', '<p>x</p>\n');
  escrever(r, 'linhas/reels/memoria/runs.md', '# Runs\n');
  escrever(r, 'linhas/reels/estado.json', JSON.stringify({ status: 'parada' }) + '\n');
  escrever(r, 'empresas/boreal/marca.yaml', 'empresa:\n  nome: "Boreal Advocacia"\n');
  escrever(r, 'empresas/indice.json', JSON.stringify({ empresas: [
    { codigo: 'principal', nome: NOME, disposicao: 'legado', criada: '2026-10-01' },
    { codigo: 'boreal', nome: 'Boreal Advocacia', disposicao: 'gaveta', criada: '2026-11-01' },
  ] }, null, 2) + '\n');
  return r;
}
function cli(r, args) {
  const x = spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...process.env, FABRICA_RAIZ: r }, encoding: 'utf8', timeout: 120000 });
  return { status: x.status, saida: x.stdout || '', erro: x.stderr || '' };
}
const PALAVRAS_PROIBIDAS = /gaveta|legado|[íi]ndice|manifesto|migra[çc][ãa]o|disposi[çc][ãa]o|\bsha/i;

// O que uma página da organização nunca pode ter.
function conferirPagina(html, r, rotulo) {
  assert.ok(html.startsWith('<!doctype html>'), rotulo + ': sem doctype');
  assert.ok(/<meta name="viewport"/.test(html), rotulo + ': sem viewport');
  // sem rede e sem nada de fora
  assert.ok(!/https?:|\/\/[a-z0-9]/i.test(html), rotulo + ': endereço de rede na página');
  assert.ok(!/<script|<link|<img|<iframe|<[^>]*\ssrc=|url\(|@import/i.test(html), rotulo + ': recurso de fora ou script na página');
  // sem caminho absoluto, sem caminho da pasta e sem termo técnico
  for (const p of [r, os.tmpdir(), MATRIZ]) assert.ok(!html.includes(p) && !html.includes(p.split(path.sep).join('/')), rotulo + ': caminho da máquina na página');
  assert.ok(!/[A-Za-z]:[\\/]|\/Users\/|\/home\//.test(html), rotulo + ': caminho absoluto na página');
  assert.ok(!/#[0-9A-Fa-f]{3,8}\b/.test(html.replace(/&#\d+;/g, '')), rotulo + ': cor em hexadecimal');
  const texto = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');
  assert.ok(!PALAVRAS_PROIBIDAS.test(texto), rotulo + ': palavra técnica no texto: ' + (texto.match(PALAVRAS_PROIBIDAS) || [])[0]);
  assert.ok(!PALAVRAS_PROIBIDAS.test(html), rotulo + ': palavra técnica no código da página: ' + (html.match(PALAVRAS_PROIBIDAS) || [])[0]);
  assert.ok(!/linhas\/|empresas\/|06-MARCA|_fabrica/.test(texto), rotulo + ': nome de arquivo na página');
  // texto de terceiros escapado
  assert.ok(html.includes('Aurora &lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Nutrição&quot;'), rotulo + ': nome da empresa não escapado');
  assert.ok(!html.includes('<img src=x'), rotulo + ': nome da linha virou página');
}
// Os números da página são os do --json (o total e cada grupo).
function conferirNumeros(html, inv, rotulo) {
  assert.ok(html.includes(`data-total-arquivos="${inv.itens.length}"`), rotulo + ': total diferente do --json');
  const porGrupo = new Map();
  for (const i of inv.itens) { const k = `${i.grupo}|${i.linha || ''}`; porGrupo.set(k, (porGrupo.get(k) || 0) + 1); }
  for (const [k, n] of porGrupo) {
    const [grupo, linha] = k.split('|');
    assert.ok(html.includes(`data-grupo="${grupo}" data-linha="${linha}" data-arquivos="${n}"`), `${rotulo}: o grupo ${k} não mostra ${n}`);
  }
  const somados = [...html.matchAll(/data-conjunto="[^"]*" data-arquivos="(\d+)"/g)].reduce((s, m) => s + Number(m[1]), 0);
  assert.strictEqual(somados, inv.itens.length, rotulo + ': os cartões não somam o total');
}

t('prévia: sem rede, sem caminho, sem termo técnico, nome escapado e os números do --json', (c) => {
  const inv = JSON.parse(cli(c.r, ['simular', '--json']).saida);
  const fora = pastaTemp('migrar-pagina-previa-');
  const x = cli(c.r, ['previa', '--pasta', fora]);
  assert.strictEqual(x.status, 0, x.saida + x.erro);
  const j = JSON.parse(x.saida);
  const html = fs.readFileSync(j.pagina, 'utf8');
  conferirPagina(html, c.r, 'prévia');
  conferirNumeros(html, inv, 'prévia');
  assert.ok(html.includes('2,0 MB'), 'o total em MB');
  assert.ok(html.includes('Prévia da organização') && html.includes('nada foi alterado'));
  c.paginas.push(j.pagina);
});

t('relatório: o mesmo contrato, depois de organizar; marcado ao desfazer', (c) => {
  const inv = JSON.parse(cli(c.r, ['simular', '--json']).saida);
  const a = cli(c.r, ['aplicar', '--confirmar', inv.codigoSimulacao, '--json']);
  assert.strictEqual(a.status, 0, a.saida + a.erro);
  const j = JSON.parse(a.saida);
  const arq = path.join(c.r, ...j.relatorioPagina.split('/'));
  const html = fs.readFileSync(arq, 'utf8');
  conferirPagina(html, c.r, 'relatório');
  conferirNumeros(html, inv, 'relatório');
  assert.ok(html.includes('Abra uma conversa nova') && html.includes('Como desfazer') && html.includes('/fabrica organizar-pasta desfazer'));
  assert.ok(html.includes(j.carimbo), 'o código da organização');
  assert.ok(html.includes('1 endereço de peça ou post foi atualizado na cópia'), 'o relatório fala no passado');
  // uma cópia de como ela está agora, para a medida em 400 px (o desfazer leva a página para a cópia de segurança)
  const copia = path.join(pastaTemp('migrar-pagina-relatorio-'), 'relatorio.html');
  fs.copyFileSync(arq, copia);
  c.paginas.push(copia);
  // nada nasceu na pasta da boreal
  assert.deepStrictEqual(fs.readdirSync(path.join(c.r, 'empresas', 'boreal')), ['marca.yaml']);
  const d = cli(c.r, ['desfazer', '--confirmar', '--json']);
  assert.strictEqual(d.status, 0, d.saida + d.erro);
  const dj = JSON.parse(d.saida);
  const desfeita = fs.readFileSync(path.join(c.r, ...dj.relatorioPagina.split('/')), 'utf8');
  conferirPagina(desfeita, c.r, 'relatório desfeito');
  assert.ok(desfeita.includes('data-situacao="desfeita"') && desfeita.includes('Desfeita em'));
  c.paginas.push(path.join(c.r, ...dj.relatorioPagina.split('/')));
});

t('as funções escapam todo texto e não dependem da pasta', () => {
  const d = {
    nome: '<b>x</b>', conjuntos: [{ chave: 'marca', rotulo: '<i>', arquivos: 1, conta: '1 arquivo', partes: [{ grupo: 'marca', linha: '', rotulo: '"q"', arquivos: 1, conta: '1 arquivo' }] }],
    total: { arquivos: 1, tamanho: 'menos de 1 MB' }, semLugar: 0, atalhos: 0, textoSemLugar: '', textoAtalhos: '', textoDoModelo: "<u>'</u>",
    jaNoLugar: null, enderecos: null, avisos: ['<em>a</em>'], recusas: ['<s>r</s>'], feitaEm: '<x>', carimbo: '<c>', fraseDesfazer: '<f>',
  };
  for (const html of [pagina.paginaPrevia(d), pagina.paginaRelatorio(d), pagina.paginaRelatorio(d, { situacao: 'desfeita', quando: '<q>' })]) {
    for (const cru of ['<b>x', '<i>', '"q"', "<u>'", '<em>a', '<s>r', '<x>', '<c>', '<f>', '<q>']) assert.ok(!html.includes(cru), 'não escapou: ' + cru);
  }
  assert.ok(pagina.paginaPrevia(d).includes('Ainda não dá para organizar agora'), 'a recusa aparece na prévia');
  // um arquivo só: concordância; a página desfeita não manda desfazer de novo
  assert.ok(/1<\/b><span>arquivo vai para a pasta da empresa/.test(pagina.paginaPrevia(d)), 'prévia com 1 arquivo');
  assert.ok(/1<\/b><span>arquivo copiado e conferido</.test(pagina.paginaRelatorio(d)), 'relatório com 1 arquivo');
  assert.ok(pagina.paginaRelatorio(d).includes('Como desfazer'));
  assert.ok(!pagina.paginaRelatorio(d, { situacao: 'desfeita', quando: 'x' }).includes('Como desfazer'), 'a página desfeita mostra "Como desfazer"');
  assert.strictEqual(typeof migrar.dadosDaPagina, 'function');
});

t('cabe em 400 px e em 1280 px sem rolar de lado', async (c) => {
  let abrir;
  try { ({ abrir } = require('../../08-FERRAMENTAS/carrossel/navegador')); } catch { abrir = null; }
  let nav = null;
  try { nav = abrir ? await abrir() : null; } catch (e) { console.log('     (sem navegador: ' + String(e.message).split('\n')[0] + ')'); return 'pulado'; }
  if (!nav) return 'pulado';
  try {
    for (const p of c.paginas) {
      for (const largura of [400, 1280]) {
        const pg = await nav.newPage({ viewport: { width: largura, height: 900 } });
        await pg.goto(require('url').pathToFileURL(p).href);
        const larg = await pg.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(larg <= largura, `${path.basename(p)} em ${largura} px rola de lado (${larg} px)`);
        if (process.env.MIGRAR_PAGINA_CAPTURAS) await pg.screenshot({ path: path.join(process.env.MIGRAR_PAGINA_CAPTURAS, `${path.basename(p, '.html')}-${largura}.png`), fullPage: true });
        await pg.close();
      }
    }
  } finally {
    await nav.close();
  }
});

(async () => {
  const c = { r: pastaAntiga(), paginas: [] };
  let n = 0;
  let falhas = 0;
  for (const [nome, fn] of casos) {
    try {
      const x = await fn(c);
      n++;
      console.log((x === 'pulado' ? 'pulado ' : 'ok   ') + nome);
    } catch (e) {
      falhas++;
      console.log('FALHOU ' + nome + '\n     ' + (e.stack || e));
    }
  }
  for (const d of temporarias) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* o sistema limpa depois */ } }
  console.log(`\n${n} de ${casos.length} casos passaram${falhas ? `; ${falhas} falharam` : ''}`);
  process.exitCode = falhas ? 1 : 0;
})();
