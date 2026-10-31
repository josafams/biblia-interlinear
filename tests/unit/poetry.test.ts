import { expect, test } from "vitest";
import { isPoetic } from "../../src/lib/chapter/poetry";

test("psalms, proverbs, song and lamentations are poetry throughout", () => {
  for (const [b, c] of [
    ["PSA", 1],
    ["PSA", 119],
    ["PRO", 31],
    ["SNG", 8],
    ["LAM", 5]
  ] as const)
    expect(isPoetic(b, c)).toBe(true);
});

test("Job is poetry only between its prose prologue and epilogue", () => {
  expect(isPoetic("JOB", 1)).toBe(false);
  expect(isPoetic("JOB", 2)).toBe(false);
  expect(isPoetic("JOB", 3)).toBe(true);
  expect(isPoetic("JOB", 41)).toBe(true);
  expect(isPoetic("JOB", 42)).toBe(false);
});

test("narrative, law, prophets and the New Testament run as prose", () => {
  for (const [b, c] of [
    ["GEN", 1],
    ["ECC", 3],
    ["ISA", 53],
    ["MAT", 5],
    ["REV", 21]
  ] as const)
    expect(isPoetic(b, c)).toBe(false);
});
