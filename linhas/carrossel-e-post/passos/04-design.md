---
execucao: inline
estacao: design-visual
entrada: saida/copy-aprovada.md
saida: saida/conteudo.json
---

# Passo 4: Montar a primeira imagem

## Contexto a carregar

- `saida/copy-aprovada.md`: o texto congelado
- `saida/pedido.md`: `tipo_peca`, `estilo`, `estilo_origem`, `cores`, `fotos`, `identidade`
- `05-ESTRATEGIA/nucleo-de-conteudo/agentes/designer-visual.agent.md`: o papel
- `04-LABORATORIO-DE-DESIGN/estilos/LEIA-ME.md`: a tabela forma → layout e os campos de cada layout
- `04-LABORATORIO-DE-DESIGN/estilos/<estilo>/estilo.yaml` (ou o estilo próprio da empresa): os layouts de `capa`,
  `miolo` e `fecho`, o `molde_do_miolo`, os `objetos` e o kit
- `08-FERRAMENTAS/carrossel/LEIA-ME.md`: o formato do `conteudo.json` e as opções do gerador
- `08-FERRAMENTAS/mockups/LEIA-ME.md`: os mockups e os campos de cada um

## Instruções

1. Monte o `conteudo.json` **só transcrevendo** o texto aprovado: mesmos textos, mesmos destaques. Não corte, não
   divida, não reescreva (C-21). Texto que não cabe volta ao passo `copy`.
2. Escolha o `layout` de cada imagem **pela forma**:
   - capa → o layout de `capa` do estilo; fecho → o de `fecho`;
   - `texto-com-visual` → os layouts de `miolo` do estilo, conforme o `molde_do_miolo`: `rodizio` alterna (dois iguais
     nunca seguidos, DG-10); `fixo` usa o único layout de miolo em todo o miolo;
   - `lista` → `lista-numerada`; `formula` → `formula`; `passos` → `comparativo-fluxo`; `grade` → `grade-2-colunas`;
     `citacao` → `citacao`.

   Contraste reprovado pela conferência (em geral, o destaque ou um número na cor de destaque da marca sobre o fundo
   escuro): ponha `"fundo": "claro"` nessa imagem (um dos fundos do estilo); nunca mude a cor do texto. Se continuar
   reprovado no fundo claro, o estilo pinta o destaque como uma faixa da cor de destaque atrás da palavra, e a cor de
   destaque da marca é escura demais para isso. Não insista: diga à pessoa em uma frase e pergunte, com a primeira
   imagem aberta, se prefere tirar o destaque das palavras, usar as cores originais do estilo nesta peça (`--cores
   original` nos três comandos do gerador) ou trocar de estilo.
3. Ponha `"estilo"` (o do pedido), `"legenda"` (a aprovada) e `"formato"`: `carrossel`, ou `post` com uma imagem só.
4. Para cada visual:
   - com foto do pedido: o `arquivo` real e uma `alternativa` (mockup, número ou objeto do estilo), para a imagem
     nunca ficar vazia;
   - sem foto: um mockup (de `08-FERRAMENTAS/mockups/`) ou um número tirado do próprio texto;
   - `objeto-do-estilo`: um objeto da lista `objetos` do estilo; estilo sem objetos: o mockup ou o número que diga o
     mesmo;
   - na capa (e no post, que usa o layout de capa), o visual divide o espaço com o título: use um visual baixo (número
     com rótulo curto, documento de duas linhas) e confira na primeira imagem que nada encosta na barra de navegação
     nem é cortado na borda;
   - **mockup: preencha todos os campos dele** (a tabela de campos está em `08-FERRAMENTAS/mockups/LEIA-ME.md`).
     Campo sem valor sai com o texto de demonstração da biblioteca, com nomes e frases de outra empresa; o que não deve
     aparecer vai vazio (`""`), como o `comentario` do documento;
   - mockup alto empurra o texto para baixo dele: no máximo três linhas no documento, duas mensagens na conversa e três
     itens na lista de tarefas;
   - **foto de pessoa: o texto nunca cobre o rosto.** Na capa com foto, ajuste `posicao_foto` (por exemplo
     `"0% 30%"` puxa a pessoa para a direita, longe do texto alinhado à esquerda) e confira na primeira imagem que o
     título, o véu e os enfeites ficam fora do rosto;
   - mantenha a `descricao` da copy: é o pedido de foto à empresa.
5. Rode, a partir da raiz da Fábrica, com `{pecas}` = `<saidas>/<run_id>/pecas`:

   ```
   FABRICA_EMPRESA=<codigo do run> node 08-FERRAMENTAS/carrossel/gerar.js {conteudo.json} --saida {pecas} --estilo {estilo} --cores {cores} --formato {carrossel|post}
   ```

   Isso monta **só a primeira imagem** (DG-18). `{estilo}` e `{cores}` vêm do `pedido.md`. Saída 1 (texto reprovado
   antes de montar): mostre o motivo e volte ao passo `copy`. Saída 2: mostre a mensagem sem mexer na peça.
6. Abra `{pecas}/lamina-01.png` no navegador da pessoa e dê o caminho clicável.

## Formato

`saida/conteudo.json`:

