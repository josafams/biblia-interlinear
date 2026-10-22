/* Leitor da Bíblia Interlinear (ler.html): índice, capítulos, verbetes, áudio, aparência e modos de leitura.
 * ES module bundled by src/reader/main.ts; the books list (DATA) is inlined in ler.html before it
 * (see vite/site/reader-page.ts). Pure helpers live in src/lib. */
import { t } from "../src/i18n";
import { createSpeech } from "../src/lib/audio/tts";
import { createBible, toWord } from "../src/lib/data/bible";
import { SITE_URL, isNative as NATIVE, nativePlugin, platform as PLATFORM } from "../src/lib/native";
import { flushSync, mount } from "svelte";
import BookList from "../src/components/BookList.svelte";
import ChapterHeading from "../src/components/ChapterHeading.svelte";
import ChapterLexicon from "../src/components/ChapterLexicon.svelte";
import ChapterNavButton from "../src/components/ChapterNavButton.svelte";
import ChapterPicker from "../src/components/ChapterPicker.svelte";
import ChapterText from "../src/components/ChapterText.svelte";
import GoTo from "../src/components/GoTo.svelte";
import HeaderChips from "../src/components/HeaderChips.svelte";
import LexiconEntry from "../src/components/LexiconEntry.svelte";
import LexiconSheet from "../src/components/LexiconSheet.svelte";
import LookButton from "../src/components/LookButton.svelte";
import MiniPlayer from "../src/components/MiniPlayer.svelte";
import ModeNote from "../src/components/ModeNote.svelte";
import ModeSelector from "../src/components/ModeSelector.svelte";
import ModeSwapButton from "../src/components/ModeSwapButton.svelte";
import NextChapter from "../src/components/NextChapter.svelte";
import NotesButton from "../src/components/NotesButton.svelte";
import Questions from "../src/components/Questions.svelte";
import NotesCount from "../src/components/NotesCount.svelte";
import SayButton from "../src/components/SayButton.svelte";
import TocButton from "../src/components/TocButton.svelte";
import TocVerses from "../src/components/TocVerses.svelte";
import WhereButton from "../src/components/WhereButton.svelte";
import { MODE_IDS, eyebrowText as eyebrowFor, getMode, isModeId } from "../src/lib/modes";
import { entryView } from "../src/lib/lexicon/entry";
import { bookQuery } from "../src/lib/books";
import { gotoPreview } from "../src/lib/goto";
import { createRefs } from "../src/lib/refs";
import { store } from "../src/lib/store";
import { cleanHeb, esc } from "../src/lib/text";
import { followAnnotations } from "../src/state/annotations.svelte";
import { entry as entryState } from "../src/state/entry.svelte";
import { goto as gotoState } from "../src/state/goto.svelte";
import { LAZY_FROM, chapter as chapterState, fillVerse, showChapter } from "../src/state/chapter.svelte";
import { reader as readerState } from "../src/state/reader.svelte";
import { speech as speechState } from "../src/state/speech.svelte";
import { toc } from "../src/state/toc.svelte";
import { ui } from "../src/state/ui.svelte";
const BOOKS = DATA.books;
const BY_CODE = Object.fromEntries(BOOKS.map(b => [b.code, b]));
// chapters and lexicon on demand (src/lib/data/bible.ts)
const { lex: LEX, chapters: CAPS, ensureLex, hasChapter, fetchChapter } = createBible(DATA);

const prefs = {
  cant: store.get("cantilacao", "on") === "on",
  follow: store.get("acompanhar", "on") === "on",
  slow: store.get("voz-lenta", "off") === "on"
};

// ---------- Estado ----------
let lastWord = null; // última palavra aberta (a aba Verbete volta para ela)
let BOOK = null,
  CUR = 0,
  CH = null,
  GRC = false,
  hereV = 1;
const isGrc = b => b.nt;
const OLANG = () => (GRC ? "grc" : "he");

// ---------- Cabeçalho, versículos ----------
const root = document.getElementById("verses");
mount(ChapterText, { target: root });
mount(TocVerses, { target: document.querySelector('#toc nav[aria-labelledby="toc-vh"]') });
mount(HeaderChips, {
  target: document.querySelector("#page > header"),
  anchor: document.getElementById("ch-say"),
  props: { onabout: () => toggleAbout(), ongo: selector => goLocal(selector) }
});
mount(ChapterHeading, { target: document.querySelector("#page > header"), anchor: document.querySelector("#page > header .kbd") });
let io = null;
function vLabel(v) {
  return v.n === 0 ? "título" : `${CUR}:${v.n}`;
}
function renderHeader() {
  const A = BOOK.about;
  document.title = `${BOOK.name} ${CUR} · Bíblia Interlinear`;
  // the title block is ChapterHeading.svelte
  readerState.greek = GRC;
  readerState.eyebrow = eyebrowText();
  readerState.heading = {
    book: BOOK.name,
    chapter: CUR,
    titleOrig: A?.title_orig || "",
    theme: BOOK.chapters[CUR - 1]?.t || "",
    hasAbout: !!A
  };
  document.body.classList.toggle("grc", GRC);
  document.getElementById("verses").setAttribute("aria-label", `Texto de ${BOOK.name} ${CUR}`);
  // os ‹ › das barras (ChapterNavButton) e os atalhos do cabeçalho (HeaderChips) leem readerState
  toc.here = { book: BOOK.code, chapter: CUR };
  for (const dir of [-1, 1]) {
    const x = neighbor(dir);
    readerState[dir < 0 ? "prev" : "next"] = x
      ? {
          code: x.b.code,
          name: x.b.name,
          abbrev: x.b.abbrev,
          n: x.n,
          theme: x.b.chapters[x.n - 1].t || "",
          available: hasChapter(x.b.code, x.n)
        }
      : null;
  }
  flushSync();
}
function renderVerses() {
  const lazy = CH.verses.length >= LAZY_FROM && "IntersectionObserver" in window;
  showChapter(CH.verses, { lex: LEX, greek: GRC, cantillation: prefs.cant, chapter: CUR }, OLANG(), lazy);
  readerState.greek = GRC;
  readerState.questions = CH.questions.map(q => ({ ...q, lemma: (q.strong && LEX[q.strong]?.l) || undefined }));
  flushSync();
  if (io) document.querySelectorAll(".verse").forEach(sec => io.observe(sec));
  // Anotações (annotations.js) desenham suas marcações quando o capítulo muda
  window.__currentChapter = {
    book: BOOK.code,
    chapter: CUR,
    bookName: BOOK.name,
    bookAbbrev: BOOK.abbrev,
    verses: CH.verses.map(v => ({ n: v.n, blivre: v.blivre, words: v.words.map(w => ({ heb: w.heb })) }))
  };
  document.dispatchEvent(new CustomEvent("chapter-rendered", { detail: window.__currentChapter }));
}
function neighbor(dir) {
  const bi = BOOKS.indexOf(BOOK);
  let b = BOOK,
    n = CUR + dir;
  if (n < 1) {
    b = BOOKS[bi - 1];
    if (!b) return null;
    n = b.chapters.length;
  } else if (n > BOOK.chapters.length) {
    b = BOOKS[bi + 1];
    if (!b) return null;
    n = 1;
  }
  return { b, n };
}
// ---------- Perguntas ao texto (data/questions): perguntas sem respostas, para pensar ou conversar ----------
// the section is Questions.svelte, before the chapter lexicon
mount(Questions, {
  target: document.getElementById("page"),
  anchor: document.getElementById("lexico"),
  props: {
    ongoverse: v => scrollToVerse(v, true),
    onword(strong, button) {
      if (active) active.classList.remove("active");
      active = null;
      navStack = [];
      show(strong, null, button);
    },
    onnote(q) {
      if (!window.Annotations?.noteForQuestion) return;
      const first = +(q.verses || "").split("-")[0] || CH.verses[0]?.n || 1;
      window.Annotations.noteForQuestion(BOOK.code, CUR, first, q.text);
    }
  }
});
// the "Próximo capítulo" card after the chapter lexicon (NextChapter.svelte)
mount(NextChapter, {
  target: document.getElementById("page"),
  anchor: document.getElementById("lexico").nextSibling,
  props: {
    ongo: c => (c.available ? openChapter(c.code, c.n, null) : toast(t("reader.not_in_preview")))
  }
});

