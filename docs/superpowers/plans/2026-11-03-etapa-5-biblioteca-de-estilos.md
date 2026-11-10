# Etapa 5: biblioteca de estilos no Laboratório — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o usuário final abre a biblioteca no painel local, vê os 27 estilos numa grade leve com as prévias base, entende
que cada estilo é uma base (aviso e interruptor "Modelo base / Na minha marca", padrão B), filtra por nicho, tom e "funciona
sem foto", abre o detalhe do estilo e decide: usar, personalizar ou pedir um estilo novo.

**Arquitetura:**
- O servidor dos painéis (`_fabrica/paineis/servidor.js`) ganha duas rotas por empresa: `GET /api/biblioteca` (catálogo
  pronto para a tela: estilos, campos, prévias, vocabulário, marca) e `POST /api/pedido` (grava um pedido ao agente na pasta da
  empresa). Leitura dos `estilo.yaml` pelo leitor próprio `08-FERRAMENTAS/marca/yaml.js` (nunca `marca.js`, que valida a marca ao
  ser carregado).
- Uma tela nova, `_fabrica/paineis/estilos.html`, no mesmo desenho do Laboratório e do Cronograma (mesmo seletor de empresa,
  mesmo aviso, mesmas cores da marca), com as duas visões: grade e detalhe.
- As prévias já existem (etapa 4) em `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/` e saem pelo servidor de arquivos.

**Tecnologia:** Node (módulos nativos), HTML/CSS/JS simples nas telas (sem build, sem biblioteca externa), testes em scripts
`node` com `assert`, prova visual com Chromium (Playwright), como na etapa 3.

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 8.1, 8.2, 8.4, 9 (pedidos) e 12
(etapa 5). Etapas anteriores: etapa 3 (`docs/superpowers/plans/2026-11-02-etapa-3-paineis-por-empresa.md`) e etapa 4
(`docs/superpowers/plans/2026-11-02-etapa-4-previas-base.md`).

## Restrições globais

- **Aviso de modelo base (padrão B, decisão do responsável):** aviso "Estes são modelos base. Cores e letras viram as da sua
  marca. Você pode ajustar tudo depois." no topo, interruptor "Modelo base / Na minha marca" e selo em cada cartão.
- **Nunca mostrar prévia falsa:** as prévias "na minha marca" só chegam na etapa 7. Até lá o interruptor "Na minha marca" fica
  apagado, com a explicação "Suas prévias na marca ainda não foram geradas", e todo cartão leva o selo "Modelo base".
- **Prévias com as cores originais do estilo** (as da etapa 4); a paleta da empresa só entra na etapa 7.
- **Grade leve:** nunca toca mais de um vídeo ao mesmo tempo; vídeo só ao passar o mouse ou tocar no cartão; imagens com
  `loading="lazy"`; abre rápido com 27 estilos.
- **Toda escolha de design vem com prévia; nada de pergunta por texto.** Texto ao usuário final em português simples, sem
  "gaveta", "disposição", "índice", "legado", "manifesto", "webp" ou nome de arquivo.
- **Uma empresa nunca vê dados de outra:** toda rota recebe e confere a empresa, como as da etapa 3. O pedido grava só na
  pasta da empresa do pedido.
- **O seletor de empresa do painel não troca a empresa ativa do agente** (regra da etapa 3).
- **Ler dados só pelas rotas `/api/...`**, nunca por caminho estático de JSON; toda leitura e todo envio passam por
  `empresa-seletor.js` (`ler` e `enviar`).
- **Sem biblioteca externa nem CDN;** a tela funciona offline pelo servidor local; funciona em 400 px sem rolagem lateral.
- **Git:** sem `push`, `pull`, `merge`, `reset` ou `stash`. Commit local por tarefa, no ramo `biblioteca`. Antes de cada commit,
  o validador anti-vazamento (com a lista privada) e `node _fabrica/core/conferir-caminhos.js` saem `0`.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit.
- Nenhum dado, nome, cor ou texto de empresa real nas telas e nos testes. Só empresas fictícias (`aurora`, `boreal`).

