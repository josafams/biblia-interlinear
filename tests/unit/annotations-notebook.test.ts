import { expect, test } from "vitest";
import { listItems } from "../../src/lib/annotations/list";
import { buildNotebook } from "../../src/lib/annotations/notebook";
import { verseAnchor } from "../../src/lib/annotations/verse";

const NAMES: Record<string, string> = { GEN: "Gênesis", JHN: "João" };
const ORDER: Record<string, number> = { GEN: 0, JHN: 42 };
const books = { name: (c: string) => NAMES[c] || c, order: (c: string) => ORDER[c] ?? 999 };
const labels = { note: "nota", highlight: "marcação", tagOnly: "etiqueta", favorite: "favorito", free: "Nota livre" };
const at = (b: string, c: number, v: number, extra: object = {}) => ({ ...verseAnchor(b, c, v), ...extra });

const highlight = { id: "m1", ancora: at("GEN", 1, 3, { camada: "blivre", inicio: 14, fim: 22, trecho: "Haja luz" }), cor: "amarelo" };
const items = listItems(
  {
    notas: [
      { id: "n1", ancora: at("JHN", 3, 16), titulo: "Amor", texto: "linha 1\nlinha <2>", etiquetas: ["t1"], alterado_em: "2026-10-02" }
    ],
    marcacoes: [{ ...highlight, etiquetas: [], alterado_em: "2026-10-01" }],
    favoritos: [],
    etiquetas: [{ id: "t1", nome: "estudo" }]
  },
  books,
  labels
);
const source = {
  chapter: async (book: string) =>
    book === "GEN"
      ? { v: [{ n: 3, b: "E disse Deus: Haja luz; e houve luz.", w: [] }] }
      : { v: [{ n: 16, b: "Porque Deus amou o mundo", w: [] }] },
  highlights: [highlight],
  bookName: books.name,
  bookOrder: books.order,
  greek: (c: string) => c === "JHN"
};
const options = { include: { notas: true, marcacoes: true, favoritos: true }, text: true, interlinear: false, byDate: false };

test("verses in biblical order, with the highlights in the text, the notes escaped and the tags", async () => {
  const c = await buildNotebook(items, options, source);
  expect(c.n).toBe(2);
  expect(c.titulo).toBe("Minhas anotações");
  expect(c.html.indexOf("Gênesis 1:3")).toBeLessThan(c.html.indexOf("João 3:16"));
  expect(c.html).toMatch(/<mark style="background:#f6e3a1">Haja luz<\/mark>/);
  expect(c.html).toContain("linha 1<br>linha &lt;2&gt;");
  expect(c.html).toContain("<span>estudo</span>");
});

test("only the kinds asked for; one book gives the title", async () => {
  const c = await buildNotebook(items, { ...options, include: { notas: false, marcacoes: true, favoritos: true } }, source);
  expect(c.n).toBe(1);
  expect(c.titulo).toBe("Gênesis");
  expect(c.html).not.toContain("Amor");
});
