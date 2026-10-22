<!--
  "Livros": opens the index. Rendered by the top bar on wide screens and by the bottom bar on phones
  (only one of the two exists at a time, so #open-toc stays unique).
-->
<script lang="ts">
  import { t } from "../i18n";
  import { layout } from "../state/layout.svelte";
  import { ui } from "../state/ui.svelte";

  let { place, onopen }: { place: "top" | "bottom"; onopen: () => void } = $props();
</script>

{#if layout.phone === (place === "bottom")}
  <button
    type="button"
    class="ibtn"
    id="open-toc"
    data-testid="open-toc"
    aria-label={t("bar.books_label")}
    aria-controls="toc"
    aria-expanded={ui.sheet === "toc"}
    aria-haspopup="dialog"
    onclick={onopen}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /></svg
    ><span class="lbl">{t("bar.books")}</span>
  </button>
{/if}
