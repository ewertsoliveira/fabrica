# Etapa 3: painéis por empresa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** o Laboratório de Design e o Cronograma funcionam por empresa. Um seletor no alto troca de empresa, cada
painel mostra só os dados da empresa escolhida, e o cronograma enviado a um cliente é gerado só a partir da empresa
dele, depois da conferência entre empresas.

**Arquitetura:**
- O servidor local do ramo `paineis` (`_fabrica/paineis/`, só dados e servidor hoje) passa a resolver todo caminho pelo
  leitor `_fabrica/core/empresa.js`. Toda rota de dados recebe a empresa.
- As duas telas ainda não existem na matriz. Elas são escritas aqui, genéricas e sem nada de empresa real, tendo como
  referência de comportamento os painéis da pasta de referência (só leitura, nunca copiados).
- O envio ao cliente gera um arquivo próprio, a partir da pasta da empresa, nunca filtrando uma página com todas.

**Tecnologia:** Node (módulos nativos), HTML/CSS/JS simples nas telas (sem build, sem biblioteca externa), testes em
scripts `node` com `assert`, como nas etapas 1 e 2.

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seção 7 (painéis) e 12
(etapa 3). Etapas anteriores: `docs/superpowers/plans/2026-10-30-etapa-1-gavetas-por-empresa.md` e
`docs/superpowers/plans/2026-10-30-etapa-2-instrucoes-por-empresa.md`.

## Restrições globais

- **Nada muda para quem tem uma empresa só:** na pasta antiga (`principal`), todo arquivo continua onde está
  (`03-CRONOGRAMA/dados`, `04-LABORATORIO-DE-DESIGN/dados`, `02-PUBLICACOES`), e o seletor nem aparece.
- **Nunca mover, apagar nem sobrescrever dados existentes.** JSON quebrado nunca é regravado.
- **O servidor só aceita pedidos deste computador** (regra do ramo `paineis`) e nunca faz commit nem publica nada.
- **Git:** sem `git push`, `pull`, `merge` ou `reset`. Commit local por tarefa, no ramo `biblioteca`.
- **Antes de cada commit:** `node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos <lista privada>` sai `0`,
  e `node _fabrica/core/conferir-caminhos.js` também.
- **Nenhum dado, nome, cor ou texto de empresa real** nas telas, nos testes ou nos exemplos. Só empresas fictícias.
- **Texto ao usuário final** em português simples; nunca "gaveta", "disposição", "índice" ou "legado".
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit.
- **Cores e letras das telas** vêm da marca da empresa escolhida (`marca.yaml`), com a marca de exemplo como padrão.

## Foco da revisão

1. **Troca de empresa no seletor com um pedido em andamento:** a resposta de um pedido de uma empresa nunca é
   gravada na outra. Toda rota recebe a empresa e a confere contra a lista.
2. **`empresa=` com `../`, código inexistente ou vazio:** erro claro, nunca lê nem grava fora de `empresas/`.
3. **Aprovar uma peça da empresa A com o seletor em B:** recusado.
4. **Cronograma para o cliente com termo de outra empresa em algum post:** o envio para e mostra o termo; nenhum
   arquivo é gerado.
5. **Pasta antiga com uma segunda empresa criada:** os arquivos da pasta antiga ficam idênticos, byte a byte.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `_fabrica/core/empresa.js` (+ teste) | chave `publicacoes` em `caminhos` |
| `_fabrica/paineis/dados.js`, `registrar.js`, `instalar.js` (+ testes) | tudo por empresa |
| `_fabrica/paineis/servidor.js` (+ teste) | rotas por empresa, `/api/empresas`, envio ao cliente |
| `_fabrica/paineis/laboratorio.html` (novo) | tela do Laboratório com seletor |
| `_fabrica/paineis/cronograma.html` (novo) | tela do Cronograma com seletor e botão "Enviar ao cliente" |
| `_fabrica/paineis/enviar-cliente.js` (+ teste) (novo) | gera o arquivo do cliente a partir de uma empresa |
| `_fabrica/paineis/modelos/*` | atalhos e COMO-ACESSAR |
| `_fabrica/propriedade.json`, `isentos.json` | entradas dos arquivos novos |

---

### Tarefa 1: trazer o ramo `paineis` para o `biblioteca`

**Decisão a confirmar:** o ramo `paineis` tem 4 commits (dados e servidor) feitos a partir da mesma base do
`biblioteca`. Como `git merge` é proibido, a entrada é por `git cherry-pick` dos 4 commits, em ordem, no ramo
`biblioteca`. Se o `cherry-pick` não for aceito, a alternativa é copiar os arquivos de `_fabrica/paineis/` e
refazer os 4 commits à mão.

**Arquivos:** os do ramo `paineis` (`_fabrica/paineis/**`, `_fabrica/propriedade.json`,
`08-FERRAMENTAS/validador-anti-vazamento/isentos.json`, `LEIA-ME.md` do validador, `Abrir Laboratório de Design.*`).

- [ ] **Passo 1:** `git cherry-pick b5eec1f 7296bd9 52eb3c8 c3cc039`. Os conflitos esperados são `propriedade.json`,
  `isentos.json` e o `LEIA-ME.md` do validador. Resolver mantendo as duas entradas. Nunca `--strategy` que escolha um
  lado.
- [ ] **Passo 2:** rodar os três testes de `_fabrica/paineis/testes/` e toda a bateria (`git ls-files '*.test.js'`).
  Todos saem 0.
- [ ] **Passo 3:** validador e `conferir-caminhos.js` saem 0. Commit só se algo foi resolvido à mão.

---

### Tarefa 2: o código dos painéis fala por empresa

