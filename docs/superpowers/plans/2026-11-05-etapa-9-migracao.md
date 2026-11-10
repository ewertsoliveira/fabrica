# Etapa 9: mudança opcional da pasta antiga para a pasta própria da empresa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** quem já usa a Fábrica no formato antigo (uma empresa só, com os dados espalhados pelas pastas da raiz) pode,
**se quiser e só quando pedir**, passar tudo da empresa para a pasta própria dela (`empresas/principal/`), sem perder nada.
Antes de qualquer cópia, a Fábrica mostra uma simulação do que vai mudar. Depois, entrega um relatório e um jeito de
desfazer. Quem nunca pedir continua exatamente como hoje.

**Arquitetura:**
- Um módulo novo, `_fabrica/core/migrar.js`, com quatro fases separadas, cada uma com o seu comando:
  1. **`simular`:** só lê. Monta o inventário (de onde vem cada arquivo, para onde vai, o que fica onde está, o que é do
     modelo e nunca é tocado) e as recusas. Não grava nada, nem pasta vazia.
  2. **`aplicar`:** copia cada arquivo para a pasta da empresa, confere cada cópia por `sha256` e traduz as referências
     de caminho dos três arquivos dos painéis (só nas cópias). Por último, vira a empresa `principal` de `legado` para
     `gaveta` no `empresas/indice.json`, com gravação atômica. **Os arquivos antigos continuam onde estão, intactos:**
     eles são a cópia de segurança até a fase 3.
  3. **`retirar`** (opcional, outro dia, outro pedido): leva os arquivos antigos para a pasta de cópia de segurança
     (`_fabrica/_backup/migracao-<carimbo>/antigos/`), conferindo cada um. **Nada é apagado.**
  4. **`desfazer`:** volta ao formato antigo em qualquer momento, antes ou depois da retirada.
- **O mapa "de onde → para onde" não é escrito à mão.** Ele sai do próprio leitor de empresas: `empresa.js` passa a
  exportar `caminhosDe(codigo, disposicao, r)`, e a mudança pareia, chave por chave, os caminhos da disposição `legado`
  com os da `gaveta`. Um teste de guarda reprova se o leitor ganhar uma chave nova que a mudança não classifica. Isso
  protege contra as etapas 7 e 8.
- **O que é do modelo nunca é copiado nem retirado.** A classificação vem do `_fabrica/propriedade.json`, com a mesma
  regra da atualização e do runner: é do modelo o que está em `modelo` e fora de `protegidos`. Exemplos: o exemplo de
  marca e o `dados/briefing.md` da linha de Reels.
- **O `marca.yaml` é copiado byte a byte, sem nenhuma edição.** Na pasta antiga, ele aponta as letras e o logo com
  caminhos que começam por `06-MARCA-E-FOTOS/`. Por isso, o leitor de marca (`marca.js`) e o servidor dos painéis
  ganham uma regra a mais, só para empresa com pasta própria: um caminho `06-MARCA-E-FOTOS/<resto>` (que não seja o
  exemplo) que não exista em `<pasta da empresa>/06-MARCA-E-FOTOS/<resto>` passa a ser procurado em
  `<pasta da empresa>/<resto>`. A regra continua sem nunca devolver arquivo de fora da pasta da empresa.

**Tecnologia:** Node (só módulos nativos: `fs`, `path`, `crypto`, `child_process`), com testes em scripts `node` usando
`assert` e a saída `ok <caso>`, no padrão do `empresa.test.js` e do `isolamento.test.js`. Cada caso é calibrado para
reprovar (G-13).

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 4 (anti-objetivos),
6.1 a 6.3 (gavetas, regra do que é da empresa e disposição legado), 6.5 (conferência entre empresas) e 12 (etapa 9:
"Migração opcional para quem tem disposição legado: comando, backup e conferência"). Etapas anteriores:
`docs/superpowers/plans/2026-10-30-etapa-1-gavetas-por-empresa.md` (leitor e legado) e
`docs/superpowers/plans/2026-11-02-etapa-3-paineis-por-empresa.md` (dados dos painéis por empresa).

**Diferença em relação ao desenho (minha escolha):** o desenho cita `empresas.js migrar <codigo>`. O leitor se chama
`empresa.js`, e a mudança fica num módulo próprio (`migrar.js`), para o leitor continuar pequeno. O `empresa.js` ganha
só um atalho, `empresa.js migrar ...`, que repassa os argumentos ao `migrar.js`. A ordem do desenho ("faz backup, confere
arquivo por arquivo e só depois retira os antigos") vira duas fases separadas: `aplicar` (copia e confere, sem tocar nos
antigos) e `retirar` (só depois, em outro pedido).

## Dependências: pode ser executada já

- **Depende só das etapas 1, 2, 3 e 5, todas concluídas:** o leitor de empresas com legado (1), as instruções lendo pelo
  leitor (2), os painéis por empresa (3) e os pedidos em `empresas/<c>/pedidos/` (5).
- **Não depende das etapas 6, 7 e 8:**
  - **Etapa 6** (vídeo na marca, com 6.1 e 6.2 já no ramo): os modelos leem a marca por `marca.js`
    (`tema-marca.js` usa `marca.caminho`). A Tarefa 2 resolve as letras da pasta antiga dentro da pasta nova, e a
    Tarefa 7 prova isso com o `tema-marca.js`. Os itens 6.3 a 6.5 não mexem em `marca.js` nem em `empresa.js`.
  - **Etapa 7** (prévias na marca): grava em `empresas/<c>/previas/`, caminho comum às duas disposições. Não há nada a
    mudar de lugar.
  - **Etapa 8** (caminho do usuário): grava `estilo.json`, `intencao.json`, `pedidos/` e `historico/`, todos comuns às
    duas disposições. O `marca.yaml` gravado por "Usar um dos nossos" fica no caminho `marca` da empresa, e a mudança o
    copia como qualquer outro.
- **Cuidados de ordem, não de dependência:**
  - **Chave nova no leitor.** Se a 7 ou a 8 acrescentar uma chave em `caminhos()` com lugar diferente no legado, o teste
    de guarda da Tarefa 1 reprova até a mudança classificar a chave.
  - **`servidor.js`.** A Tarefa 2 mexe nele (`urlDeFonte`), e a etapa 7 provavelmente também vai mexer. Fazer uma de cada
    vez no ramo, nunca em paralelo.

## Restrições globais

- **Nada é feito sem pedido.** A mudança só roda quando a pessoa pede. Nenhum outro comando, skill, atualização ou painel
  a dispara, e a simulação não grava nada.
- **Nunca apagar nem sobrescrever** o que é da empresa: `marca.yaml`, `empresa.md`, `decisoes.md`, linhas próprias,
  saídas, memória, estado dos runs, investigações, referências, estilos próprios, dados dos painéis e peças aprovadas.
  - O `aplicar` só cria arquivos novos (com cópia exclusiva, que recusa se o destino existe) e só altera um arquivo de
    controle, o `empresas/indice.json`, com gravação atômica.
  - O `retirar` só **move** os antigos para a cópia de segurança.
  - O `desfazer` só move de volta.
  - Os testes conferem tudo isso byte a byte.
- **Cópia byte a byte:** sem normalizar fim de linha (CRLF continua CRLF), sem tirar BOM e sem reformatar. A data de
  modificação é preservada. A única exceção são os três arquivos dos painéis com referências traduzidas, só na cópia.
- **Fora de alcance, sempre:** as pastas de outras empresas (`empresas/<outra>/`), os arquivos do modelo, as receitas das
  linhas (`LEIA-ME.md`, `linha.yaml`, `passos/`, `estacoes/` e os `dados/` do modelo), `_fabrica/_memoria/preferencias.md`
  (preferências de quem usa, de todas as empresas) e os arquivos comuns que já estão em `empresas/principal/`
  (`estilo.json`, `intencao.json`, `pedidos/`, `historico/`, `decisoes.md`, `previas/`, `envios/`, `termos*.txt`).
- **Texto ao usuário final** em português simples, sem as palavras "gaveta", "disposição", "índice", "legado",
  "manifesto", "migração", "sha" ou nome de arquivo. O detalhe técnico só aparece com `--json`, que é para o agente.
- **Toda escolha de design ou de tela vai como opções renderizadas lado a lado** (regra D-01), nunca por texto. Lista na
  Tarefa 8.
- **Testes só com empresas fictícias:** a pasta antiga de teste é da "Aurora Nutrição" (código `principal`), e a segunda
  empresa é a `boreal` ("Boreal Advocacia"). Tudo em pasta temporária com `FABRICA_RAIZ`, nunca na pasta real.
- **A pasta real do responsável nunca é usada nos testes.** O `aplicar` nunca roda nela durante a construção. Se ele
  quiser ver a simulação da própria pasta, só com o pedido dele, e a simulação não grava nada.
- **Git:** sem `git push`, `pull`, `merge`, `reset`, `stash` ou `--forcar`. Commit local por tarefa, no ramo `biblioteca`.
- **Antes de cada commit:** rodar `node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos "<lista privada>"`
  e `node _fabrica/core/conferir-caminhos.js`. Os dois precisam sair `0`.
  - Os testes têm cor em hexadecimal na marca fictícia. Registrar isenção com motivo em `isentos.json`, só das
    categorias acusadas.
  - Texto de skill ou do `CORE.md` que precise citar um caminho antigo escreve "pasta antiga" na mesma linha, porque o
    `conferir-caminhos` aceita essa linha. Na subseção "Empresas" do `CORE.md`, a conferência não se aplica.
