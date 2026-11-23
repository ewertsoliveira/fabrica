#!/usr/bin/env node
// Arrumação da pasta da Fábrica: deixa à vista só o que é da pessoa e libera espaço, sem apagar nada que seja dela.
//   - poda: da peça que recorta a pessoa do fundo (onnxruntime-node), fica só a versão deste computador;
//   - limpeza: do Tesseract (o programa que monta os vídeos), ficam a versão em uso e a anterior;
//   - esconder: as pastas técnicas somem do VS Code, do Explorador e do Finder. No Windows, só pastas recebem a marca de
//     oculto: um arquivo oculto não pode ser regravado pelos programas (writeFileSync e copyFileSync dão EPERM), e a
//     atualização seguinte travaria. O que a pessoa criou na raiz nunca é tocado.
//
//   node _fabrica/core/arrumar.js [--json]               faz tudo e grava o registro (_fabrica/_estado-arrumacao.json)
//   node _fabrica/core/arrumar.js --se-mudou-a-versao    só trabalha se a versão da Fábrica mudou desde a última vez
//   node _fabrica/core/arrumar.js --mostrar-tudo         mostra de novo tudo o que ela escondeu e para de esconder
//   node _fabrica/core/arrumar.js --esconder             volta a esconder
//   node _fabrica/core/arrumar.js --simular              só calcula, sem mudar nada
//   (--mesmo-assim roda também na cópia de manutenção, a que tem _manutencao/; --raiz <pasta> arruma outra pasta)
//
// Sai 0 sempre, menos com uso errado (2): a arrumação nunca derruba a instalação nem a conversa. O prefixo do Tesseract
// vem do programas.js (respeita FABRICA_TESSERACT_PREFIXO).
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { prefixoTesseract, linhaCmd } = require('./programas');

const lerPastas = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };
const lerNomes = (dir) => { try { return fs.readdirSync(dir); } catch { return []; } };
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const apagar = (p) => fs.rmSync(p, { recursive: true, force: true, maxRetries: 3 });

