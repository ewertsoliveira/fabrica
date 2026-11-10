# Biblioteca de estilos: prévias

Esta pasta guarda as ferramentas da biblioteca de estilos (a vitrine em que a pessoa escolhe o estilo de uma peça).

## gerar-previas.js: prévias base em imagem

Monta as peças de demonstração de cada estilo (o carrossel, os 3 posts fixados e a capa de Reels) **nas cores originais do
estilo**, com a empresa de exemplo "Lia Exemplo". A marca da sua empresa nunca entra aqui: as prévias base mostram o estilo
como ele foi aprovado. (A prévia com a sua marca é outro passo: veja "Prévias na marca", abaixo.)

```
node 08-FERRAMENTAS/biblioteca/gerar-previas.js                       # os estilos todos
node 08-FERRAMENTAS/biblioteca/gerar-previas.js protagonista cartilha # só estes
node 08-FERRAMENTAS/biblioteca/gerar-previas.js --saida <pasta>       # outra pasta de saída
```

A saída padrão é `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/`. Em cada pasta ficam:

| Arquivo | O que é |
| --- | --- |
| `carrossel-01.webp` ... | as lâminas do `demo.json` |
| `fixado-apresentacao.webp`, `fixado-metodo.webp`, `fixado-contratar.webp` | os 3 posts fixados |
| `reels-capa.webp` | a capa de Reels |
| `previas.json` | a lista do que existe, com os nomes dos arquivos (sem caminho), a data, as cores (`sugestao`) e o peso em bytes |

No `previas.json`, o campo `capa` é o **nome de um arquivo que já existe** na pasta: a primeira lâmina do carrossel
(`carrossel-01.webp`) ou, nos estilos que só têm capa de Reels, `reels-capa.webp`. Não há cópia da capa (a versão antiga
guardava um `capa.webp` repetido; ele é apagado quando você roda de novo).

O estilo que não tem um formato (por exemplo a Primeira Página, que só tem capa de Reels) fica sem aqueles arquivos, e o
`previas.json` marca o formato ausente como vazio.

## Prévia em vídeo (`--video`)

Cada estilo também ganha um vídeo curto, feito a partir do **modelo de Reels** dele (`formatos.reels.modelo` do
`estilo.yaml`). O comando recebe o mesmo pedido que o `tesseract/modelos/montar.js` usa:

```
node 08-FERRAMENTAS/biblioteca/gerar-previas.js --video <pedido.json>                       # todos os estilos
node 08-FERRAMENTAS/biblioteca/gerar-previas.js protagonista --video <pedido.json>          # só este
node 08-FERRAMENTAS/biblioteca/gerar-previas.js --video <pedido.json> --reusar <pasta-dos-mp4>   # usa os MP4 que já existem
```

- O trecho tem **12 segundos**, começa 4,5 s antes da entrada do **primeiro B-roll** do pedido (`broll[0].ini`), ou antes,
  se o vídeo acabar cedo (assim aparecem o título, a legenda, a imagem com a pessoa e a volta da pessoa), tem 540 x 960,
  usa VP9 e **não tem som**. A capa `video-capa.webp` é o quadro do meio do trecho.
- Sem `--reusar`, o comando monta o MP4 de cada modelo com o `montar.js` (leva alguns minutos por estilo). Com `--reusar`,
  ele pega o `<modelo>.mp4` que já está na pasta indicada.
- O pedido sem B-roll dá erro: o trecho precisa de uma troca de quadro para começar.
- Só o comando de vídeo mexe em `video.webm` e `video-capa.webp`. Rodar as imagens de novo **não apaga** o vídeo e mantém
  o `video` e o `videoCapa` do `previas.json` enquanto os arquivos existirem.

### Quem pode entrar no repositório

O vídeo de uma pessoa real **nunca** entra no repositório sem a sua liberação:

| Pedido | Onde o vídeo é gravado |
| --- | --- |
| tem `"liberado": true` | `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/` (entra no repositório; o `previas.json` ganha `video` e `videoCapa`) |
| não tem (ou tem qualquer outro valor) | `04-LABORATORIO-DE-DESIGN/biblioteca/previas-locais/<estilo>/`, que o git ignora; o `previas.json` de lá diz `"local": true` |

A pasta `previas-locais/` é **sempre** a do repositório (ignorada pelo git), mesmo quando você usa `--saida` para gravar as
imagens em outro lugar: o vídeo ainda não liberado nunca vai parar numa pasta que o git não ignora. Só `--saida-local <pasta>`
troca essa pasta (é para testes).

O vídeo **não conta na meta de peso** (decisão do responsável, 2026-11-03): a meta de menos de 1 MB por estilo e de 30 MB
no total vale só para as imagens (`bytesImagens` no `previas.json`). O campo `bytes` é o total da pasta, com o vídeo.

O pedido de exemplo vem com `"liberado": false`. O caminho certo é: gerar (o vídeo fica só neste computador), assistir na
página de revisão (`revisao.js`, com o selo "Só neste computador") e, só se aprovar, trocar para `true` e rodar de novo com
`--reusar 08-FERRAMENTAS/tesseract/modelos/amostra/saida`. Os arquivos de trabalho (`transcricao.json`,
`palavras-demonstracao.json` e `pedido-demonstracao.json`) ficam fora do repositório.

