// Testes do site no navegador: npx playwright test  (gere o site antes: node scripts/build_web.mjs)
import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const PORTA = 8790;

export default defineConfig({
  testDir: "tests/web",
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "build/test-report" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORTA}/`,
    launchOptions: exe ? { executablePath: exe } : {},
    locale: "pt-BR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: `python3 -m http.server ${PORTA} --directory build/web`,
    port: PORTA,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore"
  },
  projects: [
    { name: "celular", use: { ...devices["Pixel 7"], browserName: "chromium" } },
    { name: "computador", use: { viewport: { width: 1280, height: 860 }, browserName: "chromium" } }
  ],
  outputDir: "build/test-results"
});
