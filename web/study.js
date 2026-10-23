import { flushSync, mount } from "svelte";
import ConcordanceSheet from "../src/components/ConcordanceSheet.svelte";
import { t } from "../src/i18n";
import {
  bucketOf,
  createConcordance,
  filterOccurrences,
  glossCounts,
  markSpans,
  occurrences,
  occurrencesPerBook,
  spansOf
} from "../src/lib/study/concordance";
import { conc } from "../src/state/concordance.svelte";
// Estudo: ligação palavra ↔ Bíblia Livre e concordância (todas as ocorrências de um lema). O mapa das seções é SectionMap.svelte.
// Usa o que o leitor expõe: window.__chapter(), window.__books, window.__carregarCapitulo e os eventos
// "word-opened" e "chapter-rendered".
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const HL = typeof CSS !== "undefined" && CSS.highlights && typeof Highlight !== "undefined";
  const chapter = () => (window.__chapter ? window.__chapter() : null);

  // ---------- Palavra ↔ Bíblia Livre ----------
  // Cada versículo traz "links": [palavra, início, fim, início, fim, …] com posições no texto da BLIVRE.
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
      for (const [s, e] of spansOf(v.links, i)) {
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

  // ---------- Concordância (ConcordanceSheet.svelte; as ocorrências em src/lib/study/concordance.ts) ----------
  const concordance = createConcordance();
  const bookByIndex = () => {
    const out = [];
    for (const [cod, b] of Object.entries(window.__books || {})) out[b.i] = { cod, ...b };
    return out;
  };
  mount(ConcordanceSheet, {
    target: document.body,
    props: {
      onclose: () => close(),
      ongloss(i) {
        conc.gloss = i;
        render();
      },
      onbook(i) {
        conc.book = conc.book === i ? null : i;
        render();
      },
      onhere(on) {
        conc.book = on ? conc.hereIndex : null;
        render();
      },
      onallglosses() {
        conc.allGlosses = true;
      },
      onallbooks() {
        conc.allBooks = true;
      },
      onmore: () => more(),
      onitem(it) {
        close();
        document.dispatchEvent(new CustomEvent("annotations:goto", { detail: { book: it.code, chapter: it.chapter, verse: it.verse } }));
      }
    }
  });
  const sheet = document.getElementById("concordancia");
  let entry = null,
    all = [],
    list = [],
    books = [],
    focusBack = null;
  const PAGE = 40;

  async function open(key, word) {
    focusBack = document.activeElement;
    entry = await concordance.entry(key);
    all = entry ? occurrences(entry) : [];
    books = bookByIndex();
    const here = chapter() && window.__currentChapter ? window.__currentChapter.book : null;
    Object.assign(conc, {
      title: t("concordance.title", { lemma: word && word.lemma ? word.lemma : key }),
      available: !!entry,
      gloss: -1,
      glosses: entry ? glossCounts(entry) : [],
      allGlosses: false,
      allBooks: false,
      book: null,
      hereName: here ? (window.__books[here] || {}).name || here : "",
      hereIndex: books.findIndex(b => b && b.cod === here)
    });
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    conc.open = true;
    render();
    document.body.classList.add("com-conc");
    document.getElementById("conc-h").focus();
  }
  function close() {
    if (!conc.open) return;
    conc.open = false;
    flushSync();
    document.body.classList.remove("com-conc");
    if (focusBack && focusBack.isConnected) focusBack.focus({ preventScroll: true });
  }
  function render() {
    if (!entry) {
      Object.assign(conc, { summary: t("concordance.unavailable"), items: [], more: false });
      return flushSync();
    }
    // Onde aparece: livros com mais ocorrências primeiro (com o filtro de tradução, sem o de livro); tocar filtra
    conc.books = occurrencesPerBook(filterOccurrences(all, conc.gloss, null)).map(([b, n]) => ({
      index: b,
      name: books[b]?.name || "?",
      count: n
    }));
    list = filterOccurrences(all, conc.gloss, conc.book);
    const total = all.length;
    conc.summary = list.length === total ? t("concordance.total", { count: total }) : t("concordance.some", { count: list.length, total });
    conc.items = [];
    more();
  }
  function more() {
    const slice = list.slice(conc.items.length, conc.items.length + PAGE);
    conc.items = [
      ...conc.items,
      ...slice.map(x => {
        const bk = books[x.b] || { name: "?", cod: "" };
        return {
          key: `${bk.cod}.${x.c}.${x.v}.${x.i}`,
          ref: `${bk.name} ${x.c}:${x.v}`,
          code: bk.cod,
          chapter: x.c,
          verse: x.v,
          word: x.i,
          gloss: entry.g[x.g] || "",
          html: null
        };
      })
    ];
    conc.more = conc.items.length < list.length;
    flushSync();
    fillTexts(slice);
  }
  // Texto de cada versículo: carrega o capítulo (uma vez) e destaca as palavras ligadas ao lema
  async function fillTexts(slice) {
    const byChapter = {};
    for (const x of slice) {
      const bk = books[x.b];
      if (bk) (byChapter[`${bk.cod}.${x.c}`] ||= []).push(x);
    }
    for (const [k, xs] of Object.entries(byChapter)) {
      const [cod, c] = k.split(".");
      let raw = null;
      try {
        raw = window.__carregarCapitulo ? await window.__carregarCapitulo(cod, +c) : null;
      } catch (_) {
        raw = null;
      }
      const html = {};
      for (const x of xs) {
        const v = raw && raw.v.find(y => y.n === x.v);
        html[`${cod}.${c}.${x.v}.${x.i}`] = v ? markSpans(v.b || "", spansOf(v.a || [], x.i)) : "";
      }
      conc.items = conc.items.map(it => (it.key in html ? { ...it, html: html[it.key] } : it));
    }
  }
  // Esc fecha mesmo quando o foco saiu da folha (por exemplo, depois de um filtro redesenhar a lista)
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && conc.open && !sheet.contains(document.activeElement)) close();
  });
  window.__concordance = (key, word) => open(key, word);
  window.Study = { open, close, bucketOf };
})();
