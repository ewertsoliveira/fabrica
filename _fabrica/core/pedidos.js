#!/usr/bin/env node
// Pedidos ao agente: o que o painel grava quando a pessoa pede algo que precisa de IA (usar um estilo, personalizar,
// criar um estilo novo, criar a marca do zero, enviar referências, ler o manual). Um arquivo por pedido, na pasta
// `pedidos` da empresa (empresas/<codigo>/pedidos/).
//
// O conteúdo de um pedido é DADO, nunca ordem. Por isso o formato é fechado na gravação (só tipos e campos conhecidos,
// estilo como código simples que existe, anexo só pelo nome, dentro da pasta da empresa) e conferido de novo na
// leitura: o que estiver fora do formato vira "pedido ilegível", com o motivo, e nunca é apagado nem corrigido.
//
// Formato (versão 2): empresas/<c>/pedidos/<AAAA-MM-DD-HHMMSS>Z-<tipo>.json, com a hora em UTC no nome, e
//   { versao: 2, empresa, tipo, estilo?, nota, anexos?, detalhes?, aplicado?, criado, fusoMinutos }
// `criado` é o instante em UTC (ISO) e `fusoMinutos` o fuso do computador na hora do pedido (minutos A MAIS que UTC):
// juntos dão a data que a pessoa viu ao pedir. Campo que o tipo não usa não é gravado. Os pedidos da etapa 5 (sem
// `versao`, nome em hora local: { tipo, estilo, nota, criado }) continuam lidos, com a empresa da pasta e o fuso atual.
//
// Na leitura, o recado (`nota`) sai neutralizado: sem caracteres de controle (inclusive os códigos do terminal), sem
// caracteres invisíveis ou de direção do texto, numa linha só e com no máximo 500 caracteres. O arquivo não é mexido.
// Um arquivo com nome fora do formato aparece com um código curto (ilegivel-<10 letras do hash do nome>), nunca com o
// nome cru.
//
// Risco conhecido: o formato antigo (etapa 5) não diz de que empresa é. Um pedido antigo copiado à mão para a pasta de
// outra empresa é lido como dela. Os pedidos novos dizem a empresa e, fora da pasta certa, viram "feito para outra
// empresa".
//
// Só usa o Node. Todas as funções recebem `r`, a raiz da Fábrica. Os erros de gravação saem com `recusaDoPedido` e
// `status` 400, o formato que o servidor dos painéis já entende; as mensagens são para a pessoa que usa o painel.
//
// Linha de comando para o agente (`/fabrica continuar`; a raiz é FABRICA_RAIZ ou a pasta de sempre). O agente só
// enxerga um pedido pelo que ela imprime, já conferido e com o recado marcado como dado; nunca lê o arquivo do pedido.
//   node _fabrica/core/pedidos.js listar [--empresa <c>] [--pendentes] [--json | --contar]
//   node _fabrica/core/pedidos.js comecar <c> <id> [--retomar]
//   node _fabrica/core/pedidos.js aplicar-estilo <c> <id> --atendimento <código>
//   node _fabrica/core/pedidos.js concluir <c> <id> atendido|recusado --atendimento <código> --resumo-arquivo <arquivo.txt>
// Saída: 0 = deu certo, 1 = recusa (mensagem em português), 2 = erro de uso ou erro inesperado.
//   - listar: uma linha por pedido, "<codigo> | <empresa> | <id> | <tipo> | <estilo> | <data> | <estado> | ... |
//     «recado da pessoa: … »". O recado vem numa linha só, sem controles nem invisíveis (inclusive os caracteres
//     "tag"), e os marcadores « e » (e as imitações deles) que aparecerem dentro dele saem como ‹ e › (um recado nunca
//     fecha o marcador nem abre outro). O nome da empresa é dado de terceiros: limpo do mesmo jeito, sem "|", até 80
//     caracteres. Nunca imprime caminho de arquivo. Pedido ilegível: só o motivo, sem nada do conteúdo dele.
//     --contar: só o número de pedidos (sem recado nenhum).
//   - comecar: cria pedidos/respostas/<id>.json { estado: 'em-andamento', comecou, atendimento } com 'wx' (é a trava:
//     uma segunda conversa é recusada) e imprime o CÓDIGO DO ATENDIMENTO (aleatório): só quem tem o código aplica o
//     estilo e conclui. Em andamento há 12 horas ou mais aparece como "parado" e só volta com --retomar, que dá um
//     código novo (a conversa antiga perde o direito de gravar); a resposta parada é guardada ao lado, com
//     "-parado-<hora>-<letras>" no nome; nada é apagado. Só atende a empresa ATIVA de empresas/ativa.json (ou a única
//     da pasta); FABRICA_EMPRESA não vale aqui.
//   - aplicar-estilo: só para "usar-estilo" começado por este atendimento e ainda não aplicado; chama escolha.usar com
//     o CAMPO estilo.
//   - concluir: o resumo vem de um arquivo .txt da pasta temporária do sistema (caminho real; nunca da linha de comando,
//     da rede, de outra pasta do computador, da Fábrica, de empresa, nem com nome de segredo), até 600 caracteres, sem controles. Antes, o validador entre empresas
//     (`validar.js --empresa <c>`) confere o resumo e, para "atendido", o conteúdo da empresa: termo de outra empresa
//     no resumo, ou num arquivo da empresa fora da pasta de pedidos, impede a marcação e é mostrado (o termo, de quem é
//     e o nome do arquivo com a linha; nunca o caminho nem o trecho). Termo dentro de um pedido guardado (um recado
//     nunca é corrigido) só gera um aviso.
// Nenhum subcomando apaga ou altera o arquivo do pedido. Nenhum abre processo, a não ser o validador no concluir.
'use strict';
const childProcess = require('child_process'); // usado só pelo concluir (o validador), chamado na hora
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const empresaMod = require('./empresa');
const escolha = require('./escolha');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');

const VERSAO = 2;
const LIMITE_NOTA = 500;
const MAXIMO_ANEXOS = 12;
const MENSAGEM = 'Pronto. No Claude, digite /fabrica continuar';
const DETALHES = ['arranjo-da-imagem', 'alinhamento', 'outro'];
const IMAGEM = /\.(png|jpe?g|webp|svg)$/i;
const PDF = /\.pdf$/i;

// O que cada tipo usa. `estilo`: 'obrigatorio' | 'opcional' | ausente. `anexos`: { min, max, pasta, aceita, nome }.
// `pasta` é a subpasta de `referencias` da empresa onde o painel guarda o arquivo enviado.
const TIPOS = {
  'usar-estilo': { estilo: 'obrigatorio', aplicado: true },
  personalizar: { estilo: 'obrigatorio', detalhes: true },
  'estilo-novo': { estilo: 'opcional', anexos: { min: 0, max: MAXIMO_ANEXOS, pasta: 'enviadas', aceita: IMAGEM, nome: 'imagem' } },
  'criar-do-zero': {},
  'enviar-referencias': { anexos: { min: 1, max: MAXIMO_ANEXOS, pasta: 'enviadas', aceita: IMAGEM, nome: 'imagem' } },
  'ler-manual': { anexos: { min: 1, max: 1, pasta: 'manual', aceita: PDF, nome: 'PDF' } },
};
// Os tipos que a etapa 5 gravava (no formato antigo só eles existem).
const TIPOS_ANTIGOS = ['usar-estilo', 'personalizar', 'estilo-novo'];
// A ordem das chaves no arquivo.
const ORDEM = ['versao', 'empresa', 'tipo', 'estilo', 'nota', 'anexos', 'detalhes', 'aplicado', 'criado', 'fusoMinutos'];

