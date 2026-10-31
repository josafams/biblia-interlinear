// The chapter on screen: loading it, the title block, the text, "Sobre o livro", the questions, the chapter
// lexicon and "Próximo capítulo", and where the reading is (the verse at the top, kept in the address).
import { flushSync, mount } from "svelte";
import AboutBook from "../components/AboutBook.svelte";
import ChapterHeading from "../components/ChapterHeading.svelte";
import ChapterLexicon from "../components/ChapterLexicon.svelte";
import ChapterText from "../components/ChapterText.svelte";
import HeaderChips from "../components/HeaderChips.svelte";
import NextChapter from "../components/NextChapter.svelte";
import Questions from "../components/Questions.svelte";
import SectionMap from "../components/SectionMap.svelte";
import TocVerses from "../components/TocVerses.svelte";
import { t } from "../i18n";
import type { ReviewMark } from "../lib/chapter/view";
import { toWord } from "../lib/data/bible";
import { store } from "../lib/store";
import { LAZY_FROM, chapter as chapterState, showChapter } from "../state/chapter.svelte";
import { entry as entryState } from "../state/entry.svelte";
import { goto as gotoState } from "../state/goto.svelte";
import { reader as readerState, type NeighborChapter, type Question } from "../state/reader.svelte";
import { toc } from "../state/toc.svelte";
import { BY_CODE, R, bible, book, chapter, neighbor, olang, prefs, reducedMotion, toast, versesEl, type ReaderChapter } from "./context";
import { closeDetail, openEntry } from "./entry";
import { closePanel, openPanel } from "./panels";
import { eyebrowText } from "./reading-modes";
import { stopSpeech } from "./speech";
import { pickBook, renderTocVerses } from "./toc";
import { focusWord, wordEl } from "./words";

let io: IntersectionObserver | null = null;

function renderHeader() {
  const B = book();
  document.title = `${B.name} ${R.cur} · ${t("app.name")}`;
  readerState.greek = R.greek;
  readerState.eyebrow = eyebrowText();
  readerState.heading = {
    book: B.name,
    chapter: R.cur,
    titleOrig: B.about?.title_orig || "",
    theme: B.chapters[R.cur - 1]?.t || "",
    hasAbout: !!B.about
  };
  document.body.classList.toggle("grc", R.greek);
  versesEl().setAttribute("aria-label", t("reader.text_of", { ref: `${B.name} ${R.cur}` }));
  // the "Bíblia" mode opens the chapter with its number large (the CSS counter "cap")
  versesEl().style.counterReset = `cap ${R.cur}`;
  // the ‹ › of the bars (ChapterNavButton) and the shortcuts of the header (HeaderChips) read readerState
  toc.here = { book: B.code, chapter: R.cur };
  for (const dir of [-1, 1] as const) {
    const x = neighbor(dir);
    const next: NeighborChapter | null = x
      ? {
          code: x.b.code,
          name: x.b.name,
          abbrev: x.b.abbrev,
          n: x.n,
          theme: x.b.chapters[x.n - 1].t || "",
          available: bible.hasChapter(x.b.code, x.n)
        }
      : null;
    readerState[dir < 0 ? "prev" : "next"] = next;
  }
  flushSync();
}

/** Draws the text again (a new chapter, or cantillation switched on or off). */
export function renderVerses() {
  const CH = chapter();
  const lazy = CH.verses.length >= LAZY_FROM && "IntersectionObserver" in window;
  showChapter(CH.verses, { lex: bible.lex, greek: R.greek, cantillation: prefs.cant, chapter: R.cur }, olang(), lazy);
  readerState.greek = R.greek;
  readerState.sections = CH.verses.filter(v => v.h).map(v => ({ n: v.n, h: v.h! }));
  readerState.verseCount = CH.verses.length;
  readerState.lastVerse = CH.verses[CH.verses.length - 1]?.n || 0;
  readerState.questions = CH.questions.map(q => ({ ...q, lemma: (q.strong && (bible.lex[q.strong]?.l as string)) || undefined }));
  flushSync();
  if (io) document.querySelectorAll(".verse").forEach(sec => io!.observe(sec));
  // the annotations paint their highlights when the chapter changes
  const B = book();
  window.__currentChapter = {
    book: B.code,
    chapter: R.cur,
    bookName: B.name,
    bookAbbrev: B.abbrev,
    verses: CH.verses.map(v => ({ n: v.n, blivre: v.blivre, words: v.words.map(w => ({ heb: w.heb })) }))
  };
  document.dispatchEvent(new CustomEvent("chapter-rendered", { detail: window.__currentChapter }));
}

