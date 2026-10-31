import { expect, test } from "vitest";
import { pronunciationRules, stressedSyllables } from "../../src/lib/pronunciation";

test("the stressed syllable is the one in capitals", () => {
  expect(stressedSyllables("mo-CHÉ")).toEqual(["CHÉ"]);
  expect(stressedSyllables("É-rets")).toEqual(["É"]);
  expect(stressedSyllables("a-BÊL mits-RA-im")).toEqual(["BÊL", "RA"]);
  expect(stressedSyllables("she")).toEqual([]);
});

test("only the spellings the word uses", () => {
  expect(pronunciationRules("mo-CHÉ")).toEqual(["ch"]);
  expect(pronunciationRules("e-lo-HIM")).toEqual(["h"]);
  expect(pronunciationRules("a-NER-rro-mai")).toEqual(["rr"]);
  expect(pronunciationRules("ka-taf-THEI-rô")).toEqual(["th"]);
  expect(pronunciationRules("LO-gos")).toEqual([]);
});

test("the h of ch, th, sh, ph and kh is not an h of its own", () => {
  expect(pronunciationRules("the-OS")).toEqual(["th"]);
  expect(pronunciationRules("she")).toEqual([]);
  expect(pronunciationRules("hêt-TA-ô")).toEqual(["h"]);
  expect(pronunciationRules("ha-CHAG")).toEqual(["h", "ch"]);
});