const recusa = (erro) => Object.assign(new Error(erro), { recusaDoPedido: true, status: 400 });
const trecho = (v) => JSON.stringify(String(v).slice(0, 60));
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehArquivo = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
// O anexo é um arquivo de verdade na pasta (lstat: um atalho com o nome exato não leva o agente a ler um arquivo de fora).
const ehArquivoProprio = (p) => { try { return fs.lstatSync(p).isFile(); } catch { return false; } };
const informado = (v) => v !== undefined && v !== null;
const tem = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
// Nome de arquivo ou de pasta simples: sem caminho, sem "..", sem começar por ponto.
const NOME_SIMPLES = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const nomeSimples = (n) => typeof n === 'string' && NOME_SIMPLES.test(n) && !n.includes('..');
// Os caracteres são montados pelo código (nenhum caractere invisível fica escrito neste arquivo).
const car = (n) => String.fromCharCode(n);
const faixa = (a, b) => `${car(a)}-${car(b)}`;
const BOM_INICIO = new RegExp('^' + car(0xfeff));
const semBom = (s) => s.replace(BOM_INICIO, '');
// Quebras de linha e tabulação viram espaço. Somem: controles (Cc), formatação (Cf: marcas de direção, invisíveis e
// os caracteres "tag" U+E0000–E007F, com que se escreve uma ordem que ninguém vê), uso privado (Co), não atribuídos
// (Cn), metades soltas (Cs), seletores de variação, e os invisíveis que o Unicode classifica como letra ou marca
// (U+034F, U+3164 e os preenchimentos do Hangul, U+2800 do braile vazio, U+17B4 e U+17B5 do khmer). U+061C, U+00AD e
// U+180E também saem (Cf, citados por clareza).
const QUEBRAS = new RegExp(`[${car(9)}${car(10)}${car(11)}${car(12)}${car(13)}${car(0x85)}${car(0x2028)}${car(0x2029)}]`, 'g');
const INVISIVEIS = new RegExp('[\\p{Cc}\\p{Cf}\\p{Co}\\p{Cn}\\p{Cs}\\u{FE00}-\\u{FE0F}\\u{E0000}-\\u{E01EF}\\u{034F}\\u{061C}\\u{00AD}\\u{180E}\\u{3164}\\u{115F}\\u{1160}\\u{FFA0}\\u{2800}\\u{17B4}\\u{17B5}]', 'gu');
const ate = (s, n) => [...s].slice(0, n).join(''); // corta por caractere, nunca no meio de um par
const neutralizar = (s) => ate(s.replace(QUEBRAS, ' ').replace(INVISIVEIS, '').replace(/\s+/g, ' ').trim(), LIMITE_NOTA);

// ---- Os nomes ----

const alternativa = (tipos) => tipos.map((t) => t.replace(/-/g, '\\-')).join('|');
const NOME_NOVO = new RegExp(`^(\\d{4}-\\d{2}-\\d{2}-\\d{6})Z-(${alternativa(Object.keys(TIPOS))})(?:-([1-9]\\d*))?\\.json$`);
const NOME_ANTIGO = new RegExp(`^(\\d{4}-\\d{2}-\\d{2}-\\d{6})-(${alternativa(TIPOS_ANTIGOS)})(?:-([1-9]\\d*))?\\.json$`);

// Os dois formatos de nome de arquivo de pedido (o de agora, com a hora em UTC e Z, e o da etapa 5), e nada mais.
function nomeValido(nome) {
  return typeof nome === 'string' && (NOME_NOVO.test(nome) || NOME_ANTIGO.test(nome));
}
// O tipo que o nome do arquivo diz, e de que formato ele é.
function lerNome(nome) {
  let m = NOME_NOVO.exec(nome);
  if (m) return { formato: 'novo', tipo: m[2] };
  m = NOME_ANTIGO.exec(nome);
  if (m) return { formato: 'antigo', tipo: m[2] };
  return null;
}

