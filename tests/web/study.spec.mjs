// Estudo: ligação palavra ↔ Bíblia Livre, concordância e mapa das seções do Salmo 119.
import { test, expect } from "@playwright/test";

async function open(page, ref) {
  await page.addInitScript(() => localStorage.setItem("interlinear:conta-sugestao", "nao"));
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
  const welcome = page.locator("#welcome");
  if (await welcome.isVisible()) await welcome.locator('button[data-modo="interlinear"]').click();
}
const ligado = page =>
  page.evaluate(() => {
    const h = CSS.highlights.get("ligada");
    return h ? [...h].map(r => r.toString()) : [];
  });

test("abrir uma palavra destaca a tradução dela na Bíblia Livre", async ({ page }) => {
  await open(page, "JHN.3");
  await page.click('#v16 .word[data-i="2"]');
  await expect(page.locator("#d-title")).toHaveText("ἠγάπησεν");
  await expect(page.locator(".dlem .dl")).toHaveText("ἀγαπάω");
  await expect.poll(() => ligado(page)).toEqual(["amou"]);
  await page.click("#d-next");
  await expect.poll(() => ligado(page)).not.toEqual(["amou"]);
  await page.keyboard.press("Escape");
  await expect.poll(() => ligado(page)).toEqual([]);
});

test("tocar numa palavra da Bíblia Livre acende o cartão do original", async ({ page }) => {
  await open(page, "JHN.3");
  const ponto = await page.evaluate(() => {
    const bl = document.querySelector("#v16 .blivre");
    const walk = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const k = n.data.indexOf("amou");
      if (k < 0) continue;
      const r = document.createRange();
      r.setStart(n, k + 1);
      r.setEnd(n, k + 3);
      r.startContainer.parentElement.scrollIntoView({ block: "center" });
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  });
  expect(ponto).not.toBeNull();
  await page.mouse.click(ponto.x, ponto.y);
  await expect(page.locator('#v16 .word[data-i="2"]')).toHaveClass(/linked/);
  await expect.poll(() => ligado(page)).toEqual(["amou"]);
});

test("concordância: todas as ocorrências, filtro pela tradução e ir ao versículo", async ({ page }) => {
  await open(page, "JHN.3");
  await page.click('#v16 .word[data-i="2"]');
  await page.click("#d-conc");
  const folha = page.locator("#concordancia");
  await expect(folha).toBeVisible();
  await expect(page.locator("#conc-sub")).toContainText("ocorrências na Bíblia");
  const total = await page.locator(".conc-item").count();
  expect(total).toBeGreaterThan(10);
  await expect(page.locator(".conc-txt mark").first()).toBeVisible();
  // em ordem bíblica, e as traduções raras ficam atrás de "+N"
  await expect(page.locator(".conc-ref").first()).toHaveText("Mateus 5:43");
  await expect(page.locator("#conc-gl .chip[data-gl]")).toHaveCount(9);
  await page.click("#conc-gl [data-allgl]");
  expect(await page.locator("#conc-gl .chip[data-gl]").count()).toBeGreaterThan(9);
  await page.click('#conc-gl .chip:has-text("amou")');
  await expect(page.locator("#conc-sub")).toContainText(" de ");
  await expect(page.locator(".conc-g").first()).toHaveText("amou");
  await page.click('.conc-scope [data-scope="livro"]');
  await expect(page.locator(".conc-ref").first()).toContainText("João");
  const alvo = page.locator(".conc-item").first();
  const cap = await alvo.getAttribute("data-c");
  await alvo.click();
  await expect(folha).toBeHidden();
  await expect(page.locator("#h1")).toContainText(`João ${cap}`);
});

test("Salmo 119: mapa das 22 seções leva a cada letra", async ({ page }) => {
  await open(page, "PSA.119");
  await expect(page.locator("#secmap a")).toHaveCount(22);
  await expect(page.locator("#secmap a").last()).toHaveText("Tau");
  await page.click('#secmap a[data-sec="169"]');
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById("s169").getBoundingClientRect().top))).toBeLessThan(200);
  await expect(page.locator("#v169 .blivre")).not.toContainText("Tau");
});
