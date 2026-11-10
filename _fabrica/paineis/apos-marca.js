// Depois da marca: o ponto único que o servidor dos painéis chama depois de toda gravação de marca feita pelo painel
// (gravar, desfazer e a marca que nasce de um estilo), para a empresa do pedido.
//
// É aqui que as prévias na marca são refeitas: o gatilho pede a lista de prévias da marca de hoje (08-FERRAMENTAS/
// biblioteca/fila-marca.js, pedir: só grava a lista) e depois garante o trabalhador (garantirTrabalhador: lança, em segundo
// plano e destacado, quem faz as imagens e os vídeos; um só por Fábrica, e nada se não há trabalho). Marca desfeita (sem
// marca definida): nada a pedir — a lista já mostra "sem-marca" sozinha quando perguntada. Nunca lança erro e nunca segura a
// resposta: o gatilho roda depois (depoisDaMarca chama com setImmediate), e um erro dele só vai para o console do
// servidor (na linha de comando do escrever.js, quem chama o gatilho direto mostra o aviso); a marca já gravada não é desfeita por isso. O lançador é trocável (`lancar`), como na rota /api/previas-marca.
'use strict';
const previasMarca = require('../../08-FERRAMENTAS/biblioteca/previas-marca');
const filaMarca = require('../../08-FERRAMENTAS/biblioteca/fila-marca');

// O gatilho de hoje: pede as prévias na marca de hoje da empresa `codigo`, se ela tiver marca definida. Devolve true quando
// pediu (false: sem marca, nada a pedir).
function gatilhoPadrao({ lancar, semTrabalhador = false } = {}) {
  return (r, codigo) => {
    const { definida } = previasMarca.assinaturaDaMarca(r, codigo);
    if (!definida) return false; // marca foi desfeita: nada a pedir (SEM_MARCA seria esperado, não um erro de verdade)
    filaMarca.pedir(r, codigo);
    // um erro aqui sobe para quem chamou: depoisDaMarca o manda ao console; a linha de comando do escrever.js avisa a pessoa
    if (!semTrabalhador) filaMarca.garantirTrabalhador(r, lancar ? { lancar } : {});
    return true;
  };
}

// Chama o gatilho (o dado, ou o padrão) para a empresa `codigo`, sem esperar por ele. Devolve true se havia gatilho.
function depoisDaMarca(r, codigo, { gatilho, lancar } = {}) {
  const fn = typeof gatilho === 'function' ? gatilho : gatilhoPadrao({ lancar });
  if (typeof fn !== 'function') return false;
  setImmediate(() => {
    try {
      Promise.resolve(fn(r, codigo)).catch((e) => console.error('Depois da marca (' + codigo + '):', e));
    } catch (e) {
      console.error('Depois da marca (' + codigo + '):', e);
    }
  });
  return true;
}

module.exports = { depoisDaMarca, gatilhoPadrao };
