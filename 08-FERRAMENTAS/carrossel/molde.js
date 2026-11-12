// Montador de lâminas: junta um estilo do catálogo (04-LABORATORIO-DE-DESIGN/estilos/<id>/), o conteúdo de cada
// lâmina e as cores e fontes (do marca.yaml ou da sugestão do estilo) e devolve o HTML. O gerador do carrossel usa este
// módulo para renderizar PNG; a prévia do catálogo usa para mostrar cada estilo.
//
// Uso:
//   const molde = require('<...>/08-FERRAMENTAS/carrossel/molde');
//   const estilo = molde.lerEstilo('papelaria');
//   const html = molde.pagina(estilo, laminas, { cores: 'sugestao' });   // ou 'marca'
//
// Conteúdo de uma lâmina: { layout?, fundo?, kicker, titulo, subtitulo, corpo, nota, itens, botao, foto, recorte, visual }.
// `recorte` é a foto da capa com o fundo removido (recortar.js), para o estilo que põe algo entre o fundo e a pessoa.
// `ilustracao` é o nome de um desenho do próprio estilo (objetos/ilustracao/<nome>.svg), que o layout mostra num painel.
// `visual`: { tipo: 'mockup', componente, dados, marcadores } | { tipo: 'foto', arquivo } | { tipo: 'numero', valor,
// rotulo } | { tipo: <objeto do estilo>, ...campos }. Texto aceita *destaque* (só cor, DG-04) e **negrito**.
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const marca = require(path.join(__dirname, '..', 'marca', 'marca'));
const mk = require(path.join(__dirname, '..', 'mockups', 'mockups'));

const LAB = path.join(marca.RAIZ, '04-LABORATORIO-DE-DESIGN');
const PASTA_LAYOUTS = path.join(LAB, 'layouts');
const PASTA_ESTILOS = path.join(LAB, 'estilos');
const PAPEIS = ['escuro', 'claro', 'acento', 'neutro'];

// ---------------------------------------------------------------- texto
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<em class="dst">$1</em>');
const pad2 = (n) => String(n).padStart(2, '0');

