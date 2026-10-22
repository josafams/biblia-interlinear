// Managing tags: rename, merge (renaming to the name of another tag joins the two) and delete.
import type { Collection, StoredRecord } from "./store";
import type { Anchored, Tag } from "./verse";

type Store = {
  save(c: Collection, r: StoredRecord): Promise<StoredRecord>;
  removeRecord(c: Collection, id: string): Promise<StoredRecord>;
  allRecords(c: Collection): Promise<StoredRecord[]>;
};

export function createTagManager(store: Store) {
  /** Moves the records of tag fromId to toId (or just takes it off); a highlight left with nothing goes away. */
  async function retag(fromId: string, toId: string | null) {
    for (const col of ["marcacoes", "notas", "favoritos"] as const)
      for (const r of (await store.allRecords(col)) as Anchored[]) {
        if (!r.etiquetas?.includes(fromId)) continue;
        const set = new Set(r.etiquetas);
        set.delete(fromId);
        if (toId) set.add(toId);
        if (col === "marcacoes" && !r.cor && !set.size) await store.removeRecord(col, r.id);
        else await store.save(col, { id: r.id, etiquetas: [...set] });
      }
  }
  return {
    async list() {
      return ((await store.allRecords("etiquetas")) as Tag[]).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
    },
    /** Renames; when another tag has that name (any case), the two are joined and the result says so. */
    async rename(id: string, name: string): Promise<{ merged?: { from: Tag; into: Tag } } | null> {
      const nome = name.trim();
      const tags = (await store.allRecords("etiquetas")) as Tag[];
      const me = tags.find(t => t.id === id);
      if (!me || !nome || nome === me.nome) return null;
      const other = tags.find(t => t.id !== id && t.nome.toLowerCase() === nome.toLowerCase());
      if (!other) {
        await store.save("etiquetas", { id, nome });
        return {};
      }
      await retag(id, other.id);
      await store.removeRecord("etiquetas", id);
      return { merged: { from: me, into: other } };
    },
    /** Deletes the tag and takes it off every record. */
    async remove(id: string) {
      await retag(id, null);
      await store.removeRecord("etiquetas", id);
    }
  };
}
