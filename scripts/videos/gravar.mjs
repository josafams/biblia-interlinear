// Grava os vídeos "Como usar" a partir dos roteiros (scripts/videos/roteiros.mjs), com o Playwright.
// Para cada vídeo e aparelho (phone 390×844, desktop 1280×800) gera em build/videos:
//   <id>-<aparelho>.mp4   vídeo H.264 sem som (ffmpeg)
//   <id>-<aparelho>.vtt   legendas (uma por passo, com os tempos reais)
//   <id>-<aparelho>.jpg   capa
//   videos.js             índice lido pela página inicial (window.__videos)
// Uso:
//   node scripts/videos/gravar.mjs                 grava todos (o site precisa estar gerado em build/web)
//   node scripts/videos/gravar.mjs 01 05           só esses vídeos
//   node scripts/videos/gravar.mjs --verificar     só executa os roteiros, sem gravar (rápido; usado nos testes)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium, devices } from "playwright";
import { videos } from "./roteiros.mjs";
import { simularGoogle } from "../../tests/web/fake-google.mjs";
import { serveStatic } from "../lib/static-server.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = path.join(ROOT, "build/web");
const OUT = path.join(ROOT, "build/videos");
const args = process.argv.slice(2);
const VERIFICAR = args.includes("--verificar");
const quais = args.filter(a => !a.startsWith("--"));
const APARELHOS = {
  phone: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }
};

// ---- static server for build/web ----
const servidor = await serveStatic(WEB);
const BASE = servidor.base;

// ---- ajudante usado pelos roteiros ----
function ajudante(page, rapido) {
  const pausa = ms => page.waitForTimeout(rapido ? Math.min(ms, 150) : ms);
  async function dedo(box, apertar) {
    await page.evaluate(
      ([x, y, a]) => {
        let d = document.getElementById("__dedo");
        if (!d) {
          d = document.createElement("div");
          d.id = "__dedo";
          d.style.cssText =
            "position:fixed;z-index:2147483647;width:38px;height:38px;margin:-19px 0 0 -19px;border-radius:50%;" +
            "background:rgba(29,91,116,.22);border:2px solid rgba(29,91,116,.75);pointer-events:none;transition:left .35s,top .35s,transform .15s,opacity .3s;opacity:0";
          document.body.appendChild(d);
        }
        d.style.left = x + "px";
        d.style.top = y + "px";
        d.style.opacity = "1";
        d.style.transform = a ? "scale(.75)" : "scale(1)";
      },
      [box.x + box.width / 2, box.y + box.height / 2, apertar]
    );
  }
  const some = () =>
    page.evaluate(() => {
      const d = document.getElementById("__dedo");
      if (d) d.style.opacity = "0";
    });
  async function targetEl(sel) {
    const el = page.locator(sel).first();
    await el.waitFor({ state: "visible", timeout: 8000 });
    await el.scrollIntoViewIfNeeded();
    return el;
  }
  return {
    page,
    pausa,
    async tocar(sel) {
      const el = await targetEl(sel);
      const box = await el.boundingBox();
      await dedo(box, false);
      await pausa(450);
      await dedo(box, true);
      await pausa(150);
      await el.click();
      await dedo(box, false);
      await pausa(350);
      await some();
      await pausa(500);
    },
    async digitar(sel, texto) {
      await this.tocar(sel);
      await page.locator(sel).first().fill("");
      await page
        .locator(sel)
        .first()
        .pressSequentially(texto, { delay: rapido ? 0 : 110 });
      await pausa(500);
    },
    async onKey(k) {
      await page.keyboard.press(k);
      await pausa(700);
    },
    async toqueLongo(sel) {
      const el = await targetEl(sel);
      const box = await el.boundingBox();
      await dedo(box, false);
      await pausa(350);
      await dedo(box, true);
      await pausa(700);
      await el.dispatchEvent("contextmenu");
      await dedo(box, false);
      await some();
      await pausa(700);
    },
    async selecionar(sel, texto) {
      const el = await targetEl(sel);
      const box = await el.boundingBox();
      await dedo(box, true);
      await pausa(400);
      await page.evaluate(
        ([s, t]) => {
          const bl = document.querySelector(s),
            n = [...bl.childNodes].find(x => x.nodeType === 3 && x.textContent.includes(t));
          const i = n.textContent.indexOf(t),
            r = document.createRange();
          r.setStart(n, i);
          r.setEnd(n, i + t.length);
          getSelection().removeAllRanges();
          getSelection().addRange(r);
        },
        [sel, texto]
      );
      await some();
      await pausa(1300);
    },
    async limparSelecao() {
      await page.evaluate(() => getSelection().removeAllRanges());
    },
    async focar(sel) {
      await (await targetEl(sel)).focus();
      await pausa(600);
    },
    async doScroll(px) {
      await page.evaluate(px => window.scrollBy({ top: px, behavior: "smooth" }), px);
      await pausa(1200);
    },
    async rolarAte(sel) {
      await page.locator(sel).first().waitFor({ state: "attached", timeout: 8000 });
      await page.evaluate(s => document.querySelector(s).scrollIntoView({ behavior: "smooth", block: "center" }), sel);
      await pausa(1300);
    },
    async rolarPainel(sel, px) {
      await page.evaluate(
        ([s, px]) => {
          const el = document.querySelector(s);
          (el.querySelector(".sbody, .dbody, .d-body") || el).scrollBy({ top: px, behavior: "smooth" });
        },
        [sel, px]
      );
      await pausa(1200);
    },
    async realcar(sel) {
      const el = await targetEl(sel);
      const box = await el.boundingBox();
      await page.evaluate(b => {
        const r = document.createElement("div");
        r.className = "__realce";
        r.style.cssText =
          `position:fixed;z-index:2147483646;left:${b.x - 6}px;top:${b.y - 6}px;width:${b.width + 12}px;height:${b.height + 12}px;` +
          "border:3px solid #d08a2c;border-radius:12px;pointer-events:none;box-shadow:0 0 0 9999px rgba(0,0,0,.12)";
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 2200);
      }, box);
      await pausa(400);
    },
    esperar: ms => pausa(ms)
  };
}

