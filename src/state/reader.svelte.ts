// What the reader is showing, as Svelte state: components read it and redraw by themselves.
// The legacy web/reader.js writes it while its parts move to components (phase 4).
import type { ModeId } from "../lib/modes";

/** A chapter next to the one on screen, for the ‹ › buttons. */
export type NeighborChapter = { name: string; abbrev: string; n: number };

export const reader = $state({
  /** The reading mode on screen ("personalizado" after a switch is changed by hand). */
  mode: "interlinear" as ModeId,
  /** The mode "personalizado" came from. */
  baseMode: "interlinear" as ModeId,
  /** The previous and the next chapter (null at the first and the last of the Bible). */
  prev: null as NeighborChapter | null,
  next: null as NeighborChapter | null
});
