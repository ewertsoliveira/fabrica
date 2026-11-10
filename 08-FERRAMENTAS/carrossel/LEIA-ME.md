# Carrossel: gerador, prévia e conferidor

Monta um carrossel de feed a partir do conteúdo das lâminas, de um estilo do catálogo
(`04-LABORATORIO-DE-DESIGN/estilos/`) e do `marca.yaml` da empresa ativa. Gera PNG na resolução do canvas, um HTML autocontido,
uma prévia num simulador de Instagram e um relatório do conferidor. **Nenhuma etapa usa serviço de imagem por IA** (I-16):
quando uma foto ajudaria, o conteúdo traz a descrição dela, e a peça não espera.

## Como usar

```
node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida saida/meu-carrossel
```

Roda só a **primeira lâmina** e para (DG-18). Veja a imagem `lamina-01.png`. Estando certa:

```
node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida saida/meu-carrossel --resto
```

Renderiza as demais, confere tudo e monta a prévia. Se o conteúdo ou o estilo mudar depois da primeira lâmina, o
`--resto` recusa: a primeira precisa ser renderizada e aprovada de novo. Com o preview aprovado:

```
node 08-FERRAMENTAS/carrossel/gerar.js conteudo.json --saida saida/meu-carrossel --entregar
```

Nos fixados e na capa de Reels, a prévia mostra a peça na grade do perfil (quadros 3:4) e, na capa, a imagem inteira com as faixas que a interface cobre. Não há barra, arraste nem contador: são peças de uma lâmina só.

Copia para `saida/meu-carrossel/entrega/` só o que saiu aprovado (lâminas, `carrossel.html`, `legenda.txt`). Recusa se a
peça não foi renderizada por inteiro, se o conferidor reprovou ou se o conteúdo mudou depois da renderização.

| Opção | O que faz |
|---|---|
| `--saida <pasta>` | onde gravar (obrigatória) |
| `--estilo <id>` | estilo do catálogo (ou um estilo próprio da empresa ativa), se o JSON não trouxer `"estilo"`. Sem os dois, vale o estilo escolhido pela empresa ativa (`estilo.json`; `node _fabrica/core/estilo-da-linha.js <codigo>` mostra qual). Estilo próprio é lido só da pasta de estilos próprios da empresa ativa e renderizado e conferido com a rede fechada |
| `--cores marca` (padrão) \| `original` | cores e fontes do `marca.yaml` por cima do estilo, ou as originais aprovadas do estilo (`sugestao` é sinônimo de `original`). Use o mesmo valor nos três passos |
| `--resto` | segundo passo, depois de aprovar a primeira lâmina |
| `--entregar` | terceiro passo, depois de aprovar o preview: copia só o aprovado para `entrega/` |
| `--formato carrossel` (padrão), `fixados` ou `reels` | o que montar: o carrossel (canvas.feed), os **3 posts fixados** (1080x1440, 3:4, layouts de `formatos.fixados`: apresentação, método e contratar) ou a **capa de Reels** (1080x1920; o texto fica entre y 250 e 1520, dentro do recorte 3:4 da grade, V-04). Também pode vir como `"formato"` no JSON |

### O que sai na pasta

| Arquivo | O que é |
|---|---|
| `lamina-01.png` ... | as lâminas, na resolução de `canvas.feed`, sem escala (T-02) |
| `preview.html` | **uma prévia só** no simulador de Instagram: setas, arraste, contador, pontinhos, legenda, área segura sob pedido (L-03, L-08) |
| `carrossel.html` | a peça em HTML autocontido, com fontes e imagens embutidas (T-01, T-06) |
| `conferencia.txt` | o relatório do conferidor |
| `miniaturas-100px.png` | todas as lâminas com 100 px de largura, para o revisor julgar o reconhecimento (DG-19) |
| `legenda.txt`, `estado.json` | a legenda e o estado do fluxo |

## O conteúdo (`conteudo.json`)

```json
{
  "estilo": "papelaria",
  "legenda": "Texto que acompanha o post no feed.",
  "laminas": [
    { "foto": "caminho/da/pasta-de-fotos-da-empresa/retrato.jpg", "kicker": "...", "titulo": "Título com *destaque*", "subtitulo": "..." },
    { "titulo": "...", "corpo": "80 a 130 caracteres, no máximo duas frases.",
      "visual": { "tipo": "postit", "texto": "Frase-chave com **negrito**." } },
    { "titulo": "...", "visual": { "tipo": "foto", "arquivo": "caminho/foto.jpg",
        "descricao": "mesa de trabalho com café, luz da manhã",
        "alternativa": { "tipo": "numero", "valor": "3", "rotulo": "passos" } } }
  ]
}
```

