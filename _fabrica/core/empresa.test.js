#!/usr/bin/env node
// Testes do leitor de empresas. Rode: node _fabrica/core/empresa.test.js
// Cada caso monta uma pasta temporária e passa a raiz explícita; a linha de comando roda num processo filho com FABRICA_RAIZ.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// O ambiente de quem roda o teste não pode interferir nos casos.
delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;

const empresa = require('./empresa');
const SCRIPT = path.join(__dirname, 'empresa.js');

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

const pastaTemp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'empresa-'));
function escrever(r, rel, texto) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto, 'utf8');
}
// Hash de todos os arquivos da pasta, por caminho relativo.
function hashes(r, base = r, acc = {}) {
  for (const e of fs.readdirSync(r, { withFileTypes: true })) {
    const c = path.join(r, e.name);
    if (e.isDirectory()) hashes(c, base, acc);
    else acc[path.relative(base, c).split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(c)).digest('hex');
  }
  return acc;
}
function lancaCom(codigo, fn) {
  assert.throws(fn, (e) => { assert.strictEqual(e.code, codigo, `esperava ${codigo}, veio ${e.code}: ${e.message}`); return true; });
}
function cli(r, args, env = {}) {
  const base = { ...process.env, FABRICA_RAIZ: r };
  delete base.FABRICA_EMPRESA;
  const x = spawnSync(process.execPath, [SCRIPT, ...args], { env: { ...base, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}

const MARCA_CLINICA = 'empresa:\n  nome: "Clínica Teste"\n';
const PERFIL_CONFIGURADO = '# Perfil da empresa\n\n**Nome:** Clínica Teste\n';

t('pasta nova: nenhuma empresa', () => {
  const r = pastaTemp();
  assert.deepStrictEqual(empresa.listar(r), []);
  assert.strictEqual(empresa.ativa(r), null);
});

// Pasta antiga com dados de painel mas sem marca nem perfil: os dados contam como prova da empresa antiga.
for (const arq of ['04-LABORATORIO-DE-DESIGN/dados/laboratorio.json', '04-LABORATORIO-DE-DESIGN/dados/aprovacoes.json', '03-CRONOGRAMA/dados/posts.json']) {
  t(`dados de painel da pasta antiga (${arq}) mantêm a principal na lista depois de criar a segunda empresa`, () => {
    const r = pastaTemp();
    escrever(r, arq, arq.endsWith('aprovacoes.json') ? '{"x":{}}\n' : '[{"id":"x"}]\n');
    assert.deepStrictEqual(empresa.listar(r), [{ codigo: 'principal', nome: 'Sua empresa', disposicao: 'legado', virtual: true }]);
    assert.strictEqual(empresa.ativa(r), 'principal');
    const antes = hashes(r);
    empresa.criar('aurora', 'Aurora Nutrição', r);
    assert.deepStrictEqual(empresa.listar(r).map((e) => [e.codigo, e.disposicao]), [['principal', 'legado'], ['aurora', 'gaveta']]);
    const depois = hashes(r);
    for (const [a, h] of Object.entries(antes)) assert.strictEqual(depois[a], h, `${a} mudou`);
    assert.strictEqual(empresa.caminhos('principal', r).laboratorio, path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados'));
    fs.rmSync(r, { recursive: true, force: true });
  });
}

// Estado compartilhado pelos casos seguintes: uma pasta antiga (só legado) que vira duas empresas.
const rAntiga = pastaTemp();
escrever(rAntiga, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
escrever(rAntiga, '_fabrica/_memoria/empresa.md', PERFIL_CONFIGURADO);
escrever(rAntiga, 'linhas/reels/saida/video.txt', 'saída antiga');

t('legado virtual', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  assert.deepStrictEqual(empresa.listar(r), [{ codigo: 'principal', nome: 'Clínica Teste', disposicao: 'legado', virtual: true }]);
  assert.strictEqual(empresa.ativa(r), 'principal');
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false);
});

t('legado virtual pelo perfil configurado, sem marca: nome padrão', () => {
  const r = pastaTemp();
  escrever(r, '_fabrica/_memoria/empresa.md', PERFIL_CONFIGURADO);
  assert.deepStrictEqual(empresa.listar(r), [{ codigo: 'principal', nome: 'Sua empresa', disposicao: 'legado', virtual: true }]);
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false);
});

t('perfil não configurado não conta', () => {
  const r = pastaTemp();
  escrever(r, '_fabrica/_memoria/empresa.md', '<!-- NÃO CONFIGURADO -->\n\n# Perfil da empresa\n');
  assert.deepStrictEqual(empresa.listar(r), []);
  assert.strictEqual(empresa.ativa(r), null);
});

t('caminhos do legado', () => {
  const c = empresa.caminhos('principal', rAntiga);
  assert.strictEqual(c.marca, path.join(rAntiga, '06-MARCA-E-FOTOS', 'marca.yaml'));
  assert.strictEqual(c.perfil, path.join(rAntiga, '_fabrica', '_memoria', 'empresa.md'));
  assert.strictEqual(c.pastaMarca, path.join(rAntiga, '06-MARCA-E-FOTOS'));
  assert.strictEqual(c.estiloDeVideo, path.join(rAntiga, '06-MARCA-E-FOTOS', 'estilo-de-video.md'));
  assert.strictEqual(c.estilosProprios, path.join(rAntiga, '06-MARCA-E-FOTOS', 'estilos-proprios'));
  assert.strictEqual(c.referencias, path.join(rAntiga, '04-LABORATORIO-DE-DESIGN', 'referencias'));
  assert.strictEqual(c.laboratorio, path.join(rAntiga, '04-LABORATORIO-DE-DESIGN', 'dados'));
  assert.strictEqual(c.cronograma, path.join(rAntiga, '03-CRONOGRAMA', 'dados'));
  assert.strictEqual(c.publicacoes, path.join(rAntiga, '02-PUBLICACOES'));
  assert.strictEqual(c.saidas('reels'), path.join(rAntiga, 'linhas', 'reels', 'saida'));
  assert.strictEqual(c.memoria('reels'), path.join(rAntiga, 'linhas', 'reels', 'memoria'));
  assert.strictEqual(c.dadosLinha('reels'), path.join(rAntiga, 'linhas', 'reels', 'dados'));
  assert.strictEqual(c.estadoLinha('reels'), path.join(rAntiga, 'linhas', 'reels', 'estado.json'));
  assert.strictEqual(c.investigacoes('reels'), path.join(rAntiga, 'linhas', 'reels', '_investigacoes'));
  // no legado as linhas vêm de linhas/<linha>/: não há uma pasta só de saídas ou de memória
  assert.strictEqual(c.saidasRaiz, null);
  assert.strictEqual(c.memoriaRaiz, null);
  // comuns às duas disposições: sempre em empresas/principal
  const g = path.join(rAntiga, 'empresas', 'principal');
  assert.strictEqual(c.gaveta, g);
  assert.strictEqual(c.estilo, path.join(g, 'estilo.json'));
  assert.strictEqual(c.intencao, path.join(g, 'intencao.json'));
  assert.strictEqual(c.pedidos, path.join(g, 'pedidos'));
  assert.strictEqual(c.historico, path.join(g, 'historico'));
  assert.strictEqual(c.decisoes, path.join(g, 'decisoes.md'));
  assert.strictEqual(c.termos, path.join(g, 'termos.txt'));
  assert.strictEqual(c.termosCompartilhados, path.join(g, 'termos-compartilhados.txt'));
  assert.strictEqual(c.previas, path.join(g, 'previas'));
  assert.strictEqual(c.envios, path.join(g, 'envios'));
  assert.strictEqual(fs.existsSync(path.join(rAntiga, 'empresas')), false, 'caminhos só calcula, não cria pasta');
});

t('caminhos de empresa desconhecida recusa', () => {
  lancaCom('EMPRESA_DESCONHECIDA', () => empresa.caminhos('nao-existe', rAntiga));
});

t('criar gaveta preserva o legado', () => {
  const antes = hashes(rAntiga);
  const nova = empresa.criar('aurora', 'Aurora Nutrição', rAntiga);
  assert.deepStrictEqual(Object.keys(nova), ['codigo', 'nome', 'disposicao', 'criada']);
  assert.strictEqual(nova.codigo, 'aurora');
  assert.strictEqual(nova.nome, 'Aurora Nutrição');
  assert.strictEqual(nova.disposicao, 'gaveta');
  assert.match(nova.criada, /^\d{4}-\d{2}-\d{2}$/);

  const depois = hashes(rAntiga);
  for (const [arq, h] of Object.entries(antes)) assert.strictEqual(depois[arq], h, `${arq} mudou`);
  const novos = Object.keys(depois).filter((a) => !(a in antes));
  assert.deepStrictEqual(novos.sort(), ['empresas/aurora/midias/LEIA-ME.txt', 'empresas/indice.json']);
  assert.ok(fs.statSync(path.join(rAntiga, 'empresas', 'aurora')).isDirectory());

  const indice = JSON.parse(fs.readFileSync(path.join(rAntiga, 'empresas', 'indice.json'), 'utf8'));
  assert.strictEqual(indice.empresas.length, 2);
  const [principal, aurora] = indice.empresas;
  assert.strictEqual(principal.codigo, 'principal');
  assert.strictEqual(principal.nome, 'Clínica Teste');
  assert.strictEqual(principal.disposicao, 'legado');
  assert.ok(!('virtual' in principal));
  assert.deepStrictEqual(aurora, nova);
  assert.strictEqual(empresa.caminhos('aurora', rAntiga).marca, path.join(rAntiga, 'empresas', 'aurora', 'marca.yaml'));
  assert.strictEqual(empresa.caminhos('principal', rAntiga).marca, path.join(rAntiga, '06-MARCA-E-FOTOS', 'marca.yaml'));
});

t('caminhos da gaveta', () => {
  const g = path.join(rAntiga, 'empresas', 'aurora');
  const c = empresa.caminhos('aurora', rAntiga);
  assert.strictEqual(c.gaveta, g);
  assert.strictEqual(c.perfil, path.join(g, 'empresa.md'));
  assert.strictEqual(c.pastaMarca, g);
  assert.strictEqual(c.estiloDeVideo, path.join(g, 'estilo-de-video.md'));
  assert.strictEqual(c.estilosProprios, path.join(g, 'estilos-proprios'));
  assert.strictEqual(c.referencias, path.join(g, 'referencias'));
  assert.strictEqual(c.laboratorio, path.join(g, 'laboratorio', 'dados'));
  assert.strictEqual(c.cronograma, path.join(g, 'cronograma', 'dados'));
  assert.strictEqual(c.publicacoes, path.join(g, 'publicacoes'));
  assert.strictEqual(c.envios, path.join(g, 'envios'));
  assert.strictEqual(c.saidas('reels'), path.join(g, 'saidas', 'reels'));
  assert.strictEqual(c.memoria('reels'), path.join(g, 'memoria', 'reels'));
  assert.strictEqual(c.saidasRaiz, path.join(g, 'saidas'));
  assert.strictEqual(c.memoriaRaiz, path.join(g, 'memoria'));
  assert.strictEqual(c.dadosLinha('reels'), path.join(g, 'linhas', 'reels', 'dados'));
  assert.strictEqual(c.estadoLinha('reels'), path.join(g, 'estado', 'reels.json'));
  assert.strictEqual(c.investigacoes('reels'), path.join(g, 'investigacoes', 'reels'));
  assert.strictEqual(c.estilo, path.join(g, 'estilo.json'));
  assert.strictEqual(c.previas, path.join(g, 'previas'));
  assert.strictEqual(c.termosCompartilhados, path.join(g, 'termos-compartilhados.txt'));
});

t('nome de linha inválido recusa nas duas disposições', () => {
  for (const codigo of ['principal', 'aurora']) {
    const c = empresa.caminhos(codigo, rAntiga);
    for (const fn of ['saidas', 'memoria', 'dadosLinha', 'estadoLinha', 'investigacoes']) {
      for (const linha of ['../../../fora', '..', '', 'Reels', '_modelo', '-x', 'a/b', 'a\\b', 'reels/../..', undefined, 5]) {
        lancaCom('LINHA_INVALIDA', () => c[fn](linha));
      }
      for (const linha of ['reels', 'carrossel_2', 'post-unico', '3d']) assert.strictEqual(typeof c[fn](linha), 'string');
    }
  }
});

t('duas empresas sem escolha recusa', () => {
  lancaCom('EMPRESA_NAO_ESCOLHIDA', () => empresa.ativa(rAntiga));
});

t('ativar e ativa', () => {
  empresa.ativar('aurora', rAntiga);
  assert.strictEqual(empresa.ativa(rAntiga), 'aurora');
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(path.join(rAntiga, 'empresas', 'ativa.json'), 'utf8')), { empresa: 'aurora' });
  // FABRICA_EMPRESA vence o ativa.json
  const x = cli(rAntiga, ['ativa'], { FABRICA_EMPRESA: 'principal' });
  assert.strictEqual(x.status, 0, x.erro);
  assert.strictEqual(x.saida.trim(), 'principal');
  assert.strictEqual(cli(rAntiga, ['ativa']).saida.trim(), 'aurora');
  lancaCom('EMPRESA_DESCONHECIDA', () => empresa.ativar('nao-existe', rAntiga));
});

