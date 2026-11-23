---
execucao: inline
estacao: revisao-de-qualidade
entrada: saida/conferencia.txt
saida: saida/revisao.md
---

# Passo 7: Revisão de qualidade

## Exceções ao runner

- `ao_reprovar: 4` leva ao design. Quando o parecer apontar que a falha é do **texto** (frase confusa, promessa que a
  empresa não pode cumprir, assunto do post planejado trocado), o retorno vai ao passo `copy` (passo 2), não ao design.

## Contexto a carregar

- `saida/conferencia.txt`: o relatório da conferência automática
- `<saidas>/<run_id>/pecas/miniaturas-100px.png` e as imagens `lamina-*.png` da mesma pasta
- `saida/copy-aprovada.md` e `saida/pedido.md` (com o `roteiro_planejado`, num post planejado)
- `05-ESTRATEGIA/nucleo-de-conteudo/agentes/revisor-de-qualidade.agent.md`: o papel
- o caminho `decisoes` da empresa ativa e `dados/criterios-de-qualidade.md`

## Instruções

1. Leia o relatório da conferência: ela já mediu letras, contraste, texto coberto e visual em toda imagem. Não repita
   essas medidas.
2. Olhe cada imagem e julgue o que a conferência não mede:
   - cada visual conversa com o texto da própria imagem;
   - nenhum mockup traz texto de demonstração (nome, frase ou valor que não é da empresa, como um comentário de
     "Carlos"): a conferência automática não sabe o que é da empresa;
   - nenhum visual encosta, cobre ou corta texto, nem passa por baixo da barra de navegação;
   - nenhum texto, véu ou enfeite cobre o rosto de uma pessoa na foto;
   - a capa se entende nas miniaturas de 100 px (DG-19);
   - a ordem conta a ideia no formato escolhido;
   - há uma chamada só, a mesma na última imagem e na legenda;
   - as regras de `decisoes` da empresa (público, promessa, linguagem) são cumpridas.
3. Num post planejado, confira que a peça diz o que o post planejado prometia (o `roteiro_planejado`).
4. Dê o parecer: **APROVAR**, ou **REPROVAR** com cada achado (imagem, o que está errado, o que fazer) e para quem volta
   (`design` para visual, `copy` para texto).
5. Grave `saida/revisao.md` e diga à pessoa, em uma frase simples, o resultado.

## Formato

```markdown
# Revisão

- parecer: APROVAR | REPROVAR
- volta_para: (nenhum) | design | copy

## Achados
- <imagem NN: o que está errado e o que fazer; ou "nenhum">

## Observações para a pessoa
- <o que vale saber antes de aprovar, como a foto que melhoraria uma imagem>
```

## Exemplo

```markdown
# Revisão

- parecer: APROVAR
- volta_para: (nenhum)

## Achados
- nenhum

## Observações para a pessoa
- A capa se lê bem pequena, na grade do perfil.
- A imagem 2 usou a conversa no lugar da foto; uma foto do pão saindo do forno deixaria a imagem mais forte.
- A chamada "Quero provar" está na última imagem e na legenda.
```

Caso reprovado:

```markdown
# Revisão

- parecer: REPROVAR
- volta_para: design

## Achados
- imagem 05: o número "3" ficou maior que o título e rouba a atenção; usar o número menor ou trocar por um mockup.

## Observações para a pessoa
- Só a imagem 5 muda; o texto continua o aprovado.
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Parecer sem olhar as imagens e as miniaturas.
2. REPROVAR sem dizer a imagem, o problema e para quem volta.
3. Medida da conferência automática repetida como achado novo.

## Critérios de qualidade

- [ ] Cada achado cita a imagem e o que fazer.
- [ ] A volta é para quem pode corrigir: visual ao design, texto ao copy.
- [ ] Num post planejado, a fidelidade à promessa do plano foi conferida.
