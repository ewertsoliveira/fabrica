# Catálogo de skills da Fábrica

Este é o **catálogo próprio** da Fábrica. Ele **começa vazio** e cresce por decisão do responsável, uma skill por vez.
A Fábrica não aponta para nenhum catálogo externo.

## Estrutura

```
_fabrica/
  catalogo-de-skills/       skills disponíveis para instalar nesta Fábrica
    _modelo/SKILL.md        modelo para criar uma skill nova (pastas com "_" são ignoradas)
    <nome>/SKILL.md         uma skill do catálogo (+ scripts/, references/, assets/ se precisar)
  skills/                   skills instaladas (as que as linhas realmente usam)
```

Uma skill está **instalada** se, e só se, existe `_fabrica/skills/<nome>/SKILL.md`. Não há arquivo de registro.

## Como uma skill entra no catálogo

1. Crie `_fabrica/catalogo-de-skills/<nome>/SKILL.md` a partir de `_modelo/SKILL.md`.
2. Rode `node _fabrica/core/skills.js validar _fabrica/catalogo-de-skills/<nome>`.
3. Rode o validador anti-vazamento sobre a pasta da skill: skill do catálogo não carrega identidade de empresa nem
   segredo (chave de API vai em `.env`, nunca no arquivo).
4. Commit. O catálogo só cresce por skill revisada.

Operações completas (instalar, criar, remover, resolver para uma linha): `_fabrica/core/skills.engine.md`.

## Skills nativas

`busca-web` e `leitura-web` já vêm com o Claude Code e não precisam de instalação. Uma linha só pede skill do catálogo
quando as nativas são claramente insuficientes.
