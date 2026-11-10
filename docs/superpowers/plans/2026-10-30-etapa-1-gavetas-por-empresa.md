# Etapa 1: gavetas por empresa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** cada empresa passa a ter uma gaveta própria (`empresas/<codigo>/`). A marca é lida da empresa ativa, a
pasta que já existe continua funcionando sem nenhum arquivo movido, e o validador reprova o conteúdo de uma empresa
que contenha termos de outra.

**Arquitetura:**
- Um módulo novo, `_fabrica/core/empresa.js`, é o único que sabe onde ficam os dados de cada empresa. Ele lida com as
  duas disposições: gaveta e legado.
- O `08-FERRAMENTAS/marca/marca.js` passa a perguntar a ele qual `marca.yaml` carregar. Como as ferramentas já leem a
  marca por esse módulo, quase todas herdam a mudança sem alteração.
- O validador ganha o modo `--empresa`, que confere só os termos das outras empresas.

**Tecnologia:** Node (só módulos nativos), com testes em scripts `node` usando `assert` e a saída `ok <caso>`, no padrão
do `marca.test.js`. Cada caso é calibrado para reprovar (G-13).

**Desenho:** `docs/superpowers/specs/2026-10-30-biblioteca-de-estilos-e-empresas-design.md`, seções 6.1 a 6.5.

## Restrições globais

- **Nunca mover, apagar nem sobrescrever** dados que já existam: `06-MARCA-E-FOTOS/marca.yaml`,
  `_fabrica/_memoria/empresa.md`, saídas, memória, decisões e linhas próprias. Os testes conferem isso byte a byte.
- **Git:** sem `git push`, `pull`, `merge` ou `reset`. Commit local por tarefa, no ramo `biblioteca`.
- **Antes de cada commit:** rodar
  `node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos <lista privada>`, que precisa sair `0`.
- **Idioma:** mensagens, comentários e nomes de função em português do Brasil, como no resto da matriz.
- **Fim de linha:** a matriz mistura LF e CRLF. Editar com Edit e nunca trocar texto de várias linhas por script.
- **Código de empresa:** `/^[a-z0-9][a-z0-9-]{1,40}$/`. A empresa legado tem o código fixo `principal`.
- **Raiz da Fábrica:** `process.env.FABRICA_RAIZ || path.resolve(__dirname, '..', '..')`. É o mesmo padrão de
  `_fabrica/paineis/dados.js`, e os testes usam pastas temporárias com `FABRICA_RAIZ`.
- **Nenhuma dependência nova.**

## Foco da revisão

1. **`empresas/indice.json` com JSON quebrado** (editado à mão): o erro tem código `JSON_INVALIDO` e uma mensagem que
   diz o arquivo. Nada é regravado por cima. Teste na Tarefa 1.
2. **`ativa.json` ou `FABRICA_EMPRESA` apontando para uma empresa que não existe** (apagada ou com erro de digitação):
   o sistema recusa com `EMPRESA_DESCONHECIDA` e nunca cai em outra empresa sem avisar. Teste na Tarefa 1.
3. **Código com acento, espaço ou maiúscula** (`Clínica Bela Vista`): `criar` recusa e sugere `clinica-bela-vista`. Teste na
   Tarefa 1.
4. **Pasta antiga com uma segunda empresa criada:** os arquivos antigos continuam idênticos byte a byte, e a marca da
   empresa `principal` continua sendo `06-MARCA-E-FOTOS/marca.yaml`. Teste na Tarefa 4.
5. **Duas empresas e nenhuma escolhida:** qualquer ferramenta que carregue a marca para com uma mensagem clara, em vez
   de usar a marca errada. Teste na Tarefa 2.

---

## Mapa de arquivos

