import { flushSync, mount } from "svelte";
import AnnotatePanel from "../src/components/AnnotatePanel.svelte";
import NoteEditor from "../src/components/NoteEditor.svelte";
import TagManager from "../src/components/TagManager.svelte";
import { t } from "../src/i18n";
import { chapterOf, createVerseAnnotations, tagKey, verseAnchor as anchorFor } from "../src/lib/annotations/verse";
import { COLOR_IDS, annotate } from "../src/state/annotate.svelte";
import { createTagManager } from "../src/lib/annotations/tags";
import { note } from "../src/state/note.svelte";
import { tagManager } from "../src/state/tags.svelte";
import { COLLECTIONS, createAnnotationStore, uuid } from "../src/lib/annotations/store";
import { exposedPlugin, nativePlugin, platform } from "../src/lib/native";
import { esc } from "../src/lib/text";
/* Anotações no aparelho: marcações com cores, notas, favoritos e etiquetas.
 * Tudo fica no banco local do navegador/app (IndexedDB, via Dexie — Apache-2.0); funciona sem conta e offline.
 * Cada gravação também entra numa fila de mudanças, que a sincronização com o Google Drive (fase 5) vai enviar.
 *
 * Âncora de uma anotação (onde ela está presa):
 *   { livro: "JHN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" | "blivre" | "original",
 *     inicio, fim,      // caracteres na Bíblia Livre, ou posições (0…) das palavras no original
 *     trecho,           // o texto marcado na época, para reencontrar se o versículo mudar
 *     edicao }          // data da edição dos dados quando foi marcado
 * O leitor (reader.html) avisa com o evento "capitulo" a cada capítulo desenhado. */
