# Fábrica no Mac e programas sempre atualizados com autoteste: plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a parte de vídeo da Fábrica instala e roda no Mac (chip Apple e Intel, macOS 14+) como no Windows, e cada programa de
vídeo chega sempre na versão mais nova, que só entra em uso depois de passar num autoteste no próprio computador.

**Architecture:** um módulo `programas.js` vira o dono único de "onde está e como rodar" o `tsrct`, o `whisper-cli`, o
`ffmpeg` e o `ffprobe` em cada sistema; todos os scripts passam por ele. O `ferramentas.js` ganha as fontes do Mac
(pacote oficial do Tesseract, ffmpeg do martin-riedl, whisper compilado na máquina) e um fluxo "candidata → autoteste → em
uso", com registro local de versões recusadas e uma lista de versões testadas no repositório.

**Tech Stack:** Node 20+ (CommonJS, `child_process`, `fetch`), `pngjs` (já é dependência), PowerShell só no Windows, `ditto`,
`tar`, `shasum`, `xcode-select` e CMake portátil só no Mac, GitHub Actions (só no ramo, temporário).

**Spec:** `docs/superpowers/specs/2026-11-22-mac-e-programas-sempre-atualizados-design.md`

## Global Constraints

- macOS mínimo para o vídeo: **14.0** (exigência do Tesseract nas duas arquiteturas); Mac mais velho: aviso, nunca falha da instalação.
- Sem senha digitada no Terminal, sem Homebrew obrigatório; o único clique da pessoa no Mac é "Instalar" do `xcode-select --install`.
- Nunca burlar o Gatekeeper nem apagar o atributo de quarentena.
- Arquiteturas: `arm64` e `x64`; sob Rosetta (`sysctl -in sysctl.proc_translated` = `1`) vale `arm64`.
- Ordem das ferramentas: ffmpeg, modelo do whisper, whisper, Tesseract, RVM.
- Frases para a pessoa: português simples, sem nome interno (regras L-01 a L-06) e sem as palavras que o `instalar.test.js` proíbe.
- As três frases do autoteste são exatamente as do desenho (seção 7.3, "O que a pessoa vê").
- Validador: nada de endereço com protocolo fora dos arquivos isentos (`isentos.json`, categoria `url`), dia da semana escrito, horário com "h" no meio, cor hex, nome de fonte ou nome de cliente.
- Arquivos da matriz ficam em CRLF na cópia de trabalho: troca de várias linhas só com a ferramenta Edit.
- O Windows não pode piorar: a bateria (`git ls-files '*.test.js'`) termina com as mesmas falhas da 0.8.3, nem uma a mais.
- Commits em português com a linha `Co-Authored-By` do Claude de sempre; push só do ramo `mac-e-atualizacoes` para o privado (autorizado); público só com o ok do responsável.

## Review Focus

1. **Usuário do Windows com espaço no nome** (`C:\Users\Maria Silva\AppData\Local\...`): o `tsrct.cmd` tem que receber os argumentos inteiros. Teste na Tarefa 1 com um `tsrct.cmd` falso numa pasta com espaço.
2. **Mac com chip Apple rodando Node x64 sob Rosetta**: tem que escolher os pacotes `arm64` e compilar o whisper em `arm64`. Testes nas Tarefas 1 e 4.
3. **Sem internet ou com o limite de consultas do GitHub estourado no pré-voo**: o Reels segue com o que está instalado e funcionando, ou com a versão da lista de testadas na primeira instalação. Teste na Tarefa 6.
4. **Pré-voo de novo logo depois de uma versão recusada**: não baixa nem testa de novo a mesma versão, e o `--verificar` não fica pedindo atualização para sempre. Teste na Tarefa 6.
5. **Mac com macOS 13 ou mais velho**: a instalação termina com aviso em palavras simples sobre o vídeo, sem quebrar. Teste na Tarefa 7.

---

### Task 1: `programas.js`, o lugar único de cada programa

**Files:**
- Create: `_fabrica/core/programas.js`
- Test: `_fabrica/core/programas.test.js`

**Interfaces:**
- Produces:
  - `sistema(opc?) -> { plataforma: 'win32'|'darwin'|'linux', arq: 'x64'|'arm64', rosetta: boolean, macos: [n,n,n]|null }`. `opc` aceita `{ plataforma, arq, rodar }` para teste; `rodar(cmd, args) -> string|null` substitui as chamadas a `sysctl` e `sw_vers`.
  - `prefixoTesseract(opc?) -> string`: `FABRICA_TESSERACT_PREFIXO` > `opc.prefixo` > padrão do sistema (win32 `%LOCALAPPDATA%\Tesseract`; darwin `~/Library/Application Support/Tesseract`; linux `${XDG_DATA_HOME:-~/.local/share}/Tesseract`).
  - `caminho(nome: 'tsrct'|'whisper'|'ffmpeg'|'ffprobe', opc?) -> string`. `opc` aceita `{ plataforma, env, raiz, home, prefixo }`. Overrides, em todos os sistemas: `FABRICA_TSRCT`, `FABRICA_WHISPER`, `FABRICA_FFMPEG_DIR` (pasta com `ffmpeg`/`ffprobe`, com `.exe` no Windows). Sem override: Mac/Linux usam o ffmpeg da Fábrica em `08-FERRAMENTAS/ffmpeg/bin/` quando o arquivo existe, senão o nome puro (PATH); Windows usa o nome puro.
  - `linhaCmd(args: string[]) -> string`: a linha `"<arg> <arg>..."` para `cmd.exe /d /s /c` com `windowsVerbatimArguments`, pondo aspas em argumento com espaço ou `& | < > ^ % "` (aspas internas viram `\"`).
  - `tsrctSync(args, opcoes?) -> string` (como `execFileSync`, `encoding: 'utf8'`, `maxBuffer` 64 MB, lança com `.stderr`), `tsrctSpawn(args, opcoes?) -> ChildProcess`, `rodarTsrct(args, opcoes?) -> SpawnSyncReturns`. No Windows passam por `cmd.exe` com `linhaCmd` quando o caminho termina em `.cmd`; caminho `.exe` (ou Mac) roda direto.
  - `prepararPath(opc?) -> boolean`: põe a pasta do ffmpeg da Fábrica no começo do `process.env.PATH` uma vez só (true se pôs). Roda ao carregar o módulo.
  - `RAIZ` (pasta da Fábrica).

