#!/usr/bin/env node
// Testes das partes de ferramentas.js que não precisam de rede (as ferramentas de verdade entram como falsas).
// Rode: node _fabrica/core/ferramentas.test.js
'use strict';
const assert = require('assert');
const { versaoDe, comparar, escolherRelease, lerSha, pacoteNaLista,
  etiquetaWhisper, whisperPrecisa, pacoteTesseract, urlFfmpegMac, versaoDoCaminhoFfmpeg, macosSuportado,
  decidir, atualizarComTeste, processarFerramenta, verificar, FRASES, argsConsultaFfmpeg, trocarPasta } = require('./ferramentas.js');

const casos = [];
const caso = (nome, f) => casos.push([nome, f]);

caso('lê versões de etiquetas e de saídas de programas', () => {
  assert.deepStrictEqual(versaoDe('v0.6.0'), [0, 6, 0]);
  assert.deepStrictEqual(versaoDe('tsrct 0.3.1 (abc123)'), [0, 3, 1]);
  assert.deepStrictEqual(versaoDe('b5454'), null);
  assert.strictEqual(versaoDe(''), null);
});

caso('compara versões número a número (0.10 é maior que 0.6)', () => {
  assert.strictEqual(comparar([0, 6, 0], [0, 3, 1]), 1);
  assert.strictEqual(comparar([0, 3, 1], [0, 3, 1]), 0);
  assert.strictEqual(comparar([0, 10, 0], [0, 6, 0]), 1);
  assert.strictEqual(comparar(null, [0, 1, 0]), -1);
  assert.strictEqual(comparar(null, null), 0);
});

caso('escolhe a release mais nova QUE TRAZ o programa (a mais nova sem o arquivo é pulada)', () => {
  const lista = [
    { tag_name: 'v1.9.5', assets: [] },
    { tag_name: 'b5454', assets: [{ name: 'whisper-bin-win-cpu-arm64.zip' }] },
    { tag_name: 'v1.9.0-rc', prerelease: true, assets: [{ name: 'whisper-bin-x64.zip' }] },
    { tag_name: 'v1.8.2', assets: [{ name: 'whisper-bin-x64.zip' }, { name: 'whisper-bin-Win32.zip' }] },
    { tag_name: 'v1.8.0', assets: [{ name: 'whisper-bin-x64.zip' }] },
  ];
  const r = escolherRelease(lista, /^whisper-bin-x64\.zip$/);
  assert.strictEqual(r.tag, 'v1.8.2');
  assert.deepStrictEqual(r.versao, [1, 8, 2]);
  assert.strictEqual(escolherRelease(lista, /^nao-existe\.zip$/), null);
  assert.strictEqual(escolherRelease(null, /x/), null);
});

caso('lê o checksum de um .sha256 com ou sem nome do arquivo', () => {
  const h = 'a'.repeat(64);
  assert.strictEqual(lerSha(h + '  tesseract.zip\n'), h);
  assert.strictEqual(lerSha(h.toUpperCase()), h);
  assert.strictEqual(lerSha('lixo'), null);
  assert.strictEqual(lerSha(''), null);
});

caso('ffmpeg: acha o pacote que o winget já instalou (Essentials é o mesmo programa com outro nome)', () => {
  const tabela = (id) => `Nome                      ID                     Versão Origem\n${'-'.repeat(60)}\nFFmpeg (Essentials Build) ${id} 9.0.1  winget\n`;
  assert.strictEqual(pacoteNaLista(tabela('Gyan.FFmpeg.Essentials')), 'Gyan.FFmpeg.Essentials');
  assert.strictEqual(pacoteNaLista(tabela('Gyan.FFmpeg.Ess…')), 'Gyan.FFmpeg.Essentials');
  assert.strictEqual(pacoteNaLista(tabela('Gyan.FFmpeg')), 'Gyan.FFmpeg');
  assert.strictEqual(pacoteNaLista(tabela('Gyan.FFmpeg.Shared')), 'Gyan.FFmpeg.Shared');
  assert.strictEqual(pacoteNaLista('Nenhum pacote instalado encontrado.'), null);
  assert.strictEqual(pacoteNaLista(''), null);
});

