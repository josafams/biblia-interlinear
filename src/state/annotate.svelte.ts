// The Anotar panel (#mbar): the verse it is open for and what the panel shows about it.
import type { Tag } from "../lib/annotations/verse";

/** Highlight colors; the ids are saved in the records ("cor"), the names come from the locale. */
export const COLOR_IDS = ["amarelo", "verde", "azul", "rosa", "laranja"] as const;

export const annotate = $state({
  open: false,
  /** "João 3:16" */
  ref: "",
  /** the quoted text, or the question being answered */
  snippet: "",
  /** the verse number (for its points of the automatic review) */
  verse: 0,
  /** the color of the highlight of this place ("" when none) */
  color: "",
  favorite: false,
  /** something is kept on the verse ("Apagar tudo deste versículo") */
  hasRecords: false,
  /** the "Interlinear" button, when the original is hidden */
  showLayers: false,
  /** answering a question of "Perguntas ao texto" */
  question: false,
  note: "",
  noteStatus: "",
  tags: { mine: [] as Tag[], rest: [] as Tag[], any: false }
});
