// Text to speech: the system voice engine in the app (Capacitor TextToSpeech plugin), the Web Speech API in
// the browser. One reading at a time; a new one (or stop) silences the previous. The screen parts (which button
// is on, which word is highlighted) stay with the caller, through onEach and onEnd.
import { t, textLayer } from "../../i18n";
import { nativePlugin, platform } from "../native";

export type VoiceId = "he" | "el" | "pt";
export type NativeTTS = {
  speak(o: { text: string; lang: string; rate: number; pitch: number; volume: number; category: string }): Promise<void>;
  stop(): Promise<void>;
  isLanguageSupported(o: { lang: string }): Promise<{ supported: boolean }>;
  openInstall?: () => Promise<void>;
};
type Voice = { codes: string[]; re: RegExp; lang: string; voice: SpeechSynthesisVoice | null; ok: boolean | null };
/** What the engine needs from the device; tests pass fakes. */
export type SpeechEnv = {
  native: NativeTTS | null;
  synth: SpeechSynthesis | null;
  Utterance: typeof SpeechSynthesisUtterance | null;
  wait: (ms: number) => Promise<void>;
};

export type Speech = ReturnType<typeof createSpeech>;

const deviceEnv = (): SpeechEnv => {
  const native = nativePlugin<NativeTTS>("TextToSpeech");
  const web = !native && typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  return {
    native,
    synth: web ? window.speechSynthesis : null,
    Utterance: web ? window.SpeechSynthesisUtterance : null,
    wait: ms => new Promise(r => setTimeout(r, ms))
  };
};

/** The pause between two words read one by one (a text with no space), and none between verses. */
export const WORD_GAP_MS = 120;
// the most a text may take before the next one starts anyway (Chrome sometimes never fires onend)
const longest = (text: string, rate: number) => 3000 + (text.length * 180) / Math.max(rate, 0.3);
// the app's engine starts a moment after the app: a check that fails is tried again, up to about 6 s
const RETRIES = [300, 600, 1200, 2000, 2000];

