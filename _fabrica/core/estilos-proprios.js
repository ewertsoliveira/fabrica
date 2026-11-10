// A regra única de um estilo próprio de empresa, usada pelo molde (08-FERRAMENTAS/carrossel/molde.js), pelo catálogo do painel
// (_fabrica/paineis/biblioteca.js) e pela escolha do estilo (_fabrica/core/escolha.js): o que um deles aceita, os outros também
// aceitam, e o que um recusa, os outros recusam.
//
// Um estilo próprio mora em <estilosProprios da empresa>/<id>/estilo.yaml e vale quando:
// - o código é simples: minúsculas sem acento, números e "-", até 64 (vai para caminho e para classe CSS);
// - nem a pasta de estilos próprios, nem a pasta do estilo são atalho (junção ou link): o caminho real é o que o caminho diz,
//   e o estilo nunca é o de outra empresa;
// - o estilo.yaml é um arquivo de verdade, legível e um objeto, com `origem: referencias`.
//
// Só lê; sem dependência de marca (pode ser carregado pelo painel sem fixar a marca da empresa ativa).
'use strict';
const fs = require('fs');
const path = require('path');
const { lerYaml } = require('../../08-FERRAMENTAS/marca/yaml');

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const BOM_INICIO = new RegExp('^' + String.fromCharCode(0xfeff)); // montado pelo código: nenhum caractere invisível aqui

const codigoValido = (id) => typeof id === 'string' && ID.test(id);
const ehAtalho = (p) => { try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; } };
const realOuNull = (p) => { try { return fs.realpathSync.native(p); } catch { return null; } };
const mesmoCaminho = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const ehArquivo = (p) => { try { return fs.lstatSync(p).isFile(); } catch { return false; } };
const erro = (code, mensagem) => Object.assign(new Error(mensagem), { code });

// A pasta de estilos próprios, conferida: o caminho real, ou null se ela não existe. Atalho: erro ATALHO.
function pastaReal(pasta) {
  const p = path.resolve(String(pasta));
  const real = realOuNull(p);
  if (!real) return null;
  const esperado = path.join(realOuNull(path.dirname(p)) || path.dirname(p), path.basename(p));
  if (ehAtalho(p) || !mesmoCaminho(real, esperado)) throw erro('ATALHO', 'a pasta de estilos próprios é um atalho (junção ou link); nada foi lido');
  return real;
}

// A pasta do estilo `id` dentro da pasta de estilos próprios, conferida: { dir, arquivo } (caminhos reais).
// Erros (com `code`): CODIGO, AUSENTE, ATALHO.
function pastaDoEstilo(pasta, id) {
  if (!codigoValido(id)) {
    throw erro('CODIGO', `o código do estilo próprio ${JSON.stringify(String(id).slice(0, 60))} não serve: use só letras minúsculas sem acento, números e "-" (até 64)`);
  }
  const base = pastaReal(pasta);
  if (!base) throw erro('AUSENTE', `estilo não encontrado: ${id} (a pasta de estilos próprios ${pasta} não existe)`);
  const dir = path.join(base, id);
  if (ehAtalho(dir)) throw erro('ATALHO', `estilo próprio ${id}: a pasta do estilo é um atalho (junção ou link); nada foi lido`);
  const real = realOuNull(dir);
  let ehPasta = false;
  try { ehPasta = !!real && fs.statSync(real).isDirectory(); } catch { ehPasta = false; }
  if (!ehPasta) throw erro('AUSENTE', `estilo não encontrado: ${id} (esperado ${path.join(dir, 'estilo.yaml')})`);
  if (!mesmoCaminho(real, dir)) throw erro('ATALHO', `estilo próprio ${id}: a pasta do estilo é um atalho (junção ou link); nada foi lido`);
  const arquivo = path.join(dir, 'estilo.yaml');
  if (ehAtalho(arquivo)) throw erro('ATALHO', `estilo próprio ${id}: o estilo.yaml é um atalho (junção ou link); nada foi lido`);
  if (!ehArquivo(arquivo)) throw erro('AUSENTE', `estilo não encontrado: ${id} (esperado ${arquivo})`);
  return { dir, arquivo };
}

// O estilo próprio lido e conferido: { id, dir, arquivo, y }. Erros: os de pastaDoEstilo, YAML e ORIGEM.
function lerEstilo(pasta, id) {
  const { dir, arquivo } = pastaDoEstilo(pasta, id);
  let y;
  try { y = lerYaml(fs.readFileSync(arquivo, 'utf8').replace(BOM_INICIO, '')); } catch (e) { throw erro('YAML', `estilo próprio ${id}: o estilo.yaml não dá para ler (${e.message})`); }
  if (!y || typeof y !== 'object' || Array.isArray(y)) throw erro('YAML', `estilo próprio ${id}: o estilo.yaml não é um estilo`);
  if (y.origem !== 'referencias') throw erro('ORIGEM', `estilo próprio ${id}: um estilo próprio tem origem: referencias`);
  return { id, dir, arquivo, y };
}

// Os códigos dos estilos próprios da pasta, em ordem: código válido, pasta de verdade e estilo.yaml presente (o conteúdo é
// conferido por lerEstilo). Pasta que não existe ou é atalho: [].
function listar(pasta) {
  let base;
  try { base = pastaReal(pasta); } catch { return []; }
  if (!base) return [];
  let entradas;
  try { entradas = fs.readdirSync(base, { withFileTypes: true }); } catch { return []; }
  return entradas.filter((e) => e.isDirectory() && !e.isSymbolicLink() && codigoValido(e.name)).map((e) => e.name)
    .filter((id) => { try { pastaDoEstilo(base, id); return true; } catch { return false; } })
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

module.exports = { ID, codigoValido, pastaReal, pastaDoEstilo, lerEstilo, listar, ehAtalho };
