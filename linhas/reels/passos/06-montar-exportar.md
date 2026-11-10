---
execucao: subagente
estacao: edicao
entrada: saida/plano-aprovado.md
saida: saida/entrega.md
---

# Passo 6: Exportar, mixar e entregar

A montagem e a prancha são do passo 4. Este passo aplica os ajustes pedidos no checkpoint 5, **exporta uma única vez,
em pedaços paralelos**, mixa o som, mede, roda a conferência por script e entrega.

## Exceções ao runner

1. **Estação nova em modelo leve** (o modelo forte planeja e arquiteta; o leve executa). O runner abre a estação passando
   `estrutura.md`, `decupagem-v1.json`, `plano-aprovado.md` (ajustes) e, se for retorno de reprovação, `revisao.md`. Nada é
   remontado se a decupagem não mudou. Os ajustes pós-revisão (`ao_reprovar` do passo 7) continuam **essa mesma estação**.
2. **Modelo:** sempre leve neste passo, inclusive na Vitrine.
3. **Contexto enxuto:** `dados/briefing.md` no lugar da empresa inteira.
4. **Empresa do run nos scripts:** todo comando deste passo (`montar-video.js`, `exportar-em-pedacos.js`,
   `mixar-audio.js`, `conferir-reels.js`) roda com o prefixo `FABRICA_EMPRESA=<codigo do run>`, que o runner passa à
   estação.
5. **Conferência também do projeto do vídeo:** antes de concluir este passo, além da pasta do run, a conferência entre
   empresas roda sobre `08-FERRAMENTAS/tesseract/projetos/<NN>` (o `NN` está no `material.md`), como manda o runner.

## Contexto a carregar

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra `saidas` (a pasta dos
`saida/...`) e `dadosLinha` (`preferencias-aprovadas.md`) da empresa. `dados/briefing.md` é do modelo e fica na linha.

`dados/briefing.md`; `saida/plano-aprovado.md`; `saida/estrutura.md`; `saida/revisao.md` (se houver reprovação anterior);
`08-FERRAMENTAS/tesseract/LEIA-ME.md` (seções de som, armadilhas e export em pedaços, se precisar);
o `preferencias-aprovadas.md` da empresa ativa (`dadosLinha`: trilha, digitação, loudness).

## Instruções

Ordem fixa: **montar → motion → exportar em pedaços → mixar → conferir**.

1. Se houver `revisao.md` de uma reprovação, corrigir apenas o que a revisão apontou. Senão, aplicar só os ajustes do
   checkpoint 5 à decupagem do passo 4.
2. **Montar e motion.** Se algo mudou na decupagem: remontar com `projetos/montar-video.js` e reaplicar os blocos (na
   ordem do briefing) e conferir **uma folha de 8 a 12 quadros só do que mudou**. Sem mudança, não renderizar de novo:
   a prancha do passo 4 vale. Conferir que `motion.janelas` cobre todos os blocos; sem janela o script não divide.
   **Modelo do estilo da empresa** (código do modelo em `entrada.md`): os itens 3 e 4 viram um export só, do próprio
   montador dos modelos, com a marca da empresa do run:
   `FABRICA_EMPRESA=<codigo do run> node 08-FERRAMENTAS/tesseract/modelos/montar.js <modelo> <pasta>/pedido-modelo.json --usar-marca --exportar --saida <pasta>/modelo`.
   A linha `marca-usada` do log tem de trazer o código do run e `exemplo: false`. Depois, com o MP4 de `<pasta>/modelo/`:
   medir como no item 5 (a mixagem por decupagem não se aplica: o áudio é o do vídeo), rodar o item 6 com
   `<pasta>/pedido-modelo.json` no lugar da decupagem (se o script não aceitar, registrar como pendência em `entrega.md`)
   e olhar a folha de quadros: pessoa em cena junto com cada imagem de destaque, nada sobre o rosto, cada imagem de
   destaque com a pessoa por no mínimo 4 s. Os modelos não têm cartão final de chamada: com o pedido do modelo, o script
   dá AVISO (e não FALHA) em "CTAs (exatamente 1)", e esse aviso não impede entregar. (O script só reconhece como pedido
   do modelo o arquivo com o `trecho` e um campo do modelo e sem `blocos` nem `headline`; um pedido sem `trecho` continua
   dando FALHA.) Anote nas pendências de
   `entrega.md` que a chamada, se a pessoa quiser, vai na legenda do post. Qualquer outra FALHA continua impedindo.
