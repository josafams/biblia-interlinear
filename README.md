# Bíblia Interlinear (BLIVRE)

A Bíblia inteira, os 66 livros, palavra por palavra: **hebraico e aramaico** no Antigo Testamento e **grego** no Novo, cada palavra com transliteração, pronúncia aproximada em português, número Strong, análise gramatical, glosa em português e verbete do léxico, e abaixo de cada versículo o texto corrido da **Bíblia Livre (BLIVRE)**.

Tudo é feito com fontes abertas ou de domínio público, para poder ser distribuído livremente (veja [`docs/LICENCAS.md`](docs/LICENCAS.md)).

- **Site:** <https://josafams.github.io/biblia-interlinear/> (ramo `gh-pages`)
- **App:** `liberta.bibliainterlinear` · "Bíblia Interlinear" (Android; projeto iOS pronto)
- **EPUB e PDF:** Bíblia completa, AT, NT e cada livro, nos dois formatos — em *Releases › livros* (gerados pelo GitHub a cada mudança nos dados)

---

## Desenvolvimento

Regras do projeto (idioma, formatação, testes, commits, segurança) em [CONTRIBUTING.md](CONTRIBUTING.md); decisões de arquitetura em [docs/adr/](docs/adr/README.md). Os comandos são os mesmos para todas as linguagens:

```bash
make setup   # dependências e ganchos do pre-commit
make data    # fontes abertas → corpus, glosas e site
make test    # pytest + Playwright
make lint    # Prettier, ESLint, Ruff, markdownlint, ShellCheck
make help    # todos os comandos
```

No GitHub, os workflows **Qualidade** (lint), **Testes** (dados, site, cobertura) e **Segurança** (gitleaks, Semgrep, CodeQL, dependências) rodam em todo pull request.

## Como está o projeto (10/10/2026)

### Concluído

