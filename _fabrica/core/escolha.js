#!/usr/bin/env node
// O estilo escolhido pela empresa: o arquivo `estilo` dela (empresas/<codigo>/estilo.json), gravado pelo painel e pelo
// agente sempre por aqui, com a versão anterior guardada no `historico` da empresa e "Desfazer".
//
//   estilo.json = { versao: 1, estilo: '<id>', origem: 'catalogo' | 'proprio', escolhido: <ISO>,
//                   personalizacoes: { arranjoImagem?, alinhamento? }, historico: [{ estilo, origem, de, ate }] }
//
// Não guarda cor nem letra (essas são da marca, no marca.yaml): trocar de estilo nunca mexe na marca.
//
// Histórico (pasta `historico` da empresa), um arquivo por gravação, nunca por cima de outro:
//   estilo-<AAAA-MM-DD-HHMMSS>Z[-N].json         o estilo.json como estava antes da gravação, byte a byte
//   estilo-<AAAA-MM-DD-HHMMSS>Z[-N]-vazio.json   marca que antes da gravação não havia estilo escolhido
//   ...-antes-de-desfazer.json                   o estilo.json como estava antes de um "Desfazer"
// "Desfazer" volta a cópia mais recente que ainda não foi desfeita e acrescenta "-desfeito" ao nome dela (nada é
// apagado): desfazer de novo volta mais um passo.
//
// Linha de comando (para o agente; a raiz é FABRICA_RAIZ ou a pasta de sempre):
//   node _fabrica/core/escolha.js ler <codigo>
//   node _fabrica/core/escolha.js usar <codigo> <estilo> [--origem catalogo|proprio]
//   node _fabrica/core/escolha.js personalizar <codigo> [--arranjo-imagem <valor>] [--alinhamento <valor>]
//   node _fabrica/core/escolha.js desfazer <codigo>
// Saída: 0 = deu certo, 1 = recusa (mensagem em português), 2 = erro de uso ou erro inesperado.
'use strict';
const fs = require('fs');
const path = require('path');
const empresaMod = require('./empresa');
const estilosProprios = require('./estilos-proprios');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');

const VERSAO = 1;
const ORIGENS = ['catalogo', 'proprio'];
// Os arranjos da imagem no vídeo (os de pedido.rosto.layout dos modelos de Reels) e o alinhamento do carrossel.
const ARRANJOS = ['imagem-mini', 'rosto-mini', 'dividir', 'lado-a-lado', 'recorte'];
const ALINHAMENTOS = ['esquerda', 'centro'];
const PERSONALIZACOES = { arranjoImagem: ARRANJOS, alinhamento: ALINHAMENTOS };

