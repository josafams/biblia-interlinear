// What the reader is showing, as Svelte state: components read it and redraw by themselves.
// src/reader (the chapter, the modes, the index) writes it.
import type { About } from "../lib/about";
import type { ModeId } from "../lib/modes";

/** A chapter next to the one on screen, for the ‹ › buttons and the "Próximo capítulo" card. */
export type NeighborChapter = {
  code: string;
  name: string;
  abbrev: string;
  n: number;
  theme: string;
  /** false in the preview build when the chapter is not included */
  available: boolean;
};
/** A question of data/questions; lemma is the original word of its Strong number, when known. */
export type Question = {
  kind: "observation" | "interpretation" | "original" | "application";
  text: string;
  verses?: string;
  strong?: string;
  lemma?: string;
};
/** Where the reading is: the verse at the top of the screen (0 = the chapter title). */
export type Here = { book: string; chapter: number; verse: number; theme: string };

export const reader = $state({
  /** The reading mode on screen ("personalizado" after a switch is changed by hand). */
  mode: "interlinear" as ModeId,
  /** The mode "personalizado" came from. */
  baseMode: "interlinear" as ModeId,
  /** The mode before the last change, for the ⇄ button ("" when none). */
  previousMode: "" as ModeId | "",
  /** The previous and the next chapter (null at the first and the last of the Bible). */
  prev: null as NeighborChapter | null,
  next: null as NeighborChapter | null,
  /** null until the first chapter opens. */
  here: null as Here | null,
  /** The chapter title block (null until the first chapter opens); eyebrow says what text is on screen. */
  heading: null as { book: string; chapter: number; titleOrig: string; theme: string; hasAbout: boolean } | null,
  eyebrow: "",
  /** "Sobre o livro" (the book introduction) is open */
  aboutOpen: false,
  /** the book introduction of the book on screen */
  about: { book: "", chapters: 0, greek: false, data: null as About | null },
  /** the first-opening question (#welcome) is on screen */
  welcome: false,
  /** the section titles of the chapter (Psalm 119), its verse count and its last verse number */
  sections: [] as { n: number; h: string }[],
  verseCount: 0,
  lastVerse: 0,
  /** The book on screen is in Greek (New Testament); otherwise Hebrew/Aramaic. */
  greek: false,
  /** "Perguntas ao texto" of the chapter on screen. */
  questions: [] as Question[]
});
