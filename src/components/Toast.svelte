<!-- The message at the bottom of the screen (#toast). A tap hides it; "Desfazer" undoes the last change. -->
<script lang="ts">
  import { getLocale, t } from "../i18n";
  import { hideToast, toastView as v } from "../state/toast.svelte";
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div class="toast" id="toast" class:dica={v.hint} role="status" lang={getLocale()} hidden={!v.shown} onclick={() => !v.undo && hideToast()}>
  {#if v.undo}
    {@const undo = v.undo}
    <span>{v.text}</span>
    <button
      type="button"
      class="toast-undo"
      data-undo
      onclick={() => {
        hideToast();
        undo();
      }}>{t("toast.undo")}</button
    >
  {:else}{v.text}{/if}
</div>
