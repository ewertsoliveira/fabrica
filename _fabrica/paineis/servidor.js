// Servidor local dos painéis (Laboratório de Design e Cronograma) da Fábrica de Conteúdo.
// Serve os arquivos da pasta da Fábrica, guarda a arte aprovada, desfaz a aprovação e gera o cronograma para o
// cliente, sempre para UMA empresa por pedido.
// Só aceita pedidos deste computador. Nunca faz commit nem publica nada.
//
// Um servidor só por Fábrica: cada pedido diz de qual empresa é (?empresa=<codigo> nas leituras, "empresa" no corpo de
// aprovar e desfazer). Sem o parâmetro vale a empresa ativa do agente; com várias empresas e nenhuma escolhida, o
// pedido é recusado com um aviso claro. O seletor do painel NUNCA troca a empresa ativa: nenhuma rota grava ativa.json.
// Toda resposta de /api devolve "empresa" (o código a que o pedido se referiu, ou null), para a tela descartar uma
// resposta que chegou depois de a pessoa já ter trocado de empresa.
//
// O Cronograma com as artes: GET /api/dados traz `midias` (as imagens, o vídeo e a prévia de cada post, só arquivos da
// empresa, ver midias.js) e GET /api/baixar-artes?empresa=&post=&arte= devolve o .zip com as imagens de uma arte e a legenda.
//
// O caminho do usuário (etapa 8), sempre para a empresa do pedido e sem gravar ativa.json:
//   GET  /api/caminho?empresa=   { para, intencao, marca: { definida, origem }, estilo: { id, nome } | null, pendentes, passo }
//   GET  /api/pedidos?empresa=   { pedidos: [{ tipo (em palavras), dataLocal, estado, resumo, estilo (nome) }], ilegiveis } (nunca o nome do
//                                arquivo nem o recado)
//   GET  /api/letras             { letras: [{ familia, ..., arquivo, endereco }], pares } (a lista de letras livres)
//   POST /api/comecar            { nome, para } cria a empresa (código sugerido pelo nome, -2 se já existe) e grava empresas/uso.json
//   POST /api/intencao           { empresa, quer, tudo } grava o intencao.json da empresa
//   POST /api/estilo             { empresa, estilo, origem, comMarca } escolhe o estilo (e, sem marca, a marca do estilo) e grava
//                                o pedido "usar-estilo" já aplicado; POST /api/estilo/desfazer { empresa }
//   POST /api/marca              { empresa, cores, fontes, logo, origem } grava a marca com histórico; POST /api/marca/desfazer
//   POST /api/arquivo            { empresa, tipo: logo | fonte | referencia | manual, dados } guarda o arquivo enviado, com o nome
//                                dado pelo servidor e o tipo conferido pelo conteúdo; devolve { nome }
// Toda rota que grava (estas e as de antes) passa antes pela trava do modelo (`opcoes.trava`, veja criarServidor).
//
// Uso:
//   node _fabrica/paineis/servidor.js [--porta N] [--sem-navegador]   sobe e abre o navegador (--porta 0: porta livre qualquer)
//   node _fabrica/paineis/servidor.js garantir [--porta N]            confere se o servidor desta pasta está no ar
//                                                                     (sobe se precisar) e imprime o endereço
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { exec, execFile, spawn } = require('child_process');
const dados = require('./dados');
const biblioteca = require('./biblioteca');
const empresaMod = require('../core/empresa');
const escolhaMod = require('../core/escolha');
const pedidosMod = require('../core/pedidos');
const escrever = require('../../08-FERRAMENTAS/marca/escrever');
const { caminhos, lerJson, gravarJson } = dados;
// A pasta da Fábrica sempre normalizada (sem barra no fim), para comparar e para conferir que o arquivo pedido está dentro dela.
const raiz = () => path.resolve(dados.raiz());
// A pasta do código (de onde vêm as marcas de exemplo e as fontes do modelo); igual à raiz, a não ser em testes.
const RAIZ_CODIGO = path.resolve(__dirname, '..', '..');

const PORTA_INICIAL = 8890;
const PORTA_FINAL = 8899;
const LIMITE_CORPO = 200e6; // 200 MB: capas e carrosséis chegam como imagens dentro do pedido
const LIMITE_PEDIDO = 20e3; // 20 KB: um pedido da biblioteca é só tipo, estilo e um recado de até 500 caracteres
const NOME_PADRAO = 'Sua empresa';
const PAPEIS_COR = ['escuro', 'claro', 'acento', 'neutro'];
const PAPEIS_FONTE = ['principal', 'mono', 'acento'];
const CONFIG_PADRAO = { titulo: '', periodo: '', pessoas: [], aprovadores: [] };

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.wasm': 'application/wasm',
};

// ---- Quem pode falar com o servidor ----

// Só este computador. O nome do endereço remoto vem do próprio sistema, não do pedido.
function ehLocal(endereco) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(endereco);
}

// O cabeçalho Host precisa ser o do próprio computador (protege contra páginas de fora que apontam um nome
// qualquer para 127.0.0.1). Origin, quando vem, também.
function hostLocal(valor) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(String(valor || ''));
}
function origemLocal(valor) {
  return valor === undefined || /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(String(valor));
}

// ---- Onde fica o registro do servidor ----

// Um lugar fixo da Fábrica, sem depender de empresa: o servidor é um só, e trocar a empresa ativa não pode fazê-lo sumir.
const arquivoServidor = (r) => path.join(r, 'empresas', '.servidor.json');
const urlDaPorta = (porta) => `http://localhost:${porta}`;
const mesmaRaiz = (a, b) => path.resolve(String(a)).toLowerCase() === path.resolve(String(b)).toLowerCase();

// ---- Respostas ----

const jsonRes = (res, code, obj, codigo = null) => {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ...obj, empresa: codigo }));
};
// Uma recusa do pedido (empresa errada, peça de outra empresa...): carrega o status e a mensagem em português.
const recusa = (status, erro) => Object.assign(new Error(erro), { recusaDoPedido: true, status });
const trecho = (v) => JSON.stringify(String(v).slice(0, 60));

// ---- A empresa de cada pedido ----

// A empresa do pedido sempre vem da lista da pasta: o texto digitado nunca vira caminho sem passar por aqui.
// `pedida` é o texto do pedido (undefined se o pedido não disse). Devolve o código, ou null quando a pasta ainda não
// tem nenhuma empresa. Sem `pedida` vale a empresa ativa; várias empresas e nenhuma escolhida recusa com 400.
function empresaDoPedido(r, pedida) {
  let codigos;
  try {
    codigos = empresaMod.listar(r).map((e) => e.codigo);
  } catch (e) {
    // o caminho do arquivo só vai para o console: a recusa chega à tela pelas rotas do caminho
    if (e.code === 'JSON_INVALIDO') { console.error('Lista de empresas ilegível:', e.arquivo); throw recusa(500, 'A lista de empresas não está em um formato válido. Nada foi alterado; peça ajuda no Claude para corrigir.'); }
    throw e;
  }
  if (pedida !== undefined) {
    if (typeof pedida !== 'string' || pedida === '') throw recusa(400, 'O pedido veio sem a empresa. Escolha a empresa no seletor.');
    if (!codigos.includes(pedida)) throw recusa(400, `A empresa ${trecho(pedida)} não existe nesta pasta. Escolha a empresa no seletor.`);
    return pedida;
  }
  try {
    return empresaMod.ativa(r);
  } catch (e) {
    if (e.code === 'EMPRESA_NAO_ESCOLHIDA') throw recusa(400, 'Escolha a empresa no seletor.');
    if (e.code === 'EMPRESA_DESCONHECIDA') throw recusa(400, 'A empresa ativa do agente não existe mais nesta pasta. Escolha a empresa no seletor.');
    if (e.code === 'JSON_INVALIDO') { console.error('Empresa ativa ilegível:', e.arquivo); throw recusa(500, 'Não consegui saber qual é a empresa ativa: um arquivo da pasta não está em um formato válido. Nada foi alterado; peça ajuda no Claude para corrigir.'); }
    throw e;
  }
}

// O parâmetro ?empresa= do endereço: undefined se não veio; mais de um é recusado (a empresa do pedido é uma só).
function empresaDaUrl(url) {
  let valores;
  try { valores = new URL(url, 'http://localhost').searchParams.getAll('empresa'); } catch { valores = []; }
  if (valores.length > 1) throw recusa(400, 'O pedido trouxe mais de uma empresa. Escolha a empresa no seletor.');
  return valores.length ? valores[0] : undefined;
}

// A empresa ativa do agente, ou undefined se não dá para saber (nenhuma escolhida, arquivo com defeito...).
function ativaSegura(r) {
  try { return empresaMod.ativa(r); } catch { return undefined; }
}

// ---- Dados da empresa (marca) ----

function lerMarcaYaml(arquivo) {
  // Só o leitor de YAML: carregar marca.js leria e validaria a marca da empresa ativa, que não é a pedida aqui
  // (e a validação na carga derruba o painel).
  const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml.js');
  return lerYaml(fs.readFileSync(arquivo, 'utf8'));
}

const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const dentroDe = (base, p) => { const rel = path.relative(base, p); return rel !== '' && rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel); };

// Endereço (servido por este mesmo servidor) do arquivo de fonte indicado no marca.yaml, ou null. A fonte vale se o
// arquivo existe dentro da pasta da Fábrica: na pasta da empresa, ou, para o que é do modelo, na pasta do código.
// Um caminho com ".." ou absoluto nunca vira endereço. Na empresa com pasta própria, a mesma regra do marca.js para a
// marca vinda da pasta antiga: 06-MARCA-E-FOTOS/<resto> também em <pasta da empresa>/<resto>, depois do espelho.
function urlDeFonte(r, c, ehGaveta, rel) {
  if (typeof rel !== 'string' || rel.trim() === '' || rel.includes('\0')) return null;
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || /^[\\/]/.test(rel)) return null;
  const partes = rel.split(/[\\/]+/).filter((p) => p !== '' && p !== '.');
  if (!partes.length || partes.includes('..') || segmentosProibidos(partes)) return null;
  const daEmpresaAntiga = partes[0].toLowerCase() === '06-marca-e-fotos' && (partes[1] || '').toLowerCase() !== 'exemplo';
  const candidatos = [];
  if (ehGaveta) candidatos.push(path.join(c.pastaMarca, ...partes));
  // Marca vinda da pasta antiga (marca.yaml copiado sem edição): 06-MARCA-E-FOTOS/<resto> que não está no espelho é
  // procurado em <pasta da empresa>/<resto>, nunca na raiz nem em outra empresa (as partes já não têm "..").
  if (ehGaveta && daEmpresaAntiga && partes.length > 1) candidatos.push(path.join(c.pastaMarca, ...partes.slice(1)));
  if (!ehGaveta || !daEmpresaAntiga) candidatos.push(path.join(r, ...partes), path.join(RAIZ_CODIGO, ...partes));
  const achado = candidatos.find((p) => dentroDe(r, p) && ehArquivo(p));
  return achado ? '/' + path.relative(r, achado).split(path.sep).map(encodeURIComponent).join('/') : null;
}

