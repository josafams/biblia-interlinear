import { expect, test } from "vitest";
import { keyboardInset, revealScroll } from "../../src/lib/sheet";

test("keyboard: what the visual viewport loses at the bottom", () => {
  expect(keyboardInset(844, 844, 0)).toBe(0);
  expect(keyboardInset(844, 520, 0)).toBe(324); // iOS: the keyboard only shrinks the visual viewport
  expect(keyboardInset(844, 500, 20)).toBe(324); // scrolled while the keyboard is open
  expect(keyboardInset(844, 820, 0)).toBe(0); // the address bar, not a keyboard
});

const room = { top: 56, bottom: 560 }; // bar of 56px, sheet from 560px

test("a verse already in the room stays put", () => {
  expect(revealScroll({ top: 200, height: 150 }, room, 1000)).toBe(1000);
});

test("a verse under the sheet goes up to sit just above it", () => {
  // bottom of the verse at 700 + 100 = 800 → it should end at 560 - 12 = 548
  expect(revealScroll({ top: 700, height: 100 }, room, 1000)).toBe(1000 + 800 - 548);
});

test("a verse above the bar comes down", () => {
  expect(revealScroll({ top: -300, height: 120 }, room, 1000)).toBe(1000 + (-300 + 120) - 548);
});

test("a verse taller than the room shows its beginning under the bar", () => {
  expect(revealScroll({ top: 900, height: 800 }, room, 1000)).toBe(1000 + 900 - 68);
});

test("never scrolls above the page", () => {
  expect(revealScroll({ top: -50, height: 100 }, room, 20)).toBe(0);
});