## Foco da revisão

1. **`empresa=` com `../`, vazio ou inexistente** em `/api/biblioteca` e `/api/pedido`: erro claro, nada lido nem gravado fora da
   pasta da empresa.
2. **Pedido com tipo ou estilo inventado:** recusado (só os tipos `usar-estilo`, `personalizar` e `estilo-novo`, e só estilos que
   existem no catálogo). Nada é gravado.
3. **Troca de empresa durante um pedido em andamento:** a resposta de uma empresa nunca aparece na tela da outra.
4. **Estilo sem prévia, sem vídeo ou só com capa de Reels (Primeira Página):** o cartão e o detalhe mostram só o que existe, sem
   erro e sem quadro vazio.
5. **Nenhum vídeo toca sozinho:** com a página aberta e o mouse parado, nenhum vídeo está tocando.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `_fabrica/paineis/biblioteca.js` (novo, + teste) | monta o catálogo da tela e grava pedidos |
| `_fabrica/paineis/servidor.js` (+ teste) | rotas `GET /api/biblioteca` e `POST /api/pedido` |
| `_fabrica/paineis/estilos.html` (novo) | tela da biblioteca: aviso, interruptor, filtros, grade e detalhe |
| `_fabrica/paineis/laboratorio.html`, `cronograma.html` | link "Estilos" no alto, junto dos outros |
| `_fabrica/paineis/testes/telas.test.js` | contrato da tela nova |
| `_fabrica/paineis/modelos/COMO-ACESSAR-*.md`, `CORE.md` | guias para o usuário final |
| `_fabrica/propriedade.json`, `isentos.json` | entradas dos arquivos novos |

---

### Tarefa 1: catálogo e pedidos no servidor

**Arquivos:** `_fabrica/paineis/biblioteca.js`, `_fabrica/paineis/testes/biblioteca.test.js`, `_fabrica/paineis/servidor.js`,
`_fabrica/paineis/testes/servidor.test.js`.

**Interfaces produzidas:**
- `biblioteca.catalogo(r, codigo) -> { empresa, vocabulario, estilos, marca }`, em que:
  - `vocabulario`: `{ 'combina-com': {codigo: rótulo}, tom: {...}, precisa: {...} }` (de
    `04-LABORATORIO-DE-DESIGN/biblioteca/vocabulario.json`);
  - cada item de `estilos`: `{ id, nome, linha, combinaCom: [{codigo, rotulo}], tom: [...], precisa: [...], cores: {escuro,
    claro, acento, neutro}, fontes: {principal, mono, acento}, tratamentos, regras: [texto...], formatos: ['video',
    'carrossel', 'capa-reels', 'fixados'] (só os que têm prévia), previas: { capa, carrossel: [url...], fixados: {apresentacao,
    metodo, contratar}, reelsCapa, video, videoCapa } }`, com as urls já como endereço servido pelo servidor, começando com
    `/04-LABORATORIO-DE-DESIGN/biblioteca/previas/<id>/`, e `null`/`[]` no que o estilo não tem;
  - `marca`: `{ definida: bool, naMarca: false }`. `definida` é `true` quando a empresa tem `marca.yaml` próprio (não o exemplo).
    `naMarca` é `true` só quando existirem prévias na marca da empresa (etapa 7); hoje é sempre `false`;
  - ordem dos estilos: a da intenção da empresa (`empresas/<c>/intencao.json`, lista `quer` com `video`, `carrossel`, `post`;
    sem o arquivo, vale a ordem do catálogo). A intenção só **ordena**, nunca esconde estilo.
- `biblioteca.gravarPedido(r, codigo, { tipo, estilo, nota? }) -> { arquivo, mensagem }`: grava
  `empresas/<codigo>/pedidos/<AAAA-MM-DD-HHMMSS>-<tipo>.json` com `{ tipo, estilo, nota, criado }`, sem sobrescrever (sufixo `-2`),
  e devolve `mensagem: 'Pronto. No Claude, digite /fabrica continuar'`. Tipos aceitos: `usar-estilo`, `personalizar`, `estilo-novo`.
  `estilo` é obrigatório nos dois primeiros e precisa existir no catálogo; `nota` tem até 500 caracteres.
