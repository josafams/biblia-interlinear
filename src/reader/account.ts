// The optional Google account: sign-in and access to the app's private folder in Google Drive (appDataFolder).
// No server of the project: the app talks straight to the Drive API with the token Google gives on sign-in.
//   - Site: Google Identity Services, token model (popup). Google's script loads only when the person is about
//     to tap "Entrar com Google".
//   - Android: the native GoogleAccount plugin (Google Play services authorization API); silent renewal.
//   - iOS: not yet (hidden).
// The token stays in memory only; the device keeps just the name, e-mail and photo, to show the account.
// window.Account (status, signIn, signOut, token, drive.*) is used by the sync, the progress and the tests.
import { flushSync, mount } from "svelte";
import AccountBox from "../components/AccountBox.svelte";
import AccountSuggestion from "../components/AccountSuggestion.svelte";
import AskDialog from "../components/AskDialog.svelte";
import { t } from "../i18n";
import { createDrive } from "../lib/account/drive";
import { exposedPlugin, isNative, platform } from "../lib/native";
import { type AccountStatus, accountView } from "../state/account.svelte";
import { annotate } from "../state/annotate.svelte";
import { ask } from "../state/ask.svelte";
import { exportView } from "../state/export.svelte";
import { note } from "../state/note.svelte";
import { notes } from "../state/notes.svelte";
import { showToast } from "../state/toast.svelte";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const SCOPES = ["openid", "email", "profile", DRIVE_SCOPE].join(" ");
const GIS = "https://accounts.google.com/gsi/client";
// localStorage keys (saved on the devices: they keep their names)
const ACCOUNT_KEY = "interlinear:conta"; // i18n-ignore
const SUGGESTION_KEY = "interlinear:conta-sugestao"; // i18n-ignore
const DEVICE_KEY = "interlinear:aparelho"; // i18n-ignore
const SIGN_IN = "#account-signin, #cs-signin, .js-signin"; // i18n-ignore

type Me = { nome: string; email: string; photo: string };
type Token = { valor: string; expira: number };
type Failure = Error & { errorCode?: string };
type TokenResponse = { error?: string; error_description?: string; access_token: string; expires_in?: string | number };
type Gis = {
  accounts: {
    oauth2: {
      initTokenClient(o: object): { requestAccessToken(o: object): void };
      hasGrantedAllScopes(r: TokenResponse, scope: string): boolean;
      revoke(token: string, done: () => void): void;
    };
  };
};
type Plugin = {
  authorize(o: { silent: boolean }): Promise<{ accessToken: string; scopes?: string[] }>;
  signOut?(): Promise<void>;
};
type AccountFile = { formato: string; versao: number; criado_em: string; aparelhos: Record<string, { nome: string; visto_em: string }> };

declare global {
  interface Window {
    GOOGLE_CONFIG?: { webClientId?: string };
    google?: Gis;
  }
}

