#!/usr/bin/env node
// Mudança opcional da pasta antiga (uma empresa só, com os dados espalhados pelas pastas da raiz) para a pasta própria
// da empresa (empresas/principal/). Só roda quando a pessoa pede: nenhum outro comando, skill ou painel a dispara.
//
//   simular   só lê: o que vai, para onde, o que continua no mesmo lugar, o que é do modelo e as recusas.
//             Não grava nada, nem pasta vazia.
//   aplicar   copia cada arquivo para a pasta da empresa (cópia exclusiva, que nunca grava por cima), confere cada cópia
//             por sha256, traduz as referências de caminho dos três arquivos dos painéis (só nas cópias), confere de
//             novo as origens e, por último, vira a empresa no empresas/indice.json (gravação atômica). Os arquivos
//             antigos continuam onde estão, intactos: são a cópia de segurança. Erro no meio: apaga só as cópias que
//             ele mesmo criou e a Fábrica continua usando os lugares de sempre.
//   estado    em que pé está: pasta antiga, organizada (com os antigos ainda no lugar ou já retirados) ou interrompida.
//   retirar   opcional, em outro pedido: guarda os arquivos antigos na pasta da mudança (antigos/<caminho de antes>),
//             tudo ou nada (cada antigo igual ao da mudança, a cópia na pasta da empresa presente e nada novo nos
//             lugares de antes). Só move, com exclusividade, nunca apaga. Morte no meio: repetir continua.
//   desfazer  volta ao formato antigo a qualquer momento, antes ou depois da retirada (os guardados voltam primeiro).
//             Nada é apagado: as cópias vão para a pasta da mudança (desfeito/). O que foi feito depois da mudança nunca
//             se perde: recusa e lista, ou leva de volta para os lugares de sempre com --levar-novos (o original de
//             antes vai para substituidos/).
//
// O mapa "de onde -> para onde" não é escrito à mão: ele sai do leitor de empresas (empresa.caminhosDe), chave por
// chave, entre a disposição da pasta antiga e a da pasta própria. O que é do modelo vem do _fabrica/propriedade.json da
// raiz do código, com a mesma regra da atualização: é do modelo o que está em "modelo" e fora de "protegidos".
//
//   node _fabrica/core/migrar.js simular [principal] [--json] [--run-parado-confirmado <linha>]
//   node _fabrica/core/migrar.js previa [--pasta <pasta fora da Fábrica>] [--run-parado-confirmado <linha>]   (JSON)
//   node _fabrica/core/migrar.js aplicar --confirmar <codigo da simulação> [--run-parado-confirmado <linha>] [--json]
//   node _fabrica/core/migrar.js estado [--json]
//   node _fabrica/core/migrar.js retirar [<carimbo>] --simular|--confirmar [--json]
//   node _fabrica/core/migrar.js desfazer [<carimbo>] [--levar-novos] --confirmar [--json]
//
// Saída: 0 = dá para fazer (ou nada a mudar), 1 = recusa, 2 = erro de uso ou erro inesperado (só a mensagem).
// Todas as funções aceitam `r`, a raiz da Fábrica (o padrão é a de empresa.raiz(), com FABRICA_RAIZ para os testes).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const empresa = require('./empresa');

const LEGADO = 'principal';
const RAIZ_DO_CODIGO = path.resolve(__dirname, '..', '..');
const LINHA = /^[a-z0-9][a-z0-9_-]*$/;
const MEGA = 1 << 20;
// Textos maiores que isso não são lidos para contar citações de lugar antigo (só o sha256 é calculado).
const LIMITE_TEXTO = 5 * MEGA;
const EXT_TEXTO = new Set(['.md', '.txt', '.yaml', '.yml', '.html', '.htm', '.csv', '.json']);

// Cada chave de empresa.caminhos() tem de estar aqui:
//   migra    = lugar diferente na pasta antiga e na pasta própria: a mudança leva os arquivos;
//   comum    = mesmo lugar nas duas (já está em empresas/principal/): nada a fazer;
//   derivada = só existe na pasta própria e é a pasta-mãe de outra chave (saidasRaiz, memoriaRaiz).
// Chave nova no leitor sem classificação aqui: a guarda do teste reprova e a simulação recusa.
const CLASSIFICACAO = Object.freeze({
  gaveta: 'comum',
  perfil: 'migra',
  marca: 'migra',
  pastaMarca: 'migra',
  estiloDeVideo: 'migra',
  estilosProprios: 'migra',
  referencias: 'migra',
  laboratorio: 'migra',
  cronograma: 'migra',
  publicacoes: 'migra',
  estilo: 'comum',
  intencao: 'comum',
  pedidos: 'comum',
  historico: 'comum',
  decisoes: 'comum',
  termos: 'comum',
  termosCompartilhados: 'comum',
  previas: 'comum',
  envios: 'comum',
  midias: 'comum',
  saidasRaiz: 'derivada',
  memoriaRaiz: 'derivada',
  saidas: 'migra',
  memoria: 'migra',
  dadosLinha: 'migra',
  estadoLinha: 'migra',
  investigacoes: 'migra',
});
// As chaves "migra" que pares() sabe levar. Precisa ser igual ao conjunto das "migra" acima.
const MIGRA_TRATADAS = ['perfil', 'marca', 'pastaMarca', 'estiloDeVideo', 'estilosProprios', 'referencias', 'laboratorio',
  'cronograma', 'publicacoes', 'saidas', 'memoria', 'dadosLinha', 'estadoLinha', 'investigacoes'];

// Rótulos ao usuário, na ordem em que aparecem no resumo. "<l>" vira o nome da linha (o "nome" do linha.yaml dela,
// ou o código, se não houver).
const GRUPOS = Object.freeze({
  marca: 'Contrato da marca',
  marcaArquivos: 'Letras, logo, fotos e peças da marca',
  estiloDeVideo: 'Estilo de vídeo',
  estilosProprios: 'Estilos próprios',
  perfil: 'Perfil da empresa',
  referencias: 'Referências',
  laboratorio: 'Laboratório',
  cronograma: 'Cronograma',
  publicacoes: 'Peças aprovadas',
  saidas: 'Saídas da linha <l>',
  memoria: 'Memória da linha <l>',
  dadosLinha: 'Dados da empresa na linha <l>',
  estadoLinha: 'Andamento da linha <l>',
  investigacoes: 'Investigações da linha <l>',
});
const rotulo = (grupo, linha) => GRUPOS[grupo].replace('<l>', linha || '');
// Os conjuntos do resumo curto e dos cartões da página (as linhas entram depois, um conjunto por linha).
const CONJUNTOS = [
  { chave: 'marca', rotulo: 'Marca e fotos', grupos: ['marca', 'marcaArquivos', 'estiloDeVideo', 'estilosProprios'] },
  { chave: 'perfil', rotulo: 'Perfil da empresa', grupos: ['perfil'] },
  { chave: 'laboratorio', rotulo: 'Laboratório e referências', grupos: ['laboratorio', 'referencias'] },
  { chave: 'cronograma', rotulo: 'Cronograma', grupos: ['cronograma'] },
  { chave: 'publicacoes', rotulo: 'Peças aprovadas', grupos: ['publicacoes'] },
];

// O nome de uma linha para mostrar à pessoa: o "nome:" do linha.yaml dela (texto de quem escreveu a linha, então sem
// caractere de controle e com até 60 letras), ou o código. Só lê a primeira linha "nome:"; nunca interpreta o resto.
function nomeDaLinha(r, l) {
  let texto = '';
  try {
    const arq = path.join(r, 'linhas', l, 'linha.yaml');
    const st = fs.lstatSync(arq);
    if (st.isFile() && st.size <= 256 * 1024) texto = fs.readFileSync(arq, 'utf8');
  } catch { /* sem linha.yaml (a linha só tem dados na pasta da empresa): fica o código */ }
  const m = /^nome:[ \t]*(.*)$/m.exec(texto.replace(/^\uFEFF/, ''));
  return limparNome(m ? m[1].trim().replace(/^(["'])(.*)\1$/, '$2') : '') || l;
}
// Um nome escrito por alguém (o da empresa, o de uma linha) pronto para mostrar: sem caractere de controle, sem
// caractere invisível ou de direção do texto, espaços juntados e até 60 letras.
function limparNome(texto) {
  let nome = String(texto === null || texto === undefined ? '' : texto);
  nome = nome.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  if ([...nome].length > 60) nome = [...nome].slice(0, 59).join('').trimEnd() + '…';
  return nome;
}
// "a linha X" / "as linhas X e Y"; "na linha X" / "nas linhas X e Y".
const juntar = (lista) => (lista.length <= 1 ? lista.join('') : `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`);

// Os três arquivos dos painéis com referências de caminho traduzidas na cópia, e os campos traduzidos.
const PAINEIS = ['laboratorio', 'aprovacoes', 'posts'];

function erro(code, mensagem, extra) {
  const e = new Error(mensagem);
  e.code = code;
  return Object.assign(e, extra);
}

const chavesSemClassificacao = (lista = empresa.CHAVES_DE_CAMINHO) =>
  lista.filter((k) => !Object.prototype.hasOwnProperty.call(CLASSIFICACAO, k));

// ---------- auxiliares ----------
const relDe = (r, abs) => path.relative(r, abs).split(path.sep).join('/');
const comecaCom = (p, pref) => (pref.endsWith('/') ? p.startsWith(pref) : p === pref);
const dentro = (p, prefs) => prefs.some((x) => comecaCom(p, x));
// Nome de pasta como o Windows compara: sem diferença de maiúsculas e sem ponto ou espaço no fim.
const nomeComparavel = (n) => n.replace(/[. ]+$/, '').toLowerCase();
const hashBuffer = (b) => crypto.createHash('sha256').update(b).digest('hex');
// Os temporários da gravação segura (ver gravarSeguro): ".<nome>.migracao-tmp", na mesma pasta do arquivo final.
const SUFIXO_TEMPORARIO = '.migracao-tmp';
const ehTemporario = (abs) => path.basename(abs).endsWith(SUFIXO_TEMPORARIO);

// sha256 por fluxo (vídeo grande não vai inteiro para a memória). Só abre para ler.
function hashArquivo(arq) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(arq, 'r');
  try {
    const buf = Buffer.allocUnsafe(MEGA);
    let lidos;
    while ((lidos = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, lidos));
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

function lstatOuNada(p) {
  try {
    return fs.lstatSync(p);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return null;
    throw e;
  }
}

// Anda pela pasta sem seguir atalho (junção ou link) e sem entrar em .git nem node_modules. `aoPasta` (opcional)
// recebe cada subpasta antes de entrar nela.
function andar(dir, aoArquivo, aoAtalho, aoPasta) {
  let entradas;
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return;
    throw e;
  }
  entradas.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entradas) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const c = path.join(dir, e.name);
    const st = fs.lstatSync(c);
    if (st.isSymbolicLink()) aoAtalho(c);
    else if (st.isDirectory()) {
      if (aoPasta) aoPasta(c);
      andar(c, aoArquivo, aoAtalho, aoPasta);
    } else if (st.isFile()) aoArquivo(c, st);
  }
}

function lerPropriedade() {
  const arq = path.join(RAIZ_DO_CODIGO, '_fabrica', 'propriedade.json');
  let p;
  try {
    p = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    throw erro('PROPRIEDADE_INVALIDA', `Não deu para ler a lista do que é do modelo (${e.message}).`);
  }
  if (!p || !Array.isArray(p.modelo)) throw erro('PROPRIEDADE_INVALIDA', 'A lista do que é do modelo não tem o campo "modelo".');
  return { modelo: p.modelo, protegidos: Array.isArray(p.protegidos) ? p.protegidos : [] };
}
const ehDoModelo = (rel, prop) => dentro(rel, prop.modelo) && !dentro(rel, prop.protegidos);

// ---------- os pares "de -> para", vindos do leitor ----------
const subpastas = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return [];
    throw e;
  }
};

// As linhas: as pastas de linhas/ e as que já têm dados na pasta da empresa (para o desfazer achar o que nasceu lá).
function nomesDeLinhas(r, Gv) {
  const nomes = new Set(subpastas(path.join(r, 'linhas')));
  const amostra = 'x';
  for (const raizLinha of [Gv.saidasRaiz, Gv.memoriaRaiz, path.dirname(Gv.investigacoes(amostra)), path.dirname(path.dirname(Gv.dadosLinha(amostra)))]) {
    for (const s of subpastas(raizLinha)) nomes.add(s);
  }
  try {
    for (const e of fs.readdirSync(path.dirname(Gv.estadoLinha(amostra)), { withFileTypes: true })) {
      if (e.isFile() && e.name.endsWith('.json')) nomes.add(e.name.slice(0, -5));
    }
  } catch (e) {
    if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
  }
  return [...nomes].filter((l) => LINHA.test(l)).sort();
}

// Monta os pares a partir dos caminhos das duas disposições. Lança CHAVE_SEM_CLASSIFICACAO se o leitor tiver chave
// que a mudança não conhece, ou se uma chave "comum" tiver lugares diferentes nas duas disposições.
function pares(r) {
  const L = empresa.caminhosDe(LEGADO, 'legado', r);
  const Gv = empresa.caminhosDe(LEGADO, 'gaveta', r);
  const chaves = [...new Set([...Object.keys(L), ...Object.keys(Gv)])];
  const sem = chavesSemClassificacao(chaves);
  const migra = Object.keys(CLASSIFICACAO).filter((k) => CLASSIFICACAO[k] === 'migra');
  if (migra.length !== MIGRA_TRATADAS.length || migra.some((k) => !MIGRA_TRATADAS.includes(k))) sem.push('(classificação interna)');
  for (const k of chaves) {
    if (CLASSIFICACAO[k] !== 'comum') continue;
    const valor = (o) => (typeof o[k] === 'function' ? o[k]('x') : o[k]);
    if (valor(L) !== valor(Gv)) sem.push(k);
  }
  if (sem.length) {
    throw erro('CHAVE_SEM_CLASSIFICACAO', 'A Fábrica ganhou um lugar novo que esta organização da pasta ainda não sabe levar. Nada foi alterado; avise quem mantém a Fábrica.', { chaves: sem });
  }
  const G = Gv.gaveta;
  const lista = [];
  const add = (chave, grupo, linha, de, para, tipo) => lista.push({ chave, grupo, linha, de, para, tipo });
  add('marca', 'marca', null, L.marca, Gv.marca, 'arquivo');
  add('pastaMarca', 'marcaArquivos', null, L.pastaMarca, Gv.pastaMarca, 'pasta');
  add('estiloDeVideo', 'estiloDeVideo', null, L.estiloDeVideo, Gv.estiloDeVideo, 'arquivo');
  add('estilosProprios', 'estilosProprios', null, L.estilosProprios, Gv.estilosProprios, 'pasta');
  add('perfil', 'perfil', null, L.perfil, Gv.perfil, 'arquivo');
  add('referencias', 'referencias', null, L.referencias, Gv.referencias, 'pasta');
  add('laboratorio', 'laboratorio', null, L.laboratorio, Gv.laboratorio, 'pasta');
  // O COMO-ACESSAR.md fica na pasta do painel, um nível acima de dados/ (como no dados.js dos painéis).
  add('laboratorio', 'laboratorio', null, path.join(path.dirname(L.laboratorio), 'COMO-ACESSAR.md'), path.join(path.dirname(Gv.laboratorio), 'COMO-ACESSAR.md'), 'arquivo');
  // O Cronograma vai inteiro: a pasta do painel (um nível acima de dados/).
  add('cronograma', 'cronograma', null, path.dirname(L.cronograma), path.dirname(Gv.cronograma), 'pasta');
  add('publicacoes', 'publicacoes', null, L.publicacoes, Gv.publicacoes, 'pasta');
  const linhas = nomesDeLinhas(r, Gv);
  for (const l of linhas) {
    add('saidas', 'saidas', l, L.saidas(l), Gv.saidas(l), 'pasta');
    add('memoria', 'memoria', l, L.memoria(l), Gv.memoria(l), 'pasta');
    add('dadosLinha', 'dadosLinha', l, L.dadosLinha(l), Gv.dadosLinha(l), 'pasta');
    add('estadoLinha', 'estadoLinha', l, L.estadoLinha(l), Gv.estadoLinha(l), 'arquivo');
    add('investigacoes', 'investigacoes', l, L.investigacoes(l), Gv.investigacoes(l), 'pasta');
  }
  // Nomes da pasta da empresa que têm outro uso: um arquivo da marca com esse nome no começo do caminho não pode ir
  // para lá (misturaria com os pedidos, o histórico, as saídas...). O espelho 06-MARCA-E-FOTOS/ também é reservado.
  const reservados = new Set([nomeComparavel(path.basename(L.pastaMarca))]);
  for (const [k, v] of Object.entries(Gv)) {
    if (['gaveta', 'pastaMarca', 'marca', 'estiloDeVideo', 'estilosProprios'].includes(k)) continue;
    const valor = typeof v === 'function' ? v('x') : v;
    if (typeof valor !== 'string') continue;
    const rel = path.relative(G, valor);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    reservados.add(nomeComparavel(rel.split(path.sep)[0]));
  }
  return { L, Gv, G, lista, linhas, reservados };
}

// O par que cobre um caminho (o mais específico). `lado` é 'de' (pasta antiga) ou 'para' (pasta da empresa).
function parDe(ps, abs, lado) {
  let melhor = null;
  for (const p of ps.lista) {
    const base = p[lado];
    // Um par de pasta cobre a própria pasta (a raiz) e tudo dentro dela.
    const cobre = p.tipo === 'arquivo' ? abs === base : abs === base || abs.startsWith(base + path.sep);
    if (!cobre) continue;
    if (p.chave === 'pastaMarca' && lado === 'para') {
      const primeiro = path.relative(base, abs).split(path.sep)[0];
      if (ps.reservados.has(nomeComparavel(primeiro))) continue;
    }
    if (!melhor || base.length > melhor[lado].length) melhor = p;
  }
  return melhor;
}
const destinoDe = (p, abs) => (p.tipo === 'arquivo' ? p.para : path.join(p.para, path.relative(p.de, abs)));

