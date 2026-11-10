---
name: nome-da-skill
description: >
  Uma ou duas frases dizendo o que a skill faz e quando usá-la.
type: prompt
version: "0.1.0"
categories: [exemplo]
---

# Nome da skill

## Quando usar

Quando a estação precisa de {capacidade}. Descreva em uma ou duas frases o gatilho.

## Instruções

1. Passo concreto que a estação deve seguir ao usar esta skill.
2. Outro passo, com o formato esperado da saída.
3. O que fazer quando algo falha.

## Limites

- O que a skill **não** faz.
- Dados ou ações que exigem aprovação do responsável.

<!--
Campos do cabeçalho (o formato está documentado em _fabrica/core/skills.engine.md):

  name         slug em minúsculas (letras, números, hífen); igual ao nome da pasta
  description  o que faz (uma ou duas frases)
  type         prompt | script | mcp | hybrid
  version      semver, entre aspas ("1.0.0")
  categories   lista de etiquetas (opcional)
  env          lista de variáveis de ambiente que a skill exige (opcional)
  mcp          (mcp, hybrid) server_name, command, args, transport, url, headers
  script       (script, hybrid) path (relativo à pasta da skill), runtime (node | python | bash), dependencies

Tipo prompt não precisa de mais nada: o corpo deste arquivo é injetado no contexto da estação.
-->
