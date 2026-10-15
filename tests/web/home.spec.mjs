// Página inicial (index.html): conteúdo, links e redirecionamentos.
import { test, expect } from "@playwright/test";

const REPO = "https://github.com/josafams/biblia-interlinear";

test("mostra amostra, números e seções", async ({ page }) => {
  const erros = [];
  page.on("pageerror", e => erros.push(e.message));
  await page.goto("index.html");
  await expect(page.locator("h1")).toContainText("A Bíblia inteira");
  await expect(page.locator(".sample .wc")).toHaveCount(12);
  await expect(page.locator(".nums b").first()).toHaveText("66");
  await expect(page.locator(".nums b").nth(1)).toHaveText("1.189");
  for (const id of ["recursos", "como-usar", "baixar", "como", "contribuir"]) await expect(page.locator(`#${id}`)).toBeAttached();
  expect(erros).toEqual([]);
});

test("aponta para o repositório, o APK, o projeto iOS e os livros", async ({ page }) => {
  await page.goto("index.html");
  const hrefs = await page.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")));
  expect(hrefs).toContain(REPO);
  expect(hrefs).toContain(`${REPO}/releases/tag/app-android`);
  expect(hrefs).toContain(`${REPO}/tree/main/ios`);
  for (const f of ["completa", "AT", "NT"]) {
    expect(hrefs).toContain(`${REPO}/releases/download/livros/00-Biblia-Interlinear-${f}.epub`);
    expect(hrefs).toContain(`${REPO}/releases/download/livros/00-Biblia-Interlinear-${f}.pdf`);
  }
  await page.click('a.btn.primary[href="ler.html"] >> nth=0');
  await expect(page.locator(".verse").first()).toBeVisible();
});

test("como usar: abas, lista de vídeos e passo a passo", async ({ page }) => {
  await page.goto("index.html#como-usar");
  await expect(page.locator("#howto-tabs .tab")).toHaveCount(7);
  await expect(page.locator("#howto-list .vid")).toHaveCount(10);
  await expect(page.locator("#howto-title")).toHaveText("Abrir um livro e um capítulo");
  await expect(page.locator("#howto-steps li")).toHaveCount(4);
  await page.click('#howto-tabs .tab[data-g="aparencia"]');
  await expect(page.locator("#howto-list .vid")).toHaveCount(4);
  await page.click('#howto-list .vid[data-id="12"]');
  await expect(page.locator("#howto-title")).toHaveText("Tamanho do texto");
});

test("link de funcionalidade abre o vídeo certo", async ({ page }) => {
  await page.goto("index.html");
  await page.click('a.como[href="#v-05"]');
  await expect(page.locator("#howto-title")).toHaveText("Abrir um verbete");
});

test("links antigos com referência vão para o leitor", async ({ page }) => {
  await page.goto("index.html#JHN.3.16");
  await expect(page).toHaveURL(/ler\.html#JHN\.3/);
  await expect(page.locator("#h1")).toContainText("João 3");
});
