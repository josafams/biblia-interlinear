/* Leitor da Bíblia Interlinear (ler.html): índice, capítulos, verbetes, áudio, aparência e modos de leitura.
 * ES module bundled by src/reader/main.ts; the books list (DATA) is inlined in ler.html before it
 * (see vite/site/reader-page.ts). Pure helpers live in src/lib. */
import { decodeMorph, shortMorph } from "../src/lib/morph";
import { createBible, toWord } from "../src/lib/data/bible";
import { MODE_IDS, MODE_MENU, eyebrowText as eyebrowFor, getMode, isModeId, modeHint, swapLabel } from "../src/lib/modes";
import { createRefs } from "../src/lib/refs";
import { store } from "../src/lib/store";
import { cleanHeb, esc, glossHTML, glossSpoken, norm } from "../src/lib/text";
const SPK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
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
function hebShown(t) {
  return GRC || prefs.cant ? t : cleanHeb(t);
}
function origHTML(parts) {
  parts = parts.map(hebShown);
  if (parts.length < 2) return esc(parts[0]);
  let core = 0;
  parts.forEach((p, i) => {
    if (p.length > parts[core].length) core = i;
  });
  return parts.map((p, i) => (i === core ? esc(p) : `<span class="pre">${esc(p)}</span>`)).join("");
}
const GF_NOTE = {
  l: "glosa pela tradução mais comum (sem alinhamento direto)",
  r: "glosa por regra gramatical",
  p: "glosa parcial",
  s: "sem glosa",
  m: "glosa revisada"
};
function wordLabel(w) {
  const e = LEX[w.strong];
  const bits = [glossSpoken(w.gloss)];
  if (e && e.x) bits.push(`${e.x}, pronúncia ${e.p || ""}`);
  bits.push(w.strong && !w.strong.startsWith("G:") ? `Strong ${w.strong}` : "sem número Strong");
  if (w.gf && GF_NOTE[w.gf] && w.gf !== "m") bits.push(GF_NOTE[w.gf]);
  return bits.join(". ");
}
const OLANG = () => (GRC ? "grc" : "he");

