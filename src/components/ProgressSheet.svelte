<!--
  "Meu progresso" (#progresso): with the account, how much of the Bible was read, the reading time per day,
  streaks, the 66 books, a reading plan and one book in detail; without it, an invitation to sign in.
  The buttons call src/reader/progress.ts through the props; ids and data attributes stay for tests and videos.
-->
<script lang="ts">
  import { formatNumber, getLocale, t } from "../i18n";
  import type { ChartTab } from "../lib/progress/view";
  import { progressView as p } from "../state/progress.svelte";
  import ProgressBook from "./ProgressBook.svelte";
  import ProgressChart from "./ProgressChart.svelte";
  import ProgressPlan from "./ProgressPlan.svelte";

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
  const LEGEND = ["none", "half", "more", "done"] as const;
  const fmt = (n: number) => formatNumber(n);
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
  lang={getLocale()}
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
    {@render header(p.book.name)}
    <ProgressBook {ongo} {onback} {onchapter} />
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
    <ProgressChart {ontab} />
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
    <ProgressPlan {ongo} {onplan} {onreschedule} {onfinish} />
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
