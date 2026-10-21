// Estudo: ligação palavra ↔ Bíblia Livre, concordância (todas as ocorrências de um lema) e mapa das seções do capítulo.
// Usa o que o leitor expõe: window.__chapter(), window.__books, window.__carregarCapitulo e os eventos
// "word-opened" e "chapter-rendered".
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const HL = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  const chapter = () => (window.__chapter ? window.__chapter() : null);

  // ---------- Palavra ↔ Bíblia Livre ----------
  // Cada versículo traz "links": [palavra, início, fim, início, fim, …] com posições no texto da BLIVRE.
  function spansOf(verse, wordIndex) {
    const row = (verse.links || []).find(r => r[0] === wordIndex);
    const out = [];
    if (row) for (let k = 1; k + 1 < row.length; k += 2) out.push([row[k], row[k + 1]]);
    return out;
  }
  function wordsAt(verse, offset) {
    return (verse.links || []).filter(r => {
      for (let k = 1; k + 1 < r.length; k += 2) if (offset >= r[k] && offset < r[k + 1]) return true;
      return false;
    });
  }
  // Nós de texto da BLIVRE (sem o rótulo "BLIVRE"), com a posição de cada um no texto do versículo
  function textNodes(bl) {
    const out = [];
    const walk = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.parentElement.closest(".tag") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
    });
    let pos = 0;
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      out.push({ n, start: pos });
      pos += n.data.length;
    }
    return out;
  }
  function rangeOf(nodes, s, e) {
    const at = off => {
      for (const t of nodes) if (off <= t.start + t.n.data.length) return [t.n, Math.max(0, off - t.start)];
      return null;
    };
    const a = at(s),
      b = at(e);
    if (!a || !b) return null;
    const r = document.createRange();
    r.setStart(a[0], a[1]);
    r.setEnd(b[0], b[1]);
    return r;
  }
  let linkedCards = [];
  function clearLinks() {
    if (HL) CSS.highlights.delete("ligada");
    linkedCards.forEach(c => c.classList.remove("linked"));
    linkedCards = [];
  }
  function showLinks(vi, wordIndexes, alsoCards) {
    clearLinks();
    const CH = chapter();
    const v = CH && CH.verses[vi];
    const sec = v && document.getElementById("v" + v.n);
    if (!sec) return;
    const bl = $(".blivre", sec);
    const nodes = bl ? textNodes(bl) : [];
    const ranges = [];
    for (const i of wordIndexes) {
      for (const [s, e] of spansOf(v, i)) {
        const r = rangeOf(nodes, s, e);
        if (r) ranges.push(r);
      }
      if (alsoCards) {
        const c = sec.querySelector(`.word[data-i="${i}"]`);
        if (c) {
          c.classList.add("linked");
          linkedCards.push(c);
        }
      }
    }
    if (HL && ranges.length) CSS.highlights.set("ligada", new Highlight(...ranges));
  }
  document.addEventListener("word-opened", e => {
    const w = e.detail && e.detail.word;
    if (!w) return clearLinks();
    showLinks(w.v, [w.i], false);
  });
  // Mudou de capítulo: a lista de ocorrências fecha (redesenhar o mesmo capítulo, ao trocar o modo, não fecha)
  let shownChapter = "";
  document.addEventListener("chapter-rendered", e => {
    clearLinks();
    const d = e.detail || {};
    const k = `${d.book}.${d.chapter}`;
    if (shownChapter && k !== shownChapter) window.Study?.close();
    shownChapter = k;
  });
  // Tocar numa palavra da BLIVRE acende os cartões do original que ela traduz
  function offsetFromPoint(bl, x, y) {
    let node = null,
      off = 0;
    if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(x, y);
      if (p) {
        node = p.offsetNode;
        off = p.offset;
      }
    } else if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(x, y);
      if (r) {
        node = r.startContainer;
        off = r.startOffset;
      }
    }
    if (!node || node.nodeType !== 3 || !bl.contains(node)) return -1;
    const t = textNodes(bl).find(x => x.n === node);
    return t ? t.start + off : -1;
  }
  document.addEventListener("click", e => {
    const bl = e.target.closest && e.target.closest("#verses .blivre");
    if (!bl || e.target.closest(".tag")) return;
    if (document.body.classList.contains("hide-orig") && !bl.closest(".verse.abrir")) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const sec = bl.closest(".verse"),
      CH = chapter();
    const vi = +sec.dataset.vi,
      v = CH && CH.verses[vi];
    if (!v || !v.links.length) return;
    const off = offsetFromPoint(bl, e.clientX, e.clientY);
    const hits = off < 0 ? [] : wordsAt(v, off);
    if (!hits.length) return clearLinks();
    showLinks(
      vi,
      hits.map(r => r[0]),
      true
    );
    const n = hits.length;
    const card = sec.querySelector(`.word[data-i="${hits[0][0]}"]`);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    announce(`${n} ${n === 1 ? "palavra do original ligada" : "palavras do original ligadas"} a este trecho.`);
  });
  function announce(msg) {
    let live = $("#study-live");
    if (!live) {
      live = document.createElement("div");
      live.id = "study-live";
      live.className = "sr";
      live.setAttribute("aria-live", "polite");
      document.body.appendChild(live);
    }
    live.textContent = msg;
  }

  // ---------- Mapa das seções (Salmo 119 e outros capítulos com títulos) ----------
  document.addEventListener("chapter-rendered", () => {
    const CH = chapter(),
      root = document.getElementById("verses");
    document.getElementById("secmap")?.remove();
    if (!CH || !root) return;
    const heads = CH.verses.filter(v => v.h);
    if (heads.length < 2) return;
    const nav = document.createElement("nav");
    nav.id = "secmap";
    nav.className = "secmap";
    nav.setAttribute("aria-label", "Seções do capítulo");
    nav.innerHTML = heads.map(v => `<a href="#s${v.n}" data-sec="${v.n}">${esc(v.h)}</a>`).join("");
    root.parentElement.insertBefore(nav, root);
  });
  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest(".secmap a");
    if (!a) return;
    e.preventDefault();
    document.getElementById("s" + a.dataset.sec)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ---------- Concordância ----------
  const CONC = {},
    pendingConc = {};
  window.__conc = (bucket, d) => {
    CONC[bucket] = d;
    pendingConc[bucket]?.ok(d);
    delete pendingConc[bucket];
  };
  const bucketOf = key => {
    const m = /^([HG])(\d+)$/.exec(key || "");
    return m ? `${m[1]}${Math.floor(+m[2] / 100)}` : `${(key || "G")[0]}x`;
  };
  function loadBucket(b) {
    if (CONC[b]) return Promise.resolve(CONC[b]);
    return new Promise((ok, fail) => {
      pendingConc[b] = { ok };
      const s = document.createElement("script");
      s.src = `dados/conc/${b}.js`;
      s.async = true;
      s.onload = () => s.remove();
      s.onerror = () => {
        delete pendingConc[b];
        s.remove();
        fail(new Error("sem concordância"));
      };
      document.head.appendChild(s);
    });
  }
  const bookByIndex = () => {
    const out = [];
    for (const [cod, b] of Object.entries(window.__books || {})) out[b.i] = { cod, ...b };
    return out;
  };

  const sheet = document.createElement("aside");
  sheet.id = "concordancia";
  sheet.className = "sheet right conc-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "conc-h");
  sheet.innerHTML = `
    <div class="shead"><h2 id="conc-h">Ocorrências</h2><button class="ibtn" data-fechar aria-label="Fechar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="sgroup">
      <p class="conc-sub" id="conc-sub"></p>
      <div class="conc-gl" id="conc-gl" role="group" aria-label="Filtrar pela tradução"></div>
      <div class="conc-scope" role="group" aria-label="Onde">
        <button class="chip" data-scope="" aria-pressed="true">Bíblia toda</button>
        <button class="chip" data-scope="livro" aria-pressed="false" id="conc-book"></button>
      </div>
      <ol class="conc-list" id="conc-list"></ol>
      <button class="conc-more" id="conc-more" hidden>Mostrar mais</button>
    </div>`;
  document.body.appendChild(sheet);
  let state = null,
    focusBack = null;
  const PAGE = 40;

  async function open(key, word) {
    focusBack = document.activeElement;
    let d;
    try {
      d = (await loadBucket(bucketOf(key)))[key];
    } catch (_) {
      d = null;
    }
    const CH = chapter();
    const books = bookByIndex();
    const here = CH && window.__currentChapter ? window.__currentChapter.book : null;
    state = { key, d, gloss: -1, scope: "", shown: 0, books, here, word };
    $("#conc-h").textContent = word && word.lemma ? `Ocorrências de ${word.lemma}` : `Ocorrências de ${key}`;
    $("#conc-book").textContent = here ? `Só em ${(window.__books[here] || {}).name || here}` : "";
    $("#conc-book").hidden = !here;
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    sheet.hidden = false;
    document.body.classList.add("com-conc");
    render();
    $("#conc-h").setAttribute("tabindex", "-1");
    $("#conc-h").focus();
  }
  function close() {
    if (sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove("com-conc");
    if (focusBack && focusBack.isConnected) focusBack.focus({ preventScroll: true });
  }
  function filtered() {
    const { d, gloss, scope, books, here } = state;
    const o = d ? d.o : [];
    const out = [];
    for (let k = 0; k + 4 < o.length; k += 5) {
      const [b, c, v, i, g] = o.slice(k, k + 5);
      if (gloss >= 0 && g !== gloss) continue;
      if (scope === "livro" && books[b]?.cod !== here) continue;
      out.push({ b, c, v, i, g });
    }
    return out.sort((x, y) => x.b - y.b || x.c - y.c || x.v - y.v || x.i - y.i);
  }
  function render() {
    const { d } = state;
    if (!d) {
      $("#conc-sub").textContent = "A lista de ocorrências não está disponível neste aparelho (precisa de internet na primeira vez).";
      $("#conc-gl").innerHTML = "";
      $("#conc-list").innerHTML = "";
      $("#conc-more").hidden = true;
      return;
    }
    const counts = {};
    for (let k = 4; k < d.o.length; k += 5) counts[d.o[k]] = (counts[d.o[k]] || 0) + 1;
    // As traduções mais comuns primeiro; as raras ficam atrás de "+N" para a lista não ocupar a tela toda
    const TOP = 8;
    const chips = d.g
      .map((g, i) => ({ g, i }))
      .filter(x => x.g)
      .map(
        x =>
          `<button class="chip" data-gl="${x.i}" aria-pressed="${state.gloss === x.i}">${esc(x.g)} <small>${counts[x.i] || 0}</small></button>`
      );
    const extra = state.allGlosses || chips.length <= TOP + 1 ? [] : chips.splice(TOP);
    $("#conc-gl").innerHTML =
      `<button class="chip" data-gl="-1" aria-pressed="${state.gloss < 0}">Todas</button>` +
      chips.join("") +
      (extra.length
        ? `<button class="chip conc-allgl" data-allgl aria-label="Mostrar mais ${extra.length} traduções">+${extra.length}</button>`
        : "");
    sheet.querySelectorAll("[data-scope]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.scope === state.scope)));
    const xs = filtered();
    const total = d.o.length / 5;
    $("#conc-sub").textContent =
      xs.length === total ? `${total} ${total === 1 ? "ocorrência" : "ocorrências"} na Bíblia.` : `${xs.length} de ${total} ocorrências.`;
    state.list = xs;
    state.shown = 0;
    $("#conc-list").innerHTML = "";
    more();
  }
  function more() {
    const { list, books, d } = state;
    const slice = list.slice(state.shown, state.shown + PAGE);
    state.shown += slice.length;
    const html = slice
      .map(x => {
        const bk = books[x.b] || { name: "?", cod: "" };
        return `<li><button class="conc-item" data-cod="${bk.cod}" data-c="${x.c}" data-v="${x.v}" data-i="${x.i}">
          <span class="conc-ref">${esc(bk.name)} ${x.c}:${x.v}</span><span class="conc-g">${esc(d.g[x.g] || "")}</span>
          <span class="conc-txt" data-k="${bk.cod}.${x.c}.${x.v}.${x.i}">…</span></button></li>`;
      })
      .join("");
    $("#conc-list").insertAdjacentHTML("beforeend", html);
    $("#conc-more").hidden = state.shown >= list.length;
    fillTexts(slice);
  }
  // Texto de cada versículo: carrega o capítulo (uma vez) e destaca as palavras ligadas ao lema
  async function fillTexts(slice) {
    const byChapter = {};
    for (const x of slice) {
      const bk = state.books[x.b];
      if (bk) (byChapter[`${bk.cod}.${x.c}`] = byChapter[`${bk.cod}.${x.c}`] || []).push(x);
    }
    for (const [k, xs] of Object.entries(byChapter)) {
      const [cod, c] = k.split(".");
      let raw = null;
      try {
        raw = window.__carregarCapitulo ? await window.__carregarCapitulo(cod, +c) : null;
      } catch (_) {
        raw = null;
      }
      for (const x of xs) {
        const el = sheet.querySelector(`.conc-txt[data-k="${cod}.${c}.${x.v}.${x.i}"]`);
        if (!el) continue;
        const v = raw && raw.v.find(y => y.n === x.v);
        if (!v) {
          el.textContent = "";
          continue;
        }
        const text = v.b || "";
        const spans = spansOf({ links: v.a || [] }, x.i).sort((a, b) => a[0] - b[0]);
        let out = "",
          pos = 0;
        for (const [s, e] of spans) {
          if (s < pos) continue;
          out += esc(text.slice(pos, s)) + `<mark>${esc(text.slice(s, e))}</mark>`;
          pos = e;
        }
        el.innerHTML = out + esc(text.slice(pos));
      }
    }
  }
  sheet.addEventListener("click", e => {
    if (e.target.closest("[data-fechar]")) return close();
    if (e.target.closest("[data-allgl]")) {
      state.allGlosses = true;
      return render();
    }
    const g = e.target.closest("[data-gl]");
    if (g) {
      state.gloss = +g.dataset.gl;
      return render();
    }
    const sc = e.target.closest("[data-scope]");
    if (sc) {
      state.scope = sc.dataset.scope;
      return render();
    }
    if (e.target.closest("#conc-more")) return more();
    const it = e.target.closest(".conc-item");
    if (it) {
      close();
      document.dispatchEvent(
        new CustomEvent("annotations:goto", { detail: { book: it.dataset.cod, chapter: +it.dataset.c, verse: +it.dataset.v } })
      );
    }
  });
  sheet.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  });
  window.__concordance = (key, word) => open(key, word);
  window.Study = { open, close, bucketOf };
})();
