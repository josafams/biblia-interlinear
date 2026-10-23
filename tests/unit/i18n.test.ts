import { expect, test } from "vitest";
import { formatNumber, t, tryT } from "../../src/i18n";
import ptBR from "../../src/i18n/locales/pt-BR.json";

test("t returns the text, or the key when it is missing", () => {
  expect(t("morph.verb")).toBe("verbo");
  expect(t("no.such.key")).toBe("no.such.key");
  expect(tryT("no.such.key")).toBeUndefined();
  expect(tryT("morph.he")).toBeUndefined(); // a group is not a text
});

test("numbers follow the locale", () => {
  expect(formatNumber(31102)).toBe("31.102");
});

test("every message of the automatic review resolves (the keys come from scripts/interlinear/review)", () => {
  const keys = Object.keys(ptBR.review);
  expect(keys.length).toBeGreaterThan(50);
  for (const k of keys) expect(tryT(`review.${k}`), k).toBe(ptBR.review[k as keyof typeof ptBR.review]);
});
