// Biblioteca de mockups nativos em HTML e CSS para peças de feed (regras M-01 a M-08 do Núcleo).
// O cromo de cada plataforma imita a interface real (M-03); o conteúdo de dentro (fotos de perfil, posts, botões de
// aplicativo, marcadores) é pintado pelas cores do marca.yaml. Todo texto fica entre o piso de interface
// (canvas.pisos-ui.corpo) e o piso de corpo da peça (canvas.pisos.corpo), como pede o M-04.
//
// Uso:
//   const mk = require('<...>/08-FERRAMENTAS/mockups/mockups');
//   const html = mk.post({ modo: 'claro', usuario: 'lia.exemplo', titulo: 'Três erros no café da manhã' });
//   const pagina = `<style>${mk.css()}</style>${html}`;
//   mk.temaSobre('escuro') -> 'claro'   (M-06: sobre fundo escuro, interface clara com sombra forte)
//   mk.comMarcadores(html, [{ n: 1, x: 20, y: 30 }])   (M-08: x e y em % do mockup)
// Cada componente aceita `modo: 'claro' | 'escuro'` e dados próprios; sem dados, usa um exemplo fictício em português.
'use strict';
const path = require('path');
const marca = require(path.join(__dirname, '..', 'marca', 'marca'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------- escala (M-04)
const pisosUi = marca.pega('canvas.pisos-ui', { titulo: 40, corpo: 28 });
const pisos = marca.pega('canvas.pisos', { titulo: 72, corpo: 44, micro: 32 });
const ESCALA = (() => {
  const min = pisosUi.corpo;
  const max = Math.max(pisos.corpo, min);
  const entre = (f) => Math.round(min + (max - min) * f);
  return { rotulo: min, texto: entre(0.25), nome: entre(0.5), titulo: Math.min(pisosUi.titulo, max), destaque: max };
})();

// ---------------------------------------------------------------- cores
// Paleta: a do marca.yaml, ou outra passada por usarCores() (a prévia de um estilo mostra as cores que ele sugere).
let paleta = null;
const hex = (papel) => (paleta && paleta[papel] ? paleta[papel].toUpperCase() : marca.hex(papel));
const usarCores = (cores) => { paleta = cores || null; };
const luminancia = (hex) => {
  const v = parseInt(hex.replace('#', ''), 16);
  const c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
// Texto legível sobre uma cor da marca: claro ou escuro da própria marca, o que der mais contraste.
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const textoSobre = (fundoHex) => (contraste(fundoHex, hex('claro')) >= contraste(fundoHex, hex('escuro')) ? hex('claro') : hex('escuro'));
// Texto no tom de uma cor da marca que passa em 4,5:1 sobre o fundo, com folga para a tinta clara da pílula atrás dele
// (mira 5:1): escurece (ou clareia) aos poucos até passar.
// Acento claro (azul-claro, ciano, âmbar) como texto sobre o cartão branco some; assim ele fica no tom e legível.
function legivel(corHex, fundoHex) {
  const alvo = contraste(fundoHex, '#000000') >= contraste(fundoHex, '#FFFFFF') ? [0, 0, 0] : [255, 255, 255];
  const rgb = [1, 3, 5].map((i) => parseInt(corHex.slice(i, i + 2), 16));
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const c = '#' + rgb.map((v, k) => Math.round(v + (alvo[k] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
    if (contraste(c, fundoHex) >= 5) return c;
  }
  return alvo[0] ? '#FFFFFF' : '#000000';
}
// M-06: sobre fundo escuro, o mockup é claro (e leva sombra forte); sobre fundo claro, pode ser qualquer um.
function temaSobre(fundo) {
  const valor = marca.PAPEIS.includes(fundo) ? hex(fundo) : fundo;
  return luminancia(valor) < 0.35 ? 'claro' : 'claro-ou-escuro';
}

// ---------------------------------------------------------------- ícones (traço, viewBox 24)
const IC = {
  coracao: '<path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4 7.4 4c2 0 3.6 1.1 4.6 2.7C13 5.1 14.6 4 16.6 4c3.5 0 5.8 3.6 4.6 7.1-1.7 4.8-9.2 9.4-9.2 9.4z"/>',
  comentario: '<path d="M20.6 16.5A9 9 0 1 0 17 20l3.6 1-1-4.5z"/>',
  enviar: '<path d="M22 3 9.2 10.2M22 3l-6.5 18-3.3-7.7L3 10.6z"/>',
  salvar: '<path d="M19 21l-7-5.5L5 21V3h14z"/>',
  grade: '<rect x="3" y="3" width="18" height="18"/><path d="M9 3V21M15 3V21M3 9H21M3 15H21"/>',
  reels: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M3 8h18M8 3l3 5M14 3l3 5"/><path d="M10 12v5l4.5-2.5z"/>',
  marcado: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="12" cy="10" r="3"/><path d="M6.5 19c1-3 3-4 5.5-4s4.5 1 5.5 4"/>',
  menu: '<path d="M3 6H21M3 12H21M3 18H21"/>',
  mais: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
  voltar: '<path d="M15 4 7 12l8 8"/>',
  lupa: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  pontos: '<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>',
  telefone: '<path d="M5 3h3.5l2 5-2.5 1.5a11 11 0 0 0 6.5 6.5l1.5-2.5 5 2V19a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  video: '<rect x="2" y="6" width="14" height="12" rx="3"/><path d="M16 10.5 22 7v10l-6-3.5z"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13.5" r="3.8"/>',
  microfone: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 9"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  recarregar: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  estrela: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4l-5.6 2.9 1.1-6.2L3 9.7l6.2-.9z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  sino: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  casa: '<path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z"/>',
};
const icone = (k, cls = '') => `<svg class="mk-ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const verificado = '<svg class="mk-verif" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 2 3.2-.3.9 3.1 2.8 1.6-1 3.1 1 3.1-2.8 1.6-.9 3.1-3.2-.3-2.6 2-2.6-2-3.2.3-.9-3.1-2.8-1.6 1-3.1-1-3.1 2.8-1.6.9-3.1 3.2.3z" fill="#0095F6"/><path d="m8 12.2 2.7 2.7L16.2 9" fill="none" stroke="#fff" stroke-width="2"/></svg>';

// ---------------------------------------------------------------- peças de conteúdo pintadas pela marca
const iniciais = (nome) => String(nome || '?').replace(/[@._]/g, ' ').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
// Foto de perfil: foto real (se vier) ou monograma na cor de acento.
const avatar = (d = {}, cls = '') => (d.foto
  ? `<span class="mk-av ${cls}"><img src="${esc(d.foto)}" alt=""></span>`
  : `<span class="mk-av ${cls}" style="background:${hex(d.cor || 'acento')};color:${textoSobre(hex(d.cor || 'acento'))}">${esc(iniciais(d.nome || d.usuario))}</span>`);
const anel = (inner) => `<span class="mk-anel"><span class="mk-anel-in">${inner}</span></span>`;
// Miniatura de post: post tipográfico da própria marca (nunca caixa cinza, M-02), ou foto real.
const FUNDOS = ['escuro', 'acento', 'claro', 'neutro'];
function miniatura(t, i = 0) {
  if (t && t.foto) return `<div class="mk-mini"><img src="${esc(t.foto)}" alt=""></div>`;
  const fundo = hex((t && t.fundo) || FUNDOS[i % FUNDOS.length]);
  const tinta = textoSobre(fundo);
  const destaque = fundo === hex('acento') ? tinta : hex('acento');
  const forma = ['mk-mf1', 'mk-mf2', 'mk-mf3'][i % 3];
  return `<div class="mk-mini ${forma}" style="background:${fundo};color:${tinta}"><i style="background:${destaque}"></i><b>${esc((t && t.texto) || '')}</b></div>`;
}

// Arte de post sem foto: capa tipográfica da marca, com forma de acento cortada pela borda (DG-14).
function arte(titulo, kicker = 'Carrossel', fundo = 'escuro') {
  const bg = hex(fundo);
  const tinta = textoSobre(bg);
  const ac = fundo === 'acento' ? tinta : hex('acento');
  return `<div class="mk-arte" style="background:${bg};color:${tinta}"><span class="mk-arte-c1" style="background:${ac}"></span><span class="mk-arte-c2" style="border-color:${ac}"></span><span class="mk-arte-k" style="color:${ac}">${esc(kicker)}</span><b>${esc(titulo)}</b><span class="mk-arte-pe"><i style="background:${ac}"></i><i></i><i></i></span></div>`;
}

// ---------------------------------------------------------------- componentes
const raiz = (nome, d, corpo, extra = '') => `<div class="mk mk-${nome} ${d.sombra === false ? '' : 'mk-sombra'}" data-modo="${d.modo === 'escuro' ? 'escuro' : 'claro'}"${extra}>${corpo}</div>`;

function perfil(d = {}) {
  const o = {
    usuario: 'lia.exemplo', nome: 'Lia Exemplo', categoria: 'Consultoria', bio: ['Ajudo pequenas empresas a organizar a rotina', 'Atendimento online em todo o Brasil'],
    link: 'exemplo.com.br/agenda', posts: '128', seguidores: '12,4 mil', seguindo: '312', verificado: false,
    destaques: ['Comece aqui', 'Clientes', 'Bastidores', 'Dúvidas'],
    grade: ['3 erros comuns', 'Antes e depois', 'Passo a passo', 'Mito ou verdade', 'Checklist', 'Bastidores', 'O que muda', 'Perguntas', 'Resultado'],
    ...d,
  };
  const destaques = o.destaques.map((t, i) => `<div class="mk-dest"><span class="mk-dest-c" style="background:${hex(FUNDOS[(i + 1) % 4])}"></span><span>${esc(t)}</span></div>`).join('');
  const grade = o.grade.slice(0, 9).map((t, i) => miniatura(typeof t === 'string' ? { texto: t } : t, i)).join('');
  return raiz('perfil', o, `
<div class="mk-barra"><span class="mk-usuario">${icone('cadeado', 'mk-ic-p')}${esc(o.usuario)}</span><span class="mk-icones">${icone('mais')}${icone('menu')}</span></div>
<div class="mk-topo">${anel(avatar(o, 'mk-av-g'))}<div class="mk-nums"><div><b>${esc(o.posts)}</b><span>posts</span></div><div><b>${esc(o.seguidores)}</b><span>seguidores</span></div><div><b>${esc(o.seguindo)}</b><span>seguindo</span></div></div></div>
<div class="mk-bio"><b>${esc(o.nome)}${o.verificado ? verificado : ''}</b><span class="mk-sub">${esc(o.categoria)}</span>${o.bio.map((l) => `<span>${esc(l)}</span>`).join('')}<span class="mk-link">${esc(o.link)}</span></div>
<div class="mk-botoes"><span class="mk-btn mk-btn-azul">Seguir</span><span class="mk-btn">Mensagem</span><span class="mk-btn mk-btn-ic">${icone('marcado')}</span></div>
<div class="mk-dests">${destaques}</div>
<div class="mk-abas"><span class="ativa">${icone('grade')}</span><span>${icone('reels')}</span><span>${icone('marcado')}</span></div>
<div class="mk-grade">${grade}</div>`);
}

function busca(d = {}) {
  const o = {
    termo: 'consultoria financeira',
    resultados: [
      { usuario: 'lia.exemplo', nome: 'Lia Exemplo · Consultoria', info: '12,4 mil seguidores' },
      { usuario: 'contas.em.dia', nome: 'Contas em Dia', info: '8.903 seguidores' },
      { usuario: 'planeja.exemplo', nome: 'Planeja Exemplo', info: 'Seguido por joao.exemplo' },
      { usuario: 'rotina.leve', nome: 'Rotina Leve', info: '2.140 seguidores' },
    ],
    ...d,
  };
  const linhas = o.resultados.map((r, i) => `<div class="mk-res">${avatar({ ...r, cor: FUNDOS[i % 3] }, 'mk-av-m')}<div><b>${esc(r.usuario)}</b><span class="mk-sub">${esc(r.nome)}</span><span class="mk-sub">${esc(r.info)}</span></div>${i === 0 ? '<span class="mk-btn mk-btn-azul mk-btn-p">Seguir</span>' : ''}</div>`).join('');
  return raiz('busca', o, `
<div class="mk-campo">${icone('voltar')}<span class="mk-input">${icone('lupa', 'mk-ic-p')}${esc(o.termo)}</span></div>
<div class="mk-abas-txt"><span class="ativa">Para você</span><span>Contas</span><span>Áudio</span><span>Tags</span></div>
${linhas}`);
}

function post(d = {}) {
  const o = { usuario: 'lia.exemplo', local: 'São Paulo, SP', titulo: '3 erros que travam a sua rotina', curtidas: '1.284', comentarios: '48', legenda: 'O segundo erro é o mais comum. Salve para revisar no fim do mês.', tempo: 'há 2 horas', curtidoPor: 'joao.exemplo', ...d };
  const img = o.foto ? `<div class="mk-img"><img src="${esc(o.foto)}" alt=""></div>` : `<div class="mk-img">${arte(o.titulo, o.kicker, o.fundo || 'escuro')}</div>`;
  return raiz('post', o, `
<div class="mk-cab">${anel(avatar(o, 'mk-av-p'))}<div><b>${esc(o.usuario)}</b><span class="mk-sub">${esc(o.local)}</span></div>${icone('pontos', 'mk-dir')}</div>
${img}
<div class="mk-acoes">${icone('coracao', 'mk-curtido')}${icone('comentario')}${icone('enviar')}<span class="mk-dots"><i class="on"></i><i></i><i></i></span>${icone('salvar', 'mk-dir')}</div>
<div class="mk-txt"><span>Curtido por <b>${esc(o.curtidoPor)}</b> e <b>outras ${esc(o.curtidas)} pessoas</b></span><span><b>${esc(o.usuario)}</b> ${esc(o.legenda)}</span><span class="mk-sub">Ver todos os ${esc(o.comentarios)} comentários</span><span class="mk-sub">${esc(o.tempo)}</span></div>`);
}

function story(d = {}) {
  const o = { usuario: 'lia.exemplo', tempo: '3 h', texto: 'Você revisa o seu orçamento todo mês?', opcoes: ['Sim, sempre', 'Ainda não'], partes: 4, atual: 2, ...d };
  const barras = Array.from({ length: o.partes }, (_, i) => `<i class="${i < o.atual - 1 ? 'cheia' : i === o.atual - 1 ? 'meia' : ''}"></i>`).join('');
  const fundo = o.foto ? `<img class="mk-st-fundo" src="${esc(o.foto)}" alt="">` : `<div class="mk-st-fundo" style="background:linear-gradient(160deg,${hex('escuro')},${hex('acento')})"></div>`;
  const enquete = o.opcoes && o.opcoes.length ? `<div class="mk-enq"><p>${esc(o.texto)}</p>${o.opcoes.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : `<div class="mk-enq"><p>${esc(o.texto)}</p></div>`;
  return raiz('story', { ...o, modo: 'escuro' }, `${fundo}
<div class="mk-st-barras">${barras}</div>
<div class="mk-st-cab">${avatar(o, 'mk-av-p')}<b>${esc(o.usuario)}</b><span>${esc(o.tempo)}</span>${icone('pontos', 'mk-dir')}${icone('x')}</div>
${enquete}
<div class="mk-st-pe"><span class="mk-st-campo">Enviar mensagem</span>${icone('coracao')}${icone('enviar')}</div>`);
}

function conversa(d = {}) {
  const o = {
    contato: 'Carlos Exemplo', usuario: 'carlos.exemplo', estado: 'Online agora',
    mensagens: [
      { de: 'ele', texto: 'Oi, vi o seu post sobre organizar as contas.' },
      { de: 'ele', texto: 'Como funciona a primeira conversa?' },
      { de: 'eu', texto: 'Oi, Carlos. É uma chamada de 30 minutos.' },
      { de: 'eu', texto: 'Posso te mandar os horários desta semana?' },
      { de: 'ele', texto: 'Pode sim, obrigado.' },
    ],
    hora: 'Hoje 14:32', ...d,
  };
  const msgs = o.mensagens.map((m, i) => {
    const prox = o.mensagens[i + 1];
    const fimDoGrupo = !prox || prox.de !== m.de;
    return `<div class="mk-msg ${m.de === 'eu' ? 'eu' : 'ele'}">${m.de !== 'eu' ? (fimDoGrupo ? avatar({ nome: o.contato, cor: 'neutro' }, 'mk-av-xs') : '<span class="mk-av-xs mk-vazio"></span>') : ''}<span>${esc(m.texto)}</span></div>`;
  }).join('');
  return raiz('conversa', o, `
<div class="mk-cab">${icone('voltar')}${avatar({ nome: o.contato, cor: 'neutro' }, 'mk-av-p')}<div><b>${esc(o.contato)}</b><span class="mk-sub">${esc(o.estado)}</span></div><span class="mk-dir mk-icones">${icone('telefone')}${icone('video')}</span></div>
<div class="mk-chat"><span class="mk-hora">${esc(o.hora)}</span>${msgs}</div>
<div class="mk-compor"><span class="mk-cam">${icone('camera')}</span><span class="mk-input">Mensagem...</span>${icone('microfone')}${icone('imagem')}</div>`);
}

function notificacao(d = {}) {
  const o = { app: 'Agenda', titulo: 'Nova consulta marcada', texto: 'Carlos Exemplo marcou a primeira conversa.', hora: 'agora', relogio: '9:41', data: '12 de junho', ...d };
  const ic = `<span class="mk-app" style="background:${hex('acento')};color:${textoSobre(hex('acento'))}">${esc(iniciais(o.app))}</span>`;
  return raiz('notificacao', o, `
<div class="mk-tela" style="background:linear-gradient(170deg,${hex('escuro')},${hex('neutro')})"><span class="mk-status"><b>${esc(o.relogio)}</b><span class="mk-sinais"><i></i><i></i><i></i><i></i></span></span>${icone('cadeado')}<span class="mk-data">${esc(o.data)}</span>
<div class="mk-notif">${ic}<div><div class="mk-notif-l"><b>${esc(o.app)}</b><span>${esc(o.hora)}</span></div><b>${esc(o.titulo)}</b><span>${esc(o.texto)}</span></div></div></div>`);
}

function navegador(d = {}) {
  const o = { url: 'exemplo.com.br', aba: 'Empresa Exemplo', titulo: 'Organize a rotina da sua empresa', texto: 'Um método simples para tirar as contas da cabeça.', botao: 'Agendar conversa', ...d };
  const ac = hex('acento');
  return raiz('navegador', o, `
<div class="mk-janela"><span class="mk-luzes"><i></i><i></i><i></i></span><span class="mk-aba">${esc(o.aba)}${icone('x', 'mk-ic-p')}</span></div>
<div class="mk-end">${icone('voltar')}${icone('recarregar')}<span class="mk-input">${icone('cadeado', 'mk-ic-p')}${esc(o.url)}</span>${icone('estrela')}</div>
<div class="mk-pagina" style="background:${hex('claro')};color:${hex('escuro')}"><div class="mk-pg-menu"><b>${esc(o.aba)}</b><span>Serviços</span><span>Contato</span></div><h4>${esc(o.titulo)}</h4><p>${esc(o.texto)}</p><span class="mk-pg-btn" style="background:${ac};color:${textoSobre(ac)}">${esc(o.botao)}</span></div>`);
}

function planilha(d = {}) {
  const o = {
    nome: 'Fluxo de caixa', colunas: ['Mês', 'Entradas', 'Saídas', 'Saldo'],
    linhas: [['Janeiro', '18.400', '15.900', '2.500'], ['Fevereiro', '17.200', '16.800', '400'], ['Março', '21.000', '16.100', '4.900'], ['Abril', '19.700', '17.300', '2.400']],
    destaque: [3, 3], formula: '=B4-C4', ...d,
  };
  const letras = o.colunas.map((_, i) => `<span>${String.fromCharCode(65 + i)}</span>`).join('');
  const ac = hex('acento');
  const celula = (v, li, ci) => {
    const on = o.destaque && o.destaque[0] === li && o.destaque[1] === ci;
    return `<span class="${on ? 'on' : ''}"${on ? ` style="outline-color:${ac};background:${ac}22"` : ''}>${esc(v)}</span>`;
  };
  const corpo = o.linhas.map((l, li) => `<div class="mk-pl-l"><span class="mk-pl-n">${li + 2}</span>${l.map((v, ci) => celula(v, li + 1, ci)).join('')}</div>`).join('');
  return raiz('planilha', o, `
<div class="mk-pl-topo"><span class="mk-pl-ic" style="background:${ac}"></span><b>${esc(o.nome)}</b></div>
<div class="mk-pl-menu"><span>Arquivo</span><span>Editar</span><span>Inserir</span><span>Dados</span></div>
<div class="mk-pl-fx"><i>fx</i><span>${esc(o.formula)}</span></div>
<div class="mk-pl-grade" style="--cols:${o.colunas.length}"><div class="mk-pl-l mk-pl-letras"><span class="mk-pl-n"></span>${letras}</div><div class="mk-pl-l mk-pl-cab"><span class="mk-pl-n">1</span>${o.colunas.map((c) => `<span>${esc(c)}</span>`).join('')}</div>${corpo}</div>`);
}

function documento(d = {}) {
  const o = {
    nome: 'Proposta de serviço', titulo: 'Como vamos trabalhar',
    paragrafos: ['Na primeira semana, mapeamos as contas fixas e as variáveis.', 'Depois, definimos um dia do mês para revisar tudo em uma hora.', 'O resultado esperado é saber, a qualquer momento, quanto sobra.'],
    destaque: 1, comentario: 'Gostei. Pode começar no dia 10?', autor: 'Carlos', ...d,
  };
  const ac = hex('acento');
  return raiz('documento', o, `
<div class="mk-dc-topo"><span class="mk-pl-ic mk-dc-ic" style="background:${hex('escuro')}"></span><b>${esc(o.nome)}</b><span class="mk-dir mk-btn mk-btn-p" style="background:${ac};color:${textoSobre(ac)}">Compartilhar</span></div>
<div class="mk-dc-area"><div class="mk-dc-folha"><h4>${esc(o.titulo)}</h4>${o.paragrafos.map((p, i) => `<p>${i === o.destaque ? `<mark style="background:${ac}40;box-shadow:inset 0 -6px 0 ${ac}">${esc(p)}</mark>` : esc(p)}</p>`).join('')}</div>
${o.comentario ? `<div class="mk-dc-com">${avatar({ nome: o.autor, cor: 'neutro' }, 'mk-av-xs')}<div><b>${esc(o.autor)}</b><span>${esc(o.comentario)}</span></div></div>` : ''}</div>`);
}

function cartaoApp(d = {}) {
  const o = { rotulo: 'Saldo do mês', valor: 'R$ 4.900', variacao: '+18%', descricao: 'em relação a fevereiro', barras: [38, 52, 30, 64, 47, 80], meses: ['Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'], ...d };
  const ac = hex('acento');
  const max = Math.max(...o.barras);
  return raiz('cartao', o, `
<div class="mk-ca-cab"><span class="mk-sub">${esc(o.rotulo)}</span>${icone('pontos', 'mk-dir')}</div>
<div class="mk-ca-valor"><b>${esc(o.valor)}</b><span class="mk-pilula" style="background:${ac}26;color:${legivel(ac, o.modo === 'escuro' ? '#000000' : '#FFFFFF')}">${esc(o.variacao)}</span></div>
<span class="mk-sub">${esc(o.descricao)}</span>
<div class="mk-ca-graf">${o.barras.map((v, i) => `<div><i style="height:${Math.round((v / max) * 100)}%;background:${i === o.barras.length - 1 ? ac : hex('neutro') + '55'}"></i><span>${esc(o.meses[i] || '')}</span></div>`).join('')}</div>`);
}

function checklist(d = {}) {
  const o = { titulo: 'Revisão do mês', itens: [{ texto: 'Conferir as contas fixas', feito: true }, { texto: 'Separar a reserva', feito: true }, { texto: 'Revisar as assinaturas', feito: false }, { texto: 'Anotar a meta do próximo mês', feito: false }], ...d };
  const ac = hex('acento');
  const feitos = o.itens.filter((i) => i.feito).length;
  return raiz('checklist', o, `
<div class="mk-ck-cab"><b>${esc(o.titulo)}</b><span class="mk-sub">${feitos} de ${o.itens.length}</span></div>
<div class="mk-ck-prog"><i style="width:${Math.round((feitos / o.itens.length) * 100)}%;background:${ac}"></i></div>
${o.itens.map((i) => `<div class="mk-ck-item ${i.feito ? 'feito' : ''}"><span class="mk-ck-box"${i.feito ? ` style="background:${ac};border-color:${ac};color:${textoSobre(ac)}"` : ''}>${i.feito ? icone('check') : ''}</span><span>${esc(i.texto)}</span></div>`).join('')}`);
}

function antesDepois(d = {}) {
  const o = {
    antes: { rotulo: 'Antes', titulo: 'Tudo na cabeça', itens: ['Contas em três aplicativos', 'Susto no fim do mês', 'Nenhuma reserva'] },
    depois: { rotulo: 'Depois', titulo: 'Uma hora por mês', itens: ['Uma planilha só', 'Saldo previsto', 'Reserva de 3 meses'] },
    ...d,
  };
  const ac = hex('acento');
  const lado = (l, bom) => `<div class="mk-ad-lado ${bom ? 'bom' : ''}"${bom ? ` style="border-color:${ac}"` : ''}><span class="mk-ad-rot"${bom ? ` style="background:${ac};color:${textoSobre(ac)}"` : ''}>${esc(l.rotulo)}</span><b>${esc(l.titulo)}</b>${l.itens.map((x) => `<span class="mk-ad-it">${bom ? `<i style="color:${ac}">${icone('check')}</i>` : `<i>${icone('x')}</i>`}${esc(x)}</span>`).join('')}</div>`;
  return raiz('antes-depois', o, `${lado(o.antes, false)}<span class="mk-ad-seta" style="background:${ac};color:${textoSobre(ac)}">${icone('seta')}</span>${lado(o.depois, true)}`);
}

// M-08: marcadores numerados sobre partes do mockup. x e y em % da caixa do mockup.
function comMarcadores(html, marcadores = []) {
  const ac = hex('acento');
  const pins = marcadores.map((m) => `<span class="mk-marcador" style="left:${m.x}%;top:${m.y}%;background:${ac};color:${textoSobre(ac)}">${esc(m.n)}</span>`).join('');
  return `<div class="mk-com-marcadores">${html}${pins}</div>`;
}

// ---------------------------------------------------------------- CSS
function css() {
  const S = ESCALA;
  return `
.mk{--mk-bg:#FFFFFF;--mk-fg:#000000;--mk-sub:#737373;--mk-linha:#DBDBDB;--mk-campo:#EFEFEF;--mk-bolha:#EFEFEF;--mk-azul:#0095F6;
  position:relative;box-sizing:border-box;width:880px;background:var(--mk-bg);color:var(--mk-fg);border-radius:36px;overflow:hidden;
  font:400 ${S.texto}px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:left}
.mk[data-modo="escuro"]{--mk-bg:#000000;--mk-fg:#F5F5F5;--mk-sub:#A8A8A8;--mk-linha:#262626;--mk-campo:#262626;--mk-bolha:#262626}
.mk *{box-sizing:border-box}
.mk-sombra{box-shadow:0 40px 90px rgba(0,0,0,.45),0 8px 24px rgba(0,0,0,.25)}
.mk b{font-weight:600}
.mk-sub{color:var(--mk-sub);font-size:${S.rotulo}px}
.mk-ic{width:${S.destaque}px;height:${S.destaque}px;flex:none}
.mk-ic-p{width:${S.texto}px;height:${S.texto}px}
.mk-dir{margin-left:auto}
.mk-icones{display:flex;gap:30px;align-items:center}
.mk-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;font-weight:700;flex:none}
.mk-av img{width:100%;height:100%;object-fit:cover}
.mk-av-g{width:170px;height:170px;font-size:${S.destaque}px}
.mk-av-m{width:110px;height:110px;font-size:${S.nome}px}
.mk-av-p{width:72px;height:72px;font-size:${S.rotulo}px}
.mk-av-xs{width:56px;height:56px;font-size:${S.rotulo}px;flex:none}
.mk-vazio{display:inline-block}
.mk-anel{display:inline-flex;padding:5px;border-radius:50%;background:linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5);flex:none}
.mk-anel-in{display:inline-flex;padding:5px;border-radius:50%;background:var(--mk-bg)}
.mk-verif{width:${S.texto}px;height:${S.texto}px;margin-left:8px;vertical-align:-4px}
.mk-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:76px;padding:0 30px;border-radius:18px;background:var(--mk-campo);font-weight:600;font-size:${S.texto}px;flex:1}
.mk-btn-azul{background:var(--mk-azul);color:#fff}
.mk-btn-ic{flex:none;width:76px;padding:0}
.mk-btn-p{flex:none;height:64px;font-size:${S.rotulo}px}
.mk-input{display:flex;align-items:center;gap:14px;flex:1;height:76px;padding:0 26px;border-radius:20px;background:var(--mk-campo);color:var(--mk-sub)}
/* perfil */
.mk-perfil .mk-barra{display:flex;align-items:center;justify-content:space-between;padding:30px 36px 10px}
.mk-usuario{display:flex;align-items:center;gap:10px;font-weight:700;font-size:${S.titulo}px}
.mk-topo{display:flex;align-items:center;gap:40px;padding:20px 36px}
.mk-nums{display:flex;flex:1;justify-content:space-around;text-align:center}
.mk-nums div{display:flex;flex-direction:column}
.mk-nums b{font-size:${S.nome}px;font-weight:700}
.mk-nums span{font-size:${S.rotulo}px}
.mk-bio{display:flex;flex-direction:column;padding:0 36px;gap:2px}
.mk-link{color:#00376B;font-weight:600}
.mk[data-modo="escuro"] .mk-link{color:#E0F1FF}
.mk-botoes{display:flex;gap:12px;padding:26px 36px}
.mk-dests{display:flex;gap:34px;padding:0 36px 26px}
.mk-dest{display:flex;flex-direction:column;align-items:center;gap:10px;font-size:${S.rotulo}px;width:150px;text-align:center}
.mk-dest-c{width:130px;height:130px;border-radius:50%;box-shadow:0 0 0 4px var(--mk-bg),0 0 0 7px var(--mk-linha)}
.mk-abas{display:flex;border-top:1px solid var(--mk-linha)}
.mk-abas span{flex:1;display:flex;justify-content:center;padding:18px 0;color:var(--mk-sub)}
.mk-abas span.ativa{color:var(--mk-fg);box-shadow:inset 0 -3px 0 var(--mk-fg)}
.mk-grade{display:grid;grid-template-columns:repeat(3,1fr);gap:3px}
.mk-mini{position:relative;aspect-ratio:4/5;overflow:hidden;display:flex;align-items:flex-end;padding:20px}
.mk-mini img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mk-mini b{position:relative;font-size:${S.rotulo}px;line-height:1.1;font-weight:800}
.mk-mini i{position:absolute;display:block}
.mk-mf1 i{left:20px;top:20px;width:60px;height:8px;border-radius:4px}
.mk-mf2 i{right:-30px;top:-30px;width:130px;height:130px;border-radius:50%;opacity:.9}
.mk-mf3 i{left:20px;right:20px;top:50%;height:4px}
.mk-mini-g{aspect-ratio:4/5;padding:60px}
.mk-mini-g b{font-size:${S.destaque}px;max-width:80%}
.mk-mini-g.mk-mf1 i{left:60px;top:60px;width:120px;height:14px}
/* busca */
.mk-campo{display:flex;align-items:center;gap:20px;padding:30px 30px 10px}
.mk-abas-txt{display:flex;gap:40px;padding:20px 36px;border-bottom:1px solid var(--mk-linha);font-weight:600;color:var(--mk-sub)}
.mk-abas-txt .ativa{color:var(--mk-fg);box-shadow:0 22px 0 -19px var(--mk-fg)}
.mk-res{display:flex;align-items:center;gap:26px;padding:20px 36px}
.mk-res > div{display:flex;flex-direction:column;flex:1}
/* post */
.mk-cab{display:flex;align-items:center;gap:20px;padding:22px 30px}
.mk-cab > div{display:flex;flex-direction:column}
.mk-img{aspect-ratio:4/5;overflow:hidden}
.mk-img img{width:100%;height:100%;object-fit:cover}
.mk-arte{position:relative;height:100%;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:24px;padding:70px}
.mk-arte b{position:relative;font-size:${S.destaque}px;line-height:1.12;font-weight:800;max-width:72%}
.mk-arte-k{position:relative;font-weight:700;font-size:${S.rotulo}px;letter-spacing:.14em;text-transform:uppercase}
.mk-arte-c1{position:absolute;right:-120px;bottom:-120px;width:420px;height:420px;border-radius:50%}
.mk-arte-c2{position:absolute;right:120px;bottom:180px;width:160px;height:160px;border-radius:50%;border:10px solid}
.mk-arte-pe{position:absolute;left:70px;bottom:60px;display:flex;gap:10px}.mk-arte-pe i{width:36px;height:8px;border-radius:4px;background:currentColor;opacity:.35}.mk-arte-pe i:first-child{opacity:1}
.mk-acoes{display:flex;align-items:center;gap:30px;padding:24px 30px 10px}
.mk-curtido{color:#FF3040;fill:#FF3040}
.mk-dots{display:flex;gap:8px;margin:0 auto;transform:translateX(-60px)}
.mk-dots i{width:12px;height:12px;border-radius:50%;background:var(--mk-linha)}
.mk-dots i.on{background:var(--mk-azul)}
.mk-txt{display:flex;flex-direction:column;gap:6px;padding:4px 30px 30px}
/* story */
.mk-story{width:600px;height:1067px;color:#fff;border-radius:30px}
.mk-st-fundo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.mk-st-barras{position:absolute;left:16px;right:16px;top:16px;display:flex;gap:6px}
.mk-st-barras i{flex:1;height:5px;border-radius:3px;background:rgba(255,255,255,.4)}
.mk-st-barras i.cheia{background:#fff}
.mk-st-barras i.meia{background:linear-gradient(90deg,#fff 55%,rgba(255,255,255,.4) 55%)}
.mk-st-cab{position:absolute;left:20px;right:20px;top:40px;display:flex;align-items:center;gap:16px;font-size:${S.rotulo}px}
.mk-st-cab span{opacity:.75}
.mk-st-cab .mk-ic{width:${S.nome}px;height:${S.nome}px}
.mk-enq{position:absolute;left:60px;right:60px;top:50%;transform:translateY(-50%) rotate(-2deg);background:#fff;color:#111;border-radius:30px;padding:36px;display:flex;flex-direction:column;gap:16px;box-shadow:0 20px 40px rgba(0,0,0,.25);text-align:center}
.mk-enq p{margin:0;font-weight:700;font-size:${S.nome}px}
.mk-enq span{display:block;padding:18px;border-radius:18px;background:#F2F2F2;font-weight:600}
.mk-st-pe{position:absolute;left:20px;right:20px;bottom:26px;display:flex;align-items:center;gap:22px}
.mk-st-campo{flex:1;height:76px;display:flex;align-items:center;padding:0 28px;border:2px solid rgba(255,255,255,.7);border-radius:40px;font-size:${S.rotulo}px}
/* conversa */
.mk-conversa .mk-cab{border-bottom:1px solid var(--mk-linha)}
.mk-chat{display:flex;flex-direction:column;gap:8px;padding:24px 26px}
.mk-hora{align-self:center;color:var(--mk-sub);font-size:${S.rotulo}px;margin-bottom:12px}
.mk-msg{display:flex;align-items:flex-end;gap:14px;max-width:80%}
.mk-msg > span:last-child{padding:20px 28px;border-radius:40px;background:var(--mk-bolha)}
.mk-msg.eu{align-self:flex-end}
.mk-msg.eu > span{background:linear-gradient(135deg,#5B51D8,#3797F0);color:#fff}
.mk-compor{display:flex;align-items:center;gap:20px;margin:10px 20px 24px;padding:10px 26px 10px 10px;border-radius:50px;background:var(--mk-campo)}
.mk-compor .mk-input{background:none;padding:0}
.mk-cam{display:flex;width:70px;height:70px;border-radius:50%;background:var(--mk-azul);color:#fff;align-items:center;justify-content:center}
.mk-cam .mk-ic{width:${S.nome}px;height:${S.nome}px}
/* notificação */
.mk-notificacao{width:880px;border-radius:44px}
.mk-tela{display:flex;flex-direction:column;align-items:center;padding:60px 36px 50px;color:#fff}
.mk-data{font-size:${S.nome}px;font-weight:600;opacity:.9}
.mk-status{align-self:stretch;display:flex;justify-content:space-between;align-items:center;margin:-36px 0 40px;font-size:${S.texto}px}
.mk-sinais{display:flex;gap:5px;align-items:flex-end}.mk-sinais i{width:8px;background:#fff;border-radius:2px}.mk-sinais i:nth-child(1){height:10px}.mk-sinais i:nth-child(2){height:16px}.mk-sinais i:nth-child(3){height:22px}.mk-sinais i:nth-child(4){height:28px}
.mk-tela > .mk-ic{margin-bottom:12px}
.mk-notif{display:flex;gap:24px;align-self:stretch;margin-top:40px;padding:28px;border-radius:36px;background:rgba(245,245,245,.82);color:#111;backdrop-filter:blur(20px)}
.mk-notif > div{display:flex;flex-direction:column;flex:1}
.mk-notif-l{display:flex;justify-content:space-between;color:#555;font-size:${S.rotulo}px}
.mk-notif-l b{font-weight:600}
.mk-app{display:flex;align-items:center;justify-content:center;width:88px;height:88px;border-radius:22px;font-weight:800;font-size:${S.nome}px;flex:none}
/* navegador */
.mk-navegador{border-radius:24px}
.mk-janela{display:flex;align-items:flex-end;gap:24px;padding:18px 24px 0;background:var(--mk-campo)}
.mk-luzes{display:flex;gap:12px;padding-bottom:22px}
.mk-luzes i{width:22px;height:22px;border-radius:50%;background:#FF5F57}
.mk-luzes i:nth-child(2){background:#FEBC2E}.mk-luzes i:nth-child(3){background:#28C840}
.mk-aba{display:flex;align-items:center;gap:30px;padding:16px 26px;border-radius:18px 18px 0 0;background:var(--mk-bg);font-size:${S.rotulo}px}
.mk-end{display:flex;align-items:center;gap:22px;padding:16px 24px;border-bottom:1px solid var(--mk-linha)}
.mk-end .mk-ic{width:${S.nome}px;height:${S.nome}px;color:var(--mk-sub)}
.mk-end .mk-input{height:64px;color:var(--mk-fg)}
.mk-pagina{padding:40px 50px 60px}
.mk-pg-menu{display:flex;gap:36px;align-items:center;font-size:${S.rotulo}px;margin-bottom:56px}
.mk-pg-menu b{margin-right:auto;font-size:${S.texto}px}
.mk-pagina h4{margin:0 0 20px;font-size:${S.destaque}px;line-height:1.15;max-width:640px}
.mk-pagina p{margin:0 0 36px;max-width:620px}
.mk-pg-btn{display:inline-block;padding:20px 36px;border-radius:14px;font-weight:700}
/* planilha */
.mk-planilha{border-radius:24px}
.mk-pl-topo,.mk-dc-topo{display:flex;align-items:center;gap:18px;padding:24px 28px 8px;font-size:${S.nome}px}
.mk-pl-ic{width:44px;height:56px;border-radius:6px;flex:none}
.mk-pl-menu{display:flex;gap:30px;padding:0 28px 16px 90px;font-size:${S.rotulo}px;color:var(--mk-sub)}
.mk-pl-fx{display:flex;gap:20px;align-items:center;padding:12px 28px;border-top:1px solid var(--mk-linha);border-bottom:1px solid var(--mk-linha);font-size:${S.rotulo}px}
.mk-pl-fx i{color:var(--mk-sub);font-style:italic}
.mk-pl-grade{font-size:${S.rotulo}px}
.mk-pl-l{display:grid;grid-template-columns:64px repeat(var(--cols),1fr);border-bottom:1px solid var(--mk-linha)}
.mk-pl-l > span{padding:16px 18px;border-right:1px solid var(--mk-linha);white-space:nowrap}
.mk-pl-l > span.on{outline:4px solid;outline-offset:-4px;font-weight:700}
.mk-pl-n{color:var(--mk-sub);text-align:center;background:var(--mk-campo)}
.mk-pl-letras span{background:var(--mk-campo);color:var(--mk-sub);text-align:center}
.mk-pl-cab span{font-weight:700}
/* documento */
.mk-documento{border-radius:24px}
.mk-dc-topo .mk-btn{flex:none}
.mk-dc-area{position:relative;background:var(--mk-campo);padding:40px 30px 50px;margin-top:16px;display:flex;gap:24px;align-items:flex-start}
.mk-dc-folha{flex:1;background:var(--mk-bg);padding:50px 46px;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.mk-dc-folha h4{margin:0 0 26px;font-size:${S.titulo}px}
.mk-dc-folha p{margin:0 0 20px}
.mk-dc-folha mark{color:inherit;padding:0 2px}
.mk-dc-com{width:320px;display:flex;gap:12px;padding:20px;border-radius:18px;background:var(--mk-bg);box-shadow:0 6px 20px rgba(0,0,0,.15);font-size:${S.rotulo}px}
.mk-dc-com > div{display:flex;flex-direction:column}
/* cartão de aplicativo */
.mk-cartao{width:760px;padding:40px 44px 36px;border-radius:44px}
.mk-ca-cab{display:flex;align-items:center}
.mk-ca-valor{display:flex;align-items:center;gap:22px;margin:10px 0 4px}
.mk-ca-valor b{font-size:${S.destaque}px;font-weight:700}
.mk-pilula{padding:6px 18px;border-radius:30px;font-weight:700;font-size:${S.rotulo}px}
.mk-ca-graf{display:flex;align-items:flex-end;gap:22px;height:280px;margin-top:30px}
.mk-ca-graf div{flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:12px}
.mk-ca-graf i{display:block;width:100%;border-radius:14px}
.mk-ca-graf span{font-size:${S.rotulo}px;color:var(--mk-sub)}
/* checklist */
.mk-checklist{width:760px;padding:40px 44px 30px;border-radius:44px}
.mk-ck-cab{display:flex;align-items:baseline;justify-content:space-between}
.mk-ck-cab b{font-size:${S.titulo}px}
.mk-ck-prog{height:12px;border-radius:6px;background:var(--mk-campo);margin:20px 0 14px;overflow:hidden}
.mk-ck-prog i{display:block;height:100%;border-radius:6px}
.mk-ck-item{display:flex;align-items:center;gap:24px;padding:22px 0;border-bottom:1px solid var(--mk-linha)}
.mk-ck-item:last-child{border-bottom:0}
.mk-ck-item.feito > span:last-child{color:var(--mk-sub);text-decoration:line-through}
.mk-ck-box{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;border:3px solid var(--mk-linha);flex:none}
.mk-ck-box .mk-ic{width:${S.texto}px;height:${S.texto}px;stroke-width:3}
/* antes e depois */
.mk-antes-depois{display:flex;align-items:center;gap:0;padding:30px;border-radius:44px}
.mk-ad-lado{flex:1;display:flex;flex-direction:column;gap:16px;padding:34px 30px;border:3px solid var(--mk-linha);border-radius:30px}
.mk-ad-lado b{font-size:${S.nome}px}
.mk-ad-rot{align-self:flex-start;padding:6px 18px;border-radius:30px;background:var(--mk-campo);font-weight:700;font-size:${S.rotulo}px}
.mk-ad-it{display:flex;align-items:center;gap:12px;font-size:${S.rotulo}px}
.mk-ad-it i{display:flex;color:var(--mk-sub)}
.mk-ad-it .mk-ic{width:${S.texto}px;height:${S.texto}px;stroke-width:2.6}
.mk-ad-seta{display:flex;align-items:center;justify-content:center;width:70px;height:70px;border-radius:50%;margin:0 -20px;z-index:1;flex:none}
/* marcadores (M-08) */
.mk-com-marcadores{position:relative;display:inline-block}
.mk-marcador{position:absolute;display:flex;align-items:center;justify-content:center;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;font:800 ${S.destaque}px/1 -apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 0 0 8px rgba(255,255,255,.9),0 10px 24px rgba(0,0,0,.35);z-index:5}
`;
}

const COMPONENTES = { perfil, busca, post, story, conversa, notificacao, navegador, planilha, documento, cartaoApp, checklist, antesDepois };
module.exports = { ...COMPONENTES, COMPONENTES, comMarcadores, css, temaSobre, ESCALA, icone, textoSobre, legivel, contraste, usarCores };
