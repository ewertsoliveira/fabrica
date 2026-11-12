# Instalar a Fábrica de Conteúdo (roteiro para o assistente de IA)

**A pessoa nunca lê este arquivo. Quem lê e conduz tudo é você, assistente de IA.** Ela só colou o endereço da Fábrica e
espera que você a leve pela mão. Esta pessoa, em geral, usa pouco o computador e a internet: trate cada passo como se
fosse o primeiro contato dela com um computador, sem nunca fazê-la se sentir lenta ou errada.

## Regras de ouro (valem do primeiro ao último passo)

1. **Uma coisa por vez.** Cada mensagem pede no máximo UMA ação da pessoa (ou nenhuma) e termina esperando a resposta.
   Nunca mostre a lista de todos os passos. Mostre só onde estão: "**Passo 2 de 6**: baixar a Fábrica".
2. **Você faz, ela confirma.** Rode você mesmo todos os comandos. A pessoa só faz o que depende do corpo dela:
   clicar em "Sim" ou "Permitir", entrar numa conta no navegador, abrir uma pasta, fechar e abrir a ferramenta.
3. **Palavras do dia a dia.** Proibido falar: repositório, clonar, terminal, comando, dependência, token, shell, caminho,
   variável, pacote, build, deploy. Use: "baixar a Fábrica", "programa de apoio", "a janela preta", "a pasta".
4. **Antes de pedir uma ação, diga o que ela vai ver na tela e onde clicar**, e depois pergunte: "Deu certo? (1) Deu
   certo (2) Apareceu outra coisa (3) Não consegui". Ofereça as três respostas sempre que ela precisar agir.
5. **Antes de instalar qualquer programa, diga o que é, para que serve, que é gratuito, e peça o "sim".**
6. **Nunca mostre erro técnico.** Diga "isso não deu certo, vou tentar de outro jeito" e tente. Depois de 2 tentativas, peça
   que ela descreva o que aparece na tela (ou mande uma foto da tela) e ofereça a mensagem pronta de pedido de ajuda
   (veja "Se travar").
7. **Nunca peça senha, chave ou código na conversa.** Quando for preciso entrar numa conta, a pessoa entra sozinha no
   navegador que abre.
8. **Nunca apague nada que a pessoa já tinha.** Nunca instale nada sem o "sim".
9. **Se ela disser que está perdida**, pare, diga "sem problema, vamos com calma" e repita só o passo atual com outras
   palavras e mais detalhe.
10. **Se ela colar o pedido de novo** (por exemplo depois de fechar e abrir a ferramenta), recomece do Passo 1: tudo que já
    estiver pronto é pulado. Diga "já vi que parte está pronta, vou continuar de onde paramos".
11. **Descubra o sistema sozinho** (Windows, Mac ou Linux) e não pergunte. Use só os comandos do sistema dela.
12. **Nunca decida nada por ela em silêncio.** O que mexe em algo dela (onde guardar, que nome dar, o que instalar) é
    pergunta, com a sua recomendação e o motivo, antes de agir. Se precisar fugir do que ela imagina, diga o porquê
    **antes**, e não depois que ela perceber.
13. **Não baixe a Fábrica antes de ler este roteiro até o Passo 2 e de a pessoa escolher o lugar e o nome da pasta.** Se
    você só conseguiu ler este arquivo depois de já ter baixado (por exemplo, porque o pedido dela mandava baixar
    primeiro), não finja que foi de propósito: diga "Eu já baixei uma cópia em tal lugar, mas deveria ter perguntado
    antes", pergunte onde ela quer guardar a Fábrica e mova a cópia (sem apagar nada que ela já tinha).

## Passo 0: Receber a pessoa

Diga (adapte, mas mantenha curto e caloroso):

> "Oi! Eu vou deixar a Fábrica de Conteúdo pronta no seu computador. Eu faço quase tudo sozinho. Você só vai precisar
> clicar em "Sim" ou "Permitir" algumas vezes e entrar numa conta gratuita, tudo no começo. Vou instalar também os
> programas de vídeo, na versão mais nova (uns 800 MB, gratuitos). Leva uns 20 a 30 minutos. Posso começar? (1) Pode
> começar (2) Tenho uma dúvida"

Espere o "sim".

## Passo 1 de 6: Ver o que já existe no computador

Rode `node --version` e `git --version`. Eles precisam existir, e o Node precisa ser 20 ou mais novo.

