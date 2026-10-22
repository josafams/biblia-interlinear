// Acessibilidade automática (axe-core, MPL-2.0): sem problemas graves na página inicial e no leitor.
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const [nome, url] of [
  ["página inicial", "index.html"],
  ["leitor (hebraico)", "ler.html#GEN.1"],
  ["leitor (grego)", "ler.html#JHN.1"]
]) {
  test(`acessibilidade: ${nome}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto(url);
    // the page is drawn: the reader's chapter with its lexicon, and the fonts (waiting for "networkidle" is
    // discouraged by Playwright and timed out now and then when the whole suite runs in parallel)
    if (url.startsWith("ler.html")) await page.locator("#verses .word").first().waitFor();
    if (url.startsWith("ler.html")) await page.locator("#llist .lrow").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const graves = r.violations.filter(v => v.impact === "critical" || v.impact === "serious");
    expect(graves.map(v => `${v.id}: ${v.help} (${v.nodes.length}× ex.: ${v.nodes[0].target.join(" ")})`)).toEqual([]);
  });
}
