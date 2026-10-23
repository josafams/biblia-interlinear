// Printing an HTML page (the study notebook): in the Android app through the system print service (Print
// plugin, which has "Salvar como PDF"); in the browser through a hidden iframe and the print window.
import { nativePlugin, platform } from "./native";

declare global {
  interface Window {
    /** automated tests: only build the page, do not open the print window */
    __noPrint?: boolean;
  }
}

/** Resolves with "" when printing opened, or the locale key of what went wrong. */
export async function printHtml(html: string, title: string): Promise<"" | "print.android_failed" | "print.unsupported"> {
  const plug = nativePlugin("Print") as { printHtml(o: { html: string; title: string }): Promise<void> } | null;
  if (plug && platform === "android") {
    try {
      await plug.printHtml({ html, title });
      return "";
    } catch {
      return "print.android_failed";
    }
  }
  const frame = document.createElement("iframe");
  frame.className = "fr-impressao";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden"; // i18n-ignore
  document.body.appendChild(frame);
  frame.srcdoc = html;
  await new Promise(r => {
    frame.onload = r;
    setTimeout(r, 1500);
  });
  if (window.__noPrint) return "";
  setTimeout(() => frame.remove(), 60000);
  try {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    return "";
  } catch {
    return "print.unsupported";
  }
}