t('ativa desconhecida recusa', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora Nutrição', r);
  escrever(r, 'empresas/ativa.json', '{ "empresa": "apagada" }');
  lancaCom('EMPRESA_DESCONHECIDA', () => empresa.ativa(r));
  // com ativa.json certo a empresa é a escolhida; o FABRICA_EMPRESA errado recusa, em vez de cair em outra
  escrever(r, 'empresas/ativa.json', '{ "empresa": "aurora" }');
  assert.strictEqual(empresa.ativa(r), 'aurora');
  process.env.FABRICA_EMPRESA = 'xyz';
  try { lancaCom('EMPRESA_DESCONHECIDA', () => empresa.ativa(r)); } finally { delete process.env.FABRICA_EMPRESA; }
  const x = cli(r, ['ativa'], { FABRICA_EMPRESA: 'xyz' });
  assert.strictEqual(x.status, 1);
  assert.match(x.erro, /xyz/);
});

t('a única empresa é a ativa', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora Nutrição', r);
  assert.strictEqual(empresa.ativa(r), 'aurora');
});

t('código inválido sugere', () => {
  const r = pastaTemp();
  assert.throws(() => empresa.criar('Clínica Bela Vista', 'x', r), (e) => {
    assert.strictEqual(e.code, 'CODIGO_INVALIDO');
    assert.ok(e.message.includes('clinica-bela-vista'), e.message);
    return true;
  });
  lancaCom('CODIGO_INVALIDO', () => empresa.criar('a', 'x', r));
  lancaCom('CODIGO_INVALIDO', () => empresa.criar('-abc', 'x', r));
  lancaCom('CODIGO_INVALIDO', () => empresa.criar('../fora', 'x', r));
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false, 'recusa não grava nada');
});

