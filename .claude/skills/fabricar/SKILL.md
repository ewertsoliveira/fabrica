---
name: fabricar
description: "Cria uma Linha de Produção nova na Fábrica de Conteúdo a partir de uma descrição. Atalho para /fabrica criar."
---

# /fabricar

Atalho para o fluxo de criação da Fábrica de Conteúdo: `/fabricar <o que você precisa>` equivale a
`/fabrica criar <o que você precisa>`.

## O que fazer

1. Carregar a skill `fabrica` (`.claude/skills/fabrica/SKILL.md`) e executar a **Inicialização** dela (descobrir a empresa
   ativa, perfil da empresa e preferências), incluindo a pergunta "Para qual empresa vamos trabalhar agora?" quando houver
   duas ou mais empresas e nenhuma escolhida, e o onboarding se a empresa ainda não estiver configurada.
2. Se `_fabrica/core/arquiteto.agent.yaml` ou os prompts de `_fabrica/core/prompts/` **não existirem**, informar em uma
   frase que a criação guiada não está instalada nesta Fábrica. Oferecer: copiar `linhas/reels/` como ponto de partida e
   editar os arquivos à mão, ou aguardar a instalação.
3. Se existirem, carregar o Arquiteto e seguir o fluxo de criação com a descrição recebida. Se a descrição vier vazia,
   perguntar o que a pessoa precisa produzir, em uma pergunta só.

## Regras

- Uma linha nova nasce em `linhas/<nome>/` com a mesma estrutura de `linhas/reels/` (`linha.yaml`, `estacoes/`,
  `passos/`, `dados/`, `LEIA-ME.md`).
- Nada de nome de empresa, cor, fonte ou conta dentro de estação ou passo: o valor mora no contrato de marca da empresa
  ativa (o caminho `marca` devolvido por `node _fabrica/core/empresa.js caminhos --json`); a estação fala em papéis
  ("cor de acento").
- Antes de dar a linha por pronta, rodar o validador anti-vazamento sobre ela.
