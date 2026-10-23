import { flushSync, mount } from "svelte";
import ProgressSheet from "../src/components/ProgressSheet.svelte";
import { t } from "../src/i18n";
import { bookDetail, chartBars, overview, planView } from "../src/lib/progress/view";
import { progressView } from "../src/state/progress.svelte";
import { byDay as sumByDay, newPlan, reschedule, today } from "../src/lib/progress/stats";
/* Meu progresso: capítulos lidos, tempo de leitura, sequência de dias, mapa dos livros e plano de leitura.
 * Só conta para quem entrou com a conta Google (o plano do projeto): sem conta, o app guarda só a última posição.
 * Tudo fica no banco local e sincroniza pelo Drive como as anotações (web/sync.js):
 *   leituras  um registro por capítulo: { id "GEN.1", livro, n, lido, primeira, ultima, vezes }
 *   tempo     um registro por aparelho e dia: { id "<aparelho>:<dia>", aparelho, dia, segundos, livros{}, caps, verbetes }
 *             cada aparelho só escreve os próprios; o total é a soma (ler no celular e no computador nunca perde minutos)
 *   planos    { id "atual", tipo, nome, inicio, fim, caps[] }
 *   preferencias/posicao  o último capítulo lido, em qualquer aparelho
 * Como é medido:
 *   capítulo lido: chegou ao fim do capítulo e ficou ao menos 1 minuto ativo nele (ou marcado à mão);
 *   tempo: só com a página visível e alguma atividade nos últimos 2 minutos (rolar, tocar, teclar, ouvir);
 *   sequência: dia com pelo menos 1 capítulo lido ou 5 minutos de leitura.
 */
