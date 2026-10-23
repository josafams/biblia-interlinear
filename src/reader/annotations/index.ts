// The annotations of the reader: the panels, the gestures on the text and window.Annotations, which the
// account, the sync, the progress, the tests and the videos use.
import { COLLECTIONS } from "../../lib/annotations/store";
import { A, type ShownChapter, paint, store, verseAnchor, verseEl } from "./context";
import { assembleNotebook, downloadData, importData, initExport, printPage } from "./export";
import { initGestures } from "./gestures";
import { initList, openList } from "./list";
import { initNote, openNote } from "./note";
import { closeBar, initPanel, openBar, openForVerse } from "./panel";

if (!window.Annotations) {
  initPanel();
  initGestures();
  initNote();
  initList();
  initExport();
  document.addEventListener("chapter-rendered", e => {
    A.chapter = (e as CustomEvent<ShownChapter>).detail;
    closeBar();
    paint();
  });
  const { allRecords, save, removeRecord, storage } = store;
  window.Annotations = {
    openList,
    openNote,
    // "Anotar resposta" of Perguntas ao texto: the panel of the verse, with the question as the title of the note
    noteForQuestion: (book: string, chapter: number, n: number, question: string) => {
      const a = verseAnchor(book, chapter, n);
      const v = A.chapter?.verses.find(x => x.n === n);
      if (!v) return openNote(null, a, null, question);
      a.trecho = (v.blivre || "").slice(0, 200);
      return openBar(a, `${A.chapter!.bookName} ${chapter}:${n}`, "", question);
    },
    closeBar,
    openVerse: (n: number) => {
      const sec = verseEl(n);
      if (sec) openForVerse(sec, "versiculo", {});
    },
    paint,
    allRecords,
    save,
    removeRecord,
    importData,
    downloadData,
    assembleNotebook,
    printHtml: printPage,
    countAll: async () =>
      (await Promise.all((["notas", "marcacoes", "favoritos"] as const).map(c => allRecords(c)))).reduce((s, l) => s + l.length, 0),
    onChange: store.onChange,
    exportAll: async () => Object.fromEntries(await Promise.all(COLLECTIONS.map(async c => [c, await allRecords(c)]))),
    local: store.persistent,
    storage
  } as unknown as NonNullable<Window["Annotations"]>;
  if (window.__currentChapter) {
    A.chapter = window.__currentChapter as ShownChapter;
    paint();
  }
}
