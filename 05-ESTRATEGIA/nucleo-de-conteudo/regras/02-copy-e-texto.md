# 02 — Copy e Texto

Regras de escrita válidas para qualquer empresa. As **listas literais** (vocabulário preferido e vetado, chamada por
rede, uso de exclamação e emoji) ficam no `marca.yaml`; aqui está o mecanismo que as aplica. A numeração segue a do
Núcleo de origem: estão aqui as regras de copy de feed e de legenda; as de vídeo e de stories ainda não foram
exportadas.

---

## Afirmação e vocabulário

## C-01 — Copy afirmativa
A copy diz **o que a marca é e o que faz**, nunca se define por oposição ("não somos X", "não é só Y", "o problema não
é A, é B") como espinha dorsal do texto. Contraste leve e pontual é tolerado; negação como motor da frase, não.

## C-02 — Vocabulário vetado é rejeição automática
Toda peça é verificada contra `vocabulario.vetado` do `marca.yaml`. Ocorrência de qualquer termo da lista é
**rejeição automática**, independente da nota geral da peça. A lista costuma cobrir termos de hype, jargão
corporativo vazio e vocabulário de concorrente que a marca não quer imitar.

## C-03 — Vocabulário preferido presente
Os termos de `vocabulario.preferido` aparecem onde for natural: nunca forçados, nunca ausentes por completo.

## C-04 — Aterrissar em concreto
Toda frase junta **entrega e benefício** e aterrissa em algo concreto. Jargão de marketing solto, sem aterrissagem, é
reescrito.

## C-05 — Nenhum absoluto sem fonte
Afirmação de comportamento de mercado ("a maioria dos X...", "ninguém contrata por Y") exige fonte. Sem fonte:
suavizar ou remover. **Nunca inventar comportamento de mercado não verificado.**

## C-07 — Métrica de vaidade não é prova
Métrica de plataforma (seguidor, curtida, alcance, clique) nunca aparece como **prova de resultado** em peça pública.
No máximo como indicador intermediário.

## Pontuação e emoji

## C-09 — Exclamação conforme a marca
Com `copy.exclamacao: vetada` no `marca.yaml` (o padrão de primeiro uso), nenhuma peça usa ponto de exclamação: o tom
vem do ritmo e da clareza da frase, não da pontuação.

## C-10 — Travessão vetado em copy
Travessão não aparece em nenhuma copy publicada, em nenhum formato e em nenhuma empresa. Trocar por vírgula, ponto ou
dois-pontos. Vale para a copy da peça; documentação interna não é copy.

## C-11 — Emoji com critério
Emoji só nos formatos listados em `copy.emoji.formatos`, no máximo `copy.emoji.maximo` por peça, **nunca no corpo de
um slide** e nunca em registro profissional (artigo, post de rede profissional, blog).

## Estrutura e gancho

## C-13 — Estrutura narrativa padrão (educativo e consultivo)
`cenário concreto → nomear o problema → tese central → dica prática → chamada`. Nomear o problema é dar nome ao que o
leitor sente mas ainda não nomeou.

## C-14 — A primeira frase é o tema
A frase de abertura entrega o gancho, nunca o introduz. Se o leitor parar na primeira frase, já recebeu o gancho
inteiro. Contextualizar antes do gancho faz o leitor sair antes de entender do que se trata.

## C-15 — Gancho específico e nomeado
Quanto mais concreto e nomeado o gancho, mais ele gruda. Nomear a entidade, o prazo ou o número específico vence a
categoria genérica.

## C-16 — Gancho por subversão de expectativa
Estrutura reaproveitável: `[descrição física ou emocional universal] → [expectativa que isso cria] → [virada para a dor
real do público]`.

## C-29 — Termo só depois de apresentado
Nenhum termo, conceito ou expressão própria aparece sem ter sido introduzido e explicado antes, na mesma peça ou numa
peça anterior da mesma sequência. O leitor nunca é surpreendido por algo que a narrativa ainda não construiu.

## C-31 — Continuidade narrativa entre slides
Os slides de uma sequência formam um raciocínio: se um slide apresenta um sintoma ou problema, o seguinte explica o
porquê ou o que fazer. Slide solto, que poderia trocar de lugar sem perder sentido, é falha.

## C-32 — Item de lista com título e explicação
Todo item de lista ("sinal", "motivo", "erro") tem um **título forte** seguido de uma explicação curta que o liga à dor
do leitor. Lista de tópicos sem explicação é reescrita.

## C-33 — Subtítulo da capa puxa o próximo slide
O subtítulo da capa é a expansão lógica do título e incita o slide seguinte. Nunca uma metadescrição ("o resumo da
semana", "neste carrossel").

## Slide e repasse ao design

## C-21 — Copy congelada no repasse
A copy aprovada é congelada no repasse para o design. Quem desenha **não** altera, corta nem divide a peça em mais
slides para fazê-la caber. Se não couber, para e devolve para reescrever o texto original.

## C-22 — Corpo cabe no slide
Em peça de slides, o corpo de cada slide tem **80 a 130 caracteres**, no máximo duas frases curtas. Nunca um parágrafo
de duas a quatro frases. Ideia que não cabe curta vira mais um slide, decidido na copy, nunca fonte menor.

## C-23 — Lista vira linha de etiquetas
Inventário ou lista de quatro ou cinco itens nunca vira prosa no corpo do slide. Vira linha de etiquetas curtas em
microtexto, separada do corpo principal.

## C-24 — Nuance vai para a legenda
Explicação longa, nuance e ressalva vão para a legenda, que não tem limite de espaço. O slide carrega só a ideia
central.

## C-25 — Contagem de caracteres no repasse
Toda entrega de copy para slide indica a contagem de caracteres por linha do canvas, para conferência sem recontagem.

## C-26 — Fechamento não repete a headline
A peça que fecha um ciclo não repete a frase de headline de outra peça do mesmo ciclo.

## Chamada

## C-18 — Uma chamada por peça
Cada peça tem **um** destino e **uma** ação. Nunca empilhar pedidos (curtir, seguir, comentar, link, salvar).

## C-19 — Chamada adequada à plataforma
A chamada aponta para a interação **realmente possível** naquele meio. Chamada de intenção web dentro de peça que não
clica é veto ("clique no link" num carrossel). As chamadas padrão por rede ficam em `cta` no `marca.yaml`.

## C-20 — Chamada específica, nunca genérica
A chamada nomeia o papel ou a pessoa ("marca quem cuida disso aí") ou faz pergunta binária concreta ("você concorda?").
Chamada genérica ("marque um amigo", "comente sua opinião", "saiba mais") é dedução de qualidade.

## Legenda do post

## C-30 — Legenda do post entrega a substância
"Legenda do post" é o texto que acompanha a peça no feed; não é o texto na tela de um vídeo. A legenda vale por si:
quem lê só ela sai sabendo o ponto da peça.

1. **A primeira linha é a notícia ou a tese**, em frase completa e concreta, com até 125 caracteres (o que aparece
   antes do "mais"). Segue C-14 e C-15.
2. **O corpo entrega a substância:** o que é, o que muda, o que o leitor faz com isso. Um parágrafo por ideia. Não
   repete os slides linha a linha; o que os slides mostram, a legenda explica.
3. **A legenda não anuncia o conteúdo.** Vetado: "neste post", "confira", "veja", e a lista de temas em fragmento ("o
   que X, o que Y e o que Z"). Isso é sinopse, não explicação.
4. **Fontes: no máximo uma linha**, com a fonte principal. A lista completa vai para o comentário fixado.
5. **Uma chamada**, a mesma do último slide (C-18, C-20).
6. Copy afirmativa, sem travessão, exclamação conforme a marca (C-01, C-09, C-10).

**Teste que reprova (G-13):** cubra a arte e leia só a legenda. Se ela não ensina o ponto da peça, reprova. Caso
calibrado para falhar: "Três perguntas para você conferir no seu perfil: o que fazer, para quem e como contratar."
seguido de uma linha com cinco fontes. Reprova nos itens 2, 3 e 4.

---

## Como se confere

| Regra | Quem confere |
|---|---|
| C-02, C-09, C-10, C-11 (emoji no corpo), C-18 (mais de uma chamada), C-22 (faixa de caracteres) | Conferidor automático do carrossel |
| C-19 (frases de intenção web vetadas) | Conferidor automático, por lista de frases |
| C-01, C-04, C-05, C-07, C-13 a C-16, C-20, C-29 a C-33, C-21, C-23 a C-26, C-30 | Revisor de qualidade, com a frase exata e a reescrita |
