// The Anotar panel (#mbar, AnnotatePanel.svelte; the rules of a verse in src/lib/annotations/verse.ts):
// color, favorite, tags, a quick note, copy, share, listen and clear, for a verse, a snippet of the Bíblia
// Livre or words of the original.
import { flushSync, mount } from "svelte";
import AnnotatePanel from "../../components/AnnotatePanel.svelte";
import { t } from "../../i18n";
import type { Anchor, Anchored } from "../../lib/annotations/verse";
import { exposedPlugin, isNative } from "../../lib/native";
import { verseLink } from "../../lib/share";
import { annotate } from "../../state/annotate.svelte";
import { side } from "../../state/layout.svelte";
import { ANNOTATIONS_OPEN_PANEL, ANNOTATIONS_SPEAK } from "../events";
import { A, EDITION, paint, toastMsg, toastUndo, verse, verseAnchor, verseEl } from "./context";
import { openNote } from "./note";

type Selection = { ancora: Anchor; labelText: string; trecho: string; titulo?: string };
export let selection: Selection | null = null;

const ref = (a: Anchor) => `${A.chapter?.bookName || a.livro} ${a.cap}:${a.ver}`;
const blivreOf = (a: Anchor) => A.chapter?.verses.find(x => x.n === a.ver)?.blivre || "";

// Share: the address of the verse (#JHN.3.16) with the Bíblia Livre text. In the app it goes through the system
// share sheet and points to the published site; in the browser it uses the Web Share API or copies the link.
async function shareVerse(a: Anchor) {
  const url = verseLink({ book: a.livro, chapter: a.cap, verse: a.ver }, { native: isNative, href: location.href });
  const text = t("annotate.share_text", { text: selection?.trecho || blivreOf(a), ref: ref(a) }).trim();
  const share = exposedPlugin<{ share(o: object): Promise<unknown> }>("Share");
  try {
    if (share) return await share.share({ title: ref(a), text, url });
    if (navigator.share) return await navigator.share({ title: ref(a), text, url });
  } catch (err) {
    // the person closed the share sheet (browser: AbortError; app: "Share canceled")
    const e = err as Error;
    if (e && (e.name === "AbortError" || /cancel/i.test(e.message || ""))) return;
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toastMsg(t("annotate.link_copied"));
  } catch {
    toastMsg(t("annotate.share_failed"));
  }
}

/** Opens the panel; titulo: answering a question (the answer becomes a new note with the question as title). */
export async function openBar(ancora: Anchor, labelText: string, trecho: string, titulo?: string) {
  document.dispatchEvent(new CustomEvent(ANNOTATIONS_OPEN_PANEL));
  selection = { ancora, labelText, trecho, titulo };
  // without a snippet selected, the start of the verse itself shows, as in the design
  const quoted = trecho || (ancora.camada === "versiculo" ? ancora.trecho : "") || "";
  annotate.ref = labelText;
  annotate.snippet = titulo
    ? t("annotate.question", { question: titulo })
    : quoted
      ? `“${quoted.length > 90 ? quoted.slice(0, 88) + "…" : quoted}”`
      : "";
  annotate.verse = ancora.ver;
  annotate.question = !!titulo;
  await loadQuickNote(ancora);
  if (titulo) {
    quickNote = null;
    annotate.note = "";
    annotate.noteStatus = "";
  }
  await showTags();
  annotate.color = (await verse.highlightOf(ancora))?.cor || "";
  annotate.favorite = !!(await verse.favoriteOf(ancora));
  annotate.showLayers = document.body.classList.contains("hide-orig");
  annotate.hasRecords = await verse.hasAny(ancora);
  document.querySelectorAll(".verse.editando").forEach(v => v.classList.remove("editando"));
  const sec = verseEl(ancora.ver);
  sec?.classList.add("editando");
  // on phones the sheet covers the bottom: the verse goes up to stay visible above it
  if (sec && !side.on) sec.scrollIntoView({ block: "start" });
  annotate.open = true;
  flushSync();
  document.body.classList.add("com-mbar");
  const first = titulo ? document.getElementById("mb-note") : document.getElementById("mbar")!.querySelector<HTMLElement>(".mb-color");
  first!.focus({ preventScroll: true });
}

async function refreshClear() {
  if (selection) annotate.hasRecords = await verse.hasAny(selection.ancora);
}

export function closeBar() {
  if (!annotate.open) return;
  flushQuickNote();
  annotate.open = false;
  flushSync();
  selection = null;
  document.querySelectorAll(".verse.editando").forEach(v => v.classList.remove("editando"));
  document.body.classList.remove("com-mbar");
}

