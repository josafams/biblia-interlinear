// Lista (ou renomeia) identificadores e nomes de propriedades em arquivos JS, a partir de um mapa JSON.
// Uso: node scripts/dev/js_identifiers.mjs listar arquivos...
//      node scripts/dev/js_identifiers.mjs renomear mapa.json arquivos...
// Mexe em: variáveis, funções, parâmetros, propriedades (a.b, {b: 1}, {b}) e rótulos; não mexe em textos
// nem comentários. Ferramenta da migração para nomes em inglês (docs/adr/0003-identificadores-em-ingles.md).
import fs from "node:fs";
import * as acorn from "acorn";

const [modo, ...resto] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const opts = { ecmaVersion: "latest", sourceType: "module", allowHashBang: true, allowReturnOutsideFunction: true, locations: false };

function nomes(src) {
  const ast = acorn.parse(src, opts);
  const achados = [];
  // percorre a árvore inteira: inclui propriedades (a.b, {b: 1}, métodos), que o acorn-walk não visita
  const visitar = node => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "Identifier") achados.push({ start: node.start, end: node.end, name: node.name });
    else if (node.type === "PrivateIdentifier") achados.push({ start: node.start + 1, end: node.end, name: node.name });
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(visitar);
      else if (v && typeof v === "object" && typeof v.type === "string") visitar(v);
    }
  };
  visitar(ast);
  return achados;
}

if (modo === "listar") {
  const cont = new Map();
  for (const f of resto) for (const n of nomes(fs.readFileSync(f, "utf8"))) cont.set(n.name, (cont.get(n.name) || 0) + 1);
  console.log([...cont.keys()].sort().join(" "));
} else if (modo === "renomear") {
  const [mapaArq, ...arquivos] = resto;
  const mapa = JSON.parse(fs.readFileSync(mapaArq, "utf8"));
  for (const f of arquivos) {
    let src = fs.readFileSync(f, "utf8");
    const todos = nomes(src);
    const existentes = new Set(todos.map(n => n.name));
    const colisoes = [...new Set(todos.filter(n => Object.hasOwn(mapa, n.name)).map(n => mapa[n.name]))].filter(
      n => existentes.has(n) && !Object.hasOwn(mapa, n)
    );
    if (colisoes.length && !process.argv.includes("--force")) {
      console.log(`${f}: colisão: ${colisoes.join(", ")}`);
      continue;
    }
    const alvos = todos.filter(n => Object.hasOwn(mapa, n.name)).sort((a, b) => b.start - a.start);
    const vistos = new Set();
    for (const n of alvos) {
      if (vistos.has(n.start)) continue;
      vistos.add(n.start);
      // atalho {cap} em objeto: vira {chapter: cap}? não — o nome do valor também muda, então {chapter}
      src = src.slice(0, n.start) + mapa[n.name] + src.slice(n.end);
    }
    fs.writeFileSync(f, src);
    console.log(`${f}: ${alvos.length} trocas`);
  }
}
