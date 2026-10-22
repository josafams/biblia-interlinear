// Hybrid logical clock: milliseconds + counter + device. It orders edits even when a phone's clock is wrong,
// because it moves ahead whenever it sees a newer change from another device (the sync tells it).
// "01718000000000-0003-ab12cd34" compares as text in the same order as in time.
export function createClock(device: string, now: () => number = Date.now) {
  let t = 0,
    c = 0;
  return {
    /** The next stamp; `seen` ("<ms>-<counter>") is a stamp from elsewhere to move ahead of. */
    next(seen?: string) {
      if (seen) {
        const [vt, vc] = seen.split("-").map(Number);
        if (vt > t || (vt === t && vc > c)) [t, c] = [vt, vc];
      }
      const current = now();
      if (current > t) [t, c] = [current, 0];
      else c++;
      return `${String(t).padStart(14, "0")}-${String(c).padStart(4, "0")}-${device}`;
    }
  };
}
