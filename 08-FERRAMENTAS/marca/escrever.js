#!/usr/bin/env node
// Gravador da marca (marca.yaml da empresa), para o painel e para o agente: ninguém edita o marca.yaml à mão.
//
// Não há gravador de YAML nesta máquina, e o marca.yaml tem comentários e blocos que a pessoa ou o agente escreveram.
// Por isso o gravador troca SÓ as linhas das chaves pedidas (empresa.nome, cores.*, tipografia.<papel>.arquivo,
// pecas.logo e a chave `origem` no topo) e deixa o resto do arquivo igual, byte a byte: comentários, blocos extras, o
// fim de linha de cada linha (LF ou CRLF) e o BOM. Chave que falta é acrescentada no fim do bloco dela (ou do arquivo).
// Antes de trocar o arquivo, o novo texto é gravado num temporário, relido com o leitor de YAML da Fábrica e conferido
// (os valores pedidos estão lá e nada mais mudou); só então a versão anterior vai para o histórico e o arquivo é trocado.
//
// Histórico (pasta `historico` da empresa), um arquivo por gravação, nunca por cima de outro:
//   marca-<AAAA-MM-DD-HHMMSS>Z[-N].yaml        o marca.yaml como estava antes da gravação, byte a byte
//   marca-<AAAA-MM-DD-HHMMSS>Z[-N]-vazio.yaml  marca que antes da gravação não havia marca
//   ...-antes-de-desfazer.yaml                 o marca.yaml como estava antes de um "Desfazer"
// "Desfazer" volta a cópia mais recente ainda não desfeita e acrescenta "-desfeito" ao nome dela (nada é apagado).
//
// Sem marca, o arquivo novo parte do marca.exemplo.yaml, com o nome da empresa, a conta vazia e as correções de grafia
// da transcrição vazias (nada da empresa fictícia do exemplo vai para uma empresa). A marca que nasce de um estilo é
// gravada por gravarDoEstilo: se a gravação for recusada, as letras que acabaram de ser copiadas saem. A letra escolhida
// da lista de letras da Fábrica também é COPIADA para a pasta da empresa (fontes/, com a licença): se a gravação for
// recusada, a cópia sai; o "Desfazer" dessa gravação também a tira (marca-<...>.copias.json no histórico diz quais).
// Caminhos de arquivo: na pasta antiga, relativos à raiz; numa empresa nova, relativos à pasta dela (o marca.js acha os
// dois; uma marca antiga que ainda aponta para a pasta de letras do modelo continua valendo).
//
// Linha de comando (para o agente, só depois da escolha explícita da pessoa; a raiz é FABRICA_RAIZ ou a de sempre):
//   node 08-FERRAMENTAS/marca/escrever.js gravar <codigo> <valores.json> [--origem <origem>]
//   node 08-FERRAMENTAS/marca/escrever.js desfazer <codigo>
//   node 08-FERRAMENTAS/marca/escrever.js do-estilo <codigo> <estilo>
// valores.json = { nome?, cores?: { escuro, claro, acento, neutro }, fontes?: { principal?, mono?, acento? }, logo?,
// origem? }, com caminhos absolutos ou relativos à raiz da Fábrica. Origem: manual, logo, do-zero, pessoa,
// estilo:<id> ou estilo-proprio:<id>.
// Saída: 0 = deu certo, 1 = recusa (mensagem em português), 2 = erro de uso ou erro inesperado.
'use strict';
const fs = require('fs');
const path = require('path');
const empresaMod = require('../../_fabrica/core/empresa');
const { lerYaml } = require('./yaml');

