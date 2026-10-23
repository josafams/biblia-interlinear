import { expect, test } from "vitest";
import {
  bucketOf,
  filterOccurrences,
  glossCounts,
  markSpans,
  occurrences,
  occurrencesPerBook,
  spansOf
} from "../../src/lib/study/concordance";

// G25 (agapáō): two translations, four occurrences in two books
const d = { g: ["amou", "ama", ""], o: [42, 3, 16, 3, 0, 42, 3, 35, 1, 1, 61, 4, 10, 5, 0, 42, 13, 1, 2, 0] };

test("bucket file of a Strong number", () => {
  expect(bucketOf("H430")).toBe("H4");
  expect(bucketOf("G25")).toBe("G0");
  expect(bucketOf("G:abc")).toBe("Gx");
});

test("occurrences, filters by translation and book, Bible order", () => {
  const all = occurrences(d);
  expect(all).toHaveLength(4);
  expect(filterOccurrences(all, 0, null).map(x => `${x.b}.${x.c}.${x.v}`)).toEqual(["42.3.16", "42.13.1", "61.4.10"]);
  expect(filterOccurrences(all, -1, 61).map(x => x.v)).toEqual([10]);
  expect(occurrencesPerBook(all)).toEqual([
    [42, 3],
    [61, 1]
  ]);
});

test("translation counts leave out empty translations", () => {
  expect(glossCounts(d)).toEqual([
    { index: 0, gloss: "amou", count: 3 },
    { index: 1, gloss: "ama", count: 1 }
  ]);
});

test("the stretches a word translates are marked, the rest escaped", () => {
  const links = [
    [3, 14, 18, 25, 30],
    [4, 0, 3]
  ];
  expect(spansOf(links, 3)).toEqual([
    [14, 18],
    [25, 30]
  ]);
  expect(spansOf(links, 9)).toEqual([]);
  expect(markSpans("Porque Deus amou o <mundo>", [[12, 16]])).toBe("Porque Deus <mark>amou</mark> o &lt;mundo&gt;");
});
