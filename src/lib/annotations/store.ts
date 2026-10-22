// The local database of annotations and synced data: highlights, notes, favorites, tags, preferences and
// reading progress, in IndexedDB (Dexie) or, when the browser has none, in memory for this visit.
// Every write goes into a queue (`fila`) that the Google Drive sync sends (web/sync.js).
//
// Collection and field names are saved on devices, in backups and in Google Drive, so they stay in Portuguese:
// records have id, cap ("GEN.1"), criado_em, alterado_em, relogio (hybrid clock), base (the clock it was
// edited from), apagado (deleted, kept as a tombstone) and local ("only on this device": not synced).
import type Dexie from "dexie";
import type { DexieOptions } from "dexie";
import type { Table } from "dexie";
import { t } from "../../i18n";
import { store } from "../store";
import { createClock } from "./clock";

export const COLLECTIONS = ["marcacoes", "notas", "favoritos", "etiquetas"] as const;
/** What travels to Google Drive: annotations, preferences (reading mode, position) and progress. */
export const SYNCED = [...COLLECTIONS, "preferencias", "leituras", "tempo", "planos"] as const;
export type Collection = (typeof SYNCED)[number];

export type StoredRecord = {
  id: string;
  cap?: string;
  criado_em?: string;
  alterado_em?: string;
  relogio?: string | null;
  base?: string | null;
  apagado?: boolean;
  local?: boolean;
  [field: string]: unknown;
};
export type MergeResult = "novo" | "atualizado" | "igual" | "ignorado";
export type Backup = {
  formato: "biblia-interlinear-anotacoes";
  versao: 1;
  exportado_em: string;
  aparelho: string;
  colecoes: Partial<Record<Collection, StoredRecord[]>>;
};

const BACKUP_FORMAT = "biblia-interlinear-anotacoes";

export const uuid = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      });

/** This device's short id, kept in localStorage (a new one each visit when storage is blocked). */
function deviceId() {
  const saved = store.get("aparelho", null);
  if (saved) return saved;
  const id = uuid().slice(0, 8);
  store.set("aparelho", id);
  return id;
}

type Db = Dexie &
  Record<Collection, Table<StoredRecord, string>> & {
    fila: Table<{ seq?: number; colecao: Collection; id: string }, number>;
    estado: Table<{ chave: string; valor: unknown }, string>;
  };

function openDexie(DexieClass: typeof Dexie | undefined, options?: DexieOptions): Db | null {
  try {
    if (!DexieClass || (!options?.indexedDB && typeof indexedDB === "undefined")) return null;
    const db = new DexieClass("biblia-interlinear", options) as Db;
    db.version(1).stores({
      marcacoes: "id, cap, alterado_em, apagado",
      notas: "id, cap, alterado_em, apagado",
      favoritos: "id, cap, alterado_em, apagado",
      etiquetas: "id, nome, apagado",
      fila: "++seq, colecao, id",
      estado: "chave"
    });
    db.version(2).stores({ preferencias: "id" });
    db.version(3).stores({ leituras: "id, livro", tempo: "id, dia", planos: "id" });
    return db;
  } catch {
    return null;
  }
}

