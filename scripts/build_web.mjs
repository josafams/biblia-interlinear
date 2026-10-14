// Gera a versão web instalável (PWA) em saida/web — a mesma pasta que vira o app
// Android/iOS pelo Capacitor. Fontes ficam locais (funciona offline e não chama o Google).
// Uso: node scripts/build_web.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "saida/web");
const r = p => path.join(ROOT, p);
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "fonts"), { recursive: true });
fs.mkdirSync(path.join(OUT, "icones"), { recursive: true });

const APP = {
  name: "Bíblia Interlinear",
  short: "Interlinear",
  desc: "A Bíblia inteira em hebraico, aramaico e grego, com transliteração, pronúncia, glosa em português, verbetes, áudio e o texto da Bíblia Livre.",
  bg: "#eceeea",
  theme: "#1d5b74"
};

// ---- fontes (Fontsource, SIL OFL 1.1): só os subconjuntos usados ----
const FONTS = [
  ["noto-serif-hebrew", ["400", "600"]],
  ["gentium-book-plus", ["400", "700"]],
  ["literata", ["400", "400-italic", "600"]],
  ["ibm-plex-mono", ["400", "500"]],
  ["atkinson-hyperlegible", ["400", "400-italic", "700"]]
];
const SUBSETS = ["hebrew", "latin", "latin-ext", "greek", "greek-ext"];
let fontsCss = "/* Fontes sob a SIL Open Font License 1.1 (via Fontsource) */\n";
for (const [pkg, weights] of FONTS) {
  const dir = r(`node_modules/@fontsource/${pkg}`);
  for (const w of weights) {
    const css = fs.readFileSync(path.join(dir, `${w}.css`), "utf8");
    for (const block of css.match(/\/\*[^*]*\*\/\s*@font-face\s*{[^}]*}/g) || []) {
      const name = (block.match(/\/\*\s*([\w-]+)\s*\*\//) || [])[1] || "";
      const subset = name.slice(pkg.length + 1).replace(/-\d+-(normal|italic)$/, "");
      if (subset && !SUBSETS.includes(subset)) continue;
      const file = (block.match(/url\(\.\/files\/([^)]+\.woff2)\)/) || [])[1];
      if (!file) continue;
      fs.copyFileSync(path.join(dir, "files", file), path.join(OUT, "fonts", file));
      fontsCss += block.replace(/src:[^;]+;/, `src: url(${file}) format('woff2');`) + "\n";
    }
  }
  const lic = path.join(dir, "LICENSE");
  if (fs.existsSync(lic)) fs.copyFileSync(lic, path.join(OUT, "fonts", `LICENSE-${pkg}.txt`));
}
fs.writeFileSync(path.join(OUT, "fonts/fonts.css"), fontsCss);

// ---- ícones ----
const ICONS = [
  ["icone-arredondado.svg", "icone-192.png", 192],
  ["icone-arredondado.svg", "icone-512.png", 512],
  ["icone-maskable.svg", "icone-maskable-512.png", 512],
  ["icone.svg", "apple-touch-icon.png", 180],
  ["icone-arredondado.svg", "favicon-64.png", 64]
];
for (const [src, out, size] of ICONS) {
  await sharp(r(`web/icones/${src}`)).resize(size, size).png().toFile(path.join(OUT, "icones", out));
}

// ---- dados: livros, capítulos e léxico (scripts/exportar.py lê saida/biblia.sqlite) ----
execFileSync("python3", [r("scripts/exportar.py")], { stdio: "inherit" });

