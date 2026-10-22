import { expect, test } from "vitest";
import { toWord } from "../../src/lib/data/bible";
import { englishEntryUrl, entryView, linkRefs, translations } from "../../src/lib/lexicon/entry";

const lex = {
  G25: { l: "ἀγαπάω", x: "agapáō", p: "a-ga-PA-o", s: "amar", t: "amou (12); amar (8); ama (5)", o: "talvez de G26", n: 143 },
  G26: { l: "ἀγάπη", x: "agápē", p: "a-GA-pe", s: "amor", n: 116 },
  H853: { l: "אֵת", x: "ʼêth", p: "et", se: "untranslatable mark of the object", n: 11000 }
};
const ctx = {
  lex,
  greek: true,
  cantillation: true,
  position: "palavra 3 de 25 · João 3:16",
  inChapter: 1,
  chapterRef: "João 3",
  concordance: true
};

test("entry of a word of the text", () => {
  const word = toWord(["ἠγάπησεν", "G25", "amou", "m", "V-3AAI-S--", "ἀγαπάω"]);
  const e = entryView("G25", word, ctx);
  expect(e).toMatchObject({
    lang: "grc",
    title: "ἠγάπησεν",
    lemma: "ἀγαπάω",
    xlit: "agapáō",
    position: "palavra 3 de 25 · João 3:16",
    found: true,
    meaning: { text: "amar", english: false },
    occurrences: 143,
    uses: "Strong G25 · 143 ocorrências na Bíblia · 1 em João 3",
    ariaLabel: "Verbete G25 agapáō"
  });
  expect(e.context).toMatchObject({ morph: "verbo aoristo ativo indicativo 3ª pessoa sing.", source: "glosa revisada", objectNote: false });
  expect(e.translations).toEqual([
    { text: "amou", count: "12" },
    { text: "amar", count: "8" },
    { text: "ama", count: "5" }
  ]);
  expect(e.originHtml).toContain('<button class="ref" data-ref="G26"');
});

test("entry opened from the lexicon (no word): English meaning, no concordance when it is off", () => {
  const e = entryView("H853", null, { ...ctx, greek: false, concordance: false, inChapter: 0 });
  expect(e).toMatchObject({ lang: "he", title: "אֵת", position: "", context: null, occurrences: 0 });
  expect(e.meaning).toEqual({ text: "untranslatable mark of the object", english: true });
  expect(e.uses).toBe("Strong H853 · 11.000 ocorrências na Bíblia");
});

test("a word without a Strong entry", () => {
  const e = entryView("G:x", toWord(["λόγος", "G:x", "palavra", "", "N-----NSM-", "λόγος"]), ctx);
  expect(e).toMatchObject({ found: false, lemma: "λόγος", englishUrl: null });
});

test("helpers", () => {
  expect(linkRefs("de <H1> e G26", lex)).toBe(
    'de &lt;H1&gt; e <button class="ref" data-ref="G26" aria-label="Abrir verbete G26, agápē">G26<span class="rh" lang="grc">ἀγάπη</span>agápē</button>'
  );
  expect(translations("x; y (2)")).toEqual([{ text: "y", count: "2" }]);
  expect(englishEntryUrl("H430")).toBe("https://www.blueletterbible.org/lexicon/h430/kjv/wlc/0-1/");
});
