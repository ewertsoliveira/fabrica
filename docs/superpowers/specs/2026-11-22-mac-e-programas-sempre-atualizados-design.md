# Fábrica no Mac e programas de vídeo sempre atualizados, com autoteste (desenho)

Data: 22/11/2026. Versão alvo: 0.9.0. Ramo: `mac-e-atualizacoes` (cópia `fabrica-wt-mac`, a partir de 49e6914, a 0.8.3).

## 1. Intenção

O responsável tentou instalar a Fábrica num Mac. A IA avisou que muita coisa não era compatível e teve que baixar e
adaptar programas por conta própria. A causa está no código: a parte de vídeo foi escrita só para Windows. O instalador
das ferramentas sai com "só funciona no Windows por enquanto", a instalação pula o vídeo fora do Windows, e os scripts
da edição chamam `cmd.exe`, o `tsrct.cmd` em `%LOCALAPPDATA%`, o `whisper-cli.exe` e o PowerShell. Carrossel, posts,
painéis, fotos, área de cópia e atalhos já funcionam no Mac.

Quem recebe a Fábrica é leigo e instala com uma IA que segue o `INSTALAR.md`. A instalação e a linha de Reels têm que
funcionar igual no Windows e no Mac, sem improviso da IA e sem a pessoa digitar senha no Terminal.

O responsável também quer os programas de vídeo (Tesseract, whisper.cpp, ffmpeg) sempre na versão mais nova, para quem
instala e para quem já usa. A Fábrica já busca a mais nova na instalação e no pré-voo de cada Reels (só no Windows), mas:

- **o whisper.cpp está preso.** O projeto passou a publicar os programas prontos em versões numeradas (`bNNNN`), marcadas
  como pré-lançamento; as etiquetas `v1.9.x` saem sem arquivos. A Fábrica pula pré-lançamentos, então a escolha automática
  cai hoje na b4938 (20/08/2026), e a mais nova é a b5907 (20/11/2026). Pior: `versaoDe('b4938')` devolve `null`, e com
  isso a versão instalada nunca é trocada.
- **o Tesseract lança versão quase toda semana** (0.5.0 em 03/11, 0.6.0 em 06/11, 0.7.0 em 13/11, 0.8.0 em 19/11). Uma
  versão nova pode travar ou mudar o vídeo. Com "sempre a mais nova" sem proteção, o problema pegaria todo mundo no meio
  de um Reels.

**Decisão do responsável (22/11/2026), entre três opções: "instala e se testa sozinha".** A versão nova só passa a ser
usada depois de passar num teste rápido no próprio computador. Se falhar, continua a versão que funcionava e a pessoa é
avisada em palavras simples. Recusadas: só instalar, sem teste; robô na nuvem testando toda semana.

## 2. Metas

1. **Mac, qualquer um** (pedido do responsável em 22/11: "compatível com qualquer Mac"; ele não sabe qual tem): chip
   Apple e Intel, com macOS 14 ou mais novo. A instalação guiada (`INSTALAR.md` + `instalar.js`) instala e confere tudo,
   inclusive o vídeo, sem a IA improvisar e sem senha digitada no Terminal. Mac mais antigo que o macOS 14 não roda o
   Tesseract (limite do próprio programa): a Fábrica diz isso em palavras simples e instala o que der.
2. **Reels no Mac**: todos os scripts da linha de vídeo acham `tsrct`, `whisper-cli`, `ffmpeg` e `ffprobe` no sistema em
   que estão rodando.
3. **Sempre a mais nova**: na instalação e no pré-voo de cada Reels, cada programa é comparado com a versão mais nova
   publicada, nos dois sistemas. O whisper volta a acompanhar as versões.
4. **Autoteste antes de trocar**: a versão nova é instalada à parte e testada (ffmpeg, whisper e Tesseract com um modelo
   de edição da própria Fábrica). Só depois de passar ela vira a versão em uso. Se falhar, fica a que funcionava; na
   primeira instalação, entra a última versão que a Fábrica já testou.
5. **Windows igual ou melhor**: tudo o que funciona hoje continua funcionando, agora com o autoteste e a correção do
   whisper.

## 3. Fora do escopo

