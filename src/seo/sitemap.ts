// sitemap.xml (an index) and its parts, and robots.txt. A project site of GitHub Pages does not own the robots.txt
// of the domain root, so the sitemap counts through Google Search Console and Bing Webmaster Tools.
import { absolute } from "./head";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
/** A sitemap file takes at most 50,000 addresses. */
export const MAX_URLS = 50000;

export const urlSet = (paths: string[], lastmod: string) =>
  `${HEAD}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths
    .map(p => `<url><loc>${xml(absolute(p))}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`;

export const sitemapIndex = (files: string[], lastmod: string) =>
  `${HEAD}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files
    .map(f => `<sitemap><loc>${xml(absolute(f))}</loc><lastmod>${lastmod}</lastmod></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;

export const robots = () => `User-agent: *\nAllow: /\nSitemap: ${absolute("sitemap.xml")}\n`;

/** The parts of the sitemap: the site's pages, the Bible (books and chapters) and the lexicon, in Portuguese and in English. */
export function sitemapParts(pages: string[]) {
  const parts: Record<string, string[]> = {
    "sitemap-paginas.xml": ["", "en/", "ler.html", "privacidade.html"],
    "sitemap-biblia.xml": pages.filter(p => p.startsWith("biblia/")),
    "sitemap-lexico.xml": pages.filter(p => p.startsWith("lexico/")),
    "sitemap-bible-en.xml": pages.filter(p => p.startsWith("en/bible/")),
    "sitemap-lexicon-en.xml": pages.filter(p => p.startsWith("en/lexicon/"))
  };
  for (const [file, list] of Object.entries(parts)) if (list.length > MAX_URLS) throw new Error(`${file}: ${list.length} addresses`);
  return parts;
}
