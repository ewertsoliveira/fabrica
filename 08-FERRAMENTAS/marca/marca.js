// Leitor do contrato de marca (marca.yaml da empresa ativa) para os scripts da Fábrica.
// Nenhum script guarda cor, fonte, endereço da conta ou vocabulário de empresa: tudo vem daqui.
//
// Ordem de busca: variável FABRICA_MARCA -> marca.yaml da empresa ativa (empresas/<codigo>/marca.yaml)
// -> 06-MARCA-E-FOTOS/marca.yaml (a marca antiga, que é a da empresa "principal"; só vale sem empresa ativa ou com a
// "principal" ativa) -> 06-MARCA-E-FOTOS/marca.exemplo.yaml (o exemplo é uma empresa fictícia; usar ele imprime um
// aviso em destaque, uma vez). Empresa ativa de gaveta sem marca.yaml usa o exemplo: nunca a marca antiga de outra empresa.
// Com mais de uma empresa e nenhuma escolhida (ou com a escolha apontando para uma empresa que não existe) o leitor
// para com uma mensagem clara: nunca usa a marca de outra empresa nem a de exemplo.
// marca.EMPRESA é o código da empresa ativa (null sem empresa ativa ou com FABRICA_MARCA); marca.PASTA, a pasta-base dos
// arquivos da marca (a gaveta, mesmo quando ela ainda usa o exemplo; ou 06-MARCA-E-FOTOS na marca antiga e no exemplo
// sem empresa).
//
// Uso:
//   const marca = require('<...>/08-FERRAMENTAS/marca/marca');
//   marca.cor('acento')        -> [r, g, b, 1] (0..1, o formato do Tesseract)
//   marca.cor('escuro', 0.4)   -> mesma cor com alfa 0,4
//   marca.hex('acento')        -> '#RRGGBB'
//   marca.caminho('06-MARCA-E-FOTOS/x.png') -> caminho absoluto (gaveta da empresa, raiz dos dados, raiz da Fábrica)
//   marca.dados                -> o YAML inteiro, já convertido em objeto
'use strict';
const fs = require('fs');
const path = require('path');
const { lerYaml } = require('./yaml'); // o leitor de YAML mínimo mora em yaml.js (também usado por _fabrica/core/empresa.js)

const empresas = require(path.join(__dirname, '..', '..', '_fabrica', 'core', 'empresa.js'));

const RAIZ = path.resolve(__dirname, '..', '..'); // raiz do código (layouts, texturas, exemplo)
const RAIZ_DADOS = process.env.FABRICA_RAIZ || RAIZ; // raiz dos dados da empresa (gavetas, marca antiga); sem FABRICA_RAIZ é a mesma
const PAPEIS = ['escuro', 'claro', 'acento', 'neutro'];

