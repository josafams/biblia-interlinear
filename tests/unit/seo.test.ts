import fs from "node:fs";
import { expect, test } from "vitest";
import { alternates, breadcrumbs, clip, escapeHtml, headTags } from "../../src/seo/head";
import { bookSlug, chapterPath, entryPath, homePath, readerPath, toRoot } from "../../src/seo/paths";

test("book slugs: no accents, hyphens, and one per book", () => {
  expect(bookSlug("Gênesis")).toBe("genesis");
  expect(bookSlug("1 João")).toBe("1-joao");
  expect(bookSlug("Cânticos")).toBe("canticos");
  // the names of the 66 books, from the source table (build/data does not exist before the data is made)
  const names = [...fs.readFileSync("scripts/interlinear/books.py", "utf8").matchAll(/^\s+Book\(.*"([^"]+)", "[^"]+"\),$/gm)].map(
    m => m[1]
  );
  expect(names).toHaveLength(66);
  const slugs = names.map(bookSlug);
  expect(new Set(slugs).size).toBe(66);
  for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("paths and the way back to the root", () => {
  expect(chapterPath("João", 3)).toBe("biblia/joao/3/");
  expect(entryPath("G26")).toBe("lexico/G26/");
  expect(toRoot("biblia/joao/3/")).toBe("../../../");
  expect(toRoot("")).toBe("");
  expect(readerPath("JHN.3")).toBe("ler.html#JHN.3");
});

test("paths in English: their own folder, names in English, and the reader in English", () => {
  expect(homePath("en")).toBe("en/");
  expect(chapterPath("John", 3, "en")).toBe("en/bible/john/3/");
  expect(entryPath("G26", "en")).toBe("en/lexicon/G26/");
  expect(readerPath("JHN.3", "en")).toBe("ler.html?lang=en#JHN.3");
  expect(toRoot("en/bible/john/3/")).toBe("../../../../");
});

test("hreflang: both versions of a page, Portuguese first and as the default", () => {
  expect(alternates("biblia/joao/3/")).toBeUndefined();
  const pairs = alternates("biblia/joao/3/", "en/bible/john/3/", "en")!;
  expect(pairs).toEqual([
    ["pt-BR", "biblia/joao/3/"],
    ["en", "en/bible/john/3/"]
  ]);
  const html = headTags({ path: "biblia/joao/3/", title: "João 3", description: "", alternates: pairs }, "Bíblia Interlinear");
  expect(html).toContain('<link rel="alternate" hreflang="en" href="https://josafams.github.io/biblia-interlinear/en/bible/john/3/">');
  expect(html).toContain('hreflang="x-default" href="https://josafams.github.io/biblia-interlinear/biblia/joao/3/"');
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

test("sitemap: absolute addresses, escaped, in parts, and robots.txt pointing to it", async () => {
  const { robots, sitemapIndex, sitemapParts, urlSet } = await import("../../src/seo/sitemap");
  const set = urlSet(["", "biblia/joao/3/"], "2026-10-27");
  expect(set).toContain("<loc>https://josafams.github.io/biblia-interlinear/biblia/joao/3/</loc>");
  expect(set).toContain("<lastmod>2026-10-27</lastmod>");
  expect(sitemapIndex(["sitemap-biblia.xml"], "2026-10-27")).toContain(
    "<sitemap><loc>https://josafams.github.io/biblia-interlinear/sitemap-biblia.xml</loc>"
  );
  const parts = sitemapParts(["biblia/", "biblia/joao/", "lexico/G26/", "en/bible/john/", "en/lexicon/G26/"]);
  expect(parts["sitemap-biblia.xml"]).toEqual(["biblia/", "biblia/joao/"]);
  expect(parts["sitemap-lexico.xml"]).toEqual(["lexico/G26/"]);
  expect(parts["sitemap-bible-en.xml"]).toEqual(["en/bible/john/"]);
  expect(parts["sitemap-lexicon-en.xml"]).toEqual(["en/lexicon/G26/"]);
  expect(robots()).toContain("Sitemap: https://josafams.github.io/biblia-interlinear/sitemap.xml");
});