- Linux (o vídeo segue "não disponível neste computador"; o resto continua como está).
- iPhone e iPad (não rodam a Fábrica).
- Robô na nuvem que testa versões novas (opção recusada).
- Guardar os programas dentro do repositório.
- Trocar o motor de transcrição, o modelo do whisper ou os modelos de edição.

## 4. Anti-metas (falharia mesmo funcionando)

- A pessoa ter que digitar senha no Terminal, instalar Homebrew, abrir arquivo ou ler mensagem técnica.
- A IA decidir em silêncio (por exemplo, instalar as ferramentas da Apple sem dizer o que são e sem pedir o "sim"),
  contra a regra 12 do `INSTALAR.md`.
- Uma versão nova substituir a que funciona antes de passar no teste.
- O Mac usar um ffmpeg sem algum codificador que a Fábrica usa (o vídeo sairia diferente ou falharia só no Mac).
- Burlar o Gatekeeper ou apagar o atributo de quarentena (o guia do próprio Tesseract proíbe).

## 5. Restrições conhecidas (medidas em 22/11/2026)

- **Tesseract.** Publica `tesseract-<versão>-darwin-arm64.zip` e `-darwin-x86_64.zip` (além de `windows-x86_64` e
  `linux-x86_64`), cada um com `.sha256`, e um `release-manifest.json`. No Mac: conferir com `shasum -a 256`, abrir com
  `ditto -x -k` e rodar `bash install.sh [prefixo]`. Instala em `~/Library/Application Support/Tesseract/bin/tsrct`
  (endereço com espaço), guarda cada versão em `public-cli/<versão>-<arquitetura>` e só troca o link depois de conferir o
  pacote e rodar `--version`. Não pede senha, Homebrew nem Node. Assinado e notarizado pela Apple. **Exige macOS 14.0**,
  nas duas arquiteturas. Sob Rosetta (`sysctl -in sysctl.proc_translated` igual a 1), usar o pacote `arm64`. No Windows o
  instalador também guarda as versões lado a lado (este computador tem 0.3.0, 0.3.1, 0.6.0 e 0.7.0), e o `tsrct.cmd`
  aponta para a ativa. O CLI do Tesseract não transcreve fala.
- **whisper.cpp.** Não publica programa pronto para Mac: só o `xcframework`, que é biblioteca para aplicativos. Compila no
  Mac com CMake (o `Makefile` só chama o CMake), com Metal ligado por padrão e a biblioteca do Metal embutida (não precisa
  do Xcode completo). Precisa das Ferramentas de Linha de Comando da Apple (clang, make), que também trazem o git do Mac.
- **CMake.** Versão portátil oficial da Kitware no GitHub (`cmake-<versão>-macos-universal.tar.gz` com
  `cmake-<versão>-SHA-256.txt`). Usada só para compilar, sem instalar nada no sistema.
- **ffmpeg.** Não há versão oficial para Mac; o ffmpeg.org aponta o evermeet.cx, que é só Intel. Escolhida a
  ffmpeg.martin-riedl.de: tem Apple Silicon e Intel, é assinada, publica `.sha256` ao lado de cada arquivo e oferece link
  fixo da última versão estável (`ffmpeg.martin-riedl.de/redirect/latest/macos/{arm64|amd64}/release/{ffmpeg.zip|ffprobe.zip}`,
  que redireciona para `/download/macos/<arquitetura>/<carimbo>_<versão>/ffmpeg.zip`; a versão sai desse caminho e hoje é
  a 9.1). O site avisa que publica versões estáveis para Intel até janeiro de 2027.
- **Playwright (navegador dos carrosséis), achado na construção:** também exige macOS 14 (Sonoma) ou mais novo e Node
  22, 24 ou 26. Num Mac anterior ao 14, carrosséis e vídeos podem não funcionar: a instalação avisa e pergunta se a
  pessoa prefere atualizar o macOS antes. (O Node 20 que a Fábrica ainda aceita fica como pendência.)
- **onnxruntime-node (máscara da pessoa), achado na construção:** a partir da 1.24 não traz programa para Mac Intel; a
  última que traz é a 1.23.2, fixada no `package.json` para valer em qualquer Mac.
- **Homebrew: recusado.** Pede senha no Terminal, e a IA não digita senha. Só tem programa pronto (ffmpeg e whisper.cpp)
  para chip Apple com macOS 15 ou mais novo; nos demais Macs, compila por horas.
