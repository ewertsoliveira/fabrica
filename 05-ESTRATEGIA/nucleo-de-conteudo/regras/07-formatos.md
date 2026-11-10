# 07 — Formatos

Regras de formato válidas para qualquer empresa. A numeração segue a do Núcleo
de origem: aqui estão as regras de post e carrossel (F-22 a F-30, F-53 e F-54)
e as de roteiro de vídeo em duas peças (F-49 a F-52); as demais regras de
formato ainda não foram exportadas para cá. Dimensões de canvas e chamadas
literais vêm do `marca.yaml`.

---

## Post estático e carrossel (feed)

- **F-22** O formato do carrossel é escolhido **explicitamente** antes de
  escrever: editorial, lista, tutorial, mito e realidade, antes e depois,
  história, ou problema e solução.
- **F-23** O primeiro slide existe para parar a rolagem, não para apresentar a
  marca. Nunca abrir com o nome da marca como headline.
- **F-24** Prova visual no primeiro slide sempre que possível.
- **F-25** O gancho promete valor que os slides seguintes entregam.
- **F-26** Barra de progresso, indicador de "arraste" e contador de posição
  são **opcionais**: o estilo declara se usa cada um (`navegacao` no
  `estilo.yaml`). O padrão é não usar; os pontinhos da própria rede já indicam
  a posição.
- **F-27** Se o estilo usar indicador de "arraste", ele aparece em todos os
  slides **exceto o último**.
- **F-28** Se o estilo usar barra, arraste ou contador, o conteúdo nunca os
  sobrepõe: a margem inferior os deixa livres.
- **F-29** O último slide fecha com uma chamada clara. Se o estilo usar
  navegação: sem arraste e com a barra em 100%.
- **F-30** Cada slide é autocontido e pronto para exportar: os elementos de
  navegação fazem parte da imagem.
- **F-53** Se o estilo usar contador de posição (por exemplo, 3/7), ele fica
  num canto fixo, na fonte mono.
- **F-54** Em carrossel de lista ou de passo a passo, o kicker dos slides
  internos indica a posição no raciocínio (por exemplo, "1 de 3 · o tema"),
  na fonte mono.

### Formatos de gancho do primeiro slide

| Formato | Exemplo estrutural |
|---|---|
| Afirmação polêmica | "Você está usando [X] errado" |
| Número e benefício | "[N] [coisas] que resolvem [dor]" |
| Pergunta que dói | "Por que [resultado esperado] não acontece?" |
| Resultado concreto | "[Ação] gerou [resultado específico] em [prazo]" |
| Inversão de expectativa | "Mais [esforço óbvio] = menos [resultado esperado]" |

**Como se confere:** F-26 a F-29 e F-53 são conferidas pelo conferidor
automático do carrossel **só quando o estilo declara a navegação** (presença,
posição e estado no último slide). F-22 a F-25 e F-54 são do revisor de
qualidade.

---

## Roteiro de vídeo em duas peças

Vale para vídeo curto, vídeo longo e stories falados.

- **F-49** Todo roteiro de vídeo sai em duas peças: o **roteiro falado** e o
  **roteiro descritivo** das animações, motions, B-rolls e elementos gráficos.
  Roteiro só com a fala é roteiro incompleto.
- **F-50** Cada item do roteiro descritivo é ancorado na fala: traz o tempo em
  que acontece e a frase dita que o dispara. Elemento visual sem frase de
  gatilho não entra; se não se relaciona com o que está sendo dito, é
  decoração.
- **F-51** O roteiro falado contém só o que será dito, sem marcação de tela,
  pronto para gravar. A descrição visual contém só o que aparece. As duas
  peças nascem da mesma fonte e nunca divergem; a versão intercalada (fala e
  visual por cena) é derivada delas, não escrita à parte.
- **F-52** Os tempos são calculados no ritmo da fala escrita e declarados como
  estimativa; a edição os ajusta pela gravação real.
