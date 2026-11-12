#!/usr/bin/env node
// Gerador de carrossel: conteúdo das lâminas (JSON) + estilo do catálogo + marca.yaml -> lâminas em PNG, HTML
// autocontido, prévia no simulador de Instagram e relatório do conferidor. Nenhuma etapa usa API de imagem (I-16).
//
// Primeiro passo: renderiza só a PRIMEIRA lâmina e para (DG-18, C21). Com a primeira aprovada, o segundo passo
// renderiza o resto, confere tudo e monta a prévia.
//
//   node 08-FERRAMENTAS/carrossel/gerar.js <conteudo.json> --saida <pasta> [--estilo id] [--cores original|marca] [--formato carrossel|post|fixados|reels]
//   node 08-FERRAMENTAS/carrossel/gerar.js <conteudo.json> --saida <pasta> --resto    (só depois de aprovar a primeira)
//   node 08-FERRAMENTAS/carrossel/gerar.js <conteudo.json> --saida <pasta> --entregar  (só depois de aprovar o preview, F3)
//
// conteudo.json: { "estilo": "id", "legenda": "...", "laminas": [ { kicker, titulo, subtitulo, corpo, ..., visual } ] }
// ou só a lista de lâminas (e então vale --estilo ou, sem ele, o estilo escolhido pela empresa ativa).
// Estilo da empresa: sem --estilo nem "estilo" no conteúdo, vale o estilo escolhido pela empresa ativa (estilo.json, pelo
// _fabrica/core/estilo-da-linha.js). Um estilo próprio da empresa é lido da pasta de estilos próprios DELA (nunca da de outra)
// e renderizado e conferido com a rede fechada (render.abrirPagina com bloquearRede). Sem --cores, as cores são as da marca. Em `visual`, `descricao` diz que imagem ajudaria e
// `alternativa` é o visual que entra se o arquivo `arquivo` não existir (D1: a lâmina nunca fica vazia).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const marca = require(path.join(__dirname, '..', 'marca', 'marca'));
const molde = require('./molde');
const render = require('./render');
const conferir = require('./conferir');
const { gerarPreview, gerarPreviewGrade } = require('./preview');
const empresaMod = require(path.join(__dirname, '..', '..', '_fabrica', 'core', 'empresa'));
const estiloDaLinha = require(path.join(__dirname, '..', '..', '_fabrica', 'core', 'estilo-da-linha'));
const estilosProprios = require(path.join(__dirname, '..', '..', '_fabrica', 'core', 'estilos-proprios'));

function argumentos(argv) {
  const a = { posicionais: [], resto: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === '--resto') a.resto = true;
    else if (v === '--entregar') a.entregar = true;
    else if (['--saida', '--estilo', '--cores', '--formato'].includes(v)) a[v.slice(2)] = argv[++i];
    else if (v === '--ajuda' || v === '-h') a.ajuda = true;
    else if (v.startsWith('--')) throw new Error(`opção desconhecida: ${v}`);
    else a.posicionais.push(v);
  }
  return a;
}
const AJUDA = `uso: node 08-FERRAMENTAS/carrossel/gerar.js <conteudo.json> --saida <pasta> [--estilo id] [--cores original|marca] [--formato carrossel|post|fixados|reels] [--resto | --entregar]
  --formato: carrossel (padrão), post (post estático de feed: UMA imagem, no tamanho do feed), fixados (os 3 posts fixados, 1080x1440) ou reels (capa de Reels, 1080x1920)
  sem --resto: renderiza só a primeira lâmina e para, para você aprovar
  com --resto: renderiza as demais, confere tudo e monta a prévia (só depois de aprovar a primeira)
  com --entregar: copia para <pasta>/entrega só o que saiu aprovado (só depois de aprovar o preview)`;

