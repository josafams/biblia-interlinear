<!--
  The timeline of "Sobre o livro" (in AboutBook): one row per person, event or writing, on the axis of the dates
  that src/lib/about.ts works out, with the period band and a legend of the kinds shown.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { timeline } from "../lib/about";

  let { tl }: { tl: ReturnType<typeof timeline> } = $props();
</script>

<div class="tl">
  <div class="tl-bg" aria-hidden="true">
    {#if tl.band}<span class="tl-band" style:left={tl.band.left} style:width={tl.band.width}></span>{/if}{#each tl.ticks as tk, i (i)}<span
        class="tl-tick"
        style:left={tk.left}
      ></span>{/each}
  </div>
  <ol class="tl-rows" aria-label={t("about.timeline")}>
    {#each tl.rows as r, i (i)}
      <li class="tl-row">
        <span class="tl-lab"><b>{r.label}</b><small>{r.range}</small></span>
        <span class="tl-track" aria-hidden="true"
          ><span class="tl-bar {r.kind || ''}" style:left={r.left} style:width={r.width}></span></span
        >
        <span class="sr">{r.note || ""}</span>
      </li>
    {/each}
  </ol>
  <div class="tl-axis" aria-hidden="true">
    <span class="tl-unit">{tl.unit}</span><span class="tl-labels"
      >{#each tl.ticks as tk, i (i)}<span style:left={tk.left}>{tk.label}</span>{/each}</span
    >
  </div>
</div>
<p class="tl-legend">
  {#if tl.kinds.person}<span><i class="k-person"></i>{t("about.legend.people")}</span>{/if}{#if tl.kinds.event}<span
      ><i class="k-event"></i>{t("about.legend.events")}</span
    >{/if}{#if tl.kinds.writing}<span><i class="k-writing"></i>{t("about.legend.writing")}</span>{/if}{#if tl.band}<span
      ><i class="k-band"></i>{tl.band.label} ({tl.band.range})</span
    >{/if}
</p>