| Arquivo | O que muda |
|---|---|
| `08-FERRAMENTAS/marca/yaml.js` (novo) | o leitor de YAML mínimo, tirado do `marca.js`, para o `empresa.js` usar sem carregar a marca |
| `_fabrica/core/empresa.js` (novo) | o leitor de caminhos e da empresa ativa, mais a linha de comando |
| `_fabrica/core/empresa.test.js` (novo) | testes do leitor |
| `08-FERRAMENTAS/marca/marca.js` | ordem de busca pela empresa ativa, base dos caminhos na gaveta e `PASTA` exportada |
| `08-FERRAMENTAS/marca/marca.test.js` | casos novos |
| `08-FERRAMENTAS/tesseract/projetos/montar-video.js:14` | a pasta de peças sai de `marca.PASTA` |
| `08-FERRAMENTAS/validador-anti-vazamento/validar.js` | exporta as funções e ganha `--empresa` |
| `08-FERRAMENTAS/validador-anti-vazamento/validar.test.js` (novo) | testes do modo `--empresa` |
| `08-FERRAMENTAS/validador-anti-vazamento/LEIA-ME.md` | documenta o modo novo |
| `_fabrica/core/isolamento.test.js` (novo) | teste de ponta a ponta com duas empresas fictícias e uma pasta antiga |
| `_fabrica/propriedade.json` | `empresas/` entra em `protegidos` |
| `08-FERRAMENTAS/validador-anti-vazamento/isentos.json` | isenções dos arquivos de teste, se houver |

---

### Tarefa 1: o leitor de empresas (`empresa.js`)

**Arquivos:**
- Criar: `08-FERRAMENTAS/marca/yaml.js`, `_fabrica/core/empresa.js` e `_fabrica/core/empresa.test.js`.
- Alterar:
  - `08-FERRAMENTAS/marca/marca.js`: troca a definição local de `lerYaml` e das funções auxiliares por
    `require('./yaml')`, e reexporta `lerYaml`;
  - `_fabrica/propriedade.json`: acrescenta `"empresas/"` em `protegidos`.

**Interfaces:**

Produz:
- `yaml.js`: `lerYaml(texto: string) -> object`. É o mesmo comportamento de hoje, movido.
- `empresa.js` (todas as funções aceitam `r` opcional, a raiz; o padrão é a raiz da Fábrica):
  - `raiz() -> string`
  - `listar(r?) -> Array<{ codigo, nome, disposicao: 'gaveta'|'legado', criada?: 'AAAA-MM-DD', virtual?: true }>`
  - `ativa(r?) -> string|null`
  - `caminhos(codigo, r?) -> objeto`, com caminhos absolutos:
    - as chaves `gaveta`, `perfil`, `marca`, `pastaMarca`, `estiloDeVideo`, `estilosProprios`, `referencias`,
      `laboratorio`, `cronograma`, `decisoes`, `estilo`, `intencao`, `pedidos`, `historico`, `termos`,
      `termosCompartilhados` e `previas`;
    - as funções por linha `saidas(linha)`, `memoria(linha)`, `dadosLinha(linha)`, `estadoLinha(linha)` e
      `investigacoes(linha)`.
  - `criar(codigo, nome, r?) -> { codigo, nome, disposicao: 'gaveta', criada }`
  - `ativar(codigo, r?) -> void`
  - `termos(codigo, r?) -> string[]`
  - Erros com `err.code`: `JSON_INVALIDO`, `EMPRESA_NAO_ESCOLHIDA`, `EMPRESA_DESCONHECIDA`, `CODIGO_INVALIDO` e
    `EMPRESA_EXISTE`.

Regras que o código precisa seguir (o desenho decide, e os testes fixam):
- **Arquivos de controle:**
  - `empresas/indice.json` tem o formato `{ "empresas": [ { "codigo", "nome", "disposicao", "criada" } ] }`;
  - `empresas/ativa.json` tem o formato `{ "empresa": "<codigo>" }`.
