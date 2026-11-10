# Etapa 6: modelos de vídeo com a paleta e as letras da marca — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** os 27 modelos de Reels aceitam a marca da empresa: a paleta completa (escuro, claro, acento, neutro) e as letras
(principal, mono e, se houver, a de destaque). O destaque continua sendo o tratamento do estilo (itálico, tarja, pílula,
sublinhado). Sem marca no pedido, cada modelo sai exatamente como hoje, com as cores e as letras originais do estilo.

**Arquitetura:**
- Um módulo novo, `08-FERRAMENTAS/tesseract/modelos/tema-marca.js`, resolve a marca uma vez: do próprio pedido
  (`pedido.marca = { cores, fontes }`, usado pelas prévias e pelos testes) ou, com `usarMarca: true`, do `marca.yaml` da empresa
  ativa (pelo leitor `marca.js`). O `montar.js` entrega o resultado aos modelos como `ctx.marca`.
- Cada modelo troca as suas cores e letras pelas da marca **por papel**, com um mapa curto no próprio arquivo. A base
  `_inverso.js` faz isso para os 12 modelos que são declarações sobre ela; os 15 restantes têm código próprio e ganham o mapa
  um a um.
- Regra da letra de destaque: se o estilo destaca em itálico e a letra principal da marca não tem itálico, o destaque usa a
  letra de destaque do próprio estilo (ou a terceira voz da marca, se existir). Isso fica anotado no README.

**Tecnologia:** Node (módulos nativos), o `tsrct` e o ffmpeg já usados pelos modelos, testes em scripts `node` com `assert`.

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 10 e 12 (etapa 6).

## Restrições globais

- **Sem marca no pedido, o vídeo não muda:** os 27 modelos produzem as mesmas cores e letras de hoje (teste por comparação de
  quadros, tolerância de compressão).
- **Regras de vídeo continuam valendo com qualquer marca:** a pessoa nunca sai de cena quando a imagem entra, o rosto fica
  inteiro e visível, nada sobre o rosto, vídeo limpo, troca de quadro com pelo menos 4 s. Letra maior ou menor não pode empurrar
  texto para cima do rosto nem para fora da tela.
- **Texto sempre legível:** com qualquer paleta, o texto claro sobre fundo escuro e o escuro sobre claro mantêm contraste AA
  (3:1 no mínimo para texto grande). Quando a paleta da marca não permite (por exemplo, claro e escuro quase iguais), o modelo usa
  o par original do estilo para o texto e avisa no log.
- **A marca nunca sai do computador da empresa:** nada de marca de empresa em arquivo da matriz; testes só com marcas
  fictícias (`aurora` quente e `boreal` fria, definidas dentro do teste). Letras só as OFL de `modelos/fontes/`.
- **Antes de cada commit:** o validador anti-vazamento (com a lista privada) e `node _fabrica/core/conferir-caminhos.js` saem `0`.
- **Git:** sem `push`, `pull`, `merge`, `reset` ou `stash`. Commit local por tarefa, no ramo `biblioteca`.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit.
- **Nunca citar** o nome do responsável nem o da empresa de referência na matriz. O validador acusa conta com @, cor em hex e
  dia da semana em arquivo que não é de estilo: registrar isenção com motivo quando for fictício.
- Os vídeos e imagens de pessoa real (o vídeo de demonstração) ficam fora do git; as provas visuais ficam na pasta de trabalho.

## Foco da revisão

1. **Marca com fonte sem itálico, sem negrito ou só de um peso:** o modelo escolhe o peso mais próximo e o título não quebra o
   layout (nenhum texto fora da tela nem sobre o rosto).
