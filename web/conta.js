/* Conta Google opcional: login e acesso à pasta privada do app no Google Drive (appDataFolder).
 * Sem servidor do projeto: o app fala direto com a API do Drive usando o token que o Google entrega no login.
 *   - Site: Google Identity Services, modelo de token (popup). O script do Google só é carregado quando a pessoa
 *     vai tocar em "Entrar com Google".
 *   - Android: plugin nativo ContaGoogle (API de autorização do Google Play services); renovação silenciosa.
 *   - iOS: ainda não (fica oculto).
 * O token fica só na memória; no aparelho fica guardado apenas nome, e-mail e foto, para mostrar a conta.
 * Expõe window.Conta (estado, entrar, sair, token, drive.*) para a sincronização (fase 5).
 */
(function () {
  "use strict";
  const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.appdata";
  const ESCOPOS = ["openid", "email", "profile", ESCOPO_DRIVE].join(" ");
  const API = "https://www.googleapis.com/drive/v3";
  const UP = "https://www.googleapis.com/upload/drive/v3";
  const GIS = "https://accounts.google.com/gsi/client";
  const CHAVE = "interlinear:conta", CHAVE_SUG = "interlinear:conta-sugestao";

  const Cap = window.Capacitor;
  const nativo = !!Cap?.isNativePlatform?.();
  const plataforma = nativo ? Cap.getPlatform() : "web";
  const plugin = nativo ? Cap.Plugins?.ContaGoogle : null;
  const cfg = window.GOOGLE_CONFIG || {};
  const disponivel = nativo ? (plataforma === "android" && !!plugin) : !!cfg.webClientId;

  const ler = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  let conta = null;                 // { nome, email, foto }
  try { conta = JSON.parse(ler(CHAVE) || "null"); } catch (_) {}
  let tokenAtual = null;            // { valor, expira }
  let estado = !disponivel ? "indisponivel" : conta ? "reconectar" : "fora";
  let drive = null;                 // resumo de conta.json no Drive: { aparelhos }
  let erro = "";
  const ouvintes = [];
  function mudar(novo) { if (novo) estado = novo; desenhar(); ouvintes.forEach(f => { try { f(estado); } catch (_) {} }); }

  // ---------- token ----------
  let gisPromessa = null;
  function carregarGIS() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (!gisPromessa) gisPromessa = new Promise((ok, falha) => {
      const s = document.createElement("script");
      s.src = GIS; s.async = true; s.onload = () => ok(); s.onerror = () => { gisPromessa = null; falha(new Error("Não foi possível falar com o Google. Verifique a conexão.")); };
      document.head.appendChild(s);
    });
    return gisPromessa;
  }
  function pedirTokenWeb(prompt) {
    return new Promise((ok, falha) => {
      const cliente = google.accounts.oauth2.initTokenClient({
        client_id: cfg.webClientId,
        scope: ESCOPOS,
        callback: r => {
          if (r.error) return falha(Object.assign(new Error(r.error_description || r.error), { codigo: r.error }));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, ESCOPO_DRIVE)) return falha(Object.assign(new Error("Sem a permissão do Drive"), { codigo: "sem-drive" }));
          ok({ valor: r.access_token, expira: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
        },
        error_callback: e => falha(Object.assign(new Error(e?.message || "Login cancelado."), { codigo: e?.type === "popup_closed" ? "cancelado" : (e?.type || "falhou") }))
      });
      cliente.requestAccessToken({ prompt, login_hint: conta?.email || undefined });
    });
  }
  async function pedirTokenNativo(silencioso) {
    let r;
    try { r = await plugin.autorizar({ silencioso }); }
    catch (e) { throw Object.assign(new Error(e?.message || "Login cancelado."), { codigo: e?.code || "falhou" }); }
    if (!(r.escopos || []).includes(ESCOPO_DRIVE)) throw Object.assign(new Error("Sem a permissão do Drive"), { codigo: "sem-drive" });
    // a API do Android não informa a validade; o Google entrega tokens de 1 hora
    return { valor: r.accessToken, expira: Date.now() + 55 * 60 * 1000 };
  }
  // Token válido para chamar o Drive. No Android renova sozinho; no site, se expirou, pede para reconectar.
  async function token() {
    if (tokenAtual && tokenAtual.expira - Date.now() > 60000) return tokenAtual.valor;
    tokenAtual = null;
    if (estado === "fora" || estado === "indisponivel") throw Object.assign(new Error("Sem conta"), { codigo: "fora" });
    if (nativo) {
      try { tokenAtual = await pedirTokenNativo(true); return tokenAtual.valor; }
      catch (e) { mudar("reconectar"); throw e; }
    }
    mudar("reconectar");
    throw Object.assign(new Error("A conexão com o Google expirou."), { codigo: "reconectar" });
  }

  // ---------- API do Google ----------
  async function chamar(url, opcoes = {}, tentar = true) {
    const tk = await token();
    const r = await fetch(url, { ...opcoes, headers: { ...(opcoes.headers || {}), Authorization: "Bearer " + tk } });
    if (r.status === 401 && tentar) { tokenAtual = null; return chamar(url, opcoes, false); }
    if (!r.ok) {
      let msg = "";
      try { msg = (await r.json()).error?.message || ""; } catch (_) {}
      const codigo = r.status === 403 && /storage|quota/i.test(msg) ? "drive-cheio" : r.status === 403 ? "sem-permissao" : "http-" + r.status;
      throw Object.assign(new Error(msg || `Erro ${r.status} no Google Drive`), { codigo, status: r.status });
    }
    return r;
  }
  const Drive = {
    async listar(nome) {
      const q = nome ? `&q=${encodeURIComponent(`name='${nome.replace(/'/g, "\\'")}'`)}` : "";
      const r = await chamar(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=files(id,name,modifiedTime,size)${q}`);
      return (await r.json()).files || [];
    },
    async ler(id) { return (await chamar(`${API}/files/${id}?alt=media`)).json(); },
    async gravar(nome, dados, id) {
      const corpo = JSON.stringify(dados);
      if (id) {
        const r = await chamar(`${UP}/files/${id}?uploadType=media&fields=id,name,modifiedTime`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: corpo });
        return r.json();
      }
      const b = "biblia" + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name: nome, parents: ["appDataFolder"], mimeType: "application/json" });
      const multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${corpo}\r\n--${b}--`;
      const r = await chamar(`${UP}/files?uploadType=multipart&fields=id,name,modifiedTime`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body: multi });
      return r.json();
    },
    async apagar(id) { await chamar(`${API}/files/${id}`, { method: "DELETE" }); }
  };

  function idAparelho() {
    let a = ler("interlinear:aparelho");
    if (!a) { a = (crypto.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 8); guardar("interlinear:aparelho", a); }
    return a;
  }
  function nomeAparelho() {
    if (nativo) return plataforma === "android" ? "App Android" : "App iPhone";
    const ua = navigator.userAgent;
    const nav = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
    const so = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
    return so ? `${nav} no ${so}` : nav;
  }
  // Confere o acesso ao Drive: lê (ou cria) conta.json na pasta do app e registra este aparelho.
  async function verificarDrive() {
    const [arq] = await Drive.listar("conta.json");
    const agora = new Date().toISOString();
    const dados = arq ? await Drive.ler(arq.id) : { formato: "biblia-interlinear-conta", versao: 1, criado_em: agora, aparelhos: {} };
    dados.aparelhos = dados.aparelhos || {};
    dados.aparelhos[idAparelho()] = { nome: nomeAparelho(), visto_em: agora };
    await Drive.gravar("conta.json", dados, arq?.id);
    drive = { aparelhos: Object.keys(dados.aparelhos).length, verificado_em: agora };
    return dados;
  }

  async function perfil() {
    const r = await chamar("https://www.googleapis.com/oauth2/v3/userinfo");
    const p = await r.json();
    return { nome: p.name || p.email || "", email: p.email || "", foto: p.picture || "" };
  }

  // ---------- entrar e sair ----------
  async function entrar() {
    if (!disponivel) return;
    erro = "";
    const antes = estado;
    mudar("conectando");
    try {
      if (nativo) tokenAtual = await pedirTokenNativo(false);
      else { await carregarGIS(); tokenAtual = await pedirTokenWeb(conta ? "" : "select_account"); }
      conta = await perfil();
      guardar(CHAVE, JSON.stringify(conta));
      mudar("ligado");
      try { await verificarDrive(); mudar(); }
      catch (e) { erro = mensagem(e); mudar(); }
      aviso(`Conectado como ${conta.nome || conta.email}.`);
    } catch (e) {
      tokenAtual = null;
      if (e.codigo === "sem-drive") erro = "Para guardar no Drive, deixe marcada a permissão “Ver, criar e apagar os próprios dados de configuração no Google Drive”.";
      else if (e.codigo !== "cancelado" && e.codigo !== "popup_closed") erro = mensagem(e);
      mudar(antes === "conectando" ? (conta ? "reconectar" : "fora") : antes);
    }
  }
  function sair() {
    const tk = tokenAtual?.valor;
    tokenAtual = null; conta = null; drive = null; erro = "";
    guardar(CHAVE, null);
    if (tk && !nativo && window.google?.accounts?.oauth2) { try { google.accounts.oauth2.revoke(tk, () => {}); } catch (_) {} }
    if (nativo && plugin?.sair) plugin.sair().catch(() => {});
    mudar("fora");
    aviso("Você saiu da conta. As anotações continuam neste aparelho.");
  }
  function mensagem(e) {
    if (e.codigo === "drive-cheio") return "Seu Google Drive está sem espaço. As anotações continuam neste aparelho.";
    if (e.codigo === "sem-permissao") return "O Google recusou o acesso ao Drive. Tente entrar de novo.";
    if (e instanceof TypeError) return "Sem conexão com o Google agora. As anotações continuam neste aparelho.";
    return e.message || "Algo deu errado ao falar com o Google.";
  }
  function aviso(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { t.hidden = true; }, Math.max(3500, msg.length * 70));
  }

  // ---------- interface ----------
  const G = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const css = document.createElement("style");
  css.textContent = `
.conta { border-bottom: 1px solid var(--line); }
.conta[hidden] { display: none; }
.conta-t { margin: 0; font-weight: 600; }
.conta-s { margin: 4px 0 12px; color: var(--muted); font-size: 14px; line-height: 1.45; }
.gbtn { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 16px; border: 1px solid #747775; border-radius: 22px;
  background: #fff; color: #1f1f1f; font: 500 14px/1 Roboto, Arial, sans-serif; cursor: pointer; }
.gbtn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.gbtn[disabled] { opacity: .6; cursor: progress; }
.conta-eu { display: flex; align-items: center; gap: 12px; }
.conta-foto { width: 40px; height: 40px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; font-weight: 600; flex: none; overflow: hidden; }
.conta-foto img { width: 100%; height: 100%; object-fit: cover; }
.conta-nome { font-weight: 600; overflow-wrap: anywhere; }
.conta-email { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.conta-drive { margin: 10px 0 0; font-size: 14px; display: flex; align-items: center; gap: 8px; color: var(--muted); }
.conta-drive::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
.conta-drive.ok::before { background: #2e7d4f; }
.conta-drive.alerta::before { background: #b26a00; }
.conta-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.conta-acoes button { min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line); background: transparent; color: var(--fg); font: inherit; font-size: 14px; cursor: pointer; }
.conta-acoes button.prim { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.conta-erro { margin: 10px 0 0; color: light-dark(#a3361b, #f0a58f); font-size: 14px; }
.conta-sug { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 60;
  width: min(440px, calc(100% - 32px)); background: var(--surface); color: var(--fg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,.18); padding: 14px 16px; }
.conta-sug[hidden] { display: none; }
.conta-sug p { margin: 0 0 10px; font-size: 15px; line-height: 1.4; }
.conta-sug .linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.conta-sug .nao { min-height: 44px; padding: 0 14px; border: 0; background: transparent; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline; }
`;
  document.head.appendChild(css);

  const caixa = document.createElement("section");
  caixa.className = "sgroup conta"; caixa.id = "conta";
  caixa.setAttribute("aria-labelledby", "conta-h");
  caixa.setAttribute("aria-live", "polite");
  const toc = document.getElementById("toc");
  const cab = toc?.querySelector(".shead");
  if (cab) cab.after(caixa);

  const iniciais = n => (n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
  function blocoEu() {
    const foto = conta.foto ? `<img src="${esc(conta.foto)}" alt="" referrerpolicy="no-referrer">` : esc(iniciais(conta.nome));
    return `<div class="conta-eu"><div class="conta-foto">${foto}</div><div><div class="conta-nome" id="conta-h">${esc(conta.nome || conta.email)}</div><div class="conta-email">${esc(conta.email)}</div></div></div>`;
  }
  function desenhar() {
    caixa.hidden = estado === "indisponivel";
    if (caixa.hidden) return;
    const err = erro ? `<p class="conta-erro" role="alert">${esc(erro)}</p>` : "";
    if (estado === "fora" || (estado === "conectando" && !conta)) {
      caixa.innerHTML = `<h3 class="conta-t" id="conta-h">Guardar no seu Google Drive</h3>
        <p class="conta-s">Opcional. Suas anotações ficam numa pasta privada do app no seu Drive e passam a valer em todos os seus aparelhos. Sem conta, tudo continua neste aparelho.</p>
        <button class="gbtn" id="conta-entrar" ${estado === "conectando" ? "disabled" : ""}>${G}<span>${estado === "conectando" ? "Conectando…" : "Entrar com Google"}</span></button>${err}`;
    } else if (estado === "ligado") {
      const d = drive ? `<p class="conta-drive ok">Google Drive conectado · ${drive.aparelhos} ${drive.aparelhos === 1 ? "aparelho" : "aparelhos"}</p>`
        : erro ? "" : `<p class="conta-drive">Conferindo o Google Drive…</p>`;
      caixa.innerHTML = `${blocoEu()}${d}${err}<div class="conta-acoes"><button id="conta-sair">Sair</button></div>`;
    } else {   // reconectar ou conectando com conta lembrada
      caixa.innerHTML = `${blocoEu()}<p class="conta-drive alerta">${estado === "conectando" ? "Conectando…" : "Toque em Reconectar para voltar a salvar no Drive."}</p>${err}
        <div class="conta-acoes"><button class="prim" id="conta-entrar" ${estado === "conectando" ? "disabled" : ""}>Reconectar</button><button id="conta-sair">Sair</button></div>`;
    }
  }
  // carrega o script do Google pouco antes do toque, para o popup abrir ainda dentro do gesto da pessoa
  const preparar = e => { if (!nativo && e.target.closest?.("#conta-entrar, #cs-entrar")) carregarGIS().catch(() => {}); };
  ["pointerover", "pointerdown", "focusin", "touchstart"].forEach(t => document.addEventListener(t, preparar, { passive: true }));
  document.addEventListener("click", e => {
    if (e.target.closest("#conta-entrar, #cs-entrar")) { e.preventDefault(); fecharSugestao(); entrar(); }
    else if (e.target.closest("#conta-sair")) sair();
    else if (e.target.closest("#cs-nao")) { guardar(CHAVE_SUG, "nao"); fecharSugestao(); }
  });

  // sugestão depois da primeira anotação (uma vez por sessão; "Agora não" não pergunta mais)
  const sug = document.createElement("div");
  sug.className = "conta-sug"; sug.id = "conta-sug"; sug.hidden = true;
  sug.setAttribute("role", "dialog"); sug.setAttribute("aria-label", "Guardar no Google Drive");
  sug.innerHTML = `<p>Quer guardar suas anotações no seu Google Drive, para não perder e ver em outros aparelhos?</p>
    <div class="linha"><button class="gbtn" id="cs-entrar">${G}<span>Entrar com Google</span></button><button class="nao" id="cs-nao">Agora não</button></div>`;
  document.body.appendChild(sug);
  let sugerido = false;
  function fecharSugestao() { sug.hidden = true; }
  async function talvezSugerir() {
    if (sugerido || estado !== "fora" || ler(CHAVE_SUG) === "nao" || !window.Anotacoes) return;
    if ((await window.Anotacoes.contar()) < 1) return;
    sugerido = true;
    const tentar = () => {
      const ocupado = ["mbar", "nota", "minhas", "exportar"].some(id => { const el = document.getElementById(id); return el && !el.hidden; });
      if (ocupado) return setTimeout(tentar, 1200);
      if (estado === "fora") sug.hidden = false;
    };
    setTimeout(tentar, 1200);
  }
  if (window.Anotacoes?.aoMudar) window.Anotacoes.aoMudar(talvezSugerir);

  desenhar();
  // no app, quem já entrou volta conectado sem tela nenhuma
  if (nativo && disponivel && conta) {
    pedirTokenNativo(true).then(t => { tokenAtual = t; mudar("ligado"); return verificarDrive(); }).then(() => mudar())
      .catch(e => { if (estado === "ligado") { erro = mensagem(e); mudar(); } });
  }

  window.Conta = {
    disponivel: () => disponivel,
    estado: () => estado,
    conta: () => conta && { ...conta },
    entrar, sair, token, verificarDrive,
    drive: Drive,
    aoMudar: f => ouvintes.push(f)
  };
})();
