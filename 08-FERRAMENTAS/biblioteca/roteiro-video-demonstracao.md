# Roteiro do vídeo de demonstração

Este é o vídeo curto que mostra, na biblioteca de estilos, como cada modelo de Reels fica. Ele tem **cerca de 15 segundos**,
fala de um assunto neutro (organizar a semana) e é falado em primeira pessoa. Quem grava é você.

Só o vídeo que você liberar vai para o repositório. Antes disso, ele fica só no seu computador, e você assiste a ele antes de decidir.

## O que falar

Leia do jeito que você fala no dia a dia, sem pressa. Os tempos são alvos: erre à vontade, o importante é a ordem e o
respiro entre as partes.

| Tempo-alvo | O que falar | Para que serve |
| --- | --- | --- |
| 0,0 a 3,0 s | "Eu parei de improvisar a minha semana." | **Chamada de abertura** (até 3 s) |
| 3,2 a 4,9 s | "Agora eu **planejo** tudo antes." | A palavra **planejo** é o destaque: fale ela um pouco mais devagar e mais forte |
| 5,0 a 9,8 s | "Pego um café, abro a agenda e escolho três prioridades por dia." | **Dispara a imagem (B-roll)** por volta de 5 s. A fala sobre a imagem dura pelo menos 4,5 s: não termine antes de 9,5 s |
| 10,0 a 13,5 s | "No fim, sobra menos correria e mais tempo para mim." | Fecha a ideia |
| 14,0 a 15,0 s | "**Organize.**" | **Palavra final** (até 1 s). Depois dela, fique em silêncio e parado por meio segundo |

Texto corrido, para ler de uma vez:

> Eu parei de improvisar a minha semana. Agora eu planejo tudo antes. Pego um café, abro a agenda e escolho três
> prioridades por dia. No fim, sobra menos correria e mais tempo para mim. Organize.

Dicas de fala:

- Respire logo antes de começar e pare por um instante antes de "Pego um café": é aí que a imagem entra.
- Se uma frase sair mais longa ou mais curta, tudo bem. Só não deixe o trecho do café ficar abaixo de 4,5 s.
- Não fale nenhum nome de pessoa, de empresa ou de produto.

## Como gravar

- **Celular em pé** (vertical), gravando em **1080 x 1920 e 30 quadros por segundo** (veja nos ajustes da câmera).
- **Rosto na altura certa:** o rosto deve ficar por volta do ponto **600** de cima para baixo no quadro de 1920 (mais ou
  menos um terço da altura, um pouco acima do meio). Fique no centro do quadro e deixe espaço livre acima da cabeça, onde
  os modelos põem texto.
- **Fundo liso**, de uma cor só e sem objetos atrás. Os modelos Protagonista, Concreto Ácido e Primeira Página recortam a
  pessoa do fundo, e fundo cheio de coisas estraga o recorte.
- **Boa luz:** de frente (de uma janela, por exemplo), sem luz forte atrás de você.
- **Sem música** e sem barulho ao fundo. A fala precisa ficar limpa para a transcrição acertar as palavras.
- **Olhe para a câmera** o tempo todo, com o celular firme (apoiado, sem a mão).
- Grave **duas ou três vezes** e fique com a melhor. Comece a gravar um segundo antes de falar e termine um segundo depois.

## Depois de gravar

Se preferir, peça ao Claude para fazer os passos de transcrição e do pedido (passos 2 e 3). Os passos 4 a 6 são o que
decide se o seu rosto entra no repositório, então eles seguem a ordem abaixo: **primeiro gerar, depois assistir, e só
então liberar**.

1. **Guarde o vídeo** em `08-FERRAMENTAS/tesseract/assets-fonte/videos/demonstracao.mp4`. Vídeos nunca vão para o
   repositório (a pasta é ignorada), então não há risco de subir sem querer.
2. **Transcreva** o vídeo com o whisper (veja `08-FERRAMENTAS/tesseract/LEIA-ME.md`), guardando a transcrição em
   `08-FERRAMENTAS/tesseract/modelos/amostra/transcricao.json`, e converta em lista de palavras com tempo:

   ```
   node 08-FERRAMENTAS/tesseract/projetos/palavras.js 08-FERRAMENTAS/tesseract/modelos/amostra/transcricao.json 08-FERRAMENTAS/tesseract/modelos/amostra/palavras-demonstracao.json
   ```

3. **Copie** `08-FERRAMENTAS/tesseract/modelos/amostra/pedido-demonstracao.exemplo.json` para
   `08-FERRAMENTAS/tesseract/modelos/amostra/pedido-demonstracao.json` e ajuste os tempos ao que saiu na gravação, olhando
   `08-FERRAMENTAS/tesseract/modelos/amostra/palavras-demonstracao.json`:
   - `chamada`: de onde a primeira frase começa até onde termina (no máximo 3 s);
   - `destaques`: a palavra que você destacou;
   - `broll`: `ini` é o instante em que você começa "Pego um café", e `fim` é no mínimo 4,5 s depois;
   - `palavraTela`: o instante da palavra final, com até 1 s;
   - `trecho.fim`: a duração do vídeo.

   **Deixe `"liberado": false`** (é como o exemplo vem). Esses arquivos de trabalho (transcrição, palavras e pedido) ficam
   só no seu computador: o git os ignora.

4. **Gere as prévias em vídeo** dos estilos. Cada estilo leva alguns minutos, porque o vídeo é montado de verdade; para
   todos os estilos, deixe rodando e faça outra coisa enquanto isso:

   ```
   node 08-FERRAMENTAS/biblioteca/gerar-previas.js --video 08-FERRAMENTAS/tesseract/modelos/amostra/pedido-demonstracao.json
   ```

   Com `"liberado": false`, os vídeos ficam em `04-LABORATORIO-DE-DESIGN/biblioteca/previas-locais/<estilo>/`, **só neste
   computador** (o git ignora essa pasta). Para um estilo só, escreva o nome dele antes: `gerar-previas.js protagonista --video ...`.
   Cada trecho tem 12 segundos e não tem som. Ele começa um pouco antes da imagem entrar, para mostrar o título, a legenda,
   a imagem com você ao lado e a sua volta à tela.

5. **Assista** na página de revisão:

   ```
   node 08-FERRAMENTAS/biblioteca/revisao.js
   ```

   Abra `04-LABORATORIO-DE-DESIGN/biblioteca/revisao.html` no navegador. Cada vídeo ainda não liberado aparece com o selo
   **Só neste computador**. Veja se o rosto está bem enquadrado, se o recorte ficou limpo e se a troca de quadro acontece na hora certa.
   Se algo não agradou, regrave ou ajuste o pedido e repita o passo 4.

6. **Só se você aprovou**, libere: no `pedido-demonstracao.json`, troque `"liberado": false` por `"liberado": true`. Isso diz que
   **você autoriza este vídeo a entrar no repositório**. Rode de novo, aproveitando os vídeos já montados no passo 4 para não
   montar tudo outra vez:

   ```
   node 08-FERRAMENTAS/biblioteca/gerar-previas.js --video 08-FERRAMENTAS/tesseract/modelos/amostra/pedido-demonstracao.json --reusar 08-FERRAMENTAS/tesseract/modelos/amostra/saida
   ```

   Agora os vídeos ficam em `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/`, e é essa pasta que entra no repositório.
   Se não quiser liberar, é só não fazer este passo: o vídeo continua só no seu computador.
