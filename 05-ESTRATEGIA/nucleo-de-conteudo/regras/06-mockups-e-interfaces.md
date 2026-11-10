# 06 — Mockups e Interfaces

Aplica-se sempre que uma peça mostra uma tela: rede social, navegador, painel, aplicativo, conversa, planilha. A
biblioteca de componentes fica em `08-FERRAMENTAS/mockups/`.

---

## M-01 — Mockup nativo em HTML e CSS
Demonstração de plataforma é **mockup nativo de alta fidelidade em HTML e CSS**, construído na peça. Nunca captura de
tela recortada de baixa qualidade, nunca ilustração simbólica.

## M-02 — Veto de wireframe
Estão vetados a representação "simbólica", o wireframe preguiçoso e a caixa cinza chapada simulando post ou tela. O
leitor precisa ter a sensação nítida de que há a tela do aplicativo real rodando dentro daquele slide.

## M-03 — Fidelidade de interface
A interface é real. Isso significa reproduzir:
- o modo (claro ou escuro) exato da plataforma imitada;
- o gradiente do aro de stories ao redor da foto de perfil;
- os ícones de engajamento nativos, na proporção e no peso corretos;
- os controles de janela do sistema operacional em simulador de navegador;
- a tipografia, o espaçamento e a hierarquia da interface original.

O design da interface é parte vital da entrega, não um detalhe de fundo.

## M-04 — Escala de interface, não escala de conteúdo
Texto dentro de mockup segue o piso de **interface** (`canvas.pisos-ui`), não o de conteúdo (DG-01). A interface é
superdimensionada em relação a uma tela real, porque a peça é lida no celular, mas continua visivelmente menor que o
corpo da peça; senão deixa de parecer uma tela.

Hierarquia típica dentro de um mockup: valor de destaque, título do cartão, descrição, rótulo ou estado.

## M-05 — Mockup é ferramenta padrão, não exceção
Mockup e imagem de fundo são **recursos centrais** de post e carrossel. Ao gerar opções de arte para aprovação, incluir
versões com mockup entre as alternativas. Proibida é a versão preguiçosa (M-02), nunca o mockup em si.

## M-06 — Interface clara sobre fundo escuro
Sobre fundo escuro, o mockup flutuante usa interface **clara** e leva sombra projetada forte. Nunca mockup escuro sobre
fundo escuro: ele desaparece na composição.

## M-07 — Interface no idioma do público
Todo texto do mockup (menus, botões, datas, meses, rótulos) está no idioma do público da marca (`empresa.idioma`).
Nenhum termo de interface vaza para outro idioma.

## M-08 — Marcadores numerados quando o slide ensina passos
Quando o slide explica partes de uma tela, o mockup leva **marcadores numerados** (1, 2, 3) sobre as áreas citadas, e
o texto do slide usa os mesmos números.

---

## Como se confere

| Regra | Quem confere |
|---|---|
| M-02 (caixa vazia ou cinza no lugar do mockup), M-04 (texto do mockup abaixo do piso de interface ou acima do corpo) | Conferidor automático do carrossel |
| M-06 (contraste entre mockup e fundo), M-07 (termos de interface fora do idioma) | Conferidor automático, por cor de fundo do componente e por lista de termos |
| M-01, M-03, M-05, M-08 | Revisor de qualidade |