- [ ] **Passo 1: escrever os testes (falham: o módulo não existe)**

Casos em `programas.test.js`, no estilo `caso(nome, f)` dos outros testes:
- `tsrct no Windows fica em %LOCALAPPDATA%\Tesseract\bin\tsrct.cmd`: `caminho('tsrct', { plataforma: 'win32', env: { LOCALAPPDATA: 'C:\\L' } })` termina com `Tesseract\\bin\\tsrct.cmd` e começa com `C:\\L`.
- `tsrct no Mac fica em Application Support`: com `{ plataforma: 'darwin', home: '/Users/x', env: {} }` dá `/Users/x/Library/Application Support/Tesseract/bin/tsrct`.
- `whisper: Release/whisper-cli.exe no Windows e bin/whisper-cli no Mac` (com `raiz: '/f'`).
- `ffmpeg no Mac: a cópia da Fábrica quando existe, senão o do PATH` (pasta temporária com e sem `08-FERRAMENTAS/ffmpeg/bin/ffmpeg`).
- `as variáveis FABRICA_TSRCT, FABRICA_WHISPER e FABRICA_FFMPEG_DIR vencem`.
- `sob Rosetta o sistema é arm64`: `sistema({ plataforma: 'darwin', arq: 'x64', rodar: (c) => c === 'sysctl' ? '1' : '14.6.1' })` dá `{ arq: 'arm64', rosetta: true, macos: [14, 6, 1] }`.
- `linhaCmd põe aspas só onde precisa`: `linhaCmd(['C:\\a b\\tsrct.cmd', 'export', '-p', 'C:\\x\\p.tsrct'])` === `'""C:\\a b\\tsrct.cmd" export -p C:\\x\\p.tsrct"'`.
- `tsrct.cmd numa pasta com espaço recebe os argumentos inteiros` (só no Windows): cria `<tmp>\com espaço\tsrct.cmd` que grava `%*` num arquivo; `rodarTsrct(['project', '-p', 'C:\\a b\\p.tsrct'], ...)` com `FABRICA_TSRCT` apontando para ele; o arquivo contém `project -p "C:\a b\p.tsrct"`.
- `prepararPath põe a pasta do ffmpeg da Fábrica na frente uma vez só`.
- `tsrctSync roda --version neste computador` (pula com aviso se o Tesseract não estiver instalado): casa `/tsrct \d+\.\d+\.\d+/`.

- [ ] **Passo 2:** rodar `node _fabrica/core/programas.test.js`. Esperado: falha com `Cannot find module './programas.js'`.
- [ ] **Passo 3:** implementar `programas.js` com as assinaturas acima (a detecção de Rosetta e da versão do macOS usa `sysctl -in sysctl.proc_translated` e `sw_vers -productVersion`, só quando `plataforma` é `darwin`).
- [ ] **Passo 4:** rodar de novo. Esperado: todos os casos `ok`.
- [ ] **Passo 5:** commit `Programas: um lugar só para achar tsrct, whisper e ffmpeg no Windows e no Mac`.

### Task 2: os scripts de vídeo passam pelo `programas.js`

**Files:**
- Modify: `08-FERRAMENTAS/tesseract/blocos-motion/tsrct.js`, `08-FERRAMENTAS/tesseract/modelos/motor.js`, `08-FERRAMENTAS/tesseract/projetos/medir-palavras.js`, `08-FERRAMENTAS/tesseract/projetos/montar-video.js`, `08-FERRAMENTAS/tesseract/preparar-material.js` (`WHISPER`, `TSRCT`, versão do tsrct), `08-FERRAMENTAS/tesseract/exportar-em-pedacos.js` (`TSRCT`, `spawn` do export, `tasklist`, amostrador)
- Modify (só `require` do módulo, para o PATH achar o ffmpeg da Fábrica no Mac): `08-FERRAMENTAS/biblioteca/gerar-previas.js`, `08-FERRAMENTAS/rvm/matte.js`, `08-FERRAMENTAS/tesseract/blocos-motion/gerar-catalogo.js`, `08-FERRAMENTAS/tesseract/conferir-reels.js`, `08-FERRAMENTAS/tesseract/modelos/estilos/_comum.js`, `08-FERRAMENTAS/tesseract/modelos/gerar-previas.js`, `08-FERRAMENTAS/tesseract/modelos/montar.js`, `08-FERRAMENTAS/tesseract/projetos/mixar-audio.js`, `08-FERRAMENTAS/tesseract/projetos/normalizar-audio.js`, `08-FERRAMENTAS/tesseract/projetos/pre-edicao.js`, e os testes que chamam `ffmpeg`/`ffprobe` direto (`biblioteca/gerar-previas.test.js`, `biblioteca/ponta-a-ponta.test.js`, `biblioteca/revisao.test.js`, `biblioteca/video-marca.test.js`, `tesseract/blocos-motion/cartao-cta.test.js`, `tesseract/modelos/montar.test.js`)
- Modify: `08-FERRAMENTAS/tesseract/LEIA-ME.md` (caminhos dos dois sistemas)
- Test: `_fabrica/core/programas.test.js` (caso novo de guarda)