O roteiro para gravar o vídeo de demonstração está em `roteiro-video-demonstracao.md`, e o pedido de exemplo em
`08-FERRAMENTAS/tesseract/modelos/amostra/pedido-demonstracao.exemplo.json`.

### Peso

As imagens são `.webp` com 1080 px de largura. A meta é **menos de 1 MB por estilo** e **menos de 30 MB no total**. O
comando começa na qualidade 80 e, se um estilo passar de 1 MB, baixa só a qualidade (nunca o tamanho) até caber. Se mesmo
assim algum estilo passar, o comando lista quais, deixa os arquivos gravados para você olhar e termina com erro.

### Ao rodar de novo

Rodar outra vez troca os arquivos pelos novos. Lâminas que o estilo deixou de ter (o demo passou de 8 para 6) são
apagadas. O comando só apaga arquivos com os nomes que ele mesmo cria: qualquer outro arquivo na pasta fica como está.

### Testes

```
node 08-FERRAMENTAS/biblioteca/gerar-previas.test.js   # precisa do Chromium e do ffmpeg
node 08-FERRAMENTAS/biblioteca/previas-marca.test.js   # só Node
node 08-FERRAMENTAS/biblioteca/ponta-a-ponta.test.js   # o caminho inteiro das prévias na marca (Chromium e ffmpeg)
```

## Prévias na marca

**Em resumo** (os detalhes de cada peça vêm nas seções seguintes):

| O quê | Como |
| --- | --- |
| Pedir (o painel, o agente ou o terminal) | botão "Ver os estilos na minha marca" (`POST /api/previas-marca`, `acao: gerar`) ou `node 08-FERRAMENTAS/biblioteca/fila-marca.js pedir <codigo>` |
| Ver como estão | `node 08-FERRAMENTAS/biblioteca/fila-marca.js estado <codigo> [--json]` ou `GET /api/previas-marca?empresa=<codigo>` |
| Pausar, continuar, passar um estilo para a frente, cancelar | `fila-marca.js pausar <codigo>`, `retomar <codigo>`, `priorizar <codigo> <estilo>` e `cancelar <codigo>` (no painel: "Pausar", "Continuar" e abrir o detalhe do estilo) |
| Onde ficam | `empresas/<codigo>/previas/<estilo>/` (na pasta antiga, `empresas/principal/previas/`), com `fila.json` ao lado; as prévias base nunca mudam |
| Quando valem | só com a assinatura da marca de hoje (`previas-marca.js`): marca mudou, as antigas deixam de valer sozinhas e o painel pede de novo ao abrir |
| Quem faz | um processo em segundo plano por Fábrica (`fila-marca.js rodar`): primeiro as imagens de todos os estilos (`gerar-previas.js --marca`), depois um vídeo por vez (`video-marca.js`), e termina sozinho |
| Por que fora do git | `empresas/*/previas/`, `empresas/*/cores-sugeridas/` e `empresas/.fila-previas*.json` estão no `.gitignore`: as prévias se refazem a cada marca, são da empresa (não do modelo) e o vídeo mostra a pessoa do vídeo de demonstração |
| Texto difícil de ler | o `previas.json` guarda a legibilidade de cada texto; o catálogo devolve, por estilo, as cores que resolvem e combinam com a marca (`leitura`), e "Como ficaria" (`cor-sugerida.js`) refaz a peça com a cor escolhida; "Usar esta cor" só grava um pedido `personalizar` (a marca nunca muda pelo painel) |
| Tempo | imagens: cerca de 20 a 30 min para os 27 estilos; vídeo: 5 a 7 min por estilo (algumas horas para todos); "Como ficaria": cerca de 1 min |

O teste `ponta-a-ponta.test.js` percorre o caminho inteiro numa raiz temporária (pasta antiga, `aurora` e `boreal`, dois estilos
de verdade): o painel pede as prévias da `aurora`, troca para a `boreal` no meio e pede as dela, a marca da `aurora` muda no meio,
o trabalhador é encerrado com os processos filhos e o pedido é feito de novo. Ele confere que nenhuma prévia velha vale, que as
imagens e os vídeos de cada empresa só têm as cores dela (amostragem de pixels), que `validar.js --empresa aurora` sai 0 (e sai 1
com um termo da `boreal` plantado na pasta da `aurora`) e que as prévias base e a pasta antiga ficam idênticas byte a byte. Só o
`montar.js` do vídeo é trocado por um MP4 sintético da cor do acento da empresa.

### Gerar as imagens na marca

As mesmas imagens (carrossel, posts fixados e capa de Reels) com as **cores e as letras de uma empresa**, para a pessoa ver
cada estilo "na minha marca":

```
node 08-FERRAMENTAS/biblioteca/gerar-previas.js --marca <codigo>                     # os estilos todos, na marca da empresa
node 08-FERRAMENTAS/biblioteca/gerar-previas.js protagonista --marca <codigo>        # só este estilo
node 08-FERRAMENTAS/biblioteca/gerar-previas.js --marca-arquivo <marca.yaml> --saida <pasta>   # marca ainda não gravada
```