// As versões do whisper.cpp como saem hoje: os programas prontos vêm nas bNNNN marcadas como pré-lançamento, e as
// etiquetas v1.9.x saem sem arquivos (por isso a escolha antiga ficou presa na b4938).
const LISTA_WHISPER = [
  { tag_name: 'b5907', prerelease: true, published_at: '2026-11-20T15:48:53Z', assets: [{ name: 'whisper-bin-x64.zip' }, { name: 'whisper-b5907-xcframework.zip' }] },
  { tag_name: 'v1.9.5', published_at: '2026-10-06T17:39:17Z', assets: [] },
  { tag_name: 'b5454', prerelease: true, published_at: '2026-10-06T16:51:27Z', assets: [{ name: 'whisper-bin-x64.zip' }] },
  { tag_name: 'b4938', published_at: '2026-08-20T11:33:19Z', assets: [{ name: 'whisper-bin-x64.zip' }] },
];

caso('whisper: pega a bNNNN mais nova mesmo marcada como pré-lançamento', () => {
  const r = etiquetaWhisper(LISTA_WHISPER);
  assert.strictEqual(r.tag, 'b5907');
  assert.strictEqual(r.publicado, '2026-11-20T15:48:53Z');
  assert.strictEqual(r.asset.name, 'whisper-bin-x64.zip');
  assert.strictEqual(etiquetaWhisper([{ tag_name: 'v1.9.5', assets: [] }]), null);
  assert.strictEqual(escolherRelease(LISTA_WHISPER, /^whisper-bin-x64\.zip$/).tag, 'b4938', 'sem a opção, o comportamento antigo continua');
  assert.strictEqual(escolherRelease(LISTA_WHISPER, /^whisper-bin-x64\.zip$/, { aceitarPre: true }).tag, 'b5907');
});

caso('whisper: b4938 registrada sem data precisa atualizar para a b5907; a mesma etiqueta não precisa', () => {
  const nova = { tag: 'b5907', publicado: '2026-11-20T15:48:53Z' };
  assert.strictEqual(whisperPrecisa({ versao: 'b4938' }, nova), true);
  assert.strictEqual(whisperPrecisa({ versao: 'b5907', publicadoEm: '2026-11-20T15:48:53Z' }, nova), false);
  assert.strictEqual(whisperPrecisa(null, nova), true);
  assert.strictEqual(whisperPrecisa({ versao: 'b6000', publicadoEm: '2026-12-01T00:00:00Z' }, nova), false, 'a instalada é mais nova que a da lista');
});

caso('Tesseract: o pacote certo para cada sistema', () => {
  assert.ok(pacoteTesseract({ plataforma: 'win32', arq: 'x64' }).test('tesseract-0.8.0-windows-x86_64.zip'));
  const arm = pacoteTesseract({ plataforma: 'darwin', arq: 'arm64' });
  assert.ok(arm.test('tesseract-0.8.0-darwin-arm64.zip'));
  assert.ok(!arm.test('tesseract-0.8.0-darwin-x86_64.zip'));
  assert.ok(!arm.test('tesseract-0.8.0-darwin-arm64.zip.sha256'));
  assert.ok(pacoteTesseract({ plataforma: 'darwin', arq: 'x64' }).test('tesseract-0.8.0-darwin-x86_64.zip'));
  assert.strictEqual(pacoteTesseract({ plataforma: 'linux', arq: 'x64' }), null);
});

