# Briefing da linha (leia este no lugar da empresa inteira)

Detalhes só quando o passo pedir: `preferencias-aprovadas.md` e `biblioteca-de-modelos.md` (os da empresa do run, caminho `dadosLinha` dos caminhos que o runner passou; se faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`), `08-FERRAMENTAS/tesseract/LEIA-ME.md`.

## Estilo de vídeo
Perguntado uma vez por empresa, no passo 1 (chamada 0): o `estilo-de-video.md` da empresa ativa (caminho `estiloDeVideo`), a partir da entrevista de
`dados/entrevista-de-estilo.md`. O responsável nunca decide por termo técnico: pergunta curta, prévia, recomendação (V-09).

## Camada de produção
Perguntada no passo 1: Expresso, Padrão ou Vitrine (`camadas-de-producao.md`). Define o que pode ser criado; ninguém cria
motion, mapa, ficha ou ilustração fora da camada.

## Marca (valores vêm do `marca.yaml` da empresa ativa, caminho `marca`; decisões, do `decisoes.md` dela, caminho `decisoes`)
- Cores por papel: `escuro`, `claro`, `acento`, `neutro`. Fontes por papel: `principal`, `mono`.
- A proporção máxima da cor de acento e onde ela pode aparecer são decisão da empresa (o `decisoes.md` dela, caminho `decisoes`).
- Logo só no cartão final (e na capa). Um só CTA por vídeo.
- Vocabulário vetado: `marca.yaml` (`video.vocabulario-vetado`) mais as regras do Núcleo. Promessa numérica ou de
  resultado, preço e "link na bio" não entram em texto de tela.

## Posição (formato Reels 1080x1920)
- O queixo se mede em quadro real, por janela. Topo de mockup, placa ou cartão ≥ queixo + 50 px (placas na faixa
  y 955 a 1305 quando a pessoa grava perto).
- Headline começa em y ≥ 250 (foto de perfil); legenda em y 1320 a 1460; nada importante abaixo de y 1600 (barra da rede).
- Gráfico nunca sobre o rosto; conferir no enquadramento aberto e no fechado (115%).

## Regras permanentes de execução
1. **O modelo forte planeja e arquiteta; o modelo leve executa.** Passos 3 e 4 no modelo forte só na Vitrine; o passo 6 (export, mixagem, conferência) sempre em modelo leve, em estação nova que lê `estrutura.md`.
2. **Amostra em vídeo de ~10 s para aprovar a estrutura** em Padrão e Vitrine: o trecho mais denso em motion, com as animações finais, exportado no passo 4 e mostrado no passo 5 junto com a prancha. Só depois do "sim" vem o export do vídeo inteiro. Expresso: prancha.
3. **Export final em pelo menos 3 pedaços**, um export por versão.
4. **RAM:** antes do passo 4 e do passo 6, conferir a RAM livre; com menos de 3 GB, pedir que o responsável feche o navegador em vez de dividir em 2.

## REGRA DE LINK (pedida pela responsável, cobrada várias vezes)
Toda mídia gráfica entregue (vídeo, capa, prancha, amostra, comparação, preview) vai **registrada no laboratório** (o painel do laboratório da empresa) e **a resposta traz o link clicável** o endereço do servidor local do laboratório seguido do caminho da peça de cada peça, conferido com uma requisição local (resposta 200) antes de mandar. Nunca entregar só caminho de arquivo da raiz: o responsável não busca em pasta. Em checkpoint (passos 7 e 10), os links vêm **antes** da pergunta. O agente que gera a mídia cria o `preview.html` e registra a entrada; se esquecer, o runner faz antes de abrir o checkpoint.

## Tesseract (0.3.1)
- Ordem: `montar-video.js` → blocos de motion (`aplicar.js`) → **export em pedaços** (`exportar-em-pedacos.js`) →
  `mixar-audio.js`. O motion não é idempotente: remontar antes de rodar de novo.
- Export em segundo plano, nunca em primeiro. Um export por versão. Padrão:
  `node exportar-em-pedacos.js --decupagem <pasta>/decupagem-v1.json --pedacos 3` (4 só com 6 GB ou mais de RAM livre; **nunca 2**:
  o modo `auto` cai para 2 abaixo de 3 GB, e o mínimo é 3). Inteiro só como fallback com motivo.
- Convenção das janelas: a decupagem lista, em `motion.janelas`, `{ "id", "inicio", "fim" }` para cada bloco de motion,
  em segundos do vídeo inteiro, cobrindo entrada, permanência e saída (folga de ~0,1 s). Bloco sem janela = export inteiro.
- Dois keyframes no mesmo track repetem o instante 0 e recusam o lote. Forma ignora alfa. Texto centralizado na vertical
  sobe ~0,38 do corpo.
- `montar-video.js` só esconde a legenda sob `cartao` e `cta`; em mockup, declarar `escondeLegenda`.
- Nunca editar `montar-video.js`, `pre-edicao.js`, `mixar-audio.js` por vídeo.

## Transcrição
- Sobre o vídeo editado. Palavra duvidosa que não muda fato, número ou nome (um/num) não gera nova transcrição: cortar
  clipe de ~2 s e listar nas pendências. No máximo 1 re-transcrição, só para termo técnico, data ou nome próprio.

## Evidência
- Medida sai de script ou de quadro olhado. "Deve estar certo" não vale.
- Decisão gráfica nunca por texto: mostrar quadro ou prancha.

## Blocos de motion
- Catálogo: `node 08-FERRAMENTAS/tesseract/blocos-motion/gerar-catalogo.js` gera `catalogo.html` com quadros reais.
  Escolher blocos por JSON (`{id, tipo, inicio, fim, textos, opcoes}`); na camada Padrão, nunca escrever motion do zero.
  Medir o queixo de cada vídeo antes de aceitar a faixa padrão.
