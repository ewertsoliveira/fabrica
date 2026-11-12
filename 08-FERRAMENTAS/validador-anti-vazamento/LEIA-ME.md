# Validador anti-vazamento

Confere se algum arquivo da Fábrica carrega identidade de uma empresa. A
Fábrica nunca contém nada específico de empresa alguma (veja o contrato de
fronteira no `CORE.md`); este validador transforma essa regra em verificação.

Não precisa instalar nada além do Node.

## Como rodar

```
node 08-FERRAMENTAS/validador-anti-vazamento/validar.js
```

Para conferir também nomes, marcas e termos de uma empresa, passe a lista
privada dela:

```
node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --termos <caminho-da-lista>
```

Para conferir só um arquivo ou pasta que ainda vai entrar na Fábrica, passe o
caminho dela antes das opções:

```
node 08-FERRAMENTAS/validador-anti-vazamento/validar.js <pasta> --termos <lista>
```

Resultado: `0` = limpo, `1` = achados (corrija antes de gravar), `2` = erro de uso.

## O que ele confere

**Sem lista nenhuma (checagens genéricas):**

| Categoria | O que procura |
|---|---|
| `hex` | cor em hexadecimal de 6 ou 8 dígitos |
| `fonte` | nomes de fontes conhecidas |
| `handle` | endereço de usuário de rede social (o nome precedido de arroba) |
| `url` | endereços de site, com o prefixo de protocolo |
| `email` | endereços de e-mail |
| `telefone` | telefone com DDD ou iniciado em 9 |
| `documento` | CPF e CNPJ |
| `horario` | horário escrito com a letra h entre hora e minuto |
| `dia-da-semana` | nome de dia da semana |

**Com lista privada (`termo-privado`):** qualquer termo da lista, no texto ou
no nome do arquivo. Ignora maiúsculas e acentos. Com `cs:` na frente do termo,
passa a diferenciar maiúsculas (útil para nomes próprios curtos, como um
primeiro nome que também é palavra comum).

## A lista privada nunca mora na Fábrica

A lista de termos proibidos de uma empresa contém justamente o que não pode
estar aqui: nome da marca, fontes, pessoas. Por isso cada empresa guarda a
própria lista no próprio repositório e passa o caminho com `--termos`. Também
dá para usar a variável de ambiente `FABRICA_TERMOS` (vários caminhos separados
por `;` no Windows e `:` no macOS e no Linux).

Formato: um termo por linha; linhas com `//` são comentário.

Sem lista, o validador avisa em destaque que nomes e marcas não foram
verificados. Limpo sem lista só prova que as checagens genéricas passaram.

## Conferência entre empresas

Quando a Fábrica tem mais de uma empresa (cada uma na sua gaveta, em
`empresas/<codigo>/`), este modo confere se o conteúdo de uma delas cita nome,
conta ou termo de outra. É a prova de que a peça da Aurora não saiu falando da
Boreal.

```
node 08-FERRAMENTAS/validador-anti-vazamento/validar.js --empresa <codigo>
```

- **O que confere:** de cada linha de produção, as saídas, a memória, os dados,
  o estado e as investigações; e, da empresa, o laboratório, o cronograma, os
  pedidos, o perfil, as decisões, o estilo de vídeo, os estilos próprios, as
  prévias, o histórico, o estilo e a intenção (só o que existe). Para
  conferir uma peça antes da entrega, passe a pasta dela:
  `validar.js --empresa <codigo> <pasta>`. Para outra raiz de Fábrica (testes,
  cópias), acrescente `--raiz <pasta>`.
- **O que procura:** só os termos das outras empresas: o nome do índice de
  empresas (menos o padrão "Sua empresa"), o nome e a conta da marca, o nome e o
  site do perfil e as linhas do `termos.txt` de cada uma. Empresa que não
  contribui com nenhum termo gera um aviso (o resultado não muda).
  Ignora maiúsculas e acentos. As checagens genéricas (cor, fonte, URL e as
  outras) ficam desligadas, e `isentos.json` não vale aqui: cor e fonte de uma
  empresa não são vazamento para outra, só o nome dela é.
