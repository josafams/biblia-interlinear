// What each verse of the chapter shows of the annotations: highlight colors (whole verse, words of the
// original, snippets of the Bíblia Livre), the color bar, the note button and the strip under the verse
// (start of the first note, favorite and tags). Verse.svelte draws it.
import type { Anchored, Tag } from "./verse";

export type Span = { i: number; f: number; color: string };
export type VerseMarks = {
  /** whole verse highlighted ("" none) */
  color: string;
  /** a snippet that is no longer in the text: the whole verse is highlighted instead */
  displaced: boolean;
  /** the color of the bar on the left ("" none) */
  bar: string;
  /** word index of the original → color */
  words: Record<number, string>;
  /** highlighted snippets of the Bíblia Livre, in text order and not overlapping */
  spans: Span[];
  notes: number;
  favorite: boolean;
  /** the start of the oldest note ("" none) and how many more there are */
  firstNote: string;
  moreNotes: number;
  tags: string[];
};

const empty = (): VerseMarks => ({
  color: "",
  displaced: false,
  bar: "",
  words: {},
  spans: [],
  notes: 0,
  favorite: false,
  firstNote: "",
  moreNotes: 0,
  tags: []
});

/** The marks of every annotated verse of a chapter, by verse number. */
export function chapterMarks(
  highlights: Anchored[],
  notes: Anchored[],
  favorites: Anchored[],
  tags: Tag[],
  textOf: (verse: number) => string | undefined
) {
  const out: Record<number, VerseMarks> = {};
  const slot = (n: number) => (out[n] ??= empty());
  for (const m of highlights) {
    const a = m.ancora;
    const text = textOf(a.ver);
    if (!m.cor || text === undefined) continue;
    const s = slot(a.ver);
    if (!s.bar || a.camada === "versiculo") s.bar = m.cor;
    if (a.camada === "versiculo") s.color = m.cor;
    else if (a.camada === "original") for (let i = a.inicio ?? 0; i <= (a.fim ?? -1); i++) s.words[i] = m.cor;
    else if (a.camada === "blivre") {
      let i = a.inicio ?? 0,
        f = a.fim ?? 0;
      // the text changed: look for the snippet kept; not found, the whole verse
      if (text.slice(i, f) !== a.trecho) {
        const k = a.trecho ? text.indexOf(a.trecho) : -1;
        if (k < 0) {
          s.color = m.cor;
          s.displaced = true;
          continue;
        }
        i = k;
        f = k + (a.trecho || "").length;
      }
      s.spans.push({ i, f, color: m.cor });
    }
  }
  for (const s of Object.values(out)) s.spans.sort((x, y) => x.i - y.i);

  const names = Object.fromEntries(tags.map(t => [t.id, t.nome]));
  const tagSets: Record<number, Set<string>> = {};
  const addTags = (n: number, ids?: string[]) => {
    for (const id of ids || []) if (names[id]) (tagSets[n] ??= new Set()).add(names[id]);
  };
  for (const r of [...highlights, ...favorites]) addTags(r.ancora.ver, r.etiquetas);
  for (const f of favorites) slot(f.ancora.ver).favorite = true;
  const byVerse: Record<number, Anchored[]> = {};
  for (const n of notes) {
    (byVerse[n.ancora.ver] ??= []).push(n);
    addTags(n.ancora.ver, n.etiquetas);
  }
  for (const [ver, list] of Object.entries(byVerse)) {
    const s = slot(+ver);
    s.notes = list.length;
    s.moreNotes = list.length - 1;
    const first = [...list].sort((x, y) => String(x.criado_em).localeCompare(String(y.criado_em)))[0];
    const text = (first.titulo || first.texto || "").trim();
    s.firstNote = text.length > 90 ? text.slice(0, 88) + "…" : text;
  }
  for (const [ver, set] of Object.entries(tagSets)) slot(+ver).tags = [...set];
  return out;
}

/** The Bíblia Livre text cut into plain and highlighted pieces. */
export function textPieces(text: string, spans: Span[]) {
  const out: { text: string; color: string }[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.i < pos) continue;
    if (s.i > pos) out.push({ text: text.slice(pos, s.i), color: "" });
    out.push({ text: text.slice(s.i, s.f), color: s.color });
    pos = s.f;
  }
  if (pos < text.length || !out.length) out.push({ text: text.slice(pos), color: "" });
  return out;
}
