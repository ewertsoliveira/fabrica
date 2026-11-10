#!/usr/bin/env node
// Testes de escolha.js: o estilo escolhido pela empresa (estilo.json), com cópia da versão anterior no histórico e
// desfazer, pelo painel (funções) e pelo agente (linha de comando). Rode: node _fabrica/core/escolha.test.js
// Cada caso monta uma pasta temporária com um catálogo de mentira e as empresas fictícias aurora e boreal.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_RAIZ;

const escolha = require('./escolha');
const empresaMod = require('./empresa');
const SCRIPT = path.join(__dirname, 'escolha.js');
const LAB = '04-LABORATORIO-DE-DESIGN';

let falhas = 0;
let contador = 0;
const pastas = [];
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function novaRaiz() {
  const r = path.resolve(path.join(os.tmpdir(), `Fábrica de Teste (EMPRESA)-esc-${process.pid}-${++contador}`));
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
}
const ler = (r, rel) => fs.readFileSync(path.join(r, ...rel.split('/')));
const existe = (r, rel) => fs.existsSync(path.join(r, ...rel.split('/')));
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
const historico = (r, c) => (existe(r, `empresas/${c}/historico`) ? fs.readdirSync(path.join(r, 'empresas', c, 'historico')).sort() : []);
const hora = (s) => new Date(`2026-11-05T12:00:${String(s).padStart(2, '0')}.000Z`);

function raizDuas() {
  const r = novaRaiz();
  esc(r, `${LAB}/estilos/bloco/estilo.yaml`, 'id: bloco\nnome: Bloco\n');
  esc(r, `${LAB}/estilos/adesivo/estilo.yaml`, 'id: adesivo\nnome: Adesivo\n');
  esc(r, `${LAB}/estilos/_demo/fotos/a.txt`, 'não é estilo');
  esc(r, `${LAB}/estilos/catalogo.html`, '<html></html>');
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Estúdio', r);
  esc(r, 'empresas/aurora/marca.yaml', 'empresa:\n  nome: "Aurora Nutrição"\n');
  esc(r, 'empresas/aurora/estilos-proprios/aurora-jornal/estilo.yaml', 'id: aurora-jornal\nnome: Jornal da Aurora\norigem: referencias\n');
  esc(r, 'empresas/boreal/estilos-proprios/boreal-neve/estilo.yaml', 'id: boreal-neve\nnome: Neve\norigem: referencias\n');
  return r;
}
const naoAurora = (rel) => rel === 'empresas/aurora/estilo.json' || rel.startsWith('empresas/aurora/historico');

// ---------- usar ----------

t('usar: grava estilo.json só na empresa pedida, no formato combinado, sem cor nem letra', () => {
  const r = raizDuas();
  const antes = fotografia(r, naoAurora);
  const res = escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) });
  assert.deepStrictEqual(res, { estilo: 'bloco', anterior: null });
  const j = JSON.parse(ler(r, 'empresas/aurora/estilo.json'));
  assert.deepStrictEqual(j, { versao: 1, estilo: 'bloco', origem: 'catalogo', escolhido: '2026-11-05T12:00:01.000Z', personalizacoes: {}, historico: [] });
  assert.deepStrictEqual(fotografia(r, naoAurora), antes, 'nada fora do estilo.json e do histórico de aurora mudou (nem a marca, nem boreal)');
  assert.deepStrictEqual(escolha.ler(r, 'aurora'), { estilo: 'bloco', origem: 'catalogo', nome: 'Bloco', escolhido: '2026-11-05T12:00:01.000Z', personalizacoes: {} });
  assert.strictEqual(escolha.ler(r, 'boreal'), null, 'a outra empresa continua sem estilo');
});