(function () {
  "use strict";
  if (window.Annotations) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EDITION = (window.DATA_EDICAO || "").slice(0, 10);

  // ---------- banco local (src/lib/annotations/store.ts) ----------
  const annotations = createAnnotationStore(window.Dexie);
  const { allRecords, ofChapter, save, removeRecord, storage } = annotations;
  annotations.setRepaint(() => paint());

  // ---------- âncoras ----------
  const verseAnchor = (cod, cap, v) => anchorFor(cod, cap, v, EDITION);

  // ---------- estado do capítulo atual (vem do leitor) ----------
  let currentChapter = null; // { cod, cap, nome, verses: [{ n, blivre, words: [{ heb }] }] }
  let selection = null; // { ancora, rotulo, trecho }
  const versesRoot = () => document.getElementById("verses");
  const verseEl = n => document.getElementById("v" + n);

  // Desenha as marcações do capítulo nos versículos (cores, notas, favoritos)
  async function paint() {
    if (!currentChapter || !versesRoot()) return;
    const cap = `${currentChapter.book}.${currentChapter.chapter}`;
    const [ms, ns, fs, ets] = await Promise.all([
      ofChapter("marcacoes", cap),
      ofChapter("notas", cap),
      ofChapter("favoritos", cap),
      allRecords("etiquetas")
    ]);
    if (!currentChapter || cap !== `${currentChapter.book}.${currentChapter.chapter}`) return;
    $$(".verse", versesRoot()).forEach(sec => {
      sec.classList.remove(...COLOR_IDS.map(c => "mk-" + c));
      $$(".word", sec).forEach(w => w.classList.remove(...COLOR_IDS.map(c => "mk-" + c)));
      const vi = +sec.dataset.vi,
        v = currentChapter.verses[vi];
      const bl = $(".blivre", sec);
      if (bl && v) {
        bl._marcas = [];
        bl.innerHTML = `<span class="tag">BLIVRE</span>${esc(v.blivre)}`;
      }
      sec.classList.remove("mk-deslocada", "com-cor");
      sec.style.removeProperty("--barcor");
      const tags = $(".vtags", sec);
      if (tags) tags.innerHTML = "";
      const ann = $(".vann", sec);
      if (ann) {
        ann.hidden = true;
        ann.innerHTML = "";
      }
    });
    for (const m of ms) {
      if (!m.cor) continue;
      const a = m.ancora,
        sec = verseEl(a.ver);
      if (!sec) continue;
      // barra de cor à esquerda: o versículo tem alguma marcação (inteiro, trecho ou palavra)
      if (!sec.classList.contains("com-cor") || a.camada === "versiculo") {
        sec.classList.add("com-cor");
        sec.style.setProperty("--barcor", `var(--mk-${m.cor})`);
      }
      if (a.camada === "versiculo") sec.classList.add("mk-" + m.cor);
      else if (a.camada === "original") {
        for (let i = a.inicio; i <= a.fim; i++) $(`.word[data-i="${i}"]`, sec)?.classList.add("mk-" + m.cor);
      } else if (a.camada === "blivre") markSnippet(sec, a, m.cor);
    }
    const byVerse = {};
    for (const n of ns) {
      const k = n.ancora.ver;
      (byVerse[k] = byVerse[k] || { n: 0, f: false }).n++;
    }
    for (const f of fs) {
      const k = f.ancora.ver;
      (byVerse[k] = byVerse[k] || { n: 0, f: false }).f = true;
    }
    paintStrips(ms, ns, fs, ets);
    for (const [ver, info] of Object.entries(byVerse)) {
      const sec = verseEl(ver),
        tags = sec && $(".vtags", sec);
      if (!tags) continue;
      tags.innerHTML = info.n
        ? `<button class="vnota" data-ver="${ver}" aria-label="${info.n} ${info.n === 1 ? "nota" : "notas"} neste versículo">${ICONS.nota}<span aria-hidden="true">${info.n > 1 ? info.n : ""}</span></button>`
        : "";
    }
  }
  // Faixa sob o versículo: começo da nota e etiquetas, para ver o que foi anotado sem abrir nada
  function paintStrips(ms, ns, fs, ets) {
    const names = Object.fromEntries(ets.map(t => [t.id, t.nome]));
    const per = {};
    const slot = ver => (per[ver] = per[ver] || { notas: [], tags: new Set(), fav: false });
    for (const r of [...ms, ...fs]) (r.etiquetas || []).forEach(t => names[t] && slot(r.ancora.ver).tags.add(names[t]));
    for (const f of fs) slot(f.ancora.ver).fav = true;
    for (const n of ns) {
      const p = slot(n.ancora.ver);
      p.notas.push(n);
      (n.etiquetas || []).forEach(t => names[t] && p.tags.add(names[t]));
    }
    for (const [ver, p] of Object.entries(per)) {
      const ann = $(".vann", verseEl(ver) || document.createElement("div"));
      if (!ann) continue;
      const first = p.notas.sort((x, y) => x.criado_em.localeCompare(y.criado_em))[0];
      const txt = first ? (first.titulo || first.texto || "").trim() : "";
      ann.innerHTML =
        (p.fav ? `<span class="vfav" title="Favorito" aria-label="Favorito">★</span>` : "") +
        (txt
          ? `<button class="vann-note" data-ver="${ver}">${ICONS.nota}<span>${esc(txt.length > 90 ? txt.slice(0, 88) + "…" : txt)}</span>${p.notas.length > 1 ? `<small>+${p.notas.length - 1}</small>` : ""}</button>`
          : "") +
        (p.tags.size ? `<span class="vann-tags">${[...p.tags].map(t => `<span class="chip">#${esc(t)}</span>`).join("")}</span>` : "");
      ann.hidden = !ann.innerHTML;
    }
  }
  // Marca um trecho da Bíblia Livre; se o texto mudou, procura o trecho guardado; não achou: marca o versículo inteiro
  function markSnippet(sec, a, cor) {
    const vi = +sec.dataset.vi,
      txt = currentChapter.verses[vi]?.blivre || "";
    let i = a.inicio,
      f = a.fim;
    if (txt.slice(i, f) !== a.trecho) {
      const k = a.trecho ? txt.indexOf(a.trecho) : -1;
      if (k < 0) {
        sec.classList.add("mk-" + cor, "mk-deslocada");
        return;
      }
      i = k;
      f = k + a.trecho.length;
    }
    const bl = $(".blivre", sec);
    const html = bl.innerHTML;
    const bodyHtml = html.slice(html.indexOf("</span>") + 7);
    // corpo já é texto escapado com possíveis <mark> anteriores: refaz a partir do texto puro com todas as marcas do verso
    const marks = (bl._marcas = (bl._marcas || []).concat([{ i, f, cor }]));
    let out = "",
      pos = 0;
    const sorted = [...marks].sort((x, y) => x.i - y.i);
    for (const m of sorted) {
      if (m.i < pos) continue;
      out += esc(txt.slice(pos, m.i)) + `<mark class="mk mk-${m.cor}">${esc(txt.slice(m.i, m.f))}</mark>`;
      pos = m.f;
    }
    out += esc(txt.slice(pos));
    bl.innerHTML = `<span class="tag">BLIVRE</span>${out}`;
    void bodyHtml;
  }

  // ícones dos painéis que ainda não são componentes (nota, Minhas anotações, caderno)
  const ICONS = {
    nota: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 4h14v12l-4 4H5z"/><path d="M9 9h6M9 13h4"/></svg>',
    fav: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
    copyText:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    share:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/></svg>',
    camadas:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    ouvir:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    hide: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  // ---------- painel Anotar (AnnotatePanel.svelte; as regras do versículo em src/lib/annotations/verse.ts) ----------
  const verse = createVerseAnnotations(annotations);
  const verseTags = a => verse.tags(a);
  mount(AnnotatePanel, {
    target: document.body,
    props: {
      onclose: () => closeBar(),
      oncolor: color => setColor(color),
      onaction: (action, button) => panelAction(action, button),
      ontag: id => toggleTag(id),
      onnewtag: async name => toggleTag((await verse.tagNamed(name)).id, true),
      onnote: () => noteTyped()
    }
  });
  const bar = $("#mbar");

  // Compartilhar: o endereço do versículo (#JHN.3.16) com o texto da BLIVRE. No app vai pela folha de
  // compartilhar do sistema e aponta para o site publicado; no navegador usa a Web Share API ou copia o link.
  async function shareVerse(a) {
    const v = currentChapter?.verses.find(x => x.n === a.ver);
    const ref = `${currentChapter?.bookName || a.livro} ${a.cap}:${a.ver}`;
    const base = /^https?:$/.test(location.protocol)
      ? location.href.split("#")[0]
      : "https://josafams.github.io/biblia-interlinear/ler.html";
    const url = `${base}#${a.livro}.${a.cap}.${a.ver}`;
    const text = `${selection.trecho || v?.blivre || ""} (${ref}, Bíblia Livre)`.trim();
    const share = exposedPlugin("Share");
    try {
      if (share) return await share.share({ title: ref, text, url });
      if (navigator.share) return await navigator.share({ title: ref, text, url });
    } catch (err) {
      // a pessoa fechou a folha de compartilhar (navegador: AbortError; app: "Share canceled")
      if (err && (err.name === "AbortError" || /cancel/i.test(err.message || ""))) return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toastMsg("Link do versículo copiado.");
    } catch (_) {
      toastMsg("Não foi possível compartilhar neste navegador.");
    }
  }

  // titulo: abre o painel para responder uma pergunta (a resposta vira uma nota nova com a pergunta como título)
  async function openBar(ancora, labelText, trecho, titulo) {
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    selection = { ancora, labelText, trecho, titulo };
    // sem trecho selecionado, mostra o começo do próprio versículo, como no design
    const citado = trecho || (ancora.camada === "versiculo" ? ancora.trecho : "") || "";
    annotate.ref = labelText;
    annotate.snippet = titulo
      ? t("annotate.question", { question: titulo })
      : citado
        ? `“${citado.length > 90 ? citado.slice(0, 88) + "…" : citado}”`
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
    $$(".verse.editando").forEach(v => v.classList.remove("editando"));
    const sec = verseEl(ancora.ver);
    sec?.classList.add("editando");
    // no celular a folha cobre a parte de baixo: o versículo sobe para ficar visível acima dela
    if (sec && !matchMedia("(min-width: 1100px)").matches) sec.scrollIntoView({ block: "start" });
    annotate.open = true;
    flushSync();
    document.body.classList.add("com-mbar");
    (titulo ? $("#mb-note") : $(".mb-color", bar)).focus({ preventScroll: true });
  }
  async function refreshClear() {
    if (selection) annotate.hasRecords = await verse.hasAny(selection.ancora);
  }
  function closeBar() {
    if (!annotate.open) return;
    flushQuickNote();
    annotate.open = false;
    flushSync();
    selection = null;
    $$(".verse.editando").forEach(v => v.classList.remove("editando"));
    document.body.classList.remove("com-mbar");
  }
  async function setColor(color) {
    if (!selection) return;
    await verse.setColor(selection.ancora, color || null);
    await paint();
    annotate.color = color;
    refreshClear();
  }
  async function panelAction(action, button) {
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
      const vi = currentChapter?.verses.findIndex(x => x.n === a.ver);
      if (vi >= 0) document.dispatchEvent(new CustomEvent("annotations:speak", { detail: { vi, btn: button } }));
      return;
    }
    if (action === "fav") {
      await verse.toggleFavorite(a, EDITION);
      await paint();
      return openBar(a, selection.labelText, selection.trecho);
    }
    if (action === "limpar") return clearVerse(a);
    if (action === "copiar") {
      const v = currentChapter?.verses.find(x => x.n === a.ver);
      const texto = `${selection.trecho || v?.blivre || ""} (${currentChapter?.bookName || a.livro} ${a.cap}:${a.ver}, Bíblia Livre)`;
      try {
        await navigator.clipboard.writeText(texto);
        toastMsg(t("annotate.copied"));
      } catch (_) {
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
  // Limpar o versículo (cor, notas, favorito) com "Desfazer" por alguns segundos
  async function clearVerse(a) {
    const gone = await verse.clear(a);
    closeBar();
    await paint();
    toastUndo(t("annotate.cleared", { count: gone.count }), async () => {
      await gone.undo();
      await paint();
      toastMsg(t("annotate.restored"));
    });
  }
  // Nota rápida no próprio painel: edita a primeira nota do versículo (ou cria uma ao digitar)
  let quickNote = null,
    quickTimer = 0;
  async function loadQuickNote(a) {
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
    clearTimeout(quickTimer);
    annotate.noteStatus = "…";
    quickTimer = setTimeout(() => {
      quickTimer = 0;
      saveQuickNote();
    }, 600);
  }
  async function showTags() {
    if (selection) annotate.tags = await verse.tagChoices(selection.ancora);
  }
  // Ligar ou desligar uma etiqueta no versículo: vale para todos os registros dele (cor, notas e favorito)
  async function toggleTag(id, turnOn) {
    await verse.toggleTag(selection.ancora, id, turnOn);
    await showTags();
    paint();
    refreshClear();
  }

  // ---------- gestos: botão do versículo, toque longo, seleção de texto ----------
  function blivreAnchor(sec) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const bl = $(".blivre", sec);
    const r = sel.getRangeAt(0);
    if (!bl || !bl.contains(r.startContainer) || !bl.contains(r.endContainer)) return null;
    const tag = $(".tag", bl);
    const pre = document.createRange();
    pre.selectNodeContents(bl);
    pre.setEnd(r.startContainer, r.startOffset);
    const off = tag ? tag.textContent.length : 0;
    const startOffset = pre.toString().length - off,
      trecho = r.toString();
    if (startOffset < 0 || !trecho.trim()) return null;
    return { inicio: startOffset, fim: startOffset + trecho.length, trecho };
  }
  function openForVerse(sec, camada, extra) {
    const vi = +sec.dataset.vi,
      v = currentChapter.verses[vi];
    if (!v) return;
    const a = { ...verseAnchor(currentChapter.book, currentChapter.chapter, v.n), ...extra, camada };
    if (camada === "versiculo") a.trecho = (v.blivre || "").slice(0, 200);
    const trecho = camada === "versiculo" ? "" : extra.trecho;
    openBar(a, `${currentChapter.bookName} ${currentChapter.chapter}:${v.n}`, trecho);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".vmark");
    if (b) {
      const sec = b.closest(".verse");
      const s = sec && blivreAnchor(sec);
      return openForVerse(sec, s ? "blivre" : "versiculo", s || {});
    }
    const n = e.target.closest(".vnota, .vann-note");
    if (n) return openVerseNotes(+n.dataset.ver);
  });
  // Toque longo num cartão do original: marca a palavra. Toque longo no versículo: marca o versículo.
  let timer = 0,
    targetEl = null,
    longPress = false;
  document.addEventListener(
    "pointerdown",
    e => {
      const sec = e.target.closest && e.target.closest("#verses .verse");
      if (!sec || e.button > 0 || e.target.closest(".say, .vmark, .vnota, details")) return;
      targetEl = e.target.closest(".word") || sec;
      longPress = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        longPress = true;
        if (targetEl.classList.contains("word")) {
          const i = +targetEl.dataset.i;
          const v = currentChapter.verses[+targetEl.dataset.v];
          openForVerse(targetEl.closest(".verse"), "original", { inicio: i, fim: i, trecho: v?.words[i]?.heb || "" });
        } else if (!document.body.classList.contains("hide-orig") || !window.getSelection()?.toString()) {
          if (!window.getSelection()?.toString()) openForVerse(sec, "versiculo", {});
        }
      }, 550);
    },
    true
  );
  ["pointerup", "pointercancel", "pointermove"].forEach(ev =>
    document.addEventListener(
      ev,
      e => {
        if (ev === "pointermove" && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
        clearTimeout(timer);
      },
      true
    )
  );
  // O clique que termina um toque longo não abre o verbete
  document.addEventListener(
    "click",
    e => {
      if (longPress && e.target.closest("#verses .word")) {
        e.stopPropagation();
        e.preventDefault();
        longPress = false;
      }
    },
    true
  );
  // No celular o toque longo vira "contextmenu" (e o navegador cancela o pointer); no computador, é o botão direito.
  document.addEventListener("contextmenu", e => {
    const sec = e.target.closest && e.target.closest("#verses .verse");
    if (!sec) return;
    clearTimeout(timer);
    const s = blivreAnchor(sec);
    if (s) {
      e.preventDefault();
      return openForVerse(sec, "blivre", s);
    }
    const w = e.target.closest(".word");
    if (w) {
      e.preventDefault();
      longPress = true;
      const i = +w.dataset.i,
        v = currentChapter.verses[+w.dataset.v];
      return openForVerse(sec, "original", { inicio: i, fim: i, trecho: v?.words[i]?.heb || "" });
    }
    if (!e.target.closest("a, input, textarea") && !window.getSelection()?.toString()) {
      e.preventDefault();
      openForVerse(sec, "versiculo", {});
    }
  });
  // Selecionar texto da Bíblia Livre mostra a barra (no celular, depois que a seleção para)
  let selTimer = 0;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const sec =
        sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest("#verses .verse");
      if (!sec || (!bar.hidden && selection?.ancora.camada === "blivre")) return;
      const s = blivreAnchor(sec);
      if (s) openForVerse(sec, "blivre", s);
    }, 700);
  });

  // ---------- editor de nota (NoteEditor.svelte) ----------
  mount(NoteEditor, {
    target: document.body,
    props: {
      onclose: () => closeNote(),
      oninput: () => scheduleSave(),
      ontag: id => toggleNoteTag(id),
      onnewtag: async name => toggleNoteTag((await verse.tagNamed(name)).id, true),
      ondelete: () => deleteNote()
    }
  });
  let currentNote = null,
    saveTimer = 0,
    focusReturn = null;
  async function openNote(id, ancora, trecho, title) {
    focusReturn = document.activeElement;
    const todasN = await allRecords("notas");
    currentNote = id
      ? todasN.find(n => n.id === id)
      : {
          id: uuid(),
          cap: ancora ? chapterOf(ancora) : "livre",
          ancora: ancora || null,
          titulo: title || "",
          texto: "",
          etiquetas: ancora ? await verseTags(ancora) : [],
          nova: true
        };
    if (!currentNote) return;
    const a = currentNote.ancora;
    note.ref = a
      ? `${bookName(a.livro)} ${a.cap}:${a.ver}${trecho || a.trecho ? ` · “${(trecho || a.trecho).slice(0, 80)}”` : ""}`
      : t("note.free");
    note.title = currentNote.titulo || "";
    note.text = currentNote.texto || "";
    note.status = currentNote.nova ? "" : t("annotate.saved");
    note.saved = !currentNote.nova;
    note.confirming = false;
    await renderNoteTags();
    note.open = true;
    flushSync();
    document.body.classList.add("com-nota");
    $("#note-text").focus();
  }
  async function renderNoteTags() {
    note.tags = (await allRecords("etiquetas")).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
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
    currentNote = { ...(await save("notas", { ...rec, titulo, texto })) };
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
    if (focusReturn && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
  }
  async function toggleNoteTag(id, turnOn) {
    const set = new Set(currentNote.etiquetas || []);
    if (turnOn ?? !set.has(id)) set.add(id);
    else set.delete(id);
    currentNote.etiquetas = [...set];
    await saveNote();
    return renderNoteTags();
  }
  // Confirmação simples sem diálogo do navegador (o botão vira "Toque de novo para apagar")
  let confirmTimer = 0;
  async function deleteNote() {
    if (!note.confirming) {
      note.confirming = true;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (note.confirming = false), 4000);
      return;
    }
    clearTimeout(confirmTimer);
    note.confirming = false;
    await removeRecord("notas", currentNote.id);
    currentNote = null;
    await paint();
    return closeNote();
  }
  async function openVerseNotes(ver) {
    const ns = (await ofChapter("notas", `${currentChapter.book}.${currentChapter.chapter}`))
      .filter(n => n.ancora?.ver === ver)
      .sort((x, y) => x.criado_em.localeCompare(y.criado_em));
    if (ns.length === 1) return openNote(ns[0].id);
    openList({ cap: `${currentChapter.book}.${currentChapter.chapter}`, ver });
  }

  // ---------- Minhas anotações ----------
  const listSheet = document.createElement("aside");
  listSheet.id = "minhas";
  listSheet.className = "sheet right mine-sheet";
  listSheet.hidden = true;
  listSheet.setAttribute("role", "dialog");
  listSheet.setAttribute("aria-modal", "true");
  listSheet.setAttribute("aria-labelledby", "mine-h");
  listSheet.innerHTML = `
    <div class="shead"><h2 id="mine-h">Minhas anotações</h2><button class="ibtn" data-fechar aria-label="Fechar">${ICONS.hide}</button></div>
    <div class="sgroup">
      <label class="sr" for="mn-search">Buscar nas anotações</label>
      <div class="mn-searchrow"><input id="mn-search" class="lsearch" type="search" placeholder="Buscar: luz, pastor, #oração" autocomplete="off"></div>
      <div class="mn-filters" role="group" aria-label="Tipo">
        <button class="chip" data-tipo="" aria-pressed="true">Todas</button>
        <button class="chip" data-tipo="notas" aria-pressed="false">Com nota</button>
        <button class="chip" data-tipo="marcacoes" aria-pressed="false">Marcadas</button>
        <button class="chip" data-tipo="favoritos" aria-pressed="false">Favoritos</button>
      </div>
      <div class="mn-tagchips" id="mn-tags" role="group" aria-label="Filtrar por etiqueta"></div>
      <div class="mn-actions">
        <button class="mn-new" id="mn-new">+ Nota livre (sem versículo)</button>
        <span id="mn-total" aria-live="polite"></span>
        <label class="mn-order"><span class="sr">Ordem</span><select id="mn-order"><option value="biblica">Ordem bíblica</option><option value="data">Mais recentes</option></select></label>
        <details class="mn-more" id="mn-more">
          <summary aria-label="Mais opções">⋯</summary>
          <div class="mn-menu">
            <button id="mn-select" aria-pressed="false">Selecionar itens</button>
            <button id="mn-export">Exportar PDF</button>
            <button id="mn-download">Baixar meus dados</button>
            <button id="mn-import">Importar</button>
            <button id="mn-manage">Gerenciar etiquetas</button>
          </div>
        </details>
        <input type="file" id="mn-file" accept=".json,application/json" hidden>
      </div>
      <div class="mn-manage" id="mn-tagmgr" hidden></div>
      <div id="mn-items"></div>
    </div>`;
  document.body.appendChild(listSheet);
  let listFilter = { tipo: "", cap: null, ver: null, tag: "" };
  let selecting = false;
  const selected = new Set();
  let lastItems = [];
  function bookName(cod) {
    return (window.__books || {})[cod]?.name || cod;
  }
  function bookOrder(cod) {
    return (window.__books || {})[cod]?.i ?? 999;
  }
  async function openList(f) {
    listFilter = { tipo: "", cap: null, ver: null, tag: "", ...(f || {}) };
    focusReturn = document.activeElement;
    document.dispatchEvent(new CustomEvent("annotations:open-panel"));
    listSheet.hidden = false;
    document.body.classList.add("com-minhas");
    await renderList();
    $("#mn-search").focus();
  }
  function closeList() {
    if (listSheet.hidden) return;
    listSheet.hidden = true;
    document.body.classList.remove("com-minhas");
    if (focusReturn && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
  }
  async function listItems() {
    const [ms, ns, fs, tagList] = await Promise.all([
      allRecords("marcacoes"),
      allRecords("notas"),
      allRecords("favoritos"),
      allRecords("etiquetas")
    ]);
    const tagNames = Object.fromEntries(tagList.map(t => [t.id, t.nome]));
    const ref = a => (a ? `${bookName(a.livro)} ${a.cap}:${a.ver}` : "Nota livre");
    const verseText = a => a?.trecho || "";
    return {
      tagList,
      listSheet: [
        ...ns.map(n => ({
          tipo: "notas",
          id: n.id,
          a: n.ancora,
          rot: "nota",
          titulo: n.titulo,
          texto: n.texto,
          extra: verseText(n.ancora),
          tagList: n.etiquetas || [],
          data: n.alterado_em
        })),
        ...ms.map(m => ({
          tipo: "marcacoes",
          id: m.id,
          a: m.ancora,
          rot: m.cor ? "marcação" : "etiqueta",
          cor: m.cor,
          texto: m.ancora.trecho || "",
          tagList: m.etiquetas || [],
          data: m.alterado_em
        })),
        ...fs.map(f => ({
          tipo: "favoritos",
          id: f.id,
          a: f.ancora,
          rot: "favorito",
          texto: "",
          tagList: f.etiquetas || [],
          data: f.alterado_em
        }))
      ].map(x => ({ ...x, ref: ref(x.a), etNomes: x.tagList.map(i => tagNames[i]).filter(Boolean) }))
    };
  }
  async function renderList() {
    const { tagList, listSheet: allItems } = await listItems();
    if (!tagList.some(t => t.id === listFilter.tag)) listFilter.tag = "";
    const counts = {};
    allItems.forEach(x => x.tagList.forEach(t => (counts[t] = (counts[t] || 0) + 1)));
    $("#mn-tags").innerHTML = tagList.length
      ? tagList
          .sort((x, y) => x.nome.localeCompare(y.nome, "pt"))
          .map(
            t =>
              `<button class="chip" data-tagf="${t.id}" aria-pressed="${listFilter.tag === t.id}">${esc(t.nome)} <small>${counts[t.id] || 0}</small></button>`
          )
          .join("")
      : "";
    const sel = { value: listFilter.tag };
    const raw = $("#mn-search").value.trim();
    const q = raw.toLowerCase();
    // "#oração" procura só nas etiquetas
    const tagQ = raw.startsWith("#") ? tagKey(raw) : "";
    const matches = x =>
      tagQ
        ? x.etNomes.some(n => tagKey(n).includes(tagQ))
        : !q || `${x.ref} ${x.titulo || ""} ${x.texto} ${x.etNomes.join(" ")}`.toLowerCase().includes(q);
    const base = allItems.filter(
      x =>
        (!listFilter.cap ||
          (x.a && `${x.a.livro}.${x.a.cap}` === listFilter.cap && (listFilter.ver == null || x.a.ver === listFilter.ver))) &&
        (!sel.value || x.tagList.includes(sel.value)) &&
        matches(x)
    );
    let xs = base.filter(x => !listFilter.tipo || x.tipo === listFilter.tipo);
    $$(".mn-filters .chip", listSheet).forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.tipo === listFilter.tipo));
      const n = b.dataset.tipo ? base.filter(x => x.tipo === b.dataset.tipo).length : base.length;
      let c = $("small", b);
      if (!c) b.insertAdjacentHTML("beforeend", " <small></small>");
      c = $("small", b);
      c.textContent = n;
    });
    if ($("#mn-order").value === "data") xs.sort((x, y) => y.data.localeCompare(x.data));
    else
      xs.sort(
        (x, y) =>
          (x.a ? bookOrder(x.a.livro) : 1e4) - (y.a ? bookOrder(y.a.livro) : 1e4) ||
          (x.a?.cap || 0) - (y.a?.cap || 0) ||
          (x.a?.ver || 0) - (y.a?.ver || 0)
      );
    lastItems = xs;
    $("#mn-total").textContent = listFilter.cap ? `${xs.length} neste versículo · ` : `${xs.length} ${xs.length === 1 ? "item" : "itens"}`;
    if (listFilter.cap) $("#mn-total").innerHTML += `<button class="linklike" id="mn-see-all">ver tudo</button>`;
    // Tudo de um mesmo versículo fica junto, num cartão: referência uma vez, depois cor, notas e favorito
    let grupo = null,
      verso = null,
      html = "";
    const byDate = $("#mn-order").value === "data";
    for (const x of xs) {
      const g = byDate ? null : x.a ? bookName(x.a.livro) : "Notas livres";
      const vk = x.a ? `${x.a.livro}.${x.a.cap}.${x.a.ver}` : "livre:" + x.id;
      if (g !== grupo && g) {
        if (verso) html += `</div>`;
        verso = null;
        html += `<h3 class="mn-group">${esc(g)}</h3>`;
        grupo = g;
      }
      if (vk !== verso) {
        if (verso) html += `</div>`;
        verso = vk;
        html += `<div class="mn-verse"><span class="mn-ref">${esc(x.ref)}</span>`;
      }
      html += itemHTML(x);
    }
    if (verso) html += `</div>`;
    $("#mn-items").innerHTML =
      html ||
      `<p class="mn-empty">${allItems.length ? "Nada encontrado com esses filtros." : "Ainda não há anotações. Toque longo num versículo, selecione um trecho ou use o botão ⋯ ao lado do número para marcar e anotar."}</p>`;
  }
  // ---------- Gerenciar etiquetas (TagManager.svelte; as regras em src/lib/annotations/tags.ts) ----------
  const tagRules = createTagManager(annotations);
  mount(TagManager, {
    target: $("#mn-tagmgr"),
    props: {
      onrename: (id, name) => renameTag(id, name),
      ondelete: async id => {
        await tagRules.remove(id);
        await tagsChanged();
      },
      ondone: () => toggleTagManager(false)
    }
  });
  async function toggleTagManager(force) {
    tagManager.open = force ?? !tagManager.open;
    $("#mn-tagmgr").hidden = !tagManager.open;
    if (tagManager.open) tagManager.tags = await tagRules.list();
  }
  async function tagsChanged() {
    await toggleTagManager(true);
    await renderList();
    paint();
  }
  async function renameTag(id, name) {
    const r = await tagRules.rename(id, name);
    if (!r) return toggleTagManager(true);
    if (r.merged) {
      if (listFilter.tag === id) listFilter.tag = r.merged.into.id;
      toastMsg(t("tags.merged", { from: r.merged.from.nome, into: r.merged.into.nome }));
    }
    await tagsChanged();
  }
  function itemHTML(x) {
    const kind = x.cor ? `<span class="mn-color mk-${x.cor}">${x.rot}</span>` : `<span class="mn-kind">${x.rot}</span>`;
    return `<button class="mn-item${selecting ? " sel" : ""}" data-tipo="${x.tipo}" data-id="${x.id}"${selecting ? ` role="checkbox" aria-checked="${selected.has(x.id)}"` : ""}>
        <span class="mn-line">${kind}${x.titulo ? ` <b class="mn-title">${esc(x.titulo)}</b>` : ""}<span class="sr"> · ${esc(x.ref)}</span></span>
        ${x.texto ? `<span class="mn-txt">${esc(x.texto.length > 160 ? x.texto.slice(0, 158) + "…" : x.texto)}</span>` : ""}
        ${x.etNomes.length ? `<span class="mn-tags">${x.etNomes.map(n => `<span class="chip">${esc(n)}</span>`).join("")}</span>` : ""}
      </button>`;
  }
  listSheet.addEventListener("click", async e => {
    if (e.target.closest("[data-fechar]")) return closeList();
    const tf = e.target.closest("[data-tagf]");
    if (tf) {
      listFilter.tag = listFilter.tag === tf.dataset.tagf ? "" : tf.dataset.tagf;
      return renderList();
    }
    if (e.target.closest("#mn-manage")) {
      $("#mn-more").open = false;
      return toggleTagManager();
    }
    if (e.target.closest(".mn-menu button")) $("#mn-more").open = false;
    const t = e.target.closest(".mn-filters .chip");
    if (t) {
      listFilter.tipo = t.dataset.tipo;
      return renderList();
    }
    if (e.target.closest("#mn-see-all")) {
      listFilter.cap = null;
      listFilter.ver = null;
      return renderList();
    }
    if (e.target.closest("#mn-new")) {
      closeList();
      return openNote(null, null);
    }
    if (e.target.closest("#mn-select")) {
      selecting = !selecting;
      if (!selecting) selected.clear();
      e.target.closest("#mn-select").setAttribute("aria-pressed", String(selecting));
      return renderList();
    }
    if (e.target.closest("#mn-export")) return openExport();
    if (e.target.closest("#mn-download")) return downloadData();
    if (e.target.closest("#mn-import")) return $("#mn-file").click();
    const it = e.target.closest(".mn-item");
    if (it && selecting) {
      selected.has(it.dataset.id) ? selected.delete(it.dataset.id) : selected.add(it.dataset.id);
      it.setAttribute("aria-checked", String(selected.has(it.dataset.id)));
      $("#mn-total").textContent = `${selected.size} selecionado${selected.size === 1 ? "" : "s"}`;
      return;
    }
    if (it) {
      if (it.dataset.tipo === "notas") {
        closeList();
        return openNote(it.dataset.id);
      }
      const { listSheet: xs } = await listItems();
      const x = xs.find(y => y.id === it.dataset.id);
      closeList();
      if (x?.a)
        document.dispatchEvent(new CustomEvent("annotations:goto", { detail: { book: x.a.livro, chapter: x.a.cap, verse: x.a.ver } }));
    }
  });
  $("#mn-search").addEventListener("input", () => renderList());
  $("#mn-order").addEventListener("change", () => renderList());
  listSheet.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeList();
    }
  });

  // ---------- Exportar em PDF (caderno) ----------
  const exportSheet = document.createElement("aside");
  exportSheet.id = "exportar";
  exportSheet.className = "sheet right mine-sheet";
  exportSheet.hidden = true;
  exportSheet.setAttribute("role", "dialog");
  exportSheet.setAttribute("aria-modal", "true");
  exportSheet.setAttribute("aria-labelledby", "exp-h");
  exportSheet.innerHTML = `
    <div class="shead"><h2 id="exp-h">Exportar em PDF</h2><button class="ibtn" data-fechar aria-label="Fechar">${ICONS.hide}</button></div>
    <div class="sgroup exp-body">
      <fieldset><legend>O que entra</legend>
        <label class="opt"><input type="radio" name="exp-scope" value="lista" checked> <span>O que está na lista agora <small id="exp-n-list"></small></span></label>
        <label class="opt"><input type="radio" name="exp-scope" value="sel"> <span>Os itens selecionados <small id="exp-n-sel"></small></span></label>
        <label class="opt"><input type="radio" name="exp-scope" value="livro"> <span>Um livro <select id="exp-book" aria-label="Livro"></select></span></label>
      </fieldset>
      <fieldset><legend>Incluir</legend>
        <label class="opt"><input type="checkbox" id="exp-notes" checked> Notas</label>
        <label class="opt"><input type="checkbox" id="exp-highlights" checked> Marcações</label>
        <label class="opt"><input type="checkbox" id="exp-favorites" checked> Favoritos</label>
        <label class="opt"><input type="checkbox" id="exp-text" checked> Texto de cada versículo (Bíblia Livre)</label>
        <label class="opt"><input type="checkbox" id="exp-inter"> Interlinear das palavras marcadas no original</label>
      </fieldset>
      <fieldset><legend>Ordem</legend>
        <label class="opt"><input type="radio" name="exp-order" value="biblica" checked> Bíblica</label>
        <label class="opt"><input type="radio" name="exp-order" value="data"> Por data</label>
      </fieldset>
      <button class="exp-generate" id="exp-generate">Gerar PDF</button>
      <p class="exp-note" id="exp-note">Gerado no próprio aparelho, sem internet. Na janela de impressão, escolha “Salvar como PDF”.</p>
    </div>`;
  document.body.appendChild(exportSheet);
  async function openExport() {
    const { listSheet: xs } = await listItems();
    const livros = [...new Set(xs.filter(x => x.a).map(x => x.a.livro))].sort((a, b) => bookOrder(a) - bookOrder(b));
    $("#exp-book").innerHTML = livros.map(c => `<option value="${c}">${esc(bookName(c))}</option>`).join("");
    $("#exp-n-list").textContent = `(${lastItems.length})`;
    $("#exp-n-sel").textContent = `(${selected.size})`;
    $('input[name="exp-scope"][value="sel"]').disabled = !selected.size;
    $('input[name="exp-scope"][value="livro"]').disabled = !livros.length;
    $('input[name="exp-scope"][value="' + (selected.size ? "sel" : "lista") + '"]').checked = true;
    listSheet.hidden = true;
    document.body.classList.remove("com-minhas");
    exportSheet.hidden = false;
    $("#exp-generate").focus();
  }
  function closeExport(goBack = true) {
    exportSheet.hidden = true;
    if (goBack) openList(listFilter);
  }
  exportSheet.addEventListener("click", e => {
    if (e.target.closest("[data-fechar]")) return closeExport();
    if (e.target.closest("#exp-generate")) return buildNotebook();
  });
  exportSheet.addEventListener("change", e => {
    if (e.target.id === "exp-book") $('input[name="exp-scope"][value="livro"]').checked = true;
  });
  exportSheet.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeExport();
    }
  });

  async function chapterInfo(cod, n) {
    try {
      return window.__carregarCapitulo ? await window.__carregarCapitulo(cod, n) : null;
    } catch (_) {
      return null;
    }
  }
  async function assembleNotebook() {
    const { listSheet: todosXs } = await listItems();
    const o = $('input[name="exp-scope"]:checked').value;
    let xs =
      o === "sel"
        ? todosXs.filter(x => selected.has(x.id))
        : o === "livro"
          ? todosXs.filter(x => x.a?.livro === $("#exp-book").value)
          : todosXs.filter(x => lastItems.some(y => y.id === x.id));
    const inc = { notas: $("#exp-notes").checked, marcacoes: $("#exp-highlights").checked, favoritos: $("#exp-favorites").checked };
    xs = xs.filter(x => inc[x.tipo]);
    const texto = $("#exp-text").checked,
      withInterlinear = $("#exp-inter").checked;
    const byDate = $('input[name="exp-order"]:checked').value === "data";
    // agrupa por versículo (ou nota livre)
    const grupos = new Map();
    for (const x of xs) {
      const k = x.a ? `${x.a.livro}.${x.a.cap}.${x.a.ver}` : `livre.${x.id}`;
      if (!grupos.has(k)) grupos.set(k, { a: x.a, listItems: [], data: x.data });
      const g = grupos.get(k);
      g.listItems.push(x);
      if (x.data > g.data) g.data = x.data;
    }
    let gs = [...grupos.values()];
    if (byDate) gs.sort((x, y) => y.data.localeCompare(x.data));
    else
      gs.sort(
        (x, y) =>
          (x.a ? bookOrder(x.a.livro) : 1e4) - (y.a ? bookOrder(y.a.livro) : 1e4) ||
          (x.a?.cap || 0) - (y.a?.cap || 0) ||
          (x.a?.ver || 0) - (y.a?.ver || 0)
      );
    const caps = {};
    for (const g of gs)
      if (g.a && (texto || withInterlinear)) {
        const k = `${g.a.livro}.${g.a.cap}`;
        if (!(k in caps)) caps[k] = await chapterInfo(g.a.livro, g.a.cap);
      }
    const marcasPorVerso = {};
    for (const m of await allRecords("marcacoes")) {
      const k = `${m.ancora.livro}.${m.ancora.cap}.${m.ancora.ver}`;
      (marcasPorVerso[k] = marcasPorVerso[k] || []).push(m);
    }
    const colorHex = { amarelo: "#f6e3a1", verde: "#cfe6c4", azul: "#bcd6e6", rosa: "#f2d2dc", laranja: "#f6d6b8" };
    const notebookBooks = [...new Set(gs.filter(g => g.a).map(g => bookName(g.a.livro)))];
    const titulo = notebookBooks.length === 1 ? notebookBooks[0] : "Minhas anotações";
    let bodyHtml = "",
      currentBook = null;
    for (const g of gs) {
      const a = g.a;
      if (!byDate && a && bookName(a.livro) !== currentBook && notebookBooks.length > 1) {
        currentBook = bookName(a.livro);
        bodyHtml += `<h2 class="cl">${esc(currentBook)}</h2>`;
      }
      const kinds = [...new Set(g.listItems.map(x => x.rot))].join(" · ").toUpperCase();
      bodyHtml += `<section class="en"><div class="ref">${esc(a ? `${bookName(a.livro)} ${a.cap}:${a.ver}` : "NOTA LIVRE")}${kinds ? ` · ${esc(kinds)}` : ""}</div>`;
      const raw = a && caps[`${a.livro}.${a.cap}`];
      const v = raw && raw.v.find(y => y.n === a.ver);
      const ms = a ? (marcasPorVerso[`${a.livro}.${a.cap}.${a.ver}`] || []).filter(m => m.cor) : [];
      if (texto && v) {
        let t = v.b || "";
        const wholeVerse = ms.find(m => m.ancora.camada === "versiculo");
        const snippets = ms
          .filter(m => m.ancora.camada === "blivre")
          .map(m => {
            let i = m.ancora.inicio,
              f = m.ancora.fim;
            if (t.slice(i, f) !== m.ancora.trecho) {
              const k = t.indexOf(m.ancora.trecho);
              if (k < 0) return null;
              i = k;
              f = k + m.ancora.trecho.length;
            }
            return { i, f, cor: m.cor };
          })
          .filter(Boolean)
          .sort((x, y) => x.i - y.i);
        let html = "",
          pos = 0;
        for (const m of snippets) {
          if (m.i < pos) continue;
          html += esc(t.slice(pos, m.i)) + `<mark style="background:${colorHex[m.cor]}">${esc(t.slice(m.i, m.f))}</mark>`;
          pos = m.f;
        }
        html += esc(t.slice(pos));
        bodyHtml += `<p class="vt"${wholeVerse ? ` style="background:${colorHex[wholeVerse.cor]};padding:2px 4px;border-radius:3px"` : ""}>${html}</p>`;
      }
      if (withInterlinear && v) {
        const originalMarks = ms.filter(m => m.ancora.camada === "original");
        for (const m of originalMarks) {
          const ws = v.w.slice(m.ancora.inicio, m.ancora.fim + 1);
          if (!ws.length) continue;
          const greek = a.livro && (window.__books || {})[a.livro]?.i >= 39;
          bodyHtml += `<p class="il"><span class="o" dir="${greek ? "ltr" : "rtl"}" lang="${greek ? "grc" : "he"}">${esc(ws.map(w => w[0].replace(/\//g, "")).join(" "))}</span> <span class="ig">${esc(ws.map(w => `${w[1]} · ${w[2]}`).join("; "))}</span></p>`;
        }
      }
      for (const x of g.listItems) {
        if (x.tipo === "notas")
          bodyHtml += `<div class="nt">${x.titulo ? `<b>${esc(x.titulo)}</b><br>` : ""}${esc(x.texto).replace(/\n/g, "<br>")}</div>`;
        else if (x.tipo === "marcacoes" && x.a.camada === "blivre" && !texto)
          bodyHtml += `<p class="vt"><mark style="background:${colorHex[x.cor] || "#eee"}">${esc(x.texto)}</mark></p>`;
      }
      const tagList = [...new Set(g.listItems.flatMap(x => x.etNomes))];
      if (tagList.length) bodyHtml += `<div class="tg">${tagList.map(n => `<span>${esc(n)}</span>`).join("")}</div>`;
      bodyHtml += `</section>`;
    }
    const data = new Date().toLocaleDateString("pt-BR");
    return {
      titulo,
      n: xs.length,
      html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} · Caderno de estudo</title><style>
@page { size: A4; margin: 16mm 15mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Literata", Georgia, "Times New Roman", serif; color: #1b2220; font-size: 11pt; line-height: 1.5; margin: 0; }
header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #1b2220; padding-bottom: 6px; margin-bottom: 8px; }
header small { font: 8pt "IBM Plex Mono", monospace; letter-spacing: .14em; color: #5b6662; display: block; }
header h1 { margin: 0; font-size: 22pt; } header span { font-size: 9pt; color: #5b6662; }
h2.cl { font-size: 14pt; margin: 14px 0 0; border-bottom: 1px solid #d2d8d3; }
.en { padding: 8px 0; border-bottom: 1px solid #e4e8e4; break-inside: avoid; }
.ref { font: 600 8.5pt "IBM Plex Mono", monospace; color: #1d5b74; letter-spacing: .04em; }
.vt { margin: 4px 0; } mark { color: inherit; padding: 0 1px; border-radius: 2px; }
.il { margin: 2px 0; font-size: 10pt; color: #3d4744; } .il .o { font-family: "Noto Serif Hebrew", "SBL Hebrew", "Gentium Book Plus", serif; font-size: 13pt; }
.nt { margin: 4px 0; padding-left: 10px; border-left: 2px solid #c7cfca; font-size: 10.5pt; color: #2b3330; }
.tg span { display: inline-block; font-size: 8pt; background: #dbe8ec; color: #1d5b74; border-radius: 999px; padding: 0 7px; margin: 3px 4px 0 0; }
footer { margin-top: 14px; font-size: 7.5pt; color: #5b6662; border-top: 1px solid #d2d8d3; padding-top: 4px; }
</style></head><body>
<header><div><small>CADERNO DE ESTUDO · BÍBLIA INTERLINEAR</small><h1>${esc(titulo)}</h1></div><span>${xs.length} ${xs.length === 1 ? "item" : "itens"} · ${data}</span></header>
${bodyHtml || "<p>Nenhum item com essas opções.</p>"}
<footer>Texto: Bíblia Livre (BLIVRE). Original: Open Scriptures Hebrew Bible e SBLGNT (CC BY 4.0). Glosas e léxico: projeto Bíblia Interlinear.</footer>
</body></html>`
    };
  }
  async function buildNotebook() {
    const btn = $("#exp-generate");
    btn.disabled = true;
    btn.textContent = "Gerando…";
    try {
      const c = await assembleNotebook();
      window.__ultimoCaderno = c;
      await printHtml(c.html, `${c.titulo} - caderno`);
    } finally {
      btn.disabled = false;
      btn.textContent = "Gerar PDF";
    }
  }
  // Imprime um HTML: no app Android pelo serviço de impressão do sistema (plugin Print, que tem "Salvar como PDF");
  // no navegador, por um iframe escondido e a janela de impressão.
  async function printHtml(html, titulo) {
    const plug = nativePlugin("Print");
    if (plug && platform === "android") {
      try {
        await plug.printHtml({ html, title: titulo });
        return;
      } catch (_) {
        toastMsg("Não foi possível abrir a impressão do Android.");
        return;
      }
    }
    const frame = document.createElement("iframe");
    frame.className = "fr-impressao";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(frame);
    frame.srcdoc = html;
    await new Promise(r => {
      frame.onload = r;
      setTimeout(r, 1500);
    });
    if (window.__noPrint) return; // testes automáticos: só monta o caderno
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch (_) {
      toastMsg("Este navegador não permite imprimir; tente no Chrome, Edge ou Safari.");
    }
    setTimeout(() => frame.remove(), 60000);
  }

  // ---------- Baixar e importar meus dados (JSON) ----------
  async function downloadData() {
    const payload = await annotations.backup();
    const json = JSON.stringify(payload, null, 1);
    const nome = `biblia-interlinear-anotacoes-${payload.exportado_em.slice(0, 10)}.json`;
    window.__ultimoBackup = payload;
    const files = exposedPlugin("Filesystem"),
      share = exposedPlugin("Share");
    if (files && share) {
      try {
        const r = await files.writeFile({ path: nome, data: json, directory: "CACHE", encoding: "utf8" });
        await share.share({ title: "Minhas anotações", files: [r.uri] });
        return;
      } catch (_) {
        /* cai no download comum */
      }
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toastMsg("Arquivo de backup baixado.");
  }
  const importData = annotations.importBackup;
  $("#mn-file").addEventListener("change", async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const r = await importData(JSON.parse(await f.text()));
      toastMsg(`Importado: ${r.added} novos, ${r.updated} atualizados, ${r.same} já estavam aqui.`);
      renderList();
    } catch (err) {
      toastMsg(err.name === "BackupFormatError" ? err.message : "Não foi possível ler o arquivo.");
    }
  });

  let toastMsgTimer = 0;
  function toastMsg(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("dica");
    t.hidden = false;
    clearTimeout(toastMsgTimer);
    toastMsgTimer = setTimeout(
      () => {
        t.hidden = true;
      },
      Math.max(3500, msg.length * 70)
    );
  }
  // Aviso com o botão "Desfazer" (fica 8 segundos)
  function toastUndo(msg, undo) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.innerHTML = `<span>${esc(msg)}</span> <button type="button" class="toast-undo" data-undo>Desfazer</button>`;
    t.classList.remove("dica");
    t.hidden = false;
    $("[data-undo]", t).addEventListener("click", () => undo(), { once: true });
    clearTimeout(toastMsgTimer);
    toastMsgTimer = setTimeout(() => {
      t.hidden = true;
    }, 8000);
  }

  // ---------- integração com o leitor ----------
  // Capítulos longos montam os cartões aos poucos: redesenha as marcações das palavras que acabaram de aparecer
  let filledTimer = 0;
  document.addEventListener("words-filled", () => {
    clearTimeout(filledTimer);
    filledTimer = setTimeout(paint, 120);
  });
  document.addEventListener("chapter-rendered", e => {
    currentChapter = e.detail;
    closeBar();
    paint();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !bar.hidden) closeBar();
  });
  window.Annotations = {
    openList,
    openNote,
    // "Anotar resposta" das Perguntas ao texto: nota no versículo, com a pergunta como título
    // "Anotar resposta" das perguntas abre o mesmo painel do versículo
    noteForQuestion: (book, chapter, verse, question) => {
      const a = verseAnchor(book, chapter, verse);
      const v = currentChapter?.verses.find(x => x.n === verse);
      if (!v) return openNote(null, a, null, question);
      a.trecho = (v.blivre || "").slice(0, 200);
      return openBar(a, `${currentChapter.bookName} ${chapter}:${verse}`, "", question);
    },
    closeBar,
    openVerse: n => {
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
    printHtml,
    countAll: async () => (await Promise.all(["notas", "marcacoes", "favoritos"].map(allRecords))).reduce((s, l) => s + l.length, 0),
    onChange: annotations.onChange,
    exportAll: async () => Object.fromEntries(await Promise.all(COLLECTIONS.map(async c => [c, await allRecords(c)]))),
    local: annotations.persistent,
    storage
  };
  if (currentChapter === null && window.__currentChapter) {
    currentChapter = window.__currentChapter;
    paint();
  }
})();
