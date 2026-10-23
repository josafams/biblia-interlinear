// Assembles the installable site (PWA) in build/web after Vite writes the reader bundle there.
// The same folder becomes the Android/iOS app through Capacitor.
// In watch mode (npm run dev) fonts, icons and the data are written on the first build only; every rebuild
// writes the pages, the static files and the service worker again (a few seconds).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { OUT, fromRoot } from "./site/app";
import { writeFonts } from "./site/fonts";
import { writeHomePage, type Book } from "./site/home-page";
import { writeIcons } from "./site/icons";
import { writeManifest } from "./site/manifest";
import { writeReaderPage } from "./site/reader-page";
import { writeServiceWorker } from "./site/service-worker";
import { copyStaticFiles } from "./site/static-files";

export function interlinearSite(): Plugin {
  let readerBundle = "";
  let built = false,
    sourcemap = false;
  return {
    name: "interlinear-site",
    apply: "build",
    configResolved(config) {
      sourcemap = !!config.build.sourcemap;
    },
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find(c => c.type === "chunk" && c.isEntry && c.name === "reader");
      if (!entry) throw new Error("interlinear-site: reader bundle not found");
      readerBundle = entry.fileName;
    },
    async writeBundle() {
      // a rebuild of npm run dev keeps what the first build wrote (that mode does not empty build/web)
      const full = !(built && this.meta.watchMode && fs.existsSync(path.join(OUT, "dados")));
      built = true;
      if (full) {
        writeFonts();
        await writeIcons();
        // books, chapters, lexicon, concordance and search (scripts/export.py reads build/biblia.sqlite)
        execFileSync("python3", [fromRoot("scripts/export.py")], { stdio: "inherit" });
      }
      // bundles of earlier rebuilds (build/web is not emptied in npm run dev)
      for (const f of fs.readdirSync(path.join(OUT, "assets")))
        if (`assets/${f}` !== readerBundle && !(sourcemap && `assets/${f}` === `${readerBundle}.map`))
          fs.rmSync(path.join(OUT, "assets", f));
      const books: Book[] = JSON.parse(fs.readFileSync(fromRoot("build/data/books.json"), "utf8"));
      writeReaderPage(readerBundle, books);
      await writeHomePage(books);
      copyStaticFiles();
      writeManifest();
      const { files, version } = writeServiceWorker();
      console.error(`Site built in build/web (${files} files, cache ${version})`);
    }
  };
}
