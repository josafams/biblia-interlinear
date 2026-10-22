// Sync of the annotations through the person's Google Drive (the app's hidden folder), with no server.
//
// The device is the everyday source: every write goes to the local database and to the queue (store.ts).
// With the account connected, a cycle runs by itself (web/sync.js says when):
//   1. Receive: lists the new batches of other devices (since the last marker) and applies them record by
//      record — the higher clock wins; notes edited on both sides become two (the other as a "conflict").
//      A new device, or one idle for more than 30 days, starts from the latest snapshot.
//   2. Send: writes the queue into a new file lote-<device>-<time>.json (files are never edited, so two
//      devices never fight over the same file) and only then clears the queue.
//   3. Compact (at most once a day, with many batches): writes retrato-<time>-<device>.json with everything
//      and deletes batches older than 30 days already in it; deletions older than 90 days go for good.
// Applying the same batch twice gives the same result: a failure halfway breaks nothing.
// File names and contents are read by every device of the account, so they stay as they are.
import { t } from "../../i18n";
import type { Collection, MergeResult, StoredRecord } from "../annotations/store";

export type DriveFile = { id: string; name: string; createdTime: string };
export type Drive = {
  queryDrive(q: string): Promise<DriveFile[]>;
  readStorage(id: string): Promise<{ colecoes?: Partial<Record<Collection, StoredRecord[]>>; ate?: string }>;
  save(name: string, body: unknown): Promise<{ id: string }>;
  removeRecord(id: string): Promise<unknown>;
};
export type SyncStorage = {
  colecoes: readonly Collection[];
  aparelho: string;
  persistente(): boolean;
  fila(): Promise<{ seq?: number; colecao: Collection; id: string }[]>;
  tirarDaFila(seqs: number[]): Promise<void>;
  readStorage(c: Collection, id: string): Promise<StoredRecord | undefined>;
  brutos(c: Collection): Promise<StoredRecord[]>;
  merge(c: Collection, r: StoredRecord, o: { fromCloud: boolean }): Promise<MergeResult>;
  afterApply(): void;
  estado(k: string, v?: unknown): Promise<unknown>;
  purgeDeleted(c: Collection, ids: string[]): Promise<void>;
  enqueueAll(): Promise<void>;
};
export type SyncAccount = {
  status(): string;
  account(): { email?: string } | null;
  rerender(): void;
  drive: Drive;
};
/** What the account box shows: kind "ok", "alerta" (warning) or "" (working). */
export type SyncStatus = { tipo: "ok" | "alerta" | ""; texto: string };
type State = {
  email: string;
  marcador: string | null;
  aplicados: Record<string, string>;
  inicial: boolean;
  compactado_em: string | null;
};

// Drive queries (files of the app's hidden folder)
const SNAPSHOTS = "name contains 'retrato-'"; // i18n-ignore
const BATCHES = "name contains 'lote-'"; // i18n-ignore
export const DELAY_MS = 3000;
const BATCH_LIMIT = 40,
  DAY_MS = 864e5,
  BATCH_RETENTION_DAYS = 30,
  DELETED_RETENTION_DAYS = 90;
const OVERLAP_MS = 2 * 60000; // the Drive listing can lag a little: read the last 2 minutes again (applying again changes nothing)