// ---------- referências dos painéis ----------
// Regras da tradução, por prefixo exato (barra normal ou invertida), derivadas dos pares. `sentido` 'ida' traduz da
// pasta antiga para a pasta da empresa; 'volta' (o desfazer) faz o contrário. Só o prefixo muda; o resto fica como está.
function regrasDeTraducao(ps, r, sentido = 'ida') {
  const rel = (abs) => relDe(r, abs);
  const sep = '[\\\\/]';
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const comoPadrao = (relPasta) => relPasta.split('/').map(esc).join(sep) + sep;
  const LIN = '([a-z0-9][a-z0-9_-]*)';
  const ida = sentido === 'ida';
  const pastaDasSaidasL = path.dirname(path.dirname(ps.L.saidas('x')));
  const regras = [
    ida
      ? { de: new RegExp('^' + comoPadrao(rel(ps.L.referencias))), para: () => rel(ps.Gv.referencias) + '/' }
      : { de: new RegExp('^' + comoPadrao(rel(ps.Gv.referencias))), para: () => rel(ps.L.referencias) + '/' },
    ida
      ? { de: new RegExp('^' + comoPadrao(rel(ps.L.publicacoes))), para: () => rel(ps.Gv.publicacoes) + '/' }
      : { de: new RegExp('^' + comoPadrao(rel(ps.Gv.publicacoes))), para: () => rel(ps.L.publicacoes) + '/' },
    ida
      // linhas/<l>/saida/ -> a pasta de saídas da linha
      ? { de: new RegExp('^' + comoPadrao(rel(pastaDasSaidasL)) + LIN + sep + esc(path.basename(ps.L.saidas('x'))) + sep), para: (m) => rel(ps.Gv.saidas(m[1])) + '/' }
      : { de: new RegExp('^' + comoPadrao(rel(ps.Gv.saidasRaiz)) + LIN + sep), para: (m) => rel(ps.L.saidas(m[1])) + '/' },
    ida
      // 06-MARCA-E-FOTOS/<resto>, fora do exemplo e com <resto> não vazio
      ? { de: new RegExp('^' + comoPadrao(rel(ps.L.pastaMarca)) + '(?!exemplo' + sep + ')(?=[^\\\\/])'), para: () => rel(ps.G) + '/' }
      // <pasta da empresa>/<resto>, quando o começo do <resto> não é um nome reservado da pasta da empresa
      : { de: new RegExp('^' + comoPadrao(rel(ps.G)) + '(?=[^\\\\/])'), para: () => rel(ps.L.pastaMarca) + '/', resto: (resto) => !ps.reservados.has(nomeComparavel(resto.split(/[\\/]/)[0])) },
  ];
  return (valor) => {
    if (typeof valor !== 'string') return null;
    for (const regra of regras) {
      const m = regra.de.exec(valor);
      if (!m) continue;
      const resto = valor.slice(m[0].length);
      if (regra.resto && !regra.resto(resto)) continue;
      return regra.para(m) + resto;
    }
    return null;
  };
}

// Algum lugar antigo citado num texto (fora do que continua valendo, como o exemplo e as pastas do modelo). Sem
// diferença de maiúsculas: "02-publicacoes/..." não é traduzido (o prefixo da tradução é exato), mas vira aviso.
const CITA_LUGAR_ANTIGO = /(?:^|[^A-Za-z0-9_-])(?:02-PUBLICACOES|03-CRONOGRAMA)[\\/]|04-LABORATORIO-DE-DESIGN[\\/](?:referencias|dados|COMO-ACESSAR)|06-MARCA-E-FOTOS[\\/](?!exemplo[\\/]|marca\.exemplo|estilo-de-video\.exemplo)|linhas[\\/][a-z0-9][a-z0-9_-]*[\\/](?:saida|memoria|_investigacoes|estado\.json)|_fabrica[\\/]_memoria[\\/]empresa\.md/i;

// Traduz um dos três JSON dos painéis. Devolve { valor, referencias, naoTraduzidas } ou lança JSON_INVALIDO.
function traduzirPainel(tipo, texto, arqRel, traduzir) {
  let valor;
  try {
    valor = JSON.parse(texto.replace(/^\uFEFF/, ''));
  } catch (e) {
    throw erro('JSON_INVALIDO', e.message);
  }
  const objeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (tipo === 'aprovacoes' ? !objeto(valor) : !Array.isArray(valor)) throw erro('JSON_INVALIDO', 'formato inesperado');
  const referencias = [];
  const troca = (alvo, chave, campo) => {
    const antes = alvo[chave];
    const depois = traduzir(antes);
    if (depois === null) return;
    alvo[chave] = depois;
    referencias.push({ arquivo: arqRel, campo, de: antes, para: depois });
  };
  if (tipo === 'aprovacoes') {
    for (const [id, reg] of Object.entries(valor)) if (objeto(reg)) troca(reg, 'pasta', `[${JSON.stringify(id)}].pasta`);
  } else {
    valor.forEach((item, i) => {
      if (!objeto(item)) return;
      if (tipo === 'laboratorio') {
        for (const c of ['path', 'pasta', 'video']) troca(item, c, `[${i}].${c}`);
      } else {
        if (Array.isArray(item.images)) item.images.forEach((_, j) => troca(item.images, j, `[${i}].images[${j}]`));
        troca(item, 'previewUrl', `[${i}].previewUrl`);
      }
    });
  }
  // Fora dos campos traduzidos (ou nos campos sem regra): referência antiga fica como está e vira aviso.
  const naoTraduzidas = [];
  const varrer = (v, campo) => {
    if (typeof v === 'string') {
      const traduzida = referencias.some((x) => x.campo === campo);
      if (!traduzida && CITA_LUGAR_ANTIGO.test(v)) naoTraduzidas.push(campo);
    } else if (Array.isArray(v)) v.forEach((x, i) => varrer(x, `${campo}[${i}]`));
    else if (objeto(v)) {
      for (const [k, x] of Object.entries(v)) varrer(x, campo === '' && tipo === 'aprovacoes' ? `[${JSON.stringify(k)}]` : `${campo}.${k}`);
    }
  };
  // O valor já traduzido: o que sobrou com lugar antigo não foi traduzido.
  varrer(valor, '');
  return { valor, referencias, naoTraduzidas };
}

// ---------- estado das mudanças anteriores ----------
const pastaBackup = (r) => path.join(r, '_fabrica', '_backup');
const arqTrava = (r) => path.join(r, 'empresas', '.migracao.lock');
const NOME_PASTA_MUDANCA = /^migracao-(\d{8}-\d{6})(?:-(\d+))?$/;

// As mudanças já registradas, da mais antiga para a mais nova. Uma pasta sem manifesto.json é de uma mudança que
// morreu entre criar a pasta e gravar o registro: como o registro é gravado antes de qualquer cópia, ela nunca tocou
// em nada (iniciada: false) e não decide nada. Manifesto que existe mas não pode ser lido vem com manifesto: null.
function mudancas(r, { soIniciadas = false } = {}) {
  const lista = [];
  for (const nome of subpastas(pastaBackup(r))) {
    const m = NOME_PASTA_MUDANCA.exec(nome);
    if (!m) continue;
    const arq = path.join(pastaBackup(r), nome, 'manifesto.json');
    const iniciada = fs.existsSync(arq);
    if (soIniciadas && !iniciada) continue;
    let manifesto = null;
    try {
      manifesto = JSON.parse(fs.readFileSync(arq, 'utf8'));
    } catch { /* sem manifesto legível: a pasta é listada, mas não decide nada */ }
    lista.push({ carimbo: nome.slice('migracao-'.length), base: m[1], seq: m[2] ? Number(m[2]) : 1, dir: path.join(pastaBackup(r), nome), manifesto, iniciada });
  }
  return lista.sort((a, b) => (a.base !== b.base ? (a.base < b.base ? -1 : 1) : a.seq - b.seq));
}
// Estados do registro em que a mudança (o desfazer, ou a retirada dos antigos) ficou pela metade.
const PELA_METADE = new Set(['copiando', 'desfazendo', 'retirando']);
// A trava, vista de fora: 'nenhuma', 'viva' (o processo que a criou está rodando) ou 'abandonada' (ele morreu).
function situacaoDaTrava(r) {
  const t = lerTrava(r);
  if (t === null) return 'nenhuma';
  return travaViva(t) ? 'viva' : 'abandonada';
}
const AVISO_TRAVA_ABANDONADA = {
  tipo: 'trava-abandonada',
  mensagem: 'Uma organização anterior foi interrompida antes de gravar qualquer coisa; nada foi alterado.',
};

// ---------- inventário ----------
function vazio(situacao, extra = {}) {
  return {
    empresa: LEGADO, nome: null, situacao, codigoSimulacao: codigoDe([]),
    itens: [], jaNoLugar: [], ficam: [], doModelo: 0, referencias: [], avisos: [], recusas: [], bytes: 0, espacoLivre: null,
    linhas: {},
    ...extra,
  };
}
const codigoDe = (itens) => hashBuffer(JSON.stringify(itens.map((i) => [i.de, i.para, i.sha256, i.bytes]))).slice(0, 12);

function espacoLivreDe(r) {
  try {
    const s = fs.statfsSync(r);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

// Levanta tudo. Devolve { inv, interno }: o inventário (só dados, pronto para JSON) e o que o aplicar usa (os pares,
// os caminhos completos e o conteúdo traduzido dos JSON). Só lê.
function levantar(r, opcoes = {}) {
  const codigo = opcoes.codigo === undefined ? LEGADO : opcoes.codigo;
  const confirmados = new Set(opcoes.runParadoConfirmado || []);
  let lista;
  try {
    lista = empresa.listar(r);
  } catch (e) {
    if (e.code !== 'JSON_INVALIDO') throw e;
    return { inv: vazio('pasta-antiga', { recusas: [{ code: 'INDICE_INVALIDO', mensagem: 'A lista de empresas desta pasta está com o formato quebrado. Corrija antes; nada foi alterado.', arquivos: ['empresas/indice.json'] }] }) };
  }
  const entrada = lista.find((e) => e.codigo === LEGADO) || null;
  // O nome da empresa é texto de quem a criou: limpo como o das linhas, para todo texto e página que o mostram.
  const nome = entrada ? limparNome(entrada.nome) || null : null;
  if (codigo !== LEGADO) {
    return { inv: vazio('nada-a-mudar', { empresa: codigo, recusas: [{ code: 'CODIGO_NAO_E_PASTA_ANTIGA', mensagem: `Só a empresa que já estava nesta pasta, do formato antigo (código "${LEGADO}"), pode ser organizada. A empresa "${codigo}" já tem pasta própria.` }] }) };
  }
  // Mudança ficou pela metade (ou está acontecendo agora): nada a simular até resolver. Dentro do aplicar, a trava
  // presente é a dele mesmo (dentroDaTrava). Trava de um processo que morreu sem deixar mudança pela metade (morreu
  // antes de gravar o registro) não impede nada: vira só um aviso.
  const ultima = mudancas(r, { soIniciadas: true }).pop();
  const trava = opcoes.dentroDaTrava ? 'nenhuma' : situacaoDaTrava(r);
  const pelaMetade = !!(ultima && ultima.manifesto && PELA_METADE.has(ultima.manifesto.status));
  if (trava === 'viva' || pelaMetade) {
    return { inv: vazio('interrompida', { nome, recusas: [{ code: 'MIGRACAO_EM_ANDAMENTO', mensagem: 'Uma organização da pasta está em andamento ou ficou pela metade. Desfaça o que ficou pela metade antes de começar de novo.', arquivos: trava !== 'nenhuma' ? ['empresas/.migracao.lock'] : [] }] }) };
  }
  const avisosDaTrava = trava === 'abandonada' ? [{ ...AVISO_TRAVA_ABANDONADA }] : [];
  if (!entrada) return { inv: vazio('nada-a-mudar', { avisos: avisosDaTrava }) };
  if (entrada.disposicao === 'gaveta') return { inv: vazio('ja-organizada', { nome, avisos: avisosDaTrava }) };

  const recusas = [];
  const avisos = [...avisosDaTrava];
  let ps;
  try {
    ps = pares(r);
  } catch (e) {
    if (e.code !== 'CHAVE_SEM_CLASSIFICACAO') throw e;
    return { inv: vazio('pasta-antiga', { nome, recusas: [{ code: e.code, mensagem: e.message, chaves: e.chaves }] }) };
  }
  const prop = lerPropriedade();
  const rel = (abs) => relDe(r, abs);

  // 1) Varredura das pastas antigas, sem seguir atalho.
  const { candidatos, ficam, doModelo, juncoes, foraDoPadrao } = varrerOrigens(r, ps, prop);

  // 2) sha256 de cada um; os três JSON dos painéis são lidos para a tradução; os textos, para contar citações.
  const traduzir = regrasDeTraducao(ps, r);
  const painelDe = paineisAntigos(ps);
  const ilegiveis = [];
  const quebrados = [];
  const referencias = [];
  const naoTraduzidas = [];
  const textosAntigos = [];
  const conteudos = new Map();
  for (const c of candidatos) {
    const relC = rel(c.abs);
    const painel = painelDe.get(c.abs);
    const ext = path.extname(c.abs).toLowerCase();
    try {
      if (painel || (EXT_TEXTO.has(ext) && c.bytes <= LIMITE_TEXTO)) {
        const buf = fs.readFileSync(c.abs);
        c.sha256 = hashBuffer(buf);
        c.bytes = buf.length;
        if (painel) {
          try {
            const t = traduzirPainel(painel, buf.toString('utf8'), relC, traduzir);
            if (t.referencias.length) {
              c.traduzir = painel;
              const novo = Buffer.from(JSON.stringify(t.valor, null, 2) + '\n', 'utf8');
              conteudos.set(relC, novo);
              c.sha256Destino = hashBuffer(novo);
              referencias.push(...t.referencias);
            }
            if (t.naoTraduzidas.length) naoTraduzidas.push({ arquivo: relC, campos: t.naoTraduzidas });
          } catch (e) {
            if (e.code !== 'JSON_INVALIDO') throw e;
            quebrados.push(relC);
          }
        } else if (c.par.chave !== 'marca' && CITA_LUGAR_ANTIGO.test(buf.toString('utf8'))) {
          textosAntigos.push(relC);
        }
      } else {
        c.sha256 = hashArquivo(c.abs);
      }
    } catch (e) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(e.code)) throw e;
      ilegiveis.push(relC);
    }
    if (!c.sha256Destino) c.sha256Destino = c.sha256;
  }
  // O nome de cada linha, para os textos ao usuário (só mostra; não muda nada do que é feito).
  const linhas = Object.fromEntries(ps.linhas.map((l) => [l, nomeDaLinha(r, l)]));
  return montarInventario(r, { ps, nome, linhas, opcoes, confirmados, candidatos, ficam, doModelo, ilegiveis, quebrados, referencias, naoTraduzidas, textosAntigos, conteudos, recusas, avisos, juncoes, foraDoPadrao });
}

// Os três arquivos dos painéis na pasta antiga, com o tipo de cada um.
const paineisAntigos = (ps) => new Map([
  [path.join(ps.L.laboratorio, 'laboratorio.json'), 'laboratorio'],
  [path.join(ps.L.laboratorio, 'aprovacoes.json'), 'aprovacoes'],
  [path.join(ps.L.cronograma, 'posts.json'), 'posts'],
]);

// Anda pelas pastas antigas e separa: o que vai (candidatos, com o par e o destino), o que continua no mesmo lugar
// (ficam), quantos são do modelo, as junções na raiz de uma pasta da empresa (juncoes: a mudança recusa, porque o que
// está do outro lado sumiria da Fábrica em silêncio) e as linhas com nome fora do padrão. Só lê (lstat).
function varrerOrigens(r, ps, prop) {
  const rel = (abs) => relDe(r, abs);
  const juncoes = [];
  const foraDoPadrao = [];
  const regioesDeLinha = [];
  const pastaLinhas = path.join(r, 'linhas');
  const stLinhas = lstatOuNada(pastaLinhas);
  if (stLinhas && stLinhas.isSymbolicLink()) juncoes.push(rel(pastaLinhas));
  else if (stLinhas && stLinhas.isDirectory()) {
    for (const nome of fs.readdirSync(pastaLinhas).sort()) {
      const abs = path.join(pastaLinhas, nome);
      const st = fs.lstatSync(abs);
      if (st.isSymbolicLink()) juncoes.push(rel(abs));
      else if (!st.isDirectory()) continue;
      else if (LINHA.test(nome)) regioesDeLinha.push({ raiz: abs, tipo: 'linha' });
      else { foraDoPadrao.push(rel(abs)); regioesDeLinha.push({ raiz: abs, tipo: 'fora-do-padrao' }); }
    }
  }
  const regioes = [
    { raiz: ps.L.pastaMarca, tipo: 'comum' },
    { raiz: path.dirname(ps.L.perfil), tipo: 'comum', ignorar: new Set([path.join(path.dirname(ps.L.perfil), 'preferencias.md')]) },
    { raiz: path.dirname(ps.L.laboratorio), tipo: 'comum' },
    { raiz: path.dirname(ps.L.cronograma), tipo: 'comum' },
    { raiz: ps.L.publicacoes, tipo: 'comum' },
    ...regioesDeLinha,
  ];
  const raizesDePar = new Set(ps.lista.map((p) => p.de));
  const candidatos = [];
  const ficam = [];
  let doModelo = 0;
  const aoAtalho = (regiao) => (abs) => {
    const relA = rel(abs);
    // A própria pasta (ou arquivo) de um lugar da empresa é um atalho: recusa, nunca some em silêncio.
    if (raizesDePar.has(abs)) { juncoes.push(relA); return; }
    if (regiao.tipo === 'fora-do-padrao') { ficam.push({ caminho: relA, motivo: 'atalho' }); return; }
    if (regiao.tipo === 'comum' && ehDoModelo(relA, prop)) return;
    const p = parDe(ps, abs, 'de');
    if (regiao.tipo === 'linha' && (!p || (p.chave === 'dadosLinha' && !dentro(relA, prop.protegidos)))) return;
    ficam.push({ caminho: relA, motivo: 'atalho' });
  };
  for (const regiao of regioes) {
    const st = lstatOuNada(regiao.raiz);
    if (!st) continue;
    if (st.isSymbolicLink()) { juncoes.push(rel(regiao.raiz)); continue; }
    if (!st.isDirectory()) continue;
    andar(regiao.raiz, (abs, stA) => {
      if (regiao.ignorar && regiao.ignorar.has(abs)) return;
      // Temporário de uma gravação da própria Fábrica que foi interrompida: nunca é dado da empresa.
      if (ehTemporario(abs)) return;
      const relA = rel(abs);
      // Linha com nome que a Fábrica não aceita: não é linha, mas o que está nela aparece (fica no mesmo lugar).
      if (regiao.tipo === 'fora-do-padrao') { ficam.push({ caminho: relA, motivo: 'sem-lugar' }); return; }
      if (regiao.tipo === 'comum' && ehDoModelo(relA, prop)) { doModelo++; return; }
      const p = parDe(ps, abs, 'de');
      if (!p) {
        if (regiao.tipo === 'linha') doModelo++; // receita da linha (LEIA-ME, linha.yaml, passos...)
        else ficam.push({ caminho: relA, motivo: 'sem-lugar' });
        return;
      }
      if (p.chave === 'dadosLinha' && !dentro(relA, prop.protegidos)) { doModelo++; return; }
      candidatos.push({ par: p, abs, absPara: destinoDe(p, abs), bytes: stA.size, mtimeMs: stA.mtimeMs });
    }, aoAtalho(regiao));
  }
  return { candidatos, ficam, doModelo, juncoes: [...new Set(juncoes)].sort(), foraDoPadrao };
}

