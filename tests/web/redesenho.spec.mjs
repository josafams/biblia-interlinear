// Itens da proposta de redesenho (docs/REDESENHO.md) que não têm teste em outro arquivo: barras, Índice, Aparência,
// anotações por versículo, contagens por livro e capítulos longos — no celular e no computador.
import { test, expect } from "@playwright/test";
import { openReader } from "./helpers.mjs";

const open = (page, ref = "JHN.3") => openReader(page, ref, { hideAccountHint: true, skipWelcome: true });
const celular = info => info.project.name === "celular";

test("celular: Livros · ‹ · Ouvir · › · Aa na barra de baixo; computador: tudo na barra de cima", async ({ page }, info) => {
  await open(page);
  const naBarraDeBaixo = await page.evaluate(() => ["open-toc", "open-look"].map(id => !!document.getElementById(id).closest("#bbar")));
  expect(naBarraDeBaixo).toEqual(celular(info) ? [true, true] : [false, false]);
  await page.click("#open-look");
  await expect(page.locator("#look")).toBeVisible();
});

test("tocar no título do capítulo abre a grade de capítulos do livro", async ({ page }) => {
  await open(page);
  await page.click("#where");
  await expect(page.locator('#chgrid .chchip[data-ch="3"]')).toBeInViewport();
  await expect(page.locator('#chgrid .chchip[data-ch="3"]')).toBeFocused();
});

test("Ir para também filtra os livros pelo nome", async ({ page }) => {
  await open(page);
  await page.click("#open-toc");
  await page.fill("#go-in", "cânt");
  await expect(page.locator("#bk-list .bchip:visible")).toHaveCount(1);
  await expect(page.locator("#bk-list .bchip:visible")).toContainText("Cânticos");
  // uma referência não filtra: volta a lista do testamento escolhido
  await page.fill("#go-in", "jo 3:16");
  expect(await page.locator("#bk-list .bchip:visible").count()).toBeGreaterThan(20);
});

test("Aparência em cinco grupos; “O que mostrar” em chips, sem rolar", async ({ page }) => {
  await open(page);
  await page.click("#open-look");
  await expect(page.locator("#look h3")).toHaveText(["Modo de leitura", "O que mostrar", "Texto", "Tema", "Áudio"]);
  await expect(page.locator("#t-xlit")).toBeInViewport();
  await page.click("#t-xlit");
  await expect(page.locator("#t-xlit")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("body")).toHaveClass(/hide-xlit/);
});

test("a etiqueta vale para o versículo inteiro; faixa com ★, nota e #etiqueta; barra de cor", async ({ page }) => {
  await open(page);
  await page.click("#v16 .vmark");
  await page.click('#mbar .mb-color[data-cor="verde"]');
  await page.fill("#mb-note", "O amor que dá");
  await expect(page.locator("#mb-note-status")).toHaveText("Salva.");
  await page.click('#mbar [data-action="fav"]');
  // sem etiquetas ainda: aparecem sugestões
  await expect(page.locator("#mb-tags .mb-sug")).toHaveCount(4);
  await page.fill("#mb-tag-name", "#Promessas");
  await page.press("#mb-tag-name", "Enter");
  await expect(page.locator('#mb-tags .chip[aria-pressed="true"]')).toHaveText("Promessas");
  const etiquetas = await page.evaluate(() =>
    Promise.all(["marcacoes", "notas", "favoritos"].map(c => window.Annotations.allRecords(c))).then(ls =>
      ls.map(l => l.map(x => x.etiquetas.length))
    )
  );
  expect(etiquetas).toEqual([[1], [1], [1]]);
  await page.click("#mb-close");
  const faixa = page.locator("#v16 .vann");
  await expect(faixa.locator(".vfav")).toBeVisible();
  await expect(faixa).toContainText("O amor que dá");
  await expect(faixa).toContainText("#Promessas");
  await expect(page.locator("#v16")).toHaveClass(/com-cor/);
  // digitar filtra as etiquetas que já existem
  await page.click("#v3 .vmark");
  await page.fill("#mb-tag-name", "prom");
  await expect(page.locator("#mb-tags [data-etiqueta]:visible")).toHaveText(["Promessas"]);
});

test("limpar o versículo tem Desfazer", async ({ page }) => {
  await open(page);
  await page.click("#v16 .vmark");
  await page.click('#mbar .mb-color[data-cor="azul"]');
  await page.fill("#mb-note", "apagar e voltar");
  await expect(page.locator("#mb-note-status")).toHaveText("Salva.");
  await page.click('#mbar [data-action="limpar"]');
  await expect(page.locator("#v16")).not.toHaveClass(/mk-azul/);
  await page.click("#toast [data-undo]");
  await expect(page.locator("#v16")).toHaveClass(/mk-azul/);
  await expect(page.locator("#v16 .vann")).toContainText("apagar e voltar");
});

test("Minhas anotações: filtros com contagem e busca por #etiqueta", async ({ page }) => {
  await open(page);
  await page.click("#v16 .vmark");
  await page.fill("#mb-note", "nota");
  await expect(page.locator("#mb-note-status")).toHaveText("Salva.");
  await page.fill("#mb-tag-name", "oração");
  await page.press("#mb-tag-name", "Enter");
  await page.click("#mb-close");
  await page.click("#v17 .vmark");
  await page.click('#mbar .mb-color[data-cor="rosa"]');
  await page.click("#mb-close");
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-notas"]');
  await expect(page.locator('.mn-filters .chip[data-tipo="notas"] small')).toHaveText("1");
  await expect(page.locator('.mn-filters .chip[data-tipo=""] small')).toHaveText("2");
  await page.fill("#mn-search", "#oracao");
  await expect(page.locator(".mn-verse")).toHaveCount(1);
  await expect(page.locator(".mn-verse")).toContainText("João 3:16");
});

test("concordância e busca mostram onde aparece, por livro, e filtram", async ({ page }) => {
  await open(page);
  await page.click('#v16 .word[data-i="2"]');
  await page.click("#d-conc");
  const livros = page.locator("#conc-books [data-book]");
  await expect(livros.first()).toContainText("João");
  await livros.first().click();
  await expect(page.locator(".conc-ref").first()).toContainText("João");
  await expect(page.locator("#conc-sub")).toContainText(" de 143");
  await page.keyboard.press("Escape");
  await page.click("#open-search");
  await page.fill("#busca-q", "amor");
  await expect(page.locator("#busca-sub")).toContainText(/AT \d+ · NT \d+/);
  const b = page.locator("#busca-books [data-book]").first();
  const nome = (await b.textContent()).replace(/\s*\d+$/, "").trim();
  await b.click();
  await expect(page.locator(".busca-item .conc-ref").first()).toContainText(nome);
});

test("Salmo 119: “v. N de 176” e ‹ › passam de seção", async ({ page }) => {
  await open(page, "PSA.119");
  await page.evaluate(() => document.getElementById("v60").scrollIntoView());
  await expect(page.locator("#vpos")).toBeVisible();
  await expect(page.locator("#vpos-t")).toContainText(/Hete · v\. \d+ de 176/);
  await page.click("#sec-next");
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById("s65").getBoundingClientRect().top))).toBeLessThan(200);
  await expect(page.locator("#vpos-t")).toContainText("Tete");
});
