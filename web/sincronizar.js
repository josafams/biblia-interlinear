/* Sincronização das anotações pelo Google Drive da pessoa (pasta oculta do app), sem servidor.
 *
 * O aparelho é a fonte do dia a dia: toda gravação vai para o banco local e para a fila (web/anotacoes.js).
 * Com a conta ligada (web/conta.js), um ciclo roda sozinho — alguns segundos depois de cada mudança, ao abrir,
 * ao voltar para o app, quando a internet volta e a cada 30 s com a tela visível:
 *   1. Receber: lista os lotes novos de outros aparelhos (desde o último marcador) e aplica registro a registro —
 *      vence o relógio maior; notas editadas nos dois lados viram duas (a outra como "conflito").
 *      Aparelho novo, ou parado há mais de 30 dias, começa pelo retrato mais recente.
 *   2. Enviar: grava a fila num arquivo novo lote-<aparelho>-<hora>.json (arquivos nunca são editados,
 *      então dois aparelhos nunca brigam pelo mesmo arquivo) e só então limpa a fila.
 *   3. Compactar (no máximo 1 vez por dia, com muitos lotes): grava retrato-<hora>-<aparelho>.json com tudo
 *      e apaga lotes com mais de 30 dias já incluídos nele; exclusões com mais de 90 dias saem de vez.
 * Aplicar o mesmo lote duas vezes dá o mesmo resultado: uma queda no meio não estraga nada.
 */
