/* Sincronização das anotações pelo Google Drive da pessoa (pasta oculta do app), sem servidor.
 *
 * O aparelho é a fonte do dia a dia: toda gravação vai para o banco local e para a fila (web/anotacoes.js).
 * Com a conta ligada (web/conta.js), um ciclo roda sozinho — alguns segundos depois de cada mudança, ao abrir,
 * ao voltar para o app, quando a internet volta e a cada 30 s com a tela visível:
 *   1. Receber: lista os lotes novos de outros aparelhos (desde o último marcador) e aplica registro a registro —
 *      vence o relógio maior; notas editadas nos dois lados viram duas (a outra como "conflito").
 *      Aparelho novo, ou parado há mais de 30 dias, começa pelo retrato mais recente.
 *   2. Enviar: grava a fila num arquivo novo lote-<aparelho>-<hora>.json (arquivos nunca são editados,
 *      então dois aparelhos nunca brigam pelo mesmo arquivo) e só então limpa a fila.
 *   3. Compactar (no máximo 1 vez por dia, com muitos lotes): grava retrato-<hora>-<aparelho>.json com tudo
 *      e apaga lotes com mais de 30 dias já incluídos nele; exclusões com mais de 90 dias saem de vez.
 * Aplicar o mesmo lote duas vezes dá o mesmo resultado: uma queda no meio não estraga nada.
 */