| Parte | Situação |
|---|---|
| **Texto original** | 443.123 palavras: hebraico e aramaico do Open Scriptures (Westminster Leningrad Codex) e grego do SBLGNT com a morfologia do MorphGNT. Onde o hebraico indica outra leitura à margem (*qere*), é ela que aparece; a forma escrita (*ketiv*) fica guardada e aparece no verbete (1.244 casos). Os sinais do aparato crítico foram tirados do grego. Rm 16:25–27, que o SBLGNT põe só no aparato, entra com a leitura de WH/Tregelles/NA28 e uma nota. |
| **Tradução corrida** | BLIVRE em todos os 31.166 versículos: revisão de 2018 no AT (completada pela edição de 2017 onde faltam versículos) e edição de 2017 no NT, que traduz o mesmo texto crítico do SBLGNT. Numeração das Bíblias em português; onde o hebraico numera diferente (Salmos, Joel, Malaquias, partes de Reis etc.) o mapa de versificação do Open Scriptures faz a conversão. 28 versículos da BLIVRE não têm correspondente no grego crítico (p. ex. Mt 17:21, Jo 7:53–8:11) e aparecem com nota. |
| **Glosas palavra a palavra** | Todas as palavras têm glosa. 86% vêm do **alinhamento estatístico** de cada versículo do original com a BLIVRE (eflomal), ou seja, a glosa é o trecho da BLIVRE que traduz aquela palavra; o resto vem da tradução mais comum da mesma palavra (em itálico cinza no app) ou de regras gramaticais (artigo grego, partícula de objeto). Correções automáticas: YHWH "EU-SOU" onde a BLIVRE usa essa forma, nomes próprios conferidos pela transliteração, contrações do português (em+o → no). Gênesis 1 tem 434 glosas revisadas à mão; nele, 59% das automáticas coincidem com as revisadas. |
| **Léxico** | 100% em português: os 8.593 verbetes hebraicos/aramaicos e 5.284 gregos usados no texto têm origem e significado traduzidos do dicionário de Strong, pronúncia em português (tônica em maiúsculas) e "como a BLIVRE traduz" (contagem do alinhamento). |
| **Temas e introduções** | Tema de cada um dos 1.189 capítulos e introdução "Sobre o livro" dos 66 livros: resumo, origem do nome, divisão, pessoas, autoria e data (tradição e pesquisa acadêmica), linha do tempo, contexto, lugares, temas e versículos-chave citados da BLIVRE. Texto próprio do projeto. |
| **Revisões automáticas** | `scripts/review.py` roda cerca de 45 verificações do catálogo [`docs/REVISOES.md`](docs/REVISOES.md) em 20 s: hoje 109 erros (quase todos palavras gregas sem verbete no Strong), 11.764 avisos e 38.386 informativos. No app, ⚑ no versículo mostra os pontos. |
| **Site / PWA** | Os 66 livros, com índice por livro e capítulo (tocar no capítulo já abre), "Ir para" (`Jo 3:16`, `sl 23`), introdução de cada livro, léxico do capítulo, verbetes com origem e significado, áudio pela voz do aparelho (hebraico e grego modernos), seis temas de cor, tamanho do texto e recursos de acessibilidade (leitor de tela, teclado, alto contraste, fonte de leitura fácil, sem cantilação). Os capítulos são carregados sob demanda; funciona também abrindo `build/web/ler.html` direto do disco; `index.html` é a página inicial do projeto (apps, EPUB, PDF, vídeos Como usar). |
| **Modos de leitura** | Em Aa › Modo de leitura: **Bíblia** (só a Bíblia Livre, em parágrafos, com áudio em português), **Original** (hebraico/grego corrido; a palavra abre o verbete), **Original e Bíblia Livre**, **Interlinear**, **Estudo** (com pronúncia e análise gramatical) e **Personalizado** (cada item da página liga e desliga). Na primeira abertura o app pergunta como a pessoa quer ler; o botão ⇄ volta ao modo anterior; no modo Bíblia, tocar no número do versículo mostra o interlinear só dele. |
| **Anotações** | Marcar com cinco cores um versículo, um trecho selecionado da Bíblia Livre ou uma palavra do original (toque longo ou botão ⋯), notas ligadas ao versículo ou livres (salvam sozinhas), favoritos e etiquetas, e **Minhas anotações** (no Índice) com busca, filtros e seleção. **Exportar PDF** monta um caderno A4 (agrupado por versículo, com o texto, as cores, as notas, as etiquetas e, se quiser, o interlinear das palavras marcadas) e abre a janela de impressão — no Android, pelo serviço de impressão do sistema (`PrintPlugin.java`). **Baixar meus dados** gera um JSON com tudo; **Importar** junta um backup sem duplicar (vence a versão mais recente de cada item). Tudo fica no aparelho (IndexedDB, via Dexie), sem conta; `web/annotations.js`. |
| **Conta Google (opcional)** | No Índice, "Entrar com Google" liga o app à pasta oculta e privada do app no Google Drive da pessoa (escopo `drive.appdata`), sem servidor do projeto: no site pelo Google Identity Services, no Android por um plugin nativo (`GoogleAccountPlugin.java`). Configuração e IDs de cliente: [docs/GOOGLE.md](docs/GOOGLE.md). |
| **Sincronização** | Com a conta ligada, as anotações e o modo de leitura sincronizam sozinhos entre aparelhos (`web/sync.js`): cada envio é um arquivo novo `lote-<aparelho>-<hora>.json` na pasta do app; vence a edição com o relógio lógico maior; nota editada nos dois lados vira duas ("conflito"); um retrato compacta os lotes antigos. No primeiro login, o que já foi anotado no aparelho sobe sozinho; Sair pergunta se mantém a cópia local; "Apagar meus dados do Google Drive" limpa a pasta. Testes com vários aparelhos simulados: `tests/web/sync.spec.mjs`. |
| **Meu progresso** | Para quem entrou com a conta Google (`web/progress.js`): capítulo lido ao chegar ao fim e ficar 1 minuto ativo (ou marcado à mão), tempo de leitura só com a página visível e atividade nos últimos 2 minutos, dias seguidos (1 capítulo ou 5 minutos), gráfico por semana/mês/ano, mapa dos 66 livros com o detalhe de cada livro, planos "Bíblia em 1 ano" e "NT em 90 dias" (leitura do dia, adiantado/atrasado, reajustar). O tempo de cada aparelho é somado. Pausar a contagem e zerar estatísticas na própria tela. |
| **Perguntas ao texto** | No fim do capítulo, de 3 a 5 perguntas sem respostas — observe, interprete, no original (com a palavra hebraica ou grega, que abre o verbete) e aplique —, cada uma com o versículo e o botão **Anotar resposta** (vira uma nota no versículo). 3.318 perguntas em 808 capítulos até agora; formato, regras e cobertura em [`docs/PERGUNTAS.md`](docs/PERGUNTAS.md). Liga e desliga em Aa › Mostrar na página. |
| **Página inicial e vídeos** | `index.html` apresenta o projeto, os apps, os EPUB e PDF e a seção **Como usar**, com um vídeo curto por função, gravado automaticamente a partir de roteiros (`scripts/videos`). O leitor fica em `ler.html`. |
| **EPUB** | Edição só com a Bíblia Livre (1,4 MB, sem o original). Bíblia completa num arquivo (34 MB), volumes AT (24 MB) e NT (10 MB), e um por livro (66 arquivos), validados com o epubcheck. No volume, um léxico único no fim. Cada palavra do original é uma nota que abre ao tocar (glosa, gramática, significado e link para o verbete); cada livro traz introdução, temas e léxico próprio. Formato testado no Kindle. |
| **PDF** | Edição só com a Bíblia Livre (A4, duas colunas, 8 MB). Bíblia completa, volumes AT e NT (com marcadores por testamento, livro e capítulo) e um por livro (66 arquivos A4): capa, introdução, cartões das palavras com a BLIVRE abaixo de cada versículo e léxico no fim. |
| **Apps** | Projetos Capacitor de Android e iOS sincronizados com a Bíblia inteira. |

