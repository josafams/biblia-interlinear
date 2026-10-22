import { esc } from "../src/lib/text";
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
  const DAY_MS = 864e5;
  const pad = n => String(n).padStart(2, "0");
  const dayOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // dia local (fuso do aparelho)
  const today = () => dayOf(new Date());
  const addDays = (dia, n) => {
    const [a, m, d] = dia.split("-").map(Number);
    return dayOf(new Date(a, m - 1, d + n));
  };
  const daysBetween = (a, b) => {
    const [x, y] = [a, b].map(s => {
      const [p, q, r] = s.split("-").map(Number);
      return Date.UTC(p, q - 1, r);
    });
    return Math.round((y - x) / DAY_MS);
  };
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
  const totalChapters = listSheet => listSheet.reduce((s, l) => s + (l.chapterCount || 0), 0);
  const signedIn = () => !!C.account(); // conta lembrada neste aparelho (mesmo à espera de reconectar)
  const paused = () => readLS("interlinear:tempo-pausado") === "sim";

  function duration(sec) {
    const m = Math.round(sec / 60);
    if (m < 1) return sec > 0 ? "menos de 1 min" : "0 min";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60),
      r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const shortDate = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

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
    const byDay = {};
    for (const t of tempo) {
      const d = (byDay[t.dia] = byDay[t.dia] || { segundos: 0, caps: 0, verbetes: 0, livros: {} });
      d.segundos += t.segundos || 0;
      d.caps += t.caps || 0;
      d.verbetes += t.verbetes || 0;
      for (const [k, v] of Object.entries(t.livros || {})) d.livros[k] = (d.livros[k] || 0) + v;
    }
    // dias com leitura também pelas datas dos capítulos (cobre marcações feitas à mão)
    for (const l of readSet.values()) {
      const d = dayOf(new Date(l.ultima || l.primeira));
      (byDay[d] = byDay[d] || { segundos: 0, caps: 0, verbetes: 0, livros: {} }).capsLidos = true;
    }
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
  function streaks(byDay) {
    const account = d => {
      const x = byDay[d];
      return !!x && (x.caps > 0 || x.capsLidos || x.segundos >= 300);
    };
    let currentStreak = 0,
      d = today();
    if (!account(d)) d = addDays(d, -1);
    while (account(d)) {
      currentStreak++;
      d = addDays(d, -1);
    }
    const days = Object.keys(byDay).filter(account).sort();
    let record = 0,
      run = 0,
      previous = null;
    for (const x of days) {
      run = previous && daysBetween(previous, x) === 1 ? run + 1 : 1;
      record = Math.max(record, run);
      previous = x;
    }
    return { currentChapter: currentStreak, record };
  }
  function readingPace(readSet) {
    // capítulos por dia nos últimos 30 dias
    const since = Date.now() - 30 * DAY_MS;
    let n = 0;
    for (const l of readSet.values()) if (Date.parse(l.ultima || l.primeira) >= since) n++;
    return n / 30;
  }

  // ---------- planos de leitura ----------
  const PLANS = {
    ano: {
      nome: "Bíblia em 1 ano",
      days: 365,
      caps: () => bookList().flatMap(l => Array.from({ length: l.chapterCount }, (_, i) => `${l.code}.${i + 1}`))
    },
    nt90: {
      nome: "Novo Testamento em 90 dias",
      days: 90,
      caps: () =>
        bookList()
          .filter(l => l.nt)
          .flatMap(l => Array.from({ length: l.chapterCount }, (_, i) => `${l.code}.${i + 1}`))
    }
  };
  function planStatus(p, readSet) {
    const N = p.caps.length,
      D = daysBetween(p.inicio, p.fim) + 1;
    const d = Math.min(Math.max(daysBetween(p.inicio, today()), 0), D - 1);
    const todays = p.caps.slice(Math.floor((d * N) / D), Math.floor(((d + 1) * N) / D));
    const done = p.caps.filter(c => readSet.has(c)).length;
    const before = Math.floor((d * N) / D),
      untilToday = Math.floor(((d + 1) * N) / D);
    let texto, tipo;
    if (done >= N) {
      texto = "Plano concluído!";
      tipo = "ok";
    } else if (done > untilToday) {
      texto = `${done - untilToday} ${done - untilToday === 1 ? "capítulo adiantado" : "capítulos adiantado"}`;
      tipo = "ok";
    } else if (done >= before) {
      texto = "Em dia";
      tipo = "ok";
    } else {
      texto = `${before - done} ${before - done === 1 ? "capítulo atrasado" : "capítulos atrasado"}`;
      tipo = "alerta";
    }
    return { todays, done, N, dia: d + 1, D, texto, tipo };
  }
  async function startPlan(tipo) {
    const P = PLANS[tipo];
    await A.save("planos", {
      id: "atual",
      tipo,
      nome: P.nome,
      inicio: today(),
      fim: addDays(today(), P.days - 1),
      caps: P.caps(),
      apagado: false
    });
    render();
  }
  async function reschedulePlan(p, readSet) {
    const remaining = p.caps.filter(c => !readSet.has(c));
    const originalPace = p.caps.length / (daysBetween(p.inicio, p.fim) + 1) || 1;
    const days = Math.max(1, Math.ceil(remaining.length / originalPace));
    await A.save("planos", { ...p, caps: remaining, inicio: today(), fim: addDays(today(), days - 1) });
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
`;
  document.head.appendChild(css);

  const panel = document.createElement("aside");
  panel.id = "progresso";
  panel.className = "sheet right progresso-sheet";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-labelledby", "pg-h");
  panel.setAttribute("lang", "pt-BR");
  document.body.appendChild(panel);
  let activeTab = "semana",
    openBook = null,
    focusReturn = null;

  function open() {
    focusReturn = document.activeElement;
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    openBook = null;
    panel.hidden = false;
    render().then(() => panel.querySelector("#pg-close")?.focus());
  }
  function hide() {
    if (panel.hidden) return;
    panel.hidden = true;
    if (focusReturn?.isConnected) focusReturn.focus({ preventScroll: true });
  }
  const headerHtml = titulo =>
    `<div class="shead"><h2 id="pg-h">${esc(titulo)}</h2><button class="ibtn" id="pg-close" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;

  async function render() {
    if (panel.hidden) return;
    if (!signedIn()) {
      panel.innerHTML =
        headerHtml("Meu progresso") +
        `<div class="pg-sec pg-invite">
        <p>Entre com sua conta Google para acompanhar quanto da Bíblia já leu, o tempo de leitura por dia, a sequência de dias e um plano de leitura — somados em todos os seus aparelhos.</p>
        <p class="pg-sub">Os números ficam só para você, no seu aparelho e numa pasta privada do app no seu Google Drive.</p>
        ${C.available() ? `<div><button class="gbtn js-signin">Entrar com Google</button></div>` : `<p class="pg-sub">O login ainda não está disponível nesta versão.</p>`}</div>`;
      return;
    }
    const D = await payload();
    panel.innerHTML =
      headerHtml(openBook ? window.__books?.[openBook]?.name || openBook : "Meu progresso") +
      (openBook ? bookHtml(D, openBook) : overviewHtml(D));
  }

  function overviewHtml(D) {
    const ls = bookList(),
      total = totalChapters(ls) || 1189;
    const at = ls.filter(l => !l.nt),
      nt = ls.filter(l => l.nt);
    const readCountOf = listSheet =>
      listSheet.reduce((s, l) => s + [...Array(l.chapterCount).keys()].filter(i => D.readSet.has(`${l.code}.${i + 1}`)).length, 0);
    const nRead = D.readSet.size,
      nOT = readCountOf(at),
      nNT = readCountOf(nt);
    const completedBooks = ls.filter(l => readCountOf([l]) === l.chapterCount).length;
    const pct = Math.floor((nRead / total) * 1000) / 10;
    const streak = streaks(D.byDay);
    const week = [...Array(7).keys()].map(i => D.byDay[addDays(today(), -i)]?.segundos || 0).reduce((a, b) => a + b, 0);
    const totalSeconds = Object.values(D.byDay).reduce((s, d) => s + d.segundos, 0);
    const verbetes = Object.values(D.byDay).reduce((s, d) => s + d.verbetes, 0);
    const pos = D.posicao && window.__books?.[D.posicao.cod];
    const continueBtn = pos
      ? `<button class="pg-continue" data-ir="${esc(D.posicao.cod)}.${D.posicao.cap}"><span><small>Continuar de onde parou</small><b>${esc(pos.name)} ${D.posicao.cap}</b></span><span aria-hidden="true">→</span></button>`
      : "";
    return `${continueBtn}
      <section class="pg-sec" aria-labelledby="pg-bible"><h3 id="pg-bible">A Bíblia inteira</h3>
        <div class="pg-big"><b>${pct.toLocaleString("pt-BR")}%</b><span>${nRead.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} capítulos lidos</span></div>
        <div class="pg-bar" role="img" aria-label="${pct.toLocaleString("pt-BR")}% lidos"><i style="width:${Math.min(100, pct)}%"></i></div>
        <p class="pg-sub">Antigo Testamento: ${nOT} de ${totalChapters(at)} · Novo Testamento: ${nNT} de ${totalChapters(nt)} · ${completedBooks} ${completedBooks === 1 ? "livro concluído" : "livros concluídos"}</p>
      </section>
      <section class="pg-sec" aria-label="Números"><div class="pg-tiles">
        <div class="pg-tile"><b>${streak.currentChapter} ${streak.currentChapter === 1 ? "dia" : "dias"}</b><span>seguidos lendo · recorde ${streak.record}</span></div>
        <div class="pg-tile"><b>${duration(week)}</b><span>nos últimos 7 dias · média ${duration(week / 7)}/dia</span></div>
        <div class="pg-tile"><b>${duration(totalSeconds)}</b><span>de leitura no total</span></div>
        <div class="pg-tile"><b>${verbetes.toLocaleString("pt-BR")}</b><span>verbetes abertos</span></div>
      </div></section>
      <section class="pg-sec" aria-labelledby="pg-time"><h3 id="pg-time">Tempo de leitura por dia</h3>
        <div class="pg-tabs" role="group" aria-label="Período">${[
          ["semana", "Semana"],
          ["mes", "Mês"],
          ["ano", "Ano"]
        ]
          .map(([k, n]) => `<button class="chip" data-active-tab="${k}" aria-pressed="${activeTab === k}">${n}</button>`)
          .join("")}</div>
        <div class="pg-chart">${chart(D.byDay)}</div>
      </section>
      <section class="pg-sec" aria-labelledby="pg-map"><h3 id="pg-map">Os 66 livros</h3>
        <div class="pg-map">${ls
          .map(l => {
            const n = readCountOf([l]),
              f = n / l.chapterCount;
            const nv = n === 0 ? 0 : n === l.chapterCount ? 3 : f > 0.5 ? 2 : 1;
            return `<button class="pg-book n${nv}" data-livro="${l.code}" title="${esc(l.name)}: ${n} de ${l.chapterCount}" aria-label="${esc(l.name)}: ${n} de ${l.chapterCount} capítulos lidos">${esc(l.abbrev)}</button>`;
          })
          .join("")}</div>
        <div class="pg-legend"><span><i></i>não começado</span><span><i style="background:color-mix(in srgb,var(--accent) 22%,var(--surface))"></i>até a metade</span><span><i style="background:color-mix(in srgb,var(--accent) 50%,var(--surface))"></i>mais da metade</span><span><i style="background:var(--accent)"></i>concluído</span></div>
      </section>
      ${planSection(D)}
      <section class="pg-sec" aria-labelledby="pg-study"><h3 id="pg-study">Estudo</h3>
        <p class="pg-sub">${D.estudo.notas} ${D.estudo.notas === 1 ? "nota" : "notas"} · ${D.estudo.marcacoes} ${D.estudo.marcacoes === 1 ? "marcação" : "marcações"} · ${D.estudo.favoritos} ${D.estudo.favoritos === 1 ? "favorito" : "favoritos"}</p>
      </section>
      <div class="pg-footer">
        <button id="pg-pause">${paused() ? "Voltar a contar o tempo de leitura" : "Pausar a contagem de tempo neste aparelho"}</button>
        <button id="pg-reset">Zerar estatísticas</button>
      </div>`;
  }

  function chart(byDay) {
    let bars = [];
    if (activeTab === "ano") {
      const currentTime = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(currentTime.getFullYear(), currentTime.getMonth() - i, 1),
          monthKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        const sec = Object.entries(byDay)
          .filter(([k]) => k.startsWith(monthKey))
          .reduce((s, [, v]) => s + v.segundos, 0);
        bars.push({ rot: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][d.getMonth()], sec });
      }
    } else {
      const n = activeTab === "mes" ? 30 : 7,
        sem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      for (let i = n - 1; i >= 0; i--) {
        const dia = addDays(today(), -i),
          [a, m, d] = dia.split("-").map(Number);
        bars.push({ rot: n === 7 ? sem[new Date(a, m - 1, d).getDay()] : i % 5 === 0 ? String(d) : "", sec: byDay[dia]?.segundos || 0 });
      }
    }
    const W = 520,
      H = 160,
      base = 136,
      topY = 12,
      max = Math.max(60, ...bars.map(b => b.sec));
    const barWidth = W / bars.length,
      average = bars.reduce((s, b) => s + b.sec, 0) / bars.length;
    const y = s => base - (s / max) * (base - topY);
    const desc = bars
      .map(b => `${b.rot || ""} ${duration(b.sec)}`)
      .filter(Boolean)
      .join(", ");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tempo de leitura: ${esc(desc)}. Média ${duration(average)}.">
      ${bars
        .map(
          (
            b,
            i
          ) => `<rect class="bar" x="${(i * barWidth + barWidth * 0.18).toFixed(1)}" y="${y(b.sec).toFixed(1)}" width="${(barWidth * 0.64).toFixed(1)}" height="${(base - y(b.sec)).toFixed(1)}" rx="2"><title>${esc(b.rot)} ${duration(b.sec)}</title></rect>
        <text x="${(i * barWidth + barWidth / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.rot)}</text>`
        )
        .join("")}
      <line class="media" x1="0" x2="${W}" y1="${y(average).toFixed(1)}" y2="${y(average).toFixed(1)}"/>
      <text x="${W - 2}" y="${Math.max(10, y(average) - 4).toFixed(1)}" text-anchor="end">média ${esc(duration(average))}</text>
    </svg>`;
  }

  function planSection(D) {
    const p = D.plano;
    if (!p || !p.caps?.length)
      return `<section class="pg-sec" aria-labelledby="pg-plan"><h3 id="pg-plan">Plano de leitura</h3>
      <p class="pg-sub">Opcional: um ritmo para ler a Bíblia toda ou o Novo Testamento, com a leitura de cada dia.</p>
      <div class="pg-btns"><button data-plano="ano">Bíblia em 1 ano</button><button data-plano="nt90">Novo Testamento em 90 dias</button></div></section>`;
    const s = planStatus(p, D.readSet);
    const chapterName = id => {
      const [cod, n] = id.split(".");
      return `${window.__books?.[cod]?.abbrev || cod} ${n}`;
    };
    return `<section class="pg-sec" aria-labelledby="pg-plan"><h3 id="pg-plan">Plano de leitura · ${esc(p.nome)}</h3>
      <p class="pg-sub">Dia ${s.dia} de ${s.D} · ${s.done.toLocaleString("pt-BR")} de ${s.N.toLocaleString("pt-BR")} capítulos · <span class="pg-status ${s.tipo}">${esc(s.texto)}</span></p>
      ${s.done < s.N ? `<p class="pg-sub">Leitura de hoje:</p><div class="pg-day">${s.todays.map(c => `<button data-ir="${c}" class="${D.readSet.has(c) ? "feito" : ""}">${esc(chapterName(c))}</button>`).join("") || '<span class="pg-sub">nada para hoje</span>'}</div>` : ""}
      <div class="pg-btns"><button id="pg-readjust">Reajustar as datas a partir de hoje</button><button id="pg-finish">Encerrar o plano</button></div></section>`;
  }

  function bookHtml(D, cod) {
    const l = bookList().find(x => x.code === cod);
    if (!l) return "";
    const caps = Array.from({ length: l.chapterCount }, (_, i) => i + 1);
    const readHere = caps.filter(n => D.readSet.has(`${cod}.${n}`));
    const recs = readHere.map(n => D.readSet.get(`${cod}.${n}`));
    const primeira = recs
      .map(r => r.primeira)
      .filter(Boolean)
      .sort()[0];
    const ultima = recs
      .map(r => r.ultima)
      .filter(Boolean)
      .sort()
      .at(-1);
    const reread = recs.filter(r => (r.vezes || 0) > 1).sort((a, b) => b.vezes - a.vezes)[0];
    const bookTime = Object.values(D.byDay).reduce((s, d) => s + (d.livros[cod] || 0), 0);
    const reading = D.posicao?.cod === cod ? D.posicao.cap : null;
    const remaining = l.chapterCount - readHere.length,
      r = readingPace(D.readSet);
    const forecast =
      remaining && r > 0 ? ` · no seu ritmo, cerca de ${Math.ceil(remaining / r)} ${Math.ceil(remaining / r) === 1 ? "dia" : "dias"}` : "";
    const nextChapter = caps.find(n => !D.readSet.has(`${cod}.${n}`)) || 1;
    return `<div><button class="pg-back" id="pg-back">← Meu progresso</button></div>
      <section class="pg-sec" aria-label="Resumo do livro">
        <div class="pg-big"><b>${readHere.length}</b><span>de ${l.chapterCount} capítulos lidos</span></div>
        <div class="pg-bar"><i style="width:${((readHere.length / l.chapterCount) * 100).toFixed(1)}%"></i></div>
        <p class="pg-sub">${remaining ? `Faltam ${remaining}${forecast}` : "Livro concluído"}</p>
      </section>
      <section class="pg-sec" aria-labelledby="pg-chaptersh"><h3 id="pg-chaptersh">Capítulos</h3>
        <p class="pg-sub">Toque para marcar ou desmarcar como lido. Ponto: tem anotação; tracejado: em leitura.</p>
        <div class="pg-chapters">${caps
          .map(n => {
            const id = `${cod}.${n}`;
            return `<button class="pg-chapter${D.withNotes.has(id) ? " anot" : ""}${reading === n && !D.readSet.has(id) ? " lendo" : ""}" data-cap="${n}" aria-pressed="${D.readSet.has(id)}" aria-label="Capítulo ${n}${D.readSet.has(id) ? ", lido" : ""}${D.withNotes.has(id) ? ", com anotação" : ""}">${n}</button>`;
          })
          .join("")}</div>
      </section>
      <section class="pg-sec" aria-label="Números do livro"><div class="pg-tiles">
        <div class="pg-tile"><b>${duration(bookTime)}</b><span>de leitura neste livro</span></div>
        <div class="pg-tile"><b>${reread ? `${l.abbrev} ${reread.n}` : "—"}</b><span>${reread ? `mais relido (${reread.vezes} vezes)` : "capítulo mais relido"}</span></div>
        <div class="pg-tile"><b>${shortDate(primeira)}</b><span>primeira leitura</span></div>
        <div class="pg-tile"><b>${shortDate(ultima)}</b><span>última leitura</span></div>
      </div></section>
      <div class="pg-btns"><button class="prim" data-ir="${cod}.${nextChapter}">Ler ${esc(l.abbrev)} ${nextChapter}</button></div>`;
  }

  panel.addEventListener("click", async e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "pg-close") return hide();
    if (b.dataset.ir) {
      const [cod, n] = b.dataset.ir.split(".");
      hide();
      document.dispatchEvent(new CustomEvent("annotations:goto", { detail: { book: cod, chapter: +n } }));
      return;
    }
    if (b.dataset.activeTab) {
      activeTab = b.dataset.activeTab;
      return render();
    }
    if (b.dataset.livro) {
      openBook = b.dataset.livro;
      await render();
      panel.scrollTop = 0;
      panel.querySelector("#pg-back")?.focus();
      return;
    }
    if (b.id === "pg-back") {
      openBook = null;
      return render();
    }
    if (b.dataset.cap && openBook) {
      await markRead(openBook, +b.dataset.cap, b.getAttribute("aria-pressed") !== "true");
      panel.querySelector(`[data-cap="${b.dataset.cap}"]`)?.focus();
      return;
    }
    if (b.dataset.plano) return startPlan(b.dataset.plano);
    if (b.id === "pg-readjust") {
      const D = await payload();
      return reschedulePlan(D.plano, D.readSet);
    }
    if (b.id === "pg-finish") {
      const r = await C.ask("Encerrar o plano?", "Os capítulos lidos continuam contando no seu progresso.", [
        { id: "sim", texto: "Encerrar", prim: true },
        { id: "", texto: "Cancelar" }
      ]);
      if (r === "sim") {
        await A.removeRecord("planos", "atual");
        render();
      }
      return;
    }
    if (b.id === "pg-pause") {
      saveLS("interlinear:tempo-pausado", paused() ? null : "sim");
      return render();
    }
    if (b.id === "pg-reset") {
      const r = await C.ask(
        "Zerar estatísticas?",
        "Apaga os capítulos lidos, o tempo de leitura e o plano, em todos os seus aparelhos. As anotações não são afetadas.",
        [
          { id: "sim", texto: "Zerar", perigo: true },
          { id: "", texto: "Cancelar", prim: true }
        ]
      );
      if (r !== "sim") return;
      acc = { dia: today(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
      for (const c of ["leituras", "tempo", "planos"]) for (const x of await A.allRecords(c)) await A.removeRecord(c, x.id);
      return render();
    }
  });
  panel.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      hide();
    }
  });
  // o painel se atualiza quando chegam mudanças de outro aparelho
  A.onChange(() => {
    if (!panel.hidden) render();
  });
  C.onChange(() => {
    if (!panel.hidden) render();
  });

  window.Progress = { open, hide, markRead, saveTime, payload: () => payload() };
})();
