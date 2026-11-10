# 04 — Diagramação e Tipografia

Regras de composição de peças de imagem (carrossel, post, fixados, capas). Valem para qualquer paleta e qualquer
família tipográfica: os **valores** vêm do `marca.yaml`. Os códigos usam o prefixo **DG** para não colidir com a
decisão visual (D-01 e D-02, em `12-decisao-visual.md`).

---

## Papéis tipográficos

O Núcleo trabalha com papéis, não com nomes de fonte:

| Papel | Uso | Onde o arquivo é definido |
|---|---|---|
| **fonte principal** | Títulos, headline, palavra de impacto, corpo | `tipografia.principal` |
| **fonte mono** | Kicker, numeral, rótulo, contador, metadado | `tipografia.mono` |
| **fonte de acento** | Remate elegante, destaque manuscrito ou serifado | `tipografia.acento` (opcional) |

**Sistema de três vozes:** uma peça de alto impacto combina as três: rótulo em mono com espaçamento largo entre
letras, palavra de impacto na fonte principal em peso máximo, e remate na fonte de acento. Empilhar um único peso de
uma única família lê como genérico.

> A fonte de acento só existe se o `marca.yaml` a declarar. Nem toda marca aceita misturar uma serifada ou manuscrita
> com a sua fonte principal: é decisão da marca, não padrão do Núcleo. Sem ela, a peça trabalha com duas vozes e o
> contraste vem de peso e de cor.

---

## Escala e pisos

## DG-01 — Duas escalas, dois pisos
Texto numa peça pertence a uma de duas escalas, e **cada uma tem seu próprio piso**:

| Escala | O que é | Piso |
|---|---|---|
| **Conteúdo** | Título, corpo, kicker, chamada: o texto que a peça comunica | `canvas.pisos` |
| **Interface** | Texto *dentro* de mockup, painel, notificação, cartão de interface | `canvas.pisos-ui` |

Confundir as duas é o erro mais comum: aplicar o piso de conteúdo dentro de um mockup faz a interface parecer gigante
e falsa; aplicar o piso de interface no corpo deixa o texto ilegível no feed. Nenhum texto renderiza abaixo do piso
da **sua** escala.

## DG-02 — Nunca reduza a fonte para fazer caber
Diante de texto que não cabe, a ordem de solução é:
1. Consumir todo o respiro vertical livre nas margens (topo e base).
2. Reescrever mais curto, mostrando a proposta antes de aplicar.
3. Dividir em mais peças **com autorização** (C-21).
4. **Parar e escalar** ao responsável.

Reduzir o tamanho da fonte não está na lista. Nunca é a saída.

## DG-03 — A escala da marca não muda peça a peça
Os pisos e tamanhos declarados no `marca.yaml` não são ajustados peça a peça. A escala é do sistema, não da peça.

## DG-04 — Destaque sem salto de tamanho, uniforme na frase
Dentro de uma mesma frase de headline, toda palavra usa o mesmo tamanho e peso. **Toda headline destaca a palavra mais
importante ou a ação**, pelo tratamento que o estilo declara (`tratamentos.destaque` no `estilo.yaml`: cor de acento,
itálico, ou os dois). A ênfase nunca vem de salto de tamanho nem de mudança de peso: nenhuma palavra "explodida" maior
que o resto.

**Exceção declarada:** o estilo cuja assinatura é o contraste de letra (fino com destaque em itálico pesado, condensada
com destaque em serifada, destaque em letra manuscrita) declara `fonte` ou `peso` em `tratamentos.destaque` (por exemplo
`cor+fonte`). Aí o destaque pode trocar de família e de peso. O tamanho continua o mesmo da frase, inclusive na capa.

## DG-05 — Título de capa é elemento gráfico
O título da capa ocupa 100% da largura útil do canvas. É um elemento massivo de abertura, não se restringe a metade
da tela.

## DG-06 — Alinhamento declarado pelo estilo
Texto de apoio, assinatura, conta e kicker seguem **um** alinhamento, declarado no estilo (`alinhamento` no
`estilo.yaml`: esquerda ou centro). O padrão é a margem esquerda do grid. Exceção declarada: o botão de chamada (DG-11).
Misturar alinhamentos na mesma peça, sem o estilo prever, é erro.

## DG-07 — Kicker no topo, com folga para subir
O kicker tem posição fixa no topo. Se o texto principal crescer e ameaçar colidir, o kicker **pode e deve** subir em
direção à borda, reduzindo a margem superior. Ele nunca limita artificialmente o texto.

## DG-08 — Área segura
O canvas respeita `canvas.area-segura` (topo reservado à interface do aplicativo, base reservada às interações da
plataforma). Conteúdo vital fica fora dessas faixas.

## DG-21 — Sem palavra viúva
Quando uma linha tem poucas palavras e sobra espaço, a palavra isolada fica na **última** linha, nunca solta no meio
da frase.

---

## Âncora visual e variedade

## DG-09 — Âncora visual própria por peça
Cada peça, e cada slide de uma sequência, carrega uma âncora gráfica ligada à ideia daquele slide: **mockup, foto,
ilustração ou objeto desenhado**. Número grande, diagrama de texto, corte e textura só **complementam** a âncora; não a
substituem. Nunca só bloco de texto, mesmo respeitando os pisos (ver I-01 e I-15).

