# Estação: Gancho e palavras-chave

**Papel:** abre e fecha o plano. Decide como o vídeo começa, quais palavras ganham destaque, onde entram as headlines
temporárias, onde estão as viradas de assunto e como o final reabre o começo. É a estação principal do passo 3.

**Entradas:** `saida/material.md` (na pasta de saídas da empresa ativa; frases com índice e tempo), `palavras.json` do vídeo editado, camada e modelo do
passo 1.

**Saída:** a seção "1. Gancho e palavras-chave" do `plano.md` (e a frase da capa, que o passo de capa usa sem esperar o vídeo).

## Princípios

1. O gancho aparece nos primeiros 2 segundos, em fala ou em headline. Sem logo, sem introdução de canal, sem "olá".
2. Uma palavra-chave por frase, no máximo. Se tudo é destaque, nada é destaque.
3. A headline temporária só existe quando o assunto é citado, por 3 a 5 segundos, nunca o vídeo inteiro.
4. O tempo é sempre ancorado na palavra falada em `palavras.json` do vídeo editado, nunca em subtração de duração.
5. A legenda reproduz a fala; a linha não corrige a gramática do apresentador nem muda o sentido.
6. Nenhuma promessa numérica ou de resultado em texto de tela (a restrição do setor, se houver, vence: ver `setor/`).
7. O final conecta ao começo: a última ideia retoma a promessa do gancho, para favorecer o replay.
8. A palavra mais importante da headline é destacada só por cor (nunca por tamanho); se coincidir com o elemento de
   fundo na mesma cor, o destaque vai para a parte fora dele.

## Anti-padrões

**Nunca:** abrir com logo, nome da empresa ou saudação; marcar três palavras por frase; escrever uma headline que repete
a fala palavra por palavra; usar o tempo de uma palavra do vídeo bruto; pôr headline na cor de acento sobre elemento da
mesma cor.

**Sempre:** sugerir duas ou três opções de gancho quando a fala permite (o responsável escolhe olhando, não por
adjetivo); conferir os índices de frase em `palavrasChave` (mudam quando a segmentação do whisper muda); registrar o
motivo de cada palavra-chave.

## Formato da seção

```
## 1. Gancho e palavras-chave
### Gancho            (opção | texto | janela | motivo; recomendada; razão para ficar V-01 em uma frase)
### Palavras-chave    (frase | palavra | tempo | motivo)
### Headlines         (texto | linhas | janela | observação)
### Viradas de assunto (segundo | de → para | motivo)
### Final para o loop (uma frase)
### Frase da capa
```
