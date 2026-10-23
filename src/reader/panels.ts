// The index (#toc) and Aparência (#look) panels: opening one closes the others, a modal one locks the page
// behind it and keeps the focus inside. Also the buttons of the top and the bottom bar that open them.
import { flushSync, mount } from "svelte";
import Appearance from "../components/Appearance.svelte";
import ChapterNavButton from "../components/ChapterNavButton.svelte";
import ChapterPosition from "../components/ChapterPosition.svelte";
import FirstUseHints from "../components/FirstUseHints.svelte";
import FocusMode from "../components/FocusMode.svelte";
import LookButton from "../components/LookButton.svelte";
import ModeSwapButton from "../components/ModeSwapButton.svelte";
import NotesButton from "../components/NotesButton.svelte";
import ReadBar from "../components/ReadBar.svelte";
import SayButton from "../components/SayButton.svelte";
import SideTabs from "../components/SideTabs.svelte";
import TocButton from "../components/TocButton.svelte";
import WhereButton from "../components/WhereButton.svelte";
import { t } from "../i18n";
import { followAnnotations } from "../state/annotations.svelte";
import { entry as entryState } from "../state/entry.svelte";
import { side } from "../state/layout.svelte";
import { loadPrefs } from "../state/prefs.svelte";
import { type Sheet, ui } from "../state/ui.svelte";
import { R, book, chapter, toast, topBar, versesEl } from "./context";
import { closeDetail, openWord } from "./entry";
import { goNeighbor, hereIndex } from "./chapter";
import { applyMode, togglePref } from "./reading-modes";
import { speakFrom, tts } from "./speech";
import { openToc, openWhere, pickBook, tocTab } from "./toc";
import { firstWordOfVerse, focusWord } from "./words";

const sheetEl = (name: Sheet) => document.getElementById(name)!;
// the buttons that open them are components (TocButton, LookButton) in the top or the bottom bar, by screen width
const opener = (name: Sheet) => document.getElementById(name === "toc" ? "open-toc" : "open-look");
const page = () => document.getElementById("page")!;
const scrim = () => document.getElementById("scrim")!;

function focusables(el: HTMLElement) {
  return [...el.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, summary, [tabindex]:not([tabindex="-1"])')].filter(
    x => x.offsetParent !== null
  );
}
/** The page behind a modal panel: out of reach of the keyboard and screen readers, and not scrolling. */
function lockPage(on: boolean) {
  scrim().hidden = !on;
  page().inert = on;
  topBar().inert = on;
  document.getElementById("detail")!.inert = on;
  document.body.style.overflow = on ? "hidden" : "";
}

// On computers (≥ 1100 px) Aparência opens in the panel beside the text, as the entry and Anotar do
export function openPanel(name: Sheet, focusEl?: HTMLElement | null) {
  if (entryState.open) closeDetail();
  if (ui.sheet) closePanel(false);
  window.Annotations?.closeBar();
  sheetEl(name).hidden = false;
  ui.sheet = name;
  flushSync();
  if (name === "look" && side.on) document.body.classList.add("com-look");
  else lockPage(true);
  if (name === "toc") pickBook(book().code, R.cur);
  const first =
    focusEl ||
    (name === "toc"
      ? sheetEl("toc").querySelector<HTMLElement>(".vchip.here")
      : sheetEl("look").querySelector<HTMLElement>('[aria-pressed="true"]'));
  (first || focusables(sheetEl(name))[0])?.focus({ preventScroll: true });
}

export function closePanel(restore = true) {
  const name = ui.sheet;
  if (!name) return;
  sheetEl(name).hidden = true;
  ui.sheet = null;
  flushSync();
  document.body.classList.remove("com-look");
  lockPage(false);
  if (restore) opener(name)?.focus({ preventScroll: true });
}

function trapFocus(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (ui.sheet) {
      e.preventDefault();
      return closePanel();
    }
    if (entryState.open) {
      e.preventDefault();
      return closeDetail();
    }
  }
  if (e.key === "Tab" && ui.sheet) {
    const sheet = sheetEl(ui.sheet);
    const f = focusables(sheet);
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!sheet.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }
}

/** Aparência; the saved preferences are applied first (body classes, text size, theme). */
export function initAppearance() {
  loadPrefs();
  mount(Appearance, {
    target: document.body,
    anchor: sheetEl("toc").nextSibling!,
    props: {
      onmode: applyMode,
      ontoggle: togglePref,
      oninstallvoices: () => tts.openInstall().catch(() => toast(t("audio.install_failed"))),
      onsources() {
        // Fontes e licenças: the sources footer (hidden day to day) shows and the page goes to it
        closePanel(false);
        const f = document.getElementById("fontes")!;
        f.classList.add("show");
        f.scrollIntoView({ behavior: "smooth" });
      }
    }
  });
}

