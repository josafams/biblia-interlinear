// The books of the index: grouped as in the data (Lei, Históricos…) and filtered by what is typed in "Ir para".
import { hasProjectTexts, tryT } from "../i18n";
import { norm } from "./text";

export type IndexBook = {
  code: string;
  name: string;
  abbrev: string;
  group: string;
  nt?: boolean;
  chapters: { n: number; v: number; t?: string }[];
};
export type BookGroup = { name: string; nt: boolean; books: IndexBook[] };

export function bookGroups(books: IndexBook[]): BookGroup[] {
  const groups: BookGroup[] = [];
  for (const b of books) {
    let g = groups[groups.length - 1];
    if (!g || g.name !== b.group) groups.push((g = { name: b.group, nt: !!b.nt, books: [] }));
    g.books.push(b);
  }
  return groups;
}

/** The letters typed for a book name ("cânt", "1 jo"), or "" when it is a reference with numbers ("Jo 3:16"). */
export function bookQuery(typed: string) {
  const raw = typed.trim();
  if (/\d\s*[:.]|\d\s+\d/.test(raw)) return "";
  return norm(raw.replace(/\s+/g, "")).replace(/\d+$/, "");
}

/** Whether a book matches: its name or abbreviation starts with the letters, or its name contains them. */
export function bookMatches(b: IndexBook, query: string) {
  if (!query) return true;
  return [b.name, b.abbrev].some(x => norm(x.replace(/\s+/g, "")).startsWith(query)) || norm(b.name).includes(query);
}

type LocalBook = { code: string; name: string; abbrev: string; group: string; about?: unknown; chapters: { n: number; t?: string }[] };
/** The project's texts translated, per book (dados/<locale>/livros.js): chapter themes and the introduction. */
export type BookTexts = Record<string, { t?: Record<string, string>; about?: unknown }>;

/**
 * The books in the locale: name, abbreviation and group from the locale file (the data has them in Portuguese).
 * The chapter themes and the introduction come from the translated texts; a book not translated yet has none,
 * so a page in English does not mix in Portuguese. Changes the objects in place and returns them.
 */
export function localizeBooks<B extends LocalBook>(books: B[], texts: BookTexts = globalThis.BOOK_TEXTS ?? {}): B[] {
  for (const b of books) {
    b.name = tryT(`books.${b.code}.name`) ?? b.name;
    b.abbrev = tryT(`books.${b.code}.abbrev`) ?? b.abbrev;
    b.group = tryT(`book_groups.${b.group}`) ?? b.group;
    if (!hasProjectTexts()) {
      const own = texts[b.code];
      if (own?.about) b.about = own.about;
      else delete b.about;
      for (const c of b.chapters) {
        if (own?.t?.[c.n]) c.t = own.t[c.n];
        else delete c.t;
      }
    }
  }
  return books;
}

declare global {
  var BOOK_TEXTS: BookTexts | undefined;
}
