// Two devices of one account syncing through a fake Google Drive, each with its own IndexedDB (fake-indexeddb).
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import Dexie from "dexie";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Drive, DriveFile } from "../../src/lib/sync/engine";

function fakeDrive() {
  const files = new Map<string, DriveFile & { body: unknown }>();
  let n = 0;
  const drive: Drive = {
    async queryDrive(q) {
      const prefix = /name contains '([^']+)'/.exec(q)![1];
      const since = /createdTime > '([^']+)'/.exec(q)?.[1];
      return [...files.values()].filter(f => f.name.includes(prefix) && (!since || f.createdTime > since));
    },
    async readStorage(id) {
      return structuredClone(files.get(id)!.body) as never;
    },
    async save(name, body) {
      const id = `f${++n}`;
      files.set(id, { id, name, createdTime: new Date(Date.now() + n).toISOString(), body: structuredClone(body) });
      return { id };
    },
    async removeRecord(id) {
      files.delete(id);
    }
  };
  return { drive, files };
}

// each device: a fresh module graph (its own device id and clock) and its own IndexedDB
async function device(drive: Drive, name: string) {
  vi.resetModules();

  const saved = new Map<string, string>([["interlinear:aparelho", name]]);
  vi.stubGlobal("localStorage", { getItem: (k: string) => saved.get(k) ?? null, setItem: (k: string, v: string) => saved.set(k, v) });
  const { createAnnotationStore } = await import("../../src/lib/annotations/store");
  const { createSync } = await import("../../src/lib/sync/engine");
  const store = createAnnotationStore(Dexie, { indexedDB: new IDBFactory(), IDBKeyRange });
  await store.ready;
  const account = { status: () => "connected", account: () => ({ email: "a@b.c" }), rerender: () => {}, drive };
  return { store, sync: createSync({ storage: store.storage, account, online: () => true }) };
}

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("a note written on one device arrives on the other, and an edit comes back", async () => {
  const { drive, files } = fakeDrive();
  const phone = await device(drive, "phone001");
  const laptop = await device(drive, "laptop01");

  await phone.store.save("notas", { id: "n1", cap: "JHN.3", texto: "Deus amou o mundo" });
  await phone.sync.cycle();
  expect([...files.values()].map(f => f.name)).toEqual([expect.stringMatching(/^lote-phone001-\d+\.json$/)]);
  expect(phone.sync.statusSummary()).toMatchObject({ tipo: "ok", texto: expect.stringMatching(/^Sincronizado às \d\d:\d\d$/) });

  await laptop.sync.cycle();
  expect(await laptop.store.allRecords("notas")).toMatchObject([{ id: "n1", texto: "Deus amou o mundo" }]);

  await laptop.store.save("notas", { id: "n1", texto: "Deus amou o mundo de tal maneira" });
  await laptop.sync.cycle();
  await phone.sync.cycle();
  expect(await phone.store.allRecords("notas")).toMatchObject([{ id: "n1", texto: "Deus amou o mundo de tal maneira" }]);
  // the queue was emptied after each send
  expect(await phone.store.storage.fila()).toEqual([]);
});

test("a note edited on both devices before syncing becomes two, so no text is lost", async () => {
  const { drive } = fakeDrive();
  const phone = await device(drive, "phone001");
  const laptop = await device(drive, "laptop01");
  await phone.store.save("notas", { id: "n1", cap: "PSA.23", texto: "pastor" });
  await phone.sync.cycle();
  await laptop.sync.cycle();

  await phone.store.save("notas", { id: "n1", texto: "pastor (celular)" });
  await laptop.store.save("notas", { id: "n1", texto: "pastor (computador)" });
  await phone.sync.cycle();
  await laptop.sync.cycle();

  const texts = (await laptop.store.allRecords("notas")).map(n => n.texto).sort();
  expect(texts).toEqual(["pastor (celular)", "pastor (computador)"]);
  expect((await laptop.store.allRecords("notas")).some(n => /\(conflito de \d\d\/\d\d\)$/.test(String(n.titulo)))).toBe(true);
});

test("offline: the changes wait on the device", async () => {
  const { drive, files } = fakeDrive();
  vi.resetModules();

  vi.stubGlobal("localStorage", undefined);
  const { createAnnotationStore } = await import("../../src/lib/annotations/store");
  const { createSync } = await import("../../src/lib/sync/engine");
  const store = createAnnotationStore(Dexie, { indexedDB: new IDBFactory(), IDBKeyRange });
  const account = { status: () => "connected", account: () => null, rerender: () => {}, drive };
  const sync = createSync({ storage: store.storage, account, online: () => false });
  await store.save("favoritos", { id: "f1", cap: "GEN.1" });
  await sync.cycle();
  expect(files.size).toBe(0);
  expect(sync.statusSummary()).toEqual({ tipo: "alerta", texto: "Sem internet — as mudanças esperam neste aparelho" });
  expect(await store.storage.fila()).toHaveLength(1);
});
