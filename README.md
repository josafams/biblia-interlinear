# Bíblia Interlinear (BLIVRE)

A Bíblia inteira, os 66 livros, palavra por palavra: **hebraico e aramaico** no Antigo Testamento e **grego** no Novo, cada palavra com transliteração, pronúncia aproximada em português, número Strong, análise gramatical, glosa em português e verbete do léxico, e abaixo de cada versículo o texto corrido da **Bíblia Livre (BLIVRE)**.

Tudo é feito com fontes abertas ou de domínio público, para poder ser distribuído livremente (veja [`docs/LICENCAS.md`](docs/LICENCAS.md)).

- **Site:** https://josafams.github.io/biblia-interlinear/ (ramo `gh-pages`)
- **App:** `liberta.bibliainterlinear` · "Bíblia Interlinear" (Android; projeto iOS pronto)
- **EPUB e PDF:** Bíblia completa, AT, NT e cada livro, nos dois formatos — em *Releases › livros* (gerados pelo GitHub a cada mudança nos dados)

---

## Como está o projeto (10/10/2026)

### Concluído

| Parte | Situação |
|---|---|
| **Texto original** | 443.123 palavras: hebraico e aramaico do Open Scriptures (Westminster Leningrad Codex) e grego do SBLGNT com a morfologia do MorphGNT. Onde o hebraico indica outra leitura à margem (*qere*), é ela que aparece; a forma escrita (*ketiv*) fica guardada e aparece no verbete (1.244 casos). Os sinais do aparato crítico foram tirados do grego. Rm 16:25–27, que o SBLGNT põe só no aparato, entra com a leitura de WH/Tregelles/NA28 e uma nota. |
| **Tradução corrida** | BLIVRE em todos os 31.166 versículos: revisão de 2018 no AT (completada pela edição de 2017 onde faltam versículos) e edição de 2017 no NT, que traduz o mesmo texto crítico do SBLGNT. Numeração das Bíblias em português; onde o hebraico numera diferente (Salmos, Joel, Malaquias, partes de Reis etc.) o mapa de versificação do Open Scriptures faz a conversão. 28 versículos da BLIVRE não têm correspondente no grego crítico (p. ex. Mt 17:21, Jo 7:53–8:11) e aparecem com nota. |
| **Glosas palavra a palavra** | Todas as palavras têm glosa. 86% vêm do **alinhamento estatístico** de cada versículo do original com a BLIVRE (eflomal), ou seja, a glosa é o trecho da BLIVRE que traduz aquela palavra; o resto vem da tradução mais comum da mesma palavra (em itálico cinza no app) ou de regras gramaticais (artigo grego, partícula de objeto). Correções automáticas: YHWH "EU-SOU" onde a BLIVRE usa essa forma, nomes próprios conferidos pela transliteração, contrações do português (em+o → no). Gênesis 1 tem 434 glosas revisadas à mão; nele, 59% das automáticas coincidem com as revisadas. |
| **Léxico** | 100% em português: os 8.593 verbetes hebraicos/aramaicos e 5.284 gregos usados no texto têm origem e significado traduzidos do dicionário de Strong, pronúncia em português (tônica em maiúsculas) e "como a BLIVRE traduz" (contagem do alinhamento). |
| **Temas e introduções** | Tema de cada um dos 1.189 capítulos e introdução "Sobre o livro" dos 66 livros: resumo, origem do nome, divisão, pessoas, autoria e data (tradição e pesquisa acadêmica), linha do tempo, contexto, lugares, temas e versículos-chave citados da BLIVRE. Texto próprio do projeto. |
| **Revisões automáticas** | `scripts/revisar.py` roda cerca de 45 verificações do catálogo [`docs/REVISOES.md`](docs/REVISOES.md) em 20 s: hoje 109 erros (quase todos palavras gregas sem verbete no Strong), 11.764 avisos e 38.386 informativos. No app, ⚑ no versículo mostra os pontos. |
| **Site / PWA** | Os 66 livros, com índice por livro e capítulo (tocar no capítulo já abre), "Ir para" (`Jo 3:16`, `sl 23`), introdução de cada livro, léxico do capítulo, verbetes com origem e significado, áudio pela voz do aparelho (hebraico e grego modernos), seis temas de cor, tamanho do texto e recursos de acessibilidade (leitor de tela, teclado, alto contraste, fonte de leitura fácil, sem cantilação). Os capítulos são carregados sob demanda; funciona também abrindo `saida/web/index.html` direto do disco. |
| **EPUB** | Bíblia completa num arquivo (34 MB), volumes AT (24 MB) e NT (10 MB), e um por livro (66 arquivos), validados com o epubcheck. No volume, um léxico único no fim. Cada palavra do original é uma nota que abre ao tocar (glosa, gramática, significado e link para o verbete); cada livro traz introdução, temas e léxico próprio. Formato testado no Kindle. |
| **PDF** | Bíblia completa, volumes AT e NT (com marcadores por testamento, livro e capítulo) e um por livro (66 arquivos A4): capa, introdução, cartões das palavras com a BLIVRE abaixo de cada versículo e léxico no fim. |
| **Apps** | Projetos Capacitor de Android e iOS sincronizados com a Bíblia inteira. |

