// Shared helpers for the Playwright specs: open the reader, create extra "devices", sign in and open the index tabs.
import { expect } from "@playwright/test";
import { simularGoogle } from "./fake-google.mjs";

const ACCOUNT_HINT_KEY = "interlinear:conta-sugestao";

/**
 * Opens the reader at a reference (e.g. "GEN.1") and waits for the first verse.
 * hideAccountHint: skip the "save to Google Drive" suggestion; skipWelcome: answer the first-run mode question.
 */
export async function openReader(page, ref = "GEN.1", { hideAccountHint = false, skipWelcome = false } = {}) {
  if (hideAccountHint) await page.addInitScript(key => localStorage.setItem(key, "nao"), ACCOUNT_HINT_KEY);
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
  if (skipWelcome) {
    const welcome = page.locator("#welcome");
    if (await welcome.isVisible()) await welcome.locator('button[data-modo="interlinear"]').click();
  }
}

/**
 * Opens a new "device": its own browser context (own database and device id) with the same viewport as the
 * current project, the Google services faked and connected to `cloud`.
 * init: [fn, arg] passed to addInitScript; ready: a function evaluated in the page that must become truthy.
 */
export async function newDevice(browser, info, { cloud, ref = "GEN.1", timezoneId, init, ready } = {}) {
  const u = info.project.use;
  const ctx = await browser.newContext({
    viewport: u.viewport,
    userAgent: u.userAgent,
    deviceScaleFactor: u.deviceScaleFactor,
    isMobile: u.isMobile,
    hasTouch: u.hasTouch,
    locale: "pt-BR",
    baseURL: u.baseURL || "http://localhost:8790/",
    serviceWorkers: "block",
    timezoneId
  });
  if (init) await ctx.addInitScript(...init);
  const page = await ctx.newPage();
  await simularGoogle(page, { nuvem: cloud });
  await page.goto(`ler.html#${ref}`);
  await expect(page.locator(".verse").first()).toBeVisible();
  await page.waitForFunction(ready || (() => window.Account && window.Sync));
  return page;
}

/** Opens one tab of the index sheet: "livros", "notas" or "voce" (the tab ids are stored in the page). */
export async function openIndexTab(page, tab) {
  if (!(await page.locator("#toc").isVisible())) await page.click("#open-toc");
  await page.click(`#toc .toc-tabs a[href="#toc-${tab}"]`);
}

/** Signs in with the fake Google account and waits for the first sync; closes the index afterwards. */
export async function signIn(page, { timeout = 20000 } = {}) {
  await openIndexTab(page, "voce");
  await page.click("#account-signin");
  await expect(page.locator("#account-sync")).toContainText("Sincronizado", { timeout });
  await page.keyboard.press("Escape");
}
