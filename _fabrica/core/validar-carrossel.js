// Portão de carrossel do validador de linha (Portão 2d da Construção). Uma linha que produz carrossel de feed precisa
// ter os três papéis do Núcleo, a escolha explícita do formato, o campo `visual` por lâmina, a aprovação da copy, a
// aprovação da primeira lâmina, o conferidor como portão, a revisão e a aprovação do preview antes da entrega.
// É chamado por validar-linha.js; não tem comando próprio.
'use strict';
const fs = require('fs');
const path = require('path');

// Etapas obrigatórias, na ordem. O `id` é o do passo em linha.yaml; pode haver outros passos entre elas.
const ETAPAS = [
  { id: 'pedido', tipo: 'checkpoint' },
  { id: 'copy', tipo: 'estacao', papel: 'copywriter-de-feed' },
  { id: 'aprovar-copy', tipo: 'checkpoint' },
  { id: 'design', tipo: 'estacao', papel: 'designer-visual' },
  { id: 'aprovar-primeira', tipo: 'checkpoint' },
  { id: 'renderizar', tipo: 'script' },
  { id: 'revisao', tipo: 'estacao', papel: 'revisor-de-qualidade' },
  { id: 'aprovar-preview', tipo: 'checkpoint' },
  { id: 'entregar', tipo: 'script' },
];
// Passos que não podem rodar sem uma aprovação imediatamente antes (a peça só avança com o sim do responsável).
const DEPOIS_DE_APROVACAO = { design: 'aprovar-copy', renderizar: 'aprovar-primeira', entregar: 'aprovar-preview' };
const FORMATOS = ['editorial', 'lista', 'tutorial', 'mito e realidade', 'antes e depois', 'história', 'problema e solução']; // F-22
const GERADOR_DE_IMAGEM = /image-ai-generator|image-fetcher|gemini-imagem|imagem-ia/i; // I-16

