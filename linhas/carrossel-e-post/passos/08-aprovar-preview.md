---
tipo: checkpoint
saida: saida/preview-aprovado.md
---

# Passo 8: Aprovar a prévia

O último sim antes da entrega. A pessoa decide **olhando** a peça como ela vai aparecer no Instagram, nunca lendo uma
descrição.

## Fala de abertura

Diga nas suas palavras, sem nome interno (L-01): "A peça está pronta. Abri uma prévia que mostra como ela vai aparecer
no Instagram: no carrossel, dá para passar as imagens para o lado, como no celular. Se estiver tudo certo, eu separo
as imagens e a legenda prontas para você postar."

## O que apresentar

1. **Abra** `<saidas>/<run_id>/pecas/preview.html` no navegador da pessoa e dê o caminho clicável.
2. Diga em uma frase o que a peça está usando: as cores e letras da identidade, ou as cores originais do estilo (L-04).
3. Resuma em linguagem simples a conferência automática (`saida/conferencia.txt`) e o parecer da revisão
   (`saida/revisao.md`), com as observações para a pessoa.
4. Lembre os dados entre colchetes que continuam abertos: a peça só deve ir ao ar depois de preenchidos.

## Perguntar (`AskUserQuestion`)

Com a prévia já aberta, ponha o caminho dela no texto da pergunta (D-01).

"A peça está aprovada para entregar?"
- **Aprovar e entregar**: separa as imagens e a legenda prontas para postar (ex.: "pronto para postar").
- **Ajustar o texto**: volta ao texto.
- **Ajustar o visual**: volta ao design.

## Tabela

| O que a pessoa vê | Sim | Ajuste |
|---|---|---|
| `preview.html` aberto, o relatório da conferência e `miniaturas-100px.png` | segue para a entrega | texto: passo `copy`; visual: passo `design` |

## Formato da resposta a salvar (`saida/preview-aprovado.md`)

```markdown
# Prévia aprovada

- aprovado_em: <AAAA-MM-DD HH:MM>
- preview: <caminho do preview.html>
- lacunas_abertas: <lista, ou "nenhuma">
- observacoes: <o que a pessoa disse, ou "nenhuma">
```

## Ao terminar (L-05)

"Aprovado. Agora eu separo as imagens e a legenda e ponho a peça no Laboratório e no seu calendário."
