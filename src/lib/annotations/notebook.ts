// The study notebook ("Exportar em PDF"): the chosen items of Minhas anotações grouped by verse, with the
// Bíblia Livre text (highlights kept), the interlinear of the words highlighted in the original, the notes
// and the tags, as a standalone HTML page to print. Built on the device, without internet.
import { formatDate, getLocale, t } from "../../i18n";
import { esc } from "../text";
import CSS from "./notebook.css?raw";
import type { RawWord } from "../types";
import type { Item, Kind } from "./list";
import type { Anchored } from "./verse";

export type NotebookOptions = {
  include: Record<Kind, boolean>;
  /** the Bíblia Livre text of each verse */
  text: boolean;
  /** the interlinear of the words highlighted in the original */
  interlinear: boolean;
  byDate: boolean;
};
export type NotebookSource = {
  /** the chapter data (v: [{ n, b, w }]), null when it cannot be read */
  chapter(book: string, chapter: number): Promise<{ v: { n: number; b?: string; w: RawWord[] }[] } | null>;
  /** every highlight kept (any chapter) */
  highlights: Anchored[];
  bookName(code: string): string;
  bookOrder(code: string): number;
  greek(code: string): boolean;
};
export type Notebook = { titulo: string; n: number; html: string };

// paper colors of the highlights (the page is printed on its own, without the app's styles)
const PAPER: Record<string, string> = { amarelo: "#f6e3a1", verde: "#cfe6c4", azul: "#bcd6e6", rosa: "#f2d2dc", laranja: "#f6d6b8" };
const paper = (c?: string | null) => PAPER[c || ""] || "#eee";

type Group = { a: Item["a"]; items: Item[]; date: string };

function groups(items: Item[], o: NotebookOptions, s: NotebookSource) {
  const by = new Map<string, Group>();
  for (const x of items) {
    const k = x.a ? `${x.a.livro}.${x.a.cap}.${x.a.ver}` : `livre.${x.id}`;
    if (!by.has(k)) by.set(k, { a: x.a, items: [], date: x.date });
    const g = by.get(k)!;
    g.items.push(x);
    if (x.date > g.date) g.date = x.date;
  }
  const gs = [...by.values()];
  if (o.byDate) return gs.sort((x, y) => y.date.localeCompare(x.date));
  const order = (g: Group) => (g.a ? s.bookOrder(g.a.livro) : 1e4);
  return gs.sort((x, y) => order(x) - order(y) || (x.a?.cap || 0) - (y.a?.cap || 0) || (x.a?.ver || 0) - (y.a?.ver || 0));
}

/** The verse text with its highlights (whole verse or snippets found again if the text changed). */
function verseText(text: string, ms: Anchored[]) {
  const whole = ms.find(m => m.ancora.camada === "versiculo");
  const spans = ms
    .filter(m => m.ancora.camada === "blivre")
    .map(m => {
      const a = m.ancora;
      let i = a.inicio ?? 0,
        f = a.fim ?? 0;
      if (text.slice(i, f) !== a.trecho) {
        const k = text.indexOf(a.trecho || "");
        if (k < 0) return null;
        i = k;
        f = k + (a.trecho || "").length;
      }
      return { i, f, cor: m.cor };
    })
    .filter(x => x !== null)
    .sort((x, y) => x.i - y.i);
  let html = "",
    pos = 0;
  for (const m of spans) {
    if (m.i < pos) continue;
    html += esc(text.slice(pos, m.i)) + `<mark style="background:${paper(m.cor)}">${esc(text.slice(m.i, m.f))}</mark>`;
    pos = m.f;
  }
  html += esc(text.slice(pos));
  const style = whole ? ` style="background:${paper(whole.cor)};padding:2px 4px;border-radius:3px"` : "";
  return `<p class="vt"${style}>${html}</p>`;
}

