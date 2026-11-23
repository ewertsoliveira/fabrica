---
tipo: checkpoint
saida: saida/plano-aprovado.md
---

# Passo 3: Aprovar o plano

## Fala de abertura

Diga nas suas palavras, sem nome interno (L-01): "Aqui está a proposta do seu mês, semana por semana. Cada post já tem
o roteiro (o que dizer ou o que vai em cada imagem) e a legenda (o texto que acompanha o post). Depois que você aprovar,
eu ponho tudo no seu calendário; nada é publicado."

## O que apresentar

1. O resumo do `saida/plano.md`, semana por semana: uma linha por post, com a data, o formato e o tema, e o para quê
   em poucas palavras.
2. Uma frase explicando que o roteiro e a legenda de cada post vão junto para o calendário, e que os vídeos a pessoa
   grava seguindo o roteiro.
3. Os colchetes que ficaram abertos (preço, prazo, número que a empresa ainda precisa informar), se houver.
4. Em uma frase, o tom em que os roteiros e as legendas foram escritos e de onde ele veio ("escrevi num tom acolhedor
   e direto, como no seu perfil"); outro tom é um pedido de "Mudar alguma coisa".

## Perguntar (`AskUserQuestion`)

"O plano está aprovado?" (explique: aprovando, os posts vão para o calendário, sem arte; cada um vira peça depois,
quando você pedir)
- **Aprovar e pôr no calendário** (recomendada): segue para o registro.
- **Mudar alguma coisa**: a pessoa diz o que mudar (ex.: "troque o vídeo do dia 26 por um carrossel"); volta ao passo
  `proposta` com o pedido dela.
- **Ver os roteiros inteiros antes**: mostre na conversa o roteiro e a legenda de cada post, semana por semana, e
  pergunte de novo.

## Formato da resposta a salvar (`saida/plano-aprovado.md`)

```markdown
# Plano aprovado

- aprovado_em: <AAAA-MM-DD HH:MM>
- decisao: aprovar
- posts: <N>
- pedidos_de_mudanca: <o que a pessoa pediu antes de aprovar, ou "nenhum">
```

## Ao terminar (L-05)

"Plano aprovado. Agora eu ponho os posts no seu calendário e abro a tela para você ver."