- **Onde ficam:** na pasta da empresa, `empresas/<codigo>/previas/<estilo>/` (na pasta antiga, `empresas/principal/previas/`),
  com os mesmos nomes das prévias base. As prévias base (`04-LABORATORIO-DE-DESIGN/biblioteca/previas/`) nunca são tocadas.
- **Fora do git:** `empresas/*/previas/` está no `.gitignore`. Elas se refazem quando a marca muda e podem mostrar uma pessoa.
- **Só a empresa pedida:** o comando confere o código na lista de empresas e roda com `FABRICA_EMPRESA=<codigo>`, sem
  `FABRICA_MARCA` (a empresa ativa do agente não muda). Empresa sem `marca.yaml` próprio: o comando para com "A empresa ...
  ainda não tem marca definida; as prévias na marca precisam dela." e não grava nada.
- **Assinatura da marca** (`previas-marca.js`): um resumo dos campos do `marca.yaml` que mudam a peça (cores, nome, conta, tela,
  tamanhos mínimos e se a letra principal tem itálico, que muda o destaque do vídeo; em JSON canônico) e do conteúdo das letras que ele cita, mais a versão do gerador. Fim de linha, BOM,
  ordem, espaços, comentários, o caminho das letras e campos como voz, público ou vídeo não mudam nada. O `previas.json` guarda
  `cores: "marca"`, `empresa`, `assinatura`, `identidade`, `avisos` e `legibilidade`. Só vale "na sua marca" a prévia com a
  assinatura de hoje e a identidade pedida (a da empresa): mudou uma cor, o nome ou uma letra, as prévias antigas deixam de
  valer sozinhas. O vídeo de uma rodada anterior só continua se a `videoAssinatura` dele ainda for a de hoje.
- **A marca muda no meio da rodada:** a marca e as letras são lidas uma vez no começo (a assinatura sai desse mesmo conteúdo,
  e as letras usadas são cópias dele). Antes de gravar cada estilo, a assinatura é conferida de novo: se mudou, o estilo não é
  gravado e sai `refazer <estilo>: ...`. Cada estilo é gravado por inteiro: as imagens novas são preparadas à parte, o
  `previas.json` antigo sai antes de elas entrarem e o novo é gravado por último.
- **Letras:** só valem as letras que estão na pasta da empresa (ou as da Fábrica, como as de `tesseract/modelos/fontes/`).
  Letra que falta, ou caminho que sai da pasta da empresa, fica de fora: a peça usa a letra padrão e ganha um aviso.
- **Identidade** (decisão D1 do responsável): nas peças entram o nome e a conta da empresa (`empresa.nome` e `empresa.handle`
  do `marca.yaml`), também na conversa que aparece dentro da demonstração. `--identidade exemplo` volta à identidade de exemplo.
- **Avisos:** depois de montar cada formato, a peça é medida de verdade com as peças do conferidor do carrossel
  (`carrossel/conferir.js`: a mesma medição e a mesma conta de contraste), na marca e nas cores e letras do próprio estilo (sem
  internet, a base é medida sem a letra do Google Fonts). Só vira aviso o que a marca causou: a mesma peça nas cores do estilo
  passa naquele texto, ou a marca piorou claramente um texto que o estilo já tinha fraco (contraste menor que o da base menos
  0,5 e menor que 80% dele). "Com as suas cores, o texto da lâmina 3 fica difícil de ler." só sai quando alguma cor resolve;
  quando nenhuma cor resolve (o fundo debaixo do texto vai do escuro ao claro, como a pincelada do Caderno ou o prato do
  Concreto Ácido), sai "Com a sua marca, este estilo deixa o texto da lâmina 3 difícil de ler; que tal outro estilo?". Os
  outros são "Com as suas letras, o texto ... fica coberto por outra parte da peça." e "Com as suas letras, o texto ... passa da
  borda.". O mínimo de contraste é 3:1 para texto grande (56 px ou mais na peça de 1080) e 4,5:1 para o resto, sobre foto ou
  não. A prévia sai mesmo assim: ela mostra a verdade da marca. Exemplo real: no Editorial, o texto da capa usa a cor neutra;
  com uma neutra de tom médio, o título sobre a foto quase some, e o aviso aparece.
- **Dados para sugerir cores** (campo `legibilidade` do `previas.json`): `{ cores: { escuro, claro, acento, neutro }, textos: [...] }`,
  no máximo 40 por estilo (primeiro os da marca). Todo item tem `tipo` (`contraste`: uma cor resolve; `estilo`: nenhuma cor
  resolve; `coberto`), `daMarca` (verdadeiro só no `contraste` causado pela marca: é o que pede sugestão de cor), `formato`
  (`carrossel`, `fixados` ou `reels`), `lamina` (a partir de 1), `onde` (o trecho do aviso) e `texto` (até 40 caracteres). O
  `coberto` não tem sugestão de cor. O `contraste` e o `estilo` trazem também `papel` (o da cor do texto; numa mistura de cores,
  o papel da marca mais perto da cor que aparece, com `papelAproximado: true`), `cor` e `alfa` do texto, `tamanho` (px),
  `contraste` medido, `contrasteBase` (o mesmo texto nas cores do estilo, ou `null`), `piorou` (a marca é a causa), `minimo` (o
  mesmo do aviso), `sobreFoto` (a foto aparece debaixo do texto, sem caixa de cor no meio), `sobreImagem` (um desenho, não foto,
  logo debaixo do texto), `semOpcao` (nenhuma cor sugerida passaria; é o que faz o `estilo`) e `fundo: { amostras: ['#RRGGBB',
  ...] }` (cores do fundo sob o texto nos quantis 10 a 90, do mais escuro ao mais claro). A etapa 8 chama
  `legibilidade.sugerir({ papel, cores, fundo, minimo })` com esses mesmos valores. Enquanto o `08-FERRAMENTAS/marca/legibilidade.js`
  não está neste ramo, o `semOpcao` usa o arquivo de `FABRICA_LEGIBILIDADE` (os testes) ou, sem ele, só fica verdadeiro quando
  nenhuma cor passaria contra todas as amostras.
