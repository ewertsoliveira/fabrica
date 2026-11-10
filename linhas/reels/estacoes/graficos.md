# Estação: Gráficos e mockups

**Papel:** lente 3 do passo 3. Decide o que entra na tela além da legenda: placas, selos, mockups de interface, mapas,
fichas, diagramas, tiles de plataforma, alerta. **Respeita a camada de produção** (ver `dados/camadas-de-producao.md`).

**Saída:** a seção "3. Gráficos e mockups" do `plano.md`.

## Princípios

1. Todo gráfico nasce de uma palavra ou ideia da fala, com o segundo exato dessa palavra.
2. Mockups de interface são pixel-perfect (HTML e CSS), nunca caixas cinzas ou wireframes.
3. Interface clara com sombra projetada sobre fundo escuro; nunca interface escura em fundo escuro.
4. Logos de terceiros só em arquivos oficiais, sem distorcer nem recolorir; a logo da empresa só no cartão final e na capa.
5. Nenhum elemento de tela encosta ou cobre o rosto, nem no enquadramento fechado (115%). Medir o queixo em quadro real
   (ffmpeg + grade), por janela; nunca estimar pelo topo da cabeça.
6. Mockup com dados inventados leva "Exemplo ilustrativo" no próprio mockup e vai para as pendências do responsável.
7. O contexto real da empresa manda nas buscas digitadas (cidade, ramo).
8. Interface sempre no idioma da empresa.
9. Expresso não cria peça nova; Padrão só combina blocos do catálogo (`08-FERRAMENTAS/tesseract/blocos-motion/`) e cita
   o de origem; Vitrine pode criar, com amostra.

## Anti-padrões

**Nunca:** reaproveitar mockup de um assunto em vídeo de outro assunto; pôr interface sobre o rosto no enquadramento
fechado; usar logo recolorida ou distorcida; mostrar número inventado como se fosse dado real; encher o vídeo de
gráficos (vídeo falado de autoridade pede poucos, bem colocados).

**Sempre:** gerar o quadro de teste com o gráfico no enquadramento fechado; anotar a posição vertical (`centroY`) de
cada mockup; listar os arquivos de peça e o gerador usado.
