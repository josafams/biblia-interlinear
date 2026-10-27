import { expect, test } from "vitest";
import books from "../../build/data/books.json";
import { breadcrumbs, clip, escapeHtml, headTags } from "../../src/seo/head";
import { bookSlug, chapterPath, entryPath, toRoot } from "../../src/seo/paths";

test("book slugs: no accents, hyphens, and one per book", () => {
  expect(bookSlug("Gênesis")).toBe("genesis");
  expect(bookSlug("1 João")).toBe("1-joao");
  expect(bookSlug("Cânticos")).toBe("canticos");
  const slugs = (books as { name: string }[]).map(b => bookSlug(b.name));
  expect(new Set(slugs).size).toBe(66);
  for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("paths and the way back to the root", () => {
  expect(chapterPath("João", 3)).toBe("biblia/joao/3/");
  expect(entryPath("G26")).toBe("lexico/G26/");
  expect(toRoot("biblia/joao/3/")).toBe("../../../");
  expect(toRoot("")).toBe("");
});

test("descriptions are cut at a word, with an ellipsis", () => {
  expect(clip("curto")).toBe("curto");
  const long = "palavra ".repeat(40);
  const c = clip(long);
  expect(c.length).toBeLessThanOrEqual(155);
  expect(c.endsWith("palavra…")).toBe(true);
});

test("head tags: absolute canonical and image, escaped text, JSON-LD that parses", () => {
  const html = headTags(
    { path: "biblia/joao/3/", title: 'João 3 "x" <b>', description: "a & b", jsonLd: [breadcrumbs([["Bíblia", "biblia/"]])] },
    "Bíblia Interlinear"
  );
  expect(html).toContain('<link rel="canonical" href="https://josafams.github.io/biblia-interlinear/biblia/joao/3/">');
  expect(html).toContain('og:image" content="https://josafams.github.io/biblia-interlinear/icones/compartilhar.png');
  expect(html).toContain("<title>João 3 &quot;x&quot; &lt;b&gt;</title>");
  expect(html).toContain('content="a &amp; b"');
  const ld = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1];
  expect(JSON.parse(ld)["@type"]).toBe("BreadcrumbList");
  expect(escapeHtml("</script>")).toBe("&lt;/script&gt;");
});