**Interfaces:**
- Consumes: `tsrctSync`, `tsrctSpawn`, `caminho`, `prepararPath` (Tarefa 1).
- Produces: `listarProcessos() -> [{ nome: string, kb: number }]` dentro de `exportar-em-pedacos.js` (Windows: `tasklist /FO CSV /NH`; Mac: `ps -axo rss=,comm=`, nome sem pasta e sem `.exe`).

- [ ] **Passo 1: teste de guarda (falha)** em `programas.test.js`: `nenhum script de vídeo fixa caminho de programa do Windows` varre `git ls-files` de `08-FERRAMENTAS/tesseract/**/*.js`, `08-FERRAMENTAS/rvm/*.js`, `08-FERRAMENTAS/biblioteca/*.js`, `_fabrica/core/ambiente.js` e `_fabrica/core/instalar.js` e reprova `/tsrct\.cmd|whisper-cli\.exe|LOCALAPPDATA|['"]cmd\.exe['"]/`, listando arquivo e linha.
- [ ] **Passo 2:** rodar o teste. Esperado: FALHA citando os 6 scripts.
- [ ] **Passo 3:** trocar `const T = ...tsrct.cmd` + `execFileSync('cmd.exe', ['/c', T, ...a], o)` por `tsrctSync(a, o)`; o `spawn('cmd.exe', ['/c', TSRCT, 'export', ...])` por `tsrctSpawn([...])`; `fs.existsSync(TSRCT)` por `fs.existsSync(caminho('tsrct'))`; o `WHISPER` do `preparar-material.js` por `caminho('whisper')`. No `exportar-em-pedacos.js`, `preChecagens()` passa a usar `listarProcessos()` (conta `tsrct` e `ffmpeg`; soma navegadores `chrome|msedge|firefox|brave|opera|google chrome|safari`) e o amostrador em PowerShell roda só no Windows (no Mac, uma linha de log "amostrador de memória só no Windows").
- [ ] **Passo 4:** acrescentar `require('<caminho relativo>/_fabrica/core/programas');` no topo dos arquivos da lista de "só `require`", com o comentário `// acha o ffmpeg da Fábrica no Mac`.
- [ ] **Passo 5:** rodar `programas.test.js` (passa), `08-FERRAMENTAS/tesseract/modelos/montar.test.js`, `08-FERRAMENTAS/tesseract/blocos-motion/cartao-cta.test.js` e `08-FERRAMENTAS/tesseract/conferir-reels.test.js`. Esperado: o mesmo resultado da 0.8.3 (comparar com a cópia `fabrica-wt-cronograma-tipo`).
- [ ] **Passo 6:** atualizar o `LEIA-ME.md` do Tesseract (linha dos caminhos) e commit `Scripts de vídeo acham os programas pelo programas.js (Windows e Mac)`.

### Task 3: versões certas (whisper `bNNNN`, pacote por sistema, ffmpeg do Mac)

**Files:**
- Modify: `_fabrica/core/ferramentas.js` (funções puras, exportadas)
- Test: `_fabrica/core/ferramentas.test.js`

**Interfaces:**
- Consumes: `sistema()` (Tarefa 1).
- Produces (puras):
  - `escolherRelease(releases, regex, { aceitarPre = false } = {})` (mantém o comportamento de hoje sem a opção).
  - `etiquetaWhisper(releases) -> { tag, publicado, asset } | null`: a release mais recente por `published_at` que traz `whisper-bin-x64.zip`, aceitando pré-lançamento.
  - `whisperPrecisa(registro: { versao, publicadoEm? } | null, nova: { tag, publicado }) -> boolean`: sem registro, true; mesma etiqueta, false; etiqueta diferente e (`publicadoEm` ausente ou `nova.publicado > publicadoEm`), true.
  - `pacoteTesseract(sis) -> RegExp | null`: `windows-x86_64` (win32), `darwin-arm64` ou `darwin-x86_64` (darwin), null nos outros.
  - `urlFfmpegMac(sis, nome: 'ffmpeg'|'ffprobe') -> string`: o endereço `ffmpeg.martin-riedl.de/redirect/latest/macos/<arm64|amd64>/release/<nome>.zip`, com o protocolo https na frente.
  - `versaoDoCaminhoFfmpeg(local: string) -> [n,n,n] | null`: lê `<carimbo>_<versão>` de `/download/macos/<arq>/<carimbo>_<versão>/<arquivo>.zip`.
  - `macosSuportado(macos) -> boolean`: `comparar(macos, [14, 0, 0]) >= 0`.

