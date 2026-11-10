# Biblioteca de estilos, caminho do usuário e empresas separadas

Data: 2026-10-30. Estado: desenho para aprovação (revisado por um leitor construtor; pendências decididas).

Convenção deste documento:
- **(dele)** marca o que o responsável decidiu.
- **(minha escolha)** marca o que eu decidi e ele pode mudar.

## 1. Intenção e porquê

A Fábrica tem 27 estilos aprovados. Cada um tem carrossel, capa de Reels, três posts fixados, kit de identidade e o
modelo de vídeo equivalente. Hoje esses estilos só aparecem em páginas de laboratório feitas para quem constrói a
Fábrica. O usuário final, por exemplo uma nutricionista, uma advogada ou uma social media, ainda não tem como ver,
comparar e escolher o estilo.

O objetivo é que esse usuário, sem saber nada de design nem de tecnologia:

1. diga em poucos cliques o que quer fazer;
2. informe a marca dele, ou saiba que tudo bem não ter uma;
3. veja os estilos já com a cara da marca dele;
4. escolha a cara da marca, sabendo que pode trocar, personalizar ou pedir um estilo novo a qualquer momento.

Tudo isso precisa servir, pelo mesmo caminho, a quem quer só vídeo, só carrossel, um post único, o social media da
própria empresa ou o social media de várias empresas (agência).

## 2. Objetivos

- **Biblioteca de estilos** com prévia rápida e página de detalhe com todas as aplicações (dele).
- **Caminho do usuário em 6 passos**, igual para todos (dele, refinado em conjunto):
  1. Para quem é?
  2. O que você quer criar?
  3. Sua marca.
  4. Biblioteca.
  5. Estilo inteiro.
  6. Decidir.
- **Aviso de modelo base:** fica claro que cada estilo é uma base e que cores e letras viram as da marca. Padrão de
  tela escolhido: opção B, com aviso e interruptor "Modelo base / Na minha marca" no topo e selo em cada cartão (dele).
- **Perguntar a marca antes da biblioteca.** Sem marca, tudo bem: usar um dos nossos, criar do zero ou enviar
  referências (dele).
- **Poder total de modificação:** usar, personalizar, pedir estilo novo e trocar depois (dele).
- **Várias empresas numa mesma Fábrica, com a estrutura completa já agora,** mesmo sem nenhuma agência usando ainda
  (dele).
- **Seletor de empresa no Laboratório e no Cronograma.** O cronograma enviado a um cliente nunca leva informação de
  outra empresa (dele).

## 3. Não-objetivos (nesta etapa)

- Contas, login e permissões por pessoa. Freelancer com acesso só a um cliente fica para depois. A gaveta por empresa
  apenas deixa isso possível (minha escolha).
- Publicar ou hospedar a biblioteca na internet. Ela roda no painel local, neste computador (minha escolha).
- Editor visual livre, do tipo arrastar elementos. "Personalizar" troca cores, letras e detalhes com prévia, não
  redesenha a estrutura (minha escolha).
- Refazer os 27 estilos. A biblioteca usa os estilos como estão.

## 4. Anti-objetivos (falha, mesmo se funcionar)

- **Um conteúdo da empresa A aparecer para a empresa B,** em peça, cronograma, prévia ou memória.
- **Mexer nos dados de empresa que já existem sem autorização.** Marca, perfil, decisões, linhas próprias, saídas e
  memória nunca são apagados nem sobrescritos (regra permanente dele).
- **Grade pesada e confusa:** muitos vídeos tocando ao mesmo tempo, ou quatro prévias por cartão.
- **Pedir decisão de design por texto.** Toda escolha visual vem com prévia (regra D-01 dele).
- **Usuário travado por não ter marca, ou achando que o estilo é fixo.**
- **Qualquer etapa dependendo de gerador de imagem por IA** (regra I-16).

## 5. Restrições

- **Língua e tom:** tudo em português do Brasil, sem jargão para o usuário final.
- **Prévias:** usam as cores originais do estilo. A paleta da empresa entra só quando o usuário escolhe ver "na minha
  marca".
