# Modelos de edição (Fábrica de Conteúdo)

Modelos prontos de Reels falado, aplicados pelo Tesseract a partir de um vídeo e da transcrição por palavra.
Não têm identidade de marca: sem marca no pedido, cada modelo usa as cores e letras dele. Com `marca` no pedido (ou
`usarMarca`), a paleta do estilo (papéis escuro, claro, acento e neutro) e as letras viram as da empresa, pelo
`tema-marca.js` (ver "Marca no vídeo", abaixo).
O modelo base da empresa é o do `projetos/montar-video.js` (lê o contrato de marca) e não depende desta pasta.

**Estado: teste.** Os 12 modelos foram reconstruídos a partir das categorias de estilo de mercado, com nomes, texturas e arte próprios.
Nenhum foi aprovado ainda.

| Modelo | Arquivo | O que tem |
|---|---|---|
| Vitrine | `estilos/vitrine.js` | legenda fina palavra por palavra, destaque em itálico pesado saindo do desfoque, fundo que desfoca, B-roll com chicote e em cartão |
| Recorte | `estilos/recorte.js` | papel rasgado no topo, título datilografado em fitas, legenda em pílula que acende, recorte colado, transição de jornal |
| Neon | `estilos/neon.js` | moldura neon que se desenha atrás da pessoa (precisa de `matte`), palavra manuscrita brilhante, zoom radial, tela final com a palavra repetida |
| Cinema | `estilos/cinema.js` | granulação, vinheta e tom quente, título manuscrito com brilho, legenda serifada com itálico, B-roll em meia tela com estrela |
| Impacto | `estilos/impacto.js` | caixa alta condensada, destaque gigante, falha cromática nos cortes, tela de grade deformada |
| Caderno | `estilos/caderno.js` | título com laço desenhado, legenda manuscrita, pincelada, folha pautada com o apresentador em círculo |
| Visor | `estilos/visor.js` | moldura de câmera com dados de exposição, título datilografado, legenda mono em barra preta, clarão de luz, tela dividida |
| Bloco | `estilos/bloco.js` | título condensado atrás da pessoa, legenda serifada que acende, transição em blocos em degrau, tela final clara |
| Adesivo | `estilos/adesivo.js` | faixa de título, adesivos que pulam, pílula com contorno, moldura em arco, foto colada, selo estourado |
| Círculo | `estilos/circulo.js` | título condensado atrás da pessoa, pílula azul serifada, B-roll que entra por um círculo, tela azul com anéis |
| Retrô | `estilos/retro.js` | janelas antigas em cascata com o vídeo, título manuscrito ácido, legenda limão, dissolução em pixels |
| Faixa | `estilos/faixa.js` | moldura fina, título itálico, faixas diagonais na transição, destaque pesado, B-roll em painel |
| Palco | `estilos/palco.js` | layout dividido (ilustração em cima, rosto em cartão arredondado embaixo, legenda palavra a palavra), cartão que sai pela base para a frase de fechamento, faixa de luz na troca de layout, aviso fixo no alto |

### Caminho inverso: estilos de carrossel que viraram Reels (aprovados)

Cada estilo de carrossel aprovado do catálogo (`04-LABORATORIO-DE-DESIGN/estilos/<id>`) ganhou um modelo de Reels com o
mesmo nome, ligado em `formatos.reels.modelo` do `estilo.yaml`. Todos seguem as mesmas regras:

- **Vídeo limpo:** sem grade, faixa ou véu sobre a pessoa, e grade de cor só leve.
- **Título abaixo do queixo:** nada cobre o rosto.
- **B-roll num arranjo que deixa o rosto livre:** a pessoa em miniatura só entra depois que a imagem de destaque já
  está na tela.
- **A pessoa nunca sai de cena:** quando a imagem de destaque entra, a pessoa continua no mesmo quadro, em todos os 27
  modelos. Só a forma varia (miniatura, círculo, divisão, lado a lado, recorte). Não existe arranjo com a imagem sozinha.
