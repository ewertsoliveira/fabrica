---
tipo: checkpoint
saida: saida/pedido.md
---

# Passo 1: Pedido (o que fazer, carrossel ou post, identidade e estilo)

Checkpoint de entrada. Aqui a pessoa decide o que a peça vai dizer e como ela vai ficar. Toda pergunta vai por
`AskUserQuestion`, **uma por vez**, com no máximo 4 opções, cada opção com um exemplo, e explica antes, em uma frase, o
conceito e por que a resposta importa (L-02). Nenhuma fala usa nome interno (L-03): diga "imagem do carrossel", "texto",
"calendário"; nunca "lâmina", "copy", "checkpoint", "passo N" ou nome de arquivo.

## Fala de abertura

Antes da primeira pergunta, diga nas suas palavras, sem nome interno (L-01):

> Vou montar com você uma peça para o seu feed do Instagram. Primeiro eu pergunto o que você quer dizer e como ela vai
> ficar; depois escrevo o texto para você aprovar, mostro a primeira imagem e só então faço o resto. Nada é publicado:
> no fim você recebe as imagens e a legenda prontas para postar, e a peça entra no seu calendário.

## Antes de perguntar

1. Rode `node _fabrica/core/empresa.js caminhos <codigo do run> --linha carrossel-e-post --json` e guarde `perfil`,
   `marca`, `pastaMarca`, `decisoes` e `cronograma`.
2. **Posts planejados:** rode `node _fabrica/core/plano-do-mes.js planejados --empresa <codigo do run> --json`. Ele
   lista os posts de carrossel e de post do calendário, de hoje em diante, que ainda não têm arte. Lista vazia: pule a
   pergunta 1. Saída 1 (o calendário não pôde ser lido): diga em uma frase que não deu para ver o calendário agora,
   com o motivo, e siga sem a pergunta 1.
3. **Estilo da empresa:** `node _fabrica/core/estilo-da-linha.js <codigo do run>` (só lê).
4. **Identidade:** `node _fabrica/core/identidade.js <codigo do run>` (só lê): o resumo e a recomendação da pergunta 5.
5. **Fotos:** veja o que existe em `<pastaMarca>/fotos/`. Pasta vazia ou ausente: "nenhuma".

## Perguntas

### 1. Um post do calendário ou uma ideia nova (só quando há posts planejados)

Explique: "Você tem posts planejados no calendário que ainda não ganharam arte. Posso começar por um deles: o roteiro e
a legenda que já estão lá viram o texto das imagens."

"Vamos fazer um post que já está no seu calendário ou uma ideia nova?" Opções: até 3 posts planejados, os de data mais
próxima, cada um como "<DD/MM>: <título> (<carrossel ou post>)", e **Uma ideia nova**.

Escolheu um post planejado: ache-o pelo `id` no `posts.json` da pasta `cronograma` e guarde `post_id` (o `id`), `data`
(o `date`), `tipo_peca` (o `tipo`), `tema` (o `title`), `roteiro_planejado` (o `script`, palavra por palavra) e
`legenda_planejada` (o `caption`, palavra por palavra). O objetivo sai da chamada da legenda. Pule as perguntas 2 e 3.

### 2. Carrossel ou post (só na ideia nova)

Explique os dois antes de perguntar, com estas palavras:

- **Carrossel:** uma sequência de imagens que a pessoa passa para o lado, como páginas, boa para explicar algo em partes.
- **Post:** uma imagem só, boa quando a ideia cabe numa frase.

"Carrossel ou post?" Opções: **Carrossel** (ex.: "7 imagens com os sinais de que um produto é de qualidade") e **Post**
(ex.: "uma imagem com a novidade do mês"). Se o pedido da pessoa já disser qual, ele é a opção recomendada.

### 3. Tema e objetivo (só na ideia nova)

Explique: "O tema é o assunto da peça; o objetivo é o que você quer que a pessoa faça depois de ver: salvar, mandar
mensagem, conhecer um produto."

Pergunta aberta, com 2 ou 3 exemplos concretos tirados do perfil da empresa (o caminho `perfil`), um por opção; a
pessoa pode escrever o dela. Se ela disser uma data de publicação, guarde em `data`; senão, `data` é a de hoje.

