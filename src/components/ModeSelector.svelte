<!--
  The four reading modes as a segmented radio group: in the top bar on wide screens (variant "bar")
  and in Aparência (variant "card"). The classes .bmode/.mcard and data-modo stay for the legacy
  styles, the tests and the "Como usar" videos.
-->
<script lang="ts">
  import { MODE_MENU, getMode, type ModeId } from "../lib/modes";
  import { reader } from "../state/reader.svelte";

  let { variant, onselect }: { variant: "bar" | "card"; onselect: (id: ModeId) => void } = $props();
  const modes = MODE_MENU.map(id => getMode(id)!);
</script>

{#each modes as m (m.id)}
  <button
    type="button"
    class={variant === "bar" ? "bmode" : "mcard"}
    role="radio"
    aria-checked={reader.mode === m.id}
    data-modo={m.id}
    data-testid="mode-option"
    title={m.description}
    onclick={() => onselect(m.id)}>{m.name}</button
  >
{/each}
