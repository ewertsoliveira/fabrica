---
execucao: inline
estacao: revisao
entrada: saida/entrega.md
saida: saida/revisao.md
ao_reprovar: 6
---

# Passo 7: Revisão

A estação de revisão **lê primeiro o relatório de `conferir-reels.js`** (duração, loudness, pico, travessão, vocabulário
vetado, promessa numérica, contagem de CTA, logo e conta fora do cartão final, faixa do perfil) e só olha quadros para o
que o script não cobre: **rosto coberto ou encostado, legibilidade e tamanho do texto, ritmo, encaixe no queixo,
sincronia da legenda, qualidade do recorte**. O script é calibrado contra um caso feito para falhar (G-13): o que ele
reprova é FALHA, sem discussão.

## Exceções ao runner

1. **Reprovação (`ao_reprovar: 6`):** o runner continua a mesma estação de edição (SendMessage) levando `revisao.md`. A
   revisão seguinte é só do delta (o que o script reprovou e os quadros que mudaram).
2. **Contexto enxuto:** `dados/briefing.md` no lugar da empresa inteira.

## Contexto a carregar

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra `saidas` (a pasta dos
`saida/...`) e `dadosLinha` (`preferencias-aprovadas.md`) da empresa. `dados/briefing.md` é do modelo e fica na linha.

`dados/briefing.md`; `saida/entrega.md`; `saida/plano-aprovado.md`; o `preferencias-aprovadas.md` da empresa ativa (`dadosLinha`);
`05-ESTRATEGIA/nucleo-de-conteudo/regras/11-video.md` (portão V-01).

## Instruções

1. Ler a entrega e o plano aprovado por inteiro antes de pontuar.
2. **Rodar `FABRICA_EMPRESA=<codigo do run> node conferir-reels.js <mp4 final> <decupagem> --saida <pasta>/conferencia-revisao.md`** e ler o relatório.
   Cada FALHA é uma mudança obrigatória; AVISO exige julgamento escrito. Feito com o modelo do estilo da empresa (o
   pedido do modelo no lugar da decupagem), o vídeo não tem cartão final de chamada: o script dá AVISO em "CTAs
   (exatamente 1)", e esse aviso não impede aprovar; o julgamento escrito diz que a chamada, se a pessoa quiser, vai na
   legenda do post. O resto da conferência vale igual; com a decupagem, continua exigindo exatamente 1 CTA.
3. Extrair do MP4 final os quadros **só do que o script não cobre**: um por bloco visual, antes e depois de cada corte
   com zoom, e o cartão final. Olhar todos: rosto, legibilidade, ritmo (trecho longo sem evento novo), encaixe no queixo.
4. Conferir a sincronia da legenda em pelo menos 5 pontos.
5. Ler todo o texto de tela que o script não varre (texto dentro de PNG de mockup).
6. Aplicar o portão **V-01**: escrever em uma frase a razão para ficar vista nos 3 primeiros segundos, conferir que a
   promessa é cumprida antes do CTA e que nenhum trecho passa do limite de ritmo do formato. Reprovou: voltar ao passo 3.
7. Pontuar os critérios gerais (gancho, ritmo, legenda, identidade visual, gráficos, enquadramento, alerta, som,
   fechamento, entrega) de 1 a 10, com justificativa e segundo ou quadro.
8. Redigir as mudanças obrigatórias (segundo, quadro, correção) e a etapa responsável: passo 6 para execução, ou passo 3
   quando o erro nasceu no plano.
9. Registrar ponto forte, sugestões e veredito; gravar `saida/revisao.md`. Se REPROVAR, a linha volta ao passo 6.

## Formato

```
VEREDITO: APROVAR | APROVAR COM RESSALVAS | REPROVAR
{vídeo, duração, LUFS, pico}
CONFERÊNCIA POR SCRIPT: {n OK, n AVISO, n FALHA; caminho do relatório}

| Critério | Nota | Resumo |

PORTÃO V-01: razão para ficar {uma frase} · promessa cumprida {OK | FALHA} · sem trecho morto {OK | FALHA}

MUDANÇAS OBRIGATÓRIAS: {segundo, quadro, correção, etapa responsável}
SUGESTÕES (não bloqueantes): {lista}
PONTO FORTE: {texto}
VEREDITO: {frase final}
```

## Vetos

Refazer se: aprovar sem ter rodado e lido o relatório do `conferir-reels.js`, ou relevar uma FALHA dele; aprovar sem ter
olhado os quadros do que o script não cobre; reprovar sem segundo, quadro e correção sugerida; opinar sobre o som sem a
medida de loudness e pico; aprovar sem ter escrito a razão para ficar do portão V-01.
