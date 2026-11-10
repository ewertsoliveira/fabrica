// As duas páginas da organização da pasta, em HTML local, sem rede e sem nada de fora (nem letra, nem imagem, nem
// script): a prévia (antes de confirmar, gravada numa pasta temporária FORA da Fábrica) e o relatório (depois de
// organizar, em empresas/principal/historico/). Só monta o texto da página a partir dos dados que o migrar.js entrega;
// quem grava é o migrar.js.
//
// Todo texto que vem da pasta da pessoa (o nome da empresa, o nome das linhas, as mensagens que citam esses nomes) é
// escapado: aparece como texto, nunca vira parte da página. Sem caminho de arquivo e sem termo técnico.
'use strict';

const escapar = (s) => String(s === null || s === undefined ? '' : s)
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Cores em rgb() e letras genéricas do sistema (a matriz não leva cor em hexadecimal nem nome de letra).
const ESTILO = `
  :root { --escuro: rgb(30, 32, 36); --claro: rgb(246, 244, 239); --branco: rgb(255, 255, 255);
    --acento: rgb(38, 102, 168); --linha: rgb(214, 210, 202); --texto-2: rgb(92, 94, 98);
    --acento-leve: rgb(226, 234, 242); --aviso-leve: rgb(244, 232, 210); --erro: rgb(150, 36, 36);
    --erro-leve: rgb(246, 226, 224); --ok: rgb(30, 104, 64); --ok-leve: rgb(222, 238, 228); }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body { background: var(--claro); color: var(--escuro); font: 16px/1.5 system-ui, sans-serif; overflow-x: hidden; }
  h1, h2, h3 { font-family: ui-serif, serif; font-weight: 600; margin: 0; }
  .topo { background: var(--escuro); color: var(--claro); padding: 22px 20px; }
  .topo h1 { font-size: 26px; line-height: 1.15; }
  .topo p { margin: 4px 0 0; opacity: .85; }
  .faixa { padding: 10px 20px; font-weight: 600; background: var(--acento-leve); border-bottom: 1px solid var(--linha); }
  .faixa.erro { background: var(--erro-leve); color: var(--erro); }
  .faixa.ok { background: var(--ok-leve); color: var(--ok); }
  main { max-width: 920px; margin: 0 auto; padding: 18px 16px 48px; }
  h2 { font-size: 20px; margin: 26px 0 10px; }
  .numeros { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .numeros div { background: var(--branco); border: 1px solid var(--linha); border-radius: 10px; padding: 10px 12px; min-width: 0; }
  .numeros b { display: block; font: 700 24px/1.1 ui-serif, serif; }
  .numeros span { font-size: 13px; color: var(--texto-2); }
  .cartoes { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
  .cartao { background: var(--branco); border: 1px solid var(--linha); border-radius: 10px; padding: 10px 12px; min-width: 0; overflow-wrap: anywhere; }
  .cartao h3 { font-size: 16px; }
  .cartao .conta { color: var(--texto-2); font-size: 14px; margin: 2px 0 6px; }
  .cartao ul { list-style: none; margin: 0; padding: 0; font-size: 14px; }
  .cartao li { display: flex; justify-content: space-between; gap: 8px; padding: 3px 0; border-top: 1px solid var(--linha); }
  .cartao li span:last-child { color: var(--texto-2); white-space: nowrap; }
  .caixa { margin-top: 12px; border-radius: 10px; padding: 10px 12px; background: var(--acento-leve); overflow-wrap: anywhere; }
  .caixa.aviso { background: var(--aviso-leve); }
  .caixa.erro { background: var(--erro-leve); color: var(--erro); }
  .caixa b { display: block; margin-bottom: 2px; }
  .caixa ul { margin: 4px 0 0; padding-left: 20px; }
  .miudo { margin-top: 26px; font-size: 13px; color: var(--texto-2); }
  @media (max-width: 560px) {
    .topo { padding: 18px 16px; }
    .faixa { padding: 10px 16px; }
    .numeros { grid-template-columns: minmax(0, 1fr); }
    .cartoes { grid-template-columns: minmax(0, 1fr); }
  }
`;

function documento(titulo, corpo) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
${corpo}
</body>
</html>
`;
}

// Um cartão por conjunto (marca, laboratório, cada linha...), com as partes dele.
function cartoes(conjuntos) {
  return `<div class="cartoes">${conjuntos.map((c) => `
  <section class="cartao" data-conjunto="${escapar(c.chave)}" data-arquivos="${c.arquivos}">
    <h3>${escapar(c.rotulo)}</h3>
    <p class="conta">${escapar(c.conta)}</p>
    <ul>${c.partes.map((p) => `<li data-grupo="${escapar(p.grupo)}" data-linha="${escapar(p.linha || '')}" data-arquivos="${p.arquivos}"><span>${escapar(p.rotulo)}</span><span>${escapar(p.conta)}</span></li>`).join('')}</ul>
  </section>`).join('')}
