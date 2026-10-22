// What the lexicon entry (verbete) shows: the word as in the text and its meaning first; how the Bíblia Livre
// translates it, its origin, the Strong number and the pronunciation legend at the end.
import { t, tryT } from "../../i18n";
import { decodeMorph } from "../morph";
import { cleanHeb, esc, glossHTML, glossSpoken } from "../text";
import type { LexEntry, Word } from "../types";

type Entry = LexEntry & { l?: string; p?: string; s?: string; se?: string; ge?: string; o?: string; oe?: string; t?: string; n?: number };

export type EntryContext = {
  lex: Record<string, Entry>;
  greek: boolean;
  cantillation: boolean;
  /** "palavra 3 de 12 · João 3:16" when opened from a word of the text */
  position: string;
  /** how many times the lemma occurs in the chapter on screen */
  inChapter: number;
  chapterRef: string;
  /** the concordance ("Ver as N ocorrências") is available on this page */
  concordance: boolean;
};

export type EntryView = {
  key: string;
  lang: "grc" | "he";
  title: string;
  /** what "Ouvir" reads */
  say: string;
  lemma: string;
  xlit: string;
  pron: string;
  position: string;
  context: { glossHtml: string; glossSpoken: string; source: string; objectNote: boolean; morph: string; ketiv: string } | null;
  /** false when the Strong dictionary has no entry */
  found: boolean;
  meaning: { text: string; english: boolean };
  translations: { text: string; count: string }[];
  /** escaped HTML with buttons for the Strong numbers it mentions (class "ref", data-ref) */
  originHtml: string;
  originEnglish: boolean;
  uses: string;
  englishUrl: string | null;
  occurrences: number;
  ariaLabel: string;
};

/** Blue Letter Bible, for the entry in English. */
export const englishEntryUrl = (k: string) =>
  /^[HG]\d+$/.test(k) ? `https://www.blueletterbible.org/lexicon/${k.toLowerCase()}/kjv/${k[0] === "H" ? "wlc" : "tr"}/0-1/` : null;

/** Strong numbers in a text become buttons to their entries (when the lexicon has them). */
export function linkRefs(text: string, lex: Record<string, Entry>) {
  return esc(text).replace(/\b([HG])(\d+)\b/g, m => {
    const e = lex[m];
    if (!e) return m;
    return `<button class="ref" data-ref="${m}" aria-label="${esc(t("entry.ref_label", { strong: m, xlit: e.x || "" }))}">${m}<span class="rh" lang="${m[0] === "H" ? "he" : "grc"}">${esc(e.l)}</span>${esc(e.x)}</button>`;
  });
}

/** "luz (45); dia (3)" → the translations with their counts (at most 8). */
export function translations(text: string | undefined) {
  return String(text || "")
    .split(";")
    .map(s => s.trim().match(/^(.*?)\s*\((\d+)\)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .slice(0, 8)
    .map(m => ({ text: m[1], count: m[2] }));
}

function strongLabel(k: string) {
  if (!k || k.startsWith("G:")) return t("entry.no_strong");
  return /^H[a-z]$/.test(k) ? t("entry.hebrew_particle") : t("word.strong", { strong: k });
}

export function entryView(k: string, word: Word | null, c: EntryContext): EntryView {
  const e = c.lex[k];
  const lang = k && k[0] === "G" ? "grc" : "he";
  const lemma = e ? e.l || "" : word?.lemma || "";
  const shown = (s: string) => (c.greek || c.cantillation ? s : cleanHeb(s));
  const n = e?.n || 0;
  const uses = [strongLabel(k), t("entry.occurrences", { count: n })];
  if (c.inChapter) uses.push(t("entry.in_chapter", { count: c.inChapter, ref: c.chapterRef }));
  const source = word?.gf ? tryT(`word.gloss_source.${word.gf}`) || "" : "";
  return {
    key: k,
    lang,
    title: word ? shown(word.heb) : lemma,
    say: word ? word.heb : lemma,
    lemma,
    xlit: e?.x || "",
    pron: e?.p || "",
    position: word ? c.position : "",
    context: word
      ? {
          glossHtml: glossHTML(word.gloss),
          glossSpoken: glossSpoken(word.gloss),
          source,
          objectNote: /\[obj\]/.test(word.gloss || ""),
          morph: decodeMorph(word.morph, c.greek),
          ketiv: word.ketiv || ""
        }
      : null,
    found: !!e,
    meaning: e?.s ? { text: e.s, english: false } : { text: e?.se || e?.ge || "", english: true },
    translations: translations(e?.t),
    originHtml: e?.o ? linkRefs(e.o, c.lex) : e?.oe ? linkRefs(e.oe, c.lex) : "",
    originEnglish: !e?.o && !!e?.oe,
    uses: uses.join(" · "),
    englishUrl: englishEntryUrl(k),
    occurrences: c.concordance && k && n > 1 ? n : 0,
    ariaLabel: t("entry.label", { strong: k && !k.startsWith("G:") ? k : "", xlit: e?.x || "" })
      .replace(/\s+/g, " ")
      .trim()
  };
}
