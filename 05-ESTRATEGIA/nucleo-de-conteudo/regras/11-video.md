# 11 — Vídeo

Regras de vídeo válidas para qualquer empresa. A numeração segue a do Núcleo
de origem: as regras V-01 a V-09 estão aqui; as demais regras de vídeo curto
ainda não foram exportadas para cá.

---

## V-01 — Portão dos primeiros segundos
Todo vídeo curto passa por este portão antes da entrega:

1. **Razão para ficar.** Até o terceiro segundo existe uma razão específica
   para continuar assistindo, dita e mostrada. O revisor escreve essa razão em
   uma frase; se não conseguir, reprova.
2. **Promessa cumprida.** A promessa feita no começo é cumprida dentro do
   vídeo, antes do pedido final.
3. **Sem trecho morto.** Nenhum trecho passa muito tempo sem um evento novo. O
   limite em segundos é parâmetro do formato, declarado por cada cliente, não
   regra do núcleo.

Reprovou em qualquer item: volta para a etapa de gancho.

---

## V-02 — Uma peça nova a cada 2 a 3 segundos
**Conferência:** recomendação. O revisor lista os eventos visuais por segundo na prancha e marca trecho com mais de 3 s sem evento.

Em vídeo falado com elementos na tela, um **elemento visual novo** (ilustração,
número, etiqueta, mudança de estado de um objeto) entra a cada 2 a 3 segundos.
O **formato do rosto** (tela cheia, cartão, faixa) muda a cada 5 segundos, no
máximo, e só quando o assunto muda. Referência medida em vídeos de
demonstração: um evento visual a cada ~3 s num vídeo de 50 s.

**Troca de quadro com tempo para assimilar.** Quando o formato do rosto muda
para mostrar um elemento em destaque (B-roll com o elemento e a pessoa em
miniatura, tela dividida, cartão), esse quadro fica na tela **pelo menos 4 s**.
Troca de quadro de 2 s não deixa a edição dinâmica, deixa confusa: a audiência
não tem tempo de entender a informação nova. O ritmo de 2 a 3 s vale para os
elementos que entram **dentro** de um quadro, não para a troca de quadro.
Conferível: `conferir-tabela-de-cenas.js` reprova quadro de destaque com menos
de 4 s, e os modelos de edição estendem o B-roll curto até 4,5 s.

**A pessoa nunca sai de cena.** Nesse quadro, o elemento em destaque e a pessoa
aparecem **juntos**, no mesmo frame. A forma varia (miniatura, círculo, tela
dividida, lado a lado, pessoa recortada sobre a imagem), mas a imagem nunca
ocupa a tela sozinha. O rosto fica inteiro e visível, com folga acima da
cabeça e o queixo longe da borda da janela; se sobra espaço acima da pessoa,
sobe a pessoa, e nenhum elemento gráfico fica sobre o rosto. Corpo recortado
fica dentro da forma (círculo) ou se dissolve na base, nunca termina numa linha
reta solta.

Complementa F-17 (cortes a cada 3-5 s) e V-01 item 3. O limite em segundos
continua sendo parâmetro do cliente.

## V-03 — O visual entra na palavra que o nomeia
**Conferência:** conferível. No plano, cada elemento tem o tempo da palavra de gatilho em `palavras.json`; entrada mais de 0,3 s antes ou depois da palavra reprova.

Cada elemento visual entra **na palavra falada que o nomeia**, com antecipação
de cerca de 4 quadros (≈ 0,13 s a 30 qps), para o olho chegar junto com o
ouvido. Ele não chega depois da palavra nem muito antes dela.

- O roteiro descritivo (F-50) já traz a frase de gatilho; o tempo de entrada é
  o da palavra marcada, menos a antecipação.
- Mudança de estado de um objeto (rachar, escurecer, virar contorno, marcar
  caixa) começa na palavra, nunca no fim da frase.
- Número que cresce (contador) sobe durante a frase e para no valor final
  quando a frase termina.

## V-04 — Áreas seguras (vídeo vertical 1080×1920)
**Conferência:** conferível. O bloco `validar` recusa faixa que termina abaixo de y 1320; a prancha do passo 4 é olhada com a interface sobreposta.

- O primeiro quadro é a capa: o título do gancho já está inteiro nele.
- **Margens laterais:** pelo menos 90 px.
- **Coluna dos botões da plataforma:** ~130 px à direita, sem nada importante.
- **Base:** a interface da plataforma cobre de y = 1520 para baixo. Nada
  importante ali.
- Em layout dividido (modelo Palco: ilustração em cima, rosto em cartão embaixo): ilustração
  em y ≈ 250–800, cartão do rosto em y ≈ 820–1300 (ou até 1500 quando o rosto
  precisa de mais área), legenda em y ≈ 1360–1480.
- Antes da entrega, conferir quadros do vídeo exportado com a interface da
  plataforma sobreposta. Não vale conferir só no editor.