- **Saída:** uma linha por estilo (`ok   <estilo>: ...`, `erro <estilo>: ...` ou `refazer <estilo>: ...`) e, no fim,
  `feitos: X/N`. Erro num estilo não para os outros. Não há meta de peso (as prévias da empresa não vão para o repositório), mas
  a escada de qualidade é a mesma.
- **Para outros módulos:** `gerarImagensNaMarca(r, codigo, { ids, identidade, aoAvancar })` roda o comando num processo
  próprio (nunca no de quem chama) e devolve `{ feitos, total, falhas, refazer }`.
- **`--marca-arquivo`:** usa um `marca.yaml` que ainda não foi gravado (para mostrar a marca nova antes de confirmar). Pede
  `--saida`, que não pode ficar dentro das prévias base, na pasta de outra empresa nem nas prévias na marca da própria empresa
  (lá só entra a marca gravada), e não grava assinatura de empresa. Com `--empresa <codigo>`, as letras citadas são procuradas
  como as da marca gravada daquela empresa (na pasta dela; na pasta antiga, em `06-MARCA-E-FOTOS`). Sem `--empresa`, letra por
  caminho absoluto ou da pasta antiga (`06-MARCA-E-FOTOS`, fora de `exemplo/`) não é lida (seria de uma empresa que não foi
  dita): a prévia usa a letra padrão e avisa.
- **Valores efetivos:** o que a marca não tem (tela, tamanhos mínimos, letra de destaque, onde a logo aparece) vem do
  `marca.exemplo.yaml`, como no leitor de marca; a assinatura e as letras da prévia usam esses mesmos valores.
- **Pasta de preparo:** as imagens novas são preparadas em `<estilo>/.novo-*` e entram no fim; uma pasta dessas que sobrou
  de uma rodada que caiu é apagada na rodada seguinte (e o git a ignora também nas prévias base).

**Tempo medido** (27 estilos, neste computador, 2026-11): cerca de 19 minutos para uma empresa (aurora, 1114 s) e 30 minutos
para outra (boreal, 1774 s, com a máquina ocupada por outros testes), uns 40 a 65 segundos por estilo. Cada formato é montado e
depois medido de novo no navegador (os avisos), o que pesa quase metade do tempo; desde a correção, a medição também é feita
nas cores do próprio estilo (para não culpar a marca pelo que o estilo já tem), o que soma mais uma medição por formato. Com
essa medição e a letra do estilo (correção 2), 4 estilos (Faixa, Concreto Ácido, Caderno e Editorial) levaram 172 s (43 s por
estilo) numa hora calma e 242 s com a máquina ocupada: a letra do Google Fonts não pesa (menos de 1 s por página com
internet). Numa das rodadas, o navegador fechou no meio
de um estilo (Luz de Vela) e ele saiu como `erro`; os outros seguiram, e rodar de novo aquele estilo deu certo.

### Vídeo na marca (`video-marca.js`)

O trecho de 12 s de cada estilo com a marca da empresa: o modelo de Reels do estilo montado pelo `montar.js` sobre o vídeo
de demonstração deste computador, com `--usar-marca` e `--saida` (veja `tesseract/modelos/README.md`).

```
node 08-FERRAMENTAS/biblioteca/video-marca.js <codigo> <estilo> [--pedido <pedido.json>] [--json]
```