const RAIZ_MODELO = path.resolve(__dirname, '..', '..');
const PASTA_LETRAS = path.join(RAIZ_MODELO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const EXEMPLO = path.join(RAIZ_MODELO, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml');
const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const PAPEIS_LETRA = ['principal', 'mono', 'acento'];
const CAMPOS = ['nome', 'cores', 'fontes', 'logo', 'origem'];
const LETRA = /\.(ttf|otf)$/i;
const IMAGEM = /\.(svg|png|jpe?g|webp)$/i;
const ORIGEM = /^(manual|logo|do-zero|pessoa|(estilo|estilo-proprio):[A-Za-z0-9][A-Za-z0-9._-]*)$/;
const LIMITE_NOME = 120;
// Caracteres montados pelo código (nenhum caractere invisível fica escrito neste arquivo).
const car = (n) => String.fromCharCode(n);
const faixa = (a, b) => `${car(a)}-${car(b)}`;
const BOM = car(0xfeff);
const BOM_INICIO = new RegExp('^' + BOM);
const semBom = (s) => s.replace(BOM_INICIO, '');
const BARRA = car(92);
// controles (C0, DEL, C1), invisíveis, marcas de direção e separadores de linha do Unicode
const INVISIVEIS = new RegExp(`[${faixa(0x00, 0x1f)}${faixa(0x7f, 0x9f)}${faixa(0x200b, 0x200f)}${faixa(0x2028, 0x202e)}${faixa(0x2060, 0x2069)}${BOM}]`);

const recusa = (erro) => Object.assign(new Error(erro), { recusaDoPedido: true, status: 400, code: 'RECUSA' });
const trecho = (v) => JSON.stringify(String(v).slice(0, 60));
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const NOME_SIMPLES = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const nomeSimples = (n) => typeof n === 'string' && NOME_SIMPLES.test(n) && !n.includes('..');
const dois = (n) => String(n).padStart(2, '0');
const carimboUtc = (d) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}-${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}`;
const posix = (p) => p.split(path.sep).join('/');
const clonar = (v) => JSON.parse(JSON.stringify(v));

function caminhosDa(r, codigo) {
  if (typeof codigo !== 'string' || codigo === '') throw recusa('Faltou a empresa. Escolha a empresa no seletor.');
  const entrada = empresaMod.listar(r).find((e) => e.codigo === codigo);
  if (!entrada) throw recusa(`A empresa ${trecho(codigo)} não existe nesta pasta. Escolha a empresa no seletor.`);
  return { c: empresaMod.caminhos(codigo, r), entrada };
}

// ---------- caminhos de arquivo ----------

// O caminho real (sem atalho) de um arquivo que existe, ou null.
function real(p) { try { return fs.realpathSync(p); } catch { return null; } }
function dentro(pasta, arq) {
  const p = real(pasta);
  if (!p || !arq) return false;
  const rel = path.relative(p, arq);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// Confere um arquivo de letra ou de logo e devolve o texto que vai no marca.yaml. `v`: absoluto ou relativo à raiz.
// A letra da lista de letras da Fábrica é COPIADA para <pastaMarca>/fontes/, com a licença ao lado (como a marca que
// nasce de um estilo): a marca não muda nem quebra quando o modelo atualiza. O que a cópia criou vai para `criados`.
// Os papéis de letra nas palavras da tela (o agente repassa a recusa à pessoa).
const NOME_DA_LETRA = { principal: 'letra principal', mono: 'letra dos rótulos', acento: 'letra de destaque' };
function caminhoParaMarca(r, c, legado, v, { tipo, campo, criados }) {
  const qual = tipo === 'letra' ? `da ${NOME_DA_LETRA[campo] || 'letra'}` : 'do logo';
  if (typeof v !== 'string' || v.trim() === '') throw recusa(`Escolha o arquivo ${qual}.`);
  const abs = path.resolve(r, v);
  const arq = ehArquivo(abs) ? real(abs) : null;
  if (!arq) throw recusa(`Não encontrei o arquivo ${qual}. Envie o arquivo de novo.`);
  if (tipo === 'letra' && !LETRA.test(arq)) throw recusa(`O arquivo ${qual} precisa ser um arquivo de letra.`);
  if (tipo === 'logo' && !IMAGEM.test(arq)) throw recusa('O logo precisa ser uma imagem.');
  if (tipo === 'letra' && dentro(PASTA_LETRAS, arq)) {
    const copia = real(copiarDaLista(arq, c, criados));
    return posix(path.relative(legado ? real(r) : real(c.pastaMarca), copia));
  }
  if (!dentro(c.pastaMarca, arq)) {
    throw recusa(tipo === 'letra'
      ? `A ${NOME_DA_LETRA[campo] || 'letra'} precisa estar na pasta da empresa ou na lista de letras da Fábrica.`
      : 'O logo precisa estar na pasta da empresa. Envie o arquivo de novo.');
  }
  return posix(path.relative(legado ? real(r) : real(c.pastaMarca), arq));
}

// ---------- o YAML linha a linha ----------

// Comentário só quando o # vem depois de espaço (ou no começo) e fora de aspas: a mesma regra do leitor (yaml.js).
function inicioDoComentario(s) {
  let aspas = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (aspas) { if (ch === aspas && s[i - 1] !== '\\') aspas = null; continue; }
    if (ch === '"' || ch === "'") aspas = ch;
    else if (ch === '#' && (i === 0 || /\s/.test(s[i - 1]))) return i;
  }
  return -1;
}
const semComentario = (s) => { const i = inicioDoComentario(s); return (i < 0 ? s : s.slice(0, i)).replace(/\s+$/, ''); };
const CHAVE = /^("([^"]*)"|'([^']*)'|[^:]+?)\s*:(\s+(.*))?$/;

// Separa o texto em linhas, cada uma com o seu fim de linha.
function partir(texto) {
  const partes = texto.split(/(\r\n|\n|\r)/);
  const ls = [];
  for (let i = 0; i < partes.length; i += 2) ls.push({ txt: partes[i], fim: partes[i + 1] || '' });
  if (ls.length > 1 && ls[ls.length - 1].txt === '' && ls[ls.length - 1].fim === '') ls.pop();
  return ls;
}
const juntar = (ls) => ls.map((l) => l.txt + l.fim).join('');
const recuo = (s) => s.length - s.trimStart().length;

// As chaves de mapa que dá para endereçar, com a rota (ex.: ['cores', 'escuro']). Conteúdo de texto em bloco (| ou >)
// e itens de lista ficam de fora: nada dentro deles é confundido com uma chave da marca.
function indexar(ls) {
  const chaves = [];
  const pilha = [];
  let blocoTexto = null;
  ls.forEach((l, i) => {
    if (blocoTexto !== null) {
      if (l.txt.trim() === '' || recuo(l.txt) > blocoTexto) return;
      blocoTexto = null;
    }
    const s = semComentario(l.txt);
    if (s.trim() === '') return;
    const ind = recuo(s);
    const txt = s.trim();
    while (pilha.length && pilha[pilha.length - 1].ind >= ind) pilha.pop();
    const pai = pilha.length ? pilha[pilha.length - 1] : null;
    const m = txt.startsWith('-') ? null : CHAVE.exec(txt);
    if (!m || (pai && pai.rota === null)) { pilha.push({ ind, rota: null }); return; }
    const chave = m[2] ?? m[3] ?? m[1].trim();
    const valor = m[5] ?? '';
    const rota = pai ? [...pai.rota, chave] : [chave];
    chaves.push({ rota: rota.join('.'), linha: i, ind, valor, chave });
    pilha.push({ ind, rota });
    if (/^[>|][+-]?$/.test(valor.trim())) blocoTexto = ind;
  });
  return chaves;
}

const aspas = (v) => `"${String(v).replace(/"/g, '\\"')}"`;
const naoTroca = () => recusa('O arquivo da marca está num formato que eu não consigo trocar sem mexer no resto. Nada foi alterado; peça ajuda no Claude.');

