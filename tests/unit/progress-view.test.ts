import { expect, test } from "vitest";
import { bookDetail, bookLevel, chartBars, overview } from "../../src/lib/progress/view";

const books = [
  { code: "RUT", name: "Rute", abbrev: "Rt", chapterCount: 4 },
  { code: "JHN", name: "João", abbrev: "Jo", nt: true, chapterCount: 21 }
];
const read = (ids: [string, Partial<{ ultima: string; primeira: string; vezes: number; n: number }>?][]) =>
  new Map(ids.map(([id, r]) => [id, { id, ...r }]));
const D = {
  readSet: read([
    ["RUT.1", { primeira: "2026-10-01", ultima: "2026-10-20", vezes: 3, n: 1 }],
    ["RUT.2", { primeira: "2026-10-02", ultima: "2026-10-02", vezes: 1, n: 2 }],
    ["RUT.3", { ultima: "2026-10-21", n: 3 }],
    ["RUT.4", { ultima: "2026-10-21", n: 4 }],
    ["JHN.3", { ultima: "2026-10-22", n: 3 }]
  ]),
  byDay: {
    "2026-10-21": { segundos: 600, caps: 2, verbetes: 3, livros: { RUT: 600 } },
    "2026-10-22": { segundos: 1200, caps: 1, verbetes: 1, livros: { JHN: 1200 } }
  },
  withNotes: new Set(["JHN.3"]),
  plano: null,
  posicao: { cod: "JHN", cap: 4 },
  estudo: { notas: 1, marcacoes: 0, favoritos: 0 }
};

test("levels of the books map", () => {
  expect([bookLevel(0, 4), bookLevel(1, 4), bookLevel(3, 4), bookLevel(4, 4)]).toEqual([0, 1, 2, 3]);
});

test("overview: the whole Bible, testaments, finished books, streak and time", () => {
  const o = overview(D, books, "2026-10-22");
  expect(o).toMatchObject({
    read: 5,
    total: 25,
    pct: 20,
    ot: { read: 4, total: 4 },
    nt: { read: 1, total: 21 },
    finishedBooks: 1,
    entries: 4
  });
  expect(o.streak).toEqual({ current: 2, record: 2 });
  expect(o.week).toBe("30 min");
  expect(o.map.map(b => [b.code, b.level])).toEqual([
    ["RUT", 3],
    ["JHN", 1]
  ]);
});

test("chart: 7 days by weekday, 12 months by name, and the average", () => {
  const week = chartBars(D.byDay, "semana", "2026-10-22");
  expect(week.bars).toHaveLength(7);
  expect(week.bars.at(-1)).toEqual({ label: "qui", seconds: 1200 });
  expect(week.average).toBeCloseTo(1800 / 7);
  const year = chartBars(D.byDay, "ano", "2026-10-22");
  expect(year.bars.at(-1)).toEqual({ label: "out", seconds: 1800 });
  expect(year.bars[0].label).toBe("nov");
});

test("one book in detail", () => {
  const d = bookDetail(D, books[1], Date.parse("2026-10-22T12:00:00"));
  expect(d).toMatchObject({ read: 1, total: 21, remaining: 20, next: 1, time: "20 min" });
  expect(d.chapters[2]).toEqual({ n: 3, read: true, notes: true, reading: false });
  expect(d.chapters[3]).toEqual({ n: 4, read: false, notes: false, reading: true });
  const rt = bookDetail(D, books[0]);
  expect(rt).toMatchObject({ remaining: 0, reread: { label: "Rt 1", times: 3 }, first: "01/10/2026" });
});
