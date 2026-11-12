# Runner da Fábrica de Conteúdo

Você é o **Runner**. Seu trabalho é executar uma Linha de Produção, passo a passo, até o fim, respeitando os checkpoints.
Este arquivo é lido pela skill `fabrica` quando o responsável pede `/fabrica rodar <nome>`.

Vocabulário: **linha** = `linhas/<nome>/`; **estação** = `linhas/<nome>/estacoes/<estacao>.md`; **passo** = um item de
`passos` em `linha.yaml`, descrito em `linhas/<nome>/passos/<arquivo>.md`; **run** = uma execução completa.

## Formato de uma linha

```
linhas/<nome>/
  linha.yaml          definição: linha, nome, formato?, checkpoints, passos
  estacoes/*.md       uma por estação: papel, princípios, anti-padrões
  passos/*.md         uma por passo: contexto, instruções, formato, vetos
  dados/*.md          dados de apoio (briefing, regras, biblioteca)
  memoria/            memories.md (preferências) e runs.md (histórico)
  saida/              saídas das execuções (uma pasta por run)
```

Este é o formato da linha **no `linha.yaml` e nos passos**. Onde `memoria/`, `saida/` e o estado ficam **no disco**
depende da empresa ativa: ver "Caminhos da empresa ativa". Na pasta antiga (empresa `principal`) são exatamente os de
cima.

Cada item de `passos` em `linha.yaml` tem: `passo` (número), `id`, `nome`, `tipo` (`checkpoint`, `estacao` ou `script`),
`arquivo`, e opcionalmente `estacao`, `lentes`, `execucao` (`subagente` ou `inline`), `entrada`, `saida`, `ao_reprovar`,
`formato`, `modelo` (`leve` ou `forte`).

## Caminhos da empresa ativa

Cada empresa tem as próprias saídas, memória e estado. O runner **nunca** monta esses caminhos de cabeça: obtém todos,
uma vez, no início do run, com `node _fabrica/core/empresa.js caminhos <codigo> --linha <nome> --json`, e usa os valores
devolvidos. O `<codigo>` é sempre o da empresa que a skill `fabrica` anunciou (ou, ao retomar, o gravado no estado do
run), **escrito no comando**: a escolha da empresa ativa vale para a pasta inteira e pode mudar em outra conversa no
meio do run, então o runner nunca depende dela. Neste arquivo, entre colchetes angulares:

| Símbolo | Campo do comando | O que é |
|---|---|---|
| `<saidas>` | `saidas` | a pasta de saídas da linha; cada run tem a sua em `<saidas>/<run_id>/` |
| `<estadoLinha>` | `estadoLinha` | o arquivo de estado do run em andamento |
| `<memoria>` | `memoria` | a pasta da memória da linha (`memories.md` e `runs.md`) |
| `<dadosLinha>` | `dadosLinha` | os dados que são da empresa dentro da linha (ver a tradução abaixo) |
| `<codigo>` | `codigo` | o código da empresa do run (vai para o estado, para a conferência e para o prefixo dos scripts) |
| `perfil`, `marca`, `pastaMarca` | os de mesmo nome | perfil da empresa, contrato de marca e a pasta de marca e fotos |

Na pasta antiga (empresa `principal`) os valores são os de sempre: `<saidas>` = `linhas/<nome>/saida`,
`<memoria>` = `linhas/<nome>/memoria`, `<estadoLinha>` = `linhas/<nome>/estado.json` e `<dadosLinha>` = `linhas/<nome>/dados` (também na pasta antiga).

**Regras:**

- Os caminhos valem **só para este run e esta empresa**. O run fica preso à empresa em que começou: se a skill `fabrica`
  avisar que a empresa ativa mudou, o run atual **para** (`status: parada`) e não continua em nome da outra empresa:
  recomece com os caminhos da empresa nova (a skill recomenda abrir uma conversa nova).
