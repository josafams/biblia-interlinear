// icones/compartilhar.png: the 1200×630 image link previews show (Open Graph, Twitter), with the app icon and the
// name. The text is drawn by librsvg with the system serif (DejaVu or Liberation on Linux).
import path from "node:path";
import sharp from "sharp";
import { SHARE_IMAGE } from "../../src/seo/head";
import { shareLines } from "../../src/seo/site-pages";
import { APP, OUT, escapeHtml as esc, fromRoot } from "./app";

export async function writeShareImage() {
  const [line1, line2] = shareLines();
  const icon = await sharp(fromRoot("web/icones/icone-arredondado.svg")).resize(300, 300).png().toBuffer();
  const serif = "Literata, 'DejaVu Serif', 'Liberation Serif', serif";
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="440" y="270" font-family="${serif}" font-size="66" font-weight="700" fill="${APP.theme}">${esc(APP.name)}</text>
  <text x="440" y="340" font-family="${serif}" font-size="30" fill="#4a5551">${esc(line1)}</text>
  <text x="440" y="390" font-family="${serif}" font-size="30" fill="#4a5551">${esc(line2)}</text>
</svg>`;
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: APP.bg } })
    .composite([
      { input: icon, left: 100, top: 165 },
      { input: Buffer.from(text), left: 0, top: 0 }
    ])
    .png()
    .toFile(path.join(OUT, SHARE_IMAGE));
}
