---
name: imagem
description: "Gera foto realista por IA gratuita (pessoas, lugares, produtos). Use sempre que a pessoa pedir foto, imagem realista ou fundo fotográfico em vez de ilustração."
---

# /imagem

Gera uma foto realista com `08-FERRAMENTAS/imagem-ia/gerar.js`. Leia `08-FERRAMENTAS/imagem-ia/LEIA-ME.md` se precisar
dos detalhes de provedores e credenciais.

## O que fazer

1. Montar uma descrição detalhada **em inglês** (o modelo ignora partes do pedido em português): sujeito, ação, cenário,
   luz, enquadramento. Sem texto escrito dentro da imagem.
2. Escolher o tamanho pelo destino: 1080x1350 feed, 1080x1920 Reels/Stories, 1024x1024 quadrado.
3. Rodar: `node 08-FERRAMENTAS/imagem-ia/gerar.js "<descrição>" --saida <pasta>/<nome>.png --largura N --altura N`.
   A extensão final segue o formato devolvido (em geral `.webp`); usar o caminho que o comando imprimir.
4. Ler a imagem gerada, conferir mãos, rosto e letras e mostrar à pessoa para aprovação antes de usar.
5. Se o resultado vier com marca d'água, informar que veio do provedor sem chave e sugerir configurar `HF_TOKEN` (grátis). Guie a pessoa sem pedir que abra arquivo: ela copia a chave no site e você rode
   `node 08-FERRAMENTAS/imagem-ia/guardar-token.js` (passo a passo em `INSTALAR.md`, seção "Fotos sem marca d'água").

## Regras

- Peça com texto, logo e cores da marca não é feita pela IA de imagem: a IA gera só a foto de fundo.
- Se falhar em todos os provedores, dizer qual erro apareceu e propor tentar de novo ou configurar outro provedor.
- Nunca escrever chave ou token em arquivo versionado; só em `.env`.
