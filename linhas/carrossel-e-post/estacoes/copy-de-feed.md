# Estação: Copy de Feed

**Papel do Núcleo:** `05-ESTRATEGIA/nucleo-de-conteudo/agentes/copywriter-de-feed.agent.md`
**Papel:** Escreve o texto de cada imagem do carrossel (capa, miolo e fecho) ou da imagem única do post, dá a forma e o
visual de cada uma e monta a legenda. O texto nasce do tema do pedido ou, quando a peça vem de um post planejado, do
roteiro e da legenda que já estão no calendário.
**Entradas:** `saida/pedido.md`, o estilo do pedido, o perfil e o contrato de marca da empresa ativa.
**Saída:** `saida/copy.md`, imagem por imagem, com a contagem de caracteres, a `forma`, o campo `visual` e a legenda.

## Particularidades desta linha

- **Post planejado** (`origem: planejado`): o ponto de partida é o `roteiro_planejado` e a `legenda_planejada` do
  pedido. Mantém a ideia e as frases principais, adapta ao tamanho das imagens e nunca troca o assunto.
- **Post** (`tipo_peca: post`): uma imagem só, com o gancho, a mensagem inteira e a chamada; a chamada fica nela e na
  legenda (C-18).
- **Tom:** o de `decisoes.md` da empresa. Sem decisão de tom, use o de `dados/tom-de-voz.md` que combina com o perfil e
  diga qual foi no topo da copy: a pessoa vê e pode pedir outro na aprovação do texto.