function wordEl(vi, i) {
  fillVerse(vi);
  return root.querySelector(`.word[data-v="${vi}"][data-i="${i}"]`);
}
function firstWordOfVerse(vi) {
  for (let k = vi; k < CH.verses.length; k++) {
    const el = wordEl(k, 0);
    if (el) return el;
  }
  return null;
}
function focusWord(el, noScroll = false) {
  if (!el) return;
  el.parentElement.querySelectorAll(".word").forEach(b => {
    b.tabIndex = -1;
  });
  el.tabIndex = 0;
  el.focus({ preventScroll: noScroll });
}
root.addEventListener("keydown", e => {
  const b = e.target.closest(".word");
  if (!b) return;
  const v = +b.dataset.v,
    i = +b.dataset.i,
    last = CH.verses[v].words.length - 1;
  const firstOf = n => (n >= 0 && n < CH.verses.length ? wordEl(n, 0) : null);
  const lastOf = n => (n >= 0 && n < CH.verses.length ? wordEl(n, CH.verses[n].words.length - 1) : null);
  const fwd = GRC ? "ArrowRight" : "ArrowLeft",
    back = GRC ? "ArrowLeft" : "ArrowRight";
  let to = null;
  switch (e.key) {
    case fwd:
      to = i < last ? wordEl(v, i + 1) : firstOf(v + 1);
      break;
    case back:
      to = i > 0 ? wordEl(v, i - 1) : lastOf(v - 1);
      break;
    case "ArrowDown":
      to = firstOf(v + 1);
      break;
    case "ArrowUp":
      to = firstOf(v - 1);
      break;
    case "Home":
      to = wordEl(v, 0);
      break;
    case "End":
      to = wordEl(v, last);
      break;
    default:
      return;
  }
  e.preventDefault();
  if (to) {
    focusWord(to);
    to.scrollIntoView({ block: "nearest" });
  }
});

// the panel is LexiconSheet.svelte; its hidden attribute follows entryState.open
mount(LexiconSheet, { target: document.body });
const detail = document.getElementById("detail");
const dbody = document.getElementById("d-body");
const page = document.getElementById("page");
// a barra de cima fica fora de #page (na largura toda); entra junto quando um painel modal trava a página
const topBar = document.querySelector("nav.bar");
let active = null,
  navStack = [],
  current = null,
  returnTo = null;

// ---------- Áudio ----------
// The engine (system voices in the app, Web Speech in the browser) is src/lib/audio/tts.ts; here are the buttons.
// In the app the home page and the videos stay on the site (they open in the device browser).
if (NATIVE)
  document.querySelectorAll("a.site-link").forEach(a => {
    a.href = SITE_URL + a.getAttribute("href");
    a.target = "_blank";
    a.rel = "noopener";
  });
let curBtn = null,
  speakingEl = null,
  toastTimer = 0;

function updateVoiceNote(speech) {
  document.getElementById("voice-note").textContent = speech.voiceNote();
  document.getElementById("voice-install").hidden = !speech.canInstallVoices();
}
const tts = createSpeech(updateVoiceNote);
function setBtn(btn) {
  if (curBtn) curBtn.classList.remove("on");
  curBtn = btn;
  if (btn) btn.classList.add("on");
  document.dispatchEvent(new CustomEvent("speech-state", { detail: { on: !!btn } }));
}
function markSpeaking(el) {
  if (speakingEl) speakingEl.classList.remove("speaking");
  speakingEl = el;
  document.dispatchEvent(new CustomEvent("speech-state", { detail: { on: !!curBtn, el } }));
  if (el) {
    el.classList.add("speaking");
    el.scrollIntoView({ block: "nearest" });
  }
}
function stopSpeech() {
  tts.stop();
  setBtn(null);
  markSpeaking(null);
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("dica");
  t.hidden = false;
  clearTimeout(toastTimer);
  // só esconde se o aviso ainda for este (outro aviso, como o "Desfazer", pode ter tomado o lugar)
  toastTimer = setTimeout(() => {
    if (t.textContent === msg) t.hidden = true;
  }, 7000);
}
document.getElementById("toast").addEventListener("click", e => {
  e.currentTarget.hidden = true;
});
const spokenOrig = t => (GRC ? String(t).replace(/[^\p{L}\p{M}\s]/gu, "") : cleanHeb(t));
function speak(texts, btn, onEach, voice) {
  if (!tts.available) return toast(tts.unavailableText());
  if (btn && btn === curBtn) return stopSpeech();
  stopSpeech();
  const spoken = voice === "pt" ? String : spokenOrig;
  setBtn(btn);
  const warning = tts.speak(texts.map(spoken), {
    voice: voice || (GRC ? "el" : "he"),
    rate: prefs.slow ? 0.6 : 0.9,
    onEach,
    onEnd() {
      setBtn(null);
      markSpeaking(null);
    }
  });
  if (warning) toast(warning);
}
// Bíblia Livre em voz alta (modo Bíblia ou com o original desligado): versículo a versículo, em português.
function speakBlivre(from, btn, one) {
  const vs = CH.verses.slice(from, one ? from + 1 : undefined).filter(v => v.blivre);
  speak(
    vs.map(v => v.blivre),
    btn,
    i => markSpeaking(document.getElementById("v" + vs[i].n)),
    "pt"
  );
}
function speakVerse(vi, btn) {
  if (document.body.classList.contains("hide-orig")) return speakBlivre(vi, btn, true);
  const words = CH.verses[vi].words;
  if (!prefs.follow) return speak([words.map(w => w.heb).join(" ")], btn);
  speak(
    words.map(w => w.heb),
    btn,
    i => markSpeaking(wordEl(vi, i))
  );
}
document.getElementById("voice-install").addEventListener("click", () => {
  tts.openInstall().catch(() => toast(t("audio.install_failed")));
});

// ---------- Verbete ----------
function chapterCount(k) {
  return CH ? CH.verses.reduce((s, v) => s + v.words.filter(w => w.strong === k).length, 0) : 0;
}

// Verbete: LexiconEntry.svelte draws the entry of "current" (src/lib/lexicon/entry.ts works out what it shows)
function renderEntry() {
  const { k, word } = current;
  const at = word && active ? CH.verses[active.dataset.v] : null;
  const position = at ? t("entry.position", { i: +active.dataset.i + 1, n: at.words.length, ref: `${BOOK.name} ${vLabel(at)}` }) : "";
  const view = entryView(k, word, {
    lex: LEX,
    greek: GRC,
    cantillation: prefs.cant,
    position,
    inChapter: chapterCount(k),
    chapterRef: `${BOOK.name} ${CUR}`,
    concordance: !!window.__concordance
  });
  entryState.view = view;
  entryState.canPrev = !!(word && stepTarget(-1));
  entryState.canNext = !!(word && stepTarget(1));
  entryState.canGoBack = navStack.length > 0;
  flushSync();
}
// Palavra seguinte/anterior na ordem de leitura (passa para o versículo vizinho)
function stepTarget(dir) {
  if (!active || !CH) return null;
  let v = +active.dataset.v,
    i = +active.dataset.i + dir;
  while (v >= 0 && v < CH.verses.length) {
    const n = CH.verses[v].words.length;
    if (i >= 0 && i < n) return wordEl(v, i);
    v += dir;
    if (v < 0 || v >= CH.verses.length) return null;
    i = dir > 0 ? 0 : CH.verses[v].words.length - 1;
  }
  return null;
}
function openWord(b) {
  const w = CH.verses[b.dataset.v].words[b.dataset.i];
  if (active) active.classList.remove("active");
  active = b;
  b.classList.add("active");
  b.parentElement.querySelectorAll(".word").forEach(x => {
    x.tabIndex = -1;
  });
  b.tabIndex = 0;
  navStack = [];
  lastWord = b;
  show(w.strong, w, b);
}
async function show(k, word, opener) {
  if (opener) returnTo = opener;
  if (openSheet === "look" && SIDE.matches) closePanel(false);
  if (k && /^[HG]/.test(k)) await ensureLex(k[0] === "G" ? "G" : "H").catch(() => {});
  current = { k, word };
  renderEntry();
  entryState.open = true;
  flushSync();
  document.body.classList.add("com-detail");
  if (k) document.dispatchEvent(new CustomEvent("lexicon-entry-opened", { detail: { k } }));
  document.dispatchEvent(
    new CustomEvent("word-opened", { detail: { word: word && active ? { v: +active.dataset.v, i: +active.dataset.i } : null } })
  );
  detail.scrollTop = 0;
  document.getElementById("d-title").focus({ preventScroll: true });
  keepWordVisible();
}
// No celular o verbete é meia folha: se a palavra ficou atrás dela, rola o texto para a palavra aparecer acima
function keepWordVisible() {
  if (!active || matchMedia("(min-width: 1100px)").matches) return;
  const r = active.getBoundingClientRect(),
    sheetTop = detail.getBoundingClientRect().top;
  const barH = document.querySelector(".bar").getBoundingClientRect().bottom;
  if (r.bottom > sheetTop - 12 || r.top < barH) window.scrollBy({ top: r.top - barH - 16, behavior: "auto" });
}
function closeDetail() {
  stopSpeech();
  entryState.open = false;
  flushSync();
  document.body.classList.remove("com-detail");
  document.dispatchEvent(new CustomEvent("word-opened", { detail: { word: null } }));
  navStack = [];
  if (active) active.classList.remove("active");
  active = null;
  let back = returnTo;
  if (back && !back.isConnected && back.dataset && back.dataset.v) back = wordEl(back.dataset.v, back.dataset.i);
  returnTo = null;
  if (back && back.isConnected) back.focus({ preventScroll: false });
}
root.addEventListener("click", e => {
  const sb = e.target.closest(".say[data-verse]");
  if (sb) return speakVerse(+sb.dataset.verse, sb);
  const b = e.target.closest(".word");
  if (!b) return;
  openWord(b);
});
mount(LexiconEntry, {
  target: dbody,
  props: {
    onclose: () => closeDetail(),
    onstep(dir) {
      const to = stepTarget(dir);
      if (!to) return;
      openWord(to);
      document.getElementById(dir > 0 ? "d-next" : "d-prev")?.focus({ preventScroll: true });
    },
    onsay: (text, button) => speak([text], button),
    onconcordance: key => window.__concordance?.(key, current && current.word ? current.word : null),
    onback() {
      const prev = navStack.pop();
      show(prev.k, prev.word);
    },
    onref(key) {
      navStack.push(current);
      show(key, null);
    }
  }
});

