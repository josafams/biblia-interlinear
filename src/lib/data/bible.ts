// Chapters and lexicon, loaded on demand from dados/cap/<BOOK>/<n>.js and dados/lex/<H|G>.js.
// The preview build (complete: false) has only the chapters inlined in DATA.
// In a locale with its own running text (English: the Berean Standard Bible), dados/<locale>/cap/<BOOK>/<n>.js is a
// layer over the chapter: its text, notes and section titles take the place of the Bíblia Livre ones.
import type { BibleData, Chapter, LexEntry, RawWord, Verse, Word } from "../types";
import { jsonpChannel } from "./jsonp";

/** A chapter's running text in another language: [verse, text, note?, section title?] per verse. */
export type TextLayer = { v: [number, string, (string | null)?, string?][] };

/**
 * The chapter with the layer's text, note and section title in each verse. The links to the Bíblia Livre ("a")
 * go, since they point into its text.
 */
export function withLayer(ch: Chapter, layer: TextLayer): Chapter {
  const by = new Map(layer.v.map(x => [x[0], x]));
  const v = ch.v.map(verse => {
    const [, b = "", o, h] = by.get(verse.n) ?? [];
    const out: Verse = { ...verse, b };
    delete out.a;
    delete out.o;
    delete out.h;
    if (o) out.o = o;
    if (h) out.h = h;
    return out;
  });
  return { ...ch, v };
}

/** layer: the locale whose running text replaces the Bíblia Livre (null keeps the Bíblia Livre). */
export function createBible(data: BibleData, layer: string | null = null) {
  // as loaded (dados/cap) and as shown (with the layer); without a layer they are the same object
  const raw: Record<string, Chapter> = { ...(data.chapters || {}) };
  const chapters: Record<string, Chapter> = layer ? {} : raw;
  const lex: Record<string, LexEntry> = { ...(data.lex || {}) };
  const loadChapter = jsonpChannel<Chapter>("__cap", (key, d) => {
    raw[key] = d;
  });
  const loadLayer = jsonpChannel<TextLayer>("__txt", () => {});
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
      if (!layer) return loadChapter(key, `dados/cap/${code}/${n}.js`);
      const [ch, text] = await Promise.all([
        raw[key] ?? loadChapter(key, `dados/cap/${code}/${n}.js`),
        loadLayer(`${layer}.${key}`, `dados/${layer}/cap/${code}/${n}.js`)
      ]);
      return (chapters[key] = withLayer(ch, text));
    }
  };
}

/** A word of a chapter file ([text, strong, gloss, ...]) as an object. */
export function toWord(w: RawWord): Word {
  const [text, strong, gloss, gf, morph, lemma, ketiv] = w;
  return { heb: text.replace(/\//g, ""), parts: text.split("/"), strong, gloss, gf, morph, lemma, ketiv };
}
