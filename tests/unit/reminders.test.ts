import { expect, test, vi } from "vitest";
import { createNotifier, type LocalNotifications } from "../../src/lib/reminders/notifier";
import { buildSchedule, chaptersLabel, DAYS_AHEAD, DEFAULT_SETTINGS, READING_ID, VERSE_ID } from "../../src/lib/reminders/schedule";
import { verseList, verseOfDay } from "../../src/lib/reminders/verse-of-day";
import { newPlan } from "../../src/lib/progress/stats";

const BOOKS = [
  {
    code: "GEN",
    name: "Gênesis",
    abbrev: "Gn",
    chapterCount: 50,
    about: { key_verses: [{ ref: "1:1", text: "No princípio criou Deus os céus e a terra." }] }
  },
  { code: "EXO", name: "Êxodo", abbrev: "Êx", chapterCount: 40, about: { key_verses: [{ ref: "3:14", text: "EU SOU O QUE SOU." }] } },
  {
    code: "JHN",
    name: "João",
    abbrev: "Jo",
    chapterCount: 21,
    nt: true,
    about: { key_verses: [{ ref: "3:16–17", text: "Porque Deus amou ao mundo…" }] }
  }
];
const VERSES = verseList(BOOKS);
const NOW = new Date(2026, 9, 27, 6, 0); // 27/10/2026 06:00, before the reminders of the day
const on = { reading: { on: true, time: "07:00" }, verse: { on: true, time: "08:00" } };
const base = { now: NOW, settings: on, books: BOOKS, plan: null, read: new Map(), position: "JHN.3.16", verses: VERSES };

test("verse of the day: the same all day, another the next day, the list starts over; 3:16–17 opens at 3:16", () => {
  expect(VERSES).toHaveLength(3);
  expect(verseOfDay(VERSES, new Date(2026, 9, 27, 1))).toEqual(verseOfDay(VERSES, new Date(2026, 9, 27, 23)));
  const days = ["2026-10-27", "2026-10-28", "2026-10-29"].map(d => verseOfDay(VERSES, d)!.book);
  expect(new Set(days).size).toBe(3);
  expect(verseOfDay(VERSES, "2026-10-30")).toEqual(verseOfDay(VERSES, "2026-10-27"));
  expect(VERSES.find(v => v.book === "JHN")).toMatchObject({ chapter: 3, verse: 16, ref: "3:16–17" });
});

test("chapters of a day as people read them", () => {
  expect(chaptersLabel(["GEN.1", "GEN.2", "GEN.3"], BOOKS)).toBe("Gn 1–3");
  expect(chaptersLabel(["GEN.50", "EXO.1", "EXO.2"], BOOKS)).toBe("Gn 50 · Êx 1–2");
});

test("without a plan: every day, continue where the reading stopped; and the verse of each day", () => {
  const list = buildSchedule(base);
  const reading = list.filter(r => r.id < VERSE_ID);
  expect(reading).toHaveLength(DAYS_AHEAD);
  expect(reading[0]).toMatchObject({ id: READING_ID, title: "Hora da leitura", body: "Continue de onde parou: João 3", ref: "JHN.3" });
  expect(reading[0].at).toEqual(new Date(2026, 9, 27, 7, 0));
  const verses = list.filter(r => r.id >= VERSE_ID);
  expect(verses).toHaveLength(DAYS_AHEAD);
  expect(verses[0].title).toMatch(/^Versículo do dia · /);
  expect(verses[0].ref).toMatch(/^[A-Z0-9]{3}\.\d+\.\d+$/);
});

test("with a plan: the chapters of each day, the first unread today, nothing after the plan ends", () => {
  const plan = { ...newPlan("nt90", BOOKS, "2026-10-27"), fim: "2026-10-31" }; // 21 chapters in 5 days
  const read = new Map([["JHN.1", {}]]);
  const reading = buildSchedule({ ...base, settings: { ...on, verse: { on: false, time: "08:00" } }, plan, read });
  expect(reading).toHaveLength(5);
  expect(reading[0].body).toBe("Hoje: Jo 1–4 · dia 1 de 5");
  expect(reading[0].ref).toBe("JHN.2");
  expect(reading[1].body).toBe("Hoje: Jo 5–8 · dia 2 de 5");
});

test("today's reminder goes when its time passed or today's reading is done", () => {
  const late = buildSchedule({ ...base, now: new Date(2026, 9, 27, 7, 30) });
  expect(late.find(r => r.id === READING_ID)).toBeUndefined();
  expect(late.find(r => r.id === VERSE_ID)).toBeDefined(); // 08:00 still to come
  const plan = { ...newPlan("nt90", BOOKS, "2026-10-27"), fim: "2026-10-31" };
  const read = new Map(["JHN.1", "JHN.2", "JHN.3", "JHN.4"].map(c => [c, {}]));
  const done = buildSchedule({ ...base, plan, read });
  expect(done.find(r => r.id === READING_ID)).toBeUndefined();
  expect(done.find(r => r.id === READING_ID + 1)).toBeDefined();
});

test("all reminders off: nothing scheduled", () => {
  expect(buildSchedule({ ...base, settings: DEFAULT_SETTINGS })).toEqual([]);
});

function fakePlugin(permission: "granted" | "denied" | "prompt", answer: "granted" | "denied" = "granted") {
  const scheduled: { id: number }[][] = [];
  const plugin = {
    checkPermissions: vi.fn(async () => ({ display: permission })),
    requestPermissions: vi.fn(async () => ({ display: answer })),
    schedule: vi.fn(async (o: { notifications: { id: number }[] }) => scheduled.push(o.notifications)),
    cancel: vi.fn(async () => {}),
    getPending: vi.fn(async () => ({ notifications: [{ id: READING_ID }, { id: 42 }] })),
    addListener: vi.fn()
  };
  return { plugin: plugin as unknown as LocalNotifications & typeof plugin, scheduled };
}

test("notifier: asks only when not answered; replacing cancels only its own ids", async () => {
  const asked = fakePlugin("prompt", "granted");
  expect(await createNotifier(asked.plugin).allow()).toBe(true);
  expect(asked.plugin.requestPermissions).toHaveBeenCalledOnce();
  const denied = fakePlugin("denied");
  expect(await createNotifier(denied.plugin).allow()).toBe(false);
  expect(denied.plugin.requestPermissions).not.toHaveBeenCalled();

  const { plugin, scheduled } = fakePlugin("granted");
  await createNotifier(plugin).replace(buildSchedule(base));
  expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: READING_ID }] }); // not 42, another app's
  expect(scheduled[0]).toHaveLength(2 * DAYS_AHEAD);
  expect(scheduled[0][0]).toMatchObject({ id: READING_ID, extra: { ref: "JHN.3" }, schedule: { allowWhileIdle: true } });
});

test("notifier: a tap opens the place of the reminder", () => {
  const { plugin } = fakePlugin("granted");
  const open = vi.fn();
  createNotifier(plugin).onOpen(open);
  const listener = plugin.addListener.mock.calls[0][1] as (a: object) => void;
  listener({ notification: { extra: { ref: "JHN.3.16" } } });
  expect(open).toHaveBeenCalledWith("JHN.3.16");
});
