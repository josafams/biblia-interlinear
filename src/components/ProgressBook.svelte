<!--
  One book in Meu progresso (in ProgressSheet): chapters read out of the total, the chapters to mark as read,
  the numbers of the book and the button to read the next chapter.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { progressView as p } from "../state/progress.svelte";

  let {
    ongo,
    onback,
    onchapter
  }: {
    ongo: (code: string, chapter: number) => void;
    onback: () => void;
    onchapter: (n: number, read: boolean) => void;
  } = $props();
</script>

{#if p.book && p.detail}
  {@const b = p.book}
  {@const d = p.detail}
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
{/if}
