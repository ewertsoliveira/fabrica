---
tipo: checkpoint
saida: saida/entrada.md
---

# Passo 1: Entrada do vídeo

Primeiro passo de cada Reels. Nenhum trabalho começa antes de este checkpoint estar respondido e salvo, **inclusive a
camada de produção e o modelo de edição**. As respostas orientam o script de preparo (passo 2), o plano editorial
(passo 3) e o quanto de trabalho sob medida entra no vídeo.

Todas as perguntas vão por pergunta estruturada (nunca em texto solto), no máximo 4 por chamada, de 2 a 4 opções cada.

## Pré-voo (antes de qualquer pergunta)

Nada de vídeo começa com programa faltando ou velho, e nenhum login ou cadastro pode ficar para o meio do trabalho.

1. Rodar `node _fabrica/core/ambiente.js` e `node _fabrica/core/ferramentas.js --verificar`.
2. Se algo do grupo "Para Reels (vídeo)" faltar, ou o `--verificar` disser **PRECISA**, rodar
   `node _fabrica/core/ferramentas.js` (instala e atualiza ffmpeg, Tesseract, whisper e modelos para a versão mais nova;
   nenhum desses downloads pede login) **antes** de seguir. Dizer o que vai baixar e pedir o "sim".
3. Se o Tesseract mudou de versão, registrar no relatório e conferir os quadros de teste antes de confiar nos modelos.
4. Só depois da conferência passar (todos "OK") seguir para a chamada 0. Se não passar, **parar e dizer o que falta**;
   nunca abrir a entrevista de estilo nem pedir o vídeo com o ambiente incompleto.
5. Contas: se for preciso entrar ou criar conta em qualquer serviço, é agora, antes da chamada 0, e a pessoa entra
   sozinha no navegador (nunca pedir senha ou chave na conversa).

## Contexto para o responsável

**Caminhos da empresa do run:** use os caminhos que o runner passou; se faltarem,
`node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json` mostra onde ficam os arquivos da empresa
nesta linha: `saidas` (a pasta dos `saida/...`), `memoria` (`runs.md`, `memories.md`) e `dadosLinha`
(`preferencias-aprovadas.md`, `biblioteca-de-modelos.md`). Os demais `dados/` (`briefing.md`, `camadas-de-producao.md`,
`entrevista-de-estilo.md`) são do modelo e ficam na linha.

Mostrar em uma linha os modelos aprovados hoje (lidos de `biblioteca-de-modelos.md`, na pasta `dadosLinha` da empresa
ativa) e o último Reels feito (`runs.md`, na pasta `memoria` da empresa ativa).

## Chamada 0: estilo de vídeo (uma vez por empresa)

Antes da chamada 1, conferir se existe o `estilo-de-video.md` da empresa do run (caminho `estiloDeVideo` dos caminhos
que o runner passou; se faltarem, `node _fabrica/core/empresa.js caminhos <codigo do run> --linha reels --json`).

- **Existe:** mostrar o resumo em uma linha (formato do rosto padrão, tom e aviso fixo) e seguir. Não perguntar de novo.
- **Não existe:** rodar a entrevista de `dados/entrevista-de-estilo.md` agora, **antes** de qualquer pergunta sobre o
  vídeo. O responsável não conhece termos de vídeo: cada pergunta vai com prévia e recomendação (V-09, D-01). O arquivo
  só é gravado depois da escolha e do OK nos quadros de teste.

## Chamada 1: o vídeo

1. **Qual é o arquivo do vídeo?** Caminho completo ou nome do arquivo na pasta de vídeos crus da empresa. Opções: os 2
   ou 3 vídeos mais recentes da pasta (por data de modificação) e "Outro caminho".
2. **Em que estado ele está?**
   - **Cru**, direto da câmera: o script corta as pausas, acelera a fala, ajusta a cor e aplica a transição nas viradas.
   - **Já pré-editado**: pausas cortadas e velocidade ajustada. A linha só aplica o modelo.
3. **Sobre o que é o vídeo e quem fala?** Uma frase.
4. **Alguma observação?** Opcional (transição desejada, chamada final, poses para a capa no começo).

## Chamada 2: camada de produção e modelo (obrigatórias)

Feita depois da chamada 1, para poder recomendar com base no vídeo. Ler `dados/camadas-de-producao.md` e
a `biblioteca-de-modelos.md` da empresa ativa (caminho `dadosLinha`).

5. **Qual camada de produção?** Mostrar a recomendação e o motivo em uma linha, mas listar as três (Expresso, Padrão,
   Vitrine, definidas em `dados/camadas-de-producao.md`).
6. **Qual modelo de edição?** Uma opção por modelo **aprovado** da biblioteca. A opção recomendada vem primeiro.
   Modelos em teste não são aprovados: só entram se o responsável escrever o nome em "Outro".
   **Empresa com estilo escolhido:** rode `node _fabrica/core/estilo-da-linha.js <codigo do run>` (só lê). Se ele mostrar
   um modelo de Reels, a primeira opção, recomendada, é "O modelo do seu estilo (<nome do estilo>)": o modelo de edição
   desse estilo (`formatos.reels.modelo`; num estilo próprio, o do estilo em que ele se baseia), já com as cores e as
   letras da marca da empresa. Sem estilo escolhido, ou sem modelo de Reels no estilo, as opções de sempre.
   Quando a pessoa trocar o estilo neste pedido, ou não usar nenhum, isso vale também para o registro da peça no
   Laboratório: o JSON da peça leva o estilo usado, ou `"estilo": null` (passo 6, item 7).

## Formato da resposta a salvar

```
# Entrada do vídeo

**Arquivo:** {caminho}
**Estado:** {cru | pré-editado}
**Assunto e apresentador:** {frase}
**Observações:** {texto livre ou "nenhuma"}
**Estilo de vídeo:** {estilo-de-video.md da empresa ativa, aprovado em AAAA-MM-DD}
**Camada de produção:** {Expresso | Padrão | Vitrine}
**Modelo de edição:** {nome}
**Modelo do estilo da empresa:** {código do modelo, com "usarMarca: true" | "não"}
**Data:** {AAAA-MM-DD}
```

## Regras

- **Sem `estilo-de-video.md` aprovado, a linha não planeja.** A entrevista (chamada 0) é feita uma vez e vale para os
  vídeos seguintes.
- **Sem as duas respostas (camada e modelo) gravadas em `entrada.md`, a linha não edita nada.** Se o responsável pular,
  perguntar de novo; nunca assumir um valor padrão.
- Se o arquivo não existir no caminho informado, pedir de novo; não seguir.
- Vídeo com mais de 90 segundos: avisar que o limite do Reels é 90 s e perguntar se quer cortar conteúdo.
- Se o estado não for informado, olhar o arquivo: áudio com pausas longas e velocidade natural indica vídeo cru.
- O modelo escolhido define a flag `--mascara` do passo 2: modelo com título ou elemento atrás do corpo precisa da
  máscara do vídeo inteiro.
