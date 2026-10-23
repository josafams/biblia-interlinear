// The reader's preferences: the switches of Aparência, the text size and the color theme. Each change is saved
// (localStorage, the same keys as always) and applied at once: body classes, the body's --k and the theme
// attributes of <html>, which the styles read.
import { type PrefId, PREFS, SIZES, THEMES, type ThemeId, bodyClasses, prefDef } from "../lib/prefs";
import { store } from "../lib/store";

export const prefs = $state({
  values: {} as Record<PrefId, boolean>,
  /** index in SIZES */
  size: 1,
  theme: "auto" as ThemeId,
  /** the theme on screen is dark (the device's when "auto") */
  dark: false
});

const darkDevice = typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: dark)") : null; // i18n-ignore

function apply(id: PrefId, on: boolean) {
  for (const [cls, present] of bodyClasses(prefDef(id)!, on)) document.body.classList.toggle(cls, present);
}

/** Reads what this device saved and applies it (once, when the reader starts). */
export function loadPrefs() {
  for (const def of PREFS) {
    const on = store.get(def.key, def.on ? "on" : "off") === "on";
    prefs.values[def.id] = on;
    apply(def.id, on);
  }
  setSize(Math.max(0, SIZES.indexOf(+store.get("tamanho", "1"))));
  setTheme(store.get("tema", "auto") as ThemeId);
  darkDevice?.addEventListener("change", () => {
    if (prefs.theme === "auto") setTheme("auto");
  });
}

/** Sets a switch; false when it already had that value. */
export function setPref(id: PrefId, on: boolean) {
  if (prefs.values[id] === on) return false;
  prefs.values[id] = on;
  store.set(prefDef(id)!.key, on ? "on" : "off");
  apply(id, on);
  return true;
}

export function setSize(index: number) {
  prefs.size = Math.min(SIZES.length - 1, Math.max(0, index));
  document.body.style.setProperty("--k", String(SIZES[prefs.size]));
  store.set("tamanho", String(SIZES[prefs.size]));
}

export function setTheme(id: ThemeId) {
  const theme = THEMES.find(t => t.id === id);
  prefs.theme = theme ? theme.id : "auto";
  const root = document.documentElement;
  if (theme) {
    root.setAttribute("data-palette", theme.id);
    // the last light and the last dark theme chosen
    store.set(theme.dark ? "tema-escuro" : "tema-claro", theme.id);
  } else root.removeAttribute("data-palette");
  store.set("tema", prefs.theme);
  prefs.dark = theme ? theme.dark : !!darkDevice?.matches;
  root.dataset.dark = String(prefs.dark);
}
