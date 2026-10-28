import { expect, test } from "vitest";
import { type TextLayer, withLayer } from "../../src/lib/data/bible";
import type { Chapter, RawWord } from "../../src/lib/types";

const w = (gloss: string): RawWord => ["λόγος", "G3056", gloss, "", "N-NSM", "λόγος"];
const chapter: Chapter = {
  book: "PSA",
  chapter: 119,
  v: [
    { n: 1, b: "Bem-aventurados", w: [w("bem-aventurados")], h: "Álefe", a: [[0, 0, 15]] },
    { n: 2, b: "Bem-aventurados os que", w: [w("os"), w("que")], o: "sem-original" },
    { n: 3, b: "Também", w: [w("também")] }
  ],
  m: [[1, 0, "a", "CON-01", "CON-01", {}]]
};

test("the layer's text, note, section title, links and glosses take the place of the Bíblia Livre ones", () => {
  const layer: TextLayer = {
    v: [
      { n: 1, b: "Blessed are those", h: "Aleph", g: [["blessed", ""]], a: [[0, 0, 7]] },
      {
        n: 2,
        b: "Blessed are those who keep",
        g: [
          ["those", "r"],
          ["who", ""]
        ]
      },
      { n: 3, b: "", o: "sem-blivre" }
    ]
  };
  const out = withLayer(chapter, layer);
  expect(out.v).toEqual([
    { n: 1, b: "Blessed are those", w: [["λόγος", "G3056", "blessed", "", "N-NSM", "λόγος"]], h: "Aleph", a: [[0, 0, 7]] },
    {
      n: 2,
      b: "Blessed are those who keep",
      w: [
        ["λόγος", "G3056", "those", "r", "N-NSM", "λόγος"],
        ["λόγος", "G3056", "who", "", "N-NSM", "λόγος"]
      ]
    },
    { n: 3, b: "", w: [w("também")], o: "sem-blivre" }
  ]);
  // the marks of the review are about the Portuguese glosses
  expect(out.m).toEqual([]);
  // the loaded chapter stays as it was
  expect(chapter.v[0].b).toBe("Bem-aventurados");
  expect(chapter.v[0].w[0][2]).toBe("bem-aventurados");
});

test("a verse the layer does not have is left without text", () => {
  expect(withLayer(chapter, { v: [] }).v.map(v => v.b)).toEqual(["", "", ""]);
});
