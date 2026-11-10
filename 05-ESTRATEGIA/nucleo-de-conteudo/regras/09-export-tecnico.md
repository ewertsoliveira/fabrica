# 09 — Export Técnico

Como as peças viram arquivo de imagem sem quebrar. Esta regra existe porque **o preview pode parecer perfeito e o
arquivo exportado sair errado**: os dois divergem por motivos que não aparecem na tela.

---

## T-01 — Peça é HTML autocontido
Cada peça é um HTML autocontido no canvas declarado em `canvas.feed`: CSS embutido, sem JavaScript de layout, sem
dependência externa além da fonte.

## T-02 — Resolução nativa, sem escala
O arquivo renderiza na resolução nativa declarada. Nunca aplicar escala CSS nem fator de densidade para "simular" o
tamanho final: o layout reflui, as fontes encolhem e o espaçamento quebra.

## T-03 — Fonte externa exige `crossorigin`
A tag de folha de estilo de fonte externa carrega `crossorigin="anonymous"`. Sem isso, um exportador que roda na
página não consegue ler as regras da fonte (bloqueio de origem cruzada) e embute uma fonte substituta em silêncio. O
preview fica certo; só o arquivo sai com a tipografia errada. Fonte local, carregada por `@font-face` a partir do
arquivo da marca, evita o problema.

## T-04 — Esperar as fontes carregarem
Aguardar o carregamento completo das fontes antes de capturar. Captura disparada antes disso usa as medidas da fonte
substituta e desloca todo o texto.

## T-05 — Servir por HTTP, nunca por `file://`
Exportador que roda dentro da página só funciona com a peça aberta por servidor local. Aberta por duplo-clique
(`file://`), o navegador bloqueia as imagens locais e trava o export. Todo `preview.html` de peça carrega um aviso
que detecta o protocolo e oferece o endereço correto. (Renderização por navegador controlado por script, como o
gerador da Fábrica, não tem essa limitação.)

## T-06 — Imagem do usuário embutida como dado
Imagem fornecida pelo usuário entra embutida como URI de dados, nunca por caminho relativo. Caminho relativo quebra
fora da pasta exata onde o HTML mora.

## T-07 — Imagem de fundo é elemento de imagem, não propriedade CSS
Usar um elemento de imagem com ajuste de cobertura, não a propriedade de imagem de fundo com dado embutido: texto
longo em propriedade CSS derruba o interpretador do navegador.

## T-08 — Geração de HTML por script, nunca por shell
Gerar arquivo HTML por script de linguagem de programação, escrevendo o arquivo direto. Heredoc e `echo` de shell
interpolam `$` e crase, corrompendo dados embutidos.

## T-09 — Conferir o formato real do arquivo
A extensão mente. Verificar o formato real antes de declarar o tipo de mídia: tipo errado quebra a renderização.

## T-10 — Testar o export de verdade
Antes de entregar, **executar o export real** e olhar o arquivo gerado. Não basta olhar o preview: os dois divergem
(T-03, T-04).

## T-11 — Quebra de cache em visualização aninhada
Preview que embute peças em quadro aninhado não recebe quebra de cache automática. Sempre que o conjunto for
reestruturado (peça removida, renumerada, conteúdo trocado), incrementar o parâmetro de versão em **todos** os caminhos
internos.

## T-12 — Conferir contadores embutidos
Verificar contagens fixadas no código (total de peças, índice máximo, contador "3/7"). Não presumir que são calculadas
a partir do número real de elementos.

## T-13 — Substituição única no HTML gerado
Script que preenche um modelo substitui cada marcação estrutural **uma única vez**, limitando a captura à primeira
ocorrência e ao fechamento correspondente. Substituição global duplica mockups e quebra o layout.

---

## Checklist de export

- [ ] Fonte local por `@font-face`, ou fonte externa com `crossorigin="anonymous"`
- [ ] Espera pelo carregamento das fontes antes da captura
- [ ] Canvas na resolução nativa, sem escala
- [ ] Preview com aviso de protocolo, quando o export roda na página
- [ ] Imagens do usuário embutidas como dado
- [ ] Export real executado e arquivo conferido
- [ ] Parâmetro de versão incrementado nos caminhos internos, se o conjunto mudou
- [ ] Contadores embutidos conferidos
- [ ] Substituições do modelo feitas uma única vez

## Como se confere

T-01, T-02, T-04, T-06, T-10, T-12 e T-13 são garantidas e conferidas pelo gerador de carrossel (resolução do PNG,
contagem de slides contra o contador, mockup duplicado). As demais são do checklist acima, rodado pelo designer.
