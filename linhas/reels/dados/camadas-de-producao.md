# Camadas de produção

**Regra permanente:** o passo 1 pergunta sempre a camada de produção e o modelo de edição, antes de qualquer trabalho.
Sem as duas respostas gravadas em `entrada.md`, a linha não edita nada. A camada define quanto trabalho sob medida
entra no vídeo e, portanto, tempo de máquina, tokens e quantos checkpoints o responsável atravessa.

| | Expresso | Padrão | Vitrine |
|---|---|---|---|
| Modelo de edição | o modelo base da empresa | o escolhido no passo 1 | o escolhido no passo 1 |
| O que entra | placas, selo, legenda, elemento de fundo, cartão final com CTA | Expresso + blocos de motion já existentes (esquema, mapa, ficha, diagrama) | ilustração e motion novos sob medida |
| Peças novas | nenhuma (só blocos prontos) | nenhuma peça nova de motion; só combinar o que existe | permitido, com amostra |
| Aprovação da estrutura | prancha de quadros do projeto real | prancha + **amostra em vídeo de ~10 s** | prancha + **amostra em vídeo de ~10 s** |
| Checkpoints | 2: plano + prancha (passo 5) e vídeo final (passo 8) | 2: plano + prancha + amostra (passo 5) e vídeo final | 2: igual ao Padrão |
| Quem executa o export (passo 6) | modelo leve | modelo leve | modelo leve |
| Planejamento (passo 3) | modelo leve | modelo leve | modelo mais forte |
| Capa | A (com pessoa) + 1 arte alternativa | A + 2 alternativas | A + 2 a 3 alternativas |

## Regras

1. **Escolha pelo responsável.** A linha pode recomendar, mas nunca decide sozinha.
2. **Subir de camada exige novo "sim".** Se durante o plano aparecer algo que só a camada acima entrega, o plano registra
   a necessidade e o responsável decide no passo 5; a linha não improvisa.
3. **Blocos da biblioteca.** Padrão usa só blocos de `08-FERRAMENTAS/tesseract/blocos-motion/`: `placa`, `selo`,
   `esquema-divisao`, `mapa-pontos`, `ficha-documento`, `diagrama-caixas`, `cartao-cta`, `contador`, `lista-marcavel`. Aplicar com
   `node blocos-motion/aplicar.js <projeto.tsrct> <blocos.json> --faixa y0,y1` depois do `montar-video.js`; as `janelas`
   que o `montar` devolve vão para `motion.janelas` da decupagem. O `cartao-cta` substitui o `cta` do `montar-video.js`,
   nunca soma. Bloco que não existir no catálogo é Vitrine.
4. **Amostra em vídeo de ~10 s** em Padrão e Vitrine: o trecho mais denso em motion, exportado no passo 4 e aprovado no passo 5 junto com a prancha. No Expresso a estrutura é aprovada só por prancha.
5. **Um export por versão**, qualquer camada, **em pelo menos 3 pedaços paralelos**.

## Pergunta do passo 1
Duas perguntas na mesma chamada: a camada (cada opção com uma linha do que entra) e o modelo (os aprovados em
`biblioteca-de-modelos.md`). Modelos em teste não são aprovados e só entram se o responsável pedir.
