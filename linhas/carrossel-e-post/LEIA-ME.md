# Receita pronta: Carrossel e post

Peças de feed do Instagram com cara de agência, para quem não entende de design:

- **Carrossel:** uma sequência de imagens que a pessoa passa para o lado, como páginas, boa para explicar algo em partes.
- **Post:** uma imagem só, boa quando a ideia cabe numa frase.

A receita vem pronta com a Fábrica, como a de Reels, e serve a qualquer empresa: o texto nasce do pedido ou de um post
já planejado no calendário, e a aparência vem da identidade visual e do estilo da empresa ativa. Sempre sai com a
legenda e entra no Laboratório de Design e no calendário.

Para usar, basta pedir um carrossel ou um post (ou rodar `/fabrica rodar carrossel-e-post`).

## Os passos

| # | Passo | Quem faz | Saída |
|---|---|---|---|
| 1 | Pedido: post do calendário ou ideia nova, carrossel ou post, jeito de contar, identidade, estilo, fotos | responsável (checkpoint) | `saida/pedido.md` |
| 2 | Texto das imagens e legenda | Estação de Copy de Feed (subagente) | `saida/copy.md` |
| 3 | Aprovar o texto | responsável (checkpoint) | `saida/copy-aprovada.md` |
| 4 | Montar a primeira imagem | Estação de Design Visual (inline) | `saida/conteudo.json` |
| 5 | Aprovar a primeira imagem | responsável (checkpoint) | `saida/primeira-aprovada.md` |
| 6 | Montar o resto e conferir | script (`gerar.js --resto`) | `saida/conferencia.txt` |
| 7 | Revisão de qualidade | Estação de Revisão de Qualidade (inline) | `saida/revisao.md` |
| 8 | Aprovar a prévia | responsável (checkpoint) | `saida/preview-aprovado.md` |
| 9 | Entregar o aprovado | script (`gerar.js --entregar`) | `saida/entrega.md` |
| 10 | Pôr no Laboratório e no calendário | script (`registrar.js`) | `saida/registro.md` |

As peças ficam em `<saidas>/<run_id>/pecas/`; a entrega, em `pecas/entrega/`.

## Variações

- **Carrossel:** de 5 a 10 imagens (o número do estilo); o jeito de contar (editorial, lista, tutorial, mito e realidade,
  antes e depois, história, problema e solução) é escolhido a cada peça.
- **Post:** uma imagem só, no tamanho do feed, com o gancho, a mensagem e a chamada.
- **A partir de um post planejado:** quando o calendário tem posts de carrossel ou de post ainda sem arte (por exemplo,
  os da receita "Planejar o mês"), o pedido oferece começar por eles. O texto parte do roteiro e da legenda do plano, e
  a peça entra no mesmo cartão do calendário, na data do plano.

## Estilo

Vale o estilo escolhido pela empresa, nas cores da marca. Sem estilo escolhido, o padrão é o `revista-dominical`
(`carrossel.estilo`): sóbrio, com muito respiro, feito para funcionar sem foto, nas cores da marca
(`carrossel.cores: marca`). A pessoa pode trocar no pedido, olhando os estilos na tela Estilos do painel.

## O que a empresa precisa ter

- **Identidade visual** (o contrato de marca, caminho `marca`) para usar as cores e letras dela. Sem ela, o pedido
  oferece criar a identidade (uns 5 minutos) ou usar um estilo pronto com as cores originais.
- **Fotos** em `<pastaMarca>/fotos/` (opcional): sem fotos, as imagens usam mockups, números e objetos do estilo, e a
  Fábrica avisa qual foto melhoraria cada uma.
- **Regras de conteúdo** no caminho `decisoes` (público, chamada, promessa, linguagem, tom), se houver: o texto e a
  revisão as seguem.

## O que a receita não cobre

- Publicar a peça (ela entrega as imagens e a legenda prontas para postar).
- Stories, anúncio, capa de Reels e vídeo (o vídeo é da receita `reels`).
- Investigar perfis de referência.
