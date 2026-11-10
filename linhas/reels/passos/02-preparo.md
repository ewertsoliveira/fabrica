---
execucao: inline
entrada: saida/entrada.md
saida: saida/material.md
---

# Passo 2: Preparar material (script, sem estação)

Este passo **não tem estação nem subagente**. Quem trabalha é o script `08-FERRAMENTAS/tesseract/preparar-material.js`,
que encadeia silencedetect, `pre-edicao.js`, whisper local, `palavras.js`, a máscara da pessoa e grava o relatório de uma
página `material.md`. O script faz sem raciocinar o que antes custava a maior parte do tempo e dos tokens da linha, e
**para quando precisa de uma decisão**.

## Exceção ao runner

- **Execução inline pelo próprio runner, sem trocar de papel e sem ler arquivo de estação.**
- O trabalho do passo é rodar o comando abaixo, responder às perguntas do script e apresentar o relatório.
- A validação de entrada (`entrada.md`) e a de saída (`material.md` com `test -s`) valem normalmente. Passe ao script o
  caminho de saída em `--relatorio`.
- O comando roda com o prefixo `FABRICA_EMPRESA=<codigo do run>` (regra do runner).
- **Conferência também do projeto do vídeo:** antes de concluir este passo, além da pasta do run, a conferência entre
  empresas roda sobre `08-FERRAMENTAS/tesseract/projetos/<NN>` (o `NN` está no `material.md`), como manda o runner.

## Contexto a carregar

Os `saida/...` deste passo ficam na pasta de saídas da empresa do run (caminho `saidas` dos caminhos que o runner
passou; se faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`).

Apenas `saida/entrada.md` (arquivo, estado, camada, modelo, observações) e, se precisar interpretar uma pergunta do
script, `dados/briefing.md`. Nada da empresa inteira nem do README do Tesseract: o script já os encapsula.

## Instruções

1. Ler `entrada.md` e montar o comando, a partir de `08-FERRAMENTAS/tesseract/`:
   ```
   FABRICA_EMPRESA=<codigo do run> node preparar-material.js "<Arquivo>" --estado <cru|pre-editado> --relatorio "<saida/material.md>" [--mascara] [--reels NN]
   ```
   - `--mascara` quando o modelo escolhido tem elemento ou título atrás do corpo (leva ~2,5 min por 60 s a 360 px).
   - `--reels` só para forçar um número; sem ele o script usa o próximo livre.
   - `--transicao <nome>` se o responsável pediu transição diferente de `zoom`; `--sem-viradas` se o plano não terá viradas.
2. Rodar em segundo plano (2 a 10 minutos: duas passagens do whisper e a máscara) e esperar a notificação. Nada pesado em paralelo.
3. **Código de saída 3 = o script parou e fez uma pergunta.** Ele imprime `PERGUNTA n [id]` com opções e, para cada uma,
   as flags `--decisao` prontas. Transformar cada pergunta em pergunta estruturada ao responsável e **nunca responder por
   conta própria**. Depois rodar o mesmo comando acrescentando as flags da opção escolhida (silêncios e transcrição ficam em cache).
   Perguntas possíveis: `inicio` (instrução falada, poses ou respiro no começo), `repetida-<t>` (duas tomadas parecidas),
   `sem-fala` (vídeo sem fala: parar ou continuar).
4. **Código 4** = re-transcrição negada (limite de 1 por vídeo). Cortar um clipe de ~2 s e pôr nas pendências.
5. **Código 0** = pronto. Ler `material.md` e apresentar no chat só o essencial: duração, pausas cortadas e viradas,
   número de palavras e frases, decisões tomadas, quadros de capa gerados e a seção "Dúvidas e pendências".
6. Dúvidas de palavra (um/num e similares) **não geram nova transcrição**: o responsável ouve o clipe de ~2 s listado.
   Uma única re-transcrição é permitida, só para termo técnico, data ou nome próprio: `--retranscrever "termo1,termo2"`.
7. Sincronia fora de 150 ms ou duração acima de 90 s: pendência do responsável antes de seguir.

## Formato do `material.md` (gerado pelo script)

```
# Material preparado
(Reels, vídeo editado, estado original, versão do Tesseract, duração, pausas cortadas, palavras, máscara, re-transcrições)
## Início, poses e tomadas
## Viradas            (virada, preparado, editado, antes → depois; enquadramento para copiar)
## Frases             (índice | início | texto)
## Sincronia          (5 pontos: palavra do whisper × início real da fala)
## Capa               (quadros candidatos 1080x1920, prancha, máscara das poses)
## Dúvidas e pendências
## Clipes de conferência das emendas
```

## O que o script nunca faz

Adivinhar início da fala, tomada repetida ou poses; transcrever o bruto como base de tempo (o `palavras.json` final sai
do vídeo editado); alterar `pre-edicao.js`, `palavras.js`, `montar-video.js` ou `mixar-audio.js`; escolher o quadro da
capa; decidir boca fechada ou mão na frente do corpo (isso é do olho do responsável, na prancha).

Para mudar as viradas propostas: `--viradas t1,t2` (tempos do vídeo preparado; a máscara antiga é invalidada porque o
zoom faz parte dos quadros). `--refazer` refaz a análise do zero.

## Vetos

Refazer se: houver decisão em `preparar-estado.json` que o responsável não tomou; `palavras.json` vier do bruto; o
relatório não trouxer duração, versão do Tesseract, viradas (em vídeo cru) e, com `--mascara`, quadros da máscara iguais
aos do vídeo; algum script do modelo base tiver sido alterado; houver mais de 1 re-transcrição.
