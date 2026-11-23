---
execucao: inline
entrada: saida/primeira-aprovada.md
saida: saida/conferencia.txt
---

# Passo 6: Montar o resto e conferir (script)

## Exceções ao runner

- **Script sem estação:** o runner roda o comando abaixo inline, sem trocar de papel.
- O comando roda com o prefixo `FABRICA_EMPRESA=<codigo do run>`.
- Códigos de saída:
  - `0`: seguiu. Grave o relatório em `saida/conferencia.txt` e siga para a revisão.
  - `1`: **a conferência automática reprovou.** Não é falha do comando: grave o relatório inteiro em
    `saida/conferencia.txt`, apresente-o e volte ao passo `design` (`ao_reprovar: 4`) com os achados; o designer corrige
    só o que foi citado (L-06). Se o texto mudou, o `--resto` recusa até a primeira imagem ser montada e aprovada de
    novo.
  - `2`: erro de uso (arquivo ausente, conteúdo alterado depois da primeira). Mostre a mensagem sem mexer na peça.

## Contexto a carregar

- `saida/primeira-aprovada.md`: a aprovação da primeira imagem
- `saida/conteudo.json` (o mais recente) e `saida/pedido.md` (`estilo`, `cores`, `tipo_peca`)

## Instruções

1. Confira que `primeira-aprovada.md` existe e que o `conteudo.json` não mudou depois dela.
2. Rode:

   ```
   FABRICA_EMPRESA=<codigo do run> node 08-FERRAMENTAS/carrossel/gerar.js {conteudo.json} --saida {pecas} --estilo {estilo} --cores {cores} --formato {carrossel|post} --resto
   ```

3. Copie `{pecas}/conferencia.txt` para `saida/conferencia.txt`, acrescentando no topo o código de saída.
4. Com código 1, explique à pessoa em linguagem simples o que a conferência achou ("o texto da imagem 4 ficou com
   pouco contraste sobre o fundo") e que o design vai corrigir só isso.

## Formato

```
codigo_de_saida: 0 | 1 | 2
<relatório da conferência, como o gerador gravou>
```

Caso aprovado:

```
codigo_de_saida: 0
APROVADO: 7 lâminas
- contraste: ok em todas
- texto dentro da área: ok
- visual em toda lâmina: ok
```

Caso reprovado:

```
codigo_de_saida: 1
REPROVADO: 7 lâminas, 1 achado
- lâmina 04: contraste 3.1 (mínimo 4.5) no corpo sobre o fundo de acento
→ volta ao passo design
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Código 1 tratado como falha de comando ou ignorado.
2. `--cores`, `--estilo` ou `--formato` diferente do passo `design`.

## Critérios de qualidade

- [ ] O relatório gravado é o do gerador, sem edição.
- [ ] O código de saída está no topo.
- [ ] Com reprovação, o retorno foi ao passo `design`, com os achados.
