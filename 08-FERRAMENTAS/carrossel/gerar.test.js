#!/usr/bin/env node
// Teste de ponta a ponta do gerador de carrossel: roda o gerador de verdade, no Chromium, e confere os arquivos.
// Rode: node 08-FERRAMENTAS/carrossel/gerar.test.js   (precisa do Chromium; veja navegador.js)
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const molde = require('./molde');
const { resolverArquivos } = require('./gerar');

const GERAR = path.join(__dirname, 'gerar.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'carrossel-'));
let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };
const demo = (id) => JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, id, 'demo.json'), 'utf8'));
const LEGENDA = 'Imposto, férias e décimo terceiro já estão gastos antes de chegar a data de pagar. Salve este carrossel e volte a ele no primeiro dia útil do mês.';
const escreve = (nome, conteudo) => { const arq = path.join(TMP, nome + '.json'); fs.writeFileSync(arq, JSON.stringify(conteudo)); return arq; };
const gerar = (arq, saida, ...extra) => {
  const r = spawnSync(process.execPath, [GERAR, arq, '--saida', saida, '--cores', 'sugestao', ...extra], { encoding: 'utf8', env: process.env, timeout: 180000 });
  return { codigo: r.status, saida: (r.stdout || '') + (r.stderr || '') };
};
const png = (arq) => { const b = fs.readFileSync(arq); return { tipo: b.slice(1, 4).toString(), l: b.readUInt32BE(16), a: b.readUInt32BE(20) }; };
const existe = (...p) => fs.existsSync(path.join(...p));

// ---------- resolverArquivos (sem navegador)
t('arquivos: foto que falta sem alternativa vira erro com a descrição da imagem', () => {
  const r = resolverArquivos([{ titulo: 'x', visual: { tipo: 'foto', arquivo: 'nao/existe.jpg', descricao: 'mesa de trabalho com café' } }]);
  assert.strictEqual(r.erros.length, 1);
  assert.ok(/mesa de trabalho com café/.test(r.erros[0]) && /lâmina 1/.test(r.erros[0]));
});
t('arquivos: foto que falta com alternativa entra a alternativa e avisa (D1, I-16)', () => {
  const r = resolverArquivos([{ titulo: 'x', visual: { tipo: 'foto', arquivo: 'nao/existe.jpg', descricao: 'mesa', alternativa: { tipo: 'numero', valor: '3' } } }]);
  assert.deepStrictEqual(r.erros, []);
  assert.strictEqual(r.conteudos[0].visual.tipo, 'numero');
  assert.ok(r.avisos.length === 1);
});
t('arquivos: foto que existe passa sem aviso', () => {
  const r = resolverArquivos([{ titulo: 'x', foto: '04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/xicara.jpg' }]);
  assert.deepStrictEqual([r.erros, r.avisos], [[], []]);
});

// ---------- gerador no navegador
const conteudo = escreve('contraste', { estilo: 'contraste', legenda: LEGENDA, laminas: demo('contraste') });
const SAIDA = path.join(TMP, 'saida');

