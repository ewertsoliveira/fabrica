# Estimativa de tempo na escolha da edição do Reels

Data: 2026-11-13. Estado: desenho para aprovação (forma na tela escolhida: versão A).

Convenção deste documento:
- **(dele)** marca o que o responsável decidiu.
- **(minha escolha)** marca o que eu decidi e ele pode mudar.

## 1. Intenção e porquê

No passo 1 da linha de Reels, a pessoa escolhe quanto trabalho vai no vídeo: Rápido (Expresso), Normal (Padrão) ou
Caprichado (Vitrine). Hoje a tela diz o que entra em cada opção, mas não quanto tempo cada uma leva. Quem tem prazo
para entregar o vídeo ao cliente escolhe às cegas.

Caso real (13/11, Reels de uma cliente): a operadora escolheu Caprichado, perguntou quanto ia demorar, ouviu "2 h a 2 h 45"
contra "50 min a 1 h 15" do Normal e voltou para o Normal. A informação mudou a escolha, mas só apareceu porque ela
perguntou, e era um palpite da IA (dele: o cliente precisa saber disso quando tem prazo apertado).

O objetivo: cada opção mostra, na hora da escolha, quanto tempo a Fábrica vai trabalhar nela, a partir de medições
reais e não de palpite.

## 2. Objetivos

- Cada opção da pergunta "Quanto trabalho vai neste vídeo?" mostra o **tempo de trabalho da Fábrica** (dele):
  transcrever, planejar, montar, exportar e conferir. O tempo que a pessoa leva olhando, respondendo e aprovando
  **não entra** (dele).
- O tempo aparece em duas partes: **até a primeira versão** e **quanto soma cada rodada de ajuste** (dele, aprovado no
  resumo: "cerca de 50 min, mais uns 15 min por rodada de ajuste").
- A estimativa vem de **medições reais** (dele). A Fábrica passa a anotar quanto trabalhou em cada etapa de cada Reels,
  separado do tempo esperando a pessoa (dele).
- Enquanto há pouca medição, vale uma **tabela inicial** calibrada com os Reels reais de 13/11 (dele).
- Com o uso, a estimativa se ajusta **a este computador** e ao jeito de cada empresa (dele).
- A estimativa considera a **duração do vídeo** (dele).
- **Tokens:** se der, aparecem; são secundários ao tempo (dele).

## 3. Não objetivos

- Não estimar o tempo da pessoa (aprovações, respostas).
- Não prometer horário de entrega. A estimativa é uma faixa, nunca um prazo garantido.
- Não mexer nas outras linhas agora. O registro de tempo nasce genérico (seção 5.1), mas só o Reels mostra estimativa.

## 4. Antiobjetivos (o que tornaria isto um fracasso mesmo funcionando)

- Um número único e otimista que a pessoa usa para prometer prazo e estoura. Por isso: faixa, e as rodadas de ajuste à
  parte.
- Atrasar o vídeo por causa da medição: anotar o tempo não pode travar nem interromper nenhum passo. Se a anotação
  falhar, o Reels segue.
- Nome interno na tela ("Expresso", "camada", "run", "tokens de cache"). Regra L-01 (`13-explicar-o-processo.md`).

## 5. Como

### 5.1 Anotar o tempo de cada Reels (minha escolha, no formato)

Script novo `_fabrica/core/tempos.js`, chamado pelo runner. Grava em `<saidas>/<run_id>/tempos.json`, na pasta do
próprio run (não no estado da linha, que hoje é compartilhado entre conversas e foi apagado por uma conversa paralela
em 13/11).

```
node _fabrica/core/tempos.js marcar <pasta do run> <evento> [--passo N] [--rodada N]
  eventos: inicio-passo, fim-passo, espera-inicio, espera-fim, ajuste-inicio
node _fabrica/core/tempos.js resumo <pasta do run>      tempo da Fábrica por passo, por rodada e total
node _fabrica/core/tempos.js estimar --linha reels --duracao <s> [--empresa <codigo>]
```