// ---------- Painéis (índice / aparência) ----------
const scrim = document.getElementById("scrim");
const bbar = document.getElementById("bbar");
const sheets = { toc: document.getElementById("toc"), look: document.getElementById("look") };
// the buttons that open them are components (TocButton, LookButton) in the top or the bottom bar, by screen width
const opener = name => document.getElementById(name === "toc" ? "open-toc" : "open-look");
let openSheet = null;
function focusables(el) {
  return [...el.querySelectorAll('button:not([disabled]), a[href], input, summary, [tabindex]:not([tabindex="-1"])')].filter(
    x => x.offsetParent !== null
  );
}
// No computador (≥ 1100 px) a Aparência abre no painel ao lado do texto, como o Verbete e o Anotar
const SIDE = matchMedia("(min-width: 1100px)");
function openPanel(name, focusEl) {
  if (!detail.hidden) closeDetail();
  if (openSheet) closePanel(false);
  if (window.Annotations) window.Annotations.closeBar();
  openSheet = name;
  sheets[name].hidden = false;
  ui.sheet = name;
  flushSync();
  if (name === "look" && SIDE.matches) document.body.classList.add("com-look");
  else {
    scrim.hidden = false;
    page.inert = true;
    topBar.inert = true;
    detail.inert = true;
    document.body.style.overflow = "hidden";
  }
  if (name === "toc") {
    pickBook(BOOK.code, CUR);
  }
  const first = focusEl || (name === "toc" ? sheets.toc.querySelector(".vchip.here") : sheets.look.querySelector('[aria-pressed="true"]'));
  (first || focusables(sheets[name])[0]).focus({ preventScroll: true });
}
function closePanel(restore = true) {
  if (!openSheet) return;
  const name = openSheet;
  sheets[name].hidden = true;
  scrim.hidden = true;
  ui.sheet = null;
  flushSync();
  document.body.classList.remove("com-look");
  page.inert = false;
  topBar.inert = false;
  detail.inert = false;
  document.body.style.overflow = "";
  openSheet = null;
  if (restore) opener(name)?.focus({ preventScroll: true });
}
// "Livros" opens the index on the list of books (the title in the bar opens it on the chapters)
function openToc() {
  openPanel("toc");
  tocTab("livros");
  tocView("livros");
  showYouProgress();
}
const openLook = () => openPanel("look");
mount(TocButton, { target: topBar, anchor: topBar.firstChild, props: { place: "top", onopen: openToc } });
mount(WhereButton, { target: topBar, anchor: document.getElementById("bar-modes"), props: { onopen: () => openWhere() } });
mount(ModeSwapButton, { target: topBar, anchor: document.getElementById("open-search"), props: { onswap: id => applyMode(id) } });
mount(LookButton, { target: topBar, anchor: document.getElementById("open-account"), props: { place: "top", onopen: openLook } });
mount(ChapterNavButton, {
  target: topBar,
  anchor: document.getElementById("where"),
  props: { dir: -1, place: "top", ongo: d => goNeighbor(d) }
});
mount(ChapterNavButton, {
  target: topBar,
  anchor: document.getElementById("bar-modes"),
  props: { dir: 1, place: "top", ongo: d => goNeighbor(d) }
});
mount(SayButton, {
  target: topBar,
  anchor: document.getElementById("mode-swap"),
  props: { place: "top", onsay: b => speakFrom(hereIndex(), b) }
});
// bottom bar (phone): Livros · ‹ · Ouvir · › · Aa (Livros and Aa only on phones), appended in order
mount(TocButton, { target: bbar, props: { place: "bottom", onopen: openToc } });
mount(ChapterNavButton, { target: bbar, props: { dir: -1, place: "bottom", ongo: d => goNeighbor(d) } });
mount(SayButton, { target: bbar, props: { place: "bottom", onsay: b => speakFrom(hereIndex(), b) } });
mount(ChapterNavButton, { target: bbar, props: { dir: 1, place: "bottom", ongo: d => goNeighbor(d) } });
mount(LookButton, { target: bbar, props: { place: "bottom", onopen: openLook } });
scrim.addEventListener("click", () => closePanel());
Object.values(sheets).forEach(sh =>
  sh.addEventListener("click", e => {
    if (e.target.closest("[data-close]")) closePanel();
  })
);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (openSheet) {
      e.preventDefault();
      return closePanel();
    }
    if (!detail.hidden) {
      e.preventDefault();
      return closeDetail();
    }
  }
  if (e.key === "Tab" && openSheet) {
    const f = focusables(sheets[openSheet]);
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (!sheets[openSheet].contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }
});
document.getElementById("skip").addEventListener("click", e => {
  e.preventDefault();
  const w = firstWordOfVerse(0);
  root.scrollIntoView();
  focusWord(w);
});

// ---------- Índice: livros, capítulos, versículos ----------
let pickedBook = null,
  pickedCh = 1;
function renderTocVerses() {
  gotoState.versesOf = t("goto.verses_of", { ref: `${BOOK.name} ${CUR}` });
  gotoState.verses = CH.verses.map(v => ({ n: v.n, label: vLabel(v) }));
  markHereChip();
}
function pickBook(cod, ch) {
  pickedBook = BY_CODE[cod];
  pickedCh = ch || 1;
  toc.book = cod;
  toc.chapter = pickedCh;
  flushSync();
}
mount(BookList, {
  target: document.querySelector("#toc .toc-books"),
  props: {
    books: BOOKS,
    onpick(code) {
      pickBook(code, code === BOOK.code ? CUR : 1);
      tocView("capitulos");
    }
  }
});
mount(ChapterPicker, {
  target: document.querySelector("#toc .toc-chapters"),
  props: {
    books: BOOKS,
    available: hasChapter,
    onback: () => tocView("livros"),
    onopen: n => openChapter(pickedBook.code, n, null),
    onunavailable(n) {
      pickBook(pickedBook.code, n);
      toast(t("reader.not_in_preview"));
    }
  }
});

