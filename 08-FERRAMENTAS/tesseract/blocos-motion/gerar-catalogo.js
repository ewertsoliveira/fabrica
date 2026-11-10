// Gera catalogo.html e as miniaturas em catalogo/*.png: cada bloco renderizado pelo Tesseract (tsrct preview) em estados-chave,
// sobre um quadro de teste (exemplo/fundo-teste.jpg), com parâmetros e o JSON de exemplo.
//   node gerar-catalogo.js            (renderiza tudo e escreve catalogo.html)
//   node gerar-catalogo.js --so-html  (só reescreve o HTML com as miniaturas que já existem)
// Só usa `tsrct preview`: nenhum export.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { criarBase } = require('./criar-base');
const T = require('./tsrct');
const marca = require('../../marca/marca');
const fontesMarca = require('../fontes');
const { BLOCOS, montar } = require('./index');

const DIR = __dirname;
require('fs').mkdirSync(require('path').join(__dirname, '.work'), { recursive: true });
const CAT = path.join(DIR, 'catalogo');
const FUNDO = path.join(DIR, '.work', 'fundo-teste.png');
// quadro de teste neutro (cinza com vinheta), gerado na hora: o catálogo não depende de nenhuma foto
function garanteFundo() {
  if (fs.existsSync(FUNDO)) return;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x5a6068:s=1080x1920:d=1', '-vf', 'vignette=PI/3,noise=alls=12:allf=t', '-frames:v', '1', FUNDO]);
}
const urlFonte = (papel) => 'file:///' + marca.caminho(marca.pega('tipografia.' + papel + '.arquivo', '')).replace(/\\/g, '/');
const SO_HTML = process.argv.includes('--so-html');
const iT = process.argv.indexOf('--tipos');
const TIPOS = iT >= 0 ? process.argv[iT + 1].split(',') : null; // renderiza só esses tipos e reaproveita o resto de catalogo/estados.json

