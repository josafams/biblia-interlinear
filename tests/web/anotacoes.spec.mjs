// Anotações no aparelho: marcações com cores, notas, favoritos, etiquetas e "Minhas anotações".
import { test, expect } from "@playwright/test";

async function abrir(page, ref = "GEN.1") {
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
}
const barra = page => page.locator("#mbar");

test("marcar um versículo com cor fica guardado", async ({ page }) => {
  await abrir(page);
  await page.click("#v1 .vmark");
  await expect(barra(page)).toBeVisible();
  await expect(page.locator("#mb-ref")).toHaveText("Gênesis 1:1");
  await page.click('#mbar .mb-cor[data-cor="verde"]');
  await expect(page.locator("#v1")).toHaveClass(/mk-verde/);
  await page.reload();
  await expect(page.locator("#v1")).toHaveClass(/mk-verde/);
  await page.click("#v1 .vmark");
  await page.click('#mbar .mb-cor[data-cor=""]');
  await expect(page.locator("#v1")).not.toHaveClass(/mk-verde/);
});

test("nota: criar, reabrir pelo ícone, editar, achar na lista e apagar", async ({ page }) => {
  await abrir(page);
  await page.click("#v2 .vmark");
  await page.click('#mbar [data-acao="nota"]');
  await expect(page.locator("#nota")).toBeVisible();
  await page.fill("#nota-texto", "tôhû wâbôhû: rima no hebraico");
  await expect(page.locator("#nota-estado")).toHaveText("Salva.");
  await page.keyboard.press("Escape");
  await expect(page.locator("#nota")).toBeHidden();
  await expect(page.locator("#v2 .vnota")).toBeVisible();
  await page.reload();
  await page.click("#v2 .vnota");
  await expect(page.locator("#nota-texto")).toHaveValue("tôhû wâbôhû: rima no hebraico");
  await page.fill("#nota-titulo", "Tohu e bohu");
  await expect(page.locator("#nota-estado")).toHaveText("Salva.");
  await page.keyboard.press("Escape");
  await page.click("#open-toc");
  await page.click("#open-minhas");
  await expect(page.locator("#minhas")).toBeVisible();
  await page.fill("#mn-busca", "rima");
  await expect(page.locator(".mn-item")).toHaveCount(1);
  await expect(page.locator(".mn-item")).toContainText("Tohu e bohu");
  await page.click(".mn-item");
  await expect(page.locator("#nota")).toBeVisible();
  await page.click("#nota-apagar");
  await page.click("#nota-apagar");
  await expect(page.locator("#nota")).toBeHidden();
  await expect(page.locator("#v2 .vnota")).toHaveCount(0);
});

test("favoritar e desfavoritar", async ({ page }) => {
  await abrir(page, "PSA.23");
  await page.click("#v1 .vmark");
  await page.click('#mbar [data-acao="fav"]');
  await expect(page.locator("#v1 .vfav")).toBeVisible();
  await expect(page.locator('#mbar [data-acao="fav"]')).toHaveAttribute("aria-pressed", "true");
  await page.click('#mbar [data-acao="fav"]');
  await expect(page.locator("#v1 .vfav")).toHaveCount(0);
});

test("marcar um trecho selecionado da Bíblia Livre", async ({ page }) => {
  await abrir(page);
  await page.evaluate(() => {
    const bl = document.querySelector("#v3 .blivre"),
      t = bl.lastChild,
      i = t.textContent.indexOf("Haja luz");
    const r = document.createRange();
    r.setStart(t, i);
    r.setEnd(t, i + 8);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
  await expect(barra(page)).toBeVisible();
  await expect(page.locator("#mb-trecho")).toContainText("Haja luz");
  await page.click('#mbar .mb-cor[data-cor="amarelo"]');
  await expect(page.locator("#v3 mark.mk-amarelo")).toHaveText("Haja luz");
  await page.reload();
  await expect(page.locator("#v3 mark.mk-amarelo")).toHaveText("Haja luz");
});

test("toque longo numa palavra do original marca só ela", async ({ page, isMobile }) => {
  await abrir(page);
  const w = page.locator('.word[data-v="0"][data-i="1"]');
  if (isMobile)
    await w.dispatchEvent("contextmenu"); // o toque longo do celular chega como contextmenu
  else {
    const box = await w.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
  }
  await expect(barra(page)).toBeVisible();
  await expect(page.locator("#detail")).toBeHidden();
  await page.click('#mbar .mb-cor[data-cor="rosa"]');
  await expect(w).toHaveClass(/mk-rosa/);
  await expect(page.locator('.word[data-v="0"][data-i="0"]')).not.toHaveClass(/mk-rosa/);
});

test("etiquetas: criar, aplicar e filtrar na lista", async ({ page }) => {
  await abrir(page, "JHN.3");
  await page.click("#v16 .vmark");
  await page.click('#mbar [data-acao="etiqueta"]');
  await page.fill("#mb-et-nome", "promessas");
  await page.click("#mb-nova-et");
  await expect(page.locator('#mb-etiquetas .chip[aria-pressed="true"]')).toHaveText("promessas");
  await page.click("#mb-fechar");
  await page.click("#open-toc");
  await page.click("#open-minhas");
  await page.selectOption("#mn-etiqueta", { label: "promessas" });
  await expect(page.locator(".mn-item")).toHaveCount(1);
  await expect(page.locator(".mn-item")).toContainText("João 3:16");
});

test("da lista, tocar numa marcação leva ao versículo", async ({ page }) => {
  await abrir(page, "ROM.8");
  await page.click("#v28 .vmark");
  await page.click('#mbar .mb-cor[data-cor="laranja"]');
  await page.click("#mb-fechar");
  await abrir(page, "GEN.1");
  await page.click("#open-toc");
  await page.click("#open-minhas");
  await page.click('.mn-item[data-tipo="marcacoes"]');
  await expect(page.locator("#h1")).toContainText("Romanos 8");
  await expect(page.locator("#v28")).toHaveClass(/mk-laranja/);
});

test("no modo Bíblia, a barra abre o interlinear do versículo", async ({ page }) => {
  await abrir(page);
  await page.click('#welcome button[data-modo="biblia"]');
  await page.evaluate(() => document.querySelector("#v4 .vmark").click());
  await expect(page.locator('#mbar [data-acao="camadas"]')).toBeVisible();
  await page.click('#mbar [data-acao="camadas"]');
  await expect(page.locator('.word[data-v="3"][data-i="0"]')).toBeVisible();
});
