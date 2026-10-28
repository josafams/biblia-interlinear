// The bridge to the system notifications of the app (Capacitor LocalNotifications), passed in as a parameter so
// tests can use a fake. Permission is asked only when a reminder is turned on.
import { allIds, type Reminder } from "./schedule";

type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";
export type LocalNotifications = {
  checkPermissions(): Promise<{ display: Permission }>;
  requestPermissions(): Promise<{ display: Permission }>;
  schedule(o: { notifications: object[] }): Promise<unknown>;
  cancel(o: { notifications: { id: number }[] }): Promise<void>;
  getPending(): Promise<{ notifications: { id: number }[] }>;
  addListener(event: "localNotificationActionPerformed", fn: (a: { notification: { extra?: { ref?: string } } }) => void): unknown;
};

export function createNotifier(plugin: LocalNotifications | null) {
  return {
    available: !!plugin,
    async permission(): Promise<Permission | "unavailable"> {
      if (!plugin) return "unavailable";
      return (await plugin.checkPermissions()).display;
    },
    /** Asks the system when it has not been answered yet; true when notifications may show. */
    async allow() {
      if (!plugin) return false;
      let p = (await plugin.checkPermissions()).display;
      if (p !== "granted" && p !== "denied") p = (await plugin.requestPermissions()).display;
      return p === "granted";
    },
    /** Replaces the scheduled reminders with these (an empty list cancels them all). */
    async replace(list: Reminder[]) {
      if (!plugin) return;
      const mine = new Set(allIds());
      const pending = (await plugin.getPending()).notifications.filter(n => mine.has(n.id));
      if (pending.length) await plugin.cancel({ notifications: pending.map(n => ({ id: n.id })) });
      if (!list.length) return;
      await plugin.schedule({
        notifications: list.map(r => ({
          id: r.id,
          title: r.title,
          body: r.body,
          largeBody: r.body,
          schedule: { at: r.at, allowWhileIdle: true },
          extra: { ref: r.ref }
        }))
      });
    },
    /** A tap on a reminder: where it opens ("JHN.3.16"). */
    onOpen(fn: (ref: string) => void) {
      plugin?.addListener("localNotificationActionPerformed", a => {
        const ref = a.notification.extra?.ref;
        if (ref) fn(ref);
      });
    }
  };
}