- **Regras de vídeo que valem para todas as prévias:**
  - nada cobre o rosto;
  - vídeo limpo;
  - troca de quadro com pelo menos 4 s.
- **Vídeo de demonstração:** o vídeo de uma empresa real nunca sai deste computador. As prévias de vídeo da biblioteca
  precisam de um vídeo de demonstração liberado (ver 11.1).
- **Antes de gravar na matriz:**
  - rodar o validador anti-vazamento;
  - imagens de terceiros ficam no `.gitignore`;
  - nada vai ao GitHub sem autorização.
- **Ambiente:** o painel é o servidor local que já existe em `_fabrica/paineis/` (ramo `paineis`). Só aceita pedidos
  do próprio computador.

## 6. Arquitetura: a empresa como gaveta

### 6.1 O que é de cada empresa e o que é de todas

| De todas (modelo) | De cada empresa (gaveta) |
|---|---|
| motor, ferramentas, regras do Núcleo | perfil (`empresa.md`) |
| os 27 estilos base e os modelos de vídeo | marca (`marca.yaml`, logo, fontes, fotos) |
| linhas de produção (as receitas) | estilo escolhido e histórico de trocas |
| preferências de quem usa (idioma, nome) | estilos próprios (criados do zero ou por referência) |
| | decisões |
| | dados do Laboratório e do Cronograma |
| | saídas e memória de cada linha |
| | termos da empresa (para a conferência entre empresas) |

As linhas são receitas e ficam compartilhadas. A mesma linha de carrossel serve a qualquer empresa. O que cada
execução produz e aprende vai para a gaveta da empresa ativa (minha escolha).

**Regra para o que a tabela não cita (minha escolha):** tudo o que hoje é da empresa vai para a gaveta. "Da empresa"
quer dizer: está em `protegidos` do `propriedade.json`, ou fora da lista `modelo`. Hoje isso inclui:

- `linhas/reels/dados/preferencias-aprovadas.md`, `biblioteca-de-modelos.md` e `briefing.md` → `linhas/<linha>/dados/`
  da gaveta;
- `linhas/reels/estado.json` → `estado/<linha>.json` da gaveta;
- `06-MARCA-E-FOTOS/estilo-de-video.md` → `estilo-de-video.md` da gaveta;
- `04-LABORATORIO-DE-DESIGN/referencias/` → `referencias/` da gaveta;
- `linhas/*/_investigacoes/` → `investigacoes/<linha>/` da gaveta;
- `06-MARCA-E-FOTOS/estilos-proprios/` → `estilos-proprios/` da gaveta.

Nada que uma empresa aprovou vale para outra.

### 6.2 Onde fica

```
empresas/
  indice.json              lista das empresas: código, nome, disposição (gaveta ou legado), criada em
  ativa.json               qual empresa está ativa neste computador
  <codigo>/
    empresa.md
    marca.yaml   logo/   fontes/   fotos/
    estilo.json            estilo escolhido, personalizações e histórico de trocas
    estilos-proprios/
    decisoes.md
    laboratorio/dados/     o que hoje fica em 04-LABORATORIO-DE-DESIGN/dados
    cronograma/dados/      o que hoje fica em 03-CRONOGRAMA/dados
    saidas/<linha>/        o que hoje fica em linhas/<linha>/saida
    memoria/<linha>/       o que hoje fica em linhas/<linha>/memoria
    termos.txt             gerado: nome, conta, site e nomes próprios da empresa
```

`empresas/` inteira é da empresa. Ela entra em `propriedade.json` como protegida, e a atualização nunca toca nela.

### 6.2.1 Quem manda nas cores e letras (minha escolha)

- **`marca.yaml` é a identidade da empresa:** cores, letras, logo e conta. As 14 ferramentas continuam lendo só dele.
- **`estilo.json` é o modelo escolhido:**
  - id do estilo;
  - ajustes de estrutura, como o arranjo do B-roll ou o alinhamento;
  - histórico de trocas.

  Ele não guarda cor nem letra.