2. **Paleta com claro e escuro quase iguais ou com acento igual ao fundo:** texto continua legível.
3. **Palavra longa no título e na tela final** com letra larga (geométrica, de corpo largo): encolhe até caber, como o Neon já faz.
4. **`usarMarca` sem `marca.yaml` da empresa:** cai na marca de exemplo e avisa, nunca quebra.
5. **Duas empresas em seguida na mesma máquina:** a marca de uma não aparece no vídeo da outra (o módulo não guarda estado entre
   pedidos).

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `08-FERRAMENTAS/tesseract/modelos/tema-marca.js` (novo, + teste) | resolve a marca do pedido ou do `marca.yaml`; papéis, letras e pesos |
| `08-FERRAMENTAS/tesseract/modelos/montar.js` | entrega `ctx.marca` aos modelos |
| `estilos/_inverso.js` e as 12 declarações sobre ela | paleta e letras por papel |
| `estilos/concreto-acido.js`, `luz-de-vela.js` | mapa próprio |
| os 13 modelos antigos em `estilos/` | mapa próprio por modelo |
| `08-FERRAMENTAS/tesseract/modelos/README.md` | campo `marca` do pedido, regra da letra de destaque |
| `provar-marca.js` (na pasta de trabalho, fora do repositório) | prova visual com duas marcas fictícias |

---

### Tarefa 1: o tema da marca e a base `_inverso`

**Arquivos:** `08-FERRAMENTAS/tesseract/modelos/tema-marca.js`, `tema-marca.test.js`, `montar.js`, `estilos/_inverso.js`,
`modelos/README.md`.

**Interfaces produzidas:**
- `temaMarca.resolver(pedido, { marcaMod }) -> null | { cores: {escuro, claro, acento, neutro} (hex), fontes: { principal,
  mono, acento? } (caminho absoluto de .ttf/.otf), origem: 'pedido' | 'marca' }`:
  - `pedido.marca = { cores?, fontes? }`: usa o que veio e completa o resto com o papel original do modelo (não com a marca
    do `marca.yaml`);
  - `pedido.usarMarca === true` sem `pedido.marca.cores/fontes`: lê o `marca.yaml` pelo `marca.js` (`cores.*` e
    `tipografia.principal.arquivo`, `tipografia.mono.arquivo`, `tipografia.acento.arquivo` se houver);
  - sem nenhum dos dois: `null` (o modelo usa as cores e letras originais);
  - hex inválido ou arquivo de letra inexistente: erro claro em português, citando o papel.
- `temaMarca.cor(tema, papel, padrao)` e `temaMarca.fonte(tema, papel, padrao)`: devolvem o valor da marca se existir, senão o
  padrão do modelo.
- `temaMarca.contrasteOk(a, b, minimo = 3)`: razão de contraste WCAG entre dois hex.
- `ctx.marca` no `montar` de cada modelo é esse tema (ou `null`).
- `_inverso.js`: com `ctx.marca`, `def.cores.{escuro,claro,acento,neutro}` são trocadas pelos da marca; as letras `titulo` e
  `leg` usam `fontes.principal`, `rot` usa `fontes.mono`, `nota` usa `fontes.acento` se existir; `tituloDest` e `legDest` usam a
  principal **a menos que** o destaque do estilo seja itálico (`def.destaque === 'italico'`) e a letra principal não tenha
  itálico, caso em que mantêm a letra de destaque do estilo (ou `fontes.acento`). Peso: o peso pedido pelo modelo vira o mais
  próximo que o arquivo da marca tem. O texto que ficaria sem contraste (`contrasteOk` falso entre `corTexto` e o fundo) usa o
  par original do estilo e escreve um aviso no log.

**Testes (falham antes):**
- `tema-marca.test.js`: resolve do pedido; completa o que falta; `usarMarca` lê um `marca.yaml` temporário fictício; sem nada devolve
  `null`; hex inválido, arquivo de letra inexistente e papel desconhecido dão erro em português; `contrasteOk` com pares conhecidos;
  duas chamadas seguidas com marcas diferentes não vazam uma na outra.
- um teste do `_inverso` com uma declaração mínima: com marca, as cores e letras do tema chegam às camadas; sem marca, a saída
  é a de hoje (mesmos valores).

- [ ] **Passos:** testes primeiro (ver falhar), implementar, bateria, validador, `conferir-caminhos`, commit "Vídeo na marca,
  item 6.1: tema da marca e base dos modelos do caminho inverso".

---

### Tarefa 2: Concreto Ácido, Luz de Vela e prova visual dos 14 primeiros

**Arquivos:** `estilos/concreto-acido.js`, `estilos/luz-de-vela.js`, o que mais a prova mostrar.

