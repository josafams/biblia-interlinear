import { esc } from "../src/lib/text";
// Busca na Bíblia toda (texto da Bíblia Livre): índice por palavra em dados/busca/<2 letras>.js, carregado aos poucos.
// Também entende referências ("Jo 3:16") e números Strong ("G25", "H430").
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const norm = w => w.replace(/’/g, "'").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const TOKEN = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
  const PAGE = 30;

  // ---------- índice ----------
  const IDX = {},
    pending = {};
  window.__busca = (prefix, d) => {
    IDX[prefix] = d;
    pending[prefix]?.ok(d);
    delete pending[prefix];
  };
  const prefixOf = w => [...w].slice(0, 2).join("");
  const fileOf = p => [...p].map(ch => (/[a-z0-9]/i.test(ch) ? ch : "_" + ch.codePointAt(0).toString(16))).join("");
  function loadPrefix(p) {
    if (IDX[p]) return Promise.resolve(IDX[p]);
    return new Promise(ok => {
      pending[p] = { ok };
      const s = document.createElement("script");
      s.src = `dados/busca/${fileOf(p)}.js`;
      s.async = true;
      s.onload = () => s.remove();
      // sem arquivo para esse começo de palavra: nenhuma palavra começa assim
      s.onerror = () => {
        s.remove();
        IDX[p] = {};
        pending[p]?.ok(IDX[p]);
        delete pending[p];
      };
      document.head.appendChild(s);
    });
  }
  function decode(str) {
    const out = [];
    let acc = 0;
    for (const part of str.split(",")) {
      acc += parseInt(part, 36);
      out.push(acc);
    }
    return out;
  }
  async function idsOf(term) {
    const d = await loadPrefix(prefixOf(term));
    return d[term] ? decode(d[term]) : [];
  }
  async function similar(term) {
    const d = await loadPrefix(prefixOf(term));
    return Object.keys(d)
      .filter(w => w !== term && w.startsWith(term))
      .sort((a, b) => d[b].length - d[a].length)
      .slice(0, 6);
  }
  const books = () => {
    const out = [];
    for (const [cod, b] of Object.entries(window.__books || {})) out[b.i] = { cod, ...b };
    return out;
  };

  // ---------- folha ----------
  const sheet = document.createElement("aside");
  sheet.id = "busca";
  sheet.className = "sheet right busca-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "busca-h");
  sheet.innerHTML = `
    <div class="shead"><h2 id="busca-h">Buscar na Bíblia</h2><button class="ibtn" data-fechar aria-label="Fechar busca"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="sgroup">
      <form id="busca-form" role="search" autocomplete="off">
        <label class="sr" for="busca-q">Palavras, referência ou número Strong</label>
        <input id="busca-q" class="lsearch" type="search" enterkeyhint="search" placeholder="amor, Jo 3:16, G25">
      </form>
      <div class="busca-scope" role="group" aria-label="Onde buscar">
        <button class="chip" data-scope="" aria-pressed="true">Bíblia toda</button>
        <button class="chip" data-scope="at" aria-pressed="false">Antigo Testamento</button>
        <button class="chip" data-scope="nt" aria-pressed="false">Novo Testamento</button>
        <button class="chip" data-scope="livro" aria-pressed="false" id="busca-book"></button>
      </div>
      <div id="busca-top"></div>
      <p class="busca-sub" id="busca-sub" aria-live="polite"></p>
      <p class="busca-sim" id="busca-sim"></p>
      <div class="conc-books" id="busca-books" role="group" aria-label="Filtrar por livro"></div>
      <ol class="busca-list" id="busca-list"></ol>
      <button class="conc-more" id="busca-more" hidden>Mostrar mais</button>
      <p class="busca-help" id="busca-help">Várias palavras acham os versículos que têm todas. Acentos e maiúsculas não importam. Também dá para digitar uma referência (<b>Sl 23</b>) ou um número Strong (<b>H430</b>).</p>
    </div>`;
  document.body.appendChild(sheet);
  const q = $("#busca-q", sheet);
  let state = { scope: "", list: [], shown: 0, terms: [] },
    focusBack = null,
    timer = 0,
    seq = 0;

  function open(text) {
    focusBack = document.activeElement;
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    const here = window.__currentChapter;
    const bk = $("#busca-book", sheet);
    bk.textContent = here ? `Só em ${here.bookName}` : "";
    bk.hidden = !here;
    sheet.hidden = false;
    document.body.classList.add("com-busca");
    document.getElementById("open-search")?.setAttribute("aria-expanded", "true");
    if (typeof text === "string") {
      q.value = text;
      run();
    }
    q.focus();
    q.select();
  }
  function close() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove("com-busca");
    document.getElementById("open-search")?.setAttribute("aria-expanded", "false");
    if (focusBack && focusBack.isConnected) focusBack.focus({ preventScroll: true });
  }
  function inScope(id, B) {
    const b = B[Math.floor(id / 1e6)];
    if (!b) return false;
    if (state.scope === "at") return !b.nt;
    if (state.scope === "nt") return !!b.nt;
    if (state.scope === "livro") return b.cod === window.__currentChapter?.book;
    return true;
  }
  async function run() {
    const my = ++seq;
    const text = q.value.trim();
    const top = $("#busca-top", sheet);
    top.innerHTML = "";
    $("#busca-sim", sheet).innerHTML = "";
    $("#busca-help", sheet).hidden = !!text;
    if (!text) {
      state.list = [];
      $("#busca-list", sheet).innerHTML = "";
      $("#busca-sub", sheet).textContent = "";
      $("#busca-more", sheet).hidden = true;
      return;
    }
    // número Strong: abre as ocorrências do lema
    const sm = /^([HG])\s*0*(\d{1,4})$/i.exec(text);
    if (sm && window.__concordance) {
      const key = sm[1].toUpperCase() + sm[2];
      top.innerHTML = `<button class="busca-go" data-strong="${esc(key)}">Ver todas as ocorrências de <b>${esc(key)}</b> →</button>`;
    }
    // referência: "Jo 3:16", "Salmos 23"
    if (/\d/.test(text) && !sm && window.__resolveRef) {
      const r = window.__resolveRef(text);
      if (r && r.ok)
        top.innerHTML = `<button class="busca-go" data-cod="${esc(r.book.code)}" data-c="${+r.ch}" data-v="${r.chapterStart ? "" : +r.v}">Ir para <b>${esc(r.book.name)} ${+r.ch}${r.chapterStart ? "" : ":" + +r.v}</b> →</button>`;
    }
    const terms = [...new Set((text.match(TOKEN) || []).map(norm))].filter(t => !/^\d+$/.test(t));
    if (!terms.length || sm) {
      state.list = [];
      $("#busca-list", sheet).innerHTML = "";
      $("#busca-sub", sheet).textContent = "";
      $("#busca-more", sheet).hidden = true;
      return;
    }
    $("#busca-sub", sheet).textContent = "Buscando…";
    const sets = await Promise.all(terms.map(idsOf));
    if (my !== seq) return;
    sets.sort((a, b) => a.length - b.length);
    let ids = sets[0];
    for (const s of sets.slice(1)) {
      const set = new Set(s);
      ids = ids.filter(x => set.has(x));
    }
    const B = books();
    const all = ids.length;
    const nt = ids.filter(id => B[Math.floor(id / 1e6)]?.nt).length;
    ids = ids.filter(id => inScope(id, B));
    // Onde aparece: contagem por livro (tocar filtra)
    const perBook = {};
    for (const id of ids) perBook[Math.floor(id / 1e6)] = (perBook[Math.floor(id / 1e6)] || 0) + 1;
    if (state.book != null && !perBook[state.book]) state.book = null;
    const ranked = Object.entries(perBook).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    $("#busca-books", sheet).innerHTML =
      ranked.length > 1
        ? ranked
            .slice(0, 12)
            .map(
              ([b, k]) =>
                `<button class="chip" data-book="${b}" aria-pressed="${state.book === +b}">${esc(B[b]?.name || "?")} <small>${k}</small></button>`
            )
            .join("")
        : "";
    if (state.book != null) ids = ids.filter(id => Math.floor(id / 1e6) === state.book);
    state = { ...state, list: ids, shown: 0, terms, B };
    const n = ids.length;
    $("#busca-sub", sheet).textContent = n
      ? `${n} ${n === 1 ? "versículo" : "versículos"}${all !== n ? ` (de ${all} na Bíblia toda)` : ` · AT ${all - nt} · NT ${nt}`}.`
      : all
        ? `Nada aqui; ${all} ${all === 1 ? "versículo" : "versículos"} na Bíblia toda.`
        : `Nenhum versículo com ${terms.length > 1 ? "todas essas palavras" : `“${terms[0]}”`}.`;
    if (terms.length === 1 && terms[0].length >= 3) {
      const sim = await similar(terms[0]);
      if (my === seq && sim.length)
        $("#busca-sim", sheet).innerHTML =
          `Parecidas: ${sim.map(w => `<button class="linklike" data-sim="${esc(w)}">${esc(w)}</button>`).join(" · ")}`;
    }
    $("#busca-list", sheet).innerHTML = "";
    more();
  }
  function more() {
    const { list, B } = state;
    const slice = list.slice(state.shown, state.shown + PAGE);
    state.shown += slice.length;
    $("#busca-list", sheet).insertAdjacentHTML(
      "beforeend",
      slice
        .map(id => {
          const b = B[Math.floor(id / 1e6)],
            c = Math.floor(id / 1000) % 1000,
            v = id % 1000;
          return `<li><button class="conc-item busca-item" data-cod="${b.cod}" data-c="${c}" data-v="${v}">
            <span class="conc-ref">${esc(b.name)} ${c}:${v}</span><span class="conc-txt" data-id="${id}">…</span></button></li>`;
        })
        .join("")
    );
    $("#busca-more", sheet).hidden = state.shown >= list.length;
    fill(slice);
  }
  function highlight(text, terms) {
    const set = new Set(terms);
    let out = "",
      pos = 0;
    for (const m of text.matchAll(TOKEN)) {
      if (!set.has(norm(m[0]))) continue;
      out += esc(text.slice(pos, m.index)) + `<mark>${esc(m[0])}</mark>`;
      pos = m.index + m[0].length;
    }
    return out + esc(text.slice(pos));
  }
  async function fill(slice) {
    const byCh = {};
    for (const id of slice) (byCh[Math.floor(id / 1000)] = byCh[Math.floor(id / 1000)] || []).push(id);
    const terms = state.terms;
    for (const [k, ids] of Object.entries(byCh)) {
      const b = state.B[Math.floor(+k / 1000)],
        c = +k % 1000;
      let raw = null;
      try {
        raw = await window.__carregarCapitulo(b.cod, c);
      } catch (_) {
        raw = null;
      }
      for (const id of ids) {
        const el = sheet.querySelector(`.conc-txt[data-id="${id}"]`);
        if (!el) continue;
        const v = raw && raw.v.find(x => x.n === id % 1000);
        el.innerHTML = v ? highlight(v.b || "", terms) : "";
      }
    }
  }
  q.addEventListener("input", () => {
    state.book = null;
    clearTimeout(timer);
    timer = setTimeout(run, 250);
  });
  // Enter: refaz a busca com o texto atual (o atalho na tela pode ser de antes da última tecla) e, se for referência, vai
  $("#busca-form", sheet).addEventListener("submit", async e => {
    e.preventDefault();
    clearTimeout(timer);
    await run();
    const go = $(".busca-go", sheet);
    if (go && go.dataset.cod) go.click();
  });
  sheet.addEventListener("click", e => {
    if (e.target.closest("[data-fechar]")) return close();
    const sc = e.target.closest("[data-scope]");
    if (sc) {
      state.scope = sc.dataset.scope;
      state.book = null;
      sheet.querySelectorAll("[data-scope]").forEach(b => b.setAttribute("aria-pressed", String(b === sc)));
      return run();
    }
    const bk = e.target.closest("[data-book]");
    if (bk) {
      state.book = state.book === +bk.dataset.book ? null : +bk.dataset.book;
      return run();
    }
    const sim = e.target.closest("[data-sim]");
    if (sim) {
      q.value = sim.dataset.sim;
      return run();
    }
    if (e.target.closest("#busca-more")) return more();
    const st = e.target.closest("[data-strong]");
    if (st) {
      close();
      return window.__concordance(st.dataset.strong, null);
    }
    const it = e.target.closest("[data-cod]");
    if (it) {
      close();
      document.dispatchEvent(
        new CustomEvent("annotations:goto", {
          detail: { book: it.dataset.cod, chapter: +it.dataset.c, verse: it.dataset.v ? +it.dataset.v : null }
        })
      );
    }
  });
  sheet.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
  // Esc fecha mesmo quando o foco saiu da folha (por exemplo, depois de um filtro redesenhar a lista)
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !sheet.hidden && !sheet.contains(document.activeElement)) close();
  });
  document.getElementById("open-search")?.addEventListener("click", () => open());
  window.__openSearch = open;
  window.Search = { open, close };
})();