- **API do GitHub sem login**: 60 consultas por hora por endereço de internet. O pré-voo faz poucas. Uma consulta que
  falhar não pode travar o Reels.
- **Downloads feitos pelo Node** não recebem quarentena no Mac. O whisper compilado na própria máquina é assinado
  automaticamente pelo linker no chip Apple.
- **Fim de linha.** O repositório guarda LF (`git ls-files --eol` não mostra nenhum arquivo em CRLF); nada a converter. O
  atalho `.command` já sai com LF.
- **Pasta com acento.** A regra vem do whisper do Windows: o `preparar-material.js` copia o áudio para uma pasta
  temporária, mas o modelo não pode ficar em caminho com acento. No Mac a expectativa é funcionar; confirmar no teste do
  Mac antes de deixar o aviso valendo só no Windows.

## 6. Abordagens consideradas

**Programas no Mac.**
- (a) *Escolhida:* baixar direto das fontes oficiais ou confiáveis, conferir pelo SHA-256 e instalar sem senha. O
  Tesseract fica no lugar padrão dele. O ffmpeg e o whisper ficam dentro da pasta da Fábrica, como o whisper já fica no
  Windows. O whisper é compilado na própria máquina.
- (b) *Homebrew:* recusado (senha no Terminal; pronto só para Mac recente com chip Apple).
- (c) *Programas dentro do repositório:* recusado. O `tsrct` do Mac tem 180 MB, acima do limite de 100 MB por arquivo do
  GitHub; cada sistema precisa do seu; e o repositório cresceria a cada versão.

**Política de atualização** (decisão do responsável).
- (a) *Escolhida:* instalar a mais nova e testar sozinha.
- (b) Só instalar, sem teste.
- (c) Robô na nuvem que testa toda semana e libera.

**Como testar sem quebrar.**
- (a) *Escolhida:* testar antes de trocar. A candidata é instalada à parte e testada, e só então vira a versão em uso.
  Complementa: uma lista de versões testadas no repositório, para a primeira instalação e para quando o GitHub não
  responde.
- (b) Trocar e voltar se falhar: recusada. No intervalo, ou se o computador desligar no meio, a pessoa fica com a versão
  com defeito.

## 7. Desenho

### 7.1 Um lugar só para saber onde cada programa está

Módulo novo `_fabrica/core/programas.js`, dono único dos caminhos e de como rodar cada programa:

| Programa | Windows | Mac |
|---|---|---|
| `tsrct` | `%LOCALAPPDATA%\Tesseract\bin\tsrct.cmd`, rodado por `cmd.exe /d /s /c` com aspas (como o `rodaVersao` de hoje) | `~/Library/Application Support/Tesseract/bin/tsrct`, rodado direto |
| `whisper` | `08-FERRAMENTAS/whisper-cpp/bin/Release/whisper-cli.exe` | `08-FERRAMENTAS/whisper-cpp/bin/whisper-cli` |
| `ffmpeg`, `ffprobe` | o do PATH (winget) | `08-FERRAMENTAS/ffmpeg/bin/`, cuidado pela Fábrica; sem ele, o do PATH |

- Aceita troca por variável de ambiente (no padrão da `FABRICA_CHROMIUM`, que já existe) e por prefixo, para o autoteste
  apontar para a candidata e para os testes isolados.
- Ao ser carregado, põe a pasta do ffmpeg da Fábrica no começo do `process.env.PATH`. Assim as chamadas que já existem,
  `spawn('ffmpeg', ...)`, e os processos filhos acham o programa sem mexer em cada chamada. Os scripts de entrada passam
  a carregar o módulo.
- Passam a usar o módulo os pontos que hoje fixam o Windows: `blocos-motion/tsrct.js`, `exportar-em-pedacos.js`,
  `modelos/motor.js`, `preparar-material.js`, `projetos/medir-palavras.js`, `projetos/montar-video.js`, `ambiente.js` e
  `ferramentas.js`.
- `exportar-em-pedacos.js`: a pré-checagem de memória (`tasklist`) e o amostrador em PowerShell ganham equivalente com
  `ps` no Mac, ou ficam desligados no Mac com um aviso, se o equivalente não for confiável.
- `08-FERRAMENTAS/tesseract/LEIA-ME.md` passa a descrever os caminhos dos dois sistemas.

