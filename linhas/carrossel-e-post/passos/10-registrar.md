---
execucao: inline
entrada: saida/entrega.md
saida: saida/registro.md
---

# Passo 10: Pôr no Laboratório e no calendário (script)

Põe a peça entregue no Laboratório de Design e o post no calendário. Quando a peça nasceu de um post planejado, ela
entra **no mesmo cartão** do calendário: mesmo código e mesma data do post planejado, e o cartão passa a ter a arte.

## Exceções ao runner

- **Script sem estação:** o runner roda os comandos inline, sempre com `--empresa <codigo do run>`.
- Os dois JSON de entrada vão para a pasta do run (`saida/peca.json` e `saida/post.json`), escritos com a ferramenta de
  arquivo; nada é gravado à mão nos dados dos painéis.
- Código `1` do `registrar.js` (conteúdo inválido): mostre os erros, corrija o JSON e rode de novo, no máximo 2 vezes.

## Contexto a carregar

- `saida/entrega.md`: a pasta e os arquivos entregues
- `saida/pedido.md`: `origem`, `post_id`, `data`, `tipo_peca`, `tema`, `estilo`, `estilo_origem`
- `saida/copy-aprovada.md`: o título da capa, o texto de cada imagem e a legenda
- num post planejado: o post atual, achado pelo `post_id` no `posts.json` da pasta `cronograma` da empresa

## Instruções

1. Os caminhos que vão nos JSON são relativos à pasta da Fábrica, com `/` (sem a parte da pasta da Fábrica): a prévia
   é `<saidas>/<run_id>/pecas/preview.html` e a entrega é `<saidas>/<run_id>/pecas/entrega`.
2. Escreva `saida/peca.json`:
   `{ "id": "<run_id>", "name": "<tema>", "path": "<caminho da prévia>", "tipo": "carrossel" | "post",
   "desc": "<tema>", "postId": "<o id do post: o post_id do pedido no post planejado; o run_id na ideia nova>",
   "pasta": "<caminho da entrega>", "estilo": "<estilo do pedido>" }` (estilo próprio da empresa:
   `{ "id": "<id>", "origem": "proprio" }`).
3. Rode `node _fabrica/paineis/registrar.js peca saida/peca.json --empresa <codigo do run>` (com o caminho traduzido).
4. Escreva `saida/post.json`:
   - **Post planejado** (`origem: planejado`): parta do post atual do calendário (o objeto inteiro) e troque só `tipo`,
     `platformLabel` ("Instagram · Carrossel" ou "Instagram · Post"), `hook` (o título da capa, sem os asteriscos),
     `caption` (a legenda aprovada), `script` (o texto das imagens, uma linha por imagem), `previewUrl` (o caminho da
     prévia) e `images` (as imagens da entrega). O `id` continua o `post_id` e a `date` continua a `data` do plano: o
     registro atualiza o mesmo cartão, sem criar outro.
   - **Ideia nova:** `{ "id": "<run_id>", "date": "<data do pedido>", "platform": "insta", "platformLabel": "...",
     "tipo": "carrossel" | "post", "title": "<tema>", "hook": "...", "caption": "...", "script": "...",
     "previewUrl": "...", "images": [...] }`.
5. Rode `node _fabrica/paineis/registrar.js post saida/post.json --empresa <codigo do run>`.
6. Grave `saida/registro.md` com as duas respostas e diga à pessoa (L-05): onde estão as imagens e a legenda (o link da
   pasta de entrega), que a peça está no Laboratório e no calendário em <data> (num post planejado: "o cartão de <data>
   do seu calendário agora tem a arte") e como abrir (o `comoAcessar` da resposta). Na ideia nova sem data dita, avise
   que ela entrou com a data de hoje e que basta pedir para mudar.

## Formato

```markdown
# Registro

- laboratorio: ok | erro (<mensagem>)
- cronograma: ok | erro (<mensagem>)
- cartao: mesmo cartão do plano (<post_id>) | novo (<run_id>)
- data_no_cronograma: <AAAA-MM-DD>
- como_acessar: <caminho devolvido>
```

Caso aprovado (post planejado):

```markdown
# Registro

- laboratorio: ok (Feita no estilo escolhido)
- cronograma: ok
- cartao: mesmo cartão do plano (plano-2026-11-23-101500-03)
- data_no_cronograma: 2026-12-04
- como_acessar: abra o atalho "Abrir Laboratório de Design"
```

Caso com erro:

```markdown
# Registro

- laboratorio: ok
- cronograma: erro (date: obrigatória, no formato AAAA-MM-DD)
- acao: data corrigida no post.json e registro refeito
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Registro sem `--empresa`, ou com caminho de outra empresa.
2. Num post planejado, `id` ou `date` diferente do post planejado (criaria um cartão novo e deixaria o planejado sem
   arte).
3. Post planejado regravado sem os campos que a peça não muda (o título e o que mais o plano trazia).

## Critérios de qualidade

- [ ] A peça aparece no Laboratório com o estilo usado e ligada ao post (`postId`).
- [ ] O post está no calendário na data certa, com legenda, texto das imagens e imagens.
- [ ] Num post planejado, o `posts.json` não ganhou post novo: o cartão do plano foi atualizado.
- [ ] A fala final diz onde estão as imagens e a legenda e como abrir o calendário.
