// Word ↔ Bíblia Livre: opening a word lights the words of the Bíblia Livre that translate it (CSS Highlight
// "ligada"); tapping a word of the Bíblia Livre lights the cards of the original it translates.
// Each verse has "links": [word, start, end, start, end, …] with positions in the Bíblia Livre text.
import { t } from "../i18n";
import { spansOf } from "../lib/study/concordance";
import { R, type ReaderVerse } from "./context";

const HL = typeof CSS !== "undefined" && "highlights" in CSS && typeof Highlight !== "undefined";
const BLIVRE = "#verses .blivre"; // i18n-ignore

function wordsAt(verse: ReaderVerse, offset: number) {
  return (verse.links || []).filter(r => {
    for (let k = 1; k + 1 < r.length; k += 2) if (offset >= r[k] && offset < r[k + 1]) return true;
    return false;
  });
}

type TextNode = { n: Text; start: number };
// the text nodes of the Bíblia Livre (without the "BLIVRE" label), with the position of each one in the verse text
function textNodes(bl: Element) {
  const out: TextNode[] = [];
  const walk = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement!.closest(".tag") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
  });
  let pos = 0;
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    out.push({ n, start: pos });
    pos += n.data.length;
  }
  return out;
}
function rangeOf(nodes: TextNode[], s: number, e: number) {
  const at = (off: number): [Text, number] | null => {
    for (const x of nodes) if (off <= x.start + x.n.data.length) return [x.n, Math.max(0, off - x.start)];
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

let linkedCards: Element[] = [];
function clearLinks() {
  if (HL) CSS.highlights.delete("ligada");
  linkedCards.forEach(c => c.classList.remove("linked"));
  linkedCards = [];
}
function showLinks(vi: number, wordIndexes: number[], alsoCards: boolean) {
  clearLinks();
  const v = R.ch?.verses[vi];
  const sec = v && document.getElementById("v" + v.n);
  if (!v || !sec) return;
  const bl = sec.querySelector(".blivre");
  const nodes = bl ? textNodes(bl) : [];
  const ranges: Range[] = [];
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

// where the tap landed, as a position in the verse text (-1 outside the text)
function offsetFromPoint(bl: Element, x: number, y: number) {
  let node: Node | null = null,
    off = 0;
  const doc = document as Document & { caretPositionFromPoint?(x: number, y: number): { offsetNode: Node; offset: number } | null };
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
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
  const found = textNodes(bl).find(x => x.n === node);
  return found ? found.start + off : -1;
}

function announce(msg: string) {
  let live = document.getElementById("study-live");
  if (!live) {
    live = document.createElement("div");
    live.id = "study-live";
    live.className = "sr";
    live.setAttribute("aria-live", "polite");
    document.body.appendChild(live);
  }
  live.textContent = msg;
}

/** onChapterChange: called when another chapter is drawn. */
export function initLinks(onChapterChange: () => void) {
  document.addEventListener("word-opened", e => {
    const w = (e as CustomEvent).detail?.word;
    if (!w) return clearLinks();
    showLinks(w.v, [w.i], false);
  });
  // another chapter (drawing the same one again, when the mode changes, does not count)
  let shown = "";
  document.addEventListener("chapter-rendered", e => {
    clearLinks();
    const d = (e as CustomEvent).detail || {};
    const k = `${d.book}.${d.chapter}`;
    if (shown && k !== shown) onChapterChange();
    shown = k;
  });
  document.addEventListener("click", e => {
    const target = e.target as HTMLElement;
    const bl = target.closest?.(BLIVRE);
    if (!bl || target.closest(".tag")) return;
    if (document.body.classList.contains("hide-orig") && !bl.closest(".verse.abrir")) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;
    const sec = bl.closest<HTMLElement>(".verse")!;
    const vi = +sec.dataset.vi!,
      v = R.ch?.verses[vi];
    if (!v || !v.links.length) return;
    const off = offsetFromPoint(bl, e.clientX, e.clientY);
    const hits = off < 0 ? [] : wordsAt(v, off);
    if (!hits.length) return clearLinks();
    showLinks(
      vi,
      hits.map(r => r[0]),
      true
    );
    const card = sec.querySelector(`.word[data-i="${hits[0][0]}"]`);
    if (card) card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    announce(t("study.linked", { count: hits.length }));
  });
}
