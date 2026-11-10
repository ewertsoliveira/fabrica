// Biblioteca de estilos do Laboratório: o catálogo que o painel mostra e os pedidos que ele grava para o agente,
// sempre para UMA empresa.
//
// O catálogo é lido a cada chamada (sem guardar nada em memória): um estilo novo na pasta aparece sem reiniciar o
// servidor. Vem de 04-LABORATORIO-DE-DESIGN/estilos/<id>/estilo.yaml, dos rótulos em biblioteca/vocabulario.json e das
// prévias em biblioteca/previas/<id>/previas.json. Só entra no catálogo o arquivo de prévia que existe de verdade: nunca
// há endereço para um quadro vazio.
//
// Os estilos próprios da empresa (`proprios`) vêm só da pasta `estilosProprios` DELA, com as prévias de
// empresas/<empresa>/previas/proprios/<id>/; o estilo escolhido (`atual`) vem do escolha.js. Nada de outra empresa entra.
//
// Só lê. A única coisa que este módulo grava é o pedido ao agente, em empresas/<empresa>/pedidos/, e quem grava de
// fato é _fabrica/core/pedidos.js. O arquivo
// empresas/<empresa>/intencao.json (escrito pela etapa de apresentação da empresa) só é lido, e um arquivo ausente ou
// quebrado nunca derruba nada: vale a ordem do catálogo.
//
// Os erros de pedido (empresa ou dados inválidos) saem com `recusaDoPedido` e `status`, o formato que o servidor já
// entende; as mensagens são para a pessoa que usa o painel.
'use strict';
const fs = require('fs');
const path = require('path');
const empresaMod = require('../core/empresa');
const pedidosMod = require('../core/pedidos');
const escolhaMod = require('../core/escolha');
const estilosProprios = require('../core/estilos-proprios');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml.js');
// Prévias na marca (etapa 7): as que valem com a marca de hoje e o andamento da geração de cada empresa.
const previasMarca = require('../../08-FERRAMENTAS/biblioteca/previas-marca.js');
const filaMarca = require('../../08-FERRAMENTAS/biblioteca/fila-marca.js');

const LAB = '04-LABORATORIO-DE-DESIGN';
const PASTA_PREVIAS = `${LAB}/biblioteca/previas`;
const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const PAPEIS_FONTE = ['principal', 'mono', 'acento'];
const CAMPOS_CODIGO = [['combinaCom', 'combina-com'], ['tom', 'tom'], ['precisa', 'precisa']];
const TIPOS_DE_PEDIDO = Object.keys(pedidosMod.TIPOS);
const MENSAGEM_PEDIDO = pedidosMod.MENSAGEM;
// O que cada coisa que a empresa quer (intencao.json) pede de um estilo: o que ela quer ver pronto, na prévia.
const FORMATO_DA_INTENCAO = { video: 'video', carrossel: 'carrossel', post: 'carrossel' };

const recusa = (erro) => Object.assign(new Error(erro), { recusaDoPedido: true, status: 400 });
const trecho = (v) => JSON.stringify(String(v).slice(0, 60));
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const ehTexto = (v) => typeof v === 'string' && v.trim() !== '';
// Nome de arquivo ou de pasta simples: sem caminho, sem "..", sem começar por ponto.
const NOME_SIMPLES = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const nomeSimples = (n) => typeof n === 'string' && NOME_SIMPLES.test(n) && !n.includes('..');

function lerJsonSeguro(arq) {
  try { return JSON.parse(fs.readFileSync(arq, 'utf8')); } catch { return null; }
}

// ---- A empresa ----

// A empresa vem do servidor já conferida; aqui se confere de novo antes de montar qualquer caminho. `null` é a pasta
// ainda sem nenhuma empresa (vale só para ler o catálogo).
function conferirEmpresa(r, codigo, aceitaNula) {
  if (codigo === null && aceitaNula) return null;
  if (typeof codigo !== 'string' || codigo === '') throw recusa('O pedido veio sem a empresa. Escolha a empresa no seletor.');
  if (!empresaMod.listar(r).some((e) => e.codigo === codigo)) throw recusa(`A empresa ${trecho(codigo)} não existe nesta pasta. Escolha a empresa no seletor.`);
  return codigo;
}

// ---- O catálogo ----

