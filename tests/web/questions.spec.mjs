// Perguntas ao texto: perguntas no fim do capítulo, sem respostas (data/questions).
import { test, expect } from "@playwright/test";

async function open(page, ref) {
  await page.addInitScript(() => localStorage.setItem("interlinear:conta-sugestao", "nao"));
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
  const welcome = page.locator("#welcome");
  if (await welcome.isVisible()) await welcome.locator('button[data-modo="interlinear"]').click();
}

test("o fim do capítulo traz de 3 a 5 perguntas, de cada tipo, sem respostas", async ({ page }) => {
  await open(page, "RUT.1");
  const qs = page.locator("#perguntas .q");
  const n = await qs.count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(5);
  for (const k of ["observation", "interpretation", "application"]) await expect(page.locator(`#perguntas .q-${k}`).first()).toBeVisible();
  for (const t of await page.locator("#perguntas .q-t").allTextContents()) expect(t.trim()).toMatch(/\?$/);
});

test("o versículo da pergunta leva ao texto e a palavra original abre o verbete", async ({ page }) => {
  await open(page, "RUT.1");
  await page.locator("#perguntas .q-ref").last().click();
  await expect(page.locator("#v20")).toBeInViewport();
  await page.locator("#perguntas .q-word").first().click();
  await expect(page.locator("#detail")).toBeVisible();
  await expect(page.locator("#detail")).toContainText("H7725");
});

test("anotar resposta abre uma nota no versículo com a pergunta como título", async ({ page }) => {
  await open(page, "RUT.1");
  await page.locator("#perguntas .q-note").first().click();
  await expect(page.locator("#note-title")).toHaveValue(/perdas a família de Elimeleque/);
  await expect(page.locator("#note-ref")).toContainText("Rute 1:1");
});

test("dá para esconder as perguntas, e o modo Original não as mostra", async ({ page }) => {
  await open(page, "RUT.1");
  await expect(page.locator("#perguntas")).toBeVisible();
  await page.click("#open-look");
  await page.locator('.mcard[data-modo="original"]').dispatchEvent("click");
  await page.keyboard.press("Escape");
  await expect(page.locator("#perguntas")).toBeHidden();
});
