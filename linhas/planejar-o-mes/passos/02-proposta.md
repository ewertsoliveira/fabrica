---
execucao: inline
estacao: planejamento
entrada: saida/objetivo.md
saida: saida/plano.json
---

# Passo 2: A proposta de posts

## Contexto a carregar

- `saida/objetivo.md`: objetivo, posts por semana, formatos, período e os posts que o calendário já tem nele
- o caminho `perfil` da empresa ativa (o que vende, para quem, como fala) e o caminho `decisoes` (público, chamada,
  promessa, linguagem e tom)
- `dados/mix-de-conteudo.md`: os três tipos de post e a proporção de cada um por objetivo
- `dados/criterios-de-qualidade.md`
- num retorno do passo 3: o que a pessoa pediu para mudar

## Instruções

1. **As datas.** Conte as semanas em blocos de 7 dias a partir do primeiro dia do período. Em cada bloco, ponha a
   quantidade de posts por semana do `objetivo.md` (o último bloco, se for mais curto, leva a parte proporcional),
   espalhados com pelo menos um dia entre dois posts. Nenhuma data fora do período, repetida ou no mesmo dia de um post
   que já está no calendário. Datas em `AAAA-MM-DD`; nunca escreva dia da semana.
2. **A mistura.** Calcule quantos posts de cada tipo (ensinar, mostrar os bastidores, convidar para comprar) a
   proporção do objetivo pede, arredondando, e espalhe os tipos pelo período, sem juntar os convites no fim (fora o
   lançamento, que convida mais perto da data).
3. **Os temas.** Um por post, tirado do perfil: o que a empresa vende e o que o público dela pergunta. Nenhum tema se
   repete, nem com os posts que já estão no calendário.
4. **O formato.** Entre os que a pessoa escolheu: ideia em partes é carrossel, ideia de uma frase é post, ideia que
   precisa de voz ou movimento é vídeo. Nunca três seguidos iguais.
5. **Cada post**, um objeto do calendário:
   - `id`: `plano-<run_id>-<nn>`, com `nn` de dois dígitos na ordem das datas (01, 02...);
   - `date`, `tipo` (`reels` no vídeo, `carrossel` ou `post`), `platform: "insta"` e `platformLabel`
     ("Instagram · Reels", "Instagram · Carrossel" ou "Instagram · Post");
   - `title`: o tema em poucas palavras; `hook`: o gancho, a primeira frase, que segura a pessoa;
   - `script`: no vídeo, as falas por cena no formato do CORE, uma linha `0:00–0:03 Gancho: <fala>` por cena seguida
     da linha `Na tela: <o que aparece>`; no carrossel, uma linha por imagem (`1. Capa: ...`, `2. ...`); no post, a
     mensagem da imagem;
   - `caption`: a legenda, com **uma** chamada no fim, a mesma do roteiro.
6. Preço, prazo, número ou promessa que o perfil não traz ficam entre colchetes (`[preço]`, `[data limite]`). O tom é
   o de `decisoes`; sem decisão de tom, o jeito de falar do perfil. Escreva no resumo qual tom usou e de onde ele veio,
   para a pessoa poder pedir outro na aprovação.
7. Grave `saida/plano.json` (só a lista, JSON válido) e `saida/plano.md` (o resumo por semana, no formato abaixo).
8. **Confira antes de mostrar:** rode
   `node _fabrica/core/plano-do-mes.js conferir <saida/plano.json traduzido> --empresa <codigo do run> --json`. Saída 1:
   corrija só os posts citados e confira de novo (no máximo 2 vezes; depois, mostre os erros à pessoa). Nada é gravado
   no calendário aqui.
9. Num retorno do passo 3, mude só o que a pessoa pediu e mantenha os códigos dos posts que ficaram.

## Formato

`saida/plano.json`: uma lista, um objeto por post, com `id`, `date`, `tipo`, `platform`, `platformLabel`, `title`,
`hook`, `script` e `caption`.

`saida/plano.md`:

```markdown
# Plano do mês: <DD/MM> a <DD/MM>

- objetivo: <o do objetivo.md>
- posts por semana: <N>
- formatos: <os escolhidos>
- tom: <o tom dos roteiros e das legendas, e de onde veio: decisoes ou perfil>
- total: <N> posts (<n> vídeos, <n> carrosséis, <n> posts)

## Semana de <DD/MM> a <DD/MM>

| Data | Formato | Tema | Para quê |
|---|---|---|---|
| <DD/MM> | <Vídeo, Carrossel ou Post> | <título> | <ensinar, bastidores ou convidar: em poucas palavras> |
```

