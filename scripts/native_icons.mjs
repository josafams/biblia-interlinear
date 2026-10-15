// Gera ícones e telas de abertura do Android e do iOS a partir de web/icones/*.svg
// Uso: node scripts/native_icons.mjs   (rodar depois de "npx cap add android/ios")
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const r = p => path.join(ROOT, p);
const BG = "#1d5b74";
const SVG = n => r(`web/icones/${n}`);

// ---------- Android ----------
const RES = r("android/app/src/main/res");
if (fs.existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(RES, `mipmap-${d}`);
    const legacy = Math.round(48 * k),
      fg = Math.round(108 * k);
    await sharp(SVG("icone-arredondado.svg")).resize(legacy, legacy).png().toFile(path.join(dir, "ic_launcher.png"));
    const circle = Buffer.from(
      `<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`
    );
    await sharp(SVG("icone.svg"))
      .resize(legacy, legacy)
      .composite([{ input: circle, blend: "dest-in" }])
      .png()
      .toFile(path.join(dir, "ic_launcher_round.png"));
    await sharp(SVG("icone-frente.svg")).resize(fg, fg).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  }
  fs.writeFileSync(
    path.join(RES, "values/ic_launcher_background.xml"),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`
  );
  // telas de abertura: mesmo tamanho dos arquivos do modelo, letra no centro sobre a cor do app
  const walk = d =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const f of walk(RES).filter(f => path.basename(f) === "splash.png")) {
    const { width, height } = await sharp(f).metadata();
    const s = Math.round(Math.min(width, height) * 0.42);
    const logo = await sharp(SVG("icone-frente.svg")).resize(s, s).png().toBuffer();
    const out = await sharp({ create: { width, height, channels: 4, background: BG } })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
    fs.writeFileSync(f, out);
  }
  console.error("Ícones e telas de abertura do Android atualizados");
}

// ---------- iOS ----------
const XC = r("ios/App/App/Assets.xcassets");
if (fs.existsSync(XC)) {
  // a App Store exige ícone 1024×1024 sem transparência e sem cantos arredondados (o iOS arredonda)
  await sharp(SVG("icone.svg"))
    .resize(1024, 1024)
    .flatten({ background: BG })
    .removeAlpha()
    .png()
    .toFile(path.join(XC, "AppIcon.appiconset/AppIcon-512@2x.png"));
  const logo = await sharp(SVG("icone-frente.svg")).resize(1100, 1100).png().toBuffer();
  const splash = await sharp({ create: { width: 2732, height: 2732, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
  for (const n of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
    fs.writeFileSync(path.join(XC, "Splash.imageset", n), splash);
  }
  console.error("Ícone e tela de abertura do iOS atualizados");
}
