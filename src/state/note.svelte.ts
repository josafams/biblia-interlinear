// The note open in full screen (#nota): its reference, title and text, status and tags.
import type { Tag } from "../lib/annotations/verse";

export const note = $state({
  open: false,
  /** "João 3:16 · “Porque Deus amou…”", or "Nota livre" */
  ref: "",
  title: "",
  text: "",
  status: "",
  /** a note already saved can be deleted (a new one, not yet) */
  saved: false,
  /** "Apagar nota" was pressed once: pressing again deletes */
  confirming: false,
  tags: [] as Tag[],
  selected: [] as string[]
});
