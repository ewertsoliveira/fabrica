# Etapa 2: instruções da Fábrica pela empresa ativa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** perfil, marca, saídas, memória, dados e investigações de cada linha passam a ir para a empresa ativa. A
`/fabrica` ganha os comandos de empresa. Antes de entregar, o runner confere se a peça tem algo de outra empresa.

**Arquitetura:** o agente nunca escreve um caminho de empresa à mão. Ele pergunta ao leitor
(`node _fabrica/core/empresa.js caminhos --linha <l>`) e usa o que vier. Na pasta antiga (`principal`), o leitor
devolve os mesmos caminhos de hoje, então nada muda para quem tem uma empresa só.

**Tecnologia:** Node, sem dependências; os testes são scripts `node` com `assert`, imprimindo `ok <caso>`. O resto são
textos em Markdown e YAML.

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 6.1 a 6.5 e 12
(etapa 2). Etapa anterior: `docs/superpowers/plans/2026-10-30-etapa-1-gavetas-por-empresa.md`.

## Restrições globais

- **Nada muda para quem tem uma empresa só:** em `principal`, todo caminho resolvido é o mesmo de hoje
  (`linhas/<l>/saida`, `_fabrica/_memoria/empresa.md`, `06-MARCA-E-FOTOS/marca.yaml` e os demais).
- **Nunca mover, apagar nem sobrescrever dados existentes:** marca, perfil, decisões, linhas próprias, saídas e
  memória.
- **Git:** sem `git push`, `pull`, `merge` ou `reset`. Commit local por tarefa, no ramo `biblioteca`.
- **Antes de cada commit:**
  `node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos <lista privada>`, que precisa sair `0`.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit e nunca trocar texto de várias linhas por script.
- **Textos para o usuário final:** português do Brasil, sem jargão técnico. Diga "empresa", "trocar de empresa" e
  "conferência"; nunca "gaveta", "disposição", "índice" ou "legado" em mensagens ao usuário. Esses termos ficam só
  em comentários e documentos para quem constrói.
- **Toda pergunta ao usuário pela `AskUserQuestion`,** com 2 a 4 opções (regra da `/fabrica`).

## Foco da revisão

1. **Duas empresas e nenhuma escolhida quando a pessoa digita `/fabrica`:** a skill pergunta qual empresa usar, numa
   `AskUserQuestion` com os nomes. Ela nunca segue com a marca de exemplo nem adivinha. Teste: o texto da Tarefa 2 e
   o conferidor da Tarefa 5.
2. **Pasta antiga rodando a linha de Reels:** o run grava em `linhas/reels/saida/<run_id>/`, como hoje. Teste: o
   caso `principal` do `--linha` na Tarefa 1.
3. **A conferência acha algo de outra empresa no meio de um run:** o runner para antes de entregar, mostra o termo e
   o arquivo em linguagem simples e não marca o passo como concluído. Teste: o texto da Tarefa 3.
4. **Trocar de empresa no meio de uma conversa:** a skill troca e recomenda abrir uma conversa nova, e o run em
   andamento não é retomado em nome da outra empresa. Teste: o texto da Tarefa 2.
5. **Caminho com `../` no `marca.yaml` de uma empresa:** dá erro claro, nunca lê fora da pasta da empresa. Teste na
   Tarefa 1.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `_fabrica/core/empresa.js` (+ teste) | `caminhos [<c>] [--linha <l>] [--json]` |
