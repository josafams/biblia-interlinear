<!--
  "Aa": opens Aparência. Rendered by the top bar on wide screens and by the bottom bar on phones
  (only one of the two exists at a time, so #open-look stays unique).
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
    class="ibtn icon"
    id="open-look"
    data-testid="open-look"
    aria-label={t("bar.look_label")}
    aria-controls="look"
    aria-expanded={ui.sheet === "look"}
    aria-haspopup="dialog"
    onclick={onopen}><span class="aa" aria-hidden="true">Aa</span><span class="lbl lk-lbl" aria-hidden="true">{t("bar.look")}</span></button
  >
{/if}
