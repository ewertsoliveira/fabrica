#!/usr/bin/env node
// Leitor de empresas: cada empresa tem a sua gaveta em empresas/<codigo>/. Aqui ficam a lista de empresas, a empresa
// ativa e onde cada arquivo de cada empresa mora. Uma pasta antiga (marca em 06-MARCA-E-FOTOS, linhas em linhas/)
// continua funcionando como a empresa "principal", na disposição "legado": nada é movido, apagado ou sobrescrito.
// Só usa o Node. Todas as funções aceitam `r`, a raiz da Fábrica (o padrão é a pasta de sempre).
//
//   node _fabrica/core/empresa.js listar
//   node _fabrica/core/empresa.js ativa
//   node _fabrica/core/empresa.js ativar <codigo>
//   node _fabrica/core/empresa.js criar <codigo> "<nome>"
//   node _fabrica/core/empresa.js caminhos [<codigo>] [--linha <l>] [--json]
//   node _fabrica/core/empresa.js migrar <args...>   (atalho do migrar.js)
//
// Saída: 0 = deu certo, 1 = recusa (código inválido, nenhuma empresa, empresa não escolhida, desconhecida ou já
// existente, arquivo de controle quebrado), 2 = erro de uso ou erro inesperado (só a mensagem, sem a pilha).
'use strict';
const fs = require('fs');
const path = require('path');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');

const CODIGO = /^[a-z0-9][a-z0-9-]{1,40}$/;
const LINHA = /^[a-z0-9][a-z0-9_-]*$/;
// Só a linha de comando usa: mostra o caminho de cada linha com "<linha>" no lugar do nome.
const MOLDE_LINHA = Symbol('linha');
const LEGADO = 'principal';
const NOME_PADRAO = 'Sua empresa';
const NAO_CONFIGURADO = '<!-- NÃO CONFIGURADO -->';

// A pasta da empresa. FABRICA_RAIZ existe para os testes e para rodar fora do lugar de sempre.
function raiz() {
  return process.env.FABRICA_RAIZ || path.resolve(__dirname, '..', '..');
}

function erro(code, mensagem, extra) {
  const e = new Error(mensagem);
  e.code = code;
  return Object.assign(e, extra);
}

// Marca "arquivo ausente" para quem precisa distinguir a falta do arquivo de um `null` escrito nele.
const AUSENTE = Symbol('ausente');

// Arquivo ausente devolve o padrão. JSON quebrado (vírgula sobrando, editado à mão) lança erro com código
// JSON_INVALIDO: quem chama avisa a pessoa e NÃO grava por cima.
function lerJson(arq, padrao) {
  let texto;
  try {
    texto = fs.readFileSync(arq, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return padrao;
    throw e;
  }
  try {
    return JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch (e) {
    throw erro('JSON_INVALIDO', `O arquivo ${arq} não está em um formato válido (${e.message}). Corrija o arquivo; nada foi alterado.`, { arquivo: arq });
  }
}

// Grava num arquivo temporário e troca de nome: se der problema no meio, o arquivo antigo continua inteiro.
function gravarJson(arq, valor) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arq);
}

const lerTexto = (arq) => {
  try {
    return fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, '');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
};

const arqIndice = (r) => path.join(r, 'empresas', 'indice.json');
const arqAtiva = (r) => path.join(r, 'empresas', 'ativa.json');
const arqMarcaLegado = (r) => path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml');
const arqPerfilLegado = (r) => path.join(r, '_fabrica', '_memoria', 'empresa.md');

