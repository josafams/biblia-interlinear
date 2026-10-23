// Search in the whole Bible (Bíblia Livre text): a word index in dados/busca/<first 2 letters>.js, loaded as
// needed. A verse id is book index × 1 000 000 + chapter × 1000 + verse. Several words find the verses with all.
import { jsonpChannel } from "../data/jsonp";
import { esc } from "../text";

/** Lowercase, without accents, typographic apostrophe as ' (as in the index). */
export const searchNorm = (w: string) => w.replace(/’/g, "'").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;

/** The words to look for (no numbers, no repeats). */
export const searchTerms = (text: string) => [...new Set((text.match(TOKEN) || []).map(searchNorm))].filter(t => !/^\d+$/.test(t));

/** "H430", "g 25" → the Strong number to open in the concordance. */
export function strongQuery(text: string) {
  const m = /^([HG])\s*0*(\d{1,4})$/i.exec(text.trim());
  return m ? m[1].toUpperCase() + m[2] : null;
}

export const verseOf = (id: number) => ({ book: Math.floor(id / 1e6), chapter: Math.floor(id / 1000) % 1000, verse: id % 1000 });

/** The ids of an index entry: base-36 differences ("a,1,3" → 10, 11, 14). */
export function decodeIds(s: string) {
  const out: number[] = [];
  let acc = 0;
  for (const part of s.split(",")) {
    acc += parseInt(part, 36);
    out.push(acc);
  }
  return out;
}

/** Verses with every term (the shortest list first, then filtered by the others). */
export function intersect(lists: number[][]) {
  if (!lists.length) return [];
  const [first, ...rest] = [...lists].sort((a, b) => a.length - b.length);
  return rest.reduce((ids, l) => {
    const set = new Set(l);
    return ids.filter(x => set.has(x));
  }, first);
}

/** How many verses in each book, most first (then by book order). */
export function perBook(ids: number[]) {
  const counts: Record<number, number> = {};
  for (const id of ids) counts[verseOf(id).book] = (counts[verseOf(id).book] || 0) + 1;
  return Object.entries(counts)
    .map(([b, n]) => [+b, n] as [number, number])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]);
}

/** The verse text with the searched words in <mark> (every part escaped). */
export function highlight(text: string, terms: string[]) {
  const set = new Set(terms);
  let out = "",
    pos = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (!set.has(searchNorm(m[0]))) continue;
    out += esc(text.slice(pos, m.index)) + `<mark>${esc(m[0])}</mark>`;
    pos = m.index! + m[0].length;
  }
  return out + esc(text.slice(pos));
}

/** The index files, loaded once each; a missing file means no word starts like that. */
export function createSearchIndex() {
  const index: Record<string, Record<string, string>> = {};
  const load = jsonpChannel<Record<string, string>>("__busca", (prefix, d) => {
    index[prefix] = d;
  });
  const prefixOf = (w: string) => [...w].slice(0, 2).join("");
  const fileOf = (p: string) => [...p].map(ch => (/[a-z0-9]/i.test(ch) ? ch : "_" + ch.codePointAt(0)!.toString(16))).join("");
  const entries = (p: string): Promise<Record<string, string>> =>
    index[p] ? Promise.resolve(index[p]) : load(p, `dados/busca/${fileOf(p)}.js`).catch(() => (index[p] = {}));
  return {
    async idsOf(term: string) {
      const d = await entries(prefixOf(term));
      return d[term] ? decodeIds(d[term]) : [];
    },
    /** Words of the index that start with the term, the most frequent first. */
    async similar(term: string) {
      const d = await entries(prefixOf(term));
      return Object.keys(d)
        .filter(w => w !== term && w.startsWith(term))
        .sort((a, b) => d[b].length - d[a].length)
        .slice(0, 6);
    }
  };
}
