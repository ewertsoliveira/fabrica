# Catálogo de estilos

Cada pasta é um estilo de peça de feed. O estilo diz **como** a peça é montada; as cores e as fontes vêm do
`marca.yaml` da empresa. A sugestão de cores e fontes de cada estilo serve só para a prévia do catálogo.

| Estilo | Linha | Miolo | Fundos |
|---|---|---|---|
| `contraste` | Mockup inclinado, rótulo mono, nota manuscrita, fechamento em cartão | rodízio de layouts | escuro, claro, acento |
| `papelaria` | Serifa condensada com itálico e um objeto de escritório por lâmina | fixo | acento, claro, escuro |
| `colagem` | Folha de caderno colada, adesivo no topo, etiquetas e polaroide | fixo | escuro, acento |
| `editorial` | Foto de revista com degradê suave, serifa fina, assinatura no alto | fixo | um fundo só |
| `vitrine` | Do Reels Vitrine: fundo desfocado da cena, texto fino com destaque em itálico pesado, mockup como cartão com sombra longa | rodízio | escuro, claro, acento |
| `neon` | Do Reels Neon: moldura neon atrás da pessoa, destaque manuscrito brilhante, mockup com contorno neon | rodízio | escuro |
| `cinema` | Do Reels Cinema: granulação, vinheta e tom quente, serifada com itálico, estrelinha de brilho | rodízio | escuro, claro |
| `impacto` | Do Reels Impacto: caixa alta condensada em ciano, destaque com falha cromática, mockup na tela cinza | rodízio | escuro |
| `visor` | Do Reels Visor: cantoneiras de câmera, dados de exposição, "REC" com a contagem, título âmbar | rodízio | escuro |
| `recorte` | Do Reels Recorte: título datilografado em fitas, texto em recorte de papel, mockup colado com fita sobre jornal | rodízio | claro, escuro |
| `caderno` | Do Reels Caderno: folha pautada, rótulo em pincelada, laço à mão no destaque, anotação em caneta azul | rodízio | claro |
| `adesivo` | Do Reels Adesivo: faixa rosa com contorno, adesivos em volta do mockup, pessoa no arco, selo estourado | rodízio | claro, acento |
| `retro` | Do Reels Retrô: mockups em janelas de sistema antigo, destaque manuscrito limão, dissolução em pixels | rodízio | claro, escuro |
| `bloco` | Do Reels Bloco: condensada com destaque na serifada itálica, palavra gigante atrás da pessoa e do mockup, blocos em degrau | rodízio | escuro, claro, acento |
| `circulo` | Do Reels Círculo: condensada atrás da pessoa, rótulo em pílula serifada, foto da lâmina num círculo com anel | rodízio | acento, claro |
| `faixa` | Do Reels Faixa: moldura fina, texto fino com itálico pesado, faixas diagonais, palavra em contorno atrás do mockup | rodízio | escuro, claro, acento |
| `palco` | Do Reels Palco: a chamada vira o selo no alto, a cena em cima e o cartão arredondado com o rosto embaixo | rodízio | claro |
| `concreto-acido` | Primeira rodada: letras monumentais, preto e papel, um acento ácido no destaque, mockups de borda dura | rodízio | escuro, claro, acento |
| `revista-dominical` (Revista de Domingo) | Primeira rodada: muito respiro, serifa elegante com itálico terracota, fios finos | rodízio | claro, escuro, acento |
| `protagonista` | Primeira rodada: a profissional recortada sobre um círculo de acento, título monumental ao lado | rodízio | claro, escuro, acento |
| `luz-de-vela` | Primeira rodada: escuro com foco de luz dourada, serifa clássica, itálico dourado | rodízio | escuro, claro, acento |
| `fanzine` | Primeira rodada: papel rasgado, fita adesiva, título em tarjas, anotação à mão | rodízio | claro, escuro, acento |
| `terra-e-salvia` | Primeira rodada: tons de terra e sálvia, formas orgânicas pela borda, serifa macia com itálico terracota | rodízio | claro, escuro, acento |
| `cartilha` | Primeira rodada: número do passo em círculo amarelo, destaque em pílula, para tutorial | rodízio | escuro, claro, acento |
| `circuito-neon` | Primeira rodada: grade técnica, colchetes, um acento néon no destaque sublinhado | rodízio | escuro, claro, acento |
| `gravura` | Primeira rodada: gravuras em traço do assunto da lâmina num painel, serifa refinada | rodízio | escuro, claro, acento |

