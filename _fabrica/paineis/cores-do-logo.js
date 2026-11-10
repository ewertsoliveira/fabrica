// Cores do logo e lista de letras da tela "Sua marca" da Fábrica de Conteúdo. Funciona no navegador (CoresDoLogo) e no
// Node (require). Tudo aqui é conta feita por código, sem IA de imagem: mesma entrada, mesma saída.
//
//   CoresDoLogo.extrair(rgba, largura, altura, { maximo = 6 }) -> [{ cor: '#RRGGBB', peso }]
//       As cores do logo, da que mais aparece para a que menos aparece (os pesos somam 1). Ignora o pixel transparente
//       e a cor que domina a borda (o fundo do logo) quando ela é de pouca saturação (branco, preto, cinza, creme): uma
//       borda colorida é o próprio logo (um quadrado de cor com a letra por cima) e fica. Fundo neutro que cobre mais de
//       60% da imagem volta no fim da lista como { cor, peso: 0.05, fundo: true } (o quadrado preto de um ícone).
//       Agrupa por corte da mediana; a borda suavizada (mistura entre duas cores do logo, ou entre o logo e o fundo) não
//       vira cor nova.
//   CoresDoLogo.papeis(cores) -> { escuro, claro, acento, neutro, faltando: [papeis] }
//       O papel sugerido de cada cor (a pessoa troca por toque na tela). Escuro e claro com contraste de pelo menos 4,5;
//       acento é a mais saturada que tenha contraste de 3 com um dos dois; neutro é a de pouca saturação no meio.
//       O que não der fica null e entra em `faltando`.
//   CoresDoLogo.completar(parcial) -> [opcao, opcao, opcao]
//       Três marcas completas para o que faltar, por regra: escurecer a cor de base para o escuro, clarear para o claro,
//       misturar escuro e claro para o neutro e, sem acento, um acento no tom da cor de base. Os papéis dados nunca mudam.
//       opcao = { nome, cores: { escuro, claro, acento, neutro }, sugeridos: [papeis], contraste, aa }.
//       Com os quatro papéis dados, devolve só a própria marca (nada a sugerir).
//   CoresDoLogo.deArquivo(arquivo, { lado = 200 }) -> Promise<{ rgba, largura, altura }>   (só no navegador)
//       Lê o logo (PNG, JPG, WebP ou SVG) por <img> num canvas pequeno. Num <img>, script de SVG não roda.
//   CoresDoLogo.listaDeLetras(familias) -> { letras: [{ familia, classificacao, italico, pesos, arquivos, licenca }], pares }
//   CoresDoLogo.conferirFamilias(familias, arquivosDaPasta) -> [problemas em português]
//       A lista de letras livres (familias.json, ao lado das letras OFL do modelo) e os pares prontos (título e texto).
//   CoresDoLogo.contraste(a, b), CoresDoLogo.codigo(cor) e CoresDoLogo.tomQuePassa(cor, passa, { luz })
//       A conta de contraste e o ajuste de tom (mesmo matiz, só a luz muda) que a marca completa usa; a sugestão de cores
//       legíveis (08-FERRAMENTAS/marca/legibilidade.js) usa as mesmas.
'use strict';
(function (global) {
  const PAPEIS = ['escuro', 'claro', 'acento', 'neutro'];
  const LIMITE_PIXELS = 65536; // acima disso, a imagem é lida pulando pixels (sempre os mesmos)
  const ALFA_MINIMO = 128; // pixel mais transparente que isso não conta
  const PERTO_DO_FUNDO = 40; // distância (em rgb) até a cor da borda que ainda é fundo
  const MESMA_COR = 18; // grupos mais perto que isso são a mesma cor
  const SATURADA = 0.18; // croma mínimo de um acento; abaixo disso a cor é de pouca saturação
  const CAIXAS = 16; // grupos do corte da mediana antes de juntar
  const PESO_MINIMO = 0.01; // cor com menos de 1% dos pixels do logo é ruído
  const LUZ_EXTREMA = 0.03; // tom com luz até 0,03 (ou a partir de 0,97) já é preto (ou branco), não tom da marca
  const COM_MATIZ = 0.04; // croma a partir do qual a cor tem matiz a manter
  const DESVIO_DE_MATIZ = 10; // graus que um tom pode se afastar do matiz da cor original
  const COBRE_A_IMAGEM = 0.6; // fundo neutro em mais de 60% da imagem volta para a lista, marcado como fundo
  const PESO_DO_FUNDO = 0.05; // ...com este peso (as cores do logo dividem o resto)
  // Cor de base quando não há cor nenhuma, em rgb para não parecer cor de marca (a mesma reserva do seletor dos painéis).
  const BASE_RESERVA = [38, 102, 168];
  const VERSOES = [
    { nome: 'Equilibrada', escuro: 0.8, claro: 0.92, neutro: 0.5, giro: 0, saturacao: 0.65, luz: 0.5, luzCinza: 0.25 },
    { nome: 'Mais contraste', escuro: 0.9, claro: 0.97, neutro: 0.42, giro: 0, saturacao: 0.85, luz: 0.42, luzCinza: 0.15 },
    { nome: 'Mais cor', escuro: 0.66, claro: 0.85, neutro: 0.58, giro: 180, saturacao: 0.7, luz: 0.54, luzCinza: 0.35 },
  ];

  // ---------------------------------------------------------------- cores
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const codigo = (rgb) => '#' + rgb.map((v) => limitar(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  function rgbDe(cor) {
    if (Array.isArray(cor) && cor.length >= 3 && cor.slice(0, 3).every((v) => Number.isFinite(v))) return cor.slice(0, 3).map((v) => limitar(Math.round(v), 0, 255));
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(typeof cor === 'string' ? cor.trim() : '');
    return m ? [1, 2, 3].map((i) => parseInt(m[i], 16)) : null;
  }
  const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const misturar = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  function luminancia(rgb) {
    const v = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  }
  function contraste(a, b) {
    const la = luminancia(a); const lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  const croma = (rgb) => (Math.max(...rgb) - Math.min(...rgb)) / 255;
  function hsl(rgb) {
    const [r, g, b] = rgb.map((v) => v / 255);
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  }
  function deHsl(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    if (s === 0) return [l, l, l].map((v) => v * 255);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
    const canal = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [canal(h + 1 / 3), canal(h), canal(h - 1 / 3)].map((v) => v * 255);
  }
  const arredondado = (rgb) => rgb.map((v) => limitar(Math.round(v), 0, 255));
  const PRETO = [0, 0, 0];
  const BRANCO = [255, 255, 255];

  // ---------------------------------------------------------------- extrair
  // A cor que domina a borda (mais da metade dos pixels da borda, transparentes contados como "não é ela"), ou null.
  function corDaBorda(rgba, largura, altura) {
    const grupos = new Map();
    let total = 0;
    const olhar = (x, y) => {
      total++;
      const i = (y * largura + x) * 4;
      if (rgba[i + 3] < ALFA_MINIMO) return;
      const chave = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3);
      const g = grupos.get(chave) || { n: 0, soma: [0, 0, 0] };
      g.n++; g.soma[0] += rgba[i]; g.soma[1] += rgba[i + 1]; g.soma[2] += rgba[i + 2];
      grupos.set(chave, g);
    };
    for (let x = 0; x < largura; x++) { olhar(x, 0); if (altura > 1) olhar(x, altura - 1); }
    for (let y = 1; y < altura - 1; y++) { olhar(0, y); if (largura > 1) olhar(largura - 1, y); }
    let melhor = null;
    for (const [chave, g] of [...grupos].sort((a, b) => a[0] - b[0])) if (!melhor || g.n > melhor.g.n) melhor = { chave, g };
    if (!melhor || melhor.g.n * 2 < total) return null;
    return melhor.g.soma.map((s) => Math.round(s / melhor.g.n));
  }

  // Corte da mediana: divide a caixa de maior (faixa x quantidade) no canal de maior faixa, na troca de valor mais perto
  // da mediana. Cada caixa vira um grupo representado pela cor exata que mais aparece nela (logo tem cor chapada).
  function cortarPelaMediana(pixels, maxCaixas) {
    const medir = (cx) => {
      const min = [255, 255, 255]; const max = [0, 0, 0];
      for (const p of cx) for (let k = 0; k < 3; k++) { if (p[k] < min[k]) min[k] = p[k]; if (p[k] > max[k]) max[k] = p[k]; }
      const faixas = [0, 1, 2].map((k) => max[k] - min[k]);
      const canal = faixas.indexOf(Math.max(...faixas));
      return { canal, faixa: faixas[canal] };
    };
    let caixas = [pixels];
    while (caixas.length < maxCaixas) {
      let escolhida = -1; let nota = 0; let medida = null;
      caixas.forEach((cx, i) => {
        const m = medir(cx);
        const n = m.faixa * cx.length;
        if (m.faixa > 0 && n > nota) { escolhida = i; nota = n; medida = m; }
      });
      if (escolhida < 0) break;
      const k = medida.canal;
      const outros = [0, 1, 2].filter((c) => c !== k);
      const ordem = caixas[escolhida].slice().sort((a, b) => a[k] - b[k] || a[outros[0]] - b[outros[0]] || a[outros[1]] - b[outros[1]]);
      const meio = Math.floor(ordem.length / 2);
      let corte = -1;
      for (let d = 0; d < ordem.length && corte < 0; d++) {
        for (const j of [meio - d, meio + d]) {
          if (j >= 1 && j < ordem.length && ordem[j - 1][k] !== ordem[j][k]) { corte = j; break; }
        }
      }
      caixas = caixas.slice(0, escolhida).concat([ordem.slice(0, corte), ordem.slice(corte)], caixas.slice(escolhida + 1));
    }
    return caixas.map((cx) => {
      const contagem = new Map();
      for (const p of cx) { const c = (p[0] << 16) | (p[1] << 8) | p[2]; contagem.set(c, (contagem.get(c) || 0) + 1); }
      let moda = null; let vezes = 0;
      for (const [c, n] of contagem) if (n > vezes || (n === vezes && c < moda)) { moda = c; vezes = n; }
      return { rgb: [(moda >> 16) & 255, (moda >> 8) & 255, moda & 255], n: cx.length };
    });
  }

  // `c` fica no caminho entre `a` e `b` (é a borda suavizada entre as duas)?
  function ehMistura(c, a, b) {
    const ab = [0, 1, 2].map((k) => b[k] - a[k]);
    const tam = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    if (tam < 1) return false;
    const t = ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / tam;
    if (t < 0.02 || t > 0.98) return false;
    return distancia(c, misturar(a, b, t)) <= 10;
  }

  const ordenar = (lista) => lista.sort((a, b) => b.n - a.n || codigo(a.rgb).localeCompare(codigo(b.rgb)));

  function extrair(rgba, largura, altura, opcoes) {
    const maximo = opcoes && opcoes.maximo !== undefined ? opcoes.maximo : 6;
    if (!Number.isInteger(maximo) || maximo < 1 || maximo > 12) throw new Error('O máximo de cores vai de 1 a 12.');
    if (!Number.isInteger(largura) || !Number.isInteger(altura) || largura < 1 || altura < 1 || !rgba || rgba.length !== largura * altura * 4) {
      throw new Error('O tamanho da imagem não bate com os pixels recebidos.');
    }
    const borda = corDaBorda(rgba, largura, altura);
    const fundo = borda && croma(borda) < SATURADA ? borda : null;
    const passo = Math.max(1, Math.ceil(Math.sqrt((largura * altura) / LIMITE_PIXELS)));
    const pixels = [];
    let doFundo = 0;
    for (let y = 0; y < altura; y += passo) {
      for (let x = 0; x < largura; x += passo) {
        const i = (y * largura + x) * 4;
        if (rgba[i + 3] < ALFA_MINIMO) continue;
        const p = [rgba[i], rgba[i + 1], rgba[i + 2]];
        if (fundo && distancia(p, fundo) <= PERTO_DO_FUNDO) { doFundo++; continue; }
        pixels.push(p);
      }
    }
    // Sem nada além do fundo, o logo é a própria cor (um quadrado chapado, por exemplo).
    if (!pixels.length) return fundo && doFundo ? [{ cor: codigo(fundo), peso: 1 }] : [];

    // Grupos iguais ou quase iguais viram um só (fica a cor do maior).
    const juntos = [];
    for (const g of ordenar(cortarPelaMediana(pixels, CAIXAS))) {
      const igual = juntos.find((j) => distancia(j.rgb, g.rgb) <= MESMA_COR);
      if (igual) igual.n += g.n; else juntos.push({ rgb: g.rgb, n: g.n });
    }
    // Borda suavizada: grupo que é mistura de dois maiores (ou de um maior e o fundo) sai.
    const pontas = [];
    const ficam = [];
    for (const g of ordenar(juntos)) {
      const candidatas = fundo ? pontas.concat([fundo]) : pontas;
      let mistura = false;
      for (let i = 0; i < candidatas.length && !mistura; i++) {
        for (let j = i + 1; j < candidatas.length && !mistura; j++) mistura = ehMistura(g.rgb, candidatas[i], candidatas[j]);
      }
      if (!mistura) { ficam.push(g); pontas.push(g.rgb); }
    }
    const total = ficam.reduce((s, g) => s + g.n, 0);
    const validas = ficam.filter((g) => g.n / total >= PESO_MINIMO);
    // Fundo neutro que cobre a maior parte da imagem (o quadrado preto de um ícone com a letra branca) fica na lista, por
    // último, marcado como fundo e com peso baixo: a pessoa pode tocar nele para usar como cor da marca.
    const comFundo = !!fundo && maximo > 1 && doFundo / (doFundo + pixels.length) > COBRE_A_IMAGEM;
    const escolhidas = validas.slice(0, comFundo ? maximo - 1 : maximo);
    const soma = escolhidas.reduce((s, g) => s + g.n, 0);
    const parte = comFundo ? 1 - PESO_DO_FUNDO : 1;
    const saida = escolhidas.map((g) => ({ cor: codigo(g.rgb), peso: Number(((g.n / soma) * parte).toFixed(4)) }));
    if (comFundo) saida.push({ cor: codigo(fundo), peso: PESO_DO_FUNDO, fundo: true });
    return saida;
  }

  // ---------------------------------------------------------------- papéis
  const ehEscura = (rgb) => contraste(rgb, BRANCO) >= 4.5; // aguenta texto claro por cima
  const ehClara = (rgb) => luminancia(rgb) >= 0.5; // fundo claro de verdade, não um tom médio
  const MEIO = Math.sqrt(0.05 * 1.05) - 0.05; // a luminância com o mesmo contraste com o preto e com o branco

  function papeis(cores) {
    if (!Array.isArray(cores)) throw new Error('As cores do logo precisam vir numa lista.');
    const lista = [];
    cores.forEach((c, i) => {
      const valor = c && typeof c === 'object' && !Array.isArray(c) ? c.cor : c;
      const rgb = rgbDe(valor);
      if (!rgb) throw new Error('Código da cor inválido: ' + JSON.stringify(valor) + ' (use #RRGGBB).');
      const cod = codigo(rgb);
      if (lista.some((x) => x.cor === cod)) return;
      const peso = c && typeof c === 'object' && Number.isFinite(c.peso) ? c.peso : 1 / (i + 1) / 1000; // sem peso: vale a ordem
      lista.push({ cor: cod, rgb, peso });
    });
    const saida = { escuro: null, claro: null, acento: null, neutro: null, faltando: [] };
    const usadas = new Set();

    // escuro e claro: o par com contraste de 4,5 que mais aparece no logo (empate: o de mais contraste)
    let par = null;
    for (const e of lista.filter((x) => ehEscura(x.rgb))) {
      for (const c of lista.filter((x) => x !== e && ehClara(x.rgb))) {
        const r = contraste(e.rgb, c.rgb);
        if (r < 4.5) continue;
        const nota = e.peso + c.peso;
        if (!par || nota > par.nota + 1e-9 || (Math.abs(nota - par.nota) <= 1e-9 && r > par.r)) par = { e, c, nota, r };
      }
    }
    if (par) {
      saida.escuro = par.e.cor; saida.claro = par.c.cor; usadas.add(par.e.cor); usadas.add(par.c.cor);
    } else {
      // sem par: fica só o lado que mais aparece (o outro é sugerido depois)
      const sozinha = lista.filter((x) => ehEscura(x.rgb) || ehClara(x.rgb)).sort((a, b) => b.peso - a.peso)[0];
      if (sozinha) {
        const papel = ehEscura(sozinha.rgb) ? 'escuro' : 'claro';
        saida[papel] = sozinha.cor; usadas.add(sozinha.cor);
      }
    }
    const fundos = [saida.escuro, saida.claro].filter(Boolean).map(rgbDe);
    const resto = () => lista.filter((x) => !usadas.has(x.cor));

    // acento: a mais saturada com contraste de 3 com o escuro ou o claro (sem nenhum dos dois, a mais saturada)
    const acento = resto().filter((x) => croma(x.rgb) >= SATURADA && (!fundos.length || fundos.some((f) => contraste(x.rgb, f) >= 3)))
      .sort((a, b) => croma(b.rgb) - croma(a.rgb) || b.peso - a.peso)[0];
    if (acento) { saida.acento = acento.cor; usadas.add(acento.cor); }

    // neutro: pouca saturação e luz no meio (nem fundo escuro nem fundo claro)
    const neutro = resto().filter((x) => croma(x.rgb) < SATURADA && luminancia(x.rgb) >= 0.04 && luminancia(x.rgb) <= 0.6)
      .sort((a, b) => Math.abs(luminancia(a.rgb) - MEIO) - Math.abs(luminancia(b.rgb) - MEIO) || b.peso - a.peso)[0];
    if (neutro) { saida.neutro = neutro.cor; usadas.add(neutro.cor); }

    saida.faltando = PAPEIS.filter((p) => !saida[p]);
    return saida;
  }

  // ---------------------------------------------------------------- completar
  function completar(parcial) {
    if (!parcial || typeof parcial !== 'object') throw new Error('Mande as cores que já existem (escuro, claro, acento, neutro).');
    const dado = {};
    for (const [papel, valor] of Object.entries(parcial)) {
      if (papel === 'faltando') continue; // a saída de papeis() entra direto; o que falta é recalculado
      if (!PAPEIS.includes(papel)) throw new Error('Papel de cor desconhecido: ' + papel + ' (use escuro, claro, acento ou neutro).');
      if (valor === null || valor === undefined || valor === '') continue;
      const rgb = rgbDe(valor);
      if (!rgb) throw new Error('Código da cor inválido para ' + papel + ': ' + JSON.stringify(valor) + ' (use #RRGGBB).');
      dado[papel] = rgb;
    }
    const sugeridos = PAPEIS.filter((p) => !dado[p]);
    if (!sugeridos.length) {
      const cores = {}; PAPEIS.forEach((p) => { cores[p] = codigo(dado[p]); });
      return [opcao('A sua marca', cores, [])];
    }
    // A cor de base é a primeira dada que tem matiz; marca só de cinzas (preto e branco, por exemplo) fica sem matiz e
    // ganha um acento também sem matiz. A cor de reserva só vale quando não veio cor nenhuma.
    const dadas = ['acento', 'escuro', 'claro', 'neutro'].map((p) => dado[p]).filter(Boolean);
    const base = dadas.find((c) => croma(c) >= 0.05) || dadas[0] || BASE_RESERVA;
    const semMatiz = croma(base) < 0.05;
    const [matiz] = hsl(base);
    return VERSOES.map((v) => {
      let escuro = dado.escuro;
      let claro = dado.claro;
      let te = v.escuro; let tc = v.claro;
      const fazerEscuro = () => arredondado(misturar(base, PRETO, te));
      const fazerClaro = () => arredondado(misturar(base, BRANCO, tc));
      if (!escuro) escuro = fazerEscuro();
      if (!claro) claro = fazerClaro();
      // contraste entre escuro e claro: só o que foi sugerido é ajustado, nunca o que a pessoa deu
      for (let i = 0; i < 40 && contraste(escuro, claro) < 4.5; i++) {
        const podeEscuro = !dado.escuro && te < 1; const podeClaro = !dado.claro && tc < 1;
        if (!podeEscuro && !podeClaro) break;
        if (podeEscuro && (!podeClaro || i % 2 === 0)) { te = Math.min(1, te + 0.03); escuro = fazerEscuro(); } else { tc = Math.min(1, tc + 0.02); claro = fazerClaro(); }
      }
      let acento = dado.acento;
      if (!acento) {
        // o tom do acento é o mesmo ajuste de luz que a sugestão de cores legíveis usa (legibilidade.js)
        const inicial = codigo(semMatiz ? deHsl(0, 0, v.luzCinza) : deHsl(matiz + v.giro, v.saturacao, v.luz));
        const passa = (c) => contraste(rgbDe(c), escuro) >= 3 || contraste(rgbDe(c), claro) >= 3;
        const tom = passa(inicial) ? null : tomQuePassa(inicial, passa, { luz: [0.12, 0.88] })[0];
        acento = rgbDe(tom ? tom.cor : inicial);
      }
      const neutro = dado.neutro || arredondado(misturar(escuro, claro, v.neutro));
      return opcao(v.nome, { escuro: codigo(escuro), claro: codigo(claro), acento: codigo(acento), neutro: codigo(neutro) }, sugeridos);
    });
  }

  // O tom mais perto de `cor` que passa em `passa(codigo)`, mantendo o matiz e a saturação e mudando só a luz (em passos
  // de 0,01), para os dois lados: [{ cor, direcao: 'escuro' | 'claro', mudanca }], o de menor mudança primeiro (empate:
  // o mais escuro). Lado sem tom que passe não aparece. `luz: [min, max]` limita até onde a luz pode ir.
  // Um tom só vale se continuar sendo da marca: nem quase preto nem quase branco (luz do código final entre 0,03 e 0,97,
  // exclusive) e, se a cor original tem matiz, o tom também tem e fica a até 10 graus dele (o arredondamento do código
  // pode puxar o matiz numa cor muito escura ou muito clara).
  function tomFiel(tom, original) {
    const [ht, , lt] = hsl(tom);
    if (lt <= LUZ_EXTREMA || lt >= 1 - LUZ_EXTREMA) return false;
    if (croma(original) < COM_MATIZ) return true;
    if (croma(tom) === 0) return false;
    const d = Math.abs(ht - hsl(original)[0]) % 360;
    return Math.min(d, 360 - d) <= DESVIO_DE_MATIZ;
  }
  function tomQuePassa(cor, passa, opcoes) {
    const rgb = rgbDe(cor);
    if (!rgb) throw new Error('Código da cor inválido: ' + JSON.stringify(cor) + ' (use #RRGGBB).');
    if (typeof passa !== 'function') throw new Error('Diga o que a cor precisa passar.');
    const [min, max] = opcoes && Array.isArray(opcoes.luz) ? opcoes.luz : [0, 1];
    const [h, s, l] = hsl(rgb);
    const original = codigo(rgb);
    const saida = [];
    for (const [direcao, sinal] of [['escuro', -1], ['claro', 1]]) {
      for (let k = 1; k <= 101; k++) {
        const luz = limitar(l + sinal * k * 0.01, min, max);
        const c = codigo(deHsl(h, s, luz));
        if (c !== original && tomFiel(rgbDe(c), rgb) && passa(c)) { saida.push({ cor: c, direcao, mudanca: Number(Math.abs(luz - l).toFixed(2)) }); break; }
        if (luz === min || luz === max) break;
      }
    }
    return saida.sort((a, b) => a.mudanca - b.mudanca || (a.direcao === 'escuro' ? -1 : 1));
  }

  function opcao(nome, cores, sugeridos) {
    const [e, c, a] = [cores.escuro, cores.claro, cores.acento].map(rgbDe);
    const r = contraste(e, c);
    const acentoOk = contraste(a, e) >= 3 || contraste(a, c) >= 3;
    return { nome, cores, sugeridos: sugeridos.slice(), contraste: Number(r.toFixed(2)), aa: r >= 4.5 && acentoOk };
  }

  // ---------------------------------------------------------------- leitura do logo no navegador
  // Desenha a imagem já carregada num canvas pequeno e devolve os pixels. Imagem vetorial (SVG) é desenhada no tamanho
  // de leitura; a de pixels só é reduzida, nunca ampliada (ampliar inventa cores de mistura).
  function deImagem(img, opcoes) {
    const lado = opcoes && opcoes.lado ? opcoes.lado : 200;
    const vetor = !!(opcoes && opcoes.vetor);
    const w0 = img.naturalWidth || img.width || lado;
    const h0 = img.naturalHeight || img.height || lado;
    let escala = lado / Math.max(w0, h0);
    if (!vetor) escala = Math.min(1, escala);
    const largura = Math.max(1, Math.round(w0 * escala));
    const altura = Math.max(1, Math.round(h0 * escala));
    const doc = global.document;
    const tela = doc.createElement('canvas');
    tela.width = largura; tela.height = altura;
    const ctx = tela.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, largura, altura);
    ctx.drawImage(img, 0, 0, largura, altura);
    let dados;
    try { dados = ctx.getImageData(0, 0, largura, altura); } catch (e) {
      throw new Error('Não consegui ler as cores desta imagem. Use outra imagem do logo, do seu computador.');
    }
    return { rgba: dados.data, largura, altura };
  }

  // `arquivo` é o File/Blob escolhido pela pessoa (ou o endereço de uma imagem do próprio painel).
  function deArquivo(arquivo, opcoes) {
    return new Promise((resolve, reject) => {
      const ehBlob = typeof global.Blob !== 'undefined' && arquivo instanceof global.Blob;
      const vetor = ehBlob ? /svg/i.test(arquivo.type || '') : /\.svg($|[?#])/i.test(String(arquivo));
      const url = ehBlob ? global.URL.createObjectURL(arquivo) : String(arquivo);
      const fim = () => { if (ehBlob) global.URL.revokeObjectURL(url); };
      const img = new global.Image();
      img.decoding = 'sync';
      img.onload = () => {
        try { resolve(deImagem(img, Object.assign({}, opcoes || {}, { vetor }))); } catch (e) { reject(e); } finally { fim(); }
      };
      img.onerror = () => { fim(); reject(new Error('Não consegui abrir esta imagem. Use outra imagem do logo.')); };
      img.src = url;
    });
  }

  // ---------------------------------------------------------------- lista de letras (familias.json) e pares prontos
  const CLASSIFICACOES = ['com serifa', 'sem serifa', 'máquina de escrever', 'manuscrita'];
  const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const classificacaoDe = (v) => (typeof v === 'string' ? CLASSIFICACOES.find((c) => semAcento(c) === semAcento(v)) || null : null);
  const EXT_LETRA = /\.(ttf|otf|woff2?)$/i;
  const nomeSimples = (a) => typeof a === 'string' && a !== '' && !/[\\/]/.test(a) && !a.includes('..');
  const comparar = (a, b) => a.localeCompare(b, 'pt');

  // As famílias, aceitando `familias` como objeto (nome -> dados) ou lista ({ familia | nome, ... }), ou as famílias
  // direto no topo do arquivo.
  function entradas(dados) {
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return [];
    const f = dados.familias;
    if (Array.isArray(f)) return f.map((item, i) => ({ familia: item && (item.familia || item.nome), item: item && typeof item === 'object' ? item : {}, onde: 'familias[' + i + ']' }));
    const mapa = f && typeof f === 'object' ? f : Object.fromEntries(Object.entries(dados).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v) && (v.arquivos || v.arquivo)));
    return Object.keys(mapa).map((k) => ({ familia: k, item: mapa[k] && typeof mapa[k] === 'object' ? mapa[k] : {}, onde: k }));
  }
  // Todos os textos de `arquivos` (texto, lista ou objeto peso -> arquivo) e de `arquivo`.
  function textosDosArquivos(item) {
    const saida = [];
    const juntar = (v, fundo) => {
      if (typeof v === 'string') saida.push(v);
      else if (v && typeof v === 'object' && fundo < 3) Object.values(v).forEach((x) => juntar(x, fundo + 1));
    };
    juntar(item.arquivos, 0); juntar(item.arquivo, 0);
    return [...new Set(saida)];
  }
  const pesosDe = (v) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n >= 100 && n <= 900))].sort((a, b) => a - b) : []);

  function listaDeLetras(dados) {
    const letras = entradas(dados).filter((e) => typeof e.familia === 'string' && e.familia.trim()).map((e) => ({
      familia: e.familia.trim(),
      classificacao: classificacaoDe(e.item.classificacao),
      italico: e.item.italico === true,
      pesos: pesosDe(e.item.pesos),
      arquivos: textosDosArquivos(e.item).filter((a) => nomeSimples(a) && EXT_LETRA.test(a)).sort(comparar),
      licenca: nomeSimples(e.item.licenca) ? e.item.licenca : null,
    })).filter((l) => l.arquivos.length).sort((a, b) => comparar(a.familia, b.familia));
    const conhecidas = new Set(letras.map((l) => l.familia));
    let pares;
    if (dados && Array.isArray(dados.pares) && dados.pares.length) {
      pares = dados.pares.map((p) => {
        const titulo = p && (p.titulo || p.principal); const texto = p && (p.texto || p.corpo || p.mono);
        return { nome: p && typeof p.nome === 'string' && p.nome.trim() ? p.nome.trim() : titulo + ' e ' + texto, titulo, texto };
      }).filter((p) => conhecidas.has(p.titulo) && conhecidas.has(p.texto));
    } else {
      pares = paresPorRegra(letras);
    }
    return { letras, pares };
  }

  // Sem pares no arquivo: cada letra com serifa ou manuscrita no título, com a letra sem serifa de texto (a primeira que
  // tem peso de texto, até 500) no corpo.
  function paresPorRegra(letras) {
    const semSerifa = letras.filter((l) => l.classificacao === 'sem serifa');
    const texto = semSerifa.find((l) => l.pesos.some((p) => p <= 500)) || semSerifa[0];
    if (!texto) return [];
    return letras.filter((l) => l !== texto && (l.classificacao === 'com serifa' || l.classificacao === 'manuscrita'))
      .slice(0, 8).map((l) => ({ nome: l.familia + ' e ' + texto.familia, titulo: l.familia, texto: texto.familia }));
  }

  function conferirFamilias(dados, arquivosDaPasta) {
    const problemas = [];
    const existe = new Set((arquivosDaPasta || []).filter((a) => typeof a === 'string'));
    const lista = entradas(dados);
    if (!lista.length) return ['familias.json sem nenhuma família.'];
    const vistas = new Set();
    const citados = new Set();
    for (const e of lista) {
      const nome = typeof e.familia === 'string' ? e.familia.trim() : '';
      if (!nome) { problemas.push('Família sem nome em ' + e.onde + '.'); continue; }
      if (vistas.has(semAcento(nome))) problemas.push(nome + ': família repetida.');
      vistas.add(semAcento(nome));
      if (!classificacaoDe(e.item.classificacao)) problemas.push(nome + ': classificação "' + e.item.classificacao + '" fora da lista (' + CLASSIFICACOES.join(', ') + ').');
      if (typeof e.item.italico !== 'boolean') problemas.push(nome + ': "italico" precisa ser verdadeiro ou falso.');
      const pesos = Array.isArray(e.item.pesos) ? e.item.pesos : [];
      if (!pesos.length || pesosDe(pesos).length !== new Set(pesos.map(Number)).size) problemas.push(nome + ': pesos inválidos (use números de 100 a 900).');
      const arquivos = textosDosArquivos(e.item);
      if (!arquivos.some((a) => EXT_LETRA.test(a))) problemas.push(nome + ': nenhum arquivo de letra.');
      // licença ausente ou nula: não há o que conferir
      const conferir = arquivos.concat(e.item.licenca !== undefined && e.item.licenca !== null ? [e.item.licenca] : []);
      for (const a of conferir) {
        if (!nomeSimples(a)) { problemas.push(nome + ': "' + a + '" não é um arquivo da pasta das letras.'); continue; }
        citados.add(a);
        if (!existe.has(a)) problemas.push(nome + ': o arquivo ' + a + ' não existe na pasta das letras.');
      }
    }
    for (const a of [...existe].filter((x) => EXT_LETRA.test(x)).sort(comparar)) {
      if (!citados.has(a)) problemas.push('A letra ' + a + ' da pasta não está no familias.json.');
    }
    const familias = new Set(lista.map((e) => (typeof e.familia === 'string' ? e.familia.trim() : '')));
    if (dados.pares !== undefined && !Array.isArray(dados.pares)) problemas.push('"pares" precisa ser uma lista.');
    (Array.isArray(dados.pares) ? dados.pares : []).forEach((p, i) => {
      const nomePar = p && p.nome ? p.nome : 'número ' + (i + 1);
      for (const papel of ['titulo', 'texto']) {
        const valor = p && (papel === 'titulo' ? p.titulo || p.principal : p.texto || p.corpo || p.mono);
        if (!familias.has(valor)) problemas.push('Par "' + nomePar + '": a letra "' + valor + '" (' + papel + ') não está na lista.');
      }
    });
    return problemas;
  }

  const api = {
    extrair, papeis, completar, deImagem, deArquivo, listaDeLetras, conferirFamilias, tomQuePassa,
    // contraste entre dois códigos de cor (ou listas rgb); código inválido dá erro em português
    contraste: (a, b) => {
      const x = rgbDe(a); const y = rgbDe(b);
      if (!x || !y) throw new Error('Código da cor inválido: ' + JSON.stringify(x ? b : a) + ' (use #RRGGBB).');
      return contraste(x, y);
    },
    // o código da cor em #RRGGBB maiúsculo, ou null se não for cor
    codigo: (cor) => { const x = rgbDe(cor); return x ? codigo(x) : null; },
    PAPEIS, CLASSIFICACOES,
  };
  global.CoresDoLogo = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