export function createSync(o: {
  storage: SyncStorage;
  account: SyncAccount;
  /** The reading preferences of another device arrived. */
  onPreferences?: (r: StoredRecord) => void;
  online?: () => boolean;
  now?: () => number;
}) {
  const B = o.storage,
    C = o.account;
  const now = o.now || Date.now;
  const online = o.online || (() => typeof navigator === "undefined" || navigator.onLine !== false);
  let running: Promise<void> | null = null,
    again = false,
    timer: ReturnType<typeof setTimeout> | undefined,
    applying = false,
    stopped = false,
    status: SyncStatus | null = null;

  function display(tipo: SyncStatus["tipo"], texto: string) {
    if (status && status.tipo === tipo && status.texto === texto) return;
    status = { tipo, texto };
    C.rerender();
  }
  function schedule(ms = DELAY_MS) {
    clearTimeout(timer);
    timer = setTimeout(cycle, ms);
  }

  async function readState(): Promise<State> {
    const email = C.account()?.email || "";
    let st = (await B.estado("sinc")) as State | undefined;
    if (!st || st.email !== email) st = { email, marcador: null, aplicados: {}, inicial: false, compactado_em: null };
    return st;
  }
  const saveState = (st: State) => B.estado("sinc", st);

  // ---------- one cycle ----------
  async function cycle(): Promise<void> {
    if (stopped || C.status() !== "connected" || !B.persistente()) return;
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        if (!online()) return display("alerta", t("sync.offline"));
        const st = await readState();
        if (!st.inicial) await firstLogin(st);
        await receive(st);
        await upload();
        await compact(st).catch(() => {}); // compacting is only cleanup: if it fails, it tries another day
        await saveState(st);
        const h = new Date(now());
        display("ok", t("sync.done", { time: `${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}` }));
      } catch (e) {
        const code = (e as { errorCode?: string }).errorCode;
        if (code === "reconnect" || code === "signed-out" || code === "interaction-required") return; // the account box says what to do
        if (code === "drive-full") display("alerta", t("sync.drive_full"));
        else if (e instanceof TypeError) display("alerta", t("sync.offline"));
        else display("alerta", t("sync.failed"));
      } finally {
        running = null;
        if (again) {
          again = false;
          schedule(500);
        }
      }
    })();
    return running;
  }

  // First time of this account on this device: everything noted here goes up to the account, without asking
  async function firstLogin(st: State) {
    await B.enqueueAll();
    st.inicial = true;
    await saveState(st);
  }

  async function applyChanges(colecoes: Partial<Record<Collection, StoredRecord[]>> | undefined) {
    let changed = 0;
    applying = true;
    try {
      for (const c of B.colecoes)
        for (const r of colecoes?.[c] || []) {
          const res = await B.merge(c, r, { fromCloud: true });
          if (res === "novo" || res === "atualizado") {
            changed++;
            if (c === "preferencias" && r.id === "leitura" && !r.apagado)
              try {
                o.onPreferences?.(r);
              } catch {
                /* a bad preferences record does not stop the sync */
              }
          }
        }
      if (changed) B.afterApply();
    } finally {
      applying = false;
    }
    return changed;
  }

  async function receive(st: State) {
    const recent = st.marcador && now() - Date.parse(st.marcador) < (BATCH_RETENTION_DAYS - 1) * DAY_MS;
    if (!recent) {
      const snapshots = await C.drive.queryDrive(SNAPSHOTS);
      const latest = snapshots[snapshots.length - 1];
      if (latest) {
        display("", t("sync.receiving_all"));
        const d = await C.drive.readStorage(latest.id);
        await applyChanges(d.colecoes);
        if (d.ate && (!st.marcador || d.ate > st.marcador)) st.marcador = d.ate;
        await saveState(st);
      }
    }
    const since = st.marcador ? new Date(Date.parse(st.marcador) - OVERLAP_MS).toISOString() : null;
    const batches = await C.drive.queryDrive(BATCHES + (since ? ` and createdTime > '${since}'` : ""));
    const mine = `lote-${B.aparelho}-`;
    for (const l of batches) {
      if (!l.name.startsWith(mine) && !st.aplicados[l.name]) {
        display("", t("sync.receiving"));
        const d = await C.drive.readStorage(l.id);
        await applyChanges(d.colecoes);
        st.aplicados[l.name] = l.createdTime;
      }
      if (!st.marcador || l.createdTime > st.marcador) st.marcador = l.createdTime;
      await saveState(st);
    }
    // the list of applied batches only needs to cover the overlap
    const cutoff = st.marcador ? new Date(Date.parse(st.marcador) - 2 * OVERLAP_MS).toISOString() : "";
    for (const [name, when] of Object.entries(st.aplicados)) if (when < cutoff) delete st.aplicados[name];
  }

  async function upload() {
    const queue = await B.fila();
    if (!queue.length) return;
    const ids: Partial<Record<Collection, Set<string>>> = {};
    for (const f of queue) (ids[f.colecao] ??= new Set()).add(f.id);
    const colecoes: Partial<Record<Collection, StoredRecord[]>> = {};
    let n = 0;
    for (const [c, set] of Object.entries(ids) as [Collection, Set<string>][])
      for (const id of set) {
        const r = await B.readStorage(c, id);
        if (r && !r.local) {
          (colecoes[c] ??= []).push(r);
          n++;
        }
      }
    if (n) {
      display("", t("sync.sending", { count: n }));
      const at = new Date(now());
      await C.drive.save(`lote-${B.aparelho}-${at.getTime()}.json`, {
        formato: "biblia-interlinear-lote",
        versao: 1,
        aparelho: B.aparelho,
        criado_em: at.toISOString(),
        colecoes
      });
    }
    await B.tirarDaFila(queue.map(f => f.seq!)); // only after Drive confirmed
  }

  async function compact(st: State, force = false) {
    if (!force && st.compactado_em && now() - Date.parse(st.compactado_em) < DAY_MS) return;
    st.compactado_em = new Date(now()).toISOString();
    const batches = await C.drive.queryDrive(BATCHES);
    if (!force && batches.length <= BATCH_LIMIT) return;
    // old deletions go for good (here and in the snapshot)
    const oldIso = new Date(now() - DELETED_RETENTION_DAYS * DAY_MS).toISOString();
    const colecoes: Partial<Record<Collection, StoredRecord[]>> = {};
    for (const c of B.colecoes) {
      const recs = await B.brutos(c);
      const purged = recs.filter(r => r.apagado && (r.alterado_em || "") < oldIso).map(r => r.id);
      if (purged.length) await B.purgeDeleted(c, purged);
      colecoes[c] = recs.filter(r => !r.local && !purged.includes(r.id));
    }
    const at = new Date(now());
    const ate = st.marcador || at.toISOString();
    const fresh = await C.drive.save(`retrato-${at.getTime()}-${B.aparelho}.json`, {
      formato: "biblia-interlinear-retrato",
      versao: 1,
      aparelho: B.aparelho,
      criado_em: at.toISOString(),
      ate,
      colecoes
    });
    const limit = new Date(now() - BATCH_RETENTION_DAYS * DAY_MS).toISOString();
    for (const l of batches) if (l.createdTime < limit && l.createdTime <= ate) await C.drive.removeRecord(l.id);
    // older snapshots: the new one has everything (if two devices compact together, both have the same content)
    for (const r of await C.drive.queryDrive(SNAPSHOTS)) if (r.id !== fresh.id) await C.drive.removeRecord(r.id);
  }

  return {
    cycle,
    schedule,
    /** A local change: sync a few seconds later (not for changes the sync itself is applying). */
    changed() {
      if (!applying) schedule(DELAY_MS);
    },
    connected() {
      stopped = false;
      schedule(300);
    },
    disconnected() {
      status = null;
    },
    wentOffline() {
      if (C.status() === "connected") display("alerta", t("sync.offline"));
    },
    statusSummary: () => (C.status() === "connected" ? status : null),
    async halt() {
      stopped = true;
      clearTimeout(timer);
      if (running) await running.catch(() => {});
    },
    async beforeWipe() {
      stopped = true;
      if (running) await running.catch(() => {});
    },
    async compactNow() {
      const st = await readState();
      await compact(st, true);
      await saveState(st);
    }
  };
}
