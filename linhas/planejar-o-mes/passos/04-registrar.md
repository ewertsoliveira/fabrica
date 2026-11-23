---
execucao: inline
entrada: saida/plano-aprovado.md
saida: saida/registro.md
---

# Passo 4: Pôr no calendário (script)

## Exceções ao runner

- **Script sem estação:** o runner roda os comandos inline, sempre com `--empresa <codigo do run>`.
- O registro é feito só pelo `plano-do-mes.js registrar`: ele confere todos os posts antes de gravar; nada é escrito à
  mão no `posts.json`.
- Códigos de saída do registro: `0` gravou o plano inteiro; `1` recusou e **nada foi gravado**: mostre os erros em
  linguagem simples e volte ao passo `proposta` (`ao_reprovar: 2`), que corrige só os posts citados; `2` erro de uso:
  mostre a mensagem.

## Contexto a carregar

- `saida/plano-aprovado.md`: a aprovação
- `saida/plano.json`: a versão mais recente, a que a pessoa aprovou

## Instruções

1. Confira que `plano-aprovado.md` existe e diz `decisao: aprovar`.
2. Rode:

   ```
   node _fabrica/core/plano-do-mes.js registrar <saida/plano.json traduzido> --empresa <codigo do run> --json
   ```

3. Saída 0: abra o calendário da empresa. Rode `node _fabrica/paineis/servidor.js garantir` (ele sobe o painel se
   precisar e imprime o endereço) e abra `<endereço>/_fabrica/paineis/cronograma.html?empresa=<codigo do run>` no
   navegador da pessoa, com o link clicável.
4. Diga, nas suas palavras mas sem mudar o conteúdo (L-05): "Seu mês está no calendário. Cada post já tem o roteiro e a
   legenda. Para fazer um carrossel ou post do plano, é só pedir: a Fábrica começa pelo que já está lá. Os vídeos você
   grava seguindo o roteiro e manda para a Fábrica editar."
5. Grave `saida/registro.md`.

## Formato

```markdown
# Registro

- codigo_de_saida: 0 | 1 | 2
- registrados: <N>
- calendario: <endereço do calendário>
- erros: <a lista, só na recusa>
```

Caso aprovado:

```markdown
# Registro

- codigo_de_saida: 0
- registrados: 13
- calendario: <endereço>/_fabrica/paineis/cronograma.html?empresa=padaria-exemplo
```

Caso recusado:

```markdown
# Registro

- codigo_de_saida: 1
- registrados: 0
- erros:
  - post 5 (Como guardar o pão): date: obrigatória, no formato AAAA-MM-DD
- acao: volta à proposta, que corrige só o post 5
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Post gravado à mão no `posts.json`, sem o `plano-do-mes.js registrar`.
2. Na recusa, seguir em frente em vez de voltar à proposta.
3. Calendário não aberto, ou sem o link para a pessoa.

## Critérios de qualidade

- [ ] O registro saiu 0 e o número de registrados é o do plano.
- [ ] O calendário foi aberto na empresa certa.
- [ ] A fala final diz o que fazer com os posts do plano.
