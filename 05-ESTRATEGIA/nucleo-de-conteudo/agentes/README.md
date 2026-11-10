# Agentes: papéis das peças de feed

Três papéis para post estático, carrossel, fixados e capa de reels. Nenhum nome de pessoa, nenhuma empresa, nenhum
setor. Ao montar uma linha, o Arquiteto dá a cada papel um nome de estação (opcional, só ergonomia), declara na estação
`**Papel do Núcleo:** <arquivo do papel>` (o runner carrega o arquivo junto, e a estação não repete nada dele) e o liga ao
`marca.yaml` e ao estilo da empresa. **O papel não muda.**

| Papel | Arquivo | Execução | Entrega |
|---|---|---|---|
| Copywriter de feed | `copywriter-de-feed.agent.md` | subagente | Copy congelada das lâminas e legenda |
| Designer visual | `designer-visual.agent.md` | inline | Lâminas renderizadas e preview |
| Revisor de qualidade | `revisor-de-qualidade.agent.md` | inline | Veredito com justificativa |

O designer e o revisor rodam **inline** porque mostram peça e pedem decisão ao responsável. O copywriter pode rodar como
subagente: ele recebe um plano e devolve texto.

---

## Cadeia de repasse

```
plano aprovado → Copywriter de feed → [copy congelada] → Designer visual → [layout congelado] → Revisor de qualidade
                                                                                                   ↓
                                                                             APROVAR → revisão do responsável (L-06)
                                                                             REJEITAR → volta só ao papel que falhou
```

## Contratos de congelamento

Um repasse congela alguma coisa. Quem recebe **não pode** descongelar.

| Repasse | O que congela |
|---|---|
| Copywriter → Designer | O formato do carrossel (F-22), a intenção da chamada, o verbo de ação e o **texto bruto exato** de cada lâmina, com a contagem de caracteres (C-25). O designer não altera, corta nem quebra a copy em mais lâminas (C-21). |
| Designer → Revisor | O estilo aplicado (`estilo.yaml`), o layout absoluto de cada lâmina, o tamanho dos assets e a escala renderizada. O revisor não redesenha: aponta e devolve. |

Quebra de contrato é falha de processo, não divergência criativa. Quem discorda **para e escala** ao responsável; não
contorna.

## Arbitragem

O revisor é o árbitro entre copywriter e designer:
- O copywriter acusa o designer de mutilar a copy: o revisor decide por C-21.
- O designer acusa o copywriter de escrever copy que não cabe: o revisor decide por C-22 e DG-02.

Rejeição volta **só** ao papel que falhou, nunca reinicia o ciclo. Depois de 3 ciclos com o mesmo problema, o revisor
escala ao responsável em vez de rejeitar de novo.

## O estilo manda na composição

O estilo escolhido (`04-LABORATORIO-DE-DESIGN/estilos/<id>/estilo.yaml`) declara o que varia de um estilo para outro:
molde do miolo (rodízio ou fixo, DG-10), alinhamento (DG-06), sequência de fundos (DG-15) e navegação (barra, arraste e
contador, F-26). Os três papéis leem o estilo antes de trabalhar; nenhum deles decide essas quatro coisas por gosto.

## Regras que todo papel carrega

- A regra vive no arquivo, não na conversa: confira a regra escrita antes de agir.
- Diante de conflito entre regras, ou entre regra e pedido, **pare e escale**; não contorne.
- Toda regra conferível tem um teste que reprova (G-13).
- De referência externa, só a geometria (I-04): nunca foto, frase, tema, paleta ou grafismo de terceiro.
