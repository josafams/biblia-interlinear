<!-- One switch of Aparência as a chip (button[role=switch]); the hint shows under the name and as its tooltip. -->
<script lang="ts">
  import { t, tryT } from "../i18n";
  import type { PrefDef } from "../lib/prefs";
  import { prefs } from "../state/prefs.svelte";

  let { def, ontoggle }: { def: PrefDef; ontoggle: (def: PrefDef) => void } = $props();
  const hint = $derived(tryT(`look.switch.${def.id}.hint`));
</script>

<button
  class="chk"
  role="switch"
  id={def.id}
  data-key={def.key}
  data-modo={def.inMode ? "" : undefined}
  aria-checked={!!prefs.values[def.id]}
  title={hint}
  onclick={() => ontoggle(def)}
  ><span
    >{t(`look.switch.${def.id}.label`)}{#if hint}<small>{hint}</small>{/if}</span
  ><span class="sw2" aria-hidden="true"></span></button
>
