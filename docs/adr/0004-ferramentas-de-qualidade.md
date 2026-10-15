# 0004. Ferramentas de qualidade

- Situação: aceita (outubro de 2026)

## Decisão

| Linguagem | Formatador | Linter | No CI |
|---|---|---|---|
| JavaScript | Prettier | ESLint 9 (flat) | workflow **Qualidade** |
| Python | Ruff format | Ruff (E, F, I, B, UP, S, SIM, PT, C90) | **Qualidade** |
| Markdown | — | markdownlint | **Qualidade** |
| Bash | — | ShellCheck | **Qualidade** |
| JSON/YAML/CSS | Prettier | — | **Qualidade** |

- Pre-commit roda tudo isso antes de cada commit (`make setup` instala).
- Cobertura do Python medida no CI sobre o pipeline de dados e os testes (`make coverage`); o piso é fixado depois da etapa 2 da migração (ADR 0003).
- Segurança: workflow **Segurança** com gitleaks, Semgrep (relatório, vira bloqueante depois da triagem), CodeQL (JS, Python, Java), `npm audit`, `pip-audit` e revisão de dependências nos PRs; Dependabot semanal.
- Versões fixadas em `.nvmrc`, `.python-version`, `package-lock.json` e `requirements-dev.txt`.

## Fora, por enquanto

- TypeScript: o site é JavaScript sem build (ADR 0002). Checagem de tipos com JSDoc (`// @ts-check`) pode vir numa etapa futura.
- SQL: o único banco é o SQLite do build (`build/biblia.sqlite`), recriado do zero a cada geração; não há migrações nem banco em produção.
- Kotlin/Compose e Swift/SwiftUI: os apps são Capacitor; só os plugins são nativos (Java).
