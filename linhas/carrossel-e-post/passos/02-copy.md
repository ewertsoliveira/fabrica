---
execucao: subagente
estacao: copy-de-feed
formato: instagram-feed
entrada: saida/pedido.md
saida: saida/copy.md
modelo: forte
---

# Passo 2: Texto das imagens e legenda

## Contexto a carregar

- `saida/pedido.md`: origem, tipo de peça, tema, objetivo, formato, estilo e, num post planejado, o
  `roteiro_planejado` e a `legenda_planejada` literais
- `05-ESTRATEGIA/nucleo-de-conteudo/agentes/copywriter-de-feed.agent.md`: o papel (o runner carrega junto)
- `04-LABORATORIO-DE-DESIGN/estilos/<estilo>/estilo.yaml` (ou o estilo próprio da empresa): o número de imagens
  (`laminas.min` a `max`) e as regras do kit (`kit.regras`, como o tamanho do título da capa)
- `04-LABORATORIO-DE-DESIGN/estilos/LEIA-ME.md`: a tabela de formas e layouts
- o caminho `perfil` da empresa ativa (público, produtos, jeito de falar) e o caminho `decisoes` (regras de público,
  chamada, promessa e linguagem; a decisão de tom)
- `dados/framework-do-dominio.md`, `dados/criterios-de-qualidade.md`, `dados/anti-padroes.md` e
  `dados/exemplos-de-saida.md`
- `dados/tom-de-voz.md`: só quando `decisoes` não traz o tom

## Instruções

1. **De onde vem o texto.**
   - Ideia nova: escreva a partir do `tema`, do `objetivo` e do `perfil` da empresa.
   - Post planejado (`origem: planejado`): parta do `roteiro_planejado` e da `legenda_planejada`. Mantenha a ideia e as
     frases principais, adapte ao tamanho das imagens (divida, encurte o que não cabe, tire marcação de cena) e nunca
     troque o assunto nem invente número que o roteiro não traz.
2. **Tom:** o de `decisoes`. Sem decisão de tom, escolha em `dados/tom-de-voz.md` o que combina com o perfil e escreva
   qual foi no topo (`tom:`), para a pessoa poder pedir outro na aprovação.
3. **Carrossel:** a capa com uma promessa concreta, o miolo com uma ideia por imagem, na ordem do `formato`, e o fecho
   com a chamada. O número de imagens fica entre `laminas.min` e `max` do estilo (em geral 7). Cada imagem recebe a
   `forma` (`texto-com-visual`, `lista`, `formula`, `passos`, `citacao`, `grade` ou `fecho`); no miolo, no máximo
   **uma** só de lista, fórmula, passos, grade ou citação (DG-09), e as outras são `texto-com-visual`.
4. **Post** (`tipo_peca: post`): uma imagem só, papel `capa`, forma `texto-com-visual`, com o gancho no título, a
   mensagem inteira no subtítulo e a chamada (C-18: a chamada fica na imagem e na legenda). O título do post é curto,
   até uns 30 caracteres: ele divide a imagem com a mensagem e o visual.
5. Conte os caracteres de cada linha (C-25) e do corpo (80 a 130, no máximo duas frases, C-22). Se não couber, encurte
   na ideia nova; num post planejado, marque a imagem `NÃO CABE` com a divisão sugerida e não corte a frase do roteiro.
   Siga as regras do kit do estilo: num estilo de letras monumentais, o título da capa tem poucas palavras e nenhuma
   palavra muito longa, porque a letra não encolhe.
6. Preencha o `visual` de **toda** imagem com `tipo` e `descricao` ligada ao texto dela. Sem fotos no pedido, use
   `mockup` (tela, lista, documento, etiqueta) ou `objeto-do-estilo`; a `descricao` diz a foto da empresa que
   melhoraria a imagem. A imagem só tipográfica (a única do miolo) leva `visual: nenhum` com o motivo.
7. Escreva a legenda (C-30): abre com o gancho, desenvolve em duas ou três frases e fecha com **uma** chamada, a mesma
   da imagem de fecho. Num post planejado, parta da `legenda_planejada` e marque `LEGENDA AJUSTADA` se mudou algo.
8. Liste os avisos: imagens `NÃO CABE`, `LEGENDA AJUSTADA` e qualquer dado que a empresa ainda precisa informar, entre
   colchetes (nunca invente preço, prazo ou número).

## Formato