</div>`;
}

const lista = (itens) => `<ul>${itens.map((x) => `<li>${escapar(x)}</li>`).join('')}</ul>`;

// O que continua no mesmo lugar (sem lugar definido, atalhos e o que é do modelo).
function continua(d) {
  const l = [];
  if (d.semLugar) l.push(d.textoSemLugar);
  if (d.atalhos) l.push(d.textoAtalhos);
  l.push(d.textoDoModelo);
  return `<h2>Continua no mesmo lugar</h2>${lista(l)}`;
}

// d: { nome, conjuntos, total: { arquivos, tamanho }, semLugar, atalhos, textoSemLugar, textoAtalhos, textoDoModelo,
//      jaNoLugar (texto ou null), enderecos (texto ou null), avisos: [texto], recusas: [texto] }
function paginaPrevia(d) {
  const recusa = d.recusas.length
    ? `<div class="faixa erro" data-recusas="${d.recusas.length}">Ainda não dá para organizar agora. Nada foi alterado.</div>` : '';
  const corpo = `<header class="topo"><h1>Prévia da organização</h1><p>${escapar(d.nome)} · nada foi alterado</p></header>
${recusa}
<main data-total-arquivos="${d.total.arquivos}">
  ${d.recusas.length ? `<div class="caixa erro"><b>Ainda não dá para organizar agora</b>${lista(d.recusas)}</div>` : ''}
  <div class="numeros">
    <div><b>${d.total.arquivos}</b><span>${d.total.arquivos === 1 ? 'arquivo vai' : 'arquivos vão'} para a pasta da empresa</span></div>
    <div><b>${escapar(d.total.tamanho)}</b><span>no total</span></div>
    <div><b>0</b><span>apagados: os de antes ficam onde estão</span></div>
  </div>
  <h2>O que vai para a pasta da empresa</h2>
  ${cartoes(d.conjuntos)}
  ${d.jaNoLugar ? `<div class="caixa">${escapar(d.jaNoLugar)}</div>` : ''}
  ${d.enderecos ? `<div class="caixa">${escapar(d.enderecos)}</div>` : ''}
  ${continua(d)}
  ${d.avisos.length ? `<div class="caixa aviso"><b>Avisos</b>${lista(d.avisos)}</div>` : ''}
  <div class="caixa"><b>Os de antes ficam onde estão</b>Eles viram a cópia de segurança. Nada é apagado, e dá para desfazer depois.</div>
  <p class="miudo">Para organizar, responda na conversa. Esta página só mostra; ela não muda nada.</p>
</main>`;
  return documento('Prévia da organização', corpo);
}

// A faixa do alto do relatório muda com o que aconteceu depois (organizada, de antes guardados, desfeita).
function faixaDoRelatorio(situacao, quando) {
  if (situacao === 'desfeita') return `<div class="faixa ok" data-situacao="desfeita">Desfeita em ${escapar(quando)}: a pasta voltou a ser como era antes. Nada foi apagado.</div>`;
  if (situacao === 'retirada') return `<div class="faixa" data-situacao="retirada">Em ${escapar(quando)}, os arquivos de antes foram guardados na cópia de segurança. A Fábrica usa a pasta da empresa, e nada foi apagado.</div>`;
  return '<div class="faixa" data-situacao="aplicada">Abra uma conversa nova para continuar.</div>';
}

// d: os mesmos campos da prévia, mais { feitaEm, carimbo, fraseDesfazer }.
function paginaRelatorio(d, { situacao = 'aplicada', quando = '' } = {}) {
  const corpo = `<header class="topo"><h1>Organização da pasta</h1><p>${escapar(d.nome)} · ${escapar(d.feitaEm)}</p></header>
${faixaDoRelatorio(situacao, quando)}
<main data-total-arquivos="${d.total.arquivos}">
  <div class="numeros">
    <div><b>${d.total.arquivos}</b><span>${d.total.arquivos === 1 ? 'arquivo copiado e conferido' : 'arquivos copiados e conferidos, um por um'}</span></div>
    <div><b>${escapar(d.total.tamanho)}</b><span>no total</span></div>
    <div><b>0</b><span>apagados</span></div>
  </div>
  <h2>O que mudou de lugar</h2>
  ${cartoes(d.conjuntos)}
  ${d.jaNoLugar ? `<div class="caixa">${escapar(d.jaNoLugar)}</div>` : ''}
  ${d.enderecos ? `<div class="caixa">${escapar(d.enderecos)}</div>` : ''}
  ${continua(d)}
  ${d.avisos.length ? `<div class="caixa aviso"><b>Avisos</b>${lista(d.avisos)}</div>` : ''}
  ${situacao === 'aplicada' ? '<div class="caixa"><b>Os de antes</b>Continuam onde estavam, intactos, como cópia de segurança.</div>' : ''}
  ${situacao === 'desfeita' ? '' : `<div class="caixa"><b>Como desfazer</b>${escapar(d.fraseDesfazer)}</div>`}
  <p class="miudo">Código desta organização: ${escapar(d.carimbo)}.</p>
</main>`;
  return documento('Organização da pasta', corpo);
}

module.exports = { paginaPrevia, paginaRelatorio, escapar };
