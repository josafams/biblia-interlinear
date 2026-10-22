import { expect, test } from "vitest";
import { bookGroups, bookMatches, bookQuery } from "../../src/lib/books";

const book = (code: string, name: string, abbrev: string, group: string, nt = false) => ({ code, name, abbrev, group, nt, chapters: [] });
const books = [
  book("GEN", "Gênesis", "Gn", "Lei"),
  book("EXO", "Êxodo", "Êx", "Lei"),
  book("SNG", "Cânticos", "Ct", "Poéticos"),
  book("1JN", "1 João", "1 Jo", "Cartas", true),
  book("JHN", "João", "Jo", "Evangelhos", true)
];

test("groups follow the order of the books", () => {
  expect(bookGroups(books).map(g => [g.name, g.books.length, g.nt])).toEqual([
    ["Lei", 2, false],
    ["Poéticos", 1, false],
    ["Cartas", 1, true],
    ["Evangelhos", 1, true]
  ]);
});

test("what was typed: book letters, not a reference", () => {
  expect(bookQuery("cânt")).toBe("cant");
  expect(bookQuery("1 jo")).toBe("1jo");
  expect(bookQuery("Jo 3:16")).toBe("");
  expect(bookQuery("1 Sm 17 4")).toBe("");
  expect(bookQuery("salmos 23")).toBe("salmos");
});

test("books that match", () => {
  const names = (q: string) => books.filter(b => bookMatches(b, bookQuery(q))).map(b => b.code);
  expect(names("")).toHaveLength(5);
  expect(names("cânt")).toEqual(["SNG"]);
  expect(names("ex")).toEqual(["EXO"]);
  expect(names("1 jo")).toEqual(["1JN"]);
  expect(names("joão")).toEqual(["1JN", "JHN"]);
});