- **Para outros módulos** (a fila liga este passo): `gerarVideoNaMarca({ raiz, empresa, estilo, pedidoDemo, assinatura,
  limiteMs })` devolve `{ estado, empresa, estilo, modelo, mensagem, detalhe, avisos, video, videoCapa, videoAssinatura,
  segundos }`; `renderizarVideoNaMarca(r, codigo, id, opcoes)` é o mesmo com os argumentos na ordem do plano. Só rejeita
  com entrada inválida (`EMPRESA_DESCONHECIDA`, `ESTILO_DESCONHECIDO`), antes de ler ou gravar. `estado`:
  - `pronto`: `video.webm` e `video-capa.webp` na pasta do estilo, e o `previas.json` com `video`, `videoCapa`,
    `videoAssinatura` (a assinatura de hoje), `videoModelo`, `videoGerado`, `videoAvisos` e `videoDetalhes`;
  - `sem-modelo`: o modelo do estilo não declara `aceitaMarca: true` (ou o estilo não tem modelo de Reels): fica o vídeo base;
  - `sem-fonte`: este computador não tem o pedido de demonstração (`FABRICA_PEDIDO_DEMONSTRACAO` ou
    `tesseract/modelos/amostra/pedido-demonstracao.json`) ou um arquivo que ele cita. É a decisão B1 enquanto o responsável
    não decide outra: "sempre no base, com aviso" (a mensagem diz que o vídeo de demonstração não está neste computador);
  - `sem-marca`: a empresa não tem `marca.yaml` próprio;
  - `refazer`: a assinatura pedida não é a de hoje, ou a marca mudou enquanto o vídeo era montado;
  - `erro`: o `montar.js` falhou, passou de 20 minutos (é encerrado com os processos filhos), usou outra marca (ou uma letra
    fora da pasta da marca: a mensagem diz isso), ou o corte e a gravação falharam. Nada é gravado e o vídeo anterior continua
    como estava, menos numa falha **no meio da gravação** (troca de nomes; por exemplo, um arquivo preso por outro programa):
    aí o `previas.json` já deixou de citar o vídeo e fica sem ele (nunca prévia falsa), e os arquivos podem ficar misturados
    até a próxima rodada, que os refaz.
  `mensagem` é o texto para a pessoa, em português simples; `detalhe`, o técnico (sem caminho, nome de arquivo nem cor de
  outra marca: ele vai para a fila da empresa).
- **Integração com a fila** (`ESTADOS` exportado diz o mesmo): `pronto`, `sem-modelo`, `sem-fonte` e `erro` são o estado
  final do estilo e entram na fila com o mesmo nome. `refazer` e `sem-marca` **não** são estado de estilo e nunca viram `erro`:
  `refazer` = recomeçar a empresa (imagens e vídeos com a assinatura nova); `sem-marca` = parar a empresa.
- **Só a empresa pedida:** o `montar.js` roda num processo próprio com `FABRICA_EMPRESA=<codigo>`, `FABRICA_RAIZ` e sem
  `FABRICA_MARCA`, e grava na pasta de trabalho `empresas/<codigo>/previas/.trabalho/<modelo>/` (com ponto: o servidor não a
  entrega; ela é apagada no fim, e a que sobrar de uma rodada que morreu é apagada na seguinte). A linha `marca-usada` do
  `montar.js` precisa bater com a marca que a assinatura descreve: o mesmo `marca.yaml`, as mesmas quatro cores, o mesmo
  itálico da letra principal e, em cada papel em que a marca entrou, uma letra com o mesmo conteúdo. Se não bater (marca de exemplo, outra empresa, letra por caminho
  absoluto que a assinatura não conhece), é `erro` e nada é gravado.
- **Gravação:** o trecho é cortado na pasta de trabalho (por `cortarTrecho`, num processo filho para não travar quem chama), a
  assinatura é conferida de novo, o `previas.json` deixa de citar o vídeo antigo, os arquivos novos entram por troca de nome e
  o `previas.json` novo (temporário e troca de nome) é o último (veja acima o que fica numa falha no meio). O corte do trecho
  que o `montar.js` guarda no `.cache` (motor.js) também vai por temporário e troca de nome. Se as imagens da pasta são de outra marca, o manifesto novo fica
  só com o vídeo: imagens velhas nunca viram "na sua marca".
- **Avisos:** os avisos `[marca]` dos modelos e `marca:` do tema viram texto simples em `videoAvisos` (e entram nos `avisos` do
  estilo): "No vídeo, com as suas cores, um texto ficaria difícil de ler; nesse ponto ele usa as cores do estilo.", "No vídeo,
  com as suas letras, um texto não coube inteiro na tela.", "No vídeo, uma letra da sua marca não foi encontrada; nesse lugar
  ele usa a letra do estilo." e "No vídeo, a sua letra principal não tem itálico; o destaque usa outra letra.". As linhas do log
  ficam em `videoDetalhes` (no máximo 20). Refazer as imagens com a mesma marca mantém o vídeo e esses campos.
- **Fora do git:** o vídeo mostra a pessoa do vídeo de demonstração; ele fica em `empresas/<codigo>/previas/`, que o git ignora.
- **Testes:** `video-marca.test.js` (o `montar.js` trocado por um MP4 sintético; o corte é o de verdade). Com
  `FABRICA_TESTE_VIDEO=1` e o vídeo de demonstração neste computador, um teste longo monta o Luz de Vela de verdade.

## fila-marca.js: as prévias na marca em segundo plano

O painel (e o agente) pedem as prévias na marca de uma empresa; um processo em segundo plano faz primeiro as imagens (todas de
uma vez, com o `gerar-previas.js --marca`) e depois um vídeo por vez, na ordem da grade da empresa.

```
node 08-FERRAMENTAS/biblioteca/fila-marca.js estado <codigo> [--json]     # como estão (--json: para o agente)
node 08-FERRAMENTAS/biblioteca/fila-marca.js pedir <codigo>               # pede as prévias da marca de hoje
node 08-FERRAMENTAS/biblioteca/fila-marca.js priorizar <codigo> <estilo>  # o vídeo deste estilo passa para a frente
node 08-FERRAMENTAS/biblioteca/fila-marca.js pausar <codigo> | retomar <codigo> | cancelar <codigo>
node 08-FERRAMENTAS/biblioteca/fila-marca.js rodar                        # faz o que falta, de todas as empresas, e termina
node 08-FERRAMENTAS/biblioteca/fila-marca.test.js                         # testes (só Node)
```

