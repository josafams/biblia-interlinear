// The static pages of the Bible for search engines: the list of books (biblia/), a book with its introduction and
// chapters (biblia/joao/) and a chapter with the Bíblia Livre and the original word by word (biblia/joao/3/). Each
// one leads to the same place in the reader (ler.html#JHN.3).
import { t } from "../i18n";
import { document, type Site } from "./document";
import { bookData, breadcrumbs, chapterData, escapeHtml as e } from "./head";
import { bookPath, booksPath, chapterPath, entryPath, toRoot } from "./paths";

export type SeoBook = {
  code: string;
  name: string;
  nt: boolean;
  group: string;
  chapters: { n: number; v: number; t?: string }[];
  about?: {
    title_orig?: string;
    title_orig_xlit?: string;
    summary?: string;
    structure?: { title: string; from: number; to: number; text: string }[];
    key_verses?: { ref: string; text: string }[];
  } | null;
};
/** [original, strong, gloss, flag, morph, …] as in build/data/cap */
export type SeoWord = [string, string, string, ...unknown[]];
export type SeoVerse = { n: number; b?: string; w: SeoWord[] };

const original = (b: SeoBook) => (b.nt ? "grc" : "he");
const wordLang = (b: SeoBook, w: SeoWord) => (b.nt ? "grc" : String(w[4] || "").startsWith("A") ? "arc" : "he");
// the Hebrew of the data has "/" between the morphemes and the cantillation marks
const cleanWord = (w: string) => w.replace(/\//g, "").replace(/[֑-ֽ֯]/g, "");
const gloss = (g: string) => g.replace(/-/g, " ");
const reader = (root: string, ref: string) =>
  `<p class="open"><a class="btn" href="${root}ler.html#${ref}">${e(t("seo.open_reader"))}</a></p>`;

export function booksPage(books: SeoBook[], site: Site) {
  const path = booksPath();
  const groups = [...new Set(books.map(b => b.group))];
  const body = `<h1>${e(t("seo.books_title"))}</h1>
<p class="lede">${e(t("seo.books_lede"))}</p>
${groups
  .map(
    g =>
      `<section><h2>${e(g)}</h2><ul class="books">${books
        .filter(b => b.group === g)
        .map(
          b =>
            `<li><a href="../${bookPath(b.name)}">${e(b.name)}</a> <span>${e(t("seo.chapters_count", { count: b.chapters.length }))}</span></li>`
        )
        .join("")}</ul></section>`
  )
  .join("\n")}`;
  const meta = {
    path,
    title: t("seo.books_page_title"),
    description: t("seo.books_description"),
    jsonLd: [breadcrumbs([[t("seo.bible"), path]])]
  };
  return document(meta, site, body);
}

export function bookPage(b: SeoBook, site: Site) {
  const path = bookPath(b.name),
    root = toRoot(path),
    a = b.about || {};
  const ch = (n: number) => `${root}${chapterPath(b.name, n)}`;
  const parts = (a.structure || [])
    .map(
      s =>
        `<li><a href="${ch(s.from)}">${e(s.title)}</a> <span class="range">${e(s.from === s.to ? t("seo.chapter_one", { n: s.from }) : t("seo.chapter_range", { from: s.from, to: s.to }))}</span><p>${e(
          s.text
        )}</p></li>`
    )
    .join("");
  const keys = (a.key_verses || [])
    .map(k => `<blockquote><p>${e(k.text)}</p><cite>${e(`${b.name} ${k.ref}`)}</cite></blockquote>`)
    .join("");
  const body = `<h1>${e(b.name)}${a.title_orig ? ` <span class="orig" lang="${original(b)}">${e(a.title_orig)}</span>` : ""}</h1>
${a.summary ? `<p class="lede">${e(a.summary)}</p>` : ""}
${reader(root, `${b.code}.1`)}
${parts ? `<section><h2>${e(t("seo.structure"))}</h2><ol class="parts">${parts}</ol></section>` : ""}
<section><h2>${e(t("seo.chapters"))}</h2><ol class="chapters">${b.chapters
    .map(c => `<li><a href="${ch(c.n)}"><b>${c.n}</b>${c.t ? ` <span>${e(c.t)}</span>` : ""}</a></li>`)
    .join("")}</ol></section>
${keys ? `<section><h2>${e(t("seo.key_verses"))}</h2>${keys}</section>` : ""}`;
  const lang = t(b.nt ? "seo.greek" : "seo.hebrew");
  const description = a.summary || t("seo.book_description", { book: b.name, lang });
  const meta = {
    path,
    type: "book" as const,
    title: t("seo.book_title", { book: b.name, lang }),
    description,
    jsonLd: [
      bookData(b.name, path, description, original(b)),
      breadcrumbs([
        [t("seo.bible"), booksPath()],
        [b.name, path]
      ])
    ]
  };
  return document(meta, site, body, [
    [t("seo.bible"), booksPath()],
    [b.name, path]
  ]);
}

export function chapterPage(b: SeoBook, n: number, verses: SeoVerse[], lexicon: Set<string>, site: Site) {
  const path = chapterPath(b.name, n),
    root = toRoot(path);
  const info = b.chapters.find(c => c.n === n);
  const name = `${b.name} ${n}`;
  const word = (w: SeoWord) => {
    const inner = `<b>${e(cleanWord(w[0]))}</b><i lang="pt-BR">${e(gloss(w[2]))}</i>`;
    return lexicon.has(w[1]) ? `<a class="w" href="${root}${entryPath(w[1])}">${inner}</a>` : `<span class="w">${inner}</span>`;
  };
  const rtl = b.nt ? "" : ' dir="rtl"';
  const verse = (v: SeoVerse) =>
    v.n === 0
      ? `<section class="v title"><p class="bl">${e(v.b || "")}</p></section>`
      : `<section class="v" id="v${v.n}"><a class="n" href="#v${v.n}">${e(`${n}:${v.n}`)}</a><p class="orig" lang="${wordLang(
          b,
          v.w[0] || ["", "", ""]
        )}"${rtl}>${v.w.map(word).join(" ")}</p><p class="bl">${e(v.b || "")}</p></section>`;
  const prev = n > 1 ? `<a rel="prev" href="${root}${chapterPath(b.name, n - 1)}">‹ ${e(`${b.name} ${n - 1}`)}</a>` : "<span></span>";
  const next =
    n < b.chapters.length ? `<a rel="next" href="${root}${chapterPath(b.name, n + 1)}">${e(`${b.name} ${n + 1}`)} ›</a>` : "<span></span>";
  const body = `<h1>${e(name)}</h1>
${info?.t ? `<p class="lede">${e(info.t)}</p>` : ""}
${reader(root, `${b.code}.${n}`)}
<div class="verses">
${verses.map(verse).join("\n")}
</div>
<nav class="pager" aria-label="${e(t("seo.chapter_nav"))}">${prev}<a href="${root}${bookPath(b.name)}">${e(t("seo.all_chapters", { book: b.name }))}</a>${next}</nav>
<p class="credit">${e(t("seo.credit"))}</p>`;
  const lang = t(b.nt ? "seo.greek" : "seo.hebrew");
  const first = verses.find(v => v.n > 0)?.b || "";
  const meta = {
    path,
    type: "article" as const,
    title: t("seo.chapter_title", { chapter: name, lang }),
    description: `${info?.t ? `${info.t}. ` : ""}${first}`,
    jsonLd: [
      chapterData(name, path, n, { name: b.name, path: bookPath(b.name) }, original(b)),
      breadcrumbs([
        [t("seo.bible"), booksPath()],
        [b.name, bookPath(b.name)],
        [name, path]
      ])
    ]
  };
  return document(meta, site, body, [
    [t("seo.bible"), booksPath()],
    [b.name, bookPath(b.name)],
    [String(n), path]
  ]);
}
