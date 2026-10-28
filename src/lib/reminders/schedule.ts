// The reminders of the next days as a list of local notifications, each with its text ready: a scheduled
// notification cannot compute its text when it fires, so the app schedules some days ahead and redoes the list
// whenever it opens, a setting changes or chapters are read.
import { t } from "../../i18n";
import { addDays, daysBetween, dayOf, planStatus, type Plan } from "../progress/stats";
import { verseAddress, verseOfDay, verseRef, type DayVerse } from "./verse-of-day";

export type ReminderSettings = {
  reading: { on: boolean; time: string };
  verse: { on: boolean; time: string };
};
export const DEFAULT_SETTINGS: ReminderSettings = { reading: { on: false, time: "07:00" }, verse: { on: false, time: "08:00" } };

/** One notification: ref is where a tap opens ("GEN.1" or "JHN.3.16"). */
export type Reminder = { id: number; at: Date; title: string; body: string; ref: string };

export const DAYS_AHEAD = 14;
/** Fixed ids per kind and day, so the old ones can be cancelled: 1000+ reading, 2000+ verse. */
export const READING_ID = 1000,
  VERSE_ID = 2000;
const BODY_MAX = 180;

type Book = { code: string; abbrev: string; name: string };

const at = (day: string, time: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0);
};
const cut = (s: string) => (s.length > BODY_MAX ? s.slice(0, BODY_MAX - 1).replace(/\s+\S*$/, "") + "…" : s);

/** "Gn 1–3", "Gn 50 · Êx 1–2" */
export function chaptersLabel(caps: string[], books: Book[]) {
  const abbrev = Object.fromEntries(books.map(b => [b.code, b.abbrev]));
  const groups: { book: string; from: number; to: number }[] = [];
  for (const c of caps) {
    const [book, n] = [c.split(".")[0], +c.split(".")[1]];
    const g = groups[groups.length - 1];
    if (g && g.book === book && g.to === n - 1) g.to = n;
    else groups.push({ book, from: n, to: n });
  }
  return groups.map(g => `${abbrev[g.book] || g.book} ${g.from === g.to ? g.from : `${g.from}–${g.to}`}`).join(" · ");
}

export function buildSchedule(o: {
  now: Date;
  settings: ReminderSettings;
  books: Book[];
  plan: Plan | null;
  read: Map<string, unknown>;
  /** where the reading stopped: "JHN.3" (or "JHN.3.16") */
  position: string;
  verses: DayVerse[];
}): Reminder[] {
  const out: Reminder[] = [];
  const first = dayOf(o.now);
  const name = Object.fromEntries(o.books.map(b => [b.code, b.name]));
  for (let k = 0; k < DAYS_AHEAD; k++) {
    const day = addDays(first, k);
    if (o.settings.reading.on) {
      const when = at(day, o.settings.reading.time);
      const plan = o.plan && !o.plan.apagado ? o.plan : null;
      if (when > o.now) {
        if (plan) {
          // the plan's chapters of that day; after its last day, nothing more
          if (daysBetween(plan.inicio, day) <= daysBetween(plan.inicio, plan.fim)) {
            const s = planStatus(plan, o.read, day);
            const left = s.todays.filter(c => !o.read.has(c));
            // today's reading already done: no reminder today (later days are not known yet: the list is redone)
            if (s.todays.length && (k > 0 || left.length))
              out.push({
                id: READING_ID + k,
                at: when,
                title: t("reminder.reading_title"),
                body: t("reminder.reading_plan", { chapters: chaptersLabel(s.todays, o.books), day: s.dia, days: s.D }),
                ref: (k === 0 ? left[0] : s.todays[0]) || s.todays[0]
              });
          }
        } else {
          const [book, ch] = o.position.split(".");
          const where = book && ch ? `${name[book] || book} ${ch}` : "";
          out.push({
            id: READING_ID + k,
            at: when,
            title: t("reminder.reading_title"),
            body: where ? t("reminder.reading_continue", { where }) : t("reminder.reading_start"),
            ref: book && ch ? `${book}.${ch}` : "GEN.1"
          });
        }
      }
    }
    if (o.settings.verse.on) {
      const when = at(day, o.settings.verse.time);
      const v = verseOfDay(o.verses, day);
      if (v && when > o.now)
        out.push({
          id: VERSE_ID + k,
          at: when,
          title: t("reminder.verse_title", { ref: verseRef(v) }),
          body: cut(v.text),
          ref: verseAddress(v)
        });
    }
  }
  return out;
}

/** Every id this module may have scheduled (to cancel before scheduling again). */
export const allIds = () => Array.from({ length: DAYS_AHEAD }, (_, k) => [READING_ID + k, VERSE_ID + k]).flat();
