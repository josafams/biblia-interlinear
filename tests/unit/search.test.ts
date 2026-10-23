import { expect, test } from "vitest";
import { decodeIds, highlight, intersect, perBook, searchTerms, strongQuery, verseOf } from "../../src/lib/search/search";

test("terms: lowercase, no accents, no numbers, no repeats; apostrophes kept", () => {
  expect(searchTerms("Amor, AMOR e graça 3")).toEqual(["amor", "e", "graca"]);
  expect(searchTerms("d’água")).toEqual(["d'agua"]);
});

test("a Strong number or not", () => {
  expect(strongQuery("h430")).toBe("H430");
  expect(strongQuery("G 025")).toBe("G25");
  expect(strongQuery("Jo 3:16")).toBeNull();
});

test("ids: decoding and the verse they point to", () => {
  expect(decodeIds("a,1,3")).toEqual([10, 11, 14]);
  expect(verseOf(42003016)).toEqual({ book: 42, chapter: 3, verse: 16 });
});

test("verses with every word, and counts per book", () => {
  expect(
    intersect([
      [1, 2, 3, 4],
      [2, 4, 6],
      [2, 4]
    ])
  ).toEqual([2, 4]);
  expect(intersect([])).toEqual([]);
  expect(perBook([42003016, 42001001, 18023001, 0])).toEqual([
    [42, 2],
    [0, 1],
    [18, 1]
  ]);
});

test("the searched words are marked, the rest escaped", () => {
  expect(highlight("Porque Deus amou o mundo <x>", ["deus", "mundo"])).toBe("Porque <mark>Deus</mark> amou o <mark>mundo</mark> &lt;x&gt;");
});
