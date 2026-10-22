// App identity shared by the pages, the web manifest and the service worker.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const OUT = path.join(ROOT, "build/web");
export const fromRoot = (p: string) => path.join(ROOT, p);

export const APP = {
  name: "Bíblia Interlinear",
  short: "Interlinear",
  desc: "A Bíblia inteira em hebraico, aramaico e grego, com transliteração, pronúncia, glosa em português, verbetes, áudio e o texto da Bíblia Livre.",
  bg: "#eceeea",
  theme: "#1d5b74",
  repo: "https://github.com/josafams/biblia-interlinear"
};

export const escapeHtml = (s: unknown) =>
  String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
