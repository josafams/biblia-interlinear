// Reminders and the verse of the day (src/reader/reminders.ts): the settings of this device, whether notifications
// are allowed, the next reminder and today's verse.
import type { ReminderSettings } from "../lib/reminders/schedule";
import { DEFAULT_SETTINGS } from "../lib/reminders/schedule";
import type { DayVerse } from "../lib/reminders/verse-of-day";

export const reminders = $state({
  /** the app has system notifications (false on the web) */
  available: false,
  settings: structuredClone(DEFAULT_SETTINGS) as ReminderSettings,
  /** the system refused notifications */
  denied: false,
  /** "amanhã às 07:00" ("" when nothing is scheduled) */
  next: "",
  verse: null as DayVerse | null
});
