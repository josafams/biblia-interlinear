// The static pages for search engines (src/seo/): biblia/ (books), biblia/<book>/ and biblia/<book>/<n>/, from
// build/data. They stay out of the app (android.yml and ios.yml remove them) and out of the precache (sw.js).
import fs from "node:fs";
import path from "node:path";
import { bookPage, booksPage, chapterPage, type SeoBook, type SeoVerse } from "../../src/seo/bible-pages";
import type { Site } from "../../src/seo/document";
import { bookPath, booksPath, chapterPath } from "../../src/seo/paths";
import { APP, OUT, fromRoot } from "./app";

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const write = (page: string, html: string) => {
  const dir = path.join(OUT, page);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
};

/** Writes the pages and returns their paths (for the sitemap). */
export function writeBiblePages(books: SeoBook[], css: string) {
  const site: Site = { css, theme: APP.theme };
  const data = fromRoot("build/data");
  const lexicon = new Set([
    ...Object.keys(readJson(path.join(data, "lex/H.json"))),
    ...Object.keys(readJson(path.join(data, "lex/G.json")))
  ]);
  fs.rmSync(path.join(OUT, booksPath()), { recursive: true, force: true });
  const pages = [booksPath()];
  write(booksPath(), booksPage(books, site));
  for (const b of books) {
    write(bookPath(b.name), bookPage(b, site));
    pages.push(bookPath(b.name));
    for (const c of b.chapters) {
      const f = path.join(data, "cap", b.code, `${c.n}.json`);
      if (!fs.existsSync(f)) continue; // preview build
      const verses: SeoVerse[] = readJson(f).v;
      write(chapterPath(b.name, c.n), chapterPage(b, c.n, verses, lexicon, site));
      pages.push(chapterPath(b.name, c.n));
    }
  }
  return pages;
}
