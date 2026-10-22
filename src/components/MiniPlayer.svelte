<!-- Phone: "Lendo João 3:16 · grego" above the bottom bar while reading aloud, with a pause button. -->
<script lang="ts">
  import { t } from "../i18n";
  import { speech } from "../state/speech.svelte";

  let { onstop }: { onstop: () => void } = $props();
</script>

<div class="miniplayer" id="miniplayer" data-testid="mini-player" hidden={!speech.on} role="status">
  <span id="mp-t">{speech.label}</span>
  <button type="button" id="mp-stop" aria-label={t("audio.pause")} onclick={onstop}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
  </button>
</div>
