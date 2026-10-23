// The annotations of the chapter on screen, by verse number (see src/lib/annotations/paint.ts).
// Raw state: src/reader/annotations replaces it whole every time it paints.
import type { VerseMarks } from "../lib/annotations/paint";

class Marks {
  byVerse = $state.raw<Record<number, VerseMarks>>({});
}
export const marks = new Marks();
