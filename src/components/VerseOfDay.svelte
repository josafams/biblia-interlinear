<!-- "Versículo do dia" at the top of Você: the reference, the Bíblia Livre text, read it in its chapter or share it. -->
<script lang="ts">
  import { t } from "../i18n";
  import { verseRef } from "../lib/reminders/verse-of-day";
  import { reminders } from "../state/reminders.svelte";

  let { onread, onshare }: { onread: () => void; onshare: () => void } = $props();
</script>

{#if reminders.verse}
  <div class="vc-card vc-verse" id="vc-verse-card" role="group" aria-labelledby="vc-verse-h">
    <b id="vc-verse-h">{t("reminder.verse_card")} · <span class="vc-verse-ref">{verseRef(reminders.verse)}</span></b>
    <p class="vc-verse-text">{reminders.verse.text}</p>
    <div class="vc-verse-actions">
      <button type="button" id="vc-verse-read" onclick={onread}>{t("reminder.read_in_chapter")}</button>
      <button type="button" id="vc-verse-share" onclick={onshare}>{t("reminder.share")}</button>
    </div>
  </div>
{/if}
