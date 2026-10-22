// Chapters and lexicon, loaded on demand from dados/cap/<BOOK>/<n>.js and dados/lex/<H|G>.js.
// The preview build (complete: false) has only the chapters inlined in DATA.
import type { BibleData, Chapter, LexEntry, RawWord, Word } from "../types";
import { jsonpChannel } from "./jsonp";

export function createBible(data: BibleData) {
  const chapters: Record<string, Chapter> = { ...(data.chapters || {}) };
  const lex: Record<string, LexEntry> = { ...(data.lex || {}) };
  const loadChapter = jsonpChannel<Chapter>("__cap", (key, d) => {
    chapters[key] = d;
  });
  const loadLex = jsonpChannel<Record<string, LexEntry>>("__lex", (_, d) => {
    Object.assign(lex, d);
  });
  const lexLoading: Record<string, Promise<unknown> | null> = {};

  return {
    chapters,
    lex,
    /** Loads the Hebrew ("H") or Greek ("G") lexicon once; a failed load is retried next time. */
    ensureLex(lang: "H" | "G") {
      if (!data.complete) return Promise.resolve();
      lexLoading[lang] ??= loadLex(lang, `dados/lex/${lang}.js`).catch(e => {
        lexLoading[lang] = null;
        throw e;
      });
      return lexLoading[lang];
    },
    hasChapter: (code: string, n: number) => !!data.complete || !!chapters[`${code}.${n}`],
    async fetchChapter(code: string, n: number): Promise<Chapter | null> {
      const key = `${code}.${n}`;
      if (chapters[key]) return chapters[key];
      if (!data.complete) return null;
      return loadChapter(key, `dados/cap/${code}/${n}.js`);
    }
  };
}

/** A word of a chapter file ([text, strong, gloss, ...]) as an object. */
export function toWord(w: RawWord): Word {
  const [text, strong, gloss, gf, morph, lemma, ketiv] = w;
  return { heb: text.replace(/\//g, ""), parts: text.split("/"), strong, gloss, gf, morph, lemma, ketiv };
}
