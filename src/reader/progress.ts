// Meu progresso: chapters read, reading time, the streak of days, the map of the books and the reading plan.
// It only counts for whoever signed in with Google (the project's plan): without an account the app keeps only the
// last place read. Everything is in the local database and syncs through Drive like the annotations:
//   leituras  one record per chapter: { id "GEN.1", livro, n, lido, primeira, ultima, vezes }
//   tempo     one record per device and day: { id "<device>:<day>", aparelho, dia, segundos, livros{}, caps, verbetes }
//             each device writes only its own; the total is the sum (reading on the phone and the computer never loses minutes)
//   planos    { id "atual", tipo, nome, inicio, fim, caps[] }
//   preferencias/posicao  the last chapter read, on any device
// How it is measured:
//   a chapter read: reached the end of the chapter and stayed at least 1 minute active in it (or marked by hand);
//   time: only with the page visible and some activity in the last 2 minutes (scroll, tap, key, listening);
//   streak: a day with at least 1 chapter read or 5 minutes of reading.
import { flushSync, mount } from "svelte";
import ProgressSheet from "../components/ProgressSheet.svelte";
import { t } from "../i18n";
import { type Plan, type PlanId, type TimeRecord, byDay as sumByDay, newPlan, reschedule, today } from "../lib/progress/stats";
import { type ChartTab, type ProgressData, bookDetail, chartBars, overview, planView } from "../lib/progress/view";
import { progressView } from "../state/progress.svelte";
import { openChapter } from "./chapter";
import { ANNOTATIONS_OPEN_PANEL } from "./events";

type Rec = { id: string; [field: string]: unknown };
type Store = {
  save(c: string, r: Rec): Promise<unknown>;
  allRecords(c: string): Promise<Rec[]>;
  removeRecord(c: string, id: string): Promise<unknown>;
  onChange(f: () => void): void;
  storage: { aparelho: string; readStorage(c: string, id: string): Promise<Rec | null> };
};
type Account = {
  account(): unknown;
  available(): boolean;
  ask(title: string, text: string, buttons: { id: string; texto: string; prim?: boolean; perigo?: boolean }[]): Promise<string>;
  onChange(f: () => void): void;
};
type Tally = { dia: string; segundos: number; livros: Record<string, number>; caps: number; verbetes: number };

declare global {
  interface Window {
    /** tests: shorter intervals */
    __progressConfig?: Partial<{ tick: number; minReading: number; gesture: number; saveEvery: number }>;
  }
}

const PAUSED_KEY = "interlinear:tempo-pausado"; // i18n-ignore
const freshTally = (): Tally => ({ dia: today(), segundos: 0, livros: {}, caps: 0, verbetes: 0 });

