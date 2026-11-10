#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const EXTENSOES = new Set([
  '.md', '.yaml', '.yml', '.json', '.js', '.ts', '.html', '.css',
  '.txt', '.csv', '.bat', '.command', '.vbs',
]);
const PASTAS_IGNORADAS = new Set(['.git', 'node_modules', '.superpowers']);
const LIMITE_BYTES = 1024 * 1024;
const AT_RULES_CSS = new Set([
  'media', 'import', 'font-face', 'keyframes', 'charset', 'supports', 'page', 'layer',
]);

const FONTES_COMUNS = [
  'Inter', 'Roboto', 'Montserrat', 'Poppins', 'Playfair Display', 'Lora',
  'Open Sans', 'Lato', 'Helvetica', 'Arial', 'Georgia', 'Times New Roman',
  'Raleway', 'Nunito', 'Merriweather', 'Oswald', 'Bebas Neue', 'Space Grotesk',
  'DM Sans', 'DM Serif', 'Manrope', 'Sora', 'Work Sans', 'Fira Sans', 'Fira Code',
  'IBM Plex', 'JetBrains Mono', 'Source Sans', 'Source Serif', 'Cormorant',
  'Libre Baskerville', 'Archivo', 'Anton', 'Barlow', 'Rubik', 'Outfit',
  'Urbanist', 'Syne', 'Fraunces', 'Instrument Serif',
];

const LIM_ANTES = '(?<![\\p{L}\\p{N}_])';
const LIM_DEPOIS = '(?![\\p{L}\\p{N}_])';

// Sem acento e sem caracteres invisíveis (categoria Cf: hífen suave, espaço de largura zero, marcas de direção):
// "Bo<invisível>real" aparece para quem lê como "Boreal" e tem de ser achado como tal.
const semAcento = (s) => s.normalize('NFD').replace(/[\p{M}\p{Cf}]/gu, '');
const semInvisivel = (s) => s.replace(/\p{Cf}/gu, '');
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const VERIFICACOES = [
  { categoria: 'hex', regex: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})(?![0-9a-zA-Z])/g },
  {
    categoria: 'handle',
    regex: /(?<![\w@./])@[A-Za-z0-9_][A-Za-z0-9_.-]*[A-Za-z0-9_](?![\w/])/g,
    aceitar: (achado) => AT_RULES_CSS.has(achado.slice(1)),
  },
  { categoria: 'url', regex: /https?:\/\/[^\s)>\]"']+/g },
  { categoria: 'email', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  {
    categoria: 'telefone',
    regex: /\(\d{2}\)\s?9?\d{4}-?\d{4}|(?<!\d)9\d{4}-\d{4}(?!\d)|\+55\s?\d{2}\s?9?\d{4}-?\d{4}/g,
  },
  { categoria: 'documento', regex: /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/g },
  { categoria: 'horario', regex: /(?<![\w:])(?:[01]?\d|2[0-3])h(?:[0-5]\d)?(?!\w)/g },
  {
    categoria: 'dia-da-semana',
    regex: /\b(?:segunda|ter[cç]a|quarta|quinta|sexta)-feira\b|\b(?:s[aá]bado|domingo)s?\b/gi,
  },
  {
    categoria: 'fonte',
    regex: new RegExp(
      `${LIM_ANTES}(?:${FONTES_COMUNS.map((f) => escapar(f).replace(/ /g, '\\s+')).join('|')})${LIM_DEPOIS}`,
      'gu',
    ),
  },
];

const CATEGORIAS_ISENTAS_EM_EXEMPLO = new Set(['hex', 'handle']);

function ajuda() {
  console.log(`Validador anti-vazamento

Procura, nos arquivos de texto de uma pasta, valores que pertencem a uma
empresa e não podem estar na Fábrica: cores em hexadecimal, nomes de fonte,
@handles, URLs, e-mails, telefones, CPF/CNPJ, horários, dias da semana e
os termos da lista privada de cada empresa.

Uso:
  node validar.js [pasta] [--termos arquivo]...
  node validar.js --empresa <codigo> [pasta] [--raiz <raiz da Fábrica>]

  pasta            pasta a verificar (padrão: a raiz da Fábrica; com
                   --empresa, as pastas de dados da empresa)
  --termos arquivo lista privada de termos proibidos; pode repetir.
                   Também lida da variável FABRICA_TERMOS (separada por
                   '${path.delimiter}').
  --empresa codigo confere se o conteúdo dessa empresa cita nome, conta ou
                   termo de OUTRA empresa da Fábrica (só termos; as
                   checagens genéricas ficam desligadas)
  --raiz pasta     raiz da Fábrica onde estão as empresas (só com --empresa;
                   padrão: FABRICA_RAIZ ou a raiz desta Fábrica)

Saída: 0 = limpo, 1 = achados, 2 = erro de uso.`);
}

