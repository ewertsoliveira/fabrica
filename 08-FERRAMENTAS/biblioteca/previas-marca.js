// Prévias "na minha marca": a assinatura da marca de cada empresa e a leitura das prévias na marca que ainda valem.
//
// Uma prévia na marca fica em empresas/<codigo>/previas/<estilo>/ (empresa.caminhos(c).previas; na pasta antiga,
// empresas/principal/previas/) e guarda no previas.json a assinatura da marca com que foi feita. A assinatura é um resumo
// (sha256, 16 primeiros caracteres) da VERSAO do gerador, dos campos do marca.yaml que mudam a peça (CAMPOS_DA_PECA, em JSON
// canônico: chaves em ordem, textos sem espaço nas pontas, hex em maiúsculas, conta sem "@") e do conteúdo de cada letra
// que ele cita (e do logo, quando pedido). Fim de linha, BOM, ordem, espaços, comentários, o caminho das letras e os campos
// que não vão à peça (voz, público, vídeo...) não mudam nada; trocar uma cor, o nome, a conta, a tela ou uma letra muda.
// Só vale "na sua marca" a prévia com a assinatura de hoje, cores "marca", a própria empresa e a identidade pedida.
//
// O instantâneo (instantaneoDaMarca) lê o marca.yaml e as letras UMA vez e calcula a assinatura desse mesmo conteúdo: quem
// gera as prévias usa as letras dele, e não as do disco, e confere de novo no fim (a marca pode mudar no meio da rodada).
//
// Este módulo nunca carrega o marca.js (ele fixaria a marca da empresa ativa ao ser carregado): lê o YAML com o yaml.js.
// Só lê; não cria pasta nenhuma.
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const empresaMod = require('../../_fabrica/core/empresa');
const { lerYaml } = require('../marca/yaml');

// Muda quando o jeito de gerar as prévias muda: assim as prévias antigas deixam de valer de propósito.
// 2: assinatura só dos campos da peça; previas.json com os dados de legibilidade.
// 3: valores efetivos (herança do exemplo) na assinatura; culpa da marca e tipo "estilo" na legibilidade.
// 4: tipografia.principal.italico na assinatura (muda a letra do destaque no vídeo na marca).
// 5: legibilidade.todos (todos os textos medidos, para a conta "esta cor estraga outro texto?").
const VERSAO = 5;
const RAIZ_CODIGO = path.resolve(__dirname, '..', '..');
const PAPEIS_LETRA = ['principal', 'mono', 'acento'];
// O que o molde do carrossel, os mockups, o conferidor, o gerador das prévias e o vídeo na marca (tema-marca.js) leem da
// marca (além das letras e do logo). Um campo novo lido por eles entra aqui (e a VERSAO sobe).
const CAMPOS_DA_PECA = ['cores.escuro', 'cores.claro', 'cores.acento', 'cores.neutro', 'empresa.nome', 'empresa.handle',
  'canvas.feed', 'canvas.area-segura', 'canvas.pisos', 'canvas.pisos-ui', 'tipografia.principal.italico'];
const CAMPOS_DO_LOGO = ['pecas.logo-aparece-em'];
// Nome de arquivo ou de pasta simples: sem caminho, sem "..", sem começar por ponto (a mesma regra do biblioteca.js).
const NOME_SIMPLES = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const nomeSimples = (n) => typeof n === 'string' && NOME_SIMPLES.test(n) && !n.includes('..');
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const dentroDe = (base, p) => { const rel = path.relative(base, p); return rel !== '' && rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel); };

function recusa(codigo) {
  const mostra = JSON.stringify(String(codigo).slice(0, 60));
  return Object.assign(new Error(`A empresa ${mostra} não existe nesta pasta. Escolha uma das empresas da lista.`), { code: 'EMPRESA_DESCONHECIDA' });
}

// A empresa pela lista de empresas (nunca pelo nome da pasta): devolve a entrada e os caminhos dela.
function conferir(r, codigo) {
  if (typeof codigo !== 'string' || codigo === '') throw recusa(codigo);
  const entrada = empresaMod.listar(r).find((e) => e.codigo === codigo);
  if (!entrada) throw recusa(codigo);
  return { entrada, c: empresaMod.caminhos(codigo, r) };
}

// A pasta das prévias na marca da empresa (empresas/<codigo>/previas/, também na pasta antiga).
function pastaDaEmpresa(r, codigo) {
  return conferir(r, codigo).c.previas;
}

