---
tipo: checkpoint
saida: saida/primeira-aprovada.md
---

# Passo 5: Aprovar a primeira imagem

A primeira imagem mostra o estilo, as cores e o tamanho do texto. Aprovar aqui evita montar a peça inteira para
descobrir um problema na capa (DG-18).

## Fala de abertura

Diga nas suas palavras, sem nome interno (L-01): "Esta é a primeira imagem, a capa, que é o que as pessoas veem antes de
passar para o lado (no post, é a imagem inteira). Vendo ela, você já sabe como vai ficar o resto: o mesmo desenho, as
mesmas cores. Se estiver bom, eu monto as outras."

## O que apresentar

1. **Abra** `<saidas>/<run_id>/pecas/lamina-01.png` no navegador da pessoa e dê o caminho clicável.
2. Diga em uma frase o que a imagem está usando, como foi escolhido no pedido: "esta imagem já está com as suas cores e
   letras, no seu estilo" ou "esta está com as cores originais do estilo escolhido" (L-04).
3. Se faltou foto, diga qual foto da empresa melhoraria a imagem (a `descricao` do visual).

## Perguntar (`AskUserQuestion`)

Com a imagem já aberta, ponha o caminho dela no texto da pergunta (D-01).

"A primeira imagem está aprovada?"
- **Aprovar**: monta as outras imagens (ex.: "capa legível, cores certas").
- **Ajustar o visual**: volta ao design com o que mudar (ex.: "troque o desenho da capa por uma lista").
- **Ajustar o texto**: volta ao texto (ele está congelado; só muda com uma nova aprovação do texto).

## Tabela

| O que a pessoa vê | Sim | Ajuste |
|---|---|---|
| `lamina-01.png` aberta | segue para o resto | volta ao passo `design` |

## Formato da resposta a salvar (`saida/primeira-aprovada.md`)

```markdown
# Primeira imagem aprovada

- aprovado_em: <AAAA-MM-DD HH:MM>
- arquivo: <caminho da lamina-01.png>
- estilo: <id>
- cores: marca | original
- observacoes: <o que a pessoa disse, ou "nenhuma">
```

## Ao terminar (L-05)

No carrossel: "Capa aprovada. Agora eu monto as outras imagens e confiro tudo sozinho (letras, contraste, se nada ficou
escondido); depois você vê a peça inteira." No post: "Imagem aprovada. Agora eu confiro tudo e monto a prévia do post
como vai aparecer no Instagram."
