<!--
  Capítulos in the index (section.toc-chapters), after a book is picked: the grid of numbers, a card with the
  picked chapter and, below, the list with the theme of each chapter. Chapters missing from the preview build
  show as unavailable.
-->
<script lang="ts">
  import { t } from "../i18n";
  import type { IndexBook } from "../lib/books";
  import { toc } from "../state/toc.svelte";

  let {
    books,
    available,
    onback,
    onopen,
    onunavailable
  }: {
    books: IndexBook[];
    available: (code: string, n: number) => boolean;
    onback: () => void;
    onopen: (n: number) => void;
    onunavailable: (n: number) => void;
  } = $props();
  const book = $derived(books.find(b => b.code === toc.book));
  const picked = $derived(book?.chapters[toc.chapter - 1]);
  const go = (n: number) => (book && available(book.code, n) ? onopen(n) : onunavailable(n));
</script>

<div class="ch-head">
  <button type="button" class="ch-back" id="ch-back" onclick={onback}
    ><svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg
    >{t("index.books")}</button
  >
  <h3 id="ch-h">{book?.name ?? t("index.chapters")}</h3>
</div>
{#if book}
  <div class="chgrid" id="chgrid" data-testid="chapter-grid">
    {#each book.chapters as c (c.n)}
      {@const ok = available(book.code, c.n)}
      <button
        class="chchip"
        class:na={!ok}
        data-ch={c.n}
        aria-pressed={c.n === toc.chapter}
        title={c.t || ""}
        aria-label={t(ok ? "index.open_chapter" : "index.open_chapter_na", { n: c.n, theme: c.t ? `: ${c.t}` : "" })}
        onclick={() => go(c.n)}>{c.n}</button
      >
    {/each}
  </div>
  <div class="chcard" id="chcard" aria-live="polite">
    {#if picked}
      <span class="ct">{book.name} {picked.n}{picked.t ? ` · ${picked.t}` : ""}</span>
      <span class="cm"
        >{toc.here.book === book.code && toc.here.chapter === picked.n ? t("index.you_are_here") : ""}{t("index.verse_count", {
          count: picked.v
        })}{available(book.code, picked.n) ? "" : t("index.not_in_preview")}</span
      >
    {/if}
  </div>
  <div class="ch-list" id="ch-list">
    {#each book.chapters as c (c.n)}
      <button
        type="button"
        class="ch-row"
        class:here={c.n === toc.chapter}
        data-ch={c.n}
        aria-disabled={available(book.code, c.n) ? undefined : "true"}
        onclick={() => go(c.n)}><span class="cr-n">{c.n}</span><span class="cr-t">{c.t || ""}</span></button
      >
    {/each}
  </div>
{:else}
  <div class="chgrid" id="chgrid"></div>
  <div class="chcard" id="chcard" aria-live="polite"></div>
  <div class="ch-list" id="ch-list"></div>
{/if}
