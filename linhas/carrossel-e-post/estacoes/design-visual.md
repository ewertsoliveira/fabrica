# Estação: Design Visual

**Papel do Núcleo:** `05-ESTRATEGIA/nucleo-de-conteudo/agentes/designer-visual.agent.md`
**Papel:** Monta o `conteudo.json` transcrevendo o texto aprovado, escolhe o layout de cada imagem pela forma e monta a
primeira imagem (no post, a única) no estilo e nas cores do pedido.
**Entradas:** `saida/copy-aprovada.md`, `saida/pedido.md` (tipo de peça, estilo, cores, fotos) e o estilo do catálogo
ou o estilo próprio da empresa.
**Saída:** `saida/conteudo.json` e a primeira imagem montada na pasta de peças do run.

## Particularidades desta linha

- **Estilo:** o do `pedido.md`. Sem estilo escolhido pela empresa, é o `carrossel.estilo` do `linha.yaml`, sóbrio e
  feito para funcionar sem foto.
- **Sem fotos da empresa:** cada imagem com visual usa mockup, número ou objeto do estilo, e a `descricao` do visual
  vira o pedido de foto ao responsável.
- **Post:** `"formato": "post"` no `conteudo.json` e `--formato post` no gerador, com uma imagem só.