Prévia: `node 04-LABORATORIO-DE-DESIGN/estilos/previa.js` gera `catalogo.html` (não vai para o git), nas cores sugeridas por
cada estilo. Com `--marca`, a mesma demonstração sai nas cores e fontes do `marca.yaml` da empresa: é o que o Arquiteto
abre para o responsável escolher o estilo olhando (D-01).

Kit de identidade: `node 04-LABORATORIO-DE-DESIGN/estilos/kit.js` gera `kit.html` (não vai para o git): por estilo, a paleta com o
contraste dos pares de uso, a tipografia em amostra, os tratamentos, as texturas e os objetos, as regras de uso (`kit.regras`), a
tabela "o que mexia no vídeo vira o quê na peça parada" (`kit.movimento`, nos estilos vindos dos Reels) e três exemplos:
capa do carrossel, fixado de apresentação e capa de Reels. Com `--marca`, nas cores e fontes do `marca.yaml`.

## Campos da biblioteca

Três campos do `estilo.yaml` ajudam a pessoa a escolher o estilo na biblioteca, filtrando pelo que importa para o negócio
dela. Os códigos válidos e o nome que aparece na tela ficam em `04-LABORATORIO-DE-DESIGN/biblioteca/vocabulario.json`.

| Campo | O que diz | Quantos | Códigos |
|---|---|---|---|
| `combina-com` | para que tipo de negócio o estilo costuma servir | 2 a 5 | `saude`, `nutricao`, `psicologia`, `estetica-e-beleza`, `direito`, `financas`, `educacao`, `arquitetura-e-casa`, `tecnologia`, `gastronomia`, `moda`, `bem-estar`, `negocios-e-servicos` |
| `tom` | a impressão que o estilo passa | 1 a 3 | `sobrio`, `elegante`, `acolhedor`, `vibrante`, `divertido`, `tecnico`, `ousado` |
| `precisa` | o que o **carrossel** precisa para ficar como na prévia | pelo menos 1 | `funciona-sem-foto`, `foto-de-pessoa`, `foto-fundo-liso`, `fotos-do-assunto` |

Como preencher:
- `precisa` fala do **carrossel**: o que ele precisa para ficar como na prévia. Quem recorta a pessoa (tratamento
  `foto: recorte`, ou a capa com algo entre o fundo e a pessoa) leva `foto-de-pessoa` e `foto-fundo-liso`; quem mostra o
  rosto leva `foto-de-pessoa`; quem põe foto de objeto, prato ou lugar nas lâminas leva `fotos-do-assunto`. Quem não usa
  foto em nenhuma lâmina do carrossel de demonstração leva `funciona-sem-foto` (na tela: "Carrossel funciona sem foto"),
  que não convive com `foto-de-pessoa` nem com `foto-fundo-liso`.
- O **post fixado de apresentação** e a **capa de Reels** usam sempre um retrato da pessoa, em qualquer estilo. Por isso
  `funciona-sem-foto` não quer dizer que o estilo inteiro dispensa foto: só o carrossel dispensa.
- `combina-com` e `tom` saem da `linha`, dos `tratamentos` e das `kit.regras`: serifa sóbria com muito respiro serve a
  direito e finanças; adesivo e cor forte servem a moda e gastronomia. Não é regra: é a sugestão que a biblioteca mostra.
