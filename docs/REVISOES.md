# Catálogo de revisões automáticas

Cada verificação tem um código, o escopo em que roda, o tipo, a gravidade e a fonte de dados de que precisa. Erros barram a publicação; avisos vão para a fila de revisão humana.

Escopo: **P** palavra · **V** versículo · **C** capítulo · **L** livro · **B** Bíblia inteira
Tipo: **R** regra · **X** cruzamento · **IA** revisor automático
Gravidade: **E** erro · **A** aviso

## A. Integridade do texto-base

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| TXT-01 | Número de palavras por versículo igual ao da fonte | V | R | E | morphhb / SBLGNT |
| TXT-02 | Hash do texto consonantal por versículo (pega edição acidental) | V | R | E | morphhb / SBLGNT |
| TXT-03 | Unicode normalizado (NFC, ordem dos sinais) e só caracteres permitidos | P | R | E | — |
| TXT-04 | Ketiv/Qere: usa a forma lida (Qere) e registra a escrita (Ketiv) | P | R | A | morphhb |
| TXT-05 | Nenhum versículo faltando ou duplicado no capítulo | C | R | E | morphhb / SBLGNT |
| TXT-06 | Trechos em aramaico marcados como aramaico (detalhes no bloco L) | V | R | A | morphhb |

## B. Versificação e alinhamento com a BLIVRE

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| ALN-01 | Número de versículos por capítulo: hebraico/grego × BLIVRE | C | R | A | BLIVRE |
| ALN-02 | Diferenças de numeração conhecidas aplicadas pelo mapa de versificação | C | X | E | TVTMS (STEPBible, CC BY) |
| ALN-03 | Detector de deslocamento: glosas combinam mais com o versículo vizinho (±1) da BLIVRE | V | X | A | BLIVRE |
| ALN-04 | Títulos dos Salmos (v. 1 no hebraico = título na BLIVRE) | C | R | A | BLIVRE |
| ALN-05 | Versículo da BLIVRE vazio ou repetido | V | R | E | BLIVRE |

## C. Cobertura e completude

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| COB-01 | Toda palavra tem glosa | P | R | E | dados |
| COB-02 | Todo número Strong do texto tem verbete em português | P | R | E | léxico |
| COB-03 | Todo verbete tem origem, significado e traduções da KJV em português | L | R | A | léxico |
| COB-04 | Toda palavra tem transliteração e pronúncia em português | P | R | E | dados |
| COB-05 | Seções cobrem todos os versículos, sem sobreposição e sem buracos | C | R | E | seções |
| COB-06 | Todo capítulo tem tema; todo livro tem introdução | L | R | A | temas / intros |
| COB-07 | Nenhum texto em inglês esquecido (detector de idioma / lista de palavras) | P | R | A | léxico / glosas |

## D. Gramática × glosa — hebraico

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| GRA-01 | Conjunção prefixada → "e-", "mas", "pois"… | P | R | A | morfologia |
| GRA-02 | Artigo → o/a/os/as (exceto particípio com valor de "que") | P | R | A | morfologia |
| GRA-03 | Preposições prefixadas: ב → em/no/na/com; ל → para/a/ao; כ → como; מ → de/desde | P | R | A | morfologia |
| GRA-04 | Sufixo pronominal com pessoa, gênero e número certos (seu, dele, nos, lhe…) | P | R | A | morfologia |
| GRA-05 | Pessoa e número do verbo (3ª masc. sing. → ele; 1ª pl. → nós) | P | R | A | morfologia |
| GRA-06 | Tempo e modo: narrativo → pretérito; consecutivo → futuro; imperativo → imperativo; jussivo/coortativo → "haja", "façamos" | P | R | A | morfologia |
| GRA-07 | Infinitivo com ל → "para + infinitivo" | P | R | A | morfologia |
| GRA-08 | Particípio → gerúndio ou "que…" | P | R | A | morfologia |
| GRA-09 | Graus do verbo: passivos → "foi…"/"se…"; causativo → "fazer…"; reflexivo → "-se" | P | R | A | morfologia |
| GRA-10 | Plural → glosa no plural, com lista de exceções que só existem no plural (פָּנִים, מַיִם, שָׁמַיִם, אֱלֹהִים…) | P | R | A | morfologia |
| GRA-11 | Estado construto → termina em "de" ("face-de") | P | R | A | morfologia |
| GRA-12 | Marcador de objeto אֵת → `[obj]`, e `[obj]` só nele | P | R | E | morfologia |
| GRA-13 | Partículas com glosa fixa (כִּי que/porque/pois; הִנֵּה eis; לֹא não) | P | R | A | morfologia |