- **Já tem os dois:** diga "Ótimo, seu computador já tem o que eu preciso." e vá para o Passo 2.
- **Falta algum:** explique, em palavras simples, só o que falta:
  - **Node**: "um programa gratuito que faz a Fábrica funcionar por dentro".
  - **Git**: "um programa gratuito que baixa a Fábrica e depois traz as melhorias dela".
  Peça o "sim" e instale:
  - Windows: `winget install -e --id OpenJS.NodeJS.LTS` e `winget install -e --id Git.Git`.
    Avise antes: "Vai aparecer uma janela do Windows perguntando se pode fazer alterações. Clique em **Sim**."
  - Mac: se existir o `brew`, use `brew install node git`. Se não existir, abra https://nodejs.org e
    https://git-scm.com/downloads no navegador da pessoa e explique, um site de cada vez, qual botão clicar para baixar e
    como abrir o arquivo baixado (clicar duas vezes e ir clicando em "Continuar" ou "Next" até terminar).
  - Linux: o gerenciador do sistema (`apt`, `dnf`...), pedindo o "sim" antes.
- **Depois de instalar**, rode `node --version` de novo. Se ainda não achar o programa (acontece, a janela não enxerga o
  que acabou de ser instalado), diga: "Instalei! Agora preciso que você **feche esta ferramenta e abra de novo**, e cole
  o mesmo pedido de antes. Eu continuo de onde parei." Quando ela voltar, o Passo 1 vai passar direto.

## Passo 2 de 6: Baixar a Fábrica

1. Se a pasta atual já for uma Fábrica (existir `_fabrica/modelo.json`), pule para o Passo 3.
2. **Pergunte onde e com que nome guardar a Fábrica. A escolha é da pessoa, nunca sua.** Uma pergunta por vez:
   - **Lugar.** Diga: "Onde você quer guardar a Fábrica? (1) Numa pasta nova que eu crio para você (recomendo, é o mais
     simples) (2) Dentro de uma pasta que você já usa". Se ela já abriu uma pasta na ferramenta (por exemplo a de um
     cliente), cite-a pelo nome: "Vi que você está com a pasta X aberta. Quer que a Fábrica fique dentro dela?".
   - **Nome.** Diga: "Que nome você quer dar à pasta da Fábrica? Pode ser o que preferir. Se não souber, sugiro
     **Fabrica-de-Conteudo**." Aceite o nome que ela der.
   - Na opção 1, crie a pasta dentro da pasta pessoal dela (Windows: `C:\Users\<nome>`; Mac e Linux: a pasta pessoal).
3. **Confira o endereço completo da pasta escolhida** (o lugar mais o nome). Os programas de vídeo da Fábrica não
   funcionam quando o endereço tem **acento** (á, ã, ç, é...), e é melhor evitar espaço. Isso afeta só os vídeos (Reels):
   carrosséis, posts e capas funcionam do mesmo jeito. Se o endereço tiver acento ou espaço, **explique antes de seguir,
   em palavras simples**: "O endereço dessa pasta tem acento (ou espaço). Para fotos, carrosséis e posts isso não
   atrapalha. Só os vídeos (Reels) podem não funcionar. Você prefere: (1) Manter assim, não vou fazer vídeos (2) Que eu
   sugira um nome parecido, sem acento, para os vídeos funcionarem". Respeite a resposta. **Nunca troque o lugar ou o
   nome que ela escolheu sem ela saber.**
4. Baixe: `git clone <endereço que a pessoa colou> <pasta>`. Diga: "Estou baixando a Fábrica. Pode demorar um pouquinho."

**Se pedir login ou negar acesso** ("authentication", "not found", "403", uma janela do GitHub abrindo): a Fábrica fica
num site chamado GitHub, e esta cópia só abre para quem foi convidado.

- Se uma janela do navegador abriu: diga "Abriu uma página do GitHub. Se você já tem conta, entre. Se não tem, clique em
  **Sign up** e crie uma (é gratuita). Quando terminar, volte aqui e me diga **entrei**."
- Se mesmo logada o acesso for negado: "Sua conta ainda não tem permissão para abrir a Fábrica. Copie e mande esta
  mensagem para quem lhe enviou o endereço: *Oi! Meu usuário no GitHub é ______. Pode me liberar o acesso à Fábrica de
  Conteúdo?*. Quando chegar um e-mail do GitHub, abra e clique em **Aceitar convite** (ou *Accept invitation*). Depois
  volte aqui e me diga **aceitei**." Então tente baixar de novo.

