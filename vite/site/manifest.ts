// manifest.webmanifest: what the browser needs to install the reader as an app.
import fs from "node:fs";
import path from "node:path";
import { APP, OUT } from "./app";

export function writeManifest() {
  const manifest = {
    name: APP.name,
    short_name: APP.short,
    description: APP.desc,
    lang: "pt-BR",
    dir: "ltr",
    start_url: "./ler.html",
    scope: "./",
    display: "standalone",
    orientation: "any",
    background_color: APP.bg,
    theme_color: APP.theme,
    categories: ["books", "education"],
    icons: [
      { src: "icones/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "icones/icone-512.png", sizes: "512x512", type: "image/png" },
      { src: "icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
  fs.writeFileSync(path.join(OUT, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));
}
