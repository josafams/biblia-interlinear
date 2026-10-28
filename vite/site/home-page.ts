// index.html: web/home.html with the site address and the home bundle (src/home/main.ts), and home-data.json,
// which the page reads: the counts, the Genesis 1:1 and John 1:1 sample, the EPUB/PDF sizes and the
// "Como usar" storyboards. The same in English in en/ (en/index.html and en/home-data.json), with the BSB.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { getLocale, setLocale } from "../../src/i18n";
import { localizeBooks } from "../../src/lib/books";
import { homePath, readerPath, toRoot } from "../../src/seo/paths";
import { homeBooks, homeHead } from "../../src/seo/site-pages";
import { APP, OUT, fromRoot } from "./app";
import { rebase, translateHtml } from "./translate-html";

type Word = [string, string, string];
type Verse = { n: number; w: Word[]; b?: string };
export type Book = { code: string; name: string; group: string; chapters: { n: number; t?: string }[] };
type Lex = Record<string, { x?: string }>;
type Layer = { v: { n: number; b?: string; g?: [string, string][] }[] };

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const clean = (w: string) =>
  w
    .replace(/\//g, "")
    .replace(/[֑-ֽ֯]/g, "")
    .replace(/[,.;·]$/, "");

// download size of a book file built on this machine (build/epub, build/pdf), or "" when absent
function size(file: string) {
  try {
    const b = fs.statSync(fromRoot(file)).size;
    return b >= 1e8 ? `${Math.round(b / 1048576)} MB` : `${(b / 1048576).toLocaleString(getLocale(), { maximumFractionDigits: 1 })} MB`;
  } catch {
    return "";
  }
}

/** The home page in each locale: Portuguese at the root (index.html), English in en/ (src/seo/paths.ts). */
const HOME_LOCALES = ["pt-BR", "en"];

export async function writeHomePage(books: Book[], home: { js: string; css: string }) {
  const data = fromRoot("build/data");
  let chapters = 0,
    verses = 0,
    words = 0;
  for (const b of books)
    for (const c of b.chapters) {
      chapters++;
      const f = path.join(data, "cap", b.code, `${c.n}.json`);
      if (!fs.existsSync(f)) continue;
      for (const v of (readJson(f) as { v: Verse[] }).v) {
        if (v.n > 0) verses++;
        words += v.w.length;
      }
    }
  const lex: Record<string, Lex> = { H: readJson(path.join(data, "lex/H.json")), G: readJson(path.join(data, "lex/G.json")) };
  const counts = { books: books.length, chapters, verses, words, entries: Object.keys(lex.H).length + Object.keys(lex.G).length };
  const { storyboardSummary } = await import(pathToFileURL(fromRoot("scripts/videos/roteiros.mjs")).href);
  const storyboards = storyboardSummary();
  for (const locale of HOME_LOCALES) {
    setLocale(locale);
    writeHome(locale, structuredClone(books), { counts, lex, storyboards }, home);
  }
  setLocale("pt-BR");
}

function writeHome(
  locale: string,
  books: Book[],
  common: { counts: object; lex: Record<string, Lex>; storyboards: unknown },
  home: { js: string; css: string }
) {
  const data = fromRoot("build/data");
  const own = locale === "pt-BR" ? null : path.join(data, locale.split("-")[0]);
  if (own) localizeBooks(books, readJson(path.join(own, "livros.json")));
  // the chapter with the locale's glosses and running text (build/data/<locale>/cap), when not Portuguese
  const chapter = (code: string, n: number) => {
    const { v } = readJson(path.join(data, "cap", code, `${n}.json`)) as { v: Verse[] };
    if (!own) return v;
    const layer = new Map((readJson(path.join(own, "cap", code, `${n}.json`)) as Layer).v.map(l => [l.n, l]));
    return v.map(x => ({
      ...x,
      b: layer.get(x.n)?.b ?? "",
      w: x.w.map((w, i) => [w[0], w[1], layer.get(x.n)?.g?.[i]?.[0] ?? ""] as Word)
    }));
  };
  const sample = (code: string, v: { w: Word[]; b?: string }, greek: boolean) => ({
    ref: `${books.find(b => b.code === code)!.name} 1:1`,
    greek,
    words: v.w.map(w => ({ o: clean(w[0]), x: common.lex[w[1][0]]?.[w[1]]?.x || "", s: w[1], t: w[2] })),
    blivre: v.b || ""
  });
  const gn = chapter("GEN", 1).find(v => v.n === 1)!,
    jo = chapter("JHN", 1).find(v => v.n === 1)!;
  const files = ["00-Biblia-Interlinear-completa", "00-Biblia-Interlinear-AT", "00-Biblia-Interlinear-NT", "00-Biblia-Livre"];
  const sizes = Object.fromEntries(
    files.flatMap(f => [
      [`${f}.epub`, size(`build/epub/${f}.epub`)],
      [`${f}.pdf`, size(`build/pdf/${f}.pdf`)]
    ])
  );
  const folder = homePath();
  const homeData = {
    counts: common.counts,
    sample: [sample("GEN", gn, false), sample("JHN", { w: jo.w.slice(0, 5), b: jo.b }, true)],
    sizes,
    booksUrl: `${APP.repo}/releases/download/livros`,
    date: new Date().toLocaleDateString(locale),
    root: toRoot(folder),
    storyboards: common.storyboards
  };
  fs.mkdirSync(path.join(OUT, folder), { recursive: true });
  fs.writeFileSync(path.join(OUT, folder, "home-data.json"), JSON.stringify(homeData));
  // the rest of web/home.html is the same everywhere: the site address and the bundle; in another locale its marked
  // texts are translated (vite/site/translate-html.ts) and its addresses start from en/
  const other = HOME_LOCALES.find(l => l !== locale)!;
  const values: Record<string, string> = {
    __SEO_HEAD__: homeHead(homePath(other)),
    __BOOKS_LIST__: homeBooks(books),
    __REPO__: APP.repo,
    __REPO_CURTO__: APP.repo.replace(/^https:\/\//, ""),
    __LIVROS__: `${APP.repo}/releases/download/livros`,
    __READER__: toRoot(folder) + readerPath(),
    __OTHER_HOME__: homePath(other) || "index.html",
    __OTHER_LOCALE__: other,
    __HOME_BUNDLE__: home.js,
    __HOME_CSS__: home.css
  };
  let html = fs.readFileSync(fromRoot("web/home.html"), "utf8");
  if (own) html = translateHtml(html).replace('data-locale="pt-BR"', `data-locale="${locale}"`);
  for (const [k, v] of Object.entries(values)) html = html.split(k).join(v);
  const missing = html.match(/__[A-Z_]+__/);
  if (missing) throw new Error(`web/home.html: placeholder without a value ${missing[0]}`);
  if (folder) html = rebase(html, folder, locale.split("-")[0]);
  fs.writeFileSync(path.join(OUT, folder, "index.html"), html);
}
