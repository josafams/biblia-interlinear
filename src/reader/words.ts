// The word cards of the text: finding them (long chapters build them when needed), focus and the arrow keys.
import { fillVerse } from "../state/chapter.svelte";
import { R, chapter, versesEl } from "./context";

export function wordEl(vi: number | string, i: number | string) {
  fillVerse(+vi);
  return versesEl().querySelector<HTMLElement>(`.word[data-v="${vi}"][data-i="${i}"]`);
}

export function firstWordOfVerse(vi: number) {
  for (let k = vi; k < chapter().verses.length; k++) {
    const el = wordEl(k, 0);
    if (el) return el;
  }
  return null;
}

/** Only one word of a verse is in the tab order: the one with the focus. */
export function focusWord(el: HTMLElement | null, noScroll = false) {
  if (!el) return;
  el.parentElement!.querySelectorAll<HTMLElement>(".word").forEach(b => {
    b.tabIndex = -1;
  });
  el.tabIndex = 0;
  el.focus({ preventScroll: noScroll });
}

/** ← → word by word in reading order (Hebrew right to left), ↑ ↓ verse by verse, Home and End. */
export function initWordKeys() {
  versesEl().addEventListener("keydown", e => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".word");
    if (!b) return;
    const CH = chapter();
    const v = +b.dataset.v!,
      i = +b.dataset.i!,
      last = CH.verses[v].words.length - 1;
    const firstOf = (n: number) => (n >= 0 && n < CH.verses.length ? wordEl(n, 0) : null);
    const lastOf = (n: number) => (n >= 0 && n < CH.verses.length ? wordEl(n, CH.verses[n].words.length - 1) : null);
    const fwd = R.greek ? "ArrowRight" : "ArrowLeft",
      back = R.greek ? "ArrowLeft" : "ArrowRight";
    let to: HTMLElement | null = null;
    switch (e.key) {
      case fwd:
        to = i < last ? wordEl(v, i + 1) : firstOf(v + 1);
        break;
      case back:
        to = i > 0 ? wordEl(v, i - 1) : lastOf(v - 1);
        break;
      case "ArrowDown":
        to = firstOf(v + 1);
        break;
      case "ArrowUp":
        to = firstOf(v - 1);
        break;
      case "Home":
        to = wordEl(v, 0);
        break;
      case "End":
        to = wordEl(v, last);
        break;
      default:
        return;
    }
    e.preventDefault();
    if (to) {
      focusWord(to);
      to.scrollIntoView({ block: "nearest" });
    }
  });
}
