# Etapa 7: prévias "na minha marca" e a fila de vídeo — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** a pessoa liga o interruptor "Na minha marca" e vê cada estilo da biblioteca com as cores e as letras da empresa
dela: lâminas do carrossel, posts fixados e capa de Reels (imagens, prontas em poucos minutos, todas de uma vez) e o trecho de
vídeo (lento, numa fila em segundo plano, com o progresso visível: "Suas prévias de vídeo: 9 de 27"). Enquanto o vídeo de um
estilo não fica pronto, o cartão mostra o vídeo base com o selo "Modelo base". Nunca aparece prévia falsa: uma prévia só vale
"na sua marca" se foi feita com a marca de hoje da empresa (a marca mudou, a prévia antiga deixa de valer).

**Arquitetura:**
- **Onde ficam:** na pasta da empresa, `empresa.caminhos(c).previas` (`empresas/<c>/previas/`, que já existe no leitor, inclusive
  na pasta antiga, como `empresas/principal/previas/`). Um estilo por pasta, no mesmo formato das prévias base
  (`<id>/carrossel-NN.webp`, `fixado-*.webp`, `reels-capa.webp`, `video.webm`, `video-capa.webp`, `previas.json`), mais a fila
  (`fila.json`). As prévias base (`04-LABORATORIO-DE-DESIGN/biblioteca/previas/`) nunca são tocadas.
- **Assinatura da marca:** um resumo (sha256) do `marca.yaml` da empresa e dos arquivos de letra (e do logo, se a identidade
  usar o logo) que ele cita, mais a versão do gerador. Toda prévia na marca guarda a assinatura com que foi feita; o catálogo só
  entrega a prévia cuja assinatura é a de hoje. É assim que "a marca mudou" vira "refazer", sem ninguém precisar avisar.
- **Imagens:** o `gerar-previas.js` da etapa 4 ganha o modo `--marca <codigo>` (cores e letras da empresa, saída na pasta dela) e
  o modo `--marca-arquivo <yaml> --saida <pasta>` (uma marca ainda não gravada, para a etapa 8 mostrar "antes de confirmar").
  Como o leitor `marca.js` fixa a marca ao ser carregado, cada empresa roda num processo próprio, com `FABRICA_EMPRESA` da empresa
  pedida e sem `FABRICA_MARCA`.
- **Fila:** um módulo novo, `08-FERRAMENTAS/biblioteca/fila-marca.js`, guarda o estado por empresa (`fila.json`, com trava de
  arquivo) e tem um trabalhador (`fila-marca.js rodar`) que faz primeiro as imagens e depois um vídeo por vez, na ordem da grade,
  com "passar para a frente" o estilo aberto no detalhe. Um trabalhador só por Fábrica (registro com batida de vida em
  `empresas/.fila-previas.json`), que termina sozinho quando não há mais nada a fazer.
- **Vídeo:** o trabalhador monta o modelo de Reels do estilo com o `montar.js` da etapa 6 (marca da empresa, saída numa pasta de
  trabalho da empresa) sobre o vídeo de demonstração local e corta o trecho de 12 s com o `cortarTrecho` da etapa 4.
- **Painel:** o servidor ganha `GET /api/previas-marca` (estado e progresso) e `POST /api/previas-marca` (gerar, passar para a
  frente, pausar, retomar, cancelar) e liga o trabalhador quando há trabalho; `biblioteca.catalogo` passa a entregar as prévias na
  marca válidas. A tela `estilos.html` acende o interruptor, troca os cartões e o detalhe e mostra o progresso, consultando o
  estado de tempos em tempos só enquanto há trabalho e a página está à vista.

**Tecnologia:** Node (módulos nativos), Playwright e Chromium (imagens, como na etapa 4), ffmpeg e o `tsrct` dos modelos (vídeo,
como nas etapas 4 e 6), HTML/CSS/JS simples na tela (sem build, sem biblioteca externa), testes em scripts `node` com `assert`,
prova visual com Chromium.

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 5, 8.3 ("na minha marca" e a
fila), 8.4 (selo, interruptor, base e marca lado a lado), 9 (pedidos e empresa do painel), 10 (vídeo na marca) e 12 (etapa 7).
Etapas anteriores: etapa 4 (`docs/superpowers/plans/2026-11-02-etapa-4-previas-base.md`), etapa 5
(`docs/superpowers/plans/2026-11-03-etapa-5-biblioteca-de-estilos.md`) e etapa 6
(`docs/superpowers/plans/2026-11-04-etapa-6-video-na-marca.md`).

## Restrições globais

- **Nunca mostrar prévia falsa** (spec 8.3): "Na sua marca" só com prévia feita com a assinatura de hoje da empresa. Prévia
  velha, de outra assinatura, com `cores` diferente de `marca` ou de outra empresa nunca vira endereço no catálogo. Vídeo que ainda
  não ficou pronto: o cartão toca o vídeo base com o selo "Modelo base". Modelo de vídeo que ainda não aceita a paleta inteira da
  marca (etapa 6 incompleta) não gera vídeo "na marca": fica no base.
- **Empresa sem marca própria** (`marca.definida` falso, ou seja, só a marca de exemplo): nada é gerado; o interruptor fica
  apagado, como na etapa 5. Nunca uma prévia "na sua marca" com as cores de exemplo.
- **As prévias base não mudam:** `04-LABORATORIO-DE-DESIGN/biblioteca/previas/**` fica idêntica byte a byte depois de qualquer
  geração na marca (teste).
- **Uma empresa nunca vê nada de outra:** a geração da empresa A lê só o `marca.yaml` de A (processo próprio, `FABRICA_EMPRESA=A`,
  sem `FABRICA_MARCA`); grava só em `empresas/A/previas/`; o catálogo de A só tem endereços que começam com `/empresas/A/previas/`
  (ou as prévias base); a tela recusa endereço de prévia de outra empresa. Toda rota recebe e confere a empresa como as das etapas
  3 e 5 (`empresaDoPedido`, `empresa` por último na resposta, 400 com várias empresas e sem `empresa` no corpo).
- **O seletor de empresa do painel não troca a empresa ativa do agente** (regra da etapa 3). O trabalhador também não: ele passa a
  empresa a cada processo filho pelo ambiente e nunca grava `ativa.json`.
- **Regras de vídeo continuam valendo com qualquer marca** (as da etapa 6): a pessoa nunca sai de cena quando a imagem entra, rosto
  inteiro e visível, nada sobre o rosto, vídeo limpo, troca de quadro com pelo menos 4 s, degradê só atrás do texto. A prova visual
  confere isso nas duas marcas fictícias.
