// Assembles the installable site (PWA) in build/web after Vite writes the reader bundle there.
// The same folder becomes the Android/iOS app through Capacitor.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import type { Plugin } from "vite";
import { fromRoot } from "./site/app";
import { writeFonts } from "./site/fonts";
import { writeHomePage, type Book } from "./site/home-page";
import { writeIcons } from "./site/icons";
import { writeManifest } from "./site/manifest";
import { writeReaderPage } from "./site/reader-page";
import { writeServiceWorker } from "./site/service-worker";
import { copyStaticFiles } from "./site/static-files";

export function interlinearSite(): Plugin {
  let readerBundle = "";
  return {
    name: "interlinear-site",
    apply: "build",
    generateBundle(_, bundle) {
      const entry = Object.values(bundle).find(c => c.type === "chunk" && c.isEntry && c.name === "reader");
      if (!entry) throw new Error("interlinear-site: reader bundle not found");
      readerBundle = entry.fileName;
    },
    async writeBundle() {
      writeFonts();
      await writeIcons();
      // books, chapters, lexicon, concordance and search (scripts/export.py reads build/biblia.sqlite)
      execFileSync("python3", [fromRoot("scripts/export.py")], { stdio: "inherit" });
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
