// What "Meu progresso" shows, worked out from the reading records (see payload() in web/progress.js):
// the whole Bible, the tiles, the reading time chart, the 66 books, the plan and one book in detail.
import { formatNumber, t } from "../../i18n";
import { addDays, type Day, duration, type Plan, planStatus, readingPace, shortDate, streaks, today } from "./stats";

export type ProgressBook = { code: string; name: string; abbrev: string; nt?: boolean; chapterCount: number };
export type ReadRecord = { id: string; n?: number; primeira?: string; ultima?: string; vezes?: number };
export type ProgressData = {
  readSet: Map<string, ReadRecord>;
  byDay: Record<string, Day>;
  withNotes: Set<string>;
  plano: Plan | null;
  posicao: { cod: string; cap: number } | null;
  estudo: { notas: number; marcacoes: number; favoritos: number };
};
export type ChartTab = "semana" | "mes" | "ano";

const readIn = (b: ProgressBook, read: Map<string, unknown>) => {
  let n = 0;
  for (let i = 1; i <= b.chapterCount; i++) if (read.has(`${b.code}.${i}`)) n++;
  return n;
};
const chapters = (books: ProgressBook[]) => books.reduce((s, b) => s + (b.chapterCount || 0), 0);
/** 0 not started, 1 up to half, 2 more than half, 3 finished */
export const bookLevel = (read: number, total: number) => (read === 0 ? 0 : read === total ? 3 : read / total > 0.5 ? 2 : 1);

export function overview(D: ProgressData, books: ProgressBook[], now = today()) {
  const total = chapters(books) || 1189;
  const ot = books.filter(b => !b.nt),
    nt = books.filter(b => b.nt);
  const sum = (bs: ProgressBook[]) => bs.reduce((s, b) => s + readIn(b, D.readSet), 0);
  const days = Object.values(D.byDay);
  const week = [...Array(7).keys()].map(i => D.byDay[addDays(now, -i)]?.segundos || 0).reduce((a, b) => a + b, 0);
  const pct = Math.floor((D.readSet.size / total) * 1000) / 10;
  const streak = streaks(D.byDay, now);
  return {
    pct,
    read: D.readSet.size,
    total,
    ot: { read: sum(ot), total: chapters(ot) },
    nt: { read: sum(nt), total: chapters(nt) },
    finishedBooks: books.filter(b => readIn(b, D.readSet) === b.chapterCount).length,
    streak,
    week: duration(week),
    weekAverage: duration(week / 7),
    totalTime: duration(days.reduce((s, d) => s + d.segundos, 0)),
    entries: days.reduce((s, d) => s + d.verbetes, 0),
    map: books.map(b => {
      const n = readIn(b, D.readSet);
      return { code: b.code, name: b.name, abbrev: b.abbrev, read: n, total: b.chapterCount, level: bookLevel(n, b.chapterCount) };
    })
  };
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** The bars of the reading time chart: the last 7 days, 30 days or 12 months. */
export function chartBars(byDay: Record<string, Day>, tab: ChartTab, now = today()) {
  const bars: { label: string; seconds: number }[] = [];
  if (tab === "ano") {
    const [y, m] = now.split("-").map(Number);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const seconds = Object.entries(byDay)
        .filter(([k]) => k.startsWith(key))
        .reduce((s, [, v]) => s + v.segundos, 0);
      bars.push({ label: t(`progress.months.${MONTHS[d.getMonth()]}`), seconds });
    }
  } else {
    const n = tab === "mes" ? 30 : 7;
    for (let i = n - 1; i >= 0; i--) {
      const day = addDays(now, -i),
        [a, m, d] = day.split("-").map(Number);
      const label = n === 7 ? t(`progress.weekdays.${WEEKDAYS[new Date(a, m - 1, d).getDay()]}`) : i % 5 === 0 ? String(d) : "";
      bars.push({ label, seconds: byDay[day]?.segundos || 0 });
    }
  }
  const average = bars.reduce((s, b) => s + b.seconds, 0) / bars.length;
  return { bars, average, max: Math.max(60, ...bars.map(b => b.seconds)) };
}

export function planView(D: ProgressData, books: Record<string, { abbrev: string }>, now = today()) {
  const p = D.plano;
  if (!p || !p.caps?.length) return null;
  const s = planStatus(p, D.readSet, now);
  const name = (id: string) => {
    const [code, n] = id.split(".");
    return `${books[code]?.abbrev || code} ${n}`;
  };
  return {
    name: p.nome,
    ...s,
    doneText: formatNumber(s.done),
    totalText: formatNumber(s.N),
    today: s.todays.map(id => ({ id, label: name(id), read: D.readSet.has(id) }))
  };
}

export function bookDetail(D: ProgressData, b: ProgressBook, now = Date.now()) {
  const numbers = Array.from({ length: b.chapterCount }, (_, i) => i + 1);
  const read = numbers.filter(n => D.readSet.has(`${b.code}.${n}`));
  const recs = read.map(n => D.readSet.get(`${b.code}.${n}`)!);
  const first = recs
    .map(r => r.primeira)
    .filter(Boolean)
    .sort()[0];
  const last = recs
    .map(r => r.ultima)
    .filter(Boolean)
    .sort()
    .at(-1);
  const reread = recs.filter(r => (r.vezes || 0) > 1).sort((x, y) => (y.vezes || 0) - (x.vezes || 0))[0];
  const remaining = b.chapterCount - read.length;
  const pace = readingPace(D.readSet.values() as Iterable<{ id: string; primeira?: string; ultima?: string }>, now);
  const reading = D.posicao?.cod === b.code ? D.posicao.cap : null;
  return {
    read: read.length,
    total: b.chapterCount,
    remaining,
    /** days to finish at the reading pace of the last 30 days (0 when unknown) */
    forecastDays: remaining && pace > 0 ? Math.ceil(remaining / pace) : 0,
    chapters: numbers.map(n => {
      const id = `${b.code}.${n}`;
      return { n, read: D.readSet.has(id), notes: D.withNotes.has(id), reading: reading === n && !D.readSet.has(id) };
    }),
    time: duration(Object.values(D.byDay).reduce((s, d) => s + (d.livros[b.code] || 0), 0)),
    reread: reread ? { label: `${b.abbrev} ${reread.n}`, times: reread.vezes || 0 } : null,
    first: shortDate(first),
    last: shortDate(last),
    next: numbers.find(n => !D.readSet.has(`${b.code}.${n}`)) || 1
  };
}
