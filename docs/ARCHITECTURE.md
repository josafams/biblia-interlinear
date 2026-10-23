# Arquitetura

Mapa do projeto para quem vai mudar alguma coisa, pessoa ou IA. As convenções de código estão em
[`CLAUDE.md`](../CLAUDE.md); as decisões que explicam o desenho, em [`docs/adr/`](adr/README.md).

## Para mudar X, edite Y

| Quero mudar… | Onde |
|---|---|
| uma cor, uma fonte, um tamanho, um espaço, um raio | [`src/styles/tokens.css`](../src/styles/tokens.css) (o leitor) ou [`src/styles/home-tokens.css`](../src/styles/home-tokens.css) (página inicial e privacidade) |
| o visual de uma parte da tela | `src/styles/<área>.css`: `bar`, `chapter`, `verse`, `entry`, `annotate`, `notes`, `index`, `look`, `search`, `about`, `questions`, `lexicon`, `audio`, `side`, `toast`, `account`, `progress` |
| um texto de tela (botão, aviso, dica, mensagem da revisão) | [`src/i18n/locales/pt-BR.json`](../src/i18n/locales/pt-BR.json) |
| um painel ou um pedaço da tela | `src/components/<Nome>.svelte` (ex.: `AnnotatePanel`, `NotesSheet`, `LexiconEntry`, `Appearance`) |
| o que um painel faz ao tocar num botão | o módulo de `src/reader/` que monta o componente (ver abaixo) |
| um modo de leitura (Bíblia, Original, Interlinear, Estudo) | [`src/lib/modes.ts`](../src/lib/modes.ts) e os interruptores em [`src/lib/prefs.ts`](../src/lib/prefs.ts) |
| uma regra pura (sem tela): referências, busca, caderno, progresso, sincronização | `src/lib/` (com teste em `tests/unit/`) |
| a página inicial | [`web/home.html`](../web/home.html) (texto fixo) e `src/home/` (partes que vêm dos dados) |
| uma regra da revisão automática | `scripts/interlinear/review/checks/` (um módulo por grupo do catálogo [`docs/REVISOES.md`](REVISOES.md)) e o texto da mensagem em `pt-BR.json`, seção `review` |
| como uma glosa é feita | `scripts/interlinear/glosses/` |
| o que vai para os arquivos do app | `scripts/interlinear/export/` (um módulo por saída) |
| listas de palavras do português (artigos, verbos irregulares, sinônimos, glosas raras) | `data/rules/*.tsv` |
| temas, introduções, perguntas, léxico em português, correções | `data/` (conferidos por `scripts/check_data.py`) |

## Fluxo dos dados

```text
sources/ (fontes abertas)          data/ (editado à mão)
        │                                 │
        ▼                                 ▼
 scripts/corpus.py ──► build/biblia.sqlite ◄── scripts/make_glosses.py (glosas por alinhamento)
                              │
                              ├──► scripts/review.py ──► build/review/ (marks.json, report.md)
                              ▼
                       scripts/export.py ──► build/data/ (JSON) e build/web/dados/ (.js sob demanda)
                              │
                              ▼
 vite build (vite/interlinear-plugin.ts) ──► build/web: ler.html, index.html, sw.js, assets/
                              │
                              ▼
 navegador / app: src/lib/data (carrega capítulos e léxico) ──► src/state ──► src/components
```

A ordem é sempre corpus → glosas → revisão → export (o `Makefile`, o `scripts/build.sh` e o CI fazem igual).
`scripts/dev/output_hash.py` prova que uma mudança no Python deixa a saída igual, byte a byte.

## O site (`src/`)

| Pasta | O que tem |
|---|---|
| `src/reader/` | o leitor (`ler.html`): `main.ts` importa, nesta ordem, `reader.ts` (capítulo, palavras, áudio, verbete, painéis, índice, modos), `concordance.ts`, `search.ts`, `annotations/`, `account.ts`, `sync.ts`, `progress.ts` |
| `src/components/` | um componente Svelte por parte da tela; recebem dados de `src/state` e avisam ações por props (`onclose`, `onpick`…) |
| `src/state/` | o estado da tela em runes (`*.svelte.ts`): o que está aberto, o capítulo, as marcações, as preferências |
| `src/lib/` | regras puras em TypeScript, sem DOM, com testes de unidade |
| `src/i18n/` | `t(chave, params)` com plurais; o único idioma é `pt-BR.json` |
| `src/styles/` | `tokens.css`, `base.css` e um arquivo por área; `reader.css` importa todos, na ordem da cascata |
| `src/home/` | componentes da página inicial (amostra, números, Como usar, livros) que leem `home-data.json` |
| `web/` | as páginas HTML (marcação), os ícones e `google-config.js` |
| `vite/` | o plugin que monta o site: páginas, dados, fontes, ícones, manifest e service worker |

