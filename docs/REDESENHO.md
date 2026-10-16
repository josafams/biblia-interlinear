# Redesenho do leitor (proposta)

Proposta de layout, navegação e anotações para o leitor (`ler.html`), com **as mesmas funções de hoje**, menos poluição visual e menos toques. Nada é removido: cada função muda de lugar ou fica a um toque.

- **Protótipos:** os arquivos `.dc.html` em [`redesenho/`](redesenho/) são os quadros do canvas de design (diagnóstico, celular, desktop, fluxo, anotações). Eles rodam no editor de design do Claude, não sozinhos no navegador.
- **Dados dos protótipos:** reais, de João 3:16–17 (glosas, morfologia, léxico em português e as 4 perguntas do capítulo). Os outros capítulos mostram um espaço reservado.
- **Situação:** proposta; nada disto está implementado em `web/`.

## Como foi medido

Site local (ramo `gh-pages`) aberto com navegador automatizado, em João 3, modo Interlinear, telas de 390×844 (celular) e 1280×800 (desktop). Onde há estimativa, o texto diz.

## Diagnóstico

| Prioridade | Problema | Medido |
|---|---|---|
| Alta | A primeira tela não mostra a Bíblia | No celular, o 3:1 começa a 561 px; antes vêm dicas de teclado, “Como você quer ler?” e “Sobre o livro” |
| Alta | O verbete esconde o versículo | Folha de 1280×576 px (72% da tela) no desktop e 608 px no celular; para ver a palavra seguinte é preciso fechar e tocar de novo |
| Alta | Mudar de capítulo é caro | 3 toques (Índice → livro → capítulo); “João 4 →” só depois de 27 telas e das fontes e licenças |
| Alta | Cartões pesados | 4 linhas por palavra (Strong sempre visível); “Ouvir” fixo em cada um dos 36 versículos; João 3 ocupa 23.181 px no celular |
| Média | Painel Aa longo | 37 controles, 20 interruptores, 2,9 telas; “Transliteração” a 2.142 px do topo |
| Média | Índice mistura conta, busca e livros | “Entrar com Google” antes dos livros; “Minhas anotações” a 2.386 px; livros só por abreviação |
| Média | Revisão ⚑ com códigos internos | “GRG-05”, “CON-01” aparecem para quem lê e desmontam a linha do versículo |
| Média | Tema em dois lugares | ☀/☾ na barra e 7 temas no Aa; a referência no celular vira “Jo 3:1 · Nico…” |
| Baixa | Alvos de toque pequenos | ⋯ do versículo com 38×36 px; ☀ e ☾ com 40×40 px |
| Baixa | Glosas quebradas e rodapé repetido | “testemunham / os”; fontes e licenças no fim dos 1.189 capítulos |

Achado nos dados: em João 3:1 a glosa de Νικόδημος é “cujo” (efeito do alinhamento automático).

## Proposta de layout

- **Cabeçalho de 2 linhas.** Título e tema do capítulo; “Sobre João”, “Léxico” e “Perguntas” viram chips. A escolha do modo, na primeira vez, é uma faixa de uma linha. Dicas de teclado só no desktop, no painel do verbete.
- **Celular: barra inferior fixa.** Livros · ‹ · Ouvir · › · Aparência. O título do capítulo abre direto a grade de capítulos do livro.
- **Desktop: painel lateral fixo** com três abas — Verbete, Anotar, Aparência — que nunca cobre o texto. O seletor de modo fica na barra superior.
- **Cartões com 3 linhas no Interlinear** (original, transliteração, glosa). Strong, pronúncia e gramática ficam no modo Estudo ou em “O que mostrar”.
- **Um único “Ouvir”**, que lê a partir do versículo na tela e realça cada palavra; ouvir um versículo só fica no painel do versículo.
- **Verbete:** meia folha no celular (o versículo continua visível acima) e painel lateral no desktop, com ‹ › para passar de palavra. Significado primeiro, Strong por último.
- **Aparência (Aa) em 5 grupos:** modo (4 opções), “O que mostrar” em chips sem rolagem, texto, tema e áudio. “Fontes e licenças” vira um link.
- **Índice em abas:** Livros · Notas · Você. Uma busca só, que filtra livros (“cânt”) e entende referências (“Jo 3:16”, “salmos 23”, “1Jo 4:8”). Nomes completos dos livros.
- **Revisão ⚑:** um ponto âmbar no número do versículo; explicação em português no painel; o código só em “detalhes técnicos”.

