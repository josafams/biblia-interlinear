import { describe, expect, test } from "vitest";
import {
  addDays,
  byDay,
  daysBetween,
  duration,
  newPlan,
  planStatus,
  readingPace,
  reschedule,
  shortDate,
  streaks
} from "../../src/lib/progress/stats";

test("days", () => {
  expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // across a daylight saving change too
});

test.each([
  [0, "0 min"],
  [20, "menos de 1 min"],
  [25 * 60, "25 min"],
  [120 * 60, "2 h"],
  [125 * 60, "2 h 5 min"]
])("duration(%i) = %s", (sec, text) => expect(duration(sec)).toBe(text));

test("shortDate", () => {
  expect(shortDate(null)).toBe("—");
  expect(shortDate("2026-10-22T12:00:00")).toBe("22/10/2026");
});

describe("streaks", () => {
  const day = (segundos: number, caps = 0) => ({ segundos, caps, verbetes: 0, livros: {} });
  test("counts back from today, or from yesterday when today has nothing yet", () => {
    const days = { "2026-10-19": day(600), "2026-10-20": day(0, 1), "2026-10-21": day(300) };
    expect(streaks(days, "2026-10-21")).toEqual({ current: 3, record: 3 });
    expect(streaks(days, "2026-10-22")).toEqual({ current: 3, record: 3 });
    expect(streaks(days, "2026-10-23")).toEqual({ current: 0, record: 3 });
  });
  test("less than 5 minutes and no chapter does not count", () => {
    expect(streaks({ "2026-10-21": day(299) }, "2026-10-21")).toEqual({ current: 0, record: 0 });
  });
});

test("byDay adds the devices up and marks days with chapters read", () => {
  const days = byDay(
    [
      { dia: "2026-10-21", segundos: 60, livros: { JHN: 60 } },
      { dia: "2026-10-21", segundos: 30, caps: 1, livros: { JHN: 10, GEN: 20 } }
    ],
    [{ id: "PSA.23", lido: true, ultima: "2026-10-20T10:00:00" }]
  );
  expect(days["2026-10-21"]).toEqual({ segundos: 90, caps: 1, verbetes: 0, livros: { JHN: 70, GEN: 20 } });
  expect(days["2026-10-20"].capsLidos).toBe(true);
});

test("readingPace: chapters per day in the last 30 days", () => {
  const now = Date.parse("2026-10-22T12:00:00Z");
  const read = [
    { id: "a", ultima: "2026-10-21T00:00:00Z" },
    { id: "b", primeira: "2026-10-01T00:00:00Z" },
    { id: "c", ultima: "2026-01-01T00:00:00Z" }
  ];
  expect(readingPace(read, now)).toBeCloseTo(2 / 30);
});

describe("reading plans", () => {
  const books = [
    { code: "GEN", chapterCount: 50 },
    { code: "MAT", chapterCount: 28, nt: true },
    { code: "MRK", chapterCount: 16, nt: true }
  ];
  test("New Testament in 90 days", () => {
    const p = newPlan("nt90", books, "2026-10-01");
    expect(p).toMatchObject({ id: "atual", tipo: "nt90", nome: "Novo Testamento em 90 dias", inicio: "2026-10-01", fim: "2026-12-29" });
    expect(p.caps).toHaveLength(44);
    expect(p.caps[0]).toBe("MAT.1");
  });
  test("status: on track, behind, ahead and done", () => {
    const p = newPlan("nt90", books, "2026-10-01");
    expect(planStatus(p, new Map(), "2026-10-01")).toMatchObject({ dia: 1, texto: "Em dia", tipo: "ok" });
    expect(planStatus(p, new Map(), "2026-10-11")).toMatchObject({ texto: "4 capítulos atrasado", tipo: "alerta" });
    const ahead = new Map(p.caps.slice(0, 3).map(c => [c, true]));
    expect(planStatus(p, ahead, "2026-10-01")).toMatchObject({ texto: "3 capítulos adiantado" });
    const all = new Map(p.caps.map(c => [c, true]));
    expect(planStatus(p, all, "2026-11-01").texto).toBe("Plano concluído!");
  });
  test("reschedule keeps the pace with what is left", () => {
    const p = newPlan("nt90", books, "2026-10-01");
    const read = new Map(p.caps.slice(0, 22).map(c => [c, true]));
    const q = reschedule(p, read, "2026-11-01");
    expect(q.caps).toHaveLength(22);
    expect(q).toMatchObject({ inicio: "2026-11-01", fim: addDays("2026-11-01", 45 - 1) });
  });
});
