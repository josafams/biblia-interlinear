# Plano: Bíblia inteira e app Android

Estimativa feita em 9/10/2026, a partir do protótipo de Gênesis 1.

## Resumo

- **Bíblia inteira + app Android publicado**, com glosas geradas e marcadas como "em revisão": cerca de **3 meses em meio período** (6–8 semanas em tempo integral).
- **Com revisão humana completa** por quem lê hebraico e grego: **6 a 12 meses**. É o gargalo real.

Escala: Gênesis 1 tem 434 palavras; a Bíblia tem cerca de 300 mil no AT e 138 mil no NT; o léxico passa de 14 mil verbetes (≈ 8.700 hebraicos/aramaicos e 5.600 gregos).

## Etapas

| Etapa | O que envolve | Tempo (meio período) |
|---|---|---|
| Pipeline para os 66 livros | vários capítulos por livro, grego no NT, trechos em aramaico (Daniel, Esdras), alinhamento da numeração com a BLIVRE (Salmos, Gn 31–32 etc.) | 1–2 semanas |
| Glosas em português | partir das glosas em inglês do STEPBible (TAHOT/TAGNT, CC BY 4.0) e verter para o português; revisão por amostragem | 2–3 semanas |
| Léxico em português | verbetes do Strong em lotes, como em Gênesis 1 | 1–2 semanas |
| Temas e introduções | temas dos 1.189 capítulos, seções e "Sobre o livro" dos 66 livros | 2–3 semanas |
| App Android | página atual dentro de um app Capacitor; dados offline por livro; voz nativa do Android (resolve o áudio que não funciona em WebView); busca e marcadores | 3–4 semanas |
| Publicação na Play Store | conta de desenvolvedor, política de privacidade, ficha da loja, teste fechado | 3–4 semanas de calendário, em paralelo |

## Play Store (contas pessoais criadas após 13/11/2023)

- Teste fechado com pelo menos **12 testadores** inscritos por **14 dias seguidos** antes de pedir acesso à produção.
- Análise costuma levar até 7 dias.
- Fonte: https://support.google.com/googleplay/android-developer/answer/14151465

## Estratégia sugerida

Lançar cedo com tudo gerado e revisar por prioridade (Gênesis, Salmos, Evangelhos), com um selo de "glosa revisada" que aparece conforme a revisão avança.

## Próximo passo

Generalizar o pipeline para vários capítulos e livros, testando com Gênesis inteiro.
