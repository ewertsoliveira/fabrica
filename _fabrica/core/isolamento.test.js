#!/usr/bin/env node
// Prova de isolamento de ponta a ponta entre empresas. Rode: node _fabrica/core/isolamento.test.js
// Tudo por processo filho, numa raiz temporária (FABRICA_RAIZ) que imita uma pasta antiga real.
// Cada caso foi calibrado para reprovar (G-13): sem a recusa de EMPRESA_NAO_ESCOLHIDA no empresa.js, o caso
// "duas sem escolha param" falha.
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

let n = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

const CODIGO = path.resolve(__dirname, '..', '..');
const EMPRESA_JS = path.join(CODIGO, '_fabrica', 'core', 'empresa.js');
const MARCA_JS = path.join(CODIGO, '08-FERRAMENTAS', 'marca', 'marca.js');
const VALIDAR_JS = path.join(CODIGO, '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');

const marcaYaml = (nome, acento) => `empresa:\n  nome: "${nome}"\ncores:\n  escuro: "#111111"\n  claro: "#EEEEEE"\n  acento: "${acento}"\n  neutro: "#777777"\n`;

function escrever(raiz, rel, texto) {
  const arq = path.join(raiz, ...rel.split('/'));
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, texto, 'utf8');
}

// Uma pasta antiga real: marca, perfil configurado, uma saída e uma memória de linha.
function pastaAntiga() {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'isolamento-'));
  escrever(raiz, '06-MARCA-E-FOTOS/marca.yaml', marcaYaml('Empresa Antiga', '#CC3300'));
  escrever(raiz, '_fabrica/_memoria/empresa.md', '# Perfil\n\n**Nome:** Empresa Antiga\n**Site:** https://www.empresaantiga.example/\n');
  escrever(raiz, 'linhas/reels/saida/peca.md', '# Peça pronta\n\nConteúdo da linha de Reels.\n');
  escrever(raiz, 'linhas/reels/memoria/memories.md', '# Memória\n\nAprendizados da linha.\n');
  return raiz;
}

function envDa(raiz, extra = {}) {
  const env = { ...process.env, FABRICA_RAIZ: raiz, FABRICA_SILENCIO_EXEMPLO: '1', ...extra };
  delete env.FABRICA_EMPRESA;
  delete env.FABRICA_MARCA;
  return env;
}
function rodar(raiz, args) {
  const x = spawnSync(process.execPath, args, { env: envDa(raiz), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
  return { status: x.status, saida: x.stdout, erro: x.stderr };
}
const empresaJs = (raiz, ...args) => rodar(raiz, [EMPRESA_JS, ...args]);
// Carrega o marca.js num processo novo (ele lê a empresa ativa ao ser requerido) e imprime o acento.
const acentoCarregado = (raiz) => rodar(raiz, ['-e', `process.stdout.write(require(${JSON.stringify(MARCA_JS)}).hex('acento'))`]);
const validar = (raiz, codigo) => rodar(raiz, [VALIDAR_JS, '--empresa', codigo, '--raiz', raiz]);

// Hash de todo arquivo (caminho relativo -> sha256), exceto o que está sob empresas/.
function hashes(raiz) {
  const mapa = {};
  const varrer = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const arq = path.join(dir, e.name);
      const rel = path.relative(raiz, arq).split(path.sep).join('/');
      if (rel === 'empresas' || rel.startsWith('empresas/')) continue;
      if (e.isDirectory()) varrer(arq);
      else mapa[rel] = crypto.createHash('sha256').update(fs.readFileSync(arq)).digest('hex');
    }
  };
  varrer(raiz);
  return mapa;
}

// Cria a Aurora numa pasta antiga, com marca própria na gaveta. A gaveta nasce sem marca.yaml: o teste a escreve.
function comAurora(raiz) {
  const c = empresaJs(raiz, 'criar', 'aurora', 'Aurora Nutrição');
  assert.strictEqual(c.status, 0, c.erro);
  escrever(raiz, 'empresas/aurora/marca.yaml', marcaYaml('Aurora Nutrição', '#2FB59A'));
}

