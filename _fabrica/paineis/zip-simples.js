// Monta um arquivo .zip (sem compressão, como o "guardar" do zip) a partir de arquivos já na memória. Serve para o
// botão "Baixar todas" do Cronograma e do arquivo do cliente: as imagens PNG e o vídeo já vêm comprimidos, então
// guardar sem comprimir dá praticamente o mesmo tamanho e é instantâneo. Nomes em UTF-8 (acentos funcionam).
// Sem dependência nenhuma: roda no navegador (window.ZipSimples) e no Node (testes).
//
//   ZipSimples.montar([{ nome: 'lamina-01.png', dados: Uint8Array }, ...]) -> Uint8Array (o .zip inteiro)
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.ZipSimples = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  let tabela = null;
  function crc32(bytes) {
    if (!tabela) {
      tabela = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        tabela[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = tabela[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }

  // Data e hora no formato do DOS (o do zip), na hora local.
  function dataDos(d) {
    const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const dia = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { hora, dia };
  }

  function montar(arquivos, quando) {
    const { hora, dia } = dataDos(quando || new Date());
    const partes = [];
    const central = [];
    let posicao = 0;
    const usados = new Set();
    for (const a of arquivos) {
      // nome sem pasta e sem repetir (o segundo "arte.png" vira "arte (2).png")
      const base = String(a.nome || 'arquivo').replace(/[\\/:*?"<>|]+/g, '-');
      let nome = base;
      for (let n = 2; usados.has(nome.toLowerCase()); n++) nome = base.replace(/(\.[^.]*)?$/, ` (${n})$1`);
      usados.add(nome.toLowerCase());
      const dados = a.dados instanceof Uint8Array ? a.dados : new Uint8Array(a.dados);
      const n = utf8(nome);
      const crc = crc32(dados);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nome em UTF-8
      local.setUint16(8, 0, true); // sem compressão
      local.setUint16(10, hora, true);
      local.setUint16(12, dia, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, dados.length, true);
      local.setUint32(22, dados.length, true);
      local.setUint16(26, n.length, true);
      local.setUint16(28, 0, true);
      partes.push(new Uint8Array(local.buffer), n, dados);
      const cab = new DataView(new ArrayBuffer(46));
      cab.setUint32(0, 0x02014b50, true);
      cab.setUint16(4, 20, true);
      cab.setUint16(6, 20, true);
      cab.setUint16(8, 0x0800, true);
      cab.setUint16(10, 0, true);
      cab.setUint16(12, hora, true);
      cab.setUint16(14, dia, true);
      cab.setUint32(16, crc, true);
      cab.setUint32(20, dados.length, true);
      cab.setUint32(24, dados.length, true);
      cab.setUint16(28, n.length, true);
      cab.setUint32(42, posicao, true);
      central.push(new Uint8Array(cab.buffer), n);
      posicao += 30 + n.length + dados.length;
    }
    const tamanhoCentral = central.reduce((s, p) => s + p.length, 0);
    const fim = new DataView(new ArrayBuffer(22));
    fim.setUint32(0, 0x06054b50, true);
    fim.setUint16(8, arquivos.length, true);
    fim.setUint16(10, arquivos.length, true);
    fim.setUint32(12, tamanhoCentral, true);
    fim.setUint32(16, posicao, true);
    const todas = partes.concat(central, [new Uint8Array(fim.buffer)]);
    const saida = new Uint8Array(todas.reduce((s, p) => s + p.length, 0));
    let i = 0;
    for (const p of todas) { saida.set(p, i); i += p.length; }
    return saida;
  }

  return { montar, crc32 };
});