- **Grade leve:** nunca mais de um vídeo tocando; nada toca sozinho; a consulta de progresso só roda enquanto há trabalho, a
  página está à vista e no máximo uma a cada 5 s; trocar de empresa para a consulta da anterior.
- **Toda escolha de design vem com prévia; nada de pergunta por texto.** As decisões visuais desta etapa (lista na Tarefa 3) vão
  numa página com as opções renderizadas lado a lado, com as empresas fictícias, antes das telas.
- **Texto ao usuário final** em português simples, sem "gaveta", "disposição", "índice", "legado", "manifesto", "assinatura",
  "fila", "webp", "trabalhador" ou nome de arquivo. "Fila" vira "suas prévias de vídeo".
- **Ler dados só pelas rotas `/api/...`**, sempre por `empresa-seletor.js` (`ler` e `enviar`); sem `fetch` próprio na tela.
- **O vídeo de demonstração nunca entra no git:** a fonte (`assets-fonte/videos/*.mp4`, `amostra/pedido-demonstracao.json`) é só
  local, e as prévias na marca ficam fora do git (`empresas/*/previas/` no `.gitignore`). Provas visuais só com as empresas
  fictícias `aurora` (quente) e `boreal` (fria), com cores definidas dentro dos testes e letras OFL de `modelos/fontes/`; as provas
  ficam na pasta de trabalho (scratchpad), nunca no repositório.
- **Nenhuma etapa depende de gerar imagem por IA** (I-16): as fotos são as de `_demo/fotos/`.
- **Antes de cada commit:** `node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos <lista privada>` e
  `node _fabrica/core/conferir-caminhos.js` saem `0`; a bateria completa (`git ls-files '*.test.js'`) sai `0`.
- **Git:** sem `push`, `pull`, `merge`, `reset` ou `stash`. Commit local por tarefa, no ramo `biblioteca`.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit.
- **Nunca citar** o nome do responsável nem o da empresa de referência na matriz; nenhum hex, letra comercial, conta com arroba ou
  dia da semana de empresa real. Hex fictício só em teste, com isenção registrada e motivo.

## Comandos de conferência (todo passo "bateria, validador, conferir-caminhos")

```
for t in $(git ls-files '*.test.js'); do node "$t" < /dev/null || echo "FALHOU $t"; done
node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos "<lista privada de termos proibidos, só leitura>"
node _fabrica/core/conferir-caminhos.js
git status --short   # só os arquivos da tarefa; nada em empresas/*/previas/, nenhum .mp4, nenhuma prova visual
```

Ambiente dos testes com Chromium e ffmpeg: o mesmo das etapas 4 e 6 (`NODE_PATH` com o Playwright e `FABRICA_CHROMIUM`), sempre com
`timeout` e `< /dev/null`. Cada comando sai `0`; o validador e o `conferir-caminhos` são rodados de novo logo antes do commit.

## Contrato assumido com a etapa 6 (vídeo na marca)

A parte de imagens e de painel (Tarefas 1 a 7, com o passo de vídeo da fila trocável e marcando `sem-modelo`) não depende da
etapa 6 e pode começar já. O vídeo real (Tarefa 8) só começa quando estes pontos existirem no ramo `biblioteca`:

| O que | Estado no ramo hoje | Quem entrega |
|---|---|---|
| `tema-marca.js` com `resolver(pedido, { marcaMod, base })`, `usarMarca` lendo o `marca.yaml` da empresa ativa pelo `marca.js` | pronto (itens 6.1 e 6.2) | etapa 6 |
| `montar.js` entrega `ctx.marca` e aceita `pedido.marca = { cores, fontes }` e `pedido.usarMarca` | pronto | etapa 6 |
| Os 12 modelos sobre `_inverso.js`, Concreto Ácido e Luz de Vela lendo `ctx.marca` | pronto | etapa 6 |
| Os 13 modelos antigos lendo `ctx.marca` | em andamento (itens 6.3 e 6.4, em outros ramos) | etapa 6 |
| Cada modelo que troca a paleta inteira declara `aceitaMarca: true` no objeto que exporta | **não existe**: a Tarefa 8 acrescenta nos 14 prontos e pede o mesmo nos 13 | etapa 7 (14) e etapa 6 (13) |
| `montar.js --saida <pasta>` (o MP4 e o projeto vão para outra pasta, e não para `saida/` ao lado do pedido) e `--usar-marca` (o mesmo que `usarMarca: true` no pedido, sem copiar o pedido) | **não existe**: a Tarefa 8 acrescenta | etapa 7 |
| Aviso de contraste e de letra no log com o prefixo `marca:` | pronto | etapa 6 |

Se a etapa 6 terminar com outro nome para algum desses pontos, a Tarefa 8 se adapta ao nome dela; o que não muda é o contrato de
comportamento: sem `aceitaMarca`, o estilo fica com o vídeo base ("sem-modelo"), nunca com um vídeo que só trocou o acento.

## Foco da revisão

1. **Prévia falsa:** marca mudada depois da geração, empresa sem `marca.yaml`, `previas.json` copiado de outra empresa ou com
   `cores: 'sugestao'` dentro da pasta da empresa, vídeo pela metade (o trabalhador caiu no meio): nada disso aparece como "Na sua
   marca".
2. **Duas empresas em seguida na mesma máquina:** as imagens e o vídeo da `aurora` não têm nenhuma cor da `boreal` (amostragem de
   pixels), e o catálogo da `aurora` não tem nenhum endereço da `boreal`; `empresa=../x`, vazio ou inexistente nas rotas novas: 400,
   nada lido nem gravado.
3. **Trabalhador:** dois pedidos ao mesmo tempo não sobem dois trabalhadores; trabalhador que morreu (processo encerrado no meio de
   um vídeo) é retomado no próximo pedido, e o estilo que estava "fazendo" volta para "esperando"; pausar segura o próximo vídeo
   (o que está em andamento termina); cancelar não apaga prévia pronta.
4. **Painel aberto por horas:** a consulta de progresso para quando a página some da vista, quando o trabalho acaba e ao trocar de
   empresa; resposta de outra empresa nunca muda a tela atual.
5. **Pasta antiga (`principal`):** as prévias caem em `empresas/principal/previas/`, e todo arquivo antigo (marca, laboratório,
   prévias base) fica idêntico byte a byte.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `08-FERRAMENTAS/biblioteca/previas-marca.js` (novo, + teste) | assinatura da marca, leitura das prévias na marca válidas, letras da marca |