- **"Personalizar" cores ou letras altera o `marca.yaml`,** porque é a própria pessoa que pede, pela tela, com prévia.
  Cada gravação guarda antes a versão anterior em `historico/marca-<data>.yaml`, e "Desfazer" volta. O agente nunca
  altera o `marca.yaml` por conta própria.
- **Trocar de estilo não mexe na marca:** as cores e letras continuam as da empresa.
- **"Usar um dos nossos", para quem não tem marca:** grava no `marca.yaml` as cores e letras do estilo, com
  `origem: estilo:<id>`. Se depois a pessoa enviar a marca real, a tela mostra as duas lado a lado. Só depois de
  confirmar, a real substitui, com a anterior guardada no histórico.
- **As escolhas de vídeo da linha de Reels,** como a entrevista de estilo de vídeo e as preferências aprovadas,
  continuam sendo da linha, dentro da gaveta.
- **O arranjo do B-roll:** o padrão vem do modelo de vídeo, e o `estilo.json` pode fixar outro.

### 6.3 Empresa que já existe: disposição "legado" (minha escolha)

Quem já usa a Fábrica, como a pasta da EMPRESA, tem os dados nos lugares antigos: `06-MARCA-E-FOTOS/marca.yaml`,
`_fabrica/_memoria/empresa.md`, `linhas/reels/saida/` e assim por diante.

**Nada é movido automaticamente.** A empresa existente entra no `indice.json` com disposição `legado`, e o leitor de
caminhos devolve os lugares antigos para ela. Um comando opcional de migração (`empresas.js migrar <codigo>`) copia
tudo para a gaveta. Ele só roda quando a pessoa pede: faz backup, confere arquivo por arquivo e só depois retira os
antigos. Pastas novas já nascem com uma gaveta.

### 6.4 Um leitor de caminhos para todos

Módulo novo: `_fabrica/core/empresa.js`. É a única peça que sabe onde as coisas de uma empresa ficam.

- **`ativa()`:** devolve o código da empresa ativa, nesta ordem:
  1. variável `FABRICA_EMPRESA`;
  2. `empresas/ativa.json`;
  3. a única empresa, se só houver uma.

  Com mais de uma empresa e nenhuma escolhida, ele **recusa** e pede a escolha. Nunca adivinha.
- **`caminhos(codigo)`:** devolve perfil, marca, estilo, decisões, laboratório, cronograma, saídas e memória da
  linha, e termos. Respeita a disposição gaveta ou legado.
- **`listar()`, `criar(codigo, nome)`, `ativar(codigo)`.**
- **Linha de comando para o agente:** `node _fabrica/core/empresa.js listar|ativa|ativar <c>|criar <c> "<nome>"`.

**Quem passa a perguntar ao leitor:**
- `08-FERRAMENTAS/marca/marca.js` (a variável `FABRICA_MARCA` continua tendo prioridade);
- `_fabrica/paineis/dados.js` (`caminhos(r)` passa a receber a empresa);
- as ferramentas que leem a marca ou o perfil direto, que hoje são 14 arquivos de código (lista no anexo A);
- os textos de instrução que citam os caminhos antigos: `runner`, Arquiteto, prompts, `/fabrica` e passos da linha
  de Reels. São 68 arquivos `.md`. Eles passam a dizer "a marca da empresa ativa" e indicam o comando do leitor.

### 6.5 Conferência entre empresas

O validador anti-vazamento ganha o modo `--empresa <codigo>`:
- confere as saídas e os dados dessa empresa contra os `termos.txt` de todas as outras;
- qualquer achado reprova.

**Quando roda:**
- antes de entregar qualquer peça;
- antes de gerar o cronograma para envio;
- nos testes.

O `termos.txt` é gerado do perfil e da marca. Pode ser complementado à mão.

