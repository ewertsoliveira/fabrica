# 13 — Explicar o processo

Regras sobre como a Fábrica conversa com quem a usa. Valem para o Arquiteto, para todas as estações, para o runner e
para as skills `fabrica`, `fabricar`, `atualizar` e `imagem`, em qualquer empresa.

Quem usa a Fábrica não é técnico e não conhece o jeito dela trabalhar. Ela não sabe o que é um "quadro", um "modelo de
edição", uma "camada de produção" ou um "checkpoint", nem adivinha se uma prévia já está com as cores dela. Quando a
pessoa precisa perguntar "o que significa isso?", a Fábrica já falhou.

---

## L-01 — Antes de fazer, dizer o que vai acontecer
**Conferência:** recomendação (sem teste automático: depende de ler a conversa). A revisão de qualquer passo, skill ou
roteiro novo confere os itens abaixo nas falas que vão para a pessoa.

Antes de começar qualquer processo que a pessoa não pediu com essas palavras (uma entrevista, uma página de prévias,
uma montagem, uma exportação, a criação de uma linha), a Fábrica diz, em até cinco frases curtas:

1. **O que vai fazer**, com palavras do dia a dia ("vou montar três imagens paradas do seu vídeo").
2. **Por que** isso ajuda a pessoa ("para você escolher olhando, não lendo").
3. **Com o quê**: o vídeo, o texto, as fotos e **a identidade visual** que vai usar. Se a prévia usa as cores e as
   letras da empresa, diga ("todas já com as suas cores e letras"). Se não usa, diga também e o motivo. A pessoa nunca
   adivinha se está olhando a marca dela.
4. **O que ela vai receber ou ver** e **o que vai precisar decidir** ("depois você me diz a letra da que preferir").
5. **Quanto demora**, quando passar de um minuto ("uns 5 minutos").

## L-02 — Toda pergunta vem com o porquê
Cada pergunta à pessoa diz, na mesma mensagem, por que ela está sendo feita e o que muda com a resposta. Ao mostrar
opções, diga **o que é igual entre elas e o que muda** ("as três têm as suas cores; o que muda é onde você aparece na
tela"). A recomendação vem primeiro, com o motivo em uma frase (D-01 e V-09 continuam valendo).

## L-03 — Nome interno não é explicação
Nome de arquivo, de pasta, de comando, de regra ou de etapa interna nunca explica nada à pessoa. Os da esquerda não
aparecem sozinhos na conversa; use a forma da direita (o arquivo pode ir junto como link, nunca no lugar da frase):

| Nunca sozinho | Diga |
|---|---|
| "quadros A, B e C" | "três imagens paradas do vídeo, cada uma com um jeito de montar a tela" |
| "calmo × enérgico" | "o ritmo: as coisas entram devagar ou rápido" |
| "modelo de edição" | "o jeito de montar o vídeo" |
| "camada de produção" (Expresso, Padrão, Vitrine) | "quanto trabalho vai no vídeo: rápido, normal ou caprichado" |
| "checkpoint", "passo 3", "estação" | "agora preciso da sua decisão", "a próxima etapa é…" |
| "gravar o `estilo-de-video.md`" | "guardar essas escolhas para usar em todos os próximos vídeos" |
| "marca.yaml", "contrato de marca" | "a sua identidade visual (cores, letras e logo)" |
| "run", "pipeline", "subagente" | "esta produção", "trabalhando em segundo plano" |
| "D-01", "V-09", "L-01" | (não cite regra; faça o que ela pede) |

Termo que não tem jeito de evitar aparece com a explicação na mesma frase (V-09, item 4).

## L-04 — A identidade visual é perguntada, não suposta
Toda peça que tem visual (vídeo, carrossel, post, capa) começa conferindo o que a empresa já tem
(`node _fabrica/core/identidade.js <codigo>`: cores, letras, logo, estilo escolhido, peças já feitas). A Fábrica mostra
esse resumo em poucas linhas e **pergunta se a peça vai usar essa identidade**, com a recomendação:

- **Já tem identidade:** recomendar usar, dizendo onde ela já foi usada ("as mesmas cores dos seus 4 carrosséis").
  Oferecer também ver outros visuais e ajustar a identidade antes.
- **Não tem:** recomendar criar agora (uns 5 minutos, escolhendo pelo que vê). Oferecer também usar um estilo pronto
  com as cores originais dele, avisando que dá para transformá-lo na identidade da empresa depois. Nunca usar a marca
  de exemplo (empresa fictícia) numa peça de verdade.

Feita a escolha, toda prévia e toda peça daquela produção usam o que foi escolhido, e cada prévia lembra isso em uma
frase. A pergunta não se repete na mesma produção; na produção seguinte, basta mostrar o resumo e confirmar.

## L-05 — Ao terminar, dizer o que foi feito e o que vem depois
Ao fim de cada etapa: uma frase com o que ficou pronto (e onde, como link) e uma com o próximo passo e se ele depende da
pessoa. Nunca terminar só com o caminho de um arquivo.

## L-06 — A pergunta "o que é isso?" é um aviso
Se a pessoa perguntar o que um termo ou um processo significa, explique com o L-01 completo, siga, e não volte a usar o
termo na mesma conversa. Se a dúvida mostrar que a Fábrica supôs algo sem dizer (por exemplo, a identidade visual),
diga o que tinha sido suposto e pergunte de novo.
