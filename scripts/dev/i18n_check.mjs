// Checks the screen text of the migrated code (src/, outside src/i18n):
//   - every t("key") / tryT("key") exists in each locale;
//   - every locale text is used (keys under a dynamic prefix, t(`morph.${group}…`), count as used);
//   - no screen text is written in the code: string literals that read like words in a language.
// A line ending in `// i18n-ignore` is skipped (data or technical strings that only look like text).
// Usage: node scripts/dev/i18n_check.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = path.join(ROOT, "src");
const LOCALES = path.join(SRC, "i18n/locales");
const PLURAL = new Set(["zero", "one", "two", "few", "many", "other"]);

const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });

// leaf keys of a locale; a plural object ({one, other}) is one text
function leaves(node, prefix = "", out = []) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix + k;
    if (typeof v === "string" || Object.keys(v).every(p => PLURAL.has(p))) out.push(key);
    else leaves(v, key + ".", out);
  }
  return out;
}

const files = walk(SRC).filter(f => /\.(ts|svelte)$/.test(f) && !f.startsWith(path.join(SRC, "i18n")));
const used = new Set();
const prefixes = new Set();
const errors = [];
const where = (file, i) => `${path.relative(ROOT, file)}:${i + 1}`;

for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\b(?:t|tryT)\(\s*(["'`])((?:(?!\1).)*)\1/g)) {
      const key = m[2];
      if (m[1] === "`" && key.includes("${")) prefixes.add(key.slice(0, key.indexOf("${")));
      else used.add(key);
    }
    // keys built by a helper from a template literal: `morph.${group}.${code}`
    for (const m of line.matchAll(/`([a-z_]+(?:\.[a-z_]+)*\.)\$\{/g)) prefixes.add(m[1]);

    if (/\/\/ i18n-ignore\s*$/.test(line) || /^\s*(\/\/|\*|\/\*|import\b)/.test(line)) return;
    const code = line.replace(/\/\/.*$/, "").replace(/\b(?:t|tryT)\(\s*(["'`])(?:(?!\1).)*\1/g, "");
    for (const m of code.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
      const s = m[2];
      if (/\p{L}{2,}[\s,.:;!?]+\p{L}{2,}/u.test(s) && !/^[\w.-]+$/.test(s) && !/[<>{}=/\\]/.test(s))
        errors.push(`${where(file, i)}: screen text in code, move it to the locale: ${JSON.stringify(s)}`);
    }
  });
}

for (const name of fs.readdirSync(LOCALES).filter(f => f.endsWith(".json"))) {
  const keys = leaves(JSON.parse(fs.readFileSync(path.join(LOCALES, name), "utf8")));
  const all = new Set(keys);
  for (const k of used) if (!all.has(k)) errors.push(`${name}: missing key ${k}`);
  for (const k of keys) if (!used.has(k) && ![...prefixes].some(p => k.startsWith(p))) errors.push(`${name}: unused key ${k}`);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`i18n ok: ${files.length} files, ${used.size} keys, ${prefixes.size} dynamic prefixes`);
