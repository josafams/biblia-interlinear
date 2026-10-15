// Leitor (ler.html): navegação, verbetes, léxico, aparência e uso offline.
import { test, expect } from "@playwright/test";

async function abrir(page, ref) {
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
}
const titulo = page => page.locator("#h1");

test("abre Gênesis 1 com os 31 versículos e as palavras", async ({ page }) => {
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await abrir(page, "GEN.1");
  await expect(titulo(page)).toContainText("Gênesis 1");
  await expect(page.locator(".verse")).toHaveCount(31);
  await expect(page.locator('.word[data-v="0"]')).toHaveCount(7);
  await expect(page.locator(".verse").first().locator(".blivre")).toContainText("No princípio criou Deus");
  expect(erros).toEqual([]);
});

test("índice: tocar no livro e no capítulo abre direto", async ({ page }) => {
  await abrir(page, "GEN.1");
  await page.click("#open-toc");
  await page.click('.bchip[data-cod="EXO"]');
  await page.click('.chchip[data-ch="20"]');
  await expect(titulo(page)).toContainText("Êxodo 20");
  await expect(page.locator("#toc")).toBeHidden();
});

for (const [digitado, esperado] of [
  ["jo 3:16", "João 3"],
  ["sl 23", "Salmos 23"],
  ["1 sm 17", "1 Samuel 17"],
  ["apocalipse 21", "Apocalipse 21"]
]) {
  test(`ir para “${digitado}”`, async ({ page }) => {
    await abrir(page, "GEN.1");
    await page.click("#open-toc");
    await page.fill("#go-in", digitado);
    await page.press("#go-in", "Enter");
    await expect(titulo(page)).toContainText(esperado);
  });
}

test("ir para sem livro vale o livro atual (1:14 e cap 12)", async ({ page }) => {
  await abrir(page, "JHN.3");
  await page.click("#open-toc");
  await page.fill("#go-in", "1:14");
  await page.press("#go-in", "Enter");
  await expect(titulo(page)).toContainText("João 1");
  await page.click("#open-toc");
  await page.fill("#go-in", "cap 12");
  await page.press("#go-in", "Enter");
  await expect(titulo(page)).toContainText("João 12");
});

test("capítulo anterior e próximo", async ({ page }) => {
  await abrir(page, "RUT.1");
  await page.click(".chnav .next");
  await expect(titulo(page)).toContainText("Rute 2");
  await page.click(".chnav .prev");
  await expect(titulo(page)).toContainText("Rute 1");
});

test("verbete abre, segue para outro e fecha", async ({ page }) => {
  await abrir(page, "GEN.1");
  await page.click('.word[data-v="0"][data-i="1"]');
  const d = page.locator("#detail");
  await expect(d).toBeVisible();
  await expect(d).toContainText("H1254");
  await expect(d).toContainText(/criar/i);
  await page.click("#d-close");
  await expect(d).toBeHidden();
});

test("léxico do capítulo com busca", async ({ page }) => {
  await abrir(page, "GEN.1");
  const todas = await page.locator("#llist .lrow").count();
  expect(todas).toBeGreaterThan(30);
  await page.fill("#lsearch", "luz");
  await expect.poll(() => page.locator("#llist .lrow:visible").count()).toBeLessThan(todas);
  await expect(page.locator("#llist .lrow:visible").first()).toContainText("H216"); // אוֹר, luz
});

test("grego no Novo Testamento, da esquerda para a direita", async ({ page }) => {
  await abrir(page, "JHN.1");
  await expect(page.locator('.word[data-v="0"] .h').first()).toHaveText(/Ἐν/);
  await expect(page.locator('.word[data-v="0"]')).toHaveCount(17);
});

test("tema, tamanho e camadas ficam guardados ao recarregar", async ({ page }) => {
  await abrir(page, "PSA.23");
  await page.click("#to-dark");
  await page.click("#open-look");
  await page.click("#size-up");
  await expect(page.locator("#size-out")).toHaveText("115%");
  await page.click("#t-strong");
  await page.reload();
  await expect(page.locator(".verse").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "escuro");
  await expect(page.locator("#size-out")).toHaveText("115%");
  await expect(page.locator("body")).toHaveClass(/hide-strong/);
  await expect(page.locator(".word .s").first()).toBeHidden();
});

test("sobre o livro abre com resumo", async ({ page }) => {
  await abrir(page, "RUT.1");
  await page.click("#sobre summary");
  await expect(page.locator("#sobre-body")).toContainText(/Noemi/);
});

test("links do índice levam à página inicial e aos vídeos", async ({ page }) => {
  await abrir(page, "GEN.1");
  await page.click("#open-toc");
  await expect(page.locator('a.site-link[href="index.html#como-usar"]')).toBeVisible();
  await page.click('a.site-link[href="index.html"]');
  await expect(page.locator("h1")).toContainText("A Bíblia inteira");
});

test("funciona offline depois da primeira visita", async ({ page, context }) => {
  await abrir(page, "GEN.1");
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator(".verse").first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(titulo(page)).toContainText("Gênesis 1");
  await expect(page.locator(".verse")).toHaveCount(31);
  await context.setOffline(false);
});