## E. Grego (Novo Testamento)

### E1. Texto e alinhamento

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| TXG-01 | Contagem de palavras e hash por versículo do texto-base grego | V | R | E | texto-base grego |
| TXG-02 | Normalização: acento agudo único (oxia → tonos), um só sinal de elisão, sigma final (ς) só no fim da palavra, interrogação (;) e ponto alto (·) padronizados | P | R | E | — |
| TXG-03 | Elisão e crase reconhecidas (δι’ = διά; κἀγώ = καί + ἐγώ "e eu") e glosadas pela forma plena | P | R | A | morfologia |
| ALG-01 | Versículos da BLIVRE sem correspondente no texto crítico: Mt 17:21; 18:11; 23:14; Mc 7:16; 9:44, 46; 11:26; 15:28; Lc 17:36; 23:17; Jo 5:4; At 8:37; 15:34; 24:7; 28:29; Rm 16:24 — exibir com nota, não tratar como erro | V | X | A | BLIVRE × texto-base |
| ALG-02 | Trechos menores presentes na BLIVRE e ausentes no texto crítico (ex.: Mt 6:13b; 1Jo 5:7–8) e trechos com tratamento editorial especial (Mc 16:9–20; Jo 7:53–8:11) marcados | V | X | A | BLIVRE × texto-base |
| ALG-03 | Diferenças de numeração no NT (3Jo 14–15; Ap 12:18 / 13:1; Rm 16:25–27; 2Co 13:12–14) aplicadas pelo mapa de versificação | C | X | E | TVTMS (CC BY) |
| ALG-04 | Escolha do texto-base: medir quanto a BLIVRE (revisão da Almeida 1819) segue o Textus Receptus; se seguir muito, avaliar um texto bizantino ou o Textus Receptus de Scrivener (1894), em domínio público, no lugar do SBLGNT | L | X | A | BLIVRE × textos gregos |

### E2. Gramática × glosa

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| GRG-01 | Artigo → o/a/os/as; artigo que substantiva (τὰ ἐν οὐρανοῖς "as coisas nos céus"); artigo como pronome (ὁ δέ "e ele") | P | R | A | morfologia |
| GRG-02 | Casos: genitivo → "de"; dativo → "a/para/com/em"; vocativo → "ó" | P | R | A | morfologia |
| GRG-03 | Genitivo absoluto → oração de tempo ("estando ele…") | V | R | A | morfologia |
| GRG-04 | Número: plural → glosa no plural | P | R | A | morfologia |
| GRG-05 | Pessoa e número do verbo, inclusive sujeito oculto (λέγει "diz") | P | R | A | morfologia |
| GRG-06 | Tempo e aspecto: imperfeito → "dizia"; aoristo → "disse"; perfeito → resultado presente ("tem feito", "está escrito"); futuro; mais-que-perfeito | P | R | A | morfologia |
| GRG-07 | Modo: subjuntivo (ἵνα "para que", ἐάν "se"); optativo (μὴ γένοιτο "de modo nenhum"); imperativo; infinitivo com artigo (τοῦ + inf. "para"; ἐν τῷ + inf. "enquanto") | P | R | A | morfologia |
| GRG-08 | Particípio: atributivo → "que…"; adverbial → gerúndio ou "tendo…" | P | R | A | morfologia |
| GRG-09 | Voz: média → "-se" ou ativa; passiva → "foi/é…"; verbos depoentes (ἔρχομαι, γίνομαι, πορεύομαι) com sentido ativo, por lista de exceções | P | R | A | morfologia + léxico |
| GRG-10 | Preposição × caso: διά (gen. "por meio de" / ac. "por causa de"), ὑπό (gen. "por" / ac. "debaixo de"), μετά (gen. "com" / ac. "depois de"), περί, ἐπί, παρά, κατά, πρός | P | R | A | morfologia |
| GRG-11 | Negação: οὐ/μή "não"; οὐ μή "de modo nenhum"; μή em pergunta que espera "não" | P | R | A | morfologia |
| GRG-12 | Conjunções e partículas: καί, δέ, γάρ, οὖν, ἀλλά, ἵνα, ὅτι (inclusive ὅτι que só abre uma fala) | P | R | A | morfologia |
| GRG-13 | Pronomes: αὐτός ("ele" × "mesmo"), reflexivos, possessivos, relativos, demonstrativos | P | R | A | morfologia |
| GRG-14 | Comparativo, superlativo e numerais | P | R | A | morfologia |
| GRG-15 | Nomes hebraicos indeclináveis (Ἀβραάμ, Δαυίδ) com a mesma forma usada no AT | P | X | A | AT + TIPNR |

