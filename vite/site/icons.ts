// App and browser icons rendered from the SVG sources in web/icones.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { OUT, fromRoot } from "./app";

const ICONS: [string, string, number][] = [
  ["icone-arredondado.svg", "icone-192.png", 192],
  ["icone-arredondado.svg", "icone-512.png", 512],
  ["icone-maskable.svg", "icone-maskable-512.png", 512],
  ["icone.svg", "apple-touch-icon.png", 180],
  ["icone-arredondado.svg", "favicon-64.png", 64]
];

export async function writeIcons() {
  const out = path.join(OUT, "icones");
  fs.mkdirSync(out, { recursive: true });
  for (const [src, file, size] of ICONS) {
    await sharp(fromRoot(`web/icones/${src}`))
      .resize(size, size)
      .png()
      .toFile(path.join(out, file));
  }
}
