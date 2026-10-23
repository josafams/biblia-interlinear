// The chapter text on screen. Every showChapter() draws it again from scratch (a new renderId), as the
// legacy innerHTML did.
// The verse views are raw state (not deeply reactive): they never change after a render, and proxies on
// thousands of objects would slow long chapters down.
import { flushSync } from "svelte";
import { type LexiconRow, chapterLexicon } from "../lib/chapter/lexicon";
import { type ChapterVerse, type Context, type VerseView, verseView, wordViews } from "../lib/chapter/view";
import type { LexEntry } from "../lib/types";

/** Long chapters (Psalm 119) build the word cards only when the verse comes near the screen. */
export const LAZY_FROM = 100;
const EAGER = 5;

class ChapterState {
  renderId = $state(0);
  lang = $state("he");
  verses = $state.raw<VerseView[]>([]);
  /** per verse: the word cards are built */
  filled = $state.raw<boolean[]>([]);
  /** the lemmas of the chapter ("Léxico do capítulo") and the lexicon they come from */
  lexicon = $state.raw<LexiconRow[]>([]);
  lex = $state.raw<Record<string, LexEntry>>({});
}
export const chapter = new ChapterState();

let source: ChapterVerse[] = [];
let context: Context = { lex: {}, greek: false, cantillation: true, chapter: 0 };

export function showChapter(verses: ChapterVerse[], c: Context, lang: string, lazy: boolean) {
  source = verses;
  context = c;
  chapter.lang = lang;
  chapter.verses = verses.map((v, vi) => verseView(v, vi, c));
  chapter.filled = verses.map((_, vi) => !lazy || vi < EAGER);
  chapter.lexicon = chapterLexicon(verses, c.lex);
  chapter.lex = c.lex;
  chapter.renderId++;
  flushSync();
}

/** The word cards of a verse (computed when drawn, with the lexicon loaded by then). */
export const wordsOf = (vi: number) => wordViews(source[vi], context);

/** Builds the cards of verse vi now (keyboard navigation, reading aloud). */
export function fillVerse(vi: number) {
  if (chapter.filled[vi] !== false) return;
  const filled = [...chapter.filled];
  filled[vi] = true;
  chapter.filled = filled;
  flushSync();
}

// one observer for the lazy verses of the chapter on screen
let observer: IntersectionObserver | null = null;
// not reactive on purpose: only the observer reads it
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const waiting = new Map<Element, number>();
export function fillWhenNear(el: Element, vi: number) {
  observer ??= new IntersectionObserver(
    entries => {
      for (const e of entries)
        if (e.isIntersecting && waiting.has(e.target)) {
          const k = waiting.get(e.target)!;
          observer!.unobserve(e.target);
          waiting.delete(e.target);
          fillVerse(k);
        }
    },
    { rootMargin: "1500px 0px" }
  );
  waiting.set(el, vi);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    waiting.delete(el);
  };
}
