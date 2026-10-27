// The static page of an entry of the lexicon (lexico/G26/): the word, transliteration, pronunciation, meaning,
// how the Bíblia Livre translates it and the first verses where it appears, each one a link to its chapter page.
import { t } from "../i18n";
import { document, type Site } from "./document";
import { breadcrumbs, escapeHtml as e, termData } from "./head";
import { booksPath, chapterPath, entryPath, toRoot } from "./paths";

/** An entry as in build/data/lex/{H,G}.json */
export type SeoEntry = { l: string; x?: string; p?: string; n?: number; o?: string; s?: string; t?: string };
export type SeoRef = { book: string; chapter: number; verse: number; gloss: string };

export const MAX_REFS = 30;

export function entryPage(key: string, entry: SeoEntry, refs: SeoRef[], site: Site) {
  const path = entryPath(key),
    root = toRoot(path),
    greek = key.startsWith("G");
  const lang = greek ? "grc" : "he";
  const set = t(greek ? "seo.lexicon_greek" : "seo.lexicon_hebrew");
  const name = `${entry.l}${entry.x ? ` (${entry.x})` : ""}`;
  const row = (label: string, value?: string | number) => (value || value === 0 ? `<dt>${e(label)}</dt><dd>${e(value)}</dd>` : "");
  const list = refs
    .map(
      r =>
        `<li><a href="${root}${chapterPath(r.book, r.chapter)}#v${r.verse}">${e(`${r.book} ${r.chapter}:${r.verse}`)}</a> <span>${e(
          r.gloss.replace(/-/g, " ")
        )}</span></li>`
    )
    .join("");
  const total = entry.n ?? refs.length;
  const body = `<article class="entry">
<h1><span lang="${lang}"${greek ? "" : ' dir="rtl"'}>${e(entry.l)}</span></h1>
<p class="lede">${e([entry.x, key].filter(Boolean).join(" · "))}</p>
<dl>
${row(t("seo.transliteration"), entry.x)}
${row(t("seo.pronunciation"), entry.p)}
${row(t("seo.meaning"), entry.s)}
${row(t("seo.origin"), entry.o)}
${row(t("seo.translated_as"), entry.t)}
${row(t("seo.occurrences"), total)}
</dl>
${list ? `<h2>${e(t("seo.where", { count: total }))}</h2><ol class="refs">${list}</ol>` : ""}
${total > refs.length ? `<p class="credit">${e(t("seo.more_refs", { count: total - refs.length }))}</p>` : ""}
</article>`;
  const meta = {
    path,
    type: "article" as const,
    title: t("seo.entry_title", { word: name, key }),
    description: t("seo.entry_description", { word: name, key, meaning: entry.s || entry.t || "" }),
    jsonLd: [
      termData({ name: entry.l, alternate: entry.x || "", code: key, description: entry.s || "", path, set }),
      breadcrumbs([
        [t("seo.bible"), booksPath()],
        [name, path]
      ])
    ]
  };
  return document(meta, site, body, [
    [t("seo.bible"), booksPath()],
    [`${set} · ${key}`, path]
  ]);
}
