<!-- "Versículos de João 3" in the index: one chip per verse, the one on screen marked. The links are data-go (src/reader/toc.ts). -->
<script lang="ts">
  import { t } from "../i18n";
  import { goto } from "../state/goto.svelte";
</script>

<h3 id="toc-vh">{goto.versesOf || t("goto.verses")}</h3>
<div id="toc-days" class="sgroup">
  {#if goto.verses.length}
    <div class="vgrid" role="list" aria-labelledby="toc-vh">
      {#each goto.verses as v (v.n)}
        <!-- the legacy markup (links as list items of the grid; .vgrid > a in the styles) -->
        <!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
        <a
          class="vchip"
          class:here={v.n === goto.here}
          role="listitem"
          href="#v{v.n}"
          data-go
          data-v={v.n}
          aria-current={v.n === goto.here ? "location" : undefined}
          aria-label={t("goto.verse_label", { ref: v.label })}>{v.n === 0 ? t("goto.title_short") : v.n}</a
        >
      {/each}
    </div>
  {/if}
</div>
