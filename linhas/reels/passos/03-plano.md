---
execucao: subagente
estacao: gancho
lentes: [modelo-e-transicao, graficos, chamada-final]
entrada: saida/material.md
saida: saida/plano.md
---

# Passo 3: Plano de edição (um só documento, quatro lentes)

**Uma passagem que grava um único `plano.md`** com quatro seções. As estações de modelo, gráficos e chamada final
entram como **lentes de revisão no mesmo documento**: cada lente escreve a sua seção e depois confere as das outras (os
gráficos cabem nas janelas das transições? o cartão final não se sobrepõe ao gráfico?).

## Exceções ao runner

1. **Um passo, quatro lentes.** O agente principal é a estação `gancho` (abre e fecha o documento). O runner inclui no
   prompt o arquivo completo dela e, das outras três, só as seções "Princípios" e "Anti-padrões" (em `estacoes/`).
   A saída de cada lente **não** é um arquivo próprio, e sim a seção correspondente do `plano.md`.
2. **Modelo do subagente.** Expresso e Padrão: modelo leve. Só Vitrine usa o mais forte.
3. **Contexto enxuto.** `dados/briefing.md` no lugar da empresa inteira.

## Contexto a carregar

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra `saidas` (a pasta dos
`saida/...`), `memoria` (`runs.md`) e `dadosLinha` (`preferencias-aprovadas.md`, `biblioteca-de-modelos.md`) da empresa.
Os demais `dados/` são do modelo e ficam na linha.

- `dados/briefing.md`, `dados/camadas-de-producao.md`
- O `estilo-de-video.md` da empresa do run (caminho `estiloDeVideo` dos mesmos caminhos): formato do rosto, o que aparece por tipo de frase, cuidados e aviso fixo
- `saida/entrada.md` (na pasta de saídas da empresa ativa, caminho `saidas`): assunto, observações, **camada e modelo já decididos pelo responsável**
- `saida/material.md` (idem): frases com índice e tempo, viradas aplicadas, poses, dúvidas
- `palavras.json` do vídeo: palavra, início e fim em ms
- `dados/regras-de-cta.md`, e a `biblioteca-de-modelos.md` e a `preferencias-aprovadas.md` da empresa ativa (caminho `dadosLinha`): só as seções que a lente precisar
- `runs.md`, na pasta `memoria` da empresa ativa (caminho `memoria`): modelos e transições dos vídeos anteriores
- Peças já existentes (blocos de motion do catálogo, mockups da empresa): só para listar o que pode ser reaproveitado

## Instruções

1. **Ler a fala inteira** antes de qualquer decisão. Camada e modelo são fixos.
2. **Lente 1, gancho (seção 1):** gancho, palavras-chave, headlines, viradas, final para o loop, razão para ficar (V-01)
   e frase da capa.
3. **Lente 2, modelo e transições (seção 2):** o modelo escolhido, transições, enquadramento e comparação com o vídeo
   anterior. Em vídeo cru as viradas **já foram aplicadas** pelo script: conferir contra `material.md`; se o plano
   preferir outras, registrar o pedido de `--viradas` (o responsável decide no passo 5).
   **Modelo do estilo da empresa** (`entrada.md` traz o código do modelo): a seção 2 escreve o pedido do modelo para o
   passo 4 (formato no `08-FERRAMENTAS/tesseract/modelos/README.md`): `video`, `palavras`, `trecho`, `chamada`,
   `destaques`, `broll` e **`"usarMarca": true`** (as cores e letras vêm do `marca.yaml` da empresa do run, nunca escritas
   no pedido); `rosto.layout` = o arranjo que `node _fabrica/core/estilo-da-linha.js <codigo do run>` mostrar, se mostrar.
   Regras de vídeo do responsável, conferidas aqui: **a pessoa fica em cena junto com a imagem de destaque** (o modelo só
   tem arranjos com a pessoa no quadro: miniatura, círculo, divisão, lado a lado, recorte); **nada sobre o rosto** (texto,
   cartão ou ícone; o título fica abaixo do queixo); **cada item de `broll` dura no mínimo 4 s** (`fim - ini >= 4`; os
   modelos usam 4,5 s), porque a troca de quadro em 2 s confunde.
4. **Lente 3, gráficos (seção 3):** gráficos, mockups, peças a gerar, alerta e encaixe. **Respeitar a camada:** Expresso
   não cria peça nova; Padrão usa só blocos existentes e cita o de origem; Vitrine pode criar peças, com amostra.
5. **Lente 4, chamada final (seção 4):** cartão final, argumento, botão e cauda, depois de conferir que nenhum gráfico
   ocupa a janela.
6. **Passada cruzada** (uma só): cada lente lê as outras seções e corrige a sua se houver conflito. Registrar em
   "Conflitos resolvidos" só o que realmente mudou.
7. **Tabela de cenas (V-08):** se o vídeo tem elemento na tela, escrever a seção 5 com uma linha por cena (tempo, fala,
   formato do rosto, o que aparece e a palavra que o dispara, como se move), derivada da fala e do plano, nos termos do
   glossário de `dados/entrevista-de-estilo.md`. Cada elemento entra na palavra que o nomeia (V-03); um elemento novo a
   cada 2 a 3 s (V-02). Conferir com `08-FERRAMENTAS/tesseract/conferir-tabela-de-cenas.js`.
8. **Prancha:** listar em "Momentos para a prancha" os ~8 instantes (segundo do vídeo editado) que o passo 4 vai
   renderizar: gancho, um por tipo de gráfico, um corte com zoom, o alerta e o cartão final.
9. Aplicar o checklist de texto de tela (vocabulário vetado, promessa numérica, regras do `marca.yaml` da empresa ativa) a todas as
   seções e gravar `saida/plano.md`.

## Formato

```
# Plano de edição

**Vídeo:** NN | **Camada:** {Expresso | Padrão | Vitrine} | **Modelo:** {nome}
**Resumo para o responsável:** {3 a 4 linhas em português simples}

## 1. Gancho e palavras-chave
## 2. Modelo e transições
## 3. Gráficos e mockups
## 4. Chamada final e fechamento
## 5. Tabela de cenas (V-08)
## Conflitos resolvidos
## Momentos para a prancha
| # | segundo | o que mostra |
## Decisões que dependem do responsável
{dados ilustrativos, peça que exigiria subir de camada, viradas diferentes, fato não falado}
```

## Vetos

Refazer se: houver mais de um arquivo de plano; modelo ou camada diferirem do escolhido sem constar em "Decisões que
dependem do responsável"; houver peça nova de motion em Expresso, ou fora dos blocos existentes em Padrão; uma frase
tiver mais de uma palavra-chave, ou a palavra não existir em `palavras.json`; algum tempo for do vídeo bruto ou
calculado por subtração de duração; o gancho abrir com logo, saudação ou promessa numérica, ou faltar a razão para
ficar (V-01) em uma frase; algum texto de tela tiver vocabulário vetado, promessa numérica ou mais de um CTA; houver
gráfico sem ligação com uma palavra da fala, ou mockup que encosta no rosto em algum enquadramento; fato que a fala não
sustenta (data, país, número) aparecer na tela sem estar marcado como decisão do responsável; faltar a tabela de cenas
quando há elemento na tela, ou ela reprovar em `conferir-tabela-de-cenas.js`; ilustração ou simulação sem o aviso fixo
do estilo da empresa (V-05); com o modelo do estilo da empresa, pedido sem `"usarMarca": true`, com cor ou letra escrita
à mão, ou com um item de `broll` de menos de 4 s.
