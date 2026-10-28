<!--
  "Buscar na Bíblia" (#busca): words (all of them), a reference ("Sl 23") or a Strong number ("H430"); where to
  look (Bíblia toda, AT, NT, the book on screen), counts per book, similar words and the verses, with the words
  marked. src/reader/search.ts runs the search into src/state/search.svelte.ts.
-->
<script lang="ts">
  import { t } from "../i18n";
  import { search, type SearchItem, type SearchTop } from "../state/search.svelte";
  import Icon from "./Icon.svelte";

  let {
    onclose,
    oninput,
    onsubmit,
    onscope,
    onbook,
    onsimilar,
    onmore,
    ontop,
    onitem
  }: {
    onclose: () => void;
    oninput: () => void;
    onsubmit: () => void;
    onscope: (scope: typeof search.scope) => void;
    onbook: (index: number) => void;
    onsimilar: (word: string) => void;
    onmore: () => void;
    ontop: (top: SearchTop) => void;
    onitem: (item: SearchItem) => void;
  } = $props();
  const SCOPES = ["", "at", "nt"] as const;
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
  id="busca"
  class="sheet right busca-sheet"
  data-testid="search"
  hidden={!search.open}
  role="dialog"
  aria-modal="true"
  aria-labelledby="busca-h"
  tabindex="-1"
  onkeydown={keydown}
>
  <div class="shead">
    <h2 id="busca-h">{t("search.title")}</h2>
    <button class="ibtn" data-fechar aria-label={t("search.close")} onclick={onclose}><Icon name="close" size={18} /></button>
  </div>
  <div class="sgroup">
    <form
      id="busca-form"
      role="search"
      autocomplete="off"
      onsubmit={e => {
        e.preventDefault();
        onsubmit();
      }}
    >
      <label class="sr" for="busca-q">{t("search.label")}</label>
      <input
        id="busca-q"
        class="lsearch"
        type="search"
        enterkeyhint="search"
        placeholder={t("search.placeholder")}
        bind:value={search.query}
        {oninput}
      />
    </form>
    <div class="busca-scope" role="group" aria-label={t("search.where")}>
      {#each SCOPES as s (s)}
        <button class="chip" data-scope={s} aria-pressed={search.scope === s} onclick={() => onscope(s)}
          >{t(`search.scopes.${s || "all"}`)}</button
        >
      {/each}
      <button
        class="chip"
        data-scope="livro"
        aria-pressed={search.scope === "livro"}
        id="busca-book"
        hidden={!search.hereBook}
        onclick={() => onscope("livro")}>{search.hereBook ? t("search.only_in", { book: search.hereBook }) : ""}</button
      >
    </div>
    <div id="busca-top">
      {#if search.top?.kind === "strong"}
        {@const top = search.top}
        <!-- trusted text of the locale, with the number in <b> -->
        <button class="busca-go" data-strong={top.key} onclick={() => ontop(top)}
          >{@html t("search.all_of_strong", { strong: top.key })}</button
        >
      {:else if search.top?.kind === "ref"}
        {@const top = search.top}
        <button class="busca-go" data-cod={top.code} data-c={top.chapter} data-v={top.verse ?? ""} onclick={() => ontop(top)}
          >{t("search.go_to_before")}<b>{top.label}</b>{t("search.go_to_after")}</button
        >
      {/if}
    </div>
    <p class="busca-sub" id="busca-sub" aria-live="polite">{search.summary}</p>
    <p class="busca-sim" id="busca-sim">
      {#if search.similar.length}{t("search.similar")}
        {#each search.similar as w, k (w)}{#if k}
            ·
          {/if}<button class="linklike" data-sim={w} onclick={() => onsimilar(w)}>{w}</button>{/each}{/if}
    </p>
    <div class="conc-books" id="busca-books" role="group" aria-label={t("search.by_book")}>
      {#if search.books.length > 1}
        {#each search.books.slice(0, 12) as b (b.index)}
          <button class="chip" data-book={b.index} aria-pressed={search.book === b.index} onclick={() => onbook(b.index)}
            >{b.name} <small>{b.count}</small></button
          >
        {/each}
      {/if}
    </div>
    <ol class="busca-list" id="busca-list">
      {#each search.items as it (it.id)}
        <li>
          <button class="conc-item busca-item" data-cod={it.code} data-c={it.chapter} data-v={it.verse} onclick={() => onitem(it)}>
            <span class="conc-ref">{it.ref}</span>
            <!-- the verse text with the words in <mark>, every part escaped (highlight in src/lib/search/search.ts) -->
            <span class="conc-txt" data-id={it.id}
              >{#if it.html === null}…{:else}{@html it.html}{/if}</span
            >
          </button>
        </li>
      {/each}
    </ol>
    <button class="conc-more" id="busca-more" hidden={!search.more} onclick={onmore}>{t("search.more")}</button>
    <!-- trusted text of the locale, with <b> examples -->
    <p class="busca-help" id="busca-help" hidden={!!search.query.trim()}>{@html t("search.help")}</p>
  </div>
</aside>
