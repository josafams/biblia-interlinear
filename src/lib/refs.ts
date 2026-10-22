// "Ir para": references as people type them — "Jo 3:16", "1 Sm 17 4", "salmos 23", "1:14" (current chapter),
// "14" (verse of the current chapter), "cap 12" — parsed against the books list and checked against its chapters.
import { t } from "../i18n";
import { esc, norm } from "./text";

export type RefBook = { code: string; name: string; abbrev: string; chapters: { n: number; v: number }[] };
export type ParsedRef =
  { error: "book"; word: string } | { incomplete: true } | { book: RefBook; ch: number; v: number | null; verseOnly?: true };
export type ResolvedRef =
  | { warn: string }
  | { na: RefBook["chapters"][number]; book: RefBook; v: number | null }
  | { ok: true; book: RefBook; ch: number; v: number; chapterStart: boolean };
export type Here = { book: RefBook | null; ch: number };

// the words for "chapter" in the locale, shortest first ("c|cap|capitulo")
const chapterWords = () => t("refs.chapter_words").split("|");

export function createRefs(books: RefBook[]) {
  // [alias, book, level]: 3 = as written, 2 = without accents, 1 = the code
  const aliases: [string, RefBook, number][] = [];
  for (const b of books) {
    const name = b.name.toLowerCase().replace(/\s+/g, ""),
      abbrev = b.abbrev.toLowerCase().replace(/\s+/g, "");
    aliases.push([abbrev, b, 3], [name, b, 3], [norm(abbrev), b, 2], [norm(name), b, 2], [b.code.toLowerCase(), b, 1]);
  }

  function findBook(w: string) {
    const raw = w.toLowerCase(),
      n = norm(w);
    for (const [alias, level] of [
      [raw, 3],
      [n, 2],
      [n, 1]
    ] as const) {
      const hit = aliases.find(a => a[2] === level && a[0] === alias);
      if (hit) return hit[1];
    }
    if (n.replace(/^\d/, "").length >= 2) {
      const prefix = aliases.find(a => a[2] === 2 && a[0].startsWith(n));
      if (prefix) return prefix[1];
    }
    return null;
  }

  function parseRef(q: string, here: Here): ParsedRef | null {
    let s = String(q).replace(/[–—]/g, "-").trim();
    if (!s) return null;
    const words = chapterWords();
    const long = words[words.length - 1];
    let book: RefBook | null = null,
      chapOnly = false;
    const bm = s.match(/^([1-3]\s*)?([A-Za-zÀ-ÿ]+)\.?\s*/);
    if (bm) {
      const word = (bm[1] || "").replace(/\s/g, "") + bm[2];
      const wn = norm(bm[2]);
      if (!bm[1] && (words.includes(wn) || (wn.length >= 3 && long.startsWith(wn)))) chapOnly = true;
      else {
        book = findBook(word);
        if (!book) return { error: "book", word };
      }
      s = s.slice(bm[0].length);
      const cm = norm(s).match(new RegExp(`^(${words.join("|")})\\.?\\s*`));
      if (book && cm) {
        chapOnly = true;
        s = s.slice(cm[0].length);
      }
    }
    const nums = (s.match(/\d+/g) || []).map(Number);
    const B = book || here.book;
    if (!B) return { incomplete: true };
    if (!nums.length) return book ? { book: B, ch: B === here.book ? here.ch : 1, v: null } : { incomplete: true };
    if (chapOnly) return { book: B, ch: nums[0], v: null };
    if (nums.length >= 2) return { book: B, ch: nums[0], v: nums[1] };
    if (/\d\s*[:.,]\s*$/.test(s) || book) {
      const single = B.chapters.length === 1 && !!book;
      return { book: B, ch: single ? 1 : nums[0], v: single ? nums[0] : null };
    }
    return { book: B, ch: here.ch, v: nums[0], verseOnly: true };
  }

  // hasChapter: whether the chapter can be opened here (the preview build has only a few)
  function resolveRef(r: ParsedRef | null, hasChapter: (code: string, n: number) => boolean): ResolvedRef | null {
    if (!r) return null;
    if ("error" in r) return { warn: t("refs.unknown_book", { word: esc(r.word) }) };
    if ("incomplete" in r) return { warn: t("refs.incomplete") };
    const B = r.book,
      c = B.chapters[r.ch - 1];
    if (!c) return { warn: t("refs.chapter_count", { book: esc(B.name), count: B.chapters.length }) };
    if (r.v !== null && (r.v < 0 || r.v > c.v)) return { warn: t("refs.verse_count", { book: esc(B.name), ch: c.n, count: c.v }) };
    if (!hasChapter(B.code, c.n)) return { na: c, book: B, v: r.v };
    return { ok: true, book: B, ch: c.n, v: r.v ?? 1, chapterStart: r.v === null };
  }

  return { findBook, parseRef, resolveRef };
}