// "Ir para": the parser lives in src/lib/refs.ts; here it reads the chapter on screen
const refs = createRefs(BOOKS);
const parseRef = q => refs.parseRef(q, { book: BOOK, ch: CUR });
const resolveRef = r => refs.resolveRef(r, hasChapter);
// the field and its preview are GoTo.svelte; the preview is worked out by src/lib/goto.ts
mount(GoTo, {
  target: document.getElementById("toc-livros"),
  props: {
    oninput() {
      updatePreview();
      toc.filter = bookQuery(goIn.value);
      flushSync();
    },
    ongo() {
      if (goTarget) go(goTarget);
      else {
        updatePreview();
        goIn.focus();
      }
    }
  }
});
const goIn = document.getElementById("go-in");
let goTarget = null;
function updatePreview() {
  const res = resolveRef(parseRef(goIn.value));
  goTarget = res && res.ok ? res : null;
  if (res && !res.warn) {
    const n = res.ok ? res.ch : res.na.n;
    if (pickedBook !== res.book || pickedCh !== n) pickBook(res.book.code, n);
  }
  gotoState.preview = gotoPreview(res, CAPS);
  flushSync();
}
function go(target) {
  openChapter(target.book.code, target.ch, target.chapterStart ? null : target.v);
  goIn.value = "";
  updatePreview();
}