function hoje() {
  const d = new Date();
  const dois = (v) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

// Os arquivos dos painéis da pasta antiga: se existem, a pasta tem dados de uma empresa antiga, mesmo sem marca nem perfil.
const arqsPainelLegado = (r) => [
  path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'),
  path.join(r, '04-LABORATORIO-DE-DESIGN', 'dados', 'aprovacoes.json'),
  path.join(r, '03-CRONOGRAMA', 'dados', 'posts.json'),
];

// Sem indice.json: existe uma empresa legado virtual quando há marca.yaml, um perfil já configurado ou dados de painel
// da pasta antiga (assim a segunda empresa criada não esconde as peças e posts que já estavam lá).
// O nome vem do marca.yaml; sem ele (ou sem nome), "Sua empresa".
function legadoVirtual(r) {
  const perfil = lerTexto(arqPerfilLegado(r));
  const perfilConfigurado = perfil !== null && perfil.trim() !== '' && !perfil.includes(NAO_CONFIGURADO);
  const marca = lerTexto(arqMarcaLegado(r));
  const temDadosDePainel = arqsPainelLegado(r).some((a) => fs.existsSync(a));
  if (marca === null && !perfilConfigurado && !temDadosDePainel) return null;
  let nome = NOME_PADRAO;
  if (marca !== null) {
    try {
      const n = (lerYaml(marca).empresa || {}).nome;
      if (typeof n === 'string' && n.trim() !== '') nome = n.trim();
    } catch { /* marca.yaml com erro de formato: listar não reclama, usa o nome padrão */ }
  }
  return { codigo: LEGADO, nome, disposicao: 'legado', virtual: true };
}

// Lê o indice.json (AUSENTE se ele não existe). Qualquer coisa que não seja { "empresas": [ ... ] } com entradas
// válidas lança JSON_INVALIDO citando a entrada: um índice editado à mão nunca faz uma empresa virar outra
// (gaveta lida como legado, código que sai da pasta) e nunca é regravado. Campos a mais numa entrada (por exemplo
// `migrada: { em, carimbo }`, gravado quando a pasta antiga passa para a pasta da empresa) são aceitos e preservados.
function lerIndice(r) {
  const arq = arqIndice(r);
  const indice = lerJson(arq, AUSENTE);
  if (indice === AUSENTE) return AUSENTE;
  const invalido = (detalhe) => erro('JSON_INVALIDO', `O arquivo ${arq} não está em um formato válido (${detalhe}). Corrija o arquivo; nada foi alterado.`, { arquivo: arq });
  if (indice === null || typeof indice !== 'object' || Array.isArray(indice) || !Array.isArray(indice.empresas)) {
    throw invalido('esperado { "empresas": [ ... ] }');
  }
  const vistos = new Set();
  indice.empresas.forEach((e, i) => {
    const cita = (motivo) => invalido(`a entrada ${i + 1}, ${JSON.stringify(e)}, ${motivo}`);
    if (e === null || typeof e !== 'object' || Array.isArray(e)) throw cita('devia ser { "codigo", "nome", "disposicao" }');
    if (typeof e.codigo !== 'string' || !(CODIGO.test(e.codigo) || e.codigo === LEGADO)) throw cita('tem um "codigo" inválido (só letras minúsculas sem acento, números e "-")');
    if (e.disposicao !== 'gaveta' && e.disposicao !== 'legado') throw cita('precisa de "disposicao": "gaveta" ou "legado"');
    if (e.disposicao === 'legado' && e.codigo !== LEGADO) throw cita(`só a empresa "${LEGADO}" pode ter "disposicao": "legado"`);
    if (typeof e.nome !== 'string') throw cita('precisa de um "nome" em texto');
    if (vistos.has(e.codigo)) throw cita(`repete o código "${e.codigo}"`);
    vistos.add(e.codigo);
  });
  return indice;
}

function listar(r = raiz()) {
  const indice = lerIndice(r);
  if (indice === AUSENTE) {
    const virtual = legadoVirtual(r);
    return virtual ? [virtual] : [];
  }
  return indice.empresas;
}

// Ordem: FABRICA_EMPRESA, empresas/ativa.json, a única empresa, nenhuma (null). Uma escolha que não está na lista
// recusa; nunca cai em outra empresa sem avisar.
function ativa(r = raiz()) {
  const lista = listar(r);
  const codigos = lista.map((e) => e.codigo);
  const confere = (codigo, origem) => {
    if (!codigos.includes(codigo)) {
      throw erro('EMPRESA_DESCONHECIDA', `A empresa "${codigo}" (${origem}) não existe nesta pasta. Empresas: ${codigos.length ? codigos.join(', ') : 'nenhuma'}.`);
    }
    return codigo;
  };
  const doAmbiente = (process.env.FABRICA_EMPRESA || '').trim();
  if (doAmbiente) return confere(doAmbiente, 'variável FABRICA_EMPRESA');
  const escolhida = lerJson(arqAtiva(r), null);
  if (escolhida !== null) {
    if (typeof escolhida !== 'object' || typeof escolhida.empresa !== 'string' || escolhida.empresa === '') {
      throw erro('JSON_INVALIDO', `O arquivo ${arqAtiva(r)} não está em um formato válido (esperado { "empresa": "<codigo>" }). Corrija o arquivo; nada foi alterado.`, { arquivo: arqAtiva(r) });
    }
    return confere(escolhida.empresa, 'empresas/ativa.json');
  }
  if (lista.length === 1) return lista[0].codigo;
  if (lista.length === 0) return null;
  throw erro('EMPRESA_NAO_ESCOLHIDA', `Há ${lista.length} empresas (${codigos.join(', ')}) e nenhuma foi escolhida. Escolha uma com: node _fabrica/core/empresa.js ativar <codigo>`);
}

// O nome de uma linha vira pasta: só letras minúsculas sem acento, números, "_" e "-" (nada de "..", barra ou vazio).
function conferirLinha(linha) {
  if (linha === MOLDE_LINHA) return '<linha>';
  if (typeof linha !== 'string' || !LINHA.test(linha)) {
    throw erro('LINHA_INVALIDA', `O nome de linha ${JSON.stringify(linha)} não serve: use só letras minúsculas sem acento, números, "_" e "-", começando por letra ou número.`);
  }
  return linha;
}
const porLinha = (montar) => (linha) => montar(conferirLinha(linha));

// As chaves de caminhos(), as de valor e as de função por linha. A mudança da pasta antiga (migrar.js) classifica cada
// uma; o teste de guarda dela reprova se aparecer chave nova sem classificação.
const CHAVES_DE_CAMINHO = Object.freeze([
  'gaveta', 'perfil', 'marca', 'pastaMarca', 'estiloDeVideo', 'estilosProprios', 'referencias', 'laboratorio',
  'cronograma', 'publicacoes', 'estilo', 'intencao', 'pedidos', 'historico', 'decisoes', 'termos',
  'termosCompartilhados', 'previas', 'envios', 'saidasRaiz', 'memoriaRaiz', 'saidas', 'memoria', 'dadosLinha',
  'estadoLinha', 'investigacoes',
]);

// Onde cada coisa da empresa mora. Só calcula: não cria pasta nenhuma.
function caminhos(codigo, r = raiz()) {
  const entrada = listar(r).find((e) => e.codigo === codigo);
  if (!entrada) throw erro('EMPRESA_DESCONHECIDA', `A empresa "${codigo}" não existe nesta pasta.`);
  return caminhosDe(codigo, entrada.disposicao, r);
}

// O mesmo objeto de caminhos(), para a disposição pedida ("legado" ou "gaveta"), sem olhar o índice. A mudança da
// pasta antiga pareia, chave por chave, os caminhos das duas disposições. Só calcula: não cria pasta nenhuma.
function caminhosDe(codigo, disposicao, r = raiz()) {
  if (typeof codigo !== 'string' || !(CODIGO.test(codigo) || codigo === LEGADO)) {
    throw erro('CODIGO_INVALIDO', `O código ${JSON.stringify(codigo)} não serve: use só letras minúsculas sem acento, números e "-".`);
  }
  if (disposicao !== 'gaveta' && disposicao !== 'legado') {
    throw erro('DISPOSICAO_INVALIDA', `A disposição ${JSON.stringify(disposicao)} não existe: use "gaveta" ou "legado".`);
  }
  if (disposicao === 'legado' && codigo !== LEGADO) {
    throw erro('DISPOSICAO_INVALIDA', `Só a empresa "${LEGADO}" pode ter a disposição "legado" (pasta antiga).`);
  }
  // Comuns às duas disposições: sempre em empresas/<codigo> (para o legado, empresas/principal).
  const G = path.join(r, 'empresas', codigo);
  const comuns = {
    estilo: path.join(G, 'estilo.json'),
    intencao: path.join(G, 'intencao.json'),
    pedidos: path.join(G, 'pedidos'),
    historico: path.join(G, 'historico'),
    decisoes: path.join(G, 'decisoes.md'),
    termos: path.join(G, 'termos.txt'),
    termosCompartilhados: path.join(G, 'termos-compartilhados.txt'),
    previas: path.join(G, 'previas'),
    // O que a Fábrica manda para o cliente (cronograma em HTML etc.): sempre dentro da pasta da empresa.
    envios: path.join(G, 'envios'),
  };
  if (disposicao === 'legado') {
    const marca = path.join(r, '06-MARCA-E-FOTOS');
    const lab = path.join(r, '04-LABORATORIO-DE-DESIGN');
    return {
      gaveta: G,
      perfil: arqPerfilLegado(r),
      marca: arqMarcaLegado(r),
      pastaMarca: marca,
      estiloDeVideo: path.join(marca, 'estilo-de-video.md'),
      estilosProprios: path.join(marca, 'estilos-proprios'),
      referencias: path.join(lab, 'referencias'),
      laboratorio: path.join(lab, 'dados'),
      cronograma: path.join(r, '03-CRONOGRAMA', 'dados'),
      // As peças aprovadas: no legado, a pasta de sempre.
      publicacoes: path.join(r, '02-PUBLICACOES'),
      ...comuns,
      // No legado as saídas e a memória ficam dentro de cada linhas/<linha>/: não há uma pasta só para elas.
      saidasRaiz: null,
      memoriaRaiz: null,
      saidas: porLinha((linha) => path.join(r, 'linhas', linha, 'saida')),
      memoria: porLinha((linha) => path.join(r, 'linhas', linha, 'memoria')),
      dadosLinha: porLinha((linha) => path.join(r, 'linhas', linha, 'dados')),
      estadoLinha: porLinha((linha) => path.join(r, 'linhas', linha, 'estado.json')),
      investigacoes: porLinha((linha) => path.join(r, 'linhas', linha, '_investigacoes')),
    };
  }
  return {
    gaveta: G,
    perfil: path.join(G, 'empresa.md'),
    marca: path.join(G, 'marca.yaml'),
    pastaMarca: G,
    estiloDeVideo: path.join(G, 'estilo-de-video.md'),
    estilosProprios: path.join(G, 'estilos-proprios'),
    referencias: path.join(G, 'referencias'),
    laboratorio: path.join(G, 'laboratorio', 'dados'),
    cronograma: path.join(G, 'cronograma', 'dados'),
    publicacoes: path.join(G, 'publicacoes'),
    ...comuns,
    saidasRaiz: path.join(G, 'saidas'),
    memoriaRaiz: path.join(G, 'memoria'),
    saidas: porLinha((linha) => path.join(G, 'saidas', linha)),
    memoria: porLinha((linha) => path.join(G, 'memoria', linha)),
    dadosLinha: porLinha((linha) => path.join(G, 'linhas', linha, 'dados')),
    estadoLinha: porLinha((linha) => path.join(G, 'estado', linha + '.json')),
    investigacoes: porLinha((linha) => path.join(G, 'investigacoes', linha)),
  };
}

// Sem acento, em minúsculas, com espaço virando "-": a sugestão de código para um nome como "Clínica Bela Vista".
function sugerirCodigo(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 41).replace(/-+$/, '');
}

