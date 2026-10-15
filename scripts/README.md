# Scripts

Todos rodam a partir da raiz do repositório. O caminho normal é `make data` (ou `scripts/build.sh` para gerar tudo, inclusive EPUB e PDF); `make help` lista os atalhos.

## Dados (Python)

| Script | O que faz | Quem usa / quando |
|---|---|---|
| `download_sources.sh` | baixa as fontes abertas (BLIVRE, Open Scriptures, SBLGNT/MorphGNT, Strong, Dodson) para `sources/` | uma vez por máquina e no CI; não altera nada no repositório |
| `corpus.py` | monta `build/biblia.sqlite`: livros, versículos da BLIVRE, palavras do original com morfologia e o léxico | `make data`, CI |
| `make_glosses.py` | alinha cada versículo do original com a BLIVRE (eflomal) e grava as glosas; aplica `data/corrections/glosses.tsv` | `make data`, CI (precisa do eflomal) |
| `review.py` | revisões automáticas (`docs/REVISOES.md`) → `build/review/` | `make data`, CI |
| `export.py` | exporta o banco e `data/` para `build/data` (JSON) e `build/web/dados` (JS do site); `--preview` monta a prévia | `build_web.mjs`, `build.sh` |
| `check_data.py` | confere os arquivos editados à mão em `data/` (formato, colunas, referências) | pre-commit, CI em todo PR |
| `query.py` | consulta rápida ao corpus: `books`, `chapter`, `verses`, `interlinear`, `entry` | quem escreve temas, introduções e correções |
| `pronunciation.py` | pronúncia aproximada dos lemas (módulo; rodando sozinho, executa os testes de pronúncia) | `export.py` |
| `books.py` | os 66 livros: códigos de cada fonte, nomes e abreviações (módulo) | os outros scripts |
| `build_epub.py` | EPUB por livro, volumes e a Bíblia completa → `build/epub` | `build.sh`, workflow Livros |
| `build_pdf.py` | PDF por livro, volumes e a Bíblia completa → `build/pdf` (usa `print_pdf.mjs`) | `build.sh`, workflow Livros |

## Site, apps e vídeos (Node)

| Script | O que faz | Quem usa / quando |
|---|---|---|
| `build_web.mjs` | gera o site em `build/web` (leitor, página inicial, service worker) | `make web`, CI |
| `print_pdf.mjs` | imprime em PDF, com o Chromium, os HTML gerados por `build_pdf.py` | `build_pdf.py` |
| `native_icons.mjs` | ícones e telas de abertura do Android e do iOS a partir de `web/icones` | depois de `npx cap add` |
| `videos/gravar.mjs` | grava os vídeos "Como usar" a partir dos roteiros; `--verificar` só executa os roteiros | workflow Vídeos, CI |

## Publicação e manutenção (Bash)

| Script | O que faz | Efeitos |
|---|---|---|
| `build.sh` | gera tudo: dados, site, prévia, EPUB e PDF | escreve em `build/` |
| `publish_web.sh` | publica `build/web` no ramo `gh-pages` | **envia ao GitHub** |
| `change_app_id.sh` | troca o identificador do app no Capacitor, Android e iOS | altera arquivos de `android/` e `ios/`; só antes da primeira publicação |

## Ferramentas de desenvolvimento

| Script | O que faz |
|---|---|
| `dev/rename_identifiers.py` | renomeia identificadores Python por um mapa (usado na migração para nomes em inglês, ADR 0003) |

Todo script novo tem um cabeçalho com propósito, uso e efeitos colaterais; scripts Bash usam `set -euo pipefail` e passam no ShellCheck.
