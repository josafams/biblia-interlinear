<!--
  "Tempo por dia" in Meu progresso (in ProgressSheet): the period tabs and the bar chart with the average line.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { duration } from "../lib/progress/stats";
  import type { ChartTab } from "../lib/progress/view";
  import { progressView as p } from "../state/progress.svelte";

  let { ontab }: { ontab: (tab: ChartTab) => void } = $props();
  const TABS: ChartTab[] = ["semana", "mes", "ano"];
  // the chart: 520 × 160, bars from the base line up to the longest day
  const W = 520,
    H = 160,
    BASE = 136,
    TOP = 12;
  const y = (s: number) => BASE - (s / (p.chart?.max || 60)) * (BASE - TOP);
  const chartLabel = $derived(
    p.chart
      ? t("progress.chart_label", {
          days: p.chart.bars
            .map(b => `${b.label || ""} ${duration(b.seconds)}`)
            .filter(Boolean)
            .join(", "),
          average: duration(p.chart.average)
        })
      : ""
  );
</script>

<section class="pg-sec" aria-labelledby="pg-time">
  <h3 id="pg-time">{t("progress.time_per_day")}</h3>
  <div class="pg-tabs" role="group" aria-label={t("progress.period")}>
    {#each TABS as k (k)}<button class="chip" data-active-tab={k} aria-pressed={p.tab === k} onclick={() => ontab(k)}
        >{t(`progress.tabs.${k}`)}</button
      >{/each}
  </div>
  {#if p.chart}
    {@const bw = W / p.chart.bars.length}
    <div class="pg-chart">
      <svg viewBox="0 0 {W} {H}" role="img" aria-label={chartLabel}>
        {#each p.chart.bars as b, i (i)}
          <rect
            class="bar"
            x={(i * bw + bw * 0.18).toFixed(1)}
            y={y(b.seconds).toFixed(1)}
            width={(bw * 0.64).toFixed(1)}
            height={(BASE - y(b.seconds)).toFixed(1)}
            rx="2"><title>{b.label} {duration(b.seconds)}</title></rect
          >
          <text x={(i * bw + bw / 2).toFixed(1)} y={H - 6} text-anchor="middle">{b.label}</text>
        {/each}
        <line class="media" x1="0" x2={W} y1={y(p.chart.average).toFixed(1)} y2={y(p.chart.average).toFixed(1)} />
        <text x={W - 2} y={Math.max(10, y(p.chart.average) - 4).toFixed(1)} text-anchor="end"
          >{t("progress.average", { time: duration(p.chart.average) })}</text
        >
      </svg>
    </div>
  {/if}
</section>
