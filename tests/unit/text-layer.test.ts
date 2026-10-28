import { expect, test } from "vitest";
import { type TextLayer, withLayer } from "../../src/lib/data/bible";
import type { Chapter, RawWord } from "../../src/lib/types";

const w: RawWord = ["λόγος", "G3056", "palavra", "", "N-NSM"];
const chapter: Chapter = {
  book: "PSA",
  chapter: 119,
  v: [
    { n: 1, b: "Bem-aventurados", w: [w], h: "Álefe", a: [[0, 0, 4]] },
    { n: 2, b: "Bem-aventurados os que", w: [w], o: "sem-original" },
    { n: 3, b: "Também", w: [w] }
  ]
};

test("the layer's text, note and section title take the place of the Bíblia Livre ones; the links go", () => {
  const layer: TextLayer = {
    v: [
      [1, "Blessed are those", null, "Aleph"],
      [2, "Blessed are those who keep"],
      [3, "", "sem-blivre"]
    ]
  };
  const out = withLayer(chapter, layer);
  expect(out.v).toEqual([
    { n: 1, b: "Blessed are those", w: [w], h: "Aleph" },
    { n: 2, b: "Blessed are those who keep", w: [w] },
    { n: 3, b: "", w: [w], o: "sem-blivre" }
  ]);
  expect(chapter.v[0].b).toBe("Bem-aventurados"); // the loaded chapter stays as it was
});

test("a verse the layer does not have is left without text", () => {
  expect(withLayer(chapter, { v: [] }).v.map(v => v.b)).toEqual(["", "", ""]);
});
