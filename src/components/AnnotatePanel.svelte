<!--
  Anotar (#mbar): on phones a bottom sheet in two sizes (compact: colors and actions; full: also the note, tags,
  review and clear), on computers the side panel with everything. src/reader/annotations/panel.ts does the work
  through the props; ids, data-cor and data-action stay for tests and videos.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { type AnnotateAction as Action, annotate } from "../state/annotate.svelte";
  import SheetHandle from "../ui/SheetHandle.svelte";
  import AnnotateActions from "./AnnotateActions.svelte";
  import AnnotateMore from "./AnnotateMore.svelte";

  let {
    onclose,
    oncolor,
    onaction,
    onsize,
    ontag,
    onnewtag,
    onnote
  }: {
    onclose: () => void;
    oncolor: (color: string) => void;
    onaction: (action: Action, button: HTMLButtonElement) => void;
    onsize: (size: "compact" | "full") => void;
    ontag: (id: string) => void;
    onnewtag: (name: string) => void;
    onnote: (text: string) => void;
  } = $props();

  let panel: HTMLDivElement | undefined = $state();
  function keydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<!-- the full sheet dims the text on phones; a tap there goes back to the compact one -->
<div class="mb-scrim" hidden={!annotate.open || annotate.size !== "full"} onclick={() => onsize("compact")} aria-hidden="true"></div>
<div
  id="mbar"
  class="mbar"
  class:full={annotate.size === "full"}
  data-testid="annotate-panel"
  hidden={!annotate.open}
  role="dialog"
  aria-label={t("annotate.label")}
  tabindex="-1"
  onkeydown={keydown}
  bind:this={panel}
>
  <SheetHandle
    label={t("annotate.resize")}
    sheet={() => panel}
    ontoggle={() => onsize(annotate.size === "full" ? "compact" : "full")}
    onup={() => onsize("full")}
    ondown={() => (annotate.size === "full" ? onsize("compact") : onclose())}
  />
  <div class="mb-top">
    <div class="mb-head"><b id="mb-ref">{annotate.ref}</b><span id="mb-snippet">{annotate.snippet}</span></div>
    <button class="mb-x" id="mb-close" aria-label={t("annotate.close")} onclick={onclose}
      ><svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
      ></button
    >
  </div>
  <div class="mb-body">
    <AnnotateActions {oncolor} {onaction} />
    <AnnotateMore {onaction} {ontag} {onnewtag} {onnote} />
  </div>
  <div class="mb-foot"><button class="mb-done" id="mb-done" onclick={onclose}>{t("annotate.done")}</button></div>
</div>