t('usar: estilo inexistente, com ../, próprio de outra empresa e origem desconhecida são recusados sem gravar', () => {
  const r = raizDuas();
  const antes = fotografia(r);
  const recusado = (codigo, id, opcoes, motivo) => assert.throws(() => escolha.usar(r, codigo, id, opcoes),
    (e) => e.recusaDoPedido === true && e.status === 400 && e.message.length > 10, motivo);
  recusado('aurora', 'nao-existe', {}, 'estilo inexistente');
  recusado('aurora', '../bloco', {}, 'estilo com ../');
  recusado('aurora', '..', {}, 'estilo ..');
  recusado('aurora', '../../empresas/boreal/estilos-proprios/boreal-neve', { origem: 'proprio' }, 'caminho para o estilo da outra');
  recusado('aurora', '_demo', {}, 'pasta sem estilo.yaml');
  recusado('aurora', 'catalogo.html', {}, 'arquivo solto');
  recusado('aurora', '__proto__', {}, '__proto__');
  recusado('aurora', '', {}, 'vazio');
  recusado('aurora', 42, {}, 'número');
  recusado('aurora', 'boreal-neve', { origem: 'proprio' }, 'estilo próprio de outra empresa');
  recusado('aurora', 'boreal-neve', {}, 'estilo próprio de outra empresa como se fosse do catálogo');
  recusado('aurora', 'aurora-jornal', {}, 'estilo próprio com origem de catálogo');
  recusado('aurora', 'bloco', { origem: 'proprio' }, 'estilo do catálogo com origem de próprio');
  recusado('aurora', 'bloco', { origem: 'internet' }, 'origem desconhecida');
  recusado('aurora', 'bloco', { origem: 42 }, 'origem que não é texto');
  for (const ruim of ['', '../x', 'nao-existe', undefined, null]) recusado(ruim, 'bloco', {}, 'empresa ' + ruim);
  assert.deepStrictEqual(fotografia(r), antes, 'nada foi gravado, em lugar nenhum');
});

t('usar: estilo próprio com a mesma regra do molde (sonda atual.js): atalho, código fora da regra e origem errada são recusados', () => {
  const r = raizDuas();
  const ca = empresaMod.caminhos('aurora', r);
  const cb = empresaMod.caminhos('boreal', r);
  esc(cb.estilosProprios, 'boreal-segredo/estilo.yaml', 'id: boreal-segredo\nnome: Segredo da Boreal\norigem: referencias\n');
  fs.symlinkSync(path.join(cb.estilosProprios, 'boreal-segredo'), path.join(ca.estilosProprios, 'boreal-segredo'), 'junction');
  esc(ca.estilosProprios, 'Aurora.Velho/estilo.yaml', 'id: Aurora.Velho\nnome: Velho\norigem: referencias\n');
  esc(ca.estilosProprios, 'aurora_x/estilo.yaml', 'id: aurora_x\nnome: X\norigem: referencias\n');
  esc(ca.estilosProprios, 'aurora-sem-origem/estilo.yaml', 'id: aurora-sem-origem\nnome: Sem origem\n');
  esc(ca.estilosProprios, 'aurora-catalogo/estilo.yaml', 'id: aurora-catalogo\nnome: Catálogo\norigem: catalogo\n');
  esc(ca.estilosProprios, 'aurora-lista/estilo.yaml', '- uma lista\n');
  const semAtalho = (rel) => rel === 'empresas/aurora/estilos-proprios/boreal-segredo'; // o atalho em si (a boreal entra pela pasta dela)
  const antes = fotografia(r, semAtalho);
  for (const id of ['boreal-segredo', 'Aurora.Velho', 'aurora_x', 'aurora-sem-origem', 'aurora-catalogo', 'aurora-lista']) {
    assert.throws(() => escolha.usar(r, 'aurora', id, { origem: 'proprio' }), (e) => e.recusaDoPedido === true && /não está entre os estilos desta empresa/.test(e.message), id);
  }
  assert.deepStrictEqual(fotografia(r, semAtalho), antes, 'nada foi gravado');
  // a pasta inteira de estilos próprios como atalho para a da boreal: nenhum estilo dela vale
  const r2 = raizDuas();
  const ca2 = empresaMod.caminhos('aurora', r2);
  fs.rmSync(ca2.estilosProprios, { recursive: true, force: true });
  fs.symlinkSync(empresaMod.caminhos('boreal', r2).estilosProprios, ca2.estilosProprios, 'junction');
  assert.throws(() => escolha.usar(r2, 'aurora', 'boreal-neve', { origem: 'proprio' }), /não está entre os estilos desta empresa/);
  // um estilo.json que já aponta para o atalho (feito à mão): o nome da boreal não sai pelo ler
  esc(r, 'empresas/aurora/estilo.json', JSON.stringify({ versao: 1, estilo: 'boreal-segredo', origem: 'proprio', escolhido: '2026-11-05T12:00:00.000Z', personalizacoes: {}, historico: [] }));
  assert.strictEqual(escolha.ler(r, 'aurora').nome, 'boreal-segredo');
});
t('usar: estilo próprio da própria empresa vale com origem "proprio"', () => {
  const r = raizDuas();
  escolha.usar(r, 'aurora', 'aurora-jornal', { origem: 'proprio', agora: hora(1) });
  const l = escolha.ler(r, 'aurora');
  assert.deepStrictEqual([l.estilo, l.origem, l.nome], ['aurora-jornal', 'proprio', 'Jornal da Aurora']);
});

