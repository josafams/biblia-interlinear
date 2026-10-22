// Text to speech: the system voice engine in the app (Capacitor TextToSpeech plugin), the Web Speech API in
// the browser. One reading at a time; a new one (or stop) silences the previous. The screen parts (which button
// is on, which word is highlighted) stay with the caller, through onEach and onEnd.
import { t } from "../../i18n";
import { nativePlugin, platform } from "../native";

export type VoiceId = "he" | "el" | "pt";
type NativeTTS = {
  speak(o: { text: string; lang: string; rate: number; pitch: number; volume: number; category: string }): Promise<void>;
  stop(): Promise<void>;
  isLanguageSupported(o: { lang: string }): Promise<{ supported: boolean }>;
  openInstall?: () => Promise<void>;
};
type Voice = { codes: string[]; re: RegExp; lang: string; voice: SpeechSynthesisVoice | null; ok: boolean | null };

export type Speech = ReturnType<typeof createSpeech>;

// onVoicesChanged runs whenever the voices of the device are known or change (the first time while this runs)
export function createSpeech(onVoicesChanged: (speech: Speech) => void) {
  const native = nativePlugin<NativeTTS>("TextToSpeech");
  const web = !native && typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  const voices: Record<VoiceId, Voice> = {
    he: { codes: ["he-IL", "iw-IL", "he"], re: /^(he|iw)([-_]|$)/i, lang: "he-IL", voice: null, ok: null },
    el: { codes: ["el-GR", "el"], re: /^el([-_]|$)/i, lang: "el-GR", voice: null, ok: null },
    pt: { codes: ["pt-BR", "pt"], re: /^pt([-_]|$)/i, lang: "pt-BR", voice: null, ok: null }
  };
  const ids = Object.keys(voices) as VoiceId[];
  const system = t(platform === "ios" ? "audio.system.ios" : "audio.system.android");
  const langName = (id: VoiceId) => t(`audio.language.${id}`);
  let listed = 0; // voices the browser listed (0 while it is still loading them)
  let token: object | null = null;

  function pickWebVoices() {
    const vs = speechSynthesis.getVoices();
    listed = vs.length;
    for (const id of ids) {
      const V = voices[id];
      V.voice = vs.find(v => V.re.test(v.lang) && v.localService) || vs.find(v => V.re.test(v.lang)) || null;
    }
    onVoicesChanged(speech);
  }
  async function checkNativeVoices() {
    for (const id of ids) {
      const V = voices[id];
      V.ok = false;
      for (const lang of V.codes) {
        try {
          if ((await native!.isLanguageSupported({ lang }))?.supported) {
            V.lang = lang;
            V.ok = true;
            break;
          }
        } catch {
          /* this code is not known: try the next */
        }
      }
    }
    onVoicesChanged(speech);
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

    stop() {
      token = null;
      if (native) native.stop().catch(() => {});
      else if (web) speechSynthesis.cancel();
    },
    /**
     * Reads the texts one after another. onEach(i) runs as text i starts; onEnd when the reading ends by itself
     * (not when stopped or replaced). Returns a warning to show when this device may lack the voice.
     */
    speak(texts: string[], o: { voice: VoiceId; rate: number; onEach?: (i: number) => void; onEnd: () => void }) {
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
        (async () => {
          for (let i = 0; i < texts.length; i++) {
            if (token !== mine) return;
            o.onEach?.(i);
            try {
              await native.speak({ text: texts[i], lang: V.lang, rate: o.rate, pitch: 1.0, volume: 1.0, category: "playback" });
            } catch {
              break;
            }
          }
          finish();
        })();
        return V.ok === false ? t("audio.missing_native", { lang: langName(o.voice), system }) : null;
      }
      texts.forEach((text, i) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = V.voice ? V.voice.lang : V.lang;
        if (V.voice) u.voice = V.voice;
        u.rate = o.rate;
        u.onstart = () => {
          if (token === mine) o.onEach?.(i);
        };
        u.onend = u.onerror = () => {
          if (i === texts.length - 1) finish();
        };
        speechSynthesis.speak(u);
      });
      return V.voice ? null : t("audio.missing_web", { lang: langName(o.voice) });
    }
  };

  if (native) {
    onVoicesChanged(speech);
    checkNativeVoices();
  } else if (web) {
    pickWebVoices();
    speechSynthesis.onvoiceschanged = pickWebVoices;
  } else onVoicesChanged(speech);
  return speech;
}
