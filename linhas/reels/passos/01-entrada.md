---
tipo: checkpoint
saida: saida/entrada.md
---

# Passo 1: Entrada do vídeo

Primeiro passo de cada Reels. Nenhum trabalho começa antes de este checkpoint estar respondido e salvo, **inclusive a
camada de produção e o modelo de edição**. As respostas orientam o script de preparo (passo 2), o plano editorial
(passo 3) e o quanto de trabalho sob medida entra no vídeo.

Todas as perguntas vão por pergunta estruturada (nunca em texto solto), no máximo 4 por chamada, de 2 a 4 opções cada.

## Pré-voo (antes de qualquer pergunta)

Nada de vídeo começa com programa faltando ou velho, e nenhum login ou cadastro pode ficar para o meio do trabalho.

1. Rodar `node _fabrica/core/ambiente.js` e `node _fabrica/core/ferramentas.js --verificar`.
2. Se algo do grupo "Para Reels (vídeo)" faltar, ou o `--verificar` disser **PRECISA**, rodar
   `node _fabrica/core/ferramentas.js` (instala e atualiza ffmpeg, Tesseract, whisper e modelos para a versão mais nova;
   nenhum desses downloads pede login) **antes** de seguir. Dizer o que vai baixar e pedir o "sim".
3. Se o Tesseract mudou de versão, registrar no relatório e conferir os quadros de teste antes de confiar nos modelos.
4. Só depois da conferência passar (todos "OK") seguir para a chamada 0. Se não passar, **parar e dizer o que falta**;
   nunca abrir a entrevista de estilo nem pedir o vídeo com o ambiente incompleto.
5. Contas: se for preciso entrar ou criar conta em qualquer serviço, é agora, antes da chamada 0, e a pessoa entra
   sozinha no navegador (nunca pedir senha ou chave na conversa).

## Contexto para o responsável

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra onde ficam os arquivos da empresa
nesta linha: `saidas` (a pasta dos `saida/...`), `memoria` (`runs.md`, `memories.md`) e `dadosLinha`
(`preferencias-aprovadas.md`, `biblioteca-de-modelos.md`). Os demais `dados/` (`briefing.md`, `camadas-de-producao.md`,
`entrevista-de-estilo.md`) são do modelo e ficam na linha.

Mostrar em uma linha os modelos aprovados hoje (lidos de `biblioteca-de-modelos.md`, na pasta `dadosLinha` da empresa
ativa) e o último Reels feito (`runs.md`, na pasta `memoria` da empresa ativa).

## Abertura: o que esta linha faz (sempre, antes de qualquer pergunta)

A primeira mensagem ao responsável diz, em duas frases e sem termo técnico: **"Aqui eu edito o vídeo que você já
gravou: corto as pausas, ponho legenda, desenhos e a chamada final. Não escrevo roteiro."** Se a pessoa disser que
ainda não gravou, ou que quer o texto do vídeo, avise que roteiro é outra linha (a de texto/roteiros da empresa, ou
`/fabricar` para montar uma) e pergunte se ela prefere seguir por lá. Não puxe pergunta sobre público, cuidados ou
desenhos antes de saber que é edição e de ter o arquivo do vídeo.

**Ordem do passo:** abertura, depois a chamada 1 (o vídeo), depois a chamada 0 (estilo) e só então a chamada 2. A
numeração é histórica; a ordem acima é a que vale.

## Chamada 0: estilo de vídeo (uma vez por empresa; roda depois da chamada 1)