| `08-FERRAMENTAS/marca/marca.js` (+ teste) | `caminho()` da empresa recusa sair da pasta da empresa |
| `_fabrica/core/investigacao.js` (+ teste, se houver) | `validar <linha>` lê as investigações da empresa ativa |
| `.claude/skills/fabrica/SKILL.md`, `.claude/skills/fabricar/SKILL.md`, `.claude/skills/atualizar/SKILL.md` | empresa ativa e comandos de empresa |
| `CORE.md` | a seção "Empresas" passa a dizer que tudo segue a empresa ativa |
| `_fabrica/core/runner.pipeline.md`, `_fabrica/core/arquiteto.agent.yaml`, `_fabrica/core/prompts/*.md` | caminhos pelo leitor e conferência antes de entregar |
| `linhas/reels/**` (`linha.yaml`, `LEIA-ME.md`, `passos/01-entrada.md`, `passos/03-plano.md`, `dados/briefing.md`, `dados/entrevista-de-estilo.md`, `estacoes/revisao.md`) | caminhos da empresa pelo leitor |
| demais `.md` e `.yaml` que citam o contrato de marca: `08-FERRAMENTAS/*/LEIA-ME.md`, `08-FERRAMENTAS/tesseract/modelos/README.md`, `05-ESTRATEGIA/nucleo-de-conteudo/regras/05-*.md` e `11-video.md`, `06-MARCA-E-FOTOS/marca.exemplo.yaml`, `06-MARCA-E-FOTOS/estilo-de-video.exemplo.md`, `_fabrica/core/boas-praticas/LEIA-ME.md`, `_fabrica/_memoria/empresa.md` | o texto passa a falar da empresa ativa |
| `_fabrica/core/conferir-caminhos.js` (+ teste) (novo) | proteção contra caminho antigo escrito à mão nas instruções |

---

### Tarefa 1: o código que as instruções vão usar

**Arquivos:**
- Alterar:
  - `_fabrica/core/empresa.js` (CLI `caminhos`);
  - `08-FERRAMENTAS/marca/marca.js` (`caminho()`);
  - `_fabrica/core/investigacao.js` (`validar`).
- Testes: `_fabrica/core/empresa.test.js`, `08-FERRAMENTAS/marca/marca.test.js` e um teste de `investigacao.js`
  (no `isolamento.test.js`, se ele não tiver teste próprio).

**Interfaces produzidas** (as Tarefas 2 a 4 escrevem estes comandos nos textos):
- `node _fabrica/core/empresa.js caminhos [<codigo>] [--linha <l>] [--json]`:
  - **Sem `<codigo>`:** usa a empresa ativa e recusa (saída 1) se não houver uma escolhida.
  - **Com `--linha <l>`:** imprime as cinco chaves por linha (`saidas`, `memoria`, `dadosLinha`, `estadoLinha` e
    `investigacoes`) já resolvidas, em vez de `<linha>`. O nome da linha passa pela mesma validação (`LINHA_INVALIDA`,
    saída 1).
  - **Com `--json`:** imprime um único objeto JSON com todas as chaves, mais `codigo` e `nome`.
  - **Sem as opções:** a saída de hoje não muda.
- `marca.caminho(rel)`, com marca de empresa de gaveta: depois de normalizar, se o caminho resolvido ficar fora da
  pasta da empresa e não for do modelo (`06-MARCA-E-FOTOS/exemplo/...` ou fora de `06-MARCA-E-FOTOS/`), lança um erro
  com `code = 'CAMINHO_FORA_DA_EMPRESA'`. A mensagem cita o caminho e diz para corrigir o `marca.yaml` da empresa.
  Fora de gaveta, nada muda.
- `node _fabrica/core/investigacao.js validar <linha>`: confere `caminhos(ativa).investigacoes(<linha>)`. Na
  `principal`, o resultado é o mesmo de hoje.

- [ ] **Passo 1: escrever os testes que falham.**

  | Caso | O que confere |
  |---|---|
  | `caminhos --linha na pasta antiga` | raiz só com `06-MARCA-E-FOTOS/marca.yaml` → `caminhos --linha reels` imprime `saidas: <r>/linhas/reels/saida`, e nenhuma linha contém `<linha>` |
  | `caminhos --linha na gaveta` | `aurora` ativa → `saidas: <r>/empresas/aurora/saidas/reels` e `estadoLinha: <r>/empresas/aurora/estado/reels.json` |
  | `caminhos --json` | `JSON.parse` da saída tem `codigo === 'aurora'`, `nome`, `marca`, e com `--linha` tem `saidas` resolvido |
  | `caminhos sem escolha` | duas empresas e nenhuma ativa → saída 1, com a mensagem da recusa |
  | `caminhos --linha inválida` | `--linha ../x` → saída 1 (`LINHA_INVALIDA`) |
  | `caminho fora da empresa` | gaveta `aurora` com `marca.yaml` cujo `tipografia.principal.arquivo` é `../../06-MARCA-E-FOTOS/fontes/x.ttf` → `marca.caminho(...)` lança `CAMINHO_FORA_DA_EMPRESA`. um arquivo de `06-MARCA-E-FOTOS/exemplo/fontes/` continua indo para a raiz do código. Na pasta antiga, `../algo` continua como hoje |
  | `investigacao da empresa ativa` | `aurora` ativa com `empresas/aurora/investigacoes/reels/` contendo uma investigação válida → `investigacao.js validar reels` sai 0 e lê dali. Com uma investigação só em `linhas/reels/_investigacoes/` (da `principal`), a `aurora` não a enxerga |

