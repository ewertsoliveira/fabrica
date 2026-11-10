#!/usr/bin/env node
// Prévias base da biblioteca de estilos: as peças de demonstração de cada estilo (carrossel, 3 posts fixados e capa de
// Reels) nas CORES ORIGINAIS do estilo, salvas como imagens leves (.webp de 1080 px de largura) e listadas em previas.json.
//
//   node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] [--saida <pasta>] [--limite-estilo <bytes>]
//   node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --video <pedido.json> [--reusar <pasta-dos-mp4>] [--saida <pasta>]
//
// Sem ids, gera os estilos todos. A pasta de saída padrão é 04-LABORATORIO-DE-DESIGN/biblioteca/previas; em cada estilo
// ficam carrossel-01.webp..., fixado-apresentacao/metodo/contratar.webp, reels-capa.webp e previas.json (o campo `capa` é
// o NOME de um desses arquivos: a primeira lâmina, ou a capa de Reels quando o estilo não tem carrossel).
// Com --video, só o vídeo é feito: um trecho de 12 s (540x960, VP9, sem som) que inclui a entrada do primeiro B-roll do
// pedido (começa 4,5 s antes dela). Só vai para previas/ (e para o repositório) se o pedido disser "liberado": true; senão, vai para
// previas-locais/ (fora do git), que é sempre a pasta do repositório, mesmo com --saida personalizado (só --saida-local a troca).
// Meta de peso: menos de 1 MB por estilo e menos de 30 MB no total. Estilo acima do limite: o comando lista quais e sai com 1.
//
// Prévias na marca (etapa 7): as mesmas imagens com as cores e as letras de uma empresa.
//   node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --marca <codigo> [--identidade empresa|exemplo]
//   node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --marca-arquivo <marca.yaml> --saida <pasta>
// --marca grava em empresas/<codigo>/previas/<id>/ (fora do git), com a assinatura da marca no previas.json
// (previas-marca.js); --marca-arquivo usa uma marca ainda não gravada e não grava assinatura de empresa.
//
// Estilos próprios de uma empresa (etapa 8): as prévias base (cores do próprio estilo, só imagens) de um estilo da pasta de
// estilos próprios, sempre na pasta previas/proprios da mesma empresa (é dali que o catálogo lê). O vídeo do estilo próprio
// fica para as prévias na marca.
//   node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --estilos <estilosProprios da empresa> --saida <previas da empresa>/proprios
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..', '..');
const MARCA_EXEMPLO = path.join(RAIZ, '06-MARCA-E-FOTOS', 'marca.exemplo.yaml');

// A marca da empresa NUNCA entra numa prévia base (R3). Sem FABRICA_MARCA e sem FABRICA_EMPRESA, e apontando para a marca de
// exemplo da própria Fábrica, nem a empresa escolhida em empresas/ativa.json é lida (as cores já vêm do estilo, mas o
// canvas e os tamanhos também ficam fixos).
// - Rodando como comando: o ambiente é limpo aqui, antes de qualquer require do molde ou da marca.
// - Importado por outro programa: o ambiente de quem importa NÃO é mexido. Os módulos que leem a marca são carregados sob
//   demanda (carregar()), numa cópia própria, com o ambiente trocado só durante a carga e devolvido ao que era.
// Nos modos na marca (--marca, --marca-arquivo) o ambiente é o da marca pedida (ambienteDaMarca, abaixo), e só ela.
let modoCarga = 'base'; // 'base' | 'marca' | 'arquivo'
if (require.main === module) {
  try { modoCarga = ambienteDaMarca(process.argv.slice(2)); } catch (e) { console.error('Erro: ' + e.message); process.exit(1); }
  if (modoCarga === 'base') {
    delete process.env.FABRICA_MARCA;
    delete process.env.FABRICA_EMPRESA;
    process.env.FABRICA_MARCA = MARCA_EXEMPLO;
  }
}

// --marca <codigo>: confere o código pela lista de empresas ANTES de carregar qualquer módulo de marca, apaga FABRICA_MARCA e
// põe FABRICA_EMPRESA=<codigo> (FABRICA_RAIZ continua valendo). --marca-arquivo <yaml>: FABRICA_MARCA=<yaml>, sem empresa.
function ambienteDaMarca(argv) {
  const valor = (op) => { const i = argv.indexOf(op); return i < 0 ? undefined : (argv[i + 1] || ''); };
  const codigo = valor('--marca');
  const arquivo = valor('--marca-arquivo');
  if (codigo !== undefined && arquivo !== undefined) throw new Error('use --marca ou --marca-arquivo, não os dois');
  if (codigo !== undefined) {
    const empresaMod = require('../../_fabrica/core/empresa');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(codigo) || !empresaMod.listar(empresaMod.raiz()).some((e) => e.codigo === codigo)) {
      throw new Error(`A empresa ${JSON.stringify(codigo.slice(0, 60))} não existe nesta pasta.`);
    }
    delete process.env.FABRICA_MARCA;
    process.env.FABRICA_EMPRESA = codigo;
    return 'marca';
  }
  if (arquivo !== undefined) {
    if (!arquivo || !fs.existsSync(path.resolve(arquivo))) throw new Error(`não achei a marca ${arquivo || '(faltou o arquivo depois de --marca-arquivo)'}`);
    delete process.env.FABRICA_EMPRESA;
    process.env.FABRICA_MARCA = path.resolve(arquivo);
    return 'arquivo';
  }
  return 'base';
}

const PASTAS_DA_MARCA = ['marca', 'carrossel', 'mockups'].map((p) => path.join(RAIZ, '08-FERRAMENTAS', p) + path.sep);
let modulos = null;
function carregar() {
  if (modulos) return modulos;
  if (modoCarga !== 'base') {
    // processo próprio da marca pedida: o ambiente já é o dela
    modulos = { marca: require('../marca/marca'), molde: require('../carrossel/molde'), render: require('../carrossel/render'), gerador: require('../carrossel/gerar'), conferir: require('../carrossel/conferir') };
    return modulos;
  }
  const antes = { marca: process.env.FABRICA_MARCA, empresa: process.env.FABRICA_EMPRESA };
  // quem chamou pode já ter carregado a marca da empresa: tira esses módulos do cache só durante a carga e depois os devolve
  const guardados = new Map();
  for (const k of Object.keys(require.cache)) if (PASTAS_DA_MARCA.some((p) => k.startsWith(p))) { guardados.set(k, require.cache[k]); delete require.cache[k]; }
  delete process.env.FABRICA_EMPRESA;
  process.env.FABRICA_MARCA = MARCA_EXEMPLO;
  try {
    modulos = {
      marca: require('../marca/marca'),
      molde: require('../carrossel/molde'),
      render: require('../carrossel/render'),
      gerador: require('../carrossel/gerar'),
    };
  } finally {
    for (const k of Object.keys(require.cache)) if (PASTAS_DA_MARCA.some((p) => k.startsWith(p))) delete require.cache[k];
    for (const [k, m] of guardados) require.cache[k] = m;
    if (antes.marca === undefined) delete process.env.FABRICA_MARCA; else process.env.FABRICA_MARCA = antes.marca;
    if (antes.empresa === undefined) delete process.env.FABRICA_EMPRESA; else process.env.FABRICA_EMPRESA = antes.empresa;
  }
  return modulos;
}
// Ambiente dos processos filhos (montar.js): sempre a marca de exemplo, nunca a da empresa.
function ambienteLimpo() {
  const env = { ...process.env, FABRICA_MARCA: MARCA_EXEMPLO };
  delete env.FABRICA_EMPRESA;
  return env;
}
// Qual arquivo de marca a geração está usando (para os testes conferirem que é sempre o de exemplo).
const arquivoDaMarca = () => carregar().marca.ARQUIVO;

const LIMITE_ESTILO = 1_000_000;
const LIMITE_TOTAL = 30_000_000;
const QUALIDADES = [80, 70, 60, 50]; // começa em 80 e só baixa a qualidade (nunca o tamanho) se o estilo passar de 1 MB
const LARGURA = 1080;
const PASTA_PADRAO = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'biblioteca', 'previas');
const USUARIO = 'lia.exemplo';
const IDENTIDADE = { nome: 'Lia Exemplo', conta: `@${USUARIO}` }; // a mesma identidade fictícia do catálogo (estilos/previa.js)
const RETRATO = '04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/retrato-blazer.jpg';
const FIXADOS = ['apresentacao', 'metodo', 'contratar'];
const DURACAO_TRECHO = 12; // segundos do vídeo de prévia (12 s mostram o título, a legenda, a imagem e a volta da pessoa)
const ANTES_DO_BROLL = 4.5; // o trecho começa 4,5 s antes da entrada do primeiro B-roll (ou antes, se o vídeo acabar cedo)
const LARGURA_VIDEO = 540; // 540x960
const ALTURA_VIDEO = 960;
const PASTA_LOCAL_PADRAO = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'biblioteca', 'previas-locais');
// Os nomes que este script cria nas IMAGENS. Só estes podem ser apagados na limpeza (nada mais na pasta é tocado).
// capa.webp era a cópia antiga da capa: não é mais gravada, e a limpeza tira a que sobrou de rodadas anteriores.
// video.webm e video-capa.webp são do passo de vídeo e nunca entram aqui.
const PADROES = [/^carrossel-\d{2}\.webp$/, /^fixado-(apresentacao|metodo|contratar)\.webp$/, /^reels-capa\.webp$/, /^capa\.webp$/];
const numero = (i) => String(i + 1).padStart(2, '0');

// Limites de tempo dos processos filhos: um filho preso nunca segura o trabalhador único das prévias (que atende todas as
// empresas). Folgados de propósito: a máquina fica lenta sob carga (o teste inteiro deste arquivo leva uns 500 s).
const LIMITE_FFMPEG_MS = 2 * 60 * 1000; // converter uma imagem leva menos de 1 s; 2 min só estoura num ffmpeg parado
const LIMITE_FFPROBE_MS = 60 * 1000; // ler a duração de um vídeo é instantâneo
const LIMITE_CORTE_MS = 4 * 60 * 1000; // o trecho de 12 s em VP9 leva menos de 1 min; abaixo dos 5 min de quem corta na marca
// Prévias na marca (gerarImagensNaMarca): sem nenhum estilo terminar há 5 min, o filho está preso. Um estilo leva menos
// de 1 min mesmo sob carga; o relógio recomeça a cada estilo pronto, então a rodada inteira pode levar o que precisar.
const LIMITE_SEM_AVANCO_MS = 5 * 60 * 1000;

