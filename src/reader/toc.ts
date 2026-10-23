// The index (#toc): the tabs Livros · Notas · Você, the list of books and the chapter grid, "Ir para" and the
// verses and parts of the chapter on screen ("Neste livro").
import { flushSync, mount } from "svelte";
import BookList from "../components/BookList.svelte";
import ChapterPicker from "../components/ChapterPicker.svelte";
import GoTo from "../components/GoTo.svelte";
import TocTabs from "../components/TocTabs.svelte";
import YouSection from "../components/YouSection.svelte";
import { t } from "../i18n";
import { bookQuery } from "../lib/books";
import { gotoPreview } from "../lib/goto";
import { SITE_URL, isNative } from "../lib/native";
import { type ResolvedRef, createRefs } from "../lib/refs";
import { goto as gotoState } from "../state/goto.svelte";
import { toc } from "../state/toc.svelte";
import { BOOKS, BY_CODE, R, type ReaderBook, bible, book, chapter, reducedMotion, toast, vLabel } from "./context";
import { openChapter, scrollToVerse } from "./chapter";
import { ANNOTATIONS_OPEN_INDEX } from "./events";
import { closePanel, openPanel } from "./panels";

let pickedBook: ReaderBook | null = null,
  pickedCh = 1;
const tocEl = () => document.getElementById("toc")!;
const goIn = () => document.getElementById("go-in") as HTMLInputElement;

export function pickBook(code: string, ch?: number) {
  pickedBook = BY_CODE[code];
  pickedCh = ch || 1;
  toc.book = code;
  toc.chapter = pickedCh;
  flushSync();
}

/** Livros shows the list of books (on the testament of the book picked) or, after a book, its chapters. */
export function tocView(v: "livros" | "capitulos") {
  tocEl().dataset.ver = v;
  if (v === "livros") {
    toc.testament = pickedBook?.nt ? "1" : "0";
    flushSync();
  }
  tocEl().scrollTop = 0;
}
export function tocTab(tab: "livros" | "voce") {
  toc.tab = tab;
  tocEl().dataset.aba = tab;
  tocEl().scrollTop = 0;
}

/** "Livros" opens the index on the list of books (the title in the bar opens it on the chapters). */
export function openToc() {
  openPanel("toc");
  tocTab("livros");
  tocView("livros");
}
export function openWhere() {
  openPanel("toc", goIn());
  tocView("capitulos");
  requestAnimationFrame(() => document.querySelector<HTMLElement>('#chgrid .chchip[aria-pressed="true"]')?.focus({ preventScroll: true }));
}

/** The verse chips of the chapter on screen. */
export function renderTocVerses() {
  gotoState.versesOf = t("goto.verses_of", { ref: `${book().name} ${R.cur}` });
  gotoState.verses = chapter().verses.map(v => ({ n: v.n, label: vLabel(v) }));
  gotoState.here = R.hereV;
}

// "Ir para": the parser lives in src/lib/refs.ts; here it reads the chapter on screen
const refs = createRefs(BOOKS);
export const parseRef = (q: string) => refs.parseRef(q, { book: R.book, ch: R.cur });
export const resolveRef = (r: ReturnType<typeof parseRef>) => refs.resolveRef(r, bible.hasChapter);
let goTarget: Extract<ResolvedRef, { ok: true }> | null = null;
function updatePreview() {
  const res = resolveRef(parseRef(goIn().value));
  goTarget = res && "ok" in res ? res : null;
  if (res && !("warn" in res)) {
    const n = "ok" in res ? res.ch : res.na.n;
    if (pickedBook?.code !== res.book.code || pickedCh !== n) pickBook(res.book.code, n);
  }
  gotoState.preview = gotoPreview(res, bible.chapters);
  flushSync();
}
function go(target: NonNullable<typeof goTarget>) {
  openChapter(target.book.code, target.ch, target.chapterStart ? null : target.v);
  goIn().value = "";
  updatePreview();
}

/** "Neste livro": Sobre o livro, Perguntas, Léxico and the verses go to that place of the page. */
function goPlace(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest("[data-go]");
  if (!a) return;
  e.preventDefault();
  const id = a.getAttribute("href")!.slice(1);
  closePanel(false);
  const v = id.match(/^v(\d+)$/);
  if (v) return scrollToVerse(+v[1], true);
  const target = document.getElementById(id);
  if (!target) return;
  if (target.classList.contains("fontes")) target.classList.add("show");
  target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.querySelector("summary")!.focus({ preventScroll: true });
  } else {
    const h = target.querySelector("h2");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
}

export function initToc() {
  mount(BookList, {
    target: tocEl().querySelector(".toc-books")!,
    props: {
      books: BOOKS,
      onpick(code: string) {
        pickBook(code, code === book().code ? R.cur : 1);
        tocView("capitulos");
      }
    }
  });
  mount(ChapterPicker, {
    target: tocEl().querySelector(".toc-chapters")!,
    props: {
      books: BOOKS,
      available: bible.hasChapter,
      onback: () => tocView("livros"),
      onopen: (n: number) => openChapter(pickedBook!.code, n, null),
      onunavailable(n: number) {
        pickBook(pickedBook!.code, n);
        toast(t("reader.not_in_preview"));
      }
    }
  });
  // the field and its preview are GoTo.svelte; the preview is worked out by src/lib/goto.ts
  mount(GoTo, {
    target: document.getElementById("toc-livros")!,
    props: {
      oninput() {
        updatePreview();
        toc.filter = bookQuery(goIn().value);
        flushSync();
      },
      ongo() {
        if (goTarget) go(goTarget);
        else {
          updatePreview();
          goIn().focus();
        }
      }
    }
  });
  document.getElementById("toc-search")!.addEventListener("click", e => {
    e.preventDefault();
    closePanel(false);
    window.__openSearch?.();
  });
  tocEl().addEventListener("click", goPlace);
}

/** The top of the index (✕, title, tabs) and the Você part; Notas is the list of Minhas anotações. */
export function initTocTabs() {
  mount(TocTabs, {
    target: tocEl(),
    anchor: tocEl().firstChild!,
    props: {
      onpick(tab: "livros" | "notas" | "voce") {
        if (tab !== "notas") return tocTab(tab);
        closePanel(false);
        window.Annotations?.openList();
      }
    }
  });
  // the reading plans need the account (without it, a notice); with it they open the progress, where a plan starts
  const signedIn = () => window.Account && !["signed-out", "unavailable"].includes(window.Account.status());
  mount(YouSection, {
    target: tocEl(),
    props: {
      site: isNative ? SITE_URL : "",
      onprogress() {
        closePanel(false);
        window.Progress?.open();
      },
      onplan() {
        if (!signedIn()) return toast(t("you.plan_needs_account"));
        closePanel(false);
        window.Progress?.open();
      }
    }
  });
  tocTab("livros");
  tocView("livros");
  // Minhas anotações (NotesSheet.svelte) has the same tabs: they open the other parts of the index
  document.addEventListener(ANNOTATIONS_OPEN_INDEX, e => {
    openPanel("toc");
    tocTab((e as CustomEvent).detail.tab);
    tocView("livros");
  });
}
