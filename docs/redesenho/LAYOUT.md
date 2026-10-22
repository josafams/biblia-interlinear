# Layout do leitor: tabela verdade

Medido nos dois arquivos exportados do canvas de design (`Bíblia Interlinea 1.html`, celular 390×844, e
`Bíblia Interlinea 2.html`, computador 1280×800), com o estilo calculado pelo navegador em cada estado
(clicando em cada botão). Quando o app e esta tabela discordam, vale a tabela.

## Fundamentos

| Item | Valor |
|---|---|
| Fonte da interface | Atkinson Hyperlegible 15px, altura de linha 1,45, peso 400 |
| Texto bíblico (Bíblia Livre) | Literata 17px / 1,6 no celular; 18px / 1,6 no computador; 1,8 corrido no modo Bíblia |
| Grego / hebraico nos cartões | Gentium Book Plus 21px / 1,2 (celular), 22px (computador) |
| Títulos | Literata 600: h1 28px (celular) / 34px (computador), h2 20px / 22px |
| Rótulos de seção | IBM Plex Mono 11px, maiúsculas, espaçamento 0,08em, cor `--muted` |
| Cores (tema claro) | fundo `#eceeea`, superfície `#f8f9f6`, cartão `#ffffff`, texto `#1b2220`, apagado `#4a5551`, linha `#d2d8d3`, destaque `#1d5b74`, destaque suave `#dbe8ec`, quente `#7d4a2e`, chip `#e2e7e3` |
| Cores de marcação | amarelo `#f3e3a0`, verde `#c4e0b8`, azul `#bed6e6`, rosa `#f0c8d4`, laranja `#f4d2b0`; no versículo: fundo da cor a 55% e barra de 4px à esquerda (amarelo `#d9b93a`) |
| Seletor (segmentos) | trilho `#e2e7e3`, padding 3px, raio 12px; opção raio 9px, 13px (celular) / 14px (computador), ativa: superfície, peso 700, sombra `0 1px 2px rgba(0,0,0,.12)` |
| Chip de alternar | altura 40px (38 no computador), padding 0 14px, raio 999px, 14px peso 400; ligado: fundo destaque e texto claro, **sem negrito e sem ✓** |
| Alvos de toque | 44×44px no mínimo |

## Celular (390×844)

### Barra de cima

- 56px, superfície, borda inferior 1px linha; padding 6px 12px.
- Título centralizado: “João 3” Literata 600 17px / 1,2; embaixo o tema, Atkinson 12px apagado; seta ⌄ 16px.
- (No protótipo de estudo: busca à direita, ícone 44×44 sem borda; à esquerda um espaço de 44px.)

### Cabeçalho do capítulo

- h1 “João 3” Literata 600 28px; ao lado o nome no original, Gentium 20px apagado.
- Tema do capítulo: Literata itálico 15px, cor destaque.
- Chips “Sobre João”, “Léxico”, “Perguntas 4”: altura 36px, padding 0 14px, raio 999px, superfície, borda 1px linha, 15px; o número em Plex Mono 12px apagado.
- Primeira abertura: caixa “Como você quer ler?” fundo `#dbe8ec`, padding 12px, raio 12px; título 14px 700; “Depois” 13px apagado; três botões 40px de altura, raio 10px, borda 1px destaque, 13px; Interlinear cheio (destaque).

### Versículo (modo Interlinear)

- Bloco: margem 0 −8px, padding 10px 8px 14px 12px, raio 12px; sombra interna de 4px à esquerda (transparente; da cor quando marcado). Sem borda.
- Número “3:16”: Literata 600 20px, destaque, botão 44px de altura; ponto de revisão 8×8px quente no canto.
- Menu ⋯: 44×44px, apagado, à direita.
- Cartão da palavra: fundo `#ffffff`, borda 1px linha com topo de 2px (quente quando tem revisão), raio 10px, padding 7px 9px 6px, espaço de 1px entre linhas; selecionado: borda destaque e anel de 2px.
  - original Gentium 21px / 1,2; transliteração Literata itálico 12px destaque; pronúncia e Strong Plex Mono 11px apagado; gramática Atkinson 11px apagado; glosa Atkinson 700 13px.
  - Ordem no modo Estudo: original, transliteração, pronúncia, Strong, gramática, glosa.
- Entre cartões: 6px.
- Bíblia Livre: “BLIVRE” Plex Mono 10px, espaçamento 0,08em, apagado; texto Literata 17px / 1,6.
- Faixa de anotação (quando há nota/etiqueta): botão superfície, borda 1px linha, raio 10px, padding 8px 10px; nota Literata 14px com ícone; etiquetas `#nome` 12px, fundo chip, padding 2px 9px, raio 999px.

### Modo Bíblia

