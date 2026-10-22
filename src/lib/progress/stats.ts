// Reading progress as numbers: days in the device's time zone, streaks, pace and reading plans.
// No screen here; web/progress.js measures the reading and draws the panel. Record fields are the saved ones.
import { t } from "../../i18n";

const DAY_MS = 864e5;
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-22", the local day (time zone of the device). */
export const dayOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayOf(new Date());
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return dayOf(new Date(y, m - 1, d + n));
}
export function daysBetween(a: string, b: string) {
  const [x, y] = [a, b].map(s => {
    const [p, q, r] = s.split("-").map(Number);
    return Date.UTC(p, q - 1, r);
  });
  return Math.round((y - x) / DAY_MS);
}

/** Reading time as people say it: "menos de 1 min", "25 min", "2 h 5 min". */
export function duration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 1) return sec > 0 ? t("progress.duration.under_minute") : t("progress.duration.minutes", { m: 0 });
  if (m < 60) return t("progress.duration.minutes", { m });
  const h = Math.floor(m / 60),
    r = m % 60;
  return r ? t("progress.duration.hours_minutes", { h, m: r }) : t("progress.duration.hours", { h });
}
export function shortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export type Day = { segundos: number; caps: number; verbetes: number; livros: Record<string, number>; capsLidos?: boolean };
export type TimeRecord = { dia: string; segundos?: number; caps?: number; verbetes?: number; livros?: Record<string, number> };
export type ReadRecord = { id: string; lido?: boolean; primeira?: string; ultima?: string };

/** The time records of every device, added up per day; days with a chapter read count too. */
export function byDay(time: TimeRecord[], read: Iterable<ReadRecord>) {
  const days: Record<string, Day> = {};
  const day = (d: string) => (days[d] ??= { segundos: 0, caps: 0, verbetes: 0, livros: {} });
  for (const r of time) {
    const d = day(r.dia);
    d.segundos += r.segundos || 0;
    d.caps += r.caps || 0;
    d.verbetes += r.verbetes || 0;
    for (const [k, v] of Object.entries(r.livros || {})) d.livros[k] = (d.livros[k] || 0) + v;
  }
  // days with reading also by the dates of the chapters (covers chapters marked by hand)
  for (const l of read) day(dayOf(new Date((l.ultima || l.primeira)!))).capsLidos = true;
  return days;
}

/** Days in a row with reading (a chapter, or 5 minutes), up to today or yesterday, and the longest run. */
export function streaks(days: Record<string, Day>, now = today()) {
  const counts = (d: string) => {
    const x = days[d];
    return !!x && (x.caps > 0 || !!x.capsLidos || x.segundos >= 300);
  };
  let current = 0,
    d = now;
  if (!counts(d)) d = addDays(d, -1);
  while (counts(d)) {
    current++;
    d = addDays(d, -1);
  }
  let record = 0,
    run = 0,
    previous: string | null = null;
  for (const x of Object.keys(days).filter(counts).sort()) {
    run = previous && daysBetween(previous, x) === 1 ? run + 1 : 1;
    record = Math.max(record, run);
    previous = x;
  }
  return { current, record };
}

/** Chapters per day in the last 30 days. */
export function readingPace(read: Iterable<ReadRecord>, now = Date.now()) {
  const since = now - 30 * DAY_MS;
  let n = 0;
  for (const l of read) if (Date.parse((l.ultima || l.primeira)!) >= since) n++;
  return n / 30;
}

// ---------- reading plans ----------
export type PlanBook = { code: string; chapterCount: number; nt?: boolean };
export type PlanId = "ano" | "nt90";
export type Plan = { id: "atual"; tipo: PlanId; nome: string; inicio: string; fim: string; caps: string[]; apagado?: boolean };

const chaptersOf = (books: PlanBook[]) => books.flatMap(l => Array.from({ length: l.chapterCount }, (_, i) => `${l.code}.${i + 1}`));
const PLANS: Record<PlanId, { days: number; books: (b: PlanBook[]) => PlanBook[] }> = {
  ano: { days: 365, books: b => b },
  nt90: { days: 90, books: b => b.filter(l => l.nt) }
};
export const planName = (id: PlanId) => t(`progress.plans.${id}`);

export function newPlan(id: PlanId, books: PlanBook[], start = today()): Plan {
  const P = PLANS[id];
  return {
    id: "atual",
    tipo: id,
    nome: planName(id),
    inicio: start,
    fim: addDays(start, P.days - 1),
    caps: chaptersOf(P.books(books)),
    apagado: false
  };
}

/** Starts again today with the chapters not read yet, at the plan's original pace. */
export function reschedule(p: Plan, read: Map<string, unknown>, start = today()): Plan {
  const remaining = p.caps.filter(c => !read.has(c));
  const pace = p.caps.length / (daysBetween(p.inicio, p.fim) + 1) || 1;
  const days = Math.max(1, Math.ceil(remaining.length / pace));
  return { ...p, caps: remaining, inicio: start, fim: addDays(start, days - 1) };
}

/** Today's chapters and whether the plan is ahead, on track or behind. */
export function planStatus(p: Plan, read: Map<string, unknown>, now = today()) {
  const N = p.caps.length,
    D = daysBetween(p.inicio, p.fim) + 1;
  const d = Math.min(Math.max(daysBetween(p.inicio, now), 0), D - 1);
  const before = Math.floor((d * N) / D),
    untilToday = Math.floor(((d + 1) * N) / D);
  const todays = p.caps.slice(before, untilToday);
  const done = p.caps.filter(c => read.has(c)).length;
  let texto: string, tipo: "ok" | "alerta";
  if (done >= N) [texto, tipo] = [t("progress.plan.done"), "ok"];
  else if (done > untilToday) [texto, tipo] = [t("progress.plan.ahead", { count: done - untilToday }), "ok"];
  else if (done >= before) [texto, tipo] = [t("progress.plan.on_track"), "ok"];
  else [texto, tipo] = [t("progress.plan.behind", { count: before - done }), "alerta"];
  return { todays, done, N, dia: d + 1, D, texto, tipo };
}
