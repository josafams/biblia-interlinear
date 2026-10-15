# 0002. Site estático no GitHub Pages; apps Android e iOS com Capacitor

- Situação: aceita

## Contexto

A Bíblia inteira com o original, as glosas e o léxico precisa funcionar offline, no navegador e como app, sem servidor e sem custo.

## Decisão

Os dados são gerados em build (Python) e publicados como arquivos estáticos no GitHub Pages (ramo `gh-pages`); o leitor é HTML, CSS e JavaScript sem framework e sem bundler, com os dados em arquivos `.js` carregados por `<script>` (funciona até abrindo do disco, `file://`). O mesmo site vira o app Android e iOS pelo Capacitor; recursos nativos (voz, impressão, login Google) entram por plugins.

## Consequências

- Nada a manter no ar além do GitHub Pages; o app funciona sem internet.
- Sem bundler: não há minificação nem tree shaking; o código publicado é o mesmo do repositório (legível, o que é desejável num projeto aberto). Se o JS crescer muito, adotar um bundler (Vite/esbuild) é uma decisão nova.
- Capacitor exige Java (Android) e Swift (iOS) só nos plugins próprios.