3. **Plano de cortes (leve, sem export):**
   ```
   node exportar-em-pedacos.js --decupagem <pasta>/decupagem-v1.json --pedacos 3 --dry-run
   ```
   Ler: número de pedaços (RAM livre medida na hora), cortes em início de frase e fora de bloco, avisos. Resolver os
   avisos de pré-checagem (navegador pesado, `tsrct`/`ffmpeg` de outro processo): fechar o navegador antes de exportar.
4. **Exportar em pedaços, um único export, em segundo plano:**
   ```
   node exportar-em-pedacos.js --decupagem <pasta>/decupagem-v1.json --pedacos 3
   ```
   Pelo menos 3 pedaços (4 só com 6 GB ou mais de RAM livre; nunca 2). Com menos de 3 GB livres, pedir que o responsável feche o navegador.
   Saída em `<pasta>/export-pedacos/`: `junto-sem-trilha.mp4` e `decupagem-som-completa.json`. Medido num vídeo de 60 s:
   ~5 min ponta a ponta com 3 ou 4 pedaços, contra ~13,5 min inteiro.
   - **Fallback:** `--pedacos inteiro` só se o export em pedaços falhar duas vezes ou um corte válido não existir;
     registrar o motivo em `entrega.md`.
   - Cortes manuais só com motivo (`--cortes seg1,seg2`). Nunca cortar no meio de bloco de motion.
5. **Mixar e medir.** `node projetos/mixar-audio.js <pasta>/export-pedacos/decupagem-som-completa.json`. Medir o MP4
   final: loudness (`ebur128`), pico, áudio presente, duração igual à de `junto-sem-trilha.mp4` (1 quadro a mais ou a
   menos é falha de junção).
6. **Conferência por script:** `node conferir-reels.js <mp4 final> <decupagem> --saida <pasta>/conferencia.md`.
   Corrigir qualquer FALHA antes de entregar; AVISO vai para as pendências (com o modelo do estilo, o aviso de cartão de
   chamada não impede entregar; ver o item 2). Olhar os quadros das emendas (um antes e um
   depois de cada corte do `plano.json`) junto com 12 quadros finais.
7. Gravar `saida/entrega.md` (na seção Medidas: modo de export, nº de pedaços, cortes em segundos, tempo de relógio).
   **Ao registrar o vídeo, a capa ou a miniatura no Laboratório** (`registrar.js peca`, ver CORE.md): sem o campo
   `estilo` no JSON da peça, vale o estilo escolhido pela empresa. Feito com o modelo do estilo da empresa, deixe sem o
   campo. Quando o pedido trocou o estilo, ponha no JSON da peça o estilo usado (`"estilo": "<id>"`, ou
   `{ "id": "<id>", "origem": "proprio" }` no estilo próprio da empresa, que pode ter o código de um do catálogo); quando
   não usou nenhum (o modelo de edição de sempre, sem o modelo do estilo), `"estilo": null`.

## Formato

```
# Entrega

**Vídeo:** NN | **Versão:** vN | **Tesseract:** {versão} | **Camada:** {Expresso | Padrão | Vitrine}
## Arquivos
## Medidas
## Conferência por script   (caminho de conferencia.md e resumo: n OK, n AVISO, n FALHA)
## Quadros conferidos
## Correções feitas
## Pendências para o responsável
```

## Vetos

Refazer se: entregar sem a conferência por script rodada, ou com FALHA aberta; o MP4 final estiver sem áudio ou fora de
-14 LUFS ±2; alterar `montar-video.js`, `pre-edicao.js` ou `mixar-audio.js` para este vídeo; houver mais de um export do
mesmo projeto sem mudança de decupagem entre eles; corte de pedaço dentro de bloco de motion ou fora de início de frase
sem o aviso do script registrado em `entrega.md`.
