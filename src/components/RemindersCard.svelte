<!--
  "Lembretes" in Você (only in the app): the reading reminder and the verse of the day, each on or off with its
  time, and the next one scheduled. On the web, one line saying they are in the app.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { ReminderSettings } from "../lib/reminders/schedule";
  import { reminders } from "../state/reminders.svelte";

  type Kind = keyof ReminderSettings;
  let { ontoggle, ontime }: { ontoggle: (kind: Kind) => void; ontime: (kind: Kind, time: string) => void } = $props();
  const KINDS: [Kind, string, string][] = [
    ["reading", "reminder.reading_switch", "reminder.reading_hint"],
    ["verse", "reminder.verse_switch", "reminder.verse_hint"]
  ];
</script>

{#if reminders.available}
  <div class="vc-card vc-reminders" id="vc-reminders-card" role="group" aria-labelledby="vc-rem-h">
    <b id="vc-rem-h">{t("reminder.card_title")}</b>
    {#each KINDS as [kind, label, hint] (kind)}
      <div class="vc-rem">
        <button class="chk" role="switch" id="rem-{kind}" aria-checked={reminders.settings[kind].on} onclick={() => ontoggle(kind)}
          ><span>{t(label)}<small>{t(hint)}</small></span><span class="sw2" aria-hidden="true"></span></button
        >
        {#if reminders.settings[kind].on}
          <label class="vc-rem-time"
            >{t("reminder.time")}
            <input
              type="time"
              id="rem-{kind}-time"
              value={reminders.settings[kind].time}
              onchange={e => ontime(kind, e.currentTarget.value)}
            /></label
          >
        {/if}
      </div>
    {/each}
    {#if reminders.denied}
      <span class="vc-rem-note warn">{t("reminder.denied")}</span>
    {:else}
      <span class="vc-rem-note" id="vc-rem-next">{reminders.next ? t("reminder.next", { when: reminders.next }) : t("reminder.none")}</span>
    {/if}
  </div>
{:else}
  <p class="vc-rem-web">{t("reminder.only_app")}</p>
{/if}