t('nome vazio recusa', () => {
  const r = pastaTemp();
  lancaCom('NOME_INVALIDO', () => empresa.criar('aurora', '   ', r));
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false);
});

t('código repetido recusa', () => {
  const antes = hashes(rAntiga);
  lancaCom('EMPRESA_EXISTE', () => empresa.criar('aurora', 'Outra', rAntiga));
  lancaCom('EMPRESA_EXISTE', () => empresa.criar('principal', 'Outra', rAntiga));
  assert.deepStrictEqual(hashes(rAntiga), antes);
  // "principal" é reservado mesmo numa pasta sem legado
  lancaCom('EMPRESA_EXISTE', () => empresa.criar('principal', 'Outra', pastaTemp()));
});

t('pasta já existente fora do índice não é sobrescrita', () => {
  const r = pastaTemp();
  escrever(r, 'empresas/orfa/marca.yaml', 'empresa:\n  nome: "Órfã"\n');
  const antes = hashes(r);
  lancaCom('EMPRESA_EXISTE', () => empresa.criar('orfa', 'Órfã', r));
  assert.deepStrictEqual(hashes(r), antes);
});

t('JSON quebrado não é regravado', () => {
  const r = pastaTemp();
  escrever(r, 'empresas/indice.json', '{"empresas": [');
  const antes = hashes(r);
  assert.throws(() => empresa.listar(r), (e) => {
    assert.strictEqual(e.code, 'JSON_INVALIDO');
    assert.ok(e.message.includes('indice.json'), e.message);
    return true;
  });
  lancaCom('JSON_INVALIDO', () => empresa.criar('aurora', 'Aurora Nutrição', r));
  lancaCom('JSON_INVALIDO', () => empresa.ativar('aurora', r));
  assert.deepStrictEqual(hashes(r), antes);
  assert.strictEqual(fs.readFileSync(path.join(r, 'empresas', 'indice.json'), 'utf8'), '{"empresas": [');
});

