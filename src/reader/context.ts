// What the reader modules share: the books, the chapter on screen and where the reading is.
// The Svelte components read src/state; this is the data behind it (the chapter as loaded, the book object).
import type { About } from "../lib/about";
import { type ChapterVerse, verseLabel } from "../lib/chapter/view";
import { createBible } from "../lib/data/bible";
import type { Book, ChapterInfo } from "../lib/types";
import { prefs as prefsState } from "../state/prefs.svelte";
import type { Question } from "../state/reader.svelte";
import { showToast } from "../state/toast.svelte";

export type ReaderBook = Book & { about?: About; group: string; chapters: (ChapterInfo & { t?: string })[] };
/** a verse as the reader keeps it: links are [word, start, end, start, end…] in the Bíblia Livre text */
export type ReaderVerse = ChapterVerse & { links: number[][] };
export type ReaderChapter = { verses: ReaderVerse[]; questions: Omit<Question, "lemma">[] };

export const BOOKS = DATA.books;
export const BY_CODE = Object.fromEntries(BOOKS.map(b => [b.code, b]));
// chapters and lexicon on demand (src/lib/data/bible.ts)
export const bible = createBible(DATA);

export const R = {
  /** the book on screen (set by the first openChapter) */
  book: null as ReaderBook | null,
  cur: 0,
  ch: null as ReaderChapter | null,
  greek: false,
  /** the verse at the top of the screen */
  hereV: 1,
  /** the last word opened (the Verbete tab goes back to it) */
  lastWord: null as HTMLElement | null
};
/** The book on screen; only called once a chapter is open. */
export const book = () => R.book!;
export const chapter = () => R.ch!;

export const olang = () => (R.greek ? "grc" : "he");
export const vLabel = (v: { n: number }) => verseLabel(v.n, R.cur);

/** The chapter before or after the one on screen, across books (null at the ends of the Bible). */
export function neighbor(dir: -1 | 1) {
  const B = book();
  const bi = BOOKS.indexOf(B);
  let b: ReaderBook | undefined = B,
    n = R.cur + dir;
  if (n < 1) {
    b = BOOKS[bi - 1];
    if (!b) return null;
    n = b.chapters.length;
  } else if (n > B.chapters.length) {
    b = BOOKS[bi + 1];
    if (!b) return null;
    n = 1;
  }
  return { b, n };
}

// the switches of Aparência that change how the text is drawn and read
export const prefs = {
  get cant() {
    return prefsState.values["t-cant"];
  },
  get follow() {
    return prefsState.values["t-follow"];
  },
  get slow() {
    return prefsState.values["t-slow"];
  }
};

export const toast = (msg: string) => showToast(msg, { ms: 7000 });
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches; // i18n-ignore
export const versesEl = () => document.getElementById("verses")!;
export const topBar = () => document.querySelector<HTMLElement>("nav.bar")!;
