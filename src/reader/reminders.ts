// Reminders and the verse of the day (src/lib/reminders/): the cards of Você, the settings of this device
// (interlinear:lembretes, not synced: each phone has its own times), the schedule of the next days in the system
// notifications of the app, redone when the app opens, comes back, a setting changes or chapters are read, and the
// tap on a notification, which opens the chapter or the verse.
import { mount } from "svelte";
import RemindersCard from "../components/RemindersCard.svelte";
import VerseOfDay from "../components/VerseOfDay.svelte";
import { formatDate, t } from "../i18n";
import { exposedPlugin, isNative } from "../lib/native";
import type { Plan } from "../lib/progress/stats";
import { createNotifier, type LocalNotifications } from "../lib/reminders/notifier";
import { buildSchedule, DEFAULT_SETTINGS, type ReminderSettings } from "../lib/reminders/schedule";
import { verseAddress, verseList, verseOfDay, verseRef } from "../lib/reminders/verse-of-day";
import { verseLink } from "../lib/share";
import { store } from "../lib/store";
import { reminders } from "../state/reminders.svelte";
import { openChapter } from "./chapter";
import { BOOKS } from "./context";
import { shareOrCopy } from "./share";

type Rec = { id: string; [field: string]: unknown };
type Annotations = { allRecords(c: string): Promise<Rec[]>; onChange(f: () => void): void };

const KEY = "lembretes";
const notifier = createNotifier(exposedPlugin<LocalNotifications>("LocalNotifications"));
const verses = verseList(BOOKS);

function loadSettings(): ReminderSettings {
  try {
    const s = JSON.parse(store.get(KEY, "") || "{}");
    return { reading: { ...DEFAULT_SETTINGS.reading, ...s.reading }, verse: { ...DEFAULT_SETTINGS.verse, ...s.verse } };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}
const saveSettings = () => store.set(KEY, JSON.stringify(reminders.settings));

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
/** "hoje às 07:00", "amanhã às 07:00", "qui., 30/10 às 07:00" */
function when(d: Date, now = new Date()) {
  const time = hhmm(d);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 864e5);
  if (diff === 0) return t("reminder.today_at", { time });
  if (diff === 1) return t("reminder.tomorrow_at", { time });
  return t("reminder.day_at", { day: formatDate(d, { weekday: "short", day: "2-digit", month: "2-digit" }), time });
}

/** The schedule of the next days, from the plan, the chapters read and where the reading stopped. */
async function reschedule() {
  reminders.verse = verseOfDay(verses);
  if (!notifier.available) return;
  const s = reminders.settings;
  if (!s.reading.on && !s.verse.on) {
    reminders.next = "";
    return notifier.replace([]);
  }
  if ((await notifier.permission()) !== "granted") {
    reminders.denied = true;
    return;
  }
  reminders.denied = false;
  const A = window.Annotations as Annotations | undefined;
  const [planos, leituras] = A ? await Promise.all([A.allRecords("planos"), A.allRecords("leituras")]) : [[], []];
  const plan = (planos.find(p => p.id === "atual") as unknown as Plan) || null;
  const read = new Map(leituras.filter(l => l.lido).map(l => [l.id, l]));
  const list = buildSchedule({ now: new Date(), settings: s, books: BOOKS, plan, read, position: store.get("posicao", ""), verses });
  await notifier.replace(list);
  const first = list.reduce<Date | null>((a, r) => (!a || r.at < a ? r.at : a), null);
  reminders.next = first ? when(first) : "";
}
let pending: ReturnType<typeof setTimeout> | undefined;
const soon = () => {
  clearTimeout(pending);
  pending = setTimeout(() => reschedule().catch(() => {}), 1500);
};

async function toggle(kind: keyof ReminderSettings) {
  const s = reminders.settings[kind];
  if (!s.on && !(await notifier.allow())) {
    reminders.denied = true;
    return;
  }
  s.on = !s.on;
  saveSettings();
  await reschedule();
}
function setTime(kind: keyof ReminderSettings, time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return;
  reminders.settings[kind].time = time;
  saveSettings();
  reschedule();
}

/** "GEN.1" or "JHN.3.16": the chapter, at the verse when there is one. */
export function openRef(ref: string) {
  const [book, ch, v] = ref.split(".");
  if (BOOKS.some(b => b.code === book) && +ch) openChapter(book, +ch, v ? +v : null);
}

function shareVerse() {
  const v = reminders.verse;
  if (!v) return;
  const url = verseLink({ book: v.book, chapter: v.chapter, verse: v.verse }, { native: isNative, href: location.href });
  shareOrCopy(verseRef(v), t("annotate.share_text", { text: v.text, ref: verseRef(v) }), url);
}

export function initReminders() {
  reminders.available = notifier.available;
  reminders.settings = loadSettings();
  reminders.verse = verseOfDay(verses);
  const verseSlot = document.getElementById("vc-verse"),
    remindersSlot = document.getElementById("vc-reminders");
  if (verseSlot)
    mount(VerseOfDay, {
      target: verseSlot,
      props: { onread: () => reminders.verse && openRef(verseAddress(reminders.verse)), onshare: shareVerse }
    });
  if (remindersSlot) mount(RemindersCard, { target: remindersSlot, props: { ontoggle: toggle, ontime: setTime } });
  notifier.onOpen(openRef);
  reschedule().catch(() => {});
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && soon());
  (window.Annotations as Annotations | undefined)?.onChange(soon);
}

// starts when imported, after the progress (see src/reader/main.ts)
initReminders();
