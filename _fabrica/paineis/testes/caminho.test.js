// Aceitação de ponta a ponta do caminho do usuário (etapa 8, item 8.14), com o Chromium do Playwright e o servidor dos
// painéis de verdade, numa pasta temporária com as empresas fictícias aurora e boreal criadas pela própria tela.
//
//   A. Pasta vazia → "Minha marca" (aurora) → Vídeo e Carrossel → "Sim, já tenho" → logo desenhado pelo teste → cores e
//      letras → guardar → biblioteca → detalhe → "Usar este estilo": estilo.json gravado e o pedido "usar-estilo" já
//      aplicado. Com "Minha marca", a tela não oferece "+ Novo cliente" (decisão 9 A).
//   B. Pasta vazia → "Meus clientes" (aurora, primeiro cliente) → "Ainda não tenho" → "Usar um dos nossos modelos" →
//      "Usar este estilo" com a marca nascendo do estilo; "+ Novo cliente" (boreal) → "Ainda não tenho" → "Criar uma
//      identidade do zero" → pedido gravado. `pedidos.js listar` mostra os dois pedidos com o nome certo da empresa.
//   Nas duas: `validar.js --empresa aurora` e `--empresa boreal` saem 0, nenhuma tela grava a empresa ativa do agente, o
//   pedido das prévias na marca vai só para a empresa cuja marca mudou, nenhuma tela mostra palavra interna e nada rola
//   de lado em 400 px. Na grade, só um vídeo toca de cada vez.
//   C. Uma pasta antiga (sem empresas/) copiada continua igual byte a byte depois de abrir todas as telas.
//
// Sem Chromium (nem Playwright), o teste diz "pulado" e sai 0, como o de migrar-pagina. Com FABRICA_CAMINHO_CAPTURAS=<pasta>,
// guarda uma captura de cada tela em 1280 e 400 px (a página do responsável usa essas capturas).
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

for (const v of ['FABRICA_EMPRESA', 'FABRICA_MARCA', 'FABRICA_RAIZ']) delete process.env[v];

const RAIZ = path.resolve(__dirname, '..', '..', '..');
const { criarServidor } = require(path.join(RAIZ, '_fabrica', 'paineis', 'servidor.js'));
const dados = require(path.join(RAIZ, '_fabrica', 'paineis', 'dados.js'));
const CAPTURAS = process.env.FABRICA_CAMINHO_CAPTURAS ? path.resolve(process.env.FABRICA_CAMINHO_CAPTURAS) : null;
const PEDIDOS_JS = path.join(RAIZ, '_fabrica', 'core', 'pedidos.js');
const VALIDAR_JS = path.join(RAIZ, '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');

// O que o servidor serve e lê da raiz: as telas, as letras OFL, a biblioteca (estilos e prévias base) e a marca de exemplo.
const DO_MODELO = ['_fabrica/paineis', '08-FERRAMENTAS/marca', '08-FERRAMENTAS/tesseract/modelos/fontes', '04-LABORATORIO-DE-DESIGN/estilos',
  '04-LABORATORIO-DE-DESIGN/biblioteca', '06-MARCA-E-FOTOS/marca.exemplo.yaml'];
const pastas = [];
function novaRaiz(nome) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-caminho-' + nome + '-'));
  pastas.push(r);
  for (const rel of DO_MODELO) fs.cpSync(path.join(RAIZ, rel), path.join(r, rel), { recursive: true });
  return r;
}
function fotografia(raiz) {
  const mapa = {};
  const varrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const arq = path.join(dir, e.name);
      const rel = path.relative(raiz, arq).split(path.sep).join('/');
      if (e.isDirectory()) { mapa[rel + '/'] = 'pasta'; varrer(arq); } else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(raiz);
  return mapa;
}
const lerJson = (arq) => JSON.parse(fs.readFileSync(arq, 'utf8'));
const pedidosDe = (r, c) => {
  const d = path.join(r, 'empresas', c, 'pedidos');
  return fs.existsSync(d) ? fs.readdirSync(d).filter((n) => n.endsWith('.json')).map((n) => lerJson(path.join(d, n))) : [];
};
const ambiente = (r) => {
  const env = { ...process.env, FABRICA_RAIZ: r };
  for (const v of ['FABRICA_EMPRESA', 'FABRICA_MARCA']) delete env[v];
  return env;
};
const rodar = (r, args) => spawnSync(process.execPath, args, { env: ambiente(r), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });

// Um PNG desenhado aqui (sem biblioteca): o logo de duas cores sobre branco, um círculo escuro e uma faixa quente.
function png(largura, altura, pintar) {
  const linhas = [];
  for (let y = 0; y < altura; y++) {
    const l = Buffer.alloc(1 + largura * 3);
    for (let x = 0; x < largura; x++) { const [R, G, B] = pintar(x, y); l[1 + x * 3] = R; l[2 + x * 3] = G; l[3 + x * 3] = B; }
    linhas.push(l);
  }
  const tabela = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; tabela[n] = c >>> 0; }
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = tabela[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloco = (tipo, corpo) => {
    const t = Buffer.concat([Buffer.from(tipo, 'ascii'), corpo]);
    const tam = Buffer.alloc(4); tam.writeUInt32BE(corpo.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(t));
    return Buffer.concat([tam, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0); ihdr.writeUInt32BE(altura, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(Buffer.concat(linhas))), bloco('IEND', Buffer.alloc(0))]);
}

// Palavras internas que nunca aparecem ao usuário, no texto visível de cada tela (sem acento, em minúsculas). Nomes de
// formato de arquivo também não ("PDF" pode: está no estudo aprovado).
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const PROIBIDAS = ['gaveta', 'disposicao', 'indice', 'legado', 'manifesto', 'pedido json', 'json', 'yaml', 'hex', 'webp', 'webm', 'png', 'jpg', 'jpeg', 'svg', 'ttf', 'otf', 'woff', 'localhost', 'undefined', 'null', 'nan'];
function palavrasProibidas(texto) {
  const t = semAcento(texto).toLowerCase();
  return PROIBIDAS.filter((p) => new RegExp('(^|[^a-z0-9])' + p.replace(/ /g, '\\s+') + '($|[^a-z0-9])').test(t));
}

let falhas = 0;
const relatorio = [];
const anota = (s) => { relatorio.push(s); console.log('     ' + s); };

async function abrirNavegador() {
  let abrir;
  try { ({ abrir } = require(path.join(RAIZ, '08-FERRAMENTAS', 'carrossel', 'navegador'))); } catch { return null; }
  try { return await abrir(); } catch (e) { console.log('     (sem navegador: ' + String(e.message).split('\n')[0] + ')'); return null; }
}