// Os estilos que dá para ler, em ordem alfabética: [{ id, y }]. Uma pasta sem estilo.yaml não é estilo; um estilo.yaml
// com defeito fica de fora (os outros seguem).
function lerEstilos(r) {
  const dir = path.join(r, ...LAB.split('/'), 'estilos');
  let entradas;
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  const lista = [];
  for (const e of entradas.filter((x) => x.isDirectory() && nomeSimples(x.name)).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const arq = path.join(dir, e.name, 'estilo.yaml');
    if (!ehArquivo(arq)) continue;
    let y;
    try { y = lerYaml(fs.readFileSync(arq, 'utf8')); } catch { continue; }
    if (!ehObjeto(y)) continue;
    lista.push({ id: e.name, y });
  }
  return lista;
}

function lerVocabulario(r) {
  const j = lerJsonSeguro(path.join(r, ...LAB.split('/'), 'biblioteca', 'vocabulario.json'));
  const voc = {};
  for (const campo of ['combina-com', 'tom', 'precisa']) {
    voc[campo] = {};
    const origem = ehObjeto(j) && ehObjeto(j[campo]) ? j[campo] : {};
    for (const [codigo, rotulo] of Object.entries(origem)) if (ehTexto(rotulo)) voc[campo][codigo] = rotulo;
  }
  return voc;
}

// Códigos do estilo com o rótulo do vocabulário; código sem rótulo não aparece (a tela nunca mostra o código cru).
function rotular(codigos, rotulos) {
  if (!Array.isArray(codigos)) return [];
  return codigos.filter((c) => typeof c === 'string' && Object.prototype.hasOwnProperty.call(rotulos, c)).map((c) => ({ codigo: c, rotulo: rotulos[c] }));
}

// O endereço (servido pelo servidor) de um arquivo de prévia que existe, ou null.
function urlDaPrevia(r, id, nome) {
  if (!nomeSimples(nome)) return null;
  if (!ehArquivo(path.join(r, ...PASTA_PREVIAS.split('/'), id, nome))) return null;
  return `/${PASTA_PREVIAS}/${encodeURIComponent(id)}/${encodeURIComponent(nome)}`;
}

function lerPrevias(r, id) {
  const j = lerJsonSeguro(path.join(r, ...PASTA_PREVIAS.split('/'), id, 'previas.json'));
  const p = ehObjeto(j) ? j : {};
  const u = (nome) => urlDaPrevia(r, id, nome);
  const carrossel = Array.isArray(p.carrossel) ? p.carrossel.map(u).filter(Boolean) : [];
  const f = ehObjeto(p.fixados) ? { apresentacao: u(p.fixados.apresentacao), metodo: u(p.fixados.metodo), contratar: u(p.fixados.contratar) } : null;
  const fixados = f && (f.apresentacao || f.metodo || f.contratar) ? f : null;
  return { capa: u(p.capa), carrossel, fixados, reelsCapa: u(p.reelsCapa), video: u(p.video), videoCapa: u(p.videoCapa) };
}

// Os formatos que o estilo tem de verdade (com prévia), na ordem em que a tela mostra as abas.
function formatosDe(previas) {
  const f = [];
  if (previas.video) f.push('video');
  if (previas.carrossel.length) f.push('carrossel');
  if (previas.reelsCapa) f.push('capa-reels');
  if (previas.fixados) f.push('fixados');
  return f;
}

// `previasProntas`: as prévias já lidas (estilo próprio); sem elas, as do catálogo em `r`.
function itemDoEstilo({ id, y }, r, vocabulario, previasProntas = null) {
  const sug = ehObjeto(y.sugestao) ? y.sugestao : {};
  const cores = {};
  for (const papel of PAPEIS_COR) {
    const v = ehObjeto(sug.cores) ? sug.cores[papel] : undefined;
    cores[papel] = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null;
  }
  const fontes = {};
  for (const papel of PAPEIS_FONTE) {
    const v = ehObjeto(sug.tipografia) ? sug.tipografia[papel] : undefined;
    fontes[papel] = ehTexto(v) ? v.trim() : null;
  }
  const tratamentos = {};
  if (ehObjeto(y.tratamentos)) for (const [k, v] of Object.entries(y.tratamentos)) if (typeof v === 'string') tratamentos[k] = v;
  const regras = ehObjeto(y.kit) && Array.isArray(y.kit.regras) ? y.kit.regras.filter(ehTexto) : [];
  const previas = previasProntas || lerPrevias(r, id);
  const item = { id, nome: ehTexto(y.nome) ? y.nome.trim() : id, linha: ehTexto(y.linha) ? y.linha.trim() : '' };
  for (const [saida, campo] of CAMPOS_CODIGO) item[saida] = rotular(y[campo], vocabulario[campo]);
  return { ...item, cores, fontes, tratamentos, regras, formatos: formatosDe(previas), previas };
}