function lerArgumentos(argv) {
  const opcoes = { raiz: null, termos: [], ajuda: false, empresa: null, fabrica: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--termos') {
      if (!argv[i + 1]) throw new Error('--termos precisa de um caminho de arquivo');
      opcoes.termos.push(argv[++i]);
    } else if (a === '--empresa') {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('--empresa precisa do código da empresa');
      opcoes.empresa = argv[++i];
    } else if (a === '--raiz') {
      if (!argv[i + 1]) throw new Error('--raiz precisa do caminho da raiz da Fábrica');
      opcoes.fabrica = argv[++i];
    } else if (a === '--ajuda' || a === '-h') {
      opcoes.ajuda = true;
    } else if (a.startsWith('--')) {
      throw new Error(`opção desconhecida: ${a}`);
    } else if (opcoes.raiz) {
      throw new Error('informe só uma pasta');
    } else {
      opcoes.raiz = a;
    }
  }
  if (opcoes.fabrica && !opcoes.empresa) throw new Error('--raiz só vale com --empresa');
  if (opcoes.empresa && opcoes.termos.length) throw new Error('--termos não vale com --empresa: os termos vêm das outras empresas');
  if (process.env.FABRICA_TERMOS && !opcoes.empresa) {
    opcoes.termos.push(...process.env.FABRICA_TERMOS.split(path.delimiter).filter(Boolean));
  }
  return opcoes;
}

// Uma linha da lista de termos vira { texto, regex }. Vazia, comentário (//) ou só "cs:" não é termo: devolve null.
function compilarTermo(bruta) {
  const linha = bruta.trim();
  if (!linha || linha.startsWith('//')) return null;
  const sensivel = linha.startsWith('cs:');
  const texto = sensivel ? linha.slice(3).trim() : linha;
  if (!texto) return null;
  const padrao = LIM_ANTES + escapar(semAcento(texto)).replace(/ /g, '\\s+') + LIM_DEPOIS;
  return { texto, regex: new RegExp(padrao, sensivel ? 'gu' : 'giu') };
}

function carregarTermos(arquivos) {
  const termos = [];
  for (const arquivo of arquivos) {
    if (!fs.existsSync(arquivo)) throw new Error(`lista de termos não encontrada: ${arquivo}`);
    for (const bruta of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const termo = compilarTermo(bruta);
      if (termo) termos.push(termo);
    }
  }
  return termos;
}

function carregarIsentos() {
  const arquivo = path.join(__dirname, 'isentos.json');
  return fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, 'utf8')) : {};
}

function listarArquivos(raiz) {
  const achados = [];
  const visitar = (pasta) => {
    for (const entrada of fs.readdirSync(pasta, { withFileTypes: true })) {
      const completo = path.join(pasta, entrada.name);
      if (entrada.isDirectory()) {
        if (!PASTAS_IGNORADAS.has(entrada.name)) visitar(completo);
      } else if (EXTENSOES.has(path.extname(entrada.name).toLowerCase())) {
        if (path.resolve(completo) !== __filename && fs.statSync(completo).size <= LIMITE_BYTES) {
          achados.push(completo);
        }
      }
    }
  };
  visitar(raiz);
  return achados;
}

function varrer(texto, regex, original = texto) {
  regex.lastIndex = 0;
  return [...texto.matchAll(regex)].map((m) => original.slice(m.index, m.index + m[0].length));
}

// Com soTermos, só os termos valem: as checagens genéricas (hex, fonte e as outras) ficam desligadas e os isentos
// não se aplicam. É o modo da conferência entre empresas.
function verificarArquivo(arquivo, raiz, termos, isentos, { soTermos = false } = {}) {
  const relativo = path.relative(raiz, arquivo).split(path.sep).join('/');
  const isento = isentos[relativo] || [];
  const ehExemplo = path.basename(arquivo).includes('.exemplo.');
  const permitido = (categoria) => (soTermos
    ? categoria === 'termo-privado'
    : !(isento.includes('*') || isento.includes(categoria)) &&
      !(ehExemplo && CATEGORIAS_ISENTAS_EM_EXEMPLO.has(categoria)));
  const achados = [];
  const registrar = (linha, categoria, achado, trecho, termo) =>
    achados.push({ arquivo: relativo, linha, categoria, achado, trecho, termo: termo && termo.texto });

  if (permitido('termo-privado')) {
    const caminho = semAcento(relativo);
    for (const termo of termos) {
      for (const achado of varrer(caminho, termo.regex, relativo)) registrar(0, 'termo-privado', achado, '(no nome do arquivo)', termo);
    }
  }

  const linhas = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
  linhas.forEach((original, indice) => {
    const trecho = original.trim().slice(0, 110);
    const normal = semAcento(original);
    const visivel = semInvisivel(original); // o achado citado sai como a pessoa o lê, sem os invisíveis
    for (const v of VERIFICACOES) {
      if (!permitido(v.categoria)) continue;
      for (const achado of varrer(original, v.regex)) {
        if (!(v.aceitar && v.aceitar(achado))) registrar(indice + 1, v.categoria, achado, trecho);
      }
    }
    if (permitido('termo-privado')) {
      for (const termo of termos) {
        for (const achado of varrer(normal, termo.regex, visivel)) registrar(indice + 1, 'termo-privado', achado, trecho, termo);
      }
    }
  });
  return achados;
}

