// Testes das telas dos painéis (laboratorio.html, cronograma.html e o seletor comum empresa-seletor.js).
// 1) O servidor entrega as páginas. 2) Contrato: a tela só fala com rotas /api/, toda leitura e todo envio levam a
// empresa, nenhum arquivo de dados é lido por caminho e o texto não usa palavras internas. 3) O seletor, rodado aqui
// com um servidor de mentira: ordem da escolha, aviso, armazenamento quebrado e resposta atrasada descartada.
// As empresas dos testes são só fictícias.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');

delete process.env.FABRICA_EMPRESA;
delete process.env.FABRICA_MARCA;
delete process.env.FABRICA_RAIZ;

const PAINEIS = path.join(__dirname, '..');
const RAIZ = path.join(PAINEIS, '..', '..');
const TELAS = ['laboratorio.html', 'cronograma.html', 'estilos.html'];
// O que cada tela pode gravar pelo servidor (todo o resto é leitura).
const ENVIOS_DA_TELA = { 'laboratorio.html': ["'/api/aprovar'", "'/api/desfazer'"], 'cronograma.html': ["'/api/enviar-cliente'"], 'estilos.html': ["'/api/arquivo'", "'/api/estilo'", "'/api/estilo/desfazer'", "'/api/pedido'", "'/api/previas-marca'"] };
const SELETOR = path.join(PAINEIS, 'empresa-seletor.js');
// O arquivo como está no disco (para conferir que o servidor entrega os mesmos bytes) e o texto com o fim de linha
// normalizado (para os trechos e padrões de código): assim os testes valem também numa cópia com core.autocrlf=true.
const lerCru = (arq) => fs.readFileSync(arq, 'utf8');
const ler = (arq) => lerCru(arq).replace(/\r\n/g, '\n');
const { criarServidor } = require(path.join(PAINEIS, 'servidor.js'));
const EmpresaSeletor = require(SELETOR);

let falhas = 0;
const casos = [];
const t = (nome, fn) => casos.push({ nome, fn });

function pedir(porta, caminho) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: porta, path: caminho }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve({ status: res.statusCode, tipo: res.headers['content-type'], texto: Buffer.concat(partes).toString('utf8') }));
    }).on('error', reject);
  });
}

// ---------- 1. o servidor entrega as telas ----------

t('o servidor entrega laboratorio.html, cronograma.html, estilos.html e empresa-seletor.js com o tipo certo', async () => {
  // Servidor em memória sobre a própria pasta do código: só leituras, nada é gravado (nem o registro do servidor).
  const srv = criarServidor(path.resolve(RAIZ));
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const porta = srv.address().port;
  try {
    for (const tela of TELAS) {
      const html = await pedir(porta, '/_fabrica/paineis/' + tela);
      assert.strictEqual(html.status, 200, tela);
      assert.ok(/^text\/html/.test(html.tipo), html.tipo);
      assert.strictEqual(html.texto, lerCru(path.join(PAINEIS, tela)));
    }
    const js = await pedir(porta, '/_fabrica/paineis/empresa-seletor.js');
    assert.strictEqual(js.status, 200);
    assert.ok(/^application\/javascript/.test(js.tipo), js.tipo);
    assert.strictEqual(js.texto, lerCru(SELETOR));
  } finally { srv.close(); }
});

// ---------- 2. contrato das telas ----------

const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const PROIBIDAS = ['gaveta', 'disposicao', 'indice', 'legado', 'manifesto', 'webp'];
// Nomes de formato de arquivo nunca aparecem ao usuário ("PDF" pode: está no estudo aprovado). Valem nas listas de
// palavras internas das frases de cada tela.
const FORMATOS = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ttf', 'otf', 'woff'];
// As frases (entre aspas simples) de um trecho de código que aparecem ao usuário: com espaço ou começando por maiúscula.
const frasesDe = (codigo) => [...codigo.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => /\s/.test(s) || /^[A-ZÀ-Ú]/.test(s));
const temFormato = (f) => semAcento(f).toLowerCase().split(/[^a-z0-9]+/).find((p) => FORMATOS.includes(p));

t('nenhuma palavra interna nas telas nem no seletor', () => {
  for (const arq of TELAS.map((x) => path.join(PAINEIS, x)).concat(SELETOR)) {
    const texto = semAcento(ler(arq)).toLowerCase();
    for (const p of PROIBIDAS) assert.ok(!texto.includes(p), `${path.basename(arq)} usa a palavra "${p}"`);
  }
});