caso('ffmpeg do Mac: link fixo por arquitetura e versão tirada do redirecionamento', () => {
  assert.ok(urlFfmpegMac({ arq: 'x64' }, 'ffprobe').endsWith('/macos/amd64/release/ffprobe.zip'));
  assert.ok(urlFfmpegMac({ arq: 'arm64' }, 'ffmpeg').endsWith('/macos/arm64/release/ffmpeg.zip'));
  assert.match(urlFfmpegMac({ arq: 'arm64' }, 'ffmpeg'), /^https:\/\/ffmpeg\.martin-riedl\.de\/redirect\/latest\//);
  assert.deepStrictEqual(versaoDoCaminhoFfmpeg('/download/macos/arm64/123_9.1/ffmpeg.zip'), [9, 1, 0]);
  assert.deepStrictEqual(versaoDoCaminhoFfmpeg('ffmpeg.martin-riedl.de/download/macos/amd64/456_8.0.2/ffprobe.zip'), [8, 0, 2]);
  assert.strictEqual(versaoDoCaminhoFfmpeg('/outro/caminho.zip'), null);
});

caso('ffmpeg do Windows: a conferência só consulta (winget list), nunca atualiza', () => {
  // o "winget upgrade --id" ATUALIZA de verdade; a conferência (--verificar, --simular) só pode olhar
  assert.deepStrictEqual(argsConsultaFfmpeg('Gyan.FFmpeg.Essentials'), ['list', '--id', 'Gyan.FFmpeg.Essentials', '-e', '--upgrade-available', '--accept-source-agreements']);
});

caso('macOS 14 em diante roda o vídeo', () => {
  assert.strictEqual(macosSuportado([14, 0, 0]), true);
  assert.strictEqual(macosSuportado([26, 1, 0]), true);
  assert.strictEqual(macosSuportado([13, 6, 9]), false);
  assert.strictEqual(macosSuportado(null), false);
});

// ---------- candidata, autoteste e troca (ferramenta e autoteste falsos) ----------

caso('decidir: consulta falhou e há versão funcionando, mantém; nada instalado, usa a testada', () => {
  assert.strictEqual(decidir({ instalada: true, nova: null, erroConsulta: 'sem internet', recusadas: [], testada: null }), 'manter');
  assert.strictEqual(decidir({ instalada: false, nova: null, erroConsulta: 'sem internet', recusadas: [], testada: { rotulo: 'v0.8.0' } }), 'usar-testada');
  assert.strictEqual(decidir({ instalada: false, nova: null, erroConsulta: 'sem internet', recusadas: [], testada: null }), 'manter');
});

caso('decidir: versão nova já recusada, pula; versão nova diferente, testa', () => {
  assert.strictEqual(decidir({ instalada: true, nova: { rotulo: 'v0.9.0' }, erroConsulta: '', recusadas: ['v0.9.0'], testada: null }), 'pular-recusada');
  assert.strictEqual(decidir({ instalada: false, nova: { rotulo: 'v0.9.0' }, erroConsulta: '', recusadas: ['v0.9.0'], testada: { rotulo: 'v0.8.0' } }), 'usar-testada');
  assert.strictEqual(decidir({ instalada: true, nova: { rotulo: 'v0.9.0' }, erroConsulta: '', recusadas: ['v0.8.5'], testada: null }), 'testar-nova');
});

/** Ferramenta falsa: registra cada chamada; `instalada` diz se há versão em uso. */
function falsa({ id = 'tesseract', instalada = true, versao = '0.8.0' } = {}) {
  const chamadas = [];
  return {
    chamadas,
    id, nome: 'Programa de teste', nomeSimples: 'programa que monta os vídeos', testes: [id],
    atual: () => ({ ok: instalada, versao: instalada ? versaoDe(versao) : null }),
    prepararCandidata: async (opc, nova) => {
      chamadas.push('preparar ' + nova.rotulo);
      return { env: { FABRICA_TSRCT: '/candidata/' + nova.rotulo }, porEmUso: async () => chamadas.push('porEmUso ' + nova.rotulo), descartar: () => chamadas.push('descartar ' + nova.rotulo) };
    },
  };
}
/** Autoteste falso: passa ou falha conforme a candidata (pelo FABRICA_TSRCT do env); registra a ordem das chamadas. */
function autotesteFalso(passa = () => true, ordem = []) {
  return async (o) => {
    const cand = o.env && o.env.FABRICA_TSRCT;
    ordem.push(cand || 'em uso');
    const ok = passa(cand);
    return { ok, etapas: [{ id: 'tesseract', ok, detalhe: ok ? 'ok' : 'mudou o jeito como o vídeo sai' }], quadros: ['q1.png', 'q2.png', 'q3.png', 'q4.png'] };
  };
}
const dep = (extra = {}) => ({ estado: { ferramentas: {} }, testadas: {}, lerReferencia: () => ({ versao: '0.8.0', quadros: [] }), gravarReferencia: () => {}, ...extra });

caso('passou: põe em uso e grava o estado', async () => {
  const f = falsa();
  const d = dep({ autotestar: autotesteFalso() });
  const r = await atualizarComTeste(f, { rotulo: 'v0.9.0' }, {}, d);
  assert.strictEqual(r.resultado, 'passou');
  assert.deepStrictEqual(f.chamadas, ['preparar v0.9.0', 'porEmUso v0.9.0']);
  assert.strictEqual(d.estado.ferramentas.tesseract.emUso, 'v0.9.0');
  assert.strictEqual(r.frase, 'Atualizei o programa que monta os vídeos e fiz um teste rápido: está tudo certo.');
  assert.strictEqual(r.frase, FRASES.passou('programa que monta os vídeos'));
});

caso('primeira instalação que passa diz "Instalei", não "Atualizei"', async () => {
  const f = falsa({ instalada: false });
  const r = await atualizarComTeste(f, { rotulo: 'b5907' }, {}, dep({ autotestar: autotesteFalso(), lerReferencia: () => null }));
  assert.strictEqual(r.resultado, 'passou');
  assert.strictEqual(r.frase, 'Instalei o programa que monta os vídeos e fiz um teste rápido: está tudo certo.');
});

caso('falhou: descarta, guarda a recusada e mantém a atual', async () => {
  const f = falsa();
  const d = dep({ autotestar: autotesteFalso(() => false) });
  d.estado.ferramentas.tesseract = { emUso: 'v0.8.0', recusadas: [] };
  const r = await atualizarComTeste(f, { rotulo: 'v0.9.0' }, {}, d);
  assert.strictEqual(r.resultado, 'falhou');
  assert.deepStrictEqual(f.chamadas, ['preparar v0.9.0', 'descartar v0.9.0']);
  assert.deepStrictEqual(d.estado.ferramentas.tesseract.recusadas, ['v0.9.0']);
  assert.strictEqual(d.estado.ferramentas.tesseract.emUso, 'v0.8.0');
  assert.strictEqual(r.frase, 'Saiu uma versão nova do programa que monta os vídeos, mas ela não passou no meu teste. Continuo com a versão que já funcionava; para você, nada muda.');
});

caso('primeira instalação com a nova reprovada entra a versão testada', async () => {
  const f = falsa({ instalada: false });
  const testada = { rotulo: 'v0.8.0', nova: { rotulo: 'v0.8.0' } };
  const d = dep({ autotestar: autotesteFalso((cand) => cand === '/candidata/v0.8.0'), lerReferencia: () => null });
  const rs = await processarFerramenta(f, { instalada: false, _nova: { rotulo: 'v0.9.0' }, erroConsulta: '' }, {}, { ...d, versaoTestada: () => testada });
  assert.deepStrictEqual(f.chamadas, ['preparar v0.9.0', 'descartar v0.9.0', 'preparar v0.8.0', 'porEmUso v0.8.0']);
  assert.deepStrictEqual(rs.map((r) => r.resultado), ['falhou', 'passou']);
  assert.strictEqual(d.estado.ferramentas.tesseract.emUso, 'v0.8.0');
});

caso('primeira instalação reprovada e sem outra versão testada: não diz "continuo com a que funcionava"', async () => {
  const f = falsa({ instalada: false });
  const testada = { rotulo: 'v0.8.0', nova: { rotulo: 'v0.8.0' } };
  const d = dep({ autotestar: autotesteFalso(() => false), lerReferencia: () => null });
  const rs = await processarFerramenta(f, { instalada: false, _nova: { rotulo: 'v0.8.0' }, erroConsulta: '' }, {}, { ...d, versaoTestada: () => testada });
  assert.strictEqual(rs.length, 1, 'a testada é a mesma que reprovou: não tenta de novo');
  assert.doesNotMatch(rs[0].frase, /já funcionava/);
  assert.strictEqual(rs[0].frase, FRASES.semReserva('programa que monta os vídeos'));
});

caso('sem internet e com versão em uso, segue com ela e avisa em palavras simples', async () => {
  const f = falsa();
  const d = dep({ autotestar: autotesteFalso() });
  const rs = await processarFerramenta(f, { instalada: true, _nova: null, erroConsulta: 'HTTP 403' }, {}, { ...d, versaoTestada: () => null });
  assert.deepStrictEqual(f.chamadas, []);
  assert.strictEqual(rs[0].frase, 'Não consegui ver se há versão nova agora. Sigo com a que já está instalada e funcionando.');
});

caso('--verificar não pede de novo uma versão recusada', async () => {
  const f = falsa();
  f.maisNova = async () => ({ versao: [0, 9, 0], rotulo: 'v0.9.0' });
  const estado = { ferramentas: { tesseract: { emUso: 'v0.8.0', recusadas: ['v0.9.0'] } } };
  const [e] = await verificar({}, ['tesseract'], { ferramentas: [f], estado });
  assert.strictEqual(e.precisa, false);
  assert.match(e.motivo, /recusada no teste/);
  f.maisNova = async () => ({ versao: [0, 9, 1], rotulo: 'v0.9.1' });
  const [e2] = await verificar({}, ['tesseract'], { ferramentas: [f], estado });
  assert.strictEqual(e2.precisa, true, 'uma versão mais nova que a recusada volta a ser testada');
});

caso('sem referência e com versão em uso, a referência nasce da versão em uso antes da candidata', async () => {
  const f = falsa();
  const ordem = [];
  const gravadas = [];
  const d = dep({ autotestar: autotesteFalso(() => true, ordem), lerReferencia: () => (gravadas.length ? { versao: gravadas[0], quadros: [] } : null), gravarReferencia: (raiz, q, v) => gravadas.push(v) });
  await atualizarComTeste(f, { rotulo: 'v0.9.0' }, {}, d);
  assert.deepStrictEqual(ordem, ['em uso', '/candidata/v0.9.0']);
  assert.deepStrictEqual(gravadas, ['0.8.0', 'v0.9.0'], 'primeiro a referência da versão em uso; depois a da que passou');
});

caso('troca de pasta: se a candidata não entra, a versão em uso volta para o lugar', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fabrica-troca-'));
  try {
    const dir = path.join(d, 'whisper-cpp'), cand = path.join(dir, 'candidata');
    fs.mkdirSync(path.join(dir, 'bin'), { recursive: true }); fs.writeFileSync(path.join(dir, 'bin', 'velho'), 'v');
    fs.mkdirSync(path.join(cand, 'bin'), { recursive: true }); fs.writeFileSync(path.join(cand, 'bin', 'novo'), 'n');
    // o antivírus segura a pasta da candidata o tempo todo: a troca desiste e a versão em uso volta
    const preso = (de, para) => { if (de.includes('candidata')) { const e = new Error('ocupado'); e.code = 'EBUSY'; throw e; } fs.renameSync(de, para); };
    assert.throws(() => trocarPasta(dir, cand, { renomear: preso, esperas: [0, 0] }), /ocupado/);
    assert.ok(fs.existsSync(path.join(dir, 'bin', 'velho')), 'a versão em uso tem que continuar no lugar');
    // segura só na primeira tentativa: a troca completa
    let vezes = 0;
    const solta = (de, para) => { if (de.includes('candidata') && vezes++ === 0) { const e = new Error('ocupado'); e.code = 'EPERM'; throw e; } fs.renameSync(de, para); };
    trocarPasta(dir, cand, { renomear: solta, esperas: [0, 0] });
    assert.ok(fs.existsSync(path.join(dir, 'bin', 'novo')));
    assert.ok(fs.existsSync(path.join(dir, 'anterior', 'bin', 'velho')));
    assert.ok(!fs.existsSync(cand));
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
});

caso('falha ao baixar ou montar a candidata não marca a versão como recusada', async () => {
  const f = falsa();
  f.prepararCandidata = async () => { throw new Error('não consegui baixar (HTTP 500)'); };
  const d = dep({ autotestar: autotesteFalso() });
  const r = await atualizarComTeste(f, { rotulo: 'v0.9.0' }, {}, d);
  assert.strictEqual(r.resultado, 'problema');
  assert.ok(!(d.estado.ferramentas.tesseract && (d.estado.ferramentas.tesseract.recusadas || []).length), 'só o teste reprovado recusa a versão');
});

(async () => {
  let n = 0;
  for (const [nome, f] of casos) { await f(); n++; console.log('ok   ' + nome); }
  console.log(`\n${n} testes passaram.`);
})().catch((e) => { console.error(e); process.exit(1); });