// A ordem pela intenção da empresa: quem tem o que ela quer (na ordem em que ela quer) vem primeiro; o resto segue a
// ordem do catálogo. Só ordena: nenhum estilo some.
const queridos = (intencao) => (ehObjeto(intencao) && Array.isArray(intencao.quer) ? intencao.quer.filter((q) => typeof q === 'string' && Object.prototype.hasOwnProperty.call(FORMATO_DA_INTENCAO, q)) : []);
// Os formatos de prévia que a empresa quer ver primeiro, na ordem dela e sem repetir ([] sem intenção): a tela abre o
// detalhe de um estilo na aba do primeiro deles que o estilo tem.
const formatosQueridos = (intencao) => [...new Set(queridos(intencao).map((q) => FORMATO_DA_INTENCAO[q]))];

function ordenarPelaIntencao(itens, intencao) {
  // Cada formato conta uma vez só (new Set), na primeira posição em que a empresa o citou: repetir um valor em `quer`
  // (ou citar "post" e "carrossel", que dão o mesmo formato) não pesa em dobro.
  const quer = formatosQueridos(intencao);
  if (!quer.length) return itens;
  const peso = (item) => quer.reduce((soma, formato, i) => soma + (item.formatos.includes(formato) ? quer.length - i : 0), 0);
  return itens.map((item, i) => ({ item, i, p: peso(item) })).sort((a, b) => b.p - a.p || a.i - b.i).map((x) => x.item);
}

// As prévias na marca de cada estilo (só as que valem com a marca de hoje: previas-marca.previasValidas) e o vídeo na marca
// (o estado da lista da empresa; "pronto" só quando o vídeo do previas.json vale de verdade). Devolve a `marca` do catálogo:
// { definida, naMarca, desatualizada, semConferir, progresso } (semConferir = estilos ainda sem prévia válida na marca; progresso = o estado da geração, sem o campo `trabalhador`).
function naMarcaDaEmpresa(r, empresa, c, itens) {
  const definida = ehArquivo(c.marca);
  const assinatura = definida ? previasMarca.assinaturaDaMarca(r, empresa).assinatura : null;
  const { estado, porEstilo } = filaMarca.estadoComVideos(r, empresa);
  // os textos guardados de todos os estilos da empresa (a cor sugerida é conferida contra todos), guardados
  // enquanto a marca e os previas.json da empresa não mudam: a grade relida não refaz a conta
  const daEmpresa = assinatura ? previasMarca.contextoDaEmpresa(r, empresa, assinatura) : null;
  for (const item of itens) {
    item.previasMarca = assinatura ? previasMarca.previasValidas(r, empresa, item.id, assinatura, { empresa: daEmpresa }) : null;
    item.notaDestaque = definida ? previasMarca.notaDestaque(r, empresa, item.id) : null; // a letra de destaque (detalhes técnicos)
    const v = definida && Object.prototype.hasOwnProperty.call(porEstilo, item.id) ? porEstilo[item.id] : null;
    item.videoMarca = v === 'pronto' && !(item.previasMarca && item.previasMarca.video) ? null : v;
  }
  const { trabalhador, ...progresso } = estado;
  return { definida, naMarca: itens.some((i) => i.previasMarca !== null), desatualizada: estado.desatualizada,
    semConferir: definida ? itens.filter((i) => i.previasMarca === null).length : 0, progresso };
}

// ---- Os estilos próprios da empresa e o estilo escolhido ----

