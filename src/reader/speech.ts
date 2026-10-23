// Reading aloud: the buttons, the word or verse being read and the mini player. The engine (system voices in
// the app, Web Speech in the browser) is src/lib/audio/tts.ts.
import { flushSync, mount } from "svelte";
import MiniPlayer from "../components/MiniPlayer.svelte";
import { t } from "../i18n";
import { createSpeech, type Speech, type VoiceId } from "../lib/audio/tts";
import { cleanHeb } from "../lib/text";
import { speech as speechState } from "../state/speech.svelte";
import { R, book, chapter, prefs, toast, vLabel } from "./context";
import { wordEl } from "./words";

let curBtn: HTMLElement | null = null,
  speakingEl: HTMLElement | null = null;

function updateVoiceNote(speech: Speech) {
  speechState.voiceNote = speech.voiceNote();
  speechState.canInstallVoices = speech.canInstallVoices();
}
export const tts = createSpeech(updateVoiceNote);

const hideOrig = () => document.body.classList.contains("hide-orig");

function setBtn(btn: HTMLElement | null) {
  if (curBtn) curBtn.classList.remove("on");
  curBtn = btn;
  if (btn) btn.classList.add("on");
  showState(!!btn, null);
}
function markSpeaking(el: HTMLElement | null) {
  if (speakingEl) speakingEl.classList.remove("speaking");
  speakingEl = el;
  showState(!!curBtn, el);
  if (el) {
    el.classList.add("speaking");
    el.scrollIntoView({ block: "nearest" });
  }
}
// the mini player and the Ouvir buttons follow src/state/speech.svelte.ts; the event stays for scripts that follow the audio
function showState(on: boolean, el: HTMLElement | null) {
  document.dispatchEvent(new CustomEvent("speech-state", { detail: { on, el } }));
  speechState.on = on;
  document.body.classList.toggle("tocando", on);
  const sec = el?.closest<HTMLElement>(".verse");
  if (on && sec && R.ch) {
    const v = R.ch.verses[+sec.dataset.vi!];
    const lang = t(hideOrig() ? "audio.language.pt" : R.greek ? "audio.language.el" : "audio.language.he");
    speechState.label = t("audio.reading", { ref: `${book().name} ${v ? vLabel(v) : R.cur}`, lang });
  }
  flushSync();
}

export function stopSpeech() {
  tts.stop();
  setBtn(null);
  markSpeaking(null);
}
const spokenOrig = (s: string) => (R.greek ? String(s).replace(/[^\p{L}\p{M}\s]/gu, "") : cleanHeb(s));

/** Reads the texts one after the other; the same button again stops. */
export function speak(texts: string[], btn: HTMLElement | null, onEach?: (i: number) => void, voice?: VoiceId) {
  if (!tts.available) return toast(tts.unavailableText());
  if (btn && btn === curBtn) return stopSpeech();
  stopSpeech();
  const spoken = voice === "pt" ? String : spokenOrig;
  setBtn(btn);
  const warning = tts.speak(texts.map(spoken), {
    voice: voice || (R.greek ? "el" : "he"),
    rate: prefs.slow ? 0.6 : 0.9,
    onEach,
    onEnd() {
      setBtn(null);
      markSpeaking(null);
    }
  });
  if (warning) toast(warning);
}

/** Bíblia Livre aloud (Bíblia mode, or the original hidden): verse by verse, in Portuguese. */
export function speakBlivre(from: number, btn: HTMLElement | null, one?: boolean) {
  const vs = chapter()
    .verses.slice(from, one ? from + 1 : undefined)
    .filter(v => v.blivre);
  speak(
    vs.map(v => v.blivre),
    btn,
    i => markSpeaking(document.getElementById("v" + vs[i].n)),
    "pt"
  );
}

export function speakVerse(vi: number, btn: HTMLElement | null) {
  if (hideOrig()) return speakBlivre(vi, btn, true);
  const words = chapter().verses[vi].words;
  if (!prefs.follow) return speak([words.map(w => w.heb).join(" ")], btn);
  speak(
    words.map(w => w.heb),
    btn,
    i => markSpeaking(wordEl(vi, i))
  );
}

/**
 * From the verse on screen to the end of the chapter: the original word by word (lighting each one) or, with
 * the original hidden, the Bíblia Livre. Pressing again stops.
 */
export function speakFrom(vi: number, btn: HTMLElement | null) {
  if (hideOrig()) return speakBlivre(vi, btn);
  const CH = chapter();
  const vs = CH.verses.slice(vi).filter(v => v.words.length);
  if (!vs.length) return speakBlivre(vi, btn);
  if (!prefs.follow)
    return speak(
      vs.map(v => v.words.map(w => w.heb).join(" ")),
      btn,
      i => markSpeaking(document.getElementById("v" + vs[i].n))
    );
  const seq: [number, number, string][] = [];
  for (const v of vs) {
    const k = CH.verses.indexOf(v);
    v.words.forEach((w, i) => seq.push([k, i, w.heb]));
  }
  speak(
    seq.map(s => s[2]),
    btn,
    i => markSpeaking(wordEl(seq[i][0], seq[i][1]))
  );
}

/** The mini player (phone: "Lendo João 3:16 · grego" above the bottom bar) and "Ouvir o capítulo". */
export function initSpeech() {
  mount(MiniPlayer, { target: document.body, props: { onstop: () => stopSpeech() } });
  document.getElementById("ch-say")!.addEventListener("click", e => speakBlivre(0, e.currentTarget as HTMLElement));
}