- No catálogo da Fábrica (`origem: catalogo`) os três são obrigatórios: quem confere isso é o teste do catálogo
  (`validarEstilo(estilo, pasta, { biblioteca: true })`). Na produção (gerar, conferir, prévia, kit) a falta deles **não**
  para nada: um estilo seu, personalizado antes dos campos existirem, continua funcionando depois do `/atualizar`. Num estilo
  criado das referências da empresa (`origem: referencias`) também são opcionais. Se vierem, valem sempre os mesmos
  códigos e limites.
- Código novo entra primeiro no vocabulário, com o rótulo em português simples.

O montador recusa código fora do vocabulário, quantidade fora do limite ou código repetido, e diz o estilo, o campo e o
valor.

## Formato de um estilo

```
estilos/<id>/
  estilo.yaml     obrigatório
  estilo.css      regras visuais, todas presas a .est-<id>
  layouts/        layouts próprios (se faltar, vale o de 04-LABORATORIO-DE-DESIGN/layouts/)
  objetos/        elementos visuais próprios: <tipo>.html, e desenhos em <tipo>/<nome>.svg
  demo.json       carrossel de demonstração da prévia (empresa fictícia)
  demo-fixados.json, demo-reels.json   os 3 posts fixados e a capa de Reels de demonstração
```

## Estilo próprio da empresa

Um estilo próprio (criado a partir das referências da empresa) tem este mesmo formato e mora no caminho `estilosProprios`
da empresa (`node _fabrica/core/empresa.js caminhos <codigo> --json`). Para criar um:

1. Copie a pasta inteira do estilo base do catálogo (`estilos/<base>/`: estilo.yaml, estilo.css, layouts, objetos e as
   demonstrações), nunca só o estilo.yaml.
2. Troque o `id` (código novo: minúsculas sem acento, números e "-", até 64) e ponha `origem: referencias`.
3. No estilo.css, troque `.est-<base>` por `.est-<id>`.
4. Faça só as mudanças pequenas (cores sugeridas, um tratamento, um layout). A demonstração continua com as fotos fictícias
   de `estilos/_demo/`; o CSS, os layouts e os objetos não carregam nada de fora (nem endereço, nem arquivo da empresa).
5. Gere as prévias: `node 08-FERRAMENTAS/biblioteca/gerar-previas.js <id> --estilos <estilosProprios> --saida <previas>/proprios`
   (para propostas ainda não escolhidas, numa pasta temporária: `--estilos` e `--saida` fora da Fábrica).
6. Olhe a prévia e só então mostre à pessoa.

Referência é só influência: nunca copiar foto, ilustração, frase ou tema das referências. O molde, o catálogo e a escolha do
estilo recusam estilo próprio com código fora da regra, atalho (junção ou link) ou sem `origem: referencias`, e a prévia de
um estilo próprio é feita com a rede fechada.

**Texturas dos modelos de edição.** O estilo pode usar as texturas dos Reels (papel rasgado, fita, jornal, caderno,
pincel, quadriculado, xadrez, adesivos, luz, janela retrô) pelo nome: no CSS, `textura(papel-jornal)` vira `url(...)`; num
layout ou objeto, `src="textura:fita-clara"` vira o endereço. Elas são desenhadas por
`08-FERRAMENTAS/tesseract/modelos/gerar-texturas.js` (sem arte de terceiros), ficam fora do git e o gerador e a prévia as
desenham sozinhos quando faltam. Na peça entregue, vão embutidas.

**Pessoa recortada.** O layout de capa pode pôr algo entre o fundo e a pessoa (moldura, palavra gigante): usa `{{fotoSrc}}`
embaixo e `{{recorteSrc}}` em cima, no mesmo lugar. O recorte vem do campo `recorte` da lâmina, um PNG transparente feito
com `08-FERRAMENTAS/carrossel/recortar.js` (só para foto de fundo liso). Sem recorte, o layout cai no
`{{^recorteSrc}}...{{/recorteSrc}}`, com a foto numa moldura comum.