t('índice com forma ou entrada inválida recusa, cita a entrada e não é regravado', () => {
  const principal = { codigo: 'principal', nome: 'Clínica Teste', disposicao: 'legado' };
  const aurora = { codigo: 'aurora', nome: 'Aurora Nutrição', disposicao: 'gaveta' };
  const casos = [
    ['null', 'null', null],
    ['lista solta', '[]', null],
    ['texto', '"aurora"', null],
    ['empresas não é lista', '{ "empresas": {} }', null],
    ['entrada null', JSON.stringify({ empresas: [principal, null] }), 'null'],
    ['entrada texto', JSON.stringify({ empresas: ['aurora'] }), '"aurora"'],
    ['sem código', JSON.stringify({ empresas: [{ nome: 'Aurora Nutrição', disposicao: 'gaveta' }] }), 'Aurora Nutrição'],
    ['código que sai da pasta', JSON.stringify({ empresas: [principal, { ...aurora, codigo: '../06-MARCA-E-FOTOS' }] }), '../06-MARCA-E-FOTOS'],
    ['sem disposição', JSON.stringify({ empresas: [principal, { codigo: 'aurora', nome: 'Aurora Nutrição' }] }), 'aurora'],
    ['disposição desconhecida', JSON.stringify({ empresas: [{ ...aurora, disposicao: 'gavetao' }] }), 'gavetao'],
    ['legado fora da principal', JSON.stringify({ empresas: [{ ...aurora, disposicao: 'legado' }] }), 'aurora'],
    ['nome que não é texto', JSON.stringify({ empresas: [{ ...aurora, nome: 5 }] }), 'aurora'],
    ['código repetido', JSON.stringify({ empresas: [aurora, { ...aurora, nome: 'Outra' }] }), 'aurora'],
  ];
  for (const [nome, texto, citado] of casos) {
    const r = pastaTemp();
    escrever(r, 'empresas/indice.json', texto);
    escrever(r, 'empresas/ativa.json', '{ "empresa": "aurora" }');
    const antes = hashes(r);
    assert.throws(() => empresa.listar(r), (e) => {
      assert.strictEqual(e.code, 'JSON_INVALIDO', `${nome}: esperava JSON_INVALIDO, veio ${e.code}: ${e.message}`);
      assert.ok(e.message.includes('indice.json'), `${nome}: ${e.message}`);
      if (citado) assert.ok(e.message.includes(citado), `${nome}: a mensagem devia citar a entrada (${citado}): ${e.message}`);
      return true;
    }, nome);
    for (const fn of [() => empresa.ativa(r), () => empresa.caminhos('aurora', r), () => empresa.criar('nova', 'Nova', r), () => empresa.ativar('aurora', r)]) {
      lancaCom('JSON_INVALIDO', fn);
    }
    assert.deepStrictEqual(hashes(r), antes, `${nome}: algum arquivo mudou`);
    assert.strictEqual(fs.existsSync(path.join(r, 'empresas', 'nova')), false, `${nome}: criar não devia criar a pasta`);
  }
});

