// The head of the pages that already existed (home, reader, privacy policy): title, description, canonical, Open
// Graph and structured data, from the locale.
import { getLocale, LOCALE_IDS, t } from "../i18n";
import { alternates, escapeHtml, headTags, website } from "./head";
import { bookPath, booksPath, homePath } from "./paths";

const name = () => t("app.name");

/** The home page; `other` is the home of the other locale (hreflang). */
export const homeHead = (other?: string) => {
  const path = homePath();
  const description = t("seo.home_description");
  const locale = LOCALE_IDS.find(l => l !== getLocale());
  return headTags(
    { path, title: t("seo.home_title"), description, jsonLd: [website(name(), description)], alternates: alternates(path, other, locale) },
    name()
  );
};

export const readerHead = () =>
  headTags({ path: "ler.html", title: t("seo.reader_title"), description: t("seo.reader_description") }, name());

/** For browsers without JavaScript (and crawlers that do not run it): the way to the simple pages. */
export const readerNoscript = () =>
  `<noscript><p class="noscript">${escapeHtml(t("seo.reader_noscript"))} <a href="${booksPath()}">${escapeHtml(t("seo.reader_noscript_link"))}</a></p></noscript>`;

export const privacyHead = () =>
  headTags({ path: "privacidade.html", title: t("seo.privacy_title"), description: t("seo.privacy_description") }, name());

/** The two lines under the name on the share image (vite/site/share-image.ts). */
export const shareLines = () => [t("seo.share_line1"), t("seo.share_line2")];

/** The books on the home page, by group, each one a link to its page (biblia/<book>/). */
export function homeBooks(books: { name: string; group: string }[]) {
  const groups = [...new Set(books.map(b => b.group))];
  return `<div class="bible-books">${groups
    .map(
      g =>
        `<div><h3>${escapeHtml(g)}</h3><p>${books
          .filter(b => b.group === g)
          .map(b => `<a href="${bookPath(b.name)}">${escapeHtml(b.name)}</a>`)
          .join(" · ")}</p></div>`
    )
    .join("")}</div><p><a class="btn ghost" href="${booksPath()}">${escapeHtml(t("seo.books_title"))}</a></p>`;
}
