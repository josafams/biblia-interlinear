// Screen text: every string the user sees comes from a locale file (src/i18n/locales/<locale>.json),
// looked up by a dotted key in English ("reader.next_chapter"). Small on purpose and with the same
// key API as the usual libraries, so one can replace it later without touching the callers.
import { store } from "../lib/store";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

type Messages = { [key: string]: string | Messages };
export type Params = Record<string, string | number>;

const LOCALES: Record<string, Messages> = { "pt-BR": ptBR, en };
export const LOCALE_IDS = Object.keys(LOCALES);
/** The locale of the project's own texts (themes, introductions, questions); the others show them once translated (#8). */
const TEXTS_LOCALE = "pt-BR";

// ?lang=en (or pt) in the address picks the locale and saves it on the device; otherwise the saved choice, else
// Portuguese. The English version is not announced yet, so only a chosen locale shows the picker in Aparência.
function chosenLocale(): string | null {
  try {
    const asked = new URLSearchParams(location.search).get("lang");
    const id = asked && LOCALE_IDS.find(l => l === asked || l.split("-")[0] === asked);
    if (id) store.set("idioma", id);
    const saved = store.get("idioma", null);
    return saved && LOCALES[saved] ? saved : null;
  } catch {
    return null; // no window (tests, build)
  }
}
const chosen = chosenLocale();
let locale = chosen ?? "pt-BR";
let messages: Messages = LOCALES[locale];
if (chosen && typeof document !== "undefined") document.documentElement.lang = locale;

/** Whether this device picked a locale (the language picker shows only then). */
export const localeChosen = () => chosen !== null;
/** Whether the project's own texts (chapter themes, book introductions, questions) exist in the locale. */
export const hasProjectTexts = () => locale === TEXTS_LOCALE;
/** The data folder of the locale's running text over the Bíblia Livre (dados/<it>/), or null in Portuguese. */
export const textLayer = () => (locale === TEXTS_LOCALE ? null : locale);
/** Saves the locale for this device and reloads the page in it. */
export function chooseLocale(next: string) {
  if (!LOCALES[next]) throw new Error(`i18n: unknown locale ${next}`);
  store.set("idioma", next);
  location.reload();
}

export const getLocale = () => locale;
export function setLocale(next: string) {
  if (!LOCALES[next]) throw new Error(`i18n: unknown locale ${next}`);
  locale = next;
  messages = LOCALES[next];
  found.clear();
  if (typeof document !== "undefined") document.documentElement.lang = next;
}

// keys already looked up (a chapter asks for the same morphology labels thousands of times)
const found = new Map<string, string | Messages | undefined>();
function lookup(key: string): string | Messages | undefined {
  if (found.has(key)) return found.get(key);
  let node: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (node === undefined || typeof node === "string") {
      node = undefined;
      break;
    }
    node = node[part];
  }
  found.set(key, node);
  return node;
}

const interpolate = (text: string, params?: Params) =>
  params ? text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m)) : text;

// A plural message is an object keyed by Intl.PluralRules categories ("one", "other"…), chosen by params.count
function resolve(key: string, params?: Params): string | undefined {
  const node = lookup(key);
  if (typeof node === "string") return interpolate(node, params);
  if (node && params && typeof params.count === "number") {
    const form = node[new Intl.PluralRules(locale).select(params.count)] ?? node.other;
    if (typeof form === "string") return interpolate(form, { ...params, count: formatNumber(params.count) });
  }
  return undefined;
}

/** The text for `key`; a missing key shows as the key itself, so it is easy to spot on screen. */
export function t(key: string, params?: Params): string {
  return resolve(key, params) ?? key;
}

/** The text for `key`, or undefined when the locale has none (for codes that may be unknown). */
export function tryT(key: string, params?: Params): string | undefined {
  return resolve(key, params);
}

export const formatNumber = (n: number, options?: Intl.NumberFormatOptions) => n.toLocaleString(locale, options);
export const formatDate = (d: Date | number, options?: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(locale, options);
