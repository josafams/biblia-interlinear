// "Baixar meus dados": the backup as a JSON file. In the app it goes through the system share sheet (written
// to the cache first); in the browser it is a normal download.
import { exposedPlugin } from "../native";
import type { Backup } from "./store";

type Files = { writeFile(o: { path: string; data: string; directory: string; encoding: string }): Promise<{ uri: string }> };
type Share = { share(o: { title: string; files: string[] }): Promise<unknown> };

/** Resolves with true when the file was downloaded (in the app the share sheet says it by itself). */
export async function saveBackup(payload: Backup, shareTitle: string) {
  const json = JSON.stringify(payload, null, 1);
  const name = `biblia-interlinear-anotacoes-${payload.exportado_em.slice(0, 10)}.json`;
  const files = exposedPlugin("Filesystem") as Files | null,
    share = exposedPlugin("Share") as Share | null;
  if (files && share) {
    try {
      const r = await files.writeFile({ path: name, data: json, directory: "CACHE", encoding: "utf8" });
      await share.share({ title: shareTitle, files: [r.uri] });
      return false;
    } catch {
      /* the normal download below */
    }
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}
