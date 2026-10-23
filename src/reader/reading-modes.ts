// Reading modes: each mode is a set of values for the switches of Aparência marked inMode (src/lib/modes.ts).
// Changing one of them by hand turns the mode into "Personalizado" (from the mode it came from). With an
// account the mode is the same on every device (web/sync.js reads and applies it through __preferencias).
import { flushSync, mount } from "svelte";
import ModeSelector from "../components/ModeSelector.svelte";
import Welcome from "../components/Welcome.svelte";
import { MODE_IDS, type ModeId, eyebrowText as eyebrowFor, getMode, isModeId } from "../lib/modes";
import { PREFS, type PrefDef, type PrefId } from "../lib/prefs";
import { store } from "../lib/store";
import { prefs as prefsState, setPref } from "../state/prefs.svelte";
import { reader as readerState } from "../state/reader.svelte";
import { R } from "./context";
import { activeWord, redrawn } from "./entry";
import { renderVerses } from "./chapter";
import { stopSpeech } from "./speech";
import { focusWord, wordEl } from "./words";

const MODES = MODE_IDS.map(id => getMode(id)!);
let mode = store.get("modo", "");
let baseMode = store.get("modo-base", "interlinear");
let previousMode = store.get("modo-anterior", "");

export function eyebrowText() {
  const v = prefsState.values;
  return eyebrowFor({ original: v["t-orig"], running: !v["t-cards"], greek: R.greek });
}

// switches that change how the text is drawn: cantillation draws it again, keeping the word open and the focus
const ON_CHANGE: Partial<Record<PrefId, () => void>> = {
  "t-cant": () => {
    stopSpeech();
    const focused = (document.activeElement as HTMLElement | null)?.closest?.<HTMLElement>(".word");
    const keep = activeWord();
    renderVerses();
    redrawn(keep);
    if (focused) focusWord(wordEl(focused.dataset.v!, focused.dataset.i!));
  }
};
function setSwitch(id: PrefId, on: boolean) {
  if (setPref(id, !!on)) ON_CHANGE[id]?.();
}

function showMode() {
  const current = mode || "interlinear";
  readerState.mode = isModeId(current) ? current : "interlinear";
  readerState.baseMode = isModeId(baseMode) ? baseMode : "interlinear";
  flushSync();
  readerState.previousMode = isModeId(previousMode) ? previousMode : "";
  if (R.ch) readerState.eyebrow = eyebrowText();
  flushSync();
}

/** A switch pressed by hand; one of the reading mode turns the mode into "personalizado". */
export function togglePref(def: PrefDef) {
  const on = !prefsState.values[def.id];
  setPref(def.id, on);
  ON_CHANGE[def.id]?.();
  if (!def.inMode) return;
  if (mode !== "personalizado") {
    if (mode) {
      baseMode = mode;
      store.set("modo-base", mode);
    }
    mode = "personalizado";
    store.set("modo", mode);
  }
  showMode();
  document.dispatchEvent(new CustomEvent("preferences-changed"));
}

export function applyMode(id: ModeId, manual = true) {
  const m = MODES.find(x => x.id === id);
  if (!m) return;
  if (manual && mode && mode !== id && mode !== "personalizado") {
    previousMode = mode;
    store.set("modo-anterior", mode);
  }
  if (id !== "personalizado") {
    for (const [k, on] of Object.entries(m.switches)) setSwitch(k as PrefId, !!on);
    baseMode = id;
    store.set("modo-base", id);
  }
  mode = id;
  store.set("modo", id);
  if (manual) document.dispatchEvent(new CustomEvent("preferences-changed"));
  readerState.welcome = false;
  document.querySelectorAll(".verse.abrir").forEach(v => v.classList.remove("abrir"));
  showMode();
}

type SyncedPrefs = { modo: string; modo_base?: string; listItems?: Record<string, boolean> };

export function initModes() {
  // the selector of the top bar; the one of Aparência and the note under it follow readerState too
  mount(ModeSelector, { target: document.getElementById("bar-modes")!, props: { variant: "bar", onselect: applyMode } });
  // the reading preferences for the sync (web/sync.js): the mode and the items shown
  window.__preferencias = {
    readStorage(): SyncedPrefs {
      const sw: Record<string, boolean> = {};
      for (const def of PREFS) if (def.inMode) sw[def.id] = !!prefsState.values[def.id];
      return { modo: mode || "interlinear", modo_base: baseMode, listItems: sw };
    },
    applyChanges(p: SyncedPrefs | null) {
      if (!p || (!MODES.some(m => m.id === p.modo) && p.modo !== "personalizado")) return;
      for (const [k, on] of Object.entries(p.listItems || {})) setSwitch(k as PrefId, !!on);
      if (p.modo_base && MODES.some(m => m.id === p.modo_base)) {
        baseMode = p.modo_base;
        store.set("modo-base", baseMode);
      }
      mode = p.modo;
      store.set("modo", mode);
      readerState.welcome = false;
      showMode();
    }
  };
  // first opening: how the person wants to read (whoever already used it stays in Interlinear, as before)
  readerState.welcome = !mode && store.get("posicao", "") === "";
  mount(Welcome, {
    target: document.querySelector("#page > header")!,
    props: {
      onpick(id: "biblia" | "original" | "interlinear" | "") {
        readerState.welcome = false;
        if (id) return applyMode(id, false);
        mode = "interlinear";
        store.set("modo", mode);
        showMode();
      }
    }
  });
  showMode();
}