// Roda um programa com limite de tempo (spawnSync). Estourou: o filho é morto e o erro diz "tempo esgotado" (code
// ETIMEDOUT, que a fila das prévias mostra como tempo esgotado). Não achou o programa: o erro do sistema, como antes.
function rodarComLimite(cmd, args, limiteMs, nome = path.basename(cmd)) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: limiteMs, killSignal: 'SIGKILL', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.error && r.error.code === 'ETIMEDOUT') {
    throw Object.assign(new Error(`tempo esgotado: o ${nome} não terminou em ${Math.round(limiteMs / 1000)} s`), { code: 'ETIMEDOUT' });
  }
  return r;
}

// ffmpeg + libwebp: reduz para a largura pedida (mantendo a proporção) e grava .webp.
function pngParaWebp(png, webp, { largura = LARGURA, qualidade = QUALIDADES[0] } = {}) {
  const r = rodarComLimite('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-vf', `scale=${largura}:-1`, '-c:v', 'libwebp', '-quality', String(qualidade), webp], LIMITE_FFMPEG_MS);
  if (r.error) throw new Error(`não consegui rodar o ffmpeg (${r.error.message}); ele precisa estar instalado`);
  if (r.status !== 0 || !fs.existsSync(webp)) throw new Error(`o ffmpeg não converteu ${path.basename(png)}: ${String(r.stderr).trim().split('\n').pop()}`);
  return webp;
}

// Arquivos de uma lista de manifesto (nomes dentro da pasta do estilo).
// (sem repetição: `capa` é o nome de um arquivo que também está em carrossel ou em reelsCapa)
function arquivosDoManifesto(m) {
  return [...new Set([m.capa, ...(m.carrossel || []), ...Object.values(m.fixados || {}), m.reelsCapa, m.video, m.videoCapa].filter(Boolean))];
}

// O vídeo não conta na meta de peso (decisão do responsável, 2026-11-03): a meta vale para as imagens (`bytesImagens`);
// `bytes` é o total da pasta, com o vídeo.
const semVideo = (m) => ({ ...m, video: null, videoCapa: null });
const pesoDe = (pasta, m) => arquivosDoManifesto(m).reduce((s, f) => s + (fs.existsSync(path.join(pasta, f)) ? fs.statSync(path.join(pasta, f)).size : 0), 0);

// Apaga só o que as imagens criaram (carrossel-NN, os 3 fixados, reels-capa, capa.webp antigo) e o manifesto novo não lista mais.
// Nunca apaga o vídeo (video.webm, video-capa.webp), previas.json nem arquivo de outro nome.
function limparAntigos(pasta, manifestoNovo) {
  if (!fs.existsSync(pasta)) return [];
  const mantem = new Set(arquivosDoManifesto(manifestoNovo));
  const apagados = [];
  for (const f of fs.readdirSync(pasta)) {
    if (mantem.has(f) || !PADROES.some((p) => p.test(f))) continue;
    const abs = path.join(pasta, f);
    if (!fs.statSync(abs).isFile()) continue;
    fs.unlinkSync(abs);
    apagados.push(f);
  }
  return apagados;
}

// Peso por estilo (campo `bytes` do manifesto) e total; `acima` são os estilos que passaram do limite.
function conferirPeso(manifestos, { limiteEstilo = LIMITE_ESTILO } = {}) {
  const porEstilo = {};
  let total = 0;
  const peso = (m) => m.bytesImagens ?? m.bytes; // a meta vale para as imagens; o vídeo fica de fora
  for (const m of manifestos) { porEstilo[m.estilo] = peso(m); total += peso(m); }
  return { porEstilo, total, acima: manifestos.filter((m) => peso(m) > limiteEstilo).map((m) => m.estilo) };
}

const lerJson = (dir, nome) => (fs.existsSync(path.join(dir, nome)) ? JSON.parse(fs.readFileSync(path.join(dir, nome), 'utf8')) : null);

// D1: foto que falta entra pela alternativa do visual; sem alternativa, a prévia não sai e o erro diz o que falta.
function arquivosResolvidos(id, conteudos) {
  const r = carregar().gerador.resolverArquivos(conteudos);
  if (r.erros.length) throw new Error(`${id}: ${r.erros.join(' / ')}`);
  return r.conteudos;
}

// O estilo próprio de uma empresa (escrito a partir de referências de fora) é renderizado sempre com a rede fechada
// (render.abrirPagina, bloquearRede). Os estilos do catálogo, como sempre.
const opcoesDoRender = (estilo) => (estilo && estilo.proprio ? { bloquearRede: true } : {});

// Renderiza uma lista de peças de um formato e devolve os PNGs (na ordem), numa pasta de trabalho.
// `naMarca` (prévia na marca): cores e letras da marca carregada, a identidade pedida e os avisos do conferidor.
async function renderizarFormato(estilo, formato, conteudos, trabalho, naMarca = null) {
  const { marca, molde, render } = carregar();
  const opcoes = { cores: naMarca ? 'marca' : 'sugestao', identidade: naMarca ? naMarca.ident : IDENTIDADE, retrato: RETRATO, embutir: true, logo: '', formato };
  const { canvas } = molde.canvasDoFormato(formato, marca.pega('canvas.feed', { largura: 1080, altura: 1350 }), marca.pega('canvas.area-segura', { topo: 90, base: 140 }));
  const resolvidos = arquivosResolvidos(estilo.id, conteudos);
  const html = molde.pagina(estilo, resolvidos, opcoes);
  const pasta = path.join(trabalho, formato);
  await render.renderizar({ html, saida: pasta, indices: conteudos.map((_, i) => i), canvas, ...opcoesDoRender(estilo) });
  if (naMarca) {
    // a mesma peça nas cores e letras do próprio estilo, para saber o que é culpa da marca. A letra do estilo vem do Google
    // Fonts; sem internet (ou se a página não carregar), a base é medida sem ela (as cores, que é o que conta, são as mesmas)
    const htmlBase = molde.pagina(estilo, resolvidos, { ...opcoes, cores: 'sugestao' });
    let base;
    try { base = await medirLegibilidade(htmlBase, canvas); } catch { base = await medirLegibilidade(htmlBase.replace(/<link[^>]*fonts\.googleapis\.com[^>]*>/g, ''), canvas); }
    const medida = await medirLegibilidade(html, canvas);
    const l = achadosDaMarca({ formato, marca: medida, base, cores: naMarca.cores, sugerir: carregarSugerir() });
    naMarca.todos.push(...guardados(formato, medida, naMarca.cores));
    naMarca.avisos.push(...l.avisos);
    naMarca.textos.push(...l.textos);
  }
  return conteudos.map((_, i) => path.join(pasta, `lamina-${numero(i)}.png`));
}

