// "Exportar em PDF" (#exportar): what goes into the notebook. src/reader/annotations/export.ts opens it from Minhas anotações.
export const exportView = $state({
  open: false,
  /** the books that have something kept, in biblical order */
  books: [] as { code: string; name: string }[],
  listCount: 0,
  selectedCount: 0,
  scope: "lista" as "lista" | "sel" | "livro",
  book: "",
  notes: true,
  highlights: true,
  favorites: true,
  text: true,
  interlinear: false,
  order: "biblica" as "biblica" | "data",
  busy: false
});