(function () {
  "use strict";
  const A = window.Annotations,
    C = window.Account;
  if (!A?.storage || !C) return;
  const B = A.storage;
  const DELAY_MS = 3000,
    INTERVAL_MS = 30000,
    BATCH_LIMIT = 40,
    DAY_MS = 864e5,
    BATCH_RETENTION_DAYS = 30,
    DELETED_RETENTION_DAYS = 90;
  const OVERLAP_MS = 2 * 60000; // a lista do Drive pode demorar um pouco: relê os últimos 2 minutos (aplicar de novo não muda nada)

  let running = null,
    again = false,
    timer = 0,
    applying = false,
    stopped = false;
  let status = null;

  function display(tipo, texto) {
    if (status && status.tipo === tipo && status.texto === texto) return;
    status = { tipo, texto };
    C.redesenhar();
  }
  function schedule(ms = DELAY_MS) {
    clearTimeout(timer);
    timer = setTimeout(cycle, ms);
  }

  async function readState() {
    const email = C.account()?.email || "";
    let st = await B.estado("sinc");
    if (!st || st.email !== email) st = { email, marcador: null, aplicados: {}, inicial: false, compactado_em: null };
    return st;
  }
  const saveState = st => B.estado("sinc", st);

  // ---------- um ciclo ----------
  async function cycle() {
    if (stopped || C.estado() !== "ligado" || !B.persistente()) return;
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        if (navigator.onLine === false) return display("alerta", "Sem internet — as mudanças esperam neste aparelho");
        const st = await readState();
        if (!st.inicial && !(await firstLogin(st))) return;
        await receive(st);
        await upload();
        await compact(st).catch(() => {}); // compactar é só faxina: se falhar, tenta outro dia
        await saveState(st);
        const h = new Date();
        display("ok", `Sincronizado às ${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`);
      } catch (e) {
        if (e.markCode === "reconectar" || e.markCode === "fora" || e.markCode === "interacao") return; // a conta mostra o que fazer
        if (e.markCode === "drive-cheio") display("alerta", "Seu Google Drive está sem espaço — as mudanças esperam neste aparelho");
        else if (e instanceof TypeError) display("alerta", "Sem internet — as mudanças esperam neste aparelho");
        else display("alerta", "Não foi possível sincronizar agora; tentando de novo em instantes");
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

  // Primeira vez desta conta neste aparelho: tudo o que já foi anotado aqui sobe para a conta, sem perguntar
  async function firstLogin(st) {
    await B.enfileirarTudo();
    st.inicial = true;
    await saveState(st);
    return true;
  }

  async function aplicar(colecoes) {
    let changed = 0;
    applying = true;
    try {
      for (const c of B.colecoes) {
        for (const r of (colecoes && colecoes[c]) || []) {
          const res = await B.merge(c, r, { fromCloud: true });
          if (res === "novo" || res === "atualizado") {
            changed++;
            if (c === "preferencias" && r.id === "leitura" && !r.apagado) {
              try {
                window.__preferencias?.aplicar(r);
              } catch (_) {}
            }
          }
        }
      }
      if (changed) B.aplicado();
    } finally {
      applying = false;
    }
    return changed;
  }

  async function receive(st) {
    const recent = st.marcador && Date.now() - Date.parse(st.marcador) < (BATCH_RETENTION_DAYS - 1) * DAY_MS;
    if (!recent) {
      const rets = await C.drive.consultar("name contains 'retrato-'");
      const ret = rets[rets.length - 1];
      if (ret) {
        display("", "Recebendo suas anotações…");
        const d = await C.drive.readStorage(ret.id);
        await aplicar(d.colecoes);
        if (d.ate && (!st.marcador || d.ate > st.marcador)) st.marcador = d.ate;
        await saveState(st);
      }
    }
    const since = st.marcador ? new Date(Date.parse(st.marcador) - OVERLAP_MS).toISOString() : null;
    const batches = await C.drive.consultar("name contains 'lote-'" + (since ? ` and createdTime > '${since}'` : ""));
    const mine = `lote-${B.aparelho}-`;
    for (const l of batches) {
      if (!l.name.startsWith(mine) && !st.aplicados[l.name]) {
        display("", "Recebendo mudanças…");
        const d = await C.drive.readStorage(l.id);
        await aplicar(d.colecoes);
        st.aplicados[l.name] = l.createdTime;
      }
      if (!st.marcador || l.createdTime > st.marcador) st.marcador = l.createdTime;
      await saveState(st);
    }
    // a lista de já aplicados só precisa cobrir a folga
    const cutoff = st.marcador ? new Date(Date.parse(st.marcador) - 2 * OVERLAP_MS).toISOString() : "";
    for (const [nome, quando] of Object.entries(st.aplicados)) if (quando < cutoff) delete st.aplicados[nome];
  }

  async function upload() {
    const fila = await B.fila();
    if (!fila.length) return;
    const ids = {};
    for (const f of fila) (ids[f.colecao] = ids[f.colecao] || new Set()).add(f.id);
    const colecoes = {};
    let n = 0;
    for (const [c, conj] of Object.entries(ids)) {
      for (const id of conj) {
        const r = await B.readStorage(c, id);
        if (r && !r.local) {
          (colecoes[c] = colecoes[c] || []).push(r);
          n++;
        }
      }
    }
    if (n) {
      display("", `Enviando ${n} ${n === 1 ? "mudança" : "mudanças"}…`);
      const currentTime = new Date();
      await C.drive.save(`lote-${B.aparelho}-${currentTime.getTime()}.json`, {
        formato: "biblia-interlinear-lote",
        versao: 1,
        aparelho: B.aparelho,
        criado_em: currentTime.toISOString(),
        colecoes
      });
    }
    await B.tirarDaFila(fila.map(f => f.seq)); // só depois que o Drive confirmou
  }

  async function compact(st, force = false) {
    if (!force && st.compactado_em && Date.now() - Date.parse(st.compactado_em) < DAY_MS) return;
    st.compactado_em = new Date().toISOString();
    const batches = await C.drive.consultar("name contains 'lote-'");
    if (!force && batches.length <= BATCH_LIMIT) return;
    // exclusões antigas saem de vez (aqui e no retrato)
    const oldIso = new Date(Date.now() - DELETED_RETENTION_DAYS * DAY_MS).toISOString();
    const colecoes = {};
    for (const c of B.colecoes) {
      const recs = await B.brutos(c);
      const remoteRec = recs.filter(r => r.apagado && (r.alterado_em || "") < oldIso).map(r => r.id);
      if (remoteRec.length) await B.purgar(c, remoteRec);
      colecoes[c] = recs.filter(r => !r.local && !remoteRec.includes(r.id));
    }
    const currentTime = new Date();
    const ate = st.marcador || currentTime.toISOString();
    const fresh = await C.drive.save(`retrato-${currentTime.getTime()}-${B.aparelho}.json`, {
      formato: "biblia-interlinear-retrato",
      versao: 1,
      aparelho: B.aparelho,
      criado_em: currentTime.toISOString(),
      ate,
      colecoes
    });
    const limit = new Date(Date.now() - BATCH_RETENTION_DAYS * DAY_MS).toISOString();
    for (const l of batches) if (l.createdTime < limit && l.createdTime <= ate) await C.drive.apagar(l.id);
    // retratos antigos: o novo já tem tudo (se dois aparelhos compactarem juntos, os dois têm o mesmo conteúdo)
    for (const r of await C.drive.consultar("name contains 'retrato-'")) if (r.id !== fresh.id) await C.drive.apagar(r.id);
  }

  // ---------- quando rodar ----------
  A.aoMudar(() => {
    if (!applying) schedule(DELAY_MS);
  });
  C.aoMudar(estado => {
    if (estado === "ligado") {
      stopped = false;
      schedule(300);
    } else {
      status = null;
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule(500);
  });
  window.addEventListener("online", () => schedule(500));
  window.addEventListener("offline", () => {
    if (C.estado() === "ligado") display("alerta", "Sem internet — as mudanças esperam neste aparelho");
  });
  setInterval(() => {
    if (document.visibilityState === "visible") cycle();
  }, INTERVAL_MS);

  // Preferências de leitura (modo e itens visíveis) também viajam: grava quando a pessoa muda
  document.addEventListener("preferencias", () => {
    const p = window.__preferencias?.readStorage();
    if (p) A.save("preferencias", { id: "leitura", ...p });
  });

  window.Sync = {
    currentTime: () => cycle(),
    resumo: () => (C.estado() === "ligado" ? status : null),
    parar: async () => {
      stopped = true;
      clearTimeout(timer);
      if (running) await running.catch(() => {});
    },
    antesDeApagar: async () => {
      stopped = true;
      if (running) await running.catch(() => {});
    },
    compact: async () => {
      const st = await readState();
      await compact(st, true);
      await saveState(st);
    }
  };
})();
