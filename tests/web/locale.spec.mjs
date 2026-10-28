// The app in English (#8): ?lang=en picks the locale and saves it; Aparência shows the picker; back to Portuguese.
// The running text is the Berean Standard Bible (dados/en/cap over the chapter), and the search looks in it.
import { test, expect } from "@playwright/test";

const titulo = page => page.locator("#h1");

test("?lang=en: the reader in English, with English book names and references", async ({ page }) => {
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.goto("ler.html?lang=en#JHN.3");
  await expect(page.locator(".verse").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(titulo(page)).toContainText("John 3");
  await page.click("#open-toc");
  await expect(page.locator('.bchip[data-cod="GEN"]')).toContainText("Genesis");
  await page.fill("#go-in", "ps 23");
  await page.press("#go-in", "Enter");
  await expect(titulo(page)).toContainText("Psalms 23");
  // the Portuguese questions stay out until they are translated (John 3 has them in Portuguese)
  await page.goto("ler.html#JHN.3");
  await expect(page.locator(".verse").first()).toBeVisible();
  await expect(page.locator('[data-testid="questions"]')).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("the choice stays on the device, and Aparência switches back to Portuguese", async ({ page }) => {
  await page.goto("ler.html?lang=en#GEN.1");
  await expect(titulo(page)).toContainText("Genesis 1");
  await page.goto("ler.html#GEN.1");
  await expect(titulo(page)).toContainText("Genesis 1");
  await page.click("#open-look");
  await expect(page.locator("#lang-pick")).toBeVisible();
  await Promise.all([page.waitForEvent("load"), page.click('#lang-pick [data-lang="pt-BR"]')]);
  await expect(titulo(page)).toContainText("Gênesis 1");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test("in Portuguese John 3 has its questions (the English test above relies on it)", async ({ page }) => {
  await page.goto("ler.html#JHN.3");
  await expect(page.locator('[data-testid="questions"]')).toBeVisible();
});

test("without a chosen language the picker does not show (the English version is not announced)", async ({ page }) => {
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.click("#open-look");
  await expect(page.locator("#look")).toBeVisible();
  await expect(page.locator("#lang-pick")).toHaveCount(0);
});

test("in English the running text is the Berean Standard Bible", async ({ page }) => {
  await page.goto("ler.html?lang=en#JHN.3");
  const v16 = page.locator("#v16 .blivre");
  await expect(v16).toContainText("For God so loved the world that He gave His one and only Son");
  await expect(v16.locator(".tag")).toHaveText("BSB");
  // Psalm 119: the sections keep their Hebrew letters, in English
  await page.goto("ler.html#PSA.119");
  await expect(page.locator(".verse").first()).toContainText("Blessed are those whose way is blameless");
});

test("in English the search looks in the BSB", async ({ page }) => {
  await page.goto("ler.html?lang=en#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.click("#open-search");
  await page.fill("#busca-q", "God so loved world");
  await expect(page.locator(".busca-item").first()).toContainText("John 3:16");
  await expect(page.locator(".busca-item mark").first()).toHaveText(/loved|God|world/);
});