**O que é conferido (minha escolha):**
- **Só os termos das outras empresas.** No modo `--empresa`, as checagens genéricas (hexadecimal, nome de fonte e
  outras) ficam desligadas.
- **As fontes de texto de cada peça,** não a imagem nem o vídeo renderizado:
  - HTML e JSON das lâminas;
  - roteiro, legenda, transcrição e pedido do vídeo;
  - post do cronograma.

  Tudo o que aparece numa imagem ou num vídeo da Fábrica nasce de uma dessas fontes. Por isso, conferir a origem cobre
  o que é renderizado, sem leitura de texto em imagem.
- **Termos em comum de verdade,** como a cidade ou o nome da agência, vão em `empresas/<c>/termos-compartilhados.txt`
  e não reprovam.

**Cada execução só lê arquivos da empresa ativa** (instrução no runner e na skill `/fabrica`). Isso não elimina 100% o
risco de o agente misturar algo lembrado na mesma conversa, e por isso existe a conferência. Ao trocar de empresa, a
skill recomenda começar uma conversa nova (minha escolha).

## 7. Painéis: seletor de empresa e envio ao cliente

- **Seletor no topo do Laboratório e do Cronograma:** "Empresa: Clínica X ▾". Só aparece com duas empresas ou mais.
  Com uma, a tela é igual à de hoje (minha escolha).
- **Troca de empresa:** o servidor passa a responder por empresa, com o parâmetro `empresa` em toda rota de dados.
  Trocar no seletor muda a empresa ativa do painel. Não muda a do agente: o painel mostra um aviso se as duas forem
  diferentes (minha escolha).
- **Enviar o cronograma ao cliente:** gera um arquivo próprio, só com os posts da empresa escolhida. É gerado a
  partir da gaveta dela, nunca filtrando uma página com todas. A conferência entre empresas roda antes de liberar o
  arquivo.
- **Laboratório:** as peças, aprovações e ajustes são sempre da empresa do seletor.

**Dependência:** as telas do Laboratório e do Cronograma ainda estão sendo construídas no ramo `paineis`. Hoje só
existem os itens 1 e 2: dados e servidor. Este projeto entra **depois** que essas telas existirem, ou junto com elas
(ver 11.2).

## 8. Biblioteca de estilos

### 8.1 Onde fica

É uma aba "Estilos" no Laboratório de Design (painel local). É o mesmo lugar onde a pessoa troca a cara da marca
depois (minha escolha).

### 8.2 Dados

- **Catálogo:** lido de `04-LABORATORIO-DE-DESIGN/estilos/*/estilo.yaml`: nome, linha, cores, tipografia,
  tratamentos, regras do kit e `reels.modelo`.
- **Campos novos no `estilo.yaml`:**
  - `combina-com`: nichos, como saúde, direito e finanças;
  - `tom`: sóbrio, vibrante, acolhedor, técnico e outros;
  - `precisa`: por exemplo, "foto com fundo liso" na Protagonista, ou "funciona sem foto".

  A primeira versão desses campos é escrita por mim para os 27 estilos e revisada por ele numa página visual (minha
  escolha).

### 8.3 Prévias

Prévias **base** são geradas uma vez, no modelo, com as cores originais:
- capa (imagem);
- lâminas do carrossel (imagens, para o slider);
- 3 fixados e capa de Reels (imagens);
- trecho do vídeo, com cerca de 6 s, começando na troca de quadro e sem som, em versão leve para a web, mais um
  quadro de capa.

Ferramenta: um script novo, `08-FERRAMENTAS/biblioteca/gerar-previas.js`, que reaproveita o `previa.js` do catálogo
e o `montar.js` dos modelos. Para o vídeo, ele estende a convenção do `modelos/gerar-previas.js`, que já existe:
`.webm` de 540p sem som, mais um `.jpg` de capa.

