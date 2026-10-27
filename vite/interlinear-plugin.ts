// Assembles the installable site (PWA) in build/web after Vite writes the reader bundle there.
// The same folder becomes the Android/iOS app through Capacitor.
// In watch mode (npm run dev) fonts, icons and the data are written on the first build only; every rebuild
// writes the pages, the static files and the service worker again (a few seconds).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { build, type Plugin, type Rollup } from "vite";
import { OUT, fromRoot } from "./site/app";
import { writeFonts } from "./site/fonts";
import type { SeoBook } from "../src/seo/bible-pages";
import { writeHomePage } from "./site/home-page";
import { writeIcons } from "./site/icons";
import { writeManifest } from "./site/manifest";
import { writeReaderPage } from "./site/reader-page";
import { writeBiblePages } from "./site/seo-pages";
import { writeServiceWorker } from "./site/service-worker";
import { writeShareImage } from "./site/share-image";
import { copyStaticFiles } from "./site/static-files";

// The home page script (src/home/main.ts) and the privacy page stylesheet are builds of their own: one file per
// page (see vite.config.mts)
async function buildPage(name: string, input: string, sourcemap: boolean) {
  const out = (await build({
    configFile: false,
    logLevel: "warn",
    base: "./",
    publicDir: false,
    plugins: [svelte({ compilerOptions: { css: "injected" } })],
    build: {
      outDir: OUT,
      emptyOutDir: false,
      target: "es2020",
      sourcemap,
      rollupOptions: {
        input: { [name]: fromRoot(input) },
        output: { inlineDynamicImports: true, entryFileNames: "assets/[name]-[hash].js" }
      }
    }
  })) as Rollup.RollupOutput;
  const entry = out.output.find((c): c is Rollup.OutputChunk => c.type === "chunk" && c.isEntry);
  // a stylesheet entry has no script: its CSS is an asset of the output
  const css =
    (entry && [...(entry.viteMetadata?.importedCss || [])][0]) ||
    out.output.find(o => o.type === "asset" && o.fileName.endsWith(".css"))?.fileName;
  if (!css) throw new Error(`interlinear-site: ${name} stylesheet not found`);
  return { js: entry?.fileName || "", css };
}

export function interlinearSite(): Plugin {
  let readerBundle = "",
    readerCss = "";
  let built = false,
    sourcemap = false;
  return {
    name: "interlinear-site",
    apply: "build",
    configResolved(config) {
      sourcemap = !!config.build.sourcemap;
    },
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find((c): c is Rollup.OutputChunk => c.type === "chunk" && c.isEntry && c.name === "reader");
      if (!entry) throw new Error("interlinear-site: reader bundle not found");
      readerBundle = entry.fileName;
      readerCss = [...(entry.viteMetadata?.importedCss || [])][0] || "";
      if (!readerCss) throw new Error("interlinear-site: reader stylesheet not found");
    },
    async writeBundle() {
      // a rebuild of npm run dev keeps what the first build wrote (that mode does not empty build/web)
      const full = !(built && this.meta.watchMode && fs.existsSync(path.join(OUT, "dados")));
      built = true;
      if (full) {
        writeFonts();
        await writeIcons();
        await writeShareImage();
        // books, chapters, lexicon, concordance and search (scripts/export.py reads build/biblia.sqlite)
        execFileSync("python3", [fromRoot("scripts/export.py")], { stdio: "inherit" });
      }
      // bundles of earlier rebuilds (build/web is not emptied in npm run dev)
      for (const f of fs.readdirSync(path.join(OUT, "assets")))
        if (![readerBundle, readerCss].includes(`assets/${f}`) && !(sourcemap && `assets/${f}` === `${readerBundle}.map`))
          fs.rmSync(path.join(OUT, "assets", f));
      const books: SeoBook[] = JSON.parse(fs.readFileSync(fromRoot("build/data/books.json"), "utf8"));
      writeReaderPage(readerBundle, readerCss, books);
      await writeHomePage(books, await buildPage("home", "src/home/main.ts", sourcemap));
      copyStaticFiles((await buildPage("privacy", "src/styles/privacy.css", sourcemap)).css);
      writeBiblePages(books, (await buildPage("seo", "src/styles/seo.css", sourcemap)).css);
      writeManifest();
      const { files, version } = writeServiceWorker();
      console.error(`Site built in build/web (${files} files, cache ${version})`);
    }
  };
}
