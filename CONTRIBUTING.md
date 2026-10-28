# Como contribuir

Obrigado por ajudar! Este arquivo reúne as decisões do projeto, para que o code review discuta lógica, não estilo.

## Idioma

| Item | Idioma |
|---|---|
| Identificadores (variáveis, funções, classes, arquivos de código, coleções e campos de dados) | **Inglês** |
| Termos sem tradução boa (BLIVRE, Strong, ketiv/qere, nomes de livros como `GEN`) | mantidos como estão |
| Comentários, docstrings, documentação (`docs/`, README) | **Português** (o projeto e o time são brasileiros) |
| Mensagens de commit e PRs | Português, com o prefixo do Conventional Commits em inglês (`feat:`, `fix:`) |
| Textos para quem usa o app | Português do Brasil |

A migração do código antigo (em português) para identificadores em inglês está sendo feita por etapas; veja [docs/adr/0003-identificadores-em-ingles.md](docs/adr/0003-identificadores-em-ingles.md).

## Preparar o ambiente

Requisito: só o Docker. Os comandos rodam num contêiner com todas as ferramentas ([docs/DOCKER.md](docs/DOCKER.md)); no Windows sem o `make`, use `biblia <comando>`.

```bash
make docker-build  # monta as imagens (primeira vez)
make data          # baixa as fontes abertas e gera corpus, glosas e o site
make test          # testes de dados (pytest) e do site (Playwright)
make lint          # linters de todas as linguagens (o mesmo do CI)
make help          # lista todos os comandos
```

Sem Docker, com Node (`.nvmrc`), Python (`.python-version`), `qpdf` e `poppler-utils` instalados: `make LOCAL=1 setup` e depois `make LOCAL=1 <comando>`. Os ganchos do pre-commit (`pre-commit install`) precisam do Python no computador.

## Regras do código

1. **Formatação automática, sem discussão:** Prettier (JS, JSON, YAML, CSS) e Ruff format (Python). O pre-commit formata antes de cada commit; o CI confere.
2. **Lint:** ESLint (JS) e Ruff (Python, inclui regras de segurança), markdownlint (docs), ShellCheck (scripts Bash).
3. Funções pequenas, nomes que dizem o que fazem, sem abreviações obscuras.
4. Regra de negócio separada de I/O (arquivos, rede, banco), para testar sem montar o mundo.
5. **Todo bug corrigido ganha um teste** que o reproduz.
6. Nada de segredo no repositório: os IDs de cliente do Google são públicos; chaves de assinatura e senhas ficam nos *Secrets* do GitHub.
7. Versões fixadas: `.nvmrc`, `.python-version`, `package-lock.json`, `requirements-dev.txt`.
8. Tudo o que vai para o app tem que ser aberto ou de domínio público (o projeto é distribuído livremente). Antes de adicionar uma dependência, confira a licença em [docs/LICENCAS.md](docs/LICENCAS.md).

## Testes

- `tests/test_*.py` (pytest): dados, funções dos scripts, EPUB e PDF.
- `tests/web/*.spec.mjs` (Playwright): o site no tamanho de celular e de computador; o Google é simulado.
- Padrão AAA (preparar, agir, conferir), nome do teste dizendo o comportamento, sem depender de ordem.
- Teste instável é bug: investigue e corrija; nunca desative para o CI passar.
- Mais detalhes: [docs/TESTES.md](docs/TESTES.md).

## Commits e pull requests

- [Conventional Commits](https://www.conventionalcommits.org/pt-br/): `feat:`, `fix:`, `test:`, `refactor:`, `docs:`, `chore:`, `ci:`.
- Commits pequenos, cada um passando nos testes. Refatoração em commit (e PR) separado de mudança de comportamento.
- Branch curta a partir da `main` (`feat/plano-proprio`), PR pequeno com o que muda, por quê e como testar; squash merge.
- Correções de glosas e do léxico: veja [docs/CORRECOES.md](docs/CORRECOES.md).

## Segurança

- Nada de `innerHTML` com texto vindo de fora sem escapar (use a função `esc`), nada de `eval`.
- Consultas SQL sempre parametrizadas (`?`).
- O workflow **Segurança** roda gitleaks, Semgrep, CodeQL e auditoria de dependências em todo PR e toda semana.
- Problema de segurança? Não abra issue pública: siga o [SECURITY.md](SECURITY.md).
