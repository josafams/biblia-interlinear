# Testes e vídeos

## Testes automáticos

Rodam no GitHub em todo pull request e envio à `main` (workflow **Testes**). Para rodar no computador,
depois de gerar os dados e o site (`scripts/build.sh`, ou `corpus.py` + `make_glosses.py` + `npm run build:web`):

```bash
pip install pytest pypdf
npm ci
npm test              # tudo
npm run test:data    # só os dados (pytest), em segundos
npm run test:web      # só o site no navegador (Playwright)
```

| Onde | O que confere |
|---|---|
| `tests/test_data.py` | 66 livros, 1.189 capítulos, 31.166 versículos, 443.123 palavras; toda palavra com glosa; todo Strong com verbete; temas e introduções; Gn 1:1, Jo 1:1, YHWH “EU-SOU”, Rm 16:25–27, ketiv/qere; correções de `data/corrections/glosses.tsv` aplicadas; retrato das glosas |
| `tests/test_units.py` | funções do `make_glosses.py` (contrações, nomes próprios pela transliteração) |
| `tests/test_books.py` | EPUB de Rute (estrutura, notas por palavra, epubcheck quando instalado) e PDF de Rute (marcadores) |
| `tests/web/home.spec.mjs` | página inicial: amostra, números, links do repositório, APK, iOS, EPUB e PDF, seção Como usar, links antigos |
| `tests/web/reader.spec.mjs` | leitor: índice, Ir para, capítulos, verbete, léxico, grego, aparência guardada, Sobre o livro, uso offline |
| `tests/web/accessibility.spec.mjs` | axe-core: nenhum problema grave de acessibilidade |
| `tests/web/modes.spec.mjs` | modos de leitura e itens visíveis |
| `tests/web/annotations.spec.mjs` | marcar com cores, notas, favoritos, etiquetas, Minhas anotações |
| `tests/web/notebook.spec.mjs` | caderno em PDF, baixar e importar meus dados |
| `tests/web/account.spec.mjs` | login com Google (simulado): entrar, permissão do Drive, sair, sugestão depois da 1ª anotação |
| `tests/web/progress.spec.mjs` | Meu progresso: capítulo lido ao chegar ao fim, tempo só com atividade, soma entre aparelhos, sequência e recorde, plano de leitura (em dia, atrasado, reajustar), zerar, convite sem conta |
| `tests/web/sync.spec.mjs` | sincronização entre 2 e 3 aparelhos simulados: ida e volta, exclusão, primeiro login, conflito de notas, relógio errado, compactação e aparelho novo, modo de leitura, sair e apagar da nuvem |

O Google é simulado em `tests/web/fake-google.mjs` (login e uma API do Drive em memória, compartilhada entre os "aparelhos"); nada sai para a internet.

Os testes do navegador rodam no tamanho de celular e de computador.

### Retrato das glosas

`tests/snapshot.json` guarda um resumo das glosas de cada livro. Se uma mudança alterar glosas, o teste
`test_retrato` falha e diz quais livros mudaram. Se foi de propósito (uma correção, por exemplo):

```bash
python3 tests/snapshot.py --update
```

e envie o `tests/snapshot.json` junto com a mudança.

### Proteger a main

No GitHub: *Settings › Branches › Add rule* para `main`, marcando *Require status checks to pass* e o check
**testes**. Assim nada entra na `main` com teste falhando.

## Vídeos “Como usar”

Cada vídeo é um roteiro em `scripts/videos/roteiros.mjs`: uma lista de passos, cada um com a legenda e a
ação (tocar, digitar, rolar…). `scripts/videos/gravar.mjs` executa os roteiros no site e grava a tela
(celular 390×844 e computador 1280×800), gerando MP4, WebM, legendas WebVTT e capa em `build/videos`.
A página inicial mostra a lista de vídeos (dos roteiros) e toca os que já foram gravados.

```bash
node scripts/videos/gravar.mjs --verificar   # só executa os roteiros (rápido; também roda nos testes)
node scripts/videos/gravar.mjs               # grava todos (precisa do ffmpeg)
node scripts/videos/gravar.mjs 05 12         # grava só esses
npm run build:web                   # copia build/videos para o site
```

No GitHub, o workflow **Vídeos** grava de novo depois de cada publicação do site (workflow **Site**) e publica em `gh-pages/videos`.
Ao mudar a tela, ajuste o roteiro do vídeo correspondente; se um passo não funcionar mais, os testes avisam.

Para um vídeo de uma função nova: acrescente os passos ao item com `pronto: false` em `roteiros.mjs` e tire o `pronto: false`.
