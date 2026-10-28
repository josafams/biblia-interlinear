// The fixed text of the HTML pages (web/*.html) in the chosen locale. The pages are written in Portuguese and
// mark each text with its key: data-i18n (text), data-i18n-html (HTML of the locale file, trusted) or
// data-i18n-label (aria-label). In Portuguese nothing changes; in another locale the texts come from its file.
import { getLocale, t } from ".";

const PAGE_LOCALE = "pt-BR";

export function translatePage(root: ParentNode = document) {
  if (getLocale() === PAGE_LOCALE) return;
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) el.textContent = t(el.dataset.i18n!);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) el.innerHTML = t(el.dataset.i18nHtml!);
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-label]")) el.setAttribute("aria-label", t(el.dataset.i18nLabel!));
  for (const el of root.querySelectorAll<HTMLElement>(`[lang="${PAGE_LOCALE}"]`)) el.lang = getLocale();
}
