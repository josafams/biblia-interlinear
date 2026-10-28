// The document of a static page for search engines: head (src/seo/head.ts), a small header with the way home and
// to the books, the content and a footer with the sources. No script: the content is all in the HTML.
import { getLocale, t } from "../i18n";
import { escapeHtml as e, headTags, type PageMeta } from "./head";
import { booksPath, homePath, readerPath, toRoot } from "./paths";

/** The stylesheet and theme color; `alt` is the other locale the pages exist in (for the hreflang links). */
export type Site = { css: string; theme: string; alt?: string };

export function document(meta: PageMeta, site: Site, body: string, crumbs: [name: string, path: string][] = []) {
  const root = toRoot(meta.path);
  const trail = crumbs.length
    ? `<nav class="crumbs" aria-label="${e(t("seo.crumbs"))}"><ol>${crumbs
        .map(([name, path], i) =>
          i === crumbs.length - 1 ? `<li aria-current="page">${e(name)}</li>` : `<li><a href="${root}${path}">${e(name)}</a></li>`
        )
        .join("")}</ol></nav>`
    : "";
  return `<!doctype html>
<html lang="${getLocale()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${headTags(meta, t("app.name"))}
<meta name="theme-color" content="${site.theme}">
<link rel="icon" type="image/png" href="${root}icones/favicon-64.png">
<link rel="apple-touch-icon" href="${root}icones/apple-touch-icon.png">
<link rel="stylesheet" href="${root}fonts/fonts.css">
<link rel="stylesheet" href="${root}${site.css}">
</head>
<body>
<header class="top"><a class="brand" href="${root}${homePath() || "index.html"}"><span aria-hidden="true">א</span> ${e(t("app.name"))}</a><a href="${root}${booksPath()}">${e(
    t("seo.books")
  )}</a><a href="${root}${readerPath()}">${e(t("seo.reader"))}</a></header>
<main>
${trail}
${body}
</main>
<footer><p>${e(t("seo.footer"))} <a href="${root}${homePath() || "index.html"}#como">${e(t("seo.sources"))}</a> · <a href="${root}privacidade.html">${e(
    t("seo.privacy")
  )}</a></p></footer>
</body>
</html>
`;
}