### Estado e componentes

- O estado fica em `src/state/*.svelte.ts`; os componentes leem dele e se redesenham sozinhos.
- Os módulos de `src/reader/` escrevem no estado e montam os componentes com `mount(...)`.
- O texto do capítulo é desenhado de novo a cada capítulo (`chapter.renderId`). Os cartões das palavras são
  HTML montado de uma vez (`wordCardsHTML`), porque um capítulo tem centenas deles.
- As marcações (cores, notas, faixa sob o versículo) vêm de `src/state/marks.svelte.ts`, calculadas por
  `src/lib/annotations/paint.ts` e desenhadas por `Verse.svelte`.

### Nomes que testes e vídeos usam (não renomeie sem trocar os dois)

- **Ids e classes:** `#open-toc`, `#open-look`, `#open-search`, `#where`, `#toc`, `#look`, `#detail`,
  `#mbar`, `#mb-*`, `#nota`, `#minhas`, `#mn-*`, `#exportar`, `#exp-*`, `#busca`, `#busca-*`, `#conta`,
  `#account-*`, `#progresso`, `#welcome`, `#vpos`, `#v<n>`, `.verse`, `.word[data-v][data-i]`, `.vmark`,
  `.toc-tabs`, `.chchip[data-ch]`, `.bchip[data-cod]`, `.mcard[data-modo]`, `.mb-color[data-cor]`,
  `[data-action]`, `[data-ptab]`.
- **Globais:** `window.Annotations`, `Account`, `Sync`, `Progress`, `Study`, `Search`, `__books`,
  `__currentChapter`, `__ultimoCaderno`, `__ultimoBackup`, `__noPrint`, `__progressConfig`, `__openSearch`,
  `__concordance`, `__preferencias`, `__carregarCapitulo`, `__resolveRef`.
- **Eventos:** `chapter-rendered`, `word-opened`, `lexicon-entry-opened`, `speech-state`,
  `preferences-changed`, `annotations:goto`, `annotations:speak`, `annotations:open-panel`,
  `annotations:open-index`.
- **Dados guardados nos aparelhos e no Drive** ficam em português: chaves `interlinear:*` do `localStorage`,
  coleções do Dexie (`marcacoes`, `notas`, `favoritos`, `etiquetas`, `leituras`, `tempo`, `planos`,
  `preferencias`) e campos (`ancora`, `cor`, `texto`…). Ver [ADR 0005](adr/0005-formato-dos-dados-guardados.md).

## O pipeline Python (`scripts/`)

| Arquivo | O que faz |
|---|---|
| `corpus.py` | lê as fontes e monta `build/biblia.sqlite` (livros, versículos, palavras, léxico) |
| `make_glosses.py` | glosas por alinhamento com a Bíblia Livre (`interlinear/glosses/`) |
| `review.py` | revisões automáticas (`interlinear/review/`) |
| `export.py` | arquivos do app, do EPUB e do PDF (`interlinear/export/`) |
| `check_data.py` | confere `data/` (também no pre-commit e no CI) |
| `query.py` | consulta rápida ao banco pela linha de comando |
| `build_epub.py`, `build_pdf.py` | os livros para baixar |

Código comum em `scripts/interlinear/`: `paths` (caminhos), `books` (os 66 livros e os capítulos), `text`
(normalização de hebraico, grego e português), `sources` (arquivos das fontes), `tsv` e `rules` (tabelas de
`data/`), `models` (linhas do banco como tuplas com nomes), `cli` (linha de comando).

## Verificação

| O quê | Comando (no Docker: `docker compose run --rm dev …`) |
|---|---|
| tipos do site | `npm run check` |
| textos de tela só no locale | `npm run check:i18n` |
| testes de unidade do site | `npx vitest run` |
| testes no navegador (celular e computador), com imagens | `VISUAL=1 npx playwright test` |
| CSS mudou sem mudar a tela | `cp -r build/web build/web-before`, mudar, `npm run build:web`, `npm run check:css` |
| roteiros dos vídeos | `node scripts/videos/gravar.mjs --verificar` |
| Python: lint, tipos, testes | `ruff check . && ruff format --check . && mypy && python3 -m pytest tests` |
| Python: saída igual | `python3 scripts/dev/output_hash.py > build/hash-before.txt`, mudar, refazer os dados, `python3 scripts/dev/output_hash.py --compare build/hash-before.txt` |
| dados editados à mão | `python3 scripts/check_data.py` |
