# Etapa 4: prévias base e campos da biblioteca — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** cada um dos 27 estilos do catálogo ganha as prévias base (imagens leves, guardadas no repositório) e os
campos `combina-com`, `tom` e `precisa`, que a biblioteca da etapa 5 vai mostrar e filtrar. O vídeo de cada estilo já
pode ser gerado, mas só fica no repositório quando o vídeo de demonstração liberado existir.

**Arquitetura:**
- Um script novo, `08-FERRAMENTAS/biblioteca/gerar-previas.js`, monta as peças de demonstração de cada estilo com o
  `molde.js` (o mesmo do `previa.js` do catálogo), fotografa com o `render.js` do carrossel e converte para `.webp`
  com o ffmpeg.
- As prévias ficam em `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/`, com um `previas.json` por estilo que diz
  o que existe.
- O vídeo usa o `montar.js` dos modelos e só vai para a pasta do repositório quando o pedido diz que o vídeo é
  liberado. Sem isso, ele vai para uma pasta local fora do git.
- Uma página de revisão mostra, por estilo, as prévias e os campos novos, para o responsável conferir olhando.

**Tecnologia:** Node (módulos nativos), Playwright e Chromium (já usados pelo carrossel), ffmpeg (já usado pelos
modelos). Testes em scripts `node` com `assert`, como nas etapas anteriores.

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 5, 8.2, 8.3, 11.1
e 12 (etapa 4).

## Restrições globais

- **Prévias base usam as cores originais do estilo** (`sugestao` do `estilo.yaml`), nunca a marca de uma empresa. A
  paleta da empresa só entra na etapa 7.
- **Formato e peso:** lâminas e capas em `.webp` com 1080 px de largura; vídeo em `.webm` de 540p, com cerca de 6 s,
  sem som, mais um quadro de capa. Meta: menos de 1 MB por estilo e menos de 30 MB no total.
- **Vídeo:** o trecho começa na troca de quadro (entrada do primeiro B-roll). Valem as regras de vídeo: nada cobre o
  rosto, vídeo limpo, troca de quadro com pelo menos 4 s.
- **O vídeo de uma empresa real nunca entra no repositório.** Só o vídeo de demonstração liberado (pendência 11.1).
- **Conteúdo de exemplo:** textos de `demo.json`, `demo-fixados.json` e `demo-reels.json`; fotos de
  `04-LABORATORIO-DE-DESIGN/estilos/_demo/fotos/`; a mesma identidade fictícia do `previa.js`
  (nome e conta de exemplo). Nenhuma etapa depende de gerar imagem por IA (I-16).
- **Antes de cada commit:** o validador anti-vazamento com a lista privada sai `0`, e `conferir-caminhos.js` também.
- **Git:** sem `push`, `pull`, `merge`, `reset` ou `stash`. Commit local por tarefa, no ramo `biblioteca`.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit.
- **Texto para o usuário final** em português simples, sem jargão.

## Foco da revisão

1. **Marca da empresa vazando na prévia base:** com `FABRICA_MARCA` apontando para uma marca fictícia de cores
   gritantes, ou com uma empresa ativa que tem marca, as prévias saem com as cores do estilo. Teste na Tarefa 2.
2. **Vídeo de pessoa real entrando no repositório:** um pedido sem `"liberado": true` nunca grava nada em
   `previas/`. Teste na Tarefa 3.
3. **Estilo sem carrossel ou sem fixados** (a Primeira Página só tem capa de Reels): sai só o que o estilo tem, sem
   erro. Teste na Tarefa 2.
4. **Estilo acima do peso:** o script diz qual estilo passou de 1 MB e sai com erro, em vez de gravar calado. Teste
   na Tarefa 2.
5. **Rodar de novo depois de o estilo mudar** (o demo passou de 8 para 6 lâminas): as lâminas 7 e 8 antigas somem, e
   nenhum arquivo que o script não criou é apagado. Teste na Tarefa 2.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `04-LABORATORIO-DE-DESIGN/biblioteca/vocabulario.json` (novo) | valores aceitos e rótulos em português de `combina-com`, `tom` e `precisa` |
