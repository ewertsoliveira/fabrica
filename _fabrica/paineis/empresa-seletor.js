// Seletor de empresa dos painéis (Laboratório de Design e Cronograma) da Fábrica de Conteúdo.
//
// O painel mostra UMA empresa por vez. A escolha mora só na sessão deste navegador (sessionStorage: vale enquanto a
// aba está aberta e some ao fechá-la, então no dia seguinte vale de novo a empresa do agente): o seletor nunca troca a
// empresa com que o agente trabalha (nenhuma rota do servidor grava isso). Ordem da escolha: ?empresa= no endereço da
// página, depois a escolha feita nesta sessão, depois a empresa ativa do agente e, sem ela, a primeira da lista.
//
// Todo pedido passa por aqui e leva a empresa: nas leituras como ?empresa=<codigo>, nos envios dentro do corpo.
// Resposta que volta depois de a pessoa já ter trocado de empresa (ou que diz ser de outra empresa) é descartada:
// `ler` e `enviar` devolvem null nesse caso, e a tela simplesmente não faz nada com ela.
//
// Uso na tela:
//   const seletor = EmpresaSeletor.criar();
//   await seletor.carregar();                       // lista as empresas e decide a escolhida
//   seletor.montar({ seletor: el, aviso: el, aoTrocar: (codigo) => ... });
//   const r = await seletor.ler('/api/dados');      // { ok, status, json } ou null (resposta descartada)
//   const m = await seletor.aplicarMarca();         // cores e letras da empresa na página
//   await seletor.enviar('/api/aprovar', { id, ... });
//   await seletor.comecar({ nome, para });          // só a tela Começar: cria a empresa e passa a mostrá-la
'use strict';
(function (global) {
  const CHAVE = 'fabrica.paineis.empresa';
  const ROTA_EMPRESAS = '/api/empresas';
  // O único envio sem empresa: criar a primeira empresa (ou um cliente novo) na tela Começar. A empresa ainda não existe,
  // e a rota recusa um corpo que diga uma.
  const ROTA_COMECAR = '/api/comecar';
  // Letras de reserva quando a marca não traz arquivo de fonte: só famílias genéricas do sistema.
  const LETRAS_PADRAO = {
    principal: 'ui-serif, serif',
    texto: 'system-ui, sans-serif',
    mono: 'ui-monospace, monospace',
  };
  // Cores de reserva (quando a marca não define um papel), em rgb para não parecerem cores de marca.
  const CORES_PADRAO = {
    escuro: 'rgb(30, 32, 36)',
    claro: 'rgb(246, 244, 239)',
    acento: 'rgb(38, 102, 168)',
    neutro: 'rgb(132, 128, 120)',
  };

  // Endereço de uma rota do servidor com a empresa. Só rotas /api/: nunca um arquivo de dados por caminho.
  function urlDaApi(rota, codigo) {
    if (typeof rota !== 'string' || rota.indexOf('/api/') !== 0) throw new Error('Rota fora do servidor dos painéis: ' + rota);
    if (typeof codigo !== 'string' || codigo === '') throw new Error('Pedido sem empresa.');
    return rota + (rota.indexOf('?') >= 0 ? '&' : '?') + 'empresa=' + encodeURIComponent(codigo);
  }

  // `dep` existe para os testes: { buscar, armazenamento, endereco, documento } (buscar faz o papel do fetch).
  function criar(dep) {
    dep = dep || {};
    const buscar = dep.buscar || function (url, opcoes) { return global.fetch(url, opcoes); };
    const endereco = dep.endereco !== undefined ? dep.endereco : (global.location ? global.location.href : '');
    const documento = dep.documento !== undefined ? dep.documento : global.document;
    const armazenamento = function () {
      if (dep.armazenamento !== undefined) return dep.armazenamento;
      try { return global.sessionStorage; } catch (e) { return null; }
    };

    // `sempre`: a tela pediu o seletor visível já com uma empresa (agência com um cliente só); `desenhos`: o que redesenha
    // o seletor e o aviso na página.
    const estado = { empresas: [], ativa: null, atual: null, aviso: '', geracao: 0, ouvintes: [], sempre: false, desenhos: [] };

    function guardada() {
      try { const a = armazenamento(); return a ? a.getItem(CHAVE) : null; } catch (e) { return null; }
    }
    function guardar(codigo) {
      try { const a = armazenamento(); if (a) a.setItem(CHAVE, codigo); } catch (e) { /* navegador sem armazenamento: vale só nesta aba */ }
    }
    function daPagina() {
      try { return new URLSearchParams(String(endereco || '').split('#')[0].split('?')[1] || '').get('empresa'); } catch (e) { return null; }
    }
    const existe = (codigo) => estado.empresas.some((e) => e.codigo === codigo);
    const nomeDe = (codigo) => { const e = estado.empresas.find((x) => x.codigo === codigo); return e ? e.nome : codigo; };

    async function lerResposta(resp) {
      let json = null;
      try { json = await resp.json(); } catch (e) { json = null; }
      return json;
    }

    // Lista as empresas e decide qual o painel mostra. Não guarda nada: só a pessoa, ao escolher, muda a escolha.
    async function carregar() {
      const resp = await buscar(ROTA_EMPRESAS, { headers: { Accept: 'application/json' } });
      const json = await lerResposta(resp);
      if (!resp.ok || !json || !Array.isArray(json.empresas)) {
        throw new Error(json && json.erro ? json.erro : 'O servidor dos painéis não respondeu como esperado. Feche o painel e abra de novo pelo atalho.');
      }
      estado.empresas = json.empresas.filter((e) => e && typeof e.codigo === 'string').map((e) => ({ codigo: e.codigo, nome: typeof e.nome === 'string' && e.nome ? e.nome : e.codigo }));
      estado.ativa = typeof json.ativa === 'string' && existe(json.ativa) ? json.ativa : null;
      estado.aviso = typeof json.aviso === 'string' ? json.aviso : '';
      const candidatas = [daPagina(), guardada(), estado.ativa, estado.empresas.length ? estado.empresas[0].codigo : null];
      estado.atual = candidatas.find((c) => typeof c === 'string' && existe(c)) || null;
      return situacao();
    }

    function situacao() {
      return {
        empresas: estado.empresas.slice(),
        ativa: estado.ativa,
        atual: estado.atual,
        nome: estado.atual ? nomeDe(estado.atual) : '',
        mostrarSeletor: estado.empresas.length >= 2 || (estado.sempre && estado.empresas.length === 1),
        aviso: textoDoAviso(),
      };
    }

    // O aviso aparece quando o painel mostra uma empresa e o agente atende outra (ou nenhuma, com várias empresas).
    function textoDoAviso() {
      if (!estado.atual) return '';
      if (estado.ativa && estado.ativa !== estado.atual) {
        return 'O agente está trabalhando em ' + nomeDe(estado.ativa) + '. Peça a troca no Claude se quiser que ele atenda esta empresa.';
      }
      if (!estado.ativa && estado.empresas.length >= 2) {
        return estado.aviso || 'O agente ainda não tem uma empresa escolhida. Peça no Claude para escolher a empresa com que ele vai trabalhar.';
      }
      return '';
    }

    // Troca a empresa do painel. Pedidos que ainda estão a caminho deixam de valer.
    function escolher(codigo) {
      if (!existe(codigo)) throw new Error('Empresa desconhecida: ' + codigo);
      if (codigo === estado.atual) return false;
      estado.atual = codigo;
      estado.geracao += 1;
      guardar(codigo);
      estado.ouvintes.forEach((f) => f(codigo));
      return true;
    }

    // Uma resposta só vale se a empresa do painel ainda é a mesma de quando o pedido saiu, e se o servidor diz que ela
    // é dessa empresa (as recusas sem empresa, como uma empresa inválida, valem).
    async function chamar(rota, montar) {
      const codigo = estado.atual;
      const geracao = estado.geracao;
      if (!codigo) throw new Error('Nenhuma empresa escolhida.');
      const pedido = montar(codigo);
      const resp = await buscar(pedido.url, pedido.opcoes);
      const json = await lerResposta(resp);
      if (geracao !== estado.geracao || codigo !== estado.atual) return null;
      if (json && json.empresa !== undefined && json.empresa !== null && json.empresa !== codigo) return null;
      return { ok: resp.ok && !!json && json.ok !== false, status: resp.status, json: json };
    }

    function ler(rota) {
      return chamar(rota, (codigo) => ({ url: urlDaApi(rota, codigo), opcoes: { headers: { Accept: 'application/json' } } }));
    }

    // A empresa vai no corpo e por último: nada do que a tela mandar a substitui.
    function enviar(rota, corpo) {
      return chamar(rota, (codigo) => ({
        url: urlDaApi(rota, codigo),
        opcoes: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(Object.assign({}, corpo || {}, { empresa: codigo })),
        },
      }));
    }

    // Cria a empresa pelo caminho (POST /api/comecar com só o nome e para quem é: nunca a empresa). Deu certo: a lista é
    // lida de novo e a empresa nova passa a ser a do painel, só neste navegador (a do agente não muda: nenhuma rota grava
    // isso). Devolve { ok, status, json } como `enviar`.
    async function comecar(corpo) {
      corpo = corpo || {};
      const resp = await buscar(ROTA_COMECAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ nome: corpo.nome, para: corpo.para }),
      });
      const json = await lerResposta(resp);
      const ok = resp.ok && !!json && json.ok !== false && typeof json.codigo === 'string';
      if (!ok) return { ok: false, status: resp.status, json: json };
      // A empresa já nasceu: a releitura da lista que falha não vira erro (senão um novo "Continuar" criaria outra).
      // `releu: false` avisa a tela, que confere a empresa antes de gravar qualquer coisa nela.
      let releu = true;
      try { await carregar(); } catch (e) { releu = false; }
      if (existe(json.codigo)) {
        estado.atual = json.codigo;
        estado.geracao += 1;
        guardar(json.codigo);
        atualizarEndereco(json.codigo);
        estado.ouvintes.forEach((f) => f(json.codigo));
      }
      return { ok: true, status: resp.status, json: json, releu: releu };
    }

    // Agência (decisão 9 A): com `true`, o seletor aparece já com uma empresa só, e nada muda de lugar quando chega a segunda.
    function mostrarSempre(valor) {
      estado.sempre = !!valor;
      estado.desenhos.forEach((f) => f());
    }

    // Cores e letras da empresa do painel na página, como variáveis de CSS (--escuro, --claro, --acento, --neutro,
    // --sobre-acento, --sobre-escuro, --letra-titulo, --letra-texto, --letra-mono). Devolve a marca (ou null se a
    // resposta foi descartada).
    async function aplicarMarca() {
      const r = await ler('/api/empresa');
      if (r === null) return null;
      const marca = r.ok ? r.json : { nome: nomeDe(estado.atual), exemplo: true, cores: {}, fontes: {} };
      if (documento && documento.documentElement) pintar(marca);
      return marca;
    }

    function pintar(marca) {
      const raiz = documento.documentElement.style;
      const cores = Object.assign({}, CORES_PADRAO);
      Object.keys(CORES_PADRAO).forEach((papel) => {
        const v = marca.cores && marca.cores[papel];
        if (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)) cores[papel] = v;
      });
      Object.keys(cores).forEach((papel) => raiz.setProperty('--' + papel, cores[papel]));
      raiz.setProperty('--sobre-acento', melhorContraste(cores.acento, cores.escuro, cores.claro));
      raiz.setProperty('--sobre-escuro', cores.claro);
      const familias = { principal: 'Marca Titulo', mono: 'Marca Mono' };
      const letras = { principal: LETRAS_PADRAO.principal, mono: LETRAS_PADRAO.mono };
      Object.keys(familias).forEach((papel) => {
        const url = marca.fontes && marca.fontes[papel];
        if (typeof url === 'string' && url.indexOf('/') === 0 && carregarFonte(familias[papel] + ' ' + (estado.geracao), url)) {
          letras[papel] = '"' + familias[papel] + ' ' + estado.geracao + '", ' + letras[papel];
        }
      });
      raiz.setProperty('--letra-titulo', letras.principal);
      raiz.setProperty('--letra-mono', letras.mono);
      raiz.setProperty('--letra-texto', LETRAS_PADRAO.texto);
    }

    // A fonte vem do endereço que o servidor deu (um arquivo dentro da pasta da Fábrica). Se não carregar, fica a do sistema.
    function carregarFonte(familia, url) {
      const F = global.FontFace;
      if (!F || !documento.fonts) return false;
      try {
        const f = new F(familia, 'url("' + url.replace(/"/g, '%22') + '")', { display: 'swap' });
        documento.fonts.add(f);
        f.load().catch(function () { /* arquivo de fonte com defeito: vale a letra do sistema */ });
        return true;
      } catch (e) { return false; }
    }

    // ---- Na página ----

    // Desenha o seletor (só com duas ou mais empresas, ou com uma se a tela pediu: mostrarSempre) e o aviso. `aoTrocar(codigo)` roda depois de cada troca.
    function montar(op) {
      op = op || {};
      if (op.aoTrocar) estado.ouvintes.push(op.aoTrocar);
      const desenhar = () => {
        const s = situacao();
        if (op.seletor) desenharSeletor(op.seletor, s);
        if (op.aviso) {
          op.aviso.textContent = s.aviso;
          op.aviso.hidden = !s.aviso;
        }
      };
      estado.ouvintes.unshift(desenhar);
      estado.desenhos.push(desenhar);
      desenhar();
    }

    function desenharSeletor(el, s) {
      el.hidden = !s.mostrarSeletor;
      if (!s.mostrarSeletor) { el.textContent = ''; return; }
      let select = el.querySelector('select');
      if (!select) {
        el.textContent = '';
        const rotulo = documento.createElement('label');
        rotulo.className = 'empresa-seletor';
        const texto = documento.createElement('span');
        texto.className = 'empresa-seletor-rotulo';
        texto.textContent = 'Empresa:';
        select = documento.createElement('select');
        select.className = 'empresa-seletor-lista';
        select.setAttribute('aria-label', 'Empresa mostrada neste painel');
        const seta = documento.createElement('span');
        seta.className = 'empresa-seletor-seta';
        seta.setAttribute('aria-hidden', 'true');
        seta.textContent = '▾';
        rotulo.appendChild(texto);
        rotulo.appendChild(select);
        rotulo.appendChild(seta);
        el.appendChild(rotulo);
        select.addEventListener('change', () => {
          if (!escolher(select.value)) return;
          atualizarEndereco(select.value);
        });
      }
      select.textContent = '';
      s.empresas.forEach((e) => {
        const o = documento.createElement('option');
        o.value = e.codigo;
        o.textContent = e.nome;
        if (e.codigo === s.atual) o.selected = true;
        select.appendChild(o);
      });
    }

    // Se o endereço da página trazia ?empresa=, ele acompanha a troca (senão, ao recarregar, voltaria a empresa antiga).
    function atualizarEndereco(codigo) {
      try {
        const u = new URL(global.location.href);
        if (!u.searchParams.has('empresa')) return;
        u.searchParams.set('empresa', codigo);
        global.history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e) { /* sem histórico: o endereço fica como está */ }
    }

    return {
      carregar, escolher, ler, enviar, comecar, mostrarSempre, aplicarMarca, montar, situacao,
      atual: () => estado.atual,
      nome: () => (estado.atual ? nomeDe(estado.atual) : ''),
    };
  }

  // Cor do texto sobre um fundo: a das duas candidatas com mais contraste.
  function melhorContraste(fundo, a, b) {
    const lum = (cor) => {
      const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(cor) || /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(cor);
      if (!m) return 0.5;
      const v = [1, 2, 3].map((i) => {
        const c = (m[0][0] === '#' ? parseInt(m[i], 16) : Number(m[i])) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const contraste = (x, y) => { const l1 = lum(x); const l2 = lum(y); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
    return contraste(fundo, a) >= contraste(fundo, b) ? a : b;
  }

  const api = { criar, urlDaApi, melhorContraste, CHAVE };
  global.EmpresaSeletor = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
