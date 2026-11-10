// Sugestão de cores legíveis: quando uma cor da marca fica difícil de ler sobre um fundo, o painel não só avisa, mas
// sugere até 3 cores que passam no contraste e combinam com a marca, para a pessoa escolher em "Personalizar".
//
//   sugerir({ papel, cores: { escuro, claro, acento, neutro }, fundo: '#RRGGBB' | { amostras: ['#RRGGBB', ...] }, minimo = 4.5 })
//     -> até 3 [{ papel, cor: '#RRGGBB', contraste, origem: 'da-marca' | 'tom-da-marca' | 'neutro', rotulo }]
//
// Ordem: primeiro as cores da própria marca que passam (a de mais contraste primeiro); depois a menor mudança de luz da
// cor com problema, mantendo o matiz (mais escura ou mais clara, a mais perto primeiro); por fim um tom com folga. Tom
// que vira quase preto, quase branco ou perde o matiz não conta como tom da marca; sem nenhum tom fiel, vêm branco e
// preto (os que passarem), com origem 'neutro' e rótulo "Branco" ou "Preto". Com um
// fundo de várias amostras (degradê, foto), vale o pior contraste entre elas. Nunca devolve opção que não passe no
// mínimo: sem nenhuma, devolve uma lista vazia. `contraste` sai arredondado para baixo (nunca promete mais do que tem).
// A conta de contraste e o ajuste de tom são os das cores do logo (_fabrica/paineis/cores-do-logo.js).
// Funciona no Node (require) e no navegador (LegibilidadeDaMarca, com cores-do-logo.js carregado antes).
'use strict';
(function (global) {
  const base = typeof module !== 'undefined' && module.exports
    ? require('../../_fabrica/paineis/cores-do-logo.js')
    : global.CoresDoLogo;
  if (!base) throw new Error('A sugestão de cores legíveis precisa do cores-do-logo.js carregado antes, na mesma página.');
  const { contraste, codigo, tomQuePassa, PAPEIS } = base;
  const DO = { escuro: 'do escuro', claro: 'do claro', acento: 'do acento', neutro: 'do neutro' };
  const O = { escuro: 'o escuro', claro: 'o claro', acento: 'o acento', neutro: 'o neutro' };
  const FOLGA = 1.5; // o tom "com folga" passa com essa margem acima do mínimo

  function sugerir(pedido) {
    const { papel, cores, fundo } = pedido || {};
    const minimo = pedido && pedido.minimo !== undefined ? pedido.minimo : 4.5;
    if (!PAPEIS.includes(papel)) throw new Error('Diga o papel da cor que precisa de ajuda: escuro, claro, acento ou neutro (veio ' + JSON.stringify(papel) + ').');
    if (!cores || typeof cores !== 'object' || Array.isArray(cores)) throw new Error('Mande as cores da marca (escuro, claro, acento, neutro).');
    const marca = {};
    for (const [p, v] of Object.entries(cores)) {
      if (!PAPEIS.includes(p)) throw new Error('Papel de cor desconhecido: ' + p + ' (use escuro, claro, acento ou neutro).');
      if (v === null || v === undefined || v === '') continue;
      const c = codigo(v);
      if (!c) throw new Error('Código da cor inválido para ' + p + ': ' + JSON.stringify(v) + ' (use #RRGGBB).');
      marca[p] = c;
    }
    if (!marca[papel]) throw new Error('Falta a cor ' + DO[papel] + ', que é a que precisa de ajuda.');
    const lista = typeof fundo === 'string' ? [fundo] : fundo && typeof fundo === 'object' && Array.isArray(fundo.amostras) ? fundo.amostras : null;
    const fundos = lista ? lista.map(codigo) : [];
    if (!fundos.length || fundos.some((f) => !f)) throw new Error('O fundo precisa ser um código de cor (#RRGGBB) ou uma lista de amostras do fundo, cada uma um código de cor.');
    if (typeof minimo !== 'number' || !Number.isFinite(minimo) || minimo < 1 || minimo > 21) throw new Error('O contraste mínimo vai de 1 a 21 (o padrão é 4,5).');

    const pior = (c) => Math.min(...fundos.map((f) => contraste(c, f)));
    const passa = (c) => pior(c) >= minimo;
    const saida = [];
    const vistos = new Set();
    const por = (cor, origem, rotulo) => {
      if (saida.length >= 3 || vistos.has(cor) || !passa(cor)) return;
      vistos.add(cor);
      saida.push({ papel, cor, contraste: Math.floor(pior(cor) * 100) / 100, origem, rotulo });
    };

    // 1. as cores da própria marca que passam, a de mais contraste primeiro (empate: a ordem dos papéis)
    PAPEIS.filter((p) => marca[p] && passa(marca[p]))
      .sort((a, b) => pior(marca[b]) - pior(marca[a]) || PAPEIS.indexOf(a) - PAPEIS.indexOf(b))
      .forEach((p) => por(marca[p], 'da-marca', p === papel ? 'A cor atual já dá para ler' : 'Usar ' + O[p] + ' da marca'));

    // 2. a menor mudança de luz da cor com problema, mantendo o matiz
    const atual = marca[papel];
    for (const tom of tomQuePassa(atual, passa)) por(tom.cor, 'tom-da-marca', 'Um tom mais ' + tom.direcao + ' ' + DO[papel]);

    // 3. um tom com folga, no lado da menor mudança (para fundos que variam, como foto e degradê)
    const [perto] = tomQuePassa(atual, passa);
    if (perto) {
      const folga = tomQuePassa(atual, (c) => pior(c) >= Math.min(21, minimo + FOLGA)).find((t) => t.direcao === perto.direcao);
      if (folga) por(folga.cor, 'tom-da-marca', 'Um tom ainda mais ' + folga.direcao + ' ' + DO[papel]);
    }

    // 4. sem nenhum tom que mantenha o matiz: branco e preto, ditos como são (nunca como tom da marca)
    if (!saida.some((s) => s.origem === 'tom-da-marca')) {
      [[codigo([255, 255, 255]), 'Branco'], [codigo([0, 0, 0]), 'Preto']]
        .sort((a, b) => pior(b[0]) - pior(a[0]))
        .forEach(([cor, rotulo]) => por(cor, 'neutro', rotulo));
    }
    return saida;
  }

  const api = { sugerir, contraste, tomQuePassa };
  global.LegibilidadeDaMarca = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