```markdown
# Texto: <tema>

- tipo_peca: carrossel | post
- formato: <o do pedido>
- tom: <o tom usado e de onde veio: decisoes ou tom-de-voz>
- chamada: <verbo e intenção da chamada>
- imagens: <N>

## Imagem 01 · capa
- forma: texto-com-visual
- kicker: <texto> (<n> car.)
- titulo: <texto com o *destaque*> (<n> car.)
- subtitulo: <texto> (<n> car.)
- visual:
    tipo: mockup | foto | ilustracao | objeto-do-estilo
    descricao: "<a imagem que ajudaria, ligada ao texto, em uma frase>"

## Imagem NN · miolo | fecho
- forma: <forma>
- titulo / corpo / itens / botao (só no fecho)
- visual: ...

## Legenda
<texto> (<n> car.)

## Avisos
- <NÃO CABE, LEGENDA AJUSTADA, colchetes abertos; ou "nenhum">
```

## Exemplo

```markdown
# Texto: Como reconhecer um pão de fermentação natural

- tipo_peca: carrossel
- formato: lista
- tom: educativo (tom-de-voz: o perfil não traz decisão de tom)
- chamada: visitar a loja para provar
- imagens: 7

## Imagem 01 · capa
- forma: texto-com-visual
- kicker: PÃO DE VERDADE (14 car.)
- titulo: 5 sinais de um pão de *fermentação natural* (41 car.)
- subtitulo: Aprenda a reconhecer antes de comprar (37 car.)
- visual:
    tipo: objeto-do-estilo
    descricao: "pão de casca dourada cortado ao meio, com o miolo aberto"

## Imagem 02 · miolo
- forma: texto-com-visual
- titulo: A casca *canta* (13 car.)
- corpo: Ao sair do forno, a casca estala baixinho. É o ar quente escapando da crosta grossa e bem assada. (97 car.)
- visual:
    tipo: foto
    descricao: "pão inteiro de casca rachada, ainda soltando vapor na bancada"

## Imagem 03 · miolo
- forma: texto-com-visual
- titulo: O miolo tem *furos irregulares* (29 car.)
- corpo: Furos de tamanhos diferentes mostram que a massa fermentou devagar, por muitas horas, sem fermento químico. (107 car.)
- visual:
    tipo: objeto-do-estilo
    descricao: "fatia com o miolo à mostra e furos de vários tamanhos"

## Imagem 04 · miolo
- forma: lista
- titulo: O que muda no *sabor* (19 car.)
- itens: Acidez leve: um azedinho suave no fundo / Aroma: cheiro de grão tostado / Textura: miolo úmido e elástico
- visual: nenhum (a única imagem só tipográfica do miolo, DG-09)

## Imagem 05 · miolo
- forma: texto-com-visual
- titulo: Dura mais na *bancada* (20 car.)
- corpo: A acidez natural protege o pão: ele continua macio por até três dias, guardado num saco de pano. (96 car.)
- visual:
    tipo: objeto-do-estilo
    descricao: "saco de pano com um pão dentro, sobre a bancada"

## Imagem 06 · miolo
- forma: texto-com-visual
- titulo: A lista de ingredientes é *curta* (31 car.)
- corpo: Farinha, água, sal e o fermento natural. Se o rótulo traz mais que isso, vale desconfiar. (89 car.)
- visual:
    tipo: mockup
    descricao: "etiqueta de pão com só quatro ingredientes listados"

## Imagem 07 · fecho
- forma: fecho
- titulo: Prove a *diferença* (17 car.)
- subtitulo: Fornada nova toda manhã (23 car.)
- botao: Quero provar
- visual:
    tipo: objeto-do-estilo
    descricao: "cesta com pães recém-saídos do forno"

## Legenda
Você sabe reconhecer um pão de fermentação natural? A casca, o miolo e até o rótulo contam a história. Passe aqui para provar a fornada da manhã. (145 car.)

## Avisos
- Imagem 02: uma foto do pão da casa, saindo do forno, deixaria a imagem mais forte.
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Falta o campo `visual` com `descricao` em alguma imagem (fora a única só tipográfica, com o motivo).
2. Imagem sem a `forma`, ou mais de uma imagem de miolo só tipográfica.
3. Post planejado com o assunto trocado, frase principal perdida ou número inventado.
4. Mais de uma chamada, ou chamada da legenda diferente da imagem de fecho.
5. Corpo fora de 80 a 130 caracteres sem estar marcado `NÃO CABE`.
6. Post (`tipo_peca: post`) com mais de uma imagem.

## Critérios de qualidade

- [ ] A contagem de caracteres está em toda linha de texto.
- [ ] O número de imagens está entre `laminas.min` e `max` do estilo (carrossel) ou é 1 (post).
- [ ] A capa promete algo concreto, sem título genérico.
- [ ] O tom está escrito no topo, com a origem.
- [ ] Os avisos listam o que a empresa ainda precisa informar.
