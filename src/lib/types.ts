// Shapes of the data files written by scripts/export.py (build/web/dados) and of DATA inlined in ler.html.
// Field names are those of the files.

/** [text with "/" between morphemes, Strong, gloss, gloss source, morphology, lemma, ketiv] */
export type RawWord = [string, string, string, string, string, string?, string?];

export type Word = {
  heb: string;
  parts: string[];
  strong: string;
  gloss: string;
  gf: string;
  morph: string;
  lemma?: string;
  ketiv?: string;
};

export type Verse = { n: number; b?: string; w: RawWord[]; [extra: string]: unknown };
export type Chapter = { book: string; chapter: number; v: Verse[]; [extra: string]: unknown };

export type ChapterInfo = { n: number; v: number; [extra: string]: unknown };
export type Book = { code: string; name: string; abbrev: string; nt?: boolean; chapters: ChapterInfo[]; [extra: string]: unknown };

/** A lexicon entry; x = transliteration. */
export type LexEntry = { x?: string; n?: number; [extra: string]: unknown };

export type BibleData = {
  books: Book[];
  chapters?: Record<string, Chapter>;
  lex?: Record<string, LexEntry>;
  complete: boolean;
};
