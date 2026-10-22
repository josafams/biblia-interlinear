<!-- The verses of the chapter on screen (in main#verses), drawn again from scratch on every render. -->
<script lang="ts">
  import { chapter } from "../state/chapter.svelte";
  import Verse from "./Verse.svelte";
</script>

{#key chapter.renderId}
  {#each chapter.verses as v (v.vi)}
    {#if v.section}<h2 class="sechead acro" id="s{v.n}"><span>{v.section.title}</span><span class="sref">{v.section.range}</span></h2>{/if}
    <Verse {v} />
  {/each}
{/key}
