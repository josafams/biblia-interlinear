// Local fonts (Fontsource, SIL OFL 1.1): only the subsets the reader uses, so it works offline without Google.
import fs from "node:fs";
import path from "node:path";
import { OUT, fromRoot } from "./app";

const FONTS: [string, string[]][] = [
  ["noto-serif-hebrew", ["400", "600"]],
  ["gentium-book-plus", ["400", "700"]],
  ["literata", ["400", "400-italic", "600"]],
  ["ibm-plex-mono", ["400", "500"]],
  ["atkinson-hyperlegible", ["400", "400-italic", "700"]]
];
const SUBSETS = ["hebrew", "latin", "latin-ext", "greek", "greek-ext"];

export function writeFonts() {
  const out = path.join(OUT, "fonts");
  fs.mkdirSync(out, { recursive: true });
  let fontsCss = "/* Fontes sob a SIL Open Font License 1.1 (via Fontsource) */\n";
  for (const [pkg, weights] of FONTS) {
    const dir = fromRoot(`node_modules/@fontsource/${pkg}`);
    for (const w of weights) {
      const css = fs.readFileSync(path.join(dir, `${w}.css`), "utf8");
      for (const block of css.match(/\/\*[^*]*\*\/\s*@font-face\s*{[^}]*}/g) || []) {
        const name = (block.match(/\/\*\s*([\w-]+)\s*\*\//) || [])[1] || "";
        const subset = name.slice(pkg.length + 1).replace(/-\d+-(normal|italic)$/, "");
        if (subset && !SUBSETS.includes(subset)) continue;
        const file = (block.match(/url\(\.\/files\/([^)]+\.woff2)\)/) || [])[1];
        if (!file) continue;
        fs.copyFileSync(path.join(dir, "files", file), path.join(out, file));
        fontsCss += block.replace(/src:[^;]+;/, `src: url(${file}) format('woff2');`) + "\n";
      }
    }
    const license = path.join(dir, "LICENSE");
    if (fs.existsSync(license)) fs.copyFileSync(license, path.join(out, `LICENSE-${pkg}.txt`));
  }
  fs.writeFileSync(path.join(out, "fonts.css"), fontsCss);
}
