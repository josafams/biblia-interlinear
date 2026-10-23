// "Ocorrências" (#concordancia): the lemma, the filters and the list.
export type ConcItem = {
  key: string;
  ref: string;
  code: string;
  chapter: number;
  verse: number;
  word: number;
  gloss: string;
  html: string | null;
};

export const conc = $state({
  open: false,
  title: "",
  /** "143 ocorrências na Bíblia." / "12 de 143 ocorrências." / not available offline */
  summary: "",
  available: true,
  gloss: -1,
  glosses: [] as { index: number; gloss: string; count: number }[],
  allGlosses: false,
  books: [] as { index: number; name: string; count: number }[],
  allBooks: false,
  book: null as number | null,
  /** the book on screen ("Só em João"), "" when no chapter is open */
  hereName: "",
  hereIndex: -1,
  items: [] as ConcItem[],
  more: false
});
