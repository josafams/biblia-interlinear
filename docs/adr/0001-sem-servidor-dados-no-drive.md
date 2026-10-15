# 0001. Sem servidor: dados de cada pessoa no Google Drive dela

- Situação: aceita (outubro de 2026)

## Contexto

Anotações, progresso e preferências precisam valer em vários aparelhos. Um servidor próprio (PocketBase, Supabase, Firebase) traria custo mensal, backup, atualizações e a responsabilidade de guardar dados pessoais (LGPD) — para um projeto gratuito e aberto.

## Decisão

O aparelho é a fonte do dia a dia (IndexedDB via Dexie). Com login Google opcional, o app grava as mudanças na pasta oculta do app no Drive da própria pessoa (escopo `drive.appdata`), em arquivos de lote que nunca são editados, e lê os lotes dos outros aparelhos. Vence a edição com o relógio lógico híbrido maior; notas editadas nos dois lados viram duas.

## Consequências

- Custo zero e nenhum dado pessoal com o projeto.
- Sem tempo real: mudanças chegam em até ~30 s com o app aberto.
- Sem grupos ou compartilhamento entre pessoas; se um dia vierem, o motor fala com o armazenamento por um adaptador pequeno.
- Detalhes: `web/sincronizar.js` e [docs/GOOGLE.md](../GOOGLE.md).