- Um parágrafo só, Literata 17px / 1,8. Número do versículo sobrescrito, Atkinson 700 12px destaque, com ✎ # quando há nota/etiqueta.
- Versículo marcado: fundo da cor a 55%, raio 4px.
- Nota embaixo: “Toque no número do versículo para marcar, anotar ou ver o interlinear dele.” 13px apagado.

### Modo Original

- Texto corrido em Gentium 21px / 1,9; cada palavra é um botão (padding 2px 1px, raio 4px); número sobrescrito como no modo Bíblia.
- Nota: “Toque numa palavra para ver o verbete.” 13px apagado.

### Fim do capítulo

- “Perguntas ao texto” h2 Literata 600 20px; cartões superfície, borda 1px linha, raio 12px, padding 12px 14px, espaço 6px; cabeçalho Plex Mono 11px maiúsculo (“OBSERVE · 3:1–10”); pergunta Literata 15px; “Anotar resposta” 36px, raio 999px, borda linha, 13px destaque.
- “Léxico do capítulo”: lista numa caixa superfície (borda linha, raio 12px); cada linha 48px, padding 10px 14px: lema Gentium 18px, sentido 14px apagado, ocorrências Plex Mono 11px “143×”.
- Cartão “Próximo capítulo”: superfície, borda linha, raio 14px, padding 16px; “Próximo capítulo” 12px apagado, “João 4” Literata 600 18px, tema 13px apagado, seta ›.

### Barra de baixo

- 72px, superfície, borda superior 1px linha, padding 6px 6px 10px.
- Cinco botões em coluna (ícone em cima, nome embaixo, 12px): Livros · ‹ Jo 2 · Ouvir · Jo 4 › · Aa Aparência (“Aa” Literata 19px).
- Ouvir: fundo destaque, raio 14px, mais largo (1,2); tocando vira “Pausar”.
- Mini player ao tocar: faixa destaque, 48px, raio 12px, 8px das bordas, logo acima da barra: “Lendo João 3:16 · grego” e pausa.

### Folha Livros · Notas · Você (modal, sobe de baixo)

- Até 780px de altura, raio 20px em cima; fundo escuro atrás.
- Abas em seletor (3 segmentos, 13px) e ✕ 44px.
- **Livros:** rótulo “Buscar livro ou ir para uma referência” 13px apagado; campo 48px, fundo `#eceeea`, borda linha, raio 12px, 16px; seletor Antigo/Novo Testamento; grupos em Plex Mono 11px maiúsculo; livros em 2 colunas, botões 48px, raio 10px, borda linha, nome 15px e “28 cap.” Plex Mono 11px; livro atual: fundo `#dbe8ec`, borda destaque.
- **Grade de capítulos** (tocar no livro ou no título lá em cima): “‹ Livros” 14px destaque + nome Literata 700 20px; 6 colunas de 48px, Plex Mono 15px, raio 10px, borda linha; atual cheio (destaque); embaixo a lista de títulos (número Plex Mono 14px apagado + título 14px, linhas de 44px separadas por borda).
- **Notas:** busca 44px + botão ⋯ 44px com borda; filtros em chips 36px (Todas · Com nota · Favoritos · Marcadas, com contagem Plex Mono 11px); chips de etiqueta e “Gerenciar” (13px destaque); item: fundo `#eceeea`, borda linha, raio 12px, padding 12px 14px 12px 16px, barra de 4px da cor; referência 14px 700, nota Literata 15px, trecho Literata 13px apagado, etiquetas; “+ Nota livre (sem versículo)” 48px, borda tracejada destaque, raio 12px. Vazio: “Nenhuma anotação ainda” 16px 700 e instrução 15px apagado.
- **Você:** caixa Google Drive (fundo `#eceeea`, padding 16px, raio 14px; título 16px 700, texto 14px apagado, “Entrar com Google” 48px, raio 999px, superfície, borda); caixas “Meu progresso” e “Planos de leitura” (borda linha, raio 14px, padding 16px; planos em botões 48px, raio 10px, com ›).

### Folha Anotar (versículo)

- Abre pelo número ou pelo ⋯; o versículo sobe para o topo e fica visível acima da folha.
- Cabeçalho: “João 3:16” Literata 700 19px; trecho entre aspas Literata 13px apagado (2 linhas); ✕ 44px.
- Cores: 5 círculos de 48px + “Tirar a cor” 48px com borda; escolhida: borda 3px na cor do texto.
- Ações: grade de 4 blocos (Favoritar ☆ · Ouvir · Copiar · Interlinear αβ), 56px de altura, raio 12px, borda linha, 12px; ☆ 18px cor quente.
- NOTA (rótulo Plex Mono 11px; “Salvo” 12px destaque à direita); campo Literata 16px / 1,5, fundo `#eceeea`, borda linha, raio 12px, padding 10px 12px, 4 linhas.
- ETIQUETAS: etiquetas do versículo cheias (destaque) com “×”; campo “+ Adicionar etiqueta” 44px, borda tracejada, raio 999px; “Sugestões para começar” 12px apagado; sugestões `#nome` 36px, raio 999px, borda linha, 14px.
- “Apagar tudo deste versículo” 14px quente sublinhado (só com algo salvo).
- Rodapé com borda superior: “Pronto” 48px, raio 12px, destaque, 16px.

