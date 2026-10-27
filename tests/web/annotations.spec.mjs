// Anotações no aparelho: marcações com cores, notas, favoritos, etiquetas e "Minhas anotações".
import { test, expect } from "@playwright/test";
import { expandAnnotate, openReader } from "./helpers.mjs";

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
  await expandAnnotate(page);
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
  await expandAnnotate(page);
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
  await expandAnnotate(page);
  await page.fill("#mb-note", "O Senhor cuida como pastor");
  await expect(page.locator("#mb-note-status")).toHaveText("Salva.");
  await page.click("#mb-close");
  await expect(page.locator("#v1 .vann-note")).toContainText("O Senhor cuida como pastor");
  await page.reload();
  await page.click("#v1 .vann-note");
  await expect(page.locator("#note-text")).toHaveValue("O Senhor cuida como pastor");
  await page.keyboard.press("Escape");
  await page.click("#v1 .vmark");
  await expandAnnotate(page);
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
  await expandAnnotate(page);
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

// ---- the sheet on phones: compact first, the verse above it, "Nota" and the keyboard
const phoneOnly = isMobile => test.skip(!isMobile, "a folha em dois tamanhos é do celular");
const box = (page, sel) => page.locator(sel).evaluate(el => el.getBoundingClientRect().toJSON());

test("no celular a folha abre compacta e o versículo fica inteiro acima dela", async ({ page, isMobile }) => {
  phoneOnly(isMobile);
  await open(page, "JHN.3");
  await page.click("#v16 .vmark");
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#mb-note")).toBeHidden();
  await expect(page.locator('#mbar [data-action="copiar"]')).toBeHidden();
  const sheet = await box(page, "#mbar");
  expect(sheet.height).toBeLessThan(330);
  await expect(async () => {
    const v = await box(page, "#v16"),
      top = await box(page, ".bar");
    expect(v.top).toBeGreaterThanOrEqual(top.bottom - 1);
    // a verse taller than the room shows its beginning
    if (v.height < sheet.top - top.bottom - 24) expect(v.bottom).toBeLessThanOrEqual(sheet.top + 1);
    else expect(v.top).toBeLessThan(top.bottom + 40);
  }).toPass();
  // a cor salva sem fechar; outro versículo troca o alvo
  await page.click('#mbar .mb-color[data-cor="azul"]');
  await expect(bar(page)).toBeVisible();
  await page.click("#v17 .vmark");
  await expect(page.locator("#mb-ref")).toHaveText("João 3:17");
  await expect(page.locator("#v16.editando")).toHaveCount(0);
});

test("Nota expande a folha e põe o cursor no campo; Menos volta à compacta", async ({ page, isMobile }) => {
  phoneOnly(isMobile);
  await open(page, "JHN.3");
  await page.click("#v16 .vmark");
  await page.click('#mbar [data-action="escrever"]');
  await expect(page.locator("#mb-note")).toBeFocused();
  await expect(page.locator('#mbar [data-action="copiar"]')).toBeVisible();
  await expect(page.locator("#mb-done")).toBeVisible();
  await page.click('#mbar [data-action="mais"]');
  await expect(page.locator("#mb-note")).toBeHidden();
});

test("com o teclado aberto a folha sobe e o campo e o Pronto continuam à vista", async ({ page, isMobile }) => {
  phoneOnly(isMobile);
  await open(page, "JHN.3");
  await page.click("#v16 .vmark");
  await page.click('#mbar [data-action="escrever"]');
  // the keyboard as Safari on iOS reports it: only the visual viewport shrinks
  await page.evaluate(() => {
    const kb = 320,
      vv = window.visualViewport;
    Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight - kb });
    vv.dispatchEvent(new Event("resize"));
  });
  const limit = (await page.evaluate(() => window.innerHeight)) - 320;
  await expect(async () => {
    expect((await box(page, "#mbar")).bottom).toBeLessThanOrEqual(limit + 1);
    expect((await box(page, "#mb-done")).bottom).toBeLessThanOrEqual(limit + 1);
    expect((await box(page, "#mb-note")).top).toBeGreaterThan(0);
  }).toPass();
});

test("tocar no número do versículo abre Anotar (no modo Interlinear)", async ({ page }) => {
  await open(page, "JHN.3");
  await page.click("#v16 .vnum");
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#mb-ref")).toHaveText("João 3:16");
});

test("no celular o aviso aparece acima da folha", async ({ page, isMobile }) => {
  phoneOnly(isMobile);
  await open(page, "JHN.3");
  await page.click("#v16 .vmark");
  // any message while the sheet is open (e.g. "Link do versículo copiado")
  await page.evaluate(() => {
    const t = document.getElementById("toast");
    t.textContent = "aviso";
    t.hidden = false;
  });
  await expect(page.locator("#toast")).toBeVisible();
  expect((await box(page, "#toast")).bottom).toBeLessThanOrEqual((await box(page, "#mbar")).top);
});

