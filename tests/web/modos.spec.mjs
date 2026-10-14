// Modos de leitura: Bíblia, Original, Original e Bíblia Livre, Interlinear, Estudo e Personalizado.
import { test, expect } from "@playwright/test";

async function abrir(page, ref = "GEN.1") {
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
}
async function modo(page, id) {
  await page.click("#open-look");
  await page.click(`.mcard[data-modo="${id}"]`);
  await page.keyboard.press("Escape");
}
const primeiraPalavra = page => page.locator('.word[data-v="0"][data-i="0"]');

test("primeira abertura pergunta como ler; escolher Bíblia mostra só a Bíblia Livre em parágrafos", async ({ page }) => {
  await abrir(page);
  await expect(page.locator("#welcome")).toBeVisible();
  await page.click('#welcome button[data-modo="biblia"]');
  await expect(page.locator("#welcome")).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/hide-orig/);
  await expect(page.locator("body")).toHaveClass(/blivre-par/);
  await expect(primeiraPalavra(page)).toBeHidden();
  await expect(page.locator("#v1 .blivre")).toBeVisible();
  await expect(page.locator("#eyebrow")).toHaveText(/Bíblia Livre/i);
  await expect(page.locator("#ch-say")).toBeVisible();
  await page.reload();
  await expect(page.locator(".verse").first()).toBeVisible();
  await expect(primeiraPalavra(page)).toBeHidden();
  await expect(page.locator("#welcome")).toBeHidden();
});

test("modo Original: só o texto original, corrido, e a palavra abre o verbete", async ({ page }) => {
  await abrir(page);
  await modo(page, "original");
  await expect(page.locator("#v1 .blivre")).toBeHidden();
  await expect(primeiraPalavra(page)).toBeVisible();
  await expect(primeiraPalavra(page).locator(".g")).toBeHidden();
  await expect(primeiraPalavra(page).locator(".s")).toBeHidden();
  await primeiraPalavra(page).click();
  await expect(page.locator("#detail")).toBeVisible();
  await expect(page.locator("#detail")).toContainText("H7225");
});

test("modo Original e Bíblia Livre mostra os dois", async ({ page }) => {
  await abrir(page, "JHN.1");
  await modo(page, "paralelo");
  await expect(primeiraPalavra(page)).toBeVisible();
  await expect(primeiraPalavra(page).locator(".g")).toBeHidden();
  await expect(page.locator("#v1 .blivre")).toBeVisible();
});

test("modo Estudo liga pronúncia e análise gramatical", async ({ page }) => {
  await abrir(page);
  await modo(page, "estudo");
  await expect(primeiraPalavra(page).locator(".p")).toBeVisible();
  await expect(primeiraPalavra(page).locator(".m")).toBeVisible();
  await expect(primeiraPalavra(page).locator(".m")).toContainText(/substantivo|preposição/);
});

test("mudar um item vira Personalizado; o atalho volta ao modo anterior", async ({ page }) => {
  await abrir(page);
  await modo(page, "biblia");
  await modo(page, "interlinear");
  await page.click("#open-look");
  await page.click("#t-strong");
  await expect(page.locator('.mcard[data-modo="personalizado"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#mode-note")).toContainText("Interlinear");
  await page.keyboard.press("Escape");
  await expect(page.locator("#mode-swap")).toBeVisible();
  await page.click("#mode-swap");
  await expect(page.locator("body")).toHaveClass(/hide-orig/);
});

test("no modo Bíblia, tocar no número abre o interlinear só daquele versículo", async ({ page }) => {
  await abrir(page);
  await modo(page, "biblia");
  await page.click("#v3 .vnum");
  await expect(page.locator('.word[data-v="2"][data-i="0"]')).toBeVisible();
  await expect(primeiraPalavra(page)).toBeHidden();
  await page.click("#v3 .vnum");
  await expect(page.locator('.word[data-v="2"][data-i="0"]')).toBeHidden();
});