// O fim de linha a usar numa linha nova: o da linha de referência, senão o primeiro do arquivo, senão LF.
function fimPadrao(ls, ref) {
  if (ref && ref.fim) return ref.fim;
  const algum = ls.find((l) => l.fim);
  return algum ? algum.fim : '\n';
}
function inserir(ls, depoisDe, novas) {
  // depoisDe = -1: no começo
  const ref = depoisDe >= 0 ? ls[depoisDe] : null;
  const fim = fimPadrao(ls, ref || ls[0]);
  const linhasNovas = novas.map((txt) => ({ txt, fim }));
  if (ref && !ref.fim) { ref.fim = fim; linhasNovas[linhasNovas.length - 1].fim = ''; }
  ls.splice(depoisDe + 1, 0, ...linhasNovas);
}

// A última linha de conteúdo do bloco da chave `e` (os filhos, com recuo maior).
function fimDoBloco(ls, e) {
  let ultima = e.linha;
  for (let i = e.linha + 1; i < ls.length; i++) {
    const s = semComentario(ls[i].txt);
    if (s.trim() === '') continue;
    if (recuo(s) <= e.ind) break;
    ultima = i;
  }
  return ultima;
}

// Põe `valor` (já no formato do YAML) na chave da rota, trocando só a parte do valor da linha (o recuo, o espaço antes
// do comentário e o comentário ficam), ou acrescenta a chave no fim do bloco do pai.
function definir(ls, rota, valor) {
  const chaves = indexar(ls);
  const achadas = chaves.filter((e) => e.rota === rota.join('.'));
  if (achadas.length > 1) throw naoTroca();
  if (achadas.length === 1) {
    const e = achadas[0];
    const l = ls[e.linha];
    // tem filhos? então é um bloco, não um valor: não troca
    const filho = chaves.find((x) => x.linha > e.linha && x.rota.startsWith(e.rota + '.'));
    const proxima = ls.slice(e.linha + 1).find((x) => semComentario(x.txt).trim() !== '');
    if (filho || (e.valor.trim() === '' && proxima && recuo(semComentario(proxima.txt)) > e.ind)) throw naoTroca();
    const inicio = recuo(l.txt);
    const mc = /^("[^"]*"|'[^']*'|[^:]+?)\s*:/.exec(l.txt.slice(inicio));
    if (!mc) throw naoTroca();
    const cabeca = l.txt.slice(0, inicio + mc[0].length);
    const resto = l.txt.slice(inicio + mc[0].length);
    const ic = inicioDoComentario(resto);
    if (ic >= 0 && resto.slice(0, ic).trim() !== '') {
      const antes = resto.slice(0, ic);
      const espaco = /\s*$/.exec(antes)[0] || ' ';
      l.txt = `${cabeca} ${valor}${espaco}${resto.slice(ic)}`;
    } else if (ic >= 0) {
      l.txt = `${cabeca} ${valor} ${resto.slice(ic).trimStart()}`;
    } else {
      l.txt = `${cabeca} ${valor}`;
    }
    return;
  }
  const chave = rota[rota.length - 1];
  // valor null = só a linha da chave, para um bloco que vai receber os filhos
  const linhaDe = (ind) => `${' '.repeat(ind)}${chave}:${valor === null ? '' : ` ${valor}`}`;
  if (rota.length === 1) {
    // chave do topo: `origem` vai antes da primeira chave do topo; as outras, no fim do arquivo
    const primeira = chaves.find((x) => x.ind === 0);
    if (chave === 'origem' && primeira) inserir(ls, primeira.linha - 1, [linhaDe(0)]);
    else inserir(ls, ls.length - 1, [linhaDe(0)]);
    return;
  }
  const rotaPai = rota.slice(0, -1);
  const pai = chaves.find((x) => x.rota === rotaPai.join('.'));
  if (!pai) {
    definir(ls, rotaPai, null); // cria o bloco do pai (vazio) e tenta de novo
    definir(ls, rota, valor);
    return;
  }
  if (pai.valor.trim() !== '') throw naoTroca(); // o pai tem um valor em linha (ex.: { ... }): não mexe
  const filhos = chaves.filter((x) => x.linha > pai.linha && x.rota.startsWith(pai.rota + '.') && x.rota.split('.').length === rota.length);
  const ind = filhos.length ? filhos[0].ind : pai.ind + 2;
  inserir(ls, fimDoBloco(ls, pai), [linhaDe(ind)]);
}

// Esvazia o bloco da chave da rota: tira as linhas dos filhos (e os comentários entre eles) e deixa `chave: {}`, com o
// recuo e o comentário da linha da chave. Só para a marca nova que parte do exemplo.
function esvaziar(ls, rota) {
  const achadas = indexar(ls).filter((e) => e.rota === rota.join('.'));
  if (achadas.length !== 1) throw naoTroca();
  const e = achadas[0];
  const ultima = fimDoBloco(ls, e);
  if (ultima > e.linha) ls.splice(e.linha + 1, ultima - e.linha);
  definir(ls, rota, '{}');
}