| `08-FERRAMENTAS/carrossel/molde.js` (+ teste) | `validarEstilo` confere os campos novos contra o vocabulário |
| `04-LABORATORIO-DE-DESIGN/estilos/*/estilo.yaml` (27) | campos novos preenchidos |
| `08-FERRAMENTAS/biblioteca/gerar-previas.js` (novo, + teste) | prévias base em imagem e, com `--video`, em vídeo |
| `08-FERRAMENTAS/biblioteca/revisao.js` (novo, + teste) | página de revisão das prévias e dos campos |
| `08-FERRAMENTAS/biblioteca/LEIA-ME.md` e `roteiro-video-demonstracao.md` (novos) | uso das ferramentas e roteiro do vídeo que o responsável grava |
| `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/` (novos) | as prévias base em imagem, versionadas |
| `.gitignore`, `_fabrica/propriedade.json`, `isentos.json` | pasta local de vídeo fora do git; prévias são do modelo |

---

### Tarefa 1: vocabulário e campos novos nos 27 estilos

**Arquivos:** `04-LABORATORIO-DE-DESIGN/biblioteca/vocabulario.json`, `08-FERRAMENTAS/carrossel/molde.js`,
`08-FERRAMENTAS/carrossel/molde.test.js`, os 27 `estilo.yaml`, `04-LABORATORIO-DE-DESIGN/estilos/LEIA-ME.md`.

**Interfaces produzidas:**
- `vocabulario.json`: `{ "combina-com": { "<codigo>": "<rótulo>" , ... }, "tom": { ... }, "precisa": { ... } }`.
  - **Códigos iniciais:**
    - `combina-com`: `saude`, `nutricao`, `psicologia`, `estetica-e-beleza`, `direito`, `financas`, `educacao`,
      `arquitetura-e-casa`, `tecnologia`, `gastronomia`, `moda`, `bem-estar`, `negocios-e-servicos`.
    - `tom`: `sobrio`, `elegante`, `acolhedor`, `vibrante`, `divertido`, `tecnico`, `ousado`.
    - `precisa`: `funciona-sem-foto`, `foto-de-pessoa`, `foto-fundo-liso`, `fotos-do-assunto`.
  - **Rótulos:** em português simples, por exemplo `"foto-fundo-liso": "Foto com fundo liso"`.
- No `estilo.yaml`, no nível de cima:
  - `combina-com: [<códigos>]` com 2 a 5 itens;
  - `tom: [<códigos>]` com 1 a 3 itens;
  - `precisa: [<códigos>]` com pelo menos 1 item.
  - `funciona-sem-foto` não convive com `foto-de-pessoa` nem com `foto-fundo-liso`.
- `molde.validarEstilo(e, dir)` passa a conferir esses campos contra o vocabulário quando `origem: catalogo`. Em
  `origem: referencias`, eles são opcionais, mas, se vierem, também são conferidos. A mensagem de erro cita o estilo, o
  campo e o valor.

**Como preencher os 27:** pela `linha`, pelos `tratamentos` (por exemplo, `foto: recorte` pede `foto-fundo-liso`) e
pelas `kit.regras` de cada estilo. A Protagonista leva `foto-fundo-liso`. Quem não usa foto em nenhuma lâmina do demo
leva `funciona-sem-foto`. Esta é a primeira versão: o responsável revisa na página da Tarefa 4.

- [ ] **Passo 1:** testes em `molde.test.js` que falham antes:
  - estilo de catálogo sem `tom` é recusado;
  - código fora do vocabulário é recusado, e a mensagem cita o código;
  - `combina-com` com 6 itens é recusado;
  - `funciona-sem-foto` junto com `foto-fundo-liso` é recusado;
  - estilo de referências sem os campos passa.
- [ ] **Passo 2:** vocabulário e validação; preencher os 27 `estilo.yaml` (Edit, sem mexer no resto do arquivo); seção
  "Campos da biblioteca" no `LEIA-ME.md` do catálogo.
