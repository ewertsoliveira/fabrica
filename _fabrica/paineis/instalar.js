// Instala um painel de uma empresa, sem sobrescrever nada que já exista.
// O painel só passa a existir quando chega o primeiro conteúdo dele (peça ou post): quem chama é o registrar.js.
// Os dados e o COMO-ACESSAR.md ficam na pasta da empresa (na pasta antiga, onde sempre ficaram); os atalhos de
// abrir o Laboratório são um par só por Fábrica, na pasta principal.
'use strict';
const fs = require('fs');
const path = require('path');
const { caminhos } = require('./dados');

const MODELOS = path.join(__dirname, 'modelos');
const ATALHOS = ['Abrir Laboratório de Design.bat', 'Abrir Laboratório de Design.command'];

// Cria o arquivo só se não existir (flag 'wx'). Devolve true quando criou.
function criarSeAusente(destino, conteudo, modo) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  try {
    fs.writeFileSync(destino, conteudo, { flag: 'wx', mode: modo });
  } catch (e) {
    if (e.code === 'EEXIST') return false;
    throw e;
  }
  return true;
}

// `codigo` é a empresa; sem ele, a ativa (como em dados.caminhos).
function instalar(painel, r, codigo) {
  const c = caminhos(r, codigo);
  const criados = [];
  const registrar = (destino, conteudo, modo) => {
    if (criarSeAusente(destino, conteudo, modo)) criados.push(path.relative(r, destino).split(path.sep).join('/'));
  };
  const modelo = (nome) => fs.readFileSync(path.join(MODELOS, nome));
  // O git do Windows pode trocar o fim de linha ao baixar o modelo: o atalho do Mac precisa de LF e o do Windows de CRLF.
  const atalho = (nome) => {
    const txt = modelo(nome).toString('utf8').replace(/\r\n/g, '\n');
    return nome.endsWith('.bat') ? txt.replace(/\n/g, '\r\n') : txt;
  };

  if (painel === 'laboratorio') {
    registrar(c.aprovacoes, '{}\n');
    registrar(c.pecas, '[]\n');
    registrar(path.join(c.pastaLaboratorio, 'COMO-ACESSAR.md'), modelo('COMO-ACESSAR-laboratorio.md'));
    for (const nome of ATALHOS) registrar(path.join(r, nome), atalho(nome), nome.endsWith('.command') ? 0o755 : 0o644);
  } else if (painel === 'cronograma') {
    registrar(c.posts, '[]\n');
    registrar(c.config, JSON.stringify({ titulo: '', periodo: '', pessoas: [], aprovadores: [] }, null, 2) + '\n');
    registrar(path.join(c.pastaCronograma, 'COMO-ACESSAR.md'), modelo('COMO-ACESSAR-cronograma.md'));
  } else {
    throw new Error(`painel desconhecido: ${painel} (use "laboratorio" ou "cronograma")`);
  }
  return { criados };
}

module.exports = { instalar };