### Falta

1. **Gerar o APK/AAB do Android e testar no celular** — Android Studio (`android/`, *Build › Build APK*) ou o workflow `.github/workflows/android.yml`.
2. **Revisão humana** das glosas, dos verbetes e das introduções, começando pelos avisos da revisão automática nos livros mais lidos (Gênesis, Salmos, Evangelhos) — como fazer: [`docs/CORRECOES.md`](docs/CORRECOES.md).
3. **Relatar aos tradutores da BLIVRE** os 47 erros de digitação listados em `data/corrections/blivre.tsv`.
4. **Publicação nas lojas**: textos, imagens (`make store`) e passo a passo em [`docs/LOJAS.md`](docs/LOJAS.md); falta a chave de upload, a tela de consentimento do Google em produção e o teste fechado (12 testadores por 14 dias).

### Limitações conhecidas

- As glosas seguem as escolhas da BLIVRE ("expansão" em vez de "firmamento") e às vezes ficam deslocadas onde a BLIVRE reorganiza muito a frase (p. ex. Jo 1:1 "πρὸς τὸν θεόν").
- 87 lemas gregos do texto crítico não existem no dicionário de Strong e aparecem sem significado.
- 189 verbetes não têm "como a BLIVRE traduz" (o alinhamento nunca os ligou a uma palavra da BLIVRE).
- Léxico, temas e introduções foram escritos por IA a partir de fontes abertas e ainda não tiveram revisão humana.
- Os agentes que escreveram as introduções anotaram erros de digitação na própria BLIVRE (p. ex. "SEHOR" em Sl 29:3, "Cirsto" em Fm 1:25), que o projeto reproduz sem alterar.

---

## Como gerar

Requisitos: Node 22, Python 3.11+ (`pip install eflomal pypdf`), git, zip; para o PDF, o Chromium do Playwright.

```sh
npm ci
scripts/download_sources.sh        # fontes abertas em sources/ (fora do git)
REFAZER=1 scripts/build.sh      # corpus, glosas, revisões, site, prévia, EPUB e PDF
npx cap sync                    # copia o site para os apps Android e iOS
```

Variáveis do `build.sh`: `REFAZER=1` refaz o banco e as glosas (sem ela, reaproveita `build/biblia.sqlite`); `PDF=0` pula os PDFs (≈10 min); `CAP_SYNC=1` sincroniza os apps.

### O caminho dos dados

```text
sources/ (morphhb, sblgnt, strongs, dodson, ebible, scrollmapper)
   │  scripts/corpus.py      textos, versificação, palavras, léxico → build/biblia.sqlite
   │  scripts/make_glosses.py      alinhamento eflomal + regras → glosas no banco
   │  scripts/review.py     revisões automáticas → build/review/
   │  scripts/export.py    banco + dados/ → build/data/ (JSON) e build/web/dados/ (.js)
   ├─ scripts/build_web.mjs  web/reader.html → build/web (site, PWA, conteúdo dos apps)
   ├─ scripts/build_epub.py  → build/epub (66 EPUBs)
   └─ scripts/build_pdf.py   → build/pdf (66 PDFs, via scripts/print_pdf.mjs)
```

### Publicar

O repositório é **github.com/josafams/biblia-interlinear**: a `main` tem o código e os dados; o ramo `gh-pages`, só o site gerado.

**Livros (EPUB e PDF):** a cada mudança em `data/` ou nos scripts da `main`, o workflow `.github/workflows/books.yml` refaz tudo a partir das fontes e publica a Bíblia completa, os volumes e os 66 livros na release **livros**, em *Releases*.

**App Android:** a cada envio para `main` ou `gh-pages`, o workflow `.github/workflows/android.yml` compila o app com o conteúdo do `gh-pages` e publica o APK (instalável no celular) e o AAB (Play Store) na release **app-android**, em *Releases*.