/** Bytes de um arquivo ou de uma pasta inteira, sem seguir atalho simbólico. */
function tamanho(caminho) {
  let st;
  try { st = fs.lstatSync(caminho); } catch { return 0; }
  if (st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  return lerNomes(caminho).reduce((total, nome) => total + tamanho(path.join(caminho, nome)), 0);
}

/** Compara pelo número x.y.z do começo do nome (0.10.0 vem depois de 0.9.0); nome sem número conta como igual. */
function compararVersoes(a, b) {
  const v = (s) => (String(s).match(/^(\d+)\.(\d+)\.(\d+)/) || []).slice(1).map(Number);
  const [x, y] = [v(a), v(b)];
  if (x.length !== 3 || y.length !== 3) return 0;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// ---------- poda da peça de recorte ----------

const PASTA_DA_PECA = (raiz) => path.join(raiz, 'node_modules', 'onnxruntime-node', 'bin', 'napi-v6');

/** A peça carrega neste computador? (o mesmo require que o modelo da máscara faz) */
function carregaRecorte(raiz) {
  const codigo = "require(require.resolve('onnxruntime-node', { paths: [process.argv[1]] }))";
  return spawnSync(process.execPath, ['-e', codigo, raiz], { cwd: raiz, encoding: 'utf8', timeout: 120000 }).status === 0;
}

/**
 * Deixa só `bin/napi-v6/<plataforma>/<arq>`, a pasta que o onnxruntime carrega neste processo (num Mac de chip Apple
 * com Node de Intel, é a x64). Só apaga se essa pasta existe e a peça carrega antes; com `simular`, só calcula.
 */
function podarRecorte(raiz, { plataforma = process.platform, arq = process.arch, carrega = carregaRecorte, simular = false } = {}) {
  const base = PASTA_DA_PECA(raiz);
  const res = { removidas: [], bytes: 0, avisos: [] };
  if (!fs.existsSync(base)) return { ...res, motivo: 'sem-peca' };
  if (!fs.existsSync(path.join(base, plataforma, arq))) return { ...res, motivo: 'sem-pasta-deste-computador' };
  const outras = [];
  for (const sis of lerPastas(base)) for (const a of lerPastas(path.join(base, sis))) if (sis !== plataforma || a !== arq) outras.push(`${sis}/${a}`);
  if (!outras.length) return res;
  if (!carrega(raiz)) return { ...res, motivo: 'nao-carrega' };
  for (const o of outras.sort()) {
    const p = path.join(base, ...o.split('/'));
    const t = tamanho(p);
    if (!simular) {
      try { apagar(p); } catch (e) { res.avisos.push(`não consegui apagar a peça ${o}: ${e.message}`); continue; }
    }
    res.removidas.push(o);
    res.bytes += t;
  }
  if (!simular) for (const sis of lerPastas(base)) if (sis !== plataforma && !lerNomes(path.join(base, sis)).length) apagar(path.join(base, sis));
  return res;
}

// ---------- limpeza do Tesseract ----------

const VERSAO = /^(\d+)\.(\d+)\.(\d+)(?:[-+._][0-9A-Za-z._-]+)?$/;

/**
 * Do Tesseract, ficam a versão que o lançador `bin/tsrct` (`tsrct.cmd` no Windows) usa, a anterior a ela e toda versão
 * que algum lançador de `bin/` cite (um lançador fixo de versão protege a pasta dele). Sem saber qual está em uso, não
 * apaga nada. Só mexe em pastas com nome de versão; erro ao apagar vira aviso. Com `simular`, só calcula.
 */
function limparTesseract(prefixo = prefixoTesseract(), { plataforma = process.platform, remover = apagar, simular = false } = {}) {
  const res = { removidas: [], mantidas: [], bytes: 0, avisos: [] };
  const dir = path.join(prefixo, 'public-cli');
  const pastas = lerPastas(dir).filter((n) => VERSAO.test(n)).sort();
  if (!pastas.length) return { ...res, motivo: 'sem-tesseract' };

  const textos = {};
  const bin = path.join(prefixo, 'bin');
  for (const nome of lerNomes(bin)) {
    const p = path.join(bin, nome);
    try {
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) textos[nome] = fs.readlinkSync(p);
      else if (st.isFile() && st.size <= 1024 * 1024) textos[nome] = fs.readFileSync(p, 'utf8');
    } catch { /* lançador ilegível não protege nem decide nada */ }
  }
  const cita = (pasta, texto) => new RegExp(`(?<![\\w.])${escapar(pasta)}(?![\\w.-])`).test(texto);
  const lancador = textos[plataforma === 'win32' ? 'tsrct.cmd' : 'tsrct'];
  const doLancador = lancador === undefined ? [] : pastas.filter((p) => cita(p, lancador));
  if (!doLancador.length) return { ...res, mantidas: pastas, motivo: 'nao-sei-qual-esta-em-uso' };

  const emUso = doLancador.sort(compararVersoes)[doLancador.length - 1];
  const anterior = pastas.filter((p) => compararVersoes(p, emUso) < 0).sort(compararVersoes).pop();
  const protegidas = new Set([emUso, anterior].filter(Boolean));
  for (const p of pastas) {
    if (compararVersoes(p, emUso) === 0 || Object.values(textos).some((t) => cita(p, t))) protegidas.add(p);
  }
  for (const p of pastas) {
    if (protegidas.has(p)) { res.mantidas.push(p); continue; }
    const c = path.join(dir, p);
    const t = tamanho(c);
    if (!simular) {
      try { remover(c); } catch (e) { res.avisos.push(`não consegui apagar a versão ${p} do Tesseract: ${e.message}`); res.mantidas.push(p); continue; }
    }
    res.removidas.push(p);
    res.bytes += t;
  }
  return res;
}

// ---------- esconder ----------

// Itens da raiz que a Fábrica conhece. Só eles podem ser escondidos; o que a pessoa criou na raiz nunca é tocado.
const ITENS_TECNICOS = Object.freeze(['.claude', '.env', '.env.example', '.gitignore', '.vscode', '04-LABORATORIO-DE-DESIGN',
  '05-ESTRATEGIA', '06-MARCA-E-FOTOS', '08-FERRAMENTAS', 'CORE.md', 'INSTALAR.md', 'LICENSE.md', 'NOTICE.md', 'README.md',
  '_fabrica', 'docs', 'linhas', 'node_modules', 'package-lock.json', 'package.json']);
// No formato antigo, estas guardam coisas da empresa (marca e fotos, referências e peças, receitas, saídas e memória).
const DA_EMPRESA_NO_FORMATO_ANTIGO = Object.freeze(['04-LABORATORIO-DE-DESIGN', '06-MARCA-E-FOTOS', 'linhas']);
const ATALHOS = Object.freeze({ win32: 'Abrir Laboratório de Design.bat', outros: 'Abrir Laboratório de Design.command' });

/** 'antigo' quando alguma empresa ainda usa as pastas de sempre (disposição legado) ou o índice não dá para ler. */
function formatoDaPasta(raiz) {
  try {
    return require('./empresa').listar(raiz).some((e) => e.disposicao === 'legado') ? 'antigo' : 'novo';
  } catch {
    return 'antigo'; // na dúvida, nada que possa ser da empresa fica escondido
  }
}

/** Os itens da raiz que devem ficar escondidos (só os que existem). */
function desejados(raiz, { plataforma = process.platform, formato = formatoDaPasta(raiz) } = {}) {
  const daEmpresa = formato === 'antigo' ? DA_EMPRESA_NO_FORMATO_ANTIGO : [];
  const nomes = ITENS_TECNICOS.filter((n) => !daEmpresa.includes(n) && fs.existsSync(path.join(raiz, n)));
  const outroSistema = plataforma === 'win32' ? ATALHOS.outros : ATALHOS.win32;
  if (fs.existsSync(path.join(raiz, outroSistema))) nomes.push(outroSistema);
  return nomes;
}

/** No Mac, tudo pode ganhar a marca de oculto; no Windows, só pastas e o atalho do outro sistema (que nada regrava). */
function podeOcultarNoSistema(nome, ehPasta, plataforma = process.platform) {
  if (plataforma === 'darwin') return true;
  if (plataforma === 'win32') return ehPasta || nome === ATALHOS.outros;
  return false;
}

/**
 * Põe ou tira a marca de oculto. Certo só com status 0 e saída vazia (o attrib de item ausente sai 0 com mensagem).
 * No Windows, o attrib vai pelo cmd (como o lançador do Tesseract no programas.js): chamado direto, ele trava quando a
 * IA roda tudo dentro do `timeout` do Git Bash. E nenhum item espera mais de 15 segundos.
 */
function aplicarAtributo(caminho, ocultar, plataforma = process.platform) {
  const LIMITE = 15000;
  let r;
  if (plataforma === 'win32') {
    r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', linhaCmd(['attrib', ocultar ? '+h' : '-h', caminho])],
      { encoding: 'utf8', windowsVerbatimArguments: true, timeout: LIMITE });
  } else if (plataforma === 'darwin') {
    r = spawnSync('chflags', [ocultar ? 'hidden' : 'nohidden', caminho], { encoding: 'utf8', timeout: LIMITE });
  } else {
    return { ok: false, erro: 'este sistema não tem marca de oculto' };
  }
  const saida = String((r.stdout || '') + (r.stderr || '')).trim();
  if (r.status === 0 && !saida) return { ok: true };
  const motivo = r.error && r.error.code === 'ETIMEDOUT' ? 'o sistema não respondeu a tempo' : r.error && r.error.message;
  return { ok: false, erro: saida || motivo || `saiu com ${r.status}` };
}