type RawChapter = {
  v: { n: number; b: string; o?: string; h?: string; a?: number[][]; w: Parameters<typeof toWord>[0][] }[];
  m?: ReviewMark[];
  q?: [Question["kind"], string, string?, string?][];
};

export async function openChapter(code: string, n: number, v: number | null) {
  const B = BY_CODE[code];
  if (!B || !B.chapters[n - 1]) return;
  closePanel(false);
  if (entryState.open) closeDetail();
  stopSpeech();
  let raw: RawChapter | null;
  try {
    raw = (await bible.fetchChapter(code, n)) as RawChapter | null;
  } catch {
    return toast(t("reader.load_failed"));
  }
  if (!raw) return toast(t("reader.not_in_preview"));
  try {
    await bible.ensureLex(B.nt ? "G" : "H");
  } catch {
    toast(t("reader.lexicon_failed"));
  }
  const bookChanged = B !== R.book;
  R.book = B;
  R.cur = n;
  R.greek = !!B.nt;
  const CH: ReaderChapter = {
    verses: raw.v.map(x => ({
      n: x.n,
      blivre: x.b,
      nota: x.o,
      h: x.h || null,
      links: x.a || [],
      words: x.w.map(toWord),
      marks: (raw.m || []).filter(m => m[0] === x.n)
    })),
    // in another language the chapter's questions come from its layer (src/lib/data/bible.ts: withLayer)
    questions: (raw.q || []).map(([kind, text, verses, strong]) => ({ kind, text, verses, strong }))
  };
  R.ch = CH;
  renderHeader();
  if (bookChanged) renderAbout();
  renderVerses();
  renderTocVerses();
  document.getElementById("toc-lexn")!.textContent = t("lexicon.toc_count", { count: chapterState.lexicon.length });
  const target = v !== null && v !== undefined && CH.verses.some(x => x.n === v) ? v : null;
  if (target !== null) scrollToVerse(target, false);
  else {
    window.scrollTo(0, 0);
    setHere(CH.verses[0].n);
  }
}

export function scrollToVerse(n: number, smooth: boolean) {
  const target = document.getElementById("v" + n);
  if (!target) return;
  target.scrollIntoView({ behavior: smooth && !reducedMotion() ? "smooth" : "auto" });
  focusWord(wordEl(+target.dataset.vi!, 0), true);
  setHere(n);
}

/** The verse at the top of the screen: in the bar, in the address and saved for the next visit. */
function setHere(v: number) {
  const B = book();
  R.hereV = v;
  readerState.here = { book: B.name, chapter: R.cur, verse: v, theme: B.chapters[R.cur - 1].t || "" };
  flushSync();
  gotoState.here = v;
  try {
    history.replaceState(null, "", `#${B.code}.${R.cur}.${v}`);
  } catch {
    /* file:// in some browsers */
  }
  store.set("posicao", `${B.code}.${R.cur}.${v}`);
}

export function goNeighbor(dir: -1 | 1) {
  const x = neighbor(dir);
  if (x) openChapter(x.b.code, x.n, null);
}
export function hereIndex() {
  const i = R.ch ? R.ch.verses.findIndex(v => v.n === R.hereV) : -1;
  return i < 0 ? 0 : i;
}

// the header shortcuts (Léxico, Perguntas) scroll to the section without changing the address
function goLocal(selector: string) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  const h = target.querySelector("h2");
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}

function toggleAbout() {
  readerState.aboutOpen = !readerState.aboutOpen;
  store.set("sobre-aberto", readerState.aboutOpen ? "on" : "off");
  flushSync();
  if (readerState.aboutOpen) document.getElementById("sobre")!.scrollIntoView({ block: "nearest" });
}
function renderAbout() {
  const B = book();
  readerState.about = { book: B.name, chapters: B.chapters.length, greek: R.greek, data: B.about || null };
}

/** The verse number in the Bíblia mode opens the other layers of that verse. */
function openVerse(sec: HTMLElement | null) {
  if (!sec || !document.body.classList.contains("hide-orig")) return;
  sec.classList.toggle("abrir");
}