- [ ] **Passo 2: rodar e ver falhar,** um comando por arquivo de teste.
- [ ] **Passo 3: implementar** as três mudanças.
- [ ] **Passo 4: rodar e ver passar.** Todos os testes do repositório (`git ls-files '*.test.js'`) precisam sair 0.
  O `gerar.test.js` roda com `NODE_PATH` e `FABRICA_CHROMIUM` externos.
- [ ] **Passo 5: rodar o validador e fazer o commit.** Mensagem: "Empresas, etapa 2, item 1: caminhos por linha, caminho
  da marca preso à empresa e investigações da empresa ativa".

---

### Tarefa 2: a `/fabrica` conhece as empresas

**Arquivos:**
- Alterar:
  - `.claude/skills/fabrica/SKILL.md`;
  - `.claude/skills/fabricar/SKILL.md`;
  - `.claude/skills/atualizar/SKILL.md`;
  - `CORE.md`, na subseção "Empresas" e nas outras 5 menções a caminhos de empresa.

**Interfaces:** consome a CLI da Tarefa 1. Produz o vocabulário de comandos que as Tarefas 3 e 4 citam.

**Regras para o texto da `fabrica/SKILL.md`:**
- **Inicialização,** antes do passo 1 de hoje:
  1. Rodar `node _fabrica/core/empresa.js caminhos --json`.
  2. Se a saída for 1 com "nenhuma está escolhida", rodar `empresa.js listar` e perguntar com `AskUserQuestion`
     "Para qual empresa vamos trabalhar agora?", com as empresas como opções. Se forem mais de 4, mostrar as 3 mais
     recentes e "Outra (digite o código)".
  3. Ativar a escolhida e rodar de novo.
  4. Sem nenhuma empresa, seguir como hoje: onboarding.
  5. Guardar os caminhos e anunciar em uma linha "Empresa: <nome>".
- **Leituras e gravações:** o perfil, a marca, a memória e os dados da linha vêm sempre dos caminhos devolvidos:
  `perfil`, `marca`, `memoria`, `dadosLinha` e os outros. No texto, não sobra nenhum caminho fixo de empresa.
- **Onboarding:** grava o perfil em `perfil`. A conferência do contrato de marca usa `marca`. O texto que manda copiar
  o `marca.exemplo.yaml` passa a dizer "para o caminho `marca` da empresa".
- **Comandos novos** na tabela de roteamento e na ajuda:
  - `/fabrica empresas`: lista as empresas e marca a ativa.
  - `/fabrica nova-empresa <nome>`:
    1. sugere o código;
    2. pergunta se quer usar esse código, com `AskUserQuestion`;
    3. roda `empresa.js criar`;
    4. pergunta se quer trocar para ela agora.
  - `/fabrica trocar-empresa [<codigo>]`:
    1. sem código, pergunta como na inicialização;
    2. roda `empresa.js ativar`;
    3. avisa: "Trocado para <nome>. Para não misturar nada da empresa anterior, abra uma conversa nova antes de
       produzir."
    4. Nesta conversa, não retoma nenhum run começado em nome da outra empresa.
- **Menu:** "Mais opções" ganha "Empresas", com listar, criar e trocar. São no máximo 4 opções por pergunta, então
  "Empresas" entra no lugar de agrupar "Perfil da empresa" com "Configurações e ajuda", se precisar.
- **Regras críticas** ganham duas linhas:
  - "Toda execução usa só os caminhos da empresa ativa."
  - "Ao trocar de empresa, recomendar uma conversa nova."
- **`fabricar/SKILL.md` e `atualizar/SKILL.md`:** só a menção a caminho de empresa. Em `atualizar`, dizer que a pasta
  `empresas/` nunca é tocada.