```json
{
  "estilo": "<id>",
  "formato": "carrossel | post",
  "legenda": "<legenda aprovada>",
  "laminas": [
    { "layout": "<layout>", "kicker": "...", "titulo": "...", "subtitulo": "...",
      "visual": { "tipo": "...", "descricao": "...", "alternativa": { "tipo": "...", "valor": "...", "rotulo": "..." } } }
  ]
}
```

## Exemplo

```json
{
  "estilo": "revista-dominical",
  "formato": "carrossel",
  "legenda": "Você sabe reconhecer um pão de fermentação natural? A casca, o miolo e até o rótulo contam a história. Passe aqui para provar a fornada da manhã.",
  "laminas": [
    { "layout": "capa-revista-dominical", "kicker": "PÃO DE VERDADE",
      "titulo": "5 sinais de um pão de *fermentação natural*", "subtitulo": "Aprenda a reconhecer antes de comprar",
      "visual": { "tipo": "numero", "valor": "5", "rotulo": "sinais para conferir",
        "descricao": "pão de casca dourada cortado ao meio" } },
    { "layout": "miolo-revista-dominical-abaixo", "titulo": "A casca *canta*",
      "corpo": "Ao sair do forno, a casca estala baixinho. É o ar quente escapando da crosta grossa e bem assada.",
      "visual": { "tipo": "foto", "arquivo": "<pastaMarca>/fotos/pao-saindo-do-forno.jpg",
        "descricao": "pão inteiro de casca rachada, ainda soltando vapor na bancada",
        "alternativa": { "tipo": "mockup", "componente": "conversa", "dados": { "contato": "Cliente", "usuario": "cliente", "estado": "Online agora", "hora": "Hoje",
          "mensagens": [ { "de": "ele", "texto": "Que barulhinho é esse no saco do pão?" },
            { "de": "eu", "texto": "É a casca esfriando. Sinal de pão bem assado." } ] } } } },
    { "layout": "miolo-revista-dominical-acima", "titulo": "O miolo tem *furos irregulares*",
      "corpo": "Furos de tamanhos diferentes mostram que a massa fermentou devagar, por muitas horas, sem fermento químico.",
      "visual": { "tipo": "mockup", "componente": "antesDepois", "descricao": "fatia com o miolo à mostra",
        "dados": { "antes": { "rotulo": "Pão comum", "titulo": "Furos iguais", "itens": [ "massa rápida" ] },
          "depois": { "rotulo": "Fermentação natural", "titulo": "Furos de vários tamanhos", "itens": [ "massa que descansa" ] } } } },
    { "layout": "lista-numerada", "fundo": "claro", "titulo": "O que muda no *sabor*",
      "itens": [ { "titulo": "Acidez leve", "texto": "um azedinho suave no fundo" },
        { "titulo": "Aroma", "texto": "cheiro de grão tostado" }, { "titulo": "Textura", "texto": "miolo úmido e elástico" } ] },
    { "layout": "miolo-revista-dominical-abaixo", "titulo": "Dura mais na *bancada*",
      "corpo": "A acidez natural protege o pão: ele continua macio por até três dias, guardado num saco de pano.",
      "visual": { "tipo": "numero", "valor": "3", "rotulo": "dias macio no saco de pano" } },
    { "layout": "miolo-revista-dominical-acima", "titulo": "A lista de ingredientes é *curta*",
      "corpo": "Farinha, água, sal e o fermento natural. Se o rótulo traz mais que isso, vale desconfiar.",
      "visual": { "tipo": "mockup", "componente": "documento", "descricao": "etiqueta com quatro ingredientes",
        "dados": { "nome": "Rótulo", "titulo": "Ingredientes", "paragrafos": [ "Farinha de trigo", "Água e sal", "Fermento natural" ],
          "destaque": 2, "comentario": "", "autor": "" } } },
    { "layout": "fecho-cartao-visual", "titulo": "Prove a *diferença*", "subtitulo": "Fornada nova toda manhã",
      "botao": "Quero provar",
      "visual": { "tipo": "mockup", "componente": "conversa", "dados": { "contato": "Cliente", "usuario": "cliente", "estado": "Online agora", "hora": "Hoje",
        "mensagens": [ { "de": "ele", "texto": "Tem pão de fermentação natural hoje?" }, { "de": "eu", "texto": "Fornada nova toda manhã. Pode vir provar." } ] } } }
  ]
}
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Proposta visual sem prévia aberta: a primeira imagem não foi aberta para a pessoa.
2. Texto da copy alterado, cortado ou dividido.
3. Foto citada que não existe e sem `alternativa`.
4. Imagem sem `layout`, ou dois layouts iguais seguidos num estilo de rodízio.
5. Mockup com campo sem valor, que sairia com texto de demonstração.
6. `--cores` ou `--estilo` diferente do `pedido.md`.
7. Post com mais de uma imagem ou sem `--formato post`.

## Critérios de qualidade

- [ ] Cada texto do `conteudo.json` é idêntico ao do texto aprovado.
- [ ] Toda imagem com espaço para visual tem visual preenchido, ligado ao texto dela.
- [ ] O comando rodou com o prefixo `FABRICA_EMPRESA` e saiu 0.
- [ ] A primeira imagem foi aberta e o caminho dado.
