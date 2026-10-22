import { expect, test } from "vitest";
import { formatNumber, t, tryT } from "../../src/i18n";

test("t returns the text, or the key when it is missing", () => {
  expect(t("morph.verb")).toBe("verbo");
  expect(t("no.such.key")).toBe("no.such.key");
  expect(tryT("no.such.key")).toBeUndefined();
  expect(tryT("morph.he")).toBeUndefined(); // a group is not a text
});

test("numbers follow the locale", () => {
  expect(formatNumber(31102)).toBe("31.102");
});