### E3. Léxico, pronúncia e áudio

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| LXG-01 | Todo Strong grego (G1–G5624) com verbete em português; números que o Strong pulou (G2717 e G3203–G3302) nunca usados | P | R | E | Strong grego |
| LXG-02 | Lema da morfologia igual ao lema do verbete; definições conferidas com o TBESG (Abbott-Smith) | P | X | A | MorphGNT + TBESG |
| LXG-03 | Verbetes de verbos depoentes coerentes com GRG-09 | L | R | A | léxico |
| PRG-01 | Uma única convenção de pronúncia em todo o NT (erasmiana, a mais usada no ensino, ou a do grego moderno) | B | R | E | — |
| PRG-02 | Sílaba tônica da pronúncia = sílaba do acento grego (agudo, circunflexo ou grave), calculada do próprio texto | P | R | A | texto grego |
| PRG-03 | Ditongos (αι, ει, οι, ου), aspiradas (θ, φ, χ) e espírito áspero ("h") convertidos sempre do mesmo jeito | P | R | A | — |
| PRG-04 | Áudio: texto politônico convertido em monotônico antes da voz; aviso de que a voz disponível é a do grego moderno (el-GR) | P | R | A | — |

### E4. Cruzamentos

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| CRG-01 | Citações do AT no NT: lema grego ↔ lema hebraico com a mesma família de glosa; marcar quando o NT segue a Septuaginta e difere do hebraico | B | X | A | referências cruzadas |
| CRG-02 | Palavras aramaicas e hebraicas transliteradas no NT com nota de origem e glosa coerente com o léxico do AT: ταλιθα κουμ, ἀββα, ἐφφαθα, ἐλωι ἐλωι λεμα σαβαχθανι, μαρανα θα, ῥαββί, ἀμήν, ὡσαννά, ἀλληλουϊά, κορβᾶν, μαμωνᾶς, Γολγοθᾶ, Κηφᾶς | P | X | A | léxicos do AT |
| CRG-03 | Sinóticos (Mt, Mc, Lc): mesmas palavras gregas na mesma perícope → mesmas glosas | B | X | A | lista de perícopes |
| CRG-04 | Paralelos entre cartas: Ef ↔ Cl; 2Pe 2 ↔ Jd | B | X | A | lista de paralelos |
| CRG-05 | Nomes de pessoas e lugares iguais ao AT e à BLIVRE (Ἠσαΐας ↔ Isaías; Ἠλίας ↔ Elias) | B | X | A | TIPNR + BLIVRE |
| CRG-06 | Ponte hebraico ↔ grego pela Septuaginta (רוּחַ ↔ πνεῦμα; תּוֹרָה ↔ νόμος; חֶסֶד ↔ ἔλεος); usar o texto de Swete (domínio público), não o de Rahlfs, que é protegido | B | X | A | Septuaginta de Swete |