- **Rosto inteiro, com folga:** em janela pequena a cabeça fica acima do centro e o queixo longe da borda (função
  `enquadre`, de `estilos/_comum.js`); o corpo recortado entra dentro do círculo ou se dissolve na base, nunca termina numa
  linha reta.

| Modelo | Arquivo | Arranjo padrão | O que tem |
|---|---|---|---|
| Concreto Ácido | `estilos/concreto-acido.js` | recorte | caixa alta monumental, faixa ácida atrás do destaque, cartão de borda dura, colunas só nas telas pretas |
| Luz de Vela | `estilos/luz-de-vela.js` | rosto-mini (círculo) | luz dourada que respira, serifa clássica, itálico dourado, fio que se desenha |
| Revista de Domingo | `estilos/revista-dominical.js` | dividir | itálico terracota, fio fino, moldura leve na tela clara |
| Protagonista | `estilos/protagonista.js` | recorte | caixa alta pesada, sublinhado que cresce, pessoa recortada sobre o círculo de acento |
| Fanzine | `estilos/fanzine.js` | imagem-mini | título e legenda em tarjas, destaque na tarja amarela, imagem girada com fita, anotação à mão |
| Terra e Sálvia | `estilos/terra-e-salvia.js` | rosto-mini | itálico terracota, formas orgânicas cortadas pela borda, cantos redondos |
| Cartilha | `estilos/cartilha.js` | dividir | Poppins pesada, destaque em pílula amarela, B-roll como passo numerado |
| Circuito Néon | `estilos/circuito-neon.js` | lado-a-lado | destaque néon sublinhado, rótulo entre colchetes, grade e colchetes só na tela escura |
| Gravura | `estilos/gravura.js` | dividir | itálico dourado, imagem e pessoa em quadros de fio duplo, painel de fios |
| Primeira Página | `estilos/primeira-pagina.js` | recorte | serifa grande, itálico azul mais pesado, B-roll limpo no papel claro |
| Contraste | `estilos/contraste.js` | dividir | rótulo em pílula, nota à mão, imagem inclinada sobre a faixa diagonal |
| Papelaria | `estilos/papelaria.js` | rosto-mini | Instrument Serif, cartão preso por prendedor sobre o círculo azul |
| Colagem | `estilos/colagem.js` | rosto-mini | texto centralizado, rótulo em pílula, folha colada com adesivo, pessoa em polaroide |
| Editorial | `estilos/editorial.js` | imagem-mini (círculo) | serifa fina centralizada, degradê só atrás do texto, imagem num círculo pequeno |

Os doze últimos são declarações curtas sobre a base `estilos/_inverso.js`, que cuida das regras acima. Cada declaração
traz só o que é do estilo: fontes, cores, forma do destaque, moldura, telas e enfeites. Um estilo novo do catálogo vira
Reels com um arquivo desses.

## Uso

```sh
node montar.js <modelo|todos> amostra/pedido.json [--exportar] [--quadros 0.5,2,6] [--saida <pasta>] [--usar-marca]
```

Gera `saida/<modelo>.tsrct` e `saida/<modelo>-quadros.png` (folha de conferência) ao lado do pedido. Com `--exportar`, também o MP4.
Leva 2 a 3 minutos por modelo sem exportar: a maior parte é a medição dos textos, feita no render real do Tesseract.

- `--saida <pasta>`: o projeto, o MP4 e a folha de quadros vão para essa pasta (nada é criado em `saida/` ao lado do pedido); o
  `.cache` das cenas e do trecho continua ao lado do pedido.
- `--usar-marca`: vale como `"usarMarca": true` sem mexer no arquivo do pedido, e a marca da empresa ativa (`FABRICA_EMPRESA`)
  **vence** a `marca` escrita no pedido. O log ganha uma linha `marca-usada {"arquivo", "exemplo", "empresa", "cores", "fontes",
  "principalItalico"}`: qual `marca.yaml`, quais cores e quais letras (caminho absoluto, ou `null` onde o modelo ficou com a
  dele) foram usados. A prévia na marca da biblioteca (`08-FERRAMENTAS/biblioteca/video-marca.js`) confere essa linha.
