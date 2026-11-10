// "Como ficaria" (etapa 7, detalhe do estilo na marca): a peça de um estilo com UMA cor da marca trocada por uma das cores
// sugeridas para o texto difícil de ler, feita de verdade pelo gerador das prévias (gerar-previas.js --marca-arquivo, numa
// cópia da marca com a cor trocada), sob demanda e só para aquele estilo.
//
//   const { comoFicaria } = require('./cor-sugerida');
//   await comoFicaria({ raiz, empresa, estilo, papel, cor, peca: { formato, lamina } })
//     -> { pecas: [{ formato, lamina, atual, endereco, dificeis: [texto] }], pioradas: [{ formato, lamina, textos }], segundos }   (a peça pedida primeiro; depois as
//        outras peças do mesmo grupo; `dificeis`: os textos daquela peça que, medidos na peça nova, ainda ficam difíceis)
//
// Regras:
// - só uma cor que a própria tela sugeriu (previas-marca: leitura de hoje do estilo) para o grupo do papel pedido que tem
//   a peça pedida: outra cor é recusada (COR_FORA) e peça fora do grupo também (PECA_FORA), sem rodar nada;
// - NUNCA grava a marca: a cópia com a cor trocada vai para uma pasta temporária do sistema e é apagada no fim; o arquivo
//   da marca da empresa fica idêntico;
// - as imagens ficam em empresas/<c>/cores-sugeridas/<marca>-<papel>-<cor>/<estilo>/ (fora do git; sem ponto, para o
//   servidor entregar), onde <marca> são os 16 caracteres da assinatura de hoje: com a marca de hoje e a mesma cor, a
//   segunda vez é na hora (a pasta é reaproveitada); as pastas de outra marca saem antes de uma geração nova;
// - a marca mudou enquanto a peça era feita: nada é entregue (code MARCA_MUDOU) e a pasta sai;
// - uma geração por vez neste processo (code OCUPADO); no máximo 6 pastas por empresa (as mais novas); as cópias da marca
//   abandonadas na pasta temporária (de um processo que morreu) saem depois de 1 h;
// - roda num processo filho (nunca no processo de quem chama), com FABRICA_RAIZ e sem FABRICA_MARCA nem FABRICA_EMPRESA.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const pm = require('./previas-marca');
const { lerYaml } = require('../marca/yaml');

const GERAR = path.join(__dirname, 'gerar-previas.js');
const PAPEIS = ['escuro', 'claro', 'acento', 'neutro'];
const ID = /^[a-z0-9][a-z0-9-]*$/;
const HEX = /^#[0-9A-F]{6}$/;
const LIMITE_MS = 5 * 60 * 1000;
const FIXADOS = ['apresentacao', 'metodo', 'contratar'];
const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const erro = (code, mensagem) => Object.assign(new Error(mensagem), { code, proprio: true });
const MSG = {
  cor: 'Esta cor não é uma das sugeridas para este estilo.',
  semMarca: 'Defina a sua marca antes de ver os estilos nela.',
  semPrevia: 'Este estilo ainda não tem prévia na sua marca.',
  ocupado: 'Já estou preparando outra prévia de cor. Tente de novo em instantes.',
  mudou: 'A sua marca mudou enquanto a prévia era feita. Abra o estilo de novo.',
  falhou: 'Não consegui preparar a prévia com esta cor. Tente de novo.',
  peca: 'Esta peça não é uma das que ficam difíceis de ler neste estilo.',
};