(function () {
  "use strict";
  const A = window.Annotations,
    C = window.Account;
  if (!A?.storage || !C) return;
  const B = A.storage;
  const CFG = Object.assign({ tick: 5000, minReading: 60, gesture: 120000, saveEvery: 300000 }, window.__progressConfig || {});
  const readLS = k => {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  };
  const saveLS = (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch (_) {}
  };

  const bookList = () =>
    Object.entries(window.__books || {})
      .sort((a, b) => a[1].i - b[1].i)
      .map(([code, l]) => ({ code, ...l }));
  const signedIn = () => !!C.account(); // conta lembrada neste aparelho (mesmo à espera de reconectar)
  const paused = () => readLS("interlinear:tempo-pausado") === "sim";

  // ---------- medição ----------
  let currentChapter = null; // capítulo na tela { cod, cap }
  let activeInChapter = 0,
    markedThisVisit = false,
    endSeen = false;
  let lastGesture = Date.now();
  let acc = { dia: today(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
  ["scroll", "pointerdown", "keydown", "wheel", "touchstart"].forEach(t =>
    window.addEventListener(
      t,
      () => {
        lastGesture = Date.now();
      },
      { passive: true, capture: true }
    )
  );
  const listening = () => {
    try {
      return !!window.speechSynthesis?.speaking;
    } catch (_) {
      return false;
    }
  };
  const isActive = () => document.visibilityState === "visible" && (Date.now() - lastGesture < CFG.gesture || listening());

  let observer = null,
    endTarget = null;
  function watchEnd() {
    endSeen = false;
    observer?.disconnect();
    const vs = document.querySelectorAll("#verses .verse");
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
  // Uma rolagem longa pode pular o último versículo sem ele cruzar a tela; passar dele também conta.
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
  let positionTimer = 0;
  document.addEventListener("chapter-rendered", e => {
    const d = e.detail || {};
    currentChapter = d.book ? { book: d.book, chapter: d.chapter } : null;
    activeInChapter = 0;
    markedThisVisit = false;
    setTimeout(watchEnd, 50);
    clearTimeout(positionTimer);
    // a posição vale em todos os aparelhos ("continuar de onde parou"); grava depois de alguns segundos no capítulo
    if (currentChapter && signedIn())
      positionTimer = setTimeout(() => {
        if (currentChapter && currentChapter.book === d.book && currentChapter.chapter === d.chapter)
          A.save("preferencias", { id: "posicao", cod: d.book, cap: d.chapter, quando: new Date().toISOString() });
      }, 5000);
  });
  if (window.__currentChapter) {
    const d = window.__currentChapter;
    currentChapter = { book: d.book, chapter: d.chapter };
    setTimeout(watchEnd, 50);
  }
  document.addEventListener("lexicon-entry-opened", () => {
    if (signedIn()) acc.verbetes++;
  });

  setInterval(() => {
    if (!signedIn() || !currentChapter || !isActive()) return;
    const sec = CFG.tick / 1000;
    if (acc.dia !== today()) saveTime(); // virou o dia: o que foi lido antes fica no dia anterior
    if (!paused()) {
      acc.segundos += sec;
      acc.livros[currentChapter.book] = (acc.livros[currentChapter.book] || 0) + sec;
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
    if (!currentChapter || markedThisVisit || !endSeen || activeInChapter < CFG.minReading || !signedIn()) return;
    markedThisVisit = true;
    markRead(currentChapter.book, currentChapter.chapter, true);
  }
  async function markRead(cod, n, lido = true) {
    const id = `${cod}.${n}`;
    const r = await B.readStorage("leituras", id);
    const currentTime = new Date().toISOString();
    if (lido) {
      await A.save("leituras", {
        id,
        livro: cod,
        n,
        lido: true,
        primeira: r?.primeira || currentTime,
        ultima: currentTime,
        vezes: (r?.vezes || 0) + 1
      });
      if (!r?.lido) acc.caps++;
    } else if (r) await A.save("leituras", { id, lido: false });
    if (!panel.hidden) render();
  }
  let writing = Promise.resolve();
  function saveTime() {
    if (!acc.segundos && !acc.caps && !acc.verbetes) {
      acc.dia = today();
      return writing;
    }
    const chunk = acc;
    acc = { dia: today(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
    writing = writing
      .then(async () => {
        const id = `${B.aparelho}:${chunk.dia}`;
        const r = await B.readStorage("tempo", id);
        const base = r && !r.apagado ? r : { segundos: 0, livros: {}, caps: 0, verbetes: 0 };
        const booksTotals = { ...base.livros };
        for (const [k, v] of Object.entries(chunk.livros)) booksTotals[k] = (booksTotals[k] || 0) + v;
        await A.save("tempo", {
          id,
          aparelho: B.aparelho,
          dia: chunk.dia,
          segundos: (base.segundos || 0) + chunk.segundos,
          livros: booksTotals,
          caps: (base.caps || 0) + chunk.caps,
          verbetes: (base.verbetes || 0) + chunk.verbetes,
          apagado: false
        });
      })
      .catch(() => {});
    return writing;
  }

  // ---------- números ----------
  async function payload() {
    await saveTime();
    const [leituras, tempo, planos, prefs, notas, marcacoes, favoritos] = await Promise.all(
      ["leituras", "tempo", "planos", "preferencias", "notas", "marcacoes", "favoritos"].map(c => A.allRecords(c))
    );
    const readSet = new Map(leituras.filter(l => l.lido).map(l => [l.id, l]));
    const byDay = sumByDay(tempo, readSet.values());
    const withNotes = new Set([...notas, ...marcacoes, ...favoritos].map(r => r.cap).filter(Boolean));
    return {
      readSet,
      byDay,
      withNotes,
      plano: planos.find(p => p.id === "atual") || null,
      posicao: prefs.find(p => p.id === "posicao") || null,
      estudo: { notas: notas.length, marcacoes: marcacoes.length, favoritos: favoritos.length }
    };
  }

  // ---------- planos de leitura ----------
  async function startPlan(tipo) {
    await A.save("planos", newPlan(tipo, bookList()));
    render();
  }
  async function reschedulePlan(p, readSet) {
    await A.save("planos", reschedule(p, readSet));
    render();
  }

  // ---------- tela ----------
  const css = document.createElement("style");
  css.textContent = `
.sheet.progresso-sheet { width: min(560px, 100vw); z-index: 45; }
.pg-sec { display: grid; gap: 10px; }
.pg-sec h3 { margin: 0; font: 500 12px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pg-continue { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--accent-soft); color: var(--fg); font: inherit; cursor: pointer; text-align: start; }
.pg-continue b { display: block; font-size: 17px; }
.pg-continue small { color: var(--muted); }
.pg-big { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.pg-big b { font-size: 40px; line-height: 1; font-weight: 600; }
.pg-bar { height: 10px; border-radius: 6px; background: var(--line); overflow: hidden; }
.pg-bar i { display: block; height: 100%; background: var(--accent); border-radius: 6px; }
.pg-sub { color: var(--muted); font-size: 14px; margin: 0; }
.pg-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pg-tile { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
.pg-tile b { display: block; font-size: 20px; }
.pg-tile span { font-size: 12.5px; color: var(--muted); }
.pg-tabs { display: flex; gap: 6px; }
.pg-chart svg { width: 100%; height: auto; display: block; }
.pg-chart .bar { fill: var(--accent); }
.pg-chart .media { stroke: var(--muted); stroke-dasharray: 4 3; }
.pg-chart text { fill: var(--muted); font: 10px var(--font-mono); }
.pg-map { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 5px; }
.pg-book { min-height: 40px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 12px var(--font-mono); cursor: pointer; padding: 0; }
.pg-book.n1 { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
.pg-book.n2 { background: color-mix(in srgb, var(--accent) 50%, var(--surface)); }
.pg-book.n3 { background: var(--accent); color: var(--surface); border-color: var(--accent); }
.pg-legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.pg-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--line); vertical-align: -2px; margin-right: 4px; }
.pg-chapters { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 5px; }
.pg-chapter { position: relative; min-height: 40px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 13px var(--font-mono); cursor: pointer; }
.pg-chapter[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.pg-chapter.lendo { outline: 2px dashed var(--accent); outline-offset: -4px; }
.pg-chapter.anot::after { content: ""; position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: #c98a1b; }
.pg-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.pg-btns button, .pg-back { min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line); background: transparent; color: var(--fg); font: inherit; font-size: 14px; cursor: pointer; }
.pg-btns button.prim { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.pg-day { display: flex; flex-wrap: wrap; gap: 6px; }
.pg-day button { min-height: 36px; padding: 0 12px; border-radius: 18px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 13px var(--font-body); cursor: pointer; }
.pg-day button.feito { background: var(--accent-soft); border-color: var(--accent); }
.pg-day button.feito::before { content: "✓ "; }
.pg-status.ok { color: light-dark(#2e7d4f, #7fd3a0); }
.pg-status.alerta { color: light-dark(#8a5300, #e8b25c); }
.pg-footer { display: grid; gap: 6px; border-top: 1px solid var(--line); padding-top: 12px; }
.pg-footer button { justify-self: start; border: 0; background: none; padding: 6px 0; color: var(--muted); font: inherit; font-size: 13.5px; text-decoration: underline; cursor: pointer; min-height: 36px; }
.pg-invite p { line-height: 1.5; }
.pg-legend i.pg-legend-1 { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
.pg-legend i.pg-legend-2 { background: color-mix(in srgb, var(--accent) 50%, var(--surface)); }
.pg-legend i.pg-legend-3 { background: var(--accent); }
`;
  document.head.appendChild(css);

  // a tela é ProgressSheet.svelte; os números dela saem de src/lib/progress/view.ts
  mount(ProgressSheet, {
    target: document.body,
    props: {
      onclose: () => hide(),
      ongo(cod, n) {
        hide();
        document.dispatchEvent(new CustomEvent("annotations:goto", { detail: { book: cod, chapter: n } }));
      },
      ontab(tab) {
        progressView.tab = tab;
        render();
      },
      async onbook(cod) {
        const b = (window.__books || {})[cod];
        progressView.book = { code: cod, name: b?.name || cod, abbrev: b?.abbrev || cod };
        await render();
        panel.scrollTop = 0;
        panel.querySelector("#pg-back")?.focus();
      },
      onback() {
        progressView.book = null;
        render();
      },
      async onchapter(n, read) {
        await markRead(progressView.book.code, n, read);
        panel.querySelector(`[data-cap="${n}"]`)?.focus();
      },
      onplan: id => startPlan(id),
      async onreschedule() {
        const D = await payload();
        return reschedulePlan(D.plano, D.readSet);
      },
      async onfinish() {
        const r = await C.ask(t("progress.finish_title"), t("progress.finish_text"), [
          { id: "sim", texto: t("progress.finish_yes"), prim: true },
          { id: "", texto: t("progress.cancel") }
        ]);
        if (r === "sim") {
          await A.removeRecord("planos", "atual");
          render();
        }
      },
      onpause() {
        saveLS("interlinear:tempo-pausado", paused() ? null : "sim");
        render();
      },
      async onreset() {
        const r = await C.ask(t("progress.reset_title"), t("progress.reset_text"), [
          { id: "sim", texto: t("progress.reset_yes"), perigo: true },
          { id: "", texto: t("progress.cancel"), prim: true }
        ]);
        if (r !== "sim") return;
        acc = { dia: today(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
        for (const c of ["leituras", "tempo", "planos"]) for (const x of await A.allRecords(c)) await A.removeRecord(c, x.id);
        render();
      }
    }
  });
  const panel = document.getElementById("progresso");
  let focusReturn = null;

  function open() {
    focusReturn = document.activeElement;
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    progressView.book = null;
    progressView.open = true;
    render().then(() => panel.querySelector("#pg-close")?.focus());
  }
  function hide() {
    if (!progressView.open) return;
    progressView.open = false;
    flushSync();
    if (focusReturn?.isConnected) focusReturn.focus({ preventScroll: true });
  }
  async function render() {
    if (!progressView.open) return;
    progressView.signedIn = signedIn();
    progressView.canSignIn = C.available();
    progressView.paused = paused();
    if (progressView.signedIn) {
      const D = await payload();
      const books = bookList();
      const byCode = window.__books || {};
      const pos = D.posicao && byCode[D.posicao.cod];
      progressView.continueAt = pos ? { code: D.posicao.cod, chapter: D.posicao.cap, name: pos.name } : null;
      progressView.overview = overview(D, books);
      progressView.chart = chartBars(D.byDay, progressView.tab);
      progressView.plan = planView(D, byCode);
      progressView.study = D.estudo;
      const b = progressView.book && books.find(x => x.code === progressView.book.code);
      progressView.detail = b ? bookDetail(D, b) : null;
    }
    flushSync();
  }

  // o painel se atualiza quando chegam mudanças de outro aparelho
  A.onChange(() => render());
  C.onChange(() => render());

  window.Progress = { open, hide, markRead, saveTime, payload: () => payload() };
})();