**Slide só tipográfico** (lista numerada, fórmula, fluxo de passos, grade ou citação, que trazem o próprio diagrama e
não têm lugar para mockup nem foto): o miolo admite **no máximo um por carrossel**, porque o ritmo pede um respiro. Do
segundo em diante, a ideia do slide ganha mockup, foto ou objeto desenhado. Capa e fecho têm âncora própria e ficam fora
dessa conta.

## DG-10 — Variedade entre peças, conforme o molde do estilo
O estilo declara o miolo (`miolo` no `estilo.yaml`):
- **rodízio:** composição, densidade, cor e dispositivo gráfico mudam de slide para slide, mantendo o mesmo sistema
  (tipografia, paleta, textura). Nunca repetir o layout anterior "por segurança".
- **fixo:** a capa tem layout próprio e, da segunda lâmina em diante, o layout não muda. A variedade vem do **elemento
  visual**, que muda a cada lâmina e é sempre ligado ao texto dela (DG-09). Repetir o mesmo elemento visual em slides
  seguidos é erro nos dois casos.

## DG-17 — Diagramação dinâmica
Não engessar no padrão "texto à esquerda, imagem à direita". Variar o eixo (coluna, linha, invertido, texto em cima e
visual embaixo, e o contrário) conforme o que serve melhor àquele slide.

## DG-19 — Teste de reconhecimento a 100 px
Reduzida a 100 px de largura, a peça ainda é reconhecível como daquela marca. Se não for, o sistema visual está fraco.

---

## Sistema de fundo

## DG-13 — Fundo nunca é chapado
Todo fundo carrega tom (gradiente ou vinheta discreta) e grão (retícula finíssima). O grão **desaparece ao ler o
texto**: nunca compete com a legibilidade.

## DG-14 — Grafismo de fundo é cortado pela borda
O elemento gráfico de fundo da marca fica sempre cortado por alguma borda, com parte relevante da forma fora da peça.
**Nunca centralizado atrás do texto.**

## DG-15 — Sequência de fundos declarada pelo estilo
O estilo declara a sequência de fundos (`fundos` no `estilo.yaml`). Se declarar alternância (por exemplo, escuro,
claro, acento), ela é obrigatória ao longo da sequência. Um fundo único só vale quando o estilo o declara e a variação
vem da foto e do elemento visual; sem essa declaração, um conjunto inteiro no mesmo fundo é rejeição.

## DG-16 — Economia de logo
A logo aparece **apenas** nos pontos de `pecas.logo-aparece-em` (padrão de primeiro uso: capa e fechamento). Nas
demais peças, o reconhecimento vem do fundo e da tipografia. Quando aparece, a logo vem **completa**, nunca
simplificada.

> **Atenção ao montar modelos:** é a regra mais fácil de violar, porque é mais simples pôr a logo no modelo-base e
> deixá-la em todos os slides. Confira a logo **no corpo do HTML de cada slide**, não na folha de estilo.

---

## Capa, kicker e fechamento

## DG-23 — Nada cobre o texto
Nenhum texto fica coberto, nem em parte, por outro elemento da peça: mockup, cartão, pílula, foto ou objeto. Elementos
que se sobrepõem de propósito (a pílula sobre a borda de um cartão, o adesivo sobre a folha) não podem esconder
nenhuma palavra do outro. Se o espaço não basta, o visual encolhe ou muda; o texto nunca é o que perde.

**Teste que reprova (G-13):** num ponto de cada texto, o elemento mais acima precisa ser o próprio texto ou algo que o
contém. Caso feito para falhar: uma pílula posta sobre a última linha de um mockup.

## DG-22 — Kicker traz camada nova
O kicker (rótulo acima do título) não repete palavras nem a ideia da headline. Traz uma camada nova: o tema, o tipo
de conteúdo ou a posição na sequência.

## DG-11 — Botão de chamada quebra a rigidez
O botão de chamada fica fisicamente centralizado no seu cartão, pintado na **cor de acento** (o maior contraste da
tela), com leitura máxima da tipografia interna.

## DG-12 — Hierarquia do argumento no fechamento
A instrução de agir fica **somente** no botão. O subtítulo acima dele carrega apenas o último argumento, em no máximo
duas linhas. O respiro entre subtítulo e botão é o maior da tela: até 2 vezes o espaçamento anterior, nunca mais.

---

## Processo

## DG-18 — Verificar a primeira peça antes do lote
A primeira peça de qualquer lote é renderizada e verificada **antes** do restante. Erro de tipografia ou contraste
detectado cedo evita retrabalho em cascata.

## DG-20 — Design system documentado antes do primeiro slide
Antes de qualquer HTML individual, documenta-se o design system da peça: paleta por papel, tipografia, grid, pisos e
sistema de fundo, com valores exatos, nunca "aproximadamente".

---

## Como se confere

| Regra | Quem confere |
|---|---|
| DG-01 (texto abaixo do piso da escala), DG-04 (tamanho ou peso variando na mesma frase), DG-08 (texto na área segura), DG-09 (slide sem elemento visual, ou mais de um slide só tipográfico no miolo), DG-10 (mesmo layout em slides seguidos no rodízio, ou mesmo elemento visual em slides seguidos), DG-15 (fundos fora da sequência declarada pelo estilo), DG-16 (logo fora dos pontos declarados), DG-23 (texto coberto por outro elemento) | Conferidor automático do carrossel |
| DG-19 | Conferidor gera a miniatura de 100 px; o revisor julga |
| DG-02, DG-03, DG-05 a DG-07, DG-11 a DG-14, DG-17, DG-18, DG-20 a DG-22 | Revisor de qualidade e checklist do designer |
