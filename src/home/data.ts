// home-data.json, written by vite/site/home-page.ts: the counts, the sample verses, the sizes of the book
// files and the "Como usar" storyboards. The home page (index.html, en/index.html) reads its own when it opens.
export type SampleWord = { o: string; x: string; s: string; t: string };
export type SampleVerse = { ref: string; greek: boolean; words: SampleWord[]; blivre: string };
export type Storyboard = { id: string; n: number; grupo: string; titulo: string; desc: string; steps: string[]; ready?: boolean };
export type Storyboards = { grupos: { id: string; nome: string }[]; videos: Storyboard[] };
export type HomeData = {
  counts: { books: number; chapters: number; verses: number; words: number; entries: number };
  sample: SampleVerse[];
  /** size of each book file ("00-Biblia-Livre.epub" → "12,3 MB"), "" when not built here */
  sizes: Record<string, string>;
  /** where the book files are downloaded from */
  booksUrl: string;
  /** the date the site was built, in the page's locale */
  date: string;
  /** the way from the page to the site root ("" or "../"), for the video files */
  root?: string;
  storyboards: Storyboards;
};

/** A recorded video (videos/videos.js); older indexes used Portuguese names. */
export type Recording = { mp4?: string; vtt?: string; cover?: string; times?: number[]; duration?: string };
type LegacyRecording = Recording & { capa?: string; tempos?: number[]; duracao?: string };
type RecordedEntry = { phone?: LegacyRecording; desktop?: LegacyRecording; celular?: LegacyRecording; computador?: LegacyRecording };

declare global {
  interface Window {
    __videos?: { files?: Record<string, RecordedEntry>; arquivos?: Record<string, RecordedEntry> };
  }
}

/** The recording of a video for this screen (phone or computer), null when it was not recorded yet; its files
 * are addressed from the site root, so a page in a folder passes the way back (`root`). */
export function recording(id: string, phone: boolean, root = ""): Recording | null {
  const all = window.__videos?.files || window.__videos?.arquivos || {};
  const r = all[id];
  if (!r) return null;
  const p = r.phone || r.celular,
    d = r.desktop || r.computador;
  const a = phone ? p || d : d || p;
  if (!a) return null;
  const at = (f?: string) => f && root + f;
  return { mp4: at(a.mp4), vtt: at(a.vtt), cover: at(a.cover || a.capa), times: a.times || a.tempos, duration: a.duration || a.duracao };
}
