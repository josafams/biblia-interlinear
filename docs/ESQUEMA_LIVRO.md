# Introdução de cada livro e temas dos capítulos

Arquivos escritos para o projeto (texto original, licença do projeto). Nada copiado de Bíblias de estudo,
introduções ou títulos de seção de edições com direitos autorais (NVI, ARA, NTLH, NVT, etc.).
Citações bíblicas: só da BLIVRE, copiadas exatamente de `python3 scripts/consulta.py versos LIVRO C:V`.

## `dados/temas/<COD>.tsv`

```text
cap tema
1 O chamado de Abrão
2 …
```

Um tema por capítulo, na numeração da BLIVRE (a das Bíblias em português; confira com
`python3 scripts/consulta.py livros`). De 2 a 8 palavras, português do Brasil, descrevendo o
assunto principal do capítulo. Sem ponto final.

## `dados/livros/<COD>.json`

Modelo completo: `dados/livros/GEN.json`. Campos:

| Campo | Conteúdo |
|---|---|
| `title_orig`, `title_orig_xlit` | título na língua original (hebraico com vogais; grego) e transliteração |
| `summary` | do que o livro trata (3 a 6 frases; 2 a 3 em livros curtos) |
| `name` | origem do nome do livro (1 a 3 frases) |
| `facts` | pares `[rótulo, valor]`: `Posição`, `Língua original`, `Gênero`. Capítulos e versículos entram sozinhos |
| `structure` | partes do livro: `{ "title", "from", "to", "text" }` (`from`/`to` = capítulos) |
| `extra` | opcional: `{ "title", "text" }` para um traço literário marcante (ex.: as *toledot* de Gênesis) |
| `people` | pessoas principais: `{ "name", "chapters": "3–14", "ch": 3, "note" }` (`ch` = capítulo para abrir) |
| `writing` | `{ "tradition": "...", "academic": "..." }`: autoria e data segundo a tradição e segundo a pesquisa |
| `events` | `{ "intro", "axis": [de, até], "band"?: { "label", "from", "to" }, "timeline": [ { "label", "from", "to", "kind", "note" } ] }` |
| `context` | contexto histórico e geográfico (1 parágrafo) |
| `places` | lugares principais (lista de textos) |
| `themes` | temas (lista curta de palavras-chave) |
| `key_verses` | `{ "ref": "12:1–3", "text": "…" }` — 2 a 4 trechos, texto exato da BLIVRE |
| `note` | opcional: observação sobre datas ou fontes |

**Anos:** números inteiros com sinal — negativo = antes de Cristo (−1446 = 1446 a.C.), positivo = depois de Cristo
(57 = 57 d.C.). Em `axis` e em cada item, `from` ≤ `to`. `kind`: `pessoa`, `evento` ou `escrita`.
Datas incertas: use a faixa mais aceita e diga no texto que é aproximada; quando tradição e pesquisa
divergem, apresente as duas posições com neutralidade.