/**
 * Junta as chaves desejadas ao `files.exclude` da configuração do VS Code. Tira só as chaves que a arrumação pôs antes
 * (`geridasAntes`) e que continuam ligadas; uma chave que a pessoa escreveu (ou desligou) fica como está.
 */
function mesclarExclude(settings, desejadas, geridasAntes = []) {
  const tinha = Object.prototype.hasOwnProperty.call(settings, 'files.exclude');
  const fx = { ...(tinha ? settings['files.exclude'] : {}) };
  for (const k of geridasAntes) if (!desejadas.includes(k) && fx[k] === true) delete fx[k];
  const geridas = [];
  for (const k of desejadas) {
    if (!(k in fx)) { fx[k] = true; geridas.push(k); } else if (geridasAntes.includes(k) && fx[k] === true) geridas.push(k);
  }
  const novo = { ...settings };
  if (tinha || Object.keys(fx).length) novo['files.exclude'] = fx; else delete novo['files.exclude'];
  return { settings: novo, geridas, mudou: JSON.stringify(novo) !== JSON.stringify(settings) };
}

/** A configuração do VS Code da pasta: mescla e grava; se não der para ler, deixa como está e avisa. */
function atualizarVscode(raiz, chaves, geridasAntes, avisos) {
  const arq = path.join(raiz, '.vscode', 'settings.json');
  let settings = {};
  if (fs.existsSync(arq)) {
    const naoLeu = () => {
      avisos.push('não consegui ler a configuração do VS Code desta pasta (tem comentário ou erro de formato); deixei como está');
      return { geridas: geridasAntes, mudou: false };
    };
    try { settings = JSON.parse(fs.readFileSync(arq, 'utf8').replace(/^﻿/, '')); } catch { return naoLeu(); }
    const fx = settings && settings['files.exclude'];
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return naoLeu();
    if (fx !== undefined && (fx === null || typeof fx !== 'object' || Array.isArray(fx))) return naoLeu();
  } else if (!chaves.length) {
    return { geridas: [], mudou: false };
  }
  const m = mesclarExclude(settings, chaves, geridasAntes);
  if (m.mudou || !fs.existsSync(arq)) {
    try {
      fs.mkdirSync(path.dirname(arq), { recursive: true });
      fs.writeFileSync(arq, JSON.stringify(m.settings, null, 2) + '\n');
    } catch (e) {
      avisos.push('não consegui gravar a configuração do VS Code: ' + e.message);
      return { geridas: geridasAntes, mudou: false };
    }
  }
  return { geridas: m.geridas, mudou: m.mudou };
}

