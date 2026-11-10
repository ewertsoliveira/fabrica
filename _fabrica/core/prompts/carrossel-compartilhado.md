# Carrossel de feed: o que o Arquiteto precisa saber

Leia este arquivo **só** quando a Descoberta marcar `carrossel.habilitado: true`. Ele vale para a Descoberta, o Desenho e
a Construção. É a especificação única de uma linha que produz carrossel de feed com qualidade de agência. As regras da
peça moram no Núcleo (`05-ESTRATEGIA/nucleo-de-conteudo/regras/`); aqui está só **como a linha é montada**.

Nada aqui é de uma empresa: cores, fontes, conta e vocabulário vêm do contrato de marca da empresa ativa (o caminho
`marca` de `node _fabrica/core/empresa.js caminhos --json`; na pasta antiga, `06-MARCA-E-FOTOS/marca.yaml`); a aparência vem de um
**estilo** do catálogo (`04-LABORATORIO-DE-DESIGN/estilos/`). A linha só fala em papéis.

## 1. Os três papéis

Cada papel já está escrito no Núcleo (`05-ESTRATEGIA/nucleo-de-conteudo/agentes/`). A estação da linha **não os
reescreve**: aponta para o arquivo e o runner o carrega junto. Assim o papel nunca se desvia entre linhas.

| Estação (nome da função) | Papel do Núcleo | Execução |
|---|---|---|
| Estação de Copy de Feed | `copywriter-de-feed.agent.md` | subagente |
| Estação de Design Visual | `designer-visual.agent.md` | inline |
| Estação de Revisão de Qualidade | `revisor-de-qualidade.agent.md` | inline |

Formato do arquivo de cada uma, em `linhas/<codigo>/estacoes/<id>.md`:

```markdown
# Estação: {nome da função}

**Papel do Núcleo:** `05-ESTRATEGIA/nucleo-de-conteudo/agentes/{papel}.agent.md`
**Papel:** {uma ou duas frases do que faz nesta linha}
**Entradas:** {arquivos que recebe}
**Saída:** {o que entrega e onde}

## Particularidades desta linha
{só o que é desta linha: por exemplo, o estilo declarado em linha.yaml. Pode ficar vazio.}
```

Princípios, anti-padrões e checklist **não se repetem** na estação: valem os do arquivo do Núcleo. Em conflito entre a
estação e o Núcleo, vale o Núcleo.

## 2. O pipeline obrigatório

A linha tem estes nove passos, **com estes `id`**, nesta ordem. Pode haver passos a mais (por exemplo, uma pesquisa de
tema antes do `pedido`); nenhum destes pode faltar, mudar de tipo ou trocar de lugar. O Portão 2d da Construção reprova a
linha que fugir disto (`node _fabrica/core/validar-linha.js <codigo>`).

| # | `id` | Tipo | Quem | Entrada → Saída | O que acontece |
|---|---|---|---|---|---|
| 1 | `pedido` | checkpoint | responsável | → `saida/pedido.md` | Tema, objetivo, **formato do carrossel**, estilo e fotos (seção 3) |
| 2 | `copy` | estação | Copy de Feed (subagente), `formato: instagram-feed` | `pedido.md` → `saida/copy.md` | Copy de todas as lâminas, com `visual` por lâmina, e a legenda (seção 4) |
| 3 | `aprovar-copy` | checkpoint | responsável | `copy.md` → `saida/copy-aprovada.md` | Aprova a copy; depois disso ela fica **congelada** (C-21) |
| 4 | `design` | estação | Design Visual (inline) | `copy-aprovada.md` → `saida/conteudo.json` | Monta o `conteudo.json` e renderiza **só a primeira lâmina** (DG-18) |
| 5 | `aprovar-primeira` | checkpoint | responsável | `conteudo.json` → `saida/primeira-aprovada.md` | Olha `lamina-01.png` e aprova ou pede ajuste |
| 6 | `renderizar` | script | runner | `primeira-aprovada.md` → `saida/conferencia.txt` | `gerar.js --resto`: renderiza o resto, roda o conferidor e monta o preview; o runner grava o relatório |
| 7 | `revisao` | estação | Revisão de Qualidade (inline) | `conferencia.txt` → `saida/revisao.md` | Julga o que o conferidor não mede; aprova ou devolve a quem falhou |
| 8 | `aprovar-preview` | checkpoint | responsável | `revisao.md` → `saida/preview-aprovado.md` | Vê o preview no simulador de Instagram e aprova antes da entrega |
| 9 | `entregar` | script | runner | `preview-aprovado.md` → `saida/entrega.md` | `gerar.js --entregar`: copia só o que saiu aprovado; o runner grava a lista |