- Sem as duas opções, tudo fica como antes (o `montar.test.js` compara o projeto gerado com o de antes, com um motor falso).

**`aceitaMarca`.** Todo modelo que troca a paleta inteira pelo `ctx.marca` declara `aceitaMarca: true` no objeto que exporta
(os 27 de hoje; nos do caminho inverso, a base `_inverso.js` declara por eles). Só um modelo com essa marca entra no vídeo
"na sua marca" da biblioteca; os outros ficam no vídeo base. Modelo novo: só ponha `aceitaMarca: true` quando ele já ler o
`ctx.marca` (o `montar.test.js` confere que todo modelo com o sinal lê a marca).

## Pedido

| campo | obrigatório | o que é |
|---|---|---|
| `video`, `palavras` | sim | vídeo e transcrição por palavra (`[{w, ini, fim}]` em ms, a mesma saída do `projetos/palavras.js`) |
| `trecho` | não | `{ini, fim}` em segundos; recorta vídeo, máscara e palavras |
| `matte` | não | máscara da pessoa (RVM); sem ela o Neon não põe a moldura atrás do corpo |
| `chamada` | não | `{texto, palavra, ini, fim}`: título de abertura |
| `destaques` | não | palavras com tratamento especial |
| `broll` | não | `[{img, ini, fim, fundo}]`: imagem centralizada numa cena 1080x1920; o primeiro item é o B-roll principal |
| `palavraTela` | não | `{texto, ini, fim}`: tela cheia com uma palavra (Neon e Impacto) |
| `marca` | não | `{ cores?, fontes? }`: `cores` com `escuro`, `claro`, `acento`, `neutro` (hex `#RRGGBB`); `fontes` com `principal`, `mono`, `acento` (arquivo `.ttf`/`.otf`: absoluto, ao lado do pedido ou em `fontes/`) e `principalItalico: true` quando a letra principal tem itálico. O que faltar fica com o papel original do modelo. O antigo `marca.acento` continua valendo como `marca.cores.acento` |
| `palco` | só no Palco | `{ini, fim, foco?, fundo?, escalaCena?}`: intervalo do layout dividido (padrão: do 1º ao último B-roll); `foco` = altura do rosto no vídeo de origem (padrão 760) |
| `aviso` | só no Palco | texto fixo no alto, do começo ao fim (regra V-05: ilustração ou simulação diz que é) |
| `usarMarca` | não | verdadeiro (sem `marca` no pedido) usa as quatro cores e as letras `tipografia.principal`, `tipografia.mono` e, se houver, `tipografia.acento` do `marca.yaml` da empresa ativa; sem `marca.yaml`, cai na marca de exemplo e avisa |
| `rosto` | não (caminho inverso) | `{layout?, y?}`. `layout`: um de imagem-mini, rosto-mini, dividir, lado-a-lado, recorte (padrão: o do modelo). `y`: altura do centro da cabeça no vídeo de origem (padrão 600). `cabeca`: altura da cabeça, cabelo incluso, no vídeo de origem (padrão 600) |
| `rotulo` | não (caminho inverso) | rótulo curto acima do título (padrão `REELS`) |
| `anotacao` | não (Fanzine e Contraste) | anotação manuscrita junto da imagem do B-roll |

## Peças

- `motor.js`: projeto, camadas, efeitos, keyframes, medição de texto, agrupamento da legenda, recorte do trecho.
- `estilos/_comum.js`: legenda progressiva (texto apagado + prefixo falado), linha com estilos mistos, pessoa recortada,
  pessoa e cena em janela (`pessoaEmJanela`, `cenaEmJanela`) e pessoa recortada reduzida (`pessoaRecortadaReduzida`).
- `estilos/_matiz.js`: giro de matiz que leva uma cor do estilo até a da marca, mantendo a claridade (`giroDeMatiz`,
  `gira`), para o efeito `hueSaturation` nas texturas do Adesivo e no brilho do Luz de Vela.