// Os dados da marca como texto do leitor de YAML da Fábrica (mapas por indentação, textos entre aspas, listas em linha).
// A volta é conferida por quem chama (lerYaml do texto = os dados).
function escalar(v) {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return String(v);
  if (typeof v === 'string') {
    if (/[\r\n]/.test(v)) throw new Error('texto com quebra de linha');
    return '"' + v.replace(/"/g, '\\"') + '"';
  }
  if (Array.isArray(v)) return '[' + v.map(escalar).join(', ') + ']';
  if (ehObjeto(v)) return '{ ' + Object.entries(v).map(([k, x]) => `${chave(k)}: ${escalar(x)}`).join(', ') + ' }';
  throw new Error('valor que o YAML da marca não guarda');
}
function chave(k) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_-]*$/.test(k)) throw new Error('chave que o YAML da marca não guarda');
  return k;
}
function paraYaml(obj, ind = '') {
  return Object.entries(obj).map(([k, v]) => {
    if (ehObjeto(v)) {
      const dentro = paraYaml(v, ind + '  ');
      return dentro ? `${ind}${chave(k)}:\n${dentro}` : `${ind}${chave(k)}: {}`;
    }
    return `${ind}${chave(k)}: ${escalar(v)}`;
  }).join('\n');
}
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// O arquivo da peça onde o texto difícil está (formato e lâmina) num manifesto de prévias, ou null.
function arquivoDaPeca(m, peca) {
  if (!ehObjeto(m) || !ehObjeto(peca)) return null;
  if (peca.formato === 'carrossel') return Array.isArray(m.carrossel) ? m.carrossel[peca.lamina - 1] || null : null;
  if (peca.formato === 'fixados') return ehObjeto(m.fixados) ? m.fixados[FIXADOS[peca.lamina - 1]] || null : null;
  if (peca.formato === 'reels') return m.reelsCapa || null;
  return null;
}
const nomeSimples = (n) => typeof n === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n) && !n.includes('..');
const lerManifesto = (dir) => { try { const m = JSON.parse(fs.readFileSync(path.join(dir, 'previas.json'), 'utf8')); return ehObjeto(m) ? m : null; } catch { return null; } };

let ocupado = false;
const PREFIXO_TMP = 'cor-sugerida-';
const ABANDONADA_MS = 60 * 60 * 1000;
const NOME_TMP = /^cor-sugerida-[A-Za-z0-9]{6}$/;
const MAXIMO_POR_EMPRESA = 6;
const PASTA_DO_PROGRAMA = /^[0-9a-f]{16}-(escuro|claro|acento|neutro)-[0-9a-f]{6}$/;

// As cópias da marca que um processo morto deixou na pasta temporária do sistema (só as deste programa, pelo prefixo, e com
// mais de 1 h: uma mais nova pode ser de uma geração em andamento). Roda no começo de cada "Como ficaria" e quando o
// servidor dos painéis sobe.
function limparAbandonadas(agora = Date.now()) {
  let nomes = [];
  try { nomes = fs.readdirSync(os.tmpdir()); } catch { return; }
  for (const n of nomes) {
    if (!NOME_TMP.test(n)) continue; // só o nome exato que o mkdtemp do programa cria
    const p = path.join(os.tmpdir(), n);
    try { if (fs.statSync(p).isDirectory() && agora - fs.statSync(p).mtimeMs > ABANDONADA_MS) fs.rmSync(p, { recursive: true, force: true }); } catch { /* outro já tirou */ }
  }
}
// No máximo MAXIMO_POR_EMPRESA peças guardadas por empresa: as mais velhas saem (só as pastas que este programa cria).
function guardarSoAsUltimas(base, manter) {
  let nomes = [];
  try { nomes = fs.readdirSync(base).filter((n) => PASTA_DO_PROGRAMA.test(n)); } catch { return; }
  const comHora = nomes.map((n) => { try { return { n, t: fs.statSync(path.join(base, n)).mtimeMs }; } catch { return null; } }).filter(Boolean)
    .sort((a, b) => (a.n === manter ? -1 : b.n === manter ? 1 : b.t - a.t || (a.n < b.n ? 1 : -1)));
  for (const x of comHora.slice(MAXIMO_POR_EMPRESA)) fs.rmSync(path.join(base, x.n), { recursive: true, force: true });
}
// O nome do estilo (estilo.yaml da raiz dos dados), ou o id.
function nomeDoEstilo(raiz, id) {
  try { const y = lerYaml(fs.readFileSync(path.join(raiz, '04-LABORATORIO-DE-DESIGN', 'estilos', id, 'estilo.yaml'), 'utf8')); return limpoTexto(ehObjeto(y) && typeof y.nome === 'string' ? y.nome : '') || id; } catch { return id; }
}
const mesmaPeca = (a, b) => ehObjeto(a) && ehObjeto(b) && a.formato === b.formato && a.lamina === b.lamina;
const limpoTexto = (v) => (typeof v === 'string' ? v.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '');

