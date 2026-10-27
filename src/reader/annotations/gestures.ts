// How Anotar opens from the text: the ⋯ button of a verse, a long press (on a word: that word; elsewhere on the
// verse: the verse), the right button on computers and selecting a snippet of the Bíblia Livre.
import type { Anchor } from "../../lib/annotations/verse";
import { annotate } from "../../state/annotate.svelte";
import { A } from "./context";
import { openVerseNotes } from "./note";
import { openForVerse, openForVerses } from "./panel";

const LONG_PRESS_MS = 550;
const VERSE = "#verses .verse", // i18n-ignore
  WORD = "#verses .word"; // i18n-ignore
const verseOf = (el: EventTarget | null) => (el as HTMLElement | null)?.closest?.<HTMLElement>(VERSE) || null;
const selectedText = () => window.getSelection()?.toString() || "";

/** The snippet of the Bíblia Livre selected in this verse, as characters of its text. */
function blivreAnchor(sec: HTMLElement): Partial<Anchor> | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const bl = sec.querySelector(".blivre");
  const r = sel.getRangeAt(0);
  if (!bl || !bl.contains(r.startContainer) || !bl.contains(r.endContainer)) return null;
  const tag = bl.querySelector(".tag");
  const pre = document.createRange();
  pre.selectNodeContents(bl);
  pre.setEnd(r.startContainer, r.startOffset);
  const off = tag ? tag.textContent!.length : 0;
  const start = pre.toString().length - off,
    trecho = r.toString();
  if (start < 0 || !trecho.trim()) return null;
  return { inicio: start, fim: start + trecho.length, trecho };
}

// where a point of a range falls in the Bíblia Livre text of a verse (without its "BLIVRE" label)
function offsetIn(bl: Element, node: Node, offset: number) {
  const pre = document.createRange();
  pre.selectNodeContents(bl);
  pre.setEnd(node, offset);
  return pre.toString().length - (bl.querySelector(".tag")?.textContent?.length || 0);
}

/** The selected Bíblia Livre, one snippet per verse: a selection may cross verses (the end of one, the start of
 * the next, whole verses between them). */
function blivreParts() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return [];
  const r = sel.getRangeAt(0);
  const out: { sec: HTMLElement; extra: Partial<Anchor> }[] = [];
  for (const bl of document.querySelectorAll(VERSE + " .blivre")) {
    if (!r.intersectsNode(bl)) continue;
    const text = (bl.textContent || "").slice(bl.querySelector(".tag")?.textContent?.length || 0);
    const i = bl.contains(r.startContainer) ? Math.max(0, offsetIn(bl, r.startContainer, r.startOffset)) : 0;
    const f = bl.contains(r.endContainer) ? Math.max(0, offsetIn(bl, r.endContainer, r.endOffset)) : text.length;
    const trecho = text.slice(i, f);
    if (trecho.trim()) out.push({ sec: bl.closest<HTMLElement>(".verse")!, extra: { inicio: i, fim: f, trecho } });
  }
  return out;
}

function openForWord(w: HTMLElement) {
  const i = +w.dataset.i!;
  const v = A.chapter?.verses[+w.dataset.v!];
  openForVerse(w.closest<HTMLElement>(".verse")!, "original", { inicio: i, fim: i, trecho: v?.words[i]?.heb || "" });
}

export function initGestures() {
  document.addEventListener("click", e => {
    const target = e.target as HTMLElement;
    // the verse number opens Anotar (in the modes without the original it opens that verse's layers: chapter.ts)
    const num = target.closest<HTMLElement>(VERSE + " .vnum");
    if (num && !document.body.classList.contains("hide-orig")) return openForVerse(num.closest<HTMLElement>(".verse")!, "versiculo", {});
    const b = target.closest(".vmark");
    if (b) {
      const sec = b.closest<HTMLElement>(".verse")!;
      const s = blivreAnchor(sec);
      return openForVerse(sec, s ? "blivre" : "versiculo", s || {});
    }
    const n = target.closest<HTMLElement>(".vnota, .vann-note");
    if (n) return openVerseNotes(+n.dataset.ver!);
  });

  // long press on a card of the original: the word; on the verse: the verse
  let timer: ReturnType<typeof setTimeout> | undefined,
    targetEl: HTMLElement | null = null,
    longPress = false;
  document.addEventListener(
    "pointerdown",
    e => {
      const sec = verseOf(e.target);
      const target = e.target as HTMLElement;
      // on the Bíblia Livre a long press selects text, as anywhere else on the phone: Anotar opens once it stops
      if (!sec || e.button > 0 || target.closest(".say, .vmark, .vnota, details, .blivre")) return;
      targetEl = target.closest<HTMLElement>(".word") || sec;
      longPress = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        longPress = true;
        if (targetEl!.classList.contains("word")) openForWord(targetEl!);
        else if (!selectedText()) openForVerse(sec, "versiculo", {});
      }, LONG_PRESS_MS);
    },
    true
  );
  for (const ev of ["pointerup", "pointercancel", "pointermove"] as const)
    document.addEventListener(
      ev,
      e => {
        if (ev === "pointermove" && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
        clearTimeout(timer);
      },
      true
    );
  // the click that ends a long press does not open the entry
  document.addEventListener(
    "click",
    e => {
      if (longPress && (e.target as HTMLElement).closest(WORD)) {
        e.stopPropagation();
        e.preventDefault();
        longPress = false;
      }
    },
    true
  );
  // on phones the long press becomes "contextmenu" (and the browser cancels the pointer); on computers, the right button
  document.addEventListener("contextmenu", e => {
    const sec = verseOf(e.target);
    if (!sec) return;
    clearTimeout(timer);
    const s = blivreAnchor(sec);
    if (s) {
      e.preventDefault();
      return openForVerse(sec, "blivre", s);
    }
    // the long press that starts a selection: cancelling it would also cancel the selection (Android)
    if ((e.target as HTMLElement).closest(".blivre")) return;
    const w = (e.target as HTMLElement).closest<HTMLElement>(".word");
    if (w) {
      e.preventDefault();
      longPress = true;
      return openForWord(w);
    }
    if (!(e.target as HTMLElement).closest("a, input, textarea") && !selectedText()) {
      e.preventDefault();
      openForVerse(sec, "versiculo", {});
    }
  });
  // selecting text of the Bíblia Livre (in one verse or across several) opens the panel once the selection stops;
  // moving the handles updates it
  let selTimer: ReturnType<typeof setTimeout> | undefined,
    shown = "";
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const parts = blivreParts();
      if (!parts.length) return;
      const key = parts.map(p => `${p.sec.id}:${p.extra.inicio}-${p.extra.fim}`).join(",");
      if (annotate.open && key === shown) return;
      shown = key;
      if (parts.length === 1) openForVerse(parts[0].sec, "blivre", parts[0].extra);
      else openForVerses(parts);
    }, 500);
  });
}
