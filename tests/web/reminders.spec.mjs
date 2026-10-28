// Verse of the day (Você, everywhere) and reminders (only in the app: system notifications, faked here as the
// Capacitor LocalNotifications plugin of an Android app).
import { test, expect } from "@playwright/test";
import { openIndexTab, openReader } from "./helpers.mjs";

test.use({ serviceWorkers: "block" });

// an Android app with the LocalNotifications plugin; what it schedules goes to window.__scheduled
const fakeApp = permission =>
  (answer => {
    window.__scheduled = [];
    window.__permissionAsked = 0;
    let tap = null;
    const LocalNotifications = {
      checkPermissions: async () => ({ display: window.__permission }),
      requestPermissions: async () => {
        window.__permissionAsked++;
        window.__permission = answer;
        return { display: answer };
      },
      schedule: async o => {
        window.__scheduled = o.notifications;
      },
      cancel: async () => {},
      getPending: async () => ({ notifications: window.__scheduled.map(n => ({ id: n.id })) }),
      addListener: (_ev, fn) => {
        tap = fn;
        return { remove() {} };
      }
    };
    window.__permission = "prompt";
    window.__tap = ref => tap && tap({ notification: { extra: { ref } } });
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "android", Plugins: { LocalNotifications } };
  })(permission);

test("versículo do dia na aba Você: o texto da Bíblia Livre e o caminho até ele", async ({ page }) => {
  await openReader(page, "GEN.1", { hideAccountHint: true, skipWelcome: true });
  await openIndexTab(page, "voce");
  const card = page.locator("#vc-verse-card");
  await expect(card).toBeVisible();
  const ref = await card.locator(".vc-verse-ref").textContent();
  expect(ref).toMatch(/^.+ \d+:\d+/);
  await expect(card.locator(".vc-verse-text")).not.toBeEmpty();
  await page.click("#vc-verse-read");
  const chapter = ref.replace(/:.*$/, "");
  await expect(page.locator("#h1")).toContainText(chapter);
  // on the web the reminders are only mentioned
  await openIndexTab(page, "voce");
  await expect(page.locator("#vc-reminders-card")).toHaveCount(0);
  await expect(page.locator(".vc-rem-web")).toContainText("app para Android");
});

test("no app: ligar o lembrete pede a permissão e agenda os próximos dias; mudar o horário agenda de novo", async ({ page }) => {
  await page.addInitScript(fakeApp, "granted");
  await openReader(page, "JHN.3", { hideAccountHint: true, skipWelcome: true });
  await openIndexTab(page, "voce");
  await expect(page.locator("#vc-reminders-card")).toBeVisible();
  await expect(page.locator("#vc-rem-next")).toHaveText("Nenhum lembrete ligado.");
  await page.click("#rem-reading");
  await expect(page.locator("#rem-reading")).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => window.__permissionAsked)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__scheduled.length)).toBeGreaterThanOrEqual(13);
  const first = await page.evaluate(() => window.__scheduled[0]);
  expect(first.title).toBe("Hora da leitura");
  expect(first.body).toBe("Continue de onde parou: João 3");
  expect(first.extra.ref).toBe("JHN.3");
  await expect(page.locator("#vc-rem-next")).toContainText(/às 07:00/);

  await page.fill("#rem-reading-time", "21:30");
  await page.locator("#rem-reading-time").dispatchEvent("change");
  await expect.poll(() => page.evaluate(() => new Date(window.__scheduled[0].schedule.at).getHours())).toBe(21);
  await expect(page.locator("#vc-rem-next")).toContainText(/às 21:30/);

  // the verse of the day too: both kinds scheduled
  await page.click("#rem-verse");
  await expect.poll(() => page.evaluate(() => window.__scheduled.some(n => n.title.startsWith("Versículo do dia")))).toBe(true);
});

test("no app: notificações bloqueadas não ligam o lembrete e o cartão explica", async ({ page }) => {
  await page.addInitScript(fakeApp, "denied");
  await openReader(page, "GEN.1", { hideAccountHint: true, skipWelcome: true });
  await openIndexTab(page, "voce");
  await page.click("#rem-reading");
  await expect(page.locator("#rem-reading")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#vc-reminders-card")).toContainText("bloqueadas");
  expect(await page.evaluate(() => window.__scheduled.length)).toBe(0);
});

test("no app: tocar num lembrete abre o capítulo e o versículo dele", async ({ page }) => {
  await page.addInitScript(fakeApp, "granted");
  await openReader(page, "GEN.1", { hideAccountHint: true, skipWelcome: true });
  await page.evaluate(() => window.__tap("JHN.3.16"));
  await expect(page.locator("#h1")).toContainText("João 3");
  await expect(page.locator("#v16")).toBeInViewport();
});