// Moldes no formato {{campo}} (texto, escapado e formatado), {{{campo}}} (HTML pronto), {{#campo}}...{{/campo}}
// (repete para cada item de uma lista, ou mostra se o campo existir) e {{^campo}}...{{/campo}} (mostra se faltar).
// Dentro de uma lista: {{.}} é o item de texto, {{n}} a posição com dois dígitos, {{i}} a posição, e {{#primeiro}} e
// {{#ultimo}} marcam as pontas.
function preencher(tpl, dados) {
  const vazio = (v) => v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && v.length === 0);
  let out = tpl.replace(/\{\{([#^])([\w.-]+)\}\}([\s\S]*?)\{\{\/\2\}\}/g, (_, tipo, chave, dentro) => {
    const v = dados[chave];
    if (tipo === '^') return vazio(v) ? preencher(dentro, dados) : '';
    if (vazio(v)) return '';
    if (Array.isArray(v)) {
      return v.map((item, i) => preencher(dentro, {
        ...dados, ...(item && typeof item === 'object' ? item : {}), '.': typeof item === 'object' ? '' : item, n: pad2(i + 1), i: i + 1, primeiro: i === 0, ultimo: i === v.length - 1,
      })).join('');
    }
    return preencher(dentro, dados);
  });
  out = out.replace(/\{\{\{([\w.-]+)\}\}\}/g, (_, k) => (dados[k] ?? ''));
  out = out.replace(/\{\{([\w.-]+)\}\}/g, (_, k) => fmt(dados[k] ?? ''));
  return out;
}

// ---------------------------------------------------------------- estilo
// `opcoes.pasta`: lê um estilo próprio de uma empresa (a pasta `estilosProprios` dela) em vez do catálogo. Sem a opção,
// tudo como sempre (o catálogo).
function lerEstilo(id, opcoes = {}) {
  if (opcoes && opcoes.pasta !== undefined && opcoes.pasta !== null) return lerEstiloProprio(id, opcoes.pasta);
  const dir = path.join(PASTA_ESTILOS, id);
  const arq = path.join(dir, 'estilo.yaml');
  if (!fs.existsSync(arq)) throw new Error(`estilo não encontrado: ${id} (esperado ${arq})`);
  const dados = marca.lerYaml(fs.readFileSync(arq, 'utf8'));
  const css = fs.existsSync(path.join(dir, 'estilo.css')) ? fs.readFileSync(path.join(dir, 'estilo.css'), 'utf8') : '';
  const erros = validarEstilo(dados, dir);
  if (erros.length) throw new Error(`estilo ${id} inválido:\n- ${erros.join('\n- ')}`);
  return { id, dir, dados, css, car: dados.formatos.carrossel, soReels: !dados.formatos.carrossel };
}

// Formatos de peça: o carrossel usa o canvas.feed do marca.yaml; o post fixado é 3:4 (a grade do perfil mostra inteiro);
// a capa de Reels é 9:16, e o que importa fica entre y 250 e 1520 (abaixo da barra de cima, acima da interface do
// aplicativo e dentro do recorte 3:4 que a grade mostra, de y 240 a 1680), regra V-04 do Núcleo.
const FORMATOS = {
  carrossel: { canvas: null, seg: null },
  post: { canvas: null, seg: null }, // post estático de feed: UMA imagem no canvas.feed da marca (o mesmo tamanho do carrossel)
  fixados:{ canvas: { largura: 1080, altura: 1440 }, seg: null },
  reels: { canvas: { largura: 1080, altura: 1920 }, seg: { topo: 250, base: 400 } },
};
const PAPEIS_FIXADOS = ['capa', 'miolo', 'fecho'];
const CHAVES_FIXADOS = ['apresentacao', 'metodo', 'contratar'];
// Sem opção, os estilos do catálogo; com `{ pasta }`, os estilos próprios dessa pasta (código válido, com estilo.yaml e sem
// atalho; uma pasta que não existe dá lista vazia).
const listarEstilos = (opcoes = {}) => {
  if (opcoes && opcoes.pasta !== undefined && opcoes.pasta !== null) return listarProprios(opcoes.pasta);
  return fs.readdirSync(PASTA_ESTILOS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('_') && fs.existsSync(path.join(PASTA_ESTILOS, e.name, 'estilo.yaml'))).map((e) => e.name);
};

// Nome de layout ou de objeto: só letras, números, "_" e "-" (nunca um caminho).
const NOME_DE_PECA = /^[\w-]+$/;
function arquivoLayout(dir, nome) {
  if (typeof nome !== 'string' || !NOME_DE_PECA.test(nome)) return null;
  for (const p of [path.join(dir, 'layouts', nome + '.html'), path.join(PASTA_LAYOUTS, nome + '.html')]) if (fs.existsSync(p)) return p;
  return null;
}

// ---------------------------------------------------------------- estilos próprios da empresa
// Um estilo próprio tem o mesmo formato de um estilo do catálogo (LEIA-ME de 04-LABORATORIO-DE-DESIGN/estilos), numa pasta da
// empresa, com `origem: referencias`. Ele é escrito a partir de referências de fora: por isso, além da conferência de sempre,
// - o código é simples (minúsculas, números e "-", até 64), e a pasta, o estilo.yaml e tudo o que há dentro não são atalhos
//   (junção, link): o estilo nunca lê arquivo de outra empresa;
// - CSS, layouts e objetos não carregam nada de fora: o valor INTEIRO de url() é "#nome", "data:...", {{campo}} ou "%23nome";
//   o de src/href/background/poster/action/data é {{campo}}, "textura:nome", "#nome" ou "data:..."; sem @import, image-set(),
//   srcset, <script>, <style>, <set>, <animate>, <iframe>, <frame>, <portal>, <applet>, <object>, <embed>, <link>, <meta>,
//   <base>, <foreignObject>, "javascript:", atributo on...=, entidade (&#..., &lpar; ...; só &amp; &lt; &gt; &quot; &apos;
//   &nbsp;), barra invertida (escape) nem {{{campo}}} cru que não seja visual, svg ou ilustracaoSvg;
// - as letras da prévia (sugestao.tipografia) e o parâmetro do Google Fonts (sugestao.google) só com caracteres simples.
// Esta conferência é a primeira camada: o gerar-previas renderiza todo estilo próprio com a rede fechada
// (render.abrirPagina com bloquearRede), que é a garantia de que nada de fora é carregado.
const estilosProprios = require(path.join(__dirname, '..', '..', '_fabrica', 'core', 'estilos-proprios'));
const ehAtalho = estilosProprios.ehAtalho;
const listarProprios = (pasta) => estilosProprios.listar(pasta);

const TEXTO_PROIBIDO = [
  [/@import/i, '@import'], [/<\s*script/i, '<script>'], [/<\s*iframe/i, '<iframe>'], [/<\s*object/i, '<object>'],
  [/<\s*embed/i, '<embed>'], [/<\s*link/i, '<link>'], [/<\s*meta/i, '<meta>'], [/<\s*base/i, '<base>'],
  [/<\s*foreignObject/i, '<foreignObject>'], [/javascript\s*:/i, '"javascript:"'], [/[\s"'/]on[a-z]+\s*=/i, 'atributo on...='],
  [/&#/, 'entidade numérica (&#...)'], [/<\s*(frame|frameset|portal|applet)\b/i, '<frame>, <portal> ou <applet>'],
  [/image-set\s*\(/i, 'image-set()'], [/\bsrcset\s*=/i, 'srcset='], [/<\s*style\b/i, '<style>'],
  [/<\s*(set|animate[a-z]*)\b/i, '<set> ou <animate>'], [/&(?!(amp|lt|gt|quot|apos|nbsp);)[a-z][a-z0-9]*;/i, 'entidade (&...;)'],
  [/\\/, 'barra invertida (escape)'],
];
const ALVO_LIVRE = (alvo) => /^(#[\w-]*|data:.*|\{\{[\w.-]+\}\}|%23[\w-]*)$/i.test(alvo);
const ATRIBUTO_LIVRE = (valor) => /^(\{\{[\w.-]+\}\}|textura:[\w-]+|#[\w-]*|data:.*)$/i.test(valor);
const CRUS_PERMITIDOS = ['visual', 'svg', 'ilustracaoSvg'];
// Os problemas de um texto do estilo próprio (CSS, layout ou objeto), com o nome do arquivo.
function problemasDoTexto(texto, arq) {
  const achados = [];
  for (const [re, nome] of TEXTO_PROIBIDO) if (re.test(texto)) achados.push(`${arq} não pode ter ${nome}`);
  for (const m of texto.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))/gi)) {
    const alvo = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!ALVO_LIVRE(alvo)) { achados.push(`${arq} não pode ter url(${alvo.slice(0, 40)}): só "#nome", "data:" ou {{campo}}, como valor inteiro`); break; }
  }
  const ATRIBUTO = /(?:^|[\s<"'/])((?:xlink:)?(?:src|href|srcset|poster|action|formaction|background|lowsrc|dynsrc|data))\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*))/gi;
  for (const m of texto.matchAll(ATRIBUTO)) {
    const valor = m[2] ?? m[3] ?? m[4] ?? '';
    if (!ATRIBUTO_LIVRE(valor)) { achados.push(`${arq} não pode ter ${m[1]}="${valor.slice(0, 40)}": só {{campo}}, "textura:nome", "#nome" ou "data:", como valor inteiro`); break; }
  }
  for (const m of texto.matchAll(/\{\{\{\s*([^}]*?)\s*\}\}\}/g)) {
    if (!CRUS_PERMITIDOS.includes(m[1])) { achados.push(`${arq} não pode ter {{{${m[1].slice(0, 30)}}}}: o campo cru só vale para ${CRUS_PERMITIDOS.join(', ')}`); break; }
  }
  return achados;
}

// Todos os arquivos de dentro do estilo (sem seguir atalho). Atalho em qualquer lugar: erro.
function arquivosDoProprio(dir, id) {
  const lista = [];
  const varrer = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isSymbolicLink() || ehAtalho(abs)) throw new Error(`estilo próprio ${id}: ${path.relative(dir, abs)} é um atalho (junção ou link); um estilo próprio não pode ter atalho`);
      if (e.isDirectory()) varrer(abs);
      else if (e.isFile()) lista.push(abs);
    }
  };
  varrer(dir);
  return lista;
}

// Os problemas próprios do estilo próprio (além de validarEstilo).
function errosDoProprio(dados, dir, arquivos) {
  const erros = [];
  if (dados?.origem !== 'referencias') erros.push('um estilo próprio tem origem: referencias');
  const sug = dados?.sugestao || {};
  if (sug.google !== undefined && sug.google !== null && sug.google !== '' && !/^family=[A-Za-z0-9+:;,@.&=]+$/.test(String(sug.google))) {
    erros.push('sugestao.google não pode ter outro caractere além de letras, números e + : ; , @ . & =');
  }
  const t = sug.tipografia || {};
  for (const papel of ['principal', 'mono', 'acento']) {
    const v = t[papel];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 +-]{0,60}$/.test(v)) erros.push(`sugestao.tipografia.${papel} não pode ter outro caractere além de letras, números, espaço, + e -`);
  }
  for (const abs of arquivos) {
    const rel = path.relative(dir, abs).split(path.sep).join('/');
    if (rel === 'estilo.css' || /^(layouts|objetos)\//.test(rel)) {
      if (/\.(css|html?|svg)$/i.test(rel)) erros.push(...problemasDoTexto(fs.readFileSync(abs, 'utf8'), rel));
    }
  }
  return erros;
}

