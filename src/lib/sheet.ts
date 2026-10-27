// The geometry of a bottom sheet on phones: how much the on-screen keyboard covers and how far to scroll so the
// verse being annotated stays visible between the top bar and the sheet.

/**
 * The height the keyboard covers at the bottom of the layout viewport (0 without keyboard). With
 * interactive-widget=resizes-content (Chrome on Android) the layout viewport already shrinks and this stays 0;
 * Safari on iOS only shrinks the visual viewport.
 */
export function keyboardInset(layoutHeight: number, visualHeight: number, visualTop: number) {
  const kb = Math.round(layoutHeight - visualHeight - visualTop);
  return kb > 40 ? kb : 0; // less than that is the address bar moving, not a keyboard
}

/**
 * The scroll position that shows the verse in the room between `top` (bottom of the top bar) and `bottom` (top of
 * the sheet), as close to the sheet as it fits; a verse taller than the room shows its beginning. Positions are
 * relative to the viewport, as getBoundingClientRect gives them; `scrollY` is the current scroll.
 */
export function revealScroll(verse: { top: number; height: number }, room: { top: number; bottom: number }, scrollY: number, gap = 12) {
  const space = room.bottom - room.top - 2 * gap;
  const want = verse.height <= space ? verse.top + verse.height - (room.bottom - gap) : verse.top - (room.top + gap);
  // already fully visible: do not move
  if (verse.top >= room.top + gap && verse.top + Math.min(verse.height, space) <= room.bottom - gap) return scrollY;
  return Math.max(0, Math.round(scrollY + want));
}
