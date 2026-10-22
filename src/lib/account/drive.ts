// Google Drive REST calls on the app's hidden folder (appDataFolder): the files of the sync and of the account.
// Errors carry an errorCode the screens understand: "drive-full", "no-permission" or "http-<status>".
import { t } from "../../i18n";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

export type DriveError = Error & { errorCode: string; status: number };

/**
 * token(): a valid access token (it throws, with its own errorCode, when the person has to reconnect);
 * forgetToken(): the token was refused (401): the next token() gets a new one.
 */
export function createDrive(token: () => Promise<string>, forgetToken: () => void) {
  async function call(url: string, options: RequestInit = {}, retry = true): Promise<Response> {
    const tk = await token();
    const r = await fetch(url, {
      ...options,
      headers: { ...((options.headers as Record<string, string>) || {}), Authorization: "Bearer " + tk }
    });
    if (r.status === 401 && retry) {
      forgetToken();
      return call(url, options, false);
    }
    if (!r.ok) {
      let msg = "";
      try {
        msg = (await r.json()).error?.message || "";
      } catch {
        /* no JSON body */
      }
      const errorCode =
        r.status === 403 && /storage|quota/i.test(msg) ? "drive-full" : r.status === 403 ? "no-permission" : "http-" + r.status;
      throw Object.assign(new Error(msg || t("account.drive_error", { status: r.status })), { errorCode, status: r.status }) as DriveError;
    }
    return r;
  }

  return {
    /** An authorized request to any Google API (the profile, for one). */
    request: call,
    async listFiles(name?: string) {
      const q = name ? `&q=${encodeURIComponent(`name='${name.replace(/'/g, "\\'")}'`)}` : "";
      const r = await call(`${API}/files?spaces=appDataFolder&pageSize=1000&fields=files(id,name,modifiedTime,size)${q}`);
      return ((await r.json()).files || []) as { id: string; name: string; modifiedTime: string; size?: string }[];
    },
    /** Searches the app folder with a Drive query (q), following the pages, oldest first. */
    async queryDrive(q: string) {
      const files: { id: string; name: string; createdTime: string; size?: string }[] = [];
      let page = "";
      do {
        const r = await call(
          `${API}/files?spaces=appDataFolder&pageSize=1000&orderBy=createdTime&fields=nextPageToken,files(id,name,createdTime,size)` +
            (q ? `&q=${encodeURIComponent(q)}` : "") +
            (page ? `&pageToken=${page}` : "")
        );
        const d = await r.json();
        files.push(...(d.files || []));
        page = d.nextPageToken || "";
      } while (page);
      return files;
    },
    async readStorage(id: string) {
      return (await call(`${API}/files/${id}?alt=media`)).json();
    },
    /** Writes a JSON file: a new one, or the file `id` replaced. */
    async save(name: string, payload: unknown, id?: string) {
      const body = JSON.stringify(payload);
      if (id) {
        const r = await call(`${UPLOAD}/files/${id}?uploadType=media&fields=id,name,modifiedTime`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body
        });
        return r.json();
      }
      const b = "biblia" + Math.random().toString(36).slice(2);
      const meta = JSON.stringify({ name, parents: ["appDataFolder"], mimeType: "application/json" });
      const multipart = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`;
      const r = await call(`${UPLOAD}/files?uploadType=multipart&fields=id,name,modifiedTime`, {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${b}` },
        body: multipart
      });
      return r.json();
    },
    async removeRecord(id: string) {
      await call(`${API}/files/${id}`, { method: "DELETE" });
    }
  };
}
