import { afterEach, describe, expect, test, vi } from "vitest";
import { createSpeech, type NativeTTS, type SpeechEnv } from "../../src/lib/audio/tts";

// a Web Speech API that "speaks" synchronously and records what it was asked
function fakeSpeech(voices: Partial<SpeechSynthesisVoice>[]) {
  const spoken: { text: string; lang: string; rate: number }[] = [];
  class Utterance {
    lang = "";
    rate = 1;
    voice: unknown = null;
    onstart?: () => void;
    onend?: () => void;
    onerror?: () => void;
    constructor(public text: string) {}
  }
  const synth = {
    getVoices: () => voices,
    cancel: vi.fn(),
    onvoiceschanged: null,
    speak(u: Utterance) {
      spoken.push({ text: u.text, lang: u.lang, rate: u.rate });
      u.onstart?.();
      u.onend?.();
    }
  };
  vi.stubGlobal("window", { speechSynthesis: synth, SpeechSynthesisUtterance: Utterance });
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  return { spoken, synth };
}

async function load() {
  vi.resetModules();
  return import("../../src/lib/audio/tts");
}

afterEach(() => vi.unstubAllGlobals());

describe("createSpeech in the browser", () => {
  test("reads each text with the voice of its language, then ends", async () => {
    const { spoken } = fakeSpeech([{ lang: "he-IL", name: "Carmit", localService: true }]);
    const { createSpeech } = await load();
    const tts = createSpeech(() => {});
    const each: number[] = [];
    const onEnd = vi.fn();
    const warning = tts.speak(["א", "ב"], { voice: "he", rate: 0.9, onEach: i => each.push(i), onEnd });
    expect(warning).toBeNull();
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled());
    expect(spoken).toEqual([
      { text: "א", lang: "he-IL", rate: 0.9 },
      { text: "ב", lang: "he-IL", rate: 0.9 }
    ]);
    expect(each).toEqual([0, 1]);
    expect(onEnd).toHaveBeenCalledOnce();
  });

  test("warns when the device has no voice for the language", async () => {
    fakeSpeech([{ lang: "en-US", name: "Alex", localService: true }]);
    const { createSpeech } = await load();
    const tts = createSpeech(() => {});
    expect(tts.speak(["λόγος"], { voice: "el", rate: 0.9, onEnd: () => {} })).toBe(
      "Este aparelho pode não ter voz em grego. Veja em Aparência › Áudio."
    );
  });

  test("the voice note lists the voices found", async () => {
    fakeSpeech([{ lang: "pt-BR", name: "Luciana", localService: true }]);
    const { createSpeech } = await load();
    const notes: string[] = [];
    createSpeech(s => notes.push(s.voiceNote()));
    expect(notes[0]).toMatch(
      /^Nenhuma voz em hebraico neste aparelho\. Nenhuma voz em grego neste aparelho\. Voz em português: Luciana\. A pronúncia/
    );
  });
});

test("without speech the reader says so", async () => {
  vi.stubGlobal("window", {});
  const { createSpeech } = await load();
  const tts = createSpeech(() => {});
  expect(tts.available).toBe(false);
  expect(tts.voiceNote()).toMatch(/^Este navegador não tem leitura de voz/);
});

// ---- a fake browser passed as the device: speechSynthesis that keeps what it was given and lets the test end each utterance
class FakeUtterance {
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}
function browser(voices: { lang: string; name: string; localService: boolean }[]) {
  const spoken: FakeUtterance[] = [];
  const synth = {
    getVoices: () => voices,
    speak: (u: FakeUtterance) => {
      spoken.push(u);
      u.onstart?.();
    },
    cancel: vi.fn(),
    onvoiceschanged: null
  };
  const env: SpeechEnv = {
    native: null,
    synth: synth as unknown as SpeechSynthesis,
    Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance,
    wait: () => Promise.resolve()
  };
  return { env, spoken };
}
const GREEK = [{ lang: "el-GR", name: "Stefanos", localService: true }];
const flush = () => new Promise(r => setTimeout(r, 0));