### 4. O jeito de contar (só no carrossel)

Explique: "Um carrossel pode contar a mesma ideia de jeitos diferentes. O jeito muda a ordem das imagens e o que cada
uma mostra." O formato é sempre escolhido pela pessoa, nunca presumido (F-22). Os sete, cada um com o exemplo:

- **editorial**: uma ideia defendida em etapas ("Por que o preço baixo sai caro");
- **lista**: itens do mesmo peso, um por imagem ("5 sinais de que o caixa está apertado");
- **tutorial**: passo a passo para fazer algo ("Como conferir a nota em 3 passos");
- **mito e realidade**: o que muita gente acha contra o que é de verdade ("Mito: quem fatura bem não tem dívida");
- **antes e depois**: a situação e o resultado ("Mesmo negócio, antes e depois da organização");
- **história**: um caso contado do começo ao fim ("O dia em que o estoque zerou");
- **problema e solução**: a dor e o caminho ("Atrasou o repasse? Veja o que fazer").

A pergunta aceita 4 opções: mostre os 3 que mais combinam com o tema (o primeiro recomendado, com o porquê em uma frase)
e **Outro jeito**, que mostra os outros quatro numa segunda pergunta. No post, grave `formato: post estático` e pule
esta pergunta.

### 5. A identidade visual (L-04)

Explique: "Identidade visual é o conjunto de cores, letras e logo que faz as suas peças serem reconhecidas como suas.
Eu posso montar esta peça com ela, para ficar com a mesma cara dos seus outros conteúdos." Mostre o resumo do
`identidade.js` como ele vem (é escrito para a pessoa).

**Mostre antes de perguntar (D-01):** com marca ou estilo escolhido, abra a tela Estilos do painel
(`node _fabrica/paineis/servidor.js garantir` e `<endereço>/_fabrica/paineis/estilos.html?empresa=<codigo do run>`),
que mostra cada estilo no original e nas cores da empresa, lado a lado, e ponha esse endereço no texto da pergunta. Sem
marca nem estilo, não há aparência para escolher: a pergunta é só se cria a identidade agora.

"Quer que esta peça use a sua identidade visual?", com a recomendação em primeiro lugar:

- **Já tem identidade** (recomendação `usar-identidade`):
  1. **"Sim, usar a minha identidade" (recomendada):** as cores e as letras do resumo e onde já foram usadas. Grave
     `identidade: usar` e `cores: marca`.
  2. **"Ver os estilos prontos com as cores originais deles":** na tela Estilos, a pessoa escolhe um estilo e se quer
     as cores originais dele. Grave `identidade: estilo-pronto`, o `estilo` escolhido e `cores: original`.
  3. **"Ajustar a minha identidade antes":** siga o "Fluxo de marca" da skill `fabrica` e volte a esta pergunta.
- **Não tem identidade** (`criar-identidade` ou `usar-estilo`):
  1. **"Criar a minha identidade agora (uns 5 minutos)" (recomendada):** ela escolhe cores e letras olhando, e a
     identidade vale para todos os conteúdos. Siga o "Fluxo de marca" e volte.
  2. **"Usar um estilo pronto, com as cores dele"** (com estilo escolhido: "Usar o estilo <nome>, com as cores dele"):
     a mesma tela Estilos; avise que dá para transformar o estilo na identidade da empresa depois. Grave
     `identidade: estilo-pronto` e `cores: original`.

Nunca use `cores: marca` sem a marca da empresa gravada (o arquivo do caminho `marca`): a peça sairia com a marca de
exemplo, de uma empresa que não existe.

### 6. O estilo (só quando a resposta 5 foi "usar a minha identidade")

Explique: "O estilo é o desenho das imagens: onde fica o texto, os enfeites e o jeito de mostrar cada visual. As cores e
as letras continuam as da sua identidade."

- **A empresa escolheu um estilo** (o `estilo-da-linha.js` mostra qual): ele vale, sem pergunta. Diga em uma frase:
  "Vou usar o seu estilo, <nome>, nas cores da sua marca."