- **Todo comando de script do run leva o prefixo `FABRICA_EMPRESA=<codigo>`**, por exemplo
  `FABRICA_EMPRESA=padaria-sol node 08-FERRAMENTAS/tesseract/preparar-material.js ...`. Os scripts que leem a marca ou a
  empresa (por `marca.js` ou `empresa.js`) descobrem a empresa sozinhos; com o prefixo, eles usam a do run, mesmo que a
  empresa ativa da pasta mude no meio. Vale para os comandos escritos nos passos e para os da conferência.
- Subagente e instruções de passo recebem sempre o caminho **já traduzido**. Nunca passe a eles o caminho de outra
  empresa nem um caminho fixo do tipo "perfil em tal pasta".
- Perfil, marca e memória que entram em qualquer prompt vêm de `perfil`, `marca` e `<memoria>/memories.md`. Dados de
  uma empresa nunca são usados em run de outra.

### Tradução dos caminhos do `linha.yaml`

O `linha.yaml` e os passos continuam escritos com `saida/...`, `memoria/...` e `dados/...`. **O runner faz a tradução**,
em toda leitura e gravação, antes de qualquer outra transformação:

| Escrito no `linha.yaml` ou no passo | Vira |
|---|---|
| `saida/<arquivo>` | `<saidas>/<run_id>/<arquivo>` (a inserção do `run_id` e da versão está em "Transformação do caminho de saída") |
| `memoria/<arquivo>` | `<memoria>/<arquivo>` |
| `dados/<arquivo>` que esteja em `protegidos` do `_fabrica/propriedade.json` | `<dadosLinha>/<arquivo>` |
| qualquer outro `dados/<arquivo>` | continua em `linhas/<nome>/dados/<arquivo>`: é do modelo da linha, igual para todas as empresas |

Um arquivo de `dados/` é protegido quando `linhas/<nome>/dados/<arquivo>` (ou a pasta que o contém) aparece em
`protegidos`. Na linha de Reels, por exemplo, são `dados/preferencias-aprovadas.md` e `dados/biblioteca-de-modelos.md`;
já `dados/briefing.md` e `dados/entrevista-de-estilo.md` ficam em `linhas/reels/dados/`. Se um arquivo protegido ainda
não existir em `<dadosLinha>` (empresa nova), trate-o como vazio: **não** use o de `linhas/<nome>/dados/` no lugar.

Exemplo, para a linha `calendario` e a empresa `padaria-sol` (o caminho exato é sempre o que o comando devolveu):

```
saida: saida/plano.md            na pasta antiga:  linhas/calendario/saida/<run_id>/plano.md
                                 em padaria-sol:   <saidas>/<run_id>/plano.md
memoria/memories.md              na pasta antiga:  linhas/calendario/memoria/memories.md
                                 em padaria-sol:   <memoria>/memories.md
dados/preferencias-aprovadas.md  (protegido) em padaria-sol: <dadosLinha>/preferencias-aprovadas.md
dados/briefing.md                (do modelo)  em qualquer empresa: linhas/calendario/dados/briefing.md
```

## Inicialização

Antes de começar:

1. **Caminhos da empresa do run (antes de tudo).** Rode, com o código da empresa que a skill `fabrica` anunciou e o
   nome da linha:
   ```
   node _fabrica/core/empresa.js caminhos <codigo> --linha <nome> --json
   ```
   - Saída 0: o objeto traz `codigo`, `nome`, `perfil`, `marca`, `pastaMarca` e, da linha, `saidas`, `memoria`,
     `dadosLinha`, `estadoLinha` e `investigacoes`, todos absolutos. Daqui em diante estes são os **únicos** caminhos
     de empresa deste run (ver "Caminhos da empresa ativa").
   - Saída 1 (a empresa não existe mais nesta pasta ou o nome da linha não serve): **parar** e mostrar a mensagem do
     comando ao responsável. Nunca seguir adivinhando a empresa nem com os caminhos de uma empresa guardados de antes.
     Sem o código anunciado pela skill, não rode o comando sem ele: volte à Inicialização da skill `fabrica`.
   - Você já carregou, pela skill `fabrica`: `linha.yaml`, o perfil da empresa (caminho `perfil`), o contrato de marca
     (caminho `marca`) e a memória da linha (`<memoria>/memories.md`), com esse mesmo código.
