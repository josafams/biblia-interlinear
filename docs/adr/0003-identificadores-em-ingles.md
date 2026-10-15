# 0003. Identificadores em inglês; comentários e docs em português

- Situação: aceita (outubro de 2026)

## Contexto

O código nasceu todo em português (`make_glosses.py`, `anotacoes.js`, coleções `marcacoes`, `notas`). As palavras-chave e bibliotecas são em inglês, o que gera mistura (`getUsuarioAtivo`), e dificulta usar exemplos, ferramentas e ajuda externos.

## Decisão

- Identificadores — variáveis, funções, classes, arquivos de código e as chaves dos JSON gerados no build — em **inglês**. Os campos dos dados que a pessoa guarda (anotações, progresso, arquivos no Drive) ficam como estão: ver ADR 0005.
- Termos sem boa tradução continuam (BLIVRE, Strong, ketiv, qere, códigos de livro como `GEN`).
- Comentários, docstrings, documentação e textos do app em **português**; commits em português com prefixo do Conventional Commits.
- Endereços públicos que as pessoas já usam continuam (`ler.html`, `index.html#como-usar`).

## Como migrar

Por etapas, cada uma com os testes passando antes e depois e sem mudança de comportamento:

1. Ferramentas de qualidade (ADR 0004). **Feita.**
2. Scripts Python, banco SQLite do build, pastas (`dados/` → `data/`, `saida/` → `build/`, `fontes-dados/` → `sources/`) e cabeçalhos dos TSV editados à mão. **Feita**: o site, as revisões e o banco saem idênticos byte a byte (conferido antes e depois).
3. JavaScript do site e do app: nomes internos, APIs globais (`window.Annotations`, `Account`, `Progress`, `Sync`) e as chaves do JSON exportado (`books.json`: `code`, `name`, `abbrev`, `group`, `chapters`). **Feita.** O formato dos dados guardados não muda (ADR 0005).
4. Arquivos do site (`annotations.js`, `account.js`, `sync.js`, `progress.js`, `home.html`, `reader.html`), ids e classes do HTML, eventos (`chapter-rendered`, `annotations:goto`), códigos de erro e estados da conta, plugins Android (`Print`, `GoogleAccount`). **Feita.** Ficam em português os endereços públicos (`ler.html`, `#como-usar`, `#baixar`, a pasta `dados/` do site), as classes de uma palavra só e os dados guardados (ADR 0005).

## Consequências

- Uma refatoração grande, mas mecânica e coberta pelos testes (dados, retrato das glosas, 120+ testes no navegador).
- Durante a migração convivem nomes antigos e novos; cada etapa atualiza o README e `docs/`.