/**
 * Esconde o que é técnico (VS Code e marca de oculto) e mostra de novo o que a arrumação tinha escondido e não deve mais
 * ficar escondido (por exemplo, a pasta voltou ao formato antigo). Com `ligado: false`, mostra tudo o que ela escondeu.
 * `antes` é o registro da arrumação anterior: { escondidos, vscode }.
 */
function esconder(raiz, { plataforma = process.platform, ligado = true, antes = {}, atributo = aplicarAtributo, formato } = {}) {
  const avisos = [];
  const fmt = formato || formatoDaPasta(raiz);
  const escondidosAntes = antes.escondidos || [];
  let alvos = ligado ? desejados(raiz, { plataforma, formato: fmt }) : [];
  // a pasta .vscode nasce aqui mesmo, então já entra na lista do VS Code
  const chaves = alvos.length ? [...new Set([...alvos, '.vscode', '**/.git'])] : [];
  const vs = atualizarVscode(raiz, chaves, antes.vscode || [], avisos);
  if (ligado) alvos = desejados(raiz, { plataforma, formato: fmt });

  const escondidos = [];
  for (const nome of alvos) {
    const p = path.join(raiz, nome);
    let ehPasta;
    try { ehPasta = fs.lstatSync(p).isDirectory(); } catch { continue; }
    if (!podeOcultarNoSistema(nome, ehPasta, plataforma)) continue;
    const r = atributo(p, true, plataforma);
    if (r.ok) escondidos.push(nome); else avisos.push(`não consegui esconder ${nome}: ${r.erro}`);
  }
  for (const nome of escondidosAntes) {
    if (escondidos.includes(nome) || !fs.existsSync(path.join(raiz, nome))) continue;
    const r = atributo(path.join(raiz, nome), false, plataforma);
    if (!r.ok) avisos.push(`não consegui mostrar ${nome} de novo: ${r.erro}`);
  }
  const mudou = vs.mudou || escondidos.length !== escondidosAntes.length || escondidos.some((n) => !escondidosAntes.includes(n));
  return { escondidos, vscode: vs.geridas, mudou, avisos };
}

