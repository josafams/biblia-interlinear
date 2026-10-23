// "Sobre o livro": the book introduction (data/about) and its timeline of people, events and the writing.
import { t } from "../i18n";

export type TimelineItem = { label: string; from: number; to: number; kind?: string; note?: string };
export type About = {
  title_orig?: string;
  summary: string;
  facts?: [string, string][];
  name?: string;
  structure?: { title: string; text: string; from?: number; to?: number }[];
  extra?: { title: string; text: string };
  people?: { name: string; ch?: number; chapters?: string; note: string }[];
  writing?: { tradition: string; academic: string };
  events?: { intro: string; timeline?: TimelineItem[]; axis?: [number, number]; band?: { label: string; from: number; to: number } };
  context?: string;
  places?: string[];
  themes?: string[];
  key_verses?: { text: string; ref: string }[];
  note?: string;
};

/** A year: "1000 a.C." (negative) or "30 d.C.". */
export const formatYear = (y: number) => (y < 0 ? t("about.year_bc", { y: -y }) : t("about.year_ad", { y }));

/** An approximate range: "c. 1000–970 a.C.", "c. 30 d.C.", "c. 4 a.C.–30 d.C.". */
export function formatRange(a: number, b: number) {
  if (a === b) return t("about.circa", { range: formatYear(a) });
  if (a < 0 && b < 0) return t("about.circa", { range: t("about.year_bc", { y: `${-a}–${-b}` }) });
  if (a > 0 && b > 0) return t("about.circa", { range: t("about.year_ad", { y: `${a}–${b}` }) });
  return t("about.circa", { range: `${formatYear(a)}–${formatYear(b)}` });
}

/** A round step for the axis, so it has at most 6 marks. */
export function niceStep(span: number) {
  for (const s of [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (span / s <= 6) return s;
  return 2000;
}

/** Positions (in % of the axis) of the bars, the band and the year marks of a timeline. */
export function timeline(E: NonNullable<About["events"]>) {
  const items = E.timeline || [];
  let [y0, y1] = E.axis || [Math.min(...items.map(i => i.from)), Math.max(...items.map(i => i.to))];
  if (y0 > y1) [y0, y1] = [y1, y0];
  const span = Math.max(1, y1 - y0);
  const x = (y: number) => (((y - y0) / span) * 100).toFixed(2) + "%";
  const w = (a: number, b: number) => Math.max(0.6, ((b - a) / span) * 100).toFixed(2) + "%";
  const step = niceStep(span);
  const ticks: number[] = [];
  for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) ticks.push(y);
  const mixed = y0 < 0 && y1 > 0;
  const kinds = new Set(items.map(i => i.kind));
  return {
    rows: items.map(i => ({
      ...i,
      range: formatRange(i.from, i.to),
      left: x(Math.min(i.from, i.to)),
      width: w(Math.min(i.from, i.to), Math.max(i.from, i.to))
    })),
    band: E.band
      ? { left: x(E.band.from), width: w(E.band.from, E.band.to), label: E.band.label, range: formatRange(E.band.from, E.band.to) }
      : null,
    ticks: ticks.map(y => ({ left: x(y), label: mixed ? formatYear(y) : String(Math.abs(y)) })),
    unit: t(mixed ? "about.years" : y1 <= 0 ? "about.years_bc" : "about.years_ad"),
    kinds: { person: kinds.has("pessoa"), event: kinds.has("evento"), writing: kinds.has("escrita") }
  };
}