- Servidor: `GET /api/biblioteca?empresa=<c>` devolve `catalogo` (com `empresa`); `POST /api/pedido` recebe `{ empresa, tipo,
  estilo, nota }` e devolve `{ ok: true, empresa, mensagem }`. Mesmas regras de empresa das outras rotas (`empresaDoPedido`,
  400 com várias empresas e sem `empresa` no corpo, `empresa` por último na resposta).

**Testes (falham antes):**
- raiz temporária com `aurora` e `boreal`; catálogo das duas igual no conteúdo, com `empresa` correto; `empresa=../x`, vazio e
  inexistente: 400 sem ler nada;
- estilo só de capa de Reels (`primeira-pagina`): `formatos` só `capa-reels`, `previas.carrossel` vazio;
- ordem pela intenção: `quer: ['video']` põe primeiro os estilos que têm vídeo; sem arquivo, ordem do catálogo; arquivo de intenção
  quebrado não derruba (ordem do catálogo);
- pedido: grava na pasta da empresa certa e só nela; tipo desconhecido, estilo inexistente, nota de 501 caracteres e corpo sem
  `empresa` com várias empresas: recusados, nada gravado; dois pedidos no mesmo segundo não se sobrescrevem;
- pasta antiga (`principal`): o pedido cai em `empresas/principal/pedidos/`, e os arquivos antigos ficam idênticos byte a byte.

- [ ] **Passos:** testes primeiro (ver falhar), implementar, bateria completa, validador, `conferir-caminhos`, commit "Biblioteca,
  item 5.1: o servidor entrega o catálogo da biblioteca e grava pedidos ao agente, por empresa".

---

### Tarefa 2: tela da biblioteca, a grade

**Arquivos:** `_fabrica/paineis/estilos.html` (novo), `_fabrica/paineis/laboratorio.html` e `cronograma.html` (link), 
`_fabrica/paineis/testes/telas.test.js`.

**Comportamento** (referência: as telas do Laboratório e do Cronograma, o mesmo cabeçalho, seletor, aviso e cores da empresa):
- **Topo:** título "Estilos"; aviso de modelo base (texto da restrição global); interruptor "Modelo base / Na minha marca", apagado
  quando `marca.naMarca` é falso, com a explicação em texto simples; busca por nome; filtros por nicho ("Combina com"), tom e
  "Funciona sem foto", como botões de escolha que se somam, e botão "Limpar filtros" com a contagem "12 de 27 estilos".
- **Cartões:** capa do estilo (a primeira lâmina, ou a capa de Reels), nome, uma frase (`linha`), até 3 marcadores de "Combina
  com", selo "Modelo base" no canto. Ao passar o mouse (ou tocar), o cartão mostra o vídeo do estilo, **um de cada vez** (ao
  começar outro, o anterior para); sem vídeo, o cartão passa as lâminas do carrossel ao passar o mouse; sem as duas coisas, só a
  capa. Clicar no cartão abre o detalhe (Tarefa 3).
- **Estados:** nenhum estilo com os filtros ("Nenhum estilo combina com esses filtros. Limpe um filtro."); biblioteca vazia; erro de
  rede em português simples.
- **Empresa:** troca de empresa recarrega a grade; resposta de outra empresa é descartada (já resolvido por `empresa-seletor.js`).
- Funciona em 400 px (uma coluna) e sem rolagem lateral; as imagens têm `loading="lazy"`; os vídeos têm `preload="none"`.