t('usar: a segunda escolha guarda a primeira no histórico, byte a byte, e registra a troca', () => {
  const r = raizDuas();
  escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) });
  const primeiro = ler(r, 'empresas/aurora/estilo.json');
  const res = escolha.usar(r, 'aurora', 'adesivo', { agora: hora(2) });
  assert.deepStrictEqual(res, { estilo: 'adesivo', anterior: 'bloco' });
  const hist = historico(r, 'aurora');
  assert.deepStrictEqual(hist, ['estilo-2026-11-05-120001Z-vazio.json', 'estilo-2026-11-05-120002Z.json']);
  assert.ok(ler(r, 'empresas/aurora/historico/estilo-2026-11-05-120002Z.json').equals(primeiro), 'a cópia é a primeira escolha, byte a byte');
  const j = JSON.parse(ler(r, 'empresas/aurora/estilo.json'));
  assert.deepStrictEqual(j.historico, [{ estilo: 'bloco', origem: 'catalogo', de: '2026-11-05T12:00:01.000Z', ate: '2026-11-05T12:00:02.000Z' }]);
  assert.strictEqual(historico(r, 'boreal').length, 0);
});

t('usar: duas gravações no mesmo segundo não se sobrescrevem no histórico', () => {
  const r = raizDuas();
  escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) });
  escolha.usar(r, 'aurora', 'adesivo', { agora: hora(1) });
  escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) });
  assert.deepStrictEqual(historico(r, 'aurora'), ['estilo-2026-11-05-120001Z-2.json', 'estilo-2026-11-05-120001Z-3.json', 'estilo-2026-11-05-120001Z-vazio.json']);
});

// ---------- desfazer ----------

