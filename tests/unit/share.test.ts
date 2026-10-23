import { expect, test } from "vitest";
import { verseLink } from "../../src/lib/share";

const LUK = { book: "LUK", chapter: 3, verse: 12 };
const SITE = "https://josafams.github.io/biblia-interlinear/ler.html#LUK.3.12";

test("in the app the link points to the published site, not to the device", () => {
  expect(verseLink(LUK, { native: true, href: "https://localhost/ler.html#LUK.3.12" })).toBe(SITE); // Android
  expect(verseLink(LUK, { native: true, href: "capacitor://localhost/ler.html" })).toBe(SITE); // iOS
  expect(verseLink(LUK, { native: false, href: "file:///C:/biblia/ler.html" })).toBe(SITE);
});

test("in the browser it is the page that is open", () => {
  expect(verseLink(LUK, { native: false, href: SITE.replace("LUK.3.12", "GEN.1.1") })).toBe(SITE);
  expect(verseLink(LUK, { native: false, href: "http://localhost:8000/ler.html" })).toBe("http://localhost:8000/ler.html#LUK.3.12");
});
