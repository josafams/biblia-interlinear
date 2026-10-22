// index.html: web/home.html with its __PLACEHOLDERS__ filled from the exported data
// (counts, the Genesis 1:1 and John 1:1 sample, EPUB/PDF sizes and the "Como usar" storyboards).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { APP, OUT, escapeHtml as esc, fromRoot } from "./app";

type Word = [string, string, string];
type Verse = { n: number; w: Word[]; b?: string };
export type Book = { code: string; chapters: { n: number }[] };
type Lex = Record<string, { x?: string }>;

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const fmt = (n: number) => n.toLocaleString("pt-BR");
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

export async function writeHomePage(books: Book[]) {
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

  const cards = (v: { w: Word[] }, greek: boolean) =>
    v.w
      .map(w => {
        const e = lex[w[1][0]]?.[w[1]] || {};
        return `<div class="wc"><span class="o${greek ? " g" : ""}" lang="${greek ? "grc" : "he"}">${esc(clean(w[0]))}</span><span class="x">${esc(e.x || "")}</span><span class="s">${esc(w[1])}</span><span class="t">${esc(w[2])}</span></div>`;
      })
      .join("");
  const gn = chapter("GEN", 1).v.find(v => v.n === 1)!,
    jo = chapter("JHN", 1).v.find(v => v.n === 1)!;
  const sample = `<div class="ref"><b>Gênesis 1:1</b><span>hebraico, lê-se da direita para a esquerda</span></div>
    <div class="cards rtl">${cards(gn, false)}</div>
    <p class="blivre"><small>BLIVRE</small>${esc(gn.b)}</p>
    <div style="height:1px;background:var(--line)"></div>
    <div class="ref"><b>João 1:1</b><span>grego, da esquerda para a direita</span></div>
    <div class="cards">${cards({ w: jo.w.slice(0, 5) }, true)}</div>
    <p class="blivre"><small>BLIVRE</small>${esc(jo.b)}</p>`;

  const { storyboardSummary } = await import(pathToFileURL(fromRoot("scripts/videos/roteiros.mjs")).href);
  const values: Record<string, string> = {
    __DESC__: esc(APP.desc),
    __REPO__: APP.repo,
    __REPO_CURTO__: APP.repo.replace(/^https:\/\//, ""),
    __LIVROS__: `${APP.repo}/releases/download/livros`,
    __AMOSTRA__: sample,
    __N_LIVROS__: fmt(books.length),
    __N_CAPS__: fmt(chapters),
    __N_VERS__: fmt(verses),
    __N_PALAVRAS__: fmt(words),
    __N_VERBETES__: fmt(Object.keys(lex.H).length + Object.keys(lex.G).length),
    __TAM_EPUB_COMPLETA__: size("build/epub/00-Biblia-Interlinear-completa.epub"),
    __TAM_PDF_COMPLETA__: size("build/pdf/00-Biblia-Interlinear-completa.pdf"),
    __TAM_EPUB_AT__: size("build/epub/00-Biblia-Interlinear-AT.epub"),
    __TAM_PDF_AT__: size("build/pdf/00-Biblia-Interlinear-AT.pdf"),
    __TAM_EPUB_NT__: size("build/epub/00-Biblia-Interlinear-NT.epub"),
    __TAM_EPUB_BLIVRE__: size("build/epub/00-Biblia-Livre.epub"),
    __TAM_PDF_BLIVRE__: size("build/pdf/00-Biblia-Livre.pdf"),
    __TAM_PDF_NT__: size("build/pdf/00-Biblia-Interlinear-NT.pdf"),
    __DATA__: new Date().toLocaleDateString("pt-BR"),
    __ROTEIROS__: JSON.stringify(storyboardSummary()).replace(/<\//g, "<\\/")
  };
  let html = fs.readFileSync(fromRoot("web/home.html"), "utf8");
  for (const [k, v] of Object.entries(values)) html = html.split(k).join(v);
  const missing = html.match(/__[A-Z_]+__/);
  if (missing) throw new Error(`web/home.html: placeholder without a value ${missing[0]}`);
  fs.writeFileSync(path.join(OUT, "index.html"), html);
}