**Testes:** o servidor entrega `/_fabrica/paineis/estilos.html`; teste de contrato lê o HTML e confere: toda leitura passa por
`seletor.ler('/api/biblioteca')` e todo envio por `seletor.enviar`, sem `fetch` próprio e sem `.json` por caminho estático, o
aviso de modelo base e o interruptor existem, nenhum `<video>` tem `autoplay`, os textos visíveis não têm as palavras proibidas.
Prova visual (como na etapa 3, capturas com duas empresas fictícias) em
`...\scratchpad\etapa5\`: grade em 1280 px e em 400 px, com filtro aplicado, sem resultado, com um vídeo tocando no cartão.

- [ ] **Passos:** escrever a tela, teste de contrato, prova visual, validador, commit "Biblioteca, item 5.2: tela de estilos com
  aviso de modelo base, interruptor, filtros e grade".

---

### Tarefa 3: tela da biblioteca, o detalhe do estilo

**Arquivo:** `_fabrica/paineis/estilos.html` e `_fabrica/paineis/testes/telas.test.js`.

**Comportamento (spec 8.4):**
- **À esquerda:** abas **Vídeo**, **Carrossel**, **Capa de Reels** e **Posts fixados** (só as que o estilo tem; a primeira aberta
  segue a intenção da empresa, senão Carrossel). O carrossel é um slider com arraste (ponteiro e teclado), com contador. O vídeo
  toca só quando a pessoa aperta o play.
- **À direita:** nome e frase; "Combina com" e "O que precisa" com os rótulos do vocabulário; "Base e marca lado a lado" (hoje só
  a base, com a nota "Suas prévias na marca chegam depois de você definir a marca"); cores (quatro quadrados com nome em português:
  escuro, claro, acento, neutro) e letras (nome da família); os três passos "Como este estilo vira seu" (1. Você escolhe a marca,
  2. A Fábrica troca as cores e as letras, 3. Você ajusta o que quiser); "Detalhes técnicos" recolhido, com fontes, códigos das
  cores e tratamentos.
- **Botões:** "Usar este estilo", "Personalizar" e "Criar um estilo novo a partir de referências". Cada um chama `POST /api/pedido`
  (`usar-estilo`, `personalizar`, `estilo-novo`, o último com campo de nota de até 500 caracteres) e mostra a mensagem do servidor
  ("Pronto. No Claude, digite /fabrica continuar") com o nome da empresa. Durante o envio o botão fica desligado; trocar de empresa
  fecha o detalhe.
- Voltar para a grade mantém os filtros e a posição da rolagem; endereço com `#estilo=<id>` abre o detalhe direto.
- Teclado: Esc fecha, setas passam as lâminas; foco visível; tela funciona em 400 px.

**Testes:** contrato (o pedido leva a empresa por último; o botão desliga durante o envio; as abas só existem para o que há
prévia; `Esc` fecha); prova visual: detalhe com carrossel, com vídeo, de um estilo só de capa de Reels (Primeira Página), em
1280 px e 400 px, o pedido enviado com a mensagem de sucesso.

- [ ] **Passos:** escrever o detalhe, teste de contrato, prova visual, validador, commit "Biblioteca, item 5.3: detalhe do estilo
  com abas, slider, campos e pedidos ao agente".

---

### Tarefa 4: atalhos, guias e fechamento

- [ ] **Passo 1:** `COMO-ACESSAR-laboratorio.md` (e o do cronograma, se citar o menu) falam da aba "Estilos", em português
  simples e curto: como abrir, o aviso de modelo base, filtros, detalhe e "Usar este estilo". Sem as palavras proibidas.
- [ ] **Passo 2:** `CORE.md`, subseção "Empresas" (ou onde os painéis já são citados): a biblioteca de estilos, o pedido que o painel
  grava em `empresas/<c>/pedidos/` e que o agente lê com `/fabrica continuar` (a leitura pelo agente é a etapa 8).
- [ ] **Passo 3:** `propriedade.json` (`_fabrica/paineis/` é do modelo; `empresas/*/pedidos/` já é da empresa) e `isentos.json` dos
  arquivos novos, se o validador acusar.
- [ ] **Passo 4:** bateria completa, validador, `conferir-caminhos.js`, commit.

## Fora desta etapa

Prévias "na minha marca" e a fila de vídeo (etapa 7), modelos de vídeo com paleta e fontes da marca (etapa 6), o agente ler os
pedidos e o caminho do usuário em 6 passos (etapa 8), migração (etapa 9), e a aba "Post único" (não há prévia desse formato).
