// The static pages for search engines (src/seo/): biblia/ (books), biblia/<book>/ and biblia/<book>/<n>/, from
// build/data, and the same in English (en/bible/…), with the BSB and the English glosses of build/data/en. They stay out of the app (android.yml and ios.yml remove them) and out of the precache (sw.js).
import fs from "node:fs";
import path from "node:path";
import { setLocale, tryT } from "../../src/i18n";
import { localizeBooks } from "../../src/lib/books";
import { bookPage, booksPage, chapterPage, type SeoBook, type SeoVerse, type SeoWord } from "../../src/seo/bible-pages";
import type { Site } from "../../src/seo/document";
import { entryPage, MAX_REFS, type SeoEntry, type SeoRef } from "../../src/seo/lexicon-pages";
import { bookPath, booksPath, chapterPath, entryPath } from "../../src/seo/paths";
import { robots, sitemapIndex, sitemapParts, urlSet } from "../../src/seo/sitemap";
import { APP, OUT, fromRoot } from "./app";

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (page: string, html: string) => {
  const dir = path.join(OUT, page);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
};

/** The locales of the static pages: Portuguese at the root, English in en/ (src/seo/paths.ts). */
export const SEO_LOCALES = ["pt-BR", "en"];

type Layer = { v: { n: number; b?: string; g?: [string, string][] }[] };

/** The chapter in the locale: the words of the original with the locale's glosses and its running text. */
function localVerses(verses: SeoVerse[], layer: Layer | null): SeoVerse[] {
  if (!layer) return verses;
  const own = new Map(layer.v.map(v => [v.n, v]));
  return verses.map(v => {
    const l = own.get(v.n);
    return { ...v, b: l?.b ?? "", w: v.w.map((w, i) => [w[0], w[1], l?.g?.[i]?.[0] ?? "", ...w.slice(3)] as SeoWord) };
  });
}

/** Writes the pages of the Bible and of the lexicon in each locale and returns their paths (for the sitemap). */
export function writeBiblePages(books: SeoBook[], css: string) {
  const name = (code: string) => tryT(`books.${code}.name`);
  const names: Record<string, Record<string, string>> = {};
  for (const locale of SEO_LOCALES) {
    setLocale(locale);
    names[locale] = Object.fromEntries(books.map(b => [b.code, name(b.code) ?? b.name]));
  }
  const pages: string[] = [];
  for (const locale of SEO_LOCALES) {
    setLocale(locale);
    const alt = SEO_LOCALES.find(l => l !== locale);
    pages.push(...writeLocale(locale, books, { css, theme: APP.theme, alt }, alt ? names[alt] : {}));
  }
  setLocale("pt-BR");
  return pages;
}

function writeLocale(locale: string, source: SeoBook[], site: Site, altNames: Record<string, string>) {
  const data = fromRoot("build/data");
  const own = locale === "pt-BR" ? null : path.join(data, locale.split("-")[0]);
  const books = structuredClone(source);
  if (own) localizeBooks(books, readJson(path.join(own, "livros.json")));
  for (const b of books) b.alt = altNames[b.code];
  const entries: Record<string, SeoEntry> = { ...readJson(path.join(data, "lex/H.json")), ...readJson(path.join(data, "lex/G.json")) };
  if (own)
    for (const L of ["H", "G"])
      for (const [key, e] of Object.entries(readJson(path.join(own, "lex", `${L}.json`)) as Record<string, Partial<SeoEntry>>))
        if (entries[key]) entries[key] = { ...entries[key], ...e };
  const lexicon = new Set(Object.keys(entries));
  fs.rmSync(path.join(OUT, booksPath()), { recursive: true, force: true });
  fs.rmSync(path.join(OUT, entryPath("")), { recursive: true, force: true });
  // the first verses of each entry, in the order of the Bible
  const refs = new Map<string, SeoRef[]>();
  const pages = [booksPath()];
  write(booksPath(), booksPage(books, site));
  for (const b of books) {
    write(bookPath(b.name), bookPage(b, site));
    pages.push(bookPath(b.name));
    for (const c of b.chapters) {
      const f = path.join(data, "cap", b.code, `${c.n}.json`);
      if (!fs.existsSync(f)) continue; // preview build
      const layer = own ? path.join(own, "cap", b.code, `${c.n}.json`) : "";
      const verses = localVerses(readJson(f).v, layer && fs.existsSync(layer) ? readJson(layer) : null);
      for (const v of verses)
        for (const w of v.w) {
          const list = refs.get(w[1]) || refs.set(w[1], []).get(w[1])!;
          if (list.length < MAX_REFS && v.n > 0) list.push({ book: b.name, chapter: c.n, verse: v.n, gloss: w[2] });
        }
      write(chapterPath(b.name, c.n), chapterPage(b, c.n, verses, lexicon, site));
      pages.push(chapterPath(b.name, c.n));
    }
  }
  for (const [key, entry] of Object.entries(entries)) {
    write(entryPath(key), entryPage(key, entry, refs.get(key) || [], site));
    pages.push(entryPath(key));
  }
  return pages;
}

/** sitemap.xml (index), its parts and robots.txt, for the pages written above. */
export function writeSitemaps(pages: string[]) {
  const lastmod = new Date().toISOString().slice(0, 10);
  const parts = sitemapParts(pages);
  for (const [file, list] of Object.entries(parts)) fs.writeFileSync(path.join(OUT, file), urlSet(list, lastmod));
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), sitemapIndex(Object.keys(parts), lastmod));
  fs.writeFileSync(path.join(OUT, "robots.txt"), robots());
}
