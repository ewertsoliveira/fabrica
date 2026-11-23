# Estação: Revisão de Qualidade

**Papel do Núcleo:** `05-ESTRATEGIA/nucleo-de-conteudo/agentes/revisor-de-qualidade.agent.md`
**Papel:** Julga a peça montada no que a conferência automática não mede: se cada imagem conversa com o texto, se a
peça se reconhece na grade, a chamada e as regras de `decisoes.md` da empresa ativa. Aprova ou devolve a quem falhou.
**Entradas:** `saida/conferencia.txt`, `miniaturas-100px.png` e as imagens da pasta de peças, `saida/copy-aprovada.md`
e `saida/pedido.md`.
**Saída:** `saida/revisao.md` com o parecer (APROVAR ou REPROVAR) e, na reprovação, para quem volta.

## Particularidades desta linha

- **Post planejado:** a peça precisa dizer o que o post planejado prometia. Assunto trocado volta ao texto.
- As regras de público, chamada, promessa e linguagem da empresa estão no caminho `decisoes` dela; leia antes de julgar.
