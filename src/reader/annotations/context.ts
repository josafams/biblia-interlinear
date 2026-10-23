// Annotations on the device: highlights in colors, notes, favorites and tags. Everything is kept in the local
// database of the browser or the app (IndexedDB through Dexie), works without an account and offline; every
// change also goes into a queue that the Google Drive sync sends (web/sync.js).
//
// Anchor of an annotation (where it is attached), field names as saved:
//   { livro: "JHN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" | "blivre" | "original",
//     inicio, fim,   characters of the Bíblia Livre, or positions (0…) of the words of the original
//     trecho,        the text highlighted then, to find it again if the verse changes
//     edicao }       date of the data edition when it was highlighted
// The reader sends "chapter-rendered" every time it draws a chapter.
import Dexie from "dexie";
import { flushSync } from "svelte";
import { chapterMarks } from "../../lib/annotations/paint";
import { createAnnotationStore } from "../../lib/annotations/store";
import { type Anchored, type Tag, createVerseAnnotations, verseAnchor as anchorFor } from "../../lib/annotations/verse";
import { marks } from "../../state/marks.svelte";
import { showToast } from "../../state/toast.svelte";

/** The chapter on screen, as the reader describes it (window.__currentChapter). */
export type ShownChapter = {
  book: string;
  chapter: number;
  bookName: string;
  bookAbbrev: string;
  verses: { n: number; blivre: string; words: { heb: string }[] }[];
};

export const EDITION = (window.DATA_EDICAO || "").slice(0, 10);
export const store = createAnnotationStore(Dexie);
export const verse = createVerseAnnotations(store);
export const verseAnchor = (book: string, chapter: number, v: number) => anchorFor(book, chapter, v, EDITION);

export const A = { chapter: null as ShownChapter | null };
export const chapterKey = () => (A.chapter ? `${A.chapter.book}.${A.chapter.chapter}` : "");
export const verseEl = (n: number | string) => document.getElementById("v" + n);

export const records = async (c: "marcacoes" | "notas" | "favoritos") => (await store.allRecords(c)) as Anchored[];
export const tags = async () => (await store.allRecords("etiquetas")) as Tag[];

/** Draws the annotations of the chapter (Verse.svelte reads src/state/marks.svelte.ts). */
export async function paint() {
  const cap = chapterKey();
  if (!cap) return;
  const [ms, ns, fs, ets] = await Promise.all([
    store.ofChapter("marcacoes", cap),
    store.ofChapter("notas", cap),
    store.ofChapter("favoritos", cap),
    tags()
  ]);
  if (cap !== chapterKey()) return;
  const texts = Object.fromEntries(A.chapter!.verses.map(v => [v.n, v.blivre || ""]));
  marks.byVerse = chapterMarks(ms as Anchored[], ns as Anchored[], fs as Anchored[], ets, n => texts[n]);
  flushSync();
}
store.setRepaint(() => paint());

export function bookName(code: string) {
  return window.__books?.[code]?.name || code;
}
export function bookOrder(code: string) {
  return window.__books?.[code]?.i ?? 999;
}
export const listBooks = { name: bookName, order: bookOrder };

export const toastMsg = (msg: string) => showToast(msg);
/** A notice with "Desfazer" (8 seconds). */
export const toastUndo = (msg: string, undo: () => void) => showToast(msg, { undo });