- **Legado virtual:** sem `indice.json`, a pasta tem uma empresa legado virtual quando existe
  `06-MARCA-E-FOTOS/marca.yaml`, ou quando existe `_fabrica/_memoria/empresa.md` sem o marcador
  `<!-- NÃO CONFIGURADO -->`.
  - Ela se chama `{ codigo: 'principal', disposicao: 'legado', virtual: true }`.
  - O nome vem de `empresa.nome` do `marca.yaml`, ou é "Sua empresa".
  - Nada é gravado só por listar.
- **`ativa()`, nesta ordem:**
  1. `FABRICA_EMPRESA`;
  2. `ativa.json`;
  3. a única empresa;
  4. `null` sem nenhuma empresa.

  Com mais de uma empresa e nenhuma escolhida, lança `EMPRESA_NAO_ESCOLHIDA`. Se o código não está na lista, lança
  `EMPRESA_DESCONHECIDA`.
- **Caminhos da disposição legado:**
  - `perfil`: `_fabrica/_memoria/empresa.md`;
  - `marca`: `06-MARCA-E-FOTOS/marca.yaml`;
  - `pastaMarca`: `06-MARCA-E-FOTOS`;
  - `estiloDeVideo`: `06-MARCA-E-FOTOS/estilo-de-video.md`;
  - `estilosProprios`: `06-MARCA-E-FOTOS/estilos-proprios`;
  - `referencias`: `04-LABORATORIO-DE-DESIGN/referencias`;
  - `laboratorio`: `04-LABORATORIO-DE-DESIGN/dados`;
  - `cronograma`: `03-CRONOGRAMA/dados`;
  - por linha: `linhas/<l>/saida`, `linhas/<l>/memoria`, `linhas/<l>/dados`, `linhas/<l>/estado.json` e
    `linhas/<l>/_investigacoes`.
- **Caminhos da disposição gaveta** (`G = empresas/<codigo>`):
  - `perfil`: `G/empresa.md`;
  - `marca`: `G/marca.yaml`;
  - `pastaMarca`: `G`;
  - `estiloDeVideo`: `G/estilo-de-video.md`;
  - `estilosProprios`: `G/estilos-proprios`;
  - `referencias`: `G/referencias`;
  - `laboratorio`: `G/laboratorio/dados`;
  - `cronograma`: `G/cronograma/dados`;
  - por linha: `G/saidas/<l>`, `G/memoria/<l>`, `G/linhas/<l>/dados`, `G/estado/<l>.json` e `G/investigacoes/<l>`.
- **Comuns às duas disposições,** sempre em `G` (para o legado, `G = empresas/principal`): `estilo.json`,
  `intencao.json`, `pedidos/`, `historico/`, `decisoes.md`, `termos.txt`, `termos-compartilhados.txt` e `previas/`.
  `caminhos` só calcula. Não cria pasta nenhuma.
- **`criar`:**
  - valida o código e o nome (não vazio);
  - recusa um código repetido, inclusive `principal`;
  - se houver legado virtual, primeiro grava o legado no `indice.json` como entrada real, sem `virtual`;
  - cria só a pasta `empresas/<codigo>/` e acrescenta a entrada no índice;
  - nunca escreve fora de `empresas/`.
- **`termos(codigo)`:**
  - lê do `marca.yaml` da empresa: `empresa.nome` e `empresa.handle`, este sem `@`;
  - lê do `perfil`: as linhas `**Nome:**` e `**Site:**` (do site, só o domínio, sem `https://` e sem `www.`);
  - junta as linhas do `termos.txt` (ignorando vazias e as que começam com `//`);
  - tira os repetidos e os vazios.
- **JSON quebrado** em `indice.json` ou `ativa.json`: lança `JSON_INVALIDO`, e nada é gravado.
- **Linha de comando:**
  - comandos: `node _fabrica/core/empresa.js listar | ativa | ativar <c> | criar <c> "<nome>" | caminhos [<c>]`;
  - mensagens em português;
  - saída `0` quando dá certo, `1` para recusa (código inválido, empresa não escolhida, desconhecida ou existente) e
    `2` para erro de uso.

