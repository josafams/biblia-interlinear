// The concordance (ConcordanceSheet.svelte; the occurrences in src/lib/study/concordance.ts): every place a
// lemma shows up, filtered by translation and by book, each verse with the linked words marked.
import { flushSync, mount } from "svelte";
import ConcordanceSheet from "../components/ConcordanceSheet.svelte";
import { t } from "../i18n";
import {
  type ConcEntry,
  type Occurrence,
  bucketOf,
  createConcordance,
  filterOccurrences,
  glossCounts,
  markSpans,
  occurrences,
  occurrencesPerBook,
  spansOf
} from "../lib/study/concordance";
import { conc } from "../state/concordance.svelte";
import { BOOKS, R, bible } from "./context";
import { openChapter } from "./chapter";
import { ANNOTATIONS_OPEN_PANEL } from "./events";
import { initLinks } from "./links";

const PAGE = 40;
const concordance = createConcordance();
let entry: ConcEntry | null = null,
  all: Occurrence[] = [],
  list: Occurrence[] = [],
  focusBack: Element | null = null;

type ConcItem = (typeof conc.items)[number];

async function open(key: string, word: { lemma?: string } | null) {
  focusBack = document.activeElement;
  entry = (await concordance.entry(key)) as ConcEntry | null;
  all = entry ? occurrences(entry) : [];
  const here = R.book;
  Object.assign(conc, {
    title: t("concordance.title", { lemma: word?.lemma || key }),
    available: !!entry,
    gloss: -1,
    glosses: entry ? glossCounts(entry) : [],
    allGlosses: false,
    allBooks: false,
    book: null,
    hereName: here?.name || "",
    hereIndex: here ? BOOKS.indexOf(here) : -1
  });
  document.dispatchEvent(new CustomEvent(ANNOTATIONS_OPEN_PANEL));
  conc.open = true;
  render();
  document.body.classList.add("com-conc");
  document.getElementById("conc-h")!.focus();
}
function close() {
  if (!conc.open) return;
  conc.open = false;
  flushSync();
  document.body.classList.remove("com-conc");
  if (focusBack instanceof HTMLElement && focusBack.isConnected) focusBack.focus({ preventScroll: true });
}

function render() {
  if (!entry) {
    Object.assign(conc, { summary: t("concordance.unavailable"), items: [], more: false });
    return flushSync();
  }
  // where it shows up: the books with more occurrences first (with the translation filter, not the book one); a tap filters
  conc.books = occurrencesPerBook(filterOccurrences(all, conc.gloss, null)).map(([b, n]) => ({
    index: b,
    name: BOOKS[b]?.name || "?",
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
    ...slice.map((x): ConcItem => {
      const bk = BOOKS[x.b] || { name: "?", code: "" };
      return {
        key: `${bk.code}.${x.c}.${x.v}.${x.i}`,
        ref: `${bk.name} ${x.c}:${x.v}`,
        code: bk.code,
        chapter: x.c,
        verse: x.v,
        word: x.i,
        gloss: entry!.g[x.g] || "",
        html: null
      };
    })
  ];
  conc.more = conc.items.length < list.length;
  flushSync();
  fillTexts(slice);
}

// the text of each verse: loads the chapter (once) and marks the words linked to the lemma
async function fillTexts(slice: Occurrence[]) {
  const byChapter: Record<string, Occurrence[]> = {};
  for (const x of slice) {
    const bk = BOOKS[x.b];
    if (bk) (byChapter[`${bk.code}.${x.c}`] ||= []).push(x);
  }
  for (const [k, xs] of Object.entries(byChapter)) {
    const [code, c] = k.split(".");
    const raw = (await bible.fetchChapter(code, +c).catch(() => null)) as { v: { n: number; b?: string; a?: number[][] }[] } | null;
    const html: Record<string, string> = {};
    for (const x of xs) {
      const v = raw?.v.find(y => y.n === x.v);
      html[`${code}.${c}.${x.v}.${x.i}`] = v ? markSpans(v.b || "", spansOf(v.a || [], x.i)) : "";
    }
    conc.items = conc.items.map(it => (it.key in html ? { ...it, html: html[it.key] } : it));
  }
}

export function initConcordance() {
  mount(ConcordanceSheet, {
    target: document.body,
    props: {
      onclose: () => close(),
      ongloss(i: number) {
        conc.gloss = i;
        render();
      },
      onbook(i: number) {
        conc.book = conc.book === i ? null : i;
        render();
      },
      onhere(on: boolean) {
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
      onitem(it: ConcItem) {
        close();
        openChapter(it.code, it.chapter, it.verse);
      }
    }
  });
  // the list of occurrences closes when the chapter changes
  initLinks(close);
  // Esc closes even when the focus left the sheet (for example after a filter drew the list again)
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && conc.open && !document.getElementById("concordancia")!.contains(document.activeElement)) close();
  });
  window.__concordance = (key, word) => open(key, word as { lemma?: string } | null);
  window.Study = { open, close, bucketOf };
}

// starts when imported, in the order src/reader/main.ts imports it
initConcordance();
