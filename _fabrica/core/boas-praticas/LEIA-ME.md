# Guias de boas práticas

Vinte e dois guias de conhecimento de disciplina e de plataforma, mais o catálogo `_catalogo.yaml`. O Arquiteto os
consulta ao desenhar uma linha, e o runner injeta o guia do `formato:` do passo no contexto da estação.

**Origem:** herdados do OpenSquad (Renato Asse, MIT; ver `NOTICE.md`). Estão em inglês: as saídas para o responsável
continuam saindo no idioma dele. A partir daqui a Fábrica os mantém por conta própria: mudanças são decisões da
Fábrica, e nenhuma atualização do OpenSquad entra sem pedido.

## Posição na hierarquia

**Referência, abaixo do Núcleo.** São o item 5 da hierarquia do `CORE.md` (insumo, nunca norma):

1. restrição do setor (`setor/`)
2. regras do Núcleo (`regras/`)
3. decisão de marca da empresa (o `decisoes.md` da empresa ativa)
4. parâmetro (o `marca.yaml` da empresa ativa)
5. **guias de boas práticas** e outras referências externas

O runner avisa isso à estação quando injeta um guia. Em conflito, **vale a regra de cima**, sem discussão.

## Tensões conhecidas

Levantamento por busca de termos nos guias, **não leitura completa**. Pontos em que um guia sugere o que uma regra da
Fábrica proíbe ou limita:

| Guia sugere | Regra que vence |
|---|---|
| fechar vídeo pedindo "seguir, comentar, compartilhar" (guias de Reels, Shorts e vídeo) | CTA único por peça (`regras-de-cta.md`, nos dados da linha de Reels; regras do Núcleo) |
| "link na bio" como saída para o link (`twitter-post.md`) | "link na bio" não funciona em vídeo e o conferidor reprova |
| áudio em alta, frequência de postagem, número de hashtags | decisão da empresa (o `decisoes.md` dela), não regra do guia |
| promessa de resultado, números de crescimento, comparação com concorrentes | restrição do setor, quando houver |
| travessão como pontuação em texto de saída | regra de estilo da empresa, quando ela proíbe |

Os guias também trazem **exemplos ilustrativos** (cores, fontes, endereços e contas de exemplo): são dados de
demonstração, não identidade de empresa, e estão isentos no validador anti-vazamento por esse motivo.

## Como usar

- **Ao criar uma linha:** o Arquiteto lê `_catalogo.yaml` (campo `quandoUsar`) e abre só os guias relevantes.
- **Ao executar:** `formato: instagram-reels` num passo injeta `instagram-reels.md`. Sem o campo, nada é injetado.
- **Ao adaptar um guia à empresa:** não edite o guia. Registre a diferença no `decisoes.md` da empresa ativa (caminho `decisoes` em `node _fabrica/core/empresa.js caminhos`; camada de decisão de marca),
  que vence o guia. Edite o guia só para corrigir erro ou melhorar para qualquer empresa.
- **Ao acrescentar um guia novo:** crie o arquivo com o frontmatter dos existentes (`name`, `description`, `whenToUse`),
  acrescente a entrada no catálogo e rode o validador anti-vazamento.