- [ ] **Passo 1: testes (falham)**:
  - `whisper: pega a bNNNN mais nova mesmo marcada como pré-lançamento`: lista com `b5907` (pre, 2026-11-20, com `whisper-bin-x64.zip`), `v1.9.5` (sem arquivos), `b5454` (pre, 2026-10-06), `b4938` (2026-08-20) dá `tag === 'b5907'`.
  - `whisper: b4938 registrada sem data precisa atualizar para a b5907; a mesma etiqueta não precisa`.
  - `Tesseract: o pacote certo para cada sistema`: win32 casa `tesseract-0.8.0-windows-x86_64.zip`; darwin arm64 casa `tesseract-0.8.0-darwin-arm64.zip` e não casa o `x86_64`; linux dá null.
  - `ffmpeg do Mac: link fixo por arquitetura e versão tirada do redirecionamento`: `urlFfmpegMac({ arq: 'x64' }, 'ffprobe')` termina em `/macos/amd64/release/ffprobe.zip`; `versaoDoCaminhoFfmpeg('/download/macos/arm64/123_9.1/ffmpeg.zip')` dá `[9, 1, 0]`.
  - `macOS 14 em diante roda o vídeo`: `[14,0,0]` true, `[13,6,9]` false, `null` false.
- [ ] **Passo 2:** rodar `node _fabrica/core/ferramentas.test.js`. Esperado: falha nas funções que faltam.
- [ ] **Passo 3:** implementar as funções e trocar a escolha do whisper no `maisNova` pela `etiquetaWhisper` + `whisperPrecisa` (o `versao.json` passa a gravar `{ versao, publicadoEm, instaladoEm }`).
- [ ] **Passo 4:** rodar de novo. Esperado: todos `ok`, inclusive os 5 casos antigos.
- [ ] **Passo 5:** commit `Ferramentas: whisper volta a acompanhar as versões; pacote certo de cada sistema`.

### Task 4: instaladores do Mac (Tesseract, ffmpeg, whisper compilado)

**Files:**
- Modify: `_fabrica/core/ferramentas.js` (Tesseract e ffmpeg no Mac; `descompactar` por sistema)
- Create: `_fabrica/core/compilar-whisper.js`
- Test: `_fabrica/core/compilar-whisper.test.js`, `_fabrica/core/ferramentas.test.js`
- Modify: `08-FERRAMENTAS/validador-anti-vazamento/isentos.json` (`url` para `compilar-whisper.js`)

**Interfaces:**
- Consumes: Tarefa 1 (`sistema`, `caminho`, `prefixoTesseract`) e Tarefa 3 (`pacoteTesseract`, `urlFfmpegMac`, `versaoDoCaminhoFfmpeg`).
- Produces:
  - `descompactar(zip, pasta, sis?)`: win32 PowerShell `Expand-Archive` (como hoje); darwin `ditto -x -k <zip> <pasta>`; linux `unzip -q -o`.
  - `instalarTesseract({ release, lista, prefixo, sis }) -> Promise<{ pastaExtraida }>`: baixa e confere o `.sha256`, descompacta e chama `rodarInstaladorTesseract`. Não apaga a pasta extraída: quem chama apaga (a Tarefa 6 reaproveita a mesma pasta para pôr em uso).
  - `rodarInstaladorTesseract(pastaExtraida, prefixo?, sis?)`: acha o instalador oficial dentro da pasta (win32 `install.ps1 [-Prefix]`; darwin `bash install.sh [prefixo]`), roda e lança com as duas últimas linhas da saída se falhar.
  - `instalarFfmpegMac({ destino, sis }) -> Promise<{ versao }>`: lê o `Location` com `fetch(url, { redirect: 'manual' })`, baixa `ffmpeg.zip` e `ffprobe.zip` com o `.sha256` de cada um (mesmo caminho + `.sha256`), confere, descompacta em `<destino>/bin/`, `chmod 755`, roda `-version`.
  - `compilarWhisper({ etiqueta, destino, sis, cache, log }) -> Promise<string>` (caminho do `whisper-cli` pronto). Erros com mensagem simples: `faltam as ferramentas gratuitas da Apple (xcode-select --install)`.
  - `argumentosCmake(sis) -> string[]` (puro): `['-DCMAKE_BUILD_TYPE=Release', '-DBUILD_SHARED_LIBS=OFF', '-DWHISPER_BUILD_TESTS=OFF', '-DWHISPER_BUILD_EXAMPLES=ON', '-DCMAKE_OSX_ARCHITECTURES=<arm64|x86_64>']`.
  - `prefixoArquitetura(sis) -> string[]` (puro): `['arch', '-arm64']` sob Rosetta, `[]` nos outros casos.
  - `escolherCmakeMac(release) -> { tarball, sha }` (puro): os assets `cmake-<v>-macos-universal.tar.gz` e `cmake-<v>-SHA-256.txt`.

- [ ] **Passo 1: testes (falham)** em `compilar-whisper.test.js`:
  - `CMake: argumentos fixos e arquitetura do sistema`: `argumentosCmake({ arq: 'arm64' })` contém `-DBUILD_SHARED_LIBS=OFF` e `-DCMAKE_OSX_ARCHITECTURES=arm64`; com `x64` dá `x86_64`.
  - `sob Rosetta o build roda com arch -arm64`: `prefixoArquitetura({ rosetta: true })` igual a `['arch', '-arm64']`; sem Rosetta, `[]`.
  - `escolhe o CMake universal do Mac e o arquivo de conferência`: com os nomes da release 4.5.1 (`cmake-4.5.1-macos-universal.tar.gz`, `cmake-4.5.1-macos10.10-universal.tar.gz`, `cmake-4.5.1-SHA-256.txt`, `.dmg`) escolhe o primeiro e o `SHA-256.txt`.
  - `sem as ferramentas da Apple, avisa em palavras simples` (`rodar` falso para `xcode-select -p` com status 2): a promessa rejeita com `/ferramentas gratuitas da Apple/`.
