// The preview under "Ir para" while a reference is typed: a warning, a chapter missing from the preview build,
// or where the button goes (with the theme and, when the chapter is loaded, the text of the verse).
import type { RefBook, ResolvedRef } from "./refs";
import type { Chapter } from "./types";

type Book = RefBook & { chapters: { n: number; v: number; t?: string }[] };
export type GotoPreview =
  | { kind: "none" }
  /** html: the warning of refs.ts (escaped, with <b> examples) */
  | { kind: "warn"; html: string }
  | { kind: "na"; ref: string; theme: string }
  | { kind: "ok"; ref: string; theme: string; snippet: string; button: string };

export function gotoPreview(res: ResolvedRef | null, chapters: Record<string, Chapter>): GotoPreview {
  if (!res) return { kind: "none" };
  if ("warn" in res) return { kind: "warn", html: res.warn };
  const B = res.book as Book;
  if ("na" in res) {
    const c = B.chapters[res.na.n - 1];
    return { kind: "na", ref: `${B.name} ${c.n}${res.v ? ":" + res.v : ""}`, theme: c.t || "" };
  }
  const c = B.chapters[res.ch - 1];
  const verse = res.chapterStart ? null : chapters[`${B.code}.${c.n}`]?.v.find(x => x.n === res.v);
  return {
    kind: "ok",
    ref: res.chapterStart ? `${B.name} ${c.n}` : `${B.name} ${c.n}:${res.v}`,
    theme: c.t || "",
    snippet: verse?.b || "",
    button: res.chapterStart ? `${B.name} ${c.n}` : `${B.abbrev} ${c.n}:${res.v}`
  };
}
