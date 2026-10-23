// "Exportar em PDF" (ExportSheet.svelte; the notebook in src/lib/annotations/notebook.ts) and "Baixar meus
// dados" / "Importar" (the JSON backup; the file in src/lib/annotations/download.ts).
import { flushSync, mount } from "svelte";
import ExportSheet from "../../components/ExportSheet.svelte";
import { t } from "../../i18n";
import { saveBackup } from "../../lib/annotations/download";
import { buildNotebook } from "../../lib/annotations/notebook";
import { printHtml } from "../../lib/print";
import { exportView } from "../../state/export.svelte";
import { notes } from "../../state/notes.svelte";
import { bookName, bookOrder, records, store, toastMsg } from "./context";
import { allItems, hideList, lastItems, openList, renderList } from "./list";

export async function openExport() {
  const { items } = await allItems();
  const codes = [...new Set(items.filter(x => x.a).map(x => x.a!.livro))].sort((a, b) => bookOrder(a) - bookOrder(b));
  Object.assign(exportView, {
    books: codes.map(code => ({ code, name: bookName(code) })),
    book: codes[0] || "",
    listCount: lastItems.length,
    selectedCount: notes.selected.length,
    scope: notes.selected.length ? "sel" : "lista"
  });
  hideList();
  exportView.open = true;
  flushSync();
}
function closeExport() {
  exportView.open = false;
  flushSync();
  openList(notes.filter);
}

export async function assembleNotebook() {
  const { items } = await allItems();
  const v = exportView;
  const chosen =
    v.scope === "sel"
      ? items.filter(x => notes.selected.includes(x.id))
      : v.scope === "livro"
        ? items.filter(x => x.a?.livro === v.book)
        : items.filter(x => lastItems.some(y => y.id === x.id));
  const options = {
    include: { notas: v.notes, marcacoes: v.highlights, favoritos: v.favorites },
    text: v.text,
    interlinear: v.interlinear,
    byDate: v.order === "data"
  };
  return buildNotebook(chosen, options, {
    chapter: (book, n) => (window.__carregarCapitulo ? window.__carregarCapitulo(book, n) : Promise.resolve(null)) as never,
    highlights: await records("marcacoes"),
    bookName,
    bookOrder,
    greek: code => bookOrder(code) >= 39
  });
}
async function generateNotebook() {
  exportView.busy = true;
  try {
    const c = await assembleNotebook();
    window.__ultimoCaderno = c;
    await printPage(c.html, t("notebook.file_title", { title: c.titulo }));
  } finally {
    exportView.busy = false;
  }
}
export async function printPage(html: string, title: string) {
  const err = await printHtml(html, title);
  if (err) toastMsg(t(err));
}

export async function downloadData() {
  const payload = await store.backup();
  window.__ultimoBackup = payload;
  if (await saveBackup(payload, t("notes.backup_share_title"))) toastMsg(t("notes.backup_downloaded"));
}
export const importData = store.importBackup;
export async function importFile(f: File) {
  try {
    const r = await importData(JSON.parse(await f.text()));
    toastMsg(t("notes.imported", { added: r.added, updated: r.updated, same: r.same }));
    renderList();
  } catch (err) {
    const e = err as Error;
    toastMsg(e.name === "BackupFormatError" ? e.message : t("notes.import_failed"));
  }
}

export function initExport() {
  mount(ExportSheet, { target: document.body, props: { onclose: () => closeExport(), ongenerate: () => generateNotebook() } });
}
