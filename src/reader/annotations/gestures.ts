// How Anotar opens from the text: the ⋯ button of a verse, a long press (on a word: that word; elsewhere on the
// verse: the verse), the right button on computers and selecting a snippet of the Bíblia Livre.
import type { Anchor } from "../../lib/annotations/verse";
import { annotate } from "../../state/annotate.svelte";
import { A } from "./context";
import { openVerseNotes } from "./note";
import { openForVerse, selection } from "./panel";

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
  // selecting text of the Bíblia Livre opens the panel once the selection stops; moving the handles updates it
  let selTimer: ReturnType<typeof setTimeout> | undefined;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !sel.anchorNode) return;
      const node = sel.anchorNode;
      const sec = verseOf(node.nodeType === 1 ? node : node.parentElement);
      const s = sec && blivreAnchor(sec);
      if (!sec || !s) return;
      const a = selection?.ancora;
      if (annotate.open && a?.camada === "blivre" && a.ver === +sec.id.slice(1) && a.inicio === s.inicio && a.fim === s.fim) return;
      openForVerse(sec, "blivre", s);
    }, 500);
  });
}
