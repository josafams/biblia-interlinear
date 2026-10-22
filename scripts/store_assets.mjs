// Gera as imagens da ficha da Play Store em build/store, a partir do site já gerado (build/web):
//   phone-1..6.png   capturas de tela do celular (1080×1920)
//   feature.png      imagem de destaque (1024×500)
//   icon-512.png     ícone (cópia de build/web/icones/icone-512.png)
// Uso: node scripts/build_web.mjs && node scripts/store_assets.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB = path.join(ROOT, "build", "web");
const OUT = path.join(ROOT, "build", "store");
if (!fs.existsSync(path.join(WEB, "ler.html"))) throw new Error("build/web não existe: rode node scripts/build_web.mjs antes");
fs.mkdirSync(OUT, { recursive: true });

const exe = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const reader = pathToFileURL(path.join(WEB, "ler.html")).href;

// Cada cena: modo de leitura, capítulo e o que fazer antes da foto
const scenes = [
  { name: "phone-1", mode: "interlinear", ref: "GEN.1", verse: 1 },
  { name: "phone-2", mode: "estudo", ref: "JHN.1", verse: 1 },
  {
    name: "phone-3",
    mode: "interlinear",
    ref: "JHN.1",
    verse: 1,
    act: page => page.locator('.word[data-v="0"][data-i="2"]').click(),
    wait: "#detail"
  },
  { name: "phone-4", mode: "biblia", ref: "PSA.23", verse: 1 },
  { name: "phone-5", mode: "paralelo", ref: "ROM.8", verse: 28, theme: "noite" },
  {
    name: "phone-6",
    mode: "interlinear",
    ref: "GEN.1",
    act: async page => {
      await page.click("#open-toc");
      await page.locator("#toc").waitFor();
      // rola o índice até a lista dos livros
      await page.evaluate(() => document.getElementById("bk-h")?.scrollIntoView({ block: "start" }));
    }
  }
];

for (const s of scenes) {
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: "pt-BR",
    colorScheme: s.theme ? "dark" : "light"
  });
  await ctx.addInitScript(
    ([, theme]) => {
      localStorage.setItem("interlinear:conta-sugestao", "nao");
      if (theme) localStorage.setItem("interlinear:tema", theme);
    },
    [s.mode, s.theme || ""]
  );
  const page = await ctx.newPage();
  await page.goto(`${reader}#${s.ref}`);
  await page.locator(".verse").first().waitFor();
  // escolhe o modo pela própria tela, como a pessoa faria (a primeira abertura pergunta como ler)
  const welcome = page.locator("#welcome");
  if (await welcome.isVisible()) await welcome.locator('button[data-modo="interlinear"]').click();
  if (s.mode !== "interlinear") {
    await page.click("#open-look");
    await page.locator(`.mcard[data-modo="${s.mode}"]`).dispatchEvent("click");
    await page.keyboard.press("Escape");
    await page.evaluate(() => document.activeElement?.blur());
  }
  await page.evaluate(() => document.fonts.ready);
  if (s.verse)
    // começa no versículo (acima dele ficam o tema, a ajuda e "Sobre o livro"), descontando a barra do topo
    await page.evaluate(n => {
      const v = document.getElementById("v" + n);
      const bar = document.querySelector(".bar");
      window.scrollTo(0, v.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight + 8 : 8));
    }, s.verse);
  if (s.act) await s.act(page);
  if (s.wait) await page.locator(s.wait).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
  console.log(`${s.name}.png  ${s.mode} ${s.ref}`);
  await ctx.close();
}

// Imagem de destaque: título, subtítulo e uma linha interlinear de Gênesis 1:1
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
const icon = fs.readFileSync(path.join(ROOT, "web", "icones", "icone.svg"), "utf8");
await page.setContent(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(path.join(WEB, "fonts", "fonts.css")).href}">
<style>
  body { margin: 0; width: 1024px; height: 500px; background: #1d5b74; color: #f8f9f6; display: flex; align-items: center;
    font-family: Literata, Georgia, serif; overflow: hidden; }
  .icon { width: 200px; height: 200px; margin: 0 56px 0 72px; flex: none; border-radius: 44px; overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,.25); }
  .icon svg { width: 100%; height: 100%; display: block; }
  h1 { font-size: 64px; margin: 0 0 10px; line-height: 1.05; }
  p { font-size: 26px; margin: 0 0 28px; color: #dbe8ec; max-width: 620px; line-height: 1.3; }
  .row { display: flex; gap: 22px; direction: rtl; justify-content: flex-end; }
  .w { text-align: center; direction: ltr; }
  .w b { display: block; font: 40px "Noto Serif Hebrew", serif; }
  .w span { font-size: 18px; color: #dbe8ec; }
</style></head><body>
<div class="icon">${icon}</div>
<div><h1>Bíblia Interlinear</h1><p>Hebraico, aramaico e grego palavra por palavra, com a Bíblia Livre</p>
<div class="row">
  <div class="w"><b>בְּרֵאשִׁ֖ית</b><span>no-princípio</span></div>
  <div class="w"><b>בָּרָ֣א</b><span>criou</span></div>
  <div class="w"><b>אֱלֹהִ֑ים</b><span>Deus</span></div>
</div></div></body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(OUT, "feature.png") });
console.log("feature.png");

fs.copyFileSync(path.join(WEB, "icones", "icone-512.png"), path.join(OUT, "icon-512.png"));
await browser.close();
console.log(`Imagens da Play Store em ${path.relative(ROOT, OUT)}/`);
