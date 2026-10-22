import { expect, test } from "vitest";
import { type ChapterVerse, verseView, wordAria, wordCardsHTML, wordViews } from "../../src/lib/chapter/view";
import { toWord } from "../../src/lib/data/bible";

const lex = { H7225: { x: "rēʼšîṯ", p: "re-SHIT" }, H1254: { x: "bārāʼ" } };
const gen1: ChapterVerse = {
  n: 1,
  blivre: "No princípio criou Deus os céus e a terra.",
  words: [toWord(["בְּ/רֵאשִׁ֖ית", "H7225", "no-princípio", "m", "HR/Ncfsa"]), toWord(["בָּרָ֣א", "H1254", "criou", "l", "HVqp3ms"])],
  marks: [[1, 1, null, "CON-01", "'criou' destoa da glosa usual"]]
};
const ctx = { lex, greek: false, cantillation: false, chapter: 1 };

test("word cards: the core morpheme, cantillation off, Strong, grammar and gloss", () => {
  const [a, b] = wordViews(gen1, ctx);
  expect(a.parts).toEqual([
    { text: "בְּ", pre: true },
    { text: "רֵאשִׁית", pre: false }
  ]);
  expect(a).toMatchObject({ xlit: "rēʼšîṯ", pron: "re-SHIT", strong: "H7225", morphShort: "prep. subst.", flag: false, aux: false });
  expect(a.glossHtml).toBe('no<span class="hy">-</span>princípio');
  expect(b).toMatchObject({ flag: true, aux: true, morphFull: "verbo qal perfeito 3ª masc. sing." });
  expect(wordViews(gen1, { ...ctx, cantillation: true })[0].parts[1].text).toBe("רֵאשִׁ֖ית");
});

test("what a screen reader says for a word", () => {
  expect(wordAria(gen1.words[0], lex)).toBe("no princípio. rēʼšîṯ, pronúncia re-SHIT. Strong H7225");
  expect(wordAria(gen1.words[1], lex)).toBe(
    "criou. bārāʼ, pronúncia . Strong H1254. glosa pela tradução mais comum (sem alinhamento direto)"
  );
});

test("verse view", () => {
  const v = verseView(gen1, 0, ctx);
  expect(v).toMatchObject({ label: "1:1", hasMarks: true, wordCount: 2, section: null });
  expect(v.wordsLabel).toBe("Palavras do versículo 1:1, da direita para a esquerda");
  expect(v.marks).toEqual([{ word: "בָּרָא", text: "'criou' destoa da glosa usual", code: "CON-01" }]);
  expect(verseView({ ...gen1, n: 0, h: "Álef", nota: "sem-blivre" }, 0, { ...ctx, greek: true })).toMatchObject({
    label: "título",
    section: { title: "Álef", range: "v. 0–7" },
    note: "A BLIVRE não tem este versículo separado; o texto está no versículo vizinho.",
    wordsLabel: "Palavras do versículo título"
  });
});

test("word cards HTML: the legacy markup, with every text escaped", () => {
  const [w] = wordViews(gen1, ctx);
  const html = wordCardsHTML([{ ...w, aria: 'a "quoted" <b>' }], 0, "he");
  expect(html).toBe(
    ' <button class="word" data-v="0" data-i="0" tabindex="0" aria-label="a &quot;quoted&quot; &lt;b&gt;">' +
      ' <span class="h" lang="he" aria-hidden="true"><span class="pre">בְּ</span>רֵאשִׁית</span>' +
      ' <span class="x" aria-hidden="true">rēʼšîṯ</span> <span class="p" aria-hidden="true">re-SHIT</span>' +
      ' <span class="s" aria-hidden="true">H7225</span> <span class="m" aria-hidden="true" title="preposição + substantivo fem. sing. absoluto">prep. subst.</span>' +
      ' <span class="g" aria-hidden="true">no<span class="hy">-</span>princípio</span> </button>'
  );
});