// ---------- Cabeçalho, versículos ----------
const root = document.getElementById("verses");
let io = null;
function vLabel(v) {
  return v.n === 0 ? "título" : `${CUR}:${v.n}`;
}
function renderHeader() {
  const A = BOOK.about;
  document.title = `${BOOK.name} ${CUR} · Bíblia Interlinear`;
  document.getElementById("eyebrow").textContent = eyebrowText();
  document.getElementById("h1").innerHTML =
    `${esc(BOOK.name)} ${CUR}${A ? ` <span class="orig" lang="${OLANG()}">${esc(A.title_orig)}</span>` : ""}`;
  const theme = BOOK.chapters[CUR - 1] && BOOK.chapters[CUR - 1].t;
  document.getElementById("ctheme").textContent = theme || "";
  document.getElementById("lede").textContent = GRC
    ? "Lê-se da esquerda para a direita. Cada palavra grega abre o verbete; abaixo de cada versículo vem a Bíblia Livre."
    : "Lê-se da direita para a esquerda. Cada palavra hebraica abre o verbete; abaixo de cada versículo vem a Bíblia Livre.";
  document.body.classList.toggle("grc", GRC);
  document.getElementById("verses").setAttribute("aria-label", `Texto de ${BOOK.name} ${CUR}`);
  // atalhos do cabeçalho e rótulos de capítulo anterior/próximo (barra de cima no computador, de baixo no celular)
  const nq = CH ? CH.questions.length : 0,
    chipQ = document.getElementById("chip-q");
  chipQ.hidden = !nq;
  chipQ.innerHTML = `Perguntas <span class="n">${nq}</span>`;
  for (const id of ["bar-prev", "bar-next", "bb-prev", "bb-next"]) {
    const b = document.getElementById(id),
      x = neighbor(+b.dataset.dir);
    const label = x ? `${b.dataset.dir < 0 ? "Capítulo anterior" : "Próximo capítulo"}: ${x.b.name} ${x.n}` : "";
    b.setAttribute("aria-label", label || (b.dataset.dir < 0 ? "Este é o primeiro capítulo" : "Este é o último capítulo"));
    b.setAttribute("aria-disabled", String(!x));
    b.title = label;
    const t = b.querySelector(".bb-t");
    if (t) t.textContent = x ? `${x.b.abbrev} ${x.n}` : "";
  }
}
const SOURCE_NOTES = {
  aparato:
    "No SBLGNT este trecho está só no aparato crítico (o texto principal termina Romanos em 16:24); aqui aparece a leitura de Westcott-Hort, Tregelles e Nestle-Aland 28.",
  "sem-original": "Este versículo não tem correspondente no texto original usado aqui (aparece em outras edições).",
  "sem-blivre": "A BLIVRE não tem este versículo separado; o texto está no versículo vizinho."
};
// Revisão automática: o texto em português vem primeiro; o código da regra fica num canto, para quem revisa os dados
function marksHTML(v) {
  if (!v.marks.length) return "";
  const list = v.marks
    .map(
      m =>
        `<li><span>${m[1] !== null && v.words[m[1]] ? `<span class="mk-w" lang="${OLANG()}">${esc(hebShown(v.words[m[1]].heb))}</span>: ` : ""}${esc(m[4])}</span><span class="mk-c">detalhe técnico: ${esc(m[3])}</span></li>`
    )
    .join("");
  const n = v.marks.length;
  return `<details class="marks"><summary>⚑ ${n === 1 ? "1 ponto" : `${n} pontos`} da revisão automática</summary><ul>${list}</ul></details>`;
}
// Cartões de um versículo
function wordsHTML(v, vi, lang = OLANG()) {
  const flagged = new Set(v.marks.filter(m => m[1] !== null).map(m => m[1]));
  return v.words
    .map((w, i) => {
      const e = LEX[w.strong] || {};
      const aux = w.gf && w.gf !== "m" ? " aux" : "";
      return `
      <button class="word${flagged.has(i) ? " flag" : ""}${w.ketiv ? " kt" : ""}" data-v="${vi}" data-i="${i}" tabindex="${i === 0 ? 0 : -1}" aria-label="${esc(wordLabel(w))}">
        <span class="h" lang="${lang}" aria-hidden="true">${origHTML(w.parts)}</span>
        ${e.x ? `<span class="x" aria-hidden="true">${esc(e.x)}</span>` : ""}
        ${e.p ? `<span class="p" aria-hidden="true">${esc(e.p)}</span>` : ""}
        <span class="s" aria-hidden="true">${w.strong && !w.strong.startsWith("G:") ? esc(w.strong) : "—"}</span>
        <span class="m" aria-hidden="true" title="${esc(decodeMorph(w.morph, GRC))}">${esc(shortMorph(decodeMorph(w.morph, GRC)))}</span>
        <span class="g${aux}" aria-hidden="true">${glossHTML(w.gloss)}</span>
      </button>`;
    })
    .join("");
}
// Capítulos muito longos (Salmo 119): os cartões só são montados quando o versículo chega perto da tela
const LAZY_FROM = 100;
let lazyIO = null;
function fillWords(box) {
  if (!box || !box.dataset.lazy) return;
  const vi = +box.closest(".verse").dataset.vi;
  box.innerHTML = wordsHTML(CH.verses[vi], vi);
  delete box.dataset.lazy;
  box.style.minHeight = "";
  if (lazyIO) lazyIO.unobserve(box);
  document.dispatchEvent(new CustomEvent("words-filled", { detail: { vi } }));
}
function renderVerses() {
  const lang = OLANG();
  const lazy = CH.verses.length >= LAZY_FROM && "IntersectionObserver" in window;
  root.innerHTML =
    CH.verses
      .map((v, vi) => {
        const later = lazy && vi > 4;
        const words = later ? "" : wordsHTML(v, vi, lang);
        const lbl = vLabel(v);
        const head = v.h
          ? `<h2 class="sechead acro" id="s${v.n}"><span>${esc(v.h)}</span><span class="sref">v. ${v.n}–${v.n + 7}</span></h2>`
          : "";
        return `${head}
    <section class="verse" id="v${v.n}" data-vi="${vi}" aria-labelledby="vh${v.n}">
      <div class="vhead">
        <h3 class="vnum${v.marks.length ? " has-rev" : ""}" id="vh${v.n}"><span class="sr">Versículo </span>${lbl.includes(":") ? `<span class="vcap">${esc(lbl.split(":")[0])}:</span>${esc(lbl.split(":")[1])}` : lbl}${v.marks.length ? `<span class="sr"> (com pontos da revisão automática)</span>` : ""}</h3>
        <span class="vtags"></span>
        <button class="vmark" data-verse="${vi}" aria-label="Anotar ou ouvir ${lbl}"><svg class="vm-dots" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M3.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M10.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0M17.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0"/></svg><svg class="vm-pen" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg><span class="vm-t" aria-hidden="true">Anotar</span></button>
      </div>
      ${v.words.length ? `<div class="words" role="group" aria-label="Palavras do versículo ${lbl}${GRC ? "" : ", da direita para a esquerda"}"${later ? ` data-lazy="1" style="min-height:${Math.ceil(v.words.length / 5) * 74}px"` : ""}>${words}</div>` : ""}
      ${v.nota ? `<p class="vnote">${esc(SOURCE_NOTES[v.nota] || v.nota)}</p>` : ""}
      <p class="blivre"><span class="tag">BLIVRE</span>${esc(v.blivre)}</p>
      <div class="vann" hidden></div>
      ${marksHTML(v)}
    </section>`;
      })
      .join("") +
    questionsHTML() +
    chapterNav();
  if (io) document.querySelectorAll(".verse").forEach(sec => io.observe(sec));
  if (lazyIO) lazyIO.disconnect();
  lazyIO = null;
  if (lazy) {
    lazyIO = new IntersectionObserver(es => es.forEach(en => en.isIntersecting && fillWords(en.target)), { rootMargin: "1500px 0px" });
    root.querySelectorAll(".words[data-lazy]").forEach(b => lazyIO.observe(b));
  }
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
const QUESTION_KINDS = {
  observation: "Observe",
  interpretation: "Interprete",
  original: "No original",
  application: "Aplique"
};
function questionsHTML() {
  if (!CH.questions.length) return "";
  const items = CH.questions
    .map((q, i) => {
      const [a, b] = (q.verses || "").split("-").map(Number);
      const label = a ? (b ? `v. ${a}–${b}` : `v. ${a}`) : "";
      const e = q.strong ? LEX[q.strong] : null;
      return `<li class="q q-${q.kind}">
        <span class="q-k">${QUESTION_KINDS[q.kind] || ""}</span>
        <p class="q-t">${esc(q.text)}</p>
        <div class="q-acts">
          ${a ? `<button type="button" class="q-ref" data-v="${a}" aria-label="Ir para o versículo ${a}">${label}</button>` : ""}
          ${q.strong ? `<button type="button" class="q-word" data-strong="${esc(q.strong)}" aria-label="Abrir o verbete ${esc(q.strong)}">${e && e.l ? `<span lang="${GRC ? "grc" : "he"}">${esc(e.l)}</span> ` : ""}${esc(q.strong)}</button>` : ""}
          <button type="button" class="q-note" data-q="${i}">Anotar resposta</button>
        </div>
      </li>`;
    })
    .join("");
  return `<section class="qsec" id="perguntas" aria-labelledby="q-h">
    <h2 id="q-h">Perguntas ao texto</h2>
    <p class="lede">Para pensar sozinho ou conversar em grupo. As respostas ficam com você — se quiser, guarde a sua numa nota.</p>
    <ol class="qlist">${items}</ol>
  </section>`;
}
document.getElementById("verses").addEventListener("click", e => {
  const ref = e.target.closest(".q-ref");
  if (ref) return scrollToVerse(+ref.dataset.v, true);
  const word = e.target.closest(".q-word");
  if (word) {
    if (active) active.classList.remove("active");
    active = null;
    navStack = [];
    return show(word.dataset.strong, null, word);
  }
  const note = e.target.closest(".q-note");
  if (note && window.Annotations?.noteForQuestion) {
    const q = CH.questions[+note.dataset.q];
    const first = +(q.verses || "").split("-")[0] || CH.verses[0]?.n || 1;
    window.Annotations.noteForQuestion(BOOK.code, CUR, first, q.text);
  }
});
function chapterNav() {
  const btn = (dir, cls, arrow) => {
    const x = neighbor(dir);
    if (!x) return "<span></span>";
    const ok = hasChapter(x.b.code, x.n);
    return `<button class="cnav ${cls}${ok ? "" : " na"}" data-cod="${x.b.code}" data-ch="${x.n}" ${ok ? "" : 'aria-disabled="true"'}>${dir < 0 ? arrow + " " : ""}${esc(x.b.name)} ${x.n}<small>${esc(x.b.chapters[x.n - 1].t || "")}</small></button>`;
  };
  return `<nav class="chnav" aria-label="Capítulo anterior e próximo">${btn(-1, "prev", "←")}${btn(1, "next", "→")}</nav>`;
}
// o cartão do próximo capítulo fica depois do léxico (fora de #verses), por isso o clique é ouvido no documento
document.addEventListener("click", e => {
  const c = e.target.closest(".cnav");
  if (c) {
    if (c.classList.contains("na")) return toast("Este capítulo não está incluído nesta prévia.");
    return openChapter(c.dataset.cod, +c.dataset.ch, null);
  }
});

function wordEl(vi, i) {
  fillWords(root.querySelector(`.verse[data-vi="${vi}"] .words[data-lazy]`));
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
// No app (Android/iOS, Capacitor) usa o motor de voz do sistema; no navegador, a Web Speech API.
const CAP = window.Capacitor;
const NATIVE = !!(CAP && typeof CAP.isNativePlatform === "function" && CAP.isNativePlatform());
const PLATFORM = NATIVE && typeof CAP.getPlatform === "function" ? CAP.getPlatform() : "web";
// No app, a página inicial e os vídeos ficam no site (abrem no navegador do aparelho).
const SITE = "https://josafams.github.io/biblia-interlinear/";
if (NATIVE)
  document.querySelectorAll("a.site-link").forEach(a => {
    a.href = SITE + a.getAttribute("href");
    a.target = "_blank";
    a.rel = "noopener";
  });
function capPlugin(name) {
  if (!NATIVE) return null;
  return (CAP.Plugins && CAP.Plugins[name]) || (typeof CAP.registerPlugin === "function" ? CAP.registerPlugin(name) : null);
}
const NativeTTS = capPlugin("TextToSpeech");
const WEB_TTS = !NATIVE && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
const TTS = !!NativeTTS || WEB_TTS;
const NO_TTS_MSG =
  "Este navegador não tem leitura de voz (acontece, por exemplo, dentro de alguns apps no Android). Abra a página no Chrome, Safari ou Edge para ouvir.";
const SYS = PLATFORM === "ios" ? "do iPhone" : "do Android";
const VOICES = {
  he: { name: "hebraico", codes: ["he-IL", "iw-IL", "he"], re: /^(he|iw)([-_]|$)/i, voice: null, lang: "he-IL", ok: null },
  el: { name: "grego", codes: ["el-GR", "el"], re: /^el([-_]|$)/i, voice: null, lang: "el-GR", ok: null },
  pt: { name: "português", codes: ["pt-BR", "pt"], re: /^pt([-_]|$)/i, voice: null, lang: "pt-BR", ok: null }
};
const curVoice = () => VOICES[GRC ? "el" : "he"];
let curToken = null,
  curBtn = null,
  speakingEl = null,
  toastTimer = 0;

function updateVoiceNote(vs) {
  const note = document.getElementById("voice-note"),
    inst = document.getElementById("voice-install");
  const lines = Object.values(VOICES)
    .map(V => {
      if (NativeTTS)
        return V.ok === null
          ? `Verificando a voz em ${V.name}…`
          : V.ok
            ? `Voz em ${V.name} ${SYS}: instalada.`
            : `Voz em ${V.name}: não instalada ${SYS}.`;
      if (!WEB_TTS) return null;
      return V.voice
        ? `Voz em ${V.name}: ${V.voice.name}.`
        : vs && vs.length
          ? `Nenhuma voz em ${V.name} neste aparelho.`
          : `Procurando voz em ${V.name}…`;
    })
    .filter(Boolean);
  note.textContent = !TTS
    ? NO_TTS_MSG
    : lines.join(" ") +
      " A pronúncia é a da língua moderna (hebraico israelense; grego moderno), não a reconstrução antiga. Para instalar vozes, use as configurações de texto para fala do sistema" +
      (PLATFORM === "ios" ? " (Ajustes › Acessibilidade › Conteúdo Falado › Vozes)." : ".");
  inst.hidden = !(NativeTTS && PLATFORM === "android" && Object.values(VOICES).some(V => V.ok === false));
}
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  for (const V of Object.values(VOICES))
    V.voice = vs.find(v => V.re.test(v.lang) && v.localService) || vs.find(v => V.re.test(v.lang)) || null;
  updateVoiceNote(vs);
}
async function checkNativeVoice() {
  for (const V of Object.values(VOICES)) {
    V.ok = false;
    for (const lang of V.codes) {
      try {
        const r = await NativeTTS.isLanguageSupported({ lang });
        if (r && r.supported) {
          V.lang = lang;
          V.ok = true;
          break;
        }
      } catch (_) {}
    }
  }
  updateVoiceNote();
}
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
  curToken = null;
  setBtn(null);
  markSpeaking(null);
  if (NativeTTS) NativeTTS.stop().catch(() => {});
  else if (WEB_TTS) speechSynthesis.cancel();
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
  if (!TTS) return toast(NO_TTS_MSG);
  if (btn && btn === curBtn) return stopSpeech();
  stopSpeech();
  const V = voice ? VOICES[voice] : curVoice(),
    token = {};
  const spoken = voice === "pt" ? t => String(t) : spokenOrig;
  curToken = token;
  setBtn(btn);
  const finish = () => {
    if (curToken === token) {
      curToken = null;
      setBtn(null);
      markSpeaking(null);
    }
  };
  const rate = prefs.slow ? 0.6 : 0.9;
  if (NativeTTS) {
    (async () => {
      for (let i = 0; i < texts.length; i++) {
        if (curToken !== token) return;
        if (onEach) onEach(i);
        try {
          await NativeTTS.speak({ text: spoken(texts[i]), lang: V.lang, rate, pitch: 1.0, volume: 1.0, category: "playback" });
        } catch (_) {
          break;
        }
      }
      finish();
    })();
    if (V.ok === false) toast(`Não há voz em ${V.name} instalada ${SYS}. Veja em Aparência › Áudio.`);
    return;
  }
  texts.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(spoken(t));
    u.lang = V.voice ? V.voice.lang : V.lang;
    if (V.voice) u.voice = V.voice;
    u.rate = rate;
    u.onstart = () => {
      if (curToken === token && onEach) onEach(i);
    };
    u.onend = u.onerror = () => {
      if (i === texts.length - 1) finish();
    };
    speechSynthesis.speak(u);
  });
  if (!V.voice) toast(`Este aparelho pode não ter voz em ${V.name}. Veja em Aparência › Áudio.`);
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
  if (NativeTTS && typeof NativeTTS.openInstall === "function")
    NativeTTS.openInstall().catch(() => toast("Não foi possível abrir as configurações de voz."));
});
if (NativeTTS) {
  updateVoiceNote();
  checkNativeVoice();
} else if (WEB_TTS) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
} else updateVoiceNote();

