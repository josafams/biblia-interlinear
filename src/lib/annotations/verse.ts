// What is kept for one verse (highlights of any layer, notes, favorite, tags) and the changes the Anotar panel
// makes to it. Field names are the saved ones (see store.ts): ancora { livro, cap, ver, camada, inicio, fim },
// cor, texto, titulo, etiquetas.
import { uuid, type Collection, type StoredRecord } from "./store";

export type Anchor = {
  livro: string;
  cap: number;
  ver: number;
  ver_fim?: number;
  camada: "versiculo" | "blivre" | "original";
  inicio?: number | null;
  fim?: number | null;
  trecho?: string;
  edicao?: string;
};
export type Anchored = StoredRecord & { ancora: Anchor; etiquetas?: string[]; cor?: string | null; texto?: string; titulo?: string };
export type Tag = StoredRecord & { nome: string; cor?: string | null };
type Store = {
  save(c: Collection, r: StoredRecord): Promise<StoredRecord>;
  removeRecord(c: Collection, id: string): Promise<StoredRecord>;
  ofChapter(c: Collection, cap: string): Promise<StoredRecord[]>;
  allRecords(c: Collection): Promise<StoredRecord[]>;
};

export const chapterOf = (a: Pick<Anchor, "livro" | "cap">) => `${a.livro}.${a.cap}`;
/** One key per highlighted place: the verse, or a stretch of the Bíblia Livre or of the original words. */
export const anchorKey = (a: Anchor) =>
  `${a.livro}.${a.cap}.${a.ver}:${a.camada}:${a.camada === "versiculo" ? "" : `${a.inicio ?? ""}-${a.fim ?? ""}`}`;