const dois = (n) => String(n).padStart(2, '0');
// AAAA-MM-DD-HHMMSS em UTC (o nome do arquivo; o Z vem logo depois).
function carimboUtc(d) {
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}-${dois(d.getUTCHours())}${dois(d.getUTCMinutes())}${dois(d.getUTCSeconds())}`;
}
// dia/mês/ano de um instante visto num fuso (minutos a mais que UTC).
function dataNoFuso(instanteMs, fusoMinutos) {
  const d = new Date(instanteMs + fusoMinutos * 60000);
  return `${dois(d.getUTCDate())}/${dois(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// ---- A empresa e o catálogo ----

function conferirEmpresa(r, codigo) {
  if (typeof codigo !== 'string' || codigo === '') throw recusa('O pedido veio sem a empresa. Escolha a empresa no seletor.');
  if (!empresaMod.listar(r).some((e) => e.codigo === codigo)) throw recusa(`A empresa ${trecho(codigo)} não existe nesta pasta. Escolha a empresa no seletor.`);
  return codigo;
}

// Um estilo do catálogo existe quando a pasta dele tem um estilo.yaml que dá para ler.
function estiloExiste(r, id) {
  if (!nomeSimples(id)) return false;
  const arq = path.join(r, '04-LABORATORIO-DE-DESIGN', 'estilos', id, 'estilo.yaml');
  if (!ehArquivo(arq)) return false;
  try { return ehObjeto(lerYaml(fs.readFileSync(arq, 'utf8'))); } catch { return false; }
}

// ---- A conferência (a mesma na gravação e na leitura) ----

// Confere os campos de um pedido de um tipo conhecido. Devolve null (está certo) ou o problema, com:
//   pessoa: a frase para quem usa o painel (gravação); motivo: o "pedido ilegível" curto (leitura).
function conferirCampos(r, c, tipo, p) {
  const def = TIPOS[tipo];
  const erro = (pessoa, motivo) => ({ pessoa, motivo });
  // estilo
  if (def.estilo) {
    if (def.estilo === 'obrigatorio' || informado(p.estilo)) {
      if (typeof p.estilo !== 'string' || p.estilo.trim() === '') return erro('Escolha um estilo antes de enviar o pedido.', 'estilo ausente ou que não é um código simples');
      if (!nomeSimples(p.estilo)) return erro(`O estilo ${trecho(p.estilo)} não existe na biblioteca. Escolha um estilo da lista.`, 'estilo que não é um código simples');
      if (!estiloExiste(r, p.estilo)) return erro(`O estilo ${trecho(p.estilo)} não existe na biblioteca. Escolha um estilo da lista.`, 'estilo que não existe na biblioteca');
    }
  } else if (informado(p.estilo)) return erro('Este pedido não leva estilo. Tente de novo pela tela.', 'campo que este tipo de pedido não usa (estilo)');
  // nota
  if (informado(p.nota) && typeof p.nota !== 'string') return erro('O recado precisa ser um texto.', 'recado que não é texto');
  if (typeof p.nota === 'string' && p.nota.length > LIMITE_NOTA) return erro(`O recado está grande demais: use até ${LIMITE_NOTA} caracteres.`, 'recado grande demais');
  // anexos
  if (def.anexos) {
    const a = def.anexos;
    const lista = informado(p.anexos) ? p.anexos : [];
    if (!Array.isArray(lista)) return erro('Os arquivos do pedido vieram num formato que não entendi. Envie de novo.', 'anexos fora do formato');
    if (lista.length < a.min) return erro(a.max === 1 ? `Envie o arquivo em ${a.nome} antes de fazer o pedido.` : `Envie pelo menos ${a.min === 1 ? 'uma imagem' : `${a.min} imagens`} antes de fazer o pedido.`, 'anexo faltando');
    if (lista.length > a.max) return erro(a.max === 1 ? `Este pedido leva um arquivo só, em ${a.nome}.` : `Envie no máximo ${a.max} imagens por pedido.`, 'anexos demais');
    // repetido sem diferenciar maiúsculas (no Windows, "ref.png" e "REF.png" são o mesmo arquivo)
    if (new Set(lista.map((n) => (typeof n === 'string' ? n.toLowerCase() : n))).size !== lista.length) return erro('O mesmo arquivo apareceu duas vezes no pedido. Envie de novo.', 'anexo repetido');
    const pasta = path.join(c.referencias, a.pasta);
    // só vale o nome EXATO de um arquivo da pasta (o que o painel deu), com as mesmas maiúsculas
    let presentes;
    try { presentes = new Set(fs.readdirSync(pasta)); } catch { presentes = new Set(); }
    for (const nome of lista) {
      if (!nomeSimples(nome)) return erro('Um dos arquivos do pedido tem um nome que não serve. Envie o arquivo de novo pela tela.', 'anexo fora da pasta da empresa');
      if (!a.aceita.test(nome)) return erro(a.nome === 'PDF' ? 'O manual precisa ser um arquivo em PDF.' : 'As referências precisam ser imagens. Envie as imagens de novo pela tela.', `anexo que não é ${a.nome}`);
      const arq = path.join(pasta, nome);
      const rel = path.relative(pasta, arq);
      if (rel !== nome || !presentes.has(nome) || !ehArquivoProprio(arq)) return erro('Não encontrei um dos arquivos do pedido. Envie o arquivo de novo pela tela.', 'anexo fora da pasta da empresa ou que não existe');
    }
  } else if (informado(p.anexos)) return erro('Este pedido não leva arquivos. Tente de novo pela tela.', 'campo que este tipo de pedido não usa (anexos)');
  // detalhes
  if (def.detalhes) {
    const lista = informado(p.detalhes) ? p.detalhes : [];
    if (!Array.isArray(lista) || lista.some((d) => !DETALHES.includes(d)) || new Set(lista).size !== lista.length) {
      return erro('Escolha os detalhes do estilo entre as opções da tela.', 'detalhes fora da lista');
    }
  } else if (informado(p.detalhes)) return erro('Este pedido não leva detalhes. Tente de novo pela tela.', 'campo que este tipo de pedido não usa (detalhes)');
  // aplicado
  if (def.aplicado) {
    if (informado(p.aplicado) && typeof p.aplicado !== 'boolean') return erro('O pedido veio num formato que não entendi. Tente de novo pela tela.', 'campo "aplicado" fora do formato');
  } else if (informado(p.aplicado)) return erro('O pedido veio num formato que não entendi. Tente de novo pela tela.', 'campo que este tipo de pedido não usa (aplicado)');
  return null;
}

// O registro gravado: só os campos que o tipo usa, na ordem combinada.
function montar(empresa, tipo, p, agora) {
  const def = TIPOS[tipo];
  const v = { versao: VERSAO, empresa, tipo };
  if (def.estilo) v.estilo = informado(p.estilo) ? p.estilo : null;
  v.nota = typeof p.nota === 'string' ? p.nota.trim() : '';
  if (def.anexos) v.anexos = informado(p.anexos) ? [...p.anexos] : [];
  if (def.detalhes) v.detalhes = informado(p.detalhes) ? [...p.detalhes] : [];
  if (def.aplicado) v.aplicado = p.aplicado === true;
  v.criado = agora.toISOString();
  v.fusoMinutos = -agora.getTimezoneOffset();
  return v;
}

// ---- Gravar (o painel) ----

const CAMPOS_DE_ENTRADA = ['tipo', 'estilo', 'nota', 'anexos', 'detalhes', 'aplicado'];

// Grava empresas/<c>/pedidos/<AAAA-MM-DD-HHMMSS>Z-<tipo>.json sem sobrescrever nada (dois pedidos no mesmo segundo
// ficam com -2, -3...). Nada é gravado se o pedido for recusado. `agora` existe para os testes.
// Devolve { id, arquivo (relativo à raiz), mensagem }.
function gravar(r, codigo, pedido, agora = new Date()) {
  const empresa = conferirEmpresa(r, codigo);
  if (!ehObjeto(pedido)) throw recusa('O pedido veio incompleto. Escolha o estilo e tente de novo.');
  const { tipo } = pedido;
  if (typeof tipo !== 'string' || !tem(TIPOS, tipo)) throw recusa('Não entendi este pedido. Escolha uma das opções da tela e tente de novo.');
  // Formato fechado: campo desconhecido, ou que só este módulo escreve (empresa, versão, hora), é recusado.
  const estranho = Object.keys(pedido).find((k) => !CAMPOS_DE_ENTRADA.includes(k) && pedido[k] !== undefined);
  if (estranho) throw recusa('O pedido veio num formato que não entendi. Tente de novo pela tela.');
  const c = empresaMod.caminhos(empresa, r);
  const problema = conferirCampos(r, c, tipo, pedido);
  if (problema) throw recusa(problema.pessoa);

  const conteudo = JSON.stringify(montar(empresa, tipo, pedido, agora), null, 2) + '\n';
  fs.mkdirSync(c.pedidos, { recursive: true });
  const base = `${carimboUtc(agora)}Z-${tipo}`;
  for (let k = 1; ; k++) {
    const id = `${base}${k === 1 ? '' : `-${k}`}`;
    const arq = path.join(c.pedidos, `${id}.json`);
    try {
      fs.writeFileSync(arq, conteudo, { encoding: 'utf8', flag: 'wx' }); // 'wx': nunca sobrescreve
    } catch (e) {
      if (e.code === 'EEXIST') continue;
      throw e;
    }
    return { id, arquivo: path.relative(r, arq).split(path.sep).join('/'), mensagem: MENSAGEM };
  }
}

// ---- Ler (o agente e o painel) ----

// Confere um pedido lido do disco. Devolve { ok: registro } ou { motivo }.
function conferirLido(r, c, codigo, nome, texto) {
  const doNome = lerNome(nome);
  if (!doNome) {
    // Nome com a hora certa mas um tipo que não existe: o motivo é o tipo.
    if (/^\d{4}-\d{2}-\d{2}-\d{6}Z?-[a-z0-9-]+\.json$/.test(nome)) return { motivo: 'tipo desconhecido' };
    return { motivo: 'o nome do arquivo não está no formato dos pedidos' };
  }
  let p;
  try { p = JSON.parse(semBom(texto)); } catch { return { motivo: 'formato quebrado (o arquivo não abre)' }; }
  if (!ehObjeto(p)) return { motivo: 'formato quebrado (não é um pedido)' };
  const antigo = !tem(p, 'versao');
  if (!antigo && p.versao !== VERSAO) return { motivo: 'formato quebrado (versão desconhecida)' };
  if (antigo && doNome.formato !== 'antigo') return { motivo: 'formato quebrado (sem versão)' };
  if (!antigo && doNome.formato !== 'novo') return { motivo: 'o nome do arquivo não confere com o conteúdo' };
  const permitidos = antigo ? ['tipo', 'estilo', 'nota', 'criado'] : ORDEM;
  const estranho = Object.keys(p).find((k) => !permitidos.includes(k));
  if (estranho) return { motivo: `formato quebrado (campo desconhecido ${trecho(estranho)})` };
  if (!antigo && p.empresa !== codigo) return { motivo: 'feito para outra empresa' };
  if (typeof p.tipo !== 'string' || !(antigo ? TIPOS_ANTIGOS : Object.keys(TIPOS)).includes(p.tipo)) return { motivo: 'tipo desconhecido' };
  if (p.tipo !== doNome.tipo) return { motivo: 'o nome do arquivo não confere com o conteúdo' };
  if (typeof p.criado !== 'string' || !Number.isFinite(Date.parse(p.criado))) return { motivo: 'formato quebrado (sem a hora do pedido)' };
  let fuso = null;
  if (!antigo) {
    if (!Number.isInteger(p.fusoMinutos) || Math.abs(p.fusoMinutos) > 18 * 60) return { motivo: 'formato quebrado (fuso)' };
    fuso = p.fusoMinutos;
    // Os campos que o tipo usa estão todos lá (o gravador sempre os escreve).
    const def = TIPOS[p.tipo];
    const faltando = ['nota', ...(def.estilo ? ['estilo'] : []), ...(def.anexos ? ['anexos'] : []), ...(def.detalhes ? ['detalhes'] : []), ...(def.aplicado ? ['aplicado'] : [])].find((k) => !tem(p, k));
    if (faltando) return { motivo: `formato quebrado (falta ${trecho(faltando)})` };
  } else if (!tem(p, 'nota') || !tem(p, 'estilo')) return { motivo: 'formato quebrado' };
  const problema = conferirCampos(r, c, p.tipo, p);
  if (problema) return { motivo: problema.motivo };
  const instante = Date.parse(p.criado);
  if (fuso === null) fuso = -new Date(instante).getTimezoneOffset(); // pedido antigo: o fuso deste computador
  const def = TIPOS[p.tipo];
  return {
    ok: {
      empresa: codigo,
      tipo: p.tipo,
      estilo: def.estilo ? (informado(p.estilo) ? p.estilo : null) : null,
      nota: typeof p.nota === 'string' ? neutralizar(p.nota) : '',
      anexos: def.anexos ? (Array.isArray(p.anexos) ? [...p.anexos] : []) : [],
      detalhes: def.detalhes ? (Array.isArray(p.detalhes) ? [...p.detalhes] : []) : [],
      aplicado: def.aplicado ? p.aplicado === true : false,
      criado: new Date(instante).toISOString() === p.criado ? p.criado : new Date(instante).toISOString(),
      instante,
      dataLocal: dataNoFuso(instante, fuso),
    },
  };
}

// O andamento de um pedido, pela resposta do agente em pedidos/respostas/<id>.json (o comando de pedidos grava).
// Sem resposta o pedido está pendente.
const ESTADOS = ['em-andamento', 'atendido', 'recusado'];
// O estado é o mesmo que o comando do agente vê (estadoDe): uma resposta que existe mas está fora do formato (editada à
// mão) e um atendimento começado há 12 horas ou mais são "parado" (ninguém está atendendo, e só o --retomar o tira do
// caminho). `agora` existe para os testes.
function lerResposta(c, id, agora) {
  const resp = lerRespostaInteira(c, id);
  const resumo = resp && !resp.quebrada && typeof resp.resumo === 'string' ? resp.resumo : null;
  return { estado: estadoDe(resp, agora), resumo };
}

// Os pedidos da empresa, do mais antigo para o mais novo pela hora em que foram feitos (`criado`; desempate pelo id).
// Pedido fora do formato vem com `ilegivel` (o motivo) e os outros campos nulos: nada do conteúdo dele é entregue.
// Só lê: nenhum arquivo é criado, mudado ou apagado. `agora` (o relógio do prazo de 12 horas) existe para os testes.
function ler(r, codigo, { agora = new Date() } = {}) {
  const empresa = conferirEmpresa(r, codigo);
  const c = empresaMod.caminhos(empresa, r);
  let entradas;
  try { entradas = fs.readdirSync(c.pedidos, { withFileTypes: true }); } catch { return []; }
  const lista = [];
  for (const e of entradas) {
    if (!e.isFile() || !/\.json$/i.test(e.name)) continue;
    // nome fora do formato: um código curto no lugar do nome cru (o nome do arquivo também é dado, nunca texto a mostrar)
    const id = nomeValido(e.name) ? e.name.replace(/\.json$/i, '') : `ilegivel-${crypto.createHash('sha256').update(e.name).digest('hex').slice(0, 10)}`;
    let texto = null;
    try { texto = fs.readFileSync(path.join(c.pedidos, e.name), 'utf8'); } catch { /* não abre: ilegível */ }
    const res = texto === null ? { motivo: 'formato quebrado (o arquivo não abre)' } : conferirLido(r, c, empresa, e.name, texto);
    const resposta = lerResposta(c, id, agora);
    if (res.ok) {
      const { instante, ...campos } = res.ok;
      lista.push({ id, ...campos, ...resposta, ilegivel: null, _t: instante });
    } else {
      lista.push({ id, empresa, tipo: null, estilo: null, nota: null, anexos: [], detalhes: [], aplicado: false, criado: null, dataLocal: null, ...resposta, ilegivel: res.motivo, _t: null });
    }
  }
  const porId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  lista.sort((a, b) => {
    if (a._t !== null && b._t !== null) return a._t - b._t || porId(a, b);
    if (a._t !== null) return -1; // os ilegíveis (sem hora confiável) vêm depois
    if (b._t !== null) return 1;
    return porId(a, b);
  });
  return lista.map(({ _t, ...resto }) => resto);
}

// ---- O atendimento (o agente) ----

const PARADO_MS = 12 * 3600 * 1000;
const LIMITE_RESUMO = 600;
const VERSAO_RESPOSTA = 1;
const VALIDADOR = path.join(__dirname, '..', '..', '08-FERRAMENTAS', 'validador-anti-vazamento', 'validar.js');
const ROTULOS = {
  'usar-estilo': 'Usar este estilo',
  personalizar: 'Personalizar o estilo',
  'estilo-novo': 'Criar um estilo novo',
  'criar-do-zero': 'Criar a marca do zero',
  'enviar-referencias': 'Estilo a partir de referências',
  'ler-manual': 'Ler o manual da marca',
};
const ESTADO_EM_PALAVRAS = { pendente: 'pendente', 'em-andamento': 'em andamento', parado: 'parado', atendido: 'atendido', recusado: 'recusado' };

// Texto que vai para a saída do comando (nome de empresa, de estilo, recado): numa linha só, sem controles, e sem os
// marcadores do recado (« » e as imitações deles, como 《 》 ⟪ ⟫ ≪ ≫ ❮ ❯ ⟨ ⟩ 〈 〉, viram ‹ ›), para nenhum dado
// parecer começo ou fim de recado.
const ABERTURAS = /[«《⟪≪❮❰⟨〈〈︽︿]/g;
const FECHOS = /[»》⟫≫❯❱⟩〉〉︾﹀]/g;
const semMarcadores = (s) => s.replace(ABERTURAS, '‹').replace(FECHOS, '›');
const textoDeSaida = (s) => semMarcadores(neutralizar(String(s)));
// Nos nomes (dado de terceiros: o nome da empresa vem do painel), a barra da lista também sai (um nome nunca parece
// uma coluna a mais), e o nome tem no máximo 80 caracteres.
const LIMITE_NOME = 80;
const nomeDeSaida = (s) => {
  const t = textoDeSaida(s).replace(/\|/g, '/');
  return [...t].length > LIMITE_NOME ? ate(t, LIMITE_NOME).trimEnd() + '…' : t;
};
// O motivo de um pedido ilegível pode citar um trecho do arquivo (entre aspas): na saída, o trecho some.
const motivoDeSaida = (m) => textoDeSaida(String(m).replace(/"(?:[^"\\]|\\.)*"?/g, '…'));
const recadoMarcado = (nota) => `«recado da pessoa: ${textoDeSaida(nota)} »`;

function nomeDoEstilo(r, id) {
  if (!nomeSimples(id)) return null;
  try {
    const y = lerYaml(semBom(fs.readFileSync(path.join(r, '04-LABORATORIO-DE-DESIGN', 'estilos', id, 'estilo.yaml'), 'utf8')));
    if (ehObjeto(y) && typeof y.nome === 'string' && y.nome.trim()) return nomeDeSaida(y.nome);
  } catch { /* sem o nome, o código */ }
  return id;
}

const arqResposta = (c, id) => path.join(c.pedidos, 'respostas', `${id}.json`);
// O texto da resposta: null (não existe), false (não abre) ou o texto.
function textoDaResposta(arq) {
  try { return fs.readFileSync(arq, 'utf8'); } catch (e) { return e.code === 'ENOENT' ? null : false; }
}
// A resposta inteira, a partir do texto: null (não existe), { quebrada: true } (fora do formato) ou o objeto gravado.
function interpretarResposta(texto) {
  if (texto === null) return null;
  if (texto === false) return { quebrada: true };
  let j;
  try { j = JSON.parse(semBom(texto)); } catch { return { quebrada: true }; }
  if (!ehObjeto(j) || !ESTADOS.includes(j.estado)) return { quebrada: true };
  return j;
}
const lerRespostaInteira = (c, id) => interpretarResposta(textoDaResposta(arqResposta(c, id)));
// Em andamento há 12 horas ou mais (ou uma resposta fora do formato, que ninguém está atendendo): parado.
function estaParado(resp, agora) {
  if (!resp) return false;
  if (resp.quebrada) return true;
  if (resp.estado !== 'em-andamento') return false;
  const t = Date.parse(resp.comecou);
  return !Number.isFinite(t) || agora.getTime() - t >= PARADO_MS;
}
function estadoDe(resp, agora) {
  if (!resp) return 'pendente';
  if (estaParado(resp, agora)) return 'parado';
  return resp.estado;
}

// Grava a resposta por cima (temporário e troca de nome). Só para quem já tem a trava (a resposta existe).
function regravarResposta(c, id, valor) {
  const arq = arqResposta(c, id);
  const tmp = `${arq}.${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(valor, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  try { fs.renameSync(tmp, arq); } catch (e) { try { fs.unlinkSync(tmp); } catch { /* fica */ } throw e; }
}

// Um pedido da lista, já pronto para sair (os mesmos campos no texto e no --json).
function paraSaida(r, entrada, p, resp, agora) {
  const base = { empresa: entrada.codigo, nomeEmpresa: nomeDeSaida(entrada.nome), id: p.id };
  if (p.ilegivel) {
    return { ...base, tipo: null, tipoEmPalavras: 'pedido ilegível', estilo: null, nomeEstilo: null, dataLocal: null, estado: estadoDe(resp, agora), anexos: [], detalhes: [], aplicado: false, recado: null, ilegivel: motivoDeSaida(p.ilegivel) };
  }
  return {
    ...base,
    tipo: p.tipo,
    tipoEmPalavras: ROTULOS[p.tipo],
    estilo: p.estilo,
    nomeEstilo: p.estilo ? nomeDoEstilo(r, p.estilo) : null,
    dataLocal: p.dataLocal,
    estado: estadoDe(resp, agora),
    anexos: [...p.anexos],
    detalhes: [...p.detalhes],
    aplicado: p.aplicado || !!(resp && !resp.quebrada && typeof resp.aplicado === 'string'),
    recado: p.nota ? recadoMarcado(p.nota) : null,
    ilegivel: null,
  };
}

function linhaDeSaida(o) {
  const partes = [o.empresa, o.nomeEmpresa, o.id, o.tipoEmPalavras];
  if (o.ilegivel) return [...partes, `motivo: ${o.ilegivel}`, ESTADO_EM_PALAVRAS[o.estado]].join(' | ');
  partes.push(o.estilo ? `estilo: ${o.nomeEstilo}` : (TIPOS[o.tipo].estilo ? 'sem estilo escolhido' : 'sem estilo'));
  partes.push(o.dataLocal, ESTADO_EM_PALAVRAS[o.estado]);
  if (o.tipo === 'usar-estilo' && o.aplicado) partes.push('já aplicado pela tela');
  if (o.anexos.length) partes.push(`anexos: ${o.anexos.join(', ')}`);
  if (o.detalhes.length) partes.push(`detalhes: ${o.detalhes.join(', ')}`);
  partes.push(o.recado || 'sem recado');
  return partes.join(' | ');
}

// Os pedidos de todas as empresas (ou de uma), do mais antigo para o mais novo pela hora em que foram feitos (empate:
// a ordem das empresas no índice, depois o id); os ilegíveis vêm no fim, empresa por empresa. `pendentes`: só os que
// esperam atendimento (pendente ou parado, e legíveis). Só lê.
function listar(r, { empresa = null, pendentes = false, agora = new Date() } = {}) {
  const todas = empresaMod.listar(r);
  const escolhidas = empresa === null ? todas : [todas.find((e) => e.codigo === conferirEmpresa(r, empresa))];
  const legiveis = [];
  const ilegiveis = [];
  escolhidas.forEach((entrada, ordem) => {
    const c = empresaMod.caminhos(entrada.codigo, r);
    for (const p of ler(r, entrada.codigo, { agora })) {
      const o = paraSaida(r, entrada, p, lerRespostaInteira(c, p.id), agora);
      if (pendentes && (o.ilegivel || !['pendente', 'parado'].includes(o.estado))) continue;
      if (o.ilegivel) ilegiveis.push(o);
      else legiveis.push({ o, t: Date.parse(p.criado), ordem });
    }
  });
  legiveis.sort((a, b) => a.t - b.t || a.ordem - b.ordem || (a.o.id < b.o.id ? -1 : a.o.id > b.o.id ? 1 : 0));
  return [...legiveis.map((x) => x.o), ...ilegiveis];
}

// O pedido `id` da empresa `codigo`, que tem de ser a empresa ATIVA (o agente nunca atende outra sem perguntar e
// ativar). Devolve { c, entrada, p }.
// A empresa ativa para o atendimento: só a escolhida em empresas/ativa.json (ou a única empresa da pasta). A variável
// FABRICA_EMPRESA não vale aqui: o ambiente de um processo não faz o agente atender outra empresa sem perguntar.
function ativaDaPasta(r) {
  const lista = empresaMod.listar(r);
  const texto = textoDaResposta(path.join(r, 'empresas', 'ativa.json'));
  if (texto === null) return lista.length === 1 ? lista[0].codigo : null;
  let j = null;
  try { j = texto === false ? null : JSON.parse(semBom(texto)); } catch { j = null; }
  if (!ehObjeto(j) || typeof j.empresa !== 'string' || !lista.some((e) => e.codigo === j.empresa)) {
    throw recusa('O arquivo da empresa ativa (empresas/ativa.json) está com erro ou cita uma empresa que não existe. Peça à pessoa para escolher a empresa de novo; nada foi alterado.');
  }
  return j.empresa;
}

function acharPedido(r, codigo, id) {
  conferirEmpresa(r, codigo);
  const entrada = empresaMod.listar(r).find((e) => e.codigo === codigo);
  const ativa = ativaDaPasta(r);
  if (ativa === null) {
    throw recusa(`Nenhuma empresa está escolhida nesta pasta. Pergunte à pessoa com qual empresa trabalhar e ative a ${nomeDeSaida(entrada.nome)} antes de atender. Nada foi alterado.`);
  }
  if (ativa !== codigo) {
    throw recusa(`Este pedido é da empresa ${nomeDeSaida(entrada.nome)}, e ela não é a empresa ativa. Pergunte à pessoa antes de ativar a ${nomeDeSaida(entrada.nome)}; nada foi alterado.`);
  }
  const p = ler(r, codigo).find((x) => x.id === id);
  if (!p) throw recusa(`Não encontrei o pedido ${trecho(id)} da empresa ${nomeDeSaida(entrada.nome)}. Rode "pedidos.js listar" e use o código da lista.`);
  return { c: empresaMod.caminhos(codigo, r), entrada, p };
}

// Começa o atendimento: a trava. Devolve o pedido, pronto para sair.
function comecar(r, codigo, id, { retomar = false, agora = new Date() } = {}) {
  const { c, entrada, p } = acharPedido(r, codigo, id);
  if (p.ilegivel) throw recusa(`Este pedido está ilegível (${motivoDeSaida(p.ilegivel)}) e não pode ser atendido. Ele fica como está; nada foi alterado.`);
  const arq = arqResposta(c, id);
  const textoAntes = textoDaResposta(arq);
  const resp = interpretarResposta(textoAntes);
  if (resp && !resp.quebrada && (resp.estado === 'atendido' || resp.estado === 'recusado')) {
    throw recusa(`Este pedido já foi concluído (${resp.estado}). Nada foi alterado.`);
  }
  if (resp) {
    const parado = estaParado(resp, agora);
    if (!parado) {
      throw recusa(retomar
        ? 'Este pedido já está sendo atendido em outra conversa, e só pode ser retomado depois de 12 horas parado. Nada foi alterado.'
        : 'Este pedido já está sendo atendido em outra conversa. Nada foi alterado.');
    }
    if (!retomar) throw recusa('Este pedido está parado: começou há mais de 12 horas e não terminou. Para retomar, rode comecar com --retomar. Nada foi alterado.');
    // A resposta parada sai do caminho (a troca de nome é a trava: só uma conversa consegue) e fica guardada, com um
    // nome que ninguém mais usa (nunca por cima de outra resposta guardada).
    const destino = path.join(c.pedidos, 'respostas', `${id}-parado-${carimboUtc(agora)}Z-${crypto.randomBytes(4).toString('hex')}.json`);
    const corrida = () => recusa('Outra conversa acabou de retomar este pedido. Nada foi alterado.');
    try { fs.renameSync(arq, destino); } catch (e) {
      if (e.code === 'ENOENT') throw corrida();
      throw e;
    }
    // Conferência: o que saiu do caminho é a resposta parada que esta conversa leu? Se outra conversa retomou entre a
    // leitura e a troca de nome, o arquivo movido é o dela: volta para o lugar, e esta conversa é recusada.
    if (textoDaResposta(destino) !== textoAntes) {
      if (!fs.existsSync(arq)) { try { fs.renameSync(destino, arq); } catch { /* fica guardado ao lado, nada é apagado */ } }
      throw corrida();
    }
  } else if (retomar) {
    throw recusa('Este pedido ainda não foi começado: rode comecar sem --retomar. Nada foi alterado.');
  }
  // O código deste atendimento: só quem tem o código aplica o estilo e conclui (uma conversa que perdeu a trava não).
  const atendimento = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(path.dirname(arq), { recursive: true }); // logo antes da gravação: a trava 'wx' vem em seguida
  const valor = { versao: VERSAO_RESPOSTA, estado: 'em-andamento', comecou: agora.toISOString(), atendimento };
  try {
    fs.writeFileSync(arq, JSON.stringify(valor, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' }); // 'wx': a trava
  } catch (e) {
    if (e.code === 'EEXIST') throw recusa('Este pedido já está sendo atendido em outra conversa. Nada foi alterado.');
    throw e;
  }
  return { ...paraSaida(r, entrada, p, valor, agora), atendimento };
}

// A resposta de um pedido começado (em andamento, inclusive parado) por ESTE atendimento (o código que o comecar
// imprimiu): senão, recusa.
function respostaEmAndamento(c, id, atendimento) {
  const resp = lerRespostaInteira(c, id);
  if (!resp) throw recusa('Este pedido ainda não foi começado: rode antes "pedidos.js comecar". Nada foi alterado.');
  if (resp.quebrada) throw recusa('A resposta guardada deste pedido está fora do formato: rode comecar com --retomar. Nada foi alterado.');
  if (resp.estado !== 'em-andamento') throw recusa(`Este pedido já foi concluído (${resp.estado}). Nada foi alterado.`);
  if (typeof atendimento !== 'string' || atendimento === '') {
    throw recusa('Faltou o código do atendimento: passe --atendimento <código>, o que o comecar imprimiu. Nada foi alterado.');
  }
  if (typeof resp.atendimento !== 'string' || resp.atendimento !== atendimento) {
    throw recusa('O código do atendimento não confere: este pedido está com outra conversa (ou foi retomado). Pare aqui; nada foi alterado.');
  }
  return resp;
}

// Aplica o estilo de um pedido "usar-estilo": o do CAMPO estilo, nunca o de um texto. Devolve { estilo, nome }.
function aplicarEstilo(r, codigo, id, { atendimento, agora = new Date() } = {}) {
  const { c, p } = acharPedido(r, codigo, id);
  if (p.ilegivel) throw recusa(`Este pedido está ilegível (${motivoDeSaida(p.ilegivel)}); nenhum estilo foi aplicado.`);
  if (p.tipo !== 'usar-estilo') throw recusa('Só um pedido "Usar este estilo" aplica um estilo; nada foi alterado.');
  if (p.aplicado) throw recusa('A tela já aplicou este estilo quando a pessoa pediu; nada foi alterado. Siga para o primeiro trabalho.');
  const resp = respostaEmAndamento(c, id, atendimento);
  if (typeof resp.aplicado === 'string') throw recusa('Este estilo já foi aplicado neste atendimento; nada foi alterado.');
  escolha.usar(r, codigo, p.estilo, { origem: 'catalogo', agora });
  regravarResposta(c, id, { ...resp, aplicado: agora.toISOString() });
  return { estilo: p.estilo, nome: nomeDoEstilo(r, p.estilo) };
}

// O resumo do agente, lido de um arquivo: texto simples, sem controles nem invisíveis, numa linha só, até 600.
// O arquivo é um .txt DENTRO da pasta temporária do sistema (os.tmpdir(), comparada pelo caminho real; a pasta
// temporária da sessão fica nela): nunca um caminho de rede ou "\\?\", nunca de outra pasta do computador, nunca um
// arquivo da Fábrica nem de empresa nenhuma, e nunca um arquivo com nome de segredo (.env, chave, senha, token).
const CONTROLES = new RegExp(INVISIVEIS.source, 'u');
const NOME_DE_SEGREDO = /^\.env|\.(pem|key|p12|pfx|kdbx)$|^id_(rsa|dsa|ecdsa|ed25519)|credenc|credential|secret|segredo|senha|password|token|^\.npmrc$|^\.netrc$|git-credentials/i;
const dentroDe = (pasta, arq) => { const rel = path.relative(pasta, arq); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };
function lerResumo(arquivo, r) {
  if (typeof arquivo !== 'string' || arquivo === '') throw recusa('Faltou o arquivo do resumo.');
  // Caminho de rede (\\servidor\..., //servidor/...) e caminho "\\?\" nunca: só um arquivo do próprio computador, na
  // pasta temporária do sistema.
  const naPastaTemporaria = 'O resumo precisa ser um arquivo .txt da pasta temporária do sistema (a pasta temporária da sessão), nunca de outra pasta do computador, da rede, da Fábrica ou de uma empresa. Nada foi marcado.';
  if (/^[\\/]{2}/.test(arquivo)) throw recusa(naPastaTemporaria);
  let real;
  try { real = fs.realpathSync.native(path.resolve(arquivo)); } catch { throw recusa('Não encontrei o arquivo do resumo. Escreva o resumo num arquivo de texto da pasta temporária da sessão e rode de novo.'); }
  let temporaria;
  try { temporaria = fs.realpathSync.native(os.tmpdir()); } catch { throw recusa(naPastaTemporaria); }
  if (/^[\\/]{2}/.test(real) || !(dentroDe(temporaria, real) || dentroDe(temporaria.toLowerCase(), real.toLowerCase()))) throw recusa(naPastaTemporaria);
  let raizReal;
  try { raizReal = fs.realpathSync.native(path.resolve(r)); } catch { raizReal = path.resolve(r); }
  if (dentroDe(raizReal, real) || dentroDe(raizReal.toLowerCase(), real.toLowerCase()) || real.split(path.sep).some((s) => s.toLowerCase() === 'empresas')) {
    throw recusa('O resumo precisa estar num arquivo FORA da pasta da Fábrica (na pasta temporária da sessão), nunca num arquivo da Fábrica ou de uma empresa. Nada foi marcado.');
  }
  const nome = path.basename(real);
  if (NOME_DE_SEGREDO.test(nome)) throw recusa('Esse arquivo tem nome de segredo (senha, chave, token, .env): ele nunca é lido. Escreva o resumo num arquivo .txt da pasta temporária da sessão. Nada foi marcado.');
  if (!/\.txt$/i.test(nome)) throw recusa('O resumo precisa ser um arquivo .txt da pasta temporária da sessão. Nada foi marcado.');
  let st;
  try { st = fs.statSync(real); } catch { throw recusa('Não encontrei o arquivo do resumo.'); }
  if (!st.isFile()) throw recusa('O resumo precisa ser um arquivo de texto.');
  if (st.size > 16 * 1024) throw recusa(`O resumo está grande demais: use até ${LIMITE_RESUMO} caracteres.`);
  const bruto = semBom(fs.readFileSync(real, 'utf8')).replace(QUEBRAS, ' ');
  if (CONTROLES.test(bruto)) throw recusa('O resumo tem caracteres de controle ou invisíveis. Escreva só texto simples.');
  const resumo = bruto.replace(/\s+/g, ' ').trim();
  if (resumo === '') throw recusa('O resumo está vazio. Escreva em uma ou duas frases o que foi feito.');
  if (resumo.length > LIMITE_RESUMO) throw recusa(`O resumo está grande demais: use até ${LIMITE_RESUMO} caracteres.`);
  return resumo;
}

// O validador entre empresas, num processo à parte (`rodar` existe para os testes e devolve { status, stdout,
// stderr, error } como o spawnSync). `pasta`: só ela; sem pasta, o conteúdo inteiro da empresa.
// Devolve { codigo, achados: [{ arquivo, linha, termo, donos }] } (codigo 0 = limpo, 1 = termo de outra empresa,
// 2 = não deu para conferir). Da saída do validador só passam as linhas de achado no formato
// `<arquivo>[:<linha>]  "<termo>"  é termo de <empresas>`: nunca o trecho do arquivo (que vem recuado na linha de baixo
// e pode ter qualquer texto).
const ACHADO = /^(\S(?:.*?\S)?)  "(.*)"  é termo de (.+)$/;
const rodarValidadorDeVerdade = (args) => childProcess.spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 300000, windowsHide: true });
function validarComProcesso(r, codigo, pasta, rodar = rodarValidadorDeVerdade) {
  const args = [VALIDADOR, '--empresa', codigo, '--raiz', r, ...(pasta ? [pasta] : [])];
  let res;
  try { res = rodar(args); } catch { return { codigo: 2, achados: [] }; }
  if (!res || res.error) return { codigo: 2, achados: [] };
  const achados = [];
  for (const l of String(res.stdout || '').split(/\r?\n/)) {
    const m = ACHADO.exec(l);
    if (!m) continue;
    const onde = /^(.*?)(?::(\d+))?$/.exec(m[1]);
    achados.push({ arquivo: onde[1], linha: onde[2] ? Number(onde[2]) : null, termo: m[2], donos: m[3] });
  }
  return { codigo: res.status === 0 ? 0 : res.status === 1 ? 1 : 2, achados };
}
// Um achado para a mensagem: o termo, de quem é, e o nome do arquivo com a linha (nunca o caminho nem o trecho).
const achadoDeSaida = (a) => `"${ate(textoDeSaida(a.termo), 80)}" (termo de ${nomeDeSaida(a.donos)}) em ${nomeDeSaida(path.basename(a.arquivo))}${a.linha ? `:${a.linha}` : ''}`;
// O achado está dentro da pasta de pedidos da empresa (um recado, ou uma resposta)? Pedido nunca é corrigido.
function dentroDosPedidos(r, c, arquivo) {
  const abs = path.resolve(r, arquivo);
  const ped = path.resolve(c.pedidos);
  return dentroDe(ped, abs) || dentroDe(ped.toLowerCase(), abs.toLowerCase());
}

// Conclui o atendimento: atendido ou recusado, com o resumo do arquivo. Devolve { estado, resumo, avisos }.
function concluir(r, codigo, id, estado, arquivoResumo, { atendimento, agora = new Date(), rodarValidador } = {}) {
  if (estado !== 'atendido' && estado !== 'recusado') throw recusa('Conclua como "atendido" ou "recusado".');
  const { c } = acharPedido(r, codigo, id);
  const resp = respostaEmAndamento(c, id, atendimento);
  const resumo = lerResumo(arquivoResumo, r);
  const validar = (pasta) => validarComProcesso(r, codigo, pasta, rodarValidador);
  // 1) o resumo (vale para os dois estados: é texto que a tela desta empresa vai mostrar)
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-resumo-'));
  let doResumo;
  try {
    fs.writeFileSync(path.join(dir, 'resumo.txt'), resumo + '\n', 'utf8');
    doResumo = validar(dir);
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* o sistema limpa a pasta temporária */ }
  }
  if (doResumo.codigo === 1) {
    const termos = doResumo.achados.length ? doResumo.achados.map(achadoDeSaida).join('; ') : 'um termo de outra empresa';
    throw recusa(`O resumo cita um termo de outra empresa: ${termos}. Reescreva o resumo; nada foi marcado.`);
  }
  if (doResumo.codigo !== 0) throw recusa('Não consegui rodar a conferência entre empresas; nada foi marcado.');
  // 2) para "atendido", o conteúdo inteiro da empresa. Achado dentro da pasta de pedidos (o recado de um pedido, que
  // nunca é corrigido: uma agência pode citar o nome de outra cliente) não impede o atendido; achado em arquivo da
  // empresa FORA dessa pasta impede.
  const avisos = [];
  if (estado === 'atendido') {
    const daEmpresa = validar(null);
    if (daEmpresa.codigo === 1) {
      const fora = daEmpresa.achados.filter((a) => !dentroDosPedidos(r, c, a.arquivo));
      const nosPedidos = daEmpresa.achados.length - fora.length;
      if (fora.length || !daEmpresa.achados.length) {
        const lista = fora.length ? fora.map(achadoDeSaida).join('; ') : 'um termo de outra empresa';
        const extra = nosPedidos ? ` (Há também ${nosPedidos} achado(s) em pedidos guardados: esses não impedem o atendido.)` : '';
        throw recusa(`O conteúdo desta empresa, fora dos pedidos, cita um termo de outra empresa: ${lista}. Mostre isso à pessoa; corrija esse arquivo com ela e rode de novo, ou conclua como recusado. O pedido não foi marcado como atendido.${extra}`);
      }
      avisos.push(`Aviso: ${nosPedidos} pedido(s) guardado(s) desta empresa cita(m) um termo de outra empresa. Pedido não se corrige, e isso não impede o atendido.`);
    } else if (daEmpresa.codigo !== 0) {
      throw recusa('Não consegui rodar a conferência entre empresas; o pedido não foi marcado como atendido.');
    }
  }
  regravarResposta(c, id, { ...resp, estado, concluido: agora.toISOString(), resumo });
  return { estado, resumo, avisos };
}

// ---------- linha de comando ----------

const USO = [
  'Uso:',
  '  node _fabrica/core/pedidos.js listar [--empresa <codigo>] [--pendentes] [--json | --contar]',
  '  node _fabrica/core/pedidos.js comecar <codigo> <pedido> [--retomar]        (imprime o código do atendimento)',
  '  node _fabrica/core/pedidos.js aplicar-estilo <codigo> <pedido> --atendimento <código>',
  '  node _fabrica/core/pedidos.js concluir <codigo> <pedido> atendido|recusado --atendimento <código> --resumo-arquivo <arquivo.txt>',
].join('\n');

class ErroDeUso extends Error {}

// Separa posicionais, opções com valor e marcas (sem valor). Desconhecida, repetida ou sem valor: erro de uso.
function separar(args, comValor, marcas) {
  const pos = [];
  const op = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    if (tem(op, a)) throw new ErroDeUso(`A opção ${a} apareceu mais de uma vez.`);
    if (marcas.includes(a)) { op[a] = true; continue; }
    if (!comValor.includes(a)) throw new ErroDeUso(`Opção desconhecida: ${a}`);
    if (i + 1 >= args.length || args[i + 1].startsWith('--')) throw new ErroDeUso(`Faltou o valor depois de ${a}.`);
    op[a] = args[++i];
  }
  return { pos, op };
}

function executar(args, ctx) {
  const { r, agora, saida } = ctx;
  const [cmd, ...resto] = args;
  switch (cmd) {
    case 'listar': {
      const { pos, op } = separar(resto, ['--empresa'], ['--pendentes', '--json', '--contar']);
      if (pos.length) throw new ErroDeUso('O comando "listar" só recebe opções.');
      if (op['--json'] && op['--contar']) throw new ErroDeUso('Use --json ou --contar, não os dois.');
      const lista = listar(r, { empresa: tem(op, '--empresa') ? op['--empresa'] : null, pendentes: !!op['--pendentes'], agora });
      if (op['--contar']) saida(String(lista.length)); // só o número: nada de recado (a abertura da /fabrica usa)
      else if (op['--json']) saida(JSON.stringify(lista, null, 2));
      else if (!lista.length) saida(op['--pendentes'] ? 'Não há pedidos esperando atendimento.' : 'Não há pedidos guardados.');
      else saida([`Pedidos guardados: ${lista.length}`, ...lista.map(linhaDeSaida)].join('\n'));
      return 0;
    }
    case 'comecar': {
      const { pos, op } = separar(resto, [], ['--retomar']);
      if (pos.length !== 2) throw new ErroDeUso('Informe o código da empresa e o do pedido.');
      const o = comecar(r, pos[0], pos[1], { retomar: !!op['--retomar'], agora });
      saida(`Atendimento começado: ${linhaDeSaida(o)}`);
      saida(`Código do atendimento: ${o.atendimento}`);
      saida('Guarde esse código: o aplicar-estilo e o concluir deste pedido só valem com --atendimento <código>.');
      return 0;
    }
    case 'aplicar-estilo': {
      const { pos, op } = separar(resto, ['--atendimento'], []);
      if (pos.length !== 2) throw new ErroDeUso('Informe o código da empresa e o do pedido.');
      const res = aplicarEstilo(r, pos[0], pos[1], { atendimento: op['--atendimento'], agora });
      saida(`Estilo aplicado: ${res.nome}.`);
      return 0;
    }
    case 'concluir': {
      const { pos, op } = separar(resto, ['--resumo-arquivo', '--atendimento'], []);
      if (pos.length !== 3) throw new ErroDeUso('Informe o código da empresa, o do pedido e "atendido" ou "recusado".');
      if (pos[2] !== 'atendido' && pos[2] !== 'recusado') throw new ErroDeUso('O estado é "atendido" ou "recusado".');
      if (!tem(op, '--resumo-arquivo')) throw new ErroDeUso('Faltou --resumo-arquivo <arquivo.txt> (o resumo vai por arquivo, nunca na linha de comando).');
      const res = concluir(r, pos[0], pos[1], pos[2], op['--resumo-arquivo'], { atendimento: op['--atendimento'], agora, rodarValidador: ctx.rodarValidador });
      for (const a of res.avisos) saida(a);
      saida(`Pedido marcado como ${res.estado}.`);
      return 0;
    }
    default:
      throw new ErroDeUso(cmd ? `Comando desconhecido: ${cmd}` : '');
  }
}

// Roda um comando e devolve o código de saída. `ctx` existe para os testes (raiz, relógio, saída, validador).
function principal(args, ctx = {}) {
  const c = {
    r: ctx.r || empresaMod.raiz(),
    agora: ctx.agora || new Date(),
    saida: ctx.saida || ((s) => process.stdout.write(s + '\n')),
    erro: ctx.erro || ((s) => process.stderr.write(s + '\n')),
    rodarValidador: ctx.rodarValidador,
  };
  try {
    return executar(args, c);
  } catch (e) {
    if (e instanceof ErroDeUso) {
      c.erro((e.message ? e.message + '\n' : '') + USO);
      return 2;
    }
    if (e.recusaDoPedido || ['JSON_INVALIDO', 'EMPRESA_DESCONHECIDA', 'EMPRESA_NAO_ESCOLHIDA'].includes(e.code)) {
      c.erro('RECUSADO  ' + e.message);
      return 1;
    }
    c.erro('ERRO  inesperado: ' + e.message);
    return 2;
  }
}

if (require.main === module) process.exitCode = principal(process.argv.slice(2));

module.exports = { TIPOS, DETALHES, LIMITE_NOTA, MAXIMO_ANEXOS, MENSAGEM, ROTULOS, gravar, ler, nomeValido, listar, comecar, aplicarEstilo, concluir, principal };
