// Base do caminho inverso: estilos de carrossel aprovados virando modelos de Reels. Cada estilo entra só com o que é
// dele (fontes, cores, moldura, forma do destaque, telas e enfeites); esta base cuida do que é regra para todos:
//   - o vídeo da pessoa fica limpo, sem grade, faixa ou véu por cima, e perto do original;
//   - nada cobre o rosto: o título vai abaixo do queixo e o B-roll segue um dos arranjos (pedido.rosto.layout);
//   - o rosto em miniatura só entra depois que a imagem de destaque já está na tela.
// pedido.rosto.y: altura do rosto no vídeo de origem (px, 0-1920), para as janelas enquadrarem a pessoa.
// Marca (ctx.marca, do tema-marca.js): os papéis escuro, claro, acento e neutro de def.cores viram os da empresa; as letras
// titulo e leg viram a principal, rot a mono, e tituloDest e legDest a principal (ou, com destaque em itálico e principal
// sem itálico, a de acento da marca ou a do estilo). A nota (letra de mão) fica sempre a do estilo. def.papeisFontes liga
// outras letras do estilo a um papel (ex.: { numero: 'principal' }). Sem marca, as cores e as letras são as do estilo.
const path = require('path');
const { agrupa, EASE, hex, comAlfa, limpa, norm, elipse, retangulo, retArredondado, estrela } = require('../motor');
const { docLinha, comVar, ehDestaque, pessoaEmJanela, cenaEmJanela, pessoaRecortadaReduzida, enquadre } = require('./_comum');
const temaMarca = require('../tema-marca');
const TEX = (n) => path.join(__dirname, '..', 'texturas', n + '.png');

// janelas de cada arranjo, em pixels da tela (1080x1920): img = janela da imagem e s = escala da cena; pessoa = janela
// da pessoa e sp = escala dela; recorte = pessoa recortada do fundo; leg = altura da legenda com a imagem na tela
const ARRANJOS = {
  'imagem-mini': { img: { x: 624, y: 1000, w: 360, h: 360 }, s: 47, leg: 1460 },
  'rosto-mini': { img: { x: 150, y: 240, w: 780, h: 900 }, s: 72, pessoa: { x: 680, y: 1010, w: 320, h: 320 }, sp: 44, leg: 1470 },
  dividir: { img: { x: 190, y: 250, w: 700, h: 550 }, s: 70, pessoa: { x: 108, y: 860, w: 864, h: 560 }, sp: 80, leg: 1520 },
  // lado a lado: a imagem numa janela mais baixa que a da pessoa, para a foto preencher em vez de sobrar fundo
  'lado-a-lado': { img: { x: 560, y: 480, w: 480, h: 640 }, s: 71, pessoa: { x: 40, y: 300, w: 480, h: 1000 }, sp: 90, leg: 1440 },
  // no recorte, a pessoa termina acima da legenda, para o texto não cair sobre o corpo dela
  recorte: { img: { x: 84, y: 250, w: 516, h: 650 }, s: 62, recorte: { escala: 45, cx: 830, yBase: 1380 },
    pessoa: { x: 680, y: 1000, w: 320, h: 320 }, sp: 44, leg: 1490 },
  // não existe arranjo com a imagem sozinha: a pessoa nunca sai de cena quando o elemento visual entra
};
const CIRCULO_PESSOA = { cx: 820, cy: 1170, r: 165 };
const CIRCULO_IMAGEM = { cx: 800, cy: 1180, r: 180 };

module.exports = function criaModelo(def) {
  return {
    nome: def.nome,
    descricao: def.descricao,
    quadros: def.quadros || [0.3, 1.4, 2.8, 4.9, 6.2, 8.4, 12.8],
    capa: def.capa ?? 1.6,
    // troca a paleta inteira pelo ctx.marca: o vídeo deste modelo entra na prévia na marca (etapa 7)
    aceitaMarca: true,
    montar: (ctx) => montar(def, ctx),
  };
};

// limites de largura com a letra da marca (px): título alinhado a 96 px da borda; legenda e palavra final centralizadas
const LARGURA_TITULO = 888, LARGURA_LINHA = 936;