## F. Léxico e glosa

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| LEX-01 | Glosa compatível com o verbete (lematizador: "criou" ↔ "criar") | P | R | A | léxico |
| LEX-02 | Homônimos desambiguados (1254 a/b; dStrong do STEPBible) | P | X | A | TAHOT dStrongs |
| LEX-03 | Referências "de H215" existem e não são circulares | L | R | E | léxico |
| LEX-04 | Pronúncia bem formada (sílabas, tônica marcada) e com tantas sílabas quanto a transliteração | P | R | A | léxico |
| LEX-05 | Transliteração presente e só com caracteres permitidos | P | R | E | léxico |
| LEX-06 | Verbetes gregos conferidos com o TBESG | P | X | A | TBESG (CC BY) |
| LEX-07 | Classe do verbete (verbo, substantivo) bate com a morfologia das ocorrências | B | R | A | léxico + morfologia |

## G. Consistência interna

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| CON-01 | Mesma forma + mesma morfologia → mesma glosa (capítulo e livro) | L | R | A | dados |
| CON-02 | Concordância por lema: glosa rara para um lema que quase sempre é traduzido igual | B | R | A | dados |
| CON-03 | Expressões recorrentes com as mesmas glosas ("e disse Deus", "houve tarde e manhã", "assim diz o SENHOR") | B | R | A | dados |
| CON-04 | Estilo da glosa: hífens, minúsculas, sem espaços duplos nem pontuação, tamanho máximo | P | R | E | dados |
| CON-05 | Mesma pronúncia para o mesmo lema em todo lugar (inclusive exceções manuais) | B | R | A | léxico |

## H. Fatos verificáveis

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| FAT-01 | Nome próprio da glosa aparece igual no versículo da BLIVRE | V | X | A | BLIVRE |
| FAT-02 | Mesma pessoa ou lugar → mesmo nome em toda a Bíblia | B | X | A | TIPNR (STEPBible, CC BY) |
| FAT-03 | Números da glosa iguais aos da BLIVRE | V | X | A | BLIVRE |
| FAT-04 | Nomes divinos: YHWH → SENHOR; Adonai → Senhor; Elohim → Deus (ou "deuses" quando o contexto pede) | P | R | A | morfologia + BLIVRE |
| FAT-05 | Aritmética das introduções: datas da linha do tempo × idades citadas | L | R | E | introduções |
| FAT-06 | Toda referência citada em temas e introduções existe | L | R | E | introduções |
| FAT-07 | Versículos-chave idênticos ao texto da BLIVRE | L | R | E | BLIVRE |
| FAT-08 | Genealogias: idades e somas (Gn 5, 11) e paralelos (1Cr 1) | L | X | A | dados |
| FAT-09 | Medidas e unidades (côvado, siclo, efa) com glosa consistente | B | R | A | dados |

## I. Cruzamento entre livros

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| CRZ-01 | Alinhamento estatístico hebraico/grego ↔ BLIVRE na Bíblia inteira: glosa sem apoio no alinhamento | B | X | A | eflomal / fast_align |
| CRZ-02 | Paralelos do AT com glosas iguais onde o original é igual (lista abaixo) | B | X | A | lista de paralelos |
| CRZ-03 | Paralelos do NT: sinóticos (Mt, Mc, Lc), Ef ↔ Cl, 2Pe 2 ↔ Jd | B | X | A | lista de paralelos |
| CRZ-04 | Citações do AT no NT com palavras-chave da mesma família | B | X | A | referências cruzadas |
| CRZ-05 | Ponte hebraico ↔ grego: equivalentes com a mesma família em português (רוּחַ ↔ πνεῦμα "espírito"; תּוֹרָה ↔ νόμος "lei") | B | X | A | tabela de equivalências |
| CRZ-06 | Comparação com as glosas em inglês do STEPBible via dicionário inglês→português | P | X | A | TAHOT / TAGNT (CC BY) |
| CRZ-07 | Votação com tradução em domínio público (Tradução Brasileira 1917; Berean em inglês), só para controle interno | V | X | A | domínio público |
| CRZ-08 | Temas e seções compatíveis entre passagens paralelas | B | X | A | temas |
| CRZ-09 | Pessoas citadas nas introduções aparecem de fato nos capítulos indicados | L | X | A | texto + TIPNR |