export function initBars() {
  const bar = topBar(),
    bbar = document.getElementById("bbar")!;
  const openLook = () => openPanel("look");
  const say = (b: HTMLElement) => speakFrom(hereIndex(), b);
  mount(TocButton, { target: bar, anchor: bar.firstChild!, props: { place: "top", onopen: openToc } });
  mount(WhereButton, { target: bar, anchor: document.getElementById("bar-modes")!, props: { onopen: openWhere } });
  mount(ModeSwapButton, { target: bar, anchor: document.getElementById("open-search")!, props: { onswap: applyMode } });
  mount(LookButton, { target: bar, anchor: document.getElementById("open-account")!, props: { place: "top", onopen: openLook } });
  mount(ChapterNavButton, { target: bar, anchor: document.getElementById("where")!, props: { dir: -1, place: "top", ongo: goNeighbor } });
  mount(ChapterNavButton, {
    target: bar,
    anchor: document.getElementById("bar-modes")!,
    props: { dir: 1, place: "top", ongo: goNeighbor }
  });
  mount(SayButton, { target: bar, anchor: document.getElementById("mode-swap")!, props: { place: "top", onsay: say } });
  // bottom bar (phone): Livros · ‹ · Ouvir · › · Aa (Livros and Aa only on phones), appended in order
  mount(TocButton, { target: bbar, props: { place: "bottom", onopen: openToc } });
  mount(ChapterNavButton, { target: bbar, props: { dir: -1, place: "bottom", ongo: goNeighbor } });
  mount(SayButton, { target: bbar, props: { place: "bottom", onsay: say } });
  mount(ChapterNavButton, { target: bbar, props: { dir: 1, place: "bottom", ongo: goNeighbor } });
  mount(LookButton, { target: bbar, props: { place: "bottom", onopen: openLook } });
  // phone: the bottom bar has five buttons (Livros and Aparência join it)
  const phone = matchMedia("(max-width: 720px)"); // i18n-ignore
  const five = () => bbar.classList.toggle("cinco", phone.matches);
  five();
  phone.addEventListener("change", five);
  // computer, as in the design: "Notas · N" opens Minhas anotações; the account icon opens Você in the index
  mount(NotesButton, {
    target: bar,
    anchor: document.getElementById("bar-prev")!,
    props: {
      onopen() {
        if (ui.sheet) closePanel(false);
        window.Annotations?.openList();
      }
    }
  });
  document.getElementById("open-account")!.addEventListener("click", () => {
    openPanel("toc");
    tocTab("voce");
  });
  // the thin progress line and, in long chapters, "v. 60 de 176", at the end of the top bar
  mount(ReadBar, { target: bar });
  mount(ChapterPosition, { target: bar });
  window.addEventListener("load", () => {
    if (window.Annotations) followAnnotations(window.Annotations as never);
  });
}

export function initPanels() {
  scrim().addEventListener("click", () => closePanel());
  for (const name of ["toc", "look"] as const)
    sheetEl(name).addEventListener("click", e => {
      if ((e.target as HTMLElement).closest("[data-close]")) closePanel();
    });
  document.addEventListener("keydown", trapFocus);
  document.getElementById("skip")!.addEventListener("click", e => {
    e.preventDefault();
    const w = firstWordOfVerse(0);
    versesEl().scrollIntoView();
    focusWord(w);
  });
  // computer: the tabs Verbete · Anotar · Aparência on top of the panel beside the text
  mount(SideTabs, {
    target: document.body,
    props: {
      onpick(tab: "verbete" | "anotar" | "aparencia") {
        if (tab === "aparencia") return openPanel("look");
        if (tab === "anotar") {
          if (ui.sheet) closePanel(false);
          if (entryState.open) closeDetail();
          return window.Annotations?.openVerse(R.hereV);
        }
        if (R.lastWord?.isConnected) return openWord(R.lastWord);
        const first = firstWordOfVerse(
          Math.max(
            0,
            chapter().verses.findIndex(v => v.n === R.hereV)
          )
        );
        if (first) openWord(first);
      }
    }
  });
  // Modo de foco and the first-use hints (no markup)
  mount(FocusMode, { target: document.body });
  mount(FirstUseHints, { target: document.body });
}
