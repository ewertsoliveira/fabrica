#!/usr/bin/env node
// Testes do portão de carrossel (Portão 2d): cada checagem é calibrada contra uma linha feita para reprovar (G-13).
// Rode: node _fabrica/core/validar-carrossel.test.js
'use strict';
process.env.FABRICA_SILENCIO_EXEMPLO = '1';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validar } = require('./validar-linha');
const { FORMATOS } = require('./validar-carrossel');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'linha-carrossel-'));
const AGENTES = '05-ESTRATEGIA/nucleo-de-conteudo/agentes';
let n = 0, k = 0;
const t = (nome, fn) => { fn(); n++; console.log('ok   ' + nome); };

// Uma linha de carrossel correta, como o Arquiteto deve construir. Cada teste estraga uma coisa só.
function modelo() {
  return {
    estilo: 'contraste',
    cores: 'original',
    passos: [
      { id: 'pedido', tipo: 'checkpoint' },
      { id: 'copy', tipo: 'estacao', estacao: 'copywriter', execucao: 'subagente' },
      { id: 'aprovar-copy', tipo: 'checkpoint' },
      { id: 'design', tipo: 'estacao', estacao: 'designer', execucao: 'inline' },
      { id: 'aprovar-primeira', tipo: 'checkpoint' },
      { id: 'renderizar', tipo: 'script', execucao: 'inline', ao_reprovar: 'design' },
      { id: 'revisao', tipo: 'estacao', estacao: 'revisor', execucao: 'inline', ao_reprovar: 'design' },
      { id: 'aprovar-preview', tipo: 'checkpoint' },
      { id: 'entregar', tipo: 'script', execucao: 'inline' },
    ],
    estacoes: {
      copywriter: `# Estação: Copy de feed\n\n**Papel do Núcleo:** \`${AGENTES}/copywriter-de-feed.agent.md\`\n`,
      designer: `# Estação: Design\n\n**Papel do Núcleo:** \`${AGENTES}/designer-visual.agent.md\`\n`,
      revisor: `# Estação: Revisão\n\n**Papel do Núcleo:** \`${AGENTES}/revisor-de-qualidade.agent.md\`\n`,
    },
    corpo: {
      pedido: `# Pedido\n\nFormato do carrossel: ${FORMATOS.join(', ')}.\n`,
      copy: '# Copy\n\nCada lâmina traz a `forma` e `visual` com `descricao` da imagem que ajudaria.\n',
      design: '# Design\n\nEscolhe o `layout` de cada lâmina pela forma.\n`node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida pecas --cores original`\n',
      renderizar: '# Renderizar\n\n`node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida pecas --cores original --resto`\n',
      entregar: '# Entregar\n\n`node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida pecas --cores original --entregar`\n',
    },
    extras: {},
  };
}

function gravar(m) {
  const dir = path.join(TMP, 'l' + (k++));
  const w = (rel, txt) => { const a = path.join(dir, rel); fs.mkdirSync(path.dirname(a), { recursive: true }); fs.writeFileSync(a, txt); };
  const num = new Map(m.passos.map((p, i) => [p.id, i + 1]));
  const cps = m.passos.filter((p) => p.tipo === 'checkpoint').map((p) => num.get(p.id));
  const linhas = ['linha: teste', 'nome: "Teste"', 'idioma: pt-BR', 'formato: instagram-feed'];
  if (m.estilo || m.cores) linhas.push('carrossel:');
  if (m.estilo) linhas.push(`  estilo: ${m.estilo}`);
  if (m.cores) linhas.push(`  cores: ${m.cores}`);
  linhas.push(`checkpoints: [${cps.join(', ')}]`, 'passos:');
  m.passos.forEach((p, i) => {
    const arq = `passos/${String(i + 1).padStart(2, '0')}-${p.id}.md`;
    linhas.push(`  - passo: ${i + 1}`, `    id: ${p.id}`, `    tipo: ${p.tipo}`, `    arquivo: ${arq}`);
    if (p.estacao) linhas.push(`    estacao: ${p.estacao}`);
    if (p.execucao) linhas.push(`    execucao: ${p.execucao}`);
    if (p.ao_reprovar) linhas.push(`    ao_reprovar: ${num.get(p.ao_reprovar)}`);
    if (p.saida) linhas.push(`    saida: ${p.saida}`);
    w(arq, m.corpo[p.id] || `# ${p.id}\n`);
  });
  w('linha.yaml', linhas.join('\n') + '\n');
  for (const [id, txt] of Object.entries(m.estacoes)) w(`estacoes/${id}.md`, txt);
  for (const [rel, txt] of Object.entries(m.extras)) w(rel, txt);
  return dir;
}
const erros = (m) => validar(gravar(m)).erros;
const reprova = (nome, estraga, trecho) => t(nome, () => {
  const m = modelo(); estraga(m);
  const e = erros(m);
  assert.ok(e.some((x) => x.includes(trecho)), `esperava um erro com "${trecho}"; veio:\n${e.join('\n') || '(nenhum)'}`);
});
const sem = (m, id) => { m.passos = m.passos.filter((p) => p.id !== id); };

t('linha de carrossel completa passa', () => assert.deepStrictEqual(erros(modelo()), []));
t('a linha de Reels, que não é de carrossel, segue válida', () => assert.deepStrictEqual(validar(path.join(__dirname, '..', '..', 'linhas', 'reels')).erros, []));

