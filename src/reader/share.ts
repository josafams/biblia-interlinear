// Sharing a verse: the system share sheet in the app, the Web Share API in the browser, or copying the text and
// the link. Used by Anotar and by the verse of the day.
import { t } from "../i18n";
import { exposedPlugin } from "../lib/native";
import { toast } from "./context";

export async function shareOrCopy(title: string, text: string, url: string) {
  const share = exposedPlugin<{ share(o: object): Promise<unknown> }>("Share");
  try {
    if (share) return await share.share({ title, text, url });
    if (navigator.share) return await navigator.share({ title, text, url });
  } catch (err) {
    // the person closed the share sheet (browser: AbortError; app: "Share canceled")
    const e = err as Error;
    if (e && (e.name === "AbortError" || /cancel/i.test(e.message || ""))) return;
  }
  try {
    await navigator.clipboard.writeText(`${text}
${url}`);
    toast(t("annotate.link_copied"));
  } catch {
    toast(t("annotate.share_failed"));
  }
}