Conferir se existe o `estilo-de-video.md` da empresa do run (caminho `estiloDeVideo` dos caminhos que o runner
passou; se faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`).

- **Existe:** mostrar o resumo em uma linha (formato do rosto padrão, tom e aviso fixo) e seguir. Não perguntar de novo.
- **Não existe:** **uma única pergunta**, com a recomendação em primeiro lugar:
  1. **"Edição rápida com o visual da sua marca" (recomendada).** Cria o `estilo-de-video.md` na hora, a partir do
     `marca.yaml` e dos padrões do exemplo (`06-MARCA-E-FOTOS/estilo-de-video.exemplo.md`): você em tela cheia quando só
     fala, cartão com desenho quando há elemento, tom meio a meio, cuidados padrão da área (sem promessa de resultado,
     sem valor como garantia, sem parecer fiscal individual). Marcar no arquivo "Padrão rápido, sem entrevista, em
     AAAA-MM-DD". Os quadros de teste aparecem na aprovação do plano (passo 5), onde a pessoa já olha o resultado.
  2. **"Personalizar com perguntas (uns 5 minutos)".** Roda a entrevista de `dados/entrevista-de-estilo.md`, com
     prévias e recomendação (V-09, D-01). O arquivo só é gravado depois da escolha e do OK nos quadros de teste.

  Quem escolher a rápida pode personalizar depois ("quero mudar o estilo"): nova entrevista, e o arquivo anterior fica
  guardado com a data. Cuidados específicos da área (a pergunta 6 da entrevista) o responsável pode acrescentar a
  qualquer momento; sem eles vale o padrão acima.

## Chamada 1: o vídeo

1. **Qual é o arquivo do vídeo?** Rode `node _fabrica/core/empresa.js midias <codigo do run> --json`: ele cria, se
   faltarem, as pastas de mídia da empresa e devolve `videos` (onde a pessoa solta os vídeos gravados). Opções: os 2 ou
   3 vídeos mais recentes dessa pasta (por data de modificação) e "Outro caminho" (a pessoa pode colar o caminho de um
   vídeo que está em outro lugar; a linha o usa sem mover nem apagar).
   **Pasta vazia e sem caminho:** não peça "o caminho do vídeo". Diga, em linguagem simples: "Coloque o vídeo nesta
   pasta: <caminho de `videos`>. Já abri ela para você. Avise quando estiver lá." e abra a pasta no explorador de
   arquivos do sistema (Windows: `explorer "<pasta>"`; Mac: `open "<pasta>"`; Linux: `xdg-open "<pasta>"`).
2. **Em que estado ele está?**
   - **Cru**, direto da câmera: o script corta as pausas, acelera a fala, ajusta a cor e aplica a transição nas viradas.
   - **Já pré-editado**: pausas cortadas e velocidade ajustada. A linha só aplica o modelo.
3. **Sobre o que é o vídeo e quem fala?** Uma frase.
4. **Alguma observação?** Opcional (transição desejada, chamada final, poses para a capa no começo).

## Chamada 2: camada de produção e modelo (obrigatórias)

Feita depois da chamada 1, para poder recomendar com base no vídeo. Ler `dados/camadas-de-producao.md` e
a `biblioteca-de-modelos.md` da empresa ativa (caminho `dadosLinha`).

5. **Qual camada de produção?** Mostrar a recomendação e o motivo em uma linha, mas listar as três (Expresso, Padrão,
   Vitrine, definidas em `dados/camadas-de-producao.md`).
6. **Qual modelo de edição?** Uma opção por modelo **aprovado** da biblioteca. A opção recomendada vem primeiro.
   Modelos em teste não são aprovados: só entram se o responsável escrever o nome em "Outro".
   **Empresa com estilo escolhido:** rode `node _fabrica/core/estilo-da-linha.js <codigo do run>` (só lê). Se ele mostrar
   um modelo de Reels, a primeira opção, recomendada, é "O modelo do seu estilo (<nome do estilo>)": o modelo de edição
   desse estilo (`formatos.reels.modelo`; num estilo próprio, o do estilo em que ele se baseia), já com as cores e as
   letras da marca da empresa. Sem estilo escolhido, ou sem modelo de Reels no estilo, as opções de sempre.
   Quando a pessoa trocar o estilo neste pedido, ou não usar nenhum, isso vale também para o registro da peça no
   Laboratório: o JSON da peça leva o estilo usado, ou `"estilo": null` (passo 6, item 7).

## Formato da resposta a salvar

```
# Entrada do vídeo

**Arquivo:** {caminho}
**Estado:** {cru | pré-editado}
**Assunto e apresentador:** {frase}
**Observações:** {texto livre ou "nenhuma"}
**Estilo de vídeo:** {estilo-de-video.md da empresa ativa, aprovado em AAAA-MM-DD}
**Camada de produção:** {Expresso | Padrão | Vitrine}
**Modelo de edição:** {nome}
**Modelo do estilo da empresa:** {código do modelo, com "usarMarca: true" | "não"}
**Data:** {AAAA-MM-DD}
```

## Regras

- **Sem `estilo-de-video.md` aprovado, a linha não planeja.** A entrevista (chamada 0) é feita uma vez e vale para os
  vídeos seguintes.
- **Sem as duas respostas (camada e modelo) gravadas em `entrada.md`, a linha não edita nada.** Se o responsável pular,
  perguntar de novo; nunca assumir um valor padrão.
- Se o arquivo não existir no caminho informado, pedir de novo; não seguir.
- Vídeo com mais de 90 segundos: avisar que o limite do Reels é 90 s e perguntar se quer cortar conteúdo.
- Se o estado não for informado, olhar o arquivo: áudio com pausas longas e velocidade natural indica vídeo cru.
- O modelo escolhido define a flag `--mascara` do passo 2: modelo com título ou elemento atrás do corpo precisa da
  máscara do vídeo inteiro.
