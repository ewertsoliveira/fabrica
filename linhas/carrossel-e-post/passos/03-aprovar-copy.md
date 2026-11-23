---
tipo: checkpoint
saida: saida/copy-aprovada.md
---

# Passo 3: Aprovar o texto

Depois deste sim o texto fica **congelado** (C-21): o design só transcreve. Aprovar o texto antes de montar as imagens
evita refazer a peça inteira por causa de uma frase.

## Fala de abertura

Diga nas suas palavras, sem nome interno (L-01): "Antes de montar qualquer imagem, quero que você leia o texto. Ele é o
que vai escrito em cada imagem e na legenda do post. Depois que você aprovar, eu só monto: não mudo mais nenhuma
palavra sem você pedir."

## O que apresentar

Abra `saida/copy.md` para a pessoa (o caminho clicável) e mostre, em linguagem simples:

1. Imagem por imagem: o título e o texto de cada uma, na ordem em que a pessoa vai ver ao passar para o lado (no post,
   a imagem única). Diga "título pequeno no alto" para o kicker e "imagem de capa" e "última imagem" para capa e fecho.
2. A legenda, que é o texto que vai junto do post no Instagram.
3. O tom usado ("escrevi num tom educativo, explicando sem complicar") e de onde ele veio.
4. Os avisos: imagens que não couberam (com a divisão sugerida), legenda ajustada e dados que a empresa ainda precisa
   informar, entre colchetes.
5. Num post planejado, uma frase dizendo que o texto partiu do roteiro do calendário, com a mesma ideia.

## Perguntar (`AskUserQuestion`)

"O texto está aprovado?" (explique: aprovando, eu monto a primeira imagem para você ver antes do resto)
- **Aprovar**: segue para a primeira imagem (ex.: "o texto está claro e diz o que eu queria").
- **Mudar alguma frase**: a pessoa diz o que mudar; volta ao texto com o pedido dela (ex.: "troque o título da capa").
- **Mudar o tom**: volta ao texto com o tom escolhido entre os de `dados/tom-de-voz.md` (ex.: "mais descontraído").

Com imagem que não coube, pergunte antes qual divisão vale (2 ou 3 opções, com o texto de cada uma).

## Tabela

| O que a pessoa vê | Sim | Ajuste |
|---|---|---|
| o texto, imagem por imagem, e a legenda | segue para o design | volta ao passo `copy` |

## Formato da resposta a salvar (`saida/copy-aprovada.md`)

```markdown
# Texto aprovado

- aprovado_em: <AAAA-MM-DD HH:MM>
- decisao: aprovar
- divisoes_escolhidas: <imagem e opção, ou "nenhuma">
- legenda_ajustada_aprovada: sim | não se aplica

<cópia integral do copy.md aprovado>
```

## Ao terminar (L-05)

"Texto aprovado. Agora eu monto a primeira imagem no seu estilo, para você ver antes do resto."
