// index.html: web/home.html with the site address and the home bundle (src/home/main.ts), and home-data.json,
// which the page reads: the counts, the Genesis 1:1 and John 1:1 sample, the EPUB/PDF sizes and the
// "Como usar" storyboards.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { homeHead } from "../../src/seo/site-pages";
import { APP, OUT, fromRoot } from "./app";

type Word = [string, string, string];
type Verse = { n: number; w: Word[]; b?: string };
export type Book = { code: string; chapters: { n: number }[] };
type Lex = Record<string, { x?: string }>;

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
    return b >= 1e8 ? `${Math.round(b / 1048576)} MB` : `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  } catch {
    return "";
  }
}

export async function writeHomePage(books: Book[], home: { js: string; css: string }) {
  const data = fromRoot("build/data");
  const chapter = (code: string, n: number) => readJson(path.join(data, "cap", code, `${n}.json`)) as { v: Verse[] };
  const lex: Record<string, Lex> = { H: readJson(path.join(data, "lex/H.json")), G: readJson(path.join(data, "lex/G.json")) };

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

  const sample = (ref: string, v: { w: Word[]; b?: string }, greek: boolean) => ({
    ref,
    greek,
    words: v.w.map(w => ({ o: clean(w[0]), x: lex[w[1][0]]?.[w[1]]?.x || "", s: w[1], t: w[2] })),
    blivre: v.b || ""
  });
  const gn = chapter("GEN", 1).v.find(v => v.n === 1)!,
    jo = chapter("JHN", 1).v.find(v => v.n === 1)!;
  const files = ["00-Biblia-Interlinear-completa", "00-Biblia-Interlinear-AT", "00-Biblia-Interlinear-NT", "00-Biblia-Livre"];
  const sizes = Object.fromEntries(
    files.flatMap(f => [
      [`${f}.epub`, size(`build/epub/${f}.epub`)],
      [`${f}.pdf`, size(`build/pdf/${f}.pdf`)]
    ])
  );
  const { storyboardSummary } = await import(pathToFileURL(fromRoot("scripts/videos/roteiros.mjs")).href);
  const homeData = {
    counts: { books: books.length, chapters, verses, words, entries: Object.keys(lex.H).length + Object.keys(lex.G).length },
    sample: [sample("Gênesis 1:1", gn, false), sample("João 1:1", { w: jo.w.slice(0, 5), b: jo.b }, true)],
    sizes,
    booksUrl: `${APP.repo}/releases/download/livros`,
    date: new Date().toLocaleDateString("pt-BR"),
    storyboards: storyboardSummary()
  };
  fs.writeFileSync(path.join(OUT, "home-data.json"), JSON.stringify(homeData));
  // the rest of web/home.html is the same everywhere: the site address and the bundle
  const values: Record<string, string> = {
    __SEO_HEAD__: homeHead(APP.desc),
    __REPO__: APP.repo,
    __REPO_CURTO__: APP.repo.replace(/^https:\/\//, ""),
    __LIVROS__: `${APP.repo}/releases/download/livros`,
    __HOME_BUNDLE__: home.js,
    __HOME_CSS__: home.css
  };
  let html = fs.readFileSync(fromRoot("web/home.html"), "utf8");
  for (const [k, v] of Object.entries(values)) html = html.split(k).join(v);
  const missing = html.match(/__[A-Z_]+__/);
  if (missing) throw new Error(`web/home.html: placeholder without a value ${missing[0]}`);
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}
