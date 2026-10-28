// The static pages for search engines (src/seo/, vite/site/seo-pages.ts): the content is in the HTML (no
// JavaScript needed), each page has its canonical address and structured data, and leads to the reader.
import { test, expect } from "@playwright/test";

const SITE = "https://josafams.github.io/biblia-interlinear/";
test.use({ javaScriptEnabled: false, serviceWorkers: "block" });

const jsonLd = page => page.locator('script[type="application/ld+json"]').evaluateAll(s => s.map(x => JSON.parse(x.textContent)));

test("capítulo: o texto está no HTML, com endereço canônico, dados estruturados e o caminho para o leitor", async ({ page }) => {
  await page.goto("biblia/joao/3/");
  await expect(page.locator("h1")).toHaveText("João 3");
  await expect(page).toHaveTitle(/João 3 interlinear/);
  await expect(page.locator("#v16 .bl")).toContainText("Deus amou ao mundo");
  await expect(page.locator("#v16 .orig")).toHaveAttribute("lang", "grc");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}biblia/joao/3/`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Nicodemos/);
  const types = (await jsonLd(page)).map(o => o["@type"]);
  expect(types).toEqual(["Chapter", "BreadcrumbList"]);
  await expect(page.locator('a.btn[href$="ler.html#JHN.3"]')).toBeVisible();
  await expect(page.locator('a[rel="next"]')).toHaveAttribute("href", "../../../biblia/joao/4/");
  // a word of the original leads to its entry
  await expect(page.locator("#v16 a.w").first()).toHaveAttribute("href", /^\.\.\/\.\.\/\.\.\/lexico\/G\d+\/$/);
});

test("capítulo do Antigo Testamento: hebraico da direita para a esquerda", async ({ page }) => {
  await page.goto("biblia/genesis/1/");
  await expect(page.locator("#v1 .orig")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("#v1 .orig")).toHaveAttribute("lang", "he");
});

test("livro: introdução e a lista dos capítulos com o tema", async ({ page }) => {
  await page.goto("biblia/joao/");
  await expect(page.locator("h1")).toContainText("João");
  await expect(page.locator(".chapters li")).toHaveCount(21);
  await expect(page.locator(".chapters li").nth(2)).toContainText("Nicodemos");
  expect((await jsonLd(page)).map(o => o["@type"])).toEqual(["Book", "BreadcrumbList"]);
});

test("a lista dos livros e a página inicial levam aos 66 livros", async ({ page }) => {
  await page.goto("biblia/");
  await expect(page.locator(".books a")).toHaveCount(66);
  await page.goto("index.html");
  await expect(page.locator(".bible-books a")).toHaveCount(66);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", SITE);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `${SITE}icones/compartilhar.png`);
});

test("o leitor sem JavaScript mostra o caminho para as páginas simples", async ({ page }) => {
  await page.goto("ler.html");
  await expect(page.locator('noscript a[href="biblia/"]')).toBeAttached();
});

test("verbete: a palavra, o significado e os versículos onde aparece, cada um levando ao capítulo", async ({ page }) => {
  await page.goto("lexico/G26/");
  await expect(page.locator("h1")).toHaveText("ἀγάπη");
  await expect(page).toHaveTitle(/ἀγάπη \(agápē\), G26/);
  await expect(page.locator(".entry dl")).toContainText("amor");
  await expect(page.locator(".refs li")).toHaveCount(30);
  expect((await jsonLd(page)).map(o => o["@type"])).toEqual(["DefinedTerm", "BreadcrumbList"]);
  const first = page.locator(".refs a").first();
  await expect(first).toHaveAttribute("href", /^\.\.\/\.\.\/biblia\/mateus\/24\/#v12$/);
  await first.click();
  await expect(page.locator("#v12")).toBeVisible();
});

test("verbete hebraico: da direita para a esquerda", async ({ page }) => {
  await page.goto("lexico/H7225/");
  await expect(page.locator("h1 span")).toHaveAttribute("dir", "rtl");
});

test("sitemap.xml aponta para as partes, e elas têm todas as páginas", async ({ request }) => {
  const index = await (await request.get("sitemap.xml")).text();
  expect(index.match(/<sitemap>/g)).toHaveLength(5);
  const count = async f => ((await (await request.get(f)).text()).match(/<url>/g) || []).length;
  expect(await count("sitemap-paginas.xml")).toBe(3);
  expect(await count("sitemap-biblia.xml")).toBe(1 + 66 + 1189);
  expect(await count("sitemap-lexico.xml")).toBeGreaterThan(14000);
  expect(await count("sitemap-bible-en.xml")).toBe(1 + 66 + 1189);
  expect(await count("sitemap-lexicon-en.xml")).toBeGreaterThan(14000);
  expect(await (await request.get("robots.txt")).text()).toContain("Sitemap: https://josafams.github.io/biblia-interlinear/sitemap.xml");
});

test("capítulo em inglês: BSB, glosas em inglês e os dois idiomas ligados", async ({ page }) => {
  await page.goto("en/bible/john/3/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("h1")).toContainText("John 3");
  await expect(page.locator("main")).toContainText("For God so loved the world");
  await expect(page.locator('link[hreflang="pt-BR"]')).toHaveAttribute("href", /\/biblia\/joao\/3\/$/);
  await expect(page.locator('a[href$="ler.html?lang=en#JHN.3"]').first()).toBeVisible();
  await page.goto("biblia/joao/3/");
  await expect(page.locator('link[hreflang="en"]')).toHaveAttribute("href", /\/en\/bible\/john\/3\/$/);
});
