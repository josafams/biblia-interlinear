// Chapters and lexicon, loaded on demand from dados/cap/<BOOK>/<n>.js and dados/lex/<H|G>.js.
// The preview build (complete: false) has only the chapters inlined in DATA.
// In a locale with its own running text (English: the Berean Standard Bible), dados/<locale>/cap/<BOOK>/<n>.js is a
// layer over the chapter: its text, notes and section titles take the place of the Bíblia Livre ones.
import type { BibleData, Chapter, LexEntry, RawWord, Verse, Word } from "../types";
import { jsonpChannel } from "./jsonp";

/** A chapter in another language (dados/<locale>/cap): per verse the text, note, section title, the gloss and its
 * source for each word ("g") and the links of each word to the text ("a", as in the chapter). */
export type TextLayer = {
  v: { n: number; b: string; o?: string; h?: string; g?: [string, string][]; a?: number[][] }[];
  /** the questions of the chapter in the layer's language (none while not translated) */
  q?: unknown[];
};

/**
 * The chapter in the layer's language: text, note, section title, links and the glosses of the words come from
 * the layer, and so do the questions. The marks of the automatic review stay out: they are about the Portuguese
 * glosses.
 */
export function withLayer(ch: Chapter, layer: TextLayer): Chapter {
  const by = new Map(layer.v.map(x => [x.n, x]));
  const v = ch.v.map(verse => {
    const L = by.get(verse.n);
    const out: Verse = { ...verse, b: L?.b ?? "" };
    delete out.a;
    delete out.o;
    delete out.h;
    if (L?.o) out.o = L.o;
    if (L?.h) out.h = L.h;
    if (L?.a) out.a = L.a;
    if (L?.g) out.w = verse.w.map((w, i) => (L.g![i] ? ([w[0], w[1], L.g![i][0], L.g![i][1], ...w.slice(4)] as typeof w) : w));
    return out;
  });
  return { ...ch, v, m: [], q: layer.q ?? [] };
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
  // the Portuguese files ("H") replace; the layer's ("en.H") merge into the entries already loaded
  const loadLex = jsonpChannel<Record<string, LexEntry>>("__lex", (key, d) => {
    if (!key.includes(".")) Object.assign(lex, d);
    else for (const [k, e] of Object.entries(d)) lex[k] = { ...lex[k], ...e };
  });
  const lexLoading: Record<string, Promise<unknown> | null> = {};

  return {
    chapters,
    lex,
    /** Loads the Hebrew ("H") or Greek ("G") lexicon once; a failed load is retried next time. */
    ensureLex(lang: "H" | "G") {
      if (!data.complete) return Promise.resolve();
      lexLoading[lang] ??= loadLex(lang, `dados/lex/${lang}.js`)
        .then(() => (layer ? loadLex(`${layer}.${lang}`, `dados/${layer}/lex/${lang}.js`) : null))
        .catch(e => {
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
