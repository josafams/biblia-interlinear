<!-- Above the text of chapters with section titles (Psalm 119): one link per section, scrolling to it. -->
<script lang="ts">
  import { t } from "../i18n";
  import { chapter } from "../state/chapter.svelte";

  const sections = $derived(chapter.verses.filter(v => v.section));
  const go = (e: MouseEvent, n: number) => {
    e.preventDefault();
    document.getElementById("s" + n)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
</script>

{#if sections.length >= 2}
  <nav id="secmap" class="secmap" data-testid="section-map" aria-label={t("reader.sections")}>
    {#each sections as v (v.n)}<a href="#s{v.n}" data-sec={v.n} onclick={e => go(e, v.n)}>{v.section!.title}</a>{/each}
  </nav>
{/if}
