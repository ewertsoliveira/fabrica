// Cria um projeto-base mínimo para testar blocos: fontes da marca + um fundo de 1080x1920, que pode ser uma imagem
// (parada por X segundos) ou um vídeo .mp4/.mov (a duração é a do vídeo).
// Uso: node criar-base.js <saida.tsrct> <fundo.png|jpg|mp4> [duracaoSegundos=70]
// Serve para o catálogo, a demo e a equivalência. Um vídeo de verdade usa o projeto que o montar-video.js gerou.
'use strict';
const fs = require('fs');
const path = require('path');
const { tsrct, commit } = require('./tsrct');
const fontes = require('../fontes');

// identificador do formato de documento do Tesseract (não é um endereço acessado)
const SCHEMA = ['https:/', '/jerboa.dev/schemas/fx-composition/editable/v1/document.schema.json'].join('');

function criarBase(saida, fundo, duracao = 70) {
  saida = path.resolve(saida);
  if (fs.existsSync(saida)) fs.rmSync(saida);
  tsrct('project', 'create', '-p', saida);
  fontes.importar(tsrct, saida, 'principal');
  fontes.importar(tsrct, saida, 'mono');
  const ehVideo = /\.(mp4|mov)$/i.test(fundo);
  let camada;
  if (ehVideo) {
    const vid = JSON.parse(tsrct('project', 'import-video', '-p', saida, '--file', path.resolve(fundo), '--asset-id', 'fundo-teste'));
    const D = vid.durationMs; duracao = D / 1000;
    const r = { start: 0, duration: D };
    // Tesseract 0.3.1: vídeo usa playback "windowed" no lugar de activeRange (mesma conversão do montar-video.js)
    camada = { id: 1, blendMode: 'normal', effects: [], layerStyles: [], masks: [], type: 'Video', name: 'video', volume: 1,
      playback: { type: 'windowed', inputRange: r, mapping: { type: 'linear', input: { ...r }, output: { ...r } }, inputOffsetMs: 0 },
      sourceRange: r, sourceIntrinsicDuration: D,
      transform: { anchorPoint: [540, 960], position: [540, 960], scale: [100, 100], rotation: 0, opacity: 100 },
      source: { assetId: 'fundo-teste', fit: 'cover' } };
  } else {
    tsrct('project', 'import-asset', '-p', saida, '--file', path.resolve(fundo), '--asset-id', 'fundo-teste', '--kind', 'image');
    camada = { id: 1, blendMode: 'normal', effects: [], layerStyles: [], masks: [], type: 'Image', name: 'fundo-teste',
      activeRange: { start: 0, duration: Math.round(duracao * 1000) },
      transform: { anchorPoint: [540, 960], position: [540, 960], scale: [100, 100], rotation: 0, opacity: 100 },
      source: { assetId: 'fundo-teste', fit: 'cover' } };
  }
  const doc = {
    $schema: SCHEMA,
    formatVersion: 1, dimensions: { width: 1080, height: 1920 }, duration: duracao,
    composition: { id: 'main', name: 'Main', layers: [camada] },
  };
  commit(saida, doc);
  return saida;
}

if (require.main === module) {
  const [saida, fundo, dur] = process.argv.slice(2);
  if (!saida || !fundo) { console.error('uso: node criar-base.js <saida.tsrct> <fundo.png> [duracao]'); process.exit(2); }
  console.log(criarBase(saida, fundo, dur ? Number(dur) : 70));
}
module.exports = { criarBase };
