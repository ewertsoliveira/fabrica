#!/usr/bin/env node
// Gera uma imagem realista por IA gratuita. Arquivo único, sem dependências (só Node 18+).
//
// Uso:
//   node gerar.js "descrição da foto" [--saida arquivo.png] [--largura 1024] [--altura 1024]
//                 [--provedor pollinations|huggingface|cloudflare] [--semente 42]
//
// Provedores (escolha automática: o primeiro com credencial; pollinations não precisa de nenhuma):
//   huggingface  HF_TOKEN                          (grátis via Space do FLUX.1-schnell, melhor qualidade)
//   cloudflare   CF_ACCOUNT_ID + CF_API_TOKEN      (grátis até a cota diária, FLUX.1-schnell)
//   pollinations nenhuma                           (grátis, sem cadastro; pode vir com marca d'água)
//
// Credenciais ficam em variáveis de ambiente ou num arquivo .env na raiz do projeto (nunca no código).

const fs = require('fs');
const path = require('path');

function carregarEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const f = path.join(dir, '.env');
    if (fs.existsSync(f)) {
      for (const linha of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
      return;
    }
    const pai = path.dirname(dir);
    if (pai === dir) return;
    dir = pai;
  }
}

function lerArgs(argv) {
  const a = { prompt: [], saida: null, largura: 1024, altura: 1024, provedor: null, semente: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--saida') a.saida = argv[++i];
    else if (k === '--largura') a.largura = parseInt(argv[++i], 10);
    else if (k === '--altura') a.altura = parseInt(argv[++i], 10);
    else if (k === '--provedor') a.provedor = argv[++i];
    else if (k === '--semente') a.semente = parseInt(argv[++i], 10);
    else a.prompt.push(k);
  }
  a.prompt = a.prompt.join(' ').trim();
  return a;
}

// Realismo: sufixo que empurra o modelo para foto de verdade em vez de arte digital.
const REALISMO =
  ', realistic photograph, shot on DSLR 85mm lens, soft natural light, natural skin texture, shallow depth of field, no text, no watermark';

async function pollinations({ prompt, largura, altura, semente }) {
  const q = new URLSearchParams({ width: largura, height: altura, model: 'flux', nologo: 'true', enhance: 'true' });
  if (semente != null) q.set('seed', semente);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${q}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`pollinations HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

// Space gratuito do FLUX.1-schnell (GPU compartilhada). Cada conta tem uma cota diária de GPU; quando ela acaba, o
// Space responde "event: error". A chamada sem token usa uma cota separada (por IP), então serve de reserva.
async function huggingface(args) {
  const tentativas = process.env.HF_TOKEN ? [true, false] : [false];
  let ultimo;
  for (const comToken of tentativas) {
    try {
      return await huggingfaceChamar(args, comToken);
    } catch (e) {
      ultimo = new Error(`${comToken ? 'com token' : 'sem token'}: ${e.message}`);
      if (comToken && /^huggingface HTTP/.test(e.message) === false && !/event: error/.test(e.message)) throw ultimo;
    }
  }
  throw ultimo;
}

async function huggingfaceChamar({ prompt, largura, altura, semente }, comToken) {
  const espaco = process.env.HF_SPACE || 'https://black-forest-labs-flux-1-schnell.hf.space';
  const cab = { 'Content-Type': 'application/json' };
  if (comToken) cab.Authorization = `Bearer ${process.env.HF_TOKEN}`;
  const arred = (n) => Math.min(2048, Math.max(256, Math.round(n / 32) * 32));
  const dados = [prompt, semente == null ? 0 : semente, semente == null, arred(largura), arred(altura), 4];
  const r = await fetch(`${espaco}/gradio_api/call/infer`, {
    method: 'POST', headers: cab, body: JSON.stringify({ data: dados }), signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`huggingface HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const { event_id } = await r.json();
  const fluxo = await fetch(`${espaco}/gradio_api/call/infer/${event_id}`, { headers: cab, signal: AbortSignal.timeout(180000) });
  const texto = await fluxo.text();
  // Resposta em eventos SSE: linhas "event: X" seguidas de "data: ...". Vale o último evento.
  const linhas = texto.split('\n').map((l) => l.replace(/\r$/, ''));
  const iEv = linhas.map((l) => l.startsWith('event:')).lastIndexOf(true);
  const tipo = iEv >= 0 ? linhas[iEv].slice(6).trim() : '';
  const dadosEv = iEv >= 0 ? (linhas[iEv + 1] || '').replace(/^data:\s*/, '') : '';
  if (tipo !== 'complete') throw new Error(`huggingface: ${texto.slice(0, 200).replace(/\s+/g, ' ')}`);
  const url = JSON.parse(dadosEv)[0].url;
  const img = await fetch(url, { headers: cab, signal: AbortSignal.timeout(60000) });
  if (!img.ok) throw new Error(`huggingface: download HTTP ${img.status}`);
  return Buffer.from(await img.arrayBuffer());
}

async function cloudflare({ prompt }) {
  const modelo = process.env.CF_MODELO || '@cf/black-forest-labs/flux-1-schnell';
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${modelo}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, steps: 8 }),
    signal: AbortSignal.timeout(180000),
  });
  if (!r.ok) throw new Error(`cloudflare HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  if (!j.result || !j.result.image) throw new Error('cloudflare: resposta sem imagem');
  return Buffer.from(j.result.image, 'base64');
}

const PROVEDORES = {
  huggingface: { fn: huggingface, pronto: () => true },
  cloudflare: { fn: cloudflare, pronto: () => !!(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) },
  pollinations: { fn: pollinations, pronto: () => true },
};

// Alguns provedores devolvem WebP/JPEG mesmo quando o nome pedido é .png: a extensão segue o conteúdo real.
function ajustarExtensao(arquivo, buf) {
  const tipo = buf.slice(0, 4).toString('latin1') === 'RIFF' ? '.webp' : buf[0] === 0xff ? '.jpg' : buf[0] === 0x89 ? '.png' : null;
  return tipo ? arquivo.replace(/\.[a-z0-9]+$/i, '') + tipo : arquivo;
}

async function main() {
  carregarEnv();
  const a = lerArgs(process.argv.slice(2));
  if (!a.prompt) {
    console.error('Uso: node gerar.js "descrição da foto" [--saida arq.png] [--largura N] [--altura N] [--provedor nome]');
    process.exitCode = 2;
    return;
  }
  const ordem = a.provedor ? [a.provedor] : ['cloudflare', 'huggingface', 'pollinations'];
  const prontos = ordem.filter((n) => PROVEDORES[n] && PROVEDORES[n].pronto());
  if (!prontos.length) {
    console.error(`Provedor inválido ou sem credencial: ${ordem.join(', ')}`);
    process.exitCode = 2;
    return;
  }
  const completo = { ...a, prompt: a.prompt + REALISMO };
  const saida = path.resolve(a.saida || `imagem-${Date.now()}.png`);
  fs.mkdirSync(path.dirname(saida), { recursive: true });

  const erros = [];
  for (const nome of prontos) {
    try {
      const buf = await PROVEDORES[nome].fn(completo);
      if (buf.length < 1000) throw new Error('resposta pequena demais para ser uma imagem');
      const arq = ajustarExtensao(saida, buf);
      fs.writeFileSync(arq, buf);
      console.log(JSON.stringify({ ok: true, provedor: nome, arquivo: arq, bytes: buf.length }));
      return;
    } catch (e) {
      erros.push(`${nome}: ${e.message}`);
    }
  }
  console.error(JSON.stringify({ ok: false, erros }));
  process.exitCode = 1;
}

main();
