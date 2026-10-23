<!--
  "Ocorrências" (#concordancia): every occurrence of a lemma, filtered by the Bíblia Livre translation and by
  book (or the book on screen), with the translated words marked in each verse. web/study.js fills the state.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { conc, type ConcItem } from "../state/concordance.svelte";

  let {
    onclose,
    ongloss,
    onbook,
    onhere,
    onallglosses,
    onallbooks,
    onmore,
    onitem
  }: {
    onclose: () => void;
    ongloss: (index: number) => void;
    onbook: (index: number) => void;
    onhere: (on: boolean) => void;
    onallglosses: () => void;
    onallbooks: () => void;
    onmore: () => void;
    onitem: (item: ConcItem) => void;
  } = $props();
  // the most common translations first; the rare ones behind "+N" so the list does not take the whole screen
  const TOP = 8;
  const shownGlosses = $derived(conc.allGlosses || conc.glosses.length <= TOP + 1 ? conc.glosses : conc.glosses.slice(0, TOP));
  const shownBooks = $derived(conc.allBooks ? conc.books : conc.books.slice(0, 8));
  const scope = $derived(conc.book == null ? "" : conc.book === conc.hereIndex ? "livro" : "outro");
  function keydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onclose();
    }
  }
</script>

<!-- the same aside[role=dialog] as the other sheets (the styles and the tests expect it) -->
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
  id="concordancia"
  class="sheet right conc-sheet"
  data-testid="concordance"
  hidden={!conc.open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="conc-h"
  tabindex="-1"
  onkeydown={keydown}
>
  <div class="shead">
    <h2 id="conc-h" tabindex="-1">{conc.title}</h2>
    <button class="ibtn" data-fechar aria-label={t("annotate.close")} onclick={onclose}
      ><svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg
      ></button
    >
  </div>
  <div class="sgroup">
    <p class="conc-sub" id="conc-sub">{conc.summary}</p>
    <div class="conc-gl" id="conc-gl" role="group" aria-label={t("concordance.by_translation")}>
      {#if conc.available}
        <button class="chip" data-gl="-1" aria-pressed={conc.gloss < 0} onclick={() => ongloss(-1)}>{t("concordance.all")}</button>
        {#each shownGlosses as g (g.index)}
          <button class="chip" data-gl={g.index} aria-pressed={conc.gloss === g.index} onclick={() => ongloss(g.index)}
            >{g.gloss} <small>{g.count}</small></button
          >
        {/each}
        {#if shownGlosses.length < conc.glosses.length}
          {@const extra = conc.glosses.length - shownGlosses.length}
          <button
            class="chip conc-allgl"
            data-allgl
            aria-label={t("concordance.more_translations", { count: extra })}
            onclick={onallglosses}>+{extra}</button
          >
        {/if}
      {/if}
    </div>
    <h3 class="conc-h3">{t("concordance.where")}</h3>
    <div class="conc-books" id="conc-books" role="group" aria-label={t("search.by_book")}>
      {#each shownBooks as b (b.index)}
        <button class="chip" data-book={b.index} aria-pressed={conc.book === b.index} onclick={() => onbook(b.index)}
          >{b.name} <small>{b.count}</small></button
        >
      {/each}
      {#if shownBooks.length < conc.books.length}
        <button class="chip" data-allbooks onclick={onallbooks}>+{conc.books.length - shownBooks.length}</button>
      {/if}
    </div>
    <div class="conc-scope" role="group" aria-label={t("concordance.scope")}>
      <button class="chip" data-scope="" aria-pressed={scope === ""} onclick={() => onhere(false)}>{t("search.scopes.all")}</button>
      <button
        class="chip"
        data-scope="livro"
        aria-pressed={scope === "livro"}
        id="conc-book"
        hidden={!conc.hereName}
        onclick={() => onhere(true)}>{conc.hereName ? t("search.only_in", { book: conc.hereName }) : ""}</button
      >
    </div>
    <ol class="conc-list" id="conc-list">
      {#each conc.items as it (it.key)}
        <li>
          <button class="conc-item" data-cod={it.code} data-c={it.chapter} data-v={it.verse} data-i={it.word} onclick={() => onitem(it)}>
            <span class="conc-ref">{it.ref}</span><span class="conc-g">{it.gloss}</span>
            <!-- the verse text with the linked words in <mark>, every part escaped (markSpans in src/lib/study/concordance.ts) -->
            <span class="conc-txt" data-k={it.key}
              >{#if it.html === null}…{:else}{@html it.html}{/if}</span
            >
          </button>
        </li>
      {/each}
    </ol>
    <button class="conc-more" id="conc-more" hidden={!conc.more} onclick={onmore}>{t("search.more")}</button>
  </div>
</aside>