export function initProgress() {
  const A = window.Annotations as unknown as Store | undefined,
    C = window.Account as unknown as Account | undefined;
  if (!A?.storage || !C) return;
  const S = A.storage;
  const CFG = { tick: 5000, minReading: 60, gesture: 120000, saveEvery: 300000, ...(window.__progressConfig || {}) };
  const readLS = (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const saveLS = (k: string, v: string | null) => {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* private mode: the pause lasts until the page closes */
    }
  };
  const byCode = () => window.__books || {};
  const bookList = () =>
    Object.entries(byCode())
      .sort((a, b) => a[1].i - b[1].i)
      .map(([code, l]) => ({ code, ...l }));
  const signedIn = () => !!C.account(); // the account remembered on this device (even waiting to reconnect)
  const paused = () => readLS(PAUSED_KEY) === "sim";

  // ---------- measuring ----------
  let current: { book: string; chapter: number } | null = null;
  let activeInChapter = 0,
    markedThisVisit = false,
    endSeen = false;
  let lastGesture = Date.now();
  let acc = freshTally();
  for (const ev of ["scroll", "pointerdown", "keydown", "wheel", "touchstart"])
    window.addEventListener(
      ev,
      () => {
        lastGesture = Date.now();
      },
      { passive: true, capture: true }
    );
  const listening = () => {
    try {
      return !!window.speechSynthesis?.speaking;
    } catch {
      return false;
    }
  };
  const isActive = () => document.visibilityState === "visible" && (Date.now() - lastGesture < CFG.gesture || listening());

  let observer: IntersectionObserver | null = null,
    endTarget: Element | null = null;
  function watchEnd() {
    endSeen = false;
    observer?.disconnect();
    const vs = document.getElementById("verses")?.querySelectorAll(".verse") || [];
    const lastEl = vs[vs.length - 1];
    if (!lastEl || !("IntersectionObserver" in window)) {
      endSeen = true;
      return;
    }
    observer = new IntersectionObserver(es => {
      if (es.some(e => e.isIntersecting)) {
        endSeen = true;
        checkRead();
      }
    });
    observer.observe(lastEl);
    endTarget = lastEl;
  }
  // a long scroll can jump over the last verse without it crossing the screen; going past it counts too
  window.addEventListener(
    "scroll",
    () => {
      if (endSeen || !endTarget?.isConnected) return;
      if (endTarget.getBoundingClientRect().bottom < window.innerHeight) {
        endSeen = true;
        checkRead();
      }
    },
    { passive: true }
  );
  let positionTimer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener("chapter-rendered", e => {
    const d = (e as CustomEvent).detail || {};
    current = d.book ? { book: d.book, chapter: d.chapter } : null;
    activeInChapter = 0;
    markedThisVisit = false;
    setTimeout(watchEnd, 50);
    clearTimeout(positionTimer);
    // the place counts on every device ("continuar de onde parou"); saved after a few seconds in the chapter
    if (current && signedIn())
      positionTimer = setTimeout(() => {
        if (current && current.book === d.book && current.chapter === d.chapter)
          A.save("preferencias", { id: "posicao", cod: d.book, cap: d.chapter, quando: new Date().toISOString() });
      }, 5000);
  });
  const shown = window.__currentChapter as { book: string; chapter: number } | undefined;
  if (shown) {
    current = { book: shown.book, chapter: shown.chapter };
    setTimeout(watchEnd, 50);
  }
  document.addEventListener("lexicon-entry-opened", () => {
    if (signedIn()) acc.verbetes++;
  });

  setInterval(() => {
    if (!signedIn() || !current || !isActive()) return;
    const sec = CFG.tick / 1000;
    if (acc.dia !== today()) saveTime(); // a new day: what was read before stays in the day before
    if (!paused()) {
      acc.segundos += sec;
      acc.livros[current.book] = (acc.livros[current.book] || 0) + sec;
    }
    activeInChapter += sec;
    checkRead();
  }, CFG.tick);
  setInterval(() => saveTime(), CFG.saveEvery);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveTime();
  });
  window.addEventListener("pagehide", () => saveTime());

  function checkRead() {
    if (!current || markedThisVisit || !endSeen || activeInChapter < CFG.minReading || !signedIn()) return;
    markedThisVisit = true;
    markRead(current.book, current.chapter, true);
  }
  async function markRead(code: string, n: number, read = true) {
    const id = `${code}.${n}`;
    const r = (await S.readStorage("leituras", id)) as (Rec & { primeira?: string; vezes?: number; lido?: boolean }) | null;
    const now = new Date().toISOString();
    if (read) {
      await A!.save("leituras", { id, livro: code, n, lido: true, primeira: r?.primeira || now, ultima: now, vezes: (r?.vezes || 0) + 1 });
      if (!r?.lido) acc.caps++;
    } else if (r) await A!.save("leituras", { id, lido: false });
    if (progressView.open) render();
  }
  let writing: Promise<unknown> = Promise.resolve();
  function saveTime() {
    if (!acc.segundos && !acc.caps && !acc.verbetes) {
      acc.dia = today();
      return writing;
    }
    const chunk = acc;
    acc = freshTally();
    writing = writing
      .then(async () => {
        const id = `${S.aparelho}:${chunk.dia}`;
        const r = (await S.readStorage("tempo", id)) as (Rec & Partial<Tally> & { apagado?: boolean }) | null;
        const base = r && !r.apagado ? r : { segundos: 0, livros: {}, caps: 0, verbetes: 0 };
        const booksTotals: Record<string, number> = { ...base.livros };
        for (const [k, v] of Object.entries(chunk.livros)) booksTotals[k] = (booksTotals[k] || 0) + v;
        await A!.save("tempo", {
          id,
          aparelho: S.aparelho,
          dia: chunk.dia,
          segundos: (base.segundos || 0) + chunk.segundos,
          livros: booksTotals,
          caps: (base.caps || 0) + chunk.caps,
          verbetes: (base.verbetes || 0) + chunk.verbetes,
          apagado: false
        });
      })
      .catch(() => {
        /* the next save tries again */
      });
    return writing;
  }

  // ---------- numbers ----------
  async function payload() {
    await saveTime();
    const [leituras, tempo, planos, prefs, notas, marcacoes, favoritos] = await Promise.all(
      ["leituras", "tempo", "planos", "preferencias", "notas", "marcacoes", "favoritos"].map(c => A!.allRecords(c))
    );
    const readSet = new Map(leituras.filter(l => l.lido).map(l => [l.id, l]));
    const byDay = sumByDay(tempo as unknown as TimeRecord[], readSet.values());
    const withNotes = new Set([...notas, ...marcacoes, ...favoritos].map(r => r.cap as string).filter(Boolean));
    return {
      readSet,
      byDay,
      withNotes,
      plano: (planos.find(p => p.id === "atual") as unknown as Plan) || null,
      posicao: (prefs.find(p => p.id === "posicao") as (Rec & { cod: string; cap: number }) | undefined) || null,
      estudo: { notas: notas.length, marcacoes: marcacoes.length, favoritos: favoritos.length }
    };
  }

  // ---------- reading plans ----------
  async function startPlan(kind: PlanId) {
    await A!.save("planos", newPlan(kind, bookList()));
    render();
  }

  // ---------- the sheet (ProgressSheet.svelte; its numbers come from src/lib/progress/view.ts) ----------
  const panel = () => document.getElementById("progresso")!;
  let focusReturn: Element | null = null;

  function open() {
    focusReturn = document.activeElement;
    document.dispatchEvent(new CustomEvent(ANNOTATIONS_OPEN_PANEL));
    progressView.book = null;
    progressView.open = true;
    render().then(() => panel().querySelector<HTMLElement>("#pg-close")?.focus());
  }
  function hide() {
    if (!progressView.open) return;
    progressView.open = false;
    flushSync();
    if (focusReturn instanceof HTMLElement && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
  }
  async function render() {
    if (!progressView.open) return;
    progressView.signedIn = signedIn();
    progressView.canSignIn = C!.available();
    progressView.paused = paused();
    if (progressView.signedIn) {
      const D = await payload();
      const books = bookList();
      const pos = D.posicao && byCode()[D.posicao.cod];
      progressView.continueAt = pos && D.posicao ? { code: D.posicao.cod, chapter: D.posicao.cap, name: pos.name } : null;
      const data = D as unknown as ProgressData;
      progressView.overview = overview(data, books);
      progressView.chart = chartBars(D.byDay, progressView.tab);
      progressView.plan = planView(data, byCode());
      progressView.study = D.estudo;
      const b = progressView.book && books.find(x => x.code === progressView.book!.code);
      progressView.detail = b ? bookDetail(data, b) : null;
    }
    flushSync();
  }

  mount(ProgressSheet, {
    target: document.body,
    props: {
      onclose: () => hide(),
      ongo(code: string, n: number) {
        hide();
        openChapter(code, n, null);
      },
      ontab(tab: ChartTab) {
        progressView.tab = tab;
        render();
      },
      async onbook(code: string) {
        const b = byCode()[code];
        progressView.book = { code, name: b?.name || code, abbrev: b?.abbrev || code };
        await render();
        panel().scrollTop = 0;
        panel().querySelector<HTMLElement>("#pg-back")?.focus();
      },
      onback() {
        progressView.book = null;
        render();
      },
      async onchapter(n: number, read: boolean) {
        await markRead(progressView.book!.code, n, read);
        panel().querySelector<HTMLElement>(`[data-cap="${n}"]`)?.focus();
      },
      onplan: (id: PlanId) => startPlan(id),
      async onreschedule() {
        const D = await payload();
        await A!.save("planos", reschedule(D.plano, D.readSet));
        render();
      },
      async onfinish() {
        const r = await C!.ask(t("progress.finish_title"), t("progress.finish_text"), [
          { id: "sim", texto: t("progress.finish_yes"), prim: true },
          { id: "", texto: t("progress.cancel") }
        ]);
        if (r === "sim") {
          await A!.removeRecord("planos", "atual");
          render();
        }
      },
      onpause() {
        saveLS(PAUSED_KEY, paused() ? null : "sim");
        render();
      },
      async onreset() {
        const r = await C!.ask(t("progress.reset_title"), t("progress.reset_text"), [
          { id: "sim", texto: t("progress.reset_yes"), perigo: true },
          { id: "", texto: t("progress.cancel"), prim: true }
        ]);
        if (r !== "sim") return;
        acc = freshTally();
        for (const c of ["leituras", "tempo", "planos"]) for (const x of await A!.allRecords(c)) await A!.removeRecord(c, x.id);
        render();
      }
    }
  });

  // the sheet follows the changes that come from another device
  A.onChange(() => render());
  C.onChange(() => render());
  window.Progress = { open, hide, markRead, saveTime, payload: () => payload() } as unknown as Window["Progress"];
}

// starts when imported, after the annotations, the account and the sync (see src/reader/main.ts)
initProgress();
