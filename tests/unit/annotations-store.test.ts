import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClock } from "../../src/lib/annotations/clock";

describe("hybrid clock", () => {
  test("stamps sort as text in the order they were made, even within the same millisecond", () => {
    const clock = createClock("dev1", () => 1000);
    const a = clock.next(),
      b = clock.next();
    expect(a).toBe("00000000001000-0000-dev1");
    expect(b).toBe("00000000001000-0001-dev1");
    expect(a < b).toBe(true);
  });
  test("moves ahead of a newer stamp seen from another device (a phone with its clock behind)", () => {
    const clock = createClock("slow", () => 1000);
    clock.next("5000-7");
    expect(clock.next()).toBe("00000000005000-0009-slow");
  });
});

// in Node there is no IndexedDB: the store keeps everything in memory, as in a browser without it
async function memoryStore() {
  vi.resetModules();
  const { createAnnotationStore } = await import("../../src/lib/annotations/store");
  return createAnnotationStore(undefined);
}

describe("annotation store (memory)", () => {
  beforeEach(() => vi.stubGlobal("localStorage", undefined));

  test("save keeps the creation date, stamps the clock and notifies", async () => {
    const s = await memoryStore();
    const changed = vi.fn();
    s.onChange(changed);
    const first = await s.save("notas", { id: "n1", cap: "JHN.3", texto: "a" });
    const second = await s.save("notas", { id: "n1", texto: "b" });
    expect(second.criado_em).toBe(first.criado_em);
    expect(second.base).toBe(first.relogio);
    expect(second.relogio! > first.relogio!).toBe(true);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(await s.ofChapter("notas", "JHN.3")).toMatchObject([{ id: "n1", texto: "b" }]);
    expect(s.persistent()).toBe(false);
  });

  test("removed records stay as tombstones but are not listed", async () => {
    const s = await memoryStore();
    await s.save("favoritos", { id: "f1", cap: "GEN.1" });
    await s.removeRecord("favoritos", "f1");
    expect(await s.allRecords("favoritos")).toEqual([]);
    expect(await s.storage.brutos("favoritos")).toMatchObject([{ id: "f1", apagado: true }]);
  });

  test("merge: the higher clock wins and the same version twice changes nothing", async () => {
    const s = await memoryStore();
    const rec = { id: "m1", cap: "GEN.1", cor: "verde", relogio: "99999999999999-0000-other" };
    expect(await s.merge("marcacoes", rec)).toBe("novo");
    expect(await s.merge("marcacoes", rec)).toBe("igual");
    expect(await s.merge("marcacoes", { ...rec, cor: "azul", relogio: "00000000000001-0000-old" })).toBe("igual");
    expect(await s.merge("nada" as never, rec)).toBe("ignorado");
    // the clock moved ahead of what it saw: a local edit now wins over the merged one
    const mine = await s.save("marcacoes", { id: "m1", cor: "rosa" });
    expect(mine.relogio! > rec.relogio).toBe(true);
  });

  test("backup and import round trip, and a wrong file is refused", async () => {
    const a = await memoryStore();
    await a.save("notas", { id: "n1", cap: "PSA.23", texto: "O Senhor é o meu pastor" });
    const file = await a.backup();
    expect(file).toMatchObject({ formato: "biblia-interlinear-anotacoes", versao: 1 });

    const b = await memoryStore();
    const repaint = vi.fn();
    b.setRepaint(repaint);
    expect(await b.importBackup(file)).toEqual({ added: 1, updated: 0, same: 0 });
    expect(await b.importBackup(file)).toEqual({ added: 0, updated: 0, same: 1 });
    expect(repaint).toHaveBeenCalledTimes(2);
    await expect(b.importBackup({ formato: "outro" } as never)).rejects.toMatchObject({
      name: "BackupFormatError",
      message: "Este arquivo não é um backup de anotações da Bíblia Interlinear."
    });
  });
});
