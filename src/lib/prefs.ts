// The switches of Aparência: what each one is called in localStorage (saved on devices, so in Portuguese),
// its default, the body class the styles read and whether reading modes set it. Order as on screen.
import type { SwitchId } from "./modes";

export type PrefId = SwitchId | "t-ann" | "t-easy" | "t-space" | "t-cant" | "t-foco" | "t-follow" | "t-slow";
export type PrefGroup = "show" | "text" | "audio";
export type PrefDef = {
  id: PrefId;
  /** localStorage key under "interlinear:" (value "on" or "off") */
  key: string;
  on: boolean;
  /** body class when on / when off (the styles read them) */
  onClass?: string;
  offClass?: string;
  /** reading modes set it; changing it by hand turns the mode into "personalizado" */
  inMode?: boolean;
  group: PrefGroup;
};

const show = (id: PrefId, key: string, on: boolean, cls: { on?: string; off?: string }, inMode = true): PrefDef => ({
  id,
  key,
  on,
  onClass: cls.on,
  offClass: cls.off,
  inMode,
  group: "show"
});

export const PREFS: PrefDef[] = [
  show("t-xlit", "t-xlit", true, { off: "hide-xlit" }),
  show("t-gloss", "t-gloss", true, { off: "hide-gloss" }),
  show("t-pron", "pronuncia", false, { on: "show-pron" }),
  show("t-strong", "t-strong", false, { off: "hide-strong" }),
  show("t-morf", "t-morf", false, { on: "show-morf" }),
  show("t-blivre", "t-blivre", true, { off: "hide-blivre" }),
  show("t-vnum", "t-vnum", true, { off: "hide-vnum" }),
  show("t-theme", "t-theme", true, { off: "hide-theme" }),
  show("t-questions", "t-questions", true, { off: "hide-questions" }),
  show("t-marks", "t-marks", true, { off: "hide-marks" }),
  show("t-ann", "anotacoes", true, { off: "hide-ann" }, false),
  show("t-orig", "t-orig", true, { off: "hide-orig" }),
  show("t-cards", "t-cards", true, { off: "orig-running" }),
  show("t-par", "t-par", false, { on: "blivre-par" }),
  show("t-about", "t-about", true, { off: "hide-about" }),
  show("t-lexicon", "t-lexicon", true, { off: "hide-lexicon" }),
  { id: "t-easy", key: "fonte-facil", on: false, onClass: "font-easy", group: "text" },
  { id: "t-space", key: "espacamento", on: false, onClass: "spacious", group: "text" },
  { id: "t-cant", key: "cantilacao", on: true, offClass: "no-cant", group: "text" },
  { id: "t-foco", key: "foco", on: false, onClass: "foco", group: "text" },
  { id: "t-follow", key: "acompanhar", on: true, group: "audio" },
  { id: "t-slow", key: "voz-lenta", on: false, group: "audio" }
];
export const PREF_IDS = PREFS.map(p => p.id);
export const prefDef = (id: string) => PREFS.find(p => p.id === id);

/** The body classes for one switch: [class, present]. */
export function bodyClasses(def: PrefDef, on: boolean): [string, boolean][] {
  const out: [string, boolean][] = [];
  if (def.onClass) out.push([def.onClass, on]);
  if (def.offClass) out.push([def.offClass, !on]);
  return out;
}

/** Text sizes of the Texto group (the body's --k). */
export const SIZES = [0.85, 1, 1.15, 1.3, 1.5, 1.75];

/** Color themes; "auto" follows the device. bg/fg/ac only draw the preview of each card. */
export const THEMES = [
  { id: "claro", dark: false, bg: "#f8f9f6", fg: "#1b2220", ac: "#1d5b74" },
  { id: "papel", dark: false, bg: "#faf6ef", fg: "#2b241c", ac: "#7d4a2e" },
  { id: "oliva", dark: false, bg: "#f5f7f0", fg: "#1f241a", ac: "#4f6b2a" },
  { id: "escuro", dark: true, bg: "#1a201e", fg: "#e3e9e5", ac: "#7cc0d8" },
  { id: "noite", dark: true, bg: "#152031", fg: "#e3e8f1", ac: "#e0b66a" },
  { id: "grafite", dark: true, bg: "#000000", fg: "#ececec", ac: "#a5c8ff" }
] as const;
export type ThemeId = (typeof THEMES)[number]["id"] | "auto";
