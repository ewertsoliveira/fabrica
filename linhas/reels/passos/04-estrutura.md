---
execucao: subagente
estacao: edicao
entrada: saida/plano.md
saida: saida/estrutura.md
---

# Passo 4: Montar a estrutura e gerar a prancha

No lugar de uma **amostra em vídeo** (que custa export e ~20 minutos), a estação de edição monta o **projeto real** a
partir do plano e renderiza uma **prancha de quadros** nos ~8 momentos-chave. O responsável aprova plano e estrutura
olhando a prancha no passo 5, e o projeto montado vira a base do export do passo 6: nada é refeito. **Não há export aqui.**
**Amostra de ~10 s:** em Padrão e Vitrine, depois da prancha corrigida, a estação exporta uma amostra em vídeo de ~10 s do trecho mais denso em motion (de início de frase a fim de frase, sem partir bloco ao meio; até ~14 s se um bloco encadeado não couber), em `<pasta>/amostra/amostra-v1.mp4`: vídeo recortado, máscara recortada, decupagem com os tempos deslocados, export curto. Com voz, sem trilha. A estação olha 4 quadros dela antes de entregar. Expresso não tem amostra.

## Exceções ao runner

1. **Modelo da estação:** leve em Expresso e Padrão; o mais forte em Vitrine (o modelo forte planeja e arquiteta; quem executa o export é o modelo leve, no passo 6).
2. **Contexto enxuto:** `dados/briefing.md` no lugar da empresa inteira.
3. **O passo 6 não continua esta estação** (a continuação herdaria o modelo forte). Ele abre uma estação nova em modelo
   leve que lê `estrutura.md` e `decupagem-v1.json`; por isso a `estrutura.md` precisa trazer tudo que o executor precisa.
4. **Empresa do run nos scripts:** todo comando deste passo (`montar-video.js`, `aplicar.js`, `tsrct`) roda com o prefixo
   `FABRICA_EMPRESA=<codigo do run>`, que o runner passa à estação.
5. **Conferência também do projeto do vídeo:** antes de concluir este passo, além da pasta do run, a conferência entre
   empresas roda sobre `08-FERRAMENTAS/tesseract/projetos/<NN>` (o `NN` está no `material.md`), como manda o runner.

## Contexto a carregar

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra `saidas` (a pasta dos
`saida/...`) e `dadosLinha` (`preferencias-aprovadas.md`) da empresa. `dados/briefing.md` é do modelo e fica na linha.

`dados/briefing.md`; `saida/plano.md` (fonte de verdade da decupagem); `saida/material.md` (pasta do vídeo,
`palavras.json`, máscara, viradas, versão do Tesseract); `08-FERRAMENTAS/tesseract/LEIA-ME.md` e
`blocos-motion/LEIA-ME.md`; o `preferencias-aprovadas.md` da empresa ativa (`dadosLinha`); a decupagem de referência do modelo escolhido.

## Instruções

1. Ler o plano inteiro e a camada. Conferir que o projeto e `palavras.json` existem (passo 2).
2. Gerar os mockups novos da seção 3 do plano (só Padrão com peça já catalogada, ou Vitrine) e olhar cada PNG. Em
   Expresso não há peça nova.
3. Escrever `decupagem-v1.json` copiando os tempos do plano: `palavrasChave`, `alerta`, `blocos`, `headline`,
   `enquadramento`, `matte`, `elemento`, `motion` (se houver) e `som`. Conferir os índices de frase contra
   `palavras.json`. **Em `motion`, listar `janelas`** (`{ "id", "inicio", "fim" }`, segundos do vídeo inteiro): é o que
   permite exportar em pedaços no passo 6 (convenção no briefing).
4. Rodar `node projetos/montar-video.js <pasta>/decupagem-v1.json` e conferir `decupagem-gerada.md`. Em Padrão e
   Vitrine, aplicar em seguida os blocos de motion (`blocos-motion/aplicar.js`), que **não são idempotentes**: remontar
   antes de aplicar de novo.
   **Modelo do estilo da empresa** (código do modelo em `entrada.md`): no lugar dos itens 3 e 4, gravar o pedido da seção
   2 do plano em `<pasta>/pedido-modelo.json` e montar com
   `FABRICA_EMPRESA=<codigo do run> node 08-FERRAMENTAS/tesseract/modelos/montar.js <modelo> <pasta>/pedido-modelo.json --usar-marca --quadros <t1,t2,...> --saida <pasta>/modelo`
   (sem `--exportar`). Conferir no log a linha `marca-usada`: `empresa` é o código do run e `exemplo` é `false` (marca de
   exemplo ou de outra empresa: parar e avisar). A folha `<modelo>-quadros.png` é a prancha do item 5.
5. **Prancha de estrutura:** renderizar os momentos da seção "Momentos para a prancha" com um único comando:
   ```
   tsrct filmstrip --project <pasta>/<video>-v1.tsrct --timestamps-ms <t1,t2,...> --tile-width 270 --tile-height 480 --items-per-row 4 --output <pasta>/conf/prancha-estrutura.png
   ```
   Para ler um detalhe pequeno, `tsrct preview --time <s>` em tamanho cheio só desse momento. **Abrir o PNG e olhar os
   pixels**: elemento sobre o rosto (principalmente o cartão final em trecho fechado), palavra de destaque cruzando o
   elemento de fundo, caixa escondida por mockup, headline ilegível, texto secundário pequeno.
6. Corrigir o que a prancha mostrar e renderizar de novo **uma vez**. Não iterar quadro a quadro.
7. Gravar `saida/estrutura.md`.

## Formato

```
# Estrutura montada

**Vídeo:** NN | **Camada:** {Expresso | Padrão | Vitrine} | **Tesseract:** {versão}
## Arquivos            (decupagem, projeto, motion, prancha)
## Momentos da prancha (# | segundo | o que mostra | resultado: OK ou correção feita)
## Correções feitas
## Pendências para o responsável
```

## Vetos

Refazer se: houve `tsrct export` neste passo que não seja a amostra de ~10 s, ou faltou a amostra em Padrão ou Vitrine; a prancha não foi aberta e olhada, ou não cobre o gancho, cada tipo de
gráfico, um corte com zoom e o cartão final; a decupagem tem peça que a camada não permite; `motion.blocos` sem
`motion.janelas` correspondentes; algum script do modelo base foi alterado; um tempo da decupagem não está ancorado em
`palavras.json`.
