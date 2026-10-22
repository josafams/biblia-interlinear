// Minhas anotações (#minhas, the Notas tab of the index): filters, order, selection and what the list shows.
import type { Filter, Item, Kind } from "../lib/annotations/list";
import type { Tag } from "../lib/annotations/verse";

export const notes = $state({
  open: false,
  filter: { tipo: "", cap: null, ver: null, tag: "", query: "" } as Filter,
  order: "biblica" as "biblica" | "data",
  selecting: false,
  selected: [] as string[],
  /** there are annotations at all (the empty message differs) */
  any: false,
  tags: [] as (Tag & { count: number })[],
  counts: { "": 0, notas: 0, marcacoes: 0, favoritos: 0 } as Record<"" | Kind, number>,
  groups: [] as { title: string | null; verses: { key: string; ref: string; items: Item[] }[] }[],
  shown: 0
});
