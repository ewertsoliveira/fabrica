# Origem e atribuição

Este projeto nasceu a partir de uma estrutura de orquestração de agentes
construída sobre uma base de código aberto: o **OpenSquad**, criado por
**Renato Asse** (https://github.com/renatoasse/opensquad), licenciado como
MIT ("use como quiser", conforme o README daquele repositório).

A partir dessa base, esta operação desenvolveu um núcleo próprio de
regras, agentes, estrutura de pastas e ferramentas de produção de
conteúdo — a Fábrica de Conteúdo — com vocabulário e arquitetura próprios.

## Licença

A Fábrica tem duas licenças, conforme a origem de cada parte.

### O que a Fábrica criou: PolyForm Shield 1.0.0

Nas versões posteriores à 0.5.0, tudo o que não veio do OpenSquad (núcleo, regras, agentes, estilos, modelos,
ferramentas e textos) está sob a **PolyForm Shield License 1.0.0**, com a permissão adicional abaixo. O texto completo
está em [`LICENSE.md`](./LICENSE.md) e em https://polyformproject.org/licenses/shield/1.0.0.

Required Notice: Copyright (c) 2026 Ewerton Oliveira (Fábrica de Conteúdos)

```
Additional Permission: Using the software to create content for your own
business or for your clients, including as a paid service, is a permitted
purpose and does not, by itself, count as providing a product that competes
with the software or with any product the licensor provides using the
software. This permission does not extend to selling, reselling or charging
for copies of the software or any substantial part of it, alone or bundled
into another product, course, template pack or service.
```

Em linguagem simples:

- **Pode:** usar à vontade, inclusive na sua empresa e para produzir conteúdo para clientes que pagam você; modificar;
  copiar e repassar de graça, desde que este arquivo e a licença sigam junto.
- **Não pode:** vender, revender ou cobrar pela Fábrica ou por partes dela, sozinha ou dentro de outro produto, curso,
  pacote de modelos ou serviço; nem lançar, mesmo de graça, um produto apresentado como substituto da Fábrica.
- Quem descumprir e for avisado por escrito tem 32 dias para corrigir; depois disso, perde a licença.
- Em caso de dúvida, vale o texto em inglês da licença e da permissão adicional.

As versões até a 0.5.0 foram entregues inteiramente sob a licença MIT e continuam assim para quem as recebeu.

### A base do OpenSquad: MIT

As partes vindas do OpenSquad continuam sob a licença MIT, com o aviso abaixo.

```
MIT License

Copyright (c) Renato Asse (base original)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

**Pendência:** o repositório original não publica um arquivo `LICENSE`
próprio — a licença MIT está declarada apenas no texto do README dele. Antes
de tornar este projeto público ou de uso comercial, vale confirmar com
Renato Asse a linha exata de copyright (titular e ano) que ele pretende.

## Ideias de terceiros

As regras V-02 a V-09 (`05-ESTRATEGIA/nucleo-de-conteudo/regras/11-video.md`) e a entrevista de estilo de vídeo foram
inspiradas no repositório **bolo-de-camadas** de Cauhi (https://github.com/pcauhi/bolo-de-camadas, licença MIT):
estrutura em camadas, sincronia na palavra, áreas seguras e tabela de cenas aprovada antes do código. O texto aqui foi
reescrito, sem cópia, e os valores foram conferidos em análise de vídeos de referência.
