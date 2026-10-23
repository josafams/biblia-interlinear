// Files copied as they are: scripts outside the bundle, licenses, pages and recorded videos.
import fs from "node:fs";
import path from "node:path";
import { OUT, fromRoot } from "./app";

export function copyStaticFiles() {
  // google-config.js stays unhashed (tests and deploys swap it)
  for (const f of ["google-config.js", "privacidade.html"]) fs.copyFileSync(fromRoot(`web/${f}`), path.join(OUT, f));
  // Google Search Console verification file (domain of the OAuth consent screen), if any
  for (const f of fs.readdirSync(fromRoot("web")).filter(f => /^google[0-9a-f]+\.html$/.test(f)))
    fs.copyFileSync(fromRoot(`web/${f}`), path.join(OUT, f));
  fs.mkdirSync(path.join(OUT, "vendor"), { recursive: true });
  fs.copyFileSync(fromRoot("node_modules/dexie/LICENSE"), path.join(OUT, "vendor/LICENSE-dexie.txt"));

  // "Como usar" videos recorded by scripts/videos/gravar.mjs into build/videos, or an empty index
  const videos = fromRoot("build/videos");
  if (fs.existsSync(path.join(videos, "videos.js"))) fs.cpSync(videos, path.join(OUT, "videos"), { recursive: true });
  else {
    fs.mkdirSync(path.join(OUT, "videos"), { recursive: true });
    fs.writeFileSync(path.join(OUT, "videos/videos.js"), "window.__videos = { files: {} };\n");
  }
}