### Passagens paralelas para CRZ-02

- Samuel e Reis ↔ Crônicas
- Sl 18 ↔ 2Sm 22
- Sl 14 ↔ Sl 53
- Sl 40:13–17 ↔ Sl 70
- Sl 108 ↔ Sl 57:7–11 + Sl 60:5–12
- 1Cr 16:8–36 ↔ Sl 105:1–15, Sl 96, Sl 106:1, 47–48
- Is 36–39 ↔ 2Rs 18:13–20:19
- Jr 52 ↔ 2Rs 24:18–25:30
- Gn 36 ↔ 1Cr 1:35–54
- Ed 2 ↔ Ne 7
- Êx 20 ↔ Dt 5 (Dez Mandamentos)
- Mq 4:1–3 ↔ Is 2:2–4
- Ob 1–9 ↔ Jr 49:7–22

(Referências na numeração das Bíblias em português; no hebraico algumas mudam, por exemplo Sl 40:14–18.)

## J. Revisão assistida por IA

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| IA-01 | Revisor por palavra com rubrica; responde ok, sugestão, motivo e confiança | P | IA | A | dados + STEPBible + BLIVRE |
| IA-02 | Revisor por versículo: as glosas em sequência fazem sentido frente à BLIVRE | V | IA | A | dados + BLIVRE |
| IA-03 | Revisor de temas e introduções: neutralidade, datas e afirmações sem base | L | IA | A | introduções |
| IA-04 | Dois revisores independentes; discordância vai para a revisão humana | P | IA | A | — |

## K. Publicação e qualidade técnica

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| PUB-01 | EPUB sem erros no epubcheck | L | R | E | — |
| PUB-02 | HTML válido e JSON de dados conforme o esquema | L | R | E | — |
| PUB-03 | Testes de teclado, foco e layout em 320, 400 e 900 px | L | R | E | Playwright |
| PUB-04 | Contraste mínimo de 4,5:1 em todos os temas | B | R | E | template |
| PUB-05 | Tamanho dos dados por livro dentro do limite do app | L | R | A | — |
| PUB-06 | Manifesto de fontes: todo dado usado tem crédito e licença; nenhuma fonte NC | B | R | E | docs/LICENCAS.md |
| PUB-07 | Texto enviado à voz sem marcas que atrapalhem a leitura | P | R | A | — |
| PUB-08 | Diferença de glosas entre versões (o que mudou desde a última revisão aprovada) | L | R | A | histórico |

## L. Aramaico (Gn 31:47; Jr 10:11; Ed 4:8–6:18; 7:12–26; Dn 2:4b–7:28)