// Um arquivo citado no marca.yaml, na mesma ordem do servidor (urlDeFonte): pasta da marca da empresa, raiz dos dados,
// raiz do código. Caminho vazio, absoluto, com ".." ou com segmento escondido vira null; numa empresa de gaveta, o que é
// da empresa antiga (06-MARCA-E-FOTOS, fora de exemplo/) nunca vale; nada que caia na pasta de outra empresa vale (nem na
// raiz dos dados nem na do código), e a pasta antiga da raiz do código só vale quando ela é a própria raiz dos dados.
function resolverCitado(r, entrada, c, rel, raizCodigo = RAIZ_CODIGO) {
  if (typeof rel !== 'string' || rel.trim() === '' || rel.includes('\0')) return null;
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || /^[\\/]/.test(rel)) return null;
  const partes = rel.split(/[\\/]+/).filter((p) => p !== '' && p !== '.');
  if (!partes.length || partes.some((p) => p === '..' || p.startsWith('.') || p.includes(':'))) return null;
  const ehGaveta = entrada.disposicao === 'gaveta';
  const daEmpresaAntiga = partes[0].toLowerCase() === '06-marca-e-fotos' && (partes[1] || '').toLowerCase() !== 'exemplo';
  const mesmaRaiz = path.resolve(r).toLowerCase() === path.resolve(raizCodigo).toLowerCase();
  const candidatos = [];
  if (ehGaveta) candidatos.push(path.join(c.pastaMarca, ...partes));
  if (!ehGaveta || !daEmpresaAntiga) {
    candidatos.push(path.join(r, ...partes));
    if (!daEmpresaAntiga || mesmaRaiz) candidatos.push(path.join(raizCodigo, ...partes));
  }
  const foraDeOutra = (p) => [path.join(r, 'empresas'), path.join(raizCodigo, 'empresas')].every((e) => !dentroDe(e, p) || dentroDe(c.gaveta, p));
  const permitido = (p) => (dentroDe(r, p) || dentroDe(raizCodigo, p)) && foraDeOutra(p);
  return candidatos.find((p) => permitido(p) && ehArquivo(p)) || null;
}

