// Testes de dados.js: validação de peças e posts, leitura e gravação segura de JSON.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DADOS = path.join(__dirname, '..', 'dados.js');
const dados = require(DADOS);

let falhas = 0;
function t(nome, fn) {
  try { fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
}

const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'Fábrica de Teste (EMPRESA)-dados-'));
const pecaOk = { id: 'p1', name: 'Capa 1', path: 'linhas/x/saida/p1/preview.html', tipo: 'capa' };
const postOk = { id: 'a1', date: '2026-10-16', platform: 'insta', title: 'Título' };

t('validarPeca({}) acusa id, name, path e tipo', () => {
  const erros = dados.validarPeca({}).join(' | ');
  for (const campo of ['id', 'name', 'path', 'tipo']) assert.ok(erros.includes(campo), 'faltou erro de ' + campo + ': ' + erros);
});
t('validarPeca aceita peça completa', () => assert.deepStrictEqual(dados.validarPeca(pecaOk), []));
t('validarPeca recusa path com ..', () => assert.ok(dados.validarPeca({ ...pecaOk, path: '../x' }).length > 0));
t('validarPeca recusa path com .. no meio e barra invertida', () => {
  assert.ok(dados.validarPeca({ ...pecaOk, path: 'a/../../x' }).length > 0);
  assert.ok(dados.validarPeca({ ...pecaOk, path: 'a\\..\\x' }).length > 0);
});
t('validarPeca recusa path absoluto', () => {
  assert.ok(dados.validarPeca({ ...pecaOk, path: '/etc/x' }).length > 0);
  assert.ok(dados.validarPeca({ ...pecaOk, path: 'C:\\x\\y.html' }).length > 0);
});
t('validarPeca recusa tipo fora da lista', () => assert.ok(dados.validarPeca({ ...pecaOk, tipo: 'banana' }).length > 0));
t('validarPeca aceita todos os tipos', () => { for (const tp of dados.TIPOS) assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, tipo: tp }), []); });
t('validarPeca recusa pasta com .. e nomesArquivos que não é lista', () => {
  assert.ok(dados.validarPeca({ ...pecaOk, pasta: '../fora' }).length > 0);
  assert.ok(dados.validarPeca({ ...pecaOk, nomesArquivos: 'a.png' }).length > 0);
});
t('validarPeca aceita opcionais bem formados', () => {
  assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, desc: 'd', postId: 'a1', pasta: 'linhas/x/saida', nomesArquivos: ['a.png'], video: 'v.mp4' }), []);
});
t('validarPeca com a empresa: só aceita caminho dentro dela, e o texto fala da pasta da Fábrica', () => {
  assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, path: 'empresas/aurora/saidas/x/preview.html' }, 'aurora'), []);
  assert.ok(dados.validarPeca({ ...pecaOk, path: 'empresas/boreal/saidas/x/preview.html' }, 'aurora').length > 0);
  assert.ok(dados.validarPeca({ ...pecaOk, path: 'linhas/x/saida/preview.html' }, 'aurora').length > 0);
  assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, path: 'linhas/x/saida/preview.html' }, 'principal'), []);
  assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, path: 'linhas/x/saida/preview.html' }, null), []);
  assert.ok(dados.validarPeca({ ...pecaOk, path: 'empresas/boreal/x/preview.html' }, 'principal').length > 0);
  assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, path: 'empresas/boreal/x/preview.html' }), [], 'sem empresa, só a regra de caminho seguro');
  const msg = dados.validarPeca({ ...pecaOk, path: '../x' }).concat(dados.validarPeca({ ...pecaOk, pasta: '../x' })).join(' ');
  assert.ok(/pasta da Fábrica/.test(msg) && !/pasta da empresa/.test(msg), msg);
});
t('validarPeca: a principal com pasta própria (organizada) só aceita empresas/principal/; na pasta antiga, nada muda', () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-organizada-'));
  try {
    const indice = (disposicao) => {
      fs.mkdirSync(path.join(r, 'empresas'), { recursive: true });
      fs.writeFileSync(path.join(r, 'empresas', 'indice.json'), JSON.stringify({ empresas: [
        { codigo: 'principal', nome: 'Aurora Nutrição', disposicao, criada: '2026-10-01', ...(disposicao === 'gaveta' ? { migrada: { em: '2026-11-05', carimbo: '20261105-101010' } } : {}) },
        { codigo: 'boreal', nome: 'Boreal Advocacia', disposicao: 'gaveta', criada: '2026-11-01' },
      ] }));
    };
    indice('gaveta');
    const antiga = { ...pecaOk, path: 'linhas/x/saida/preview.html' };
    assert.ok(dados.validarPeca(antiga, 'principal', r).length > 0, 'organizada: o lugar de antes não vale mais');
    assert.ok(dados.validarPeca({ ...pecaOk, path: 'empresas/principal/saidas/x/preview.html', pasta: '02-PUBLICACOES/x' }, 'principal', r).some((e) => e.startsWith('pasta:')), 'organizada: a pasta de antes também não');
    assert.deepStrictEqual(dados.validarPeca({ ...pecaOk, path: 'empresas/principal/saidas/x/preview.html', pasta: 'empresas/principal/publicacoes/x' }, 'principal', r), []);
    assert.ok(dados.validarPeca({ ...pecaOk, path: 'empresas/boreal/x/preview.html' }, 'principal', r).length > 0);
    assert.strictEqual(dados.pertenceAEmpresa('linhas/x/saida/preview.html', 'principal', r), false);
    assert.strictEqual(dados.pertenceAEmpresa('empresas/principal/x', 'principal', r), true);
    // na pasta antiga (ou sem a raiz, como antes), a regra é a de sempre
    indice('legado');
    assert.deepStrictEqual(dados.validarPeca(antiga, 'principal', r), []);
    assert.deepStrictEqual(dados.validarPeca(antiga, 'principal'), []);
    fs.rmSync(path.join(r, 'empresas'), { recursive: true, force: true });
    assert.deepStrictEqual(dados.validarPeca(antiga, null, r), [], 'pasta sem empresa: a de sempre');
    assert.deepStrictEqual(dados.validarPeca(antiga, 'principal', r), [], 'pasta antiga sem lista de empresas');
  } finally {
    fs.rmSync(r, { recursive: true, force: true });
  }
});
t('validarPeca recusa quem não é objeto', () => { assert.ok(dados.validarPeca(null).length > 0); assert.ok(dados.validarPeca([]).length > 0); });

