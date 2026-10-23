// The address of a verse to share (…/ler.html#JHN.3.16).
import { SITE_URL } from "./native";

/**
 * In the app the page is served from the device (https://localhost on Android, capacitor:// on iOS), an address
 * nobody else can open: the link points to the published site. In the browser it is the page that is open.
 */
export function verseLink(ref: { book: string; chapter: number; verse: number }, page: { native: boolean; href: string }) {
  const local = page.native || !/^https?:/.test(page.href);
  const base = local ? SITE_URL + "ler.html" : page.href.split("#")[0];
  return `${base}#${ref.book}.${ref.chapter}.${ref.verse}`;
}