t('desfazer: volta byte a byte, um passo de cada vez, até não haver estilo; depois, nada para desfazer', () => {
  const r = raizDuas();
  escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) });
  const a = ler(r, 'empresas/aurora/estilo.json');
  escolha.usar(r, 'aurora', 'adesivo', { agora: hora(2) });
  const b = ler(r, 'empresas/aurora/estilo.json');
  escolha.usar(r, 'aurora', 'aurora-jornal', { origem: 'proprio', agora: hora(3) });
  const antesBoreal = fotografia(r, (rel) => rel.startsWith('empresas/aurora'));
  assert.deepStrictEqual(escolha.desfazer(r, 'aurora', { agora: hora(4) }), { restaurado: 'adesivo' });
  assert.ok(ler(r, 'empresas/aurora/estilo.json').equals(b), 'voltou byte a byte');
  assert.deepStrictEqual(escolha.desfazer(r, 'aurora', { agora: hora(5) }), { restaurado: 'bloco' });
  assert.ok(ler(r, 'empresas/aurora/estilo.json').equals(a), 'voltou byte a byte');
  assert.deepStrictEqual(escolha.desfazer(r, 'aurora', { agora: hora(6) }), { restaurado: null });
  assert.ok(!existe(r, 'empresas/aurora/estilo.json'), 'antes da primeira escolha não havia estilo');
  assert.strictEqual(escolha.ler(r, 'aurora'), null);
  assert.throws(() => escolha.desfazer(r, 'aurora', { agora: hora(7) }), (e) => e.recusaDoPedido === true && /nada para desfazer/i.test(e.message));
  assert.deepStrictEqual(fotografia(r, (rel) => rel.startsWith('empresas/aurora')), antesBoreal, 'nada fora de aurora mudou');
  // nada se perdeu: cada versão desfeita continua guardada no histórico
  const guardados = historico(r, 'aurora').map((n) => ler(r, `empresas/aurora/historico/${n}`));
  for (const versao of [a, b]) assert.ok(guardados.some((g) => g.equals(versao)));
  // depois de desfazer, uma escolha nova segue normalmente
  escolha.usar(r, 'aurora', 'adesivo', { agora: hora(8) });
  assert.strictEqual(escolha.ler(r, 'aurora').estilo, 'adesivo');
  assert.deepStrictEqual(escolha.desfazer(r, 'aurora', { agora: hora(9) }), { restaurado: null });
});

// ---------- personalizar ----------

t('personalizar: só valores da lista fechada, com a cópia anterior no histórico; desfazer volta', () => {
  const r = raizDuas();
  assert.throws(() => escolha.personalizar(r, 'aurora', { alinhamento: 'centro' }), (e) => e.recusaDoPedido === true && /estilo/i.test(e.message), 'sem estilo escolhido');
  escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) });
  const antes = ler(r, 'empresas/aurora/estilo.json');
  const res = escolha.personalizar(r, 'aurora', { arranjoImagem: 'dividir', alinhamento: 'centro' }, { agora: hora(2) });
  assert.deepStrictEqual(res.personalizacoes, { arranjoImagem: 'dividir', alinhamento: 'centro' });
  const j = JSON.parse(ler(r, 'empresas/aurora/estilo.json'));
  assert.deepStrictEqual([j.estilo, j.escolhido, j.personalizacoes, j.historico], ['bloco', '2026-11-05T12:00:01.000Z', { arranjoImagem: 'dividir', alinhamento: 'centro' }, []]);
  assert.ok(ler(r, 'empresas/aurora/historico/estilo-2026-11-05-120002Z.json').equals(antes));
  // null tira a personalização daquele detalhe; o que não vem fica como está
  escolha.personalizar(r, 'aurora', { alinhamento: null }, { agora: hora(3) });
  assert.deepStrictEqual(escolha.ler(r, 'aurora').personalizacoes, { arranjoImagem: 'dividir' });
  const fixo = fotografia(r);
  for (const ruim of [{ alinhamento: 'direita' }, { arranjoImagem: 'tela-cheia' }, { cor: 'preto' }, { arranjoImagem: ['dividir'] }, {}, null, 'centro']) {
    assert.throws(() => escolha.personalizar(r, 'aurora', ruim, { agora: hora(4) }), (e) => e.recusaDoPedido === true, JSON.stringify(ruim));
  }
  assert.deepStrictEqual(fotografia(r), fixo, 'recusado: nada gravado');
  escolha.desfazer(r, 'aurora', { agora: hora(5) });
  escolha.desfazer(r, 'aurora', { agora: hora(6) });
  assert.ok(ler(r, 'empresas/aurora/estilo.json').equals(antes), 'dois passos para trás: antes de personalizar');
});

