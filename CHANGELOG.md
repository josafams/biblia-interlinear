# Mudanças

As mudanças de cada versão, da mais nova para a mais antiga. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões no [SemVer](https://semver.org/lang/pt-BR/).
O site e a release `app-android` sempre trazem a `main`; as versões marcam pontos estáveis.

## [Não lançado]

### Adicionado

- App em inglês com a Berean Standard Bible (BSB) (#8): seletor de idioma em Aparência; glosas em inglês por
  alinhamento com a BSB, léxico Strong em inglês, busca e concordância; introduções dos 66 livros, temas dos
  capítulos e perguntas ao texto em inglês.
- Página inicial em inglês (`en/`) e páginas para buscadores em inglês (`en/bible/`, `en/lexicon/`), ligadas às
  em português por `hreflang`.
- EPUB e PDF em inglês (release `books-en`), vídeos "How to use" e a ficha da loja em inglês.
- Lembrete de leitura e versículo do dia, como notificações no app e um cartão em Você.

### Mudado

- Os vídeos "Como usar" das duas línguas são gravados em paralelo.

### Corrigido

- O service worker baixava de uma vez os dados em inglês; agora eles entram no cache só quando são lidos.
- 110 verbetes do léxico em inglês tinham o significado cortado no meio de um parêntese.

## [0.1.0] - 2026-10-28

Primeira versão: a Bíblia inteira (66 livros) palavra por palavra, no site, no app Android e em EPUB e PDF.

### Adicionado

- Texto original com 443.123 palavras: hebraico e aramaico do Open Scriptures (WLC, com *qere*/*ketiv*) e grego do
  SBLGNT com a morfologia do MorphGNT.
- Bíblia Livre (BLIVRE) em todos os 31.166 versículos, com a versificação das Bíblias em português.
- Glosa em português para todas as palavras (86% por alinhamento estatístico com a BLIVRE), léxico Strong traduzido
  (8.593 verbetes hebraicos/aramaicos e 5.284 gregos) e pronúncia em português.
- Tema dos 1.189 capítulos, introdução dos 66 livros e perguntas ao texto no fim dos capítulos.
- Leitor web/PWA: seis modos de leitura, busca, concordância, léxico do capítulo, áudio pela voz do aparelho,
  acessibilidade, temas de cor e uso offline.
- Anotações (cores, notas, etiquetas, exportar PDF, backup), conta Google opcional com sincronização entre aparelhos
  pelo Google Drive e Meu progresso com planos de leitura.
- App Android (Capacitor), projeto iOS, EPUB e PDF da Bíblia completa, dos volumes e de cada livro.
- Páginas estáticas para buscadores (livros, capítulos e verbetes) e sitemap.
- Revisões automáticas dos dados, testes (pytest, Vitest, Playwright), vídeos "Como usar" gravados a partir de
  roteiros e ambiente Docker.
- Licença CC BY-SA 4.0, `SECURITY.md`, código de conduta e formulários de issue.

[Não lançado]: https://github.com/josafams/biblia-interlinear/compare/v0.1.0...main
[0.1.0]: https://github.com/josafams/biblia-interlinear/releases/tag/v0.1.0
