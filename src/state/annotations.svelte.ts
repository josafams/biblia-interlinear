// Annotation numbers the screens show (the "Notas · N" of the top bar and of the index tab).
import { ANNOTATED, annotatedVerses } from "../lib/annotations/count";

export const annotated = $state({ verses: 0 });

type Api = {
  allRecords(c: (typeof ANNOTATED)[number]): Promise<{ id: string; ancora?: { livro: string; cap: number; ver: number } }[]>;
  onChange(f: () => void): void;
};

/** Counts now and again after every change of the annotations. */
export function followAnnotations(api: Api) {
  const count = async () => {
    annotated.verses = annotatedVerses(await Promise.all(ANNOTATED.map(c => api.allRecords(c))));
  };
  count();
  api.onChange(count);
}