**Onde ficam os arquivos.** O runner insere o `run_id` e uma pasta de versão (`v1`, `v2`...) em todo caminho declarado em
`saida`. Por isso a `saida` declarada de cada passo é **um arquivo de controle** (`saida/conferencia.txt`,
`saida/entrega.md`), e as peças geradas ficam numa pasta própria, `<saidas>/<run_id>/pecas/` (o runner traduz `saida/`
para a pasta de saídas da empresa ativa), que o gerador administra sozinho
(ele recusa conteúdo alterado e recomeça a lâmina quando preciso). **Nenhuma `saida` declarada pode apontar para
`saida/pecas/`**: o runner validaria um caminho versionado que o gerador nunca grava. O `conteudo.json` e a copy são
saídas versionadas normais: a cada retorno ao passo, nasce uma versão nova e vale a mais recente.

Regras do pipeline, todas conferidas pelo portão:
- **Aprovação logo antes de agir:** o passo imediatamente anterior a `design`, a `renderizar` e a `entregar` é um
  checkpoint (`aprovar-copy`, `aprovar-primeira`, `aprovar-preview`). A peça só avança com o sim do responsável.
- `renderizar` e `revisao` têm `ao_reprovar`: o primeiro aponta para o passo `design`; o segundo, para `design` (ou
  `copy`, quando a falha é da copy).
- Linha de carrossel declara em `linha.yaml`, além do padrão:
  ```yaml
  formato: instagram-feed
  carrossel:
    estilo: {id do estilo escolhido no Desenho}
    cores: {original | marca}
  ```
  `original` mantém as cores e fontes aprovadas do estilo; `marca` aplica por cima as da marca da empresa ativa, sem mudar o desenho.
  A escolha vale para a linha inteira: os passos `design`, `renderizar` e `entregar` usam o mesmo `--cores` (o gerador
  recusa o lote se as cores mudaram depois da primeira lâmina).
- **O estilo da empresa vem primeiro.** Quando a empresa do run escolheu um estilo (no painel, em "Usar este estilo", ou
  pelo agente com `escolha.js`), o padrão do run é esse estilo com as cores da marca: `--estilo <id> --cores marca`.
  `node _fabrica/core/estilo-da-linha.js <codigo do run>` mostra qual é (só lê). A pessoa ainda pode pedir outro no passo
  `pedido`. Estilo próprio da empresa: o gerador o lê da pasta de estilos próprios **dela** (nunca da de outra empresa) e
  renderiza e confere com a rede fechada; o `linha.yaml` continua declarando um estilo do catálogo (o portão exige). Sem
  estilo escolhido, tudo como sempre: `carrossel.estilo` e `carrossel.cores` da linha.
- Nenhuma etapa depende de gerador de imagem por IA (I-16). Foto que falta vira mockup, número ou objeto do estilo, e o
  designer avisa qual foto da empresa melhoraria a lâmina.

## 3. O passo `pedido`

Checkpoint de primeira entrada. Por pergunta estruturada, no máximo 4 por chamada, cada opção com um exemplo:

1. **Tema e objetivo** (texto livre, com 2 ou 3 exemplos concretos tirados do perfil da empresa).
2. **Formato do carrossel, escolhido de forma explícita (F-22).** Nunca presumido. Ofereça os sete, cada um com um
   exemplo curto do que significa:
   - **editorial**: uma tese defendida em etapas ("Por que o preço baixo sai caro");
   - **lista**: itens paralelos ("5 sinais de que o caixa está apertado");
   - **tutorial**: passo a passo para fazer algo ("Como conferir a nota em 3 passos");
   - **mito e realidade**: crença comum contra o fato ("Mito: quem fatura bem não tem dívida");
   - **antes e depois**: situação contra resultado ("Mesmo negócio, antes e depois da organização");
   - **história**: caso contado do começo ao fim ("O dia em que o estoque zerou");
   - **problema e solução**: dor seguida do caminho ("Atrasou o repasse? Veja o que fazer").
3. **Estilo e cores:** com estilo escolhido pela empresa (`node _fabrica/core/estilo-da-linha.js <codigo do run>`), a
   primeira opção, recomendada, é esse estilo com as cores da marca ("o seu estilo, <nome>"); sem ele, os da linha
   (`carrossel.estilo` e `carrossel.cores`). Nos dois casos, com a opção de trocar neste pedido. Trocar
   mostra a prévia (D-01): `node 04-LABORATORIO-DE-DESIGN/estilos/previa.js` (cores originais) e, se o responsável quiser
   ver a adaptação, `previa.js --marca <id>` (teste de paleta), com o `catalogo.html` aberto no navegador dele. Deixe
   explícito que o estilo pode ser mantido como está ou adaptado à paleta da empresa.
4. **Fotos:** liste o que existe em `<pastaMarca>/fotos/` (o caminho `pastaMarca` da empresa ativa) e pergunte se alguma deve aparecer. Não há foto? Siga: o
   designer usa mockups, números e objetos do estilo.