| `08-FERRAMENTAS/biblioteca/gerar-previas.js` (+ teste) | modos `--marca <codigo>` e `--marca-arquivo <yaml>`; identidade; avisos de contraste |
| `08-FERRAMENTAS/biblioteca/fila-marca.js` (novo, + teste) | estado da fila por empresa, trava, trabalhador, linha de comando |
| `08-FERRAMENTAS/tesseract/modelos/montar.js`, `estilos/*.js`, `README.md` | `--saida`, `--usar-marca`, `aceitaMarca` (Tarefa 8) |
| `_fabrica/paineis/biblioteca.js` (+ teste) | `previasMarca`, `videoMarca`, `marca.naMarca`, `marca.desatualizada`, `marca.progresso` |
| `_fabrica/paineis/servidor.js` (+ teste) | `GET` e `POST /api/previas-marca`; liga o trabalhador |
| `_fabrica/paineis/estilos.html`, `testes/telas.test.js` | interruptor aceso, cartões e detalhe na marca, progresso, pausar |
| `08-FERRAMENTAS/biblioteca/LEIA-ME.md`, `_fabrica/paineis/modelos/COMO-ACESSAR-laboratorio.md`, `CORE.md` | uso e explicação simples |
| `.gitignore`, `_fabrica/propriedade.json`, `08-FERRAMENTAS/validador-anti-vazamento/isentos.json` | prévias da empresa e registro do trabalhador fora do git; arquivos novos |

---

### Tarefa 1: assinatura da marca e leitura das prévias na marca

**Arquivos:** `08-FERRAMENTAS/biblioteca/previas-marca.js`, `08-FERRAMENTAS/biblioteca/previas-marca.test.js`.

**Pré-requisito:** nenhum (só o leitor `_fabrica/core/empresa.js` e o `08-FERRAMENTAS/marca/yaml.js`, que já existem).

**Interfaces produzidas** (o módulo nunca carrega `marca.js`, que fixaria a marca da empresa ativa; lê o YAML com `yaml.js`):
- `VERSAO = 1`: muda quando o jeito de gerar muda (assim as prévias antigas deixam de valer de propósito).
- `arquivosDaMarca(r, codigo) -> { marca: <abs> | null, letras: { principal, mono, acento }, logo }`: o `marca.yaml` da empresa
  (`empresa.caminhos(c, r).marca`) e os arquivos que ele cita, resolvidos na mesma ordem do servidor (`urlDeFonte`): pasta da
  marca da empresa, raiz dos dados, raiz do código; caminho com `..`, absoluto ou fora da Fábrica vira `null`.
- `assinaturaDaMarca(r, codigo, { comLogo = false } = {}) -> { assinatura: string | null, definida: bool }`: sha256 (16 primeiros
  caracteres) de `VERSAO`, dos bytes do `marca.yaml` e dos bytes de cada letra citada (letra que falta entra como o texto
  `ausente:<papel>`), e do logo quando `comLogo`. Sem `marca.yaml` próprio: `{ assinatura: null, definida: false }`. O conteúdo
  manda, não o caminho: mover o arquivo sem mudar nada não invalida as prévias.
- `previasValidas(r, codigo, id, assinatura) -> null | { capa, carrossel: [url], fixados: {apresentacao, metodo, contratar} | null,
  reelsCapa, video, videoCapa, avisos: [texto] }`: lê `<previas>/<id>/previas.json` e só devolve endereço de arquivo que existe,
  com `cores === 'marca'`, `empresa === codigo` e `assinatura` igual à pedida; o vídeo só com `videoAssinatura` igual. Endereços no
  formato `/empresas/<codigo>/previas/<id>/<arquivo>` (o servidor estático já serve essa pasta), com cada trecho por
  `encodeURIComponent` e nome de arquivo simples (a mesma regra `NOME_SIMPLES` do `biblioteca.js`).
- `pastaDaEmpresa(r, codigo)`: `empresa.caminhos(codigo, r).previas`, conferindo o código pela lista de empresas.

**Testes (falham antes),** numa raiz temporária com `aurora` e `boreal` (cada uma com `marca.yaml` fictício e uma letra OFL copiada
de `modelos/fontes/`) e a pasta antiga `principal`:
- mesma marca, mesma assinatura; trocar uma cor ou o arquivo de uma letra muda a assinatura; mover a pasta sem mudar o conteúdo
  não muda; `aurora` e `boreal` têm assinaturas diferentes;
- empresa sem `marca.yaml`: `definida: false`, `assinatura: null`;
- `previasValidas` recusa: assinatura velha, `cores: 'sugestao'`, `empresa: 'boreal'` dentro da pasta da `aurora`, arquivo citado
  que não existe, nome com `..` ou barra; o vídeo só vem com `videoAssinatura` certa;
- nenhum endereço devolvido para a `aurora` contém `boreal`; `codigo` `../x` ou inexistente: erro claro, nada lido;
- pasta antiga: a pasta é `empresas/principal/previas/`, e o `06-MARCA-E-FOTOS` fica idêntico.

- [ ] **Passos:** testes primeiro (ver falhar), implementar, bateria, validador, `conferir-caminhos`, commit "Prévias na marca, item
  7.1: assinatura da marca e leitura das prévias válidas de cada empresa".

---

### Tarefa 2: prévias na marca em imagem

**Arquivos:** `08-FERRAMENTAS/biblioteca/gerar-previas.js`, `gerar-previas.test.js`, `LEIA-ME.md`, `.gitignore`,
`08-FERRAMENTAS/validador-anti-vazamento/isentos.json` (hex fictício do teste).

**Pré-requisito:** Tarefa 1. Não depende da etapa 6.