- [ ] **Passo 3:** rodar `molde.test.js`, `gerar.test.js` e `conferir.test.js` (validam todos os estilos), mais o
  validador e `conferir-caminhos.js`. Todos saem 0.
- [ ] **Passo 4:** commit "Biblioteca, item 1: vocabulário e campos combina-com, tom e precisa nos 27 estilos".

---

### Tarefa 2: prévias base em imagem

**Arquivos:** `08-FERRAMENTAS/biblioteca/gerar-previas.js`, `08-FERRAMENTAS/biblioteca/gerar-previas.test.js`,
`08-FERRAMENTAS/biblioteca/LEIA-ME.md`, `_fabrica/propriedade.json`.

**Interfaces:**
- **Consome:**
  - `molde.lerEstilo`, `listarEstilos`, `pagina`, `canvasDoFormato` e `garantirTexturas`, com as mesmas `opcoes` do
    `previa.js`: `cores: 'sugestao'`, a identidade fictícia e o `retrato`;
  - `render.renderizar` do carrossel.
- **Produz:** `node 08-FERRAMENTAS/biblioteca/gerar-previas.js [id ...] [--saida <pasta>]`. O padrão de `--saida` é
  `04-LABORATORIO-DE-DESIGN/biblioteca/previas`, e o comando grava em `<saida>/<id>/`:
  - `carrossel-01.webp` … `carrossel-NN.webp` (o `demo.json` inteiro);
  - `fixado-apresentacao.webp`, `fixado-metodo.webp` e `fixado-contratar.webp` (o `demo-fixados.json`, na ordem de
    `formatos.fixados`);
  - `reels-capa.webp` (o `demo-reels.json`);
  - `capa.webp`, a capa do cartão: `carrossel-01` quando há carrossel, senão `reels-capa`;
  - `previas.json`:
    `{ estilo, gerado: <ISO>, cores: 'sugestao', capa, carrossel: [...], fixados: {apresentacao, metodo, contratar}, reelsCapa, video: null, videoCapa: null, bytes }`.
    O campo de um formato que o estilo não tem fica `null` (ou `[]` no carrossel).
- **Funções exportadas, para a Tarefa 3 e os testes:**
  - `gerarImagens(id, { saida }) -> Promise<manifesto>`;
  - `pngParaWebp(png, webp, { largura: 1080, qualidade })`, por ffmpeg `libwebp`;
  - `limparAntigos(pasta, manifestoNovo)`, que apaga só os arquivos dos padrões que o script cria e que não estão no
    manifesto novo;
  - `conferirPeso(manifestos) -> { porEstilo, total, acima: [ids] }`.
- **Limites:** `LIMITE_ESTILO = 1_000_000` bytes e `LIMITE_TOTAL = 30_000_000` bytes. Um estilo acima do limite faz o
  comando listar os estilos que passaram e sair com 1, mas os arquivos ficam gravados para a pessoa olhar.
- **A marca da empresa nunca é lida:** antes de montar, o script apaga `FABRICA_MARCA` e `FABRICA_EMPRESA` do próprio
  processo. Assim, `cores: 'sugestao'` vale mesmo com uma empresa ativa.
- Escolher a `qualidade` do webp (comece em 80) para caber na meta. Se não couber, baixar a qualidade antes de
  diminuir o tamanho.

- [ ] **Passo 1:** testes que falham antes, todos com `--saida` numa pasta temporária e 2 ou 3 estilos (por exemplo
  `protagonista`, `primeira-pagina` e `cartilha`):
  - os arquivos esperados existem e têm 1080 px de largura (ler o cabeçalho do webp);
  - em `primeira-pagina` há só `reels-capa`, `capa` igual a ela, `carrossel: []` e `fixados: null`;
  - com `FABRICA_MARCA` apontando para uma marca fictícia de acento verde puro, nenhum pixel da capa fica perto desse
    verde (amostrar com o próprio Chromium ou decodificar o PNG intermediário), e o manifesto diz `cores: 'sugestao'`;
  - rodar de novo depois de um demo menor (cópia temporária do estilo com 4 lâminas, via uma pasta de estilos de teste
    ou um parâmetro de teste) apaga `carrossel-05` e `carrossel-06` e mantém um arquivo estranho `minha-nota.txt`;
  - `conferirPeso` com um manifesto de 1,2 MB devolve o estilo em `acima`, e o comando sai com 1.
