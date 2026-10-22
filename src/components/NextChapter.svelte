<!--
  End of the chapter, after the chapter lexicon: the "Próximo capítulo" card (with its theme) and a
  link back to the previous one. A chapter missing from the preview build shows dashed and says so.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { reader, type NeighborChapter } from "../state/reader.svelte";

  let { ongo }: { ongo: (chapter: NeighborChapter) => void } = $props();
</script>

{#snippet card(c: NeighborChapter | null, dir: "prev" | "next")}
  {#if c}
    <button
      type="button"
      class="cnav {dir}"
      class:na={!c.available}
      data-cod={c.code}
      data-ch={c.n}
      data-testid={dir === "next" ? "next-chapter-card" : "prev-chapter-card"}
      aria-disabled={c.available ? undefined : "true"}
      onclick={() => ongo(c)}>{dir === "prev" ? "← " : ""}{c.name} {c.n}<small>{c.theme}</small></button
    >
  {:else}
    <span></span>
  {/if}
{/snippet}

{#if reader.prev || reader.next}
  <nav class="chnav" aria-label={t("reader.chapter_nav")}>
    {@render card(reader.prev, "prev")}{@render card(reader.next, "next")}
  </nav>
{/if}
