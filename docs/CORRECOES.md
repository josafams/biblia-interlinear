# Guia de correção de texto

Como corrigir glosas, verbetes, temas e introduções, e como a correção chega ao site, ao app, ao EPUB e ao PDF.

## Regra de ouro

**Corrige-se sempre a fonte em `dados/`, nunca o que é gerado.** Tudo em `saida/` (banco, site, EPUB, PDF) e o ramo
`gh-pages` são refeitos a partir de `dados/` e das fontes abertas. Uma correção feita direto no site ou no banco some
na próxima geração.

## Onde fica cada texto

| O que corrigir | Arquivo | Como achar a linha |
|---|---|---|
| **Glosa de uma palavra** | `dados/correcoes/glosas.tsv` (acrescentar uma linha) | `python3 scripts/consulta.py interlinear JHN 1:1` mostra a posição de cada palavra |
| **Verbete do léxico** (origem, significado) | `dados/lexico_pt/*.tsv` | `python3 scripts/consulta.py verbete H430` diz o arquivo e a linha |
| **Tema de um capítulo** | `dados/temas/<LIVRO>.tsv` | linha = número do capítulo + 1 |
| **Introdução "Sobre o livro"** | `dados/livros/<LIVRO>.json` | campos descritos em [`ESQUEMA_LIVRO.md`](ESQUEMA_LIVRO.md) |
| **Erro de digitação na BLIVRE** | `dados/correcoes/blivre.tsv` (só registro; ver abaixo) | — |
| **Glosas de Gênesis 1** (revisadas no protótipo) | `dados/glosses_pt.tsv` | por forma hebraica + morfologia |
| **Regras gerais de glosa** (artigos, preposições, nomes próprios, YHWH) | `scripts/glosar.py` | para programadores; vale para a Bíblia toda |

Códigos dos livros: os de três letras usados em todo o projeto (`GEN`, `EXO`, … `PSA`, … `MAT`, `JHN`, … `REV`);
`python3 scripts/consulta.py livros` lista todos.

## Como corrigir cada tipo

### Glosa

1. Veja a posição da palavra:

   ```
   $ python3 scripts/consulta.py interlinear JHN 1:1
   1:1  No princípio era a Palavra, e a Palavra estava junto de Deus, e a Palavra era Deus.
      1  Ἐν      G1722  no         (alinhamento)
      …
     10  πρὸς    G4314  a          (lexico)
     11  τὸν     G3588  de         (alinhamento)
     12  θεόν,   G2316  Deus       (alinhamento)
   ```

   A última coluna diz de onde a glosa veio: `alinhamento` (da BLIVRE), `lexico` (tradução mais comum), `regra`,
   `manual` (Gênesis 1) ou `revisada` (já corrigida por alguém).

2. Acrescente uma linha em `dados/correcoes/glosas.tsv` (colunas separadas por **tabulação**):

   | ref | pos | original | glosa | revisor | nota |
   |---|---|---|---|---|---|
   | JHN 1:1 | 10 | πρὸς | junto-de | seu nome | πρός com acusativo |

   - `original`: a palavra como está no texto. Serve de conferência: se um dia a posição mudar, a correção é
     ignorada com aviso em vez de cair na palavra errada. Vogais, acentos e pontuação não importam.
   - `glosa`: palavras unidas por hífen, sem espaços (`junto-de`, `e-disse`). `—` para palavra sem equivalente.
   - Uma linha por palavra. A correção vale só para aquela ocorrência; para mudar a regra de uma palavra em toda a
     Bíblia, abra uma *issue* descrevendo o caso.

3. A glosa corrigida aparece no app sem o itálico cinza (como revisada).

### Verbete do léxico

`python3 scripts/consulta.py verbete H430` mostra o verbete, o original em inglês do Strong e o arquivo/linha em
português. Edite as colunas `origem` e `significado` desse arquivo. Mantenha as referências (`H119`, `G109`) exatamente
como estão: viram links no app. O significado deve continuar fiel ao Strong (domínio público); não copie de
dicionários modernos com direitos autorais.

### Tema de capítulo

Em `dados/temas/<LIVRO>.tsv`, troque o texto da coluna `tema`. De 2 a 8 palavras, sem ponto final, texto próprio
(não copie títulos de seção de traduções protegidas, como NVI, ARA ou NTLH).

### Introdução do livro

Edite `dados/livros/<LIVRO>.json` (um editor que valide JSON ajuda). Anos são inteiros com sinal: `-1446` = 1446 a.C.,
`57` = 57 d.C. Versículos-chave devem ser cópia exata da BLIVRE (`python3 scripts/consulta.py versos GEN 12:1-3`).
Em pontos disputados (autoria, datas), apresente as posições principais sem tomar partido.