**Onde ficam as prévias base (minha escolha):**
- Vão no repositório do modelo, em `04-LABORATORIO-DE-DESIGN/biblioteca/previas/<estilo>/`.
- Formato e peso:
  - lâminas e capas em `.webp`, com 1080 px de largura;
  - vídeo em `.webm` de 540p, com cerca de 6 s.
  - Meta: menos de 1 MB por estilo, menos de 30 MB no total.
- O `.gitignore` ganha uma exceção só para essa pasta.
- Assim, ninguém gasta 2 h gerando prévias na instalação. Só as prévias "na minha marca" são geradas no computador
  de cada um.

**Conteúdo de exemplo das prévias base:**
- textos de demonstração dos estilos (`demo.json`, que já existe);
- fotos de `_demo/fotos/`, geradas por IA antes, como demonstração documentada. Nenhuma etapa da produção depende de
  gerá-las, e elas não são de terceiros;
- vídeo: o de demonstração liberado (pendência 11.1).

Prévias **"na minha marca"** são geradas por empresa, dentro da gaveta, quando a marca existe ou muda:
- **Imagens:** rápidas, poucos segundos por estilo com o Chromium. Saem todas de uma vez.
- **Vídeos:** lentos, cerca de 5 min por estilo. Entram numa fila em segundo plano, com o progresso visível ("suas
  prévias de vídeo: 9 de 27").
  - Enquanto o vídeo de um estilo não fica pronto, o cartão mostra o vídeo base com o selo "Modelo base". Nunca mostra
    um vídeo falso.
  - O estilo que a pessoa abre no detalhe passa para a frente da fila (minha escolha).

### 8.4 Telas

O estudo visual aprovado tem três páginas: caminho, base e marca, sua marca. Elas ficam fora do repositório porque
usam quadros do vídeo de amostra, que é só local. A descrição abaixo é a referência. Quando o vídeo de demonstração
existir, as telas reais substituem o estudo.

- **Grade:**
  - **Topo:**
    - aviso "Estes são modelos base. Cores e letras viram as da sua marca. Você pode ajustar tudo depois.";
    - interruptor "Modelo base / Na minha marca";
    - busca e filtros por nicho, tom e "funciona sem foto".
  - **Cartões:** uma prévia principal por cartão, decidida pela intenção do passo 2:
    - **vídeo:** o trecho, na proporção do celular, que toca quando o mouse passa ou o dedo toca, um de cada vez;
    - **carrossel ou post único:** a capa, com as lâminas passando no dedo;
    - **"tudo":** a capa, com o vídeo ao tocar.

    Cada cartão leva o selo "Modelo base" ou "Na sua marca".
- **Sem marca:**
  - o interruptor "Na minha marca" fica apagado;
  - o aviso oferece "Criar do zero" e "Enviar referências".
- **Detalhe do estilo:**
  - **À esquerda:** abas Vídeo, Carrossel, Capa de Reels, Posts fixados e Post único. A primeira aba aberta segue a
    intenção. O carrossel é um slider com arraste.
  - **À direita:**
    - nome e linha;
    - "Combina com" e "O que precisa";
    - base e marca lado a lado;
    - cores e letras;
    - os três passos "Como este estilo vira seu";
    - "Detalhes técnicos" recolhido, com fontes, pesos, tamanhos e códigos das cores.
  - **Botões:** "Usar este estilo", "Personalizar" e "Criar um estilo novo a partir de referências".

## 9. Caminho do usuário (6 passos)

O caminho roda no painel. O que precisa de IA volta para o agente. O painel e o agente conversam por arquivos na
gaveta da empresa (minha escolha):

- o painel grava `empresas/<c>/pedidos/<data>-<tipo>.json` e mostra: "Pronto. No Claude, digite /fabrica continuar";
- o agente lê os pedidos pendentes ao abrir a `/fabrica`;
- o agente grava o resultado na gaveta, e o painel mostra.

**Pedido de uma empresa que não é a ativa do agente (minha escolha):**
- O painel guarda a empresa do seletor só na própria sessão do navegador. Ele nunca altera o `ativa.json`.
- A `/fabrica continuar` lista os pedidos pendentes de todas as empresas, cada um com o nome da empresa.
- Para atender um pedido de outra empresa, o agente pergunta antes (com `AskUserQuestion`):
  - se a pessoa confirma, ativa a empresa e recomenda abrir uma conversa nova;
  - se não confirma, não atende o pedido.

  Ele nunca atende o pedido sem trocar a empresa ativa.

**Os passos:**

1. **Para quem é?** "Minha marca" ou "Meus clientes".
   - **"Meus clientes":** cria a primeira empresa cliente e mostra o seletor.
   - **"Minha marca":** cria uma gaveta só, e o seletor não aparece.
2. **O que você quer criar?** Vídeo, Carrossel, Post único ou Tudo, com várias opções possíveis. A resposta fica em
   `empresas/<c>/intencao.json`. Ela decide a ordem das prévias e das abas e nunca bloqueia nada.
3. **Sua marca.** A pergunta é "Sua marca já tem cores e letras definidas?":
   - **"Sim" ou "Tenho uma parte":**
     - **Logo:** a pessoa envia o logo, e a Fábrica tira as cores dele para ela confirmar. A extração de cor é feita
       por código, sem IA de imagem.
     - **Cores e letras:** a pessoa confirma, troca ou cola as cores, e escolhe as letras numa lista ou envia o arquivo
       da fonte.
     - **O que faltar:** é sugerido com prévia.
     - **Manual em PDF:** a pessoa pode enviar o manual da marca, e o agente preenche os campos. Isso vira um pedido ao
       agente.
   - **"Ainda não tenho":** três caminhos.
     - **Usar um dos nossos:** vai para a biblioteca. As cores e letras do estilo escolhido viram o `marca.yaml`.
     - **Criar do zero:** pedido ao agente. Ele faz perguntas sobre o negócio e propõe paletas e letras, sempre com
       prévia.
     - **Enviar referências:** pedido ao agente. Ele cria um estilo próprio inspirado, sem copiar (regra "referência é
       só influência"), em `estilos-proprios/`.

   O resultado é o `marca.yaml` da gaveta, no mesmo formato de hoje.
4. **Biblioteca:** como em 8.4.
5. **Estilo inteiro:** como em 8.4.
6. **Decidir:**
   - **"Usar este estilo":** grava `estilo.json`, com o id do estilo, a data e o histórico.
   - **"Personalizar":** abre os ajustes de cores, letras e detalhes com prévia, e grava as personalizações no
     `estilo.json`.
   - **"Criar um estilo novo":** pedido ao agente.

   Daí em diante, as linhas usam o estilo e a marca da gaveta.

**Trocar depois:** "Trocar a cara da marca" fica sempre visível no Laboratório. As peças já feitas guardam o estilo
com que foram feitas: o id do estilo é registrado em cada peça.

## 10. Vídeo na marca: os modelos precisam aceitar paleta e fontes

Hoje os modelos de vídeo só trocam a cor de acento (`usarMarca`). Para a prévia "na minha marca" ser verdadeira no
vídeo:

- **Os 12 modelos sobre `_inverso.js`:** passam a aceitar a paleta completa da marca (escuro, claro, acento e neutro)
  e as fontes da marca (principal no título e na legenda, mono no rótulo). O destaque continua sendo o tratamento do
  estilo: itálico, tarja, pílula ou sublinhado.
- **Concreto Ácido, Luz de Vela e os 13 modelos antigos:** recebem o mesmo, com um mapeamento por modelo. No total
  são 27 modelos, um por estilo.
- **Fonte da marca sem itálico, para estilos com destaque em itálico:** usa a fonte de destaque do próprio estilo.
  Isso fica registrado no detalhe técnico (minha escolha).
- **Junto:** conferir os 13 modelos antigos contra as regras "nada sobre o rosto" e "vídeo limpo". Tudo o que mudar
  passa por uma página visual antes.

## 11. Decisões do responsável sobre as pendências (2026-10-30)

1. **Vídeo de demonstração: o responsável grava (dele).**
   - É um vídeo de cerca de 15 s, falando para a câmera, autorizado para as prévias.
   - Eu entrego um roteiro curto antes, que precisa servir aos 27 modelos. Ele leva chamada, uma palavra de destaque,
     o gatilho de um B-roll de pelo menos 4,5 s e uma palavra final.
   - Até o vídeo chegar, as prévias de vídeo usam a amostra local e ficam marcadas como só locais. Nada com o vídeo da
     empresa real entra no repositório.
2. **Ordem com o ramo `paineis`: juntos (dele).**
   - As etapas 1 e 2 (gavetas e textos) vêm primeiro, porque não dependem das telas.
   - Depois, as telas do Laboratório e do Cronograma são construídas já por empresa: `dados.js` e as rotas recebem a
     empresa desde o começo, e o seletor e a aba Estilos nascem nelas. Assim, nenhuma tela é feita duas vezes.
   - O trabalho entra no ramo `paineis` (ou num ramo novo feito a partir dele), e não paralelo a ele.

## 12. Ordem de construção (minha escolha)

Cada etapa termina com testes, validador, prévia visual quando houver tela e commit local.

1. **Gavetas:**
   - `empresa.js`, `indice.json` e disposição legado;
   - `marca.js` e as 14 ferramentas lendo pelo leitor;
   - `propriedade.json`;
   - validador com `--empresa`;
   - testes com duas empresas fictícias, provando que nada cruza.
2. **Textos de instrução:** runner, Arquiteto, `/fabrica` e passos das linhas falando da empresa ativa; comandos de
   empresa na `/fabrica`.
3. **Painéis:** as telas do Laboratório e do Cronograma, construídas já por empresa, com o seletor, os dados por
   empresa e o envio do cronograma ao cliente com conferência. Juntas com o ramo `paineis`, como em 11.2.
4. **Prévias base:** `gerar-previas.js` e campos `combina-com`, `tom` e `precisa` nos 27 estilos, revisados numa
   página visual.
5. **Biblioteca (grade e detalhe)** no Laboratório, com o padrão B.
6. **Modelos de vídeo com paleta e fontes da marca,** e a conferência dos 13 antigos.
7. **Prévias "na minha marca"** com a fila de vídeo.
8. **Caminho do usuário:** passos 1, 2, 3 e 6, os pedidos ao agente e "trocar a cara da marca".
9. **Migração opcional** para quem tem disposição legado (comando, backup e conferência).

## 13. Como saber que funcionou

- **Isolamento:** com duas empresas fictícias, uma peça, um cronograma enviado e uma prévia da empresa A não contêm
  nenhum termo da B. Isso é conferido por teste automático e pelo validador.
- **Pasta antiga intacta:** uma pasta antiga, como a da EMPRESA, continua funcionando igual depois da atualização,
  sem nenhum arquivo movido.
- **Uma pessoa que não é de tecnologia:**
  - chega da primeira tela à escolha do estilo sem ajuda e sem ler termo técnico;
  - entende, só pela tela, que o estilo é uma base e que dá para trocar.
- **Grade leve:** nunca toca mais de um vídeo ao mesmo tempo, e abre rápido com 27 estilos.

## Anexo A: código que hoje lê a marca ou o perfil direto

`04-LABORATORIO-DE-DESIGN/estilos/kit.js`, `04-LABORATORIO-DE-DESIGN/estilos/previa.js`,
`08-FERRAMENTAS/carrossel/conferir.js`, `gerar.js`, `molde.js`, `08-FERRAMENTAS/marca/marca.js`,
`08-FERRAMENTAS/mockups/mockups.js`, `08-FERRAMENTAS/mockups/previa.js`,
`08-FERRAMENTAS/tesseract/blocos-motion/cartao-cta.js`, `nucleo.js`, `08-FERRAMENTAS/tesseract/conferir-reels.js`,
`projetos/montar-video.js`, `projetos/palavras.js`, `_fabrica/core/atualizar.js`.
