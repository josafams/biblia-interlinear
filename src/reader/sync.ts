// Syncing the annotations through Google Drive: the engine is src/lib/sync/engine.ts; here is when it runs (a few
// seconds after each change, on opening, on coming back to the app, when the internet comes back and every 30 s
// with the screen visible) and window.Sync, used by the account, the tests and the videos.
import { createSync } from "../lib/sync/engine";

const INTERVAL_MS = 30000;

type Prefs = { readStorage(): Record<string, unknown>; applyChanges(p: unknown): void };

export function initSync() {
  const A = window.Annotations,
    C = window.Account;
  if (!A?.storage || !C) return;
  const prefs = () => window.__preferencias as Prefs | undefined;
  const sync = createSync({
    storage: A.storage as never,
    account: C as never,
    onPreferences: r => prefs()?.applyChanges(r)
  });
  (A.onChange as (f: () => void) => void)(() => sync.changed());
  (C.onChange as (f: (status: string) => void) => void)(status => {
    if (status === "connected") sync.connected();
    else sync.disconnected();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sync.schedule(500);
  });
  window.addEventListener("online", () => sync.schedule(500));
  window.addEventListener("offline", () => sync.wentOffline());
  setInterval(() => {
    if (document.visibilityState === "visible") sync.cycle();
  }, INTERVAL_MS);
  // the reading preferences (mode and the items shown) travel too: saved when the person changes them
  document.addEventListener("preferences-changed", () => {
    const p = prefs()?.readStorage();
    if (p) (A.save as (c: string, r: object) => void)("preferencias", { id: "leitura", ...p });
  });
  window.Sync = {
    currentTime: () => sync.cycle(),
    statusSummary: sync.statusSummary,
    halt: sync.halt,
    beforeWipe: sync.beforeWipe,
    compact: sync.compactNow
  };
}

// starts when imported, after the annotations and the account (see src/reader/main.ts)
initSync();
