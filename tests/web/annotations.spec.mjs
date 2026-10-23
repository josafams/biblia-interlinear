// Anotações no aparelho: marcações com cores, notas, favoritos, etiquetas e "Minhas anotações".
import { test, expect } from "@playwright/test";
import { openReader } from "./helpers.mjs";

const open = (page, ref = "GEN.1") => openReader(page, ref);
const bar = page => page.locator("#mbar");

test("marcar um versículo com cor fica guardado", async ({ page }) => {
  await open(page);
  await page.click("#v1 .vmark");
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#mb-ref")).toHaveText("Gênesis 1:1");
  await page.click('#mbar .mb-color[data-cor="verde"]');
  await expect(page.locator("#v1")).toHaveClass(/mk-verde/);
  await page.reload();
  await expect(page.locator("#v1")).toHaveClass(/mk-verde/);
  await page.click("#v1 .vmark");
  await page.click('#mbar .mb-color[data-cor=""]');
  await expect(page.locator("#v1")).not.toHaveClass(/mk-verde/);
});

test("nota: criar, reabrir pelo ícone, editar, achar na lista e apagar", async ({ page }) => {
  await open(page);
  await page.click("#v2 .vmark");
  await page.click('#mbar [data-action="nota"]');
  await expect(page.locator("#nota")).toBeVisible();
  await page.fill("#note-text", "tôhû wâbôhû: rima no hebraico");
  await expect(page.locator("#note-status")).toHaveText("Salva.");
  await page.keyboard.press("Escape");
  await expect(page.locator("#nota")).toBeHidden();
  await expect(page.locator("#v2 .vann-note")).toBeVisible();
  await page.reload();
  await page.click("#v2 .vann-note");
  await expect(page.locator("#note-text")).toHaveValue("tôhû wâbôhû: rima no hebraico");
  await page.fill("#note-title", "Tohu e bohu");
  await expect(page.locator("#note-status")).toHaveText("Salva.");
  await page.keyboard.press("Escape");
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await expect(page.locator("#minhas")).toBeVisible();
  await page.fill("#mn-search", "rima");
  await expect(page.locator(".mn-item")).toHaveCount(1);
  await expect(page.locator(".mn-item")).toContainText("Tohu e bohu");
  await page.click(".mn-item");
  await expect(page.locator("#nota")).toBeVisible();
  await page.click("#note-delete");
  await page.click("#note-delete");
  await expect(page.locator("#nota")).toBeHidden();
  await expect(page.locator("#v2 .vann-note")).toHaveCount(0);
});

test("favoritar e desfavoritar", async ({ page }) => {
  await open(page, "PSA.23");
  await page.click("#v1 .vmark");
  await page.click('#mbar [data-action="fav"]');
  await expect(page.locator("#v1 .vfav")).toBeVisible();
  await expect(page.locator('#mbar [data-action="fav"]')).toHaveAttribute("aria-pressed", "true");
  await page.click('#mbar [data-action="fav"]');
  await expect(page.locator("#v1 .vfav")).toHaveCount(0);
});

test("marcar um trecho selecionado da Bíblia Livre", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const bl = document.querySelector("#v3 .blivre"),
      t = [...bl.childNodes].find(n => n.nodeType === 3 && n.textContent.includes("Haja luz")),
      i = t.textContent.indexOf("Haja luz");
    const r = document.createRange();
    r.setStart(t, i);
    r.setEnd(t, i + 8);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#mb-snippet")).toContainText("Haja luz");
  await page.click('#mbar .mb-color[data-cor="amarelo"]');
  await expect(page.locator("#v3 mark.mk-amarelo")).toHaveText("Haja luz");
  await page.reload();
  await expect(page.locator("#v3 mark.mk-amarelo")).toHaveText("Haja luz");
});

test("toque longo numa palavra do original marca só ela", async ({ page, isMobile }) => {
  await open(page);
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
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#detail")).toBeHidden();
  await page.click('#mbar .mb-color[data-cor="rosa"]');
  await expect(w).toHaveClass(/mk-rosa/);
  await expect(page.locator('.word[data-v="0"][data-i="0"]')).not.toHaveClass(/mk-rosa/);
});

async function etiquetar(page, verso, nome) {
  await page.click(`#v${verso} .vmark`);
  await page.fill("#mb-tag-name", nome);
  await page.click("#mb-new-tag");
  await expect(page.locator('#mb-tags .chip[aria-pressed="true"]').filter({ hasText: nome })).toBeVisible();
  await page.click("#mb-close");
}

