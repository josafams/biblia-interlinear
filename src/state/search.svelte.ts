// "Buscar na Bíblia" (#busca): what was typed, where to look and what was found.
export type SearchItem = { id: number; ref: string; code: string; chapter: number; verse: number; html: string | null };
export type SearchTop =
  { kind: "strong"; key: string } | { kind: "ref"; code: string; chapter: number; verse: number | null; label: string };

export const search = $state({
  open: false,
  query: "",
  /** "" Bíblia toda, "at", "nt", or "livro" (the book on screen) */
  scope: "" as "" | "at" | "nt" | "livro",
  /** the book on screen, for the "Só em João" chip ("" when no chapter is open) */
  hereBook: "",
  /** a book picked among the results (its index), or null */
  book: null as number | null,
  top: null as SearchTop | null,
  /** "12 versículos · AT 3 · NT 9.", "Buscando…" */
  summary: "",
  similar: [] as string[],
  books: [] as { index: number; name: string; count: number }[],
  items: [] as SearchItem[],
  more: false
});