test("browser: one utterance at a time, the next after the end of the previous", async () => {
  const { env, spoken } = browser(GREEK);
  const s = createSpeech(() => {}, env);
  const each: number[] = [],
    end = vi.fn();
  const warning = s.speak(["Ἐν", "ἀρχῇ", "ἦν"], { voice: "el", rate: 0.9, onEach: i => each.push(i), onEnd: end });
  expect(warning).toBeNull();
  expect(spoken.map(u => u.text)).toEqual(["Ἐν"]); // not the whole queue at once
  spoken[0].onend!();
  await flush();
  expect(spoken.map(u => u.text)).toEqual(["Ἐν", "ἀρχῇ"]);
  spoken[1].onend!();
  await flush();
  spoken[2].onend!();
  await flush();
  expect(each).toEqual([0, 1, 2]);
  expect(end).toHaveBeenCalledOnce();
  expect(spoken[0].lang).toBe("el-GR");
});

test("browser: stopping in the middle speaks nothing more and does not end by itself", async () => {
  const { env, spoken } = browser(GREEK);
  const s = createSpeech(() => {}, env);
  const end = vi.fn();
  s.speak(["a", "b"], { voice: "el", rate: 1, onEnd: end });
  s.stop();
  spoken[0].onend!();
  await flush();
  expect(spoken).toHaveLength(1);
  expect(end).not.toHaveBeenCalled();
});

test("browser: an onend that never comes does not hold the reading", async () => {
  vi.useFakeTimers();
  const { env, spoken } = browser(GREEK);
  const s = createSpeech(() => {}, env);
  s.speak(["um", "dois"], { voice: "el", rate: 1, onEnd: () => {} });
  await vi.advanceTimersByTimeAsync(10000);
  expect(spoken.map(u => u.text)).toEqual(["um", "dois"]);
  vi.useRealTimers();
});

test("browser: no warning while the voices are still loading; a warning once they are listed without Greek", () => {
  const loading = browser([]);
  expect(createSpeech(() => {}, loading.env).speak(["λόγος"], { voice: "el", rate: 1, onEnd: () => {} })).toBeNull();
  const noGreek = browser([{ lang: "pt-BR", name: "Luciana", localService: true }]);
  expect(createSpeech(() => {}, noGreek.env).speak(["λόγος"], { voice: "el", rate: 1, onEnd: () => {} })).toMatch(/grego/);
});

// ---- the app: the engine starts after the app and answers only then
function app(answers: (lang: string, call: number) => boolean | "not-ready") {
  let call = 0;
  const said: string[] = [];
  const native: NativeTTS = {
    async isLanguageSupported({ lang }) {
      const a = answers(lang, call++);
      if (a === "not-ready") throw new Error("Not yet initialized or not available on this device.");
      return { supported: a };
    },
    async speak({ text }) {
      said.push(text);
    },
    async stop() {}
  };
  const env: SpeechEnv = { native, synth: null, Utterance: null, wait: () => Promise.resolve() };
  return { env, said };
}

test("app: an engine that is still starting is asked again; the voice is there and no warning shows", async () => {
  const { env, said } = app((_lang, call) => (call < 6 ? "not-ready" : true));
  const warn = vi.fn(),
    end = vi.fn();
  const s = createSpeech(() => {}, env);
  s.speak(["λόγος"], { voice: "el", rate: 0.9, onEnd: end, onWarning: warn });
  await vi.waitFor(() => expect(end).toHaveBeenCalled());
  expect(said).toEqual(["λόγος"]);
  expect(warn).not.toHaveBeenCalled();
  expect(s.voiceNote()).not.toMatch(/não tem|instale/i);
});

test("app: a voice the engine says it does not have shows the warning", async () => {
  const { env } = app(lang => !lang.startsWith("el"));
  const warn = vi.fn(),
    end = vi.fn();
  const s = createSpeech(() => {}, env);
  s.speak(["λόγος"], { voice: "el", rate: 0.9, onEnd: end, onWarning: warn });
  await vi.waitFor(() => expect(end).toHaveBeenCalled());
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/grego/));
});