```yaml
id: <id-curto>
nome: <nome>
linha: <uma frase do que define o estilo>
origem: catalogo                 # ou: referencias (estilo criado das referências da empresa)
combina-com: [<código>, ...]     # 2 a 5 (veja "Campos da biblioteca")
tom: [<código>, ...]             # 1 a 3
precisa: [<código>, ...]         # pelo menos 1
sugestao:
  cores: { escuro: "#RRGGBB", claro: "#RRGGBB", acento: "#RRGGBB", neutro: "#RRGGBB" }
  tipografia: { principal: <família>, mono: <família>, acento: <família ou vazio> }
  google: "<parâmetro family=... do Google Fonts, só para a prévia>"
formatos:
  carrossel:
    proporcao: "4:5"
    capa: [<layout>]
    miolo: [<layout>, ...]
    fecho: [<layout>]
    molde_do_miolo: rodizio      # ou: fixo, com um layout só no miolo (DG-10)
    alinhamento: esquerda        # ou: centro (DG-06)
    navegacao: { barra: false, arraste: false, contador: false }   # F-26
    fundos: [escuro, claro, acento]   # sequência declarada (DG-15)
    laminas: { min: 5, max: 10 }
  fixados: { apresentacao: <layout>, metodo: <layout>, contratar: <layout>, fundos: [...] }   # fundos: opcional (padrão: os do carrossel)
  reels: { modelo: <modelo de edição>, capa: <layout>, fundos: [...] }
# Estilo só de capa de Reels (Primeira Página): sem formatos.carrossel, com reels.capa e reels.fundos.
kit:                               # opcional: ficha do kit de identidade
  regras: [ "frase", ... ]          # em lista de bloco, uma por linha com -
  movimento: [ { video, peca } ]    # estilos vindos dos modelos de Reels
tratamentos: { destaque: cor|italico|fonte|peso (combináveis com +, ex. cor+fonte; fonte e peso só com a exceção do DG-04), foto: circulo|sangria|recorte|polaroide, textura: <tipo>, grafismo: <forma> }
```

O montador (`08-FERRAMENTAS/carrossel/molde.js`) recusa um `estilo.yaml` fora deste formato e diz o que falta.

## Conteúdo de uma lâmina (demo.json e gerador)

`{ fundo?, layout?, kicker, titulo, subtitulo, corpo, nota, itens, botao, foto, posicao_foto, recorte, retrato, palavra, visual }`. No texto,
`*palavra*` é o destaque (pelo tratamento que o estilo declara, cor ou itálico; nunca tamanho nem peso, DG-04) e `**palavra**` é negrito.

Campos que só alguns estilos desenham, e que os outros ignoram sem perder texto: `recorte` (a foto da capa sem o fundo,
para quem põe algo entre o fundo e a pessoa: Neon, Bloco, Círculo), `retrato` (o rosto no cartão do Palco e no círculo
riscado do fecho do Caderno) e `palavra` (uma palavra só, decorativa, que aparece gigante atrás da pessoa ou do mockup:
Bloco, Círculo na capa, Faixa em contorno). A `palavra` é enfeite: nunca leva informação que não esteja no texto.
`ilustracao` é o nome de um desenho do próprio estilo (`objetos/ilustracao/<nome>.svg`, traço em `currentColor`): a Gravura o mostra no painel lateral e no alto da capa; `numeral` é o número do passo, que a Cartilha mostra em círculo.

`visual` é o elemento visual da lâmina (DG-09):
- `{ tipo: "mockup", componente: "perfil" | "conversa" | ..., dados: {...}, marcadores: [{ n, x, y }] }`, da biblioteca
  `08-FERRAMENTAS/mockups/`;
