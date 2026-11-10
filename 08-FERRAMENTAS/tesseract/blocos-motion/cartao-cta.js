// Bloco `cartao-cta`: cartão final com o endereço da conta (marca.yaml), logo opcional, argumento e botão na cor de acento.
// Mesmo desenho do bloco `cta` do montar-video.js, agora por JSON. O cartão é um retângulo claro desenhado por ação; a logo,
// se houver (pecas.logo do contrato: PNG, JPG, WebP ou SVG), entra como camada de DOCUMENTO: o aplicar.js importa o asset e grava a camada.
'use strict';
const fs = require('fs');
const path = require('path');
const marca = require('../../marca/marca');
const { ESCURO, CLARO, ACENTO } = require('./nucleo');
const { medirLargura } = require('./medir');

const tipo = 'cartao-cta';
const BOM_INICIO = new RegExp('^' + String.fromCharCode(0xfeff)); // montado pelo código: nenhum caractere invisível aqui

// Largura e altura do logo, lidas do conteúdo do arquivo (a extensão pode mentir): PNG, JPG, WebP (com perdas, sem perdas
// e estendido) e SVG (width/height em px ou número; senão o viewBox), os tipos que o painel aceita como logo. Outro arquivo,
// ou SVG sem medida nenhuma: erro "logo: ..." (nunca um tamanho inventado). Lado zero ou acima de 20000 px também é erro
// (a escala do cartão viraria infinita ou zero).
const LADO_MAXIMO = 20000;
function tamanhoDaImagem(buf) {
  const [l, a] = lerTamanho(buf);
  if (!(Number.isInteger(l) && Number.isInteger(a) && l >= 1 && a >= 1 && l <= LADO_MAXIMO && a <= LADO_MAXIMO)) {
    throw new Error(`logo: o tamanho lido (${l} x ${a}) não serve: cada lado precisa ter de 1 a ${LADO_MAXIMO} px`);
  }
  return [l, a];
}
function lerTamanho(buf) {
  const erro = (m) => new Error('logo: ' + m);
  if (!Buffer.isBuffer(buf) || buf.length < 12) throw erro('o arquivo é pequeno demais para ser uma imagem');
  // PNG: assinatura e o bloco IHDR
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.length >= 24 && buf.toString('latin1', 12, 16) === 'IHDR') return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  // JPEG: anda pelos segmentos até o quadro (SOF0..SOF15, menos DHT C4, JPG C8 e DAC CC)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xd9 || m === 0xda) break;
      const tam = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + tam;
    }
    throw erro('não achei o tamanho dentro deste JPG');
  }
  // WebP: RIFF ... WEBP e o primeiro bloco (VP8, VP8L ou VP8X)
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP' && buf.length >= 25) {
    const bloco = buf.toString('latin1', 12, 16);
    if (bloco === 'VP8 ' && buf.length >= 30 && buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (bloco === 'VP8L' && buf[20] === 0x2f) {
      const v = buf.readUInt32LE(21);
      return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1];
    }
    if (bloco === 'VP8X' && buf.length >= 30) return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
    throw erro('não achei o tamanho dentro deste WebP');
  }
  // SVG: texto que começa por <svg depois da declaração, comentários e DOCTYPE
  const txt = buf.toString('utf8', 0, Math.min(buf.length, 65536)).replace(BOM_INICIO, '');
  const m = /<svg\b([^>]*)>/i.exec(txt);
  if (m && /^\s*(<\?xml[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg\b/i.test(txt)) {
    const attr = (nome) => { const a = new RegExp(`\\s${nome}\\s*=\\s*["']([^"']*)["']`, 'i').exec(m[1]); return a ? a[1].trim() : null; };
    const medida = (v) => { const x = v && /^([0-9]*\.?[0-9]+)(px)?$/i.exec(v); return x && Number(x[1]) > 0 ? Math.round(Number(x[1])) : null; };
    const l = medida(attr('width')), a = medida(attr('height'));
    if (l && a) return [l, a];
    const vb = (attr('viewBox') || '').split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return [Math.round(vb[2]), Math.round(vb[3])];
    throw erro('o SVG não diz o tamanho (sem width/height nem viewBox)');
  }
  throw erro('o arquivo não é PNG, JPG, WebP nem SVG');
}

function validar(bloco) {
  const e = [];
  const t = bloco.textos || {}, o = bloco.opcoes || {};
  if (!t.frase || typeof t.frase !== 'string') e.push('textos.frase: argumento do cartão');
  else if (t.frase.length > 64) e.push('textos.frase: até ~64 caracteres (2 linhas de 800 px)');
  if (!t.botao || typeof t.botao !== 'string') e.push('textos.botao: texto do botão');
  if (o.logo && !fs.existsSync(path.resolve(o.logo))) e.push('opcoes.logo: arquivo não encontrado');
  else if (o.logo) { try { tamanhoDaImagem(fs.readFileSync(path.resolve(o.logo))); } catch (x) { e.push('opcoes.logo: ' + x.message); } }
  if (/link na bio/i.test(`${t.frase} ${t.botao}`)) e.push('"link na bio" não funciona em vídeo: use outra chamada');
  return e;
}

function construir(bloco, c) {
  const t = bloco.textos, o = bloco.opcoes || {};
  const A0 = bloco.inicio, Z = bloco.fim;
  const cy0 = o.centroY ?? 1310;          // centro do cartão (1310 padrão; desce quando o trecho final está fechado e o rosto fica maior)
  const dy = cy0 - 1310;
  const Y = (v) => v - c.dy;              // o cartão tem posição própria (centroY): não acompanha a --faixa das placas
  const conta = o.conta ?? marca.handle;
  const logoContrato = marca.pega('pecas.logo', '');
  let arqLogo = o.logo ? path.resolve(o.logo) : (logoContrato ? marca.caminho(logoContrato) : null);
  // O tamanho do logo pelo tipo do arquivo. Logo do contrato que não dá para ler não derruba o vídeo: o cartão sai só com o
  // endereço da conta, com aviso. O logo pedido no bloco (opcoes.logo) já foi conferido no validar.
  let tamanho = null;
  if (arqLogo) {
    try { tamanho = tamanhoDaImagem(fs.readFileSync(arqLogo)); } catch (e) {
      if (o.logo) throw e;
      console.warn(`[cartao-cta] ${e.message} (${path.basename(arqLogo)}); o cartão sai sem o logo.`);
      arqLogo = null;
    }
  }

  const cartao = c.rect('cartao', A0, Z, [80, Y(1060 + dy)], [920, 500], CLARO, { raio: 26 });
  c.preset(cartao, 'slideUp', 'none');
  if (arqLogo) {
    const escala = Math.round((64 / Math.max(tamanho[0], tamanho[1])) * 100);
    const logo = c.imagem('logo', A0 + 0.2, Z, { asset: 'cta-logo', arquivo: arqLogo, pos: [168, Y(1142 + dy)], tamanho, escala });
    c.preset(logo, 'pop', 'none');
  }
  if (conta) {
    const tc = c.texto('conta', A0 + 0.2, Z, [arqLogo ? 216 : 136, Y(1112 + dy)], [640, 40], conta, { estilo: 'SemiBold', tam: 28, cor: ESCURO, just: 'left',
      tracking: -10, caixaAlta: false, vAlign: 'top' });
    c.preset(tc, 'softRise', 'none');
  }
  const frase = c.texto('frase', A0 + 0.2, Z, [136, Y(1200 + dy)], [800, 130], t.frase, { estilo: 'ExtraBold', tam: 50, cor: ESCURO, just: 'left', tracking: -25,
    caixaAlta: false, vAlign: 'top', extra: { leading: 56 } });
  c.preset(frase, 'softRise', 'none');
  const bw = (o.larguraBotao ?? medirLargura(t.botao, 40, 'Bold')) + 120, bh = 104, cy = Y(1442 + dy);
  const botao = c.rect('botao', A0 + 0.45, Z, [540, cy], [bw, bh], ACENTO, { anchor: [bw / 2, bh / 2] });
  c.preset(botao, 'pop', 'none');
  const bt = c.texto('botao-texto', A0 + 0.45, Z, [540, cy], [bw, bh], t.botao, { estilo: 'Bold', tam: 40, cor: ESCURO, just: 'center', tracking: -10,
    caixaAlta: false, vAlign: 'center', anchor: [bw / 2, bh / 2], semCompensacao: true });
  c.preset(bt, 'pop', 'none');
  c.sons.push({ tipo: 'cta', ini: Number((A0 + c.desloca).toFixed(3)), fim: Number((Z + c.desloca).toFixed(3)), img: 'cartao-cta ' + bloco.id });
  return { janelas: [{ id: bloco.id, inicio: A0, fim: Z }], ocupaLegenda: true };
}

const exemplo = {
  id: 'cta-final', tipo: 'cartao-cta', inicio: 30.0, fim: 34.5,
  textos: { frase: 'seu negócio explicando a regra X antes do cliente perguntar', botao: 'Mande uma mensagem' },
  opcoes: { centroY: 1310 },
};
const campos = {
  'textos.frase': 'argumento em ExtraBold 50 da fonte principal, caixa mista, até 2 linhas (~64 caracteres)',
  'textos.botao': 'texto do botão na cor de acento (a largura é medida no render)',
  'opcoes.centroY': 'centro do cartão (padrão 1310; desce quando o trecho final está fechado e o rosto fica maior)',
  'opcoes.larguraBotao': 'largura do texto do botão em px, para não medir no Tesseract',
  'opcoes.conta': 'endereço da conta no cartão (padrão: empresa.handle do contrato de marca)',
  'opcoes.logo': 'logo em PNG, JPG, WebP ou SVG, o tamanho lido do próprio arquivo (padrão: pecas.logo do contrato; sem logo, o cartão leva só o endereço da conta)',
};
module.exports = { tipo, descricao: 'Cartão final: endereço da conta (e logo, se houver), argumento e botão na cor de acento.', validar, construir, exemplo, campos, ocupaLegenda: true, tamanhoDaImagem };
