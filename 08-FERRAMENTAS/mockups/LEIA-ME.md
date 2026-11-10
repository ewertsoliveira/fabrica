# Biblioteca de mockups

Mockups nativos em HTML e CSS para as peças de feed (regras M-01 a M-08 do Núcleo, em
`05-ESTRATEGIA/nucleo-de-conteudo/regras/06-mockups-e-interfaces.md`). O cromo de cada plataforma imita a interface real;
o conteúdo de dentro (foto de perfil, posts da grade, botões de aplicativo, marcadores) é pintado pelas cores do
`marca.yaml`. Nenhum valor de empresa fica aqui.

## Componentes

| Função | O que mostra |
|---|---|
| `perfil` | Perfil de Instagram: aro de stories, números, bio, botões, destaques, abas e grade de 9 posts |
| `busca` | Resultado de busca com contas |
| `post` | Post com curtidas, legenda e comentários |
| `story` | Story com barras de progresso, enquete e campo de resposta |
| `conversa` | Conversa no direct |
| `notificacao` | Notificação na tela de bloqueio |
| `navegador` | Janela de navegador com página |
| `planilha` | Planilha com célula em destaque |
| `documento` | Documento com trecho marcado e comentário |
| `cartaoApp` | Cartão de aplicativo com valor e gráfico de barras |
| `checklist` | Lista de tarefas com progresso |
| `antesDepois` | Comparativo antes e depois |
| `comMarcadores(html, [{ n, x, y }])` | Marcadores numerados sobre partes do mockup (M-08); `x` e `y` em % |

### Dados de cada componente (o que vai em `dados` no `conteudo.json`)

| Componente | Campos |
|---|---|
| `perfil` | usuario, nome, categoria, bio (lista de linhas), link, posts, seguidores, seguindo, verificado, destaques (lista), grade (lista de 9 títulos), foto |
| `busca` | termo, resultados |
| `post` | usuario, local, titulo, curtidas, comentarios, legenda, tempo, foto |
| `story` | usuario, tempo, texto, opcoes (2), partes, atual, foto |
| `conversa` | contato, usuario, estado, hora, mensagens (lista de `{ de: 'ele' ou 'eu', texto }`) |
| `notificacao` | app, titulo, texto, hora, relogio, data |
| `navegador` | url, aba, titulo, texto, botao |
| `planilha` | nome, colunas (lista), linhas (lista de listas), destaque (`[linha, coluna]`), formula |
| `documento` | nome, titulo, paragrafos (lista), destaque (índice do parágrafo), comentario, autor |
| `cartaoApp` | rotulo, valor, variacao, descricao, barras (números), meses (rótulos) |
| `checklist` | titulo, itens (lista de `{ texto, feito }`) |
| `antesDepois` | antes e depois, cada um com rotulo, titulo e itens (lista) |

**Cabe no espaço?** No miolo, o mockup ocupa o que sobra abaixo (ou acima) do texto. Com corpo de três linhas, as peças
altas (`perfil`, `post`, `story`, `busca`, planilha com mais de 3 linhas, conversa com mais de 2 mensagens) passam da
borda; o conferidor reprova (M-03) e o remédio é reduzir mensagens, linhas ou itens, ou escolher um mais baixo
(`checklist`, `notificacao`, `cartaoApp`, `antesDepois`, `documento` curto). Mockup alto pede lâmina com menos texto.

Todo componente aceita `modo: 'claro' | 'escuro'` e os próprios dados; sem dados, usa um exemplo fictício em português.
Foto real entra por `foto` (perfil, post, story); sem foto, entra o monograma ou a capa tipográfica da marca, nunca
caixa cinza (M-02).

## Uso

```js
const mk = require('./08-FERRAMENTAS/mockups/mockups');
const html = `<style>${mk.css()}</style>` + mk.post({ modo: mk.temaSobre('escuro') === 'claro' ? 'claro' : 'escuro', titulo: '...' });
```

- **M-04:** todo texto fica entre `canvas.pisos-ui.corpo` e `canvas.pisos.corpo` do `marca.yaml` (a escala está em
  `mk.ESCALA`).
- **M-06:** `mk.temaSobre(fundo)` devolve `'claro'` quando o fundo é escuro. Os componentes saem com sombra forte;
  `sombra: false` tira.
- **M-07:** a interface sai em português.

## Prévia e testes

```
node 08-FERRAMENTAS/mockups/previa.js        # gera previa.html com a marca atual (não vai para o git)
node 08-FERRAMENTAS/mockups/mockups.test.js  # 22 testes, cada conferidor calibrado contra um caso que reprova (G-13)
```