- **`CORE.md`, subseção "Empresas":**
  - tirar "até a etapa 2, só a marca segue a empresa ativa";
  - dizer que perfil, marca, saídas, memória, dados e investigações das linhas seguem a empresa ativa pelo leitor;
  - manter os nomes das duas disposições;
  - citar os três comandos novos;
  - as outras 5 menções passam a falar do caminho da empresa ativa.

- [ ] **Passo 1:** editar os quatro arquivos com Edit, seguindo as regras.
- [ ] **Passo 2:** reler a `fabrica/SKILL.md` inteira e conferir que nenhum caminho fixo de empresa sobrou, salvo em
  frase que fale da pasta antiga para quem constrói. Conferir também os casos 1 e 4 do "Foco da revisão".
- [ ] **Passo 3: rodar o validador e fazer o commit.** Mensagem: "Empresas, etapa 2, item 2: a /fabrica trabalha pela
  empresa ativa e ganha os comandos de empresa".

---

### Tarefa 3: runner, Arquiteto e prompts pela empresa ativa

**Arquivos:**
- Alterar:
  - `_fabrica/core/runner.pipeline.md`;
  - `_fabrica/core/arquiteto.agent.yaml`;
  - `_fabrica/core/prompts/carrossel-compartilhado.md`, `construcao.prompt.md`, `descoberta.prompt.md`,
    `desenho.prompt.md`, `investigacao-compartilhado.md`, `investigacao-instagram.md` e `investigacao-youtube.md`.

**Regras do runner:**
- **No início do run:** `node _fabrica/core/empresa.js caminhos --linha <nome> --json`. Daí saem:
  - a pasta do run, em `<saidas>/<run_id>/`;
  - o estado, em `<estadoLinha>`;
  - a memória, em `<memoria>/memories.md`;
  - os dados da empresa na linha, em `<dadosLinha>/`.
- **Como traduzir os caminhos do `linha.yaml`:**
  - `saida/...` aponta para `<saidas>/...`;
  - `memoria/...` aponta para `<memoria>/...`;
  - um arquivo de `dados/` que esteja em `protegidos` do `_fabrica/propriedade.json` aponta para `<dadosLinha>/`;
  - o resto de `dados/` continua em `linhas/<nome>/dados/`, porque é do modelo.
  - O runner faz essa tradução; o `linha.yaml` não muda.
- **Antes de cada entrega e antes de marcar um passo como concluído:** rodar
  `node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --empresa <codigo> <pasta do run>`.
  - Se sair 1: parar, mostrar ao usuário em linguagem simples ("Encontrei o nome '<termo>', que é de outra empresa,
    em <arquivo>. Corrijo antes de seguir?"), não marcar o passo como concluído e não entregar.
  - Se sair 2: mostrar a mensagem e parar.
- **Os blocos de shell do runner** (`cp`/`rm` do estado, "Pasta do run: ...") passam a usar os caminhos resolvidos.
- **Arquiteto e prompts:**
  - o perfil e a marca vêm dos caminhos da empresa ativa;
  - as investigações vão para `investigacoes` da linha (`--linha <codigo da linha>`);
  - ao criar uma linha nova, o código dela segue a regra de nome de linha (`/^[a-z0-9][a-z0-9_-]*$/`). Isso também
    vai para o `descoberta.prompt.md`, onde o código é escolhido.

- [ ] **Passo 1:** editar os arquivos com Edit, seguindo as regras.
- [ ] **Passo 2:** rodar `node _fabrica/core/validar-linha.js reels` (precisa continuar saindo 0) e reler o runner,
  conferindo o caso 3 do "Foco da revisão".
- [ ] **Passo 3: rodar o validador e fazer o commit.** Mensagem: "Empresas, etapa 2, item 3: runner, Arquiteto e
  prompts usam os caminhos da empresa ativa e conferem antes de entregar".

---

### Tarefa 4: linha de Reels e o resto da documentação

**Arquivos:** os arquivos de `linhas/reels/` do mapa e os "demais `.md` e `.yaml`" do mapa.

**Regras:**
- **Troca de texto:**
  - cada "`06-MARCA-E-FOTOS/marca.yaml`" vira "o `marca.yaml` da empresa ativa (caminho `marca` em
    `node _fabrica/core/empresa.js caminhos`)";
  - o mesmo vale para `estilo-de-video.md` (`estiloDeVideo`), `empresa.md` (`perfil`) e os caminhos de saída,
    memória e investigações de linha.

  Em arquivo para o usuário final, o texto curto basta: "o marca.yaml da sua empresa".
