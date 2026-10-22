import { describe, expect, test } from "vitest";
import { createRefs, type RefBook } from "../../src/lib/refs";

const chapters = (counts: number[]) => counts.map((v, i) => ({ n: i + 1, v }));
const GEN: RefBook = { code: "GEN", name: "Gênesis", abbrev: "Gn", chapters: chapters([31, 25, 24]) };
const JHN: RefBook = { code: "JHN", name: "João", abbrev: "Jo", chapters: chapters([51, 25, 36]) };
const SA1: RefBook = { code: "1SA", name: "1 Samuel", abbrev: "1 Sm", chapters: chapters(Array(31).fill(40)) };
const OBA: RefBook = { code: "OBA", name: "Obadias", abbrev: "Ob", chapters: chapters([21]) };
const { findBook, parseRef, resolveRef } = createRefs([GEN, JHN, SA1, OBA]);
const here = { book: GEN, ch: 2 };
const all = () => true;

describe("findBook", () => {
  test.each([
    ["Jo", JHN],
    ["joao", JHN],
    ["1sm", SA1],
    ["gen", GEN],
    ["Gên", GEN],
    ["xyz", null]
  ])("%s", (w, book) => expect(findBook(w)).toBe(book));
});

describe("parseRef", () => {
  test.each([
    ["Jo 3:16", { book: JHN, ch: 3, v: 16 }],
    ["1 Sm 17 4", { book: SA1, ch: 17, v: 4 }],
    ["joão 3", { book: JHN, ch: 3, v: null }],
    ["Jo", { book: JHN, ch: 1, v: null }],
    ["Gn", { book: GEN, ch: 2, v: null }],
    ["1:14", { book: GEN, ch: 1, v: 14 }],
    ["14", { book: GEN, ch: 2, v: 14, verseOnly: true }],
    ["3:", { book: GEN, ch: 3, v: null }],
    ["cap 12", { book: GEN, ch: 12, v: null }],
    ["Jo cap 2", { book: JHN, ch: 2, v: null }],
    ["Ob 5", { book: OBA, ch: 1, v: 5 }],
    ["Jo 3–16", { book: JHN, ch: 3, v: 16 }],
    ["Xyz 1", { error: "book", word: "Xyz" }],
    ["", null]
  ])("%s", (q, expected) => expect(parseRef(q, here)).toEqual(expected));
});

describe("resolveRef", () => {
  test("a valid reference", () =>
    expect(resolveRef(parseRef("Jo 3:16", here), all)).toEqual({ ok: true, book: JHN, ch: 3, v: 16, chapterStart: false }));
  test("chapter start", () => expect(resolveRef(parseRef("Jo 3", here), all)).toMatchObject({ v: 1, chapterStart: true }));
  test("too many chapters", () => expect(resolveRef(parseRef("Jo 9", here), all)).toEqual({ warn: "João tem 3 capítulos." }));
  test("one chapter", () => expect(resolveRef(parseRef("Ob 2:1", here), all)).toEqual({ warn: "Obadias tem 1 capítulo." }));
  test("too many verses", () => expect(resolveRef(parseRef("Jo 3:99", here), all)).toEqual({ warn: "João 3 tem 36 versículos." }));
  test("unknown book is escaped", () =>
    expect(resolveRef(parseRef("Abc<x 1", here), all)).toMatchObject({ warn: expect.stringContaining("“Abc”") }));
  test("chapter not in this build", () =>
    expect(resolveRef(parseRef("Jo 2", here), () => false)).toMatchObject({ book: JHN, v: null, na: { n: 2 } }));
});
