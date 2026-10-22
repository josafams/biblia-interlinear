// Login Google (opcional) e acesso à pasta do app no Drive — com o Google simulado (nada sai para a internet).
import { test, expect } from "@playwright/test";
import { simularGoogle } from "./fake-google.mjs";

// o service worker serviria o google-config.js real do cache, passando por cima da simulação
test.use({ serviceWorkers: "block" });

async function abrirIndice(page) {
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Account);
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-voce"]');
}

test("sem ID de cliente configurado, o login não aparece", async ({ page }) => {
  await simularGoogle(page, { configurado: false });
  await abrirIndice(page);
  await expect(page.locator("#conta")).toBeHidden();
  expect(await page.evaluate(() => window.Account.status())).toBe("unavailable");
});

test("entrar com Google conecta a pasta do app no Drive e registra o aparelho", async ({ page }) => {
  const { arquivos } = await simularGoogle(page);
  await abrirIndice(page);
  await expect(page.locator("#conta")).toContainText("Guardar no seu Google Drive");
  await page.click("#account-signin");
  await expect(page.locator("#conta .account-name")).toHaveText("Maria Teste");
  await expect(page.locator("#conta .account-email")).toHaveText("maria@exemplo.com");
  await expect(page.locator("#conta .account-drive")).toHaveText("Google Drive conectado · 1 aparelho");
  const [account] = [...arquivos.values()];
  expect(account.name).toBe("conta.json");
  expect(Object.keys(JSON.parse(account.conteudo).aparelhos)).toHaveLength(1);
  // o token nunca vai para o armazenamento do navegador
  const guardado = await page.evaluate(() => JSON.stringify(localStorage));
  expect(guardado).toContain("maria@exemplo.com");
  expect(guardado).not.toContain("tk-");

  // ao voltar, a conta é lembrada e basta reconectar (sem criar outro conta.json)
  await page.reload();
  await page.waitForFunction(() => window.Account);
  await page.click("#open-toc");
  await page.click('#toc .toc-tabs a[href="#toc-voce"]');
  await expect(page.locator("#conta")).toContainText("Reconectar");
  await page.click("#account-signin");
  await expect(page.locator("#conta .account-drive")).toHaveText("Google Drive conectado · 1 aparelho");
  expect(arquivos.size).toBe(1);
  expect(await page.evaluate(() => window.__gisPedidos.at(-1))).toMatchObject({ login_hint: "maria@exemplo.com" });
});

test("sem a permissão do Drive, explica e continua sem conta", async ({ page }) => {
  await simularGoogle(page);
  await abrirIndice(page);
  await page.evaluate(() => {
    window.__gisModo = "sem-drive";
  });
  await page.click("#account-signin");
  await expect(page.locator("#conta .account-error")).toContainText("deixe marcada a permissão");
  await expect(page.locator("#account-signin")).toContainText("Entrar com Google");
  expect(await page.evaluate(() => window.Account.status())).toBe("signed-out");
});

test("fechar a janela do Google não mostra erro", async ({ page }) => {
  await simularGoogle(page);
  await abrirIndice(page);
  await page.evaluate(() => {
    window.__gisModo = "cancelar";
  });
  await page.click("#account-signin");
  await expect(page.locator("#account-signin")).toBeEnabled();
  await expect(page.locator("#conta .account-error")).toHaveCount(0);
});

test("sair esquece a conta e mantém as anotações no aparelho", async ({ page }) => {
  await simularGoogle(page);
  await abrirIndice(page);
  await page.evaluate(async () => {
    await window.Annotations.save("favoritos", {
      id: crypto.randomUUID(),
      cap: "GEN.1",
      ancora: { livro: "GEN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" }
    });
  });
  await page.click("#account-signin");
  await expect(page.locator("#account-sync")).toContainText("Sincronizado");
  await page.click("#account-signout");
  await expect(page.locator(".account-box")).toContainText("continuam guardadas no seu Google Drive");
  await page.click('.account-box button[data-r="manter"]');
  await expect(page.locator("#account-signin")).toContainText("Entrar com Google");
  expect(await page.evaluate(() => window.__revogado)).toMatch(/^tk-/);
  expect(await page.evaluate(() => localStorage.getItem("interlinear:conta"))).toBeNull();
  expect(await page.evaluate(() => window.Annotations.countAll())).toBe(1);
});

test("depois da primeira anotação sugere guardar no Drive; “Agora não” não pergunta mais", async ({ page }) => {
  await simularGoogle(page);
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Account && window.Annotations);
  await expect(page.locator("#account-suggestion")).toBeHidden();
  await page.evaluate(async () => {
    await window.Annotations.save("favoritos", {
      id: crypto.randomUUID(),
      cap: "GEN.1",
      ancora: { livro: "GEN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" }
    });
  });
  await expect(page.locator("#account-suggestion")).toBeVisible();
  await page.click("#cs-dismiss");
  await expect(page.locator("#account-suggestion")).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.Account && window.Annotations);
  await page.evaluate(async () => {
    await window.Annotations.save("favoritos", {
      id: crypto.randomUUID(),
      cap: "GEN.1",
      ancora: { livro: "GEN", cap: 1, ver: 2, ver_fim: 2, camada: "versiculo" }
    });
  });
  await page.waitForTimeout(2000);
  await expect(page.locator("#account-suggestion")).toBeHidden();
});

test("a sugestão do Drive sai da frente quando o painel de anotar abre e volta depois", async ({ page }) => {
  await simularGoogle(page);
  await page.goto("ler.html#GEN.1");
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(() => window.Account && window.Annotations);
  await page.evaluate(async () => {
    await window.Annotations.save("favoritos", {
      id: crypto.randomUUID(),
      cap: "GEN.1",
      ancora: { livro: "GEN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" }
    });
  });
  await expect(page.locator("#account-suggestion")).toBeVisible();
  await page.click("#v2 .vmark");
  await expect(page.locator("#account-suggestion")).toBeHidden();
  await page.fill("#mb-tag-name", "criação");
  await page.click("#mb-new-tag");
  await page.click("#mb-close");
  await expect(page.locator("#account-suggestion")).toBeVisible();
});

test("foto (só com FOTOS=1)", async ({ page }, info) => {
  test.skip(!process.env.FOTOS);
  await simularGoogle(page);
  await abrirIndice(page);
  await page.screenshot({ path: `${process.env.FOTOS}/conta-fora-${info.project.name}.png` });
  await page.click("#account-signin");
  await expect(page.locator("#conta .account-drive")).toContainText("conectado");
  await page.screenshot({ path: `${process.env.FOTOS}/conta-ligado-${info.project.name}.png` });
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    localStorage.removeItem("interlinear:conta-sugestao");
  });
});
