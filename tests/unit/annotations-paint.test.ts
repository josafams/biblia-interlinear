import { expect, test } from "vitest";
import { chapterMarks, textPieces } from "../../src/lib/annotations/paint";
import { verseAnchor } from "../../src/lib/annotations/verse";

const TEXT: Record<number, string> = { 1: "No princípio criou Deus os céus e a terra.", 3: "E disse Deus: Haja luz; e houve luz." };
const textOf = (n: number) => TEXT[n];
const at = (v: number, extra: object = {}) => ({ ...verseAnchor("GEN", 1, v), ...extra });

test("whole verse, words of the original and snippets of the Bíblia Livre", () => {
  const m = chapterMarks(
    [
      { id: "a", ancora: at(1, { camada: "original", inicio: 0, fim: 1 }), cor: "azul" },
      { id: "b", ancora: at(1, { camada: "versiculo" }), cor: "verde" },
      { id: "c", ancora: at(3, { camada: "blivre", inicio: 14, fim: 22, trecho: "Haja luz" }), cor: "amarelo" }
    ],
    [],
    [],
    [],
    textOf
  );
  expect(m[1]).toMatchObject({ color: "verde", bar: "verde", words: { 0: "azul", 1: "azul" } });
  expect(m[3].spans).toEqual([{ i: 14, f: 22, color: "amarelo" }]);
  expect(textPieces(TEXT[3], m[3].spans)).toEqual([
    { text: "E disse Deus: ", color: "" },
    { text: "Haja luz", color: "amarelo" },
    { text: "; e houve luz.", color: "" }
  ]);
});

test("a snippet found elsewhere moves; one no longer in the text marks the whole verse", () => {
  const m = chapterMarks(
    [
      { id: "a", ancora: at(3, { camada: "blivre", inicio: 0, fim: 8, trecho: "houve luz" }), cor: "rosa" },
      { id: "b", ancora: at(1, { camada: "blivre", inicio: 0, fim: 5, trecho: "trevas" }), cor: "azul" }
    ],
    [],
    [],
    [],
    textOf
  );
  expect(m[3].spans).toEqual([{ i: 26, f: 35, color: "rosa" }]);
  expect(m[1]).toMatchObject({ color: "azul", displaced: true, spans: [] });
});

test("notes, favorite and tags make the strip under the verse", () => {
  const long = "x".repeat(100);
  const m = chapterMarks(
    [{ id: "h", ancora: at(1), cor: null, etiquetas: ["t1"] }],
    [
      { id: "n2", ancora: at(1), texto: "depois", criado_em: "2026-02-01", etiquetas: ["t2"] },
      { id: "n1", ancora: at(1), texto: long, criado_em: "2026-01-01" }
    ],
    [{ id: "f", ancora: at(1) }],
    [
      { id: "t1", nome: "criação" },
      { id: "t2", nome: "estudo" }
    ],
    textOf
  );
  expect(m[1]).toMatchObject({ notes: 2, moreNotes: 1, favorite: true, tags: ["criação", "estudo"], bar: "" });
  expect(m[1].firstNote).toBe("x".repeat(88) + "…");
});

test("a new snippet over part of an older one: both show, the newer on top", () => {
  // "E disse Deus: Haja luz; e houve luz." — old: "disse Deus: Haja" (2–18); new: "Deus: Haja luz" (8–22)
  const m = chapterMarks(
    [
      {
        id: "old",
        ancora: at(3, { camada: "blivre", inicio: 2, fim: 18, trecho: "disse Deus: Haja" }),
        cor: "verde",
        alterado_em: "2026-01-01"
      },
      {
        id: "new",
        ancora: at(3, { camada: "blivre", inicio: 8, fim: 22, trecho: "Deus: Haja luz" }),
        cor: "rosa",
        alterado_em: "2026-02-01"
      }
    ],
    [],
    [],
    [],
    textOf
  );
  expect(m[3].spans).toEqual([
    { i: 2, f: 8, color: "verde" },
    { i: 8, f: 22, color: "rosa" }
  ]);
  expect(textPieces(TEXT[3], m[3].spans).map(p => p.text)).toEqual(["E ", "disse ", "Deus: Haja luz", "; e houve luz."]);
});

test("an older snippet inside a newer one disappears under it; around a newer one inside, the older shows", () => {
  const blivre = (id: string, i: number, f: number, cor: string, when: string) => ({
    id,
    ancora: at(3, { camada: "blivre", inicio: i, fim: f, trecho: TEXT[3].slice(i, f) }),
    cor,
    alterado_em: when
  });
  const inside = chapterMarks([blivre("a", 14, 22, "azul", "1"), blivre("b", 0, 36, "verde", "2")], [], [], [], textOf);
  expect(inside[3].spans).toEqual([{ i: 0, f: 36, color: "verde" }]);
  const around = chapterMarks([blivre("a", 0, 36, "verde", "1"), blivre("b", 14, 22, "azul", "2")], [], [], [], textOf);
  expect(around[3].spans).toEqual([
    { i: 0, f: 14, color: "verde" },
    { i: 14, f: 22, color: "azul" },
    { i: 22, f: 36, color: "verde" }
  ]);
});
