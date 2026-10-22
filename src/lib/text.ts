// Text helpers shared by the reader screens: HTML escaping, search normalization and Hebrew cleanup.
import { t } from "../i18n";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export function esc(s: unknown) {
  return String(s ?? "").replace(/[&<>"]/g, c => HTML_ESCAPES[c]);
}

/** Lowercase without accents or Hebrew/Greek transliteration marks, for matching what someone typed. */
export function norm(s: string | null | undefined) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯʼʻᵉ]/g, "")
    .toLowerCase();
}

/** Removes cantillation (U+0591–U+05AF), meteg, paseq and sof pasuq; keeps consonants and vowels. */
export function cleanHeb(s: string) {
  return String(s)
    .normalize("NFD")
    .replace(/[֑-ֽ֯׀׃]/g, "")
    .replace(/\//g, "")
    .normalize("NFC");
}

// The gloss on a word card: the hyphen that joins words ("no-princípio") becomes a discreet separator, and the
// direct object marker (אֵת), which is not translated, becomes a short sign with its explanation (title, screen reader)
export function glossHTML(g: string | null | undefined) {
  return esc(g || "—")
    .replace(/-/g, '<span class="hy">-</span>')
    .replace(/\[obj\]/g, `<abbr class="obj" title="${esc(t("gloss.object_marker_title"))}">${esc(t("gloss.object_marker"))}</abbr>`);
}

/** The gloss as the speech synthesizer should read it. */
export function glossSpoken(g: string | null | undefined) {
  return String(g || "")
    .replace(/\[obj\]/g, ` ${t("gloss.object_marker_spoken")} `)
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
