// Google simulado para os testes (nada sai para a internet):
//   - Google Identity Services falso (token na hora; window.__gisModo = "cancelar" | "sem-drive")
//   - API do Drive em memória, compartilhável entre vários "aparelhos" (contextos do navegador)
// (sem depender do @playwright/test: também é usado pelo gravador dos vídeos)
const confere = (ok, msg) => { if (!ok) throw new Error(msg); };

export const DRIVE = "https://www.googleapis.com/auth/drive.appdata";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS" };

const GIS_FALSO = `window.google = { accounts: { oauth2: {
  initTokenClient(c) { return { requestAccessToken(o) {
    (window.__gisPedidos = window.__gisPedidos || []).push(o);
    setTimeout(() => {
      const m = window.__gisModo || "ok";
      if (m === "cancelar") return c.error_callback({ type: "popup_closed" });
      c.callback({ access_token: "tk-" + Date.now(), expires_in: 3599,
        scope: m === "sem-drive" ? "openid email profile" : "openid email profile ${DRIVE}" });
    }, 60);
  } }; },
  hasGrantedAllScopes(r, ...s) { return s.every(x => r.scope.split(" ").includes(x)); },
  revoke(t, cb) { window.__revogado = t; cb && cb(); }
} } };`;

// A "nuvem": os arquivos da pasta do app
export function novaNuvem() {
  let t = Date.now(), n = 0;
  return {
    arquivos: new Map(),
    pedidos: [],
    hora() { t = Math.max(t + 1, Date.now()); return new Date(t).toISOString(); },
    criar(name, conteudo) { const id = "a" + (++n); this.arquivos.set(id, { name, conteudo, createdTime: this.hora() }); return id; },
    nomes(prefixo = "") { return [...this.arquivos.values()].filter(a => a.name.startsWith(prefixo)).map(a => a.name); },
    json(nome) { const a = [...this.arquivos.values()].find(a => a.name === nome); return a && JSON.parse(a.conteudo); },
    envelhecer(prefixo, dias) {   // simula arquivos antigos
      for (const a of this.arquivos.values()) if (a.name.startsWith(prefixo)) a.createdTime = new Date(Date.parse(a.createdTime) - dias * 864e5).toISOString();
    }
  };
}

function filtrar(arquivos, q) {
  let lista = [...arquivos.entries()].map(([id, a]) => ({ id, ...a }));
  for (const parte of (q || "").split(/\s+and\s+/).filter(Boolean)) {
    let m;
    if ((m = parte.match(/^name\s*=\s*'(.*)'$/))) lista = lista.filter(a => a.name === m[1]);
    else if ((m = parte.match(/^name contains '(.*)'$/))) lista = lista.filter(a => a.name.includes(m[1]));
    else if ((m = parte.match(/^createdTime\s*>\s*'(.*)'$/))) lista = lista.filter(a => a.createdTime > m[1]);
    else throw new Error("consulta não simulada: " + parte);
  }
  return lista.sort((a, b) => a.createdTime < b.createdTime ? -1 : 1);
}

export async function simularGoogle(page, { configurado = true, nuvem = novaNuvem(), perfil = {} } = {}) {
  const id = configurado ? "teste.apps.googleusercontent.com" : "";
  const eu = { name: "Maria Teste", email: "maria@exemplo.com", picture: "", ...perfil };
  await page.route("**/google-config.js", r => r.fulfill({ contentType: "text/javascript", body: `window.GOOGLE_CONFIG = { webClientId: "${id}" };` }));
  await page.route("https://accounts.google.com/gsi/client", r => r.fulfill({ contentType: "text/javascript", body: GIS_FALSO }));
  await page.route("https://www.googleapis.com/**", async r => {
    const req = r.request(), url = new URL(req.url()), m = req.method();
    if (m === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    if (!/^Bearer tk-/.test(req.headers()["authorization"] || "")) return r.fulfill({ status: 401, headers: CORS, json: { error: { message: "sem token" } } });
    const json = (status, body) => r.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
    nuvem.pedidos.push(m + " " + url.pathname);
    if (url.pathname === "/oauth2/v3/userinfo") return json(200, eu);
    const fid = url.pathname.match(/\/files\/([^/]+)$/)?.[1];
    if (m === "GET" && url.pathname === "/drive/v3/files") {
      confere(url.searchParams.get("spaces") === "appDataFolder", "fora da pasta do app");
      return json(200, { files: filtrar(nuvem.arquivos, url.searchParams.get("q")).map(({ id, name, createdTime }) => ({ id, name, createdTime })) });
    }
    if (fid && !nuvem.arquivos.has(fid)) return json(404, { error: { message: "não existe" } });
    if (m === "GET" && fid) return json(200, JSON.parse(nuvem.arquivos.get(fid).conteudo));
    if (m === "DELETE" && fid) { nuvem.arquivos.delete(fid); return r.fulfill({ status: 204, headers: CORS }); }
    if (m === "POST" && url.pathname === "/upload/drive/v3/files") {
      const partes = req.postData().split(/--biblia[a-z0-9]+/).filter(p => p.includes("{"));
      const meta = JSON.parse(partes[0].slice(partes[0].indexOf("{")).trim());
      confere(JSON.stringify(meta.parents) === '["appDataFolder"]', "arquivo fora da pasta do app");
      const novo = nuvem.criar(meta.name, partes[1].slice(partes[1].indexOf("{")).trim());
      return json(200, { id: novo, name: meta.name, createdTime: nuvem.arquivos.get(novo).createdTime });
    }
    if (m === "PATCH" && fid) { nuvem.arquivos.get(fid).conteudo = req.postData(); return json(200, { id: fid }); }
    return json(404, { error: { message: "não simulado: " + m + " " + url.pathname } });
  });
  return nuvem;
}