O caminho de uma foto (`foto` ou `visual.arquivo`) é absoluto ou relativo à raiz da Fábrica (ex.:
`<pastaMarca>/fotos/retrato.jpg`, com a `pastaMarca` da empresa ativa devolvida por
`node _fabrica/core/empresa.js caminhos --json`).

A primeira lâmina é a capa e a última é o fecho; o resto é miolo. `visual` pode ser um mockup
(`{ "tipo": "mockup", "componente": "perfil", "dados": {...}, "marcadores": [...] }`, da biblioteca em
`08-FERRAMENTAS/mockups/`), uma foto, um número ou um objeto do próprio estilo. Os campos de cada layout e de cada objeto
estão em `04-LABORATORIO-DE-DESIGN/estilos/LEIA-ME.md`.

**Foto que não existe:** se o visual tem `alternativa`, ela entra e o gerador avisa (a lâmina nunca fica vazia, D1). Sem
alternativa, o gerador para e lista o arquivo que falta e a descrição da imagem que ajudaria.

## O conferidor

`node 08-FERRAMENTAS/carrossel/conferir.js conteudo.json --estilo <id>` roda sozinho. O `gerar.js` roda o conferidor de
texto antes de renderizar e o conferidor completo no segundo passo. A saída é **APROVADO** ou **REPROVADO** com a regra, a
lâmina e a frase exata. Reprovado: corrija só o que foi citado, sem refazer a peça inteira (L-06).

| Confere | Regras |
|---|---|
| Texto: corpo de 80 a 130 caracteres e até duas frases, exclamação, travessão, emoji, termo vetado, mais de uma chamada, chamada de intenção web, fórmulas e palavras vetadas | C-22, C-09, C-10, C-11, C-02, C-18, C-19, A-05, A-09 |
| Tamanho do texto no piso da sua escala (conteúdo e interface) | DG-01, M-04 |
| Destaque sem mudar tamanho nem peso | DG-04 |
| Conteúdo fora das faixas reservadas, e texto que vaza da lâmina | DG-08, DG-02 |
| **Texto coberto por outro elemento** | DG-23 |
| Texto de mockup cortado pela metade | M-03 |
| Elemento visual em toda lâmina, sem caixa vazia nem cinza, sem imagem quebrada; no miolo, no máximo uma lâmina só tipográfica | DG-09, I-15, M-02 |
| **Texto da copy que o layout não desenha** (o layout vem da posição no rodízio, e o campo some da lâmina) | C-21 |
| Miolo como o estilo declara, e o mesmo elemento visual em lâminas seguidas | DG-10 |
| Sequência de fundos declarada | DG-15 |
| Barra, arraste e contador só se o estilo declarar; sem arraste no último | F-26 a F-29, F-53 |
| Logo só nos pontos de `pecas.logo-aparece-em`, completa | DG-16 |
| Foto em tela cheia só na capa, e capa com véu | I-13, I-14 |
| **Contraste AA, medido nos pixels da peça renderizada**, inclusive sobre foto | AA |
| Número de lâminas, contadores e mockup duplicado | T-12, T-13 |

O contraste é medido de verdade: o conferidor esconde o texto, fotografa o fundo e compara com a cor do texto (3:1 para
texto grande, 4,5:1 para o resto). A cobertura é medida com um teste de ponto no navegador.

**O que o conferidor não julga** e fica com o revisor de qualidade: se a imagem escolhida combina com o texto, se a copy é
afirmativa, se a peça se reconhece nas miniaturas de 100 px e tudo o que é gosto.

## Testes

```
node 08-FERRAMENTAS/carrossel/molde.test.js     # montador e estilos do catálogo (30)
node 08-FERRAMENTAS/carrossel/conferir.test.js  # cada checagem contra um caso feito para reprovar (49)
node 08-FERRAMENTAS/carrossel/gerar.test.js     # o gerador de ponta a ponta (18)
```

Os dois últimos abrem o Chromium. Precisa do `npm install` e do `npx playwright install chromium` na raiz da Fábrica; ou
aponte `FABRICA_CHROMIUM` para um Chromium ou Chrome já instalado.

## Arquivos

`gerar.js` (comando), `conferir.js` (regras), `molde.js` (monta as lâminas), `render.js` (PNG), `preview.js` (simulador),
`navegador.js` (abre o Chromium), `recortar.js` (tira o fundo liso de um retrato para o campo `recorte` da capa:
`node 08-FERRAMENTAS/carrossel/recortar.js foto.jpg recorte.png`; confira o PNG). Os layouts ficam em `04-LABORATORIO-DE-DESIGN/layouts/` e os estilos em
`04-LABORATORIO-DE-DESIGN/estilos/`.
