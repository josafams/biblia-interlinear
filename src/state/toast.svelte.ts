// The short message at the bottom of the screen (#toast): notices, first-use hints and "Desfazer".
export const toastView = $state({
  shown: false,
  text: "",
  /** a first-use hint (another look, and it does not take touches) */
  hint: false,
  /** the "Desfazer" button, when the message offers it */
  undo: null as (() => void) | null
});

let timer: ReturnType<typeof setTimeout> | undefined;
let shownId = 0;

/**
 * Shows a message; it hides by itself after `ms` (by default as long as it takes to read it, at least 3.5 s),
 * unless another message took its place.
 */
export function showToast(text: string, o: { hint?: boolean; undo?: () => void; ms?: number } = {}) {
  const id = ++shownId;
  Object.assign(toastView, { shown: true, text, hint: !!o.hint, undo: o.undo || null });
  clearTimeout(timer);
  timer = setTimeout(
    () => {
      if (id === shownId) toastView.shown = false;
    },
    o.ms ?? (o.undo ? 8000 : Math.max(3500, text.length * 70))
  );
}

export function hideToast() {
  toastView.shown = false;
}

/** A notice is on screen (a hint does not count: it may be replaced). */
export const noticeShown = () => toastView.shown && !toastView.hint;
