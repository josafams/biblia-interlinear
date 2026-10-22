// "Léxico do capítulo": the lemmas of the chapter in Strong order, with how often each one occurs, and the
// search that finds them by number, word, transliteration, pronunciation or meaning.
import { norm } from "../text";
import type { LexEntry, Word } from "../types";

type Entry = LexEntry & { l?: string; p?: string; s?: string; t?: string; ge?: string; se?: string };
export type LexiconRow = { key: string; lemma: string; xlit: string; pron: string; meaning: string; count: number; greek: boolean };

/** The first meaning of an entry, up to the first ";" or "(". */
export const shortMeaning = (e: Entry) => ((e.s || e.ge || e.se || "").split(/[;(]/)[0] || "").trim();
const strongOrder = (k: string) => parseInt(k.slice(1)) || 1e9;

export function chapterLexicon(verses: { words: Word[] }[], lex: Record<string, Entry>): LexiconRow[] {
  const counts: Record<string, number> = {};
  for (const v of verses) for (const w of v.words) if (w.strong) counts[w.strong] = (counts[w.strong] || 0) + 1;
  return Object.keys(counts)
    .filter(k => lex[k])
    .sort((a, b) => strongOrder(a) - strongOrder(b))
    .map(k => {
      const e = lex[k];
      return {
        key: k,
        lemma: e.l || "",
        xlit: e.x || "",
        pron: e.p || "",
        meaning: shortMeaning(e),
        count: counts[k],
        greek: k[0] === "G"
      };
    });
}

/** The rows that match what was typed: a Strong number ("216", "H216") or part of a word or meaning. */
export function filterLexicon(rows: LexiconRow[], query: string, lex: Record<string, Entry>) {
  const q = norm(query).trim();
  if (!q) return rows;
  return rows.filter(r => {
    const k = norm(r.key),
      e = lex[r.key] || {};
    return k === q || k === "h" + q || k === "g" + q || [e.x, e.l, e.p, e.s, e.t].some(x => norm(x).includes(q));
  });
}