t('passo 1: renderiza só a primeira lâmina e pára (DG-18)', () => {
  const r = gerar(conteudo, SAIDA);
  assert.strictEqual(r.codigo, 0, r.saida);
  assert.ok(existe(SAIDA, 'lamina-01.png'));
  assert.ok(!existe(SAIDA, 'lamina-02.png'), 'a segunda lâmina não podia existir antes da aprovação');
  assert.ok(!existe(SAIDA, 'preview.html'));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(SAIDA, 'estado.json'), 'utf8')).etapa, 'primeira');
  assert.ok(/--resto/.test(r.saida));
  assert.deepStrictEqual(png(path.join(SAIDA, 'lamina-01.png')), { tipo: 'PNG', l: 1080, a: 1350 }); // T-02, T-09
});
t('--resto numa pasta sem primeira lâmina recusa (DG-18)', () => {
  const r = gerar(conteudo, path.join(TMP, 'vazia'), '--resto');
  assert.strictEqual(r.codigo, 2);
  assert.ok(/primeiro sem --resto/.test(r.saida));
});
t('--resto com a primeira lâmina alterada depois da aprovação recusa', () => {
  const l = demo('contraste'); l[0].titulo = 'Outro título *mudou*';
  const r = gerar(escreve('contraste-alterado', { estilo: 'contraste', legenda: LEGENDA, laminas: l }), SAIDA, '--resto');
  assert.strictEqual(r.codigo, 2);
  assert.ok(/mudou depois da aprovação/.test(r.saida));
});
t('corrigir outra lâmina depois da aprovação da primeira não obriga a aprová-la de novo; a entrega acompanha o conteúdo novo', () => {
  const pasta = path.join(TMP, 'corrige-outra');
  assert.strictEqual(gerar(conteudo, pasta).codigo, 0);
  const l = demo('contraste'); l[1].kicker = 'por que acontece mesmo';
  const novo = escreve('contraste-lamina2', { estilo: 'contraste', legenda: LEGENDA, laminas: l });
  const r = gerar(novo, pasta, '--resto');
  assert.strictEqual(r.codigo, 0, r.saida);
  assert.strictEqual(gerar(novo, pasta, '--entregar').codigo, 0);
  const velho = gerar(conteudo, pasta, '--entregar');
  assert.strictEqual(velho.codigo, 2);
  assert.ok(/mudou depois da renderização/.test(velho.saida));
});
t('passo 2: renderiza o resto, confere e monta a prévia, o HTML e as miniaturas', () => {
  const r = gerar(conteudo, SAIDA, '--resto');
  assert.strictEqual(r.codigo, 0, r.saida);
  const total = demo('contraste').length;
  for (let i = 1; i <= total; i++) assert.deepStrictEqual(png(path.join(SAIDA, `lamina-${String(i).padStart(2, '0')}.png`)), { tipo: 'PNG', l: 1080, a: 1350 }, `lâmina ${i}`);
  for (const f of ['preview.html', 'carrossel.html', 'conferencia.txt', 'legenda.txt', 'miniaturas-100px.png']) assert.ok(existe(SAIDA, f), f);
  const mini = png(path.join(SAIDA, 'miniaturas-100px.png'));
  assert.ok(mini.a < 300 && mini.l < 1000, `as miniaturas vieram com o branco do canvas em volta (${mini.l}x${mini.a})`);
  assert.ok(/^APROVADO/.test(fs.readFileSync(path.join(SAIDA, 'conferencia.txt'), 'utf8')));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(SAIDA, 'estado.json'), 'utf8')).etapa, 'completo');
});
t('prévia: um arquivo só, com todas as lâminas embutidas, seta, contador e área segura (L-03, L-08, T-06, T-12)', () => {
  const h = fs.readFileSync(path.join(SAIDA, 'preview.html'), 'utf8');
  assert.strictEqual((h.match(/<figure class="sl"/g) || []).length, demo('contraste').length);
  assert.ok(!/src="(?!data:)/.test(h), 'imagem por caminho relativo');
  for (const k of ['id="prox"', 'id="ant"', 'id="chip"', 'id="seg"', 'aria-label="Lâminas do carrossel"']) assert.ok(h.includes(k), k);
  assert.ok(h.includes(LEGENDA.slice(0, 40)));
});
t('HTML entregue: autocontido, sem endereço de arquivo local (T-01, T-06)', () => {
  const h = fs.readFileSync(path.join(SAIDA, 'carrossel.html'), 'utf8');
  assert.ok(!/file:\/\//.test(h), 'endereço de arquivo local no HTML');
  assert.ok(!/<script/.test(h), 'o HTML da peça não tem JavaScript de layout (T-01)');
  assert.ok(/crossorigin="anonymous"/.test(h), 'fonte externa sem crossorigin (T-03)');
  assert.strictEqual((h.match(/class="lamina /g) || []).length, demo('contraste').length);
});
t('--entregar copia só o que saiu aprovado: lâminas, HTML e legenda (F3)', () => {
  const r = gerar(conteudo, SAIDA, '--entregar');
  assert.strictEqual(r.codigo, 0, r.saida);
  const total = demo('contraste').length;
  const entregues = fs.readdirSync(path.join(SAIDA, 'entrega')).sort();
  const esperado = [...Array.from({ length: total }, (_, i) => `lamina-${String(i + 1).padStart(2, '0')}.png`), 'carrossel.html', 'legenda.txt'].sort();
  assert.deepStrictEqual(entregues, esperado);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(SAIDA, 'estado.json'), 'utf8')).etapa, 'entregue');
  assert.strictEqual(gerar(conteudo, SAIDA, '--entregar').codigo, 0, 'entregar de novo é inofensivo');
});
t('--entregar com o conteúdo alterado depois da renderização recusa', () => {
  const l = demo('contraste'); l[2].titulo = 'Título trocado depois do preview';
  const r = gerar(escreve('contraste-trocado', { estilo: 'contraste', legenda: LEGENDA, laminas: l }), SAIDA, '--entregar');
  assert.strictEqual(r.codigo, 2);
  assert.ok(/mudou depois da renderização/.test(r.saida));
});
t('--entregar antes de renderizar o resto recusa', () => {
  const pasta = path.join(TMP, 'so-primeira');
  assert.strictEqual(gerar(conteudo, pasta).codigo, 0);
  const r = gerar(conteudo, pasta, '--entregar');
  assert.strictEqual(r.codigo, 2);
  assert.ok(/ainda não foi renderizada por inteiro/.test(r.saida));
  assert.ok(!existe(pasta, 'entrega'));
});
t('--resto e --entregar juntos recusam', () => {
  const r = gerar(conteudo, SAIDA, '--resto', '--entregar');
  assert.strictEqual(r.codigo, 2);
  assert.ok(/um de cada vez/.test(r.saida));
});
t('texto reprovado bloqueia antes de renderizar', () => {
  const l = demo('contraste'); l[0].titulo = 'O caixa fecha no azul!';
  const saida = path.join(TMP, 'bloqueada');
  const r = gerar(escreve('com-exclamacao', { estilo: 'contraste', laminas: l }), saida);
  assert.strictEqual(r.codigo, 1);
  assert.ok(/C-09/.test(r.saida));
  assert.ok(!existe(saida, 'lamina-01.png'), 'não deveria ter renderizado');
});
t('foto que falta sem alternativa bloqueia e diz o que falta', () => {
  const l = demo('papelaria'); l[0].foto = 'nao/existe.jpg';
  const r = gerar(escreve('sem-foto', { estilo: 'papelaria', laminas: l }), path.join(TMP, 'sem-foto'));
  assert.strictEqual(r.codigo, 1);
  assert.ok(/não existe/.test(r.saida));
});
t('peça reprovada pelo conferidor: sai o relatório e os arquivos, com código de saída 1', () => {
  const l = demo('contraste'); delete l[1].visual; // lâmina 2 sem elemento visual (DG-09)
  const arq = escreve('sem-visual', { estilo: 'contraste', legenda: LEGENDA, laminas: l });
  const saida = path.join(TMP, 'reprovada');
  assert.strictEqual(gerar(arq, saida).codigo, 0, 'a primeira lâmina está certa');
  const r = gerar(arq, saida, '--resto');
  assert.strictEqual(r.codigo, 1);
  assert.ok(/REPROVADO/.test(r.saida) && /DG-09/.test(r.saida));
  assert.ok(existe(saida, 'preview.html') && /DG-09/.test(fs.readFileSync(path.join(saida, 'conferencia.txt'), 'utf8')));
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(saida, 'estado.json'), 'utf8')).aprovadoPeloConferidor, false);
});
t('--entregar de peça reprovada pelo conferidor recusa e não cria a pasta de entrega', () => {
  const l = demo('contraste'); delete l[1].visual;
  const r = gerar(escreve('sem-visual', { estilo: 'contraste', legenda: LEGENDA, laminas: l }), path.join(TMP, 'reprovada'), '--entregar');
  assert.strictEqual(r.codigo, 2);
  assert.ok(/conferidor reprovou/.test(r.saida));
  assert.ok(!existe(TMP, 'reprovada', 'entrega'));
});
t('--cores aceita original (as cores aprovadas do estilo) e recusa valor desconhecido', () => {
  const pasta = path.join(TMP, 'cores-original');
  const ok = spawnSync(process.execPath, [GERAR, conteudo, '--saida', pasta, '--cores', 'original'], { encoding: 'utf8', env: process.env, timeout: 180000 });
  assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(pasta, 'estado.json'), 'utf8')).cores, 'sugestao');
  const ruim = spawnSync(process.execPath, [GERAR, conteudo, '--saida', pasta, '--cores', 'azul'], { encoding: 'utf8' });
  assert.strictEqual(ruim.status, 2); assert.ok(/--cores deve ser/.test(ruim.stderr));
});
t('estilo que não existe e opção desconhecida dão erro claro', () => {
  const e1 = gerar(escreve('sem-estilo', { estilo: 'nao-existe', laminas: demo('contraste') }), path.join(TMP, 'x'));
  assert.strictEqual(e1.codigo, 2); assert.ok(/estilo não encontrado/.test(e1.saida));
  const e2 = spawnSync(process.execPath, [GERAR, conteudo, '--saida', TMP, '--foo'], { encoding: 'utf8' });
  assert.strictEqual(e2.status, 2); assert.ok(/opção desconhecida/.test(e2.stderr));
});