- **Estado** em `empresas/<codigo>/previas/fila.json` (fora do git): `{ versao: 1, empresa, assinatura, pedidoEm, pausada,
  imagens: { estado, feitos, total, erro }, videos: [{ estilo, modelo, estado, erro, inicio, fim }] }`. Imagens:
  `esperando | fazendo | pronto | erro | cancelado`; cada vídeo: `esperando | fazendo | pronto | erro | sem-fonte | sem-modelo`.
  O `modelo` é o `formatos.reels.modelo` do `estilo.yaml`. Uma lista com outra `empresa` dentro (copiada) não vale.
- **Trava:** toda alteração passa por `alterarFila(r, codigo, fn)`: segura `empresas/<codigo>/previas/.fila.trava` (criação
  exclusiva; trava de processo morto ou com mais de 30 s é abandonada e tirada), lê, aplica `fn` e grava o que ela devolver por
  inteiro (temporário próprio + troca de nome; `fn` que não devolve nada não grava; erro em `fn` não grava).
- **Ações:** `pedir` recusa sem marca ("Defina a sua marca antes de ver os estilos nela.", nada gravado); com a mesma marca, só
  volta a pôr na lista o que deu erro, foi cancelado ou ainda não estava nela (tudo pronto: o arquivo fica igual); com marca
  nova, recomeça imagens e vídeos (as prévias velhas ficam no disco, mas já não valem). `priorizar` põe o estilo logo depois do
  que está rodando (estilo fora da biblioteca: "Este estilo não está na biblioteca."). `pausar` segura o próximo passo e para na
  hora as imagens e o vídeo em andamento (o trabalhador confere a lista a cada batida, de 10 s, e encerra o processo, com os
  filhos dele; o estilo que estava sendo feito volta a esperar, sem erro, e o que já estava pronto fica). `retomar` solta,
  `cancelar` tira o que espera e o que está em andamento, imagens e vídeo (nada pronto é apagado) e desliga a pausa. `pedir`
  partindo de nada pendente também desliga a pausa (quem pede quer ver andar). Sem nada pedido, nenhuma delas cria pasta ou
  arquivo. Sem nenhum estilo na grade (raiz de dados vazia), `pedir` não deixa nada esperando e as imagens nunca são pedidas
  (o `gerar-previas.js --marca` sem ids faria todos os estilos; o passo padrão recusa lista vazia).
- **`estado(r, codigo)`** (só lê): `{ estado: 'nada' | 'imagens' | 'videos' | 'pausado' | 'pronto' | 'sem-marca', imagens:
  { estado, feitos, total, erro }, videos: { feitos, total, atual, prontos, semFonte, semModelo, erros }, desatualizada,
  pausada, trabalhador }`. `videos.feitos` conta os que terminaram de qualquer jeito (pronto, erro, sem fonte, sem modelo):
  é o andamento ("Suas prévias de vídeo: 9 de 27"). `videos.prontos` são os vídeos que ficaram de fato na marca da empresa:
  é o que a tela mostra como "vídeos na sua marca" (num computador sem o vídeo de demonstração, todos ficam `sem-fonte`:
  `feitos` chega a 27 e `prontos` fica 0). `trabalhador` fala só desta empresa: alguém vivo E trabalho dela pela frente (nunca revela que outra
  empresa está gerando).
  `desatualizada`: há na pasta prévias na marca de outra marca que não a de hoje. Marca mudada com trabalho pela metade conta
  como o recomeço que vai acontecer. `estadoComVideos` devolve também o estado do vídeo de cada estilo (para o catálogo).
- **Quem faz:** um processo só por Fábrica, com registro em `empresas/.fila-previas.json` (`{ pid, raiz, inicio, batida, vez }`,
  fora do git) e batida de vida a cada 10 s. Vivo = o processo existe e a batida tem menos de 2 min (número de processo
  reaproveitado pelo sistema não bate e cai em 2 min). Registro de processo morto é tomado. Ao começar, todo item `fazendo` de
  qualquer empresa volta para `esperando` (quem o fazia morreu no meio). Ele escolhe a empresa com o pedido mais antigo, confere
  a marca antes de cada passo (mudou: recomeça aquela empresa) e a pausa, e termina sozinho quando não há mais nada (e confere de
  novo depois de sair, para um pedido que chegou na hora não ficar sem ninguém). Nunca grava `empresas/ativa.json`. Antes de
  cada passo confere que o registro ainda é dele (pela `vez`); se outro assumiu, para ali, sem apagar o registro do outro.
- **Empresa presa:** um passo que falha 3 vezes seguidas numa empresa (lista só leitura, disco cheio...) tira aquela empresa
  da rodada; as outras seguem, e o trabalhador termina quando só sobram presas. A marcação fica em
  `empresas/.fila-previas-presas.json` (`{ <codigo>: <desde> }`, fora do git) por 10 min: um trabalhador lançado por um
  pedido de outra empresa nem tenta a presa. Ela sai da lista quando a própria empresa pede de novo, quando um passo dela dá
  certo ou quando o prazo acaba.
