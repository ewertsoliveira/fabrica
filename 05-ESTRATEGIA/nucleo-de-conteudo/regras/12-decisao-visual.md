# 12 — Decisão visual

Regras sobre como o design é proposto e decidido. Valem para o Arquiteto, para todas as estações e para a skill
`fabrica`, em qualquer empresa.

---

## D-01 — Decisão visual é mostrada, nunca só descrita
Toda proposta que o responsável precisa **olhar para decidir** (paleta, tipografia, logo, layout de peça, capa, estilo de
vídeo, modelo de edição, quadro de marca) vem **acompanhada de uma representação visual que ele consegue abrir**. Texto
descreve; o visual decide.

1. **Nada de escolha só por texto.** Proposta sem representação visual não é apresentada como pergunta. Gere a prévia
   primeiro, depois pergunte.
2. **A prévia vem junto, no mesmo turno.** A mensagem que oferece as opções traz o endereço do arquivo (o caminho
   clicável e, se houver, o endereço `file://`). Não "vou gerar depois".
3. **Mostrar em uso, não em abstrato.** Cor aparece aplicada numa peça (título, botão, rótulo), não só como amostra;
   fonte aparece em título, texto e rótulo; layout aparece com conteúdo de exemplo.
4. **Opções lado a lado, com letra.** De 2 a 4 opções na mesma página, identificadas por A, B, C, para escolher por
   letra. Cada uma com um nome curto e uma frase do que a distingue.
5. **O texto que acompanha é curto.** Uma linha por opção. A explicação longa não substitui a imagem.
6. **Medida que o olho não vê vem escrita.** Contraste, legibilidade e tamanho mínimo aparecem junto da prévia (razão de
   contraste e nível).
7. **Nada é gravado antes da escolha.** A prévia não altera `marca.yaml` nem `decisoes.md`: só a escolha explícita do
   responsável grava.

**Como gerar:** `node _fabrica/core/visual.js paletas|tipografias|quadro <entrada.json>`. Para peça que o gerador não
cobre (capa, layout, modelo de vídeo), produza o arquivo visual da própria peça (HTML ou imagem) e apresente o caminho.

**Exceção:** pergunta que não é visual (nome, prazo, idioma) segue em texto.

Reprovou em qualquer item: a proposta volta, com a prévia, antes de o responsável ser consultado.

## D-02 — Tom de uma proposta visual
A prévia usa o conteúdo da própria empresa quando existir (nome, conta, uma frase real). Sem conteúdo, usa exemplo
neutro e declara que é exemplo. Nunca usa nome, cor ou marca de outra empresa.