t('ativa.json quebrado recusa e não é regravado', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora Nutrição', r);
  empresa.criar('bela-vista', 'Clínica Bela Vista', r);
  escrever(r, 'empresas/ativa.json', '{ "empresa": ');
  const antes = hashes(r);
  assert.throws(() => empresa.ativa(r), (e) => {
    assert.strictEqual(e.code, 'JSON_INVALIDO');
    assert.ok(e.message.includes('ativa.json'), e.message);
    return true;
  });
  lancaCom('JSON_INVALIDO', () => empresa.ativar('aurora', r));
  assert.deepStrictEqual(hashes(r), antes);
});

t('termos', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora Nutrição', r);
  escrever(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "Aurora Nutrição"\n  handle: "@aurora.nutri"\n');
  escrever(r, 'empresas/aurora/empresa.md', '# Perfil da empresa\n\n**Nome:** Aurora Nutrição\n**Site:** https://www.aurora-nutri.com.br/\n**Setor:**\n');
  escrever(r, 'empresas/aurora/termos.txt', '// comentário\n\nDra. Aurora\nDra. Aurora\n');
  assert.deepStrictEqual(empresa.termos('aurora', r), ['Aurora Nutrição', 'aurora.nutri', 'aurora-nutri.com.br', 'Dra. Aurora']);
});

t('termos sem nenhum arquivo: só o nome do índice', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora Nutrição', r);
  assert.deepStrictEqual(empresa.termos('aurora', r), ['Aurora Nutrição']);
});

t('termos: o nome do índice vem antes e soma com o da marca; "Sua empresa" não é termo', () => {
  const r = pastaTemp();
  escrever(r, 'empresas/indice.json', JSON.stringify({ empresas: [
    { codigo: 'principal', nome: 'Sua empresa', disposicao: 'legado' },
    { codigo: 'aurora', nome: 'Aurora Nutrição', disposicao: 'gaveta' },
  ] }));
  escrever(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "Aurora Nutri"\n');
  assert.deepStrictEqual(empresa.termos('aurora', r), ['Aurora Nutrição', 'Aurora Nutri']);
  assert.deepStrictEqual(empresa.termos('principal', r), []);
});

t('CLI', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  const lista = cli(r, ['listar']);
  assert.strictEqual(lista.status, 0, lista.erro);
  assert.match(lista.saida, /principal/);
  assert.match(lista.saida, /Clínica Teste/);
  const ruim = cli(r, ['criar', 'Ruim', 'x']);
  assert.strictEqual(ruim.status, 1);
  assert.match(ruim.erro, /ruim/);
  assert.strictEqual(cli(r, ['comando-que-nao-existe']).status, 2);
  assert.strictEqual(cli(r, []).status, 2);
  assert.strictEqual(cli(r, ['criar', 'aurora']).status, 2, 'faltou o nome');
  const ok = cli(r, ['criar', 'aurora', 'Aurora Nutrição']);
  assert.strictEqual(ok.status, 0, ok.erro);
  assert.strictEqual(cli(r, ['criar', 'aurora', 'Aurora Nutrição']).status, 1);
  assert.strictEqual(cli(r, ['ativa']).status, 1, 'duas empresas sem escolha');
  assert.strictEqual(cli(r, ['ativar', 'aurora']).status, 0);
  assert.strictEqual(cli(r, ['ativar', 'nao-existe']).status, 1);
  assert.strictEqual(cli(r, ['ativa']).saida.trim(), 'aurora');
  const cam = cli(r, ['caminhos']);
  assert.strictEqual(cam.status, 0, cam.erro);
  assert.ok(cam.saida.includes(path.join(r, 'empresas', 'aurora', 'marca.yaml')));
  assert.ok(cam.saida.includes(path.join(r, 'empresas', 'aurora', 'saidas', '<linha>')), cam.saida);
  assert.strictEqual(cli(r, ['caminhos', 'principal']).status, 0);
  assert.strictEqual(cli(r, ['caminhos', 'nao-existe']).status, 1);
});