// ---------- Verbete ----------
const BLB = k =>
  /^[HG]\d+$/.test(k) ? `https://www.blueletterbible.org/lexicon/${k.toLowerCase()}/kjv/${k[0] === "H" ? "wlc" : "tr"}/0-1/` : null;
function linkRefs(text) {
  return esc(text).replace(/\b([HG])(\d+)\b/g, m => {
    const e = LEX[m];
    if (!e) return m;
    return `<button class="ref" data-ref="${m}" aria-label="Abrir verbete ${m}, ${esc(e.x)}">${m}<span class="rh" lang="${m[0] === "H" ? "he" : "grc"}">${esc(e.l)}</span>${esc(e.x)}</button>`;
  });
}
const PRON_LEGEND = `<p class="plegend">Pronúncia aproximada: sílaba tônica em MAIÚSCULAS; <b>rr</b> como em “carro”; <b>h</b> sempre aspirado; <b>ch</b> como em “chave”; <b>th</b> como no inglês “think”.</p>`;
function chapterCount(k) {
  return CH ? CH.verses.reduce((s, v) => s + v.words.filter(w => w.strong === k).length, 0) : 0;
}

// Verbete: a palavra no texto e o significado primeiro; origem, número Strong e legenda da pronúncia no fim.
const ARROW_L =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
const ARROW_R =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
function translationsHTML(t) {
  const parts = String(t || "")
    .split(";")
    .map(s => s.trim().match(/^(.*?)\s*\((\d+)\)$/))
    .filter(Boolean)
    .slice(0, 8);
  return parts.map(m => `<span>${esc(m[1])}<small>${m[2]}</small></span>`).join("");
}
function entryTopHTML(lang, lemma, xlit, pron, word) {
  const pos =
    word && active
      ? `palavra ${+active.dataset.i + 1} de ${CH.verses[active.dataset.v].words.length} · ${BOOK.name} ${vLabel(CH.verses[active.dataset.v])}`
      : "";
  const nav = (dir, label) =>
    word
      ? `<button class="dnav" id="${dir < 0 ? "d-prev" : "d-next"}" aria-label="${label}"${stepTarget(dir) ? "" : " disabled"}>${dir < 0 === GRC ? ARROW_L : ARROW_R}</button>`
      : "";
  const title = word ? hebShown(word.heb) : lemma;
  const say = word ? word.heb : lemma;
  return `
    <div class="dtop">
      ${nav(GRC ? -1 : 1, GRC ? "Palavra anterior" : "Próxima palavra (à esquerda)")}
      <div class="dtitle">
        <h2 class="dh${lang === "grc" ? " grc" : ""}" id="d-title" tabindex="-1" lang="${lang}">${esc(title)}</h2>
        ${pos ? `<span class="dpos">${esc(pos)}</span>` : ""}
      </div>
      ${nav(GRC ? 1 : -1, GRC ? "Próxima palavra" : "Palavra anterior (à direita)")}
      <button class="dclose" id="d-close" aria-label="Fechar verbete">✕</button>
    </div>
    <div class="dlem"><span class="dlem-t"><span class="dl${lang === "grc" ? " grc" : ""}" lang="${lang}">${esc(lemma)}</span>${xlit ? ` · <em>${esc(xlit)}</em>` : ""}${pron ? ` · <span class="pron">${esc(pron)}</span>` : ""}</span><button class="say" data-say="${esc(say)}">${SPK}<span>Ouvir</span></button></div>`;
}
function wordContextHTML(word) {
  if (!word) return "";
  const objNote = /\[obj\]/.test(word.gloss || "")
    ? `<small class="gfn">Marca o objeto direto; não tem tradução em português.</small>`
    : "";
  const gfNote = word.gf && GF_NOTE[word.gf] ? `<small class="gfn">${esc(GF_NOTE[word.gf])}</small>` : "";
  const ketiv = word.ketiv
    ? `<p class="kq">Leitura indicada à margem (<i>qere</i>). No texto consonantal está escrito (<i>ketiv</i>): <span lang="he">${esc(word.ketiv)}</span></p>`
    : "";
  return `
    <div class="dctx">
      <div class="dk">Neste versículo</div>
      <div class="cg">${glossHTML(word.gloss)} <span class="sr">(${esc(glossSpoken(word.gloss))})</span>${gfNote}${objNote}</div>
      <div class="dmeta">${esc(decodeMorph(word.morph, GRC))}</div>
      ${ketiv}
    </div>`;
}
function entryBodyHTML(k, e) {
  const strongLabel = k && !k.startsWith("G:") ? (/^H[a-z]$/.test(k) ? "partícula hebraica" : "Strong " + k) : "sem verbete Strong";
  const originHtml = e.o
    ? `<p>${linkRefs(e.o)}</p>`
    : e.oe
      ? `<p class="en" lang="en">${linkRefs(e.oe)} <em lang="pt-BR">(inglês, sem tradução)</em></p>`
      : "";
  const sig = e.s
    ? `<p>${esc(e.s)}</p>`
    : `<p class="en" lang="en">${esc(e.se || e.ge || "")} <em lang="pt-BR">(inglês, sem tradução)</em></p>`;
  const nc = chapterCount(k);
  const uses = `${strongLabel} · ${e.n} ${e.n === 1 ? "ocorrência" : "ocorrências"} na Bíblia${nc ? ` · ${nc} em ${BOOK.name} ${CUR}` : ""}`;
  const blb = BLB(k);
  const conc =
    window.__concordance && k && e.n > 1 ? `<button class="dconc" id="d-conc" data-key="${esc(k)}">Ver as ${e.n} ocorrências</button>` : "";
  return `
    <div class="dsec dmean"><h3>Significado</h3>${sig}</div>
    ${e.t ? `<div class="dsec"><h3>Como a BLIVRE traduz</h3><div class="dtr">${translationsHTML(e.t)}</div><p class="plegend">Contagem pelo alinhamento automático com a Bíblia Livre.</p></div>` : ""}
    ${conc}
    ${originHtml ? `<div class="dsec"><h3>Origem</h3>${originHtml}</div>` : ""}
    <div class="dfoot"><span>${esc(uses)}${blb ? ` · <a href="${blb}" target="_blank" rel="noopener">verbete em inglês<span class="sr"> (abre em nova aba)</span></a>` : ""}</span></div>
    <div class="dsec">${PRON_LEGEND}</div>`;
}
function entryHTML(k, word) {
  const e = LEX[k];
  const lang = k && k[0] === "G" ? "grc" : "he";
  const lemma = e ? e.l : (word && word.lemma) || "";
  const top = entryTopHTML(lang, lemma, e ? e.x : "", e ? e.p : "", word);
  const back = navStack.length ? `<button class="dback" id="d-back">← voltar ao verbete anterior</button>` : "";
  const ctx = wordContextHTML(word, lemma);
  if (!e) return top + back + ctx + `<div class="dsec"><p>Sem verbete no dicionário de Strong.</p>${PRON_LEGEND}</div>`;
  return top + back + ctx + entryBodyHTML(k, e);
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
  const e = LEX[k];
  detail.setAttribute("aria-label", `Verbete ${k && !k.startsWith("G:") ? k : ""} ${e ? e.x : ""}`.replace(/\s+/g, " ").trim());
  dbody.innerHTML = entryHTML(k, word);
  detail.hidden = false;
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
  detail.hidden = true;
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
detail.addEventListener("click", e => {
  const sb = e.target.closest(".say");
  if (sb) return speak([sb.dataset.say], sb);
  if (e.target.closest("#d-close")) return closeDetail();
  const step = e.target.closest("#d-prev, #d-next");
  if (step) {
    const to = stepTarget(step.id === "d-next" ? 1 : -1);
    if (to) {
      openWord(to);
      document.getElementById(step.id)?.focus({ preventScroll: true });
    }
    return;
  }
  const cc = e.target.closest("#d-conc");
  if (cc && window.__concordance) return window.__concordance(cc.dataset.key, current && current.word ? current.word : null);
  if (e.target.closest("#d-back")) {
    const prev = navStack.pop();
    return show(prev.k, prev.word);
  }
  const r = e.target.closest(".ref");
  if (r) {
    navStack.push(current);
    show(r.dataset.ref, null);
  }
});

// ---------- Painéis (índice / aparência) ----------
const scrim = document.getElementById("scrim");
const sheets = { toc: document.getElementById("toc"), look: document.getElementById("look") };
const openers = { toc: document.getElementById("open-toc"), look: document.getElementById("open-look") };
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
  openers[name].setAttribute("aria-expanded", "true");
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
  openers[name].setAttribute("aria-expanded", "false");
  document.body.classList.remove("com-look");
  page.inert = false;
  topBar.inert = false;
  detail.inert = false;
  document.body.style.overflow = "";
  openSheet = null;
  if (restore) openers[name].focus({ preventScroll: true });
}
openers.toc.addEventListener("click", () => openPanel("toc"));
openers.look.addEventListener("click", () => openPanel("look"));
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
function renderBooks() {
  const groups = [];
  for (const b of BOOKS) {
    let g = groups[groups.length - 1];
    if (!g || g.name !== b.group) groups.push((g = { name: b.group, nt: b.nt, books: [] }));
    g.books.push(b);
  }
  const part = nt =>
    groups
      .filter(g => g.nt === nt)
      .map(
        g => `
    <div class="bgroup" data-nt="${g.nt ? 1 : 0}"><h4>${esc(g.name)}</h4><div class="bgrid">${g.books.map(b => `<button class="bchip" data-cod="${b.code}" aria-pressed="${b.code === pickedBook.code}" aria-label="${esc(b.name)}"><span class="bn">${esc(b.name)}</span><span class="ba" aria-hidden="true">${b.chapters.length} cap.</span></button>`).join("")}</div></div>`
      )
      .join("");
  document.getElementById("bk-list").innerHTML = `
    ${part(false)}${part(true)}`;
}
function renderChapters() {
  const B = pickedBook;
  document.getElementById("ch-h").textContent = B.name;
  // embaixo da grade, a lista com o título de cada capítulo
  document.getElementById("ch-list").innerHTML = B.chapters
    .map(
      c =>
        `<button type="button" class="ch-row${c.n === pickedCh ? " here" : ""}" data-ch="${c.n}"${hasChapter(B.code, c.n) ? "" : ' aria-disabled="true"'}><span class="cr-n">${c.n}</span><span class="cr-t">${esc(c.t || "")}</span></button>`
    )
    .join("");
  document.getElementById("chgrid").innerHTML = B.chapters
    .map(c => {
      const ok = hasChapter(B.code, c.n);
      return `<button class="chchip${ok ? "" : " na"}" data-ch="${c.n}" aria-pressed="${c.n === pickedCh}" title="${c.t ? esc(c.t) : ""}" aria-label="Abrir capítulo ${c.n}${c.t ? ": " + esc(c.t) : ""}${ok ? "" : ". Não incluído nesta prévia"}">${c.n}</button>`;
    })
    .join("");
  const c = B.chapters[pickedCh - 1],
    ok = hasChapter(B.code, c.n),
    here = B === BOOK && c.n === CUR;
  document.getElementById("chcard").innerHTML = `
    <span class="ct">${esc(B.name)} ${c.n}${c.t ? " · " + esc(c.t) : ""}</span>
    <span class="cm">${here ? "você está aqui · " : ""}${c.v} versículos${ok ? "" : " · não incluído nesta prévia"}</span>`;
}
function renderTocVerses() {
  document.getElementById("toc-vh").textContent = `Versículos de ${BOOK.name} ${CUR}`;
  const chip = v =>
    `<a class="vchip" role="listitem" href="#v${v.n}" data-go data-v="${v.n}" aria-label="Versículo ${vLabel(v)}">${v.n === 0 ? "tít." : v.n}</a>`;
  document.getElementById("toc-days").innerHTML =
    `<div class="vgrid" role="list" aria-labelledby="toc-vh">${CH.verses.map(chip).join("")}</div>`;
  markHereChip();
}
function pickBook(cod, ch) {
  pickedBook = BY_CODE[cod];
  pickedCh = ch || 1;
  renderBooks();
  renderChapters();
}
document.getElementById("bk-list").addEventListener("click", e => {
  const b = e.target.closest(".bchip");
  if (!b) return;
  pickBook(b.dataset.cod, b.dataset.cod === BOOK.code ? CUR : 1);
  tocView("capitulos");
});
document.getElementById("chgrid").addEventListener("click", e => {
  const b = e.target.closest(".chchip");
  if (!b) return;
  if (b.classList.contains("na")) {
    pickedCh = +b.dataset.ch;
    renderChapters();
    return toast("Este capítulo não está incluído nesta prévia.");
  }
  openChapter(pickedBook.code, +b.dataset.ch, null);
});
document.getElementById("chcard").addEventListener("click", e => {
  const b = e.target.closest("[data-open]");
  if (b) {
    const [cod, n] = b.dataset.open.split(".");
    openChapter(cod, +n, null);
  }
});

