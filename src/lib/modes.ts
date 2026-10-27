// Reading modes: each one is a set of values for the "O que mostrar" switches (the ids of the switches
// in ler.html). Changing a switch by hand turns the mode into "personalizado", based on the mode it came from.
// The ids are saved on devices and in Google Drive (preferences sync), so they stay in Portuguese.
import { t } from "../i18n";

export type ModeId = "biblia" | "original" | "paralelo" | "interlinear" | "estudo" | "personalizado";
export type SwitchId =
  | "t-orig"
  | "t-cards"
  | "t-blivre"
  | "t-par"
  | "t-xlit"
  | "t-pron"
  | "t-gloss"
  | "t-strong"
  | "t-morf"
  | "t-vnum"
  | "t-theme"
  | "t-about"
  | "t-lexicon"
  | "t-marks"
  | "t-questions";
export type Switches = Partial<Record<SwitchId, 0 | 1>>;

export type Mode = { id: ModeId; name: string; description: string; spoken: string; switches: Switches };

// in the order they are applied, as before (some switches react to others)
const SWITCHES: Record<ModeId, Switches> = {
  biblia: {
    "t-orig": 0,
    "t-blivre": 1,
    "t-par": 1,
    "t-vnum": 1,
    "t-theme": 1,
    "t-about": 1,
    // reading the Portuguese text only: the list of the original words of the chapter is for the other modes
    "t-lexicon": 0,
    "t-marks": 0,
    "t-questions": 1
  },
  original: {
    "t-orig": 1,
    "t-cards": 0,
    "t-blivre": 0,
    "t-par": 0,
    "t-vnum": 1,
    "t-theme": 1,
    "t-about": 1,
    "t-lexicon": 1,
    "t-marks": 0,
    "t-questions": 0
  },
  paralelo: {
    "t-orig": 1,
    "t-cards": 0,
    "t-blivre": 1,
    "t-par": 0,
    "t-vnum": 1,
    "t-theme": 1,
    "t-about": 1,
    "t-lexicon": 1,
    "t-marks": 0,
    "t-questions": 1
  },
  interlinear: {
    "t-orig": 1,
    "t-cards": 1,
    "t-blivre": 1,
    "t-par": 0,
    "t-xlit": 1,
    "t-pron": 0,
    "t-gloss": 1,
    "t-strong": 0,
    "t-morf": 0,
    "t-vnum": 1,
    "t-theme": 1,
    "t-about": 1,
    "t-lexicon": 1,
    "t-marks": 1,
    "t-questions": 1
  },
  estudo: {
    "t-orig": 1,
    "t-cards": 1,
    "t-blivre": 1,
    "t-par": 0,
    "t-xlit": 1,
    "t-pron": 1,
    "t-gloss": 1,
    "t-strong": 1,
    "t-morf": 1,
    "t-vnum": 1,
    "t-theme": 1,
    "t-about": 1,
    "t-lexicon": 1,
    "t-marks": 1,
    "t-questions": 1
  },
  personalizado: {}
};

export const MODE_IDS = Object.keys(SWITCHES) as ModeId[];
/** The four modes of the selector (as in the design); "paralelo" and "personalizado" still apply when chosen otherwise. */
export const MODE_MENU: ModeId[] = ["biblia", "original", "interlinear", "estudo"];

export const isModeId = (id: unknown): id is ModeId => MODE_IDS.includes(id as ModeId);

export function getMode(id: string | null | undefined): Mode | undefined {
  if (!isModeId(id)) return undefined;
  return {
    id,
    name: t(`modes.${id}.name`),
    description: t(`modes.${id}.description`),
    spoken: t(`modes.${id}.spoken`),
    switches: SWITCHES[id]
  };
}

/** The explanation under the selector; "personalizado" names the mode it came from. */
export function modeHint(id: ModeId, base: ModeId | null) {
  const from = id === "personalizado" ? getMode(base) : undefined;
  if (from) return t("modes.personalizado.hint_from", { mode: from.name });
  return id === "personalizado" ? "" : t(`modes.${id}.hint`);
}

/** The line above the chapter title: what the text on screen is. */
export function eyebrowText(o: { original: boolean; running: boolean; greek: boolean }) {
  if (!o.original) return t("modes.eyebrow.blivre");
  const lang = t(o.greek ? "modes.eyebrow.greek" : "modes.eyebrow.hebrew");
  return t(o.running ? "modes.eyebrow.running" : "modes.eyebrow.interlinear", { lang });
}

export const swapLabel = (mode: Mode) => t("modes.swap_label", { mode: mode.name });