// Grava a tela pelo screencast do Chromium (quadros JPEG com a hora de chegada), sem depender do ffmpeg do Playwright.
async function save(page, disp, dir, t0) {
  const cdp = await page.context().newCDPSession(page);
  const quadros = [];
  let n = 0;
  cdp.on("Page.screencastFrame", async f => {
    const file = path.join(dir, `q${String(n++).padStart(5, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, "base64"));
    quadros.push({ file, t: (Date.now() - t0) / 1000 });
    cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  const k = disp.deviceScaleFactor || 1;
  await cdp.send("Page.startScreencast", {
    format: "jpeg",
    quality: 90,
    maxWidth: disp.viewport.width * k,
    maxHeight: disp.viewport.height * k
  });
  // Mantém pelo menos um quadro a cada 0,5 s mesmo com a tela parada
  const pulso = setInterval(
    () =>
      page
        .evaluate(() => {
          document.documentElement.dataset.pulso = Date.now();
        })
        .catch(() => {}),
    500
  );
  return {
    async halt() {
      clearInterval(pulso);
      await cdp.send("Page.stopScreencast").catch(() => {});
      // tela parada (ex.: um iframe cobrindo tudo) pode não gerar quadros: o último fica até o fim
      quadros.fim = (Date.now() - t0) / 1000;
      return quadros;
    }
  };
}

// WebM (VP9) além do MP4 (H.264): navegadores sem H.264 (Chromium aberto, alguns Linux) tocam o WebM.
function webm(mp4) {
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    mp4,
    "-c:v",
    "libvpx-vp9",
    "-b:v",
    "0",
    "-crf",
    "40",
    "-deadline",
    "good",
    "-cpu-used",
    "5",
    "-row-mt",
    "1",
    "-an",
    mp4.replace(/\.mp4$/, ".webm")
  ]);
}

const vtt = (ts, steps, fim) =>
  "WEBVTT\n\n" +
  steps
    .map((p, i) => {
      const f = s => new Date(Math.max(0, s) * 1000).toISOString().slice(11, 23);
      return `${i + 1}\n${f(ts[i])} --> ${f(i + 1 < ts.length ? ts[i + 1] : fim)}\n${p.legenda}\n`;
    })
    .join("\n");

// ---- gravação ----
const browser = await chromium.launch(fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {});
if (!VERIFICAR) fs.mkdirSync(OUT, { recursive: true });
const indice = fs.existsSync(path.join(OUT, "indice.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "indice.json"), "utf8")) : {};
// índices gravados antes da troca de nomes usavam celular/computador e capa/tempos/duracao
for (const porAparelho of Object.values(indice))
  for (const [antigo, novo] of [
    ["celular", "phone"],
    ["computador", "desktop"]
  ])
    if (porAparelho[antigo]) {
      const { capa, tempos, duracao, ...resto } = porAparelho[antigo];
      porAparelho[novo] ??= { ...resto, cover: capa, times: tempos, duration: duracao };
      delete porAparelho[antigo];
    }
let falhas = 0;
function salvarIndice() {
  fs.writeFileSync(path.join(OUT, "indice.json"), JSON.stringify(indice, null, 1));
  fs.writeFileSync(
    path.join(OUT, "videos.js"),
    `// Gerado por scripts/videos/gravar.mjs\nwindow.__videos = ${JSON.stringify({ files: indice })};\n`
  );
}
for (const v of videos) {
  if (v.ready === false || v.manual || !v.steps.length) continue;
  if (quais.length && !quais.includes(v.id)) continue;
  for (const [nome, disp] of Object.entries(APARELHOS)) {
    if (v.os && v.os !== nome) continue;
    const tmp = fs.mkdtempSync(path.join(OUT.replace(/videos$/, ""), "gravacao-"));
    const ctx = await browser.newContext({
      ...disp,
      locale: "pt-BR",
      colorScheme: "light",
      reducedMotion: "no-preference"
    });
    // Começa no modo Interlinear, sem o aviso de primeira abertura (a não ser que o roteiro peça outro modo)
    await ctx.addInitScript(m => {
      try {
        if (!localStorage.getItem("interlinear:modo")) localStorage.setItem("interlinear:modo", m);
        // a sugestão "guardar no Google Drive" (depois da 1ª anotação) cobriria a tela nos vídeos
        localStorage.setItem("interlinear:conta-sugestao", "nao");
        // as dicas de primeiro uso também cobririam o que o vídeo mostra
        for (const d of ["palavra", "versiculo", "verbete"]) localStorage.setItem("interlinear:dica-" + d, "vista");
      } catch (_) {}
    }, v.modo || "interlinear");
    const page = await ctx.newPage();
    const t0 = Date.now();
    const gravador = VERIFICAR ? null : await save(page, disp, tmp, t0);
    const t = ajudante(page, VERIFICAR);
    const tempos = [];
    try {
      // vídeos da conta: Google simulado, com uma conta fictícia (nada sai para a internet)
      if (v.google) t.nuvem = await simularGoogle(page, { profile: { name: "Maria Souza", email: "maria.souza@exemplo.com" } });
      await page.goto(`${BASE}ler.html#${v.inicio || "GEN.1"}`);
      await page.locator(".verse").first().waitFor({ timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      if (v.prepare) {
        await page.waitForFunction(() => window.Annotations);
        await v.prepare(page);
        await page.reload();
        await page.locator(".verse").first().waitFor();
      }
      if (v.before) await v.before(t); // preparação que fica fora do corte do vídeo
      await t.pausa(900);
      const inicio = (Date.now() - t0) / 1000 - 0.3;
      for (const p of v.steps) {
        tempos.push((Date.now() - t0) / 1000 - inicio);
        await p.faz(t);
        await t.pausa(Math.max(1600, p.legenda.length * 45));
      }
      const fim = (Date.now() - t0) / 1000 - inicio + 0.6;
      await t.pausa(600);
      const quadros = gravador ? await gravador.halt() : null;
      await ctx.close();
      if (VERIFICAR) {
        console.log(`ok  ${v.id} ${nome}  ${v.titulo}`);
        continue;
      }
      const listSheet = path.join(tmp, "quadros.txt");
      fs.writeFileSync(
        listSheet,
        quadros
          .map((q, i) => `file '${q.file}'\nduration ${((quadros[i + 1]?.t ?? Math.max(q.t + 0.5, quadros.fim)) - q.t).toFixed(3)}`)
          .join("\n") + `\nfile '${quadros.at(-1).file}'\n`
      );
      const base = path.join(OUT, `${v.id}-${nome}`);
      const escala = nome === "phone" ? "540:-2" : "1280:-2";
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listSheet,
        "-ss",
        inicio.toFixed(2),
        "-t",
        fim.toFixed(2),
        "-vf",
        `scale=${escala},fps=24`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "26",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        "-an",
        `${base}.mp4`
      ]);
      webm(`${base}.mp4`);
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-sseof",
        "-1.2",
        "-i",
        `${base}.mp4`,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        `${base}.jpg`
      ]);
      fs.writeFileSync(`${base}.vtt`, vtt(tempos, v.steps, fim));
      const sec = Math.round(fim);
      indice[v.id] = indice[v.id] || {};
      indice[v.id][nome] = {
        webm: `videos/${v.id}-${nome}.webm`,
        mp4: `videos/${v.id}-${nome}.mp4`,
        vtt: `videos/${v.id}-${nome}.vtt`,
        cover: `videos/${v.id}-${nome}.jpg`,
        times: tempos.map(x => +x.toFixed(2)),
        duration: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
      };
      salvarIndice();
      console.log(`${v.id} ${nome}  ${sec}s  ${Math.round(fs.statSync(`${base}.mp4`).size / 1024)} KB  ${v.titulo}`);
    } catch (e) {
      falhas++;
      console.error(`FALHOU ${v.id} ${nome} (${v.titulo}), passo ${tempos.length}: ${e.message.split("\n")[0]}`);
      await ctx.close().catch(() => {});
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}
await browser.close();
servidor.close();
if (args.includes("--so-webm")) process.exit(0);
if (!VERIFICAR) salvarIndice();
if (falhas) {
  console.error(`${falhas} roteiro(s) falharam`);
  process.exit(1);
}
