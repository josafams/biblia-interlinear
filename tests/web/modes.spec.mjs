// Modos de leitura: seletor com Bíblia, Original, Interlinear e Estudo; mudar um item vira Personalizado.
import { test, expect } from "@playwright/test";

async function open(page, ref = "GEN.1") {
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
  await open(page);
  await expect(page.locator("#welcome")).toBeVisible();
  await page.click('#welcome button[data-modo="biblia"]');
  await expect(page.locator("#welcome")).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/hide-orig/);
  await expect(page.locator("body")).toHaveClass(/blivre-par/);
  await expect(primeiraPalavra(page)).toBeHidden();
  await expect(page.locator("#v1 .blivre")).toBeVisible();
  await expect(page.locator("#eyebrow")).toHaveText(/Bíblia Livre/i);
  await page.reload();
  await expect(page.locator(".verse").first()).toBeVisible();
  await expect(primeiraPalavra(page)).toBeHidden();
  await expect(page.locator("#welcome")).toBeHidden();
});

test("modo Original: só o texto original, corrido, e a palavra abre o verbete", async ({ page }) => {
  await open(page);
  await modo(page, "original");
  await expect(page.locator("#v1 .blivre")).toBeHidden();
  await expect(primeiraPalavra(page)).toBeVisible();
  await expect(primeiraPalavra(page).locator(".g")).toBeHidden();
  await expect(primeiraPalavra(page).locator(".s")).toBeHidden();
  await primeiraPalavra(page).click();
  await expect(page.locator("#detail")).toBeVisible();
  await expect(page.locator("#detail")).toContainText("H7225");
});

test("o seletor tem 4 modos e explica o escolhido", async ({ page }) => {
  await open(page);
  await page.click("#open-look");
  await expect(page.locator("#mode-grid .mcard")).toHaveText(["Bíblia", "Original", "Interlinear", "Estudo"]);
  await page.click('.mcard[data-modo="estudo"]');
  await expect(page.locator("#mode-note")).toContainText("Strong");
});

test("modo Original com a Bíblia Livre ligada mostra os dois (o antigo Original e Bíblia Livre)", async ({ page }) => {
  await open(page, "JHN.1");
  await modo(page, "original");
  await page.click("#open-look");
  await page.click("#t-blivre");
  await page.keyboard.press("Escape");
  await expect(primeiraPalavra(page)).toBeVisible();
  await expect(primeiraPalavra(page).locator(".g")).toBeHidden();
  await expect(page.locator("#v1 .blivre")).toBeVisible();
});

test("modo Estudo liga pronúncia e análise gramatical", async ({ page }) => {
  await open(page);
  await modo(page, "estudo");
  await expect(primeiraPalavra(page).locator(".p")).toBeVisible();
  await expect(primeiraPalavra(page).locator(".m")).toBeVisible();
  await expect(primeiraPalavra(page).locator(".m")).toContainText(/subst\.|prep\./);
});

test("mudar um item vira Personalizado; tocar num modo volta ao padrão dele", async ({ page }) => {
  await open(page);
  await modo(page, "biblia");
  await modo(page, "interlinear");
  await page.click("#open-look");
  await page.click("#t-strong");
  await expect(page.locator('.mcard[aria-checked="true"]')).toHaveCount(0);
  await expect(page.locator("#mode-note")).toContainText("Personalizado a partir do modo Interlinear");
  await page.click('.mcard[data-modo="biblia"]');
  await expect(page.locator("body")).toHaveClass(/hide-orig/);
});

test("no modo Bíblia, tocar no número abre o interlinear só daquele versículo", async ({ page }) => {
  await open(page);
  await modo(page, "biblia");
  await page.click("#v3 .vnum");
  await expect(page.locator('.word[data-v="2"][data-i="0"]')).toBeVisible();
  await expect(primeiraPalavra(page)).toBeHidden();
  await page.click("#v3 .vnum");
  await expect(page.locator('.word[data-v="2"][data-i="0"]')).toBeHidden();
});