// Um estilo próprio mora em <estilosProprios>/<id>/estilo.yaml (só os DESTA empresa) e as prévias base dele em
// <previas>/proprios/<id>/ (feitas por gerar-previas.js --estilos). Fica de fora, sem derrubar nada: código fora da regra (a
// mesma do molde: minúsculas, números e "-", até 64), atalho (junção, link) em qualquer ponto do caminho, estilo.yaml
// ilegível ou que não é um objeto, e origem diferente de "referencias". O texto dele veio de referências de fora: nome, linha,
// regras, tratamentos e letras chegam numa linha só, sem controles nem invisíveis e com limite (e no máximo 12 regras e 12
// tratamentos). A regra do código, do atalho e da origem é a de _fabrica/core/estilos-proprios.js (a mesma do molde e da
// escolha do estilo).
const MAXIMO_DE_ITENS = 12;
const car = (n) => String.fromCharCode(n);
const QUEBRAS = new RegExp(`[${car(9)}${car(10)}${car(11)}${car(12)}${car(13)}${car(0x85)}${car(0x2028)}${car(0x2029)}]`, 'g');
// sequências de terminal (ESC [ ... letra, e o mesmo com o CSI de um caractere só) saem inteiras
const SEQUENCIAS = new RegExp(`(?:${car(0x1b)}\\[|${car(0x9b)})[0-9;?]*[ -/]*[@-~]|${car(0x1b)}[@-_]?`, 'g');
const INVISIVEIS = new RegExp('[\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}\\p{Cs}\\u{FE00}-\\u{FE0F}\\u{E0000}-\\u{E01EF}\\u{034F}\\u{061C}\\u{00AD}\\u{180E}\\u{3164}\\u{115F}\\u{1160}\\u{FFA0}\\u{2800}\\u{17B4}\\u{17B5}]', 'gu');
const LIMITES = { nome: 80, linha: 300, regra: 300, tratamento: 120, fonte: 60 };
function limparTexto(v, limite) {
  if (typeof v !== 'string') return null;
  const s = v.replace(SEQUENCIAS, '').replace(QUEBRAS, ' ').replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim();
  const letras = [...s];
  return letras.length > limite ? letras.slice(0, limite - 1).join('') + '…' : s;
}

const realOuNull = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };
const ehAtalho = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
const mesmoCaminho = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
// A pasta existe, é de verdade (nem ela nem nenhuma pasta acima dela até `ate` é atalho) e fica onde o caminho diz.
function pastaDeVerdade(p, ate) {
  const real = realOuNull(p);
  if (!real || !mesmoCaminho(real, path.join(realOuNull(ate) || ate, path.relative(ate, p)))) return false;
  try { return fs.statSync(real).isDirectory(); } catch { return false; }
}

// O texto de um item do catálogo vindo de um estilo próprio, já limpo.
function itemDoProprio(e, vocabulario, previas) {
  const item = itemDoEstilo(e, null, vocabulario, previas);
  item.nome = limparTexto(item.nome, LIMITES.nome) || e.id;
  item.linha = limparTexto(item.linha, LIMITES.linha) || '';
  item.regras = item.regras.map((x) => limparTexto(x, LIMITES.regra)).filter(Boolean).slice(0, MAXIMO_DE_ITENS);
  item.tratamentos = Object.fromEntries(Object.entries(item.tratamentos).map(([k, v]) => [limparTexto(k, LIMITES.tratamento), limparTexto(v, LIMITES.tratamento)]).filter(([k, v]) => k && v).slice(0, MAXIMO_DE_ITENS));
  for (const papel of PAPEIS_FONTE) item.fontes[papel] = item.fontes[papel] === null ? null : (limparTexto(item.fontes[papel], LIMITES.fonte) || null);
  return { ...item, previasMarca: null, videoMarca: null, origem: 'proprio' };
}

// As prévias base de um estilo próprio, só de <previas>/proprios/<id>/ desta empresa e só de um previas.json do próprio estilo.
function lerPreviasProprias(empresa, c, id) {
  const vazio = { capa: null, carrossel: [], fixados: null, reelsCapa: null, video: null, videoCapa: null };
  const dir = path.join(c.previas, 'proprios', id);
  if (!pastaDeVerdade(dir, c.gaveta)) return vazio;
  const j = lerJsonSeguro(path.join(dir, 'previas.json'));
  if (!ehObjeto(j) || j.estilo !== id) return vazio;
  const u = (nome) => (nomeSimples(nome) && !ehAtalho(path.join(dir, nome)) && ehArquivo(path.join(dir, nome))
    ? `/empresas/${encodeURIComponent(empresa)}/previas/proprios/${encodeURIComponent(id)}/${encodeURIComponent(nome)}` : null);
  const carrossel = Array.isArray(j.carrossel) ? j.carrossel.map(u).filter(Boolean) : [];
  const f = ehObjeto(j.fixados) ? { apresentacao: u(j.fixados.apresentacao), metodo: u(j.fixados.metodo), contratar: u(j.fixados.contratar) } : null;
  const fixados = f && (f.apresentacao || f.metodo || f.contratar) ? f : null;
  return { capa: u(j.capa), carrossel, fixados, reelsCapa: u(j.reelsCapa), video: u(j.video), videoCapa: u(j.videoCapa) };
}

