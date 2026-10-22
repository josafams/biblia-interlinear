<!-- "⇄ Bíblia": back to the mode used before the last change (phone top bar; hidden when there is none). -->
<script lang="ts">
  import { getMode, swapLabel, type ModeId } from "../lib/modes";
  import { reader } from "../state/reader.svelte";

  let { onswap }: { onswap: (id: ModeId) => void } = $props();
  const other = $derived(reader.previousMode && reader.previousMode !== reader.mode ? getMode(reader.previousMode) : undefined);
</script>

<button
  type="button"
  class="ibtn"
  id="mode-swap"
  data-testid="mode-swap"
  hidden={!other}
  aria-label={other ? swapLabel(other) : undefined}
  onclick={() => other && onswap(other.id)}
  >⇄{#if other}<span class="ms-t"> {other.spoken}</span>{/if}</button
>