// Aplica as trocas ao texto (sem BOM). Devolve o texto novo.
function aplicar(texto, trocas) {
  const ls = partir(texto);
  for (const x of trocas) {
    if (x.esvaziar) esvaziar(ls, x.rota);
    else definir(ls, x.rota, x.valor);
  }
  return juntar(ls);
}

function colocar(obj, rota, v) {
  let o = obj;
  for (const k of rota.slice(0, -1)) { if (!ehObjeto(o[k])) o[k] = {}; o = o[k]; }
  o[rota[rota.length - 1]] = v;
}

// ---------- o histórico ----------

const ENTRADA = /^marca-(\d{4}-\d{2}-\d{2}-\d{6})Z(?:-(\d+))?(-vazio|-antes-de-desfazer)?(-desfeito)?\.yaml$/;
function entradas(c) {
  let nomes = [];
  try { nomes = fs.readdirSync(c.historico); } catch { /* sem histórico ainda */ }
  return nomes.map((nome) => {
    const m = ENTRADA.exec(nome);
    return m && { nome, ts: m[1], n: m[2] ? Number(m[2]) : 1, tipo: m[3] || '', desfeito: !!m[4] };
  }).filter(Boolean);
}
function guardar(c, bytes, agora, tipo = '') {
  fs.mkdirSync(c.historico, { recursive: true });
  const ts = carimboUtc(agora);
  const ocupados = new Set(entradas(c).filter((e) => e.ts === ts).map((e) => e.n));
  const sufixo = bytes === null ? '-vazio' : tipo;
  const conteudo = bytes === null ? '# Antes desta gravação a empresa não tinha marca.\n' : bytes;
  for (let n = 1; ; n++) {
    if (ocupados.has(n)) continue;
    const arq = path.join(c.historico, `marca-${ts}Z${n === 1 ? '' : `-${n}`}${sufixo}.yaml`);
    try {
      fs.writeFileSync(arq, conteudo, { flag: 'wx' }); // nunca por cima
      return arq;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}
function trocarAtomico(arq, conteudo) {
  const tmp = `${arq}.${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, conteudo, { flag: 'wx' });
  try { fs.renameSync(tmp, arq); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* fica o temporário */ } throw e; }
}

// ---------- gravar ----------

// Confere `valores` e devolve a lista de trocas [{ rota, valor (texto YAML), esperado (o que o leitor deve ler) }].
function trocasDe(r, c, legado, valores, origem, criados) {
  if (!ehObjeto(valores)) throw recusa('A marca veio num formato que não entendi. Tente de novo pela tela.');
  const estranho = Object.keys(valores).find((k) => !CAMPOS.includes(k));
  if (estranho) throw recusa(`O campo ${trecho(estranho)} não faz parte da marca. Use nome, cores, letras e logo.`);
  const trocas = [];
  const por = (rota, esperado) => trocas.push({ rota, valor: aspas(esperado), esperado });
  if (tem(valores, 'nome')) {
    const n = valores.nome;
    if (typeof n !== 'string' || n.trim() === '' || n.trim().length > LIMITE_NOME || /[\r\n]/.test(n)) {
      throw recusa(`O nome da marca precisa ser um texto de uma linha, com até ${LIMITE_NOME} caracteres.`);
    }
    if (INVISIVEIS.test(n)) throw recusa('O nome da marca não pode ter caracteres de controle ou invisíveis. Digite o nome de novo.');
    // O leitor de YAML da Fábrica só conhece o escape \" dentro de aspas: a barra invertida vai como está e volta igual,
    // menos no fim do texto, onde ela "escaparia" as aspas de fecho.
    if (n.trim().endsWith(BARRA)) throw recusa('O nome da marca não pode terminar com barra invertida (\\). Tire a barra do fim do nome.');
    por(['empresa', 'nome'], n.trim());
  }
  if (tem(valores, 'cores')) {
    if (!ehObjeto(valores.cores)) throw recusa('As cores vieram num formato que não entendi.');
    for (const [papel, v] of Object.entries(valores.cores)) {
      if (!PAPEIS_COR.includes(papel)) throw recusa(`O papel de cor ${trecho(papel)} não existe. Os papéis são: fundo escuro, fundo claro, destaque e apoio.`);
      if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) throw recusa(`O código da cor ${trecho(v)} não serve: use # seguido de seis números ou letras de A a F.`);
      por(['cores', papel], v.toUpperCase());
    }
  }
  if (tem(valores, 'fontes')) {
    if (!ehObjeto(valores.fontes)) throw recusa('As letras vieram num formato que não entendi.');
    for (const [papel, v] of Object.entries(valores.fontes)) {
      if (!PAPEIS_LETRA.includes(papel)) throw recusa(`O papel de letra ${trecho(papel)} não existe. Os papéis são: letra principal, letra dos rótulos e destaque.`);
      // A letra de destaque pode ficar vazia (a marca trabalha com duas vozes); as outras, não.
      if (papel === 'acento' && v === '') { por(['tipografia', papel, 'arquivo'], ''); continue; }
      por(['tipografia', papel, 'arquivo'], caminhoParaMarca(r, c, legado, v, { tipo: 'letra', campo: papel, criados }));
    }
  }
  if (tem(valores, 'logo')) {
    if (valores.logo === '') por(['pecas', 'logo'], '');
    else por(['pecas', 'logo'], caminhoParaMarca(r, c, legado, valores.logo, { tipo: 'logo', campo: 'logo' }));
  }
  if (typeof origem !== 'string' || !ORIGEM.test(origem)) throw recusa('Faltou dizer de onde vem esta marca (origem). Nada foi gravado.');
  por(['origem'], origem);
  return trocas;
}

