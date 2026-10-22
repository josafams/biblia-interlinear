<!-- Top bar (computer): "Notas · N" opens Minhas anotações; N counts the verses with an annotation. -->
<script lang="ts">
  import { t } from "../i18n";
  import { annotated } from "../state/annotations.svelte";

  let { onopen }: { onopen: () => void } = $props();
  const n = $derived(annotated.verses);
</script>

<button
  type="button"
  class="ibtn wide-only"
  id="open-notes"
  data-testid="open-notes"
  aria-label={n ? t("bar.notes_label_count", { count: n }) : t("bar.notes_label")}
  onclick={onopen}
>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"><path d="M5 4h14v16H5z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg
  ><span class="lbl">{t("bar.notes")}</span><span class="nn" id="notes-n">{n ? ` · ${n}` : ""}</span>
</button>
