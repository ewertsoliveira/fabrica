---
tipo: checkpoint
saida: saida/aprovacao-final.md
---

# Passo 8: Aprovação final

A revisão devolveu o veredito em `saida/revisao.md` e a estação de edição entregou o vídeo em `saida/entrega.md`
(ambos na pasta de saídas da empresa ativa). Este é o último passo antes de considerar o Reels pronto.

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra `saidas` (a pasta dos
`saida/...`), `memoria` (`runs.md`, `memories.md`) e `dadosLinha` (`preferencias-aprovadas.md`,
`biblioteca-de-modelos.md`) da empresa.

**Conferência antes da entrega:** antes de apresentar o vídeo final, a conferência entre empresas roda sobre a pasta do
run e sobre `08-FERRAMENTAS/tesseract/projetos/<NN>` (o `NN` está no `material.md`), como manda o runner. Sem as duas
limpas, nada é apresentado como entrega.

## O que apresentar

1. O veredito da revisão em uma linha (APROVAR ou APROVAR COM RESSALVAS) e as ressalvas, se houver.
2. O caminho do vídeo final e do relatório `conferencia.md`.
3. As medidas: duração, loudness, pico.
4. As pendências: dados ilustrativos, peças a validar.

## Perguntar

**O Reels está aprovado?**

1. Sim, aprovado. O run é registrado no `runs.md` (pasta `memoria` da empresa ativa) e a biblioteca é atualizada se houve preferência nova.
2. Preciso de um ajuste. O responsável diz o que muda; o pedido volta à etapa responsável (passo 6 para execução,
   **continuando a mesma estação**; passo 3 para mudança de plano, com a estrutura do passo 4 refeita) e a revisão se repete.
3. Quero outra versão com outro modelo, camada ou transição. Volta ao passo 1 (modelo ou camada) ou ao passo 3 (transição).

## Ao aprovar

1. Atualizar o `runs.md` (pasta `memoria` da empresa ativa) com data, tema, caminho do MP4 e resultado.
2. Registrar no `memories.md` (pasta `memoria`) e no `preferencias-aprovadas.md` (pasta `dadosLinha`), ambos da empresa ativa, qualquer preferência nova expressada.
3. Se foi usado um modelo novo e o vídeo foi aprovado, perguntar se ele entra na biblioteca (`biblioteca-de-modelos.md`, pasta `dadosLinha` da empresa ativa).

## Formato da resposta a salvar

```
# Aprovação final

**Vídeo:** {nome} | **Versão:** {vN}
**Resultado:** {aprovado | ajuste pedido | nova versão}
**Ajustes pedidos:** {lista ou "nenhum"}
**Preferências novas:** {lista ou "nenhuma"}
**Data:** {AAAA-MM-DD}
```