## Exemplo

`saida/plano.json` (os três primeiros posts de um plano para "atrair gente nova", 3 por semana, de 24/11 a 30/11):

```json
[
  { "id": "plano-2026-11-23-101500-01", "date": "2026-11-24", "tipo": "carrossel", "platform": "insta",
    "platformLabel": "Instagram · Carrossel", "title": "Como reconhecer um pão de fermentação natural",
    "hook": "5 sinais de um pão de fermentação natural",
    "script": "1. Capa: 5 sinais de um pão de fermentação natural\n2. A casca estala baixinho ao sair do forno\n3. O miolo tem furos de tamanhos diferentes\n4. O sabor: acidez leve, aroma de grão tostado, miolo úmido\n5. Dura até três dias macio no saco de pano\n6. A lista de ingredientes é curta: farinha, água, sal e fermento natural\n7. Fecho: prove a diferença, fornada nova toda manhã",
    "caption": "Você sabe reconhecer um pão de fermentação natural? A casca, o miolo e até o rótulo contam a história. Passe aqui para provar a fornada da manhã." },
  { "id": "plano-2026-11-23-101500-02", "date": "2026-11-26", "tipo": "reels", "platform": "insta",
    "platformLabel": "Instagram · Reels", "title": "A noite inteira da massa",
    "hook": "Por que o nosso pão leva a noite inteira para ficar pronto?",
    "script": "0:00–0:03 Gancho: Você sabe por que o nosso pão leva a noite inteira para ficar pronto?\nNa tela: a massa descansando na bancada\n0:03–0:15 Bastidor: A massa descansa por muitas horas antes de ir ao forno. É esse tempo que deixa a casca crocante e o miolo úmido.\nNa tela: as mãos dobrando a massa\n0:15–0:25 Chamada: Passe aqui de manhã e prove a fornada que acabou de sair.\nNa tela: o pão saindo do forno",
    "caption": "Enquanto a cidade dorme, a massa trabalha. Passe aqui de manhã e prove a fornada que acabou de sair." },
  { "id": "plano-2026-11-23-101500-03", "date": "2026-11-28", "tipo": "post", "platform": "insta",
    "platformLabel": "Instagram · Post", "title": "Encomendas para as festas",
    "hook": "Encomendas para as festas abertas",
    "script": "Encomendas para as festas abertas: peça até [data limite] e retire na loja.",
    "caption": "Pão de fermentação natural, panetone da casa e broa para a sua mesa de fim de ano. Encomende pelo direct até [data limite]." }
]
```

`saida/plano.md`:

```markdown
# Plano do mês: 24/11 a 30/11

- objetivo: atrair gente nova
- posts por semana: 3
- formatos: vídeo, carrossel, post
- tom: acolhedor e direto (do perfil: a empresa ainda não tem decisão de tom)
- total: 4 posts (1 vídeo, 2 carrosséis, 1 post)

## Semana de 24/11 a 30/11

| Data | Formato | Tema | Para quê |
|---|---|---|---|
| 24/11 | Carrossel | Como reconhecer um pão de fermentação natural | ensinar: conteúdo que as pessoas salvam |
| 26/11 | Vídeo | A noite inteira da massa | bastidores: mostra o cuidado da casa |
| 28/11 | Post | Encomendas para as festas | convidar: abre as encomendas |
| 30/11 | Carrossel | 3 jeitos de guardar o pão | ensinar: resolve uma dúvida comum |
```

## Vetos

Refazer se ALGUMA for verdadeira:
1. Mais posts por semana do que o `objetivo.md` diz.
2. Data fora do período, repetida ou no mesmo dia de um post que já está no calendário.
3. Tema repetido, ou tema genérico sem ligação com o perfil.
4. Post sem roteiro ou sem legenda, ou com mais de uma chamada.
5. Vídeo sem as cenas com o tempo e o "Na tela".
6. Preço, prazo ou número inventado fora de colchetes.
7. `plano.json` que o `plano-do-mes.js conferir` recusa.

## Critérios de qualidade

- [ ] A mistura de tipos está perto da proporção do objetivo.
- [ ] Os formatos se alternam e são só os que a pessoa escolheu.
- [ ] Cada linha do resumo diz para quê o post está no plano.
- [ ] O `conferir` saiu 0.