function criar(codigo, nome, r = raiz()) {
  if (typeof codigo !== 'string' || !CODIGO.test(codigo)) {
    const sugestao = typeof codigo === 'string' ? sugerirCodigo(codigo) : '';
    const dica = CODIGO.test(sugestao) ? ` Que tal "${sugestao}"?` : '';
    throw erro('CODIGO_INVALIDO', `O código "${codigo}" não serve: use só letras minúsculas sem acento, números e "-", de 2 a 41 caracteres, começando por letra ou número.${dica}`, { sugestao: dica ? sugestao : null });
  }
  if (typeof nome !== 'string' || nome.trim() === '') throw erro('NOME_INVALIDO', 'O nome da empresa não pode ficar vazio.');
  nome = nome.trim();

  const indice = lerIndice(r);
  const lista = listar(r);
  if (codigo === LEGADO || lista.some((e) => e.codigo === codigo)) {
    throw erro('EMPRESA_EXISTE', codigo === LEGADO && !lista.some((e) => e.codigo === LEGADO)
      ? `O código "${LEGADO}" é reservado para a empresa que já estava nesta pasta. Escolha outro código.`
      : `Já existe uma empresa com o código "${codigo}".`);
  }
  const pasta = path.join(r, 'empresas', codigo);
  if (fs.existsSync(pasta)) throw erro('EMPRESA_EXISTE', `Já existe a pasta ${pasta}; ela não foi tocada. Escolha outro código.`);

  // Com legado virtual, ele entra primeiro no índice como entrada de verdade (sem "virtual"), para não sumir
  // da lista quando a segunda empresa nascer. Os arquivos dele continuam onde estão.
  const entradas = indice === AUSENTE
    ? lista.map(({ virtual, ...resto }) => resto)
    : lista;
  const nova = { codigo, nome, disposicao: 'gaveta', criada: hoje() };
  fs.mkdirSync(pasta, { recursive: true });
  try {
    gravarJson(arqIndice(r), { ...(indice === AUSENTE ? {} : indice), empresas: [...entradas, nova] });
  } catch (e) {
    try { fs.rmdirSync(pasta); } catch { /* sobrou algo? deixa */ }
    throw e;
  }
  return nova;
}