- **Tirar trava ou registro abandonado:** o dono é conferido logo antes; o arquivo sai por troca de nome para um nome único e
  o conteúdo tirado é conferido de novo; se não era o esperado, volta, mas só se o nome original continua livre. A regravação
  da batida prepara o temporário antes e confere o dono logo antes da troca. Limite que sobra: entre a troca e a volta
  (microssegundos), um terceiro pode criar um arquivo novo no lugar e o que foi tirado por engano se perde (o dono percebe na
  próxima conferência da `vez` e para).
- **Duas gerações de imagens ao mesmo tempo** (um trabalhador velho que voltou depois de outro assumir, por exemplo):
  as pastas de preparo `<estilo>/.novo-*` e o temporário do `previas.json` são do mesmo estilo nas duas; no pior caso um dos
  dois dá erro naquele estilo. Prévia falsa não sai: cada `previas.json` é gravado por inteiro, por último, com a assinatura
  conferida no disco antes.
- **`garantirTrabalhador(r, { lancar })`:** se há trabalho e ninguém vivo, cria com exclusividade uma reserva do registro (com
  uma `vez` que o processo lançado assume) e só então lança `fila-marca.js rodar` destacado, sem janela, com `FABRICA_RAIZ` e
  sem `FABRICA_EMPRESA`/`FABRICA_MARCA`: dois pedidos ao mesmo tempo lançam um só. Só a reserva ainda não assumida
  (`reservada: true`) pode ser assumida pela `vez`; o lançado apaga `FABRICA_FILA_VEZ` do ambiente ao ler, e ela não passa
  aos filhos (`gerar-previas.js`, `montar.js`). Na linha de comando, `pedir`, `priorizar` e `retomar` chamam essa função
  (`--sem-trabalhador` só anota).
- **Os passos são trocáveis:** `rodar(r, { gerarImagens, renderizarVideo, agora, batida })`. O vídeo padrão é o vídeo na
  marca (`video-marca.gerarVideoNaMarca`, com a marca de hoje e a pasta dos estilos da raiz dos dados, a mesma da grade):
  `pronto`, `sem-fonte`, `sem-modelo` e `erro` ficam como estado do estilo; `refazer` recomeça a empresa como marca nova
  (imagens e vídeos, com a marca de hoje); `sem-marca` devolve o estilo para "esperando" e para a empresa (sem marca ela não
  conta como trabalho; com a marca de volta, o que esperava é feito). Nenhum dos dois vira `erro`. Três `refazer` seguidos
  sem nenhum vídeo terminar também param a empresa naquela rodada (sem laço sem fim). Erro num estilo não para os
  outros: fica `erro` com a mensagem em português ("Não deu para fazer o vídeo deste estilo.", "Não deu para preparar as
  imagens na sua marca.") e um `detalhe` que é só um código curto (`navegador-fechou`, `tempo-esgotado`, `sem-permissao`,
  `disco-cheio`, `arquivo-faltando`, `sem-estilos`, `outro`; nas imagens com falha de alguns estilos, os ids deles): o
  `fila.json` é entregue pelo servidor de arquivos e nunca leva caminho nem texto de outro programa (que pode citar outra
  empresa). O texto inteiro do erro vai para o console. O próximo `pedir` refaz só o que deu erro.

## Leitura difícil e "Como ficaria" (cor-sugerida.js)

- **`previasValidas(...).leitura`** (`previas-marca.js`): dos dados de legibilidade do `previas.json`, só o que a marca
  piorou. **Um grupo de cor por papel**, com as peças dele (`pecas: [{ formato, lamina }]`) e até 3 cores sugeridas
  (`08-FERRAMENTAS/marca/legibilidade.js`) que passam em TODOS os textos de TODAS essas peças (conferidas texto a texto) e
  combinam com a marca; a cor de hoje nunca é sugestão. **Sem cor para todas as peças do papel**, vale a cor que resolve o
  maior grupo de peças (empate: a ordem das peças e das sugestões; sempre o mesmo resultado) e as outras peças vão para o
  grupo `estilo` ("este estilo deixa o texto difícil de ler com a sua marca; que tal outro estilo?"). A peça com um texto que
  nenhuma cor resolve (tipo `estilo` do gerador) também vai para `estilo`, e **uma peça em `estilo` sai de todos os grupos
  de cor** (nunca aparece nos dois lugares). Assim nenhuma sugestão contradiz outra do mesmo papel nem piora uma peça sem
  aviso. **A cor também não estraga o que hoje se lê, em nenhum estilo da empresa:** o gerador guarda, por estilo, TODOS os
  textos medidos (`legibilidade.todos`, sem corte: peça, id do texto, papel da cor do texto quando é exatamente uma cor da
  marca, cor, opacidade, fundo médio, os quantis 25/50/75 do fundo, mínimo e contraste medido). Uma cor só é oferecida se,
  trocada na marca, nenhum texto que hoje se lê, de nenhuma prévia válida da empresa, cai abaixo do seu mínimo — conta
  exata, sem render, com o papel como cor do texto e como cor do fundo (as amostras que são a cor de hoje do papel, com
  tolerância de 8 por canal, viram a cor nova). Sem cor que passe, a peça vai para "estilo". E a mesma cor nunca vai para
  dois papéis na mesma peça. **Calibragem:** se os textos difíceis do estilo são poucos (no máximo 2, numa peça só), curtos
  (até 24 caracteres, sem corte: selo, iniciais, rótulo; texto corrido nunca), pequenos (mínimo 4,5) e estão a menos de 0,5 do
  mínimo, o grupo `estilo` vira `detalhe` e a tela diz só "Um detalhe pequeno deste estilo fica um pouco abaixo do
  ideal de leitura com a sua marca." (sem mandar trocar de estilo nem acender o marcador da grade). A tela mostra todos os
  grupos, a cor, o nome e os botões "Como ficaria" e "Usar esta cor", pede uma troca por vez e diz que a cor muda em todos
  os estilos da marca. **Estilos ainda sem prévia válida** (erro, em preparo, novos) ficam fora da conta: o catálogo manda
  `marca.semConferir` (quantos são) e, enquanto houver algum, a tela diz "nos estilos já prontos" e "X estilos ainda não
  foram conferidos". **A conta é guardada** (`contextoDaEmpresa(r, codigo, assinatura)`: os textos da empresa e a memória de
  cada troca) enquanto a assinatura da marca e os `previas.json` da empresa (data e tamanho de cada um) não mudam; a grade
  relida não refaz a conta. **Limitação:** a conta exata só vale para os textos cujo papel se conhece (cor do texto igual a
  uma cor da marca); cores derivadas da marca por `color-mix` (na boreal de teste, 583 dos 1248 textos guardados, sem papel)
  ficam fora dela. O "Como ficaria" mede de verdade (gera a peça) só o estilo aberto; os outros estilos vão pela conta.
