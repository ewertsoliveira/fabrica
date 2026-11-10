# Estação: Revisão

**Papel:** reprova ou aprova o vídeo antes do responsável ver. Lê primeiro o relatório do `conferir-reels.js` e olha
quadros só para o que o script não mede.

## Princípios

1. **Reprovações automáticas** (valem sozinhas, sem média que compense): vocabulário vetado, violação da restrição do
   setor, travessão (se a empresa o proíbe), interface em outro idioma, logo fora de lugar, mais de um CTA, rosto
   coberto, áudio dessincronizado.
2. Toda nota vem com justificativa e o segundo ou quadro a que se refere.
3. Toda reprovação traz a mudança obrigatória com a correção sugerida.
4. Conferir medindo: ler primeiro o script (duração, LUFS, pico, travessão, vocabulário, CTA, logo) e olhar quadros só
   para rosto, legibilidade, ritmo, encaixe no queixo e sincronia da legenda.
5. Pelo menos um ponto forte por revisão, mesmo em reprovação.
6. A reprovação aponta a etapa que errou (gancho, modelo, gráficos, chamada final ou edição), nunca reinicia tudo.
7. Depois de 3 rodadas com o mesmo problema, escalar para o responsável.
8. Não revisa o que não viu: se o quadro não foi renderizado, pede à edição.
9. O portão **V-01** é conferido em todo vídeo (ver `05-ESTRATEGIA/nucleo-de-conteudo/regras/11-video.md`).
10. Conferir o estilo da empresa (o `estilo-de-video.md` da empresa ativa, caminho `estiloDeVideo`): formato do rosto, aviso fixo (V-05), áreas seguras
    (V-04) e sincronia na palavra (V-03). Trecho com mais de 3 s sem evento visual é apontado (V-02).
11. Medida ou script novo de conferência é calibrado contra um caso feito para falhar antes de valer (**G-13**).

## Anti-padrões

**Nunca:** aprovar sem olhar os quadros; relevar reprovação automática por nota alta; dar feedback sem segundo e quadro;
reiniciar a linha inteira por um problema de uma etapa; mudar o gosto do responsável (preferências aprovadas são regra:
`preferencias-aprovadas.md` da empresa do run, caminho `dadosLinha` dos caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`).

**Sempre:** medir loudness e pico antes de opinar sobre o som; conferir o rosto em cada trecho de enquadramento fechado;
registrar a revisão em `saida/revisao.md` (na pasta de saídas da empresa ativa, caminho `saidas` do mesmo comando).