- [ ] **Passo 2:** implementar; acrescentar `08-FERRAMENTAS/biblioteca/` e `04-LABORATORIO-DE-DESIGN/biblioteca/` como
  do modelo em `propriedade.json`; escrever o `LEIA-ME.md` da pasta (uso e meta de peso).
- [ ] **Passo 3:** rodar o teste, a bateria, o validador e `conferir-caminhos.js`. Todos saem 0.
- [ ] **Passo 4:** commit "Biblioteca, item 2: prévias base em imagem, com as cores originais de cada estilo". As
  prévias dos 27 estilos ainda não entram neste commit: elas entram na Tarefa 4.

---

### Tarefa 3: prévias base em vídeo e roteiro do vídeo de demonstração

**Arquivos:** `08-FERRAMENTAS/biblioteca/gerar-previas.js` e o teste dele,
`08-FERRAMENTAS/biblioteca/roteiro-video-demonstracao.md`, `08-FERRAMENTAS/biblioteca/LEIA-ME.md` e `.gitignore`.

**Interfaces:**
- **Consome:** `node 08-FERRAMENTAS/tesseract/modelos/montar.js <modelo> <pedido.json> --exportar`, que grava
  `saida/<modelo>.mp4` ao lado do pedido; e `formatos.reels.modelo` do `estilo.yaml`.
- **Produz:** `gerar-previas.js [id ...] --video <pedido.json> [--reusar <pasta-dos-mp4>]`.
  - **`--reusar`:** usa o `<modelo>.mp4` que já existe nessa pasta, em vez de montar de novo.
  - **Trecho:** começa em `pedido.broll[0].ini` e dura 6 s (`DURACAO_TRECHO = 6`), em 540×960, sem faixa de áudio,
    VP9. A capa `video-capa.webp` é o quadro do meio do trecho.
  - **Para onde vai:**
    - se o pedido tem `"liberado": true`, para `previas/<id>/video.webm` e `video-capa.webp`, e o `previas.json`
      ganha `video` e `videoCapa`;
    - sem isso, para `04-LABORATORIO-DE-DESIGN/biblioteca/previas-locais/<id>/`, com um `previas.json` local que diz
      `"local": true`. Essa pasta entra no `.gitignore`.
  - **O peso do vídeo entra na conta do estilo** só quando ele vai para `previas/`.
- **Função exportada:** `cortarTrecho(mp4, destinoWebm, destinoCapa, { ini, duracao })`, por ffmpeg.
- **Roteiro do vídeo de demonstração** (pendência 11.1). O texto é curto e genérico e não cita nenhuma empresa real
  nem o responsável. Ele traz:
  - **Falas, com tempos-alvo:**
    - chamada de até 3 s;
    - uma palavra de destaque clara;
    - a frase que dispara o B-roll por volta de 5 s, com fala que dure pelo menos 4,5 s sobre a imagem;
    - uma palavra final de até 1 s.
    - Tudo cabe em cerca de 15 s, o assunto é neutro (por exemplo, organizar a semana) e a fala é em primeira pessoa.
  - **Como gravar:**
    - celular em pé (1080×1920, 30 qps);
    - rosto por volta de y 600 no quadro;
    - fundo liso, porque Protagonista, Concreto Ácido e Primeira Página recortam a pessoa;
    - boa luz, sem música, olhando para a câmera.
  - **Depois de gravar:**
    - transcrever com `08-FERRAMENTAS/tesseract/projetos/palavras.js`;
    - preencher um `pedido-demonstracao.exemplo.json` (novo, ao lado do `pedido.exemplo.json` dos modelos), com
      `"liberado": true`, os tempos de `chamada`, `destaques` e `broll` e as fotos de `_demo/fotos/`;
    - rodar `gerar-previas.js --video`.