const recusa = (erro) => Object.assign(new Error(erro), { recusaDoPedido: true, status: 400, code: 'RECUSA' });
const trecho = (v) => JSON.stringify(String(v).slice(0, 60));
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const NOME_SIMPLES = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const nomeSimples = (n) => typeof n === 'string' && NOME_SIMPLES.test(n) && !n.includes('..');
const dois = (n) => String(n).padStart(2, '0');
const carimboUtc = (d) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}-${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}`;
// O BOM é montado pelo código (nenhum caractere invisível fica escrito neste arquivo).
const BOM_INICIO = new RegExp('^' + String.fromCharCode(0xfeff));
const semBom = (s) => s.replace(BOM_INICIO, '');

// ---- A empresa e os estilos ----

function caminhosDa(r, codigo) {
  if (typeof codigo !== 'string' || codigo === '') throw recusa('Faltou a empresa. Escolha a empresa no seletor.');
  if (!empresaMod.listar(r).some((e) => e.codigo === codigo)) throw recusa(`A empresa ${trecho(codigo)} não existe nesta pasta. Escolha a empresa no seletor.`);
  return empresaMod.caminhos(codigo, r);
}

// O estilo.yaml de um estilo (do catálogo ou dos estilos próprios DESTA empresa), já lido, ou null. O estilo próprio passa
// pela mesma regra do molde e do catálogo (estilos-proprios.js): código simples, sem atalho, origem "referencias".
function lerEstiloYaml(r, c, id, origem) {
  if (origem === 'proprio') {
    try { return estilosProprios.lerEstilo(c.estilosProprios, id).y; } catch { return null; }
  }
  if (!nomeSimples(id)) return null;
  const pasta = path.join(r, '04-LABORATORIO-DE-DESIGN', 'estilos');
  const arq = path.join(pasta, id, 'estilo.yaml');
  if (!ehArquivo(arq)) return null;
  try {
    const y = lerYaml(semBom(fs.readFileSync(arq, 'utf8')));
    return ehObjeto(y) ? y : null;
  } catch { return null; }
}

// ---- O estilo.json ----

function quebrado(arq, detalhe) {
  return Object.assign(new Error(`O arquivo do estilo escolhido (${arq}) não está em um formato válido (${detalhe}). Corrija o arquivo; nada foi alterado.`), { code: 'JSON_INVALIDO', arquivo: arq });
}

// { bytes, dados } do estilo.json atual, ou null se ele não existe. Fora do formato: erro JSON_INVALIDO (quem chama
// não grava por cima).
function lerAtual(c) {
  const arq = c.estilo;
  let bytes;
  try { bytes = fs.readFileSync(arq); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  let j;
  try { j = JSON.parse(semBom(bytes.toString('utf8'))); } catch (e) { throw quebrado(arq, e.message); }
  if (!ehObjeto(j)) throw quebrado(arq, 'esperado um objeto');
  if (j.versao !== VERSAO) throw quebrado(arq, 'versão desconhecida');
  if (!nomeSimples(j.estilo)) throw quebrado(arq, '"estilo" não é um código simples');
  if (!ORIGENS.includes(j.origem)) throw quebrado(arq, '"origem" desconhecida');
  if (typeof j.escolhido !== 'string' || !Number.isFinite(Date.parse(j.escolhido))) throw quebrado(arq, '"escolhido" sem data');
  const p = j.personalizacoes === undefined ? {} : j.personalizacoes;
  if (!ehObjeto(p) || Object.entries(p).some(([k, v]) => !tem(PERSONALIZACOES, k) || !PERSONALIZACOES[k].includes(v))) throw quebrado(arq, '"personalizacoes" fora da lista');
  if (j.historico !== undefined && !Array.isArray(j.historico)) throw quebrado(arq, '"historico" não é uma lista');
  return { bytes, dados: { ...j, personalizacoes: p, historico: j.historico || [] } };
}

// Grava num temporário e troca de nome: se der problema no meio, o arquivo antigo continua inteiro.
function gravarAtomico(arq, conteudo) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, conteudo, { flag: 'wx' });
  try { fs.renameSync(tmp, arq); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* fica o temporário */ } throw e; }
}

// ---- O histórico ----

const ENTRADA = /^estilo-(\d{4}-\d{2}-\d{2}-\d{6})Z(?:-(\d+))?(-vazio|-antes-de-desfazer)?(-desfeito)?\.json$/;
function entradas(c) {
  let nomes = [];
  try { nomes = fs.readdirSync(c.historico); } catch { /* sem histórico ainda */ }
  return nomes.map((nome) => {
    const m = ENTRADA.exec(nome);
    return m && { nome, ts: m[1], n: m[2] ? Number(m[2]) : 1, tipo: m[3] || '', desfeito: !!m[4] };
  }).filter(Boolean);
}

// Guarda no histórico o estado atual (os bytes do estilo.json, ou a marca de "não havia") num lugar novo.
function guardar(c, atual, agora, tipo = '') {
  fs.mkdirSync(c.historico, { recursive: true });
  const ts = carimboUtc(agora);
  const ocupados = new Set(entradas(c).filter((e) => e.ts === ts).map((e) => e.n));
  const vazio = atual === null;
  const sufixo = vazio ? '-vazio' : tipo;
  const conteudo = vazio ? JSON.stringify({ vazio: true, nota: 'Antes desta gravação não havia estilo escolhido.' }, null, 2) + '\n' : atual.bytes;
  for (let n = 1; ; n++) {
    if (ocupados.has(n)) continue;
    const nome = `estilo-${ts}Z${n === 1 ? '' : `-${n}`}${sufixo}.json`;
    try {
      fs.writeFileSync(path.join(c.historico, nome), conteudo, { flag: 'wx' }); // nunca por cima
      return nome;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

// Guarda o estado atual no histórico e grava o novo estilo.json. Se a gravação falhar (arquivo preso por outro
// programa, disco), a cópia recém-guardada ganha "-desfeito" no nome (ou é removida), para não gastar um passo do
// "Desfazer" com uma gravação que não aconteceu.
function gravarComHistorico(c, atual, agora, conteudo) {
  const nome = guardar(c, atual, agora);
  try {
    gravarAtomico(c.estilo, conteudo);
  } catch (e) {
    const arq = path.join(c.historico, nome);
    try { fs.renameSync(arq, arq.replace(/\.json$/, '-desfeito.json')); } catch { try { fs.unlinkSync(arq); } catch { /* fica */ } }
    throw e;
  }
}

// ---- As operações ----

// null, ou { estilo, origem, nome, escolhido, personalizacoes }.
function ler(r, codigo) {
  const c = caminhosDa(r, codigo);
  const atual = lerAtual(c);
  if (!atual) return null;
  const d = atual.dados;
  const y = lerEstiloYaml(r, c, d.estilo, d.origem);
  const nome = y && typeof y.nome === 'string' && y.nome.trim() ? y.nome.trim() : d.estilo;
  return { estilo: d.estilo, origem: d.origem, nome, escolhido: d.escolhido, personalizacoes: { ...d.personalizacoes } };
}

// Escolhe o estilo `id` (do catálogo, ou dos estilos próprios desta empresa com origem 'proprio').
// Devolve { estilo, anterior }. `agora` existe para os testes.
function usar(r, codigo, id, { origem = 'catalogo', agora = new Date() } = {}) {
  const c = caminhosDa(r, codigo);
  if (!ORIGENS.includes(origem)) throw recusa('Não entendi de onde vem este estilo. Escolha um estilo da lista.');
  if (!nomeSimples(id) || !lerEstiloYaml(r, c, id, origem)) {
    throw recusa(origem === 'proprio'
      ? `O estilo ${trecho(id)} não está entre os estilos desta empresa. Escolha um estilo da lista.`
      : `O estilo ${trecho(id)} não existe na biblioteca. Escolha um estilo da lista.`);
  }
  const atual = lerAtual(c); // quebrado: para aqui, nada gravado
  const historico = atual ? [...atual.dados.historico, { estilo: atual.dados.estilo, origem: atual.dados.origem, de: atual.dados.escolhido, ate: agora.toISOString() }] : [];
  const novo = { versao: VERSAO, estilo: id, origem, escolhido: agora.toISOString(), personalizacoes: {}, historico };
  gravarComHistorico(c, atual, agora, JSON.stringify(novo, null, 2) + '\n');
  return { estilo: id, anterior: atual ? atual.dados.estilo : null };
}

// Muda os detalhes do estilo escolhido: { arranjoImagem?, alinhamento? }, cada um da lista fechada, ou null para
// voltar ao do estilo. O que não vem fica como está. Devolve { estilo, personalizacoes }.
function personalizar(r, codigo, mudancas, { agora = new Date() } = {}) {
  const c = caminhosDa(r, codigo);
  if (!ehObjeto(mudancas) || !Object.keys(mudancas).length) throw recusa('Escolha um dos detalhes do estilo para mudar.');
  for (const [k, v] of Object.entries(mudancas)) {
    if (!tem(PERSONALIZACOES, k)) throw recusa(`O detalhe ${trecho(k)} não existe. Escolha entre os detalhes da tela.`);
    if (v !== null && !PERSONALIZACOES[k].includes(v)) throw recusa(`O valor ${trecho(v)} não serve para este detalhe. Escolha uma das opções da tela.`);
  }
  const atual = lerAtual(c);
  if (!atual) throw recusa('Escolha um estilo antes de personalizar.');
  const p = { ...atual.dados.personalizacoes };
  for (const [k, v] of Object.entries(mudancas)) { if (v === null) delete p[k]; else p[k] = v; }
  const novo = { ...atual.dados, personalizacoes: p };
  gravarComHistorico(c, atual, agora, JSON.stringify(novo, null, 2) + '\n');
  return { estilo: novo.estilo, personalizacoes: { ...p } };
}

// Volta o estado anterior à última gravação ainda não desfeita. Devolve { restaurado } (o estilo que voltou, ou null
// quando antes não havia estilo escolhido).
function desfazer(r, codigo, { agora = new Date() } = {}) {
  const c = caminhosDa(r, codigo);
  const atual = lerAtual(c); // quebrado: para aqui, nada gravado
  const candidatos = entradas(c).filter((e) => !e.desfeito && e.tipo !== '-antes-de-desfazer')
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.n - b.n));
  const alvo = candidatos[candidatos.length - 1];
  if (!alvo) throw recusa('Não há nada para desfazer.');
  const arqAlvo = path.join(c.historico, alvo.nome);
  let restaurado = null;
  let bytes = null;
  if (alvo.tipo !== '-vazio') {
    bytes = fs.readFileSync(arqAlvo);
    let j;
    try { j = JSON.parse(semBom(bytes.toString('utf8'))); } catch { j = null; }
    if (!ehObjeto(j) || !nomeSimples(j.estilo)) throw quebrado(arqAlvo, 'a cópia guardada não é um estilo escolhido');
    restaurado = j.estilo;
  }
  if (atual) guardar(c, atual, agora, '-antes-de-desfazer');
  if (bytes) gravarAtomico(c.estilo, bytes);
  else if (atual) fs.unlinkSync(c.estilo); // antes não havia estilo; o de agora ficou guardado no histórico
  fs.renameSync(arqAlvo, arqAlvo.replace(/\.json$/, '-desfeito.json'));
  return { restaurado };
}

// ---------- linha de comando ----------

const USO = [
  'Uso:',
  '  node _fabrica/core/escolha.js ler <codigo>                         mostra o estilo escolhido (JSON, ou null)',
  '  node _fabrica/core/escolha.js usar <codigo> <estilo> [--origem catalogo|proprio]',
  '  node _fabrica/core/escolha.js personalizar <codigo> [--arranjo-imagem <valor>] [--alinhamento <valor>]',
  `                                 arranjo: ${ARRANJOS.join(', ')}; alinhamento: ${ALINHAMENTOS.join(', ')}; "nenhum" volta ao do estilo`,
  '  node _fabrica/core/escolha.js desfazer <codigo>                    volta a escolha anterior',
].join('\n');

class ErroDeUso extends Error {}

// Separa posicionais e opções (--nome valor). Opção desconhecida, repetida ou sem valor é erro de uso.
function separar(args, conhecidas) {
  const pos = [];
  const op = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    if (!conhecidas.includes(a)) throw new ErroDeUso(`Opção desconhecida: ${a}`);
    if (tem(op, a)) throw new ErroDeUso(`A opção ${a} apareceu mais de uma vez.`);
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new ErroDeUso(`Faltou o valor depois de ${a}.`);
    op[a] = args[++i];
  }
  return { pos, op };
}

function principal(args) {
  const r = empresaMod.raiz();
  const [cmd, ...resto] = args;
  switch (cmd) {
    case 'ler': {
      const { pos } = separar(resto, []);
      if (pos.length !== 1) throw new ErroDeUso('Informe só o código da empresa.');
      console.log(JSON.stringify(ler(r, pos[0]), null, 2));
      return 0;
    }
    case 'usar': {
      const { pos, op } = separar(resto, ['--origem']);
      if (pos.length !== 2) throw new ErroDeUso('Informe o código da empresa e o do estilo.');
      const res = usar(r, pos[0], pos[1], { origem: op['--origem'] || 'catalogo' });
      const atual = ler(r, pos[0]);
      console.log(`Estilo escolhido: ${atual.nome}${res.anterior ? ` (antes: ${res.anterior})` : ''}.`);
      return 0;
    }
    case 'personalizar': {
      const { pos, op } = separar(resto, ['--arranjo-imagem', '--alinhamento']);
      if (pos.length !== 1) throw new ErroDeUso('Informe só o código da empresa e as opções.');
      const mudancas = {};
      const valor = (v) => (v === 'nenhum' ? null : v);
      if (tem(op, '--arranjo-imagem')) mudancas.arranjoImagem = valor(op['--arranjo-imagem']);
      if (tem(op, '--alinhamento')) mudancas.alinhamento = valor(op['--alinhamento']);
      if (!Object.keys(mudancas).length) throw new ErroDeUso('Informe pelo menos um detalhe para mudar.');
      const res = personalizar(r, pos[0], mudancas);
      console.log(`Detalhes do estilo: ${JSON.stringify(res.personalizacoes)}.`);
      return 0;
    }
    case 'desfazer': {
      const { pos } = separar(resto, []);
      if (pos.length !== 1) throw new ErroDeUso('Informe só o código da empresa.');
      const res = desfazer(r, pos[0]);
      console.log(res.restaurado ? `Voltou o estilo ${res.restaurado}.` : 'Voltou para nenhum estilo escolhido.');
      return 0;
    }
    default:
      throw new ErroDeUso(cmd ? `Comando desconhecido: ${cmd}` : '');
  }
}

if (require.main === module) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    if (e instanceof ErroDeUso) {
      console.error((e.message ? e.message + '\n' : '') + USO);
      process.exitCode = 2;
    } else if (e.recusaDoPedido || ['JSON_INVALIDO', 'EMPRESA_DESCONHECIDA', 'EMPRESA_NAO_ESCOLHIDA'].includes(e.code)) {
      console.error('RECUSADO  ' + e.message);
      process.exitCode = 1;
    } else {
      console.error('ERRO  inesperado: ' + e.message);
      process.exitCode = 2;
    }
  }
}

module.exports = { ORIGENS, ARRANJOS, ALINHAMENTOS, ler, usar, personalizar, desfazer };
