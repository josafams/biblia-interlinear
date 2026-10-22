import { expect, test } from "vitest";
import { cleanHeb, esc, glossHTML, glossSpoken, norm } from "../../src/lib/text";

test("esc escapes HTML and treats null as empty", () => {
  expect(esc('<a href="x">&</a>')).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
  expect(esc(null)).toBe("");
});

test("norm drops accents and transliteration marks", () => {
  expect(norm("Bərēʼšîṯ")).toBe("bərēšit".normalize("NFD").replace(/[̀-ͯ]/g, ""));
  expect(norm("Ação")).toBe("acao");
});

test("cleanHeb keeps vowels and drops cantillation and slashes", () => {
  expect(cleanHeb("בְּ/רֵאשִׁ֖ית")).toBe("בְּרֵאשִׁית");
});

test("glossHTML marks hyphens and the object marker", () => {
  expect(glossHTML("no-princípio")).toBe('no<span class="hy">-</span>princípio');
  expect(glossHTML("[obj]")).toContain('<abbr class="obj"');
  expect(glossHTML("")).toBe("—");
});

test("glossSpoken reads the object marker in words", () => {
  expect(glossSpoken("[obj]-os-céus")).toBe("marcador de objeto os céus");
});
