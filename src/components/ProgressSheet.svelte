<!--
  "Meu progresso" (#progresso): with the account, how much of the Bible was read, the reading time per day,
  streaks, the 66 books, a reading plan and one book in detail; without it, an invitation to sign in.
  The buttons call web/progress.js through the props; ids and data attributes stay for tests and videos.
-->
<script lang="ts">
  import { formatNumber, t } from "../i18n";
  import { duration } from "../lib/progress/stats";
  import type { ChartTab } from "../lib/progress/view";
  import { progressView as p } from "../state/progress.svelte";

  let {
    onclose,
    ongo,
    ontab,
    onbook,
    onback,
    onchapter,
    onplan,
    onreschedule,
    onfinish,
    onpause,
    onreset
  }: {
    onclose: () => void;
    ongo: (code: string, chapter: number) => void;
    ontab: (tab: ChartTab) => void;
    onbook: (code: string) => void;
    onback: () => void;
    onchapter: (n: number, read: boolean) => void;
    onplan: (id: "ano" | "nt90") => void;
    onreschedule: () => void;
    onfinish: () => void;
    onpause: () => void;
    onreset: () => void;
  } = $props();
  const TABS: ChartTab[] = ["semana", "mes", "ano"];
  const LEGEND = ["none", "half", "more", "done"] as const;
  const fmt = (n: number) => formatNumber(n);
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
  function keydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }
</script>