// Marca da empresa pedida: nome, se é a marca de exemplo, cores por papel e endereço das fontes por papel.
// `codigo` null = pasta sem nenhuma empresa ainda (vale o marca.yaml de sempre). A variável FABRICA_MARCA, que aponta
// para outra marca, só vale para a empresa ativa: as outras mostram a própria.
function dadosEmpresa(r, codigo) {
  const entrada = codigo === null ? null : empresaMod.listar(r).find((e) => e.codigo === codigo);
  if (codigo !== null && !entrada) throw recusa(400, `A empresa ${trecho(codigo)} não existe nesta pasta. Escolha a empresa no seletor.`);
  const c = codigo === null ? null : empresaMod.caminhos(codigo, r);
  const ehGaveta = !!entrada && entrada.disposicao === 'gaveta';
  const doAmbiente = process.env.FABRICA_MARCA && ativaSegura(r) === codigo ? path.resolve(process.env.FABRICA_MARCA) : null;
  const propria = doAmbiente && fs.existsSync(doAmbiente) ? doAmbiente : (c ? c.marca : path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml'));
  const temReal = fs.existsSync(propria);
  const exemplo = [path.join(r, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml'), path.join(RAIZ_CODIGO, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml')].find((p) => fs.existsSync(p));
  const arquivo = temReal ? propria : exemplo;
  let marca = {};
  if (arquivo) {
    try { marca = lerMarcaYaml(arquivo) || {}; } catch { /* marca ilegível: o painel segue com os padrões */ }
  }
  const nomeDaMarca = temReal && marca.empresa && typeof marca.empresa.nome === 'string' ? marca.empresa.nome.trim() : '';
  const nomeDoIndice = entrada && typeof entrada.nome === 'string' ? entrada.nome.trim() : '';
  const nome = nomeDaMarca || nomeDoIndice || (codigo === null ? NOME_PADRAO : codigo);
  const cores = {};
  for (const papel of PAPEIS_COR) {
    const v = marca.cores ? marca.cores[papel] : undefined;
    cores[papel] = typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim() : null;
  }
  const fontes = {};
  for (const papel of PAPEIS_FONTE) {
    const f = marca.tipografia ? marca.tipografia[papel] : undefined;
    fontes[papel] = f && typeof f === 'object' ? urlDeFonte(r, c, ehGaveta, f.arquivo) : null;
  }
  return { codigo, nome, exemplo: !temReal, cores, fontes };
}

// ---- Aprovação de design (botão "Aprovar design" do laboratório) ----
// Grava as imagens aprovadas na pasta da peça, guarda a versão anterior em _versoes/ e registra em
// aprovacoes.json da empresa, que os dois painéis leem.

const nomeOk = (n) => typeof n === 'string' && /^[\w\-. ]+\.(png|txt)$/i.test(n) && !n.includes('..');
const carimboOk = (s) => typeof s === 'string' && /^[\w\-]+$/.test(s);
const carimbo = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
const temChave = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const idOk = (id) => typeof id === 'string' && id.trim() !== '' && id.length <= 200 && id !== '__proto__';

// Destino aceito: dentro das publicações da empresa ou das saídas das linhas dela (na pasta antiga, 02-PUBLICACOES/
// e linhas/<linha>/saida/; numa empresa com pasta própria, empresas/<codigo>/publicacoes/ e .../saidas/<linha>/).
// Qualquer outro lugar (marca, núcleo, ferramentas, pastas de outra empresa) fica de fora, e o caminho nunca sai da
// pasta da Fábrica. `codigo` é o da empresa do pedido (null só em pasta sem nenhuma empresa).
function pastaSegura(r, codigo, rel) {
  if (typeof rel !== 'string' || rel.trim() === '' || rel.includes('\0')) return null;
  if (path.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || /^[\\/]/.test(rel)) return null;
  if (codigo !== null && typeof codigo !== 'string') return null;
  let c;
  try { c = caminhos(r, codigo); } catch { return null; }
  const completo = path.resolve(r, rel);
  const partes = path.relative(r, completo).split(path.sep);
  if (partes[0] === '' || partes.includes('..')) return null;
  if (dentroDe(c.publicacoes, completo)) return completo;
  if (c.saidasRaiz === null) { // pasta antiga: linhas/<linha>/saida/...
    return partes[0] === 'linhas' && partes.length >= 3 && partes[2] === 'saida' ? completo : null;
  }
  if (!dentroDe(c.saidasRaiz, completo)) return null;
  const linha = path.relative(c.saidasRaiz, completo).split(path.sep)[0];
  try { c.saidas(linha); } catch { return null; } // o nome da linha segue a mesma regra do leitor de empresas
  return completo;
}

// Corpo acima do limite (pelo Content-Length declarado, ou contando o que chega, inclusive em pedaços): responde 413 na
// hora, descarta o resto sem guardar e fecha a conexão 2 s depois (para quem manda sem parar). Sem "Connection: close": com
// ele o servidor fecha enquanto o navegador ainda envia, e o fechamento abrupto apaga a resposta do outro lado (a pessoa
// veria só a conexão cair).
// `mensagem`: o que a pessoa lê no 413 (o envio de arquivo fala do arquivo).
function lerCorpo(req, res, cb, limite = LIMITE_CORPO, mensagem = 'Pedido grande demais.') {
  const partes = []; let n = 0; let estourou = false;
  const grandeDemais = () => {
    estourou = true;
    partes.length = 0;
    jsonRes(res, 413, { ok: false, erro: mensagem });
    req.resume();
    const fechar = setTimeout(() => req.destroy(), 2000);
    if (typeof fechar.unref === 'function') fechar.unref();
    req.once('end', () => clearTimeout(fechar));
  };
  const declarado = Number(req.headers['content-length']);
  if (Number.isFinite(declarado) && declarado > limite) return grandeDemais();
  req.on('data', (c) => {
    if (estourou) return;
    n += c.length;
    if (n > limite) grandeDemais();
    else partes.push(c);
  });
  req.on('end', () => { if (estourou) return; try { cb(null, JSON.parse(Buffer.concat(partes).toString('utf8'))); } catch (e) { cb(e); } });
}

// Move para _versoes/<selo>/ o que já existe na pasta. Se já houver uma versão com esse selo (duas aprovações no
// mesmo minuto), usa -2, -3... para nunca sobrescrever uma versão guardada. Devolve o selo realmente usado.
function guardarAnteriores(dir, arquivos, selo) {
  const existentes = arquivos.filter((a) => fs.existsSync(path.join(dir, a)));
  if (!existentes.length) return null;
  let final = selo; let k = 1;
  while (fs.existsSync(path.join(dir, '_versoes', final))) final = `${selo}-${++k}`;
  const v = path.join(dir, '_versoes', final);
  fs.mkdirSync(v, { recursive: true });
  existentes.forEach((a) => fs.renameSync(path.join(dir, a), path.join(v, a)));
  return final;
}

// A peça precisa estar no laboratório DESTA empresa: o id vem do navegador, e uma tela ainda aberta na empresa
// anterior não pode aprovar nem desfazer a peça de outra empresa.
// Ao aprovar (`dentro`), a peça também precisa apontar para arquivos desta empresa: o registro já recusa o contrário,
// mas um laboratorio.json editado à mão não pode fazer a empresa aprovar a arte de outra.
// `r` (a raiz) vale a regra da principal já organizada (dados.pertenceAEmpresa), a mesma do registro.
function conferirPeca(c, id, dentro = false, r = undefined) {
  const lista = lerJson(c.pecas, []);
  const peca = Array.isArray(lista) ? lista.find((p) => p !== null && typeof p === 'object' && p.id === id) : undefined;
  if (!peca) {
    throw recusa(409, 'Esta peça não está registrada no Laboratório desta empresa. Confira se a empresa escolhida no seletor é a da peça. Nada foi alterado.');
  }
  if (dentro && ((typeof peca.path === 'string' && !dados.pertenceAEmpresa(peca.path, c.codigo, r)) || (typeof peca.pasta === 'string' && !dados.pertenceAEmpresa(peca.pasta, c.codigo, r)))) {
    throw recusa(409, 'Esta peça aponta para arquivos de outra empresa, então não pode ser aprovada aqui. Registre a peça de novo com os arquivos desta empresa. Nada foi alterado.');
  }
}

function desfazer(r, codigo, b, res) {
  const c = caminhos(r, codigo);
  if (!idOk(b.id)) return jsonRes(res, 404, { ok: false, erro: 'Nada aprovado para desfazer.' }, codigo);
  conferirPeca(c, b.id);
  const arq = c.aprovacoes;
  const aprov = lerJson(arq, {});
  if (!temChave(aprov, b.id)) return jsonRes(res, 404, { ok: false, erro: 'Nada aprovado para desfazer.' }, codigo);
  const reg = aprov[b.id];
  const dir = pastaSegura(r, codigo, reg.pasta);
  if (dir) {
    const lista = Array.isArray(reg.arquivos) ? reg.arquivos.filter(nomeOk) : [];
    guardarAnteriores(dir, lista.concat(reg.legenda ? ['legenda.txt'] : []), 'desfeito-' + carimbo());
    if (carimboOk(reg.anterior)) {
      const v = path.join(dir, '_versoes', reg.anterior);
      if (fs.existsSync(v)) fs.readdirSync(v).forEach((a) => fs.renameSync(path.join(v, a), path.join(dir, a)));
    }
  }
  delete aprov[b.id];
  gravarJson(arq, aprov);
  return jsonRes(res, 200, { ok: true }, codigo);
}

function aprovar(r, codigo, b, res) {
  const c = caminhos(r, codigo);
  const arq = c.aprovacoes;
  if (!idOk(b.id)) return jsonRes(res, 400, { ok: false, erro: 'Peça sem identificação.' }, codigo);
  conferirPeca(c, b.id, true, r);
  const dir = pastaSegura(r, codigo, b.pasta);
  if (!dir) return jsonRes(res, 400, { ok: false, erro: 'Pasta de destino inválida.' }, codigo);
  const imagensOk = Array.isArray(b.itens) && b.itens.length > 0 &&
    b.itens.every((i) => i && nomeOk(i.arquivo) && /^data:image\/png;base64,/.test(i.dataUrl || ''));
  if (!imagensOk) return jsonRes(res, 400, { ok: false, erro: 'Imagens inválidas.' }, codigo);
  const aprov = lerJson(arq, {});
  fs.mkdirSync(dir, { recursive: true });
  const anterior = temChave(aprov, b.id) ? aprov[b.id] : null;
  const nomes = b.itens.map((i) => i.arquivo);
  const antigos = anterior && Array.isArray(anterior.arquivos) ? anterior.arquivos.filter(nomeOk) : [];
  const alvo = Array.from(new Set(nomes.concat(antigos, b.legenda ? ['legenda.txt'] : [])));
  const guardado = guardarAnteriores(dir, alvo, carimbo());
  b.itens.forEach((i) => fs.writeFileSync(path.join(dir, i.arquivo), Buffer.from(i.dataUrl.split(',')[1], 'base64')));
  if (b.legenda) fs.writeFileSync(path.join(dir, 'legenda.txt'), String(b.legenda), 'utf8');
  // O id vem do navegador: serve só como chave do registro, nunca como nome de arquivo ou pasta.
  aprov[b.id] = {
    id: b.id, nome: b.nome || '', postId: b.postId || null, pasta: b.pasta, arquivos: nomes,
    legenda: !!b.legenda, aprovadoEm: new Date().toISOString(), anterior: guardado,
  };
  gravarJson(arq, aprov);
  return jsonRes(res, 200, { ok: true, registro: aprov[b.id] }, codigo);
}

// Traduz um erro de leitura em resposta: recusas do pedido têm status e texto prontos; JSON quebrado nunca é regravado.
function responderErro(res, e, codigo) {
  if (e.recusaDoPedido) return jsonRes(res, e.status, { ok: false, erro: e.message }, codigo);
  if (e.code === 'JSON_INVALIDO') return jsonRes(res, 500, { ok: false, erro: 'Um arquivo desta empresa não está em um formato válido. Nada foi alterado: confira o arquivo ' + e.arquivo + '.' }, codigo);
  return jsonRes(res, 500, { ok: false, erro: String(e.message || e) }, codigo);
}

// A empresa de um pedido que grava (aprovar, desfazer, enviar ao cliente): com mais de uma empresa o corpo TEM de
// dizer de qual (não vale a ativa do agente).
function empresaDoCorpo(r, b) {
  if (b.empresa === undefined) {
    let quantas = 0;
    try { quantas = empresaMod.listar(r).length; } catch { /* índice com defeito: empresaDoPedido recusa com a mensagem certa */ }
    if (quantas > 1) throw recusa(400, 'O pedido veio sem a empresa. Escolha a empresa no seletor.');
  }
  return empresaDoPedido(r, b.empresa);
}

// A trava do modelo (e o gancho antesDeGravar) antes de gravar: se recusar, nada é gravado e a resposta é a mensagem dela
// (status do erro, ou 409). `antesDeGravar` é o de criarServidor (com a trava já dentro, quando há `opcoes.trava`).
async function liberarGravacao(antesDeGravar, pedido) {
  if (typeof antesDeGravar !== 'function') return;
  try { await antesDeGravar(pedido); } catch (e) {
    const status = Number.isInteger(e && e.status) && e.status >= 400 && e.status < 600 ? e.status : 409;
    throw recusa(status, String((e && e.message) || 'Não dá para gravar agora. Tente de novo em instantes.').slice(0, 300));
  }
}

function rotaAprovacao(r, req, res, { antesDeGravar } = {}) {
  lerCorpo(req, res, async (err, b) => {
    if (err || b === null || typeof b !== 'object' || Array.isArray(b)) return jsonRes(res, 400, { ok: false, erro: 'Pedido ilegível.' });
    let codigo = null;
    try {
      codigo = empresaDoCorpo(r, b);
      const rota = req.url.split('?')[0];
      await liberarGravacao(antesDeGravar, { rota, empresa: codigo });
      return rota === '/api/desfazer' ? desfazer(r, codigo, b, res) : aprovar(r, codigo, b, res);
    } catch (e) {
      return responderErro(res, e, codigo);
    }
  });
}

// ---- Envio ao cliente (botão "Enviar ao cliente" do cronograma) ----
// Gera o arquivo do cliente da empresa do pedido (enviar-cliente.js confere antes se nenhum post cita outra empresa).
// Resposta: { ok:true, arquivo, endereco } ou { ok:false, erro, termo?, dona? }; 409 quando não dá para gerar
// (termo de outra empresa, nenhum post), 500 quando um arquivo da empresa tem defeito ou a conferência falhou.
const STATUS_DO_ENVIO = { empresa: 400, 'sem-posts': 409, vazamento: 409, dados: 500, conferencia: 500 };

function rotaEnvio(r, req, res, { antesDeGravar } = {}) {
  lerCorpo(req, res, async (err, b) => {
    if (err || b === null || typeof b !== 'object' || Array.isArray(b)) return jsonRes(res, 400, { ok: false, erro: 'Pedido ilegível.' });
    let codigo = null;
    try {
      codigo = empresaDoCorpo(r, b);
      if (codigo === null) throw recusa(400, 'Escolha a empresa no seletor.');
      await liberarGravacao(antesDeGravar, { rota: '/api/enviar-cliente', empresa: codigo });
      const resultado = await require('./enviar-cliente').enviar({ raiz: r, empresa: codigo });
      const { empresa, motivo, posts, ...corpo } = resultado;
      return jsonRes(res, resultado.ok ? 200 : STATUS_DO_ENVIO[motivo] || 500, corpo, codigo);
    } catch (e) {
      return responderErro(res, e, codigo);
    }
  });
}

// ---- Pedido ao agente (botões da biblioteca de estilos) ----
// Grava um arquivo de pedido na pasta da empresa do pedido (o agente lê depois). Corpo: { empresa, tipo, estilo, nota,
// anexos, detalhes } (anexos: os nomes que /api/arquivo devolveu; o pedidos.js confere tudo). Com mais de uma empresa o
// corpo TEM de dizer de qual. Resposta: { ok:true, mensagem } (nunca o nome do arquivo).
// Corpo fechado, como nas rotas do caminho: campo desconhecido (inclusive `aplicado`, que só o servidor escreve) é recusado.
const CAMPOS_PEDIDO = ['empresa', 'tipo', 'estilo', 'nota', 'anexos', 'detalhes'];
function rotaPedido(r, req, res, { antesDeGravar } = {}) {
  lerCorpo(req, res, async (err, b) => {
    if (err || b === null || typeof b !== 'object' || Array.isArray(b)) return jsonRes(res, 400, { ok: false, erro: 'Pedido ilegível.' });
    let codigo = null;
    try {
      if (Object.keys(b).some((k) => !CAMPOS_PEDIDO.includes(k))) throw recusa(400, FORMATO);
      codigo = empresaDoCorpo(r, b);
      if (codigo === null) throw recusa(400, 'Escolha a empresa no seletor.');
      await liberarGravacao(antesDeGravar, { rota: '/api/pedido', empresa: codigo });
      const { mensagem } = biblioteca.gravarPedido(r, codigo, { tipo: b.tipo, estilo: b.estilo, nota: b.nota, anexos: b.anexos, detalhes: b.detalhes });
      return jsonRes(res, 200, { ok: true, mensagem }, codigo);
    } catch (e) {
      if (!e.recusaDoPedido && e.code !== 'JSON_INVALIDO') {
        // Falha ao guardar (pasta que não pode ser criada, disco...): a pessoa lê português simples, sem caminho; o
        // detalhe técnico fica só no console do servidor.
        console.error('Não foi possível guardar o pedido da biblioteca:', e);
        return jsonRes(res, 500, { ok: false, erro: 'Não consegui guardar o pedido. Tente de novo.' }, codigo);
      }
      return responderErro(res, e, codigo);
    }
  }, LIMITE_PEDIDO);
}

// ---- Prévias na marca (interruptor "Na minha marca" da biblioteca) ----
// Corpo: { empresa, acao: gerar | priorizar | pausar | retomar | cancelar, estilo? }. Aplica a ação na lista da empresa
// (08-FERRAMENTAS/biblioteca/fila-marca.js) e, em gerar, priorizar e retomar, garante que alguém está fazendo as prévias
// (lançado com `lancarTrabalhador`, trocável nos testes). Resposta: { ok: true, estado } ou a recusa em português.
// `como-ficaria` { estilo, papel, cor, peca: { formato, lamina } }: as peças do grupo com uma das cores sugeridas (cor-sugerida.js), feitas na hora;
// resposta { ok: true, comoFicaria: { pecas: [{ formato, lamina, atual, endereco, dificeis }] } }. Nunca grava a marca.
// `antesDeGravar({ rota, empresa, acao })` (opcional, pode ser assíncrono) roda depois de o pedido ser conferido e antes de
// qualquer gravação: se lançar erro, nada é gravado e a resposta é a mensagem dele (status do erro, ou 409). É por ele que
// a trava do modelo (opcoes.trava, veja criarServidor) recusa gravar numa pasta que é o repositório-modelo.
const ACOES_PREVIAS = ['gerar', 'priorizar', 'pausar', 'retomar', 'cancelar', 'como-ficaria'];
const CAMPOS_PREVIAS = ['empresa', 'acao', 'estilo', 'papel', 'cor', 'peca']; // corpo fechado, como nas rotas do caminho
const STATUS_PREVIAS = { SEM_MARCA: 409, ESTILO_DESCONHECIDO: 400, FILA_OCUPADA: 503, COR_FORA: 400, PECA_FORA: 400, SEM_PREVIA: 409, MARCA_MUDOU: 409, OCUPADO: 503, FALHOU: 500 };
function rotaPreviasMarca(r, req, res, { lancarTrabalhador, antesDeGravar, rodarComoFicaria } = {}) {
  const fila = require('../../08-FERRAMENTAS/biblioteca/fila-marca');
  lerCorpo(req, res, async (err, b) => {
    if (err || b === null || typeof b !== 'object' || Array.isArray(b)) return jsonRes(res, 400, { ok: false, erro: 'Pedido ilegível.' });
    let codigo = null;
    try {
      if (Object.keys(b).some((k) => !CAMPOS_PREVIAS.includes(k))) throw recusa(400, FORMATO);
      codigo = empresaDoCorpo(r, b);
      if (codigo === null) throw recusa(400, 'Escolha a empresa no seletor.');
      if (!ACOES_PREVIAS.includes(b.acao)) throw recusa(400, 'Este pedido não é um dos que as prévias na marca aceitam.');
      if (typeof antesDeGravar === 'function') {
        try { await antesDeGravar({ rota: '/api/previas-marca', empresa: codigo, acao: b.acao }); } catch (e) {
          const status = Number.isInteger(e && e.status) && e.status >= 400 && e.status < 600 ? e.status : 409;
          throw recusa(status, String((e && e.message) || 'Não dá para gravar agora. Tente de novo em instantes.').slice(0, 300));
        }
      }
      if (b.acao === 'como-ficaria') {
        const comoFicaria = await require('../../08-FERRAMENTAS/biblioteca/cor-sugerida').comoFicaria({ raiz: r, empresa: codigo, estilo: b.estilo, papel: b.papel, cor: b.cor, peca: b.peca, rodar: rodarComoFicaria || null });
        return jsonRes(res, 200, { ok: true, comoFicaria }, codigo);
      }
      const comecaTrabalho = ['gerar', 'priorizar', 'retomar'].includes(b.acao);
      if (comecaTrabalho && !ehArquivo(empresaMod.caminhos(codigo, r).marca)) throw Object.assign(new Error('Defina a sua marca antes de ver os estilos nela.'), { code: 'SEM_MARCA' });
      let estado = b.acao === 'gerar' ? fila.pedir(r, codigo) : b.acao === 'priorizar' ? fila.priorizar(r, codigo, b.estilo) : fila[b.acao](r, codigo);
      if (comecaTrabalho) {
        try {
          if (fila.garantirTrabalhador(r, lancarTrabalhador ? { lancar: lancarTrabalhador } : {})) estado = { ...estado, trabalhador: true };
        } catch (e) { console.error('Não consegui começar as prévias na marca:', e); }
      }
      return jsonRes(res, 200, { ok: true, estado }, codigo);
    } catch (e) {
      if (STATUS_PREVIAS[e.code]) return jsonRes(res, STATUS_PREVIAS[e.code], { ok: false, erro: e.message }, codigo);
      if (!e.recusaDoPedido && e.code !== 'JSON_INVALIDO') {
        console.error('Prévias na marca:', e);
        return jsonRes(res, 500, { ok: false, erro: 'Não consegui atualizar as prévias na marca. Tente de novo.' }, codigo);
      }
      return responderErro(res, e, codigo);
    }
  }, LIMITE_PEDIDO);
}

// ---- O caminho do usuário (etapa 8) ----
// Toda gravação vai só para os caminhos da empresa do pedido (empresaDoCorpo), passa pela trava do modelo (liberar) depois
// de o pedido ser conferido, e nenhuma grava ativa.json. Quem grava de fato: empresa.js (criar), escolha.js (estilo),
// escrever.js (marca), pedidos.js (pedido) e, aqui, o uso, a intenção e o arquivo enviado.

const MB = 1024 * 1024;
const PARA = ['minha-marca', 'clientes'];
const QUER = ['video', 'carrossel', 'post'];
const CODIGO_EMPRESA = /^[a-z0-9][a-z0-9-]{1,40}$/;
const LIMITE_NOME_EMPRESA = 80;
const ORIGEM_DA_MARCA = /^(manual|logo|do-zero|pessoa|(estilo|estilo-proprio):[A-Za-z0-9][A-Za-z0-9._-]*)$/;
const ORIGENS_DO_PAINEL = ['pessoa', 'logo'];
const COR = /^#[0-9A-Fa-f]{6}$/;
const NOME_SIMPLES = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const nomeSimples = (n) => typeof n === 'string' && NOME_SIMPLES.test(n) && !n.includes('..');
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const FORMATO = 'O pedido veio num formato que não entendi. Tente de novo pela tela.';
const PASTA_LETRAS = path.join(RAIZ_CODIGO, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes');
const ENDERECO_LETRAS = '/08-FERRAMENTAS/tesseract/modelos/fontes/';
const LETRA = /\.(ttf|otf)$/i;
const dois = (n) => String(n).padStart(2, '0');
const carimboUtc = (d) => `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}-${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}`;

// Texto de terceiros (nome de estilo, resumo do agente) antes de ir para a tela: sem sequências do terminal, sem controles,
// sem invisíveis nem marcas de direção, numa linha só e com limite. Os caracteres são montados pelo código (nenhum
// caractere invisível fica escrito neste arquivo).
const car = (n) => String.fromCodePoint(n);
const BOM_INICIO = new RegExp('^' + car(0xfeff));
const BARRA = car(92);
const RETICENCIAS = car(0x2026);
const SEQUENCIAS = new RegExp(`(?:${car(0x1b)}\\[|${car(0x9b)})[0-9;?]*[ -/]*[@-~]|${car(0x1b)}[@-_]?`, 'g');
const QUEBRAS = `${car(9)}${car(10)}${car(11)}${car(12)}${car(13)}${car(0x85)}${car(0x2028)}${car(0x2029)}`;
const INVISIVEIS = `\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}\\p{Cs}${car(0xfe00)}-${car(0xfe0f)}${car(0xe0000)}-${car(0xe01ef)}${car(0x34f)}${car(0x61c)}${car(0xad)}${car(0x180e)}${car(0x3164)}${car(0x115f)}${car(0x1160)}${car(0xffa0)}${car(0x2800)}${car(0x17b4)}${car(0x17b5)}`;
const temQuebra = (s) => new RegExp(`[${QUEBRAS}]`, 'u').test(s);
const temInvisivel = (s) => new RegExp(`[${INVISIVEIS}]`, 'u').test(s);
function textoLimpo(v, limite) {
  if (typeof v !== 'string') return null;
  const t = v.replace(SEQUENCIAS, '').replace(new RegExp(`[${QUEBRAS}]`, 'gu'), ' ').replace(new RegExp(`[${INVISIVEIS}]`, 'gu'), '').replace(/\s+/g, ' ').trim();
  const letras = [...t];
  return letras.length > limite ? letras.slice(0, limite).join('').trimEnd() + RETICENCIAS : t;
}

// Arquivo de estado (uso.json, intencao.json): ausente = undefined; quebrado = erro JSON_INVALIDO (nunca regravado).
function lerEstado(arq, confere = () => true) {
  let texto;
  try { texto = fs.readFileSync(arq, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return undefined; throw e; }
  let v;
  try { v = JSON.parse(texto.replace(BOM_INICIO, '')); } catch { v = Symbol('quebrado'); }
  if (typeof v === 'symbol' || !confere(v)) throw Object.assign(new Error('formato'), { code: 'JSON_INVALIDO', arquivo: arq });
  return v;
}
// Grava num temporário novo e troca de nome: se der problema no meio, o arquivo antigo continua inteiro.
function gravarEstado(arq, valor) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  const tmp = `${arq}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  try { fs.renameSync(tmp, arq); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* fica o temporário */ } throw e; }
}

const arqUso = (r) => path.join(r, 'empresas', 'uso.json');
const usoValido = (v) => ehObjeto(v) && PARA.includes(v.para);
function paraDoUso(r) {
  try { const v = lerEstado(arqUso(r), usoValido); return v ? v.para : null; } catch { return null; }
}
// A intenção da empresa, só com o que a tela conhece; null quando não há (ou o arquivo está quebrado: nunca é regravado).
function intencaoDe(c) {
  let v;
  try { v = lerEstado(c.intencao); } catch { return null; }
  if (!ehObjeto(v)) return null;
  const tudo = v.tudo === true;
  const quer = tudo ? [...QUER] : [...new Set(Array.isArray(v.quer) ? v.quer.filter((q) => QUER.includes(q)) : [])];
  return quer.length ? { quer, tudo } : null;
}
// De onde veio a marca (a chave `origem` do topo do marca.yaml), só se for uma das conhecidas.
function origemDaMarca(arq) {
  try {
    const y = lerMarcaYaml(arq);
    return y && typeof y.origem === 'string' && ORIGEM_DA_MARCA.test(y.origem) ? y.origem : null;
  } catch { return null; }
}
// O estilo escolhido, { id, nome } ou null (estilo.json quebrado: null, e o arquivo fica como está).
function estiloEscolhido(r, codigo) {
  let e;
  try { e = escolhaMod.ler(r, codigo); } catch { return null; }
  return e ? { id: e.estilo, nome: textoLimpo(e.nome, 80) } : null;
}
const PENDENTES = ['pendente', 'em-andamento', 'parado'];

// GET /api/caminho: em que passo a empresa está. Só lê.
function caminhoDaEmpresa(r, codigo) {
  const para = paraDoUso(r);
  if (codigo === null) return { para, intencao: null, marca: { definida: false, origem: null }, estilo: null, pendentes: 0, passo: 'para-quem' };
  const c = empresaMod.caminhos(codigo, r);
  const intencao = intencaoDe(c);
  const definida = ehArquivo(c.marca);
  const estilo = estiloEscolhido(r, codigo);
  let pendentes = 0;
  try { pendentes = pedidosMod.ler(r, codigo).filter((p) => !p.ilegivel && PENDENTES.includes(p.estado)).length; } catch { pendentes = 0; }
  const passo = !intencao ? 'o-que' : !definida && !estilo ? 'marca' : !estilo ? 'biblioteca' : 'pronto';
  return { para, intencao, marca: { definida, origem: definida ? origemDaMarca(c.marca) : null }, estilo, pendentes, passo };
}

// GET /api/pedidos: o andamento dos pedidos DESTA empresa. Só o tipo em palavras, a data, o estado e o resumo do agente
// (limpo); nunca o nome do arquivo nem o recado. Pedido ilegível (inclusive o de outra empresa copiado para esta pasta)
// só entra na contagem.
// O pedido com estilo (do catálogo, conferido por pedidos.js) leva o nome dele, para a faixa dizer qual era (inclusive
// depois de "Desfazer"); nunca o código.
function nomeDoEstiloDoPedido(r, id) {
  if (typeof id !== 'string' || !nomeSimples(id)) return null;
  try {
    const y = lerMarcaYaml(path.join(r, '04-LABORATORIO-DE-DESIGN', 'estilos', id, 'estilo.yaml'));
    return (ehObjeto(y) && textoLimpo(y.nome, 80)) || null;
  } catch { return null; }
}
function pedidosDaEmpresa(r, codigo) {
  if (codigo === null) return { pedidos: [], ilegiveis: 0 };
  const lista = pedidosMod.ler(r, codigo);
  const legiveis = lista.filter((p) => !p.ilegivel && p.empresa === codigo && Object.prototype.hasOwnProperty.call(pedidosMod.ROTULOS, p.tipo));
  return {
    pedidos: legiveis.map((p) => ({ tipo: pedidosMod.ROTULOS[p.tipo], dataLocal: p.dataLocal, estado: p.estado, resumo: p.resumo === null || p.resumo === undefined ? null : textoLimpo(p.resumo, 600), estilo: p.estilo ? nomeDoEstiloDoPedido(r, p.estilo) : null })),
    ilegiveis: lista.length - legiveis.length,
  };
}

// As letras livres do modelo (familias.json), cada uma com o arquivo da letra da marca e o endereço da prévia.
function lerFamiliasDoModelo() {
  try { return JSON.parse(fs.readFileSync(path.join(PASTA_LETRAS, 'familias.json'), 'utf8').replace(BOM_INICIO, '')); } catch {
    throw recusa(500, 'Não consegui ler a lista de letras agora. Tente de novo.');
  }
}
function letrasLivres() {
  const j = lerFamiliasDoModelo();
  const { letras, pares } = require('./cores-do-logo').listaDeLetras(j);
  const principalDe = new Map((Array.isArray(j.familias) ? j.familias : []).filter(ehObjeto).map((f) => [String(f.familia).trim(), f.arquivo]));
  const saida = [];
  for (const l of letras) {
    const doArquivo = principalDe.get(l.familia);
    const arquivo = nomeSimples(doArquivo) && l.arquivos.includes(doArquivo) ? doArquivo : l.arquivos[0];
    if (!ehArquivo(path.join(PASTA_LETRAS, arquivo))) continue;
    saida.push({ ...l, arquivo, endereco: ENDERECO_LETRAS + encodeURIComponent(arquivo) });
  }
  const conhecidas = new Set(saida.map((l) => l.familia));
  return { letras: saida, pares: pares.filter((p) => conhecidas.has(p.titulo) && conhecidas.has(p.texto)) };
}
// Os arquivos de letra que a marca pode usar direto da lista (nome exato, que existe na pasta de letras do modelo).
function arquivosDaLista() {
  const j = lerFamiliasDoModelo();
  const nomes = new Set();
  for (const f of Array.isArray(j.familias) ? j.familias : []) {
    if (!ehObjeto(f)) continue;
    for (const a of [f.arquivo, ...(Array.isArray(f.arquivos) ? f.arquivos : [])]) if (nomeSimples(a) && LETRA.test(a) && ehArquivo(path.join(PASTA_LETRAS, a))) nomes.add(a);
  }
  return nomes;
}

// Um arquivo que o painel enviou antes (pelo nome que /api/arquivo devolveu), na pasta dele DESTA empresa: o caminho
// completo, ou recusa. Só o nome exato que está na pasta (com as mesmas maiúsculas).
function arquivoEnviado(pasta, nome, mensagem) {
  if (!nomeSimples(nome)) throw recusa(400, mensagem);
  let presentes;
  try { presentes = fs.readdirSync(pasta); } catch { presentes = []; }
  if (!presentes.includes(nome) || !ehArquivo(path.join(pasta, nome))) throw recusa(400, mensagem);
  return path.join(pasta, nome);
}

// ---- Os tipos de arquivo enviado ----
// A assinatura vem do conteúdo (os primeiros bytes), nunca do nome nem do tipo declarado.
const TIPOS_DE_ARQUIVO = {
  logo: { limite: 5 * MB, aceita: ['png', 'jpg', 'webp', 'svg'], pasta: (c) => path.join(c.pastaMarca, 'logo'), prefixo: 'logo', recusa: 'Este arquivo não é uma imagem que eu consiga abrir. Use uma imagem do logo.' },
  fonte: { limite: 5 * MB, aceita: ['ttf', 'otf'], pasta: (c) => path.join(c.pastaMarca, 'fontes'), prefixo: 'letra', recusa: 'Este arquivo não é uma letra que eu consiga usar. Use o arquivo da letra.' },
  referencia: { limite: 10 * MB, aceita: ['png', 'jpg', 'webp', 'svg'], pasta: (c) => path.join(c.referencias, 'enviadas'), prefixo: 'referencia', recusa: 'As referências precisam ser imagens. Use uma imagem do seu computador.' },
  manual: { limite: 30 * MB, aceita: ['pdf'], pasta: (c) => path.join(c.referencias, 'manual'), prefixo: 'manual', recusa: 'O manual da marca precisa ser um arquivo PDF.' },
};
const LIMITE_ARQUIVO = Math.ceil((30 * MB * 4) / 3) + 64 * 1024; // o manual em base64, com folga para o resto do corpo

function decodificar(dados, limite) {
  if (typeof dados !== 'string' || dados === '') throw recusa(400, 'Escolha o arquivo antes de enviar.');
  let b64 = dados;
  if (dados.startsWith('data:')) {
    const virgula = dados.indexOf(',');
    if (virgula < 0 || virgula > 200 || !dados.slice(0, virgula).endsWith(';base64')) throw recusa(400, 'O arquivo veio num formato que não entendi. Envie de novo.');
    b64 = dados.slice(virgula + 1);
  }
  if (b64 === '' || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw recusa(400, 'O arquivo veio num formato que não entendi. Envie de novo.');
  const tamanho = (b64.length / 4) * 3 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  if (tamanho > limite) throw recusa(413, `Este arquivo é grande demais: o limite é de ${limite / MB} MB.`);
  return Buffer.from(b64, 'base64');
}

// O texto de um SVG (UTF-8 de verdade, sem caractere nulo), ou null.
function textoDoSvg(bytes) {
  let t;
  try { t = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return null; }
  if (t.includes(car(0))) return null;
  return t.replace(BOM_INICIO, '');
}
// Começa por <svg depois da declaração XML, de comentários e de um DOCTYPE? (Um DOCTYPE com definições dentro conta como
// SVG para ser recusado com a mensagem certa.)
function pareceSvg(t) {
  let s = t;
  for (let i = 0; i < 50; i++) {
    s = s.replace(/^\s+/, '');
    if (s.startsWith('<?xml')) { const k = s.indexOf('?>'); if (k < 0) return false; s = s.slice(k + 2); continue; }
    if (s.startsWith('<!--')) { const k = s.indexOf('-->'); if (k < 0) return false; s = s.slice(k + 3); continue; }
    if (/^<!DOCTYPE/i.test(s)) { const k = s.indexOf('>'); if (k < 0) return false; if (s.slice(0, k).includes('[')) return true; s = s.slice(k + 1); continue; }
    break;
  }
  return /^<svg[\s>/]/i.test(s);
}
function tipoDoConteudo(bytes) {
  const em = (sig, de = 0) => bytes.length >= de + sig.length && sig.every((v, i) => bytes[de + i] === (typeof v === 'string' ? v.charCodeAt(0) : v));
  if (em([0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (em([0xff, 0xd8, 0xff])) return 'jpg';
  if (em(['R', 'I', 'F', 'F']) && em(['W', 'E', 'B', 'P'], 8)) return 'webp';
  if (em(['%', 'P', 'D', 'F', '-'])) return 'pdf';
  if (bytes.length > 12 && (em([0x00, 0x01, 0x00, 0x00]) || em(['t', 'r', 'u', 'e']))) return 'ttf';
  if (bytes.length > 12 && em(['O', 'T', 'T', 'O'])) return 'otf';
  const t = textoDoSvg(bytes);
  return t !== null && pareceSvg(t) ? 'svg' : null;
}
// SVG que pode rodar código ou buscar coisa de fora é recusado: script (com qualquer prefixo), atributo on…=, foreignObject,
// elementos que embutem ou animam, entidade, folha de estilo de fora, javascript:, @import, url() e href que não sejam
// "#…" de dentro do próprio desenho, barra invertida (escape de CSS) e, dentro de <style> (com ou sem prefixo) e de
// atributos style e de pintura, referência de caractere (&#…) e comentário (<!--), com que se escreve "@import" ou "url("
// sem as letras aparecerem.
// A DEFESA DE VERDADE contra recurso de fora é a política com sandbox com que todo SVG é servido (servirArquivo): esta lista
// é uma conferência a mais e tem furos conhecidos (o que ela não conhecer passa). Nada daqui substitui a política.
// Contra tempo quadrático (um SVG feito para travar este servidor de uma linha só): a conferência roda sobre uma cópia com
// os espaços juntados (cada sequência de espaços vira um só), e nenhuma expressão tem repetição dentro de repetição nem
// varre até o fim do texto a partir de cada ocorrência (a do DOCTYPE para no próximo "<").
const PROIBIDOS_NO_SVG = [
  /<!ENTITY/i, /<!DOCTYPE[^<>[]*\[/i, /<\?xml-stylesheet/i,
  /<\s?\/?\s?(?:[\w.-]+:)?(?:script|foreignobject|iframe|frame|embed|object|applet|portal|handler|listener|set|animate[\w-]*|discard|link|meta|base)(?![\w.-])/i,
  /(?<![\w.-])on[a-z]+\s?=/i, /(?:java|vb)script\s?:/i, /@import/i, /image-set\s?\(/i, /url\s?\(\s?(?!['"]?\s?#)/i, /(?<![\w.-])src\s?=/i,
];
// Os trechos de CSS do SVG: UMA região só, da primeira abertura de <style> (com ou sem prefixo, como <svg:style>) até o
// ÚLTIMO fecho de style do texto (sem fecho depois dela: até o fim), porque um <style> dentro de outro ou um "</style>"
// falso dentro de CDATA fecharia antes a janela e esconderia o resto do CSS; e o valor de cada atributo style e de pintura
// (fill, stroke, mask, filter, clip-path, marker…, cursor, com ou sem prefixo), que aceitam url(). Tudo procurado direto no
// texto (já com os espaços juntados), com /i: nada de toLowerCase, que muda o tamanho de algumas letras (o İ vira dois
// caracteres) e deslocaria as posições. Cada busca anda para a frente, sem voltar: o tempo é linear.
const ABRE_ESTILO = /<(?:[\w.-]+:)?style(?![\w.-])/gi;
const FECHA_ESTILO = /<\/(?:[\w.-]+:)?style(?![\w.-])/gi;
const ATRIBUTO_DE_ESTILO = /(?<![\w.-])(?:[\w.-]+:)?(?:style|fill|stroke|mask|filter|clip-path|marker-start|marker-mid|marker-end|marker|cursor)\s?=\s?(["'])/gi;
function trechosDeEstilo(t) {
  const trechos = [];
  const abre = new RegExp(ABRE_ESTILO.source, 'gi');
  const primeira = abre.exec(t);
  if (primeira) {
    const fecha = new RegExp(FECHA_ESTILO.source, 'gi');
    fecha.lastIndex = abre.lastIndex;
    let ultimo = -1;
    for (let f = fecha.exec(t); f; f = fecha.exec(t)) ultimo = f.index;
    trechos.push(t.slice(abre.lastIndex, ultimo < 0 ? t.length : ultimo));
  }
  const atributo = new RegExp(ATRIBUTO_DE_ESTILO.source, 'gi');
  let m;
  while ((m = atributo.exec(t))) {
    const fim = t.indexOf(m[1], atributo.lastIndex);
    trechos.push(t.slice(atributo.lastIndex, fim < 0 ? t.length : fim));
    if (fim < 0) break;
    atributo.lastIndex = fim + 1;
  }
  return trechos;
}
function conferirSvg(bytes) {
  const original = textoDoSvg(bytes);
  const recusar = () => { throw recusa(400, 'Esta imagem tem uma parte que eu não consigo abrir com segurança. Salve a imagem de novo, ou use outra imagem.'); };
  if (original === null || original.includes(BARRA)) recusar();
  const t = original.replace(/\s+/g, ' ');
  if (PROIBIDOS_NO_SVG.some((re) => re.test(t))) recusar();
  if (trechosDeEstilo(t).some((s) => s.includes('&#') || s.includes('<!--'))) recusar();
  const href = /(?<![\w.-])(?:[\w.-]+:)?href\s?=\s?(["']?)/gi;
  let m;
  while ((m = href.exec(t))) { if (!m[1] || t[href.lastIndex] !== '#') recusar(); }
}

// A pasta de destino fica dentro da Fábrica sem nenhum atalho (junção ou link) no caminho: o arquivo de uma empresa nunca
// cai na pasta de outra. O que ainda não existe será criado de verdade.
function semAtalho(r, alvo) {
  const base = path.resolve(r);
  const rel = path.relative(base, alvo);
  if (!rel || rel.split(path.sep)[0] === '..' || path.isAbsolute(rel)) return false;
  let atual = base;
  for (const parte of rel.split(path.sep)) {
    atual = path.join(atual, parte);
    let st;
    try { st = fs.lstatSync(atual); } catch (e) { return e.code === 'ENOENT'; }
    if (st.isSymbolicLink() || !st.isDirectory()) return false;
  }
  let real;
  let raizReal;
  try { real = fs.realpathSync.native(alvo); raizReal = fs.realpathSync.native(base); } catch { return false; }
  return path.resolve(real).toLowerCase() === path.join(raizReal, rel).toLowerCase();
}

// Grava `bytes` com um nome novo (<base>[-N].<ext>), sempre com 'wx': nunca por cima de outro arquivo.
function gravarNovo(pasta, base, ext, bytes) {
  for (let k = 1; k < 10000; k++) {
    const nome = `${base}${k === 1 ? '' : `-${k}`}.${ext}`;
    try { fs.writeFileSync(path.join(pasta, nome), bytes, { flag: 'wx' }); return nome; } catch (e) { if (e.code !== 'EEXIST') throw e; }
  }
  throw recusa(409, 'Não consegui dar um nome novo a este arquivo. Tente de novo.');
}

// ---- As gravações ----

function conferirNomeDaEmpresa(n) {
  if (typeof n !== 'string' || n.trim() === '') throw recusa(400, 'Escreva o nome da marca ou do cliente.');
  if (temQuebra(n) || temInvisivel(n)) throw recusa(400, 'O nome não pode ter quebra de linha nem caracteres invisíveis. Digite o nome de novo.');
  const t = n.trim();
  if ([...t].length > LIMITE_NOME_EMPRESA) throw recusa(400, `Use um nome de até ${LIMITE_NOME_EMPRESA} letras.`);
  if (t.endsWith(BARRA)) throw recusa(400, 'O nome não pode terminar com barra invertida. Tire a barra do fim do nome.');
  return t;
}

// Cria a empresa com o código sugerido pelo nome; se ele já existe (ou a pasta já existe, ou é o reservado da pasta
// antiga), -2, -3... Nome sem nada que vire código: "cliente" ou "empresa".
function criarEmpresa(r, nome, para) {
  let base = empresaMod.sugerirCodigo(nome);
  if (!CODIGO_EMPRESA.test(base)) base = para === 'clientes' ? 'cliente' : 'empresa';
  const usados = new Set(empresaMod.listar(r).map((e) => e.codigo));
  for (let k = 1; k < 1000; k++) {
    const sufixo = k === 1 ? '' : `-${k}`;
    const codigo = base.slice(0, 41 - sufixo.length).replace(/-+$/, '') + sufixo;
    if (!CODIGO_EMPRESA.test(codigo) || codigo === 'principal' || usados.has(codigo) || fs.existsSync(path.join(r, 'empresas', codigo))) continue;
    try { return empresaMod.criar(codigo, nome, r); } catch (e) { if (e.code === 'EMPRESA_EXISTE') continue; throw e; }
  }
  throw recusa(409, 'Não encontrei um código livre para esta empresa. Tente outro nome.');
}

async function comecar(r, b, ctx, { liberar }) {
  const nome = conferirNomeDaEmpresa(b.nome);
  if (!PARA.includes(b.para)) throw recusa(400, 'Diga para quem você vai criar: a sua marca ou os seus clientes.');
  const uso = lerEstado(arqUso(r), usoValido); // quebrado: para aqui, nada criado
  await liberar();
  const nova = criarEmpresa(r, nome, b.para);
  ctx.codigo = nova.codigo;
  if (!uso || uso.para !== b.para) gravarEstado(arqUso(r), { para: b.para });
  return { codigo: nova.codigo, nome: nova.nome };
}

async function gravarIntencao(r, b, ctx, { liberar }) {
  const tudo = b.tudo === undefined ? false : b.tudo;
  if (typeof tudo !== 'boolean') throw recusa(400, FORMATO);
  const escolha = 'Escolha o que você quer criar: vídeo, carrossel, post único ou tudo.';
  if (b.quer !== undefined && (!Array.isArray(b.quer) || b.quer.some((q) => typeof q !== 'string' || !QUER.includes(q)) || new Set(b.quer).size !== b.quer.length)) throw recusa(400, escolha);
  const quer = tudo ? [...QUER] : Array.isArray(b.quer) ? [...b.quer] : [];
  if (!quer.length) throw recusa(400, escolha);
  const c = empresaMod.caminhos(ctx.codigo, r);
  lerEstado(c.intencao); // quebrado: para aqui, nunca é regravado
  await liberar();
  const intencao = { quer, tudo };
  gravarEstado(c.intencao, intencao);
  return { intencao };
}

function avisarMarca(opcoes, r, codigo) {
  try { opcoes.aposMarca(r, codigo); } catch (e) { console.error('Depois da marca:', e); }
}

// As entradas da marca no histórico da empresa, com a anotação das letras copiadas ao lado de cada uma (.copias.json), para a
// reversão tirar as duas (null quando a pasta ainda não existe).
function historicoDaMarca(c) {
  try { return fs.readdirSync(c.historico).filter((n) => /^marca-.*(\.yaml|\.copias\.json)$/.test(n)); } catch { return null; }
}
// A marca que acabou de nascer do estilo volta atrás por inteiro (a escolha do estilo falhou depois dela): desfazerMarca
// tira o marca.yaml; as entradas de histórico que esta gravação e esse desfazer criaram saem (e a pasta, se nasceu agora e
// ficou vazia); as letras, licenças e pastas que a cópia criou saem com desfazerCopia. Nada que já estava é tocado.
function voltarMarcaNascida(r, codigo, c, { historicoAntes, criados }) {
  try { escrever.desfazerMarca(r, codigo); } catch (e) { console.error('Não consegui desfazer a marca do estilo:', e); return; }
  const antes = new Set(historicoAntes || []);
  for (const nome of historicoDaMarca(c) || []) {
    if (!antes.has(nome)) { try { fs.unlinkSync(path.join(c.historico, nome)); } catch (e) { console.error('Não consegui tirar a entrada de histórico:', e); } }
  }
  if (historicoAntes === null) { try { fs.rmdirSync(c.historico); } catch { /* ficou alguma coisa: fica */ } }
  try { escrever.desfazerCopia(criados); } catch (e) { console.error('Não consegui tirar as letras copiadas:', e); }
}

// "Usar este estilo" (decisão D1): escolhe na hora; sem marca e com comMarca, antes grava a marca que nasce do estilo
// (letras copiadas para a pasta da empresa; se a escolha falhar, a marca volta); depois grava o pedido "usar-estilo" já
// aplicado, para o agente começar o primeiro trabalho. O pedido só vale para estilo do catálogo.
async function usarEstilo(r, b, ctx, { liberar, opcoes }) {
  const origem = b.origem === undefined ? 'catalogo' : b.origem;
  if (!escolhaMod.ORIGENS.includes(origem)) throw recusa(400, 'Não entendi de onde vem este estilo. Escolha um estilo da lista.');
  if (typeof b.estilo !== 'string' || b.estilo.trim() === '') throw recusa(400, 'Escolha um estilo da lista.');
  if (b.comMarca !== undefined && typeof b.comMarca !== 'boolean') throw recusa(400, FORMATO);
  const codigo = ctx.codigo;
  const c = empresaMod.caminhos(codigo, r);
  escolhaMod.ler(r, codigo); // estilo.json quebrado: para aqui, nada gravado
  const criarMarca = b.comMarca === true && !ehArquivo(c.marca);
  if (criarMarca && origem === 'proprio') throw recusa(400, 'A marca que nasce de um estilo da sua empresa é feita no Claude. Defina a marca antes, ou escolha um estilo da biblioteca.');
  await liberar();
  let nascida = null;
  if (criarMarca) {
    const historicoAntes = historicoDaMarca(c);
    const { criados } = escrever.gravarDoEstilo(r, codigo, b.estilo);
    nascida = { historicoAntes, criados };
  }
  const marcaCriada = nascida !== null;
  try {
    escolhaMod.usar(r, codigo, b.estilo, { origem });
  } catch (e) {
    if (nascida) voltarMarcaNascida(r, codigo, c, nascida);
    throw e;
  }
  let avisado = false;
  if (origem === 'catalogo') {
    try { pedidosMod.gravar(r, codigo, { tipo: 'usar-estilo', estilo: b.estilo, aplicado: true }); avisado = true; } catch (e) { console.error('Não consegui guardar o pedido de usar o estilo:', e); }
  }
  if (marcaCriada) avisarMarca(opcoes, r, codigo);
  return { estilo: estiloEscolhido(r, codigo), marcaCriada, mensagem: avisado ? pedidosMod.MENSAGEM : 'Pronto. O estilo foi escolhido.' };
}

async function desfazerEstilo(r, b, ctx, { liberar }) {
  await liberar();
  escolhaMod.desfazer(r, ctx.codigo);
  return { estilo: estiloEscolhido(r, ctx.codigo) };
}

// Uma letra da marca: { lista: '<arquivo da lista de letras>' } ou { enviada: '<nome que /api/arquivo deu>' }; a de
// destaque também pode ficar vazia ('' ou null: a marca com duas vozes). A da lista é copiada para a pasta da empresa,
// com a licença, pelo escrever.gravarMarca (o "Desfazer" tira a cópia).
function letraDaMarca(c, papel, v) {
  if (papel === 'acento' && (v === '' || v === null)) return '';
  if (!ehObjeto(v) || Object.keys(v).length !== 1) throw recusa(400, 'Escolha a letra da lista ou envie o arquivo da letra.');
  if (Object.prototype.hasOwnProperty.call(v, 'lista')) {
    if (!nomeSimples(v.lista) || !arquivosDaLista().has(v.lista)) throw recusa(400, 'Esta letra não está na lista de letras da Fábrica. Escolha uma da lista.');
    return path.join(PASTA_LETRAS, v.lista);
  }
  if (Object.prototype.hasOwnProperty.call(v, 'enviada')) return arquivoEnviado(path.join(c.pastaMarca, 'fontes'), v.enviada, 'Não encontrei a letra enviada. Envie o arquivo de novo.');
  throw recusa(400, 'Escolha a letra da lista ou envie o arquivo da letra.');
}

async function gravarMarcaDoPainel(r, b, ctx, { liberar, opcoes }) {
  const codigo = ctx.codigo;
  const c = empresaMod.caminhos(codigo, r);
  const origem = b.origem === undefined ? 'pessoa' : b.origem;
  if (!ORIGENS_DO_PAINEL.includes(origem)) throw recusa(400, 'Não entendi de onde vem esta marca. Tente de novo pela tela.');
  const valores = {};
  if (b.cores !== undefined) {
    if (!ehObjeto(b.cores) || !Object.keys(b.cores).length) throw recusa(400, 'As cores vieram num formato que não entendi.');
    valores.cores = {};
    for (const papel of Object.keys(b.cores)) {
      if (!PAPEIS_COR.includes(papel)) throw recusa(400, `O papel de cor ${trecho(papel)} não existe. Os papéis são: fundo escuro, fundo claro, destaque e apoio.`);
      if (typeof b.cores[papel] !== 'string' || !COR.test(b.cores[papel])) throw recusa(400, 'O código da cor não serve: use # seguido de seis números ou letras de A a F.');
      valores.cores[papel] = b.cores[papel];
    }
  }
  if (b.fontes !== undefined) {
    if (!ehObjeto(b.fontes) || !Object.keys(b.fontes).length) throw recusa(400, 'As letras vieram num formato que não entendi.');
    valores.fontes = {};
    for (const papel of Object.keys(b.fontes)) {
      if (!PAPEIS_FONTE.includes(papel)) throw recusa(400, `O papel de letra ${trecho(papel)} não existe. Os papéis são: letra principal, letra dos rótulos e destaque.`);
      valores.fontes[papel] = letraDaMarca(c, papel, b.fontes[papel]);
    }
  }
  if (b.logo !== undefined) {
    valores.logo = b.logo === '' ? '' : arquivoEnviado(path.join(c.pastaMarca, 'logo'), b.logo, 'Não encontrei o logo enviado. Envie o arquivo de novo.');
  }
  if (!Object.keys(valores).length) throw recusa(400, 'Escolha as cores, as letras ou o logo da marca.');
  // Uma marca nova nasce inteira: as quatro cores e as letras de título e de texto (nada do exemplo fica nela).
  if (!ehArquivo(c.marca)) {
    const cores = valores.cores || {};
    const fontes = valores.fontes || {};
    if (!PAPEIS_COR.every((p) => cores[p]) || !fontes.principal || !fontes.mono) {
      throw recusa(400, 'Para criar a marca, escolha as quatro cores e as letras de título e de texto.');
    }
  }
  await liberar();
  escrever.gravarMarca(r, codigo, valores, { origem });
  avisarMarca(opcoes, r, codigo);
  return { marca: { definida: true, origem } };
}

async function desfazerMarcaDoPainel(r, b, ctx, { liberar, opcoes }) {
  const c = empresaMod.caminhos(ctx.codigo, r);
  await liberar();
  escrever.desfazerMarca(r, ctx.codigo);
  avisarMarca(opcoes, r, ctx.codigo);
  const definida = ehArquivo(c.marca);
  return { marca: { definida, origem: definida ? origemDaMarca(c.marca) : null } };
}

// O arquivo enviado: tipo conferido pelo conteúdo, limite por tipo, nome dado pelo servidor, gravado com 'wx' na pasta
// dele DESTA empresa. Devolve { nome } (nunca o caminho).
async function receberArquivo(r, b, ctx, { liberar }) {
  if (typeof b.tipo !== 'string' || !Object.prototype.hasOwnProperty.call(TIPOS_DE_ARQUIVO, b.tipo)) throw recusa(400, 'Não entendi que arquivo é este. Envie pela tela.');
  const def = TIPOS_DE_ARQUIVO[b.tipo];
  const bytes = decodificar(b.dados, def.limite);
  const tipo = tipoDoConteudo(bytes);
  if (!tipo || !def.aceita.includes(tipo)) throw recusa(400, def.recusa);
  if (tipo === 'svg') conferirSvg(bytes);
  const pasta = def.pasta(empresaMod.caminhos(ctx.codigo, r));
  const atalho = 'Não consegui guardar o arquivo na pasta desta empresa. Peça ajuda no Claude.';
  if (!semAtalho(r, pasta)) throw recusa(400, atalho);
  await liberar();
  if (!semAtalho(r, pasta)) throw recusa(400, atalho);
  fs.mkdirSync(pasta, { recursive: true });
  if (!semAtalho(r, pasta)) throw recusa(400, atalho);
  return { nome: gravarNovo(pasta, `${def.prefixo}-${carimboUtc(new Date())}Z`, tipo, bytes) };
}

// As rotas de gravação do caminho: os campos aceitos (formato fechado), se o corpo diz a empresa, o limite do corpo e quem faz.
const ROTAS_DO_CAMINHO = {
  '/api/comecar': { campos: ['nome', 'para'], comEmpresa: false, fazer: comecar },
  '/api/intencao': { campos: ['empresa', 'quer', 'tudo'], fazer: gravarIntencao },
  '/api/estilo': { campos: ['empresa', 'estilo', 'origem', 'comMarca'], fazer: usarEstilo },
  '/api/estilo/desfazer': { campos: ['empresa'], fazer: desfazerEstilo },
  '/api/marca': { campos: ['empresa', 'cores', 'fontes', 'logo', 'origem'], fazer: gravarMarcaDoPainel },
  '/api/marca/desfazer': { campos: ['empresa'], fazer: desfazerMarcaDoPainel },
  '/api/arquivo': { campos: ['empresa', 'tipo', 'dados'], limite: LIMITE_ARQUIVO, grandeDemais: 'Este arquivo é grande demais: o maior aceito é o manual da marca, de 30 MB.', fazer: receberArquivo },
};

// Erro de uma rota do caminho em português simples, sem caminho de arquivo; o detalhe técnico fica no console.
function responderDoCaminho(res, e, codigo, rota) {
  if (e && e.recusaDoPedido) return jsonRes(res, Number.isInteger(e.status) ? e.status : 400, { ok: false, erro: e.message }, codigo);
  if (e && e.code === 'JSON_INVALIDO') return jsonRes(res, 500, { ok: false, erro: 'Um arquivo desta empresa não está em um formato válido. Nada foi alterado; peça ajuda no Claude para corrigir.' }, codigo);
  console.error(`Caminho do usuário (${rota}):`, e);
  return jsonRes(res, 500, { ok: false, erro: 'Não consegui terminar agora. Tente de novo.' }, codigo);
}

function rotaDoCaminho(r, req, res, opcoes, rota) {
  const def = ROTAS_DO_CAMINHO[rota];
  lerCorpo(req, res, async (err, b) => {
    if (err || !ehObjeto(b)) return jsonRes(res, 400, { ok: false, erro: 'Pedido ilegível.' });
    const ctx = { codigo: null };
    try {
      if (Object.keys(b).some((k) => !def.campos.includes(k))) throw recusa(400, FORMATO);
      if (def.comEmpresa !== false) {
        ctx.codigo = empresaDoCorpo(r, b);
        if (ctx.codigo === null) throw recusa(400, 'Escolha a empresa no seletor.');
      }
      const liberar = () => liberarGravacao(opcoes.antesDeGravar, { rota, empresa: ctx.codigo });
      const corpo = await def.fazer(r, b, ctx, { liberar, opcoes });
      return jsonRes(res, 200, { ok: true, ...corpo }, ctx.codigo);
    } catch (e) {
      return responderDoCaminho(res, e, ctx.codigo, rota);
    }
  }, def.limite || LIMITE_PEDIDO, def.grandeDemais);
}

// ---- Leituras (GET /api/...) ----

function lerLista(arq, padrao, tipo) {
  const v = lerJson(arq, padrao);
  if (tipo === 'lista' ? !Array.isArray(v) : (v === null || typeof v !== 'object' || Array.isArray(v))) {
    throw Object.assign(new Error('formato'), { code: 'JSON_INVALIDO', arquivo: arq });
  }
  return v;
}

const rotasGet = {
  // Quem responde: a pasta da Fábrica (é o que o "garantir" confere) e a empresa do pedido. Esta rota nunca recusa
  // por falta de escolha: sem empresa escolhida ela só diz o nome padrão.
  '/api/quem': (r, url, ctx) => {
    const pedida = empresaDaUrl(url);
    try {
      ctx.codigo = empresaDoPedido(r, pedida);
      return { raiz: r, nome: dadosEmpresa(r, ctx.codigo).nome };
    } catch (e) {
      // Sem empresa no pedido esta rota NUNCA falha, qualquer que seja o problema (várias empresas e nenhuma escolhida,
      // ativa.json ou indice.json com defeito): é por ela que o "garantir" reconhece o servidor desta pasta; se ela
      // falhasse, cada "garantir" subiria mais um servidor.
      if (pedida === undefined) { ctx.codigo = null; return { raiz: r, nome: NOME_PADRAO }; }
      throw e;
    }
  },
  // A marca da empresa do pedido: nome, cores e letras que a tela usa.
  '/api/empresa': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    return dadosEmpresa(r, ctx.codigo);
  },
  // As empresas que o seletor mostra. Só código e nome: nada do jeito como a pasta foi montada.
  '/api/empresas': (r, url, ctx) => {
    const lista = empresaMod.listar(r);
    let ativa = null;
    let aviso;
    try {
      ativa = empresaMod.ativa(r);
    } catch (e) {
      if (e.code !== 'EMPRESA_NAO_ESCOLHIDA') aviso = 'Não consegui saber qual é a empresa ativa do agente.';
    }
    ctx.codigo = ativa;
    const corpo = { ativa, empresas: lista.map((e) => ({ codigo: e.codigo, nome: dadosEmpresa(r, e.codigo).nome })) };
    if (aviso) corpo.aviso = aviso;
    return corpo;
  },
  // O catálogo de estilos da biblioteca para a empresa do pedido (lido a cada pedido; a empresa vai na resposta).
  '/api/biblioteca': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    return biblioteca.catalogo(r, ctx.codigo);
  },
  // Como estão as prévias na marca da empresa do pedido (só lê).
  '/api/previas-marca': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    if (ctx.codigo === null) throw recusa(400, 'Escolha a empresa no seletor.');
    return require('../../08-FERRAMENTAS/biblioteca/fila-marca').estado(r, ctx.codigo);
  },
  // O caminho do usuário da empresa do pedido: em que passo ela está (só lê; sem empresa nenhuma: "para-quem").
  '/api/caminho': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    return caminhoDaEmpresa(r, ctx.codigo);
  },
  // O andamento dos pedidos da empresa do pedido (só lê).
  '/api/pedidos': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    return pedidosDaEmpresa(r, ctx.codigo);
  },
  // A lista de letras livres (é do modelo, não de uma empresa: ?empresa= é opcional e, se vier, é conferido).
  '/api/letras': (r, url, ctx) => {
    const pedida = empresaDaUrl(url);
    ctx.codigo = pedida === undefined ? null : empresaDoPedido(r, pedida);
    return letrasLivres();
  },
  '/api/paineis': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    const c = caminhos(r, ctx.codigo);
    return { laboratorio: fs.existsSync(c.pecas), cronograma: fs.existsSync(c.posts) };
  },
  // Os dados dos dois painéis da empresa do pedido (nunca os de outra). `publicacoes` é a pasta das peças aprovadas
  // dessa empresa, relativa à pasta da Fábrica e com "/": a tela monta com ela o destino de uma aprovação.
  '/api/dados': (r, url, ctx) => {
    ctx.codigo = empresaDoPedido(r, empresaDaUrl(url));
    const c = caminhos(r, ctx.codigo);
    const pecas = lerLista(c.pecas, [], 'lista');
    const aprovacoes = lerLista(c.aprovacoes, {}, 'objeto');
    const posts = lerLista(c.posts, [], 'lista');
    return {
      pecas, aprovacoes, posts, config: lerLista(c.config, CONFIG_PADRAO, 'objeto'),
      publicacoes: path.relative(r, c.publicacoes).split(path.sep).join('/'),
      // as artes de cada post (imagens, vídeo e prévia), só arquivos desta empresa que existem (midias.js)
      midias: require('./midias').midiasDosPosts(r, ctx.codigo, { posts, pecas, aprovacoes }),
    };
  },
};

// Cada rota recebe `ctx` e anota nele a empresa assim que a resolve: se der erro depois, a resposta já diz de qual empresa era.
function rotaGet(r, url, res) {
  const ctx = { codigo: null };
  try {
    const corpo = rotasGet[url.split('?')[0]](r, url, ctx);
    return jsonRes(res, 200, corpo, ctx.codigo);
  } catch (e) {
    return responderErro(res, e, ctx.codigo);
  }
}

// ---- Baixar as imagens de uma arte num .zip (botão "Baixar as N imagens" do Cronograma) ----
// GET /api/baixar-artes?empresa=<codigo>&post=<id do post>&arte=<id da arte, como em /api/dados midias>
// Devolve o .zip (imagens com nome legível e a legenda) para o navegador baixar. Só arquivos da empresa do pedido.
function rotaBaixarArtes(r, url, res) {
  let codigo = null;
  try {
    codigo = empresaDoPedido(r, empresaDaUrl(url));
    const q = new URLSearchParams(url.split('?')[1] || '');
    const postId = q.get('post');
    const arteId = q.get('arte');
    if (!postId || !arteId || q.getAll('post').length > 1 || q.getAll('arte').length > 1) throw recusa(400, 'Diga o post e a arte.');
    const c = caminhos(r, codigo);
    const listas = { posts: lerLista(c.posts, [], 'lista'), pecas: lerLista(c.pecas, [], 'lista'), aprovacoes: lerLista(c.aprovacoes, {}, 'objeto') };
    const zip = require('./midias').zipDaArte(r, codigo, listas, postId, arteId);
    if (!zip) throw recusa(404, 'Não encontrei as imagens desta arte. Recarregue a página.');
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': zip.dados.length,
      'Content-Disposition': `attachment; filename="artes.zip"; filename*=UTF-8''${encodeURIComponent(zip.nome)}`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.end(zip.dados);
  } catch (e) {
    return responderErro(res, e, codigo);
  }
}

// ---- Arquivos estáticos ----

// Fora do alcance: qualquer segmento começando com ponto (.git, .servidor.json, ..), as sessões de navegador
// e as dependências. O disco do Windows não diferencia maiúscula de minúscula, ignora ponto e espaço no fim do
// nome e tem nomes curtos (8.3, como GIT~1 para .git, sem o ponto do começo): por isso a comparação é sem
// diferença de maiúsculas, olha o nome já sem ponto/espaço no fim e recusa qualquer nome no formato curto.
// Dois pontos no nome (fluxos alternativos do NTFS, como "_sessoes::$INDEX_ALLOCATION") também ficam de fora.
function segmentoProibido(p) {
  const nome = p.replace(/[. ]+$/, '').toLowerCase();
  return p.startsWith('.') || nome === '' || p.includes(':') || /^[^.]*~\d+(\.[^.]*)?$/.test(nome) ||
    nome === '_sessoes' || nome === 'node_modules';
}
const segmentosProibidos = (partes) => partes.some(segmentoProibido);

// Pedido parcial (cabeçalho Range): o navegador pede o vídeo aos pedaços para tocar e avançar. Só um intervalo, em
// bytes: "bytes=a-b", "bytes=a-" (de a até o fim) ou "bytes=-n" (os últimos n). Devolve null sem Range (vai o arquivo
// inteiro), { ini, fim } (inclusivos) para um intervalo que cabe no arquivo e false para um mal escrito ou fora dele.
function intervaloPedido(cabecalho, tamanho) {
  if (cabecalho === undefined) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(cabecalho).trim());
  if (!m || (m[1] === '' && m[2] === '')) return false;
  const a = m[1] === '' ? null : Number(m[1]);
  const b = m[2] === '' ? null : Number(m[2]);
  if ((a !== null && !Number.isSafeInteger(a)) || (b !== null && !Number.isSafeInteger(b))) return false;
  let ini; let fim;
  if (a === null) { // sufixo: os últimos b bytes
    if (b === 0) return false;
    ini = Math.max(0, tamanho - b);
    fim = tamanho - 1;
  } else {
    if (b !== null && b < a) return false;
    ini = a;
    fim = b === null ? tamanho - 1 : Math.min(b, tamanho - 1);
  }
  if (tamanho === 0 || ini >= tamanho) return false;
  return { ini, fim };
}

function servirArquivo(r, req, res) {
  let rota;
  try { rota = decodeURIComponent(req.url.split('?')[0].split('#')[0]); } catch { rota = null; }
  if (rota === null || rota.includes('\0')) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('400 Pedido inválido'); }
  const partes = rota.split(/[\\/]+/).filter((p) => p !== '');
  let completo = path.join(r, ...partes);
  const dentro = completo === r || completo.startsWith(r + path.sep);
  if (!dentro || segmentosProibidos(partes)) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('403 Proibido'); }
  if (rota.endsWith('/') && fs.existsSync(path.join(completo, 'index.html'))) completo = path.join(completo, 'index.html');
  fs.stat(completo, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404 Arquivo não encontrado: ' + rota); }
    const faixa = intervaloPedido(req.headers.range, st.size);
    if (faixa === false) {
      res.writeHead(416, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Range': `bytes */${st.size}`, 'Accept-Ranges': 'bytes' });
      return res.end('416 Intervalo fora do arquivo');
    }
    const cabecalhos = { 'Content-Type': MIME_TYPES[path.extname(completo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    // Arquivo de empresa (e os lugares da pasta antiga onde o painel guarda o que a pessoa envia): o navegador nunca
    // adivinha outro tipo. SVG, de onde for: servido sem poder rodar script nem buscar nada.
    const p0 = (partes[0] || '').toLowerCase();
    if (p0 === 'empresas' || p0 === '06-marca-e-fotos' || (p0 === '04-laboratorio-de-design' && (partes[1] || '').toLowerCase() === 'referencias')) cabecalhos['X-Content-Type-Options'] = 'nosniff';
    if (path.extname(completo).toLowerCase() === '.svg') cabecalhos['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
    if (faixa === null) {
      res.writeHead(200, { ...cabecalhos, 'Content-Length': st.size });
      // pipeline (e não pipe): se o navegador desiste no meio (avançar o vídeo, tirar o mouse), o arquivo é fechado.
      if (req.method === 'HEAD') return res.end();
      return pipeline(fs.createReadStream(completo), res, () => {});
    }
    res.writeHead(206, { ...cabecalhos, 'Content-Range': `bytes ${faixa.ini}-${faixa.fim}/${st.size}`, 'Content-Length': faixa.fim - faixa.ini + 1 });
    if (req.method === 'HEAD') return res.end();
    pipeline(fs.createReadStream(completo, { start: faixa.ini, end: faixa.fim }), res, () => {});
  });
}

// ---- O servidor ----

// A tela que abre primeiro para a empresa: o laboratório se ele existe; senão o cronograma, se existe.
function paginaInicial(r, codigo) {
  const c = caminhos(r, codigo);
  if (fs.existsSync(c.pecas)) return '/_fabrica/paineis/laboratorio.html';
  if (fs.existsSync(c.posts)) return '/_fabrica/paineis/cronograma.html';
  return '/_fabrica/paineis/laboratorio.html';
}

const PAGINA_COMECAR = '/_fabrica/paineis/comecar.html';

// A empresa ainda está no começo do caminho: nasceu depois que o caminho começou nesta pasta (o painel já gravou
// empresas/uso.json), ainda não disse o que quer criar e não tem peça nem post. A pasta antiga nunca está.
// Qualquer dúvida (arquivo com defeito) vale "não": abre como sempre.
function aindaNoComeco(r, codigo) {
  try {
    const entrada = empresaMod.listar(r).find((e) => e.codigo === codigo);
    if (!entrada || entrada.disposicao !== 'gaveta' || !fs.existsSync(arqUso(r))) return false;
    if (fs.existsSync(empresaMod.caminhos(codigo, r).intencao)) return false;
    const c = caminhos(r, codigo);
    return !fs.existsSync(c.pecas) && !fs.existsSync(c.posts);
  } catch { return false; }
}

// "/" leva à tela inicial. Com ?empresa= a empresa vai junto no endereço; sem empresa que dê para resolver (várias e
// nenhuma escolhida, pedido inválido), vai para o laboratório e a própria tela pede a escolha no seletor.
// "Começar" (passos 1 e 2 do caminho) abre só na pasta sem empresa nenhuma, ou para a empresa que ainda está no começo
// do caminho (aindaNoComeco); a pasta antiga e as empresas com dados abrem como sempre. Só lê: nada é gravado.
function destinoInicial(r, url) {
  try {
    const pedida = empresaDaUrl(url);
    let vazia = false;
    try { vazia = empresaMod.listar(r).length === 0; } catch { /* lista com defeito: empresaDoPedido diz o problema */ }
    if (vazia) return PAGINA_COMECAR;
    const codigo = empresaDoPedido(r, pedida);
    const comeco = codigo !== null && aindaNoComeco(r, codigo);
    const pagina = comeco ? PAGINA_COMECAR : paginaInicial(r, codigo);
    // Começar vai sempre com a empresa que a regra escolheu (sem ela, a tela escolheria pela ordem dela, que pode ser
    // outra empresa: a guardada no navegador)
    return pagina + (pedida !== undefined || comeco ? '?empresa=' + encodeURIComponent(codigo) : '');
  } catch (e) {
    if (e.recusaDoPedido) return '/_fabrica/paineis/laboratorio.html';
    throw e;
  }
}

// ---- A trava do modelo ----
// O mesmo que `node _fabrica/core/atualizar.js trava --raiz <r>`: 0 = pode gravar; 3 = esta pasta é o repositório-modelo
// com envio habilitado (gravar aqui e enviar mudaria o modelo). Num processo filho assíncrono (o servidor não para).
// Devolve o código de saída (null se nem rodou).
function travaDoModelo(r) {
  return new Promise((resolve) => {
    execFile(process.execPath, [path.join(RAIZ_CODIGO, '_fabrica', 'core', 'atualizar.js'), 'trava', '--raiz', r], { windowsHide: true, timeout: 30000 },
      (err) => resolve(!err ? 0 : Number.isInteger(err.code) ? err.code : null));
  });
}
// O gancho antesDeGravar com a trava: 3 recusa (409), outro código que não 0 também recusa (não deu para conferir).
function ganchoDaTrava(r, trava, depois) {
  return async (pedido) => {
    const codigo = await trava(r);
    if (codigo === 3) throw Object.assign(new Error('Esta pasta é o modelo da Fábrica; nada foi gravado.'), { status: 409 });
    if (codigo !== 0) throw Object.assign(new Error('Não consegui conferir esta pasta agora; nada foi gravado. Tente de novo.'), { status: 500 });
    if (typeof depois === 'function') await depois(pedido);
  };
}

// `opcoes.lancarTrabalhador`: quem lança as prévias na marca em segundo plano (trocável nos testes, para não subir processo).
// `opcoes.antesDeGravar`: gancho opcional chamado antes de gravar nas prévias na marca (veja rotaPreviasMarca).
// `opcoes.trava(raiz) -> código de saída`: a trava do modelo, rodada antes do gancho em TODA rota que grava (aprovar,
// desfazer, enviar ao cliente, pedido, prévias na marca e as do caminho do usuário).
// O servidor de verdade (escutar) usa travaDoModelo; sem `trava` (os testes), nada muda.
// `opcoes.aposMarca(raiz, codigo)`: chamado depois de toda gravação de marca pelo painel (padrão: apos-marca.js).
function criarServidor(r, opcoes = {}) {
  opcoes = opcoes || {};
  if (typeof opcoes.trava === 'function') opcoes = { ...opcoes, antesDeGravar: ganchoDaTrava(r, opcoes.trava, opcoes.antesDeGravar) };
  if (typeof opcoes.aposMarca !== 'function') opcoes = { ...opcoes, aposMarca: (raiz, codigo) => require('./apos-marca').depoisDaMarca(raiz, codigo, { lancar: opcoes.lancarTrabalhador }) };
  return http.createServer((req, res) => {
    if (!ehLocal(req.socket.remoteAddress)) return jsonRes(res, 403, { ok: false, erro: 'Só aceita pedidos deste computador.' });
    if (!hostLocal(req.headers.host) || !origemLocal(req.headers.origin)) return jsonRes(res, 403, { ok: false, erro: 'Endereço não aceito.' });
    const url = req.url.split('?')[0];

    if (req.method === 'POST' && (url === '/api/aprovar' || url === '/api/desfazer')) return rotaAprovacao(r, req, res, opcoes);
    if (req.method === 'POST' && url === '/api/enviar-cliente') return rotaEnvio(r, req, res, opcoes);
    if (req.method === 'POST' && url === '/api/pedido') return rotaPedido(r, req, res, opcoes);
    if (req.method === 'POST' && url === '/api/previas-marca') return rotaPreviasMarca(r, req, res, opcoes || {});
    if (req.method === 'POST' && Object.prototype.hasOwnProperty.call(ROTAS_DO_CAMINHO, url)) return rotaDoCaminho(r, req, res, opcoes, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('405 Método não aceito'); }

    if (url === '/api/baixar-artes') return rotaBaixarArtes(r, req.url, res);
    if (Object.prototype.hasOwnProperty.call(rotasGet, url)) return rotaGet(r, req.url, res);
    if (url === '/' || url === '') {
      let destino;
      try { destino = destinoInicial(r, req.url); } catch (e) { return responderErro(res, e, null); }
      res.writeHead(302, { Location: destino });
      return res.end();
    }
    return servirArquivo(r, req, res);
  });
}

// ---- Subir e garantir ----

function abrirNavegador(url) {
  if (process.platform === 'win32') exec(`start "" "${url}"`, { windowsHide: true });
  else if (process.platform === 'darwin') exec(`open "${url}"`);
  else exec(`xdg-open "${url}"`);
}

function argumentos(lista) {
  const a = { semNavegador: lista.includes('--sem-navegador'), porta: null };
  const i = lista.indexOf('--porta');
  if (i >= 0) {
    a.porta = Number(lista[i + 1]);
    if (!Number.isInteger(a.porta) || a.porta < 0 || a.porta > 65535) { console.error('Use --porta com um número de 0 a 65535 (0 = qualquer porta livre).'); process.exit(1); }
  }
  return a;
}

// Pergunta a um servidor quem ele é. Devolve { raiz, nome } ou null se não responde (ou não é o nosso).
function perguntarQuem(porta, tempo = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port: porta, path: '/api/quem', timeout: tempo }, (res) => {
      let corpo = '';
      res.on('data', (c) => { corpo += c; if (corpo.length > 1e5) req.destroy(); });
      res.on('end', () => { try { const j = JSON.parse(corpo); resolve(res.statusCode === 200 && j && typeof j.raiz === 'string' ? j : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

// Porta do servidor desta pasta que já está no ar, ou null. Confere a raiz: a porta anotada pode ter sido
// tomada por outro servidor (de outra Fábrica) depois que este caiu.
async function servidorNoAr(r) {
  let reg;
  try { reg = lerJson(arquivoServidor(r), null); } catch { return null; }
  if (!reg || !Number.isInteger(reg.porta)) return null;
  const quem = await perguntarQuem(reg.porta);
  return quem && mesmaRaiz(quem.raiz, r) ? reg.porta : null;
}

function escutar(r, portas) {
  return new Promise((resolve, reject) => {
    const tentar = (i) => {
      if (i >= portas.length) return reject(new Error('sem porta livre'));
      const srv = criarServidor(r, { trava: travaDoModelo });
      srv.once('error', (e) => { if (e.code === 'EADDRINUSE' || e.code === 'EACCES') tentar(i + 1); else reject(e); });
      srv.listen(portas[i], '127.0.0.1', () => resolve({ srv, porta: srv.address().port }));
    };
    tentar(0);
  });
}

async function subir(lista) {
  const r = raiz();
  try { require('../../08-FERRAMENTAS/biblioteca/cor-sugerida').limparAbandonadas(); } catch { /* fica para a próxima */ }
  const arg = argumentos(lista);
  const jaNoAr = await servidorNoAr(r);
  if (jaNoAr) {
    console.log(`O servidor desta pasta já está no ar em ${urlDaPorta(jaNoAr)}`);
    if (!arg.semNavegador) abrirNavegador(urlDaPorta(jaNoAr) + '/');
    return;
  }
  const portas = arg.porta !== null ? [arg.porta] : Array.from({ length: PORTA_FINAL - PORTA_INICIAL + 1 }, (_, i) => PORTA_INICIAL + i);
  let ligado;
  try { ligado = await escutar(r, portas); } catch {
    console.error(arg.porta ? `A porta ${arg.porta} não está livre.` : `Nenhuma porta livre de ${PORTA_INICIAL} a ${PORTA_FINAL}. Feche outros painéis abertos e tente de novo.`);
    process.exit(1);
  }
  const arq = arquivoServidor(r);
  gravarJson(arq, { porta: ligado.porta, raiz: r, pid: process.pid });
  const limpar = () => {
    try { const reg = JSON.parse(fs.readFileSync(arq, 'utf8')); if (reg.pid === process.pid) fs.unlinkSync(arq); } catch { /* já não existe */ }
  };
  process.on('exit', limpar);
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));
  ligado.srv.on('error', (e) => console.error('Erro no servidor:', e.message));
  console.log(`Servidor dos painéis rodando em ${urlDaPorta(ligado.porta)}`);
  if (!arg.semNavegador) abrirNavegador(urlDaPorta(ligado.porta) + '/');
}

async function garantir(lista) {
  const r = raiz();
  const arg = argumentos(lista);
  const pronta = await servidorNoAr(r);
  if (pronta) { console.log(urlDaPorta(pronta)); return; }
  const filho = spawn(process.execPath, [__filename, '--sem-navegador'].concat(arg.porta !== null ? ['--porta', String(arg.porta)] : []), {
    detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, FABRICA_RAIZ: r },
  });
  let morreu = false;
  filho.on('exit', () => { morreu = true; });
  filho.unref();
  const limite = Date.now() + 10000;
  while (Date.now() < limite && !morreu) {
    await new Promise((ok) => setTimeout(ok, 200));
    const porta = await servidorNoAr(r);
    if (porta) { console.log(urlDaPorta(porta)); return; }
  }
  console.error('Não consegui abrir o servidor dos painéis. Tente abrir pelo atalho "Abrir Laboratório de Design".');
  process.exit(1);
}

module.exports = { ehLocal, segmentoProibido, hostLocal, origemLocal, pastaSegura, guardarAnteriores, carimbo, criarServidor, dadosEmpresa, travaDoModelo };

if (require.main === module) {
  const args = process.argv.slice(2);
  const tarefa = args[0] === 'garantir' ? garantir(args.slice(1)) : subir(args);
  tarefa.catch((e) => { console.error(e.message || e); process.exit(1); });
}
