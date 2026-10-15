# 0003. Identificadores em inglês; comentários e docs em português

- Situação: aceita (outubro de 2026)

## Contexto

O código nasceu todo em português (`make_glosses.py`, `anotacoes.js`, coleções `marcacoes`, `notas`). As palavras-chave e bibliotecas são em inglês, o que gera mistura (`getUsuarioAtivo`), e dificulta usar exemplos, ferramentas e ajuda externos.

## Decisão

- Identificadores — variáveis, funções, classes, arquivos de código, coleções e campos dos dados guardados — em **inglês**.
- Termos sem boa tradução continuam (BLIVRE, Strong, ketiv, qere, códigos de livro como `GEN`).
- Comentários, docstrings, documentação e textos do app em **português**; commits em português com prefixo do Conventional Commits.
- Endereços públicos que as pessoas já usam continuam (`ler.html`, `index.html#como-usar`).

## Como migrar

Por etapas, cada uma com os testes passando antes e depois e sem mudança de comportamento:

1. Ferramentas de qualidade (ADR 0004). **Feita.**
2. Scripts Python, banco SQLite do build, pastas (`dados/` → `data/`, `saida/` → `build/`, `fontes-dados/` → `sources/`) e cabeçalhos dos TSV editados à mão. **Feita**: o site, as revisões e o banco saem idênticos byte a byte (conferido antes e depois).
3. JavaScript do site e do app. Os dados já guardados (IndexedDB, `localStorage` e os arquivos no Drive) passam por **migração** na abertura do app, e o leitor dos lotes do Drive continua aceitando o formato antigo (expand/contract), para ninguém perder anotações.
4. Plugins Android e documentação.

## Consequências

- Uma refatoração grande, mas mecânica e coberta pelos testes (dados, retrato das glosas, 120+ testes no navegador).
- Durante a migração convivem nomes antigos e novos; cada etapa atualiza o README e `docs/`.
