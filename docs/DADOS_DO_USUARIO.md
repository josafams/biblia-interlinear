# Formato dos dados da pessoa

Anotações, preferências e progresso ficam no aparelho e, com login, numa pasta escondida do Google Drive da própria pessoa (ADR 0001). Os nomes abaixo são um **formato de arquivo**: continuam em português mesmo com o código em inglês (ADR 0005). Mudar qualquer um deles exige ler o formato antigo e o novo ao mesmo tempo, porque aparelhos em versões diferentes compartilham o mesmo Drive.

## IndexedDB (`biblia-interlinear`, Dexie, `src/lib/annotations/store.ts`)

| Coleção | Índices | Para quê |
| --- | --- | --- |
| `marcacoes` | `id, cap, alterado_em, apagado` | marca-texto (cor, trecho) |
| `notas` | `id, cap, alterado_em, apagado` | notas de versículo |
| `favoritos` | `id, cap, alterado_em, apagado` | versículos favoritos |
| `etiquetas` | `id, nome, apagado` | etiquetas das notas |
| `preferencias` | `id` | modo de leitura, posição (`posicao`) |
| `leituras` | `id, livro` | capítulos lidos (`lido`, `primeira`, `ultima`, `vezes`) |
| `tempo` | `id, dia` | tempo de leitura por aparelho e dia (`segundos`, `livros`, `caps`, `verbetes`) |
| `planos` | `id` | planos de leitura |
| `fila` | `++seq, colecao, id` | alterações ainda não enviadas ao Drive (só no aparelho) |
| `estado` | `chave` | marcadores da sincronização (só no aparelho) |

Campos comuns dos registros sincronizados: `id`, `ancora` (`livro`, `cap`, `ver`, `camada`, `inicio`, `fim`), `criado_em`, `alterado_em`, `relogio` (relógio híbrido, decide a versão mais nova) e `apagado` (exclusão que também viaja).

## `localStorage` (prefixo `interlinear:`)

Preferências de leitura (`modo`, `modo-base`, `tema`, `tamanho`, `posicao`…), o identificador do aparelho (`aparelho`), a conta conectada (`conta`) e avisos já vistos (`conta-sugestao`).

## Google Drive (`appDataFolder`, `src/reader/sync.ts` e `src/reader/account.ts`)

- `lote-<aparelho>-<tempo>.json`: alterações enviadas por um aparelho.
- `retrato-<tempo>-<aparelho>.json`: todos os registros juntos, gravado de tempos em tempos para os lotes antigos poderem ser apagados.
- `conta.json`: aparelhos conectados (`aparelhos`, com `nome` e `visto_em`).

## Backup do caderno

O arquivo exportado em **Caderno › Fazer backup** traz as mesmas coleções e campos, com `versao` e `exportado_em`.
