import { expect, test } from "vitest";
import { MODE_IDS, getMode } from "../../src/lib/modes";
import { PREFS, bodyClasses, prefDef } from "../../src/lib/prefs";

test("every switch has its own id and saved key", () => {
  expect(new Set(PREFS.map(p => p.id)).size).toBe(PREFS.length);
  expect(new Set(PREFS.map(p => p.key)).size).toBe(PREFS.length);
});

test("the reading modes only set switches marked as part of a mode", () => {
  for (const id of MODE_IDS) for (const sw of Object.keys(getMode(id)!.switches)) expect(prefDef(sw)?.inMode, `${id}: ${sw}`).toBe(true);
});

test("body classes the styles read", () => {
  expect(bodyClasses(prefDef("t-orig")!, false)).toEqual([["hide-orig", true]]);
  expect(bodyClasses(prefDef("t-cards")!, false)).toEqual([["orig-running", true]]);
  expect(bodyClasses(prefDef("t-pron")!, true)).toEqual([["show-pron", true]]);
  expect(bodyClasses(prefDef("t-follow")!, true)).toEqual([]);
});

test("the saved keys stay as they were on people's devices", () => {
  expect(Object.fromEntries(PREFS.filter(p => p.key !== p.id).map(p => [p.id, p.key]))).toEqual({
    "t-pron": "pronuncia",
    "t-ann": "anotacoes",
    "t-easy": "fonte-facil",
    "t-space": "espacamento",
    "t-cant": "cantilacao",
    "t-foco": "foco",
    "t-follow": "acompanhar",
    "t-slow": "voz-lenta"
  });
});
