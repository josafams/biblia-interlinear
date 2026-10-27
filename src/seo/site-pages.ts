// The head of the pages that already existed (home, reader, privacy policy): title, description, canonical, Open
// Graph and structured data, from the locale.
import { t } from "../i18n";
import { escapeHtml, headTags, website } from "./head";
import { booksPath } from "./paths";

const name = () => t("app.name");

export const homeHead = (description: string) =>
  headTags({ path: "", title: t("seo.home_title"), description, jsonLd: [website(name(), description)] }, name());

export const readerHead = () =>
  headTags({ path: "ler.html", title: t("seo.reader_title"), description: t("seo.reader_description") }, name());

/** For browsers without JavaScript (and crawlers that do not run it): the way to the simple pages. */
export const readerNoscript = () =>
  `<noscript><p class="noscript">${escapeHtml(t("seo.reader_noscript"))} <a href="${booksPath()}">${escapeHtml(t("seo.reader_noscript_link"))}</a></p></noscript>`;

export const privacyHead = () =>
  headTags({ path: "privacidade.html", title: t("seo.privacy_title"), description: t("seo.privacy_description") }, name());

/** The two lines under the name on the share image (vite/site/share-image.ts). */
export const shareLines = () => [t("seo.share_line1"), t("seo.share_line2")];