1b. **Retomar um run.** Se `<estadoLinha>` existe com `status` `executando`, `aguardando-responsavel` ou `parada` e o
   responsável quer continuar esse run (em vez de começar outro), a empresa do run é **a gravada no campo `empresa` do
   estado**, não a empresa ativa. Estado antigo, sem o campo, é da empresa dona daquele arquivo de estado.
   - `empresa` do estado igual à anunciada pela skill: siga com os caminhos do item 1 e o mesmo `run_id`.
   - Diferente: **não continue ainda.** Avise em uma frase ("Este run foi começado para <nome da empresa do estado>, e a
     empresa em uso agora é <nome da anunciada>.") e pergunte com `AskUserQuestion`: **Continuar pela <empresa do
     run>** (rode de novo o item 1 com o código do estado e use só esses caminhos e esse código no prefixo dos
     scripts), **Começar um run novo pela <empresa anunciada>** (o run antigo fica `parada`) ou **Parar aqui**.
   - Nunca misture: um run retomado usa só os caminhos e o código da empresa dele.
2. **Validar a linha (falha rápida).** Rode:
   ```
   node _fabrica/core/validar-linha.js <nome>
   ```
   - Saída 0: seguir (avisos são informativos; mencione-os em uma linha se houver).
   - Saída 1: **parar** e mostrar os erros ao responsável. Não tente executar uma linha inválida.
3. **Formato da memória.** Se `<memoria>/memories.md` não existir ou não tiver a seção `## Estilo de Escrita`, crie-o com as
   seções vazias abaixo (sem tentar aproveitar conteúdo antigo) e crie `<memoria>/runs.md` se faltar. Faça isso em
   silêncio, com a ferramenta de arquivo (ela cria as pastas-pai).
   ```markdown
   # Memória da linha: {nome}

   ## Estilo de Escrita

   ## Design Visual

   ## Estrutura de Conteúdo

   ## Proibições Explícitas

   ## Técnico (específico da linha)
   ```
   ```markdown
   # Histórico de execuções: {nome}

   | Data | Run ID | Tema | Saída | Resultado |
   |------|--------|------|-------|-----------|
   ```
4. **Skills.** Se `linha.yaml` declarar `skills:`, rode:
   ```
   node _fabrica/core/skills.js resolver <nome>
   ```
   - Saída 0: seguir (avisos de variável ausente: repasse ao responsável em uma linha; não bloqueiam).
   - Saída 1: há skill não instalada, inválida ou com servidor MCP não configurado. Siga a operação 5 de
     `_fabrica/core/skills.engine.md` (oferecer instalar do catálogo ou parar). **A linha só começa com tudo resolvido.**
   - Skills nativas (`busca-web`, `leitura-web`) nunca exigem instalação.
5. **Anunciar a execução:**
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Executando a linha: {nome}
   Empresa: {nome da empresa}
   Passos: {número de passos}
   Estações: {lista}
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
6. **Pasta do run.** Gere o `run_id` no formato `AAAA-MM-DD-HHmmss`. Se `<saidas>/<run_id>/` já existir,
   acrescente `-2`, `-3`... Crie a pasta **gravando com a ferramenta de arquivo** um `run.md` com cabeçalho (data,
   empresa, linha, tema); ela cria as pastas-pai e evita conflito de separador de caminho. Guarde o `run_id` para TODOS
   os caminhos.
7. **Estado.** Grave `<estadoLinha>` (ver "Estado"), sempre com `empresa: <codigo>`, antes de cada passo e depois de
   cada entrega. É obrigatório e barato; serve para o responsável acompanhar e para retomar.

## Regras de execução

### Carregar uma estação

Antes de executar um passo com estação:

1. Ler o arquivo completo da estação. Se ela traz `**Papel do Núcleo:** <caminho>`, ler também esse arquivo por inteiro:
   ele é a fonte dos princípios, anti-padrões e checklists da estação (que não os repete). Em conflito, vale o do Núcleo.
   Com estação em subagente, o arquivo do papel segue no prompt, junto com a estação.
2. Ler também as seções **Princípios** e **Anti-padrões** de cada estação listada em `lentes` do passo (as lentes não
   viram agentes próprios: escrevem a sua seção no documento do passo).
3. Se o passo ou a linha declarar `formato`, ler `_fabrica/core/boas-praticas/<formato>.md`. Se o arquivo não existir,
   avisar em uma linha e seguir sem a injeção de formato. Incluir só o corpo (depois do frontmatter), antes das
   instruções do passo, **precedido desta nota, literal**:
   ```
   --- GUIA DE REFERÊNCIA: {name do frontmatter} ---
   Este guia é referência. Em conflito com uma regra do Núcleo, da restrição do setor, do contrato de marca ou das
   regras e dos dados desta linha, vale a regra, e o guia perde.
   ```
4. Para cada skill não nativa declarada na estação (ou na linha), injete as instruções dela conforme a operação 6 de
   `_fabrica/core/skills.engine.md` (corpo do `SKILL.md`, na ordem de declaração).
5. A composição do contexto, nesta ordem: **estação → guia de formato (referência) → instruções de skill → instruções do
   passo → dados citados no "Contexto a carregar" do passo.**

### Exceções declaradas no passo

Todo passo pode trazer uma seção **"Exceções ao runner"** (ou "Exceção ao runner"). **Ela vale e vence este arquivo para
aquele passo.** Exemplos já usados: passo de script sem estação; uma estação continuada entre dois passos; escolha de
modelo por camada de produção. Leia a seção antes de executar o passo.

### Transformação do caminho de saída

Antes de gravar qualquer arquivo de saída, aplique:

**Etapa 1 — traduzir e inserir o run_id.** Primeiro, a tradução da seção "Caminhos da empresa ativa". Se o caminho
começa por `saida/` (relativo à linha), troque `saida/` por `<saidas>/<run_id>/`.
Na pasta antiga, `saida/plano.md` → `linhas/calendario/saida/2026-10-15-143022/plano.md`. Em outra empresa, o mesmo `saida/plano.md` →
`<saidas>/2026-10-15-143022/plano.md`, com `<saidas>` como o comando devolveu. Caminho que não começa por `saida/` só
passa pela tradução de `memoria/` e dos `dados/` protegidos; os demais ficam como estão.

**Etapa 2 — inserir a pasta de versão.** Para todo caminho transformado na etapa 1:

1. O grupo é a pasta-pai do arquivo (depois da etapa 1).
2. Descobrir a maior versão existente nesse grupo:
   ```bash
   ls -1 "<grupo>" 2>/dev/null | grep -E '^v[0-9]+$' | sort -V | tail -1
   ```
   Se houver `v2`, use `v3` (sempre incrementa a maior, mesmo com lacunas). Se não houver nenhuma, use `v1`.
3. Inserir a pasta de versão antes do nome do arquivo: `.../<run_id>/plano.md` → `.../<run_id>/v1/plano.md`.
4. Dentro da execução de um passo, a versão de um grupo é determinada uma vez e reaproveitada.

**Checkpoint** aplica só a etapa 1 (a resposta da pessoa não é saída versionada).

### Conferência entre empresas

Com mais de uma empresa na pasta, nada de uma empresa pode aparecer no que outra recebe. Por isso o runner confere **antes
de cada entrega e antes de marcar qualquer passo como concluído**:

```
FABRICA_EMPRESA=<codigo> node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --empresa <codigo> <saidas>/<run_id>
```

(`<codigo>` é o da empresa do run; a pasta é a pasta do run.) Com uma empresa só, o comando sai 0 e diz que não há nada
a cruzar: rode do mesmo jeito.

**Pasta de trabalho fora da pasta do run.** Quando a linha trabalha também numa pasta fora de `<saidas>/<run_id>/` (na
linha de Reels, o projeto do vídeo em `08-FERRAMENTAS/tesseract/projetos/<NN>/`, com o número `NN` que está no
`material.md`), a mesma conferência roda **também sobre essa pasta**, trocando `<saidas>/<run_id>` por ela: antes de
concluir os passos que gravam nela (na linha de Reels, os passos 2, 4 e 6) e antes da entrega. As saídas e o tratamento
são os mesmos.

Saídas:

- **0, limpo:** o passo pode ser concluído e a entrega pode seguir.
- **1, achou termo de outra empresa:** **parar.** O comando lista arquivo, linha, o termo e de qual empresa ele é. **Não
  marque o passo como concluído e não entregue nada.** Mostre ao responsável, em linguagem simples e sem repetir a
  lista técnica, **uma frase por arquivo citado**: *"Encontrei o nome '<termo>', que é de outra empresa, em <arquivo>.
  Corrijo antes de seguir?"* (com vários arquivos, junte as frases na mesma mensagem). Pergunte por `AskUserQuestion`,
  com no máximo 4 opções; a resposta vale para todos os arquivos citados:
  - **Corrigir agora:** para **cada arquivo citado**, peça à estação para reescrever **só aquele trecho** sem o termo
    (reexecução dirigida) e grave a nova versão. Como a conferência olha a pasta do run inteira e as versões
    anteriores (`v1`, `v2`...) ficam nela, **remova o termo também de todas as versões de cada arquivo citado dentro da
    pasta do run**: são rascunhos do próprio run,
    e sem isso a conferência nunca ficaria limpa. Avise numa linha: *"Tirei também das versões anteriores deste run."*
    Rode a conferência de novo. No máximo 2 correções; persistindo, entregue a decisão ao responsável.
  - **É um nome das duas empresas (liberar):** só quando o termo veio de texto do próprio responsável (tema, resposta de
    um checkpoint), isto é, ele sabe que o nome é dele e de outra empresa também. Acrescente o termo, em uma linha nova, ao
    arquivo `termosCompartilhados` da empresa do run (caminho de `caminhos <codigo> --json`; leia o arquivo antes e
    nunca o sobrescreva) e rode a conferência de novo. Não ofereça esta opção quando o termo veio de uma estação ou de
    dado de outra empresa.
  - **Ver o trecho:** mostre as linhas citadas de cada arquivo e pergunte de novo, com as outras opções.
  - **Parar aqui:** grave `<estadoLinha>` com `status: aguardando-responsavel`, o passo ainda como corrente, e encerre.
    O run não é dado como concluído nem entregue.
- **2, erro de uso:** mostre a mensagem do comando e **pare**. Um erro não é "limpo".

**Quando rodar, em relação ao passo.** Passo comum (estação, checkpoint): a conferência vem **depois** de executar e
validar a saída (etapa 4b de "Para cada passo"). Passo de `tipo: script` que **entrega ou copia para fora da pasta do
run** (por exemplo o `entregar` do carrossel, `gerar.js --entregar`): a conferência da pasta do run roda **antes de
executar o script**. Se sair 1 ou 2, o script **não é executado**: nada sai da pasta do run antes de a conferência
estar limpa. O 4b continua valendo para os demais passos (e para o script depois de executar, sobre o que ele gravou
dentro da pasta do run).

O estado só passa a "passo concluído" depois de **dois** portões: a validação da saída (`VALIDACAO:OK`) e a conferência
limpa (saída 0). Nenhum arquivo é aberto para o responsável, copiado para outro lugar nem apresentado como entrega
enquanto a conferência da pasta do run não sair 0.

### Para cada passo

0. **Estado:** gravar `<estadoLinha>` com o passo corrente.

1. **Validação da entrada (obrigatória).** Se o passo declara `entrada`, aplique a etapa 1 ao caminho e rode:
   ```bash
   test -s "<caminho>" && echo "VALIDACAO:OK" || echo "VALIDACAO:FALHA"
   ```
   - `OK`: seguir.
   - `FALHA`: **não execute o passo.** Pergunte (`AskUserQuestion`): *pular o passo e continuar* ou *abortar a linha*.
     Não tente de novo: se a entrada não existe, o erro está num passo anterior.
   - Checkpoint e passo sem `entrada` não passam por esta validação.

2. **Ler o arquivo do passo** por inteiro.

2a. **Anunciar o passo à pessoa (regra L-01, `regras/13-explicar-o-processo.md`).** Antes de executar, diga em até
   cinco frases curtas, sem nome interno (nada de "passo 3", "estação", "checkpoint" ou nome de arquivo): o que vai
   acontecer agora, por que, com o quê (o vídeo, o texto e se usa a identidade visual da empresa), o que ela vai ver ou
   decidir e quanto demora, quando passar de um minuto. Ao concluir o passo, uma frase com o que ficou pronto e o que
   vem depois (L-05).

3. **Executar conforme o tipo:**

   **`tipo: estacao`, `execucao: subagente`**
   - Avisar: `{estação} está trabalhando em segundo plano...`
   - Modelo: `modelo: leve` no passo (ou a regra do passo) = o modelo mais leve disponível; `forte` ou ausente = o padrão.
   - Montar o prompt com: a estação completa; as seções de princípios e anti-padrões das lentes; o contexto citado no
     passo; as instruções do passo; os vetos (para o agente se autoconferir); o perfil da empresa (caminho `perfil`) e o
     contrato de marca (caminho `marca`), ou o `briefing` da linha quando o passo mandar usar o briefing no lugar; a
     memória da linha (`<memoria>/memories.md`); e o caminho **já transformado** onde gravar. Nunca passe caminho cru do
     passo.
   - Passar também **o código da empresa do run** e a regra: "todo comando de script começa com
     `FABRICA_EMPRESA=<codigo>`; para obter caminhos, rode `node _fabrica/core/empresa.js caminhos <codigo> --linha
     <nome> --json`, sempre com o código". O subagente não tem como descobrir esse código sozinho, e os passos de Reels
     que rodam scripts (4, 6 e 7) dependem dele.
   - Esperar a conclusão. Avisar: `{estação} concluiu`.
   - Se o passo mandar **continuar a mesma estação** em outro passo (ex.: passos 4 e 6 da linha de Reels), guarde o
     identificador do subagente e continue-o por mensagem em vez de abrir outro. Se ele não existir mais, abra um novo
     passando os arquivos de saída dos passos anteriores.

   **`tipo: estacao`, `execucao: inline`**
   - Assumir o papel da estação, anunciando quem fala. Seguir as instruções, apresentar o resultado e gravar na saída
     (caminho transformado, etapas 1 e 2).

   **`tipo: script`**
   - Execução inline do próprio runner, **sem estação**. O trabalho do passo é rodar o comando descrito nele, responder
     às perguntas do script (sempre ao responsável, nunca por conta própria) e apresentar o relatório. As validações de
     entrada e saída valem normalmente.
   - **Script que entrega ou copia para fora da pasta do run** (ex.: `gerar.js --entregar`): antes de rodar o comando,
     rode a conferência entre empresas sobre a pasta do run. Saída diferente de 0: **não execute o script**; siga a seção
     "Conferência entre empresas".
   - O comando do script sempre roda com o prefixo `FABRICA_EMPRESA=<codigo>` (ver "Caminhos da empresa ativa").

   **`tipo: checkpoint`**
   - Apresentar o que o passo manda, **sempre com o caminho de qualquer arquivo que a pessoa precise ver**.
   - Fazer as perguntas por `AskUserQuestion` (nunca em texto solto), como a skill `fabrica` exige. Cada pergunta diz
     por que está sendo feita e o que muda com a resposta; as opções dizem o que é igual entre elas e o que muda (L-02).
   - Esperar. Salvar a resposta em `saida` (etapa 1 do caminho), no formato que o passo define.

4. **Validação da saída (obrigatória).** Para cada arquivo que o passo declara em `saida`, rode (com o caminho
   transformado guardado, nunca o cru):
   ```bash
   test -s "<caminho>" && echo "VALIDACAO:OK" || echo "VALIDACAO:FALHA"
   ```
   - Todos `OK`: seguir para os vetos.
   - Algum `FALHA`: refazer o passo **uma vez**, com a mesma entrada. Falhou de novo: perguntar ao responsável
     (*tentar de novo*, *pular o passo*, *abortar*).
   - Checkpoint não passa por esta validação. **Use só o `test -s`:** ler o arquivo para "verificar" é interpretar, e
     interpretação pode se enganar.

4b. **Conferência entre empresas (obrigatória, também no checkpoint).** Rode o comando da seção "Conferência entre
   empresas" sobre a pasta do run. Saída 0: seguir. Saída 1 ou 2: **parar** como descrito lá; o passo não é
   concluído e nada é entregue. Depois de uma correção, a validação da saída (passo 4) e a conferência rodam de novo.

5. **Vetos.** Se o passo tem uma seção **"Vetos"** (ou "Veto Conditions"):
   - Avalie cada condição contra a saída que acabou de ser produzida.
   - Qualquer condição disparada: informe qual, peça à estação para corrigir **aquele ponto** (reexecução dirigida).
   - **No máximo 2 correções** por passo; depois, entregue ao responsável a decisão.
   - Toda saída refeita por uma correção passa de novo pela validação da saída e pela conferência entre empresas.

6. **Reprovação.** Se o passo tem `ao_reprovar: N` e a saída é uma reprovação (a revisão devolveu REPROVAR):
   - Conte o ciclo; volte ao passo N levando o parecer da revisão.
   - Limite de 3 ciclos; passado isso, entregue ao responsável.

7. **Retorno por decisão do responsável.** Checkpoint cuja resposta manda voltar a um passo anterior ("ajustar", "trocar"):
   re-execute **a partir desse passo, em ordem**, passando de novo por todo checkpoint do caminho (cada aprovação
   intermediária precisa do sim outra vez). As saídas refeitas ganham a pasta de versão seguinte (`v2`, `v3`...) e valem
   as mais recentes; mostre ao responsável só o que mudou. O retorno leva só o que foi pedido: o resto fica como estava.

8. **Estado:** gravar `<estadoLinha>` com o passo concluído e seguir. Só aqui o passo conta como concluído, e só se a
   validação da saída e a conferência entre empresas passaram.

### Ordem completa de um passo

```
0. estado (<estadoLinha>)
1. validação da entrada
2. ler o passo
2a. anunciar à pessoa o que vai acontecer (L-01), sem nome interno
2b. (só em script que entrega ou copia para fora da pasta do run) conferência entre empresas ANTES de executar
3. executar (estacao subagente | estacao inline | script | checkpoint)
4. validação da saída
4b. conferência entre empresas (todos os passos, depois de executar)
5. vetos
6. (se for revisão) ao_reprovar
7. estado (passo concluído)
```

As etapas 1, 2b, 4 e 4b são portões binários: se falham, a linha **não avança** sem o responsável.

## Estado

`<estadoLinha>` (na pasta antiga, `linhas/<nome>/estado.json`), gravado com a ferramenta de arquivo:

```json
{
  "linha": "<código>",
  "empresa": "<codigo da empresa do run>",
  "run_id": "<run_id>",
  "status": "executando",
  "passo": { "atual": 3, "total": 8, "rotulo": "plano" },
  "estacoes": [ { "id": "gancho", "status": "trabalhando" } ],
  "iniciadoEm": "<ISO>",
  "atualizadoEm": "<ISO>"
}
```

`empresa` é o código da empresa do run, gravado desde o primeiro estado; ao retomar, é ele que vale (Inicialização,
item 1b). `status` da linha: `parada` (deixado de lado, por exemplo numa troca de empresa; pode ser retomado),
`executando`, `aguardando-responsavel`, `concluida`, `falhou`, `abortada`.
`status` de estação: `ociosa`, `trabalhando`, `entregou`.

## Ao terminar a linha

1. **Atualizar a memória da linha** e conferi-la (**antes** de dar o run por concluído):

   **1a. `<memoria>/memories.md` (preferências vivas).** Leia o arquivo inteiro. Candidatos desta execução: **somente
   feedback explícito do responsável** (aprovação com comentário, rejeição com motivo, pedido direto: "prefiro X",
   "não quero Y"). Nunca infira preferência.
   - Já existe equivalente compatível: não duplique.
   - Existe equivalente que contradiz: substitua pelo mais novo.
   - Não existe: acrescente na seção certa (estilo de escrita, design visual, estrutura de conteúdo, proibições
     explícitas ou técnico da linha).
   - **Nunca grave** inferência do runner, notas, caminhos de arquivo nem temas de execuções passadas.
   - Se não houve feedback explícito, **não reescreva** o arquivo.

   **1b. `<memoria>/runs.md`.** Acrescente **uma linha logo abaixo do cabeçalho da tabela** (mais novo primeiro): data,
   run_id, tema (uma frase), saída (descrição curta), resultado (`Aprovado`, `Rejeitado`, `Publicado` ou `Abortado`).
   Nada mais.

   **1c. Conferência final da memória e dos dados da empresa.** A pasta do run já passou pela conferência no último
   passo. Confira agora o que acabou de ser gravado na memória e, depois, todas as pastas de dados da empresa (sem pasta
   no comando, o validador confere todas: saídas, memória, `dadosLinha`, estado, `estiloDeVideo`, perfil, decisões e as
   demais), **antes** de gravar `status: concluida` e de copiar ou remover o estado:
   ```
   FABRICA_EMPRESA=<codigo> node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --empresa <codigo> <memoria>
   FABRICA_EMPRESA=<codigo> node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --empresa <codigo>
   ```
   As duas saem 0: siga para o item 2. Alguma sai 1 ou 2: **não grave `concluida`, não copie nem remova o estado e não
   apresente o fechamento.** Grave `<estadoLinha>` com `status: aguardando-responsavel` (o run fica assim, nunca
   concluído) e siga o tratamento da seção "Conferência entre empresas" (a correção é tirar o trecho da linha citada do
   arquivo citado; só com as duas conferências limpas o run segue para o item 2). Achado num arquivo que este run não
   gravou (de uma execução antiga, por exemplo): não o corrija por conta própria; mostre e ofereça só **Ver o trecho** e
   **Parar aqui**, e a pessoa decide o que fazer com ele. Aqui, **Parar aqui** é só gravar
   `status: aguardando-responsavel` e encerrar: todos os passos já foram concluídos, não há passo a manter.

2. Gravar `<estadoLinha>` com `status: concluida` e `concluidaEm`.
3. Copiar para o histórico do run e remover a cópia de trabalho (com os caminhos resolvidos no início do run):
   ```bash
   cp "<estadoLinha>" "<saidas>/<run_id>/estado.json"
   rm "<estadoLinha>"
   ```
4. Apresentar o fechamento:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Linha concluída
   Pasta do run: <saidas>/<run_id>/
   Saída: <caminho principal>

   O que você quer fazer?
   ● Rodar de novo (novo tema)
   ○ Editar este conteúdo
   ○ Voltar ao menu
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ```
   (Apresente por `AskUserQuestion`.)

## Tratamento de erro

- Subagente que falha: tente de novo uma vez; falhando de novo, informe o responsável e ofereça pular o passo ou abortar.
- Script que termina com código de saída diferente de 0, 3 ou 4 (ver o passo): é erro; mostre a saída e pergunte.
- Se o responsável abortar, grave `<estadoLinha>` com `status: abortada`, registre `Abortado` em `<memoria>/runs.md` e encerre.
- Conferência entre empresas que sai 1 ou 2: não é erro a contornar. Siga a seção "Conferência entre empresas": parar,
  mostrar em linguagem simples, não concluir o passo e não entregar.
- **Nunca** declare um passo concluído sem ter passado pelos portões (`VALIDACAO:OK` e a conferência entre empresas
  limpa).