- [ ] **Passo 2:** rodar `node _fabrica/core/compilar-whisper.test.js`. Esperado: falha (módulo não existe).
- [ ] **Passo 3:** implementar `compilar-whisper.js`: confere `xcode-select -p`; baixa o CMake da release mais nova da Kitware (`api.github.com/repos/Kitware/CMake/releases/latest`), confere a linha do tarball no `SHA-256.txt`, extrai com `tar -xzf` no `cache` (`08-FERRAMENTAS/.cache-ferramentas/`, reaproveitado se já existir); baixa `github.com/ggml-org/whisper.cpp/archive/refs/tags/<etiqueta>.tar.gz`, extrai, roda `[...prefixoArquitetura, <cmake>, '-S', src, '-B', build, ...argumentosCmake]` e `cmake --build build --config Release -j <núcleos> --target whisper-cli`; copia `build/bin/whisper-cli` para `<destino>/bin/whisper-cli`; confere com `whisper-cli --help` (status 0). O CMake fica em `<cache>/cmake-<v>-macos-universal/CMake.app/Contents/bin/cmake`.
- [ ] **Passo 4:** em `ferramentas.js`, `descompactar` por sistema; o Tesseract usa `pacoteTesseract(sistema())` e `instalarTesseract`; no Mac o ffmpeg usa `instalarFfmpegMac` com destino `08-FERRAMENTAS/ffmpeg` e o whisper usa `compilarWhisper` com a etiqueta da Tarefa 3; `atual()` de cada ferramenta lê pelo `caminho()`; o `main` deixa de sair fora do Windows (sai só no Linux e no macOS antes do 14, com frase simples).
- [ ] **Passo 5:** rodar `compilar-whisper.test.js` e `ferramentas.test.js` (passam) e `node _fabrica/core/ferramentas.js --simular` no Windows (mesma lista de hoje, agora com o whisper na b5907). Isentar `compilar-whisper.js` em `url` e rodar o validador.
- [ ] **Passo 6:** commit `Ferramentas no Mac: Tesseract oficial, ffmpeg conferido e whisper compilado na máquina`.

### Task 5: o autoteste

**Files:**
- Create: `_fabrica/core/autoteste-ferramentas.js`, `08-FERRAMENTAS/autoteste/fala-jfk.wav` (cópia de `samples/jfk.wav` do whisper.cpp, domínio público), `08-FERRAMENTAS/autoteste/LEIA-ME.md` (origem e licença da fala; o que o teste faz)
- Test: `_fabrica/core/autoteste-ferramentas.test.js`

**Interfaces:**
- Consumes: `caminho()` (Tarefa 1); `08-FERRAMENTAS/tesseract/modelos/montar.js` como está (`node montar.js vitrine <pedido.json> --exportar --quadros 1,2.5 --saida <pasta> --manter-quadros --sem-normalizar`).
- Produces:
  - `autotestar({ so?: string[], env?: object, raiz?, trabalho?, referencia?: { quadros: string[] } | null, visualLivre?: boolean }) -> Promise<{ ok: boolean, etapas: [{ id: 'ffmpeg'|'whisper'|'tesseract', ok, detalhe, ms }], quadros: string[] }>`. `env` (por exemplo `FABRICA_TSRCT`) aponta os programas para a candidata e vai para os processos filhos.
  - `compararQuadros(pngA, pngB) -> { media: number, fracao: number }` (puro sobre os arquivos: diferença média 0 a 255 e fração de pixels com diferença acima de 32).
  - `quadroVazio(png) -> boolean` (desvio padrão da luminância abaixo de 4).
  - `lerReferencia(raiz) -> { versao, quadros } | null` e `gravarReferencia(raiz, quadros, versao)`, em `08-FERRAMENTAS/.autoteste/referencia/`.
  - Constantes `CODIFICADORES = ['libx264', 'aac', 'png', 'pcm_s16le', 'libwebp', 'libvpx-vp9']`, `FILTROS = ['ebur128', 'loudnorm', 'silencedetect', 'blackdetect', 'geq', 'scale', 'highpass', 'aresample', 'tile', 'vignette']`, `LIMITE_MEDIA`, `LIMITE_FRACAO` (valores da medição do Passo 6).
  - Linha de comando: `node _fabrica/core/autoteste-ferramentas.js [--so ffmpeg,whisper,tesseract] [--json]`; imprime `AUTOTESTE: passou` ou `AUTOTESTE: falhou em <etapa>: <motivo>`; sai 0 ou 1.
  - `FABRICA_AUTOTESTE_FORCAR_FALHA=<etapa>` (só para teste): a etapa com esse id reprova com o motivo "falha forçada para teste".