// onVoicesChanged runs whenever the voices of the device are known or change (the first time while this runs)
export function createSpeech(onVoicesChanged: (speech: Speech) => void, env: SpeechEnv = deviceEnv()) {
  const { native, synth, Utterance, wait } = env;
  const web = !!synth && !!Utterance;
  const voices: Record<VoiceId, Voice> = {
    he: { codes: ["he-IL", "iw-IL", "he"], re: /^(he|iw)([-_]|$)/i, lang: "he-IL", voice: null, ok: null },
    el: { codes: ["el-GR", "el"], re: /^el([-_]|$)/i, lang: "el-GR", voice: null, ok: null },
    // "pt" is the voice of the running text: Portuguese for the Bíblia Livre, English for the BSB
    pt:
      textLayer() === "en"
        ? { codes: ["en-US", "en-GB", "en"], re: /^en([-_]|$)/i, lang: "en-US", voice: null, ok: null }
        : { codes: ["pt-BR", "pt"], re: /^pt([-_]|$)/i, lang: "pt-BR", voice: null, ok: null }
  };
  const ids = Object.keys(voices) as VoiceId[];
  const system = t(platform === "ios" ? "audio.system.ios" : "audio.system.android");
  const langName = (id: VoiceId) => t(`audio.language.${id}`);
  let listed = 0; // voices the browser listed (0 while it is still loading them)
  let token: object | null = null;
  let checking: Promise<void> | null = null;

  function pickWebVoices() {
    const vs = synth!.getVoices();
    listed = vs.length;
    for (const id of ids) {
      const V = voices[id];
      V.voice = vs.find(v => V.re.test(v.lang) && v.localService) || vs.find(v => V.re.test(v.lang)) || null;
    }
    onVoicesChanged(speech);
  }

  /** true or false once the engine answered for one of the codes; null when it never answered (not started). */
  async function supported(V: Voice) {
    for (const delay of [0, ...RETRIES]) {
      if (delay) await wait(delay);
      let answered = false;
      for (const lang of V.codes) {
        try {
          const ok = !!(await native!.isLanguageSupported({ lang }))?.supported;
          answered = true;
          if (ok) {
            V.lang = lang;
            return true;
          }
        } catch {
          /* the engine is not ready yet, or this code is unknown */
        }
      }
      if (answered) return false;
    }
    return null;
  }
  function checkNativeVoices() {
    checking ??= (async () => {
      for (const id of ids) voices[id].ok = await supported(voices[id]);
      onVoicesChanged(speech);
    })().finally(() => (checking = null));
    return checking;
  }

  function voiceLine(id: VoiceId) {
    const V = voices[id],
      lang = langName(id);
    if (native)
      return V.ok === null
        ? t("audio.native.checking", { lang })
        : t(V.ok ? "audio.native.installed" : "audio.native.missing", { lang, system });
    if (!web) return null;
    if (V.voice) return t("audio.web.voice", { lang, voice: V.voice.name });
    return t(listed ? "audio.web.none" : "audio.web.searching", { lang });
  }

  // the app: one text after the other; a refusal while the engine starts is tried once more
  async function speakNative(texts: string[], V: Voice, id: VoiceId, o: SpeakOptions, mine: object, finish: () => void) {
    if (V.ok !== true) await checkNativeVoices();
    if (token !== mine) return;
    if (V.ok === false) o.onWarning?.(t("audio.missing_native", { lang: langName(id), system }));
    for (let i = 0; i < texts.length; i++) {
      if (token !== mine) return;
      o.onEach?.(i);
      const say = () => native!.speak({ text: texts[i], lang: V.lang, rate: o.rate, pitch: 1.0, volume: 1.0, category: "playback" });
      try {
        await say();
      } catch {
        if (token !== mine) return;
        await wait(RETRIES[1]);
        try {
          await say();
        } catch {
          break;
        }
      }
    }
    finish();
  }

  // the browser: one utterance at a time (a queue of hundreds of words runs them together in Chrome), with a
  // short pause between single words and a time limit in case onend never comes
  function speakWeb(texts: string[], V: Voice, o: SpeakOptions, mine: object, finish: () => void) {
    const next = (i: number) => {
      if (token !== mine) return;
      if (i >= texts.length) return finish();
      const u = new Utterance!(texts[i]);
      u.lang = V.voice ? V.voice.lang : V.lang;
      if (V.voice) u.voice = V.voice;
      u.rate = o.rate;
      let done = false;
      const limit = setTimeout(() => end(), longest(texts[i], o.rate));
      const end = () => {
        if (done) return;
        done = true;
        clearTimeout(limit);
        if (token !== mine) return;
        const single = !/\s/.test(texts[i].trim());
        if (single && i + 1 < texts.length) wait(WORD_GAP_MS).then(() => next(i + 1));
        else next(i + 1);
      };
      u.onstart = () => {
        if (token === mine) o.onEach?.(i);
      };
      u.onend = u.onerror = end;
      synth!.speak(u);
    };
    next(0);
  }

  type SpeakOptions = { voice: VoiceId; rate: number; onEach?: (i: number) => void; onEnd: () => void; onWarning?: (text: string) => void };

  const speech = {
    available: !!native || web,
    unavailableText: () => t("audio.unavailable"),
    /** The note in Aparência › Áudio: which voices this device has. */
    voiceNote() {
      if (!speech.available) return t("audio.unavailable");
      const where = platform === "ios" ? t("audio.ios_settings") : ".";
      return [...ids.map(voiceLine).filter(Boolean), t("audio.modern_note", { where })].join(" ");
    },
    /** Android only: a button that opens the system screen to install voices. */
    canInstallVoices: () => !!native && platform === "android" && ids.some(id => voices[id].ok === false),
    openInstall: () => (native?.openInstall ? native.openInstall() : Promise.resolve()),
    /** The app's voices again (after installing one in the system settings). */
    recheck: () => (native ? checkNativeVoices() : Promise.resolve()),

    stop() {
      token = null;
      if (native) native.stop().catch(() => {});
      else if (web) synth!.cancel();
    },
    /**
     * Reads the texts one after another. onEach(i) runs as text i starts; onEnd when the reading ends by itself
     * (not when stopped or replaced). Returns a warning to show when this device lacks the voice (in the app the
     * check may still be running: that warning comes later, through onWarning).
     */
    speak(texts: string[], o: SpeakOptions) {
      speech.stop();
      const V = voices[o.voice],
        mine = {};
      token = mine;
      const finish = () => {
        if (token === mine) {
          token = null;
          o.onEnd();
        }
      };
      if (native) {
        speakNative(texts, V, o.voice, o, mine, finish);
        return null;
      }
      if (!V.voice) pickWebVoices();
      speakWeb(texts, V, o, mine, finish);
      // only when the browser already listed its voices and none is of this language
      return V.voice || !listed ? null : t("audio.missing_web", { lang: langName(o.voice) });
    }
  };

  if (native) {
    onVoicesChanged(speech);
    checkNativeVoices();
    // back from the system settings (a voice installed): check again
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkNativeVoices());
  } else if (web) {
    pickWebVoices();
    synth!.onvoiceschanged = pickWebVoices;
  } else onVoicesChanged(speech);
  return speech;
}