- `estilos/_inverso.js`: base dos modelos do caminho inverso (arranjos do B-roll, título, legenda, telas e moldura).
- `tema-marca.js`: o tema da marca de cada pedido (`resolver`, `cor`, `fonte`, `letra`, `contrasteOk`); não guarda estado
  entre pedidos e só lê o `marca.yaml` com `usarMarca`. Testes (sem Tesseract): `tema-marca.test.js`, `inverso.test.js`
  (os 12 do caminho inverso, Concreto Ácido e Luz de Vela), `lote-a.test.js` (Vitrine a Visor), `lote-b.test.js` (Bloco a
  Palco) e `todos-na-marca.test.js` (os 27 de uma vez com as duas marcas de mentira).
- `gerar-texturas.js`: papel, fita, jornal, pincel, caderno, luz dourada, fita vermelha, grade néon e degradê,
  desenhados em SVG (`node gerar-texturas.js`).
- `gerar-previas.js`: prévias da galeria do painel (`previews/<modelo>.webm` 540p sem áudio e `.jpg` no segundo `capa` do modelo), a partir dos MP4 de `amostra/saida`.
- `fontes/`: todas OFL (Google Fonts): Inter, Bebas Neue, Caveat, Courier Prime, Great Vibes, Instrument Serif, Kaushan Script, Oswald, Space Mono,
  Anton, Cormorant Garamond, DM Mono, DM Sans, DM Serif Display, Fraunces, Inter Tight, JetBrains Mono, Montserrat,
  Playfair Display, Poppins, Space Grotesk. Cada família nova tem o seu `<Família>-OFL.txt` ao lado.
- Track matte em `alpha` com uma forma animada revela conteúdo por dentro dela (círculo que cresce do Círculo).

## Marca no vídeo

Os 27 modelos leem a marca. Sem marca no pedido, cada um fica exatamente como era (cores, letras, posições e tempos; os
testes comparam as camadas com as de antes, valor por valor). Exceção autorizada pelo responsável (decisão D7 da prancha
do vídeo na marca): nos modelos do caminho inverso, a legenda cortada na borda do B-roll e o cartão da imagem do Fanzine
valem também sem marca (ver abaixo).

**De onde vem a marca.** Duas formas, no pedido:

```json
"marca": {
  "cores":  { "escuro": "#RRGGBB", "claro": "#RRGGBB", "acento": "#RRGGBB", "neutro": "#RRGGBB" },
  "fontes": { "principal": "Letra-Bold.ttf", "mono": "LetraMono-Regular.ttf", "acento": "Letra-Italic.ttf", "principalItalico": false }
}
```

Tudo é opcional: o papel que faltar fica com a cor ou a letra do modelo. As letras são arquivos `.ttf`/`.otf` (caminho
absoluto, ao lado do pedido ou em `fontes/`). Ou então `"usarMarca": true`, sem `marca`: o vídeo usa a marca da empresa
ativa (as quatro cores e as letras `tipografia.principal`, `tipografia.mono` e, se houver, `tipografia.acento` do
`marca.yaml`, pelo `08-FERRAMENTAS/marca/marca.js`). A `marca` do pedido vence o `usarMarca`. Sem `marca.yaml`, o leitor
cai na marca de exemplo e avisa no log; o vídeo sai mesmo assim. Um pedido antigo só com `"marca": { "acento": "#RRGGBB" }`
continua aceito (vale como `cores.acento`).

**Letra de destaque (itálico).** Quando o destaque do estilo é em itálico: se a letra principal da marca tem itálico
(o arquivo é itálico, a face importada tem itálico, ou `principalItalico` / `tipografia.principal.italico` confirmado pelo
arquivo), o destaque vai nela; senão, na `fontes.acento` da marca; senão, na letra de destaque do próprio estilo. Um aviso
de itálico que o arquivo desmente é ignorado, com aviso no log. Destaque que não é itálico (cor, tarja, pílula, sublinhado)
usa a letra principal. O peso que o estilo pedia vira o mais próximo que o arquivo da marca tem (letra de um peso só: o
próprio).