- [ ] **Passo 1: escrever os testes que falham em `_fabrica/core/empresa.test.js`**

  Cada caso monta uma raiz temporária e chama o módulo com `r` explícito, ou com `FABRICA_RAIZ` num processo filho
  para a linha de comando.

  | Caso | O que confere |
  |---|---|
  | `pasta nova: nenhuma empresa` | `listar(r)` igual a `[]`; `ativa(r) === null` |
  | `legado virtual` | raiz com `06-MARCA-E-FOTOS/marca.yaml` (`empresa.nome: "Clínica Teste"`) → `listar(r)` igual a `[{ codigo: 'principal', nome: 'Clínica Teste', disposicao: 'legado', virtual: true }]`; `ativa(r) === 'principal'`; `fs.existsSync(path.join(r, 'empresas')) === false` |
  | `perfil não configurado não conta` | só o `empresa.md` com `<!-- NÃO CONFIGURADO -->` → `listar(r)` igual a `[]` |
  | `caminhos do legado` | `caminhos('principal', r).marca === path.join(r, '06-MARCA-E-FOTOS', 'marca.yaml')`; `.saidas('reels') === path.join(r, 'linhas', 'reels', 'saida')`; `.estilo === path.join(r, 'empresas', 'principal', 'estilo.json')` |
  | `criar gaveta preserva o legado` | grava o hash de todos os arquivos da raiz; `criar('aurora', 'Aurora Nutrição', r)`; os hashes dos arquivos antigos são iguais; `indice.json` tem `principal` (legado, sem `virtual`) e `aurora` (gaveta); `caminhos('aurora', r).marca === path.join(r, 'empresas', 'aurora', 'marca.yaml')` |
  | `duas empresas sem escolha recusa` | depois do caso anterior, sem `ativa.json` → `ativa(r)` lança `code === 'EMPRESA_NAO_ESCOLHIDA'` |
  | `ativar e ativa` | `ativar('aurora', r)` → `ativa(r) === 'aurora'`; com `FABRICA_EMPRESA=principal` no processo filho, o CLI `ativa` imprime `principal` |
  | `ativa desconhecida recusa` | `ativa.json` com `{ "empresa": "apagada" }` → `code === 'EMPRESA_DESCONHECIDA'`; o mesmo com `FABRICA_EMPRESA=xyz` |
  | `código inválido sugere` | `criar('Clínica Bela Vista', 'x', r)` lança `CODIGO_INVALIDO`, com a mensagem contendo `clinica-bela-vista` |
  | `código repetido recusa` | `criar('aurora', …)` de novo e `criar('principal', …)` lançam `EMPRESA_EXISTE` |
  | `JSON quebrado não é regravado` | `indice.json` com `{"empresas": [` → `listar(r)` lança `JSON_INVALIDO`, e o arquivo continua byte a byte igual |
  | `termos` | gaveta com `marca.yaml` (`empresa.nome: "Aurora Nutrição"`, `handle: "@aurora.nutri"`), `empresa.md` com `**Site:** https://www.aurora-nutri.com.br/` e `termos.txt` com `// comentário` e `Dra. Aurora` → `termos('aurora', r)` igual a `['Aurora Nutrição', 'aurora.nutri', 'aurora-nutri.com.br', 'Dra. Aurora']` |
  | `CLI` | `listar` sai `0` e lista os códigos; `criar Ruim "x"` sai `1`; um comando desconhecido sai `2` |

- [ ] **Passo 2: rodar e ver falhar.** Comando: `node _fabrica/core/empresa.test.js`. O esperado é falhar com
  `Cannot find module` do `empresa.js`.

- [ ] **Passo 3: tirar o `lerYaml` do `marca.js` para o `08-FERRAMENTAS/marca/yaml.js`,** com as funções auxiliares
  (`tiraComentario`, `escalar`, `partesNoNivel`, `chaveValor`, `lerYaml`). O `marca.js` passa a usar
  `require('./yaml')` e continua exportando `lerYaml`. Rodar `node 08-FERRAMENTAS/marca/marca.test.js`: todos os casos
  antigos passam.