function lerEstiloProprio(id, pasta) {
  // código, atalho (na pasta de estilos próprios, na do estilo e no estilo.yaml) e estilo.yaml presente: a regra única
  // (_fabrica/core/estilos-proprios.js), a mesma do catálogo e da escolha do estilo
  let local;
  try { local = estilosProprios.pastaDoEstilo(pasta, id); } catch (e) { throw new Error(e.message); }
  const { dir, arquivo: arq } = local;
  const arquivos = arquivosDoProprio(dir, id);
  const dados = marca.lerYaml(fs.readFileSync(arq, 'utf8'));
  const css = fs.existsSync(path.join(dir, 'estilo.css')) ? fs.readFileSync(path.join(dir, 'estilo.css'), 'utf8') : '';
  const erros = [...validarEstilo(dados, dir), ...errosDoProprio(dados, dir, arquivos)];
  if (erros.length) throw new Error(`estilo ${id} inválido:\n- ${erros.join('\n- ')}`);
  return { id, dir, dados, css, car: dados.formatos.carrossel, soReels: !dados.formatos.carrossel, proprio: true };
}

// Campos da biblioteca de estilos (o que a pessoa usa para escolher e filtrar): para que tipo de negócio o estilo combina,
// o tom dele e do que ele precisa (foto de pessoa, fundo liso...). Os códigos válidos e os rótulos ficam no vocabulário.
const ARQ_VOCABULARIO = path.join(LAB, 'biblioteca', 'vocabulario.json');
const CAMPOS_BIBLIOTECA = { 'combina-com': [2, 5], tom: [1, 3], precisa: [1, Infinity] };
let arqVocabulario = ARQ_VOCABULARIO;
let vocabularioLido = null;
// O vocabulário é lido só quando um estilo traz os campos novos. Se o arquivo não está lá (Fábrica desatualizada), o erro
// diz o que fazer em vez de mostrar um ENOENT.
const AVISO_SEM_VOCABULARIO = 'faltou o arquivo vocabulario.json da biblioteca; atualize a Fábrica';
function vocabulario() {
  if (vocabularioLido) return vocabularioLido;
  let texto;
  try { texto = fs.readFileSync(arqVocabulario, 'utf8'); } catch (err) {
    if (err.code === 'ENOENT') throw Object.assign(new Error(AVISO_SEM_VOCABULARIO), { code: 'VOCABULARIO_AUSENTE' });
    throw err;
  }
  return (vocabularioLido = JSON.parse(texto));
}
// Para testes: aponta o vocabulário para outro arquivo (e, sem argumento, volta ao da biblioteca).
function usarVocabulario(arq) { arqVocabulario = arq || ARQ_VOCABULARIO; vocabularioLido = null; }