function montar(def, { P, DUR, palavras, pedido, cenas, acento, arquivoMatte, marca = null }) {
  // C: a paleta em uso (com a marca); C0: a do estilo, para quando a marca deixa um texto sem contraste
  const C = {}, C0 = {};
  for (const [k, v] of Object.entries(def.cores)) C0[k] = C[k] = hex(v);
  if (acento) C.acento = acento;
  if (marca) for (const k of temaMarca.PAPEIS_COR) if (marca.cores[k]) C[k] = hex(marca.cores[k]);
  const cor = (k) => (Array.isArray(k) ? k : C[k] || hex(k));
  const cor0 = (k) => (Array.isArray(k) ? k : C0[k] || hex(k));
  const F = {};
  // papel da marca de cada letra do estilo; o destaque em itálico só vai para a principal se ela tiver itálico. A nota é a
  // letra de mão do estilo (Caveat) e fica com qualquer marca: é a personalidade do estilo, só a cor muda (decisão D4)
  const PAPEIS = { titulo: 'principal', tituloDest: 'principal', leg: 'principal', legDest: 'principal', rot: 'mono', ...def.papeisFontes };
  const italicoNaPrincipal = !!marca && temaMarca.temItalico(marca, marca.fontes.principal ? P.fonte(marca.fontes.principal) : null);
  const papelDaLetra = (k) => ((k === 'tituloDest' || k === 'legDest') && PAPEIS[k] === 'principal' && def.destaque === 'italico' && !italicoNaPrincipal
    ? 'acento' : PAPEIS[k]);
  for (const [k, e] of Object.entries(def.fontes)) {
    const daMarca = marca && PAPEIS[k] ? temaMarca.letra(P, marca, papelDaLetra(k), e) : null;
    if (daMarca) { F[k] = daMarca; continue; }
    const fonte = P.fonte(e.arquivo);
    F[k] = { fonte, est: { ...e, style: e.style || fonte.style } };
  }
  const caixa = (s) => (def.caixaAlta ? s.toUpperCase() : s);
  const sombra = { color: [0, 0, 0, 0.65], blurRadius: 20, spreadRadius: 0, blendMode: 'normal', offset: [0, 3] };
  const entrada = def.entrada || 'fade';
  const anima = (camadas) => camadas.forEach((c) => P.fade(c, entrada, 'fade'));
  const importadas = new Set();
  const textura = (n) => { if (!importadas.has(n)) { P.importaImagem(n, TEX(n)); importadas.add(n); } return n; };

  // medidas: cada estilo mede de uma vez o que falta; a altura do 'H' alinha trechos de fontes diferentes na mesma linha
  const MED = {};
  const mede = (k, textos) => {
    const m = MED[k] = MED[k] || {};
    const falta = [...new Set(textos)].filter((t) => t && !(t in m));
    if (falta.length) Object.assign(m, P.medir(falta, F[k].est));
    return m;
  };
  const maiuscula = (k) => { const h = mede(k, ['H']).H; return { meio: (h.top + h.bottom) / 2, alt: h.bottom - h.top }; };

  // caber na tela: a letra da marca pode ser mais larga que a do estilo. A variante é a mesma letra noutro corpo, com
  // medidas próprias; a largura de uma linha é a soma dos trechos e dos espaços, como em linha()
  const variante = (k, size) => {
    if (size === F[k].est.size) return k;
    const nome = `${k}@${size}`;
    if (!F[nome]) F[nome] = { ...F[k], est: { ...F[k].est, size } };
    return nome;
  };
  const largura = (trechos, kb, kd) => {
    try {
      const mb = mede(kb, trechos.filter((t) => !t.dest).map((t) => t.texto));
      const md = mede(kd, trechos.filter((t) => t.dest).map((t) => t.texto));
      return trechos.reduce((s, t) => s + (t.dest ? md : mb)[t.texto].w, 0) + F[kb].est.size * 0.27 * (trechos.length - 1);
    } catch (e) {
      if (/maior que a área/.test(e.message)) return Infinity;
      throw e;
    }
  };
  // base e destaque encolhem juntos, 15% por vez (como a tela final do Neon), até a linha mais larga caber no limite, sem
  // passar de 40% do corpo original (piso de 16 px). Só com marca: sem ela, cada linha fica como sempre foi (a não ser a
  // que nem cabia na medição, que antes dava erro)
  function cabe(linhas, kb, kd, limite) {
    let b = kb, d = kd, f = 1;
    const piso = Math.max(16, F[kb].est.size * 0.4);
    for (;;) {
      const w = linhas.length ? Math.max(...linhas.map((l) => largura(l, b, d))) : 0;
      if (w <= limite || (!marca && w !== Infinity) || F[b].est.size * 0.85 < piso) return { kb: b, kd: d };
      f *= 0.85;
      b = variante(kb, Math.round(F[kb].est.size * f));
      d = variante(kd, Math.round(F[kd].est.size * f));
    }
  }

  // contraste: cada texto tem um papel de cor e um fundo. Na tela do estilo, o fundo é a tela (ou a tarja da linha); no vídeo
  // não há cor do estilo atrás, então vale o par de base (claro sobre escuro, escuro sobre claro). Com a marca:
  //   - texto no neutro (tom médio) da marca vai para outra cor da marca que lê 4,5:1 sobre o fundo real (decisão D2);
  //   - texto que fica abaixo de 3:1 sobre um fundo liso vai para o escuro da marca, se ele lê ali; a tela, a tarja ou a
  //     pílula continuam na cor da marca (decisão D1);
  //   - se nem assim, o texto volta ao par original do estilo e o log avisa.
  const avisos = new Set();
  const avisa = (msg, chave = msg) => { if (!avisos.has(chave)) { avisos.add(chave); console.warn('[marca] ' + msg); } };
  const igual = (p, q) => p.length === q.length && p.every((v, i) => v === q[i]);
  const mudou = (k) => !igual(cor(k), cor0(k));
  // 3:1 (texto grande, AA) sobre fundo liso do estilo; sobre o vídeo, que não é liso (roupa, cabelo, parede), 4,5:1
  const MIN_LISO = 3, MIN_VIDEO = 4.5;
  const parOk = (kt, kf, minimo = MIN_LISO) => (!mudou(kt) && !mudou(kf)) || temaMarca.contrasteOk(cor(kt), cor(kf), minimo);
  const fundoNoVideo = (kt) => (kt === 'escuro' ? 'claro' : 'escuro');
  // D2: o neutro da marca é um tom médio e fica fraco como texto. O texto no papel neutro vai para a cor da marca de mais
  // contraste (pelo menos 4,5:1) sobre o fundo real; no destaque, fora a cor do texto de base (base), para ele continuar
  // distinto (Gravura: o acento; Editorial: o claro). Nenhuma passa: fica o neutro, na regra de contraste de sempre
  function forte(kt, kf, base) {
    if (!marca || kt !== 'neutro' || !marca.cores.neutro) return null;
    const fundo = cor(kf);
    const melhor = ['claro', 'acento', 'escuro'].filter((p) => marca.cores[p] && p !== base)
      .map((p) => [cor(p), temaMarca.contraste(cor(p), fundo)]).filter(([, c]) => c >= MIN_VIDEO).sort((p, q) => q[1] - p[1])[0];
    return melhor ? melhor[0] : null;
  }
  // D1: texto sem contraste sobre um fundo liso da marca vai para o escuro da marca, se ele chega a 3:1 ali (null: não serve)
  const escuroSobre = (kt, kf) => (marca.cores.escuro && kt !== 'escuro' && temaMarca.contrasteOk(cor('escuro'), cor(kf), MIN_LISO)
    ? cor('escuro') : null);
  // cor do texto kt sobre o fundo liso kf, com a marca: o neutro forte (D2), a própria cor se lê, o escuro da marca (D1) ou
  // null (aí o par volta ao estilo)
  const corNaMarca = (kt, kf, base) => forte(kt, kf, base) || (parOk(kt, kf) ? cor(kt) : escuroSobre(kt, kf));
  const fundoNoDestaque = def.destaque === 'tarja' || def.destaque === 'pilula';
  // [papel do texto, papel do fundo, o fundo é só o par de base do vídeo] de um trecho (base ou destaque) de linha()
  function papeis(dest, video, kTexto) {
    const fundo = (kt) => (def.tarjaLinhas ? [def.tarjaLinhas, false] : video ? [fundoNoVideo(kt), true] : [def.tela.fundo, false]);
    if (!dest || (video && def.destaqueVideo === 'fio')) return [kTexto, ...fundo(kTexto)];
    if (fundoNoDestaque) return [def.corTextoDest || 'escuro', 'acento', false];
    const kt = !video && def.tela.destaque ? def.tela.destaque : def.corDestaque === 'texto' ? kTexto : def.corDestaque || 'acento';
    return [kt, ...fundo(kt)];
  }
  // tela cheia: a tela fica na cor da marca e cada texto dela vai para a cor que lê (corNaMarca); só se um texto não lê nem no
  // escuro da marca, a tela inteira (fundo e textos) volta ao estilo. Entra também a anotação, quando ela cai sobre a tela do
  // B-roll (todo arranjo menos imagem-mini). [papel do texto, papel do fundo, papel do texto de base (no destaque)]
  const layoutB = (pedido.rosto && pedido.rosto.layout) || def.layout || 'dividir';
  const notaNaTela = !!(pedido.anotacao && def.fontes.nota && cenas.length && layoutB !== 'imagem-mini');
  const paresTela = [[...papeis(false, false, def.tela.texto).slice(0, 2), null], [...papeis(true, false, def.tela.texto).slice(0, 2), def.tela.texto]];
  if (notaNaTela) paresTela.push([def.corNota || 'acento', def.tela.fundo, null]);
  const telaOriginal = !!marca && paresTela.some(([kt, kf, base]) => kf === def.tela.fundo && !corNaMarca(kt, kf, base));
  if (telaOriginal) avisa(`tela cheia: o texto fica sem contraste (abaixo de 3:1) sobre o fundo "${def.tela.fundo}" com as cores da marca, nem no escuro dela; usando o par original do estilo.`);
  const corTela = (k) => (telaOriginal ? cor0(k) : cor(k));
  // na volta ao estilo, se nem o par do estilo chega a 3:1 (ex.: anotação amarela na tela creme do Fanzine, quando o pedido
  // troca o arranjo), o texto vai no escuro ou no claro do estilo, o que contrastar mais com o fundo
  const legivel = (t, f) => (temaMarca.contrasteOk(t, f, MIN_LISO) ? t
    : [cor0('escuro'), cor0('claro')].sort((p, q) => temaMarca.contraste(q, f) - temaMarca.contraste(p, f))[0]);
  // [cor do texto, cor do fundo] de um par, já com a volta ao estilo quando falta contraste
  // (base: o papel do texto de base, quando kt é um destaque; ver forte())
  function corPar(kt, kf, { proxy = false, naTela = false, onde = 'texto', base = null } = {}) {
    if (!marca) return [cor(kt), cor(kf)];
    if (naTela && kf === def.tela.fundo) return telaOriginal ? [legivel(cor0(kt), cor0(kf)), cor0(kf)] : [corNaMarca(kt, kf, base), cor(kf)];
    const f = forte(kt, kf, base);
    if (f) return [f, cor(kf)];
    const minimo = proxy ? MIN_VIDEO : MIN_LISO;
    if (parOk(kt, kf, minimo) || (proxy && !mudou(kt))) return [cor(kt), cor(kf)];
    const e = proxy ? null : escuroSobre(kt, kf);
    if (e) return [e, cor(kf)];
    const tentouEscuro = !proxy && kt !== 'escuro' && !!marca.cores.escuro;
    avisa(`${onde}: "${kt}" ${proxy ? 'sobre o vídeo' : `sobre "${kf}"`} fica sem contraste (abaixo de ${String(minimo).replace('.', ',')}:1) com as cores da marca${tentouEscuro ? ', nem no escuro dela' : ''}; usando o par original do estilo.`,
      `${kt}|${kf}|${minimo}`);
    return proxy ? [cor0(kt), cor0(kf)] : [legivel(cor0(kt), cor0(kf)), cor0(kf)];
  }
  const corTrecho = (dest, video, kTexto, onde) => {
    const [kt, kf, proxy] = papeis(dest, video, kTexto);
    return corPar(kt, kf, { proxy, naTela: !video, onde, base: dest ? kTexto : null });
  };

  // forma do destaque atrás ou abaixo do trecho: tarja, pílula ou sublinhado que cresce da esquerda
  // (cresce: false = a forma já aparece cheia, no trecho depois do corte de uma palavra já dita)
  const decora = (nome, x, w, cy, alt, size, a, z, corFundo = C.acento, cresce = true) => {
    const d = def.destaque;
    let r = null;
    if (d === 'tarja' || d === 'pilula') {
      const h = alt * 1.7, pad = size * 0.14;
      r = P.ret(nome, a, z, [x - pad, cy - h / 2], [w + 2 * pad, h], corFundo, d === 'pilula' ? { raio: 1 } : {});
    } else if (d === 'sublinhado') {
      r = P.ret(nome, a, z, [x, cy + alt * 0.72], [w, Math.max(6, alt * 0.15)], C.acento);
    }
    if (!r) return [];
    if (cresce) P.kf(r, 'scaleX', [[0, 0], [180, 100, EASE.saida]]);
    return [r];
  };

  // uma linha de trechos [{ texto, dest, a? }]: kb é o estilo de base e kd o do destaque; texto é o papel da cor de base
  // (segue: a frase continua num trecho depois deste, do outro lado da borda do B-roll)
  function linha(nome, trechos, { kb, kd, x, alinhar, cy, a, z, video, texto: kTexto, segue = false }) {
    const onde = nome.startsWith('titulo') ? 'título' : nome === 'leg' ? 'legenda' : 'palavra final';
    const [corTexto, corTarja] = corTrecho(false, video, kTexto, onde);
    const [corDest, corFundoDest] = corTrecho(true, video, kTexto, onde);
    const mb = mede(kb, trechos.filter((t) => !t.dest).map((t) => t.texto));
    const md = mede(kd, trechos.filter((t) => t.dest).map((t) => t.texto));
    const esp = F[kb].est.size * 0.27;
    const ws = trechos.map((t) => (t.dest ? md : mb)[t.texto].w);
    const total = ws.reduce((s, w) => s + w, 0) + esp * (trechos.length - 1);
    let xi = alinhar === 'centro' ? x - total / 2 : x;
    const cb = maiuscula(kb), cd = maiuscula(kd);
    const camadas = [];
    if (def.tarjaLinhas) {
      const h = cb.alt * 1.7, pad = F[kb].est.size * 0.16;
      camadas.push(P.ret(nome + '-tarja', a, z, [xi - pad, cy - h / 2], [total + 2 * pad, h], corTarja));
    }
    trechos.forEach((t, k) => {
      const kk = t.dest ? kd : kb, m = (t.dest ? md : mb)[t.texto], ini = Math.max(a, t.a ?? a);
      // a frase cortada na borda do B-roll: o destaque dito depois do corte (ou a menos de 150 ms dele, que só piscaria) só
      // entra no trecho seguinte
      if (ini >= z || (segue && z - ini < 150)) { xi += ws[k] + esp; return; }
      // destaque dito antes do começo deste trecho (o trecho depois do corte): a forma já aparece cheia, sem crescer de novo
      const jaDito = t.dest && (t.a ?? a) < a;
      if (t.dest) camadas.push(...decora(nome + '-dst' + k, xi, ws[k], cy, cd.alt, F[kd].est.size, ini, z, fundoNoDestaque ? corFundoDest : C.acento, !jaDito));
      // acento escuro some sobre o cabelo: no vídeo, o destaque vai no creme com um fio fino de acento embaixo
      const fioNoVideo = t.dest && video && def.destaqueVideo === 'fio';
      if (fioNoVideo) {
        const f = P.ret(`${nome}-fio${k}`, ini, z, [xi, cy + cd.alt * 0.78], [ws[k], Math.max(4, cd.alt * 0.07)], C.acento);
        if (!jaDito) P.kf(f, 'scaleX', [[0, 0], [260, 100, EASE.saida]]);
        camadas.push(f);
      }
      const corT = t.dest ? corDest : corTexto; // papéis em papeis(): o destaque no fio do vídeo usa a cor de base
      const tx = P.texto(`${nome}-${k}`, ini, z, [Math.round(xi + ws[k] / 2), Math.round(cy)],
        comVar({ ...docLinha(F[kk].fonte, F[kk].est), text: t.texto, fillColor: corT }), [Math.round(m.x0 + m.w / 2), Math.round((t.dest ? cd : cb).meio)]);
      if (video && !def.tarjaLinhas && !(t.dest && fundoNoDestaque)) tx.dropShadow = sombra;
      camadas.push(tx);
      xi += ws[k] + esp;
    });
    return camadas;
  }

  // auxiliares entregues aos enfeites de cada estilo
  const H = {
    P, C, cor, textura, EASE, elipse, retangulo, retArredondado, estrela, comAlfa,
    // [cor do texto, cor do fundo] de um texto do enfeite sobre uma forma lisa do estilo: com a marca e abaixo de 3:1,
    // os dois voltam ao par do estilo (ex.: número da Cartilha, escuro sobre o círculo de acento)
    par: (kt, kf, onde) => corPar(kt, kf, { onde }),
    escreve(nome, a, z, [cx, cy], texto, k, corK, { rot = 0 } = {}) {
      const m = mede(k, [texto])[texto];
      return P.texto(nome, a, z, [cx, cy], comVar({ ...docLinha(F[k].fonte, F[k].est), text: texto, fillColor: cor(corK) }),
        [Math.round(m.x0 + m.w / 2), Math.round((m.top + m.bottom) / 2)], { rot });
    },
  };

  // tela cheia do estilo (B-roll e palavra final): fundo, textura e formas próprias
  function tela(nome, a, z) {
    const out = [P.ret(nome + '-fundo', a, z, [0, 0], [1080, 1920], corTela(def.tela.fundo))];
    if (def.tela.textura) out.push(P.imagem(textura(def.tela.textura), a, z, [540, 960], { fit: 'cover', opacidade: def.tela.opTextura ?? 100 }));
    if (def.tela.formas) out.push(...(def.tela.formas(H, a, z) || []));
    if (entrada === 'fade') out.forEach((c) => P.fade(c, 'fade', 'fade'));
  }

  // moldura de uma janela: borda cheia (também sombra dura e polaroide), ou fio a uma folga; acompanha a inclinação
  function moldura(nome, a, z, j, specs, rot = 0) {
    const out = [];
    for (const s of [].concat(specs || [])) {
      const c = cor(s.cor);
      if (j.r !== undefined) {
        const r = j.r + (s.tipo === 'fio' ? s.folga || 0 : s.largura || 0);
        out.push(P.forma(`${nome}-${s.tipo}`, a, z, elipse(j.cx + (s.dx || 0), j.cy + (s.dy || 0), r, r),
          s.tipo === 'fio' ? { traco: c, largura: s.largura || 3 } : { preenche: c }));
        continue;
      }
      const e = s.tipo === 'fio' ? s.folga || 0 : s.largura || 0;
      const base = s.tipo === 'polaroide' ? s.base || 70 : 0;
      const w = j.w + 2 * e, h = j.h + 2 * e + base;
      const cx = j.x + j.w / 2 + (s.dx || 0), cy = j.y + j.h / 2 + (s.dy || 0) + base / 2;
      const r = j.raio ? j.raio + e : 0;
      if (s.tipo === 'fio') {
        const f = P.forma(`${nome}-fio`, a, z, r ? retArredondado(-w / 2, -h / 2, w, h, r) : retangulo(-w / 2, -h / 2, w, h),
          { traco: c, largura: s.largura || 3, pos: [cx, cy] });
        f.transform.rotation = rot;
        out.push(f);
      } else {
        out.push(P.ret(`${nome}-${s.tipo}`, a, z, [cx, cy], [w, h], c, { anchor: [w / 2, h / 2], rot, raio: r ? (2 * r) / Math.min(w, h) : 0 }));
      }
    }
    return out;
  }

  P.video('video', 0, DUR, { volume: 1, durFonte: DUR });
  if (def.grade) {
    const tom = P.ajuste('tom', 0, DUR);
    if (def.grade.temperatura) P.efeito(tom, { type: 'temperatureTint', temperature: def.grade.temperatura, tint: def.grade.tint || 0 });
    if (def.grade.vinheta) P.efeito(tom, { type: 'vignette', amount: def.grade.vinheta, radius: 0.85, feather: 0.8 });
  }
  if (def.sobreVideo) def.sobreVideo(H, DUR);

  // abertura: rótulo, fio e título abaixo do queixo; a última linha assenta na mesma altura em todos os estilos
  const ch = pedido.chamada;
  let fimChamada = 0;
  if (ch) {
    const a = ch.ini * 1000, z = ch.fim * 1000; fimChamada = z;
    const ws = ch.texto.split(/\s+/).filter(Boolean);
    const pw = (ch.palavra || ws[0]).split(/\s+/).map(norm);
    const i0 = ws.findIndex((w, i) => pw.every((p, k) => norm(ws[i + k] || '') === p));
    const toks = ws.map((w, i) => ({ texto: caixa(w), dest: i0 >= 0 && i >= i0 && i < i0 + pw.length }));
    const linhas = []; let cur = [], len = 0;
    for (const t of toks) {
      if (cur.length && len + 1 + t.texto.length > (def.quebra || 13)) { linhas.push(cur); cur = []; len = 0; }
      cur.push(t); len += (len ? 1 : 0) + t.texto.length;
    }
    if (cur.length) linhas.push(cur);
    const segs = linhas.map((l) => l.reduce((acc, t) => {
      const u = acc[acc.length - 1];
      if (u && u.dest === t.dest) u.texto += ' ' + t.texto; else acc.push({ ...t });
      return acc;
    }, []));
    const alinhar = def.alinhar || 'esquerda', x = alinhar === 'centro' ? 540 : 96;
    // com a letra da marca, o título encolhe até a linha mais larga caber; a última linha fica na mesma altura
    const kt = cabe(segs, 'titulo', 'tituloDest', LARGURA_TITULO);
    const passo = F[kt.kb].est.size * (def.entrelinha || 1.06);
    const yUlt = def.tituloBase || 1490, y1 = yUlt - (segs.length - 1) * passo;
    segs.forEach((l, k) => {
      const camadas = linha('titulo-' + k, l, { kb: kt.kb, kd: kt.kd, x, alinhar, cy: y1 + k * passo, a: a + 200 + k * 120, z, video: true, texto: def.corTexto || 'claro' });
      camadas.forEach((c) => P.fade(c, entrada === 'pop' ? 'pop' : 'softRise', 'fade'));
    });
    const rotulo = def.rotulo || {};
    const txt = rotulo.colchetes ? `[ ${pedido.rotulo || 'REELS'} ]` : pedido.rotulo || 'REELS';
    // com marca, o rótulo encolhe até caber (na pílula, a folga de 22 px de cada lado entra na conta)
    const kRot = cabe([[{ texto: txt, dest: false }]], 'rot', 'rot', (alinhar === 'centro' ? LARGURA_LINHA : LARGURA_TITULO) - (rotulo.fundo ? 44 : 0)).kb;
    const mR = mede(kRot, [txt])[txt];
    const yR = y1 - passo * 0.5 - (rotulo.fundo ? 70 : 56);
    const cxR = alinhar === 'centro' ? 540 : x + mR.w / 2;
    const kR = rotulo.cor || 'claro';
    const [corR, corRFundo] = corPar(kR, rotulo.fundo || fundoNoVideo(kR), { proxy: !rotulo.fundo, onde: 'rótulo' });
    if (rotulo.fundo) {
      const w = mR.w + 44, h = (mR.bottom - mR.top) + 30;
      const f = P.ret('rot-fundo', a, z, [cxR - w / 2, yR - h / 2], [w, h], corRFundo, rotulo.pilula ? { raio: 1 } : {});
      P.fade(f, 'fade', 'fade');
    }
    const r = P.texto('rot', a, z, [cxR, yR], comVar({ ...docLinha(F[kRot].fonte, F[kRot].est), text: txt, fillColor: corR }),
      [Math.round(mR.x0 + mR.w / 2), Math.round((mR.top + mR.bottom) / 2)]);
    if (!rotulo.fundo) r.dropShadow = sombra;
    P.fade(r, 'fade', 'fade');
    if (def.fio) {
      const yF = yR - 50, x0 = alinhar === 'centro' ? 470 : x;
      const f = P.forma('fio', a + 150, z, { commands: [{ type: 'moveTo', x: x0, y: yF }, { type: 'lineTo', x: x0 + 140, y: yF }] }, { traco: cor(def.fio), largura: 3, trim: 0, cap: 'butt' });
      P.kf(f, 'trimEnd', [[0, 0], [600, 100, EASE.saida]]);
    }
  }

  // B-roll no arranjo escolhido; a pessoa entra um instante depois da imagem
  const rosto = pedido.rosto || {}, layout = rosto.layout || def.layout || 'dividir', rostoY = rosto.y ?? 600;
  const G = { ...ARRANJOS[layout] };
  // o estilo pode ajustar a imagem pequena e a legenda dela (def.imagemMini = { img, leg }): o Fanzine, com a imagem girada
  // e a fita, desce e encolhe o cartão para longe da mandíbula (decisão D7)
  if (layout === 'imagem-mini' && def.imagemMini) Object.assign(G, def.imagemMini);
  if (layout === 'imagem-mini' && def.imagemCirculo) G.img = CIRCULO_IMAGEM;
  if (def.raio && G.img.r === undefined) G.img = { ...G.img, raio: def.raio };
  const janelas = [];
  for (const b of cenas.slice(0, 1)) {
    const a = b.ini * 1000, z = b.fim * 1000; janelas.push([a, z]);
    if (layout !== 'imagem-mini') tela('broll', a, z);
    const j = G.img, rot = j.r === undefined ? def.rotImg || 0 : 0;
    if (def.antesImg) anima(def.antesImg(H, a, z, j) || []);
    const mi = moldura('img', a, z, j, def.moldura, rot);
    const img = cenaEmJanela(P, b.id, a, z, j, { escala: G.s });
    if (rot) img.transform.rotation = rot;
    anima([...mi, img]);
    if (def.enfeiteImg) anima(def.enfeiteImg(H, a, z, j, layout) || []);
    if (pedido.anotacao && F.nota) {
      const pos = layout === 'imagem-mini' ? [300, 1170] : j.r !== undefined ? [j.cx, j.cy - j.r - 60] : [j.x + j.w * 0.7, j.y - 56];
      const kN = def.corNota || 'acento', sobreVideo = layout === 'imagem-mini';
      const [corN] = corPar(kN, sobreVideo ? fundoNoVideo(kN) : def.tela.fundo, { proxy: sobreVideo, naTela: !sobreVideo, onde: 'anotação' });
      // com marca, a anotação (centrada em pos) encolhe até caber entre as margens de 72 px
      const kNota = cabe([[{ texto: pedido.anotacao, dest: false }]], 'nota', 'nota', Math.min(LARGURA_LINHA, 2 * (Math.min(pos[0], 1080 - pos[0]) - 72))).kb;
      anima([H.escreve('nota', a + 300, z, pos, pedido.anotacao, kNota, corN, { rot: -5 })]);
    }
    const ap = a + 250;
    let feito = false;
    if (G.recorte) {
      if (def.fundoRecorte) anima(def.fundoRecorte(H, ap, z) || []);
      // com círculo atrás (def.recorteForma) o corpo fica DENTRO dele; sem círculo, o corpo se dissolve na base
      const forma = def.recorteForma;
      const p = pessoaRecortadaReduzida(P, ap, z, { ...G.recorte, ...(forma ? { forma, cx: forma.cx } : { desvanece: def.recorteDesvanece ?? 170 }), durFonte: DUR, arquivoMatte });
      if (p) { anima([p]); feito = true; }
    }
    if (!feito && G.pessoa) {
      let jp = G.pessoa;
      if ((layout === 'rosto-mini' || G.recorte) && def.pessoaForma === 'circulo') jp = CIRCULO_PESSOA;
      if (def.raio && jp.r === undefined) jp = { ...jp, raio: def.raio };
      const mp = moldura('pessoa', ap, z, jp, def.molduraPessoa || def.moldura);
      // janela pequena (círculo ou quadrado): a cabeça fica acima do centro e o queixo longe da borda
      const pequena = jp.r !== undefined || Math.min(jp.w, jp.h) <= 360;
      const enq = pequena ? enquadre(jp, rostoY, { cabeca: rosto.cabeca }) : { escala: G.sp, rostoY };
      anima([...mp, pessoaEmJanela(P, ap, z, jp, { ...enq, durFonte: DUR })]);
    }
  }

  // tela da palavra final, com a forma de destaque do estilo
  const tf = pedido.palavraTela;
  let jTela = null;
  if (tf) {
    const a = tf.ini * 1000, z = Math.min(DUR, tf.fim * 1000); jTela = [a, z];
    tela('tela', a, z);
    const pal = def.caixaAlta ? tf.texto.toUpperCase() : limpa(tf.texto.toLowerCase());
    const kp = cabe([[{ texto: pal, dest: true }]], 'tituloDest', 'tituloDest', LARGURA_LINHA);
    linha('tela', [{ texto: pal, dest: true }], { kb: kp.kb, kd: kp.kd, x: 540, alinhar: 'centro', cy: 960, a: a + 150, z, video: false, texto: def.tela.texto })
      .forEach((c) => P.fade(c, entrada === 'pop' ? 'pop' : 'softRise', 'none'));
  }

  // legenda em frases; a palavra de destaque acende na forma do estilo quando é falada
  const destaque = ehDestaque(pedido);
  const grupos = agrupa(palavras, { maxPalavras: def.legPalavras || 4, maxChars: def.legChars || 20, pausa: 400 })
    .filter((g) => g.ini >= fimChamada && !(jTela && g.ini >= jTela[0]));
  const legendas = [];
  for (const g of grupos) {
    const fim = jTela ? Math.min(g.fim, jTela[0]) : g.fim; // a legenda sai quando a tela final entra
    if (fim - g.ini < 150) continue;
    const noCartao = janelas.some(([x, y]) => g.ini < y && fim > x);
    const emTela = noCartao && layout !== 'imagem-mini';
    const trechos = [];
    g.palavras.forEach((p) => {
      const d = destaque(p.w), u = trechos[trechos.length - 1], t = caixa(limpa(p.w));
      if (u && u.dest === d) u.texto += ' ' + t; else trechos.push({ texto: t, dest: d, a: d ? p.ini : g.ini });
    });
    legendas.push({ g, fim, noCartao, emTela, trechos });
  }
  // com a letra da marca, todas as frases encolhem juntas até a mais larga caber (o corpo da legenda não pula de frase a frase)
  const kl = cabe(legendas.map((l) => l.trechos), 'leg', 'legDest', LARGURA_LINHA);
  // a frase que atravessa a borda da tela do B-roll é cortada na borda, com ou sem marca: o trecho sobre a tela fica na cor e
  // na altura da tela, o trecho sobre o vídeo na cor e na altura do vídeo (a cor da tela, escura, não lê sobre a camiseta).
  // As palavras já ditas continuam na tela (decisão D7: antes, sem marca, a frase inteira ficava na cor da tela).
  const dentro = (t) => janelas.some(([x, y]) => t >= x && t < y);
  function cortes(a, z) {
    const bordas = [...new Set(janelas.flat())].filter((t) => t > a && t < z).sort((p, q) => p - q);
    const pts = [a, ...bordas, z];
    return pts.slice(1).map((t, i) => [pts[i], t, dentro(pts[i])]);
  }
  for (const { g, fim, noCartao, emTela, trechos } of legendas) {
    const partes = emTela ? cortes(g.ini, fim) : [[g.ini, fim, noCartao]];
    // o trecho que sobra do corte com menos de 150 ms só piscaria: sai (a mesma regra da frase inteira, acima); o resto da
    // frase continua do outro lado da borda, na cor e na altura de lá
    const ficam = partes.filter(([a, z]) => z - a >= 150);
    ficam.forEach(([a, z, cartao], i) => {
      const naTela = emTela && cartao;
      linha('leg', trechos, { kb: kl.kb, kd: kl.kd, x: 540, alinhar: 'centro', cy: cartao ? G.leg : def.legY || 1420, a, z,
        video: !naTela, texto: naTela ? def.tela.texto : def.corTexto || 'claro', segue: i < ficam.length - 1 })
        .forEach((c) => P.fade(c, 'fade', 'none'));
    });
  }

  // barra de progresso fina, como a das lâminas
  if (def.barra) {
    P.ret('barra-trilho', 0, DUR, [84, 1820], [912, 6], comAlfa(cor(def.barra.trilho || 'claro'), 0.3));
    const barra = P.ret('barra', 0, DUR, [84, 1820], [912, 6], cor(def.barra.cor || 'acento'));
    P.kf(barra, 'scaleX', [[0, 0], [DUR, 100, EASE.linear]]);
  }
}