- [ ] **Passo 4: implementar `_fabrica/core/empresa.js`** com as funções e regras acima.
  - **Leitura de JSON:** no padrão do `lerJson` de `_fabrica/paineis/dados.js` (ramo `paineis`). Arquivo ausente
    devolve o padrão; JSON quebrado lança `JSON_INVALIDO`.
  - **Gravação:** em arquivo temporário, depois renomeado, para não deixar um índice pela metade.
  - **Sugestão de código:** sem acento, em minúsculas, com espaço virando `-`.

- [ ] **Passo 5: rodar e ver passar.** Comando: `node _fabrica/core/empresa.test.js`. O esperado é um `ok` por caso e
  saída `0`.

- [ ] **Passo 6: acrescentar `"empresas/"` em `protegidos` do `_fabrica/propriedade.json`** (com Edit) e rodar
  `node _fabrica/core/atualizar.js verificar --origem . --raiz <pasta temporária com empresas/x/marca.yaml>`. O esperado
  é que nenhum caminho de `empresas/` apareça nas listas de troca.

- [ ] **Passo 7: rodar o validador e fazer o commit.**
  ```bash
  node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos "<lista privada>"
  git add 08-FERRAMENTAS/marca/yaml.js 08-FERRAMENTAS/marca/marca.js _fabrica/core/empresa.js _fabrica/core/empresa.test.js _fabrica/propriedade.json
  git commit -m "Empresas, item 1: leitor de empresas com gaveta e legado (nada é movido)"
  ```
  Se o validador acusar `hex` ou `handle` nos testes, acrescentar no `isentos.json`, no mesmo commit, só as categorias
  acusadas para esses arquivos de teste.

---

### Tarefa 2: a marca vem da empresa ativa

**Arquivos:**
- Alterar:
  - `08-FERRAMENTAS/marca/marca.js`: `localizar()`, `caminho()` e exportações;
  - `08-FERRAMENTAS/tesseract/projetos/montar-video.js:14`.
- Teste: `08-FERRAMENTAS/marca/marca.test.js`, com casos novos.

**Interfaces:**
- Consome: `empresa.ativa(r)` e `empresa.caminhos(codigo, r)` (Tarefa 1).
  - O `marca.js` requer o `empresa.js` pelo próprio código (`path.join(__dirname, '..', '..', '_fabrica', 'core',
    'empresa.js')`).
  - Ele passa `r = process.env.FABRICA_RAIZ || RAIZ`, a raiz dos dados.
  - A exportação `RAIZ` continua sendo a raiz do código, sem mudança. O `molde.js` usa `RAIZ` para achar os layouts e
    as texturas.
  - O exemplo continua sendo lido da raiz do código.
  - O legado (`06-MARCA-E-FOTOS/marca.yaml`) é procurado na raiz dos dados.
- Produz:
  - `marca.EMPRESA`: o código da empresa ativa, ou `null` com a marca de exemplo ou com `FABRICA_MARCA`;
  - `marca.PASTA`: pasta-base dos arquivos da marca. É a gaveta, ou `06-MARCA-E-FOTOS` no legado e no exemplo;
  - `marca.caminho(rel)`, com a regra nova abaixo.

**Regras:**
- **Ordem de busca:**
  1. `FABRICA_MARCA`;
  2. o `marca.yaml` da empresa ativa, se existir;
  3. o `06-MARCA-E-FOTOS/marca.yaml` (é o mesmo do legado);
  4. o exemplo.
- **`EMPRESA_NAO_ESCOLHIDA` ou `EMPRESA_DESCONHECIDA` vindo de `ativa()`:** o `marca.js` lança um erro com a mensagem
  "Há mais de uma empresa nesta Fábrica e nenhuma está escolhida. Rode: node _fabrica/core/empresa.js ativar
  <codigo>", ou o equivalente para a desconhecida. Ele não cai no exemplo.
