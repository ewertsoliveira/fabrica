# Linha de Produção: Reels falado

Do vídeo falado ao Reels pronto, no modelo da empresa. Definição em `linha.yaml`; ferramentas em
`08-FERRAMENTAS/tesseract/`.

## Os oito passos

| # | Passo | Quem | Saída |
|---|---|---|---|
| 1 | Entrada do vídeo (estilo, camada e modelo) | checkpoint | `entrada.md` |
| 2 | Preparar material | script (`preparar-material.js`), sem estação; para e pergunta se houver ambiguidade | `material.md` |
| 3 | Plano de edição | estação **gancho** + 3 lentes (modelo, gráficos, chamada final) | `plano.md` |
| 4 | Montar estrutura e prancha | estação **edição** | `estrutura.md` |
| 5 | Aprovar plano e estrutura | checkpoint | `plano-aprovado.md` |
| 6 | Exportar em pedaços, mixar, conferir | estação **edição** (a mesma do passo 4) | `entrega.md` |
| 7 | Revisão | estação **revisão** (lê o script primeiro) | `revisao.md` |
| 8 | Aprovação final | checkpoint | `aprovacao-final.md` |

Os checkpoints são 1, 5 e 8: o responsável decide na entrada, olha uma prancha antes de exportar e aprova o vídeo final.

## Camadas de produção

Expresso (blocos prontos), Padrão (+ blocos de motion do catálogo) e Vitrine (peças novas sob medida). Perguntada
sempre no passo 1. Detalhes em `dados/camadas-de-producao.md`.

## O que a linha precisa da empresa

- O `marca.yaml` da sua empresa (cores, fontes, conta, vocabulário vetado, chamada padrão). Sem ele, os scripts usam a
  marca de exemplo e avisam.
- O `estilo-de-video.md` da sua empresa, criado na primeira entrada: pela edição rápida com o visual da marca
  (recomendada) ou, se a pessoa pedir "Personalizar", pela entrevista de `dados/entrevista-de-estilo.md`
  (uma vez por empresa, com prévias). O responsável nunca precisa conhecer termos de vídeo.
- A biblioteca de modelos e as preferências aprovadas da sua empresa (`biblioteca-de-modelos.md` e
  `preferencias-aprovadas.md`), que crescem a cada vídeo aprovado.
- O histórico da sua empresa nesta linha (`runs.md` e `memories.md`, criados no primeiro uso) para variar entre vídeos.

## O que não está nesta linha ainda

- **Capa do vídeo** (antigo passo de capa, em paralelo com o export): depende do Laboratório de Design (gerador de capas,
  recorte de foto, descontaminação de cor de borda), que ainda não foi exportado. Entra como passo próprio quando o
  Laboratório entrar na Fábrica.
- **Painel do editor** (tela de escolha de modelo e do navegador do Tesseract): item à parte.
- **Motor** (`/fabrica`, `/fabricar`): o runner que executa esta definição ainda não existe na Fábrica. Até lá, os
  arquivos descrevem o procedimento e os scripts rodam à mão.