### Falta

1. **Gerar o APK/AAB do Android e testar no celular** — Android Studio (`android/`, *Build › Build APK*) ou o workflow `.github/workflows/android.yml`.
2. **Revisão humana** das glosas, dos verbetes e das introduções, começando pelos avisos da revisão automática nos livros mais lidos (Gênesis, Salmos, Evangelhos) — como fazer: [`docs/CORRECOES.md`](docs/CORRECOES.md).
4. **Relatar aos tradutores da BLIVRE** os 47 erros de digitação listados em `dados/correcoes/blivre.tsv`.
3. **Publicação nas lojas** (Play Store: teste fechado com 12 testadores por 14 dias; ver [`docs/APPS.md`](docs/APPS.md)).

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
scripts/baixar_fontes.sh        # fontes abertas em fontes-dados/ (fora do git)
REFAZER=1 scripts/build.sh      # corpus, glosas, revisões, site, prévia, EPUB e PDF
npx cap sync                    # copia o site para os apps Android e iOS
```

Variáveis do `build.sh`: `REFAZER=1` refaz o banco e as glosas (sem ela, reaproveita `saida/biblia.sqlite`); `PDF=0` pula os PDFs (≈10 min); `CAP_SYNC=1` sincroniza os apps.

### O caminho dos dados

```
fontes-dados/ (morphhb, sblgnt, strongs, dodson, ebible, scrollmapper)
   │  scripts/corpus.py      textos, versificação, palavras, léxico → saida/biblia.sqlite
   │  scripts/glosar.py      alinhamento eflomal + regras → glosas no banco
   │  scripts/revisar.py     revisões automáticas → saida/revisao/
   │  scripts/exportar.py    banco + dados/ → saida/dados/ (JSON) e saida/web/dados/ (.js)
   ├─ scripts/build_web.mjs  web/template.html → saida/web (site, PWA, conteúdo dos apps)
   ├─ scripts/build_epub.py  → saida/epub (66 EPUBs)
   └─ scripts/build_pdf.py   → saida/pdf (66 PDFs, via scripts/imprimir_pdf.mjs)