reprova('linha que chama o gerador mas não declara o estilo do carrossel', (m) => { m.estilo = null; }, 'falta `carrossel.estilo`');
reprova('estilo que não existe no catálogo', (m) => { m.estilo = 'estilo-que-nao-existe'; }, 'não é utilizável');
reprova('sem a aprovação da copy', (m) => sem(m, 'aprovar-copy'), '`aprovar-copy` deve existir');
reprova('sem a aprovação da primeira lâmina', (m) => sem(m, 'aprovar-primeira'), '`aprovar-primeira` deve existir');
reprova('sem a aprovação do preview antes da entrega', (m) => sem(m, 'aprovar-preview'), '`aprovar-preview` deve existir');
reprova('sem a revisão', (m) => sem(m, 'revisao'), '`revisao` deve existir');
reprova('sem o passo do pedido (escolha do formato)', (m) => sem(m, 'pedido'), '`pedido` deve existir');
reprova('passo repetido', (m) => m.passos.push({ id: 'copy', tipo: 'estacao', estacao: 'copywriter', execucao: 'subagente' }), '`copy` deve existir uma vez só');
reprova('etapas fora de ordem', (m) => { const a = m.passos.findIndex((p) => p.id === 'renderizar'), b = m.passos.findIndex((p) => p.id === 'revisao'); [m.passos[a], m.passos[b]] = [m.passos[b], m.passos[a]]; }, 'fora de ordem');
reprova('passo entre a aprovação da copy e o design', (m) => m.passos.splice(3, 0, { id: 'extra', tipo: 'script', execucao: 'inline' }), 'imediatamente antes de `design`');
reprova('renderizar sem aprovar a primeira lâmina logo antes', (m) => m.passos.splice(5, 0, { id: 'extra', tipo: 'script', execucao: 'inline' }), 'imediatamente antes de `renderizar`');
reprova('entregar sem o preview aprovado logo antes', (m) => m.passos.splice(8, 0, { id: 'extra', tipo: 'script', execucao: 'inline' }), 'imediatamente antes de `entregar`');
reprova('etapa com o tipo errado', (m) => { m.passos.find((p) => p.id === 'renderizar').tipo = 'checkpoint'; }, 'deve ser do tipo script');
reprova('estação do copy sem declarar o papel do Núcleo', (m) => { m.estacoes.copywriter = '# Estação: Copy\n\n**Papel:** escreve.\n'; }, 'deve declarar');
reprova('estação do design com o papel de outro', (m) => { m.estacoes.designer = m.estacoes.copywriter; }, 'deve ser o papel designer-visual');
reprova('papel do Núcleo que não existe', (m) => { m.estacoes.revisor = '# R\n\n**Papel do Núcleo:** `05-ESTRATEGIA/nucleo-de-conteudo/agentes/nao-existe.agent.md`\n'; }, 'o Papel do Núcleo não existe');
reprova('pedido sem os sete formatos', (m) => { m.corpo.pedido = '# Pedido\n\nFormato: lista ou tutorial.\n'; }, 'sete formatos');
reprova('copy sem o campo visual por lâmina', (m) => { m.corpo.copy = '# Copy\n\nEscreve título e corpo.\n'; }, 'campo `visual`');
reprova('design que não usa o gerador na primeira lâmina', (m) => { m.corpo.design = '# Design\n\nMonta as lâminas à mão.\n'; }, 'primeira lâmina');
reprova('linha sem carrossel.cores (originais ou paleta da empresa)', (m) => { m.cores = null; }, '`carrossel.cores`');
reprova('cores com valor desconhecido', (m) => { m.cores = 'azul'; }, 'original ou marca');
reprova('passo do gerador com cores diferentes das declaradas', (m) => { m.corpo.renderizar = m.corpo.renderizar.replace('--cores original', '--cores marca'); }, 'deve rodar gerar.js com `--cores original`');
t('linha com a paleta da empresa (cores: marca) passa', () => {
  const m = modelo(); m.cores = 'marca';
  for (const id of ['design', 'renderizar', 'entregar']) m.corpo[id] = m.corpo[id].replace('--cores original', '--cores marca');
  assert.deepStrictEqual(erros(m), []);
});
reprova('copy sem a forma da lâmina', (m) => { m.corpo.copy = '# Copy\n\nCada lâmina traz `visual` com `descricao`.\n'; }, 'a `forma` de cada lâmina');
reprova('design que não escolhe o layout pela forma', (m) => { m.corpo.design = '# Design\n\n`node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida pecas`\n'; }, 'escolher o `layout`');
reprova('saída declarada dentro de saida/pecas (o runner versionaria um caminho que o gerador não grava)', (m) => { m.passos.find((p) => p.id === 'renderizar').saida = 'saida/pecas/conferencia.txt'; }, 'saida/pecas/conferencia.txt');
reprova('renderizar sem o conferidor (--resto)', (m) => { m.corpo.renderizar = '# R\n\n`node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida pecas`\n'; }, 'com --resto');
reprova('entregar sem --entregar', (m) => { m.corpo.entregar = '# E\n\nCopia os arquivos.\n'; }, 'com --entregar');
reprova('renderizar (conferidor) sem para onde devolver', (m) => { delete m.passos.find((p) => p.id === 'renderizar').ao_reprovar; }, '`renderizar` deve ter `ao_reprovar`');
reprova('revisão sem para onde devolver', (m) => { delete m.passos.find((p) => p.id === 'revisao').ao_reprovar; }, '`ao_reprovar`');
reprova('revisão que devolve para a aprovação do preview', (m) => { m.passos.find((p) => p.id === 'revisao').ao_reprovar = 'aprovar-copy'; }, '`ao_reprovar`');
reprova('etapa que depende de gerador de imagem por IA (I-16)', (m) => { m.extras['dados/fotos.md'] = 'Gere a foto com a skill image-ai-generator.\n'; }, 'I-16');
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${n} testes passaram.`);