// ---- página: template + lista de livros (capítulos e léxico são lidos sob demanda de dados/) ----
const tpl = fs.readFileSync(r("web/template.html"), "utf8");
const livros = JSON.parse(fs.readFileSync(r("saida/dados/livros.json"), "utf8"));
const data = JSON.stringify({ livros, caps: {}, lex: {}, completo: true }).replace(/<\//g, "<\\/");
let html = tpl.replace("__DATA__", () => data);
html = html.replace(/<link rel="preconnect"[^>]*>\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/,
  `<link rel="stylesheet" href="fonts/fonts.css">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="${APP.theme}">
<meta name="description" content="${APP.desc}">
<link rel="icon" type="image/png" href="icones/favicon-64.png">
<link rel="apple-touch-icon" href="icones/apple-touch-icon.png">
<style>body{margin:0}img{max-width:100%}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>`);
const cut = html.indexOf("</style>", html.indexOf("<style>")) + "</style>".length;
const doc = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${html.slice(0, cut)}
</head>
<body>
${html.slice(cut).trim()}
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, "ler.html"), doc);

// ---- página inicial (index.html): números, amostra e tamanhos dos livros lidos dos dados ----
fs.writeFileSync(path.join(OUT, "index.html"), await paginaInicial(livros));

// ---- vídeos "Como usar" já gravados (scripts/videos/gravar.mjs grava em saida/videos) ----
const VIDEOS = r("saida/videos");
if (fs.existsSync(path.join(VIDEOS, "videos.js"))) fs.cpSync(VIDEOS, path.join(OUT, "videos"), { recursive: true });
else { fs.mkdirSync(path.join(OUT, "videos"), { recursive: true }); fs.writeFileSync(path.join(OUT, "videos/videos.js"), "window.__videos = { arquivos: {} };\n"); }

// ---- política de privacidade ----
fs.copyFileSync(r("web/privacidade.html"), path.join(OUT, "privacidade.html"));