export async function buildNotebook(chosen: Item[], o: NotebookOptions, s: NotebookSource): Promise<Notebook> {
  const items = chosen.filter(x => o.include[x.tipo]);
  const gs = groups(items, o, s);
  const chapters: Record<string, Awaited<ReturnType<NotebookSource["chapter"]>>> = {};
  for (const g of gs)
    if (g.a && (o.text || o.interlinear)) {
      const k = `${g.a.livro}.${g.a.cap}`;
      if (!(k in chapters)) chapters[k] = await s.chapter(g.a.livro, g.a.cap).catch(() => null);
    }
  const marksOf: Record<string, Anchored[]> = {};
  for (const m of s.highlights) (marksOf[`${m.ancora.livro}.${m.ancora.cap}.${m.ancora.ver}`] ??= []).push(m);

  const books = [...new Set(gs.filter(g => g.a).map(g => s.bookName(g.a!.livro)))];
  const titulo = books.length === 1 ? books[0] : t("notebook.title");
  let body = "",
    currentBook = "";
  for (const g of gs) {
    const a = g.a;
    if (!o.byDate && a && s.bookName(a.livro) !== currentBook && books.length > 1) {
      currentBook = s.bookName(a.livro);
      body += `<h2 class="cl">${esc(currentBook)}</h2>`;
    }
    const kinds = [...new Set(g.items.map(x => x.label))].join(" · ").toUpperCase();
    const ref = a ? `${s.bookName(a.livro)} ${a.cap}:${a.ver}` : t("notebook.free_note");
    body += `<section class="en"><div class="ref">${esc(ref)}${kinds ? ` · ${esc(kinds)}` : ""}</div>`;
    const v = a ? chapters[`${a.livro}.${a.cap}`]?.v.find(y => y.n === a.ver) : undefined;
    const ms = a ? (marksOf[`${a.livro}.${a.cap}.${a.ver}`] || []).filter(m => m.cor) : [];
    if (o.text && v) body += verseText(v.b || "", ms);
    if (o.interlinear && v && a)
      for (const m of ms.filter(m => m.ancora.camada === "original")) {
        const ws = v.w.slice(m.ancora.inicio ?? 0, (m.ancora.fim ?? -1) + 1);
        if (!ws.length) continue;
        const greek = s.greek(a.livro);
        const orig = esc(ws.map(w => w[0].replace(/\//g, "")).join(" "));
        const glosses = esc(ws.map(w => `${w[1]} · ${w[2]}`).join("; "));
        body += `<p class="il"><span class="o" dir="${greek ? "ltr" : "rtl"}" lang="${greek ? "grc" : "he"}">${orig}</span> <span class="ig">${glosses}</span></p>`;
      }
    for (const x of g.items) {
      if (x.tipo === "notas")
        body += `<div class="nt">${x.title ? `<b>${esc(x.title)}</b><br>` : ""}${esc(x.text).replace(/\n/g, "<br>")}</div>`;
      else if (x.tipo === "marcacoes" && x.a?.camada === "blivre" && !o.text)
        body += `<p class="vt"><mark style="background:${paper(x.color)}">${esc(x.text)}</mark></p>`;
    }
    const tags = [...new Set(g.items.flatMap(x => x.tagNames))];
    if (tags.length) body += `<div class="tg">${tags.map(n => `<span>${esc(n)}</span>`).join("")}</div>`;
    body += `</section>`;
  }
  return { titulo, n: items.length, html: page(titulo, items.length, body) };
}

function page(titulo: string, n: number, body: string) {
  const date = formatDate(new Date());
  return `<!doctype html><html lang="${getLocale()}"><head><meta charset="utf-8"><title>${esc(titulo)} · ${esc(t("notebook.doc_title"))}</title><style>${CSS}</style></head><body>
<header><div><small>${esc(t("notebook.eyebrow"))}</small><h1>${esc(titulo)}</h1></div><span>${esc(t("notebook.count", { count: n }))} · ${date}</span></header>
${body || `<p>${esc(t("notebook.nothing"))}</p>`}
<footer>${esc(t("notebook.footer"))}</footer>
</body></html>`;
}