### Folha Verbete (sem fundo escuro)

- 420px, raio 20px em cima, borda superior linha, sombra `0 -10px 30px rgba(0,0,0,.12)`; o versículo sobe.
- ‹ e › 44×44 com borda, raio 12px; palavra Gentium 30px; “palavra 3 de 25 · João 3:16” 12px apagado; ✕.
- Linha: lema Gentium 14px · transliteração Literata itálico 14px destaque · pronúncia; “Ouvir” 36px, raio 999px, borda, 13px destaque.
- Caixa “Neste versículo”: fundo `#eceeea`, raio 12px, padding 12px 14px; rótulo 12px apagado; glosa Literata 600 22px; gramática 13px apagado.
- SIGNIFICADO (Literata 15px), COMO A BLIVRE TRADUZ (chips 13px, fundo chip, padding 4px 10px, contagem Plex Mono 11px), ORIGEM (14px).
- Rodapé com borda: “Strong G25 · 143 ocorrências” 12px apagado e “Marcar palavra” 36px, raio 999px.

### Folha Aparência (modal)

- “Aparência” Literata 700 20px e ✕.
- MODO DE LEITURA: seletor de 4 (Bíblia · Original · Interlinear · Estudo) e a explicação 13px apagado.
- O QUE MOSTRAR: Transliteração, Glosa, Pronúncia, Strong, Gramática, Bíblia Livre, Números, Tema do capítulo, Perguntas, Revisão ⚑, Minhas anotações.
- TEXTO: A− (14px) · “100%” Plex Mono 15px · A+ (19px), botões 48×44, raio 10px, borda; chips Fonte fácil, Espaçamento amplo, Cantilação (hebraico).
- TEMA: chips com bolinha de 16px (Automático, Claro, Papel, Oliva, Escuro, Noite, Grafite).
- ÁUDIO: Realçar cada palavra, Falar mais devagar.
- “Fontes e licenças” 14px destaque sublinhado.

## Computador (1280×800)

- Barra de cima 64px, superfície, borda inferior: “Livros” e “Notas” (44px, padding 0 14px, raio 999px, borda linha, 15px, ícone 18px); ‹ › 44px sem borda; título (“João 3” Literata 600 17px + tema 12px apagado) num botão de 220px; seletor de modo no meio (14px, opções 38px); “Ouvir” cheio (44px, raio 999px, padding 0 16px); botão da conta 44px redondo, fundo `#dbe8ec`, ícone destaque.
- Leitura: coluna de no máximo 760px, padding 28px 40px 48px. h1 Literata 600 34px + original Gentium 24px; tema itálico 15px e os chips na mesma linha (34px de altura).
- Versículo: padding 10px 12px 18px 16px, raio 14px; número Literata 600 20px; à direita “Anotar” (36px, raio 999px, borda linha, 13px apagado, ícone de lápis).
- Cartão: padding 8px 10px 7px; original Gentium 22px; Bíblia Livre Literata 18px / 1,6, máximo 640px.
- Versículo sendo anotado: contorno de 2px destaque.
- Perguntas em 2 colunas; léxico em 3 colunas.
- **Painel à direita, sempre visível:** 381px, superfície, borda esquerda linha. Abas Verbete · Anotar · Aparência em seletor (14px, 38px).
  - Verbete aberto na palavra selecionada (palavra Gentium 32px, glosa Literata 600 24px, teclado: “← → palavra · ↑ ↓ versículo · [ ] capítulo · Esc fecha” 12px).
  - Anotar: “João 3:16” Literata 700 20px; cores de 44px; Favoritar · Ouvir · Copiar em chips (38px, raio 999px, 13px); nota Literata 15px, ~135px de altura; campo de etiqueta 40px, “+ Adicionar etiqueta (Enter cria)”; sugestões 34px.
  - Aparência: explicação do modo (o seletor fica na barra), O QUE MOSTRAR (chips 38px), TEXTO (A− · 100% · A+ 48×40), TEMA, ÁUDIO.
- **Livros/Notas:** gaveta à esquerda, 440px de largura e altura toda, superfície, sombra `10px 0 30px rgba(0,0,0,.12)`, fundo escuro sobre o resto; conteúdo igual à folha do celular (abas 14px, livros em botões de 44px).
