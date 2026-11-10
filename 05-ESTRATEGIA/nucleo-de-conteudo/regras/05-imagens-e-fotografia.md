# 05 — Imagens, Fotografia e Recorte

Regras de imagem em peças de feed. O estilo de imagem de cada marca fica em `imagens` no `marca.yaml` da empresa ativa.

---

## Direção de arte

## I-01 — Toda arte tem gancho visual
Uma imagem vale mais que mil palavras: peça puramente textual é falha de direção de arte, não economia. Toda peça
carrega um gancho visual.

## I-02 — Estilo de imagem é decisão declarada
O estilo de imagem permitido vive em `imagens.estilo` (fotografia, vetor plano ou misto) e os estilos proibidos em
`imagens.vetos`. É uma decisão **explícita** da marca, nunca por omissão.

Exemplo de escolha para marca premium ou corporativa (não é obrigação): fotografia realista com luz dramática ou
cinematográfica, fundo escuro ou textura de acabamento; vetados o desenho de cartoon, o ícone 3D infantilizado e o
avatar genérico borrado.

## I-03 — Metáfora viva, nunca literal pobre
Fuja do óbvio literal (uma seta circular para falar de "ciclo"). Use metáfora conceitual (um dominó para ciclo, um
raio-x para diagnóstico).

## I-04 — Da referência externa, só a geometria
De imagem de referência externa extrai-se **somente** geometria e diagramação. Nunca a paleta, a tipografia ou o
grafismo alheio. Clonar a estética de terceiro é rejeição.

---

## Elemento visual de cada slide

## I-15 — Todo slide tem um elemento visual que representa o texto
Em carrossel, **cada** slide carrega um elemento visual ligado ao que o texto daquele slide diz (DG-09). No desenho da
peça, cada slide declara `visual: { tipo, descricao, arquivo }`. As fontes possíveis, nesta ordem de preferência:

1. **Mockup nativo** em HTML e CSS (regras M): perfil, busca, conversa, notificação, planilha, documento, cartão.
2. **Foto do próprio usuário**, recortada e composta sobre o fundo da marca (I-08 a I-12).
3. **Grafismo da marca:** forma, número gigante, corte, textura, diagrama (DG-13, DG-14). **Complementa** o elemento; só
   sozinho numa lâmina de miolo, e no máximo uma por carrossel (DG-09).
4. **Imagem trazida pelo usuário:** o agente escreve a **descrição** da imagem que o slide pede; o usuário gera ou
   escolhe onde quiser e põe o arquivo na pasta indicada.

**Sem o arquivo da opção 4, o slide cai para mockup ou grafismo. Nunca fica vazio** e nunca leva caixa cinza com
"imagem aqui" (M-02).

## I-16 — Nenhuma etapa depende de gerador de imagem
A produção de qualquer peça funciona sem serviço de geração de imagem por IA. Quando uma imagem gerada ajudaria, o
agente entrega a descrição pronta para o usuário usar na ferramenta que preferir; a peça não espera por ela.

## I-13 — Foto em tela cheia só na capa
Fotografia ocupando 100% do fundo, mesclada à marca, é recurso **da capa**. Nos slides internos, o fundo é o da marca
(DG-13) e o elemento visual (mockup, diagrama, foto recortada) flutua ao lado, acima ou abaixo do texto.

## I-14 — Véu de legibilidade na capa com foto
Capa com foto de fundo leva um véu de gradiente (transparente onde está o ponto focal, denso onde está o texto) para
proteger a leitura contra a luz da foto. O texto de apoio da capa usa o claro do par de base, nunca um cinza médio
que some no véu.

---

## Composição de foto com texto

## I-05 — Texto nunca sobrepõe o elemento focal
Bloco de texto não transpassa nem ofusca o elemento focal da foto (rosto, olhos, objeto principal). Em colisão, a
ordem de solução é:
1. Aumentar o espaçamento do texto para empurrá-lo.
2. Deslocar a ancoragem vertical da imagem.
3. Reenquadrar a foto.

Reduzir a fonte não está na lista (DG-02).

## I-06 — Mesclagem por gradiente transparente
Fotos mesclam ao fundo da marca por **gradiente transparente**. Vetado qualquer filtro que destrua a coloração ou os
pontos focais da foto (por exemplo, mesclagem por luminosidade), salvo pedido explícito de foto dessaturada.

## I-07 — Dissolução na base
A figura dissolve na base do quadro com gradiente da cor de fundo. Nunca termina em corte seco.

---

## Retrato do porta-voz

## I-08 — Recorte de fundo obrigatório
Em capa e peça de destaque, a foto do porta-voz entra como **PNG recortado** (pessoa sem fundo), composta sobre o fundo
da marca. O fundo original do estúdio ou do ambiente destoa da identidade e está vetado.

## I-09 — Descontaminação de cor na borda
O recorte exige descontaminação: pixels semitransparentes da borda (cabelo, tecido) carregam a cor do fundo antigo e
produzem halo sobre o fundo novo. Desfazer a mistura com a cor do fundo original:

```
cor_real = (cor_observada − (1 − alpha) × cor_fundo_original) ÷ alpha
```

Amostrar a cor do fundo **perto da borda tratada**, não no canto da foto: fundos de estúdio têm gradiente. Não usar
corte duro de transparência para matar o halo: serrilha cabelo e tecido, e fica pior que o halo.

## I-10 — Fundo da arte segue a luz da foto

| Foto | Fundo da arte |
|---|---|
| Estúdio claro, fundo branco | **Fundo claro** do par de base |
| Estúdio escuro, luz dramática | **Fundo escuro** do par de base |

Forçar o contrário cria halo e recorte visível.

## I-11 — Enquadramento busto, centralizado
Retrato de porta-voz entra em enquadramento **busto, centralizado**, nunca corpo inteiro na vertical. Se a foto-fonte
for de corpo inteiro, recortar o busto **no arquivo original em alta resolução** antes de remover o fundo: ampliar um
recorte de corpo inteiro borra a imagem.

## I-12 — Contraste do texto conforme o fundo

| Fundo | Técnica |
|---|---|
| Escuro | Sombra forte no texto sobre a foto |
| Claro | Reforçar o véu de gradiente para lavar a área atrás do texto |

Sombra sobre fundo claro suja; véu sobre fundo escuro some.

---

## Fotos que a empresa entrega

Para a operação funcionar bem, a empresa entrega:
- de 15 a 20 fotos do porta-voz, em alta resolução;
- pelo menos **dois cenários de luz**: um claro e um escuro;
- variedade de pose: busto frontal neutro, busto sorrindo e ao menos um enquadramento com espaço lateral para texto.

Os recortes ficam na pasta de marca e fotos da empresa ativa (caminho `pastaMarca`). Os originais em alta resolução não são versionados (peso).

---

## Como se confere

| Regra | Quem confere |
|---|---|
| I-15 (slide sem elemento visual, ou sem arquivo e sem queda para mockup ou grafismo), I-16 (chamada a serviço de imagem na linha) | Conferidor automático do carrossel |
| I-13 (foto de fundo em slide interno) | Conferidor automático, pelo modelo de lâmina usado |
| I-01 a I-12, I-14 | Revisor de qualidade e checklist do designer |
