/* Anotações no aparelho: marcações com cores, notas, favoritos e etiquetas.
 * Tudo fica no banco local do navegador/app (IndexedDB, via Dexie — Apache-2.0); funciona sem conta e offline.
 * Cada gravação também entra numa fila de mudanças, que a sincronização com o Google Drive (fase 5) vai enviar.
 *
 * Âncora de uma anotação (onde ela está presa):
 *   { livro: "JHN", cap: 1, ver: 1, ver_fim: 1, camada: "versiculo" | "blivre" | "original",
 *     inicio, fim,      // caracteres na Bíblia Livre, ou posições (0…) das palavras no original
 *     trecho,           // o texto marcado na época, para reencontrar se o versículo mudar
 *     edicao }          // data da edição dos dados quando foi marcado
 * O leitor (template.html) avisa com o evento "capitulo" a cada capítulo desenhado. */
(function () {
  "use strict";
  if (window.Anotacoes) return;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const COLORS = [
    { id: "amarelo", nome: "Amarelo" },
    { id: "verde", nome: "Verde" },
    { id: "azul", nome: "Azul" },
    { id: "rosa", nome: "Rosa" },
    { id: "laranja", nome: "Laranja" }
  ];
  const EDITION = (window.DATA_EDICAO || "").slice(0, 10);

  // ---------- identificadores, relógio e aparelho ----------
  const uuid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          return (c === "x" ? r : (r & 3) | 8).toString(16);
        });
  let aparelho;
  try {
    aparelho = localStorage.getItem("interlinear:aparelho");
    if (!aparelho) {
      aparelho = uuid().slice(0, 8);
      localStorage.setItem("interlinear:aparelho", aparelho);
    }
  } catch (_) {
    aparelho = uuid().slice(0, 8);
  }
  // Relógio lógico híbrido: milissegundos + contador + aparelho. Ordena edições mesmo com o relógio do celular errado
  // (avança sempre que se vê uma mudança mais nova de outro aparelho — usado pela sincronização).
  let hlc = { t: 0, c: 0 };
  function relogio(seen) {
    const currentTime = Date.now();
    if (seen) {
      const [vt, vc] = seen.split("-").map(Number);
      if (vt > hlc.t || (vt === hlc.t && vc > hlc.c)) hlc = { t: vt, c: vc };
    }
    if (currentTime > hlc.t) hlc = { t: currentTime, c: 0 };
    else hlc.c++;
    return `${String(hlc.t).padStart(14, "0")}-${String(hlc.c).padStart(4, "0")}-${aparelho}`;
  }

  // ---------- banco local ----------
  const COLLECTIONS = ["marcacoes", "notas", "favoritos", "etiquetas"];
  // o que viaja para o Drive: anotações, preferências (modo de leitura, posição) e progresso (leituras, tempo, planos)
  const SYNCED = [...COLLECTIONS, "preferencias", "leituras", "tempo", "planos"];
  let db = null,
    memory = null;
  const memoryState = {};
  try {
    if (!window.Dexie || !window.indexedDB) throw new Error("sem IndexedDB");
    db = new Dexie("biblia-interlinear");
    db.version(1).stores({
      marcacoes: "id, cap, alterado_em, apagado",
      notas: "id, cap, alterado_em, apagado",
      favoritos: "id, cap, alterado_em, apagado",
      etiquetas: "id, nome, apagado",
      fila: "++seq, colecao, id",
      estado: "chave"
    });
    db.version(2).stores({ preferencias: "id" });
    db.version(3).stores({ leituras: "id, livro", tempo: "id, dia", planos: "id" });
  } catch (_) {
    db = null;
  }
  async function openDb() {
    if (memory) return false;
    if (!db) {
      memory = Object.fromEntries(SYNCED.map(c => [c, new Map()]));
      return false;
    }
    try {
      await db.open();
      return true;
    } catch (_) {
      db = null;
      memory = Object.fromEntries(SYNCED.map(c => [c, new Map()]));
      return false;
    }
  }
  const pronto = openDb();
  async function allRecords(col) {
    await pronto;
    const listSheet = db ? await db[col].toArray() : [...memory[col].values()];
    return listSheet.filter(r => !r.apagado);
  }
  async function ofChapter(col, cap) {
    await pronto;
    const listSheet = db ? await db[col].where("cap").equals(cap).toArray() : [...memory[col].values()].filter(r => r.cap === cap);
    return listSheet.filter(r => !r.apagado);
  }
  async function save(col, rec) {
    await pronto;
    const currentTime = new Date().toISOString();
    const oldRecord = db ? await db[col].get(rec.id) : memory[col].get(rec.id);
    const fresh = {
      ...oldRecord,
      ...rec,
      criado_em: oldRecord?.criado_em || currentTime,
      alterado_em: currentTime,
      base: oldRecord?.relogio || null,
      relogio: relogio(),
      apagado: rec.apagado || false
    };
    delete fresh.local; // editar algo que estava "só neste aparelho" passa a sincronizar
    if (db)
      await db.transaction("rw", db[col], db.fila, async () => {
        await db[col].put(fresh);
        await db.fila.add({ colecao: col, id: fresh.id });
      });
    else memory[col].set(fresh.id, fresh);
    notify();
    return fresh;
  }
  const apagar = (col, id) => save(col, { id, apagado: true });
  let listeners = [];
  function notify() {
    listeners.forEach(f => {
      try {
        f();
      } catch (_) {}
    });
  }

  // ---------- âncoras ----------
  const chapterOf = a => `${a.livro}.${a.cap}`;
  const anchorKey = a => `${a.livro}.${a.cap}.${a.ver}:${a.camada}:${a.camada === "versiculo" ? "" : `${a.inicio ?? ""}-${a.fim ?? ""}`}`;
  function verseAnchor(cod, cap, v) {
    return { livro: cod, cap, ver: v, ver_fim: v, camada: "versiculo", edicao: EDITION };
  }

  // ---------- estado do capítulo atual (vem do leitor) ----------
  let currentChapter = null; // { cod, cap, nome, verses: [{ n, blivre, words: [{ heb }] }] }
  let selection = null; // { ancora, rotulo, trecho }
  const versesRoot = () => document.getElementById("verses");
  const verseEl = n => document.getElementById("v" + n);

  // Desenha as marcações do capítulo nos versículos (cores, notas, favoritos)
  async function paint() {
    if (!currentChapter || !versesRoot()) return;
    const cap = `${currentChapter.cod}.${currentChapter.cap}`;
    const [ms, ns, fs] = await Promise.all([ofChapter("marcacoes", cap), ofChapter("notas", cap), ofChapter("favoritos", cap)]);
    if (!currentChapter || cap !== `${currentChapter.cod}.${currentChapter.cap}`) return;
    $$(".verse", versesRoot()).forEach(sec => {
      sec.classList.remove(...COLORS.map(c => "mk-" + c.id));
      $$(".word", sec).forEach(w => w.classList.remove(...COLORS.map(c => "mk-" + c.id)));
      const vi = +sec.dataset.vi,
        v = currentChapter.verses[vi];
      const bl = $(".blivre", sec);
      if (bl && v) {
        bl._marcas = [];
        bl.innerHTML = `<span class="tag">BLIVRE</span>${esc(v.blivre)}`;
      }
      sec.classList.remove("mk-deslocada");
      const tags = $(".vtags", sec);
      if (tags) tags.innerHTML = "";
    });
    for (const m of ms) {
      if (!m.cor) continue;
      const a = m.ancora,
        sec = verseEl(a.ver);
      if (!sec) continue;
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
    for (const [ver, info] of Object.entries(byVerse)) {
      const sec = verseEl(ver),
        tags = sec && $(".vtags", sec);
      if (!tags) continue;
      tags.innerHTML =
        (info.f ? `<span class="vfav" title="Favorito" aria-label="Favorito">★</span>` : "") +
        (info.n
          ? `<button class="vnota" data-ver="${ver}" aria-label="${info.n} ${info.n === 1 ? "nota" : "notas"} neste versículo">${ICONS.nota}<span aria-hidden="true">${info.n > 1 ? info.n : ""}</span></button>`
          : "");
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

  // ---------- barra de marcação ----------
  const ICONS = {
    nota: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 4h14v12l-4 4H5z"/><path d="M9 9h6M9 13h4"/></svg>',
    fav: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
    copiar:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    camadas:
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    hide: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const bar = document.createElement("div");
  bar.id = "mbar";
  bar.className = "mbar";
  bar.hidden = true;
  bar.setAttribute("role", "dialog");
  bar.setAttribute("aria-label", "Marcar e anotar");
  bar.innerHTML = `
    <div class="mb-top"><b id="mb-ref"></b><span id="mb-trecho"></span><button class="mb-x" id="mb-fechar" aria-label="Fechar">${ICONS.hide}</button></div>
    <div class="mb-cores" role="group" aria-label="Cor da marcação">
      ${COLORS.map(c => `<button class="mb-cor mk-${c.id}" data-cor="${c.id}" aria-pressed="false" aria-label="${c.nome}"></button>`).join("")}
      <button class="mb-cor mb-sem" data-cor="" aria-label="Tirar a marcação">${ICONS.hide}</button>
    </div>
    <div class="mb-acoes">
      <button data-action="nota">${ICONS.nota}<span>Nota</span></button>
      <button data-action="fav" aria-pressed="false">${ICONS.fav}<span>Favoritar</span></button>
      <button data-action="etiqueta">${ICONS.tag}<span>Etiqueta</span></button>
      <button data-action="copiar">${ICONS.copiar}<span>Copiar</span></button>
      <button data-action="camadas" hidden>${ICONS.camadas}<span>Interlinear</span></button>
    </div>
    <div class="mb-etiquetas" id="mb-etiquetas" hidden></div>`;
  document.body.appendChild(bar);

  async function openBar(ancora, labelText, trecho) {
    selection = { ancora, labelText, trecho };
    $("#mb-ref").textContent = labelText;
    $("#mb-trecho").textContent = trecho ? `“${trecho.length > 60 ? trecho.slice(0, 58) + "…" : trecho}”` : "";
    $("#mb-etiquetas").hidden = true;
    const m = await highlightOf(ancora);
    $$(".mb-cor", bar).forEach(b => b.setAttribute("aria-pressed", String(!!m && m.cor === b.dataset.cor && !!b.dataset.cor)));
    const f = await favoriteOf(ancora.livro, ancora.cap, ancora.ver);
    $('[data-action="fav"]', bar).setAttribute("aria-pressed", String(!!f));
    $('[data-action="fav"] span', bar).textContent = f ? "Favorito" : "Favoritar";
    $('[data-action="camadas"]', bar).hidden = !document.body.classList.contains("hide-orig");
    bar.hidden = false;
    document.body.classList.add("com-mbar");
    $(".mb-cor", bar).focus({ preventScroll: true });
  }
  function closeBar() {
    if (bar.hidden) return;
    bar.hidden = true;
    selection = null;
    document.body.classList.remove("com-mbar");
  }
  async function highlightOf(a) {
    const k = anchorKey(a);
    return (await ofChapter("marcacoes", chapterOf(a))).find(m => anchorKey(m.ancora) === k) || null;
  }
  async function favoriteOf(livro, cap, ver) {
    return (await ofChapter("favoritos", `${livro}.${cap}`)).find(f => f.ancora.ver === ver) || null;
  }
  bar.addEventListener("click", async e => {
    if (!selection) return;
    const a = selection.ancora;
    if (e.target.closest("#mb-fechar")) return closeBar();
    const cor = e.target.closest(".mb-cor");
    if (cor) {
      const m = await highlightOf(a);
      if (!cor.dataset.cor) {
        if (m) {
          if (m.etiquetas?.length) await save("marcacoes", { id: m.id, cor: null });
          else await apagar("marcacoes", m.id);
        }
      } else
        await save("marcacoes", { id: m?.id || uuid(), cap: chapterOf(a), ancora: a, cor: cor.dataset.cor, etiquetas: m?.etiquetas || [] });
      await paint();
      $$(".mb-cor", bar).forEach(b => b.setAttribute("aria-pressed", String(!!cor.dataset.cor && b === cor)));
      return;
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "nota") {
      const s = selection;
      closeBar();
      return openNote(null, s.ancora, s.trecho);
    }
    if (action === "fav") {
      const f = await favoriteOf(a.livro, a.cap, a.ver);
      if (f) await apagar("favoritos", f.id);
      else await save("favoritos", { id: uuid(), cap: chapterOf(a), ancora: verseAnchor(a.livro, a.cap, a.ver), etiquetas: [] });
      await paint();
      return openBar(a, selection.labelText, selection.trecho);
    }
    if (action === "etiqueta") return showTags();
    if (action === "copiar") {
      const v = currentChapter?.verses.find(x => x.n === a.ver);
      const texto = `${selection.trecho || v?.blivre || ""} (${currentChapter?.nome || a.livro} ${a.cap}:${a.ver}, Bíblia Livre)`;
      try {
        await navigator.clipboard.writeText(texto);
        toastMsg("Copiado.");
      } catch (_) {
        toastMsg("Não foi possível copiar neste navegador.");
      }
      return closeBar();
    }
    if (action === "camadas") {
      verseEl(a.ver)?.classList.toggle("abrir");
      return closeBar();
    }
    const tag = e.target.closest("[data-etiqueta]");
    if (tag) return toggleTag(tag.dataset.etiqueta);
    if (e.target.closest("#mb-nova-et")) {
      const field = $("#mb-et-nome");
      const nome = field.value.trim();
      if (!nome) return field.focus();
      const exists = (await allRecords("etiquetas")).find(x => x.nome.toLowerCase() === nome.toLowerCase());
      const t = exists || (await save("etiquetas", { id: uuid(), nome, cor: null }));
      await toggleTag(t.id, true);
    }
  });
  bar.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeBar();
    }
    if (e.key === "Enter" && e.target.id === "mb-et-nome") {
      e.preventDefault();
      $("#mb-nova-et").click();
    }
  });
  async function showTags() {
    const box = $("#mb-etiquetas");
    const tagList = (await allRecords("etiquetas")).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
    const m = await highlightOf(selection.ancora);
    const has = new Set(m?.etiquetas || []);
    box.innerHTML = `<div class="mb-et-lista">${tagList.map(t => `<button class="chip" data-etiqueta="${t.id}" aria-pressed="${has.has(t.id)}">${esc(t.nome)}</button>`).join("") || '<span class="mb-vazio">Nenhuma etiqueta ainda.</span>'}</div>
      <div class="mb-et-nova"><label class="sr" for="mb-et-nome">Nova etiqueta</label><input id="mb-et-nome" type="text" placeholder="Nova etiqueta (ex.: promessas)" autocomplete="off"><button id="mb-nova-et">Criar</button></div>`;
    box.hidden = false;
    (tagList.length ? $(".chip", box) : $("#mb-et-nome")).focus();
  }
  async function toggleTag(id, turnOn) {
    const a = selection.ancora;
    const m = await highlightOf(a);
    const listSheet = new Set(m?.etiquetas || []);
    const on = turnOn ?? !listSheet.has(id);
    if (on) listSheet.add(id);
    else listSheet.delete(id);
    if (m) {
      if (!m.cor && !listSheet.size) await apagar("marcacoes", m.id);
      else await save("marcacoes", { id: m.id, etiquetas: [...listSheet] });
    } else if (listSheet.size) await save("marcacoes", { id: uuid(), cap: chapterOf(a), ancora: a, cor: null, etiquetas: [...listSheet] });
    await showTags();
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
    const a = { ...verseAnchor(currentChapter.cod, currentChapter.cap, v.n), ...extra, camada };
    if (camada === "versiculo") a.trecho = (v.blivre || "").slice(0, 200);
    const trecho = camada === "versiculo" ? "" : extra.trecho;
    openBar(a, `${currentChapter.nome} ${currentChapter.cap}:${v.n}`, trecho);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".vmark");
    if (b) {
      const sec = b.closest(".verse");
      const s = sec && blivreAnchor(sec);
      return openForVerse(sec, s ? "blivre" : "versiculo", s || {});
    }
    const n = e.target.closest(".vnota");
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

  // ---------- editor de nota ----------
  const nota = document.createElement("aside");
  nota.id = "nota";
  nota.className = "sheet right nota-sheet";
  nota.hidden = true;
  nota.setAttribute("role", "dialog");
  nota.setAttribute("aria-modal", "true");
  nota.setAttribute("aria-labelledby", "nota-h");
  nota.innerHTML = `
    <div class="shead"><h2 id="nota-h">Nota</h2><button class="ibtn" data-fechar aria-label="Fechar nota">${ICONS.hide}</button></div>
    <div class="sgroup nota-corpo">
      <p class="nota-ref" id="nota-ref"></p>
      <label class="sr" for="nota-titulo">Título</label>
      <input id="nota-titulo" type="text" placeholder="Título (opcional)" autocomplete="off">
      <label class="sr" for="nota-texto">Texto da nota</label>
      <textarea id="nota-texto" rows="10" placeholder="Escreva aqui. Salva sozinho."></textarea>
      <div class="nota-ets" id="nota-ets"></div>
      <div class="nota-rodape"><span id="nota-estado" aria-live="polite"></span><button class="nota-apagar" id="nota-apagar">Apagar nota</button></div>
    </div>`;
  document.body.appendChild(nota);
  let currentNote = null,
    saveTimer = 0,
    focusReturn = null;
  async function openNote(id, ancora, trecho) {
    focusReturn = document.activeElement;
    const todasN = await allRecords("notas");
    currentNote = id
      ? todasN.find(n => n.id === id)
      : { id: uuid(), cap: ancora ? chapterOf(ancora) : "livre", ancora: ancora || null, titulo: "", texto: "", etiquetas: [], nova: true };
    if (!currentNote) return;
    const a = currentNote.ancora;
    $("#nota-ref").textContent = a
      ? `${bookName(a.livro)} ${a.cap}:${a.ver}${trecho || a.trecho ? ` · “${(trecho || a.trecho).slice(0, 80)}”` : ""}`
      : "Nota livre";
    $("#nota-titulo").value = currentNote.titulo || "";
    $("#nota-texto").value = currentNote.texto || "";
    $("#nota-estado").textContent = currentNote.nova ? "" : "Salva.";
    $("#nota-apagar").hidden = !!currentNote.nova;
    await renderNoteTags();
    nota.hidden = false;
    document.body.classList.add("com-nota");
    $("#nota-texto").focus();
  }
  async function renderNoteTags() {
    const tagList = (await allRecords("etiquetas")).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
    const has = new Set(currentNote.etiquetas || []);
    $("#nota-ets").innerHTML =
      `<span class="nota-ets-r">Etiquetas:</span>` +
      tagList.map(t => `<button class="chip" data-tag="${t.id}" aria-pressed="${has.has(t.id)}">${esc(t.nome)}</button>`).join("") +
      `<span class="nota-et-nova"><label class="sr" for="nota-et-nome">Nova etiqueta</label><input id="nota-et-nome" type="text" placeholder="+ nova etiqueta" autocomplete="off"><button class="chip" data-et-nova>Criar</button></span>`;
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    $("#nota-estado").textContent = "…";
    saveTimer = setTimeout(saveNote, 600);
  }
  async function saveNote() {
    if (!currentNote) return;
    const titulo = $("#nota-titulo").value.trim(),
      texto = $("#nota-texto").value;
    if (currentNote.nova && !titulo && !texto.trim()) {
      $("#nota-estado").textContent = "";
      return;
    }
    const { nova: _nova, ...rec } = currentNote;
    currentNote = { ...(await save("notas", { ...rec, titulo, texto })) };
    $("#nota-estado").textContent = "Salva.";
    $("#nota-apagar").hidden = false;
    paint();
  }
  function closeNote() {
    if (nota.hidden) return;
    clearTimeout(saveTimer);
    saveNote();
    nota.hidden = true;
    currentNote = null;
    document.body.classList.remove("com-nota");
    if (focusReturn && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
  }
  $("#nota-titulo").addEventListener("input", scheduleSave);
  $("#nota-texto").addEventListener("input", scheduleSave);
  nota.addEventListener("click", async e => {
    if (e.target.closest("[data-fechar]")) return closeNote();
    if (e.target.closest("#nota-apagar")) {
      if (!confirmDelete()) return;
      await apagar("notas", currentNote.id);
      currentNote = null;
      await paint();
      return closeNote();
    }
    const b = e.target.closest("[data-tag]");
    if (b) {
      const set = new Set(currentNote.etiquetas || []);
      set.has(b.dataset.tag) ? set.delete(b.dataset.tag) : set.add(b.dataset.tag);
      currentNote.etiquetas = [...set];
      await saveNote();
      return renderNoteTags();
    }
    if (e.target.closest("[data-et-nova]")) {
      const nome = $("#nota-et-nome").value.trim();
      if (!nome) return $("#nota-et-nome").focus();
      const exists = (await allRecords("etiquetas")).find(x => x.nome.toLowerCase() === nome.toLowerCase());
      const t = exists || (await save("etiquetas", { id: uuid(), nome, cor: null }));
      currentNote.etiquetas = [...new Set([...(currentNote.etiquetas || []), t.id])];
      await saveNote();
      return renderNoteTags();
    }
  });
  nota.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeNote();
    }
    if (e.key === "Enter" && e.target.id === "nota-et-nome") {
      e.preventDefault();
      $("[data-et-nova]", nota).click();
    }
  });
  // Confirmação simples sem diálogo do navegador (o botão vira "Confirmar")
  let confirmAction = 0;
  function confirmDelete() {
    const b = $("#nota-apagar");
    if (Date.now() - confirmAction < 4000) {
      confirmAction = 0;
      b.textContent = "Apagar nota";
      return true;
    }
    confirmAction = Date.now();
    b.textContent = "Toque de novo para apagar";
    setTimeout(() => {
      b.textContent = "Apagar nota";
    }, 4000);
    return false;
  }
  async function openVerseNotes(ver) {
    const ns = (await ofChapter("notas", `${currentChapter.cod}.${currentChapter.cap}`))
      .filter(n => n.ancora?.ver === ver)
      .sort((x, y) => x.criado_em.localeCompare(y.criado_em));
    if (ns.length === 1) return openNote(ns[0].id);
    openList({ cap: `${currentChapter.cod}.${currentChapter.cap}`, ver });
  }

  // ---------- Minhas anotações ----------
  const listSheet = document.createElement("aside");
  listSheet.id = "minhas";
  listSheet.className = "sheet right minhas-sheet";
  listSheet.hidden = true;
  listSheet.setAttribute("role", "dialog");
  listSheet.setAttribute("aria-modal", "true");
  listSheet.setAttribute("aria-labelledby", "minhas-h");
  listSheet.innerHTML = `
    <div class="shead"><h2 id="minhas-h">Minhas anotações</h2><button class="ibtn" data-fechar aria-label="Fechar">${ICONS.hide}</button></div>
    <div class="sgroup">
      <label class="sr" for="mn-busca">Buscar nas anotações</label>
      <input id="mn-busca" class="lsearch" type="search" placeholder="Buscar: luz, pastor, Gn 1" autocomplete="off">
      <div class="mn-filtros" role="group" aria-label="Tipo">
        <button class="chip" data-tipo="" aria-pressed="true">Tudo</button>
        <button class="chip" data-tipo="notas" aria-pressed="false">Notas</button>
        <button class="chip" data-tipo="marcacoes" aria-pressed="false">Marcações</button>
        <button class="chip" data-tipo="favoritos" aria-pressed="false">Favoritos</button>
      </div>
      <div class="mn-filtros2">
        <label>Etiqueta <select id="mn-etiqueta"><option value="">todas</option></select></label>
        <label>Ordem <select id="mn-ordem"><option value="biblica">bíblica</option><option value="data">por data</option></select></label>
      </div>
      <div class="mn-acoes"><button class="mn-nova" id="mn-nova">+ Nova nota livre</button><span id="mn-total" aria-live="polite"></span></div>
      <div class="mn-acoes mn-acoes2">
        <button class="chip" id="mn-selecionar" aria-pressed="false">Selecionar</button>
        <button class="chip" id="mn-exportar">Exportar PDF</button>
        <button class="chip" id="mn-baixar">Baixar meus dados</button>
        <button class="chip" id="mn-importar">Importar</button>
        <input type="file" id="mn-arquivo" accept=".json,application/json" hidden>
      </div>
      <div id="mn-itens"></div>
    </div>`;
  document.body.appendChild(listSheet);
  let listFilter = { tipo: "", cap: null, ver: null };
  let selecting = false;
  const selected = new Set();
  let lastItems = [];
  function bookName(cod) {
    return (window.__livros || {})[cod]?.nome || cod;
  }
  function bookOrder(cod) {
    return (window.__livros || {})[cod]?.i ?? 999;
  }
  async function openList(f) {
    listFilter = { tipo: "", cap: null, ver: null, ...(f || {}) };
    focusReturn = document.activeElement;
    document.dispatchEvent(new CustomEvent("anotacoes:abrir-painel"));
    listSheet.hidden = false;
    document.body.classList.add("com-minhas");
    await renderList();
    $("#mn-busca").focus();
  }
  function closeList() {
    if (listSheet.hidden) return;
    listSheet.hidden = true;
    document.body.classList.remove("com-minhas");
    if (focusReturn && focusReturn.isConnected) focusReturn.focus({ preventScroll: true });
  }
  async function itens() {
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
    const { tagList, listSheet: allItems } = await itens();
    const sel = $("#mn-etiqueta"),
      currentTag = sel.value;
    sel.innerHTML =
      `<option value="">todas</option>` +
      tagList
        .sort((x, y) => x.nome.localeCompare(y.nome, "pt"))
        .map(t => `<option value="${t.id}">${esc(t.nome)}</option>`)
        .join("");
    sel.value = tagList.some(t => t.id === currentTag) ? currentTag : "";
    const q = $("#mn-busca").value.trim().toLowerCase();
    let xs = allItems.filter(
      x =>
        (!listFilter.tipo || x.tipo === listFilter.tipo) &&
        (!listFilter.cap ||
          (x.a && `${x.a.livro}.${x.a.cap}` === listFilter.cap && (listFilter.ver == null || x.a.ver === listFilter.ver))) &&
        (!sel.value || x.tagList.includes(sel.value)) &&
        (!q || `${x.ref} ${x.titulo || ""} ${x.texto} ${x.etNomes.join(" ")}`.toLowerCase().includes(q))
    );
    $$(".mn-filtros .chip", listSheet).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tipo === listFilter.tipo)));
    if ($("#mn-ordem").value === "data") xs.sort((x, y) => y.data.localeCompare(x.data));
    else
      xs.sort(
        (x, y) =>
          (x.a ? bookOrder(x.a.livro) : 1e4) - (y.a ? bookOrder(y.a.livro) : 1e4) ||
          (x.a?.cap || 0) - (y.a?.cap || 0) ||
          (x.a?.ver || 0) - (y.a?.ver || 0)
      );
    lastItems = xs;
    $("#mn-total").textContent = listFilter.cap ? `${xs.length} neste versículo · ` : `${xs.length} ${xs.length === 1 ? "item" : "itens"}`;
    if (listFilter.cap) $("#mn-total").innerHTML += `<button class="linklike" id="mn-ver-tudo">ver tudo</button>`;
    let grupo = null,
      html = "";
    for (const x of xs) {
      const g = $("#mn-ordem").value === "data" ? null : x.a ? bookName(x.a.livro) : "Notas livres";
      if (g !== grupo && g) {
        html += `<h3 class="mn-grupo">${esc(g)}</h3>`;
        grupo = g;
      }
      html += `<button class="mn-item${selecting ? " sel" : ""}" data-tipo="${x.tipo}" data-id="${x.id}"${selecting ? ` role="checkbox" aria-checked="${selected.has(x.id)}"` : ""}>
        <span class="mn-ref">${esc(x.ref)} · ${x.cor ? `<span class="mn-cor mk-${x.cor}">${x.rot}</span>` : x.rot}</span>
        ${x.titulo ? `<b class="mn-tit">${esc(x.titulo)}</b>` : ""}
        ${x.texto ? `<span class="mn-txt">${esc(x.texto.length > 160 ? x.texto.slice(0, 158) + "…" : x.texto)}</span>` : ""}
        ${x.etNomes.length ? `<span class="mn-ets">${x.etNomes.map(n => `<span class="chip">${esc(n)}</span>`).join("")}</span>` : ""}
      </button>`;
    }
    $("#mn-itens").innerHTML =
      html ||
      `<p class="mn-vazio">${allItems.length ? "Nada encontrado com esses filtros." : "Ainda não há anotações. Toque longo num versículo, selecione um trecho ou use o botão ⋯ ao lado do número para marcar e anotar."}</p>`;
  }
  listSheet.addEventListener("click", async e => {
    if (e.target.closest("[data-fechar]")) return closeList();
    const t = e.target.closest(".mn-filtros .chip");
    if (t) {
      listFilter.tipo = t.dataset.tipo;
      return renderList();
    }
    if (e.target.closest("#mn-ver-tudo")) {
      listFilter.cap = null;
      listFilter.ver = null;
      return renderList();
    }
    if (e.target.closest("#mn-nova")) {
      closeList();
      return openNote(null, null);
    }
    if (e.target.closest("#mn-selecionar")) {
      selecting = !selecting;
      if (!selecting) selected.clear();
      e.target.closest("#mn-selecionar").setAttribute("aria-pressed", String(selecting));
      return renderList();
    }
    if (e.target.closest("#mn-exportar")) return openExport();
    if (e.target.closest("#mn-baixar")) return downloadData();
    if (e.target.closest("#mn-importar")) return $("#mn-arquivo").click();
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
      const { listSheet: xs } = await itens();
      const x = xs.find(y => y.id === it.dataset.id);
      closeList();
      if (x?.a) document.dispatchEvent(new CustomEvent("anotacoes:ir", { detail: { cod: x.a.livro, cap: x.a.cap, ver: x.a.ver } }));
    }
  });
  $("#mn-busca").addEventListener("input", () => renderList());
  $("#mn-etiqueta").addEventListener("change", () => renderList());
  $("#mn-ordem").addEventListener("change", () => renderList());
  listSheet.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeList();
    }
  });

  // ---------- Exportar em PDF (caderno) ----------
  const exportSheet = document.createElement("aside");
  exportSheet.id = "exportar";
  exportSheet.className = "sheet right minhas-sheet";
  exportSheet.hidden = true;
  exportSheet.setAttribute("role", "dialog");
  exportSheet.setAttribute("aria-modal", "true");
  exportSheet.setAttribute("aria-labelledby", "exp-h");
  exportSheet.innerHTML = `
    <div class="shead"><h2 id="exp-h">Exportar em PDF</h2><button class="ibtn" data-fechar aria-label="Fechar">${ICONS.hide}</button></div>
    <div class="sgroup exp-corpo">
      <fieldset><legend>O que entra</legend>
        <label class="opt"><input type="radio" name="exp-o" value="lista" checked> <span>O que está na lista agora <small id="exp-n-lista"></small></span></label>
        <label class="opt"><input type="radio" name="exp-o" value="sel"> <span>Os itens selecionados <small id="exp-n-sel"></small></span></label>
        <label class="opt"><input type="radio" name="exp-o" value="livro"> <span>Um livro <select id="exp-livro" aria-label="Livro"></select></span></label>
      </fieldset>
      <fieldset><legend>Incluir</legend>
        <label class="opt"><input type="checkbox" id="exp-notas" checked> Notas</label>
        <label class="opt"><input type="checkbox" id="exp-marcacoes" checked> Marcações</label>
        <label class="opt"><input type="checkbox" id="exp-favoritos" checked> Favoritos</label>
        <label class="opt"><input type="checkbox" id="exp-texto" checked> Texto de cada versículo (Bíblia Livre)</label>
        <label class="opt"><input type="checkbox" id="exp-inter"> Interlinear das palavras marcadas no original</label>
      </fieldset>
      <fieldset><legend>Ordem</legend>
        <label class="opt"><input type="radio" name="exp-ordem" value="biblica" checked> Bíblica</label>
        <label class="opt"><input type="radio" name="exp-ordem" value="data"> Por data</label>
      </fieldset>
      <button class="exp-gerar" id="exp-gerar">Gerar PDF</button>
      <p class="exp-nota" id="exp-nota">Gerado no próprio aparelho, sem internet. Na janela de impressão, escolha “Salvar como PDF”.</p>
    </div>`;
  document.body.appendChild(exportSheet);
  async function openExport() {
    const { listSheet: xs } = await itens();
    const livros = [...new Set(xs.filter(x => x.a).map(x => x.a.livro))].sort((a, b) => bookOrder(a) - bookOrder(b));
    $("#exp-livro").innerHTML = livros.map(c => `<option value="${c}">${esc(bookName(c))}</option>`).join("");
    $("#exp-n-lista").textContent = `(${lastItems.length})`;
    $("#exp-n-sel").textContent = `(${selected.size})`;
    $('input[name="exp-o"][value="sel"]').disabled = !selected.size;
    $('input[name="exp-o"][value="livro"]').disabled = !livros.length;
    $('input[name="exp-o"][value="' + (selected.size ? "sel" : "lista") + '"]').checked = true;
    listSheet.hidden = true;
    document.body.classList.remove("com-minhas");
    exportSheet.hidden = false;
    $("#exp-gerar").focus();
  }
  function closeExport(goBack = true) {
    exportSheet.hidden = true;
    if (goBack) openList(listFilter);
  }
  exportSheet.addEventListener("click", e => {
    if (e.target.closest("[data-fechar]")) return closeExport();
    if (e.target.closest("#exp-gerar")) return buildNotebook();
  });
  exportSheet.addEventListener("change", e => {
    if (e.target.id === "exp-livro") $('input[name="exp-o"][value="livro"]').checked = true;
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
    const { listSheet: todosXs } = await itens();
    const o = $('input[name="exp-o"]:checked').value;
    let xs =
      o === "sel"
        ? todosXs.filter(x => selected.has(x.id))
        : o === "livro"
          ? todosXs.filter(x => x.a?.livro === $("#exp-livro").value)
          : todosXs.filter(x => lastItems.some(y => y.id === x.id));
    const inc = { notas: $("#exp-notas").checked, marcacoes: $("#exp-marcacoes").checked, favoritos: $("#exp-favoritos").checked };
    xs = xs.filter(x => inc[x.tipo]);
    const texto = $("#exp-texto").checked,
      withInterlinear = $("#exp-inter").checked;
    const byDate = $('input[name="exp-ordem"]:checked').value === "data";
    // agrupa por versículo (ou nota livre)
    const grupos = new Map();
    for (const x of xs) {
      const k = x.a ? `${x.a.livro}.${x.a.cap}.${x.a.ver}` : `livre.${x.id}`;
      if (!grupos.has(k)) grupos.set(k, { a: x.a, itens: [], data: x.data });
      const g = grupos.get(k);
      g.itens.push(x);
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
      const kinds = [...new Set(g.itens.map(x => x.rot))].join(" · ").toUpperCase();
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
          const greek = a.livro && (window.__livros || {})[a.livro]?.i >= 39;
          bodyHtml += `<p class="il"><span class="o" dir="${greek ? "ltr" : "rtl"}" lang="${greek ? "grc" : "he"}">${esc(ws.map(w => w[0].replace(/\//g, "")).join(" "))}</span> <span class="ig">${esc(ws.map(w => `${w[1]} · ${w[2]}`).join("; "))}</span></p>`;
        }
      }
      for (const x of g.itens) {
        if (x.tipo === "notas")
          bodyHtml += `<div class="nt">${x.titulo ? `<b>${esc(x.titulo)}</b><br>` : ""}${esc(x.texto).replace(/\n/g, "<br>")}</div>`;
        else if (x.tipo === "marcacoes" && x.a.camada === "blivre" && !texto)
          bodyHtml += `<p class="vt"><mark style="background:${colorHex[x.cor] || "#eee"}">${esc(x.texto)}</mark></p>`;
      }
      const tagList = [...new Set(g.itens.flatMap(x => x.etNomes))];
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
    const btn = $("#exp-gerar");
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
  // Imprime um HTML: no app Android pelo serviço de impressão do sistema (plugin Impressao, que tem "Salvar como PDF");
  // no navegador, por um iframe escondido e a janela de impressão.
  async function printHtml(html, titulo) {
    const Cap = window.Capacitor,
      isNative = Cap?.isNativePlatform?.();
    const plug = isNative && (Cap.Plugins?.Impressao || Cap.registerPlugin?.("Impressao"));
    if (plug && Cap.getPlatform?.() === "android") {
      try {
        await plug.printHtml({ html, titulo });
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
    if (window.__semImprimir) return; // testes automáticos: só monta o caderno
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
    await pronto;
    const payload = { formato: "biblia-interlinear-anotacoes", versao: 1, exportado_em: new Date().toISOString(), aparelho, colecoes: {} };
    for (const c of SYNCED) payload.colecoes[c] = db ? await db[c].toArray() : [...memory[c].values()];
    const json = JSON.stringify(payload, null, 1);
    const nome = `biblia-interlinear-anotacoes-${payload.exportado_em.slice(0, 10)}.json`;
    window.__ultimoBackup = payload;
    const Cap = window.Capacitor;
    if (Cap?.isNativePlatform?.() && Cap.Plugins?.Filesystem && Cap.Plugins?.Share) {
      try {
        const r = await Cap.Plugins.Filesystem.writeFile({ path: nome, data: json, directory: "CACHE", encoding: "utf8" });
        await Cap.Plugins.Share.share({ title: "Minhas anotações", files: [r.uri] });
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
  // Junta o arquivo com o que já está no aparelho: registro novo entra; registro que já existe fica com a versão mais recente.
  async function importData(payload) {
    if (!payload || payload.formato !== "biblia-interlinear-anotacoes" || !payload.colecoes)
      throw new Error("Este arquivo não é um backup de anotações da Bíblia Interlinear.");
    await pronto;
    let added = 0,
      updated = 0,
      same = 0;
    for (const c of SYNCED) {
      for (const r of payload.colecoes[c] || []) {
        const res = await merge(c, r);
        if (res === "novo") added++;
        else if (res === "atualizado") updated++;
        else if (res === "igual") same++;
      }
    }
    notify();
    paint();
    return { added, updated, same };
  }

  // ---------- mescla (backup e sincronização) ----------
  // Junta um registro vindo de fora: vence o relógio maior (a mesma versão aplicada duas vezes não muda nada).
  // Nota editada nos dois lados ao mesmo tempo — a daqui ainda não enviada e a de fora não partiu da versão daqui —
  // vira duas: a vencedora fica com o id e a outra vira uma cópia "(conflito de dd/mm)". Nenhum texto se perde.
  const pendingCall = async (c, id) => (db ? (await db.fila.where("id").equals(id).count()) > 0 : false);
  const isNoteConflict = (localRec, remoteRec, pendingFlag) =>
    pendingFlag &&
    !localRec.apagado &&
    !remoteRec.apagado &&
    remoteRec.base !== localRec.relogio &&
    ((localRec.texto || "") !== (remoteRec.texto || "") || (localRec.titulo || "") !== (remoteRec.titulo || ""));
  async function conflictCopy(n) {
    const d = new Date(Number((n.relogio || "").split("-")[0]) || Date.now());
    const quando = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const copy = { ...n, id: uuid(), titulo: `${n.titulo || "Nota"} (conflito de ${quando})` };
    delete copy.relogio;
    delete copy.base;
    delete copy.criado_em;
    return save("notas", copy);
  }
  async function merge(c, r, { fromCloud = false } = {}) {
    if (!r || !r.id || !SYNCED.includes(c)) return "ignorado";
    await pronto;
    const currentChapter = db ? await db[c].get(r.id) : memory[c].get(r.id);
    if (r.relogio) relogio(r.relogio.split("-").slice(0, 2).join("-"));
    if (currentChapter && (currentChapter.relogio || "") >= (r.relogio || "")) {
      if (c === "notas" && currentChapter.relogio !== r.relogio && isNoteConflict(currentChapter, r, await pendingCall(c, r.id)))
        await conflictCopy(r);
      return "igual";
    }
    const conflict = c === "notas" && currentChapter && isNoteConflict(currentChapter, r, await pendingCall(c, r.id));
    const fresh = { ...r };
    delete fresh.local;
    if (db)
      await db.transaction("rw", db[c], db.fila, async () => {
        await db[c].put(fresh);
        if (fromCloud)
          await db.fila.where("id").equals(r.id).delete(); // a versão daqui perdeu: não reenviar
        else await db.fila.add({ colecao: c, id: r.id });
      });
    else memory[c].set(r.id, fresh);
    if (conflict) await conflictCopy(currentChapter);
    return currentChapter ? "atualizado" : "novo";
  }
  // Acesso de baixo nível para a sincronização (web/sincronizar.js)
  const storage = {
    colecoes: SYNCED,
    aparelho,
    persistente: () => !!db,
    async fila() {
      await pronto;
      return db ? db.fila.toArray() : [];
    },
    async tirarDaFila(seqs) {
      await pronto;
      if (db && seqs.length) await db.fila.bulkDelete(seqs);
    },
    async readStorage(c, id) {
      await pronto;
      return db ? db[c].get(id) : memory[c].get(id);
    },
    async brutos(c) {
      await pronto;
      return db ? db[c].toArray() : [...memory[c].values()];
    },
    merge,
    aplicado() {
      notify();
      paint();
    },
    async estado(k, v) {
      await pronto;
      if (!db) {
        if (v !== undefined) memoryState[k] = v;
        return memoryState[k];
      }
      if (v === undefined) return (await db.estado.get(k))?.valor;
      await db.estado.put({ chave: k, valor: v });
      return v;
    },
    async purgar(c, ids) {
      await pronto;
      if (db) await db[c].bulkDelete(ids);
      else ids.forEach(i => memory[c].delete(i));
    },
    // "Manter só neste aparelho": o que já existe não sobe para a conta (até ser editado de novo)
    async soNesteAparelho() {
      await pronto;
      if (!db) return;
      await db.transaction("rw", [...SYNCED.map(c => db[c]), db.fila], async () => {
        for (const c of SYNCED)
          await db[c].toCollection().modify(r => {
            r.local = true;
          });
        await db.fila.clear();
      });
    },
    // "Enviar para a conta": tudo o que existe aqui (menos o marcado "só neste aparelho") entra na fila
    async enfileirarTudo() {
      await pronto;
      if (!db) return;
      await db.transaction("rw", [...SYNCED.map(c => db[c]), db.fila], async () => {
        for (const c of SYNCED) {
          const ids = (await db[c].toArray()).filter(r => !r.local).map(r => ({ colecao: c, id: r.id }));
          if (ids.length) await db.fila.bulkAdd(ids);
        }
      });
    },
    async apagarTudo() {
      await pronto;
      if (db)
        await db.transaction("rw", [...SYNCED.map(c => db[c]), db.fila], async () => {
          for (const c of SYNCED) await db[c].clear();
          await db.fila.clear();
        });
      else SYNCED.forEach(c => memory[c].clear());
      notify();
      paint();
    }
  };
  $("#mn-arquivo").addEventListener("change", async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const r = await importData(JSON.parse(await f.text()));
      toastMsg(`Importado: ${r.added} novos, ${r.updated} atualizados, ${r.same} já estavam aqui.`);
      renderList();
    } catch (err) {
      toastMsg(err.message.startsWith("Este arquivo") ? err.message : "Não foi possível ler o arquivo.");
    }
  });

  let toastMsgTimer = 0;
  function toastMsg(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastMsgTimer);
    toastMsgTimer = setTimeout(
      () => {
        t.hidden = true;
      },
      Math.max(3500, msg.length * 70)
    );
  }

  // ---------- integração com o leitor ----------
  document.addEventListener("capitulo", e => {
    currentChapter = e.detail;
    closeBar();
    paint();
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !bar.hidden) closeBar();
  });
  window.Anotacoes = {
    openList,
    openNote,
    closeBar,
    paint,
    allRecords,
    save,
    apagar,
    importData,
    downloadData,
    assembleNotebook,
    printHtml,
    contar: async () => (await Promise.all(["notas", "marcacoes", "favoritos"].map(allRecords))).reduce((s, l) => s + l.length, 0),
    aoMudar: f => listeners.push(f),
    exportar: async () => Object.fromEntries(await Promise.all(COLLECTIONS.map(async c => [c, await allRecords(c)]))),
    local: () => !!db,
    storage
  };
  if (currentChapter === null && window.__capituloAtual) {
    currentChapter = window.__capituloAtual;
    paint();
  }
})();