async function setColor(color: string) {
  if (!selection) return;
  await verse.setColor(selection.ancora, color || null);
  await paint();
  annotate.color = color;
  refreshClear();
}

async function panelAction(action: string, button: HTMLElement) {
  if (!selection) return;
  const a = selection.ancora;
  if (action === "nota") {
    const s = selection;
    await flushQuickNote();
    const id = quickNote?.id;
    closeBar();
    return id ? openNote(id) : openNote(null, s.ancora, s.trecho);
  }
  if (action === "ouvir") {
    const vi = A.chapter?.verses.findIndex(x => x.n === a.ver) ?? -1;
    if (vi >= 0) document.dispatchEvent(new CustomEvent(ANNOTATIONS_SPEAK, { detail: { vi, btn: button } }));
    return;
  }
  if (action === "fav") {
    await verse.toggleFavorite(a, EDITION);
    await paint();
    return openBar(a, selection.labelText, selection.trecho);
  }
  if (action === "limpar") return clearVerse(a);
  if (action === "copiar") {
    try {
      await navigator.clipboard.writeText(t("annotate.share_text", { text: selection.trecho || blivreOf(a), ref: ref(a) }));
      toastMsg(t("annotate.copied"));
    } catch {
      toastMsg(t("annotate.copy_failed"));
    }
    return closeBar();
  }
  if (action === "compartilhar") {
    await shareVerse(a);
    return closeBar();
  }
  if (action === "camadas") {
    verseEl(a.ver)?.classList.toggle("abrir");
    return closeBar();
  }
}

// Clear the verse (color, notes, favorite) with "Desfazer" for a few seconds
async function clearVerse(a: Anchor) {
  const gone = await verse.clear(a);
  closeBar();
  await paint();
  toastUndo(t("annotate.cleared", { count: gone.count }), async () => {
    await gone.undo();
    await paint();
    toastMsg(t("annotate.restored"));
  });
}

// The quick note in the panel itself: edits the first note of the verse (or makes one when typing)
let quickNote: Anchored | null = null,
  quickTimer: ReturnType<typeof setTimeout> | 0 = 0;
async function loadQuickNote(a: Anchor) {
  const ns = await verse.notes(a);
  quickNote = ns[0] || null;
  annotate.note = quickNote?.texto || "";
  annotate.noteStatus = ns.length > 1 ? t("annotate.other_notes", { count: ns.length - 1 }) : "";
}
async function flushQuickNote() {
  if (!quickTimer) return;
  clearTimeout(quickTimer);
  quickTimer = 0;
  await saveQuickNote();
}
async function saveQuickNote() {
  if (!selection) return;
  const texto = annotate.note;
  if (!quickNote && !texto.trim()) return;
  quickNote = await verse.saveNote(quickNote, selection.ancora, texto, selection.titulo || "");
  annotate.noteStatus = t("annotate.saved");
  paint();
  refreshClear();
}
function noteTyped() {
  if (quickTimer) clearTimeout(quickTimer);
  annotate.noteStatus = "…";
  quickTimer = setTimeout(() => {
    quickTimer = 0;
    saveQuickNote();
  }, 600);
}
async function showTags() {
  if (selection) annotate.tags = await verse.tagChoices(selection.ancora);
}
// A tag on or off for the verse: it goes to every record of it (color, notes and favorite)
async function toggleTag(id: string, turnOn?: boolean) {
  if (!selection) return;
  await verse.toggleTag(selection.ancora, id, turnOn);
  await showTags();
  paint();
  refreshClear();
}

/** Opens the panel for a verse of the chapter on screen: the whole verse, a snippet or words of the original. */
export function openForVerse(sec: HTMLElement, camada: Anchor["camada"], extra: Partial<Anchor>) {
  const C = A.chapter;
  const v = C?.verses[+sec.dataset.vi!];
  if (!C || !v) return;
  const a: Anchor = { ...verseAnchor(C.book, C.chapter, v.n), ...extra, camada };
  if (camada === "versiculo") a.trecho = (v.blivre || "").slice(0, 200);
  const trecho = camada === "versiculo" ? "" : extra.trecho || "";
  openBar(a, `${C.bookName} ${C.chapter}:${v.n}`, trecho);
}

export function initPanel() {
  mount(AnnotatePanel, {
    target: document.body,
    props: {
      onclose: () => closeBar(),
      oncolor: (color: string) => setColor(color),
      onaction: (action: string, button: HTMLElement) => panelAction(action, button),
      ontag: (id: string) => toggleTag(id),
      onnewtag: async (name: string) => toggleTag((await verse.tagNamed(name)).id, true),
      onnote: () => noteTyped()
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && annotate.open) closeBar();
  });
}
