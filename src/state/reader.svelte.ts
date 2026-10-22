// What the reader is showing, as Svelte state: components read it and redraw by themselves.
// The legacy web/reader.js writes it while its parts move to components (phase 4).
import type { ModeId } from "../lib/modes";

export const reader = $state({
  /** The reading mode on screen ("personalizado" after a switch is changed by hand). */
  mode: "interlinear" as ModeId,
  /** The mode "personalizado" came from. */
  baseMode: "interlinear" as ModeId
});