**Arquivos:** `_fabrica/core/empresa.js`, `_fabrica/paineis/dados.js`, `registrar.js`, `instalar.js`, `servidor.js` e
os testes.

**Interfaces produzidas:**
- `empresa.caminhos(c).publicacoes`: pasta das peças aprovadas. Na pasta antiga, `02-PUBLICACOES`. Na gaveta,
  `<gaveta>/publicacoes`.
- `dados.caminhos(r, codigo)`: devolve `pecas`, `aprovacoes`, `posts`, `config` pelo `laboratorio` e `cronograma` da
  empresa. Sem `codigo`, usa a empresa ativa. Nenhum caminho fixo sobra.
- Servidor:
  - toda rota de dados aceita `?empresa=<codigo>`; sem o parâmetro, vale a ativa;
  - `GET /api/empresas` devolve `{ ativa, empresas: [{ codigo, nome }] }` (sem a disposição);
  - `POST /api/aprovar` e `/api/desfazer` recebem `empresa` no corpo e recusam se a peça não for da empresa;
  - `pastaSegura` passa a aceitar `<publicacoes>/…` e `<saidas>/<linha>/…` da empresa do pedido;
  - `/api/empresa` e `/api/quem` mostram o nome da empresa do pedido;
  - o seletor **não** altera `ativa.json`: a empresa do painel vive só no navegador (decisão do desenho, seção 9).
- `registrar.js` ganha `--empresa <codigo>`; sem ele, a ativa.

**Testes (falham antes):**
- raiz temporária com `aurora` e `boreal`: dados de cada uma separados; `?empresa=aurora` não vê posts da `boreal`;
- `empresa=../x`, vazio e inexistente: erro claro, nada lido nem gravado fora de `empresas/`;
- aprovar peça da `aurora` com `empresa=boreal`: recusado, arquivos intactos;
- pasta antiga: caminhos iguais aos de hoje, byte a byte.

- [ ] **Passos:** testes primeiro (ver falhar), implementar, rodar tudo, validador, commit
  "Painéis por empresa, item 2: dados, servidor e registro resolvem tudo pela empresa".

---

### Tarefa 3: tela do Laboratório com seletor

**Arquivo:** `_fabrica/paineis/laboratorio.html` (novo).

**Comportamento** (referência: o painel de laboratório da pasta de referência, só leitura):
- lista das peças da empresa, com prévia, estado (aprovada ou não) e botões "Aprovar design" e "Desfazer";
- seletor de empresa no alto, só visível com duas ou mais empresas ("Empresa: Clínica X ▾"); a escolha fica no
  navegador (`sessionStorage`, com `try/catch`: só na sessão do navegador) e vai em todo pedido;
- cores e letras da empresa escolhida (marca; exemplo se não houver);
- aviso claro quando a empresa do painel for diferente da ativa do agente: "O agente está trabalhando em
  <outra>. Peça a troca no Claude se quiser que ele atenda esta empresa.";
- estados vazios (nenhuma peça, nenhuma empresa) em português simples; funciona em 400 px de largura.

**Testes:** o servidor entrega a página; um teste de contrato lê o HTML e confere as rotas e o envio do parâmetro
`empresa` em cada `fetch`; prova visual: quadros em duas empresas fictícias, abertos para o responsável olhar.

- [ ] **Passos:** escrever a tela, teste de contrato, prova visual, validador, commit.

---

### Tarefa 4: tela do Cronograma e envio ao cliente

**Arquivos:** `_fabrica/paineis/cronograma.html`, `_fabrica/paineis/enviar-cliente.js` e teste.

**Comportamento do Cronograma:** calendário e lista de posts da empresa (data, plataforma, estado, peça ligada), com o
mesmo seletor e o mesmo aviso da Tarefa 3.

**Envio ao cliente:**
- botão "Enviar ao cliente" gera `<gaveta>/envios/cronograma-<empresa>-<data>.html` (na pasta antiga, em
  `empresas/principal/envios/`), um arquivo único, com os posts só daquela empresa e as cores dela;
- o arquivo é **montado a partir da lista de posts da empresa**, nunca filtrado de uma página com todas;
- antes de liberar, roda `validar.js --empresa <codigo>` sobre os posts; saída 1 para o envio, mostra o termo e a
  empresa dona em linguagem simples e não gera nenhum arquivo;
- a tela mostra o link do arquivo gerado e diz onde ele está.

**Testes:** o arquivo gerado para a `aurora` não contém nenhum termo da `boreal`; com um termo da `boreal` num post da
`aurora`, nenhum arquivo é gerado e a mensagem cita o termo; a pasta antiga continua intacta.

- [ ] **Passos:** testes primeiro, implementar, prova visual do arquivo gerado, validador, commit.

---

### Tarefa 5: atalhos, documentação e fechamento

- [ ] **Passo 1:** `modelos/COMO-ACESSAR-*.md` e os atalhos "Abrir Laboratório de Design" passam a falar do seletor de
  empresa (texto para o usuário final).
- [ ] **Passo 2:** `CORE.md`: subseção "Empresas" cita os painéis e o envio; `conferir-caminhos.js` limpo.
- [ ] **Passo 3:** `propriedade.json` (`_fabrica/paineis/` é do modelo; `empresas/*/envios/` é da empresa) e
  `isentos.json` dos arquivos novos.
- [ ] **Passo 4:** bateria completa, validador, `conferir-caminhos.js`, commit.

## Fora desta etapa

Prévias base e biblioteca de estilos (etapas 4 e 5), vídeo na marca (6 e 7), caminho do usuário (8), migração (9), e
mover a pasta de trabalho do Reels para dentro da execução (adiado desde a etapa 2).