**Contraste e recuo.** Cada texto que ganhou cor da marca é conferido: **3:1 sobre fundo liso** (tela, tarja, pílula, faixa,
folha) e **4,5:1 sobre o vídeo** (comparado com o escuro da marca, ou com o claro se o texto for o escuro). Abaixo disso, o
texto (ou o par texto e fundo, ou a tela inteira, conforme o modelo) volta ao par original do estilo e sai um aviso
`[marca] ...` no log (um por caso). Se nem o par do estilo chega a 3:1, o texto vai no escuro ou no claro do estilo, o que
contrastar mais. Branco, preto e cinzas de sistema não viram cor da marca. O pedido antigo só com `marca.acento` também
passa por essa conferência.

**Encolher até caber.** Com qualquer marca (também o pedido antigo só com `marca.acento`), título, legenda, palavra final,
rótulos e anotações que passariam da largura encolhem em passos de 15% até caber, no mínimo 40% do corpo original (16 px no
mínimo; 60 px nos títulos gigantes do Bloco e do Círculo). O título nunca sobe na direção do rosto. Se no piso ainda não
couber, sai um aviso `[marca] o texto "..." não cabe ...` (encurte o texto); se nem der para medir, erro `marca: ...`.

O `montar.js` resolve o tema uma vez por pedido e entrega `ctx.marca` (o tema, ou `null`) a cada modelo; `ctx.acento`
continua existindo (a cor de acento do tema). Nos modelos do caminho inverso, a base `_inverso.js` aplica o tema:

- **Cores:** `def.cores.escuro|claro|acento|neutro` viram as da marca. Cores próprias do estilo fora desses papéis (o
  `papel` branco da Papelaria, por exemplo), branco, preto e cinzas fixos não mudam.
- **Letras:** `titulo` e `leg` usam a letra principal; `rot`, a mono; `nota` (a letra de mão do estilo) fica sempre a do
  estilo, só a cor muda (decisão D4). `tituloDest` e
  `legDest` usam a principal, a menos que o destaque do estilo seja itálico (`destaque: 'italico'`) e a principal não
  tenha itálico: aí ficam com a letra de acento da marca ou, sem ela, com a letra de destaque do próprio estilo. Outras
  letras do estilo entram por `papeisFontes` na declaração (ex.: a Cartilha tem `papeisFontes: { numero: 'principal' }`).
  O aviso de itálico (`principalItalico` no pedido, `tipografia.principal.italico: true` no `marca.yaml`) é ignorado, com
  aviso no log, quando o arquivo da principal não tem face itálica.
- **Peso:** o arquivo da marca é um só; o peso que o estilo pedia vira o mais próximo que o arquivo tem (para uma letra de
  um peso, o próprio).
- **Caber na tela:** com marca, título, legenda, palavra final, rótulo e anotação encolhem em passos de 15% até caber
  (888 px no título e no rótulo à esquerda, 936 px na legenda, na palavra final e no rótulo centrado, menos a folga da
  pílula; a anotação fica entre as margens de 72 px), sem passar de 40% do corpo original. A última linha do título fica
  na mesma altura.
- **Contraste:** se um texto da marca fica abaixo de 3:1 sobre o fundo liso dele (tela, tarja, pílula ou forma de um
  enfeite, como o círculo do número da Cartilha, por `H.par`), o fundo **fica na cor da marca** e o texto vai para o
  **escuro da marca**, se ele chega a 3:1 ali (decisão D1: ex. a tela de acento da Papelaria, as telas claras da Revista de
  Domingo, de Terra e Sálvia e da Primeira Página com o destaque no acento, a pílula do rótulo do Contraste). Só se nem o
  escuro da marca lê ali (ou o texto já é o escuro), aquele texto e o fundo voltam ao par original do estilo (na tela
  cheia, a tela inteira, contando a anotação), com um aviso `[marca]` no log; se nem o par do estilo chega a 3:1, o texto
  vai no escuro ou no claro do estilo. Sobre o vídeo, que não é liso, o texto é comparado com o escuro da marca (ou com o
  claro, se o texto for o escuro) e precisa de 4,5:1; abaixo disso, volta à cor do estilo (o escuro da marca não entra aí).