```

### Publicar

O repositório é **github.com/josafams/biblia-interlinear**: a `main` tem o código e os dados; o ramo `gh-pages`, só o site gerado.

**Livros (EPUB e PDF):** a cada mudança em `dados/` ou nos scripts da `main`, o workflow `.github/workflows/livros.yml` refaz tudo a partir das fontes e publica a Bíblia completa, os volumes e os 66 livros na release **livros**, em *Releases*.

**App Android:** a cada envio para `main` ou `gh-pages`, o workflow `.github/workflows/android.yml` compila o app com o conteúdo do `gh-pages` e publica o APK (instalável no celular) e o AAB (Play Store) na release **app-android**, em *Releases*.

**Atualizar o site:** o site publicado é o ramo `gh-pages`, que contém só `saida/web`. Depois de gerar:

```sh
scripts/publicar_web.sh         # copia saida/web para gh-pages, faz o commit e envia
```

(Alternativa: `.github/workflows/web.yml`, acionado à mão, refaz tudo do zero no GitHub e publica pelo GitHub Actions.)

### Corrigir textos

Glosas, verbetes, temas e introduções são corrigidos em `dados/`, por pull request. O passo a passo e o fluxo até o site, o app, o EPUB e o PDF estão em **[`docs/CORRECOES.md`](docs/CORRECOES.md)**.

### Consultas rápidas

```sh
python3 scripts/consulta.py livros
python3 scripts/consulta.py versos JHN 3:16
python3 scripts/consulta.py interlinear GEN 1:1   # com a posição de cada palavra
python3 scripts/consulta.py verbete H430          # e o arquivo/linha para editar
```

---

## Estrutura

| Pasta / arquivo | Conteúdo |
|---|---|
| `scripts/corpus.py` | monta o banco: hebraico/aramaico, grego, BLIVRE, versificação (`DIVISOES` para versículos divididos), qere/ketiv, suplemento de Rm 16:25–27 |
| `scripts/glosar.py` | glosas por alinhamento (eflomal, simetrização *grow-diag-final-and*), regras, correções de nomes e de YHWH |
| `scripts/revisar.py` | revisões automáticas |
| `scripts/exportar.py` | dados do site, do EPUB e do PDF; `--previa` gera a página única de amostra |
| `scripts/pronuncia.py` | pronúncia em português do hebraico (a partir do Strong) e do grego (a partir do acento do lema) |
| `scripts/build_web.mjs`, `build_epub.py`, `build_pdf.py`, `imprimir_pdf.mjs` | saídas |
| `scripts/livros.py` | os 66 livros: códigos, nomes, abreviações, arquivos de origem |
| `scripts/consulta.py` | consulta ao banco pela linha de comando |
| `scripts/verificar_dados.py` | confere os arquivos de `dados/` (também roda no GitHub em cada pull request) |
| `scripts/publicar_web.sh` | publica `saida/web` no ramo `gh-pages` |
| `dados/temas/<LIVRO>.tsv` | tema de cada capítulo |
| `dados/livros/<LIVRO>.json` | introdução "Sobre o livro" (esquema em [`docs/ESQUEMA_LIVRO.md`](docs/ESQUEMA_LIVRO.md)) |
| `dados/lexico_pt/*.tsv` | origem e significado em português de cada verbete Strong |
| `dados/correcoes/glosas.tsv` | correções de glosa feitas por revisores (aplicadas por último) |
| `dados/correcoes/blivre.tsv` | erros de digitação encontrados na BLIVRE, para relatar aos tradutores |
| `dados/alinhamento/*.links.gz` | alinhamento salvo, para as glosas automáticas serem estáveis |
| `dados/glosses_pt.tsv` | glosas revisadas de Gênesis 1 (prevalecem sobre as automáticas) |
| `dados/grego_suplemento_66-Ro.txt` | grego de Rm 16:25–27 com morfologia anotada |
| `web/template.html` | a página (HTML, CSS e JS num arquivo só) |
| `android/`, `ios/` | projetos nativos do Capacitor |
| `fontes-epub/` | Noto Serif Hebrew (SIL OFL) para o EPUB |
| `.github/workflows/` | Android (APK e AAB), iOS (compilação de verificação) e web (manual) |
| `docs/` | apps e publicação (`APPS.md`), licenças (`LICENCAS.md`), revisões (`REVISOES.md`), esquema das introduções (`ESQUEMA_LIVRO.md`), **guia de correção** (`CORRECOES.md`) |
| `saida/` | tudo que é gerado (fora do git) |

## Licenças

Código e textos próprios: sugestão CC BY-SA 4.0 para os dados e textos (compatível com o Strong e o MorphGNT). Fontes de terceiros e obrigações de crédito: [`docs/LICENCAS.md`](docs/LICENCAS.md). As glosas e o léxico não fazem parte da BLIVRE e não têm endosso dos seus autores.