// O estilo escolhido pela empresa ativa (estilo.json), traduzido para a linha por _fabrica/core/estilo-da-linha.js; null sem
// empresa ativa, sem escolha ou com a marca vinda de FABRICA_MARCA. estilo.json quebrado não trava a peça: vale como sem
// escolha, com aviso.
function estiloDaEmpresa() {
  if (!marca.EMPRESA) return null;
  try {
    return estiloDaLinha.daEmpresa(empresaMod.raiz(), marca.EMPRESA);
  } catch (e) {
    console.log(`aviso: não consegui ler o estilo escolhido da empresa (${e.message}); vale o estilo do conteúdo ou de --estilo.`);
    return null;
  }
}
// O estilo da peça: o escolhido pela empresa, se for um estilo próprio dela com esse código; senão o catálogo; e, se o
// catálogo não tem, os estilos próprios da empresa ativa (só os dela: estilo de outra empresa nunca).
function lerEstiloDaPeca(id, daEmpresa) {
  if (daEmpresa && daEmpresa.carrossel && daEmpresa.carrossel.pastaEstilos && daEmpresa.id === id) return molde.lerEstilo(id, { pasta: daEmpresa.carrossel.pastaEstilos });
  try {
    return molde.lerEstilo(id);
  } catch (erroDoCatalogo) {
    if (!marca.EMPRESA || !/estilo não encontrado/.test(erroDoCatalogo.message)) throw erroDoCatalogo;
    const pasta = empresaMod.caminhos(marca.EMPRESA, empresaMod.raiz()).estilosProprios;
    if (!estilosProprios.listar(pasta).includes(id)) throw erroDoCatalogo;
    return molde.lerEstilo(id, { pasta });
  }
}

// D1 e I-16: a imagem que falta nunca trava a peça. Se há alternativa, ela entra; se não há, a peça pára e diz o que falta.
function resolverArquivos(conteudos) {
  const avisos = []; const erros = [];
  const novos = conteudos.map((c, i) => {
    let atual = c;
    let faltas = molde.arquivosDe(atual).filter((f) => !f.existe);
    if (faltas.length && atual.visual && atual.visual.alternativa) {
      avisos.push(`lâmina ${i + 1}: falta o arquivo ${faltas[0].caminho}; entrou a alternativa "${atual.visual.alternativa.tipo}"${atual.visual.descricao ? ` (imagem que ajudaria: ${atual.visual.descricao})` : ''}`);
      atual = { ...atual, visual: atual.visual.alternativa };
      faltas = molde.arquivosDe(atual).filter((f) => !f.existe);
    }
    for (const f of faltas) erros.push(`lâmina ${i + 1}: o arquivo ${f.caminho} (${f.onde}) não existe${atual.visual && atual.visual.descricao ? `. Imagem que ajudaria: ${atual.visual.descricao}` : ''}. Informe o arquivo, ou dê um \`alternativa\` ao visual (mockup, número ou objeto do estilo).`);
    return atual;
  });
  return { conteudos: novos, avisos, erros };
}

// F3: só sai da pasta de trabalho o que o conferidor aprovou e o responsável viu no preview. Se o conteúdo mudou depois
// da renderização, o que está nas imagens já não é o que está no arquivo: recusa.
function entregar({ saida, hash, total, estadoArq }) {
  if (!fs.existsSync(estadoArq)) throw new Error('não há peça nesta pasta: gere a primeira lâmina e depois o resto (--resto) antes de entregar');
  const estado = JSON.parse(fs.readFileSync(estadoArq, 'utf8'));
  if (!['completo', 'entregue'].includes(estado.etapa)) throw new Error('a peça ainda não foi renderizada por inteiro: rode com --resto, veja o preview e só então entregue');
  if (estado.hash !== hash) throw new Error('o conteúdo ou o estilo mudou depois da renderização. Rode sem --resto e depois com --resto de novo, e aprove o preview outra vez');
  if (!estado.aprovadoPeloConferidor) throw new Error('o conferidor reprovou a peça (veja conferencia.txt). Corrija só o que ele citou, rode --resto de novo e aprove o preview');
  const destino = path.join(saida, 'entrega');
  fs.mkdirSync(destino, { recursive: true });
  const arquivos = [...Array.from({ length: total }, (_, i) => `lamina-${String(i + 1).padStart(2, '0')}.png`), 'carrossel.html', 'legenda.txt'];
  for (const f of arquivos) {
    if (!fs.existsSync(path.join(saida, f))) throw new Error(`falta ${f} na pasta de trabalho`);
    fs.copyFileSync(path.join(saida, f), path.join(destino, f));
  }
  fs.writeFileSync(estadoArq, JSON.stringify({ ...estado, etapa: 'entregue', entregueEm: new Date().toISOString() }, null, 2));
  console.log(`Entregue em ${destino}\n${arquivos.map((f) => '  ' + f).join('\n')}`);
  return 0;
}