- [ ] **Passo 1:** testes que falham antes. Usam um MP4 sintético gerado no teste com o ffmpeg (`testsrc`, 1080×1920,
  12 s, com áudio `sine`) e `--reusar`, sem rodar o `montar.js`:
  - o trecho dura 6 s (±0,2), tem 540×960 e nenhuma faixa de áudio (`ffprobe`);
  - com `liberado` ausente, nada é gravado em `previas/` e tudo vai para `previas-locais/`;
  - com `"liberado": true`, `video.webm` e `video-capa.webp` entram em `previas/<id>/` e no manifesto;
  - `broll` vazio dá um erro claro ("o pedido não tem B-roll; o trecho começa na troca de quadro").
- [ ] **Passo 2:** implementar; escrever o roteiro, o pedido de exemplo e o `.gitignore`.
- [ ] **Passo 3:** rodar o teste, a bateria, o validador e `conferir-caminhos.js`. Todos saem 0.
- [ ] **Passo 4:** commit "Biblioteca, item 3: prévias base em vídeo (só liberado entra no repositório) e roteiro do
  vídeo de demonstração".

---

### Tarefa 4: página de revisão e as prévias dos 27 estilos

**Arquivos:** `08-FERRAMENTAS/biblioteca/revisao.js`, `08-FERRAMENTAS/biblioteca/revisao.test.js`, `.gitignore` e
`04-LABORATORIO-DE-DESIGN/biblioteca/previas/**`.

**Interfaces:**
- **Consome:** os `previas.json` (de `previas/` e de `previas-locais/`), os `estilo.yaml` e o `vocabulario.json`.
- **Produz:** `node 08-FERRAMENTAS/biblioteca/revisao.js`, que gera `04-LABORATORIO-DE-DESIGN/biblioteca/revisao.html`.
  O arquivo fica fora do git, porque pode mostrar vídeo local. Para cada estilo, a página mostra:
  - nome e linha;
  - capa;
  - a faixa de lâminas do carrossel;
  - os três fixados;
  - a capa de Reels;
  - o vídeo, quando existir: se for local, com o selo "Só neste computador";
  - "Combina com", "Tom" e "O que precisa", com os rótulos do vocabulário;
  - o peso em KB.
  - **No topo:** o total e a meta (30 MB), e um aviso em vermelho para cada estilo acima de 1 MB.
  - **Sem dependência externa:** os caminhos das imagens são relativos.
  - Funciona em 400 px.

- [ ] **Passo 1:** teste que falha antes, numa pasta temporária com dois manifestos fictícios, um deles local. Ele
  confere que a página cita os rótulos (não os códigos), que o selo "Só neste computador" aparece só no vídeo local e
  que o estilo acima do limite aparece no aviso.
- [ ] **Passo 2:** implementar a página.
- [ ] **Passo 3:** rodar `gerar-previas.js` para os 27 estilos, sem `--video`. Conferir a meta de peso e
  `git status`: só entram `.webp` e `previas.json`.
- [ ] **Passo 4:** prova visual. Rodar `revisao.js` e tirar capturas da página (inteira e em 400 px) para o
  controlador mostrar ao responsável.
- [ ] **Passo 5:** rodar a bateria, o validador e `conferir-caminhos.js`. Todos saem 0.
- [ ] **Passo 6:** commit "Biblioteca, item 4: página de revisão e prévias base dos 27 estilos".

**Depois da tarefa (controlador):**
- abrir a página no navegador do responsável, para ele revisar os campos;
- as correções dele viram um commit à parte;
- entregar o roteiro do vídeo na conversa, por inteiro.

## Fora desta etapa

- Grade e detalhe da biblioteca no Laboratório: etapa 5.
- Vídeo com paleta e fontes da marca e conferência dos 13 modelos antigos: etapa 6.
- Prévias "na minha marca" e fila de vídeo: etapa 7.
- Prévias de vídeo versionadas: entram quando o vídeo de demonstração liberado chegar, rodando a Tarefa 3 com ele.
