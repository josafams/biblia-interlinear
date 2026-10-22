import { expect, test } from "vitest";
import { MODE_IDS, MODE_MENU, eyebrowText, getMode, isModeId, modeHint, swapLabel } from "../../src/lib/modes";

test("every mode has its texts in the locale", () => {
  for (const id of MODE_IDS) {
    const m = getMode(id)!;
    for (const text of [m.name, m.description, m.spoken]) expect(text).not.toMatch(/^modes\./);
  }
  expect(MODE_MENU.every(isModeId)).toBe(true);
  expect(getMode("nope")).toBeUndefined();
});

test("Study adds Strong, pronunciation and grammar to Interlinear", () => {
  const diff = Object.entries(getMode("estudo")!.switches).filter(([k, v]) => getMode("interlinear")!.switches[k as never] !== v);
  expect(Object.fromEntries(diff)).toEqual({ "t-pron": 1, "t-strong": 1, "t-morf": 1 });
});

test("hints, the custom mode and the swap button", () => {
  expect(modeHint("original", null)).toMatch(/^Hebraico ou grego corrido/);
  expect(modeHint("personalizado", "estudo")).toBe("Personalizado a partir do modo Estudo. Toque num modo para voltar ao padrão dele.");
  expect(modeHint("personalizado", null)).toBe("");
  expect(swapLabel(getMode("biblia")!)).toBe("Trocar para o modo Bíblia");
});

test("eyebrow", () => {
  expect(eyebrowText({ original: false, running: false, greek: false })).toBe("Bíblia Livre");
  expect(eyebrowText({ original: true, running: true, greek: true })).toBe("Texto grego");
  expect(eyebrowText({ original: true, running: false, greek: false })).toBe("Interlinear hebraico · português");
});