- [ ] **Passo 1: testes (falham)**:
  - `compararQuadros: iguais dão 0; um retângulo trocado dá a fração da área` (PNGs sintéticos de 100x100 com `pngjs`; retângulo 10x10 dá `fracao` 0,01).
  - `quadroVazio: imagem lisa é vazia; com listras não`.
  - `uma etapa reprovada reprova o autoteste e diz qual` (com `so: ['ffmpeg']` e `env.FABRICA_FFMPEG_DIR` numa pasta vazia): `ok === false`, `etapas[0].id === 'ffmpeg'`.
  - `a falha forçada para teste reprova só a etapa pedida` (`FABRICA_AUTOTESTE_FORCAR_FALHA=ffmpeg` no `env`, `so: ['ffmpeg']`): `ok === false` e o detalhe cita "falha forçada".
  - `autoteste de verdade neste computador passa` (pula com aviso se faltar ffmpeg, whisper com modelo ou tsrct): `ok === true`, 3 etapas, 2 quadros.
- [ ] **Passo 2:** rodar `node _fabrica/core/autoteste-ferramentas.test.js`. Esperado: falha (módulo não existe).
- [ ] **Passo 3:** implementar. Etapa ffmpeg: `-hide_banner -encoders` e `-filters` contêm as listas; gera `teste.mp4` de 4 s (1080x1920, `testsrc2` + `sine`, `libx264` + `aac`); o `ffprobe` lê duração entre 3,8 e 4,2 s e um fluxo de áudio. Etapa whisper: `whisper -m <modelo> -f fala-jfk.wav -l en -t 4 -ojf -of <saída>`; o texto junto contém `country` e os tempos não diminuem. Etapa Tesseract: `pedido.json` = `{ video: 'teste.mp4', palavras: 'palavras.json', chamada: { texto: 'Teste da Fábrica', palavra: 'fabrica', ini: 0.2, fim: 2.2 } }` e palavras `Teste 300-700, da 700-900, Fábrica 900-1500, funcionando 1600-2400, agora 2500-3200` (ms); roda o `montar.js` com o `env`; confere o MP4 (1080x1920, duração 3,7 a 4,3 s, com áudio), os 2 quadros não vazios e, havendo `referencia` e `visualLivre` falso, `compararQuadros` dentro dos limites.
- [ ] **Passo 4:** baixar a `samples/jfk.wav` (do repositório do whisper.cpp, sem protocolo no texto: `raw.githubusercontent.com/ggml-org/whisper.cpp/master/samples/jfk.wav`) para `08-FERRAMENTAS/autoteste/` e escrever o `LEIA-ME.md`.
- [ ] **Passo 5:** rodar os testes. Esperado: todos `ok` no Windows (o caso de verdade usa o whisper instalado na Tarefa 8; até lá ele pula com aviso).
- [ ] **Passo 6: medir a tolerância.** Renderizar o teste do Tesseract duas vezes na 0.7.0 (ruído) e uma vez em cada versão 0.6.0, 0.7.0 e 0.8.0 (as duas primeiras já estão em `%LOCALAPPDATA%\Tesseract\public-cli\<versão>-x86_64\bin\tsrct.exe`; a 0.8.0 instalada com prefixo temporário), via `FABRICA_TSRCT`. Anotar `media` e `fracao` de cada par no `LEIA-ME.md` do autoteste e fixar `LIMITE_MEDIA` e `LIMITE_FRACAO` acima do ruído com folga; registrar se a troca de versão passa do limite.
- [ ] **Passo 7:** commit `Autoteste das ferramentas de vídeo (ffmpeg, whisper e Tesseract com um modelo da Fábrica)`.

### Task 6: candidata, autoteste e troca

**Files:**
- Modify: `_fabrica/core/ferramentas.js`
- Create: `_fabrica/core/versoes-testadas.json`
- Test: `_fabrica/core/ferramentas.test.js`
- Modify: `.gitignore` (`08-FERRAMENTAS/ffmpeg/`, `08-FERRAMENTAS/.estado-ferramentas.json`, `08-FERRAMENTAS/.cache-ferramentas/`, `08-FERRAMENTAS/.autoteste/`), `isentos.json` (`url` para `versoes-testadas.json`)

**Interfaces:**
- Consumes: Tarefas 3 a 5 (`autotestar`, `lerReferencia`, `gravarReferencia`, instaladores).
- Produces:
  - Cada ferramenta ganha `prepararCandidata(opc, nova) -> Promise<{ env, porEmUso(): Promise<void>, descartar(): void }>`. Tesseract: instala com prefixo em pasta temporária, `env.FABRICA_TSRCT` aponta para ela; `porEmUso` roda o instalador oficial de novo com o prefixo de verdade, a partir da mesma pasta extraída. Whisper e ffmpeg do Mac: pasta `candidata/` ao lado da pasta em uso; `porEmUso` troca `bin` por `candidata/bin`, guarda a anterior em `anterior/` (apaga a anterior da vez passada) e grava `versao.json`. ffmpeg do Windows: sem candidata (`atualizarSemCandidata`: anota a versão de antes, `winget upgrade`, autoteste só do ffmpeg; se falhar, `winget install -e --id <id> --version <antes> --force --silent --accept-package-agreements --accept-source-agreements`; se não der, avisa).
  - `lerEstado(raiz)`, `gravarEstado(raiz, estado)` em `08-FERRAMENTAS/.estado-ferramentas.json`: `{ ferramentas: { <id>: { emUso, ultimoTeste: { data, ok, detalhe }, recusadas: string[] } } }`.
  - `decidir({ instalada: boolean, nova: { rotulo } | null, erroConsulta: string, recusadas: string[], testada: { rotulo } | null }) -> 'manter' | 'testar-nova' | 'usar-testada' | 'pular-recusada'` (puro).
  - `atualizarComTeste(ferramenta, nova, opc, dep = { autotestar, estado }) -> Promise<{ resultado: 'passou'|'falhou'|'pulou', frase: string }>`. Sem referência e com uma versão em uso que funciona, gera a referência com ela antes de testar a candidata. Versão que está em `versoes-testadas.json` roda com `visualLivre: true` e refaz a referência.
  - `versoes-testadas.json`: `{ "atualizado": "2026-11-22", "tesseract": { "versao": "0.8.0" }, "whisper": { "etiqueta": "b5907" }, "ffmpeg-mac": { "versao": "9.1", "arm64": "<caminho /download/...>", "amd64": "<caminho>" } }` (valores confirmados na Tarefa 9).