// Gera as prévias de imagem de um estilo em <saida>/<id>/ e devolve o manifesto (também gravado em previas.json).
// `demo` opcional ({ carrossel, fixados, reels }) troca o conteúdo lido das pastas do estilo (testes, R4).
// `naMarca` (só nos modos na marca): { empresa, assinatura, identidade, ident, avisos } — veja principalMarca.
// `estilos` (só nas prévias base): um estilo próprio de empresa, lido dessa pasta de estilos (veja principalProprios).
async function gerarImagens(id, { saida = PASTA_PADRAO, demo = null, qualidades = QUALIDADES, limiteEstilo = LIMITE_ESTILO, naMarca = null, estilos = null } = {}) {
  const { molde } = carregar();
  if (estilos && naMarca) throw new Error('o estilo próprio só tem prévias base por este comando');
  const estilo = estilos ? molde.lerEstilo(id, { pasta: estilos }) : molde.lerEstilo(id);
  if (estilo.proprio) conferirSaidaDoProprio(saida, id);
  molde.garantirTexturas(estilo);
  const conteudo = {
    carrossel: estilo.car ? (demo?.carrossel ?? lerJson(estilo.dir, 'demo.json')) : null,
    fixados: estilo.car ? (demo?.fixados ?? lerJson(estilo.dir, 'demo-fixados.json')) : null,
    reels: demo?.reels ?? lerJson(estilo.dir, 'demo-reels.json'),
  };
  if (!conteudo.carrossel?.length && !conteudo.reels?.length) throw new Error(`${id}: o estilo não tem demonstração (demo.json ou demo-reels.json)`);
  if (estilo.proprio) conferirDemoDoProprio(id, conteudo);
  const marcaDoEstilo = naMarca ? { ...naMarca, avisos: [...(naMarca.avisos || [])], textos: [], todos: [] } : null;
  if (marcaDoEstilo && marcaDoEstilo.identidade === 'empresa') for (const k of Object.keys(conteudo)) conteudo[k] = comIdentidade(conteudo[k], marcaDoEstilo.ident);
  const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), 'previas-'));
  const pasta = path.join(saida, id);
  try {
    const pngs = {};
    if (conteudo.carrossel?.length) pngs.carrossel = await renderizarFormato(estilo, 'carrossel', conteudo.carrossel, trabalho, marcaDoEstilo);
    if (conteudo.fixados?.length) pngs.fixados = await renderizarFormato(estilo, 'fixados', conteudo.fixados, trabalho, marcaDoEstilo);
    if (conteudo.reels?.length) pngs.reels = await renderizarFormato(estilo, 'reels', conteudo.reels.slice(0, 1), trabalho, marcaDoEstilo);

    fs.mkdirSync(pasta, { recursive: true });
    const m = { estilo: id, gerado: new Date().toISOString(), cores: 'sugestao', capa: null, carrossel: [], fixados: null, reelsCapa: null, video: null, videoCapa: null, bytes: 0 };
    if (estilo.proprio) { conferirSaidaDoProprio(saida, id); m.proprio = true; }
    if (marcaDoEstilo) {
      // legibilidade: os dados para a etapa 8 sugerir cores (veja achadosDaMarca); no máximo 40 textos por estilo, primeiro os
      // que são da marca (os que viram aviso)
      const textos = [...marcaDoEstilo.textos.filter((x) => x.daMarca), ...marcaDoEstilo.textos.filter((x) => !x.daMarca)].slice(0, 40);
      Object.assign(m, { cores: 'marca', identidade: marcaDoEstilo.identidade, avisos: [...new Set(marcaDoEstilo.avisos)], legibilidade: { cores: marcaDoEstilo.cores, textos, todos: marcaDoEstilo.todos } });
      if (marcaDoEstilo.empresa) Object.assign(m, { empresa: marcaDoEstilo.empresa, assinatura: marcaDoEstilo.assinatura });
    }
    if (pngs.carrossel) m.carrossel = pngs.carrossel.map((_, i) => `carrossel-${numero(i)}.webp`);
    if (pngs.fixados) m.fixados = Object.fromEntries(FIXADOS.map((k) => [k, `fixado-${k}.webp`]));
    if (pngs.reels) m.reelsCapa = 'reels-capa.webp';
    m.capa = m.carrossel[0] || m.reelsCapa; // a capa do cartão é a primeira lâmina do carrossel, ou a capa de Reels (sem cópia)
    // o vídeo é do passo --video: se o manifesto anterior o lista e os arquivos ainda existem, ele continua
    let antes = null;
    try { antes = lerJson(pasta, 'previas.json'); } catch { /* manifesto antigo ilegível: é refeito sem o vídeo */ }
    // na marca, o vídeo só continua se foi feito com a marca de hoje (videoAssinatura); senão sai do manifesto (o arquivo fica)
    const videoDaMarcaVale = !marcaDoEstilo || (marcaDoEstilo.assinatura && antes && antes.cores === 'marca'
      && antes.empresa === marcaDoEstilo.empresa && antes.videoAssinatura === marcaDoEstilo.assinatura);
    if (antes && !antes.local && videoDaMarcaVale && typeof antes.video === 'string' && typeof antes.videoCapa === 'string'
      && fs.existsSync(path.join(pasta, antes.video)) && fs.existsSync(path.join(pasta, antes.videoCapa))) {
      m.video = antes.video; m.videoCapa = antes.videoCapa;
      if (marcaDoEstilo) {
        m.videoAssinatura = marcaDoEstilo.assinatura;
        // o que o video-marca.js gravou junto com o vídeo continua com ele (os avisos do vídeo voltam aos avisos do estilo)
        for (const k of ['videoModelo', 'videoGerado', 'videoAvisos', 'videoDetalhes']) if (antes[k] !== undefined) m[k] = antes[k];
        if (Array.isArray(m.videoAvisos)) m.avisos = [...new Set([...m.avisos, ...m.videoAvisos.filter((a) => typeof a === 'string')])];
      }
    }
    const origens = [
      ...(pngs.carrossel || []).map((p, i) => [p, m.carrossel[i]]),
      ...(pngs.fixados || []).map((p, i) => [p, m.fixados[FIXADOS[i]]]),
      ...(pngs.reels ? [[pngs.reels[0], m.reelsCapa]] : []),
    ];
    // As imagens novas são preparadas numa pasta à parte (com ponto: o servidor não a entrega) e só entram na pasta do estilo
    // no fim: primeiro sai o manifesto antigo, depois entram as imagens, e o previas.json novo é o último (temporário e
    // troca de nome). Assim um manifesto nunca aponta para imagens de rodadas misturadas.
    // pasta de preparo que sobrou de uma rodada que caiu no meio: sai antes (só as pastas .novo-*, nada mais)
    for (const f of fs.readdirSync(pasta, { withFileTypes: true })) if (f.isDirectory() && /^\.novo-/.test(f.name)) fs.rmSync(path.join(pasta, f.name), { recursive: true, force: true });
    const preparo = fs.mkdtempSync(path.join(pasta, '.novo-'));
    try {
      // qualidade 80; se o estilo passar do limite, baixa a qualidade (e só ela) até caber
      for (const q of qualidades) {
        for (const [png, nome] of origens) pngParaWebp(png, path.join(preparo, nome), { largura: LARGURA, qualidade: q });
        m.bytesImagens = pesoDe(preparo, semVideo(m));
        if (m.bytesImagens <= limiteEstilo) break;
      }
      // na marca: se a marca mudou durante a rodada, este estilo não é gravado (precisa ser refeito com a marca nova)
      if (marcaDoEstilo && marcaDoEstilo.conferir && !marcaDoEstilo.conferir()) {
        throw Object.assign(new Error('a marca mudou durante a geração; este estilo precisa ser refeito'), { refazer: true });
      }
      fs.rmSync(path.join(pasta, 'previas.json'), { force: true });
      for (const [, nome] of origens) fs.renameSync(path.join(preparo, nome), path.join(pasta, nome));
    } finally { fs.rmSync(preparo, { recursive: true, force: true }); }
    limparAntigos(pasta, m);
    m.bytes = pesoDe(pasta, m);
    m.bytesImagens = pesoDe(pasta, semVideo(m));
    const tmp = path.join(pasta, 'previas.json.tmp');
    fs.writeFileSync(tmp, JSON.stringify(m, null, 2) + '\n');
    fs.renameSync(tmp, path.join(pasta, 'previas.json'));
    return m;
  } finally { fs.rmSync(trabalho, { recursive: true, force: true }); }
}

// ---------- estilos próprios da empresa (--estilos) ----------
// As prévias base de um estilo próprio: as mesmas imagens, nas cores do próprio estilo, com a identidade de exemplo. O estilo é
// lido de --estilos (molde.lerEstilo com { pasta }) e as imagens vão para --saida. Com a pasta de estilos próprios de uma empresa,
// a saída é sempre a pasta previas/proprios dessa mesma empresa (é dali que o catálogo lê); com uma pasta fora das empresas
// (testes), a saída também fica fora delas. Nunca nas prévias base do catálogo. A demonstração só usa as fotos fictícias do
// catálogo (estilos/_demo/), nunca foto de empresa nem endereço: "referência é só influência". Nada de atalho no caminho.
const PASTA_DEMO = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'estilos', '_demo');
const mesmoCaminho = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const dentroOuIgual = (base, p) => { const rel = path.relative(base, p); return rel === '' || (rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel)); };
const ehAtalho = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
// O caminho real (atalhos resolvidos) de uma pasta que pode ainda não existir: o da parte que existe, mais o resto.
function caminhoReal(p) {
  let atual = path.resolve(p);
  const resto = [];
  for (;;) {
    try { return path.join(fs.realpathSync.native(atual), ...resto); } catch {
      const pai = path.dirname(atual);
      if (pai === atual) return path.resolve(p);
      resto.unshift(path.basename(atual));
      atual = pai;
    }
  }
}

function conferirPastasDoProprio(estilosArg, saidaArg) {
  const empresaMod = require('../../_fabrica/core/empresa');
  const r = empresaMod.raiz();
  const estilos = path.resolve(estilosArg);
  const saida = path.resolve(saidaArg);
  const realE = caminhoReal(estilos);
  const realS = caminhoReal(saida);
  for (const base of [PASTA_PADRAO, PASTA_LOCAL_PADRAO]) {
    if (dentroOuIgual(base, saida) || dentroOuIgual(caminhoReal(base), realS)) throw new Error('--saida não pode ficar dentro das prévias base (04-LABORATORIO-DE-DESIGN/biblioteca/previas, nem previas-locais)');
  }
  const zonas = [...new Set([path.join(r, 'empresas'), path.join(RAIZ, 'empresas'), path.join(r, '06-MARCA-E-FOTOS'), path.join(RAIZ, '06-MARCA-E-FOTOS')].map((z) => path.resolve(z)))];
  const naZona = (p, real) => zonas.some((z) => dentroOuIgual(z, p) || dentroOuIgual(caminhoReal(z), real));
  // a empresa dona da pasta de estilos: o caminho pedido é o estilosProprios dela, e a última pasta não é atalho
  let dono = null;
  for (const e of empresaMod.listar(r)) {
    const c = empresaMod.caminhos(e.codigo, r);
    const esperado = path.join(caminhoReal(path.dirname(c.estilosProprios)), path.basename(c.estilosProprios));
    if (mesmoCaminho(estilos, c.estilosProprios) && mesmoCaminho(realE, esperado)) { dono = { codigo: e.codigo, c }; break; }
  }
  if (!dono && naZona(estilos, realE)) throw new Error('--estilos tem de ser a pasta de estilos próprios de uma empresa (estilos-proprios, sem atalho), ou uma pasta fora das empresas');
  if (dono) {
    const { c } = dono;
    const pedida = path.join(c.previas, 'proprios');
    const esperada = path.join(caminhoReal(c.gaveta), path.relative(c.gaveta, c.previas), 'proprios');
    if (!mesmoCaminho(saida, pedida) || !mesmoCaminho(realS, esperada)) throw new Error(`--saida de um estilo próprio da empresa ${dono.codigo} é a pasta previas/proprios dela (${pedida}), sem atalho`);
  } else if (naZona(saida, realS)) {
    throw new Error('--saida não pode ficar na pasta de uma empresa quando o estilo não é dela (use em --estilos a pasta de estilos próprios da empresa)');
  } else if ([r, RAIZ].some((raiz) => dentroOuIgual(path.resolve(raiz), saida) || dentroOuIgual(caminhoReal(raiz), realS))) {
    // estilo de fora das empresas (teste): a saída também fica fora da Fábrica
    throw new Error('--saida de um estilo de fora das empresas tem de ficar fora da raiz da Fábrica (numa pasta temporária, por exemplo)');
  }
}

