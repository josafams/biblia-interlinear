/* Sincronização das anotações pelo Google Drive: o motor está em src/lib/sync/engine.ts; aqui fica quando rodar
 * (alguns segundos depois de cada mudança, ao abrir, ao voltar para o app, quando a internet volta e a cada 30 s
 * com a tela visível) e a API window.Sync usada pela conta, pelos testes e pelos vídeos. */
import { createSync } from "../src/lib/sync/engine";

(function () {
  "use strict";
  const A = window.Annotations,
    C = window.Account;
  if (!A?.storage || !C) return;
  const INTERVAL_MS = 30000;
  const sync = createSync({
    storage: A.storage,
    account: C,
    onPreferences: r => window.__preferencias?.applyChanges(r)
  });

  A.onChange(() => sync.changed());
  C.onChange(accountStatus => {
    if (accountStatus === "connected") sync.connected();
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

  // Preferências de leitura (modo e itens visíveis) também viajam: grava quando a pessoa muda
  document.addEventListener("preferences-changed", () => {
    const p = window.__preferencias?.readStorage();
    if (p) A.save("preferencias", { id: "leitura", ...p });
  });

  window.Sync = {
    currentTime: () => sync.cycle(),
    statusSummary: sync.statusSummary,
    halt: sync.halt,
    beforeWipe: sync.beforeWipe,
    compact: sync.compactNow
  };
})();