## V-05 — Honestidade visual
**Conferência:** conferível. Ilustração ou simulação sem aviso fixo reprova; número, preço ou resultado sem fonte reprova.

- Logo real sempre que a fala citar uma marca (arquivo oficial, nunca redesenho).
- Foto e tela reais, com autorização de quem aparece.
- **Nunca inventar** número, preço, resultado, depoimento, tela de aplicativo ou
  dado. Ilustração ou simulação **diz que é** ilustração ou simulação, escrito
  na tela, em um aviso fixo e pequeno no topo, do começo ao fim.
- Quando a pessoa que aparece interpreta uma profissão que não é a dela (papel,
  encenação), o aviso diz isso ("simulação; não sou [profissão]") e a
  profissão correta de cada afirmação técnica é conferida por quem entende
  dela antes de publicar.

## V-06 — Níveis de som
**Conferência:** conferível por medição (`mixar-audio.js` e medidor de volume do ffmpeg); níveis fora da faixa pedem nova mixagem.

Valores de partida; o cliente aprova o que prefere ouvindo uma amostra.

- Voz: cerca de −20 LUFS.
- Efeitos sonoros: 3 a 6 LU **abaixo** da voz.
- Trilha (se houver): 15 a 22 LU abaixo da voz, com abaixamento automático
  quando a voz fala.
- Cada batida visual importante tem um som (passagem, estalo, impacto).
  Som de teclado existe **só enquanto algo está sendo digitado na tela**, no
  ritmo humano, e nunca quando a pessoa está falando o mesmo texto.
- Sons só de biblioteca livre de direitos; nunca som de marca.

## V-07 — Todo efeito tem função
**Conferência:** recomendação. O revisor pergunta, para cada efeito, "o que ele explica, destaca ou avisa?".

Efeito que não explica, não destaca nem avisa é decoração e sai.

- **Chegada:** suave, de 0,5 a 0,7 s, saindo de um leve desfoque e de ~94% do
  tamanho. Sem "mola" que passa do ponto.
- **Texto:** letras ou palavras entram uma a uma, com ~0,1 s entre elas; a
  palavra de ênfase muda de cor ou de escala.
- **Forma virando outra:** quando o assunto passa de um elemento a outro, o que
  está na tela se transforma no próximo, em vez de sumir e outro aparecer.
- **Câmera:** aproximação lenta ou deslocamento entre elementos; nada fica
  completamente parado.
- **Rastro:** o que viaja pela tela deixa um rastro curto.
- **Linha que se desenha:** rota, gráfico e sublinhado crescem do começo ao fim,
  na direção da leitura.

## V-08 — Tabela de cenas aprovada antes de produzir
**Conferência:** conferível. `node 08-FERRAMENTAS/tesseract/conferir-tabela-de-cenas.js <tabela.md>` reprova coluna faltando, tempo fora de ordem e formato de rosto fora do glossário. Teste calibrado: `--autoteste`.

Nenhum vídeo com elementos na tela entra em produção sem uma **tabela de
cenas aprovada** por quem decide. Cada linha traz:

| Campo | O que é |
|---|---|
| Tempo | início e fim, em estimativa (F-52) |
| Fala | as palavras ditas na cena |
| Formato do rosto | tela cheia, cartão, faixa (nomes do guia ao cliente) |
| O que aparece | o elemento e a palavra que o dispara (V-03) |
| Como se move | entra, muda, sai, em linguagem simples |

A tabela é derivada do roteiro falado e do roteiro descritivo (F-49 a F-51),
não escrita à parte. Alteração depois da aprovação volta para aprovação.

## V-09 — Quem decide não precisa saber de vídeo
**Conferência:** conferível. Pergunta ao responsável sem prévia reprova (ver D-01); sigla ou termo técnico sem explicação na mesma frase reprova.

O cliente não conhece formato, elemento, transição ou termos de edição. Toda
decisão que depende dele é feita assim:

1. **Pergunta de uma frase**, em linguagem do dia a dia, com 2 a 3 opções.
2. **Cada opção vem com uma prévia** que ele vê (quadro ou vídeo curto), nunca
   só descrita em texto. Decisão gráfica pedida por texto é decisão mal feita.
3. **Uma recomendação clara** entre as opções, com o motivo em uma frase.
4. **Sem sigla e sem termo técnico.** Se o termo for inevitável, aparece com a
   explicação na mesma frase.
5. A resposta dele vira parâmetro no arquivo de estilo do cliente, e a
   pergunta não se repete nas peças seguintes.

Reforça D-01 (`regras/12-decisao-visual.md`) e é o caso de vídeo das regras L-01 a L-06 (`regras/13-explicar-o-processo.md`), que valem para a Fábrica inteira. O roteiro dessa conversa e o glossário em linguagem simples estão em
`dados/entrevista-de-estilo.md` da linha de Reels; o resultado fica no `estilo-de-video.md` da empresa ativa.