// Os estilos próprios da empresa, em ordem alfabética; [] sem pasta.
function lerProprios(empresa, c, vocabulario) {
  const lista = [];
  // a pasta de estilos próprios ou a de um estilo que é atalho, código fora da regra, estilo.yaml ilegível e origem errada
  // ficam de fora (estilos-proprios.listar e lerEstilo)
  for (const id of estilosProprios.listar(c.estilosProprios)) {
    let e;
    try { e = estilosProprios.lerEstilo(c.estilosProprios, id); } catch { continue; }
    lista.push(itemDoProprio({ id, y: e.y }, vocabulario, lerPreviasProprias(empresa, c, id)));
  }
  return lista;
}

// O estilo escolhido (escolha.ler); null sem escolha ou com o estilo.json quebrado (que nunca é regravado). Estilo próprio:
// o nome vem do item já conferido em `proprios`; se ele não está lá (atalho, estilo apagado ou fora da regra), só o código,
// com o nome null. Estilo do catálogo: o nome limpo.
function estiloAtual(r, empresa, proprios) {
  let atual;
  try { atual = escolhaMod.ler(r, empresa); } catch { return null; }
  if (!atual) return null;
  if (atual.origem === 'proprio') {
    const item = proprios.find((p) => p.id === atual.estilo);
    return { ...atual, nome: item ? item.nome : null };
  }
  return { ...atual, nome: limparTexto(atual.nome, LIMITES.nome) || atual.estilo };
}

// O catálogo da empresa: { empresa, vocabulario, estilos, marca, intencao, proprios, atual }. `codigo` null = pasta sem nenhuma
// empresa ainda (sem prévias na marca: marca { definida: false, naMarca: false }; proprios [] e atual null). `intencao` =
// formatos de prévia que a empresa quer ver primeiro (ex.: ['video', 'carrossel']), [] sem intenção. Cada estilo tem
// `previasMarca` (endereços só de /empresas/<empresa>/previas/, ou null) e `videoMarca` (pronto | esperando | fazendo | erro |
// sem-fonte | sem-modelo | null). `proprios`: os estilos próprios DESTA empresa, no mesmo formato, com origem 'proprio' e as
// prévias de /empresas/<empresa>/previas/proprios/<id>/. `atual`: o estilo escolhido (escolha.ler) ou null.
function catalogo(r, codigo) {
  const empresa = conferirEmpresa(r, codigo, true);
  const c = empresa === null ? null : empresaMod.caminhos(empresa, r);
  const vocabulario = lerVocabulario(r);
  const itens = lerEstilos(r).map((e) => ({ ...itemDoEstilo(e, r, vocabulario), previasMarca: null, videoMarca: null, notaDestaque: null }));
  const marca = c ? naMarcaDaEmpresa(r, empresa, c, itens) : { definida: false, naMarca: false };
  const intencao = c ? lerJsonSeguro(c.intencao) : null;
  const estilos = ordenarPelaIntencao(itens, intencao);
  const proprios = c ? ordenarPelaIntencao(lerProprios(empresa, c, vocabulario), intencao) : [];
  const atual = c ? estiloAtual(r, empresa, proprios) : null;
  return { empresa, vocabulario, estilos, marca, intencao: formatosQueridos(intencao), proprios, atual };
}

// ---- Os pedidos ao agente ----

// Quem grava, confere e lê os pedidos é _fabrica/core/pedidos.js (formato fechado, a empresa dentro do arquivo, a hora
// em UTC no nome). Aqui fica só a mesma entrada de sempre para o servidor: mesma assinatura, mesmas recusas
// (`recusaDoPedido`, status 400) e a mesma mensagem. Devolve { id, arquivo, mensagem }.
function gravarPedido(r, codigo, pedido, agora = new Date()) {
  conferirEmpresa(r, codigo, false);
  return pedidosMod.gravar(r, codigo, pedido, agora);
}

module.exports = { catalogo, gravarPedido, TIPOS_DE_PEDIDO, MENSAGEM_PEDIDO };