// options: Dexie options (the tests give each simulated device its own IndexedDB)
export function createAnnotationStore(DexieClass?: typeof Dexie, options?: DexieOptions) {
  const device = deviceId();
  const clock = createClock(device);
  let db = openDexie(DexieClass, options);
  let memory: Record<Collection, Map<string, StoredRecord>> | null = null;
  const memoryState: Record<string, unknown> = {};
  const listeners: (() => void)[] = [];
  let repaint = () => {};

  const toMemory = () => {
    db = null;
    memory = Object.fromEntries(SYNCED.map(c => [c, new Map()])) as typeof memory;
    return false;
  };
  const ready: Promise<boolean> = (async () => {
    if (!db) return toMemory();
    try {
      await db.open();
      return true;
    } catch {
      return toMemory();
    }
  })();

  const get = (c: Collection, id: string) => (db ? db[c].get(id) : Promise.resolve(memory![c].get(id)));
  const raw = (c: Collection) => (db ? db[c].toArray() : Promise.resolve([...memory![c].values()]));

  function notify() {
    for (const f of listeners)
      try {
        f();
      } catch {
        /* one broken listener does not stop the others */
      }
  }

  async function allRecords(c: Collection) {
    await ready;
    return (await raw(c)).filter(r => !r.apagado);
  }
  async function ofChapter(c: Collection, cap: string) {
    await ready;
    const list = db ? await db[c].where("cap").equals(cap).toArray() : [...memory![c].values()].filter(r => r.cap === cap);
    return list.filter(r => !r.apagado);
  }
  async function save(c: Collection, rec: StoredRecord) {
    await ready;
    const now = new Date().toISOString();
    const old = await get(c, rec.id);
    const fresh: StoredRecord = {
      ...old,
      ...rec,
      criado_em: old?.criado_em || now,
      alterado_em: now,
      base: old?.relogio || null,
      relogio: clock.next(),
      apagado: rec.apagado || false
    };
    delete fresh.local; // editing something kept "only on this device" makes it sync again
    if (db) {
      const d = db;
      await d.transaction("rw", d[c], d.fila, async () => {
        await d[c].put(fresh);
        await d.fila.add({ colecao: c, id: fresh.id });
      });
    } else memory![c].set(fresh.id, fresh);
    notify();
    return fresh;
  }
  const removeRecord = (c: Collection, id: string) => save(c, { id, apagado: true });

  // ---------- merge (backup and sync) ----------
  // A record from elsewhere: the higher clock wins (applying the same version twice changes nothing).
  // A note edited on both sides at once — this one not sent yet, and the other not based on this version —
  // becomes two: the winner keeps the id and the other becomes a copy "(conflito de dd/mm)". No text is lost.
  const queued = async (id: string) => (db ? (await db.fila.where("id").equals(id).count()) > 0 : false);
  const isNoteConflict = (here: StoredRecord, there: StoredRecord, pending: boolean) =>
    pending &&
    !here.apagado &&
    !there.apagado &&
    there.base !== here.relogio &&
    ((here.texto || "") !== (there.texto || "") || (here.titulo || "") !== (there.titulo || ""));
  async function conflictCopy(n: StoredRecord) {
    const d = new Date(Number((n.relogio || "").split("-")[0]) || Date.now());
    const date = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const copy: StoredRecord = {
      ...n,
      id: uuid(),
      titulo: t("annotations.conflict_title", { title: String(n.titulo || t("annotations.note")), date })
    };
    delete copy.relogio;
    delete copy.base;
    delete copy.criado_em;
    return save("notas", copy);
  }
  async function merge(c: Collection, r: StoredRecord, { fromCloud = false } = {}): Promise<MergeResult> {
    if (!r || !r.id || !SYNCED.includes(c)) return "ignorado";
    await ready;
    const here = await get(c, r.id);
    if (r.relogio) clock.next(r.relogio.split("-").slice(0, 2).join("-"));
    if (here && (here.relogio || "") >= (r.relogio || "")) {
      if (c === "notas" && here.relogio !== r.relogio && isNoteConflict(here, r, await queued(r.id))) await conflictCopy(r);
      return "igual";
    }
    const conflict = c === "notas" && here && isNoteConflict(here, r, await queued(r.id));
    const fresh = { ...r };
    delete fresh.local;
    if (db) {
      const d = db;
      await d.transaction("rw", d[c], d.fila, async () => {
        await d[c].put(fresh);
        if (fromCloud)
          await d.fila.where("id").equals(r.id).delete(); // the version here lost: do not send it again
        else await d.fila.add({ colecao: c, id: r.id });
      });
    } else memory![c].set(r.id, fresh);
    if (conflict) await conflictCopy(here);
    return here ? "atualizado" : "novo";
  }

  // ---------- backup file (JSON) ----------
  async function backup(): Promise<Backup> {
    await ready;
    const payload: Backup = { formato: BACKUP_FORMAT, versao: 1, exportado_em: new Date().toISOString(), aparelho: device, colecoes: {} };
    for (const c of SYNCED) payload.colecoes[c] = await raw(c);
    return payload;
  }
  /** Joins a backup with what is here: new records come in; existing ones keep the newest version. */
  async function importBackup(payload: Partial<Backup> | null) {
    if (!payload || payload.formato !== BACKUP_FORMAT || !payload.colecoes) {
      const err = new Error(t("annotations.backup.not_a_backup"));
      err.name = "BackupFormatError";
      throw err;
    }
    await ready;
    let added = 0,
      updated = 0,
      same = 0;
    for (const c of SYNCED)
      for (const r of payload.colecoes[c] || []) {
        const res = await merge(c, r);
        if (res === "novo") added++;
        else if (res === "atualizado") updated++;
        else if (res === "igual") same++;
      }
    notify();
    repaint();
    return { added, updated, same };
  }

  // ---------- low-level access for the sync (web/sync.js); the method names are its API ----------
  const all = () => [...SYNCED.map(c => db![c]), db!.fila];
  const storage = {
    colecoes: SYNCED,
    aparelho: device,
    persistente: () => !!db,
    async fila() {
      await ready;
      return db ? db.fila.toArray() : [];
    },
    async tirarDaFila(seqs: number[]) {
      await ready;
      if (db && seqs.length) await db.fila.bulkDelete(seqs);
    },
    async readStorage(c: Collection, id: string) {
      await ready;
      return get(c, id);
    },
    async brutos(c: Collection) {
      await ready;
      return raw(c);
    },
    merge,
    afterApply() {
      notify();
      repaint();
    },
    async estado(k: string, v?: unknown) {
      await ready;
      if (!db) {
        if (v !== undefined) memoryState[k] = v;
        return memoryState[k];
      }
      if (v === undefined) return (await db.estado.get(k))?.valor;
      await db.estado.put({ chave: k, valor: v });
      return v;
    },
    async purgeDeleted(c: Collection, ids: string[]) {
      await ready;
      if (db) await db[c].bulkDelete(ids);
      else ids.forEach(i => memory![c].delete(i));
    },
    // "Manter só neste aparelho": what exists now does not go up to the account (until edited again)
    async soNesteAparelho() {
      await ready;
      const d = db;
      if (!d) return;
      await d.transaction("rw", all(), async () => {
        for (const c of SYNCED)
          await d[c].toCollection().modify(r => {
            r.local = true;
          });
        await d.fila.clear();
      });
    },
    // "Enviar para a conta": everything here (except what is "only on this device") goes into the queue
    async enqueueAll() {
      await ready;
      const d = db;
      if (!d) return;
      await d.transaction("rw", all(), async () => {
        for (const c of SYNCED) {
          const ids = (await d[c].toArray()).filter(r => !r.local).map(r => ({ colecao: c, id: r.id }));
          if (ids.length) await d.fila.bulkAdd(ids);
        }
      });
    },
    async wipeAll() {
      await ready;
      const d = db;
      if (d)
        await d.transaction("rw", all(), async () => {
          for (const c of SYNCED) await d[c].clear();
          await d.fila.clear();
        });
      else SYNCED.forEach(c => memory![c].clear());
      notify();
      repaint();
    }
  };

  return {
    device,
    ready,
    persistent: () => !!db,
    allRecords,
    ofChapter,
    save,
    removeRecord,
    merge,
    backup,
    importBackup,
    storage,
    onChange: (f: () => void) => listeners.push(f),
    /** What redraws the annotations on screen after an import, a sync or a wipe. */
    setRepaint(f: () => void) {
      repaint = f;
    }
  };
}
