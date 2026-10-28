// A page of web/ in another locale, at build time: the same marks as src/i18n/page.ts (data-i18n, data-i18n-html,
// data-i18n-label) take the text of the current locale, for pages served already translated (en/index.html).
import { escapeHtml } from "../../src/seo/head";
import { getLocale, t } from "../../src/i18n";

const OPEN = /<([a-z][\w-]*)\b[^>]*?\sdata-i18n(-html|-label)?="([^"]+)"[^>]*>/g;

/** Where the element opened at `from` closes: the end of its closing tag (nested tags of the same name count). */
function closeOf(html: string, tag: string, from: number) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "g");
  re.lastIndex = from;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (!depth) return { inner: m.index, end: re.lastIndex };
  }
  throw new Error(`translateHtml: <${tag}> without its closing tag`);
}

export function translateHtml(html: string) {
  let out = "",
    at = 0;
  OPEN.lastIndex = 0;
  for (let m = OPEN.exec(html); m; m = OPEN.exec(html)) {
    const [open, tag, kind, key] = m;
    out += html.slice(at, m.index);
    if (kind === "-label") {
      out += open.replace(/aria-label="[^"]*"/, `aria-label="${escapeHtml(t(key))}"`);
      at = OPEN.lastIndex;
      continue;
    }
    const { inner, end } = closeOf(html, tag, OPEN.lastIndex);
    out += open + (kind === "-html" ? t(key) : escapeHtml(t(key))) + html.slice(inner, end);
    at = OPEN.lastIndex = end;
  }
  return (out + html.slice(at)).replace(/\blang="pt-BR"/g, `lang="${getLocale()}"`);
}

/**
 * The relative addresses of a page written for the site root, from a folder one level down (en/): "../" before
 * them, except those already in that folder; the reader and the privacy page open in the locale (?lang=).
 */
export function rebase(html: string, folder: string, lang: string) {
  return html.replace(/\b(href|src)="([^"]*)"/g, (all, attr, url: string) => {
    if (/^(#|[a-z]+:|\/|__)/.test(url) || !url) return all;
    if (url.startsWith(folder)) return `${attr}="${url.slice(folder.length) || "./"}"`;
    const [, file, hash = ""] = /^([^#]*)(#.*)?$/.exec(url)!;
    const query = /^(ler|privacidade)\.html$/.test(file) ? `?lang=${lang}` : "";
    return `${attr}="${"../".repeat(folder.split("/").filter(Boolean).length)}${file}${query}${hash}"`;
  });
}