### 7.2 Instalador das ferramentas (`_fabrica/core/ferramentas.js`), por sistema

| Ferramenta | De onde vem | Conferência | Como sabe a versão |
|---|---|---|---|
| Tesseract | releases de `github.com/mirage-hq/Tesseract`, no arquivo do sistema e da arquitetura | `.sha256` do release, mais o `CHECKSUMS.sha256` interno, que o instalador oficial confere | `tsrct --version` comparado com a etiqueta `vX.Y.Z` |
| whisper.cpp | etiqueta mais nova que traz `whisper-bin-x64.zip`, incluindo as `bNNNN`. Windows: esse zip. Mac: o código-fonte da **mesma etiqueta** (`github.com/ggml-org/whisper.cpp/archive/refs/tags/<etiqueta>.tar.gz`), compilado com o CMake portátil e `-DBUILD_SHARED_LIBS=OFF`, forçando `arm64` sob Rosetta | download por HTTPS do GitHub (o código-fonte não tem SHA publicado); o autoteste confirma que o programa funciona | etiqueta gravada em `08-FERRAMENTAS/whisper-cpp/versao.json`; "mais nova" é outra etiqueta publicada depois (pela data de publicação), não comparação `x.y.z` |
| ffmpeg | Windows: winget, como hoje. Mac: link fixo da última versão estável do martin-riedl, `arm64` ou `amd64` | `.sha256` ao lado do arquivo | Mac: versão no caminho do redirecionamento comparada com `ffmpeg -version`. Windows: `winget upgrade`, como hoje |
| Modelo do whisper e modelo da máscara (RVM) | como hoje, iguais nos dois sistemas | tamanho mínimo, como hoje | arquivo único |
| CMake (só Mac, só para compilar) | release mais nova da Kitware | `SHA-256.txt` | descartado depois de compilar, ou guardado em cache numa pasta ignorada pelo git |
| Ferramentas da Apple (só Mac) | já vêm com o git do Mac, ou por `xcode-select --install` | `xcode-select -p` | quem instala é a pessoa, com um clique, no Passo 1 |

- Ordem: ffmpeg, modelo do whisper, whisper, Tesseract, RVM. Cada teste depende do anterior (o teste do Tesseract usa um
  vídeo feito pelo ffmpeg; o do whisper usa o modelo).
- Falha ao compilar o whisper no Mac conta como falha do autoteste: a candidata é descartada.
- macOS mais velho que o 14: o vídeo fica indisponível. A Fábrica diz isso em palavras simples e o resto da instalação
  segue.
- Linux: mantém a mensagem atual (vídeo não disponível).

### 7.3 Autoteste antes de trocar

Arquivo novo `_fabrica/core/autoteste-ferramentas.js`. O `ferramentas.js` chama depois de preparar uma candidata, e ele
também roda sozinho (por exemplo, `--so tesseract`).

**Fluxo por ferramenta:**
1. Prepara a candidata à parte: o Tesseract com o prefixo de uma pasta temporária (os dois instaladores oficiais aceitam
   prefixo); o whisper e o ffmpeg numa pasta `candidata`.
2. Roda o autoteste apontando para a candidata.
3. Se passou, põe em uso. Tesseract: o instalador oficial com o prefixo padrão, que confere e troca o link. Whisper e
   ffmpeg: troca de pasta, guardando a anterior até o próximo autoteste passar.
4. Se falhou, descarta a candidata, mantém a atual, anota a versão recusada (para o pré-voo não tentar de novo a mesma) e
   avisa.
5. ffmpeg do Windows: o winget não instala à parte, então atualiza e testa. Se falhar, tenta voltar à versão anterior
   pelo winget; se não der, avisa. É o programa mais estável da lista.

**O que o teste faz** (meta: menos de 2 minutos; só roda quando alguma versão muda):
1. **ffmpeg e ffprobe**: rodam; têm os codificadores e filtros que a Fábrica usa (levantar pelo uso no código, por exemplo
   `libx264`, `aac`, `libvpx-vp9`, `libwebp`, `ebur128`, `loudnorm`, `silencedetect`, `blackdetect`, `geq`, `concat`);
   geram um vídeo sintético curto, com som, e o ffprobe consegue ler.
