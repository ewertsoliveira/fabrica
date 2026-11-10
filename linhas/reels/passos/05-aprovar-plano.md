---
tipo: checkpoint
saida: saida/plano-aprovado.md
---

# Passo 5: Aprovar plano e estrutura

**O checkpoint de aprovação da edição** (um por vídeo; o outro é o do vídeo final, passo 8). O plano (`plano.md`, com as
quatro lentes) e a **prancha de quadros do projeto real** (`estrutura.md`, passo 4) chegam juntos. Existe antes do
export porque exportar custa minutos e é difícil de desfazer sem retrabalho. **Em Padrão e Vitrine o checkpoint inclui a
amostra em vídeo de ~10 s** (`<pasta>/amostra/amostra-v1.mp4`, feita no passo 4 com o plano já fechado): o responsável
aprova olhando a prancha **e** a amostra. Em Expresso (sem motion novo) a prancha basta.

Perguntas por pergunta estruturada. **Decisão gráfica nunca por texto:** a prancha é o que o responsável olha.

## O que apresentar

Em linguagem simples, sem JSON, em uma tela só. Para cada item, o segundo exato e uma frase de motivo:

1. **A prancha:** caminho de `conf/prancha-estrutura.png` (abrir para olhar) e a lista dos momentos mostrados.
2. **Gancho:** texto da headline de abertura e janela; se houver 2 ou 3 opções, mostrar todas.
3. **Palavras em destaque:** lista com o segundo da fala.
4. **Modelo e transições:** o modelo escolhido, a transição de cada virada e como o vídeo difere do anterior.
5. **Gráficos:** o que entra, quando e por quê. Com elemento na tela, mostrar a **tabela de cenas** (V-08) em linguagem
   simples: o que aparece em cada trecho, em qual palavra e com que formato do rosto.
6. **Fechamento:** argumento e frase do botão.
7. **Capa:** a frase da capa e quantas artes alternativas a camada pede.
8. **Decisões que dependem do responsável:** dados ilustrativos, fato que a fala não sustenta, peça que exigiria subir de camada, viradas diferentes das propostas.

## Perguntar

**O plano e a estrutura estão aprovados para exportar?**

1. Sim, pode exportar.
2. Quero ajustar algo. Ajuste de execução (posição, tempo, texto) volta ao passo 4 com a mesma estação; mudança de plano
   volta ao passo 3; viradas diferentes pedem `preparar-material.js --viradas ... --refazer` e depois os passos 3 e 4.
3. Trocar o modelo, a camada ou a transição. Volta ao passo 1 (camada e modelo) ou ao passo 3 (transição).

## Formato da resposta a salvar

```
# Plano aprovado

**Camada:** {Expresso | Padrão | Vitrine} | **Modelo:** {nome}
**Gancho:** {texto, janela}
**Palavras-chave:** {frase → palavra, segundo}
**Transições:** {lista}
**Gráficos:** {lista com tempos}
**Fechamento:** {argumento, botão, tempos}
**Frase da capa:** {texto}
**Ajustes pedidos:** {lista ou "nenhum"}
**Prancha aprovada:** {caminho}
**Data:** {AAAA-MM-DD}
```

## Regras

- Não passar ao passo 6 sem um "sim" explícito. Em Padrão e Vitrine, o "sim" só vale se a amostra de ~10 s foi mostrada neste checkpoint.
- O passo 6 roda em modelo leve (estação nova que lê `estrutura.md`), em qualquer camada.
- Registrar qualquer preferência nova do responsável, ao final, no `memories.md` (pasta `memoria` da empresa ativa) e no
  `preferencias-aprovadas.md` (pasta `dadosLinha` da empresa ativa), ambos dos caminhos que o runner passou (se
  faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`). O `saida/plano-aprovado.md`
  fica na pasta de saídas (`saidas`) da empresa do run.
