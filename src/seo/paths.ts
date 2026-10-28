// The public addresses of the static pages for search engines, relative to the site root, always ending in "/":
// GitHub Pages serves biblia/joao/3/index.html at …/biblia/joao/3/. In Portuguese (like ler.html) they sit at the
// root; another locale has its own folder, with names in its language (en/bible/john/3/).
import { getLocale } from "../i18n";

/** The folders of each locale: its home page, the Bible and the lexicon. */
const FOLDERS: Record<string, { home: string; bible: string; lexicon: string }> = {
  "pt-BR": { home: "", bible: "biblia/", lexicon: "lexico/" },
  en: { home: "en/", bible: "en/bible/", lexicon: "en/lexicon/" }
};
const folders = (locale: string) => FOLDERS[locale] ?? FOLDERS["pt-BR"];

/** "Gênesis" → "genesis", "1 João" → "1-joao", "Cânticos" → "canticos". */
export const bookSlug = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const homePath = (locale = getLocale()) => folders(locale).home;
export const booksPath = (locale = getLocale()) => folders(locale).bible;
export const bookPath = (name: string, locale = getLocale()) => `${booksPath(locale)}${bookSlug(name)}/`;
export const chapterPath = (name: string, n: number, locale = getLocale()) => `${bookPath(name, locale)}${n}/`;
export const entryPath = (key: string, locale = getLocale()) => `${folders(locale).lexicon}${encodeURIComponent(key)}/`;

/** The reader (at a reference, "JHN.3"), from the site root; in another locale it opens in that locale. */
export const readerPath = (ref = "", locale = getLocale()) =>
  `ler.html${locale === "pt-BR" ? "" : `?lang=${locale.split("-")[0]}`}${ref ? `#${ref}` : ""}`;

/** The way from a page to the site root: "" at the root, "../../../" from biblia/joao/3/. */
export const toRoot = (path: string) => "../".repeat(path.split("/").filter(Boolean).length);