function montarInventario(r, x) {
  const { ps, nome, linhas, opcoes, confirmados, candidatos, ficam, doModelo, ilegiveis, quebrados, referencias, naoTraduzidas, textosAntigos, conteudos, recusas, avisos, juncoes, foraDoPadrao } = x;
  const rel = (abs) => relDe(r, abs);
  const nomeL = (l) => linhas[l] || l;
  if (juncoes.length) {
    recusas.push({ code: 'JUNCAO_NA_RAIZ', mensagem: `${plural(juncoes.length, 'pasta da empresa é um atalho', 'pastas da empresa são atalhos')} para outro lugar (por exemplo, outro disco). A organização não segue atalhos, e o que está do outro lado sumiria da Fábrica; troque o atalho pela pasta de verdade antes. Nada foi alterado.`, arquivos: juncoes });
  }
  if (foraDoPadrao.length) {
    avisos.push({ tipo: 'linha-fora-do-padrao', mensagem: `${plural(foraDoPadrao.length, 'pasta de linha tem', 'pastas de linha têm')} nome que a Fábrica não usa (com maiúscula, espaço ou acento). O que está nela continua no mesmo lugar.`, arquivos: foraDoPadrao });
  }
  // 3) O destino de cada um: livre (item), igual (já no lugar) ou ocupado por outra coisa (conflito).
  const itensC = [];
  const jaNoLugar = [];
  const conflitos = [];
  const reservadosAchados = [];
  const repetidos = [];
  const vistos = new Map();
  for (const c of candidatos) {
    if (!c.sha256) continue;
    const relPara = rel(c.absPara);
    if (c.par.chave === 'pastaMarca') {
      const primeiro = path.relative(ps.G, c.absPara).split(path.sep)[0];
      if (ps.reservados.has(nomeComparavel(primeiro))) { reservadosAchados.push(rel(c.abs)); continue; }
    }
    // Dois arquivos para o mesmo lugar (o Windows não diferencia maiúsculas): recusa, nunca um por cima do outro.
    const chaveRep = relPara.toLowerCase();
    if (vistos.has(chaveRep)) { repetidos.push(relPara); continue; }
    vistos.set(chaveRep, rel(c.abs));
    if (obstaculoNoCaminho(r, c.absPara)) { conflitos.push(relPara); continue; }
    const st = lstatOuNada(c.absPara);
    if (!st) { itensC.push(c); continue; }
    if (st.isFile() && hashArquivo(c.absPara) === c.sha256Destino) { jaNoLugar.push(c); continue; }
    conflitos.push(relPara);
  }
  itensC.sort((a, b) => (rel(a.abs) < rel(b.abs) ? -1 : 1));
  jaNoLugar.sort((a, b) => (rel(a.abs) < rel(b.abs) ? -1 : 1));

  const itens = itensC.map((c) => ({
    grupo: c.par.grupo,
    ...(c.par.linha ? { linha: c.par.linha } : {}),
    de: rel(c.abs),
    para: rel(c.absPara),
    bytes: c.bytes,
    sha256: c.sha256,
    ...(c.traduzir ? { traduzir: c.traduzir } : {}),
  }));
  const bytes = itens.reduce((s, i) => s + i.bytes, 0);

  // 4) Recusas (todas juntas) e avisos.
  if (conflitos.length || repetidos.length) {
    const n = conflitos.length + repetidos.length;
    recusas.push({ code: 'CONFLITO_NO_DESTINO', mensagem: `Na pasta da empresa já ${n === 1 ? 'existe 1 arquivo diferente' : `existem ${n} arquivos diferentes`} no lugar para onde iriam os de antes (ou dois arquivos iriam para o mesmo lugar). Nada foi alterado: a Fábrica mostra a lista, e você decide o que fica.`, arquivos: [...conflitos, ...repetidos].sort() });
  }
  if (reservadosAchados.length) {
    recusas.push({ code: 'CONFLITO_NO_DESTINO', mensagem: `${plural(reservadosAchados.length, 'arquivo da marca está', 'arquivos da marca estão')} numa pasta com nome que a Fábrica usa para outra coisa na pasta da empresa. Mude o nome dessa pasta antes; nada foi alterado.`, arquivos: reservadosAchados.sort() });
  }
  if (quebrados.length) {
    recusas.push({ code: 'JSON_INVALIDO', mensagem: `${plural(quebrados.length, 'arquivo de dados dos painéis está', 'arquivos de dados dos painéis estão')} com o formato quebrado. Corrija antes; nada foi alterado.`, arquivos: quebrados.sort() });
  }
  if (ilegiveis.length) {
    recusas.push({ code: 'ARQUIVO_ILEGIVEL', mensagem: `${plural(ilegiveis.length, 'arquivo não pôde ser lido', 'arquivos não puderam ser lidos')} (talvez ${ilegiveis.length === 1 ? 'esteja aberto' : 'estejam abertos'} em outro programa). Feche o programa e tente de novo.`, arquivos: ilegiveis.sort() });
  }
  const executando = [];
  for (const l of ps.linhas) {
    const arq = ps.L.estadoLinha(l);
    if (!fs.existsSync(arq)) continue;
    let status = null;
    try {
      status = (JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, '')) || {}).status;
    } catch {
      avisos.push({ tipo: 'run-parado', mensagem: `Não deu para ler o andamento da linha ${nomeL(l)}. Se havia um trabalho nela, ele continua da pasta nova; abra uma conversa nova para seguir.`, arquivos: [rel(arq)] });
      continue;
    }
    if (status === 'executando' && !confirmados.has(l)) executando.push({ l, arq: rel(arq) });
    else if (status === 'executando' || status === 'aguardando-responsavel' || status === 'parada') {
      avisos.push({ tipo: 'run-parado', mensagem: `O trabalho parado da linha ${nomeL(l)} continua da pasta nova; abra uma conversa nova para seguir.`, arquivos: [rel(arq)] });
    }
  }
  if (executando.length) {
    const nomes = juntar(executando.map((x) => nomeL(x.l)));
    const onde = executando.length === 1 ? `Há um trabalho em andamento na linha ${nomes}.` : `Há trabalho em andamento nas linhas ${nomes}.`;
    recusas.push({ code: 'RUN_EM_ANDAMENTO', mensagem: `${onde} Termine ou pare esse trabalho antes; se ele já está parado, confirme.`, linhas: executando.map((x) => x.l), arquivos: executando.map((x) => x.arq) });
  }
  const espacoLivre = opcoes.espacoLivre !== undefined ? opcoes.espacoLivre : espacoLivreDe(r);
  if (typeof espacoLivre === 'number' && espacoLivre < bytes * 1.1) {
    recusas.push({ code: 'ESPACO_INSUFICIENTE', mensagem: `Falta espaço no disco: a cópia precisa de ${tamanho(Math.ceil(bytes * 1.1))} e há ${tamanho(espacoLivre)} livres.` });
  }
  if (textosAntigos.length) {
    avisos.push({ tipo: 'texto-cita-lugar-antigo', mensagem: `${plural(textosAntigos.length, 'texto cita', 'textos citam')} lugares antigos. ${textosAntigos.length === 1 ? 'Ele vai como está: é histórico' : 'Eles vão como estão: são histórico'}.`, arquivos: textosAntigos.sort() });
  }
  if (naoTraduzidas.length) {
    const total = naoTraduzidas.reduce((s, x) => s + x.campos.length, 0);
    avisos.push({ tipo: 'referencia-nao-traduzida', mensagem: `${plural(total, 'referência antiga nos dados dos painéis fica como está, porque está', 'referências antigas nos dados dos painéis ficam como estão, porque estão')} fora dos campos que a Fábrica usa.`, arquivos: naoTraduzidas.map((x) => x.arquivo), campos: naoTraduzidas });
  }

  const inv = {
    empresa: LEGADO,
    nome,
    situacao: 'pasta-antiga',
    codigoSimulacao: codigoDe(itens),
    itens,
    jaNoLugar: jaNoLugar.map((c) => rel(c.absPara)),
    ficam: ficam.sort((a, b) => (a.caminho < b.caminho ? -1 : 1)),
    doModelo,
    referencias,
    avisos,
    recusas,
    bytes,
    espacoLivre: typeof espacoLivre === 'number' ? espacoLivre : null,
    linhas,
  };
  return { inv, interno: { ps, itens: itensC, jaNoLugar, conteudos } };
}

// Um pedaço do caminho até o destino (dentro da raiz) é atalho ou arquivo: nunca se grava através dele.
function obstaculoNoCaminho(r, absPara) {
  let atual = r;
  for (const parte of path.relative(r, path.dirname(absPara)).split(path.sep).filter(Boolean)) {
    atual = path.join(atual, parte);
    const st = lstatOuNada(atual);
    if (!st) return null;
    if (st.isSymbolicLink()) return 'atalho';
    if (!st.isDirectory()) return 'arquivo';
  }
  const st = lstatOuNada(absPara);
  if (st && st.isSymbolicLink()) return 'atalho';
  return null;
}

function inventario(r = empresa.raiz(), opcoes = {}) {
  return levantar(r, opcoes).inv;
}
// O mesmo inventário, com as recusas já calculadas: é o que a pessoa vê antes de confirmar.
function simular(r = empresa.raiz(), opcoes = {}) {
  return inventario(r, opcoes);
}

// ---------- gravação (só o aplicar e o desfazer gravam; a simulação nunca) ----------
const NADA_MUDOU = 'Nada mudou: a Fábrica continua usando os lugares de sempre.';
// O nome do comando na /fabrica é o que a pessoa escolheu (organizar-pasta; desfazer: organizar-pasta desfazer).
const FRASE_DESFAZER = 'Para desfazer, digite /fabrica organizar-pasta desfazer (ou peça na conversa: "desfazer a organização da pasta"). Tudo volta a ser como era antes, e o que foi feito depois disso não se perde.';
const arqIndice = (r) => path.join(r, 'empresas', 'indice.json');
const arqAtiva = (r) => path.join(r, 'empresas', 'ativa.json');
const absDe = (r, rel) => path.join(r, ...rel.split('/'));

// Grava num arquivo temporário e troca de nome (o padrão do gravarJson do empresa.js): se der problema no meio, o
// arquivo antigo continua inteiro.
function gravarJsonAtomico(arq, valor) {
  const tmp = arq + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, arq);
}