2. **whisper**: transcreve uma fala curta guardada na Fábrica, com as mesmas opções do Reels (`-ojf` e o modelo real), e
   confere as palavras esperadas e os tempos crescentes. Fala de domínio público, por exemplo a `samples/jfk.wav` do
   próprio whisper.cpp.
3. **Tesseract**: monta, com o motor real dos modelos (`modelos/motor.js`), um projeto curto com um modelo de edição da
   Fábrica sobre o vídeo sintético; exporta uns 3 segundos; confere duração, tamanho, quadros e som; e compara 2 ou 3
   quadros com a referência deste computador. Diferença grande conta como falha ("mudou o jeito como o vídeo sai").
4. **Referência.** Os quadros da última versão que passou neste computador. Sem referência e com uma versão em uso que
   funciona (instalações que já existem), gera primeiro a referência com a versão em uso e só então testa a candidata.
   Numa instalação nova, sem versão anterior: confere que os quadros não estão vazios e têm texto onde deveriam, e o
   resultado vira a referência.
5. **Visual novo aprovado pela Fábrica.** Uma versão que está na lista de versões testadas (abaixo) pode mudar o visual.
   O autoteste dela confere só se funciona, e a referência local é refeita com ela. É assim que uma mudança de visual
   intencional do Tesseract chega a todos depois que quem mantém a Fábrica conferir.
6. **Tolerância.** Sai de medição real: renderizar o mesmo teste nas versões 0.6.0, 0.7.0 e 0.8.0 do Tesseract no
   Windows (instaláveis lado a lado com prefixo) e medir quanto os quadros mudam entre elas.

**Registro local** (ignorado pelo git): `08-FERRAMENTAS/.estado-ferramentas.json`. Guarda, por ferramenta, a versão em
uso, a data e o resultado do último autoteste, as versões recusadas e onde está a referência.

**Lista de versões testadas** no repositório: `_fabrica/core/versoes-testadas.json`. Traz a última versão de cada
ferramenta que passou nos testes de quem mantém a Fábrica (Windows e Mac) e o que for preciso para baixá-la direto. Serve
para três casos:
- primeira instalação quando a mais nova falha;
- quando o GitHub não responde ou passou do limite de consultas;
- liberar um visual novo do Tesseract.

A lista é atualizada a cada versão da Fábrica; isso entra na seção "Para quem mantém a Fábrica" do `INSTALAR.md`.

**O que a pessoa vê** (regra L-01, sem nome interno):
- passou: "Atualizei o programa que monta os vídeos e fiz um teste rápido: está tudo certo."
- falhou: "Saiu uma versão nova do programa que monta os vídeos, mas ela não passou no meu teste. Continuo com a versão
  que já funcionava; para você, nada muda."
- sem internet: "Não consegui ver se há versão nova agora. Sigo com a que já está instalada e funcionando."

### 7.4 Instalação guiada