## Anotações e etiquetas

Teste no site atual: marcar João 3:16, criar as etiquetas “promessas” e “amor de Deus” e escrever uma nota.

| Hoje | Proposta |
|---|---|
| O versículo vira dois itens em “Minhas anotações” (nota e marcação) | Uma anotação por versículo: cor, favorito, nota e etiquetas juntas |
| As etiquetas ficam só na marcação; a nota fica sem elas e some do filtro | As etiquetas valem para o versículo inteiro |
| Na leitura, só o “3:16” fica amarelo | Barra de cor à esquerda e uma faixa sob o versículo com ★, a primeira linha da nota e as #etiquetas |
| A nota abre em outra tela, em tela cheia | Nota no mesmo painel, salva sozinha (“Salvo”) |
| 5 linhas de controles antes da primeira anotação | Busca (aceita “#oração”), filtros com contagem e chips de etiqueta; PDF, backup e importar no menu ⋯ |
| Sem renomear nem apagar etiquetas | “Gerenciar etiquetas”: renomear (se o nome existe, junta as duas) e apagar com confirmação |

Detalhes do painel “Anotar”: digitar filtra as etiquetas existentes e Enter cria; sem diferença entre maiúsculas e minúsculas e o `#` é opcional; as mais usadas aparecem primeiro; sem nenhuma etiqueta, aparecem 4 sugestões; apagar tudo de um versículo mostra “Desfazer”; “Anotar resposta” das perguntas abre o mesmo painel.

### Implementação sugerida

1. **Agrupar só na interface (primeiro).** As coleções do IndexedDB (marcações, notas, favoritos) e os lotes do Google Drive continuam iguais. A tela agrupa por versículo, e a etiqueta escolhida no painel é gravada em todos os registros daquele versículo.
2. **Registro único por versículo (depois).** Modelo mais limpo, mas exige migração dos dados e mudança no formato dos lotes de `web/sync.js`.

## Toques por tarefa

“Hoje” foi medido no site local; “Proposta” conta toques nos protótipos.

| Tarefa | Hoje | Proposta |
|---|---|---|
| Ver o 1º versículo ao abrir (celular) | rolar 561 px | sem rolar |
| Próximo capítulo | 3, ou rolar 27 telas | 1 |
| Outro capítulo do mesmo livro | 3 | 2 |
| Capítulo de outro livro | 3 | 3 |
| Ir para Jo 3:16 | 1 + digitar + Ir | 1 + digitar + Ir |
| Ver o significado de uma palavra | 1 (cobre o texto) | 1 (texto visível) |
| Palavra seguinte no verbete | 2 | 1 |
| Trocar o modo de leitura | 2 | 2 (desktop: 1) |
| Desligar a transliteração | 2 + rolar 2,5 telas | 2 |
| Cor + etiqueta + nota no mesmo versículo | 6, em 2 telas | 4, num painel |
| Ver tudo de #promessas | 4 + rolar 2,8 telas | 3 |
| Renomear ou apagar uma etiqueta | não existe | 3 |
| Abrir minhas anotações | 2 + rolar 2,8 telas | 2 (desktop: 1) |
| Entrar com Google | 2 | 3 no celular (de propósito: é opcional e se faz uma vez) |

## Ordem sugerida para implementar

1. Cabeçalho compacto e barra inferior com ‹ › (maior ganho, pouco risco).
2. Verbete lateral/meia folha com ‹ ›.
3. Painel “Anotar” unificado e faixa de anotações no versículo.
4. Aa em grupos e Índice em abas.
5. Revisão ⚑ em português e ajustes de alvos de toque.

Cada etapa precisa de testes Playwright em `tests/web/` nos dois tamanhos de tela, como pede o [CONTRIBUTING](../CONTRIBUTING.md).
