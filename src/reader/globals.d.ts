// Globals of the reader page: DATA inlined in ler.html (see vite/site/reader-page.ts) and the window.*
// bridges between the reader and the scripts loaded after it (web/study.js, search.js, account.js,
// progress.js, sync.js, src/reader/annotations), also used by the tests and the videos.
import type { ReaderBook } from "./context";
import type { BibleData } from "../lib/types";

type Loose = Record<string, (...args: never[]) => unknown> & Record<string, unknown>;

declare global {
  const DATA: Omit<BibleData, "books"> & { books: ReaderBook[]; complete?: boolean };
  interface Window {
    Annotations?: Loose & {
      closeBar(): void;
      openList(f?: unknown): void;
      openVerse(n: number): void;
      noteForQuestion(book: string, chapter: number, verse: number, question: string): void;
    };
    Account?: Loose & { status(): string };
    Progress?: Loose & { open(): void };
    Study?: Loose;
    Sync?: Loose;
    DATA_EDICAO?: string;
    __openSearch?: () => void;
    __concordance?: (key: string, word: unknown) => void;
    __currentChapter?: unknown;
    __preferencias?: unknown;
    __carregarCapitulo?: (book: string, n: number) => Promise<unknown>;
    __chapter?: () => unknown;
    __resolveRef?: (q: string) => unknown;
    __books?: Record<string, { name: string; abbrev: string; i: number; nt: boolean; group?: string; chapterCount: number }>;
    __ultimoCaderno?: unknown;
    __ultimoBackup?: unknown;
  }
}