// ---------- fixados e capa de Reels
const demoF = (id, f) => JSON.parse(fs.readFileSync(path.join(molde.PASTA_ESTILOS, id, `demo-${f}.json`), 'utf8'));
t('fixados: 3 PNG de 1080x1440, sem navegação, e a prévia mostra a grade do perfil', () => {
  const arq = escreve('fixados', { estilo: 'vitrine', formato: 'fixados', laminas: demoF('vitrine', 'fixados') });
  const saida = path.join(TMP, 'fixados');
  gerar(arq, saida); const r = gerar(arq, saida, '--resto');
  assert.ok(/APROVADO/.test(r.saida), r.saida);
  for (const i of [1, 2, 3]) assert.deepStrictEqual(png(path.join(saida, `lamina-0${i}.png`)), { tipo: 'PNG', l: 1080, a: 1440 });
  assert.ok(!existe(saida, 'lamina-04.png'));
  const html = fs.readFileSync(path.join(saida, 'preview.html'), 'utf8');
  assert.ok(/grade3/.test(html) && /posts fixados/.test(html));
});
t('post estático: um PNG de 1080x1350, prévia de uma imagem e entrega sem passar por carrossel', () => {
  const arq = escreve('post', { estilo: 'contraste', formato: 'post', legenda: LEGENDA, laminas: demo('contraste').slice(0, 1) });
  const saida = path.join(TMP, 'post');
  const p1 = gerar(arq, saida);
  assert.ok(/Post estático pronto/.test(p1.saida) && !/as outras/.test(p1.saida), p1.saida);
  const r = gerar(arq, saida, '--resto');
  assert.ok(/APROVADO/.test(r.saida), r.saida);
  assert.deepStrictEqual(png(path.join(saida, 'lamina-01.png')), { tipo: 'PNG', l: 1080, a: 1350 });
  assert.ok(!existe(saida, 'lamina-02.png'));
  const html = fs.readFileSync(path.join(saida, 'preview.html'), 'utf8');
  assert.ok(/1 imagem/.test(html) && !/1 lâminas/.test(html));
  const e = gerar(arq, saida, '--entregar');
  assert.strictEqual(e.codigo, 0, e.saida);
  assert.ok(existe(saida, 'entrega', 'lamina-01.png') && existe(saida, 'entrega', 'legenda.txt'));
});
t('post estático: mais de uma lâmina é recusado antes de renderizar', () => {
  const r = gerar(escreve('post-2', { estilo: 'contraste', formato: 'post', laminas: demo('contraste').slice(0, 2) }), path.join(TMP, 'post2'));
  assert.notStrictEqual(r.codigo, 0); assert.ok(/post estático é uma imagem só/.test(r.saida), r.saida);
});
t('capa de Reels: PNG de 1080x1920 com o texto na área segura; --formato pela linha de comando', () => {
  const arq = escreve('reels', demoF('primeira-pagina', 'reels').slice(0, 1));
  const saida = path.join(TMP, 'reels');
  gerar(arq, saida, '--estilo', 'primeira-pagina', '--formato', 'reels'); const r = gerar(arq, saida, '--estilo', 'primeira-pagina', '--formato', 'reels', '--resto');
  assert.ok(/APROVADO/.test(r.saida), r.saida);
  assert.deepStrictEqual(png(path.join(saida, 'lamina-01.png')), { tipo: 'PNG', l: 1080, a: 1920 });
  assert.ok(/faixa topo/.test(fs.readFileSync(path.join(saida, 'preview.html'), 'utf8')));
});
t('calibração: formato desconhecido e estilo só de capa num carrossel dão erro claro', () => {
  const e1 = gerar(escreve('fmt', { estilo: 'vitrine', laminas: demo('vitrine') }), path.join(TMP, 'f1'), '--formato', 'story');
  assert.strictEqual(e1.codigo, 2); assert.ok(/--formato deve ser/.test(e1.saida));
  const e2 = gerar(escreve('so-capa', { estilo: 'primeira-pagina', laminas: demo('vitrine') }), path.join(TMP, 'f2'));
  assert.strictEqual(e2.codigo, 2); assert.ok(/só de capa de Reels/.test(e2.saida), e2.saida);
});

