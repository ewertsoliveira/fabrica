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
8. **A prévia é a peça pronta, não a matéria-prima.** Cada opção aparece **já aplicada à peça final**: a escolha da
   imagem da capa mostra a capa montada com cada imagem (com o título, o véu e a marca); a escolha de foto de uma lâmina
   mostra a lâmina com cada foto; a de cor mostra a peça em cada cor. **Não vale como prévia:** uma prancha de quadros
   soltos do vídeo, uma pasta ou lista de fotos, nomes de arquivo, uma amostra de cor isolada ou uma descrição ("sorriso,
   olhar na câmera"). Sem o texto final ainda, use o do roteiro como provisório e diga isso.
9. **Toda opção tem a sua versão pronta.** Nenhuma opção visual entra na pergunta só descrita (ex.: "Foto de estúdio"
   sem a capa montada com ela). Se não dá para montar uma opção, ela não é oferecida.
10. **Vale em qualquer ponto da Fábrica**, também nas perguntas de entrada (pedido, escolha de fotos, de quadro do vídeo,
    de imagem de capa, de identidade visual), na revisão e na entrega, e em linha criada pela empresa. Não existe passo
    em que uma escolha de aparência possa ir por texto.
11. **A pergunta cita a prévia e vem sozinha.** A prévia é aberta no navegador da pessoa **antes** da pergunta (a janela
    de perguntas cobre a conversa). O texto da pergunta traz o caminho do arquivo ou o endereço do painel, e as opções
    usam as mesmas letras escritas na prévia ("A · quadro 20 do vídeo"). A pergunta visual vai numa chamada própria,
    sem perguntas de texto junto.

**Trava automática:** o gancho `_fabrica/core/guarda-visual.js` (ligado em `.claude/settings.json`) roda antes de cada
pergunta estruturada e **bloqueia** a que fala de aparência (capa, imagem, foto, quadro, cor, letra, logo, layout,
lâmina, arte, estilo, identidade) sem citar uma prévia que existe. Pergunta que não escolhe nada de aparência e caiu na
trava por uma palavra é refeita com `metadata.source: "fabrica:nao-visual"`; isso nunca vale para escolha visual. A
trava não substitui a regra: citar a prancha de quadros soltos passa por ela e continua reprovado (item 8).

**Como gerar:** `node _fabrica/core/visual.js paletas|tipografias|quadro <entrada.json>`. Para peça que o gerador não
cobre (capa, layout, modelo de vídeo, foto numa lâmina), produza a própria peça com cada opção pelo gerador de verdade
(ex.: `08-FERRAMENTAS/carrossel/gerar.js` com `--formato reels` para a capa, uma vez por imagem candidata), junte as
versões lado a lado numa imagem ou página com as letras escritas, abra e apresente o caminho.

**Exceção:** pergunta que não é visual (nome, prazo, idioma, data de publicação, qual roteiro) segue em texto. Na
dúvida, é visual.

Reprovou em qualquer item: a proposta volta, com a prévia, antes de o responsável ser consultado.

## D-02 — Tom de uma proposta visual
A prévia usa o conteúdo da própria empresa quando existir (nome, conta, uma frase real). Sem conteúdo, usa exemplo
neutro e declara que é exemplo. Nunca usa nome, cor ou marca de outra empresa.