### Erro na BLIVRE

O texto da Bíblia Livre é reproduzido **sem alterações** (é o combinado com a licença e com os autores). Erros de
digitação encontrados são registrados em `dados/correcoes/blivre.tsv` com `status = relatar`, para serem enviados aos
tradutores (https://sites.google.com/site/biblialivre/). Quando a correção sair numa nova edição da BLIVRE, ela entra
no projeto pelo `baixar_fontes.sh`, e o status passa a `corrigido-na-fonte`.

## Fluxo

```
achar o problema ──► corrigir em dados/ ──► conferir ──► pull request ──► revisão ──► merge na main ──► publicar
   (app ⚑, relatório,    (num ramo novo)     (verificar_dados,  (o GitHub roda      (outra pessoa,   (site, app,
    leitura, issue)                            build local)       a verificação)      se possível)     EPUB, PDF)
```

### 1. Achar o problema

- **No app:** ⚑ ao lado do versículo lista o que a revisão automática encontrou; glosas em itálico cinza não vieram do
  alinhamento direto e são as primeiras a revisar.
- **No relatório:** `saida/revisao/relatorio.md` (gerado pelo `build.sh`), com exemplos por tipo de problema; o
  catálogo dos códigos está em [`REVISOES.md`](REVISOES.md).
- **Leitura:** quem lê hebraico ou grego revisa livro a livro, começando por Gênesis, Salmos e os Evangelhos.
- **Issues no GitHub:** quem não edita arquivos pode abrir uma *issue* com a referência (`Jo 1:1, palavra 10`), o que
  está e o que deveria estar.

### 2. Corrigir

**Pelo navegador (sem instalar nada):** no GitHub, abra o arquivo em `dados/`, clique no lápis, edite e escolha
*Create a new branch … and start a pull request*. O GitHub roda o `verificar_dados.py` no pull request e mostra ✓ ou ✗.

**No computador:**

```sh
git checkout -b correcao-jo-1        # um ramo por lote de correções
# edite os arquivos em dados/
python3 scripts/verificar_dados.py   # formato, colunas, referências; com o banco, confere as palavras e citações
python3 scripts/glosar.py            # aplica as correções de glosa no banco (≈1 min; o alinhamento é reaproveitado)
python3 scripts/consulta.py interlinear JHN 1:1   # confira o resultado
PDF=0 scripts/build.sh               # opcional: refaz site e EPUB para ver no navegador (saida/web/index.html)
git add dados/ && git commit -m "Glosas de Jo 1:1"
git push -u origin correcao-jo-1     # depois abra o pull request no GitHub
```

Prefira pull requests pequenos (um capítulo, um livro, um tipo de correção): ficam fáceis de revisar.

### 3. Revisão e merge

Outra pessoa confere o pull request (de preferência quem lê a língua original) e faz o *merge* na `main`. A
verificação automática precisa estar verde.

### 4. Publicar

Depois do merge, quem mantém o projeto gera e publica:

```sh
git checkout main && git pull
scripts/build.sh                     # banco, glosas, revisões, site, EPUB e PDF
scripts/publicar_web.sh "Correções de Jo 1"
```

- O `publicar_web.sh` envia o site ao ramo `gh-pages`: o **site** é atualizado em 1–2 minutos e o **app Android** é
  recompilado sozinho (Actions › Android), com o APK novo na release **app-android**.
- **EPUB e PDF:** quando houver correções suficientes, publique uma nova release com os arquivos de `saida/epub` e
  `saida/pdf` (`gh release create livros-AAAA-MM-DD saida/epub/*.epub saida/pdf/*.pdf`).

## Detalhes técnicos que importam para quem corrige

- **As glosas automáticas são estáveis.** O alinhamento estatístico (eflomal) é aleatório; por isso o resultado fica
  salvo em `dados/alinhamento/*.links.gz` e é reaproveitado, e uma correção não muda outras glosas. Ele só é refeito
  se o texto de entrada mudar (nova edição da BLIVRE ou do original) ou com `REALINHAR=1`; nesse caso as correções de
  `glosas.tsv` continuam valendo, mas revise o relatório, porque glosas automáticas de outros lugares podem mudar.
- **Ordem de aplicação das glosas:** alinhamento → tradução mais comum e regras → ajustes (nomes, YHWH) → Gênesis 1
  revisado (`glosses_pt.tsv`) → `dados/correcoes/glosas.tsv` (vale sempre por último).
- **Licença das contribuições:** quem contribui concorda que o texto entra sob a licença dos dados do projeto
  (CC BY-SA, ver [`LICENCAS.md`](LICENCAS.md)).