// Os três campos só são OBRIGATÓRIOS na conferência do catálogo (`{ biblioteca: true }`, que os testes rodam sobre todos os
// estilos). Na produção (lerEstilo) um estilo personalizado da empresa, sem os campos novos, continua carregando depois do
// /atualizar; código errado, quantidade fora do limite e incompatibilidade são erros em qualquer caso.
function errosDaBiblioteca(e, { biblioteca = false } = {}) {
  const erros = [];
  const estilo = `estilo ${e?.id || '(sem id)'}`;
  let voc = null;
  if (Object.keys(CAMPOS_BIBLIOTECA).some((k) => e?.[k] !== undefined && e?.[k] !== null)) {
    try { voc = vocabulario(); } catch (err) {
      if (err.code !== 'VOCABULARIO_AUSENTE') throw err;
      erros.push(`${estilo}: ${AVISO_SEM_VOCABULARIO}`);
    }
  }
  for (const [campo, [min, max]] of Object.entries(CAMPOS_BIBLIOTECA)) {
    const v = e?.[campo];
    const limite = max === Infinity ? `pelo menos ${min}` : `de ${min} a ${max}`;
    if (v === undefined || v === null) {
      if (biblioteca && e?.origem === 'catalogo') erros.push(`${estilo}: falta o campo ${campo} (lista com ${limite} códigos do vocabulário da biblioteca)`);
      continue;
    }
    if (!voc) continue;
    if (!Array.isArray(v)) { erros.push(`${estilo}: o campo ${campo} deve ser uma lista, como [${Object.keys(voc[campo]).slice(0, 2).join(', ')}]; veio "${v}"`); continue; }
    if (v.length < min || v.length > max) erros.push(`${estilo}: o campo ${campo} pede ${limite} códigos; veio ${v.length} (${v.join(', ')})`);
    for (const c of v) if (!Object.prototype.hasOwnProperty.call(voc[campo], c)) erros.push(`${estilo}: o campo ${campo} tem o código "${c}", que não está no vocabulário (04-LABORATORIO-DE-DESIGN/biblioteca/vocabulario.json)`);
    for (const c of new Set(v.filter((c, i) => v.indexOf(c) !== i))) erros.push(`${estilo}: o campo ${campo} repete o código "${c}"`);
  }
  const precisa = Array.isArray(e?.precisa) ? e.precisa : [];
  if (precisa.includes('funciona-sem-foto')) {
    for (const c of ['foto-de-pessoa', 'foto-fundo-liso']) if (precisa.includes(c)) erros.push(`${estilo}: o campo precisa não pode ter "funciona-sem-foto" junto de "${c}"`);
  }
  return erros;
}

