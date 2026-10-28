// The verse of the day: one of the key verses of the 66 books (about.key_verses, the Bíblia Livre text), the same
// on every device on the same local day. The order is shuffled once with a fixed seed, so days in a row come from
// different books, and starts again when the list ends.
import { daysBetween, dayOf } from "../progress/stats";

export type DayVerse = { book: string; bookName: string; chapter: number; verse: number; ref: string; text: string };
type BookWithVerses = { code: string; name: string; about?: { key_verses?: { ref: string; text: string }[] } | null };

const EPOCH = "2026-01-01";

// a small seeded random (mulberry32): the same order on every device and every build
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** All key verses, in the shuffled order of the verse of the day. "2:10–11" opens at 2:10. */
export function verseList(books: BookWithVerses[]): DayVerse[] {
  const all: DayVerse[] = [];
  for (const b of books)
    for (const k of b.about?.key_verses || []) {
      const m = k.ref.match(/^(\d+):(\d+)/);
      if (m) all.push({ book: b.code, bookName: b.name, chapter: +m[1], verse: +m[2], ref: k.ref, text: k.text });
    }
  const rnd = seeded(20260101);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/** The verse of a day (the device's local date). */
export function verseOfDay(list: DayVerse[], date: Date | string = new Date()): DayVerse | null {
  if (!list.length) return null;
  const day = typeof date === "string" ? date : dayOf(date);
  const n = daysBetween(EPOCH, day);
  return list[((n % list.length) + list.length) % list.length];
}

/** "João 3:16" or "Salmos 23:1–2" */
export const verseRef = (v: DayVerse) => `${v.bookName} ${v.ref}`;
/** The reader's address of the verse: "JHN.3.16" */
export const verseAddress = (v: DayVerse) => `${v.book}.${v.chapter}.${v.verse}`;
