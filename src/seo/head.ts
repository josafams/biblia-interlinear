// The <head> tags search engines and link previews read: title, description, canonical URL, Open Graph, Twitter
// card and structured data (JSON-LD, schema.org). One builder for every page of the site.
import { getLocale } from "../i18n";
import { SITE_URL } from "../lib/site";

export type PageMeta = {
  /** the page's path from the site root ("" for the home page, "biblia/joao/3/") */
  path: string;
  title: string;
  description: string;
  type?: "website" | "article" | "book";
  jsonLd?: object[];
};

/** The share image (1200×630), written by vite/site/share-image.ts. */
export const SHARE_IMAGE = "icones/compartilhar.png";

export const escapeHtml = (s: unknown) =>
  String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export const absolute = (path: string) => SITE_URL + path;

/** Cuts a text at a word, with "…", to fit a meta description (Google shows about 155 characters). */
export function clip(text: string, max = 155) {
  const s = text.replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).replace(/[\s,;:.–-]+$/, "") + "…";
}

/** JSON inside <script>: "</" would close the tag. */
const jsonScript = (o: object) => `<script type="application/ld+json">${JSON.stringify(o).replace(/<\//g, "<\\/")}</script>`;

export function headTags(m: PageMeta, siteName: string) {
  const url = absolute(m.path),
    e = escapeHtml;
  const locale = getLocale().replace("-", "_");
  return [
    `<title>${e(m.title)}</title>`,
    `<meta name="description" content="${e(clip(m.description))}">`,
    `<link rel="canonical" href="${e(url)}">`,
    `<meta property="og:site_name" content="${e(siteName)}">`,
    `<meta property="og:type" content="${m.type || "website"}">`,
    `<meta property="og:locale" content="${locale}">`,
    `<meta property="og:title" content="${e(m.title)}">`,
    `<meta property="og:description" content="${e(clip(m.description, 200))}">`,
    `<meta property="og:url" content="${e(url)}">`,
    `<meta property="og:image" content="${e(absolute(SHARE_IMAGE))}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    ...(m.jsonLd || []).map(jsonScript)
  ].join("\n");
}

// ---- structured data (schema.org)
const CONTEXT = "https://schema.org";

export const breadcrumbs = (items: [name: string, path: string][]) => ({
  "@context": CONTEXT,
  "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absolute(path) }))
});

export const website = (name: string, description: string) => ({
  "@context": CONTEXT,
  "@type": "WebSite",
  name,
  description,
  url: SITE_URL,
  inLanguage: getLocale()
});

export const bookData = (name: string, path: string, description: string, original: string) => ({
  "@context": CONTEXT,
  "@type": "Book",
  name,
  url: absolute(path),
  description,
  inLanguage: [getLocale(), original]
});

export const chapterData = (name: string, path: string, position: number, book: { name: string; path: string }, original: string) => ({
  "@context": CONTEXT,
  "@type": "Chapter",
  name,
  position,
  url: absolute(path),
  inLanguage: [getLocale(), original],
  isPartOf: { "@type": "Book", name: book.name, url: absolute(book.path) }
});

export const termData = (e: { name: string; alternate: string; code: string; description: string; path: string; set: string }) => ({
  "@context": CONTEXT,
  "@type": "DefinedTerm",
  name: e.name,
  alternateName: e.alternate,
  termCode: e.code,
  description: e.description,
  url: absolute(e.path),
  inDefinedTermSet: { "@type": "DefinedTermSet", name: e.set }
});
