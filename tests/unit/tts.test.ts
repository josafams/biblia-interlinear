import { afterEach, describe, expect, test, vi } from "vitest";

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