// A pasta das prévias do estilo (<saida>/<id>) não pode ser atalho (as imagens iriam parar em outro lugar) nem ficar nas
// prévias base do catálogo (vale também para quem chama gerarImagens direto, sem o comando).
function conferirSaidaDoProprio(saida, id) {
  for (const base of [PASTA_PADRAO, PASTA_LOCAL_PADRAO]) {
    if (dentroOuIgual(base, path.resolve(saida)) || dentroOuIgual(caminhoReal(base), caminhoReal(saida))) throw new Error(`${id}: as prévias de um estilo próprio não podem ficar dentro das prévias base; nada foi gravado`);
  }
  const dir = path.join(path.resolve(saida), id);
  const atalho = ehAtalho(dir) || (fs.existsSync(dir) && !mesmoCaminho(fs.realpathSync.native(dir), path.join(caminhoReal(saida), id)));
  if (atalho) throw new Error(`${id}: a pasta das prévias do estilo (${dir}) é um atalho (junção ou link); nada foi gravado`);
}

// A demonstração inteira de um estilo próprio é conferida: toda foto é uma das fotos de demonstração do catálogo; nenhum texto
// (em qualquer campo, em qualquer ponto) tem endereço, "<", ">" ou barra invertida; `fundo` só escuro, claro ou acento;
// nenhum campo cru (`svg`, `visual` ou `ilustracaoSvg` em texto).
// ("Data: 14 de outubro" é texto; "data:image/png" é endereço)
const TEXTO_DE_FORA = /[<>\\]|\/\/|\b(https?|file|ftp|javascript|blob)\s*:|\bdata\s*:\s*[a-z-]+\//i;
function conferirDemoDoProprio(id, conteudo) {
  const { molde } = carregar();
  const ruins = [];
  const enderecos = (v, onde, chave = '') => {
    if (typeof v === 'string') {
      if (TEXTO_DE_FORA.test(v) || ['svg', 'visual', 'ilustracaoSvg'].includes(chave)) ruins.push(onde);
      if (chave === 'fundo' && !['escuro', 'claro', 'acento'].includes(v)) ruins.push(`${onde} (fundo)`);
      return;
    }
    if (chave === 'fundo' && v !== undefined && v !== null) { ruins.push(`${onde} (fundo)`); return; }
    if (Array.isArray(v)) v.forEach((x, i) => enderecos(x, `${onde}.${i}`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) enderecos(x, `${onde}.${k}`, k);
  };
  const realDemo = caminhoReal(PASTA_DEMO);
  for (const [formato, lista] of Object.entries(conteudo)) {
    if (!Array.isArray(lista)) continue;
    lista.forEach((c, i) => {
      const onde = `${formato} ${i + 1}`;
      enderecos(c, onde);
      const pecas = [c, ...(c && c.visual && c.visual.alternativa ? [{ visual: c.visual.alternativa }] : [])];
      for (const p of pecas) {
        for (const a of molde.arquivosDe(p)) {
          const abs = path.resolve(molde.caminhoAbsoluto(a.caminho));
          const ok = fs.existsSync(abs) ? dentroOuIgual(realDemo, fs.realpathSync.native(abs)) : dentroOuIgual(PASTA_DEMO, abs);
          if (!ok) ruins.push(`${onde} (${a.onde})`);
        }
      }
    });
  }
  if (ruins.length) {
    throw new Error(`${id}: a demonstração de um estilo próprio só usa as fotos de demonstração do catálogo (04-LABORATORIO-DE-DESIGN/estilos/_demo/) e texto simples (sem endereço, "<", ">" nem barra invertida), com fundo escuro, claro ou acento; fora disso: ${[...new Set(ruins)].slice(0, 6).join(', ')}`);
  }
}

async function principalProprios(a) {
  const { molde } = carregar();
  const todos = molde.listarEstilos({ pasta: a.estilos });
  const ids = a.ids.length ? a.ids : todos;
  const desconhecidos = ids.filter((id) => !todos.includes(id));
  if (desconhecidos.length) throw new Error(`estilo desconhecido na pasta de estilos próprios: ${desconhecidos.map((d) => JSON.stringify(d.slice(0, 60))).join(', ')}. Disponíveis: ${todos.join(', ') || 'nenhum'}`);
  if (!ids.length) throw new Error('a pasta de estilos próprios não tem nenhum estilo');
  const manifestos = [];
  for (const id of ids) {
    const m = await gerarImagens(id, { saida: a.saida, limiteEstilo: a.limiteEstilo, estilos: a.estilos });
    manifestos.push(m);
    console.log(`ok   ${id}: ${arquivosDoManifesto(m).length} imagens, ${Math.round(m.bytes / 1000)} KB`);
  }
  return relatarPeso(manifestos, a.limiteEstilo);
}

// ---------- prévia em vídeo ----------

function duracaoDe(arq) {
  const r = rodarComLimite('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', arq], LIMITE_FFPROBE_MS);
  if (r.error) throw new Error(`não consegui rodar o ffprobe (${r.error.message}); ele vem junto com o ffmpeg`);
  const d = Number(String(r.stdout).trim());
  if (r.status !== 0 || !Number.isFinite(d)) throw new Error(`não consegui ler a duração de ${path.basename(arq)}`);
  return d;
}

// Corta `duracao` segundos do MP4 a partir de `ini` (s) e grava o trecho em .webm (540x960, VP9, SEM áudio) e, em
// `destinoCapa`, o quadro do meio do trecho em .webp (540x960). Tudo por ffmpeg.
function cortarTrecho(mp4, destinoWebm, destinoCapa, { ini, duracao = DURACAO_TRECHO } = {}) {
  if (!fs.existsSync(mp4)) throw new Error(`não achei o vídeo ${mp4}`);
  if (!Number.isFinite(ini) || ini < 0) throw new Error('o início do trecho precisa ser um número de segundos');
  const total = duracaoDe(mp4);
  if (ini + duracao > total + 0.1) {
    throw new Error(`o vídeo ${path.basename(mp4)} é curto demais: tem ${total.toFixed(1)} s e o trecho pede de ${ini} s até ${(ini + duracao).toFixed(1)} s`);
  }
  fs.mkdirSync(path.dirname(destinoWebm), { recursive: true });
  fs.mkdirSync(path.dirname(destinoCapa), { recursive: true });
  const escala = `scale=${LARGURA_VIDEO}:${ALTURA_VIDEO}`;
  const roda = (args, destino) => {
    let r;
    try { r = rodarComLimite('ffmpeg', ['-y', '-loglevel', 'error', ...args, destino], LIMITE_CORTE_MS); } catch (e) { fs.rmSync(destino, { force: true }); throw e; }
    if (r.error) throw new Error(`não consegui rodar o ffmpeg (${r.error.message}); ele precisa estar instalado`);
    if (r.status !== 0 || !fs.existsSync(destino)) {
      fs.rmSync(destino, { force: true });
      throw new Error(`o ffmpeg não gravou ${path.basename(destino)}: ${String(r.stderr).trim().split('\n').pop()}`);
    }
  };
  roda(['-ss', String(ini), '-t', String(duracao), '-i', mp4, '-an', '-vf', escala, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '38', '-row-mt', '1'], destinoWebm);
  roda(['-ss', String(ini + duracao / 2), '-i', mp4, '-frames:v', '1', '-vf', escala, '-c:v', 'libwebp', '-quality', String(QUALIDADES[0])], destinoCapa);
}