// Uma página com o servidor dos painéis numa raiz: erros de script, envios e as telas visitadas ficam anotados.
async function sessao(nav, r, nome) {
  const lancados = [];
  const srv = criarServidor(r, { lancarTrabalhador: (p) => { lancados.push(p); return null; } });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const page = await nav.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  const envios = [];
  page.on('request', (q) => { if (q.method() === 'POST') envios.push(new URL(q.url()).pathname); });
  const telas = new Set();
  let n = 0;
  // Cada tela conferida: sem rolagem lateral em 1280 e 400 px, sem palavra interna no texto visível; captura opcional.
  const foto = async (rotulo) => {
    await page.waitForTimeout(250);
    telas.add(new URL(page.url()).pathname.split('/').pop());
    const prefixo = String(++n).padStart(2, '0') + '-' + nome + '-' + rotulo;
    for (const largura of [1280, 400]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.waitForTimeout(150);
      const larg = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(larg <= largura, `${prefixo}: rola de lado em ${largura} px (${larg})`);
      // o texto visível com as seções recolhidas abertas (e fechadas de novo), mais os textos de atributo que a pessoa lê
      // ou ouve (placeholder, aria-label, title, alt)
      const texto = await page.evaluate(() => {
        const fechados = [...document.querySelectorAll('details:not([open])')];
        fechados.forEach((d) => { d.open = true; });
        const visivel = document.body.innerText;
        fechados.forEach((d) => { d.open = false; });
        const atributos = [...document.body.querySelectorAll('[placeholder], [aria-label], [title], [alt]')]
          .flatMap((e) => ['placeholder', 'aria-label', 'title', 'alt'].map((a) => e.getAttribute(a) || ''));
        return visivel + '\n' + atributos.join('\n');
      });
      const ruins = palavrasProibidas(texto);
      assert.deepStrictEqual(ruins, [], `${prefixo} (${largura} px) mostra palavra interna: ${ruins.join(', ')}`);
      if (CAPTURAS) {
        fs.mkdirSync(CAPTURAS, { recursive: true });
        await page.screenshot({ path: path.join(CAPTURAS, `${prefixo}-${largura}.png`), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  };
  const fechar = async () => { await page.close(); await new Promise((ok) => srv.close(ok)); };
  return { page, base, erros, envios, lancados, foto, fechar, telas };
}
const botao = (page, nome) => page.getByRole('button', { name: nome }).first();

// "Usar este estilo" no detalhe de um estilo da grade (abre o cartão pelo nome, como a pessoa faria).
async function usarEsteEstilo(s, id, rotulo) {
  const { page } = s;
  const cartao = page.locator(`li.cartao[data-estilo="${id}"]`);
  await cartao.waitFor();
  await cartao.locator('.cartao-abrir').click();
  await page.locator('#detalhe:not([hidden])').waitFor();
  await page.locator('[data-pedido="usar-estilo"]').waitFor();
  await s.foto(rotulo + '-detalhe');
  await page.locator('[data-pedido="usar-estilo"]').click();
  await page.locator('#pedido-confirmar').waitFor();
  await s.foto(rotulo + '-confirmar');
  await page.locator('#pedido-confirmar').click();
  await page.locator('#desfazer-escolha').waitFor();
  return (await page.locator('.pronto-frase').textContent()).trim();
}

// ---------- A: "Minha marca", com logo, cores e letras ----------
async function parteA(nav, arquivos) {
  const r = novaRaiz('a');
  const s = await sessao(nav, r, 'a');
  const { page, base } = s;
  try {
    await page.goto(base + '/');
    await page.locator('#formulario:not([hidden])').waitFor();
    assert.ok(page.url().endsWith('/_fabrica/paineis/comecar.html'), 'pasta vazia: "/" abre Começar (' + page.url() + ')');
    await s.foto('comecar-vazio');
    await page.getByText('Minha marca', { exact: true }).click();
    assert.strictEqual(await page.textContent('#rotulo-nome'), 'Como se chama a sua marca?');
    await page.fill('#nome', 'Aurora');
    await page.getByText('Reels falado').click();
    await page.getByText('Várias lâminas').click();
    await s.foto('comecar-minha-marca');
    await page.click('#continuar');
    await page.waitForURL(/marca\.html\?empresa=aurora$/);
    assert.deepStrictEqual(lerJson(path.join(r, 'empresas', 'aurora', 'intencao.json')), { quer: ['video', 'carrossel'], tudo: false });
    assert.deepStrictEqual(lerJson(path.join(r, 'empresas', 'uso.json')), { para: 'minha-marca' });
    anota('A: pasta vazia → Começar → "Minha marca" (Aurora) → Vídeo e Carrossel: empresa aurora criada, intenção e uso gravados');

    await page.getByText('Sua marca já tem cores e letras definidas?').waitFor();
    await s.foto('marca-pergunta');
    await botao(page, /Sim, já tenho/).click();
    await page.setInputFiles('[data-foco="logo-arquivo"]', arquivos.logo);
    await page.getByText('As cores tiradas do seu logo').waitFor();
    await s.foto('marca-cores-do-logo');
    // o logo tem duas cores: o que falta aparece em três versões completas (decisão 4 A), e a primeira é escolhida
    const versoes = page.locator('.versao');
    assert.strictEqual(await versoes.count(), 3, 'o que falta em três versões lado a lado');
    await versoes.nth(0).getByRole('button', { name: /Usar esta/ }).click();
    await page.locator('.par').nth(1).click();
    await s.foto('marca-letras-e-quadro');
    await botao(page, 'Guardar a minha marca').click();
    await page.getByText('Pronto. A sua marca foi guardada.', { exact: false }).waitFor();
    const yaml = fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml'), 'utf8');
    assert.ok(/origem: "?logo"?/.test(yaml), 'marca com origem logo');
    assert.strictEqual(fs.readdirSync(path.join(r, 'empresas', 'aurora', 'logo')).length, 1, 'o logo enviado está na pasta da aurora');
    await s.foto('marca-guardada');
    anota('A: "Sim, já tenho" → logo → cores tiradas → letras → "Guardar a minha marca": marca.yaml da aurora (origem logo) e o logo na pasta dela');

    await page.getByRole('link', { name: /biblioteca de estilos|estilos na minha marca/ }).click();
    await page.waitForURL(/estilos\.html\?empresa=aurora/);
    const inicio = Date.now();
    await page.locator('li.cartao').nth(26).waitFor();
    const abriu = Date.now() - inicio;
    assert.strictEqual(await page.locator('li.cartao').count(), 27, 'a grade mostra os 27 estilos');
    assert.strictEqual(await page.locator('video').count(), 0, 'a grade abre sem nenhum vídeo');
    assert.ok(abriu < 20000, 'a grade abriu em ' + abriu + ' ms');
    await s.foto('estilos-grade');
    anota(`A: a biblioteca abre com os 27 estilos em ${abriu} ms, sem nenhum vídeo na página`);
    // grade: um vídeo por vez (o botão de tocar, como no toque); o segundo para o primeiro
    const tocando = () => page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length);
    // o cartão fora da tela para o vídeo dele (é o certo): rola até o cartão antes de tocar, como a pessoa faria
    const tocar = async (id) => {
      await page.locator(`li.cartao[data-estilo="${id}"]`).scrollIntoViewIfNeeded();
      await page.evaluate((i) => document.querySelector(`li.cartao[data-estilo="${i}"] .cartao-play`).click(), id);
    };
    const estadoDosVideos = () => page.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ estilo: v.closest('li') && v.closest('li').dataset.estilo, parado: v.paused, tempo: v.currentTime, erro: v.error && v.error.code, pronto: v.readyState })));
    const tocandoEm = (id) => page.waitForFunction((i) => { const v = document.querySelector(`li.cartao[data-estilo="${i}"] video`); return v && !v.paused && v.currentTime > 0; }, id, { timeout: 20000 })
      .catch(async (e) => { throw new Error(`o vídeo de ${id} não tocou: ${JSON.stringify(await estadoDosVideos())} (${e.message.split('\n')[0]})`); });
    await tocar('bloco');
    await tocandoEm('bloco');
    assert.strictEqual(await tocando(), 1, 'um vídeo tocando');
    await tocar('retro');
    await tocandoEm('retro');
    assert.strictEqual(await tocando(), 1, 'só um vídeo toca na grade');
    assert.ok(await page.evaluate(() => { const v = document.querySelector('li.cartao[data-estilo="bloco"] video'); return !v || v.paused; }), 'o primeiro parou');
    await page.evaluate(() => document.querySelector('li.cartao[data-estilo="retro"] .cartao-play').click());
    anota('A: grade: tocar o segundo vídeo para o primeiro; nunca mais de um tocando');

    const frase = await usarEsteEstilo(s, 'bloco', 'estilos');
    assert.ok(/O estilo Bloco agora é o da Aurora\./.test(frase), frase);
    assert.ok(/No Claude, digite \/fabrica continuar/.test(frase), frase);
    await s.foto('estilos-pronto');
    const escolhido = lerJson(path.join(r, 'empresas', 'aurora', 'estilo.json'));
    assert.strictEqual(escolhido.estilo, 'bloco');
    const ped = pedidosDe(r, 'aurora');
    assert.strictEqual(ped.length, 1);
    assert.deepStrictEqual([ped[0].tipo, ped[0].estilo, ped[0].aplicado, ped[0].empresa], ['usar-estilo', 'bloco', true, 'aurora']);
    anota(`A: detalhe → "Usar este estilo": estilo.json da aurora = bloco e o pedido usar-estilo já aplicado ("${frase}")`);

    // "Minha marca" não oferece "+ Novo cliente" (decisão 9 A: só para quem cria para clientes)
    await page.goto(base + '/_fabrica/paineis/comecar.html?empresa=aurora');
    await page.locator('#formulario:not([hidden])').waitFor();
    assert.ok(await page.locator('#novo-cliente').isHidden(), 'com "Minha marca", nada de "+ Novo cliente"');
    anota('A: com "Minha marca", a tela Começar não oferece "+ Novo cliente" (decisão 9 A)');

    // "Trocar a cara da marca" no Laboratório e no Cronograma: o cartão fixo com o estilo da empresa leva à biblioteca dela
    for (const tela of ['laboratorio.html', 'cronograma.html']) {
      await page.goto(base + '/_fabrica/paineis/' + tela + '?empresa=aurora');
      const trocar = page.getByRole('link', { name: 'Trocar a cara da marca' });
      await trocar.waitFor();
      assert.ok(/estilos\.html\?empresa=aurora/.test(await trocar.getAttribute('href')), tela + ': o link leva à biblioteca da aurora');
      await page.getByText('Bloco', { exact: true }).first().waitFor();
      await s.foto(tela.replace('.html', '') + '-trocar-a-cara');
    }
    anota('A: Laboratório e Cronograma mostram o cartão do estilo Bloco com "Trocar a cara da marca", que leva à biblioteca da aurora');

    // os outros estados da Sua marca, só para a varredura do texto (nada é gravado): o Personalizar aberto pelo "Usar esta
    // cor" e o "Tenho uma parte"
    const marcaAntes = fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml'));
    await page.goto(base + '/_fabrica/paineis/marca.html?empresa=aurora&personalizar=bloco&papel=acento&cor=B5462A');
    await page.getByText('Detalhes do estilo').waitFor();
    await s.foto('marca-personalizar-cor-sugerida');
    await page.goto(base + '/_fabrica/paineis/marca.html?empresa=aurora');
    await botao(page, /Tenho uma parte/).click();
    await s.foto('marca-tenho-uma-parte');
    assert.ok(fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml')).equals(marcaAntes), 'abrir o Personalizar não grava nada');

    // As prévias na marca: o gatilho foi chamado para a aurora (a marca mudou), e o trabalhador (de mentira aqui), lançado
    assert.ok(s.lancados.length >= 1 && s.lancados.every((p) => path.resolve(p.raiz) === path.resolve(r)), 'o trabalhador das prévias foi pedido');
    assert.ok(fs.existsSync(path.join(r, 'empresas', 'aurora', 'previas', 'fila.json')), 'a lista das prévias na marca da aurora nasceu');
    assert.ok(!fs.existsSync(path.join(r, 'empresas', 'ativa.json')), 'nenhuma tela grava a empresa ativa do agente');
    const v = rodar(r, [VALIDAR_JS, '--empresa', 'aurora', '--raiz', r]);
    assert.strictEqual(v.status, 0, 'validar --empresa aurora: ' + v.stdout + v.stderr);
    const l = rodar(r, [PEDIDOS_JS, 'listar']);
    assert.strictEqual(l.status, 0, l.stderr);
    assert.ok(/^aurora \| Aurora \| .*Usar este estilo/m.test(l.stdout), l.stdout);
    anota('A: validar.js --empresa aurora sai 0; pedidos.js listar mostra o pedido da Aurora; empresas/ativa.json não existe');
    assert.deepStrictEqual(s.erros, [], 'erros nas páginas: ' + s.erros.join(' | '));
    return s.telas;
  } finally { await s.fechar(); }
}

