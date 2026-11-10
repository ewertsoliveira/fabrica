// Leitor de YAML mínimo, compartilhado pelo leitor de marca (marca.js) e pelo leitor de empresas
// (_fabrica/core/empresa.js). Só usa o Node.
'use strict';

// Cobre o que o contrato usa: mapas por indentação, escalares (texto, número, booleano), listas em linha [a, b],
// mapas em linha { a: 1, b: [x, y] } e listas em bloco (- item). Comentário só quando o # vem depois de espaço e
// fora de aspas.
function tiraComentario(linha) {
  let aspas = null;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) { if (c === aspas && linha[i - 1] !== '\\') aspas = null; continue; }
    if (c === '"' || c === "'") aspas = c;
    else if (c === '#' && (i === 0 || /\s/.test(linha[i - 1]))) return linha.slice(0, i);
  }
  return linha;
}
function escalar(v) {
  const s = v.trim();
  if (s === '') return null;
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1).replace(/\\"/g, '"');
  if (s.startsWith('[') && s.endsWith(']')) {
    const dentro = s.slice(1, -1).trim();
    return dentro ? partesNoNivel(dentro).map(escalar) : [];
  }
  if (s.startsWith('{') && s.endsWith('}')) {
    const dentro = s.slice(1, -1).trim();
    const obj = {};
    if (!dentro) return obj;
    for (const parte of partesNoNivel(dentro)) {
      const kv = chaveValor(parte.trim());
      if (!kv) throw new Error(`marca: item de mapa em linha não é "chave: valor": ${parte.trim()}`);
      obj[kv.chave] = escalar(kv.valor);
    }
    return obj;
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}
// Divide "a, [b, c], { d: e }" nas vírgulas do nível de fora, respeitando aspas e colchetes ou chaves aninhados.
function partesNoNivel(texto) {
  const partes = []; let atual = '', aspas = null, prof = 0;
  for (const c of texto) {
    if (aspas) { atual += c; if (c === aspas) aspas = null; continue; }
    if (c === '"' || c === "'") { aspas = c; atual += c; continue; }
    if (c === '[' || c === '{') prof++;
    else if (c === ']' || c === '}') prof--;
    if (c === ',' && prof === 0) { partes.push(atual); atual = ''; continue; }
    atual += c;
  }
  partes.push(atual);
  return partes;
}
function chaveValor(texto) {
  // chave pode estar entre aspas ("empresa exemplo": "...")
  const m = /^("([^"]*)"|'([^']*)'|[^:]+?)\s*:(\s+(.*))?$/.exec(texto);
  if (!m) return null;
  return { chave: m[2] ?? m[3] ?? m[1].trim(), valor: m[5] ?? '' };
}
function lerYaml(texto) {
  const linhas = texto.split(/\r?\n/).map((l, n) => ({ n: n + 1, cru: tiraComentario(l).replace(/\s+$/, '') }))
    .filter((l) => l.cru.trim() !== '').map((l) => ({ ...l, ind: l.cru.length - l.cru.trimStart().length, txt: l.cru.trim() }));
  let i = 0;
  function bloco(ind) {
    if (i < linhas.length && linhas[i].txt.startsWith('- ') && linhas[i].ind === ind) {
      const lista = [];
      while (i < linhas.length && linhas[i].ind === ind && linhas[i].txt.startsWith('- ')) {
        const resto = linhas[i].txt.slice(2); i++;
        const kv = chaveValor(resto);
        if (kv && !/^["']/.test(resto.trim()) || (kv && /^["'][^"']*["']\s*:/.test(resto.trim()))) {
          const obj = { [kv.chave]: kv.valor === '' ? bloco(ind + 2) : escalar(kv.valor) };
          while (i < linhas.length && linhas[i].ind === ind + 2 && !linhas[i].txt.startsWith('- ')) {
            const k2 = chaveValor(linhas[i].txt); i++;
            obj[k2.chave] = k2.valor === '' ? bloco(ind + 4) : escalar(k2.valor);
          }
          lista.push(obj);
        } else lista.push(escalar(resto));
      }
      return lista;
    }
    const obj = {};
    while (i < linhas.length && linhas[i].ind === ind) {
      const l = linhas[i];
      const kv = chaveValor(l.txt);
      if (!kv) throw new Error(`marca: linha ${l.n} não é "chave: valor": ${l.txt}`);
      i++;
      if (/^[>|][+-]?$/.test(kv.valor.trim())) {
        // texto em bloco: ">" junta as linhas com espaço, "|" mantém as quebras
        const partes = [];
        while (i < linhas.length && linhas[i].ind > ind) { partes.push(linhas[i].txt); i++; }
        obj[kv.chave] = partes.join(kv.valor.trim().startsWith('>') ? ' ' : '\n');
      } else if (kv.valor === '') obj[kv.chave] = i < linhas.length && linhas[i].ind > ind ? bloco(linhas[i].ind) : null;
      else obj[kv.chave] = escalar(kv.valor);
    }
    if (i < linhas.length && linhas[i].ind > ind) throw new Error(`marca: indentação inesperada na linha ${linhas[i].n}`);
    return obj;
  }
  return bloco(0);
}

module.exports = { lerYaml };
