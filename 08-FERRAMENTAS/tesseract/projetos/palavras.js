// Converte a transcrição do whisper.cpp (-ojf) em lista de palavras com tempo, aplicando correções de grafia.
// Uso: node palavras.js transcricao.json [palavras.json]
// Saída: [{ w: "Olá,", ini: 580, fim: 690, frase: 0 }, ...] (ms)
const fs = require('fs');

// Erros recorrentes da transcrição em nomes próprios e marcas. As correções da empresa vêm do contrato de marca
// (video.correcoes-transcricao em 06-MARCA-E-FOTOS/marca.yaml): uma palavra por chave, sem diferenciar maiúsculas.
const marca = require('../../marca/marca');
const CORRECOES = {
  meta: 'Meta', instagram: 'Instagram', google: 'Google', facebook: 'Facebook',
  'palavras-chaves': 'palavras-chave',
};
for (const [de, para] of Object.entries(marca.pega('video.correcoes-transcricao', {}) || {})) CORRECOES[String(de).toLowerCase()] = para;

const [, , entrada, saida = 'palavras.json'] = process.argv;
const j = JSON.parse(fs.readFileSync(entrada, 'utf8'));
const palavras = [];

j.transcription.forEach((seg, fi) => {
  let atual = null;
  for (const t of seg.tokens) {
    if (t.text.startsWith('[_')) continue; // tokens especiais
    const novaPalavra = t.text.startsWith(' ') || !atual;
    if (novaPalavra) {
      if (atual) palavras.push(atual);
      atual = { w: t.text.trim(), ini: t.offsets.from, fim: t.offsets.to, frase: fi };
    } else {
      atual.w += t.text;
      atual.fim = Math.max(atual.fim, t.offsets.to);
    }
  }
  if (atual) palavras.push(atual);
});

for (const p of palavras) {
  const nu = p.w.replace(/[.,!?;:]+$/, '');
  const pont = p.w.slice(nu.length);
  if (CORRECOES[nu.toLowerCase()]) p.w = CORRECOES[nu.toLowerCase()] + pont;
  if (p.fim < p.ini) p.fim = p.ini;
}
// tokens sem duração ganham o tempo até a próxima palavra
palavras.forEach((p, i) => { if (p.fim === p.ini && palavras[i + 1]) p.fim = Math.min(palavras[i + 1].ini, p.ini + 250); });

fs.writeFileSync(saida, JSON.stringify(palavras, null, 1));
console.log(palavras.length + ' palavras → ' + saida);
