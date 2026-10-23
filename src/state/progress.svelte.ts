// "Meu progresso" (#progresso): what the panel shows (web/progress.js measures the reading and fills it).
import type { bookDetail, chartBars, ChartTab, overview, planView } from "../lib/progress/view";

export const progressView = $state({
  open: false,
  signedIn: false,
  /** this build can sign in with Google */
  canSignIn: false,
  paused: false,
  tab: "semana" as ChartTab,
  /** the book open in detail (its code), or null for the overview */
  book: null as { code: string; name: string; abbrev: string } | null,
  continueAt: null as { code: string; chapter: number; name: string } | null,
  overview: null as ReturnType<typeof overview> | null,
  chart: null as ReturnType<typeof chartBars> | null,
  plan: null as ReturnType<typeof planView>,
  detail: null as ReturnType<typeof bookDetail> | null,
  study: { notas: 0, marcacoes: 0, favoritos: 0 }
});