// As letras que uma gravação copiou da lista de letras ficam anotadas ao lado da entrada de histórico dela
// (marca-<...>.copias.json, caminhos relativos à pasta da marca): o "Desfazer" dessa gravação tira essas cópias.
const arqCopias = (entradaYaml) => entradaYaml.replace(/\.yaml$/, '.copias.json');
function anotarCopias(c, hist, criados) {
  if (!hist || !criados.arquivos.length) return;
  const rel = (p) => posix(path.relative(c.pastaMarca, p));
  try {
    fs.writeFileSync(arqCopias(hist), JSON.stringify({ arquivos: criados.arquivos.map(rel), pastas: criados.pastas.map(rel) }, null, 2) + '\n', { flag: 'wx' });
  } catch (e) { console.error('Não consegui anotar as letras copiadas (o Desfazer vai deixá-las na pasta):', e.message); }
}
// Tira as cópias anotadas da gravação desfeita: só arquivos de <pastaMarca>/fontes/, e nada se a marca que voltou citar
// uma delas. A anotação fica, com o nome da entrada desfeita.
function tirarCopias(c, arqAlvo, desfeito) {
  const anotacao = arqCopias(arqAlvo);
  let lista;
  try { lista = JSON.parse(fs.readFileSync(anotacao, 'utf8')); } catch { return; }
  try { fs.renameSync(anotacao, arqCopias(desfeito)); } catch { /* fica com o nome antigo */ }
  if (!ehObjeto(lista)) return;
  let voltou = '';
  try { voltou = fs.readFileSync(c.marca, 'utf8'); } catch { /* voltou para sem marca */ }
  const fontes = path.join(c.pastaMarca, 'fontes');
  const daPasta = (rel) => {
    if (typeof rel !== 'string' || rel === '' || path.isAbsolute(rel)) return null;
    const abs = real(path.resolve(c.pastaMarca, rel));
    return abs && (abs === real(fontes) || dentro(fontes, abs)) ? abs : null;
  };
  const arquivos = (Array.isArray(lista.arquivos) ? lista.arquivos : []).map(daPasta).filter((abs) => abs && ehArquivo(abs));
  // a marca que voltou cita uma dessas letras (não devia acontecer): fica tudo, a letra e a licença dela
  if (arquivos.some((abs) => voltou.includes(path.basename(abs)))) return;
  for (const abs of arquivos) { try { fs.unlinkSync(abs); } catch { /* fica */ } }
  for (const rel of Array.isArray(lista.pastas) ? lista.pastas : []) {
    const abs = daPasta(rel);
    if (abs) { try { fs.rmdirSync(abs); } catch { /* não está vazia: fica */ } }
  }
}