// ---------- B: "Meus clientes": aurora sem marca (a marca nasce do estilo) e boreal, "+ Novo cliente", do zero ----------
async function parteB(nav) {
  const r = novaRaiz('b');
  const s = await sessao(nav, r, 'b');
  const { page, base } = s;
  try {
    await page.goto(base + '/');
    await page.locator('#formulario:not([hidden])').waitFor();
    await page.getByText('Meus clientes', { exact: true }).click();
    assert.strictEqual(await page.textContent('#rotulo-nome'), 'Como se chama o primeiro cliente?');
    await page.fill('#nome', 'Aurora');
    await page.getByText('Reels falado').click();
    await s.foto('comecar-meus-clientes');
    await page.click('#continuar');
    await page.waitForURL(/marca\.html\?empresa=aurora$/);
    await botao(page, /Ainda não tenho/).click();
    await s.foto('marca-ainda-nao-tenho');
    await page.getByRole('link', { name: /Usar um dos nossos modelos/ }).click();
    await page.waitForURL(/estilos\.html\?empresa=aurora/);
    await page.locator('li.cartao').nth(26).waitFor();
    await s.foto('estilos-sem-marca');
    const cartao = page.locator('li.cartao[data-estilo="terra-e-salvia"]');
    await cartao.locator('.cartao-abrir').click();
    await page.locator('[data-pedido="usar-estilo"]').click();
    await page.getByText('A sua marca vai nascer deste estilo').waitFor();
    await page.getByText('As cores e letras deste estilo viram as da sua marca. Dá para trocar depois.').waitFor();
    await s.foto('estilos-marca-nasce');
    await page.locator('#pedido-confirmar').click();
    await page.locator('#desfazer-escolha').waitFor();
    const frase = (await page.locator('.pronto-frase').textContent()).trim();
    assert.ok(/As cores e letras dele já são as da sua marca\./.test(frase), frase);
    await s.foto('estilos-pronto-marca-nascida');
    assert.strictEqual(lerJson(path.join(r, 'empresas', 'aurora', 'estilo.json')).estilo, 'terra-e-salvia');
    assert.ok(/origem: "?estilo:terra-e-salvia"?/.test(fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml'), 'utf8')), 'a marca nasceu do estilo');
    anota(`B: "Meus clientes" (Aurora) → "Ainda não tenho" → "Usar um dos nossos modelos" → "Usar este estilo": a marca nasce do estilo ("${frase}")`);

    // + Novo cliente: boreal, sem marca, criar do zero
    await page.goto(base + '/_fabrica/paineis/comecar.html?empresa=aurora');
    await page.locator('#novo-cliente:not([hidden])').waitFor();
    assert.ok(await page.locator('#seletor select').isVisible(), 'com "Meus clientes", o seletor aparece desde o primeiro cliente (decisão 9 A)');
    await page.click('#novo-cliente');
    assert.strictEqual(await page.textContent('#rotulo-nome'), 'Como se chama o novo cliente?');
    await page.fill('#nome', 'Boreal');
    await page.getByText('Uma imagem').click();
    await s.foto('comecar-novo-cliente');
    await page.click('#continuar');
    await page.waitForURL(/marca\.html\?empresa=boreal$/);
    await botao(page, /Ainda não tenho/).click();
    await botao(page, /Enviar referências do que você gosta/).click();
    await s.foto('marca-enviar-referencias');
    await botao(page, /Criar uma identidade do zero/).click();
    await page.locator('#recado-zero').fill('Estúdio de fotografia de família; o público são pais jovens.');
    await s.foto('marca-do-zero');
    await botao(page, 'Pedir a identidade do zero').click();
    await page.locator('#criar-do-zero').getByText('Pronto. No Claude, digite /fabrica continuar').waitFor();
    await s.foto('marca-do-zero-pedido');
    const doZero = pedidosDe(r, 'boreal');
    assert.deepStrictEqual(doZero.map((p) => [p.tipo, p.empresa]), [['criar-do-zero', 'boreal']]);
    assert.ok(!fs.existsSync(path.join(r, 'empresas', 'boreal', 'marca.yaml')) && !fs.existsSync(path.join(r, 'empresas', 'boreal', 'estilo.json')), 'boreal sem marca nem estilo');
    anota('B: "+ Novo cliente" (Boreal) → "Ainda não tenho" → "Criar uma identidade do zero": pedido criar-do-zero da boreal; ela segue sem marca e sem estilo');

    // A Boreal na biblioteca: sem o estilo e sem a marca da Aurora
    await page.goto(base + '/_fabrica/paineis/estilos.html?empresa=boreal');
    await page.locator('li.cartao').nth(26).waitFor();
    assert.strictEqual(await page.locator('.selo-seu').count(), 0, 'a Boreal não vê o estilo da Aurora como dela');
    await page.getByText('Você ainda não definiu a sua marca.', { exact: false }).waitFor();
    await s.foto('estilos-boreal');

    const l = rodar(r, [PEDIDOS_JS, 'listar']);
    assert.strictEqual(l.status, 0, l.stderr);
    const linhas = l.stdout.split('\n').filter((x) => / \| /.test(x));
    assert.strictEqual(linhas.length, 2, l.stdout);
    assert.ok(linhas.some((x) => /^aurora \| Aurora \| .*Usar este estilo/.test(x)), l.stdout);
    assert.ok(linhas.some((x) => /^boreal \| Boreal \| .*Criar a marca do zero/.test(x)), l.stdout);
    anota('B: pedidos.js listar mostra os dois pedidos, cada um com o nome certo da empresa:\n       ' + linhas.join('\n       '));
    for (const c of ['aurora', 'boreal']) {
      const v = rodar(r, [VALIDAR_JS, '--empresa', c, '--raiz', r]);
      assert.strictEqual(v.status, 0, `validar --empresa ${c}: ` + v.stdout + v.stderr);
    }
    anota('B: validar.js --empresa aurora e --empresa boreal saem 0');
    // as prévias na marca: só para a aurora, a única com marca
    assert.ok(fs.existsSync(path.join(r, 'empresas', 'aurora', 'previas', 'fila.json')), 'a aurora pediu as prévias na marca');
    assert.ok(!fs.existsSync(path.join(r, 'empresas', 'boreal', 'previas', 'fila.json')), 'nada de prévias na marca para a boreal');
    assert.ok(!fs.existsSync(path.join(r, 'empresas', 'ativa.json')), 'nenhuma tela grava a empresa ativa do agente');
    anota('B: as prévias na marca foram pedidas só para a aurora; empresas/ativa.json não existe');
    assert.deepStrictEqual(s.erros, [], 'erros nas páginas: ' + s.erros.join(' | '));
    return s.telas;
  } finally { await s.fechar(); }
}

// ---------- C: a pasta antiga copiada continua igual byte a byte depois de abrir o painel ----------
async function parteC(nav) {
  const original = novaRaiz('antiga');
  const esc = (rel, conteudo) => { fs.mkdirSync(path.dirname(path.join(original, rel)), { recursive: true }); fs.writeFileSync(path.join(original, rel), conteudo); };
  esc('06-MARCA-E-FOTOS/marca.yaml', '# a marca de sempre\r\nempresa:\r\n  nome: "Padaria de Mentira"\r\ncores:\r\n  escuro: "#2A1E14"\r\n  claro: "#FAF3E8"\r\n  acento: "#C2562B"\r\n  neutro: "#8E8274"\r\n');
  esc('_fabrica/_memoria/empresa.md', '# Perfil\n\n**Nome:** Padaria de Mentira\n');
  dados.gravarJson(dados.caminhos(original, null).pecas, [{ id: 'p1', name: 'Peça antiga', path: 'linhas/reels/saida/p1/preview.html', tipo: 'capa' }]);
  esc('linhas/reels/saida/p1/preview.html', '<p>peça da pasta antiga</p>');
  esc('03-CRONOGRAMA/dados/posts.json', '[]');
  esc('02-PUBLICACOES/Instagram/2026/10-Outubro/15 - Post - Antigo/legenda.txt', 'texto antigo');
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-caminho-copia-'));
  pastas.push(r);
  fs.cpSync(original, r, { recursive: true });
  const antes = fotografia(original);
  assert.deepStrictEqual(fotografia(r), antes, 'a cópia nasceu igual');
  const s = await sessao(nav, r, 'c');
  const { page, base } = s;
  try {
    await page.goto(base + '/');
    await page.waitForURL(/laboratorio\.html/);
    await page.locator('#link-comecar').waitFor({ state: 'attached' });
    await page.waitForLoadState('networkidle');
    await s.foto('pasta-antiga-laboratorio');
    for (const tela of ['estilos.html', 'cronograma.html', 'comecar.html', 'marca.html']) {
      await page.goto(base + '/_fabrica/paineis/' + tela);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(400);
      await s.foto('pasta-antiga-' + tela.replace('.html', ''));
    }
    assert.deepStrictEqual(s.envios, [], 'abrir as telas não envia nada');
    assert.deepStrictEqual(fotografia(r), antes, 'a pasta antiga ficou igual byte a byte');
    assert.ok(!fs.existsSync(path.join(r, 'empresas')), 'nada de empresas/ na pasta antiga');
    anota('C: pasta antiga copiada: "/" abre o Laboratório; Estilos, Cronograma, Começar e Sua marca abertos; nada enviado; igual byte a byte; nenhuma pasta empresas/');
    assert.deepStrictEqual(s.erros, [], 'erros nas páginas: ' + s.erros.join(' | '));
    return s.telas;
  } finally { await s.fechar(); }
}

(async () => {
  const nav = await abrirNavegador();
  if (!nav) { console.log('pulado (sem navegador): o caminho de ponta a ponta precisa do Chromium do Playwright'); process.exit(0); }
  const arqs = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-caminho-arquivos-'));
  pastas.push(arqs);
  const logo = path.join(arqs, 'logo-aurora.png');
  fs.writeFileSync(logo, png(360, 160, (x, y) => {
    if ((x - 80) ** 2 + (y - 80) ** 2 < 52 ** 2) return [62, 36, 20];
    if (x > 160 && x < 330 && y > 60 && y < 100) return [222, 128, 40];
    return [255, 255, 255];
  }));
  const telas = new Set();
  for (const [nome, fn] of [['A: "Minha marca", com logo, cores e letras, até "Usar este estilo"', () => parteA(nav, { logo })],
    ['B: "Meus clientes", a marca que nasce do estilo e "+ Novo cliente" com criar do zero', () => parteB(nav)],
    ['C: pasta antiga copiada, igual byte a byte depois de abrir as telas', () => parteC(nav)]]) {
    try { (await fn()).forEach((x) => telas.add(x)); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
  }
  await nav.close();
  console.log('     telas conferidas (texto visível sem palavra interna, sem rolagem lateral em 400 px): ' + [...telas].sort().join(', '));
  if (CAPTURAS) fs.writeFileSync(path.join(CAPTURAS, 'relatorio.txt'), relatorio.join('\n') + '\n');
  for (const r of pastas) { try { fs.rmSync(r, { recursive: true, force: true }); } catch { /* o sistema limpa a pasta temporária depois */ } }
  if (falhas) { console.log(`\n${falhas} parte(s) falharam`); process.exit(1); }
  console.log('\n3 partes passaram');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