- **`caminho(rel)`:**
  - caminho absoluto: devolve como está;
  - caminho relativo, com marca de gaveta: tenta `path.join(gaveta, rel)`, depois `path.join(raizDosDados, rel)` e,
    por último, `path.join(RAIZ, rel)`. Fica o primeiro que existir; se nenhum existir, vale o da gaveta;
  - nos outros casos: `path.join(raizDosDados, rel)` se existir; senão, `path.join(RAIZ, rel)`, como hoje. Sem
    `FABRICA_RAIZ` as duas raízes são a mesma.
- **`montar-video.js:14`:** `PASTAS_PECAS = [path.join(marca.PASTA, 'pecas'), path.join(__dirname, '..', 'assets')]`.

- [ ] **Passo 1: escrever os casos que falham no `marca.test.js`.**
  - Um auxiliar novo, `comRaiz(montar, codigo)`, monta uma raiz temporária de dados (só `empresas/` e
    `06-MARCA-E-FOTOS/`, conforme o caso) e roda o trecho com `FABRICA_RAIZ` apontando para ela e sem `FABRICA_MARCA`.
    O código continua sendo o da matriz.

  | Caso | O que confere |
  |---|---|
  | `marca da gaveta ativa` | empresa `aurora` com `cores.acento: "#2FB59A"` e `ativa.json` igual a `aurora` → `m.hex('acento') === '#2FB59A'`; `m.EMPRESA === 'aurora'`; `m.PASTA` termina em `empresas/aurora` |
  | `legado continua` | só `06-MARCA-E-FOTOS/marca.yaml` (acento `#CC3300`) → `m.hex('acento') === '#CC3300'`; `m.EMPRESA === 'principal'` |
  | `duas sem escolha para` | legado mais `aurora`, sem `ativa.json` → o processo sai com erro, e o stderr contém `nenhuma está escolhida` |
  | `caminho relativo à gaveta` | `aurora/fontes/x.ttf` existe → `m.caminho('fontes/x.ttf')` termina em `empresas/aurora/fontes/x.ttf`; `m.caminho('06-MARCA-E-FOTOS/exemplo/fontes/Fraunces.ttf')` cai na raiz |
  | `FABRICA_MARCA manda` | com `FABRICA_MARCA` apontando para outro arquivo, ele vence a empresa ativa |

- [ ] **Passo 2: rodar e ver falhar.** Comando: `node 08-FERRAMENTAS/marca/marca.test.js`. Os casos novos falham.

- [ ] **Passo 3: implementar as regras no `marca.js`** e trocar a linha 14 do `montar-video.js`.

- [ ] **Passo 4: rodar e ver passar.**
  - `node 08-FERRAMENTAS/marca/marca.test.js`: todos `ok`.
  - Também passam sem mudança: `node 08-FERRAMENTAS/carrossel/molde.test.js`, `node 08-FERRAMENTAS/carrossel/gerar.test.js`
    e `node _fabrica/core/validar-carrossel.test.js`.

- [ ] **Passo 5: rodar o validador e fazer o commit.** Mensagem: "Empresas, item 2: a marca vem da empresa ativa;
  legado e exemplo continuam".

---

### Tarefa 3: validador com `--empresa`

**Arquivos:**
- Alterar:
  - `08-FERRAMENTAS/validador-anti-vazamento/validar.js`;
  - `08-FERRAMENTAS/validador-anti-vazamento/LEIA-ME.md`.
- Criar: `08-FERRAMENTAS/validador-anti-vazamento/validar.test.js`.

**Interfaces:**
- Consome: `empresa.listar(r)`, `empresa.caminhos(codigo, r)` e `empresa.termos(codigo, r)` (Tarefa 1).
- Produz:
  - linha de comando: `node validar.js --empresa <codigo> [pasta] [--raiz <raiz da Fábrica>]`;
  - módulo: `module.exports = { compilarTermo, verificarArquivo, listarArquivos }`, com `main()` só quando
    `require.main === module`;
  - `compilarTermo(linha: string) -> { texto, regex } | null` sai de dentro do `carregarTermos`, para os termos que
    chegam em memória;
  - `verificarArquivo(arquivo, raiz, termos, isentos, { soTermos = false } = {})`.

