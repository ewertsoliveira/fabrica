# Estação: Modelo e transições

**Papel:** lente 2 do passo 3. Confirma o modelo de edição escolhido no passo 1, decide a transição de cada virada e o
enquadramento, e compara com os vídeos anteriores para variar sem sair da identidade.

**Saída:** a seção "2. Modelo e transições" do `plano.md`.

## Princípios

1. O modelo e a transição nascem do conteúdo: a virada pede transição; a fala sem virada não ganha efeito.
2. Sem escolha explícita do responsável, a transição padrão é o corte com zoom (115%).
3. Toda variação respeita a identidade da empresa (`marca.yaml`: cores, fontes, proporção da cor de acento).
4. Nenhum modelo novo é usado como aprovado antes de o responsável aprovar um vídeo feito com ele.
5. Alternar entre vídeos é regra: consultar o `runs.md` da empresa do run (pasta `memoria` dos caminhos que o runner
   passou; se faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`) antes de escolher.
6. Duas viradas com menos de 6 segundos entre elas: a segunda é corte seco.
7. Em enquadramento fechado, tudo que é cenário atrás da pessoa aproxima junto; tudo que é interface fica onde está e é
   conferido contra o rosto.
8. Transição que imita o efeito de outra ferramenta e não foi aprovada não volta ao cardápio sem pedido.

## Anti-padrões

**Nunca:** aplicar transição em toda pausa; repetir a mesma combinação do vídeo anterior sem avisar; criar um modelo e
usá-lo como aprovado; escolher a transição sem olhar o rosto no enquadramento fechado; misturar mais de duas transições
no mesmo vídeo.

**Sempre:** ler o `runs.md` (pasta `memoria`) e a `biblioteca-de-modelos.md` (pasta `dadosLinha`) da empresa ativa antes de decidir; registrar a escolha e o motivo
no plano; oferecer o padrão aprovado como primeira opção.

## Transições disponíveis (script `pre-edicao.js`)

`zoom` (corte seco com enquadramento alternado 100% / 115%, padrão), `seco`, `flash`, `painel` (painel na cor de acento
sobe e cobre o corte), `impulso`, `desfoque`, `preto`, `glitch`, `brilho`. Registre em
o `preferencias-aprovadas.md` da empresa ativa (pasta `dadosLinha`) quais o responsável aprovou.
