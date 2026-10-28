import { afterEach, expect, test } from "vitest";
import { getLocale, setLocale, t } from "../../src/i18n";
import en from "../../src/i18n/locales/en.json";
import ptBR from "../../src/i18n/locales/pt-BR.json";
import { localizeBooks } from "../../src/lib/books";
import { createRefs } from "../../src/lib/refs";

type Node = { [k: string]: string | Node };
const PLURAL = new Set(["zero", "one", "two", "few", "many", "other"]);
// leaf keys; a plural object ({one, other}) is one text
const leaves = (n: Node, prefix = ""): string[] =>
  Object.entries(n).flatMap(([k, v]) =>
    typeof v === "string" || Object.keys(v).every(p => PLURAL.has(p)) ? [prefix + k] : leaves(v, `${prefix}${k}.`)
  );

afterEach(() => setLocale("pt-BR"));

test("English has every text of Portuguese (the short grammar is keyed by the words of each locale)", () => {
  const have = new Set(leaves(en as Node));
  const missing = leaves(ptBR as Node).filter(k => !k.startsWith("morph.short.") && !have.has(k));
  expect(missing).toEqual([]);
});

test("the English placeholders are the same as the Portuguese ones", () => {
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  const at = (n: Node, key: string) => key.split(".").reduce<string | Node | undefined>((x, k) => (x as Node)?.[k], n);
  for (const key of leaves(ptBR as Node).filter(k => !k.startsWith("morph.short."))) {
    const a = at(ptBR as Node, key),
      b = at(en as Node, key);
    const texts = (x: string | Node | undefined) => (typeof x === "string" ? [x] : Object.values(x as Node).map(String));
    expect(params(texts(b).join(" ")), key).toEqual(params(texts(a).join(" ")));
  }
});

test("in English the books have English names, and the Portuguese themes and introduction are left out", () => {
  setLocale("en");
  expect(getLocale()).toBe("en");
  const [b] = localizeBooks([
    { code: "JHN", name: "João", abbrev: "Jo", group: "Evangelhos e Atos", about: {}, chapters: [{ n: 1, t: "O Verbo" }] }
  ]);
  expect(b).toEqual({ code: "JHN", name: "John", abbrev: "Jn", group: "Gospels and Acts", chapters: [{ n: 1 }] });
  expect(t("index.new_testament")).toBe("New Testament");
});

test("in English a translated book takes its themes and introduction; the others stay without them", () => {
  setLocale("en");
  const book = (code: string) => ({
    code,
    name: "",
    abbrev: "",
    group: "",
    about: { pt: true },
    chapters: [
      { n: 1, t: "tema" },
      { n: 2, t: "tema" }
    ]
  });
  const [jhn, rut] = localizeBooks([book("JHN"), book("RUT")], { JHN: { t: { "1": "The Word" }, about: { en: true } } });
  expect(jhn.about).toEqual({ en: true });
  expect(jhn.chapters).toEqual([{ n: 1, t: "The Word" }, { n: 2 }]);
  expect(rut.about).toBeUndefined();
  expect(rut.chapters).toEqual([{ n: 1 }, { n: 2 }]);
});

test("in Portuguese the books stay as in the data", () => {
  const book = { code: "JHN", name: "João", abbrev: "Jo", group: "Evangelhos e Atos", about: {}, chapters: [{ n: 1, t: "O Verbo" }] };
  expect(localizeBooks([structuredClone(book)])).toEqual([book]);
});

test("English references: Jn 3:16, psalms 23, ch 12", () => {
  setLocale("en");
  const books = localizeBooks([
    { code: "PSA", name: "Salmos", abbrev: "Sl", group: "", chapters: Array.from({ length: 150 }, (_, i) => ({ n: i + 1, v: 30 })) },
    { code: "JHN", name: "João", abbrev: "Jo", group: "", chapters: Array.from({ length: 21 }, (_, i) => ({ n: i + 1, v: 40 })) }
  ]);
  const refs = createRefs(books);
  const here = { book: books[1], ch: 1 };
  expect(refs.parseRef("Jn 3:16", here)).toMatchObject({ book: { code: "JHN" }, ch: 3, v: 16 });
  expect(refs.parseRef("psalms 23", here)).toMatchObject({ book: { code: "PSA" }, ch: 23 });
  expect(refs.parseRef("ch 12", here)).toMatchObject({ book: { code: "JHN" }, ch: 12 });
});
