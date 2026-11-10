// Cartão "Seu estilo" do Laboratório de Design e do Cronograma (decisão 7 B da etapa 8): fica fixo no alto da tela, com a
// capa pequena do estilo escolhido pela empresa do painel, o nome dele e o botão "Trocar a cara da marca", que leva à
// biblioteca de estilos dessa empresa. Sem estilo escolhido, o cartão convida a "Escolher um estilo".
//
// Lê só pelo seletor comum (empresa-seletor.js), a rota /api/biblioteca da empresa do painel; resposta de outra empresa ou
// que chega depois da troca de empresa é descartada pelo seletor (volta null) e o cartão não muda. Tudo é montado por
// texto (textContent e atributos), nunca por HTML. A capa só vem das prévias da biblioteca ou das prévias desta empresa.
//
// Uso na tela (depois de empresa-seletor.js):
//   CartaoEstilo.mostrar(document.getElementById('cartao-estilo'), seletor);
'use strict';
(function (global) {
  const ROTA = '/api/biblioteca';
  const LIMITE_NOME = 80;
  const LIMITE_LINHA = 140;
  // caracteres de controle e invisíveis (montados pelo código: nenhum caractere invisível escrito aqui)
  const faixa = (a, b) => String.fromCharCode(a) + '-' + String.fromCharCode(b);
  const ESCONDIDOS = new RegExp('[' + [faixa(0, 31), faixa(127, 159), faixa(0x200b, 0x200f), faixa(0x2028, 0x202e), faixa(0x2060, 0x2069), faixa(0xfeff, 0xfeff)].join('') + ']+', 'g');

  // Uma linha só, sem caracteres de controle, com limite.
  function umaLinha(v, limite) {
    if (typeof v !== 'string') return '';
    const s = v.replace(ESCONDIDOS, ' ').replace(/\s+/g, ' ').trim();
    const letras = Array.from(s);
    return letras.length > limite ? letras.slice(0, limite - 1).join('') + '…' : s;
  }

  // O endereço da capa só vale se for de uma das duas pastas de prévias (a da biblioteca, ou a desta empresa), sem "..",
  // sem barra invertida e sem esquema.
  function enderecoSeguro(u, codigo) {
    if (typeof u !== 'string' || /\.\.|\\|:|\/\/|[\s"'<>]/.test(u)) return null;
    const daEmpresa = '/empresas/' + encodeURIComponent(String(codigo)) + '/previas/';
    return u.indexOf('/04-LABORATORIO-DE-DESIGN/biblioteca/previas/') === 0 || u.indexOf(daEmpresa) === 0 ? u : null;
  }

  // Do catálogo da empresa (resposta de /api/biblioteca): null sem estilo escolhido, ou { nome, linha, capa }. A capa na
  // marca da empresa vale primeiro; senão, a capa base do estilo.
  function dadosDoCartao(cat, codigo) {
    if (!cat || typeof cat !== 'object' || !cat.atual || typeof cat.atual !== 'object') return null;
    const atual = cat.atual;
    const lista = atual.origem === 'proprio' ? cat.proprios : cat.estilos;
    const item = Array.isArray(lista) ? lista.find((e) => e && e.id === atual.estilo) : null;
    const nome = umaLinha(atual.nome, LIMITE_NOME) || (item ? umaLinha(item.nome, LIMITE_NOME) : '') || 'Seu estilo';
    if (!item) return { nome, linha: '', capa: null };
    const naMarca = item.previasMarca && typeof item.previasMarca === 'object' ? enderecoSeguro(item.previasMarca.capa, codigo) : null;
    const base = item.previas && typeof item.previas === 'object' ? enderecoSeguro(item.previas.capa, codigo) : null;
    return { nome, linha: umaLinha(item.linha, LIMITE_LINHA), capa: naMarca || base };
  }

  function criar(doc, tag, classe, texto) {
    const e = doc.createElement(tag);
    if (classe) e.className = classe;
    if (texto) e.textContent = texto;
    return e;
  }

  // Desenha o cartão. `dados`: { nome, linha, capa } (com estilo), null (sem estilo) ou 'erro' (não deu para ler: só o atalho,
  // sem afirmar se há estilo ou não).
  function desenhar(alvo, dados, codigo, documento) {
    const doc = documento || global.document;
    alvo.textContent = '';
    const comEstilo = dados && typeof dados === 'object';
    const capa = comEstilo && dados.capa ? criar(doc, 'img', 'cartao-estilo-capa') : criar(doc, 'span', 'cartao-estilo-capa cartao-estilo-sem-capa');
    if (comEstilo && dados.capa) {
      capa.setAttribute('src', dados.capa);
      capa.setAttribute('alt', '');
      capa.setAttribute('loading', 'lazy');
    } else {
      capa.setAttribute('aria-hidden', 'true');
      if (comEstilo) capa.textContent = Array.from(dados.nome)[0] || '';
    }
    const texto = criar(doc, 'div', 'cartao-estilo-texto');
    texto.appendChild(criar(doc, 'p', 'cartao-estilo-rotulo', 'Seu estilo'));
    let titulo, apoio, botao;
    if (comEstilo) {
      titulo = dados.nome; apoio = dados.linha; botao = 'Trocar a cara da marca';
    } else if (dados === null) {
      titulo = 'Nenhum estilo escolhido ainda'; apoio = 'Escolha a cara das suas peças na biblioteca de estilos.'; botao = 'Escolher um estilo';
    } else {
      titulo = 'A cara da marca'; apoio = 'Veja os estilos e troque quando quiser.'; botao = 'Trocar a cara da marca';
    }
    texto.appendChild(criar(doc, 'p', 'cartao-estilo-nome', titulo));
    if (apoio) texto.appendChild(criar(doc, 'p', 'cartao-estilo-linha', apoio));
    const link = criar(doc, 'a', 'botao botao-principal', botao);
    link.setAttribute('href', 'estilos.html?empresa=' + encodeURIComponent(String(codigo)));
    alvo.appendChild(capa);
    alvo.appendChild(texto);
    alvo.appendChild(link);
    alvo.hidden = false;
  }

  // Lê a biblioteca da empresa do painel e desenha o cartão. Sem empresa: escondido, sem pedido nenhum.
  async function mostrar(alvo, seletor, documento) {
    const codigo = seletor.atual();
    if (!codigo) { alvo.textContent = ''; alvo.hidden = true; return; }
    let r;
    try { r = await seletor.ler(ROTA); } catch (e) { r = undefined; }
    if (r === null || seletor.atual() !== codigo) return; // a pessoa trocou de empresa: o cartão é da outra
    desenhar(alvo, r && r.ok ? dadosDoCartao(r.json, codigo) : 'erro', codigo, documento);
  }

  const api = { mostrar, desenhar, dadosDoCartao, enderecoSeguro, ROTA };
  global.CartaoEstilo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
