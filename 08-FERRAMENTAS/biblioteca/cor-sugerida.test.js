#!/usr/bin/env node
// Testes de cor-sugerida.js: "Como ficaria" (a peça do estilo com uma das cores sugeridas, feita sob demanda).
// Rode: node 08-FERRAMENTAS/biblioteca/cor-sugerida.test.js   (só Node: o gerador das prévias é trocado por um falso, que
// confere o que recebeu e grava arquivos pequenos; a geração de verdade está na prova visual da etapa 7)
// Raiz temporária com as empresas fictícias aurora (quente) e boreal (fria), cores montadas em código, e cinza sem marca.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;
delete process.env.FABRICA_RAIZ;

const cs = require('./cor-sugerida');
const pm = require('./previas-marca');
const empresaMod = require('../../_fabrica/core/empresa');
const { lerYaml } = require('../marca/yaml');

const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });
const pastas = [];
let contador = 0;
function novaRaiz() {
  const r = path.join(os.tmpdir(), `cor-sugerida-teste-${process.pid}-${++contador}`);
  fs.rmSync(r, { recursive: true, force: true });
  fs.mkdirSync(r, { recursive: true });
  pastas.push(r);
  return r;
}
function esc(r, rel, conteudo) {
  const arq = path.join(r, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  return arq;
}
function fotografia(dir) {
  const mapa = {};
  if (!fs.existsSync(dir)) return mapa;
  const varrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const arq = path.join(d, e.name);
      const rel = path.relative(dir, arq).split(path.sep).join('/');
      if (e.isDirectory()) { mapa[rel + '/'] = 'pasta'; varrer(arq); } else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(dir);
  return mapa;
}
const hex = (r, g, b) => '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
const AURORA = { nome: 'Aurora Nutrição', conta: 'aurora.nutricao', cores: { escuro: hex(58, 30, 36), claro: hex(255, 243, 228), acento: hex(228, 87, 46), neutro: hex(176, 125, 98) } };
const BOREAL = { nome: 'Boreal Finanças', conta: 'boreal.financas', cores: { escuro: hex(14, 42, 59), claro: hex(234, 246, 248), acento: hex(39, 196, 217), neutro: hex(94, 124, 140) } };
const yamlMarca = (m) => ['empresa:', `  nome: "${m.nome}"`, `  handle: "${m.conta}"`, 'cores:', ...Object.entries(m.cores).map(([p, v]) => `  ${p}: "${v}"`),
  'canvas:', '  pisos: { titulo: 56, texto: 28 }', 'tipografia:', '  principal:', '    arquivo: "fontes/principal.ttf"', '    italico: false', ''].join('\n');

// Os textos difíceis de ler do Editorial na aurora: o neutro na lâmina 2 e o acento na capa de Reels, os dois sobre a foto
// escura (a mesma cor da marca é sugerida para os dois papéis: a peça pedida decide qual grupo vale).
const FOTO = [hex(60, 40, 30), hex(80, 55, 40), hex(100, 70, 50)];
const LEGIVEL = (cores) => ({ cores, textos: [
  { tipo: 'contraste', daMarca: true, piorou: true, formato: 'carrossel', lamina: 2, onde: 'da lâmina 2', texto: 'O imposto', papel: 'neutro', minimo: 3, fundo: { amostras: FOTO } },
  { tipo: 'contraste', daMarca: true, piorou: true, formato: 'reels', lamina: 1, onde: 'da capa de Reels', texto: 'Reels', papel: 'acento', minimo: 3, fundo: { amostras: FOTO } },
] });
function previasDeHoje(r, c, m) {
  const { assinatura } = pm.assinaturaDaMarca(r, c);
  const base = `empresas/${c}/previas/editorial`;
  for (const f of ['carrossel-01.webp', 'carrossel-02.webp', 'reels-capa.webp']) esc(r, `${base}/${f}`, 'x');
  esc(r, `${base}/previas.json`, JSON.stringify({ estilo: 'editorial', cores: 'marca', empresa: c, assinatura, identidade: 'empresa', capa: 'carrossel-01.webp',
    carrossel: ['carrossel-01.webp', 'carrossel-02.webp'], reelsCapa: 'reels-capa.webp', avisos: ['Com as suas cores, o texto da lâmina 2 fica difícil de ler.'], legibilidade: { ...LEGIVEL(m.cores), todos: TODOS_HOJE } }));
}
function raiz() {
  const r = novaRaiz();
  empresaMod.criar('aurora', 'Aurora Nutrição', r);
  empresaMod.criar('boreal', 'Boreal Finanças', r);
  empresaMod.criar('cinza', 'Cinza Sem Marca', r);
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
  esc(r, 'empresas/aurora/fontes/principal.ttf', 'letra');
  esc(r, 'empresas/boreal/marca.yaml', yamlMarca(BOREAL));
  previasDeHoje(r, 'aurora', AURORA);
  previasDeHoje(r, 'boreal', BOREAL);
  return r;
}
const leituraDe = (r, c) => pm.previasValidas(r, c, 'editorial', pm.assinaturaDaMarca(r, c).assinatura).leitura;
const grupo = (r, c, papel) => leituraDe(r, c).find((g) => g.tipo === 'cor' && g.papel === papel);
const LAMINA2 = { formato: 'carrossel', lamina: 2 };
// Textos guardados hoje no Editorial (legibilidade.todos): o título da lâmina 1 se lê (escuro sobre claro); o rodapé da lâmina 2
// já é difícil. Os guardados de amanhã (o estilo gerado com a cor nova) vêm do gerador falso.
const guardado = (l, k, c, q, m, t) => { const x = { f: 'carrossel', l, k, t, p: null, c, al: 1, md: q[1], q, m, ct: 0 }; x.ct = pm.contrasteGuardado(x); return x; };
const CLAROS = [hex(240, 236, 230), hex(245, 240, 235), hex(250, 245, 240)];
const TODOS_HOJE = [guardado(1, 7, hex(40, 30, 30), CLAROS, 3, 'Título da lâmina 1'), guardado(2, 8, hex(200, 195, 190), CLAROS, 4.5, 'Rodapé')];
const REELS = { formato: 'reels', lamina: 1 };

// O gerador falso: confere os argumentos, guarda o que recebeu e grava as peças como o gerar-previas.js gravaria.
// `textos`: a legibilidade medida na peça nova; `cores`: o campo cores do manifesto novo.
function geradorFalso({ textos = [], todos = [], falhar = false, antes = null, cores = 'marca' } = {}) {
  const chamadas = [];
  const rodar = async (args, { env }) => {
    const [script, estilo, op1, yaml, op2, saida, op3, empresa] = args;
    chamadas.push({ script, estilo, yamlTexto: fs.readFileSync(yaml, 'utf8'), yaml, saida, empresa, env: { ...env }, ops: [op1, op2, op3] });
    if (antes) await antes();
    if (falhar) return { status: 1, stdout: '', stderr: 'Erro: o navegador fechou', tempoEsgotado: false };
    const dir = path.join(saida, estilo);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of ['carrossel-01.webp', 'carrossel-02.webp', 'reels-capa.webp']) fs.writeFileSync(path.join(dir, f), 'nova');
    fs.writeFileSync(path.join(dir, 'previas.json'), JSON.stringify({ estilo, cores, capa: 'carrossel-01.webp', carrossel: ['carrossel-01.webp', 'carrossel-02.webp'], reelsCapa: 'reels-capa.webp', legibilidade: { textos, todos } }));
    return { status: 0, stdout: 'feitos: 1/1', stderr: '', tempoEsgotado: false };
  };
  return { rodar, chamadas };
}
const pedido = (r, extra = {}) => ({ raiz: r, empresa: 'aurora', estilo: 'editorial', papel: 'neutro', cor: grupo(r, 'aurora', 'neutro').sugestoes[0].cor, peca: LAMINA2, ...extra });