function ativar(codigo, r = raiz()) {
  const lista = listar(r);
  if (!lista.some((e) => e.codigo === codigo)) {
    throw erro('EMPRESA_DESCONHECIDA', `A empresa "${codigo}" não existe nesta pasta. Empresas: ${lista.length ? lista.map((e) => e.codigo).join(', ') : 'nenhuma'}.`);
  }
  // Se o ativa.json atual estiver quebrado, avisa em vez de gravar por cima.
  lerJson(arqAtiva(r), null);
  gravarJson(arqAtiva(r), { empresa: codigo });
}

// Nomes e contas da empresa que não podem aparecer em conteúdo de outra empresa: o nome do índice (menos o padrão
// "Sua empresa"), nome e @ da marca, nome e domínio do site do perfil e as linhas do termos.txt (sem vazias e sem
// as que começam com //). Assim uma empresa recém-criada, ainda sem marca nem perfil, já contribui com o nome.
function termos(codigo, r = raiz()) {
  const c = caminhos(codigo, r);
  const achados = [];
  const entrada = listar(r).find((e) => e.codigo === codigo);
  if (entrada && entrada.nome.trim() !== NOME_PADRAO) achados.push(entrada.nome);
  const marca = lerTexto(c.marca);
  if (marca !== null) {
    const emp = lerYaml(marca).empresa || {};
    if (typeof emp.nome === 'string') achados.push(emp.nome);
    if (typeof emp.handle === 'string') achados.push(emp.handle.replace(/^@+/, ''));
  }
  const perfil = lerTexto(c.perfil);
  if (perfil !== null) {
    for (const linha of perfil.split(/\r?\n/)) {
      const m = /^\s*\*\*(Nome|Site):\*\*\s*(.*)$/.exec(linha);
      if (!m) continue;
      let valor = m[2].trim();
      if (m[1] === 'Site') valor = valor.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^www\./i, '').replace(/[/?#].*$/, '');
      achados.push(valor);
    }
  }
  const lista = lerTexto(c.termos);
  if (lista !== null) {
    for (const linha of lista.split(/\r?\n/)) {
      const l = linha.trim();
      if (l !== '' && !l.startsWith('//')) achados.push(l);
    }
  }
  return [...new Set(achados.map((a) => a.trim()).filter((a) => a !== ''))];
}

// ---------- linha de comando ----------
const RECUSAS = new Set(['JSON_INVALIDO', 'EMPRESA_NAO_ESCOLHIDA', 'EMPRESA_DESCONHECIDA', 'CODIGO_INVALIDO', 'EMPRESA_EXISTE', 'NOME_INVALIDO', 'LINHA_INVALIDA']);
const USO = [
  'Uso:',
  '  node _fabrica/core/empresa.js listar                  lista as empresas desta pasta',
  '  node _fabrica/core/empresa.js ativa                   mostra o código da empresa ativa',
  '  node _fabrica/core/empresa.js ativar <codigo>         escolhe a empresa ativa',
  '  node _fabrica/core/empresa.js criar <codigo> "<nome>" cria a gaveta de uma empresa nova',
  '  node _fabrica/core/empresa.js caminhos [<codigo>] [--linha <l>] [--json]',
  '                                                        mostra onde ficam os arquivos (padrão: a empresa ativa);',
  '                                                        --linha resolve os caminhos de uma linha; --json imprime um objeto só',
  '  node _fabrica/core/empresa.js migrar <args...>        atalho do migrar.js (levar a pasta antiga para a pasta da',
  '                                                        empresa, só com pedido); a saída é a dele',
].join('\n');

function principal(args) {
  const [cmd, ...resto] = args;
  const uso = (msg) => { console.error((msg ? msg + '\n' : '') + USO); return 2; };
  switch (cmd) {
    case 'listar': {
      if (resto.length) return uso('O comando "listar" não recebe argumentos.');
      const lista = listar();
      if (!lista.length) console.log('Nenhuma empresa nesta pasta ainda. Crie uma com: node _fabrica/core/empresa.js criar <codigo> "<nome>"');
      for (const e of lista) console.log(`${e.codigo}\t${e.nome}\t${e.disposicao}${e.virtual ? ' (ainda não registrada no índice)' : ''}`);
      return 0;
    }
    case 'ativa': {
      if (resto.length) return uso('O comando "ativa" não recebe argumentos.');
      const a = ativa();
      if (a === null) {
        console.error('Nenhuma empresa nesta pasta ainda. Crie uma com: node _fabrica/core/empresa.js criar <codigo> "<nome>"');
        return 1;
      }
      console.log(a);
      return 0;
    }
    case 'ativar': {
      if (resto.length !== 1) return uso('Faltou o código da empresa (ou sobrou argumento).');
      ativar(resto[0]);
      console.log(`Empresa ativa: ${resto[0]}`);
      return 0;
    }
    case 'criar': {
      if (resto.length !== 2) return uso('Informe o código e o nome entre aspas.');
      const nova = criar(resto[0], resto[1]);
      console.log(`Empresa criada: ${nova.codigo} (${nova.nome}), pasta ${path.join(raiz(), 'empresas', nova.codigo)}`);
      return 0;
    }
    case 'caminhos': {
      // caminhos [<codigo>] [--linha <l>] [--json], em qualquer ordem.
      let posicional = null;
      let linha;
      let json = false;
      for (let i = 0; i < resto.length; i++) {
        const a = resto[i];
        if (a === '--json') json = true;
        else if (a === '--linha') {
          if (linha !== undefined) return uso('A opção --linha apareceu mais de uma vez.');
          // "--linha --json" é a opção sem o valor, não uma linha chamada "--json".
          if (i + 1 >= resto.length || resto[i + 1].startsWith('--')) return uso('Faltou o nome da linha depois de --linha.');
          linha = resto[++i];
        } else if (a.startsWith('--')) return uso(`Opção desconhecida: ${a}`);
        else if (posicional !== null) return uso('Sobrou argumento.');
        else posicional = a;
      }
      const codigo = posicional || ativa();
      if (!codigo) {
        console.error('Nenhuma empresa nesta pasta ainda.');
        return 1;
      }
      const c = caminhos(codigo);
      // Com --linha as funções por linha saem já resolvidas (o nome passa pela mesma validação); sem ela, com "<linha>".
      const valores = Object.entries(c).map(([chave, valor]) => [chave, typeof valor === 'function' ? valor(linha === undefined ? MOLDE_LINHA : linha) : valor]);
      if (json) {
        const entrada = listar().find((e) => e.codigo === codigo);
        console.log(JSON.stringify({ codigo, nome: entrada.nome, ...Object.fromEntries(valores) }, null, 2));
      } else {
        for (const [chave, valor] of valores) console.log(`${chave}: ${valor}`);
      }
      return 0;
    }
    case 'migrar':
      // Atalho: repassa os argumentos ao migrar.js, carregado só aqui (o leitor continua pequeno e sem depender dele).
      return require('./migrar').principal(resto);
    default:
      return uso(cmd ? `Comando desconhecido: ${cmd}` : '');
  }
}

// Exporta antes de rodar a linha de comando: o atalho "migrar" carrega o migrar.js, que usa este leitor.
module.exports = { raiz, listar, ativa, caminhos, caminhosDe, CHAVES_DE_CAMINHO, criar, ativar, termos, sugerirCodigo };

if (require.main === module) {
  try {
    process.exitCode = principal(process.argv.slice(2));
  } catch (e) {
    // Recusa conhecida sai 1; qualquer outro erro (arquivo sem permissão, pasta no lugar do arquivo) sai 2, sem a pilha.
    console.error('ERRO  ' + (RECUSAS.has(e.code) ? e.message : `inesperado: ${e.message}`));
    process.exitCode = RECUSAS.has(e.code) ? 1 : 2;
  }
}
