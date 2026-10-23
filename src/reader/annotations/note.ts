// The note editor (#nota, NoteEditor.svelte): a note on a verse or a free note, with title, text and tags.
// It saves while typing; deleting asks for a second tap instead of a browser dialog.
import { flushSync, mount } from "svelte";
import NoteEditor from "../../components/NoteEditor.svelte";
import { t } from "../../i18n";
import { type StoredRecord, uuid } from "../../lib/annotations/store";
import { type Anchor, type Anchored, chapterOf } from "../../lib/annotations/verse";
import { note } from "../../state/note.svelte";
import { A, bookName, chapterKey, paint, records, store, tags, verse } from "./context";
import { openList } from "./list";

/** a free note has no anchor; nova: not saved yet */
type EditedNote = StoredRecord & { ancora: Anchor | null; titulo?: string; texto?: string; etiquetas?: string[]; nova?: boolean };
let currentNote: EditedNote | null = null,
  saveTimer: ReturnType<typeof setTimeout> | undefined,
  focusReturn: Element | null = null;

export async function openNote(id: string | null, ancora?: Anchor | null, trecho?: string | null, title?: string) {
  focusReturn = document.activeElement;
  currentNote = id
    ? (await records("notas")).find(n => n.id === id) || null
    : {
        id: uuid(),
        cap: ancora ? chapterOf(ancora) : "livre",
        ancora: ancora || null,
        titulo: title || "",
        texto: "",
        etiquetas: ancora ? await verse.tags(ancora) : [],
        nova: true
      };
  if (!currentNote) return;
  const a = currentNote.ancora;
  const quoted = trecho || a?.trecho;
  note.ref = a ? `${bookName(a.livro)} ${a.cap}:${a.ver}${quoted ? ` · “${quoted.slice(0, 80)}”` : ""}` : t("note.free");
  note.title = currentNote.titulo || "";
  note.text = currentNote.texto || "";
  note.status = currentNote.nova ? "" : t("annotate.saved");
  note.saved = !currentNote.nova;
  note.confirming = false;
  await renderNoteTags();
  note.open = true;
  flushSync();
  document.body.classList.add("com-nota");
  document.getElementById("note-text")!.focus();
}

async function renderNoteTags() {
  note.tags = (await tags()).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
  note.selected = [...(currentNote?.etiquetas || [])];
}
function scheduleSave() {
  clearTimeout(saveTimer);
  note.status = "…";
  saveTimer = setTimeout(saveNote, 600);
}
async function saveNote() {
  if (!currentNote) return;
  const titulo = note.title.trim(),
    texto = note.text;
  if (currentNote.nova && !titulo && !texto.trim()) {
    note.status = "";
    return;
  }
  const { nova: _nova, ...rec } = currentNote;
  currentNote = { ...((await store.save("notas", { ...rec, titulo, texto })) as EditedNote) };
  note.status = t("annotate.saved");
  note.saved = true;
  paint();
}
function closeNote() {
  if (!note.open) return;
  clearTimeout(saveTimer);
  saveNote();
  note.open = false;
  flushSync();
  currentNote = null;
  document.body.classList.remove("com-nota");
  if (focusReturn instanceof HTMLElement && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
}
async function toggleNoteTag(id: string, turnOn?: boolean) {
  if (!currentNote) return;
  const set = new Set(currentNote.etiquetas || []);
  if (turnOn ?? !set.has(id)) set.add(id);
  else set.delete(id);
  currentNote.etiquetas = [...set];
  await saveNote();
  return renderNoteTags();
}

let confirmTimer: ReturnType<typeof setTimeout> | undefined;
async function deleteNote() {
  if (!note.confirming) {
    note.confirming = true;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (note.confirming = false), 4000);
    return;
  }
  clearTimeout(confirmTimer);
  note.confirming = false;
  if (currentNote) await store.removeRecord("notas", currentNote.id);
  currentNote = null;
  await paint();
  return closeNote();
}

/** The note button of a verse: its only note, or the list of its notes. */
export async function openVerseNotes(ver: number) {
  if (!A.chapter) return;
  const ns = ((await store.ofChapter("notas", chapterKey())) as Anchored[])
    .filter(n => n.ancora?.ver === ver)
    .sort((x, y) => String(x.criado_em).localeCompare(String(y.criado_em)));
  if (ns.length === 1) return openNote(ns[0].id);
  openList({ cap: chapterKey(), ver });
}

export function initNote() {
  mount(NoteEditor, {
    target: document.body,
    props: {
      onclose: () => closeNote(),
      oninput: () => scheduleSave(),
      ontag: (id: string) => toggleNoteTag(id),
      onnewtag: async (name: string) => toggleNoteTag((await verse.tagNamed(name)).id, true),
      ondelete: () => deleteNote()
    }
  });
}
