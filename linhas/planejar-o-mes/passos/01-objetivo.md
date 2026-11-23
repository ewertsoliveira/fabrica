---
tipo: checkpoint
saida: saida/objetivo.md
---

# Passo 1: O objetivo do mês

Checkpoint de entrada. A pessoa diz o que quer que os posts façam pelo negócio, quanto consegue publicar e quando. Toda
pergunta vai por `AskUserQuestion`, **uma por vez**, com no máximo 4 opções, e explica antes, em uma frase, por que é
feita e o que muda com a resposta (L-02). Nenhuma fala usa nome interno (L-03).

## Fala de abertura

Antes da primeira pergunta, diga nas suas palavras, sem nome interno (L-01):

> Vou montar com você o plano de posts do mês. São quatro perguntas rápidas; depois eu proponho os posts, cada um com
> data, formato, roteiro e legenda, e você aprova antes de qualquer coisa ir para o calendário. Nada é publicado: o
> calendário é só o seu plano, e cada post vira peça depois, quando você pedir.

## Antes de perguntar

1. Rode `node _fabrica/core/empresa.js caminhos <codigo do run> --linha planejar-o-mes --json` e guarde `perfil`,
   `decisoes` e `cronograma`.
2. Leia o perfil: o que a empresa vende, para quem e como fala. Perfil ausente ou ainda não preenchido: pergunte antes,
   em uma pergunta aberta, "Em uma frase: o que você vende e para quem?", e use a resposta neste plano.
3. Veja os posts que o calendário já tem (`posts.json` da pasta `cronograma`) no resto deste mês e no mês que vem.

## Perguntas

### 1. O que os posts devem fazer

"O que você quer que os posts deste mês façam pelo seu negócio?" (explique: a resposta muda a mistura de posts que
ensinam, que mostram os bastidores e que convidam para comprar)
- **Vender mais**: mais posts convidando para comprar, com o produto e o motivo para levar agora.
- **Atrair gente nova**: mais posts que ensinam algo útil, que as pessoas salvam e mandam para os amigos.
- **Ganhar confiança**: mais bastidores e explicações, para quem já segue conhecer quem está por trás.
- **Lançar algo**: posts que preparam o lançamento, mostram a novidade sendo feita e convidam perto da data (pergunte
  em seguida, aberta, o que é e quando sai).

### 2. Quantos por semana

"Quantos posts por semana você consegue publicar?" (explique: é melhor pouco e sempre do que muito e parar no meio; o
plano nunca passa disso)
- **2 por semana**: dá para manter mesmo com a rotina cheia.
- **3 por semana** (recomendada para quem está começando): o feed fica vivo sem pesar.
- **5 por semana**: para quem já tem o hábito e tempo de gravar e revisar.

### 3. Quais formatos (escolha múltipla)

"Quais formatos você quer no plano?" (explique: cada formato dá um trabalho diferente; escolha os que você consegue
fazer)
- **Vídeo**: você grava falando para a câmera, seguindo o roteiro, e a Fábrica edita com legenda e cortes.
- **Carrossel**: uma sequência de imagens que a pessoa passa para o lado; a Fábrica faz tudo a partir do roteiro.
- **Post**: uma imagem só; a Fábrica também faz tudo.

### 4. Para quando

"Para quando é o plano?" (explique: o plano começa na data escolhida e vai até o fim do mês)
- **O resto deste mês, a partir de hoje** (recomendada quando faltam 7 dias ou mais para o mês acabar).
- **O mês que vem** (recomendada quando faltam menos de 7 dias).

Se o calendário já tem posts no período escolhido, diga em uma frase: "Seu calendário já tem <N> posts nesse período;
o plano novo entra ao lado deles, sem apagar nada e sem repetir os temas."

## Formato da resposta a salvar (`saida/objetivo.md`)

```markdown
# Objetivo do mês

- objetivo: vender mais | atrair gente nova | ganhar confiança | lançar algo
- lancamento: <o que é e quando sai; só no "lançar algo">
- posts_por_semana: 2 | 3 | 5
- formatos: <vídeo, carrossel, post: os escolhidos>
- periodo: <AAAA-MM-DD> a <AAAA-MM-DD>
- empresa_em_uma_frase: <do perfil, ou a resposta da pessoa>
- posts_ja_no_calendario: <lista "data: título" do período, ou "nenhum">
```

## Ao terminar (L-05)

Diga em uma frase o que ficou decidido ("3 posts por semana até o fim do mês, para atrair gente nova, com vídeo,
carrossel e post") e que o próximo passo é a proposta de posts, que ela aprova antes de ir para o calendário.

## Vetos

Refazer se ALGUMA for verdadeira:
1. Pergunta sem o porquê, ou com termo sem explicação.
2. Período que não começa hoje nem no dia 1 do mês que vem, ou que passa do fim do mês.
3. Formatos não perguntados (o plano não pode supor que a pessoa grava vídeo).

## Critérios de qualidade

- [ ] Uma pergunta por vez, cada uma com o porquê e o que muda.
- [ ] O `objetivo.md` tem todos os campos, com as datas em AAAA-MM-DD.
- [ ] Os posts que já estão no calendário no período foram listados.
