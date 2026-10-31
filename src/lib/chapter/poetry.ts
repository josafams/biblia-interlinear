// The chapters written as Hebrew poetry. In the "Bíblia" mode their verses start each on its own line, as a
// printed Bible sets the psalms; the other chapters run as prose.

/** Books that are poetry from the first chapter to the last. */
const POETIC_BOOKS = new Set(["PSA", "PRO", "SNG", "LAM"]);

/** Whether a chapter is poetry: the books above, and Job between the prose prologue (1–2) and epilogue (42). */
export function isPoetic(book: string, chapter: number): boolean {
  if (POETIC_BOOKS.has(book)) return true;
  return book === "JOB" && chapter >= 3 && chapter <= 41;
}
