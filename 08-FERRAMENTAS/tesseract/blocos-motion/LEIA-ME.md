# Biblioteca de blocos de motion (Tesseract 0.3.1)

Gráficos de motion montados por **JSON** (textos e tempos), sem escrever código por vídeo. Cores, fontes e o
endereço da conta vêm do contrato de marca da empresa ativa (o `marca.yaml`, caminho `marca` em `empresa.js caminhos`); nenhum bloco guarda identidade de empresa.

Catálogo visual: `node gerar-catalogo.js` renderiza cada bloco pelo próprio Tesseract (quadros reais, estados-chave) e
escreve `catalogo.html`. O catálogo e as miniaturas são gerados na hora e ficam fora do git.

## Uso em 3 passos

1. Descreva os blocos num JSON (lista), com tempos em **segundos do vídeo editado inteiro**.
2. Rode depois do `projetos/montar-video.js`, sobre o `.tsrct` que ele gerou:

```
node blocos-motion/aplicar.js projetos/<NN>/<video>.tsrct projetos/<NN>/blocos.json \
     [--faixa 955,1305] [--desloca 0] [--refazer] [--janelas janelas.json] [--sons sons.json] [--simular]
```

3. Confira com `tsrct preview -p <video>.tsrct -t SEGUNDOS -o f.png`, um quadro por bloco.

`--simular` só valida e imprime o resumo. Em código: `require('./blocos-motion/index').montar(blocos, {idBase, desloca, faixa, fontes})`.

## Contrato JSON único

```json
{ "id": "gancho", "tipo": "placa", "inicio": 4.0, "fim": 8.0,
  "textos": { "...": "..." }, "opcoes": { "...": "..." } }
```

`id` é único no vídeo (vira o prefixo das camadas). Cada bloco devolve camadas, ações, `janelas` (`{id, inicio, fim}`, que
alimentam o export em pedaços), `sons` (sugestões para o mixador) e `avisos`.

## Os nove blocos

| tipo | para que serve |
|---|---|
| `placa` | kicker mono + headline em placa escura (gancho, "antes", pergunta do CTA) |
| `selo` | pílula clara com texto escuro e pop |
| `esquema-divisao` | barra que se divide em duas partes, cada uma para o seu destino (3 estados) |
| `mapa-pontos` | mapa de pontos com países destacados, rótulos e risco/"cancelado" |
| `ficha-documento` | papel claro recriado (cabeçalho, título, campos, rodapé "recriação gráfica · fonte") |
| `diagrama-caixas` | 2 caixas + seta de duas pontas + moldura tracejada + etiqueta + selos |
| `cartao-cta` | cartão final: endereço da conta, logo (se houver), argumento e botão na cor de acento |
| `contador` | número que sobe de um valor a outro durante a frase e para no valor final (V-03) |
| `lista-marcavel` | até 4 itens marcados com ✓ na palavra que os nomeia; item em destaque antes de marcar |

Todos os parâmetros estão no catálogo e no objeto `campos` de cada arquivo (cada um exporta `validar`, `construir`,
`exemplo` e `campos`). Cores aceitam os papéis do contrato (`escuro`, `claro`, `acento`, `neutro`), `#RRGGBB` ou `[r,g,b,a]`.

## Papéis de cor e de fonte

| Papel | Uso nos blocos |
|---|---|
| `escuro` | placa, texto sobre superfície clara |
| `claro` | texto sobre a placa, papel da ficha, cartão final |
| `acento` | régua do kicker, destaques, botão, setas |
| `neutro` | apoio |
| fonte `principal` | títulos, textos, botão (pesos pedidos viram o estilo mais próximo que a fonte tem) |
| fonte `mono` | kickers e rótulos pequenos em caixa alta |

Estimativas de largura (quebra e encolhimento de texto) foram calibradas numa grotesca larga. Com fonte mais larga ou mais
estreita, ajuste `tipografia.principal.fator-largura` no contrato (maior que 1 para fonte mais larga) e confira o catálogo.

