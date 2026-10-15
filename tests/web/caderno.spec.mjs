// Caderno em PDF e backup (baixar e importar meus dados).
import { test, expect } from "@playwright/test";
import fs from "node:fs";

async function abrirComDados(page) {
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Anotacoes);
  await page.evaluate(async () => {
    const A = window.Anotacoes,
      id = () => crypto.randomUUID();
    const anc = (livro, cap, ver, extra = {}) => ({ livro, cap, ver, ver_fim: ver, camada: "versiculo", ...extra });
    const tag = await A.save("etiquetas", { id: id(), nome: "estudo" });
    await A.save("notas", {
      id: id(),
      cap: "GEN.1",
      ancora: anc("GEN", 1, 2),
      titulo: "Tohu e bohu",
      texto: "Rima no hebraico.",
      etiquetas: [tag.id]
    });
    await A.save("marcacoes", {
      id: id(),
      cap: "GEN.1",
      ancora: anc("GEN", 1, 3, { camada: "blivre", inicio: 14, fim: 35, trecho: "Haja luz; e houve luz" }),
      cor: "amarelo",
      etiquetas: []
    });
    await A.save("favoritos", { id: id(), cap: "PSA.23", ancora: anc("PSA", 23, 1) });
    window.__semImprimir = true;
  });
  await page.click("#open-toc");
  await page.click("#open-minhas");
  await expect(page.locator(".mn-item")).toHaveCount(3);
}

test("caderno em PDF com o texto dos versículos, as marcações e as notas", async ({ page }) => {
  await abrirComDados(page);
  await page.click("#mn-exportar");
  await expect(page.locator("#exportar")).toBeVisible();
  await page.click("#exp-gerar");
  await page.waitForFunction(() => window.__ultimoCaderno);
  const c = await page.evaluate(() => window.__ultimoCaderno);
  expect(c.n).toBe(3);
  expect(c.html).toContain("Gênesis 1:2");
  expect(c.html).toContain("E a terra estava desordenada e vazia");
  expect(c.html).toContain("Tohu e bohu");
  expect(c.html).toMatch(/<mark[^>]*>Haja luz; e houve luz<\/mark>/);
  expect(c.html).toContain("Salmos 23:1");
  expect(c.html).toContain("estudo");
});

test("caderno só com os itens selecionados e sem o texto", async ({ page }) => {
  await abrirComDados(page);
  await page.click("#mn-selecionar");
  await page.click('.mn-item[data-tipo="notas"]');
  await expect(page.locator("#mn-total")).toHaveText("1 selecionado");
  await page.click("#mn-exportar");
  await expect(page.locator('input[name="exp-o"][value="sel"]')).toBeChecked();
  await page.uncheck("#exp-texto");
  await page.click("#exp-gerar");
  await page.waitForFunction(() => window.__ultimoCaderno);
  const c = await page.evaluate(() => window.__ultimoCaderno);
  expect(c.n).toBe(1);
  expect(c.html).toContain("Tohu e bohu");
  expect(c.html).not.toContain("E a terra estava desordenada");
  expect(c.html).not.toContain("Salmos 23:1");
});

test("baixar meus dados e importar em outro aparelho", async ({ page, browser }, info) => {
  await abrirComDados(page);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#mn-baixar")]);
  const file = info.outputPath("backup.json");
  await dl.saveAs(file);
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(payload.formato).toBe("biblia-interlinear-anotacoes");
  expect(payload.colecoes.notas).toHaveLength(1);
  const total = Object.values(payload.colecoes).reduce((n, l) => n + l.length, 0);
  // "outro aparelho": contexto novo, sem nada guardado
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto("ler.html#GEN.1");
  await expect(p2.locator(".verse").first()).toBeVisible();
  await p2.click("#open-toc");
  await p2.click("#open-minhas");
  await expect(p2.locator(".mn-vazio")).toBeVisible();
  await p2.waitForFunction(() => window.Anotacoes);
  await p2.setInputFiles("#mn-arquivo", file);
  await expect(p2.locator("#toast")).toContainText(`${total} novos`);
  await expect(p2.locator(".mn-item")).toHaveCount(3);
  await p2.setInputFiles("#mn-arquivo", file);
  await expect(p2.locator("#toast")).toContainText("0 novos");
  await p2.keyboard.press("Escape");
  await expect(p2.locator("#v3 mark.mk-amarelo")).toHaveText("Haja luz; e houve luz");
  await ctx.close();
});

test("importar um arquivo que não é backup avisa sem quebrar", async ({ page }) => {
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Anotacoes);
  await page.click("#open-toc");
  await page.click("#open-minhas");
  await expect(page.locator("#minhas")).toBeVisible();
  // conteúdo em memória: um caminho com acento (nome do teste) chega vazio ao navegador
  await page.setInputFiles("#mn-arquivo", {
    name: "outro.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ qualquer: 1 }))
  });
  await expect(page.locator("#toast")).toContainText("não é um backup");
});