{#snippet header(title: string)}
  <div class="shead">
    <h2 id="pg-h">{title}</h2>
    <button class="ibtn" id="pg-close" aria-label={t("annotate.close")} onclick={onclose}
      ><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"
        ><path d="M6 6l12 12M18 6L6 18" /></svg
      ></button
    >
  </div>
{/snippet}

<!-- the same aside[role=dialog] as the other sheets (the styles and the tests expect it) -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="progresso"
  class="sheet right progresso-sheet"
  data-testid="progress"
  hidden={!p.open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="pg-h"
  lang="pt-BR"
  tabindex="-1"
  onkeydown={keydown}
>
  {#if !p.signedIn}
    {@render header(t("progress.title"))}
    <div class="pg-sec pg-invite">
      <p>{t("progress.invite")}</p>
      <p class="pg-sub">{t("progress.invite_private")}</p>
      {#if p.canSignIn}<div><button class="gbtn js-signin">{t("account.sign_in")}</button></div>{:else}<p class="pg-sub">
          {t("progress.no_sign_in")}
        </p>{/if}
    </div>
  {:else if p.book && p.detail}
    {@const b = p.book}
    {@const d = p.detail}
    {@render header(b.name)}
    <div><button class="pg-back" id="pg-back" onclick={onback}>{t("progress.back")}</button></div>
    <section class="pg-sec" aria-label={t("progress.book_summary")}>
      <div class="pg-big"><b>{d.read}</b><span>{t("progress.of_chapters", { total: d.total })}</span></div>
      <div class="pg-bar"><i style:width="{((d.read / d.total) * 100).toFixed(1)}%"></i></div>
      <p class="pg-sub">
        {d.remaining
          ? t("progress.remaining", { count: d.remaining }) + (d.forecastDays ? t("progress.forecast", { count: d.forecastDays }) : "")
          : t("progress.book_done")}
      </p>
    </section>
    <section class="pg-sec" aria-labelledby="pg-chaptersh">
      <h3 id="pg-chaptersh">{t("index.chapters")}</h3>
      <p class="pg-sub">{t("progress.chapters_hint")}</p>
      <div class="pg-chapters">
        {#each d.chapters as c (c.n)}
          <button
            class="pg-chapter"
            class:anot={c.notes}
            class:lendo={c.reading}
            data-cap={c.n}
            aria-pressed={c.read}
            aria-label={t("progress.chapter_label", { n: c.n }) +
              (c.read ? t("progress.chapter_read") : "") +
              (c.notes ? t("progress.chapter_notes") : "")}
            onclick={() => onchapter(c.n, !c.read)}>{c.n}</button
          >
        {/each}
      </div>
    </section>
    <section class="pg-sec" aria-label={t("progress.book_numbers")}>
      <div class="pg-tiles">
        <div class="pg-tile"><b>{d.time}</b><span>{t("progress.book_time")}</span></div>
        <div class="pg-tile">
          <b>{d.reread ? d.reread.label : "—"}</b><span
            >{d.reread ? t("progress.most_reread", { count: d.reread.times }) : t("progress.most_reread_none")}</span
          >
        </div>
        <div class="pg-tile"><b>{d.first}</b><span>{t("progress.first_read")}</span></div>
        <div class="pg-tile"><b>{d.last}</b><span>{t("progress.last_read")}</span></div>
      </div>
    </section>
    <div class="pg-btns">
      <button class="prim" data-ir="{b.code}.{d.next}" onclick={() => ongo(b.code, d.next)}
        >{t("progress.read_next", { ref: `${b.abbrev} ${d.next}` })}</button
      >
    </div>
  {:else if p.overview}
    {@const o = p.overview}
    {@render header(t("progress.title"))}
    {#if p.continueAt}
      {@const c = p.continueAt}
      <button class="pg-continue" data-ir="{c.code}.{c.chapter}" onclick={() => ongo(c.code, c.chapter)}
        ><span><small>{t("progress.continue")}</small><b>{c.name} {c.chapter}</b></span><span aria-hidden="true">→</span></button
      >
    {/if}
    <section class="pg-sec" aria-labelledby="pg-bible">
      <h3 id="pg-bible">{t("progress.whole_bible")}</h3>
      <div class="pg-big"><b>{fmt(o.pct)}%</b><span>{t("progress.read_of", { read: fmt(o.read), total: fmt(o.total) })}</span></div>
      <div class="pg-bar" role="img" aria-label={t("progress.pct_read", { pct: fmt(o.pct) })}>
        <i style:width="{Math.min(100, o.pct)}%"></i>
      </div>
      <p class="pg-sub">
        {t("progress.testaments", { ot: o.ot.read, otTotal: o.ot.total, nt: o.nt.read, ntTotal: o.nt.total })} · {t(
          "progress.finished_books",
          {
            count: o.finishedBooks
          }
        )}
      </p>
    </section>
    <section class="pg-sec" aria-label={t("progress.numbers")}>
      <div class="pg-tiles">
        <div class="pg-tile">
          <b>{t("progress.days", { count: o.streak.current })}</b><span>{t("progress.streak", { record: o.streak.record })}</span>
        </div>
        <div class="pg-tile"><b>{o.week}</b><span>{t("progress.week", { average: o.weekAverage })}</span></div>
        <div class="pg-tile"><b>{o.totalTime}</b><span>{t("progress.total_time")}</span></div>
        <div class="pg-tile"><b>{fmt(o.entries)}</b><span>{t("progress.entries")}</span></div>
      </div>
    </section>
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
    <section class="pg-sec" aria-labelledby="pg-map">
      <h3 id="pg-map">{t("progress.books_map")}</h3>
      <div class="pg-map">
        {#each o.map as b (b.code)}
          <button
            class="pg-book n{b.level}"
            data-livro={b.code}
            title={t("progress.book_title", { book: b.name, read: b.read, total: b.total })}
            aria-label={t("progress.book_label", { book: b.name, read: b.read, total: b.total })}
            onclick={() => onbook(b.code)}>{b.abbrev}</button
          >
        {/each}
      </div>
      <div class="pg-legend">
        {#each LEGEND as k, i (k)}<span><i class="pg-legend-{i}"></i>{t(`progress.legend.${k}`)}</span>{/each}
      </div>
    </section>
    <section class="pg-sec" aria-labelledby="pg-plan">
      {#if p.plan}
        {@const s = p.plan}
        <h3 id="pg-plan">{t("progress.plan_of", { plan: s.name })}</h3>
        <p class="pg-sub">
          {t("progress.plan_day", { day: s.dia, days: s.D, done: s.doneText, total: s.totalText })} ·
          <span class="pg-status {s.tipo}">{s.texto}</span>
        </p>
        {#if s.done < s.N}
          <p class="pg-sub">{t("progress.today")}</p>
          <div class="pg-day">
            {#each s.today as c (c.id)}
              <button data-ir={c.id} class={c.read ? "feito" : ""} onclick={() => ongo(c.id.split(".")[0], +c.id.split(".")[1])}
                >{c.label}</button
              >
            {:else}
              <span class="pg-sub">{t("progress.nothing_today")}</span>
            {/each}
          </div>
        {/if}
        <div class="pg-btns">
          <button id="pg-readjust" onclick={onreschedule}>{t("progress.reschedule")}</button><button id="pg-finish" onclick={onfinish}
            >{t("progress.finish_plan")}</button
          >
        </div>
      {:else}
        <h3 id="pg-plan">{t("progress.plan_title")}</h3>
        <p class="pg-sub">{t("progress.plan_pitch")}</p>
        <div class="pg-btns">
          <button data-plano="ano" onclick={() => onplan("ano")}>{t("progress.plans.ano")}</button><button
            data-plano="nt90"
            onclick={() => onplan("nt90")}>{t("progress.plans.nt90")}</button
          >
        </div>
      {/if}
    </section>
    <section class="pg-sec" aria-labelledby="pg-study">
      <h3 id="pg-study">{t("progress.study")}</h3>
      <p class="pg-sub">
        {t("progress.notes", { count: p.study.notas })} · {t("progress.highlights", { count: p.study.marcacoes })} · {t(
          "progress.favorites",
          {
            count: p.study.favoritos
          }
        )}
      </p>
    </section>
    <div class="pg-footer">
      <button id="pg-pause" onclick={onpause}>{t(p.paused ? "progress.resume_time" : "progress.pause_time")}</button>
      <button id="pg-reset" onclick={onreset}>{t("progress.reset")}</button>
    </div>
  {/if}
</aside>