t('validarPost aceita post mínimo', () => assert.deepStrictEqual(dados.validarPost(postOk), []));
t('validarPost recusa data em formato brasileiro', () => assert.ok(dados.validarPost({ ...postOk, date: '16/10/2026' }).length > 0));
t('validarPost recusa data que não existe', () => assert.ok(dados.validarPost({ ...postOk, date: '2026-02-31' }).length > 0));
t('validarPost recusa plataforma fora da lista', () => assert.ok(dados.validarPost({ ...postOk, platform: 'orkut' }).length > 0));
t('validarPost acusa id, date, platform e title', () => {
  const erros = dados.validarPost({}).join(' | ');
  for (const campo of ['id', 'date', 'platform', 'title']) assert.ok(erros.includes(campo), 'faltou erro de ' + campo);
});
t('validarPost aceita todas as plataformas e opcionais', () => {
  for (const pl of dados.PLATAFORMAS) assert.deepStrictEqual(dados.validarPost({ ...postOk, platform: pl }), []);
  assert.deepStrictEqual(dados.validarPost({ ...postOk, week: 'Semana 1', caption: 'x', images: ['a.png'], tips: 'dica', cenas: [] }), []);
});
t('validarPost recusa images que não é lista', () => assert.ok(dados.validarPost({ ...postOk, images: 'a.png' }).length > 0));

t('lerJson de arquivo ausente devolve o padrão', () => {
  assert.deepStrictEqual(dados.lerJson(path.join(pasta, 'nao-existe.json'), ['x']), ['x']);
});
t('lerJson lê JSON válido', () => {
  const a = path.join(pasta, 'ok.json'); fs.writeFileSync(a, '{"a":1}');
  assert.deepStrictEqual(dados.lerJson(a, null), { a: 1 });
});
t('lerJson de [1,] lança JSON_INVALIDO com o caminho', () => {
  const a = path.join(pasta, 'ruim.json'); fs.writeFileSync(a, '[1,]');
  assert.throws(() => dados.lerJson(a, []), (e) => e instanceof Error && e.code === 'JSON_INVALIDO' && e.message.includes(a));
});

t('gravarJson grava, cria a pasta e não deixa .tmp', () => {
  const a = path.join(pasta, 'sub', 'novo.json');
  dados.gravarJson(a, [{ x: 'é' }]);
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(a, 'utf8')), [{ x: 'é' }]);
  assert.ok(!fs.existsSync(a + '.tmp'));
  assert.deepStrictEqual(fs.readdirSync(path.dirname(a)), ['novo.json']);
});
t('gravarJson troca o conteúdo anterior', () => {
  const a = path.join(pasta, 'troca.json');
  dados.gravarJson(a, [1]); dados.gravarJson(a, [2]);
  assert.deepStrictEqual(dados.lerJson(a), [2]);
});

