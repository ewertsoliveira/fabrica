# Entrevista de estilo de vídeo

Roteiro para descobrir **como os vídeos da empresa devem parecer**, sem exigir que o responsável entenda de vídeo.
O resultado é o `estilo-de-video.md` da empresa do run (caminho `estiloDeVideo` dos caminhos que o runner passou; se
faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`;
modelo em `06-MARCA-E-FOTOS/estilo-de-video.exemplo.md`).

Regras de base: **V-09** (`05-ESTRATEGIA/nucleo-de-conteudo/regras/11-video.md`) e **D-01**
(`regras/12-decisao-visual.md`). O responsável responde, a linha traduz. Ele nunca precisa dizer "formato",
"transição" ou "motion".

## Quando roda
- No **passo 1** da linha de Reels, **uma vez por empresa, e só se a pessoa escolher "Personalizar"**: sem o
  `estilo-de-video.md`, a linha oferece primeiro a edição rápida com o visual da marca (ver `passos/01-entrada.md`) e só
  roda esta entrevista se ela preferir personalizar. Quem só quer editar um vídeo não passa por aqui. Se o arquivo
  existir, a linha só o lê e mostra o resumo em uma linha.
- Quando o responsável reprovar o visual de uma peça e não souber dizer por quê.
- Para mudar de estilo: nova entrevista, e o arquivo anterior é guardado com a data no nome.

## Antes de perguntar (a linha prepara)
1. Usar a **identidade visual escolhida** na chamada de identidade visual do passo 1 (campo **Identidade visual** de
   `entrada.md`): a da empresa (`marca.yaml`, caminho `marca`) ou as cores originais do estilo escolhido. Nunca gere as
   imagens sem essa resposta (L-04).
2. Gerar **três imagens paradas** do vídeo (para a linha: quadros dos layouts), com o vídeo real da empresa se houver,
   ou com o vídeo de amostra e a declaração de que é exemplo (D-02):
   - **A, você em tela cheia**, só com legenda.
   - **B, você num cartão, com os desenhos em cima** (modelo Palco, `08-FERRAMENTAS/tesseract/modelos/`).
   - **C, só o desenho**: o cartão sai e a ilustração ocupa a tela.
3. Gerar duas imagens do ritmo (calmo e enérgico) com a mesma frase.
4. Reunir tudo numa única página aberta com letras A, B, C (D-01, itens 4 e 5) e dar o caminho no mesmo turno.

## Como explicar à pessoa (antes de mostrar a página; L-01)
Ela não sabe o que é um "quadro" nem o que está sendo comparado. Antes da página, diga com palavras simples, por
exemplo: **"Vou te mostrar imagens paradas do seu próprio vídeo, como fotos de um momento dele. Todas já estão com
<as suas cores e letras | as cores originais do estilo X>, então você não está escolhendo cores. Você vai escolher duas
coisas: onde você aparece na tela (três jeitos, A, B e C) e o ritmo (as coisas entram devagar ou rápido). Uso o seu
vídeo para você ver como você fica de verdade, por exemplo se o cartão corta o seu rosto."** Na página, cada imagem tem
uma frase do que muda e repete o que é igual entre todas (L-02). Nunca escreva "quadros A/B/C" ou "calmo × enérgico"
sozinhos (L-03).

## As perguntas (uma chamada, no máximo seis)

| # | Pergunta, nas palavras do responsável | Opções | O que vira no estilo |
|---|---|---|---|
| 1 | "Quem assiste aos seus vídeos? Pessoas que já te conhecem ou que ainda não?" | já conhecem / não conhecem / os dois | tom de abertura (direto ou com apresentação) |
| 2 | "Quais são três objetos ou situações do seu dia a dia de trabalho que o seu público reconhece de cara?" | resposta livre | os desenhos e ícones por tipo de frase |
| 3 | "Qual destes dois jeitos parece mais com você?" (mostra calmo e enérgico) | calmo / enérgico / meio a meio | ritmo e intensidade dos movimentos |
| 4 | "Qual destes três jeitos de aparecer você prefere?" (mostra A, B e C) | A / B / C / varia | formato do rosto padrão (recomendar B quando houver elemento na tela) |
| 5 | "Tem algum vídeo, de qualquer pessoa, que você acha bonito ou parecido com o que quer?" | link, arquivo ou "não" | referência para análise (abaixo) |
| 6 | "O que você NUNCA pode dizer ou mostrar na sua área?" (preço, promessa, resultado, diagnóstico) | resposta livre | cuidados e avisos fixos (V-05) |

Cada pergunta traz a **recomendação da linha** e o motivo em uma frase. Pergunta que não for visual segue em texto
(D-01, exceção).

## Depois das respostas
- Com referência (pergunta 5): analisar a 4 quadros por segundo com detecção de cortes, extrair estrutura, peças e
  transições e descrever o que serve, **sem copiar marca, texto, personagem ou arte do original**.
- Preencher `estilo-de-video.md` e gerar **dois a três quadros de teste** com a fala real da empresa. Mostrar e pedir
  aprovação antes de produzir a primeira peça. Nada é gravado antes da escolha (D-01, item 7).
- Guardar a resposta, com a data, no próprio arquivo de estilo. A pergunta não se repete nos vídeos seguintes.

## Glossário em linguagem simples
Use sempre a coluna da esquerda com o responsável. A da direita é para a linha.

| Diga ao responsável | Termo técnico |
|---|---|
| "Você em tela cheia" | vídeo falado, plano médio, sem layout |
| "Você num cartão, com desenhos em cima" | layout dividido (modelo Palco): ilustração acima, vídeo em cartão de cantos arredondados |
| "Só o desenho, e você volta depois" | cartão sai pela base; tela cheia de ilustração |
| "A palavra importante aparece escrita" | legenda de ênfase / título temporário |
| "Um número que vai subindo" | bloco `contador` |
| "Uma lista que vai sendo marcada" | bloco `lista-marcavel` |
| "O desenho muda quando você fala" | mudança de estado do objeto na palavra de gatilho |
| "Uma etiqueta apontando para a parte" | etiqueta de linha fina |
| "Os dois lado a lado" | comparação A × B (`diagrama-caixas`) |
| "O fim com um convite" | chamada para ação (CTA) |
| "Uma frase que fecha o raciocínio" | frase-síntese |
| "O aviso pequeno no alto" | aviso fixo de ilustração ou simulação (V-05) |
| "Uma imagem parada do vídeo, como foto de um momento dele" | quadro (frame) de exemplo ou de teste |
| "O ritmo: as coisas entram devagar ou rápido" | tom calmo × enérgico |
| "O jeito dos seus vídeos" / "guardar para os próximos vídeos" | `estilo-de-video.md` / gravar o arquivo de estilo |
| "A sua identidade visual (cores, letras e logo)" | `marca.yaml` / contrato de marca |