t('pasta antiga intacta', () => {
  const raiz = pastaAntiga();
  const antes = hashes(raiz);
  assert.ok(Object.keys(antes).length >= 4, 'a pasta antiga devia ter ao menos 4 arquivos');
  const c = empresaJs(raiz, 'criar', 'aurora', 'Aurora Nutrição');
  assert.strictEqual(c.status, 0, c.erro);
  const a = empresaJs(raiz, 'ativar', 'aurora');
  assert.strictEqual(a.status, 0, a.erro);
  assert.deepStrictEqual(hashes(raiz), antes, 'algum arquivo fora de empresas/ mudou, sumiu ou apareceu');
  assert.ok(fs.existsSync(path.join(raiz, 'empresas', 'indice.json')), 'o índice devia estar em empresas/');
});

t('cada empresa com a sua marca', () => {
  const raiz = pastaAntiga();
  comAurora(raiz);
  assert.strictEqual(empresaJs(raiz, 'ativar', 'aurora').status, 0);
  const aurora = acentoCarregado(raiz);
  assert.strictEqual(aurora.status, 0, aurora.erro);
  assert.strictEqual(aurora.saida, '#2FB59A');
  assert.strictEqual(empresaJs(raiz, 'ativar', 'principal').status, 0);
  const antiga = acentoCarregado(raiz);
  assert.strictEqual(antiga.status, 0, antiga.erro);
  assert.strictEqual(antiga.saida, '#CC3300');
});

t('vazamento pego', () => {
  const raiz = pastaAntiga();
  comAurora(raiz);
  assert.strictEqual(empresaJs(raiz, 'ativar', 'aurora').status, 0);
  escrever(raiz, 'empresas/aurora/saidas/reels/roteiro.md', '# Roteiro\n\nUma dica de nutrição da Empresa Antiga para você.\n');
  const sujo = validar(raiz, 'aurora');
  assert.strictEqual(sujo.status, 1, `esperava achado (saída 1), veio ${sujo.status}: ${sujo.saida}${sujo.erro}`);
  escrever(raiz, 'empresas/aurora/saidas/reels/roteiro.md', '# Roteiro\n\nUma dica de nutrição para você.\n');
  const limpo = validar(raiz, 'aurora');
  assert.strictEqual(limpo.status, 0, `esperava limpo (saída 0), veio ${limpo.status}: ${limpo.saida}${limpo.erro}`);
});

t('duas sem escolha param', () => {
  const raiz = pastaAntiga();
  comAurora(raiz); // criar não ativa nenhuma: duas empresas e nenhuma escolhida
  assert.ok(!fs.existsSync(path.join(raiz, 'empresas', 'ativa.json')), 'não devia existir ativa.json');
  const m = acentoCarregado(raiz);
  assert.notStrictEqual(m.status, 0, 'o marca.js devia parar sem empresa escolhida');
  assert.ok(m.erro.includes('nenhuma está escolhida'), m.erro);
  const e = empresaJs(raiz, 'ativa');
  assert.strictEqual(e.status, 1, `esperava recusa (saída 1), veio ${e.status}: ${e.saida}${e.erro}`);
});

t('ferramentas que não usam a marca rodam com duas empresas e nenhuma escolhida', () => {
  const raiz = pastaAntiga();
  comAurora(raiz); // duas empresas, nenhuma escolhida: só quem usa a marca precisa parar
  const core = (arq) => path.join(CODIGO, '_fabrica', 'core', arq);
  const casos = [
    [[core('validar-linha.js'), 'reels'], 0],
    [[core('skills.js'), 'listar'], 0],
    [[core('investigacao.js'), 'plataforma', 'instagram.com/fulano'], 0],
    [[core('visual.js')], 2], // sem argumentos: erro de uso, depois de carregar o script inteiro
  ];
  for (const [args, esperado] of casos) {
    const x = rodar(raiz, args);
    const nome = path.basename(args[0]);
    assert.ok(!x.erro.includes('nenhuma está escolhida'), `${nome} parou pela escolha de empresa: ${x.erro}`);
    assert.strictEqual(x.status, esperado, `${nome}: esperava saída ${esperado}, veio ${x.status}: ${x.saida}${x.erro}`);
  }
});

