// Roteiro do post em campos separados (regra R-13, 05-ESTRATEGIA/nucleo-de-conteudo/regras/10-cronograma.md).
// Usado pela tela do Cronograma (no navegador) e pelos testes (no Node). Não toca na página: só monta textos.
//
// Peça de vídeo abre em quatro campos, cada um copiado inteiro com um clique: roteiro falado, descrição visual,
// roteiro com descrição visual (o texto para colar no agente de edição) e legenda. Peça sem fala (post, carrossel)
// abre com o roteiro ou a estrutura e a legenda.
//
// A fonte é uma só por cena (F-51): `post.cenas` = [{ tempo, nome, fala, visual: [{ t, quando, desc }] }] (mais
// `cabecalho` e `geral`, opcionais). Sem `cenas`, as cenas saem do campo `script`, nos dois formatos usados:
//   0:00–0:03 Gancho: fala                    [0:00–0:05] GANCHO:
//   Na tela: o que aparece                    "fala"
//                                             Na tela: o que aparece
// As linhas antes da primeira cena (título, capa) viram o cabeçalho. A parte "Legenda:" do script fica de fora: a
// legenda que vale é a do post (`caption`), que pode ter sido revisada depois do roteiro.
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.RoteiroVideo = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RE_TEMPO = /^\[?(\d{1,2}:\d{2})(?:\s*[–—-]\s*(\d{1,2}:\d{2}))?\]?\s*(.*)$/;
  const RE_ROTULO_SO = /^[^a-zà-ÿ]+:$/; // "GANCHO:" sozinho na linha (formato antigo)
  const RE_NOME = /^([A-ZÀ-Ý][^:.!?"“”]{0,28}):\s+(\S.*)$/; // "Gancho: fala", "Valor 1: fala", "Fim fixo: fala"
  const RE_LEGENDA = /^legenda\b[^:]*:\s*$/i; // "Legenda:" ou "Legenda (com a regra do grupo aplicada):"
  const RE_NA_TELA = /^na tela:\s*/i;

  const texto = (v) => (typeof v === 'string' ? v : '');

  // O script sem a parte "Legenda:" do fim (e sem espaços sobrando).
  function semLegenda(script) {
    const linhas = texto(script).replace(/\r\n?/g, '\n').split('\n');
    const i = linhas.findIndex((l) => RE_LEGENDA.test(l.trim()));
    return (i >= 0 ? linhas.slice(0, i) : linhas).join('\n').trim();
  }

  // Cenas a partir do script. Devolve { cabecalho, cenas }; sem nenhuma linha com tempo, cenas = [].
  function derivarCenas(script) {
    const cenas = [];
    const antes = [];
    let atual = null;
    semLegenda(script).split('\n').forEach((linha) => {
      const t = linha.trim();
      const m = RE_TEMPO.exec(t);
      // linha de cena: "[0:00–0:05] ...", "0:00–0:03 ..." ou "0:05 ..." (o tempo sozinho, ou seguido de espaço)
      if (m && (t.startsWith('[') || m[2] || m[3] === '' || /^\d{1,2}:\d{2}\s/.test(t))) {
        atual = { tempo: m[2] ? m[1] + '–' + m[2] : m[1], inicio: m[1], nome: '', fala: [], visual: [] };
        cenas.push(atual);
        let resto = m[3].trim();
        if (resto && RE_ROTULO_SO.test(resto)) { atual.nome = resto.replace(/:$/, '').trim(); resto = ''; }
        const n = RE_NOME.exec(resto);
        if (n && n[1].trim().split(/\s+/).length <= 3) { atual.nome = n[1].trim(); resto = n[2].trim(); }
        if (resto) atual.fala.push(resto.replace(/^["“](.*)["”]$/, '$1'));
        return;
      }
      if (!t) return;
      if (!atual) { antes.push(t); return; }
      if (RE_NA_TELA.test(t)) { atual.visual.push(t.replace(RE_NA_TELA, '')); return; }
      atual.fala.push(t.replace(/^["“](.*)["”]$/, '$1'));
    });
    return {
      cabecalho: antes.join('\n'),
      cenas: cenas.filter((c) => c.fala.length || c.visual.length).map((c) => {
        const fala = c.fala.join(' ');
        const palavras = fala.split(/\s+/).filter(Boolean);
        const gatilho = fala ? 'ao dizer "' + palavras.slice(0, 6).join(' ').replace(/[.,;:!?]+$/, '') + (palavras.length > 6 ? '…' : '') + '"' : 'no início da cena';
        return { tempo: c.tempo, nome: c.nome, fala, visual: c.visual.map((d) => ({ t: c.inicio, quando: gatilho, desc: d })) };
      }),
    };
  }

  // As cenas do post: as gravadas em `cenas` ou as derivadas do script.
  function cenasDoPost(post) {
    const p = post || {};
    if (Array.isArray(p.cenas) && p.cenas.length) {
      const cenas = p.cenas.filter((c) => c && typeof c === 'object').map((c) => ({
        tempo: texto(c.tempo), nome: texto(c.nome), fala: texto(c.fala),
        visual: (Array.isArray(c.visual) ? c.visual : []).filter((v) => v && typeof v === 'object')
          .map((v) => ({ t: texto(v.t), quando: texto(v.quando), desc: texto(v.desc) })),
      }));
      return { cabecalho: texto(p.cabecalho), cenas };
    }
    return derivarCenas(p.script);
  }

  const linhaVisual = (v) => (v.t ? '[' + v.t + '] ' : '') + (v.quando ? v.quando + ' → ' : '') + v.desc;

  function montarFala(cenas) {
    return cenas.filter((c) => c.fala).map((c) => c.fala).join('\n\n');
  }

  function montarVisual(cenas, geral) {
    const blocos = cenas.filter((c) => c.visual && c.visual.length).map((c) =>
      (c.nome ? c.nome + ' · ' : '') + c.tempo + '\n' + c.visual.map(linhaVisual).join('\n'));
    if (geral) blocos.unshift('EM TODO O VÍDEO\n' + geral);
    return blocos.join('\n\n');
  }

  function montarJunto(cenas, cabecalho, geral) {
    const blocos = cenas.map((c) => {
      const titulo = '[' + c.tempo + ']' + (c.nome ? ' ' + c.nome : '');
      const fala = c.fala ? '\nFALA:\n' + c.fala : '';
      const visual = c.visual && c.visual.length ? '\nVISUAL:\n' + c.visual.map(linhaVisual).join('\n') : '';
      return titulo + fala + visual;
    });
    if (geral) blocos.unshift('EM TODO O VÍDEO\n' + geral);
    if (cabecalho) blocos.unshift(cabecalho);
    return blocos.join('\n\n');
  }

  // É peça de vídeo? Tem cenas (gravadas ou no script), ou é Reels/vídeo pela rede ou pelo tipo da arte.
  function ehVideo(post, cenas) {
    const p = post || {};
    if ((cenas || cenasDoPost(p).cenas).length) return true;
    return /reels|v[ií]deo|stories|shorts|youtube/i.test(texto(p.platformLabel)) || p.platform === 'yt';
  }

  // Os campos do post, na ordem em que a tela mostra: [{ chave, rotulo, texto, ajuda? }]. Campo sem texto não entra.
  function camposDoPost(post) {
    const p = post || {};
    const { cabecalho, cenas } = cenasDoPost(p);
    const legenda = { chave: 'legenda', rotulo: 'Legenda', texto: texto(p.caption).trim() };
    const campos = [];
    if (cenas.length) {
      const geral = texto(p.geral).trim();
      campos.push(
        { chave: 'fala', rotulo: 'Roteiro falado', texto: montarFala(cenas), ajuda: 'Só o que será dito, para gravar.' },
        { chave: 'visual', rotulo: 'Descrição visual', texto: montarVisual(cenas, geral) || 'Este roteiro ainda não tem a descrição do que aparece na tela.', ajuda: 'Animações, textos na tela, B-rolls e gráficos, com o tempo e a frase que dispara cada um.' },
        { chave: 'junto', rotulo: 'Roteiro com descrição visual', texto: montarJunto(cenas, cabecalho, geral), ajuda: 'Fala e tela juntas, cena por cena: é o texto para colar no agente de edição do vídeo.' },
      );
    } else {
      const estrutura = semLegenda(p.script);
      if (estrutura) campos.push({ chave: 'roteiro', rotulo: 'Roteiro e estrutura', texto: estrutura });
    }
    if (legenda.texto) campos.push(legenda);
    return campos.filter((c) => c.texto);
  }

  return { semLegenda, derivarCenas, cenasDoPost, montarFala, montarVisual, montarJunto, ehVideo, camposDoPost };
});
