/* Meu progresso: capítulos lidos, tempo de leitura, sequência de dias, mapa dos livros e plano de leitura.
 * Só conta para quem entrou com a conta Google (o plano do projeto): sem conta, o app guarda só a última posição.
 * Tudo fica no banco local e sincroniza pelo Drive como as anotações (web/sincronizar.js):
 *   leituras  um registro por capítulo: { id "GEN.1", livro, n, lido, primeira, ultima, vezes }
 *   tempo     um registro por aparelho e dia: { id "<aparelho>:<dia>", aparelho, dia, segundos, livros{}, caps, verbetes }
 *             cada aparelho só escreve os próprios; o total é a soma (ler no celular e no computador nunca perde minutos)
 *   planos    { id "atual", tipo, nome, inicio, fim, caps[] }
 *   preferencias/posicao  o último capítulo lido, em qualquer aparelho
 * Como é medido:
 *   capítulo lido: chegou ao fim do capítulo e ficou ao menos 1 minuto ativo nele (ou marcado à mão);
 *   tempo: só com a página visível e alguma atividade nos últimos 2 minutos (rolar, tocar, teclar, ouvir);
 *   sequência: dia com pelo menos 1 capítulo lido ou 5 minutos de leitura.
 */
(function () {
  "use strict";
  const A = window.Anotacoes, C = window.Conta;
  if (!A?.banco || !C) return;
  const B = A.banco;
  const CFG = Object.assign({ tick: 5000, minLeitura: 60, gesto: 120000, gravarCada: 300000 }, window.__progressoConfig || {});
  const DIA = 864e5;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pad = n => String(n).padStart(2, "0");
  const diaDe = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;   // dia local (fuso do aparelho)
  const hoje = () => diaDe(new Date());
  const somaDias = (dia, n) => { const [a, m, d] = dia.split("-").map(Number); return diaDe(new Date(a, m - 1, d + n)); };
  const entreDias = (a, b) => { const [x, y] = [a, b].map(s => { const [p, q, r] = s.split("-").map(Number); return Date.UTC(p, q - 1, r); }); return Math.round((y - x) / DIA); };
  const lerLS = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const gravarLS = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };

  const livros = () => Object.entries(window.__livros || {}).sort((a, b) => a[1].i - b[1].i).map(([cod, l]) => ({ cod, ...l }));
  const totalCaps = lista => lista.reduce((s, l) => s + (l.ncaps || 0), 0);
  const ligado = () => !!C.conta();          // conta lembrada neste aparelho (mesmo à espera de reconectar)
  const pausado = () => lerLS("interlinear:tempo-pausado") === "sim";

  function duracao(seg) {
    const m = Math.round(seg / 60);
    if (m < 1) return seg > 0 ? "menos de 1 min" : "0 min";
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h} h ${r} min` : `${h} h`;
  }
  const dataCurta = iso => { if (!iso) return "—"; const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };

  // ---------- medição ----------
  let atual = null;            // capítulo na tela { cod, cap }
  let ativoNoCap = 0, marcadoNestaVisita = false, fimVisto = false;
  let ultimoGesto = Date.now();
  let acc = { dia: hoje(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
  ["scroll", "pointerdown", "keydown", "wheel", "touchstart"].forEach(t => window.addEventListener(t, () => { ultimoGesto = Date.now(); }, { passive: true, capture: true }));
  const ouvindo = () => { try { return !!window.speechSynthesis?.speaking; } catch (_) { return false; } };
  const ativo = () => document.visibilityState === "visible" && (Date.now() - ultimoGesto < CFG.gesto || ouvindo());

  let observador = null;
  function vigiarFim() {
    fimVisto = false;
    observador?.disconnect();
    const vs = document.querySelectorAll("#verses .verse");
    const ultimo = vs[vs.length - 1];
    if (!ultimo || !("IntersectionObserver" in window)) { fimVisto = true; return; }
    observador = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { fimVisto = true; checarLido(); } });
    observador.observe(ultimo);
  }
  let posicaoTimer = 0;
  document.addEventListener("capitulo", e => {
    const d = e.detail || {};
    atual = d.cod ? { cod: d.cod, cap: d.cap } : null;
    ativoNoCap = 0; marcadoNestaVisita = false;
    setTimeout(vigiarFim, 50);
    clearTimeout(posicaoTimer);
    // a posição vale em todos os aparelhos ("continuar de onde parou"); grava depois de alguns segundos no capítulo
    if (atual && ligado()) posicaoTimer = setTimeout(() => {
      if (atual && atual.cod === d.cod && atual.cap === d.cap) A.gravar("preferencias", { id: "posicao", cod: d.cod, cap: d.cap, quando: new Date().toISOString() });
    }, 5000);
  });
  if (window.__capituloAtual) { const d = window.__capituloAtual; atual = { cod: d.cod, cap: d.cap }; setTimeout(vigiarFim, 50); }
  document.addEventListener("verbete", () => { if (ligado()) acc.verbetes++; });

  setInterval(() => {
    if (!ligado() || !atual || !ativo()) return;
    const seg = CFG.tick / 1000;
    if (acc.dia !== hoje()) gravarTempo();     // virou o dia: o que foi lido antes fica no dia anterior
    if (!pausado()) { acc.segundos += seg; acc.livros[atual.cod] = (acc.livros[atual.cod] || 0) + seg; }
    ativoNoCap += seg;
    checarLido();
  }, CFG.tick);
  setInterval(() => gravarTempo(), CFG.gravarCada);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") gravarTempo(); });
  window.addEventListener("pagehide", () => gravarTempo());

  function checarLido() {
    if (!atual || marcadoNestaVisita || !fimVisto || ativoNoCap < CFG.minLeitura || !ligado()) return;
    marcadoNestaVisita = true;
    marcarLido(atual.cod, atual.cap, true);
  }
  async function marcarLido(cod, n, lido = true) {
    const id = `${cod}.${n}`;
    const r = await B.ler("leituras", id);
    const agora = new Date().toISOString();
    if (lido) {
      await A.gravar("leituras", { id, livro: cod, n, lido: true, primeira: r?.primeira || agora, ultima: agora, vezes: (r?.vezes || 0) + 1 });
      if (!r?.lido) acc.caps++;
    } else if (r) await A.gravar("leituras", { id, lido: false });
    if (!painel.hidden) desenhar();
  }
  let gravando = Promise.resolve();
  function gravarTempo() {
    if (!acc.segundos && !acc.caps && !acc.verbetes) { acc.dia = hoje(); return gravando; }
    const parte = acc;
    acc = { dia: hoje(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
    gravando = gravando.then(async () => {
      const id = `${B.aparelho}:${parte.dia}`;
      const r = await B.ler("tempo", id);
      const base = r && !r.apagado ? r : { segundos: 0, livros: {}, caps: 0, verbetes: 0 };
      const livrosSoma = { ...base.livros };
      for (const [k, v] of Object.entries(parte.livros)) livrosSoma[k] = (livrosSoma[k] || 0) + v;
      await A.gravar("tempo", { id, aparelho: B.aparelho, dia: parte.dia, segundos: (base.segundos || 0) + parte.segundos, livros: livrosSoma, caps: (base.caps || 0) + parte.caps, verbetes: (base.verbetes || 0) + parte.verbetes, apagado: false });
    }).catch(() => {});
    return gravando;
  }

  // ---------- números ----------
  async function dados() {
    await gravarTempo();
    const [leituras, tempo, planos, prefs, notas, marcacoes, favoritos] = await Promise.all(
      ["leituras", "tempo", "planos", "preferencias", "notas", "marcacoes", "favoritos"].map(c => A.todos(c)));
    const lidos = new Map(leituras.filter(l => l.lido).map(l => [l.id, l]));
    const porDia = {};
    for (const t of tempo) {
      const d = (porDia[t.dia] = porDia[t.dia] || { segundos: 0, caps: 0, verbetes: 0, livros: {} });
      d.segundos += t.segundos || 0; d.caps += t.caps || 0; d.verbetes += t.verbetes || 0;
      for (const [k, v] of Object.entries(t.livros || {})) d.livros[k] = (d.livros[k] || 0) + v;
    }
    // dias com leitura também pelas datas dos capítulos (cobre marcações feitas à mão)
    for (const l of lidos.values()) { const d = diaDe(new Date(l.ultima || l.primeira)); (porDia[d] = porDia[d] || { segundos: 0, caps: 0, verbetes: 0, livros: {} }).capsLidos = true; }
    const comAnotacao = new Set([...notas, ...marcacoes, ...favoritos].map(r => r.cap).filter(Boolean));
    return {
      lidos, porDia, comAnotacao,
      plano: planos.find(p => p.id === "atual") || null,
      posicao: prefs.find(p => p.id === "posicao") || null,
      estudo: { notas: notas.length, marcacoes: marcacoes.length, favoritos: favoritos.length }
    };
  }
  function sequencia(porDia) {
    const conta = d => { const x = porDia[d]; return !!x && (x.caps > 0 || x.capsLidos || x.segundos >= 300); };
    let atualSeq = 0, d = hoje();
    if (!conta(d)) d = somaDias(d, -1);
    while (conta(d)) { atualSeq++; d = somaDias(d, -1); }
    const dias = Object.keys(porDia).filter(conta).sort();
    let recorde = 0, corrida = 0, ant = null;
    for (const x of dias) { corrida = ant && entreDias(ant, x) === 1 ? corrida + 1 : 1; recorde = Math.max(recorde, corrida); ant = x; }
    return { atual: atualSeq, recorde };
  }
  function ritmo(lidos) {   // capítulos por dia nos últimos 30 dias
    const desde = Date.now() - 30 * DIA;
    let n = 0;
    for (const l of lidos.values()) if (Date.parse(l.ultima || l.primeira) >= desde) n++;
    return n / 30;
  }

  // ---------- planos de leitura ----------
  const PLANOS = {
    ano: { nome: "Bíblia em 1 ano", dias: 365, caps: () => livros().flatMap(l => Array.from({ length: l.ncaps }, (_, i) => `${l.cod}.${i + 1}`)) },
    nt90: { nome: "Novo Testamento em 90 dias", dias: 90, caps: () => livros().filter(l => l.nt).flatMap(l => Array.from({ length: l.ncaps }, (_, i) => `${l.cod}.${i + 1}`)) }
  };
  function situacaoPlano(p, lidos) {
    const N = p.caps.length, D = entreDias(p.inicio, p.fim) + 1;
    const d = Math.min(Math.max(entreDias(p.inicio, hoje()), 0), D - 1);
    const doDia = p.caps.slice(Math.floor(d * N / D), Math.floor((d + 1) * N / D));
    const feitos = p.caps.filter(c => lidos.has(c)).length;
    const antes = Math.floor(d * N / D), ateHoje = Math.floor((d + 1) * N / D);
    let texto, tipo;
    if (feitos >= N) { texto = "Plano concluído!"; tipo = "ok"; }
    else if (feitos > ateHoje) { texto = `${feitos - ateHoje} ${feitos - ateHoje === 1 ? "capítulo adiantado" : "capítulos adiantado"}`; tipo = "ok"; }
    else if (feitos >= antes) { texto = "Em dia"; tipo = "ok"; }
    else { texto = `${antes - feitos} ${antes - feitos === 1 ? "capítulo atrasado" : "capítulos atrasado"}`; tipo = "alerta"; }
    return { doDia, feitos, N, dia: d + 1, D, texto, tipo };
  }
  async function iniciarPlano(tipo) {
    const P = PLANOS[tipo];
    await A.gravar("planos", { id: "atual", tipo, nome: P.nome, inicio: hoje(), fim: somaDias(hoje(), P.dias - 1), caps: P.caps(), apagado: false });
    desenhar();
  }
  async function reajustarPlano(p, lidos) {
    const faltam = p.caps.filter(c => !lidos.has(c));
    const ritmoOriginal = p.caps.length / (entreDias(p.inicio, p.fim) + 1) || 1;
    const dias = Math.max(1, Math.ceil(faltam.length / ritmoOriginal));
    await A.gravar("planos", { ...p, caps: faltam, inicio: hoje(), fim: somaDias(hoje(), dias - 1) });
    desenhar();
  }

  // ---------- tela ----------
  const css = document.createElement("style");
  css.textContent = `
.sheet.progresso-sheet { width: min(560px, 100vw); z-index: 45; }
.pg-sec { display: grid; gap: 10px; }
.pg-sec h3 { margin: 0; font: 500 12px var(--font-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.pg-continuar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--accent-soft); color: var(--fg); font: inherit; cursor: pointer; text-align: start; }
.pg-continuar b { display: block; font-size: 17px; }
.pg-continuar small { color: var(--muted); }
.pg-grande { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.pg-grande b { font-size: 40px; line-height: 1; font-weight: 600; }
.pg-barra { height: 10px; border-radius: 6px; background: var(--line); overflow: hidden; }
.pg-barra i { display: block; height: 100%; background: var(--accent); border-radius: 6px; }
.pg-sub { color: var(--muted); font-size: 14px; margin: 0; }
.pg-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.pg-tile { border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; }
.pg-tile b { display: block; font-size: 20px; }
.pg-tile span { font-size: 12.5px; color: var(--muted); }
.pg-abas { display: flex; gap: 6px; }
.pg-graf svg { width: 100%; height: auto; display: block; }
.pg-graf .bar { fill: var(--accent); }
.pg-graf .media { stroke: var(--muted); stroke-dasharray: 4 3; }
.pg-graf text { fill: var(--muted); font: 10px var(--font-mono); }
.pg-mapa { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 5px; }
.pg-livro { min-height: 40px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 12px var(--font-mono); cursor: pointer; padding: 0; }
.pg-livro.n1 { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
.pg-livro.n2 { background: color-mix(in srgb, var(--accent) 50%, var(--surface)); }
.pg-livro.n3 { background: var(--accent); color: var(--surface); border-color: var(--accent); }
.pg-legenda { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--muted); }
.pg-legenda i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1px solid var(--line); vertical-align: -2px; margin-right: 4px; }
.pg-caps { display: grid; grid-template-columns: repeat(auto-fill, minmax(42px, 1fr)); gap: 5px; }
.pg-cap { position: relative; min-height: 40px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 13px var(--font-mono); cursor: pointer; }
.pg-cap[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.pg-cap.lendo { outline: 2px dashed var(--accent); outline-offset: -4px; }
.pg-cap.anot::after { content: ""; position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: #c98a1b; }
.pg-btns { display: flex; flex-wrap: wrap; gap: 8px; }
.pg-btns button, .pg-voltar { min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line); background: transparent; color: var(--fg); font: inherit; font-size: 14px; cursor: pointer; }
.pg-btns button.prim { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.pg-dia { display: flex; flex-wrap: wrap; gap: 6px; }
.pg-dia button { min-height: 36px; padding: 0 12px; border-radius: 18px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font: 13px var(--font-body); cursor: pointer; }
.pg-dia button.feito { background: var(--accent-soft); border-color: var(--accent); }
.pg-dia button.feito::before { content: "✓ "; }
.pg-estado.ok { color: light-dark(#2e7d4f, #7fd3a0); }
.pg-estado.alerta { color: light-dark(#8a5300, #e8b25c); }
.pg-rodape { display: grid; gap: 6px; border-top: 1px solid var(--line); padding-top: 12px; }
.pg-rodape button { justify-self: start; border: 0; background: none; padding: 6px 0; color: var(--muted); font: inherit; font-size: 13.5px; text-decoration: underline; cursor: pointer; min-height: 36px; }
.pg-convite p { line-height: 1.5; }
`;
  document.head.appendChild(css);

  const painel = document.createElement("aside");
  painel.id = "progresso"; painel.className = "sheet right progresso-sheet"; painel.hidden = true;
  painel.setAttribute("role", "dialog"); painel.setAttribute("aria-modal", "true"); painel.setAttribute("aria-labelledby", "pg-h"); painel.setAttribute("lang", "pt-BR");
  document.body.appendChild(painel);
  let aba = "semana", livroAberto = null, voltarFoco = null;

  function abrir() {
    voltarFoco = document.activeElement;
    document.dispatchEvent(new CustomEvent("anotacoes:abrir-painel"));
    livroAberto = null;
    painel.hidden = false;
    desenhar().then(() => painel.querySelector("#pg-fechar")?.focus());
  }
  function fechar() {
    if (painel.hidden) return;
    painel.hidden = true;
    if (voltarFoco?.isConnected) voltarFoco.focus({ preventScroll: true });
  }
  const cabecalho = titulo => `<div class="shead"><h2 id="pg-h">${esc(titulo)}</h2><button class="ibtn" id="pg-fechar" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`;

  async function desenhar() {
    if (painel.hidden) return;
    if (!ligado()) {
      painel.innerHTML = cabecalho("Meu progresso") + `<div class="pg-sec pg-convite">
        <p>Entre com sua conta Google para acompanhar quanto da Bíblia já leu, o tempo de leitura por dia, a sequência de dias e um plano de leitura — somados em todos os seus aparelhos.</p>
        <p class="pg-sub">Os números ficam só para você, no seu aparelho e numa pasta privada do app no seu Google Drive.</p>
        ${C.disponivel() ? `<div><button class="gbtn js-entrar">Entrar com Google</button></div>` : `<p class="pg-sub">O login ainda não está disponível nesta versão.</p>`}</div>`;
      return;
    }
    const D = await dados();
    painel.innerHTML = cabecalho(livroAberto ? (window.__livros?.[livroAberto]?.nome || livroAberto) : "Meu progresso")
      + (livroAberto ? telaLivro(D, livroAberto) : telaGeral(D));
  }

  function telaGeral(D) {
    const ls = livros(), total = totalCaps(ls) || 1189;
    const at = ls.filter(l => !l.nt), nt = ls.filter(l => l.nt);
    const lidosDe = lista => lista.reduce((s, l) => s + [...Array(l.ncaps).keys()].filter(i => D.lidos.has(`${l.cod}.${i + 1}`)).length, 0);
    const nLidos = D.lidos.size, nAT = lidosDe(at), nNT = lidosDe(nt);
    const concluidos = ls.filter(l => lidosDe([l]) === l.ncaps).length;
    const pct = Math.floor(nLidos / total * 1000) / 10;
    const seq = sequencia(D.porDia);
    const semana = [...Array(7).keys()].map(i => D.porDia[somaDias(hoje(), -i)]?.segundos || 0).reduce((a, b) => a + b, 0);
    const totalSeg = Object.values(D.porDia).reduce((s, d) => s + d.segundos, 0);
    const verbetes = Object.values(D.porDia).reduce((s, d) => s + d.verbetes, 0);
    const pos = D.posicao && window.__livros?.[D.posicao.cod];
    const continuar = pos ? `<button class="pg-continuar" data-ir="${esc(D.posicao.cod)}.${D.posicao.cap}"><span><small>Continuar de onde parou</small><b>${esc(pos.nome)} ${D.posicao.cap}</b></span><span aria-hidden="true">→</span></button>` : "";
    return `${continuar}
      <section class="pg-sec" aria-labelledby="pg-biblia"><h3 id="pg-biblia">A Bíblia inteira</h3>
        <div class="pg-grande"><b>${pct.toLocaleString("pt-BR")}%</b><span>${nLidos.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} capítulos lidos</span></div>
        <div class="pg-barra" role="img" aria-label="${pct.toLocaleString("pt-BR")}% lidos"><i style="width:${Math.min(100, pct)}%"></i></div>
        <p class="pg-sub">Antigo Testamento: ${nAT} de ${totalCaps(at)} · Novo Testamento: ${nNT} de ${totalCaps(nt)} · ${concluidos} ${concluidos === 1 ? "livro concluído" : "livros concluídos"}</p>
      </section>
      <section class="pg-sec" aria-label="Números"><div class="pg-tiles">
        <div class="pg-tile"><b>${seq.atual} ${seq.atual === 1 ? "dia" : "dias"}</b><span>seguidos lendo · recorde ${seq.recorde}</span></div>
        <div class="pg-tile"><b>${duracao(semana)}</b><span>nos últimos 7 dias · média ${duracao(semana / 7)}/dia</span></div>
        <div class="pg-tile"><b>${duracao(totalSeg)}</b><span>de leitura no total</span></div>
        <div class="pg-tile"><b>${verbetes.toLocaleString("pt-BR")}</b><span>verbetes abertos</span></div>
      </div></section>
      <section class="pg-sec" aria-labelledby="pg-tempo"><h3 id="pg-tempo">Tempo de leitura por dia</h3>
        <div class="pg-abas" role="group" aria-label="Período">${[["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]].map(([k, n]) => `<button class="chip" data-aba="${k}" aria-pressed="${aba === k}">${n}</button>`).join("")}</div>
        <div class="pg-graf">${grafico(D.porDia)}</div>
      </section>
      <section class="pg-sec" aria-labelledby="pg-mapa"><h3 id="pg-mapa">Os 66 livros</h3>
        <div class="pg-mapa">${ls.map(l => { const n = lidosDe([l]), f = n / l.ncaps; const nv = n === 0 ? 0 : n === l.ncaps ? 3 : f > .5 ? 2 : 1;
          return `<button class="pg-livro n${nv}" data-livro="${l.cod}" title="${esc(l.nome)}: ${n} de ${l.ncaps}" aria-label="${esc(l.nome)}: ${n} de ${l.ncaps} capítulos lidos">${esc(l.abrev)}</button>`; }).join("")}</div>
        <div class="pg-legenda"><span><i></i>não começado</span><span><i style="background:color-mix(in srgb,var(--accent) 22%,var(--surface))"></i>até a metade</span><span><i style="background:color-mix(in srgb,var(--accent) 50%,var(--surface))"></i>mais da metade</span><span><i style="background:var(--accent)"></i>concluído</span></div>
      </section>
      ${secaoPlano(D)}
      <section class="pg-sec" aria-labelledby="pg-estudo"><h3 id="pg-estudo">Estudo</h3>
        <p class="pg-sub">${D.estudo.notas} ${D.estudo.notas === 1 ? "nota" : "notas"} · ${D.estudo.marcacoes} ${D.estudo.marcacoes === 1 ? "marcação" : "marcações"} · ${D.estudo.favoritos} ${D.estudo.favoritos === 1 ? "favorito" : "favoritos"}</p>
      </section>
      <div class="pg-rodape">
        <button id="pg-pausar">${pausado() ? "Voltar a contar o tempo de leitura" : "Pausar a contagem de tempo neste aparelho"}</button>
        <button id="pg-zerar">Zerar estatísticas</button>
      </div>`;
  }

  function grafico(porDia) {
    let barras = [];
    if (aba === "ano") {
      const agora = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1), chave = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        const seg = Object.entries(porDia).filter(([k]) => k.startsWith(chave)).reduce((s, [, v]) => s + v.segundos, 0);
        barras.push({ rot: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][d.getMonth()], seg });
      }
    } else {
      const n = aba === "mes" ? 30 : 7, sem = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
      for (let i = n - 1; i >= 0; i--) {
        const dia = somaDias(hoje(), -i), [a, m, d] = dia.split("-").map(Number);
        barras.push({ rot: n === 7 ? sem[new Date(a, m - 1, d).getDay()] : (i % 5 === 0 ? String(d) : ""), seg: porDia[dia]?.segundos || 0 });
      }
    }
    const W = 520, H = 160, base = 136, topo = 12, max = Math.max(60, ...barras.map(b => b.seg));
    const largura = W / barras.length, media = barras.reduce((s, b) => s + b.seg, 0) / barras.length;
    const y = s => base - (s / max) * (base - topo);
    const desc = barras.map(b => `${b.rot || ""} ${duracao(b.seg)}`).filter(Boolean).join(", ");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tempo de leitura: ${esc(desc)}. Média ${duracao(media)}.">
      ${barras.map((b, i) => `<rect class="bar" x="${(i * largura + largura * .18).toFixed(1)}" y="${y(b.seg).toFixed(1)}" width="${(largura * .64).toFixed(1)}" height="${(base - y(b.seg)).toFixed(1)}" rx="2"><title>${esc(b.rot)} ${duracao(b.seg)}</title></rect>
        <text x="${(i * largura + largura / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(b.rot)}</text>`).join("")}
      <line class="media" x1="0" x2="${W}" y1="${y(media).toFixed(1)}" y2="${y(media).toFixed(1)}"/>
      <text x="${W - 2}" y="${Math.max(10, y(media) - 4).toFixed(1)}" text-anchor="end">média ${esc(duracao(media))}</text>
    </svg>`;
  }

  function secaoPlano(D) {
    const p = D.plano;
    if (!p || !p.caps?.length) return `<section class="pg-sec" aria-labelledby="pg-plano"><h3 id="pg-plano">Plano de leitura</h3>
      <p class="pg-sub">Opcional: um ritmo para ler a Bíblia toda ou o Novo Testamento, com a leitura de cada dia.</p>
      <div class="pg-btns"><button data-plano="ano">Bíblia em 1 ano</button><button data-plano="nt90">Novo Testamento em 90 dias</button></div></section>`;
    const s = situacaoPlano(p, D.lidos);
    const nomeCap = id => { const [cod, n] = id.split("."); return `${window.__livros?.[cod]?.abrev || cod} ${n}`; };
    return `<section class="pg-sec" aria-labelledby="pg-plano"><h3 id="pg-plano">Plano de leitura · ${esc(p.nome)}</h3>
      <p class="pg-sub">Dia ${s.dia} de ${s.D} · ${s.feitos.toLocaleString("pt-BR")} de ${s.N.toLocaleString("pt-BR")} capítulos · <span class="pg-estado ${s.tipo}">${esc(s.texto)}</span></p>
      ${s.feitos < s.N ? `<p class="pg-sub">Leitura de hoje:</p><div class="pg-dia">${s.doDia.map(c => `<button data-ir="${c}" class="${D.lidos.has(c) ? "feito" : ""}">${esc(nomeCap(c))}</button>`).join("") || "<span class=\"pg-sub\">nada para hoje</span>"}</div>` : ""}
      <div class="pg-btns"><button id="pg-reajustar">Reajustar as datas a partir de hoje</button><button id="pg-encerrar">Encerrar o plano</button></div></section>`;
  }

  function telaLivro(D, cod) {
    const l = livros().find(x => x.cod === cod);
    if (!l) return "";
    const caps = Array.from({ length: l.ncaps }, (_, i) => i + 1);
    const lidosAqui = caps.filter(n => D.lidos.has(`${cod}.${n}`));
    const regs = lidosAqui.map(n => D.lidos.get(`${cod}.${n}`));
    const primeira = regs.map(r => r.primeira).filter(Boolean).sort()[0];
    const ultima = regs.map(r => r.ultima).filter(Boolean).sort().at(-1);
    const relido = regs.filter(r => (r.vezes || 0) > 1).sort((a, b) => b.vezes - a.vezes)[0];
    const tempoLivro = Object.values(D.porDia).reduce((s, d) => s + (d.livros[cod] || 0), 0);
    const lendo = D.posicao?.cod === cod ? D.posicao.cap : null;
    const faltam = l.ncaps - lidosAqui.length, r = ritmo(D.lidos);
    const previsao = faltam && r > 0 ? ` · no seu ritmo, cerca de ${Math.ceil(faltam / r)} ${Math.ceil(faltam / r) === 1 ? "dia" : "dias"}` : "";
    const proximo = caps.find(n => !D.lidos.has(`${cod}.${n}`)) || 1;
    return `<div><button class="pg-voltar" id="pg-voltar">← Meu progresso</button></div>
      <section class="pg-sec" aria-label="Resumo do livro">
        <div class="pg-grande"><b>${lidosAqui.length}</b><span>de ${l.ncaps} capítulos lidos</span></div>
        <div class="pg-barra"><i style="width:${(lidosAqui.length / l.ncaps * 100).toFixed(1)}%"></i></div>
        <p class="pg-sub">${faltam ? `Faltam ${faltam}${previsao}` : "Livro concluído"}</p>
      </section>
      <section class="pg-sec" aria-labelledby="pg-capsh"><h3 id="pg-capsh">Capítulos</h3>
        <p class="pg-sub">Toque para marcar ou desmarcar como lido. Ponto: tem anotação; tracejado: em leitura.</p>
        <div class="pg-caps">${caps.map(n => { const id = `${cod}.${n}`;
          return `<button class="pg-cap${D.comAnotacao.has(id) ? " anot" : ""}${lendo === n && !D.lidos.has(id) ? " lendo" : ""}" data-cap="${n}" aria-pressed="${D.lidos.has(id)}" aria-label="Capítulo ${n}${D.lidos.has(id) ? ", lido" : ""}${D.comAnotacao.has(id) ? ", com anotação" : ""}">${n}</button>`; }).join("")}</div>
      </section>
      <section class="pg-sec" aria-label="Números do livro"><div class="pg-tiles">
        <div class="pg-tile"><b>${duracao(tempoLivro)}</b><span>de leitura neste livro</span></div>
        <div class="pg-tile"><b>${relido ? `${l.abrev} ${relido.n}` : "—"}</b><span>${relido ? `mais relido (${relido.vezes} vezes)` : "capítulo mais relido"}</span></div>
        <div class="pg-tile"><b>${dataCurta(primeira)}</b><span>primeira leitura</span></div>
        <div class="pg-tile"><b>${dataCurta(ultima)}</b><span>última leitura</span></div>
      </div></section>
      <div class="pg-btns"><button class="prim" data-ir="${cod}.${proximo}">Ler ${esc(l.abrev)} ${proximo}</button></div>`;
  }

  painel.addEventListener("click", async e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.id === "pg-fechar") return fechar();
    if (b.dataset.ir) { const [cod, n] = b.dataset.ir.split("."); fechar(); document.dispatchEvent(new CustomEvent("anotacoes:ir", { detail: { cod, cap: +n } })); return; }
    if (b.dataset.aba) { aba = b.dataset.aba; return desenhar(); }
    if (b.dataset.livro) { livroAberto = b.dataset.livro; await desenhar(); painel.scrollTop = 0; painel.querySelector("#pg-voltar")?.focus(); return; }
    if (b.id === "pg-voltar") { livroAberto = null; return desenhar(); }
    if (b.dataset.cap && livroAberto) { await marcarLido(livroAberto, +b.dataset.cap, b.getAttribute("aria-pressed") !== "true"); painel.querySelector(`[data-cap="${b.dataset.cap}"]`)?.focus(); return; }
    if (b.dataset.plano) return iniciarPlano(b.dataset.plano);
    if (b.id === "pg-reajustar") { const D = await dados(); return reajustarPlano(D.plano, D.lidos); }
    if (b.id === "pg-encerrar") { const r = await C.perguntar("Encerrar o plano?", "Os capítulos lidos continuam contando no seu progresso.", [{ id: "sim", texto: "Encerrar", prim: true }, { id: "", texto: "Cancelar" }]); if (r === "sim") { await A.apagar("planos", "atual"); desenhar(); } return; }
    if (b.id === "pg-pausar") { gravarLS("interlinear:tempo-pausado", pausado() ? null : "sim"); return desenhar(); }
    if (b.id === "pg-zerar") {
      const r = await C.perguntar("Zerar estatísticas?", "Apaga os capítulos lidos, o tempo de leitura e o plano, em todos os seus aparelhos. As anotações não são afetadas.",
        [{ id: "sim", texto: "Zerar", perigo: true }, { id: "", texto: "Cancelar", prim: true }]);
      if (r !== "sim") return;
      acc = { dia: hoje(), segundos: 0, livros: {}, caps: 0, verbetes: 0 };
      for (const c of ["leituras", "tempo", "planos"]) for (const x of await A.todos(c)) await A.apagar(c, x.id);
      return desenhar();
    }
  });
  painel.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); fechar(); } });
  // o painel se atualiza quando chegam mudanças de outro aparelho
  A.aoMudar(() => { if (!painel.hidden) desenhar(); });
  C.aoMudar(() => { if (!painel.hidden) desenhar(); });

  window.Progresso = { abrir, fechar, marcarLido, gravarTempo, dados: () => dados() };
})();
