// The books of the index: grouped as in the data (Lei, Históricos…) and filtered by what is typed in "Ir para".
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