const failure = (message: string, errorCode: string): Failure => Object.assign(new Error(message), { errorCode });
const readStorage = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const persist = (k: string, v: string | null) => {
  try {
    if (v == null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    /* private mode: nothing is remembered */
  }
};
const toastMsg = (msg: string) => showToast(msg);

const plugin = exposedPlugin<Plugin>("GoogleAccount");
const cfg = window.GOOGLE_CONFIG || {};
const available = isNative ? platform === "android" && !!plugin : !!cfg.webClientId;

let account: Me | null = null;
try {
  account = JSON.parse(readStorage(ACCOUNT_KEY) || "null");
} catch {
  account = null;
}
let currentToken: Token | null = null;
let status: AccountStatus = !available ? "unavailable" : account ? "reconnect" : "signed-out";
let drive: { aparelhos: number; verificado_em: string } | null = null;
let errorMsg = "";
const listeners: ((s: AccountStatus) => void)[] = [];

function render() {
  accountView.status = status;
  accountView.me = account ? { nome: account.nome, email: account.email, photo: account.photo } : null;
  accountView.devices = drive ? drive.aparelhos : null;
  accountView.sync = status === "connected" ? ((window.Sync?.statusSummary as () => typeof accountView.sync)?.() ?? null) : null;
  accountView.error = errorMsg || "";
  flushSync();
}
function setState(fresh?: AccountStatus) {
  if (fresh) status = fresh;
  render();
  for (const f of listeners)
    try {
      f(status);
    } catch {
      /* a listener's error does not stop the others */
    }
}

// ---------- token ----------
let gisPromise: Promise<void> | null = null;
function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisPromise ??= new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = GIS;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => {
      gisPromise = null;
      fail(new Error(t("account.google_unreachable")));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
}
function requestWebToken(prompt: string) {
  const oauth2 = window.google!.accounts.oauth2;
  return new Promise<Token>((ok, fail) => {
    const client = oauth2.initTokenClient({
      client_id: cfg.webClientId,
      scope: SCOPES,
      callback: (r: TokenResponse) => {
        if (r.error) return fail(failure(r.error_description || r.error, r.error));
        if (!oauth2.hasGrantedAllScopes(r, DRIVE_SCOPE)) return fail(failure(t("account.no_drive_short"), "no-drive"));
        ok({ valor: r.access_token, expira: Date.now() + (Number(r.expires_in) || 3600) * 1000 });
      },
      error_callback: (e?: { message?: string; type?: string }) =>
        fail(failure(e?.message || t("account.cancelled"), e?.type === "popup_closed" ? "cancelled" : e?.type || "failed"))
    });
    client.requestAccessToken({ prompt, login_hint: account?.email || undefined });
  });
}
async function requestNativeToken(silent: boolean): Promise<Token> {
  let r;
  try {
    r = await plugin!.authorize({ silent });
  } catch (err) {
    const e = err as { message?: string; code?: string };
    throw failure(e?.message || t("account.cancelled"), e?.code || "failed");
  }
  if (!(r.scopes || []).includes(DRIVE_SCOPE)) throw failure(t("account.no_drive_short"), "no-drive");
  // the Android API does not tell the validity; Google gives 1-hour tokens
  return { valor: r.accessToken, expira: Date.now() + 55 * 60 * 1000 };
}
/** A valid token for the Drive. On Android it renews by itself; on the site, once expired, it asks to reconnect. */
async function token() {
  if (currentToken && currentToken.expira - Date.now() > 60000) return currentToken.valor;
  currentToken = null;
  if (status === "signed-out" || status === "unavailable") throw failure(t("account.no_account"), "signed-out");
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
  throw failure(t("account.expired"), "reconnect");
}

// ---------- Google Drive (src/lib/account/drive.ts) ----------
const Drive = createDrive(token, () => {
  currentToken = null;
});

function deviceId() {
  let a = readStorage(DEVICE_KEY);
  if (!a) {
    a = (crypto.randomUUID?.() || String(Math.random()).slice(2)).slice(0, 8);
    persist(DEVICE_KEY, a);
  }
  return a;
}
function deviceName() {
  if (isNative) return t(platform === "android" ? "account.app_android" : "account.app_iphone");
  const ua = navigator.userAgent;
  const BROWSERS: [RegExp, string][] = [
    [/Edg\//, "Edge"],
    [/Firefox\//, "Firefox"],
    [/Chrome\//, "Chrome"],
    [/Safari\//, "Safari"]
  ];
  const SYSTEMS: [RegExp, string][] = [
    [/Android/, "Android"],
    [/iPhone|iPad/, "iPhone"],
    [/Windows/, "Windows"],
    [/Mac OS/, "Mac"],
    [/Linux/, "Linux"]
  ];
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1] || t("account.browser");
  const os = SYSTEMS.find(([re]) => re.test(ua))?.[1];
  return os ? t("account.browser_on", { browser, os }) : browser;
}
/** Checks the access to the Drive: reads (or makes) conta.json in the app folder and adds this device to it. */
async function verifyDrive() {
  const [file] = await Drive.listFiles("conta.json");
  const now = new Date().toISOString();
  const payload: AccountFile = file
    ? ((await Drive.readStorage(file.id)) as AccountFile)
    : { formato: "biblia-interlinear-conta", versao: 1, criado_em: now, aparelhos: {} };
  payload.aparelhos = payload.aparelhos || {};
  payload.aparelhos[deviceId()] = { nome: deviceName(), visto_em: now };
  await Drive.save("conta.json", payload, file?.id);
  drive = { aparelhos: Object.keys(payload.aparelhos).length, verificado_em: now };
  return payload;
}
async function profile(): Promise<Me> {
  const r = await Drive.request("https://www.googleapis.com/oauth2/v3/userinfo");
  const p = await r.json();
  return { nome: p.name || p.email || "", email: p.email || "", photo: p.picture || "" };
}

function message(err: unknown) {
  const e = err as Failure;
  if (e.errorCode === "drive-full") return t("account.drive_full");
  if (e.errorCode === "no-permission") return t("account.no_permission");
  if (e instanceof TypeError) return t("account.offline");
  return e.message || t("account.failed");
}

// ---------- signing in and out ----------
async function signIn() {
  if (!available) return;
  errorMsg = "";
  const before = status;
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
    } catch (e) {
      errorMsg = message(e);
    }
    setState();
    toastMsg(t("account.connected_as", { name: account.nome || account.email }));
  } catch (err) {
    const e = err as Failure;
    currentToken = null;
    if (e.errorCode === "no-drive") errorMsg = t("account.no_drive");
    else if (e.errorCode !== "cancelled" && e.errorCode !== "popup_closed") errorMsg = message(e);
    setState(before === "connecting" ? (account ? "reconnect" : "signed-out") : before);
  }
}
type Records = { countAll(): Promise<number>; storage: { wipeAll(): Promise<void>; estado(k: string, v: unknown): Promise<unknown> } };
const records = () => window.Annotations as unknown as Records | undefined;
const sync = () => window.Sync as { beforeWipe?(): Promise<void>; halt?(): Promise<void> } | undefined;

// Signing out asks whether the annotations stay on this device (a borrowed device: delete them)
async function askSignOut() {
  const n = records() ? await records()!.countAll() : 0;
  if (!n) return signOut();
  const r = await ask(t("account.sign_out_title"), t("account.sign_out_text", { count: n }), [
    { id: "manter", texto: t("account.keep_here"), prim: true },
    { id: "apagar", texto: t("account.delete_here") },
    { id: "", texto: t("account.cancel") }
  ]);
  if (!r) return;
  if (r === "apagar") {
    await sync()?.beforeWipe?.();
    await records()!.storage.wipeAll();
  }
  signOut(r === "apagar" ? t("account.signed_out_wiped") : undefined);
}
// Deleting from the cloud: removes everything in the app folder of the Drive; the device keeps its copy
async function deleteCloudData() {
  const r = await ask(t("account.wipe_cloud"), t("account.wipe_text"), [
    { id: "sim", texto: t("account.wipe_yes"), perigo: true },
    { id: "", texto: t("account.cancel"), prim: true }
  ]);
  if (r !== "sim") return;
  try {
    await sync()?.halt?.();
    for (const a of await Drive.queryDrive("")) await Drive.removeRecord(a.id);
    await records()?.storage?.estado("sinc", null);
    signOut(t("account.wiped"));
  } catch (e) {
    errorMsg = message(e);
    setState();
  }
}
function signOut(msg?: string) {
  const tk = currentToken?.valor;
  currentToken = null;
  account = null;
  drive = null;
  errorMsg = "";
  persist(ACCOUNT_KEY, null);
  if (tk && !isNative && window.google?.accounts?.oauth2)
    try {
      window.google.accounts.oauth2.revoke(tk, () => {});
    } catch {
      /* the token expires by itself */
    }
  if (isNative && plugin?.signOut) plugin.signOut().catch(() => {});
  setState("signed-out");
  toastMsg(msg || t("account.signed_out"));
}

// ---------- the suggestion after the first annotation ----------
let suggested = false;
async function maybeSuggest() {
  if (suggested || status !== "signed-out" || readStorage(SUGGESTION_KEY) === "nao" || !records()) return;
  if ((await records()!.countAll()) < 1) return;
  suggested = true;
  const attempt = () => {
    if (annotate.open || note.open || notes.open || exportView.open) return void setTimeout(attempt, 1200);
    if (status === "signed-out") accountView.suggestion = true;
  };
  setTimeout(attempt, 1200);
}

export function initAccount() {
  // the account is in Você in the index (YouSection.svelte); pages without it show it under the index title
  const headEl = document.getElementById("toc")?.querySelector(".shead");
  if (!document.getElementById("toc-account") && headEl) mount(AccountBox, { target: headEl.parentElement!, anchor: headEl.nextSibling! });
  mount(AskDialog, { target: document.body });
  mount(AccountSuggestion, {
    target: document.body,
    props: {
      onaway() {
        suggested = false;
        maybeSuggest();
      }
    }
  });
  // Google's script loads just before the tap, so the popup opens still inside the person's gesture
  const prepare = (e: Event) => {
    if (!isNative && (e.target as HTMLElement).closest?.(SIGN_IN)) loadGis().catch(() => {});
  };
  for (const ev of ["pointerover", "pointerdown", "focusin", "touchstart"]) document.addEventListener(ev, prepare, { passive: true });
  document.addEventListener("click", e => {
    const target = e.target as HTMLElement;
    if (target.closest(SIGN_IN)) {
      e.preventDefault();
      accountView.suggestion = false;
      signIn();
    } else if (target.closest("#account-signout")) askSignOut();
    else if (target.closest("#account-wipe-cloud")) deleteCloudData();
    else if (target.closest("#cs-dismiss")) {
      persist(SUGGESTION_KEY, "nao");
      accountView.suggestion = false;
    }
  });
  (window.Annotations?.onChange as ((f: () => void) => void) | undefined)?.(maybeSuggest);
  render();
  // in the app, whoever signed in comes back connected without any screen
  if (isNative && available && account)
    requestNativeToken(true)
      .then(tk => {
        currentToken = tk;
        setState("connected");
        return verifyDrive();
      })
      .then(() => setState())
      .catch(e => {
        if (status === "connected") {
          errorMsg = message(e);
          setState();
        }
      });
  window.Account = {
    available: () => available,
    status: () => status,
    account: () => account && { ...account },
    signIn,
    signOut,
    token,
    verifyDrive,
    ask,
    rerender: () => render(),
    drive: Drive,
    onChange: (f: (s: AccountStatus) => void) => listeners.push(f)
  } as unknown as Window["Account"];
}

// starts when imported, after the annotations (see src/reader/main.ts)
initAccount();