// ---- manifesto ----
fs.writeFileSync(path.join(OUT, "manifest.webmanifest"), JSON.stringify({
  name: APP.name, short_name: APP.short, description: APP.desc, lang: "pt-BR", dir: "ltr",
  start_url: "./ler.html", scope: "./", display: "standalone", orientation: "any",
  background_color: APP.bg, theme_color: APP.theme, categories: ["books", "education"],
  icons: [
    { src: "icones/icone-192.png", sizes: "192x192", type: "image/png" },
    { src: "icones/icone-512.png", sizes: "512x512", type: "image/png" },
    { src: "icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
}, null, 2));

// ---- service worker: guarda a página para uso offline; os capítulos ficam no cache quando lidos.
// "Baixar tudo" (no app) não é preciso: no Android/iOS os dados já vêm dentro do pacote.
const files = [];
(function walk(d, base = "") {
  for (const f of fs.readdirSync(d)) {
    const full = path.join(d, f), rel = base ? `${base}/${f}` : f;
    if (fs.statSync(full).isDirectory()) walk(full, rel); else files.push(rel);
  }
})(OUT);
const hash = crypto.createHash("sha256");
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const version = hash.digest("hex").slice(0, 12);
const precache = ["./", ...files.filter(f => !f.endsWith(".txt") && !f.startsWith("dados/cap/") && !f.startsWith("videos/"))];
fs.writeFileSync(path.join(OUT, "sw.js"), `// Gerado por scripts/build_web.mjs — não editar
const CACHE = "interlinear-${version}";
const FILES = ${JSON.stringify(precache)};
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }))));
});
`);
console.error(`Versão web gerada em saida/web (${files.length + 1} arquivos, cache ${version})`);

// ---------------------------------------------------------------------------------------------
async function paginaInicial(livros) {
  const REPO = "https://github.com/josafams/biblia-interlinear";
  const dados = r("saida/dados");
  const cap = (cod, n) => JSON.parse(fs.readFileSync(path.join(dados, "cap", cod, `${n}.json`), "utf8"));
  const lex = { H: JSON.parse(fs.readFileSync(path.join(dados, "lex/H.json"), "utf8")), G: JSON.parse(fs.readFileSync(path.join(dados, "lex/G.json"), "utf8")) };
  let caps = 0, vers = 0, pal = 0;
  for (const b of livros) for (const c of b.caps) {
    caps++;
    const f = path.join(dados, "cap", b.cod, `${c.n}.json`);
    if (!fs.existsSync(f)) continue;
    for (const v of JSON.parse(fs.readFileSync(f, "utf8")).v) { if (v.n > 0) vers++; pal += v.w.length; }
  }
  const fmt = n => n.toLocaleString("pt-BR");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const limpa = w => w.replace(/\//g, "").replace(/[\u0591-\u05AF\u05BD]/g, "").replace(/[,.;·]$/, "");
  const cartoes = (v, grego) => v.w.map(w => {
    const e = lex[w[1][0]]?.[w[1]] || {};
    return `<div class="wc"><span class="o${grego ? " g" : ""}" lang="${grego ? "grc" : "he"}">${esc(limpa(w[0]))}</span><span class="x">${esc(e.x || "")}</span><span class="s">${esc(w[1])}</span><span class="t">${esc(w[2])}</span></div>`;
  }).join("");
  const gn = cap("GEN", 1).v.find(v => v.n === 1), jo = cap("JHN", 1).v.find(v => v.n === 1);
  const amostra = `<div class="ref"><b>Gênesis 1:1</b><span>hebraico, lê-se da direita para a esquerda</span></div>
    <div class="cards rtl">${cartoes(gn, false)}</div>
    <p class="blivre"><small>BLIVRE</small>${esc(gn.b)}</p>
    <div style="height:1px;background:var(--line)"></div>
    <div class="ref"><b>João 1:1</b><span>grego, da esquerda para a direita</span></div>
    <div class="cards">${cartoes({ w: jo.w.slice(0, 5) }, true)}</div>
    <p class="blivre"><small>BLIVRE</small>${esc(jo.b)}</p>`;
  // Tamanhos dos livros para baixar (de saida/epub e saida/pdf, quando gerados nesta máquina)
  const tam = f => { try { const b = fs.statSync(r(f)).size; return b >= 1e8 ? `${Math.round(b / 1048576)} MB` : `${(b / 1048576).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`; } catch (_) { return ""; } };
  const { resumo } = await import(pathToFileURL(r("scripts/videos/roteiros.mjs")).href);
  const subs = {
    __DESC__: esc(APP.desc), __REPO__: REPO, __REPO_CURTO__: "github.com/josafams/biblia-interlinear",
    __LIVROS__: `${REPO}/releases/download/livros`,
    __AMOSTRA__: amostra,
    __N_LIVROS__: fmt(livros.length), __N_CAPS__: fmt(caps), __N_VERS__: fmt(vers), __N_PALAVRAS__: fmt(pal),
    __N_VERBETES__: fmt(Object.keys(lex.H).length + Object.keys(lex.G).length),
    __TAM_EPUB_COMPLETA__: tam("saida/epub/00-Biblia-Interlinear-completa.epub"), __TAM_PDF_COMPLETA__: tam("saida/pdf/00-Biblia-Interlinear-completa.pdf"),
    __TAM_EPUB_AT__: tam("saida/epub/00-Biblia-Interlinear-AT.epub"), __TAM_PDF_AT__: tam("saida/pdf/00-Biblia-Interlinear-AT.pdf"),
    __TAM_EPUB_NT__: tam("saida/epub/00-Biblia-Interlinear-NT.epub"), __TAM_PDF_NT__: tam("saida/pdf/00-Biblia-Interlinear-NT.pdf"),
    __DATA__: new Date().toLocaleDateString("pt-BR"),
    __ROTEIROS__: JSON.stringify(resumo()).replace(/<\//g, "<\\/")
  };
  let html = fs.readFileSync(r("web/inicio.html"), "utf8");
  for (const [k, v] of Object.entries(subs)) html = html.split(k).join(v);
  const falta = html.match(/__[A-Z_]+__/);
  if (falta) throw new Error(`web/inicio.html: marcador sem valor ${falta[0]}`);
  return html;
}
