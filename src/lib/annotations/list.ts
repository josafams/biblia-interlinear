// Minhas anotações: every note, highlight and favorite as a list item, the filters (kind, verse, tag, search),
// the order (biblical or newest first) and the grouping (by book, then one card per verse).
import { tagKey, type Anchor, type Anchored, type Tag } from "./verse";

export type Kind = "notas" | "marcacoes" | "favoritos";
export type Item = {
  tipo: Kind;
  id: string;
  a: Anchor | null;
  /** "nota", "marcação", "etiqueta" (a highlight without color), "favorito" — from the caller's labels */
  label: string;
  color: string | null;
  title: string;
  text: string;
  tags: string[];
  tagNames: string[];
  date: string;
  ref: string;
};
export type Filter = { tipo: "" | Kind; cap: string | null; ver: number | null; tag: string; query: string };
export type Labels = { note: string; highlight: string; tagOnly: string; favorite: string; free: string };
export type Books = { name(code: string): string; order(code: string): number };

export function listItems(
  r: { notas: Anchored[]; marcacoes: Anchored[]; favoritos: Anchored[]; etiquetas: Tag[] },
  books: Books,
  labels: Labels
): Item[] {
  const names = Object.fromEntries(r.etiquetas.map(t => [t.id, t.nome]));
  const ref = (a: Anchor | null) => (a ? `${books.name(a.livro)} ${a.cap}:${a.ver}` : labels.free);
  const item = (tipo: Kind, x: Anchored, label: string, extra: Partial<Item>): Item => ({
    tipo,
    id: x.id,
    a: x.ancora || null,
    label,
    color: null,
    title: "",
    text: "",
    tags: x.etiquetas || [],
    tagNames: (x.etiquetas || []).map(i => names[i]).filter(Boolean),
    date: String(x.alterado_em || ""),
    ref: ref(x.ancora || null),
    ...extra
  });
  return [
    ...r.notas.map(n => item("notas", n, labels.note, { title: n.titulo || "", text: n.texto || "" })),
    ...r.marcacoes.map(m =>
      item("marcacoes", m, m.cor ? labels.highlight : labels.tagOnly, { color: m.cor || null, text: m.ancora?.trecho || "" })
    ),
    ...r.favoritos.map(f => item("favoritos", f, labels.favorite, {}))
  ];
}

/** "#oração" searches the tag names only; any other text, the reference, title, text and tags. */
export function matchesQuery(x: Item, query: string) {
  const raw = query.trim();
  if (raw.startsWith("#")) {
    const q = tagKey(raw);
    return x.tagNames.some(n => tagKey(n).includes(q));
  }
  const q = raw.toLowerCase();
  return !q || `${x.ref} ${x.title} ${x.text} ${x.tagNames.join(" ")}`.toLowerCase().includes(q);
}

/** The items of the verse/tag/search filters (before the kind), and how many of each kind they have. */
export function filterItems(items: Item[], f: Filter) {
  const base = items.filter(
    x =>
      (!f.cap || (x.a && `${x.a.livro}.${x.a.cap}` === f.cap && (f.ver == null || x.a.ver === f.ver))) &&
      (!f.tag || x.tags.includes(f.tag)) &&
      matchesQuery(x, f.query)
  );
  const counts = { "": base.length, notas: 0, marcacoes: 0, favoritos: 0 } as Record<"" | Kind, number>;
  for (const x of base) counts[x.tipo]++;
  return { items: base.filter(x => !f.tipo || x.tipo === f.tipo), counts };
}

export function sortItems(items: Item[], order: "biblica" | "data", books: Books) {
  const xs = [...items];
  if (order === "data") return xs.sort((x, y) => y.date.localeCompare(x.date));
  return xs.sort(
    (x, y) =>
      (x.a ? books.order(x.a.livro) : 1e4) - (y.a ? books.order(y.a.livro) : 1e4) ||
      (x.a?.cap || 0) - (y.a?.cap || 0) ||
      (x.a?.ver || 0) - (y.a?.ver || 0)
  );
}

/** Everything of one verse together in a card; in biblical order also under the book's heading. */
export function groupItems(items: Item[], byDate: boolean, books: Books, freeNotes: string) {
  const groups: { title: string | null; verses: { key: string; ref: string; items: Item[] }[] }[] = [];
  for (const x of items) {
    const title = byDate ? null : x.a ? books.name(x.a.livro) : freeNotes;
    const key = x.a ? `${x.a.livro}.${x.a.cap}.${x.a.ver}` : "livre:" + x.id;
    let g = groups[groups.length - 1];
    if (!g || (title !== null && g.title !== title)) groups.push((g = { title, verses: [] }));
    const last = g.verses[g.verses.length - 1];
    if (last && last.key === key) last.items.push(x);
    else g.verses.push({ key, ref: x.ref, items: [x] });
  }
  return groups;
}

/** How many items use each tag. */
export function tagCounts(items: Item[]) {
  const counts: Record<string, number> = {};
  for (const x of items) for (const t of x.tags) counts[t] = (counts[t] || 0) + 1;
  return counts;
}