// Lê e confere o pedido de vídeo (o mesmo arquivo que o montar.js usa). O trecho tem 12 s e inclui a troca de quadro (a
// entrada do primeiro B-roll).
function lerPedidoVideo(arq) {
  const abs = path.resolve(arq || '');
  if (!arq || !fs.existsSync(abs)) throw new Error(`não achei o pedido ${arq || '(faltou o arquivo depois de --video)'}`);
  let pedido;
  try { pedido = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { throw new Error(`o pedido ${arq} não é um JSON válido (${e.message})`); }
  const primeiro = Array.isArray(pedido.broll) ? pedido.broll[0] : null;
  if (!primeiro || typeof primeiro.ini !== 'number') throw new Error('o pedido não tem B-roll; o trecho começa na troca de quadro (entrada do primeiro B-roll)');
  // o trecho pega o título e a legenda antes da troca de quadro e a volta da pessoa depois dela, sem passar do fim do vídeo
  const total = pedido.trecho && typeof pedido.trecho.fim === 'number' ? pedido.trecho.fim - (pedido.trecho.ini || 0) : Infinity;
  const ini = Math.max(0, Math.min(primeiro.ini - ANTES_DO_BROLL, total - DURACAO_TRECHO));
  return { arq: abs, pedido, ini: +ini.toFixed(2), liberado: pedido.liberado === true };
}

// Pasta dos vídeos que ainda não foram liberados. É SEMPRE previas-locais/ do repositório (o git a ignora), qualquer que seja
// o --saida: um --saida personalizado nunca pode levar o vídeo de uma pessoa real para uma pasta que o git não ignora.
// Só um --saida-local explícito (usado nos testes) muda isso.
function pastaLocal(saida, saidaLocal) {
  return saidaLocal ? path.resolve(saidaLocal) : PASTA_LOCAL_PADRAO;
}

const MONTAR = path.join(__dirname, '..', 'tesseract', 'modelos', 'montar.js');

// Monta o MP4 do modelo com o montar.js (cai em saida/<modelo>.mp4, ao lado do pedido).
function montarMp4(modelo, pedidoArq) {
  const r = spawnSync(process.execPath, [MONTAR, modelo, pedidoArq, '--exportar'], { encoding: 'utf8', timeout: 20 * 60 * 1000, env: ambienteLimpo(), maxBuffer: 64 * 1024 * 1024 });
  const mp4 = path.join(path.dirname(pedidoArq), 'saida', modelo + '.mp4');
  if (r.error || r.status !== 0 || !fs.existsSync(mp4)) {
    throw new Error(`o montar.js não gerou o modelo ${modelo}: ${String(r.error ? r.error.message : r.stderr || r.stdout).trim().split('\n').slice(-3).join(' / ')}`);
  }
  return mp4;
}

// Prévia em vídeo de um estilo, a partir do MP4 do modelo de Reels dele. Com "liberado": true no pedido, vai para
// <saida>/<id>/ (previas/, que entra no repositório); sem isso, vai para <saidaLocal>/<id>/ (previas-locais/, fora do git).
// `reusar` é uma pasta com <modelo>.mp4 já prontos; sem ela, o MP4 é montado pelo montar.js (uma vez por modelo).
function gerarVideo(id, pedidoArq, { saida = PASTA_PADRAO, saidaLocal = null, reusar = null, mp4s = new Map() } = {}) {
  const local = pastaLocal(saida, saidaLocal);
  if (path.resolve(local) === path.resolve(saida)) throw new Error('a pasta local e a pasta das prévias não podem ser a mesma');
  const p = lerPedidoVideo(pedidoArq);
  const modelo = carregar().molde.lerEstilo(id).dados.formatos?.reels?.modelo;
  if (!modelo) throw new Error(`${id}: o estilo não tem modelo de Reels (formatos.reels.modelo)`);
  let mp4;
  if (reusar) {
    mp4 = path.join(path.resolve(reusar), modelo + '.mp4');
    if (!fs.existsSync(mp4)) throw new Error(`${id}: não achei ${modelo}.mp4 na pasta ${reusar}`);
  } else {
    if (!mp4s.has(modelo)) mp4s.set(modelo, montarMp4(modelo, p.arq));
    mp4 = mp4s.get(modelo);
  }
  const pasta = path.join(p.liberado ? saida : local, id);
  cortarTrecho(mp4, path.join(pasta, 'video.webm'), path.join(pasta, 'video-capa.webp'), { ini: p.ini, duracao: DURACAO_TRECHO });
  let m = null;
  if (p.liberado) { try { m = lerJson(pasta, 'previas.json'); } catch { /* ilegível: recomeça */ } }
  if (!m) m = { estilo: id, cores: 'sugestao', capa: null, carrossel: [], fixados: null, reelsCapa: null };
  Object.assign(m, { estilo: id, gerado: new Date().toISOString(), video: 'video.webm', videoCapa: 'video-capa.webp' });
  if (p.liberado) delete m.local; else m.local = true;
  m.bytes = pesoDe(pasta, m);
  m.bytesImagens = pesoDe(pasta, semVideo(m));
  fs.writeFileSync(path.join(pasta, 'previas.json'), JSON.stringify(m, null, 2) + '\n');
  return { manifesto: m, pasta, liberado: p.liberado };
}

// ---------- prévias na marca (etapa 7) ----------

// D1 (decisão do responsável): nas prévias na marca entram o nome e a conta da empresa. A identidade de exemplo ("Lia
// Exemplo") também aparece DENTRO da demonstração dos estilos (a conversa do mockup); lá ela vira a da empresa.
function comIdentidade(valor, ident) {
  const usuario = String(ident.conta || '').replace(/^@+/, '');
  const troca = new Map([[IDENTIDADE.nome, ident.nome], ['Lia', ident.nome], [USUARIO, usuario], [IDENTIDADE.conta, ident.conta]]);
  if (typeof valor === 'string') return troca.has(valor) ? troca.get(valor) : valor;
  if (Array.isArray(valor)) return valor.map((v) => comIdentidade(v, ident));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, comIdentidade(v, ident)]));
  return valor;
}