**Regras do modo `--empresa`:**
- **O que confere:** sem `pasta`, as pastas de dados da empresa, sem repetir as que não existem:
  - as `saidas(l)` de cada linha em `linhas/`;
  - `laboratorio`, `cronograma`, `pedidos` e `perfil`.

  Com `pasta`, só ela, porque é assim que se confere uma peça antes da entrega.
- **Termos:** junta os `empresa.termos(outra)` de todas as outras empresas e tira os que estão no
  `termosCompartilhados` da empresa conferida (comparação sem acento e sem diferença de maiúscula).
- **Só termos:** usa `soTermos: true`, então as checagens genéricas (`hex`, `fonte` e as outras) ficam desligadas. Os
  isentos não se aplicam.
- **Mensagens:**
  - cabeçalho: `CONFERÊNCIA ENTRE EMPRESAS · <nome> (<codigo>)`;
  - cada achado diz de qual empresa o termo é;
  - resultado: `RESULTADO: nada de outra empresa.` ou `RESULTADO: N termo(s) de outra empresa. Não entregue.`
- **Saídas:**
  - `0` quando está limpo e `1` quando há achado;
  - `2` para erro de uso ou empresa desconhecida;
  - com uma empresa só, sai `0` e imprime `Só há uma empresa: nada a cruzar.`
- **O modo de sempre** (sem `--empresa`) não muda.

- [ ] **Passo 1: escrever os testes que falham em `validar.test.js`.**
  - A raiz temporária tem `aurora` (gaveta, nome "Aurora Nutrição", handle `@aurora.nutri`) e `boreal` (gaveta, nome
    "Boreal Advocacia").
  - A saída de `aurora` fica em `empresas/aurora/saidas/carrossel/lamina-1.html`.

  | Caso | O que confere |
  |---|---|
  | `limpo` | a lâmina fala só de Aurora → `--empresa aurora --raiz <r>` sai `0` |
  | `termo de outra reprova` | a lâmina contém `Boreal Advocacia` → sai `1`; a saída contém `Boreal Advocacia` e `boreal` |
  | `genéricas desligadas` | a lâmina contém `#2FB59A` e `Fraunces` → sai `0` |
  | `compartilhado não reprova` | as duas citam "Florianópolis" (`termos.txt` da `boreal` tem `Florianópolis`), e o `termos-compartilhados.txt` da `aurora` também → sai `0`. Sem o arquivo de compartilhados → sai `1` |
  | `pasta específica` | `--empresa aurora <r>/empresas/aurora/saidas/carrossel` confere só essa pasta |
  | `uma empresa só` | raiz só com `aurora` → sai `0`, com a mensagem `nada a cruzar` |
  | `empresa desconhecida` | `--empresa xyz` → sai `2` |
  | `modo antigo intacto` | `validar.js <pasta com "#123456">` sem `--empresa` → sai `1`, com `[hex]` |

- [ ] **Passo 2: rodar e ver falhar.** Comando: `node 08-FERRAMENTAS/validador-anti-vazamento/validar.test.js`.

- [ ] **Passo 3: implementar** `compilarTermo`, `soTermos`, `--empresa`/`--raiz`, as exportações e o `require.main`.
  O `carregarTermos` passa a usar `compilarTermo` por linha, sem mudar o comportamento.

- [ ] **Passo 4: rodar e ver passar.**
  - O teste novo: todos `ok`.
  - O validador da matriz inteira, com a lista privada: sai `0` como antes.

- [ ] **Passo 5: documentar no `LEIA-ME.md` do validador**, com Edit: uma seção "Conferência entre empresas" com o
  comando, o que confere, os termos compartilhados e os códigos de saída. Mesmo tom das seções que já existem.