// "Ir para": the parser lives in src/lib/refs.ts; here it reads the chapter on screen
const refs = createRefs(BOOKS);
const parseRef = q => refs.parseRef(q, { book: BOOK, ch: CUR });
const resolveRef = r => refs.resolveRef(r, hasChapter);
const goIn = document.getElementById("go-in"),
  goPrev = document.getElementById("go-prev");
let goTarget = null;
function updatePreview() {
  const res = resolveRef(parseRef(goIn.value));
  goTarget = res && res.ok ? res : null;
  if (!res) {
    goPrev.hidden = true;
    goPrev.innerHTML = "";
    return;
  }
  goPrev.hidden = false;
  goPrev.classList.toggle("warn", !res.ok);
  if (res.warn) {
    goPrev.innerHTML = `<p class="gp-note">${res.warn}</p>`;
    return;
  }
  const B = res.book,
    c = B.chapters[(res.ok ? res.ch : res.na.n) - 1];
  if (pickedBook !== B || pickedCh !== c.n) pickBook(B.code, c.n);
  if (res.na) {
    goPrev.innerHTML = `<div class="gp-ref">${esc(B.name)} ${c.n}${res.v ? ":" + res.v : ""}${c.t ? `<span class="gp-ct"> · ${esc(c.t)}</span>` : ""}</div><p class="gp-note">Este capítulo não está incluído nesta prévia.</p>`;
    return;
  }
  const ref = res.chapterStart ? `${B.name} ${c.n}` : `${B.name} ${c.n}:${res.v}`;
  const cached = CAPS[B.code + "." + c.n];
  const vv = cached && !res.chapterStart ? cached.v.find(x => x.n === res.v) : null;
  goPrev.innerHTML = `<div class="gp-ref">${esc(ref)}</div>${c.t ? `<div class="gp-theme">${esc(c.t)}</div>` : ""}${vv ? `<p class="gp-snip">${esc(vv.b)}</p>` : ""}
    <button type="button" class="gp-go" id="gp-go">Ir para ${esc(res.chapterStart ? `${B.name} ${c.n}` : `${B.abbrev} ${c.n}:${res.v}`)} →</button>`;
}
function go(t) {
  openChapter(t.book.code, t.ch, t.chapterStart ? null : t.v);
  goIn.value = "";
  updatePreview();
}
goIn.addEventListener("input", updatePreview);
document.getElementById("go-form").addEventListener("submit", e => {
  e.preventDefault();
  if (goTarget) go(goTarget);
  else {
    updatePreview();
    goIn.focus();
  }
});
goPrev.addEventListener("click", e => {
  if (e.target.closest("#gp-go") && goTarget) go(goTarget);
});

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
const where = document.getElementById("where");
function markHereChip() {
  document.querySelectorAll(".vchip").forEach(c => {
    const here = +c.dataset.v === hereV;
    c.classList.toggle("here", here);
    if (here) c.setAttribute("aria-current", "location");
    else c.removeAttribute("aria-current");
  });
}
function setHere(v) {
  hereV = v;
  const ref = v === 0 ? `${CUR}, título` : `${CUR}:${v}`;
  const theme = BOOK.chapters[CUR - 1].t;
  document.getElementById("where-t").innerHTML =
    `<b>${esc(BOOK.name)} ${CUR}</b>${theme ? `<span class="wt-sub">${esc(theme)}</span>` : ""}`;
  where.setAttribute(
    "aria-label",
    `Você está em ${BOOK.name} ${ref}${theme ? ", " + theme : ""}. Abrir o índice para ir a outro livro, capítulo ou versículo.`
  );
  markHereChip();
  try {
    history.replaceState(null, "", `#${BOOK.code}.${CUR}.${v}`);
  } catch (_) {}
  store.set("posicao", `${BOOK.code}.${CUR}.${v}`);
  if (window.__updateVpos) window.__updateVpos();
}
where.addEventListener("click", () => {
  openPanel("toc", goIn);
});
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
  aboutDet = document.getElementById("sobre"),
  aboutChip = document.getElementById("chip-about");
