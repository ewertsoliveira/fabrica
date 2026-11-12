// Testes do Cronograma com as artes: o roteiro em campos (roteiro-video.js, regra R-13), as artes de cada post
// (midias.js), o .zip (zip-simples.js) e o download das imagens pelo servidor (/api/baixar-artes).
// Cada caso monta uma pasta temporária com acento e espaço no nome. As empresas são só fictícias.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;

const PAINEIS = path.join(__dirname, '..');
const Roteiro = require(path.join(PAINEIS, 'roteiro-video.js'));
const Zip = require(path.join(PAINEIS, 'zip-simples.js'));
const midias = require(path.join(PAINEIS, 'midias.js'));
const dados = require(path.join(PAINEIS, 'dados.js'));
const empresaMod = require(path.join(PAINEIS, '..', 'core', 'empresa.js'));
const { criarServidor } = require(path.join(PAINEIS, 'servidor.js'));

let falhas = 0;
let contador = 0;
const pastas = [];
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function novaPasta() {
  const r = path.join(os.tmpdir(), `Fábrica de Teste (artes)-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return path.resolve(r);
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
}

// Lê um .zip sem compressão (o que o zip-simples monta): [{ nome, dados (texto) }], conferindo o CRC de cada um.
function lerZip(buf) {
  const saida = [];
  let i = 0;
  while (buf.readUInt32LE(i) === 0x04034b50) {
    const crc = buf.readUInt32LE(i + 14);
    const tam = buf.readUInt32LE(i + 18);
    const n = buf.readUInt16LE(i + 26);
    const nome = buf.slice(i + 30, i + 30 + n).toString('utf8');
    const conteudo = buf.slice(i + 30 + n, i + 30 + n + tam);
    assert.strictEqual(Zip.crc32(conteudo), crc, 'CRC de ' + nome);
    saida.push({ nome, dados: conteudo.toString('utf8') });
    i += 30 + n + tam;
  }
  assert.strictEqual(buf.readUInt32LE(buf.length - 22), 0x06054b50, 'fim do zip');
  assert.strictEqual(buf.readUInt16LE(buf.length - 12), saida.length, 'quantidade no fim do zip');
  return saida;
}

// ---------- o roteiro em campos (R-13) ----------

const SCRIPT_NOVO = [
  'Título: A lei do MEI criou trabalho pago',
  'Capa: Rosto e o texto da capa.',
  '',
  '0:00–0:03 Gancho: Contador, seu cliente MEI vai te perguntar isso.',
  'Na tela: A LEI DO MEI CRIOU TRABALHO PAGO',
  '0:03–0:09 Promessa: O teto subiu? A dívida foi perdoada?',
  '0:09–0:18 Valor 1: Primeira: o teto sobe de 81 para 110 mil em 2027.',
  'Na tela: Limite: R$ 81 mil → R$ 110 mil',
  '',
  'Legenda:',
  'Texto antigo da legenda que não vale mais.',
].join('\n');

t('roteiro no formato das linhas: cabeçalho, cenas com nome, fala, tela e a legenda antiga fora', () => {
  const { cabecalho, cenas } = Roteiro.derivarCenas(SCRIPT_NOVO);
  assert.strictEqual(cabecalho, 'Título: A lei do MEI criou trabalho pago\nCapa: Rosto e o texto da capa.');
  assert.deepStrictEqual(cenas.map((c) => [c.tempo, c.nome]), [['0:00–0:03', 'Gancho'], ['0:03–0:09', 'Promessa'], ['0:09–0:18', 'Valor 1']]);
  assert.strictEqual(cenas[2].fala, 'Primeira: o teto sobe de 81 para 110 mil em 2027.', 'o "Primeira:" é fala, não nome');
  assert.deepStrictEqual(cenas[0].visual, [{ t: '0:00', quando: 'ao dizer "Contador, seu cliente MEI vai te…"', desc: 'A LEI DO MEI CRIOU TRABALHO PAGO' }]);
  assert.deepStrictEqual(cenas[1].visual, []);
  assert.ok(!JSON.stringify(cenas).includes('Texto antigo'), 'a legenda do script fica de fora');
});

t('roteiro no formato com colchetes: [tempo] RÓTULO: e a fala nas linhas seguintes', () => {
  const { cenas } = Roteiro.derivarCenas('[0:00–0:05] GANCHO:\n"Você sabia disso?"\nNa tela: SELO\n[0:05] Segunda fala direto.');
  assert.deepStrictEqual(cenas.map((c) => [c.tempo, c.nome, c.fala]), [['0:00–0:05', 'GANCHO', 'Você sabia disso?'], ['0:05', '', 'Segunda fala direto.']]);
  assert.strictEqual(cenas[0].visual[0].desc, 'SELO');
});

t('vídeo abre em quatro campos, na ordem da regra, e a legenda é a do post (a revisada)', () => {
  const campos = Roteiro.camposDoPost({ script: SCRIPT_NOVO, caption: 'Legenda revisada.', platformLabel: 'Instagram · Reels' });
  assert.deepStrictEqual(campos.map((c) => c.rotulo), ['Roteiro falado', 'Descrição visual', 'Roteiro com descrição visual', 'Legenda']);
  const [fala, visual, junto, legenda] = campos.map((c) => c.texto);
  assert.ok(!/Na tela|0:0|Gancho/.test(fala), 'a fala é só o que será dito');
  assert.ok(fala.startsWith('Contador, seu cliente MEI') && fala.includes('O teto subiu?'));
  assert.ok(visual.includes('Gancho · 0:00–0:03') && visual.includes('→ Limite: R$ 81 mil → R$ 110 mil'), visual);
  assert.ok(!visual.includes('Promessa'), 'cena sem tela não entra na descrição visual');
  assert.ok(junto.startsWith('Título: A lei do MEI'), 'o roteiro para o agente de edição começa pelo cabeçalho');
  assert.ok(junto.includes('[0:09–0:18] Valor 1\nFALA:\nPrimeira:') && junto.includes('VISUAL:\n[0:09]'), junto);
  assert.strictEqual(legenda, 'Legenda revisada.');
});

t('cenas gravadas no post valem mais que o script; peça sem fala tem estrutura e legenda; post vazio não tem campo', () => {
  const campos = Roteiro.camposDoPost({ script: SCRIPT_NOVO, cenas: [{ tempo: '0:00–0:02', nome: 'Abre', fala: 'Oi.', visual: [{ t: '0:00', quando: 'ao dizer "Oi"', desc: 'Logo' }] }], geral: 'Legenda queimada o tempo todo.' });
  assert.strictEqual(campos[0].texto, 'Oi.');
  assert.ok(campos[1].texto.startsWith('EM TODO O VÍDEO\nLegenda queimada'));
  const carrossel = Roteiro.camposDoPost({ script: '7 slides\nCapa: Título\n\nLegenda:\nvelha', caption: 'Nova.' });
  assert.deepStrictEqual(carrossel.map((c) => [c.rotulo, c.texto]), [['Roteiro e estrutura', '7 slides\nCapa: Título'], ['Legenda', 'Nova.']]);
  assert.deepStrictEqual(Roteiro.camposDoPost({}), []);
  assert.strictEqual(Roteiro.ehVideo({ platformLabel: 'Instagram · Reels' }), true);
  assert.strictEqual(Roteiro.ehVideo({ platformLabel: 'Instagram · Carrossel', script: '7 slides' }), false);
});

// ---------- o zip ----------

t('o zip abre com os arquivos certos, nomes com acento e nome repetido sem sobrescrever', () => {
  assert.strictEqual(Zip.crc32(Buffer.from('123456789')).toString(16), 'cbf43926');
  const z = Buffer.from(Zip.montar([{ nome: 'lâmina.png', dados: Buffer.from('um') }, { nome: 'lâmina.png', dados: Buffer.from('dois') }, { nome: 'a/b:c.txt', dados: Buffer.from('três') }]));
  assert.deepStrictEqual(lerZip(z), [{ nome: 'lâmina.png', dados: 'um' }, { nome: 'lâmina (2).png', dados: 'dois' }, { nome: 'a-b-c.txt', dados: 'três' }]);
});

// ---------- as artes de cada post ----------

function raizDuas() {
  const r = novaPasta();
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  for (const n of ['lamina-10', 'lamina-02', 'lamina-01']) esc(r, `empresas/aurora/saidas/c1/entrega/${n}.png`, 'PNG ' + n);
  esc(r, 'empresas/aurora/saidas/c1/entrega/miniaturas-100px.png', 'mini');
  esc(r, 'empresas/aurora/saidas/c1/entrega/carrossel.html', '<!doctype html>');
  esc(r, 'empresas/aurora/saidas/c1/preview.html', '<!doctype html>');
  esc(r, 'empresas/aurora/publicacoes/Instagram/2026/11-Novembro/13 - Post - Capa/Capa.png', 'PNG aprovada');
  esc(r, 'empresas/aurora/saidas/c2/capa.png', 'PNG capa nao aprovada');
  esc(r, 'empresas/aurora/saidas/c2/preview.html', '<!doctype html>');
  esc(r, 'empresas/aurora/saidas/v1/final.mp4', 'MP4');
  esc(r, 'empresas/aurora/saidas/p4/arte.png', 'PNG do post');
  esc(r, 'empresas/boreal/saidas/x/segredo.png', 'PNG da boreal');
  const c = dados.caminhos(r, 'aurora');
  const posts = [
    { id: 'p1', date: '2026-11-12', platform: 'insta', title: 'Carrossel: A/B?', caption: 'Legenda do carrossel.\nSegunda linha.' },
    { id: 'p2', date: '2026-11-13', platform: 'insta', title: 'Capa', caption: '' },
    { id: 'p3', date: '2026-11-14', platform: 'insta', platformLabel: 'Instagram · Reels', title: 'Reels' },
    { id: 'p4', date: '2026-11-15', platform: 'insta', title: 'Post solto', images: ['empresas/aurora/saidas/p4/arte.png', 'empresas/boreal/saidas/x/segredo.png', '../fora.png', 'empresas/aurora/saidas/p4/nao-existe.png'] },
    { id: 'p5', date: '2026-11-16', platform: 'insta', title: 'Sem arte' },
  ];
  dados.gravarJson(c.posts, posts);
  dados.gravarJson(c.pecas, [
    { id: 'k1', name: 'Carrossel', path: 'empresas/aurora/saidas/c1/preview.html', pasta: 'empresas/aurora/saidas/c1/entrega', tipo: 'carrossel', postId: 'p1', nomesArquivos: ['carrossel.html', 'lamina-10.png', 'lamina-01.png', 'lamina-02.png'] },
    { id: 'k2', name: 'Capa', path: 'empresas/aurora/saidas/c2/preview.html', tipo: 'capa' }, // ligada ao post só pela aprovação
    { id: 'k3', name: 'Vídeo', path: 'empresas/aurora/saidas/v1/final.mp4', video: 'empresas/aurora/saidas/v1/final.mp4', tipo: 'video', postId: 'p3' },
    { id: 'k4', name: 'De outra empresa', path: 'empresas/boreal/saidas/x/preview.html', tipo: 'capa', postId: 'p5' },
  ]);
  dados.gravarJson(c.aprovacoes, { k2: { id: 'k2', postId: 'p2', pasta: 'empresas/aurora/publicacoes/Instagram/2026/11-Novembro/13 - Post - Capa', arquivos: ['Capa.png'], aprovadoEm: '2026-11-10T10:00:00.000Z' } });
  return r;
}
const listas = (r) => { const c = dados.caminhos(r, 'aurora'); return { posts: dados.lerJson(c.posts, []), pecas: dados.lerJson(c.pecas, []), aprovacoes: dados.lerJson(c.aprovacoes, {}) }; };

t('artes: lâminas em ordem natural, sem a miniatura nem o HTML; aprovada vem da pasta da publicação; vídeo da peça', () => {
  const r = raizDuas();
  const m = midias.midiasDosPosts(r, 'aurora', listas(r));
  assert.deepStrictEqual(m.p1[0].imagens.map((i) => i.nome), ['lamina-01.png', 'lamina-02.png', 'lamina-10.png']);
  assert.strictEqual(m.p1[0].aprovada, false);
  assert.ok(m.p1[0].previa.startsWith('/empresas/aurora/saidas/c1/preview.html?v='));
  assert.ok(m.p1[0].imagens[0].url.startsWith('/empresas/aurora/saidas/c1/entrega/lamina-01.png?v='));
  assert.deepStrictEqual(m.p2[0].imagens.map((i) => i.caminho), ['empresas/aurora/publicacoes/Instagram/2026/11-Novembro/13 - Post - Capa/Capa.png'], 'a aprovada vem da publicação');
  assert.ok(m.p2[0].imagens[0].url.includes('13%20-%20Post%20-%20Capa'), 'endereço com os espaços codificados');
  assert.strictEqual(m.p2[0].aprovada, true);
  assert.strictEqual(m.p3[0].video.nome, 'final.mp4');
  assert.deepStrictEqual(m.p3[0].imagens, []);
});

t('artes: o post sem peça usa as imagens dele, só as que existem e são da empresa; peça de outra empresa não mostra nada', () => {
  const r = raizDuas();
  const m = midias.midiasDosPosts(r, 'aurora', listas(r));
  assert.deepStrictEqual(m.p4.map((g) => g.imagens.map((i) => i.nome)), [['arte.png']]);
  assert.strictEqual(m.p4[0].id, 'post:p4');
  assert.ok(!JSON.stringify(m).includes('boreal'), 'nada da boreal');
  assert.ok(!m.p5 || m.p5.every((g) => !g.imagens.length && !g.video && !g.previa), 'a peça que aponta para a boreal fica vazia');
  // a boreal não vê nenhum arquivo da aurora, nem com as listas da aurora (só o que é dela mesma)
  const daBoreal = Object.values(midias.midiasDosPosts(r, 'boreal', listas(r))).flat().flatMap((g) => g.imagens.concat(g.video ? [g.video] : []));
  assert.ok(daBoreal.every((a) => a.caminho.startsWith('empresas/boreal/')), JSON.stringify(daBoreal));
});

t('zip de uma arte: imagens com nome legível, na ordem, e a legenda; arte ou post que não existe não monta nada', () => {
  const r = raizDuas();
  const z = midias.zipDaArte(r, 'aurora', listas(r), 'p1', 'k1');
  assert.strictEqual(z.nome, '12-11 Carrossel AB.zip');
  assert.deepStrictEqual(lerZip(z.dados).map((x) => [x.nome, x.dados]), [
    ['12-11 Carrossel AB - 01.png', 'PNG lamina-01'], ['12-11 Carrossel AB - 02.png', 'PNG lamina-02'], ['12-11 Carrossel AB - 03.png', 'PNG lamina-10'],
    ['legenda.txt', 'Legenda do carrossel.\r\nSegunda linha.\r\n'],
  ]);
  assert.strictEqual(midias.zipDaArte(r, 'aurora', listas(r), 'p1', 'k9'), null);
  assert.strictEqual(midias.zipDaArte(r, 'aurora', listas(r), 'p9', 'k1'), null);
  assert.strictEqual(midias.zipDaArte(r, 'aurora', listas(r), 'p3', 'k3'), null, 'vídeo não vira zip');
});

// ---------- o servidor ----------

function pedir(porta, caminho) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: caminho }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, corpo: Buffer.concat(partes) }));
    }).on('error', reject);
  });
}

t('servidor: /api/dados traz as artes, /api/baixar-artes devolve o zip só da empresa do pedido', async () => {
  const r = raizDuas();
  const srv = criarServidor(r);
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const porta = srv.address().port;
  try {
    const d = await pedir(porta, '/api/dados?empresa=aurora');
    const j = JSON.parse(d.corpo.toString('utf8'));
    assert.deepStrictEqual(j.midias.p1[0].imagens.map((i) => i.nome), ['lamina-01.png', 'lamina-02.png', 'lamina-10.png']);
    const img = await pedir(porta, j.midias.p2[0].imagens[0].url);
    assert.strictEqual(img.status, 200, 'o endereço da imagem abre');
    assert.strictEqual(img.corpo.toString('utf8'), 'PNG aprovada');
    const z = await pedir(porta, '/api/baixar-artes?empresa=aurora&post=p1&arte=k1');
    assert.strictEqual(z.status, 200);
    assert.strictEqual(z.headers['content-type'], 'application/zip');
    assert.ok(/attachment/.test(z.headers['content-disposition']) && z.headers['content-disposition'].includes(encodeURIComponent('12-11 Carrossel AB.zip')));
    assert.strictEqual(lerZip(z.corpo).length, 4);
    assert.strictEqual((await pedir(porta, '/api/baixar-artes?empresa=boreal&post=p1&arte=k1')).status, 404, 'a boreal não baixa a arte da aurora');
    assert.strictEqual((await pedir(porta, '/api/baixar-artes?empresa=aurora&post=p1')).status, 400);
    assert.strictEqual((await pedir(porta, '/api/baixar-artes?empresa=../aurora&post=p1&arte=k1')).status, 400);
    assert.strictEqual((await pedir(porta, '/api/baixar-artes?empresa=aurora&post=p1&arte=k1&arte=k2')).status, 400);
  } finally {
    await new Promise((ok) => srv.close(ok));
  }
});

// ---------- execução ----------

(async () => {
  for (const c of casos) {
    try { await c.fn(); console.log('ok   ' + c.nome); } catch (e) { falhas++; console.log('FALHOU ' + c.nome + '\n     ' + (e.stack || e)); }
  }
  for (const r of pastas) {
    try { fs.rmSync(r, { recursive: true, force: true }); } catch { /* o sistema limpa a pasta temporária depois */ }
  }
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log('\ntodos os testes passaram');
  process.exit(0);
})();