**Interface produzida:** os 14 modelos que não são os 13 antigos (os 12 sobre `_inverso` e esses dois) aceitam `ctx.marca`.

**Prova visual** (script fora do repositório, `provar-marca.js`, na pasta de trabalho): marca fictícia **Aurora** (quente: letra
principal geométrica larga, mono de código, sem terceira voz) e **Boreal** (fria: letra principal serifada de destaque, mono
de máquina de escrever, com uma serifada com itálico como terceira voz), escolhidas entre as letras OFL de `modelos/fontes/`, sobre o vídeo de demonstração (`assets-fonte/videos/demonstracao.mp4` e `demonstracao-matte.mp4`, só locais):
quadros dos 14 modelos nas duas marcas e sem marca, em folhas de contato. Conferir olhando: pessoa em cena com a imagem, rosto
inteiro, texto legível e dentro da tela, destaque no tratamento do estilo, letra de destaque do estilo quando a marca não tem
itálico.

- [ ] **Passos:** mapas por papel nos dois modelos, prova visual, correções, bateria, validador, commit "Vídeo na marca, item
  6.2: Concreto Ácido, Luz de Vela e prova dos 14 modelos".

---

### Tarefa 3: os 13 modelos antigos, primeiro lote (Vitrine, Recorte, Neon, Cinema, Impacto, Caderno, Visor)

**Arquivos:** `estilos/vitrine.js`, `recorte.js`, `neon.js`, `cinema.js`, `impacto.js`, `caderno.js`, `visor.js`.

**Como:** cada modelo ganha, no topo do `montar`, um mapa dos papéis que usa (`acento`, `escuro`, `claro`, `neutro` e o que for
fixo hoje, como o branco ou o preto, que **não** viram cor da marca) e das letras (principal, mono e destaque), usando
`temaMarca.cor` e `temaMarca.fonte` com o valor de hoje como padrão. Sem `ctx.marca`, nada muda. Cores de apoio que hoje são
tons do acento ou do escuro (por exemplo o brilho do Neon) derivam da cor da marca do papel correspondente.

- [ ] **Passos:** os mapas, prova visual dos 7 com as duas marcas e sem marca, correções, bateria, validador, commit "Vídeo na
  marca, item 6.3: Vitrine, Recorte, Neon, Cinema, Impacto, Caderno e Visor".

---

### Tarefa 4: os 13 modelos antigos, segundo lote (Bloco, Adesivo, Círculo, Retrô, Faixa, Palco)

**Arquivos:** `estilos/bloco.js`, `adesivo.js`, `circulo.js`, `retro.js`, `faixa.js`, `palco.js`.

Mesma forma da Tarefa 3, e as texturas que hoje têm cor fixa (papel quadriculado rosa do Adesivo, janela do Retrô, xadrez)
seguem a paleta: quando a textura é um PNG pronto de uma cor só, o modelo o tinge pelo acento da marca (efeito de matiz) ou usa a
versão sem cor com uma camada de cor por baixo; o que não der para tingir fica como está e a prova visual mostra.

- [ ] **Passos:** os mapas, prova visual, correções, bateria, validador, commit "Vídeo na marca, item 6.4: Bloco, Adesivo,
  Círculo, Retrô, Faixa e Palco".

---

### Tarefa 5: fechamento e página de prova

- [ ] **Passo 1:** `modelos/README.md`: campo `marca` do pedido (`{ cores, fontes }`), `usarMarca` com a marca da empresa, a regra da
  letra de destaque e o aviso de contraste.
- [ ] **Passo 2:** os 27 modelos com as duas marcas num só lote, uma folha de contato por modelo (sem marca, Aurora, Boreal), e uma
  página de prova (`provas-marca.html`, só local) para o responsável olhar; um teste automático percorre os 27 modelos com a
  marca Aurora e confere que nenhum falha ao montar e que o log de contraste não acusa texto ilegível.
- [ ] **Passo 3:** bateria completa, validador, `conferir-caminhos.js`, commit.

## Fora desta etapa

Prévias "na minha marca" no painel com a fila de vídeo (etapa 7), o agente executar pedidos (etapa 8), migração (etapa 9), e
estilos criados por referências da empresa.