const ONDE = {
  carrossel: (n) => `da lâmina ${n}`,
  fixados: (n) => `do post fixado de ${['apresentação', 'método', 'contratar'][n - 1] || n}`,
  reels: () => 'da capa de Reels',
};
// Depois de montar cada formato, a peça é medida de verdade (medirLegibilidade), com as mesmas peças do conferidor do
// carrossel (medirNaPagina, checarForaDoCanvas e a conta de contraste de checarContraste, aqui repetida para devolver também
// os dados), na marca e nas cores do próprio estilo. achadosDaMarca compara as duas: só é aviso o que a marca causou.
const lumRgb = ([r, g, b]) => [r, g, b].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
const razao = (a, b) => { const [x, y] = [a, b].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const paraHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const deHex = (h) => { const v = parseInt(String(h).replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const ESCONDE_TEXTO = '.lamina *{color:transparent !important;-webkit-text-fill-color:transparent !important;text-shadow:none !important}';
// Mede uma página de lâminas: [{ lamina, foraDaBorda, textos: [{ k, texto, tamanho, decorativo, coberto, contraste, cor,
// efetiva, alfa, sobreFoto, amostras }] }]. `contraste` é o pior dos quantis 25/50/75 da luz do fundo sob o texto (com o texto
// escondido), como no conferidor; `amostras` são as cores do fundo nos quantis 10/25/50/75/90, do mais escuro ao mais claro.
// Sem o pngjs, `contraste` fica null (o conferidor também não mede).
async function medirLegibilidade(html, canvas) {
  const conferir = (modulos && modulos.conferir) || require('../carrossel/conferir');
  const { render } = carregar();
  let PNG = null;
  try { ({ PNG } = require('pngjs')); } catch { /* sem pngjs: sem contraste */ }
  const { pagina, fechar } = await render.abrirPagina(html, canvas);
  try {
    const regs = await pagina.evaluate(conferir.medirNaPagina, { apenas: null });
    // O que está debaixo do meio do texto, de cima para baixo, até a primeira coisa opaca:
    // - foto: uma foto (JPEG ou WebP, em <img> ou como fundo). Uma caixa de cor por cima da foto esconde a foto;
    // - imagem: um desenho que não é foto (PNG ou SVG, em <img>, <svg> ou como fundo, como o prato do Concreto Ácido ou a
    //   pincelada do Caderno), menor que a lâmina (as texturas de fundo da lâmina inteira não contam).
    const debaixo = await pagina.evaluate((caixas) => {
      const lams = [...document.querySelectorAll('.lamina')];
      const foto = (s) => /^data:image\/(jpeg|webp)|\.(jpe?g|webp)(["')?#]|$)/i.test(String(s || ''));
      const fundo = (e) => { const b = getComputedStyle(e).backgroundImage; return /url\(/.test(b) ? b.replace(/^url\(["']?/, '') : null; };
      const ehFoto = (e) => (e.tagName === 'IMG' ? foto(e.currentSrc || e.src) : !!fundo(e) && foto(fundo(e)));
      const opaco = (e) => { const c = getComputedStyle(e); const m = c.backgroundColor.match(/[\d.]+/g); const a = m ? (m.length > 3 ? Number(m[3]) : 1) : 0; return a >= 0.9 && Number(c.opacity) >= 0.9 && c.visibility !== 'hidden'; };
      return caixas.map(({ indice, textos: ts }) => {
        const lam = lams[indice];
        lam.scrollIntoView({ block: 'start', inline: 'start' });
        const L = lam.getBoundingClientRect();
        const menorQueALamina = (e) => { const b = e.getBoundingClientRect(); return b.width * b.height < 0.9 * L.width * L.height; };
        const ehImagem = (e) => menorQueALamina(e) && (e.tagName === 'IMG' || e.tagName.toLowerCase() === 'svg' || !!fundo(e));
        return ts.map((t) => {
          const r = { foto: false, imagem: false };
          for (const e of document.elementsFromPoint(L.left + t.x + t.w / 2, L.top + t.y + t.h / 2)) {
            if (!lam.contains(e)) continue;
            if (ehFoto(e)) { r.foto = true; break; }
            if (ehImagem(e)) { r.imagem = true; break; } // o desenho está por cima do que houver embaixo
            if (opaco(e)) break;
          }
          return r;
        });
      });
    }, regs.map((r) => ({ indice: r.indice, textos: r.textos.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h })) })));
    let lams = null;
    if (PNG) { await pagina.addStyleTag({ content: ESCONDE_TEXTO }); lams = await pagina.$$('.lamina'); }
    const saida = [];
    for (const [i, reg] of regs.entries()) {
      const img = lams ? PNG.sync.read(await lams[reg.indice].screenshot({ type: 'png', animations: 'disabled' })) : null;
      const textos = reg.textos.map((t, k) => {
        const item = { k, texto: t.texto.replace(/\s+/g, ' ').trim(), tamanho: t.fs, decorativo: !!t.decorativo, coberto: !!t.cobertoPor, contraste: null,
          cor: t.cor.slice(0, 3), efetiva: t.cor.slice(0, 3), alfa: +(t.cor[3] * t.opac).toFixed(2),
          sobreFoto: !!((debaixo[i] || [])[k] || {}).foto, sobreImagem: !!((debaixo[i] || [])[k] || {}).imagem, amostras: [] };
        if (!img) return item;
        const px = [];
        for (const c of (t.linhas && t.linhas.length ? t.linhas : [t])) {
          const x0 = Math.max(0, Math.floor(c.x)); const y0 = Math.max(0, Math.floor(c.y));
          const x1 = Math.min(img.width, Math.ceil(c.x + c.w)); const y1 = Math.min(img.height, Math.ceil(c.y + c.h));
          for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { const j = (y * img.width + x) * 4; const p = [img.data[j], img.data[j + 1], img.data[j + 2]]; px.push([lumRgb(p), p]); }
        }
        if (!px.length) return item;
        px.sort((a, b) => a[0] - b[0]);
        const media = [0, 1, 2].map((j) => px.reduce((s, p) => s + p[1][j], 0) / px.length);
        const a = t.cor[3] * t.opac;
        item.efetiva = [0, 1, 2].map((j) => a * t.cor[j] + (1 - a) * media[j]);
        const lf = lumRgb(item.efetiva);
        const quantil = (q) => px[Math.min(px.length - 1, Math.floor(q * px.length))];
        item.contraste = +Math.min(...[0.25, 0.5, 0.75].map((q) => razao(lf, quantil(q)[0]))).toFixed(2);
        item.amostras = [...new Set([0.1, 0.25, 0.5, 0.75, 0.9].map((q) => paraHex(quantil(q)[1])))];
        // para guardar (legibilidade.todos): o fundo médio e os quantis exatos da conta do contraste
        item.md = paraHex(media);
        item.q = [0.25, 0.5, 0.75].map((q) => paraHex(quantil(q)[1]));
        return item;
      });
      saida.push({ lamina: reg.indice + 1, foraDaBorda: conferir.checarForaDoCanvas(reg, { canvas }).length > 0, textos });
    }
    return saida;
  } finally { await fechar(); }
}

// O mínimo de contraste (decisão do responsável, correção do D5): texto grande (56 px ou mais na peça de 1080) pede 3:1; o
// resto, 4,5:1. O mesmo número vale para avisar e para pedir sugestões, sobre foto ou não.
const minimoDe = (tamanho) => (tamanho >= 56 ? 3 : 4.5);
// Sem o módulo de sugestões: não há opção possível só quando NENHUMA cor passaria contra todas as amostras do fundo.
function nenhumaCorPassa(amostras, minimo) {
  const lums = amostras.map((h) => lumRgb(deHex(h)));
  for (let i = 0; i <= 1000; i++) { const l = i / 1000; if (Math.min(...lums.map((f) => razao(l, f))) >= minimo) return false; }
  return true;
}
// As sugestões de cor são da etapa 8 (08-FERRAMENTAS/marca/legibilidade.js). Enquanto o módulo não está neste ramo, vale o
// arquivo de FABRICA_LEGIBILIDADE (os testes usam); sem nenhum, semOpcao usa nenhumaCorPassa.
let sugerirCarregado;
function carregarSugerir() {
  if (sugerirCarregado !== undefined) return sugerirCarregado;
  sugerirCarregado = null;
  for (const arq of [path.join(__dirname, '..', 'marca', 'legibilidade.js'), process.env.FABRICA_LEGIBILIDADE].filter(Boolean)) {
    try { if (fs.existsSync(arq)) { sugerirCarregado = require(path.resolve(arq)).sugerir; break; } } catch { /* sem o módulo */ }
  }
  return sugerirCarregado;
}

// Compara a medição na marca com a das cores do próprio estilo (`base`, a mesma peça) e devolve { avisos, textos }:
// - texto com contraste abaixo do mínimo: { tipo, papel, papelAproximado, cor, alfa, tamanho, contraste, contrasteBase, minimo,
//   piorou, sobreFoto, sobreImagem, semOpcao, fundo: { amostras } } — o papel é o da cor do texto; numa mistura de cores, o
//   papel da marca mais perto da cor que aparece (papelAproximado: true);
//   - piorou: a marca é a causa — a base passa no mínimo, ou a marca piorou claramente o que a base já tinha fraco (menos
//     0,5 do contraste da base E menos de 80% dele);
//   - tipo 'contraste': uma cor resolve (semOpcao falso); daMarca = piorou, e só aí sai "Com as suas cores...";
//   - tipo 'estilo': nenhuma cor resolve (semOpcao verdadeiro: o fundo debaixo do texto vai do escuro ao claro, como um
//     desenho atravessando o texto); daMarca falso (não há cor a sugerir) e, se piorou, o aviso fala do estilo;
// - texto coberto por outra parte da peça: { tipo: 'coberto' }, sem sugestão de cor (daMarca: a base não está coberta).
// Texto que passa da borda só vira aviso (não tem cor a sugerir), também só quando a base não passa.
function achadosDaMarca({ formato, marca, base = null, cores, sugerir = null }) {
  const onde = ONDE[formato] || ONDE.carrossel;
  const papeis = Object.entries(cores).map(([p, h]) => [p, deHex(h)]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const avisos = [];
  const textos = [];
  for (const lam of marca) {
    const b = base && base.find((x) => x.lamina === lam.lamina);
    const o = onde(lam.lamina);
    for (const t of lam.textos) {
      if (t.decorativo) continue;
      const bt = b && b.textos.find((x) => x.k === t.k && x.texto === t.texto);
      const texto = t.texto.length > 40 ? t.texto.slice(0, 39) + '…' : t.texto;
      if (t.coberto) {
        const daMarca = !(bt && bt.coberto);
        textos.push({ tipo: 'coberto', formato, lamina: lam.lamina, onde: o, texto, daMarca });
        if (daMarca) avisos.push(`Com as suas letras, o texto ${o} fica coberto por outra parte da peça.`);
        continue;
      }
      if (t.contraste === null || t.contraste === undefined) continue;
      const minimo = minimoDe(t.tamanho);
      if (t.contraste >= minimo) continue;
      const contrasteBase = bt && !bt.coberto && typeof bt.contraste === 'number' ? bt.contraste : null;
      const basePassa = contrasteBase === null || contrasteBase >= minimoDe(bt.tamanho);
      const piorou = basePassa || (t.contraste < contrasteBase - 0.5 && t.contraste < 0.8 * contrasteBase);
      const exato = papeis.find(([, c]) => dist(c, t.cor) <= 3);
      const papel = exato ? exato[0] : papeis.slice().sort((x, y) => dist(x[1], t.efetiva) - dist(y[1], t.efetiva))[0][0];
      let semOpcao;
      try { semOpcao = sugerir ? sugerir({ papel, cores, fundo: { amostras: t.amostras }, minimo }).length === 0 : nenhumaCorPassa(t.amostras, minimo); } catch { semOpcao = nenhumaCorPassa(t.amostras, minimo); }
      const tipo = semOpcao ? 'estilo' : 'contraste';
      textos.push({ tipo, formato, lamina: lam.lamina, onde: o, texto, daMarca: tipo === 'contraste' && piorou, piorou, papel, papelAproximado: !exato,
        cor: paraHex(t.cor), alfa: t.alfa, tamanho: t.tamanho, contraste: t.contraste, contrasteBase, minimo,
        sobreFoto: !!t.sobreFoto, sobreImagem: !!t.sobreImagem, semOpcao, fundo: { amostras: t.amostras } });
      if (piorou) avisos.push(tipo === 'contraste' ? `Com as suas cores, o texto ${o} fica difícil de ler.` : `Com a sua marca, este estilo deixa o texto ${o} difícil de ler; que tal outro estilo?`);
    }
    if (lam.foraDaBorda && !(b && b.foraDaBorda)) avisos.push(`Com as suas letras, o texto ${o} passa da borda.`);
  }
  return { avisos: [...new Set(avisos)], textos };
}

// Todos os textos medidos, compactos (legibilidade.todos, sem corte): { f, l, k, t, p (papel da cor do texto, só exato), c, al,
// md, q (quantis 25/50/75 do fundo), m, ct }. É com eles que uma cor sugerida é conferida contra TODOS os textos da empresa
// (previas-marca.estragaria): nenhum texto que hoje se lê pode ficar difícil.
function guardados(formato, medida, cores) {
  const papeis = Object.entries(cores).map(([p, h]) => [p, deHex(h)]);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const saida = [];
  for (const lam of medida) for (const t of lam.textos) {
    if (t.decorativo || t.coberto || typeof t.contraste !== 'number' || !t.q) continue;
    const exato = papeis.find(([, c]) => dist(c, t.cor) <= 3);
    saida.push({ f: formato, l: lam.lamina, k: t.k, t: t.texto.slice(0, 40), p: exato ? exato[0] : null, c: paraHex(t.cor), al: t.alfa, md: t.md, q: t.q, m: minimoDe(t.tamanho), ct: t.contraste });
  }
  return saida;
}

const NOME_DA_LETRA = { principal: 'principal', mono: 'dos rótulos', acento: 'de destaque' };
// As letras que a prévia usa são exatamente as que entram na assinatura (previas-marca.arquivosDaMarca): a que falta, ou que
// aponta para fora da pasta da empresa, fica de fora (a peça cai na letra padrão) e vira aviso. No --marca-arquivo, vale a
// regra do leitor de marca (marca.caminho), sem caminho absoluto e sem a pasta antiga (06-MARCA-E-FOTOS, fora de exemplo/),
// que seriam de uma empresa que não foi dita. A letra que a marca não cita e herda do exemplo (valor efetivo, como no marca.js)
// também vale.
function fixarLetras(marca, resolvidas) {
  const avisos = [];
  // os valores efetivos antes de mexer (marca.pega já traz a herança do marca.exemplo.yaml)
  const efetivas = Object.fromEntries(['principal', 'mono', 'acento'].map((p) => [p, String(marca.pega(`tipografia.${p}.arquivo`, '') || '').trim()]));
  if (!marca.dados.tipografia || typeof marca.dados.tipografia !== 'object') marca.dados.tipografia = {};
  const tip = marca.dados.tipografia;
  const daEmpresaSemNome = (rel) => path.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[A-Za-z]:|^[\\/]/.test(rel)
    || (/^06-marca-e-fotos([\\/]|$)/i.test(path.normalize(rel).replace(/\\/g, '/')) && !/^06-marca-e-fotos\/exemplo(\/|$)/i.test(path.normalize(rel).replace(/\\/g, '/')));
  for (const papel of ['principal', 'mono', 'acento']) {
    if (!tip[papel] || typeof tip[papel] !== 'object') tip[papel] = {};
    const citada = typeof tip[papel].arquivo === 'string' && tip[papel].arquivo.trim() !== '';
    let abs = null;
    if (resolvidas) abs = resolvidas[papel];
    else if (efetivas[papel] && !daEmpresaSemNome(efetivas[papel])) { try { abs = marca.caminho(efetivas[papel]); } catch { abs = null; } if (abs && !fs.existsSync(abs)) abs = null; }
    tip[papel].arquivo = abs || '';
    if (citada && !abs) avisos.push(`A letra ${NOME_DA_LETRA[papel]} da sua marca não foi encontrada; a prévia usa a letra padrão.`);
  }
  return avisos;
}

// Prévias na marca: um estilo por vez; erro num estilo não para os outros. Imprime "estilos: N", uma linha por estilo
// ("ok   <id>: ...", "erro <id>: ..." ou "refazer <id>: ..." quando a marca mudou no meio) e, no fim, "feitos: X/N".
//
// No --marca, a marca é lida UMA vez (previas-marca.instantaneoDaMarca: o marca.yaml e as letras) e a assinatura sai desse
// mesmo conteúdo: as letras usadas são cópias do instantâneo, numa pasta de trabalho, e o marca.js carregado precisa bater
// com o instantâneo. Antes de gravar cada estilo, a assinatura é conferida de novo no disco: mudou, o estilo não é gravado.
async function principalMarca(a) {
  if (modoCarga === 'base') throw new Error('as prévias na marca rodam como comando, num processo próprio (veja gerarImagensNaMarca)');
  const empresaMod = require('../../_fabrica/core/empresa');
  const pm = require('./previas-marca');
  const r = empresaMod.raiz();
  const cores = (marca) => Object.fromEntries(['escuro', 'claro', 'acento', 'neutro'].map((p) => [p, marca.hex(p)]));
  const conta = (marca) => { const h = String(marca.dados.empresa?.handle || '').trim().replace(/^@+/, ''); return h ? '@' + h : ''; };
  let naMarca;
  let letrasDoInstantaneo = null;
  if (a.marca !== null) {
    const entrada = empresaMod.listar(r).find((e) => e.codigo === a.marca);
    const inst = pm.instantaneoDaMarca(r, a.marca);
    if (!inst.definida) {
      console.error(`A empresa ${entrada.nome} ainda não tem marca definida; as prévias na marca precisam dela.`);
      return 1;
    }
    const { marca } = carregar();
    if (path.resolve(marca.ARQUIVO).toLowerCase() !== path.resolve(inst.marca).toLowerCase()) {
      throw new Error(`a marca carregada (${marca.ARQUIVO}) não é a da empresa ${a.marca}; nada foi gravado`);
    }
    if (pm.assinaturaDosDados(r, a.marca, marca.dados, inst.letras) !== inst.assinatura) {
      throw new Error('a marca mudou enquanto a geração começava; rode de novo (nada foi gravado)');
    }
    // as letras da rodada são as do instantâneo (cópias), nunca as do disco, que podem mudar no meio
    letrasDoInstantaneo = fs.mkdtempSync(path.join(os.tmpdir(), 'previas-letras-'));
    const letras = {};
    for (const [papel, l] of Object.entries(inst.letras)) {
      if (!l.bytes) { letras[papel] = null; continue; }
      letras[papel] = path.join(letrasDoInstantaneo, papel + path.extname(l.arquivo).toLowerCase());
      fs.writeFileSync(letras[papel], l.bytes);
    }
    naMarca = {
      empresa: a.marca, assinatura: inst.assinatura, identidade: a.identidade || 'empresa', cores: cores(marca),
      ident: { nome: String(marca.dados.empresa?.nome || '').trim() || entrada.nome, conta: conta(marca) },
      avisos: fixarLetras(marca, letras), saida: pm.pastaDaEmpresa(r, a.marca),
      conferir: () => pm.assinaturaDaMarca(r, a.marca).assinatura === inst.assinatura,
    };
  } else {
    const { marca } = carregar();
    // com --empresa, as letras citadas são procuradas na pasta da empresa, como as da marca gravada dela
    const entrada = a.empresa ? empresaMod.listar(r).find((e) => e.codigo === a.empresa) : null;
    const letras = a.empresa ? pm.arquivosDosDados(r, a.empresa, JSON.parse(JSON.stringify(marca.dados))).letras : null;
    naMarca = {
      empresa: null, assinatura: null, identidade: a.identidade || 'empresa', cores: cores(marca),
      ident: { nome: String(marca.dados.empresa?.nome || '').trim() || (entrada ? entrada.nome : IDENTIDADE.nome), conta: conta(marca) },
      avisos: fixarLetras(marca, letras), saida: a.saida,
    };
  }
  if (naMarca.identidade === 'exemplo') naMarca.ident = IDENTIDADE;
  try {
    const todos = carregar().molde.listarEstilos();
    const ids = a.ids.length ? a.ids : todos;
    const desconhecidos = ids.filter((id) => !todos.includes(id));
    if (desconhecidos.length) throw new Error(`estilo desconhecido: ${desconhecidos.join(', ')}. Disponíveis: ${todos.join(', ')}`);
    console.log(`estilos: ${ids.length}`);
    let feitos = 0;
    for (const id of ids) {
      try {
        const m = await gerarImagens(id, { saida: naMarca.saida, limiteEstilo: a.limiteEstilo, naMarca });
        feitos++;
        console.log(`ok   ${id}: ${arquivosDoManifesto(semVideo(m)).length} imagens, ${Math.round(m.bytesImagens / 1000)} KB${m.avisos.length ? `, ${m.avisos.length} aviso(s)` : ''}`);
      } catch (e) { console.log(`${e.refazer ? 'refazer' : 'erro'} ${id}: ${String(e.message).split('\n')[0]}`); }
    }
    console.log(`feitos: ${feitos}/${ids.length}`);
    return feitos === ids.length ? 0 : 1;
  } finally { if (letrasDoInstantaneo) fs.rmSync(letrasDoInstantaneo, { recursive: true, force: true }); }
}

// Para os outros módulos (a fila): roda `gerar-previas.js --marca <codigo>` num processo filho (um por empresa, nunca no
// processo de quem chama), com FABRICA_RAIZ=r e sem FABRICA_MARCA, e avisa o progresso a cada estilo.
// Devolve { feitos, total, falhas: [{ id, erro }], refazer: [id] } (refazer: a marca mudou no meio, o estilo não foi gravado);
// recusa (rejeita) quando nada chegou a ser feito (empresa sem marca...).
// Limite de tempo: sem nenhum estilo terminar há `limiteSemAvancoMs`, o filho (e os filhos dele: Chromium, ffmpeg) é
// encerrado e a promessa rejeita com "tempo esgotado" (code ETIMEDOUT). `sinal` (AbortSignal): Pausar e Cancelar da fila
// encerram o filho em andamento; rejeita com code ABORTADO. `programa` troca o script do filho (os testes).
function gerarImagensNaMarca(r, codigo, { ids = [], identidade = 'empresa', aoAvancar = null, limiteSemAvancoMs = LIMITE_SEM_AVANCO_MS, sinal = null, programa = __filename } = {}) {
  const { spawn } = require('child_process');
  return new Promise((resolverJa, recusarJa) => {
    if (!ids.every((id) => typeof id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(id))) return recusarJa(new Error('estilo inválido na lista'));
    if (!['empresa', 'exemplo'].includes(identidade)) return recusarJa(new Error('a identidade é empresa ou exemplo'));
    const parado = () => Object.assign(new Error('a preparação das prévias foi parada (pausa ou cancelamento)'), { code: 'ABORTADO' });
    if (sinal && sinal.aborted) return recusarJa(parado());
    const env = { ...process.env, FABRICA_RAIZ: path.resolve(r), FABRICA_SILENCIO_EXEMPLO: '1' };
    delete env.FABRICA_MARCA;
    delete env.FABRICA_EMPRESA;
    const filho = spawn(process.execPath, [programa, ...ids, '--marca', String(codigo), '--identidade', identidade],
      { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    // um fim só: o relógio, o sinal e o fim do filho disputam; quem chega primeiro decide, e o filho é encerrado
    let acabou = false;
    let relogio = null;
    const aoParar = () => terminar(recusarJa, parado(), true);
    function terminar(fn, valor, encerrarFilho = false) {
      if (acabou) return;
      acabou = true;
      clearTimeout(relogio);
      if (sinal) sinal.removeEventListener('abort', aoParar);
      if (encerrarFilho) { try { require('./video-marca').encerrar(filho); } catch (e) { console.error('Não consegui encerrar a geração das prévias:', e.message); } }
      fn(valor);
    }
    const resolver = (v) => terminar(resolverJa, v);
    const recusar = (e) => terminar(recusarJa, e);
    const armar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => terminar(recusarJa, Object.assign(new Error(`tempo esgotado: nenhum estilo ficou pronto em ${Math.round(limiteSemAvancoMs / 1000)} s`), { code: 'ETIMEDOUT' }), true), limiteSemAvancoMs);
    };
    armar();
    if (sinal) sinal.addEventListener('abort', aoParar, { once: true });
    let total = ids.length || null;
    let feitos = 0;
    let resumo = false;
    const falhas = [];
    const refazer = [];
    let resto = '';
    let erros = '';
    const linha = (l) => {
      let x;
      if (acabou) return; // parado ou sem tempo: o que o filho ainda escrever não vale
      if (/^(estilos: |ok |erro |refazer )/.test(l)) armar(); // um estilo terminou (ou a rodada começou): o relógio recomeça
      if ((x = /^estilos: (\d+)$/.exec(l))) total = Number(x[1]);
      else if ((x = /^ok +([a-z0-9-]+):/.exec(l))) { feitos++; if (aoAvancar) aoAvancar({ id: x[1], ok: true, feitos, total }); }
      else if ((x = /^erro ([a-z0-9-]+): (.*)$/.exec(l))) { falhas.push({ id: x[1], erro: x[2] }); if (aoAvancar) aoAvancar({ id: x[1], ok: false, erro: x[2], feitos, total }); }
      else if ((x = /^refazer ([a-z0-9-]+): (.*)$/.exec(l))) { refazer.push(x[1]); if (aoAvancar) aoAvancar({ id: x[1], ok: false, refazer: true, erro: x[2], feitos, total }); }
      else if ((x = /^feitos: (\d+)\/(\d+)$/.exec(l))) { resumo = true; feitos = Number(x[1]); total = Number(x[2]); }
    };
    filho.stdout.setEncoding('utf8');
    filho.stdout.on('data', (d) => { resto += d; const ls = resto.split(/\r?\n/); resto = ls.pop(); ls.forEach(linha); });
    filho.stderr.setEncoding('utf8');
    filho.stderr.on('data', (d) => { erros = (erros + d).slice(-4000); });
    filho.on('error', recusar);
    filho.on('close', (cod) => {
      if (resto) linha(resto);
      if (resumo) return resolver({ feitos, total, falhas, refazer });
      const msg = erros.trim().split(/\r?\n/).filter(Boolean).pop() || `a geração das prévias parou (saída ${cod})`;
      recusar(new Error(msg.replace(/^Erro: /, '')));
    });
  });
}

const AJUDA = [
  'uso: node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] [--saida <pasta>] [--limite-estilo <bytes>]',
  '     node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --video <pedido.json> [--reusar <pasta-dos-mp4>]',
  '     node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --marca <codigo> [--identidade empresa|exemplo]',
  '     node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --marca-arquivo <marca.yaml> --saida <pasta> [--empresa <codigo>]',
  '     node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --estilos <estilos próprios da empresa> --saida <prévias da empresa>/proprios',
  '  sem ids, gera os estilos todos; a saída padrão é 04-LABORATORIO-DE-DESIGN/biblioteca/previas',
  '  --video: faz só o vídeo de 6 s (a partir do primeiro B-roll do pedido). Só vai para previas/ se o pedido disser "liberado": true;',
  '           senão vai para previas-locais/, que fica fora do repositório (mesmo com --saida; só --saida-local troca essa pasta).',
  '           --reusar usa os <modelo>.mp4 já montados na pasta indicada.',
].join('\n');

function argumentos(argv) {
  const a = { ids: [], saida: PASTA_PADRAO, saidaLocal: null, limiteEstilo: LIMITE_ESTILO, video: null, reusar: null, marca: null, marcaArquivo: null, identidade: null, saidaPedida: false, estilos: null };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--saida') { a.saida = path.resolve(argv[++i] || ''); a.saidaPedida = true; }
    else if (v === '--estilos') a.estilos = argv[++i] || '';
    else if (v === '--marca') a.marca = argv[++i] || '';
    else if (v === '--marca-arquivo') a.marcaArquivo = argv[++i] || '';
    else if (v === '--identidade') a.identidade = argv[++i] || '';
    else if (v === '--empresa') a.empresa = argv[++i] || '';
    else if (v === '--saida-local') a.saidaLocal = path.resolve(argv[++i] || '');
    else if (v === '--limite-estilo') a.limiteEstilo = Number(argv[++i]);
    else if (v === '--video') a.video = argv[++i] || '';
    else if (v === '--reusar') a.reusar = argv[++i] || '';
    else if (v === '--ajuda' || v === '-h') a.ajuda = true;
    else if (v.startsWith('--')) throw new Error(`opção desconhecida: ${v}`);
    else a.ids.push(v);
  }
  if (!Number.isFinite(a.limiteEstilo) || a.limiteEstilo <= 0) throw new Error('--limite-estilo pede um número de bytes');
  if (a.reusar !== null && a.video === null) throw new Error('--reusar só vale junto com --video <pedido.json>');
  const naMarca = a.marca !== null || a.marcaArquivo !== null;
  if (a.identidade !== null && !naMarca) throw new Error('--identidade só vale com --marca ou --marca-arquivo');
  if (a.identidade !== null && !['empresa', 'exemplo'].includes(a.identidade)) throw new Error('--identidade pede empresa ou exemplo');
  if (a.estilos !== null) {
    if (naMarca || a.video !== null || a.reusar !== null || a.saidaLocal !== null || a.empresa !== undefined) throw new Error('--estilos só vale nas prévias base: não vale com --marca, --marca-arquivo, --empresa, --video nem --saida-local');
    if (!a.estilos) throw new Error('faltou a pasta depois de --estilos');
    if (!a.saidaPedida) throw new Error('--estilos pede --saida <pasta> (para o estilo próprio de uma empresa, a pasta previas/proprios dela)');
    a.estilos = path.resolve(a.estilos);
    conferirPastasDoProprio(a.estilos, a.saida);
  }
  if (naMarca && (a.video !== null || a.saidaLocal !== null)) throw new Error('o vídeo na marca não é feito por este comando: --video não vale com --marca nem com --marca-arquivo');
  if (a.marca !== null && a.saidaPedida) throw new Error('--saida não vale com --marca: as prévias na marca vão sempre para a pasta da empresa');
  if (a.marcaArquivo !== null) {
    if (!a.saidaPedida) throw new Error('--marca-arquivo pede --saida <pasta> (uma pasta fora das prévias base)');
    const rel = path.relative(PASTA_PADRAO, a.saida);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) throw new Error('--saida não pode ficar dentro das prévias base (04-LABORATORIO-DE-DESIGN/biblioteca/previas)');
    // --empresa <c>: as letras são as da pasta da empresa; --saida nunca cai na pasta de outra empresa (sem --empresa, de nenhuma)
    const empresaMod = require('../../_fabrica/core/empresa');
    const r = empresaMod.raiz();
    if (a.empresa !== undefined && (!/^[a-z0-9][a-z0-9-]*$/.test(a.empresa) || !empresaMod.listar(r).some((e) => e.codigo === a.empresa))) {
      throw new Error(`A empresa ${JSON.stringify(String(a.empresa).slice(0, 60))} não existe nesta pasta.`);
    }
    for (const empresas of [path.join(r, 'empresas'), path.join(RAIZ, 'empresas')]) {
      const rel = path.relative(empresas, a.saida);
      if (rel === '' || (rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel) && rel.split(path.sep)[0] !== a.empresa)) {
        throw new Error('--saida não pode ficar na pasta de outra empresa');
      }
    }
    // nem nas prévias da própria empresa: lá só entra a marca gravada, com a assinatura dela
    if (a.empresa !== undefined) {
      const rel = path.relative(require('./previas-marca').pastaDaEmpresa(r, a.empresa), a.saida);
      if (rel === '' || (rel.split(path.sep)[0] !== '..' && !path.isAbsolute(rel))) throw new Error('--saida não pode ficar nas prévias na marca da empresa (lá só entra a marca gravada)');
    }
  } else if (a.empresa !== undefined) throw new Error('--empresa só vale com --marca-arquivo (no --marca, a empresa já é a da marca)');
  return a;
}

// Vídeo: um trecho por estilo. Erro de um estilo não para os outros; no fim, sai 1 se algum falhou. O peso só conta (e só
// é conferido) para o que foi gravado em previas/; o que fica em previas-locais/ não entra na conta.
async function principalVideo(a, ids) {
  lerPedidoVideo(a.video); // erro do pedido (sem B-roll, arquivo que falta) aparece antes de qualquer trabalho
  const manifestos = [];
  const falhas = [];
  const mp4s = new Map();
  for (const id of ids) {
    try {
      const r = gerarVideo(id, a.video, { saida: a.saida, saidaLocal: a.saidaLocal, reusar: a.reusar, mp4s });
      const kb = Math.round((r.manifesto.bytes) / 1000);
      if (r.liberado) { manifestos.push(r.manifesto); console.log(`ok   ${id}: vídeo de ${DURACAO_TRECHO} s gravado em previas/ (${kb} KB no estilo)`); }
      else console.log(`ok   ${id}: vídeo de ${DURACAO_TRECHO} s gravado só na sua máquina, em previas-locais (fora do repositório): ${r.pasta}`);
    } catch (e) { falhas.push(id); console.error(`Erro em ${id}: ${e.message}`); }
  }
  let saida = falhas.length ? 1 : 0;
  if (manifestos.length) saida = Math.max(saida, relatarPeso(manifestos, a.limiteEstilo));
  if (falhas.length) console.error(`Falharam: ${falhas.join(', ')}.`);
  return saida;
}

function relatarPeso(manifestos, limiteEstilo) {
  const peso = conferirPeso(manifestos, { limiteEstilo });
  console.log(`total: ${(peso.total / 1e6).toFixed(2)} MB em ${manifestos.length} estilo(s)`);
  let saida = 0;
  if (peso.acima.length) {
    console.error(`Estilo(s) acima de ${Math.round(limiteEstilo / 1000)} KB: ${peso.acima.map((id) => `${id} (${Math.round(peso.porEstilo[id] / 1000)} KB)`).join(', ')}. Os arquivos ficaram gravados para você olhar.`);
    const passaram = manifestos.filter((m) => !peso.acima.includes(m.estilo)).map((m) => m.estilo);
    console.error(`Passaram: ${passaram.join(', ') || 'nenhum'}.`);
    saida = 1;
  }
  if (peso.total > LIMITE_TOTAL) { console.error(`O total passou de ${LIMITE_TOTAL / 1e6} MB.`); saida = 1; }
  return saida;
}

async function principal(argv) {
  const a = argumentos(argv);
  if (a.ajuda) { console.log(AJUDA); return 0; }
  if (a.marca !== null || a.marcaArquivo !== null) return principalMarca(a);
  if (a.estilos !== null) return principalProprios(a);
  const todos = carregar().molde.listarEstilos();
  const ids = a.ids.length ? a.ids : todos;
  const desconhecidos = ids.filter((id) => !todos.includes(id));
  if (desconhecidos.length) throw new Error(`estilo desconhecido: ${desconhecidos.join(', ')}. Disponíveis: ${todos.join(', ')}`);
  if (a.video !== null) return principalVideo(a, ids);
  const manifestos = [];
  for (const id of ids) {
    const m = await gerarImagens(id, { saida: a.saida, limiteEstilo: a.limiteEstilo });
    manifestos.push(m);
    console.log(`ok   ${id}: ${arquivosDoManifesto(m).length} imagens, ${Math.round(m.bytes / 1000)} KB`);
  }
  return relatarPeso(manifestos, a.limiteEstilo);
}

module.exports = { arquivoDaMarca, opcoesDoRender, gerarImagens, gerarImagensNaMarca, comIdentidade, achadosDaMarca, medirLegibilidade, gerarVideo, pastaLocal, cortarTrecho, lerPedidoVideo, pngParaWebp, limparAntigos, conferirPeso, principal, rodarComLimite, DURACAO_TRECHO, LIMITE_ESTILO, LIMITE_TOTAL, PASTA_PADRAO, PASTA_LOCAL_PADRAO,
  LIMITE_FFMPEG_MS, LIMITE_FFPROBE_MS, LIMITE_CORTE_MS, LIMITE_SEM_AVANCO_MS };

if (require.main === module) {
  principal(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error('Erro: ' + e.message); process.exit(1); });
}