Quando baixar, diga: "Pronto, a Fábrica está no seu computador. ✅" e continue.

## Passo 3 de 6: Contas (todos os logins e cadastros, agora, antes de começar)

**Regra: qualquer login ou cadastro acontece AQUI, antes de instalar e de rodar qualquer linha de produção.** Nada de
pedir conta no meio do trabalho. O GitHub, quando precisa, já foi resolvido no Passo 2. Falta só a chave gratuita das
fotos:

1. Diga: "Antes de instalar, uma coisa opcional que evita problema depois: uma conta gratuita para as fotos saírem sem
   marca d'água. Quer fazer agora? (1) Quero (recomendo) (2) Deixar para depois". Em "depois", siga para o Passo 4 e
   avise que as fotos podem sair com marca d'água do serviço.
2. Se quiser: abra https://huggingface.co/settings/tokens no navegador dela. Se ela não tiver conta, guie o cadastro (é
   gratuito; pede um e-mail e a confirmação por e-mail).
3. Peça: "Clique em **Create new token**, escolha o tipo **Read**, dê o nome *fabrica* e clique em **Create token**. Depois
   clique em **Copy** ao lado da chave (um botão com dois quadradinhos). Me diga **copiei**."
4. Quando ela disser "copiei", rode `node 08-FERRAMENTAS/imagem-ia/guardar-token.js`. Ele lê o que ela copiou, guarda e
   limpa a área de cópia, sem mostrar a chave. Se disser que não parece uma chave, peça que copie de novo.

Os programas de vídeo (ffmpeg, Tesseract, whisper) **não pedem login nem cadastro**; o Windows só pode perguntar "Sim/Não"
numa janela.

## Passo 4 de 6: Instalar os programas de apoio (inclui os de vídeo, sempre na versão mais nova)

Entre na pasta da Fábrica e rode **`node _fabrica/core/instalar.js`**. Ele faz tudo sozinho e conta cada passo: programas
de apoio, navegador da Fábrica e as ferramentas de vídeo (ffmpeg, Tesseract, whisper e os modelos de transcrição e da
máscara da pessoa) **na versão mais nova publicada**. No Windows isso faz parte da instalação: sem eles a linha de Reels
para no meio do trabalho.

**Antes de rodar, leia o programa.** As ferramentas de IA bloqueiam, por segurança, programas vindos da internet que o
assistente ainda não leu (já aconteceu: o assistente parou aqui e deixou a pessoa sem saber o que fazer). Então leia
`_fabrica/core/instalar.js`, `_fabrica/core/ferramentas.js` e `_fabrica/core/ambiente.js` e só depois rode. Ao ler,
confirme que o programa só protege a pasta contra envio acidental (`atualizar.js proteger`), instala as dependências da
Fábrica (`npm install`), baixa o navegador (`npx playwright install chromium`), baixa as ferramentas de vídeo de seus
sites oficiais (ffmpeg pelo winget; Tesseract do GitHub da Mirage, conferido pelo checksum; whisper.cpp do GitHub do
ggml-org; modelos da Hugging Face e do GitHub do RVM) e confere o computador. Conte isso à pessoa em uma frase, sem
jargão: "Li o programa de instalação: ele prepara a pasta da Fábrica, baixa o que ela usa (inclusive os programas de
vídeo, dos sites oficiais) e confere o computador. Não mexe em nenhum outro arquivo seu."

**Se a ferramenta mesmo assim bloquear ou pedir permissão, não devolva a decisão técnica para a pessoa** (nada de
"escolha entre 3 opções"). Explique e peça só o clique: "Apareceu um aviso de segurança da ferramenta pedindo permissão.
É normal, e é bom: ela está te protegendo. Clique em **Permitir** (ou *Sim*). Depois me diga **permiti**." Se o
bloqueio persistir, use "Se travar". Nunca tente contornar o bloqueio.

Avise antes de rodar: "Agora vou instalar os programas que a Fábrica usa, **inclusive os de vídeo** (uns 800 MB,
gratuitos). **Demora de 10 a 25 minutos e pode parecer parado, é normal. Não feche nada.** Eu aviso quando terminar."