t('CLI: ativa sem empresa sai 1; erro inesperado sai 2 com mensagem curta, sem pilha', () => {
  const vazia = cli(pastaTemp(), ['ativa']);
  assert.strictEqual(vazia.status, 1, vazia.saida + vazia.erro);
  assert.match(vazia.erro, /Nenhuma empresa nesta pasta ainda/);
  const r = pastaTemp();
  fs.mkdirSync(path.join(r, 'empresas', 'indice.json'), { recursive: true }); // uma pasta no lugar do arquivo
  const x = cli(r, ['listar']);
  assert.strictEqual(x.status, 2, x.saida + x.erro);
  assert.match(x.erro, /^ERRO/);
  assert.ok(!/\n\s+at /.test(x.erro), 'saiu a pilha do erro:\n' + x.erro);
});

// ---------- caminhos [<codigo>] [--linha <l>] [--json] ----------
const valorDe = (saida, chave) => {
  const linha = saida.split('\n').find((x) => x.startsWith(chave + ': '));
  assert.ok(linha, `faltou a chave ${chave} na saída:\n${saida}`);
  return linha.slice(chave.length + 2).trim();
};

t('caminhos --linha na pasta antiga: a linha entra no lugar de <linha>', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  const x = cli(r, ['caminhos', '--linha', 'reels']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.strictEqual(valorDe(x.saida, 'saidas'), path.join(r, 'linhas', 'reels', 'saida'));
  assert.strictEqual(valorDe(x.saida, 'memoria'), path.join(r, 'linhas', 'reels', 'memoria'));
  assert.strictEqual(valorDe(x.saida, 'dadosLinha'), path.join(r, 'linhas', 'reels', 'dados'));
  assert.strictEqual(valorDe(x.saida, 'estadoLinha'), path.join(r, 'linhas', 'reels', 'estado.json'));
  assert.strictEqual(valorDe(x.saida, 'investigacoes'), path.join(r, 'linhas', 'reels', '_investigacoes'));
  assert.ok(!x.saida.includes('<linha>'), 'sobrou <linha>:\n' + x.saida);
  // Sem a opção, a saída de sempre: continua com <linha>.
  assert.ok(cli(r, ['caminhos']).saida.includes('<linha>'));
});

t('caminhos --linha na empresa com pasta própria', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  empresa.criar('aurora', 'Aurora Nutrição', r);
  empresa.ativar('aurora', r);
  const x = cli(r, ['caminhos', '--linha', 'reels']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.strictEqual(valorDe(x.saida, 'saidas'), path.join(r, 'empresas', 'aurora', 'saidas', 'reels'));
  assert.strictEqual(valorDe(x.saida, 'estadoLinha'), path.join(r, 'empresas', 'aurora', 'estado', 'reels.json'));
  assert.ok(!x.saida.includes('<linha>'), x.saida);
  // O código antes ou depois da opção dá o mesmo resultado.
  assert.strictEqual(cli(r, ['caminhos', 'aurora', '--linha', 'reels']).saida, x.saida);
  assert.strictEqual(cli(r, ['caminhos', '--linha', 'reels', 'aurora']).saida, x.saida);
  // Código de outra empresa (a antiga, registrada junto): não usa a ativa.
  const outra = cli(r, ['caminhos', 'principal', '--linha', 'reels']);
  assert.strictEqual(valorDe(outra.saida, 'saidas'), path.join(r, 'linhas', 'reels', 'saida'));
});

t('caminhos --json: um objeto só, com codigo, nome e os caminhos', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  empresa.criar('aurora', 'Aurora Nutrição', r);
  empresa.ativar('aurora', r);
  const x = cli(r, ['caminhos', '--json']);
  assert.strictEqual(x.status, 0, x.erro);
  const j = JSON.parse(x.saida);
  assert.strictEqual(j.codigo, 'aurora');
  assert.strictEqual(j.nome, 'Aurora Nutrição');
  assert.strictEqual(j.marca, path.join(r, 'empresas', 'aurora', 'marca.yaml'));
  assert.strictEqual(j.saidas, path.join(r, 'empresas', 'aurora', 'saidas', '<linha>'));
  const l = JSON.parse(cli(r, ['caminhos', '--linha', 'reels', '--json']).saida);
  assert.strictEqual(l.saidas, path.join(r, 'empresas', 'aurora', 'saidas', 'reels'));
  assert.strictEqual(l.investigacoes, path.join(r, 'empresas', 'aurora', 'investigacoes', 'reels'));
  assert.strictEqual(l.codigo, 'aurora');
  // Na pasta antiga, o que não existe sai como null.
  const p = JSON.parse(cli(r, ['caminhos', 'principal', '--json']).saida);
  assert.strictEqual(p.codigo, 'principal');
  assert.strictEqual(p.saidasRaiz, null);
});

