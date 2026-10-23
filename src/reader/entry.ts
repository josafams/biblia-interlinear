// The lexicon entry (Verbete): opened from a word of the text, the chapter lexicon or the questions.
// LexiconSheet.svelte is the panel, LexiconEntry.svelte its content (src/lib/lexicon/entry.ts works out what it
// shows); here are the word on screen, ‹ › to the next word and the way back through the references.
import { flushSync, mount } from "svelte";
import LexiconEntry from "../components/LexiconEntry.svelte";
import LexiconSheet from "../components/LexiconSheet.svelte";
import { t } from "../i18n";
import { entryView } from "../lib/lexicon/entry";
import type { Word } from "../lib/types";
import { entry as entryState } from "../state/entry.svelte";
import { side } from "../state/layout.svelte";
import { ui } from "../state/ui.svelte";
import { R, bible, book, chapter, prefs, vLabel, versesEl } from "./context";
import { closePanel } from "./panels";
import { speak, speakVerse, stopSpeech } from "./speech";
import { wordEl } from "./words";

type Shown = { k: string; word: Word | null };
let active: HTMLElement | null = null,
  navStack: Shown[] = [],
  current: Shown | null = null,
  returnTo: HTMLElement | null = null;

const detail = () => document.getElementById("detail")!;

function chapterCount(k: string) {
  return R.ch ? R.ch.verses.reduce((s, v) => s + v.words.filter(w => w.strong === k).length, 0) : 0;
}

export function renderEntry() {
  if (!current) return;
  const { k, word } = current;
  const at = word && active ? chapter().verses[+active.dataset.v!] : null;
  const position =
    at && active ? t("entry.position", { i: +active.dataset.i! + 1, n: at.words.length, ref: `${book().name} ${vLabel(at)}` }) : "";
  entryState.view = entryView(k, word, {
    lex: bible.lex,
    greek: R.greek,
    cantillation: prefs.cant,
    position,
    inChapter: chapterCount(k),
    chapterRef: `${book().name} ${R.cur}`,
    concordance: !!window.__concordance
  });
  entryState.canPrev = !!(word && stepTarget(-1));
  entryState.canNext = !!(word && stepTarget(1));
  entryState.canGoBack = navStack.length > 0;
  flushSync();
}

/** The next or previous word in reading order (into the neighbor verse). */
function stepTarget(dir: -1 | 1) {
  if (!active || !R.ch) return null;
  const CH = R.ch;
  let v = +active.dataset.v!,
    i = +active.dataset.i! + dir;
  while (v >= 0 && v < CH.verses.length) {
    const n = CH.verses[v].words.length;
    if (i >= 0 && i < n) return wordEl(v, i);
    v += dir;
    if (v < 0 || v >= CH.verses.length) return null;
    i = dir > 0 ? 0 : CH.verses[v].words.length - 1;
  }
  return null;
}

export function openWord(b: HTMLElement) {
  const w = chapter().verses[+b.dataset.v!].words[+b.dataset.i!];
  if (active) active.classList.remove("active");
  active = b;
  b.classList.add("active");
  b.parentElement!.querySelectorAll<HTMLElement>(".word").forEach(x => {
    x.tabIndex = -1;
  });
  b.tabIndex = 0;
  navStack = [];
  R.lastWord = b;
  show(w.strong, w, b);
}

/** An entry without a word of the text (chapter lexicon, questions). */
export function openEntry(k: string, opener: HTMLElement | null) {
  if (active) active.classList.remove("active");
  active = null;
  navStack = [];
  show(k, null, opener);
}

async function show(k: string, word: Word | null, opener?: HTMLElement | null) {
  if (opener) returnTo = opener;
  if (ui.sheet === "look" && side.on) closePanel(false);
  if (k && /^[HG]/.test(k))
    await bible.ensureLex(k[0] === "G" ? "G" : "H").catch(() => {
      /* the entry shows what it has */
    });
  current = { k, word };
  renderEntry();
  entryState.open = true;
  flushSync();
  document.body.classList.add("com-detail");
  if (k) document.dispatchEvent(new CustomEvent("lexicon-entry-opened", { detail: { k } }));
  document.dispatchEvent(
    new CustomEvent("word-opened", { detail: { word: word && active ? { v: +active.dataset.v!, i: +active.dataset.i! } : null } })
  );
  detail().scrollTop = 0;
  document.getElementById("d-title")!.focus({ preventScroll: true });
  keepWordVisible();
}

// On phones the entry is half a sheet: if the word ended up behind it, scroll the text so it shows above
function keepWordVisible() {
  if (!active || side.on) return;
  const r = active.getBoundingClientRect(),
    sheetTop = detail().getBoundingClientRect().top;
  const barH = document.querySelector(".bar")!.getBoundingClientRect().bottom;
  if (r.bottom > sheetTop - 12 || r.top < barH) window.scrollBy({ top: r.top - barH - 16, behavior: "auto" });
}

export function closeDetail() {
  stopSpeech();
  entryState.open = false;
  flushSync();
  document.body.classList.remove("com-detail");
  document.dispatchEvent(new CustomEvent("word-opened", { detail: { word: null } }));
  navStack = [];
  if (active) active.classList.remove("active");
  active = null;
  let back = returnTo;
  if (back && !back.isConnected && back.dataset?.v) back = wordEl(back.dataset.v, back.dataset.i!);
  returnTo = null;
  if (back && back.isConnected) back.focus({ preventScroll: false });
}

/** After the text is drawn again (cantillation on or off): the same word stays open and lit. */
export function redrawn(keep: [string, string] | null) {
  if (keep) {
    active = wordEl(...keep);
    if (active) active.classList.add("active");
  }
  if (entryState.open && current) renderEntry();
}
export const activeWord = (): [string, string] | null => (active ? [active.dataset.v!, active.dataset.i!] : null);

export function initEntry() {
  mount(LexiconSheet, { target: document.body });
  versesEl().addEventListener("click", e => {
    const target = e.target as HTMLElement;
    const sb = target.closest<HTMLElement>(".say[data-verse]");
    if (sb) return speakVerse(+sb.dataset.verse!, sb);
    const b = target.closest<HTMLElement>(".word");
    if (b) openWord(b);
  });
  mount(LexiconEntry, {
    target: document.getElementById("d-body")!,
    props: {
      onclose: () => closeDetail(),
      onstep(dir: -1 | 1) {
        const to = stepTarget(dir);
        if (!to) return;
        openWord(to);
        document.getElementById(dir > 0 ? "d-next" : "d-prev")?.focus({ preventScroll: true });
      },
      onsay: (text: string, button: HTMLElement) => speak([text], button),
      onconcordance: (key: string) => window.__concordance?.(key, current?.word || null),
      onback() {
        const prev = navStack.pop()!;
        show(prev.k, prev.word);
      },
      onref(key: string) {
        if (current) navStack.push(current);
        show(key, null);
      }
    }
  });
}