- **Texto no tom médio:** o neutro da marca é um tom médio e fica fraco como texto. Todo texto no papel `neutro` vai para a
  cor da marca de mais contraste, com pelo menos 4,5:1 sobre o fundo real; num destaque, fora a cor do texto de base, para
  ele continuar distinto (decisão D2: o destaque e a palavra final da Gravura vão para o acento da marca; título, legenda,
  rótulo e palavra final do Editorial, para o claro). Formas e fios no neutro continuam no neutro. Sem cor da marca que
  passe (ou sem neutro na marca), fica o neutro, na regra de contraste acima.
- **Legenda na borda do B-roll:** com ou sem marca, a frase que começa na tela do B-roll e termina depois dela (ou o
  contrário) é cortada na borda: o trecho sobre a tela fica na cor e na altura da tela, o trecho sobre o vídeo na cor e na
  altura do vídeo (antes a frase inteira ficava na cor escura da tela por cima da camiseta). Até o item 6.6A isso valia só
  com marca; o responsável autorizou mudar também o vídeo sem marca (decisão D7). O trecho que sobra do corte com menos de
  150 ms sai (só piscaria), e o destaque dito a menos de 150 ms da borda só entra do outro lado; ali, a forma do destaque já
  dito (sublinhado, tarja, pílula, fio) aparece cheia, sem crescer de novo.
- **Imagem pequena do estilo:** `def.imagemMini = { img, leg }` ajusta a janela da imagem e a altura da legenda no arranjo
  `imagem-mini`. O Fanzine usa o cartão em x 690, y 1140, 300 px, com a legenda em 1545, para a imagem girada e a fita
  ficarem longe da mandíbula (decisão D7, com e sem marca).
- **Pedido antigo:** um pedido só com `marca.acento` (sem cores nem letras) agora também passa pela conferência de
  contraste e pelo encolher até caber; o resto do vídeo fica igual ao do mesmo pedido sem marca.
- **`usarMarca` tolerante:** com `usarMarca`, letra ausente, que não é `.ttf`/`.otf` ou fora da pasta da empresa vira um
  aviso `marca: ...` no log e o modelo usa a letra dele nesse papel; as cores continuam valendo. Erro do leitor de marca
  sai numa linha `marca: ...`, sem pilha. Com `marca` explícito no pedido, letra ou cor inválida continua parando com erro.

Os 15 modelos próprios (sem a base `_inverso`) leem `ctx.marca` cada um com o seu mapa de papéis, na mesma regra; o
"encolher até caber" e a conferência de contraste ficam dentro de cada modelo. Decisões do responsável que valem neles
(item 6.6B):

- **Com ou sem marca (correções do vídeo sem marca também):** no Bloco, Retrô, Vitrine, Cinema e Caderno, a frase (e, na
  Vitrine, o destaque) que atravessa a borda do B-roll ou da troca de fundo é cortada ali, e a tinta escura nunca fica
  sobre o vídeo. No Círculo, a caixa alta da tela só entra depois que o círculo cobriu o rosto (650 ms) e a última frase
  da tela fica até o fim dela (dita antes, ela aparece assim mesmo). No Retrô, o título fica em y 1465 (longe do queixo
  da última janela) e a legenda da abertura em 1690. No Caderno, o título com o laço fica em y 1385.
- **Círculo:** se o branco não lê sobre o acento da marca, a pílula e a tela continuam no acento e o texto delas vai para o
  escuro da marca (3:1 calculado); só se o escuro também falhar, voltam ao azul do estilo, com aviso.
- **Impacto:** com a letra da marca, legenda e destaque em caixa alta (`allCaps`), como a condensada do estilo.
- **Neon, Cinema e Caderno:** a letra manuscrita do estilo fica com qualquer marca; só as cores mudam.
- **Luz de Vela:** o brilho (textura dourada) gira o matiz até o acento da marca e a grade de cor acompanha (fria com
  acento frio, sempre leve).