## Tempos

Os blocos grandes (`esquema-divisao`, `mapa-pontos`, `diagrama-caixas`) têm vários instantes amarrados à fala. Informe os que
importam em `opcoes.tempos` (segundos absolutos). O que faltar assume o ritmo de referência, **esticado ou encolhido para a
duração do bloco**; o `montar` devolve os tempos resolvidos em `blocos[i].tempos`.

## Convenções do Tesseract já embutidas (`nucleo.js`)

1. **Dois keyframes no mesmo track repetem o instante 0 e o lote inteiro é recusado.** `kf()` acumula por (camada, propriedade),
   deduplica por instante (o último vence), força `layerTime >= 0` e emite uma ação por track.
2. **Texto centralizado na vertical sai ~0,38 do corpo acima do centro.** `texto()` compensa (valor configurável em
   `tipografia.principal.compensacao-vertical`; `semCompensacao: true` desliga).
3. **Formas ignoram alfa e opacidade fracionária.** `forma()` descarta o alfa e `mistura(cor, a)` pré-mistura à cor escura da placa.
4. **Retângulo criado por ação não aceita sombra.** Nenhum bloco usa sombra em retângulo.
5. **O motion roda depois do `montar-video.js` e não é idempotente.** O `aplicar.js` nomeia as camadas `<id>-papel`, recusa aplicar
   de novo um id que já existe e, com `--refazer`, apaga as camadas e keyframes daquele id antes de reaplicar.
6. Imagens e vídeos só entram pelo documento (`project commit`): o `aplicar.js` importa o asset e grava a camada antes das ações.

### Faixa das placas

As placas ficam na faixa **y 955 a 1305**, acima da legenda (que começa em y 1320). `--faixa y0,y1` move o conjunto (máximo
`970,1320`). **O queixo muda de vídeo para vídeo:** meça em quadro real (ffmpeg + grade) antes de manter 955.

## Mapas

`gerar-mapa.js` gera a grade de pontos de uma região a partir da base pública Natural Earth (`mapas/fonte/`, domínio público):

```
node gerar-mapa.js --regiao europa --paises Italy,Poland,Romania
node gerar-mapa.js --regiao brasil --paises Brazil
node gerar-mapa.js --bbox -10,30,35,60 --regiao minha --paises France
node gerar-mapa.js --listar
```

O bloco `mapa-pontos` lê `mapas/<regiao>.json` e gera o arquivo na hora se faltar um país.

## Limitações conhecidas

- Colunas, caixas e mapa têm x fixo; textos longos encolhem sozinhos (esquema, placa) ou geram aviso, sem quebra automática
  nas caixas do `diagrama-caixas` (use `\n`).
- Mapa: no máximo 3 países; `cancelado` e `nota` só no último.
- Esquema: estrutura fixa (1 barra, 2 partes, 2 destinos, 3 estados).
- Ficha: até 2 campos e 3 linhas de valor; nunca leva logo (é sempre recriação gráfica).
- Cartão final sem sombra; o bloco não esconde a legenda sozinho (o montador usa `ocupaLegenda`).
- Os `sons` são sugestões no formato do `mixar-audio.js`; o mixador não foi alterado.

## Como acrescentar um bloco

1. Crie `meu-bloco.js` exportando `{ tipo, descricao, validar(bloco) → erros[], construir(bloco, ctx), exemplo, campos }`.
2. Em `construir`, use só `ctx.rect/texto/forma/imagem/kf/janelas/escala/sobe/pop/painel/preset/som`, coordenadas na faixa
   padrão (955) e tempos absolutos; devolva `{ janelas: [{id, inicio, fim}] }`.
3. Registre em `index.js` (`MODULOS` e `ALTURA`) e inclua uma variante em `gerar-catalogo.js`.
4. Antes de gravar na Fábrica, rode o validador anti-vazamento.
