// Visual regression of the reader states listed in docs/redesenho/LAYOUT.md, on the phone and desktop projects.
// Opt-in (font rendering differs between machines): VISUAL=1 npx playwright test tests/web/visual.spec.mjs
// Update the baseline on purpose only: VISUAL=1 npx playwright test tests/web/visual.spec.mjs --update-snapshots
import { test, expect } from "@playwright/test";
import { openReader, openIndexTab } from "./helpers.mjs";

test.skip(!process.env.VISUAL, "visual regression runs only with VISUAL=1");
test.use({ serviceWorkers: "block" });

// Deterministic start: Interlinear mode, light theme, no first-run question, tips or account suggestion.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const set = (k, v) => localStorage.setItem("interlinear:" + k, v);
    set("modo", "interlinear");
    set("tema", "claro");
    set("conta-sugestao", "nao");
    for (const tip of ["palavra", "versiculo", "verbete"]) set("dica-" + tip, "vista");
  });
});

const shot = (page, name) => expect(page).toHaveScreenshot(`${name}.png`, { animations: "disabled", maxDiffPixelRatio: 0.002 });
const toVerse = (page, n) =>
  page.evaluate(v => {
    document.getElementById("v" + v).scrollIntoView();
    window.scrollBy(0, -70);
  }, n);
const pickMode = async (page, mode) => {
  await page.click("#open-look");
  await page.click(`.mcard[data-modo="${mode}"]`);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 0));
};

test("reading: chapter top in Interlinear mode", async ({ page }) => {
  await openReader(page, "JHN.3");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "reading-top");
});

test("reading: verse cards (Interlinear)", async ({ page }) => {
  await openReader(page, "JHN.3.16");
  await toVerse(page, 16);
  await shot(page, "reading-verse");
});

for (const mode of ["biblia", "original", "estudo"]) {
  test(`reading: ${mode} mode`, async ({ page }) => {
    await openReader(page, "JHN.3");
    await pickMode(page, mode);
    if (mode === "estudo") await toVerse(page, 16);
    await shot(page, `mode-${mode}`);
  });
}

test("reading: end of chapter (questions, lexicon, next chapter)", async ({ page }) => {
  await openReader(page, "JHN.3");
  await page.evaluate(() => document.querySelector(".chnav").scrollIntoView({ block: "end" }));
  await shot(page, "chapter-end");
});

test("index: books, chapters, notes and you", async ({ page }) => {
  await openReader(page, "JHN.3");
  await page.click("#open-toc");
  await shot(page, "index-books");
  await page.click('.bchip[data-cod="JHN"]');
  await shot(page, "index-chapters");
  await openIndexTab(page, "voce");
  await shot(page, "index-you");
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await expect(page.locator("#minhas")).toBeVisible();
  await shot(page, "index-notes");
});

test("annotate panel", async ({ page }) => {
  await openReader(page, "JHN.3.16");
  await toVerse(page, 16);
  await page.click("#v16 .vmark");
  await expect(page.locator("#mbar")).toBeVisible();
  await page.waitForTimeout(600); // the verse scrolls to the room above the sheet
  await shot(page, "annotate");
});

test("annotate panel, full (phone)", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the full sheet is the phone's; on computers the panel always has everything");
  await openReader(page, "JHN.3.16");
  await toVerse(page, 16);
  await page.click("#v16 .vmark");
  await page.click('#mbar [data-action="mais"]');
  await expect(page.locator("#mb-note")).toBeVisible();
  await page.waitForTimeout(600);
  await shot(page, "annotate-full");
});

test("lexicon entry (verbete)", async ({ page }) => {
  await openReader(page, "JHN.3.16");
  await toVerse(page, 16);
  await page.click('#v16 .word[data-i="2"]');
  await expect(page.locator("#detail")).toBeVisible();
  await shot(page, "lexicon-entry");
});

test("appearance", async ({ page }) => {
  await openReader(page, "JHN.3");
  await page.click("#open-look");
  await shot(page, "appearance");
});

test("dark theme cards", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("interlinear:tema", "escuro"));
  await openReader(page, "JHN.3.16");
  await toVerse(page, 16);
  await shot(page, "theme-dark");
});
