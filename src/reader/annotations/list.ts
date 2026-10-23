// Minhas anotações (#minhas, NotesSheet.svelte; the list rules in src/lib/annotations/list.ts) and the tag
// manager inside it (TagManager.svelte; its rules in src/lib/annotations/tags.ts).
import { flushSync, mount } from "svelte";
import NotesSheet from "../../components/NotesSheet.svelte";
import TagManager from "../../components/TagManager.svelte";
import { t } from "../../i18n";
import {
  type Filter,
  type Item,
  listItems as buildListItems,
  filterItems,
  groupItems,
  sortItems,
  tagCounts
} from "../../lib/annotations/list";
import { createTagManager } from "../../lib/annotations/tags";
import { notes } from "../../state/notes.svelte";
import { tagManager } from "../../state/tags.svelte";
import { ANNOTATIONS_GOTO, ANNOTATIONS_OPEN_INDEX, ANNOTATIONS_OPEN_PANEL } from "../events";
import { listBooks, paint, records, store, tags, toastMsg } from "./context";
import { downloadData, importFile, openExport } from "./export";
import { openNote } from "./note";

/** the items shown now (what "O que está na lista agora" exports) */
export let lastItems: Item[] = [];
let focusReturn: Element | null = null;

const listLabels = () => ({
  note: t("notes.kind_note"),
  highlight: t("notes.kind_highlight"),
  tagOnly: t("notes.kind_tag"),
  favorite: t("notes.kind_favorite"),
  free: t("note.free")
});

export async function openList(f?: Partial<Filter>) {
  notes.filter = { tipo: "", cap: null, ver: null, tag: "", query: notes.filter.query, ...(f || {}) };
  focusReturn = document.activeElement;
  document.dispatchEvent(new CustomEvent(ANNOTATIONS_OPEN_PANEL));
  notes.open = true;
  flushSync();
  document.body.classList.add("com-minhas");
  await renderList();
  document.getElementById("mn-search")!.focus();
}
export function hideList() {
  notes.open = false;
  flushSync();
  document.body.classList.remove("com-minhas");
}
function closeList() {
  if (!notes.open) return;
  hideList();
  if (focusReturn instanceof HTMLElement && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
}

export async function allItems() {
  const [notas, marcacoes, favoritos, etiquetas] = await Promise.all([
    records("notas"),
    records("marcacoes"),
    records("favoritos"),
    tags()
  ]);
  return { etiquetas, items: buildListItems({ notas, marcacoes, favoritos, etiquetas }, listBooks, listLabels()) };
}

export async function renderList() {
  const { etiquetas, items } = await allItems();
  if (!etiquetas.some(x => x.id === notes.filter.tag)) notes.filter.tag = "";
  const used = tagCounts(items);
  notes.tags = [...etiquetas].sort((x, y) => x.nome.localeCompare(y.nome, "pt")).map(x => ({ ...x, count: used[x.id] || 0 }));
  const { items: shown, counts } = filterItems(items, notes.filter);
  const xs = sortItems(shown, notes.order, listBooks);
  lastItems = xs;
  notes.counts = counts;
  notes.shown = xs.length;
  notes.any = items.length > 0;
  notes.groups = groupItems(xs, notes.order === "data", listBooks, t("notes.free_notes"));
  flushSync();
}

function openItem(x: Item) {
  closeList();
  if (x.tipo === "notas") return openNote(x.id);
  if (x.a) document.dispatchEvent(new CustomEvent(ANNOTATIONS_GOTO, { detail: { book: x.a.livro, chapter: x.a.cap, verse: x.a.ver } }));
}

function listMenu(action: string) {
  if (action === "manage") return toggleTagManager();
  if (action === "select") {
    notes.selecting = !notes.selecting;
    if (!notes.selecting) notes.selected = [];
    return renderList();
  }
  if (action === "export") return openExport();
  if (action === "download") return downloadData();
  if (action === "import") return document.getElementById("mn-file")!.click();
}

// ---------- tag manager ----------
const tagRules = createTagManager(store);
async function toggleTagManager(force?: boolean) {
  tagManager.open = force ?? !tagManager.open;
  document.getElementById("mn-tagmgr")!.hidden = !tagManager.open;
  if (tagManager.open) tagManager.tags = await tagRules.list();
}
async function tagsChanged() {
  await toggleTagManager(true);
  await renderList();
  paint();
}
async function renameTag(id: string, name: string) {
  const r = await tagRules.rename(id, name);
  if (!r) return toggleTagManager(true);
  if (r.merged) {
    if (notes.filter.tag === id) notes.filter.tag = r.merged.into.id;
    toastMsg(t("tags.merged", { from: r.merged.from.nome, into: r.merged.into.nome }));
  }
  await tagsChanged();
}

export function initList() {
  mount(NotesSheet, {
    target: document.body,
    props: {
      onclose: () => closeList(),
      onchange: () => renderList(),
      onitem: (x: Item) => openItem(x),
      onnew() {
        closeList();
        openNote(null, null);
      },
      onmenu: (action: string) => listMenu(action),
      onimport: (file: File) => importFile(file),
      ontab(tab: "livros" | "voce") {
        closeList();
        document.dispatchEvent(new CustomEvent(ANNOTATIONS_OPEN_INDEX, { detail: { tab } }));
      }
    }
  });
  mount(TagManager, {
    target: document.getElementById("mn-tagmgr")!,
    props: {
      onrename: (id: string, name: string) => renameTag(id, name),
      ondelete: async (id: string) => {
        await tagRules.remove(id);
        await tagsChanged();
      },
      ondone: () => toggleTagManager(false)
    }
  });
}