// ---------- investigacao.js validar lê as investigações da empresa ativa ----------
const INVESTIGACAO_VALIDA = '# Conteúdo bruto: perfil de exemplo\n\nTotal de conteúdos analisados: 1\n\n## Conteúdo 1: primeiro\n\nTexto.\n';
const INVESTIGACAO_JS = path.join(CODIGO, '_fabrica', 'core', 'investigacao.js');
const validarInvestigacao = (raiz, linha) => rodar(raiz, [INVESTIGACAO_JS, 'validar', linha]);

t('investigacao validar: lê a pasta da empresa ativa e a Aurora não enxerga a da principal', () => {
  const raiz = pastaAntiga();
  comAurora(raiz);
  // A investigação da principal fica em linhas/reels/_investigacoes/; a da Aurora, na pasta dela.
  escrever(raiz, 'linhas/reels/_investigacoes/perfil-antigo/conteudo-bruto.md', INVESTIGACAO_VALIDA);
  assert.strictEqual(empresaJs(raiz, 'ativar', 'aurora').status, 0);
  const vazia = validarInvestigacao(raiz, 'reels');
  assert.strictEqual(vazia.status, 0, vazia.saida + vazia.erro);
  assert.ok(vazia.saida.includes('Nenhuma investigação em'), vazia.saida);
  assert.ok(vazia.saida.includes(path.join(raiz, 'empresas', 'aurora', 'investigacoes', 'reels')), vazia.saida);
  assert.ok(!vazia.saida.includes('perfil-antigo'), vazia.saida);
  escrever(raiz, 'empresas/aurora/investigacoes/reels/perfil-novo/conteudo-bruto.md', INVESTIGACAO_VALIDA);
  const propria = validarInvestigacao(raiz, 'reels');
  assert.strictEqual(propria.status, 0, propria.saida + propria.erro);
  assert.ok(propria.saida.includes('perfis investigados: 1'), propria.saida);
  // Uma investigação quebrada na pasta da Aurora reprova (prova que é dali que lê).
  escrever(raiz, 'empresas/aurora/investigacoes/reels/perfil-ruim/conteudo-bruto.md', '# Conteúdo bruto: x\n\nTotal de conteúdos analisados: 0\n');
  assert.strictEqual(validarInvestigacao(raiz, 'reels').status, 1);
  // Na principal, o resultado é o de sempre: lê linhas/reels/_investigacoes/.
  assert.strictEqual(empresaJs(raiz, 'ativar', 'principal').status, 0);
  const antiga = validarInvestigacao(raiz, 'reels');
  assert.strictEqual(antiga.status, 0, antiga.saida + antiga.erro);
  assert.ok(antiga.saida.includes('perfis investigados: 1'), antiga.saida);
});

t('investigacao validar: duas empresas sem escolha recusam; sem empresa usa a pasta antiga; linha ruim recusa', () => {
  const raiz = pastaAntiga();
  comAurora(raiz);
  const x = validarInvestigacao(raiz, 'reels');
  assert.strictEqual(x.status, 1, x.saida + x.erro);
  assert.ok(x.erro.includes('nenhuma foi escolhida'), x.erro);
  const semEmpresa = fs.mkdtempSync(path.join(os.tmpdir(), 'isolamento-vazia-'));
  escrever(semEmpresa, 'linhas/reels/_investigacoes/perfil/conteudo-bruto.md', INVESTIGACAO_VALIDA);
  const y = validarInvestigacao(semEmpresa, 'reels');
  assert.strictEqual(y.status, 0, y.saida + y.erro);
  assert.ok(y.saida.includes('perfis investigados: 1'), y.saida);
  assert.strictEqual(empresaJs(raiz, 'ativar', 'aurora').status, 0);
  const z = validarInvestigacao(raiz, '../x');
  assert.strictEqual(z.status, 1, z.saida + z.erro);
  assert.ok(z.erro.includes('nome de linha'), z.erro);
});

console.log(`\n${n} casos ok`);