// Troca de nome que falha (arquivo preso por outro programa): o estilo.json fica como estava e a cópia de histórico
// recém-criada não gasta um passo do "Desfazer".
function comTrocaDeNomeFalhando(alvo, fn) {
  const original = fs.renameSync;
  fs.renameSync = (de, para) => {
    if (path.resolve(para) === path.resolve(alvo)) throw Object.assign(new Error('arquivo preso'), { code: 'EPERM' });
    return original(de, para);
  };
  try { return fn(); } finally { fs.renameSync = original; }
}

t('troca de nome que falha: nada muda e o "Desfazer" não perde um passo', () => {
  const r = raizDuas();
  const arq = path.join(r, 'empresas', 'aurora', 'estilo.json');
  // primeira escolha falhando: continua sem estilo e não há o que desfazer
  assert.throws(() => comTrocaDeNomeFalhando(arq, () => escolha.usar(r, 'aurora', 'bloco', { agora: hora(1) })), (e) => e.code === 'EPERM');
  assert.ok(!existe(r, 'empresas/aurora/estilo.json'));
  assert.throws(() => escolha.desfazer(r, 'aurora', { agora: hora(2) }), (e) => e.recusaDoPedido === true && /nada para desfazer/i.test(e.message));
  // com estilo escolhido: a troca falha, o arquivo fica igual e o desfazer volta para antes da escolha que valeu
  escolha.usar(r, 'aurora', 'bloco', { agora: hora(3) });
  const a = ler(r, 'empresas/aurora/estilo.json');
  assert.throws(() => comTrocaDeNomeFalhando(arq, () => escolha.usar(r, 'aurora', 'adesivo', { agora: hora(4) })), (e) => e.code === 'EPERM');
  assert.throws(() => comTrocaDeNomeFalhando(arq, () => escolha.personalizar(r, 'aurora', { alinhamento: 'centro' }, { agora: hora(5) })), (e) => e.code === 'EPERM');
  assert.ok(ler(r, 'empresas/aurora/estilo.json').equals(a), 'o estilo.json ficou como estava');
  assert.ok(!fs.readdirSync(path.join(r, 'empresas', 'aurora')).some((n) => n.endsWith('.tmp')), 'nenhum temporário sobrou');
  assert.deepStrictEqual(escolha.desfazer(r, 'aurora', { agora: hora(6) }), { restaurado: null }, 'um desfazer volta para antes da escolha que valeu');
});

// ---------- arquivo quebrado e pasta antiga ----------

t('estilo.json quebrado à mão não é regravado: erro claro e nada muda', () => {
  const r = raizDuas();
  for (const quebrado of ['{ "estilo": "bloco", ', '[]', JSON.stringify({ versao: 1, estilo: '../x', origem: 'catalogo' }), JSON.stringify({ versao: 7, estilo: 'bloco' })]) {
    esc(r, 'empresas/aurora/estilo.json', quebrado);
    const antes = fotografia(r);
    const quebra = (fn, motivo) => assert.throws(fn, (e) => e.code === 'JSON_INVALIDO' && /nada foi alterado/i.test(e.message), motivo + ': ' + quebrado);
    quebra(() => escolha.usar(r, 'aurora', 'adesivo', { agora: hora(1) }), 'usar');
    quebra(() => escolha.personalizar(r, 'aurora', { alinhamento: 'centro' }, { agora: hora(1) }), 'personalizar');
    quebra(() => escolha.desfazer(r, 'aurora', { agora: hora(1) }), 'desfazer');
    quebra(() => escolha.ler(r, 'aurora'), 'ler');
    assert.deepStrictEqual(fotografia(r), antes, 'o arquivo e o histórico ficaram como estavam');
  }
});

