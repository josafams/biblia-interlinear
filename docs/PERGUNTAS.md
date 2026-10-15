# Perguntas ao texto

No fim de cada capítulo, o leitor mostra de 3 a 5 perguntas **sem respostas**, para pensar sozinho ou conversar em grupo. Quem lê pode guardar a própria resposta numa nota ("Anotar resposta"). As perguntas ficam em `data/questions/<LIVRO>.tsv`, uma linha por pergunta; `python3 scripts/check_data.py` confere o formato e os versículos.

## Formato

| Coluna | Conteúdo |
| --- | --- |
| `chapter` | número do capítulo |
| `kind` | `observation`, `interpretation`, `application` ou `original` |
| `verses` | versículo ou intervalo dentro do capítulo (`5` ou `5-8`); pode ficar vazio |
| `strong` | só no tipo `original`: o número Strong da palavra (`H7725`, `G3056`) |
| `question` | a pergunta, terminando com `?`, até 240 caracteres |

Exemplo completo: [`data/questions/RUT.tsv`](../data/questions/RUT.tsv).

## Regras

- **3 a 5 perguntas por capítulo**, normalmente 4: pelo menos uma de observação, uma de interpretação e uma de aplicação; a de língua original quando houver uma palavra que valha a pena (quase sempre há).
- **Observação** (`observation`): o que o texto diz — quem, onde, quando, o que acontece, o que se repete, o que contrasta. Deve dar para responder só lendo o capítulo.
- **Interpretação** (`interpretation`): o sentido — por que algo é dito ou feito, a ligação com o resto do livro ou da Bíblia, o que uma imagem significa.
- **Aplicação** (`application`): o que o texto pode mudar para quem lê hoje, em segunda pessoa ("você"), sem impor uma resposta.
- **Língua original** (`original`): aponta uma palavra hebraica, aramaica ou grega do capítulo, com a palavra no alfabeto original e a transliteração simples entre parênteses — "O verbo שׁוּב (shuv, “voltar”)…". A palavra tem de aparecer nos versículos indicados; `python3 scripts/query.py words <LIVRO> <cap>` lista as palavras-chave do capítulo com o Strong e os versículos.
- **Nunca dar a resposta** dentro da pergunta, nem induzir uma resposta só ("Não é verdade que…?").
- **Tom neutro entre as tradições cristãs** e respeitoso com a leitura judaica do Antigo Testamento: nada de doutrina de uma denominação dada como certa. Em textos difíceis (violência, maldições, leis antigas), perguntar com honestidade sobre o que o texto diz e como lê-lo hoje.
- Citar o texto pela **Bíblia Livre** (`python3 scripts/query.py chapter <LIVRO> <cap>`), entre aspas curvas “ ”, só trechos curtos.
- Português do Brasil, frases curtas, sem jargão; nomes como na Bíblia Livre.
- Os versículos indicados têm de existir no capítulo (a numeração é a das Bíblias em português).
