<!--
  "Ouvir": reads aloud from the verse on screen; pressed again, it stops. In the top bar (computer) and
  in the middle of the bottom bar (phone), where it reads "Pausar" while reading.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { speech } from "../state/speech.svelte";

  let { place, onsay }: { place: "top" | "bottom"; onsay: (button: HTMLButtonElement) => void } = $props();
</script>

<button
  type="button"
  id={place === "top" ? "bar-say" : "bb-say"}
  class={place === "top" ? "ibtn say-main wide-only" : "main"}
  data-testid="say"
  aria-label={t("audio.listen_from_here")}
  onclick={e => onsay(e.currentTarget)}
>
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>
  {#if place === "top"}<span>{t("audio.listen")}</span>{:else}<span class="bb-t">{t(speech.on ? "audio.pause_short" : "audio.listen")}</span
    >{/if}
</button>