| Código | Verificação | Escopo | Tipo | Grav. | Fonte |
|---|---|---|---|---|---|
| ARM-01 | Limites exatos de cada trecho, inclusive a troca no meio do versículo (Dn 2:4b) e as duas palavras de Gn 31:47 | V | R | E | morphhb |
| ARM-02 | Código de idioma aramaico na morfologia e decodificador com os graus verbais do aramaico (peal, pael, hafel/afel, hitpeel, hitpaal, shafel…), não os do hebraico | P | R | E | morfologia |
| ARM-03 | Estado enfático (determinado, sufixo -ā) → glosa com artigo; no aramaico ele faz o papel do artigo prefixado do hebraico | P | R | A | morfologia |
| ARM-04 | Partícula דִּי com glosas aceitas: "que", "o qual", "de" (posse), "porque" | P | R | A | morfologia |
| ARM-05 | Particípio usado como presente ou como narrativa ("respondeu e disse") seguindo uma regra de estilo única | P | R | A | morfologia |
| ARM-06 | Verbete do Strong precisa ser o aramaico (as entradas aramaicas trazem "(Aramaic)" na derivação), nunca o homônimo hebraico | P | R | E | Strong |
| ARM-07 | Ponte aramaico ↔ hebraico: o Strong indica "corresponding to H####"; a glosa deve ser da mesma família da palavra hebraica correspondente (ex.: H1934 "ser/haver" ↔ H1961) | P | X | A | Strong |
| ARM-08 | Origem em português traduz "corresponding to H####" como "aramaico, correspondente a H####" | L | R | A | léxico |
| ARM-09 | Fórmulas das cartas oficiais (Ed 4–7) e nomes de reis (Nabucodonosor, Belsazar, Dario, Artaxerxes, Ciro) iguais aos da BLIVRE e aos das partes em hebraico | L | X | A | BLIVRE + TIPNR |
| ARM-10 | Jr 10:11: as duas grafias de "terra" no mesmo versículo (אַרְקָא e אַרְעָא) com a mesma glosa | V | R | A | dados |
| ARM-11 | Áudio: não há voz aramaica; usar a voz hebraica e avisar que a pronúncia é aproximada | P | R | A | — |
| ARM-12 | Pronúncia em português pelo mesmo conversor do hebraico, com exceções próprias do aramaico (ex.: final enfático -ā) | P | R | A | léxico |

## Ordem sugerida de implementação

0. Novo Testamento: decidir o texto-base grego (ALG-04) antes de gerar glosas.
1. Bloqueantes baratos: TXT-01/05, TXG-01/02, COB-01/02/04/05, GRA-12, ARM-01/02/06, LXG-01, CON-04, FAT-06/07, PUB-01/06.
2. Maior retorno: CON-01/02, CRZ-01, FAT-01/03, GRA-01/02/03/10, GRG-01/02/06/10, ARM-03/07.
3. Revisor por IA (IA-01, IA-04) nos itens que sobrarem.
4. Cruzamentos de paralelos e citações (CRZ-02 a CRZ-05) quando houver vários livros.

## Implementação automática (scripts/review.py)

`python3 scripts/review.py [LIVRO [CAP]]` lê `build/biblia.sqlite` só para leitura (e, para TXT-01/02/04 e TXG-01, os arquivos originais em `sources/`, quando existem) e grava em `build/review/`: `marks.json` (uma marca por palavra ou versículo), `summary.tsv` (erros, avisos e informativas por capítulo) e `report.md` (totais por código e por livro, com 3 exemplos de cada código). Só biblioteca padrão, sem rede e sem IA; a Bíblia inteira roda em cerca de 25 s. Os níveis seguem o catálogo, com estas regras: regra que dispara em muitas palavras por motivo de estilo da BLIVRE (e não por erro da glosa) fica como `info`; erro comprovado de dados fica como `erro`, mesmo que o catálogo diga A.

