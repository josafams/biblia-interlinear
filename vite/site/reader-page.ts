// ler.html: web/reader.html (a fragment) wrapped in a document, with the books list inlined as DATA
// and the Vite bundle in place of __READER_BUNDLE__. Chapters and lexicon load on demand from dados/.
import fs from "node:fs";
import path from "node:path";
import { APP, OUT, fromRoot } from "./app";

export function writeReaderPage(readerBundle: string, books: unknown) {
  const template = fs.readFileSync(fromRoot("web/reader.html"), "utf8");
  const data = JSON.stringify({ books, chapters: {}, lex: {}, complete: true }).replace(/<\//g, "<\\/");
  let html = template.replace("__DATA__", () => data).replace("__READER_BUNDLE__", readerBundle);
  // the Google Fonts links of the template become the local fonts plus the app metadata
  html = html.replace(
    /<link rel="preconnect"[^>]*>\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/,
    `<link rel="stylesheet" href="fonts/fonts.css">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="${APP.theme}">
<meta name="description" content="${APP.desc}">
<link rel="icon" type="image/png" href="icones/favicon-64.png">
<link rel="apple-touch-icon" href="icones/apple-touch-icon.png">
<style>body{margin:0}img{max-width:100%}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>`
  );
  // everything up to the first inline <style> goes in <head>, the rest in <body>
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
}