**Atualizar o site:** o site publicado é o ramo `gh-pages`, que contém só `build/web`. Depois de gerar:

```sh
scripts/publish_web.sh         # copia build/web para gh-pages, faz o commit e envia
```

(Alternativa: `.github/workflows/web.yml`, acionado à mão, refaz tudo do zero no GitHub e publica pelo GitHub Actions.)

### Testes e vídeos

Testes automáticos de dados, livros e do site rodam a cada envio; os vídeos “Como usar” da página inicial são gravados a partir de roteiros. Como rodar e manter: [`docs/TESTES.md`](docs/TESTES.md).

### Corrigir textos

Glosas, verbetes, temas e introduções são corrigidos em `data/`, por pull request. O passo a passo e o fluxo até o site, o app, o EPUB e o PDF estão em **[`docs/CORRECOES.md`](docs/CORRECOES.md)**.

### Consultas rápidas

```sh
python3 scripts/query.py books
python3 scripts/query.py verses JHN 3:16
python3 scripts/query.py interlinear GEN 1:1   # com a posição de cada palavra
python3 scripts/query.py entry H430          # e o arquivo/linha para editar
```

---

## Estrutura

| Pasta / arquivo | Conteúdo |
|---|---|
| `scripts/corpus.py` | monta o banco: hebraico/aramaico, grego, BLIVRE, versificação (`DIVISOES` para versículos divididos), qere/ketiv, suplemento de Rm 16:25–27 |
| `scripts/make_glosses.py` | glosas por alinhamento (eflomal, simetrização *grow-diag-final-and*), regras, correções de nomes e de YHWH |
| `scripts/review.py` | revisões automáticas |
| `scripts/export.py` | dados do site, do EPUB e do PDF; `--previa` gera a página única de amostra |
| `scripts/pronunciation.py` | pronúncia em português do hebraico (a partir do Strong) e do grego (a partir do acento do lema) |
| `scripts/build_web.mjs`, `build_epub.py`, `build_pdf.py`, `print_pdf.mjs` | saídas |
| `scripts/books.py` | os 66 livros: códigos, nomes, abreviações, arquivos de origem |
| `scripts/query.py` | consulta ao banco pela linha de comando |
| `scripts/check_data.py` | confere os arquivos de `data/` (também roda no GitHub em cada pull request) |
| `scripts/publish_web.sh` | publica `build/web` no ramo `gh-pages` |
| `data/themes/<LIVRO>.tsv` | tema de cada capítulo |
| `data/books/<LIVRO>.json` | introdução "Sobre o livro" (esquema em [`docs/ESQUEMA_LIVRO.md`](docs/ESQUEMA_LIVRO.md)) |
| `data/lexicon_pt/*.tsv` | origem e significado em português de cada verbete Strong |
| `data/corrections/glosses.tsv` | correções de glosa feitas por revisores (aplicadas por último) |
| `data/corrections/blivre.tsv` | erros de digitação encontrados na BLIVRE, para relatar aos tradutores |
| `data/alignment/*.links.gz` | alinhamento salvo, para as glosas automáticas serem estáveis |
| `data/glosses_pt.tsv` | glosas revisadas de Gênesis 1 (prevalecem sobre as automáticas) |
| `data/greek_supplement_66-Ro.txt` | grego de Rm 16:25–27 com morfologia anotada |
| `web/reader.html` e `web/reader.js` | a página do leitor (HTML e CSS) e o seu JavaScript |
| `web/annotations.js`, `account.js`, `sync.js`, `progress.js` | anotações e caderno, conta Google, sincronização pelo Drive, Meu progresso |
| `web/home.html` e `web/home.js` | a página inicial (`index.html`) e a seção Como usar |
| `android/`, `ios/` | projetos nativos do Capacitor |
| `epub-fonts/` | Noto Serif Hebrew (SIL OFL) para o EPUB |
| `.github/workflows/` | Android (APK e AAB), iOS (compilação de verificação) e web (manual) |
| `docs/` | apps e publicação (`APPS.md`), licenças (`LICENCAS.md`), revisões (`REVISOES.md`), esquema das introduções (`ESQUEMA_LIVRO.md`), **guia de correção** (`CORRECOES.md`) |
| `build/` | tudo que é gerado (fora do git) |

## Licenças

Código e textos próprios: sugestão CC BY-SA 4.0 para os dados e textos (compatível com o Strong e o MorphGNT). Fontes de terceiros e obrigações de crédito: [`docs/LICENCAS.md`](docs/LICENCAS.md). As glosas e o léxico não fazem parte da BLIVRE e não têm endosso dos seus autores.
