import { afterEach, expect, test } from "vitest";
import { setLocale } from "../../src/i18n";
import { rebase, translateHtml } from "../../vite/site/translate-html";

afterEach(() => setLocale("pt-BR"));

test("the marked texts of a page take the locale's text; the rest stays", () => {
  setLocale("en");
  const html =
    '<nav aria-label="Principal" data-i18n-label="home.page.nav"><a data-i18n="home.page.open">Abrir a Bíblia</a> GitHub</nav>' +
    '<p class="note" data-i18n-html="home.page.hero_note">Não precisa de <b>conta</b>.</p><div lang="pt-BR"><span>x</span></div>';
  const out = translateHtml(html);
  expect(out).toContain('<nav aria-label="Main" data-i18n-label="home.page.nav">');
  expect(out).toContain(">Open the Bible</a> GitHub</nav>");
  expect(out).toContain('No account needed. Works offline once opened. Prefer an app, EPUB or PDF? <a href="#baixar">');
  expect(out).not.toContain("conta");
  expect(out).toContain('<div lang="en"><span>x</span></div>');
});

test("nested tags of the same name close at the right place", () => {
  setLocale("en");
  const out = translateHtml('<span data-i18n="home.page.site">a <span>b</span> c</span><span>after</span>');
  expect(out).toBe('<span data-i18n="home.page.site">Website</span><span>after</span>');
});

test("addresses from a folder: back to the root, the folder's own ones inside it, the reader in the locale", () => {
  const html =
    '<a href="ler.html#JHN.3">r</a><a href="en/bible/john/">b</a><link href="assets/x.css"><a href="#top">t</a>' +
    '<a href="https://x.org/">x</a><a href="privacidade.html">p</a><a href="index.html">pt</a>';
  expect(rebase(html, "en/", "en")).toBe(
    '<a href="../ler.html?lang=en#JHN.3">r</a><a href="bible/john/">b</a><link href="../assets/x.css"><a href="#top">t</a>' +
      '<a href="https://x.org/">x</a><a href="../privacidade.html?lang=en">p</a><a href="../index.html">pt</a>'
  );
});