export const verseAnchor = (livro: string, cap: number, ver: number, edicao = ""): Anchor => ({
  livro,
  cap,
  ver,
  ver_fim: ver,
  camada: "versiculo",
  edicao
});
/** "#oração" and "Oração" are the same tag. */
export const tagKey = (s: string | null | undefined) =>
  String(s || "")
    .replace(/^#+\s*/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim();

const ANNOTATED = ["marcacoes", "notas", "favoritos"] as const;
type VerseRecords = Record<(typeof ANNOTATED)[number], Anchored[]>;

export function createVerseAnnotations(store: Store) {
  /** Everything kept on the verse of anchor a (highlights of any layer, notes and the favorite). */
  async function records(a: Anchor): Promise<VerseRecords> {
    const lists = await Promise.all(ANNOTATED.map(c => store.ofChapter(c, chapterOf(a))));
    const at = (r: StoredRecord) => (r as Anchored).ancora?.ver === a.ver;
    return { marcacoes: lists[0].filter(at), notas: lists[1].filter(at), favoritos: lists[2].filter(at) } as VerseRecords;
  }
  const flat = (r: VerseRecords) => (Object.entries(r) as [Collection, Anchored[]][]).flatMap(([c, l]) => l.map(x => [c, x] as const));
  /** Tags belong to the whole verse: the union of the tags of all its records. */
  async function tags(a: Anchor) {
    return [...new Set(flat(await records(a)).flatMap(([, x]) => x.etiquetas || []))];
  }
  const hasAny = async (a: Anchor) => flat(await records(a)).length > 0;
  async function highlightOf(a: Anchor) {
    const k = anchorKey(a);
    return ((await store.ofChapter("marcacoes", chapterOf(a))) as Anchored[]).find(m => anchorKey(m.ancora) === k) || null;
  }
  async function favoriteOf(a: Anchor) {
    return ((await store.ofChapter("favoritos", chapterOf(a))) as Anchored[]).find(f => f.ancora.ver === a.ver) || null;
  }

  return {
    records,
    tags,
    hasAny,
    highlightOf,
    favoriteOf,
    /** A color, or none ("" or null): a highlight that still has tags stays, without color. */
    async setColor(a: Anchor, color: string | null) {
      const m = await highlightOf(a);
      if (!color) {
        if (!m) return;
        if (m.etiquetas?.length) await store.save("marcacoes", { id: m.id, cor: null });
        else await store.removeRecord("marcacoes", m.id);
        return;
      }
      await store.save("marcacoes", {
        id: m?.id || uuid(),
        cap: chapterOf(a),
        ancora: a,
        cor: color,
        etiquetas: m?.etiquetas || (await tags(a))
      });
    },
    async toggleFavorite(a: Anchor, edition = "") {
      const f = await favoriteOf(a);
      if (f) await store.removeRecord("favoritos", f.id);
      else
        await store.save("favoritos", {
          id: uuid(),
          cap: chapterOf(a),
          ancora: verseAnchor(a.livro, a.cap, a.ver, edition),
          etiquetas: await tags(a)
        });
    },
    /** Turns a tag on or off for every record of the verse (a verse with nothing yet gets a highlight without color). */
    async toggleTag(a: Anchor, id: string, turnOn?: boolean) {
      const all = flat(await records(a));
      const on = turnOn ?? !all.some(([, x]) => (x.etiquetas || []).includes(id));
      for (const [c, x] of all) {
        const set = new Set(x.etiquetas || []);
        if (on) set.add(id);
        else set.delete(id);
        if (c === "marcacoes" && !x.cor && !set.size) await store.removeRecord(c, x.id);
        else await store.save(c, { id: x.id, etiquetas: [...set] });
      }
      if (on && !all.length) await store.save("marcacoes", { id: uuid(), cap: chapterOf(a), ancora: a, cor: null, etiquetas: [id] });
    },
    /** The tag with that name ("#" optional, any case), created when new. */
    async tagNamed(name: string) {
      const nome = name.trim().replace(/^#+\s*/, "");
      const all = (await store.allRecords("etiquetas")) as Tag[];
      return (
        all.find(x => x.nome.toLowerCase() === nome.toLowerCase()) ||
        ((await store.save("etiquetas", { id: uuid(), nome, cor: null })) as Tag)
      );
    },
    /** The tags for the panel, most used first: those of the verse and the others. */
    async tagChoices(a: Anchor) {
      const [list, ...used] = await Promise.all((["etiquetas", ...ANNOTATED] as Collection[]).map(c => store.allRecords(c)));
      const uses: Record<string, number> = {};
      for (const r of used.flat() as Anchored[]) for (const t of r.etiquetas || []) uses[t] = (uses[t] || 0) + 1;
      const all = (list as Tag[]).sort((x, y) => (uses[y.id] || 0) - (uses[x.id] || 0) || x.nome.localeCompare(y.nome, "pt"));
      const has = new Set(await tags(a));
      return { mine: all.filter(t => has.has(t.id)), rest: all.filter(t => !has.has(t.id)), any: all.length > 0 };
    },
    /** Deletes everything of the verse; the returned function puts it back ("Desfazer"). */
    async clear(a: Anchor) {
      const gone = flat(await records(a));
      for (const [c, x] of gone) await store.removeRecord(c, x.id);
      return {
        count: gone.length,
        async undo() {
          for (const [c, x] of gone) {
            const { criado_em: _c, alterado_em: _a, relogio: _r, base: _b, apagado: _d, ...rec } = x;
            await store.save(c, rec as StoredRecord);
          }
        }
      };
    },
    /** The notes of the verse, oldest first (the panel edits the first; the others are counted). */
    async notes(a: Anchor) {
      return ((await store.ofChapter("notas", chapterOf(a))) as Anchored[])
        .filter(n => n.ancora?.ver === a.ver)
        .sort((x, y) => String(x.criado_em).localeCompare(String(y.criado_em)));
    },
    /** Saves the quick note of the panel: the existing one, or a new note on anchor a (with the verse's tags). */
    async saveNote(existing: Anchored | null, a: Anchor, texto: string, titulo = "") {
      if (existing) return (await store.save("notas", { id: existing.id, texto })) as Anchored;
      return (await store.save("notas", {
        id: uuid(),
        cap: chapterOf(a),
        ancora: { ...a },
        titulo,
        texto,
        etiquetas: await tags(a)
      })) as Anchored;
    }
  };
}