// ---------- carga ----------
// Ordem de busca: FABRICA_MARCA -> marca.yaml da empresa ativa -> 06-MARCA-E-FOTOS/marca.yaml -> exemplo.
// Devolve também a empresa ativa (código ou null), a pasta-base dos arquivos da marca (`pasta`) e, quando a marca
// é de uma gaveta, o caminho dela (`gaveta`).
function localizar() {
  const pastaAntiga = path.join(RAIZ_DADOS, '06-MARCA-E-FOTOS');
  if (process.env.FABRICA_MARCA) return { arquivo: path.resolve(process.env.FABRICA_MARCA), exemplo: false, empresa: null, pasta: pastaAntiga, gaveta: null };
  let codigo;
  try {
    codigo = empresas.ativa(RAIZ_DADOS);
  } catch (e) {
    if (e.code === 'EMPRESA_NAO_ESCOLHIDA') {
      const codigos = empresas.listar(RAIZ_DADOS).map((x) => x.codigo).join(', ');
      throw new Error(`Há mais de uma empresa nesta Fábrica e nenhuma está escolhida (${codigos}). Rode: node _fabrica/core/empresa.js ativar <codigo>`);
    }
    if (e.code === 'EMPRESA_DESCONHECIDA') throw new Error(`${e.message} Rode: node _fabrica/core/empresa.js ativar <codigo>`);
    if (e.code === 'JSON_INVALIDO') throw new Error(`Não consegui saber qual é a empresa ativa: ${e.message}`);
    throw e;
  }
  const exemplo = { arquivo: path.join(RAIZ, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml'), exemplo: true, pasta: path.join(RAIZ, '06-MARCA-E-FOTOS'), gaveta: null };
  let daGaveta = false;
  let c = null;
  if (codigo !== null) {
    // O índice já foi validado pelo leitor de empresas (disposição só "gaveta" ou "legado"); a entrada da ativa existe.
    const entrada = empresas.listar(RAIZ_DADOS).find((x) => x.codigo === codigo);
    if (!entrada) throw new Error(`A empresa "${codigo}" não está no índice de empresas. Rode: node _fabrica/core/empresa.js ativar <codigo>`);
    daGaveta = entrada.disposicao === 'gaveta';
    c = empresas.caminhos(codigo, RAIZ_DADOS);
    if (fs.existsSync(c.marca)) {
      return { arquivo: c.marca, exemplo: false, empresa: codigo, pasta: c.pastaMarca, gaveta: daGaveta ? c.gaveta : null };
    }
  }
  // Gaveta sem marca.yaml: o 06-MARCA-E-FOTOS/marca.yaml é a marca de OUTRA empresa (a antiga) e nunca serve; vão as
  // cores e letras do exemplo, mas a pasta-base continua sendo a gaveta: peças, fotos e fontes nunca são os da empresa
  // antiga (o caminho() da gaveta só manda à raiz do código o que é do modelo, como 06-MARCA-E-FOTOS/exemplo/...).
  if (daGaveta) return { ...exemplo, empresa: codigo, pasta: c.pastaMarca, gaveta: c.gaveta };
  const antiga = path.join(pastaAntiga, 'marca.yaml');
  if (fs.existsSync(antiga)) return { arquivo: antiga, exemplo: false, empresa: codigo, pasta: pastaAntiga, gaveta: null };
  return { ...exemplo, empresa: null };
}
const { arquivo: ARQUIVO, exemplo: EXEMPLO, empresa: EMPRESA, pasta: PASTA, gaveta: GAVETA } = localizar();
if (!fs.existsSync(ARQUIVO)) throw new Error('contrato de marca não encontrado: ' + ARQUIVO);
const dados = lerYaml(fs.readFileSync(ARQUIVO, 'utf8'));
if (EXEMPLO && !process.env.FABRICA_SILENCIO_EXEMPLO) {
  process.env.FABRICA_SILENCIO_EXEMPLO = '1'; // processos filhos não repetem o aviso
  // Com uma empresa de gaveta ativa (EMPRESA preenchida no exemplo), o arquivo a criar é o da gaveta.
  const onde = EMPRESA ? `empresas/${EMPRESA}/marca.yaml` : '06-MARCA-E-FOTOS/marca.yaml';
  console.error(`[marca] ATENÇÃO: usando a marca de EXEMPLO (fictícia). Crie ${onde} para a empresa real.`);
}

// ---------- cores ----------
function hexParaRgba(h, alfa = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(h || ''));
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => Number((x / 255).toFixed(4))).concat(alfa);
}
const cores = dados.cores || {};
for (const p of PAPEIS) if (!hexParaRgba(cores[p])) throw new Error(`marca: cores.${p} ausente ou inválida em ${ARQUIVO} (use "#RRGGBB")`);
function cor(papel, alfa = 1) {
  if (Array.isArray(papel)) return papel.length === 3 ? [...papel, alfa] : papel;
  const h = cores[papel] ?? (/^#?[0-9a-f]{6}$/i.test(papel) ? papel : null);
  const c = hexParaRgba(h, alfa);
  if (!c) throw new Error(`cor desconhecida: ${JSON.stringify(papel)} (papéis: ${PAPEIS.join(', ')}, ou "#RRGGBB")`);
  return c;
}
const hex = (papel) => '#' + String(cores[papel]).replace('#', '').toUpperCase();

// ---------- caminhos e campos ----------
// Absoluto fica como está. Relativo com marca de gaveta: vale o da gaveta; se não existir, cai na raiz do código só
// para o que é do modelo (tudo que não é 06-MARCA-E-FOTOS nem 06-MARCA-E-FOTOS/..., ou 06-MARCA-E-FOTOS/exemplo/...).
// Qualquer outro 06-MARCA-E-FOTOS/... é da empresa antiga e nunca é devolvido: vale o caminho da gaveta, mesmo
// inexistente. A comparação é feita no caminho já normalizado ("..", "./", barra invertida) e sem diferença de caixa.
// Com marca de gaveta, um caminho que depois de normalizado sai da pasta da empresa ("../../...") é recusado com
// CAMINHO_FORA_DA_EMPRESA; a única saída aceita é para 06-MARCA-E-FOTOS/exemplo/ (vista da raiz dos dados), devolvida
// sob a raiz do código.
// Com marca de gaveta, um 06-MARCA-E-FOTOS/<resto> (fora do exemplo) que não existe no espelho
// (<gaveta>/06-MARCA-E-FOTOS/<resto>) é procurado em <gaveta>/<resto>: é a marca que veio da pasta antiga. Nenhum dos
// dois existindo, vale o espelho, como antes.
// Fora de gaveta: a raiz dos dados se existir, senão a do código (nada muda, nem o "../").
function caminho(rel) {
  if (!rel) return null;
  if (path.isAbsolute(rel)) return rel;
  if (GAVETA) {
    const daGaveta = path.join(GAVETA, rel);
    // Um "../" que leva para fora da pasta da empresa nunca é lido (seria a marca, as saídas ou a memória de outra
    // empresa). A única saída aceita é para o exemplo do modelo, na raiz do código.
    const relativo = path.relative(GAVETA, daGaveta);
    if (relativo === '..' || relativo.startsWith('..' + path.sep) || path.isAbsolute(relativo)) {
      // O resto é calculado a partir da raiz dos dados (de onde nasceu a pasta da empresa) e devolvido sob a raiz do código.
      const resto = path.relative(path.join(RAIZ_DADOS, '06-MARCA-E-FOTOS', 'exemplo'), daGaveta);
      const noExemplo = resto !== '..' && !resto.startsWith('..' + path.sep) && !path.isAbsolute(resto);
      if (!noExemplo) {
        throw Object.assign(new Error(`O caminho "${rel}" sai da pasta da empresa (empresas/${EMPRESA}). Corrija o marca.yaml da empresa para apontar para um arquivo dentro da pasta dela.`), { code: 'CAMINHO_FORA_DA_EMPRESA' });
      }
      return path.join(RAIZ, '06-MARCA-E-FOTOS', 'exemplo', resto);
    }
    if (fs.existsSync(daGaveta)) return daGaveta;
    const r = path.normalize(rel).replace(/\\/g, '/').toLowerCase();
    const daEmpresa = r === '06-marca-e-fotos' || r.startsWith('06-marca-e-fotos/');
    const doExemplo = r === '06-marca-e-fotos/exemplo' || r.startsWith('06-marca-e-fotos/exemplo/');
    // Marca vinda da pasta antiga: o marca.yaml copiado sem edição aponta 06-MARCA-E-FOTOS/<resto>, e o arquivo mora em
    // <pasta da empresa>/<resto>. Só depois do espelho acima; o <resto> já normalizado nunca sai da pasta da empresa.
    if (daEmpresa && !doExemplo && r.startsWith('06-marca-e-fotos/')) {
      const resto = path.normalize(rel).split(/[\\/]+/).slice(1);
      const semPasta = path.join(GAVETA, ...resto);
      const dentro = path.relative(GAVETA, semPasta);
      if (resto.length && dentro !== '' && dentro.split(path.sep)[0] !== '..' && !path.isAbsolute(dentro) && fs.existsSync(semPasta)) return semPasta;
    }
    const doModelo = !daEmpresa || doExemplo;
    const doCodigo = path.join(RAIZ, rel);
    return doModelo && fs.existsSync(doCodigo) ? doCodigo : daGaveta;
  }
  const dosDados = path.join(RAIZ_DADOS, rel);
  return fs.existsSync(dosDados) ? dosDados : path.join(RAIZ, rel);
}
const busca = (obj, rota) => rota.split('.').reduce((o, k) => (o && o[k] !== undefined && o[k] !== null ? o[k] : undefined), obj);

// Padrão de primeiro uso: campo que o marca.yaml da empresa ainda não tem herda o valor do exemplo
// (marca.exemplo.yaml). Cada herança fica registrada em `herdados()`, para a Fábrica avisar o usuário
// de que aquele valor é um ponto de partida e pode ser trocado. Só herdam os blocos do padrão de primeiro uso
// (lista fechada): identidade (nome, conta, cores, fontes principais, logo, vídeo) nunca vem do exemplo.
const HERDA = /^(canvas|imagens|copy|vocabulario|cta|pecas\.logo-aparece-em|tipografia\.acento)(\.|$)/;
let exemploDados = null;
const herdadosSet = new Set();
function doExemplo(rota) {
  if (EXEMPLO || !HERDA.test(rota)) return undefined;
  if (!exemploDados) {
    const arq = path.join(RAIZ, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml');
    exemploDados = fs.existsSync(arq) ? lerYaml(fs.readFileSync(arq, 'utf8')) : {};
  }
  const v = busca(exemploDados, rota);
  if (v !== undefined) herdadosSet.add(rota);
  return v;
}
const pega = (rota, padrao) => busca(dados, rota) ?? doExemplo(rota) ?? padrao;
const herdados = () => [...herdadosSet];

module.exports = {
  RAIZ, ARQUIVO, EXEMPLO, EMPRESA, PASTA, PAPEIS, dados, lerYaml,
  cor, hex, hexParaRgba, caminho, pega, herdados,
  empresa: dados.empresa || {},
  idioma: pega('empresa.idioma', 'pt'),
  handle: pega('empresa.handle', ''),
};