// Linhas de um arquivo de termos (sem vazias e sem comentário), ou nenhuma se o arquivo não existe.
function lerLinhasDeTermos(arquivo) {
  if (!fs.existsSync(arquivo)) return [];
  return fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('//'));
}

const chaveDoTermo = (texto) => semAcento(texto).toLowerCase();

// Os arquivos conferíveis de um caminho: os de dentro, se é pasta; ele mesmo, se é um arquivo de tipo conhecido.
function arquivosDe(caminho) {
  if (fs.statSync(caminho).isDirectory()) return listarArquivos(caminho);
  return EXTENSOES.has(path.extname(caminho).toLowerCase()) && fs.statSync(caminho).size <= LIMITE_BYTES ? [caminho] : [];
}

// Conferência entre empresas: o conteúdo da empresa conferida não pode citar nome, conta ou termo de outra empresa.
// Devolve o código de saída: 0 = limpo, 1 = achados, 2 = erro de uso.
function conferirEmpresa(opcoes) {
  const empresa = require('../../_fabrica/core/empresa');
  const fabrica = path.resolve(opcoes.fabrica || empresa.raiz());
  const lista = empresa.listar(fabrica);
  const alvo = lista.find((e) => e.codigo === opcoes.empresa);
  if (!alvo) {
    console.error(`Erro: a empresa "${opcoes.empresa}" não existe em ${fabrica}. Empresas: ${lista.length ? lista.map((e) => e.codigo).join(', ') : 'nenhuma'}.`);
    return 2;
  }
  if (lista.length < 2) {
    console.log('Só há uma empresa: nada a cruzar.');
    return 0;
  }
  const c = empresa.caminhos(alvo.codigo, fabrica);

  // Termos das outras empresas, cada um com a lista de quem o usa; sem os que a empresa conferida declarou compartilhados.
  const compartilhados = new Set(lerLinhasDeTermos(c.termosCompartilhados).map(compilarTermo).filter(Boolean).map((t) => chaveDoTermo(t.texto)));
  const donos = new Map();
  let liberados = 0;
  const semTermo = [];
  for (const outra of lista.filter((e) => e.codigo !== alvo.codigo)) {
    const daOutra = empresa.termos(outra.codigo, fabrica);
    if (!daOutra.length) semTermo.push(outra);
    for (const linha of daOutra) {
      const termo = compilarTermo(linha);
      if (!termo) continue;
      if (compartilhados.has(chaveDoTermo(termo.texto))) {
        liberados++;
        continue;
      }
      const chave = termo.regex.flags.includes('i') ? chaveDoTermo(termo.texto) : `cs:${termo.texto}`;
      if (!donos.has(chave)) donos.set(chave, { termo, empresas: [] });
      donos.get(chave).empresas.push(outra);
    }
  }
  const termos = [...donos.values()].map((d) => d.termo);
  const donosDe = (texto) => {
    const d = [...donos.values()].find((x) => x.termo.texto === texto);
    return d ? d.empresas.map((e) => `${e.nome} (${e.codigo})`).join(', ') : 'outra empresa';
  };

  // Sem pasta: as pastas de dados da empresa (as que existem). Com pasta: só ela.
  let caminhos;
  if (opcoes.raiz) {
    const pasta = path.resolve(opcoes.raiz);
    if (!fs.existsSync(pasta)) {
      console.error(`Erro: pasta não encontrada: ${pasta}`);
      return 2;
    }
    caminhos = [pasta];
  } else {
    // Linhas: as de linhas/ e, na gaveta, as subpastas de saidas/ e memoria/. Nome que não serve para linha (pasta
    // "_modelo", por exemplo) não entra por linha; na gaveta, as pastas inteiras de saídas e memória já o cobrem.
    const linhas = new Set();
    const subpastas = (pasta) => (pasta && fs.existsSync(pasta) ? fs.readdirSync(pasta, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : []);
    [path.join(fabrica, 'linhas'), c.saidasRaiz, c.memoriaRaiz].forEach((p) => subpastas(p).forEach((l) => linhas.add(l)));
    const validas = [...linhas].filter((l) => /^[a-z0-9][a-z0-9_-]*$/.test(l));
    const porLinha = validas.flatMap((l) => [c.saidas(l), c.memoria(l), c.dadosLinha(l), c.estadoLinha(l), c.investigacoes(l)]);
    const daEmpresa = [c.saidasRaiz, c.memoriaRaiz, c.laboratorio, c.cronograma, c.pedidos, c.perfil, c.decisoes, c.estiloDeVideo,
      c.estilosProprios, c.previas, c.historico, c.estilo, c.intencao];
    caminhos = porLinha.concat(daEmpresa).filter(Boolean)
      .map((p) => path.resolve(p)).filter((p, i, todos) => todos.indexOf(p) === i && fs.existsSync(p));
  }
  const arquivos = [...new Set(caminhos.flatMap(arquivosDe))];
  const achados = arquivos.flatMap((a) => verificarArquivo(a, fabrica, termos, {}, { soTermos: true }));

  console.log(`CONFERÊNCIA ENTRE EMPRESAS · ${alvo.nome} (${alvo.codigo})`);
  console.log(`Raiz: ${fabrica}`);
  console.log(`Arquivos lidos: ${arquivos.length}`);
  console.log(`Termos de outras empresas: ${termos.length} (de ${lista.length - 1} empresa(s))${liberados ? `; ${liberados} liberado(s) por termos-compartilhados.txt` : ''}`);
  for (const e of semTermo) {
    console.log(`AVISO: a empresa ${e.nome} (${e.codigo}) não tem nenhum termo (nome no índice, marca, perfil ou termos.txt): nada dela foi procurado.`);
  }
  console.log('');
  for (const f of achados) {
    const onde = f.linha ? `${f.arquivo}:${f.linha}` : f.arquivo;
    console.log(`${onde}  "${f.achado}"  é termo de ${donosDe(f.termo)}`);
    console.log(`    ${f.trecho}`);
  }
  console.log(achados.length
    ? `\nRESULTADO: ${achados.length} termo(s) de outra empresa. Não entregue.`
    : '\nRESULTADO: nada de outra empresa.');
  return achados.length ? 1 : 0;
}

function main() {
  let opcoes;
  try {
    opcoes = lerArgumentos(process.argv.slice(2));
  } catch (e) {
    console.error(`Erro: ${e.message}\n`);
    ajuda();
    process.exit(2);
  }
  if (opcoes.ajuda) return ajuda();

  if (opcoes.empresa) {
    try {
      process.exitCode = conferirEmpresa(opcoes);
    } catch (e) {
      console.error(`Erro: ${e.message}`);
      process.exitCode = 2;
    }
    return;
  }

  const raiz = path.resolve(opcoes.raiz || path.join(__dirname, '..', '..'));
  if (!fs.existsSync(raiz) || !fs.statSync(raiz).isDirectory()) {
    console.error(`Erro: pasta não encontrada: ${raiz}`);
    process.exit(2);
  }

  let termos;
  try {
    termos = carregarTermos(opcoes.termos);
  } catch (e) {
    console.error(`Erro: ${e.message}`);
    process.exit(2);
  }

  const isentos = carregarIsentos();
  const arquivos = listarArquivos(raiz);
  const achados = arquivos.flatMap((a) => verificarArquivo(a, raiz, termos, isentos));

  console.log('VALIDADOR ANTI-VAZAMENTO');
  console.log(`Pasta: ${raiz}`);
  console.log(`Arquivos lidos: ${arquivos.length}`);
  console.log(
    opcoes.termos.length
      ? `Termos privados: ${termos.length} (de ${opcoes.termos.length} lista(s))`
      : 'Termos privados: NENHUMA LISTA. Nomes, marcas e termos de empresa NÃO foram verificados; só as checagens genéricas rodaram.',
  );
  console.log('');

  for (const f of achados) {
    const onde = f.linha ? `${f.arquivo}:${f.linha}` : f.arquivo;
    console.log(`${onde}  [${f.categoria}]  "${f.achado}"`);
    console.log(`    ${f.trecho}`);
  }

  const emQuantos = new Set(achados.map((f) => f.arquivo)).size;
  console.log(
    achados.length
      ? `\nRESULTADO: ${achados.length} achado(s) em ${emQuantos} arquivo(s). Corrija antes de gravar na Fábrica.`
      : '\nRESULTADO: nenhum vazamento encontrado.',
  );
  process.exit(achados.length ? 1 : 0);
}

if (require.main === module) main();

module.exports = { compilarTermo, verificarArquivo, listarArquivos };
