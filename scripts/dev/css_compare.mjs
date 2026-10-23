// Proves that a CSS change changes nothing on screen: compares the computed style of every element of the reader
// between two builds, in several states, on phone and computer.
//   cp -r build/web build/web-before      (before the change)
//   npm run build:web                      (after it)
//   node scripts/dev/css_compare.mjs [state…]
// Custom properties are left out (tokens can be added or renamed); what they resolve to is in the real properties.
import { chromium } from "@playwright/test";
import { serveStatic } from "../lib/static-server.mjs";

const before = await serveStatic("build/web-before");
const after = await serveStatic("build/web");
const browser = await chromium.launch();
const VIEWS = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  tablet: { viewport: { width: 900, height: 1000 } },
  desktop: { viewport: { width: 1280, height: 860 } }
};
// a highlight, a favorite and a note on verse 1, then Anotar closed
const annotateVerse = async p => {
  await p.click("#v1 .vmark");
  await p.click('#mbar .mb-color[data-cor="amarelo"]');
  await p.click('#mbar [data-action="fav"]');
  await p.fill("#mb-note", "uma nota");
  await p.waitForTimeout(900);
  await p.keyboard.press("Escape");
};
const pickMode = id => async p => {
  await p.click("#open-look");
  await p.click(`#look [data-modo="${id}"]`);
  await p.keyboard.press("Escape");
};
const STATES = {
  interlinear: ["PSA.117", async () => {}],
  long: ["GEN.1", async () => {}],
  biblia: ["PSA.117", pickMode("biblia")],
  original: ["PSA.117", pickMode("original")],
  estudo: ["PSA.117", pickMode("estudo")],
  toc: ["PSA.117", p => p.click("#open-toc")],
  chapters: ["PSA.117", p => p.click("#where")],
  you: ["PSA.117", async p => (await p.click("#open-toc"), p.click('.toc-tabs [href="#toc-voce"]'))],
  look: ["PSA.117", p => p.click("#open-look")],
  entry: ["PSA.117", p => p.click('.word[data-v="1"][data-i="0"]')],
  annotate: ["PSA.117", p => p.click("#v1 .vmark")],
  notes: ["PSA.117", p => p.evaluate(() => window.Annotations.openList())],
  search: ["PSA.117", p => p.click("#open-search")],
  about: ["RUT.1", p => p.click("#chip-about")],
  psalm119: ["PSA.119", p => p.evaluate(() => scrollTo(0, 3000))],
  playing: ["PSA.117", p => p.evaluate(() => document.body.classList.add("tocando"))],
  focus: ["PSA.117", p => p.evaluate(() => document.body.classList.add("foco", "barras-fora"))],
  annotated: ["PSA.117", annotateVerse],
  annotationsHidden: ["PSA.117", async p => (await annotateVerse(p), p.evaluate(() => document.body.classList.add("hide-ann")))],
  easy: ["PSA.117", p => p.evaluate(() => document.body.classList.add("font-easy", "spacious"))],
  dark: ["PSA.117", null]
};
const only = process.argv.slice(2);

async function snapshot(base, opts, ref, act, dark) {
  const ctx = await browser.newContext({ ...opts, baseURL: base, locale: "pt-BR", serviceWorkers: "block", reducedMotion: "reduce" });
  await ctx.addInitScript(dark => {
    localStorage.setItem("interlinear:conta-sugestao", "nao");
    if (!localStorage.getItem("interlinear:modo")) localStorage.setItem("interlinear:modo", "interlinear");
    for (const d of ["palavra", "versiculo", "verbete"]) localStorage.setItem("interlinear:dica-" + d, "vista");
    if (dark) localStorage.setItem("interlinear:tema", "escuro");
  }, dark);
  const p = await ctx.newPage();
  await p.goto(`ler.html#${ref}`);
  await p.waitForSelector(".verse");
  await p.waitForTimeout(300);
  if (act) await act(p);
  await p.waitForTimeout(500);
  const res = await p.evaluate(() => {
    const out = {};
    const key = el => {
      const parts = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement)
        parts.unshift(e.tagName.toLowerCase() + (e.id ? "#" + e.id : ":" + [...e.parentElement.children].indexOf(e)));
      return parts.join(">");
    };
    for (const el of [document.documentElement, ...document.querySelectorAll("body *")].slice(0, 2500)) {
      const cs = getComputedStyle(el);
      const s = [];
      for (let i = 0; i < cs.length; i++) if (!cs[i].startsWith("--")) s.push(cs[i] + ":" + cs.getPropertyValue(cs[i]));
      for (const pe of ["::before", "::after"]) {
        const c2 = getComputedStyle(el, pe);
        if (c2.content && c2.content !== "none")
          for (let i = 0; i < c2.length; i++)
            if (!c2[i].startsWith("--")) s.push(pe.slice(2) + "/" + c2[i] + ":" + c2.getPropertyValue(c2[i]));
      }
      out[key(el)] = s.sort().join(";");
    }
    return out;
  });
  await ctx.close();
  return res;
}
const props = s => Object.fromEntries(s.split(";").map(x => [x.slice(0, x.indexOf(":")), x.slice(x.indexOf(":") + 1)]));
let diffs = 0;
for (const [view, opts] of Object.entries(VIEWS))
  for (const [state, [ref, act]] of Object.entries(STATES)) {
    if (only.length && !only.includes(state)) continue;
    const a = await snapshot(before.base, opts, ref, act, state === "dark");
    const b = await snapshot(after.base, opts, ref, act, state === "dark");
    let n = 0;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[k] === b[k]) continue;
      if (++n > 12) continue;
      if (!a[k] || !b[k]) {
        console.log(`${view}/${state} ${k.slice(-90)}: only ${a[k] ? "before" : "after"}`);
        continue;
      }
      const pa = props(a[k]),
        pb = props(b[k]);
      const changed = [...new Set([...Object.keys(pa), ...Object.keys(pb)])].filter(p => pa[p] !== pb[p]);
      console.log(
        `${view}/${state} ${k.slice(-90)}: ${changed
          .slice(0, 6)
          .map(p => `${p} ${pa[p]} → ${pb[p]}`)
          .join(" | ")}`
      );
    }
    if (n) console.log(`${view}/${state}: ${n} elements differ`);
    diffs += n;
  }
console.log(diffs ? `${diffs} differences` : "no differences");
await browser.close();
before.close();
after.close();
process.exit(diffs ? 1 : 0);
