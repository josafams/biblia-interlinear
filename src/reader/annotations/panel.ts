// The Anotar panel (#mbar, AnnotatePanel.svelte; the rules of a verse in src/lib/annotations/verse.ts):
// color, favorite, tags, a quick note, copy, share, listen and clear, for a verse, a snippet of the Bíblia
// Livre or words of the original.
import { flushSync, mount } from "svelte";
import AnnotatePanel from "../../components/AnnotatePanel.svelte";
import { t } from "../../i18n";
import type { Anchor, Anchored } from "../../lib/annotations/verse";
import { exposedPlugin, isNative } from "../../lib/native";
import { verseLink } from "../../lib/share";
import { keyboardInset, revealScroll } from "../../lib/sheet";
import { annotate } from "../../state/annotate.svelte";
import { side } from "../../state/layout.svelte";
import { reducedMotion } from "../context";
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

// On phones and tablets the sheet covers the bottom: the verse moves to the room between the top bar and the sheet
function revealVerse() {
  const sec = selection && verseEl(selection.ancora.ver);
  const mb = document.getElementById("mbar");
  if (side.on || !sec || !mb || !annotate.open) return;
  const bar = document.querySelector<HTMLElement>(".bar");
  const top = bar && bar.offsetParent ? Math.max(0, bar.getBoundingClientRect().bottom) : 0;
  const r = sec.getBoundingClientRect();
  const y = revealScroll({ top: r.top, height: r.height }, { top, bottom: mb.getBoundingClientRect().top }, window.scrollY);
  if (Math.abs(y - window.scrollY) > 1) window.scrollTo({ top: y, behavior: reducedMotion() ? "auto" : "smooth" });
}
const afterLayout = (f: () => void) => requestAnimationFrame(() => requestAnimationFrame(f));

/** The size of the sheet on phones: compact (colors and actions) or full (also the note and the tags). */
export function setSize(size: "compact" | "full", focusNote = false) {
  annotate.size = size;
  flushSync();
  if (focusNote) document.getElementById("mb-note")?.focus({ preventScroll: true });
  afterLayout(revealVerse);
}

/** Opens the panel; titulo: answering a question (the answer becomes a new note with the question as title). */
export async function openBar(ancora: Anchor, labelText: string, trecho: string, titulo?: string) {
  const reopening = annotate.open;
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
  verseEl(ancora.ver)?.classList.add("editando");
  // a new sheet opens compact (an answer to a question opens with the note); another verse keeps the size
  if (titulo) annotate.size = "full";
  else if (!reopening) annotate.size = "compact";
  annotate.open = true;
  flushSync();
  document.body.classList.add("com-mbar");
  const first = titulo ? document.getElementById("mb-note") : document.getElementById("mbar")!.querySelector<HTMLElement>(".mb-color");
  first!.focus({ preventScroll: true });
  afterLayout(revealVerse);
}

async function refreshClear() {
  if (selection) annotate.hasRecords = await verse.hasAny(selection.ancora);
}

export function closeBar() {
  if (!annotate.open) return;
  flushQuickNote();
  annotate.open = false;
  annotate.size = "compact";
  flushSync();
  document.documentElement.style.setProperty("--kb", "0px");
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
  if (action === "escrever") return setSize("full", true);
  if (action === "mais") return setSize(annotate.size === "full" ? "compact" : "full");
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
      onsize: (size: "compact" | "full") => setSize(size),
      ontag: (id: string) => toggleTag(id),
      onnewtag: async (name: string) => toggleTag((await verse.tagNamed(name)).id, true),
      onnote: () => noteTyped()
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && annotate.open) closeBar();
  });
  const root = document.documentElement;
  // the height of the sheet: room at the end of the page (to bring the last verses above it) and the toasts over it
  const mb = document.getElementById("mbar")!;
  new ResizeObserver(() => root.style.setProperty("--mbar-h", `${mb.offsetHeight}px`)).observe(mb);
  // the on-screen keyboard (Safari on iOS only shrinks the visual viewport): Anotar and the note go up above it
  const vv = window.visualViewport;
  if (vv) {
    const fit = () => {
      const kb = keyboardInset(window.innerHeight, vv.height, vv.offsetTop);
      root.style.setProperty("--kb", `${kb}px`);
      const f = document.activeElement as HTMLElement | null;
      if (kb && f && f.closest("#mbar, #nota") && f.matches("textarea, input")) f.scrollIntoView({ block: "nearest" });
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
  }
}