| Código | O que verifica | Nível |
|---|---|---|
| TXT-01 / TXG-01 | Número de palavras e numeração contínua por versículo original, comparando com o morphhb / MorphGNT | erro |
| TXT-02 / TXG-01 | Texto consonantal (sem sinais) do versículo igual ao da fonte | erro |
| TXT-03 | Caracteres hebraicos permitidos; palavras fora da forma NFC (contagem por livro) | erro / info |
| TXT-04 | Forma escrita (Ketiv) no texto sem a forma lida (Qere), conferido no morphhb | aviso |
| TXT-05 | Capítulos ou versículos faltando; posições das palavras com buraco ou repetidas | erro |
| TXT-06 | Versículo de trecho aramaico sem nenhuma palavra aramaica | aviso |
| TXG-02 | Caracteres gregos permitidos, sigma final; sinais do aparato crítico (⸀ ⸂ ⸃ ⟦ ⟧) no texto, por capítulo | erro / aviso |
| TXG-03 | Crase (κἀγώ, κἀκεῖ, κἀκεῖνος…) glosada pela forma plena | aviso |
| ALN-01 | Versículo da BLIVRE sem texto original no AT | aviso |
| ALN-02 | Versículo de exibição que junta dois versículos originais; ordem do texto original quebrada; Ne 7:68 | info / erro |
| ALN-03 | Deslocamento: traduções usuais das palavras combinam mais com o versículo vizinho; BLIVRE muito mais longa ou curta que o original | aviso |
| ALN-04 | Títulos dos Salmos: título só de um lado; título em dois versículos hebraicos que caiu no v. 1 | aviso / erro |
| ALN-05 | Versículo da BLIVRE vazio ou igual ao anterior; palavras num versículo inexistente | erro |
| ALG-01 | Versículos da BLIVRE sem grego: da lista conhecida (info) ou fora dela (erro) | info / erro |
| ALG-02 | Trechos de tratamento especial (Mt 6:13b, 1Jo 5:7–8, Mc 16:9–20, Jo 7:53–8:11) e versículos com desproporção BLIVRE × grego | aviso |
| ALG-03 | Mapa de versificação do NT aplicado (2Co 13, At 19:40–41, 3Jo 14–15) | erro / info |
| ARM-01 | Palavra aramaica fora dos trechos; palavra hebraica dentro deles; Gn 31:47 com 2 palavras; troca em Dn 2:4b | erro / aviso |
| ARM-02 | Língua da palavra igual à da morfologia | erro |
| ARM-03 | Estado enfático aramaico sem artigo na glosa | info |
| ARM-04 | דִּי com glosa fora de que / o qual / de / porque | aviso |
| ARM-06 | Palavra aramaica com verbete sem a marca "(Aramaic)" | info |
| ARM-07 | Verbete aramaico "corresponding to H####" sem família comum com as traduções do hebraico | info |
| ARM-10 | Jr 10:11: as duas grafias de "terra" com a mesma glosa | aviso |
| COB-01 | Palavra sem glosa (erro); glosa só do prefixo (aviso) | erro / aviso |
| COB-02 | Palavra sem Strong ou com Strong inexistente (erro); verbete usado sem definição em português (info, uma vez por verbete) | erro / info |
| COB-03 | Verbete usado sem origem, significado ou traduções KJV | aviso |
| COB-04 | Verbete hebraico sem pronúncia | aviso |
| COB-07 | Palavra inglesa na glosa | aviso |
| GRA-01 | Conjunção ו sem conjunção na glosa | info |
| GRA-02 | Artigo ה sem artigo/determinante na glosa (exceto particípios e nomes) | info |
| GRA-03 | Preposições prefixadas ב ל מ (info) e כ (aviso) sem equivalente; infinitivos não contam | info / aviso |
| GRA-04 | Sufixo pronominal sem pronome/possessivo na glosa, ou com pronome de outra pessoa (exceto Adonai, kol, levad…) | aviso |
| GRA-05 | Verbo finito de 1ª pessoa do plural sem forma de "nós" | aviso |
| GRA-07 | Infinitivo construto com ל sem "para/a + infinitivo" (exceto לֵאמֹר) | info |
| GRA-10 | Substantivo plural com glosa no singular (exceto palavras só de plural) | info |
| GRA-12 | Partícula אֵת sem `[obj]` ou pronome (aviso); `[obj]` em outra palavra (erro) | aviso / erro |
| GRA-13 | לֹא / אַל sem negação; הִנֵּה sem "eis"; כִּי sem conjunção | aviso |
| GRG-01 | Artigo grego com glosa que não é artigo, preposição ou pronome; artigo plural no singular | aviso / info |
| GRG-04 | Substantivo grego plural com glosa no singular | info |
| GRG-05 | Verbo grego de 1ª pessoa do plural sem forma de "nós" | aviso |
| GRG-10 | διά, μετά, ὑπό glosadas com o sentido do outro caso | aviso |
| GRG-11 | οὐ, μή, οὐδέ, οὐδείς, οὐκέτι… sem "não/nem/nenhum" (μή aceita "porventura") | aviso |
| GRG-12 | καί, δέ, γάρ, οὖν, ἀλλά, ἵνα, ὅτι com glosa que não é conjunção | aviso / info |
| GRG-13 | ἐγώ, σύ, αὐτός glosados com pronome de outra pessoa | aviso |
| GRG-15 / CRG-05 | Nome grego "of Hebrew origin (H###)" glosado diferente do nome no AT (indeclinável → GRG-15) | aviso / info |
| CRG-02 | Transliterações (ἀμήν, ῥαββί, ὡσαννά, ἀββά…) com glosa fora da usual | aviso |
| LXG-01 | Strong grego fora de G1–G5624 ou nos números que o Strong pulou | erro |
| LXG-02 | Lema ligado ao Strong só por semelhança (strong_fonte = 'aprox') | aviso |
| LEX-03 | Derivação cita verbete inexistente (erro) ou é circular (aviso) | erro / aviso |
| LEX-05 | Verbete sem transliteração (erro) ou com caractere estranho (aviso) | erro / aviso |
| CON-01 | Mesma forma + morfologia (verbo, nome, adjetivo) no livro com glosa minoritária sem raiz comum com a usual | aviso |
| CON-02 | Glosa rara (< 1 %) para um Strong de conteúdo traduzido quase sempre igual; Strong polissêmico → info | aviso / info |
| CON-04 | Estilo: espaço, pontuação, hífen solto (erro); maiúscula no meio, palavra repetida, glosa longa (aviso) | erro / aviso |
| FAT-01 | Nome próprio da glosa ausente do versículo da BLIVRE (aviso); nome próprio glosado em minúsculas (info) | aviso / info |
| FAT-02 | Mesmo Strong de nome próprio com nome diferente do usual na Bíblia | aviso |
| FAT-03 | Número da glosa ausente da BLIVRE; numeral cardinal sem número na glosa | aviso |
| FAT-04 | YHWH → SENHOR/DEUS; Adonai → Senhor; Elohim → Deus/deuses; Yah | aviso |
| FAT-09 | Medidas (côvado, siclo, efa, him, coro, ômer, bato, mina…) com glosa da unidade | aviso |
| CRZ-01 | Glosa por léxico/parcial sem nenhuma palavra no versículo da BLIVRE | info |
| CRZ-02 | Paralelos do AT (lista acima, mais 2Sm 7 ↔ 1Cr 17 e 1Rs 8 ↔ 2Cr 6): mesma forma + morfologia com glosas sem raiz comum | aviso |
| CRZ-03 | Paralelo 2Pe 2 ↔ Jd, mesmo critério | aviso |
| CRZ-05 | Ponte hebraico ↔ grego (רוּחַ/πνεῦμα, תּוֹרָה/νόμος, חֶסֶד/ἔλεος…) sem família comum nas glosas mais usadas | aviso / info |

A comparação de glosas usa uma raiz aproximada do português (prefixo de 3–4 letras, plural, verbos irregulares) e uma pequena lista de sinônimos que a BLIVRE alterna (aconteceu/sucedeu, homem/pessoa…), para não marcar variação de estilo como divergência. Ficam de fora, por depender de dados ou ferramentas que o banco não tem: TXT/ALN com TVTMS (ALN-02 completo, ALG-03 completo), ALG-04, COB-05/06 (seções e temas), GRA-06/08/09/11, GRG-02/03/06–09/14, PRG-*, LEX-01/02/04/06/07, CON-03/05, FAT-05–08, CRG-01/03/04/06, CRZ-04/06–09, IA-*, PUB-* e ARM-05/08/09/11/12.