- **Palco:** com ou sem marca, durante o palco a legenda sai do cartão (onde caía no queixo) e vai para baixo dele
  (y 1625), na tinta sobre o fundo claro, sem sombra; o destaque dela fica no acento se ele tiver 3:1 sobre o fundo, senão
  na tinta. Só com marca, a cena do B-roll vem com o fundo liso na cor do fundo do palco (`cenaLisa()` do modelo, que o
  `montar.js` lê para preparar a cena num arquivo à parte); sem marca, a cena de sempre.

### O que cada modelo troca

"Itálico pela regra" = a regra da letra de destaque, acima. Texturas (PNG) ficam como são, menos as do Adesivo e o brilho
do Luz de Vela, que giram até o matiz do acento. Na base `_inverso`, `titulo` e `leg` = principal, `rot` = mono, `nota` = a letra de mão do estilo.

| Modelo | Cores (estilo → marca) | Fica do estilo | Letras |
|---|---|---|---|
| Vitrine | destaque → acento | branco da legenda, tinta escura sobre a imagem, borda branca | fina → principal; destaque itálico pela regra |
| Recorte | tinta → escuro; papel da pílula e da borda → claro | papel azul, fitas e jornal (texturas), sombras | pílula → principal; fita datilografada → mono |
| Neon | neon (moldura, bordas, anel, brilho) → acento, miolo = acento clareado; painel e tela → escuro | branco da legenda | legenda e tela final → principal; manuscrita fica a do estilo |
| Cinema | creme do subtítulo e da legenda → claro | branco do título e das estrelas, tinta da meia tela, película | serifa → principal; itálico pela regra; manuscrita fica a do estilo |
| Impacto | legenda e anel → acento | branco do destaque, preto e grade da tela final, véu | as condensadas → principal, em caixa alta (`allCaps`) |
| Caderno | giz do título e do laço → acento; legenda sobre o vídeo → claro; tinta da folha e laço da pessoa → escuro | folha e pincel (texturas), sombras | título → principal; letra de mão fica a do estilo |
| Visor | moldura → escuro; título, exposição e laterais → acento | branco da legenda, barra preta, cantoneiras, clarão | título → principal; legenda, exposição e laterais → mono |
| Bloco | blocos da transição → acento; tela final → claro; título final, legenda sobre a imagem, anel da pessoa → escuro | branco do título e da legenda sobre o vídeo | título, palavra final e legenda → principal |
| Adesivo | faixa do título → acento; texturas rosa (xadrez, papel quadriculado, selo) e sombra da foto → **tingidas** até o matiz do acento | contorno preto, pílula branca, adesivos coloridos | título, selo e legenda → principal; destaque itálico pela regra |
| Círculo | bordas, anel da pessoa, pílula e tela → acento; texto da pílula e da tela → escuro, se o branco não ler sobre o acento | branco do texto (quando lê) e dos anéis | título, caixa alta (em `allCaps` com a letra da marca) e legenda → principal; itálico pela regra |
| Retrô | creme (fundo, pixels) → claro; limão (título, legenda sobre o vídeo) → acento; tinta → escuro | janela de sistema antigo, sombra dura | título e legenda → principal |
| Faixa | azul (moldura, painel, faixas) e amarelo do título → acento; tela final → claro; legenda da tela final → escuro | branco da legenda, contornos | legenda fina → principal; título, destaque e palavra repetida pela regra do itálico |
| Palco | fundo do palco e fundo liso da cena do B-roll → claro (`palco.fundo` do pedido vence); frase e legenda sobre o claro (no palco, abaixo do cartão, também sem marca) → escuro; destaque → acento | branco da legenda fora do palco, luz que varre, tarja do aviso | legenda, destaque e frase → principal; aviso → mono |
| Concreto Ácido | preto → escuro; papel → claro; ácido → acento | sombras pretas | título, legenda, destaque e palavra final → principal; rótulo → mono |
| Luz de Vela | escuro → escuro; creme → claro; dourado → acento; brilho (textura) → **tingido** até o matiz do acento; grade quente → acompanha o acento | — | serifa → principal; itálico pela regra; rótulo → mono |
| Revista de Domingo | os quatro papéis (tela clara com texto escuro, destaque no acento; na tela, o destaque que não lê vai para o escuro da marca) | — | `_inverso`; destaque itálico pela regra |
| Protagonista | os quatro papéis (círculo e sublinhado no acento, tela clara) | — | `_inverso`; destaque (sublinhado) → principal |
| Fanzine | os quatro papéis (tarjas no escuro, destaque na tarja de acento) | fita vermelha (textura) | `_inverso`; anotação: a letra de mão do estilo |
| Terra e Sálvia | os quatro papéis (formas orgânicas, tela clara; na tela, o destaque que não lê vai para o escuro da marca) | — | `_inverso`; destaque itálico pela regra |
| Cartilha | os quatro papéis (pílula e círculo do passo no acento, tela escura) | — | `_inverso`; número do passo → principal (`papeisFontes`) |
| Circuito Néon | os quatro papéis (sublinhado e colchetes no acento, tela escura) | grade néon (textura) | `_inverso`; destaque (sublinhado) → principal |
| Gravura | os quatro papéis (fios e painel no neutro, tela escura; o destaque e a palavra final, no neutro do estilo, vão para o acento da marca) | — | `_inverso`; destaque itálico pela regra |
| Primeira Página | os quatro papéis (papel claro, itálico no acento; na tela, o itálico que não lê vai para o escuro da marca) | — | `_inverso`; destaque itálico pela regra |
| Contraste | os quatro papéis (faixa diagonal e pílula no acento, tela escura; o rótulo claro que não lê na pílula vai para o escuro da marca) | — | `_inverso`; anotação: a letra de mão do estilo |
| Papelaria | os quatro papéis (tela no acento com texto claro, círculo; o texto que não lê na tela vai para o escuro da marca) | papel branco do cartão e das bordas | `_inverso`; destaque itálico pela regra |
| Colagem | os quatro papéis (pílula, tela escura) | papel branco da folha e da polaroide | `_inverso`; destaque itálico pela regra |
| Editorial | os quatro papéis (o neutro do estilo é o texto claro: título, legenda, rótulo e palavra final vão para o claro da marca; aro e fio ficam no neutro; tela escura) | degradê atrás do texto (textura) | `_inverso`; destaque itálico pela regra |