async function comoFicaria({ raiz, empresa, estilo, papel, cor, peca, rodar = null, limiteMs = LIMITE_MS } = {}) {
  const t0 = Date.now();
  const previas = pm.pastaDaEmpresa(raiz, empresa); // empresa pela lista (EMPRESA_DESCONHECIDA)
  if (typeof estilo !== 'string' || !ID.test(estilo)) throw erro('ESTILO_DESCONHECIDO', 'Este estilo não está na biblioteca.');
  const corPedida = typeof cor === 'string' ? cor.trim().toUpperCase() : '';
  if (!PAPEIS.includes(papel) || !HEX.test(corPedida)) throw erro('COR_FORA', MSG.cor);
  const inst = pm.instantaneoDaMarca(raiz, empresa);
  if (!inst.definida) throw erro('SEM_MARCA', MSG.semMarca);
  const hoje = pm.previasValidas(raiz, empresa, estilo, inst.assinatura);
  if (!hoje) throw erro('SEM_PREVIA', MSG.semPrevia);
  // o grupo do papel pedido que tem a peça pedida (a mesma cor pode estar no grupo de outro papel: a peça decide)
  const doPapel = (hoje.leitura || []).filter((g) => g.tipo === 'cor' && g.papel === papel);
  const grupo = doPapel.find((g) => (g.pecas || []).some((p) => mesmaPeca(p, peca)));
  if (!grupo) {
    if (doPapel.some((g) => g.sugestoes.some((s) => s.cor === corPedida))) throw erro('PECA_FORA', MSG.peca);
    throw erro('COR_FORA', MSG.cor);
  }
  if (!grupo.sugestoes.some((s) => s.cor === corPedida)) throw erro('COR_FORA', MSG.cor);
  if (ocupado) throw erro('OCUPADO', MSG.ocupado);
  ocupado = true;
  limparAbandonadas();
  try {
    const base = path.join(path.dirname(previas), 'cores-sugeridas');
    const nome = `${inst.assinatura}-${papel}-${corPedida.slice(1).toLowerCase()}`;
    const saida = path.join(base, nome);
    const dirEstilo = path.join(saida, estilo);
    const url = (pasta, arq) => `/empresas/${encodeURIComponent(empresa)}/${pasta}/${encodeURIComponent(estilo)}/${encodeURIComponent(arq)}`;
    const deHoje = lerManifesto(path.join(previas, estilo));
    // as peças do grupo, a pedida primeiro: a de hoje, a nova e os textos que ainda ficam difíceis de ler NELA (todos os da
    // mesma peça, de qualquer papel, medidos de novo na peça nova)
    const pecas = [peca, ...grupo.pecas.filter((p) => !mesmaPeca(p, peca))].map((p) => ({ formato: p.formato, lamina: p.lamina }));
    const entregar = () => {
      const m = lerManifesto(dirEstilo);
      if (!m || m.cores !== 'marca') return null;
      const textos = ehObjeto(m.legibilidade) && Array.isArray(m.legibilidade.textos) ? m.legibilidade.textos : [];
      const lista = [];
      for (const p of pecas) {
        const arq = arquivoDaPeca(m, p);
        if (!nomeSimples(arq) || !fs.existsSync(path.join(dirEstilo, arq))) return null;
        const antes = arquivoDaPeca(deHoje, p);
        const dificeis = [...new Set(textos.filter((t) => ehObjeto(t) && mesmaPeca(t, p) && (t.tipo === 'contraste' || t.tipo === 'estilo')).map((t) => limpoTexto(t.texto)).filter(Boolean))].slice(0, 6);
        lista.push({ formato: p.formato, lamina: p.lamina, atual: nomeSimples(antes) ? url('previas', antes) : null, endereco: url(`cores-sugeridas/${nome}`, arq), dificeis });
      }
      // Os textos que HOJE se leem e, com a cor nova, ficam difíceis, texto a texto (nunca a menos):
      // - no estilo aberto, medidos de novo na peça gerada (legibilidade.todos de hoje x de amanhã, pelo id do texto);
      // - em todos os estilos da empresa, pela conta exata com os textos guardados (previas-marca.textosQueEstraga).
      const todosDe = (mm) => (ehObjeto(mm) && ehObjeto(mm.legibilidade) && Array.isArray(mm.legibilidade.todos) ? mm.legibilidade.todos.filter(ehObjeto) : []);
      const chave = (e, t) => e + ':' + t.f + ':' + t.l + ':' + t.k;
      const hojeLegivel = new Map(todosDe(deHoje).filter((t) => typeof t.ct === 'number' && t.ct >= t.m).map((t) => [chave(estilo, t), t]));
      const vistas = new Map();
      for (const t of todosDe(m)) if (typeof t.ct === 'number' && t.ct < t.m && hojeLegivel.has(chave(estilo, t))) vistas.set(chave(estilo, t), { estilo, f: t.f, l: t.l, t: t.t });
      for (const t of pm.textosQueEstraga(raiz, empresa, papel, corPedida)) if (!vistas.has(chave(t.estilo, t))) vistas.set(chave(t.estilo, t), t);
      const pioradas = [...vistas.values()].filter((t) => ['carrossel', 'fixados', 'reels'].includes(t.f) && Number.isInteger(t.l))
        .map((t) => ({ estilo: t.estilo, nome: nomeDoEstilo(raiz, t.estilo), formato: t.f, lamina: t.l, texto: limpoTexto(t.t) })).slice(0, 20);
      return { pecas: lista, pioradas, segundos: Math.round((Date.now() - t0) / 1000) };
    };
    const pronta = entregar();
    if (pronta) return pronta;

    // as sugestões de uma marca que não é a de hoje já não servem: saem antes de uma geração nova
    try { for (const d of fs.readdirSync(base)) if (PASTA_DO_PROGRAMA.test(d) && !d.startsWith(inst.assinatura + '-')) fs.rmSync(path.join(base, d), { recursive: true, force: true }); } catch { /* ainda não existe */ }
    fs.rmSync(saida, { recursive: true, force: true });

    // a cópia da marca com a cor trocada, conferida pela volta (o que o leitor lê é exatamente os dados com a cor nova)
    const dados = JSON.parse(JSON.stringify(inst.dados));
    if (!ehObjeto(dados.cores)) dados.cores = {};
    dados.cores[papel] = corPedida;
    const texto = paraYaml(dados) + '\n';
    if (!igual(lerYaml(texto), dados)) throw new Error('a cópia da marca não volta igual');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), PREFIXO_TMP));
    try {
      const yaml = path.join(tmp, 'marca.yaml');
      fs.writeFileSync(yaml, texto);
      const env = { ...process.env, FABRICA_RAIZ: path.resolve(raiz), FABRICA_SILENCIO_EXEMPLO: '1' };
      delete env.FABRICA_MARCA;
      delete env.FABRICA_EMPRESA;
      const rodarProcesso = rodar || require('./video-marca').rodarProcesso;
      const x = await rodarProcesso([GERAR, estilo, '--marca-arquivo', yaml, '--saida', saida, '--empresa', empresa], { env, limiteMs });
      if (x.tempoEsgotado || x.status !== 0) throw new Error(`a geração saiu com ${x.status}: ${String(x.stderr || x.stdout).slice(-400)}`);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    // a marca mudou enquanto a peça era feita: não vale
    if (pm.assinaturaDaMarca(raiz, empresa).assinatura !== inst.assinatura) {
      fs.rmSync(saida, { recursive: true, force: true });
      throw erro('MARCA_MUDOU', MSG.mudou);
    }
    const feita = entregar();
    if (!feita) throw new Error('a geração não deixou as peças da marca');
    guardarSoAsUltimas(base, nome);
    return feita;
  } catch (e) {
    if (e.proprio) throw e;
    console.error(`Como ficaria (${empresa}, ${estilo}): ${e.message}`);
    throw erro('FALHOU', MSG.falhou);
  } finally { ocupado = false; }
}

module.exports = { comoFicaria, paraYaml, arquivoDaPeca, limparAbandonadas, MSG };
