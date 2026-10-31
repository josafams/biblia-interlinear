// How to read the approximate pronunciation of one word (e.g. "mo-CHÉ"): its stressed syllable, written in
// capitals, and the spellings in it that the reader needs explained. The entry shows only what this word uses.

export type PronRule = "rr" | "h" | "ch" | "th";

/** The stressed syllables (those in capitals) of a pronunciation, as written. */
export function stressedSyllables(pron: string): string[] {
  return pron.split(/[-\s]+/).filter(s => /\p{Lu}/u.test(s));
}

/** The spellings explained by the legend that this pronunciation uses, in the legend's order. */
export function pronunciationRules(pron: string): PronRule[] {
  const p = pron.toLowerCase();
  const rules: PronRule[] = [];
  if (p.includes("rr")) rules.push("rr");
  // an h of its own, not the second letter of ch, th, sh, ph or kh
  if (/h/.test(p.replace(/[ctspk]h/g, ""))) rules.push("h");
  if (p.includes("ch")) rules.push("ch");
  if (p.includes("th")) rules.push("th");
  return rules;
}