- [ ] **Passo 1: testes (falham)** com ferramenta e autoteste falsos:
  - `decidir: consulta falhou e há versão funcionando, mantém` (`manter`); `nada instalado e consulta falhou, usa a testada` (`usar-testada`); `versão nova já recusada, pula` (`pular-recusada`); `versão nova diferente, testa` (`testar-nova`).
  - `passou: põe em uso e grava o estado` (`porEmUso` chamado uma vez; `emUso` = rótulo novo; frase = a do desenho para "passou").
  - `falhou: descarta, guarda a recusada e mantém a atual` (`descartar` chamado; `recusadas` contém o rótulo; `emUso` igual ao de antes; frase = a de "falhou").
  - `primeira instalação com a nova reprovada entra a versão testada` (o segundo `prepararCandidata` recebe a versão da lista).
  - `--verificar não pede de novo uma versão recusada` (saída `OK` com "recusada no teste" e código 0).
  - `sem referência e com versão em uso, a referência nasce da versão em uso antes da candidata` (ordem das chamadas ao autoteste falso: primeiro sem `env`, depois com).
- [ ] **Passo 2:** rodar `ferramentas.test.js`. Esperado: falha nos casos novos.
- [ ] **Passo 3:** implementar o fluxo no `main`: para cada ferramenta na ordem global, `decidir(...)`; `testar-nova` e `usar-testada` passam por `atualizarComTeste`; os modelos (whisper e RVM) continuam só baixando. Linhas impressas: `FERRAMENTA n de N: ...`, depois `FEITO: <frase>` ou `PROBLEMA: <frase>`, e o `RESULTADO:` de hoje.
- [ ] **Passo 4:** rodar `ferramentas.test.js` e `node _fabrica/core/ferramentas.js --verificar` no Windows. Esperado: testes `ok`; o `--verificar` lista tesseract e whisper como PRECISA (0.7.0 e b4938 aqui).
- [ ] **Passo 5:** commit `Ferramentas: versão nova entra só depois de passar no autoteste; lista de versões testadas`.

### Task 7: instalação guiada e pré-voo nos dois sistemas

**Files:**
- Modify: `_fabrica/core/ambiente.js`, `_fabrica/core/instalar.js`, `INSTALAR.md`, `linhas/reels/passos/01-entrada.md`
- Test: `_fabrica/core/ambiente.test.js`, `_fabrica/core/instalar.test.js`

**Interfaces:**
- Consumes: `caminho`, `sistema` (Tarefa 1), `macosSuportado` (Tarefa 3).
- Produces:
  - `conferir(raiz, opc?)` aceita `opc.sistema` (para teste). Itens novos no grupo `video` quando o sistema é darwin: `apple` ("Ferramentas da Apple (para montar a transcrição)", `xcode-select -p`) e `macos` ("macOS 14 ou mais novo (o programa de vídeo exige)"). O item `caminho` (acento) só existe no win32.
  - Em `instalar.js`, puras e exportadas: `videoNesteSistema(sis) -> { roda: boolean, nota?: string }` e `conclusaoFinal(itens, sis) -> { ok: boolean, nota?: string, erro?: string }`.

- [ ] **Passo 1: testes (falham)**:
  - `no Mac, o vídeo procura o tsrct e o whisper nos caminhos do Mac` (`conferir(raiz, { sistema: { plataforma: 'darwin', arq: 'arm64', macos: [14, 6, 0] } })`: o item `tesseract` cita `Application Support` quando falta; existe o item `apple`; não existe o item `caminho`).
  - `macOS 13: o vídeo vira aviso, e o resto da instalação segue`: o item `macos` vem com `ok: false` e `comoResolver` em palavras simples; `conclusaoFinal(itens, { plataforma: 'darwin', macos: [13, 6, 0] })` dá `ok: true` com `nota` sobre o vídeo.
  - `o passo do vídeo roda no Windows e no Mac, não no Linux`: `videoNesteSistema` dá `roda: true` para win32 e para darwin com `[14, 6, 0]`; `roda: false` com nota para linux e para darwin com `[13, 6, 0]`.
