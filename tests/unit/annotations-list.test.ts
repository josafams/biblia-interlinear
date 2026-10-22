import { expect, test } from "vitest";
import { filterItems, groupItems, listItems, sortItems, tagCounts } from "../../src/lib/annotations/list";
import { verseAnchor } from "../../src/lib/annotations/verse";

const ORDER: Record<string, number> = { GEN: 0, PSA: 18, JHN: 42 };
const NAMES: Record<string, string> = { GEN: "Gênesis", PSA: "Salmos", JHN: "João" };
const books = { name: (c: string) => NAMES[c] || c, order: (c: string) => ORDER[c] ?? 999 };
const labels = { note: "nota", highlight: "marcação", tagOnly: "etiqueta", favorite: "favorito", free: "Nota livre" };
const at = (b: string, c: number, v: number, trecho = "") => ({ ...verseAnchor(b, c, v), trecho });

const items = listItems(
  {
    notas: [
      { id: "n1", ancora: at("JHN", 3, 16), titulo: "Amor", texto: "Deus amou o mundo", etiquetas: ["t1"], alterado_em: "2026-10-02" },
      { id: "n2", ancora: null as never, texto: "nota sem versículo", alterado_em: "2026-10-05" }
    ],
    marcacoes: [
      { id: "m1", ancora: at("JHN", 3, 16, "Porque Deus amou"), cor: "verde", etiquetas: [], alterado_em: "2026-10-01" },
      { id: "m2", ancora: at("GEN", 1, 1), cor: null, etiquetas: ["t1"], alterado_em: "2026-10-03" }
    ],
    favoritos: [{ id: "f1", ancora: at("PSA", 23, 1), etiquetas: [], alterado_em: "2026-10-04" }],
    etiquetas: [{ id: "t1", nome: "Promessas" }]
  },
  books,
  labels
);
const all = { tipo: "" as const, cap: null, ver: null, tag: "", query: "" };

test("every record becomes an item with its label, reference and tag names", () => {
  expect(items.map(x => [x.id, x.label, x.ref])).toEqual([
    ["n1", "nota", "João 3:16"],
    ["n2", "nota", "Nota livre"],
    ["m1", "marcação", "João 3:16"],
    ["m2", "etiqueta", "Gênesis 1:1"],
    ["f1", "favorito", "Salmos 23:1"]
  ]);
  expect(items[0].tagNames).toEqual(["Promessas"]);
  expect(tagCounts(items)).toEqual({ t1: 2 });
});

test("filters by kind (with counts of each), verse, tag and search; #tag searches tags only", () => {
  const { items: notas, counts } = filterItems(items, { ...all, tipo: "notas" });
  expect(notas.map(x => x.id)).toEqual(["n1", "n2"]);
  expect(counts).toEqual({ "": 5, notas: 2, marcacoes: 2, favoritos: 1 });
  expect(filterItems(items, { ...all, cap: "JHN.3", ver: 16 }).items.map(x => x.id)).toEqual(["n1", "m1"]);
  expect(filterItems(items, { ...all, tag: "t1" }).items.map(x => x.id)).toEqual(["n1", "m2"]);
  expect(filterItems(items, { ...all, query: "mundo" }).items.map(x => x.id)).toEqual(["n1"]);
  expect(filterItems(items, { ...all, query: "#promes" }).items.map(x => x.id)).toEqual(["n1", "m2"]);
});

test("biblical order groups by book with one card per verse; by date, newest first and no headings", () => {
  const bible = groupItems(sortItems(items, "biblica", books), false, books, "Notas livres");
  expect(bible.map(g => [g.title, g.verses.map(v => [v.ref, v.items.length])])).toEqual([
    ["Gênesis", [["Gênesis 1:1", 1]]],
    ["Salmos", [["Salmos 23:1", 1]]],
    ["João", [["João 3:16", 2]]],
    ["Notas livres", [["Nota livre", 1]]]
  ]);
  const byDate = groupItems(sortItems(items, "data", books), true, books, "Notas livres");
  expect(byDate).toHaveLength(1);
  expect(byDate[0].title).toBeNull();
  // the two items of João 3:16 come one after the other, so they share a card
  expect(byDate[0].verses.map(v => [v.ref, v.items.length])).toEqual([
    ["Nota livre", 1],
    ["Salmos 23:1", 1],
    ["Gênesis 1:1", 1],
    ["João 3:16", 2]
  ]);
});