async function main() {
  const a = argumentos(process.argv.slice(2));
  if (a.ajuda) { console.log(AJUDA); return 0; }
  if (a.resto && a.entregar) throw new Error('--resto e --entregar são passos diferentes: um de cada vez');
  const arq = a.posicionais[0];
  if (!arq || !a.saida) { console.error(AJUDA); return 2; }
  const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
  const bruto = Array.isArray(j) ? j : j.laminas;
  if (!Array.isArray(bruto) || !bruto.length) throw new Error('o conteúdo precisa ter uma lista de lâminas');
  // O estilo: o pedido (--estilo), o do conteúdo ou, sem os dois, o escolhido pela empresa (estilo.json).
  const daEmpresa = estiloDaEmpresa();
  const idEstilo = a.estilo || j.estilo || (daEmpresa && daEmpresa.carrossel ? daEmpresa.id : null);
  if (!idEstilo) throw new Error('diga o estilo: "estilo" no JSON ou --estilo <id>. Disponíveis: ' + molde.listarEstilos().join(', '));
  const estilo = lerEstiloDaPeca(idEstilo, daEmpresa);
  // Estilo próprio (escrito a partir de referências de fora): renderiza e confere com a rede fechada.
  const opRender = estilo.proprio ? { bloquearRede: true } : {};
  // formato: carrossel (padrão), fixados (3 posts 3:4) ou reels (capa 9:16); canvas e área segura vêm do formato
  const formato = a.formato || (!Array.isArray(j) && j.formato) || 'carrossel';
  if (!molde.FORMATOS[formato]) throw new Error('--formato deve ser carrossel, post, fixados ou reels (veio "' + formato + '")');
  if (estilo.soReels && formato !== 'reels') throw new Error('o estilo ' + estilo.id + ' é só de capa de Reels: use --formato reels');
  const cfg = conferir.cfgDoFormato(conferir.cfgDaMarca(), formato);
  const legenda = (!Array.isArray(j) && j.legenda) || '';
  for (const n of molde.garantirTexturas(estilo)) console.log(`textura gerada: ${n}`);
  // `original` = as cores e fontes aprovadas do estilo (o mesmo que `sugestao`); `marca` = as do marca.yaml por cima do estilo.
  const cores = a.cores === 'original' ? 'sugestao' : (a.cores || 'marca');
  if (!['marca', 'sugestao'].includes(cores)) throw new Error(`--cores deve ser original, sugestao ou marca (veio "${a.cores}")`);
  const saida = path.resolve(a.saida);
  const dadosEstilo = fs.readdirSync(estilo.dir, { recursive: true }).filter((f) => !fs.statSync(path.join(estilo.dir, f)).isDirectory()).sort().map((f) => fs.readFileSync(path.join(estilo.dir, f), 'utf8')).join('\n');

  const { conteudos, avisos, erros } = resolverArquivos(bruto);
  for (const av of avisos) console.log('aviso: ' + av);
  if (erros.length) { console.error('A peça não pode ser montada:\n' + erros.map((e) => '  - ' + e).join('\n')); return 1; }

  // Copy primeiro: texto reprovado não vale a pena renderizar.
  const copy = conferir.conferirConteudo({ estilo, conteudos, legenda, cfg, formato });
  if (copy.length) { console.error('O texto não passa no conferidor; corrija antes de renderizar:\n' + conferir.relatorio(copy)); return 1; }

  const hash = crypto.createHash('sha1').update(JSON.stringify({ conteudos, legenda, estilo: estilo.id, cores, formato })).update(dadosEstilo).digest('hex');
  // A aprovação da primeira lâmina vale enquanto a primeira lâmina, o estilo, as cores e o total não mudam: corrigir a
  // lâmina 5 depois de uma reprovação do conferidor não obriga a aprovar a capa outra vez.
  const hashPrimeira = crypto.createHash('sha1').update(JSON.stringify({ primeira: conteudos[0], total: conteudos.length, estilo: estilo.id, cores, formato })).update(dadosEstilo).digest('hex');
  const estadoArq = path.join(saida, 'estado.json');
  const html = molde.pagina(estilo, conteudos, { cores, embutir: true, formato });
  const total = conteudos.length;
  const nome = (i) => path.join(saida, `lamina-${String(i + 1).padStart(2, '0')}.png`);

  if (a.entregar) return entregar({ saida, hash, total, estadoArq });

  if (!a.resto) {
    fs.mkdirSync(saida, { recursive: true });
    await render.renderizar({ html, saida, indices: [0], canvas: cfg.canvas, ...opRender });
    const r = await conferir.conferirRender({ estilo, conteudos, html, cfg, apenas: [0], formato });
    fs.writeFileSync(estadoArq, JSON.stringify({ etapa: 'primeira', hash, hashPrimeira, total, estilo: estilo.id, cores, formato }, null, 2));
    console.log(conferir.relatorio(r.achados, r.aviso));
    console.log(formato === 'post'
      ? `\nPost estático pronto: ${nome(0)}\nConfira a imagem. Estando certa, rode de novo com --resto para conferir tudo e montar a prévia.`
      : `\nPrimeira lâmina pronta: ${nome(0)}\nConfira a imagem. Estando certa, rode de novo com --resto para renderizar as outras ${total - 1}.`);
    return r.achados.length ? 1 : 0;
  }

  // Segundo passo: só depois da primeira, e só se o conteúdo não mudou desde então.
  if (!fs.existsSync(estadoArq) || !fs.existsSync(nome(0))) throw new Error('rode primeiro sem --resto: a primeira lâmina precisa existir e ser aprovada antes do lote (DG-18)');
  const estado = JSON.parse(fs.readFileSync(estadoArq, 'utf8'));
  const primeiraIgual = estado.hashPrimeira ? estado.hashPrimeira === hashPrimeira : estado.hash === hash;
  if (!primeiraIgual) throw new Error('a primeira lâmina, o estilo, as cores ou o número de lâminas mudou depois da aprovação. Rode sem --resto de novo para renderizar e aprovar a primeira outra vez');
  const resto = Array.from({ length: total - 1 }, (_, i) => i + 1);
  if (resto.length) await render.renderizar({ html, saida, indices: resto, canvas: cfg.canvas, ...opRender });
  const pngs = Array.from({ length: total }, (_, i) => nome(i));
  const faltam = pngs.filter((p) => !fs.existsSync(p));
  if (faltam.length) throw new Error(`faltam ${faltam.length} lâmina(s) renderizada(s) (T-12)`);

  const r = await conferir.conferir({ estilo, conteudos, legenda, html, cfg, formato });
  const relatorio = conferir.relatorio(r.achados, r.aviso);
  fs.writeFileSync(path.join(saida, 'conferencia.txt'), relatorio + '\n');
  fs.writeFileSync(path.join(saida, 'carrossel.html'), html);
  fs.writeFileSync(path.join(saida, 'legenda.txt'), legenda + '\n');
  await render.miniaturas({ pngs, saida: path.join(saida, 'miniaturas-100px.png'), canvas: cfg.canvas });
  const cor = molde.tema(estilo, { cores }).cores;
  const opPrevia = {
    pngs, titulo: `Prévia · ${estilo.dados.nome}`, nome: marca.empresa.nome || '', conta: marca.handle || '', legenda, canvas: cfg.canvas, seg: cfg.seg,
    cor: cor.acento, tinta: molde.contraste(cor.acento, cor.claro) >= molde.contraste(cor.acento, cor.escuro) ? cor.claro : cor.escuro, conferencia: relatorio, estilo: estilo.dados.nome,
  };
  // carrossel: simulador de post; fixados e capa de Reels: como aparecem na grade do perfil (e a capa inteira, com as faixas da interface)
  fs.writeFileSync(path.join(saida, 'preview.html'), formato === 'carrossel' || formato === 'post' ? gerarPreview(opPrevia) : gerarPreviewGrade({ ...opPrevia, formato }));
  fs.writeFileSync(estadoArq, JSON.stringify({ ...estado, hash, hashPrimeira, etapa: 'completo', aprovadoPeloConferidor: r.achados.length === 0 }, null, 2));
  console.log(relatorio);
  console.log(`\nPrévia: ${path.join(saida, 'preview.html')}\nMiniaturas de 100 px (DG-19): ${path.join(saida, 'miniaturas-100px.png')}`);
  if (r.achados.length) console.log('\nCorrija só o que o conferidor citou e rode de novo; não refaça a peça inteira (L-06).');
  return r.achados.length ? 1 : 0;
}

module.exports = { resolverArquivos, argumentos };
if (require.main === module) main().then((c) => process.exit(c), (e) => { console.error('Erro: ' + e.message); process.exit(2); });