t('caminhos sem escolha: duas empresas e nenhuma ativa recusa com saída 1', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora', r);
  empresa.criar('boreal', 'Boreal', r);
  for (const args of [['caminhos'], ['caminhos', '--linha', 'reels'], ['caminhos', '--json']]) {
    const x = cli(r, args);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + x.saida + x.erro);
    assert.match(x.erro, /nenhuma foi escolhida/);
    assert.match(x.erro, /aurora, boreal/);
  }
  // Com o código na mão não precisa de escolha.
  assert.strictEqual(cli(r, ['caminhos', 'aurora', '--linha', 'reels']).status, 0);
});

t('caminhos --linha inválida: sai 1 com LINHA_INVALIDA; uso errado sai 2', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora', r);
  empresa.ativar('aurora', r);
  for (const ruim of ['../x', 'A', 'a/b', '', '..']) {
    const x = cli(r, ['caminhos', '--linha', ruim]);
    assert.strictEqual(x.status, 1, JSON.stringify(ruim) + ': ' + x.saida + x.erro);
    assert.match(x.erro, /nome de linha/);
  }
  assert.strictEqual(cli(r, ['caminhos', '--linha']).status, 2, 'faltou o nome da linha');
  assert.strictEqual(cli(r, ['caminhos', '--linha', 'reels', '--linha', 'outra']).status, 2, 'linha repetida');
  assert.strictEqual(cli(r, ['caminhos', '--naoexiste']).status, 2, 'opção desconhecida');
  assert.strictEqual(cli(r, ['caminhos', 'aurora', 'boreal']).status, 2, 'dois códigos');
});

t('caminhos --linha seguido de outra opção é erro de uso (saída 2), não nome de linha', () => {
  const r = pastaTemp();
  empresa.criar('aurora', 'Aurora', r);
  empresa.ativar('aurora', r);
  for (const args of [['caminhos', '--linha', '--json'], ['caminhos', '--linha', '--qualquer', 'reels'], ['caminhos', 'aurora', '--linha', '--']]) {
    const x = cli(r, args);
    assert.strictEqual(x.status, 2, args.join(' ') + ': ' + x.saida + x.erro);
    assert.match(x.erro, /Faltou o nome da linha depois de --linha/);
  }
});

// ---------- caminhosDe: os caminhos das duas disposições (base da mudança da pasta antiga) ----------
// Aplica as funções por linha a 'reels', para comparar os dois objetos por valor.
const comLinha = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'function' ? ['funcao', v('reels')] : v]));

t('caminhosDe legado e gaveta', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA); // legado virtual, sem índice
  const legado = empresa.caminhosDe('principal', 'legado', r);
  const gaveta = empresa.caminhosDe('principal', 'gaveta', r);
  assert.strictEqual(legado.marca, path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'));
  assert.strictEqual(gaveta.marca, path.join(r, 'empresas', 'principal', 'marca.yaml'));
  assert.strictEqual(legado.saidas('reels'), path.join(r, 'linhas', 'reels', 'saida'));
  assert.strictEqual(gaveta.saidas('reels'), path.join(r, 'empresas', 'principal', 'saidas', 'reels'));
  // os comuns são os mesmos nas duas
  assert.strictEqual(legado.pedidos, gaveta.pedidos);
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false, 'caminhosDe só calcula, não cria pasta');
  // não olha o índice: a disposição pedida vale mesmo com o índice dizendo outra
  empresa.criar('aurora', 'Aurora Nutrição', r);
  assert.strictEqual(empresa.caminhosDe('principal', 'gaveta', r).marca, path.join(r, 'empresas', 'principal', 'marca.yaml'));
  assert.strictEqual(empresa.caminhos('principal', r).marca, path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'));
});

t('caminhos não muda', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  empresa.criar('aurora', 'Aurora Nutrição', r);
  for (const [codigo, disposicao] of [['principal', 'legado'], ['aurora', 'gaveta']]) {
    assert.strictEqual(empresa.listar(r).find((e) => e.codigo === codigo).disposicao, disposicao);
    assert.deepStrictEqual(comLinha(empresa.caminhos(codigo, r)), comLinha(empresa.caminhosDe(codigo, disposicao, r)), codigo);
  }
  // legado virtual (sem índice) também
  const v = pastaTemp();
  escrever(v, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  assert.deepStrictEqual(comLinha(empresa.caminhos('principal', v)), comLinha(empresa.caminhosDe('principal', 'legado', v)));
});

t('disposição inválida', () => {
  const r = pastaTemp();
  for (const ruim of ['outra', '', undefined, null, 'Gaveta', 5]) lancaCom('DISPOSICAO_INVALIDA', () => empresa.caminhosDe('principal', ruim, r));
  // só a "principal" pode ter a disposição da pasta antiga (a mesma regra do índice)
  lancaCom('DISPOSICAO_INVALIDA', () => empresa.caminhosDe('aurora', 'legado', r));
  // código que sairia da pasta nunca vira caminho
  for (const ruim of ['../fora', '..', '', 'A', undefined]) lancaCom('CODIGO_INVALIDO', () => empresa.caminhosDe(ruim, 'gaveta', r));
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false);
});

