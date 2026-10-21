/* Conta Google opcional: login e acesso à pasta privada do app no Google Drive (appDataFolder).
 * Sem servidor do projeto: o app fala direto com a API do Drive usando o token que o Google entrega no login.
 *   - Site: Google Identity Services, modelo de token (popup). O script do Google só é carregado quando a pessoa
 *     vai tocar em "Entrar com Google".
 *   - Android: plugin nativo GoogleAccount (API de autorização do Google Play services); renovação silenciosa.
 *   - iOS: ainda não (fica oculto).
 * O token fica só na memória; no aparelho fica guardado apenas nome, e-mail e foto, para mostrar a conta.
 * Expõe window.Account (status, signIn, signOut, token, drive.*) para a sincronização (fase 5).
 */
(function () {
  "use strict";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const SCOPES = ["openid", "email", "profile", DRIVE_SCOPE].join(" ");
  const API = "https://www.googleapis.com/drive/v3";
  const UP = "https://www.googleapis.com/upload/drive/v3";
  const GIS = "https://accounts.google.com/gsi/client";
  const ACCOUNT_KEY = "interlinear:conta",
    SUGGESTION_KEY = "interlinear:conta-sugestao";

  const Cap = window.Capacitor;
  const isNative = !!Cap?.isNativePlatform?.();
  const platform = isNative ? Cap.getPlatform() : "web";
  const plugin = isNative ? Cap.Plugins?.GoogleAccount : null;
  const cfg = window.GOOGLE_CONFIG || {};
  const available = isNative ? platform === "android" && !!plugin : !!cfg.webClientId;

  const readStorage = k => {
    try {
      return localStorage.getItem(k);
    } catch (_) {
      return null;
    }
  };
  const persist = (k, v) => {
    try {
      v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch (_) {}
  };
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  let account = null; // { nome, email, foto }
  try {
    account = JSON.parse(readStorage(ACCOUNT_KEY) || "null");
  } catch (_) {}
  let currentToken = null; // { valor, expira }
  let accountStatus = !available ? "unavailable" : account ? "reconnect" : "signed-out";
  let drive = null; // resumo de conta.json no Drive: { aparelhos }
  let errorMsg = "";
  const listeners = [];
  function setState(fresh) {
    if (fresh) accountStatus = fresh;
    render();
    listeners.forEach(f => {
      try {
        f(accountStatus);
      } catch (_) {}
    });
  }

  // ---------- token ----------
  let gisPromise = null;
  function loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    if (!gisPromise)
      gisPromise = new Promise((ok, failure) => {
        const s = document.createElement("script");
        s.src = GIS;
        s.async = true;
        s.onload = () => ok();
        s.onerror = () => {
          gisPromise = null;
          failure(new Error("Não foi possível falar com o Google. Verifique a conexão."));
        };
        document.head.appendChild(s);
      });
    return gisPromise;
  }
  function requestWebToken(prompt) {
    return new Promise((ok, failure) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: cfg.webClientId,
        scope: SCOPES,
        callback: r => {
          if (r.error) return failure(Object.assign(new Error(r.error_description || r.error), { errorCode: r.error }));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE))
            return failure(Object.assign(new Error("Sem a permissão do Drive"), { errorCode: "no-drive" }));
          ok({ valor: r.access_token, expira: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
        },
        error_callback: e =>
          failure(
            Object.assign(new Error(e?.message || "Login cancelado."), {
              errorCode: e?.type === "popup_closed" ? "cancelled" : e?.type || "failed"
            })
          )
      });
      client.requestAccessToken({ prompt, login_hint: account?.email || undefined });
    });
  }
  async function requestNativeToken(silent) {
    let r;
    try {
      r = await plugin.authorize({ silent });
    } catch (e) {
      throw Object.assign(new Error(e?.message || "Login cancelado."), { errorCode: e?.code || "failed" });
    }
    if (!(r.scopes || []).includes(DRIVE_SCOPE)) throw Object.assign(new Error("Sem a permissão do Drive"), { errorCode: "no-drive" });
    // a API do Android não informa a validade; o Google entrega tokens de 1 hora
    return { valor: r.accessToken, expira: Date.now() + 55 * 60 * 1000 };
  }
  // Token válido para chamar o Drive. No Android renova sozinho; no site, se expirou, pede para reconectar.
  async function token() {
    if (currentToken && currentToken.expira - Date.now() > 60000) return currentToken.valor;
    currentToken = null;
    if (accountStatus === "signed-out" || accountStatus === "unavailable")
      throw Object.assign(new Error("Sem conta"), { errorCode: "signed-out" });
    if (isNative) {
      try {
        currentToken = await requestNativeToken(true);
        return currentToken.valor;
      } catch (e) {
        setState("reconnect");
        throw e;
      }
    }
    setState("reconnect");
    throw Object.assign(new Error("A conexão com o Google expirou."), { errorCode: "reconnect" });
  }

  // ---------- API do Google ----------
  async function callApi(url, options = {}, attempt = true) {
    const tk = await token();
    const r = await fetch(url, { ...options, headers: { ...(options.headers || {}), Authorization: "Bearer " + tk } });
    if (r.status === 401 && attempt) {
      currentToken = null;
      return callApi(url, options, false);
    }
    if (!r.ok) {
      let msg = "";
      try {
        msg = (await r.json()).error?.message || "";
      } catch (_) {}
      const errorCode =
        r.status === 403 && /storage|quota/i.test(msg) ? "drive-full" : r.status === 403 ? "no-permission" : "http-" + r.status;
      throw Object.assign(new Error(msg || `Erro ${r.status} no Google Drive`), { errorCode, status: r.status });
    }
    return r;
  }
  const Drive = {
    async listFiles(nome) {
      const q = nome ? `&q=${encodeURIComponent(`name='${nome.replace(/'/g, "\\'")}'`)}` : "";
      const r = await callApi(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=files(id,name,modifiedTime,size)${q}`);
      return (await r.json()).files || [];
    },
    // busca na pasta do app com uma consulta do Drive (q), seguindo as páginas
    async queryDrive(q) {
      const listSheet = [];
      let pageHtml = "";
      do {
        const r = await callApi(
          `${API}/files?spaces=appDataFolder&pageSize=1000&orderBy=createdTime&fields=nextPageToken,files(id,name,createdTime,size)` +
            (q ? `&q=${encodeURIComponent(q)}` : "") +
            (pageHtml ? `&pageToken=${pageHtml}` : "")
        );
        const d = await r.json();
        listSheet.push(...(d.files || []));
        pageHtml = d.nextPageToken || "";
      } while (pageHtml);
      return listSheet;
    },
    async readStorage(id) {
      return (await callApi(`${API}/files/${id}?alt=media`)).json();
    },
    async save(nome, payload, id) {
      const bodyHtml = JSON.stringify(payload);
      if (id) {
        const r = await callApi(`${UP}/files/${id}?uploadType=media&fields=id,name,modifiedTime`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: bodyHtml
        });
        return r.json();
      }
      const b = "biblia" + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name: nome, parents: ["appDataFolder"], mimeType: "application/json" });
      const multi = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${bodyHtml}\r\n--${b}--`;
      const r = await callApi(`${UP}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${b}` },
        body: multi
      });
      return r.json();
    },
    async removeRecord(id) {
      await callApi(`${API}/files/${id}`, { method: "DELETE" });
    }
  };

  function deviceIdOf() {
    let a = readStorage("interlinear:aparelho");
    if (!a) {
      a = (crypto.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 8);
      persist("interlinear:aparelho", a);
    }
    return a;
  }
  function deviceName() {
    if (isNative) return platform === "android" ? "App Android" : "App iPhone";
    const ua = navigator.userAgent;
    const nav = /Edg\//.test(ua)
      ? "Edge"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
    const os = /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iPhone"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
    return os ? `${nav} no ${os}` : nav;
  }
  // Confere o acesso ao Drive: lê (ou cria) conta.json na pasta do app e registra este aparelho.
  async function verifyDrive() {
    const [file] = await Drive.listFiles("conta.json");
    const currentTime = new Date().toISOString();
    const payload = file
      ? await Drive.readStorage(file.id)
      : { formato: "biblia-interlinear-conta", versao: 1, criado_em: currentTime, aparelhos: {} };
    payload.aparelhos = payload.aparelhos || {};
    payload.aparelhos[deviceIdOf()] = { nome: deviceName(), visto_em: currentTime };
    await Drive.save("conta.json", payload, file?.id);
    drive = { aparelhos: Object.keys(payload.aparelhos).length, verificado_em: currentTime };
    return payload;
  }

  async function profile() {
    const r = await callApi("https://www.googleapis.com/oauth2/v3/userinfo");
    const p = await r.json();
    return { nome: p.name || p.email || "", email: p.email || "", photo: p.picture || "" };
  }

  // ---------- entrar e sair ----------
  async function signIn() {
    if (!available) return;
    errorMsg = "";
    const before = accountStatus;
    setState("connecting");
    try {
      if (isNative) currentToken = await requestNativeToken(false);
      else {
        await loadGis();
        currentToken = await requestWebToken(account ? "" : "select_account");
      }
      account = await profile();
      persist(ACCOUNT_KEY, JSON.stringify(account));
      setState("connected");
      try {
        await verifyDrive();
        setState();
      } catch (e) {
        errorMsg = message(e);
        setState();
      }
      toastMsg(`Conectado como ${account.nome || account.email}.`);
    } catch (e) {
      currentToken = null;
      if (e.errorCode === "no-drive")
        errorMsg =
          "Para guardar no Drive, deixe marcada a permissão “Ver, criar e apagar os próprios dados de configuração no Google Drive”.";
      else if (e.errorCode !== "cancelled" && e.errorCode !== "popup_closed") errorMsg = message(e);
      setState(before === "connecting" ? (account ? "reconnect" : "signed-out") : before);
    }
  }
  // Sair: pergunta se mantém as anotações neste aparelho (útil em aparelho emprestado apagar)
  async function askSignOut() {
    const n = window.Annotations ? await window.Annotations.countAll() : 0;
    if (!n) return signOut();
    const r = await ask("Sair da conta", `As ${n} anotações continuam guardadas no seu Google Drive. Neste aparelho, você quer:`, [
      { id: "manter", texto: "Manter uma cópia aqui", prim: true },
      { id: "apagar", texto: "Apagar deste aparelho" },
      { id: "", texto: "Cancelar" }
    ]);
    if (!r) return;
    if (r === "apagar") {
      await window.Sync?.beforeWipe?.();
      await window.Annotations.storage.wipeAll();
    }
    signOut(r === "apagar" ? "Você saiu da conta e as anotações foram apagadas deste aparelho." : undefined);
  }
  // Apagar da nuvem: remove tudo da pasta do app no Drive; o aparelho continua com a cópia local
  async function deleteCloudData() {
    const r = await ask(
      "Apagar meus dados do Google Drive",
      "Isso apaga a pasta do app no seu Drive (anotações e lista de aparelhos). As anotações deste aparelho continuam aqui, e você sai da conta. Outros aparelhos ainda conectados podem enviá-las de novo.",
      [
        { id: "sim", texto: "Apagar do Drive", perigo: true },
        { id: "", texto: "Cancelar", prim: true }
      ]
    );
    if (r !== "sim") return;
    try {
      await window.Sync?.halt?.();
      const fileList = await Drive.queryDrive("");
      for (const a of fileList) await Drive.removeRecord(a.id);
      await window.Annotations?.storage?.estado("sinc", null);
      signOut("Seus dados foram apagados do Google Drive. As anotações continuam neste aparelho.");
    } catch (e) {
      errorMsg = message(e);
      setState();
    }
  }
  function signOut(msg) {
    const tk = currentToken?.valor;
    currentToken = null;
    account = null;
    drive = null;
    errorMsg = "";
    persist(ACCOUNT_KEY, null);
    if (tk && !isNative && window.google?.accounts?.oauth2) {
      try {
        google.accounts.oauth2.revoke(tk, () => {});
      } catch (_) {}
    }
    if (isNative && plugin?.signOut) plugin.signOut().catch(() => {});
    setState("signed-out");
    toastMsg(msg || "Você saiu da conta. As anotações continuam neste aparelho.");
  }
  function message(e) {
    if (e.errorCode === "drive-full") return "Seu Google Drive está sem espaço. As anotações continuam neste aparelho.";
    if (e.errorCode === "no-permission") return "O Google recusou o acesso ao Drive. Tente entrar de novo.";
    if (e instanceof TypeError) return "Sem conexão com o Google agora. As anotações continuam neste aparelho.";
    return e.message || "Algo deu errado ao falar com o Google.";
  }
  function toastMsg(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastMsg.t);
    toastMsg.t = setTimeout(
      () => {
        t.hidden = true;
      },
      Math.max(3500, msg.length * 70)
    );
  }

  // Janela de pergunta simples (sem os diálogos do navegador). Resolve com o id do botão escolhido ("" = cancelar).
  function ask(titulo, texto, buttons) {
    return new Promise(ok => {
      const backdrop = document.createElement("div");
      backdrop.className = "account-modal";
      backdrop.innerHTML = `<div class="account-box" role="alertdialog" aria-modal="true" aria-labelledby="cm-t" aria-describedby="cm-x">
        <h2 id="cm-t">${esc(titulo)}</h2><p id="cm-x">${esc(texto)}</p>
        <div class="account-actions">${buttons.map(b => `<button data-r="${esc(b.id)}" class="${b.prim ? "prim" : ""}${b.perigo ? " perigo" : ""}">${esc(b.texto)}</button>`).join("")}</div></div>`;
      const returnFocus = document.activeElement;
      const fim = r => {
        backdrop.remove();
        document.removeEventListener("keydown", onKey, true);
        returnFocus?.focus?.();
        ok(r);
      };
      const onKey = e => {
        if (e.key === "Escape") {
          e.stopPropagation();
          fim("");
        }
      };
      backdrop.addEventListener("click", e => {
        const b = e.target.closest("button[data-r]");
        if (b) fim(b.dataset.r);
        else if (e.target === backdrop) fim("");
      });
      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(backdrop);
      (backdrop.querySelector("button.prim") || backdrop.querySelector("button")).focus();
    });
  }

  // ---------- interface ----------
  const G =
    '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const css = document.createElement("style");
  css.textContent = `
.conta { border-bottom: 1px solid var(--line); }
.conta[hidden] { display: none; }
.account-t { margin: 0; font-weight: 600; }
.account-s { margin: 4px 0 12px; color: var(--muted); font-size: 14px; line-height: 1.45; }
.gbtn { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 16px; border: 1px solid #747775; border-radius: 22px;
  background: #fff; color: #1f1f1f; font: 500 14px/1 Roboto, Arial, sans-serif; cursor: pointer; }
.gbtn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.gbtn[disabled] { opacity: .6; cursor: progress; }
.account-me { display: flex; align-items: center; gap: 12px; }
.account-photo { width: 40px; height: 40px; border-radius: 50%; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; font-weight: 600; flex: none; overflow: hidden; }
.account-photo img { width: 100%; height: 100%; object-fit: cover; }
.account-name { font-weight: 600; overflow-wrap: anywhere; }
.account-email { color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.account-drive { margin: 10px 0 0; font-size: 14px; display: flex; align-items: center; gap: 8px; color: var(--muted); }
.account-drive::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); flex: none; }
.account-drive.ok::before { background: #2e7d4f; }
.account-drive.alerta::before { background: #b26a00; }
.account-sync { margin: 4px 0 0 16px; font-size: 13px; color: var(--muted); }
.account-sync.alerta { color: light-dark(#8a5300, #e8b25c); }
.account-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.account-actions button { min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line); background: transparent; color: var(--fg); font: inherit; font-size: 14px; cursor: pointer; }
.account-actions button.prim { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.account-error { margin: 10px 0 0; color: light-dark(#a3361b, #f0a58f); font-size: 14px; }
.account-actions button.perigo { border-color: light-dark(#a3361b, #f0a58f); color: light-dark(#a3361b, #f0a58f); }
.account-more { margin-top: 10px; }
.account-more button { border: 0; background: none; padding: 6px 0; color: var(--muted); font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; min-height: 32px; }
.account-modal { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,.45); display: grid; place-items: center; padding: 16px; }
.account-box { background: var(--surface); color: var(--fg); border-radius: 16px; padding: 20px; width: min(420px, 100%); box-shadow: 0 12px 40px rgba(0,0,0,.3); }
.account-box h2 { margin: 0 0 8px; font-size: 19px; }
.account-box p { margin: 0 0 4px; line-height: 1.5; font-size: 15px; }
.account-suggestion { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 60;
  width: min(440px, calc(100% - 32px)); background: var(--surface); color: var(--fg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,.18); padding: 14px 16px; }
.account-suggestion[hidden] { display: none; }
.account-suggestion p { margin: 0 0 10px; font-size: 15px; line-height: 1.4; }
.account-suggestion .linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.account-suggestion .nao { min-height: 44px; padding: 0 14px; border: 0; background: transparent; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline; }
`;
  document.head.appendChild(css);

  const accountBox = document.createElement("section");
  accountBox.className = "sgroup conta";
  accountBox.id = "conta";
  accountBox.setAttribute("aria-labelledby", "account-h");
  accountBox.setAttribute("aria-live", "polite");
  const toc = document.getElementById("toc");
  const headEl = toc?.querySelector(".shead");
  if (headEl) headEl.after(accountBox);

  const initials = n =>
    (n || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join("");
  function meBlock() {
    const photo = account.photo ? `<img src="${esc(account.photo)}" alt="" referrerpolicy="no-referrer">` : esc(initials(account.nome));
    return `<div class="account-me"><div class="account-photo">${photo}</div><div><div class="account-name" id="account-h">${esc(account.nome || account.email)}</div><div class="account-email">${esc(account.email)}</div></div></div>`;
  }
  function render() {
    accountBox.hidden = accountStatus === "unavailable";
    if (accountBox.hidden) return;
    const err = errorMsg ? `<p class="account-error" role="alert">${esc(errorMsg)}</p>` : "";
    if (accountStatus === "signed-out" || (accountStatus === "connecting" && !account)) {
      accountBox.innerHTML = `<h3 class="account-t" id="account-h">Guardar no seu Google Drive</h3>
        <p class="account-s">Opcional. Suas anotações ficam numa pasta privada do app no seu Drive e passam a valer em todos os seus aparelhos. Sem conta, tudo continua neste aparelho.</p>
        <button class="gbtn" id="account-signin" ${accountStatus === "connecting" ? "disabled" : ""}>${G}<span>${accountStatus === "connecting" ? "Conectando…" : "Entrar com Google"}</span></button>${err}`;
    } else if (accountStatus === "connected") {
      const ap = drive ? ` · ${drive.aparelhos} ${drive.aparelhos === 1 ? "aparelho" : "aparelhos"}` : "";
      const st = window.Sync?.statusSummary?.();
      const d =
        drive || st
          ? `<p class="account-drive ok">Google Drive conectado${ap}</p>`
          : errorMsg
            ? ""
            : `<p class="account-drive">Conferindo o Google Drive…</p>`;
      const s = st ? `<p class="account-sync ${esc(st.tipo)}" id="account-sync">${esc(st.texto)}</p>` : "";
      accountBox.innerHTML = `${meBlock()}${d}${s}${err}<div class="account-actions"><button id="account-signout">Sair</button></div>
        <div class="account-more"><button id="account-wipe-cloud">Apagar meus dados do Google Drive</button></div>`;
    } else {
      // reconectar ou conectando com conta lembrada
      accountBox.innerHTML = `${meBlock()}<p class="account-drive alerta">${accountStatus === "connecting" ? "Conectando…" : "Toque em Reconectar para voltar a salvar no Drive."}</p>${err}
        <div class="account-actions"><button class="prim" id="account-signin" ${accountStatus === "connecting" ? "disabled" : ""}>Reconectar</button><button id="account-signout">Sair</button></div>`;
    }
  }
  // carrega o script do Google pouco antes do toque, para o popup abrir ainda dentro do gesto da pessoa
  const prepare = e => {
    if (!isNative && e.target.closest?.("#account-signin, #cs-signin, .js-signin")) loadGis().catch(() => {});
  };
  ["pointerover", "pointerdown", "focusin", "touchstart"].forEach(t => document.addEventListener(t, prepare, { passive: true }));
  document.addEventListener("click", e => {
    if (e.target.closest("#account-signin, #cs-signin, .js-signin")) {
      e.preventDefault();
      closeSuggestion();
      signIn();
    } else if (e.target.closest("#account-signout")) askSignOut();
    else if (e.target.closest("#account-wipe-cloud")) deleteCloudData();
    else if (e.target.closest("#cs-dismiss")) {
      persist(SUGGESTION_KEY, "nao");
      closeSuggestion();
    }
  });

  // sugestão depois da primeira anotação (uma vez por sessão; "Agora não" não pergunta mais)
  const suggestion = document.createElement("div");
  suggestion.className = "account-suggestion";
  suggestion.id = "account-suggestion";
  suggestion.hidden = true;
  suggestion.setAttribute("role", "dialog");
  suggestion.setAttribute("aria-label", "Guardar no Google Drive");
  suggestion.innerHTML = `<p>Quer guardar suas anotações no seu Google Drive, para não perder e ver em outros aparelhos?</p>
    <div class="linha"><button class="gbtn" id="cs-signin">${G}<span>Entrar com Google</span></button><button class="nao" id="cs-dismiss">Agora não</button></div>`;
  document.body.appendChild(suggestion);
  let suggested = false;
  function closeSuggestion() {
    suggestion.hidden = true;
  }
  async function maybeSuggest() {
    if (suggested || accountStatus !== "signed-out" || readStorage(SUGGESTION_KEY) === "nao" || !window.Annotations) return;
    if ((await window.Annotations.countAll()) < 1) return;
    suggested = true;
    const attempt = () => {
      const busy = ["mbar", "nota", "minhas", "exportar"].some(id => {
        const el = document.getElementById(id);
        return el && !el.hidden;
      });
      if (busy) return setTimeout(attempt, 1200);
      if (accountStatus === "signed-out") suggestion.hidden = false;
    };
    setTimeout(attempt, 1200);
  }
  if (window.Annotations?.onChange) window.Annotations.onChange(maybeSuggest);
  // Se o painel de anotar abrir com a sugestão na tela, a sugestão sai da frente e volta quando o painel fechar
  new MutationObserver(() => {
    if (suggestion.hidden || !/\bcom-(mbar|nota|minhas)\b/.test(document.body.className)) return;
    suggestion.hidden = true;
    suggested = false;
    maybeSuggest();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  render();
  // no app, quem já entrou volta conectado sem tela nenhuma
  if (isNative && available && account) {
    requestNativeToken(true)
      .then(t => {
        currentToken = t;
        setState("connected");
        return verifyDrive();
      })
      .then(() => setState())
      .catch(e => {
        if (accountStatus === "connected") {
          errorMsg = message(e);
          setState();
        }
      });
  }

  window.Account = {
    available: () => available,
    status: () => accountStatus,
    account: () => account && { ...account },
    signIn,
    signOut,
    token,
    verifyDrive,
    ask,
    rerender: () => render(),
    drive: Drive,
    onChange: f => listeners.push(f)
  };
})();
