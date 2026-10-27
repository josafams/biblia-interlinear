<!--
  The handle at the top of a bottom sheet: a tap toggles its size; dragging up asks for more, dragging down for less
  (the sheet follows the finger through --drag on the element that has the sheet). Only drawn on phones (CSS).
-->
<script lang="ts">
  let {
    label,
    sheet,
    ontoggle,
    onup,
    ondown
  }: { label: string; sheet: () => HTMLElement | undefined; ontoggle: () => void; onup: () => void; ondown: () => void } = $props();

  let y0: number | null = null,
    moved = 0;
  function down(e: PointerEvent) {
    y0 = e.clientY;
    moved = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sheet()?.classList.add("dragging");
  }
  function move(e: PointerEvent) {
    if (y0 === null) return;
    moved = e.clientY - y0;
    sheet()?.style.setProperty("--drag", `${Math.max(0, moved)}px`);
  }
  function up() {
    if (y0 === null) return;
    y0 = null;
    const el = sheet();
    el?.classList.remove("dragging");
    el?.style.removeProperty("--drag");
    if (Math.abs(moved) < 6) ontoggle();
    else if (moved < -30) onup();
    else if (moved > 60) ondown();
  }
</script>

<!-- a keyboard press arrives as a click with no pointer (detail 0) -->
<button
  class="sheet-handle"
  aria-label={label}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onclick={e => e.detail === 0 && ontoggle()}
></button>