test("etiquetas: criar no painel, ver sob o versículo e filtrar na lista", async ({ page }) => {
  await open(page, "JHN.3");
  await etiquetar(page, 16, "promessas");
  await expect(page.locator("#v16 .vann")).toContainText("promessas");
  await etiquetar(page, 3, "novo nascimento");
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await expect(page.locator(".mn-item")).toHaveCount(2);
  await page.click('#mn-tags .chip:has-text("promessas")');
  await expect(page.locator(".mn-item")).toHaveCount(1);
  await expect(page.locator(".mn-verse")).toContainText("João 3:16");
  await page.click('#mn-tags .chip:has-text("promessas")');
  await expect(page.locator(".mn-item")).toHaveCount(2);
});

test("gerenciar etiquetas: renomear, juntar e apagar", async ({ page }) => {
  await open(page, "JHN.3");
  await etiquetar(page, 16, "promessa");
  await etiquetar(page, 17, "promessas");
  await etiquetar(page, 18, "rascunho");
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await page.click("#mn-more summary");
  await page.click("#mn-manage");
  // renomear "promessa" para "Promessas" junta com a que já existe
  // each row is found by its field's label ("Nome da etiqueta …"), as a screen reader announces it
  const row = name => page.locator(".tm-row").filter({ has: page.getByLabel(`Nome da etiqueta ${name}`, { exact: true }) });
  const promessa = row("promessa");
  await promessa.locator("input").fill("Promessas");
  await promessa.locator("input").press("Enter");
  await expect(page.locator("#toast")).toContainText("juntada");
  await expect(page.locator(".tm-row")).toHaveCount(2);
  await expect(page.locator('#mn-tags .chip:has-text("promessas") small')).toHaveText("2");
  // apagar pede dois toques e tira a etiqueta dos versículos
  const rascunho = row("rascunho");
  await rascunho.locator('[data-tm="del"]').click();
  await expect(rascunho.locator('[data-tm="del"]')).toHaveText("Toque de novo");
  await rascunho.locator('[data-tm="del"]').click();
  await expect(page.locator(".tm-row")).toHaveCount(1);
  await expect(page.locator(".mn-item")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.locator("#v18 .vann")).toBeHidden();
  await expect(page.locator("#v16 .vann")).toContainText("promessas");
});

test("nota rápida no painel aparece sob o versículo e abre em tela cheia", async ({ page }) => {
  await open(page, "PSA.23");
  await page.click("#v1 .vmark");
  await page.fill("#mb-note", "O Senhor cuida como pastor");
  await expect(page.locator("#mb-note-status")).toHaveText("Salva.");
  await page.click("#mb-close");
  await expect(page.locator("#v1 .vann-note")).toContainText("O Senhor cuida como pastor");
  await page.reload();
  await page.click("#v1 .vann-note");
  await expect(page.locator("#note-text")).toHaveValue("O Senhor cuida como pastor");
  await page.keyboard.press("Escape");
  await page.click("#v1 .vmark");
  await expect(page.locator("#mb-note")).toHaveValue("O Senhor cuida como pastor");
  await page.click('#mbar [data-action="nota"]');
  await expect(page.locator("#note-text")).toHaveValue("O Senhor cuida como pastor");
});

test("o painel do versículo tem Ouvir", async ({ page }) => {
  await page.addInitScript(() => {
    window.__falas = [];
    window.speechSynthesis.speak = u => window.__falas.push(u.text);
  });
  await open(page);
  await page.click("#v1 .vmark");
  await page.click('#mbar [data-action="ouvir"]');
  await expect.poll(() => page.evaluate(() => window.__falas.length)).toBeGreaterThan(0);
});

test("da lista, tocar numa marcação leva ao versículo", async ({ page }) => {
  await open(page, "ROM.8");
  await page.click("#v28 .vmark");
  await page.click('#mbar .mb-color[data-cor="laranja"]');
  await page.click("#mb-close");
  await open(page, "GEN.1");
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await page.click('.mn-item[data-tipo="marcacoes"]');
  await expect(page.locator("#h1")).toContainText("Romanos 8");
  await expect(page.locator("#v28")).toHaveClass(/mk-laranja/);
});

test("no modo Bíblia, a barra abre o interlinear do versículo", async ({ page }) => {
  await open(page);
  await page.click('#welcome button[data-modo="biblia"]');
  await page.evaluate(() => document.querySelector("#v4 .vmark").click());
  await expect(page.locator('#mbar [data-action="camadas"]')).toBeVisible();
  await page.click('#mbar [data-action="camadas"]');
  await expect(page.locator('.word[data-v="3"][data-i="0"]')).toBeVisible();
});

test("compartilhar sem a folha do sistema copia o texto e o link da página aberta para o versículo", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined }); // como no navegador do computador
  });
  await open(page, "LUK.3");
  await page.click("#v12 .vmark");
  await page.click('#mbar [data-action="compartilhar"]');
  await expect(page.locator("#toast")).toContainText("Link do versículo copiado");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("(Lucas 3:12, Bíblia Livre)");
  expect(copied).toContain(`${new URL("ler.html", baseURL).href}#LUK.3.12`);
});
