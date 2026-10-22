// How many verses have an annotation (a color, a note or a favorite): verses, not records.
type Anchored = { id: string; ancora?: { livro: string; cap: number; ver: number } };

export const ANNOTATED = ["notas", "marcacoes", "favoritos"] as const;

export function annotatedVerses(lists: Anchored[][]) {
  return new Set(lists.flat().map(r => (r.ancora ? `${r.ancora.livro}.${r.ancora.cap}.${r.ancora.ver}` : r.id))).size;
}