A prova visual dos 27 modelos com uma marca quente e uma fria fica numa página local de conferência, fora do git (o vídeo
de demonstração mostra uma pessoa real).

## O que aprendemos do Tesseract 0.3.1

- A camada `AiEdit` aceita `styleId`, mas o render local sai igual ao vídeo cru: os estilos da Captions são aplicados na nuvem, não no motor.
- Efeitos animáveis por `setFxLayerEffectParamAnimator` (desfoque gaussiano, direcional, radial, aberração cromática, lente).
- Escalas calibradas: aberração cromática 1 a 1,5 já é um pico forte (5 é exagerado); `bulge` usa centro e raio normalizados (0 a 1).
- Traço que se desenha: forma com `trim` e keyframes em `trimEnd` (0 a 100).
- `animatorSetCornerRadius` só vale para mídia (imagem, vídeo). Em retângulo, use `rect.roundness` em pixels.
- O brilho nativo (`outerGlow`) é fraco em traço fino; o neon é uma cópia mais grossa e desfocada por baixo.
- Keyframes no mesmo milissegundo derrubam o lote inteiro; o motor ordena e deduplica.
- O track matte lê a máscara no quadro inteiro e ignora a escala e a posição da camada da máscara. Por isso, a máscara
  da pessoa reduzida é gerada à parte (ffmpeg) já no tamanho e no lugar.
- Forma com desfoque gaussiano sai sólida no render: brilho suave entra como textura (luz-dourada).
- Fonte variável que não seja a Inter pode registrar só um peso (a Cormorant variável só lia o Light): usar os
  arquivos estáticos.
