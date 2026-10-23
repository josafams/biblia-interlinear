// Busca na Bíblia toda (texto da Bíblia Livre). A folha é SearchSheet.svelte; a busca (índice, interseção, realce)
// está em src/lib/search/search.ts. Aqui fica o que liga as duas: digitar, filtros, a lista aos poucos e os atalhos
// para referências ("Jo 3:16") e números Strong ("G25", "H430").
import { flushSync, mount } from "svelte";
import SearchSheet from "../src/components/SearchSheet.svelte";
import { t } from "../src/i18n";
import { createSearchIndex, highlight, intersect, perBook, searchTerms, strongQuery, verseOf } from "../src/lib/search/search";
import { search } from "../src/state/search.svelte";

(() => {
  "use strict";
  const PAGE = 30;
  const index = createSearchIndex();
  const books = () => {
    const out = [];
    for (const [cod, b] of Object.entries(window.__books || {})) out[b.i] = { cod, ...b };
    return out;
  };
  let list = [],
    terms = [],
    B = [],
    focusBack = null,
    timer = 0,
    seq = 0;

  mount(SearchSheet, {
    target: document.body,
    props: {
      onclose: () => close(),
      oninput() {
        search.book = null;
        clearTimeout(timer);
        timer = setTimeout(run, 250);
      },
      // Enter: refaz a busca com o texto atual (o atalho na tela pode ser de antes da última tecla) e, se for referência, vai
      async onsubmit() {
        clearTimeout(timer);
        await run();
        if (search.top?.kind === "ref") goTo(search.top);
      },
      onscope(scope) {
        search.scope = scope;
        search.book = null;
        run();
      },
      onbook(i) {
        search.book = search.book === i ? null : i;
        run();
      },
      onsimilar(w) {
        search.query = w;
        run();
      },
      onmore: () => more(),
      ontop(top) {
        if (top.kind === "ref") return goTo(top);
        close();
        window.__concordance(top.key, null);
      },
      onitem: it => goTo({ code: it.code, chapter: it.chapter, verse: it.verse })
    }
  });
  const sheet = document.getElementById("busca");
  const input = document.getElementById("busca-q");

  function open(text) {
    focusBack = document.activeElement;
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    search.hereBook = window.__currentChapter?.bookName || "";
    search.open = true;
    flushSync();
    document.body.classList.add("com-busca");
    document.getElementById("open-search")?.setAttribute("aria-expanded", "true");
    if (typeof text === "string") {
      search.query = text;
      run();
    }
    input.focus();
    input.select();
  }
  function close() {
    if (!search.open) return;
    search.open = false;
    flushSync();
    document.body.classList.remove("com-busca");
    document.getElementById("open-search")?.setAttribute("aria-expanded", "false");
    if (focusBack && focusBack.isConnected) focusBack.focus({ preventScroll: true });
  }
  function goTo(target) {
    close();
    document.dispatchEvent(
      new CustomEvent("annotations:goto", { detail: { book: target.code, chapter: target.chapter, verse: target.verse } })
    );
  }
  function inScope(id) {
    const b = B[verseOf(id).book];
    if (!b) return false;
    if (search.scope === "at") return !b.nt;
    if (search.scope === "nt") return !!b.nt;
    if (search.scope === "livro") return b.cod === window.__currentChapter?.book;
    return true;
  }
  function clearList() {
    list = [];
    search.items = [];
    search.summary = "";
    search.books = [];
    search.more = false;
  }
  async function run() {
    const my = ++seq;
    const text = search.query.trim();
    search.top = null;
    search.similar = [];
    if (!text) return clearList();
    // número Strong: abre as ocorrências do lema
    const strong = strongQuery(text);
    if (strong && window.__concordance) search.top = { kind: "strong", key: strong };
    // referência: "Jo 3:16", "Salmos 23"
    if (/\d/.test(text) && !strong && window.__resolveRef) {
      const r = window.__resolveRef(text);
      if (r && r.ok)
        search.top = {
          kind: "ref",
          code: r.book.code,
          chapter: +r.ch,
          verse: r.chapterStart ? null : +r.v,
          label: `${r.book.name} ${+r.ch}${r.chapterStart ? "" : ":" + +r.v}`
        };
    }
    terms = searchTerms(text);
    if (!terms.length || strong) return clearList();
    search.summary = t("search.searching");
    const lists = await Promise.all(terms.map(w => index.idsOf(w)));
    if (my !== seq) return;
    B = books();
    let ids = intersect(lists);
    const all = ids.length;
    const nt = ids.filter(id => B[verseOf(id).book]?.nt).length;
    ids = ids.filter(inScope);
    // Onde aparece: contagem por livro (tocar filtra)
    const ranked = perBook(ids);
    if (search.book != null && !ranked.some(([b]) => b === search.book)) search.book = null;
    search.books = ranked.map(([b, n]) => ({ index: b, name: B[b]?.name || "?", count: n }));
    if (search.book != null) ids = ids.filter(id => verseOf(id).book === search.book);
    list = ids;
    const n = ids.length;
    search.summary = n
      ? all !== n
        ? t("search.found_of", { count: n, all })
        : t("search.found", { count: n, at: all - nt, nt })
      : all
        ? t("search.nothing_here", { count: all })
        : terms.length > 1
          ? t("search.none_all")
          : t("search.none", { word: terms[0] });
    search.items = [];
    if (terms.length === 1 && terms[0].length >= 3) {
      const sim = await index.similar(terms[0]);
      if (my === seq) search.similar = sim;
    }
    more();
  }
  function more() {
    const slice = list.slice(search.items.length, search.items.length + PAGE);
    search.items = [
      ...search.items,
      ...slice.map(id => {
        const { book, chapter, verse } = verseOf(id);
        const b = B[book];
        return { id, ref: `${b.name} ${chapter}:${verse}`, code: b.cod, chapter, verse, html: null };
      })
    ];
    search.more = search.items.length < list.length;
    fill(slice);
  }
  // o texto de cada versículo vem do capítulo dele (carregado sob demanda), com as palavras buscadas marcadas
  async function fill(slice) {
    const byChapter = {};
    for (const id of slice) (byChapter[Math.floor(id / 1000)] ||= []).push(id);
    const words = terms;
    for (const [k, ids] of Object.entries(byChapter)) {
      const b = B[Math.floor(+k / 1000)];
      let raw = null;
      try {
        raw = await window.__carregarCapitulo(b.cod, +k % 1000);
      } catch (_) {
        raw = null;
      }
      const texts = Object.fromEntries(ids.map(id => [id, raw?.v.find(x => x.n === id % 1000)?.b]));
      search.items = search.items.map(it =>
        it.id in texts ? { ...it, html: texts[it.id] != null ? highlight(texts[it.id], words) : "" } : it
      );
    }
  }
  // Esc fecha mesmo quando o foco saiu da folha (por exemplo, depois de um filtro redesenhar a lista)
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && search.open && !sheet.contains(document.activeElement)) close();
  });
  document.getElementById("open-search")?.addEventListener("click", () => open());
  window.__openSearch = open;
  window.Search = { open, close };
})();