(function () {
  "use strict";
  const A = window.Anotacoes, C = window.Conta;
  if (!A?.banco || !C) return;
  const B = A.banco;
  const ESPERA = 3000, INTERVALO = 30000, LIMITE_LOTES = 40, DIA = 864e5, DIAS_LOTE = 30, DIAS_APAGADO = 90;
  const FOLGA = 2 * 60000;   // a lista do Drive pode demorar um pouco: relê os últimos 2 minutos (aplicar de novo não muda nada)

  let rodando = null, deNovo = false, timer = 0, aplicando = false, parado = false;
  let status = null;

  function mostrar(tipo, texto) {
    if (status && status.tipo === tipo && status.texto === texto) return;
    status = { tipo, texto };
    C.redesenhar();
  }
  function agendar(ms = ESPERA) { clearTimeout(timer); timer = setTimeout(ciclo, ms); }

  async function lerEstado() {
    const email = C.conta()?.email || "";
    let st = await B.estado("sinc");
    if (!st || st.email !== email) st = { email, marcador: null, aplicados: {}, inicial: false, compactado_em: null };
    return st;
  }
  const salvar = st => B.estado("sinc", st);

  // ---------- um ciclo ----------
  async function ciclo() {
    if (parado || C.estado() !== "ligado" || !B.persistente()) return;
    if (rodando) { deNovo = true; return rodando; }
    rodando = (async () => {
      try {
        if (navigator.onLine === false) return mostrar("alerta", "Sem internet — as mudanças esperam neste aparelho");
        const st = await lerEstado();
        if (!st.inicial && !(await primeiroLogin(st))) return;
        await receber(st);
        await enviar(st);
        await compactar(st).catch(() => {});   // compactar é só faxina: se falhar, tenta outro dia
        await salvar(st);
        const h = new Date();
        mostrar("ok", `Sincronizado às ${String(h.getHours()).padStart(2, "0")}:${String(h.getMinutes()).padStart(2, "0")}`);
      } catch (e) {
        if (e.codigo === "reconectar" || e.codigo === "fora" || e.codigo === "interacao") return;   // a conta mostra o que fazer
        if (e.codigo === "drive-cheio") mostrar("alerta", "Seu Google Drive está sem espaço — as mudanças esperam neste aparelho");
        else if (e instanceof TypeError) mostrar("alerta", "Sem internet — as mudanças esperam neste aparelho");
        else mostrar("alerta", "Não foi possível sincronizar agora; tentando de novo em instantes");
      } finally {
        rodando = null;
        if (deNovo) { deNovo = false; agendar(500); }
      }
    })();
    return rodando;
  }

  // Primeira vez desta conta neste aparelho: tudo o que já foi anotado aqui sobe para a conta, sem perguntar
  async function primeiroLogin(st) {
    await B.enfileirarTudo();
    st.inicial = true;
    await salvar(st);
    return true;
  }

  async function aplicar(colecoes) {
    let mudou = 0;
    aplicando = true;
    try {
      for (const c of B.colecoes) {
        for (const r of (colecoes && colecoes[c]) || []) {
          const res = await B.mesclar(c, r, { daNuvem: true });
          if (res === "novo" || res === "atualizado") {
            mudou++;
            if (c === "preferencias" && r.id === "leitura" && !r.apagado) { try { window.__preferencias?.aplicar(r); } catch (_) {} }
          }
        }
      }
      if (mudou) B.aplicado();
    } finally { aplicando = false; }
    return mudou;
  }

  async function receber(st) {
    const recente = st.marcador && Date.now() - Date.parse(st.marcador) < (DIAS_LOTE - 1) * DIA;
    if (!recente) {
      const rets = await C.drive.consultar("name contains 'retrato-'");
      const ret = rets[rets.length - 1];
      if (ret) {
        mostrar("", "Recebendo suas anotações…");
        const d = await C.drive.ler(ret.id);
        await aplicar(d.colecoes);
        if (d.ate && (!st.marcador || d.ate > st.marcador)) st.marcador = d.ate;
        await salvar(st);
      }
    }
    const desde = st.marcador ? new Date(Date.parse(st.marcador) - FOLGA).toISOString() : null;
    const lotes = await C.drive.consultar("name contains 'lote-'" + (desde ? ` and createdTime > '${desde}'` : ""));
    const meu = `lote-${B.aparelho}-`;
    for (const l of lotes) {
      if (!l.name.startsWith(meu) && !st.aplicados[l.name]) {
        mostrar("", "Recebendo mudanças…");
        const d = await C.drive.ler(l.id);
        await aplicar(d.colecoes);
        st.aplicados[l.name] = l.createdTime;
      }
      if (!st.marcador || l.createdTime > st.marcador) st.marcador = l.createdTime;
      await salvar(st);
    }
    // a lista de já aplicados só precisa cobrir a folga
    const corte = st.marcador ? new Date(Date.parse(st.marcador) - 2 * FOLGA).toISOString() : "";
    for (const [nome, quando] of Object.entries(st.aplicados)) if (quando < corte) delete st.aplicados[nome];
  }

  async function enviar(st) {
    const fila = await B.fila();
    if (!fila.length) return;
    const ids = {};
    for (const f of fila) (ids[f.colecao] = ids[f.colecao] || new Set()).add(f.id);
    const colecoes = {};
    let n = 0;
    for (const [c, conj] of Object.entries(ids)) {
      for (const id of conj) {
        const r = await B.ler(c, id);
        if (r && !r.local) { (colecoes[c] = colecoes[c] || []).push(r); n++; }
      }
    }
    if (n) {
      mostrar("", `Enviando ${n} ${n === 1 ? "mudança" : "mudanças"}…`);
      const agora = new Date();
      await C.drive.gravar(`lote-${B.aparelho}-${agora.getTime()}.json`,
        { formato: "biblia-interlinear-lote", versao: 1, aparelho: B.aparelho, criado_em: agora.toISOString(), colecoes });
    }
    await B.tirarDaFila(fila.map(f => f.seq));   // só depois que o Drive confirmou
  }

  async function compactar(st, forcar = false) {
    if (!forcar && st.compactado_em && Date.now() - Date.parse(st.compactado_em) < DIA) return;
    st.compactado_em = new Date().toISOString();
    const lotes = await C.drive.consultar("name contains 'lote-'");
    if (!forcar && lotes.length <= LIMITE_LOTES) return;
    // exclusões antigas saem de vez (aqui e no retrato)
    const velho = new Date(Date.now() - DIAS_APAGADO * DIA).toISOString();
    const colecoes = {};
    for (const c of B.colecoes) {
      const regs = await B.brutos(c);
      const fora = regs.filter(r => r.apagado && (r.alterado_em || "") < velho).map(r => r.id);
      if (fora.length) await B.purgar(c, fora);
      colecoes[c] = regs.filter(r => !r.local && !fora.includes(r.id));
    }
    const agora = new Date();
    const ate = st.marcador || agora.toISOString();
    const novo = await C.drive.gravar(`retrato-${agora.getTime()}-${B.aparelho}.json`,
      { formato: "biblia-interlinear-retrato", versao: 1, aparelho: B.aparelho, criado_em: agora.toISOString(), ate, colecoes });
    const limite = new Date(Date.now() - DIAS_LOTE * DIA).toISOString();
    for (const l of lotes) if (l.createdTime < limite && l.createdTime <= ate) await C.drive.apagar(l.id);
    // retratos antigos: o novo já tem tudo (se dois aparelhos compactarem juntos, os dois têm o mesmo conteúdo)
    for (const r of await C.drive.consultar("name contains 'retrato-'")) if (r.id !== novo.id) await C.drive.apagar(r.id);
  }

  // ---------- quando rodar ----------
  A.aoMudar(() => { if (!aplicando) agendar(ESPERA); });
  C.aoMudar(estado => {
    if (estado === "ligado") { parado = false; agendar(300); }
    else { status = null; }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") agendar(500); });
  window.addEventListener("online", () => agendar(500));
  window.addEventListener("offline", () => { if (C.estado() === "ligado") mostrar("alerta", "Sem internet — as mudanças esperam neste aparelho"); });
  setInterval(() => { if (document.visibilityState === "visible") ciclo(); }, INTERVALO);

  // Preferências de leitura (modo e itens visíveis) também viajam: grava quando a pessoa muda
  document.addEventListener("preferencias", () => {
    const p = window.__preferencias?.ler();
    if (p) A.gravar("preferencias", { id: "leitura", ...p });
  });

  window.Sinc = {
    agora: () => ciclo(),
    resumo: () => (C.estado() === "ligado" ? status : null),
    parar: async () => { parado = true; clearTimeout(timer); if (rodando) await rodando.catch(() => {}); },
    antesDeApagar: async () => { parado = true; if (rodando) await rodando.catch(() => {}); },
    compactar: async () => { const st = await lerEstado(); await compactar(st, true); await salvar(st); }
  };
})();
