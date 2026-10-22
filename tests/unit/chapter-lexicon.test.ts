import { expect, test } from "vitest";
import { chapterLexicon, filterLexicon, shortMeaning } from "../../src/lib/chapter/lexicon";
import { toWord } from "../../src/lib/data/bible";

const lex = {
  H216: { l: "אוֹר", x: "ʼôwr", p: "or", s: "luz; claridade" },
  H430: { l: "אֱלֹהִים", x: "ʼĕlôhîym", p: "e-lo-HIM", s: "Deus (plural de majestade)" },
  H1254: { l: "בָּרָא", x: "bârâʼ", p: "ba-RA", s: "criar" }
};
const w = (strong: string) => toWord(["x", strong, "", "", "HNcmsa"]);
const verses = [{ words: [w("H430"), w("H1254"), w("H216")] }, { words: [w("H430"), w("H9999")] }];

test("the lemmas of the chapter in Strong order, with their counts (unknown numbers left out)", () => {
  expect(chapterLexicon(verses, lex).map(r => [r.key, r.count, r.meaning])).toEqual([
    ["H216", 1, "luz"],
    ["H430", 2, "Deus"],
    ["H1254", 1, "criar"]
  ]);
});

test("search by number, word, transliteration, pronunciation or meaning", () => {
  const rows = chapterLexicon(verses, lex);
  const keys = (q: string) => filterLexicon(rows, q, lex).map(r => r.key);
  expect(keys("")).toHaveLength(3);
  expect(keys("216")).toEqual(["H216"]);
  expect(keys("h1254")).toEqual(["H1254"]);
  expect(keys("luz")).toEqual(["H216"]);
  expect(keys("elohiym")).toEqual(["H430"]);
  expect(keys("ba-ra")).toEqual(["H1254"]);
  expect(keys("nada")).toEqual([]);
});

test("shortMeaning", () => expect(shortMeaning({ ge: "palavra (logos)" })).toBe("palavra"));