- [ ] **Passo 6: rodar o validador e fazer o commit.** Mensagem: "Empresas, item 3: validador confere termos de outras
  empresas (--empresa)".

---

### Tarefa 4: prova de isolamento de ponta a ponta

**Arquivos:**
- Criar: `_fabrica/core/isolamento.test.js`.
- Alterar: `CORE.md`, na seção que descreve onde ficam os dados da empresa. Um parágrafo curto sobre `empresas/`, as
  duas disposições e o comando `empresa.js`. Quem não cria empresa nenhuma continua igual.

**Interfaces:**
- Consome: a linha de comando do `empresa.js` (Tarefa 1), o `marca.js` (Tarefa 2) e o `validar.js --empresa`
  (Tarefa 3). Tudo por processo filho, com `FABRICA_RAIZ`.

- [ ] **Passo 1: escrever o teste.** A raiz temporária imita uma pasta antiga real:
  - `06-MARCA-E-FOTOS/marca.yaml` (nome "Empresa Antiga", acento `#CC3300`);
  - `_fabrica/_memoria/empresa.md` configurado;
  - `linhas/reels/saida/peca.md`;
  - `linhas/reels/memoria/memories.md`.

  | Caso | O que confere |
  |---|---|
  | `pasta antiga intacta` | grava os hashes de tudo; `empresa.js criar aurora "Aurora Nutrição"` e `ativar aurora` saem `0`; os hashes de todo arquivo fora de `empresas/` são iguais |
  | `cada empresa com a sua marca` | com `ativa = aurora` (acento `#2FB59A` na gaveta), um processo filho que carrega o `marca.js` imprime `#2FB59A`; depois de `ativar principal`, imprime `#CC3300` |
  | `vazamento pego` | `empresas/aurora/saidas/reels/roteiro.md` contendo "Empresa Antiga" → `validar.js --empresa aurora` sai `1`; o mesmo arquivo sem o termo → sai `0` |
  | `duas sem escolha param` | sem `ativa.json`, o `marca.js` sai com erro, e o `empresa.js ativa` sai `1` |

- [ ] **Passo 2: rodar.** Comando: `node _fabrica/core/isolamento.test.js`. O esperado é todos `ok`. Como as tarefas 1 a
  3 já existem, o teste deve passar de primeira. Se algum caso falhar, corrigir a tarefa de origem antes de seguir.

- [ ] **Passo 3: calibrar o teste (G-13).**
  - Comentar temporariamente a recusa de `EMPRESA_NAO_ESCOLHIDA` no `empresa.js`: o caso `duas sem escolha param`
    precisa falhar.
  - Desfazer e confirmar que volta a passar.

- [ ] **Passo 4: rodar todos os testes da etapa.**
  ```bash
  node _fabrica/core/empresa.test.js && node 08-FERRAMENTAS/marca/marca.test.js && node 08-FERRAMENTAS/validador-anti-vazamento/validar.test.js && node _fabrica/core/isolamento.test.js && node 08-FERRAMENTAS/carrossel/molde.test.js
  ```
  O esperado é que todos saiam `0`.

- [ ] **Passo 5: rodar o validador e fazer o commit.** Mensagem: "Empresas, item 4: prova de isolamento entre empresas
  e pasta antiga intacta".

---

## O que fica para as próximas etapas (fora deste plano)

- **Etapa 2:** textos de instrução (runner, Arquiteto, `/fabrica` e passos da linha de Reels) falando da empresa ativa,
  e os comandos de empresa na `/fabrica`.
- **Etapa 3:** os painéis por empresa, junto com o ramo `paineis`: `dados.js` recebendo a empresa, seletor e envio ao
  cliente.
- **Etapas 4 a 9:** prévias, biblioteca, vídeo na marca, prévias na marca, caminho do usuário e migração opcional,
  conforme o desenho.