// variantes: bloco = JSON do contrato; estados = [rotulo, segundo | (tempos) => segundo]
const VARIANTES = [
  { tipo: 'placa', titulo: 'Placa com kicker', bloco: BLOCOS.placa.exemplo,
    estados: [['entrando', (b) => b.inicio + 0.2], ['cheia', (b) => b.inicio + 1.6], ['saindo', (b) => b.fim - 0.08]] },
  { tipo: 'placa', titulo: 'Placa de gancho (sem kicker, corte seco)',
    bloco: { id: 'gancho-regra', tipo: 'placa', inicio: 0, fim: 3.5,
      textos: { linhas: ['HOJE:', 'COMEÇA A REGRA X', 'AVISE O SEU CLIENTE'] }, opcoes: { entrada: 'corte' } },
    estados: [['primeiro quadro', () => 0.0], ['fim', (b) => b.fim - 0.1]] },
  { tipo: 'selo', titulo: 'Selo com sub-linha', bloco: BLOCOS.selo.exemplo,
    estados: [['antes do pop', (b) => b.inicio + 0.1], ['pop', (b) => b.inicio + 0.38], ['repouso', (b) => b.inicio + 1.2], ['saindo', (b) => b.fim - 0.08]] },
  { tipo: 'selo', titulo: 'Selo compacto',
    bloco: { id: 'selo-compacto', tipo: 'selo', inicio: 10, fim: 12.5, textos: { linha: 'SEM CUSTO EXTRA' }, opcoes: { formato: 'compacto', y: 281 } },
    estados: [['repouso', (b) => b.inicio + 1.0]] },
  { tipo: 'esquema-divisao', titulo: 'Esquema: uma barra que se divide', bloco: BLOCOS['esquema-divisao'].exemplo,
    estados: [['1 · resumo', (b, T_) => T_.cheioDestaque + 0.6], ['2 · hoje', (b, T_) => T_.setaDepois + 0.7],
      ['3 · se abre', (b, T_) => T_.abre + 0.5], ['3 · cada parte no seu destino', (b, T_) => T_.restante + 0.6]] },
  { tipo: 'mapa-pontos', titulo: 'Mapa de pontos (exemplo fictício)', bloco: BLOCOS['mapa-pontos'].exemplo,
    estados: [['primeiro país', (b, T_) => T_.paises[0] + 0.45], ['três países', (b, T_) => T_.rotulos[2] + 0.7],
      ['em foco: risco', (b, T_) => T_.risco + 0.5], ['final', (b, T_) => T_.nota + 0.7]] },
  { tipo: 'ficha-documento', titulo: 'Ficha de documento', bloco: BLOCOS['ficha-documento'].exemplo,
    estados: [['entrando', (b) => b.inicio + 0.5], ['campos', (b) => b.inicio + 1.6], ['completa', (b) => b.fim - 0.4]] },
  { tipo: 'diagrama-caixas', titulo: 'Diagrama de duas caixas', bloco: BLOCOS['diagrama-caixas'].exemplo,
    estados: [['caixas e seta', (b, T_) => T_.pontas + 0.4], ['moldura e etiqueta', (b, T_) => T_.moldura + 1.0],
      ['selo 1', () => 21.7 + 0.5], ['selo 2 com sub-linha', (b) => b.fim - 0.2]] },
  { tipo: 'cartao-cta', titulo: 'Cartão final', bloco: BLOCOS['cartao-cta'].exemplo,
    estados: [['entrando', (b) => b.inicio + 0.2], ['argumento', (b) => b.inicio + 0.38], ['com o botão', (b) => b.inicio + 1.8]] },
  { tipo: 'contador', titulo: 'Contador: número que sobe na frase', bloco: BLOCOS.contador.exemplo,
    estados: [['começando', (b, T_) => T_.contaDe + 0.15], ['no meio', (b, T_) => (T_.contaDe + T_.contaAte) / 2], ['valor final', (b) => b.fim - 0.4]] },
  { tipo: 'lista-marcavel', titulo: 'Lista marcável com item em destaque', bloco: BLOCOS['lista-marcavel'].exemplo,
    estados: [['itens', (b) => b.inicio + 1.2], ['2 marcados', () => 9.2], ['destaque antes de marcar', () => 10.6], ['completa', (b) => b.fim - 0.5]] },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (t) => `${t.toFixed(2).replace('.', ',')} s`;

function render() {
  fs.mkdirSync(CAT, { recursive: true });
  garanteFundo();
  const tmp = path.join(DIR, '.work', 'catalogo.tsrct');
  const saida = [];
  const antes = fs.existsSync(path.join(CAT, 'estados.json')) ? JSON.parse(fs.readFileSync(path.join(CAT, 'estados.json'), 'utf8')) : [];
  VARIANTES.forEach((v, vi) => {
    if (TIPOS && !TIPOS.includes(v.tipo) && antes[vi]) { saida.push({ ...v, ...antes[vi] }); return; }
    const dur = Math.ceil(v.bloco.fim + 2);
    criarBase(tmp, FUNDO, dur);
    const mont = montar([v.bloco]);              // para pegar os tempos resolvidos
    const Tm = mont.blocos[0].tempos || {};
    const { aplicar } = require('./aplicar');
    aplicar(tmp, [v.bloco]);
    const estados = [];
    v.estados.forEach(([rotulo, f], ei) => {
      const t = Number(f(v.bloco, Tm).toFixed(2));
      const arq = `${v.tipo}-${vi + 1}-${ei + 1}.png`;
      const cru = path.join(DIR, '.work', 'q.png');
      T.preview(tmp, t, cru);
      // recorta a faixa das placas (y 860 a 1620) e reduz para 810 px de largura
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', cru, '-vf', 'crop=1080:760:0:860,scale=810:-1', path.join(CAT, arq)]);
      estados.push({ rotulo, t, arq });
      console.log('ok', arq, t);
    });
    saida.push({ ...v, estados, id: `${v.tipo}-${vi + 1}` });
  });
  fs.writeFileSync(path.join(CAT, 'estados.json'), JSON.stringify(saida.map(({ bloco, ...r }) => r), null, 1));
  return saida;
}

function html(variantes) {
  const porTipo = {};
  variantes.forEach((v) => { (porTipo[v.tipo] = porTipo[v.tipo] || []).push(v); });
  const secoes = Object.entries(porTipo).map(([tipo, vs]) => {
    const m = BLOCOS[tipo];
    const campos = Object.entries(m.campos || {}).map(([k, d]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(d)}</td></tr>`).join('');
    const cartoes = vs.map((v) => `
      <div class="variante">
        <h3>${esc(v.titulo)}</h3>
        <div class="tiras">${v.estados.map((e) => `<figure><img loading="lazy" src="catalogo/${e.arq}" alt="${esc(v.titulo)}: ${esc(e.rotulo)}"><figcaption><b>${esc(e.rotulo)}</b> · ${fmt(e.t)}</figcaption></figure>`).join('')}</div>
        <details><summary>JSON deste exemplo</summary><pre>${esc(JSON.stringify(v.bloco, null, 2))}</pre></details>
      </div>`).join('');
    return `
    <section id="${tipo}">
      <header><span class="tag">${esc(tipo)}</span><p>${esc(m.descricao)}</p></header>
      ${cartoes}
      <details class="params"><summary>Parâmetros</summary><table>${campos}</table></details>
    </section>`;
  }).join('\n');
  const nav = Object.keys(porTipo).map((t) => `<a href="#${t}">${t}</a>`).join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Blocos de motion · ${esc(marca.empresa.nome || 'Fábrica de Conteúdo')}</title>
<style>
@font-face { font-family: 'MarcaPrincipal'; src: url('${urlFonte('principal')}'); font-weight: 100 900; }
@font-face { font-family: 'MarcaMono'; src: url('${urlFonte('mono')}'); font-weight: 400; }
:root { --escuro: ${marca.hex('escuro')}; --claro: ${marca.hex('claro')}; --neutro: ${marca.hex('neutro')}; --acento: ${marca.hex('acento')}; --linha: color-mix(in srgb, var(--claro) 12%, transparent); --painel: color-mix(in srgb, var(--claro) 6%, var(--escuro)); --texto2: color-mix(in srgb, var(--claro) 80%, var(--escuro)); }
* { box-sizing: border-box; }
body { margin: 0; background: var(--escuro); color: var(--claro); font-family: 'MarcaPrincipal', system-ui, sans-serif; line-height: 1.5; }
main { max-width: 1180px; margin: 0 auto; padding: 0 16px 80px; }
.topo { padding: 56px 0 24px; border-bottom: 1px solid var(--linha); }
.topo .kicker { font-family: 'MarcaMono', monospace; letter-spacing: .22em; font-size: 13px; color: var(--neutro); text-transform: uppercase; }
.topo .kicker::before { content: ''; display: inline-block; width: 28px; height: 4px; background: var(--acento); margin-right: 12px; vertical-align: middle; }
h1 { font-weight: 900; font-size: clamp(34px, 6vw, 64px); letter-spacing: -.03em; line-height: 1.02; margin: 14px 0 12px; font-stretch: 108%; }
h1 em { font-style: normal; color: var(--acento); }
.topo p { max-width: 70ch; color: var(--texto2); margin: 0 0 6px; }
nav { position: sticky; top: 0; z-index: 5; display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 0; background: rgba(14,14,15,.94); border-bottom: 1px solid var(--linha); }
nav a { font-family: 'MarcaMono', monospace; font-size: 12px; color: var(--claro); text-decoration: none; border: 1px solid var(--linha); border-radius: 999px; padding: 6px 12px; }
nav a:hover { border-color: var(--acento); color: var(--acento); }
section { padding: 40px 0 8px; border-bottom: 1px solid var(--linha); scroll-margin-top: 60px; }
section header { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: baseline; margin-bottom: 8px; }
.tag { font-family: 'MarcaMono', monospace; font-size: 22px; background: var(--acento); color: var(--escuro); padding: 2px 12px; border-radius: 8px; font-weight: 400; }
section header p { margin: 0; color: var(--texto2); flex: 1 1 320px; }
h3 { font-size: 16px; font-weight: 700; margin: 26px 0 10px; letter-spacing: -.01em; }
.tiras { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); gap: 14px; }
figure { margin: 0; background: var(--painel); border: 1px solid var(--linha); border-radius: 14px; overflow: hidden; }
figure img { display: block; width: 100%; height: auto; }
figcaption { font-family: 'MarcaMono', monospace; font-size: 12px; padding: 8px 12px; color: var(--neutro); }
figcaption b { color: var(--claro); font-weight: 400; }
details { margin: 12px 0; }
summary { cursor: pointer; font-family: 'MarcaMono', monospace; font-size: 13px; color: var(--neutro); }
summary:hover { color: var(--acento); }
pre { background: var(--painel); border: 1px solid var(--linha); border-radius: 12px; padding: 14px 16px; overflow-x: auto; font-family: 'MarcaMono', monospace; font-size: 12.5px; line-height: 1.55; color: var(--claro); }
table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 14px; }
td { border-top: 1px solid var(--linha); padding: 8px 10px 8px 0; vertical-align: top; }
td:first-child { width: 36%; }
code { font-family: 'MarcaMono', monospace; font-size: 12.5px; color: var(--acento); }
.convencoes { padding: 40px 0 0; }
.convencoes h2 { font-size: 22px; letter-spacing: -.02em; }
.convencoes li { margin: 6px 0; color: var(--texto2); }
footer { color: var(--neutro); font-size: 13px; padding-top: 30px; font-family: 'MarcaMono', monospace; }
</style>
</head>
<body>
<main>
  <div class="topo">
    <div class="kicker">Fábrica de Conteúdo · ${esc(marca.empresa.nome || '')}</div>
    <h1>Blocos de <em>motion</em> do Tesseract</h1>
    <p>Cada bloco é montado por JSON (textos e tempos) e renderizado pelo próprio Tesseract. As imagens abaixo são quadros reais, em estados-chave da animação, sobre um quadro de teste neutro, com as cores e fontes do contrato de marca.</p>
    <p>Contrato único: <code>{ id, tipo, inicio, fim, textos, opcoes }</code>. Cada bloco devolve as camadas e a janela <code>{ id, inicio, fim }</code> para o export em pedaços.</p>
  </div>
  <nav>${nav}<a href="LEIA-ME.md">LEIA-ME</a></nav>
  ${secoes}
  <div class="convencoes">
    <h2>O que a biblioteca já resolve</h2>
    <ul>
      <li>Dois keyframes no mesmo track repetem o instante 0 e o Tesseract recusa o lote inteiro: o núcleo junta tudo por camada e propriedade.</li>
      <li>Texto centralizado na vertical sai cerca de 0,38 do corpo acima do centro: o núcleo compensa.</li>
      <li>Formas ignoram alfa e opacidade fracionária: as cores suaves já vêm pré-misturadas à cor escura da placa.</li>
      <li>Retângulo criado por ação não aceita sombra: o cartão final é desenhado sem sombra.</li>
      <li>Placas ficam na faixa y 955 a 1305, abaixo do queixo medido; <code>--faixa y0,y1</code> move o conjunto.</li>
    </ul>
  </div>
  <footer>Gerado por gerar-catalogo.js · exemplos com tema fictício (regra X), não são fatos.</footer>
</main>
</body>
</html>`;
}

let dados;
if (SO_HTML) {
  const est = JSON.parse(fs.readFileSync(path.join(CAT, 'estados.json'), 'utf8'));
  dados = VARIANTES.map((v, i) => ({ ...v, ...est[i] }));
} else dados = render();
fs.writeFileSync(path.join(DIR, 'catalogo.html'), html(dados));
console.log('catalogo.html escrito');
