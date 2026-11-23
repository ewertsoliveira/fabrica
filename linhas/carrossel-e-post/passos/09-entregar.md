---
execucao: inline
entrada: saida/preview-aprovado.md
saida: saida/entrega.md
---

# Passo 9: Entregar o aprovado (script)

## Exceções ao runner

- **Script sem estação:** o runner roda o comando inline.
- **Copia para fora da pasta do run:** antes de rodar, a conferência entre empresas roda sobre a pasta do run. Saída
  diferente de 0: o script **não é executado** (regra do runner).
- O comando roda com o prefixo `FABRICA_EMPRESA=<codigo do run>`.
- Códigos de saída: `0` entregou; `1` o gerador recusou (peça não montada por inteiro, conferência reprovada ou
  conteúdo alterado depois da montagem): mostre a mensagem e volte ao passo `design`; `2` erro de uso: mostre a
  mensagem sem mexer na peça.

## Contexto a carregar

- `saida/preview-aprovado.md`: a aprovação
- `saida/conteudo.json` (o mais recente) e `saida/pedido.md` (`estilo`, `cores`, `tipo_peca`)

## Instruções

1. Confira que `preview-aprovado.md` existe.
2. Rode:

   ```
   FABRICA_EMPRESA=<codigo do run> node 08-FERRAMENTAS/carrossel/gerar.js {conteudo.json} --saida {pecas} --estilo {estilo} --cores {cores} --formato {carrossel|post} --entregar
   ```

3. Liste o que foi para `{pecas}/entrega/` e grave em `saida/entrega.md`.
4. Diga à pessoa onde estão as imagens e a legenda (o caminho clicável da pasta de entrega).

## Formato

```markdown
# Entrega

- codigo_de_saida: 0 | 1 | 2
- pasta: <{pecas}/entrega>
- arquivos:
  - <arquivo>
- legenda: <caminho do legenda.txt>
```

Caso aprovado:

```markdown
# Entrega

- codigo_de_saida: 0
- pasta: .../pecas/entrega
- arquivos:
  - lamina-01.png
  - lamina-02.png
  - lamina-03.png
  - lamina-04.png
  - lamina-05.png
  - lamina-06.png
  - lamina-07.png
  - carrossel.html
  - legenda.txt
- legenda: .../pecas/entrega/legenda.txt
```

Caso recusado:

```markdown
# Entrega

- codigo_de_saida: 1
- motivo: o conteúdo mudou depois da montagem
- volta para: design
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. O script rodou sem a conferência entre empresas limpa.
2. Algum arquivo fora do que o gerador entregou foi listado.

## Critérios de qualidade

- [ ] A lista bate com a pasta `entrega/`.
- [ ] O código de saída está registrado.
- [ ] A legenda está na entrega.