- O runner (`runner.pipeline.md`) marca `inicio-passo` e `fim-passo` em cada passo, e `espera-inicio` e `espera-fim`
  em volta de toda pergunta ou checkpoint à pessoa. Tempo da Fábrica = duração dos passos menos as esperas.
- `ajuste-inicio` abre uma rodada de ajuste: depois do passo 5 (estrutura reprovada) ou do passo 8 (vídeo reprovado).
  O que vem depois conta para a rodada, não para a primeira versão.
- O `tempos.json` também guarda a camada, o modelo de edição, a duração do vídeo e o estado (cru ou pré-editado),
  lidos do `entrada.md`. São esses campos que permitem comparar um Reels com outro.
- Cada chamada só acrescenta uma linha; nunca reescreve o arquivo. Se uma chamada falhar ou for esquecida, o resumo
  ignora o intervalo incompleto e marca o run como "medição incompleta". Esse run fica fora da estimativa.
- Trabalho em segundo plano (exportação rodando enquanto a IA espera) conta como tempo da Fábrica, porque a pessoa não
  está sendo esperada.

### 5.2 Calcular a estimativa (minha escolha)

`estimar` devolve, para cada camada: faixa até a primeira versão, faixa por rodada de ajuste e de onde veio o número
("medido em N vídeos neste computador" ou "estimativa inicial").

1. Junta os runs concluídos **deste computador** com medição completa, da mesma camada. A pasta `saidas` de todas as
   empresas entra, porque a velocidade é do computador. Os da empresa do pedido pesam o dobro.
2. Normaliza pela duração do vídeo: preparo e exportação crescem com a duração; plano, estrutura e revisão, não. A
   divisão sai do resumo por passo (passos 2 e 6 contam como proporcionais; os demais, fixos).
3. Com **3 runs ou mais** na camada: a faixa vai do menor ao maior dos 5 mais recentes, ajustados para a duração do
   vídeo novo e arredondados para 5 min.
4. Com menos de 3: tabela inicial (5.3), misturada com o que houver, em média simples.
5. Rodada de ajuste: a mesma conta com as rodadas medidas. Sem medição, vale a tabela inicial.

### 5.3 Tabela inicial (calibrada em 13/11)

Medida nas duas conversas de 13/11 de uma instalação real (vídeo de 50 s, pré-editado, modelo Concreto Ácido), a
partir dos horários das mensagens: tempo da Fábrica, descontadas as esperas por resposta.

| Reels de 13/11 (Normal) | Fábrica trabalhando | Esperando a pessoa |
|---|---|---|
| Entrada até a primeira estrutura | 21 min | 14 min |
| 1ª rodada de ajuste (estrutura refeita: B-roll novo, logo, selos) | 42 min | 12 min |
| Montagem, exportação e revisão | 12 min | 0 |
| 2ª rodada de ajuste (cartão menor, lista marcada) e novo vídeo | 20 min | 28 min |
| **Total** | **1 h 35** | **54 min** |

(Medida sobre a conversa inteira, sem cortar em trechos, dá 1 h 41: os 6 min de diferença são intervalos que cruzam a
fronteira entre dois trechos.)

O segundo Reels da manhã, também Normal, deu 1 h 30 de Fábrica trabalhando e 46 min esperando.

Tabela inicial para um vídeo de 50 s (Normal medido; Rápido e Caprichado são estimativa minha, a trocar pela medição
assim que existir):

| | Primeira versão | Cada rodada de ajuste |
|---|---|---|
| Rápido | 15 a 25 min | 10 a 15 min |
| Normal | 30 a 45 min | 20 a 40 min |
| Caprichado | 1 h 15 a 2 h | 30 a 60 min |