Grave a resposta em `saida/pedido.md` com os campos `tema`, `objetivo`, `formato`, `estilo`, `cores`, `fotos` (lista de arquivos
ou "nenhuma").

## 4. O contrato da copy e o campo `visual`

A Estação de Copy de Feed entrega `saida/copy.md` com, **por lâmina**: o papel (capa, miolo ou fecho), a `forma` (abaixo), `kicker`, `titulo`,
`subtitulo` ou `corpo`, `botao` quando for o fecho, a contagem de caracteres de cada linha (C-25) e o campo `visual`:

```
visual:
  tipo: mockup | foto | ilustracao | objeto-do-estilo   # numero e diagrama só complementam (DG-09)
  descricao: "a imagem que ajudaria, ligada ao texto desta lâmina, em uma frase"
```

Mais o **formato** escolhido, a intenção e o verbo da chamada e a **legenda** (C-30). `descricao` é sempre preenchida:
com foto da empresa disponível, o designer escolhe o arquivo; sem ela, a descrição vira o pedido de foto ao responsável.

Cada lâmina traz também a **forma** do conteúdo, que decide o layout (tabela em `04-LABORATORIO-DE-DESIGN/estilos/LEIA-ME.md`):
`texto-com-visual`, `lista` (3 itens com título e explicação), `formula` (soma ou subtração), `passos` (sequência),
`citacao`, `grade` ou `fecho`. **No miolo, no máximo uma lâmina é só de lista, fórmula, passos, grade ou citação** (DG-09);
as outras são `texto-com-visual`, com mockup, foto ou objeto desenhado ligado ao texto. Um carrossel de sete lâminas tem,
em geral, uma capa, quatro ou cinco `texto-com-visual`, no máximo uma de lista e o fecho.

O designer **só transcreve**: não corta, divide nem reescreve a copy aprovada (C-21). Texto que não cabe volta ao
`copy`, não é encolhido nem repartido.

## 5. Os passos que rodam o gerador

Comandos (a partir da raiz da Fábrica; `{pecas}` é `<saidas>/<run_id>/pecas`, com `<saidas>` a pasta de saídas da linha
na empresa ativa, que o runner obtém no início do run; `{conteudo.json}` é o caminho já traduzido e versionado, o mais recente):

```
node 08-FERRAMENTAS/carrossel/gerar.js {conteudo.json} --saida {pecas} --estilo {estilo} --cores {cores}             # passo 4: só a primeira lâmina
node 08-FERRAMENTAS/carrossel/gerar.js {conteudo.json} --saida {pecas} --estilo {estilo} --cores {cores} --resto     # passo 6: o resto, conferidor, preview
node 08-FERRAMENTAS/carrossel/gerar.js {conteudo.json} --saida {pecas} --estilo {estilo} --cores {cores} --entregar  # passo 9: só o aprovado
```

`{estilo}` e `{cores}` são os do `pedido.md`: por padrão, o estilo escolhido pela empresa com `marca`; sem estilo da
empresa, o `carrossel.estilo` e o `carrossel.cores` do `linha.yaml` (`original` ou `marca`). Todo comando roda com o
prefixo `FABRICA_EMPRESA=<codigo do run>` (é por ele que o gerador acha a marca e os estilos próprios da empresa).

**Ao registrar a peça no Laboratório** (`registrar.js peca`, ver CORE.md): a peça guarda o estilo com que foi feita, e o
Laboratório mostra "Feita no estilo <nome>". Sem o campo `estilo` no JSON da peça, vale o estilo escolhido pela empresa.
Quando o pedido trocou o estilo, ponha no JSON da peça o estilo usado (o `estilo` do `pedido.md`: `"estilo": "<id>"`, ou
`{ "id": "<id>", "origem": "proprio" }` no estilo próprio da empresa); quando não usou nenhum, `"estilo": null`.

O `conteudo.json` traz, em cada lâmina, o `layout` escolhido pela forma (`texto-com-visual` → `conteudo-visual-abaixo` ou
`conteudo-visual-acima`, alternando; `lista` → `lista-numerada`; `formula` → `formula`; `passos` → `comparativo-fluxo`). Sem
`layout`, o montador usa a posição no rodízio e o texto de um campo que o layout não desenha some da lâmina (o conferidor
reprova, C-21).

O `conteudo.json` traz `estilo`, `legenda` e `laminas` (formato em `08-FERRAMENTAS/carrossel/LEIA-ME.md`). Para cada
lâmina com foto, o designer informa o `arquivo` real e uma `alternativa` (mockup, número ou objeto do estilo), para a
lâmina nunca ficar vazia (D1).

