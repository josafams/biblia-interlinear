# 0005. O formato dos dados guardados não muda de idioma

- Situação: aceita (outubro de 2026); substitui, nesse ponto, o ADR 0003

## Contexto

O ADR 0003 previa traduzir também os campos dos dados da pessoa: coleções do IndexedDB (`marcacoes`, `notas`, `leituras`…), campos (`ancora`, `livro`, `cap`, `alterado_em`…), chaves do `localStorage` e os arquivos no Drive (`lote-*.json`, `retrato-*.json`, `conta.json`), além do backup do caderno.

Esses dados não ficam só num aparelho: o mesmo Drive é lido e gravado pelo site e pelo app Android, e cada aparelho pode estar numa versão diferente por semanas. Um app antigo que recebesse lotes com campos novos não os entenderia e poderia sobrescrever anotações. O caminho seguro (expand/contract) exigiria gravar os dois formatos por tempo indeterminado, porque não há como saber quando todos os aparelhos foram atualizados.

## Decisão

- Os nomes dos dados guardados e dos arquivos no Drive **continuam como estão** (lista em `docs/DADOS_DO_USUARIO.md`). Eles são um formato de arquivo, como um esquema público, e não nomes de código.
- Dentro do código, variáveis e funções que lidam com esses dados usam nomes em inglês; o nome em português aparece só como chave do registro (`record.ancora`, `save("notas", …)`).
- O formato fica descrito em `docs/DADOS_DO_USUARIO.md` e qualquer mudança futura nele precisa de versão no arquivo e leitura dos dois formatos.

## Consequências

- Nenhuma migração de dados, nenhum risco para anotações já feitas, e aparelhos em versões diferentes continuam se entendendo.
- O código convive com chaves em português nos registros, o que é aceitável e fica restrito a esse formato.
