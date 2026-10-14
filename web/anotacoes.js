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
  const CORES = [
    { id: "amarelo", nome: "Amarelo" }, { id: "verde", nome: "Verde" }, { id: "azul", nome: "Azul" },
    { id: "rosa", nome: "Rosa" }, { id: "laranja", nome: "Laranja" }
  ];
  const EDICAO = (window.DATA_EDICAO || "").slice(0, 10);

  // ---------- identificadores, relógio e aparelho ----------
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
  }));
  let aparelho;
  try { aparelho = localStorage.getItem("interlinear:aparelho"); if (!aparelho) { aparelho = uuid().slice(0, 8); localStorage.setItem("interlinear:aparelho", aparelho); } }
  catch (_) { aparelho = uuid().slice(0, 8); }
  // Relógio lógico híbrido: milissegundos + contador + aparelho. Ordena edições mesmo com o relógio do celular errado
  // (avança sempre que se vê uma mudança mais nova de outro aparelho — usado pela sincronização).
  let hlc = { t: 0, c: 0 };
  function relogio(visto) {
    const agora = Date.now();
    if (visto) { const [vt, vc] = visto.split("-").map(Number); if (vt > hlc.t || (vt === hlc.t && vc > hlc.c)) hlc = { t: vt, c: vc }; }
    if (agora > hlc.t) hlc = { t: agora, c: 0 }; else hlc.c++;
    return `${String(hlc.t).padStart(14, "0")}-${String(hlc.c).padStart(4, "0")}-${aparelho}`;
  }

  // ---------- banco local ----------
  const COLECOES = ["marcacoes", "notas", "favoritos", "etiquetas"];
  let db = null, memoria = null;
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
  } catch (_) { db = null; }
  async function aberto() {
    if (memoria) return false;
    if (!db) { memoria = Object.fromEntries(COLECOES.map(c => [c, new Map()])); return false; }
    try { await db.open(); return true; }
    catch (_) { db = null; memoria = Object.fromEntries(COLECOES.map(c => [c, new Map()])); return false; }
  }
  const pronto = aberto();
  async function todos(col) {
    await pronto;
    const lista = db ? await db[col].toArray() : [...memoria[col].values()];
    return lista.filter(r => !r.apagado);
  }
  async function doCapitulo(col, cap) {
    await pronto;
    const lista = db ? await db[col].where("cap").equals(cap).toArray() : [...memoria[col].values()].filter(r => r.cap === cap);
    return lista.filter(r => !r.apagado);
  }
  async function gravar(col, reg) {
    await pronto;
    const agora = new Date().toISOString();
    const antigo = db ? await db[col].get(reg.id) : memoria[col].get(reg.id);
    const novo = { ...antigo, ...reg, criado_em: antigo?.criado_em || agora, alterado_em: agora, base: antigo?.relogio || null, relogio: relogio(), apagado: reg.apagado || false };
    if (db) await db.transaction("rw", db[col], db.fila, async () => { await db[col].put(novo); await db.fila.add({ colecao: col, id: novo.id }); });
    else memoria[col].set(novo.id, novo);
    avisar();
    return novo;
  }
  const apagar = (col, id) => gravar(col, { id, apagado: true });
  let ouvintes = [];
  function avisar() { ouvintes.forEach(f => { try { f(); } catch (_) {} }); }

  // ---------- âncoras ----------
  const capDe = a => `${a.livro}.${a.cap}`;
  const chave = a => `${a.livro}.${a.cap}.${a.ver}:${a.camada}:${a.camada === "versiculo" ? "" : `${a.inicio ?? ""}-${a.fim ?? ""}`}`;
  function ancoraVersiculo(cod, cap, v) { return { livro: cod, cap, ver: v, ver_fim: v, camada: "versiculo", edicao: EDICAO }; }

  // ---------- estado do capítulo atual (vem do leitor) ----------
  let atual = null; // { cod, cap, nome, verses: [{ n, blivre, words: [{ heb }] }] }
  let selecao = null; // { ancora, rotulo, trecho }
  const raiz = () => document.getElementById("verses");
  const versoEl = n => document.getElementById("v" + n);
  const viDe = n => atual ? atual.verses.findIndex(v => v.n === n) : -1;
  const rotuloRef = a => `${a.abrev || atual?.abrev || a.livro} ${a.cap}:${a.ver}`;

  // Desenha as marcações do capítulo nos versículos (cores, notas, favoritos)
  async function pintar() {
    if (!atual || !raiz()) return;
    const cap = `${atual.cod}.${atual.cap}`;
    const [ms, ns, fs] = await Promise.all([doCapitulo("marcacoes", cap), doCapitulo("notas", cap), doCapitulo("favoritos", cap)]);
    if (!atual || cap !== `${atual.cod}.${atual.cap}`) return;
    $$(".verse", raiz()).forEach(sec => {
      sec.classList.remove(...CORES.map(c => "mk-" + c.id));
      $$(".word", sec).forEach(w => w.classList.remove(...CORES.map(c => "mk-" + c.id)));
      const vi = +sec.dataset.vi, v = atual.verses[vi];
      const bl = $(".blivre", sec);
      if (bl && v) { bl._marcas = []; bl.innerHTML = `<span class="tag">BLIVRE</span>${esc(v.blivre)}`; }
      sec.classList.remove("mk-deslocada");
      const tags = $(".vtags", sec);
      if (tags) tags.innerHTML = "";
    });
    for (const m of ms) {
      if (!m.cor) continue;
      const a = m.ancora, sec = versoEl(a.ver);
      if (!sec) continue;
      if (a.camada === "versiculo") sec.classList.add("mk-" + m.cor);
      else if (a.camada === "original") {
        for (let i = a.inicio; i <= a.fim; i++) $(`.word[data-i="${i}"]`, sec)?.classList.add("mk-" + m.cor);
      } else if (a.camada === "blivre") marcarTrecho(sec, a, m.cor);
    }
    const porVerso = {};
    for (const n of ns) { const k = n.ancora.ver; (porVerso[k] = porVerso[k] || { n: 0, f: false }).n++; }
    for (const f of fs) { const k = f.ancora.ver; (porVerso[k] = porVerso[k] || { n: 0, f: false }).f = true; }
    for (const [ver, info] of Object.entries(porVerso)) {
      const sec = versoEl(ver), tags = sec && $(".vtags", sec);
      if (!tags) continue;
      tags.innerHTML = (info.f ? `<span class="vfav" title="Favorito" aria-label="Favorito">★</span>` : "")
        + (info.n ? `<button class="vnota" data-ver="${ver}" aria-label="${info.n} ${info.n === 1 ? "nota" : "notas"} neste versículo">${ICONE.nota}<span aria-hidden="true">${info.n > 1 ? info.n : ""}</span></button>` : "");
    }
  }
  // Marca um trecho da Bíblia Livre; se o texto mudou, procura o trecho guardado; não achou: marca o versículo inteiro
  function marcarTrecho(sec, a, cor) {
    const vi = +sec.dataset.vi, txt = atual.verses[vi]?.blivre || "";
    let i = a.inicio, f = a.fim;
    if (txt.slice(i, f) !== a.trecho) {
      const k = a.trecho ? txt.indexOf(a.trecho) : -1;
      if (k < 0) { sec.classList.add("mk-" + cor, "mk-deslocada"); return; }
      i = k; f = k + a.trecho.length;
    }
    const bl = $(".blivre", sec);
    const html = bl.innerHTML;
    const corpo = html.slice(html.indexOf("</span>") + 7);
    // corpo já é texto escapado com possíveis <mark> anteriores: refaz a partir do texto puro com todas as marcas do verso
    const marcas = (bl._marcas = (bl._marcas || []).concat([{ i, f, cor }]));
    let out = "", pos = 0;
    const ordenadas = [...marcas].sort((x, y) => x.i - y.i);
    for (const m of ordenadas) {
      if (m.i < pos) continue;
      out += esc(txt.slice(pos, m.i)) + `<mark class="mk mk-${m.cor}">${esc(txt.slice(m.i, m.f))}</mark>`;
      pos = m.f;
    }
    out += esc(txt.slice(pos));
    bl.innerHTML = `<span class="tag">BLIVRE</span>${out}`;
    void corpo;
  }

  // ---------- barra de marcação ----------
  const ICONE = {
    nota: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 4h14v12l-4 4H5z"/><path d="M9 9h6M9 13h4"/></svg>',
    fav: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
    tag: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
    copiar: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    camadas: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    fechar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const barra = document.createElement("div");
  barra.id = "mbar"; barra.className = "mbar"; barra.hidden = true;
  barra.setAttribute("role", "dialog"); barra.setAttribute("aria-label", "Marcar e anotar");
  barra.innerHTML = `
    <div class="mb-top"><b id="mb-ref"></b><span id="mb-trecho"></span><button class="mb-x" id="mb-fechar" aria-label="Fechar">${ICONE.fechar}</button></div>
    <div class="mb-cores" role="group" aria-label="Cor da marcação">
      ${CORES.map(c => `<button class="mb-cor mk-${c.id}" data-cor="${c.id}" aria-pressed="false" aria-label="${c.nome}"></button>`).join("")}
      <button class="mb-cor mb-sem" data-cor="" aria-label="Tirar a marcação">${ICONE.fechar}</button>
    </div>
    <div class="mb-acoes">
      <button data-acao="nota">${ICONE.nota}<span>Nota</span></button>
      <button data-acao="fav" aria-pressed="false">${ICONE.fav}<span>Favoritar</span></button>
      <button data-acao="etiqueta">${ICONE.tag}<span>Etiqueta</span></button>
      <button data-acao="copiar">${ICONE.copiar}<span>Copiar</span></button>
      <button data-acao="camadas" hidden>${ICONE.camadas}<span>Interlinear</span></button>
    </div>
    <div class="mb-etiquetas" id="mb-etiquetas" hidden></div>`;
  document.body.appendChild(barra);

  async function abrirBarra(ancora, rotulo, trecho) {
    selecao = { ancora, rotulo, trecho };
    $("#mb-ref").textContent = rotulo;
    $("#mb-trecho").textContent = trecho ? `“${trecho.length > 60 ? trecho.slice(0, 58) + "…" : trecho}”` : "";
    $("#mb-etiquetas").hidden = true;
    const m = await marcacaoDe(ancora);
    $$(".mb-cor", barra).forEach(b => b.setAttribute("aria-pressed", String(!!m && m.cor === b.dataset.cor && !!b.dataset.cor)));
    const f = await favoritoDe(ancora.livro, ancora.cap, ancora.ver);
    $('[data-acao="fav"]', barra).setAttribute("aria-pressed", String(!!f));
    $('[data-acao="fav"] span', barra).textContent = f ? "Favorito" : "Favoritar";
    $('[data-acao="camadas"]', barra).hidden = !document.body.classList.contains("hide-orig");
    barra.hidden = false;
    document.body.classList.add("com-mbar");
    $(".mb-cor", barra).focus({ preventScroll: true });
  }
  function fecharBarra() {
    if (barra.hidden) return;
    barra.hidden = true; selecao = null;
    document.body.classList.remove("com-mbar");
  }
  async function marcacaoDe(a) {
    const k = chave(a);
    return (await doCapitulo("marcacoes", capDe(a))).find(m => chave(m.ancora) === k) || null;
  }
  async function favoritoDe(livro, cap, ver) {
    return (await doCapitulo("favoritos", `${livro}.${cap}`)).find(f => f.ancora.ver === ver) || null;
  }
  barra.addEventListener("click", async e => {
    if (!selecao) return;
    const a = selecao.ancora;
    if (e.target.closest("#mb-fechar")) return fecharBarra();
    const cor = e.target.closest(".mb-cor");
    if (cor) {
      const m = await marcacaoDe(a);
      if (!cor.dataset.cor) { if (m) { if (m.etiquetas?.length) await gravar("marcacoes", { id: m.id, cor: null }); else await apagar("marcacoes", m.id); } }
      else await gravar("marcacoes", { id: m?.id || uuid(), cap: capDe(a), ancora: a, cor: cor.dataset.cor, etiquetas: m?.etiquetas || [] });
      await pintar();
      $$(".mb-cor", barra).forEach(b => b.setAttribute("aria-pressed", String(!!cor.dataset.cor && b === cor)));
      return;
    }
    const acao = e.target.closest("[data-acao]")?.dataset.acao;
    if (acao === "nota") { const s = selecao; fecharBarra(); return abrirNota(null, s.ancora, s.trecho); }
    if (acao === "fav") {
      const f = await favoritoDe(a.livro, a.cap, a.ver);
      if (f) await apagar("favoritos", f.id);
      else await gravar("favoritos", { id: uuid(), cap: capDe(a), ancora: ancoraVersiculo(a.livro, a.cap, a.ver), etiquetas: [] });
      await pintar();
      return abrirBarra(a, selecao.rotulo, selecao.trecho);
    }
    if (acao === "etiqueta") return mostrarEtiquetas();
    if (acao === "copiar") {
      const v = atual?.verses.find(x => x.n === a.ver);
      const texto = `${selecao.trecho || v?.blivre || ""} (${atual?.nome || a.livro} ${a.cap}:${a.ver}, Bíblia Livre)`;
      try { await navigator.clipboard.writeText(texto); aviso("Copiado."); } catch (_) { aviso("Não foi possível copiar neste navegador."); }
      return fecharBarra();
    }
    if (acao === "camadas") { versoEl(a.ver)?.classList.toggle("abrir"); return fecharBarra(); }
    const et = e.target.closest("[data-etiqueta]");
    if (et) return alternarEtiqueta(et.dataset.etiqueta);
    if (e.target.closest("#mb-nova-et")) {
      const campo = $("#mb-et-nome");
      const nome = campo.value.trim();
      if (!nome) return campo.focus();
      const existe = (await todos("etiquetas")).find(x => x.nome.toLowerCase() === nome.toLowerCase());
      const t = existe || await gravar("etiquetas", { id: uuid(), nome, cor: null });
      await alternarEtiqueta(t.id, true);
    }
  });
  barra.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); fecharBarra(); }
    if (e.key === "Enter" && e.target.id === "mb-et-nome") { e.preventDefault(); $("#mb-nova-et").click(); }
  });
  async function mostrarEtiquetas() {
    const box = $("#mb-etiquetas");
    const ets = (await todos("etiquetas")).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
    const m = await marcacaoDe(selecao.ancora);
    const tem = new Set(m?.etiquetas || []);
    box.innerHTML = `<div class="mb-et-lista">${ets.map(t => `<button class="chip" data-etiqueta="${t.id}" aria-pressed="${tem.has(t.id)}">${esc(t.nome)}</button>`).join("") || '<span class="mb-vazio">Nenhuma etiqueta ainda.</span>'}</div>
      <div class="mb-et-nova"><label class="sr" for="mb-et-nome">Nova etiqueta</label><input id="mb-et-nome" type="text" placeholder="Nova etiqueta (ex.: promessas)" autocomplete="off"><button id="mb-nova-et">Criar</button></div>`;
    box.hidden = false;
    (ets.length ? $(".chip", box) : $("#mb-et-nome")).focus();
  }
  async function alternarEtiqueta(id, ligar) {
    const a = selecao.ancora;
    const m = await marcacaoDe(a);
    const lista = new Set(m?.etiquetas || []);
    const on = ligar ?? !lista.has(id);
    if (on) lista.add(id); else lista.delete(id);
    if (m) {
      if (!m.cor && !lista.size) await apagar("marcacoes", m.id);
      else await gravar("marcacoes", { id: m.id, etiquetas: [...lista] });
    } else if (lista.size) await gravar("marcacoes", { id: uuid(), cap: capDe(a), ancora: a, cor: null, etiquetas: [...lista] });
    await mostrarEtiquetas();
  }

  // ---------- gestos: botão do versículo, toque longo, seleção de texto ----------
  function ancoraBlivre(sec) {
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
    const ini = pre.toString().length - off, trecho = r.toString();
    if (ini < 0 || !trecho.trim()) return null;
    return { inicio: ini, fim: ini + trecho.length, trecho };
  }
  function abrirParaVerso(sec, camada, extra) {
    const vi = +sec.dataset.vi, v = atual.verses[vi];
    if (!v) return;
    const a = { ...ancoraVersiculo(atual.cod, atual.cap, v.n), ...extra, camada };
    if (camada === "versiculo") a.trecho = (v.blivre || "").slice(0, 200);
    const trecho = camada === "versiculo" ? "" : extra.trecho;
    abrirBarra(a, `${atual.nome} ${atual.cap}:${v.n}`, trecho);
  }
  document.addEventListener("click", e => {
    const b = e.target.closest(".vmark");
    if (b) { const sec = b.closest(".verse"); const s = sec && ancoraBlivre(sec); return abrirParaVerso(sec, s ? "blivre" : "versiculo", s || {}); }
    const n = e.target.closest(".vnota");
    if (n) return abrirNotasDoVerso(+n.dataset.ver);
  });
  // Toque longo num cartão do original: marca a palavra. Toque longo no versículo: marca o versículo.
  let timer = 0, alvo = null, longo = false;
  document.addEventListener("pointerdown", e => {
    const sec = e.target.closest && e.target.closest("#verses .verse");
    if (!sec || e.button > 0 || e.target.closest(".say, .vmark, .vnota, details")) return;
    alvo = e.target.closest(".word") || sec; longo = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      longo = true;
      if (alvo.classList.contains("word")) {
        const i = +alvo.dataset.i;
        const v = atual.verses[+alvo.dataset.v];
        abrirParaVerso(alvo.closest(".verse"), "original", { inicio: i, fim: i, trecho: v?.words[i]?.heb || "" });
      } else if (!document.body.classList.contains("hide-orig") || !window.getSelection()?.toString()) {
        if (!window.getSelection()?.toString()) abrirParaVerso(sec, "versiculo", {});
      }
    }, 550);
  }, true);
  ["pointerup", "pointercancel", "pointermove"].forEach(ev => document.addEventListener(ev, e => {
    if (ev === "pointermove" && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
    clearTimeout(timer);
  }, true));
  // O clique que termina um toque longo não abre o verbete
  document.addEventListener("click", e => { if (longo && e.target.closest("#verses .word")) { e.stopPropagation(); e.preventDefault(); longo = false; } }, true);
  // No celular o toque longo vira "contextmenu" (e o navegador cancela o pointer); no computador, é o botão direito.
  document.addEventListener("contextmenu", e => {
    const sec = e.target.closest && e.target.closest("#verses .verse");
    if (!sec) return;
    clearTimeout(timer);
    const s = ancoraBlivre(sec);
    if (s) { e.preventDefault(); return abrirParaVerso(sec, "blivre", s); }
    const w = e.target.closest(".word");
    if (w) {
      e.preventDefault(); longo = true;
      const i = +w.dataset.i, v = atual.verses[+w.dataset.v];
      return abrirParaVerso(sec, "original", { inicio: i, fim: i, trecho: v?.words[i]?.heb || "" });
    }
    if (!e.target.closest("a, input, textarea") && !window.getSelection()?.toString()) { e.preventDefault(); abrirParaVerso(sec, "versiculo", {}); }
  });
  // Selecionar texto da Bíblia Livre mostra a barra (no celular, depois que a seleção para)
  let selTimer = 0;
  document.addEventListener("selectionchange", () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const sec = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest("#verses .verse");
      if (!sec || !barra.hidden && selecao?.ancora.camada === "blivre") return;
      const s = ancoraBlivre(sec);
      if (s) abrirParaVerso(sec, "blivre", s);
    }, 700);
  });

  // ---------- editor de nota ----------
  const nota = document.createElement("aside");
  nota.id = "nota"; nota.className = "sheet right nota-sheet"; nota.hidden = true;
  nota.setAttribute("role", "dialog"); nota.setAttribute("aria-modal", "true"); nota.setAttribute("aria-labelledby", "nota-h");
  nota.innerHTML = `
    <div class="shead"><h2 id="nota-h">Nota</h2><button class="ibtn" data-fechar aria-label="Fechar nota">${ICONE.fechar}</button></div>
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
  let notaAtual = null, salvarTimer = 0, voltarFoco = null;
  async function abrirNota(id, ancora, trecho) {
    voltarFoco = document.activeElement;
    const todasN = await todos("notas");
    notaAtual = id ? todasN.find(n => n.id === id) : { id: uuid(), cap: ancora ? capDe(ancora) : "livre", ancora: ancora || null, titulo: "", texto: "", etiquetas: [], nova: true };
    if (!notaAtual) return;
    const a = notaAtual.ancora;
    $("#nota-ref").textContent = a ? `${nomeLivro(a.livro)} ${a.cap}:${a.ver}${trecho || a.trecho ? ` · “${(trecho || a.trecho).slice(0, 80)}”` : ""}` : "Nota livre";
    $("#nota-titulo").value = notaAtual.titulo || "";
    $("#nota-texto").value = notaAtual.texto || "";
    $("#nota-estado").textContent = notaAtual.nova ? "" : "Salva.";
    $("#nota-apagar").hidden = !!notaAtual.nova;
    await desenharEtiquetasNota();
    nota.hidden = false;
    document.body.classList.add("com-nota");
    $("#nota-texto").focus();
  }
  async function desenharEtiquetasNota() {
    const ets = (await todos("etiquetas")).sort((x, y) => x.nome.localeCompare(y.nome, "pt"));
    const tem = new Set(notaAtual.etiquetas || []);
    $("#nota-ets").innerHTML = `<span class="nota-ets-r">Etiquetas:</span>` + ets.map(t => `<button class="chip" data-et="${t.id}" aria-pressed="${tem.has(t.id)}">${esc(t.nome)}</button>`).join("")
      + `<span class="nota-et-nova"><label class="sr" for="nota-et-nome">Nova etiqueta</label><input id="nota-et-nome" type="text" placeholder="+ nova etiqueta" autocomplete="off"><button class="chip" data-et-nova>Criar</button></span>`;
  }
  function agendarSalvar() {
    clearTimeout(salvarTimer);
    $("#nota-estado").textContent = "…";
    salvarTimer = setTimeout(salvarNota, 600);
  }
  async function salvarNota() {
    if (!notaAtual) return;
    const titulo = $("#nota-titulo").value.trim(), texto = $("#nota-texto").value;
    if (notaAtual.nova && !titulo && !texto.trim()) { $("#nota-estado").textContent = ""; return; }
    const { nova, ...reg } = notaAtual;
    notaAtual = { ...(await gravar("notas", { ...reg, titulo, texto })) };
    $("#nota-estado").textContent = "Salva.";
    $("#nota-apagar").hidden = false;
    pintar();
  }
  function fecharNota() {
    if (nota.hidden) return;
    clearTimeout(salvarTimer);
    salvarNota();
    nota.hidden = true; notaAtual = null;
    document.body.classList.remove("com-nota");
    if (voltarFoco && voltarFoco.isConnected) voltarFoco.focus({ preventScroll: true });
  }
  $("#nota-titulo").addEventListener("input", agendarSalvar);
  $("#nota-texto").addEventListener("input", agendarSalvar);
  nota.addEventListener("click", async e => {
    if (e.target.closest("[data-fechar]")) return fecharNota();
    if (e.target.closest("#nota-apagar")) {
      if (!confirmarApagar()) return;
      await apagar("notas", notaAtual.id); notaAtual = null; await pintar(); return fecharNota();
    }
    const b = e.target.closest("[data-et]");
    if (b) {
      const set = new Set(notaAtual.etiquetas || []);
      set.has(b.dataset.et) ? set.delete(b.dataset.et) : set.add(b.dataset.et);
      notaAtual.etiquetas = [...set];
      await salvarNota(); return desenharEtiquetasNota();
    }
    if (e.target.closest("[data-et-nova]")) {
      const nome = $("#nota-et-nome").value.trim();
      if (!nome) return $("#nota-et-nome").focus();
      const existe = (await todos("etiquetas")).find(x => x.nome.toLowerCase() === nome.toLowerCase());
      const t = existe || await gravar("etiquetas", { id: uuid(), nome, cor: null });
      notaAtual.etiquetas = [...new Set([...(notaAtual.etiquetas || []), t.id])];
      await salvarNota(); return desenharEtiquetasNota();
    }
  });
  nota.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); fecharNota(); }
    if (e.key === "Enter" && e.target.id === "nota-et-nome") { e.preventDefault(); $("[data-et-nova]", nota).click(); }
  });
  // Confirmação simples sem diálogo do navegador (o botão vira "Confirmar")
  let confirmar = 0;
  function confirmarApagar() {
    const b = $("#nota-apagar");
    if (Date.now() - confirmar < 4000) { confirmar = 0; b.textContent = "Apagar nota"; return true; }
    confirmar = Date.now(); b.textContent = "Toque de novo para apagar"; setTimeout(() => { b.textContent = "Apagar nota"; }, 4000);
    return false;
  }
  async function abrirNotasDoVerso(ver) {
    const ns = (await doCapitulo("notas", `${atual.cod}.${atual.cap}`)).filter(n => n.ancora?.ver === ver).sort((x, y) => x.criado_em.localeCompare(y.criado_em));
    if (ns.length === 1) return abrirNota(ns[0].id);
    abrirLista({ cap: `${atual.cod}.${atual.cap}`, ver });
  }

  // ---------- Minhas anotações ----------
  const lista = document.createElement("aside");
  lista.id = "minhas"; lista.className = "sheet right minhas-sheet"; lista.hidden = true;
  lista.setAttribute("role", "dialog"); lista.setAttribute("aria-modal", "true"); lista.setAttribute("aria-labelledby", "minhas-h");
  lista.innerHTML = `
    <div class="shead"><h2 id="minhas-h">Minhas anotações</h2><button class="ibtn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
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
  document.body.appendChild(lista);
  let filtro = { tipo: "", cap: null, ver: null };
  let selecionando = false;
  const selecionados = new Set();
  let ultimosItens = [];
  function nomeLivro(cod) { return (window.__livros || {})[cod]?.nome || cod; }
  function ordemLivro(cod) { return (window.__livros || {})[cod]?.i ?? 999; }
  async function abrirLista(f) {
    filtro = { tipo: "", cap: null, ver: null, ...(f || {}) };
    voltarFoco = document.activeElement;
    document.dispatchEvent(new CustomEvent("anotacoes:abrir-painel"));
    lista.hidden = false;
    document.body.classList.add("com-minhas");
    await desenharLista();
    $("#mn-busca").focus();
  }
  function fecharLista() {
    if (lista.hidden) return;
    lista.hidden = true;
    document.body.classList.remove("com-minhas");
    if (voltarFoco && voltarFoco.isConnected) voltarFoco.focus({ preventScroll: true });
  }
  async function itens() {
    const [ms, ns, fs, ets] = await Promise.all([todos("marcacoes"), todos("notas"), todos("favoritos"), todos("etiquetas")]);
    const nomeEt = Object.fromEntries(ets.map(t => [t.id, t.nome]));
    const ref = a => a ? `${nomeLivro(a.livro)} ${a.cap}:${a.ver}` : "Nota livre";
    const textoVerso = a => a?.trecho || "";
    return {
      ets,
      lista: [
        ...ns.map(n => ({ tipo: "notas", id: n.id, a: n.ancora, rot: "nota", titulo: n.titulo, texto: n.texto, extra: textoVerso(n.ancora), ets: n.etiquetas || [], data: n.alterado_em })),
        ...ms.map(m => ({ tipo: "marcacoes", id: m.id, a: m.ancora, rot: m.cor ? "marcação" : "etiqueta", cor: m.cor, texto: m.ancora.trecho || "", ets: m.etiquetas || [], data: m.alterado_em })),
        ...fs.map(f => ({ tipo: "favoritos", id: f.id, a: f.ancora, rot: "favorito", texto: "", ets: f.etiquetas || [], data: f.alterado_em }))
      ].map(x => ({ ...x, ref: ref(x.a), etNomes: x.ets.map(i => nomeEt[i]).filter(Boolean) })),
    };
  }
  async function desenharLista() {
    const { ets, lista: todosItens } = await itens();
    const sel = $("#mn-etiqueta"), atualEt = sel.value;
    sel.innerHTML = `<option value="">todas</option>` + ets.sort((x, y) => x.nome.localeCompare(y.nome, "pt")).map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join("");
    sel.value = ets.some(t => t.id === atualEt) ? atualEt : "";
    const q = $("#mn-busca").value.trim().toLowerCase();
    let xs = todosItens.filter(x =>
      (!filtro.tipo || x.tipo === filtro.tipo) &&
      (!filtro.cap || (x.a && `${x.a.livro}.${x.a.cap}` === filtro.cap && (filtro.ver == null || x.a.ver === filtro.ver))) &&
      (!sel.value || x.ets.includes(sel.value)) &&
      (!q || `${x.ref} ${x.titulo || ""} ${x.texto} ${x.etNomes.join(" ")}`.toLowerCase().includes(q)));
    $$(".mn-filtros .chip", lista).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tipo === filtro.tipo)));
    if ($("#mn-ordem").value === "data") xs.sort((x, y) => y.data.localeCompare(x.data));
    else xs.sort((x, y) => (x.a ? ordemLivro(x.a.livro) : 1e4) - (y.a ? ordemLivro(y.a.livro) : 1e4) || (x.a?.cap || 0) - (y.a?.cap || 0) || (x.a?.ver || 0) - (y.a?.ver || 0));
    ultimosItens = xs;
    $("#mn-total").textContent = filtro.cap ? `${xs.length} neste versículo · ` : `${xs.length} ${xs.length === 1 ? "item" : "itens"}`;
    if (filtro.cap) $("#mn-total").innerHTML += `<button class="linklike" id="mn-ver-tudo">ver tudo</button>`;
    let grupo = null, html = "";
    for (const x of xs) {
      const g = $("#mn-ordem").value === "data" ? null : (x.a ? nomeLivro(x.a.livro) : "Notas livres");
      if (g !== grupo && g) { html += `<h3 class="mn-grupo">${esc(g)}</h3>`; grupo = g; }
      html += `<button class="mn-item${selecionando ? " sel" : ""}" data-tipo="${x.tipo}" data-id="${x.id}"${selecionando ? ` role="checkbox" aria-checked="${selecionados.has(x.id)}"` : ""}>
        <span class="mn-ref">${esc(x.ref)} · ${x.cor ? `<span class="mn-cor mk-${x.cor}">${x.rot}</span>` : x.rot}</span>
        ${x.titulo ? `<b class="mn-tit">${esc(x.titulo)}</b>` : ""}
        ${x.texto ? `<span class="mn-txt">${esc(x.texto.length > 160 ? x.texto.slice(0, 158) + "…" : x.texto)}</span>` : ""}
        ${x.etNomes.length ? `<span class="mn-ets">${x.etNomes.map(n => `<span class="chip">${esc(n)}</span>`).join("")}</span>` : ""}
      </button>`;
    }
    $("#mn-itens").innerHTML = html || `<p class="mn-vazio">${todosItens.length ? "Nada encontrado com esses filtros." : "Ainda não há anotações. Toque longo num versículo, selecione um trecho ou use o botão ⋯ ao lado do número para marcar e anotar."}</p>`;
  }
  lista.addEventListener("click", async e => {
    if (e.target.closest("[data-fechar]")) return fecharLista();
    const t = e.target.closest(".mn-filtros .chip");
    if (t) { filtro.tipo = t.dataset.tipo; return desenharLista(); }
    if (e.target.closest("#mn-ver-tudo")) { filtro.cap = null; filtro.ver = null; return desenharLista(); }
    if (e.target.closest("#mn-nova")) { fecharLista(); return abrirNota(null, null); }
    if (e.target.closest("#mn-selecionar")) {
      selecionando = !selecionando; if (!selecionando) selecionados.clear();
      e.target.closest("#mn-selecionar").setAttribute("aria-pressed", String(selecionando));
      return desenharLista();
    }
    if (e.target.closest("#mn-exportar")) return abrirExportar();
    if (e.target.closest("#mn-baixar")) return baixarDados();
    if (e.target.closest("#mn-importar")) return $("#mn-arquivo").click();
    const it = e.target.closest(".mn-item");
    if (it && selecionando) {
      selecionados.has(it.dataset.id) ? selecionados.delete(it.dataset.id) : selecionados.add(it.dataset.id);
      it.setAttribute("aria-checked", String(selecionados.has(it.dataset.id)));
      $("#mn-total").textContent = `${selecionados.size} selecionado${selecionados.size === 1 ? "" : "s"}`;
      return;
    }
    if (it) {
      if (it.dataset.tipo === "notas") { fecharLista(); return abrirNota(it.dataset.id); }
      const { lista: xs } = await itens();
      const x = xs.find(y => y.id === it.dataset.id);
      fecharLista();
      if (x?.a) document.dispatchEvent(new CustomEvent("anotacoes:ir", { detail: { cod: x.a.livro, cap: x.a.cap, ver: x.a.ver } }));
    }
  });
  $("#mn-busca").addEventListener("input", () => desenharLista());
  $("#mn-etiqueta").addEventListener("change", () => desenharLista());
  $("#mn-ordem").addEventListener("change", () => desenharLista());
  lista.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); fecharLista(); } });


  // ---------- Exportar em PDF (caderno) ----------
  const exp = document.createElement("aside");
  exp.id = "exportar"; exp.className = "sheet right minhas-sheet"; exp.hidden = true;
  exp.setAttribute("role", "dialog"); exp.setAttribute("aria-modal", "true"); exp.setAttribute("aria-labelledby", "exp-h");
  exp.innerHTML = `
    <div class="shead"><h2 id="exp-h">Exportar em PDF</h2><button class="ibtn" data-fechar aria-label="Fechar">${ICONE.fechar}</button></div>
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
  document.body.appendChild(exp);
  async function abrirExportar() {
    const { lista: xs } = await itens();
    const livros = [...new Set(xs.filter(x => x.a).map(x => x.a.livro))].sort((a, b) => ordemLivro(a) - ordemLivro(b));
    $("#exp-livro").innerHTML = livros.map(c => `<option value="${c}">${esc(nomeLivro(c))}</option>`).join("");
    $("#exp-n-lista").textContent = `(${ultimosItens.length})`;
    $("#exp-n-sel").textContent = `(${selecionados.size})`;
    $('input[name="exp-o"][value="sel"]').disabled = !selecionados.size;
    $('input[name="exp-o"][value="livro"]').disabled = !livros.length;
    $('input[name="exp-o"][value="' + (selecionados.size ? "sel" : "lista") + '"]').checked = true;
    lista.hidden = true; document.body.classList.remove("com-minhas");
    exp.hidden = false;
    $("#exp-gerar").focus();
  }
  function fecharExportar(voltar = true) { exp.hidden = true; if (voltar) abrirLista(filtro); }
  exp.addEventListener("click", e => {
    if (e.target.closest("[data-fechar]")) return fecharExportar();
    if (e.target.closest("#exp-gerar")) return gerarCaderno();
  });
  exp.addEventListener("change", e => { if (e.target.id === "exp-livro") $('input[name="exp-o"][value="livro"]').checked = true; });
  exp.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); fecharExportar(); } });

  async function capitulo(cod, n) {
    try { return window.__carregarCapitulo ? await window.__carregarCapitulo(cod, n) : null; } catch (_) { return null; }
  }
  async function montarCaderno() {
    const { lista: todosXs } = await itens();
    const o = $('input[name="exp-o"]:checked').value;
    let xs = o === "sel" ? todosXs.filter(x => selecionados.has(x.id))
      : o === "livro" ? todosXs.filter(x => x.a?.livro === $("#exp-livro").value)
      : todosXs.filter(x => ultimosItens.some(y => y.id === x.id));
    const inc = { notas: $("#exp-notas").checked, marcacoes: $("#exp-marcacoes").checked, favoritos: $("#exp-favoritos").checked };
    xs = xs.filter(x => inc[x.tipo]);
    const texto = $("#exp-texto").checked, inter = $("#exp-inter").checked;
    const porData = $('input[name="exp-ordem"]:checked').value === "data";
    // agrupa por versículo (ou nota livre)
    const grupos = new Map();
    for (const x of xs) {
      const k = x.a ? `${x.a.livro}.${x.a.cap}.${x.a.ver}` : `livre.${x.id}`;
      if (!grupos.has(k)) grupos.set(k, { a: x.a, itens: [], data: x.data });
      const g = grupos.get(k); g.itens.push(x); if (x.data > g.data) g.data = x.data;
    }
    let gs = [...grupos.values()];
    if (porData) gs.sort((x, y) => y.data.localeCompare(x.data));
    else gs.sort((x, y) => (x.a ? ordemLivro(x.a.livro) : 1e4) - (y.a ? ordemLivro(y.a.livro) : 1e4) || (x.a?.cap || 0) - (y.a?.cap || 0) || (x.a?.ver || 0) - (y.a?.ver || 0));
    const caps = {};
    for (const g of gs) if (g.a && (texto || inter)) { const k = `${g.a.livro}.${g.a.cap}`; if (!(k in caps)) caps[k] = await capitulo(g.a.livro, g.a.cap); }
    const marcasPorVerso = {};
    for (const m of await todos("marcacoes")) { const k = `${m.ancora.livro}.${m.ancora.cap}.${m.ancora.ver}`; (marcasPorVerso[k] = marcasPorVerso[k] || []).push(m); }
    const corHex = { amarelo: "#f6e3a1", verde: "#cfe6c4", azul: "#bcd6e6", rosa: "#f2d2dc", laranja: "#f6d6b8" };
    const livrosNoCaderno = [...new Set(gs.filter(g => g.a).map(g => nomeLivro(g.a.livro)))];
    const titulo = livrosNoCaderno.length === 1 ? livrosNoCaderno[0] : "Minhas anotações";
    let corpo = "", livroAtual = null;
    for (const g of gs) {
      const a = g.a;
      if (!porData && a && nomeLivro(a.livro) !== livroAtual && livrosNoCaderno.length > 1) { livroAtual = nomeLivro(a.livro); corpo += `<h2 class="cl">${esc(livroAtual)}</h2>`; }
      const tipos = [...new Set(g.itens.map(x => x.rot))].join(" · ").toUpperCase();
      corpo += `<section class="en"><div class="ref">${esc(a ? `${nomeLivro(a.livro)} ${a.cap}:${a.ver}` : "NOTA LIVRE")}${tipos ? ` · ${esc(tipos)}` : ""}</div>`;
      const raw = a && caps[`${a.livro}.${a.cap}`];
      const v = raw && raw.v.find(y => y.n === a.ver);
      const ms = a ? (marcasPorVerso[`${a.livro}.${a.cap}.${a.ver}`] || []).filter(m => m.cor) : [];
      if (texto && v) {
        let t = v.b || "";
        const versoInteiro = ms.find(m => m.ancora.camada === "versiculo");
        const trechos = ms.filter(m => m.ancora.camada === "blivre").map(m => {
          let i = m.ancora.inicio, f = m.ancora.fim;
          if (t.slice(i, f) !== m.ancora.trecho) { const k = t.indexOf(m.ancora.trecho); if (k < 0) return null; i = k; f = k + m.ancora.trecho.length; }
          return { i, f, cor: m.cor };
        }).filter(Boolean).sort((x, y) => x.i - y.i);
        let html = "", pos = 0;
        for (const m of trechos) { if (m.i < pos) continue; html += esc(t.slice(pos, m.i)) + `<mark style="background:${corHex[m.cor]}">${esc(t.slice(m.i, m.f))}</mark>`; pos = m.f; }
        html += esc(t.slice(pos));
        corpo += `<p class="vt"${versoInteiro ? ` style="background:${corHex[versoInteiro.cor]};padding:2px 4px;border-radius:3px"` : ""}>${html}</p>`;
      }
      if (inter && v) {
        const pal = ms.filter(m => m.ancora.camada === "original");
        for (const m of pal) {
          const ws = v.w.slice(m.ancora.inicio, m.ancora.fim + 1);
          if (!ws.length) continue;
          const grego = a.livro && (window.__livros || {})[a.livro]?.i >= 39;
          corpo += `<p class="il"><span class="o" dir="${grego ? "ltr" : "rtl"}" lang="${grego ? "grc" : "he"}">${esc(ws.map(w => w[0].replace(/\//g, "")).join(" "))}</span> <span class="ig">${esc(ws.map(w => `${w[1]} · ${w[2]}`).join("; "))}</span></p>`;
        }
      }
      for (const x of g.itens) {
        if (x.tipo === "notas") corpo += `<div class="nt">${x.titulo ? `<b>${esc(x.titulo)}</b><br>` : ""}${esc(x.texto).replace(/\n/g, "<br>")}</div>`;
        else if (x.tipo === "marcacoes" && x.a.camada === "blivre" && !texto) corpo += `<p class="vt"><mark style="background:${corHex[x.cor] || "#eee"}">${esc(x.texto)}</mark></p>`;
      }
      const ets = [...new Set(g.itens.flatMap(x => x.etNomes))];
      if (ets.length) corpo += `<div class="tg">${ets.map(n => `<span>${esc(n)}</span>`).join("")}</div>`;
      corpo += `</section>`;
    }
    const data = new Date().toLocaleDateString("pt-BR");
    return { titulo, n: xs.length, html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)} · Caderno de estudo</title><style>
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
${corpo || "<p>Nenhum item com essas opções.</p>"}
<footer>Texto: Bíblia Livre (BLIVRE). Original: Open Scriptures Hebrew Bible e SBLGNT (CC BY 4.0). Glosas e léxico: projeto Bíblia Interlinear.</footer>
</body></html>` };
  }
  async function gerarCaderno() {
    const btn = $("#exp-gerar");
    btn.disabled = true; btn.textContent = "Gerando…";
    try {
      const c = await montarCaderno();
      window.__ultimoCaderno = c;
      await imprimir(c.html, `${c.titulo} - caderno`);
    } finally { btn.disabled = false; btn.textContent = "Gerar PDF"; }
  }
  // Imprime um HTML: no app Android pelo serviço de impressão do sistema (plugin Impressao, que tem "Salvar como PDF");
  // no navegador, por um iframe escondido e a janela de impressão.
  async function imprimir(html, titulo) {
    const Cap = window.Capacitor, nativo = Cap?.isNativePlatform?.();
    const plug = nativo && (Cap.Plugins?.Impressao || Cap.registerPlugin?.("Impressao"));
    if (plug && Cap.getPlatform?.() === "android") { try { await plug.imprimir({ html, titulo }); return; } catch (_) { aviso("Não foi possível abrir a impressão do Android."); return; } }
    const fr = document.createElement("iframe");
    fr.className = "fr-impressao"; fr.setAttribute("aria-hidden", "true"); fr.tabIndex = -1;
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(fr);
    fr.srcdoc = html;
    await new Promise(r => { fr.onload = r; setTimeout(r, 1500); });
    if (window.__semImprimir) return;  // testes automáticos: só monta o caderno
    try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (_) { aviso("Este navegador não permite imprimir; tente no Chrome, Edge ou Safari."); }
    setTimeout(() => fr.remove(), 60000);
  }

  // ---------- Baixar e importar meus dados (JSON) ----------
  async function baixarDados() {
    await pronto;
    const dados = { formato: "biblia-interlinear-anotacoes", versao: 1, exportado_em: new Date().toISOString(), aparelho, colecoes: {} };
    for (const c of COLECOES) dados.colecoes[c] = db ? await db[c].toArray() : [...memoria[c].values()];
    const json = JSON.stringify(dados, null, 1);
    const nome = `biblia-interlinear-anotacoes-${dados.exportado_em.slice(0, 10)}.json`;
    window.__ultimoBackup = dados;
    const Cap = window.Capacitor;
    if (Cap?.isNativePlatform?.() && Cap.Plugins?.Filesystem && Cap.Plugins?.Share) {
      try {
        const r = await Cap.Plugins.Filesystem.writeFile({ path: nome, data: json, directory: "CACHE", encoding: "utf8" });
        await Cap.Plugins.Share.share({ title: "Minhas anotações", files: [r.uri] });
        return;
      } catch (_) { /* cai no download comum */ }
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    aviso("Arquivo de backup baixado.");
  }
  // Junta o arquivo com o que já está no aparelho: registro novo entra; registro que já existe fica com a versão mais recente.
  async function importar(dados) {
    if (!dados || dados.formato !== "biblia-interlinear-anotacoes" || !dados.colecoes) throw new Error("Este arquivo não é um backup de anotações da Bíblia Interlinear.");
    await pronto;
    let novos = 0, atualizados = 0, iguais = 0;
    for (const c of COLECOES) {
      for (const r of dados.colecoes[c] || []) {
        if (!r || !r.id) continue;
        const atual = db ? await db[c].get(r.id) : memoria[c].get(r.id);
        if (atual && (atual.relogio || "") >= (r.relogio || "")) { iguais++; continue; }
        if (r.relogio) relogio(r.relogio.split("-").slice(0, 2).join("-"));
        if (db) await db.transaction("rw", db[c], db.fila, async () => { await db[c].put(r); await db.fila.add({ colecao: c, id: r.id }); });
        else memoria[c].set(r.id, r);
        atual ? atualizados++ : novos++;
      }
    }
    avisar(); pintar();
    return { novos, atualizados, iguais };
  }
  $("#mn-arquivo").addEventListener("change", async e => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const r = await importar(JSON.parse(await f.text()));
      aviso(`Importado: ${r.novos} novos, ${r.atualizados} atualizados, ${r.iguais} já estavam aqui.`);
      desenharLista();
    } catch (err) { aviso(err.message.startsWith("Este arquivo") ? err.message : "Não foi possível ler o arquivo."); }
  });

  let avisoTimer = 0;
  function aviso(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(avisoTimer); avisoTimer = setTimeout(() => { t.hidden = true; }, Math.max(3500, msg.length * 70));
  }

  // ---------- integração com o leitor ----------
  document.addEventListener("capitulo", e => {
    atual = e.detail;
    fecharBarra();
    pintar();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !barra.hidden) fecharBarra(); });
  window.Anotacoes = {
    abrirLista, abrirNota, fecharBarra, pintar, todos, gravar, apagar, importar, baixarDados, montarCaderno, imprimir,
    contar: async () => (await Promise.all(["notas", "marcacoes", "favoritos"].map(todos))).reduce((s, l) => s + l.length, 0),
    aoMudar: f => ouvintes.push(f),
    exportar: async () => Object.fromEntries(await Promise.all(COLECOES.map(async c => [c, await todos(c)]))),
    local: () => !!db
  };
  if (atual === null && window.__capituloAtual) { atual = window.__capituloAtual; pintar(); }
})();