- **`comoFicaria({ raiz, empresa, estilo, papel, cor, peca })`**: as peças do grupo feitas de verdade com a cor trocada, sob
  demanda e só para aquele estilo: `gerar-previas.js <estilo> --marca-arquivo <cópia> --saida
  empresas/<c>/cores-sugeridas/<marca>-<papel>-<cor> --empresa <c>`, num processo filho (cerca de um minuto). **A peça
  pedida decide o grupo** (o papel pedido que tem aquela peça; peça fora dele: `PECA_FORA`, 400) e só vale uma cor sugerida
  para esse grupo (`COR_FORA`). Devolve `{ pecas: [{ formato, lamina, atual, endereco, dificeis }], pioradas }`, a pedida
  primeiro; `dificeis` são os textos daquela peça que, medidos de novo na peça nova, continuam difíceis (qualquer papel);
  `pioradas` são os textos que hoje se leem e, com a cor nova, ficam difíceis, texto a texto (`{ estilo, nome, formato,
  lamina, texto }`): os do estilo aberto medidos de novo na peça gerada (pelo id do texto) e os de todos os estilos da
  empresa pela conta exata com os textos guardados. A cópia da marca vai para a pasta temporária do sistema (`cor-sugerida-` e 6 letras, o nome exato do
  `mkdtemp`, conferida pela volta do leitor de YAML) e é apagada, mesmo
  quando a geração falha; as abandonadas por um processo que morreu saem depois de 1 h (no começo de cada "Como ficaria" e
  quando o servidor dos painéis sobe). O `marca.yaml` da empresa nunca muda. A mesma marca e a mesma cor de novo: na hora;
  as pastas de uma marca que não é a de hoje saem antes de uma geração nova; no máximo 6 pastas por empresa (as mais
  novas); a marca que muda no meio descarta a peça; uma geração por vez. `empresas/*/cores-sugeridas/` fica fora do git. No
  painel: `POST /api/previas-marca` com `acao: 'como-ficaria'` e a `peca` (passa pela trava do modelo).
- **"Usar esta cor"** abre "Personalizar" com o recado já escrito (a troca da cor e a peça, montada pela tela a partir do
  formato e do número da peça, nunca de um texto do arquivo); só a confirmação grava o pedido `personalizar` ao agente. A
  marca não muda pelo painel.
- **`notaDestaque(r, codigo, estilo)`**: nos detalhes técnicos do estilo na marca, "No destaque, este estilo usa a letra
  itálica dele, porque a sua letra principal não tem itálico." quando o estilo destaca em itálico e a letra principal da
  marca não tem itálico (a regra do `tema-marca.js`: nome do arquivo ou `tipografia.principal.italico`).

## revisao.js: página de revisão

```
node 08-FERRAMENTAS/biblioteca/revisao.js
```

Grava `04-LABORATORIO-DE-DESIGN/biblioteca/revisao.html` (o git ignora este arquivo) com, para cada estilo, as prévias, o vídeo
e os três campos da biblioteca. No topo ficam o peso total contra a meta e uma nota sobre o campo "O que precisa": ele fala do
carrossel, e o post fixado de apresentação e a capa de Reels sempre usam um retrato. Dois estilos (Contraste e Concreto
Ácido) trazem a marca "Para você decidir", porque o campo deles merece uma segunda olhada. O vídeo que ainda não foi liberado
aparece com o selo "Só neste computador"; se o estilo também tem um vídeo liberado, aparece o novo, com uma frase avisando.

```
node 08-FERRAMENTAS/biblioteca/revisao.test.js
```