t('a peça com a cor sugerida: o gerador recebe uma cópia da marca só com a cor trocada; nada da marca, das prévias ou de outra empresa muda', async () => {
  const r = raiz();
  const s = grupo(r, 'aurora', 'neutro').sugestoes[0];
  const borealAntes = fotografia(path.join(r, 'empresas', 'boreal'));
  const marcaAntes = fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml'));
  const previasAntes = fotografia(path.join(r, 'empresas', 'aurora', 'previas'));
  const g = geradorFalso();
  process.env.FABRICA_MARCA = path.join(r, 'empresas', 'boreal', 'marca.yaml'); // ambiente sujo: não vai ao filho
  process.env.FABRICA_EMPRESA = 'boreal';
  let x;
  try { x = await cs.comoFicaria(pedido(r, { cor: s.cor.toLowerCase(), rodar: g.rodar })); } finally { delete process.env.FABRICA_MARCA; delete process.env.FABRICA_EMPRESA; }
  assert.strictEqual(g.chamadas.length, 1);
  const c = g.chamadas[0];
  assert.ok(/gerar-previas\.js$/.test(c.script) && c.estilo === 'editorial' && c.empresa === 'aurora');
  assert.deepStrictEqual(c.ops, ['--marca-arquivo', '--saida', '--empresa']);
  assert.strictEqual(c.env.FABRICA_RAIZ, path.resolve(r));
  assert.ok(!('FABRICA_MARCA' in c.env) && !('FABRICA_EMPRESA' in c.env), 'sem a marca nem a empresa de quem chamou');
  const esperado = JSON.parse(JSON.stringify(lerYaml(fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml'), 'utf8'))));
  esperado.cores.neutro = s.cor;
  assert.deepStrictEqual(lerYaml(c.yamlTexto), esperado, 'a cópia: a marca de hoje só com o neutro trocado');
  assert.ok(!c.yaml.startsWith(path.resolve(r)), 'a cópia da marca fica fora da Fábrica');
  assert.ok(!fs.existsSync(c.yaml), 'e é apagada no fim');
  const nome = `${pm.assinaturaDaMarca(r, 'aurora').assinatura}-neutro-${s.cor.slice(1).toLowerCase()}`;
  assert.strictEqual(path.resolve(c.saida), path.join(path.resolve(r), 'empresas', 'aurora', 'cores-sugeridas', nome));
  assert.deepStrictEqual(x.pecas, [{ formato: 'carrossel', lamina: 2, atual: '/empresas/aurora/previas/editorial/carrossel-02.webp',
    endereco: `/empresas/aurora/cores-sugeridas/${nome}/editorial/carrossel-02.webp`, dificeis: [] }]);
  assert.deepStrictEqual(fs.readFileSync(path.join(r, 'empresas', 'aurora', 'marca.yaml')), marcaAntes);
  assert.deepStrictEqual(fotografia(path.join(r, 'empresas', 'aurora', 'previas')), previasAntes);
  assert.deepStrictEqual(fotografia(path.join(r, 'empresas', 'boreal')), borealAntes);
  // a segunda vez, com a mesma marca e a mesma cor: na hora, sem gerar de novo
  const y = await cs.comoFicaria(pedido(r, { rodar: g.rodar }));
  assert.strictEqual(g.chamadas.length, 1);
  assert.deepStrictEqual(y.pecas, x.pecas);
});

t('a peça pedida decide o grupo: a mesma cor sugerida para dois papéis devolve a peça de cada um; peça desconhecida é recusada (sonda peca-errada)', async () => {
  const r = raiz();
  const doNeutro = grupo(r, 'aurora', 'neutro').sugestoes.map((s) => s.cor);
  const comum = grupo(r, 'aurora', 'acento').sugestoes.map((s) => s.cor).find((c) => doNeutro.includes(c));
  assert.ok(comum, 'a mesma cor sugerida nos dois grupos');
  const g = geradorFalso();
  const reels = await cs.comoFicaria(pedido(r, { papel: 'acento', cor: comum, peca: REELS, rodar: g.rodar }));
  assert.deepStrictEqual(reels.pecas.map((p) => [p.formato, p.lamina, p.atual]), [['reels', 1, '/empresas/aurora/previas/editorial/reels-capa.webp']]);
  assert.ok(/\/editorial\/reels-capa\.webp$/.test(reels.pecas[0].endereco));
  const lam = await cs.comoFicaria(pedido(r, { papel: 'neutro', cor: comum, peca: LAMINA2, rodar: g.rodar }));
  assert.deepStrictEqual(lam.pecas.map((p) => [p.formato, p.lamina]), [['carrossel', 2]]);
  for (const peca of [{ formato: 'reels', lamina: 1 }, { formato: 'carrossel', lamina: 3 }, { formato: 'outro', lamina: 2 }, { formato: 'carrossel', lamina: '2' }, null, undefined]) {
    await assert.rejects(cs.comoFicaria(pedido(r, { papel: 'neutro', cor: comum, peca, rodar: g.rodar })), (e) => e.code === 'PECA_FORA' && e.message === 'Esta peça não é uma das que ficam difíceis de ler neste estilo.', JSON.stringify(peca));
  }
  assert.strictEqual(g.chamadas.length, 2, 'peça recusada não gera nada');
});

t('o que continua difícil de ler é o da MESMA peça, todos os textos dela; o de outra lâmina não conta; o manifesto que não é da marca não vale', async () => {
  const r = raiz();
  const g = geradorFalso({ textos: [
    { tipo: 'contraste', formato: 'carrossel', lamina: 1, texto: 'Outra lâmina' },
    { tipo: 'estilo', formato: 'carrossel', lamina: 2, texto: 'Finanças sem susto' },
    { tipo: 'contraste', formato: 'carrossel', lamina: 2, texto: 'Rodapé' + String.fromCharCode(0x202e) },
    { tipo: 'contraste', formato: 'reels', lamina: 1, texto: 'Na capa' },
  ] });
  const x = await cs.comoFicaria(pedido(r, { rodar: g.rodar }));
  assert.deepStrictEqual(x.pecas[0].dificeis, ['Finanças sem susto', 'Rodapé'], 'só os da lâmina 2, limpos');
  // manifesto que não é da marca (cores de sugestão): não é entregue
  const r2 = raiz();
  await assert.rejects(cs.comoFicaria(pedido(r2, { rodar: geradorFalso({ cores: 'sugestao' }).rodar })), (e) => e.code === 'FALHOU');
});

t('recusas antes de gerar: cor que não foi sugerida, papel estranho, estilo torto ou sem prévia, empresa sem marca ou fora da lista', async () => {
  const r = raiz();
  const g = geradorFalso();
  const antes = fotografia(r);
  const tenta = (o) => cs.comoFicaria(pedido(r, { rodar: g.rodar, ...o }));
  await assert.rejects(tenta({ cor: hex(1, 2, 3) }), (e) => e.code === 'COR_FORA' && e.message === 'Esta cor não é uma das sugeridas para este estilo.');
  await assert.rejects(tenta({ cor: 'vermelho' }), (e) => e.code === 'COR_FORA');
  await assert.rejects(tenta({ papel: 'roxo' }), (e) => e.code === 'COR_FORA');
  await assert.rejects(tenta({ estilo: '../x' }), (e) => e.code === 'ESTILO_DESCONHECIDO');
  await assert.rejects(tenta({ estilo: 'cartilha' }), (e) => e.code === 'SEM_PREVIA');
  await assert.rejects(tenta({ empresa: 'cinza' }), (e) => e.code === 'SEM_MARCA');
  await assert.rejects(tenta({ empresa: '../x' }), (e) => e.code === 'EMPRESA_DESCONHECIDA');
  assert.strictEqual(g.chamadas.length, 0, 'nada foi gerado');
  assert.deepStrictEqual(fotografia(r), antes, 'nada foi gravado');
});

t('a cópia da marca sai da pasta temporária também quando o gerador falha; uma geração por vez; marca que muda no meio descarta; marca nova apaga as peças da velha', async () => {
  const r = raiz();
  // o gerador falha: mensagem simples, detalhe no console, cópia apagada
  const falho = geradorFalso({ falhar: true });
  const erros = [];
  const consoleErro = console.error;
  console.error = (...a) => erros.push(a.join(' '));
  try {
    await assert.rejects(cs.comoFicaria(pedido(r, { rodar: falho.rodar })), (e) => e.code === 'FALHOU' && e.message === 'Não consegui preparar a prévia com esta cor. Tente de novo.');
  } finally { console.error = consoleErro; }
  assert.ok(erros.some((x) => /navegador fechou/.test(x)), 'o detalhe técnico vai para o console');
  assert.ok(!fs.existsSync(falho.chamadas[0].yaml) && !fs.existsSync(path.dirname(falho.chamadas[0].yaml)), 'a cópia da marca (e a pasta dela) saiu mesmo com a falha');
  // uma por vez, e a marca que muda no meio
  let soltar;
  const g = geradorFalso({ antes: () => new Promise((ok) => { soltar = ok; }) });
  const primeira = cs.comoFicaria(pedido(r, { rodar: g.rodar }));
  await new Promise((ok) => setTimeout(ok, 30));
  await assert.rejects(cs.comoFicaria(pedido(r, { rodar: g.rodar })), (e) => e.code === 'OCUPADO');
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca({ ...AURORA, cores: { ...AURORA.cores, acento: hex(200, 40, 90) } }));
  soltar();
  await assert.rejects(primeira, (e) => e.code === 'MARCA_MUDOU' && /mudou/.test(e.message));
  const base = path.join(r, 'empresas', 'aurora', 'cores-sugeridas');
  assert.deepStrictEqual(fs.existsSync(base) ? fs.readdirSync(base) : [], [], 'a peça da marca velha não fica');
  // com a marca nova (e as prévias dela) e depois a de antes: só a pasta da marca de hoje fica
  previasDeHoje(r, 'aurora', { cores: { ...AURORA.cores, acento: hex(200, 40, 90) } });
  await cs.comoFicaria(pedido(r, { rodar: geradorFalso().rodar }));
  esc(r, 'empresas/aurora/marca.yaml', yamlMarca(AURORA));
  previasDeHoje(r, 'aurora', AURORA);
  await cs.comoFicaria(pedido(r, { rodar: geradorFalso().rodar }));
  const nomes = fs.readdirSync(base);
  assert.strictEqual(nomes.length, 1);
  assert.ok(nomes[0].startsWith(pm.assinaturaDaMarca(r, 'aurora').assinatura + '-'), 'só a da marca de hoje');
});

t('limpeza: cópias abandonadas na pasta temporária (do próprio programa, com mais de 1 h) saem; no máximo 6 peças por empresa, as mais novas', async () => {
  const r = raiz();
  const tmp = os.tmpdir();
  const velha = fs.mkdtempSync(path.join(tmp, 'cor-sugerida-'));
  const nova = fs.mkdtempSync(path.join(tmp, 'cor-sugerida-'));
  const alheia = fs.mkdtempSync(path.join(tmp, 'outra-coisa-'));
  const parecida = velha + '-de-outro-programa'; // começa igual, mas não é o nome exato que o programa cria
  fs.mkdirSync(parecida);
  pastas.push(nova, alheia, velha, parecida);
  const duasHoras = (Date.now() - 2 * 3600 * 1000) / 1000;
  fs.utimesSync(velha, duasHoras, duasHoras);
  fs.utimesSync(alheia, duasHoras, duasHoras);
  fs.utimesSync(parecida, duasHoras, duasHoras);
  cs.limparAbandonadas();
  assert.ok(!fs.existsSync(velha), 'a abandonada saiu');
  assert.ok(fs.existsSync(nova), 'a recente (pode ser de outra geração em andamento) fica');
  assert.ok(fs.existsSync(alheia), 'o que não é do programa fica');
  assert.ok(fs.existsSync(parecida), 'só o nome exato do programa (cor-sugerida- e 6 letras) sai');
  // 7 peças da marca de hoje já guardadas (mais velhas) e uma pasta que não é do programa: depois de uma nova, ficam 6 + a alheia
  const assin = pm.assinaturaDaMarca(r, 'aurora').assinatura;
  const base = path.join(r, 'empresas', 'aurora', 'cores-sugeridas');
  const papeis = ['escuro', 'claro', 'acento', 'neutro'];
  for (let i = 0; i < 7; i++) {
    const d = esc(r, `empresas/aurora/cores-sugeridas/${assin}-${papeis[i % 4]}-00000${i}/editorial/previas.json`, '{}');
    const t0 = (Date.now() - (10 - i) * 60000) / 1000;
    fs.utimesSync(path.dirname(path.dirname(d)), t0, t0);
  }
  esc(r, 'empresas/aurora/cores-sugeridas/minha-pasta/leia.txt', 'x');
  await cs.comoFicaria(pedido(r, { rodar: geradorFalso().rodar }));
  const nomes = fs.readdirSync(base).sort();
  assert.ok(nomes.includes('minha-pasta'), 'o que não é do programa fica');
  const doPrograma = nomes.filter((n) => n !== 'minha-pasta');
  assert.strictEqual(doPrograma.length, 6, nomes.join(','));
  assert.ok(!doPrograma.includes(`${assin}-escuro-000000`) && !doPrograma.includes(`${assin}-claro-000001`), 'as duas mais velhas saíram');
});

t('o aviso das peças que a cor estraga é texto a texto: o texto que hoje se lê e, gerado com a cor nova, fica difícil entra (com o estilo); o que já era difícil não; vale também depois de 40 textos', async () => {
  const r = raiz();
  // o título da lâmina 1 (hoje se lê) fica difícil; o rodapé da lâmina 2 continua difícil (não conta); 45 textos antes
  const muitos = Array.from({ length: 45 }, (_, i) => guardado(3, 100 + i, hex(40, 30, 30), CLAROS, 3, 'pequeno ' + i));
  const amanha = [...muitos, guardado(1, 7, hex(240, 236, 230), CLAROS, 3, 'Título da lâmina 1'), guardado(2, 8, hex(200, 195, 190), CLAROS, 4.5, 'Rodapé')];
  const x = await cs.comoFicaria(pedido(r, { rodar: geradorFalso({ todos: amanha }).rodar }));
  assert.deepStrictEqual(x.pioradas, [{ estilo: 'editorial', nome: 'editorial', formato: 'carrossel', lamina: 1, texto: 'Título da lâmina 1' }]);
  // nada piorou: lista vazia
  const r2 = raiz();
  assert.deepStrictEqual((await cs.comoFicaria(pedido(r2, { rodar: geradorFalso({ todos: TODOS_HOJE }).rodar }))).pioradas, []);
});

t('paraYaml: a volta pelo leitor de YAML da Fábrica dá os mesmos dados; texto com quebra de linha é recusado', () => {
  const dados = { empresa: { nome: 'Aspas "duplas" e \\ barra', handle: 'conta' }, cores: { escuro: hex(1, 2, 3) }, canvas: { pisos: { titulo: 56 }, feed: [1080, 1350] }, vazio: {}, sim: true, nada: null };
  assert.deepStrictEqual(lerYaml(cs.paraYaml(dados) + '\n'), dados);
  assert.throws(() => cs.paraYaml({ a: 'linha\noutra' }));
  assert.throws(() => cs.paraYaml({ 'chave com espaço': 1 }));
});

(async () => {
  let ok = 0;
  let falhas = 0;
  for (const { nome, fn } of casos) {
    try { await fn(); ok++; console.log('ok   ' + nome); } catch (e) { falhas++; console.log('FALHOU ' + nome + '\n       ' + (e && e.stack || e)); }
  }
  for (const p of pastas) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* o sistema limpa depois */ } }
  console.log(`\n${ok} testes passaram, ${falhas} falharam.`);
  process.exit(falhas ? 1 : 0);
})();