t('caminhos devolve os quatro arquivos absolutos', () => {
  const c = dados.caminhos(pasta);
  assert.strictEqual(c.pecas, path.join(pasta, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'));
  assert.strictEqual(c.aprovacoes, path.join(pasta, '04-LABORATORIO-DE-DESIGN', 'dados', 'aprovacoes.json'));
  assert.strictEqual(c.posts, path.join(pasta, '03-CRONOGRAMA', 'dados', 'posts.json'));
  assert.strictEqual(c.config, path.join(pasta, '03-CRONOGRAMA', 'dados', 'config.json'));
});

// ---------- caminhos por empresa ----------
const empresaMod = require(path.join(__dirname, '..', '..', 'core', 'empresa.js'));
delete process.env.FABRICA_EMPRESA;
const comMarca = (r, nome) => {
  fs.mkdirSync(path.join(r, '06-MARCA-E-FOTOS'), { recursive: true });
  fs.writeFileSync(path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'), 'empresa:\n  nome: "' + nome + '"\n');
};

t('pasta antiga (principal): os quatro caminhos são exatamente os de sempre', () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-antiga-'));
  comMarca(r, 'Clínica Teste');
  const esperado = {
    pecas: path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'),
    aprovacoes: path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'aprovacoes.json'),
    posts: path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json'),
    config: path.join(r, '03-CRONOGRAMA', 'dados', 'config.json'),
  };
  assert.strictEqual(dados.caminhos(r, 'principal').publicacoes, path.join(r, '02-PUBLICACOES'));
  assert.strictEqual(dados.caminhos(r, 'principal').saidas('reels'), path.join(r, 'linhas', 'reels', 'saida'));
  assert.strictEqual(dados.caminhos(r, 'principal').saidasRaiz, null);
  for (const c of [dados.caminhos(r), dados.caminhos(r, 'principal')]) {
    for (const k of Object.keys(esperado)) assert.strictEqual(c[k], esperado[k], k);
  }
  fs.rmSync(r, { recursive: true, force: true });
});

t('empresa com pasta própria: os caminhos ficam dentro dela e cada uma tem os seus', () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-duas-'));
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  const a = dados.caminhos(r, 'aurora');
  const b = dados.caminhos(r, 'boreal');
  assert.strictEqual(a.pecas, path.join(r, 'empresas', 'aurora', 'laboratorio', 'dados', 'laboratorio.json'));
  assert.strictEqual(a.aprovacoes, path.join(r, 'empresas', 'aurora', 'laboratorio', 'dados', 'aprovacoes.json'));
  assert.strictEqual(a.posts, path.join(r, 'empresas', 'aurora', 'cronograma', 'dados', 'posts.json'));
  assert.strictEqual(a.config, path.join(r, 'empresas', 'aurora', 'cronograma', 'dados', 'config.json'));
  assert.strictEqual(b.posts, path.join(r, 'empresas', 'boreal', 'cronograma', 'dados', 'posts.json'));
  assert.notStrictEqual(a.pecas, b.pecas);
  assert.strictEqual(a.codigo, 'aurora');
  assert.strictEqual(a.publicacoes, path.join(r, 'empresas', 'aurora', 'publicacoes'));
  assert.strictEqual(a.saidasRaiz, path.join(r, 'empresas', 'aurora', 'saidas'));
  assert.strictEqual(a.saidas('reels'), path.join(r, 'empresas', 'aurora', 'saidas', 'reels'));
  fs.rmSync(r, { recursive: true, force: true });
});

t('sem código vale a empresa ativa; duas empresas sem escolha recusam com EMPRESA_NAO_ESCOLHIDA', () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-ativa-'));
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  assert.strictEqual(dados.caminhos(r).codigo, 'aurora'); // uma empresa só
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  assert.throws(() => dados.caminhos(r), (e) => e.code === 'EMPRESA_NAO_ESCOLHIDA');
  empresaMod.ativar('boreal', r);
  assert.strictEqual(dados.caminhos(r).codigo, 'boreal');
  assert.strictEqual(dados.caminhos(r, 'aurora').codigo, 'aurora', 'o código pedido vence a ativa');
  fs.rmSync(r, { recursive: true, force: true });
});

t('código vazio, com ../ ou que não existe: recusa antes de montar qualquer caminho', () => {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), 'dados-ruim-'));
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  for (const ruim of ['', '../x', '..', 'nao-existe', 'aurora/../boreal', 'AURORA', 5, {}]) {
    assert.throws(() => dados.caminhos(r, ruim), (e) => e.code === 'EMPRESA_DESCONHECIDA', JSON.stringify(ruim));
  }
  fs.rmSync(r, { recursive: true, force: true });
});

t('sem nenhuma empresa na pasta: valem os caminhos de sempre (a pasta ainda vazia)', () => {
  const c = dados.caminhos(pasta);
  assert.strictEqual(c.codigo, null);
  assert.strictEqual(c.publicacoes, path.join(pasta, '02-PUBLICACOES'));
  assert.strictEqual(c.saidas('reels'), path.join(pasta, 'linhas', 'reels', 'saida'));
  assert.strictEqual(c.pecas, path.join(pasta, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'));
  assert.strictEqual(c.pastaLaboratorio, path.join(pasta, '04-LABORATORIO-DE-DESIGN'));
  assert.strictEqual(c.pastaCronograma, path.join(pasta, '03-CRONOGRAMA'));
});

t('raiz() usa FABRICA_RAIZ quando existe e a pasta da Fábrica quando não', () => {
  const rodar = (env) => spawnSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(DADOS)}).raiz())`], { encoding: 'utf8', env });
  const semVar = { ...process.env }; delete semVar.FABRICA_RAIZ;
  assert.strictEqual(rodar({ ...process.env, FABRICA_RAIZ: pasta }).stdout, pasta);
  assert.strictEqual(rodar(semVar).stdout, path.resolve(__dirname, '..', '..', '..'));
});

fs.rmSync(pasta, { recursive: true, force: true });
if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