function scrollToVerse(n, smooth) {
  const target = document.getElementById("v" + n);
  if (!target) return;
  target.scrollIntoView({ behavior: smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto" });
  const vi = +target.dataset.vi;
  focusWord(wordEl(vi, 0), true);
  setHere(n);
}
// Aparência › Fontes e licenças: mostra o rodapé de fontes (escondido no dia a dia) e vai até ele
sheets.look.addEventListener("click", e => {
  if (!e.target.closest("#look-sources")) return;
  e.preventDefault();
  closePanel(false);
  const f = document.getElementById("fontes");
  f.classList.add("show");
  f.scrollIntoView({ behavior: "smooth" });
});
// Abas do índice (Livros · Neste livro · Você): pulam para a parte dentro da própria folha e marcam onde se está
const tocTabs = [...sheets.toc.querySelectorAll(".toc-tabs [data-tab]")];
function markTocTab() {
  if (sheets.toc.dataset.aba) return;
  const top = sheets.toc.getBoundingClientRect().top + 90;
  let cur = tocTabs[0];
  for (const t of tocTabs) {
    const sec = document.getElementById(t.getAttribute("href").slice(1));
    if (sec && sec.getBoundingClientRect().top <= top) cur = t;
  }
  if (sheets.toc.scrollTop + sheets.toc.clientHeight >= sheets.toc.scrollHeight - 4) cur = tocTabs[tocTabs.length - 1];
  tocTabs.forEach(t => (t === cur ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")));
}
sheets.toc.addEventListener("scroll", () => requestAnimationFrame(markTocTab), { passive: true });
sheets.toc.addEventListener("click", e => {
  const tab = e.target.closest("[data-tab]");
  if (tab) {
    e.preventDefault();
    const sec = document.getElementById(tab.getAttribute("href").slice(1));
    const bar = sheets.toc.querySelector(".toc-tabs");
    if (sec)
      sheets.toc.scrollTo({
        top: sec.offsetTop - bar.offsetHeight - 12,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    tocTabs.forEach(t => (t === tab ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")));
    return;
  }
  if (e.target.closest("#toc-search")) {
    e.preventDefault();
    closePanel(false);
    return window.__openSearch && window.__openSearch();
  }
});
sheets.toc.addEventListener("click", e => {
  const a = e.target.closest("[data-go]");
  if (!a) return;
  e.preventDefault();
  const id = a.getAttribute("href").slice(1);
  closePanel(false);
  const v = id.match(/^v(\d+)$/);
  if (v) return scrollToVerse(+v[1], true);
  const target = document.getElementById(id);
  if (!target) return;
  if (target.classList.contains("fontes")) target.classList.add("show");
  target.scrollIntoView({ behavior: "smooth" });
  if (target.tagName === "DETAILS") {
    target.open = true;
    target.querySelector("summary").focus({ preventScroll: true });
  } else {
    const h = target.querySelector("h2");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
  }
});

// Onde estou
function markHereChip() {
  gotoState.here = hereV;
}
function setHere(v) {
  hereV = v;
  readerState.here = { book: BOOK.name, chapter: CUR, verse: v, theme: BOOK.chapters[CUR - 1].t || "" };
  flushSync();
  markHereChip();
  try {
    history.replaceState(null, "", `#${BOOK.code}.${CUR}.${v}`);
  } catch (_) {}
  store.set("posicao", `${BOOK.code}.${CUR}.${v}`);
  if (window.__updateVpos) window.__updateVpos();
}
if ("IntersectionObserver" in window) {
  const visible = new Set();
  io = new IntersectionObserver(
    entries => {
      entries.forEach(en => {
        const n = +en.target.id.slice(1);
        if (en.isIntersecting) visible.add(n);
        else visible.delete(n);
      });
      if (visible.size) setHere(Math.min(...visible));
    },
    { rootMargin: "-80px 0px -60% 0px" }
  );
}

// ---------- Sobre o livro ----------
const fmtY = y => (y < 0 ? `${-y} a.C.` : `${y} d.C.`);
function fmtRange(a, b) {
  if (a === b) return "c. " + fmtY(a);
  if (a < 0 && b < 0) return `c. ${-a}–${-b} a.C.`;
  if (a > 0 && b > 0) return `c. ${a}–${b} d.C.`;
  return `c. ${fmtY(a)}–${fmtY(b)}`;
}
function niceStep(span) {
  for (const s of [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (span / s <= 6) return s;
  return 2000;
}
const aboutBox = document.getElementById("about-body"),
  aboutDet = document.getElementById("sobre");
function toggleAbout() {
  aboutDet.open = !aboutDet.open;
  if (aboutDet.open) aboutDet.scrollIntoView({ block: "nearest" });
}
function renderAbout() {
  const A = BOOK.about;
  document.getElementById("ab-title").innerHTML =
    `${esc(BOOK.name)}${A ? `<span class="orig" lang="${OLANG()}">${esc(A.title_orig)}</span>` : ""}`;
  if (!A) {
    aboutDet.hidden = true;
    return;
  }
  aboutDet.hidden = false;
  const chRef = (from, to) =>
    `<button class="chref" data-ch="${from}" aria-label="Ver ${to && to !== from ? `capítulos ${from} a ${to}` : `capítulo ${from}`} no índice">${to && to !== from ? `caps. ${from}–${to}` : `cap. ${from}`}</button>`;
  let tl = "";
  const E = A.events;
  if (E && E.timeline && E.timeline.length) {
    let [y0, y1] = E.axis || [Math.min(...E.timeline.map(t => t.from)), Math.max(...E.timeline.map(t => t.to))];
    if (y0 > y1) [y0, y1] = [y1, y0];
    const span = Math.max(1, y1 - y0);
    const x = y => (((y - y0) / span) * 100).toFixed(2) + "%";
    const w = (a, b) => Math.max(0.6, ((b - a) / span) * 100).toFixed(2) + "%";
    const step = niceStep(span),
      ticks = [];
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y);
    const mixed = y0 < 0 && y1 > 0;
    const tlab = y => (mixed ? fmtY(y) : String(Math.abs(y)));
    const rows = E.timeline
      .map(
        t => `
      <li class="tl-row">
        <span class="tl-lab"><b>${esc(t.label)}</b><small>${fmtRange(t.from, t.to)}</small></span>
        <span class="tl-track" aria-hidden="true"><span class="tl-bar ${esc(t.kind || "")}" style="left:${x(Math.min(t.from, t.to))};width:${w(Math.min(t.from, t.to), Math.max(t.from, t.to))}"></span></span>
        <span class="sr">${esc(t.note || "")}</span>
      </li>`
      )
      .join("");
    const band = E.band ? `<span class="tl-band" style="left:${x(E.band.from)};width:${w(E.band.from, E.band.to)}"></span>` : "";
    const kinds = new Set(E.timeline.map(t => t.kind));
    tl = `
      <div class="tl">
        <div class="tl-bg" aria-hidden="true">${band}${ticks.map(y => `<span class="tl-tick" style="left:${x(y)}"></span>`).join("")}</div>
        <ol class="tl-rows" aria-label="Linha do tempo, datas aproximadas">${rows}</ol>
        <div class="tl-axis" aria-hidden="true"><span class="tl-unit">${mixed ? "anos" : y1 <= 0 ? "anos a.C." : "anos d.C."}</span><span class="tl-labels">${ticks.map(y => `<span style="left:${x(y)}">${tlab(y)}</span>`).join("")}</span></div>
      </div>
      <p class="tl-legend">${kinds.has("pessoa") ? `<span><i class="k-person"></i>pessoas</span>` : ""}${kinds.has("evento") ? `<span><i class="k-event"></i>acontecimentos</span>` : ""}${kinds.has("escrita") ? `<span><i class="k-writing"></i>escrita do livro</span>` : ""}${E.band ? `<span><i class="k-band"></i>${esc(E.band.label)} (${fmtRange(E.band.from, E.band.to)})</span>` : ""}</p>`;
  }
  aboutBox.innerHTML = `
    <p class="ab-lead">${esc(A.summary)}</p>
    <dl class="ab-facts">${(A.facts || []).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${A.name ? `<section class="ab-sec"><h3>O nome</h3><p>${esc(A.name)}</p></section>` : ""}
    ${
      A.structure && A.structure.length
        ? `<section class="ab-sec"><h3>Como o livro se divide</h3>
      <div class="ab-grid four">${A.structure.map(p => `<div class="ab-card"><h4>${esc(p.title)}</h4><p>${esc(p.text)}</p>${p.from ? chRef(p.from, p.to) : ""}</div>`).join("")}</div></section>`
        : ""
    }
    ${A.extra ? `<section class="ab-sec"><h3>${esc(A.extra.title)}</h3><p>${esc(A.extra.text)}</p></section>` : ""}
    ${
      A.people && A.people.length
        ? `<section class="ab-sec"><h3>Pessoas principais</h3>
      <ul class="ab-people">${A.people
        .map(
          p => `<li><span class="pn">${esc(p.name)}</span>
        ${p.ch ? `<button class="chref" data-ch="${p.ch}" aria-label="${esc(p.name)}: ver capítulo ${p.ch} no índice">${BOOK.chapters.length > 1 ? "caps. " : "v. "}${esc(p.chapters || p.ch)}</button>` : ""}
        <span class="pnote">${esc(p.note)}</span></li>`
        )
        .join("")}</ul></section>`
        : ""
    }
    ${
      A.writing
        ? `<section class="ab-sec"><h3>Quando foi escrito</h3>
      <div class="ab-grid">
        <div class="ab-card"><h4>Segundo a tradição</h4><p>${esc(A.writing.tradition)}</p></div>
        <div class="ab-card alt"><h4>Segundo a pesquisa acadêmica</h4><p>${esc(A.writing.academic)}</p></div>
      </div></section>`
        : ""
    }
    ${E ? `<section class="ab-sec"><h3>Quando se passam os acontecimentos</h3><p>${esc(E.intro)}</p>${tl}</section>` : ""}
    ${
      A.context
        ? `<section class="ab-sec"><h3>Contexto histórico</h3><p>${esc(A.context)}</p>
      ${A.places && A.places.length ? `<div class="ab-chips" role="list" aria-label="Lugares">${A.places.map(l => `<span role="listitem">${esc(l)}</span>`).join("")}</div>` : ""}</section>`
        : ""
    }
    ${A.themes && A.themes.length ? `<section class="ab-sec"><h3>Temas</h3><div class="ab-chips" role="list">${A.themes.map(l => `<span role="listitem">${esc(l)}</span>`).join("")}</div></section>` : ""}
    ${
      A.key_verses && A.key_verses.length
        ? `<section class="ab-sec"><h3>Versículos-chave</h3>
      ${A.key_verses.map(k => `<blockquote class="ab-quote"><p>${esc(k.text)}</p><cite>${esc(BOOK.name)} ${esc(k.ref)} · BLIVRE</cite></blockquote>`).join("")}</section>`
        : ""
    }
    ${A.note ? `<p class="ab-note">${esc(A.note)}</p>` : ""}
    <p class="ab-note">Introdução escrita para este projeto; datas aproximadas e sujeitas a revisão.</p>`;
}
aboutDet.addEventListener("toggle", () => {
  store.set("sobre-aberto", aboutDet.open ? "on" : "off");
  readerState.aboutOpen = aboutDet.open;
});
if (store.get("sobre-aberto", "off") === "on") aboutDet.open = true;
aboutBox.addEventListener("click", e => {
  const b = e.target.closest(".chref");
  if (!b) return;
  openPanel("toc");
  pickBook(BOOK.code, +b.dataset.ch);
  const chip = document.querySelector(`.chchip[data-ch="${b.dataset.ch}"]`);
  if (chip) {
    chip.focus({ preventScroll: true });
    chip.scrollIntoView({ block: "center" });
  }
});

// ---------- Léxico do capítulo ----------
// "Léxico do capítulo" is ChapterLexicon.svelte (inside section#lexico)
mount(ChapterLexicon, {
  target: document.getElementById("lexico"),
  props: {
    onopen(key, row) {
      if (active) active.classList.remove("active");
      active = null;
      navStack = [];
      show(key, null, row);
    }
  }
});

// ---------- Abrir capítulo ----------
async function openChapter(cod, n, v) {
  const B = BY_CODE[cod];
  if (!B || !B.chapters[n - 1]) return;
  closePanel(false);
  if (!detail.hidden) closeDetail();
  stopSpeech();
  let raw;
  try {
    raw = await fetchChapter(cod, n);
  } catch (_) {
    return toast("Não foi possível carregar este capítulo. Verifique a conexão.");
  }
  if (!raw) return toast("Este capítulo não está incluído nesta prévia.");
  try {
    await ensureLex(B.nt ? "G" : "H");
  } catch (_) {
    toast("Não foi possível carregar o léxico.");
  }
  const bookChanged = B !== BOOK;
  BOOK = B;
  CUR = n;
  GRC = isGrc(B);
  CH = {
    verses: raw.v.map(x => ({
      n: x.n,
      blivre: x.b,
      nota: x.o,
      h: x.h || null,
      links: x.a || [],
      words: x.w.map(toWord),
      marks: (raw.m || []).filter(m => m[0] === x.n)
    })),
    questions: (raw.q || []).map(([kind, text, verses, strong]) => ({ kind, text, verses, strong }))
  };
  renderHeader();
  if (bookChanged) renderAbout();
  renderVerses();
  renderTocVerses();
  document.getElementById("toc-lexn").textContent = t("lexicon.toc_count", { count: chapterState.lexicon.length });
  const target = v !== null && v !== undefined && CH.verses.some(x => x.n === v) ? v : null;
  if (target !== null) scrollToVerse(target, false);
  else {
    window.scrollTo(0, 0);
    setHere(CH.verses[0].n);
  }
}

// ---------- Tema ----------
const THEMES = [
  { id: "claro", name: "Claro", dark: false, bg: "#f8f9f6", fg: "#1b2220", ac: "#1d5b74" },
  { id: "papel", name: "Papel", dark: false, bg: "#faf6ef", fg: "#2b241c", ac: "#7d4a2e" },
  { id: "oliva", name: "Oliva", dark: false, bg: "#f5f7f0", fg: "#1f241a", ac: "#4f6b2a" },
  { id: "escuro", name: "Escuro", dark: true, bg: "#1a201e", fg: "#e3e9e5", ac: "#7cc0d8" },
  { id: "noite", name: "Noite", dark: true, bg: "#152031", fg: "#e3e8f1", ac: "#e0b66a" },
  { id: "grafite", name: "Grafite", dark: true, bg: "#000000", fg: "#ececec", ac: "#a5c8ff" }
];
const tgrid = document.getElementById("tgrid");
tgrid.insertAdjacentHTML(
  "beforeend",
  THEMES.map(
    t => `
  <button class="tcard" data-p="${t.id}" aria-pressed="false" aria-label="Tema ${t.name}${t.dark ? ", escuro" : ", claro"}" style="--pb:${t.bg};--pf:${t.fg};--pa:${t.ac}">
    <span class="tprev" aria-hidden="true"><span class="ph" lang="he">אוֹר</span><span class="px">ʼôwr</span><span class="pg">luz</span></span><span aria-hidden="true">${t.name}</span>
  </button>`
  ).join("")
);
const sysDark = matchMedia("(prefers-color-scheme: dark)");
let palette = store.get("tema", "auto");
function isDarkNow() {
  return palette === "auto" ? sysDark.matches : THEMES.find(t => t.id === palette).dark;
}
function applyPalette(p) {
  palette = THEMES.some(t => t.id === p) ? p : "auto";
  if (palette === "auto") document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", palette);
  const t = THEMES.find(x => x.id === palette);
  if (t) {
    store.set(t.dark ? "tema-escuro" : "tema-claro", t.id);
  }
  store.set("tema", palette);
  tgrid.querySelectorAll(".tcard").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.p === palette)));
  document.documentElement.dataset.dark = String(isDarkNow());
}
applyPalette(palette);
sysDark.addEventListener?.("change", () => {
  if (palette === "auto") applyPalette("auto");
});
tgrid.addEventListener("click", e => {
  const b = e.target.closest(".tcard");
  if (b) applyPalette(b.dataset.p);
});

// ---------- Tamanho do texto ----------
const SIZES = [0.85, 1, 1.15, 1.3, 1.5, 1.75];
let sizeIdx = Math.max(0, SIZES.indexOf(+store.get("tamanho", "1")));
function applySize() {
  document.body.style.setProperty("--k", SIZES[sizeIdx]);
  document.getElementById("size-out").textContent = Math.round(SIZES[sizeIdx] * 100) + "%";
  document.getElementById("size-down").disabled = sizeIdx === 0;
  document.getElementById("size-up").disabled = sizeIdx === SIZES.length - 1;
  store.set("tamanho", String(SIZES[sizeIdx]));
}
applySize();
document.getElementById("size-down").addEventListener("click", () => {
  if (sizeIdx > 0) {
    sizeIdx--;
    applySize();
  }
});
document.getElementById("size-up").addEventListener("click", () => {
  if (sizeIdx < SIZES.length - 1) {
    sizeIdx++;
    applySize();
  }
});

// ---------- Interruptores ----------
const ON_CHANGE = {
  "t-cant": on => {
    prefs.cant = on;
    stopSpeech();
    const focused = document.activeElement && document.activeElement.closest ? document.activeElement.closest(".word") : null;
    const keep = active ? [active.dataset.v, active.dataset.i] : null;
    renderVerses();
    if (keep) {
      active = wordEl(...keep);
      if (active) active.classList.add("active");
    }
    if (focused) focusWord(wordEl(focused.dataset.v, focused.dataset.i));
    if (!detail.hidden && current) renderEntry();
  },
  "t-follow": on => {
    prefs.follow = on;
  },
  "t-slow": on => {
    prefs.slow = on;
  }
};
function applySwitch(t, on) {
  t.setAttribute("aria-checked", String(on));
  if (t.dataset.onClass) document.body.classList.toggle(t.dataset.onClass, on);
  if (t.dataset.offClass) document.body.classList.toggle(t.dataset.offClass, !on);
}
document.querySelectorAll(".chk[data-key]").forEach(t => {
  const on = store.get(t.dataset.key, t.dataset.default) === "on";
  applySwitch(t, on);
  t.addEventListener("click", () => {
    const now = t.getAttribute("aria-checked") !== "true";
    applySwitch(t, now);
    store.set(t.dataset.key, now ? "on" : "off");
    if (ON_CHANGE[t.id]) ON_CHANGE[t.id](now);
  });
});

// ---------- Anotações (annotations.js) ----------
window.__carregarCapitulo = (cod, n) => fetchChapter(cod, n);
window.__chapter = () => CH;
window.__resolveRef = q => resolveRef(parseRef(q));
window.__books = Object.fromEntries(
  BOOKS.map((b, i) => [b.code, { name: b.name, abbrev: b.abbrev, i, nt: !!b.nt, group: b.group, chapterCount: b.chapters.length }])
);
document.addEventListener("annotations:goto", e => {
  const d = e.detail;
  openChapter(d.book, d.chapter, d.verse);
});
document.addEventListener("annotations:speak", e => speakVerse(e.detail.vi, e.detail.btn));
document.addEventListener("annotations:open-panel", () => {
  if (openSheet) closePanel(false);
  if (!detail.hidden) closeDetail();
});
document.getElementById("open-progress").addEventListener("click", e => {
  e.preventDefault();
  closePanel(false);
  if (window.Progress) window.Progress.open();
});
document.getElementById("open-mine").addEventListener("click", e => {
  e.preventDefault();
  closePanel(false);
  if (window.Annotations) window.Annotations.openList();
  else toast("As anotações não estão disponíveis nesta página.");
});

// ---------- Modos de leitura ----------
// Cada modo é um conjunto de valores para os interruptores marcados com data-modo. Mudar um deles à mão
// vira "Personalizado" (a partir do modo de origem). O modo vale para todos os aparelhos quando houver conta.
const MODES = MODE_IDS.map(getMode);
// the selectors (top bar and Aparência) and the note under them are Svelte components that follow readerState
mount(ModeSelector, { target: document.getElementById("mode-grid"), props: { variant: "card", onselect: id => applyMode(id) } });
mount(ModeSelector, { target: document.getElementById("bar-modes"), props: { variant: "bar", onselect: id => applyMode(id) } });
mount(ModeNote, { target: document.getElementById("mode-note") });
let modo = store.get("modo", "");
let baseMode = store.get("modo-base", "interlinear");
let previousMode = store.get("modo-anterior", "");
function eyebrowText() {
  const c = document.body.classList;
  return eyebrowFor({ original: !c.contains("hide-orig"), running: c.contains("orig-running"), greek: !!GRC });
}
function setSwitch(id, on) {
  const t = document.getElementById(id);
  if (!t || (t.getAttribute("aria-checked") === "true") === !!on) return;
  applySwitch(t, !!on);
  store.set(t.dataset.key, on ? "on" : "off");
  if (ON_CHANGE[t.id]) ON_CHANGE[t.id](!!on);
}
function showModo() {
  const currentChapter = modo || "interlinear";
  readerState.mode = isModeId(currentChapter) ? currentChapter : "interlinear";
  readerState.baseMode = isModeId(baseMode) ? baseMode : "interlinear";
  flushSync();
  readerState.previousMode = isModeId(previousMode) ? previousMode : "";
  if (CH) readerState.eyebrow = eyebrowText();
  flushSync();
}
function applyMode(id, manual = true) {
  const m = MODES.find(x => x.id === id);
  if (!m) return;
  if (manual && modo && modo !== id && modo !== "personalizado") {
    previousMode = modo;
    store.set("modo-anterior", modo);
  }
  if (id !== "personalizado") {
    for (const [k, on] of Object.entries(m.switches)) setSwitch(k, on);
    baseMode = id;
    store.set("modo-base", id);
  }
  modo = id;
  store.set("modo", id);
  if (manual) document.dispatchEvent(new CustomEvent("preferences-changed"));
  document.getElementById("welcome").hidden = true;
  document.querySelectorAll(".verse.abrir").forEach(v => v.classList.remove("abrir"));
  showModo();
}
// Mudou um item à mão: vira Personalizado
document.querySelectorAll(".chk[data-modo]").forEach(t =>
  t.addEventListener("click", () => {
    if (modo !== "personalizado") {
      if (modo) {
        baseMode = modo;
        store.set("modo-base", modo);
      }
      modo = "personalizado";
      store.set("modo", modo);
    }
    showModo();
    document.dispatchEvent(new CustomEvent("preferences-changed"));
  })
);
// Preferências de leitura para a sincronização (web/sync.js): o modo e os itens visíveis
window.__preferencias = {
  readStorage() {
    const sw = {};
    document.querySelectorAll(".chk[data-modo]").forEach(t => {
      sw[t.id] = t.getAttribute("aria-checked") === "true";
    });
    return { modo: modo || "interlinear", modo_base: baseMode, listItems: sw };
  },
  applyChanges(p) {
    if (!p || (!MODES.some(m => m.id === p.modo) && p.modo !== "personalizado")) return;
    for (const [k, on] of Object.entries(p.listItems || {})) setSwitch(k, !!on);
    if (p.modo_base && MODES.some(m => m.id === p.modo_base)) {
      baseMode = p.modo_base;
      store.set("modo-base", baseMode);
    }
    modo = p.modo;
    store.set("modo", modo);
    document.getElementById("welcome").hidden = true;
    showModo();
  }
};
// Primeira abertura: pergunta como a pessoa quer ler (quem já usava fica no Interlinear, como antes)
const welcome = document.getElementById("welcome");
if (!modo && store.get("posicao", "") === "") welcome.hidden = false;
welcome.addEventListener("click", e => {
  const b = e.target.closest("button[data-modo]");
  if (!b) return;
  welcome.hidden = true;
  if (b.dataset.modo) applyMode(b.dataset.modo, false);
  else {
    modo = "interlinear";
    store.set("modo", modo);
    showModo();
  }
});
showModo();
// Ouvir o capítulo (Bíblia Livre) e abrir as outras camadas de um versículo
document.getElementById("ch-say").addEventListener("click", e => speakBlivre(0, e.currentTarget));
function openVerse(sec) {
  if (!sec || !document.body.classList.contains("hide-orig")) return;
  sec.classList.toggle("abrir");
}
root.addEventListener("click", e => {
  const n = e.target.closest(".vnum");
  if (n) openVerse(n.closest(".verse"));
});
// Toque longo no versículo abre a barra de marcação (annotations.js), que tem o botão "Interlinear".

// ---------- Barras: capítulo anterior/próximo, Ouvir a partir daqui, atalhos e progresso no capítulo ----------
function goNeighbor(dir) {
  const x = neighbor(dir);
  if (x) openChapter(x.b.code, x.n, null);
}
function hereIndex() {
  const i = CH ? CH.verses.findIndex(v => v.n === hereV) : -1;
  return i < 0 ? 0 : i;
}
// Lê do versículo que está na tela até o fim do capítulo: o original palavra por palavra (realçando cada uma) ou,
// com o original escondido, a Bíblia Livre. Tocar de novo para.
function speakFrom(vi, btn) {
  if (document.body.classList.contains("hide-orig")) return speakBlivre(vi, btn);
  const vs = CH.verses.slice(vi).filter(v => v.words.length);
  if (!vs.length) return speakBlivre(vi, btn);
  if (!prefs.follow)
    return speak(
      vs.map(v => v.words.map(w => w.heb).join(" ")),
      btn,
      i => markSpeaking(document.getElementById("v" + vs[i].n))
    );
  const seq = [];
  for (const v of vs) {
    const k = CH.verses.indexOf(v);
    v.words.forEach((w, i) => seq.push([k, i, w.heb]));
  }
  speak(
    seq.map(s => s[2]),
    btn,
    i => markSpeaking(wordEl(seq[i][0], seq[i][1]))
  );
}
// Atalhos do cabeçalho (Léxico, Perguntas): rolam até a seção sem mudar o endereço da página
function goLocal(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const h = target.querySelector("h2");
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
}
// Teclado (fora de campos de texto e painéis): [ e ] trocam de capítulo; / abre a busca
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || openSheet || document.body.classList.contains("com-busca")) return;
  if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
  if (e.key === "[" || e.key === "]") {
    e.preventDefault();
    goNeighbor(e.key === "]" ? 1 : -1);
  } else if (e.key === "/" && window.__openSearch) {
    e.preventDefault();
    window.__openSearch();
  }
});
// Barra fina de progresso: quanto do capítulo já passou pela tela
const readbar = document.getElementById("readbar");
let readbarFrame = 0;
function updateReadbar() {
  readbarFrame = 0;
  const max = document.documentElement.scrollHeight - innerHeight;
  readbar.style.width = (max > 0 ? Math.min(100, (scrollY / max) * 100) : 0).toFixed(1) + "%";
}
addEventListener(
  "scroll",
  () => {
    if (!readbarFrame) readbarFrame = requestAnimationFrame(updateReadbar);
  },
  { passive: true }
);
document.addEventListener("chapter-rendered", () => requestAnimationFrame(updateReadbar));

// ---------- Início: endereço (#JHN.3.16), última posição ou o primeiro capítulo disponível ----------
(function start() {
  const parse = s => {
    const m = /^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?$/.exec(s || "");
    return m && BY_CODE[m[1]] && hasChapter(m[1], +m[2]) ? [m[1], +m[2], m[3] !== undefined ? +m[3] : null] : null;
  };
  const first = Object.keys(CAPS)[0] ? Object.keys(CAPS)[0].split(".") : ["GEN", "1"];
  const pos = parse(decodeURIComponent(location.hash.slice(1))) || parse(store.get("posicao", "")) || [first[0], +first[1], null];
  pickBook(pos[0], pos[1]);
  openChapter(pos[0], pos[1], pos[2]);
})();
window.addEventListener("hashchange", () => {
  const m = /^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?$/.exec(decodeURIComponent(location.hash.slice(1)));
  if (m && (m[1] !== BOOK.code || +m[2] !== CUR)) openChapter(m[1], +m[2], m[3] !== undefined ? +m[3] : null);
});

// ---------- App nativo: botão "voltar" do Android ----------
const AppPlugin = nativePlugin("App");
if (AppPlugin && PLATFORM === "android") {
  AppPlugin.addListener("backButton", () => {
    if (openSheet) return closePanel();
    if (!detail.hidden) return closeDetail();
    AppPlugin.exitApp();
  });
}
// ---------- Versão web instalável: offline com service worker ----------
if ("serviceWorker" in navigator && !NATIVE && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]')) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- Redesenho, parte final ----------
// Phone: the bottom bar has five buttons (Livros and Aparência join it)
{
  const phone = matchMedia("(max-width: 720px)");
  const five = () => bbar.classList.toggle("cinco", phone.matches);
  five();
  phone.addEventListener("change", five);
}
// Tocar no título do capítulo abre o índice já na grade de capítulos do livro
function openWhere() {
  openPanel("toc", goIn);
  tocView("capitulos");
  requestAnimationFrame(() => {
    const here = document.querySelector('#chgrid .chchip[aria-pressed="true"]');
    if (here) here.focus({ preventScroll: true });
  });
}
// Capítulos longos: "v. 60 de 176" e, quando há seções (Salmo 119), ‹ › passam de seção
{
  const pos = document.createElement("div");
  pos.className = "vpos";
  pos.id = "vpos";
  pos.hidden = true;
  pos.innerHTML = `<button type="button" id="sec-prev" aria-label="Seção anterior">‹</button><span id="vpos-t"></span><button type="button" id="sec-next" aria-label="Próxima seção">›</button>`;
  document.querySelector(".bar").appendChild(pos);
  const heads = () => (CH ? CH.verses.filter(v => v.h) : []);
  function updateVpos() {
    const long = CH && CH.verses.length >= 40;
    pos.hidden = !long || window.scrollY < 300;
    if (pos.hidden) return;
    const hs = heads();
    const cur = hs.filter(v => v.n <= hereV).pop();
    document.getElementById("vpos-t").textContent = `${cur ? cur.h + " · " : ""}v. ${hereV} de ${CH.verses[CH.verses.length - 1].n}`;
    const arrows = hs.length > 1;
    document.getElementById("sec-prev").hidden = !arrows;
    document.getElementById("sec-next").hidden = !arrows;
    if (arrows) {
      document.getElementById("sec-prev").disabled = !hs.some(v => v.n < (cur ? cur.n : hereV));
      document.getElementById("sec-next").disabled = !hs.some(v => v.n > hereV);
    }
  }
  pos.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const hs = heads();
    const cur = hs.filter(v => v.n <= hereV).pop();
    const to = b.id === "sec-next" ? hs.find(v => v.n > hereV) : [...hs].reverse().find(v => v.n < (cur ? cur.n : hereV));
    if (to) document.getElementById("s" + to.n)?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  window.__updateVpos = updateVpos;
  window.addEventListener("scroll", () => requestAnimationFrame(updateVpos), { passive: true });
  document.addEventListener("chapter-rendered", () => requestAnimationFrame(updateVpos));
}
// Aparência: os chips mostram a explicação ao passar o dedo/mouse
document.querySelectorAll(".chks.chips .chk").forEach(c => {
  const s = c.querySelector("small");
  if (s && !c.title) c.title = s.textContent;
});
// Capítulos muito longos (Salmo 119): o navegador só desenha os versículos perto da tela
document.addEventListener("chapter-rendered", () => document.body.classList.toggle("cap-longo", !!CH && CH.verses.length >= 100));

// Computador: abas Verbete · Anotar · Aparência no topo do painel ao lado do texto
{
  const tabs = document.createElement("nav");
  tabs.id = "ptabs";
  tabs.className = "ptabs";
  tabs.setAttribute("aria-label", "Painel ao lado do texto");
  tabs.innerHTML = `<button type="button" data-ptab="verbete">Verbete</button><button type="button" data-ptab="anotar">Anotar</button><button type="button" data-ptab="aparencia">Aparência</button>`;
  document.body.appendChild(tabs);
  const mark = () => {
    const b = document.body.classList;
    const cur = b.contains("com-detail") ? "verbete" : b.contains("com-mbar") ? "anotar" : b.contains("com-look") ? "aparencia" : "";
    tabs.querySelectorAll("[data-ptab]").forEach(t => t.setAttribute("aria-pressed", String(t.dataset.ptab === cur)));
  };
  new MutationObserver(mark).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  tabs.addEventListener("click", e => {
    const t = e.target.closest("[data-ptab]");
    if (!t || t.getAttribute("aria-pressed") === "true") return;
    if (t.dataset.ptab === "aparencia") return openPanel("look");
    if (t.dataset.ptab === "anotar") {
      if (openSheet) closePanel(false);
      if (!detail.hidden) closeDetail();
      return window.Annotations && window.Annotations.openVerse(hereV);
    }
    if (lastWord && lastWord.isConnected) return openWord(lastWord);
    const first = firstWordOfVerse(
      Math.max(
        0,
        CH.verses.findIndex(v => v.n === hereV)
      )
    );
    if (first) openWord(first);
  });
}

// Modo de foco (Aparência › Leitura): rolar para baixo esconde as barras; rolar para cima ou abrir um painel as traz de volta
{
  const b = document.body.classList;
  let lastY = scrollY;
  window.addEventListener(
    "scroll",
    () => {
      const y = scrollY,
        dy = y - lastY;
      if (Math.abs(dy) < 8) return;
      lastY = y;
      b.toggle("barras-fora", b.contains("foco") && dy > 0 && y > 200 && !openSheet && detail.hidden && !b.contains("com-mbar"));
    },
    { passive: true }
  );
  new MutationObserver(() => {
    if (b.contains("barras-fora") && (b.contains("com-detail") || b.contains("com-mbar") || b.contains("com-look")))
      b.remove("barras-fora");
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

// Dicas de primeiro uso: cada uma aparece uma vez só, quando faz sentido, e some sozinha
{
  const TECLADO = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const DICAS = {
    palavra: "Dica: toque numa palavra do original para ver o significado e como a Bíblia Livre a traduz.",
    versiculo: "Dica: toque no ⋯ ao lado do número (ou segure o versículo) para marcar, anotar, ouvir ou compartilhar.",
    verbete: `Dica: ‹ › no verbete passam para a palavra vizinha${TECLADO ? " (← → no teclado)" : ""}, sem fechar.`
  };
  const vista = id => store.get("dica-" + id, "") === "vista";
  const marcar = id => store.set("dica-" + id, "vista");
  const dica = id => {
    const t = document.getElementById("toast");
    if (vista(id) || (!t.hidden && !t.classList.contains("dica"))) return false; // não atropela um aviso
    marcar(id);
    toast(DICAS[id]);
    t.classList.add("dica");
    return true;
  };
  document.addEventListener("chapter-rendered", () =>
    setTimeout(() => {
      if (openSheet || !detail.hidden || document.body.classList.contains("com-mbar")) return;
      if (document.querySelector("#verses .word") && dica("palavra")) return;
      if (vista("palavra") || !document.querySelector("#verses .word")) dica("versiculo");
    }, 1200)
  );
  document.addEventListener("word-opened", e => {
    if (!e.detail.word) return; // verbete aberto pelo léxico, sem palavra no texto
    marcar("palavra");
    dica("verbete");
  });
  new MutationObserver(() => {
    if (document.body.classList.contains("com-mbar")) marcar("versiculo");
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

// Barra do computador, como no design: "Notas · N" abre Minhas anotações; o ícone da conta abre "Você" no índice
{
  mount(NotesButton, {
    target: topBar,
    anchor: document.getElementById("bar-prev"),
    props: {
      onopen() {
        if (openSheet) closePanel(false);
        if (window.Annotations) window.Annotations.openList();
      }
    }
  });
  mount(NotesCount, { target: document.getElementById("tab-notas-n") });
  window.addEventListener("load", () => {
    if (window.Annotations) followAnnotations(window.Annotations);
  });
  document.getElementById("open-account").addEventListener("click", () => {
    openPanel("toc");
    requestAnimationFrame(() => sheets.toc.querySelector('.toc-tabs [href="#toc-voce"]').click());
  });
}

// Índice como no design: abas de verdade (Livros · Notas · Você); em Livros, a lista de livros por testamento
// ou, depois de tocar num livro, a grade de capítulos com o título de cada um
function tocView(v) {
  sheets.toc.dataset.ver = v;
  if (v === "livros") {
    const nt = pickedBook ? (pickedBook.nt ? "1" : "0") : "0";
    setTesta(nt);
  }
  sheets.toc.scrollTop = 0;
}
function setTesta(nt) {
  toc.testament = nt;
  flushSync();
}
function tocTab(aba) {
  sheets.toc.dataset.aba = aba;
  tocTabs.forEach(t =>
    t.getAttribute("href") === "#toc-" + aba ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")
  );
  sheets.toc.scrollTop = 0;
}
sheets.toc.addEventListener(
  "click",
  e => {
    const tab = e.target.closest(".toc-tabs [data-tab]");
    if (!tab) return;
    e.preventDefault();
    e.stopPropagation();
    const aba = tab.getAttribute("href").slice(5);
    // Notas: a lista de Minhas anotações (a mesma do botão "Notas" da barra do computador)
    if (aba === "notas") {
      closePanel(false);
      if (window.Annotations) window.Annotations.openList();
      return;
    }
    tocTab(aba);
  },
  true
);
tocTab("livros");
tocView("livros");
// o ✕ do índice fica na linha das abas, como no design
{
  const x = sheets.toc.querySelector(".shead [data-close]");
  if (x) {
    x.classList.add("toc-x");
    sheets.toc.prepend(x);
  }
}
// Minhas anotações vira a aba Notas do índice: as mesmas abas no topo, a busca com o ⋯ ao lado
window.addEventListener("load", () => {
  const ms = document.getElementById("minhas");
  if (!ms) return;
  const tabs = sheets.toc.querySelector(".toc-tabs").cloneNode(true);
  tabs.querySelectorAll("[id]").forEach(x => x.removeAttribute("id"));
  tabs.className = "mn-tabs";
  tabs
    .querySelectorAll("[data-tab]")
    .forEach(t => (t.getAttribute("href") === "#toc-notas" ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")));
  ms.prepend(tabs);
  const x = ms.querySelector(".shead [data-fechar]");
  if (x) {
    x.classList.add("toc-x");
    ms.prepend(x);
  }
  tabs.addEventListener("click", e => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    e.preventDefault();
    const aba = t.getAttribute("href").slice(5);
    if (aba === "notas") return;
    ms.querySelector("[data-fechar]").click();
    openPanel("toc");
    tocTab(aba);
    tocView("livros");
  });
  const row = ms.querySelector(".mn-searchrow"),
    more = ms.querySelector("#mn-more");
  if (row && more) row.append(more);
  const count = document.getElementById("tab-notas-n");
  new MutationObserver(() => (tabs.querySelector('[href="#toc-notas"]').textContent = "Notas" + count.textContent)).observe(count, {
    childList: true,
    characterData: true,
    subtree: true
  });
});
// Você: os planos de leitura pedem a conta (sem ela, um aviso); com ela, abrem o progresso, onde o plano começa
document.querySelectorAll("[data-vc-plano]").forEach(b =>
  b.addEventListener("click", () => {
    if (!window.Account || ["signed-out", "unavailable"].includes(window.Account.status()))
      return toast("Entre com a conta para seguir um plano.");
    closePanel(false);
    if (window.Progress) window.Progress.open();
  })
);
// Você: the progress card says it needs the account
function showYouProgress() {
  const on = window.Account && !["signed-out", "unavailable"].includes(window.Account.status());
  document.getElementById("vc-prog").textContent = t(on ? "you.progress" : "you.progress_signed_out");
}
// Mini player do celular, como no design: "Lendo João 3:16 · grego" acima da barra de baixo, com pausa;
// enquanto toca, o Ouvir da barra vira "Pausar"
{
  mount(MiniPlayer, { target: document.body, props: { onstop: () => stopSpeech() } });
  document.addEventListener("speech-state", e => {
    const on = e.detail.on;
    speechState.on = on;
    document.body.classList.toggle("tocando", on);
    const sec = e.detail.el && e.detail.el.closest(".verse");
    if (on && sec && CH) {
      const v = CH.verses[+sec.dataset.vi];
      const lang = t(document.body.classList.contains("hide-orig") ? "audio.language.pt" : GRC ? "audio.language.el" : "audio.language.he");
      speechState.label = t("audio.reading", { ref: `${BOOK.name} ${v ? vLabel(v) : CUR}`, lang });
    }
    flushSync();
  });
}