t('chaves exportadas', () => {
  const r = pastaTemp();
  escrever(r, '06-MARCA-E-FOTOS/marca.yaml', MARCA_CLINICA);
  assert.ok(Array.isArray(empresa.CHAVES_DE_CAMINHO), 'CHAVES_DE_CAMINHO devia ser uma lista');
  assert.ok(Object.isFrozen(empresa.CHAVES_DE_CAMINHO), 'a lista não pode ser alterada por quem a usa');
  const ordenar = (l) => [...l].sort();
  assert.deepStrictEqual(ordenar(empresa.CHAVES_DE_CAMINHO), ordenar(Object.keys(empresa.caminhos('principal', r))));
  // as duas disposições têm exatamente as mesmas chaves
  assert.deepStrictEqual(ordenar(Object.keys(empresa.caminhosDe('principal', 'gaveta', r))), ordenar(empresa.CHAVES_DE_CAMINHO));
  assert.deepStrictEqual(ordenar(Object.keys(empresa.caminhosDe('principal', 'legado', r))), ordenar(empresa.CHAVES_DE_CAMINHO));
});

t('campo migrada preservado', () => {
  const r = pastaTemp();
  const migrada = { em: '2026-11-05', carimbo: '20261105-101500' };
  escrever(r, 'empresas/indice.json', JSON.stringify({ empresas: [{ codigo: 'principal', nome: 'Aurora Nutrição', disposicao: 'gaveta', migrada }] }));
  assert.deepStrictEqual(empresa.listar(r)[0].migrada, migrada);
  assert.strictEqual(empresa.caminhos('principal', r).marca, path.join(r, 'empresas', 'principal', 'marca.yaml'));
  empresa.criar('boreal', 'Boreal Advocacia', r);
  const indice = JSON.parse(fs.readFileSync(path.join(r, 'empresas', 'indice.json'), 'utf8'));
  assert.deepStrictEqual(indice.empresas.map((e) => e.codigo), ['principal', 'boreal']);
  assert.deepStrictEqual(indice.empresas[0].migrada, migrada);
  assert.strictEqual(indice.empresas[0].disposicao, 'gaveta');
});

t('atalho migrar', () => {
  const r = pastaTemp();
  // o atalho aparece no uso do empresa.js
  assert.ok(cli(r, []).erro.includes('empresa.js migrar'), 'o uso devia citar o atalho migrar');
  const x = cli(r, ['migrar']);
  assert.strictEqual(x.status, 2, x.saida + x.erro);
  if (!fs.existsSync(path.join(__dirname, 'migrar.js'))) {
    // Até o migrar.js existir (Tarefa 3 da etapa 9), o atalho chega ao require e para com erro (saída 2).
    assert.match(x.erro, /Cannot find module '\.\/migrar'/, x.erro);
    console.log('     (atalho migrar: o migrar.js ainda não existe; o caso completo passa a valer quando ele chegar)');
    return;
  }
  // Com o migrar.js: o uso dele, sem erro de módulo
  assert.ok(!/Cannot find module/.test(x.erro), x.erro);
  assert.match(x.erro, /migrar\.js/, 'devia mostrar o uso do migrar.js:\n' + x.erro);
  assert.strictEqual(fs.existsSync(path.join(r, 'empresas')), false, 'o atalho sem argumentos não grava nada');
});

t('criar empresa já deixa as pastas de mídia; "midias" completa empresa antiga sem apagar nada', () => {
  const r = pastaTemp();
  empresa.criar('bela', 'Bela', r);
  const m = path.join(r, 'empresas', 'bela', 'midias');
  for (const p of ['videos', 'fotos', 'audios', 'documentos']) {
    assert.ok(fs.statSync(path.join(m, p)).isDirectory(), `devia existir midias/${p}`);
  }
  assert.ok(fs.existsSync(path.join(m, 'LEIA-ME.txt')));
  // Empresa antiga: sem a pasta; o comando cria e preserva o que a pessoa já tinha colocado.
  fs.rmSync(m, { recursive: true });
  escrever(r, 'empresas/bela/midias/videos/meu.mp4', 'x');
  const x = spawnSync(process.execPath, [SCRIPT, 'midias', 'bela', '--json'], { env: { ...process.env, FABRICA_RAIZ: r }, encoding: 'utf8' });
  assert.strictEqual(x.status, 0, x.stderr);
  assert.strictEqual(JSON.parse(x.stdout).videos, path.join(m, 'videos'));
  assert.strictEqual(fs.readFileSync(path.join(m, 'videos', 'meu.mp4'), 'utf8'), 'x');
  assert.ok(fs.existsSync(path.join(m, 'documentos')));
});

console.log(`\n${n} testes passaram`);