export function initChapter() {
  const root = versesEl();
  const header = document.querySelector<HTMLElement>("#page > header")!;
  const page = document.getElementById("page")!;
  mount(ChapterText, { target: root });
  // the section map of chapters with section titles (Psalm 119), above the text
  mount(SectionMap, { target: root.parentElement!, anchor: root });
  mount(TocVerses, { target: document.querySelector('#toc nav[aria-labelledby="toc-vh"]')! });
  mount(HeaderChips, { target: header, anchor: document.getElementById("ch-say")!, props: { onabout: toggleAbout, ongo: goLocal } });
  mount(ChapterHeading, { target: header, anchor: header.querySelector(".kbd")! });
  // Perguntas ao texto (data/questions): questions without answers, to think or talk about; before the lexicon
  mount(Questions, {
    target: page,
    anchor: document.getElementById("lexico")!,
    props: {
      ongoverse: (v: number) => scrollToVerse(v, true),
      onword: (strong: string, button: HTMLElement) => openEntry(strong, button),
      onnote(q: Question) {
        if (!window.Annotations?.noteForQuestion) return;
        const first = +(q.verses || "").split("-")[0] || chapter().verses[0]?.n || 1;
        window.Annotations.noteForQuestion(book().code, R.cur, first, q.text);
      }
    }
  });
  // "Próximo capítulo" after the chapter lexicon
  mount(NextChapter, {
    target: page,
    anchor: document.getElementById("lexico")!.nextSibling!,
    props: { ongo: (c: NeighborChapter) => (c.available ? openChapter(c.code, c.n, null) : toast(t("reader.not_in_preview"))) }
  });
  // "Sobre o livro", right under the chapter header; a chapter reference opens the index on that chapter
  readerState.aboutOpen = store.get("sobre-aberto", "off") === "on";
  mount(AboutBook, {
    target: page,
    anchor: header.nextSibling!,
    props: {
      onchapter(ch: number) {
        openPanel("toc");
        pickBook(book().code, ch);
        const chip = document.querySelector<HTMLElement>(`.chchip[data-ch="${ch}"]`);
        if (chip) {
          chip.focus({ preventScroll: true });
          chip.scrollIntoView({ block: "center" });
        }
      }
    }
  });
  // "Léxico do capítulo" (inside section#lexico)
  mount(ChapterLexicon, {
    target: document.getElementById("lexico")!,
    props: { onopen: (key: string, row: HTMLElement) => openEntry(key, row) }
  });
  root.addEventListener("click", e => {
    const n = (e.target as HTMLElement).closest(".vnum");
    if (n) openVerse(n.closest<HTMLElement>(".verse"));
  });
  // the verse at the top of the screen
  if ("IntersectionObserver" in window) {
    const visible = new Set<number>();
    io = new IntersectionObserver(
      entries => {
        entries.forEach(en => {
          const n = +en.target.id.slice(1);
          if (en.isIntersecting) visible.add(n);
          else visible.delete(n);
        });
        if (visible.size) setHere(Math.min(...visible));
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );
  }
  // very long chapters (Psalm 119): the browser draws only the verses near the screen
  document.addEventListener("chapter-rendered", () => document.body.classList.toggle("cap-longo", !!R.ch && R.ch.verses.length >= 100));
}

const REF = /^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?$/;
/** The first chapter: the address (#JHN.3.16), the last place read or the first chapter there is. */
export function start() {
  const parse = (s: string): [string, number, number | null] | null => {
    const m = REF.exec(s || "");
    return m && BY_CODE[m[1]] && bible.hasChapter(m[1], +m[2]) ? [m[1], +m[2], m[3] !== undefined ? +m[3] : null] : null;
  };
  const first = Object.keys(bible.chapters)[0] ? Object.keys(bible.chapters)[0].split(".") : ["GEN", "1"];
  const pos = parse(decodeURIComponent(location.hash.slice(1))) || parse(store.get("posicao", "")) || [first[0], +first[1], null];
  pickBook(pos[0], pos[1]);
  openChapter(pos[0], pos[1], pos[2]);
  window.addEventListener("hashchange", () => {
    const m = REF.exec(decodeURIComponent(location.hash.slice(1)));
    if (m && (m[1] !== R.book?.code || +m[2] !== R.cur)) openChapter(m[1], +m[2], m[3] !== undefined ? +m[3] : null);
  });
}
