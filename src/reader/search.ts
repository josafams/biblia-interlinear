// "Buscar na Bíblia" (the whole Bíblia Livre text). The sheet is SearchSheet.svelte; the search itself (index,
// intersection, highlight) is src/lib/search/search.ts. Here is what joins them: typing, the filters, the list in
// pages and the shortcuts to references ("Jo 3:16") and Strong numbers ("G25", "H430").
import { flushSync, mount } from "svelte";
import SearchSheet from "../components/SearchSheet.svelte";
import { t } from "../i18n";
import { createSearchIndex, highlight, intersect, perBook, searchTerms, strongQuery, verseOf } from "../lib/search/search";
import { type SearchItem, type SearchTop, search } from "../state/search.svelte";
import { BOOKS, R, bible } from "./context";
import { openChapter } from "./chapter";
import { ANNOTATIONS_OPEN_PANEL } from "./events";
import { parseRef, resolveRef } from "./toc";

const PAGE = 30;
const index = createSearchIndex();
let list: number[] = [],
  terms: string[] = [],
  focusBack: Element | null = null,
  timer: ReturnType<typeof setTimeout> | undefined,
  seq = 0;

const input = () => document.getElementById("busca-q") as HTMLInputElement;
const searchButton = () => document.getElementById("open-search");

export function openSearch(text?: string) {
  focusBack = document.activeElement;
  document.dispatchEvent(new CustomEvent(ANNOTATIONS_OPEN_PANEL));
  search.hereBook = R.book?.name || "";
  search.open = true;
  flushSync();
  document.body.classList.add("com-busca");
  searchButton()?.setAttribute("aria-expanded", "true");
  if (typeof text === "string") {
    search.query = text;
    run();
  }
  input().focus();
  input().select();
}
function close() {
  if (!search.open) return;
  search.open = false;
  flushSync();
  document.body.classList.remove("com-busca");
  searchButton()?.setAttribute("aria-expanded", "false");
  if (focusBack instanceof HTMLElement && focusBack.isConnected) focusBack.focus({ preventScroll: true });
}
function goTo(target: { code: string; chapter: number; verse: number | null }) {
  close();
  openChapter(target.code, target.chapter, target.verse);
}

function inScope(id: number) {
  const b = BOOKS[verseOf(id).book];
  if (!b) return false;
  if (search.scope === "at") return !b.nt;
  if (search.scope === "nt") return !!b.nt;
  if (search.scope === "livro") return b.code === R.book?.code;
  return true;
}
function clearList() {
  list = [];
  search.items = [];
  search.summary = "";
  search.books = [];
  search.more = false;
}

/** The shortcut above the results: a Strong number opens its occurrences, a reference goes there. */
function topOf(text: string, strong: string | null): SearchTop | null {
  if (strong && window.__concordance) return { kind: "strong", key: strong };
  if (!/\d/.test(text) || strong) return null;
  const r = resolveRef(parseRef(text));
  if (!r || !("ok" in r)) return null;
  return {
    kind: "ref",
    code: r.book.code,
    chapter: +r.ch,
    verse: r.chapterStart ? null : +r.v,
    label: `${r.book.name} ${+r.ch}${r.chapterStart ? "" : ":" + +r.v}`
  };
}

function summary(n: number, all: number, nt: number) {
  if (n) return all !== n ? t("search.found_of", { count: n, all }) : t("search.found", { count: n, at: all - nt, nt });
  if (all) return t("search.nothing_here", { count: all });
  return terms.length > 1 ? t("search.none_all") : t("search.none", { word: terms[0] });
}

async function run() {
  const my = ++seq;
  const text = search.query.trim();
  search.similar = [];
  if (!text) {
    search.top = null;
    return clearList();
  }
  const strong = strongQuery(text);
  search.top = topOf(text, strong);
  terms = searchTerms(text);
  if (!terms.length || strong) return clearList();
  search.summary = t("search.searching");
  const lists = await Promise.all(terms.map(w => index.idsOf(w)));
  if (my !== seq) return;
  let ids = intersect(lists);
  const all = ids.length;
  const nt = ids.filter(id => BOOKS[verseOf(id).book]?.nt).length;
  ids = ids.filter(inScope);
  // where it shows up: a count per book (a tap filters)
  const ranked = perBook(ids);
  if (search.book != null && !ranked.some(([b]) => b === search.book)) search.book = null;
  search.books = ranked.map(([b, n]) => ({ index: b, name: BOOKS[b]?.name || "?", count: n }));
  if (search.book != null) ids = ids.filter(id => verseOf(id).book === search.book);
  list = ids;
  search.summary = summary(ids.length, all, nt);
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
    ...slice.map((id): SearchItem => {
      const { book, chapter, verse } = verseOf(id);
      const b = BOOKS[book];
      return { id, ref: `${b.name} ${chapter}:${verse}`, code: b.code, chapter, verse, html: null };
    })
  ];
  search.more = search.items.length < list.length;
  fill(slice);
}

// the text of each verse comes from its chapter (loaded on demand), with the words searched for marked
async function fill(slice: number[]) {
  const byChapter: Record<number, number[]> = {};
  for (const id of slice) (byChapter[Math.floor(id / 1000)] ||= []).push(id);
  const words = terms;
  for (const [k, ids] of Object.entries(byChapter)) {
    const b = BOOKS[Math.floor(+k / 1000)];
    const raw = (await bible.fetchChapter(b.code, +k % 1000).catch(() => null)) as { v: { n: number; b?: string }[] } | null;
    const texts = Object.fromEntries(ids.map(id => [id, raw?.v.find(x => x.n === id % 1000)?.b]));
    search.items = search.items.map(it =>
      it.id in texts ? { ...it, html: texts[it.id] != null ? highlight(texts[it.id]!, words) : "" } : it
    );
  }
}

export function initSearch() {
  mount(SearchSheet, {
    target: document.body,
    props: {
      onclose: () => close(),
      oninput() {
        search.book = null;
        clearTimeout(timer);
        timer = setTimeout(run, 250);
      },
      // Enter: searches again with the current text (the shortcut on screen may be from before the last key) and
      // goes there when it is a reference
      async onsubmit() {
        clearTimeout(timer);
        await run();
        if (search.top?.kind === "ref") goTo(search.top);
      },
      onscope(scope: typeof search.scope) {
        search.scope = scope;
        search.book = null;
        run();
      },
      onbook(i: number) {
        search.book = search.book === i ? null : i;
        run();
      },
      onsimilar(w: string) {
        search.query = w;
        run();
      },
      onmore: () => more(),
      ontop(top: SearchTop) {
        if (top.kind === "ref") return goTo(top);
        close();
        window.__concordance?.(top.key, null);
      },
      onitem: (it: SearchItem) => goTo({ code: it.code, chapter: it.chapter, verse: it.verse })
    }
  });
  // Esc closes even when the focus left the sheet (for example after a filter drew the list again)
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && search.open && !document.getElementById("busca")!.contains(document.activeElement)) close();
  });
  searchButton()?.addEventListener("click", () => openSearch());
  window.__openSearch = openSearch;
  window.Search = { open: openSearch, close };
}

// starts when imported, in the order src/reader/main.ts imports it
initSearch();