t('as telas nunca chamam fetch direto: todo pedido passa pelo seletor, sempre para uma rota /api/', () => {
  for (const tela of TELAS) {
    const h = ler(path.join(PAINEIS, tela));
    assert.ok(!/\bfetch\s*\(/.test(h), `${tela} chama fetch direto`);
    assert.ok(!/XMLHttpRequest|\bimport\s*\(|EventSource|WebSocket|sendBeacon/.test(h), `${tela} usa outro jeito de pedir dados`);
    assert.ok(/<script src="empresa-seletor\.js"><\/script>/.test(h), `${tela} não carrega o seletor comum`);
    const chamadas = [...h.matchAll(/seletor\.(ler|enviar)\(\s*([^,)]*)/g)];
    assert.ok(chamadas.filter(([, tipo]) => tipo === 'ler').length >= 2, `${tela}: esperava as leituras de dados e de painéis`);
    for (const [, tipo, arg] of chamadas) {
      assert.ok(/^'\/api\/[a-z-]+(\/[a-z-]+)?'$/.test(arg.trim()),`${tela}: seletor.${tipo}(${arg}) precisa de uma rota /api/ escrita por extenso`);
    }
    const enviados = chamadas.filter(([, tipo]) => tipo === 'enviar').map(([, , arg]) => arg.trim()).sort();
    assert.deepStrictEqual(enviados, ENVIOS_DA_TELA[tela], `${tela}: só pode gravar ${ENVIOS_DA_TELA[tela]}`);
    assert.ok(/seletor\.aplicarMarca\(\)/.test(h), `${tela}: cores e letras vêm da marca da empresa`);
    assert.ok(/seletor\.montar\(\{ seletor: \$\('seletor'\), aviso: \$\('aviso'\)/.test(h), `${tela}: mesmo seletor e mesmo aviso`);
  }
});

t('cronograma: lê só pelo servidor, liga ao Laboratório com a mesma empresa e mostra onde ficou o arquivo do cliente', () => {
  const h = ler(path.join(PAINEIS, 'cronograma.html'));
  const lidas = [...h.matchAll(/seletor\.ler\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
  // o caminho (liberação): só para saber se a pasta é de agência e mostrar o "+ Novo cliente"
  assert.deepStrictEqual([...new Set(lidas)], ['/api/caminho', '/api/dados', '/api/paineis']);
  assert.ok(/<title>Cronograma<\/title>/.test(h));
  assert.ok(/'laboratorio\.html\?empresa=' \+ encodeURIComponent\(/.test(h), 'link para o Laboratório leva a empresa');
  assert.ok(h.includes('Enviar ao cliente'), 'botão "Enviar ao cliente"');
  assert.ok(h.includes('O arquivo está em '), 'diz onde o arquivo ficou');
  assert.ok(/\.json\.endereco/.test(h), 'o link do arquivo é o endereço que o servidor devolveu');
  assert.ok(/\.disabled = true/.test(h), 'o botão fica desligado enquanto o arquivo é preparado');
  // o link do Laboratório para o Cronograma também leva a empresa
  assert.ok(/'cronograma\.html\?empresa=' \+ encodeURIComponent\(/.test(ler(path.join(PAINEIS, 'laboratorio.html'))));
});

t('cronograma: a arte de cada post para ver grande e baixar, e o roteiro em campos com copiar (R-13)', () => {
  const h = ler(path.join(PAINEIS, 'cronograma.html'));
  assert.ok(/<script src="roteiro-video\.js"><\/script>/.test(h) && /RoteiroVideo\.camposDoPost\(p\.bruto\)/.test(h), 'os campos vêm do roteiro-video.js');
  assert.ok(/tela\.dados\.midias/.test(h) && /dados\.json\.midias/.test(h), 'as artes vêm do /api/dados');
  assert.ok(/<dialog class="visor" id="visor"/.test(h), 'o visualizador');
  for (const frase of ["'Ver em tamanho grande'", "'Baixar o vídeo'", "'Baixar a imagem'", "'Baixar todas (ZIP)'", "'Baixar esta imagem'", "'Roteiro do vídeo e legenda'"]) assert.ok(h.includes(frase), 'falta ' + frase);
  assert.ok(/'\/api\/baixar-artes\?empresa=' \+ encodeURIComponent\(seletor\.atual\(\)\)/.test(h), 'o ZIP vem do servidor, sempre com a empresa da tela');
  assert.ok(/ArrowLeft/.test(h) && /ArrowRight/.test(h), 'setas do teclado no visualizador');
  assert.ok(/\/\^\\\/\[\^\/\]\/\.test\(a\.url\)/.test(h), 'só endereço da própria Fábrica vira imagem ou vídeo');
  const roteiro = require(path.join(PAINEIS, 'roteiro-video.js'));
  const campos = roteiro.camposDoPost({ script: '0:00–0:03 Gancho: Oi.\nNa tela: SELO', caption: 'Leg.' }).map((c) => c.rotulo);
  assert.deepStrictEqual(campos, ['Roteiro falado', 'Descrição visual', 'Roteiro com descrição visual', 'Legenda'], 'os quatro campos da R-13');
});

const ESTILOS = path.join(PAINEIS, 'estilos.html');
// Só o código da tela (sem os comentários), para os testes que procuram uma palavra no que roda.
const semComentarios = (h) => h.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

t('estilos: lê só a biblioteca e os painéis, com o aviso de modelo base, o interruptor e os textos combinados', () => {
  const h = ler(ESTILOS);
  assert.ok(/<title>Estilos<\/title>/.test(h) && /<h1>Estilos<\/h1>/.test(h));
  const lidas = [...h.matchAll(/seletor\.ler\(\s*'([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepStrictEqual(lidas, ['/api/biblioteca', '/api/biblioteca', '/api/letras', '/api/paineis', '/api/pedidos', '/api/previas-marca'], 'a biblioteca (ao abrir e quando o andamento muda), as letras (quadro da marca), os painéis, os pedidos e o andamento, cada um num lugar');
  // as gravações da tela: o pedido ao agente, a escolha do estilo e o desfazer dela, as imagens do estilo novo e as prévias
  // na marca, cada uma num só lugar
  assert.deepStrictEqual([...h.matchAll(/seletor\.enviar\(\s*([^,)]*)/g)].map((m) => m[1].trim()).sort(), ["'/api/arquivo'", "'/api/estilo'", "'/api/estilo/desfazer'", "'/api/pedido'", "'/api/previas-marca'"], 'a tela só grava o que o caminho pede');
  for (const frase of [
    'Estes são modelos base. Cores e letras viram as da sua marca. Você pode ajustar tudo depois.',
    'Suas prévias na marca ainda não foram geradas.',
    'Você ainda não definiu a sua marca. Os estilos continuam valendo: você escolhe um e a marca nasce dele.',
    'Nenhum estilo combina com esses filtros. Limpe um filtro.',
    "'Modelo base'", "'Na minha marca'", "'Limpar filtros'", "'Combina com'", "'Tom'", "'Funciona sem foto'",
    "'Na sua marca'", "'Ver os estilos na minha marca'", "'Preparando suas prévias na marca: '", "'Suas prévias de vídeo: '", "'Pausar'", "'Continuar'",
    "'Sua marca mudou. Estamos refazendo as prévias.'", "'Algumas prévias de vídeo precisam do vídeo de demonstração neste computador.'", "'Leitura difícil'",
  ]) assert.ok(h.includes(frase), `falta "${frase}"`);
  assert.ok(/role: 'radiogroup'/.test(h) && /role: 'radio'/.test(h), 'interruptor de duas posições');
  assert.ok(/disabled: vista === 'marca' && !naMarca/.test(h), '"Na minha marca" fica apagado sem as prévias na marca');
  assert.ok(/texto: 'Modelo base' \}\)/.test(h) && /classe: 'selo'/.test(h), 'selo "Modelo base" em todo cartão');
  assert.ok(/' de ' \+ tela\.total/.test(h), 'contagem "N de total"');
});

t('estilos: grade leve, nenhum vídeo toca sozinho e só um de cada vez', () => {
  const h = ler(ESTILOS);
  const codigo = semComentarios(h);
  assert.ok(!/autoplay/i.test(h), 'nenhum vídeo com autoplay');
  assert.ok(!/<video/i.test(h), 'nenhum <video> já na página: o vídeo só nasce na interação');
  assert.ok(/el\('video', \{[^}]*preload: 'none'/.test(h), 'vídeo com preload none');
  assert.ok(/el\('video', \{[^}]*muted: true[^}]*playsinline: true/.test(h), 'vídeo mudo e na própria página');
  const doCartao = /function cartao\(e\) \{([\s\S]*?)\n  \}\n/.exec(h);
  assert.ok(doCartao, 'função cartao()');
  assert.strictEqual([...doCartao[1].matchAll(/el\('img'/g)].length, 1, 'uma imagem por cartão');
  assert.ok(/el\('img', \{[^}]*loading: 'lazy'/.test(doCartao[1]), 'a imagem do cartão tem loading lazy');
  assert.ok(!/el\('video'/.test(doCartao[1]), 'o cartão nasce sem vídeo');
  // dois lugares dão play: tocar() na grade (que para o cartão anterior antes) e o botão de play do detalhe
  assert.strictEqual([...codigo.matchAll(/\.play\(/g)].length, 2, 'só dois lugares começam um vídeo');
  const tocar = /function tocar\(c\) \{([\s\S]*?)\n  \}\n/.exec(h);
  assert.ok(tocar && /if \(ativo && ativo !== c\) parar\(ativo\);/.test(tocar[1]) && /\.play\(\)/.test(tocar[1]), 'tocar() para o anterior antes de dar play');
  const doDetalhe = /function tocarVideoDoDetalhe\(video, play\) \{([\s\S]*?)\n  \}\n/.exec(h);
  assert.ok(doDetalhe && /pararTudo\(\);/.test(doDetalhe[1]) && /\.play\(\)/.test(doDetalhe[1]), 'o play do detalhe para a grade antes');
  assert.deepStrictEqual([...codigo.matchAll(/tocarVideoDoDetalhe\(/g)].length, 2, 'o vídeo do detalhe só toca pelo botão (declaração + clique)');
  assert.ok(/play\.addEventListener\('click', \(\) => tocarVideoDoDetalhe\(video, play\)\)/.test(h), 'só o clique no play toca o vídeo do detalhe');
  assert.ok(/pointerleave[^\n]*parar\(c\)/.test(h), 'sair do cartão para o vídeo');
  assert.ok(/focusout[^\n]*parar\(c\)/.test(h), 'o foco que sai do cartão para o vídeo');
  assert.ok(/prefers-reduced-motion: reduce/.test(h), 'respeita quem pede pouco movimento');
  assert.ok(/visibilitychange[^\n]*pararTudo\(\);[^\n]*pararVideoDoDetalhe\(\)/.test(h), 'aba escondida para os vídeos (grade e detalhe)');
  // com mouse o botão de play do cartão some (passar por cima já toca); no toque, com pouco movimento e no foco do teclado fica
  assert.ok(/@media \(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\) \{\s*\.cartao-play \{ opacity: 0; pointer-events: none; \}\s*\.cartao-play:focus-visible \{ opacity: 1; \}/.test(h), 'botão de play escondido só para o mouse');
});

t('estilos: nada de HTML montado com dado de arquivo, filtros só na memória, gancho do detalhe', () => {
  for (const tela of TELAS) {
    const codigo = semComentarios(ler(path.join(PAINEIS, tela)));
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(codigo), `${tela} monta HTML com texto`);
  }
  const h = ler(ESTILOS);
  const codigo = semComentarios(h);
  assert.ok(!/localStorage|sessionStorage/.test(codigo), 'os filtros moram só na memória da página');
  assert.ok(/function abrirDetalhe\(estilo\)/.test(h) && /onclick: \(\) => abrirDetalhe\(e\)/.test(h), 'clicar no cartão chama abrirDetalhe');
  assert.ok(/location\.hash = 'estilo=' \+ encodeURIComponent\(estilo\.chave\)/.test(h), 'o estilo aberto vai no endereço');
  assert.ok(/<section class="detalhe" id="detalhe"[^>]*hidden><\/section>/.test(h), 'contêiner do detalhe');
  assert.ok(/const enderecoLocal = /.test(h) && /corValida\(/.test(h), 'endereço e cor do catálogo conferidos antes de usar');
});

// Pega uma função (ou constante) do script da tela pelo nome e a roda aqui, sozinha.
function trechoDaTela(h, inicio) {
  const i = h.indexOf(inicio);
  assert.ok(i >= 0, 'falta ' + inicio);
  const fim = h.indexOf('\n  }\n', i);
  return h.slice(i, fim + 4);
}

t('estilos, detalhe: abas só para o que tem prévia, e a primeira segue a intenção da empresa (senão Carrossel)', () => {
  const h = ler(ESTILOS);
  // eslint-disable-next-line no-new-func
  const { abasDe, primeiraAba } = new Function(trechoDaTela(h, 'function abasDe(p) {') + trechoDaTela(h, 'function primeiraAba(abas, intencao) {') + 'return { abasDe, primeiraAba };')();
  const tudo = { video: '/v', carrossel: ['/a', '/b'], reelsCapa: '/r', fixados: [{ src: '/f' }] };
  assert.deepStrictEqual(abasDe(tudo), ['video', 'carrossel', 'capa-reels', 'fixados']);
  // Primeira Página de verdade: vídeo e capa de Reels, sem carrossel nem fixados
  const primeira = { video: '/v', carrossel: [], reelsCapa: '/r', fixados: [] };
  assert.deepStrictEqual(abasDe(primeira), ['video', 'capa-reels']);
  assert.deepStrictEqual(abasDe({ video: null, carrossel: [], reelsCapa: '/r', fixados: [] }), ['capa-reels']);
  assert.deepStrictEqual(abasDe({ video: null, carrossel: [], reelsCapa: null, fixados: [] }), [], 'sem prévia: nenhuma aba');
  assert.strictEqual(primeiraAba(abasDe(tudo), []), 'carrossel', 'sem intenção: Carrossel');
  assert.strictEqual(primeiraAba(abasDe(tudo), ['video', 'carrossel']), 'video', 'a empresa quer vídeo');
  assert.strictEqual(primeiraAba(abasDe(tudo), ['carrossel']), 'carrossel');
  assert.strictEqual(primeiraAba(abasDe(primeira), []), 'video', 'sem carrossel: a primeira que existe');
  assert.strictEqual(primeiraAba(abasDe(primeira), ['carrossel', 'video']), 'video', 'quer carrossel, não tem: o próximo querido');
  assert.strictEqual(primeiraAba(['capa-reels'], ['video']), 'capa-reels');
  assert.strictEqual(primeiraAba([], ['video']), null);
  // os rótulos das abas, por extenso
  for (const r of ["video: 'Vídeo'", "carrossel: 'Carrossel'", "'capa-reels': 'Capa de Reels'", "fixados: 'Posts fixados'"]) assert.ok(h.includes(r), 'falta a aba ' + r);
  assert.ok(/role: 'tablist'/.test(h) && /role: 'tab'/.test(h) && /role: 'tabpanel'/.test(h), 'abas com os papéis certos');
});

t('estilos, detalhe: endereço de prévia só da pasta das prévias, sem "..", e cor só em hex', () => {
  const h = ler(ESTILOS);
  const linhas = ['const PASTA_DAS_PREVIAS = ', 'const PREVIAS_DA_EMPRESA = ', 'const trechoOk = ', 'const enderecoBase = ', 'const enderecoDaMarca = ', 'const enderecoLocal = ', 'const corValida = '].map((ini) => {
    const i = h.indexOf(ini);
    assert.ok(i >= 0, 'falta ' + ini);
    return h.slice(i, ini === 'const trechoOk = ' ? h.indexOf('\n  };\n', i) + 5 : h.indexOf('\n', i));
  });
  // a empresa escolhida no seletor de mentira: aurora
  const seletor = { atual: () => 'aurora' };
  // eslint-disable-next-line no-new-func
  const { enderecoLocal, enderecoBase, enderecoDaMarca, corValida } = new Function('seletor', linhas.join('\n') + '\nreturn { enderecoLocal, enderecoBase, enderecoDaMarca, corValida };')(seletor);
  const BASE = '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/';
  for (const ok of [BASE + 'bloco/carrossel-01.webp', BASE + 'primeira-pagina/video.webm', BASE + 'circuito-neon/reels%20capa.webp']) {
    assert.strictEqual(enderecoLocal(ok), ok, ok);
    assert.strictEqual(enderecoBase(ok), ok, ok);
    assert.strictEqual(enderecoDaMarca(ok), null, 'endereço base nunca é "na sua marca"');
  }
  // na marca: só a pasta das prévias da empresa escolhida, <estilo>/<arquivo>
  const MARCA = '/empresas/aurora/previas/';
  for (const ok of [MARCA + 'bloco/carrossel-01.webp', MARCA + 'primeira-pagina/video.webm']) {
    assert.strictEqual(enderecoLocal(ok), ok, ok);
    assert.strictEqual(enderecoDaMarca(ok), ok, ok);
    assert.strictEqual(enderecoBase(ok), null, 'endereço da empresa nunca vale como base');
  }
  assert.strictEqual(enderecoDaMarca('/empresas/aurora/cores-sugeridas/abc-neutro-e3d1c8/bloco/carrossel-01.webp', 'cores-sugeridas', 3), '/empresas/aurora/cores-sugeridas/abc-neutro-e3d1c8/bloco/carrossel-01.webp');
  for (const ruim of [
    '/empresas/boreal/previas/bloco/carrossel-01.webp', '/empresas/aurora/marca.yaml', '/empresas/aurora/previas/fila.json', '/empresas/.fila-previas.json',
    MARCA + 'bloco/../../boreal/previas/bloco/x.webp', MARCA + '%2e%2e/x.webp', MARCA + 'bloco/%2fx', MARCA + 'bloco/x/y.webp', MARCA + 'bloco/x.webp?y', MARCA + 'bloco/x.webp#y',
    MARCA + 'bloco\\x.webp', '/empresas/aurora/cores-sugeridas/abc/bloco/x.webp', '/empresas/AURORA/previas/bloco/x.webp', '/empresas/aurora%2f..%2fboreal/previas/bloco/x.webp',
    '/empresas/aurora/fontes/x/y.ttf',
  ]) assert.strictEqual(enderecoLocal(ruim), null, String(ruim));
  assert.strictEqual(enderecoDaMarca('/empresas/aurora/previas/bloco/x.webp', 'cores-sugeridas', 3), null);
  seletor.atual = () => 'boreal';
  assert.strictEqual(enderecoLocal(MARCA + 'bloco/carrossel-01.webp'), null, 'com a boreal no seletor, nada da aurora');
  seletor.atual = () => null;
  assert.strictEqual(enderecoDaMarca(MARCA + 'bloco/carrossel-01.webp'), null, 'sem empresa no seletor, nada na marca');
  for (const ruim of [
    '/empresas/aurora/marca.yaml', '/04-LABORATORIO-DE-DESIGN/estilos/bloco/estilo.yaml', '//exemplo.com/x.webp', 'http://exemplo.com/x.webp',
    'javascript:alert(1)', 'bloco/x.webp', BASE, BASE + '../../../empresas/aurora/marca.yaml', BASE + 'bloco/../../x', BASE + '%2e%2e/x.webp',
    BASE + 'bloco/%2E%2E/%2e%2e/x', BASE + './x.webp', BASE + 'bloco//x.webp', BASE + 'bloco\\..\\x', BASE + 'bloco/x.webp?y=1', BASE + 'bloco/x.webp#y',
    BASE + 'bloco/%2fx', BASE + 'bloco/%5cx', BASE + 'bloco/%E0%A4%A', 'x' + BASE + 'a', null, undefined, 5, {},
  ]) assert.strictEqual(enderecoLocal(ruim), null, String(ruim));
  seletor.atual = () => 'aurora';
  assert.strictEqual(corValida('#1A2B3C'), '#1A2B3C');
  for (const ruim of ['red', '#12345', 'url(x)', '#1234567', null]) assert.strictEqual(corValida(ruim), null, String(ruim));
});

// Pega uma linha (constante de uma linha) ou uma função do script da tela, pelo começo.
const linhaDaTela = (h, inicio) => { const i = h.indexOf(inicio); assert.ok(i >= 0, 'falta ' + inicio); return h.slice(i, h.indexOf('\n', i)); };
const pedacoDaTela = (h, inicio) => (/^(async )?function /.test(inicio) ? trechoDaTela(h, inicio) : linhaDaTela(h, inicio));

t('estilos, na marca: a consulta do andamento usa um só temporizador, só com trabalho e a página à vista, e descarta a resposta antiga', async () => {
  const h = ler(ESTILOS);
  const codigo = ['const consulta = ', 'const trabalhando = ', 'function pararConsulta() {', 'function agendarConsulta() {', 'async function consultar() {'].map((x) => pedacoDaTela(h, x)).join('\n');
  const relogios = [];
  let limpos = 0;
  const falsoSet = (fn, ms) => { relogios.push({ fn, ms }); return relogios.length; };
  const falsoClear = (id) => { if (id !== null && id !== undefined) limpos += 1; };
  const documento = { hidden: false };
  const tela = { progresso: { estado: 'imagens' } };
  let atual = 'aurora';
  const lidas = [];
  let soltar = null;
  const seletor = { atual: () => atual, ler: (rota) => { lidas.push(rota); return new Promise((ok) => { soltar = ok; }); } };
  const aplicados = [];
  // eslint-disable-next-line no-new-func
  const f = new Function('seletor', 'document', 'setTimeout', 'clearTimeout', 'tela', 'aplicarProgresso', 'INTERVALO_CONSULTA', codigo + '\nreturn { agendarConsulta, pararConsulta, consultar };')(
    seletor, documento, falsoSet, falsoClear, tela, async (p) => { aplicados.push(p); }, 5000);
  f.agendarConsulta(); f.agendarConsulta(); f.agendarConsulta();
  assert.strictEqual(relogios.length, 1, 'um temporizador só');
  assert.strictEqual(relogios[0].ms, 5000, 'no máximo uma consulta a cada 5 s');
  f.pararConsulta();
  assert.ok(limpos >= 1, 'parar limpa o temporizador');
  for (const estado of ['pronto', 'pausado', 'nada', 'sem-marca']) { tela.progresso = { estado }; f.agendarConsulta(); }
  tela.progresso = { estado: 'videos' };
  documento.hidden = true;
  f.agendarConsulta();
  assert.strictEqual(relogios.length, 1, 'sem trabalho, ou com a página escondida, nada é agendado');
  documento.hidden = false;
  f.agendarConsulta();
  assert.strictEqual(relogios.length, 2);
  // a leitura sai pelo seletor; trocar de empresa no meio descarta a resposta
  const em = f.consultar();
  assert.deepStrictEqual(lidas, ['/api/previas-marca']);
  atual = 'boreal';
  f.pararConsulta();
  soltar({ ok: true, json: { estado: 'videos', empresa: 'aurora' } });
  await em;
  assert.deepStrictEqual(aplicados, [], 'resposta da empresa anterior não muda a tela');
  const em2 = f.consultar();
  soltar({ ok: true, json: { estado: 'videos' } });
  await em2;
  assert.deepStrictEqual(aplicados, [{ estado: 'videos' }]);
  // o temporizador é limpo ao trocar de empresa e quando a página some; é o único da tela
  assert.ok(/pararConsulta\(\);/.test(trechoDaTela(h, 'async function carregarEmpresa(primeira) {')), 'trocar de empresa para a consulta');
  assert.ok(/visibilitychange[^\n]*if \(document\.hidden\) \{[^\n]*pararConsulta\(\);[^\n]*\} else agendarConsulta\(\);/.test(h), 'página escondida para a consulta; de volta, agenda');
  assert.strictEqual([...semComentarios(h).matchAll(/setTimeout\(/g)].length, 1, 'um só setTimeout na tela: o da consulta');
});

t('estilos, na marca: o selo "Na sua marca" e o marcador "Leitura difícil" só nascem das prévias na marca conferidas', () => {
  const h = ler(ESTILOS);
  const nomes = ['const PASTA_DAS_PREVIAS = ', 'const PREVIAS_DA_EMPRESA = ', 'const trechoOk = ', 'const enderecoBase = ', 'const enderecoDaMarca = ', 'const corValida = ',
    'const objeto = ', 'const lista = ', 'const limpo = ', 'const NOME_COR = ', 'const ROTULO_FIXADO = ', 'const NA_SUA_MARCA = ', 'const FIXADO_EM_PALAVRAS = ', 'function ondeDaPeca(p) {', 'function conferirLeitura(g) {', 'function conferirMarca(p) {',
    'function vistaDoCartao(e) {', 'const seloDe = '];
  const codigo = nomes.map((x) => (x === 'const trechoOk = ' ? h.slice(h.indexOf(x), h.indexOf('\n  };\n', h.indexOf(x)) + 5) : pedacoDaTela(h, x))).join('\n');
  const tela = { vista: 'marca' };
  // eslint-disable-next-line no-new-func
  const { conferirMarca, vistaDoCartao, seloDe } = new Function('seletor', 'tela', codigo + '\nreturn { conferirMarca, vistaDoCartao, seloDe };')({ atual: () => 'aurora' }, tela);
  const M = '/empresas/aurora/previas/bloco/';
  const base = { capa: '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/bloco/c.webp', carrossel: ['/b1'], video: '/vb', videoCapa: '/vbc', marca: null };
  // prévias na marca de outra empresa, sem capa ou com endereço torto: nada
  assert.strictEqual(conferirMarca({ capa: '/empresas/boreal/previas/bloco/c.webp' }), null);
  assert.strictEqual(conferirMarca({ capa: null, carrossel: [M + 'c.webp'] }), null);
  assert.strictEqual(conferirMarca({ capa: M + '../c.webp' }), null);
  assert.strictEqual(conferirMarca(null), null);
  const marca = conferirMarca({ capa: M + 'c.webp', carrossel: [M + 'c.webp', '/empresas/boreal/previas/bloco/d.webp'], video: M + 'video.webm', videoCapa: null,
    avisos: ['Com as suas cores, o texto da lâmina 1 fica difícil de ler.', 5], leitura: [{ tipo: 'cor', papel: 'neutro', onde: ['texto do arquivo <b>'], pecas: [{ formato: 'carrossel', lamina: 1 }, { formato: 'fixados', lamina: 9 }], sugestoes: [{ cor: 'red', rotulo: 'x' }] },
      { tipo: 'estilo', onde: ['x'], pecas: [] }, { tipo: 'estilo', pecas: [{ formato: 'reels', lamina: 1 }] }] });
  assert.deepStrictEqual(marca.carrossel, [M + 'c.webp'], 'só endereços da empresa escolhida');
  assert.strictEqual(marca.video, null, 'vídeo só com a capa dele');
  assert.deepStrictEqual(marca.avisos, ['Com as suas cores, o texto da lâmina 1 fica difícil de ler.']);
  assert.deepStrictEqual(marca.leitura[0].sugestoes, [], 'cor que não é código fica de fora');
  assert.deepStrictEqual(marca.leitura[0].onde, ['da lâmina 1'], 'o onde sai da peça (a peça estranha fica de fora), nunca do texto do arquivo');
  assert.deepStrictEqual(marca.leitura.map((g) => [g.tipo, g.onde]), [['cor', ['da lâmina 1']], ['estilo', ['da capa de Reels']]], 'grupo sem peça nenhuma não entra; os outros todos entram');
  // o cartão: na marca só com as prévias conferidas; o vídeo base continua quando o da marca não está pronto
  assert.strictEqual(seloDe(vistaDoCartao(base)), 'Modelo base');
  const comMarca = { ...base, marca };
  let v = vistaDoCartao(comMarca);
  assert.strictEqual(seloDe(v), 'Na sua marca');
  assert.strictEqual(v.capa, M + 'c.webp');
  assert.strictEqual(v.video, '/vb', 'vídeo ainda no modelo base');
  assert.strictEqual(v.videoNaMarca, false);
  assert.strictEqual(v.leitura, true, 'marcador de leitura difícil');
  v = vistaDoCartao({ ...base, marca: { ...marca, video: M + 'video.webm', videoCapa: M + 'video-capa.webp', leitura: [] } });
  assert.strictEqual(v.video, M + 'video.webm');
  assert.strictEqual(v.videoNaMarca, true);
  assert.strictEqual(v.leitura, false);
  tela.vista = 'base';
  v = vistaDoCartao(comMarca);
  assert.strictEqual(seloDe(v), 'Modelo base');
  assert.strictEqual(v.capa, base.capa);
  assert.strictEqual(v.leitura, false);
  // de onde vem: o item do catálogo passa por conferirMarca; o texto "Na sua marca" existe uma vez só, na constante
  assert.ok(/marca: conferirMarca\(e\.previasMarca\)/.test(h), 'as prévias na marca do catálogo são conferidas');
  assert.strictEqual([...h.matchAll(/'Na sua marca'/g)].length, 1, 'o texto do selo nasce num lugar só');
  assert.strictEqual([...h.matchAll(/'Leitura difícil'/g)].length, 1);
  // D3: o vídeo base num cartão na marca mostra "Modelo base" enquanto toca, e volta ao parar
  assert.ok(/c\.vista\.naMarca && !c\.vista\.videoNaMarca/.test(trechoDaTela(h, 'function tocar(c) {')), 'o selo vira "Modelo base" com o vídeo base');
  assert.ok(/seloDe\(c\.vista\)/.test(trechoDaTela(h, 'function parar(c) {')), 'ao parar, o selo volta');
});

t('estilos: os textos que aparecem na tela não usam palavra interna', () => {
  const codigo = semComentarios(ler(ESTILOS));
  const script = codigo.slice(codigo.indexOf('<script>'));
  const frases = [...script.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => /\s/.test(s) || /^[A-ZÀ-Ú]/.test(s));
  assert.ok(frases.length > 40, 'achou as frases da tela');
  const INTERNAS = ['fila', 'assinatura', 'trabalhador', 'manifesto', 'webp', 'gaveta', 'disposicao', 'indice', 'legado', 'json', 'yaml'].concat(FORMATOS);
  for (const f of frases) for (const p of INTERNAS) assert.ok(!semAcento(f).toLowerCase().split(/[^a-z]+/).includes(p), `"${f}" usa "${p}"`);
});

t('estilos, na marca: começar pelo botão, refazer sozinha quando a marca mudou, e o andamento com "Pausar" e "Continuar"', () => {
  const h = ler(ESTILOS);
  const carregar = trechoDaTela(h, 'async function carregarEmpresa(primeira) {');
  assert.ok(/tela\.marca\.desatualizada/.test(carregar) && /agirNasPrevias\('gerar'/.test(carregar), 'marca mudada: pede de novo ao abrir (B2)');
  assert.ok(/tela\.vista = tela\.marca\.naMarca \? 'marca' : 'base';/.test(carregar), 'com prévias prontas, abre na marca (B2)');
  const andamento = trechoDaTela(h, 'function desenharAndamento() {');
  for (const x of ["'gerar'", "'pausar'", "'retomar'", 'VER_NA_MARCA', 'SEM_DEMONSTRACAO', 'MARCA_MUDOU']) assert.ok(andamento.includes(x), 'andamento sem ' + x);
  const envio = trechoDaTela(h, 'async function enviarPrevias(corpo) {');
  assert.ok(/seletor\.enviar\('\/api\/previas-marca', corpo\)/.test(envio) && !/empresa/.test(envio), 'envio pelo seletor, que põe a empresa por último');
  // trocar a vista ou receber prévias novas troca só os cartões (os filtros e a rolagem ficam)
  const troca = trechoDaTela(h, 'function trocarCartao(c, estilo) {');
  assert.ok(/replaceWith/.test(troca) && /hidden = c\.li\.hidden/.test(troca) && !/desenhar\(\)/.test(troca), 'troca no lugar');
  assert.ok(/if \(ativo === c\)/.test(troca), 'o cartão que está tocando fica como está');
});

t('estilos, detalhe na marca: o estilo aberto passa para a frente uma vez por abertura, pelo seletor, e a resposta velha é descartada', () => {
  const h = ler(ESTILOS);
  const mostrar = trechoDaTela(h, 'function mostrarDetalhe(estilo) {');
  assert.ok(/if \(previas\.naMarca && estilo\.videoMarca === 'esperando'\) priorizarVideo\(estilo\);/.test(mostrar), 'abrir o detalhe de um vídeo que espera pede a vez');
  assert.strictEqual([...semComentarios(h).matchAll(/priorizarVideo\(/g)].length, 2, 'um lugar só chama (declaração + abertura)');
  const prio = trechoDaTela(h, 'async function priorizarVideo(estilo) {');
  assert.ok(/enviarPrevias\(\{ acao: 'priorizar', estilo: estilo\.id \}\)/.test(prio) && !/empresa/.test(prio), 'pelo seletor (a empresa vai por último, posta por ele)');
  assert.ok(/if \(r === null \|\| vez !== aberto\.vez \|\| !r\.ok\) return;/.test(prio), 'resposta de outra empresa ou de outra abertura: descartada');
  assert.ok(h.includes("'Seu vídeo deste estilo é o próximo a ficar pronto.'"));
});

t('estilos, detalhe na marca: abas, lado a lado (D2 A), cores do estilo sobre as da marca (D6 B), nota da letra de destaque e leitura difícil com as cores sugeridas', () => {
  const h = ler(ESTILOS);
  // abas: o que ainda não existe na marca diz "Modelo base" na própria aba
  const prev = trechoDaTela(h, 'function desenharPrevias(estilo, previas) {');
  assert.ok(/previas\.naMarca && !previas\.daMarca\[a\]/.test(prev) && /'Modelo base'/.test(prev), 'aba com "Modelo base"');
  for (const frase of ['Do estilo', 'Códigos das cores da sua marca', 'Como ficaria', 'Usar esta cor',
    'Este estilo deixa o texto difícil de ler com a sua marca; que tal outro estilo?', 'Cores que resolvem e combinam com a sua marca']) {
    assert.ok(h.includes(frase), 'falta ' + frase);
  }
  const info = trechoDaTela(h, 'function desenharInfo(estilo, titulo, previas) {');
  assert.ok(/estilo\.notaDestaque/.test(info), 'a nota da letra de destaque nos detalhes técnicos');
  assert.ok(/previas\.naMarca \? desenharLeitura\(estilo\) : null/.test(info), 'a leitura difícil só na marca');
  // "Como ficaria": pelo seletor, e a peça só da pasta das cores sugeridas da empresa escolhida
  const como = trechoDaTela(h, 'async function verComoFicaria(estilo, g, s, botao, ver, estado) {');
  assert.ok(/enviarPrevias\(\{ acao: 'como-ficaria', estilo: estilo\.id, papel: g\.papel, cor: s\.cor, peca: g\.pecas\[0\] \}\)/.test(como), 'o pedido diz a peça');
  assert.ok(/enderecoDaMarca\(p\.endereco, 'cores-sugeridas', 3\)/.test(como) && /if \(r === null \|\| vez !== aberto\.vez\) return;/.test(como));
  assert.ok(/mesmaPeca\(/.test(como), 'cada peça da resposta é conferida contra as peças do grupo');
  // "Usar esta cor" (etapa 8, contrato com a Tarefa 10): leva a "Personalizar" em Sua marca, já com o papel e a cor; nunca
  // grava a marca (nenhuma rota de marca na tela)
  const usar = trechoDaTela(h, 'function usarCor(estilo, g, s) {');
  assert.ok(/enderecoPersonalizar\(estilo\.id, g\.papel, s\.cor, estilo\.proprio\)/.test(usar), 'abre Personalizar já preenchido');
  assert.ok(!/g\.onde/.test(usar), 'nada do texto do arquivo');
  assert.ok(!/seletor\.enviar/.test(usar), 'não envia nada sozinho');
  assert.ok(!/\/api\/marca/.test(h), 'a tela não tem rota de gravar a marca');
  // nenhum grupo cortado em silêncio
  assert.ok(!/leitura\)\.map\(conferirLeitura\)\.filter\(Boolean\)\.slice\(0, 5\)/.test(h), 'todos os grupos');
  // nome acessível com a cor e a peça
  const sug = trechoDaTela(h, 'function sugestao(estilo, g, s) {');
  assert.ok((sug.match(/'aria-label': /g) || []).length >= 2 && /s\.cor/.test(sug) && /pecasEmPalavras/.test(sug), 'botões com a cor e a peça no nome');
  // o nome começa pelo texto visível e cita todas as peças do grupo (ou "e mais N")
  assert.ok(/'aria-label': 'Como ficaria: ' \+/.test(sug) && /'aria-label': 'Usar esta cor: ' \+/.test(sug), 'nome começa pelo texto do botão');
  assert.ok(/pecasEmPalavras\(g\.pecas\)/.test(sug), 'todas as peças do grupo no nome');
  const emPalavras = new Function([linhaDaTela(h, 'const FIXADO_EM_PALAVRAS = '), trechoDaTela(h, 'function ondeDaPeca(p) {'), linhaDaTela(h, 'const juntos = '), trechoDaTela(h, 'function pecasEmPalavras(pecas) {')].join('\n') + '\nreturn pecasEmPalavras;')();
  assert.strictEqual(emPalavras([{ formato: 'carrossel', lamina: 1 }, { formato: 'reels', lamina: 1 }]), 'da lâmina 1 e da capa de Reels');
  assert.strictEqual(emPalavras([1, 2, 3, 4, 5].map((n) => ({ formato: 'carrossel', lamina: n }))), 'da lâmina 1, da lâmina 2, da lâmina 3 e de mais 2 peças');
  // uma troca por vez; e a peça que a cor nova estraga é dita no lugar de "fica fácil de ler"
  assert.ok(h.includes('Escolha uma troca por vez; depois as sugestões são refeitas.'));
  assert.ok(/pioradas/.test(como) && /'Com esta cor, estas peças ficam difíceis: '/.test(como), 'diz o que a cor estraga');
  assert.ok(/if \(pioradas\.length\)[\s\S]*else if \(!ainda\.length\) estado\.textContent = 'Com esta cor, o texto fica fácil de ler\.';/.test(como), '"fácil de ler" só sem peça piorada');
  // o aviso cita o estilo e a peça de cada texto que piora (de qualquer estilo da empresa)
  const quem = new Function([linhaDaTela(h, 'const FIXADO_EM_PALAVRAS = '), trechoDaTela(h, 'function ondeDaPeca(p) {'), linhaDaTela(h, 'const limpo = '), trechoDaTela(h, 'function textoPiorado(p) {')].join('\n') + '\nreturn textoPiorado;')();
  assert.strictEqual(quem({ nome: 'Cartilha', formato: 'carrossel', lamina: 1, texto: 'café' }), '“café”, na lâmina 1 do estilo Cartilha');
  assert.strictEqual(quem({ nome: 'Retrô', formato: 'reels', lamina: 1, texto: '' }), 'um texto, na capa de Reels do estilo Retrô');
  // a troca vale para todos os estilos da marca (na tela e no recado)
  assert.ok(h.includes('a cor muda em todos os estilos da sua marca'), 'na tela');
  // enquanto houver estilo sem prévia válida, a conta vale só para os já prontos e diz quantos faltam
  const vale = new Function(trechoDaTela(h, 'function valeParaTodos(n) {') + '\nreturn valeParaTodos;')();
  assert.ok(/em nenhum deles, ficar difícil\.$/.test(vale(0)));
  assert.ok(/nos estilos já prontos/.test(vale(3)) && !/em nenhum deles/.test(vale(3)) && / 3 estilos ainda não foram conferidos\.$/.test(vale(3)), vale(3));
  assert.ok(/ 1 estilo ainda não foi conferido\.$/.test(vale(1)), vale(1));
  assert.ok(/semConferir: contagem\(o\.semConferir\)/.test(trechoDaTela(h, 'function lerMarca(m) {')), 'a tela guarda quantos faltam');
  assert.ok(/valeParaTodos\(tela\.marca\.semConferir\)/.test(trechoDaTela(h, 'function desenharLeitura(estilo) {')), 'o detalhe usa a conta');
  // (o "Usar esta cor" não monta mais recado: leva a Sua marca com o papel e a cor; a frase acima, na tela, avisa)
  // o "detalhe" pequeno tem frase leve e não manda trocar de estilo, nem acende o marcador da grade
  assert.ok(h.includes('Um detalhe pequeno deste estilo fica um pouco abaixo do ideal de leitura com a sua marca.'));
  assert.ok(/o\.tipo === 'detalhe'/.test(trechoDaTela(h, 'function conferirLeitura(g) {')));
  assert.ok(/leitura\.some\(\(g\) => g\.tipo !== 'detalhe'\)/.test(trechoDaTela(h, 'function vistaDoCartao(e) {')), 'o marcador só para leitura de verdade difícil');
  // abas: a ativa rola para a vista e há sinal de mais abas
  assert.ok(/scrollIntoView\(\{ block: 'nearest', inline: 'nearest' \}\)/.test(prev), 'a aba ativa aparece');
  assert.ok(/tem-mais/.test(prev) && /\.abas-caixa\.tem-mais::after/.test(h), 'sinal de que há mais abas');
});

t('estilos, detalhe na marca: o "onde" de uma peça sai do formato e do número', () => {
  const h = ler(ESTILOS);
  const codigo = [linhaDaTela(h, 'const FIXADO_EM_PALAVRAS = '), trechoDaTela(h, 'function ondeDaPeca(p) {')].join('\n');
  // eslint-disable-next-line no-new-func
  const ondeDaPeca = new Function(codigo + '\nreturn ondeDaPeca;')();
  assert.strictEqual(ondeDaPeca({ formato: 'carrossel', lamina: 3 }), 'da lâmina 3');
  assert.strictEqual(ondeDaPeca({ formato: 'fixados', lamina: 2 }), 'do post fixado de método');
  assert.strictEqual(ondeDaPeca({ formato: 'reels', lamina: 1 }), 'da capa de Reels');
  for (const ruim of [{ formato: 'fixados', lamina: 9 }, { formato: 'outro', lamina: 1 }, { formato: 'carrossel', lamina: '1;' }, null]) assert.strictEqual(ondeDaPeca(ruim), '', JSON.stringify(ruim));
});

t('estilos, detalhe: campos, pedidos ao agente pelo seletor, botão desligado no envio, Esc, endereço e nada de janela do navegador', () => {
  const h = ler(ESTILOS);
  const codigo = semComentarios(h);
  for (const frase of [
    "'Combina com'", "'O que precisa'", "'Base e marca lado a lado'", 'Suas prévias na marca chegam depois de você definir a marca',
    "'Cores e letras do estilo'", "escuro: 'Escuro'", "claro: 'Claro'", "acento: 'Acento'", "neutro: 'Neutro'", "'Letras'",
    "'Como este estilo vira seu'", "'Você escolhe a marca'", "'A Fábrica troca as cores e as letras'", "'Você ajusta o que quiser'",
    "'Detalhes técnicos'", "'Fontes'", "'Códigos das cores'", "'Tratamentos'", "'Regras do estilo'",
    "botao: 'Usar este estilo'", "botao: 'Personalizar'", "botao: 'Criar um estilo novo a partir de referências'",
    "'Voltar para os estilos'", "'Modelo base'",
  ]) assert.ok(h.includes(frase), `falta "${frase}"`);
  // os três tipos de pedido, e só eles
  assert.deepStrictEqual([...h.matchAll(/^    '?([a-z-]+)'?: \{\n      botao:/gm)].map((m) => m[1]), ['usar-estilo', 'personalizar', 'estilo-novo']);
  // o pedido sai só pelo seletor (que põe a empresa por último), com o tipo e o estilo
  const envio = trechoDaTela(h, 'async function enviarPedido(');
  assert.ok(/const corpo = \{ tipo, estilo: estilo\.id \};/.test(envio) && /if \(recado\) corpo\.nota = recado;/.test(envio), 'corpo do pedido: tipo, estilo e o recado');
  assert.ok(/r = await seletor\.enviar\('\/api\/pedido', corpo\);/.test(envio), 'o pedido vai pelo seletor');
  assert.ok(!/empresa/.test(envio.replace(/\/\/.*$/gm, '').replace(/tela\.nome|Pedido anotado para/g, '')), 'a tela não põe a empresa no corpo (o seletor põe, por último)');
  // os botões desligam antes do envio e religam depois (também quando dá erro)
  const desliga = envio.indexOf('desligar.forEach((b) => { b.disabled = true; });');
  const envia = envio.indexOf("await seletor.enviar('/api/pedido'");
  const religa = envio.indexOf('} finally {\n      desligar.forEach((b) => { b.disabled = false; });');
  assert.ok(desliga >= 0 && envia > desliga && religa > envia, 'desliga, envia, religa no finally');
  assert.ok(/botoes\.concat\(confirmar, cancelar\)/.test(h), 'desliga os três botões e os da confirmação');
  // resposta descartada (outra empresa) ou de um detalhe que já fechou não mexe na tela
  assert.ok(/if \(r === null \|\| vez !== aberto\.vez\) return;/.test(envio));
  assert.ok(/'Pedido anotado para ' \+ tela\.nome/.test(envio) && /r\.json\.mensagem/.test(envio), 'mostra a mensagem do servidor com o nome da empresa');
  // recado do estilo novo: até 500 caracteres, com contador
  assert.ok(/const LIMITE_RECADO = 500;/.test(h) && /el\('textarea', \{[^}]*maxlength: String\(LIMITE_RECADO\)/.test(h) && /' de ' \+ LIMITE_RECADO/.test(h), 'recado com limite e contador');
  assert.ok(/'estilo-novo': \{\n      botao: [^\n]*recado: true/.test(h) && [...h.matchAll(/recado: true/g)].length === 1, 'só o estilo novo pede o recado');
  // confirmação na própria página: nada de alert/confirm/prompt
  assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(codigo), 'nenhuma janela do navegador');
  // Esc fecha (a confirmação aberta primeiro); trocar de empresa fecha o detalhe; o endereço abre o detalhe
  assert.ok(/if \(ev\.key !== 'Escape' \|\| detalhe\.hidden\) return;/.test(h) && /fecharDetalhe\(\);\n  \}\);/.test(h), 'Esc fecha o detalhe');
  const carregar = trechoDaTela(h, 'async function carregarEmpresa(primeira) {');
  assert.ok(/fecharVista\(false\);\n    if \(!primeira\) tirarDoEndereco\(\);/.test(carregar), 'trocar de empresa fecha o detalhe e tira o estilo do endereço');
  assert.ok(/const pedido = primeira === true \? idDoEndereco\(\) : null;/.test(carregar) && /if \(e\) mostrarDetalhe\(e\); else tirarDoEndereco\(\);/.test(carregar), '#estilo=<id> ao abrir a página');
  assert.ok(/aoTrocar: \(\) => carregarEmpresa\(false\)/.test(h));
  assert.ok(/window\.addEventListener\('hashchange'/.test(h), 'voltar e avançar do navegador abrem e fecham o detalhe');
  // voltar para a grade: a grade só fica escondida (filtros intactos), a rolagem e o foco voltam
  const fechar = trechoDaTela(h, 'function fecharVista(devolver) {');
  assert.ok(/conteudo\.hidden = false;/.test(fechar) && /window\.scrollTo\(0, aberto\.rolagem\)/.test(fechar) && /\.cartao-abrir'\)/.test(fechar) && !/desenhar\(|filtrosVazios/.test(fechar), 'volta à grade como estava');
  const mostrar = trechoDaTela(h, 'function mostrarDetalhe(estilo) {');
  assert.ok(/conteudo\.hidden = true;/.test(mostrar) && /titulo\.focus\(/.test(mostrar) && /pararTudo\(\);/.test(mostrar), 'abrir o detalhe para a grade e leva o foco para ele');
  // carrossel: arraste, setas e contador
  const sl = trechoDaTela(h, 'function slider(estilo, laminas) {');
  for (const x of ["'pointerdown'", "'pointermove'", "'pointerup'", "'pointercancel'", 'ArrowRight', 'ArrowLeft', "' de ' + total", "tabindex: '0'"]) assert.ok(sl.includes(x), 'slider sem ' + x);
  // o vídeo do detalhe nasce parado, sem autoplay, com os controles do navegador só depois do play
  assert.ok(/el\('video', \{ classe: 'detalhe-video'[^}]*preload: 'none'/.test(h) && /video\.controls = true;/.test(h));
  // R5: chips sem número; o contador da grade é o único "status" fixo; nada de aria-live na página
  assert.ok(!/chip-n/.test(h), 'filtros sem o número ao lado');
  assert.ok(!/aria-live/.test(h), 'nenhum aria-live (o contador já é role="status")');
  assert.ok(/<main id="conteudo">/.test(h));
});

t('estilos, detalhe: a nota da marca muda quando a marca já está definida, e os títulos falam do estilo', () => {
  const h = ler(ESTILOS);
  assert.ok(!h.includes("'Regras do kit'"), 'títulos antigos');
  // "Cores e letras" (as do estilo e as da marca, decisão D6 B) só no detalhe na marca; sem ela, "Cores e letras do estilo"
  assert.strictEqual([...h.matchAll(/'Cores e letras'/g)].length, 1);
  assert.ok(/naMarca \? 'Cores e letras' : 'Cores e letras do estilo'/.test(h), 'o título segue a vista');
  const linha = (inicio) => { const i = h.indexOf(inicio); assert.ok(i >= 0, 'falta ' + inicio); return h.slice(i, h.indexOf('\n', i)); };
  const codigo = linha('const NOTA_NA_MARCA = ') + '\n' + linha('const NOTA_MARCA = ') + '\n' + trechoDaTela(h, 'function notaDaMarca() {');
  // eslint-disable-next-line no-new-func
  const notaDaMarca = (tela) => new Function('tela', codigo + '\nreturn notaDaMarca();')(tela);
  assert.strictEqual(notaDaMarca({ marca: { definida: false } }), 'Suas prévias na marca chegam depois de você definir a marca.');
  assert.strictEqual(notaDaMarca({ marca: null }), 'Suas prévias na marca chegam depois de você definir a marca.');
  assert.strictEqual(notaDaMarca({ marca: { definida: true } }), 'Suas prévias na marca ainda não foram geradas.');
  assert.ok(/texto: notaDaMarca\(\)/.test(h) && !/texto: NOTA_MARCA/.test(h), 'o detalhe usa a nota que depende da marca');
});

t('estilos, detalhe: os tratamentos aparecem com acento e sem hífen (todos os valores dos 27 estilos)', () => {
  const h = ler(ESTILOS);
  const i = h.indexOf('const PALAVRA_TRATAMENTO = ');
  assert.ok(i >= 0, 'falta o mapa');
  const legivel = "const legivel = (v) => String(v).replace(/\\+/g, ' + ').replace(/-/g, ' ');";
  const codigo = h.slice(i, h.indexOf('\n', i)) + '\n' + legivel + '\n' + trechoDaTela(h, 'function rotuloTratamento(valor) {') + '\nreturn { rotuloTratamento, PALAVRA_TRATAMENTO };';
  // eslint-disable-next-line no-new-func
  const { rotuloTratamento, PALAVRA_TRATAMENTO } = new Function(codigo)();
  assert.strictEqual(rotuloTratamento('italico'), 'itálico');
  assert.strictEqual(rotuloTratamento('italico+cor+peso'), 'itálico + cor + peso');
  assert.strictEqual(rotuloTratamento('cartao-arredondado'), 'cartão arredondado');
  assert.strictEqual(rotuloTratamento('laco-a-mao'), 'laço à mão');
  assert.strictEqual(rotuloTratamento('grao-de-filme'), 'grão de filme');
  assert.strictEqual(rotuloTratamento('valor-novo+outro'), 'valor novo + outro', 'valor desconhecido passa como está, sem hífen');
  // todo valor que aparece nos estilos de verdade: nenhum sai com a grafia sem acento do código
  const { lerYaml } = require(path.join(RAIZ, '08-FERRAMENTAS', 'marca', 'yaml.js'));
  const pasta = path.join(RAIZ, '04-LABORATORIO-DE-DESIGN', 'estilos');
  const valores = new Set();
  let estilos = 0;
  for (const d of fs.readdirSync(pasta, { withFileTypes: true })) {
    const arq = path.join(pasta, d.name, 'estilo.yaml');
    if (!d.isDirectory() || !fs.existsSync(arq)) continue;
    estilos += 1;
    for (const v of Object.values(lerYaml(fs.readFileSync(arq, 'utf8')).tratamentos || {})) String(v).split('+').forEach((p) => valores.add(p));
  }
  assert.strictEqual(estilos, 27);
  const SEM_ACENTO = /\b(italico|cartao|circulo|laco|camera|numero|cromatica|grao|aneis|escritorio|organica)\b/;
  for (const v of valores) {
    const r = rotuloTratamento(v);
    assert.ok(!/-/.test(r) && !SEM_ACENTO.test(r), `${v} saiu como "${r}"`);
  }
  for (const k of Object.keys(PALAVRA_TRATAMENTO)) assert.ok(valores.has(k), `o mapa tem ${k}, que nenhum estilo usa`);
});

t('estilos: estilo sem nenhuma prévia mostra o nome e "Prévia em preparo", no cartão e no detalhe', () => {
  const h = ler(ESTILOS);
  // o desenhista de verdade, com um el() de mentira que só guarda a árvore
  const no = (tag, props, filhos) => ({ tag, props: props || {}, filhos: (filhos || []).filter(Boolean) });
  const texto = (n) => [n.props.texto || ''].concat(n.filhos.map(texto)).filter(Boolean).join('|');
  // eslint-disable-next-line no-new-func
  const quadroSemPrevia = new Function('el', trechoDaTela(h, 'function quadroSemPrevia(nome) {') + '\nreturn quadroSemPrevia;')(no);
  const q = quadroSemPrevia('Estilo Fantasma');
  assert.strictEqual(q.props.classe, 'quadro-sem-previa');
  assert.strictEqual(texto(q), 'Estilo Fantasma|Prévia em preparo');
  // o cartão usa o quadro no lugar da imagem, e o detalhe no lugar do quadro de abas
  const cartao = trechoDaTela(h, 'function cartao(e) {');
  assert.ok(/\[capa \|\| quadroSemPrevia\(e\.nome\), el\('span', \{ classe: 'selo'/.test(cartao), 'cartão sem capa mostra o nome');
  const previas = trechoDaTela(h, 'function desenharPrevias(estilo, previas) {');
  assert.ok(/if \(!abas\.length\) \{\n\s+caixa\.appendChild\(quadroSemPrevia\(estilo\.nome\)\);/.test(previas), 'detalhe sem prévia mostra o nome');
  assert.ok(/\.quadro-sem-previa \{[^}]*background: var\(--mesa\)/.test(h), 'o quadro não é escuro');
});

t('estilos: voltar no navegador depois de trocar de empresa leva o seletor para a empresa do endereço', () => {
  const h = ler(ESTILOS);
  assert.ok(/window\.addEventListener\('popstate', acompanharEmpresaDoEndereco\);/.test(h), 'ouve o voltar/avançar');
  const fonte = trechoDaTela(h, 'function acompanharEmpresaDoEndereco() {') + '\nreturn acompanharEmpresaDoEndereco;';
  const rodar = (busca, atual, existentes) => {
    const escolhidas = [];
    const seletor = {
      situacao: () => ({ empresas: existentes.map((c) => ({ codigo: c })) }),
      escolher: (c) => { if (c === atual) return false; atual = c; escolhidas.push(c); return true; },
    };
    // eslint-disable-next-line no-new-func
    new Function('seletor', 'location', fonte)(seletor, { search: busca })();
    return escolhidas;
  };
  assert.deepStrictEqual(rodar('?empresa=aurora', 'boreal', ['aurora', 'boreal']), ['aurora'], 'o endereço voltou para a aurora');
  assert.deepStrictEqual(rodar('?empresa=boreal', 'boreal', ['aurora', 'boreal']), [], 'a mesma empresa: nada muda');
  assert.deepStrictEqual(rodar('', 'boreal', ['aurora', 'boreal']), [], 'endereço sem empresa');
  assert.deepStrictEqual(rodar('?empresa=inventada', 'boreal', ['aurora', 'boreal']), [], 'empresa que não existe');
  assert.deepStrictEqual(rodar('?empresa=../x', 'boreal', ['aurora', 'boreal']), []);
});

t('estilos, pedido: fechar a área (Esc ou Cancelar) guarda o recado, só o envio certo apaga, e o erro devolve o foco ao botão', () => {
  const h = ler(ESTILOS);
  const fechar = trechoDaTela(h, 'function fecharPedido() {');
  assert.ok(!/textContent = ''/.test(fechar) && /area\.hidden = true;/.test(fechar), 'fechar só esconde a área');
  const abrir = trechoDaTela(h, 'function abrirPedido(estilo, tipo, area, aviso, botoes) {');
  assert.ok(/recado\.value = aberto\.recado;/.test(abrir) && /aberto\.recado = recado\.value;/.test(abrir), 'o recado volta ao abrir de novo e é guardado a cada letra');
  const envio = trechoDaTela(h, 'async function enviarPedido(');
  assert.ok(/if \(tipo === 'estilo-novo'\) aberto\.recado = '';[^\n]*\n\s+area\.hidden = true;/.test(envio), 'o recado só some depois do envio certo do estilo novo');
  // usar-estilo e personalizar não mexem no rascunho do estilo novo: o único lugar que zera o recado no envio é o do estilo novo
  assert.strictEqual([...envio.matchAll(/aberto\.recado = ''/g)].length, 1, 'um só lugar zera o recado no envio');
  assert.ok(!/(^|\n)\s*aberto\.recado = '';/.test(envio), 'nenhum zeramento incondicional no envio');
  const falha = envio.slice(envio.indexOf('if (!r.ok) {'), envio.indexOf("if (tipo === 'estilo-novo')"));
  assert.ok(/\$\('pedido-confirmar'\)/.test(falha) && /confirmar\.focus\(\)/.test(falha), 'depois da falha o foco volta para o botão de confirmar');
  assert.ok(trechoDaTela(h, 'function mostrarDetalhe(estilo) {').includes("aberto.recado = '';") && trechoDaTela(h, 'function fecharVista(devolver) {').includes("aberto.recado = '';"), 'sair do detalhe zera o recado');
  assert.ok(/o recado digitado fica guardado/.test(h), 'o comentário do Esc diz o que acontece');
});

t('links entre as três telas levam a empresa escolhida', () => {
  for (const tela of ['laboratorio.html', 'cronograma.html']) {
    const h = ler(path.join(PAINEIS, tela));
    assert.ok(/<a id="link-estilos" href="estilos\.html" hidden>Abrir os Estilos<\/a>/.test(h), `${tela}: link para os Estilos`);
    assert.ok(/'estilos\.html\?empresa=' \+ encodeURIComponent\(codigo\)/.test(h), `${tela}: o link dos Estilos leva a empresa`);
  }
  const h = ler(ESTILOS);
  assert.ok(/'laboratorio\.html\?empresa=' \+ encodeURIComponent\(codigo\)/.test(h), 'Estilos -> Laboratório com a empresa');
  assert.ok(/'cronograma\.html\?empresa=' \+ encodeURIComponent\(codigo\)/.test(h), 'Estilos -> Cronograma com a empresa');
});

t('nenhum arquivo de dados lido por caminho e nada de fora do computador', () => {
  for (const arq of TELAS.map((x) => path.join(PAINEIS, x)).concat(SELETOR)) {
    const texto = ler(arq);
    const nome = path.basename(arq);
    assert.ok(!/['"`][^'"`\n]*\.json(\?[^'"`\n]*)?['"`]/.test(texto), `${nome} cita um arquivo .json`);
    assert.ok(!/https?:\/\//.test(texto), `${nome} aponta para fora do computador`);
    assert.ok(!/<link[^>]+stylesheet/i.test(texto), `${nome} carrega folha de estilo de fora`);
    const scripts = [...texto.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    // os scripts são os da própria pasta: o seletor comum e, no Laboratório e no Cronograma, o cartão do estilo (Tarefa 12);
    // no Cronograma, também o roteiro em campos (R-13), que só monta textos
    const permitidos = ['empresa-seletor.js'].concat(['laboratorio.html', 'cronograma.html'].includes(nome) ? ['cartao-estilo.js'] : [])
      .concat(nome === 'cronograma.html' ? ['roteiro-video.js'] : []);
    assert.ok(scripts.every((s) => permitidos.includes(s)), `${nome} carrega script de fora: ${scripts}`);
  }
});

t('o seletor tem um único fetch, e ele só recebe a lista de empresas ou um endereço montado com a empresa', () => {
  const s = ler(SELETOR);
  const fetches = [...s.matchAll(/\bfetch\s*\(/g)];
  assert.strictEqual(fetches.length, 1, 'um só ponto de saída');
  const buscas = [...s.matchAll(/\bbuscar\(\s*([^,)]+)/g)].map((m) => m[1].trim());
  // ROTA_COMECAR (etapa 8): o único envio sem empresa, o que cria a primeira empresa ou um cliente novo (tarefa 9)
  assert.deepStrictEqual(buscas.sort(), ['ROTA_COMECAR', 'ROTA_EMPRESAS', 'pedido.url']);
  assert.ok(/const ROTA_EMPRESAS = '\/api\/empresas';/.test(s));
  const urls = [...s.matchAll(/\burl:\s*(urlDaApi\([^)]*\)|[^,}\n]+)/g)].map((m) => m[1].trim());
  assert.deepStrictEqual(urls, ['urlDaApi(rota, codigo)', 'urlDaApi(rota, codigo)']);
  assert.ok(/Object\.assign\(\{\}, corpo \|\| \{\}, \{ empresa: codigo \}\)/.test(s), 'a empresa vai por último no corpo do envio');
});

// ---------- 2b. estilos: o caminho (sem marca, escolher o estilo, o andamento dos pedidos) — etapa 8, Tarefa 11 ----------

// Um el() de mentira que só guarda a árvore (com style.setProperty, como no navegador), e o texto da árvore inteira.
const noFalso = (tag, props, filhos) => {
  const estilo = {};
  return { tag, props: props || {}, filhos: (filhos || []).filter(Boolean).map((f) => (typeof f === 'string' ? { tag: '#texto', props: { texto: f }, filhos: [] } : f)),
    style: { setProperty: (k, v) => { estilo[k] = v; } }, estilo, classList: { add() {}, remove() {}, contains: () => false }, appendChild(f) { this.filhos.push(f); return f; } };
};
const textoDaArvore = (n) => [n.props.texto || ''].concat(n.filhos.map(textoDaArvore)).filter(Boolean).join('|');
const todosOsNos = (n) => [n].concat(n.filhos.flatMap(todosOsNos));

t('estilos, caminho: grava só pelo seletor (escolha, desfazer, imagens, pedido) e lê os pedidos e as letras', () => {
  const h = ler(ESTILOS);
  const enviados = [...h.matchAll(/seletor\.enviar\(\s*([^,)]*)/g)].map((m) => m[1].trim()).sort();
  assert.deepStrictEqual(enviados, ["'/api/arquivo'", "'/api/estilo'", "'/api/estilo/desfazer'", "'/api/pedido'", "'/api/previas-marca'"], 'cada gravação num lugar só');
  const lidas = [...h.matchAll(/seletor\.ler\(\s*'([^']+)'/g)].map((m) => m[1]);
  assert.ok(lidas.includes('/api/pedidos') && lidas.includes('/api/letras'), 'o andamento dos pedidos e as letras vêm do servidor');
  assert.ok(!/\/api\/marca/.test(h), 'a tela nunca grava a marca direto: a marca que nasce do estilo vem da rota do estilo');
  // "Usar este estilo" (decisão D1): o corpo diz o estilo, de onde ele vem e se a marca nasce dele (só sem marca, só do catálogo)
  // eslint-disable-next-line no-new-func
  const corpoDaEscolha = (tela) => new Function('tela', trechoDaTela(h, 'function corpoDaEscolha(estilo) {') + '\nreturn corpoDaEscolha;')(tela);
  assert.deepStrictEqual(corpoDaEscolha({ marca: { definida: false } })({ id: 'bloco', proprio: false }), { estilo: 'bloco', origem: 'catalogo', comMarca: true });
  assert.deepStrictEqual(corpoDaEscolha({ marca: { definida: true } })({ id: 'bloco', proprio: false }), { estilo: 'bloco', origem: 'catalogo', comMarca: false });
  assert.deepStrictEqual(corpoDaEscolha({ marca: { definida: false } })({ id: 'aurora-horta', proprio: true }), { estilo: 'aurora-horta', origem: 'proprio', comMarca: false }, 'a marca de um estilo próprio é feita no Claude');
  const escolher = trechoDaTela(h, 'async function escolherEstilo(');
  assert.ok(/seletor\.enviar\('\/api\/estilo', corpoDaEscolha\(estilo\)\)/.test(escolher) && !/empresa/.test(escolher.replace(/tela\.nome|' agora é o da '/g, '')), 'pelo seletor, que põe a empresa por último');
  assert.ok(/if \(r === null \|\| vez !== aberto\.vez\) return;/.test(escolher), 'resposta de outra empresa ou de um detalhe fechado: descartada');
  const desfazer = trechoDaTela(h, 'async function desfazerEscolha(');
  assert.ok(/seletor\.enviar\('\/api\/estilo\/desfazer', \{\}\)/.test(desfazer), 'Desfazer pela rota de desfazer');
  for (const frase of ['A sua marca vai nascer deste estilo', 'As cores e letras deste estilo viram as da sua marca. Dá para trocar depois.',
    "' agora é o da '", 'No Claude, digite /fabrica continuar para fazer a primeira peça.', "'Desfazer'"]) assert.ok(h.includes(frase), 'falta ' + frase);
  // a mensagem "Pronto" fica embaixo, no lugar da confirmação (decisão 10 A), com o Desfazer
  assert.ok(/aviso\.className = 'pedido-aviso ok';/.test(escolher) && /'Desfazer'/.test(escolher), 'Pronto e Desfazer no aviso do detalhe');
});

t('estilos, caminho: "Personalizar" e "Usar esta cor" levam a Sua marca, com papel só da lista e cor conferida, sem gravar nada', () => {
  const h = ler(ESTILOS);
  const seletor = { atual: () => 'aurora' };
  // eslint-disable-next-line no-new-func
  const ender = new Function('seletor', [linhaDaTela(h, 'const NOME_COR = '), trechoDaTela(h, 'function enderecoPersonalizar(id, papel, cor, proprio) {')].join('\n') + '\nreturn enderecoPersonalizar;')(seletor);
  assert.strictEqual(ender('editorial'), 'marca.html?personalizar=editorial&empresa=aurora');
  assert.strictEqual(ender('editorial', 'neutro', '#e3d1c8'), 'marca.html?personalizar=editorial&papel=neutro&cor=E3D1C8&empresa=aurora');
  assert.strictEqual(ender('editorial', 'escuro', '0E2A3B'), 'marca.html?personalizar=editorial&papel=escuro&cor=0E2A3B&empresa=aurora');
  assert.strictEqual(ender('a&b=c'), 'marca.html?personalizar=a%26b%3Dc&empresa=aurora', 'o código do estilo vai codificado');
  // o estilo próprio diz de onde vem (um próprio pode ter o mesmo código de um do catálogo)
  assert.strictEqual(ender('bloco', undefined, undefined, true), 'marca.html?personalizar=bloco&origem=proprio&empresa=aurora');
  assert.strictEqual(ender('bloco', 'neutro', '#e3d1c8', true), 'marca.html?personalizar=bloco&papel=neutro&cor=E3D1C8&origem=proprio&empresa=aurora');
  assert.strictEqual(ender('bloco', undefined, undefined, false), 'marca.html?personalizar=bloco&empresa=aurora', 'do catálogo, como sempre');
  for (const papel of ['fundo', '__proto__', 'toString', 'neutro&x=1', 'Neutro', '', null, 5]) assert.strictEqual(ender('editorial', papel, '#e3d1c8'), null, 'papel ' + String(papel));
  for (const cor of ['#12345', 'red', '#1234567', 'e3d1c8&x=1', 'url(x)', '#e3d1cg', ' #e3d1c8', null, undefined]) assert.strictEqual(ender('editorial', 'neutro', cor), null, 'cor ' + String(cor));
  for (const id of ['', null, 5]) assert.strictEqual(ender(id), null);
  seletor.atual = () => null;
  assert.strictEqual(ender('editorial'), null, 'sem empresa no seletor, nenhum endereço');
  // "Usar esta cor" é um link para esse endereço: nunca envia nada nem abre pedido
  const usar = trechoDaTela(h, 'function usarCor(estilo, g, s) {');
  assert.ok(/enderecoPersonalizar\(estilo\.id, g\.papel, s\.cor, estilo\.proprio\)/.test(usar), 'o endereço sai do papel do grupo e da cor sugerida');
  assert.ok(!/seletor\.enviar|abrirPedido|\/api\//.test(usar), 'não grava nada');
  const sug = trechoDaTela(h, 'function sugestao(estilo, g, s) {');
  assert.ok(/el\('a', \{[^}]*texto: 'Usar esta cor'/.test(sug) && /href: usarCor\(estilo, g, s\)/.test(sug), '"Usar esta cor" é um link');
  assert.ok(/if \(!destino\)|usarCor\(estilo, g, s\) \?/.test(sug), 'sem endereço conferido, sem link');
  // "Personalizar" também é um link para Sua marca (o pedido "personalizar" com os detalhes nasce lá)
  const pedidos = trechoDaTela(h, 'function desenharPedidos(estilo) {');
  assert.ok(/el\('a', \{[^}]*href: enderecoPersonalizar\(estilo\.id, undefined, undefined, estilo\.proprio\)/.test(pedidos), '"Personalizar" leva a Sua marca, dizendo se o estilo é próprio');
});

t('estilos, caminho: sem marca, o aviso oferece "Criar do zero" e "Enviar referências" (links para Sua marca)', () => {
  const h = ler(ESTILOS);
  // eslint-disable-next-line no-new-func
  const caminho = new Function('seletor', trechoDaTela(h, 'function caminhoSemMarca(secao) {') + '\nreturn caminhoSemMarca;')({ atual: () => 'boreal' });
  assert.strictEqual(caminho('criar-do-zero'), 'marca.html?empresa=boreal#criar-do-zero');
  assert.strictEqual(caminho('enviar-referencias'), 'marca.html?empresa=boreal#enviar-referencias');
  const base = trechoDaTela(h, 'function desenharBase() {');
  assert.ok(/'Prefere outro caminho\? '/.test(base) && /texto: 'Criar do zero', href: caminhoSemMarca\('criar-do-zero'\)/.test(base) && /texto: 'Enviar referências', href: caminhoSemMarca\('enviar-referencias'\)/.test(base), 'os dois caminhos no aviso');
  assert.ok(/tela\.marca\.definida \? null : el\('p', \{ classe: 'base-sem-marca', id: 'sem-marca'/.test(base), 'só sem marca');
});

t('estilos, caminho: o quadro da marca que nasce do estilo mostra as quatro cores com o papel e as letras de verdade', () => {
  const h = ler(ESTILOS);
  const codigo = ['const corValida = ', 'const objeto = ', 'const texto = ', 'const PASTA_DAS_LETRAS = ', 'const trechoOk = ', 'const enderecoDeLetra = ', 'const PAPEL_NO_QUADRO = ', 'const LETRA_NO_QUADRO = ',
    'function sobreCor(fundo, a, b) {', 'function quadroDaMarca(estilo) {']
    .map((x) => (x === 'const trechoOk = ' ? h.slice(h.indexOf(x), h.indexOf('\n  };\n', h.indexOf(x)) + 5) : pedacoDaTela(h, x))).join('\n');
  const carregadas = [];
  const tela = { letras: new Map([['Letra Titulo', '/08-FERRAMENTAS/tesseract/modelos/fontes/LetraTitulo.ttf'], ['Letra Apoio', '/08-FERRAMENTAS/tesseract/modelos/fontes/../x.ttf']]) };
  // eslint-disable-next-line no-new-func
  const quadroDaMarca = new Function('el', 'tela', 'carregarLetra', codigo + '\nreturn quadroDaMarca;')(noFalso, tela, (familia, url) => { carregadas.push([familia, url]); return true; });
  const estilo = { id: 'bloco', nome: 'Bloco', original: { cores: { escuro: '#102030', claro: '#F0E8DC', acento: 'red', neutro: '#8899AA' }, fontes: { principal: 'Letra Titulo', mono: 'Letra Apoio', acento: null } } };
  const q = quadroDaMarca(estilo);
  const tudo = textoDaArvore(q);
  for (const r of ['Fundo escuro', 'Fundo claro', 'Destaque', 'Apoio', 'Letra principal · Letra Titulo', 'Letra dos rótulos · Letra Apoio']) assert.ok(tudo.includes(r), 'falta ' + r + ' em ' + tudo);
  assert.ok(!/Títulos/.test(tudo), 'o nome antigo da letra principal');
  // a mesma decisão de Sua marca: título, texto e botão na principal; só a etiqueta pequena na dos rótulos (mono)
  assert.strictEqual(q.estilo['--q-letra-principal'], '"Quadro bloco principal", ui-serif, serif');
  assert.strictEqual(q.estilo['--q-letra-rotulo'], 'system-ui, sans-serif');
  const css = h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
  const fonteDe = (classe) => { const m = new RegExp('\\.' + classe + ' \\{[^}]*font: [^;]*var\\((--q-[a-z-]+)').exec(css); return m && m[1]; };
  for (const c of ['quadro-peca-titulo', 'quadro-peca-texto', 'quadro-peca-botao']) assert.strictEqual(fonteDe(c), '--q-letra-principal', c);
  assert.strictEqual(fonteDe('quadro-peca-sobre'), '--q-letra-rotulo');
  assert.ok(!/--q-letra-titulo|--q-letra-apoio/.test(h), 'nada das variáveis antigas');
  // os detalhes técnicos usam os mesmos nomes
  assert.ok(/const PAPEL_LETRA = \{ principal: 'Letra principal', mono: 'Letra dos rótulos', acento: 'Destaque' \};/.test(h));
  assert.ok(/const LETRA_NO_QUADRO = \{ principal: 'Letra principal', mono: 'Letra dos rótulos', acento: 'Destaque' \};/.test(h));
  const amostras = todosOsNos(q).filter((n) => /amostra-cor/.test(n.props.classe || ''));
  assert.strictEqual(amostras.length, 4, 'quatro cores');
  assert.deepStrictEqual(amostras.map((n) => n.estilo['--amostra'] || null), ['#102030', '#F0E8DC', null, '#8899AA'], 'cor que não é código fica vazia');
  assert.deepStrictEqual(carregadas, [['Quadro bloco principal', '/08-FERRAMENTAS/tesseract/modelos/fontes/LetraTitulo.ttf']], 'só a letra com endereço conferido é carregada');
  assert.ok(!/innerHTML/.test(trechoDaTela(h, 'function quadroDaMarca(estilo) {')));
});

t('estilos, caminho: o andamento dos pedidos no alto (decisão 6 A), com o resumo do agente como texto', () => {
  const h = ler(ESTILOS);
  const codigo = ['const objeto = ', 'const lista = ', 'const limpo = ', 'const ESTADO_DO_PEDIDO = ', 'function conferirPedidos(j) {', 'function resumoDosPedidos(itens) {', 'function itemDoPedido(p) {'].map((x) => pedacoDaTela(h, x)).join('\n');
  // eslint-disable-next-line no-new-func
  const f = new Function('el', codigo + '\nreturn { conferirPedidos, resumoDosPedidos, itemDoPedido };')(noFalso);
  const hostil = '<img src=x onerror=alert(1)> Fiz o primeiro carrossel';
  const c = f.conferirPedidos({ pedidos: [
    { tipo: 'Usar este estilo', dataLocal: '03/11/2026', estado: 'atendido', resumo: hostil },
    { tipo: 'Estilo a partir de referências', dataLocal: '04/11/2026', estado: 'em-andamento', resumo: null },
    { tipo: 'Criar a marca do zero', dataLocal: '05/11/2026', estado: 'pendente', resumo: null },
    { tipo: 'Inventado', dataLocal: '05/11/2026', estado: 'outro' }, 5, null,
  ], ilegiveis: 1 });
  assert.deepStrictEqual(c.itens.map((p) => p.tipo), ['Criar a marca do zero', 'Estilo a partir de referências', 'Usar este estilo'], 'o mais novo primeiro; estado estranho fica de fora');
  assert.strictEqual(c.ilegiveis, 1);
  assert.strictEqual(f.resumoDosPedidos(c.itens), '1 pronto · 1 sendo feito · 1 esperando');
  const pronto = f.itemDoPedido(c.itens[2]);
  assert.ok(todosOsNos(pronto).some((n) => n.props.texto === hostil), 'o resumo do agente entra inteiro como texto (textContent)');
  assert.ok(/Pronto/.test(textoDaArvore(pronto)) && /Pedido em 03\/11\/2026/.test(textoDaArvore(pronto)));
  assert.ok(/Esperando/.test(textoDaArvore(f.itemDoPedido(c.itens[0]))) && /No Claude, digite \/fabrica continuar/.test(textoDaArvore(f.itemDoPedido(c.itens[0]))));
  assert.ok(/Sendo feito/.test(textoDaArvore(f.itemDoPedido(c.itens[1]))));
  assert.strictEqual(f.resumoDosPedidos(f.conferirPedidos({ pedidos: [{ tipo: 'a', dataLocal: 'x', estado: 'atendido' }, { tipo: 'b', dataLocal: 'x', estado: 'atendido' }] }).itens), '2 prontos');
  assert.deepStrictEqual(f.conferirPedidos(null).itens, []);
  // o pedido com estilo diz qual (inclusive depois de "Desfazer"): "Usar este estilo: Bloco", por texto
  const comEstilo = f.conferirPedidos({ pedidos: [{ tipo: 'Usar este estilo', dataLocal: '03/11/2026', estado: 'atendido', resumo: null, estilo: 'Bloco' }, { tipo: 'Criar a marca do zero', dataLocal: '03/11/2026', estado: 'pendente', resumo: null, estilo: null }, { tipo: 'Usar este estilo', dataLocal: '03/11/2026', estado: 'pendente', estilo: 5 }] }).itens;
  assert.deepStrictEqual(comEstilo.map((p) => p.estilo), [null, null, 'Bloco'], 'nome só quando é texto');
  assert.ok(todosOsNos(f.itemDoPedido(comEstilo[2])).some((n) => n.props.texto === 'Usar este estilo: Bloco'), textoDaArvore(f.itemDoPedido(comEstilo[2])));
  assert.ok(todosOsNos(f.itemDoPedido(comEstilo[1])).some((n) => n.props.texto === 'Criar a marca do zero'), 'sem estilo, só o tipo');
  // o resumo vai por textContent (o el() da tela põe `texto` em textContent), nunca montado como HTML
  assert.ok(/texto: p\.resumo/.test(trechoDaTela(h, 'function itemDoPedido(p) {')));
  assert.ok(/e\.textContent = v;/.test(trechoDaTela(h, 'function el(tag, props, filhos) {')));
  // a faixa fica no alto da grade; é relida ao abrir, depois de cada pedido ou escolha e quando a página volta à vista
  assert.ok(/trocar\(faixa(?:Dos)?Pedidos\(\), desenharBase\(\)/.test(trechoDaTela(h, 'function desenhar() {')), 'a faixa vem antes do aviso de modelo base');
  assert.ok(h.includes("'Seus pedidos ao Claude'") && h.includes("'Esconder'"));
  assert.ok(/visibilitychange[^\n]*lerPedidos\(\)/.test(h), 'de volta à página, relê o andamento');
  const lerP = trechoDaTela(h, 'async function lerPedidos() {');
  assert.ok(/seletor\.ler\('\/api\/pedidos'\)/.test(lerP) && /codigo !== seletor\.atual\(\)/.test(lerP), 'resposta de outra empresa descartada');
});

t('estilos, caminho: selo "Seu estilo", "Seus estilos" antes do catálogo e prévias do estilo próprio só da empresa escolhida', () => {
  const h = ler(ESTILOS);
  // eslint-disable-next-line no-new-func
  const ehSeu = (tela) => new Function('tela', linhaDaTela(h, 'const ehSeuEstilo = ') + '\nreturn ehSeuEstilo;')(tela);
  assert.strictEqual(ehSeu({ atual: { estilo: 'bloco', origem: 'catalogo' } })({ id: 'bloco', proprio: false }), true);
  assert.strictEqual(ehSeu({ atual: { estilo: 'bloco', origem: 'catalogo' } })({ id: 'bloco', proprio: true }), false, 'o próprio com o mesmo código não é o escolhido');
  assert.strictEqual(ehSeu({ atual: { estilo: 'bloco', origem: 'proprio' } })({ id: 'bloco', proprio: true }), true);
  assert.strictEqual(ehSeu({ atual: null })({ id: 'bloco', proprio: false }), false);
  assert.ok(h.includes("'Seu estilo'") && h.includes("'Seus estilos'"));
  const cart = trechoDaTela(h, 'function cartao(e) {');
  assert.ok(/ehSeuEstilo\(e\)/.test(cart), 'o selo no cartão');
  assert.ok(/ehSeuEstilo\(estilo\)/.test(trechoDaTela(h, 'function desenharInfo(estilo, titulo, previas) {')), 'o selo no detalhe');
  // as prévias do estilo próprio: só /empresas/<empresa escolhida>/previas/proprios/<estilo>/<arquivo>
  const linhas = ['const PREVIAS_PROPRIAS = ', 'const trechoOk = ', 'const enderecoProprio = '].map((ini) => (ini === 'const trechoOk = ' ? h.slice(h.indexOf(ini), h.indexOf('\n  };\n', h.indexOf(ini)) + 5) : linhaDaTela(h, ini)));
  const seletor = { atual: () => 'aurora' };
  // eslint-disable-next-line no-new-func
  const enderecoProprio = new Function('seletor', linhas.join('\n') + '\nreturn enderecoProprio;')(seletor);
  const P = '/empresas/aurora/previas/proprios/';
  assert.strictEqual(enderecoProprio(P + 'aurora-horta/carrossel-01.webp'), P + 'aurora-horta/carrossel-01.webp');
  for (const ruim of ['/empresas/boreal/previas/proprios/x/c.webp', P + 'x/../../c.webp', P + '%2e%2e/c.webp', P + 'x/y/c.webp', P + 'c.webp', P + 'x/c.webp?y', P + 'x\\c.webp',
    '/empresas/aurora/previas/bloco/c.webp', '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/bloco/c.webp', null, 5]) assert.strictEqual(enderecoProprio(ruim), null, String(ruim));
  seletor.atual = () => 'boreal';
  assert.strictEqual(enderecoProprio(P + 'aurora-horta/carrossel-01.webp'), null, 'com a boreal no seletor, nada da aurora');
  assert.ok(/conferirItem\(e, true\)/.test(h) && /const base = proprio \? enderecoProprio : enderecoBase;/.test(trechoDaTela(h, 'function conferirItem(e, proprio) {')), 'o item próprio passa pela conferência dele');
  // o estilo aberto vai no endereço pela chave (o próprio com o mesmo código de um do catálogo não se confunde)
  assert.ok(/chave: proprio \? 'proprio:' \+ e\.id : e\.id/.test(trechoDaTela(h, 'function conferirItem(e, proprio) {')));
});

t('estilos, caminho: o estilo novo leva imagens opcionais, conferidas antes de enviar, e nenhum vídeo toca sozinho', () => {
  const h = ler(ESTILOS);
  // eslint-disable-next-line no-new-func
  const aceitar = new Function([linhaDaTela(h, 'const limpo = '), linhaDaTela(h, 'const LIMITE_IMAGENS = '), linhaDaTela(h, 'const LIMITE_MB_IMAGEM = '), linhaDaTela(h, 'const TIPOS_DE_IMAGEM = '), trechoDaTela(h, 'function aceitarImagens(novas, ja) {')].join('\n') + '\nreturn aceitarImagens;')();
  const img = (n, tipo = 'image/png', mb = 1) => ({ name: 'foto-' + n + '.png', type: tipo, size: mb * 1024 * 1024 });
  let r = aceitar([img(1), img(2, 'image/jpeg'), img(3, 'image/webp'), img(4, 'image/svg+xml')], 0);
  assert.strictEqual(r.aceitas.length, 4);
  assert.deepStrictEqual(r.recusas, []);
  r = aceitar([img(1, 'application/pdf'), img(2, 'image/png', 11), img(3, 'text/html')], 0);
  assert.strictEqual(r.aceitas.length, 0);
  assert.strictEqual(r.recusas.length, 3, 'tipo e tamanho conferidos');
  r = aceitar(Array.from({ length: 5 }, (_, i) => img(i)), 10);
  assert.strictEqual(r.aceitas.length, 2, 'no máximo 12 imagens');
  assert.ok(r.recusas.some((x) => /12/.test(x)));
  // cada imagem vai pelo envio de arquivo (o servidor dá o nome e confere o conteúdo); o pedido leva os nomes devolvidos
  const env = trechoDaTela(h, 'async function enviarArquivo(dados) {');
  assert.ok(/seletor\.enviar\('\/api\/arquivo', \{ tipo: 'referencia', dados \}\)/.test(env));
  const envio = trechoDaTela(h, 'async function enviarPedido(');
  assert.ok(/if \(anexos\.length\) corpo\.anexos = anexos;/.test(envio), 'o pedido leva os nomes das imagens');
  assert.ok(/enviarArquivo\(/.test(envio) && envio.indexOf('enviarArquivo(') < envio.indexOf("seletor.enviar('/api/pedido'"), 'as imagens vão antes do pedido');
  // miniaturas são imagens; nada de vídeo nem autoplay na página
  assert.ok(!/autoplay/i.test(h) && !/<video/i.test(h));
  assert.ok(/el\('img', \{[^}]*classe: 'miniatura'/.test(h), 'miniaturas das imagens escolhidas');
});

t('estilos, pedido: a imagem que já subiu não sobe de novo quando o pedido é recusado (nada de imagem sobrando na pasta)', async () => {
  const h = ler(ESTILOS);
  const codigo = ['const erroDe = ', 'const texto = ', 'const objeto = ', 'async function enviarPedido('].map((x) => pedacoDaTela(h, x)).join('\n');
  const subidas = [];
  const pedidos = [];
  let respostaDoPedido = { ok: false, status: 400, json: { ok: false, erro: 'Escreva um recado mais curto.' } };
  let empresa = 'aurora';
  const seletor = { atual: () => empresa, enviar: async (rota, corpo) => { pedidos.push({ rota, corpo: JSON.parse(JSON.stringify(corpo)) }); return respostaDoPedido; } };
  const enviarArquivo = async (dados) => { subidas.push(dados); return { ok: true, json: { ok: true, nome: 'referencia-' + subidas.length + '.png' } }; };
  const aberto = { vez: 1, recado: 'x', imagens: [{ arquivo: 'A', nome: 'a.png' }, { arquivo: 'B', nome: 'b.png' }] };
  const caixa = () => ({ className: '', textContent: '', hidden: false, appendChild() {}, focus() {} });
  // eslint-disable-next-line no-new-func
  const enviarPedido = new Function('seletor', 'enviarArquivo', 'lerComoDados', 'aberto', '$', 'detalhe', 'el', 'document', 'tela', 'limparImagens', 'lerPedidos',
    codigo + '\nreturn enviarPedido;')(seletor, enviarArquivo, async (a) => 'dados-' + a, aberto, () => null, { querySelectorAll: () => [] }, noFalso,
    { createTextNode: (t) => t }, { nome: 'Aurora' }, () => { aberto.imagens = []; }, () => {});
  const estilo = { id: 'bloco', nome: 'Bloco' };
  await enviarPedido(estilo, 'estilo-novo', 'um recado', [], caixa(), caixa());
  assert.deepStrictEqual(subidas, ['dados-A', 'dados-B']);
  assert.deepStrictEqual(pedidos[0].corpo.anexos, ['referencia-1.png', 'referencia-2.png']);
  // a recusa barrou o pedido; a pessoa corrige e manda de novo: as imagens que já subiram não sobem outra vez
  respostaDoPedido = { ok: true, status: 200, json: { ok: true, mensagem: 'Pronto. No Claude, digite /fabrica continuar' } };
  await enviarPedido(estilo, 'estilo-novo', 'curto', [], caixa(), caixa());
  assert.deepStrictEqual(subidas, ['dados-A', 'dados-B'], 'nada subiu de novo');
  assert.deepStrictEqual(pedidos[1].corpo.anexos, ['referencia-1.png', 'referencia-2.png'], 'o pedido reaproveita os nomes que o servidor deu');
  // o nome guardado vale só para a empresa em que a imagem subiu
  aberto.imagens = [{ arquivo: 'C', nome: 'c.png', enviada: { dona: 'boreal', nome: 'referencia-9.png' } }];
  await enviarPedido(estilo, 'estilo-novo', '', [], caixa(), caixa());
  assert.deepStrictEqual(subidas.slice(2), ['dados-C'], 'em outra empresa, a imagem sobe para a pasta dela');
});

t('estilos, caminho: o "Usar esta cor" diz o fluxo novo, e a marca mudada com as prévias em pausa avisa que recomeçam no Continuar', () => {
  const h = ler(ESTILOS);
  // (a) nada de prometer que o agente faz a troca: o link abre Personalizar já com a cor e a pessoa guarda ali
  assert.ok(!/o agente faz a troca/.test(h), 'texto antigo do "Usar esta cor"');
  assert.ok(h.includes('“Usar esta cor” abre Personalizar, em Sua marca, já com a cor escolhida; a sua marca só muda quando você guardar ali.'));
  assert.ok(/USAR_COR_NOTA/.test(trechoDaTela(h, 'function desenharLeitura(estilo) {')), 'a frase aparece junto das cores sugeridas');
  // (b) o andamento de verdade, com tudo o que ele usa de mentira
  const frases = ['const MARCA_MUDOU = ', 'const MARCA_MUDOU_PAUSA = '].map((x) => linhaDaTela(h, x)).join('\n');
  const rodar = (marca, progresso) => {
    const caixa = noFalso('div');
    const tela = { marca, progresso, refazendo: false };
    // eslint-disable-next-line no-new-func
    new Function('$', 'tela', 'el', 'nota', 'botaoAcao', 'trilho', 'trabalhando', 'NOTA_MARCA', 'NOTA_NA_MARCA', 'VER_NA_MARCA', 'SEM_DEMONSTRACAO',
      frases + '\n' + trechoDaTela(h, 'function desenharAndamento() {') + '\ndesenharAndamento();')(
      () => caixa, tela, noFalso, (texto, id) => noFalso('p', { texto, id }), (rotulo, acao) => noFalso('button', { texto: rotulo, 'data-acao': acao }),
      () => noFalso('span'), () => ['imagens', 'videos'].includes(progresso.estado), 'a', 'b', 'c', 'd');
    return textoDaArvore(caixa);
  };
  const progresso = (estado, desatualizada) => ({ estado, desatualizada, trabalhador: false, imagens: { estado: 'feito', feitos: 12, total: 12 }, videos: { feitos: 3, total: 12, semFonte: 0, erros: 0 } });
  const pausa = rodar({ definida: true, naMarca: true, desatualizada: true }, progresso('pausado', true));
  assert.ok(/Sua marca mudou\. As prévias estão em pausa: elas recomeçam com a marca nova quando você clicar em Continuar\./.test(pausa), pausa);
  assert.ok(/Continuar/.test(pausa) && /em pausa/.test(pausa));
  assert.ok(!/Sua marca mudou/.test(rodar({ definida: true, naMarca: true, desatualizada: false }, progresso('pausado', false))), 'marca igual: sem a frase');
  assert.ok(!/em pausa: elas recomeçam/.test(rodar({ definida: true, naMarca: true, desatualizada: true }, progresso('videos', true))), 'sem pausa, a frase da pausa não aparece');
});

// ---------- 3. o seletor com um servidor de mentira ----------

// Servidor de mentira: guarda cada pedido; `segurar` deixa a resposta pendurada até `soltar()`.
function servidorFalso(lista, extra = {}) {
  const pedidos = [];
  const pendentes = [];
  let segurar = false;
  const responder = (url, opcoes) => {
    const u = new URL(url, 'http://localhost');
    const empresa = u.searchParams.get('empresa');
    let corpo;
    if (u.pathname === '/api/empresas') corpo = { ativa: lista.ativa, empresas: lista.empresas, empresa: lista.ativa };
    else if (u.pathname === '/api/empresa') corpo = { codigo: empresa, nome: empresa, exemplo: false, cores: extra.cores || { escuro: null, claro: null, acento: null, neutro: null }, fontes: {}, empresa };
    else if (opcoes && opcoes.method === 'POST') corpo = { ok: true, empresa: JSON.parse(opcoes.body).empresa };
    else corpo = { pecas: [{ id: 'peca-de-' + empresa }], empresa: extra.empresaDaResposta || empresa };
    return { ok: true, status: 200, json: async () => corpo };
  };
  const buscar = (url, opcoes) => {
    pedidos.push({ url, opcoes });
    if (!segurar) return Promise.resolve(responder(url, opcoes));
    return new Promise((ok) => pendentes.push(() => ok(responder(url, opcoes))));
  };
  return {
    buscar, pedidos,
    segurar: () => { segurar = true; },
    soltar: () => { segurar = false; pendentes.splice(0).forEach((f) => f()); },
  };
}
function memoria(inicial) {
  const m = new Map(inicial ? [[EmpresaSeletor.CHAVE, inicial]] : []);
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), mapa: m };
}
const TRES = { ativa: 'aurora', empresas: [{ codigo: 'aurora', nome: 'Aurora Nutrição' }, { codigo: 'boreal', nome: 'Boreal Estúdio' }, { codigo: 'cedro', nome: 'Cedro Marcenaria' }] };
const novo = (lista, op = {}) => {
  const falso = servidorFalso(lista, op.extra);
  const s = EmpresaSeletor.criar({ buscar: falso.buscar, armazenamento: op.armazenamento === undefined ? memoria(op.guardada) : op.armazenamento, endereco: op.endereco || 'http://localhost:8890/_fabrica/paineis/laboratorio.html', documento: op.documento || null });
  return { s, falso };
};

t('ordem da escolha: endereço da página, depois o navegador, depois a ativa do agente, depois a primeira', async () => {
  const pag = 'http://localhost:8890/_fabrica/paineis/laboratorio.html';
  assert.strictEqual((await novo(TRES, { endereco: pag + '?empresa=boreal', guardada: 'cedro' }).s.carregar()).atual, 'boreal');
  assert.strictEqual((await novo(TRES, { guardada: 'cedro' }).s.carregar()).atual, 'cedro');
  assert.strictEqual((await novo(TRES, { endereco: pag + '?empresa=../x', guardada: 'nao-existe' }).s.carregar()).atual, 'aurora');
  assert.strictEqual((await novo({ ...TRES, ativa: null }).s.carregar()).atual, 'aurora', 'sem ativa vale a primeira');
  assert.strictEqual((await novo({ ...TRES, ativa: 'cedro' }).s.carregar()).atual, 'cedro');
  const nenhuma = await novo({ ativa: null, empresas: [] }).s.carregar();
  assert.strictEqual(nenhuma.atual, null);
  assert.strictEqual(nenhuma.mostrarSeletor, false);
});

t('seletor só com duas ou mais empresas; aviso quando o agente atende outra empresa ou nenhuma', async () => {
  const uma = await novo({ ativa: 'aurora', empresas: [TRES.empresas[0]] }).s.carregar();
  assert.strictEqual(uma.mostrarSeletor, false);
  assert.strictEqual(uma.aviso, '');
  const mesma = await novo(TRES).s.carregar();
  assert.strictEqual(mesma.mostrarSeletor, true);
  assert.strictEqual(mesma.aviso, '');
  const outra = await novo(TRES, { guardada: 'boreal' }).s.carregar();
  assert.strictEqual(outra.aviso, 'O agente está trabalhando em Aurora Nutrição. Peça a troca no Claude se quiser que ele atenda esta empresa.');
  const semAtiva = await novo({ ...TRES, ativa: null }).s.carregar();
  assert.ok(/não tem uma empresa escolhida/.test(semAtiva.aviso), semAtiva.aviso);
});

t('a escolha do painel mora só na sessão do navegador (sessionStorage), nunca em localStorage', async () => {
  const antesSessao = global.sessionStorage; const antesLocal = global.localStorage;
  try {
    const sessao = memoria('boreal'); const duradouro = memoria('cedro');
    global.sessionStorage = sessao; global.localStorage = duradouro;
    const falso = servidorFalso(TRES);
    const s = EmpresaSeletor.criar({ buscar: falso.buscar, endereco: 'http://localhost:8890/_fabrica/paineis/laboratorio.html', documento: null });
    assert.strictEqual((await s.carregar()).atual, 'boreal', 'vale a escolha da sessão, não a de ontem');
    assert.strictEqual(s.escolher('aurora'), true);
    assert.strictEqual(sessao.mapa.get(EmpresaSeletor.CHAVE), 'aurora');
    assert.strictEqual(duradouro.mapa.get(EmpresaSeletor.CHAVE), 'cedro', 'o armazenamento duradouro não é tocado');
  } finally {
    global.sessionStorage = antesSessao; global.localStorage = antesLocal;
    if (antesSessao === undefined) delete global.sessionStorage;
    if (antesLocal === undefined) delete global.localStorage;
  }
  const semComentarios = ler(SELETOR).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!semComentarios.includes('localStorage'), 'o seletor não usa localStorage');
});

t('o Laboratório só aceita mensagem da própria prévia e da própria origem', () => {
  const html = ler(path.join(PAINEIS, 'laboratorio.html'));
  assert.ok(html.includes('e.source !== frame.contentWindow || e.origin !== location.origin'), 'falta conferir a origem da mensagem');
});

t('armazenamento do navegador quebrado não trava o painel', async () => {
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); } };
  const { s } = novo(TRES, { armazenamento: quebrado });
  assert.strictEqual((await s.carregar()).atual, 'aurora');
  assert.strictEqual(s.escolher('boreal'), true);
  assert.strictEqual(s.atual(), 'boreal');
  const sem = novo(TRES, { armazenamento: null });
  assert.strictEqual((await sem.s.carregar()).atual, 'aurora');
});

t('todo pedido leva a empresa escolhida; o envio leva a empresa por último; escolher não chama o servidor', async () => {
  const guardada = memoria();
  const { s, falso } = novo(TRES, { armazenamento: guardada });
  await s.carregar();
  await s.ler('/api/dados');
  await s.ler('/api/paineis');
  const antes = falso.pedidos.length;
  s.escolher('boreal');
  assert.strictEqual(falso.pedidos.length, antes, 'trocar de empresa não pede nada ao servidor (nem grava a ativa)');
  assert.strictEqual(guardada.mapa.get(EmpresaSeletor.CHAVE), 'boreal', 'a escolha fica no navegador');
  const r = await s.enviar('/api/aprovar', { id: 'x', empresa: 'aurora' });
  assert.strictEqual(r.json.empresa, 'boreal', 'o corpo não troca a empresa do painel');
  await s.enviar('/api/desfazer', { id: 'x' });
  const [lista, ...resto] = falso.pedidos;
  assert.strictEqual(lista.url, '/api/empresas');
  for (const p of resto) {
    assert.ok(p.url.startsWith('/api/'), p.url);
    const empresa = new URL(p.url, 'http://localhost').searchParams.get('empresa');
    assert.ok(empresa === 'aurora' || empresa === 'boreal', p.url);
    if (p.opcoes && p.opcoes.method === 'POST') assert.strictEqual(JSON.parse(p.opcoes.body).empresa, empresa);
  }
  assert.deepStrictEqual(resto.map((p) => new URL(p.url, 'http://localhost').searchParams.get('empresa')), ['aurora', 'aurora', 'boreal', 'boreal']);
});

t('resposta que chega depois da troca de empresa, ou de outra empresa, é descartada', async () => {
  const { s, falso } = novo(TRES);
  await s.carregar();
  falso.segurar();
  const atrasada = s.ler('/api/dados');
  const envio = s.enviar('/api/desfazer', { id: 'peca-de-aurora' });
  s.escolher('boreal');
  falso.soltar();
  assert.strictEqual(await atrasada, null, 'a leitura da aurora não pode aparecer na boreal');
  assert.strictEqual(await envio, null);
  const boa = await s.ler('/api/dados');
  assert.deepStrictEqual(boa.json.pecas, [{ id: 'peca-de-boreal' }]);
  // o servidor diz que a resposta é de outra empresa: descartada
  const outro = novo(TRES, { extra: { empresaDaResposta: 'cedro' } });
  await outro.s.carregar();
  assert.strictEqual(await outro.s.ler('/api/dados'), null);
});

t('sem empresa nenhum pedido sai; rota fora de /api/ é recusada', async () => {
  const { s, falso } = novo({ ativa: null, empresas: [] });
  await s.carregar();
  await assert.rejects(() => s.ler('/api/dados'), /Nenhuma empresa/);
  assert.strictEqual(falso.pedidos.length, 1);
  assert.throws(() => EmpresaSeletor.urlDaApi('/empresas/aurora/laboratorio/dados/laboratorio.json', 'aurora'), /fora do servidor/);
  assert.throws(() => EmpresaSeletor.urlDaApi('/api/dados', ''), /sem empresa/);
  assert.strictEqual(EmpresaSeletor.urlDaApi('/api/dados', 'boreal'), '/api/dados?empresa=boreal');
  const comEmpresa = novo(TRES);
  await comEmpresa.s.carregar();
  await assert.rejects(() => comEmpresa.s.ler('dados/laboratorio.json'), /fora do servidor/);
});

t('cores da marca na página; papel sem cor fica com a cor de reserva', async () => {
  const props = {};
  const documento = { documentElement: { style: { setProperty: (k, v) => { props[k] = v; } } }, fonts: null };
  const { s } = novo(TRES, { documento, extra: { cores: { escuro: '#102030', claro: null, acento: '#C06030', neutro: 'vermelho' } } });
  await s.carregar();
  const marca = await s.aplicarMarca();
  assert.strictEqual(marca.codigo, 'aurora');
  assert.strictEqual(props['--escuro'], '#102030');
  assert.strictEqual(props['--acento'], '#C06030');
  assert.ok(/^rgb\(/.test(props['--claro']) && /^rgb\(/.test(props['--neutro']), 'reserva para papel vazio ou inválido');
  assert.ok(['#102030', props['--claro']].includes(props['--sobre-acento']));
  assert.ok(/serif/.test(props['--letra-titulo']), 'sem arquivo de fonte vale a letra do sistema');
});

// ---------- 4. Começar (etapa 8, tarefa 9): para quem é e o que a pessoa quer criar ----------

const COMECAR = path.join(PAINEIS, 'comecar.html');

t('começar: o servidor entrega a tela; tudo passa pelo seletor, que só lê o caminho, grava a intenção e cria a empresa', async () => {
  const srv = criarServidor(path.resolve(RAIZ));
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  try {
    const html = await pedir(srv.address().port, '/_fabrica/paineis/comecar.html');
    assert.strictEqual(html.status, 200);
    assert.ok(/^text\/html/.test(html.tipo), html.tipo);
    assert.strictEqual(html.texto, lerCru(COMECAR));
  } finally { srv.close(); }
  const h = ler(COMECAR);
  const codigo = semComentarios(h);
  assert.ok(/<title>Começar<\/title>/.test(h) && /<h1>Começar<\/h1>/.test(h));
  assert.ok(!/\bfetch\s*\(/.test(h), 'chama fetch direto');
  assert.ok(!/XMLHttpRequest|\bimport\s*\(|EventSource|WebSocket|sendBeacon/.test(h), 'outro jeito de pedir dados');
  assert.ok(/<script src="empresa-seletor\.js"><\/script>/.test(h), 'carrega o seletor comum');
  const chamadas = [...h.matchAll(/seletor\.(ler|enviar)\(\s*([^,)]*)/g)];
  for (const [, tipo, arg] of chamadas) assert.ok(/^'\/api\/[a-z-]+'$/.test(arg.trim()), `seletor.${tipo}(${arg}) precisa de uma rota /api/ escrita por extenso`);
  assert.deepStrictEqual(chamadas.filter(([, tipo]) => tipo === 'ler').map(([, , a]) => a.trim()), ["'/api/caminho'"], 'lê só o caminho da empresa');
  assert.deepStrictEqual(chamadas.filter(([, tipo]) => tipo === 'enviar').map(([, , a]) => a.trim()), ["'/api/intencao'"], 'grava só a intenção');
  assert.strictEqual([...codigo.matchAll(/seletor\.comecar\(/g)].length, 1, 'a empresa nasce num lugar só, pelo seletor');
  assert.ok(/seletor\.montar\(\{ seletor: \$\('seletor'\), aviso: \$\('aviso'\)/.test(h), 'mesmo seletor e mesmo aviso das outras telas');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(codigo), 'nada de HTML montado com texto');
  assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(codigo), 'nenhuma janela do navegador');
  assert.ok(!/localStorage|sessionStorage/.test(codigo), 'a tela não guarda nada no navegador (a escolha da empresa é do seletor)');
  assert.ok(!/['"`][^'"`\n]*\.json(\?[^'"`\n]*)?['"`]/.test(h), 'cita um arquivo .json');
  assert.ok(!/https?:\/\//.test(h) && !/<link[^>]+stylesheet/i.test(h), 'nada de fora do computador');
  assert.ok(!/ativa/.test(codigo.slice(codigo.indexOf('<script>'))), 'a tela nunca mexe na empresa do agente');
});

t('começar: os textos e os ladrilhos do estudo aprovado, o trilho dos passos e nenhuma palavra interna', () => {
  const h = ler(COMECAR);
  for (const frase of [
    'Para quem você vai criar?', 'Minha marca', 'Eu, meu consultório, minha empresa', 'Meus clientes',
    'Sou social media ou agência; cada cliente com a sua cara', "'Como se chama a sua marca?'", "'Como se chama o primeiro cliente?'",
    "'Como se chama o novo cliente?'", 'O que você quer criar?', 'Pode marcar mais de um.',
    'As respostas só decidem a ordem do que aparece; nada fica bloqueado.',
    'Vídeo', 'Reels falado', 'Carrossel', 'Várias lâminas', 'Post único', 'Uma imagem', 'Tudo', 'Social media completo, com cronograma',
    '>Continuar<', '+ Novo cliente', 'No Claude, a Fábrica vai perguntar com qual empresa trabalhar.',
  ]) assert.ok(h.includes(frase), `falta "${frase}"`);
  // os ladrilhos são campos de verdade (teclado e leitor de tela): um de dois para quem é, vários para o que criar
  assert.deepStrictEqual([...h.matchAll(/<input type="radio" name="para" value="([a-z-]+)"/g)].map((m) => m[1]), ['minha-marca', 'clientes']);
  assert.deepStrictEqual([...h.matchAll(/<input type="checkbox" name="quer" value="([a-z-]+)"/g)].map((m) => m[1]), ['video', 'carrossel', 'post', 'tudo']);
  assert.ok(/<input id="nome"[^>]*maxlength="80"/.test(h), 'nome com o limite do servidor');
  // decisão 1 B: o trilho com os seis passos nesta tela (passos 1 e 2 em andamento)
  const trilho = /<nav class="trilho"[\s\S]*?<\/nav>/.exec(h);
  assert.ok(trilho, 'trilho dos passos');
  assert.deepStrictEqual([...trilho[0].matchAll(/<span class="t-rot">([^<]+)<\/span>/g)].map((m) => m[1]),
    ['Para quem é', 'O que criar', 'Sua marca', 'Biblioteca', 'Estilo inteiro', 'Decidir']);
  assert.ok(/aria-current="step"/.test(trilho[0]), 'o passo atual dito ao leitor de tela');
  // nenhuma palavra interna, nem no que aparece na tela, nem nos comentários
  const texto = semAcento(h).toLowerCase();
  for (const p of PROIBIDAS.concat(['pedido json', 'yaml'])) assert.ok(!texto.includes(p), `usa a palavra "${p}"`);
  const script = semComentarios(h).slice(semComentarios(h).indexOf('<script>'));
  const frases = [...script.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => /\s/.test(s) || /^[A-ZÀ-Ú]/.test(s));
  assert.ok(frases.length > 8, 'achou as frases da tela');
  for (const f of frases) for (const p of ['json', 'hex', 'codigo', 'arquivo', 'pasta'].concat(FORMATOS)) assert.ok(!semAcento(f).toLowerCase().split(/[^a-z]+/).includes(p), `"${f}" usa "${p}"`);
  assert.ok(/@media \(max-width: 520px\)/.test(h), 'arranjo do celular');
});

t('começar: "Tudo" marca os três, a intenção sai do jeito da rota e o formulário só passa com tudo respondido', () => {
  const h = ler(COMECAR);
  const codigo = [linhaDaTela(h, 'const QUER = '), linhaDaTela(h, 'const ORDEM = '), linhaDaTela(h, 'const PARA = '), linhaDaTela(h, 'const LIMITE_NOME = '),
    trechoDaTela(h, 'function marcar(marcados, valor, ligado) {'), trechoDaTela(h, 'function intencaoDe(marcados) {'),
    trechoDaTela(h, 'function marcadosDa(intencao) {'), trechoDaTela(h, 'function rotuloDoNome(para, novoCliente) {'),
    trechoDaTela(h, 'function problemaDoFormulario(f) {')].join('\n');
  // eslint-disable-next-line no-new-func
  const f = new Function(codigo + '\nreturn { marcar, intencaoDe, marcadosDa, rotuloDoNome, problemaDoFormulario };')();
  assert.deepStrictEqual(f.marcar([], 'tudo', true), ['video', 'carrossel', 'post', 'tudo']);
  assert.deepStrictEqual(f.marcar(['video', 'carrossel', 'post', 'tudo'], 'carrossel', false), ['video', 'post'], 'tirar um dos três tira o Tudo');
  assert.deepStrictEqual(f.marcar(['video', 'carrossel', 'post', 'tudo'], 'tudo', false), [], 'tirar o Tudo tira os três');
  assert.deepStrictEqual(f.marcar(['post'], 'video', true), ['video', 'post'], 'ordem fixa');
  assert.deepStrictEqual(f.marcar(['video', 'carrossel'], 'post', true), ['video', 'carrossel', 'post'], 'os três marcados um a um não viram Tudo');
  assert.deepStrictEqual(f.intencaoDe(['video', 'post']), { quer: ['video', 'post'], tudo: false });
  assert.deepStrictEqual(f.intencaoDe(['video', 'carrossel', 'post', 'tudo']), { quer: ['video', 'carrossel', 'post'], tudo: true });
  assert.deepStrictEqual(f.marcadosDa({ quer: ['video', 'carrossel', 'post'], tudo: true }), ['video', 'carrossel', 'post', 'tudo']);
  assert.deepStrictEqual(f.marcadosDa({ quer: ['carrossel', 'nada'], tudo: false }), ['carrossel'], 'só o que a tela conhece');
  assert.deepStrictEqual(f.marcadosDa(null), []);
  assert.strictEqual(f.rotuloDoNome('minha-marca', false), 'Como se chama a sua marca?');
  assert.strictEqual(f.rotuloDoNome('clientes', false), 'Como se chama o primeiro cliente?');
  assert.strictEqual(f.rotuloDoNome('clientes', true), 'Como se chama o novo cliente?');
  // o formulário: quem é, o nome (quando a empresa ainda não existe) e pelo menos uma marcação
  const ok = { precisaNome: true, para: 'minha-marca', nome: 'Aurora Nutrição', marcados: ['video'] };
  assert.strictEqual(f.problemaDoFormulario(ok), null);
  assert.strictEqual(f.problemaDoFormulario({ ...ok, para: null }).campo, 'para');
  assert.strictEqual(f.problemaDoFormulario({ ...ok, para: 'outro' }).campo, 'para');
  assert.strictEqual(f.problemaDoFormulario({ ...ok, nome: '   ' }).campo, 'nome');
  assert.strictEqual(f.problemaDoFormulario({ ...ok, nome: 'x'.repeat(81) }).campo, 'nome');
  assert.strictEqual(f.problemaDoFormulario({ ...ok, marcados: [] }).campo, 'quer');
  assert.strictEqual(f.problemaDoFormulario({ precisaNome: false, para: null, nome: '', marcados: ['post'] }), null, 'empresa que já existe: só o que criar');
  for (const p of [{ ...ok, para: null }, { ...ok, nome: '' }, { ...ok, marcados: [] }]) assert.ok(/^[A-ZÉ]/.test(f.problemaDoFormulario(p).texto), 'mensagem em frase');
});

t('começar: Continuar cria a empresa só quando ela não existe, grava a intenção pelo seletor e leva à marca dessa empresa', () => {
  const h = ler(COMECAR);
  const cont = trechoDaTela(h, 'async function continuar(ev) {');
  const cria = cont.indexOf('await seletor.comecar({ nome, para })');
  const grava = cont.indexOf("await seletor.enviar('/api/intencao', intencaoDe(marcados))");
  const vai = cont.indexOf("location.href = 'marca.html?empresa=' + encodeURIComponent(codigo)");
  assert.ok(cria >= 0 && grava > cria && vai > grava, 'cria, grava a intenção e só então vai para a marca');
  assert.ok(/if \(precisaNome && !tela\.criada\) \{/.test(cont.slice(0, cria)), 'cria só quando a empresa ainda não existe (nem nasceu nesta tela)');
  assert.ok(/if \(r === null\) return;/.test(cont.slice(grava)), 'resposta de outra empresa: fica onde está');
  assert.ok(/if \(!r\.ok\)/.test(cont.slice(grava)), 'a recusa aparece na tela');
  assert.ok(/abrirEmpresa\(/.test(cont.slice(cria, grava)), 'empresa criada e intenção recusada: a tela já fica na empresa nova (não cria outra ao tentar de novo)');
  assert.ok(/tela\.ocupado = true;/.test(cont) && /\} finally \{[\s\S]*tela\.ocupado = false;/.test(cont), 'um envio por vez; religa no fim');
  assert.ok(!/empresa:/.test(cont), 'a tela não põe a empresa no corpo (o seletor põe, por último)');
  assert.ok(/aoTrocar: \(\) => \{ if \(!tela\.ocupado\) carregarEmpresa\(false\); \}/.test(h), 'trocar de empresa no seletor recarrega a tela, menos no meio do envio');
});

t('começar: depois que a empresa nasce, a tela usa o código devolvido (nunca o do endereço) e não cria outra, mesmo com a releitura da lista falhando', async () => {
  const h = ler(COMECAR);
  const codigo = [linhaDaTela(h, 'const tela = '), trechoDaTela(h, 'function abrirNovoCliente() {'), trechoDaTela(h, 'async function naEmpresaCriada() {'), trechoDaTela(h, 'async function continuar(ev) {')].join('\n');
  // seletor de mentira: o endereço trazia ?empresa=aurora; a lista com a empresa nova falha na primeira releitura
  let atual = 'aurora';
  const lista = ['aurora'];
  let releituras = 0;
  let falhas = 1;
  let trocaNoComecar = false;
  let respIntencao = { ok: true, json: { ok: true } };
  const criadas = [];
  const intencoes = [];
  const erros = [];
  const seletor = {
    atual: () => atual, nome: () => atual,
    comecar: async ({ nome }) => { criadas.push(nome); const c = 'aurora-' + (criadas.length + 1); lista.push(c); if (trocaNoComecar) atual = c; return { ok: true, json: { ok: true, codigo: c } }; },
    carregar: async () => { releituras += 1; if (releituras <= falhas) throw new Error('caiu'); return { empresas: lista.map((c) => ({ codigo: c })), atual }; },
    escolher: (c) => { if (!lista.includes(c)) throw new Error('desconhecida'); atual = c; return true; },
    enviar: async (rota) => { intencoes.push({ rota, empresa: atual }); return respIntencao; },
  };
  const local = { href: '' };
  const elementos = {};
  const $ = (id) => { if (!elementos[id]) elementos[id] = { value: '', textContent: '', hidden: false, focus() {} }; return elementos[id]; };
  $('nome').value = 'Aurora Dois';
  // eslint-disable-next-line no-new-func
  const { tela, continuar, abrirNovoCliente } = new Function('seletor', 'esconderErro', 'marcadosNaTela', 'paraNaTela', '$', 'problemaDoFormulario', 'mostrarErro', 'desligar', 'erroDe', 'abrirEmpresa', 'intencaoDe', 'location', 'SEM_SERVIDOR',
    'rotuloDoNome', 'porNaTela', 'trilho',
    codigo + '\nreturn { tela, continuar, abrirNovoCliente };')(seletor, () => {}, () => ['video'], () => 'clientes', $, () => null,
    (t) => erros.push(t), () => {}, () => 'recusado', () => { tela.modo = 'empresa'; }, () => ({ quer: ['video'], tudo: false }), local, 'sem servidor',
    () => 'Nome do cliente', () => {}, () => {});
  const ev = { preventDefault() {} };
  tela.modo = 'novo-cliente';
  // 1) a empresa nasce, mas a lista não volta: nada é gravado em aurora, e o erro aparece
  await continuar(ev);
  assert.deepStrictEqual(criadas, ['Aurora Dois']);
  assert.deepStrictEqual(intencoes, [], 'a intenção nunca vai para a empresa do endereço');
  assert.strictEqual(erros.length, 1);
  assert.strictEqual(tela.criada, 'aurora-2', 'a tela guarda o código devolvido');
  assert.strictEqual(local.href, '');
  // 2) "Continuar" de novo: não cria outra; relê a lista, passa para a empresa nova e grava nela
  await continuar(ev);
  assert.deepStrictEqual(criadas, ['Aurora Dois'], 'nenhuma segunda empresa');
  assert.deepStrictEqual(intencoes, [{ rota: '/api/intencao', empresa: 'aurora-2' }]);
  assert.strictEqual(local.href, 'marca.html?empresa=aurora-2');
  // 3) o caso comum: o seletor já trocou ao criar; a intenção recusada não faz o segundo "Continuar" criar outra
  atual = 'aurora'; releituras = 0; falhas = 0; trocaNoComecar = true; local.href = ''; intencoes.length = 0; criadas.length = 0;
  tela.criada = null; tela.modo = 'novo-cliente';
  respIntencao = { ok: false, json: { ok: false, erro: 'x' } };
  await continuar(ev);
  assert.strictEqual(releituras, 0, 'com o seletor já na empresa nova, nada a reler');
  assert.deepStrictEqual(intencoes.map((x) => x.empresa), ['aurora-2']);
  assert.strictEqual(tela.modo, 'empresa', 'a tela fica na empresa nova');
  // o mesmo "Continuar" de novo: não cria outra, grava na empresa nova
  await continuar(ev);
  assert.strictEqual(criadas.length, 1, 'não cria outra');
  assert.deepStrictEqual(intencoes.map((x) => x.empresa), ['aurora-2', 'aurora-2']);
  // 4) "+ Novo cliente" pedido de propósito depois disso: cria o cliente novo e grava nele, nunca na empresa anterior
  respIntencao = { ok: true, json: { ok: true } };
  abrirNovoCliente();
  assert.strictEqual(tela.criada, null, '"+ Novo cliente" solta a empresa criada antes');
  $('nome').value = 'Aurora Três';
  await continuar(ev);
  assert.deepStrictEqual(criadas, ['Aurora Dois', 'Aurora Três'], 'o cliente novo nasce');
  assert.deepStrictEqual(intencoes.map((x) => x.empresa), ['aurora-2', 'aurora-2', 'aurora-3'], 'a intenção vai para o cliente novo');
  assert.strictEqual(local.href, 'marca.html?empresa=aurora-3');
  // trocar de empresa no seletor (escolha da pessoa) solta a empresa criada
  assert.ok(/if \(tela\.criada && codigo !== tela\.criada\) tela\.criada = null;/.test(trechoDaTela(h, 'async function carregarEmpresa(novoCliente) {')));
});

t('seletor, começo: a releitura da lista que falha depois de criar não vira erro, e o endereço acompanha a empresa nova', async () => {
  const pedidos = [];
  let lidas = 0;
  const buscar = async (url, opcoes) => {
    pedidos.push(url);
    if (url === '/api/empresas') { lidas += 1; return lidas === 1 ? { ok: true, status: 200, json: async () => ({ ativa: 'aurora', empresas: [{ codigo: 'aurora', nome: 'Aurora' }], empresa: 'aurora' }) } : { ok: false, status: 500, json: async () => ({ erro: 'caiu' }) }; }
    if (url === '/api/comecar') return { ok: true, status: 200, json: async () => ({ ok: true, codigo: 'boreal', nome: JSON.parse(opcoes.body).nome, empresa: 'boreal' }) };
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  const s = EmpresaSeletor.criar({ buscar, armazenamento: memoria(), endereco: 'http://localhost:8890/_fabrica/paineis/comecar.html?empresa=aurora', documento: null });
  await s.carregar();
  const r = await s.comecar({ nome: 'Boreal', para: 'clientes' });
  assert.strictEqual(r.ok, true, 'a empresa nasceu: não é erro');
  assert.strictEqual(r.json.codigo, 'boreal');
  assert.strictEqual(r.releu, false, 'diz que a lista não voltou');
  assert.strictEqual(s.atual(), 'aurora', 'sem a lista, o seletor não inventa a empresa');
  assert.ok(/atualizarEndereco\(json\.codigo\)/.test(trechoDaTela(ler(SELETOR).replace(/\n {4}/g, '\n  '), 'async function comecar(corpo) {')), 'o endereço acompanha a empresa nova');
});

t('começar: "Meus clientes" mostra o seletor desde o primeiro cliente, com "+ Novo cliente" (decisão 9 A), e o aviso do Claude com a segunda empresa (D2)', () => {
  const h = ler(COMECAR);
  assert.ok(/<button type="button" class="botao-topo" id="novo-cliente" hidden>\+ Novo cliente<\/button>/.test(h));
  const abrir = trechoDaTela(h, 'function abrirEmpresa(caminho) {');
  assert.ok(/seletor\.mostrarSempre\(tela\.para === 'clientes'\);/.test(abrir), 'agência: seletor visível já com um cliente');
  assert.ok(/\$\('novo-cliente'\)\.hidden = tela\.para !== 'clientes';/.test(abrir), '"+ Novo cliente" só para quem cria para clientes');
  assert.ok(/abrirEmpresa\(r\.json\);/.test(trechoDaTela(h, 'async function carregarEmpresa(novoCliente) {')), 'a tela segue o caminho lido da empresa');
  assert.ok(/'Empresa:'/.test(ler(SELETOR)), 'o rótulo do seletor continua "Empresa:"');
  const novo = trechoDaTela(h, 'function abrirNovoCliente() {');
  assert.ok(/\$\('nota-claude'\)\.hidden = false;/.test(novo), 'com o novo cliente serão duas ou mais empresas: a tela avisa');
  assert.ok(/\?novo=cliente|get\('novo'\) === 'cliente'/.test(h), 'as outras telas podem abrir direto o "+ Novo cliente"');
});

// O seletor com o envio que cria a empresa: um servidor de mentira que guarda o que recebeu.
function servidorDoComeco(inicial, resposta) {
  const pedidos = [];
  const lista = { ativa: inicial.length === 1 ? inicial[0].codigo : null, empresas: inicial.slice() };
  const buscar = async (url, opcoes) => {
    pedidos.push({ url, opcoes });
    if (url === '/api/empresas') return { ok: true, status: 200, json: async () => ({ ...lista, empresa: lista.ativa }) };
    if (url === '/api/comecar') {
      const r = resposta(JSON.parse(opcoes.body));
      if (r.ok) { lista.empresas.push({ codigo: r.codigo, nome: r.nome }); lista.ativa = lista.empresas.length === 1 ? r.codigo : null; }
      return { ok: r.ok !== false, status: r.ok === false ? 400 : 200, json: async () => ({ ...r, empresa: r.ok ? r.codigo : null }) };
    }
    return { ok: true, status: 200, json: async () => ({ ok: true, empresa: new URL(url, 'http://localhost').searchParams.get('empresa') }) };
  };
  return { buscar, pedidos };
}

t('seletor, começo: cria a empresa sem empresa no pedido, lê a lista de novo e passa a mostrar a nova (sem gravar a do agente)', async () => {
  assert.ok(/const ROTA_COMECAR = '\/api\/comecar';/.test(ler(SELETOR)));
  // pasta vazia: nenhuma empresa ainda, e o pedido de criar sai mesmo assim
  const falso = servidorDoComeco([], (b) => ({ ok: true, codigo: 'aurora-nutricao', nome: b.nome }));
  const guardada = memoria();
  const s = EmpresaSeletor.criar({ buscar: falso.buscar, armazenamento: guardada, endereco: 'http://localhost:8890/_fabrica/paineis/comecar.html', documento: null });
  assert.strictEqual((await s.carregar()).atual, null);
  const trocas = [];
  s.montar({ aoTrocar: (c) => trocas.push(c) });
  const r = await s.comecar({ nome: 'Aurora Nutrição', para: 'minha-marca', empresa: 'boreal', extra: 1 });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.json.codigo, 'aurora-nutricao');
  const envio = falso.pedidos.find((p) => p.url === '/api/comecar');
  assert.strictEqual(envio.opcoes.method, 'POST');
  assert.deepStrictEqual(JSON.parse(envio.opcoes.body), { nome: 'Aurora Nutrição', para: 'minha-marca' }, 'só o nome e para quem é: nada de empresa');
  assert.deepStrictEqual(falso.pedidos.map((p) => p.url), ['/api/empresas', '/api/comecar', '/api/empresas'], 'depois de criar, só lê a lista');
  assert.strictEqual(s.atual(), 'aurora-nutricao');
  assert.deepStrictEqual(trocas, ['aurora-nutricao'], 'a tela fica sabendo da empresa nova');
  assert.strictEqual(guardada.mapa.get(EmpresaSeletor.CHAVE), 'aurora-nutricao', 'a escolha fica só neste navegador');
  // o próximo envio já leva a empresa nova
  await s.enviar('/api/intencao', { quer: ['video'] });
  assert.strictEqual(JSON.parse(falso.pedidos[falso.pedidos.length - 1].opcoes.body).empresa, 'aurora-nutricao');
  // um cliente novo, com a primeira já escolhida: a nova passa a ser a do painel
  const dois = servidorDoComeco([{ codigo: 'aurora', nome: 'Aurora' }], (b) => ({ ok: true, codigo: 'boreal-estudio', nome: b.nome }));
  const s2 = EmpresaSeletor.criar({ buscar: dois.buscar, armazenamento: memoria(), endereco: 'http://localhost:8890/_fabrica/paineis/comecar.html?empresa=aurora', documento: null });
  await s2.carregar();
  assert.strictEqual((await s2.comecar({ nome: 'Boreal Estúdio', para: 'clientes' })).ok, true);
  assert.strictEqual(s2.atual(), 'boreal-estudio', 'a empresa nova vale mesmo com outra no endereço');
  assert.strictEqual(s2.situacao().empresas.length, 2);
  // recusa do servidor: nada muda na escolha e a lista não é lida de novo
  const recusa = servidorDoComeco([{ codigo: 'aurora', nome: 'Aurora' }], () => ({ ok: false, erro: 'Escreva o nome da marca ou do cliente.' }));
  const s3 = EmpresaSeletor.criar({ buscar: recusa.buscar, armazenamento: memoria(), endereco: '', documento: null });
  await s3.carregar();
  const r3 = await s3.comecar({ nome: '', para: 'clientes' });
  assert.strictEqual(r3.ok, false);
  assert.strictEqual(r3.json.erro, 'Escreva o nome da marca ou do cliente.');
  assert.strictEqual(s3.atual(), 'aurora');
  assert.strictEqual(recusa.pedidos.filter((p) => p.url === '/api/empresas').length, 1);
});

t('seletor, agência (decisão 9 A): a tela pode pedir o seletor visível já com uma empresa; sem empresa, nunca', async () => {
  const um = novo({ ativa: 'aurora', empresas: [TRES.empresas[0]] });
  await um.s.carregar();
  assert.strictEqual(um.s.situacao().mostrarSeletor, false, 'sem pedir, como sempre: só com duas');
  um.s.mostrarSempre(true);
  assert.strictEqual(um.s.situacao().mostrarSeletor, true);
  um.s.mostrarSempre(false);
  assert.strictEqual(um.s.situacao().mostrarSeletor, false);
  const nenhum = novo({ ativa: null, empresas: [] });
  await nenhum.s.carregar();
  nenhum.s.mostrarSempre(true);
  assert.strictEqual(nenhum.s.situacao().mostrarSeletor, false);
});

// "/" numa pasta de mentira: para onde vai e o que fica gravado.
function pedirRaw(porta, metodo, caminho, corpo) {
  return new Promise((resolve, reject) => {
    const dadosCorpo = corpo === undefined ? null : Buffer.from(JSON.stringify(corpo));
    const req = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: metodo, headers: dadosCorpo ? { 'Content-Type': 'application/json', 'Content-Length': dadosCorpo.length } : {} }, (res) => {
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve({ status: res.statusCode, local: res.headers.location, texto: Buffer.concat(partes).toString('utf8') }));
    });
    req.on('error', reject);
    if (dadosCorpo) req.write(dadosCorpo);
    req.end();
  });
}
function fotografia(dir) {
  const fora = [];
  const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) andar(p); else fora.push(path.relative(dir, p) + ':' + fs.readFileSync(p).toString('base64'));
  });
  andar(dir);
  return fora.sort();
}
async function comServidor(r, fn) {
  const srv = criarServidor(r);
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  try { return await fn(srv.address().port); } finally { srv.close(); }
}
const PAG = '/_fabrica/paineis/';

t('"/" abre Começar na pasta vazia e na empresa que nasceu pelo caminho sem dizer o que quer criar; o resto abre como antes', async () => {
  const os = require('os');
  const vazia = fs.mkdtempSync(path.join(os.tmpdir(), 'comecar-'));
  try {
    await comServidor(vazia, async (porta) => {
      const ir = async (c) => { const x = await pedirRaw(porta, 'GET', c); assert.strictEqual(x.status, 302, c); return x.local; };
      // 1) pasta vazia
      const antes = fotografia(vazia);
      assert.strictEqual(await ir('/'), PAG + 'comecar.html');
      assert.strictEqual(await ir('/?empresa=inventada'), PAG + 'comecar.html', 'sem empresa nenhuma, o endereço não muda nada');
      assert.deepStrictEqual(fotografia(vazia), antes, 'abrir não grava nada');
      // 2) a empresa nasceu pelo caminho e ainda não disse o que quer criar
      const c1 = await pedirRaw(porta, 'POST', '/api/comecar', { nome: 'Aurora Nutrição', para: 'minha-marca' });
      assert.strictEqual(c1.status, 200, c1.texto);
      const aurora = JSON.parse(c1.texto).codigo;
      // sem empresa no endereço, Começar vai com a empresa que a regra escolheu (a tela não escolhe outra pela ordem dela)
      assert.strictEqual(await ir('/'), PAG + 'comecar.html?empresa=' + aurora);
      assert.strictEqual(await ir('/?empresa=' + aurora), PAG + 'comecar.html?empresa=' + aurora);
      const meio = fotografia(vazia);
      await ir('/');
      assert.deepStrictEqual(fotografia(vazia), meio, 'abrir não grava nada');
      assert.ok(!fs.existsSync(path.join(vazia, 'empresas', 'ativa.json')));
      // com a intenção gravada: como antes
      const i1 = await pedirRaw(porta, 'POST', '/api/intencao', { empresa: aurora, quer: ['video'], tudo: false });
      assert.strictEqual(i1.status, 200, i1.texto);
      assert.strictEqual(await ir('/'), PAG + 'laboratorio.html');
      assert.strictEqual(await ir('/?empresa=' + aurora), PAG + 'laboratorio.html?empresa=' + aurora);
      // um cliente novo pelo caminho: com ele no endereço, Começar; sem empresa escolhida, como antes (a tela pede a escolha)
      const c2 = await pedirRaw(porta, 'POST', '/api/comecar', { nome: 'Boreal Estúdio', para: 'clientes' });
      const boreal = JSON.parse(c2.texto).codigo;
      assert.strictEqual(await ir('/?empresa=' + boreal), PAG + 'comecar.html?empresa=' + boreal);
      assert.strictEqual(await ir('/'), PAG + 'laboratorio.html');
      // a empresa já tem peças: abre como antes, mesmo sem intenção
      const lab = path.join(vazia, 'empresas', boreal, 'laboratorio', 'dados');
      fs.mkdirSync(lab, { recursive: true });
      fs.writeFileSync(path.join(lab, 'laboratorio.json'), '[]');
      assert.strictEqual(await ir('/?empresa=' + boreal), PAG + 'laboratorio.html?empresa=' + boreal);
      // a empresa criada pelo agente depois que o caminho começou nesta pasta (depois do uso.json), sem intenção: também
      // abre em Começar (decisão 3 do relatório da Tarefa 9)
      require(path.join(RAIZ, '_fabrica', 'core', 'empresa.js')).criar('cedro', 'Cedro Marcenaria', vazia);
      assert.strictEqual(await ir('/?empresa=cedro'), PAG + 'comecar.html?empresa=cedro', 'nasceu depois que o caminho começou nesta pasta');
    });
  } finally { fs.rmSync(vazia, { recursive: true, force: true }); }

  // 3) pasta antiga com dados: abre como antes, mesmo sem intenção e mesmo com o caminho começado; nada é criado
  const antiga = fs.mkdtempSync(path.join(os.tmpdir(), 'comecar-antiga-'));
  try {
    fs.mkdirSync(path.join(antiga, '04-LABORATORIO-DE-DESIGN', 'dados'), { recursive: true });
    fs.writeFileSync(path.join(antiga, '04-LABORATORIO-DE-DESIGN', 'dados', 'laboratorio.json'), '[]');
    await comServidor(antiga, async (porta) => {
      const antes = fotografia(antiga);
      assert.strictEqual((await pedirRaw(porta, 'GET', '/')).local, PAG + 'laboratorio.html');
      assert.strictEqual((await pedirRaw(porta, 'GET', '/?empresa=principal')).local, PAG + 'laboratorio.html?empresa=principal');
      assert.strictEqual((await pedirRaw(porta, 'GET', '/api/caminho?empresa=principal')).status, 200);
      assert.deepStrictEqual(fotografia(antiga), antes, 'a pasta antiga fica igual byte a byte');
      fs.mkdirSync(path.join(antiga, 'empresas'), { recursive: true });
      fs.writeFileSync(path.join(antiga, 'empresas', 'uso.json'), '{ "para": "minha-marca" }\n');
      assert.strictEqual((await pedirRaw(porta, 'GET', '/')).local, PAG + 'laboratorio.html');
    });
  } finally { fs.rmSync(antiga, { recursive: true, force: true }); }

  // empresa criada pelo agente numa pasta onde o caminho nunca começou: como antes
  const doAgente = fs.mkdtempSync(path.join(os.tmpdir(), 'comecar-agente-'));
  try {
    require(path.join(RAIZ, '_fabrica', 'core', 'empresa.js')).criar('aurora', 'Aurora Nutrição', doAgente);
    await comServidor(doAgente, async (porta) => {
      assert.strictEqual((await pedirRaw(porta, 'GET', '/')).local, PAG + 'laboratorio.html');
    });
  } finally { fs.rmSync(doAgente, { recursive: true, force: true }); }
});

t('laboratório: o link discreto "Começar o caminho" só aparece enquanto a empresa não disse o que quer criar', () => {
  const h = ler(path.join(PAINEIS, 'laboratorio.html'));
  assert.ok(/<a id="link-comecar" href="comecar\.html" class="link-discreto" hidden>Começar o caminho<\/a>/.test(h));
  const mostrar = trechoDaTela(h, 'async function mostrarComecar(codigo) {');
  assert.ok(/seletor\.ler\('\/api\/caminho'\)/.test(mostrar), 'lê o caminho pelo seletor');
  assert.ok(/r\.json\.passo === 'o-que'/.test(mostrar), 'só enquanto falta a intenção');
  assert.ok(/'comecar\.html\?empresa=' \+ encodeURIComponent\(codigo\)/.test(mostrar), 'leva a empresa');
  assert.ok(/if \(r === null \|\| !r\.ok \|\| seletor\.atual\(\) !== codigo\) return;/.test(mostrar), 'resposta de outra empresa: nada');
  assert.ok(/mostrarComecar\(codigo\);/.test(trechoDaTela(h, 'async function carregarEmpresa() {')));
});

// ---------- 5. marca.html: "Sua marca" e "Personalizar" (etapa 8, Tarefa 10) ----------

const MARCA_HTML = path.join(PAINEIS, 'marca.html');
const CoresDoLogo = require(path.join(PAINEIS, 'cores-do-logo.js'));
const Legibilidade = require(path.join(RAIZ, '08-FERRAMENTAS', 'marca', 'legibilidade.js'));
const cor = (r, g, b) => CoresDoLogo.codigo([r, g, b]); // nenhum código de cor escrito à mão
const ENVIOS_DA_MARCA = ["'/api/arquivo'", "'/api/marca'", "'/api/marca/desfazer'", "'/api/pedido'"];

t('marca: o servidor entrega a tela e a legibilidade; a tela carrega só o seletor, as cores do logo e a legibilidade', async () => {
  const srv = criarServidor(path.resolve(RAIZ));
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  const porta = srv.address().port;
  try {
    const html = await pedir(porta, '/_fabrica/paineis/marca.html');
    assert.strictEqual(html.status, 200);
    assert.ok(/^text\/html/.test(html.tipo), html.tipo);
    assert.strictEqual(html.texto, lerCru(MARCA_HTML));
    const leg = await pedir(porta, '/08-FERRAMENTAS/marca/legibilidade.js');
    assert.strictEqual(leg.status, 200);
    assert.ok(/^application\/javascript/.test(leg.tipo), leg.tipo);
  } finally { srv.close(); }
  const h = ler(MARCA_HTML);
  const scripts = [...h.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(scripts, ['empresa-seletor.js', 'cores-do-logo.js', '../../08-FERRAMENTAS/marca/legibilidade.js'], 'a legibilidade depois das cores do logo');
  assert.ok(!/\bfetch\s*\(/.test(h) && !/XMLHttpRequest|\bimport\s*\(|EventSource|WebSocket|sendBeacon/.test(h), 'nada de pedido fora do seletor');
  assert.ok(!/https?:\/\//.test(h) && !/<link[^>]+stylesheet/i.test(h), 'nada de fora do computador');
  assert.ok(!/['"`][^'"`\n]*\.json(\?[^'"`\n]*)?['"`]/.test(h), 'nenhum arquivo de dados por caminho');
  assert.ok(/<title>Sua marca<\/title>/.test(h));
});

t('marca: envios só para /api/marca, /api/marca/desfazer, /api/arquivo e /api/pedido, todos pelo seletor', () => {
  const h = ler(MARCA_HTML);
  const chamadas = [...h.matchAll(/seletor\.(ler|enviar)\(\s*([^,)]*)/g)];
  for (const [, tipo, arg] of chamadas) assert.ok(/^'\/api\/[a-z-]+(\/[a-z-]+)?'$/.test(arg.trim()), `seletor.${tipo}(${arg}) precisa de uma rota /api/ escrita por extenso`);
  assert.deepStrictEqual([...new Set(chamadas.filter(([, tipo]) => tipo === 'enviar').map(([, , a]) => a.trim()))].sort(), ENVIOS_DA_MARCA);
  const lidas = [...new Set(chamadas.filter(([, tipo]) => tipo === 'ler').map(([, , a]) => a.trim()))].sort();
  assert.deepStrictEqual(lidas, ["'/api/biblioteca'", "'/api/caminho'", "'/api/letras'"], 'lê o caminho, as letras e (no Personalizar) o catálogo');
  assert.ok(/seletor\.aplicarMarca\(\)/.test(h), 'a marca guardada vem do seletor');
  assert.ok(/seletor\.montar\(\{ seletor: \$\('seletor'\), aviso: \$\('aviso'\)/.test(h), 'mesmo seletor e mesmo aviso');
  const codigo = semComentarios(h);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|DOMParser|createContextualFragment/.test(codigo), 'nada de HTML montado com texto');
  assert.ok(!/\b(alert|confirm|prompt)\s*\(/.test(codigo), 'nenhuma janela do navegador');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(codigo), 'o que não foi guardado mora só na memória da página');
  // a empresa nunca vai no corpo pela tela (o seletor põe, por último)
  for (const m of codigo.matchAll(/seletor\.enviar\('[^']+', (\{[^\n]*\}|[a-z]+)\)/gi)) assert.ok(!/empresa/.test(m[1]), 'corpo com empresa: ' + m[1]);
});

t('marca: nenhuma cor fixa de marca no HTML (só as cores de reserva do painel)', () => {
  const h = ler(MARCA_HTML);
  assert.ok(!/#[0-9A-Fa-f]{6}(?![0-9A-Fa-f])/.test(h), 'código de cor de seis dígitos escrito na tela');
  assert.ok(!/#[0-9A-Fa-f]{3}(?![0-9A-Za-z_-])/.test(h), 'código de cor de três dígitos escrito na tela');
  assert.ok(!/\bhsla?\(/.test(h), 'cor em hsl escrita na tela');
  const reservas = new Set([...ler(SELETOR).matchAll(/rgb\(\d+, \d+, \d+\)/g)].map((m) => m[0]));
  const doPainel = new Set(['rgb(255, 255, 255)', 'rgb(170, 40, 40)', 'rgb(36, 112, 72)']); // texto sobre o destaque (como nas outras telas), erro e certo: nunca de marca
  for (const m of h.matchAll(/rgba?\([^)]*\)/g)) assert.ok(reservas.has(m[0]) || doPainel.has(m[0]), 'cor fixa: ' + m[0]);
});

t('marca: textos do estudo aprovado, sem palavra interna, sem endereço de internet (D3) e sem "falha de rede"', () => {
  const h = ler(MARCA_HTML);
  const tudo = semAcento(h).toLowerCase();
  for (const p of PROIBIDAS.concat(['pedido json'])) assert.ok(!tudo.includes(p), `marca.html usa "${p}"`);
  for (const frase of [
    'Sua marca já tem cores e letras definidas?', 'Com elas, mostramos todos os modelos já com a cara da sua marca.',
    'Sim, já tenho', 'Tenho uma parte', 'Ainda não tenho', 'Não tem? Tudo bem.',
    'Você pode usar as cores de um dos nossos modelos, criar uma identidade do zero com a gente, ou mandar referências do que você gosta. E dá para mudar quando quiser.',
    'Usar um dos nossos modelos', 'Criar uma identidade do zero', 'Enviar referências do que você gosta', 'Mais rápido',
    'Conte um pouco do seu negócio e do seu público', 'Arraste o logo aqui, ou clique para escolher', 'A Fábrica tira as cores do logo e mostra para você confirmar.',
    "'Fundo escuro'", "'Fundo claro'", "'Destaque'", "'Apoio'", 'Colar o código da cor', 'Outra cor',
    'Três jeitos de completar a sua marca', 'Escolha um par de letras', 'Prefiro escolher uma letra por vez', 'Use só letras que você tem direito de usar',
    'Tem um manual da marca em PDF?', 'Guardar a minha marca', "'Desfazer'", 'Trocar pela minha marca', 'Manter como está',
    'O estilo continua o mesmo; só as cores e letras mudam. Dá para desfazer.', 'Solte as imagens aqui', 'Quer contar alguma coisa?', 'Enviar referências',
    'Detalhes do estilo', "'Arranjo da imagem no vídeo'", "'Alinhamento'", "'Outro'", 'Cores que resolvem e combinam com a sua marca', "'Usar esta cor'", "'Sugerida'",
  ]) assert.ok(h.includes(frase), `falta "${frase}"`);
  // os textos que aparecem (as frases do script e o texto do HTML) sem palavra interna
  const codigo = semComentarios(h);
  const script = codigo.slice(codigo.indexOf('<script>'));
  const frases = [...script.matchAll(/'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]).filter((s) => /\s/.test(s) || /^[A-ZÀ-Ú]/.test(s));
  const doHtml = codigo.slice(0, codigo.indexOf('<script')).replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  assert.ok(frases.length > 60, 'achou as frases da tela');
  const INTERNAS = ['fila', 'json', 'yaml', 'hex', 'webp', 'gaveta', 'disposicao', 'indice', 'legado', 'manifesto', 'rede', 'upload', 'base64', 'url', 'link', 'links', 'html'].concat(FORMATOS);
  for (const f of frases.concat(doHtml)) for (const p of INTERNAS) assert.ok(!semAcento(f).toLowerCase().split(/[^a-z0-9]+/).includes(p), `"${f}" usa "${p}"`);
  // D3: referências só como arquivos (nenhum campo de endereço de internet)
  assert.ok(!/type="url"|type: 'url'|inputmode: 'url'/.test(h), 'campo de endereço');
  assert.ok(!/Imagens, links/.test(h));
});

t('marca, endereço: personalizar, papel e cor conferidos; valor estranho ou repetido é ignorado', () => {
  const h = ler(MARCA_HTML);
  // eslint-disable-next-line no-new-func
  const lerPersonalizar = new Function([linhaDaTela(h, 'const PAPEIS = '), linhaDaTela(h, 'const CODIGO_ESTILO = '), trechoDaTela(h, 'function lerPersonalizar(busca) {')].join('\n') + '\nreturn lerPersonalizar;')();
  assert.deepStrictEqual(lerPersonalizar('?personalizar=terra-e-salvia&papel=acento&cor=aa33cc'), { estilo: 'terra-e-salvia', papel: 'acento', cor: '#AA33CC', origem: null });
  assert.deepStrictEqual(lerPersonalizar('?empresa=aurora&personalizar=bloco'), { estilo: 'bloco', papel: null, cor: null, origem: null });
  // origem: só "proprio" ou "catalogo", uma vez; qualquer outro valor é ignorado (vale a ordem de hoje)
  assert.deepStrictEqual(lerPersonalizar('?personalizar=bloco&origem=proprio'), { estilo: 'bloco', papel: null, cor: null, origem: 'proprio' });
  assert.deepStrictEqual(lerPersonalizar('?personalizar=bloco&origem=catalogo'), { estilo: 'bloco', papel: null, cor: null, origem: 'catalogo' });
  for (const ruim of ['outra', 'Proprio', '', '__proto__']) assert.strictEqual(lerPersonalizar('?personalizar=bloco&origem=' + ruim).origem, null, ruim);
  assert.strictEqual(lerPersonalizar('?personalizar=bloco&origem=proprio&origem=catalogo').origem, null, 'origem repetida');
  assert.strictEqual(lerPersonalizar(''), null);
  assert.strictEqual(lerPersonalizar('?empresa=aurora'), null);
  for (const ruim of ['../x', '..', 'A', 'Bloco', 'a b', '<script>', 'bloco/x', 'bloco%2f..', '', 'x'.repeat(65), '-bloco']) {
    assert.strictEqual(lerPersonalizar('?personalizar=' + encodeURIComponent(ruim)), null, ruim);
  }
  assert.strictEqual(lerPersonalizar('?personalizar=bloco&personalizar=cartilha'), null, 'dois estilos');
  // papel ou cor estranhos: o Personalizar abre, sem cor sugerida
  for (const [papel, c] of [['fundo', 'aa33cc'], ['acento', 'red'], ['acento', '#aa33cc'], ['acento', 'aa33c'], ['acento', 'aa33ccd'], ['acento', 'zz33cc'], ['acento', ''], ['__proto__', 'aa33cc'], ['acento', 'aa33cc;x']]) {
    assert.deepStrictEqual(lerPersonalizar('?personalizar=bloco&papel=' + encodeURIComponent(papel) + '&cor=' + encodeURIComponent(c)), { estilo: 'bloco', papel: null, cor: null, origem: null }, papel + ' ' + c);
  }
  assert.deepStrictEqual(lerPersonalizar('?personalizar=bloco&papel=acento'), { estilo: 'bloco', papel: null, cor: null, origem: null }, 'papel sem cor');
  assert.deepStrictEqual(lerPersonalizar('?personalizar=bloco&papel=acento&papel=claro&cor=aa33cc'), { estilo: 'bloco', papel: null, cor: null, origem: null }, 'papel repetido');
  assert.deepStrictEqual(lerPersonalizar('?personalizar=bloco&papel=acento&cor=aa33cc&cor=112233'), { estilo: 'bloco', papel: null, cor: null, origem: null }, 'cor repetida');
  // o estilo também precisa existir no catálogo (conferido depois, com a lista da biblioteca)
  assert.ok(/estiloDoCatalogo\(/.test(trechoDaTela(h, 'async function carregarEmpresa(primeira) {')), 'o estilo do endereço é conferido no catálogo');
});

t('marca, Personalizar: a cor sugerida entra no editor do papel, marcada como sugerida, e nada é gravado ao abrir', () => {
  const h = ler(MARCA_HTML);
  // eslint-disable-next-line no-new-func
  const aplicarSugerida = new Function(linhaDaTela(h, 'const PAPEIS = ') + '\n' + trechoDaTela(h, 'function aplicarSugerida(cores, pedido) {') + '\nreturn aplicarSugerida;')();
  const atuais = { escuro: { cor: cor(20, 20, 30), de: 'marca' }, claro: { cor: cor(240, 240, 235), de: 'marca' }, acento: { cor: cor(200, 200, 60), de: 'marca' }, neutro: { cor: cor(120, 120, 120), de: 'marca' } };
  const nova = aplicarSugerida(atuais, { papel: 'acento', cor: cor(150, 60, 40) });
  assert.deepStrictEqual(nova.acento, { cor: cor(150, 60, 40), de: 'sugerida' });
  assert.deepStrictEqual(nova.escuro, atuais.escuro, 'os outros papéis ficam');
  assert.strictEqual(atuais.acento.de, 'marca', 'o estado de antes não é mexido');
  assert.strictEqual(aplicarSugerida(atuais, { papel: null, cor: null }), atuais, 'sem cor sugerida, nada muda');
  assert.strictEqual(aplicarSugerida(atuais, { papel: 'acento', cor: 'red' }), atuais);
  // abrir a tela nunca grava: carregar a empresa não chama envio nenhum; a marca só é gravada pelo botão
  const carregar = trechoDaTela(h, 'async function carregarEmpresa(primeira) {');
  assert.ok(!/seletor\.enviar|guardarMarca\(|enviarPedido\(|enviarArquivo\(/.test(carregar), 'carregar não envia nada');
  assert.ok(/primeira === true/.test(carregar) && /aplicarSugerida\(/.test(carregar), 'a cor sugerida só vale na abertura da página');
  assert.strictEqual([...semComentarios(h).matchAll(/seletor\.enviar\('\/api\/marca',/g)].length, 1, 'um só lugar grava a marca');
  assert.ok(/seletor\.enviar\('\/api\/marca',/.test(trechoDaTela(h, 'async function guardarMarca(botoes) {')), 'é o guardarMarca');
  assert.ok(/onclick: \(\) => guardarMarca\(/.test(h), 'pelo clique no botão');
});

t('marca, depois de guardar: com prévias na marca já prontas, o link vai direto para elas; sem prontas, avisa que elas vão demorar; no Personalizar, volta para o estilo', () => {
  const h = ler(MARCA_HTML);
  // eslint-disable-next-line no-new-func
  const textoDepoisDeGuardar = new Function([
    linhaDaTela(h, 'const VER_NA_MARCA = '), linhaDaTela(h, 'const MARCA_GUARDADA = '), linhaDaTela(h, 'const PREVIAS_DEMORAM = '),
    trechoDaTela(h, 'function textoDepoisDeGuardar(modo, naMarca) {'),
  ].join('\n') + '\nreturn textoDepoisDeGuardar;')();
  assert.deepStrictEqual(textoDepoisDeGuardar('marca', true), { texto: 'Pronto. A sua marca foi guardada.', rotulo: 'Ver os estilos na minha marca' });
  assert.deepStrictEqual(textoDepoisDeGuardar('marca', false), { texto: 'Pronto. A sua marca foi guardada. As prévias na sua marca vão demorar um pouco mais.', rotulo: 'Ir para a biblioteca de estilos' });
  assert.deepStrictEqual(textoDepoisDeGuardar('personalizar', true), { texto: 'Pronto. A sua marca foi guardada.', rotulo: 'Voltar para o estilo' });
  assert.deepStrictEqual(textoDepoisDeGuardar('personalizar', false), { texto: 'Pronto. A sua marca foi guardada. As prévias na sua marca vão demorar um pouco mais.', rotulo: 'Voltar para o estilo' });
  // guardarMarca confere o catálogo (naMarca) antes de montar a mensagem, sem abrir uma segunda rota de gravação
  const guardar = trechoDaTela(h, 'async function guardarMarca(botoes) {');
  assert.ok(/seletor\.ler\('\/api\/biblioteca'\)/.test(guardar), 'confere o catálogo depois de guardar');
  assert.ok(/textoDepoisDeGuardar\(tela\.modo, naMarca\)/.test(guardar), 'usa o texto certo na mensagem');
  assert.strictEqual([...semComentarios(h).matchAll(/seletor\.enviar\('\/api\/marca',/g)].length, 1, 'ainda um só lugar grava a marca');
});

t('marca, arquivo: o tamanho é conferido antes do envio, a recusa do servidor aparece como veio e a troca de empresa descarta a resposta', async () => {
  const h = ler(MARCA_HTML);
  const codigo = [linhaDaTela(h, 'const MB = '), linhaDaTela(h, 'const LIMITES = '), trechoDaTela(h, 'function conferirTamanho(tipo, tamanho) {'), trechoDaTela(h, 'async function enviarArquivo(tipo, arquivo) {')].join('\n');
  const enviados = [];
  let resposta = null;
  const seletor = { enviar: async (rota, corpo) => { enviados.push({ rota, corpo }); return resposta; } };
  // eslint-disable-next-line no-new-func
  const { conferirTamanho, enviarArquivo } = new Function('seletor', 'lerComoDados', codigo + '\nreturn { conferirTamanho, enviarArquivo };')(seletor, async () => 'data:image/png;base64,AAAA');
  const MB = 1024 * 1024;
  assert.strictEqual(conferirTamanho('logo', 5 * MB), null);
  assert.ok(/grande demais/.test(conferirTamanho('logo', 5 * MB + 1)) && /5 MB/.test(conferirTamanho('logo', 5 * MB + 1)));
  assert.ok(/10 MB/.test(conferirTamanho('referencia', 10 * MB + 1)) && conferirTamanho('referencia', 10 * MB) === null);
  assert.ok(/30 MB/.test(conferirTamanho('manual', 30 * MB + 1)) && conferirTamanho('fonte', 5 * MB) === null);
  // grande demais: nem sai
  const grande = await enviarArquivo('logo', { size: 6 * MB });
  assert.ok(grande && /grande demais/.test(grande.erro), JSON.stringify(grande));
  assert.strictEqual(enviados.length, 0, 'o arquivo grande não é enviado');
  // a recusa do servidor (413 com a frase do arquivo) aparece como veio
  resposta = { ok: false, status: 413, json: { ok: false, erro: 'Este arquivo é grande demais: o maior aceito é o manual da marca, de 30 MB.', empresa: null } };
  assert.deepStrictEqual(await enviarArquivo('manual', { size: 10 }), { erro: 'Este arquivo é grande demais: o maior aceito é o manual da marca, de 30 MB.' });
  assert.deepStrictEqual(enviados[0], { rota: '/api/arquivo', corpo: { tipo: 'manual', dados: 'data:image/png;base64,AAAA' } }, 'pelo seletor, só tipo e dados');
  resposta = { ok: true, status: 200, json: { ok: true, nome: 'logo-x.png' } };
  assert.deepStrictEqual(await enviarArquivo('logo', { size: 10 }), { nome: 'logo-x.png' });
  resposta = null;
  assert.strictEqual(await enviarArquivo('logo', { size: 10 }), null, 'empresa trocada no meio: nada');
  assert.ok(!/\brede\b/i.test(h), 'nunca fala de rede');
});

t('marca, miniaturas: imagem escolhida só por <img> com o endereço local do arquivo, nunca o desenho dentro da página', () => {
  const h = ler(MARCA_HTML);
  const codigo = semComentarios(h);
  assert.ok(!/<(object|embed|iframe)\b|el\('(object|embed|iframe|svg)'/.test(codigo), 'nenhum objeto, quadro ou desenho embutido');
  assert.ok(/URL\.createObjectURL\(/.test(codigo) && /URL\.revokeObjectURL\(/.test(codigo), 'endereço local do arquivo, devolvido ao sair');
  assert.ok(!/readAsText|\.text\(\)/.test(codigo), 'o arquivo nunca é lido como texto');
  const miniatura = trechoDaTela(h, 'function miniatura(item, rotulo) {');
  assert.ok(/el\('img', \{[^}]*src: item\.url/.test(miniatura), 'a miniatura é um <img>');
  assert.ok(/CoresDoLogo\.deArquivo\(/.test(codigo), 'as cores do logo saem por <img> num canvas (cores-do-logo.js)');
});

t('marca, legibilidade: par difícil de ler vira 2 ou 3 cores que passam e combinam, com prévia; nunca só um aviso', () => {
  const h = ler(MARCA_HTML);
  const codigo = [linhaDaTela(h, 'const PAPEIS = '), trechoDaTela(h, 'function sugestoesPara(cores, papel, fundo, minimo) {'), trechoDaTela(h, 'function problemasDeLeitura(cores, ultimo) {')].join('\n');
  // eslint-disable-next-line no-new-func
  const problemasDeLeitura = new Function('CoresDoLogo', 'LegibilidadeDaMarca', codigo + '\nreturn problemasDeLeitura;')(CoresDoLogo, Legibilidade);
  const boa = { escuro: cor(30, 30, 40), claro: cor(245, 240, 230), acento: cor(200, 80, 40), neutro: cor(130, 125, 120) };
  assert.deepStrictEqual(problemasDeLeitura(boa, null), []);
  assert.deepStrictEqual(problemasDeLeitura({ ...boa, claro: null }, null), [], 'com cor faltando, nada a conferir');
  // o claro quase igual ao escuro: o texto claro sobre o fundo escuro fica difícil de ler
  const ruim = { ...boa, claro: cor(70, 70, 80) };
  const [p] = problemasDeLeitura(ruim, null);
  assert.strictEqual(p.papel, 'claro');
  assert.strictEqual(p.fundo, 'escuro');
  assert.ok(p.contraste < 4.5);
  assert.ok(p.sugestoes.length >= 2 && p.sugestoes.length <= 3, JSON.stringify(p.sugestoes));
  for (const s of p.sugestoes) {
    assert.ok(CoresDoLogo.contraste(s.cor, ruim.escuro) >= 4.5, 'toda sugestão passa: ' + s.cor);
    assert.ok(![ruim.escuro, ruim.acento, ruim.neutro].includes(s.cor), 'nunca a cor de outro papel');
    assert.ok(typeof s.rotulo === 'string' && s.rotulo);
  }
  // a pessoa mexeu no escuro por último: a sugestão é para o escuro
  assert.strictEqual(problemasDeLeitura(ruim, 'escuro')[0].papel, 'escuro');
  // o destaque sem contraste de 3 com nenhum dos dois fundos (o par escuro e claro passa, por pouco)
  const justa = { escuro: cor(55, 55, 55), claro: cor(170, 170, 170), acento: cor(170, 90, 70), neutro: cor(110, 110, 110) };
  assert.ok(CoresDoLogo.contraste(justa.escuro, justa.claro) >= 4.5);
  const acento = problemasDeLeitura(justa, null);
  assert.strictEqual(acento.length, 1, JSON.stringify(acento));
  assert.strictEqual(acento[0].papel, 'acento');
  assert.strictEqual(acento[0].minimo, 3);
  assert.ok(acento[0].sugestoes.length >= 2 && acento[0].sugestoes.every((s) => CoresDoLogo.contraste(s.cor, justa.claro) >= 3), JSON.stringify(acento[0].sugestoes));
  // na tela: a prévia de cada cor e o "Usar esta cor", que só troca a cor no editor (grava só o "Guardar")
  const desenho = trechoDaTela(h, 'function desenharLeitura(alvo) {');
  assert.ok(/'Usar esta cor'/.test(desenho) && /previaDeLeitura\(/.test(desenho), 'cada sugestão com prévia e o botão');
  assert.ok(!/seletor\.enviar/.test(desenho), 'usar a cor não grava sozinho');
});

t('marca, pedidos: cada tipo com o corpo fechado (criar do zero, referências, manual e detalhes do Personalizar)', () => {
  const h = ler(MARCA_HTML);
  // eslint-disable-next-line no-new-func
  const corpoDoPedido = new Function(trechoDaTela(h, 'function corpoDoPedido(tipo, dados) {') + '\nreturn corpoDoPedido;')();
  assert.deepStrictEqual(corpoDoPedido('criar-do-zero', { nota: '  gosto de verde  ', estilo: 'x', anexos: ['a'] }), { tipo: 'criar-do-zero', nota: 'gosto de verde' });
  assert.deepStrictEqual(corpoDoPedido('criar-do-zero', { nota: '   ' }), { tipo: 'criar-do-zero' });
  assert.deepStrictEqual(corpoDoPedido('enviar-referencias', { anexos: ['referencia-1.png'], nota: '' }), { tipo: 'enviar-referencias', anexos: ['referencia-1.png'] });
  assert.deepStrictEqual(corpoDoPedido('ler-manual', { anexos: ['manual-1.pdf'], nota: 'x' }), { tipo: 'ler-manual', anexos: ['manual-1.pdf'] });
  assert.deepStrictEqual(corpoDoPedido('personalizar', { estilo: 'bloco', detalhes: ['alinhamento'], nota: 'mais à esquerda' }), { tipo: 'personalizar', estilo: 'bloco', detalhes: ['alinhamento'], nota: 'mais à esquerda' });
  assert.throws(() => corpoDoPedido('usar-estilo', {}), /tipo/);
  const enviar = trechoDaTela(h, 'async function enviarPedido(tipo, dados) {');
  assert.ok(/seletor\.enviar\('\/api\/pedido', corpoDoPedido\(tipo, dados\)\)/.test(enviar), 'o pedido sai só pelo corpo montado');
  // os três detalhes da lista do pedido "personalizar", e só eles
  const pedidos = require(path.join(RAIZ, '_fabrica', 'core', 'pedidos.js'));
  const detalhes = [...h.matchAll(/\{ valor: '([a-z-]+)', rotulo: /g)].map((m) => m[1]);
  assert.deepStrictEqual(detalhes, pedidos.DETALHES);
  assert.ok(/const LIMITE_RECADO = 500;/.test(h) && /maxlength: String\(LIMITE_RECADO\)/.test(h), 'recado com limite');
  assert.ok(/const MAXIMO_REFERENCIAS = 12;/.test(h), 'até 12 referências');
});

t('marca: trocar de empresa descarta o que não foi guardado, com aviso, e devolve os endereços locais dos arquivos', () => {
  const h = ler(MARCA_HTML);
  assert.ok(/aoTrocar: \(\) => carregarEmpresa\(false\)/.test(h));
  const carregar = trechoDaTela(h, 'async function carregarEmpresa(primeira) {');
  assert.ok(/descartarRascunho\(\)/.test(carregar), 'descarta o rascunho');
  // os detalhes marcados e o recado do Personalizar também contam como rascunho (o aviso aparece)
  assert.ok(/tela\.detalhes\.length > 0/.test(carregar) && /!!tela\.recadoDetalhes/.test(carregar), 'detalhes e recado do Personalizar contam');
  // "Tirar o logo": as cores que vieram dele passam a ser da pessoa (a marca não vai com a origem "logo" sem logo)
  const logo = trechoDaTela(h, 'function desenharLogo() {');
  assert.ok(/texto: 'Tirar o logo', onclick: \(\) => \{[^\n]*de === 'logo'\) tela\.cores\[p\] = \{ cor: tela\.cores\[p\]\.cor, de: 'pessoa' \}/.test(logo), 'as cores do logo viram da pessoa');
  assert.ok(/AVISO_DESCARTE/.test(carregar), 'avisa');
  assert.ok(h.includes('Você trocou de empresa. O que não estava guardado foi descartado.'));
  assert.ok(/URL\.revokeObjectURL\(/.test(trechoDaTela(h, 'function descartarRascunho() {')));
  assert.ok(/:focus-visible \{ outline: 3px solid/.test(h), 'foco visível');
  assert.ok(/@media \(max-width: 640px\)/.test(h), 'tela estreita');
});

t('marca: os caminhos de Estilos (#criar-do-zero, #enviar-referencias) abrem a seção certa; âncora estranha é ignorada', () => {
  const h = ler(MARCA_HTML);
  // eslint-disable-next-line no-new-func
  const ancora = new Function(trechoDaTela(h, 'function ancoraDoEndereco(hash) {') + '\nreturn ancoraDoEndereco;')();
  assert.strictEqual(ancora('#criar-do-zero'), 'zero');
  assert.strictEqual(ancora('#enviar-referencias'), 'referencias');
  for (const ruim of ['', '#', '#outra', '#criar-do-zero?x', '#enviar-referencias/..', '#CRIAR-DO-ZERO', 'criar-do-zero', null, undefined, 5]) assert.strictEqual(ancora(ruim), null, String(ruim));
  assert.ok(/id: 'criar-do-zero'/.test(h) && /id: 'enviar-referencias'/.test(h), 'as duas seções têm os ids que Estilos usa');
  const carregar = trechoDaTela(h, 'async function carregarEmpresa(primeira) {');
  assert.ok(/ancoraDoEndereco\(location\.hash\)/.test(carregar), 'a âncora vale ao abrir');
  assert.ok(/window\.addEventListener\('hashchange'/.test(h), 'e quando o endereço muda');
});

t('marca, Personalizar de um estilo próprio: cores e letras valem, e os detalhes dizem a verdade (o pedido só aceita estilo do catálogo)', () => {
  const h = ler(MARCA_HTML);
  // o pedido "personalizar" recusa estilo próprio (pedidos.js confere o estilo no catálogo): a tela não manda
  assert.ok(/estiloExiste\(r, p\.estilo\)/.test(ler(path.join(RAIZ, '_fabrica', 'core', 'pedidos.js'))), 'contrato de hoje do pedido');
  const detalhes = trechoDaTela(h, 'function secaoDetalhes(estilo) {');
  assert.ok(/if \(estilo\.proprio\)/.test(detalhes), 'ramo do estilo próprio');
  const proprio = detalhes.slice(detalhes.indexOf('if (estilo.proprio)'), detalhes.indexOf('const caixas'));
  assert.ok(proprio.length > 20 && !/enviarPedido\(/.test(proprio), 'estilo próprio não vira pedido "personalizar"');
  assert.ok(h.includes('Os detalhes de um estilo seu são ajustados no Claude'), 'frase honesta');
  const doCatalogo = trechoDaTela(h, 'function estiloDoCatalogo(id, origem) {');
  assert.ok(/tela\.proprios/.test(doCatalogo) && /proprio: !doCatalogo/.test(doCatalogo), 'procura também nos estilos da empresa e marca o próprio');
});

t('marca, Personalizar: com origem=proprio abre o estilo próprio mesmo com um do catálogo de mesmo código; sem origem, o catálogo primeiro', () => {
  const h = ler(MARCA_HTML);
  const tela = {
    estilos: [{ id: 'bloco', nome: 'Bloco', cores: { escuro: '#111111' }, fontes: {} }],
    proprios: [{ id: 'bloco', nome: 'Bloco da Aurora', cores: { escuro: '#222222' }, fontes: {} }, { id: 'horta', nome: 'Horta', cores: {}, fontes: {} }],
  };
  const codigo = ['const PAPEIS = ', 'const PAPEIS_LETRA = ', 'const CODIGO_ESTILO = ', 'const objeto = ', 'const texto = ', 'const limpo = ', 'const corValida = '].map((x) => linhaDaTela(h, x))
    .concat(trechoDaTela(h, 'function estiloDoCatalogo(id, origem) {')).join('\n');
  // eslint-disable-next-line no-new-func
  const doCatalogo = new Function('tela', codigo + '\nreturn estiloDoCatalogo;')(tela);
  assert.strictEqual(doCatalogo('bloco').nome, 'Bloco', 'sem origem: o catálogo primeiro, como hoje');
  assert.strictEqual(doCatalogo('bloco').proprio, false);
  assert.strictEqual(doCatalogo('bloco', 'proprio').nome, 'Bloco da Aurora');
  assert.strictEqual(doCatalogo('bloco', 'proprio').proprio, true);
  assert.strictEqual(doCatalogo('bloco', 'proprio').cores.escuro, '#222222', 'as cores do próprio');
  assert.strictEqual(doCatalogo('bloco', 'catalogo').nome, 'Bloco');
  assert.strictEqual(doCatalogo('horta').nome, 'Horta', 'sem origem, o próprio que só existe na empresa');
  assert.strictEqual(doCatalogo('horta', 'catalogo'), null, 'origem do catálogo: só o catálogo');
  const carregar = trechoDaTela(h, 'async function carregarEmpresa(primeira) {');
  assert.ok(/estiloDoCatalogo\(pedido\.estilo, pedido\.origem\)/.test(carregar), 'a origem do endereço vale ao abrir');
  // a volta para Estilos abre o mesmo estilo: o próprio pela chave dele ("proprio:<id>"), o do catálogo pelo código
  const seletor = { atual: () => 'aurora' };
  // eslint-disable-next-line no-new-func
  const volta = new Function('seletor', trechoDaTela(h, 'function enderecoDoEstilo(e) {') + '\nreturn enderecoDoEstilo;')(seletor);
  assert.strictEqual(volta({ id: 'bloco', proprio: true }), 'estilos.html?empresa=aurora#estilo=proprio%3Abloco');
  assert.strictEqual(volta({ id: 'bloco', proprio: false }), 'estilos.html?empresa=aurora#estilo=bloco');
  assert.ok(!/'#estilo=' \+ encodeURIComponent\((tela\.estiloAberto|e)\.id\)/.test(h), 'nenhum link de volta só com o código');
});

t('marca: nenhum nome de formato de arquivo chega ao usuário, nem nas mensagens que vêm do módulo das cores ou do servidor', () => {
  const h = ler(MARCA_HTML);
  // a tela não repete a mensagem do módulo das cores do logo: usa uma frase dela
  const escolher = trechoDaTela(h, 'async function escolherLogo(arquivo) {');
  assert.ok(!/e\.message/.test(escolher), 'a mensagem do módulo não vai direto para a tela');
  assert.ok(/não vai junto/.test(escolher), 'avisa que o logo que não abriu não vai junto com a marca');
  // as mensagens do módulo (quem mais usar) também não têm nome de formato
  const modulo = semComentarios(ler(path.join(PAINEIS, 'cores-do-logo.js')));
  const doModulo = [...modulo.matchAll(/new Error\(\s*'((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]);
  assert.ok(doModulo.length >= 5, 'achou as mensagens do módulo');
  for (const f of doModulo) assert.ok(!temFormato(f), `cores-do-logo.js: "${f}" usa "${temFormato(f)}"`);
  // as recusas de arquivo do servidor e dos pedidos aparecem como vieram, nas telas Sua marca e Estilos
  const servidor = ler(path.join(PAINEIS, 'servidor.js'));
  const recusas = [...servidor.matchAll(/recusa: '((?:[^'\\\n]|\\.)*)'/g)].map((m) => m[1]);
  assert.strictEqual(recusas.length, 4, 'as quatro recusas dos tipos de arquivo');
  // e todas as outras recusas do servidor (recusa(<status>, '…')): as frases das linhas com recusa(
  const doServidor = semComentarios(servidor).split('\n').filter((l) => /\brecusa\(\s*\d{3}\s*,/.test(l)).flatMap((l) => [...l.matchAll(/'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)].map((m) => (m[1] !== undefined ? m[1] : m[2]))).filter((s) => /^[A-ZÀ-Ú]/.test(s));
  assert.ok(doServidor.length >= 40 && doServidor.some((f) => /grande demais/.test(f)), 'achou as recusas do servidor: ' + doServidor.length);
  recusas.push(...doServidor);
  const pedidosJs = ler(path.join(RAIZ, '_fabrica', 'core', 'pedidos.js'));
  // as mensagens do pedido: as frases das linhas que devolvem erro(...)
  const deErro = pedidosJs.split('\n').filter((l) => /\berro\(/.test(l)).flatMap((l) => [...l.matchAll(/'((?:[^'\\]|\\.)*)'|`([^`]*)`/g)].map((m) => (m[1] !== undefined ? m[1] : m[2]))).filter((s) => /^[A-ZÀ-Ú]/.test(s));
  assert.ok(deErro.length >= 10 && deErro.some((f) => /referências precisam ser imagens/.test(f)), 'achou as mensagens do pedido');
  for (const f of recusas.concat(deErro)) assert.ok(!temFormato(f), `"${f}" usa "${temFormato(f)}"`);
  // no texto da letra, nada de extensão
  assert.ok(!/\.ttf|\.otf/.test(frasesDe(semComentarios(h)).join('\n')), 'nada de extensão de arquivo nas frases');
});

t('marca, letras: "Letra principal" (títulos, legendas e botão) e "Letra dos rótulos"; na prévia só o rótulo pequeno usa a dos rótulos', () => {
  const h = ler(MARCA_HTML);
  assert.ok(/const NOME_LETRA = \{ principal: 'Letra principal', mono: 'Letra dos rótulos', acento: 'Destaque' \};/.test(h), 'nomes dos papéis');
  assert.ok(h.includes('A principal vai nos títulos, nas legendas e nos botões; a dos rótulos, nas etiquetas pequenas em caixa-alta.'), 'explica para que serve cada uma');
  for (const velho of ['Letra dos títulos', 'Letra dos textos', "'Títulos'", "'Textos'", 'dos textos', 'a do texto']) assert.ok(!h.includes(velho), 'texto antigo: ' + velho);
  // a prévia: título, parágrafo e botão na principal; só a etiqueta pequena (kicker) na dos rótulos
  const css = h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
  const fonteDe = (classe) => { const m = new RegExp('\\.' + classe + ' \\{[^}]*font: [^;]*var\\((--q-[a-z-]+)\\)').exec(css); return m && m[1]; };
  assert.strictEqual(fonteDe('q-titulo'), '--q-principal');
  assert.strictEqual(fonteDe('q-texto'), '--q-principal');
  assert.strictEqual(fonteDe('q-botao'), '--q-principal');
  assert.strictEqual(fonteDe('q-kicker'), '--q-rotulo');
  const quadro = trechoDaTela(h, 'function quadroDaMarca(cores, letras, op) {');
  assert.ok(/setProperty\('--q-principal', pilha\(familiaDe\(letras\.principal\)/.test(quadro), 'a principal vem do papel principal');
  assert.ok(/setProperty\('--q-rotulo', pilha\(familiaDe\(letras\.mono\)/.test(quadro), 'a dos rótulos vem do papel mono');
  assert.ok(!/--q-texto'|--q-titulo'/.test(quadro), 'nada das variáveis antigas');
  // os pares prontos: título na principal, e a outra letra mostrada como rótulo (caixa-alta pequena)
  const letras = trechoDaTela(h, 'function desenharLetras() {');
  assert.ok(/classe: 'par-rotulo', texto: FRASE_ROTULO/.test(letras), 'a segunda letra do par aparece como rótulo');
  assert.ok(/tela\.letras\.principal = letraDe\(par\.titulo, 'pessoa'\); tela\.letras\.mono = letraDe\(par\.texto, 'pessoa'\)/.test(letras), 'os pares seguem título → principal e texto → mono');
  assert.ok(/\.par-rotulo \{[^}]*text-transform: uppercase/.test(css), 'o rótulo do par é em caixa-alta');
});

t('familias.json traz os pares prontos (decisão 3 B) e a lista de letras os entrega', () => {
  const j = JSON.parse(ler(path.join(RAIZ, '08-FERRAMENTAS', 'tesseract', 'modelos', 'fontes', 'familias.json')).replace(/^﻿/, ''));
  assert.ok(Array.isArray(j.pares) && j.pares.length >= 6, 'pares prontos no arquivo');
  const { letras, pares } = CoresDoLogo.listaDeLetras(j);
  assert.strictEqual(pares.length, j.pares.length, 'todo par cita letras da lista');
  const classe = new Map(letras.map((l) => [l.familia, l]));
  for (const p of pares) {
    assert.notStrictEqual(p.titulo, p.texto);
    assert.ok(['sem serifa', 'máquina de escrever'].includes(classe.get(p.texto).classificacao), 'o texto é de leitura: ' + p.texto);
    assert.ok(classe.get(p.texto).pesos.some((x) => x <= 500), 'o texto tem peso de texto: ' + p.texto);
  }
});

// ---------- 6. "Trocar a cara da marca" (Tarefa 12, decisão 7 B) e a peça com o estilo ----------
// Cartão fixo no alto do Laboratório e do Cronograma, montado pelo script comum cartao-estilo.js: capa pequena, nome do
// estilo e "Trocar a cara da marca"; sem estilo escolhido, "Escolher um estilo". Leva à biblioteca da empresa do painel.

const CARTAO = path.join(PAINEIS, 'cartao-estilo.js');
const CartaoEstilo = require(CARTAO);
// O corpo de uma função da tela (do cabeçalho até a próxima função do mesmo nível).
const corpoDe = (h, cabeca) => { const i = h.indexOf(cabeca); assert.ok(i >= 0, 'sem ' + cabeca); const resto = h.slice(i + cabeca.length); const fim = resto.search(/\n {2}(async )?function /); return resto.slice(0, fim < 0 ? undefined : fim); };

t('cartão do estilo: Laboratório e Cronograma têm o cartão fixo fora do conteúdo trocado e o script comum', () => {
  for (const tela of ['laboratorio.html', 'cronograma.html']) {
    const h = ler(path.join(PAINEIS, tela));
    assert.ok(/<p class="aviso" id="aviso" role="status" hidden><\/p>\s*<section class="cartao-estilo" id="cartao-estilo" aria-label="Seu estilo" hidden><\/section>\s*<main id="conteudo"/.test(h), `${tela}: o cartão fica entre o aviso e o conteúdo, escondido até haver empresa`);
    assert.ok(/<script src="empresa-seletor\.js"><\/script>\s*<script src="cartao-estilo\.js"><\/script>/.test(h), `${tela}: carrega o script do cartão depois do seletor`);
    // só com empresa: a chamada mora em carregarEmpresa, que só roda com empresa escolhida; sem empresa o cartão some
    assert.ok(/CartaoEstilo\.mostrar\(\$\('cartao-estilo'\), seletor\)/.test(corpoDe(h, 'async function carregarEmpresa() {')), `${tela}: o cartão é montado ao carregar a empresa`);
    const iniciar = corpoDe(h, 'async function iniciar() {');
    assert.ok(!/CartaoEstilo\.mostrar/.test(iniciar), `${tela}: nada de cartão antes de haver empresa`);
    assert.ok(/if \(!s\.atual\) \{[^}]*\$\('cartao-estilo'\)\.hidden = true;/.test(iniciar), `${tela}: sem empresa, o cartão fica escondido`);
    assert.ok(/\.cartao-estilo \{/.test(h), `${tela}: o cartão tem o desenho da tela`);
  }
});

t('cartão do estilo: o script só lê a biblioteca pelo seletor, monta tudo por texto e não usa palavra interna', () => {
  const s = ler(CARTAO);
  const codigo = semComentarios(s);
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|\bimport\s*\(|EventSource|WebSocket|sendBeacon/.test(codigo), 'pedido fora do seletor');
  assert.deepStrictEqual([...codigo.matchAll(/seletor\.(ler|enviar)\(\s*([^,)]*)/g)].map((m) => m[1] + ' ' + m[2].trim()), ['ler ROTA']);
  assert.ok(/const ROTA = '\/api\/biblioteca';/.test(s));
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(codigo), 'nada de HTML montado com dado');
  assert.ok(!/https?:\/\//.test(s) && !/['"`][^'"`\n]*\.json['"`]/.test(s), 'nada de fora nem arquivo .json');
  const texto = semAcento(s).toLowerCase();
  for (const p of PROIBIDAS.concat(['pedido json', 'hex'])) assert.ok(!texto.includes(p), `usa a palavra "${p}"`);
  for (const frase of ['Seu estilo', 'Trocar a cara da marca', 'Escolher um estilo']) assert.ok(s.includes(frase), frase);
});

// DOM de mentira, só o que o cartão usa.
function domFalso() {
  const criar = (tag) => {
    const e = { tag, filhos: [], atributos: {}, className: '', textContent: '', hidden: false,
      setAttribute(k, v) { this.atributos[k] = String(v); }, appendChild(f) { this.filhos.push(f); return f; } };
    Object.defineProperty(e, 'textContent', { get() { return this._t !== undefined ? this._t : this.filhos.map((f) => f.textContent).join(''); }, set(v) { this._t = undefined; this.filhos = []; if (v) this._t = String(v); } });
    return e;
  };
  return { createElement: criar, createTextNode: (t) => ({ textContent: t }) };
}
const todos = (e) => [e].concat((e.filhos || []).flatMap(todos));
const CAT = (atual, extra = {}) => ({
  empresa: 'aurora', atual,
  estilos: [{ id: 'cartilha', nome: 'Cartilha', linha: 'Número grande em círculo, feito para passo a passo.', previas: { capa: '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/cartilha/carrossel-01.webp' }, previasMarca: extra.naMarca ? { capa: '/empresas/aurora/previas/cartilha/carrossel-01.webp' } : null }],
  proprios: [{ id: 'aurora-horta', nome: 'Horta da Aurora', linha: 'Formas orgânicas.', previas: { capa: '/empresas/aurora/previas/proprios/aurora-horta/carrossel-01.webp' }, previasMarca: null, origem: 'proprio' }],
});

t('cartão do estilo: os dados vêm do estilo escolhido (capa na marca quando existe), só da empresa do painel', () => {
  assert.strictEqual(CartaoEstilo.dadosDoCartao(CAT(null), 'aurora'), null);
  assert.deepStrictEqual(CartaoEstilo.dadosDoCartao(CAT({ estilo: 'cartilha', origem: 'catalogo', nome: 'Cartilha' }), 'aurora'),
    { nome: 'Cartilha', linha: 'Número grande em círculo, feito para passo a passo.', capa: '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/cartilha/carrossel-01.webp' });
  assert.strictEqual(CartaoEstilo.dadosDoCartao(CAT({ estilo: 'cartilha', origem: 'catalogo', nome: 'Cartilha' }, { naMarca: true }), 'aurora').capa, '/empresas/aurora/previas/cartilha/carrossel-01.webp');
  assert.deepStrictEqual(CartaoEstilo.dadosDoCartao(CAT({ estilo: 'aurora-horta', origem: 'proprio', nome: 'Horta da Aurora' }), 'aurora'),
    { nome: 'Horta da Aurora', linha: 'Formas orgânicas.', capa: '/empresas/aurora/previas/proprios/aurora-horta/carrossel-01.webp' });
  // estilo próprio fora da lista (sem nome conferido): só "Seu estilo", sem capa
  assert.deepStrictEqual(CartaoEstilo.dadosDoCartao(CAT({ estilo: 'sumiu', origem: 'proprio', nome: null }), 'aurora'), { nome: 'Seu estilo', linha: '', capa: null });
  // endereço de capa de outra empresa, com "..", de fora ou com esquema: sem capa
  for (const ruim of ['/empresas/boreal/previas/cartilha/a.webp', '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/../../x.webp', '//fora/a.webp', 'javascript:alert(1)', '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/a\\b.webp', 42]) {
    const cat = CAT({ estilo: 'cartilha', origem: 'catalogo', nome: 'Cartilha' });
    cat.estilos[0].previas.capa = ruim;
    assert.strictEqual(CartaoEstilo.dadosDoCartao(cat, 'aurora').capa, null, String(ruim));
  }
  // nome e linha chegam numa linha só e com limite
  const cat = CAT({ estilo: 'cartilha', origem: 'catalogo', nome: 'Car\ntilha' });
  cat.estilos[0].linha = 'x'.repeat(400);
  const d = CartaoEstilo.dadosDoCartao(cat, 'aurora');
  assert.strictEqual(d.nome, 'Car tilha');
  assert.ok([...d.linha].length <= 140);
});

t('cartão do estilo: desenha "Trocar a cara da marca" com o estilo e "Escolher um estilo" sem ele, sempre para a biblioteca da empresa', () => {
  const doc = domFalso();
  const alvo = doc.createElement('section');
  CartaoEstilo.desenhar(alvo, { nome: 'Cartilha', linha: 'Linha curta.', capa: '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/cartilha/carrossel-01.webp' }, 'aurora', doc);
  let tudo = todos(alvo);
  const link = tudo.find((e) => e.tag === 'a');
  assert.strictEqual(link.atributos.href, 'estilos.html?empresa=aurora');
  assert.strictEqual(link.textContent, 'Trocar a cara da marca');
  assert.ok(tudo.some((e) => e.textContent === 'Seu estilo') && tudo.some((e) => e.textContent === 'Cartilha') && tudo.some((e) => e.textContent === 'Linha curta.'));
  const img = tudo.find((e) => e.tag === 'img');
  assert.strictEqual(img.atributos.src, '/04-LABORATORIO-DE-DESIGN/biblioteca/previas/cartilha/carrossel-01.webp');
  assert.strictEqual(img.atributos.alt, '');
  assert.strictEqual(alvo.hidden, false);
  // sem estilo
  CartaoEstilo.desenhar(alvo, null, 'boreal estúdio', doc);
  tudo = todos(alvo);
  const convite = tudo.find((e) => e.tag === 'a');
  assert.strictEqual(convite.textContent, 'Escolher um estilo');
  assert.strictEqual(convite.atributos.href, 'estilos.html?empresa=boreal%20est%C3%BAdio');
  assert.ok(!tudo.some((e) => e.tag === 'img'), 'sem estilo, sem capa');
  // sem capa: a inicial do nome no lugar
  CartaoEstilo.desenhar(alvo, { nome: 'Horta da Aurora', linha: '', capa: null }, 'aurora', doc);
  tudo = todos(alvo);
  assert.ok(!tudo.some((e) => e.tag === 'img') && tudo.some((e) => e.textContent === 'H'));
});

t('cartão do estilo: mostrar lê a biblioteca da empresa atual; resposta descartada não desenha; erro mostra o atalho sem afirmar nada', async () => {
  const doc = domFalso();
  const alvo = doc.createElement('section');
  alvo.hidden = true;
  const lidas = [];
  const seletorDe = (resposta, atual = 'aurora') => ({ atual: () => atual, ler: async (rota) => { lidas.push(rota); return resposta; } });
  await CartaoEstilo.mostrar(alvo, seletorDe({ ok: true, json: CAT({ estilo: 'cartilha', origem: 'catalogo', nome: 'Cartilha' }) }), doc);
  assert.deepStrictEqual(lidas, ['/api/biblioteca']);
  assert.strictEqual(alvo.hidden, false);
  assert.ok(todos(alvo).some((e) => e.textContent === 'Trocar a cara da marca'));
  // resposta descartada (a pessoa trocou de empresa): o cartão não muda
  const antes = alvo.filhos;
  await CartaoEstilo.mostrar(alvo, seletorDe(null), doc);
  assert.strictEqual(alvo.filhos, antes);
  // erro do servidor: o atalho continua, sem dizer que não há estilo
  await CartaoEstilo.mostrar(alvo, seletorDe({ ok: false, json: { erro: 'x' } }), doc);
  const tudo = todos(alvo);
  assert.ok(tudo.some((e) => e.textContent === 'Trocar a cara da marca'));
  assert.ok(!tudo.some((e) => /Escolher um estilo|Nenhum estilo/.test(e.textContent)));
  // sem empresa: escondido, nenhum pedido
  lidas.length = 0;
  await CartaoEstilo.mostrar(alvo, seletorDe({ ok: true, json: CAT(null) }, null), doc);
  assert.strictEqual(alvo.hidden, true);
  assert.deepStrictEqual(lidas, []);
});

t('Laboratório: a peça mostra "Feita no estilo X" só com o nome guardado nela, por texto', () => {
  const h = ler(path.join(PAINEIS, 'laboratorio.html'));
  const palco = corpoDe(h, 'function desenharPalco(p, previaPronta) {');
  assert.ok(/'Feita no estilo ' \+/.test(palco), 'frase "Feita no estilo X"');
  assert.ok(/typeof p\.estilo\.nome === 'string'/.test(palco), 'só quando a peça guarda o nome do estilo');
  assert.ok(!/innerHTML/.test(h));
});

// ---------- 7. "+ Novo cliente" no Laboratório e no Cronograma (liberação, decisão do responsável) ----------
// Na pasta de agência ("Meus clientes", para: 'clientes' em /api/caminho), as duas telas mostram um link discreto para o
// Começar no modo cliente novo, com a empresa do painel, e o seletor desde o primeiro cliente (decisão 9 A). Com "Minha
// marca", ou sem resposta, nada muda. Resposta de outra empresa não desenha.

const NOVO_CLIENTE = { 'laboratorio.html': 'async function mostrarComecar(codigo) {', 'cronograma.html': 'async function mostrarNovoCliente(codigo) {' };
// Roda a função da tela com um seletor e uma página de mentira. `resposta`: o que seletor.ler devolve (ou uma função
// que recebe o seletor e devolve); `atualDepois`: a empresa do painel quando a resposta chega.
async function rodarNovoCliente(tela, resposta, op = {}) {
  const h = ler(path.join(PAINEIS, tela));
  const cabeca = NOVO_CLIENTE[tela];
  const nome = /function (\w+)\(/.exec(cabeca)[1];
  const els = {};
  const $ = (id) => (els[id] = els[id] || { id, hidden: op.visivelAntes === true ? false : true, href: '' });
  if (op.visivelAntes) { $('link-novo-cliente').hidden = false; $('link-novo-cliente').href = 'comecar.html?empresa=velha&novo=cliente'; }
  const lidas = [];
  const sempre = [];
  let atual = 'aurora';
  const seletor = {
    atual: () => atual,
    ler: async (rota) => {
      lidas.push(rota);
      if (op.lerFalha) throw new Error('sem servidor');
      if (op.atualDepois) atual = op.atualDepois;
      return resposta;
    },
    mostrarSempre: (v) => sempre.push(v),
  };
  // eslint-disable-next-line no-new-func
  const fn = new Function('seletor', '$', trechoDaTela(h, cabeca) + '\nreturn ' + nome + ';')(seletor, $);
  await fn('aurora');
  return { link: $('link-novo-cliente'), comecar: els['link-comecar'], lidas, sempre };
}
const caminhoCom = (json) => ({ ok: true, status: 200, json: Object.assign({ empresa: 'aurora', intencao: { tudo: true }, marca: { definida: true, origem: 'tela' }, estilo: null, pendentes: 0, passo: 'biblioteca' }, json) });

t('+ Novo cliente: as duas telas têm o link discreto escondido, lido ao carregar a empresa', () => {
  for (const tela of Object.keys(NOVO_CLIENTE)) {
    const h = ler(path.join(PAINEIS, tela));
    assert.ok(/<a id="link-novo-cliente" href="comecar\.html\?novo=cliente" class="link-discreto" hidden>\+ Novo cliente<\/a>/.test(h), `${tela}: o link no alto, escondido`);
    assert.ok(/\.topo-acoes a\.link-discreto \{/.test(h), `${tela}: o link tem o desenho discreto`);
    const nome = /function (\w+)\(/.exec(NOVO_CLIENTE[tela])[1];
    assert.ok(new RegExp(nome + '\\(codigo\\);').test(trechoDaTela(h, 'async function carregarEmpresa() {')), `${tela}: lido ao carregar a empresa`);
    const corpo = trechoDaTela(h, NOVO_CLIENTE[tela]);
    assert.ok(/seletor\.ler\('\/api\/caminho'\)/.test(corpo), `${tela}: pelo seletor`);
    assert.ok(!/innerHTML/.test(corpo));
  }
});

t('+ Novo cliente: aparece só na pasta de agência (para: clientes), com o seletor desde o primeiro cliente', async () => {
  for (const tela of Object.keys(NOVO_CLIENTE)) {
    const agencia = await rodarNovoCliente(tela, caminhoCom({ para: 'clientes' }));
    assert.deepStrictEqual(agencia.lidas, ['/api/caminho'], `${tela}: lê só o caminho`);
    assert.strictEqual(agencia.link.hidden, false, `${tela}: aparece com "Meus clientes"`);
    assert.strictEqual(agencia.link.href, 'comecar.html?empresa=aurora&novo=cliente', `${tela}: leva ao Começar no modo cliente novo, com a empresa do painel`);
    assert.deepStrictEqual(agencia.sempre, [true], `${tela}: o seletor aparece desde o primeiro cliente (decisão 9 A)`);
    for (const [caso, resposta] of [['Minha marca', caminhoCom({ para: 'minha-marca' })], ['sem resposta de para quem é', caminhoCom({ para: null })]]) {
      const r = await rodarNovoCliente(tela, resposta, { visivelAntes: true });
      assert.strictEqual(r.link.hidden, true, `${tela}, ${caso}: não aparece`);
      assert.ok(!r.sempre.includes(true), `${tela}, ${caso}: o seletor segue como era`);
    }
    const marca = await rodarNovoCliente(tela, caminhoCom({ para: 'minha-marca' }));
    assert.deepStrictEqual(marca.sempre, [], `${tela}, Minha marca: nada muda no seletor`);
  }
});

t('+ Novo cliente: resposta de outra empresa, descartada, com erro ou sem servidor não desenha', async () => {
  for (const tela of Object.keys(NOVO_CLIENTE)) {
    const casos = [
      ['a pessoa trocou de empresa no meio', await rodarNovoCliente(tela, caminhoCom({ para: 'clientes' }), { atualDepois: 'boreal', visivelAntes: true })],
      ['resposta descartada pelo seletor (de outra empresa)', await rodarNovoCliente(tela, null, { visivelAntes: true })],
      ['o servidor recusou', await rodarNovoCliente(tela, { ok: false, status: 400, json: { ok: false, erro: 'x', para: 'clientes' } }, { visivelAntes: true })],
      ['sem servidor', await rodarNovoCliente(tela, null, { lerFalha: true, visivelAntes: true })],
    ];
    for (const [caso, r] of casos) {
      assert.strictEqual(r.link.hidden, true, `${tela}, ${caso}: o link some e não volta`);
      assert.deepStrictEqual(r.sempre, [], `${tela}, ${caso}: o seletor não muda`);
    }
  }
});

t('+ Novo cliente: no Laboratório, a mesma leitura do caminho segue mostrando "Começar o caminho" só enquanto falta a intenção', async () => {
  const falta = await rodarNovoCliente('laboratorio.html', caminhoCom({ para: 'clientes', passo: 'o-que', intencao: null }));
  assert.deepStrictEqual(falta.lidas, ['/api/caminho'], 'uma leitura só para os dois links');
  assert.strictEqual(falta.comecar.hidden, false);
  assert.strictEqual(falta.comecar.href, 'comecar.html?empresa=aurora');
  assert.strictEqual(falta.link.hidden, false);
  const pronta = await rodarNovoCliente('laboratorio.html', caminhoCom({ para: 'clientes' }));
  assert.strictEqual(pronta.comecar.hidden, true);
});

t('+ Novo cliente: o endereço do link abre o Começar na empresa do painel e no modo cliente novo', async () => {
  const h = ler(path.join(PAINEIS, 'comecar.html'));
  // o Começar lê o modo do endereço e só abre o cliente novo numa pasta de agência
  assert.ok(/carregarEmpresa\(new URLSearchParams\(location\.search\)\.get\('novo'\) === 'cliente'\);/.test(h));
  assert.ok(/if \(novoCliente && tela\.para === 'clientes'\) abrirNovoCliente\(\);/.test(h));
  const endereco = 'http://localhost:8890/_fabrica/paineis/comecar.html?empresa=boreal&novo=cliente';
  assert.strictEqual(new URL(endereco).searchParams.get('novo'), 'cliente');
  // o seletor do Começar fica na mesma empresa do painel de onde veio o clique (não na guardada nem na do agente)
  const { s } = novo(TRES, { endereco, guardada: 'cedro' });
  assert.strictEqual((await s.carregar()).atual, 'boreal');
});

// ---------- execução ----------

(async () => {
  for (const c of casos) {
    try { await c.fn(); console.log('ok   ' + c.nome); } catch (e) { falhas++; console.log('FALHOU ' + c.nome + '\n     ' + (e.stack || e)); }
  }
  if (falhas) { console.log(`\n${falhas} teste(s) falharam`); process.exit(1); }
  console.log('\ntodos os testes passaram');
  process.exit(0);
})();