- **Idioma:** mensagens, comentários e nomes de função em português do Brasil.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit e nunca trocar texto de várias linhas por script.
- **Nunca citar** o nome do responsável nem o da empresa de referência. Sem cor de empresa real, sem fonte comercial e
  sem dia da semana. Nunca ler `.env`.
- **Nenhuma dependência nova.**

## Foco da revisão

1. **Interrupção no meio do `aplicar`** (energia, Ctrl+C, arquivo de vídeo aberto em outro programa): a Fábrica continua
   usando os lugares de sempre (o índice só vira no último passo). O `estado` diz "mudança interrompida", e o `desfazer`
   limpa as cópias pela metade. Teste na Tarefa 4 (falha injetada) e na Tarefa 5 (processo morto no meio).
2. **Arquivo antigo mudado depois da simulação ou durante a cópia** (painel aberto gravando o `laboratorio.json`, run de
   outra conversa gravando na saída): o `aplicar` confere de novo as origens antes de virar o índice e volta atrás se
   algo mudou. O `retirar` recusa tudo se algum antigo divergir da cópia. Testes nas Tarefas 4 e 6.
3. **Letra e logo da marca antiga depois da mudança:** o `marca.yaml` copiado sem edição continua achando os arquivos
   dentro da pasta nova, e nunca os da pasta antiga nem os de outra empresa. Testes nas Tarefas 2 e 7.
4. **Peça e post dos painéis apontando para lugar antigo:** depois da mudança, o Laboratório abre as mesmas peças e o
   Cronograma mostra os mesmos posts, com as imagens. Teste na Tarefa 7.
5. **Desfazer depois de produzir na pasta nova:** o que foi criado depois da mudança nunca é perdido. O `desfazer` recusa
   e lista, ou leva de volta com `--levar-novos`. Uma segunda empresa criada depois da mudança continua no índice. Teste
   na Tarefa 5.
6. **Nada se perde em nenhuma combinação** (`aplicar` → `retirar` → `desfazer`): todo `sha256` da pasta original existe
   no fim, no mesmo caminho de antes. Teste de conservação na Tarefa 7.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `_fabrica/core/empresa.js` | exporta `caminhosDe(codigo, disposicao, r)`; atalho `migrar` na linha de comando; `USO` |
| `_fabrica/core/empresa.test.js` | casos de `caminhosDe`, do campo extra `migrada` e do atalho |
| `_fabrica/core/migrar.js` (novo) | inventário, simulação, aplicar, retirar, desfazer, estado e linha de comando |
| `_fabrica/core/migrar.test.js` (novo) | testes das fases, com pasta antiga fictícia |
| `_fabrica/core/migracao.test.js` (novo) | prova de ponta a ponta com as ferramentas, por processo filho |
| `08-FERRAMENTAS/marca/marca.js` | `caminho(rel)`: `06-MARCA-E-FOTOS/<resto>` também em `<pasta da empresa>/<resto>` |
| `08-FERRAMENTAS/marca/marca.test.js` | casos novos da regra |
| `_fabrica/paineis/servidor.js` | `urlDeFonte`: a mesma regra para as letras do painel |
| `_fabrica/paineis/testes/servidor.test.js` | caso novo da regra |
| `.claude/skills/fabrica/SKILL.md` | comando de organizar a pasta e de desfazer (nome decidido na Tarefa 8) |
| `.claude/skills/atualizar/SKILL.md` | uma frase: a cópia de segurança da mudança também nunca é tocada |
| `CORE.md` | subseção "Empresas": a mudança opcional, as fases e o desfazer |
| `.gitignore` | `empresas/.migracao.lock` |
| `08-FERRAMENTAS/validador-anti-vazamento/isentos.json` | isenções dos testes novos, se o validador acusar |

---

## O inventário: o que vai, o que fica e o que nunca é tocado

Esta tabela é a referência das Tarefas 1, 3 e 4. `G` é `empresas/principal`. Em cada pasta, valem só os arquivos que
são da empresa pela regra do `propriedade.json`.

| Grupo (rótulo ao usuário) | De (pasta antiga) | Para (pasta da empresa) |
|---|---|---|
| Sua marca: o contrato | `06-MARCA-E-FOTOS/marca.yaml` | `G/marca.yaml` (byte a byte) |
| Sua marca: letras, logo, fotos e peças | o resto de `06-MARCA-E-FOTOS/`, menos o que é do modelo e as três linhas abaixo | `G/<mesmo resto>` (por exemplo, `fontes/`, `fotos/` e `pecas/`) |
| Estilo de vídeo | `06-MARCA-E-FOTOS/estilo-de-video.md` | `G/estilo-de-video.md` |
| Estilos próprios | `06-MARCA-E-FOTOS/estilos-proprios/` | `G/estilos-proprios/` |
| Perfil da empresa | `_fabrica/_memoria/empresa.md` | `G/empresa.md` |
| Referências | `04-LABORATORIO-DE-DESIGN/referencias/` | `G/referencias/` |
| Laboratório | `04-LABORATORIO-DE-DESIGN/dados/` e `04-LABORATORIO-DE-DESIGN/COMO-ACESSAR.md` | `G/laboratorio/dados/` e `G/laboratorio/COMO-ACESSAR.md` |
| Cronograma | `03-CRONOGRAMA/` inteira | `G/cronograma/` |
| Peças aprovadas | `02-PUBLICACOES/` | `G/publicacoes/` |
| Linha `<l>`: saídas | `linhas/<l>/saida/` | `G/saidas/<l>/` |
| Linha `<l>`: memória | `linhas/<l>/memoria/` | `G/memoria/<l>/` |
| Linha `<l>`: dados da empresa | só os arquivos de `linhas/<l>/dados/` que estão em `protegidos` | `G/linhas/<l>/dados/` |
| Linha `<l>`: andamento | `linhas/<l>/estado.json` | `G/estado/<l>.json` |
| Linha `<l>`: investigações | `linhas/<l>/_investigacoes/` | `G/investigacoes/<l>/` |

- **Ficam onde estão, ditos no relatório como "continua no mesmo lugar":**
  - qualquer outro arquivo dentro das pastas da tabela que não tenha lugar definido (por exemplo, um arquivo solto em
    `04-LABORATORIO-DE-DESIGN/` fora do modelo, ou outro arquivo em `_fabrica/_memoria/`);
  - atalho (junção ou link) em qualquer nível, que nunca é seguido.
- **Nunca tocados e nem listados um a um** (o relatório só dá a contagem "do modelo"):
  - o que é do modelo;
  - as receitas das linhas;
  - `_fabrica/_memoria/preferencias.md`;
  - os atalhos de abrir os painéis na raiz;
  - `_fabrica/_estado-modelo.json`, `_fabrica/_backup/` e `_fabrica/_atualizacao/`;
  - as outras empresas.
- **Já no lugar** (comuns às duas disposições, nada a fazer): `estilo.json`, `intencao.json`, `pedidos/`, `historico/`,
  `decisoes.md`, `termos.txt`, `termos-compartilhados.txt`, `previas/` e `envios/`.