Códigos de saída, que o passo declara em **"Exceções ao runner"**:
- `0`: seguiu.
- `1`: o **conferidor reprovou** (ou o texto não passou antes de renderizar). **Não é falha do comando:** apresente o
  relatório inteiro e volte ao passo `design` com os achados; o designer corrige só o que foi citado (L-06). Se o texto
  mudou, o `--resto` recusa até a primeira lâmina ser renderizada e aprovada de novo: é o comportamento certo.
- `2`: erro de uso (arquivo ausente, conteúdo alterado depois da primeira). Mostre a mensagem sem mexer na peça.

Depois do passo 6 e antes do 8, **abra o `preview.html` no navegador do responsável** e dê o caminho clicável. O
responsável decide olhando, nunca lendo uma descrição.

## 5b. O guia `instagram-feed` e o Núcleo

O runner injeta o guia `instagram-feed` no passo `copy` como **referência**, e o guia traz números que **perdem** para o
Núcleo e para o estilo. Em carrossel, valem: corpo de 80 a 130 caracteres por lâmina (C-22), não 40 a 80 palavras; o número
de lâminas do estilo (`laminas.min` a `max`), não 8 a 10; a cor de destaque da marca da empresa ativa, não uma cor fixa do guia; e a
proporção e a resolução do canvas, não 3:4 e 1080x1440. Cabeçalho com marca e data em toda lâmina não vale: a logo só
aparece onde `pecas.logo-aparece-em` manda. O guia continua útil para os formatos de narrativa e para a legenda.

## 6. Os checkpoints de aprovação

Todos por pergunta estruturada, com o arquivo que a pessoa precisa ver e **o arquivo aberto para ela**:

| Checkpoint | O que a pessoa vê | Sim | Ajuste |
|---|---|---|---|
| `aprovar-copy` | `copy.md`, lâmina por lâmina, e a legenda | segue para o design | volta ao passo `copy` |
| `aprovar-primeira` | `lamina-01.png` aberta | segue para o resto | volta ao passo `design` |
| `aprovar-preview` | `preview.html` aberto, o relatório do conferidor e `miniaturas-100px.png` | segue para a entrega | texto: passo `copy`; visual: passo `design` |

## 7. Fotos da empresa (texto de onboarding, D19)

Quando a Descoberta marcar `carrossel.fotos: poucas` ou `nenhuma`, diga isto ao responsável, nas suas palavras mas sem
mudar o conteúdo:

> Para os carrosséis ficarem com cara de profissional, o ideal é eu ter fotos da pessoa que aparece nas peças:
> - de 15 a 20 fotos, em alta resolução;
> - pelo menos dois cenários de luz, um claro e um escuro;
> - variedade de pose: busto de frente com expressão neutra, busto sorrindo e ao menos uma foto com espaço livre ao lado
>   para o texto.
>
> Coloque os recortes em `<pastaMarca>/fotos/`; os originais pesados ficam em `<pastaMarca>/originais/`, fora do
> repositório. **Você não precisa disso para começar:** sem fotos, os carrosséis usam mockups, números e objetos do
> estilo, e a cada peça eu aviso qual foto melhoraria uma lâmina.

Ao dizer o texto, troque `<pastaMarca>` pelo caminho `pastaMarca` da empresa ativa (na pasta antiga, `06-MARCA-E-FOTOS`).
Não prometa foto gerada por IA (I-16).

## 8. O que a Construção gera, e o que o portão confere

A Construção cria, para a linha de carrossel: as três estações (seção 1), os nove passos (seção 2), `linha.yaml` com
`formato` e `carrossel.estilo`, `LEIA-ME.md` e `dados/` (com o que o Desenho extraiu da pesquisa do setor: vocabulário,
exemplos de gancho). Ela **não** copia regras do Núcleo para dentro da linha.

O **Portão 2d** (`node _fabrica/core/validar-linha.js <codigo>`, bloqueante) reprova a linha que:
1. não declara um `carrossel.estilo` que exista no catálogo;
2. não tem cada um dos nove passos, uma vez, do tipo certo e na ordem;
3. põe qualquer coisa entre a aprovação e o passo que ela libera (`design`, `renderizar`, `entregar`);
4. tem estação de copy, design ou revisão sem o `**Papel do Núcleo:**` certo, ou com um arquivo que não existe;
5. tem um `pedido` sem os sete formatos, uma `copy` sem o campo `visual` com `descricao`, ou passos de design,
   renderização e entrega que não usam o gerador (`gerar.js`, `--resto`, `--entregar`);
6. tem `renderizar` ou `revisao` sem `ao_reprovar` apontando para quem pode corrigir;
7. cita gerador de imagem por IA em qualquer arquivo (I-16);
8. declara em `saida` um caminho dentro de `saida/pecas/`, ou tem passo `copy` sem a `forma` da lâmina ou passo `design` sem
   o `layout` escolhido pela forma.