// ---------- o comando ----------

const ARQ_REGISTRO = (raiz) => path.join(raiz, '_fabrica', '_estado-arrumacao.json');
function lerRegistro(raiz) {
  try {
    const j = JSON.parse(fs.readFileSync(ARQ_REGISTRO(raiz), 'utf8'));
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch { return {}; }
}
function gravarRegistro(raiz, registro) {
  fs.mkdirSync(path.dirname(ARQ_REGISTRO(raiz)), { recursive: true });
  fs.writeFileSync(ARQ_REGISTRO(raiz), JSON.stringify(registro, null, 1) + '\n');
}
function versaoDaFabrica(raiz) {
  try { return JSON.parse(fs.readFileSync(path.join(raiz, '_fabrica', 'versao.json'), 'utf8')).versao || null; } catch { return null; }
}

const MB = 1024 * 1024;
const GB = 1024 * MB;
const tamanhoLegivel = (bytes) => (bytes < GB ? `${Math.max(1, Math.round(bytes / MB))} MB` : `${(bytes / GB).toFixed(1).replace('.', ',')} GB`);

/** A frase para a pessoa, em português simples ('' quando não há nada a dizer). */
function frase({ bytes = 0, escondeu = false, mostrou = false, religou = false } = {}) {
  if (mostrou) return 'Pronto: todas as pastas da Fábrica estão à vista de novo. Para esconder outra vez, escreva: esconder as pastas.';
  if (religou) return 'Pronto: de novo, só o que é seu fica à vista.';
  if (bytes > 0 && escondeu) return `Arrumei a Fábrica: deixei à vista só o que é seu e liberei ${tamanhoLegivel(bytes)} de espaço.`;
  if (bytes > 0) return `Arrumei a Fábrica e liberei ${tamanhoLegivel(bytes)} de espaço.`;
  if (escondeu) return 'Arrumei a Fábrica: deixei à vista só o que é seu.';
  return '';
}

/**
 * A arrumação inteira: poda, limpeza e esconder, nesta ordem, com o registro gravado no fim. `fez` é true quando há
 * algo a contar à pessoa (a `frase`). Não roda na cópia de manutenção (a que tem _manutencao/) sem `mesmoAssim`.
 */
function arrumar(raiz, { seMudouAVersao = false, mostrarTudo = false, religar = false, simular = false, mesmoAssim = false,
  plataforma = process.platform, arq = process.arch, prefixo, carrega, atributo } = {}) {
  const versao = versaoDaFabrica(raiz);
  const vazio = { ok: true, fez: false, versao, bytes: 0, frase: '', avisos: [] };
  if (!mesmoAssim && fs.existsSync(path.join(raiz, '_manutencao'))) return { ...vazio, pulou: 'copia-de-manutencao' };
  const registro = lerRegistro(raiz);
  if (seMudouAVersao && versao && registro.versao === versao) return { ...vazio, pulou: 'mesma-versao' };

  const ligado = religar ? true : mostrarTudo ? false : registro.esconder !== false;
  const recorte = podarRecorte(raiz, { plataforma, arq, simular, ...(carrega ? { carrega } : {}) });
  const tesseract = limparTesseract(prefixo || prefixoTesseract(), { plataforma, simular });
  const avisos = [...recorte.avisos, ...tesseract.avisos];
  const bytes = recorte.bytes + tesseract.bytes;
  if (simular) {
    const pasta = { simulado: true, escondidos: ligado ? desejados(raiz, { plataforma }) : [] };
    return { ...vazio, bytes, recorte, tesseract, pasta, avisos };
  }

  const escondidosAntes = registro.escondidos || [];
  const pasta = esconder(raiz, { plataforma, ligado, antes: { escondidos: escondidosAntes, vscode: registro.vscode || [] }, ...(atributo ? { atributo } : {}) });
  avisos.push(...pasta.avisos);
  try {
    gravarRegistro(raiz, { versao, em: new Date().toISOString(), esconder: ligado, escondidos: pasta.escondidos, vscode: pasta.vscode });
  } catch (e) { avisos.push('não consegui gravar o registro da arrumação: ' + e.message); }
  const escondeu = ligado && pasta.escondidos.some((n) => !escondidosAntes.includes(n));
  const texto = frase({ bytes, escondeu, mostrou: mostrarTudo && !religar, religou: religar });
  return { ...vazio, fez: texto !== '', bytes, frase: texto, recorte, tesseract, pasta, avisos };
}

/**
 * Só o esconder, de novo, numa pasta que já foi arrumada: chamado quando nasce um item novo na raiz (o atalho do outro
 * sistema, criado com a primeira peça do Laboratório), para ele não ficar à vista até a próxima atualização. Pasta nunca
 * arrumada, cópia de manutenção ou "mostrar tudo" pedido: não faz nada. Não poda nem limpa.
 */
function reesconder(raiz, { plataforma = process.platform, atributo } = {}) {
  if (fs.existsSync(path.join(raiz, '_manutencao'))) return { pulou: 'copia-de-manutencao' };
  const registro = lerRegistro(raiz);
  if (!registro.em) return { pulou: 'nunca-arrumada' };
  if (registro.esconder === false) return { pulou: 'mostrar-tudo' };
  const e = esconder(raiz, { plataforma, antes: { escondidos: registro.escondidos || [], vscode: registro.vscode || [] }, ...(atributo ? { atributo } : {}) });
  try { gravarRegistro(raiz, { ...registro, escondidos: e.escondidos, vscode: e.vscode }); } catch { /* fica para a próxima arrumação */ }
  return e;
}

module.exports = {
  tamanho, compararVersoes, podarRecorte, limparTesseract, carregaRecorte,
  ITENS_TECNICOS, DA_EMPRESA_NO_FORMATO_ANTIGO, ATALHOS, formatoDaPasta, desejados, podeOcultarNoSistema, aplicarAtributo,
  mesclarExclude, esconder, frase, arrumar, lerRegistro, reesconder,
};

if (require.main === module) {
  const args = process.argv.slice(2);
  const BANDEIRAS = ['--json', '--se-mudou-a-versao', '--mostrar-tudo', '--esconder', '--simular', '--mesmo-assim'];
  let raiz = path.resolve(__dirname, '..', '..');
  const tem = new Set();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--raiz' && args[i + 1]) raiz = path.resolve(args[++i]);
    else if (BANDEIRAS.includes(args[i])) tem.add(args[i]);
    else {
      console.error('uso: node _fabrica/core/arrumar.js [--json] [--se-mudou-a-versao] [--mostrar-tudo] [--esconder] [--simular] [--mesmo-assim] [--raiz <pasta>]');
      process.exit(2);
    }
  }
  let r;
  try {
    r = arrumar(raiz, {
      seMudouAVersao: tem.has('--se-mudou-a-versao'), mostrarTudo: tem.has('--mostrar-tudo'), religar: tem.has('--esconder'),
      simular: tem.has('--simular'), mesmoAssim: tem.has('--mesmo-assim'),
    });
  } catch (e) {
    r = { ok: false, fez: false, frase: '', avisos: ['a arrumação parou no meio: ' + e.message] };
  }
  if (tem.has('--json')) console.log(JSON.stringify(r, null, 2));
  else {
    if (r.pulou === 'copia-de-manutencao') console.log('Esta é a cópia de manutenção da Fábrica: a arrumação não roda aqui (para forçar, use --mesmo-assim).');
    else console.log(r.frase || 'Nada a arrumar.');
    for (const a of r.avisos || []) console.log('aviso: ' + a);
  }
  process.exit(0);
}