// ---------- o estilo da empresa (estilo.json) e o estilo próprio com a rede fechada ----------
// Raiz de dados temporária com a empresa fictícia aurora (ativa) e um estilo próprio dela, cópia do Colagem do catálogo.
// O objeto "adesivo" do Colagem põe o desenho da lâmina na página sem conferir ({{{svg}}}): um desenho vindo do conteúdo
// com uma imagem de fora é o recurso de fora que a rede fechada precisa barrar.
const http = require('http');
const { spawn } = require('child_process');
const empresaMod = require(path.join(__dirname, '..', '..', '_fabrica', 'core', 'empresa.js'));
const RAIZ_DADOS = path.join(TMP, 'raiz-dados');
function copiarComoProprio(base, id, pasta) {
  const para = path.join(pasta, id);
  fs.cpSync(path.join(molde.PASTA_ESTILOS, base), para, { recursive: true });
  const y = fs.readFileSync(path.join(para, 'estilo.yaml'), 'utf8').replace(/^id:.*$/m, `id: ${id}`).replace(/^origem:.*$/m, 'origem: referencias').replace(/^nome:.*$/m, 'nome: Colagem da Aurora');
  fs.writeFileSync(path.join(para, 'estilo.yaml'), y);
  const css = path.join(para, 'estilo.css');
  if (fs.existsSync(css)) fs.writeFileSync(css, fs.readFileSync(css, 'utf8').split(`.est-${base}`).join(`.est-${id}`));
}
function gerarAsync(args, env) {
  return new Promise((ok) => {
    const p = spawn(process.execPath, [GERAR, ...args], { env: { ...process.env, ...env } });
    let saida = '';
    p.stdout.on('data', (d) => { saida += d; }); p.stderr.on('data', (d) => { saida += d; });
    const limite = setTimeout(() => p.kill(), 180000);
    p.on('close', (codigo) => { clearTimeout(limite); ok({ codigo, saida }); });
  });
}
const estiloJson = (estilo, origem) => JSON.stringify({ versao: 1, estilo, origem, escolhido: '2026-11-05T12:00:00.000Z', personalizacoes: {}, historico: [] }, null, 2) + '\n';