- **Termos compartilhados:** o que as empresas têm em comum de verdade (a
  cidade onde as duas atendem, por exemplo) não é vazamento. Liste esses termos,
  um por linha, em `empresas/<codigo>/termos-compartilhados.txt` da empresa
  conferida; linhas com `//` são comentário. O termo some da conferência, sem
  diferença de maiúscula nem de acento.
- **Cada achado** diz de qual empresa é o termo. Não entregue a peça até tirar.
- **Com uma empresa só** não há o que cruzar: sai `0` e avisa.

Resultado: `0` = nada de outra empresa, `1` = achados (não entregue), `2` = erro
de uso ou empresa desconhecida.

## Exceções

- Arquivos com `.exemplo.` no nome (como o contrato `marca.exemplo.yaml`) podem
  ter cor em hexadecimal e endereço de usuário de rede social, desde que
  sejam valores de mentira. A lista privada continua valendo neles.
- `isentos.json` libera categorias de um arquivo específico, por exemplo
  `"NOTICE.md": ["url"]` para os endereços de atribuição. `"*"` libera tudo, e
  só deve ser usado com motivo escrito aqui.

Isenções registradas, com o motivo:

- `marca.exemplo.yaml` (fonte): é o exemplo fictício do contrato; precisa nomear uma fonte para mostrar o formato.
- `06-MARCA-E-FOTOS/exemplo/fontes/*-OFL.txt` (url, fonte): texto de licença da fonte livre, que exige manter o endereço e o nome do autor.
- `08-FERRAMENTAS/tesseract/projetos/montar-video.js` (url): o `$schema` do documento do Tesseract é um identificador exigido pelo formato.
- `08-FERRAMENTAS/tesseract/blocos-motion/gerar-mapa.js` (url): endereço da base pública de países (Natural Earth, domínio público) de onde o mapa é baixado.
- `08-FERRAMENTAS/tesseract/modelos/` (hex, fonte, url nos estilos, texturas e motor; fonte e url no README e na licença da Inter): cada modelo de edição tem paleta e tipografia próprias e não carrega identidade de empresa; os endereços são o identificador do formato de documento e o espaço de nomes SVG.
- `08-FERRAMENTAS/mockups/` (hex e fonte em `mockups.js` e `previa.html`; hex em `previa.js` e `mockups.test.js`): o cromo de cada mockup imita a interface real da plataforma (cores do aplicativo e fontes do sistema, regra M-03); as cores da empresa vêm do `marca.yaml`. A `previa.html` é gerada e não vai para o git; o teste usa cinza de propósito nos casos que precisam reprovar, e a `previa.js` pinta só a página em volta da prévia.
- `04-LABORATORIO-DE-DESIGN/estilos/` e `08-FERRAMENTAS/carrossel/` (hex e fonte nos `estilo.yaml`; hex no CSS e no post-it da Papelaria; hex e conta na `previa.js` e no `catalogo.html`; url no `molde.js`; hex no teste; hex e fonte no `preview.js`; hex e url no `conferir.test.js`): o `estilo.yaml` traz uma sugestão de cores e fontes só para a prévia do catálogo, como o `marca.exemplo.yaml`; na produção valem as do `marca.yaml`. O hex da Papelaria é a cor do material do objeto (post-it, clipe); o do Retrô (`retro/estilo.css`), o cinza e as três bolinhas da janela de sistema; o do Fanzine (`fanzine/estilo.css`), o vermelho da fita adesiva e da caneta. O nome aprovado do estilo `revista-dominical` leva um dia da semana (no `estilo.yaml` dele e na tabela do `LEIA-ME.md` do catálogo); é nome de estilo, não agenda, por isso a isenção de dia da semana. A ilustração `_demo/ilustracoes/prato-cafe.svg` é desenho nosso de demonstração e leva as cores do próprio desenho. A conta da prévia é a empresa fictícia. A url é o carregador do Google Fonts da prévia. O `catalogo.html` e o `kit.html` são gerados e não vão para o git; o `kit.js` tem o cinza das bordas da página e a conta fictícia da demonstração, como a `previa.js`. O `preview.js` é o simulador de Instagram da prévia: imita a interface da rede (fontes do sistema e cinzas neutros de página); a cor da empresa entra por parâmetro. O `conferir.test.js` usa cinza e um endereço de espaço de nomes SVG nos casos que precisam reprovar.
- `_fabrica/core/boas-praticas/` (`image-design.md`: hex, fonte, url; `researching.md`: url; `social-networks-publishing.md`: url, handle): exemplos ilustrativos dos guias (cores e fontes de demonstração, endereços de fontes fictícias, um endereço de conta de exemplo), sem identidade de empresa.
- `_fabrica/core/prompts/investigacao-*.md` (url, handle): modelos de endereço de plataforma com `{usuario}` e exemplos de `@`, sem identidade de empresa.
- `NOTICE.md` (termo-privado, além de url): o titular da obra derivada é o nome do autor, que consta da lista privada; é atribuição de autoria, não identidade de empresa.
- `README.md` (url): o endereço do repositório-modelo, que a pessoa cola na IA para instalar.
- `INSTALAR.md` e `_fabrica/core/ambiente.js` (url): endereços públicos dos programas gratuitos (Node, Git, Hugging Face) que o roteiro de instalação manda abrir.
- `08-FERRAMENTAS/imagem-ia/gerar.js` (url): endereços dos serviços gratuitos de imagem por IA, que são o funcionamento da ferramenta.
- `LICENSE.md` (url): texto oficial da PolyForm Shield 1.0.0, que traz o endereço da licença e um endereço de exemplo; precisa ficar sem alteração.
- `_fabrica/core/visual.js` (hex, fonte, url, handle): o gerador de prévia traz cores e fontes de demonstração e o endereço do serviço de fontes; nenhum valor é de empresa.
- `_fabrica/modelo.json` (url): endereço do repositório-modelo, de onde a atualização busca as melhorias.
- `08-FERRAMENTAS/marca/marca.test.js` (hex): cores inventadas do caso de teste do leitor de marca, que simula um contrato de empresa sem os campos novos.
- `08-FERRAMENTAS/validador-anti-vazamento/validar.test.js` (hex, fonte, handle): cor, fonte e conta fictícias dos casos que provam que a conferência entre empresas não olha as checagens genéricas, e a cor de mentira do caso que prova que o modo de sempre continua reprovando.
- `_fabrica/paineis/modelos/Abrir Laboratório de Design.bat` (handle): o comando que silencia a janela do atalho do Windows começa com arroba; não é endereço de usuário.
- `_fabrica/paineis/servidor.js` e `_fabrica/paineis/testes/servidor.test.js` (url): o servidor dos painéis só fala com este computador; os endereços são `localhost` com a porta (o que ele imprime e o que o teste confere) e `exemplo.com`, um nome de mentira usado para provar que pedidos vindos de fora são recusados.
- `_fabrica/paineis/testes/servidor.test.js` (hex, fonte): as cores `#RRGGBB` são valores inventados das marcas de mentira (as empresas fictícias do teste), para provar que cada empresa mostra as suas cores e letras; `Fraunces` é a fonte do modelo de exemplo da própria Fábrica.
- `_fabrica/paineis/testes/telas.test.js` (url, hex): o teste do seletor de empresa simula o endereço da tela no próprio computador (`localhost` com a porta) e usa duas cores `#RRGGBB` inventadas de uma marca de mentira, para provar que a tela pinta as cores da empresa escolhida.
- `_fabrica/paineis/testes/caminho.test.js` (url, hex): o teste de ponta a ponta abre as telas no navegador pelo servidor dos painéis neste computador (`127.0.0.1` com a porta), e a pasta antiga de mentira leva quatro cores `#RRGGBB` inventadas de uma marca fictícia, para provar que ela fica igual byte a byte depois de abrir o painel.
- `_fabrica/paineis/testes/enviar-cliente.test.js` (hex): as cores `#RRGGBB` são valores inventados das marcas de mentira `aurora` e `boreal`, para provar que o arquivo do cliente leva as cores da própria empresa e nenhuma cor da outra.
- `_fabrica/paineis/testes/biblioteca.test.js` (hex): as cores `#RRGGBB` são valores inventados de três estilos de mentira e da empresa fictícia `aurora`, para provar que o catálogo da biblioteca entrega as cores de cada estilo sem inventar nada.
- `08-FERRAMENTAS/tesseract/modelos/tema-marca.test.js` e `inverso.test.js` (hex, fonte): as cores `#RRGGBB` são valores inventados das marcas de mentira `aurora` e `boreal` (e de paletas ruins de propósito, com claro e escuro quase iguais), e as letras são as OFL da própria pasta `modelos/fontes/`, para provar que o vídeo leva as cores e letras da empresa, que sem marca nada muda e que o texto continua legível.
- `08-FERRAMENTAS/tesseract/modelos/lote-a.test.js` (hex, fonte): o mesmo motivo, para o primeiro lote dos modelos antigos (Vitrine, Recorte, Neon, Cinema, Impacto, Caderno e Visor): cores `#RRGGBB` inventadas das marcas de mentira `aurora` e `boreal` (e de paletas ruins de propósito) e letras OFL da própria pasta `modelos/fontes/`.
- `08-FERRAMENTAS/tesseract/modelos/lote-b.test.js` (hex, fonte): o mesmo motivo, para o segundo lote dos modelos antigos (Bloco, Adesivo, Círculo, Retrô, Faixa e Palco): cores `#RRGGBB` inventadas das marcas de mentira `aurora` e `boreal` (e de paletas ruins de propósito) e letras OFL da própria pasta `modelos/fontes/`.
- `08-FERRAMENTAS/tesseract/modelos/fontes/*-OFL.txt` de Bebas Neue, Caveat, Courier Prime, Great Vibes, Instrument Serif, Kaushan Script, Oswald e Space Mono (url, fonte; a da Kaushan Script também e-mail): texto da licença da fonte livre, com o aviso de direitos autorais tirado do próprio arquivo da letra, que a licença exige manter (endereço do projeto e, na Kaushan Script, o contato do autor).
- `08-FERRAMENTAS/tesseract/modelos/fontes/familias.json` (fonte): a lista das letras livres da pasta, por família, para a marca que nasce de um estilo e a lista de letras do painel; os nomes de família são os das letras OFL do modelo, não de empresa.
- `08-FERRAMENTAS/marca/escrever.test.js` (hex, fonte): as cores `#RRGGBB` são valores inventados das marcas de mentira `aurora` e `boreal` e de estilos de mentira, e as letras são as OFL da pasta `modelos/fontes/`, para provar que a marca gravada leva as cores e letras pedidas e que a marca que nasce de um estilo copia as letras dele com a licença.
- `08-FERRAMENTAS/tesseract/modelos/todos-na-marca.test.js` (hex, fonte): o mesmo motivo, para os 27 modelos de uma vez: cores `#RRGGBB` inventadas das marcas de mentira `aurora` e `boreal` e letras OFL da própria pasta `modelos/fontes/`, para provar que nenhum modelo falha com a marca, que sem marca nada muda e que o log de contraste só traz os casos conhecidos.

## Quando rodar

- Antes de gravar qualquer arquivo novo na Fábrica, e antes de cada commit.
- Antes de cada gravação do Scout de Tendências.
- Sempre que uma empresa nova entrar: crie a lista privada dela primeiro.

## O que ele não pega

Ele acha o que está escrito, não o que está implícito. Uma frase que só faz
sentido para um nicho, ou um nome que ninguém colocou na lista, passa. A
lista privada precisa ser mantida: quando surgir uma cor, fonte, pessoa ou
setor novo na empresa, acrescente. O teste de fogo do MANIFESTO (uma empresa
fictícia com identidade oposta) continua sendo a prova final.
