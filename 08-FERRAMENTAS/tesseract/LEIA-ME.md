# Edição de vídeo com o Tesseract

Scripts que levam um vídeo falado (cru ou já editado) a um Reels pronto, tudo local.
Nada aqui carrega identidade de empresa: cores, fontes, endereço da conta e vocabulário
vêm do contrato de marca da empresa ativa (o `marca.yaml`, caminho `marca` em
`node _fabrica/core/empresa.js caminhos`; leitor em `08-FERRAMENTAS/marca/`).
Sem `marca.yaml`, os scripts usam `marca.exemplo.yaml` (empresa fictícia) e avisam em destaque.

## Pré-requisitos

| Ferramenta | Para quê |
|---|---|
| Tesseract CLI 0.3.1 (`tsrct`) | montar, pré-visualizar e exportar |
| whisper.cpp + modelo `large-v3-turbo-q5_0` | transcrição com tempo por palavra |
| ffmpeg e ffprobe | áudio, quadros, conferência |
| Node 20+ | scripts |
| `onnxruntime-node` e o modelo RVM (`rvm_mobilenetv3_fp32.onnx`) | máscara da pessoa (só se o vídeo usar texto atrás do corpo) |

Os caminhos esperados (whisper em `08-FERRAMENTAS/whisper-cpp/`, RVM em `08-FERRAMENTAS/rvm/`, `tsrct` em
`%LOCALAPPDATA%\Tesseract\bin`) estão no topo de `preparar-material.js`. Binários e modelos ficam fora do git.

## Peças desta pasta

| Arquivo | Papel |
|---|---|
| `preparar-material.js` | Estação de preparo, sem agente: silêncios, transcrição, cortes decididos, pré-edição, conferências, quadros de capa e relatório `material.md`. **Se houver ambiguidade, para e pergunta** (código de saída 3); nunca adivinha. |
| `exportar-em-pedacos.js` | Exporta em 3 ou 4 pedaços paralelos e junta sem emenda visível (medido: ~4x mais rápido que o export inteiro). O limite é memória, não CPU. |
| `conferir-reels.js` | Conferência por script do vídeo pronto: duração, áudio, loudness, pico, travessão, vocabulário vetado, CTA único (com o pedido de um modelo de edição no lugar da decupagem, a falta do cartão de chamada é só aviso), logo e conta só no cartão final, faixa do perfil. `--autoteste` calibra contra um caso feito para falhar. |
| `projetos/palavras.js` | Transcrição do whisper em lista de palavras com tempo; aplica as correções de grafia do contrato de marca. |
| `projetos/pre-edicao.js` | Corta pausas, corrige a cor, põe transição nas viradas de assunto e acelera a fala sem mudar o tom. |

## Fluxo

```
node preparar-material.js "<video>" --estado cru|pre-editado [--mascara] [--reels NN]
   -> projetos/<NN>/material.md  (para e pergunta se houver ambiguidade: rode de novo com --decisao chave=valor)
decupagem (plano de edição aprovado)  ->  montagem do projeto Tesseract
node exportar-em-pedacos.js --decupagem projetos/<NN>/decupagem.json --pedacos auto
node conferir-reels.js <video.mp4> <decupagem.json>
```

## Regras que valem sempre

- **Nunca adivinhar em silêncio.** Instrução falada no início, poses, tomada repetida e vídeo sem fala viram pergunta.
- **Uma única re-transcrição por vídeo**, só para termo técnico, data ou nome próprio. Palavra duvidosa vira clipe de 2 s para o responsável ouvir.
- **Conferência visual antes de entregar.** O script mede o que é medível; rosto coberto, legibilidade e ritmo exigem olhar quadro.
- **Pré-edição:** o áudio de vídeo gravado em celular pode começar depois do vídeo (`start_time`); sem `aresample=async=1:first_pts=0` os cortes desalinham o áudio. O script já trata isso, e a transcrição deve rodar sobre o vídeo editado, não sobre o bruto.
- **Memória no export:** feche navegador e qualquer `tsrct`/`ffmpeg` antes; cada pedaço usa ~1,1 a 1,4 GB. Nunca rode dois exports ao mesmo tempo.

## Armadilhas do Tesseract 0.3.1

- Vídeo sem áudio no export: a camada de vídeo precisa de `volume: 1`.
- Camadas de imagem e de vídeo só entram pelo documento (`project commit`); ações servem para efeitos, presets e keyframes.
- Dois keyframes no mesmo instante da mesma propriedade derrubam o lote inteiro: deduplicar antes.
- O Tesseract renderiza texto cerca de 15% mais largo que o navegador; meça no render real antes de dimensionar caixa.
- Texto em fonte variável centralizado na vertical sai ~0,38 do corpo acima do centro; compense.
- Formas ignoram alfa fraco e opacidade fracionária; pré-misture a cor com o fundo.
- Retângulo criado por ação não aceita sombra; o que precisa de sombra entra como imagem.
- `animatorSetCornerRadius` só vale para mídia; em retângulo use `roundness`.
- A versão 0.3.1 exige `playback` (janela "windowed") nas camadas de vídeo e áudio, no lugar de `activeRange`.
- O recorte automático de pessoa da CLI pública devolve máscara vazia; por isso a máscara vem do RVM, como camada track matte em luma.
- Projeto `.tsrct` embute o vídeo inteiro: fica fora do git.
