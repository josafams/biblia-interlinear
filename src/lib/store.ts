// localStorage under the "interlinear:" prefix. The key names are saved on people's devices, so they stay
// in Portuguese; this list is the one place that names them.
const PREFIX = "interlinear:";

export type StoreKey =
  | "posicao"
  | "modo"
  | "modo-base"
  | "tema"
  | "tamanho"
  | "cantilacao"
  | "acompanhar"
  | "voz-lenta"
  | "modo-anterior"
  | "sobre-aberto"
  | "tema-claro"
  | "tema-escuro"
  | "conta-sugestao"
  | "idioma"
  | `dica-${string}`
  | (string & {});

export const store = {
  get<T extends string | null>(key: StoreKey, fallback: T): string | T {
    try {
      return localStorage.getItem(PREFIX + key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key: StoreKey, value: string) {
    try {
      localStorage.setItem(PREFIX + key, value);
    } catch {
      /* private mode or storage full: the setting lasts only for this visit */
    }
  }
};