- **`INSTALAR.md`**
  - Passo 1 no Mac: conferir `git --version` e `xcode-select -p`. Se faltar, explicar ("ferramentas gratuitas da Apple,
    que trazem o programa que baixa a Fábrica e o que monta a transcrição da fala"), pedir o "sim", rodar
    `xcode-select --install`, avisar que vai abrir uma janela do Mac e onde clicar ("Instalar"), e que leva alguns
    minutos. Node: `brew install node` se o Homebrew já existir; senão, o instalador do nodejs.org, como hoje.
  - Passo 3: "o Mac ou o Windows podem mostrar uma janela pedindo permissão".
  - Passo 4: o vídeo faz parte da instalação também no Mac; tempo estimado no Mac (inclui compilar o whisper); o que a
    pessoa vê enquanto isso.
  - Passo 6: o bloco "Para Reels (vídeo)" tem que estar OK também no Mac. Exceção aceita: Mac com macOS antes do 14, que
    vira aviso, como o do acento.
  - Tirar todo "só no Windows" que deixa de ser verdade. No Passo 2, o aviso de acento passa a valer só no Windows, se o
    teste do Mac confirmar.
  - "Para quem mantém a Fábrica": antes de publicar, rodar o autoteste e atualizar `versoes-testadas.json`.
- **`instalar.js`**: o passo do vídeo roda no Windows e no Mac. A conferência final exige o vídeo nos dois, exceto no
  macOS antes do 14, que vira aviso.
- **`ambiente.js`**: caminhos vindos do `programas.js`; vídeo obrigatório no Mac; checagem de acento só no Windows (se
  confirmado).

### 7.5 Pré-voo do Reels

`linhas/reels/passos/01-entrada.md`: mesmo fluxo, agora nos dois sistemas. O item "se o Tesseract mudou de versão,
conferir os quadros de teste" passa a ser o autoteste automático. O relatório registra a versão em uso e se houve
atualização ou versão recusada.

### 7.6 Instalações que já existem

- Windows: o `/atualizar` traz os arquivos novos. No próximo Reels, o pré-voo atualiza as ferramentas com autoteste,
  inclusive tirando o whisper da b4938.
- O Mac em que a IA já instalou e adaptou arquivos: depois do `/atualizar`, os arquivos que ela mudou ficam como
  personalizados e as versões novas vão para `_fabrica/_atualizacao/pendentes/`. Recomendação: aceitar todas as versões
  novas desses arquivos, ou instalar do zero (mais simples, se ainda não há trabalho de cliente nessa cópia).

## 8. Verificação

1. **Testes unitários** (rodam no Windows): escolha do pacote por sistema e arquitetura, inclusive sob Rosetta;
   comparação de versões com `bNNNN`; caminhos do `programas.js` simulando `darwin` e `win32`; decisões do autoteste
   (passou, falhou, primeira instalação, sem internet, versão já recusada, versão da lista de testadas).
2. **Windows de verdade, isolado**: com `LOCALAPPDATA` falso e prefixo do Tesseract, numa cópia da Fábrica, atualizar o
   Tesseract de 0.7.0 para 0.8.0 e o whisper da b4938 para a mais nova, com autoteste. A bateria de testes atual continua
   passando.
3. **Medição da tolerância visual** com o Tesseract 0.6.0, 0.7.0 e 0.8.0.
4. **Mac na nuvem** (autorizado pelo responsável em 22/11): GitHub Actions no repositório **privado**, com um arquivo de
   teste temporário só no ramo de trabalho, removido antes de juntar na `main`. **Nas duas arquiteturas**, Mac com chip
   Apple e Mac Intel, porque a meta é qualquer Mac. Roda o `instalar.js`, o autoteste e um caso com pasta acentuada. Nada
   é publicado. Depende de:
   - a permissão `workflow` no GitHub para enviar o arquivo de teste (o login do `gh` tem só `repo`, `gist` e
     `read:org`; conferir antes se o envio pelo git já tem essa permissão);
   - minutos do plano do repositório privado (cada minuto de Mac conta como 10).

   Se o Mac da nuvem não tiver placa de vídeo para o Tesseract renderizar, essa etapa fica marcada e é confirmada no Mac
   de verdade.
5. **Mac de verdade**, o do responsável: instalação guiada do zero a partir do ramo, antes de publicar, e um Reels curto.
6. **Publicar**, só com o ok do responsável: versão 0.9.0, privado e depois público por `commit-tree`, seguindo as regras
   de publicação (buscar o origin e o público antes; validador com a lista privada).

## 9. Fica a cargo de quem constrói

- A lista exata de codificadores e filtros conferidos (levantar pelo uso no código).
- Qual modelo de edição e quais quadros o teste do Tesseract usa, e os limites de diferença (da medição).
- Se os scripts só carregam o `programas.js` (PATH) ou se as chamadas passam a usar o caminho do módulo.
- Como evitar baixar duas vezes o Tesseract (candidata e versão final).
- Onde fica a fala de teste e em que formato (wav pequeno, ou comprimido e convertido pelo ffmpeg no teste).
- Quantas versões antigas manter no disco.
- As entradas novas do `.gitignore` (pasta do ffmpeg, registro local, cache, referências).
- As isenções novas no validador (`isentos.json`, categoria `url`) para os arquivos com endereços de download.

## 10. Pendências registradas (não bloqueiam)

- ffmpeg para Mac Intel: o martin-riedl para de publicar versões estáveis para Intel em janeiro de 2027; depois disso, o
  Intel fica na última versão que passou. Decidir outra fonte (o evermeet.cx, que é o link do ffmpeg.org) quando chegar.
- O Tesseract tem telemetria de uso (pasta `telemetry` e comando `tsrct telemetry`). Avaliar se a Fábrica deve
  desligá-la por padrão para os clientes.
- Vídeo no Linux (as três ferramentas têm versão para Linux).
