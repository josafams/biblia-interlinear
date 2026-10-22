import { beforeEach, expect, test, vi } from "vitest";
import { verseAnchor } from "../../src/lib/annotations/verse";

async function setup() {
  vi.resetModules();
  const { createAnnotationStore } = await import("../../src/lib/annotations/store");
  const { createVerseAnnotations } = await import("../../src/lib/annotations/verse");
  const { createTagManager } = await import("../../src/lib/annotations/tags");
  const store = createAnnotationStore(undefined);
  return { verse: createVerseAnnotations(store), tags: createTagManager(store) };
}
const a = verseAnchor("ROM", 8, 28),
  b = verseAnchor("PSA", 23, 1);
beforeEach(() => vi.stubGlobal("localStorage", undefined));

test("rename; an empty or unchanged name does nothing", async () => {
  const { verse, tags } = await setup();
  const tag = await verse.tagNamed("promesa");
  expect(await tags.rename(tag.id, "promessas")).toEqual({});
  expect((await tags.list()).map(x => x.nome)).toEqual(["promessas"]);
  expect(await tags.rename(tag.id, "  ")).toBeNull();
  expect(await tags.rename(tag.id, "promessas")).toBeNull();
});

test("renaming to the name of another tag joins the two", async () => {
  const { verse, tags } = await setup();
  const one = await verse.tagNamed("consolo");
  const two = await verse.tagNamed("conforto");
  await verse.toggleTag(a, one.id);
  await verse.toggleTag(b, two.id);
  const r = await tags.rename(one.id, "Conforto");
  expect(r?.merged).toMatchObject({ from: { nome: "consolo" }, into: { id: two.id } });
  expect((await tags.list()).map(x => x.nome)).toEqual(["conforto"]);
  expect(await verse.tags(a)).toEqual([two.id]);
});

test("delete takes the tag off every record; a highlight left with nothing goes away", async () => {
  const { verse, tags } = await setup();
  const tag = await verse.tagNamed("estudar");
  await verse.toggleTag(a, tag.id); // a highlight without color holds it
  await verse.setColor(b, "verde");
  await verse.toggleTag(b, tag.id);
  await tags.remove(tag.id);
  expect(await tags.list()).toEqual([]);
  expect(await verse.hasAny(a)).toBe(false);
  expect(await verse.highlightOf(b)).toMatchObject({ cor: "verde", etiquetas: [] });
});
