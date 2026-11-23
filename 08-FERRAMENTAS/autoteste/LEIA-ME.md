# Autoteste das ferramentas de vídeo

Quando sai versão nova do ffmpeg, do whisper ou do Tesseract, a Fábrica instala a versão nova à parte e roda este teste
no próprio computador antes de usá-la (`_fabrica/core/autoteste-ferramentas.js`, chamado pelo `ferramentas.js`). Se o
teste falhar, a versão que já funcionava continua em uso. A pessoa vê uma frase simples; nada para no meio de um Reels.

Para rodar à mão: `node _fabrica/core/autoteste-ferramentas.js` (`--so ffmpeg,whisper,tesseract`, `--json`,
`--sem-referencia`).

## O que o teste confere

| Etapa | O que faz | Reprova quando |
|---|---|---|
| ffmpeg | lista codificadores e filtros; gera um vídeo de 4 s com som; o ffprobe lê | falta `libx264`, `aac`, `png`, `pcm_s16le`, `libwebp`, `libvpx-vp9` ou um dos filtros que a Fábrica usa; o vídeo sai sem som ou com outra duração |
| whisper | transcreve `fala-jfk.wav` com o modelo da Fábrica e a saída `-ojf` do Reels | não transcreve, a palavra `country` não aparece ou os tempos saem fora de ordem |
| Tesseract | monta, com o modelo de edição `vitrine`, um vídeo de 4 s sobre o vídeo do ffmpeg; confere o MP4 (1080x1920, 4 s, com som) e 4 quadros (0,5 s, 1,5 s, 2,5 s e 3,5 s) | o vídeo não sai, sai errado, algum quadro sai vazio ou os quadros mudam em relação aos da última versão que passou neste computador |

## Comparação dos quadros

A referência é a última versão que passou **neste computador** (`08-FERRAMENTAS/.autoteste/referencia/`, fora do git),
porque placas de vídeo diferentes desenham com pequenas diferenças. Sem referência, a versão em uso gera a referência
antes de a nova ser testada; numa instalação nova, a primeira versão que passa vira a referência. Uma versão que está em
`_fabrica/core/versoes-testadas.json` pode mudar o visual: quem mantém a Fábrica já conferiu, e a referência é refeita.

Limites: diferença média até 2 (numa escala de 0 a 255) e até 0,5% dos pontos com diferença acima de 32.

Medição de 22/11/2026, Windows, modelo `vitrine`, 4 quadros:

| Comparação | Diferença |
|---|---|
| 0.7.0 com 0.7.0 (duas rodadas) | 0 em todos os quadros |
| 0.6.0 com 0.7.0 | 0 em todos os quadros |
| 0.7.0 com 0.8.0 | 0 em todos os quadros |
| 0.6.0 com 0.8.0 | 0 em todos os quadros |

## A fala de teste

`fala-jfk.wav` é o trecho do discurso de posse de John F. Kennedy (1961) que acompanha o whisper.cpp
(`samples/jfk.wav`, no repositório `ggml-org/whisper.cpp`): 11 s, 16 kHz, mono. Gravação feita por um presidente dos
Estados Unidos no exercício do cargo, obra do governo federal americano, em domínio público.