// ---- selecting the Bíblia Livre: the long press selects; Anotar opens once the selection stops
async function selectBlivre(page, verse, text) {
  await page.evaluate(
    ([v, txt]) => {
      const bl = document.querySelector(`#v${v} .blivre`);
      const walk = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const i = n.textContent.indexOf(txt);
        if (i < 0) continue;
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + txt.length);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        return;
      }
    },
    [verse, text]
  );
}

test("selecionar um trecho da Bíblia Livre abre Anotar com ele; mudar a seleção atualiza o trecho", async ({ page, isMobile }) => {
  await open(page, "JHN.3");
  await selectBlivre(page, 16, "Deus amou");
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#mb-snippet")).toContainText("Deus amou");
  if (isMobile) await expect(page.locator("#mb-note")).toBeHidden(); // compacta
  await selectBlivre(page, 16, "Deus amou ao mundo");
  await expect(page.locator("#mb-snippet")).toContainText("Deus amou ao mundo");
});

test("o toque longo na Bíblia Livre deixa o aparelho selecionar (não abre o versículo inteiro nem cancela)", async ({ page }) => {
  await open(page, "JHN.3");
  const bl = page.locator("#v16 .blivre");
  const notCancelled = await bl.evaluate(el => el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
  expect(notCancelled).toBe(true);
  await page.waitForTimeout(700);
  await expect(bar(page)).toBeHidden();
  // um toque simples numa palavra da BLIVRE só acende o original
  await bl.click({ position: { x: 60, y: 10 } });
  await page.waitForTimeout(700);
  await expect(bar(page)).toBeHidden();
});

// ---- selections that cross verses or cover an existing highlight
// selects from the text `from` in verse v1 to the end of `to` in verse v2, by position in the Bíblia Livre text
// (a highlight already there splits that text in several pieces of the page)
async function selectAcross(page, [v1, from], [v2, to]) {
  await page.evaluate(
    ([a, fromText, b, toText]) => {
      const point = (v, txt, atEnd) => {
        const bl = document.querySelector(`#v${v} .blivre`);
        const nodes = [];
        const walk = document.createTreeWalker(bl, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) if (!n.parentElement.closest(".tag")) nodes.push(n);
        const text = nodes.map(n => n.textContent).join("");
        let off = text.indexOf(txt) + (atEnd ? txt.length : 0);
        for (const n of nodes) {
          if (off <= n.textContent.length) return [n, off];
          off -= n.textContent.length;
        }
      };
      const r = document.createRange();
      r.setStart(...point(a, fromText, false));
      r.setEnd(...point(b, toText, true));
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    },
    [v1, from, v2, to]
  );
}

test("uma seleção que pega dois versículos marca o pedaço de cada um", async ({ page }) => {
  await open(page);
  await selectAcross(page, [1, "a terra"], [2, "E a terra"]);
  await expect(bar(page)).toBeVisible();
  await expect(page.locator("#mb-ref")).toHaveText("Gênesis 1:1–2");
  await page.click('#mbar .mb-color[data-cor="azul"]');
  await expect(page.locator("#v1 mark.mk-azul")).toHaveText("a terra.");
  await expect(page.locator("#v2 mark.mk-azul")).toHaveText("E a terra");
  await page.reload();
  await expect(page.locator("#v1 mark.mk-azul")).toHaveText("a terra.");
  await expect(page.locator("#v2 mark.mk-azul")).toHaveText("E a terra");
});

test("marcar um trecho que pega parte de uma marcação existente: as duas aparecem, a nova por cima", async ({ page }) => {
  await open(page);
  await selectBlivre(page, 3, "Haja luz");
  await page.click('#mbar .mb-color[data-cor="amarelo"]');
  await expect(page.locator("#v3 mark.mk-amarelo")).toHaveText("Haja luz");
  await page.click("#mb-close");
  await selectAcross(page, [3, "Deus: Haja"], [3, "Deus: Haja"]);
  await expect(page.locator("#mb-snippet")).toContainText("Deus: Haja");
  await page.click('#mbar .mb-color[data-cor="verde"]');
  await expect(page.locator("#v3 mark.mk-verde")).toHaveText("Deus: Haja");
  await expect(page.locator("#v3 mark.mk-amarelo")).toHaveText(" luz");
  await page.reload();
  await expect(page.locator("#v3 mark.mk-verde")).toHaveText("Deus: Haja");
});