- `{ tipo: "foto", arquivo }` ou `{ tipo: "numero", valor, rotulo }`;
- um objeto do próprio estilo, por exemplo `{ tipo: "postit", texto }` na Papelaria ou `{ tipo: "adesivo", nome: "sol" }`
  na Colagem. O objeto do estilo tem prioridade sobre os tipos genéricos de mesmo nome.

## O layout de cada lâmina

O montador escolhe o layout **pela posição** da lâmina: capa, fecho e, no miolo, o rodízio do estilo (`miolo`), na ordem. Se
o conteúdo traz um campo que esse layout não desenha, o texto some da lâmina; o conferidor reprova (C-21). Por isso quem
monta o `conteudo.json` escolhe o layout pela **forma** do conteúdo e o informa em `layout` (um dos layouts do estilo), sem
depender da posição. Respeitado o rodízio: dois layouts iguais nunca ficam seguidos (DG-10).

| Layout | Forma do conteúdo | Campos | Espaço para elemento visual |
|---|---|---|---|
| `capa` | abertura | kicker, titulo, subtitulo, nota, visual | sim |
| `conteudo-visual-abaixo`, `conteudo-visual-acima` | uma ideia com o seu visual | kicker, titulo, corpo, visual | sim |
| `lista-numerada` | 3 itens com título e explicação | numeral, kicker, titulo, itens (titulo, texto) | não: só tipográfico |
| `formula` | soma ou subtração de itens | kicker, titulo, corpo, itens (op, texto) | não: só tipográfico |
| `comparativo-fluxo` | passos em sequência | kicker, titulo, itens (texto) | não: só tipográfico |
| `grade-2-colunas` | itens em duas colunas | kicker, itens (titulo, texto) | não: só tipográfico |
| `citacao` | frase de destaque | titulo, corpo, autor | não: só tipográfico |
| `fecho-cartao` | fechamento | kicker, titulo, subtitulo, botao | não: cartão com a chamada |
| `fecho-visual` | fechamento com o visual da conversa | kicker, titulo, subtitulo, visual, botao | sim: o mockup da conversa ou o objeto do estilo |
| `fecho-cartao-visual` | fechamento em cartão, com o visual dentro | kicker, titulo, subtitulo, visual, botao | sim: o mockup da conversa dentro do cartão |

**Os layouts "só tipográfico" valem no máximo uma vez no miolo** (DG-09): são o respiro do ritmo. As demais lâminas usam
`conteudo-visual-abaixo` ou `conteudo-visual-acima` com mockup, foto ou objeto desenhado. Mockup grande com corpo de três
linhas não cabe: reduza as mensagens, os itens ou as linhas do mockup, ou use um mais baixo (checklist, notificação,
documento curto, antes e depois). O conferidor acusa o corte (M-03).

## Regras para estilos novos

- **Influência, não cópia (I-04):** de uma referência externa entra só o princípio de construção. Foto, ilustração,
  frase, tema, sequência de lâminas e a combinação de paleta e objeto que assina um designer nunca entram.
- **Papéis, não valores:** o CSS usa `--cor-escuro`, `--cor-claro`, `--cor-acento`, `--cor-neutro`, `--fonte-*` e
  `--piso-*`. Cor fixa só para o material de um objeto (o amarelo do post-it, o branco da polaroide).
- **Texto nos pisos (DG-01):** nada abaixo de `--piso-micro`.
- **Contraste (AA):** texto destacado em cor de acento precisa passar em 3:1 sobre o fundo. Nos layouts genéricos, o destaque
  usa `--d`, que já mistura o acento com a cor escura (fundo claro) ou a clara (fundo escuro). Se o seu estilo pinta o
  destaque de outro jeito, confira com `conferir.js`.
- **Nada cobre o texto (DG-23) e mockup não corta texto (M-03):** o visual cabe no espaço que sobra; o texto não perde.
- As fotos de `_demo/fotos/` são de demonstração, geradas por IA. Na produção, entram as fotos da empresa.
