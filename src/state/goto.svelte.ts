// "Ir para" in the index: the preview of what is being typed, and the verse chips of the chapter on screen.
import type { GotoPreview } from "../lib/goto";

export const goto = $state({
  preview: { kind: "none" } as GotoPreview,
  /** "Versículos de João 3" */
  versesOf: "",
  verses: [] as { n: number; label: string }[],
  /** the verse at the top of the screen */
  here: 1
});
