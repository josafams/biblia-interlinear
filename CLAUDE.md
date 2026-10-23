# Bíblia Interlinear: convenções do projeto

Leia [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) antes de mudar algo: ele diz onde fica cada coisa.

## Código

- **Código em inglês** (nomes, arquivos, comentários, commits); **textos de tela só no locale**
  `src/i18n/locales/pt-BR.json`, usados com `t("area.chave", params)`. `npm run check:i18n` acusa texto solto
  (uma string técnica que só parece texto leva `// i18n-ignore` no fim da linha).
- **Ficam em português** os dados e os nomes já gravados nos aparelhos e no Drive: chaves `interlinear:*`,
  coleções e campos do Dexie, ids e classes que testes e vídeos usam (lista em `docs/ARCHITECTURE.md`).
- **Componentes Svelte 5** (runes), um por arquivo em `src/components/`, de preferência até ~150 linhas.
  Estado só em `src/state/*.svelte.ts`; regras sem tela em `src/lib/` com teste em `tests/unit/`.
- **CSS só com tokens:** cores, fontes e tamanhos vêm de `src/styles/tokens.css`; nada de `#hex` fora dele
  (o stylelint cobra) e nada de `!important` (exceto `[hidden]`). Cada área da tela tem o seu arquivo em
  `src/styles/`; uma mudança de CSS que não deve mudar a tela se prova com `npm run check:css`.
- **Python:** código comum em `scripts/interlinear/`; tabelas de palavras em `data/rules/`; mensagens da
  revisão como chave + params (texto em `pt-BR.json`, seção `review`). Uma mudança no pipeline deixa a
  saída igual byte a byte (`scripts/dev/output_hash.py`), a menos que mude a saída de propósito.

## Comandos (tudo no Docker; o computador não precisa de Node nem de Python)

```bash
docker compose run --rm dev make data      # fontes, corpus, glosas, revisão e site
docker compose run --rm dev make test      # pytest, Vitest e Playwright
docker compose run --rm dev make lint      # Prettier, ESLint, stylelint, tipos, i18n, Ruff, mypy, Markdown
docker compose run --rm dev make videos-check
```

Detalhes do Docker em [`docs/DOCKER.md`](docs/DOCKER.md); dos testes, em [`docs/TESTES.md`](docs/TESTES.md).

## Commits

Em inglês, uma mudança por commit, com os testes passando; a `main` sempre publicável.