A estimativa que a IA deu na hora ("50 min a 1 h 15" para o Normal e "10 a 20 min por rodada") acertou a primeira
versão, mas errou as rodadas de ajuste para menos: elas custaram 20 e 42 min.

### 5.4 Mostrar na pergunta do passo 1

`linhas/reels/passos/01-entrada.md`, chamada 2, pergunta 5: antes de perguntar, o runner roda `tempos.js estimar` com
a duração do vídeo (já conhecida depois da chamada 1) e coloca o tempo na descrição de cada opção. A frase ao lado da
pergunta lembra que é o tempo da Fábrica trabalhando, sem contar o tempo de olhar e aprovar.

Limite da tela: a pergunta é feita pela caixa de opções da própria IA (no Claude Code, a pergunta de múltipla
escolha), que tem um rótulo curto e uma descrição por opção, mais um quadro de prévia opcional. O tempo cabe na
descrição ou na prévia; não há como mudar o desenho da caixa.

**Forma escolhida: versão A** (dele, 13/11, entre três versões lado a lado). O rótulo continua o mesmo ("Normal
(recomendado)", "Rápido", "Caprichado"). A descrição traz o que entra no vídeo e, numa linha própria, o tempo:

```
Pergunta:  Quanto trabalho vai neste vídeo?
Lembrete:  Tempo da Fábrica trabalhando, sem contar o seu tempo de olhar e aprovar.

Normal (recomendado)
  Animações que já existem: contador, lista marcada, esquema, selo.
  Primeiro vídeo em 30 a 45 min · cada ajuste soma 20 a 40 min
Rápido
  Títulos, selo, legenda e cartão final.
  Primeiro vídeo em 15 a 25 min · cada ajuste soma 10 a 15 min
Caprichado
  Desenhos e animações novos, feitos só para este vídeo.
  Primeiro vídeo em 1 h 15 a 2 h · cada ajuste soma 30 a 60 min
```

Quando a faixa vem da tabela inicial, e não de medição neste computador, a linha não muda; a origem fica só no
`estimar` (minha escolha: a pessoa não precisa dessa distinção para decidir).

### 5.5 Tokens (minha escolha)

A Fábrica não sabe quantos tokens usa enquanto trabalha. No Claude Code, a conversa grava o consumo de cada mensagem
(`~/.claude/projects/<pasta>/<conversa>.jsonl`, campo `usage`, mais as conversas dos subagentes). Proposta:

- Ao concluir o Reels, `tempos.js` tenta somar o consumo da conversa entre o início e o fim do run e grava no
  `tempos.json`. Se não achar a conversa (outra IA, outro sistema), grava "sem medição" e segue.
- Na tela, o consumo aparece só quando há medição, em palavras simples ("consumo baixo, médio ou alto", em comparação
  com as outras opções), nunca em números de tokens. Na versão A, entra no fim da linha do tempo:
  "Primeiro vídeo em 30 a 45 min · cada ajuste soma 20 a 40 min · consumo médio" (minha escolha).

Consumo medido em 13/11 (Normal), para referência: 127 mil tokens escritos pela conversa principal (Opus) e 184 mil
pelos subagentes (Haiku), mais cerca de 57 milhões de tokens lidos do cache.

## 6. O que fica com quem construir

- O nome dos eventos e o formato exato do `tempos.json`, desde que só acrescente linhas.
- Em que ponto do `runner.pipeline.md` entram as marcações (sugestão: etapas 0, 3 e 7 do ciclo de cada passo, mais o
  checkpoint).
- Testes de `tempos.js` com runs falsos: medição completa, incompleta, sem nenhum run (só tabela) e vídeo de duração
  diferente.
- Nota nas novidades da versão, em linguagem simples.

## 7. Pendente com o responsável

- Conferir as faixas iniciais de Rápido e Caprichado (5.3), que são estimativa minha. Elas saem da tela sozinhas
  assim que houver 3 Reels medidos em cada opção.
