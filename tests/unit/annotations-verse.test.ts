import { beforeEach, expect, test, vi } from "vitest";
import { anchorKey, tagKey, verseAnchor } from "../../src/lib/annotations/verse";

async function setup() {
  vi.resetModules();
  const { createAnnotationStore } = await import("../../src/lib/annotations/store");
  const { createVerseAnnotations } = await import("../../src/lib/annotations/verse");
  const store = createAnnotationStore(undefined);
  return { store, verse: createVerseAnnotations(store) };
}
const a = verseAnchor("JHN", 3, 16);
beforeEach(() => vi.stubGlobal("localStorage", undefined));

test("keys", () => {
  expect(anchorKey(a)).toBe("JHN.3.16:versiculo:");
  expect(anchorKey({ ...a, camada: "blivre", inicio: 4, fim: 9 })).toBe("JHN.3.16:blivre:4-9");
  expect(tagKey("#Oração ")).toBe("oracao");
});

test("color: set, change, and taking it off keeps a highlight that still has tags", async () => {
  const { verse } = await setup();
  await verse.setColor(a, "verde");
  await verse.setColor(a, "azul");
  expect((await verse.highlightOf(a))?.cor).toBe("azul");
  const tag = await verse.tagNamed("#promessas");
  await verse.toggleTag(a, tag.id);
  await verse.setColor(a, null);
  expect(await verse.highlightOf(a)).toMatchObject({ cor: null, etiquetas: [tag.id] });
  await verse.toggleTag(a, tag.id);
  expect(await verse.highlightOf(a)).toBeNull();
});

test("a tag belongs to the whole verse: every record gets it, and a new favorite starts with it", async () => {
  const { verse } = await setup();
  const tag = await verse.tagNamed("oração");
  expect(await verse.tagNamed("Oração")).toMatchObject({ id: tag.id });
  await verse.toggleTag(a, tag.id); // nothing on the verse yet: a highlight without color holds the tag
  await verse.saveNote(null, a, "Deus amou o mundo");
  await verse.toggleFavorite(a);
  const r = await verse.records(a);
  expect([...r.marcacoes, ...r.notas, ...r.favoritos].map(x => x.etiquetas)).toEqual([[tag.id], [tag.id], [tag.id]]);
  expect((await verse.tagChoices(a)).mine.map(x => x.nome)).toEqual(["oração"]);
});

test("clear everything of the verse, then undo", async () => {
  const { verse } = await setup();
  await verse.setColor(a, "rosa");
  await verse.saveNote(null, a, "nota");
  await verse.toggleFavorite(a);
  const gone = await verse.clear(a);
  expect(gone.count).toBe(3);
  expect(await verse.hasAny(a)).toBe(false);
  await gone.undo();
  expect(await verse.hasAny(a)).toBe(true);
  expect((await verse.notes(a)).map(n => n.texto)).toEqual(["nota"]);
});

test("the quick note edits the first note of the verse", async () => {
  const { verse } = await setup();
  const first = await verse.saveNote(null, a, "primeira", "Por que Nicodemos veio de noite?");
  await verse.saveNote(null, a, "segunda");
  const edited = await verse.saveNote(first, a, "primeira, revista");
  expect(edited).toMatchObject({ id: first.id, texto: "primeira, revista", titulo: "Por que Nicodemos veio de noite?" });
  expect((await verse.notes(a)).map(n => n.texto)).toEqual(["primeira, revista", "segunda"]);
});