// Grava a marca da empresa. valores = { nome?, cores?, fontes?, logo?, origem? }; a origem também pode vir em `opcoes`.
// Devolve { arquivo, historico } (caminhos absolutos). `agora` existe para os testes.
// A letra da lista de letras é copiada para a pasta da empresa (caminhoParaMarca); se a gravação for recusada (ou
// falhar), as cópias que ela acabou de fazer saem.
// `opcoes.copiasFeitas` ({ arquivos, pastas }): letras que quem chama acabou de copiar para esta gravação (a marca que nasce
// do estilo). Elas entram na anotação do histórico, e o "Desfazer" desta gravação as tira junto com as da própria gravação.
function gravarMarca(r, codigo, valores, opcoes = {}) {
  const previas = ehObjeto(opcoes.copiasFeitas) ? opcoes.copiasFeitas : {};
  const criados = { arquivos: Array.isArray(previas.arquivos) ? previas.arquivos.slice() : [], pastas: Array.isArray(previas.pastas) ? previas.pastas.slice() : [] };
  try {
    return gravarMarcaComCopias(r, codigo, valores, opcoes, criados);
  } catch (e) {
    desfazerCopia(criados);
    throw e;
  }
}
function gravarMarcaComCopias(r, codigo, valores, opcoes, criados) {
  const { c, entrada } = caminhosDa(r, codigo);
  const legado = entrada.disposicao === 'legado';
  if (ehObjeto(valores) && tem(valores, 'origem') && tem(opcoes, 'origem') && opcoes.origem !== undefined && valores.origem !== opcoes.origem) {
    throw recusa('A origem da marca veio de dois jeitos diferentes. Nada foi gravado.');
  }
  const origem = ehObjeto(valores) && tem(valores, 'origem') ? valores.origem : opcoes.origem;
  const { origem: _o, ...semOrigem } = ehObjeto(valores) ? valores : {};
  const trocas = trocasDe(r, c, legado, ehObjeto(valores) ? semOrigem : valores, origem, criados);
  const agora = opcoes.agora || new Date();

  let atual = null;
  try { atual = fs.readFileSync(c.marca); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  let base;
  let bom = false;
  if (atual) {
    base = atual.toString('utf8');
    if (base.startsWith(BOM)) { bom = true; base = base.slice(1); }
  } else {
    // marca nova: o exemplo, sem nada da empresa fictícia dele: o nome da empresa, a conta vazia e as correções de
    // grafia da transcrição vazias (as do exemplo corrigem o nome da empresa fictícia)
    base = semBom(fs.readFileSync(EXEMPLO, 'utf8'));
    if (!trocas.some((x) => x.rota.join('.') === 'empresa.nome')) trocas.unshift({ rota: ['empresa', 'nome'], valor: aspas(entrada.nome), esperado: entrada.nome });
    trocas.push({ rota: ['empresa', 'handle'], valor: aspas(''), esperado: '' });
  }
  let antes;
  try { antes = lerYaml(base); } catch { throw recusa('O arquivo da marca tem um erro de formato e eu não consigo lê-lo. Nada foi alterado; peça ajuda no Claude.'); }
  if (!ehObjeto(antes)) throw naoTroca();
  if (!atual && ehObjeto(antes.video) && tem(antes.video, 'correcoes-transcricao')) {
    trocas.push({ rota: ['video', 'correcoes-transcricao'], esvaziar: true, esperado: {} });
  }
  const novo = aplicar(base, trocas);
  const esperado = clonar(antes);
  for (const x of trocas) colocar(esperado, x.rota, x.esperado);
  const confere = (texto) => {
    let lido;
    try { lido = lerYaml(semBom(texto)); } catch { return false; }
    try { require('assert').deepStrictEqual(lido, esperado); return true; } catch { return false; }
  };
  if (!confere(novo)) throw naoTroca();

  // temporário, relido do disco e conferido; só então o histórico e a troca de nome
  fs.mkdirSync(path.dirname(c.marca), { recursive: true });
  const tmp = `${c.marca}.${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, (bom ? BOM : '') + novo, { encoding: 'utf8', flag: 'wx' });
  let hist = null;
  try {
    if (!confere(fs.readFileSync(tmp, 'utf8'))) throw naoTroca();
    hist = guardar(c, atual, agora);
    fs.renameSync(tmp, c.marca);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* já foi trocado ou não existe */ }
    // a troca de nome falhou depois da cópia de histórico: a cópia não pode gastar um passo do "Desfazer"
    if (hist) { try { fs.renameSync(hist, hist.replace(/\.yaml$/, '-desfeito.yaml')); } catch { try { fs.unlinkSync(hist); } catch { /* fica */ } } }
    throw e;
  }
  anotarCopias(c, hist, criados); // a marca já foi trocada: daqui em diante nada desfaz a cópia
  criados.arquivos = [];
  criados.pastas = [];
  return { arquivo: c.marca, historico: hist };
}

// Volta a marca anterior à última gravação ainda não desfeita. Devolve { restaurado }: true quando uma marca voltou,
// false quando antes não havia marca (a de agora fica guardada no histórico).
function desfazerMarca(r, codigo, { agora = new Date() } = {}) {
  const { c } = caminhosDa(r, codigo);
  const alvo = entradas(c).filter((e) => !e.desfeito && e.tipo !== '-antes-de-desfazer')
    .sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.n - b.n)).pop();
  if (!alvo) throw recusa('Não há nada para desfazer na marca.');
  const arqAlvo = path.join(c.historico, alvo.nome);
  let atual = null;
  try { atual = fs.readFileSync(c.marca); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (atual) guardar(c, atual, agora, '-antes-de-desfazer');
  let restaurado = false;
  if (alvo.tipo === '-vazio') {
    if (atual) fs.unlinkSync(c.marca); // antes não havia marca; a de agora ficou guardada no histórico
  } else {
    trocarAtomico(c.marca, fs.readFileSync(arqAlvo));
    restaurado = true;
  }
  const desfeito = arqAlvo.replace(/\.yaml$/, '-desfeito.yaml');
  fs.renameSync(arqAlvo, desfeito);
  tirarCopias(c, arqAlvo, desfeito); // as letras que a gravação desfeita copiou da lista saem
  return { restaurado };
}

// ---------- a marca que nasce de um estilo ----------

function lerFamilias() {
  const j = JSON.parse(fs.readFileSync(path.join(PASTA_LETRAS, 'familias.json'), 'utf8'));
  const mapa = new Map();
  for (const f of j.familias || []) mapa.set(String(f.familia).toLowerCase(), f);
  return mapa;
}

function lerEstilo(r, id) {
  if (!nomeSimples(id)) throw recusa(`O estilo ${trecho(id)} não existe na biblioteca. Escolha um estilo da lista.`);
  const arq = path.join(r, '04-LABORATORIO-DE-DESIGN', 'estilos', id, 'estilo.yaml');
  let y = null;
  try { y = lerYaml(semBom(fs.readFileSync(arq, 'utf8'))); } catch { /* não existe ou não abre */ }
  if (!ehObjeto(y)) throw recusa(`O estilo ${trecho(id)} não existe na biblioteca. Escolha um estilo da lista.`);
  return y;
}

// As letras de um estilo do catálogo: { principal, mono, acento, faltando } (arquivos da pasta de letras do modelo;
// acento null quando o estilo não tem a terceira voz; faltando = famílias que não estão na pasta).
function letrasDoEstilo(id, { r = RAIZ_MODELO } = {}) {
  const y = lerEstilo(r, id);
  const tip = ehObjeto(y.sugestao) && ehObjeto(y.sugestao.tipografia) ? y.sugestao.tipografia : {};
  const familias = lerFamilias();
  const res = { principal: null, mono: null, acento: null, faltando: [] };
  for (const papel of PAPEIS_LETRA) {
    const nome = typeof tip[papel] === 'string' ? tip[papel].trim() : '';
    if (!nome) continue;
    const f = familias.get(nome.toLowerCase());
    if (!f || !ehArquivo(path.join(PASTA_LETRAS, f.arquivo))) { if (!res.faltando.includes(nome)) res.faltando.push(nome); continue; }
    res[papel] = path.join(PASTA_LETRAS, f.arquivo);
  }
  return res;
}

// Copia um arquivo para a pasta, sem nunca sobrescrever: igual já lá, reaproveita; diferente com o mesmo nome, vai
// com -2, -3... Devolve o caminho do arquivo na pasta. O que este passo criou vai para `criados` (para desfazer a
// cópia se a gravação da marca for recusada).
function copiarSemSobrescrever(origem, pasta, criados) {
  const bytes = fs.readFileSync(origem);
  const ext = path.extname(origem);
  const base = path.basename(origem, ext);
  if (!fs.existsSync(pasta)) { fs.mkdirSync(pasta, { recursive: true }); criados.pastas.push(pasta); }
  for (let n = 1; ; n++) {
    const destino = path.join(pasta, `${base}${n === 1 ? '' : `-${n}`}${ext}`);
    if (ehArquivo(destino)) { if (fs.readFileSync(destino).equals(bytes)) return destino; continue; }
    try { fs.writeFileSync(destino, bytes, { flag: 'wx' }); criados.arquivos.push(destino); return destino; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
}

// Uma letra da pasta de letras do modelo, copiada para <pastaMarca>/fontes/ com a licença da família ao lado. Devolve o
// caminho da cópia. Cópia pela metade (a licença falhou): tira o que acabou de entrar e repassa o erro.
function copiarDaLista(arq, c, criados) {
  const pasta = path.join(c.pastaMarca, 'fontes');
  const deste = { arquivos: [], pastas: [] };
  try {
    const copia = copiarSemSobrescrever(arq, pasta, deste);
    const f = [...lerFamilias().values()].find((x) => Array.isArray(x.arquivos) && x.arquivos.includes(path.basename(arq)));
    if (f && f.licenca && nomeSimples(f.licenca)) copiarSemSobrescrever(path.join(PASTA_LETRAS, f.licenca), pasta, deste);
    criados.arquivos.push(...deste.arquivos);
    criados.pastas.push(...deste.pastas);
    return copia;
  } catch (e) {
    desfazerCopia(deste);
    throw e;
  }
}

// Tira só o que a cópia acabou de criar (arquivos e a pasta, se ela nasceu agora e ficou vazia); nada que já estava.
function desfazerCopia(criados) {
  for (const a of criados.arquivos.reverse()) { try { fs.unlinkSync(a); } catch { /* fica */ } }
  for (const p of criados.pastas.reverse()) { try { fs.rmdirSync(p); } catch { /* não está vazia: fica */ } }
}

// Os valores da marca que nasce do estilo `id`: as cores da sugestão do estilo e as letras dele COPIADAS para
// <pastaMarca>/fontes/, com a licença ao lado (a marca não muda quando o modelo atualiza). Não grava a marca: devolve
// { cores, fontes, origem } para o gravarMarca. Para gravar de uma vez (e desfazer a cópia se a gravação for recusada),
// use gravarDoEstilo.
function marcaDoEstilo(r, codigo, id, criados = { arquivos: [], pastas: [] }) {
  const { c } = caminhosDa(r, codigo);
  const y = lerEstilo(r, id);
  const sug = ehObjeto(y.sugestao) ? y.sugestao : {};
  const cores = {};
  for (const papel of PAPEIS_COR) {
    const v = ehObjeto(sug.cores) ? sug.cores[papel] : undefined;
    if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v.trim())) throw recusa(`O estilo ${trecho(id)} não traz a cor ${papel}. Escolha outro estilo.`);
    cores[papel] = v.trim().toUpperCase();
  }
  const letras = letrasDoEstilo(id, { r });
  if (letras.faltando.length || !letras.principal || !letras.mono) {
    throw recusa(`As letras deste estilo não estão na lista de letras da Fábrica (${letras.faltando.join(', ') || 'principal ou mono'}). Escolha as letras na tela.`);
  }
  const familias = lerFamilias();
  const porArquivo = new Map([...familias.values()].flatMap((f) => f.arquivos.map((a) => [a, f])));
  const pasta = path.join(c.pastaMarca, 'fontes');
  const fontes = {};
  for (const papel of PAPEIS_LETRA) {
    if (!letras[papel]) { fontes[papel] = ''; continue; }
    try {
      fontes[papel] = copiarSemSobrescrever(letras[papel], pasta, criados);
      const f = porArquivo.get(path.basename(letras[papel]));
      if (f && f.licenca) copiarSemSobrescrever(path.join(PASTA_LETRAS, f.licenca), pasta, criados);
    } catch (e) {
      desfazerCopia(criados); // cópia pela metade: tira o que acabou de entrar
      throw e;
    }
  }
  return { cores, fontes, origem: `estilo:${id}` };
}

// A marca que nasce do estilo, gravada de uma vez: copia as letras, grava a marca e, se a gravação for recusada (ou
// falhar), tira as cópias que acabou de fazer, sem apagar nada que já estava na pasta. Devolve o mesmo que gravarMarca,
// mais `criados` (as letras, licenças e pastas que a cópia criou): quem chama e precisa voltar atrás depois (porque o passo
// seguinte falhou) desfaz a marca com desfazerMarca e a cópia com desfazerCopia(criados).
function gravarDoEstilo(r, codigo, id, opcoes = {}) {
  const criados = { arquivos: [], pastas: [] };
  const valores = marcaDoEstilo(r, codigo, id, criados);
  try {
    return { ...gravarMarca(r, codigo, valores, { ...opcoes, copiasFeitas: criados }), criados };
  } catch (e) {
    desfazerCopia(criados);
    throw e;
  }
}

// ---------- linha de comando ----------

const USO = [
  'Uso:',
  '  node 08-FERRAMENTAS/marca/escrever.js gravar <codigo> <valores.json> [--origem <origem>] [--sem-trabalhador]',
  '  node 08-FERRAMENTAS/marca/escrever.js desfazer <codigo> [--sem-trabalhador]',
  '  node 08-FERRAMENTAS/marca/escrever.js do-estilo <codigo> <estilo> [--sem-trabalhador]',
  'Origem: manual, logo, do-zero, pessoa, estilo:<id> ou estilo-proprio:<id> (no --origem ou no valores.json).',
  'Depois de gravar, as prévias na marca começam em segundo plano; --sem-trabalhador só anota o pedido delas.',
].join('\n');
class ErroDeUso extends Error {}

// Depois de gravar ou desfazer pela linha de comando (o agente), a marca de hoje pede as prévias na marca, pelo mesmo gatilho do
// painel (_fabrica/paineis/apos-marca.js): pede a lista e lança o trabalhador em segundo plano (síncrono: o filho é destacado e o
// processo pode sair logo). Fica FORA de gravarMarca/desfazerMarca, que o servidor também usa e já chama o gatilho depois delas.
// Falha aqui não muda a saída (a marca já foi gravada): aviso curto e detalhe no console de erro. `lancar` troca o lançador (testes).
// --sem-trabalhador (só na chamada em que aparece, como no fila-marca.js) pede a lista sem lançar ninguém e avisa que as prévias
// vão demorar: ninguém fica sem prévias em silêncio. Nenhuma variável de ambiente desliga o trabalhador.
const DEMORA = 'As prévias na sua marca vão demorar um pouco mais.';
function pedirPrevias(r, codigo, { lancar, semTrabalhador = false } = {}) {
  try {
    const { gatilhoPadrao } = require('../../_fabrica/paineis/apos-marca');
    const pediu = gatilhoPadrao({ lancar, semTrabalhador })(r, codigo);
    if (semTrabalhador && pediu) console.log(DEMORA); // sem marca (desfeita) não há prévia a esperar
  } catch (e) {
    console.error('Não consegui pedir as prévias na marca (' + codigo + '):', e);
    console.log(DEMORA);
  }
}

function principal(args, { lancar } = {}) {
  const r = empresaMod.raiz();
  const pos = [];
  let origem;
  let semTrabalhador = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--sem-trabalhador') {
      if (semTrabalhador) throw new ErroDeUso('A opção --sem-trabalhador apareceu mais de uma vez.');
      semTrabalhador = true;
    } else if (args[i] === '--origem') {
      if (origem !== undefined) throw new ErroDeUso('A opção --origem apareceu mais de uma vez.');
      if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new ErroDeUso('Faltou o valor depois de --origem.');
      origem = args[++i];
    } else if (args[i].startsWith('--')) throw new ErroDeUso(`Opção desconhecida: ${args[i]}`);
    else pos.push(args[i]);
  }
  switch (args[0]) {
    case 'gravar': {
      if (pos.length !== 2) throw new ErroDeUso('Informe o código da empresa e o arquivo de valores.');
      let valores;
      try { valores = JSON.parse(semBom(fs.readFileSync(path.resolve(pos[1]), 'utf8'))); } catch (e) {
        throw recusa(`Não consegui ler o arquivo de valores (${e.code === 'ENOENT' ? 'não existe' : 'não é um JSON válido'}). Nada foi gravado.`);
      }
      if (origem === undefined && !(ehObjeto(valores) && tem(valores, 'origem'))) throw new ErroDeUso('Faltou a origem da marca (--origem ou "origem" no arquivo de valores).');
      const res = gravarMarca(r, pos[0], valores, { origem });
      console.log(`Marca gravada. A anterior ficou guardada no histórico (${path.basename(res.historico)}).`);
      pedirPrevias(r, pos[0], { lancar, semTrabalhador });
      return 0;
    }
    case 'desfazer': {
      if (pos.length !== 1 || origem !== undefined) throw new ErroDeUso('Informe só o código da empresa.');
      const res = desfazerMarca(r, pos[0]);
      console.log(res.restaurado ? 'A marca anterior voltou.' : 'Voltou para sem marca (a marca desfeita ficou guardada no histórico).');
      pedirPrevias(r, pos[0], { lancar, semTrabalhador });
      return 0;
    }
    case 'do-estilo': {
      if (pos.length !== 2 || origem !== undefined) throw new ErroDeUso('Informe o código da empresa e o do estilo.');
      gravarDoEstilo(r, pos[0], pos[1]);
      console.log(`Marca gravada a partir do estilo ${pos[1]}, com as letras dele na pasta da empresa.`);
      pedirPrevias(r, pos[0], { lancar, semTrabalhador });
      return 0;
    }
    default:
      throw new ErroDeUso(args[0] ? `Comando desconhecido: ${args[0]}` : '');
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

module.exports = { principal, ErroDeUso, gravarMarca, desfazerMarca, letrasDoEstilo, marcaDoEstilo, gravarDoEstilo, desfazerCopia, PAPEIS_COR, PAPEIS_LETRA };
