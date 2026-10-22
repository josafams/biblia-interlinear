// Perguntas ao texto: perguntas no fim do capítulo, sem respostas (data/questions).
import { test, expect } from "@playwright/test";
import { openReader } from "./helpers.mjs";

const open = (page, ref) => openReader(page, ref, { hideAccountHint: true, skipWelcome: true });

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

test("anotar resposta abre o painel do versículo; a resposta vira nota com a pergunta como título", async ({ page }) => {
  await open(page, "RUT.1");
  await page.locator("#perguntas .q-note").first().click();
  await expect(page.locator("#mbar")).toBeVisible();
  await expect(page.locator("#mb-ref")).toHaveText("Rute 1:1");
  await expect(page.locator("#mb-snippet")).toContainText(/perdas a família de Elimeleque/);
  await expect(page.locator("#mb-note")).toBeFocused();
  await page.fill("#mb-note", "Fome, exílio e morte, tudo no começo.");
  await expect(page.locator("#mb-note-status")).toHaveText("Salva.");
  const notas = await page.evaluate(() => window.Annotations.allRecords("notas"));
  expect(notas).toHaveLength(1);
  expect(notas[0].titulo).toMatch(/perdas a família de Elimeleque/);
  expect(notas[0].ancora.ver).toBe(1);
});

test("dá para esconder as perguntas, e o modo Original não as mostra", async ({ page }) => {
  await open(page, "RUT.1");
  await expect(page.locator("#perguntas")).toBeVisible();
  await page.click("#open-look");
  await page.locator('.mcard[data-modo="original"]').dispatchEvent("click");
  await page.keyboard.press("Escape");
  await expect(page.locator("#perguntas")).toBeHidden();
});