const AGENTES = '05-ESTRATEGIA/nucleo-de-conteudo/agentes';
const papelDaEstacao = (texto) => { const m = /\*\*Papel do Núcleo:\*\*\s*`?([^`\n]+?)`?\s*$/m.exec(texto); return m ? m[1].trim() : null; };

// Uma linha é de carrossel se declara `carrossel:`, tem formato de carrossel ou chama o gerador em algum passo.
function ehLinhaDeCarrossel(pasta, L, passos) {
  if (L.carrossel && typeof L.carrossel === 'object') return true;
  if (/carrossel/i.test(String(L.formato || ''))) return true;
  return passos.some((p) => p.arquivo && fs.existsSync(path.join(pasta, p.arquivo)) && /carrossel\/gerar\.js/.test(fs.readFileSync(path.join(pasta, p.arquivo), 'utf8')));
}

function validarCarrossel({ pasta, L, passos, raiz }) {
  const erros = [];
  const ler = (rel) => { const a = path.join(pasta, rel); return fs.existsSync(a) ? fs.readFileSync(a, 'utf8') : ''; };
  const ordenados = [...passos].filter((p) => typeof p.passo === 'number').sort((a, b) => a.passo - b.passo);

  // 1. Estilo do catálogo declarado e válido.
  const estilo = L.carrossel && L.carrossel.estilo;
  if (!estilo) erros.push('carrossel: falta `carrossel.estilo` em linha.yaml (o id de um estilo de 04-LABORATORIO-DE-DESIGN/estilos/)');
  else {
    try { require(path.join(raiz, '08-FERRAMENTAS', 'carrossel', 'molde')).lerEstilo(estilo); }
    catch (e) { erros.push(`carrossel: o estilo "${estilo}" não é utilizável (${e.message})`); }
  }
  // 1b. Cores declaradas: as originais do estilo ou a paleta da empresa, e o mesmo valor em todos os passos do gerador.
  const cores = L.carrossel && L.carrossel.cores;
  if (!['original', 'marca'].includes(cores)) erros.push(`carrossel: \`carrossel.cores\` em linha.yaml deve ser original ou marca (veio ${JSON.stringify(cores)})`);
  else {
    for (const id of ['design', 'renderizar', 'entregar']) {
      const p = ordenados.find((x) => x.id === id);
      const txt = p && p.arquivo ? ler(p.arquivo) : '';
      if (p && /carrossel\/gerar\.js/.test(txt) && !new RegExp(`--cores\\s+(${cores}|\\{cores\\})`).test(txt)) erros.push(`carrossel: o passo \`${id}\` deve rodar gerar.js com \`--cores ${cores}\`, como declara linha.yaml`);
    }
  }

  // 2. As nove etapas, uma vez cada, do tipo certo e na ordem.
  let anterior = -1;
  const achados = {};
  for (const e of ETAPAS) {
    const doId = ordenados.filter((p) => p.id === e.id);
    if (doId.length !== 1) { erros.push(`carrossel: o passo \`${e.id}\` deve existir uma vez só (encontrei ${doId.length})`); continue; }
    const p = doId[0];
    achados[e.id] = p;
    if (p.tipo !== e.tipo) erros.push(`carrossel: o passo \`${e.id}\` deve ser do tipo ${e.tipo} (veio ${p.tipo})`);
    const pos = ordenados.indexOf(p);
    if (pos < anterior) erros.push(`carrossel: o passo \`${e.id}\` está fora de ordem (a sequência é ${ETAPAS.map((x) => x.id).join(' → ')})`);
    anterior = Math.max(anterior, pos);
  }

  // 3. Aprovação imediatamente antes de design, renderização e entrega.
  for (const [id, aprov] of Object.entries(DEPOIS_DE_APROVACAO)) {
    const p = achados[id], a = achados[aprov];
    if (p && a && ordenados[ordenados.indexOf(p) - 1] !== a) erros.push(`carrossel: o passo imediatamente antes de \`${id}\` deve ser \`${aprov}\` (a peça só avança com a aprovação do responsável)`);
  }

  // 4. Os três papéis do Núcleo, ligados às estações.
  for (const e of ETAPAS.filter((x) => x.papel)) {
    const p = achados[e.id];
    if (!p || !p.estacao) continue;
    const texto = ler(`estacoes/${p.estacao}.md`);
    const alvo = papelDaEstacao(texto);
    if (!alvo) erros.push(`carrossel: a estação \`${p.estacao}\` (passo \`${e.id}\`) deve declarar \`**Papel do Núcleo:** ${AGENTES}/${e.papel}.agent.md\``);
    else if (path.basename(alvo) !== `${e.papel}.agent.md`) erros.push(`carrossel: a estação \`${p.estacao}\` deve ser o papel ${e.papel}, não ${path.basename(alvo)}`);
  }

  // 5. Conteúdo mínimo dos passos que carregam as regras do carrossel.
  const corpo = (id) => (achados[id] && achados[id].arquivo ? ler(achados[id].arquivo) : '');
  const pedido = corpo('pedido').toLowerCase();
  const semFormato = FORMATOS.filter((f) => !pedido.includes(f));
  if (achados.pedido && semFormato.length) erros.push(`carrossel: o checkpoint \`pedido\` deve oferecer os sete formatos de carrossel (F-22); faltam: ${semFormato.join(', ')}`);
  const copy = corpo('copy');
  if (achados.copy && !(/`visual`/.test(copy) && /descri[cç][aã]o/i.test(copy))) erros.push('carrossel: o passo `copy` deve pedir o campo `visual` com `descricao` em cada lâmina (DG-09)');
  if (achados.copy && !/`forma`/.test(copy)) erros.push('carrossel: o passo `copy` deve pedir a `forma` de cada lâmina (lista, fórmula, passos, texto com visual...): é ela que decide o layout');
  if (achados.design && !/`layout`/.test(corpo('design'))) erros.push('carrossel: o passo `design` deve escolher o `layout` de cada lâmina pela forma do conteúdo; sem isso o layout vem da posição no rodízio e o texto pode sumir (C-21)');
  if (achados.design && !/carrossel\/gerar\.js/.test(corpo('design'))) erros.push('carrossel: o passo `design` deve gerar a primeira lâmina com 08-FERRAMENTAS/carrossel/gerar.js (DG-18)');
  if (achados.renderizar && !(/carrossel\/gerar\.js/.test(corpo('renderizar')) && /--resto/.test(corpo('renderizar')))) erros.push('carrossel: o passo `renderizar` deve rodar gerar.js com --resto, que é onde o conferidor reprova a peça');
  if (achados.entregar && !(/carrossel\/gerar\.js/.test(corpo('entregar')) && /--entregar/.test(corpo('entregar')))) erros.push('carrossel: o passo `entregar` deve rodar gerar.js com --entregar');

  // 6. Quem reprova devolve a quem pode corrigir: o conferidor (renderizar) ao design; a revisão ao design ou à copy.
  for (const [id, aceitos] of [['renderizar', ['design']], ['revisao', ['design', 'copy']]]) {
    const alvo = achados[id] && ordenados.find((p) => p.passo === achados[id].ao_reprovar);
    if (achados[id] && (!alvo || !aceitos.includes(alvo.id))) erros.push(`carrossel: \`${id}\` deve ter \`ao_reprovar\` apontando para o passo ${aceitos.map((x) => '`' + x + '`').join(' ou ')}`);
  }

  // 6b. O runner versiona todo caminho declarado em `saida`; as peças do gerador ficam fora disso (carrossel-compartilhado, seção 2).
  for (const p of ordenados) for (const campo of ['entrada', 'saida']) {
    if (/^saida\/pecas(\/|$)/.test(String(p[campo] || ''))) erros.push(`carrossel: o passo \`${p.id}\` declara ${campo} em \`${p[campo]}\`; use um arquivo de controle (por exemplo saida/conferencia.txt): as peças ficam em saida/<run_id>/pecas, fora do versionamento do runner`);
  }

  // 7. Nenhuma etapa depende de serviço de imagem por IA (I-16).
  const varrer = (dir, rel = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (['saida', 'memoria'].includes(d.name) && !rel) return [];
    const r = path.join(rel, d.name);
    return d.isDirectory() ? varrer(path.join(dir, d.name), r) : /\.(md|ya?ml|json|js)$/.test(d.name) ? [r] : [];
  });
  for (const rel of varrer(pasta)) {
    const m = GERADOR_DE_IMAGEM.exec(fs.readFileSync(path.join(pasta, rel), 'utf8'));
    if (m) erros.push(`carrossel: ${rel.split(path.sep).join('/')} cita "${m[0]}"; nenhuma etapa do carrossel pode depender de gerador de imagem por IA (I-16)`);
  }
  return erros;
}

module.exports = { validarCarrossel, ehLinhaDeCarrossel, papelDaEstacao, ETAPAS, FORMATOS };
