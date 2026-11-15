// O visualizador do arquivo do cliente (o cronograma gerado por enviar-cliente.js). Vai dentro do arquivo, sempre
// igual, sem nenhum dado: ele só lê as imagens e os vídeos que já estão na página. Não busca nada fora do arquivo.
// Faz: liga os botões "Calendário | Lista" (o calendário abre primeiro), abre a janela do post ao clicar no cartão do
// calendário (com a barra de baixar no alto), abre a imagem em tamanho grande por cima dela (setas, teclado,
// miniaturas), baixa a imagem, o vídeo ou todas as imagens de uma arte num .zip (com a legenda) e copia a legenda.
// Sem ele (navegador que bloqueia), o calendário e a lista aparecem juntos, o cartão leva ao post na lista e as artes
// continuam visíveis: os botões de baixar e copiar é que não aparecem.
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  const $$ = (sel, base) => Array.prototype.slice.call((base || document).querySelectorAll(sel));
  const criar = (tag, classe, texto) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };

  function bytesDe(dataUrl) {
    const virgula = dataUrl.indexOf(',');
    const bin = atob(dataUrl.slice(virgula + 1));
    const saida = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) saida[i] = bin.charCodeAt(i);
    return saida;
  }
  function baixar(href, nome) {
    const a = criar('a');
    a.href = href;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---- as janelas (a do post e a da imagem grande) ----
  // Com <dialog>, a que abre por último fica por cima, e o Esc fecha só ela. Navegador sem <dialog>: a janela é só
  // mostrada (atributo open) e o Esc é tratado aqui.
  const temJanela = typeof document.createElement('dialog').showModal === 'function';
  const aberta = (d) => d.hasAttribute('open');
  function abrirJanela(d) {
    if (aberta(d)) return;
    if (temJanela) d.showModal();
    else d.setAttribute('open', '');
  }
  function fecharJanela(d) {
    if (!aberta(d)) return;
    if (temJanela) { d.close(); return; }
    d.removeAttribute('open');
    d.dispatchEvent(new Event('close'));
  }

  // O aviso aparece dentro da janela aberta (fora dela, ficaria por baixo).
  let tempoAviso = null;
  function aviso(texto) {
    let r = document.getElementById('aviso-cliente');
    if (!r) { r = criar('div', 'aviso-cliente'); r.id = 'aviso-cliente'; r.setAttribute('role', 'status'); }
    const abertas = $$('dialog[open]');
    const dono = abertas.length ? abertas[abertas.length - 1] : document.body;
    if (r.parentNode !== dono) dono.appendChild(r);
    r.textContent = texto;
    r.hidden = false;
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(() => { r.hidden = true; }, 5000);
  }

  function copiarLegenda(p) {
    const texto = p.innerText;
    const feito = () => aviso('Legenda copiada.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(feito, () => aviso('Selecione a legenda e copie à mão.'));
    else aviso('Selecione a legenda e copie à mão.');
  }

  // ---- visualizador ----
  const visor = criar('dialog', 'visor');
  visor.setAttribute('aria-label', 'Arte em tamanho grande');
  document.body.appendChild(visor);
  const estado = { arte: null, i: 0, voltar: null };

  function imagensDa(arte) { return $$('.miniatura img', arte); }
  function fechar() { fecharJanela(visor); }
  visor.addEventListener('close', () => {
    visor.textContent = '';
    document.body.classList.remove('visor-aberto');
    if (estado.voltar && estado.voltar.isConnected) estado.voltar.focus();
  });
  function abrir(arte, i, quem) {
    estado.arte = arte; estado.i = i; estado.voltar = quem || null;
    desenhar();
    abrirJanela(visor);
    document.body.classList.add('visor-aberto');
    const f = visor.querySelector('.visor-fechar');
    if (f) f.focus();
  }
  function ir(passo) {
    const total = imagensDa(estado.arte).length;
    const novo = estado.i + passo;
    if (novo < 0 || novo >= total) return;
    estado.i = novo;
    desenhar();
  }
  function desenhar() {
    const arte = estado.arte;
    const imgs = imagensDa(arte);
    const img = imgs[estado.i];
    const total = imgs.length;
    visor.textContent = '';
    const cab = criar('div', 'visor-cabeca');
    const tit = criar('div', 'visor-titulo');
    tit.appendChild(criar('strong', '', arte.getAttribute('data-titulo') || ''));
    tit.appendChild(criar('span', '', total > 1 ? 'Imagem ' + (estado.i + 1) + ' de ' + total : 'Imagem'));
    const fechar1 = criar('button', 'visor-fechar', '×');
    fechar1.type = 'button';
    fechar1.setAttribute('aria-label', 'Fechar');
    fechar1.addEventListener('click', fechar);
    cab.appendChild(tit);
    cab.appendChild(fechar1);
    const palco = criar('div', 'visor-palco');
    const grande = criar('img');
    grande.src = img.src;
    grande.alt = img.alt;
    palco.appendChild(grande);
    if (total > 1) {
      const antes = criar('button', 'visor-seta antes', '‹');
      antes.type = 'button'; antes.setAttribute('aria-label', 'Anterior'); antes.disabled = estado.i === 0;
      antes.addEventListener('click', () => ir(-1));
      const depois = criar('button', 'visor-seta depois', '›');
      depois.type = 'button'; depois.setAttribute('aria-label', 'Próxima'); depois.disabled = estado.i === total - 1;
      depois.addEventListener('click', () => ir(1));
      palco.appendChild(antes);
      palco.appendChild(depois);
    }
    const rodape = criar('div', 'visor-rodape');
    const trilho = criar('div', 'visor-trilho');
    if (total > 1) {
      imgs.forEach((x, k) => {
        const b = criar('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Imagem ' + (k + 1));
        b.setAttribute('aria-current', k === estado.i ? 'true' : 'false');
        const m = criar('img');
        m.src = x.src; m.alt = '';
        b.appendChild(m);
        b.addEventListener('click', () => { estado.i = k; desenhar(); });
        trilho.appendChild(b);
      });
    }
    const acoes = criar('div', 'visor-acoes');
    const um = criar('button', 'botao principal', total > 1 ? 'Baixar esta imagem' : 'Baixar a imagem');
    um.type = 'button';
    um.addEventListener('click', () => baixar(img.src, img.getAttribute('data-nome') || 'arte.png'));
    acoes.appendChild(um);
    if (total > 1) {
      const todas = criar('button', 'botao', 'Baixar todas (ZIP)');
      todas.type = 'button';
      todas.addEventListener('click', () => baixarTodas(arte));
      acoes.appendChild(todas);
    }
    rodape.appendChild(trilho);
    rodape.appendChild(acoes);
    visor.appendChild(cab);
    visor.appendChild(palco);
    visor.appendChild(rodape);
    const atual = trilho.querySelector('[aria-current="true"]');
    if (atual && atual.scrollIntoView) atual.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  visor.addEventListener('click', (e) => { if (e.target === visor) fechar(); });

  function baixarTodas(arte) {
    try {
      const arquivos = imagensDa(arte).map((img) => ({ nome: img.getAttribute('data-nome') || 'arte.png', dados: bytesDe(img.src) }));
      const post = arte.closest('.post');
      const legenda = post && post.querySelector('.legenda');
      if (legenda) arquivos.push({ nome: 'legenda.txt', dados: new TextEncoder().encode(legenda.innerText.replace(/\r?\n/g, '\r\n') + '\r\n') });
      const url = URL.createObjectURL(new Blob([ZipSimples.montar(arquivos)], { type: 'application/zip' }));
      baixar(url, (arte.getAttribute('data-base') || 'artes') + '.zip');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      aviso('Não consegui montar o ZIP. Abra cada imagem e baixe uma a uma.');
    }
  }

  // ---- a janela do post: clicar no cartão do calendário abre tudo do post ----
  // O próprio post da lista vai para dentro da janela (e volta para o lugar dele ao fechar): a arte, a legenda e os
  // botões Aprovar e Pedir ajuste continuam os mesmos, sem cópia. No alto, a barra fixa com "Baixar tudo (.zip)" (um
  // por arte quando o post tem mais de uma), "Baixar o vídeo", "Copiar a legenda" (post sem arte) e "Fechar".
  const janela = criar('dialog', 'detalhe');
  janela.setAttribute('aria-labelledby', 'detalhe-titulo');
  document.body.appendChild(janela);
  const noDetalhe = { post: null, lugar: null, voltar: null };

  function botaoEm(onde, texto, fn, principal) {
    const b = criar('button', 'botao' + (principal ? ' principal' : ''), texto);
    b.type = 'button';
    b.addEventListener('click', fn);
    onde.appendChild(b);
  }
  function devolverPost() {
    if (noDetalhe.post && noDetalhe.lugar && noDetalhe.lugar.parentNode) {
      noDetalhe.lugar.parentNode.insertBefore(noDetalhe.post, noDetalhe.lugar);
      noDetalhe.lugar.parentNode.removeChild(noDetalhe.lugar);
    }
    noDetalhe.post = null;
    noDetalhe.lugar = null;
  }
  function fecharDetalhe() { fecharJanela(janela); }
  janela.addEventListener('close', () => {
    devolverPost();
    janela.textContent = '';
    if (noDetalhe.voltar && noDetalhe.voltar.isConnected) noDetalhe.voltar.focus();
  });
  janela.addEventListener('click', (e) => { if (e.target === janela) fecharDetalhe(); }); // clique fora fecha

  function abrirDetalhe(post, quem) {
    devolverPost();
    noDetalhe.post = post;
    noDetalhe.voltar = quem || null;
    noDetalhe.lugar = document.createComment('post');
    post.parentNode.insertBefore(noDetalhe.lugar, post);
    const tipo = /\btipo-[a-z]+\b/.exec(post.className);
    janela.className = 'detalhe' + (tipo ? ' ' + tipo[0] : '');
    janela.textContent = '';
    const caixa = criar('div', 'detalhe-caixa');
    const barra = criar('header', 'detalhe-barra');
    const cabeca = criar('div', 'detalhe-cabeca');
    const quando = criar('p', 'detalhe-quando');
    const etiqueta = post.querySelector('.etiqueta-tipo');
    if (etiqueta) quando.appendChild(etiqueta.cloneNode(true));
    quando.appendChild(criar('span', '', post.getAttribute('data-quando') || ''));
    const h3 = post.querySelector('h3');
    const titulo = criar('h2', '', h3 ? h3.textContent : '');
    titulo.id = 'detalhe-titulo';
    cabeca.appendChild(quando);
    cabeca.appendChild(titulo);
    const acoes = criar('div', 'detalhe-acoes');
    const artes = $$('.arte', post).filter((a) => imagensDa(a).length || a.querySelector('video'));
    const varias = artes.length > 1;
    artes.forEach((arte, k) => {
      const imgs = imagensDa(arte);
      const video = arte.querySelector('video');
      if (imgs.length) botaoEm(acoes, varias ? '⬇️ Baixar a arte ' + (k + 1) + ' (.zip)' : '⬇️ Baixar tudo (.zip)', () => baixarTodas(arte), true);
      if (video) botaoEm(acoes, varias ? '⬇️ Baixar o vídeo da arte ' + (k + 1) : '⬇️ Baixar o vídeo', () => baixar(video.src, video.getAttribute('data-nome') || 'video.mp4'), !imgs.length);
    });
    const legenda = post.querySelector('.legenda');
    if (!artes.length && legenda) botaoEm(acoes, 'Copiar a legenda', () => copiarLegenda(legenda), true);
    botaoEm(acoes, 'Fechar', fecharDetalhe, false);
    barra.appendChild(cabeca);
    barra.appendChild(acoes);
    const corpo = criar('div', 'detalhe-corpo');
    corpo.appendChild(post);
    caixa.appendChild(barra);
    caixa.appendChild(corpo);
    janela.appendChild(caixa);
    abrirJanela(janela);
  }

  document.addEventListener('keydown', (e) => {
    if (aberta(visor)) {
      if (e.key === 'Escape' && !temJanela) fechar();
      else if (e.key === 'ArrowLeft') ir(-1);
      else if (e.key === 'ArrowRight') ir(1);
      return;
    }
    if (e.key === 'Escape' && !temJanela && aberta(janela)) fecharDetalhe();
  });

  // ---- os botões de cada arte e de cada legenda (só aparecem com o visualizador funcionando) ----
  $$('.arte').forEach((arte) => {
    const imgs = imagensDa(arte);
    $$('.miniatura', arte).forEach((b, i) => b.addEventListener('click', () => abrir(arte, i, b)));
    const acoes = arte.querySelector('.arte-acoes');
    if (!acoes) return;
    const video = arte.querySelector('video');
    if (video) botaoEm(acoes, 'Baixar o vídeo', () => baixar(video.src, video.getAttribute('data-nome') || 'video.mp4'), true);
    if (imgs.length) botaoEm(acoes, 'Ver em tamanho grande', () => abrir(arte, 0), !video);
    if (imgs.length === 1) botaoEm(acoes, 'Baixar a imagem', () => baixar(imgs[0].src, imgs[0].getAttribute('data-nome') || 'arte.png'));
    if (imgs.length > 1) botaoEm(acoes, 'Baixar as ' + imgs.length + ' imagens (ZIP)', () => baixarTodas(arte));
    acoes.hidden = false;
  });
  $$('.legenda').forEach((p) => {
    const b = criar('button', 'botao copiar-legenda', 'Copiar a legenda');
    b.type = 'button';
    b.addEventListener('click', () => copiarLegenda(p));
    p.insertAdjacentElement('afterend', b);
  });

  // ---- Calendário | Lista: o calendário abre primeiro; o cartão abre a janela do post ----
  // Sem <dialog>, nada muda: o calendário e a lista ficam juntos e o cartão leva ao post na lista.
  if (temJanela) {
    $$('.cartao-post[data-post]').forEach((c) => c.addEventListener('click', (e) => {
      const post = document.getElementById('post-' + c.getAttribute('data-post'));
      if (!post) return;
      e.preventDefault();
      abrirDetalhe(post, c);
    }));
    const vistas = document.querySelector('.vistas');
    if (vistas) {
      const botoes = $$('button[data-vista]', vistas);
      const usar = (v) => {
        document.body.classList.toggle('vista-calendario', v === 'calendario');
        document.body.classList.toggle('vista-lista', v === 'lista');
        botoes.forEach((b) => b.setAttribute('aria-pressed', b.getAttribute('data-vista') === v ? 'true' : 'false'));
      };
      botoes.forEach((b) => b.addEventListener('click', () => usar(b.getAttribute('data-vista'))));
      usar('calendario');
      vistas.hidden = false;
    }
  }
})();