// A trava: empresas/.migracao.lock, criada com exclusividade. Guarda o número do processo e a hora em que foi criada,
// para saber se quem a deixou ainda está rodando (vivo: recusa; morto: a mudança ficou pela metade).
function processoVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}
// Lê uma trava (a principal ou a .tomada). Conteúdo vazio ou ilegível vem como {}; sempre com a data do arquivo.
function lerTrava(r, arq = arqTrava(r)) {
  let texto;
  let st;
  try {
    st = fs.statSync(arq);
    texto = fs.readFileSync(arq, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
  let t = {};
  try {
    const x = JSON.parse(texto);
    if (x && typeof x === 'object' && !Array.isArray(x)) t = x;
  } catch { /* vazia ou pela metade */ }
  return { ...t, mtimeArquivo: st.mtimeMs };
}
// Trava sem pid legível com menos disto é de alguém que acabou de criá-la (ainda escrevendo o conteúdo): viva.
const TRAVA_RECENTE_MS = 60000;
const UM_DIA_MS = 24 * 3600 * 1000;
// Quando o processo `pid` começou (ms), ou null se não deu para saber. Só é chamado para trava com mais de um dia.
function inicioDoProcesso(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    const x = process.platform === 'win32'
      ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().ToString('o')`], { encoding: 'utf8', timeout: 20000, windowsHide: true })
      : spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 10000 });
    const ms = Date.parse(String(x.stdout || '').trim());
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}
function travaViva(trava) {
  if (trava === null) return false;
  if (!Number.isInteger(trava.pid)) return Date.now() - trava.mtimeArquivo < TRAVA_RECENTE_MS;
  if (!processoVivo(trava.pid)) return false;
  // Número de processo reaproveitado pelo sistema: trava com mais de um dia cujo pid é hoje de um processo que começou
  // depois dela. Sem conseguir ler a hora de início do processo, fica como viva (seguro: recusa).
  const criada = Date.parse(trava.inicio) || trava.mtimeArquivo;
  if (trava.pid !== process.pid && Date.now() - criada > UM_DIA_MS) {
    const comecou = inicioDoProcesso(trava.pid);
    if (comecou !== null && comecou > criada + 60000) return false;
  }
  return true;
}
const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Cria `arq` já com o conteúdo, com exclusividade: o conteúdo vai para um arquivo próprio do processo e o nome final
// nasce por link (falha se já existe). Assim ninguém lê a trava vazia. Sem link no disco: criação exclusiva e escrita
// logo em seguida (e a trava vazia recente conta como viva). Devolve false se `arq` já existia.
function criarComConteudo(arq, texto) {
  const novo = `${arq}.${process.pid}.novo`;
  fs.writeFileSync(novo, texto);
  try {
    try {
      fs.linkSync(novo, arq);
      return true;
    } catch (e) {
      if (e.code === 'EEXIST') return false;
    }
    let fd;
    try {
      fd = fs.openSync(arq, 'wx');
    } catch (e) {
      if (e.code === 'EEXIST') return false;
      throw e;
    }
    try { fs.writeSync(fd, texto); } finally { fs.closeSync(fd); }
    return true;
  } finally {
    try { fs.unlinkSync(novo); } catch { /* já saiu */ }
  }
}

function pegarTrava(r, acao, { aceitarAbandonada = false } = {}) {
  const dirEmp = path.join(r, 'empresas');
  const st = lstatOuNada(dirEmp);
  if (st && (st.isSymbolicLink() || !st.isDirectory())) {
    throw erro('CONFLITO_NO_DESTINO', 'A pasta das empresas é um atalho para outro lugar (ou não é uma pasta). Nada foi alterado.', { arquivos: ['empresas'] });
  }
  const criouEmpresas = !st;
  if (criouEmpresas) fs.mkdirSync(dirEmp);
  const soltarPasta = () => {
    if (!criouEmpresas) return;
    try { fs.rmdirSync(dirEmp); } catch { /* já tem outra coisa dentro: fica */ }
  };
  const conteudo = (extra) => JSON.stringify({ pid: process.pid, acao, inicio: new Date().toISOString(), ...extra });
  const emAndamento = () => erro('MIGRACAO_EM_ANDAMENTO', 'Uma organização da pasta está em andamento ou ficou pela metade. Nada foi alterado.', { arquivos: ['empresas/.migracao.lock'] });
  const tomada = arqTrava(r) + '.tomada';
  let abandonada = null;
  // Trava de um processo que morreu (abandonada): quem pediu pode assumir. A tomada é exclusiva: só quem cria a
  // segunda trava (.tomada) tira a abandonada; os outros esperam um pouco e tentam de novo, e aí acham a trava nova,
  // viva, e recusam. Dois pedidos ao mesmo tempo nunca seguem os dois. Tomada de processo morto também é tirada.
  for (let tentativa = 0; ; tentativa++) {
    let criou;
    try {
      criou = criarComConteudo(arqTrava(r), conteudo(abandonada ? { assumida: true } : {}));
    } catch (e) {
      soltarPasta();
      throw e;
    }
    if (criou) break;
    const atual = lerTrava(r);
    if (atual === null) continue; // saiu entre as duas chamadas: tenta criar de novo
    if (!aceitarAbandonada || travaViva(atual) || tentativa >= 80) {
      soltarPasta();
      throw emAndamento();
    }
    if (!criarComConteudo(tomada, conteudo())) {
      const t = lerTrava(r, tomada);
      if (t !== null && !travaViva(t)) {
        // Tomada órfã: sai por troca de nome (só um consegue) e é conferida depois; se era de alguém vivo, volta.
        const velha = `${tomada}.${process.pid}.velha`;
        try { fs.renameSync(tomada, velha); } catch (e) { if (e.code !== 'ENOENT') throw e; continue; }
        const v = lerTrava(r, velha);
        if (v !== null && travaViva(v)) { try { fs.linkSync(velha, tomada); } catch { /* outra já nasceu */ } }
        try { fs.unlinkSync(velha); } catch { /* já saiu */ }
        continue;
      }
      esperar(25); // outro pedido está assumindo: espera
      continue;
    }
    try {
      const deNovo = lerTrava(r);
      if (deNovo !== null && !travaViva(deNovo)) {
        try { fs.unlinkSync(arqTrava(r)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        abandonada = deNovo;
      }
    } finally {
      try { fs.unlinkSync(tomada); } catch { /* já saiu */ }
    }
  }
  return {
    criouEmpresas,
    abandonada,
    soltar() {
      try { fs.unlinkSync(arqTrava(r)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      soltarPasta();
    },
  };
}

// Grava um arquivo com segurança: um temporário na MESMA pasta (".<nome>.migracao-tmp"), a data, o sha256 conferido
// e só então o nome final, com exclusividade (link, que falha se o final já existe). Nunca sobrescreve. Morte no meio
// deixa só o temporário, nunca um final pela metade; quem repetir apaga o temporário (é sempre desta mudança) e grava
// de novo. Sem link no disco (alguns pendrives e discos de rede): cópia exclusiva do temporário para o final, que
// também falha se o final já existe (a troca de nome, no Windows, substituiria um destino que tivesse aparecido), e o
// final é conferido. Limitação só desse caso: morte no meio dessa última cópia pode deixar um final incompleto.
const temporarioDe = (final) => path.join(path.dirname(final), `.${path.basename(final)}${SUFIXO_TEMPORARIO}`);
function gravarSeguro(final, { fonte, conteudo, sha, mtimeMs, aoGravar }) {
  const tmp = temporarioDe(final);
  fs.mkdirSync(path.dirname(final), { recursive: true });
  try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (conteudo) fs.writeFileSync(tmp, conteudo, { flag: 'wx' });
  else fs.copyFileSync(fonte, tmp, fs.constants.COPYFILE_EXCL);
  try {
    // A data: a cópia do sistema já leva a do original, exata (no Windows, até a fração do milissegundo); só quando
    // ela não veio (outro sistema, ou conteúdo gravado na hora) é que se ajusta, com a precisão do milissegundo.
    if (mtimeMs !== undefined && Math.floor(fs.statSync(tmp).mtimeMs) !== Math.floor(mtimeMs)) fs.utimesSync(tmp, new Date(), new Date(mtimeMs));
    if (sha && hashArquivo(tmp) !== sha) {
      throw erro('COPIA_DIFERENTE', 'A cópia de um arquivo não ficou igual ao original; nada foi apagado.', { arquivos: [] });
    }
    if (aoGravar) aoGravar('temporario-pronto', final);
    try {
      fs.linkSync(tmp, final);
    } catch (e) {
      if (e.code === 'EEXIST') throw Object.assign(new Error('EEXIST: o destino já existe'), { code: 'EEXIST', path: final });
      fs.copyFileSync(tmp, final, fs.constants.COPYFILE_EXCL);
      try {
        if (mtimeMs !== undefined && Math.floor(fs.statSync(final).mtimeMs) !== Math.floor(mtimeMs)) fs.utimesSync(final, new Date(), new Date(mtimeMs));
        if (sha && hashArquivo(final) !== sha) {
          throw erro('COPIA_DIFERENTE', 'A cópia de um arquivo não ficou igual ao original; nada foi apagado.', { arquivos: [] });
        }
      } catch (e2) {
        try { fs.unlinkSync(final); } catch { /* já saiu */ } // é a cópia que acabou de nascer, exclusiva
        throw e2;
      }
      if (aoGravar) aoGravar('final-pronto', final);
      fs.unlinkSync(tmp);
      return;
    }
    if (aoGravar) aoGravar('final-pronto', final);
    fs.unlinkSync(tmp);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch { /* já saiu */ }
    throw e;
  }
}

// `parcial` é exatamente o começo de `inteiro`, seguido só de zeros (o Windows reserva o tamanho cheio antes de copiar)?
// Lê por pedaços (vídeo grande não vai inteiro para a memória). Só abre para ler.
function ehComecoDe(parcial, inteiro) {
  if (fs.statSync(parcial).size > fs.statSync(inteiro).size) return false;
  const fp = fs.openSync(parcial, 'r');
  const fi = fs.openSync(inteiro, 'r');
  try {
    const bp = Buffer.allocUnsafe(MEGA);
    const bi = Buffer.allocUnsafe(MEGA);
    let soZeros = false;
    let lidos;
    while ((lidos = fs.readSync(fp, bp, 0, MEGA, null)) > 0) {
      const li = fs.readSync(fi, bi, 0, lidos, null);
      if (!soZeros && li === lidos && bp.subarray(0, lidos).equals(bi.subarray(0, lidos))) continue;
      for (let j = 0; j < lidos; j++) {
        if (soZeros || j >= li || bp[j] !== bi[j]) {
          if (bp[j] !== 0) return false;
          soZeros = true;
        }
      }
    }
    return true;
  } finally {
    fs.closeSync(fp);
    fs.closeSync(fi);
  }
}

// Uma gravação segura que morreu no meio da última cópia (disco sem link): o final existe, diferente do sha256
// registrado, o temporário dela continua lá com o sha256 registrado (ele só sai depois de o final ser conferido) e o
// final é exatamente o começo do temporário (com zeros no fim, no máximo). Só então é a nossa cópia pela metade: o
// pedaço vai para `guarda` (na pasta da mudança; nunca é apagado) e quem chama refaz a gravação. Qualquer outro final
// diferente é de alguém (a pessoa, outra conversa) e fica onde está. Precisa vir ANTES de qualquer limpeza de
// temporários. Devolve true se guardou um pedaço.
function guardarCopiaPelaMetade(final, sha, guarda) {
  const tmp = temporarioDe(final);
  const st = lstatOuNada(final);
  const stT = lstatOuNada(tmp);
  if (!st || !st.isFile() || !stT || !stT.isFile()) return false;
  if (hashArquivo(final) === sha || hashArquivo(tmp) !== sha) return false;
  if (!ehComecoDe(final, tmp)) return false;
  moverPara(final, guarda);
  return true;
}

// Pasta da mudança: _fabrica/_backup/migracao-<AAAAMMDD-HHMMSS> (hora local), com -2, -3... se repetir.
function criarPastaDaMudanca(r) {
  const d = new Date();
  const dois = (v) => String(v).padStart(2, '0');
  const base = `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}`;
  fs.mkdirSync(pastaBackup(r), { recursive: true });
  for (let i = 1; i < 1000; i++) {
    const carimbo = i === 1 ? base : `${base}-${i}`;
    const dir = path.join(pastaBackup(r), `migracao-${carimbo}`);
    try {
      fs.mkdirSync(dir);
      return { carimbo, dir };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  throw erro('FALHA_NA_COPIA', 'Não deu para criar a pasta da cópia de segurança.');
}

// O que existe hoje nos lugares de destino (na pasta da empresa), sem seguir atalho: arquivos, pastas e atalhos,
// relativos à raiz. Na pasta da empresa em si, só os nomes que não são reservados (os da marca).
function destinosAtuais(r, ps) {
  const arquivos = new Set();
  const pastas = new Set();
  const atalhos = new Set();
  const rel = (abs) => relDe(r, abs);
  const visitar = (abs) => {
    const st = lstatOuNada(abs);
    if (!st) return;
    if (st.isSymbolicLink()) { atalhos.add(rel(abs)); return; }
    if (st.isFile()) { arquivos.add(rel(abs)); return; }
    if (!st.isDirectory()) return;
    pastas.add(rel(abs));
    andar(abs, (a) => arquivos.add(rel(a)), (a) => atalhos.add(rel(a)), (a) => pastas.add(rel(a)));
  };
  for (const p of ps.lista) {
    if (p.chave === 'pastaMarca') {
      let nomes = [];
      try { nomes = fs.readdirSync(p.para); } catch (e) { if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e; }
      for (const n of nomes) if (!ps.reservados.has(nomeComparavel(n))) visitar(path.join(p.para, n));
    } else {
      visitar(p.para);
    }
  }
  const ordena = (s) => [...s].sort();
  return { arquivos: ordena(arquivos), pastas: ordena(pastas), atalhos: ordena(atalhos) };
}

// Pastas que ainda não existem até `absDir` (dentro da raiz), da mais rasa para a mais funda.
function pastasQueFaltam(r, absDir, acc) {
  const faltam = [];
  let d = absDir;
  while (d.startsWith(r + path.sep) && !fs.existsSync(d)) { faltam.unshift(d); d = path.dirname(d); }
  for (const f of faltam) acc.add(relDe(r, f));
}
const porProfundidade = (lista, maisFundaPrimeiro) => [...lista].sort((a, b) => {
  const pa = a.split('/').length;
  const pb = b.split('/').length;
  return maisFundaPrimeiro ? pb - pa || (a < b ? 1 : -1) : pa - pb || (a < b ? -1 : 1);
});
// Tira as pastas que ficaram vazias, da mais funda para a mais rasa. Pasta com qualquer coisa dentro fica.
function tirarPastasVazias(r, lista) {
  for (const p of porProfundidade(lista, true)) {
    try { fs.rmdirSync(absDe(r, p)); } catch { /* não está vazia (ou já saiu): fica */ }
  }
}

function copiaDoControle(arq) {
  const st = lstatOuNada(arq);
  return st && st.isFile() ? { existia: true, sha256: hashArquivo(arq) } : { existia: false, sha256: null };
}

// A virada: a empresa principal passa a usar a pasta própria. Preserva as outras entradas e os outros campos.
// Sem índice (empresa da pasta antiga ainda não registrada), cria o índice com ela.
function virarIndice(r, carimbo) {
  const arq = arqIndice(r);
  const lista = empresa.listar(r); // confere o formato; lança JSON_INVALIDO se estiver quebrado
  const existe = fs.existsSync(arq);
  const indice = existe
    ? JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, ''))
    : { empresas: lista.map(({ virtual, ...resto }) => resto) };
  let achou = false;
  const d = new Date();
  const dois = (v) => String(v).padStart(2, '0');
  const em = `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
  indice.empresas = indice.empresas.map((e) => {
    if (e.codigo !== LEGADO) return e;
    achou = true;
    return { ...e, disposicao: 'gaveta', migrada: { em, carimbo } };
  });
  if (!achou) throw erro('FALHA_NA_COPIA', 'A empresa da pasta antiga sumiu da lista de empresas durante a cópia.');
  gravarJsonAtomico(arq, indice);
}

// Copia, confere e vira. Ver o cabeçalho e o plano da etapa 9 (Tarefa 4) para a ordem dos passos.
function aplicar(r = empresa.raiz(), opcoes = {}) {
  const { confirmar, aoCopiar } = opcoes;
  const runParadoConfirmado = opcoes.runParadoConfirmado || [];
  if (typeof confirmar !== 'string' || confirmar.trim() === '') {
    throw erro('USO', 'Falta o código da simulação: simule antes e confirme com o código que a simulação mostrou.');
  }
  // 1) Trava.
  // Trava abandonada (organização anterior morreu antes de gravar) é assumida; mudança pela metade, a simulação recusa.
  const trava = pegarTrava(r, 'aplicar', { aceitarAbandonada: true });
  const avisosDaTrava = trava.abandonada ? [{ ...AVISO_TRAVA_ABANDONADA }] : [];
  let dir = null;
  let carimbo = null;
  let manifesto = null;
  const criados = [];
  let pastasCriadas = [];
  let virou = false;
  try {
    // 2) A simulação de novo: o que a pessoa viu é exatamente o que é feito.
    const { inv, interno } = levantar(r, { runParadoConfirmado, espacoLivre: opcoes.espacoLivre, dentroDaTrava: true });
    if (inv.recusas.length) {
      throw erro(inv.recusas[0].code, `${NADA_MUDOU} ${inv.recusas.map((x) => x.mensagem).join(' ')}`, { recusas: inv.recusas, arquivos: inv.recusas.flatMap((x) => x.arquivos || []) });
    }
    if (inv.situacao !== 'pasta-antiga') {
      trava.soltar();
      return { situacao: inv.situacao, carimbo: null, pastaBackup: null, relatorio: null, copiados: 0, jaNoLugar: 0, traduzidos: 0, grupos: [], avisos: [] };
    }
    if (inv.codigoSimulacao !== confirmar.trim()) {
      throw erro('SIMULACAO_DESATUALIZADA', `${NADA_MUDOU} A pasta mudou depois da simulação, e o que seria feito não é mais o que foi mostrado. Simule de novo.`);
    }
    const ps = interno.ps;
    const rel = (abs) => relDe(r, abs);

    // 3) Cópia de segurança dos controles e o manifesto, em "copiando".
    ({ carimbo, dir } = criarPastaDaMudanca(r));
    const arqRelatorio = path.join(ps.Gv.historico, `migracao-${carimbo}.md`);
    const faltam = new Set();
    for (const c of interno.itens) pastasQueFaltam(r, path.dirname(c.absPara), faltam);
    pastasQueFaltam(r, path.dirname(arqRelatorio), faltam);
    pastasCriadas = porProfundidade([...(trava.criouEmpresas ? ['empresas'] : []), ...faltam], false);
    const antes = destinosAtuais(r, ps);
    manifesto = {
      versao: 1,
      carimbo,
      empresa: LEGADO,
      status: 'copiando',
      codigoSimulacao: inv.codigoSimulacao,
      inicio: new Date().toISOString(),
      fim: null,
      indiceAntes: copiaDoControle(arqIndice(r)),
      ativaAntes: copiaDoControle(arqAtiva(r)),
      itens: interno.itens.map((c) => ({
        grupo: c.par.grupo,
        ...(c.par.linha ? { linha: c.par.linha } : {}),
        de: rel(c.abs),
        para: rel(c.absPara),
        sha256Origem: c.sha256,
        sha256Destino: c.sha256Destino,
        bytes: c.bytes,
        mtimeMs: c.mtimeMs,
        traduzido: !!c.traduzir,
      })),
      // sha256Origem: o do antigo, para a retirada conferir que ele continua igual antes de guardá-lo.
      jaNoLugar: interno.jaNoLugar.map((c) => ({ de: rel(c.abs), para: rel(c.absPara), sha256: c.sha256Destino, sha256Origem: c.sha256 })),
      pastasCriadas,
      pastasAntes: antes.pastas,
      preexistentes: antes.arquivos,
      relatorio: rel(arqRelatorio),
      ficam: inv.ficam,
      referencias: inv.referencias,
      avisos: inv.avisos,
    };
    const arqManifesto = path.join(dir, 'manifesto.json');
    gravarJsonAtomico(arqManifesto, manifesto);
    const controle = path.join(dir, 'controle');
    fs.mkdirSync(controle);
    if (manifesto.indiceAntes.existia) fs.copyFileSync(arqIndice(r), path.join(controle, 'indice.json'), fs.constants.COPYFILE_EXCL);
    if (manifesto.ativaAntes.existia) fs.copyFileSync(arqAtiva(r), path.join(controle, 'ativa.json'), fs.constants.COPYFILE_EXCL);

    // 4) Cópia de cada item: temporário na mesma pasta, data da origem, sha256 conferido e só então o nome final, com
    //    exclusividade (nunca por cima). Destino que apareceu do nada não é deste aplicar: nunca é apagado.
    for (let i = 0; i < interno.itens.length; i++) {
      const c = interno.itens[i];
      if (aoCopiar) aoCopiar(i, inv.itens[i]);
      const traduzido = interno.conteudos.get(rel(c.abs));
      try {
        gravarSeguro(c.absPara, { fonte: c.abs, conteudo: traduzido, sha: c.sha256Destino, mtimeMs: c.mtimeMs, aoGravar: opcoes.aoGravar });
      } catch (e) {
        if (e.code === 'COPIA_DIFERENTE') e.arquivos = [rel(c.absPara)];
        throw e;
      }
      criados.push(c.absPara);
    }

    // 5) Conferência das origens: nada mudou, sumiu ou apareceu nas pastas antigas durante a cópia.
    const eram = new Map([...interno.itens, ...interno.jaNoLugar].map((c) => [rel(c.abs), c.sha256]));
    const agora = varrerOrigens(r, ps, lerPropriedade()).candidatos;
    const mudaram = [];
    const vistos = new Set();
    for (const c of agora) {
      const k = rel(c.abs);
      vistos.add(k);
      let h = null;
      try { h = hashArquivo(c.abs); } catch { /* ilegível agora: conta como mudado */ }
      if (eram.get(k) !== h) mudaram.push(k);
    }
    for (const k of eram.keys()) if (!vistos.has(k)) mudaram.push(k);
    if (mudaram.length) {
      throw erro('ORIGEM_MUDOU', 'Arquivos antigos mudaram durante a cópia (talvez um painel aberto ou outra conversa trabalhando). Feche o que estiver aberto e tente de novo.', { arquivos: mudaram.sort() });
    }

    // 6) A virada do índice: o único passo que muda o comportamento da Fábrica (gravação atômica).
    virarIndice(r, carimbo);
    virou = true;

    // 7) Fechamento: relatório, manifesto em "aplicada" e a trava sai. Daqui em diante nada volta atrás.
    const avisosFim = [];
    try {
      fs.mkdirSync(path.dirname(arqRelatorio), { recursive: true });
      fs.writeFileSync(arqRelatorio, textoRelatorio(inv, carimbo, new Date()), { encoding: 'utf8', flag: 'wx' });
    } catch (e) {
      manifesto.relatorio = null;
      avisosFim.push({ tipo: 'relatorio', mensagem: `O relatório não pôde ser gravado (${e.code || e.message}); a mudança foi feita.` });
    }
    // A página do relatório, ao lado do texto (temporário e nome final exclusivo: nunca por cima). O registro guarda os
    // dados dela, para o retirar e o desfazer a marcarem depois.
    const arqPagina = arqRelatorio.replace(/\.md$/, '.html');
    try {
      const dados = { ...dadosDaPagina(inv, { feito: true }), feitaEm: dataLegivel(new Date()), carimbo, fraseDesfazer: FRASE_DESFAZER };
      const conteudo = Buffer.from(require('./migrar-pagina').paginaRelatorio(dados), 'utf8');
      gravarSeguro(arqPagina, { conteudo, sha: hashBuffer(conteudo) });
      manifesto.pagina = { arquivo: rel(arqPagina), sha256: hashBuffer(conteudo), dados };
    } catch (e) {
      avisosFim.push({ tipo: 'relatorio', mensagem: `A página do relatório não pôde ser gravada (${e.code || e.message}); a mudança foi feita.` });
    }
    manifesto.status = 'aplicada';
    manifesto.fim = new Date().toISOString();
    manifesto.indiceDepois = { sha256: hashArquivo(arqIndice(r)) };
    try {
      gravarJsonAtomico(arqManifesto, manifesto);
    } catch (e) {
      avisosFim.push({ tipo: 'registro', mensagem: `O registro da mudança não pôde ser fechado (${e.code || e.message}).` });
    }
    trava.soltar();
    return {
      situacao: 'organizada',
      carimbo,
      pastaBackup: rel(dir),
      relatorio: manifesto.relatorio,
      relatorioPagina: manifesto.pagina ? manifesto.pagina.arquivo : null,
      nome: inv.nome,
      bytes: inv.bytes,
      copiados: criados.length,
      jaNoLugar: interno.jaNoLugar.length,
      traduzidos: interno.itens.filter((c) => c.traduzir).length,
      grupos: porGrupo(inv.itens, inv.linhas).map(({ rotulo: g, n, bytes }) => ({ rotulo: g, arquivos: n, bytes })),
      avisos: [...avisosDaTrava, ...inv.avisos, ...avisosFim],
    };
  } catch (e) {
    // Depois da virada a mudança está feita: nunca apaga as cópias que a Fábrica já usa.
    if (virou) throw e;
    // Volta atrás: apaga só as cópias que este aplicar criou e as pastas que ele criou e ficaram vazias.
    for (const arq of criados.reverse()) {
      try { fs.unlinkSync(arq); } catch { /* já saiu */ }
    }
    tirarPastasVazias(r, pastasCriadas.filter((p) => p !== 'empresas'));
    if (manifesto && dir) {
      manifesto.status = 'desfeita-por-erro';
      manifesto.motivo = e.message;
      manifesto.fim = new Date().toISOString();
      try { gravarJsonAtomico(path.join(dir, 'manifesto.json'), manifesto); } catch { /* fica o registro em "copiando" */ }
    }
    trava.soltar();
    if (!dir) throw e; // recusa antes de qualquer cópia: nada foi gravado
    const conhecido = ['COPIA_DIFERENTE', 'ORIGEM_MUDOU'].includes(e.code);
    throw erro(conhecido ? e.code : 'FALHA_NA_COPIA', `${NADA_MUDOU} ${conhecido ? e.message : 'Deu um problema durante a cópia; feche os programas que estiverem usando os arquivos e tente de novo.'}`, { carimbo, arquivos: e.arquivos || [], causa: e.message });
  }
}

// ---------- estado e desfazer ----------
const dataDoCarimbo = (m) => `${m.base.slice(0, 4)}-${m.base.slice(4, 6)}-${m.base.slice(6, 8)}`;
// Chaves das linhas que são sempre da empresa (o runner sempre as traduz); dadosLinha segue o propriedade.json.
const CHAVES_DE_LINHA_DA_EMPRESA = new Set(['saidas', 'memoria', 'estadoLinha', 'investigacoes']);

// Em que pé está a organização da pasta. Só lê (nem a trava abandonada é tirada aqui).
function estado(r = empresa.raiz()) {
  const lista = empresa.listar(r);
  const todas = mudancas(r, { soIniciadas: true });
  const ultimaM = todas.length ? todas[todas.length - 1] : null;
  const ultima = ultimaM
    ? { carimbo: ultimaM.carimbo, status: ultimaM.manifesto ? ultimaM.manifesto.status : 'ilegivel', em: dataDoCarimbo(ultimaM) }
    : null;
  const trava = situacaoDaTrava(r);
  const entrada = lista.find((e) => e.codigo === LEGADO) || null;
  const virada = !!(entrada && entrada.disposicao === 'gaveta' && entrada.migrada && ultimaM && entrada.migrada.carimbo === ultimaM.carimbo);
  const st = ultima ? ultima.status : null;
  const pendencias = [];
  let situacao;
  if (trava === 'viva') {
    situacao = 'interrompida';
    pendencias.push({ tipo: 'em-andamento', mensagem: 'Uma organização da pasta (ou o desfazer dela) está acontecendo agora.' });
  } else if (st === 'desfazendo') {
    situacao = 'interrompida';
    pendencias.push({
      tipo: 'desfazer-pela-metade',
      mensagem: virada
        ? 'O desfazer ficou pela metade, e a Fábrica ainda usa a pasta da empresa. Feche os programas que estiverem usando os arquivos e peça para desfazer de novo: ele continua de onde parou.'
        : 'O desfazer ficou pela metade (talvez um arquivo aberto em outro programa). A Fábrica já usa os lugares de sempre. Feche os programas e peça para desfazer de novo: ele continua de onde parou.',
    });
  } else if (st === 'retirando') {
    situacao = 'interrompida';
    pendencias.push({
      tipo: 'retirada-pela-metade',
      mensagem: 'A guarda dos arquivos de antes na cópia de segurança ficou pela metade. A Fábrica já usa a pasta da empresa, que está completa, e nada se perdeu. Peça para guardar os arquivos de antes de novo (continua de onde parou) ou para desfazer a organização.',
    });
  } else if (st === 'copiando') {
    situacao = 'interrompida';
    pendencias.push({
      tipo: 'interrompida',
      mensagem: virada
        ? 'A organização foi feita, mas não terminou de fechar: a Fábrica já usa a pasta da empresa. Dá para desfazer, se quiser.'
        : 'Uma organização da pasta ficou pela metade. A Fábrica continua usando os lugares de sempre, e dá para desfazer o que ficou pela metade.',
    });
  } else {
    if (trava === 'abandonada') pendencias.push({ ...AVISO_TRAVA_ABANDONADA });
    if (entrada && entrada.disposicao === 'legado') {
      situacao = 'pasta-antiga';
    } else if (entrada && entrada.migrada) {
      const m = todas.find((x) => x.carimbo === entrada.migrada.carimbo);
      const stm = m && m.manifesto ? m.manifesto.status : null;
      if (stm === 'aplicada') {
        situacao = 'organizada-com-antigos';
        pendencias.push({ tipo: 'antigos-no-lugar', mensagem: 'Os arquivos de antes continuam onde estavam, como cópia de segurança.' });
      } else if (stm === 'retirada') situacao = 'organizada-antigos-retirados';
      else situacao = 'organizada';
    } else {
      situacao = 'organizada';
    }
  }
  // A oferta da /fabrica ao criar a segunda empresa: só com exatamente duas empresas e a primeira ainda no formato
  // antigo. Nada é gravado (nem uma marca de "já ofereci"): com a terceira empresa, ou já organizada, não há oferta.
  const oferecer = situacao === 'pasta-antiga' && lista.length === 2;
  return { situacao, ultima, pendencias, empresas: lista.length, oferecer };
}

// Move um arquivo, nunca apaga: renomeia; em outro disco, copia, confere e só então tira o de origem. Destino já
// ocupado (desfazer repetido) ganha um nome livre ao lado (.1, .2...). Devolve onde ele foi parar.
function moverPara(de, para) {
  let alvo = para;
  for (let i = 1; fs.existsSync(alvo); i++) alvo = `${para}.${i}`;
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  try {
    fs.renameSync(de, alvo);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    const h = hashArquivo(de);
    fs.copyFileSync(de, alvo, fs.constants.COPYFILE_EXCL);
    if (hashArquivo(alvo) !== h) {
      fs.unlinkSync(alvo);
      throw erro('COPIA_DIFERENTE', 'A cópia de segurança de um arquivo não ficou igual ao original; nada foi apagado.');
    }
    fs.unlinkSync(de);
  }
  return alvo;
}

// Põe de volta, campo por campo, o valor de antes das referências traduzidas (campo no formato "[0].path",
// '["id"].pasta' ou "[0].images[1]"), só onde o valor ainda é o traduzido.
function voltarPeloRegistro(valor, refs) {
  for (const x of refs) {
    const passos = [];
    const re = /\[(\d+)\]|\[("(?:[^"\\]|\\.)*")\]|\.([^.[\]]+)/g;
    let mm;
    while ((mm = re.exec(x.campo))) passos.push(mm[1] !== undefined ? Number(mm[1]) : mm[2] !== undefined ? JSON.parse(mm[2]) : mm[3]);
    if (!passos.length) continue;
    let alvo = valor;
    for (const p of passos.slice(0, -1)) alvo = alvo !== null && typeof alvo === 'object' ? alvo[p] : undefined;
    const ultimo = passos[passos.length - 1];
    if (alvo !== null && typeof alvo === 'object' && alvo[ultimo] === x.para) alvo[ultimo] = x.de;
  }
  return valor;
}

// Arquivo preso por outro programa (ou sem permissão) no meio do desfazer: recusa em português, sem caminho completo.
const CODIGOS_DE_PRESO = new Set(['EBUSY', 'EPERM', 'EACCES']);
function comoRecusaDePreso(r, e, acao = 'desfazer') {
  if (!e || !CODIGOS_DE_PRESO.has(e.code)) return e;
  const rel = typeof e.path === 'string' ? relDe(r, e.path) : null;
  const pedido = acao === 'retirar'
    ? 'peça para guardar os arquivos de antes de novo: continua de onde parou'
    : 'peça para desfazer de novo: o desfazer continua de onde parou';
  return erro('ARQUIVO_PRESO', `Um arquivo está aberto em outro programa (por exemplo, um vídeo tocando) e não pôde ser movido. Feche o programa e ${pedido}. Nada foi apagado.`, { arquivos: rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? [rel] : [] });
}

function desfazer(r = empresa.raiz(), carimbo, opcoes = {}) {
  const levarNovos = !!opcoes.levarNovos;
  if (opcoes.confirmar !== true) throw erro('USO', 'Para desfazer, confirme: desfazer --confirmar.');
  const trava0 = situacaoDaTrava(r);
  if (trava0 === 'viva') throw erro('MIGRACAO_EM_ANDAMENTO', 'Uma organização da pasta está em andamento ou ficou pela metade. Nada foi alterado.', { arquivos: ['empresas/.migracao.lock'] });
  // Nada a desfazer: a trava abandonada (de uma organização que morreu antes de gravar) sai, e a recusa é limpa.
  const nada = (motivo) => {
    let extra = '';
    if (trava0 === 'abandonada') {
      pegarTrava(r, 'desfazer', { aceitarAbandonada: true }).soltar();
      extra = ' Só saiu a trava deixada por uma organização interrompida antes de gravar.';
    }
    return erro('NADA_A_DESFAZER', `${motivo} Nada foi alterado.${extra}`);
  };
  const todas = mudancas(r, { soIniciadas: true });
  if (carimbo && !todas.some((m) => m.carimbo === carimbo) && mudancas(r).some((m) => m.carimbo === carimbo)) {
    throw nada('Essa organização nunca começou (parou antes de gravar o registro).');
  }
  if (!todas.length) throw nada('Esta pasta nunca foi organizada: não há o que desfazer.');
  const alvo = carimbo ? todas.find((m) => m.carimbo === carimbo) : todas[todas.length - 1];
  if (!alvo) throw erro('CARIMBO_DESCONHECIDO', `A organização "${carimbo}" não existe nesta pasta. Nada foi alterado.`);
  if (!alvo.manifesto) throw erro('REGISTRO_ILEGIVEL', 'O registro dessa organização não pôde ser lido. Nada foi alterado.');
  const m = alvo.manifesto;
  // Depois da retirada (ou com ela pela metade) também: os antigos guardados voltam antes de tudo.
  if (!['aplicada', 'copiando', 'desfazendo', 'retirada', 'retirando'].includes(m.status)) throw nada('Essa organização já foi desfeita.');
  const entrada = empresa.listar(r).find((e) => e.codigo === LEGADO) || null;
  const virou = !!(entrada && entrada.disposicao === 'gaveta' && entrada.migrada && entrada.migrada.carimbo === alvo.carimbo);
  if (entrada && entrada.disposicao === 'gaveta' && !virou) throw nada('Essa organização não é a que está valendo agora.');
  // A trava de um processo que morreu no meio é assumida (com exclusividade); a de um processo vivo, não.
  const trava = pegarTrava(r, 'desfazer', { aceitarAbandonada: true });
  let res;
  try {
    // Interrompida antes da virada: só limpa as cópias. Depois da virada (mesmo sem o fechamento), ou um desfazer
    // que ficou pela metade: desfaz inteira, continuando de onde parou.
    res = m.status === 'copiando' && !virou ? desfazerInterrompida(r, alvo) : desfazerAplicada(r, alvo, levarNovos, opcoes.aoMover, opcoes.aoGravar);
  } catch (e) {
    throw comoRecusaDePreso(r, e);
  } finally {
    trava.soltar();
  }
  if ((m.pastasCriadas || []).includes('empresas')) tirarPastasVazias(r, ['empresas']);
  return res;
}

// Processo morto entre a cópia e a virada: os originais estão no lugar e a Fábrica nunca usou as cópias. Apaga só as
// cópias que conferem com o registro (e cujo original está intacto); o resto vai para desfeito/, nunca é apagado.
function desfazerInterrompida(r, alvo) {
  const m = alvo.manifesto;
  const desfeito = path.join(alvo.dir, 'desfeito');
  let apagados = 0;
  const movidos = [];
  for (const it of m.itens) {
    const para = absDe(r, it.para);
    // Temporário de uma cópia que não terminou: é sempre desta mudança e nunca foi usado.
    try { fs.unlinkSync(temporarioDe(para)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    const st = lstatOuNada(para);
    if (!st || !st.isFile()) continue;
    const origem = absDe(r, it.de);
    const origemIntacta = fs.existsSync(origem) && hashArquivo(origem) === it.sha256Origem;
    if (origemIntacta && hashArquivo(para) === it.sha256Destino) {
      fs.unlinkSync(para);
      apagados++;
    } else {
      movidos.push(relDe(r, moverPara(para, path.join(desfeito, ...it.para.split('/')))));
    }
  }
  const tmpIndice = arqIndice(r) + '.tmp';
  if (fs.existsSync(tmpIndice)) movidos.push(relDe(r, moverPara(tmpIndice, path.join(desfeito, 'empresas', 'indice.json.tmp'))));
  tirarPastasVazias(r, (m.pastasCriadas || []).filter((p) => p !== 'empresas'));
  m.status = 'desfeita-por-erro';
  m.motivo = m.motivo || 'A organização ficou pela metade e foi desfeita depois.';
  m.desfeitaEm = new Date().toISOString();
  gravarJsonAtomico(path.join(alvo.dir, 'manifesto.json'), m);
  return { movidosParaBackup: movidos.length, apagados, levadosDeVolta: [], mantidos: [], restaurados: [], perdidos: [], trazidosDaCopia: [], incompletos: 0 };
}

// Volta ao formato antigo com os antigos ainda no lugar. Nada é apagado: as cópias (intactas, mudadas e novas) vão
// para desfeito/; o original que der lugar a uma versão nova vai para substituidos/. Ordem pensada para uma
// interrupção no meio: o registro passa a "desfazendo" antes de mexer em qualquer coisa; os lugares antigos ficam
// inteiros (antigos apagados voltam, o que foi feito depois é levado) e o índice volta ANTES de as cópias saírem da
// pasta da empresa. Assim, parado no meio, a Fábrica já usa os lugares de sempre, completos, e repetir continua.
function desfazerAplicada(r, alvo, levarNovos, aoMover, aoGravar) {
  const m = alvo.manifesto;
  const ps = pares(r);
  const prop = lerPropriedade();
  const rel = (abs) => relDe(r, abs);
  const arqManifesto = path.join(alvo.dir, 'manifesto.json');
  const desfeito = path.join(alvo.dir, 'desfeito');
  const substituidos = path.join(alvo.dir, 'substituidos');
  const itens = new Map(m.itens.map((i) => [i.para, i]));
  const ja = new Map((m.jaNoLugar || []).map((j) => [j.para, j]));
  const pre = new Set(m.preexistentes || []);
  const atuais = destinosAtuais(r, ps);
  const traduzirVolta = regrasDeTraducao(ps, r, 'volta');
  const paineis = paineisAntigos(ps);
  // Gravações de um desfazer anterior que parou no meio: o temporário que sobrou é desta mudança e sai; o arquivo final
  // que já nasceu (inteiro, conferido) é reconhecido pelo sha256 registrado, e nunca é tomado por "editado pela pessoa".
  // Antes de tirar os temporários: uma cópia que morreu pela metade (disco sem link) é reconhecida pelo temporário
  // inteiro ao lado e vai para incompletos/; o arquivo volta a faltar e é gravado de novo adiante.
  const gravacoesAntes = Array.isArray(m.gravacoes) ? m.gravacoes : [];
  let incompletos = 0;
  for (const g of gravacoesAntes) {
    if (guardarCopiaPelaMetade(absDe(r, g.final), g.sha, path.join(alvo.dir, 'incompletos', ...g.final.split('/')))) incompletos++;
    try { fs.unlinkSync(temporarioDe(absDe(r, g.final))); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  const nossos = new Set(gravacoesAntes.map((g) => `${g.final}|${g.sha}`));

  // 0) Depois da retirada: os antigos guardados em antigos/ voltam para o lugar de antes, antes de tudo. Aqui só se
  //    confere (a volta acontece depois do registro em "desfazendo"); um lugar de antes ocupado por outra coisa recusa
  //    tudo. `virtual` é o que vai estar no lugar de antes quando eles voltarem: as conferências seguintes já contam com
  //    isso, para nada ser gravado antes de uma recusa.
  const guardados = path.join(alvo.dir, 'antigos');
  const trazer = [];
  const ocupados = [];
  const virtual = new Map();
  for (const x of Array.isArray(m.retirados) ? m.retirados : []) {
    const de = absDe(r, x.de);
    const g = path.join(guardados, ...x.de.split('/'));
    const stG = lstatOuNada(g);
    // Nada guardado (nunca saiu, ou já voltou), ou guardado diferente do registro: o passo 2 cuida do lugar de antes.
    if (!stG || !stG.isFile() || hashArquivo(g) !== x.sha256) continue;
    if (obstaculoNoCaminho(r, de)) { ocupados.push(x.de); continue; }
    const st = lstatOuNada(de);
    if (st) {
      // O mesmo arquivo nos dois nomes (a volta parou no meio): já está no lugar.
      if (st.isFile()) { const h = hashArquivo(de); if (h === x.sha256 || nossos.has(`${x.de}|${h}`)) continue; }
      ocupados.push(x.de);
      continue;
    }
    trazer.push({ x, de, g });
    virtual.set(de, x.sha256);
  }
  if (ocupados.length) {
    throw erro('CONFLITO_AO_LEVAR', `${plural(ocupados.length, 'lugar de antes já tem', 'lugares de antes já têm')} outro arquivo, gravado depois que os de antes foram guardados (talvez por outra conversa). Nada foi copiado nem movido: decida qual versão fica.`, { arquivos: ocupados.sort() });
  }

  // 1) Conferência da pasta da empresa contra o registro: igual, mudou ou novo.
  const mover = [];
  const levar = [];
  const mudados = [];
  const mantidos = [...atuais.atalhos];
  for (const relA of atuais.arquivos) {
    const abs = absDe(r, relA);
    const it = itens.get(relA);
    if (it) {
      mover.push(abs);
      if (hashArquivo(abs) !== it.sha256Destino) {
        mudados.push(relA);
        levar.push({ abs, antigo: absDe(r, it.de), original: it.sha256Origem });
      }
      continue;
    }
    const j = ja.get(relA);
    if (j) {
      // Já estava na pasta da empresa antes da mudança: fica; se mudou depois, a versão nova também vai para o antigo.
      if (hashArquivo(abs) !== j.sha256) {
        mudados.push(relA);
        levar.push({ abs, antigo: absDe(r, j.de), original: j.sha256 });
      }
      mantidos.push(relA);
      continue;
    }
    if (pre.has(relA)) { mantidos.push(relA); continue; }
    mudados.push(relA);
    const p = parDe(ps, abs, 'para');
    const antigo = p ? (p.tipo === 'arquivo' ? p.de : path.join(p.de, path.relative(p.para, abs))) : null;
    const doModelo = antigo !== null && !CHAVES_DE_LINHA_DA_EMPRESA.has(p.chave) && ehDoModelo(rel(antigo), prop);
    if (antigo === null || doModelo) { mantidos.push(relA); continue; } // sem lugar no formato antigo: fica onde está
    mover.push(abs);
    levar.push({ abs, antigo, original: null });
  }
  if (mudados.length && !levarNovos) {
    const um = mudados.length === 1;
    throw erro('NOVOS_NA_PASTA_DA_EMPRESA', `Há ${plural(mudados.length, 'arquivo feito ou mudado', 'arquivos feitos ou mudados')} na pasta da empresa depois da organização. Nada foi alterado: dá para ${um ? 'levá-lo' : 'levá-los'} de volta para os lugares de sempre.`, { arquivos: mudados.sort() });
  }

  // 2) Os antigos: o que sumiu depois da mudança volta (da cópia na pasta da empresa, ou de desfeito/ se um desfazer
  //    anterior já a guardou); o que a pessoa editou no lugar antigo fica como ela deixou (nunca por cima).
  const levarPorAntigo = new Set(levar.map((x) => x.antigo));
  const restaurar = [];
  const perdidos = [];
  for (const it of m.itens) {
    const de = absDe(r, it.de);
    if (levarPorAntigo.has(de)) continue; // a versão nova vai para lá (com --levar-novos)
    if (virtual.has(de)) continue; // volta da cópia de segurança, intacto (passo 0)
    const stDe = lstatOuNada(de);
    if (stDe) {
      if (stDe.isFile()) {
        const h = hashArquivo(de);
        if (h !== it.sha256Origem && !nossos.has(`${it.de}|${h}`)) mantidos.push(it.de);
      }
      continue;
    }
    let fonte = null;
    for (const c of [absDe(r, it.para), path.join(desfeito, ...it.para.split('/'))]) {
      const st = lstatOuNada(c);
      if (st && st.isFile() && hashArquivo(c) === it.sha256Destino) { fonte = c; break; }
    }
    if (!fonte) { perdidos.push(it.de); continue; }
    let conteudo = null;
    if (it.traduzido) {
      // JSON traduzido: volta pelas referências do registro (o valor exato de antes, campo por campo).
      const valor = JSON.parse(fs.readFileSync(fonte, 'utf8').replace(/^\uFEFF/, ''));
      voltarPeloRegistro(valor, (m.referencias || []).filter((x) => x.arquivo === it.de));
      conteudo = Buffer.from(JSON.stringify(valor, null, 2) + '\n', 'utf8');
    }
    restaurar.push({ it, de, fonte, conteudo });
  }

  // 3) Com --levar-novos: confere todos os lugares antigos antes de copiar qualquer coisa.
  const conflitos = [];
  const planos = [];
  for (const x of levar) {
    if (obstaculoNoCaminho(r, x.antigo)) { conflitos.push(rel(x.antigo)); continue; }
    let conteudo = null;
    const tipo = paineis.get(x.antigo);
    if (tipo) {
      try {
        const t = traduzirPainel(tipo, fs.readFileSync(x.abs, 'utf8'), rel(x.abs), traduzirVolta);
        conteudo = Buffer.from(JSON.stringify(t.valor, null, 2) + '\n', 'utf8');
      } catch (e) {
        if (e.code !== 'JSON_INVALIDO') throw e;
        conflitos.push(rel(x.antigo));
        continue;
      }
    }
    const shaNovo = conteudo ? hashBuffer(conteudo) : hashArquivo(x.abs);
    // O lugar de antes como vai estar depois do passo 0 (o antigo guardado de volta, se for o caso).
    const hVirtual = virtual.get(x.antigo);
    const st = hVirtual ? null : lstatOuNada(x.antigo);
    let substituir = false;
    if (hVirtual || st) {
      if (st && !st.isFile()) { conflitos.push(rel(x.antigo)); continue; }
      const hAntigo = hVirtual || hashArquivo(x.antigo);
      if (hAntigo === shaNovo) continue; // o lugar antigo já tem exatamente isso
      if (x.original !== null && hAntigo === x.original) substituir = true;
      else { conflitos.push(rel(x.antigo)); continue; }
    }
    planos.push({ ...x, conteudo, shaNovo, substituir });
  }
  if (conflitos.length) {
    throw erro('CONFLITO_AO_LEVAR', `${plural(conflitos.length, 'lugar antigo já tem', 'lugares antigos já têm')} outro conteúdo, diferente do que voltaria. Nada foi copiado nem movido: decida qual versão fica.`, { arquivos: conflitos.sort() });
  }

  // 4) Daqui em diante grava: primeiro o registro, em "desfazendo" (o estado e a simulação sabem que está pela metade),
  //    com cada arquivo que vai ser gravado e o sha256 dele (quem repetir reconhece o que já nasceu).
  const gravacoes = new Map(gravacoesAntes.map((g) => [g.final, g]));
  for (const x of restaurar) gravacoes.set(x.it.de, { final: x.it.de, sha: x.conteudo ? hashBuffer(x.conteudo) : x.it.sha256Origem });
  for (const x of planos) gravacoes.set(rel(x.antigo), { final: rel(x.antigo), sha: x.shaNovo });
  // A volta dos guardados também: sem link ela passa pela gravação segura, e quem repetir precisa reconhecê-la.
  for (const v of trazer) gravacoes.set(v.x.de, { final: v.x.de, sha: v.x.sha256 });
  if (m.status !== 'desfazendo') {
    m.statusAntesDeDesfazer = m.status;
    m.status = 'desfazendo';
    m.desfazendoDesde = new Date().toISOString();
  }
  m.gravacoes = [...gravacoes.values()];
  gravarJsonAtomico(arqManifesto, m);

  // 5a) Os antigos guardados pela retirada voltam (com exclusividade: nunca por cima), e as pastas que ela tirou nascem
  //     de novo.
  for (const p of m.pastasRetiradas || []) {
    try { fs.mkdirSync(absDe(r, p), { recursive: true }); } catch { /* algo no caminho: a volta de cada arquivo diz o quê */ }
  }
  const trazidosDaCopia = [];
  const ocupado = (relA) => erro('CONFLITO_AO_LEVAR', 'Um lugar de antes ganhou outro arquivo no meio do desfazer (talvez outra conversa). Nada foi apagado: decida qual versão fica e peça para desfazer de novo.', { arquivos: [relA] });
  for (const v of trazer) {
    moverExclusivo(v.g, v.de, { sha: v.x.sha256, rel: v.x.de, conflito: ocupado, mudou: ocupado, aoGravar, aoMover });
    trazidosDaCopia.push(v.x.de);
  }

  // 5) Os antigos que sumiram voltam, com a data de antes.
  const restaurados = [];
  for (const x of restaurar) {
    gravarSeguro(x.de, { fonte: x.fonte, conteudo: x.conteudo, sha: gravacoes.get(x.it.de).sha, mtimeMs: x.it.mtimeMs, aoGravar });
    restaurados.push(x.it.de);
  }

  // 6) Leva de volta o que foi feito depois (o original de antes, se houver, vai para substituidos/).
  const levados = [];
  for (const x of planos) {
    if (x.substituir) moverPara(x.antigo, path.join(substituidos, ...rel(x.antigo).split('/')));
    gravarSeguro(x.antigo, { fonte: x.abs, conteudo: x.conteudo, sha: x.shaNovo, mtimeMs: fs.statSync(x.abs).mtimeMs, aoGravar });
    levados.push(rel(x.antigo));
  }

  // 7) Índice: a principal volta à pasta antiga, as outras empresas ficam (só se ainda está na pasta da empresa).
  let movidos = 0;
  const arq = arqIndice(r);
  const agora = empresa.listar(r).find((e) => e.codigo === LEGADO);
  if (fs.existsSync(arq) && agora && agora.disposicao === 'gaveta') {
    const igualAoDaVirada = !!(m.indiceDepois && hashArquivo(arq) === m.indiceDepois.sha256);
    const controle = path.join(alvo.dir, 'controle', 'indice.json');
    if (igualAoDaVirada && m.indiceAntes && m.indiceAntes.existia && fs.existsSync(controle) && hashArquivo(controle) === m.indiceAntes.sha256) {
      // Ninguém mexeu no índice depois da mudança: volta byte a byte (temporário e troca de nome).
      fs.copyFileSync(controle, arq + '.tmp');
      fs.renameSync(arq + '.tmp', arq);
    } else if (igualAoDaVirada && m.indiceAntes && !m.indiceAntes.existia) {
      // O índice nasceu com a mudança: vai para a cópia de segurança, e a pasta volta a ter a empresa só pelos arquivos.
      moverPara(arq, path.join(desfeito, 'empresas', 'indice.json'));
      movidos++;
    } else {
      const indice = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^\uFEFF/, ''));
      indice.empresas = indice.empresas.map((e) => (e.codigo !== LEGADO ? e : Object.fromEntries(
        Object.entries(e).filter(([k]) => k !== 'migrada').map(([k, v]) => [k, k === 'disposicao' ? 'legado' : v]),
      )));
      const so = indice.empresas.length === 1 && indice.empresas[0].codigo === LEGADO && Object.keys(indice).length === 1;
      if (m.indiceAntes && !m.indiceAntes.existia && so) {
        moverPara(arq, path.join(desfeito, 'empresas', 'indice.json'));
        movidos++;
      } else {
        gravarJsonAtomico(arq, indice);
      }
    }
  }

  // 8) As cópias da pasta da empresa vão para desfeito/ (nunca apagadas), e o relatório, com uma linha a mais, também.
  for (const abs of mover) {
    if (!fs.existsSync(abs)) continue;
    if (aoMover) aoMover(rel(abs));
    moverPara(abs, path.join(desfeito, ...rel(abs).split('/')));
    movidos++;
  }
  if (m.relatorio && fs.existsSync(absDe(r, m.relatorio))) {
    fs.appendFileSync(absDe(r, m.relatorio), `\nDesfeita em ${dataLegivel(new Date())}: a pasta voltou a ser como era antes.\n`, 'utf8');
    moverPara(absDe(r, m.relatorio), path.join(desfeito, ...m.relatorio.split('/')));
    movidos++;
  }
  // A página do relatório vai junto, marcada como desfeita (só se continua como a Fábrica a gravou; a editada vai como
  // está). Ela fica na cópia de segurança, e a conversa pode abri-la de lá.
  let relatorioPagina = null;
  const relPagina = m.relatorio ? m.relatorio.replace(/\.md$/, '.html') : (m.pagina ? m.pagina.arquivo : null);
  if (relPagina && fs.existsSync(absDe(r, relPagina))) {
    marcarPagina(r, m, 'desfeita', new Date());
    relatorioPagina = rel(moverPara(absDe(r, relPagina), path.join(desfeito, ...relPagina.split('/'))));
    movidos++;
  }

  // 9) Pastas que ficaram vazias: as criadas pela mudança e as criadas depois dela nos lugares de destino.
  const antes = new Set(m.pastasAntes || []);
  tirarPastasVazias(r, [...new Set([...(m.pastasCriadas || []).filter((p) => p !== 'empresas'), ...atuais.pastas])].filter((p) => !antes.has(p)));

  // 10) Fechamento.
  const resultado = { movidosParaBackup: movidos, levadosDeVolta: levados, mantidos: [...new Set(mantidos)].sort(), restaurados, perdidos, trazidosDaCopia, incompletos, relatorioPagina };
  m.status = 'desfeita';
  m.desfeitaEm = new Date().toISOString();
  m.desfazer = resultado;
  gravarJsonAtomico(arqManifesto, m);
  return resultado;
}

// ---------- retirar os antigos (opcional, em outro pedido) ----------
// Depois da mudança, os arquivos de antes continuam onde estavam: são a cópia de segurança. Retirar é guardá-los em
// _fabrica/_backup/migracao-<carimbo>/antigos/<caminho de antes>, conferindo cada um. Nada é apagado, e o desfazer
// (a qualquer momento) traz tudo de volta.

// Move um arquivo sem nunca gravar por cima. O nome novo nasce por link (falha se já existe), o conteúdo é conferido
// e só então o nome antigo sai; o arquivo é o mesmo (data e modo iguais). Sem link (outro disco, ou um disco sem link):
// cópia pela gravação segura, conferida, e só então o de origem sai. Morte no meio deixa os dois nomes, com o mesmo
// conteúdo, ou só o novo: quem repetir reconhece e termina. `conflito(rel)` e `mudou(rel)` montam as recusas de quem
// chama. Devolve 'movido' ou 'ja-estava'.
function moverExclusivo(de, para, { sha, rel, conflito, mudou, aoGravar, aoMover }) {
  const stPara = lstatOuNada(para);
  const stDe = lstatOuNada(de);
  if (stPara) {
    // Já nasceu numa vez anterior: confere e termina (tira o nome antigo, se ainda está lá com o mesmo conteúdo).
    if (!stPara.isFile() || hashArquivo(para) !== sha) throw conflito(rel);
    if (!stDe) return 'ja-estava';
    if (!stDe.isFile() || hashArquivo(de) !== sha) throw mudou(rel);
    if (aoMover) aoMover(rel);
    fs.unlinkSync(de);
    if (aoGravar) aoGravar('movido', para);
    return 'movido';
  }
  if (!stDe || !stDe.isFile()) throw mudou(rel);
  if (aoMover) aoMover(rel);
  fs.mkdirSync(path.dirname(para), { recursive: true });
  let ligou = false;
  try {
    fs.linkSync(de, para);
    ligou = true;
  } catch (e) {
    if (e.code === 'EEXIST') throw conflito(rel);
  }
  if (ligou) {
    // O mesmo arquivo com dois nomes: se o conteúdo não é o conferido, alguém mexeu agora; o nome novo sai (o arquivo
    // continua inteiro no lugar de antes).
    if (hashArquivo(para) !== sha) { fs.unlinkSync(para); throw mudou(rel); }
    if (aoGravar) aoGravar('ligado', para);
  } else {
    gravarSeguro(para, { fonte: de, sha, mtimeMs: stDe.mtimeMs, aoGravar });
    // Mudou durante a cópia: a cópia (do conteúdo de antes) vai para um nome ao lado, e o de origem fica como está.
    if (hashArquivo(de) !== sha) { moverPara(para, `${para}.anterior`); throw mudou(rel); }
  }
  fs.unlinkSync(de);
  if (aoGravar) aoGravar('movido', para);
  return 'movido';
}

// A mudança que a retirada usaria, sem gravar nada. Recusa com NAO_HA_O_QUE_RETIRAR se a pasta não está organizada,
// ou se os antigos já foram guardados; uma retirada que ficou pela metade continua.
function alvoDaRetirada(r, carimbo, { dentroDaTrava = false } = {}) {
  if (!dentroDaTrava && situacaoDaTrava(r) === 'viva') {
    throw erro('MIGRACAO_EM_ANDAMENTO', 'Uma organização da pasta está em andamento ou ficou pela metade. Nada foi alterado.', { arquivos: ['empresas/.migracao.lock'] });
  }
  const naoHa = (motivo) => erro('NAO_HA_O_QUE_RETIRAR', `${motivo} Nada foi alterado.`);
  const todas = mudancas(r, { soIniciadas: true });
  if (carimbo && !todas.some((m) => m.carimbo === carimbo)) {
    if (mudancas(r).some((m) => m.carimbo === carimbo)) throw naoHa('Essa organização nunca começou.');
    throw erro('CARIMBO_DESCONHECIDO', `A organização "${carimbo}" não existe nesta pasta. Nada foi alterado.`);
  }
  const alvo = carimbo ? todas.find((m) => m.carimbo === carimbo) : todas[todas.length - 1];
  if (!alvo) throw naoHa('Esta pasta ainda não foi organizada: os arquivos de antes são os que a Fábrica usa.');
  if (!alvo.manifesto) throw erro('REGISTRO_ILEGIVEL', 'O registro dessa organização não pôde ser lido. Nada foi alterado.');
  const st = alvo.manifesto.status;
  const entrada = empresa.listar(r).find((e) => e.codigo === LEGADO) || null;
  const vale = !!(entrada && entrada.disposicao === 'gaveta' && entrada.migrada && entrada.migrada.carimbo === alvo.carimbo);
  if (st === 'retirada') throw naoHa('Os arquivos de antes já estão guardados na cópia de segurança.');
  if (!vale || !['aplicada', 'retirando'].includes(st)) {
    throw naoHa(PELA_METADE.has(st)
      ? 'A organização da pasta (ou o desfazer dela) ficou pela metade; resolva isso antes.'
      : 'A pasta não está organizada agora: os arquivos de antes são os que a Fábrica usa.');
  }
  return alvo;
}

// O que vai ser guardado e o que impede, sem gravar nada (tudo ou nada). Cada antigo precisa estar como na mudança
// (o mesmo sha256), ou já guardado, inteiro, numa retirada que ficou pela metade; a cópia da pasta da empresa precisa
// existir (ela pode ter mudado: é a que a Fábrica usa); e nada novo pode ter aparecido nos lugares de antes.
function planoDaRetirada(r, alvo) {
  const m = alvo.manifesto;
  const ps = pares(r);
  const prop = lerPropriedade();
  const rel = (abs) => relDe(r, abs);
  const guardados = path.join(alvo.dir, 'antigos');
  // A lista fica no registro quando a retirada começa: quem continuar usa a mesma. Antes disso, sai dos itens e dos que
  // já estavam na pasta da empresa (estes também têm o antigo nos lugares de antes).
  const lista = Array.isArray(m.retirados) ? m.retirados : [
    ...m.itens.map((i) => ({ de: i.de, para: i.para, sha256: i.sha256Origem })),
    ...(m.jaNoLugar || []).filter((j) => typeof j.sha256Origem === 'string').map((j) => ({ de: j.de, para: j.para, sha256: j.sha256Origem })),
  ];
  const mudaram = [];
  const sumiram = [];
  const semCopia = [];
  let bytes = 0;
  for (const x of lista) {
    const de = absDe(r, x.de);
    const g = path.join(guardados, ...x.de.split('/'));
    const obstaculo = obstaculoNoCaminho(r, de);
    const st = obstaculo ? null : lstatOuNada(de);
    const stG = lstatOuNada(g);
    if (obstaculo) mudaram.push(x.de);
    else if (st) {
      if (!st.isFile() || hashArquivo(de) !== x.sha256) mudaram.push(x.de);
      else if (stG && (!stG.isFile() || hashArquivo(g) !== x.sha256)) mudaram.push(x.de);
      else bytes += st.size;
    } else if (stG && stG.isFile() && hashArquivo(g) === x.sha256) bytes += stG.size;
    else sumiram.push(x.de);
    const stP = lstatOuNada(absDe(r, x.para));
    if (!stP || !stP.isFile()) semCopia.push(x.para);
  }
  const conhecidos = new Set([...lista.map((x) => x.de), ...m.itens.map((i) => i.de), ...(m.jaNoLugar || []).map((j) => j.de)]);
  const v = varrerOrigens(r, ps, prop);
  const novos = v.candidatos.map((c) => rel(c.abs)).filter((k) => !conhecidos.has(k));
  const recusas = [];
  if (v.juncoes.length) {
    recusas.push({ code: 'JUNCAO_NA_RAIZ', mensagem: `${plural(v.juncoes.length, 'lugar de antes virou atalho', 'lugares de antes viraram atalhos')} para outro lugar depois da organização. Nada foi movido: troque o atalho pela pasta de verdade antes.`, arquivos: v.juncoes });
  }
  const problemas = [...mudaram, ...sumiram, ...novos];
  if (problemas.length) {
    recusas.push({
      code: 'ANTIGOS_MUDARAM',
      mensagem: `${plural(problemas.length, 'arquivo de antes mudou, sumiu ou apareceu', 'arquivos de antes mudaram, sumiram ou apareceram')} depois da organização (talvez outra conversa ou um painel aberto ainda use os lugares de antes). Nada foi movido: confira esses arquivos e peça de novo.`,
      arquivos: [...new Set(problemas)].sort(), mudaram: mudaram.sort(), sumiram: sumiram.sort(), novos: novos.sort(),
    });
  }
  if (semCopia.length) {
    recusas.push({ code: 'COPIA_AUSENTE', mensagem: `${plural(semCopia.length, 'arquivo não existe mais', 'arquivos não existem mais')} na pasta da empresa; guardar os de antes deixaria a Fábrica sem eles. Nada foi movido.`, arquivos: semCopia.sort() });
  }
  return { lista, recusas, bytes, ps, prop, guardados };
}

// O que a retirada faria (só lê): para mostrar antes de a pessoa confirmar.
function previaDaRetirada(r = empresa.raiz(), carimbo) {
  const alvo = alvoDaRetirada(r, carimbo);
  const p = planoDaRetirada(r, alvo);
  return { carimbo: alvo.carimbo, arquivos: p.lista.length, bytes: p.bytes, recusas: p.recusas };
}

// As pastas que ficaram vazias saem, subindo a partir de cada arquivo guardado, da mais funda para a mais rasa. Nunca
// sai a raiz de um lugar da empresa (a pasta das peças aprovadas, a das saídas de uma linha...), a pasta de uma linha,
// nem uma pasta do modelo (que tem, ou pode ganhar numa atualização, arquivos do modelo). Devolve as que saíram.
function tirarPastasDaRetirada(r, ps, prop, lista) {
  const rel = (abs) => relDe(r, abs);
  const paradas = new Set([r]);
  for (const p of ps.lista) paradas.add(p.tipo === 'arquivo' ? path.dirname(p.de) : p.de);
  const doModelo = (relP) => prop.modelo.some((m) => m === relP + '/' || m.startsWith(relP + '/'));
  const candidatas = new Set();
  for (const x of lista) {
    for (let d = path.dirname(absDe(r, x.de)); d.startsWith(r + path.sep) && !paradas.has(d) && !doModelo(rel(d)); d = path.dirname(d)) candidatas.add(d);
  }
  const saiu = [];
  for (const d of [...candidatas].sort((a, b) => b.length - a.length)) {
    try { fs.rmdirSync(d); saiu.push(rel(d)); } catch { /* tem algo dentro (ou já saiu): fica */ }
  }
  return saiu.sort();
}

function retirar(r = empresa.raiz(), carimbo, opcoes = {}) {
  if (opcoes.confirmar !== true) throw erro('USO', 'Para guardar os arquivos de antes na cópia de segurança, confirme: retirar --confirmar.');
  alvoDaRetirada(r, carimbo); // recusa sem gravar nada (nem a trava)
  const trava = pegarTrava(r, 'retirar', { aceitarAbandonada: true });
  try {
    // De novo, já com a trava: outro pedido pode ter mudado o registro no meio.
    const alvo = alvoDaRetirada(r, carimbo, { dentroDaTrava: true });
    const m = alvo.manifesto;
    const arqManifesto = path.join(alvo.dir, 'manifesto.json');
    // Uma retirada que morreu no meio da cópia para a cópia de segurança (disco sem link): o guardado pela metade vai
    // para incompletos/ (nunca é apagado) e é guardado de novo adiante.
    let incompletos = 0;
    for (const x of Array.isArray(m.retirados) ? m.retirados : []) {
      const g = path.join(alvo.dir, 'antigos', ...x.de.split('/'));
      if (guardarCopiaPelaMetade(g, x.sha256, path.join(alvo.dir, 'incompletos', path.relative(alvo.dir, g)))) incompletos++;
      // o temporário que sobrou é sempre desta retirada (a guarda refeita pode nem passar por ele, se houver link)
      try { fs.unlinkSync(temporarioDe(g)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    }
    const plano = planoDaRetirada(r, alvo);
    if (plano.recusas.length) {
      const continua = m.status === 'retirando' ? ' O que já tinha sido guardado continua na cópia de segurança, e dá para desfazer a organização.' : '';
      throw erro(plano.recusas[0].code, plano.recusas.map((x) => x.mensagem).join(' ') + continua, { recusas: plano.recusas, arquivos: plano.recusas.flatMap((x) => x.arquivos || []) });
    }
    // O registro passa a "retirando", com a lista, antes de mover qualquer coisa (o estado sabe que está pela metade).
    if (m.status !== 'retirando') {
      m.statusAntesDeRetirar = m.status;
      m.status = 'retirando';
      m.retiradaDesde = new Date().toISOString();
      m.retirados = plano.lista;
      gravarJsonAtomico(arqManifesto, m);
    }
    const mudou = (rel) => erro('ANTIGOS_MUDARAM', 'Um arquivo de antes mudou enquanto era guardado (talvez outra conversa ou um painel aberto). Nada foi apagado: o que já foi guardado continua na cópia de segurança. Confira e peça de novo, ou desfaça a organização.', { arquivos: [rel] });
    const conflito = (rel) => erro('ANTIGOS_MUDARAM', 'A cópia de segurança de um arquivo de antes já existe com outro conteúdo. Nada foi apagado; avise quem mantém a Fábrica.', { arquivos: [rel] });
    for (const x of m.retirados) {
      moverExclusivo(absDe(r, x.de), path.join(plano.guardados, ...x.de.split('/')), { sha: x.sha256, rel: x.de, conflito, mudou, aoGravar: opcoes.aoGravar, aoMover: opcoes.aoMover });
    }
    const vazias = tirarPastasDaRetirada(r, plano.ps, plano.prop, m.retirados);
    m.pastasRetiradas = [...new Set([...(m.pastasRetiradas || []), ...vazias])].sort();
    const quando = new Date();
    if (m.relatorio) {
      try {
        const arq = absDe(r, m.relatorio);
        if (!fs.readFileSync(arq, 'utf8').includes('\nGuardados na cópia de segurança em ')) {
          fs.appendFileSync(arq, `\nGuardados na cópia de segurança em ${dataLegivel(quando)}: os arquivos de antes saíram dos lugares de sempre. A Fábrica usa a pasta da empresa, e desfazer a organização traz tudo de volta.\n`, 'utf8');
        }
      } catch { /* sem relatório (apagado pela pessoa): a retirada vale assim mesmo */ }
    }
    marcarPagina(r, m, 'retirada', quando);
    m.status = 'retirada';
    m.retiradaEm = quando.toISOString();
    gravarJsonAtomico(arqManifesto, m);
    return { carimbo: alvo.carimbo, movidos: m.retirados.length, bytes: plano.bytes, pastasVazias: m.pastasRetiradas, incompletos };
  } catch (e) {
    throw comoRecusaDePreso(r, e, 'retirar');
  } finally {
    trava.soltar();
  }
}

// ---------- texto ao usuário ----------
function tamanho(b) {
  if (b < 1024) return `${b} bytes`;
  const un = ['KB', 'MB', 'GB', 'TB'];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < un.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0).replace('.', ',')} ${un[i]}`;
}
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
// Tamanho só quando faz diferença para quem lê (1 MB ou mais); abaixo disso, nada.
const tamanhoQueImporta = (b) => (b >= MEGA ? tamanho(b) : null);
const contaDe = (n, b) => [plural(n, 'arquivo', 'arquivos'), tamanhoQueImporta(b)].filter(Boolean).join(', ');
const totalDe = (b) => (b >= MEGA ? tamanho(b) : 'menos de 1 MB');

// Os itens agrupados com o rótulo ao usuário, na ordem dos GRUPOS (e das linhas, por código). `linhas` dá o nome de
// cada linha (o do inventário); sem ele, vale o código.
function porGrupo(itens, linhas = {}) {
  const mapa = new Map();
  for (const i of itens) {
    const k = `${i.grupo}|${i.linha || ''}`;
    const g = mapa.get(k) || { rotulo: rotulo(i.grupo, i.linha ? linhas[i.linha] || i.linha : ''), grupo: i.grupo, n: 0, bytes: 0, ordem: Object.keys(GRUPOS).indexOf(i.grupo), linha: i.linha || '' };
    g.n++;
    g.bytes += i.bytes;
    mapa.set(k, g);
  }
  return [...mapa.values()].sort((a, b) => a.ordem - b.ordem || (a.linha < b.linha ? -1 : a.linha > b.linha ? 1 : 0));
}

// Os conjuntos (marca, perfil, laboratório, cronograma, peças aprovadas e uma linha por vez), cada um com as partes.
function conjuntosDe(itens, linhas = {}) {
  const grupos = porGrupo(itens, linhas);
  const saida = [];
  for (const c of CONJUNTOS) {
    const partes = grupos.filter((g) => c.grupos.includes(g.grupo));
    if (partes.length) saida.push({ chave: c.chave, rotulo: c.rotulo, partes });
  }
  for (const l of [...new Set(grupos.filter((g) => g.linha).map((g) => g.linha))]) {
    saida.push({ chave: `linha-${l}`, rotulo: `Linha ${linhas[l] || l}`, linha: l, partes: grupos.filter((g) => g.linha === l) });
  }
  return saida.map((c) => {
    const n = c.partes.reduce((s, p) => s + p.n, 0);
    const bytes = c.partes.reduce((s, p) => s + p.bytes, 0);
    return {
      ...c, arquivos: n, bytes, conta: contaDe(n, bytes),
      partes: c.partes.map((p) => ({ rotulo: p.rotulo, grupo: p.grupo, linha: p.linha, arquivos: p.n, bytes: p.bytes, conta: contaDe(p.n, p.bytes) })),
    };
  });
}

// Os dados das duas páginas (prévia e relatório), só com números e textos já prontos para mostrar. `feito`: o relatório
// (depois de organizar) fala no passado, como o relatório em texto.
function dadosDaPagina(inv, { feito = false } = {}) {
  const semLugar = inv.ficam.filter((f) => f.motivo === 'sem-lugar').length;
  const atalhos = inv.ficam.filter((f) => f.motivo === 'atalho').length;
  return {
    nome: inv.nome || 'Sua empresa',
    conjuntos: conjuntosDe(inv.itens, inv.linhas),
    total: { arquivos: inv.itens.length, bytes: inv.bytes, tamanho: totalDe(inv.bytes) },
    semLugar,
    atalhos,
    textoSemLugar: `${plural(semLugar, 'arquivo sem lugar definido na pasta da empresa', 'arquivos sem lugar definido na pasta da empresa')}.`,
    textoAtalhos: `${plural(atalhos, 'atalho', 'atalhos')} para outra pasta (não são seguidos; o que está do outro lado não é copiado).`,
    textoDoModelo: `${plural(inv.doModelo, 'arquivo do modelo e das receitas das linhas, que nunca é mexido', 'arquivos do modelo e das receitas das linhas, que nunca são mexidos')}.`,
    jaNoLugar: inv.jaNoLugar.length ? `${feito ? 'Já estavam' : 'Já estão'} na pasta da empresa, iguais: ${plural(inv.jaNoLugar.length, 'arquivo', 'arquivos')}.` : null,
    enderecos: !inv.referencias.length ? null : feito
      ? `Nos painéis, ${plural(inv.referencias.length, 'endereço de peça ou post foi atualizado', 'endereços de peças e posts foram atualizados')} na cópia; os dados de antes continuam como estavam.`
      : `Nos painéis, ${plural(inv.referencias.length, 'endereço de peça ou post é atualizado', 'endereços de peças e posts são atualizados')} na cópia; os dados de antes ficam como estavam.`,
    avisos: avisosEmOrdem(inv.avisos).map((a) => a.mensagem),
    recusas: inv.recusas.map((x) => x.mensagem),
  };
}

// Os avisos com o mais importante primeiro (trabalho parado: a pessoa precisa abrir uma conversa nova).
const PRIORIDADE_DO_AVISO = ['run-parado', 'trava-abandonada'];
const avisosEmOrdem = (avisos) => [...avisos].sort((a, b) => {
  const pa = PRIORIDADE_DO_AVISO.indexOf(a.tipo);
  const pb = PRIORIDADE_DO_AVISO.indexOf(b.tipo);
  return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
});

// O resumo curto da prévia, para a conversa (até cinco linhas): o detalhe fica na página.
function resumoCurto(inv) {
  if (inv.situacao !== 'pasta-antiga') return [resumoSimulacao(inv)];
  const l = [];
  if (!inv.itens.length) l.push('Nada a mudar de lugar: a pasta da empresa já tem tudo.');
  else {
    l.push(`Vão para a pasta própria da empresa "${inv.nome || 'Sua empresa'}": ${plural(inv.itens.length, 'arquivo', 'arquivos')} (${totalDe(inv.bytes)}).`);
    const cs = conjuntosDe(inv.itens, inv.linhas);
    const fixos = cs.filter((c) => !c.linha).map((c) => c.rotulo);
    const ls = cs.filter((c) => c.linha).map((c) => c.rotulo.replace(/^Linha /, ''));
    const partes = [...fixos];
    if (ls.length) partes.push(`${ls.length === 1 ? 'a linha' : 'as linhas'} ${juntar(ls)}`);
    l.push(`${juntar(partes)}.`);
  }
  if (inv.recusas.length) {
    l.push(`Ainda não dá para organizar agora: ${inv.recusas.map((x) => x.mensagem).join(' ')}`);
  } else {
    l.push('Nada é apagado: os de antes ficam onde estão, como cópia de segurança.');
  }
  const semLugar = inv.ficam.filter((f) => f.motivo === 'sem-lugar').length;
  const atalhos = inv.ficam.filter((f) => f.motivo === 'atalho').length;
  const ficamPartes = [];
  if (semLugar) ficamPartes.push(plural(semLugar, 'arquivo sem lugar definido', 'arquivos sem lugar definido'));
  if (atalhos) ficamPartes.push(plural(atalhos, 'atalho para outra pasta', 'atalhos para outra pasta'));
  ficamPartes.push('os arquivos do modelo');
  l.push(`Continuam no mesmo lugar: ${juntar(ficamPartes)}.`);
  const avisos = avisosEmOrdem(inv.avisos);
  if (avisos.length) {
    const resto = avisos.length - 1;
    l.push(`Aviso: ${avisos[0].mensagem}${resto ? ` (e mais ${plural(resto, 'aviso', 'avisos')} na página)` : ''}`);
  }
  return l.slice(0, 5);
}

function dataLegivel(d) {
  const dois = (v) => String(v).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}, ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

// Marca a página do relatório depois de guardar os de antes ('retirada') ou de desfazer ('desfeita'). Só regrava se ela
// continua exatamente como a Fábrica a gravou (o sha256 do registro): a página editada por alguém fica como está. É uma
// página feita pela Fábrica a partir do registro, nunca dado da empresa; temporário na mesma pasta e troca de nome.
// Atualiza o registro em memória (quem chama grava). Devolve true se regravou; erro nunca impede o resto.
function marcarPagina(r, m, situacao, quando) {
  if (!m.pagina || !m.pagina.dados || !m.pagina.arquivo) return false;
  const arq = absDe(r, m.pagina.arquivo);
  try {
    const st = lstatOuNada(arq);
    if (!st || !st.isFile() || hashArquivo(arq) !== m.pagina.sha256) return false;
    const conteudo = Buffer.from(require('./migrar-pagina').paginaRelatorio(m.pagina.dados, { situacao, quando: dataLegivel(quando) }), 'utf8');
    const tmp = temporarioDe(arq);
    try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    fs.writeFileSync(tmp, conteudo, { flag: 'wx' });
    fs.renameSync(tmp, arq);
    m.pagina.sha256 = hashBuffer(conteudo);
    m.pagina.situacao = situacao;
    return true;
  } catch {
    return false;
  }
}

// O relatório em português simples, na pasta da empresa (historico/). Sem nome de arquivo e sem termo técnico.
function textoRelatorio(inv, carimbo, quando) {
  const l = ['# Organização da pasta da empresa', ''];
  l.push(`Feita em ${dataLegivel(quando)}, para "${inv.nome || 'Sua empresa'}".`, '');
  l.push('As coisas da empresa agora ficam numa pasta só dela. Os arquivos de antes continuam onde estavam, intactos, como cópia de segurança.', '');
  l.push('## O que mudou de lugar', '');
  for (const g of porGrupo(inv.itens, inv.linhas)) l.push(`### ${g.rotulo}`, '', `${contaDe(g.n, g.bytes)}.`, '');
  if (inv.jaNoLugar.length) l.push(`Já estavam na pasta da empresa, iguais: ${plural(inv.jaNoLugar.length, 'arquivo', 'arquivos')}.`, '');
  if (inv.referencias.length) l.push(`Nos painéis, ${plural(inv.referencias.length, 'endereço de peça ou post foi atualizado', 'endereços de peças e posts foram atualizados')} na cópia; os dados de antes continuam como estavam.`, '');
  l.push('## Continua no mesmo lugar', '');
  const semLugar = inv.ficam.filter((f) => f.motivo === 'sem-lugar').length;
  const atalhos = inv.ficam.filter((f) => f.motivo === 'atalho').length;
  if (semLugar) l.push(`- ${plural(semLugar, 'arquivo', 'arquivos')} sem lugar definido na pasta da empresa.`);
  if (atalhos) l.push(`- ${plural(atalhos, 'atalho', 'atalhos')} para outra pasta (não são seguidos; o que está do outro lado não foi copiado).`);
  l.push(`- ${plural(inv.doModelo, 'arquivo do modelo e das receitas das linhas, que nunca é mexido', 'arquivos do modelo e das receitas das linhas, que nunca são mexidos')}.`, '');
  if (inv.avisos.length) {
    l.push('## Avisos', '');
    for (const a of inv.avisos) l.push(`- ${a.mensagem}`);
    l.push('');
  }
  l.push('## Como desfazer', '', FRASE_DESFAZER, '');
  l.push('Abra uma conversa nova para continuar: os lugares guardados na conversa em que a pasta foi organizada eram os de antes.', '');
  l.push(`Código desta organização: ${carimbo}.`, '');
  return l.join('\n');
}

function resumoSimulacao(inv) {
  const l = [];
  if (inv.situacao === 'nada-a-mudar' && !inv.recusas.length) return 'Nada a mudar: esta pasta não tem empresa no formato antigo.';
  if (inv.situacao === 'ja-organizada') return 'Nada a mudar: as coisas da empresa já estão na pasta própria dela.';
  if (inv.situacao === 'pasta-antiga') {
    l.push(`Organizar as coisas de "${inv.nome || 'Sua empresa'}" numa pasta só da empresa: simulação (nada foi alterado).`, '');
    if (!inv.itens.length) l.push('Nada a mudar de lugar: a pasta da empresa já tem tudo.');
    else {
      l.push('Vai para a pasta da empresa (os originais continuam onde estão, como cópia de segurança):');
      for (const g of porGrupo(inv.itens, inv.linhas)) l.push(`  ${g.rotulo}: ${contaDe(g.n, g.bytes)}`);
      l.push(`  Total: ${plural(inv.itens.length, 'arquivo', 'arquivos')}, ${totalDe(inv.bytes)}`);
    }
    if (inv.jaNoLugar.length) l.push(`Já estão na pasta da empresa, iguais: ${plural(inv.jaNoLugar.length, 'arquivo', 'arquivos')}.`);
    const semLugar = inv.ficam.filter((f) => f.motivo === 'sem-lugar').length;
    const atalhos = inv.ficam.filter((f) => f.motivo === 'atalho').length;
    if (semLugar || atalhos) {
      const partes = [];
      if (semLugar) partes.push(`${plural(semLugar, 'arquivo', 'arquivos')} sem lugar definido`);
      if (atalhos) partes.push(`${plural(atalhos, 'atalho', 'atalhos')} para outra pasta (não são seguidos)`);
      l.push(`Continuam no mesmo lugar: ${partes.join('; ')}.`);
    }
    if (inv.doModelo) l.push(`Arquivos do modelo e receitas das linhas, que nunca são mexidos: ${inv.doModelo}.`);
    if (inv.referencias.length) l.push(`Endereços de peças e posts dos painéis atualizados na cópia: ${inv.referencias.length}.`);
  }
  if (inv.avisos.length) {
    l.push('', 'Avisos:');
    for (const a of inv.avisos) l.push(`  - ${a.mensagem}`);
  }
  if (inv.recusas.length) {
    l.push('', 'Não dá para fazer agora:');
    for (const x of inv.recusas) l.push(`  - ${x.mensagem}`);
  }
  if (inv.situacao === 'pasta-antiga') {
    l.push('', `Código desta simulação: ${inv.codigoSimulacao}`);
    if (!inv.recusas.length) l.push('Para organizar, diga que sim na conversa: a Fábrica faz exatamente o que esta simulação mostrou.');
  }
  return l.join('\n');
}

// ---------- linha de comando ----------
// Recusas conhecidas (saída 1). Qualquer outro erro sai 2, como "inesperado", sem a pilha.
const RECUSAS = new Set([
  'JSON_INVALIDO', 'EMPRESA_NAO_ESCOLHIDA', 'EMPRESA_DESCONHECIDA', 'CODIGO_INVALIDO', 'LINHA_INVALIDA',
  'PROPRIEDADE_INVALIDA', 'CHAVE_SEM_CLASSIFICACAO', 'CONFLITO_NO_DESTINO', 'RUN_EM_ANDAMENTO', 'MIGRACAO_EM_ANDAMENTO',
  'ESPACO_INSUFICIENTE', 'INDICE_INVALIDO', 'ARQUIVO_ILEGIVEL', 'CODIGO_NAO_E_PASTA_ANTIGA', 'SIMULACAO_DESATUALIZADA',
  'COPIA_DIFERENTE', 'ORIGEM_MUDOU', 'FALHA_NA_COPIA', 'NOVOS_NA_PASTA_DA_EMPRESA', 'CONFLITO_AO_LEVAR', 'CARIMBO_DESCONHECIDO',
  'NADA_A_DESFAZER', 'REGISTRO_ILEGIVEL', 'JUNCAO_NA_RAIZ', 'ARQUIVO_PRESO', 'NAO_HA_O_QUE_RETIRAR', 'ANTIGOS_MUDARAM',
  'COPIA_AUSENTE',
]);
const USO = [
  'Uso:',
  '  node _fabrica/core/migrar.js simular [principal] [--json] [--run-parado-confirmado <linha>]',
  '      mostra o que vai da pasta antiga para a pasta da empresa, sem gravar nada',
  '  node _fabrica/core/migrar.js previa [--pasta <pasta temporária fora da Fábrica>] [--run-parado-confirmado <linha>]',
  '      a mesma simulação, em JSON para o agente: o resumo curto e a página com tudo, gravada fora da Fábrica',
  '  node _fabrica/core/migrar.js aplicar --confirmar <codigo da simulação> [--run-parado-confirmado <linha>] [--json]',
  '      faz a mudança que a simulação mostrou (os arquivos antigos continuam onde estão)',
  '  node _fabrica/core/migrar.js estado [--json]',
  '      mostra em que pé está a organização da pasta',
  '  node _fabrica/core/migrar.js retirar [<carimbo>] --simular [--json]',
  '      mostra quantos arquivos de antes iriam para a cópia de segurança, sem gravar nada',
  '  node _fabrica/core/migrar.js retirar [<carimbo>] --confirmar [--json]',
  '      guarda os arquivos de antes na cópia de segurança (nada é apagado; o desfazer os traz de volta)',
  '  node _fabrica/core/migrar.js desfazer [<carimbo>] [--levar-novos] --confirmar [--json]',
  '      volta ao formato antigo (antes ou depois de retirar); --levar-novos leva de volta o que foi feito depois',
].join('\n');

// Lê as opções; devolve { posicionais, json, runParadoConfirmado, confirmar } ou { uso: <mensagem> }.
function lerOpcoes(resto, aceitas) {
  const o = { posicionais: [], json: false, runParadoConfirmado: [], confirmar: undefined, levarNovos: false, simular: false };
  const valor = (i) => (i + 1 >= resto.length || resto[i + 1].startsWith('--') ? null : resto[i + 1]);
  for (let i = 0; i < resto.length; i++) {
    const a = resto[i];
    if (a === '--json' && aceitas.includes('json')) o.json = true;
    else if (a === '--run-parado-confirmado' && aceitas.includes('run')) {
      if (valor(i) === null) return { uso: 'Faltou o nome da linha depois de --run-parado-confirmado.' };
      o.runParadoConfirmado.push(resto[++i]);
    } else if (a === '--confirmar' && aceitas.includes('confirmar-codigo')) {
      if (valor(i) === null) return { uso: 'Faltou o código da simulação depois de --confirmar. Simule antes: node _fabrica/core/migrar.js simular' };
      o.confirmar = resto[++i];
    } else if (a === '--confirmar' && aceitas.includes('confirmar')) o.confirmar = true;
    else if (a === '--levar-novos' && aceitas.includes('levar')) o.levarNovos = true;
    else if (a === '--simular' && aceitas.includes('simular')) o.simular = true;
    else if (a === '--pasta' && aceitas.includes('pasta')) {
      if (valor(i) === null) return { uso: 'Faltou a pasta depois de --pasta.' };
      o.pasta = resto[++i];
    }
    else if (a.startsWith('--')) return { uso: `Opção desconhecida: ${a}` };
    else o.posicionais.push(a);
  }
  return o;
}

function resumoAplicar(res) {
  if (res.situacao !== 'organizada') return 'Nada a mudar: as coisas da empresa já estão na pasta própria dela.';
  // O fim curto, para a conversa; a lista por grupo fica no relatório (texto e página).
  const l = [`Pronto: as coisas de "${res.nome || 'Sua empresa'}" agora ficam numa pasta só da empresa.`];
  l.push(`${plural(res.copiados, 'arquivo', 'arquivos')} (${totalDe(res.bytes || 0)}) ${res.copiados === 1 ? 'copiado e conferido' : 'copiados e conferidos, um por um'}.`);
  l.push('Os arquivos de antes continuam onde estavam, intactos, como cópia de segurança.');
  if (res.avisos.length) l.push(`${plural(res.avisos.length, 'aviso está', 'avisos estão')} no relatório.`);
  l.push('Abra uma conversa nova para continuar: os lugares guardados nesta conversa eram os de antes.');
  l.push(FRASE_DESFAZER);
  return l.join('\n');
}

const TEXTO_ESTADO = {
  'pasta-antiga': 'As coisas da empresa estão no formato antigo, nas pastas de sempre. Dá para organizá-las numa pasta só da empresa, se você quiser.',
  organizada: 'Sua pasta já está organizada.',
  // A segunda frase (os de antes continuam onde estavam) vem da pendência, uma vez só.
  'organizada-com-antigos': 'Sua pasta está organizada.',
  'organizada-antigos-retirados': 'Sua pasta está organizada, e os arquivos de antes estão guardados na cópia de segurança.',
  // O detalhe (que lugares a Fábrica está usando, o que fazer) vem das pendências: depende de onde parou.
  interrompida: 'A organização da pasta (ou o desfazer dela) não terminou.',
};
function resumoEstado(e) {
  const l = [TEXTO_ESTADO[e.situacao] || e.situacao];
  for (const p of e.pendencias) if (!l.includes(p.mensagem)) l.push(p.mensagem);
  return l.join('\n');
}
function resumoDesfazer(d) {
  const l = ['Pronto: a pasta voltou a ser como era antes da organização.'];
  if (d.levadosDeVolta.length) l.push(`${plural(d.levadosDeVolta.length, 'arquivo feito depois da organização voltou', 'arquivos feitos depois da organização voltaram')} para os lugares de sempre.`);
  if (d.restaurados && d.restaurados.length) l.push(`${plural(d.restaurados.length, 'arquivo de antes, que tinha sido apagado, voltou', 'arquivos de antes, que tinham sido apagados, voltaram')} da cópia.`);
  if (d.perdidos && d.perdidos.length) l.push(`${plural(d.perdidos.length, 'arquivo de antes foi apagado', 'arquivos de antes foram apagados')} e não tinha mais cópia para voltar.`);
  if (d.incompletos) l.push(frasePelaMetade(d.incompletos));
  if (d.trazidosDaCopia && d.trazidosDaCopia.length) l.push(`${plural(d.trazidosDaCopia.length, 'arquivo de antes voltou', 'arquivos de antes voltaram')} da cópia de segurança para os lugares de sempre.`);
  if (d.mantidos.length) l.push(`${plural(d.mantidos.length, 'arquivo ficou', 'arquivos ficaram')} como estava (já estava na pasta da empresa antes, não tem lugar no formato antigo, ou foi editado no lugar de sempre e a versão editada foi mantida).`);
  l.push('As cópias que estavam na pasta da empresa foram guardadas na cópia de segurança; nada foi apagado.');
  l.push('Abra uma conversa nova para continuar: os lugares guardados nesta conversa eram os da pasta da empresa.');
  return l.join('\n');
}

function resumoPreviaDaRetirada(p) {
  // O tamanho só a partir de 1 MB, como no resto.
  const l = [`Guardar os arquivos de antes na cópia de segurança: ${contaDe(p.arquivos, p.bytes)}.`];
  l.push('A Fábrica já usa a pasta da empresa, que tem a cópia de cada um. Nada é apagado, e desfazer a organização os traz de volta.');
  if (p.recusas.length) {
    l.push('', 'Não dá para fazer agora:');
    for (const x of p.recusas) l.push(`  - ${x.mensagem}`);
  }
  return l.join('\n');
}
// "1 cópia que ficou pela metade foi guardada à parte" (uma gravação interrompida antes, refeita agora).
const frasePelaMetade = (n) => (n === 1 ? '1 cópia que ficou pela metade foi guardada à parte.' : `${n} cópias que ficaram pela metade foram guardadas à parte.`);
function resumoRetirar(x) {
  return [
    `Pronto: ${plural(x.movidos, 'arquivo de antes foi guardado', 'arquivos de antes foram guardados')} na cópia de segurança${tamanhoQueImporta(x.bytes) ? ` (${tamanhoQueImporta(x.bytes)})` : ''}.`,
    'A Fábrica continua usando a pasta da empresa, que tem tudo. Nada foi apagado.',
    ...(x.incompletos ? [frasePelaMetade(x.incompletos)] : []),
    FRASE_DESFAZER,
  ].join('\n');
}

// ---------- a prévia em página (para a conversa: resumo curto e a página com tudo) ----------
// O caminho real de `p`, mesmo que ele ainda não exista (o da pasta mais funda que existe, mais o resto): um atalho no
// caminho nunca leva a prévia para dentro da Fábrica.
function caminhoReal(p) {
  let atual = path.resolve(p);
  const resto = [];
  while (!fs.existsSync(atual)) {
    const pai = path.dirname(atual);
    if (pai === atual) break;
    resto.unshift(path.basename(atual));
    atual = pai;
  }
  let real = atual;
  try { real = fs.realpathSync.native(atual); } catch { /* fica o resolvido */ }
  return path.join(real, ...resto);
}
const estaDentro = (base, p) => {
  const rel = path.relative(base, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

// A simulação mais a página da prévia, gravada numa pasta temporária FORA da Fábrica (a simulação não grava nada na
// Fábrica). `pasta`: onde criar a pasta da prévia (o padrão é a pasta temporária do sistema); cada prévia ganha uma
// pasta nova, então uma nunca grava por cima da outra. Devolve só o que a conversa precisa (o detalhe técnico, arquivo
// por arquivo, continua no `simular --json`).
function previa(r = empresa.raiz(), opcoes = {}) {
  const base = caminhoReal(opcoes.pasta || require('os').tmpdir());
  for (const proibida of [r, RAIZ_DO_CODIGO]) {
    if (estaDentro(caminhoReal(proibida), base)) throw erro('USO', 'A prévia vai numa pasta temporária fora da Fábrica; escolha outra pasta.');
  }
  const inv = simular(r, { runParadoConfirmado: opcoes.runParadoConfirmado || [] });
  let pagina = null;
  if (inv.situacao === 'pasta-antiga') {
    fs.mkdirSync(base, { recursive: true });
    const dir = fs.mkdtempSync(path.join(base, 'organizar-pasta-'));
    pagina = path.join(dir, 'previa.html');
    const tmp = path.join(dir, '.previa.html.tmp');
    fs.writeFileSync(tmp, require('./migrar-pagina').paginaPrevia(dadosDaPagina(inv)), { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(tmp, pagina);
  }
  return {
    situacao: inv.situacao,
    nome: inv.nome,
    codigoSimulacao: inv.codigoSimulacao,
    podeOrganizar: inv.situacao === 'pasta-antiga' && !inv.recusas.length,
    resumo: resumoCurto(inv),
    recusas: inv.recusas.map((x) => ({ code: x.code, mensagem: x.mensagem, ...(x.linhas ? { linhas: x.linhas } : {}), arquivos: x.arquivos || [] })),
    avisos: avisosEmOrdem(inv.avisos).map((a) => ({ tipo: a.tipo, mensagem: a.mensagem })),
    pagina,
    endereco: pagina ? require('url').pathToFileURL(pagina).href : null,
  };
}

const enderecoDe = (r, rel) => (rel ? require('url').pathToFileURL(absDe(r, rel)).href : null);

// Trata as próprias recusas: devolve 0, 1 ou 2 (o atalho do empresa.js repassa o retorno).
function principal(args) {
  const [cmd, ...resto] = args;
  const uso = (msg) => { console.error((msg ? msg + '\n' : '') + USO); return 2; };
  const json = resto.includes('--json');
  try {
    switch (cmd) {
      case 'simular': {
        const o = lerOpcoes(resto, ['json', 'run']);
        if (o.uso) return uso(o.uso);
        if (o.posicionais.length > 1) return uso('Sobrou argumento.');
        const inv = simular(empresa.raiz(), { codigo: o.posicionais[0] || LEGADO, runParadoConfirmado: o.runParadoConfirmado });
        console.log(o.json ? JSON.stringify(inv, null, 2) : resumoSimulacao(inv));
        return inv.recusas.length ? 1 : 0;
      }
      case 'previa': {
        // Sempre em JSON: é para o agente (o resumo vai para a conversa; a página, para o navegador).
        const o = lerOpcoes(resto, ['json', 'run', 'pasta']);
        if (o.uso) return uso(o.uso);
        if (o.posicionais.length) return uso('Sobrou argumento.');
        const p = previa(empresa.raiz(), { pasta: o.pasta, runParadoConfirmado: o.runParadoConfirmado });
        console.log(JSON.stringify(p, null, 2));
        return p.recusas.length ? 1 : 0;
      }
      case 'aplicar': {
        const o = lerOpcoes(resto, ['json', 'run', 'confirmar-codigo']);
        if (o.uso) return uso(o.uso);
        if (o.posicionais.length) return uso('Sobrou argumento.');
        if (o.confirmar === undefined) return uso('Simule antes e confirme com o código que a simulação mostrou: aplicar --confirmar <codigo>.');
        const res = aplicar(empresa.raiz(), { confirmar: o.confirmar, runParadoConfirmado: o.runParadoConfirmado });
        console.log(o.json
          ? JSON.stringify({ ...res, relatorioEndereco: enderecoDe(empresa.raiz(), res.relatorioPagina), resumo: resumoAplicar(res).split('\n') }, null, 2)
          : resumoAplicar(res));
        return 0;
      }
      case 'estado': {
        const o = lerOpcoes(resto, ['json']);
        if (o.uso) return uso(o.uso);
        if (o.posicionais.length) return uso('Sobrou argumento.');
        const e = estado(empresa.raiz());
        console.log(o.json ? JSON.stringify(e, null, 2) : resumoEstado(e));
        return 0;
      }
      case 'retirar': {
        const o = lerOpcoes(resto, ['json', 'confirmar', 'simular']);
        if (o.uso) return uso(o.uso);
        if (o.posicionais.length > 1) return uso('Sobrou argumento.');
        if (o.simular) {
          const p = previaDaRetirada(empresa.raiz(), o.posicionais[0]);
          console.log(o.json ? JSON.stringify({ ...p, resumo: resumoPreviaDaRetirada(p).split('\n') }, null, 2) : resumoPreviaDaRetirada(p));
          return p.recusas.length ? 1 : 0;
        }
        if (o.confirmar !== true) return uso('Para guardar os arquivos de antes na cópia de segurança, veja antes (retirar --simular) e confirme: retirar --confirmar.');
        const x = retirar(empresa.raiz(), o.posicionais[0], { confirmar: true });
        console.log(o.json ? JSON.stringify({ ...x, resumo: resumoRetirar(x).split('\n') }, null, 2) : resumoRetirar(x));
        return 0;
      }
      case 'desfazer': {
        const o = lerOpcoes(resto, ['json', 'confirmar', 'levar']);
        if (o.uso) return uso(o.uso);
        if (o.posicionais.length > 1) return uso('Sobrou argumento.');
        if (o.confirmar !== true) return uso('Para desfazer, confirme: desfazer --confirmar.');
        const d = desfazer(empresa.raiz(), o.posicionais[0], { confirmar: true, levarNovos: o.levarNovos });
        console.log(o.json
          ? JSON.stringify({ ...d, relatorioEndereco: enderecoDe(empresa.raiz(), d.relatorioPagina), resumo: resumoDesfazer(d).split('\n') }, null, 2)
          : resumoDesfazer(d));
        return 0;
      }
      default:
        return uso(cmd ? `Comando desconhecido: ${cmd}` : '');
    }
  } catch (e) {
    if (e && e.code === 'USO') return uso(e.message);
    if (e && RECUSAS.has(e.code)) {
      // A recusa vai para a saída padrão, que a conversa mostra (em português simples); o código, para o agente, na de
      // erro.
      if (json) console.log(JSON.stringify({ code: e.code, mensagem: e.message, arquivos: e.arquivos || [], ...(e.recusas ? { recusas: e.recusas } : {}) }, null, 2));
      else console.log(e.message);
      console.error('RECUSA ' + e.code);
      return 1;
    }
    console.error('ERRO  inesperado: ' + (e && e.message ? e.message : String(e)));
    return 2;
  }
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = {
  inventario, simular, previa, aplicar, estado, retirar, previaDaRetirada, desfazer, GRUPOS, CLASSIFICACAO, FRASE_DESFAZER,
  dadosDaPagina, resumoCurto,
  chavesSemClassificacao, principal,
};
