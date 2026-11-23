# Receita pronta: Planejar o mês

Para quem não sabe o que postar. A pessoa diz o que quer que os posts façam pelo negócio, quantos consegue publicar por
semana, quais formatos e para quando, e a receita propõe os posts do período, cada um com data, formato (vídeo,
carrossel ou post), roteiro e legenda. Depois da aprovação, tudo vai para o calendário.

A receita vem pronta com a Fábrica e serve a qualquer empresa: os temas saem do perfil da empresa ativa.

Para usar, basta pedir o plano do mês (ou rodar `/fabrica rodar planejar-o-mes`).

## Os passos

| # | Passo | Quem faz | Saída |
|---|---|---|---|
| 1 | O objetivo do mês: para quê, quantos por semana, formatos e período | responsável (checkpoint) | `saida/objetivo.md` |
| 2 | A proposta de posts, conferida antes de mostrar | Estação de Planejamento (inline) | `saida/plano.json` e `saida/plano.md` |
| 3 | Aprovar o plano | responsável (checkpoint) | `saida/plano-aprovado.md` |
| 4 | Pôr no calendário | script (`plano-do-mes.js registrar`) | `saida/registro.md` |

## Depois do plano

- Os posts entram no calendário **sem arte**, com o roteiro e a legenda.
- **Carrossel e post:** a receita `carrossel-e-post` oferece os posts planejados ainda sem arte, começa pelo roteiro que
  está no calendário e põe a arte no mesmo cartão, na data do plano.
- **Vídeo:** a pessoa grava seguindo o roteiro e manda para a Fábrica editar (receita `reels`). O vídeo editado vai
  para o Laboratório; ele ainda não se liga sozinho ao cartão do plano.

## Garantias

- O plano é conferido inteiro antes de gravar: com qualquer problema (data errada, formato fora da lista, post sem
  roteiro ou legenda), nada é gravado.
- Cada post do plano tem um código próprio (`plano-<run_id>-<nn>`), e um código que já está no calendário nunca é
  regravado: rodar o plano de novo nunca apaga o que já foi feito.

## O que a receita não cobre

- Fazer a arte dos posts (é a receita `carrossel-e-post`) e editar os vídeos (a `reels`).
- Publicar.
- Stories, anúncio, vídeo longo e artigo.