(async () => {
  empresaMod.criar('aurora', 'Aurora Nutrição', RAIZ_DADOS);
  empresaMod.ativar('aurora', RAIZ_DADOS);
  const proprios = path.join(RAIZ_DADOS, 'empresas', 'aurora', 'estilos-proprios');
  copiarComoProprio('colagem', 'aurora-colagem', proprios);
  const envAurora = { FABRICA_RAIZ: RAIZ_DADOS, FABRICA_EMPRESA: 'aurora', FABRICA_SILENCIO_EXEMPLO: '1' };

  // servidor local que conta os pedidos que chegam
  const pedidos = [];
  const srv = http.createServer((req, res) => { pedidos.push(req.url); res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(); });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const fora = `ht${'tp'}:${'//'}127.0.0.1:${srv.address().port}/fora.png`;
  const comRecursoDeFora = (estilo) => {
    const l = demo('colagem');
    l[0].visual = { tipo: 'adesivo', svg: `<svg xmlns="${['ht', 'tp:', '//www.w3.org/2000/svg'].join('')}" viewBox="0 0 10 10"><image href="${fora}" width="10" height="10"/></svg>` };
    return escreve('fora-' + estilo, { estilo, legenda: LEGENDA, laminas: l });
  };
  const casos = [];
  const ta = (nome, fn) => casos.push({ nome, fn });

  ta('calibração: o mesmo conteúdo no estilo do catálogo faz o pedido de fora (o caminho existe)', async () => {
    pedidos.length = 0;
    const r = await gerarAsync([comRecursoDeFora('colagem'), '--saida', path.join(TMP, 'fora-catalogo'), '--cores', 'sugestao'], envAurora);
    assert.ok(fs.existsSync(path.join(TMP, 'fora-catalogo', 'lamina-01.png')), r.saida);
    assert.ok(pedidos.length > 0, 'a calibração não chegou ao servidor: o teste não provaria nada');
  });
  ta('estilo próprio da empresa: renderiza e confere com a rede fechada (nenhum pedido de fora)', async () => {
    pedidos.length = 0;
    const saida = path.join(TMP, 'fora-proprio');
    const r = await gerarAsync([comRecursoDeFora('aurora-colagem'), '--saida', saida, '--cores', 'sugestao'], envAurora);
    assert.ok(fs.existsSync(path.join(saida, 'lamina-01.png')), r.saida);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(saida, 'estado.json'), 'utf8')).estilo, 'aurora-colagem');
    assert.deepStrictEqual(pedidos, [], 'com a rede fechada, nada pode chegar ao servidor');
  });
  ta('sem estilo no conteúdo nem --estilo: vale o estilo escolhido pela empresa (próprio, da pasta dela)', async () => {
    fs.writeFileSync(path.join(RAIZ_DADOS, 'empresas', 'aurora', 'estilo.json'), estiloJson('aurora-colagem', 'proprio'));
    const saida = path.join(TMP, 'padrao-da-empresa');
    const r = await gerarAsync([escreve('sem-estilo-colagem', demo('colagem')), '--saida', saida], envAurora);
    assert.strictEqual(r.codigo, 0, r.saida);
    const estado = JSON.parse(fs.readFileSync(path.join(saida, 'estado.json'), 'utf8'));
    assert.strictEqual(estado.estilo, 'aurora-colagem');
    assert.strictEqual(estado.cores, 'marca');
    // o conteúdo que diz o seu estilo continua valendo
    const outro = await gerarAsync([escreve('com-estilo', { estilo: 'contraste', legenda: LEGENDA, laminas: demo('contraste') }), '--saida', path.join(TMP, 'diz-o-seu')], envAurora);
    assert.strictEqual(outro.codigo, 0, outro.saida);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(TMP, 'diz-o-seu', 'estado.json'), 'utf8')).estilo, 'contraste');
  });
  ta('estilo próprio de outra empresa nunca: a boreal não acha o estilo da aurora', async () => {
    empresaMod.criar('boreal', 'Boreal Estúdio', RAIZ_DADOS);
    const r = await gerarAsync([escreve('da-aurora', { estilo: 'aurora-colagem', laminas: demo('colagem') }), '--saida', path.join(TMP, 'boreal-x')], { ...envAurora, FABRICA_EMPRESA: 'boreal' });
    assert.strictEqual(r.codigo, 2, r.saida);
    assert.ok(/estilo não encontrado/.test(r.saida), r.saida);
    assert.ok(!fs.existsSync(path.join(TMP, 'boreal-x', 'lamina-01.png')));
  });
  ta('sem estilo escolhido e sem estilo no conteúdo: o erro de sempre', async () => {
    fs.rmSync(path.join(RAIZ_DADOS, 'empresas', 'aurora', 'estilo.json'));
    const r = await gerarAsync([escreve('sem-nada', demo('contraste')), '--saida', path.join(TMP, 'sem-nada')], envAurora);
    assert.strictEqual(r.codigo, 2, r.saida);
    assert.ok(/diga o estilo/.test(r.saida), r.saida);
  });

  let falhas = 0;
  for (const { nome, fn } of casos) {
    try { await fn(); n++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
  }
  srv.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log(`\n${n} testes passaram.`);
})();
