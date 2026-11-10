---
name: atualizar
description: "Atualiza a Fábrica de Conteúdo com as melhorias do modelo, sem perder o que é da sua empresa (marca, linhas, decisões)."
---

# /atualizar

Traz as melhorias da Fábrica de Conteúdo para esta pasta. Quem usa é, em geral, gente de negócio, não de tecnologia:
**fale simples, sem jargão de git, e nunca mostre caminho de arquivo a menos que a pessoa peça.**

O comando faz a troca **por arquivo** (`_fabrica/core/atualizar.js`). Ele só mexe no que pertence ao modelo (lista em
`_fabrica/propriedade.json`). **Nunca** toca em: a marca da empresa, o perfil, as decisões, as linhas que a empresa
criou, as saídas e a memória. A pasta `empresas/`, com todas as empresas criadas, também nunca é tocada. Faz backup antes de trocar e mantém o que a empresa personalizou. A cópia de segurança da organização da pasta (`/fabrica organizar-pasta`, guardada em `_fabrica/_backup/`) também nunca é tocada.

## O que fazer, nesta ordem

1. **Proteção.** Rode `node _fabrica/core/atualizar.js trava`.
   - Saída 3: esta pasta está ligada ao repositório do modelo com envio habilitado. Explique em uma frase ("para não
     alterar o modelo sem querer, vou desligar o envio desta pasta") e rode `node _fabrica/core/atualizar.js proteger`.
   - Saída 0: siga.
2. **Verificar.** Rode `node _fabrica/core/atualizar.js verificar`.
   - **Código 0:** diga "Sua Fábrica já está na versão mais recente." e pare.
   - **Código 10:** há novidade. Apresente em linguagem simples: a versão atual e a nova, **as novidades** (lista curta) e
     quantos arquivos mudam. Se houver arquivos personalizados pela empresa, diga que **serão mantidos**.
   - **Código 1:** mostre o motivo em uma frase. Se for acesso ("o repositório é privado"), diga que é preciso pedir
     acesso a quem mantém a Fábrica. Nada foi alterado.
3. **Confirmar.** Pergunte por `AskUserQuestion` (2 a 3 opções):
   - **Atualizar agora**: troca os arquivos e guarda um backup.
   - **Ver o que muda**: lista os arquivos (e volte à pergunta depois).
   - **Agora não**: não faz nada.
4. **Aplicar.** Com "Atualizar agora", rode `node _fabrica/core/atualizar.js aplicar`.
   - Nunca use `--forcar` sem a pessoa pedir: ele sobrescreve o que a empresa personalizou (com backup).
   - Se houver arquivos mantidos, diga: "Algumas coisas que você personalizou foram mantidas. A versão nova delas ficou
     guardada para você comparar quando quiser."
5. **Terminar.** Diga o que mudou, em duas ou três linhas, e **avise: "Feche e abra o Claude Code de novo para os
   comandos novos aparecerem."** Esse aviso é obrigatório: as skills só carregam quando a sessão abre.
6. **Histórico (opcional).** Se a pasta for um repositório, pergunte se quer guardar a atualização no histórico. Se sim:
   `git add -A` e `git commit -m "Atualização da Fábrica para a versão X"`. **Nunca** rode `git push` nem `git pull`.

## Regras

- **Nunca** apagar nem sobrescrever a marca, o perfil, a memória e as decisões de nenhuma empresa (os caminhos que
  `node _fabrica/core/empresa.js caminhos <codigo> --json` devolve para cada uma), nem as linhas próprias, as saídas
  ou a memória das linhas. A atualização **nunca toca** a pasta `empresas/` (a de todas as empresas, não só a da
  ativa) nem `_fabrica/_memoria/` (perfil da pasta antiga e preferências de quem usa a Fábrica). O script não toca
  neles, e você também não.
- **Nunca** enviar nada para o repositório do modelo.
- Se o script falhar no meio, não tente consertar à mão: informe e peça ajuda a quem mantém a Fábrica. O backup está em
  `_fabrica/_backup/`.
- **Nada de jargão:** diga "atualização", "melhorias", "o que você personalizou", e não "merge", "remoto", "commit".