- **Sem estilo escolhido:** o padrão é o `carrossel.estilo` do `linha.yaml`, sóbrio, com muito respiro e feito para
  funcionar sem foto. Com a tela Estilos aberta e o endereço no texto, pergunte: "Para o desenho das imagens, vou usar o
  estilo padrão, nas suas cores. Quer ver outros antes?" Opções: **Usar o padrão** (recomendada) e **Escolher outro
  estilo na tela** (a pessoa escolhe olhando; grave o que ela escolheu).

**Estilo que precisa de foto de pessoa** (o campo `precisa` do `estilo.yaml` dele traz `foto-de-pessoa`) e nenhuma foto
na pasta: avise antes de seguir: "Este estilo foi feito para ter uma foto sua na capa, e ainda não há fotos suas na
Fábrica." Ofereça pôr fotos agora (na pasta `<pastaMarca>/fotos/`) ou um estilo que funciona sem foto (`precisa` com
`funciona-sem-foto`), mostrado na tela Estilos.

### 7. As fotos (só quando há fotos na pasta; escolha visual, D-01)

Nunca pergunte pelo nome do arquivo nem mostre só a pasta ou uma prancha das fotos soltas. Escolha de 2 a 4
candidatas, monte a peça com cada uma pelo gerador (`08-FERRAMENTAS/carrossel/gerar.js`: a capa, ou a imagem onde a
foto entra, com o tema como título provisório), junte as versões lado a lado com as letras A, B, C escritas, abra no
navegador da pessoa e só então pergunte, numa chamada própria, com o caminho da prévia no texto da pergunta e as opções
pelas mesmas letras, mais **Nenhuma foto**. Opção que não foi montada não é oferecida. Sem fotos, grave
`fotos: nenhuma`: o designer usa mockups, números e objetos do estilo.

## Formato da resposta a salvar (`saida/pedido.md`)

```markdown
# Pedido

- origem: planejado | nova
- post_id: <o id do post planejado> | (vazio na ideia nova)
- data: <AAAA-MM-DD: a do post planejado; na ideia nova, a que a pessoa disse ou a de hoje>
- tipo_peca: carrossel | post
- tema: <o assunto, em uma frase>
- objetivo: <o que a pessoa deve fazer depois de ver>
- formato: editorial | lista | tutorial | mito e realidade | antes e depois | história | problema e solução | post estático
- identidade: usar | estilo-pronto
- estilo: <id>
- estilo_origem: catalogo | proprio
- cores: marca | original
- fotos: <lista de arquivos> | nenhuma

## roteiro_planejado

<só na origem planejado: o script do post, copiado palavra por palavra>

## legenda_planejada

<só na origem planejado: o caption do post, copiado palavra por palavra>
```

## Ao terminar (L-05)

Diga em uma frase o que ficou decidido ("um carrossel de 7 imagens, no jeito lista, com a sua identidade") e que o
próximo passo é o texto, que ela aprova antes de qualquer imagem.

## Vetos

Refazer se ALGUMA for verdadeira:
1. Proposta visual sem prévia no mesmo turno (estilo, cores ou foto perguntados sem a tela Estilos ou a montagem
   aberta).
2. Opções descritas em texto em vez de mostradas lado a lado.
3. Matéria-prima no lugar da peça (prancha de quadros soltos, lista de fotos, nome de arquivo).
4. Formato do carrossel presumido em vez de escolhido.
5. Pergunta com termo sem explicação ou com nome interno.
6. Post planejado sem o `roteiro_planejado` e a `legenda_planejada` copiados palavra por palavra.

## Critérios de qualidade

- [ ] Uma pergunta por vez, cada uma com o porquê, de 2 a 4 opções com exemplo.
- [ ] Na escolha de foto, de 2 a 4 opções com letra, uma linha cada, montadas e abertas antes, com o contraste medido
      pelo gerador.
- [ ] A identidade foi mostrada e perguntada antes do estilo.
- [ ] O `pedido.md` tem todos os campos; na origem planejado, `post_id` e `data` são os do post do calendário.
