// The Livros tab of the index: the book and chapter picked, the testament shown and the name being typed.
export const toc = $state({
  book: "",
  chapter: 1,
  /** "0" Old Testament, "1" New */
  testament: "0" as "0" | "1",
  /** the letters typed in "Ir para" (see bookQuery) */
  filter: "",
  /** the chapter on screen, for "você está aqui" */
  here: { book: "", chapter: 0 }
});
