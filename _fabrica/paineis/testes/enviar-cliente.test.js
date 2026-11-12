// Testes de enviar-cliente.js: o cronograma que vai para o cliente é montado só com os posts da empresa dele,
// passa pela conferência entre empresas antes de existir e nunca sobrescreve um envio anterior.
// Cada caso monta uma pasta temporária (com acento, espaço e parênteses no nome). As empresas são só fictícias.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;
delete process.env.FABRICA_RAIZ;

const ENVIAR = path.join(__dirname, '..', 'enviar-cliente.js');
const empresaMod = require(path.join(__dirname, '..', '..', 'core', 'empresa.js'));
const dados = require(path.join(__dirname, '..', 'dados.js'));

const HOJE = '2026-11-02';
let falhas = 0;
let contador = 0;
const pastas = [];
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function novaPasta(rotulo) {
  const r = path.join(os.tmpdir(), `Fábrica de Teste (EMPRESA)-envio-${rotulo}-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return path.resolve(r);
}
function esc(r, rel, texto) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto, 'utf8');
}
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Foto de todos os arquivos (e pastas) de uma raiz: caminho relativo -> hash. `ignorar(rel)` deixa de fora o que não conta.
function fotografia(raiz, ignorar = () => false) {
  const mapa = {};
  const varrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const arq = path.join(dir, e.name);
      const rel = path.relative(raiz, arq).split(path.sep).join('/');
      if (ignorar(rel)) continue;
      if (e.isDirectory()) { mapa[rel + '/'] = 'pasta'; varrer(arq); } else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(raiz);
  return mapa;
}
const foraDeEmpresas = (rel) => rel === 'empresas' || rel.startsWith('empresas/');

const marcaYaml = (nome, cores) => ['empresa:', `  nome: "${nome}"`, 'cores:', ...Object.entries(cores).map(([k, v]) => `  ${k}: "${v}"`), ''].join('\n');
const CORES_AURORA = { escuro: '#3B1F14', claro: '#FBF3EA', acento: '#D9822B', neutro: '#A08B7A' };
const CORES_BOREAL = { escuro: '#0F2A3D', claro: '#EEF4F7', acento: '#2E8FA8', neutro: '#7C93A3' };

const POSTS_AURORA = [
  { id: 'a-post-1', date: '2026-11-10', platform: 'insta', title: 'Lanches da tarde que seguram a fome', caption: 'Três ideias de lanche para a tarde render.\nSalve para lembrar no mercado.', script: 'roteiro interno', tips: 'dica interna' },
  { id: 'a-post-2', date: '2026-11-12', platform: 'linkedin', title: 'Água ao longo do dia', caption: 'Um copo a cada pausa.' },
  { id: 'a-post-3', date: '2026-12-01', platform: 'yt', title: 'Feira da semana' },
];

// aurora (marca própria, 3 posts, uma peça aprovada) e boreal (marca própria e termos.txt com nomes da boreal).
function raizDuas(postsAurora = POSTS_AURORA) {
  const r = novaPasta('duas');
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  esc(r, 'empresas/aurora/marca.yaml', marcaYaml('Aurora Nutrição', CORES_AURORA));
  esc(r, 'empresas/boreal/marca.yaml', marcaYaml('Boreal Estúdio', CORES_BOREAL));
  esc(r, 'empresas/boreal/termos.txt', 'Norte & Cia\nateliê do farol\n');
  dados.gravarJson(dados.caminhos(r, 'aurora').posts, postsAurora);
  dados.gravarJson(dados.caminhos(r, 'aurora').config, { titulo: 'Plano de novembro', periodo: 'Novembro e dezembro', pessoas: [], aprovadores: [] });
  dados.gravarJson(dados.caminhos(r, 'aurora').pecas, [{ id: 'a-peca-1', name: 'Carrossel: lanches', path: 'empresas/aurora/saidas/carrossel/a1/preview.html', tipo: 'carrossel', postId: 'a-post-1' }]);
  dados.gravarJson(dados.caminhos(r, 'aurora').aprovacoes, { 'a-peca-1': { id: 'a-peca-1', postId: 'a-post-1', pasta: 'empresas/aurora/publicacoes/x', arquivos: ['Slide_01.png'], aprovadoEm: '2026-11-01T10:00:00.000Z' } });
  dados.gravarJson(dados.caminhos(r, 'boreal').posts, [{ id: 'b-post-1', date: '2026-11-11', platform: 'insta', title: 'Luz natural no estúdio', caption: 'A janela como a sua melhor luz.' }]);
  return r;
}

const enviarCliente = () => require(ENVIAR);
const envios = (r, c) => path.join(r, 'empresas', c, 'envios');
const listaEnvios = (r, c) => (fs.existsSync(envios(r, c)) ? fs.readdirSync(envios(r, c)).sort() : []);

// ---------- o arquivo da aurora ----------

t('o arquivo da aurora tem os posts dela, as cores dela e nenhum termo da boreal', async () => {
  const r = raizDuas();
  const tmp = novaPasta('tmp');
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.empresa, 'aurora');
  const esperado = path.join(envios(r, 'aurora'), 'cronograma-aurora-2026-11-02.html');
  assert.strictEqual(res.arquivo, esperado);
  assert.ok(path.isAbsolute(res.arquivo));
  assert.strictEqual(res.endereco, '/empresas/aurora/envios/cronograma-aurora-2026-11-02.html');
  const html = fs.readFileSync(esperado, 'utf8');
  assert.ok(html.includes('<title>Cronograma de conteúdo — Aurora Nutrição</title>'), 'título com o nome da empresa');
  for (const p of POSTS_AURORA) assert.ok(html.includes(p.title), 'falta o post ' + p.title);
  assert.ok(html.includes('Três ideias de lanche para a tarde render.'), 'a legenda vai junto');
  for (const cor of Object.values(CORES_AURORA)) assert.ok(html.toLowerCase().includes(cor.toLowerCase()), 'falta a cor ' + cor);
  for (const cor of Object.values(CORES_BOREAL)) assert.ok(!html.toLowerCase().includes(cor.toLowerCase()), 'cor da boreal no arquivo da aurora: ' + cor);
  assert.ok(html.includes('Instagram') && html.includes('LinkedIn') && html.includes('YouTube'));
  assert.ok(html.includes('Arte aprovada'), 'o post com a peça aprovada aparece como aprovado');
  assert.ok(html.includes('Em produção'), 'os outros aparecem em produção');
  // nenhum termo da boreal (nome, termos.txt), nem os posts dela
  const normal = semAcento(html.replace(/&amp;/g, '&'));
  for (const termo of empresaMod.termos('boreal', r)) assert.ok(!normal.includes(semAcento(termo)), 'termo da boreal no arquivo: ' + termo);
  assert.ok(!html.includes('Luz natural'));
  // o único script é o visualizador fixo da Fábrica (o mesmo em todo arquivo, sem nenhum dado), no fim da página
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.strictEqual(scripts.length, 1, 'um script só');
  assert.strictEqual(scripts[0][0].indexOf('<script>'), 0, 'script sem src nem atributo');
  const fixo = ['zip-simples.js', 'cliente-visor.js'].map((n) => fs.readFileSync(path.join(__dirname, '..', n), 'utf8').replace(/<\/script/gi, '<\\/script')).join('\n');
  assert.strictEqual(scripts[0][1].trim(), fixo.trim(), 'o script é exatamente o visualizador da Fábrica');
  for (const proibido of ['http://', 'https://', 'localhost', '/api/', 'fetch(', 'XMLHttpRequest', 'import(', 'sendBeacon', 'WebSocket']) assert.ok(!fixo.includes(proibido), 'o visualizador cita ' + proibido);
  const semScript = html.replace(scripts[0][0], '');
  // só o que é do post: nada interno, nada deste computador, nada que dependa do servidor
  for (const interno of ['a-post-1', 'a-peca-1', 'roteiro interno', 'dica interna', 'empresas/', 'publicacoes', r, r.split(path.sep).join('/'), os.homedir(), 'localhost', '/api/', '<script', 'http://', 'https://', '<link']) {
    assert.ok(!semScript.includes(interno), 'o arquivo do cliente cita ' + interno);
  }
  for (const palavra of ['gaveta', 'disposicao', 'indice', 'legado']) assert.ok(!semAcento(html).includes(palavra), 'palavra interna: ' + palavra);
  assert.ok(/<style>/.test(html), 'estilo dentro do próprio arquivo');
  assert.deepStrictEqual(fs.readdirSync(tmp), [], 'a pasta temporária foi apagada');
  assert.deepStrictEqual(listaEnvios(r, 'boreal'), [], 'nada na boreal');
});

// ---------- vazamento ----------

t('termo da boreal num post da aurora: nenhum arquivo, mensagem cita o termo e a dona', async () => {
  const posts = POSTS_AURORA.map((p) => (p.id === 'a-post-2' ? { ...p, caption: 'Hoje com dicas da Boreal Estúdio para a sua foto.' } : p));
  const r = raizDuas(posts);
  const tmp = novaPasta('tmp');
  const antes = fotografia(r);
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.empresa, 'aurora');
  assert.strictEqual(res.termo, 'Boreal Estúdio');
  assert.strictEqual(res.dona, 'Boreal Estúdio');
  assert.ok(res.erro.includes('12/11'), res.erro);
  assert.ok(res.erro.includes('“Boreal Estúdio”'), res.erro);
  assert.ok(/outra empresa/.test(res.erro) && /Corrija o post e tente de novo\./.test(res.erro), res.erro);
  assert.deepStrictEqual(listaEnvios(r, 'aurora'), [], 'nenhum arquivo gerado');
  assert.deepStrictEqual(fotografia(r), antes, 'nada mudou na pasta');
  assert.deepStrictEqual(fs.readdirSync(tmp), [], 'a pasta temporária foi apagada');
});

t('termo com "&" e termo quebrado em duas linhas da legenda também são pegos', async () => {
  const comE = POSTS_AURORA.map((p) => (p.id === 'a-post-3' ? { ...p, title: 'Parceria com Norte & Cia' } : p));
  const r1 = raizDuas(comE);
  const res1 = await enviarCliente().enviar({ raiz: r1, empresa: 'aurora', hoje: HOJE, pastaTemporaria: novaPasta('tmp') });
  assert.strictEqual(res1.ok, false, JSON.stringify(res1));
  assert.strictEqual(res1.termo, 'Norte & Cia');
  assert.strictEqual(res1.dona, 'Boreal Estúdio');
  assert.ok(res1.erro.includes('01/12'), res1.erro);
  assert.deepStrictEqual(listaEnvios(r1, 'aurora'), []);

  const quebrado = POSTS_AURORA.map((p) => (p.id === 'a-post-1' ? { ...p, caption: 'Visitamos o ateliê\ndo farol esta semana.' } : p));
  const r2 = raizDuas(quebrado);
  const res2 = await enviarCliente().enviar({ raiz: r2, empresa: 'aurora', hoje: HOJE, pastaTemporaria: novaPasta('tmp') });
  assert.strictEqual(res2.ok, false, JSON.stringify(res2));
  assert.ok(res2.erro.includes('10/11'), res2.erro);
  assert.deepStrictEqual(listaEnvios(r2, 'aurora'), []);
});

t('caractere invisível no meio do nome de outra empresa (hífen suave, espaço de largura zero) também recusa', async () => {
  for (const [rotulo, invisivel] of [['hífen suave', '\u00AD'], ['espaço de largura zero', '\u200B'], ['junção de largura zero', '\u200D'], ['marca de direção', '\u200E']]) {
    for (const campo of ['title', 'caption']) {
      const posts = POSTS_AURORA.map((p) => (p.id === 'a-post-2' ? { ...p, [campo]: `Promo da Bo${invisivel}real Estúdio` } : p));
      const r = raizDuas(posts);
      const tmp = novaPasta('tmp');
      const antes = fotografia(r);
      const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: tmp });
      assert.strictEqual(res.ok, false, rotulo + ' em ' + campo + ': ' + JSON.stringify(res));
      assert.strictEqual(res.motivo, 'vazamento', rotulo + ': ' + JSON.stringify(res));
      assert.strictEqual(res.dona, 'Boreal Estúdio', rotulo);
      assert.deepStrictEqual(listaEnvios(r, 'aurora'), [], rotulo + ': nenhum arquivo gerado');
      assert.deepStrictEqual(fotografia(r), antes, rotulo + ': nada mudou na pasta');
      assert.deepStrictEqual(fs.readdirSync(tmp), []);
    }
  }
});

t('a pasta temporária fica dentro da pasta da empresa (nome com ponto), é apagada com o apagador seguro e a conferência lê os dois arquivos', async () => {
  const r = raizDuas();
  const vistos = [];
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, remover: (pasta) => { vistos.push(pasta); fs.rmSync(pasta, { recursive: true, force: true }); } });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(vistos.length, 1, 'o apagador foi usado uma vez');
  assert.strictEqual(path.dirname(vistos[0]), path.join(r, 'empresas', 'aurora'), 'dentro da pasta da empresa');
  assert.ok(path.basename(vistos[0]).startsWith('.envio-tmp-'), vistos[0]);
  assert.ok(!fs.existsSync(vistos[0]));
  assert.deepStrictEqual(fs.readdirSync(path.join(r, 'empresas', 'aurora')).filter((n) => n.startsWith('.envio-tmp-')), []);
});

t('apagador da pasta temporária que falha (Windows: arquivo em uso) não troca o sucesso por erro', async () => {
  const r = raizDuas();
  let chamado = 0;
  const remover = () => { chamado++; throw Object.assign(new Error("EBUSY: resource busy or locked, rmdir 'x'"), { code: 'EBUSY' }); };
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, remover });
  assert.strictEqual(chamado, 1, 'o apagador foi usado');
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.ok(fs.existsSync(res.arquivo), 'o arquivo está em envios');
  // e também na recusa: o motivo da recusa continua sendo o vazamento
  const posts = POSTS_AURORA.map((p) => (p.id === 'a-post-2' ? { ...p, caption: 'Com a Boreal Estúdio.' } : p));
  const rv = raizDuas(posts);
  const vaz = await enviarCliente().enviar({ raiz: rv, empresa: 'aurora', hoje: HOJE, remover });
  assert.strictEqual(vaz.ok, false);
  assert.strictEqual(vaz.motivo, 'vazamento');
  assert.deepStrictEqual(listaEnvios(rv, 'aurora'), []);
});

t('conferência que não terminou (sem a linha de resultado) não vira "vazamento"', async () => {
  const r = raizDuas();
  const semResultado = async () => ({ status: 1, stdout: 'CONFERÊNCIA ENTRE EMPRESAS · Aurora Nutrição (aurora)\n', stderr: '' });
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: novaPasta('tmp'), validador: semResultado });
  assert.strictEqual(res.ok, false, JSON.stringify(res));
  assert.strictEqual(res.motivo, 'conferencia', JSON.stringify(res));
  assert.strictEqual(res.erro, 'A conferência não terminou. Nenhum arquivo foi criado. Tente de novo.');
  assert.ok(!res.erro.includes('outra empresa'));
  assert.deepStrictEqual(listaEnvios(r, 'aurora'), []);
  // com a linha de resultado e sem achado nomeado, continua sendo a recusa por nome de outra empresa
  const comResultado = async () => ({ status: 1, stdout: 'RESULTADO: 1 termo(s) de outra empresa. Não entregue.\n', stderr: '' });
  const vaz = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: novaPasta('tmp'), validador: comResultado });
  assert.strictEqual(vaz.motivo, 'vazamento');
});

// ---------- nunca sobrescrever ----------

t('envio do mesmo dia não sobrescreve: -2, -3...', async () => {
  const r = raizDuas();
  esc(r, 'empresas/aurora/envios/cronograma-aurora-2026-11-02.html', 'envio de hoje cedo');
  const tmp = novaPasta('tmp');
  const a = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: tmp });
  const b = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(path.basename(a.arquivo), 'cronograma-aurora-2026-11-02-2.html');
  assert.strictEqual(path.basename(b.arquivo), 'cronograma-aurora-2026-11-02-3.html');
  assert.strictEqual(a.endereco, '/empresas/aurora/envios/cronograma-aurora-2026-11-02-2.html');
  assert.strictEqual(fs.readFileSync(path.join(envios(r, 'aurora'), 'cronograma-aurora-2026-11-02.html'), 'utf8'), 'envio de hoje cedo');
  assert.deepStrictEqual(listaEnvios(r, 'aurora'), ['cronograma-aurora-2026-11-02-2.html', 'cronograma-aurora-2026-11-02-3.html', 'cronograma-aurora-2026-11-02.html']);
  assert.deepStrictEqual(fs.readdirSync(tmp), []);
});

// ---------- pasta antiga ----------

t('pasta antiga: o envio vai para empresas/principal/envios e todo arquivo antigo fica idêntico, byte a byte', async () => {
  const r = novaPasta('antiga');
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', marcaYaml('Padaria da Esquina', CORES_AURORA));
  esc(r, '_fabrica/_memoria/empresa.md', '# Perfil\n\n**Nome:** Padaria da Esquina\n');
  esc(r, '03-CRONOGRAMA/dados/posts.json', JSON.stringify([{ id: 'velho-1', date: '2026-11-05', platform: 'insta', title: 'Pão de fermentação natural' }], null, 2) + '\n');
  esc(r, '03-CRONOGRAMA/dados/config.json', '{ "titulo": "Plano", "periodo": "Novembro", "pessoas": [], "aprovadores": [] }\n');
  esc(r, '04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', '[]\n');
  esc(r, '04-LABORATORIO-DE-DESIGN/dados/aprovacoes.json', '{}\n');
  esc(r, '02-PUBLICACOES/Instagram/2026/11-Novembro/05 - Post - Pão/capa.png', 'imagem antiga');
  const antes = fotografia(r);

  const so = await enviarCliente().enviar({ raiz: r, empresa: 'principal', hoje: HOJE, pastaTemporaria: novaPasta('tmp') });
  assert.strictEqual(so.ok, true, JSON.stringify(so));
  assert.strictEqual(so.arquivo, path.join(r, 'empresas', 'principal', 'envios', 'cronograma-principal-2026-11-02.html'));
  assert.ok(fs.readFileSync(so.arquivo, 'utf8').includes('Pão de fermentação natural'));
  assert.ok(fs.readFileSync(so.arquivo, 'utf8').includes('Cronograma de conteúdo — Padaria da Esquina'));
  assert.deepStrictEqual(fotografia(r, foraDeEmpresas), Object.fromEntries(Object.entries(antes).filter(([rel]) => !foraDeEmpresas(rel.replace(/\/$/, '')))));

  // com uma segunda empresa criada, a pasta antiga continua igual e o envio dela ainda funciona (agora conferido)
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  const tmp = novaPasta('tmp');
  const de2 = await enviarCliente().enviar({ raiz: r, empresa: 'principal', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(de2.ok, true, JSON.stringify(de2));
  assert.strictEqual(path.basename(de2.arquivo), 'cronograma-principal-2026-11-02-2.html');
  assert.ok(!fs.readFileSync(de2.arquivo, 'utf8').includes('Aurora'));
  assert.deepStrictEqual(fotografia(r, foraDeEmpresas), Object.fromEntries(Object.entries(antes).filter(([rel]) => !foraDeEmpresas(rel.replace(/\/$/, '')))), 'nenhum arquivo da pasta antiga pode mudar');
  assert.deepStrictEqual(fs.readdirSync(tmp), []);

  // e um post da pasta antiga que cita a aurora para o envio
  const posts = path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json');
  const original = fs.readFileSync(posts);
  fs.writeFileSync(posts, JSON.stringify([{ id: 'velho-1', date: '2026-11-05', platform: 'insta', title: 'Receita com a Aurora Nutrição' }]));
  const vaz = await enviarCliente().enviar({ raiz: r, empresa: 'principal', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(vaz.ok, false);
  assert.strictEqual(vaz.termo, 'Aurora Nutrição');
  assert.ok(vaz.erro.includes('05/11'), vaz.erro);
  assert.deepStrictEqual(fs.readdirSync(tmp), []);
  assert.strictEqual(fs.readdirSync(path.join(r, 'empresas', 'principal', 'envios')).length, 2, 'nenhum arquivo novo');
  fs.writeFileSync(posts, original);
});

// ---------- recusas ----------

t('empresa inválida, sem posts ou com arquivo quebrado: nada é gerado', async () => {
  const r = raizDuas();
  const tmp = novaPasta('tmp');
  for (const ruim of ['../aurora', '', 'nao-existe', 'aurora/../boreal', undefined, null, 42]) {
    const res = await enviarCliente().enviar({ raiz: r, empresa: ruim, hoje: HOJE, pastaTemporaria: tmp });
    assert.strictEqual(res.ok, false, String(ruim));
    assert.strictEqual(res.motivo, 'empresa', String(ruim));
  }
  const cedro = (empresaMod.criar('cedro', 'Cedro Marcenaria', r), 'cedro');
  const vazio = await enviarCliente().enviar({ raiz: r, empresa: cedro, hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(vazio.ok, false);
  assert.strictEqual(vazio.motivo, 'sem-posts');
  assert.ok(/não há posts/i.test(vazio.erro), vazio.erro);
  esc(r, 'empresas/boreal/cronograma/dados/posts.json', '[{ "id": "x", ');
  const quebrado = await enviarCliente().enviar({ raiz: r, empresa: 'boreal', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(quebrado.ok, false);
  assert.strictEqual(quebrado.motivo, 'dados');
  assert.strictEqual(fs.readFileSync(path.join(r, 'empresas/boreal/cronograma/dados/posts.json'), 'utf8'), '[{ "id": "x", ', 'arquivo quebrado não é regravado');
  for (const c of ['aurora', 'boreal', 'cedro']) assert.deepStrictEqual(listaEnvios(r, c), [], c);
  assert.ok(!fs.existsSync(path.join(r, 'empresas', '..', 'envios')));
  assert.deepStrictEqual(fs.readdirSync(tmp), []);
});

// ---------- a arte dentro do arquivo ----------

// Arquivos "de imagem" e "de vídeo" com conteúdo próprio (o arquivo do cliente só os carrega em base64).
const escBin = (r, rel, conteudo) => { const arq = path.join(r, ...rel.split('/')); fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, conteudo); };
const b64 = (s) => Buffer.from(s).toString('base64');

function raizComArte() {
  const r = raizDuas();
  const c = dados.caminhos(r, 'aurora');
  // carrossel do post de 12/11, ainda sem aprovação: as lâminas na pasta de entrega, fora de ordem alfabética
  for (const n of ['lamina-01', 'lamina-02', 'lamina-10']) escBin(r, `empresas/aurora/saidas/c2/entrega/${n}.png`, 'PNG ' + n);
  escBin(r, 'empresas/aurora/saidas/c2/entrega/miniaturas-100px.png', 'PNG miniaturas');
  esc(r, 'empresas/aurora/saidas/c2/preview.html', '<!doctype html>');
  // vídeo do post de 01/12 e uma imagem da boreal que um post da aurora tenta usar
  escBin(r, 'empresas/aurora/saidas/v3/reels.mp4', 'MP4 do reels da aurora');
  escBin(r, 'empresas/boreal/saidas/x/segredo.png', 'PNG da boreal');
  const pecas = dados.lerJson(c.pecas, []);
  pecas.push({ id: 'a-peca-2', name: 'Carrossel: água', path: 'empresas/aurora/saidas/c2/preview.html', pasta: 'empresas/aurora/saidas/c2/entrega', tipo: 'carrossel', postId: 'a-post-2' });
  pecas.push({ id: 'a-peca-3', name: 'Reels: feira', path: 'empresas/aurora/saidas/v3/reels.mp4', video: 'empresas/aurora/saidas/v3/reels.mp4', tipo: 'video', postId: 'a-post-3' });
  dados.gravarJson(c.pecas, pecas);
  const posts = POSTS_AURORA.map((p) => (p.id === 'a-post-1' ? { ...p, images: ['empresas/boreal/saidas/x/segredo.png', '../fora.png'] } : p));
  dados.gravarJson(c.posts, posts);
  return r;
}

t('a arte vai dentro do arquivo: imagens na ordem das lâminas, sem miniatura, vídeo junto, nada de outra empresa', async () => {
  const r = raizComArte();
  const tmp = novaPasta('tmp');
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: tmp });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.comArte, 2, 'o carrossel e o vídeo');
  assert.deepStrictEqual(res.anexos, []);
  const html = fs.readFileSync(res.arquivo, 'utf8');
  const posicoes = ['lamina-01', 'lamina-02', 'lamina-10'].map((n) => html.indexOf(b64('PNG ' + n)));
  assert.ok(posicoes.every((x) => x > 0), 'as três lâminas estão no arquivo');
  assert.ok(posicoes[0] < posicoes[1] && posicoes[1] < posicoes[2], 'na ordem das lâminas (2 antes de 10)');
  assert.ok(!html.includes(b64('PNG miniaturas')), 'a miniatura de conferência não vai');
  assert.ok(html.includes('data:video/mp4;base64,' + b64('MP4 do reels da aurora')), 'o vídeo vai dentro');
  assert.ok(!html.includes(b64('PNG da boreal')), 'imagem de outra empresa nunca entra');
  for (const n of ['12-11 Água ao longo do dia - 01.png', '12-11 Água ao longo do dia - 03.png', '01-12 Feira da semana.mp4']) assert.ok(html.includes(`data-nome="${n}"`), 'nome para baixar: ' + n);
  assert.ok(html.includes('Arte para aprovar'), 'arte pronta ainda sem aprovação');
  assert.ok(html.includes('Arte aprovada'), 'o post aprovado continua aprovado');
  assert.ok(!html.includes('<!--arte-'), 'nenhuma marca sobrando');
  const semScript = html.replace(/<script>[\s\S]*<\/script>/, '');
  for (const interno of ['empresas/', 'saidas', 'a-peca-2', 'reels.mp4', 'lamina-01.png', 'preview.html']) assert.ok(!semScript.includes(interno), 'cita ' + interno);
  // responder pelo WhatsApp: só nos posts com arte para aprovar, com a mensagem pronta; nenhum outro link para fora
  const zap = [...semScript.matchAll(/href="(https:\/\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  assert.strictEqual(zap.length, 4, 'Aprovar e Pedir ajuste nos dois posts com arte para aprovar (não no aprovado)');
  assert.ok(zap.every((u) => u.startsWith('https://api.whatsapp.com/send?text=')), zap.join('\n'));
  assert.ok(zap.includes('https://api.whatsapp.com/send?text=' + encodeURIComponent('Aprovo o post de 12/11 (LinkedIn): Água ao longo do dia.')), zap[0]);
  assert.ok(zap.some((u) => decodeURIComponent(u.split('text=')[1]) === 'Quero um ajuste no post de 01/12 (YouTube): Feira da semana. Ajuste que eu quero:'));
  assert.strictEqual((semScript.match(/https?:\/\//g) || []).length, 4, 'nenhum outro endereço de fora');
});

t('a conferência lê o texto dos posts, não as imagens: o envio com arte continua recusando termo de outra empresa', async () => {
  const r = raizComArte();
  const c = dados.caminhos(r, 'aurora');
  dados.gravarJson(c.posts, dados.lerJson(c.posts, []).map((p) => (p.id === 'a-post-2' ? { ...p, caption: 'Com o ateliê do farol.' } : p)));
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: HOJE, pastaTemporaria: novaPasta('tmp') });
  assert.strictEqual(res.ok, false);
  assert.strictEqual(res.termo, 'ateliê do farol');
  assert.deepStrictEqual(listaEnvios(r, 'aurora'), []);
});

t('vídeo grande demais vai ao lado do arquivo, com o nome do envio, e post antigo não leva a arte', async () => {
  const r = raizComArte();
  const res = await enviarCliente().enviar({ raiz: r, empresa: 'aurora', hoje: '2026-11-20', pastaTemporaria: novaPasta('tmp'), limiteVideo: 5 });
  assert.strictEqual(res.ok, true, JSON.stringify(res));
  assert.strictEqual(res.anexos.length, 1);
  assert.strictEqual(path.basename(res.anexos[0]), 'cronograma-aurora-2026-11-20-video-1.mp4');
  assert.strictEqual(fs.readFileSync(res.anexos[0], 'utf8'), 'MP4 do reels da aurora');
  const html = fs.readFileSync(res.arquivo, 'utf8');
  assert.ok(!html.includes('data:video/mp4'), 'o vídeo não vai dentro');
  assert.ok(html.includes('cronograma-aurora-2026-11-20-video-1.mp4'), 'o arquivo diz o nome do vídeo à parte');
  // 12/11 é mais de 7 dias antes de 20/11: a arte do carrossel não vai
  assert.ok(!html.includes(b64('PNG lamina-01')), 'arte de post antigo fica de fora');
  assert.ok(html.includes('Post de mais de uma semana atrás'), 'e o arquivo explica');
  assert.deepStrictEqual(listaEnvios(r, 'aurora'), ['cronograma-aurora-2026-11-20-video-1.mp4', 'cronograma-aurora-2026-11-20.html']);
});

// ---------- linha de comando ----------

t('linha de comando: 0 gerado, 1 vazamento, 2 uso errado; vale FABRICA_RAIZ', () => {
  const rodar = (r, args) => spawnSync(process.execPath, [ENVIAR, ...args], { encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: r }, timeout: 60000 });
  const r = raizDuas();
  const ok = rodar(r, ['aurora']);
  assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
  const j = JSON.parse(ok.stdout.trim().split('\n').pop());
  assert.strictEqual(j.ok, true);
  assert.ok(/^cronograma-aurora-\d{4}-\d{2}-\d{2}\.html$/.test(path.basename(j.arquivo)), j.arquivo);
  assert.ok(fs.existsSync(j.arquivo));

  const posts = POSTS_AURORA.map((p) => (p.id === 'a-post-2' ? { ...p, caption: 'Com o ateliê do farol.' } : p));
  const rv = raizDuas(posts);
  const vaz = rodar(rv, ['aurora']);
  assert.strictEqual(vaz.status, 1, vaz.stdout + vaz.stderr);
  const jv = JSON.parse(vaz.stdout.trim().split('\n').pop());
  assert.strictEqual(jv.ok, false);
  assert.strictEqual(jv.termo, 'ateliê do farol');
  assert.ok(jv.erro.includes('12/11'), jv.erro);
  assert.deepStrictEqual(listaEnvios(rv, 'aurora'), []);

  assert.strictEqual(rodar(r, []).status, 2);
  assert.strictEqual(rodar(r, ['aurora', 'boreal']).status, 2);
  assert.strictEqual(rodar(r, ['nao-existe']).status, 2);
  assert.strictEqual(rodar(r, ['../aurora']).status, 2);
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