- [ ] **Passo 2:** rodar os dois testes. Esperado: falham nos casos novos.
- [ ] **Passo 3:** implementar em `ambiente.js` e `instalar.js` (`conclusaoFinal` exportada; a frase do passo do vídeo deixa de dizer "só no Windows").
- [ ] **Passo 4:** `INSTALAR.md`: Passo 0 sem falar de um sistema só; Passo 1 no Mac com `git --version` + `xcode-select -p` e, faltando, explicação + "sim" + `xcode-select --install` + onde clicar ("Instalar") + "leva alguns minutos"; Node pelo Homebrew só se já existir, senão nodejs.org; Passo 3 "o Mac ou o Windows podem mostrar uma janela pedindo permissão"; Passo 4 com o vídeo no Mac, o tempo no Mac (compilar o whisper) e o autoteste em uma frase; Passo 6 com o vídeo OK também no Mac (exceção: macOS antes do 14, aceita como aviso); "Depois da instalação" com o autoteste; "Para quem mantém a Fábrica": rodar o autoteste e atualizar `versoes-testadas.json` antes de publicar. Tirar todo "só no Windows" que deixou de valer. O aviso de acento do Passo 2 passa a dizer "no Windows" (confirmar na Tarefa 9).
- [ ] **Passo 5:** `01-entrada.md`, pré-voo: o item 3 passa a ser "o autoteste roda sozinho quando uma versão muda; registrar no relatório a versão em uso e se houve atualização ou versão recusada".
- [ ] **Passo 6:** rodar `ambiente.test.js`, `instalar.test.js`, `node _fabrica/core/conferir-caminhos.js` e o validador. Esperado: tudo 0.
- [ ] **Passo 7:** commit `Instalação guiada e pré-voo do Reels também no Mac`.

### Task 8: Windows de verdade, isolado, e a bateria

**Files:** nenhum novo (correções que aparecerem voltam para a tarefa dona, com teste).

- [ ] **Passo 1:** `npm install --no-audit --no-fund` na cópia `fabrica-wt-mac`.
- [ ] **Passo 2:** linha de base: rodar a bateria (`git ls-files '*.test.js'`, cada um com `node`) na cópia `fabrica-wt-cronograma-tipo` (0.8.3) e guardar a lista de falhas.
- [ ] **Passo 3:** instalar de verdade, isolado: `node _fabrica/core/ferramentas.js --so modelo,whisper,tesseract --prefixo <scratchpad>\Tesseract` (o ffmpeg do sistema não é tocado). Esperado: whisper b5907 e Tesseract 0.8.0 passam no autoteste; `08-FERRAMENTAS/.estado-ferramentas.json` registra as duas.
- [ ] **Passo 4:** prova da recusa: rodar de novo com `FABRICA_AUTOTESTE_FORCAR_FALHA=tesseract` (variável só para teste, lida pelo autoteste) e conferir que a 0.8.0 continua em uso, a frase de "falhou" aparece e o `--verificar` não pede de novo.
- [ ] **Passo 5:** bateria completa na `fabrica-wt-mac`. Esperado: as mesmas falhas da linha de base, nenhuma a mais. Validador e `conferir-caminhos.js` saem 0.
- [ ] **Passo 6:** commit das correções, se houver.

### Task 9: Mac na nuvem (as duas arquiteturas)

**Files:**
- Create (temporário, sai antes de juntar na `main`): `.github/workflows/teste-mac.yml`

- [ ] **Passo 1:** escrever o fluxo: dispara em `push` no ramo `mac-e-atualizacoes` e em `workflow_dispatch`; matriz `macos-15` (chip Apple) e `macos-15-intel`; passos: `actions/checkout`, `actions/setup-node` (Node 22), copiar o repositório para `~/Fábrica Teste` (pasta com acento e espaço), e lá: `node _fabrica/core/instalar.js`, `node _fabrica/core/ambiente.js --json`, `node _fabrica/core/autoteste-ferramentas.js --json`, os testes `programas`, `ferramentas`, `compilar-whisper`, `autoteste-ferramentas`, `ambiente` e `instalar`; publicar os registros como artefato.
- [ ] **Passo 2:** `git push -u origin mac-e-atualizacoes` (privado) e acompanhar com `gh run watch`.
- [ ] **Passo 3:** corrigir o que falhar (na tarefa dona, com teste) até as duas máquinas passarem. Se o Tesseract não renderizar por falta de placa de vídeo na nuvem, registrar o erro exato e deixar a renderização para o Mac de verdade.
- [ ] **Passo 4:** com o resultado, confirmar (ou desfazer) o aviso de acento só no Windows e fechar os valores de `versoes-testadas.json` (Tesseract, etiqueta do whisper, caminhos do ffmpeg do Mac).
- [ ] **Passo 5:** apagar `.github/workflows/teste-mac.yml` e commit `Mac na nuvem: instalação e autoteste conferidos nas duas arquiteturas`.

### Task 10: versão 0.9.0 e entrega para o teste no Mac do responsável

**Files:**
- Modify: `_fabrica/versao.json` (`"versao": "0.9.0"`, data, novidades em palavras simples: Mac completo, programas sempre na versão mais nova com teste antes de trocar, whisper destravado)

- [ ] **Passo 1:** escrever as novidades e rodar a bateria, o validador (com a lista privada, se achada) e o `conferir-caminhos.js`.
- [ ] **Passo 2:** `git fetch origin` e conferir se a `main` privada ou o público andaram; se sim, juntar e repetir o Passo 1.
- [ ] **Passo 3:** commit `Versão 0.9.0: Fábrica no Mac e programas sempre atualizados com autoteste` e push do ramo.
- [ ] **Passo 4:** entregar ao responsável o pedido pronto para colar no Claude Code do Mac (instalação do zero a partir do ramo, depois um Reels curto) e o que observar.
- [ ] **Passo 5:** publicar (privado e depois público por `commit-tree`) só com o ok dele, seguindo as regras de publicação.
