// Testes de instalar.js e registrar.js: cada caso roda numa pasta de empresa temporária (com acento, espaço e
// parênteses no nome, como as pastas reais), por um processo separado, apontando para ela com FABRICA_RAIZ.
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REGISTRAR = path.join(__dirname, '..', 'registrar.js');
const INSTALAR = path.join(__dirname, '..', 'instalar.js');

// Nome da empresa de origem do painel, montado em duas partes para o próprio teste não carregá-lo escrito.
const MARCA_DE_OUTRA_EMPRESA = new RegExp(['cred', 'ita'].join(''), 'i');

// O ambiente de quem roda o teste não pode escolher empresa nem marca por conta própria.
delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;

let falhas = 0;
let contador = 0;
const pastas = [];
function t(nome, fn) {
  try { fn(); console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n     ' + (e.stack || e)); }
}

function novaRaiz() {
  const r = path.join(os.tmpdir(), `Fábrica de Teste (EMPRESA)-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function registrar(r, tipo, objeto, extra = {}) {
  const args = [REGISTRAR, tipo];
  const opcoes = { encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: r } };
  if (objeto !== undefined) { args.push('-'); opcoes.input = typeof objeto === 'string' ? objeto : JSON.stringify(objeto); }
  const res = spawnSync(process.execPath, args.concat(extra.args || []), opcoes);
  let saida = null;
  try { saida = JSON.parse(res.stdout); } catch { /* saída que não é JSON fica nula */ }
  return { status: res.status, saida, stdout: res.stdout, stderr: res.stderr };
}
function criarPreview(r, rel) {
  const arq = path.join(r, rel);
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, '<!doctype html><title>x</title>');
}
const peca = (id, extra = {}) => ({ id, name: 'Peça ' + id, path: `linhas/x/saida/${id}/preview.html`, tipo: 'capa', ...extra });
const lerPecas = (r) => JSON.parse(fs.readFileSync(path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'), 'utf8'));
const existe = (r, ...p) => fs.existsSync(path.join(r, ...p));

t('raiz vazia: registrar peca cria só os arquivos do laboratório, primeiraVez true', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  const res = registrar(r, 'peca', peca('a'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.ok, true);
  assert.strictEqual(res.saida.painel, 'laboratorio');
  assert.strictEqual(res.saida.primeiraVez, true);
  assert.ok(existe(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'));
  assert.ok(existe(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'aprovacoes.json'));
  assert.ok(existe(r, '04-LABORATORIO-DE-DESIGN', 'COMO-ACESSAR.md'));
  assert.ok(existe(r, 'Abrir Laboratório de Design.bat'));
  assert.ok(existe(r, 'Abrir Laboratório de Design.command'));
  assert.ok(!existe(r, '03-CRONOGRAMA'), 'o cronograma não pode nascer junto com o laboratório');
  assert.strictEqual(fs.realpathSync(res.saida.comoAcessar), fs.realpathSync(path.join(r, '04-LABORATORIO-DE-DESIGN', 'COMO-ACESSAR.md')));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'aprovacoes.json'), 'utf8')), {});
  assert.strictEqual(lerPecas(r).length, 1);
});

t('segunda peça: primeiraVez false e entra no topo', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html'); criarPreview(r, 'linhas/x/saida/b/preview.html');
  registrar(r, 'peca', peca('a'));
  const res = registrar(r, 'peca', peca('b'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.primeiraVez, false);
  assert.deepStrictEqual(lerPecas(r).map((p) => p.id), ['b', 'a']);
});

t('mesmo id substitui no lugar, sem duplicar', () => {
  const r = novaRaiz(); for (const i of ['a', 'b', 'c']) criarPreview(r, `linhas/x/saida/${i}/preview.html`);
  for (const i of ['a', 'b', 'c']) registrar(r, 'peca', peca(i));
  const res = registrar(r, 'peca', peca('a', { name: 'Nome novo' }));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  const lista = lerPecas(r);
  assert.deepStrictEqual(lista.map((p) => p.id), ['c', 'b', 'a']);
  assert.strictEqual(lista.find((p) => p.id === 'a').name, 'Nome novo');
});

t('path inexistente: saída 1, erro claro e nada gravado', () => {
  const r = novaRaiz();
  const res = registrar(r, 'peca', peca('a'));
  assert.strictEqual(res.status, 1);
  assert.strictEqual(res.saida.ok, false);
  assert.ok(res.saida.erros.join(' ').includes('preview.html'), res.stdout);
  assert.ok(!existe(r, '04-LABORATORIO-DE-DESIGN'), 'não deve instalar nada quando a peça é recusada');
});

t('peça inválida: saída 1 com a lista de erros', () => {
  const r = novaRaiz();
  const res = registrar(r, 'peca', { name: 'sem id' });
  assert.strictEqual(res.status, 1);
  assert.ok(res.saida.erros.length >= 3);
});

t('laboratorio.json corrompido: saída 1 e arquivo intacto byte a byte', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  const arq = path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const bytes = Buffer.from('[{"id":"velha",},]\n', 'utf8');
  fs.writeFileSync(arq, bytes);
  const res = registrar(r, 'peca', peca('a'));
  assert.strictEqual(res.status, 1);
  assert.strictEqual(res.saida.ok, false);
  assert.ok(res.saida.erros.join(' ').includes('laboratorio.json'));
  assert.ok(Buffer.compare(fs.readFileSync(arq), bytes) === 0, 'o arquivo foi alterado');
  assert.ok(!existe(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json.tmp'));
});

t('posts.json corrompido: saída 1 e arquivo intacto byte a byte', () => {
  const r = novaRaiz();
  const arq = path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const bytes = Buffer.from('[1,]', 'utf8');
  fs.writeFileSync(arq, bytes);
  const res = registrar(r, 'post', { id: 'p', date: '2026-10-16', platform: 'insta', title: 'T' });
  assert.strictEqual(res.status, 1);
  assert.ok(Buffer.compare(fs.readFileSync(arq), bytes) === 0);
});

t('posts.json com item que não é objeto ([null]): saída 1, mensagem legível e arquivo intacto', () => {
  const r = novaRaiz();
  const arq = path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const bytes = Buffer.from('[null]', 'utf8');
  fs.writeFileSync(arq, bytes);
  const res = registrar(r, 'post', { id: 'p', date: '2026-10-16', platform: 'insta', title: 'T' });
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(res.saida.ok, false);
  assert.ok(res.saida.erros.join(' ').includes('posts.json'));
  assert.ok(!res.stderr.includes('TypeError'), res.stderr);
  assert.ok(Buffer.compare(fs.readFileSync(arq), bytes) === 0);
});

t('laboratorio.json com item que não é objeto: saída 1, mensagem legível e arquivo intacto', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  const arq = path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  for (const conteudo of ['[3]', '["texto"]', '[[1]]', '[{"id":"ok"},null]']) {
    const bytes = Buffer.from(conteudo, 'utf8');
    fs.writeFileSync(arq, bytes);
    const res = registrar(r, 'peca', peca('a'));
    assert.strictEqual(res.status, 1, conteudo + ' ' + res.stdout + res.stderr);
    assert.strictEqual(res.saida.ok, false);
    assert.ok(res.saida.erros.join(' ').includes('laboratorio.json'));
    assert.ok(!res.stderr.includes('TypeError'), res.stderr);
    assert.ok(Buffer.compare(fs.readFileSync(arq), bytes) === 0, conteudo);
  }
});

t('registrar post cria 03-CRONOGRAMA com primeiraVez true e sem tocar no laboratório', () => {
  const r = novaRaiz();
  const res = registrar(r, 'post', { id: 'p1', date: '2026-10-16', platform: 'insta', title: 'Um post' });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.painel, 'cronograma');
  assert.strictEqual(res.saida.primeiraVez, true);
  assert.ok(existe(r, '03-CRONOGRAMA', 'dados', 'posts.json'));
  assert.ok(existe(r, '03-CRONOGRAMA', 'dados', 'config.json'));
  assert.ok(existe(r, '03-CRONOGRAMA', 'COMO-ACESSAR.md'));
  assert.ok(!existe(r, '04-LABORATORIO-DE-DESIGN'));
  assert.ok(!existe(r, 'Abrir Laboratório de Design.bat'));
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(r, '03-CRONOGRAMA', 'dados', 'config.json'), 'utf8')), { titulo: '', periodo: '', pessoas: [], aprovadores: [] });
});

t('posts: mesmo id substitui e a lista fica ordenada por data', () => {
  const r = novaRaiz();
  const p = (id, date, title = id) => ({ id, date, platform: 'yt', title });
  registrar(r, 'post', p('c', '2026-10-18'));
  registrar(r, 'post', p('a', '2026-10-16'));
  const res = registrar(r, 'post', p('b', '2026-10-17'));
  assert.strictEqual(res.saida.primeiraVez, false);
  registrar(r, 'post', p('a', '2026-10-19', 'a novo'));
  const lista = JSON.parse(fs.readFileSync(path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json'), 'utf8'));
  assert.deepStrictEqual(lista.map((x) => x.id), ['b', 'c', 'a']);
  assert.strictEqual(lista[2].title, 'a novo');
});

t('post inválido (data brasileira): saída 1 e nada instalado', () => {
  const r = novaRaiz();
  const res = registrar(r, 'post', { id: 'p', date: '16/10/2026', platform: 'insta', title: 'T' });
  assert.strictEqual(res.status, 1);
  assert.ok(res.saida.erros.join(' ').includes('date'));
  assert.ok(!existe(r, '03-CRONOGRAMA'));
});

t('COMO-ACESSAR.md existente com texto do usuário não é sobrescrito', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  const arq = path.join(r, '04-LABORATORIO-DE-DESIGN', 'COMO-ACESSAR.md');
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, 'texto meu\n');
  const res = registrar(r, 'peca', peca('a'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(fs.readFileSync(arq, 'utf8'), 'texto meu\n');
});

t('lê o objeto de um arquivo, além do stdin', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  const arq = path.join(r, 'peca.json'); fs.writeFileSync(arq, JSON.stringify(peca('a')));
  const res = spawnSync(process.execPath, [REGISTRAR, 'peca', arq], { encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: r } });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
});

t('uso errado: saída 2', () => {
  const r = novaRaiz();
  const env = { ...process.env, FABRICA_RAIZ: r };
  assert.strictEqual(spawnSync(process.execPath, [REGISTRAR], { encoding: 'utf8', env }).status, 2);
  assert.strictEqual(spawnSync(process.execPath, [REGISTRAR, 'banana', '-'], { encoding: 'utf8', env, input: '{}' }).status, 2);
  assert.strictEqual(spawnSync(process.execPath, [REGISTRAR, 'peca'], { encoding: 'utf8', env }).status, 2);
});

t('JSON de entrada quebrado: saída 1', () => {
  const r = novaRaiz();
  const res = registrar(r, 'peca', '{"id":');
  assert.strictEqual(res.status, 1);
  assert.strictEqual(res.saida.ok, false);
});

t('instalar nunca sobrescreve e devolve criados vazio quando já estava instalado', () => {
  const r = novaRaiz();
  const { instalar } = require(INSTALAR);
  const primeira = instalar('laboratorio', r);
  assert.ok(primeira.criados.length >= 5, 'criou ' + primeira.criados.length);
  const segunda = instalar('laboratorio', r);
  assert.deepStrictEqual(segunda.criados, []);
  const cro = instalar('cronograma', r);
  assert.ok(cro.criados.length >= 3);
  assert.deepStrictEqual(instalar('cronograma', r).criados, []);
  assert.throws(() => instalar('outro', r));
});

t('os textos de COMO-ACESSAR são simples e não citam empresa nenhuma', () => {
  const { instalar } = require(INSTALAR);
  const r = novaRaiz(); instalar('laboratorio', r); instalar('cronograma', r);
  for (const rel of [['04-LABORATORIO-DE-DESIGN', 'COMO-ACESSAR.md'], ['03-CRONOGRAMA', 'COMO-ACESSAR.md']]) {
    const txt = fs.readFileSync(path.join(r, ...rel), 'utf8');
    assert.ok(/localhost:8890/.test(txt), 'sem o endereço padrão');
    assert.ok(!MARCA_DE_OUTRA_EMPRESA.test(txt));
  }
  const bat = fs.readFileSync(path.join(r, 'Abrir Laboratório de Design.bat'), 'utf8');
  const cmd = fs.readFileSync(path.join(r, 'Abrir Laboratório de Design.command'), 'utf8');
  assert.ok(bat.includes('_fabrica\\paineis\\servidor.js') || bat.includes('_fabrica/paineis/servidor.js'));
  assert.ok(cmd.includes('cd "$(dirname "$0")"') && cmd.includes('_fabrica/paineis/servidor.js'));
  assert.ok(!MARCA_DE_OUTRA_EMPRESA.test(bat + cmd));
  assert.ok(!cmd.includes('\r'), 'o atalho do Mac precisa terminar linhas com LF');
  assert.ok(bat.includes('\r\n') && !/[^\r]\n/.test(bat), 'o atalho do Windows precisa terminar linhas com CRLF');
});

// ---------- por empresa ----------
const empresaMod = require(path.join(__dirname, '..', '..', 'core', 'empresa.js'));
const raizComDuas = () => {
  const r = novaRaiz();
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  return r;
};
const G = (r, c, ...p) => path.join(r, 'empresas', c, ...p);
const lerLista = (arq) => JSON.parse(fs.readFileSync(arq, 'utf8'));
const pecaDe = (c, id) => ({ id, name: 'Peça ' + id, path: `empresas/${c}/saidas/x/${id}/preview.html`, tipo: 'capa' });

t('--empresa: a peça entra nos arquivos da empresa pedida e a outra empresa não é tocada', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.empresa, 'aurora');
  assert.strictEqual(res.saida.primeiraVez, true);
  assert.deepStrictEqual(lerLista(G(r, 'aurora', 'laboratorio', 'dados', 'laboratorio.json')).map((p) => p.id), ['a']);
  assert.deepStrictEqual(lerLista(G(r, 'aurora', 'laboratorio', 'dados', 'aprovacoes.json')), {});
  assert.ok(existe(r, 'empresas', 'aurora', 'laboratorio', 'COMO-ACESSAR.md'));
  assert.strictEqual(fs.realpathSync(res.saida.comoAcessar), fs.realpathSync(G(r, 'aurora', 'laboratorio', 'COMO-ACESSAR.md')));
  assert.ok(existe(r, 'Abrir Laboratório de Design.bat'), 'o atalho é um só para a Fábrica, na pasta principal');
  assert.ok(!existe(r, 'empresas', 'boreal', 'laboratorio'), 'a outra empresa não pode ganhar nada');
  assert.ok(!existe(r, '04-LABORATORIO-DE-DESIGN') && !existe(r, '03-CRONOGRAMA'), 'nada de pasta antiga');
});

t('--empresa: o post entra no cronograma da empresa pedida, em qualquer posição do comando', () => {
  const r = raizComDuas();
  const res = registrar(r, 'post', { id: 'p1', date: '2026-10-16', platform: 'insta', title: 'Um post' }, { args: ['--empresa', 'boreal'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.empresa, 'boreal');
  assert.deepStrictEqual(lerLista(G(r, 'boreal', 'cronograma', 'dados', 'posts.json')).map((p) => p.id), ['p1']);
  assert.ok(existe(r, 'empresas', 'boreal', 'cronograma', 'COMO-ACESSAR.md'));
  assert.ok(!existe(r, 'empresas', 'aurora', 'cronograma'));
  // a opção também vale antes do tipo
  const r2 = raizComDuas();
  const x = spawnSync(process.execPath, [REGISTRAR, '--empresa', 'aurora', 'post', '-'], { encoding: 'utf8', env: { ...process.env, FABRICA_RAIZ: r2 }, input: JSON.stringify({ id: 'p2', date: '2026-10-17', platform: 'yt', title: 'Outro' }) });
  assert.strictEqual(x.status, 0, x.stdout + x.stderr);
  assert.ok(existe(r2, 'empresas', 'aurora', 'cronograma', 'dados', 'posts.json'));
});

t('sem --empresa vale a ativa; --empresa vence a ativa', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html'); criarPreview(r, 'empresas/boreal/saidas/x/b/preview.html');
  empresaMod.ativar('aurora', r);
  let res = registrar(r, 'peca', pecaDe('aurora', 'a'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.empresa, 'aurora');
  assert.ok(existe(r, 'empresas', 'aurora', 'laboratorio', 'dados', 'laboratorio.json'));
  res = registrar(r, 'peca', pecaDe('boreal', 'b'), { args: ['--empresa', 'boreal'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.deepStrictEqual(lerLista(G(r, 'boreal', 'laboratorio', 'dados', 'laboratorio.json')).map((p) => p.id), ['b']);
  assert.deepStrictEqual(lerLista(G(r, 'aurora', 'laboratorio', 'dados', 'laboratorio.json')).map((p) => p.id), ['a']);
  // registrar não troca a empresa ativa
  assert.deepStrictEqual(lerLista(G(r, 'ativa.json')), { empresa: 'aurora' });
});

t('duas empresas e nenhuma escolhida: recusa com mensagem clara e nada é criado', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  const antes = fs.readdirSync(path.join(r, 'empresas')).sort();
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'));
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.strictEqual(res.saida.ok, false);
  assert.ok(/--empresa/.test(res.saida.erros.join(' ')), res.stdout);
  assert.ok(!res.stderr.includes('    at '), 'sem pilha de erro: ' + res.stderr);
  assert.deepStrictEqual(fs.readdirSync(path.join(r, 'empresas')).sort(), antes);
  assert.ok(!existe(r, 'empresas', 'aurora', 'laboratorio') && !existe(r, 'Abrir Laboratório de Design.bat'));
});

t('--empresa vazia, com ../ ou inexistente: recusa e nada é criado fora de empresas/', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  const antes = fs.readdirSync(r).sort();
  for (const ruim of ['', '../x', '..', 'nao-existe', 'aurora/../boreal', '/tmp/x']) {
    const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', ruim] });
    assert.strictEqual(res.status, 1, JSON.stringify(ruim) + ' ' + res.stdout + res.stderr);
    assert.strictEqual(res.saida.ok, false);
    assert.ok(/empresa/i.test(res.saida.erros.join(' ')), res.stdout);
  }
  assert.deepStrictEqual(fs.readdirSync(r).sort(), antes);
  assert.ok(!existe(r, 'empresas', 'aurora', 'laboratorio'));
});

t('--empresa sem o código: uso errado, saída 2', () => {
  const r = raizComDuas();
  const env = { ...process.env, FABRICA_RAIZ: r };
  assert.strictEqual(spawnSync(process.execPath, [REGISTRAR, 'post', '-', '--empresa'], { encoding: 'utf8', env, input: '{}' }).status, 2);
});

t('uma empresa só (pasta antiga com marca): nada muda, os arquivos ficam onde sempre ficaram', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  fs.mkdirSync(path.join(r, '06-MARCA-E-FOTOS'), { recursive: true });
  fs.writeFileSync(path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'), 'empresa:\n  nome: "Clínica Teste"\n');
  const res = registrar(r, 'peca', peca('a'));
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.empresa, 'principal');
  assert.strictEqual(lerPecas(r).length, 1);
  assert.ok(existe(r, '04-LABORATORIO-DE-DESIGN', 'COMO-ACESSAR.md'));
  assert.ok(!existe(r, 'empresas'), 'registrar não cria a pasta empresas/ na pasta antiga');
  const com = registrar(r, 'peca', peca('a'), { args: ['--empresa', 'principal'] });
  assert.strictEqual(com.status, 0, com.stdout + com.stderr);
});

t('peça com arquivos de outra empresa: recusada com mensagem simples e nada é criado nem gravado', () => {
  const r = raizComDuas();
  criarPreview(r, 'empresas/boreal/saidas/carrossel/x/preview.html'); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html'); criarPreview(r, 'linhas/x/saida/a/preview.html');
  const antes = fs.readdirSync(path.join(r, 'empresas')).sort();
  const alheios = ['empresas/boreal/saidas/carrossel/x/preview.html', 'Empresas/BOREAL/saidas/carrossel/x/preview.html', String.raw`empresas\boreal\saidas\carrossel\x\preview.html`,
    'empresas/boreal./saidas/carrossel/x/preview.html', 'empresas/principal/x/preview.html', 'linhas/x/saida/a/preview.html', 'empresas/preview.html'];
  for (const alheio of alheios) {
    const res = registrar(r, 'peca', { ...pecaDe('aurora', 'a'), path: alheio }, { args: ['--empresa', 'aurora'] });
    assert.strictEqual(res.status, 1, alheio + ' ' + res.stdout + res.stderr);
    assert.strictEqual(res.saida.ok, false);
    assert.ok(/outra empresa/.test(res.saida.erros.join(' ')) && /empresas[/]aurora[/]/.test(res.saida.erros.join(' ')), res.stdout);
    assert.ok(!/gaveta|disposi|índice|indice|legado/i.test(res.stdout), res.stdout);
  }
  // a pasta da peça também precisa ser da empresa
  const pasta = registrar(r, 'peca', { ...pecaDe('aurora', 'a'), pasta: 'empresas/boreal/publicacoes/x' }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(pasta.status, 1, pasta.stdout + pasta.stderr);
  assert.ok(/pasta: /.test(pasta.saida.erros.join(' ')), pasta.stdout);
  assert.deepStrictEqual(fs.readdirSync(path.join(r, 'empresas')).sort(), antes);
  assert.ok(!existe(r, 'empresas', 'aurora', 'laboratorio') && !existe(r, 'empresas', 'boreal', 'laboratorio') && !existe(r, 'Abrir Laboratório de Design.bat'), 'nada instalado');
  // o certo continua entrando, com pasta da própria empresa
  const ok = registrar(r, 'peca', { ...pecaDe('aurora', 'a'), pasta: 'empresas/aurora/publicacoes/x' }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(ok.status, 0, ok.stdout + ok.stderr);
});

t('pasta antiga: a peça pode ficar fora de empresas/, mas não nos arquivos de outra empresa', () => {
  const r = novaRaiz(); criarPreview(r, 'linhas/x/saida/a/preview.html');
  fs.mkdirSync(path.join(r, '06-MARCA-E-FOTOS'), { recursive: true });
  fs.writeFileSync(path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'), ['empresa:', '  nome: "Clínica Teste"', ''].join('\n'));
  empresaMod.criar('aurora', 'Aurora Nutrição', r); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  assert.strictEqual(registrar(r, 'peca', peca('a'), { args: ['--empresa', 'principal'] }).status, 0);
  for (const alheio of ['empresas/aurora/saidas/x/a/preview.html', 'EMPRESAS/Aurora/saidas/x/a/preview.html', 'empresas./aurora/saidas/x/a/preview.html', 'empresas/aurora /saidas/x/a/preview.html']) {
    const res = registrar(r, 'peca', { ...peca('b'), path: alheio }, { args: ['--empresa', 'principal'] });
    assert.strictEqual(res.status, 1, alheio + ' ' + res.stdout + res.stderr);
    assert.ok(/outra empresa/.test(res.saida.erros.join(' ')), res.stdout);
  }
  assert.deepStrictEqual(lerPecas(r).map((p) => p.id), ['a']);
});

// ---------- a peça guarda o estilo com que foi feita ----------
const CATALOGO = path.join(__dirname, '..', '..', '..', '04-LABORATORIO-DE-DESIGN', 'estilos');
const estiloJson = (estilo, origem = 'catalogo') => JSON.stringify({ versao: 1, estilo, origem, escolhido: '2026-11-05T12:00:00.000Z', personalizacoes: {}, historico: [] }, null, 2) + '\n';
function proprioDe(r, c, base, id, nome) {
  const para = path.join(r, 'empresas', c, 'estilos-proprios', id);
  fs.cpSync(path.join(CATALOGO, base), para, { recursive: true });
  const y = fs.readFileSync(path.join(para, 'estilo.yaml'), 'utf8').replace(/^id:.*$/m, `id: ${id}`).replace(/^origem:.*$/m, 'origem: referencias').replace(/^nome:.*$/m, `nome: ${nome}`);
  fs.writeFileSync(path.join(para, 'estilo.yaml'), y);
}
const escolher = (r, c, estilo, origem) => fs.writeFileSync(path.join(r, 'empresas', c, 'estilo.json'), estiloJson(estilo, origem));
const arqLab = (r, c) => G(r, c, 'laboratorio', 'dados', 'laboratorio.json');

t('peça nova guarda o estilo escolhido pela empresa (id, origem e nome)', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  escolher(r, 'aurora', 'cartilha');
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.deepStrictEqual(lerLista(arqLab(r, 'aurora'))[0].estilo, { id: 'cartilha', origem: 'catalogo', nome: 'Cartilha' });
});

t('estilo próprio da empresa: a peça guarda o próprio, com o nome dele', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  proprioDe(r, 'aurora', 'terra-e-salvia', 'aurora-horta', 'Horta da Aurora');
  escolher(r, 'aurora', 'aurora-horta', 'proprio');
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.deepStrictEqual(lerLista(arqLab(r, 'aurora'))[0].estilo, { id: 'aurora-horta', origem: 'proprio', nome: 'Horta da Aurora' });
});

t('sem estilo escolhido: a peça entra como sempre, sem o campo estilo', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(!('estilo' in lerLista(arqLab(r, 'aurora'))[0]));
  // pasta antiga sem estilo: igual a antes
  const r2 = novaRaiz(); criarPreview(r2, 'linhas/x/saida/a/preview.html');
  assert.strictEqual(registrar(r2, 'peca', peca('a')).status, 0);
  assert.ok(!('estilo' in lerPecas(r2)[0]));
});

t('peça antiga nunca é regravada: as outras ficam iguais byte a byte, e o mesmo id não ganha estilo que não tinha', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html'); criarPreview(r, 'empresas/aurora/saidas/x/b/preview.html');
  assert.strictEqual(registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] }).status, 0); // antes do estilo
  const blocoAntigo = JSON.stringify(lerLista(arqLab(r, 'aurora'))[0], null, 2).split('\n').map((l) => '  ' + l).join('\n');
  assert.ok(fs.readFileSync(arqLab(r, 'aurora'), 'utf8').includes(blocoAntigo), 'o formato gravado é o de sempre');
  escolher(r, 'aurora', 'cartilha');
  assert.strictEqual(registrar(r, 'peca', pecaDe('aurora', 'b'), { args: ['--empresa', 'aurora'] }).status, 0);
  const texto = fs.readFileSync(arqLab(r, 'aurora'), 'utf8');
  assert.ok(texto.includes(blocoAntigo), 'a peça antiga mudou');
  const [b, a] = lerLista(arqLab(r, 'aurora'));
  assert.strictEqual(b.estilo.id, 'cartilha');
  assert.ok(!('estilo' in a));
  // registrar de novo a peça antiga (mesmo id) não inventa o estilo de hoje para ela
  assert.strictEqual(registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] }).status, 0);
  assert.ok(!('estilo' in lerLista(arqLab(r, 'aurora')).find((p) => p.id === 'a')));
  // e a que já tinha estilo continua com o dela depois de a empresa trocar de estilo
  escolher(r, 'aurora', 'bloco');
  assert.strictEqual(registrar(r, 'peca', { ...pecaDe('aurora', 'b'), name: 'Nome novo' }, { args: ['--empresa', 'aurora'] }).status, 0);
  assert.strictEqual(lerLista(arqLab(r, 'aurora')).find((p) => p.id === 'b').estilo.id, 'cartilha');
});

t('a peça que diz o seu estilo: do catálogo ou próprio desta empresa; nunca o de outra empresa', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/boreal/saidas/x/a/preview.html'); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  proprioDe(r, 'aurora', 'terra-e-salvia', 'aurora-horta', 'Horta da Aurora');
  escolher(r, 'boreal', 'cartilha');
  // a peça diz o dela (do catálogo): vale o dela, não o escolhido
  let res = registrar(r, 'peca', { ...pecaDe('boreal', 'a'), estilo: 'bloco' }, { args: ['--empresa', 'boreal'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.deepStrictEqual(lerLista(arqLab(r, 'boreal'))[0].estilo, { id: 'bloco', origem: 'catalogo', nome: 'Bloco' });
  const antes = fs.readFileSync(arqLab(r, 'boreal'));
  // estilo próprio de outra empresa, inexistente ou caminho: recusa e nada muda
  for (const ruim of ['aurora-horta', { id: 'aurora-horta', origem: 'proprio' }, '../bloco', 'nao-existe', 42, { origem: 'catalogo' }]) {
    res = registrar(r, 'peca', { ...pecaDe('boreal', 'a'), estilo: ruim }, { args: ['--empresa', 'boreal'] });
    assert.strictEqual(res.status, 1, JSON.stringify(ruim) + ' ' + res.stdout + res.stderr);
    assert.ok(/estilo/.test(res.saida.erros.join(' ')) && /desta empresa/.test(res.saida.erros.join(' ')), res.stdout);
    assert.ok(Buffer.compare(fs.readFileSync(arqLab(r, 'boreal')), antes) === 0);
  }
  // estilo.json da boreal apontando à mão para o próprio da aurora: a peça entra sem estilo
  escolher(r, 'boreal', 'aurora-horta', 'proprio');
  criarPreview(r, 'empresas/boreal/saidas/x/c/preview.html');
  res = registrar(r, 'peca', pecaDe('boreal', 'c'), { args: ['--empresa', 'boreal'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(!('estilo' in lerLista(arqLab(r, 'boreal')).find((p) => p.id === 'c')));
  // o nome mandado pela peça nunca vale: o nome vem do estilo
  res = registrar(r, 'peca', { ...pecaDe('aurora', 'a'), estilo: { id: 'aurora-horta', origem: 'proprio', nome: 'Inventado' } }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(lerLista(arqLab(r, 'aurora'))[0].estilo.nome, 'Horta da Aurora');
});

t('a peça diz o estilo usado: trocado no pedido vale o dela; null é sem estilo; sem o campo vale o da empresa', () => {
  const r = raizComDuas();
  for (const id of ['a', 'b', 'c', 'd']) criarPreview(r, `empresas/aurora/saidas/x/${id}/preview.html`);
  proprioDe(r, 'aurora', 'terra-e-salvia', 'aurora-horta', 'Horta da Aurora');
  escolher(r, 'aurora', 'cartilha');
  // sem o campo: o estilo da empresa (as linhas usam o estilo da empresa por padrão)
  let res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(res.saida.estilo, 'Cartilha');
  assert.deepStrictEqual(lerLista(arqLab(r, 'aurora'))[0].estilo, { id: 'cartilha', origem: 'catalogo', nome: 'Cartilha' });
  // estilo trocado no pedido (do catálogo): vale o usado, não o da empresa
  res = registrar(r, 'peca', { ...pecaDe('aurora', 'b'), estilo: 'bloco' }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.deepStrictEqual(lerLista(arqLab(r, 'aurora')).find((p) => p.id === 'b').estilo, { id: 'bloco', origem: 'catalogo', nome: 'Bloco' });
  // estilo trocado para um próprio desta empresa
  res = registrar(r, 'peca', { ...pecaDe('aurora', 'c'), estilo: { id: 'aurora-horta', origem: 'proprio' } }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.deepStrictEqual(lerLista(arqLab(r, 'aurora')).find((p) => p.id === 'c').estilo, { id: 'aurora-horta', origem: 'proprio', nome: 'Horta da Aurora' });
  // null explícito: sem estilo (nem o da empresa), sem o campo, e as outras peças ficam iguais byte a byte
  const outras = JSON.stringify(lerLista(arqLab(r, 'aurora')));
  res = registrar(r, 'peca', { ...pecaDe('aurora', 'd'), estilo: null }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(!('estilo' in res.saida), res.stdout);
  const lista = lerLista(arqLab(r, 'aurora'));
  assert.ok(!('estilo' in lista.find((p) => p.id === 'd')));
  assert.strictEqual(JSON.stringify(lista.filter((p) => p.id !== 'd')), outras);
  // a mesma peça registrada de novo com null perde o estilo que tinha (a peça diz que não usou nenhum)
  res = registrar(r, 'peca', { ...pecaDe('aurora', 'a'), estilo: null }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(!('estilo' in lerLista(arqLab(r, 'aurora')).find((p) => p.id === 'a')));
  // estilo próprio de outra empresa continua recusado
  criarPreview(r, 'empresas/boreal/saidas/x/a/preview.html');
  res = registrar(r, 'peca', { ...pecaDe('boreal', 'a'), estilo: { id: 'aurora-horta', origem: 'proprio' } }, { args: ['--empresa', 'boreal'] });
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
  assert.ok(/desta empresa/.test(res.saida.erros.join(' ')), res.stdout);
  // false não é "sem estilo": recusa
  res = registrar(r, 'peca', { ...pecaDe('aurora', 'b'), estilo: false }, { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 1, res.stdout + res.stderr);
});

t('estilo guardado de antes é mantido com o nome limpo (uma linha, sem invisíveis)', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  escolher(r, 'aurora', 'cartilha');
  assert.strictEqual(registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] }).status, 0);
  const lista = lerLista(arqLab(r, 'aurora'));
  lista[0].estilo.nome = 'Carti​lha\n  editada';
  fs.writeFileSync(arqLab(r, 'aurora'), JSON.stringify(lista, null, 2));
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.strictEqual(lerLista(arqLab(r, 'aurora'))[0].estilo.nome, 'Cartilha editada');
});

t('estilo.json quebrado não impede o registro: a peça entra sem estilo, com aviso, e o arquivo fica intacto', () => {
  const r = raizComDuas(); criarPreview(r, 'empresas/aurora/saidas/x/a/preview.html');
  fs.writeFileSync(path.join(r, 'empresas', 'aurora', 'estilo.json'), '{"versao":');
  const res = registrar(r, 'peca', pecaDe('aurora', 'a'), { args: ['--empresa', 'aurora'] });
  assert.strictEqual(res.status, 0, res.stdout + res.stderr);
  assert.ok(/estilo/.test(res.saida.aviso), res.stdout);
  assert.ok(!('estilo' in lerLista(arqLab(r, 'aurora'))[0]));
  assert.strictEqual(fs.readFileSync(path.join(r, 'empresas', 'aurora', 'estilo.json'), 'utf8'), '{"versao":');
});

t('post não ganha estilo (só a peça do Laboratório)', () => {
  const r = raizComDuas(); escolher(r, 'aurora', 'cartilha');
  assert.strictEqual(registrar(r, 'post', { id: 'p1', date: '2026-10-16', platform: 'insta', title: 'Um post' }, { args: ['--empresa', 'aurora'] }).status, 0);
  assert.ok(!('estilo' in lerLista(G(r, 'aurora', 'cronograma', 'dados', 'posts.json'))[0]));
});

for (const r of pastas) fs.rmSync(r, { recursive: true, force: true });
if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
console.log('\ntodos os testes passaram');
