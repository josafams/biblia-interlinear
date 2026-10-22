// Busca na Bíblia toda: palavras (sem acento), várias palavras, filtros, referência e número Strong.
import { test, expect } from "@playwright/test";
import { openReader } from "./helpers.mjs";

const open = (page, ref = "GEN.1") => openReader(page, ref, { hideAccountHint: true });
async function buscar(page, texto) {
  if (!(await page.locator("#busca").isVisible())) await page.click("#open-search");
  await page.fill("#busca-q", texto);
}

test("buscar uma palavra acha versículos na Bíblia toda, sem ligar para acentos", async ({ page }) => {
  await open(page);
  await buscar(page, "Mansos");
  await expect(page.locator("#busca-sub")).toContainText("versículos");
  await expect(page.locator(".busca-item").first()).toBeVisible();
  await expect(page.locator(".busca-item mark").first()).toHaveText(/mansos/i);
  await buscar(page, "fe");
  const comAcento = page.locator(".busca-item mark").first();
  await expect(comAcento).toHaveText(/fé/i);
});

test("várias palavras: só os versículos que têm todas; filtro pelo Novo Testamento", async ({ page }) => {
  await open(page);
  await buscar(page, "Deus amou mundo");
  await expect(page.locator(".busca-item").first()).toContainText("João 3:16");
  await buscar(page, "pastor");
  const total = await page.locator("#busca-sub").textContent();
  await page.click('.busca-scope [data-scope="nt"]');
  await expect(page.locator("#busca-sub")).toContainText("na Bíblia toda");
  await expect(page.locator("#busca-sub")).not.toHaveText(total);
  await expect(page.locator(".busca-item .conc-ref").first()).not.toContainText(/Gênesis|Salmos/);
});

test("tocar num resultado leva ao versículo", async ({ page }) => {
  await open(page);
  await buscar(page, "tohu");
  await buscar(page, "desordenada vazia");
  await page.locator(".busca-item").first().click();
  await expect(page.locator("#busca")).toBeHidden();
  await expect(page.locator("#h1")).toContainText("Gênesis 1");
});

test("referência e número Strong viram atalhos; Enter vai para a referência", async ({ page }) => {
  await open(page);
  await buscar(page, "Sl 23:1");
  await expect(page.locator(".busca-go")).toContainText("Salmos 23:1");
  await page.press("#busca-q", "Enter");
  await expect(page.locator("#h1")).toContainText("Salmos 23");
  await buscar(page, "G25");
  await expect(page.locator(".busca-go")).toContainText("G25");
  await page.click(".busca-go");
  await expect(page.locator("#concordancia")).toBeVisible();
  await expect(page.locator("#conc-sub")).toContainText("143");
});

test("a tecla / abre a busca e Esc fecha", async ({ page }, info) => {
  test.skip(info.project.name !== "computador");
  await open(page);
  await page.keyboard.press("/");
  await expect(page.locator("#busca")).toBeVisible();
  await expect(page.locator("#busca-q")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#busca")).toBeHidden();
});
