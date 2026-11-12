// O visualizador do arquivo do cliente (o cronograma gerado por enviar-cliente.js). Vai dentro do arquivo, sempre
// igual, sem nenhum dado: ele só lê as imagens e os vídeos que já estão na página. Não busca nada fora do arquivo.
// Faz: abrir a imagem em tamanho grande (setas, teclado, miniaturas), baixar a imagem, o vídeo ou todas as imagens
// de uma arte num .zip (com a legenda), e copiar a legenda. Sem ele (navegador que bloqueia), as artes continuam
// visíveis na página: os botões de baixar e copiar é que não aparecem.
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
  let tempoAviso = null;
  function aviso(texto) {
    let r = document.getElementById('aviso-cliente');
    if (!r) { r = criar('div', 'aviso-cliente'); r.id = 'aviso-cliente'; r.setAttribute('role', 'status'); document.body.appendChild(r); }
    r.textContent = texto;
    r.hidden = false;
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(() => { r.hidden = true; }, 5000);
  }

  // ---- visualizador ----
  const visor = criar('div', 'visor');
  visor.hidden = true;
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-modal', 'true');
  visor.setAttribute('aria-label', 'Arte em tamanho grande');
  document.body.appendChild(visor);
  const estado = { arte: null, i: 0, voltar: null };

  function imagensDa(arte) { return $$('.miniatura img', arte); }
  function fechar() {
    visor.hidden = true;
    visor.textContent = '';
    document.body.classList.remove('visor-aberto');
    if (estado.voltar) estado.voltar.focus();
  }
  function abrir(arte, i, quem) {
    estado.arte = arte; estado.i = i; estado.voltar = quem || null;
    desenhar();
    visor.hidden = false;
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
  document.addEventListener('keydown', (e) => {
    if (visor.hidden) return;
    if (e.key === 'Escape') fechar();
    else if (e.key === 'ArrowLeft') ir(-1);
    else if (e.key === 'ArrowRight') ir(1);
  });

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

  // ---- os botões de cada arte e de cada legenda (só aparecem com o visualizador funcionando) ----
  $$('.arte').forEach((arte) => {
    const imgs = imagensDa(arte);
    $$('.miniatura', arte).forEach((b, i) => b.addEventListener('click', () => abrir(arte, i, b)));
    const acoes = arte.querySelector('.arte-acoes');
    if (!acoes) return;
    const video = arte.querySelector('video');
    const botao = (texto, fn, principal) => {
      const b = criar('button', 'botao' + (principal ? ' principal' : ''), texto);
      b.type = 'button';
      b.addEventListener('click', fn);
      acoes.appendChild(b);
    };
    if (video) botao('Baixar o vídeo', () => baixar(video.src, video.getAttribute('data-nome') || 'video.mp4'), true);
    if (imgs.length) botao('Ver em tamanho grande', () => abrir(arte, 0), !video);
    if (imgs.length === 1) botao('Baixar a imagem', () => baixar(imgs[0].src, imgs[0].getAttribute('data-nome') || 'arte.png'));
    if (imgs.length > 1) botao('Baixar as ' + imgs.length + ' imagens (ZIP)', () => baixarTodas(arte));
    acoes.hidden = false;
  });
  $$('.legenda').forEach((p) => {
    const b = criar('button', 'botao copiar-legenda', 'Copiar a legenda');
    b.type = 'button';
    b.addEventListener('click', () => {
      const texto = p.innerText;
      const feito = () => aviso('Legenda copiada.');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(feito, () => aviso('Selecione a legenda e copie à mão.'));
      else aviso('Selecione a legenda e copie à mão.');
    });
    p.insertAdjacentElement('afterend', b);
  });
})();
