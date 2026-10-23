// What the chapter text shows, worked out from the chapter data: one view per verse and per word card.
// The Svelte components (ChapterText, Verse) draw these views; the word cards are an HTML string (wordCardsHTML).
import { t, tryT } from "../../i18n";
import { decodeMorph, shortMorph } from "../morph";
import { cleanHeb, esc, glossHTML, glossSpoken } from "../text";
import type { LexEntry, Word } from "../types";

/** A review mark of the automatic review: [verse, word index or null, ?, code, message]. */
export type ReviewMark = [number, number | null, unknown, string, string];
export type ChapterVerse = { n: number; blivre: string; nota?: string | null; h?: string | null; words: Word[]; marks: ReviewMark[] };

export type WordView = {
  i: number;
  flag: boolean;
  ketiv: boolean;
  aria: string;
  /** the morphemes; the longest is the core, the others ("pre") are prefixes and suffixes */
  parts: { text: string; pre: boolean }[];
  xlit: string;
  pron: string;
  strong: string;
  morphFull: string;
  morphShort: string;
  glossHtml: string;
  aux: boolean;
};
export type VerseView = {
  vi: number;
  n: number;
  /** "3:16", or "título" for verse 0 */
  label: string;
  section: { title: string; range: string } | null;
  hasMarks: boolean;
  wordsLabel: string;
  wordCount: number;
  note: string;
  blivre: string;
  marks: { word: string | null; text: string; code: string }[];
};
export type Context = { lex: Record<string, LexEntry>; greek: boolean; cantillation: boolean; chapter: number };

const shown = (s: string, c: Context) => (c.greek || c.cantillation ? s : cleanHeb(s));
const hasStrong = (s: string) => !!s && !s.startsWith("G:");

export const verseLabel = (n: number, chapter: number) => (n === 0 ? t("verse.title_ref") : `${chapter}:${n}`);

/** What a screen reader says for a word: gloss, transliteration and pronunciation, Strong, how the gloss was made. */
export function wordAria(w: Word, lex: Record<string, LexEntry>) {
  const e = lex[w.strong] as (LexEntry & { p?: string }) | undefined;
  const bits = [glossSpoken(w.gloss)];
  if (e && e.x) bits.push(t("word.pronunciation", { xlit: e.x, pron: e.p || "" }));
  bits.push(hasStrong(w.strong) ? t("word.strong", { strong: w.strong }) : t("word.no_strong"));
  const source = w.gf && w.gf !== "m" ? tryT(`word.gloss_source.${w.gf}`) : undefined;
  if (source) bits.push(source);
  return bits.join(". ");
}

export function wordViews(v: ChapterVerse, c: Context): WordView[] {
  const flagged = new Set(v.marks.filter(m => m[1] !== null).map(m => m[1]));
  return v.words.map((w, i) => {
    const e = (c.lex[w.strong] || {}) as LexEntry & { p?: string };
    const parts = w.parts.map(p => shown(p, c));
    let core = 0;
    parts.forEach((p, k) => {
      if (p.length > parts[core].length) core = k;
    });
    const morphFull = decodeMorph(w.morph, c.greek);
    return {
      i,
      flag: flagged.has(i),
      ketiv: !!w.ketiv,
      aria: wordAria(w, c.lex),
      parts: parts.length < 2 ? [{ text: parts[0], pre: false }] : parts.map((text, k) => ({ text, pre: k !== core })),
      xlit: e.x || "",
      pron: e.p || "",
      strong: hasStrong(w.strong) ? w.strong : "—",
      morphFull,
      morphShort: shortMorph(morphFull),
      glossHtml: glossHTML(w.gloss),
      aux: !!w.gf && w.gf !== "m"
    };
  });
}

export function verseView(v: ChapterVerse, vi: number, c: Context): VerseView {
  const label = verseLabel(v.n, c.chapter);
  return {
    vi,
    n: v.n,
    label,
    section: v.h ? { title: v.h, range: t("verse.section_range", { from: v.n, to: v.n + 7 }) } : null,
    hasMarks: v.marks.length > 0,
    wordsLabel: t(c.greek ? "verse.words_label" : "verse.words_label_rtl", { ref: label }),
    wordCount: v.words.length,
    note: v.nota ? tryT(`verse.source_note.${v.nota}`) || v.nota : "",
    blivre: v.blivre,
    marks: v.marks.map(m => ({
      word: m[1] !== null && v.words[m[1]] ? shown(v.words[m[1]].heb, c) : null,
      text: m[4],
      code: m[3]
    }))
  };
}

/**
 * The word cards of a verse as HTML (every text escaped). A chapter has hundreds of cards that never change
 * once drawn, so they are inserted at once instead of as one component each (several times faster).
 * Clicks and arrow keys are handled for the whole text by src/reader/words.ts and entry.ts (data-v, data-i).
 */
export function wordCardsHTML(words: WordView[], vi: number, lang: string) {
  return words
    .map(w => {
      const h = w.parts.map(p => (p.pre ? `<span class="pre">${esc(p.text)}</span>` : esc(p.text))).join("");
      const cls = `word${w.flag ? " flag" : ""}${w.ketiv ? " kt" : ""}`;
      // the whitespace between the parts is that of the legacy markup: in the Original mode the words run as text
      return [
        ` <button class="${cls}" data-v="${vi}" data-i="${w.i}" tabindex="${w.i === 0 ? 0 : -1}" aria-label="${esc(w.aria)}">`,
        `<span class="h" lang="${lang}" aria-hidden="true">${h}</span>`,
        w.xlit ? `<span class="x" aria-hidden="true">${esc(w.xlit)}</span>` : "",
        w.pron ? `<span class="p" aria-hidden="true">${esc(w.pron)}</span>` : "",
        `<span class="s" aria-hidden="true">${esc(w.strong)}</span>`,
        `<span class="m" aria-hidden="true" title="${esc(w.morphFull)}">${esc(w.morphShort)}</span>`,
        `<span class="g${w.aux ? " aux" : ""}" aria-hidden="true">${w.glossHtml}</span>`,
        "</button>"
      ].join(" ");
    })
    .join("");
}
