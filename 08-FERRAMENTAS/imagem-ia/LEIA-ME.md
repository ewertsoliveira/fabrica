# Imagem por IA (foto realista, gratuita)

Gera fotos realistas a partir de uma descrição. É um arquivo só (`gerar.js`), sem instalar nada além do Node 18+.

## Como usar

```
node 08-FERRAMENTAS/imagem-ia/gerar.js "a female nutritionist in a white coat smiling in a bright clinic" --saida 06-MARCA-E-FOTOS/geradas/nutri.png
```

Opções: `--largura 1024 --altura 1024` (use 1080x1350 para feed, 1080x1920 para Reels/Stories), `--semente 42` (repete o
mesmo resultado), `--provedor pollinations|huggingface|cloudflare` (força um provedor).

A saída é uma linha JSON com `ok`, `provedor` e `arquivo`. A extensão do arquivo segue o formato real devolvido (em geral `.webp`, que o Canva, o Instagram e o navegador abrem; se precisar de PNG, converta). Em falha, sai com código 1 e lista o erro de cada provedor.

## Provedores (todos gratuitos)

O script usa o primeiro que tiver credencial e cai para o próximo se falhar.

| Provedor | Credencial | Qualidade | Observação |
|---|---|---|---|
| `huggingface` | `HF_TOKEN` | melhor (FLUX.1-schnell) | usa o Space público e gratuito do FLUX. A cota de GPU é diária e por conta: quando acaba, o script repete a chamada sem token (cota separada, por IP) e só então passa ao próximo provedor. Funciona até sem `HF_TOKEN`. A API paga de inferência da Hugging Face não é usada |
| `cloudflare` | `CF_ACCOUNT_ID` + `CF_API_TOKEN` | boa | cota diária grátis |
| `pollinations` | nenhuma | média | funciona na hora; a imagem pode vir com marca d'água do serviço |

Para configurar a chave da Hugging Face sem abrir arquivo nenhum: copie a chave no site (botão **Copy**) e rode `node 08-FERRAMENTAS/imagem-ia/guardar-token.js`; ele lê o que foi copiado, grava no `.env` e limpa a área de cópia, sem mostrar a chave. Quem prefere pode copiar `.env.example` para `.env` na raiz e preencher à mão. O `.env` não vai para o git.

## Para quem for operar (Claude ou pessoa)

- Foto realista de pessoa, lugar ou produto: use esta ferramenta. Peça de design com texto, logo ou cores da marca:
  não use IA de imagem; monte no laboratório de design e use a foto gerada só como fundo.
- **Escreva a descrição em inglês.** Em português o modelo ignora partes do pedido (testado: pedi nutricionista de jaleco e veio outra pessoa). Detalhe quem, o que faz, onde, luz e enquadramento. Evite pedir texto escrito dentro da foto.
- Mãos, dentes e letras costumam sair com defeito. Olhe o resultado antes de usar e gere de novo com outra `--semente`.
- Mostre a imagem para a pessoa aprovar (regra D-01) antes de colocá-la numa peça final.
- Marca d'água na imagem = provedor `pollinations`. Para peça final, configure `HF_TOKEN` ou Cloudflare.

## Levar para outro repositório

Copie a pasta `08-FERRAMENTAS/imagem-ia/` (2 arquivos: este e `gerar.js`) e o `.env.example`. Se o outro repositório usa
Claude Code, copie também `.claude/skills/imagem/SKILL.md` para o Claude acionar a ferramenta sozinho. Nada mais é preciso.