// O texto do marca.yaml sem BOM e com fim de linha LF; os dados lidos dele ({} se ilegível).
const textoDaMarca = (arq) => fs.readFileSync(arq, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
function lerDados(texto) {
  try { const y = lerYaml(texto); return ehObjeto(y) ? y : {}; } catch { return {}; }
}

// Valores efetivos, como o marca.js os entrega (padrão de primeiro uso): campo que a marca não tem (ou tem vazio, null) vem
// do marca.exemplo.yaml do modelo. Só os campos herdáveis que a peça usa: a tela, os tamanhos mínimos, a letra de destaque e
// onde a logo aparece.
const HERDADOS = ['canvas.feed', 'canvas.area-segura', 'canvas.pisos', 'canvas.pisos-ui', 'tipografia.acento.arquivo', 'pecas.logo-aparece-em'];
let exemploDados = null;
function dadosEfetivos(dados) {
  if (!exemploDados) {
    try { exemploDados = lerDados(textoDaMarca(path.join(RAIZ_CODIGO, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml'))); } catch { exemploDados = {}; }
  }
  const d = limpo(ehObjeto(dados) ? dados : {});
  for (const rota of HERDADOS) {
    const atual = busca(d, rota);
    if (atual !== undefined && atual !== null) continue;
    const herdado = busca(exemploDados, rota);
    if (herdado === undefined || herdado === null) continue;
    const chaves = rota.split('.');
    let o = d;
    for (const k of chaves.slice(0, -1)) { if (!ehObjeto(o[k])) o[k] = {}; o = o[k]; }
    o[chaves[chaves.length - 1]] = JSON.parse(JSON.stringify(herdado));
  }
  return d;
}

// Os arquivos que os dados da marca citam (valores efetivos), resolvidos para a empresa: { letras, logo, citados }.
function arquivosDosDados(r, codigo, dados, { raizCodigo = RAIZ_CODIGO } = {}) {
  const { entrada, c } = conferir(r, codigo);
  const y = dadosEfetivos(dados);
  const tipografia = ehObjeto(y.tipografia) ? y.tipografia : {};
  const citado = (v) => typeof v === 'string' && v.trim() !== '';
  const letras = {};
  const citados = {};
  for (const papel of PAPEIS_LETRA) {
    const arq = ehObjeto(tipografia[papel]) ? tipografia[papel].arquivo : undefined;
    citados[papel] = citado(arq);
    letras[papel] = citados[papel] ? resolverCitado(r, entrada, c, arq.trim(), raizCodigo) : null;
  }
  const logoRel = ehObjeto(y.pecas) ? y.pecas.logo : undefined;
  citados.logo = citado(logoRel);
  return { letras, logo: citados.logo ? resolverCitado(r, entrada, c, logoRel.trim(), raizCodigo) : null, citados };
}

// O marca.yaml da empresa e os arquivos que ele cita: { marca, letras: { principal, mono, acento }, logo, citados }.
// `citados` diz, por papel, se o marca.yaml cita um arquivo (citado e não achado = letra ausente).
function arquivosDaMarca(r, codigo, opcoes = {}) {
  const { c } = conferir(r, codigo);
  if (!ehArquivo(c.marca)) return { marca: null, letras: { principal: null, mono: null, acento: null }, logo: null, citados: { principal: false, mono: false, acento: false, logo: false } };
  return { marca: c.marca, ...arquivosDosDados(r, codigo, lerDados(textoDaMarca(c.marca)), opcoes) };
}

// Chaves sem BOM e sem espaço nas pontas, textos sem espaço nas pontas (o marca.js e este módulo leem o mesmo arquivo).
function limpo(v) {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(limpo);
  if (ehObjeto(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k.replace(/^﻿/, '').trim(), limpo(x)]));
  return v;
}
const busca = (obj, rota) => rota.split('.').reduce((o, k) => (ehObjeto(o) && o[k] !== undefined ? o[k] : undefined), obj);
function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (ehObjeto(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  return JSON.stringify(v === undefined ? null : v);
}
// Os campos que mudam a peça, normalizados. O nome que vale é o do marca.yaml ou, sem ele, o da lista de empresas.
function camposDaPeca(dados, nomeDaLista, comLogo) {
  const d = dadosEfetivos(dados);
  const campos = {};
  for (const rota of [...CAMPOS_DA_PECA, ...(comLogo ? CAMPOS_DO_LOGO : [])]) {
    let v = busca(d, rota);
    if (rota.startsWith('cores.') && typeof v === 'string') v = v.toUpperCase();
    if (rota === 'empresa.handle' && typeof v === 'string') v = v.replace(/^@+/, '');
    if (rota === 'empresa.nome' && !(typeof v === 'string' && v)) v = nomeDaLista;
    if (rota === 'tipografia.principal.italico') v = v === true; // como o tema-marca.js: só true vale; ausente = false
    campos[rota] = v === undefined ? null : v;
  }
  return campos;
}

// A assinatura de dados já lidos e das letras já lidas (bytes por papel; null = citada e não achada; sem `citada`, não entra).
function assinaturaDosDados(r, codigo, dados, letras, { logo = undefined, comLogo = false } = {}) {
  const { entrada } = conferir(r, codigo);
  const h = crypto.createHash('sha256');
  h.update(`versao:${VERSAO}\n`);
  h.update(canonico(camposDaPeca(dados, entrada.nome, comLogo)) + '\n');
  const parte = (papel, item) => {
    if (!item || !item.citada) return;
    h.update(`${papel}:`);
    if (item.bytes) h.update(item.bytes); else h.update(`ausente:${papel}`);
    h.update('\n');
  };
  for (const papel of PAPEIS_LETRA) parte(papel, letras && letras[papel]);
  if (comLogo) parte('logo', logo);
  return h.digest('hex').slice(0, 16);
}

// Lê a marca e as letras UMA vez: { marca, definida, assinatura, dados, letras: { <papel>: { citada, arquivo, bytes } }, logo }.
// Sem marca.yaml próprio: tudo null e definida falso.
function instantaneoDaMarca(r, codigo, { comLogo = false, raizCodigo = RAIZ_CODIGO } = {}) {
  const { c } = conferir(r, codigo);
  if (!ehArquivo(c.marca)) return { marca: null, definida: false, assinatura: null, dados: null, letras: null, logo: null };
  const dados = lerDados(textoDaMarca(c.marca));
  const a = arquivosDosDados(r, codigo, dados, { raizCodigo });
  const ler = (arq) => { try { return arq ? fs.readFileSync(arq) : null; } catch { return null; } };
  const letras = Object.fromEntries(PAPEIS_LETRA.map((p) => [p, { citada: a.citados[p], arquivo: a.letras[p], bytes: ler(a.letras[p]) }]));
  const logo = { citada: a.citados.logo, arquivo: a.logo, bytes: comLogo ? ler(a.logo) : null };
  return { marca: c.marca, definida: true, assinatura: assinaturaDosDados(r, codigo, dados, letras, { logo, comLogo }), dados, letras, logo };
}

// { assinatura, definida }. Sem marca.yaml próprio: { assinatura: null, definida: false }.
function assinaturaDaMarca(r, codigo, opcoes = {}) {
  const i = instantaneoDaMarca(r, codigo, opcoes);
  return { assinatura: i.assinatura, definida: i.definida };
}

// ---- Leitura difícil: o que a marca deixou difícil de ler, com as cores que resolvem ----
// Dos dados de legibilidade do previas.json (gerar-previas.js), só os textos que a MARCA piorou (os que viram aviso:
// `piorou`), agrupados para a tela. Um grupo de cor por papel: até 3 cores sugeridas (08-FERRAMENTAS/marca/legibilidade.js)
// que passam em TODOS os textos de TODAS as peças daquele papel (conferidas texto a texto) e combinam com a marca; a cor de
// hoje nunca é sugestão. Sem cor para todas as peças do papel: a cor que resolve o maior grupo de peças (empate: a ordem das
// peças e das sugestões; sempre o mesmo resultado) e as outras peças vão para "estilo". A peça com um texto que nenhuma cor
// resolve (tipo "estilo" do gerador) também. Peça em "estilo" sai de todos os grupos de cor: nunca está nos dois. Sem o
// módulo de sugestões, o grupo fica { tipo: 'cor', sugestoes: [] } (aí não dá para dizer que nenhuma cor resolve). Texto do
// tipo "contraste" fora do formato (papel, fundo) fica de fora. Texto do arquivo sai limpo (sem caractere de controle nem
// invisível) e cortado.
//   -> [{ tipo: 'cor', papel, onde, textos, itens: [{ formato, lamina, texto }], pecas: [{ formato, lamina }], peca,
//         sugestoes: [{ cor, contraste, origem, rotulo }] } | { tipo: 'estilo', onde, textos, itens, pecas, peca }]
const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const FORMATOS = ['carrossel', 'fixados', 'reels'];
const HEX = /^#[0-9A-F]{6}$/i;
const textoLimpo = (v, max = 60) => (typeof v === 'string' ? v.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim() : '');
let sugerirCarregado;
function carregarSugerir() {
  if (sugerirCarregado === undefined) {
    try { sugerirCarregado = require('../marca/legibilidade').sugerir; } catch { sugerirCarregado = null; }
  }
  return sugerirCarregado;
}
function leituraDificil(leg, { sugerir = carregarSugerir(), empresa = null } = {}) {
  if (!ehObjeto(leg) || !Array.isArray(leg.textos)) return [];
  const cores = {};
  if (ehObjeto(leg.cores)) for (const p of PAPEIS_COR) if (typeof leg.cores[p] === 'string' && HEX.test(leg.cores[p])) cores[p] = leg.cores[p].toUpperCase();
  // os textos que a marca piorou, conferidos: { formato, lamina, chave da peça, onde, texto, amostras, minimo, papel | null }
  const textos = [];
  for (const t of leg.textos.slice(0, 40)) {
    if (!ehObjeto(t) || t.piorou !== true || (t.tipo !== 'contraste' && t.tipo !== 'estilo')) continue;
    const formato = FORMATOS.includes(t.formato) ? t.formato : null;
    const lamina = Number.isInteger(t.lamina) && t.lamina >= 1 && t.lamina <= 40 ? t.lamina : null;
    const onde = textoLimpo(t.onde);
    const texto = textoLimpo(t.texto, 40);
    if (!formato || !lamina || !onde) continue;
    const amostras = (ehObjeto(t.fundo) && Array.isArray(t.fundo.amostras) ? t.fundo.amostras : []).filter((x) => typeof x === 'string' && HEX.test(x)).slice(0, 12).map((x) => x.toUpperCase());
    let papel = null;
    if (t.tipo === 'contraste') {
      if (!PAPEIS_COR.includes(t.papel) || !cores[t.papel] || !amostras.length) continue; // fora do formato: sem como sugerir
      papel = t.papel;
    }
    const minimo = typeof t.minimo === 'number' && t.minimo >= 1 && t.minimo <= 21 ? t.minimo : 4.5;
    textos.push({ formato, lamina, peca: formato + ':' + lamina, onde, texto, amostras, minimo, papel, contraste: typeof t.contraste === 'number' ? t.contraste : null,
      curto: typeof t.texto === 'string' && t.texto.trim().length <= 24 && !/…$/.test(t.texto.trim()) });
  }
  const grupoDe = (lista) => {
    const g = { onde: [], textos: [], itens: [], pecas: [], peca: null };
    for (const b of lista) {
      if (!g.pecas.some((p) => p.formato === b.formato && p.lamina === b.lamina)) g.pecas.push({ formato: b.formato, lamina: b.lamina });
      if (!g.onde.includes(b.onde)) g.onde.push(b.onde);
      if (b.texto && !g.textos.includes(b.texto)) g.textos.push(b.texto);
      if (g.itens.length < 12) g.itens.push({ formato: b.formato, lamina: b.lamina, texto: b.texto });
    }
    g.peca = g.pecas[0] || null;
    return { onde: g.onde.slice(0, 6), textos: g.textos.slice(0, 6), itens: g.itens, pecas: g.pecas, peca: g.peca };
  };
  const pecasDe = (lista) => [...new Set(lista.map((b) => b.peca))];
  // a cor passa em todos os textos dados (o pior fundo de cada um, contra o mínimo dele)?
  const { contraste } = require('../marca/legibilidade');
  const passa = (cor, lista) => lista.every((b) => Math.min(...b.amostras.map((a) => contraste(cor, a))) >= b.minimo);
  // A cor sugerida não pode deixar difícil nenhum texto que HOJE se lê, em nenhum estilo da empresa (`empresa.todos`: todos
  // os textos medidos pelo gerador; conta exata texto a texto, com o papel como cor do texto e como cor do fundo).
  const naoEstraga = (p, cor) => !empresa || estragaComMemo(empresa, cores, p, cor).length === 0;
  // a mesma cor nunca vai para dois papéis na mesma peça (uma troca anularia a outra): a do papel que vem antes fica
  let usadas = new Map();
  const livre = (lista, cor) => !lista.some((b) => (usadas.get(b.peca) || new Set()).has(cor));
  const sugestoesPara = (p, lista) => {
    let s = [];
    try { s = sugerir({ papel: p, cores, fundo: { amostras: [...new Set(lista.flatMap((b) => b.amostras))] }, minimo: Math.max(...lista.map((b) => b.minimo)) }); } catch { s = []; }
    return (Array.isArray(s) ? s : []).filter((x) => ehObjeto(x) && typeof x.cor === 'string' && HEX.test(x.cor) && x.cor.toUpperCase() !== cores[p])
      .map((x) => ({ cor: x.cor.toUpperCase(), contraste: Number(x.contraste) || null, origem: textoLimpo(x.origem, 20), rotulo: textoLimpo(x.rotulo) }))
      .filter((x) => passa(x.cor, lista) && naoEstraga(p, x.cor) && livre(lista, x.cor)).slice(0, 3); // conferida contra cada texto de cada peça do grupo
  };
  // As peças que vão para "estilo": as que têm um texto que nenhuma cor resolve (o gerador disse) e as que ficam de fora
  // da cor do seu papel. Uma peça em "estilo" sai de todos os grupos de cor (nunca aparece nos dois lugares).
  const doEstilo = new Set(textos.filter((b) => b.papel === null).map((b) => b.peca));
  const grupos = {};
  for (let volta = 0; volta < 50; volta++) {
    let mudou = false;
    usadas = new Map();
    const marcar = (p) => { if (grupos[p]) for (const b of grupos[p].lista) { if (!usadas.has(b.peca)) usadas.set(b.peca, new Set()); grupos[p].sugestoes.forEach((x) => usadas.get(b.peca).add(x.cor)); } };
    for (const p of PAPEIS_COR) {
      const lista = textos.filter((b) => b.papel === p && !doEstilo.has(b.peca));
      grupos[p] = null;
      if (!lista.length) continue;
      if (!sugerir) { grupos[p] = { lista, sugestoes: [] }; continue; }
      const juntas = sugestoesPara(p, lista);
      if (juntas.length) { grupos[p] = { lista, sugestoes: juntas }; marcar(p); continue; }
      // nenhuma cor serve a todas as peças do papel: a cor que resolve o maior grupo de peças (empate: a ordem das peças e
      // das sugestões); as outras peças vão para "estilo" e o papel é refeito na próxima volta
      const pecas = pecasDe(lista);
      const candidatas = [];
      for (const k of pecas) for (const s of sugestoesPara(p, lista.filter((b) => b.peca === k))) if (!candidatas.some((c) => c.cor === s.cor)) candidatas.push(s);
      let melhor = null;
      let resolvidas = [];
      for (const c of candidatas) {
        const ok = pecas.filter((k) => passa(c.cor, lista.filter((b) => b.peca === k)));
        if (ok.length > resolvidas.length) { melhor = c; resolvidas = ok; }
      }
      const fora = pecas.filter((k) => !resolvidas.includes(k));
      if (!fora.length) { grupos[p] = { lista, sugestoes: [melhor] }; marcar(p); continue; } // a melhor serve a todas (o sugerir juntas não a achou)
      for (const k of fora) doEstilo.add(k);
      mudou = true;
    }
    if (!mudou) break;
  }
  const saida = [];
  for (const p of PAPEIS_COR) if (grupos[p]) saida.push({ tipo: 'cor', papel: p, ...grupoDe(grupos[p].lista), sugestoes: grupos[p].sugestoes });
  const doEstiloTextos = textos.filter((b) => doEstilo.has(b.peca));
  // Calibragem: se TODOS os textos difíceis do estilo são pequenos (mínimo 4,5) e estão a menos de 0,5 do mínimo, o grupo
  // "estilo" vira "detalhe" (frase mais leve na tela, sem mandar trocar de estilo).
  // Só para poucos textos: no máximo 2, numa peça só, curtos (selo, iniciais, rótulo; nunca texto corrido).
  const soDetalhe = textos.length > 0 && textos.length <= 2 && pecasDe(textos).length === 1
    && textos.every((b) => b.minimo === 4.5 && b.curto && typeof b.contraste === 'number' && b.contraste >= b.minimo - 0.5);
  if (doEstiloTextos.length) saida.push({ tipo: soDetalhe ? 'detalhe' : 'estilo', ...grupoDe(doEstiloTextos) });
  return saida;
}

// ---- Todos os textos medidos da empresa (legibilidade.todos) e a conta "esta cor estraga outro texto?" ----
// O gerador guarda, por estilo, cada texto medido de forma compacta: { f: formato, l: lâmina, k: id do texto na peça,
// t: texto (até 40), p: papel da cor do texto (ou null), c: cor do texto, al: opacidade, md: cor média do fundo, q: as
// amostras do fundo nos quantis 25/50/75, m: mínimo, ct: contraste medido }. A conta refaz o contraste como o gerador mede
// (a cor efetiva do texto contra cada quantil) com uma troca aplicada: o papel trocado muda a cor do texto (se o texto é
// desse papel) e as amostras do fundo que são a cor de hoje do papel (tolerância de 8 por canal), sem render.
const canal = (h, i) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
const lumHex = (h) => [0, 1, 2].map((i) => { const s = canal(h, i) / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
  .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const razao = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const pertoHex = (a, b) => [0, 1, 2].every((i) => Math.abs(canal(a, i) - canal(b, i)) <= 8);
const mistura = (a, b, al) => '#' + [0, 1, 2].map((i) => Math.round(al * canal(a, i) + (1 - al) * canal(b, i)).toString(16).padStart(2, '0')).join('').toUpperCase();
function guardadoValido(x) {
  return ehObjeto(x) && FORMATOS.includes(x.f) && Number.isInteger(x.l) && x.l >= 1 && (x.p === null || PAPEIS_COR.includes(x.p))
    && typeof x.c === 'string' && HEX.test(x.c) && typeof x.md === 'string' && HEX.test(x.md) && Array.isArray(x.q) && x.q.length >= 1
    && x.q.every((h) => typeof h === 'string' && HEX.test(h)) && typeof x.al === 'number' && x.al >= 0 && x.al <= 1 && (x.m === 3 || x.m === 4.5);
}
// O contraste de um texto guardado; `troca` = { papel, de: cor de hoje do papel, para: cor nova } (ou nada: o de hoje).
function contrasteGuardado(t, troca = null) {
  const muda = (h) => (troca && pertoHex(h.toUpperCase(), troca.de) ? troca.para : h.toUpperCase());
  const cor = troca && t.p === troca.papel ? troca.para : t.c.toUpperCase();
  const lf = lumHex(mistura(cor, muda(t.md), t.al));
  return +Math.min(...t.q.map((h) => razao(lf, lumHex(muda(h))))).toFixed(2);
}
// Os textos guardados de todas as prévias que valem hoje da empresa: [{ estilo, ...texto }].
function textosDaEmpresa(r, codigo, assinatura = assinaturaDaMarca(r, codigo).assinatura) {
  const pasta = pastaDaEmpresa(r, codigo);
  const saida = [];
  if (!assinatura) return saida;
  let nomes = [];
  try { nomes = fs.readdirSync(pasta, { withFileTypes: true }).filter((e) => e.isDirectory() && nomeSimples(e.name)).map((e) => e.name); } catch { return saida; }
  for (const id of nomes) {
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(pasta, id, 'previas.json'), 'utf8')); } catch { continue; }
    if (!ehObjeto(m) || m.cores !== 'marca' || m.empresa !== codigo || m.estilo !== id || m.assinatura !== assinatura || m.identidade !== 'empresa') continue;
    const todos = ehObjeto(m.legibilidade) && Array.isArray(m.legibilidade.todos) ? m.legibilidade.todos : [];
    for (const x of todos) if (guardadoValido(x)) saida.push({ estilo: id, ...x, t: textoLimpo(x.t, 40) });
  }
  return saida;
}
// Os textos da empresa e a memória da conta, guardados enquanto a marca (assinatura) e os previas.json da empresa (data e
// tamanho de cada um) não mudam: a grade relida não refaz a conta.
const contextos = new Map();
function contextoDaEmpresa(r, codigo, assinatura) {
  const pasta = pastaDaEmpresa(r, codigo);
  let marcas = [];
  try {
    marcas = fs.readdirSync(pasta, { withFileTypes: true }).filter((e) => e.isDirectory() && nomeSimples(e.name)).map((e) => {
      try { const st = fs.statSync(path.join(pasta, e.name, 'previas.json')); return e.name + ':' + st.mtimeMs + ':' + st.size; } catch { return null; }
    }).filter(Boolean).sort();
  } catch { /* ainda sem prévias */ }
  const chave = path.resolve(r) + '|' + codigo + '|' + assinatura + '|' + marcas.join(',');
  if (!contextos.has(chave)) {
    for (const k of [...contextos.keys()]) if (k.startsWith(path.resolve(r) + '|' + codigo + '|')) contextos.delete(k);
    if (contextos.size > 50) contextos.clear();
    contextos.set(chave, { todos: textosDaEmpresa(r, codigo, assinatura), memo: new Map() });
  }
  return contextos.get(chave);
}
// Os textos que HOJE se leem e, com a cor `cor` no lugar do papel, ficam abaixo do mínimo.
function estragaria(todos, cores, papel, cor) {
  const de = cores[papel];
  if (!de) return [];
  const troca = { papel, de: de.toUpperCase(), para: cor.toUpperCase() };
  return todos.filter((t) => contrasteGuardado(t) >= t.m && contrasteGuardado(t, troca) < t.m);
}
function estragaComMemo(empresa, cores, papel, cor) {
  if (!empresa.memo) empresa.memo = new Map();
  const k = papel + cor;
  if (!empresa.memo.has(k)) empresa.memo.set(k, estragaria(empresa.todos || [], cores, papel, cor));
  return empresa.memo.get(k);
}
// Para quem chama de fora (o "Como ficaria"): os textos da empresa que a troca estragaria.
function textosQueEstraga(r, codigo, papel, cor) {
  const inst = instantaneoDaMarca(r, codigo);
  if (!inst.definida) return [];
  const cores = {};
  for (const p of PAPEIS_COR) { const v = ehObjeto(inst.dados.cores) ? inst.dados.cores[p] : null; if (typeof v === 'string' && HEX.test(v.trim())) cores[p] = v.trim().toUpperCase(); }
  return estragaComMemo(contextoDaEmpresa(r, codigo, inst.assinatura), cores, papel, cor.toUpperCase());
}

// As prévias na marca de um estilo que valem hoje, ou null. Só sai endereço de arquivo que existe, de previas.json com
// cores "marca", da própria empresa, do próprio estilo, com a assinatura pedida e a identidade pedida (padrão: a da
// empresa, decisão D1); o vídeo, só com videoAssinatura igual. `leitura`: o que a marca deixou difícil de ler (acima),
// conferida contra os textos de todos os estilos da empresa (`empresa`: { todos, memo }, lido aqui se não vier pronto).
function previasValidas(r, codigo, id, assinatura, { identidade = 'empresa', empresa = null } = {}) {
  const pasta = pastaDaEmpresa(r, codigo);
  if (!nomeSimples(id) || typeof assinatura !== 'string' || assinatura === '') return null;
  const dir = path.join(pasta, id);
  let m;
  try { m = JSON.parse(fs.readFileSync(path.join(dir, 'previas.json'), 'utf8')); } catch { return null; }
  if (!ehObjeto(m) || m.cores !== 'marca' || m.empresa !== codigo || m.estilo !== id || m.assinatura !== assinatura || m.identidade !== identidade) return null;
  const u = (nome) => (nomeSimples(nome) && ehArquivo(path.join(dir, nome))
    ? `/empresas/${encodeURIComponent(codigo)}/previas/${encodeURIComponent(id)}/${encodeURIComponent(nome)}` : null);
  const capa = u(m.capa);
  if (!capa) return null;
  const carrossel = Array.isArray(m.carrossel) ? m.carrossel.map(u).filter(Boolean) : [];
  const f = ehObjeto(m.fixados) ? { apresentacao: u(m.fixados.apresentacao), metodo: u(m.fixados.metodo), contratar: u(m.fixados.contratar) } : null;
  const fixados = f && (f.apresentacao || f.metodo || f.contratar) ? f : null;
  const videoVale = m.videoAssinatura === assinatura && u(m.video) && u(m.videoCapa);
  const avisos = Array.isArray(m.avisos) ? m.avisos.filter((a) => typeof a === 'string' && a.trim() !== '').slice(0, 50) : [];
  return {
    capa, carrossel, fixados, reelsCapa: u(m.reelsCapa),
    video: videoVale ? u(m.video) : null, videoCapa: videoVale ? u(m.videoCapa) : null, avisos,
    leitura: leituraDificil(m.legibilidade, { empresa: empresa || contextoDaEmpresa(r, codigo, assinatura) }),
  };
}

// A nota da letra de destaque (spec 10), para os detalhes técnicos do estilo na marca: o estilo destaca em itálico
// (tratamentos.destaque com "italico") e a letra principal da marca não tem itálico, pela mesma regra do tema-marca.js
// (nome do arquivo com "italic" ou tipografia.principal.italico: true). Sem marca, sem letra principal citada, estilo que
// não existe ou id torto: null. Empresa fora da lista: erro EMPRESA_DESCONHECIDA. Só lê.
const NOTA_DESTAQUE = 'No destaque, este estilo usa a letra itálica dele, porque a sua letra principal não tem itálico.';
function notaDestaque(r, codigo, estilo) {
  const { c } = conferir(r, codigo);
  if (!nomeSimples(estilo) || !ehArquivo(c.marca)) return null;
  let y;
  try { y = lerYaml(fs.readFileSync(path.join(r, '04-LABORATORIO-DE-DESIGN', 'estilos', estilo, 'estilo.yaml'), 'utf8')); } catch { return null; }
  const destaque = ehObjeto(y) && ehObjeto(y.tratamentos) && typeof y.tratamentos.destaque === 'string' ? y.tratamentos.destaque : '';
  if (!destaque.split('+').map((x) => x.trim()).includes('italico')) return null;
  const dados = dadosEfetivos(lerDados(textoDaMarca(c.marca)));
  const principal = ehObjeto(dados.tipografia) && ehObjeto(dados.tipografia.principal) ? dados.tipografia.principal : {};
  const arquivo = typeof principal.arquivo === 'string' ? principal.arquivo.trim() : '';
  if (!arquivo || /italic/i.test(path.basename(arquivo)) || principal.italico === true) return null;
  return NOTA_DESTAQUE;
}

module.exports = { contrasteGuardado, contextoDaEmpresa, textosDaEmpresa, estragaria, textosQueEstraga, notaDestaque, VERSAO, CAMPOS_DA_PECA, dadosEfetivos, arquivosDaMarca, arquivosDosDados, assinaturaDaMarca, assinaturaDosDados, instantaneoDaMarca, previasValidas, pastaDaEmpresa, leituraDificil };