- **`06-MARCA-E-FOTOS/marca.exemplo.yaml`:** o "copie para marca.yaml na mesma pasta" passa a dizer "copie para o
  caminho `marca` da empresa (na pasta antiga, `06-MARCA-E-FOTOS/marca.yaml`; numa empresa nova, `empresas/<codigo>/marca.yaml`)".
  O resto do arquivo não muda.
- **Regras do Núcleo** (`05-*.md`, `11-video.md`): só a menção ao caminho. Nenhum dado de empresa entra no Núcleo.
- **`_fabrica/_memoria/empresa.md`:** é o modelo do perfil na pasta antiga. Acrescentar uma linha dizendo que, numa
  empresa nova, o perfil fica no caminho `perfil` da empresa.
- **Nenhuma mudança de comportamento:** os campos `saida:` do `linha.yaml` continuam relativos à linha, porque a
  tradução é do runner (Tarefa 3).

- [ ] **Passo 1:** editar os arquivos com Edit.
- [ ] **Passo 2:** `node _fabrica/core/validar-linha.js reels` sai 0.
- [ ] **Passo 3: rodar o validador e fazer o commit.** Mensagem: "Empresas, etapa 2, item 4: linha de Reels e
  documentação falam da empresa ativa".

---

### Tarefa 5: proteção contra caminho antigo escrito à mão

**Arquivos:** criar `_fabrica/core/conferir-caminhos.js` e `_fabrica/core/conferir-caminhos.test.js`.

**Interfaces:**
- **Linha de comando:** `node _fabrica/core/conferir-caminhos.js [--raiz <pasta>]`. Sai 0 quando está limpo e 1 quando
  acha algo, listando arquivo:linha e o caminho.
- **Módulo:** `conferir(raiz) -> Array<{ arquivo, linha, caminho }>`.

**Regras:**
- **Arquivos varridos:** `.md` e `.yaml` de `.claude/skills/`, `_fabrica/core/` (incluindo `prompts/`), `linhas/*/`,
  `08-FERRAMENTAS/` e `05-ESTRATEGIA/nucleo-de-conteudo/regras/`, mais o `CORE.md`.
- **Padrões procurados:**
  - `06-MARCA-E-FOTOS/marca.yaml`;
  - `06-MARCA-E-FOTOS/estilo-de-video.md`;
  - `06-MARCA-E-FOTOS/estilos-proprios`;
  - `_fabrica/_memoria/empresa.md`;
  - `linhas/<algo>/saida`, `linhas/<algo>/memoria`, `linhas/<algo>/estado.json` e `linhas/<algo>/_investigacoes`;
  - `03-CRONOGRAMA/dados`;
  - `04-LABORATORIO-DE-DESIGN/dados` e `04-LABORATORIO-DE-DESIGN/referencias`.
- **Linhas permitidas:**
  - a linha cita "pasta antiga" ou "legado";
  - o arquivo é o `CORE.md` e a linha está na subseção "Empresas";
  - o arquivo é `06-MARCA-E-FOTOS/marca.exemplo.yaml`.

- [ ] **Passo 1: escrever o teste.**
  - **Raiz temporária com um `SKILL.md`** que contém `06-MARCA-E-FOTOS/marca.yaml` numa linha comum → 1 achado. Uma
    linha que cita "na pasta antiga, `06-MARCA-E-FOTOS/marca.yaml`" → 0 achados.
  - **`linhas/x/passos/a.md`** com `linhas/x/saida/` → 1 achado.
  - **A matriz real:** `conferir(<raiz da matriz>)` igual a `[]`. Esse caso só passa depois das Tarefas 2 a 4.
- [ ] **Passo 2: implementar.**
- [ ] **Passo 3: rodar e ver passar.** Se a matriz real tiver achados, corrigir o texto (com Edit) no lugar acusado,
  seguindo as regras das Tarefas 2 a 4, e anotar cada correção no relatório.
- [ ] **Passo 4:** todos os testes do repositório saem 0, e o validador também sai 0. Fazer o commit com a mensagem
  "Empresas, etapa 2, item 5: conferência de caminhos de empresa escritos à mão".