- **Referências traduzidas, só nas cópias:**
  - **Campos traduzidos:**
    - `laboratorio.json`: `[].path`, `[].pasta` e `[].video`;
    - `aprovacoes.json`: `{}.pasta`;
    - `posts.json`: `[].images[]` e `[].previewUrl`, quando relativo.
  - **Regra da tradução:** prefixo exato, com barra normal ou invertida:
    - `02-PUBLICACOES/` → `empresas/principal/publicacoes/`;
    - `linhas/<l>/saida/` → `empresas/principal/saidas/<l>/`;
    - `04-LABORATORIO-DE-DESIGN/referencias/` → `empresas/principal/referencias/`;
    - `06-MARCA-E-FOTOS/<resto>` (fora do exemplo) → `empresas/principal/<resto>`.
  - **Fora desses campos:** qualquer outro texto desses três arquivos com um prefixo antigo vira aviso ("referência
    antiga não traduzida") e não muda.
  - **Arquivos de texto** (`.md`, roteiros, legendas) não são editados. O relatório só conta quantos citam lugares
    antigos.

---

### Tarefa 1: o leitor entrega os caminhos das duas disposições

**Arquivos:**
- Alterar: `_fabrica/core/empresa.js`.
- Teste: `_fabrica/core/empresa.test.js`, com casos novos.

**Interfaces:**

Produz:
- `caminhosDe(codigo, disposicao, r?) -> objeto`: o mesmo objeto de `caminhos()`, calculado para a disposição pedida
  (`'legado'` ou `'gaveta'`), sem olhar o índice. `caminhos(codigo, r)` passa a ser `caminhosDe(codigo,
  entrada.disposicao, r)`, sem mudar o comportamento. `disposicao` inválida lança `DISPOSICAO_INVALIDA`.
- `CHAVES_DE_CAMINHO`: a lista exportada das chaves de `caminhos()` (as de valor e as de função por linha), para o teste
  de guarda do `migrar.js`.
- **Índice com campo a mais:** uma entrada pode ter `migrada: { em: 'AAAA-MM-DD', carimbo: '<carimbo>' }`. O `lerIndice`
  aceita o campo, o `listar` devolve, e o `criar` preserva ao regravar o índice.
- **Atalho na linha de comando:** `node _fabrica/core/empresa.js migrar <args...>` repassa os argumentos ao
  `migrar.js` (com `require` e `principal(args)`). A saída é a do `migrar.js`. O atalho entra no `USO`.

- [ ] **Passo 1: escrever os casos que falham no `empresa.test.js`.**

  | Caso | O que confere |
  |---|---|
  | `caminhosDe legado e gaveta` | pasta com legado virtual → `caminhosDe('principal', 'legado', r).marca === path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml')`; `caminhosDe('principal', 'gaveta', r).marca === path.join(r, 'empresas', 'principal', 'marca.yaml')`; `.saidas('reels')` dos dois casos é `linhas/reels/saida` e `empresas/principal/saidas/reels` |
  | `caminhos não muda` | para `principal` legado e para `aurora` gaveta, `caminhos(c, r)` é igual (`deepStrictEqual` nos valores e nas funções aplicadas a `'reels'`) a `caminhosDe(c, <disposição do índice>, r)` |
  | `disposição inválida` | `caminhosDe('principal', 'outra', r)` lança `DISPOSICAO_INVALIDA` |
  | `chaves exportadas` | `CHAVES_DE_CAMINHO` tem exatamente as chaves de `caminhos('principal', r)` |
  | `campo migrada preservado` | índice com `principal` (gaveta, `migrada: {...}`) → `listar(r)[0].migrada` existe; depois de `criar('boreal', ...)`, o índice regravado ainda tem o `migrada` igual |
  | `atalho migrar` | `empresa.js migrar` sem argumentos sai `2` e mostra o uso do `migrar.js` (o caso passa a valer de verdade na Tarefa 3; até lá, falha com `Cannot find module`) |

- [ ] **Passo 2: rodar e ver falhar.** Comando: `node _fabrica/core/empresa.test.js`.
- [ ] **Passo 3: implementar** `caminhosDe` (o corpo atual de `caminhos` depois de achar a entrada), `CHAVES_DE_CAMINHO`,
  a tolerância ao `migrada` e o atalho. O atalho faz `require('./migrar')` só quando é chamado.
- [ ] **Passo 4: rodar e ver passar.** `node _fabrica/core/empresa.test.js` (menos o `atalho migrar`, marcado para a
  Tarefa 3), `node _fabrica/core/isolamento.test.js` e `node 08-FERRAMENTAS/marca/marca.test.js` sem mudança.
- [ ] **Passo 5: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.1: o leitor entrega os
  caminhos das duas disposições".

---

### Tarefa 2: a marca da pasta antiga funciona dentro da pasta da empresa

**Arquivos:**
- Alterar: `08-FERRAMENTAS/marca/marca.js` (`caminho`) e `_fabrica/paineis/servidor.js` (`urlDeFonte`).
- Teste: `08-FERRAMENTAS/marca/marca.test.js` e `_fabrica/paineis/testes/servidor.test.js`.

**Regra** (as duas peças seguem a mesma; minha escolha, ver a decisão T-1):
- **Só vale com marca de pasta própria** (`GAVETA` no `marca.js`, `ehGaveta` no servidor), e só para caminho relativo
  `06-MARCA-E-FOTOS/<resto>` fora de `06-MARCA-E-FOTOS/exemplo/`, depois de normalizado.
- **Ordem de procura:**
  1. `<pasta da empresa>/06-MARCA-E-FOTOS/<resto>`, como hoje;
  2. se não existir, `<pasta da empresa>/<resto>`;
  3. se nenhum existir, devolve o primeiro, como hoje (o erro de arquivo ausente continua o mesmo).
- **Nunca devolve arquivo fora da pasta da empresa.** `<resto>` com `..` continua recusado com `CAMINHO_FORA_DA_EMPRESA`
  no `marca.js`, e sem endereço no servidor.
- **Na pasta antiga (sem pasta própria), nada muda.**

- [ ] **Passo 1: escrever os casos que falham.**

  | Caso | O que confere |
  |---|---|
  | `marca.test: letra da pasta antiga dentro da pasta nova` | `aurora` com pasta própria, `marca.yaml` com `tipografia.principal.arquivo: 06-MARCA-E-FOTOS/fontes/Principal.ttf` e o arquivo em `empresas/aurora/fontes/Principal.ttf` → `m.caminho(...)` termina em `empresas/aurora/fontes/Principal.ttf` |
  | `marca.test: espelho continua vencendo` | o arquivo existe nos dois lugares → vale `empresas/aurora/06-MARCA-E-FOTOS/fontes/Principal.ttf` |
  | `marca.test: nunca a pasta antiga` | o arquivo só existe na raiz, em `06-MARCA-E-FOTOS/fontes/Principal.ttf` (de outra empresa) → `m.caminho(...)` não aponta para a raiz e devolve o caminho da pasta da empresa |
  | `marca.test: sobe pasta recusa` | `06-MARCA-E-FOTOS/../../boreal/marca.yaml` → `CAMINHO_FORA_DA_EMPRESA` |
  | `marca.test: pasta antiga igual` | legado, com o arquivo em `06-MARCA-E-FOTOS/fontes/Principal.ttf` → o caminho da raiz, como hoje |
  | `servidor.test: letra no painel` | `/api/empresa?empresa=aurora` (a rota que devolve as cores e as letras, via `dadosEmpresa`) traz o endereço servido de `empresas/aurora/fontes/Principal.ttf`, e esse endereço responde `200` |

- [ ] **Passo 2: rodar e ver falhar.** `node 08-FERRAMENTAS/marca/marca.test.js` e
  `node _fabrica/paineis/testes/servidor.test.js`.
- [ ] **Passo 3: implementar** nos dois lugares, com Edit. Comentário curto em cada um, dizendo que a regra existe para a
  marca vinda da pasta antiga.
- [ ] **Passo 4: rodar e ver passar.** Os dois testes, mais `node 08-FERRAMENTAS/carrossel/molde.test.js`,
  `node 08-FERRAMENTAS/tesseract/modelos/tema-marca.test.js` e `node _fabrica/core/isolamento.test.js`, todos sem mudança.
- [ ] **Passo 5: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.2: letras e logo da
  pasta antiga achadas dentro da pasta da empresa".

---

### Tarefa 3: inventário e simulação (só leitura)

**Arquivos:**
- Criar: `_fabrica/core/migrar.js` e `_fabrica/core/migrar.test.js`.

**Interfaces:**

Produz:
- `inventario(r?) -> Inventario`, sem gravar nada:
  ```
  {
    empresa: 'principal', nome, situacao: 'pasta-antiga' | 'ja-organizada' | 'nada-a-mudar' | 'interrompida',
    codigoSimulacao,              // 12 primeiros hex do sha256 da lista ordenada de itens (de, para, sha256, bytes)
    itens: [{ grupo, de, para, bytes, sha256, traduzir?: 'laboratorio' | 'aprovacoes' | 'posts' }],
    jaNoLugar: [rel...],          // destino já existe com o mesmo sha256 (nada a copiar)
    ficam: [{ caminho, motivo: 'sem-lugar' | 'atalho' }],
    doModelo: <número>,
    referencias: [{ arquivo, campo, de, para }],
    avisos: [{ tipo, mensagem, arquivos? }],   // 'texto-cita-lugar-antigo', 'referencia-nao-traduzida', 'run-parado'
    recusas: [{ code, mensagem, arquivos? }],
    bytes, espacoLivre
  }
  ```
  Todos os caminhos são relativos à raiz, com `/`.
- `simular(r?) -> Inventario`: o mesmo, com as recusas já calculadas.
- `GRUPOS`: os rótulos ao usuário (tabela do inventário).
- **Linha de comando:** `node _fabrica/core/migrar.js simular [principal] [--json]`.
  - Sem `--json`, imprime um resumo em português simples: uma linha por grupo (rótulo, número de arquivos e tamanho),
    o que continua no mesmo lugar, os avisos, as recusas e o código da simulação.
  - Saída `0` quando dá para fazer (ou não há nada a fazer, com a frase "Nada a mudar"), `1` com recusa e `2` para erro
    de uso.

**Regras:**
- **Só a `principal` pode mudar.** Outro código recusa com `CODIGO_NAO_E_PASTA_ANTIGA`. Pasta sem empresa, ou com a
  `principal` já em `gaveta`, dá a situação `nada-a-mudar` ou `ja-organizada`.
- **Origem de cada grupo:** os pares de `caminhosDe('principal', 'legado')` e `caminhosDe('principal', 'gaveta')`, chave
  por chave. As linhas são as pastas de `linhas/`. A classificação do que é do modelo vem do `propriedade.json` da raiz do
  **código**, com as funções `dentro` e `comecaCom` do mesmo jeito do `atualizar.js`.
- **Varredura:**
  - não segue atalho (`lstat`);
  - não entra em `.git` nem em `node_modules`;
  - não lê o conteúdo dos arquivos, só o `sha256` (por fluxo, para vídeo grande), menos os três JSON dos painéis, que são
    lidos para a tradução.
- **Recusas** (todas listadas juntas, para a pessoa ver tudo de uma vez):
  - `CONFLITO_NO_DESTINO`: o destino já existe com conteúdo diferente;
  - `JSON_INVALIDO`: um dos três JSON dos painéis está quebrado (nunca é regravado);
  - `RUN_EM_ANDAMENTO`: algum `estado.json` está com `status: executando`. Com `--run-parado-confirmado <linha>`, essa
    linha vira aviso;
  - `MIGRACAO_EM_ANDAMENTO`: existe `empresas/.migracao.lock`;
  - `ESPACO_INSUFICIENTE`: `fs.statfsSync` da raiz diz que o livre é menor que `bytes × 1,1`;
  - `INDICE_INVALIDO`: repassado do leitor.
- **Aviso, não recusa:** um run com `status` `aguardando-responsavel` ou `parada` vira o aviso `run-parado` ("o
  trabalho continua da pasta nova; abra uma conversa nova").
- **Garantia de leitura pura:** o módulo de simulação não chama nenhuma função de escrita do `fs`. O teste confere pelo
  efeito (árvore igual), não pelo código.

- [ ] **Passo 1: escrever os testes que falham em `migrar.test.js`.**
  - O auxiliar `pastaAntiga()` monta uma raiz temporária com a pasta antiga da "Aurora Nutrição" e copia o
    `_fabrica/propriedade.json` da matriz. A raiz tem:
    - **marca:** `06-MARCA-E-FOTOS/marca.yaml` com CRLF e BOM, com as letras em `06-MARCA-E-FOTOS/fontes/`; um logo PNG;
      `fotos/retrato.jpg`; `pecas/elemento.png`; o `marca.exemplo.yaml` e o `exemplo/` (do modelo);
      `estilo-de-video.md`; `estilos-proprios/proprio-1/estilo.yaml`;
    - **memória:** `_fabrica/_memoria/empresa.md` (configurado) e `preferencias.md`;
    - **Laboratório:** `04-LABORATORIO-DE-DESIGN/dados/laboratorio.json`, com uma peça de `path` em
      `linhas/reels/saida/run-1/preview.html` e `pasta` em `02-PUBLICACOES/2026-10/peca-1`; `aprovacoes.json`;
      `referencias/ref-1.png`; `COMO-ACESSAR.md`; `estilos/` (do modelo); um arquivo solto `rascunho.md`;
    - **Cronograma:** `03-CRONOGRAMA/dados/posts.json`, com `images` e `previewUrl` antigos; `config.json`;
      `COMO-ACESSAR.md`;
    - **Peças aprovadas:** `02-PUBLICACOES/2026-10/peca-1/lamina-1.png`;
    - **linha de Reels:** `linhas/reels/` com `linha.yaml`, `passos/01.md`, `dados/briefing.md` (do modelo) e
      `dados/preferencias-aprovadas.md` (da empresa); `saida/run-1/preview.html` e `saida/run-1/video.mp4` (alguns KB
      binários); `memoria/runs.md`; `estado.json` (`concluida`); `_investigacoes/perfil-1/notas.md`;
    - **linha própria:** `linhas/consultorio/` com `LEIA-ME.md`, `linha.yaml`, `dados/receita.md` (não protegido),
      `saida/run-2/texto.md` e `memoria/memories.md`;
    - **comuns:** `empresas/principal/pedidos/2026-11-01-100000-usar-estilo.json` e `empresas/principal/decisoes.md`.
  - O auxiliar `retrato(r)` devolve um mapa `caminho → { sha256, bytes, mtimeMs }` de todos os arquivos, mais a lista de
    pastas.

  | Caso | O que confere |
  |---|---|
  | `simular não grava nada` | `retrato` antes e depois de `simular(r)` iguais (arquivos, conteúdo, data e pastas); sem `empresas/` na raiz, ela continua sem existir |
  | `grupos e destinos` | cada linha da tabela do inventário aparece com o `de` e o `para` esperados; `marca.yaml` vai para `empresas/principal/marca.yaml`, e `06-MARCA-E-FOTOS/fontes/Principal.ttf` vai para `empresas/principal/fontes/Principal.ttf` |
  | `modelo nunca entra` | nenhum item tem `de` em `marca.exemplo.yaml`, `exemplo/`, `04-LABORATORIO-DE-DESIGN/estilos/`, `linhas/reels/dados/briefing.md`, `linhas/*/linha.yaml`, `passos/` ou `linhas/consultorio/dados/receita.md`; `doModelo > 0` |
  | `de todas fica` | `_fabrica/_memoria/preferencias.md` não é item nem `ficam` |
  | `sem lugar fica` | `04-LABORATORIO-DE-DESIGN/rascunho.md` está em `ficam` com `motivo: 'sem-lugar'` |
  | `comuns já no lugar` | `pedidos/` e `decisoes.md` não são itens |
  | `referências` | `referencias` traz a peça (`path` e `pasta`), a aprovação e o post, com os `para` da regra |
  | `conflito recusa` | `empresas/principal/marca.yaml` já existe e é diferente → `CONFLITO_NO_DESTINO` citando o arquivo; igual → vai para `jaNoLugar` |
  | `JSON quebrado recusa` | `laboratorio.json` com `[{` → `JSON_INVALIDO`, e o arquivo continua byte a byte |
  | `run executando recusa` | `estado.json` com `executando` → `RUN_EM_ANDAMENTO`; com `--run-parado-confirmado reels`, vira aviso |
  | `run parado avisa` | `aguardando-responsavel` → aviso `run-parado`, sem recusa |
  | `espaço` | `inventario(r, { espacoLivre: 10 })` (a opção existe só para teste) → `ESPACO_INSUFICIENTE` |
  | `atalho não seguido` | uma junção `04-LABORATORIO-DE-DESIGN/referencias/fora` apontando para fora da raiz → está em `ficam` com `motivo: 'atalho'`, e nada de dentro dela é item (o caso é pulado com aviso se o sistema não deixar criar a junção) |
  | `código da simulação estável` | duas simulações seguidas dão o mesmo `codigoSimulacao`; mudar um byte de `memoria/runs.md` muda o código |
  | `pasta nova e já organizada` | pasta sem empresa → `nada-a-mudar`; índice com `principal` em `gaveta` → `ja-organizada`; `simular boreal` → `CODIGO_NAO_E_PASTA_ANTIGA` |
  | `guarda das chaves` | toda chave de `CHAVES_DE_CAMINHO` está classificada em `migrar.js` (`migra`, `comum` ou `derivada`); uma chave inventada injetada na lista faz o teste reprovar |
  | `CLI` | `simular` sai `0` e o texto não contém "gaveta", "legado", "índice", "manifesto" nem "migração"; `simular --json` imprime JSON válido; comando desconhecido sai `2` |

- [ ] **Passo 2: rodar e ver falhar.** Comando: `node _fabrica/core/migrar.test.js`. Falha com `Cannot find module`.
- [ ] **Passo 3: implementar** `inventario`, `simular`, `GRUPOS`, a classificação das chaves e a linha de comando
  (`principal(args)` exportada, `require.main === module`, saídas `0`, `1` e `2` como o `empresa.js`).
- [ ] **Passo 4: rodar e ver passar.** `node _fabrica/core/migrar.test.js` e o `atalho migrar` do `empresa.test.js`.
- [ ] **Passo 5: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.3: inventário e
  simulação, sem gravar nada".

---

### Tarefa 4: aplicar a mudança (copiar, conferir, traduzir e virar o índice)

**Arquivos:**
- Alterar: `_fabrica/core/migrar.js` e `.gitignore` (`empresas/.migracao.lock`, com Edit).
- Teste: `_fabrica/core/migrar.test.js`.

**Interfaces:**

Produz:
- `aplicar(r?, { confirmar: codigoSimulacao, runParadoConfirmado?: [linha], aoCopiar?: (i, item) => void }) ->
  { carimbo, pastaBackup, relatorio, copiados, jaNoLugar, traduzidos }`. `aoCopiar` existe só para os testes injetarem
  falha.
- **Linha de comando:** `node _fabrica/core/migrar.js aplicar --confirmar <codigoSimulacao> [--run-parado-confirmado
  <linha>]`. Sem `--confirmar`, sai `2` e manda simular antes.
- **Arquivos que o `aplicar` cria:**
  - `_fabrica/_backup/migracao-<carimbo>/manifesto.json`:
    ```
    { versao: 1, carimbo, empresa: 'principal', status: 'copiando' | 'aplicada' | 'desfeita' | 'desfeita-por-erro' | 'retirada',
      codigoSimulacao, inicio, fim,
      indiceAntes: { existia: bool, sha256 }, ativaAntes: { existia: bool, sha256 },
      itens: [{ de, para, sha256Origem, sha256Destino, bytes, mtimeMs, traduzido: bool }],
      pastasCriadas: [rel...], ficam: [...], referencias: [...] }
    ```
  - `_fabrica/_backup/migracao-<carimbo>/controle/indice.json` e `ativa.json`: cópia dos dois arquivos de controle
    como estavam, se existiam;
  - `empresas/principal/historico/migracao-<carimbo>.md`: o relatório em português simples (o que mudou de lugar, por
    grupo, o que continua no mesmo lugar, os avisos e como desfazer).
  - `<carimbo>`: `AAAAMMDD-HHMMSS`, hora local, com sufixo `-2` se repetir.

**Passos do `aplicar`, nesta ordem** (cada um é um ponto do teste):
1. **Trava:** cria `empresas/.migracao.lock` com `flag: 'wx'`. Se já existir, recusa com `MIGRACAO_EM_ANDAMENTO`.
2. **Simulação de novo:** roda `simular`. Recusa se houver recusa, ou com `SIMULACAO_DESATUALIZADA` se o
   `codigoSimulacao` não for o confirmado. Assim, o que a pessoa viu é exatamente o que é feito.
3. **Cópia de segurança dos controles:** grava o manifesto com `status: 'copiando'` (gravação atômica) e copia o
   `indice.json` e o `ativa.json` para `controle/`.
4. **Cópia de cada item:**
   - `fs.copyFileSync(de, para, COPYFILE_EXCL)`, criando as pastas e anotando em `pastasCriadas`;
   - `fs.utimesSync` com a data da origem;
   - `sha256` do destino;
   - comparação com o `sha256Origem`, ou, nos traduzidos, com o `sha256` do JSON traduzido calculado em memória;
   - diferença recusa com `COPIA_DIFERENTE`.
   - **Tradução:** `JSON.parse` da origem, troca só nos campos da regra, `JSON.stringify(valor, null, 2) + '\n'` (o
     formato do `gravarJson` dos painéis), gravado em `.tmp` e renomeado.
5. **Conferência das origens:** recalcula o `sha256` de toda origem. Se algo mudou durante a cópia, recusa com
   `ORIGEM_MUDOU`, citando os arquivos.
6. **Virada do índice** (o único ponto que muda o comportamento da Fábrica):
   - grava `empresas/indice.json` com a entrada `principal` em `disposicao: 'gaveta'` e
     `migrada: { em, carimbo }`, preservando as outras entradas e os outros campos;
   - sem índice (legado virtual), cria o índice com a entrada do `legadoVirtual`;
   - gravação atômica (`.tmp` e renomear);
   - o `ativa.json` não muda.
7. **Fechamento:** grava o relatório, o manifesto com `status: 'aplicada'` e `fim`, e solta a trava.

**Erro em qualquer passo de 3 a 6:**
- apaga **só** os arquivos que este `aplicar` criou (os de `itens` já copiados e conferidos pelo próprio manifesto) e as
  `pastasCriadas` que ficaram vazias, nunca outra coisa;
- grava o manifesto com `status: 'desfeita-por-erro'` e o motivo;
- solta a trava;
- sai `1` com a mensagem "Nada mudou: a Fábrica continua usando os lugares de sempre.".

Como a virada é o passo 6, um erro antes dele nunca deixa a Fábrica apontando para uma pasta pela metade.

- [ ] **Passo 1: escrever os testes que falham.**

  | Caso | O que confere |
  |---|---|
  | `antigos intactos` | `retrato` antes e depois do `aplicar`: todo arquivo que existia continua com o mesmo `sha256` e a mesma data, no mesmo caminho; a exceção é o `empresas/indice.json`, se existia (e ele continua com o conteúdo antigo em `controle/`) |
  | `só o esperado nasceu` | os arquivos novos são exatamente os `para` dos itens, o `indice.json` (se não existia), o relatório e a pasta `_fabrica/_backup/migracao-<carimbo>/`; nada nasceu em `empresas/boreal/` nem fora dessas pastas |
  | `cópia byte a byte` | `empresas/principal/marca.yaml` igual byte a byte ao antigo (CRLF e BOM preservados); o mesmo para `empresa.md`, `estilo-de-video.md`, `saidas/reels/run-1/video.mp4`, `memoria/reels/runs.md` e `estado/reels.json`; data de modificação igual (até o segundo) |
  | `receitas não copiadas` | não existem `empresas/principal/linhas/reels/passos/`, `.../linha.yaml`, `.../dados/briefing.md` nem `.../linhas/consultorio/dados/receita.md`; existe `empresas/principal/linhas/reels/dados/preferencias-aprovadas.md` |
  | `referências traduzidas na cópia` | na cópia de `laboratorio.json`, a peça tem `path: 'empresas/principal/saidas/reels/run-1/preview.html'` e `pasta: 'empresas/principal/publicacoes/2026-10/peca-1'`; o `desc` com texto antigo continua igual e gera aviso; o `laboratorio.json` antigo continua byte a byte |
  | `índice virou` | `empresa.listar(r)` dá `principal` em `gaveta` com `migrada.carimbo`; `empresa.caminhos('principal', r).marca` é o da pasta nova |
  | `relatório` | `historico/migracao-<carimbo>.md` existe, tem um título por grupo e a frase de como desfazer, sem "gaveta", "legado", "índice" nem "manifesto" |
  | `simulação velha recusa` | muda um byte de `memoria/runs.md` depois de `simular` → `aplicar` com o código antigo recusa com `SIMULACAO_DESATUALIZADA`, e nada é gravado (`retrato` igual) |
  | `falha no meio volta atrás` | `aoCopiar` lança erro no quinto item → saída com recusa; `retrato` igual ao de antes, a não ser pela pasta `_fabrica/_backup/migracao-<carimbo>/` (manifesto `desfeita-por-erro`); índice como antes; sem trava |
  | `origem mudou durante a cópia` | `aoCopiar` altera `03-CRONOGRAMA/dados/posts.json` no terceiro item → `ORIGEM_MUDOU`, volta atrás como no caso anterior, e a alteração feita no arquivo antigo é mantida (não é desfeita) |
  | `trava` | com `empresas/.migracao.lock` presente → `MIGRACAO_EM_ANDAMENTO`, nada gravado |
  | `segunda vez` | `aplicar` de novo depois de aplicada → `ja-organizada`, nada gravado |
  | `outra empresa intocada` | com `boreal` criada antes (índice real com `principal` legado e `boreal` gaveta), os arquivos de `empresas/boreal/` continuam iguais, a entrada `boreal` continua no índice e o `ativa.json` continua o mesmo |
  | `CLI` | `aplicar` sem `--confirmar` sai `2`; com o código certo sai `0` e imprime o resumo e "Para desfazer: ..." |

- [ ] **Passo 2: rodar e ver falhar.** `node _fabrica/core/migrar.test.js`.
- [ ] **Passo 3: implementar** `aplicar`, o manifesto, a tradução, a trava e a volta atrás. A gravação atômica reaproveita
  o padrão do `gravarJson` do `empresa.js`.
- [ ] **Passo 4: calibrar (G-13).** Trocar temporariamente a cópia por `readFileSync`/`writeFileSync` com
  `toString('utf8')`. O caso `cópia byte a byte` precisa falhar no BOM. Tirar a conferência do passo 5: o caso `origem
  mudou durante a cópia` precisa falhar. Desfazer as duas trocas e confirmar que tudo volta a passar.
- [ ] **Passo 5: rodar e ver passar**, mais `node _fabrica/core/empresa.test.js` e `node _fabrica/core/isolamento.test.js`.
- [ ] **Passo 6: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.4: aplicar com cópia
  conferida, referências dos painéis traduzidas e volta atrás em caso de erro".

---

### Tarefa 5: desfazer (antes da retirada) e estado

**Arquivos:**
- Alterar: `_fabrica/core/migrar.js`.
- Teste: `_fabrica/core/migrar.test.js`.

**Interfaces:**

Produz:
- `estado(r?) -> { situacao, ultima?: { carimbo, status, em }, pendencias: [...] }`. A situação é uma de:
  `'pasta-antiga'`, `'organizada'`, `'organizada-com-antigos'` (antes da retirada), `'organizada-antigos-retirados'` e
  `'interrompida'` (trava presente, ou manifesto em `copiando`).
- `desfazer(r?, carimbo?, { levarNovos = false, confirmar = false }) -> { movidosParaBackup, levadosDeVolta, mantidos }`.
  Sem `carimbo`, vale o da última mudança.
- **Linha de comando:** `node _fabrica/core/migrar.js estado [--json]` e
  `node _fabrica/core/migrar.js desfazer [<carimbo>] [--levar-novos] --confirmar`.

**Regras do `desfazer`, com os antigos ainda no lugar:**
1. **Trava,** como no `aplicar`.
2. **Conferência da pasta da empresa** contra o manifesto, em todas as pastas de destino dos itens:
   - **igual:** item intacto;
   - **mudou:** item editado depois da mudança;
   - **novo:** arquivo que não está no manifesto (produzido depois da mudança).
3. **Com algo mudado ou novo e sem `--levar-novos`:** recusa com `NOVOS_NA_PASTA_DA_EMPRESA`, lista os arquivos e não
   grava nada.
4. **Com `--levar-novos`:**
   - cada arquivo mudado ou novo é copiado para o lugar antigo correspondente (o mapa ao contrário, pelo par de
     `caminhosDe`);
   - se o lugar antigo já tem um arquivo diferente, recusa tudo com `CONFLITO_AO_LEVAR` antes de copiar qualquer coisa;
   - um JSON traduzido que mudou volta com a tradução ao contrário;
   - o lugar antigo de um item mudado tem o original da mudança: antes de receber a versão nova, o original vai para
     `_fabrica/_backup/migracao-<carimbo>/substituidos/`.
5. **Pasta da empresa:** as cópias (intactas, mudadas e novas) são **movidas** para
   `_fabrica/_backup/migracao-<carimbo>/desfeito/`, nunca apagadas. As `pastasCriadas` vazias saem.
6. **Índice:** a entrada `principal` volta a `disposicao: 'legado'`, sem `migrada`, e as outras entradas ficam. Se o
   índice não existia antes e hoje só tem a `principal`, ele vai para `desfeito/`, e a pasta volta a ter o legado
   virtual, como antes.
7. **Fechamento:** manifesto com `status: 'desfeita'` e uma linha no relatório. A trava sai.

**Mudança interrompida** (processo morto entre os passos 3 e 6 do `aplicar`): o `estado` diz `interrompida`, e o
`desfazer` apaga só as cópias que conferem com o manifesto (são cópias, e os originais estão no lugar), tira a trava e
marca `desfeita-por-erro`.

- [ ] **Passo 1: escrever os testes que falham.**

  | Caso | O que confere |
  |---|---|
  | `volta exatamente como era` | `aplicar` e depois `desfazer`: `retrato` igual ao original em tudo fora de `_fabrica/_backup/`; `listar` mostra a `principal` em `legado` (virtual, se o índice não existia) |
  | `novo na pasta nova recusa` | depois do `aplicar`, cria `empresas/principal/saidas/reels/run-9/plano.md` → `desfazer` sai com `NOVOS_NA_PASTA_DA_EMPRESA`, cita o arquivo, e nada mudou |
  | `levar novos` | o mesmo com `--levar-novos` → `linhas/reels/saida/run-9/plano.md` existe com o mesmo conteúdo; a cópia está em `desfeito/` |
  | `peça nova volta traduzida ao contrário` | peça registrada depois da mudança com `path: 'empresas/principal/saidas/reels/run-9/preview.html'` → depois de `desfazer --levar-novos`, o `laboratorio.json` antigo tem a peça com `path: 'linhas/reels/saida/run-9/preview.html'`, e o original de antes está em `substituidos/` |
  | `conflito ao levar` | um arquivo novo na pasta da empresa cujo lugar antigo já tem outro conteúdo → `CONFLITO_AO_LEVAR`, nada copiado nem movido |
  | `empresa criada depois continua` | `aplicar`, `criar boreal`, `desfazer` → o índice tem `principal` (legado) e `boreal` (gaveta), e `empresas/boreal/` está igual |
  | `interrompida` | processo filho roda `aplicar` com `aoCopiar` chamando `process.exit(9)` no quarto item → `estado` diz `interrompida`; `listar` continua em `legado`; `desfazer` deixa o `retrato` igual ao original fora de `_fabrica/_backup/` e tira a trava |
  | `estado` | a situação certa em cada momento: antes, depois do `aplicar` e depois do `desfazer` |
  | `CLI` | `desfazer` sem `--confirmar` sai `2`; carimbo inexistente sai `1` com `CARIMBO_DESCONHECIDO` |

- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar** `estado` e `desfazer` (sem a parte de antigos retirados, que entra na Tarefa 6).
- [ ] **Passo 4: rodar e ver passar.**
- [ ] **Passo 5: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.5: desfazer sem perder o
  que foi feito depois, e estado da mudança".

---

### Tarefa 6: retirar os antigos (opcional) e desfazer depois da retirada

**Arquivos:**
- Alterar: `_fabrica/core/migrar.js`.
- Teste: `_fabrica/core/migrar.test.js`.

**Interfaces:**

Produz:
- `retirar(r?, carimbo?, { confirmar }) -> { movidos, pastasVazias }`.
- **Linha de comando:** `node _fabrica/core/migrar.js retirar [<carimbo>] --confirmar`.

**Regras do `retirar`:**
1. **Pré-condições:** trava; manifesto em `aplicada`; a `principal` em `gaveta` no índice. Se não, recusa com
   `NAO_HA_O_QUE_RETIRAR`.
2. **Tudo ou nada.** Para cada item, o antigo (`de`) precisa ter o `sha256Origem` e a cópia (`para`) precisa existir. A
   cópia pode ter mudado depois, porque ela já é a usada.
   - Antigo mudado ou ausente recusa com `ANTIGOS_MUDARAM`.
   - Um arquivo novo dentro das pastas antigas dos grupos (alguém gravou no lugar antigo depois da mudança) também
     recusa, com a lista.
   - Nada é movido se houver qualquer recusa.
3. **Move cada antigo** com `fs.renameSync` para `_fabrica/_backup/migracao-<carimbo>/antigos/<de>`. Se a cópia de
   segurança estiver em outro disco (`EXDEV`), copia, confere o `sha256` e só depois remove o antigo.
4. **Pastas que ficaram vazias** dentro das pastas dos grupos saem e vão para `pastasRetiradas` no manifesto. Isso nunca
   vale para as pastas do modelo, que continuam com os arquivos do modelo.
5. **Fechamento:** manifesto em `retirada`, com uma linha no relatório.

**`desfazer` depois da retirada:** antes dos passos da Tarefa 5, recria as `pastasRetiradas` e move cada antigo de
`antigos/` de volta para o lugar dele, conferindo o `sha256`. Se o lugar já tiver um arquivo, recusa tudo com
`CONFLITO_AO_LEVAR`.

- [ ] **Passo 1: escrever os testes que falham.**

  | Caso | O que confere |
  |---|---|
  | `retirar move, não apaga` | `aplicar` e `retirar`: cada `de` deixou de existir e está em `antigos/<de>` com o mesmo `sha256`; os arquivos do modelo e as receitas continuam no lugar; `06-MARCA-E-FOTOS/` continua existindo (tem o exemplo) |
  | `Fábrica funciona sem os antigos` | depois do `retirar`, `caminhos('principal')` aponta para arquivos que existem em todas as chaves que tinham arquivo antes |
  | `antigo mudou recusa tudo` | altera `linhas/reels/memoria/runs.md` depois do `aplicar` → `retirar` sai com `ANTIGOS_MUDARAM`, cita o arquivo, e nada foi movido |
  | `novo no lugar antigo recusa` | cria `02-PUBLICACOES/2026-11/nova.png` depois do `aplicar` → recusa com a lista, nada movido |
  | `desfazer depois de retirar` | `aplicar`, `retirar` e `desfazer` → `retrato` igual ao original fora de `_fabrica/_backup/` |
  | `retirar duas vezes` | o segundo `retirar` recusa com `NAO_HA_O_QUE_RETIRAR` |

- [ ] **Passo 2: rodar e ver falhar.**
- [ ] **Passo 3: implementar** `retirar` e a parte do `desfazer` que traz os antigos de volta.
- [ ] **Passo 4: rodar e ver passar.**
- [ ] **Passo 5: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.6: retirar os antigos para
  a cópia de segurança, sem apagar, e desfazer depois".

---

### Tarefa 7: prova de ponta a ponta com as ferramentas

**Arquivos:**
- Criar: `_fabrica/core/migracao.test.js`.

**Interfaces:**
- Consome, tudo por processo filho com `FABRICA_RAIZ` (como o `isolamento.test.js`): `migrar.js`, `empresa.js`,
  `marca.js`, `validar.js --empresa`, `tema-marca.js`, o servidor dos painéis (`servidor.js`, numa porta livre) e o
  `atualizar.js verificar --origem <matriz> --raiz <tmp>`.
- A pasta antiga é a da Tarefa 3, mais uma segunda empresa `boreal` (gaveta, "Boreal Advocacia", com marca e uma saída).
  As letras da Aurora são uma das letras OFL de `08-FERRAMENTAS/tesseract/modelos/fontes/`, copiada para
  `06-MARCA-E-FOTOS/fontes/` da pasta fictícia, para o `tema-marca.js` conseguir ler o arquivo de verdade.

| Caso | O que confere |
|---|---|
| `mesmos dados pelos dois caminhos` | para cada chave de `caminhos('principal')`, os arquivos e os `sha256` são os mesmos antes (pasta antiga) e depois do `aplicar` (pasta da empresa), menos os três JSON traduzidos |
| `marca igual` | um processo filho com o `marca.js` imprime o mesmo `hex('acento')`, e `caminho(tipografia.principal.arquivo)` existe dentro de `empresas/principal/`, antes e depois do `aplicar` e depois do `retirar` |
| `vídeo na marca` | `temaMarca.resolver({ usarMarca: true }, { marcaMod })`, com o `marca.js` carregado no processo filho, devolve `fontes.principal` dentro de `empresas/principal/` depois do `retirar`, sem erro |
| `painéis iguais` | `/api/dados?empresa=principal` devolve as mesmas peças (ids) e os mesmos posts antes e depois; a peça abre (`200` no `path` traduzido); a letra de `/api/empresa?empresa=principal` tem endereço que responde `200` |
| `registrar depois` | `registrar.js peca <json> --empresa principal`, com `path` em `empresas/principal/saidas/reels/...`, sai `0` depois do `aplicar` |
| `isolamento continua` | `validar.js --empresa boreal` sai `1` se uma saída da `boreal` citar "Aurora Nutrição" e `0` sem a citação, antes e depois do `aplicar`; o mesmo, ao contrário, para a `principal` |
| `atualização não toca` | `atualizar.js verificar --origem <matriz> --raiz <tmp>` depois do `retirar`: nenhuma linha das listas de troca ou de remoção começa por `empresas/`, `_fabrica/_backup/` ou pelos `de` do manifesto |
| `conservação` | depois de `aplicar`, `retirar` e `desfazer`, todo `caminho → sha256` do `retrato` original existe igual; a contagem de arquivos do original é menor ou igual à soma dos arquivos fora e dentro de `_fabrica/_backup/` |
| `boreal intocada` | os `sha256` de `empresas/boreal/` são os mesmos do começo ao fim |

- [ ] **Passo 1: escrever o teste.**
- [ ] **Passo 2: rodar.** `node _fabrica/core/migracao.test.js`. Como as Tarefas 1 a 6 já existem, o teste deve passar
  de primeira. Se algum caso falhar, corrigir a tarefa de origem, com teste nela, antes de seguir.
- [ ] **Passo 3: calibrar (G-13).** Desligar temporariamente a regra da Tarefa 2 no `marca.js`: o caso `marca igual`
  precisa falhar depois do `retirar`. Desligar a tradução de `path`: o caso `painéis iguais` precisa falhar. Desfazer as
  duas trocas.
- [ ] **Passo 4: bateria completa** (`git ls-files '*.test.js'`, como nas etapas anteriores, com o `NODE_PATH` e o
  `FABRICA_CHROMIUM` do ambiente). Todos saem `0`.
- [ ] **Passo 5: validador, `conferir-caminhos` e commit.** Mensagem: "Mudança de pasta, item 9.7: prova de ponta a ponta
  com marca, vídeo, painéis, conferência entre empresas e atualização".

---

### Tarefa 8: decisões visuais com o responsável (antes das telas e dos textos)

Nada desta tarefa entra no repositório. A página fica na pasta de trabalho
(`...\scratchpad\etapa9\decisoes.html`, só local). Ela é montada com uma simulação **de verdade** da pasta fictícia da
Tarefa 7 (Aurora e Boreal), nunca com dados da pasta real.

- [ ] **Passo 1: montar a página com as opções renderizadas lado a lado,** cada uma com rótulo A, B e C e com a mesma
  simulação:
  - **V-1. Como a simulação aparece antes de confirmar:**
    - (A) resumo de cinco linhas na conversa, com a página completa aberta no navegador;
    - (B) só a página "Antes e depois", em duas colunas: a pasta como está e como fica;
    - (C) só a conversa, com uma lista por grupo e o botão "Ver a lista completa".
  - **V-2. Onde a Fábrica oferece a mudança:**
    - (A) só quando a pessoa pede, com o comando citado na ajuda da `/fabrica`;
    - (B) também uma vez, ao criar a segunda empresa ("Quer guardar as coisas da sua primeira empresa numa pasta só
      dela?");
    - (C) também uma linha discreta no Laboratório e no Cronograma, só na pasta antiga.

    Cada opção vem com a imitação da tela ou da conversa em que aparece.
  - **V-3. A mensagem de fim e o desfazer:**
    - (A) três linhas na conversa, mais "Para desfazer, digite ...";
    - (B) a página do relatório, com os grupos em cartões, os números, a seção "Como desfazer" e o aviso "abra uma conversa
      nova";
    - (C) as duas coisas.
  - **V-4. O nome do comando na `/fabrica`:** três candidatos mostrados como aparecem no menu e na ajuda (por exemplo,
    `organizar-pasta`, `pasta-da-empresa` e `separar-empresa`), com o comando de desfazer de cada um.
- [ ] **Passo 2: abrir a página no navegador do responsável** (`Start-Process`) e perguntar com `AskUserQuestion`,
  apontando para as letras da página. Nunca perguntar sobre tela ou texto ao usuário sem a página aberta.
- [ ] **Passo 3: registrar as escolhas** num registro da etapa, na pasta de trabalho (`etapa9/decisoes.txt`), junto com
  as decisões não visuais (seção "Decisões do responsável", abaixo). A Tarefa 9 segue o que foi escolhido.

---

### Tarefa 9: o comando na `/fabrica`, os textos e a página do relatório

**Arquivos:**
- Alterar: `.claude/skills/fabrica/SKILL.md` (roteamento, "Comandos de empresa", ajuda e, se escolhido na V-2 (B), o
  passo de `nova-empresa`), `.claude/skills/atualizar/SKILL.md` (uma frase) e `CORE.md` (subseção "Empresas").
- Criar, só se a V-1 ou a V-3 escolheram página: `_fabrica/core/migrar-pagina.js`, mais o teste. Ele gera um HTML local,
  sem rede, a partir do `--json` do `simular`, do manifesto e do relatório, e grava em
  `empresas/principal/historico/migracao-<carimbo>.html`.

**Fluxo do comando** (nome da V-4; aqui, `<organizar>`), escrito na skill:
1. Rodar `node _fabrica/core/migrar.js estado --json`.
   - `organizada`: dizer "Sua pasta já está organizada." e parar.
   - `interrompida`: explicar em uma frase e oferecer **Desfazer o que ficou pela metade** ou **Parar aqui**.
2. Conferir que não há run desta conversa em andamento e pedir para fechar o Laboratório e o Cronograma se estiverem
   abertos.
3. Rodar `simular --json` e mostrar como a V-1 decidiu. Com recusa, mostrar o motivo em português simples:
   - `RUN_EM_ANDAMENTO`: pergunta se o trabalho está mesmo parado e, só com a confirmação, repete com
     `--run-parado-confirmado <linha>`;
   - `CONFLITO_NO_DESTINO`: mostra os arquivos e não decide sozinho;
   - outra recusa: para.
4. Perguntar com `AskUserQuestion`: **Organizar agora**, **Ver a lista completa** ou **Agora não**.
5. **Organizar agora:** rodar `aplicar --confirmar <codigoSimulacao>` e mostrar o fim como a V-3 decidiu. **Sempre**
   recomendar abrir uma conversa nova, porque os caminhos guardados nesta conversa eram os antigos.
6. **Retirar os antigos** (só se a decisão N-1 aceitar a fase): oferecido em outro pedido, nunca no mesmo. O comando
   `<organizar> retirar` mostra antes quantos arquivos vão para a cópia de segurança e pergunta.
7. **Desfazer:** o comando `<organizar> desfazer` roda `desfazer --confirmar`. Com `NOVOS_NA_PASTA_DA_EMPRESA`, mostra
   a lista e pergunta **Levar o que é novo de volta** (`--levar-novos`) ou **Parar aqui**.

**Regras escritas na skill:**
- O comando nunca é disparado sozinho, nem por outro comando: na V-2 (B) ou (C), só a oferta aparece, e a mudança
  continua precisando do "Organizar agora".
- Sem jargão: dizer "organizar", "pasta da empresa", "cópia de segurança" e "desfazer".
- O caminho de arquivo só aparece se a pessoa pedir.

**CORE.md, subseção "Empresas":**
- trocar "nada é movido, apagado ou sobrescrito" por "nada é movido sem pedido";
- um parágrafo curto: o comando, as fases (simular, aplicar, retirar e desfazer), onde ficam a cópia de segurança e o
  relatório, e que a atualização nunca toca os dois.

**`atualizar` SKILL:** uma frase, dizendo que a cópia de segurança da organização da pasta (em `_fabrica/_backup/`) também
nunca é tocada.

- [ ] **Passo 1:** se houver página, escrever o teste de contrato do `migrar-pagina.js`: o HTML não tem caminho absoluto
  nem as palavras proibidas, funciona sem rede (sem `http`) e mostra os mesmos números do `--json`. Ver falhar,
  implementar e ver passar.
- [ ] **Passo 2:** os textos da skill, do `CORE.md` e do `atualizar`, com Edit. Linhas que citem caminho antigo levam
  "pasta antiga".
- [ ] **Passo 3: prova da conversa.** Numa pasta fictícia (a da Tarefa 7, copiada para a pasta de trabalho), seguir o
  fluxo da skill como o agente faria. Capturar a página (se houver) em 1280 px e 400 px. Mostrar ao responsável junto da
  Tarefa 10.
- [ ] **Passo 4:** `node _fabrica/core/conferir-caminhos.js`, `node _fabrica/core/validar-linha.js reels` e o validador
  saem `0`. Commit com a mensagem "Mudança de pasta, item 9.8: comando de organizar a pasta na /fabrica, relatório e
  textos".

---

### Tarefa 10: fechamento

- [ ] **Passo 1: bateria completa,** o validador, `conferir-caminhos.js` e `validar-linha.js reels`. Todos saem `0`.
- [ ] **Passo 2: revisão final do ramo** pelo modelo mais capaz, com o "Foco da revisão" acima e o autoexame no fim deste
  plano.
- [ ] **Passo 3: página de prova para o responsável** (só local): a simulação, o relatório e o desfazer da pasta fictícia,
  com o antes e o depois.
- [ ] **Passo 4: pasta real, só com o pedido dele.** Se ele quiser, rodar só `simular` (sem gravar nada) na pasta dele e
  mostrar o resultado na conversa e na página. O `aplicar` na pasta real é decisão dele, num pedido próprio, depois de ver
  a simulação.
- [ ] **Passo 5:** commit de fechamento, se houver ajuste. Nada de `push`.

---

## Decisões do responsável

**Visuais** (página lado a lado, Tarefa 8): V-1 (como a simulação aparece), V-2 (onde a mudança é oferecida), V-3
(mensagem de fim e desfazer) e V-4 (nome do comando).

**Não visuais** (perguntar com `AskUserQuestion`, com a minha recomendação marcada; podem ir na mesma conversa da
Tarefa 8):
- **N-1. A fase "retirar os antigos" existe?** Minha escolha: existe, separada e opcional, e move para a cópia de
  segurança, sem apagar. Alternativa: sem retirada, com os antigos para sempre no lugar, sem uso, e o espaço em disco em
  dobro.
- **N-2. Qual é a cópia de segurança?**
  - Minha escolha: os próprios arquivos antigos, intactos até a retirada e depois guardados em
    `_fabrica/_backup/migracao-<carimbo>/antigos/`, mais a cópia dos arquivos de controle. Não ocupa espaço a mais.
  - Alternativa: uma terceira cópia completa antes de tudo. É mais uma rede, mas triplica o espaço das saídas de vídeo.
- **N-3. Onde fica a cópia de segurança?**
  - Minha escolha: `_fabrica/_backup/`, onde a atualização já guarda as dela. A pasta é ignorada pelo git, e a
    atualização nunca a toca.
  - Alternativa: dentro da pasta da empresa (`empresas/principal/`). Fica tudo da empresa num lugar só, mas entra no git
    da pasta.
- **N-4. Arquivo sem lugar definido** (por exemplo, um arquivo solto no Laboratório): minha escolha é que ele continue
  onde está, dito no relatório. Alternativa: ir para `empresas/principal/outros/`.
- **N-5. Apagar a cópia de segurança um dia:** minha escolha é nunca apagar sozinho. Só a pessoa pede, e a Fábrica mostra
  o tamanho antes.
- **N-6. `dados/briefing.md` da linha de Reels:**
  - O desenho (6.1) diz que ele é da empresa, mas o `propriedade.json` e o runner o tratam como do modelo.
  - A mudança segue o `propriedade.json` (ele fica na linha).
  - Se ele decidir que é da empresa, a correção é no `propriedade.json` (acrescentar em `protegidos`), numa tarefa à
    parte, e a mudança passa a levá-lo sem mexer no código.
- **N-7. Rodar a simulação na pasta real dele** no fechamento (Tarefa 10, passo 4): só se ele pedir.

**Técnicas, já decididas por mim** (ele pode mudar):
- **T-1.** O `marca.yaml` vai sem edição, e o leitor de marca ganha a regra `06-MARCA-E-FOTOS/<resto>` →
  `<pasta da empresa>/<resto>`. As alternativas eram reescrever os caminhos dentro da cópia do `marca.yaml`, o que mexe
  na marca, ou copiar espelhando `06-MARCA-E-FOTOS/` dentro da pasta da empresa, o que deixa a pasta confusa e não serve
  para as peças.
- **T-2.** Os três JSON dos painéis são traduzidos na cópia, por campo e por prefixo exato. Os textos não são editados.
- **T-3.** O `aplicar` exige o código da simulação vista (`--confirmar <codigo>`).

## O que fica fora desta etapa

- Mudar a pasta de trabalho do Reels (`08-FERRAMENTAS/tesseract/projetos/<NN>`). Ela continua compartilhada, como nos
  adiados da etapa 2.
- Corrigir as referências antigas dentro de textos (`.md`, roteiros e legendas) e dentro das lâminas já produzidas.
  - Elas são histórico, e o relatório só as conta.
  - Uma lâmina antiga refeita depois da retirada pode não achar a foto. O relatório avisa quando houver lâminas com foto
    em lugar antigo.
- Mudança de uma empresa de pasta própria para outra pasta, juntar empresas ou renomear o código `principal`.
- Disparo pelo painel. Pelo desenho, o caminho do usuário no painel conversa com o agente por pedidos (etapa 8), e a
  mudança é feita só pelo agente.

---

## Autoexame

**Lacunas conhecidas:**
- **Outra conversa aberta com os caminhos antigos guardados.** Ela pode continuar gravando nos lugares antigos depois da
  mudança. O plano não impede isso, mas detecta: o `retirar` recusa se algo novo ou mudado aparecer nos lugares
  antigos, e o fluxo manda abrir conversa nova. O que for gravado no lugar antigo entre o `aplicar` e o `retirar` não
  aparece na Fábrica até a pessoa resolver. Isso é dito no relatório.
- **Painel aberto durante o `aplicar`.** A conferência das origens (passo 5) pega gravações feitas durante a cópia. Uma
  gravação que chega entre a conferência e a virada (milissegundos) não é pega. Para fechar essa janela, o servidor dos
  painéis teria de respeitar o `empresas/.migracao.lock` nas rotas de gravação. Fica como melhoria se a revisão achar
  necessário. A skill pede para fechar os painéis antes.
- **Referências dentro de textos e lâminas antigas** não são traduzidas (ver "O que fica fora").
- **Pastas sincronizadas** (OneDrive, Dropbox) podem segurar arquivos ou criar cópias com conflito. O `aplicar` só
  detecta pelo erro de cópia (e volta atrás). Não há teste com sincronizador.
- **Atalhos** (junções) não são seguidos e ficam onde estão. Se a pessoa usava uma junção para guardar fotos em outro
  disco, a pasta nova não as terá, e o relatório diz isso.
- **Espaço em disco:** a conta usa `fs.statfsSync`. Em disco de rede, o número pode não ser confiável, e a falta de
  espaço no meio cai na volta atrás.

**Riscos de perda de dados e como o plano os cobre:**

| Risco | Cobertura |
|---|---|
| Cópia corrompida ou diferente (fim de linha, BOM) | cópia binária exclusiva com conferência por `sha256` de cada arquivo; teste `cópia byte a byte` com CRLF e BOM; calibração G-13 |
| Interrupção no meio | a virada do índice é o último passo e é atômica; `estado` mostra `interrompida`, e o `desfazer` limpa só as cópias conferidas; teste com processo morto |
| Arquivo antigo mudando durante a cópia | conferência das origens antes da virada; teste `origem mudou durante a cópia` |
| O que a pessoa viu não é o que foi feito | `--confirmar <codigoSimulacao>`; teste `simulação velha recusa` |
| Perder o que foi produzido depois da mudança, ao desfazer | `NOVOS_NA_PASTA_DA_EMPRESA` ou `--levar-novos`; nada é apagado, só movido para `desfeito/` e `substituidos/` |
| Retirar um antigo que divergiu da cópia | `retirar` tudo ou nada, por `sha256`; teste `antigo mudou recusa tudo` |
| Apagar alguma coisa | nenhuma fase apaga dado da empresa: `aplicar` só cria (e só apaga as próprias cópias na volta atrás), `retirar` e `desfazer` só movem; teste de `conservação` |
| Tocar outra empresa | só a `principal` muda; teste `boreal intocada` e `outra empresa intocada` |
| Tocar o que é do modelo ou as receitas das linhas | classificação pelo `propriedade.json`; testes `modelo nunca entra` e `receitas não copiadas` |
| Atualização futura apagar ou trocar algo | `empresas/` é protegida e `_fabrica/_backup/` está fora do modelo; teste `atualização não toca` |
| Etapa futura criando um lugar novo que a mudança não leva | teste de guarda das chaves do leitor |
| Marca deixando de achar letra e logo | regra da Tarefa 2 e testes `marca igual` e `vídeo na marca` |

---

## Situação ao fechar (2026-11-05)

**Feito (Tarefas 1 a 9, com as rodadas de correção das revisões):** o leitor entrega os caminhos das duas disposições;
letras e logo da pasta antiga achadas na pasta da empresa; `migrar.js` com `simular`, `previa`, `aplicar`, `estado`,
`retirar` e `desfazer`; prova de ponta a ponta (`migracao.test.js`); o comando `/fabrica organizar-pasta` (e
`desfazer`, `retirar`) na skill, com a oferta ao criar a segunda empresa; as páginas da prévia (fora da Fábrica) e do
relatório (`empresas/principal/historico/migracao-<carimbo>.html`); CORE, `/atualizar` e os guias dos painéis.

**Decisões do responsável aplicadas:** V-1 A, V-2 B, V-3 C e V-4 A (prancha da Tarefa 8); N-1 a N-7 e T-1 a T-3 como
recomendadas.

**Diferenças em relação ao texto acima (registradas nos relatórios de cada tarefa):**
- a prévia é um comando próprio (`previa`), que devolve o resumo curto e grava a página numa pasta temporária fora da
  Fábrica; a página do relatório é gravada pelo próprio `aplicar` e marcada pelo `retirar` e pelo `desfazer`;
- a pergunta depois da prévia tem duas opções (**Organizar agora** / **Agora não**), como na prancha aprovada;
- status intermediários `desfazendo` e `retirando`, gravação segura por temporário com nome final exclusivo, pastas
  `desfeito/`, `substituidos/`, `antigos/` e `incompletos/` na cópia de segurança;
- o registro de peça da `principal` organizada só aceita `empresas/principal/` (a aprovação no servidor dos painéis
  continua com a regra antiga).

**Limitações conhecidas:** as do autoexame acima; inteiros maiores que 2^53 e chaves repetidas nos JSON dos painéis só
na cópia traduzida; sem link no disco, uma morte no meio da última cópia pode deixar um pedaço, que vai para
`incompletos/`; a janela de milissegundos entre a conferência das origens e a virada.

**Ainda não feito:** a prova de comportamento da skill por um agente (roteiro no relatório da Tarefa 9), a revisão final
do ramo e a simulação na pasta real (só com o pedido do responsável; o `aplicar` na pasta real é decisão dele, em pedido
próprio).
