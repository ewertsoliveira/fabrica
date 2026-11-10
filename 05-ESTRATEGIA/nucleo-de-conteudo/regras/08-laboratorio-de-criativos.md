# 08 — Laboratório de Criativos

Como uma peça gráfica é apresentada, revisada e aprovada antes de virar arquivo final.

> **Estado na Fábrica:** o painel central do Laboratório ainda não existe. Até ele existir, o "painel" de cada peça é
> o **preview unificado** que a linha de produção entrega (L-08), com o caminho clicável na mensagem. As regras abaixo
> valem para esse preview; quando o painel existir, valem para ele.

---

## L-01 — Toda peça gráfica é apresentada no preview
Qualquer peça gráfica nova (capa, carrossel, post, story, mockup) é apresentada ao responsável num preview que ele
consegue abrir. **Salvar o arquivo em disco não basta:** se ele não foi apresentado, a tarefa não está feita.

## L-02 — Vale para exploração, não só para peça final
A regra cobre exploração de formato, comparativo entre versões e mockup de teste, não apenas peça finalizada. Entregar
variação "por fora", como arquivo solto, é falha de processo.

## L-03 — Um preview por peça, nunca um item por slide
Peça de vários slides entra como **um único preview navegável** (arrastar, setas, indicadores), nunca como arquivos
separados, um por slide. Várias opções de um mesmo post também vão no mesmo preview.

## L-04 — Mais recente primeiro
Quando há uma lista de peças, a mais recente fica no topo, sem precisar ser pedido.

## L-05 — Descrição reflete o estado atual
A descrição de cada peça diz o que ela é **hoje**. Ao evoluir uma peça, atualizar a descrição; nunca deixar "em
teste" ou informação vencida.

## L-06 — Revisão antes do export
1. Gerar o preview navegável e os arquivos individuais.
2. Apresentar e perguntar: *"quais peças precisam de ajuste antes de exportar?"*
3. Corrigir **apenas** os arquivos citados; nunca regerar o conjunto inteiro, salvo mudança de direção fundamental.
4. Exportar somente após confirmação explícita.

## L-07 — Nunca pular para o export
Export sem aprovação registrada é retrabalho garantido.

## L-08 — Preview em simulador da rede
O preview de carrossel ou post reproduz a rede de destino (por exemplo, o feed do Instagram), com slider arrastável,
setas e a área segura visível. É assim que o responsável aprova: vendo a peça como o público vai ver.

## L-09 — Entrega final organizada
A peça aprovada vai para a pasta `saida/` da linha, numa pasta por peça, com na frente só o que vai ao ar (as imagens
em PNG e o `legenda.txt`). Rascunhos, HTML e versões ficam numa subpasta `_fonte/`.

---

## Estrutura de um índice de peças

Quando houver um painel, ele é um índice que lê uma lista de entradas. Cada entrada declara:

| Campo | Conteúdo |
|---|---|
| identificador | ordem ou código da entrada |
| caminho | caminho relativo para o `preview.html` da peça |
| nome | nome legível da peça |
| descrição | o que é, em que estado está, o que se espera decidir |
| tipo de visualização | peça única ou preview navegável de vários slides |

Numa operação com várias empresas, o painel lê o **manifesto da empresa ativa**, nunca uma lista fixa embutida no
código: lista embutida é o primeiro ponto de vazamento quando se replica a operação.

## Como se confere

L-03 e L-08 (um único preview por carrossel, com simulador) e L-09 (estrutura da pasta de saída) são conferidas pelo
gerador de carrossel. L-06 e L-07 são checkpoints da linha de produção: a linha não exporta sem a aprovação gravada.
