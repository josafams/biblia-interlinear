// The static pages for search engines (src/seo/): biblia/ (books), biblia/<book>/ and biblia/<book>/<n>/, from
// build/data. They stay out of the app (android.yml and ios.yml remove them) and out of the precache (sw.js).
import fs from "node:fs";
import path from "node:path";
import { bookPage, booksPage, chapterPage, type SeoBook, type SeoVerse } from "../../src/seo/bible-pages";
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

/** Writes the pages of the Bible and of the lexicon and returns their paths (for the sitemap). */
export function writeBiblePages(books: SeoBook[], css: string) {
  const site: Site = { css, theme: APP.theme };
  const data = fromRoot("build/data");
  const entries: Record<string, SeoEntry> = { ...readJson(path.join(data, "lex/H.json")), ...readJson(path.join(data, "lex/G.json")) };
  const lexicon = new Set(Object.keys(entries));
  fs.rmSync(path.join(OUT, booksPath()), { recursive: true, force: true });
  fs.rmSync(path.join(OUT, "lexico"), { recursive: true, force: true });
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
      const verses: SeoVerse[] = readJson(f).v;
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
