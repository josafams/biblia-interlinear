// Concordance: every occurrence of a lemma (dados/conc/<bucket>.js) with the Bíblia Livre translation of each,
// filters by translation and by book, and the verse text with the words linked to the lemma marked.
import { jsonpChannel } from "../data/jsonp";
import { esc } from "../text";

/** One lemma's data: g = the translations, o = [book, chapter, verse, word, translation] × n (flat). */
export type ConcEntry = { g: string[]; o: number[] };
export type Occurrence = { b: number; c: number; v: number; i: number; g: number };

/** The file a Strong number is in: H430 → H4, G25 → G0; other keys share an "x" file. */
export function bucketOf(key: string | null | undefined) {
  const m = /^([HG])(\d+)$/.exec(key || "");
  return m ? `${m[1]}${Math.floor(+m[2] / 100)}` : `${(key || "G")[0]}x`;
}

export function occurrences(d: ConcEntry): Occurrence[] {
  const out: Occurrence[] = [];
  for (let k = 0; k + 4 < d.o.length; k += 5) {
    const [b, c, v, i, g] = d.o.slice(k, k + 5);
    out.push({ b, c, v, i, g });
  }
  return out;
}

/** With the translation filter (-1: all) and, unless book is null, one book; in Bible order. */
export function filterOccurrences(all: Occurrence[], gloss: number, book: number | null) {
  return all
    .filter(x => (gloss < 0 || x.g === gloss) && (book == null || x.b === book))
    .sort((x, y) => x.b - y.b || x.c - y.c || x.v - y.v || x.i - y.i);
}

/** The translations with how often each is used (empty ones left out). */
export function glossCounts(d: ConcEntry) {
  const counts: Record<number, number> = {};
  for (let k = 4; k < d.o.length; k += 5) counts[d.o[k]] = (counts[d.o[k]] || 0) + 1;
  return d.g.map((g, i) => ({ index: i, gloss: g, count: counts[i] || 0 })).filter(x => x.gloss);
}

/** Books with the most occurrences first. */
export function occurrencesPerBook(xs: Occurrence[]) {
  const counts: Record<number, number> = {};
  for (const x of xs) counts[x.b] = (counts[x.b] || 0) + 1;
  return Object.entries(counts)
    .map(([b, n]) => [+b, n] as [number, number])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

/** The Bíblia Livre stretches a word translates: a verse's links row [word, start, end, start, end, …]. */
export function spansOf(links: number[][] | undefined, wordIndex: number) {
  const row = (links || []).find(r => r[0] === wordIndex);
  const out: [number, number][] = [];
  if (row) for (let k = 1; k + 1 < row.length; k += 2) out.push([row[k], row[k + 1]]);
  return out;
}

/** The verse text with the stretches in <mark> (every part escaped). */
export function markSpans(text: string, spans: [number, number][]) {
  let out = "",
    pos = 0;
  for (const [s, e] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (s < pos) continue;
    out += esc(text.slice(pos, s)) + `<mark>${esc(text.slice(s, e))}</mark>`;
    pos = e;
  }
  return out + esc(text.slice(pos));
}

/** The concordance files, loaded once each. layer: the locale whose glosses it lists (dados/<layer>/conc), null
 * for the Bíblia Livre. */
export function createConcordance(layer: string | null = null) {
  const folder = layer ? `dados/${layer}/conc` : "dados/conc";
  const files: Record<string, Record<string, ConcEntry>> = {};
  const load = jsonpChannel<Record<string, ConcEntry>>("__conc", (bucket, d) => {
    files[bucket] = d;
  });
  return {
    async entry(key: string): Promise<ConcEntry | null> {
      const b = bucketOf(key);
      try {
        return (files[b] || (await load(b, `${folder}/${b}.js`)))[key] || null;
      } catch {
        return null;
      }
    }
  };
}
