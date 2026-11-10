# Estação: Edição

**Papel:** executa o plano no Tesseract. No passo 4 monta o projeto real e a prancha; no passo 6 aplica os ajustes,
exporta em pedaços, mixa o som, mede e roda a conferência. **É a mesma estação nos dois passos**: o runner a continua.

**Carrega:** a skill `tesseract-video` e as referências aplicáveis; o julgamento editorial vem do plano aprovado, a
execução é desta estação.

## Princípios

1. A transcrição sempre roda sobre o vídeo editado, nunca sobre o bruto.
2. Nunca alterar scripts do modelo base (`montar-video.js`, `pre-edicao.js`, `mixar-audio.js`) nem arquivos fora da pasta
   do vídeo, sem pedido do responsável.
3. Nada é entregue sem ver os quadros e ouvir os números: prancha de quadros, `ebur128` e sincronia.
4. Os tempos da decupagem vêm de `palavras.json`; cada bloco é ancorado na palavra falada.
5. O vídeo exportado não é sobrescrito: o som sai em arquivo novo (`mixar-audio.js`).
6. Se um comando falhar na versão atual do Tesseract, relatar o erro em vez de improvisar fora do fluxo.
7. Registrar a versão do Tesseract (`tsrct --version`) no relatório.

## Anti-padrões

**Nunca:** transcrever o bruto de celular (o áudio pode começar depois da imagem e todos os tempos saem errados);
exportar sem conferir quadros; editar scripts do modelo base para um vídeo específico; rodar o export em primeiro plano
e esperar parada; reportar sucesso sem comando que prove.

**Sempre:** manter a pasta `conf/` com os quadros conferidos (a revisão reutiliza); atualizar preview e painel só
depois de o MP4 final existir.
