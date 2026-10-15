// Imprime em PDF os HTML gerados por scripts/build_pdf.py, com o Chromium do Playwright.
// Uso: node scripts/print_pdf.mjs build/pdf-build/jobs.json
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
for (const [src, out, title] of jobs) {
  const t0 = Date.now();
  await page.goto(pathToFileURL(src).href, { waitUntil: "load", timeout: 0 });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: out,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:7px;width:100%;text-align:center;color:#888">${title}</div>`,
    footerTemplate: `<div style="font-size:7px;width:100%;text-align:center;color:#888"><span class="pageNumber"></span></div>`,
    margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    timeout: 0,
    tagged: false // marcadores são criados depois, em build_pdf.py (com "tagged" o Chromium fica ~25x mais lento)
  });
  console.log(`${path.basename(out)}  ${Math.round(fs.statSync(out).size / 1024)} KB  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