// Confere o formato do estilo.yaml (o mesmo que 04-LABORATORIO-DE-DESIGN/estilos/LEIA-ME.md descreve).
// `opcoes.biblioteca`: conferência do catálogo, em que combina-com, tom e precisa são obrigatórios.
function validarEstilo(e, dir, opcoes = {}) {
  const erros = [];
  const exige = (cond, msg) => { if (!cond) erros.push(msg); };
  exige(e && e.id && e.nome && e.linha, 'faltam id, nome ou linha');
  exige(['catalogo', 'referencias'].includes(e?.origem), 'origem deve ser catalogo ou referencias');
  const cores = e?.sugestao?.cores || {};
  exige(PAPEIS.every((p) => /^#[0-9a-f]{6}$/i.test(cores[p] || '')), 'sugestao.cores: escuro, claro, acento e neutro em #RRGGBB');
  // campos da biblioteca: antes do retorno do estilo só de capa de Reels, para valerem também nele
  erros.push(...errosDaBiblioteca(e, opcoes));
  // fixados e capa de Reels: os layouts declarados precisam existir
  const fx = e?.formatos?.fixados || {};
  for (const k of ['apresentacao', 'metodo', 'contratar']) if (fx[k]) exige(arquivoLayout(dir, fx[k]), `layout "${fx[k]}" (em fixados.${k}) não existe no estilo nem em layouts/`);
  // kit de identidade (opcional): regras de uso em texto e, nos estilos vindos dos Reels, pares vídeo → peça
  if (e?.kit) {
    exige(Array.isArray(e.kit.regras) && e.kit.regras.length && e.kit.regras.every((r) => typeof r === 'string' && r.trim()), 'kit.regras: lista de frases');
    if (e.kit.movimento) exige(Array.isArray(e.kit.movimento) && e.kit.movimento.every((m) => m && m.video && m.peca), 'kit.movimento: lista de { video, peca }');
  }
  const po = e?.formatos?.post || {};
  if (po.layout) exige(arquivoLayout(dir, po.layout), `layout "${po.layout}" (em post.layout) não existe no estilo nem em layouts/`);
  const rl = e?.formatos?.reels || {};
  if (rl.capa) exige(arquivoLayout(dir, rl.capa), `layout "${rl.capa}" (em reels.capa) não existe no estilo nem em layouts/`);
  const car = e?.formatos?.carrossel;
  // estilo só de capa de Reels (Primeira Página): sem carrossel, com reels.capa e os fundos das capas
  if (!car && rl.capa) {
    exige(Array.isArray(rl.fundos) && rl.fundos.length && rl.fundos.every((f) => ['escuro', 'claro', 'acento'].includes(f)), 'reels.fundos: lista de escuro, claro e acento');
    return erros;
  }
  exige(car, 'falta formatos.carrossel (ou, num estilo só de capa, formatos.reels.capa)');
  if (!car) return erros;
  for (const k of ['capa', 'miolo', 'fecho']) {
    exige(Array.isArray(car[k]) && car[k].length, `formatos.carrossel.${k} precisa de pelo menos um layout`);
    for (const nome of car[k] || []) exige(arquivoLayout(dir, nome), `layout "${nome}" (em ${k}) não existe no estilo nem em layouts/`);
  }
  exige(['rodizio', 'fixo'].includes(car.molde_do_miolo), 'molde_do_miolo deve ser rodizio ou fixo (DG-10)');
  if (car.molde_do_miolo === 'fixo') exige(car.miolo.length === 1, 'miolo fixo tem um layout só');
  if (car.molde_do_miolo === 'rodizio') exige(car.miolo.length >= 2, 'miolo em rodízio precisa de pelo menos dois layouts');
  exige(['esquerda', 'centro'].includes(car.alinhamento), 'alinhamento deve ser esquerda ou centro (DG-06)');
  exige(Array.isArray(car.fundos) && car.fundos.length && car.fundos.every((f) => ['escuro', 'claro', 'acento'].includes(f)), 'fundos: lista de escuro, claro e acento (DG-15)');
  const nav = car.navegacao || {};
  exige(['barra', 'arraste', 'contador'].every((k) => typeof nav[k] === 'boolean'), 'navegacao: barra, arraste e contador, cada um true ou false (F-26)');
  exige(car.laminas && car.laminas.min >= 2 && car.laminas.max >= car.laminas.min, 'laminas: min e max');
  return erros;
}

// ---------------------------------------------------------------- cores e fontes
const lum = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

function tema(estilo, opcoes = {}) {
  const daMarca = opcoes.cores !== 'sugestao';
  const cor = (p) => (daMarca ? marca.hex(p) : estilo.dados.sugestao.cores[p].toUpperCase());
  const c = Object.fromEntries(PAPEIS.map((p) => [p, cor(p)]));
  // Texto sobre o acento: o claro ou o escuro da paleta, o que tiver mais contraste.
  const sobreAcento = contraste(c.acento, c.claro) >= contraste(c.acento, c.escuro) ? 'claro' : 'escuro';
  // Destaque sobre o fundo de acento: a outra cor da dupla, mas só se tiver contraste AA (3:1, texto grande); senão, a mesma
  // cor do texto, e quem destaca é o tratamento do estilo (itálico).
  const outra = sobreAcento === 'claro' ? 'escuro' : 'claro';
  const destaqueNoAcento = contraste(c.acento, c[outra]) >= 3 ? outra : sobreAcento;
  const pisos = marca.pega('canvas.pisos', { titulo: 72, corpo: 44, micro: 32 });
  const seg = marca.pega('canvas.area-segura', { topo: 90, base: 140 });
  let fontes = '';
  let link = '';
  const fam = {};
  if (daMarca) {
    for (const papel of ['principal', 'mono', 'acento']) {
      const arq = marca.pega(`tipografia.${papel}.arquivo`, '');
      if (!arq) continue;
      fam[papel] = `Marca ${papel}`;
      // T-01 e T-06: no HTML entregue, a fonte da marca vai embutida como dado; na prévia local, por endereço de arquivo.
      const origem = opcoes.embutir ? dadoDeArquivo(marca.caminho(arq)) : pathToFileURL(marca.caminho(arq)).href;
      fontes += `@font-face{font-family:"${fam[papel]}";src:url("${origem}")}\n`;
    }
  } else {
    const t = estilo.dados.sugestao.tipografia || {};
    for (const papel of ['principal', 'mono', 'acento']) if (t[papel]) fam[papel] = t[papel];
    if (estilo.dados.sugestao.google) link = `<link rel="stylesheet" crossorigin="anonymous" href="https://fonts.googleapis.com/css2?${estilo.dados.sugestao.google}&display=swap">`; // T-03
  }
  const pilha = (f, reserva) => (f ? `"${f}",${reserva}` : reserva);
  const vars = `.est-${estilo.id}{--cor-escuro:${c.escuro};--cor-claro:${c.claro};--cor-acento:${c.acento};--cor-neutro:${c.neutro};
--sobre-acento:var(--cor-${sobreAcento});--destaque-no-acento:var(--cor-${destaqueNoAcento});
--fonte-principal:${pilha(fam.principal, 'system-ui,sans-serif')};--fonte-mono:${pilha(fam.mono, 'ui-monospace,monospace')};
--fonte-acento:${pilha(fam.acento, 'var(--fonte-principal)')};
--piso-titulo:${pisos.titulo}px;--piso-corpo:${pisos.corpo}px;--piso-micro:${pisos.micro}px;--seg-topo:${seg.topo}px;--seg-base:${seg.base}px}`;
  return { css: fontes + vars, link, cores: c };
}

// ---------------------------------------------------------------- elemento visual (DG-09)
const TIPOS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' };
// Arquivo vira dado embutido (T-06). O tipo sai do conteúdo real, não da extensão (T-09), quando é imagem raster.
function dadoDeArquivo(abs) {
  const buf = fs.readFileSync(abs);
  let tipo = TIPOS[path.extname(abs).slice(1).toLowerCase()] || 'application/octet-stream';
  if (buf.slice(1, 4).toString() === 'PNG') tipo = 'image/png';
  else if (buf[0] === 0xff && buf[1] === 0xd8) tipo = 'image/jpeg';
  else if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') tipo = 'image/webp';
  return `data:${tipo};base64,${buf.toString('base64')}`;
}
const caminhoAbsoluto = (arquivo) => (path.isAbsolute(arquivo) ? arquivo : path.join(marca.RAIZ, arquivo));
function srcFoto(arquivo, opcoes) {
  if (!arquivo) return '';
  if (/^(https?:|data:|file:)/.test(arquivo)) return arquivo;
  const abs = caminhoAbsoluto(arquivo);
  if (opcoes.foto) return opcoes.foto(abs);
  return opcoes.embutir ? dadoDeArquivo(abs) : pathToFileURL(abs).href;
}
function visual(estilo, v, ctx, opcoes) {
  if (!v) return '';
  // O objeto do próprio estilo (objetos/<tipo>.html) vem antes dos tipos genéricos de mesmo nome. O tipo é um nome, nunca
  // um caminho.
  const tpl = path.join(estilo.dir, 'objetos', (typeof v.tipo === 'string' && NOME_DE_PECA.test(v.tipo) ? v.tipo : '') + '.html');
  if (tpl !== path.join(estilo.dir, 'objetos', '.html') && fs.existsSync(tpl)) return objeto(estilo, v, tpl, opcoes);
  if (v.tipo === 'mockup') {
    const fn = mk.COMPONENTES[v.componente];
    if (!fn) throw new Error(`mockup desconhecido: ${v.componente}`);
    const modo = v.modo || 'claro'; // M-06: sobre fundo escuro, interface clara; o escuro só vem se pedido
    const dados = { ...(v.dados || {}), modo };
    if (dados.foto) dados.foto = srcFoto(dados.foto, opcoes);
    let html = fn(dados);
    if (v.marcadores) html = mk.comMarcadores(html, v.marcadores);
    return `<div class="vis vis-mockup${v.inclinar === false ? '' : ' inclinado'}">${html}</div>`;
  }
  if (v.tipo === 'foto') return `<div class="vis vis-foto"><img src="${srcFoto(v.arquivo || v.foto, opcoes)}" alt=""></div>`;
  if (v.tipo === 'numero') return `<div class="vis vis-numero"><b>${esc(v.valor)}</b>${v.rotulo ? `<span>${esc(v.rotulo)}</span>` : ''}</div>`;
  throw new Error(`o estilo ${estilo.id} não tem o objeto "${v.tipo}" (esperado ${tpl})`);
}
function objeto(estilo, v, tpl, opcoes) {
  const dados = { ...v };
  for (const [k, val] of Object.entries(v)) if (/^foto/.test(k) && typeof val === 'string') dados[k + 'Src'] = srcFoto(val, opcoes);
  if (Array.isArray(v.itens)) dados.itens = v.itens.map((it) => (it && it.foto ? { ...it, fotoSrc: srcFoto(it.foto, opcoes) } : it));
  // Desenho pronto do estilo: objetos/<tipo>/<nome>.svg vira {{{svg}}}.
  if (v.nome && typeof v.nome === 'string' && NOME_DE_PECA.test(v.nome)) {
    const svg = path.join(estilo.dir, 'objetos', v.tipo, v.nome + '.svg');
    if (fs.existsSync(svg)) dados.svg = fs.readFileSync(svg, 'utf8');
  }
  return preencher(fs.readFileSync(tpl, 'utf8'), dados);
}

// ---------------------------------------------------------------- lâmina
function escolherLayout(estilo, papel, indiceNoMiolo) {
  const lista = estilo.car[papel];
  return lista[indiceNoMiolo % lista.length];
}
// O layout e a sequência de fundos de cada formato: o carrossel segue o rodízio; o fixado usa o layout de
// formatos.fixados pela posição (apresentação, método, contratar); a capa de Reels usa formatos.reels.capa.
function layoutEFundos(estilo, ctx) {
  const f = (estilo.dados && estilo.dados.formatos) || {};
  const car = estilo.car || {};
  if (ctx.formato === 'fixados') return { nome: (f.fixados || {})[CHAVES_FIXADOS[ctx.indice]] || escolherLayout(estilo, ctx.papel, ctx.indiceNoPapel), fundos: (f.fixados || {}).fundos || car.fundos };
  if (ctx.formato === 'reels') return { nome: (f.reels || {}).capa || car.capa[0], fundos: (f.reels || {}).fundos || car.fundos };
  // post estático: o layout de capa do estilo (feito para parar a rolagem), salvo se o estilo declarar formatos.post.layout
  if (ctx.formato === 'post') return { nome: (f.post || {}).layout || car.capa[0], fundos: (f.post || {}).fundos || car.fundos };
  return { nome: escolherLayout(estilo, ctx.papel, ctx.indiceNoPapel), fundos: car.fundos };
}
function lamina(estilo, conteudo, ctx, opcoes = {}) {
  const car = estilo.car || {};
  const formato = ctx.formato || 'carrossel';
  const lf = layoutEFundos(estilo, { ...ctx, formato });
  const fundo = conteudo.fundo || lf.fundos[ctx.indice % lf.fundos.length];
  // o fundo vai para a classe e para um atributo da lâmina: só os três da paleta
  if (!['escuro', 'claro', 'acento'].includes(fundo)) throw new Error(`fundo inválido na lâmina ${ctx.indice + 1}: ${JSON.stringify(String(fundo).slice(0, 40))} (use escuro, claro ou acento)`);
  const nome = conteudo.layout || lf.nome;
  const arq = arquivoLayout(estilo.dir, nome);
  if (!arq) throw new Error(`layout não encontrado: ${nome}`);
  const ident = opcoes.identidade || { nome: marca.empresa.nome, conta: marca.handle };
  const dados = {
    ...conteudo, fundo, conta: ident.conta, nomeMarca: ident.nome, posicao: ctx.indice + 1, total: ctx.total,
    fotoSrc: srcFoto(conteudo.foto, opcoes), retratoSrc: srcFoto(conteudo.retrato || opcoes.retrato, opcoes),
    // a mesma foto da capa com o fundo removido (PNG transparente, recortar.js): o que fica entre as duas passa atrás da pessoa
    recorteSrc: srcFoto(conteudo.recorte, opcoes),
    // desenho do próprio estilo pelo nome (objetos/ilustracao/<nome>.svg), embutido para seguir a cor da lâmina;
    // estilo que não tem o desenho simplesmente não o mostra
    ilustracaoSvg: ilustracaoDoEstilo(estilo, conteudo.ilustracao),
  };
  dados.visual = visual(estilo, conteudo.visual, { fundo }, opcoes);
  // DG-16: a logo entra só nos pontos de pecas.logo-aparece-em (capa e fecho, por padrão), sempre completa.
  const logoArq = opcoes.logo !== undefined ? opcoes.logo : marca.pega('pecas.logo', '');
  const pontos = opcoes.logoAparece || marca.pega('pecas.logo-aparece-em', ['capa', 'fecho']);
  const logo = logoArq && pontos.includes(ctx.papel)
    ? `<img class="logo-marca" src="${/^data:/.test(logoArq) ? logoArq : (opcoes.embutir ? dadoDeArquivo(caminhoAbsoluto(logoArq)) : pathToFileURL(caminhoAbsoluto(logoArq)).href)}" alt="">` : '';
  // barra, arraste e contador são do carrossel: o post fixado e a capa de Reels são peças de uma lâmina só
  const nav = formato === 'carrossel' ? car.navegacao : {};
  const fim = ctx.indice === ctx.total - 1;
  const navegacao = (nav.barra ? `<div class="nav-barra"><i style="width:${Math.round(((ctx.indice + 1) / ctx.total) * 100)}%"></i></div>` : '')
    + (nav.arraste && !fim ? '<div class="nav-arraste">arraste para o lado →</div>' : '')
    + (nav.contador ? `<div class="nav-contador">${ctx.indice + 1}/${ctx.total}</div>` : '');
  const ancora = /^\s*<!--\s*ancora:propria\s*-->/.test(fs.readFileSync(arq, 'utf8')) ? 'propria' : 'visual';
  return texturas(`<div class="lamina est-${estilo.id} formato-${formato} fundo-${fundo} alinha-${car.alinhamento || 'esquerda'} l-${nome} papel-${ctx.papel}" data-formato="${formato}" data-layout="${nome}" data-fundo="${fundo}" data-papel="${ctx.papel}" data-posicao="${ctx.indice + 1}" data-total="${ctx.total}" data-ancora="${ancora}"><div class="grao"></div>${preencher(fs.readFileSync(arq, 'utf8'), dados)}${logo}${navegacao}</div>`, opcoes);
}

// ---------------------------------------------------------------- texturas
// O estilo pede uma textura dos modelos de edição (papel rasgado, fita, jornal, caderno, adesivos...) por nome: no CSS,
// `textura(nome)` vira url(...); num atributo de layout ou objeto, src="textura:nome" vira o endereço. As texturas são
// desenhadas pelo gerar-texturas.js, sem arte de terceiros, e não vão para o git: garantirTexturas() as gera se faltarem.
const PASTA_TEXTURAS = path.join(marca.RAIZ, '08-FERRAMENTAS', 'tesseract', 'modelos', 'texturas');
const GERAR_TEXTURAS = path.join(marca.RAIZ, '08-FERRAMENTAS', 'tesseract', 'modelos', 'gerar-texturas.js');
const arquivoTextura = (nome) => path.join(PASTA_TEXTURAS, nome + '.png');
function enderecoTextura(nome, opcoes) {
  const abs = arquivoTextura(nome);
  if (!fs.existsSync(abs)) throw new Error(`a textura "${nome}" não existe (${abs}). Gere com: node ${path.relative(marca.RAIZ, GERAR_TEXTURAS)}`);
  if (opcoes.foto) return opcoes.foto(abs);
  return opcoes.embutir ? dadoDeArquivo(abs) : pathToFileURL(abs).href;
}
function texturas(texto, opcoes = {}) {
  return texto.replace(/textura\(([\w-]+)\)/g, (_, n) => `url("${enderecoTextura(n, opcoes)}")`)
    .replace(/(["'])textura:([\w-]+)\1/g, (_, q, n) => `${q}${enderecoTextura(n, opcoes)}${q}`);
}
// Nomes das texturas que o estilo usa (no CSS, nos layouts e nos objetos próprios).
function texturasDoEstilo(estilo) {
  const textos = [estilo.css];
  for (const sub of ['layouts', 'objetos']) {
    const dir = path.join(estilo.dir, sub);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir, { recursive: true })) if (/\.(html|svg)$/.test(f)) textos.push(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  const nomes = new Set();
  for (const t of textos) for (const m of t.matchAll(/textura\(([\w-]+)\)|["']textura:([\w-]+)["']/g)) nomes.add(m[1] || m[2]);
  return [...nomes];
}
// Limite do gerador de texturas: as 20 texturas saem em uns 10 s; 5 min só estoura num Chromium parado (a máquina fica
// lenta sob carga, e um gerador preso seguraria as prévias de todas as empresas).
const LIMITE_TEXTURAS_MS = 5 * 60 * 1000;
// Gera as texturas que faltam (abre o Chromium uma vez). Devolve as que foram geradas. `programa` e `limiteMs`: os testes.
function garantirTexturas(estilo, { programa = GERAR_TEXTURAS, limiteMs = LIMITE_TEXTURAS_MS } = {}) {
  const faltam = texturasDoEstilo(estilo).filter((n) => !fs.existsSync(arquivoTextura(n)));
  if (!faltam.length) return [];
  try {
    require('child_process').execFileSync(process.execPath, [programa], { stdio: 'inherit', timeout: limiteMs, killSignal: 'SIGKILL', windowsHide: true });
  } catch (e) {
    if (e.code === 'ETIMEDOUT') throw Object.assign(new Error(`tempo esgotado: o gerar-texturas.js não terminou em ${Math.round(limiteMs / 1000)} s`), { code: 'ETIMEDOUT' });
    throw e;
  }
  const ainda = faltam.filter((n) => !fs.existsSync(arquivoTextura(n)));
  if (ainda.length) throw new Error(`o estilo ${estilo.id} pede texturas que o gerar-texturas.js não desenha: ${ainda.join(', ')}`);
  return faltam;
}
const cssDoEstilo = (estilo, opcoes = {}) => texturas(estilo.css, opcoes);

function ilustracaoDoEstilo(estilo, nome) {
  if (!nome || !/^[\w-]+$/.test(nome)) return '';
  const arq = path.join(estilo.dir, 'objetos', 'ilustracao', nome + '.svg');
  return fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : '';
}

// Arquivos de imagem que uma lâmina usa (foto, retrato, visual e itens), para conferir se existem antes de montar.
function arquivosDe(conteudo, opcoes = {}) {
  const achados = [];
  const ponha = (caminho, onde) => { if (caminho && typeof caminho === 'string' && !/^(https?:|data:|file:)/.test(caminho)) achados.push({ caminho, onde }); };
  ponha(conteudo.foto, 'foto');
  ponha(conteudo.retrato, 'retrato');
  ponha(conteudo.recorte, 'recorte');
  const v = conteudo.visual || {};
  ponha(v.arquivo, 'visual.arquivo');
  for (const [k, val] of Object.entries(v)) if (/^foto/.test(k)) ponha(val, `visual.${k}`);
  ponha(v.dados && v.dados.foto, 'visual.dados.foto');
  for (const it of v.itens || []) if (it && it.foto) ponha(it.foto, 'visual.itens.foto');
  return achados.map((a) => ({ ...a, existe: fs.existsSync(caminhoAbsoluto(a.caminho)) }));
}

// Monta todas as lâminas. Carrossel: a primeira é capa, a última é fecho, o resto é miolo. Fixados (opcoes.formato):
// apresentação (capa), método (miolo) e contratar (fecho). Capa de Reels: cada lâmina é uma capa.
function laminas(estilo, conteudos, opcoes = {}) {
  const formato = opcoes.formato || 'carrossel';
  if (!FORMATOS[formato]) throw new Error(`formato desconhecido: ${formato} (carrossel, post, fixados ou reels)`);
  if (estilo.soReels && formato !== 'reels') throw new Error(`o estilo ${estilo.id} é só de capa de Reels: use o formato reels`);
  if (formato === 'post' && conteudos.length !== 1) throw new Error(`o post estático é uma imagem só; o conteúdo tem ${conteudos.length} lâminas (para várias, use o carrossel)`);
  if (formato === 'fixados' && conteudos.length !== 3) throw new Error(`os fixados são 3 (apresentação, método, contratar); o conteúdo tem ${conteudos.length}`);
  mk.usarCores(opcoes.cores === 'sugestao' ? estilo.dados.sugestao.cores : null);
  const total = conteudos.length;
  const contagem = { capa: 0, miolo: 0, fecho: 0 };
  return conteudos.map((c, indice) => {
    const papel = formato === 'reels' || formato === 'post' ? 'capa' : formato === 'fixados' ? PAPEIS_FIXADOS[indice] : indice === 0 ? 'capa' : indice === total - 1 ? 'fecho' : 'miolo';
    return lamina(estilo, c, { indice, total, papel, formato, indiceNoPapel: contagem[papel]++ }, opcoes);
  });
}
// Canvas e área segura do formato, a partir dos do marca.yaml (o carrossel fica com os da marca).
function canvasDoFormato(formato, canvasMarca, segMarca) {
  const f = FORMATOS[formato || 'carrossel'];
  if (!f) throw new Error(`formato desconhecido: ${formato} (carrossel, post, fixados ou reels)`);
  return { canvas: f.canvas || canvasMarca, seg: f.seg || segMarca };
}

const cssBase = () => fs.readFileSync(path.join(PASTA_LAYOUTS, 'base.css'), 'utf8');

// Página com as lâminas lado a lado (para prévia e para o renderizador, que fotografa cada .lamina).
function pagina(estilo, conteudos, opcoes = {}) {
  const t = tema(estilo, opcoes);
  const corpo = laminas(estilo, conteudos, opcoes).join('\n');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${t.link}
<style>${t.css}\n${cssBase()}\n${mk.css()}\n${cssDoEstilo(estilo, opcoes)}\nbody{margin:0;background:#888;display:flex;flex-wrap:wrap;gap:20px;padding:20px}</style></head>
<body>${corpo}</body></html>`;
}

module.exports = { FORMATOS, canvasDoFormato, preencher, fmt, lerEstilo, listarEstilos, validarEstilo, vocabulario, usarVocabulario, ARQ_VOCABULARIO, tema, visual, lamina, laminas, pagina, cssBase, cssDoEstilo, contraste, arquivosDe, caminhoAbsoluto, dadoDeArquivo, texturas, texturasDoEstilo, garantirTexturas, LIMITE_TEXTURAS_MS, PASTA_ESTILOS, PASTA_LAYOUTS, PASTA_TEXTURAS };
