// The reader (ler.html): starts the parts in the order the page needs them (each mount finds the elements
// the earlier ones made), then opens the first chapter. The scripts imported after this one (study, search,
// annotations, account, sync, progress) talk to it through the window.* bridges set here.
import { mount } from "svelte";
import Toast from "../components/Toast.svelte";
import { isNative, nativePlugin, platform } from "../lib/native";
import { entry as entryState } from "../state/entry.svelte";
import { ui } from "../state/ui.svelte";
import { BOOKS, R, bible } from "./context";
import { initChapter, goNeighbor, openChapter, start } from "./chapter";
import { closeDetail, initEntry } from "./entry";
import { ANNOTATIONS_GOTO, ANNOTATIONS_OPEN_PANEL, ANNOTATIONS_SPEAK } from "./events";
import { closePanel, initAppearance, initBars, initPanels } from "./panels";
import { initModes } from "./reading-modes";
import { initSpeech, speakVerse } from "./speech";
import { initToc, initTocTabs, parseRef, resolveRef } from "./toc";
import { initWordKeys } from "./words";

// bridges for the annotations (src/reader/annotations), the notebook and the tests
function bridges() {
  window.__carregarCapitulo = (code, n) => bible.fetchChapter(code, n);
  window.__chapter = () => R.ch;
  window.__resolveRef = q => resolveRef(parseRef(q));
  window.__books = Object.fromEntries(
    BOOKS.map((b, i) => [b.code, { name: b.name, abbrev: b.abbrev, i, nt: !!b.nt, group: b.group, chapterCount: b.chapters.length }])
  );
  document.addEventListener(ANNOTATIONS_GOTO, e => {
    const d = (e as CustomEvent).detail;
    openChapter(d.book, d.chapter, d.verse);
  });
  document.addEventListener(ANNOTATIONS_SPEAK, e => speakVerse((e as CustomEvent).detail.vi, (e as CustomEvent).detail.btn));
  document.addEventListener(ANNOTATIONS_OPEN_PANEL, () => {
    if (ui.sheet) closePanel(false);
    if (entryState.open) closeDetail();
  });
}

// keyboard (outside text fields and panels): [ and ] change chapter; / opens the search
function shortcuts(e: KeyboardEvent) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || ui.sheet || document.body.classList.contains("com-busca")) return;
  const fields = "input, textarea, select, [contenteditable]"; // i18n-ignore
  if ((e.target as HTMLElement).closest?.(fields)) return;
  if (e.key === "[" || e.key === "]") {
    e.preventDefault();
    goNeighbor(e.key === "]" ? 1 : -1);
  } else if (e.key === "/" && window.__openSearch) {
    e.preventDefault();
    window.__openSearch();
  }
}

function app() {
  // the Android back button closes a panel, then the entry, then the app
  const App = nativePlugin<{ addListener(ev: string, f: () => void): void; exitApp(): void }>("App");
  if (App && platform === "android")
    App.addListener("backButton", () => {
      if (ui.sheet) return closePanel();
      if (entryState.open) return closeDetail();
      App.exitApp();
    });
  // the installable web version works offline with the service worker (never in the app)
  if ("serviceWorker" in navigator && !isNative && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]'))
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline is a bonus */
      });
    });
}

initChapter();
initWordKeys();
initEntry();
// the message at the bottom of the screen (src/state/toast.svelte.ts)
mount(Toast, { target: document.body });
initAppearance();
initBars();
initPanels();
initToc();
bridges();
initModes();
document.addEventListener("keydown", shortcuts);
initTocTabs();
initSpeech();
app();
start();