**Interfaces produzidas:**
- `node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --marca <codigo> [--identidade exemplo|empresa]`:
  - no bloco de comando, **antes** de carregar qualquer módulo: confere o código pela lista de empresas, apaga `FABRICA_MARCA`,
    põe `FABRICA_EMPRESA=<codigo>` (e respeita `FABRICA_RAIZ`); `carregar()` passa a receber o modo (`base` ou `marca`) e só força
    a marca de exemplo no modo `base`, como hoje;
  - empresa sem `marca.yaml` próprio: sai com 1 e a mensagem "A empresa <nome> ainda não tem marca definida; as prévias na marca
    precisam dela.", sem gravar nada;
  - monta com `cores: 'marca'` e grava em `empresas/<c>/previas/<id>/` os mesmos arquivos das prévias base; o `previas.json` ganha
    `cores: 'marca'`, `empresa`, `assinatura` (Tarefa 1), `identidade` e `avisos`; o vídeo de uma rodada anterior continua se a
    `videoAssinatura` ainda for a de hoje, e sai do manifesto se não for;
  - **identidade** (decisão D1 da Tarefa 3): `exemplo` (padrão até a decisão) usa a identidade fictícia de hoje; `empresa` usa
    `empresa.nome` e `empresa.handle` do `marca.yaml` (e o logo, se D1 escolher a opção com logo, que entra na assinatura);
  - **avisos:** depois de montar cada formato, roda `conferir.conferirRender` (contraste AA e texto fora da lâmina, regras já
    calibradas do carrossel) e guarda em `avisos` o texto simples de cada achado ("Com as suas cores, o texto da lâmina 3 fica
    difícil de ler"). A prévia sai mesmo assim: ela mostra a verdade da marca;
  - sem meta de peso (as prévias da empresa não vão para o repositório), mas mantém a mesma escada de qualidade;
  - no fim, imprime uma linha por estilo e um resumo `feitos/total` que a fila lê.
- `node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] --marca-arquivo <yaml> --saida <pasta>`: as mesmas imagens com uma marca
  ainda não gravada (`FABRICA_MARCA=<yaml>`, sem `FABRICA_EMPRESA`); `--saida` é obrigatório e não pode ficar dentro de
  `04-LABORATORIO-DE-DESIGN/biblioteca/previas/`. Serve à etapa 8 ("as duas lado a lado antes de confirmar"); não grava assinatura
  de empresa.
- **Função para os outros módulos:** `gerarImagensNaMarca(r, codigo, { ids, identidade, aoAvancar }) -> Promise<{ feitos, total,
  falhas: [{ id, erro }] }>`, que roda o comando acima num processo filho (um por empresa; nunca no processo de quem chama) e
  avisa o progresso a cada estilo.
- **`.gitignore`:** `empresas/*/previas/` e `empresas/.fila-previas*.json` (decisão B3; até lá, esta é a minha escolha).

**Testes (falham antes),** com Chromium e ffmpeg, raiz temporária, 2 ou 3 estilos (`protagonista`, `primeira-pagina`, `cartilha`) e
as marcas fictícias (aurora com acento quente saturado, boreal com acento frio saturado, cores definidas no teste):
- `--marca aurora`: os arquivos existem em `empresas/aurora/previas/<id>/`, 1080 px de largura, `cores: 'marca'`, `empresa:
  'aurora'`, assinatura igual à da Tarefa 1; a capa tem pixels perto do acento da aurora e nenhum perto do acento da boreal;
  `--marca boreal` logo depois: o contrário; nada da boreal na pasta da aurora;
- ambiente sujo: com `FABRICA_MARCA` apontando para a boreal e `ativa.json` em `boreal`, `--marca aurora` sai com as cores da aurora;
- empresa sem `marca.yaml`: sai 1, nenhuma pasta criada;
- as prévias base (cópia de teste de `previas/`) ficam idênticas byte a byte; a pasta antiga também;
- `primeira-pagina` só com capa de Reels, como na base;
- marca com claro e escuro quase iguais: a prévia sai e `avisos` não fica vazio;
- `--marca-arquivo` sem `--saida`, ou com `--saida` dentro das prévias base: recusado;
- rodar de novo com a marca mudada troca a assinatura e tira do manifesto um vídeo de assinatura antiga.

- [ ] **Passos:** testes primeiro (ver falhar), implementar, rodar para `aurora` e `boreal` com os 27 estilos numa raiz temporária
  (tempo medido vai no `LEIA-ME.md`, que ganha a seção "Prévias na marca"), bateria, validador, `conferir-caminhos`, commit
  "Prévias na marca, item 7.2: imagens de cada estilo com as cores e letras da empresa, na pasta dela".

---

### Tarefa 3: página de opções de design (decisões do responsável)

**Arquivos:** só a pasta de trabalho (scratchpad `etapa7/opcoes.html` e as imagens). Nada entra no repositório.

**Pré-requisito:** Tarefa 2 (as opções usam as prévias na marca de verdade da `aurora` e da `boreal`).

Cada decisão vai renderizada lado a lado (A, B, C), em 1280 px e 400 px, com as duas empresas fictícias, numa página que o
controlador abre no navegador do responsável. A pergunta só aponta para as letras da página. Decisões:

- **D1. Identidade nas prévias na marca:** A, a identidade de exemplo de hoje; B, nome e conta da empresa; C, nome, conta e logo
  da empresa (capa de carrossel, fixado de apresentação e capa de Reels de dois estilos, um com foto e um sem).
- **D2. "Base e marca lado a lado" no detalhe:** A, duas imagens lado a lado na coluna da direita; B, a prévia grande da esquerda
  com um divisor arrastável (base de um lado, marca do outro); C, a prévia grande alterna com o interruptor e a direita mostra só a
  miniatura da outra versão.
- **D3. Selo do cartão quando a imagem já está na marca e o vídeo ainda não:** A, selo "Na sua marca" que vira "Modelo base"
  enquanto o vídeo base toca; B, selo duplo ("Imagem na sua marca" e "Vídeo: modelo base"); C, selo "Na sua marca" e um marcador
  pequeno "vídeo em preparo" no botão de tocar.
- **D4. Onde aparece o progresso ("Suas prévias de vídeo: 9 de 27"):** A, linha logo abaixo do interruptor, com "Pausar"; B, faixa
  fina no alto da página com a contagem e "Pausar"; C, só no cartão (cada cartão diz "vídeo em preparo") e uma contagem curta no
  interruptor.
- **D5. Aviso de texto difícil de ler com as cores da marca** (os `avisos` da Tarefa 2): A, nota no detalhe, perto de "Cores e
  letras"; B, marcador no cartão e nota no detalhe; C, nenhum aviso na grade, só em "Detalhes técnicos".
- **D6. Cores e letras no detalhe com a marca ligada:** A, só as da marca; B, as do estilo e as da marca lado a lado; C, as da
  marca, com as do estilo em "Detalhes técnicos".

- [ ] **Passos:** um script de trabalho (fora do repositório) monta a página a partir das prévias da Tarefa 2 e de recortes das
  telas atuais; capturas conferidas olhando; o controlador abre a página e registra as escolhas num arquivo de decisões do
  scratchpad (`etapa7/decisoes.txt`). As Tarefas 6 e 7 só começam com D1 a D6 decididas; a Tarefa 4 e a 5 podem seguir em paralelo.

---

### Tarefa 4: a fila por empresa e o trabalhador

**Arquivos:** `08-FERRAMENTAS/biblioteca/fila-marca.js`, `08-FERRAMENTAS/biblioteca/fila-marca.test.js`, `LEIA-ME.md`.

**Pré-requisito:** Tarefas 1 e 2. O vídeo real é da Tarefa 8: aqui o passo de vídeo é uma função trocável (`renderizarVideo`),
e o padrão, enquanto a Tarefa 8 não existe, marca cada estilo como `sem-modelo`.

**Interfaces produzidas:**
- **Estado** em `empresas/<c>/previas/fila.json` (gravado inteiro num arquivo temporário e renomeado):
  `{ versao: 1, empresa, assinatura, pedidoEm, pausada: bool, imagens: { estado, feitos, total, erro }, videos: [{ estilo, modelo,
  estado, erro, inicio, fim }] }`, com `estado` de imagens em `esperando | fazendo | pronto | erro` e de cada vídeo em
  `esperando | fazendo | pronto | erro | sem-fonte | sem-modelo`. A ordem dos vídeos é a da grade (`biblioteca.catalogo` da
  empresa, que segue a intenção).
- **Trava:** toda alteração passa por `alterarFila(r, codigo, fn)`, que segura `empresas/<c>/previas/.fila.trava` (criação
  exclusiva; trava com mais de 30 s é considerada abandonada), lê, aplica `fn` e grava. O servidor e o trabalhador usam só ela.
- **Ações:** `pedir(r, codigo)` (recusa sem marca definida; com a mesma assinatura e tudo pronto, não refaz; com assinatura nova,
  recomeça imagens e vídeos e mantém as prévias velhas no disco, que já não valem), `priorizar(r, codigo, id)` (põe o vídeo do
  estilo na frente dos que esperam; estilo fora do catálogo é recusado), `pausar`, `retomar`, `cancelar` (tira o que espera, não
  apaga prévia pronta) e `estado(r, codigo) -> { estado: 'nada' | 'imagens' | 'videos' | 'pausado' | 'pronto' | 'sem-marca',
  imagens, videos: { feitos, total, atual, semFonte, semModelo, erros }, desatualizada: bool, pausada, trabalhador: bool }`.
  `desatualizada` é verdade quando há prévias de uma assinatura que não é a de hoje.
- **Trabalhador:** `rodar(r, { gerarImagens, renderizarVideo, agora, batida })`:
  - registra-se em `empresas/.fila-previas.json` (`{ pid, raiz, inicio, batida }`, criação exclusiva); com um registro vivo
    (processo existe e batida com menos de 2 min), sai sem fazer nada; registro de processo morto é tomado;
  - ao começar, todo item `fazendo` de qualquer empresa volta para `esperando` (o anterior morreu no meio);
  - escolhe a empresa com trabalho e o pedido mais antigo; antes de cada passo confere a assinatura (mudou: recomeça aquela empresa)
    e a pausa; faz as imagens de uma vez (`gerarImagensNaMarca`, atualizando `feitos`) e depois um vídeo por vez;
  - bate a batida a cada 10 s enquanto um passo longo roda (os passos rodam em processo filho assíncrono, nunca `spawnSync`);
  - termina quando nenhuma empresa tem trabalho, e apaga o próprio registro.
- `garantirTrabalhador(r, { lancar }) -> bool`: se não há trabalhador vivo, lança `node fila-marca.js rodar` destacado, sem janela,
  com `FABRICA_RAIZ`; `lancar` é trocável nos testes.
- **Linha de comando** (para o agente e para quem prefere o terminal): `node 08-FERRAMENTAS/biblioteca/fila-marca.js estado <c> |
  pedir <c> | priorizar <c> <id> | pausar <c> | retomar <c> | cancelar <c> | rodar`. Saída em português simples; `estado --json`
  para o agente.

**Testes (falham antes),** sem Chromium nem `montar.js` (as duas funções trocadas por versões rápidas de teste, que gravam arquivos
pequenos e esperam alguns milissegundos):
- `pedir` sem marca: recusado, nada gravado; `pedir` duas vezes com a mesma assinatura e tudo pronto: nada muda;
- ordem: imagens primeiro, depois os vídeos na ordem da grade; `priorizar` no meio põe o estilo logo depois do que está rodando;
- `pausar` com um vídeo em andamento: ele termina e o próximo não começa; `retomar` continua; `cancelar` tira os que esperam e
  mantém os prontos;
- marca trocada no meio: o trabalhador recomeça a empresa com a assinatura nova, e as prévias velhas deixam de valer (Tarefa 1);
- trabalhador morto: registro com `pid` inexistente é tomado; item `fazendo` volta para `esperando`; dois `garantirTrabalhador`
  seguidos lançam um só;
- duas empresas com trabalho: as duas terminam, uma por vez, cada uma só com os próprios arquivos;
- `alterarFila` concorrente (dois processos alterando 50 vezes cada): nenhuma alteração perdida, `fila.json` sempre legível;
- erro num estilo não para os outros e fica com a mensagem em português.

- [ ] **Passos:** testes primeiro (ver falhar), implementar, bateria, validador, `conferir-caminhos`, commit "Prévias na marca, item
  7.4: fila por empresa e trabalhador em segundo plano, com pausa, prioridade e retomada".

---

### Tarefa 5: catálogo e rotas do painel

**Arquivos:** `_fabrica/paineis/biblioteca.js`, `_fabrica/paineis/testes/biblioteca.test.js`, `_fabrica/paineis/servidor.js`,
`_fabrica/paineis/testes/servidor.test.js`.

**Pré-requisito:** Tarefas 1 e 4.

**Interfaces produzidas:**
- `biblioteca.catalogo(r, codigo)`: cada estilo ganha `previasMarca` (o `previasValidas` da Tarefa 1 com a assinatura de hoje, ou
  `null`) e `videoMarca` (`pronto | esperando | fazendo | erro | sem-fonte | sem-modelo | null`, da fila); `marca` passa a ser
  `{ definida, naMarca, desatualizada, progresso }`, com `naMarca` verdadeiro quando ao menos um estilo tem `previasMarca` válida e
  `progresso` igual ao `estado` da fila (sem o campo `trabalhador`). Sem empresa (`codigo` null): tudo como hoje.
- `GET /api/previas-marca?empresa=<c>`: o `estado` da fila da empresa.
- `POST /api/previas-marca` com `{ empresa, acao, estilo? }`, `acao` em `gerar | priorizar | pausar | retomar | cancelar`:
  aplica a ação da Tarefa 4 e, em `gerar`, `retomar` e `priorizar`, chama `garantirTrabalhador`. Respostas: `{ ok: true, estado }`;
  recusas em português ("Defina a sua marca antes de ver os estilos nela.", "Este estilo não está na biblioteca."). Limite de corpo
  pequeno, como o de `/api/pedido`. O lançador do trabalhador é trocável em `criarServidor(r, { lancarTrabalhador })` para os
  testes não subirem processo de verdade.

**Testes (falham antes):**
- raiz temporária com `aurora` (prévias válidas em 2 estilos) e `boreal` (prévias de assinatura velha): o catálogo da `aurora` tem
  `naMarca: true` e endereços só `/empresas/aurora/previas/`; o da `boreal`, `naMarca: false` e `desatualizada: true`;
- `empresa=../x`, vazio, inexistente e corpo sem `empresa` com várias empresas, nas duas rotas: 400, nada gravado, nenhum trabalhador
  lançado; `acao` desconhecida e `estilo` inventado: 400;
- `gerar` na `boreal` sem `marca.yaml`: recusado; `gerar` na `aurora`: `fila.json` criado e um lançamento registrado; dois `gerar`
  seguidos: um lançamento só enquanto o primeiro está vivo;
- toda resposta traz `empresa` por último; a pasta antiga continua idêntica byte a byte;
- o servidor estático entrega `/empresas/aurora/previas/<id>/capa...` com o tipo certo e recusa `/empresas/.fila-previas.json`
  (segmento com ponto, regra que já existe).

- [ ] **Passos:** testes primeiro (ver falhar), implementar, bateria, validador, `conferir-caminhos`, commit "Prévias na marca, item
  7.5: o catálogo entrega as prévias na marca válidas e o painel pede, acompanha e pausa a geração".

---

### Tarefa 6: tela da biblioteca, a grade na marca

**Arquivos:** `_fabrica/paineis/estilos.html`, `_fabrica/paineis/testes/telas.test.js`.

**Pré-requisito:** Tarefa 5 e as decisões D3, D4 e D5 da Tarefa 3.

**Comportamento:**
- **Interruptor:** aceso quando `marca.naMarca`; com prévias prontas, a página abre em "Na minha marca" (objetivo 3 do desenho:
  "veja os estilos já com a cara da marca dele"; decisão B2 confirma). Sem marca: apagado, como na etapa 5.
- **Botão de começar:** com a marca definida e nenhuma prévia, a nota do interruptor vira "Ver os estilos na minha marca", que
  envia `gerar`. Com `desatualizada` e uma geração já pedida antes, a página envia `gerar` sozinha ao abrir (decisão B2) e diz "Sua
  marca mudou. Estamos refazendo as prévias.".
- **Cartões na marca:** capa e lâminas de `previasMarca` com o selo "Na sua marca"; estilo sem `previasMarca` fica com a base e o
  selo "Modelo base". Vídeo: o da marca quando `videoMarca` é `pronto`; senão o vídeo base, com o selo no estado decidido em D3.
  Continua um vídeo por vez e nada sozinho.
- **Progresso** (lugar e forma de D4): "Preparando suas prévias na marca: 12 de 27" durante as imagens, depois "Suas prévias de
  vídeo: 9 de 27", com "Pausar" e "Continuar"; "Algumas prévias de vídeo precisam do vídeo de demonstração neste computador"
  quando há `sem-fonte`.
- **Consulta:** `seletor.ler('/api/previas-marca')` a cada 5 s só enquanto o estado é `imagens` ou `videos` e a página está à vista;
  quando `imagens.feitos` ou `videos.feitos` muda, relê `/api/biblioteca` e troca só os cartões que mudaram (filtros, rolagem, foco e
  o vídeo que está tocando ficam como estão). Trocar de empresa para a consulta e descarta a resposta da anterior.
- **Endereços:** `enderecoLocal` passa a aceitar também `/empresas/<empresa atual>/previas/<id>/<arquivo>` (com a mesma regra
  contra `..`, `%2e`, barra invertida, `?` e `#`); endereço de outra empresa é descartado.
- Avisos de D5 conforme a decisão. Funciona em 400 px sem rolagem lateral.

**Testes:** contrato no `telas.test.js`: as leituras novas passam por `seletor.ler('/api/previas-marca')` e os envios por
`seletor.enviar('/api/previas-marca', ...)`, sem `fetch` próprio; a consulta usa um só temporizador, que é limpo ao trocar de
empresa e quando `document.hidden`; nenhum `<video>` com `autoplay`; o selo "Na sua marca" só nasce de `previasMarca`; endereço com
outra empresa é recusado por `enderecoLocal` (teste que roda a função extraída do HTML); os textos visíveis não têm as palavras
proibidas. **Prova visual** (scratchpad `etapa7/`, `aurora` e `boreal`, 1280 px e 400 px): grade na base e na marca; geração das
imagens em andamento; imagens prontas e vídeos em andamento com um cartão tocando o vídeo base; tudo pronto com um cartão tocando o
vídeo na marca; marca mudada; empresa sem marca. Conferir olhando: nenhuma cor da outra empresa, selo certo em cada cartão.

- [ ] **Passos:** escrever, teste de contrato, prova visual, validador, commit "Prévias na marca, item 7.6: grade com o interruptor
  aceso, cartões na marca da empresa e o progresso das prévias de vídeo".

---

### Tarefa 7: tela da biblioteca, o detalhe na marca

**Arquivos:** `_fabrica/paineis/estilos.html`, `_fabrica/paineis/testes/telas.test.js`, `08-FERRAMENTAS/biblioteca/previas-marca.js`
(+ teste, a nota da letra de destaque).

**Pré-requisito:** Tarefa 6 e as decisões D2, D5 e D6.

**Comportamento:**
- **Abas:** com a marca ligada, cada aba mostra a versão na marca (carrossel, fixados, capa de Reels, vídeo quando pronto); o que
  ainda não existe na marca mostra a base com "Modelo base" escrito na própria aba.
- **Passar para a frente:** abrir o detalhe de um estilo com `videoMarca` `esperando` envia `priorizar` (uma vez por abertura), e a
  aba Vídeo diz "Seu vídeo deste estilo é o próximo a ficar pronto".
- **Base e marca lado a lado** conforme D2, cada lado com a legenda "Modelo base" ou "Na sua marca"; sem marca, a nota de hoje.
- **Cores e letras** conforme D6; em "Detalhes técnicos", com a marca ligada, os códigos das cores da marca e a nota da letra de
  destaque (spec 10): `notaDestaque(r, codigo, estilo)`, nova em `previas-marca.js`, diz, em português, quando o estilo destaca em itálico e a letra
  principal da marca não tem itálico ("No destaque, este estilo usa a letra itálica dele, porque a sua letra principal não tem
  itálico."), pela mesma regra do `tema-marca.js` (nome do arquivo ou `tipografia.principal.italico`).
- Avisos de contraste conforme D5. Trocar de empresa fecha o detalhe (regra da etapa 5).

**Testes:** `previas-marca.test.js` cobre a nota (destaque itálico com e sem itálico na marca, estilo sem destaque itálico);
contrato: o `priorizar` sai pelo `seletor.enviar` com a empresa por último e só uma vez por abertura; com outra empresa no seletor
a resposta é descartada. **Prova visual:** detalhe na base e na marca, com vídeo pronto e em preparo, lado a lado de D2, Primeira
Página (só capa de Reels), em 1280 px e 400 px, para `aurora` e `boreal`.

- [ ] **Passos:** escrever, testes, prova visual, validador, commit "Prévias na marca, item 7.7: detalhe do estilo na marca, base e
  marca lado a lado e o estilo aberto passa para a frente".

---

### Tarefa 8: vídeo na marca de verdade na fila

**Arquivos:** `08-FERRAMENTAS/tesseract/modelos/montar.js`, `estilos/_inverso.js`, `estilos/concreto-acido.js`,
`estilos/luz-de-vela.js` (e os 13 antigos, se a etapa 6 já os entregou), `modelos/README.md`, `08-FERRAMENTAS/biblioteca/fila-marca.js`
(+ teste), `LEIA-ME.md`.

**Pré-requisito:** os pontos do "Contrato assumido com a etapa 6" marcados como prontos já estão no ramo `biblioteca`; os itens 6.3 e
6.4 podem chegar depois (os modelos deles ficam `sem-modelo` até lá). A Tarefa 4 pronta.

**Interfaces produzidas:**
- `montar.js <modelo> <pedido.json> --exportar --saida <pasta> --usar-marca`: `--saida` troca a pasta do `.tsrct`, do MP4 e da folha
  de quadros (o `.cache` das cenas continua ao lado do pedido); `--usar-marca` vale como `usarMarca: true` sem mexer no pedido. Sem
  as duas opções, tudo igual a hoje (teste por comparação do projeto gerado).
- `aceitaMarca: true` no objeto exportado por todo modelo que troca a paleta inteira pelo `ctx.marca` (os 12 de `_inverso`,
  Concreto Ácido, Luz de Vela e, quando a etapa 6 os entregar, os 13 antigos). O README diz que modelo novo só entra na prévia na
  marca com essa marca.
- `renderizarVideoNaMarca(r, codigo, id, { pedidoDemo })` como `renderizarVideo` padrão da fila:
  - modelo do estilo (`formatos.reels.modelo`) sem `aceitaMarca`: `sem-modelo`, nada gravado;
  - fonte do vídeo: `FABRICA_PEDIDO_DEMONSTRACAO` ou `08-FERRAMENTAS/tesseract/modelos/amostra/pedido-demonstracao.json`; sem o
    pedido ou sem o vídeo que ele cita: `sem-fonte` (decisão B1 define o que muda fora deste computador);
  - roda `montar.js` em processo filho assíncrono, com `FABRICA_EMPRESA=<c>`, `FABRICA_RAIZ`, sem `FABRICA_MARCA`, saída em
    `empresas/<c>/previas/.trabalho/<modelo>/` (pasta com ponto: o servidor estático não a entrega), tempo-limite de 20 min;
  - log com `[marca]` de contraste ou de letra vira `avisos` do estilo;
  - corta o trecho com `cortarTrecho` (12 s, `lerPedidoVideo` para o início), grava `video.webm` e `video-capa.webp` na pasta do
    estilo, `videoAssinatura` no `previas.json` e apaga a pasta de trabalho do modelo; falha no meio não deixa `video.webm` pela
    metade (grava em nome temporário e renomeia no fim).

**Testes (falham antes):**
- `montar.js` com `--saida` numa pasta temporária: nada novo em `saida/` ao lado do pedido; sem as opções, igual a hoje;
- `aceitaMarca` presente nos 14 modelos prontos e ausente nos que ainda não leem `ctx.marca` (lista conferida contra o código: todo
  modelo com `aceitaMarca` usa `ctx.marca`);
- `renderizarVideoNaMarca` com um MP4 sintético (`testsrc`, como o teste da etapa 4) no lugar do `montar.js` (função trocável):
  `sem-fonte` sem pedido, `sem-modelo` sem `aceitaMarca`, trecho de 12 s sem áudio, manifesto com `videoAssinatura`, nada fora da
  pasta da empresa;
- um teste longo, só com `FABRICA_TESTE_VIDEO=1` e o vídeo de demonstração presente, monta um modelo de verdade na `aurora`.

**Prova visual** (scratchpad, vídeo de demonstração local, nunca no git): folhas de contato dos 14 modelos (e dos 27, quando a etapa 6
fechar) na `aurora` e na `boreal`, ao lado do vídeo base do mesmo estilo; conferir olhando: pessoa em cena com a imagem, rosto inteiro
e livre, texto legível e dentro da tela, cores da empresa certa. Depois, a grade da Tarefa 6 com os vídeos na marca tocando.

- [ ] **Passos:** testes primeiro (ver falhar), implementar, prova visual, bateria, validador, `conferir-caminhos`, commit "Prévias na
  marca, item 7.8: vídeo de cada estilo na marca da empresa, montado pela fila".

---

### Tarefa 9: ponta a ponta, guias e fechamento

- [ ] **Passo 1:** ponta a ponta numa raiz temporária com `aurora`, `boreal` e a pasta antiga: abrir a biblioteca, pedir as prévias da
  `aurora`, mudar de empresa durante a geração, mudar a marca da `aurora` no meio, matar o trabalhador e pedir de novo. Conferir:
  nada da `boreal` na `aurora` (amostragem de pixels e `validar.js --empresa aurora` saindo 0 sobre a pasta da `aurora`; um termo da
  `boreal` plantado num arquivo de teste da pasta da `aurora` faz sair 1), nenhuma prévia velha como "Na sua marca", prévias base e
  pasta antiga idênticas byte a byte. Teste automático para o que der (sem o vídeo real), prova visual para o resto.
- [ ] **Passo 2:** `08-FERRAMENTAS/biblioteca/LEIA-ME.md` (seção "Prévias na marca": comandos, onde ficam, assinatura, fila, por que
  ficam fora do git); `modelos/README.md` (`--saida`, `--usar-marca`, `aceitaMarca`); `COMO-ACESSAR-laboratorio.md`, em português
  simples: "Na minha marca", quanto tempo leva, que dá para pausar e que o vídeo base aparece até o seu ficar pronto; `CORE.md`, onde a
  biblioteca já é citada: os comandos `fila-marca.js estado|pedir` para o agente (a execução dos pedidos pelo agente continua na
  etapa 8). Sem as palavras proibidas.
- [ ] **Passo 3:** `propriedade.json` (`08-FERRAMENTAS/biblioteca/` já é do modelo; `empresas/` já é da empresa: conferir que
  `empresas/*/previas/` e `empresas/.fila-previas.json` caem no que é da empresa) e `isentos.json` dos arquivos novos, se o validador
  acusar.
- [ ] **Passo 4:** bateria completa, validador, `conferir-caminhos.js`, commit "Prévias na marca, item 7.9: ponta a ponta, guias e
  fechamento". Página com as telas desta etapa no scratchpad, aberta no navegador do responsável.

## Decisões do responsável

Decisões visuais (Tarefa 3, opções renderizadas lado a lado): **D1** identidade, **D2** base e marca lado a lado, **D3** selo no
estado misto, **D4** lugar do progresso, **D5** aviso de texto difícil de ler, **D6** cores e letras no detalhe.

Decisões de funcionamento (vão com uma prévia de cada caminho na mesma página, quando houver tela envolvida):
- **B1. Fonte do vídeo fora deste computador.** O vídeo de demonstração não vai ao git, então quem instala a Fábrica não tem com o
  que montar o vídeo na marca. Caminhos: (a) uma versão leve e liberada do vídeo de demonstração entra no repositório (e a regra de
  hoje muda); (b) a Fábrica baixa o vídeo só quando a pessoa pede; (c) a prévia usa um vídeo curto da própria pessoa; (d) fora deste
  computador, o vídeo fica sempre no base, com o aviso. Até decidir: (d), que é o único que não muda nenhuma regra.
- **B2. Quando a geração começa.** Minha escolha: pelo botão "Ver os estilos na minha marca" na primeira vez; depois, sozinha quando a
  marca muda (ao abrir a biblioteca ou quando a etapa 8 grava a marca); abrir a página já em "Na minha marca" quando houver prévias.
- **B3. Prévias da empresa fora do git** (`empresas/*/previas/`). Minha escolha: fora, porque se refazem e podem mostrar uma pessoa.
- **B4. Regra da letra de destaque também nas imagens.** No vídeo, a etapa 6 usa a letra itálica do estilo quando a da marca não tem
  itálico; nas lâminas, o navegador inclina a letra sozinho. Aplicar a mesma regra muda o carrossel de produção (`molde.js`), então
  fica fora desta etapa até ele decidir, com antes e depois lado a lado.

## Fora desta etapa

O agente executar os pedidos e o caminho do usuário em 6 passos, inclusive gravar a marca, "Personalizar" com prévia, "Criar do zero" e
"Enviar referências" sem marca (etapa 8, que usa o `--marca-arquivo` desta etapa para mostrar a marca nova antes de confirmar e chama
`fila-marca.js pedir` depois de gravar); migração da pasta antiga (etapa 9); a regra da letra de destaque nas lâminas (B4); vídeo na
marca com o vídeo da própria pessoa (B1, caminho c).

## Autoexame

**Lacunas conhecidas:**
- Sem a decisão B1, a prévia de vídeo na marca só existe no computador que tem o vídeo de demonstração. Para quem instala, a tela
  mostra o vídeo base e o aviso; isso cumpre "nunca vídeo falso", mas não entrega o vídeo na marca.
- Os `avisos` de contraste das imagens vêm do conferidor do carrossel, que mede na página; nas capas de Reels e nos fixados ele vale
  pelo mesmo critério, mas não foi calibrado com um caso que falha nesses formatos. A Tarefa 2 acrescenta um caso que falha.
- As cores fixas que um estilo tem fora dos quatro papéis (no `estilo.css`) continuam as do estilo na marca, como já acontece no
  carrossel de produção. A prova visual mostra quanto isso pesa em cada estilo.
- O servidor estático já entrega qualquer arquivo de `empresas/` para quem está neste computador; a proteção entre empresas é a do
  catálogo e da tela (endereços só da empresa do seletor), não do disco. Não muda nesta etapa.

**Dependências cruzadas:**
- **Etapa 6:** a Tarefa 8 depende do contrato da tabela acima. Os itens 6.3 e 6.4 (13 modelos antigos) correm em outros ramos: até
  entrarem, 13 estilos ficam `sem-modelo` (vídeo base). O `aceitaMarca` é contrato novo: se a etapa 6 escolher outro sinal, a Tarefa 8
  se adapta. Risco de conflito no `montar.js` (`--saida`, `--usar-marca`) com o que as tarefas 6.3 e 6.4 mexerem: a Tarefa 8 entra
  depois delas, ou mexe só no bloco de argumentos.
- **Etapa 8:** consome `gerar-previas.js --marca-arquivo` (marca antes de confirmar), `fila-marca.js pedir` (depois de gravar a marca)
  e o catálogo com `previasMarca`. "Usar um dos nossos" grava a marca com as cores do estilo: a prévia desse estilo fica igual à base,
  e as outras ganham a marca nova (a assinatura cuida disso). O selo e o lado a lado de D2 são os mesmos que a etapa 8 vai mostrar na
  troca de marca real; decidir D2 pensando nos dois usos.
- **Etapa 9:** a migração muda onde o `marca.yaml` fica, não o conteúdo; a assinatura é do conteúdo, então as prévias continuam
  valendo, a não ser que a migração reescreva os caminhos das letras dentro do `marca.yaml` (aí elas se refazem, sem erro). As prévias já
  moram em `empresas/principal/previas/` nas duas disposições, então a migração não precisa movê-las.

**Riscos:**
- **Peso de máquina:** 27 vídeos levam cerca de duas horas de processamento por empresa. Mitigação: um vídeo por vez, pausa, o estilo
  aberto vai para a frente, o trabalhador termina sozinho. Se o agente estiver montando um Reels de verdade ao mesmo tempo, os dois
  disputam a máquina; a fila não para sozinha (possível melhoria: pausar enquanto há outro `montar.js` rodando).
- **Dois `montar.js` no mesmo modelo** já deram "Acesso negado" antes; com `--saida` separada o risco cai, e o teste longo da Tarefa 8
  roda um modelo enquanto outro processo monta o mesmo, para confirmar.
- **Disco:** cada empresa ganha cerca de 40 MB de prévias (imagens e vídeos), fora do git. Prévias velhas não são apagadas sozinhas
  nesta etapa (só deixam de valer); a próxima geração da mesma empresa as substitui estilo a estilo.
- **Letra da empresa fora da pasta dela ou ausente:** a imagem cai na letra padrão do navegador e o vídeo na letra do estilo (etapa 6);
  a assinatura registra a ausência, e o aviso aparece no detalhe técnico.
