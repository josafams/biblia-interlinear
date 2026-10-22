import { expect, test } from "vitest";
import { gotoPreview } from "../../src/lib/goto";
import { createRefs, type RefBook } from "../../src/lib/refs";

const JHN = {
  code: "JHN",
  name: "João",
  abbrev: "Jo",
  chapters: [
    { n: 1, v: 51, t: "O Verbo" },
    { n: 2, v: 25 },
    { n: 3, v: 36, t: "Nicodemos" }
  ]
} as RefBook;
const { parseRef, resolveRef } = createRefs([JHN]);
const here = { book: JHN, ch: 1 };
const chapters = { "JHN.3": { book: "JHN", chapter: 3, v: [{ n: 16, b: "Porque Deus amou o mundo…", w: [] }] } };
const preview = (q: string, has = () => true) => gotoPreview(resolveRef(parseRef(q, here), has), chapters);

test("nothing typed", () => expect(preview("")).toEqual({ kind: "none" }));
test("a verse with its text, when the chapter is loaded", () =>
  expect(preview("Jo 3:16")).toEqual({
    kind: "ok",
    ref: "João 3:16",
    theme: "Nicodemos",
    snippet: "Porque Deus amou o mundo…",
    button: "Jo 3:16"
  }));
test("a chapter", () => expect(preview("Jo 2")).toEqual({ kind: "ok", ref: "João 2", theme: "", snippet: "", button: "João 2" }));
test("a warning", () => expect(preview("Jo 9")).toEqual({ kind: "warn", html: "João tem 3 capítulos." }));
test("not in the preview build", () =>
  expect(preview("Jo 3:16", () => false)).toEqual({ kind: "na", ref: "João 3:16", theme: "Nicodemos" }));