t('pasta antiga: grava em empresas/principal/ e nada mais muda', () => {
  const r = novaRaiz();
  esc(r, `${LAB}/estilos/bloco/estilo.yaml`, 'id: bloco\nnome: Bloco\n');
  esc(r, '06-MARCA-E-FOTOS/marca.yaml', 'empresa:\n  nome: "Padaria de Mentira"\n');
  esc(r, `${LAB}/dados/laboratorio.json`, '[{"id":"p1"}]');
  esc(r, '06-MARCA-E-FOTOS/estilos-proprios/padaria-forno/estilo.yaml', 'id: padaria-forno\nnome: Forno\norigem: referencias\n');
  const antes = fotografia(r);
  escolha.usar(r, 'principal', 'bloco', { agora: hora(1) });
  escolha.usar(r, 'principal', 'padaria-forno', { origem: 'proprio', agora: hora(2) });
  const depois = fotografia(r);
  const novos = Object.keys(depois).filter((k) => !(k in antes) && !k.endsWith('/')).sort();
  assert.deepStrictEqual(novos, ['empresas/principal/estilo.json', 'empresas/principal/historico/estilo-2026-11-05-120001Z-vazio.json', 'empresas/principal/historico/estilo-2026-11-05-120002Z.json']);
  for (const k of Object.keys(antes)) assert.strictEqual(depois[k], antes[k], 'ficou igual byte a byte: ' + k);
  assert.strictEqual(escolha.ler(r, 'principal').nome, 'Forno');
});

// ---------- linha de comando (o agente) ----------

function cli(r, args) {
  const env = { ...process.env, FABRICA_RAIZ: r };
  delete env.FABRICA_EMPRESA;
  const x = spawnSync(process.execPath, [SCRIPT, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}

t('linha de comando: 0 = ok, 1 = recusa em português, 2 = uso; grava só pela empresa dada', () => {
  const r = raizDuas();
  let x = cli(r, ['ler', 'aurora']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.strictEqual(JSON.parse(x.saida), null);
  x = cli(r, ['usar', 'aurora', 'bloco']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.ok(/Bloco/.test(x.saida), x.saida);
  assert.strictEqual(JSON.parse(cli(r, ['ler', 'aurora']).saida).estilo, 'bloco');
  x = cli(r, ['usar', 'aurora', 'aurora-jornal', '--origem', 'proprio']);
  assert.strictEqual(x.status, 0, x.erro);
  x = cli(r, ['personalizar', 'aurora', '--alinhamento', 'centro', '--arranjo-imagem', 'rosto-mini']);
  assert.strictEqual(x.status, 0, x.erro);
  assert.deepStrictEqual(JSON.parse(cli(r, ['ler', 'aurora']).saida).personalizacoes, { arranjoImagem: 'rosto-mini', alinhamento: 'centro' });
  x = cli(r, ['desfazer', 'aurora']);
  assert.strictEqual(x.status, 0, x.erro);
  const antes = fotografia(r);
  for (const args of [['usar', 'aurora', 'nao-existe'], ['usar', 'aurora', 'boreal-neve', '--origem', 'proprio'], ['usar', 'nao-existe', 'bloco'], ['personalizar', 'aurora', '--alinhamento', 'direita']]) {
    x = cli(r, args);
    assert.strictEqual(x.status, 1, args.join(' ') + ': ' + x.erro);
    assert.ok(x.erro.length > 10 && !/at .*\.js:\d+/.test(x.erro), 'mensagem sem pilha: ' + x.erro);
  }
  for (const args of [[], ['inventado', 'aurora'], ['usar', 'aurora'], ['usar', 'aurora', 'bloco', 'sobra'], ['usar', 'aurora', 'bloco', '--origem'], ['personalizar', 'aurora', '--cor', 'x'], ['ler']]) {
    x = cli(r, args);
    assert.strictEqual(x.status, 2, args.join(' ') + ': ' + x.erro);
  }
  assert.deepStrictEqual(fotografia(r), antes, 'recusa e erro de uso não gravam nada');
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
  console.log(`\n${casos.length} testes passaram`);
  process.exit(0);
})();
