/* Conta Google opcional: login e acesso à pasta privada do app no Google Drive (appDataFolder).
 * Sem servidor do projeto: o app fala direto com a API do Drive usando o token que o Google entrega no login.
 *   - Site: Google Identity Services, modelo de token (popup). O script do Google só é carregado quando a pessoa
 *     vai tocar em "Entrar com Google".
 *   - Android: plugin nativo ContaGoogle (API de autorização do Google Play services); renovação silenciosa.
 *   - iOS: ainda não (fica oculto).
 * O token fica só na memória; no aparelho fica guardado apenas nome, e-mail e foto, para mostrar a conta.
 * Expõe window.Account (estado, entrar, sair, token, drive.*) para a sincronização (fase 5).
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
  const plugin = isNative ? Cap.Plugins?.ContaGoogle : null;
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
  let estado = !available ? "indisponivel" : account ? "reconectar" : "fora";
  let drive = null; // resumo de conta.json no Drive: { aparelhos }
  let errorMsg = "";
  const listeners = [];
  function setState(fresh) {
    if (fresh) estado = fresh;
    render();
    listeners.forEach(f => {
      try {
        f(estado);
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
          if (r.error) return failure(Object.assign(new Error(r.error_description || r.error), { markCode: r.error }));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE))
            return failure(Object.assign(new Error("Sem a permissão do Drive"), { markCode: "sem-drive" }));
          ok({ valor: r.access_token, expira: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
        },
        error_callback: e =>
          failure(
            Object.assign(new Error(e?.message || "Login cancelado."), {
              markCode: e?.type === "popup_closed" ? "cancelado" : e?.type || "falhou"
            })
          )
      });
      client.requestAccessToken({ prompt, login_hint: account?.email || undefined });
    });
  }
  async function requestNativeToken(silent) {
    let r;
    try {
      r = await plugin.autorizar({ silent });
    } catch (e) {
      throw Object.assign(new Error(e?.message || "Login cancelado."), { markCode: e?.code || "falhou" });
    }
    if (!(r.escopos || []).includes(DRIVE_SCOPE)) throw Object.assign(new Error("Sem a permissão do Drive"), { markCode: "sem-drive" });
    // a API do Android não informa a validade; o Google entrega tokens de 1 hora
    return { valor: r.accessToken, expira: Date.now() + 55 * 60 * 1000 };
  }
  // Token válido para chamar o Drive. No Android renova sozinho; no site, se expirou, pede para reconectar.
  async function token() {
    if (currentToken && currentToken.expira - Date.now() > 60000) return currentToken.valor;
    currentToken = null;
    if (estado === "fora" || estado === "indisponivel") throw Object.assign(new Error("Sem conta"), { markCode: "fora" });
    if (isNative) {
      try {
        currentToken = await requestNativeToken(true);
        return currentToken.valor;
      } catch (e) {
        setState("reconectar");
        throw e;
      }
    }
    setState("reconectar");
    throw Object.assign(new Error("A conexão com o Google expirou."), { markCode: "reconectar" });
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
      const markCode =
        r.status === 403 && /storage|quota/i.test(msg) ? "drive-cheio" : r.status === 403 ? "sem-permissao" : "http-" + r.status;
      throw Object.assign(new Error(msg || `Erro ${r.status} no Google Drive`), { markCode, status: r.status });
    }
    return r;
  }
  const Drive = {
    async listar(nome) {
      const q = nome ? `&q=${encodeURIComponent(`name='${nome.replace(/'/g, "\\'")}'`)}` : "";
      const r = await callApi(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=files(id,name,modifiedTime,size)${q}`);
      return (await r.json()).files || [];
    },
    // busca na pasta do app com uma consulta do Drive (q), seguindo as páginas
    async consultar(q) {
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
    async apagar(id) {
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
    const [file] = await Drive.listar("conta.json");
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
    const before = estado;
    setState("conectando");
    try {
      if (isNative) currentToken = await requestNativeToken(false);
      else {
        await loadGis();
        currentToken = await requestWebToken(account ? "" : "select_account");
      }
      account = await profile();
      persist(ACCOUNT_KEY, JSON.stringify(account));
      setState("ligado");
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
      if (e.markCode === "sem-drive")
        errorMsg =
          "Para guardar no Drive, deixe marcada a permissão “Ver, criar e apagar os próprios dados de configuração no Google Drive”.";
      else if (e.markCode !== "cancelado" && e.markCode !== "popup_closed") errorMsg = message(e);
      setState(before === "conectando" ? (account ? "reconectar" : "fora") : before);
    }
  }
  // Sair: pergunta se mantém as anotações neste aparelho (útil em aparelho emprestado apagar)
  async function askSignOut() {
    const n = window.Annotations ? await window.Annotations.contar() : 0;
    if (!n) return signOut();
    const r = await ask("Sair da conta", `As ${n} anotações continuam guardadas no seu Google Drive. Neste aparelho, você quer:`, [
      { id: "manter", texto: "Manter uma cópia aqui", prim: true },
      { id: "apagar", texto: "Apagar deste aparelho" },
      { id: "", texto: "Cancelar" }
    ]);
    if (!r) return;
    if (r === "apagar") {
      await window.Sync?.antesDeApagar?.();
      await window.Annotations.storage.apagarTudo();
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
      await window.Sync?.parar?.();
      const fileList = await Drive.consultar("");
      for (const a of fileList) await Drive.apagar(a.id);
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
    setState("fora");
    toastMsg(msg || "Você saiu da conta. As anotações continuam neste aparelho.");
  }
  function message(e) {
    if (e.markCode === "drive-cheio") return "Seu Google Drive está sem espaço. As anotações continuam neste aparelho.";
    if (e.markCode === "sem-permissao") return "O Google recusou o acesso ao Drive. Tente entrar de novo.";
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
      backdrop.className = "conta-modal";
      backdrop.innerHTML = `<div class="conta-caixa" role="alertdialog" aria-modal="true" aria-labelledby="cm-t" aria-describedby="cm-x">
        <h2 id="cm-t">${esc(titulo)}</h2><p id="cm-x">${esc(texto)}</p>
        <div class="conta-acoes">${buttons.map(b => `<button data-r="${esc(b.id)}" class="${b.prim ? "prim" : ""}${b.perigo ? " perigo" : ""}">${esc(b.texto)}</button>`).join("")}</div></div>`;
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
.conta-sinc { margin: 4px 0 0 16px; font-size: 13px; color: var(--muted); }
.conta-sinc.alerta { color: light-dark(#8a5300, #e8b25c); }
.conta-acoes { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.conta-acoes button { min-height: 40px; padding: 0 14px; border-radius: 20px; border: 1px solid var(--line); background: transparent; color: var(--fg); font: inherit; font-size: 14px; cursor: pointer; }
.conta-acoes button.prim { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.conta-erro { margin: 10px 0 0; color: light-dark(#a3361b, #f0a58f); font-size: 14px; }
.conta-acoes button.perigo { border-color: light-dark(#a3361b, #f0a58f); color: light-dark(#a3361b, #f0a58f); }
.conta-mais { margin-top: 10px; }
.conta-mais button { border: 0; background: none; padding: 6px 0; color: var(--muted); font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; min-height: 32px; }
.conta-modal { position: fixed; inset: 0; z-index: 90; background: rgba(0,0,0,.45); display: grid; place-items: center; padding: 16px; }
.conta-caixa { background: var(--surface); color: var(--fg); border-radius: 16px; padding: 20px; width: min(420px, 100%); box-shadow: 0 12px 40px rgba(0,0,0,.3); }
.conta-caixa h2 { margin: 0 0 8px; font-size: 19px; }
.conta-caixa p { margin: 0 0 4px; line-height: 1.5; font-size: 15px; }
.conta-sug { position: fixed; left: 50%; bottom: calc(16px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 60;
  width: min(440px, calc(100% - 32px)); background: var(--surface); color: var(--fg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,.18); padding: 14px 16px; }
.conta-sug[hidden] { display: none; }
.conta-sug p { margin: 0 0 10px; font-size: 15px; line-height: 1.4; }
.conta-sug .linha { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.conta-sug .nao { min-height: 44px; padding: 0 14px; border: 0; background: transparent; color: var(--accent); font: inherit; cursor: pointer; text-decoration: underline; }
`;
  document.head.appendChild(css);

  const accountBox = document.createElement("section");
  accountBox.className = "sgroup conta";
  accountBox.id = "conta";
  accountBox.setAttribute("aria-labelledby", "conta-h");
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
    return `<div class="conta-eu"><div class="conta-foto">${photo}</div><div><div class="conta-nome" id="conta-h">${esc(account.nome || account.email)}</div><div class="conta-email">${esc(account.email)}</div></div></div>`;
  }
  function render() {
    accountBox.hidden = estado === "indisponivel";
    if (accountBox.hidden) return;
    const err = errorMsg ? `<p class="conta-erro" role="alert">${esc(errorMsg)}</p>` : "";
    if (estado === "fora" || (estado === "conectando" && !account)) {
      accountBox.innerHTML = `<h3 class="conta-t" id="conta-h">Guardar no seu Google Drive</h3>
        <p class="conta-s">Opcional. Suas anotações ficam numa pasta privada do app no seu Drive e passam a valer em todos os seus aparelhos. Sem conta, tudo continua neste aparelho.</p>
        <button class="gbtn" id="conta-entrar" ${estado === "conectando" ? "disabled" : ""}>${G}<span>${estado === "conectando" ? "Conectando…" : "Entrar com Google"}</span></button>${err}`;
    } else if (estado === "ligado") {
      const ap = drive ? ` · ${drive.aparelhos} ${drive.aparelhos === 1 ? "aparelho" : "aparelhos"}` : "";
      const st = window.Sync?.resumo?.();
      const d =
        drive || st
          ? `<p class="conta-drive ok">Google Drive conectado${ap}</p>`
          : errorMsg
            ? ""
            : `<p class="conta-drive">Conferindo o Google Drive…</p>`;
      const s = st ? `<p class="conta-sinc ${esc(st.tipo)}" id="conta-sinc">${esc(st.texto)}</p>` : "";
      accountBox.innerHTML = `${meBlock()}${d}${s}${err}<div class="conta-acoes"><button id="conta-sair">Sair</button></div>
        <div class="conta-mais"><button id="conta-apagar-nuvem">Apagar meus dados do Google Drive</button></div>`;
    } else {
      // reconectar ou conectando com conta lembrada
      accountBox.innerHTML = `${meBlock()}<p class="conta-drive alerta">${estado === "conectando" ? "Conectando…" : "Toque em Reconectar para voltar a salvar no Drive."}</p>${err}
        <div class="conta-acoes"><button class="prim" id="conta-entrar" ${estado === "conectando" ? "disabled" : ""}>Reconectar</button><button id="conta-sair">Sair</button></div>`;
    }
  }
  // carrega o script do Google pouco antes do toque, para o popup abrir ainda dentro do gesto da pessoa
  const prepare = e => {
    if (!isNative && e.target.closest?.("#conta-entrar, #cs-entrar, .js-entrar")) loadGis().catch(() => {});
  };
  ["pointerover", "pointerdown", "focusin", "touchstart"].forEach(t => document.addEventListener(t, prepare, { passive: true }));
  document.addEventListener("click", e => {
    if (e.target.closest("#conta-entrar, #cs-entrar, .js-entrar")) {
      e.preventDefault();
      closeSuggestion();
      signIn();
    } else if (e.target.closest("#conta-sair")) askSignOut();
    else if (e.target.closest("#conta-apagar-nuvem")) deleteCloudData();
    else if (e.target.closest("#cs-nao")) {
      persist(SUGGESTION_KEY, "nao");
      closeSuggestion();
    }
  });

  // sugestão depois da primeira anotação (uma vez por sessão; "Agora não" não pergunta mais)
  const suggestion = document.createElement("div");
  suggestion.className = "conta-sug";
  suggestion.id = "conta-sug";
  suggestion.hidden = true;
  suggestion.setAttribute("role", "dialog");
  suggestion.setAttribute("aria-label", "Guardar no Google Drive");
  suggestion.innerHTML = `<p>Quer guardar suas anotações no seu Google Drive, para não perder e ver em outros aparelhos?</p>
    <div class="linha"><button class="gbtn" id="cs-entrar">${G}<span>Entrar com Google</span></button><button class="nao" id="cs-nao">Agora não</button></div>`;
  document.body.appendChild(suggestion);
  let suggested = false;
  function closeSuggestion() {
    suggestion.hidden = true;
  }
  async function maybeSuggest() {
    if (suggested || estado !== "fora" || readStorage(SUGGESTION_KEY) === "nao" || !window.Annotations) return;
    if ((await window.Annotations.contar()) < 1) return;
    suggested = true;
    const attempt = () => {
      const busy = ["mbar", "nota", "minhas", "exportar"].some(id => {
        const el = document.getElementById(id);
        return el && !el.hidden;
      });
      if (busy) return setTimeout(attempt, 1200);
      if (estado === "fora") suggestion.hidden = false;
    };
    setTimeout(attempt, 1200);
  }
  if (window.Annotations?.aoMudar) window.Annotations.aoMudar(maybeSuggest);

  render();
  // no app, quem já entrou volta conectado sem tela nenhuma
  if (isNative && available && account) {
    requestNativeToken(true)
      .then(t => {
        currentToken = t;
        setState("ligado");
        return verifyDrive();
      })
      .then(() => setState())
      .catch(e => {
        if (estado === "ligado") {
          errorMsg = message(e);
          setState();
        }
      });
  }

  window.Account = {
    available: () => available,
    estado: () => estado,
    account: () => account && { ...account },
    signIn,
    signOut,
    token,
    verifyDrive,
    ask,
    redesenhar: () => render(),
    drive: Drive,
    aoMudar: f => listeners.push(f)
  };
})();