aboutChip.addEventListener("click", () => {
  aboutDet.open = !aboutDet.open;
  if (aboutDet.open) aboutDet.scrollIntoView({ block: "nearest" });
});
function renderAbout() {
  const A = BOOK.about;
  document.getElementById("ab-title").innerHTML =
    `${esc(BOOK.name)}${A ? `<span class="orig" lang="${OLANG()}">${esc(A.title_orig)}</span>` : ""}`;
  // "Sobre João": um chip ao lado de Léxico e Perguntas, como no design; o texto abre embaixo
  aboutChip.textContent = `Sobre ${BOOK.name}`;
  aboutChip.hidden = !A;
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
  aboutChip.setAttribute("aria-expanded", String(aboutDet.open));
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
const llist = document.getElementById("llist");
let lexKeys = [];
function shortMeaning(e) {
  return ((e.s || e.ge || e.se || "").split(/[;(]/)[0] || "").trim();
}
function renderLex(q) {
  const nq = norm(q).trim();
  const counts = {};
  CH.verses.forEach(v =>
    v.words.forEach(w => {
      if (w.strong) counts[w.strong] = (counts[w.strong] || 0) + 1;
    })
  );
  lexKeys = Object.keys(counts)
    .filter(k => LEX[k])
    .sort((a, b) => (parseInt(a.slice(1)) || 1e9) - (parseInt(b.slice(1)) || 1e9));
  const rows = lexKeys.filter(k => {
    if (!nq) return true;
    const e = LEX[k];
    return (
      norm(k) === nq ||
      norm(k) === "h" + nq ||
      norm(k) === "g" + nq ||
      norm(e.x).includes(nq) ||
      norm(e.l).includes(nq) ||
      norm(e.p).includes(nq) ||
      norm(e.s).includes(nq) ||
      norm(e.t).includes(nq)
    );
  });
  llist.innerHTML = rows.length
    ? rows
        .map(k => {
          const e = LEX[k],
            lang = k[0] === "G" ? "grc" : "he";
          return `<button class="lrow" data-ref="${esc(k)}" aria-label="${k.startsWith("G:") ? "" : "Strong " + esc(k) + ", "}${esc(e.x)}, pronúncia ${esc(e.p)}: ${esc(shortMeaning(e))}. ${counts[k]} ${counts[k] === 1 ? "ocorrência" : "ocorrências"} no capítulo."><span class="ln" aria-hidden="true">${k.startsWith("G:") ? "—" : esc(k)}</span><span class="lh${lang === "grc" ? " grc" : ""}" lang="${lang}" aria-hidden="true">${esc(e.l)}</span><span class="lx" aria-hidden="true">${esc(e.x)}</span><span class="ls" aria-hidden="true">${esc(shortMeaning(e))} · ${counts[k]}×</span></button>`;
        })
        .join("")
    : `<p class="lempty">Nenhum verbete encontrado.</p>`;
  document.getElementById("lex-count").textContent = nq
    ? `${rows.length} ${rows.length === 1 ? "verbete encontrado" : "verbetes encontrados"}`
    : "";
  document.getElementById("lex-d").textContent =
    `Os ${lexKeys.length} lemas de ${BOOK.name} ${CUR}, em ordem Strong. Toque num verbete para abrir.`;
  document.getElementById("toc-lexn").textContent = lexKeys.length + " verbetes";
}
document.getElementById("lsearch").addEventListener("input", e => renderLex(e.target.value));
llist.addEventListener("click", e => {
  const r = e.target.closest(".lrow");
  if (!r) return;
  if (active) active.classList.remove("active");
  active = null;
  navStack = [];
  show(r.dataset.ref, null, r);
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
  renderLex(document.getElementById("lsearch").value);
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
    if (!detail.hidden && current) dbody.innerHTML = entryHTML(current.k, current.word);
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
const modeGrid = document.getElementById("mode-grid"),
  modeNote = document.getElementById("mode-note"),
  modeSwap = document.getElementById("mode-swap");
modeGrid.innerHTML = MODE_MENU.map(id => MODES.find(m => m.id === id))
  .map(m => `<button class="mcard" role="radio" aria-checked="false" data-modo="${m.id}" title="${m.description}">${m.name}</button>`)
  .join("");
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
const barModes = document.getElementById("bar-modes");
barModes.innerHTML = MODE_MENU.map(id => MODES.find(m => m.id === id))
  .map(m => `<button class="bmode" role="radio" aria-checked="false" data-modo="${m.id}" title="${m.description}">${m.name}</button>`)
  .join("");
barModes.addEventListener("click", e => {
  const b = e.target.closest(".bmode");
  if (b) applyMode(b.dataset.modo);
});
function showModo() {
  const currentChapter = modo || "interlinear";
  barModes.querySelectorAll(".bmode").forEach(b => b.setAttribute("aria-checked", String(b.dataset.modo === currentChapter)));
  modeGrid.querySelectorAll(".mcard").forEach(b => b.setAttribute("aria-checked", String(b.dataset.modo === currentChapter)));
  modeNote.textContent = isModeId(currentChapter) ? modeHint(currentChapter, baseMode) : "";
  const other = MODES.find(m => m.id === previousMode && m.id !== currentChapter);
  modeSwap.hidden = !other;
  if (other) {
    modeSwap.innerHTML = `⇄<span class="ms-t"> ${esc(other.spoken)}</span>`;
    modeSwap.setAttribute("aria-label", swapLabel(other));
  }
  if (CH) document.getElementById("eyebrow").textContent = eyebrowText();
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
modeGrid.addEventListener("click", e => {
  const b = e.target.closest(".mcard");
  if (b) applyMode(b.dataset.modo);
});
modeSwap.addEventListener("click", () => {
  const targetEl = previousMode;
  if (targetEl) applyMode(targetEl);
});
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
for (const id of ["bar-prev", "bar-next", "bb-prev", "bb-next"]) {
  const b = document.getElementById(id);
  b.addEventListener("click", () => goNeighbor(+b.dataset.dir));
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
for (const id of ["bar-say", "bb-say"]) document.getElementById(id).addEventListener("click", e => speakFrom(hereIndex(), e.currentTarget));
// Atalhos do cabeçalho (Léxico, Perguntas): rolam até a seção sem mudar o endereço da página
document.getElementById("hchips").addEventListener("click", e => {
  const a = e.target.closest("[data-go-local]");
  if (!a) return;
  e.preventDefault();
  const target = document.querySelector(a.getAttribute("href"));
  if (!target) return;
  target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  const h = target.querySelector("h2");
  if (h) {
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }
});
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
  pickedBook = BY_CODE[pos[0]];
  openChapter(pos[0], pos[1], pos[2]);
})();
window.addEventListener("hashchange", () => {
  const m = /^([1-3A-Z]{3})\.(\d+)(?:\.(\d+))?$/.exec(decodeURIComponent(location.hash.slice(1)));
  if (m && (m[1] !== BOOK.code || +m[2] !== CUR)) openChapter(m[1], +m[2], m[3] !== undefined ? +m[3] : null);
});

// ---------- App nativo: botão "voltar" do Android ----------
const AppPlugin = capPlugin("App");
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
// Celular: Livros e Aparência descem para a barra de baixo (os mesmos botões, que só mudam de lugar)
{
  const bbar = document.getElementById("bbar");
  const tocBtn = document.getElementById("open-toc"),
    lookBtn = document.getElementById("open-look");
  const tocHome = document.createComment("open-toc"),
    lookHome = document.createComment("open-look");
  tocBtn.before(tocHome);
  lookBtn.before(lookHome);
  const mq = matchMedia("(max-width: 720px)");
  const place = () => {
    if (mq.matches) {
      bbar.prepend(tocBtn);
      bbar.append(lookBtn);
      bbar.classList.add("cinco");
    } else {
      tocHome.after(tocBtn);
      lookHome.after(lookBtn);
      bbar.classList.remove("cinco");
    }
  };
  place();
  mq.addEventListener("change", place);
}
// Tocar no título do capítulo abre o índice já na grade de capítulos do livro
where.addEventListener("click", () => {
  tocView("capitulos");
  requestAnimationFrame(() => {
    const here = document.querySelector('#chgrid .chchip[aria-pressed="true"]');
    if (here) here.focus({ preventScroll: true });
  });
});
// "Ir para" também filtra os livros pelo nome ("cânt", "1 jo")
function filterBooks() {
  const raw = goIn.value.trim();
  const q = /\d\s*[:.]|\d\s+\d/.test(raw) ? "" : norm(raw.replace(/\s+/g, ""));
  const qLetters = q.replace(/\d+$/, "");
  let shown = 0;
  document.querySelectorAll("#bk-list .bchip").forEach(b => {
    const B = BY_CODE[b.dataset.cod];
    const ok =
      !qLetters || [B.name, B.abbrev].some(x => norm(x.replace(/\s+/g, "")).startsWith(qLetters)) || norm(B.name).includes(qLetters);
    b.hidden = !ok;
    if (ok) shown++;
  });
  document.querySelectorAll("#bk-list .bgroup, #bk-list .testa").forEach(g => {
    if (g.classList.contains("bgroup")) g.hidden = ![...g.querySelectorAll(".bchip")].some(b => !b.hidden);
  });
  document.getElementById("bk-list").dataset.filtro = qLetters && shown ? "1" : "";
}
goIn.addEventListener("input", filterBooks);
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
  const notesBtn = document.getElementById("open-notes"),
    notesN = document.getElementById("notes-n");
  notesBtn.addEventListener("click", () => {
    if (openSheet) closePanel(false);
    if (window.Annotations) window.Annotations.openList();
  });
  // conta os versículos com alguma anotação (cor, nota ou favorito), não os registros
  const count = async () => {
    if (!window.Annotations) return;
    const lists = await Promise.all(["notas", "marcacoes", "favoritos"].map(c => window.Annotations.allRecords(c)));
    const n = new Set(lists.flat().map(r => (r.ancora ? `${r.ancora.livro}.${r.ancora.cap}.${r.ancora.ver}` : r.id))).size;
    notesN.textContent = n ? ` · ${n}` : "";
    notesBtn.setAttribute("aria-label", n ? `Minhas anotações: ${n} ${n === 1 ? "versículo" : "versículos"}` : "Minhas anotações");
  };
  window.addEventListener("load", () => {
    count();
    if (window.Annotations) window.Annotations.onChange(count);
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
  document.getElementById("bk-list").dataset.nt = nt;
  document.querySelectorAll("#bk-testa [data-nt]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.nt === nt)));
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
document.getElementById("bk-testa").addEventListener("click", e => {
  const b = e.target.closest("[data-nt]");
  if (b) setTesta(b.dataset.nt);
});
document.getElementById("ch-back").addEventListener("click", () => tocView("livros"));
document.getElementById("ch-list").addEventListener("click", e => {
  const b = e.target.closest(".ch-row");
  if (!b) return;
  if (b.getAttribute("aria-disabled") === "true") return toast("Este capítulo não está incluído nesta prévia.");
  openChapter(pickedBook.code, +b.dataset.ch, null);
});
// Abrir pelo botão Livros mostra a lista de livros; pelo título (lá em cima), a grade de capítulos
document.getElementById("open-toc").addEventListener("click", () => {
  tocTab("livros");
  tocView("livros");
});
tocTab("livros");
tocView("livros");
// "Notas · N" na aba, como no design
window.addEventListener("load", () => {
  const n = document.getElementById("tab-notas-n");
  const count = async () => {
    if (!window.Annotations) return;
    const lists = await Promise.all(["notas", "marcacoes", "favoritos"].map(c => window.Annotations.allRecords(c)));
    const k = new Set(lists.flat().map(r => (r.ancora ? `${r.ancora.livro}.${r.ancora.cap}.${r.ancora.ver}` : r.id))).size;
    n.textContent = k ? ` · ${k}` : "";
  };
  count();
  if (window.Annotations) window.Annotations.onChange(count);
});
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
document.getElementById("open-toc").addEventListener("click", () => {
  const on = window.Account && !["signed-out", "unavailable"].includes(window.Account.status());
  document.getElementById("vc-prog").textContent = on
    ? "Capítulos lidos, tempo de leitura, dias seguidos e o mapa dos 66 livros."
    : "Capítulos lidos, tempo de leitura, dias seguidos e o mapa dos 66 livros. Aparece depois de entrar com a conta.";
});
// Fim do capítulo como no design: Perguntas, Léxico do capítulo e, por último, o cartão "Próximo capítulo"
{
  const lex = document.getElementById("lexico");
  const place = () => {
    const nav = root.querySelector(".chnav");
    if (!nav || !lex) return;
    document.querySelectorAll("#page > .chnav").forEach(x => x.remove());
    lex.after(nav);
  };
  new MutationObserver(place).observe(root, { childList: true });
  place();
}
// Mini player do celular, como no design: "Lendo João 3:16 · grego" acima da barra de baixo, com pausa;
// enquanto toca, o Ouvir da barra vira "Pausar"
{
  const bar = document.createElement("div");
  bar.className = "miniplayer";
  bar.id = "miniplayer";
  bar.hidden = true;
  bar.setAttribute("role", "status");
  bar.innerHTML = `<span id="mp-t"></span><button type="button" id="mp-stop" aria-label="Pausar leitura"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>`;
  document.body.appendChild(bar);
  const label = document.querySelector("#bb-say .bb-t");
  bar.querySelector("#mp-stop").addEventListener("click", () => stopSpeech());
  document.addEventListener("speech-state", e => {
    const on = e.detail.on;
    bar.hidden = !on;
    document.body.classList.toggle("tocando", on);
    if (label) label.textContent = on ? "Pausar" : "Ouvir";
    const sec = e.detail.el && e.detail.el.closest(".verse");
    if (on && sec && CH) {
      const v = CH.verses[+sec.dataset.vi];
      const lang = document.body.classList.contains("hide-orig") ? "português" : GRC ? "grego" : "hebraico";
      document.getElementById("mp-t").textContent = `Lendo ${BOOK.name} ${v ? vLabel(v) : CUR} · ${lang}`;
    }
  });
}