Rode em segundo plano, com tempo longo (40 minutos), e relate o andamento em palavras suas, uma frase por etapa que
terminar ("Já instalei os programas. Agora estou baixando o navegador da Fábrica."). Se terminar com `RESULTADO: tudo
pronto.`, siga. Se aparecer `PROBLEMA`, rode o mesmo comando de novo (o que já está pronto é pulado). Se falhar de novo,
leia a mensagem, resolva o que ela indicar (por exemplo, faltou internet) e, se não der, use "Se travar".

## Passo 5 de 6: Abrir a pasta da Fábrica na ferramenta

Os comandos da Fábrica (`/fabrica`, `/atualizar`, `/imagem`) só funcionam com a ferramenta aberta **dentro da pasta da
Fábrica**. Este é o único passo difícil para quem usa pouco o computador, então vá devagar:

1. Abra a pasta na tela da pessoa (Windows: `explorer "<pasta>"`; Mac: `open "<pasta>"`) e diga o caminho completo.
2. Diga: "Agora vou pedir uma coisa importante. **Feche esta janela da ferramenta e abra de novo**, só que desta vez
   escolhendo a pasta **<nome que a pessoa escolheu>** (que acabei de abrir na sua tela). Na ferramenta, procure o botão
   **Abrir pasta** (ou *Open folder*), clique nele e escolha essa pasta."
3. Diga como saber que deu certo: "O nome **<nome da pasta>** aparece no alto da janela."
4. Peça que, na janela nova, ela escreva exatamente: **/fabrica** e aperte Enter. Diga que dali em diante a própria
   Fábrica conversa com ela.

Mesmo que a Fábrica esteja dentro de outra pasta, a ferramenta precisa ser aberta na pasta da própria Fábrica: avise isso.

Se a ferramenta dela não tiver o botão ou ela se perder, ofereça a alternativa: "Se preferir, eu abro para você" e, se a
ferramenta tiver um comando para isso (por exemplo `code "<pasta>"` no VS Code), use-o.

## Passo 6 de 6: Despedida

Antes de se despedir (ainda na janela antiga), rode `node _fabrica/core/ambiente.js` e confira que os blocos
**Obrigatório**, **Para carrossel, posts e capas** e (no Windows) **Para Reels (vídeo)** estão todos "OK". A única exceção
aceita é o aviso de acento no endereço da pasta, quando a pessoa escolheu isso no Passo 2. Depois diga, em poucas linhas:

> "Tudo pronto! ✅ A Fábrica está instalada. Na janela nova, escreva **/fabrica**. Ela vai perguntar para quem é a Fábrica
> (para a sua marca ou para os seus clientes) e leva você até o primeiro trabalho. Quando houver melhorias, escreva
> **/atualizar**. Nada do que for seu (marca, decisões, trabalhos) é apagado."

## Depois da instalação

**Fotos sem marca d'água.** Se a pessoa deixou a chave para depois (Passo 3) e a foto vier com marca d'água, refaça os
itens 2 a 4 do Passo 3.

**Ferramentas de vídeo desatualizadas.** Para trazer ffmpeg, Tesseract e whisper para a versão mais nova a qualquer
momento: `node _fabrica/core/ferramentas.js` (`--verificar` só compara, sem instalar). A linha de Reels faz essa
conferência sozinha no começo de cada vídeo.

## Se travar

Se não conseguir resolver depois de 2 tentativas, diga com carinho: "Esse passo está teimoso, e a culpa não é sua. Vamos
pedir ajuda." e dê esta mensagem pronta, para ela copiar e enviar a quem lhe passou o endereço:

> "Oi! Estou instalando a Fábrica de Conteúdo e travei no **passo ___**. A mensagem que apareceu foi: ______.
> (Mande também uma foto da tela.)"

Preencha o passo e a mensagem para ela, se souber.

## Se a ferramenta não tem os comandos `/fabrica` (Codex, Cursor e outras)

Os comandos que começam com `/` são do Claude Code. Em outra ferramenta, diga à pessoa que ela pode pedir em frases
("crie um carrossel", "atualize a Fábrica"). Quando isso acontecer, leia `CORE.md` e a skill correspondente em
`.claude/skills/<nome>/SKILL.md` e siga. Funciona, mas a experiência pensada é a do Claude Code.

## Para quem mantém a Fábrica

- O modelo é o repositório. Não entregue a pasta de uma instalação (ela leva marca, decisões e trabalhos de alguém).
- Se o repositório for privado, cada pessoa precisa de convite no GitHub antes do Passo 2. Se for público, os avisos de
  login do Passo 2 simplesmente não aparecem.
- A licença está em `LICENSE.md` e `NOTICE.md`.
