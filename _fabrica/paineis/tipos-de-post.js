// Os tipos de post do Cronograma (Reels, Carrossel, Stories, WhatsApp, Anúncio, Vídeo longo, Post, Artigo e Outro), cada
// um com a cor, o ícone e o nome fixos. Iguais para toda empresa e independentes das cores da marca, para o tipo ser
// reconhecido de relance no calendário. Usado pela tela do Cronograma (no navegador), pelo envio ao cliente, por dados.js
// (o campo opcional `tipo` do post) e pelos testes (no Node). Não toca na página: só devolve dados e texto.
//
// O tipo de um post: o campo `tipo` (um de TIPOS_ESCOLHIDOS), quando o post o traz; senão, a leitura de `platformLabel`
// e `platform`, nesta ordem de procura: anúncio, stories, whats/zap/grupo, reels/shorts/tiktok, carrossel, vídeo
// longo/youtube/yt, blog/artigo, insta/linkedin/post/imagem; nada disso: Outro.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.TiposDePost = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // cor: a borda e o quadrado de cor da legenda; fundo: o fundo suave do cartão; tinta: o nome do tipo escrito sobre o fundo
  // (escura o bastante para ler bem).
  const TIPOS = [
    { chave: 'reels', nome: 'Reels', icone: '🎬', cor: '#E8590C', fundo: '#FFF0E6', tinta: '#A33F06' },
    { chave: 'carrossel', nome: 'Carrossel', icone: '🖼️', cor: '#1C7ED6', fundo: '#E7F1FC', tinta: '#145A99' },
    { chave: 'stories', nome: 'Stories', icone: '⭕', cor: '#F2B705', fundo: '#FFF8DB', tinta: '#7A5C00' },
    { chave: 'whats', nome: 'WhatsApp', icone: '💬', cor: '#2F9E44', fundo: '#E9F7EC', tinta: '#1F6E2F' },
    { chave: 'anuncio', nome: 'Anúncio', icone: '📣', cor: '#7048E8', fundo: '#F0ECFD', tinta: '#5233B8' },
    { chave: 'longo', nome: 'Vídeo longo', icone: '▶️', cor: '#1F2328', fundo: '#ECEDEF', tinta: '#1F2328' },
    { chave: 'post', nome: 'Post', icone: '📌', cor: '#D6336C', fundo: '#FCEBF1', tinta: '#A1214F' },
    { chave: 'artigo', nome: 'Artigo', icone: '📝', cor: '#0CA5A0', fundo: '#E3F7F6', tinta: '#08736F' },
    { chave: 'outro', nome: 'Outro', icone: '📄', cor: '#868E96', fundo: '#F1F3F5', tinta: '#495057' },
  ];
  // O texto do título e das marcas no cartão: escuro fixo, porque o fundo do cartão também é fixo.
  const TEXTO_DO_CARTAO = '#1F2328';
  // Os valores aceitos no campo `tipo` do post ("outro" não se escolhe: é o que sobra).
  const TIPOS_ESCOLHIDOS = ['reels', 'carrossel', 'stories', 'whats', 'anuncio', 'longo', 'post', 'artigo'];

  // A ordem importa: "YouTube · Shorts" é Reels (shorts vem antes de youtube), "Instagram · Carrossel" é Carrossel.
  const LEITURA = [
    ['anuncio', /\banuncio|\bads\b/],
    ['stories', /\bstor(y|ies)\b/],
    ['whats', /whats|\bzap\b|\bgrupo\b/],
    ['reels', /\breels?\b|\bshorts?\b|tik ?tok/],
    ['carrossel', /carrossel|carousel/],
    ['longo', /video longo|youtube|\byt\b/],
    ['artigo', /\bblog\b|artigo/],
    ['post', /insta|linkedin|\bpost\b|imagem/],
  ];

  const POR_CHAVE = {};
  TIPOS.forEach((t) => { POR_CHAVE[t.chave] = t; });

  const simples = (v) => (typeof v === 'string' ? v : '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // O tipo do post: { chave, nome, icone, cor, fundo, tinta }.
  function tipoDoPost(post) {
    const p = post && typeof post === 'object' ? post : {};
    if (typeof p.tipo === 'string' && TIPOS_ESCOLHIDOS.includes(p.tipo)) return POR_CHAVE[p.tipo];
    const lido = simples(p.platformLabel) + ' ' + simples(p.platform);
    const achado = LEITURA.find(([, re]) => re.test(lido));
    return POR_CHAVE[achado ? achado[0] : 'outro'];
  }

  // As regras de CSS das cores de cada tipo (.tipo-reels { --tipo-cor: ...; --tipo-fundo: ...; --tipo-tinta: ...;
  // --tipo-texto: ... }), uma por tipo: a tela e o arquivo do cliente usam as mesmas.
  function cssDosTipos() {
    return TIPOS.map((t) => '.tipo-' + t.chave + ' { --tipo-cor: ' + t.cor + '; --tipo-fundo: ' + t.fundo + '; --tipo-tinta: ' + t.tinta
      + '; --tipo-texto: ' + TEXTO_DO_CARTAO + '; }');
  }

  return { TIPOS, TIPOS_ESCOLHIDOS, TEXTO_DO_CARTAO, tipoDoPost, cssDosTipos };
});
