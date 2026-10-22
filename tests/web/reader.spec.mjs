// Leitor (ler.html): navegação, verbetes, léxico, aparência e uso offline.
import { test, expect } from "@playwright/test";
import { openReader } from "./helpers.mjs";

const open = (page, ref) => openReader(page, ref);
const titulo = page => page.locator("#h1");

test("abre Gênesis 1 com os 31 versículos e as palavras", async ({ page }) => {
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await open(page, "GEN.1");
  await expect(titulo(page)).toContainText("Gênesis 1");
  await expect(page.locator(".verse")).toHaveCount(31);
  await expect(page.locator('.word[data-v="0"]')).toHaveCount(7);
  await expect(page.locator(".verse").first().locator(".blivre")).toContainText("No princípio criou Deus");
  expect(erros).toEqual([]);
});

test("índice: tocar no livro e no capítulo abre direto", async ({ page }) => {
  await open(page, "GEN.1");
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
    await open(page, "GEN.1");
    await page.click("#open-toc");
    await page.fill("#go-in", digitado);
    await page.press("#go-in", "Enter");
    await expect(titulo(page)).toContainText(esperado);
  });
}

test("ir para sem livro vale o livro atual (1:14 e cap 12)", async ({ page }) => {
  await open(page, "JHN.3");
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
  await open(page, "RUT.1");
  await page.click(".chnav .next");
  await expect(titulo(page)).toContainText("Rute 2");
  await page.click(".chnav .prev");
  await expect(titulo(page)).toContainText("Rute 1");
});

test("verbete abre, segue para outro e fecha", async ({ page }) => {
  await open(page, "GEN.1");
  await page.click('.word[data-v="0"][data-i="1"]');
  const d = page.locator("#detail");
  await expect(d).toBeVisible();
  await expect(d).toContainText("H1254");
  await expect(d).toContainText(/criar/i);
  await page.click("#d-close");
  await expect(d).toBeHidden();
});

test("léxico do capítulo com busca", async ({ page }) => {
  await open(page, "GEN.1");
  const todas = await page.locator("#llist .lrow").count();
  expect(todas).toBeGreaterThan(30);
  await page.fill("#lsearch", "luz");
  await expect.poll(() => page.locator("#llist .lrow:visible").count()).toBeLessThan(todas);
  await expect(page.locator("#llist .lrow:visible").first()).toContainText("H216"); // אוֹר, luz
});

test("a página não fica mais larga que a tela (léxico com significados longos)", async ({ page }) => {
  await open(page, "ROM.8");
  const largura = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(largura[0]).toBeLessThanOrEqual(page.viewportSize().width);
  expect(largura[1]).toBe(page.viewportSize().width);
});

test("grego no Novo Testamento, da esquerda para a direita", async ({ page }) => {
  await open(page, "JHN.1");
  await expect(page.locator('.word[data-v="0"] .h').first()).toHaveText(/Ἐν/);
  await expect(page.locator('.word[data-v="0"]')).toHaveCount(17);
});

test("tema, tamanho e camadas ficam guardados ao recarregar", async ({ page }) => {
  await open(page, "PSA.23");
  await page.click("#open-look");
  await page.click('.tcard[data-p="escuro"]');
  await page.click("#size-up");
  await expect(page.locator("#size-out")).toHaveText("115%");
  await page.click("#t-strong");
  await page.reload();
  await expect(page.locator(".verse").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-palette", "escuro");
  await expect(page.locator("#size-out")).toHaveText("115%");
  // O número Strong começa desligado; o clique liga e a escolha fica guardada.
  await expect(page.locator("body")).not.toHaveClass(/hide-strong/);
  await expect(page.locator(".word .s").first()).toBeVisible();
});

test("sobre o livro abre com resumo", async ({ page }) => {
  await open(page, "RUT.1");
  await page.click("#chip-about");
  await expect(page.locator("#about-body")).toContainText(/Noemi/);
});

test("links do índice levam à página inicial e aos vídeos", async ({ page }) => {
  await open(page, "GEN.1");
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-voce"]');
  await expect(page.locator('a.site-link[href="index.html#como-usar"]')).toBeVisible();
  await page.click('a.site-link[href="index.html"]');
  await expect(page.locator("h1")).toContainText("A Bíblia inteira");
});

test("índice em abas: Livros (livros e capítulos), Notas e Você", async ({ page }) => {
  await open(page, "GEN.1");
  await page.click("#open-toc");
  await expect(page.locator('.bchip[data-cod="DEU"] .bn')).toHaveText("Deuteronômio");
  await expect(page.locator('.bchip[data-cod="DEU"] .ba')).toHaveText("34 cap.");
  // Novo Testamento no seletor; tocar no livro mostra a grade de capítulos com os títulos
  await expect(page.locator('.bchip[data-cod="JHN"]')).toBeHidden();
  await page.click('#bk-testa [data-nt="1"]');
  await page.click('.bchip[data-cod="JHN"]');
  await expect(page.locator("#ch-h")).toHaveText("João");
  await expect(page.locator("#ch-list .ch-row")).toHaveCount(21);
  await page.click("#ch-back");
  await expect(page.locator('.bchip[data-cod="JHN"]')).toBeVisible();
  await page.click('#toc .toc-tabs a[href="#toc-voce"]');
  await expect(page.locator('#toc .toc-tabs a[href="#toc-voce"]')).toHaveAttribute("aria-current", "true");
  await expect(page.locator("#open-progress")).toBeInViewport();
  await expect(page.locator("#go-in")).toBeHidden();
  await page.click('#toc .toc-tabs a[href="#toc-livros"]');
  await expect(page.locator("#go-in")).toBeInViewport();
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await expect(page.locator("#minhas")).toBeVisible();
});

test("fontes e licenças ficam fora do caminho e abrem pela Aparência", async ({ page }) => {
  await open(page, "GEN.1");
  await expect(page.locator("#fontes")).toBeHidden();
  await page.click("#open-look");
  await page.click("#look-sources");
  await expect(page.locator("#fontes")).toBeVisible();
});

test("funciona offline depois da primeira visita", async ({ page, context }) => {
  await open(page, "GEN.1");
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator(".verse").first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(titulo(page)).toContainText("Gênesis 1");
  await expect(page.locator(".verse")).toHaveCount(31);
  await context.setOffline(false);
});
